import { test, expect } from '@playwright/test';
import {
  readChartEdits,
  readNarrowing,
  type ChartEdit,
  type ChartFacts,
  type ChartNode,
} from '../src/components/sox-icfr/sopChartEdits';
import type { ImportRow } from '../src/components/sox-icfr/racmImport';

/**
 * THE TYPED-INSTRUCTION READER, PINNED DOWN.
 *
 * `sopChartEdits.ts` reads what a reviewer types at the flowchart — rename a
 * box, take a box out, narrow the whole chart. It is a vocabulary matched in
 * order, not a model, and every rule in its header is there because a real
 * phrasing broke the version before it. Those rules were found by hand, over
 * EIGHT rounds of probing with phrasings a reviewer actually writes, and until
 * this file existed the probes were the only thing that knew about them: they
 * lived in a terminal, were re-typed each round, and were thrown away after.
 * This spec IS that record now. If a rule here is relaxed, the sentence that
 * broke it once will break it again and nobody will notice, because what the
 * reader gets wrong it gets wrong SILENTLY — a box that quietly stays, or a
 * title quietly replaced by the word "theek".
 *
 * It needs no browser. The module's only imports are `import type`, so it is
 * pure at runtime and is called here directly; there is no `page`, no dev
 * server and no login gate, which is why `@playwright/test` is imported rather
 * than the repo's `./_helpers` wrapper.
 *
 * WHAT IS ASSERTED IS WHAT THE READER DOES, not what it ought to do. Where the
 * module's header over-promises, the test asserts the real behaviour and says
 * so under `// HEADER OVER-PROMISES` rather than being written to the claim.
 *
 * This file shipped with four defects recorded as `test.fixme` — a wish beside
 * a live test pinning the wrong behaviour, so closing one meant flipping both
 * halves in a single edit. All four were closed on 29 Sep and the pairs are
 * gone with them: "no manual controls" now narrows, a cap counts what the rest
 * of the message already took out, a negation cancels the removal verb it sits
 * against, and a Hindi "ko … kar do" rename lands on the box beside the "ko".
 * Each now sits as an ordinary test under the rule it belongs to.
 */

// ── the chart these tests talk about ─────────────────────────────────────────
//
// A P2P flowchart big enough for the rules to have something to get wrong: four
// risks, nine controls, and a spread of key / nature / type so every narrowing
// leaves a different set behind. Titles are deliberately ordinary control names
// and none of them contains a word the reader matches on ("key", "manual",
// "preventive", "detective"), so a by-name hit can never be mistaken for a
// narrowing.

const CONTROLS: Array<[title: string, isKey: boolean, nature: 'Manual' | 'Automated' | 'IT-dependent', type: 'Preventive' | 'Detective']> = [
  ['Vendor master change approval', true, 'Manual', 'Preventive'],
  ['Three-way match on invoice posting', true, 'Automated', 'Preventive'],
  ['Duplicate invoice identification', false, 'Automated', 'Detective'],
  ['Purchase order approval limits', true, 'Manual', 'Preventive'],
  ['Goods receipt quantity reconciliation', false, 'IT-dependent', 'Detective'],
  ['Invoice coding second review', false, 'Manual', 'Detective'],
  ['Payment run authorisation', true, 'Manual', 'Preventive'],
  ['Bank statement reconciliation', false, 'Manual', 'Detective'],
  ['Vendor bank detail verification', true, 'Automated', 'Preventive'],
];

/** Which risk each control hangs off, so "risk 2 hata do" takes its controls. */
const RISK_OF = [1, 1, 2, 2, 3, 3, 3, 4, 4];

const RISK_TITLES = [
  'Unapproved vendor added to the master',
  'Invoice paid without a matching receipt',
  'Payment made to the wrong account',
  'Period-end payables understated',
];

/**
 * A fresh chart per call.
 *
 * `leaveOut` hands back the node's own `rowKeys` array, so sharing one fixture
 * across tests would share those arrays too. Rebuilding is cheap and removes
 * the question entirely.
 */
