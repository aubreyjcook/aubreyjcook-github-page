# THE PSEUDO-TERMINAL — a working guide

> This file is documentation for future-you. It is **not** part of the website:
> nothing links to it, and GitHub Pages will not render it as a page (no `.html`
> extension, and it sits outside the navigation). Read it here in the repo.

Everything described below lives in three files, all of which are shared by every
page on the site:

| File | Role |
| --- | --- |
| `js/site.js` | Injects the terminal chrome and implements the command line. |
| `styles/site.css` | All terminal styling and the colour tokens. |
| `js/tailwind-config.js` | Font stacks only. |

There is no build step for the site itself and no dependencies. The pages load
Tailwind from its CDN, then `styles/site.css` deliberately *overrides* Tailwind's
utility classes so the whole site reads as one vintage machine.

`tools/` holds optional Node scripts — they are never shipped to the browser and
the site does not depend on them:

| Script | Purpose |
| --- | --- |
| `tools/build-student-work.mjs` | Generates `pages/student-work.html` from `tools/student-work.template.html` plus the course data at the top of the script. |
| `tools/verify-page.mjs` | Checks the generated page: tag balance, entities, placeholders, local targets. |
| `tools/verify-terminal.mjs` | Runs the real `js/site.js` against a DOM stub; asserts the status path for every real URL shape, the reduced-motion path, and the typed heading. |
| `tools/audit.mjs` | Whole-site sweep: broken internal links grouped by cause, duplicate ids, and chrome injection on every modern page. |

```sh
# from the deploy directory
node tools/build-student-work.mjs   # regenerate the student-work page
node tools/verify-terminal.mjs      # terminal behaviour
node tools/audit.mjs                # whole-site link + chrome report
```

---

## 1. What the terminal actually is

It is **one SVG-free, dependency-free DOM widget**, not a real shell. It is a
fixed strip pinned to the bottom of the viewport that looks and behaves like a
single-line terminal status bar, plus a tiny command interpreter that answers
from a hard-coded table.

```
+-- the strip --------------------------------------------------------------+
|  C:\>   C:\AUBREY\HOME · ready · press ? for commands     ? 640K OK  * 14:32:07 |
+---------------------------------------------------------------------------+
  ^       ^                                                 ^      ^     ^
  |       |                                                 |      |     live clock
  |       |                                                 |      blinking "DSK" LED
  |       |                                                 readout group
  |       the output area (a <button> until you click it)
  the prompt (a <button>)
```

Eleven terms you will see in the code:

| Term | Meaning |
| --- | --- |
| **strip** | `.term-console`, the fixed bar itself. |
| **prompt** | `.term-console__prompt`, the `C:\>` button. |
| **output** | `.term-console__out`, the button that shows the current text. |
| **input** | A real `<input>` that is `hidden` until the prompt is opened. |
| **meta** | `.term-console__meta`, the 640K / LED / clock cluster. |
| **boot** | The six-line boot sequence on the home page. |
| **banner** | The ASCII `AUBREY / J COOK` wordmark on the home page. |
| **ghost** | A hidden clone of the `<h1>` used as a layout spacer. |
| **legend** | The `<kbd>` hint row appended to the footer. |
| **reverse video** | Light text on a blue fill — how errors are highlighted. |
| **`--term-*`** | The CSS custom properties holding the palette. |

---

## 2. How it works

### 2.1 Two states, one element

The output area and the input area are never visible at the same time. The
`hidden` attribute is the switch:

```js
var closeConsole = function () {
  input.hidden = true;      // input goes away
  out.hidden = false;       // status text comes back
  input.value = '';
};

var openConsole = function () {
  out.hidden = true;
  input.hidden = false;
  input.focus();            // ready to type immediately
};
```

That's the whole "terminal" illusion: when idle it shows a status readout, and
clicking it swaps in a text field with a blinking caret.

### 2.2 Discovery

Three ways in, so nobody has to guess:

1. Click the `C:\>` prompt or the status text.
2. Press <kbd>/</kbd> or <kbd>?</kbd> anywhere on the page.
3. Read the footer legend, which is injected automatically.

The global shortcut is guarded so it never steals a keystroke from a real form
field:

```js
var typing =
  target &&
  (target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable);

if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
```

### 2.3 The command loop

Input arrives on `keydown`, not `input` — this is a line-oriented shell, so
nothing happens until you press <kbd>Enter</kbd>:

```js
input.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    run(input.value);
  } else if (event.key === 'Escape') {
    closeConsole();
  }
});
```

`run()` lowercases the first word, looks it up in the `COMMANDS` table, and falls
back to a period-correct error:

```js
var name = raw.trim().toLowerCase().split(/\s+/)[0];

var handler = Object.prototype.hasOwnProperty.call(COMMANDS, name)
  ? COMMANDS[name]
  : null;

if (handler) {
  say(handler(), name === 'help' || name === '?' ? 'ok' : '');
} else {
  say("bad command or file name: '" + raw.trim() + "' \u2014 try help", 'warn');
}
closeConsole();
```

`Object.prototype.hasOwnProperty.call` rather than `COMMANDS[name]` matters: it
means typing `constructor` or `toString` gets the "bad command" message instead
of accidentally executing something inherited from `Object.prototype`.

### 2.4 Output states

`say()` writes the text and stamps a `data-state` attribute, and CSS does the
rest:

```js
var say = function (text, state) {
  out.textContent = text;
  out.setAttribute('data-state', state || '');
};
```

| `data-state` | Look | Used for |
| --- | --- | --- |
| *(empty)* | dim blue-grey | normal readouts (`whoami`, `dir`, …) |
| `ok` | bright ice blue | `help` output |
| `warn` | **reverse video** (light on blue fill) | unrecognised commands |

Reverse video is doing the job the old amber text used to do. It is the correct
period solution anyway — mono CRT software had no second colour to spend, so
alarms were shown inverted. The selector is placed *before* `:hover` in the
stylesheet and paired with a `[data-state="warn"]:hover` rule, because otherwise
hovering would silently wash the highlight out.

### 2.5 The live readouts

The clock is the only genuinely live element:

```js
var refreshStatus = function () {
  var d = new Date();
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  clock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

refreshStatus();
window.setInterval(refreshStatus, 1000);
```

`640K OK` and the `DSK` LED are decorative. There is no timer to clear on
`pagehide` because the strip only ever exists as long as the page does.

The **status text is generated, not hard-coded** — it derives a DOS-style path
from the URL:

```js
function machineLine() {
  var parts = window.location.pathname.split('/').filter(Boolean);
  var file = parts.length ? parts[parts.length - 1] : '';
  var dirs = parts.slice(0, -1);
  var at = dirs.indexOf('pages');
  if (at !== -1) dirs = dirs.slice(at + 1);   // drop the site-layout segment

  var readable = file.replace(/\.html?$/i, '');
  if (readable && readable !== 'index') dirs = dirs.concat([readable]);

  var line = 'C:\\AUBREY\\HOME';
  for (var i = 0; i < dirs.length; i++) line += '\\' + dirs[i].toUpperCase();
  return line;
}
```

Directory indexes collapse to their folder and named pages append the filename,
so the readout stays short whatever the depth:

| URL | Status path |
| --- | --- |
| `/index.html` | `C:\AUBREY\HOME` |
| `/pages/about.html` | `C:\AUBREY\HOME\ABOUT` |
| `/pages/portfolio.html` | `C:\AUBREY\HOME\PORTFOLIO` |
| `/pages/portfolio/portfolio.html` | `C:\AUBREY\HOME\PORTFOLIO\PORTFOLIO` |
| `/pages/portfolio/personal/school/school.html` | `C:\AUBREY\HOME\PORTFOLIO\PERSONAL\SCHOOL\SCHOOL` |
| `/pages/portfolio/personal/school/-prg147-/index.html` | `C:\AUBREY\HOME\PORTFOLIO\PERSONAL\SCHOOL\-PRG147-` |

The `pages` segment is dropped because on GitHub Pages the site root is the repo
root, where `index.html` is the entry point and `pages/` is a layout folder, not
part of the address. If you ever move the site so that `pages/` becomes a real
URL segment, delete the `indexOf('pages')` line and the readout follows. All of
these cases are asserted in `tools/verify-terminal.mjs`.

### 2.6 The boot sequence and ASCII wordmark

Both are injected **only into a page that opts in** by containing
`<div data-boot></div>` — currently just `index.html`:

```js
var bootHost = document.querySelector('[data-boot]');
if (bootHost) { /* boot lines + banner */ }
```

The self-typing heading is a **separate block** that only looks for the heading,
so a page can take the typing effect without also taking the boot sequence:

