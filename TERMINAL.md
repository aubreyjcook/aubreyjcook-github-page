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
| `tools/check-html.mjs` | Generic page checker: tag balance, unique ids, entity validity, local targets, in-page anchors, landmarks. Takes file arguments; defaults to the generated page. |
| `tools/verify-terminal.mjs` | Runs the real `js/site.js` against a DOM stub; asserts the status path for every real URL shape, the reduced-motion path, and the typed heading. |
| `tools/verify-sandbox-terminal.mjs` | Drives the sandbox terminal widget: commands, output styles, history, interactive prompts, busy guards. |
| `tools/verify-sandbox-worker.mjs` | Import rewriting, the module-syntax guard, and that the shipped demo files are valid classic scripts. |
| `tools/verify-demos.mjs` | Drives the real `Sandbox.run` and executes both shipped demos — the strongest of the three. |
| `tools/audit.mjs` | Whole-site sweep: broken internal links grouped by cause, duplicate ids, and chrome injection on every modern page. |
| `tools/asset-matrix.mjs` | Table of which pages load `site.css`, the Tailwind config, and `site.js` — the quickest way to spot a page whose relative paths are wrong. |

```sh
# from the deploy directory
node tools/build-student-work.mjs         # regenerate the student-work page
node tools/check-html.mjs pages/quotes.html
node tools/verify-terminal.mjs            # status strip behaviour + status paths
node tools/verify-sandbox-terminal.mjs    # sandbox terminal widget
node tools/verify-sandbox-worker.mjs      # worker bootstrap + import rewriting
node tools/verify-demos.mjs               # run the shipped demos for real
node tools/audit.mjs                      # whole-site link + chrome report
node tools/asset-matrix.mjs               # asset loading per page
```

---

## 1. What the terminal actually is

There are **two** terminals on this site, and they do different jobs:

| | Status strip | Sandbox terminal |
| --- | --- | --- |
| Where | Every page, fixed to the bottom | `pages/js-terminal/js-sandbox-terminal.html` only |
| Source | `js/site.js` + `styles/site.css` | `pages/js-terminal/*` |
| Purpose | Wayfinding and personality: page path, clock, a few flavoured commands | Running demo code |
| Commands | `help whoami date dir pwd ver clear exit` | `help demos run source clear reset history about` |

They share the palette and the typeface but no code, deliberately. The strip is
one line and always present; the sandbox is a full scrollback and only exists on
one page. Section 7 covers the sandbox.

The status strip itself is **one SVG-free, dependency-free DOM widget**, not a
real shell. It is a fixed strip pinned to the bottom of the viewport that looks
and behaves like a single-line terminal status bar, plus a tiny command
interpreter that answers from a hard-coded table.

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
| Sandbox terminal prints nothing | An exception during `terminal.js` startup. Check the console; `tools/verify-sandbox-terminal.mjs` reproduces startup without a browser. |
| Sandbox demo says "unexpected token 'export'" | The demo uses `export` syntax. See §7.4 — use `module.exports`. |
| Sandbox worker never returns | The demo threw before posting. The worker is replaced automatically on the next `run`; `reset` forces it. |
| Changes do not appear after deploy | GitHub Pages and browsers cache `site.css` / `site.js` aggressively. Bump `?v=2` on the `<link>` and `<script>` tags, or hard-refresh. |

---

## 7. The sandbox terminal

The status strip is flavour. The sandbox terminal is the one that **runs code**.
To run demos from another repository, type `connect owner/repo` in that
terminal. The steps, the manifest, and the other target forms are in §7.9.
The same instructions sit at the top of `pages/js-terminal/sandbox-link.js`.

It lives entirely under `pages/js-terminal/`, plus a manifest at the repo root:

