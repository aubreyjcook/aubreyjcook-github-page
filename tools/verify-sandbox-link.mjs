/* Loads a sandbox.json manifest and registers its demos without executing them
   on the page. Run from the repo root:  node tools/verify-sandbox-link.mjs     */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let fail = 0;
const check = (name, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (!cond && extra ? ' -> ' + extra : ''));
  if (!cond) fail++;
};

const sb = {
  console,
  Promise,
  URL,
  Map,
  JSON,
  String,
  RegExp,
  Object,
  Array,
  Error,
  AbortController,
  document: { currentScript: null },
};
sb.self = sb;
sb.globalThis = sb;

vm.runInNewContext(readFileSync(join(root, 'pages', 'js-terminal', 'demos', 'registry.js'), 'utf8'), sb, { filename: 'registry.js' });
vm.runInNewContext(readFileSync(join(root, 'pages', 'js-terminal', 'sandbox-link.js'), 'utf8'), sb, { filename: 'sandbox-link.js' });
vm.runInNewContext(readFileSync(join(root, 'pages', 'js-terminal', 'worker-sandbox.js'), 'utf8'), sb, { filename: 'worker-sandbox.js' });

const { SandboxLink, Demos, Sandbox } = sb;

console.log('=== target parsing ===');
const gh = SandboxLink.parseTarget('acme/sandbox');
check('owner/repo uses jsDelivr', gh.manifestUrl === 'https://cdn.jsdelivr.net/gh/acme/sandbox@main/sandbox.json', gh.manifestUrl);
check('owner/repo label includes the ref', gh.label === 'acme/sandbox@main', gh.label);

const pinned = SandboxLink.parseTarget('acme/sandbox@v1:demos/manifest.json');
check('ref and manifest path', pinned.manifestUrl === 'https://cdn.jsdelivr.net/gh/acme/sandbox@v1/demos/manifest.json', pinned.manifestUrl);

const direct = SandboxLink.parseTarget('https://example.com/labs/sandbox.json');
check('absolute manifest is kept', direct.manifestUrl === 'https://example.com/labs/sandbox.json', direct.manifestUrl);

const dir = SandboxLink.parseTarget('http://127.0.0.1:8080/sandbox/');
check('directory gains sandbox.json', dir.manifestUrl === 'http://127.0.0.1:8080/sandbox/sandbox.json', dir.manifestUrl);

let badTarget = '';
try { SandboxLink.parseTarget('not a target'); } catch (e) { badTarget = e.message; }
check('rejects a vague target', /unrecognised sandbox target/.test(badTarget), badTarget);

let traversal = '';
try { SandboxLink.parseTarget('acme/sandbox@main:../../secret.json'); } catch (e) { traversal = e.message; }
check('rejects .. in the manifest path', /cannot contain \.\./.test(traversal), traversal);

console.log('\n=== registration extraction ===');
const collatzSrc = readFileSync(join(root, 'pages', 'js-terminal', 'demos', 'collatz.js'), 'utf8');
const typeSrc = readFileSync(join(root, 'pages', 'js-terminal', 'demos', 'type-basics.js'), 'utf8');
const collatzReg = SandboxLink.extractRegistration(collatzSrc);
const typeReg = SandboxLink.extractRegistration(typeSrc);
check('collatz name', collatzReg && collatzReg.name === 'collatz', JSON.stringify(collatzReg));
check('collatz title', collatzReg && collatzReg.meta.title === 'Collatz sequence', collatzReg && collatzReg.meta.title);
check('type-basics lang', typeReg && typeReg.meta.lang === 'typescript', typeReg && typeReg.meta.lang);
check('type-basics source path', typeReg && typeReg.meta.source === 'demos/src/type-basics.ts', typeReg && typeReg.meta.source);
check('a file with no define is skipped', SandboxLink.extractRegistration('async function nope() {}') === null);

console.log('\n=== connect, shadow, disconnect ===');
sb.document.currentScript = { textContent: 'local collatz source' };
Demos.define('collatz', { title: 'Local collatz', lang: 'javascript' }, function collatz() {});
check('built-in file text captured', Demos.get('collatz').fileText === 'local collatz source');

const helloSrc = [
  'import { greet } from "./lib.js";',
  'async function hello() {',
  '  await demo.print(greet());',
  "  return 'ok';",
  '}',
  "Demos.define('hello', {",
  "  title: 'Hello',",
  "  blurb: 'Says hello.',",
  "  lang: 'javascript',",
  "  source: 'src/hello.ts',",
  '}, hello);',
].join('\n');

const remoteCollatz = [
  'async function collatz() { return "remote"; }',
  "Demos.define('collatz', { title: 'Remote collatz', lang: 'javascript' }, collatz);",
].join('\n');

