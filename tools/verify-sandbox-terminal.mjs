/* Drives pages/js-terminal/terminal.js against a DOM stub, with the sandbox
   mocked so behaviour can be asserted deterministically.
   Run from deploy/:  node tools/verify-sandbox-terminal.mjs                   */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'pages', 'js-terminal', 'terminal.js'), 'utf8');

let fail = 0;
const check = (name, cond, extra) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (!cond && extra ? ' -> ' + extra : ''));
  if (!cond) fail++;
};

/* --- DOM ------------------------------------------------------------------ */

function El(tag) {
  const n = {
    tagName: String(tag).toUpperCase(),
    children: [], attributes: {}, _text: '', parentNode: null, disabled: false, value: '', placeholder: '',
    _listeners: {},
    get className() { return this.attributes.class || ''; },
    set className(v) { this.attributes.class = v; },
    get firstChild() { return this.children[0] || null; },
    get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text; },
    set textContent(v) { this.children = []; this._text = String(v); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    addEventListener(t, f) { (this._listeners[t] ||= []).push(f); },
    removeEventListener(t, f) { const a = this._listeners[t] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); },
    focus() { this._focused = true; },
    querySelector(sel) { return find(this, sel); },
    querySelectorAll() { return []; },
    get scrollHeight() { return this.children.length * 20; },
    set scrollTop(v) { this._scrollTop = v; },
    get scrollTop() { return this._scrollTop || 0; },
  };
  n.classList = {
    _s: () => new Set(n.className.split(/\s+/).filter(Boolean)),
    add(...cs) { const s = n.classList._s(); cs.forEach((x) => s.add(x)); n.className = [...s].join(' '); },
    remove(...cs) { const s = n.classList._s(); cs.forEach((x) => s.delete(x)); n.className = [...s].join(' '); },
    contains: (c) => n.classList._s().has(c),
    toggle(c, f) { const h = n.classList.contains(c); const w = f === undefined ? !h : f; (w ? n.classList.add : n.classList.remove).call(n.classList, c); return w; },
  };
  return n;
}

