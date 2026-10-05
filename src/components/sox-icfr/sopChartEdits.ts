/**
 * READING A TYPED INSTRUCTION AGAINST THE FLOWCHART.
 *
 * The user's ask (29 Sep): "In the flowchart tab, there will be a preview and
 * an edit option. If the user clicks on the edit option, a chat box will appear
 * where the user can enter the prompt. Usmein jo bhi usko change karna hai, wo
 * change karne ka likh sakta hai and then it will be changed."
 *
 * There is no model behind this and none is pretended — the same position
 * `racmImport.readPromptRules` takes about the extraction prompt, and the same
 * one `controlChatIntents` takes about the control chat. What is read is a
 * short vocabulary, matched in order, and anything outside it is said to be
 * outside it rather than quietly dropped.
 *
 * THREE THINGS ARE READ (29 Sep, "upar wala + chhantna"): rename a box, take a
 * box out, narrow the whole chart. Nothing here deletes — a removal leaves the
 * row OUT of the import, it stays on the Matrix greyed, and a tick puts it back.
 *
 * ── THE RULES, AND THE SENTENCE BEHIND EACH ONE ──────────────────────────────
 *
 * Eight rounds of a ~200-phrase probe wrote this list. Every rule is here
 * because a real phrasing broke the version before it, and the first fix for
 * four of them broke something else. `tests/sop-chart-edits.spec.ts` is that
 * probe written down — one describe block per rule below, and it needs no
 * browser. Do not relax a rule without running it.
 *
 *   A NEGATIVE OBSERVATION IS NOT AN INSTRUCTION. "Control 7 does not run
 *   monthly", "Risk 2 has no owner", "preventive controls are not optional" all
 *   used to change the chart, because `no` / `not` / `never` counted as removal
 *   words. They are out of both vocabularies — not for a box, not for a class.
 *   A box beside a chart is where a reviewer writes what is WRONG with a
 *   control, and almost every such note is phrased negatively.
 *
 *   …EXCEPT WHERE THE NEGATION IS THE WHOLE INSTRUCTION. Two shapes earn it
 *   back, because in both the negative word is doing the asking rather than
 *   describing. "no manual controls" narrows, when the negation sits directly
 *   on the class, the phrase ends there, and no box is named in the sentence —
 *   see `ruledOutPlainly`. And a negation immediately in front of a removal
 *   verb CANCELS it: "do not remove control 9, remove control 4" once took out
 *   Control 9, the box the sentence is protecting in as many words.
 *
 *   THE VERB PICKS THE BOX, NOT THE WORD ORDER. "Control 9 is fine, but remove
 *   Control 4" used to take out Control 9 — the first number won. The box
 *   nearest the removal verb is the one that goes; the same walk picks the box
 *   for a rename, and "X ko … kar do" carries its own mark so that the
 *   commonest rename phrasing of all does not fall back to the first number.
 *
 *   A CAP IS ABOUT WHAT IS LEFT. "control 4 hata do aur at most 6 controls"
 *   asks for six and left five: the cap kept the first six of all nine and the
 *   removal came off the top of that. Narrowing halves are read last, against
 *   the rows still standing, whichever end of the message they were typed at.
 *
 *   A QUOTED NAME IS A NAME, WHATEVER IS IN IT. `rename Control 4 to "Remove
 *   duplicate check"` used to DELETE Control 4, and `rename risk 1 to "Vendor
 *   and supplier onboarding"` was refused with "put the name in quotes" — while
 *   in quotes. Quotes say where the name ends, so the guards that stop a
 *   sentence being swallowed as a title apply only to an UNQUOTED one.
 *
 *   AN UNQUOTED ONE-WORD NAME AFTER "ko … karo" IS A VERB. "Control 4 ko theek
 *   karo", "Risk 2 ko review karo", "Control 4 ko key bana do" renamed the box
 *   to "theek" / "review" / "key" — the last being a request to change a FIELD,
 *   answered by destroying the title. Without an explicit rename word, a new
 *   name must be quoted or at least two words long.
 *
 *   A TERM WITH ALTERNATIVES IN IT MUST BE GROUPED. `\bdetective|detect\w*\b…`
 *   parsed as `\bdetective` OR the rest, so "detective controls hata do" KEPT
 *   the detective controls. Every interpolation is `(?:…)`, and the type filter
 *   reads "only" before "not" exactly as the nature filter does — reading them
 *   the other way round inverted "only preventive controls, no exceptions".
 *
 *   A NARROWING NEEDS A NARROWING WORD, A CAP NEEDS A CAP WORD. "I count 3
 *   controls here" is not a request for three.
 *
 * TWO INSTRUCTIONS IN ONE MESSAGE are read as two — the split never cuts inside
 * a quoted run, and "Control 4 and Control 5 hata do" carries one verb across
 * both, while "Control 9 is fine, but remove Control 4" does not, because there
 * the two boxes are not joined by a conjunction alone. If a half cannot be
 * read, NEITHER is applied: half an edit, silently, is worse than none.
 */
import type { ImportRow } from './racmImport';
import type { ControlType, Nature } from './types';

/** A box on the chart, as the reader may refer to it. */
export interface ChartNode {
  /** The number printed on the box — Risk 2, Control 4. 1-based. */
  no: number;
  /** What a rename is stored against: a risk key, or a control's source ID. */
  ref: string;
  /** The ID shown on the box, e.g. `R-01` or `ALT-P2P-R01-C01`. */
  id: string;
  title: string;
  /** The draft rows behind the box. */
  rowKeys: string[];
}

export interface ChartFacts {
  risks: ChartNode[];
  controls: ChartNode[];
  /** Rows still going in, for the narrowing to read. */
  rows: ImportRow[];
}