| File | Role |
| --- | --- |
| `js-sandbox-terminal.html` | Page shell: site chrome plus the terminal window. |
| `terminal.css` | Terminal styling. Consumes the `--term-*` tokens; introduces no new colour. |
| `terminal.js` | The widget: scrollback, input, history, command dispatch, sandbox linking. |
| `sandbox-link.js` | Fetches an external repo's `sandbox.json` and registers its demos. |
| `worker-sandbox.js` | Builds the isolated worker and ships a demo file into it. |
| `demos/registry.js` | The `Demos.define` registry. Load first. Must not start with `_` — see §7.7. |
| `demos/collatz.js` | A plain-JavaScript demo. |
| `demos/type-basics.js` | A compiled TypeScript demo. |
| `demos/src/type-basics.ts` | Its TypeScript source. Not loaded by the browser. |
| `sandbox.json` (repo root) | This site as a connect target. Lists the two built-in demos. |

### 7.1 Why a worker

Demos are evaluated in a **Web Worker**, not on the page:

- a runaway `while (true)` burns the worker's thread, so the page stays responsive
- the code has no DOM, no cookies, and no access to the page's variables
- `import()` works inside a module worker, so a demo can be split across files

The worker is built from a Blob URL, so there is no second file to keep in sync.
It is created lazily on the first run and torn down and replaced after any
worker-level error, which means one bad demo cannot poison the session.

### 7.1a What actually travels to the worker

This is the part that is easy to get wrong, and it cost real debugging time.

`Function.prototype.toString()` on a function returns **only that function's
declaration** — not the surrounding file. So the sandbox cannot pick a demo out
of the page by grabbing one function: the `Demos.define(...)` call that names and
registers it lives *outside* the function body and would be left behind.

The sandbox therefore ships the **demo file's own text**, read at load time via
`document.currentScript`, and re-evaluates it in the worker. That is exactly what
the browser does when the page loads the file, which is why a demo file has to be
valid in both places:

- as a classic `<script>` on the page
- as the body of an async function in the worker

Consequences worth knowing:

| In a demo file | Page | Worker |
| --- | --- | --- |
| `export` / `import.meta` | no | no — the guard rejects it with advice |
| `return` at the top level | **SyntaxError** | fine, but pointless |
| `Demos.define(...)` at top level | registers | registers, into the worker's stub |
| Reaching a helper from another file | fine | **not available** — no shared scope |

A demo's *function body* must still be self-contained. Anything shared travels
through `args`.

### 7.2 The demo API

Everything a demo needs arrives as parameters:

```js
async function myDemo(args) {
  await demo.print('a line');            // ordinary output
  await demo.printSource('x = 1');       // preformatted, dimmed
  const name = await demo.ask('name?');  // resolves to a line of input
  await demo.sleep(500);                 // wait
  await demo.clear();                    // wipe the scrollback
  console.log('goes to the terminal');   // console is forwarded
  return 'shown when the demo finishes';
}

Demos.define('my-demo', {
  title: 'My demo',
  blurb: 'One line describing it.',
  lang: 'javascript',
}, myDemo);
```

| Injected | What it is |
| --- | --- |
| `demo.print(v)` | Print a value. Objects are `JSON.stringify`-ed. |
| `demo.printSource(s)` | Print preformatted text, dimmed, newlines preserved. |
| `demo.ask(q)` | Print a question, wait for a line of input, resolve to it. |
| `demo.sleep(ms)` | Wait. |
| `demo.clear()` | Clear the scrollback. |
| `demo.now()` / `demo.random()` | Convenience wrappers. |
| `console.log/warn/error` | Forwarded to the terminal with the matching style. |
| `args` | `{ _: ['first', 'second'], name: 'demo-name' }` — everything after the demo name. |

Every `demo.*` method returns a promise, so `await` always works, and a plain
call still behaves. Returning a value prints it; throwing is caught and shown
with the elapsed time.

### 7.3 Adding a demo

One demo per file, in `demos/`. Copy `demos/collatz.js`, which is the whole
pattern: a self-contained async function, then a `Demos.define` call at the
bottom naming it.

1. Write `demos/my-demo.js`:

```js
async function myDemo(args) {
  await demo.print('hello from ' + (args._[0] || 'nowhere'));
  return 'done';
}

Demos.define('my-demo', {
  title: 'My demo',
  blurb: 'One line describing it.',
  lang: 'javascript',
}, myDemo);
```

