/* ---------------------------------------------------------------------------
   build-student-work.mjs
   Generates pages/student-work.html from the course data below.

   Run from the deploy directory:
       node tools/build-student-work.mjs

   Why a generator: the course tables are long and repetitive, and hand-editing
   three copies of the same card markup is how typos and dead links get in.
   Edit REPO data, re-run, commit the generated HTML.
   --------------------------------------------------------------------------- */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = join(root, 'pages', 'student-work.html');

const GH = 'https://github.com/aubreyjcook/';

/* --- data ------------------------------------------------------------------ */

const COURSES = [
  ['Spring 2016', 'PRG 105', 'Programming fundamentals via Processing', 'Processing / Java', '1'],
  ['Spring 2016', 'PRG 110', 'Programming fundamentals in C++', 'C++', '1'],
  ['Spring 2016', 'WEB 105', 'Intro to web development, HTML/CSS and WordPress', 'HTML', '1'],
  ['Summer 2016', 'WEB 115', 'Advanced front-end web development', 'HTML / CSS', '9'],
  ['2016', 'PRG 147', 'JavaScript, start to jQuery UI', 'JavaScript', '18 exercises'],
  ['Spring 2018', 'CSC 275', 'Object-oriented programming and data structures', 'Java', '15'],
  ['Spring 2020', 'CSC 453', 'Server-side web programming', 'PHP', '2'],
];

const FUNDAMENTALS = [
  ['prg105', 'Processing class (Java), spring 2016. Creative-coding exercises: drawing, animation, and interaction in a visual sketch environment.', 'Processing &middot; Java &middot; 2016'],
  ['prg110', 'C++ class, spring 2016. Compiled-language fundamentals: types, arrays, functions, and the beginnings of object orientation.', 'C++ &middot; 2016'],
];

const WEB_COURSES = [
  ['web105', 'Intro to web development &mdash; HTML, CSS, and WordPress, spring 2016.', 'HTML &middot; 2016'],
  ['web115', 'Advanced front-end web development &mdash; HTML and CSS, summer 2016.', 'HTML &middot; 2016'],
];

const FRONTEND = [
  ['semantic', 'Semantic markup exercise &mdash; choosing elements for meaning rather than appearance.', 'HTML &middot; 2016'],
  ['photoGallery', 'Photo gallery layout.', 'HTML &middot; 2016'],
  ['CSSMenu', 'Pure-CSS drop-down menu project.', 'CSS &middot; 2016'],
  ['JavaScriptLab', 'JavaScript laboratory work &mdash; scripting behaviour onto static pages.', 'JavaScript &middot; 2016'],
];

const SERVERSIDE = [
  ['PHPLab', 'PHP laboratory exercises.', 'PHP &middot; 2016'],
  ['ProductShowcase', 'Product showcase built with PHP.', 'PHP &middot; 2016'],
];

const CSC275_LABS = [
  ['-CSC275-ACookLab04StudentArrayList', 'Lab 04 &mdash; Student ArrayList'],
  ['-CSC275-ACookLab05', 'Lab 05'],
  ['-CSC275-ACookLab06', 'Lab 06'],
  ['-CSC275-Lab07', 'Lab 07'],
  ['-CSC275-Lab08', 'Lab 08'],
  ['-CSC275-Lab09', 'Lab 09'],
  ['-CSC275-Lab10', 'Lab 10'],
  ['-CSC275-Lab11', 'Lab 11'],
];

const CSC275_EXAMS = [
  ['-CSC275-ACookAssignment03', 'Assignment 03'],
  ['-CSC275-Assignment04', 'Assignment 04'],
  ['-CSC275-Assignment05', 'Assignment 05'],
  ['-CSC275-Midterm', 'Midterm'],
  ['-CSC275-Final', 'Final'],
];

const CSC453 = [
  ['-CSC453-Assignment03', 'CSC 453 &mdash; Assignment 03'],
  ['-CSC453-Assignment04', 'CSC 453 &mdash; Assignment 04'],
];

/* --- helpers --------------------------------------------------------------- */

const esc = (s) => s.replace(/&(?!(amp|mdash|middot|nbsp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/g, '&amp;');

const ext = (slug, label, cls) =>
  `<a href="${GH}${slug}" target="_blank" rel="noopener noreferrer"${cls ? ` class="${cls}"` : ''}>${label}</a>`;

/* card with a description */
const card = ([slug, blurb, meta]) => `        <article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-cyan-500/40">
          <h3 class="text-base font-semibold text-slate-100">${ext(slug, slug, 'hover:text-cyan-400')}</h3>
          <p class="mt-2 text-sm leading-relaxed text-slate-400">${blurb}</p>
          <p class="mt-3 text-xs text-slate-500">${meta}</p>
        </article>`;

/* row in a directory-style list */
const row = ([slug, blurb, meta]) => `        <li>
          <a href="${GH}${slug}" target="_blank" rel="noopener noreferrer" class="block px-5 py-4 transition hover:bg-zinc-900">
            <span class="font-semibold text-slate-100">${slug}</span>
            <span class="mt-1 block text-sm text-slate-400">${blurb}</span>
            <span class="mt-1 block text-xs text-slate-500">${meta}</span>
          </a>
        </li>`;

/* compact chip used for the numbered CSC exercises */
const chip = ([slug, label]) =>
  `        <li><a class="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500/40" href="${GH}${slug}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;

const courseRows = COURSES.map(([term, code, subject, lang, count]) => `            <tr>
              <td class="px-4 py-3 whitespace-nowrap text-slate-500">${term}</td>
              <td class="px-4 py-3 font-semibold text-slate-100">${code}</td>
              <td class="px-4 py-3">${subject}</td>
              <td class="px-4 py-3 text-slate-400">${lang}</td>
              <td class="px-4 py-3 text-slate-400">${count}</td>
            </tr>`).join('\n');

/* --- page ------------------------------------------------------------------ */

const page = readFileSync(join(here, 'student-work.template.html'), 'utf8')
  .replace('<!--COURSE_ROWS-->', courseRows)
  .replace('<!--FUNDAMENTALS-->', FUNDAMENTALS.map(card).join('\n'))
  .replace('<!--WEB_COURSES-->', WEB_COURSES.map(card).join('\n'))
  .replace('<!--FRONTEND-->', FRONTEND.map(row).join('\n'))
  .replace('<!--SERVERSIDE-->', SERVERSIDE.map(row).join('\n'))
  .replace('<!--CSC275_LABS-->', CSC275_LABS.map(chip).join('\n'))
  .replace('<!--CSC275_EXAMS-->', CSC275_EXAMS.map(chip).join('\n'))
  .replace('<!--CSC453-->', CSC453.map(chip).join('\n'));

if (/<!--[A-Z_0-9]+-->/.test(page)) {
  console.error('unreplaced placeholder remains: ' + page.match(/<!--[A-Z_0-9]+-->/)[0]);
  process.exit(1);
}

writeFileSync(OUT, page, 'utf8');

const repos = [].concat(FUNDAMENTALS, WEB_COURSES, FRONTEND, SERVERSIDE, CSC275_LABS, CSC275_EXAMS, CSC453).length;
console.log('wrote ' + OUT);
console.log('  courses: ' + COURSES.length + '   repositories linked: ' + repos);