function facts(): ChartFacts {
  const controls: ChartNode[] = CONTROLS.map(([title], i) => ({
    no: i + 1,
    ref: `ALT-P2P-R0${RISK_OF[i]}-C0${i + 1}`,
    id: `ALT-P2P-R0${RISK_OF[i]}-C0${i + 1}`,
    title,
    rowKeys: [`row-${i + 1}`],
  }));
  const risks: ChartNode[] = RISK_TITLES.map((title, i) => ({
    no: i + 1,
    ref: `R-0${i + 1}`,
    id: `R-0${i + 1}`,
    title,
    rowKeys: controls.filter((_, j) => RISK_OF[j] === i + 1).flatMap(c => c.rowKeys),
  }));
  // Only `key`, `nature`, `type` and `key` (the row id) are read by the
  // narrowing, so the rest of ImportRow is filled with empties rather than
  // invented: a row that carries made-up values invites a later test to assert
  // against them.
  const rows = CONTROLS.map(([, isKey, nature, type], i) => ({
    key: `row-${i + 1}`,
    rowNo: i + 1,
    origin: 'sop',
    values: {},
    extras: {},
    attributes: [],
    designChecks: [],
    mergedDuplicateChecks: 0,
    frequency: 'Monthly',
    isKey,
    nature,
    type,
    assertions: [],
  })) as unknown as ImportRow[];
  return { risks, controls, rows };
}

const read = (msg: string): ChartEdit[] => readChartEdits(msg, facts());

const kinds = (es: ChartEdit[]): string[] => es.map(e => e.kind);

/** Every row the message takes out of the import, sorted so order never matters. */
const leftOut = (es: ChartEdit[]): string[] =>
  es.flatMap(e => (e.kind === 'leave-out' ? e.rowKeys : [])).sort();

/** `rows(4, 5)` — the rows behind Control 4 and Control 5. */
const rows = (...nos: number[]): string[] => nos.map(n => `row-${n}`).sort();

/** The one refusal a message came back with, for asserting on its wording. */
const refusal = (es: ChartEdit[]): string =>
  es.filter(e => e.kind === 'nothing').map(e => e.text).join(' | ');

const renames = (es: ChartEdit[]) => es.filter(e => e.kind === 'rename');

// ── rule 1 ───────────────────────────────────────────────────────────────────

test.describe('a negative observation is not an instruction', () => {
  // A box beside a chart is where a reviewer writes what is WRONG with a
  // control, and almost every such note is phrased negatively. `no` / `not` /
  // `never` were removed from both vocabularies for exactly this reason, so
  // each of these once changed the chart and must now change nothing.

  test('"Control 7 does not run monthly" is a note, not a removal', () => {
    const es = read('Control 7 does not run monthly');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    // It still says it can SEE the box, which is what tells the reviewer the
    // number was understood and only the verb was missing.
    expect(refusal(es)).toContain('I can see Control 7, but not what to do with it');
  });

  test('"Risk 2 has no owner" leaves Risk 2 and its controls alone', () => {
    const es = read('Risk 2 has no owner');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toContain('I can see Risk 2');
  });

  test('"preventive controls are not optional" does not narrow to detective', () => {
    const es = read('preventive controls are not optional');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toContain("I couldn't place that");
  });

  test('"no manual controls" narrows, because the negation sits on the class', () => {
    // The one negative that IS an instruction, and for a while the deliberate
    // cost of the rule above: `no` had to go so the three notes would stop
    // firing, and it took the commonest way of asking for a class to go with
    // it. It is back under conditions the three notes cannot meet — the
    // negation lands directly on the class, and the phrase ends there.
    const es = read('no manual controls');
    expect(kinds(es)).toEqual(['leave-out']);
    expect(leftOut(es)).toEqual(rows(1, 4, 6, 7, 8));
    expect(readNarrowing('no manual controls').natures).toEqual(['Automated', 'IT-dependent']);
  });

  test('"no detective controls please" narrows too', () => {
    // A closing politeness is not the sentence continuing.
    expect(readNarrowing('no detective controls please').types).toEqual(['Preventive']);
  });

  test('"no manual controls have been tested" is still an observation', () => {
    // The phrase has to END at the class. Anything said ABOUT those controls
    // afterwards makes it a note, which is the whole reason `no` was dropped.
    expect(readNarrowing('no manual controls have been tested').said).toEqual([]);
  });

  test('"Control 7 has no manual steps" does not narrow the chart', () => {
    // A negative in a sentence that names a box is a note about that box, so
    // the plain negative stands down in it entirely.
    expect(readNarrowing('Control 7 has no manual controls').said).toEqual([]);
  });

  test('"exclude manual controls" does narrow', () => {
    const es = read('exclude manual controls');
    expect(kinds(es)).toEqual(['leave-out']);
    expect(leftOut(es)).toEqual(rows(1, 4, 6, 7, 8));
    expect(es[0]!.kind === 'leave-out' && es[0]!.said).toEqual(['no manual controls']);
  });

  test('"manual controls hata do" does narrow', () => {
    const es = read('manual controls hata do');
    expect(kinds(es)).toEqual(['leave-out']);
    expect(leftOut(es)).toEqual(rows(1, 4, 6, 7, 8));
  });
});