export type ChartEdit =
  | { kind: 'rename'; what: 'risk' | 'control'; ref: string; from: string; to: string; said: string[] }
  /** `whole` marks a narrowing, which decided about EVERY row — so nothing in
   *  the message was left unread and the unread-half notice must stand down. */
  | { kind: 'leave-out'; rowKeys: string[]; said: string[]; whole?: boolean }
  /** `benign` marks a refusal that is not a failure — "it is already called
   *  that" — so it never vetoes the other half of a two-part message. */
  | { kind: 'nothing'; text: string; benign?: boolean };

// ── the vocabulary ────────────────────────────────────────────────────────────

const ONLY = "only|just|exclusively|alone|sirf|keval|kewal|bas";

/** What rules out a CLASS of controls — "manual controls hata do". Imperatives
 *  only: see the file header on why `no` / `not` / `never` are not here. */
const NOT = "exclude|excluding|skip|without|omit|drop|remove|delete|hata\\w*|hta\\w*|nikaal\\w*|nikal\\w*|chhod\\w*|chod\\w*|mat";

/**
 * A negation sitting directly in front of a removal verb CANCELS it.
 *
 * "do not remove control 9, remove control 4" used to take out Control 9: the
 * `remove` inside "do not remove" is a real marker sitting right against that
 * box, and nothing read the word that undoes it. This is the one place `not`
 * belongs in the vocabulary — it is not being read as an instruction here, it
 * is being read as the cancellation of one, which is the opposite job.
 *
 * `nahi chahiye` and `mat rakho` are whole removal verbs in their own right, so
 * their negative word is INSIDE the match and never in front of it — "control 4
 * nahi chahiye" is still a removal. "mat hatao" is not: there the `mat` sits in
 * front of `hatao` and cancels it, which is exactly what it means.
 */
const NEGATION = "do\\s+not|does\\s+not|don'?t|doesn'?t|dont|never|not|nahin?|mat|kabhi\\s+nahin?";

/** What takes ONE box off the chart. Imperatives only, same reason. */
const REMOVE_VERBS =
  "remove|delete|drop|exclude|omit|get\\s+rid\\s+of|take\\s+[^.\\n]{0,30}?\\bout|"
  + "hata\\s*d(?:o|ijiye(?:ga)?|e)|hatao|hata\\s*den|hatana|hataiye|hta\\s*do|htao|"
  + "nikaal\\s*d(?:o|ijiye(?:ga)?|e)|nikal\\s*d(?:o|ijiye(?:ga)?|e)|nikaalo|nikalo|"
  + "chhod\\s*d(?:o|ijiye)|chod\\s*d(?:o|ijiye)|nahi\\s*chahiye|mat\\s*rakho";

/** How far from a box's own name a removal verb still counts as aimed at it.
 *  Wide enough for "Control 4 — the vendor master one — hata do"; the verb no
 *  longer has to be the only thing deciding WHICH box, so width is cheap. */
const NEAR = 60;

const RENAME_WORDS = /\b(?:rename|re-?name|re-?title|re-?label|naam|name|title|call\s+it|kehlaye)\b/i;
/**
 * "Change Control 3 to X" — plain English with no rename word in it (5 Oct).
 * Read like "X ko … kar do": it asks for a rename, but a one-word name must be
 * quoted, so "change control 3 to monthly" is asked about, never applied.
 */
const CHANGE_RENAME = /\b(?:change|update|switch)\b[^\n]{0,80}\bto\b/i;

/**
 * A box named by position or number — "the first risk", "2nd control",
 * "control number 4", "risk #2" (5 Oct). "Rename the first risk to Vendor
 * fraud" used to get "I couldn't place that": only "Risk 1" was a box.
 */
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
const ORDINAL_WORD = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|\\d{1,2}(?:st|nd|rd|th)';
const BOX_NO = '\\s*(?:#|number\\s*|no\\.?\\s*)?\\s*';
const NAMES_A_BOX = new RegExp(`\\b(?:risk|control)${BOX_NO}\\d{1,2}\\b|\\b(?:${ORDINAL_WORD})\\s+(?:risk|control)\\b`, 'i');

/** Things this box cannot do, asked in plain English — said, not "couldn't place". */
const ADD_ASK = /\b(?:add|insert|create|new)\b[^.\n]{0,30}\b(?:risks?|controls?|steps?|stages?|box(?:es)?)\b/i;
const STEP_ASK = /\b(?:steps?|stages?)\b/i;
/** "X ko Y kar do" names no act at all and is the commonest phrasing there is —
 *  but on its own it also covers "X ko theek karo", so a name arriving this way
 *  must be quoted or at least two words. See `newNameIn`. */
const HINDI_RENAME = /\bko\b[^\n]{0,80}\b(?:kar\s*do|kardo|karo|bana\s*do|banado|bana\s*dijiye|rakh\s*do|likh\s*do)\b/i;

const MAX_NAME = 60;
/** Applied to an UNQUOTED candidate only. Quotes say where the name ends. */
const NAME_CARRIES_INSTRUCTION = new RegExp(`\\b(?:${REMOVE_VERBS})\\b|\\b(?:aur|and|then|phir)\\b`, 'i');

const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const NATURE_TERM: Record<Nature, string> = {
  Manual: 'manual\\w*',
  Automated: 'automat\\w*',
  'IT-dependent': 'it[\\s.-]?dependent\\w*|itdm|semi[\\s-]?automated',
};
const TYPES: ControlType[] = ['Preventive', 'Detective'];
const TYPE_TERM: Record<string, string> = { Preventive: 'preventive|prevent\\w*', Detective: 'detective|detect\\w*' };

