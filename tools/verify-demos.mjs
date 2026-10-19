/* End-to-end rehearsal of the worker contract, without a browser.

   A fake Worker captures the source the sandbox posts, then this harness
   re-creates exactly the scope the real worker bootstrap provides (demo API,
   console shim, runner) and executes the shipped demos for real. It does not
   pretend to be a browser Ã¢â‚¬â€ it checks that the generated source is valid, that
   the demo API contract holds, and that the shipped demos actually run and
   return what they claim.

   Run from deploy/:  node tools/verify-demos.mjs                              */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandboxSrc = readFileSync(join(root, 'pages', 'js-terminal', 'worker-sandbox.js'), 'utf8');
const typeBasicsSrc = readFileSync(join(root, 'pages', 'js-terminal', 'demos', 'type-basics.js'), 'utf8');

let fail = 0;
const check = (name, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (!cond && extra ? ' -> ' + extra : ''));
  if (!cond) fail++;
};

/* --- a fake Worker standing in for the real one --------------------------- */

let captured = null;

function FakeWorker() {
  this.posted = [];
  this.terminated = false;
  this.postMessage = (msg) => {
    this.posted.push(msg);
    if (msg.type === 'run') captured = msg;
  };
  this.terminate = () => { this.terminated = true; };
}
FakeWorker.prototype.addEventListener = function () {};
FakeWorker.prototype.removeEventListener = function () {};

/* --- load worker-sandbox.js with browser globals stubbed ------------------ */

const sbGlobals = {
  self: {},
  console,
  Blob: function (parts) { this.parts = parts; },
  URL: { createObjectURL: () => 'blob:fake', revokeObjectURL() {} },
  Worker: FakeWorker,
  Map, Promise, Object, Array, JSON, String, Number, Error, RegExp, Date, Math, setTimeout,
};
sbGlobals.self = sbGlobals;
sbGlobals.globalThis = sbGlobals;
vm.runInNewContext(sandboxSrc, sbGlobals, { filename: 'worker-sandbox.js' });

const sandbox = sbGlobals.Sandbox.create();

/* --- load the registry and the demos the way the browser does ------------- */

const combined = {};
combined.self = combined;
combined.console = console;
combined.Promise = Promise;
combined.Set = Set;
combined.Map = Map;
combined.Object = Object;
combined.Array = Array;
combined.JSON = JSON;
combined.String = String;
combined.Number = Number;
combined.Math = Math;
combined.Error = Error;
combined.Date = Date;
combined.globalThis = combined;

const regSrc = readFileSync(join(root, 'pages', 'js-terminal', 'demos', 'registry.js'), 'utf8');
const collatzSrc = readFileSync(join(root, 'pages', 'js-terminal', 'demos', 'collatz.js'), 'utf8');

/* The registry reads each demo file's own text through document.currentScript,
   so the stub must present the file being loaded at that moment. */
const docStub = { currentScript: null };
combined.document = docStub;

vm.runInNewContext(regSrc, combined, { filename: 'registry.js' });
docStub.currentScript = { textContent: collatzSrc };
vm.runInNewContext(collatzSrc, combined, { filename: 'collatz.js' });
docStub.currentScript = { textContent: typeBasicsSrc };
vm.runInNewContext(typeBasicsSrc, combined, { filename: 'type-basics.js' });
docStub.currentScript = null;

const registry = combined.Demos;

/* --- rebuild the worker's scope and run a demo for real ------------------ */

function makeWorkerScope(onOutput) {
  let askId = 0;
  const answers = new Map();

  function send(msg) { onOutput(msg); }

  const consoleShim = {
    log: (...a) => send({ type: 'out', method: 'log', args: a }),
    info: (...a) => send({ type: 'out', method: 'log', args: a }),
    warn: (...a) => send({ type: 'out', method: 'warn', args: a }),
    error: (...a) => send({ type: 'out', method: 'error', args: a }),
  };

  /* mirrors the bootstrap's demo API, including the deferred question */
  const demo = {
    print: (v) => { send({ type: 'out', method: 'log', args: v === undefined ? [] : [v] }); return Promise.resolve(); },
    printSource: (s) => { send({ type: 'out', method: 'source', args: [String(s)] }); return Promise.resolve(); },
    clear: () => { send({ type: 'out', method: 'clear', args: [] }); return Promise.resolve(); },
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))),
    now: () => Date.now(),
    random: () => 0.5,
    ask: (q) => {
      const id = ++askId;
      const reply = answers.has(id) ? answers.get(id) : 'unknown';
      send({ type: 'out', method: 'log', args: [q + '  [' + reply + ']'] });
      return Promise.resolve(reply);
    },
  };

  /* runner.import: served from a tiny in-memory module table */
  const mods = {
    './helper.js': { helper: () => 'from helper' },
  };
  const runner = { import: (spec) => Promise.resolve(mods[spec] || {}) };

  return { demo, console: consoleShim, runner, send };
}