// ── rule 2 ───────────────────────────────────────────────────────────────────

test.describe('the verb picks the box, not the word order', () => {
  // The box you name FIRST is almost always the one you are protecting, so the
  // first number winning was the single worst failure mode this reader had.

  test('"Control 9 is fine, but remove Control 4" removes Control 4', () => {
    const es = read('Control 9 is fine, but remove Control 4');
    expect(leftOut(es)).toEqual(rows(4));
  });

  test('"control 9 rakho, control 4 hata do" removes Control 4', () => {
    // Hindi is verb-final, so the object sits BEFORE its verb here — the
    // forward bias has to cancel when every candidate is behind the marker.
    const es = read('control 9 rakho, control 4 hata do');
    expect(leftOut(es)).toEqual(rows(4));
  });

  test('"control 5 hata do, control 9 rakho" removes Control 5', () => {
    // The mirror image: the protected box now sits last, so a reader that
    // simply preferred the nearest box either way would take out Control 9.
    const es = read('control 5 hata do, control 9 rakho');
    expect(leftOut(es)).toEqual(rows(5));
  });

  test('"do not remove control 9, remove control 4" removes Control 4', () => {
    // A negation sitting against a removal verb cancels it. Before that, the
    // `remove` inside "do not remove" was a real marker right beside Control 9
    // and took it out — the worst failure this reader had, because the
    // sentence says the opposite in as many words.
    const es = read('do not remove control 9, remove control 4');
    expect(leftOut(es)).toEqual(rows(4));
    // And a box protected by a cancelled verb is protected for the notice too,
    // so nothing is announced about Control 9 either.
    expect(kinds(es)).toEqual(['leave-out']);
  });

  test('"control 4 nahi chahiye" is still a removal', () => {
    // The negative word is INSIDE this verb rather than in front of it, so the
    // cancellation rule must not reach it.
    expect(leftOut(read('control 4 nahi chahiye'))).toEqual(rows(4));
  });

  test('"control 9 mat hatao, control 4 hata do" removes Control 4', () => {
    // The Hindi shape of the same thing.
    expect(leftOut(read('control 9 mat hatao, control 4 hata do'))).toEqual(rows(4));
  });

  test('a Hindi "ko … kar do" rename lands on the box beside "ko"', () => {
    // The rename branch walks out from the nearest rename mark, and this
    // phrasing — the commonest rename there is — used to carry none, so it
    // fell back to the FIRST box named. The first box named is almost always
    // the one being protected, and a wrong rename has only Undo.
    const es = read('Control 9 theek hai, Control 4 ko "Duplicate invoice review" kar do');
    expect(renames(es)).toHaveLength(1);
    expect(renames(es)[0]!.ref).toBe('ALT-P2P-R02-C04');
    expect(renames(es)[0]!.to).toBe('Duplicate invoice review');
    expect(leftOut(es)).toEqual([]);
  });

  test('a box named by its full ID is removed like a numbered one', () => {
    const es = read('ALT-P2P-R02-C04 hata do');
    expect(leftOut(es)).toEqual(rows(4));
  });

  test('a removal that wraps its object — "take control 4 out" — still lands', () => {
    // `take … out` SPANS the box rather than sitting beside it, which scored as
    // maximally far away until spanning was made distance zero.
    expect(leftOut(read('take control 4 out'))).toEqual(rows(4));
  });

  test('removing a risk takes its controls with it', () => {
    const es = read('risk 2 hata do');
    expect(leftOut(es)).toEqual(rows(3, 4));
    expect(es[0]!.kind === 'leave-out' && es[0]!.said).toEqual(['Risk 2 left out with its controls']);
  });
});

// ── rule 3 ───────────────────────────────────────────────────────────────────

