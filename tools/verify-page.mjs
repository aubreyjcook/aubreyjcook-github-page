/* Verifies the generated student-work page: repo links, placeholders, structure. */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const rel = 'pages/student-work.html';
const html = readFileSync(join(root, rel), 'utf8');

let fail = 0;
const check = (n, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (!c && x ? ' -> ' + x : '')); if (!c) fail++; };

console.log('=== ' + rel + ' ===');

const links = [...html.matchAll(/https:\/\/github\.com\/aubreyjcook\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]);
const uniq = [...new Set(links)];
console.log('  repo links: ' + links.length + '  unique: ' + uniq.length);
for (const u of uniq) console.log('    ' + u);

check('no unreplaced placeholders', !/<!--[A-Z_0-9]+-->/.test(html));
check('every repo link is a non-empty slug', uniq.every((u) => u.length > 1));
check('no whitespace inside a repo slug', !/github\.com\/aubreyjcook\/[^"']*\s/.test(html));
check('all links open in a new tab safely', (html.match(/target="_blank"/g) || []).length === (html.match(/rel="noopener noreferrer"/g) || []).length);

/* structural sanity */
const opens = (html.match(/<section\b/g) || []).length;
const closes = (html.match(/<\/section>/g) || []).length;
check('section tags balanced (' + opens + ')', opens === closes);
const ulO = (html.match(/<ul\b/g) || []).length, ulC = (html.match(/<\/ul>/g) || []).length;
check('ul tags balanced (' + ulO + ')', ulO === ulC);
const divO = (html.match(/<div\b/g) || []).length, divC = (html.match(/<\/div>/g) || []).length;
check('div tags balanced (' + divO + ')', divO === divC);
const liO = (html.match(/<li\b/g) || []).length, liC = (html.match(/<\/li>/g) || []).length;
check('li tags balanced (' + liO + ')', liO === liC);
const h3O = (html.match(/<h3\b/g) || []).length, h3C = (html.match(/<\/h3>/g) || []).length;
check('h3 tags balanced (' + h3O + ')', h3O === h3C);
const aO = (html.match(/<a\b/g) || []).length, aC = (html.match(/<\/a>/g) || []).length;
check('a tags balanced (' + aO + ')', aO === aC);
const trO = (html.match(/<tr\b/g) || []).length, trC = (html.match(/<\/tr>/g) || []).length;
check('tr tags balanced (' + trO + ')', trO === trC);
const tdO = (html.match(/<td\b/g) || []).length, tdC = (html.match(/<\/td>/g) || []).length;
check('td tags balanced (' + tdO + ')', tdO === tdC);

/* entities */
const NAMED = new Set(['amp','lt','gt','quot','apos','nbsp','mdash','ndash','hellip','copy','reg','trade','larr','rarr','times','middot','bull','deg','laquo','raquo','ldquo','rdquo','lsquo','rsquo','sect','para','eacute','euro','pound','yen','cent','frac12']);
const bad = new Set();
for (const m of html.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) if (!NAMED.has(m[1].toLowerCase())) bad.add(m[1]);
check('no unknown named entities', bad.size === 0, [...bad].join(','));

/* local asset targets */
let missing = [];
for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const r = m[1];
  if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(r)) continue;
  const clean = r.split('#')[0].split('?')[0];
  if (!clean) continue;
  if (!existsSync(resolve(dirname(join(root, rel)), clean))) missing.push(r);
}
check('local asset targets resolve', missing.length === 0, missing.join(', '));

console.log('\n' + (fail ? fail + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exitCode = fail ? 1 : 0;
