/* Reports which pages load which shared assets, so intent is visible. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['archive', '.git', 'tools'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.html?$/i.test(e.name) && !e.name.endsWith('.template.html')) pages.push(p);
  }
})(root);

const rows = [];
for (const p of pages) {
  const h = readFileSync(p, 'utf8');
  rows.push([
    relative(root, p).split('\\').join('/'),
    /styles\/site\.css/.test(h) ? 'css' : '-',
    /js\/tailwind-config\.js/.test(h) ? 'tw' : '-',
    /js\/site\.js/.test(h) ? 'site.js' : '-',
    /bg-zinc-950/.test(h) ? 'body' : '-',
  ]);
}
const w = (s, n) => String(s).padEnd(n);
console.log(w('page', 62) + w('site.css', 10) + w('twcfg', 7) + w('site.js', 9) + 'body');
console.log('-'.repeat(95));
for (const r of rows) console.log(w(r[0], 62) + w(r[1], 10) + w(r[2], 7) + w(r[3], 9) + r[4]);