test.describe('a quoted name is a name, whatever is in it', () => {
  // Quotes say where the name ends, so the guards that stop a sentence being
  // swallowed as a title have no job on a quoted run.

  test('rename Control 4 to "Remove duplicate check" renames, it does not remove', () => {
    const es = read('rename Control 4 to "Remove duplicate check"');
    expect(leftOut(es)).toEqual([]);
    expect(renames(es)).toHaveLength(1);
    const r = renames(es)[0]!;
    expect(r.what).toBe('control');
    expect(r.ref).toBe('ALT-P2P-R02-C04');
    expect(r.to).toBe('Remove duplicate check');
    expect(r.from).toBe('Purchase order approval limits');
  });

  test('rename risk 1 to "Vendor and supplier onboarding" is not refused for the "and"', () => {
    const es = read('rename risk 1 to "Vendor and supplier onboarding"');
    expect(renames(es)).toHaveLength(1);
    expect(renames(es)[0]!.ref).toBe('R-01');
    expect(renames(es)[0]!.to).toBe('Vendor and supplier onboarding');
  });

  test('the same name UNQUOTED is asked about rather than acted on', () => {
    // The contrast that makes the rule worth having: without quotes the reader
    // cannot tell a title from an instruction, so it asks instead of guessing.
    const es = read('rename Control 4 to Remove duplicate check');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toContain('Did you want Control 4 renamed, or taken out?');
  });
});

// ── rule 4 ───────────────────────────────────────────────────────────────────

test.describe('an unquoted one-word name after "ko … karo" is a verb', () => {
  // "X ko Y kar do" names no act at all and is the commonest phrasing there is.
  // Each of these used to replace a control's title with a single Hindi verb —
  // and the last was a request to change a FIELD, answered by destroying the
  // title.

  for (const [msg, word] of [
    ['Control 4 ko theek karo', 'theek'],
    ['Risk 2 ko review karo', 'review'],
    ['Control 4 ko key bana do', 'key'],
  ] as const) {
    test(`"${msg}" refuses rather than renaming to "${word}"`, () => {
      const es = read(msg);
      expect(kinds(es)).toEqual(['nothing']);
      expect(renames(es)).toHaveLength(0);
      expect(leftOut(es)).toEqual([]);
      expect(refusal(es)).toContain(`Did you mean to rename it to "${word}"?`);
      expect(refusal(es)).toContain('One word on its own reads like an instruction');
    });
  }
});

// ── rule 5 ───────────────────────────────────────────────────────────────────

test.describe('a term with alternatives must be grouped', () => {
  // `\bdetective|detect\w*\b` parsed as `\bdetective` OR the rest, which made
  // "detective controls hata do" KEEP the detective controls — the exact
  // opposite of the ask, applied silently to the whole chart.

  test('"detective controls hata do" removes the detective ones', () => {
    const es = read('detective controls hata do');
    expect(leftOut(es)).toEqual(rows(3, 5, 6, 8));
    // Ruling one of two types out is stored as keeping the other, so the
    // receipt reads as a keep even though the reviewer phrased it as a removal.
    expect(es[0]!.kind === 'leave-out' && es[0]!.said).toEqual(['preventive controls only']);
  });

  test('"only preventive controls, no exceptions" keeps preventive only', () => {
    // "only" has to be read BEFORE "not" on both filters; the other way round,
    // the trailing "no exceptions" inverted this sentence completely.
    const es = read('only preventive controls, no exceptions');
    expect(leftOut(es)).toEqual(rows(3, 5, 6, 8));
    expect(readNarrowing('only preventive controls, no exceptions').types).toEqual(['Preventive']);
  });
});

// ── rule 6 ───────────────────────────────────────────────────────────────────

test.describe('a narrowing needs a narrowing word, a cap needs a cap word', () => {
  test('"I count 3 controls here" is an observation, not a request for three', () => {
    const es = read('I count 3 controls here');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(readNarrowing('I count 3 controls here').limit).toBeNull();
  });

  test('"at most 6 controls" is a cap', () => {
    const es = read('at most 6 controls');
    expect(leftOut(es)).toEqual(rows(7, 8, 9));
    expect(es[0]!.kind === 'leave-out' && es[0]!.said).toEqual(['at most 6 controls']);
  });
});

// ── rule 7 ───────────────────────────────────────────────────────────────────