2. Add a script tag to `js-sandbox-terminal.html`, **after** `registry.js` and
   **before** `terminal.js`:

```html
<script src="demos/registry.js"></script>
<script src="demos/collatz.js"></script>
<script src="demos/my-demo.js"></script>
<script src="demos/type-basics.js"></script>
<script src="terminal.js"></script>
```

3. `run my-demo`, or just `my-demo`. `demos` lists it, and `source my-demo` shows
   the serialised form the worker evaluates — useful when one misbehaves.

The name in `Demos.define` is the contract: the worker resolves the demo by it.
Registering under a different name than the file is fine, but the command you
type is the registered one.

**Compiled TypeScript.** Author `demos/src/my-demo.ts` with a default export,
compile it into `demos/my-demo.js`, then wrap the result in a `Demos.define`
call as above. No compiler is downloaded at run time — the build output ships in
the repository, which is why the page carries no multi-megabyte dependency.

```sh
# in pages/js-terminal/, using npx (or a local install of typescript)
npx tsc demos/src/my-demo.ts \
  --target es2020 --module es2020 \
  --outDir /tmp/ts-out --removeComments false
# then paste /tmp/ts-out/my-demo.js into the Demos.define wrapper
```

TypeScript emits `export default …`, which cannot cross into the worker. The
sandbox detects it and says so explicitly rather than letting the worker die on
`Unexpected token` — see §7.4. `type-basics` was produced this way: its `.ts`
source sits beside the compiled `.js`, and the compiled file carries a
"BUILD OUTPUT" header.

### 7.4 What cannot cross into the worker

The demo file is re-evaluated in the worker, so its *top-level* code is fine —
but its function body has no shared scope, and module syntax does not survive:

| Written in a demo file | Works? | Use instead |
| --- | --- | --- |
| `export default function f() {}` | No | `Demos.define('name', meta, f)` |
| `import.meta.url` | No | pass the value through `args` |
| `return` at the top level | No — and it is a SyntaxError on the page too | nothing; let `Demos.define` do the work |
| `import x from "./m.js"` | Yes — rewritten to `await runner.import(...)` | — |
| `import { a, b as c } from …` | Yes — rewritten | — |
| `import * as ns from …` | Yes — rewritten | — |
| `import "./side-effect.js"` | Yes — rewritten | — |
| `Demos.define(...)` at top level | Yes — this is the registration mechanism | — |
| Closure over another file's scope, inside the demo function | No | pass it through `args` |

`tools/verify-sandbox-worker.mjs` asserts the rewriting and guard rows;
`tools/verify-demos.mjs` asserts the rest against the shipped demos.

### 7.5 Commands

| Command | Does |
| --- | --- |
| `help`, `?` | Command list |
| `demos`, `ls` | Registered demos, with language and source path |
| `run <name> [args]` | Run a demo |
| `<name> [args]` | Shorthand for `run` |
| `connect <target>` | Fetch a sandbox repo and register its demos. `owner/repo[@ref]`, `owner/repo@ref:path.json`, or an `https://` manifest URL. |
| `disconnect` | Drop the linked demos. A built-in hidden by the same name comes back. |
| `link` | Show the linked repo, or say that only built-ins are loaded. |
| `source <name>` | The demo file exactly as the worker evaluates it |
| `clear`, `cls` | Clear the scrollback |
| `reset` | Terminate the worker; a fresh one starts on the next run |
| `history` | Recent commands |
| `about` | What the page is |

Keyboard: up/down walk history, `Ctrl`+`L` clears, `Esc` clears the line,
interrupts a running demo, or cancels an in-flight `connect`.

### 7.6 Verifying it

The worker needs a real browser (`Worker` and `blob:` URLs), so the worker itself
cannot execute in this sandbox. Everything around it is tested:

```sh
node tools/verify-sandbox-terminal.mjs   # the widget: commands, styles, history, ask, busy guards
node tools/verify-sandbox-worker.mjs     # import rewriting, module guard, bootstrap shape
node tools/verify-sandbox-link.mjs       # manifest loading, registration, import base URLs
node tools/verify-demos.mjs              # runs BOTH shipped demos through the real pipeline
```