function runCaptured(source, args, onOutput, demoName) {
  const scope = makeWorkerScope(onOutput);
  const module = { exports: {} };
  /* The bootstrap injects its own Demos stand-in; the harness must inject the
     same object it later reads back from, or the lookup always misses. */
  const defined = Object.create(null);
  const DemosStub = {
    define: (name, meta, fn) => {
      if (process.env.DEBUG_REG) console.log('    [stub] define(' + name + ', ' + typeof fn + ')');
      defined[name] = fn;
    },
    list: () => [],
    get: (n) => defined[n] || null,
  };
  if (process.env.DEBUG_REG) console.log('    [harness] source mentions Demos.define:', /Demos\.define/.test(source));
  /* new Function cannot see the surrounding scope, so Demos is passed in too */
  const factory = new Function(
    'demo', 'console', 'args', 'runner', 'module', 'exports', 'Demos',
    source
  );
  return Promise.resolve(
    factory(scope.demo, scope.console, args, scope.runner, module, module.exports, DemosStub)
  ).then((factoryResult) => {
    let d = factoryResult;
    if (d && typeof d === 'object' && typeof d.default === 'function') d = d.default;
    if (typeof d !== 'function' && demoName) d = defined[demoName];
    if (typeof d !== 'function') {
      throw new Error('could not resolve demo function' + (demoName ? ' for "' + demoName + '"' : ''));
    }
    return d(args);
  });
}

/* --- drive the real sandbox pipeline ------------------------------------- */

console.log('=== the sandbox produces a runnable source ===');
const collatz = registry.get('collatz');
check('collatz registered', !!collatz);
check('collatz is a function', typeof collatz.run === 'function');
check('collatz carries its file text', typeof collatz.fileText === 'string' && collatz.fileText.length > 100,
  String(collatz.fileText && collatz.fileText.length));