test.describe('two instructions in one message', () => {
  test('"Control 4 and Control 5 hata do" carries one verb across both', () => {
    // A plain list under one verb is read BEFORE the message is cut on its
    // conjunctions — split first, the second half is a bare noun and vetoes the
    // whole thing.
    const es = read('Control 4 and Control 5 hata do');
    expect(leftOut(es)).toEqual(rows(4, 5));
  });

  test('a Hindi list with "ko" between it and the verb still reads', () => {
    // `\W` alone between list and verb killed this ordinary phrasing outright.
    expect(leftOut(read('Control 4 aur Control 5 ko hata do'))).toEqual(rows(4, 5));
  });

  test('"control 4, control 5, control 6 are fine, hata do control 7" removes only Control 7', () => {
    const es = read('control 4, control 5, control 6 are fine, hata do control 7');
    expect(leftOut(es)).toEqual(rows(7));
    // HEADER OVER-PROMISES: the header says a box named to PROTECT it does not
    // trigger the unread-half notice. Protection is judged clause by clause, so
    // only Control 6 — which shares the comma-clause with "are fine" — is
    // spared; Control 4 and Control 5 sit in clauses of their own and are
    // announced as untouched. The removal is right, the notice is noisy.
    expect(refusal(es)).toContain("I didn't do anything with Control 4 and Control 5");
  });

  test('"remove control 4 and remove control 5, control 9 stays" leaves Control 9 alone', () => {
    // A chain stops where a box is being protected — Control 9 joined this list
    // on the comma and was taken out with the other two.
    const es = read('remove control 4 and remove control 5, control 9 stays');
    expect(leftOut(es)).toEqual(rows(4, 5));
    expect(kinds(es)).toEqual(['leave-out', 'leave-out']);
  });

  test('one "rakho" at the end does not cancel the whole list', () => {
    // With no punctuation the "clause" is the entire message, so a single
    // protect-word at the end once trimmed every member and the sentence did
    // nothing at all.
    expect(leftOut(read('control 4 aur control 5 ko hata do control 9 rakho'))).toEqual(rows(4, 5));
  });

  test('a cap counts what the rest of the message already took out', () => {
    // "at most 6" means six left on the chart. The cap used to be computed
    // over all nine rows and keep the first six, with the removal then taken
    // off the top of that — so a message asking for six delivered five.
    expect(leftOut(read('control 4 hata do aur at most 6 controls'))).toEqual(rows(4, 8, 9));
  });

  test('a cap means the same thing whichever end of the message it is typed at', () => {
    // A cap is a statement about what is LEFT, so it is settled after the rest
    // of the message has had its say, whatever order it was written in.
    expect(leftOut(read('at most 6 controls aur control 4 hata do'))).toEqual(rows(4, 8, 9));
  });

  test('if a half cannot be read, NEITHER half is applied', () => {
    // Half an edit, silently, is worse than none: the reviewer who asked for
    // two things and got one has no way to see which.
    const es = read('Control 4 hata do aur Control 12 hata do');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toBe('There is no control 12 — this chart has 9 controls.');
  });
});

// ── rule 8 ───────────────────────────────────────────────────────────────────

test.describe('the unread-half notice', () => {
  // Every edit the reader DOES make prints a receipt with an Undo on it. What
  // has no receipt is the edit it never made, and an absence is the one thing
  // nobody notices — so a box that was named and then not touched is said out
  // loud.

  test('"rename Control 4 to X, remove Control 9" names the box it did not touch', () => {
    const es = read('rename Control 4 to "Duplicate invoice review", remove Control 9');
    expect(kinds(es)).toEqual(['rename', 'nothing']);
    expect(renames(es)[0]!.ref).toBe('ALT-P2P-R02-C04');
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toBe("I didn't do anything with Control 9 — send that part on its own and I'll read it.");
  });

  test('a box named only to protect it raises no notice', () => {
    // A notice that fires on correct reads is one nobody reads by the third
    // time.
    const es = read('Control 9 is fine, remove Control 4');
    expect(kinds(es)).toEqual(['leave-out']);
    expect(leftOut(es)).toEqual(rows(4));
  });

  test('a skipped second removal is announced', () => {
    // "remove control 4, keep control 9, remove control 5" reads one of two
    // removals. The notice is what makes the silence visible; the parse itself
    // was never fixed.
    const es = read('remove control 4, keep control 9, remove control 5');
    expect(leftOut(es)).toEqual(rows(4));
    expect(refusal(es)).toContain("I didn't do anything with Control 5");
  });

  test('a narrowing decided about every row, so it raises no notice', () => {
    const es = read('sirf key controls rakho');
    expect(kinds(es)).toEqual(['leave-out']);
    expect(es[0]!.kind === 'leave-out' && es[0]!.whole).toBe(true);
  });
});

