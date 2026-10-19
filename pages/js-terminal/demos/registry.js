/* ===========================================================================
   demos/registry.js — the demo registry.

   A demo is a function the terminal runs in an isolated worker. Because it is
   serialised with Function.prototype.toString it travels WITHOUT its closures:
   it must be self-contained, and it registers itself with `Demos.define`.

   THE FILENAME MUST NOT START WITH AN UNDERSCORE.
   GitHub Pages runs this repository through Jekyll, and Jekyll silently excludes
   any file or directory whose name begins with `_`. This file was called
   `_registry.js`, and that exclusion is exactly why the sandbox terminal was
   dead on the live site while working perfectly in local development — the
   browser got a 404 for it, so `Demos` was never defined and every demo failed.

   Verified on the live site from a single commit: `demos/collatz.js` and
   `demos/type-basics.js` both served 200, `demos/_registry.js` served 404.

   Everything a demo needs is injected when it runs:

     demo.print(value)        print a line
     demo.printSource(text)   print preformatted source (dimmed)
     demo.ask(question)       prompt for a line of input, resolves to the string
     demo.sleep(ms)           wait
     demo.clear()             clear the terminal
     console.log/warn/error   forwarded to the terminal
     args                     { _: [...] } — whatever followed the demo name

   A demo may return a value; the terminal prints it. Throwing is fine too — the
   error is caught and shown with the run time.

   To add one: write a self-contained function, call Demos.define, add a <script>
   tag to js-sandbox-terminal.html, done. See TERMINAL.md §7.3.
   =========================================================================== */

(function (global) {
  'use strict';

  var registry = new Map();

  global.Demos = {
    /**
     * Register a demo. Call it from a demo file's top level.
     *
     * @param {string} name    the command you type
     * @param {object} meta    { title, blurb, lang, source }
     * @param {Function} fn    async function (args) — self-contained
     */
    define: function (name, meta, fn) {
      registry.set(name, {
        name: name,
        title: (meta && meta.title) || name,
        blurb: (meta && meta.blurb) || '',
        lang: (meta && meta.lang) || 'javascript',
        source: (meta && meta.source) || '',
        /* The sandbox re-evaluates the demo FILE in the worker, because a
           function's toString() carries only its own declaration — not the
           Demos.define call that registers it. document.currentScript is the
           file being loaded right now, so its text is read here and kept. */
        fileText: readOwnSource(),
        run: fn,
      });
    },
    list: function () { return Array.from(registry.values()); },
    get: function (name) { return registry.get(name) || null; },
  };

  function readOwnSource() {
    try {
      var script = document.currentScript;
      return script && script.textContent ? script.textContent : '';
    } catch (err) {
      return '';
    }
  }
})(typeof self !== 'undefined' ? self : this);