```js
var h1 = document.querySelector('#main-content h1');
if (h1) { /* caret, ghost spacer, type-out */ }
```

Each boot line is a `<span>` with an increasing `animation-delay`, so one small
keyframe produces a staggered "machine waking up" effect:

```js
var BOOT_LINES = [
  'AUBREY-1 PERSONAL SYSTEM  \u00b7  ROM REV 1.06  \u00b7  (C) 1983-2025',
  '38911 BASIC BYTES FREE',
  'LOADING "AUBREY.COOK",8,1',
  'SEARCHING FOR AUBREY.COOK ... FOUND',
  'MOUNTING C:\\AUBREY\\HOME ... OK',
  'TYPE HELP AND PRESS RETURN'
];

BOOT_LINES.forEach(function (line, i) {
  var isLast = i === BOOT_LINES.length - 1;
  var row = el('span', 'term-boot-line' + (isLast ? ' term-boot-ok' : ''),
               (isLast ? '> ' : '\u00b7 ') + line);
  row.style.animationDelay = (i * 0.34).toFixed(2) + 's';
  boot.appendChild(row);
});
```

The line-hiding is opt-in from script, which is why the text survives with
JavaScript disabled:

```css
/* hidden only when JS has asked for the animation */
.term-boot[data-animate] .term-boot-line {
  opacity: 0;
  animation: term-boot-in 0.28s steps(2, end) forwards;
}
```

The wordmark is plain text in a `<pre>`, so it is copy-pasteable and costs
nothing:

```js
var pre = el('pre');
pre.setAttribute('aria-hidden', 'true');   // the figcaption carries the meaning
pre.textContent = [ /* 11 rows of '#' art: AUBREY over J COOK */ ].join('\n');
```

Its font size is fluid (`clamp(0.32rem, 1.42vw, 0.78rem)`) so the fixed-width art
scales down to fit a phone without wrapping or horizontal scroll.

### 2.7 The typing `<h1>` and why there is a "ghost"

On the home page the heading types itself out. The difficulty is reflow: while
the text is short the heading occupies fewer lines, so the page below it jumps
around. The fix is a hidden clone of the heading that permanently holds the final
height:

```js
var caret = el('i', 'term-caret');
caret.setAttribute('aria-hidden', 'true');

if (reduceMotion) {
  h1.appendChild(caret);          // static heading, static caret
} else {
  var full = h1.textContent.trim();   // read BEFORE clearing

  var ghost = h1.cloneNode(true);     // spacer
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.visibility = 'hidden';
  ghost.style.position = 'absolute';
  ghost.style.pointerEvents = 'none';

  var live = el('span', 'term-type');
  live.setAttribute('aria-hidden', 'true');

  h1.textContent = '';
  h1.appendChild(live);
  h1.appendChild(caret);
  h1.setAttribute('aria-label', full);              // accessible name
  h1.parentNode.insertBefore(ghost, h1.nextSibling);

  var i = 0;
  var step = function () {
    i += 1;
    live.textContent = full.slice(0, i);
    if (i < full.length) window.setTimeout(step, 42);
  };
  window.setTimeout(step, 620);
}
```

Three things here are easy to get wrong:

1. **`full` must be read before `h1.textContent = ''`.** Reading it afterwards
   gives you an empty string.
2. **The typed span is `aria-hidden` and the real text lives in `aria-label`.**
   Otherwise a screen reader would announce the heading one character at a time,
   and would also read the caret element.
3. **The caret is appended to the heading, not into the typed span**, so the
   blinking block sits after the last typed character.

Adding the caret mutates the heading's children, which is why the *ghost* is
cloned first — a clone taken afterwards would contain the caret too.

### 2.8 Layout reservation for the fixed strip

The strip is `position: fixed`, so it would overlap page content. The body only
gets bottom padding **once the strip exists in the DOM**:

```css
body.bg-zinc-950:has(.term-console) {
  padding-bottom: var(--term-strip-h);   /* 2.35rem */
}
```

`:has()` keeps this honest: with JavaScript disabled no strip is injected and no
padding is reserved, so there is no mystery gap at the bottom of the page.
`:has()` is supported in all current browsers; if you ever need to support
something older, the fallback is to add a class to `<body>` from `site.js`
instead — but then short pages get the gap even when scripting fails.

### 2.9 Reduced motion

Both the typing effect and the stagger are disabled together, and the boot text
is made immediately readable instead of being left invisible:

```js
var reduceMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

```js
if (reduceMotion) {
  boot.setAttribute('data-done', '');       // no animation, fully opaque
} else {
  boot.setAttribute('data-animate', '');
}
```

The frozen cursor block is also hidden rather than left blinking-less, because a
motionless block reads as a rendering glitch:

```css
@media (prefers-reduced-motion: reduce) {
  .term-caret { display: none; }
}
```

### 2.10 Graceful degradation

`site.js` also contains the pre-existing mobile **nav toggle**. The old version of
that handler was:

```js
var btn = document.getElementById('nav-toggle');
var panel = document.getElementById('mobile-nav');
if (!btn || !panel) return;      // <-- early return skipped everything after it
```

Everything new now sits *after* that guard and is written defensively, because
several legacy pages under `pages/templates/` and `pages/portfolio/` have no
`#main-content`, no `<footer>` and no nav:

```js
var footer = document.querySelector('footer');
var footerInner = footer && footer.firstElementChild;
if (footerInner) { /* inject legend */ }
```

Verified behaviour: on a page with none of those elements the strip is still
injected, the boot block is correctly skipped, and nothing throws.

---

## 3. The code, in full

### 3.1 `js/site.js` — the command table

This is the table you will edit most often. Each value is a function returning
the string to display.

```js
var HELP = 'commands: help  whoami  date  dir  ver  clear  exit';

var COMMANDS = {
  help: function () { return HELP; },
  '?':  function () { return HELP; },
  whoami: function () {
    return 'aubrey j cook \u00b7 programmer \u00b7 mchenry county, illinois';
  },
  date: function () { return new Date().toString(); },
  time: function () { return new Date().toTimeString(); },
  ver: function () {
    return 'AUBREY-DOS 1.06 \u00b7 640K RAM \u00b7 github pages volume';
  },
  dir: function () {
    var parts = window.location.pathname.split('/').filter(Boolean);
    var here = parts.length ? parts[parts.length - 1] : '.';
    return here + '  <DIR>  ' + document.title;
  },
  ls: function () { return COMMANDS.dir(); },
  pwd: function () { return machineLine(); },
  clear: function () { return statusText; },
  exit: function () { closeConsole(); return statusText; }
};
```

### 3.2 `js/site.js` — extension points

Everything below is a single, isolated place to change behaviour:

| Want to change | Edit |
| --- | --- |
| Available commands | the `COMMANDS` object, plus the `HELP` string |
| The `help` output | `HELP` |
| Boot text | `BOOT_LINES` |
| ASCII wordmark | the array joined with `'\n'` inside the `[data-boot]` block |
| Typing speed | the `42` (ms per character) and the `620` (ms lead-in) |
| Status line wording | `statusText` |
| Clock behaviour | `refreshStatus` |
| Which pages get the strip | all of them — it is injected unconditionally |
| Which pages get the boot/banner | add or remove `<div data-boot></div>` |
| Keyboard shortcuts | the `document.addEventListener('keydown', …)` block |
| 640K / DSK readouts | the `meta` block near the top of the strip section |

### 3.3 `styles/site.css` — the palette

All colour lives in `:root`. Nothing warm remains anywhere: every value below is
blue-dominant, and the only near-neutral is the near-black body colour.

```css
:root {
  /* tube */
  --term-bg: #04080f;          /* page background */
  --term-bg-raised: #081422;   /* panels / cards */
  --term-bg-bar: #0a1826;      /* header + status strip */
  --term-bg-sunken: #02050a;   /* footer, banner */

  /* phosphor ramp, darkest to brightest */
  --term-fg-faint: #6b8fab;    /* metadata, brackets, punctuation */
  --term-fg-dim: #7fa3bd;      /* secondary labels, nav, status text */
  --term-fg-body: #b4d2e6;     /* body copy */
  --term-fg: #d7ecfb;          /* headings, current page */

  /* accents */
  --term-accent: #8ad8ff;      /* links, emphasis, prompt output */
  --term-accent-soft: #a9e2ff; /* pressed state */
  --term-accent-deep: #3f9fd0; /* hover, borders */
  --term-accent-wash: #2a5f85; /* hover wash + error reverse video */
  --term-cmd: #5fb8e8;         /* command glyphs: $ > C:\> and the scrollbar */
  --term-led: #66e0ff;         /* disk-activity LED */
  --term-ink: #03070d;         /* text drawn on top of a lit accent fill */

  /* structure */
  --term-border: #16334d;
  --term-border-soft: #0f2537;
  --term-border-lit: #2f6d94;
  --term-glow: rgba(138, 216, 255, 0.22);
  --term-glow-strong: rgba(138, 216, 255, 0.5);
}
```

