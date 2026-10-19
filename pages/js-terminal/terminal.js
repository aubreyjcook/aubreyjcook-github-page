/* ===========================================================================
   terminal.js — the sandbox terminal widget.

   Owns the scrollback, the input line, command dispatch, and the bridge to the
   worker sandbox. Demos come from the Demos registry; this file never hard-codes
   a demo name.

   Commands
     help, ?                 this list
     demos, ls               list registered demos
     run <name> [args...]    run a demo
     <name> [args...]        shorthand for `run <name>`
     source <name>           the demo file, as the worker evaluates it
     connect <target>        link a sandbox repo — steps below
     disconnect              drop the linked repo; a hidden built-in returns
     link                    show the linked repo, or how to connect one
     clear, cls              clear the scrollback
     reset                   tear the worker down and start fresh
     history                 recent commands
     about                   what this page is

   Connecting a repository
     The other repo publishes sandbox.json (schema 1, runner "worker") and
     demo files that call Demos.define. Then, in this terminal:

       connect owner/repo          GitHub, branch main, via jsDelivr
       connect owner/repo@v1       a tag, branch, or commit
       connect https://host/sandbox.json
       connect http://127.0.0.1:8080/

     demos lists what arrived. run <name> executes one. link shows the
     manifest URL. disconnect drops it.

     The same target works as a page query, handled at the bottom of this file:

       js-sandbox-terminal.html?sandbox=owner/repo

     sandbox-link.js is the fetcher, and its header is the full contract.
     TERMINAL.md §7.9 is the same contract in prose.
   =========================================================================== */

