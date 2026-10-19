/* ===========================================================================
   sandbox-link.js — fetch demos from an external sandbox repository.

   HOW TO CONNECT THE TERMINAL TO A REPO
   --------------------------------------
   From the sandbox terminal (or from a page URL — see terminal.js):

     connect owner/repo
     demos
     run hello

   What that target means
     owner/repo                  public GitHub repo, branch main,
                                 file sandbox.json, fetched via jsDelivr
     owner/repo@v1               same, at a tag, branch, or commit
                                 (the ref itself cannot contain a slash;
                                 pass a full https URL for those)
     owner/repo@v1:docs/sandbox.json
                                 manifest is not at the repo root
     https://host/sandbox.json   that exact manifest
     https://host/dir/           <dir>/sandbox.json
     http://127.0.0.1:8080/      a local static server of the repo

   The page accepts the same string as a query:
     js-sandbox-terminal.html?sandbox=owner/repo

   What the repo publishes
     sandbox.json at the path above:

       {
         "schema": 1,
         "name": "my-sandbox",
         "description": "Shown by the link command.",
         "runner": "worker",
         "demos": [ "demos/hello.js" ]
       }

     Each path is relative to the manifest. ".." and absolute URLs are refused.
     runner is "worker". This file refuses anything else: the terminal runs
     demos in the browser worker. A Node or TypeScript repo still connects, by
     compiling its demos to plain JavaScript first and keeping node: imports
     out of the files the manifest lists.

     Each demo file is a classic script, the same shape as demos/collatz.js:

       async function hello() {
         await demo.print('hi');
         return 'done';
       }
       Demos.define('hello', { title: 'Hello', lang: 'javascript' }, hello);

     The string in Demos.define is the command. title, blurb, lang, and source
     are plain quoted strings. This module reads them with a scan; it does not
     execute the file on the page. The worker executes it.

     A relative import inside that file (import { greet } from "./lib.js") is
     rewritten against the demo file's URL, so lib.js is loaded from the repo.
     Those imported modules are real ES modules and may use export.
     import "node:fs" is rejected before the worker starts.

   After a successful connect
     demos          lists the linked demos; a linked name hides a built-in
     source <name>  shows the fetched file and its URL
     link           shows the manifest URL
     disconnect     drops the link and restores the built-in
     Esc            cancels a connect that is still fetching

   GitHub shorthand uses cdn.jsdelivr.net, not raw.githubusercontent.com.
   The demo file is fetched as text, so its MIME type does not matter for that
   request. A relative import becomes a real module import, and browsers reject
   a module served as text/plain. jsDelivr serves JavaScript as JavaScript and
   allows cross-origin reads. A direct URL is used as given, so that host has
   to send Access-Control-Allow-Origin and a JavaScript MIME type.

   The same steps are written up in TERMINAL.md §7.9.
   =========================================================================== */