`verify-demos.mjs` drives the actual `Sandbox.run`, parses the source the sandbox
generates, rebuilds the worker's scope, and executes the shipped demos for real.
It checks that `collatz(6)` reaches 1 in 8 steps, `collatz(27)` peaks at 9232,
and the compiled TypeScript demo returns a score. It is not a browser; it is a
rehearsal of the same contract.

These caught three genuine bugs and one wrong design:

1. A mock emitting `clear` between other output lines wiped the very lines the
   assertion was reading — the *harness* was wrong, the widget was right.
2. `export` syntax cannot cross into the worker, which is now an explicit error
   with advice instead of `Unexpected token`.
3. The bootstrap never injected `module`, so a demo's `module.exports` assignment
   silently landed on the worker global.
4. **The original design could not work at all.** Picking a demo out of the page
   with `Function.prototype.toString()` yields only the function declaration, so
   the `Demos.define` call registering it was left behind and no demo could ever
   resolve. Hence shipping the demo file's text — §7.1a.

**Still unexecuted: the real `Worker`.** Open the page and run `collatz` to
confirm it end to end in a browser.

### 7.7 The production trap: Jekyll drops underscore filenames

This one shipped a broken terminal to the live site, so it is worth stating
plainly.

GitHub Pages serves this repository through **Jekyll**, and Jekyll **silently
excludes any file or directory whose name begins with an underscore** — it treats
them as internal (the convention behind `_layouts`, `_includes`, `_config.yml`).
There is no error, no warning, and no build failure. The file is simply absent
from the published output.

The registry was originally `demos/_registry.js`. The page requested it, got a
404, `Demos` was never defined, and every demo failed — **while working perfectly
locally**, because a local filesystem applies no such rule.

This is trivially confirmable against the live site. From a single commit:

| URL | Status |
| --- | --- |
| `/pages/js-terminal/demos/collatz.js` | `200` |
| `/pages/js-terminal/demos/type-basics.js` | `200` |
| `/pages/js-terminal/demos/_registry.js` | `404` |

Same directory, same artifact, same deploy — the only difference is the leading
underscore. That comparison is the proof, and it is worth re-running any time a
file 404s in production but exists in the repository.

**Two defences are now in place:**

1. The file is `demos/registry.js`. **Never** name a shipped file with a leading
   underscore.
2. `.nojekyll` sits at the repository root. It is an empty marker that switches
   Jekyll off entirely, so underscore names become safe and no Liquid pass runs.
   Do not delete it.

`tools/verify-sandbox-worker.mjs` asserts both — that `.nojekyll` exists and that
no underscore-prefixed path has reappeared anywhere in the tree.

### 7.8 A separate failure that looked related

While this was being fixed, deploys were also failing for an unrelated reason
that is easy to mistake for a code problem:

```
Error: Timeout reached, aborting!
Canceling Pages deployment...
```

The `deploy` job sat in `Current status: updating_pages` for the full 600s poll
timeout. `updating_pages` is GitHub's *server-side* publish step — no repository
change can affect it. The deployment was then cancelled *while still holding the
lock*, so every later deploy died within a second:

```
Deployment request failed ... due to in progress deployment.
```

That is an infrastructure wedge, not a defect. It was cleared by pushing a fresh
commit (`c4d00ea`, an empty commit), which gave the workflow a new build version
that the queue accepted. If it recurs, the reset is **Settings → Pages → Source:
`None` → Save → back to `GitHub Actions`**, which rebuilds the Pages environment
from scratch.

Worth knowing for next time: **the build half kept succeeding throughout**
(`Found 1 artifact(s)`). Only the deploy half failed, so the logs looked
alarming while the site content was fine.

One contributing factor is artifact size: `archive/` is 245 files and 32 MB that
nothing links to, and the deploy branch totals roughly 74 MB. That did not cause
this wedge, but oversized artifacts make `updating_pages` timeouts more likely.

