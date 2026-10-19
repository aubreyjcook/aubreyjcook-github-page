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

   To add one on this site: write a self-contained function, call Demos.define,
   add a <script> tag to js-sandbox-terminal.html. See TERMINAL.md §7.3.

   To connect a whole repository instead of adding a script tag, that repo
   publishes sandbox.json and demo files in this same shape, and the terminal
   runs `connect owner/repo`. sandbox-link.js fetches the files and registers
   them with Demos.adopt (file text plus the URL the worker uses for relative
   imports). A linked demo with the same name is the one `get` returns;
   Demos.forget(origin) restores the built-in. The header of sandbox-link.js
   is the command-by-command version of this.
   =========================================================================== */

(function (global) {
  'use strict';

  /* More than one record can share a name: the built-in, and a linked repo
     that overrides it. `project` is what commands see. */
  var records = [];

  function put(record) {
    for (var i = 0; i < records.length; i += 1) {
      if (records[i].name === record.name && records[i].origin === record.origin) {
        records[i] = record;
        return;
      }
    }
    records.push(record);
  }

  /* Linked demos shadow built-ins. The first name keeps its place in the list
     so a reconnect does not shuffle the built-in commands. */
  function project() {
    var order = [];
    var byName = Object.create(null);
    records.forEach(function (record) {
      if (!byName[record.name]) order.push(record.name);
      var prev = byName[record.name];
      if (!prev || (prev.origin === 'built-in' && record.origin !== 'built-in')) {
        byName[record.name] = record;
      }
    });
    return order.map(function (name) { return byName[name]; });
  }

  global.Demos = {
    /**
     * Register a demo. Call it from a demo file's top level.
     *
     * @param {string} name    the command you type
     * @param {object} meta    { title, blurb, lang, source }
     * @param {Function} fn    async function (args) — self-contained
     */
    define: function (name, meta, fn) {
      put({
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
        baseUrl: '',
        origin: 'built-in',
        link: '',
        run: fn,
      });
    },

    /**
     * Register a demo whose source was fetched, not loaded as a page script.
     * `origin` is the manifest URL; forget(origin) drops every demo from it.
     */
    adopt: function (record) {
      if (!record || !record.name) throw new Error('adopt requires a name');
      if (typeof record.fileText !== 'string') throw new Error('adopt requires file text');
      put({
        name: record.name,
        title: record.title || record.name,
        blurb: record.blurb || '',
        lang: record.lang || 'javascript',
        source: record.source || '',
        fileText: record.fileText,
        baseUrl: record.baseUrl || '',
        origin: record.origin || 'remote',
        link: record.link || '',
        run: typeof record.run === 'function' ? record.run : null,
      });
    },

    /** Drop every demo registered under `origin`. Returns how many were removed. */
    forget: function (origin) {
      var before = records.length;
      records = records.filter(function (record) { return record.origin !== origin; });
      return before - records.length;
    },

    list: function () { return project(); },
    get: function (name) {
      var found = null;
      project().forEach(function (record) {
        if (record.name === name) found = record;
      });
      return found;
    },
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
