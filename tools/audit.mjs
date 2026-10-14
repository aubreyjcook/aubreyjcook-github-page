/* Full-site audit: internal links, duplicate ids, chrome injection on every page.
   Run from the deploy directory:  node tools/audit.mjs                          */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* ---------- collect pages ---------- */
const pages = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'archive' || e.name === '.git' || e.name === 'tools') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.html?$/i.test(e.name) && !e.name.endsWith('.template.html')) pages.push(p);
  }
})(root);

/* ---------- 1. link + id audit ---------- */
let broken = 0, dupIds = 0, checked = 0;
const brokenByPage = new Map();

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const rel = relative(root, page);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dupes.length) { dupIds++; console.log('DUPLICATE IDS  ' + rel + '  -> ' + dupes.join(', ')); }

  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const r = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(r)) continue;
    const clean = r.split('#')[0].split('?')[0];
    if (!clean) continue;
    checked++;
    if (!existsSync(resolve(dirname(page), clean))) {
      broken++;
      if (!brokenByPage.has(rel)) brokenByPage.set(rel, new Set());
      brokenByPage.get(rel).add(r);
    }
  }
}

console.log('pages: ' + pages.length + '   internal refs: ' + checked + '   broken: ' + broken + '   pages with dup ids: ' + dupIds);

/* group the breakage so it is actionable rather than a wall of paths */
const groups = new Map();
for (const [page, refs] of brokenByPage) {
  for (const r of refs) {
    let key;
    if (/images\/favicon\//.test(r)) key = 'missing favicon set (PRG-147 exercise pages)';
    else if (/^\.\.\/(experience|education|resume|portfolio|index)\.html$/.test(r)) key = 'nav paths pointing one level too high';
    else if (/^\.\.\/images\//.test(r)) key = 'other missing ../images asset';
    else if (page.startsWith('pages/templates/')) key = 'templates/ relative paths off by one level';
    else key = 'OTHER: ' + r;
    if (!groups.has(key)) groups.set(key, { count: 0, pages: new Set() });
    const g = groups.get(key);
    g.count++; g.pages.add(page);
  }
}
if (groups.size) {
  console.log('\nbroken refs grouped by cause:');
  for (const [k, v] of [...groups.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log('  ' + String(v.count).padStart(4) + '  ' + k + '  (' + v.pages.size + ' page(s))');
  }
} else {
  console.log('\nno broken internal refs');
}

/* ---------- 2. chrome injection on the modern pages ---------- */
const MODERN = pages.filter((p) => {
  const h = readFileSync(p, 'utf8');
  return /styles\/site\.css/.test(h) && /js\/site\.js/.test(h);
});

const VOID = new Set(['meta','link','br','hr','img','input','source','path','area','base','col','embed','param','track','wbr']);
function El(tag) {
  const n = {
    tagName: String(tag || 'DIV').toUpperCase(), children: [], attributes: {}, style: {}, hidden: false,
    placeholder: '', type: '', value: '', parentNode: null, _text: '',
    get className() { return this.attributes.class || ''; },
    set className(v) { this.attributes.class = v; },
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
    set textContent(v) { this.children = []; this._text = String(v); },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, r) { c.parentNode = this; const i = r ? this.children.indexOf(r) : -1; if (i === -1) this.children.push(c); else this.children.splice(i, 0, c); return c; },
    addEventListener() {}, focus() {},
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
const findAll = (root, sel) => { const h = []; walk(root, (n) => { if (matches(n, sel)) h.push(n); }); return h; };
function parse(s) {
  const root = El('html'); const stack = [root];
  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(s))) {
    const [full, close, open, attrStr, self, run] = m;
    if (full.startsWith('<!')) continue;
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    if (open) {
      const node = El(open);
      const ar = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a; while ((a = ar.exec(attrStr || ''))) node.attributes[a[1].toLowerCase()] = a[3] ?? a[4] ?? a[5] ?? '';
      stack[stack.length - 1].appendChild(node);
      if (!self && !VOID.has(open.toLowerCase())) stack.push(node);
      continue;
    }
    if (run && run.trim()) stack[stack.length - 1].appendChild(txt(run.replace(/\s+/g, ' ')));
  }
  return root;
}

const siteJs = readFileSync(join(root, 'js', 'site.js'), 'utf8');
let chromeFail = 0;
const statuses = new Set();
for (const p of MODERN) {
  const html = readFileSync(p, 'utf8');
  const parsed = parse(html);
  const body = find(parsed, 'body');
  const rel = relative(root, p);
  const doc = {
    title: rel, documentElement: parsed, body,
    createElement: (t) => El(t), createTextNode: (t) => txt(t),
    getElementById: (id) => find(body, '#' + id),
    querySelector: (s) => find(body, s), querySelectorAll: (s) => findAll(body, s),
    addEventListener() {},
  };
  /* Simulate the real deployed URL. relative() yields backslashes on Windows,
     so normalise before stripping the pages/ prefix. */
  const relUrl = rel.split('\\').join('/');
  const urlPath = relUrl === 'index.html' ? '/index.html' : '/' + relUrl.replace(/^pages\//, '');
  const sb = { document: doc, console, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
  sb.window = { location: { pathname: urlPath }, matchMedia: () => ({ matches: false }), document: doc, setTimeout: sb.setTimeout, setInterval: sb.setInterval };
  try {
    vm.runInNewContext(siteJs, sb, { filename: 'site.js' });
    const strip = find(body, '.term-console');
    const out = strip && find(strip, '.term-console__out');
    if (!strip) { console.log('NO STRIP  ' + rel); chromeFail++; }
    else statuses.add(out.textContent.split('  \u00b7  ')[0]);
    if (!find(body, '.term-legend')) { console.log('NO LEGEND  ' + rel); chromeFail++; }
  } catch (e) {
    console.log('THREW  ' + rel + '  ' + e.message); chromeFail++;
  }
}
console.log('\nchrome injection: ' + MODERN.length + ' modern pages, ' + chromeFail + ' failures');
console.log('distinct status paths: ' + [...statuses].sort().join(' | '));

const totalFail = broken + dupIds + chromeFail;
console.log('\n' + (totalFail ? totalFail + ' issue(s) above' : 'CLEAN'));
process.exitCode = 0;
