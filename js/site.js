/* =========================================================================
   site.js — terminal chrome for aubreyjcook.github.io
   Adds: mobile nav, boot sequence + ASCII banner (index), fixed console
   status strip with a tiny retro command line.
   No dependencies, no build step.
   ========================================================================= */

(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -----------------------------------------------------------------------
     Mobile navigation
     ----------------------------------------------------------------------- */

  var navBtn = document.getElementById('nav-toggle');
  var navPanel = document.getElementById('mobile-nav');

  if (navBtn && navPanel) {
    navBtn.addEventListener('click', function () {
      var hidden = navPanel.classList.toggle('hidden');
      navBtn.setAttribute('aria-expanded', String(!hidden));
    });
  }

  /* -----------------------------------------------------------------------
     Helpers
     ----------------------------------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* A DOS-style path for the status line.
     Directory indexes collapse to their folder; named pages append the
     filename. The site-layout segment ("pages") is dropped so the readout
     stays short regardless of how deep the page sits in the tree. */
  function machineLine() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    var file = parts.length ? parts[parts.length - 1] : '';
    var dirs = parts.slice(0, -1);
    var at = dirs.indexOf('pages');
    if (at !== -1) dirs = dirs.slice(at + 1);

    var readable = file.replace(/\.html?$/i, '');
    if (readable && readable !== 'index') dirs = dirs.concat([readable]);

    var line = 'C:\\AUBREY\\HOME';
    for (var i = 0; i < dirs.length; i++) {
      line += '\\' + dirs[i].toUpperCase();
    }
    return line;
  }

  /* -----------------------------------------------------------------------
     Boot sequence + ASCII banner (index.html only)
     ----------------------------------------------------------------------- */

  var bootHost = document.querySelector('[data-boot]');

  if (bootHost) {
    var BOOT_LINES = [
      'AUBREY-1 PERSONAL SYSTEM  \u00b7  ROM REV 1.06  \u00b7  (C) 1983-2025',
      '38911 BASIC BYTES FREE',
      'LOADING "AUBREY.COOK",8,1',
      'SEARCHING FOR AUBREY.COOK ... FOUND',
      'MOUNTING C:\\AUBREY\\HOME ... OK',
      'TYPE HELP AND PRESS RETURN'
    ];

    var boot = el('div', 'term-boot');
    if (reduceMotion) {
      boot.setAttribute('data-done', '');
    } else {
      boot.setAttribute('data-animate', '');
    }

    BOOT_LINES.forEach(function (line, i) {
      var isLast = i === BOOT_LINES.length - 1;
      var row = el(
        'span',
        'term-boot-line' + (isLast ? ' term-boot-ok' : ''),
        (isLast ? '> ' : '\u00b7 ') + line
      );
      row.style.animationDelay = (i * 0.34).toFixed(2) + 's';
      boot.appendChild(row);
    });

    bootHost.appendChild(boot);

    /* ASCII wordmark */
    var banner = el('figure', 'term-banner');
    var pre = el('pre');
    pre.setAttribute('aria-hidden', 'true');
    pre.textContent = [
      '   ###   #   # #####  ####  ##### #   #',
      '  #   #  #   # #     #   # #      # #',
      '  #####  #   # ####  ####  ###     #',
      '  #   #  #   # #     #  #  #      # #',
      '  #   #  #   # #     #   # #     #   #',
      '  #   #   ###  ##### #   # ##### #   #',
      '',
      '              #  ####  ####  #   #',
      '              # #    #    # #  #',
      '              # #    #    # ###',
      '         #    # #    #    # #  #',
      '          ###   ####  ####  #   #'
    ].join('\n');

    var caption = el('figcaption', null, 'AUBREY J COOK \u00b7 PROGRAMMER \u00b7 EST. 2006');
    banner.appendChild(pre);
    banner.appendChild(caption);
    bootHost.appendChild(banner);
  }

  /* -----------------------------------------------------------------------
     Self-typing page heading
     Independent of the boot block above, so a page can have the typing
     heading without also taking the boot sequence.
     ----------------------------------------------------------------------- */

  var h1 = document.querySelector('#main-content h1');

  if (h1) {
    var caret = el('i', 'term-caret');
    caret.setAttribute('aria-hidden', 'true');

    if (reduceMotion) {
      h1.appendChild(caret);
    } else {
      var full = h1.textContent.trim();

      /* a hidden copy holds the heading's final height so the page does not
         reflow while the text types itself out */
      var ghost = h1.cloneNode(true);
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.visibility = 'hidden';
      ghost.style.position = 'absolute';
      ghost.style.pointerEvents = 'none';

      var live = el('span', 'term-type');
      live.setAttribute('aria-hidden', 'true');

      h1.textContent = '';
      h1.appendChild(live);
      h1.appendChild(caret);
      h1.setAttribute('aria-label', full);
      h1.parentNode.insertBefore(ghost, h1.nextSibling);

      var i = 0;
      var step = function () {
        i += 1;
        live.textContent = full.slice(0, i);
        if (i < full.length) {
          window.setTimeout(step, 42);
        }
      };
      window.setTimeout(step, 620);
    }
  }

  /* -----------------------------------------------------------------------
     Fixed console status strip
     ----------------------------------------------------------------------- */

  var strip = el('div', 'term-console');
  strip.setAttribute('role', 'contentinfo');
  strip.setAttribute('aria-label', 'Terminal status line');

  var out = el('button', 'term-console__out');
  out.type = 'button';
  out.setAttribute('aria-label', 'Show terminal commands');

  var input = el('input');
  input.type = 'text';
  input.hidden = true;
  input.setAttribute('aria-label', 'Terminal command input');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  input.placeholder = 'type a command, then return';

  var promptBtn = el('button', 'term-console__prompt', 'C:\\>');
  promptBtn.type = 'button';
  promptBtn.setAttribute('aria-label', 'Open the terminal command line');

  var meta = el('div', 'term-console__meta');
  var mem = el('span', null, '640K OK');
  var clock = el('span', null, '--:--:--');
  var led = el('span', 'term-console__led', 'DSK');
  meta.appendChild(mem);
  meta.appendChild(led);
  meta.appendChild(clock);

  strip.appendChild(promptBtn);
  strip.appendChild(out);
  strip.appendChild(input);
  strip.appendChild(meta);
  document.body.appendChild(strip);

  var refreshStatus = function () {
    var d = new Date();
    var pad = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    clock.textContent =
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  };

  var statusText =
    machineLine() + '  \u00b7  ready  \u00b7  press ? for commands';

  var say = function (text, state) {
    out.textContent = text;
    out.setAttribute('data-state', state || '');
  };

  say(statusText);
  refreshStatus();
  window.setInterval(refreshStatus, 1000);

  /* --- tiny command line ------------------------------------------------ */

  var HELP =
    'commands: help  whoami  date  dir  ver  clear  exit';

  var COMMANDS = {
    help: function () {
      return HELP;
    },
    '?': function () {
      return HELP;
    },
    whoami: function () {
      return 'aubrey j cook \u00b7 programmer \u00b7 mchenry county, illinois';
    },
    date: function () {
      return new Date().toString();
    },
    time: function () {
      return new Date().toTimeString();
    },
    ver: function () {
      return 'AUBREY-DOS 1.06 \u00b7 640K RAM \u00b7 github pages volume';
    },
    dir: function () {
      var parts = window.location.pathname.split('/').filter(Boolean);
      var here = parts.length ? parts[parts.length - 1] : '.';
      return here + '  <DIR>  ' + document.title;
    },
    ls: function () {
      return COMMANDS.dir();
    },
    pwd: function () {
      return machineLine();
    },
    clear: function () {
      return statusText;
    },
    exit: function () {
      closeConsole();
      return statusText;
    }
  };

  var closeConsole = function () {
    input.hidden = true;
    out.hidden = false;
    input.value = '';
  };

  var openConsole = function () {
    out.hidden = true;
    input.hidden = false;
    input.focus();
  };

  var run = function (raw) {
    var name = raw.trim().toLowerCase().split(/\s+/)[0];
    if (!name) {
      closeConsole();
      return;
    }
    var handler = Object.prototype.hasOwnProperty.call(COMMANDS, name)
      ? COMMANDS[name]
      : null;
    if (handler) {
      say(handler(), name === 'help' || name === '?' ? 'ok' : '');
    } else {
      say("bad command or file name: '" + raw.trim() + "' \u2014 try help", 'warn');
    }
    closeConsole();
  };

  promptBtn.addEventListener('click', openConsole);
  out.addEventListener('click', openConsole);

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      run(input.value);
    } else if (event.key === 'Escape') {
      closeConsole();
    }
  });

  input.addEventListener('blur', function () {
    if (!input.hidden && input.value === '') closeConsole();
  });

  /* global shortcut: "/" opens the prompt (like an old shell) */
  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var typing =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable);

    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === '?' || event.key === '/') {
      event.preventDefault();
      openConsole();
    }
  });

  /* -----------------------------------------------------------------------
     Keyboard legend — appended to the footer of any page that has one
     ----------------------------------------------------------------------- */

  var footer = document.querySelector('footer');
  var footerInner = footer && footer.firstElementChild;

  if (footerInner) {
    var legend = el('p', 'term-legend');
    [
      ['/', 'command line'],
      ['?', 'recent commands'],
      ['tab', 'next link'],
      ['enter', 'follow link']
    ].forEach(function (pair, i) {
      if (i) legend.appendChild(el('span', 'term-legend__sep', '\u00a0\u00b7\u00a0'));
      var unit = el('span');
      unit.appendChild(el('kbd', null, pair[0]));
      unit.appendChild(document.createTextNode(' ' + pair[1]));
      legend.appendChild(unit);
    });
    footerInner.appendChild(legend);
  }
})();