(function (global) {
  'use strict';

  var SCHEMA = 1;
  var generation = 0;
  var inflight = null;
  var active = null;

  /* Turn a connect argument into a manifest URL. See the file header for the
     forms this accepts. GitHub shorthand is built as a jsDelivr URL so that
     later relative imports are served with a JavaScript MIME type. */
  function parseTarget(input) {
    var raw = String(input || '').trim();
    if (!raw) {
      throw new Error('usage: connect <owner/repo[@ref][:sandbox.json]>  or  connect <https://host/sandbox.json>');
    }

    if (/^https?:\/\//i.test(raw)) {
      var url = new URL(raw);
      if (!/\.json$/i.test(url.pathname)) {
        if (!url.pathname.endsWith('/')) url.pathname += '/';
        url.pathname += 'sandbox.json';
      }
      return {
        manifestUrl: url.href,
        label: url.host + url.pathname,
      };
    }

    var match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([A-Za-z0-9_.-]+))?(?::([A-Za-z0-9_./-]+))?$/.exec(raw);
    if (!match) {
      throw new Error(
        'unrecognised sandbox target "' + raw + '". ' +
        'Use owner/repo[@ref] or an https URL to sandbox.json.'
      );
    }

    var owner = match[1];
    var repo = match[2];
    var ref = match[3] || 'main';
    var manifestPath = (match[4] || 'sandbox.json').replace(/^\//, '');
    if (manifestPath.split('/').indexOf('..') !== -1) {
      throw new Error('manifest path cannot contain ..');
    }

    return {
      manifestUrl: 'https://cdn.jsdelivr.net/gh/' + owner + '/' + repo + '@' + ref + '/' + manifestPath,
      label: owner + '/' + repo + '@' + ref,
    };
  }

  function unescapeString(value) {
    return String(value)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\(['"\\])/g, '$1');
  }

  function matchBrace(source, open) {
    var depth = 0;
    var quote = '';
    for (var i = open; i < source.length; i += 1) {
      var ch = source.charAt(i);
      if (quote) {
        if (ch === '\\') { i += 1; continue; }
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function parseMetaObject(source) {
    var meta = {};
    ['title', 'blurb', 'lang', 'source'].forEach(function (key) {
      var re = new RegExp(
        '(?:^|[,{\\s])' + key + '\\s*:\\s*([\'"])((?:\\\\.|(?!\\1)[^\\\\])*)\\1'
      );
      var found = re.exec(source);
      if (found) meta[key] = unescapeString(found[2]);
    });
    return meta;
  }

  /* Pull the command name and metadata out of a demo file without running it.
     The worker is the only place the file executes. The command is the first
     argument of Demos.define, which is why a hint name in sandbox.json cannot
     override it. */
  function extractRegistration(source) {
    var re = /Demos\s*\.\s*define\s*\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/;
    var found = re.exec(String(source));
    if (!found) return null;

    var name = unescapeString(found[2]);
    var i = found.index + found[0].length;
    while (i < source.length && /[\s,]/.test(source.charAt(i))) i += 1;

    var meta = {};
    if (source.charAt(i) === '{') {
      var end = matchBrace(source, i);
      if (end > i) meta = parseMetaObject(source.slice(i, end + 1));
    }
    return { name: name, meta: meta };
  }

  function demoUrl(path, manifestUrl) {
    var spec = String(path || '').trim();
    if (!spec) throw new Error('demo entry is missing its path');
    if (/^[a-z][a-z0-9+.-]*:/i.test(spec) || spec.charAt(0) === '/') {
      throw new Error('demo path must be relative to sandbox.json: ' + spec);
    }
    if (spec.split(/[\\/]/).indexOf('..') !== -1) {
      throw new Error('demo path cannot contain ..: ' + spec);
    }
    return new URL(spec, manifestUrl).href;
  }

  function fetchText(fetchImpl, url) {
    return Promise.resolve(fetchImpl(url, {
      credentials: 'omit',
      signal: inflight ? inflight.signal : undefined,
    })).then(function (res) {
      if (!res || !res.ok) {
        var status = res && res.status != null ? res.status : 'no response';
        throw new Error(url + ' returned ' + status);
      }
      if (typeof res.text !== 'function') throw new Error(url + ' has no body');
      return res.text();
    });
  }

  function readManifest(fetchImpl, manifestUrl) {
    return fetchText(fetchImpl, manifestUrl).then(function (text) {
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new Error('manifest is not JSON: ' + manifestUrl);
      }
    });
  }

  function normaliseEntry(entry) {
    if (typeof entry === 'string') return { path: entry };
    if (entry && typeof entry.path === 'string') return entry;
    throw new Error('each demo must be a path or { "path": "..." }');
  }

  function validateManifest(manifest) {
    if (!manifest || manifest.schema !== SCHEMA) {
      throw new Error('sandbox.json "schema" must be ' + SCHEMA);
    }
    if (manifest.runner && manifest.runner !== 'worker') {
      throw new Error(
        'runner "' + manifest.runner + '" is not supported. ' +
        'Publish "runner": "worker" and browser-runnable demo files. ' +
        'This terminal executes those files in a worker.'
      );
    }
    if (!Array.isArray(manifest.demos) || !manifest.demos.length) {
      throw new Error('sandbox.json lists no demos');
    }
  }

  /* connect owner/repo, as typed in the terminal.
     1. Resolve the target to a manifest URL.
     2. Fetch sandbox.json, then each demo path relative to it.
     3. Read Demos.define out of the text. Skip a file that has none.
     4. Demos.adopt the rest. A linked name hides a built-in of the same name
        until disconnect, which is Demos.forget on this manifest URL.
     A second connect aborts the one still in flight. Esc calls cancel(). */
  function connect(target, options) {
    if (!global.Demos || typeof global.Demos.adopt !== 'function') {
      return Promise.reject(new Error('demo registry is not loaded'));
    }

    var parsed = parseTarget(target);
    var fetchImpl = (options && options.fetch) || global.fetch;
    if (typeof fetchImpl !== 'function') {
      return Promise.reject(new Error('fetch is not available'));
    }

    var ticket = ++generation;
    if (inflight) {
      try { inflight.abort(); } catch (err) { /* the previous connect settles as cancelled */ }
    }
    inflight = typeof AbortController === 'function' ? new AbortController() : null;

    return readManifest(fetchImpl, parsed.manifestUrl).then(function (manifest) {
      validateManifest(manifest);
      var entries = manifest.demos.map(normaliseEntry);
      return Promise.all(entries.map(function (entry) {
        var url = demoUrl(entry.path, parsed.manifestUrl);
        return fetchText(fetchImpl, url).then(function (text) {
          return { entry: entry, url: url, text: text };
        });
      })).then(function (files) {
        return { manifest: manifest, files: files };
      });
    }).then(function (loaded) {
      if (ticket !== generation) {
        return { cancelled: true, label: parsed.label, demos: [], problems: [] };
      }

      var origin = parsed.manifestUrl;
      var label = (loaded.manifest.name && String(loaded.manifest.name)) || parsed.label;
      var problems = [];
      var records = [];

      loaded.files.forEach(function (file) {
        var reg = extractRegistration(file.text);
        if (!reg) {
          problems.push(file.entry.path + ': no Demos.define(...) call, skipped');
          return;
        }
        if (file.entry.name && file.entry.name !== reg.name) {
          problems.push(
            file.entry.path + ': manifest name "' + file.entry.name +
            '" differs from Demos.define("' + reg.name + '"); the define name is the command'
          );
        }
        var meta = reg.meta || {};
        records.push({
          name: reg.name,
          title: meta.title || file.entry.title || reg.name,
          blurb: meta.blurb || file.entry.blurb || '',
          lang: meta.lang || file.entry.lang || 'javascript',
          source: meta.source || file.entry.source || file.entry.path,
          fileText: file.text,
          baseUrl: file.url,
          origin: origin,
          link: label,
        });
      });

      if (!records.length) {
        throw new Error(problems.join('; ') || 'no demos in ' + parsed.manifestUrl);
      }

      if (active) global.Demos.forget(active.origin);
      records.forEach(function (record) { global.Demos.adopt(record); });

      active = {
        label: label,
        description: loaded.manifest.description ? String(loaded.manifest.description) : '',
        manifestUrl: parsed.manifestUrl,
        origin: origin,
        demos: records.map(function (record) { return record.name; }),
        problems: problems,
        cancelled: false,
      };
      inflight = null;
      return active;
    }).catch(function (err) {
      if (ticket === generation) inflight = null;
      if (err && err.name === 'AbortError') {
        return { cancelled: true, label: parsed.label, demos: [], problems: [] };
      }
      throw err;
    });
  }

  function cancel() {
    generation += 1;
    if (inflight) {
      try { inflight.abort(); } catch (err) { /* already settled */ }
      inflight = null;
    }
  }

  function disconnect() {
    cancel();
    if (!active) return { removed: 0, label: '' };
    var label = active.label;
    var removed = global.Demos && global.Demos.forget ? global.Demos.forget(active.origin) : 0;
    active = null;
    return { removed: removed, label: label };
  }

  function current() {
    return active;
  }

  global.SandboxLink = {
    SCHEMA: SCHEMA,
    connect: connect,
    cancel: cancel,
    disconnect: disconnect,
    current: current,
    parseTarget: parseTarget,
    extractRegistration: extractRegistration,
  };
})(typeof self !== 'undefined' ? self : this);
