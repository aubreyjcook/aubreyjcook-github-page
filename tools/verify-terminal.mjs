/* Proves machineLine() output for the site's real live URL shapes, and re-checks
   the reduced-motion path (the caret bug fixed earlier).
   Run from deploy/:  node tools/verify-terminal.mjs                            */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'js', 'site.js'), 'utf8');

/* --- minimal DOM (own text + element children, like a browser) ------------- */
function El(tag) {
  const n = {
    tagName: String(tag || 'DIV').toUpperCase(), children: [], attributes: {}, style: {}, _text: '', parentNode: null, hidden: false,
    get className() { return this.attributes.class || ''; },
    set className(v) { this.attributes.class = v; },
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
    set textContent(v) { this.children = []; this._text = String(v); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, r) { c.parentNode = this; const i = r ? this.children.indexOf(r) : -1; if (i === -1) this.children.push(c); else this.children.splice(i, 0, c); return c; },
    addEventListener(t, f) { (this._listeners ||= {})[t] = f; },
    focus() {},
    get firstElementChild() { return this.children.find((c) => c.tagName !== '#TEXT') || null; },
    cloneNode(d) { const c = El(this.tagName); c._text = this._text; c.attributes = { ...this.attributes }; if (d) c.children = this.children.map((k) => k.cloneNode(true)); return c; },
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
const txt = (t) => { const n = El('#text'); n._text = t; return n; };
const walk = (r, fn) => (r.children || []).forEach((k) => { fn(k); walk(k, fn); });
const simple = (node, sel) => {
  const m = sel.match(/^([a-zA-Z0-9]+)?((?:[.#][\w-]+|\[[^\]]+\])*)$/);
  if (!m) return false;
  if (m[1] && node.tagName !== m[1].toUpperCase()) return false;
  for (const t of (m[2] || '').match(/[.#][\w-]+|\[[^\]]+\]/g) || []) {
    if (t[0] === '.') { if (!node.classList.contains(t.slice(1))) return false; }
    else if (t[0] === '#') { if (node.attributes.id !== t.slice(1)) return false; }
    else if (!(t.slice(1, -1) in node.attributes)) return false;
  }
  return true;
};
function matches(node, sel) {
  const chain = sel.trim().split(/\s+/).reverse();
  if (!simple(node, chain[0])) return false;
  const anc = []; for (let c = node.parentNode; c; c = c.parentNode) anc.push(c);
  let pool = anc;
  for (let i = 1; i < chain.length; i++) { const at = pool.findIndex((n) => simple(n, chain[i])); if (at === -1) return false; pool = pool.slice(at + 1); }
  return true;
}
const find = (root, sel) => { let hit = null; walk(root, (n) => { if (!hit && matches(n, sel)) hit = n; }); return hit; };

let fail = 0;
const check = (n, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (!c && x ? ' -> ' + x : '')); if (!c) fail++; };

/* --- 1. status line for real URL shapes ----------------------------------- */
console.log('=== status path per live URL ===');
const CASES = [
  ['/', 'C:\\AUBREY\\HOME'],
  ['/index.html', 'C:\\AUBREY\\HOME'],
  ['/pages/about.html', 'C:\\AUBREY\\HOME\\ABOUT'],
  ['/pages/student-work.html', 'C:\\AUBREY\\HOME\\STUDENT-WORK'],
  ['/pages/resume.html', 'C:\\AUBREY\\HOME\\RESUME'],
  ['/pages/portfolio.html', 'C:\\AUBREY\\HOME\\PORTFOLIO'],
  ['/pages/portfolio/portfolio.html', 'C:\\AUBREY\\HOME\\PORTFOLIO\\PORTFOLIO'],
  ['/pages/portfolio/personal/school/school.html', 'C:\\AUBREY\\HOME\\PORTFOLIO\\PERSONAL\\SCHOOL\\SCHOOL'],
  ['/pages/portfolio/personal/school/-prg147-/index.html', 'C:\\AUBREY\\HOME\\PORTFOLIO\\PERSONAL\\SCHOOL\\-PRG147-'],
  // GitHub Pages project site: the repo name is a leading segment
  ['/aubreyjcook-github-page/pages/student-work.html', 'C:\\AUBREY\\HOME\\STUDENT-WORK'],
];

function runAt(pathname, reduced) {
  const body = El('body');
  body.className = 'bg-zinc-950';
  const h1 = El('h1'); h1.textContent = 'Web programming and software engineering';
  const main = El('main'); main.setAttribute('id', 'main-content'); main.appendChild(h1); body.appendChild(main);
  const footer = El('footer'); const fi = El('div'); fi.appendChild(El('p')); footer.appendChild(fi); body.appendChild(footer);
  const host = El('div'); host.setAttribute('data-boot', ''); body.appendChild(host);
  const doc = {
    title: 't', documentElement: El('html'), body,
    createElement: (t) => El(t), createTextNode: (t) => txt(t),
    getElementById: () => null,
    querySelector: (s) => find(body, s),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const sb = { document: doc, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
  sb.window = { location: { pathname }, matchMedia: () => ({ matches: reduced }), document: doc, setTimeout: sb.setTimeout, setInterval: sb.setInterval };
  vm.runInNewContext(src, sb, { filename: 'site.js' });
  return { doc, body, h1, host, footer };
}

for (const [pathname, expected] of CASES) {
  const { body } = runAt(pathname, false);
  const out = find(body, '.term-console__out');
  const got = out.textContent.split('  \u00b7  ')[0];
  check(pathname + '  ->  ' + got, got === expected, 'expected ' + expected);
}

/* --- 2. reduced motion regression ---------------------------------------- */
console.log('\n=== reduced motion ===');
const r = runAt('/pages/student-work.html', true);
const boot = find(r.host, '.term-boot');
check('boot marked data-done', !!boot && boot.attributes['data-done'] === '');
check('no animation opted in', !!boot && !('data-animate' in boot.attributes));
check('h1 text preserved', r.h1.textContent === 'Web programming and software engineering', JSON.stringify(r.h1.textContent));
check('caret still present', !!find(r.h1, '.term-caret'));

/* --- 3. animated typing still reconstructs the heading ------------------- */
console.log('\n=== typed heading ===');
let timers = [];
(function () { /* timers captured below via closure */ })();
const body = El('body'); body.className = 'bg-zinc-950';
const h1b = El('h1'); h1b.textContent = 'Web programming and software engineering';
const main = El('main'); main.setAttribute('id', 'main-content'); main.appendChild(h1b); body.appendChild(main);
const doc = {
  title: 't', documentElement: El('html'), body,
  createElement: (t) => El(t), createTextNode: (t) => txt(t),
  getElementById: () => null, querySelector: (s) => find(body, s), querySelectorAll: () => [], addEventListener() {},
};
let NOW = 0;
const sb = {
  document: doc, console,
  setTimeout(fn, ms) { const id = ++NOW; timers.push({ id, at: NOW + (ms || 0), fn }); return id; },
  clearTimeout() {}, setInterval: () => 0, clearInterval() {},
};
sb.window = { location: { pathname: '/index.html' }, matchMedia: () => ({ matches: false }), document: doc, setTimeout: sb.setTimeout, setInterval: sb.setInterval };
vm.runInNewContext(src, sb, { filename: 'site.js' });
let guard = 0;
while (timers.length && guard++ < 500) { timers.sort((a, b) => a.at - b.at); const t = timers.shift(); NOW = t.at; t.fn(); }
const live = find(h1b, '.term-type');
check('typed text matches original', !!live && live.textContent === 'Web programming and software engineering', live && JSON.stringify(live.textContent));

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
