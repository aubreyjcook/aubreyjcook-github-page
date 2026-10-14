# aubreyjcook-github-page

Personal website, served from GitHub Pages.

Static HTML, one shared stylesheet and one shared script. No build step is
required to deploy — push the branch and Pages serves it.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Home. The only page with the boot sequence and ASCII wordmark. |
| `pages/` | All other pages: about, portfolio, experience, education, resume, quotes, favorites. |
| `pages/portfolio/` | Portfolio sub-section, including the 18 hosted PRG 147 exercises. |
| `styles/site.css` | Every style on the site, plus the colour tokens. |
| `js/site.js` | Terminal chrome: boot sequence, status strip, small command line. |
| `js/tailwind-config.js` | Font stacks. |
| `tools/` | Optional Node scripts used while editing. Not shipped to the browser. |
| `archive/` | Pre-Tailwind version of the site, kept for reference. Not linked. |

## The terminal look

The site is styled as a vintage monochrome terminal: one typeface, square
corners, scanlines, and a fixed status strip at the bottom of every page.
`styles/site.css` re-points Tailwind's utility classes at that palette, so the
markup stays plain HTML with utility classes while the theme lives in one file.

**`TERMINAL.md` documents the whole mechanism** — what each part is, how the
command line works, the full colour token set, and how to extend it. Read that
before changing anything in `js/site.js` or `styles/site.css`.

## Editing

Requires Node only for the optional tools.

```sh
node tools/build-student-work.mjs   # regenerate pages/student-work.html
node tools/verify-page.mjs          # structural checks on the generated page
node tools/verify-terminal.mjs      # terminal behaviour + status paths
node tools/audit.mjs                # whole-site link and chrome report
```

`pages/student-work.html` is generated from `tools/student-work.template.html`
and the course data at the top of `tools/build-student-work.mjs`. Edit the data,
re-run the build, and commit the generated HTML — do not hand-edit the output.

## Notes

Known pre-existing broken internal references, as reported by `tools/audit.mjs`:

- The 18 PRG 147 exercise pages link a favicon set (`../images/favicon/*`) that
  was never committed. Cosmetic only — no visible breakage.
- The four files under `pages/templates/` use relative paths one directory level
  too high, so those templates load without styling or navigation. They are not
  linked from the site.

Adding `?v=2` to the `site.css` / `site.js` references is the quickest way to
bust caches after a deploy.