const manifest = {
  schema: 1,
  name: 'acme-sandbox',
  description: 'Example sandbox',
  runner: 'worker',
  demos: ['demos/hello.js', 'demos/collatz.js', 'demos/skip.js'],
};

const files = {
  'https://cdn.jsdelivr.net/gh/acme/sandbox@main/sandbox.json': JSON.stringify(manifest),
  'https://cdn.jsdelivr.net/gh/acme/sandbox@main/demos/hello.js': helloSrc,
  'https://cdn.jsdelivr.net/gh/acme/sandbox@main/demos/collatz.js': remoteCollatz,
  'https://cdn.jsdelivr.net/gh/acme/sandbox@main/demos/skip.js': 'async function skip() { return 1; }',
};

function fetchImpl(url) {
  const body = files[url];
  if (body == null) {
    return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('missing'), json: () => Promise.resolve({}) });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
  });
}

const linked = await SandboxLink.connect('acme/sandbox', { fetch: fetchImpl });
check('link label is the manifest name', linked.label === 'acme-sandbox', linked.label);
check('skipped the file with no define', linked.problems.some((p) => /skip\.js/.test(p)), linked.problems.join(' | '));
check('hello registered from the file', Demos.get('hello') && Demos.get('hello').title === 'Hello');
check('hello keeps its authored source path', Demos.get('hello').source === 'src/hello.ts', Demos.get('hello') && Demos.get('hello').source);
check('hello file text is the fetched source', Demos.get('hello').fileText === helloSrc);
check('hello base url is the file', Demos.get('hello').baseUrl === 'https://cdn.jsdelivr.net/gh/acme/sandbox@main/demos/hello.js', Demos.get('hello') && Demos.get('hello').baseUrl);
check('remote collatz shadows the built-in', Demos.get('collatz').title === 'Remote collatz', Demos.get('collatz') && Demos.get('collatz').title);
check('remote collatz carries fetched text', /Remote collatz/.test(Demos.get('collatz').fileText || ''));

const rewritten = Sandbox._rewriteImports(helloSrc, Demos.get('hello').baseUrl);
const preamble = rewritten.preamble.join('\n');
check('relative import resolves against the demo file',
  /https:\/\/cdn\.jsdelivr\.net\/gh\/acme\/sandbox@main\/demos\/lib\.js/.test(preamble),
  preamble);

const gone = SandboxLink.disconnect();
check('disconnect removes the linked demos', gone.removed === 2, String(gone.removed));
check('hello is gone', Demos.get('hello') === null);
check('built-in collatz is restored', Demos.get('collatz').title === 'Local collatz' && Demos.get('collatz').fileText === 'local collatz source');
check('current link is cleared', SandboxLink.current() === null);

console.log('\n=== refused manifests ===');
async function connectManifest(body, url) {
  const target = url || 'https://example.com/sandbox.json';
  try {
    await SandboxLink.connect(target, {
      fetch(asked) {
        if (asked !== target) return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
      },
    });
    return '';
  } catch (e) {
    return e.message;
  }
}

check('node runner is refused', /runner "node"/.test(await connectManifest({ schema: 1, runner: 'node', demos: ['a.js'] })), );
check('wrong schema is refused', /schema/.test(await connectManifest({ schema: 2, demos: ['a.js'] })));
check('parent path is refused', /cannot contain \.\./.test(await connectManifest({ schema: 1, demos: ['../secret.js'] })));
check('absolute demo path is refused', /must be relative/.test(await connectManifest({ schema: 1, demos: ['https://evil.example/x.js'] })));

const missingMsg = await (async () => {
  try {
    await SandboxLink.connect('https://example.com/missing.json', {
      fetch() { return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('nope') }); },
    });
    return '';
  } catch (e) { return e.message; }
})();
check('missing manifest reports the status', /returned 404/.test(missingMsg), missingMsg);
check('a failed connect leaves the built-in in place', Demos.get('collatz').title === 'Local collatz');

console.log('\n=== this repo is a valid sandbox target ===');
const own = JSON.parse(readFileSync(join(root, 'sandbox.json'), 'utf8'));
check('root manifest schema', own.schema === 1);
check('root manifest runner', own.runner === 'worker');
check('root manifest lists both demos', Array.isArray(own.demos) && own.demos.length === 2, JSON.stringify(own.demos));
for (const entry of own.demos) {
  const text = readFileSync(join(root, entry.path), 'utf8');
  const reg = SandboxLink.extractRegistration(text);
  check(entry.path + ' defines ' + entry.name, reg && reg.name === entry.name, reg && reg.name);
}

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
