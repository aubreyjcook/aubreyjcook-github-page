/* ===========================================================================
   demos/type-basics.js — BUILD OUTPUT OF demos/src/type-basics.ts
   Do not edit by hand; see the TypeScript section of TERMINAL.md.

   The compiled file is loaded twice, in two ways, and must be valid for both:

     1. as a normal page script — it registers itself with `Demos.define`
     2. as the text the sandbox serialises and evaluates in a worker

   So there is no top-level `return` (illegal in a classic script) and no
   reference to another file's scope. TypeScript's own emit would produce
   `export default …`, which cannot cross into the worker either — a serialised
   function has no module context — so the `Demos.define` call below is how the
   compiled demo is handed over. Keeping the build output in the repository means
   the terminal downloads no compiler at run time.
   =========================================================================== */

async function typeBasics(args) {
  const QUESTIONS = [
    { code: 'let radius = 5;', answer: 'number', choices: ['number', 'string', 'object'] },
    { code: 'let label = "kart";', answer: 'string', choices: ['string', 'object', 'number'] },
    { code: 'let ready = false;', answer: 'boolean', choices: ['boolean', 'number', 'string'] },
    { code: 'let missing;', answer: 'undefined', choices: ['undefined', 'null', 'object'] },
    { code: 'let empty = null;', answer: 'object', choices: ['object', 'null', 'undefined'] },
    { code: 'let lapTimes = [31.2, 30.8];', answer: 'object', choices: ['object', 'array', 'number'] },
  ];

  /** What `typeof` reports for a value — the whole of JavaScript's runtime typing. */
  function inferredType(value) {
    return typeof value;
  }

  const only = Number(args._[0]) || QUESTIONS.length;
  const total = Math.min(QUESTIONS.length, only);

  await demo.print('TypeScript source: demos/src/type-basics.ts');
  await demo.print('Compiled output : demos/type-basics.js');
  await demo.print('');
  await demo.print('JavaScript has no static types, but it always has a runtime type.');
  await demo.print('typeof answers one question: what is this value, right now?');
  await demo.print('');

  let score = 0;

  for (let i = 0; i < total; i += 1) {
    const q = QUESTIONS[i];
    await demo.print('  ' + (i + 1) + '.  ' + q.code);
    await demo.print('      ' + q.choices.join('   '));

    const reply = (await demo.ask('typeof ?')).trim().toLowerCase();
    if (!reply) {
      await demo.print('      (skipped)');
      await demo.print('');
      continue;
    }

    if (reply === q.answer) {
      score += 1;
      await demo.print('      correct \u2014 typeof gives "' + q.answer + '"');
    } else {
      await demo.print('      not quite \u2014 typeof gives "' + q.answer + '", not "' + reply + '"');
      if (q.answer === 'object' && q.code.indexOf('null') !== -1) {
        await demo.print('      (a long-standing quirk: typeof null is "object")');
      }
      if (q.answer === 'object' && q.code.indexOf('[') !== -1) {
        await demo.print('      (arrays are objects too \u2014 use Array.isArray to tell them apart)');
      }
    }
    await demo.print('');
  }

  await demo.print('score: ' + score + ' / ' + total);
  await demo.print('demo of inferredType() at the end of the file: ' + inferredType(score));

  return score + '/' + total + ' correct';
}

Demos.define('type-basics', {
  title: 'Type inference basics',
  blurb: 'A short interactive quiz on what JavaScript infers for each value.',
  lang: 'typescript',
  source: 'demos/src/type-basics.ts',
}, typeBasics);