const narrowedTo = (p: string, term: string): boolean =>
  new RegExp(`\\b(?:${ONLY})\\b[^.\n]{0,24}\\b(?:${term})\\b`, 'i').test(p)
  || new RegExp(`\\b(?:${term})\\b[^.\n]{0,24}\\b(?:${ONLY}|hi)\\b`, 'i').test(p);

const ruledOut = (p: string, term: string): boolean =>
  new RegExp(`\\b(?:${NOT})\\b[^.\n]{0,24}\\b(?:${term})\\b`, 'i').test(p)
  || new RegExp(`\\b(?:${term})\\b[^.\n]{0,24}\\b(?:${NOT})\\b`, 'i').test(p);

/**
 * "no manual controls" — the one negative that IS an instruction.
 *
 * `no` and `not` are out of the vocabulary because a box beside a chart is
 * where a reviewer writes what is WRONG with a control, and almost every such
 * note is phrased negatively: "Risk 2 has no owner", "Control 7 does not run
 * monthly", "preventive controls are not optional" all used to edit the chart.
 * Losing this phrasing with them was a real cost — it is how people actually
 * ask for a class to go.
 *
 * It comes back under three conditions together, which is what tells the ask
 * from the note. The negation sits DIRECTLY on the class, so "…are not
 * optional" — where the negation lands on a predicate instead — is untouched.
 * The phrase ENDS there, so "no manual controls have been tested yet" stays an
 * observation. And `readNarrowing`'s caller requires no box number anywhere in
 * the sentence, because a negative about one box is a note about that box.
 */
const ruledOutPlainly = (p: string, term: string): boolean =>
  new RegExp(
    `\\b(?:no|not|koi)\\s+(?:${term})\\s+controls?\\s*`
    + `(?:[.,;!?]|$|\\b(?:please|plz|pls|at\\s+all|thanks?|chahiye|rakhna|rakho|hone?\\s*chahiye)\\b)`,
    'i',
  ).test(p);

// ── names ─────────────────────────────────────────────────────────────────────

