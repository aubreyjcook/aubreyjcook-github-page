# aubreyjcook-github-page

Personal website, served from GitHub Pages.

Static HTML, one shared stylesheet and one shared script. No build step is
required to deploy — push the branch and Pages serves it.

## Two deployment gotchas

**1. Never start a shipped filename with an underscore.** GitHub Pages runs this
repository through Jekyll, and Jekyll **silently drops** any file or directory
whose name begins with `_` — no error, no warning, no failed build. The file is
just missing from the published site. A script named `demos/_registry.js` was
excluded exactly this way, which broke the sandbox terminal in production while
it worked perfectly locally.

`.nojekyll` at the repository root switches Jekyll off so this can't happen.
**Do not delete it.** `tools/verify-sandbox-worker.mjs` asserts both that it
exists and that no underscore-prefixed path has returned.

**2. A failed deploy is not always a failed build.** The build (`Found 1
artifact(s)`) kept succeeding while the *deploy* half failed with
`Timeout reached, aborting!` after sitting in `updating_pages` for 10 minutes.
That is a GitHub-side wedge: the cancelled deployment keeps the lock, and later
deploys fail instantly with `due to in progress deployment`. Fix by pushing a
fresh commit; if that fails, reset via **Settings → Pages → Source: `None` →
Save → back to `GitHub Actions`**. Full write-up in `TERMINAL.md` §7.7–7.8.

## Layout

| Path | What it is |
| --- | --- |
| `.nojekyll` | Empty marker that disables Jekyll. Do not delete. See above. |
| `index.html` | Home. The only page with the boot sequence and ASCII wordmark. |
| `pages/` | All other pages: about, portfolio, experience, education, resume, quotes, favorites. |
| `pages/portfolio/` | Portfolio sub-section, including the 18 hosted PRG 147 exercises. |
| `pages/templates/` | Starting points for new pages. `index.html` lists them; linked from the portfolio. |
| `pages/js-terminal/` | The sandbox terminal: runs JavaScript and compiled TypeScript demos in the page. `connect owner/repo` loads demos from another repository. Steps are on that page, in the header of `pages/js-terminal/sandbox-link.js`, and in `TERMINAL.md` §7.9. |
| `sandbox.json` | Manifest that makes this repository a connect target for its own terminal. |
| `styles/site.css` | Every style on the site, plus the colour tokens. |
| `js/site.js` | Terminal chrome: boot sequence, status strip, small command line. |
| `js/tailwind-config.js` | Font stacks. |
| `tools/` | Optional Node scripts used while editing. Not shipped to the browser. |
| `archive/` | Pre-Tailwind version of the site, kept for reference. Not linked, and ~32 MB of the deploy artifact. |

## Depth matters

Every page climbs to the shared assets with relative paths, so the number of
`../` segments has to match how deep the file sits:

| Location | Prefix |
| --- | --- |
| `pages/x.html` | `../` |
| `pages/portfolio/x.html` | `../../` |
| `pages/templates/<variant>/x.html` | `../../../` |

Getting this wrong is the one recurring mistake in this repo — a page still
renders, it just silently loses its styling and navigation. `tools/audit.mjs`
catches it: it resolves every local `href`/`src` and reports what is missing.

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
node tools/build-student-work.mjs       # regenerate pages/student-work.html
node tools/check-html.mjs [files]       # tag balance, ids, entities, local targets
node tools/verify-terminal.mjs          # status strip behaviour + status paths
node tools/verify-sandbox-terminal.mjs  # the sandbox terminal widget, commands, input
node tools/verify-sandbox-worker.mjs    # import rewriting, module guard, worker bootstrap
node tools/verify-sandbox-link.mjs      # external sandbox manifest, registration, import URLs
node tools/verify-demos.mjs             # runs both shipped demos through the real pipeline
node tools/audit.mjs                    # whole-site broken-link and chrome report
node tools/asset-matrix.mjs             # which pages load which shared assets
```

`pages/student-work.html` is generated from `tools/student-work.template.html`
and the course data at the top of `tools/build-student-work.mjs`. Edit the data,
re-run the build, and commit the generated HTML — do not hand-edit the output.

## Adding a page

1. Copy `pages/templates/with-tailwind/template-04.html` (the full shell) or one
   of the smaller ones from `pages/templates/from-scratch/`.
2. Put it in `pages/` and strip one `../` from every reference.
3. Add a link to it — from the portfolio, or from the primary nav in every page
   if it belongs there.

## Notes

One known cosmetic issue remains, reported by `tools/audit.mjs`:

- The 18 PRG 147 exercise pages link a favicon set (`../images/favicon/*`) that
  was never committed. Browsers just fall back to no favicon; there is no visible
  breakage. Left alone because those pages are preserved coursework.

Adding `?v=2` to the `site.css` / `site.js` references is the quickest way to
bust caches after a deploy.