check('file text is the demo file itself', /Demos\.define\('collatz'/.test(collatz.fileText || ''));

const lines = [];
await new Promise((resolve) => {
  sandbox.run(collatz.fileText, { _: ['6'] }, (method, args) => {
    lines.push({ method, text: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ') });
  });
  resolve();
});

check('sandbox posted a run message', !!captured && captured.type === 'run');
check('posted source is a string', captured && typeof captured.source === 'string');
check('args forwarded', captured && captured.args._[0] === '6');

/* the generated source must parse, exactly as the worker would evaluate it */
let parseError = null;
try { new Function(captured.source); } catch (e) { parseError = e.message; }
check('generated source parses', parseError === null, parseError);

if (process.env.DUMP_SOURCE) {
  console.log('\n--- POSTED SOURCE (head) ---');
  console.log(captured.source.split('\n').slice(0, 12).join('\n'));
  console.log('--- POSTED SOURCE (tail) ---');
  console.log(captured.source.split('\n').slice(-10).join('\n'));
  console.log('--- end ---\n');
}

/* now actually execute it, in the scope the worker builds */
console.log('\n=== collatz runs for real ===');
const out1 = [];
const result1 = await runCaptured(captured.source, { _: ['6'] }, (msg) => out1.push(msg), 'collatz');
const text1 = out1.filter((m) => m.type === 'out').map((m) => m.args.join(' ')).join('\n');
check('collatz returned its summary', result1 === 'collatz complete', JSON.stringify(result1));
check('collatz printed the sequence header', /collatz\(6\)/.test(text1), text1.slice(0, 120));
check('collatz printed an equation line', /6 .* steps to reach 1/.test(text1.replace(/\n/g, ' ')) || /steps to reach 1/.test(text1));
check('collatz reached 1 for n=6', /steps to reach 1 : 8/.test(text1), text1);
check('collatz drew bars', /\u2588/.test(text1));

console.log('\n=== a second run, different argument ===');
captured = null;
const lines2 = [];
sandbox.run(collatz.fileText, { _: ['27'] }, () => {});
check('second run captured', !!captured);
const out2 = [];
const result2 = await runCaptured(captured.source, { _: ['27'] }, (msg) => out2.push(msg), 'collatz');
const text2 = out2.filter((m) => m.type === 'out').map((m) => m.args.join(' ')).join('\n');
check('n=27 has 111 steps', /steps to reach 1 : 111/.test(text2), text2);
check('n=27 peaks at 9232', /peak value       : 9232/.test(text2), text2);

console.log('\n=== clamp on absurd input ===');
const t3 = [];
captured = null;
sandbox.run(collatz.fileText, { _: ['-5'] }, () => {});
await runCaptured(captured.source, { _: ['-5'] }, (m) => t3.push(m), 'collatz');
const text3 = t3.filter((m) => m.type === 'out').map((m) => m.args.join(' ')).join('\n');
check('negative input clamps to 1', /collatz\(1\)/.test(text3), text3.slice(0, 80));
check('1 needs zero steps', /steps to reach 1 : 0/.test(text3), text3);

console.log('\n=== the compiled TypeScript demo runs ===');
const tb = registry.get('type-basics');
check('type-basics registered', !!tb);
check('type-basics carries its .ts source path', tb && tb.source === 'demos/src/type-basics.ts', tb && tb.source);
captured = null;
sandbox.run(tb.fileText, { _: ['2'] }, () => {});
check('type-basics posted a run', !!captured && captured.type === 'run');

let tbParse = null;
try { new Function(captured.source); } catch (e) { tbParse = e.message; }
check('compiled demo source parses', tbParse === null, tbParse);

const tbOut = [];
const tbResult = await runCaptured(captured.source, { _: ['2'] }, (m) => tbOut.push(m), 'type-basics');
const tbText = tbOut.filter((m) => m.type === 'out').map((m) => m.args.join(' ')).join('\n');
check('compiled demo returned a score', /^\d+\/2 correct$/.test(tbResult), JSON.stringify(tbResult));
check('compiled demo mentions its TypeScript source', /demos\/src\/type-basics\.ts/.test(tbText));
check('compiled demo asked a question', /typeof \?/.test(tbText));
check('compiled demo printed the runtime type', /inferredType\(\)/.test(tbText));

console.log('\n=== a demo that throws is reported, not swallowed ===');
captured = null;
/* a demo must register before it can be resolved, so this mimics a real file */
const boomerSrc = [
  'async function boomer() {',
  "  throw new Error('deliberate failure');",
  '}',
  "Demos.define('boomer', { title: 'Boomer' }, boomer);",
].join('\n');
sandbox.run(boomerSrc, {}, () => {});
check('boomer posted a run', !!captured && captured.type === 'run');
const thrown = [];
let caughtMessage = null;
try {
  await runCaptured(captured.source, {}, (m) => thrown.push(m), 'boomer');
} catch (e) {
  caughtMessage = e.message;
}
check('the throw propagates to the caller', caughtMessage === 'deliberate failure', String(caughtMessage));

console.log('\n=== an unregistered demo is reported clearly ===');
captured = null;
sandbox.run('async function orphan() { return 1; }', {}, () => {});
let orphanMessage = '';
try {
  await runCaptured(captured.source, {}, () => {}, 'orphan');
} catch (e) {
  orphanMessage = e.message;
}
check('unregistered demo gives a useful error', /could not resolve demo function/.test(orphanMessage), orphanMessage);

console.log('\n=== the module guard rejects bad input early ===');
const guard = sbGlobals.Sandbox._guardModuleSyntax;
let guardMessage = '';
try { guard('export default function f() {}'); } catch (e) { guardMessage = e.message; }
check('export is rejected with advice', /module\.exports/.test(guardMessage), guardMessage);

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