// ── rule 9 ───────────────────────────────────────────────────────────────────

test.describe('readNarrowing on its own', () => {
  test('"sirf key controls rakho" is key-only and nothing else', () => {
    expect(readNarrowing('sirf key controls rakho')).toEqual({
      keyOnly: true,
      natures: [],
      types: [],
      limit: null,
      said: ['key controls only'],
    });
  });

  test('every cap word reads as a limit', () => {
    expect(readNarrowing('at most 6 controls').limit).toBe(6);
    expect(readNarrowing('no more than 3 controls').limit).toBe(3);
    expect(readNarrowing('up to 2 controls').limit).toBe(2);
    expect(readNarrowing('3 controls rakho').limit).toBe(3);
  });

  test('a nature filter keeps or rules out, and says which', () => {
    const only = readNarrowing('automated controls only');
    expect(only.natures).toEqual(['Automated']);
    expect(only.said).toEqual(['automated controls only']);

    const out = readNarrowing('exclude automated controls');
    expect(out.natures).toEqual(['Manual', 'IT-dependent']);
    expect(out.said).toEqual(['no automated controls']);
  });

  test('a type filter is stored as the type that survives', () => {
    expect(readNarrowing('detective controls hata do').types).toEqual(['Preventive']);
    expect(readNarrowing('sirf detective controls rakho').types).toEqual(['Detective']);
  });

  test('two narrowings in one message are both read', () => {
    const n = readNarrowing('sirf key controls rakho aur detective controls hi rakho');
    expect(n.keyOnly).toBe(true);
    expect(n.types).toEqual(['Detective']);
    expect(n.said).toEqual(['key controls only', 'detective controls only']);
  });

  test('a narrowing that would empty the chart is refused, not applied', () => {
    // No key control on this chart is detective, so this asks for nothing at
    // all — and an empty chart is never what the reviewer meant.
    const es = read('only key detective controls');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toContain('That would take every control off the chart');

    expect(kinds(read('at most 0 controls'))).toEqual(['nothing']);
  });

  test('an empty message offers the vocabulary', () => {
    for (const msg of ['', '   ']) {
      const es = read(msg);
      expect(kinds(es)).toEqual(['nothing']);
      expect(refusal(es)).toContain('I can rename a box');
      expect(refusal(es)).toContain('narrow the whole chart');
    }
  });
});

// ── rule 10 ──────────────────────────────────────────────────────────────────

test.describe('refusing beats guessing', () => {
  test('"control 4 hata do aur control 9" removes nothing at all', () => {
    // A whole-message fallback for an unreadable split was tried on 29 Sep and
    // REVERTED: read whole, the verb sits immediately before the second box and
    // binds forward onto it, so seven plain two-part sentences acted on the
    // wrong box. Refusing cost only a re-type.
    const es = read('control 4 hata do aur control 9');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toContain('I can see Control 9, but not what to do with it');
  });

  test('"Control 4 ka naam hata do" is asked about, not acted on', () => {
    // HEADER OVER-PROMISES: the header says this one is "the imperative and
    // nothing else" and reaches the plain-removal branch. It does not — the
    // candidate name reads as "hata do", which carries an instruction, and a
    // message that also carries one is a genuine ambiguity, so the earlier
    // branch asks the question instead. Nothing is removed.
    const es = read('Control 4 ka naam hata do');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(refusal(es)).toContain('Did you want Control 4 renamed, or taken out?');
  });

  test('"Control 4 ka naam badal do" asks what to call it', () => {
    // The contrast that makes the test above make sense: same shape, but with
    // no instruction hiding in the candidate name, so the reader gets as far
    // as "I can see the box, I just have no name for it".
    const es = read('Control 4 ka naam badal do');
    expect(kinds(es)).toEqual(['nothing']);
    expect(leftOut(es)).toEqual([]);
    expect(renames(es)).toHaveLength(0);
    expect(refusal(es)).toContain('I can see Control 4, but not what to call it');
  });
});