Changing `--term-accent` alone re-tints almost the whole site. If you want a
green-phosphor or amber variant back, change these eleven values and the site
follows — the utilities in the markup no longer decide anything.

### 3.4 `styles/site.css` — the strip

```css
.term-console {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 80;                    /* above the CRT overlay at z-index 70 */
  display: flex;
  align-items: center;
  gap: 0.6rem;
  height: var(--term-strip-h);    /* 2.35rem — the reserved padding matches */
  padding: 0 0.6rem 0 0.75rem;
  background: var(--term-bg-bar);
  border-top: 1px solid var(--term-border);
  box-shadow: 0 -1px 0 rgba(138, 216, 255, 0.06);
  font-family: var(--term-font);
  font-size: 0.72rem;
  line-height: 1;
  color: var(--term-fg-dim);
  letter-spacing: 0.04em;
}

.term-console__prompt {
  flex: none;
  margin: 0; padding: 0; border: 0; background: none;   /* it is a <button> */
  font: inherit;
  color: var(--term-cmd);
  cursor: pointer;
  user-select: none;
}

.term-console__out {
  flex: 1 1 auto;      /* takes all remaining width */
  min-width: 0;        /* required, or flex refuses to shrink and overflow leaks */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--term-fg-dim);
  transition: color 0.12s linear;
}
```

Both the prompt and the output are `<button>` elements, because they are
clickable. That means their default browser chrome must be cleared explicitly —
`margin`, `padding`, `border`, `background`, `font` and `text-align` are all
reset in the two rules above.

### 3.5 `styles/site.css` — telling the CRT from the page

Two details sell the illusion:

```css
/* the scanline + vignette overlay, drawn over everything except the strip */
body.bg-zinc-950::after {
  content: "";
  pointer-events: none;          /* never eats a click */
  position: fixed;
  inset: 0;
  z-index: 70;
  background:
    repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0, 0, 0, 0.2) 3px),
    radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.42) 100%);
}
```

```css
/* the grid behind the content, like phosphor burn-in */
body.bg-zinc-950 {
  background-image:
    linear-gradient(rgba(138, 216, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(138, 216, 255, 0.035) 1px, transparent 1px),
    radial-gradient(ellipse at 50% -12%, #0d2237 0%, var(--term-bg) 58%);
  background-size: 34px 34px, 34px 34px, 100% 100%;
  background-attachment: fixed;
}
```

The overlay sits at `z-index: 70` and the strip at `80`, so the status bar is
crisp while everything below it gets scanlines. If you ever want the strip to
look recessed, set the strip to `65` instead and it will be scanned too.

### 3.6 The CSS "bridge"

This is the least obvious part of the design, and the part to understand before
restyling anything.

The markup is Tailwind utility soup — `<body class="bg-zinc-950 …">`,
`class="text-slate-100"`, `class="rounded-xl border-zinc-800"`. Rather than
rewriting 18 pages, `site.css` re-points those utilities at the terminal palette:

```css
body.bg-zinc-950 .text-slate-100,
body.bg-zinc-950 .text-slate-200 { color: var(--term-fg); }

body.bg-zinc-950 .text-slate-300 { color: var(--term-fg-body); }
body.bg-zinc-950 .text-slate-400 { color: var(--term-fg-dim); }
body.bg-zinc-950 .text-slate-500 { color: var(--term-fg-faint); }

body.bg-zinc-950 .text-cyan-400,
body.bg-zinc-950 .text-cyan-400\/90 { color: var(--term-accent); }
```

Consequences worth knowing:

* The `body.bg-zinc-950` prefix is not decoration. It raises specificity to two
  classes so these rules beat Tailwind's own single-class utilities no matter
  which stylesheet loads last.
* Escaped selectors like `.text-cyan-400\/90` are how you match a Tailwind class
  containing a slash. Any new utility you adopt in markup needs the same
  treatment here if you want it themed.
* Shapes are normalised at the same time — every `rounded*` becomes square,
  `font-bold` becomes a 600 weight, and `.uppercase` is turned back into
  lowercase, because that is what terminal type actually looked like.