const simple = (node, sel) => {
  const m = sel.match(/^([a-zA-Z0-9]+)?((?:[.#][\w-]+|\[[^\]]+\])*)$/);
  if (!m) return false;
  if (m[1] && node.tagName !== m[1].toUpperCase()) return false;
  if (node.tagName === '#TEXT') return false;
  for (const t of (m[2] || '').match(/[.#][\w-]+|\[[^\]]+\]/g) || []) {
    if (t[0] === '.') { if (!node.classList.contains(t.slice(1))) return false; }
    else if (t[0] === '#') { if (node.attributes.id !== t.slice(1)) return false; }
    else if (!(t.slice(1, -1) in node.attributes)) return false;
  }
  return true;
};
const matches = (node, sel) => sel.trim().split(/\s+/).reverse()
  .reduce((ok, part, i, arr) => {
    if (!ok) return false;
    if (i === 0) return simple(node, part);
    return true;
  }, true) && (() => {
    const chain = sel.trim().split(/\s+/).reverse();
    if (!simple(node, chain[0])) return false;
    let cur = node.parentNode;
    for (let i = 1; i < chain.length; i += 1) {
      let found = false;
      while (cur) { if (simple(cur, chain[i])) { found = true; cur = cur.parentNode; break; } cur = cur.parentNode; }
      if (!found) return false;
    }
    return true;
  })();

function walk(r, fn) { (r.children || []).forEach((k) => { fn(k); walk(k, fn); }); }
function find(r, sel) { let hit = null; walk(r, (n) => { if (!hit && matches(n, sel)) hit = n; }); return hit; }

/* --- build the sandbox DOM that terminal.js expects ----------------------- */

const sandboxRoot = El('section');
sandboxRoot.className = 'sandbox';
const outEl = El('div'); outEl.className = 'sandbox__out'; outEl.setAttribute('data-output', ''); sandboxRoot.appendChild(outEl);
const form = El('form'); form.setAttribute('data-form', ''); sandboxRoot.appendChild(form);
const input = El('input'); input.setAttribute('data-input', ''); form.appendChild(input);
const stateEl = El('span'); stateEl.className = 'sandbox__state'; stateEl.setAttribute('data-state', ''); sandboxRoot.appendChild(stateEl);

const body = El('body');
body.appendChild(sandboxRoot);

const document = {
  querySelector: (sel) => (sel === '.sandbox' ? sandboxRoot : null),
  querySelectorAll: () => [],
  createElement: (t) => El(t),
};

/* --- mock the sandbox ---------------------------------------------------- */

const calls = { run: 0, abort: 0, ask: null, lastArgs: null, lastFactoryName: null };
let pendingResolve = null;
let askResolver = null;

const Sandbox = {
  create() {
    return {
      run(factory, args, onOut, demoName, baseUrl) {
        calls.run += 1;
        calls.lastArgs = args;
        calls.lastBase = baseUrl;
        calls.lastFactoryName = factory && factory.name;
        /* clear first, so the lines emitted after it are observable */
        onOut('clear', []);
        onOut('log', ['hello from demo', 42]);
        onOut('warn', ['a warning']);
        onOut('error', ['an error']);
        onOut('source', ['line one\nline two']);
        return new Promise((resolve) => { pendingResolve = resolve; });
      },
      onAsk(fn) { calls.ask = fn; },
      abort() { calls.abort += 1; if (pendingResolve) pendingResolve({ ok: false, message: 'interrupted' }); },
    };
  },
};

/* --- mock the demo registry ---------------------------------------------- */

const DEMOS = {
  alpha: {
    name: 'alpha', title: 'Alpha demo', blurb: 'does alpha things', lang: 'javascript', source: '',
    run: function alpha() { return 'a'; },
  },
  beta: {
    name: 'beta', title: 'Beta demo', blurb: '', lang: 'typescript', source: 'demos/src/beta.ts',
    baseUrl: 'https://example.com/demos/beta.js',
    run: function beta() { return 'b'; },
  },
};
const Demos = {
  list: () => Object.values(DEMOS),
  get: (n) => DEMOS[n] || null,
};

/* --- run terminal.js ----------------------------------------------------- */

const linkCalls = [];
let linked = null;
const SandboxLink = {
  connect(target) {
    linkCalls.push(target);
    linked = {
      label: 'demo/sandbox@main',
      description: 'external demos',
      demos: ['remote-demo'],
      problems: ['one file skipped'],
      manifestUrl: 'https://cdn.jsdelivr.net/gh/demo/sandbox@main/sandbox.json',
      cancelled: false,
    };
    return Promise.resolve(linked);
  },
  cancel() { linkCalls.push('cancel'); },
  disconnect() {
    const label = linked ? linked.label : '';
    const removed = linked ? linked.demos.length : 0;
    linked = null;
    return { removed, label };
  },
  current() { return linked; },
};

const win = { Sandbox, Demos, SandboxLink };
const sb = { window: win, document, console, Promise, setTimeout, Math, Date, JSON, String, Number, Object, Array, Error, RegExp };
sb.self = sb;
sb.globalThis = sb;

vm.runInNewContext(src, sb, { filename: 'terminal.js' });

/* --- helpers ------------------------------------------------------------- */

const lines = () => outEl.children.map((c) => ({ text: c.textContent, cls: c.className }));
const allText = () => lines().map((l) => l.text).join('\n');

function submit(cmd) {
  input.value = cmd;
  const handlers = form._listeners.submit || [];
  handlers.forEach((h) => h({ preventDefault() {} }));
}
function key(k, opts = {}) {
  const handlers = input._listeners.keydown || [];
  handlers.forEach((h) => h(Object.assign({ key: k, preventDefault() {}, ctrlKey: false }, opts)));
}

/* --- assertions ---------------------------------------------------------- */

console.log('=== first paint ===');
check('banner printed', /AUBREY-1 SANDBOX TERMINAL/.test(allText()));
check('hints at `demos` and `help`', /demos/.test(allText()) && /help/.test(allText()));
check('state starts IDLE', stateEl.textContent === 'IDLE', stateEl.textContent);
check('input focused', input._focused === true);

console.log('\n=== help ===');
submit('help');
check('lists run', /run <name>/.test(allText()));
check('lists demos', /demos, ls/.test(allText()));

console.log('\n=== demos listing ===');
submit('demos');
check('lists both demos', /alpha/.test(allText()) && /beta/.test(allText()));
check('shows the language tag', /\[typescript\]/.test(allText()));
check('shows the .ts source path', /demos\/src\/beta\.ts/.test(allText()));

console.log('\n=== unknown command ===');
const before = outEl.children.length;
submit('nope');
const added = lines().slice(before).map((l) => l.text + '|' + l.cls);
check('reports unknown command', /unknown command: nope/.test(added.join('\n')), added.join(' / '));
check('suggests help', /try `help`/.test(added.join('\n')));

console.log('\n=== run via explicit command ===');
calls.run = 0;
submit('run alpha');
check('sandbox.run called once', calls.run === 1, String(calls.run));
check('args.name passed through', calls.lastArgs && calls.lastArgs.name === 'alpha');
check('output lines rendered', /hello from demo 42/.test(allText()));
check('warning styled', lines().some((l) => l.text === 'a warning' && /is-warn/.test(l.cls)));
check('error styled', lines().some((l) => l.text === 'an error' && /is-error/.test(l.cls)));
check('source printed per line', lines().some((l) => l.text === 'line one' && /is-source/.test(l.cls)));
check('clear wiped prior output', !/banner printed|AUBREY-1 SANDBOX TERMINAL/.test(allText()));
check('state is RUNNING while busy', stateEl.textContent === 'RUNNING', stateEl.textContent);
check('input disabled while busy', input.disabled === true);

console.log('\n=== completion ===');
pendingResolve({ ok: true, ms: 12 });
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));
check('success reported', /alpha finished in 12ms/.test(allText()));
check('state back to IDLE', stateEl.textContent === 'IDLE', stateEl.textContent);
check('input re-enabled', input.disabled === false);

console.log('\n=== bare demo name is shorthand ===');
calls.run = 0;
submit('beta');
check('sandbox.run called', calls.run === 1, String(calls.run));
check('ran beta', calls.lastArgs && calls.lastArgs.name === 'beta');
check('base url forwarded', calls.lastBase === 'https://example.com/demos/beta.js', String(calls.lastBase));
pendingResolve({ ok: false, message: 'boom' });
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));
check('failure reported', /beta stopped: boom/.test(allText()));

console.log('\n=== demo args ===');
calls.run = 0;
submit('run alpha 99 extra');
check('args passed as _', calls.lastArgs && calls.lastArgs._.join(',') === '99,extra', JSON.stringify(calls.lastArgs && calls.lastArgs._));
pendingResolve({ ok: true, ms: 1 });
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));

