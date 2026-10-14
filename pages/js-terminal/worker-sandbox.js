/* ===========================================================================
   worker-sandbox.js — runs demos in an isolated Web Worker.

   Why a worker rather than eval on the page:

     * a runaway loop burns its own thread, so the page never freezes
     * the code has no DOM, no cookies and no access to the page's scope
     * `import()` works inside a module worker, so demos can be split up

   The worker is built from a Blob so there is no separate file to keep in
   sync and nothing extra to fetch. The demo source is compiled to an async
   function with `new Function`, which is appended to the worker bootstrap —
   it evaluates in the worker's own realm, never in the page's.

   Message protocol, page  ->  worker:
     { type: 'run', id, source, args }
     { type: 'answer', id, value }          reply to a `demo.ask` request
     { type: 'abort' }                      terminate instantly

   worker  ->  page:
     { type: 'out',   id, method, args }    print / warn / error line
     { type: 'ask',   id, question }        needs input (answer is awaited)
     { type: 'done',  id, ms }              finished normally
     { type: 'throw', id, message, stack }  threw
   =========================================================================== */

(function (global) {
  'use strict';

  /* --- the worker bootstrap ------------------------------------------------
     Kept as a string so it can become a Blob URL. `__SOURCE__` is replaced per
     run, which is why there is exactly one placeholder and it is asserted
     below. */

  var BOOTSTRAP = [
    "'use strict';",
    '',
    'var __pending = new Map();',
    'var __askId = 0;',
    '',
    'function __send(msg) { self.postMessage(msg); }',
    '',
    '/* Minimal console: demo output is forwarded, the real one is untouched. */',
    'var console = {',
    "  log:   function () { __send({ type: 'out', method: 'log',   args: __fmt(arguments) }); },",
    "  info:  function () { __send({ type: 'out', method: 'log',   args: __fmt(arguments) }); },",
    "  warn:  function () { __send({ type: 'out', method: 'warn',  args: __fmt(arguments) }); },",
    "  error: function () { __send({ type: 'out', method: 'error', args: __fmt(arguments) }); },",
    '};',
    '',
    'function __fmt(args) {',
    '  var out = [];',
    '  for (var i = 0; i < args.length; i++) out.push(args[i]);',
    '  return out;',
    '}',
    '',
    '/* demo API — every method returns a promise so demos can await it. */',
    'var demo = {',
    '  print: function (v) {',
    "    __send({ type: 'out', method: 'log', args: v === undefined ? [] : [v] });",
    '    return Promise.resolve();',
    '  },',
    '  printSource: function (src) {',
    "    __send({ type: 'out', method: 'source', args: [String(src)] });",
    '    return Promise.resolve();',
    '  },',
    '  ask: function (question) {',
    '    var id = ++__askId;',
    "    __send({ type: 'ask', id: id, question: String(question == null ? '' : question) });",
    '    return new Promise(function (resolve) { __pending.set(id, resolve); });',
    '  },',
    '  sleep: function (ms) {',
    '    return new Promise(function (r) { setTimeout(r, Math.max(0, Number(ms) || 0)); });',
    '  },',
    '  clear: function () {',
    "    __send({ type: 'out', method: 'clear', args: [] });",
    '    return Promise.resolve();',
    '  },',
    '  now: function () { return Date.now(); },',
    '  random: function () { return Math.random(); },',
    '};',
    '',
    '/* A static `import X from "./y.js"` cannot be hoisted into an async function,',
    '   so the runner pre-resolves each specifier and the source is rewritten to',
    '   await the resolved module. Names are bound below so the original',
    '   identifiers still work. */',
    'var __mods = Object.create(null);',
    'var __runner = {',
    '  import: function (spec) {',
    '    if (!__mods[spec]) __mods[spec] = import(spec);',
    '    return __mods[spec];',
    '  },',
    '};',
    '',
    '/* A demo file is a normal script: it calls Demos.define and leaves the',
    '   function on the namespace. The sandbox supplies this stand-in so the',
    '   file has something to register into, then reads the demo back out. */',
    'var __defined = Object.create(null);',
    'var Demos = {',
    '  define: function (name, meta, fn) { __defined[name] = fn; },',
    '  list: function () { return []; },',
    '  get: function (name) { return __defined[name] || null; },',
    '};',
    '',
    'async function __run(factoryResult, args, demoName) {',
    '  var d = factoryResult;',
    '  /* accept a returned function, a CommonJS default, or the registry entry */',
    "  if (d && typeof d === 'object' && typeof d.default === 'function') d = d.default;",
    "  if (typeof d !== 'function' && demoName) d = __defined[demoName];",
    '  if (typeof d !== "function") {',
    '    throw new Error(',
    '      "could not resolve demo function" + (demoName ? " for \\"" + demoName + "\\"" : "") +',
    '      " \\u2014 the file must call Demos.define(name, meta, fn)"',
    '    );',
    '  }',
    '  return await d(args || {});',
    '}',
    '',
    'self.onmessage = function (event) {',
    '  var msg = event.data || {};',
    '',
    "  if (msg.type === 'answer') {",
    '    var resolve = __pending.get(msg.id);',
    '    if (resolve) { __pending.delete(msg.id); resolve(msg.value); }',
    '    return;',
    '  }',
    '',
    "  if (msg.type !== 'run') return;",
    '',
    '  var started = Date.now();',
    '  var id = msg.id;',
    '',
    '  Promise.resolve()',
    '    .then(function () {',
    '      /* new Function bodies cannot see this scope, so everything the demo',
    '         file might touch has to be passed in explicitly. */',
    '      var factory = new Function(',
    "        'demo', 'console', 'args', 'runner', 'module', 'exports', 'Demos',",
    '        msg.source',
    '      );',
    '      var module = { exports: {} };',
    '      /* the wrapper resolves to whatever the demo factory returned */',
    '      return Promise.resolve(',
    '        factory(demo, console, msg.args || {}, __runner, module, module.exports, Demos)',
    '      );',
    '    })',
    '    .then(function (factoryResult) {',
    '      return __run(factoryResult, msg.args || {}, msg.demoName);',
    '    })',
    '    .then(function () {',
    "      __send({ type: 'done', id: id, ms: Date.now() - started });",
    '    })',
    '    .catch(function (err) {',
    "      __send({",
    "        type: 'throw', id: id,",
    "        message: err && err.message ? err.message : String(err),",
    "        stack: err && err.stack ? String(err.stack) : '',",
    '      });',
    '    });',
    '};',
    '',
  ].join('\n');

  /* --- import rewriting ---------------------------------------------------- */

  var IMPORT_RE = /^[ \t]*import\s+([^;'"]+?)\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*$/gm;
  var BARE_RE = /^[ \t]*import\s+['"]([^'"]+)['"]\s*;?[ \t]*$/gm;

  /* Rewrites static imports into awaited lookups and returns the binding code.
     Handles default, named, aliased and namespace forms. */
  function rewriteImports(source) {
    var preamble = [];
    var n = 0;

    var body = source.replace(IMPORT_RE, function (whole, names, specifier) {
      var mod = '__m' + n++;
      preamble.push('  var ' + mod + ' = await runner.import(' + JSON.stringify(specifier) + ');');

      var clause = names.trim();
      var binding = [];

      if (clause.charAt(0) === '{') {
        /* named: { a, b as c } */
        var inner = clause.slice(1, clause.lastIndexOf('}'));
        inner.split(',').forEach(function (piece) {
          var parts = piece.split(/\s+as\s+/);
          var from = parts[0].trim();
          var to = parts[1] ? parts[1].trim() : from;
          if (from) binding.push(to + ' = ' + mod + '[' + JSON.stringify(from) + ']');
        });
      } else if (clause.charAt(0) === '*') {
        /* namespace: * as ns */
        var alias = clause.split(/\s+as\s+/)[1];
        if (alias) binding.push(alias.trim() + ' = ' + mod);
      } else if (clause.indexOf(',') !== -1) {
        /* default + named or namespace */
        var head = clause.slice(0, clause.indexOf(',')).trim();
        binding.push(head + ' = ' + mod + '.default');
        var rest = clause.slice(clause.indexOf(',') + 1).trim();
        if (rest.charAt(0) === '{') {
          rest.slice(1, rest.lastIndexOf('}')).split(',').forEach(function (piece) {
            var parts = piece.split(/\s+as\s+/);
            var from = parts[0].trim();
            var to = parts[1] ? parts[1].trim() : from;
            if (from) binding.push(to + ' = ' + mod + '[' + JSON.stringify(from) + ']');
          });
        }
      } else {
        /* plain default */
        binding.push(clause + ' = ' + mod + '.default');
      }

      if (binding.length) preamble.push('  var ' + binding.join(', ') + ';');
      return '';
    });

    /* bare `import "./side-effect.js"` */
    body = body.replace(BARE_RE, function (whole, specifier) {
      preamble.push('  await runner.import(' + JSON.stringify(specifier) + ');');
      return '';
    });

    return { body: body, preamble: preamble };
  }

  /* --- module-syntax guard -------------------------------------------------
     A demo travels to the worker as the text of a function, so it cannot carry
     `export` declarations — those are only legal at a module's top level. The
     convention is `module.exports = { default: fn }` instead. Catching this
     here turns a baffling "Unexpected token 'export'" into something actionable.

     Static `import` IS handled, because the rewriter strips it before this runs.
     `import.meta` cannot be, since it is only valid inside a real module. */

  function guardModuleSyntax(body) {
    var stripped = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    if (/^\s*export\s/m.test(stripped)) {
      throw new Error(
        'demo contains `export`, which cannot cross into the worker. ' +
        'Replace `export default async function f() {}` with ' +
        '`module.exports = { default: async function f() {} };`'
      );
    }
    if (/import\s*\.\s*meta/.test(stripped)) {
      throw new Error(
        'demo uses `import.meta`, which is only valid inside a module. ' +
        'Pass what you need through `args` instead.'
      );
    }
  }

  /* Wraps a demo file's text so the worker can evaluate it.

     `Function.prototype.toString()` on a function returns only its declaration,
     never the surrounding file — so a demo cannot be extracted from the page by
     grabbing one function. The sandbox therefore hands over the demo FILE's text
     and re-evaluates it in the worker, which is exactly what the browser does.
     The file's `Demos.define(...)` call then registers with the worker's stub,
     and the woker reads the demo back out under `args.name`.

     `module` and `exports` are injected by new Function so a file that prefers
     the CommonJS shape still works; `Demos` is injected so registration lands in
     the worker rather than on the global. */
  function wrap(source) {
    guardModuleSyntax(source);
    var split = rewriteImports(source);
    return [
      'return (async function () {',
      split.preamble.join('\n'),
      '',
      '  /* --- demo file begins --- */',
      split.body,
      '  /* --- demo file ends --- */',
      '})();',
    ].join('\n');
  }

  /* --- public sandbox ----------------------------------------------------- */

  function createSandbox() {
    var objectUrl = null;
    var worker = null;
    var seq = 0;
    var pending = new Map();
    var askHandler = null;

    function ensureWorker() {
      if (worker) return worker;

      var blob = new Blob([BOOTSTRAP], { type: 'text/javascript' });
      objectUrl = URL.createObjectURL(blob);
      /* module worker: required for dynamic import() inside the sandbox */
      worker = new Worker(objectUrl, { type: 'module' });

      worker.onmessage = function (event) {
        var msg = event.data || {};
        var entry = pending.get(msg.id);
        if (!entry) return;

        switch (msg.type) {
          case 'out':
            if (entry.onOut) entry.onOut(msg.method, msg.args);
            break;
          case 'ask':
            Promise.resolve(askHandler ? askHandler(msg.question) : '')
              .then(function (value) { worker.postMessage({ type: 'answer', id: msg.id, value: value }); });
            break;
          case 'done':
            pending.delete(msg.id);
            entry.resolve({ ok: true, ms: msg.ms });
            break;
          case 'throw':
            pending.delete(msg.id);
            entry.resolve({ ok: false, message: msg.message, stack: msg.stack });
            break;
        }
      };

      worker.onerror = function (event) {
        /* surfaces syntax errors in the rewritten source */
        var message = event && event.message ? event.message : 'worker error';
        pending.forEach(function (entry) {
          if (entry.onOut) entry.onOut('error', [message]);
          entry.resolve({ ok: false, message: message, stack: '' });
        });
        pending.clear();
        /* the worker is now unusable — drop it so the next run gets a fresh one */
        hardReset();
      };

      return worker;
    }

    function hardReset() {
      if (worker) worker.terminate();
      worker = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    return {
      /* Run a demo. `fileText` is the demo FILE's source, not one function: the
         worker re-evaluates the file so its Demos.define call can register.
         onOut(method, args) streams output lines. */
      run: function (fileText, args, onOut, demoName) {
        ensureWorker();
        var id = ++seq;
        var source = wrap(String(fileText));

        return new Promise(function (resolve) {
          pending.set(id, { resolve: resolve, onOut: onOut });
          worker.postMessage({
            type: 'run',
            id: id,
            source: source,
            args: args || {},
            demoName: demoName || '',
          });
        });
      },

      /* called when a demo awaits demo.ask(...) */
      onAsk: function (fn) { askHandler = fn; },

      /* kill any running demo immediately */
      abort: function () {
        hardReset();
        pending.forEach(function (entry) { entry.resolve({ ok: false, message: 'interrupted', stack: '' }); });
        pending.clear();
      },

      destroy: hardReset,
    };
  }

  global.Sandbox = {
    create: createSandbox,
    _rewriteImports: rewriteImports,
    _guardModuleSyntax: guardModuleSyntax,
  };
})(typeof self !== 'undefined' ? self : this);
