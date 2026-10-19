/* Exercises the parts of the worker sandbox that can run outside a browser:
   the import rewriter and the generated bootstrap source.
   Run from deploy/:  node tools/verify-sandbox-worker.mjs                     */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'pages', 'js-terminal', 'worker-sandbox.js');
const src = readFileSync(file, 'utf8');

let fail = 0;
const check = (name, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (!cond && extra ? ' -> ' + extra : ''));
  if (!cond) fail++;
};

/* load the module with the browser globals it touches at definition time only */
const sb = { self: {}, console, Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, Worker: function () {} };
sb.self = sb;
vm.runInNewContext(src, sb, { filename: 'worker-sandbox.js' });

const Sandbox = sb.Sandbox;
check('Sandbox global exposed', !!Sandbox && typeof Sandbox.create === 'function');
check('rewriter exposed for testing', typeof Sandbox._rewriteImports === 'function');

const rw = Sandbox._rewriteImports;

console.log('\n=== import rewriting ===');

const cases = [
  {
    name: 'default import',
    input: 'import thing from "./thing.js";\nthing();',
    expectPreamble: /var __m0 = await runner\.import\("\.\/thing\.js"\);/,
    expectBinding: /var thing = __m0\.default;/,
    expectBody: /thing\(\);/,
    expectNoImport: true,
  },
  {
    name: 'named imports',
    input: 'import { a, b as c } from "./m.js";\na(); c();',
    expectBinding: /var a = __m0\["a"\], c = __m0\["b"\];/,
    expectNoImport: true,
  },
  {
    name: 'namespace import',
    input: 'import * as ns from "./m.js";\nns.go();',
    expectBinding: /var ns = __m0;/,
    expectNoImport: true,
  },
  {
    name: 'default plus named',
    input: 'import def, { x } from "./m.js";\ndef(); x();',
    expectBinding: /var def = __m0\.default, x = __m0\["x"\];/,
    expectNoImport: true,
  },
  {
    name: 'bare side-effect import',
    input: 'import "./setup.js";\nrun();',
    expectPreamble: /await runner\.import\("\.\/setup\.js"\);/,
    expectNoImport: true,
  },
  {
    name: 'no imports is a no-op',
    input: 'const x = 1;\nprint(x);',
    expectNoImport: false,
  },
];

for (const c of cases) {
  const out = rw(c.input);
  const all = out.preamble.join('\n');
  if (c.expectPreamble) check(c.name + ': resolved specifier', c.expectPreamble.test(all), all);
  if (c.expectBinding) check(c.name + ': binds names', c.expectBinding.test(all), all);
  if (c.expectBody) check(c.name + ': body kept', c.expectBody.test(out.body), out.body);
  if (c.expectNoImport) check(c.name + ': import statement removed', !/^\s*import\s/m.test(out.body), out.body);
  check(c.name + ': no eager top-level import left', !/^\s*import\s/m.test(out.body));
}

/* the rewritten body must still be valid JavaScript once wrapped the way the
   sandbox wraps it, otherwise the worker would die on a syntax error */
console.log('\n=== rewritten source parses in the real wrapper ===');

/* the real demo convention: a factory whose body assigns module.exports */
const demoSource = [
  'import { helper } from "./helper.js";',
  'module.exports = {',
  '  default: async function demo() {',
  '    await demo.print(helper());',
  '  },',
  '};',
].join('\n');

const split = rw(demoSource);
const wrapped = [
  '(async function () {',
  split.preamble.join('\n'),
  '  var module = { exports: {} };',
  '  var exports = module.exports;',
  split.body,
  '  return module.exports;',
  '})',
].join('\n');

try {
  new Function(wrapped);   /* parse only */
  check('rewritten demo source parses', true);
} catch (e) {
  check('rewritten demo source parses', false, e.message + '\n' + wrapped);
}

console.log('\n=== module-syntax guard ===');
const guard = Sandbox._guardModuleSyntax;
const guardCases = [
  ['export default function', 'export default async function f() {}', false],
  ['export const', 'export const x = 1;', false],
  ['export { }', 'export { thing };', false],
  ['import.meta', 'const u = import.meta.url;', false],
  ['module.exports is fine', 'module.exports = { default: async function f() {} };', true],
  ['static import is fine (rewritten)', 'import a from "./a.js";\nmodule.exports = { default: a };', true],
  ['string containing export is fine', 'demo.print("export default");', true],
  ['comment containing export is fine', '// export default\nmodule.exports = { default: () => 1 };', true],
];
for (const [name, body, shouldPass] of guardCases) {
  let passed = true;
  let message = '';
  try { guard(body); } catch (e) { passed = false; message = e.message; }
  check(name, passed === shouldPass, shouldPass ? message : 'expected it to be rejected');
}

/* the demo files must be valid as classic page scripts, since that is how the
   page loads them — a top-level `return` would be a SyntaxError there */
console.log('\n=== shipped demo files ===');
for (const demoFile of [
  'pages/js-terminal/demos/registry.js',
  'pages/js-terminal/demos/collatz.js',
  'pages/js-terminal/demos/type-basics.js',
]) {
  const text = readFileSync(join(root, demoFile), 'utf8');
  let parseError = null;
  try { new Function(text); } catch (e) { parseError = e.message; }
  check(demoFile + ': parses as a classic script', parseError === null, parseError);
  check(demoFile + ': no top-level return', !/^return\s/m.test(text));
  check(demoFile + ': no export statements', !/^\s*export\s/m.test(text));
}

const registrySrc = readFileSync(join(root, 'pages/js-terminal/demos', 'registry.js'), 'utf8');
check('registry counts its own source', /currentScript/.test(registrySrc));

/* GitHub Pages runs this repo through Jekyll, which silently drops any path
   beginning with an underscore. A file named `_registry.js` was excluded from
   the published site exactly this way, breaking the terminal in production
   while it worked locally. Guard against the name coming back. */
console.log('\n=== GitHub Pages static-serving guard ===');
check('.nojekyll exists at the site root', existsSync(join(root, '.nojekyll')));
const underscorePaths = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.name.startsWith('_')) underscorePaths.push(relative(root, p));
    if (e.isDirectory()) walk(p);
  }
})(root);
check('no underscore-prefixed paths that Jekyll would drop', underscorePaths.length === 0,
  underscorePaths.join(', '));

for (const demoFile of ['pages/js-terminal/demos/collatz.js', 'pages/js-terminal/demos/type-basics.js']) {
  const text = readFileSync(join(root, demoFile), 'utf8');
  check(demoFile + ': registers itself', /Demos\.define\(/.test(text));
  check(demoFile + ': has an async demo function', /async function [A-Za-z0-9_$]+\s*\(/.test(text));
}

console.log('\n=== bootstrap sanity ===');
/* reach into the module to confirm the placeholder contract holds */
const bootMatch = src.match(/var BOOTSTRAP = \[([\s\S]*?)\]\.join\('\\n'\);/);
check('BOOTSTRAP is a string array', !!bootMatch);
const bootText = bootMatch ? bootMatch[1] : '';
check('bootstrap declares the runner import helper', /__runner = \{/.test(bootText) || /runner/.test(bootText));
check('bootstrap installs onmessage', /self\.onmessage = function/.test(bootText));
check('bootstrap wraps source in new Function', /new Function\(/.test(bootText));
check('bootstrap reports done/throw', /type: 'done'/.test(bootText) && /type: 'throw'/.test(bootText));
check('bootstrap forwards console methods', /log:/.test(bootText) && /error:/.test(bootText));
check('bootstrap exposes the demo API', /var demo = \{/.test(bootText));

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
