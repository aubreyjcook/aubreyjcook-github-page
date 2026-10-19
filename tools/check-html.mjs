/* Generic HTML page checker.
   Usage (from deploy/):
     node tools/check-html.mjs                       # defaults to the generated student-work page
     node tools/check-html.mjs pages/quotes.html ...  # any pages

   Checks, per page: tag balance, id uniqueness, entity validity, local
   asset/href targets, skip link, main landmark, and the shared chrome. */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const files = args.length ? args : ['pages/student-work.html'];

const NAMED = new Set(['amp','lt','gt','quot','apos','nbsp','mdash','ndash','hellip','copy','reg','trade',
  'larr','rarr','uarr','darr','times','middot','bull','deg','laquo','raquo','ldquo','rdquo','lsquo',
  'rsquo','sect','para','eacute','euro','pound','yen','cent','frac12']);

/* elements whose open/close counts must match */
const PAIRED = ['html','head','body','header','nav','main','section','article','div','ul','ol','li',
  'table','thead','tbody','tr','th','td','h1','h2','h3','p','a','span','footer','figure','blockquote'];

let fail = 0;
const check = (page, name, cond, extra) => {
  if (!cond) fail++;
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (!cond && extra ? ' -> ' + extra : ''));
};

for (const rel of files) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) { console.log('=== ' + rel + ' ===\n  FAIL  file not found'); fail++; continue; }
  const html = readFileSync(abs, 'utf8');
  const base = dirname(abs);
  console.log('=== ' + rel.split('\\').join('/') + ' ===');

  /* tag balance */
  const unbalanced = [];
  for (const tag of PAIRED) {
    const open = (html.match(new RegExp('<' + tag + '(?=[\\s>/])', 'gi')) || []).length;
    const close = (html.match(new RegExp('</' + tag + '>', 'gi')) || []).length;
    if (open !== close) unbalanced.push(tag + ' ' + open + '/' + close);
  }
  check(rel, 'tags balanced', unbalanced.length === 0, unbalanced.join(', '));

  /* ids */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  check(rel, 'ids unique (' + ids.length + ')', dupes.length === 0, dupes.join(','));

  /* entities */
  const unknown = new Set();
  for (const m of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) if (!NAMED.has(m[1].toLowerCase())) unknown.add(m[1]);
  const bare = (html.match(/&(?![a-zA-Z#])/g) || []).length;
  check(rel, 'entities valid', unknown.size === 0 && bare === 0,
    (unknown.size ? 'unknown: ' + [...unknown].join(',') : '') + (bare ? ' bare-amp: ' + bare : ''));

  /* local targets */
  const missing = [];
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const r = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(r)) continue;
    const clean = r.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (!existsSync(resolve(base, clean))) missing.push(r);
  }
  check(rel, 'local targets resolve', missing.length === 0, missing.join(', '));

  /* in-page anchors */
  const targets = new Set(ids);
  const deadAnchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).filter((a) => !targets.has(a));
  check(rel, 'in-page anchors resolve', deadAnchors.length === 0, [...new Set(deadAnchors)].join(','));

  /* accessibility landmarks present on the site's real pages */
  const usesChrome = /styles\/site\.css/.test(html);
  if (usesChrome) {
    check(rel, 'has skip link', /class="sr-only/.test(html));
    check(rel, 'has main#main-content', /<main id="main-content"/.test(html));
    check(rel, 'has primary nav', /aria-label="Primary"/.test(html));
    check(rel, 'has h1', /<h1[\s>]/.test(html));
  }
}

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