* Cosmetic glyphs are added with `::before` / `::after` rather than markup:
  headings get `$ ` and `// `, the wordmark gets `./`, nav items get a `.exe`
  suffix, "chips" get `[ ]`, list rows get `>/`, and the h1 gets its cursor.

If you add a page, copy an existing one. A page whose `<body>` lacks
`bg-zinc-950` will not receive any of the theming, and a page whose `<body>` has
it but that also loads `styles/global.css` (which imports a much older
`site.css`) will fight with it. The live pages only load `styles/site.css`.

---

## 4. Verified behaviour

These were checked with an offline harness that parses the real `index.html`,
runs the real `site.js` against it, and inspects the resulting DOM:

* strip injected, last child of `<body>`, prompt + output + input + meta present
* status text computed per page, e.g. `C:\AUBREY\HOME · ready · press ? for commands`
* 6 boot lines and 11 rows of banner art, widest row 39 columns
* `#main-content h1` still matches after the caret is appended (this one bit
  once — worth re-checking if you restructure the heading)
* typed text reconstructs the original heading exactly
* `help` `?` `whoami` `date` `time` `dir` `ls` `pwd` `ver` `clear` `exit` all answer
* an unknown command produces the `warn` reverse-video state
* <kbd>Enter</kbd> runs, <kbd>Escape</kbd> closes, empty <kbd>Enter</kbd> closes
* reduced motion: boot text readable, no animation, caret present, heading intact
* a bare page with no nav, no `<h1>`, no `<footer>` still runs without throwing
* every colour pair used for text meets WCAG AA (lowest ratio in use: 5.24:1)

Two real bugs were found this way and fixed: the reduced-motion branch once
appended the caret before reading the heading text (blanking the `<h1>`), and a
muted tone once measured 4.34:1 against the status bar.

---

## 5. Extending it

### Add a command

```js
// in the COMMANDS object
ping: function () { return 'pong \u2014 0.002s'; },
```

Then add the word to `HELP` so it is discoverable. If it needs to be highlighted,
return through `say` with a state; otherwise a plain string is enough.

### Add a state colour

1. Add a rule next to the others in the strip section:

```css
.term-console__out[data-state="note"] {
  color: var(--term-accent-soft);
}
```

2. Pass `'note'` as the second argument to `say()`.

Keep the `:hover` rule in mind — add a matching `[data-state="…"]:hover` rule if
the state must survive a pointer.

### Show real information

The command functions run in page scope, so `document`, `window` and
`performance` are all available:

```js
perf: function () {
  var ms = Math.round(performance.now());
  return 'rendered in ' + ms + 'ms';
},
theme: function () {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--term-accent').trim();
},
```

If you add something asynchronous, note that `run()` is synchronous by design —
the simplest path is to `say('working...')` first, then overwrite the text from
the callback.

### Give another page a boot sequence

Add the host element to that page's `<main>`:

```html
<div data-boot></div>
```

The boot sequence, banner and typing heading all key off this one attribute. The
typing effect additionally requires an `<h1>` inside `#main-content`.

### Change the reserved height

`--term-strip-h` (2.35rem) is used for the strip's `height`, the body's
`padding-bottom`, and nothing else. Change it in one place and both follow. If
you add a second row, bump this value and check the `max-width: 520px` media
query, which hides the readout cluster on narrow screens.

---

## 6. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| No strip at all | `js/site.js` not loaded on that page, or a JS error before the strip block. Check the console. |
| Strip overlaps the footer | `:has()` unsupported, or something removed the `padding-bottom` rule. |
| Heading is blank on the home page | `full` is being read after `h1.textContent = ''`. |
| Heading announced one letter at a time | The typed span lost its `aria-hidden`, or `aria-label` was removed. |
| Error message looks like normal output | The `[data-state="warn"]` rule was dropped or moved after `:hover`. |
| Special glyphs render as boxes | A font in `--term-font` is missing them, and Consolas was removed from the stack. |
| Terminal styling missing on a new page | Its `<body>` lacks `bg-zinc-950`, or it loads `global.css`. |
| Colours look half-Tailwind | A new utility class in markup has no rule in the bridge section. |
| Changes do not appear after deploy | GitHub Pages and browsers cache `site.css` / `site.js` aggressively. Bump `?v=2` on the `<link>` and `<script>` tags, or hard-refresh. |