console.log('\n=== source command ===');
submit('source alpha');
check('shows serialised function', /function alpha/.test(allText()));

console.log('\n=== history navigation ===');
input.value = '';
key('ArrowUp');
check('up recalls last command', input.value.length > 0, JSON.stringify(input.value));
key('ArrowDown');
check('down returns to empty', input.value === '', JSON.stringify(input.value));

console.log('\n=== busy guards ===');
submit('run alpha');
const runCount = calls.run;
submit('run beta');
check('submit ignored while busy', calls.run === runCount, String(calls.run));
key('Escape');
check('escape aborts', calls.abort > 0, String(calls.abort));
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));
check('interrupt surfaced', /interrupted/.test(allText()));

console.log('\n=== interactive ask ===');
check('sandbox.onAsk registered', typeof calls.ask === 'function');
if (typeof calls.ask === 'function') {
  const p = calls.ask('typeof ?');
  check('question printed', /typeof \?/.test(allText()));
  check('state is INPUT while asking', stateEl.textContent === 'INPUT', stateEl.textContent);
  input.value = 'number';
  key('Enter');
  const answer = await p;
  check('answer resolved', answer === 'number', JSON.stringify(answer));
  check('answer echoed', /number/.test(allText()));
}

console.log('\n=== reset ===');
const aborts = calls.abort;
submit('reset');
check('abort called', calls.abort > aborts);
check('confirms restart', /fresh one starts/.test(allText()));

console.log('\n=== connect ===');
submit('connect');
check('connect usage', /usage: connect/.test(allText()));
submit('connect acme/sandbox');
await new Promise((r) => setImmediate(r));
await new Promise((r) => setImmediate(r));
check('sandbox link called', linkCalls[0] === 'acme/sandbox', JSON.stringify(linkCalls));
check('reports the link', /linked demo\/sandbox@main — 1 demo/.test(allText()));
check('surfaces a skipped file', /one file skipped/.test(allText()));
check('idle after connect', stateEl.textContent === 'IDLE', stateEl.textContent);
submit('link');
check('link shows the manifest', /cdn\.jsdelivr\.net\/gh\/demo\/sandbox@main\/sandbox\.json/.test(allText()));
submit('disconnect');
check('disconnect confirms', /unlinked demo\/sandbox@main/.test(allText()));
submit('link');
check('link reports built-ins after disconnect', /built-in demos only/.test(allText()));

console.log('\n=== ctrl+l clears ===');
submit('about');
check('about printed', /isolated worker/.test(allText()));
key('l', { ctrlKey: true });
check('screen cleared', outEl.children.length === 0, String(outEl.children.length));

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