(function () {
  'use strict';

  var root = document.querySelector('.sandbox');
  if (!root) return;

  var out = root.querySelector('[data-output]');
  var form = root.querySelector('[data-form]');
  var input = root.querySelector('[data-input]');
  var stateEl = root.querySelector('[data-state]');
  var titleEl = root.querySelector('.sandbox__title');
  var defaultTitle = titleEl ? titleEl.textContent : '';

  var sandbox = window.Sandbox.create();
  var history = [];
  var historyAt = 0;
  var busy = false;

  /* --- output ------------------------------------------------------------- */

  var MAX_LINES = 600;

  function trim() {
    while (out.children.length > MAX_LINES) out.removeChild(out.firstChild);
  }

  function scroll() {
    out.scrollTop = out.scrollHeight;
  }

  /* kind: 'out' | 'echo' | 'warn' | 'error' | 'ok' | 'dim' | 'source' | 'rule' */
  function line(text, kind) {
    var div = document.createElement('div');
    div.className = 'sandbox__line' + (kind && kind !== 'out' ? ' is-' + kind : '');
    div.textContent = text === undefined || text === null ? '' : String(text);
    out.appendChild(div);
    trim();
    scroll();
    return div;
  }

  function format(value) {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'function') return '[function ' + (value.name || 'anonymous') + ']';
    if (value instanceof Error) return value.name + ': ' + value.message;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }
    return String(value);
  }

  function setState(text) {
    if (!stateEl) return;
    stateEl.textContent = text;
    stateEl.setAttribute('data-state', text);
  }

  /* --- demo runner -------------------------------------------------------- */

  function runDemo(demo, args) {
    busy = true;
    setState('RUNNING');
    input.disabled = true;
    history.push('run ' + demo.name + (args.length ? ' ' + args.join(' ') : ''));
    historyAt = history.length;

    var started = Date.now();
    var fileText = demo.fileText;

    if (!fileText) {
      line('  (could not read ' + (demo.source || demo.name) + "'s source; the demo was loaded inline)", 'warn');
    }

    /* demo.ask() hands control back to the input line, so the demo can be
       interactive without owning the keyboard. */
    sandbox.onAsk(function (question) {
      return promptUser(question);
    });

    return sandbox
      .run(fileText, { _: args, name: demo.name }, function (method, values) {
        if (method === 'clear') {
          out.textContent = '';
          return;
        }
        var text = values.map(format).join(' ');
        if (method === 'source') {
          text.split('\n').forEach(function (row) { line(row, 'source'); });
          return;
        }
        line(text, method === 'error' ? 'error' : method === 'warn' ? 'warn' : 'out');
      }, demo.name, demo.baseUrl || '')
      .then(function (result) {
        var ms = (result && result.ms) || Date.now() - started;
        if (result && result.ok) {
          line('\u2713 ' + demo.name + ' finished in ' + ms + 'ms', 'ok');
        } else {
          line('\u2717 ' + demo.name + ' stopped: ' + (result && result.message ? result.message : 'unknown error'), 'error');
          if (result && result.stack) {
            line(String(result.stack).split('\n').slice(0, 4).join('\n'), 'dim');
          }
        }
      })
      .catch(function (err) {
        line('terminal error: ' + (err && err.message ? err.message : String(err)), 'error');
      })
      .then(function () {
        busy = false;
        setState('IDLE');
        input.disabled = false;
        input.focus();
      });
  }

  /* Ask the user something mid-demo without leaving a stray prompt behind. */
  function promptUser(question) {
    line(question, 'dim');
    setState('INPUT');
    input.focus();
    return new Promise(function (resolve) {
      var previous = input.value;
      input.value = '';
      input.placeholder = 'type an answer, then return';
      root.classList.add('is-asking');

      function onKey(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        input.removeEventListener('keydown', onKey);
        root.classList.remove('is-asking');
        input.placeholder = 'help';
        var answer = input.value;
        line(answer, 'echo');
        input.value = previous;
        setState('RUNNING');
        resolve(answer);
      }

      input.addEventListener('keydown', onKey);
    });
  }

  /* --- commands ----------------------------------------------------------- */

  var commands = Object.create(null);

  commands.help = function () {
    line('commands', 'ok');
    line('  help, ?                 this list');
    line('  demos, ls               list registered demos');
    line('  run <name> [args...]    run a demo');
    line('  <name> [args...]        shorthand for run');
    line('  source <name>           the demo file as the worker evaluates it');
    line('  connect <target>        link a sandbox repo');
    line('  disconnect              drop the linked repo');
    line('  link                    show the linked repo');
    line('  clear, cls              clear the screen');
    line('  reset                   restart the sandbox worker');
    line('  history                 recent commands');
    line('  about                   what this page is');
    line('');
    line('Demos are real functions executed in an isolated worker. Some ask questions.', 'dim');
    line('');
    line('link a repository', 'ok');
    line('  1. that repo publishes sandbox.json (schema 1, runner "worker")');
    line('  2. connect owner/repo');
    line('     connect owner/repo@ref     a tag, branch, or commit');
    line('     connect https://host/sandbox.json');
    line('     connect http://127.0.0.1:8080/');
    line('  3. demos');
    line('  4. run <name>');
    line('  ?sandbox=owner/repo opens this page already linked.', 'dim');
    line('  disconnect drops the link. Esc cancels a connect still in flight.', 'dim');
  };
  commands['?'] = commands.help;

  commands.demos = function () {
    var list = window.Demos.list();
    if (!list.length) {
      line('no demos registered', 'warn');
      return;
    }
    line(list.length + ' demo' + (list.length === 1 ? '' : 's'), 'ok');
    list.forEach(function (demo) {
      line('  ' + demo.name.padEnd(14) + demo.title + '  [' + demo.lang + ']');
      if (demo.blurb) line('  ' + ' '.repeat(14) + demo.blurb, 'dim');
      if (demo.source) line('  ' + ' '.repeat(14) + 'source: ' + demo.source, 'dim');
      if (demo.link) line('  ' + ' '.repeat(14) + 'sandbox: ' + demo.link, 'dim');
    });
  };
  commands.ls = commands.demos;

  commands.run = function (argv) {
    var name = argv[0];
    if (!name) {
      line('usage: run <name> [args...]', 'warn');
      line('try `demos` for the list', 'dim');
      return;
    }
    var demo = window.Demos.get(name);
    if (!demo) {
      line('no demo called "' + name + '"', 'error');
      line('try `demos` for the list', 'dim');
      return;
    }
    line('> ' + name + (argv.length > 1 ? ' ' + argv.slice(1).join(' ') : ''), 'dim');
    return runDemo(demo, argv.slice(1));
  };

  commands.source = function (argv) {
    var name = argv[0];
    var demo = name ? window.Demos.get(name) : null;
    if (!demo) {
      line('usage: source <name>', 'warn');
      return;
    }
    if (demo.source) line('authored at: ' + demo.source, 'dim');
    if (demo.baseUrl) line('loaded from: ' + demo.baseUrl, 'dim');
    if (demo.link) line('sandbox: ' + demo.link, 'dim');
    var body = demo.fileText || (typeof demo.run === 'function' ? demo.run.toString() : '');
    if (!body) {
      line('no source available', 'warn');
      return;
    }
    line('// as evaluated in the worker', 'dim');
    body.split('\n').forEach(function (row) { line(row, 'source'); });
  };
  commands.cat = commands.source;

  commands.clear = function () {
    out.textContent = '';
  };
  commands.cls = commands.clear;

  commands.reset = function () {
    sandbox.abort();
    line('sandbox worker terminated; a fresh one starts on the next run', 'ok');
  };

  commands.history = function () {
    if (!history.length) {
      line('nothing yet', 'dim');
      return;
    }
    history.forEach(function (entry, i) {
      line('  ' + String(i + 1).padStart(3) + '  ' + entry, 'dim');
    });
  };

  /* connect <target>
       connect owner/repo
       connect owner/repo@ref
       connect owner/repo@ref:path/sandbox.json
       connect https://host/sandbox.json
       connect http://127.0.0.1:8080/
     Empty input prints the usage line. Esc while state is LINK calls
     SandboxLink.cancel and the fetch settles as cancelled. */
  commands.connect = function (argv) {
    if (!window.SandboxLink) {
      line('sandbox link is not available', 'error');
      return;
    }
    var target = argv.join(' ').trim();
    if (!target) {
      line('usage: connect <owner/repo[@ref][:sandbox.json]>  or  connect <https://host/sandbox.json>', 'warn');
      return;
    }

    busy = true;
    setState('LINK');
    input.disabled = true;
    history.push('connect ' + target);
    historyAt = history.length;

    var pending;
    try {
      pending = window.SandboxLink.connect(target);
    } catch (err) {
      pending = Promise.reject(err);
    }

    return Promise.resolve(pending).then(function (info) {
      if (!info || info.cancelled) {
        line('connect cancelled', 'dim');
        return;
      }
      if (titleEl && info.label) titleEl.textContent = 'AUBREY-1 \u00b7 ' + info.label;
      line('linked ' + info.label + ' \u2014 ' + info.demos.length + ' demo' + (info.demos.length === 1 ? '' : 's'), 'ok');
      if (info.manifestUrl) line('  ' + info.manifestUrl, 'dim');
      if (info.description) line('  ' + info.description, 'dim');
      (info.problems || []).forEach(function (problem) { line('  ' + problem, 'warn'); });
      line('`demos` lists them. `disconnect` restores a built-in hidden by the same name.', 'dim');
    }).catch(function (err) {
      var message = err && err.message ? err.message : String(err);
      if (err && (err.name === 'AbortError' || /aborted/i.test(message))) {
        line('connect cancelled', 'warn');
        return;
      }
      line('connect failed: ' + message, 'error');
    }).then(function () {
      busy = false;
      setState('IDLE');
      input.disabled = false;
      input.focus();
    });
  };

  /* Drop the linked repo. Built-in demos that were hidden by the same name
     are the ones `run` finds again. */
  commands.disconnect = function () {
    if (!window.SandboxLink) {
      line('sandbox link is not available', 'error');
      return;
    }
    var info = window.SandboxLink.disconnect();
    if (titleEl) titleEl.textContent = defaultTitle;
    if (!info || !info.removed) {
      line('no external sandbox linked', 'dim');
      return;
    }
    line('unlinked ' + info.label + ' \u2014 built-in demos remain', 'ok');
  };

  /* With no repo linked, print the connect forms. With one linked, print its
     name, description, manifest URL, and demo commands. */
  commands.link = function () {
    var info = window.SandboxLink && window.SandboxLink.current && window.SandboxLink.current();
    if (!info) {
      line('built-in demos only', 'dim');
      line('connect <owner/repo[@ref]>  or  connect <https://host/sandbox.json>', 'dim');
      return;
    }
    line(info.label, 'ok');
    if (info.description) line('  ' + info.description, 'dim');
    line('  manifest: ' + info.manifestUrl, 'dim');
    line('  demos: ' + info.demos.join(', '), 'dim');
  };

  commands.about = function () {
    line('A terminal that runs real code, in an isolated worker, entirely in your browser.');
    line('Built-in demos ship with this page. A repository connects with');
    line('`connect owner/repo` once it publishes sandbox.json. Type `help` for the steps.');
    line('The contract lives in sandbox-link.js and in TERMINAL.md §7.9.', 'dim');
  };

  function dispatch(raw) {
    var text = raw.trim();
    if (!text) return;

    line(text, 'echo');

    var argv = text.split(/\s+/);
    var head = argv[0].toLowerCase();
    var rest = argv.slice(1);

    /* bare demo name is shorthand for `run` */
    if (!commands[head] && window.Demos.get(argv[0])) {
      return commands.run(argv);
    }

    var handler = commands[head];
    if (!handler) {
      line('unknown command: ' + head, 'error');
      line('try `help`', 'dim');
      return;
    }
    return handler(rest);
  }

  /* --- input wiring ------------------------------------------------------- */

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;
    var value = input.value;
    input.value = '';
    dispatch(value);
  });

  input.addEventListener('keydown', function (event) {
    if (busy) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (stateEl && stateEl.textContent === 'LINK' && window.SandboxLink && window.SandboxLink.cancel) {
          window.SandboxLink.cancel();
          return;
        }
        /* let Escape interrupt a runaway demo */
        sandbox.abort();
        line('interrupt requested', 'warn');
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!history.length) return;
      historyAt = Math.max(0, historyAt - 1);
      input.value = history[historyAt] || '';
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!history.length) return;
      historyAt = Math.min(history.length, historyAt + 1);
      input.value = history[historyAt] || '';
      return;
    }

    if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      out.textContent = '';
      return;
    }

    if (event.key === 'Escape') {
      input.value = '';
    }
  });

  /* clicking anywhere in the terminal focuses the input */
  out.addEventListener('click', function () {
    if (!busy) input.focus();
  });

  /* --- first paint -------------------------------------------------------- */

  line('AUBREY-1 SANDBOX TERMINAL', 'ok');
  line('Isolated Web Worker \u00b7 no DOM access \u00b7 everything stays in your browser', 'dim');
  line('');
  line('Type `demos` for built-in demos, `help` for commands, or `connect owner/repo` to link a sandbox.', 'dim');
  line('');

  input.focus();
  setState('IDLE');

  /* Open the page already linked. The value is the same string you would type
     after connect:
       ?sandbox=owner/repo
       ?sandbox=owner/repo@v1
       ?sandbox=https%3A%2F%2Fhost%2Fsandbox.json
       ?sandbox=http%3A%2F%2F127.0.0.1%3A8080%2F
     URLSearchParams decodes it, then commands.connect runs it. */
  var preset = '';
  try {
    var search = window.location && window.location.search;
    if (search && typeof URLSearchParams === 'function') {
      preset = new URLSearchParams(search).get('sandbox') || '';
    }
  } catch (err) {
    preset = '';
  }
  if (preset && window.SandboxLink) {
    line('linking ' + preset, 'dim');
    commands.connect(preset.split(/\s+/));
  }
})();
