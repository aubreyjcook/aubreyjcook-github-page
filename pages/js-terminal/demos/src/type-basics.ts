/* ===========================================================================
   demos/src/type-basics.ts — authored in TypeScript.

   This file is NOT loaded by the browser. It is compiled to
   demos/type-basics.js, and the terminal runs that output. Editing this file
   means re-running the build step described in TERMINAL.md.

   The demo is deliberately self-contained: it is serialised and evaluated in a
   worker, so it cannot close over anything from module scope.
   =========================================================================== */

type Question = {
  code: string;
  answer: string;
  choices: string[];
};

const QUESTIONS: Question[] = [
  { code: 'let radius = 5;', answer: 'number', choices: ['number', 'string', 'object'] },
  { code: 'let label = "kart";', answer: 'string', choices: ['string', 'object', 'number'] },
  { code: 'let ready = false;', answer: 'boolean', choices: ['boolean', 'number', 'string'] },
  { code: 'let missing;', answer: 'undefined', choices: ['undefined', 'null', 'object'] },
  { code: 'let empty = null;', answer: 'object', choices: ['object', 'null', 'undefined'] },
  { code: 'let lapTimes = [31.2, 30.8];', answer: 'object', choices: ['object', 'array', 'number'] },
];

/** What `typeof` reports for a value — the whole of JavaScript's runtime typing. */
function inferredType(value: unknown): string {
  return typeof value;
}

export default async function run(args: Record<string, string[]>): Promise<string> {
  /* `demo` and `args` are injected by the terminal's sandbox. */
  const only: number = Number(args._[0]) || QUESTIONS.length;
  const total: number = Math.min(QUESTIONS.length, only);

  await demo.print('TypeScript source: demos/src/type-basics.ts');
  await demo.print('Compiled output : demos/type-basics.js');
  await demo.print('');
  await demo.print('JavaScript has no static types, but it always has a runtime type.');
  await demo.print('typeof answers one question: what is this value, right now?');
  await demo.print('');

  let score: number = 0;

  for (let i: number = 0; i < total; i += 1) {
    const q: Question = QUESTIONS[i];
    await demo.print('  ' + (i + 1) + '.  ' + q.code);
    await demo.print('      ' + q.choices.join('   '));

    const reply: string = (await demo.ask('typeof ?')).trim().toLowerCase();
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