const cleanName = (s: string): string =>
  s
    .replace(/^[\s:;,—–\-→=]+/, '')
    .replace(/^(?:ko|se|as|to|be|is|badal\s*do|badlo|badal|change(?:d)?|rakho|rakh\s*do|set|kar\s*do|karo|likho|likh\s*do)\b[\s:;,—–\-→=]*/i, '')
    .replace(/\s*\b(?:kar\s*do|kardo|karo|kar\s*dijiye(?:ga)?|kar\s*den|kr\s*do|bana\s*do|bana\s*dijiye|badal\s*do|badlo|rakho|rakh\s*do|rakhna\s*hai|likh\s*do|hi|please|plz|pls|thanks?)\b[\s.!,]*$/i, '')
    .replace(/^["“”'‘’\s]+|["“”'‘’\s.,;]+$/g, '')
    .trim();

const QUOTED = /["“”'‘’]([^"“”'‘’\n]{2,90})["“”'‘’]/g;
const quoted = (raw: string): string[] =>
  [...raw.matchAll(QUOTED)].map(m => cleanName(m[1]!)).filter(Boolean);

/**
 * The name the message is asking for, or why it is not one.
 *
 * `strict` is on when no explicit rename word was used — "Control 4 ko theek
 * karo" reaches here as the candidate "theek", which is a verb and not a name.
 */
function newNameIn(raw: string, targetTitle: string, strict: boolean): { name: string } | { refuse: string } | null {
  const qs = quoted(raw).filter(q => q.toLowerCase() !== targetTitle.toLowerCase());
  const fromQuotes = qs.length > 0;
  const pick = fromQuotes
    ? qs[qs.length - 1]!
    : (() => {
      // An arrow, then "to", say where the name starts more surely than "name"
      // does: "change the name of Control 3 to X" is X, not "of Control 3 to X".
      const m = /(?:→|->|=>)\s*([^\n]{2,90})$/i.exec(raw.trim())
        ?? /\bto\s+([^\n]{2,90})$/i.exec(raw.trim())
        ?? /(?:→|->|=>|=|:|—|–|\bto\b|\bnaam\b|\bname\b|\btitle\b|\bko\b|\bas\b)\s+([^\n]{2,90})$/i.exec(raw.trim());
      return m ? cleanName(m[1]!) : '';
    })();

  if (!pick || /^(?:risk|control)\s*\d*$/i.test(pick)) return null;
  if (pick.length > MAX_NAME) {
    return { refuse: `That name runs to ${pick.length} characters — put the new name in quotes so I can see where it ends.` };
  }
  // A quoted run cannot swallow the rest of the sentence, so neither guard has
  // a job on it: "Remove duplicate check" and "Vendor and supplier onboarding"
  // are ordinary control names.
  if (!fromQuotes) {
    if (NAME_CARRIES_INSTRUCTION.test(pick)) {
      return { refuse: `I read the new name as "${pick}", which has an instruction in it. Put the name in quotes, or send the two changes separately.` };
    }
    if (strict && !/\s/.test(pick)) {
      return { refuse: `Did you mean to rename it to "${pick}"? One word on its own reads like an instruction — put the new name in quotes if that is what you meant.` };
    }
  }
  return { name: pick };
}

// ── finding the box being talked about ────────────────────────────────────────

interface Cand { what: 'risk' | 'control'; node: ChartNode; at: number; end: number }
interface OutOfRange { what: 'risk' | 'control'; asked: number; have: number }

/** Every box the message refers to, in the order they are written. */
function candidates(raw: string, facts: ChartFacts): { hits: Cand[]; miss: OutOfRange | null } {
  // Numbers and IDs are hunted OUTSIDE quoted runs: `Control 7 ka naam "Control
  // 4 exception review" kar do` names Control 7 and proposes a title that
  // happens to contain "Control 4". Blanked rather than removed, so every index
  // still lines up with the text the reader typed. The by-name search below
  // reads the quotes on purpose and so keeps the original.
  const t = raw.toLowerCase().replace(QUOTED, m => ' '.repeat(m.length));
  const hits: Cand[] = [];
  let miss: OutOfRange | null = null;

  const byNo = (word: string, list: ChartNode[], what: 'risk' | 'control') => {
    for (const m of t.matchAll(new RegExp(`\\b${word}${BOX_NO}(\\d{1,2})\\b`, 'gi'))) {
      const node = list.find(n => n.no === Number(m[1]));
      if (node) hits.push({ what, node, at: m.index, end: m.index + m[0].length });
      else miss ??= { what, asked: Number(m[1]), have: list.length };
    }
    // "the first risk", "2nd control", "the last control".
    for (const m of t.matchAll(new RegExp(`\\b(${ORDINAL_WORD})\\s+${word}\\b`, 'gi'))) {
      const w = m[1]!.toLowerCase();
      const no = w === 'last' ? Math.max(0, ...list.map(n => n.no)) : ORDINALS[w] ?? parseInt(w, 10);
      const node = list.find(n => n.no === no);
      if (node) hits.push({ what, node, at: m.index, end: m.index + m[0].length });
      else miss ??= { what, asked: no, have: list.length };
    }
  };
  byNo('risk', facts.risks, 'risk');
  byNo('control', facts.controls, 'control');

  const all = [
    ...facts.risks.map(n => ({ what: 'risk' as const, node: n })),
    ...facts.controls.map(n => ({ what: 'control' as const, node: n })),
  ];

  // Longest ID first, so a full ID is not eaten by the short code inside it.
  for (const x of [...all].sort((a, b) => b.node.id.length - a.node.id.length)) {
    if (!x.node.id) continue;
    const at = t.indexOf(x.node.id.toLowerCase());
    if (at >= 0 && !hits.some(h => h.node === x.node)) hits.push({ ...x, at, end: at + x.node.id.length });
  }

  // By name — only when nothing more exact was found. A name has to be quoted,
  // or long enough that finding it in the sentence means something.
  if (!hits.length) {
    const names = quoted(raw).map(n => n.toLowerCase());
    const hunt = names.length ? names : [raw.toLowerCase()];
    const byName = all
      .filter(x => x.node.title.length >= 6 && hunt.some(h => h.includes(x.node.title.toLowerCase())))
      .sort((a, b) => b.node.title.length - a.node.title.length)[0];
    if (byName) {
      const at = Math.max(0, raw.toLowerCase().indexOf(byName.node.title.toLowerCase()));
      hits.push({ ...byName, at, end: at + byName.node.title.length });
    }
  }

  hits.sort((a, b) => a.at - b.at);
  return { hits, miss };
}

const REMOVE_RE = new RegExp(`\\b(?:${REMOVE_VERBS})\\b`, 'gi');
const RENAME_MARK = /\b(?:rename|re-?name|re-?title|re-?label|naam|name|title|call\s+it|kehlaye|change|update|switch)\b|→|->|=>/gi;

/**
 * The `ko` of "X ko … kar do", as a rename marker in its own right.
 *
 * The rename branch picks its box by walking out from the nearest rename mark,
 * exactly as the removal branch does — but this phrasing, the commonest rename
 * there is, carries no `rename` / `naam` / `→` for that walk to measure from,
 * so it used to fall through to "the first box named". The first box named is
 * almost always the one being PROTECTED: `Control 9 theek hai, Control 4 ko "X"
 * kar do` renamed Control 9. A wrong removal is one tick away on the Matrix; a
 * wrong rename has only Undo.
 *
 * The mark is the `ko` alone — a lookahead, so the span does not swallow the
 * tail of the sentence — and Hindi puts the object in front of it, which
 * `nearestTo` already knows how to score.
 */
const HINDI_RENAME_MARK =
  /\bko\b(?=[^\n]{0,80}\b(?:kar\s*do|kardo|karo|bana\s*do|banado|bana\s*dijiye|rakh\s*do|likh\s*do)\b)/gi;

/** Where each instance of a marker sits, as [start, end]. */
const marksOf = (raw: string, re: RegExp): [number, number][] =>
  [...raw.matchAll(new RegExp(re.source, 'gi'))].map(m => [m.index, m.index + m[0].length]);

/**
 * Removal verbs the message actually means — see `NEGATION`.
 *
 * A short window is enough: the negation has to sit AGAINST the verb to cancel
 * it. "I would not want to remove Control 4 without asking" is not covered and
 * should not be; that is a sentence for a person, not this vocabulary.
 */
const NEGATED = new RegExp(`\\b(?:${NEGATION})\\s*$`, 'i');
const removalMarks = (raw: string): [number, number][] =>
  marksOf(raw, REMOVE_RE).filter(([s]) => !NEGATED.test(raw.slice(Math.max(0, s - 16), s)));

/**
 * A verb reaches FORWARD in English and BACKWARD in Hindi.
 *
 * "keep control 9, remove control 4" used to take out Control 9: the distance
 * was measured in both directions equally, and the box you name first — almost
 * always the one you are protecting — sat closer to the verb than its object.
 * English puts the object after the verb, so a box after the marker is preferred
 * outright; Hindi is verb-final, so a box before it still counts, just second.
 * When every candidate is behind the marker the bias cancels and the nearest
 * one wins, which is exactly what "control 9 rakho, control 4 hata do" needs.
 */
const BEHIND = 1000;

function nearestTo(hits: Cand[], marks: [number, number][]): Cand | null {
  if (!marks.length || !hits.length) return null;
  const dist = (c: Cand) => Math.min(...marks.map(([s, e]) =>
    // A marker that SPANS the box is aimed at it and nothing else — "take
    // control 4 out" wraps its object, and scoring that as "1000 behind"
    // stopped the phrase working at all.
    s <= c.at && e >= c.end ? 0
      : c.at >= e ? Math.min(c.at - e, BEHIND - 1)
        : Math.min(s - c.end, BEHIND - 1) + BEHIND));
  // HOW FAR decides, and only then WHICH SIDE. Sorting on the biased score let
  // a box five characters forward beat one a single character behind, so
  // "control 5 hata do, control 9 rakho, …" took out Control 9 — the box the
  // sentence protects. Distance first, forward as the tie-break, which is all
  // the bias was ever needed for.
  const clamped = (c: Cand) => (dist(c) >= BEHIND ? dist(c) - BEHIND : dist(c));
  const best = [...hits].sort((a, b) => clamped(a) - clamped(b) || dist(a) - dist(b))[0]!;
  // Clamped, not wrapped: `% BEHIND` accepted a box 1009 characters away
  // because 2009 % 1000 is 9.
  return clamped(best) <= NEAR ? best : null;
}

/**
 * Boxes written as a plain list, with one verb meant to reach all of them.
 *
 * Two things have to hold. Nothing but a conjunction may sit between two of
 * them — that is what tells "Control 4 and Control 5 hata do" apart from
 * "Control 9 is fine, but remove Control 4". And the verb must sit immediately
 * against one end of the list: "control 4, control 5, control 6 are fine, hata
 * do control 7" once removed the three boxes the sentence protects, because the
 * list was found and the verb was merely somewhere nearby.
 */
function boxList(raw: string, hits: Cand[]): Cand[] | null {
  if (hits.length < 2) return null;
  const chains: Cand[][] = [];
  for (const here of hits) {
    const chain = chains[chains.length - 1];
    const prev = chain?.[chain.length - 1];
    if (chain && prev && /^\s*(?:,|;|&|\+|\baur\b|\band\b)\s*(?:the\s+)?$/i.test(raw.slice(prev.end, here.at))) chain.push(here);
    else chains.push([here]);
  }
  const verbs = removalMarks(raw);
  // Only whitespace and punctuation may stand between the verb and the list.
  // The side checks come FIRST. `slice(a, b)` with a > b returns '', and an
  // empty string passes `/^\W*$/` — so without them every verb anywhere in the
  // message "touched" every list, and "control 4, control 5, control 6 are
  // fine, hata do control 7" removed the three boxes it protects.
  // Punctuation, or one of the particles Hindi puts between a list and its
  // verb. `\W` alone killed "Control 4 aur Control 5 KO hata do" outright — an
  // ordinary phrasing, and the list vanished rather than half-applying.
  const JOIN = /^(?:\W+|\b(?:ko|dono|sab|sabhi|inko|unko|in|un|ye|yeh|both|all|these|them|the)\b)*$/i;
  const touching = (chain: Cand[]) => verbs.some(([s, e]) =>
    // Or the verb wraps the whole list, as `take … out` does.
    (s <= chain[0]!.at && e >= chain[chain.length - 1]!.end)
    || (e <= chain[0]!.at && JOIN.test(raw.slice(e, chain[0]!.at)))
    || (s >= chain[chain.length - 1]!.end && JOIN.test(raw.slice(chain[chain.length - 1]!.end, s))));
  // A chain stops where a box is being protected: "remove control 4 and remove
  // control 5, control 9 stays" joined Control 9 on the comma and took it out.
  const trimmed = chains.map(c => {
    // `bounded` for the same reason the notice needs it: with no punctuation
    // the "clause" is the whole message, and one "rakho" at the end trimmed
    // every member — "control 4 aur control 5 ko hata do control 9 rakho" did
    // nothing at all. Both readings of PROTECTED now agree.
    const keep = c.filter(m => !(protectedIn(clauseAround(raw, m)) && bounded(raw, m)));
    return keep.length === c.length ? c : keep;
  });
  return trimmed.find(c => c.length > 1 && touching(c)) ?? null;
}

// ── narrowing ─────────────────────────────────────────────────────────────────

interface Narrowing {
  keyOnly: boolean;
  natures: Nature[];
  types: ControlType[];
  limit: number | null;
  said: string[];
}

export function readNarrowing(raw: string): Narrowing {
  const p = ` ${raw} `;
  const said: string[] = [];

  // A sentence that names a box is a note ABOUT that box, so the plain negative
  // stands down in it entirely. See `ruledOutPlainly`.
  const aboutOneBox = NAMES_A_BOX.test(raw);
  const out = (term: string) => ruledOut(p, term) || (!aboutOneBox && ruledOutPlainly(p, term));

  const keyOnly = narrowedTo(p, 'key') || ruledOut(p, 'non[\\s-]?key');
  if (keyOnly) said.push('key controls only');

  // "only" is read before "not", on both filters. Reading them the other way
  // round made "only preventive controls, no exceptions" keep the detective
  // ones — see the file header.
  const onlyNatures = NATURES.filter(n => narrowedTo(p, NATURE_TERM[n]));
  const outNatures = NATURES.filter(n => !onlyNatures.includes(n) && out(NATURE_TERM[n]));
  const keptNatures = onlyNatures.length ? onlyNatures : NATURES.filter(n => !outNatures.includes(n));
  if (onlyNatures.length && onlyNatures.length < NATURES.length) said.push(`${onlyNatures.map(n => n.toLowerCase()).join(' and ')} controls only`);
  else if (outNatures.length && outNatures.length < NATURES.length) said.push(`no ${outNatures.map(n => n.toLowerCase()).join(' or ')} controls`);

  const onlyTypes = TYPES.filter(t => narrowedTo(p, TYPE_TERM[t]!));
  const outTypes = TYPES.filter(t => !onlyTypes.includes(t) && out(TYPE_TERM[t]!));
  const types = onlyTypes.length === 1 ? [onlyTypes[0]!]
    : outTypes.length === 1 ? [TYPES.find(t => t !== outTypes[0])!]
      : [];
  if (types.length) said.push(`${types[0]!.toLowerCase()} controls only`);

  const cap = /\b(?:at most|no more than|not more than|up to|maximum(?:\s+of)?|max|zyada\s*se\s*zyada|sirf|keval|only|just)\s+(\d{1,2})\s+controls?\b/i.exec(raw)
    ?? /\b(\d{1,2})\s+controls?\s+(?:hi\s+)?(?:rakho|rakhna|rakh\s*do|keep|only|hi)\b/i.exec(raw);
  const limit = cap ? Number(cap[1]) : null;
  if (limit !== null) said.push(`at most ${limit} ${limit === 1 ? 'control' : 'controls'}`);

  return {
    keyOnly,
    natures: keptNatures.length < NATURES.length ? keptNatures : [],
    types,
    limit,
    said,
  };
}

/**
 * Which rows a narrowing puts out of the import.
 *
 * Reads the PARSED fields, not the file's raw cells: a client whose type column
 * says "P" and "D" would otherwise have every row dropped by "preventive only".
 *
 * `gone` is what the REST of the message already took out. A cap is a statement
 * about what is left on the chart, so it has to be counted against the rows
 * still standing — "control 4 hata do aur at most 6 controls" asks for six and
 * used to leave five, because the cap kept the first six of all nine and the
 * removal was then taken off the top of that.
 */
function rowsFailing(rows: ImportRow[], n: Narrowing, gone: ReadonlySet<string>): string[] {
  const live = rows.filter(r => !gone.has(r.key));
  const kept = live.filter(r =>
    (!n.keyOnly || r.isKey)
    && (!n.natures.length || (r.nature !== null && n.natures.includes(r.nature)))
    && (!n.types.length || (r.type !== null && n.types.includes(r.type))));
  const capped = n.limit === null ? kept : kept.slice(0, n.limit);
  const keep = new Set(capped.map(r => r.key));
  return live.filter(r => !keep.has(r.key)).map(r => r.key);
}

// ── the reader ────────────────────────────────────────────────────────────────

const CAPABILITIES =
  'I can rename a box ("rename the first risk to Vendor fraud", "Risk 2 ka naam Duplicate invoice paid kar do"), '
  + 'take one out ("remove control 4", "Control 4 hata do"), '
  + 'or narrow the whole chart ("only key controls", "manual controls hata do", "at most 6 controls").';

const noun = (what: 'risk' | 'control') => (what === 'risk' ? 'Risk' : 'Control');

/**
 * The clause a box sits in — comma to comma.
 *
 * A ±60-character window WAS the whole message on a typical chat line, so one
 * "keep" anywhere suppressed every notice in it: "remove control 4, keep
 * control 9, remove control 5" dropped Control 5's removal in silence because
 * Control 9 was being kept three words away. A clause is the smallest unit that
 * can protect a box, and the only one that can protect only that box.
 */
const BREAK = /[,;.!?\n]/g;
const clauseAround = (text: string, h: Cand): string => {
  const marks = [...text.matchAll(BREAK)].map(m => m.index);
  const from = marks.filter(i => i < h.at).pop();
  const to = marks.find(i => i >= h.end);
  return text.slice(from === undefined ? 0 : from + 1, to ?? text.length);
};

/** Is that clause actually a clause, or the whole message wearing the name? */
const bounded = (text: string, h: Cand): boolean => clauseAround(text, h).length < text.length;

/** Said of a box the reader is keeping, not asking about. */
const PROTECTED = /\b(?:fine|ok|okay|correct|right|good|stay|stays|keep|keeping|leave|theek|thik|sahi|rakho|rakhna|rehne\s*do|rehne|chhod\s*do|dekh\s*lo|dekho|mat\s*hatao|agrees?|questioned)\b/i;

/** A removal verb that was cancelled protects its box exactly as "keep" does —
 *  "do not remove Control 9" is a protection written as a negated imperative,
 *  and the word list above has no shape for that. */
const NEGATED_REMOVE = new RegExp(`\\b(?:${NEGATION})\\s+(?:${REMOVE_VERBS})\\b`, 'i');

const protectedIn = (clause: string): boolean => PROTECTED.test(clause) || NEGATED_REMOVE.test(clause);

const leaveOut = (c: Cand): ChartEdit => ({
  kind: 'leave-out',
  rowKeys: c.node.rowKeys,
  said: [`${noun(c.what)} ${c.node.no} left out${c.what === 'risk' ? ' with its controls' : ''}`],
});

function readOne(raw: string, facts: ChartFacts, gone: ReadonlySet<string>): ChartEdit[] {
  const text = raw.trim();
  if (!text) return [{ kind: 'nothing', text: CAPABILITIES }];

  const { hits, miss } = candidates(text, facts);
  const explicitRename = RENAME_WORDS.test(text) || /(?:→|->|=>)/.test(text);
  const asked = explicitRename || HINDI_RENAME.test(text) || CHANGE_RENAME.test(text);

  const removal = nearestTo(hits, removalMarks(text));
  // The rename branch picks its own box the same way the removal branch does.
  // Taking `hits[0]` renamed Control 9 in "Control 9 is fine, rename Control 4
  // to …" — and a wrong rename, unlike a wrong removal, has no tick to undo it.
  // "X ko … kar do" carries its own mark, or this walk has nothing to measure
  // from and falls back to the first box named, which is the protected one.
  const renaming = nearestTo(hits, [...marksOf(text, RENAME_MARK), ...marksOf(text, HINDI_RENAME_MARK)])
    ?? hits[0];

  // 1 — rename. Read before the removal so a quoted name wins: `rename Control
  //     4 to "Remove duplicate check"` is a name, not a request to remove it.
  if (asked && renaming) {
    const got = newNameIn(text, renaming.node.title, !explicitRename);
    if (got && 'name' in got) {
      if (got.name.toLowerCase() === renaming.node.title.toLowerCase()) {
        return [{ kind: 'nothing', benign: true, text: `${noun(renaming.what)} ${renaming.node.no} is already called that.` }];
      }
      return [{
        kind: 'rename',
        what: renaming.what,
        ref: renaming.node.ref,
        from: renaming.node.title,
        to: got.name,
        said: [`${noun(renaming.what)} ${renaming.node.no} → ${got.name}`],
      }];
    }
    // A candidate name that cannot be used is a QUESTION, never a licence to
    // remove the box instead. "rename Control 4 to Remove duplicate check"
    // (unquoted) used to delete Control 4 because a removal verb was in the
    // sentence — the sentence the reviewer wrote to rename it.
    // A candidate that reads like an instruction, in a message that also
    // carries one, is a genuine ambiguity — so it is asked as one rather than
    // read back as an absurd title.
    if (got && removal && NAME_CARRIES_INSTRUCTION.test(text)) {
      return [{
        kind: 'nothing',
        text: `Did you want ${noun(removal.what)} ${removal.node.no} renamed, or taken out? Put the new name in quotes to rename it, or say "${noun(removal.what)} ${removal.node.no} hata do" to take it out.`,
      }];
    }
    if (got) return [{ kind: 'nothing', text: got.refuse }];
    // Nothing that could be a name at all — no quotes, and nothing after a
    // rename marker to read as one. "Control 4 ka naam badal do" reaches here
    // and is the imperative; "Control 4 ka naam hata do" does NOT, because
    // "hata do" is itself a candidate name carrying an instruction, so the
    // ambiguity branch above asks the question first. Both answers are right.
    if (removal) return [leaveOut(removal)];
    return [{ kind: 'nothing', text: `I can see ${noun(renaming.what)} ${renaming.node.no}, but not what to call it. Put the new name in quotes, or after "to".` }];
  }

  // 2 — take one box out.
  if (removal) return [leaveOut(removal)];
  const first = hits[0];

  // 4 — narrow the whole chart.
  const narrowing = readNarrowing(text);
  if (narrowing.said.length) {
    const out = rowsFailing(facts.rows, narrowing, gone);
    const live = facts.rows.length - gone.size;
    if (live > 0 && out.length === live) {
      return [{ kind: 'nothing', text: `That would take every control off the chart — ${narrowing.said.join(', ')} leaves nothing. Narrow it less, or say which boxes to take out.` }];
    }
    return [{ kind: 'leave-out', rowKeys: out, said: narrowing.said, whole: true }];
  }

  if (miss) {
    const have = `${miss.have} ${miss.have === 1 ? miss.what : `${miss.what}s`}`;
    return [{ kind: 'nothing', text: `There is no ${miss.what} ${miss.asked} — this chart has ${have}.` }];
  }
  // Asks this box cannot carry out, answered as what they are.
  if (ADD_ASK.test(text)) {
    return [{ kind: 'nothing', text: 'I can\'t add a box here — the chart is drawn from the SOP\'s own controls. Once the RACM is imported, add a control to it in the spreadsheet editor.' }];
  }
  if (!first && STEP_ASK.test(text)) {
    return [{ kind: 'nothing', text: `The process steps come straight from the SOP, so I can't change them here — only the risk and control boxes. ${CAPABILITIES}` }];
  }
  if (first) {
    return [{ kind: 'nothing', text: `I can see ${noun(first.what)} ${first.node.no}, but not what to do with it. ${CAPABILITIES}` }];
  }
  return [{ kind: 'nothing', text: `I couldn't place that. ${CAPABILITIES}` }];
}

/** Does this fragment carry an instruction of its own — a box, or a narrowing? */
const readable = (s: string, facts: ChartFacts): boolean =>
  NAMES_A_BOX.test(s)
  || [...facts.risks, ...facts.controls].some(n => n.id && s.toLowerCase().includes(n.id.toLowerCase()))
  || readNarrowing(s).said.length > 0;

/**
 * A half that narrows the WHOLE chart rather than naming a box.
 *
 * Told apart the same way `readable` tells a readable half from an unreadable
 * one: a narrowing word, and no box named anywhere in it.
 */
const isWholeChart = (s: string, facts: ChartFacts): boolean =>
  readNarrowing(s).said.length > 0
  && !NAMES_A_BOX.test(s)
  && ![...facts.risks, ...facts.controls].some(n => n.id && s.toLowerCase().includes(n.id.toLowerCase()));

/**
 * The halves, read one after another, each told what the ones before it took.
 *
 * NARROWINGS GO LAST, whatever order they were typed in. A cap is a statement
 * about what is LEFT on the chart, so it cannot be settled until the rest of
 * the message has had its say — "at most 6 controls aur control 4 hata do"
 * means the same six as "control 4 hata do aur at most 6 controls", and both
 * used to leave five. The receipts come back in this order too, which is also
 * the order they happened in.
 */
function readInTurn(parts: string[], facts: ChartFacts): ChartEdit[] {
  const ordered = [...parts.filter(p => !isWholeChart(p, facts)), ...parts.filter(p => isWholeChart(p, facts))];
  const gone = new Set<string>();
  const out: ChartEdit[] = [];
  for (const p of ordered) {
    const got = readOne(p, facts, gone);
    for (const e of got) if (e.kind === 'leave-out') for (const k of e.rowKeys) gone.add(k);
    out.push(...got);
  }
  return out;
}

/** Split on a conjunction, but never inside a quoted run — a name may contain
 *  one, and cutting there would refuse a perfectly good rename. */
function halves(text: string): string[] {
  const runs: string[] = [];
  // A private-use codepoint, so the placeholder cannot collide with anything a
  // reviewer types and carries no word boundary for the split to find.
  const masked = text.replace(QUOTED, m => { runs.push(m); return `\uE000${runs.length - 1}\uE001`; });
  return masked
    .split(/\s*(?:\baur\b|\band\b|\bthen\b|\bphir\b|;)\s*/i)
    .map(s => s.replace(/\uE000(\d+)\uE001/g, (_, i) => runs[Number(i)]!).trim())
    .filter(Boolean);
}

/**
 * Everything one message asks for.
 *
 * If any half cannot be read, NOTHING is applied and that half's reason comes
 * back alone — except a benign refusal ("it is already called that"), which is
 * not a failure and never vetoes its sibling.
 */
export function readChartEdits(raw: string, facts: ChartFacts): ChartEdit[] {
  const text = String(raw ?? '').trim();
  if (!text) return [{ kind: 'nothing', text: CAPABILITIES }];

  // A plain list of boxes under one verb is read BEFORE the message is cut on
  // its conjunctions — "remove Control 4 and Control 5" would otherwise be split
  // into a verb and a bare noun, and the bare half vetoes the whole thing.
  const { hits } = candidates(text, facts);
  if (!RENAME_WORDS.test(text) && !HINDI_RENAME.test(text) && !CHANGE_RENAME.test(text)) {
    const list = boxList(text, hits);
    if (list) return list.map(leaveOut);
  }

  const parts = halves(text);
  // A split that does not read is REFUSED, never quietly re-read as one
  // sentence. Falling back to the whole text was tried (29 Sep) and it made
  // "control 4 hata do aur control 9" remove Control 9: read whole, the verb
  // sits immediately before the second box and binds forward onto it. Seven
  // plain two-part sentences acted on the wrong box that way, where refusing
  // had cost only a re-type. Doing nothing is a worse answer than the right
  // one and a far better answer than the wrong one.
  const edits = parts.length > 1 && parts.every(p => readable(p, facts))
    ? readInTurn(parts, facts)
    : readOne(text, facts, new Set());

  const blocking = edits.find(e => e.kind === 'nothing' && !e.benign);
  if (blocking) return [blocking];
  // A benign refusal is kept: the reviewer asked for two things, and "Risk 2 is
  // already called that" is the answer to one of them.
  const real = edits.filter(e => e.kind !== 'nothing' || e.benign);
  if (!real.some(e => e.kind !== 'nothing')) return real.length ? real : [edits[0]!];

  // No row is counted twice across a two-part message: "risk 2 hata do aur
  // control 3 hata do" reaches the same row through both halves.
  const seen = new Set<string>();
  const out = real.map(e => {
    if (e.kind !== 'leave-out') return e;
    const fresh = e.rowKeys.filter(k => !seen.has(k));
    e.rowKeys.forEach(k => seen.add(k));
    return { ...e, rowKeys: fresh };
  });

  /**
   * THE HALF THAT WENT NOWHERE.
   *
   * A reading this small will keep meeting sentences it only half understands —
   * "rename Control 4 to X, remove Control 9" reads the rename and never sees
   * the second clause; "remove control 4, keep control 9, remove control 5"
   * reads one of two removals. Every edit it DOES make prints a receipt with an
   * Undo on it, so a wrong one is a click from gone. What has no receipt is the
   * edit it never made, and an absence is the one thing nobody notices.
   *
   * So a box that was named and then not touched is said out loud. This is
   * cheaper than any parse fix and, unlike them, it holds for whatever the next
   * probe finds.
   */
  const touched = new Set(out.flatMap(e =>
    e.kind === 'rename' ? [e.ref] : e.kind === 'leave-out' ? e.rowKeys : []));
  // A narrowing decided about every row on the chart, so nothing was left
  // unread — and whether a box it KEPT looks "untouched" is an accident of the
  // data, not of the sentence.
  const narrowed = out.some(e => e.kind === 'leave-out' && e.whole);
  const ignored = narrowed ? [] : hits.filter(h =>
    !touched.has(h.node.ref) && !h.node.rowKeys.some(k => touched.has(k))
    // A box named to PROTECT it was read correctly. Saying "I didn't do
    // anything with Control 9" about "Control 9 is fine, remove Control 4" is
    // both true and useless, and a notice that fires on correct reads is one
    // nobody reads by the third time.
    // A "clause" that is the entire message protects nothing when several boxes
    // share it: one "rakho" at the end of "control 4 hata do control 5 hata do
    // control 9 rakho" silenced the notice for the removal that was skipped.
    // With no punctuation to divide them, the word belongs to whichever box it
    // sits beside, and the others are owed their notice.
    && !(protectedIn(clauseAround(text, h)) && (bounded(text, h) || hits.length === 1)));
  if (ignored.length) {
    const names = ignored.map(h => `${noun(h.what)} ${h.node.no}`);
    const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
    out.push({
      kind: 'nothing',
      text: `I didn't do anything with ${list} — send that part on its own and I'll read it.`,
    });
  }
  return out;
}
