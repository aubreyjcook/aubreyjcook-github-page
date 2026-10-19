/* ===========================================================================
   demos/collatz.js — plain JavaScript demo.

   This file is loaded twice, in two different ways, and has to be valid for both:

     1. as a normal page script — it registers itself with `Demos.define`
     2. as the text the sandbox serialises and evaluates in a worker

   So it must not use `return` at the top level (illegal in a classic script) and
   must not reference anything from another file's scope (that scope is gone by
   the time it runs in the worker). `Demos` is only touched at load time; the
   function below is self-contained and everything it needs arrives as `demo`
   and `args`. The sandbox finds it by the global it leaves behind.
   =========================================================================== */

async function collatz(args) {
  const startAt = Math.max(1, Math.min(10000, Number(args._[0]) || 27));
  const trace = [startAt];
  let n = startAt;

  while (n !== 1) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    trace.push(n);
    if (trace.length > 400) break;
  }

  const peak = Math.max.apply(null, trace);
  const steps = trace.length - 1;

  await demo.print('collatz(' + startAt + ')');
  await demo.print('');

  /* chart the sequence, sampled so it fits the width */
  const width = 46;
  const bar = trace.map(function (v) {
    return Math.max(1, Math.round((v / peak) * width));
  });
  const shown = bar.length > 24 ? 24 : bar.length;
  for (let i = 0; i < shown; i += 1) {
    const at = Math.floor((i / shown) * bar.length);
    await demo.print(String(trace[at]).padStart(6) + ' ' + '\u2588'.repeat(bar[at]));
  }
  if (bar.length > shown) await demo.print('       \u2026 ' + (bar.length - shown) + ' more values');

  await demo.print('');
  await demo.print('steps to reach 1 : ' + steps);
  await demo.print('peak value       : ' + peak);

  return 'collatz complete';
}

/* the name is the contract: the sandbox looks the demo up under it in the worker */
Demos.define('collatz', {
  title: 'Collatz sequence',
  blurb: 'Walk the 3n+1 sequence and chart it. Optionally takes a starting number.',
  lang: 'javascript',
}, collatz);