### 7.9 Connecting the terminal to a repository

Type these three lines in the sandbox terminal. The first fetches the repo.
The second lists what arrived. The third runs one demo:

```
connect owner/repo
demos
run hello
```

`owner/repo` is a public GitHub repository. The terminal reads
`sandbox.json` from the `main` branch through jsDelivr. `hello` is whatever
name that repo passed to `Demos.define`.

#### Every form of the target

| You type | What is fetched |
| --- | --- |
| `connect owner/repo` | `https://cdn.jsdelivr.net/gh/owner/repo@main/sandbox.json` |
| `connect owner/repo@v1` | the same file, at that tag, branch, or commit |
| `connect owner/repo@v1:docs/sandbox.json` | a manifest that is not at the repo root |
| `connect https://host/sandbox.json` | that URL |
| `connect https://host/dir/` | `<dir>/sandbox.json` |
| `connect http://127.0.0.1:8080/` | a local static server of the repo |

The ref in `owner/repo@ref` cannot contain a slash. For a branch named
`feature/demo`, pass the manifest's full https URL.

Opening the page with the same string already linked:

```
pages/js-terminal/js-sandbox-terminal.html?sandbox=owner/repo
```

Encode the value when it is itself a URL:
`?sandbox=http%3A%2F%2F127.0.0.1%3A8080%2F`.

`link` prints the manifest URL and the demo names. `disconnect` drops the
link. A linked demo whose name matches a built-in is the one `run` executes,
and `disconnect` brings the built-in back. `Esc` cancels a connect that has
not finished fetching. `source <name>` prints the file that was fetched and
the URL it came from.

`connect`, `disconnect`, and `link` are commands, so a demo should not use
those names.

#### What the repository contains

`sandbox.json` at the place `connect` looks:

```json
{
  "schema": 1,
  "name": "my-sandbox",
  "description": "One line, shown by link.",
  "runner": "worker",
  "demos": [
    "demos/hello.js",
    { "path": "demos/typed.js", "name": "typed" }
  ]
}
```

```
sandbox.json
demos/hello.js          classic script, calls Demos.define
demos/lib.js            real ES module, imported as ./lib.js
src/hello.ts            optional; name it from meta.source, it is not fetched
```

Demo paths are relative to the manifest. `..` and absolute URLs are refused.
The `name` inside a demo entry is a hint. The command is the string in
`Demos.define`, and that call has to be there or the file is skipped.

Copy `pages/js-terminal/demos/collatz.js`. One demo per file. No top-level
`export`, no top-level `return`. Metadata strings (`title`, `blurb`, `lang`,
`source`) are plain single or double quotes. `source` is the path `demos`
displays, usually the TypeScript file.

```js
async function hello(args) {
  await demo.print('hello from ' + (args._[0] || 'the repo'));
  return 'done';
}

Demos.define('hello', {
  title: 'Hello',
  blurb: 'One line describing it.',
  lang: 'javascript',
}, hello);
```

A relative import is loaded from the repo next to the demo file. The imported
module is a real ES module and may use `export`. A bare specifier such as
`import x from "some-pkg"` is left as written.

`runner` is `"worker"`. The terminal runs the files in a browser worker, so a
Node or TypeScript repository connects by compiling the demos to plain
JavaScript and keeping `node:` imports out of that graph. A `node:` import is
rejected before the worker starts, and the message says so.

GitHub shorthand goes through **jsDelivr**, and the repository has to be
public. The demo file is fetched as text. A relative import is a real module
import, and browsers reject a module served as `text/plain`. jsDelivr serves
JavaScript as JavaScript and allows cross-origin reads. A direct URL is used
as given: that host sends `Access-Control-Allow-Origin` and a JavaScript MIME
type. `connect http://127.0.0.1:8080/` is the local-dev form; the server has
to do the same.

This repository's root `sandbox.json` lists the two built-in demos, so
`connect <owner>/<this-repo>` is a working example. The same instructions are
the header comment of `pages/js-terminal/sandbox-link.js`.

