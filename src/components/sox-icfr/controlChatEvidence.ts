import { requiredFilesOf } from './helpers';
import type { Control } from './types';

/**
 * Putting a pile of files where they belong.
 *
 * The reader drops six files on the chat and expects them on the right
 * attributes. Nothing in the product did this before — every uploader was one
 * picker per slot — so this is the mapper, kept out of the pane because it is
 * the part worth reading on its own.
 *
 * It scores, it does not guess silently. Every file comes back with the slot it
 * landed on AND the score that put it there, so the rail can show the reader
 * what it decided before anything is written. A mapper that files quietly and
 * is wrong is worse than no mapper: the auditor signs a paper saying this
 * evidence proves that attribute.
 *
 * The vocabulary is the product's own. Required-file labels are generated from
 * the attribute's wording by `EVIDENCE_FROM_WORDING` (helpers.ts) — "Signed
 * approval record", "System audit-trail extract" — so matching a filename back
 * onto a label is matching against the same words that made it.
 */

/** One place a file can go: this attribute's this required file. */
export interface EvidenceSlot {
  stepId: string;
  /** The attribute's code, e.g. R-04.1 — what the reader calls it. */
  code: string;
  fileId: string;
  label: string;
  /** Something is already uploaded here; a match would replace it. */
  taken: boolean;
}

export interface EvidenceMatch {
  name: string;
  slot: EvidenceSlot | null;
  /** 0-100. Under 30 the rail marks it a guess; 0 means it was not placed. */
  score: number;
  /** The reader moved this one by hand, so the score is no longer what put it
   *  here and must not be shown as if it were. */
  chosen?: boolean;
}

/** Words too common to carry a match on their own — every audit file is
 *  "evidence" of something, and half of them are dated "2026". */
const STOP = new Set(['the', 'and', 'for', 'from', 'with', 'file', 'files', 'doc', 'docs', 'document', 'final', 'copy', 'scan', 'new', 'old', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'fy26', 'fy25']);

const norm = (s: string): string =>
  s.toLowerCase().replace(/\.[a-z0-9]{1,5}$/, '').replace(/[^a-z0-9]+/g, ' ').trim();

const words = (s: string): string[] => norm(s).split(' ').filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));

/** Every slot on this control, or on one attribute. Filled ones are included —
 *  replacing a file is a real thing to want — but they score lower. */
export function evidenceSlots(control: Control, onlyStepId?: string): EvidenceSlot[] {
  return control.operating.steps
    .filter(s => !onlyStepId || s.id === onlyStepId)
    .flatMap(s => requiredFilesOf(s, control).map(f => ({
      stepId: s.id, code: s.code, fileId: f.id, label: f.label, taken: !!f.file,
    })));
}

/** How well one filename fits one slot. */
function score(name: string, slot: EvidenceSlot): number {
  const n = norm(name);
  let s = 0;
  // The attribute named outright — "R-04.1_approval.pdf". The strongest signal
  // there is, because the reader has already done the mapping by hand.
  const code = norm(slot.code);
  if (code && n.includes(code)) s += 60;
  // Then the label's own words. Jaccard over the words that carry meaning, so
  // "signed_approval_record_may.pdf" beats "approval_notes.pdf" on
  // "Signed approval record" without either being thrown away.
  const a = words(name);
  const b = words(slot.label);
  if (a.length && b.length) {
    const shared = a.filter(w => b.includes(w) || b.some(x => x.startsWith(w) || w.startsWith(x))).length;
    // Two halves, and the second is the heavier: what matters is how much of
    // the LABEL the filename accounts for. Overlap alone rewards a short name
    // that happens to share one word, and punishes a long descriptive one.
    if (shared > 0) s += Math.round(30 * (shared / new Set([...a, ...b]).size) + 45 * (shared / b.length));
  }
  // An empty slot is what the reader is trying to fill; a full one is a replace
  // and should not win a file off a slot that has nothing.
  if (slot.taken) s = Math.round(s * 0.5);
  return Math.min(100, s);
}

/**
 * Greedy one-to-one: the most confident pairing first, then the next, never
 * reusing a file or a slot. The same shape `racmImport.matchColumns` uses for
 * spreadsheet headers, and for the same reason — a file that fits two slots
 * should land on the one it fits best, not on whichever came first.
 *
 * Files that match nothing come back with `slot: null` rather than being
 * dropped. The reader has to be told what did not land.
 */
export function mapEvidence(control: Control, names: string[], onlyStepId?: string): EvidenceMatch[] {
  const slots = evidenceSlots(control, onlyStepId);
  const pairs = names.flatMap((name, ni) => slots.map((slot, si) => ({ ni, si, slot, s: score(name, slot) })))
    .filter(p => p.s > 0)
    .sort((x, y) => y.s - x.s || x.ni - y.ni || x.si - y.si);

  const takenFile = new Set<number>();
  const takenSlot = new Set<number>();
  const out: EvidenceMatch[] = names.map(name => ({ name, slot: null, score: 0 }));
  for (const p of pairs) {
    if (takenFile.has(p.ni) || takenSlot.has(p.si)) continue;
    takenFile.add(p.ni); takenSlot.add(p.si);
    out[p.ni] = { name: names[p.ni], slot: p.slot, score: p.s };
  }

  // Scoped to ONE attribute, the unmatched files still belong here — the reader
  // said so by pressing that attribute's own button. Audit evidence is rarely
  // named after what it proves ("Invoice-SKIE8PWJ-0007.pdf" against "Signed
  // approval record"), so a mapper that placed nothing would be a bulk upload
  // that does not upload. The leftovers are dealt onto the empty lines in order.
  //
  // How sure that is depends on whether there was a choice to get wrong: one
  // file and one empty line is the only place it could have gone, so it lands
  // at 35 and passes without comment. Two or more is an arbitrary order, so
  // they land at 15 and the reader is told each one is a guess — which is the
  // whole reason nothing is written until they have looked.
  //
  // Never across attributes: there the filename is all there is to go on, and a
  // file put against the wrong attribute is a working paper that says this
  // evidence proves something it does not.
  if (onlyStepId) {
    const empty = slots.map((slot, si) => ({ slot, si })).filter(x => !x.slot.taken && !takenSlot.has(x.si));
    const orphans = out.map((m, i) => ({ m, i })).filter(x => !x.m.slot);
    const sure = empty.length === 1 && orphans.length === 1;
    orphans.slice(0, empty.length).forEach((o, k) => {
      out[o.i] = { name: o.m.name, slot: empty[k].slot, score: sure ? 35 : 15 };
    });
  }
  return out;
}

/** What is still owed, per attribute — the sentence the rail opens with. */
export function evidenceOwed(control: Control): { stepId: string; code: string; missing: number; total: number }[] {
  return control.operating.steps.map(s => {
    const list = requiredFilesOf(s, control);
    return { stepId: s.id, code: s.code, missing: list.filter(f => !f.file).length, total: list.length };
  }).filter(x => x.missing > 0);
}
