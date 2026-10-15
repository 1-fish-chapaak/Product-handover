/**
 * WHAT IRA ASKS WHILE IT READS (7 Oct, SOP extraction rework, stage 3).
 *
 * The 6 Oct call: ask at the page the doubt comes up on, not in a pile at the
 * end; at most six while reading; plain words; and nothing at all where Ira is
 * sure. A question is only raised where the draft itself shows a real doubt:
 *
 *   boundary  — two blocks in a row cover the same part of the process. Two
 *               risks, or one written over four pages?
 *   inferred  — the control is not stated in so many words; Ira read it from
 *               the passage. Is it a control at all?
 *
 * Ira's own reading is always the FIRST option, so an answer that agrees costs
 * one click, and an answer that disagrees says which row stays out of the draft.
 * Questions past the sixth wait at the top of Review (user's call, 7 Oct).
 *
 * Answers are remembered per SOP file for the session: the same file uploaded
 * again asks nothing (C9). Pure apart from that one map.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — types only.
 */
import type { ImportRow } from './racmImport';
import type { SopPage } from './sopPages';

export interface SopAnswerOption {
  id: string;
  label: string;
  /** Rows this answer keeps out of the draft. */
  leavesOut?: string[];
}

export interface SopQuestion {
  /** Stable for the same draft, so a remembered answer finds its question. */
  id: string;
  kind: 'boundary' | 'inferred';
  /** Asked when the reading reaches this page; the page the picture shows. */
  page: number;
  /** Lines highlighted on the page picture. */
  lineIds: string[];
  ask: string;
  /** What it is about, in a few words — kept beside the answer once given. */
  topic: string;
  /** Ira's own reading first. */
  options: SopAnswerOption[];
}

/** At most this many while reading (6 Oct call). */
export const SOP_QUESTION_CAP = 6;

/** A topic short enough to sit on one line beside its answer. */
const short = (t: string) => (t.length > 44 ? `${t.slice(0, 43).trimEnd()}…` : t);

/** What a control's own words usually say someone does. */
const CONTROL_WORDS = /\b(review|approv|authori[sz]|verif|reconcil|match|check|sign|validat|compar|confirm|inspect)/i;

const lineOf =(pages: SopPage[], no: number, label: string) =>
  pages.find(p => p.no === no)?.lines.find(l => l.label === label);

/** Every doubt in the draft, in page order. */
export function sopQuestionsFor(pages: SopPage[], rows: ImportRow[]): SopQuestion[] {
  const sop = rows.filter(r => r.origin === 'sop' && r.sourcePage);
  const out: SopQuestion[] = [];
  sop.forEach((r, i) => {
    const page = r.sourcePage!;
    const prev = sop[i - 1];
    const phase = String(r.values.subProcess ?? '').trim();
    if (prev && phase && phase === String(prev.values.subProcess ?? '').trim()) {
      const risk = lineOf(pages, page, 'Risk');
      out.push({
        id: `boundary:${r.key}`,
        kind: 'boundary',
        page,
        lineIds: risk ? [risk.id] : [],
        topic: phase,
        ask: `Pages ${prev.sourcePage}–${prev.sourcePage! + 1} and ${page}–${page + 1} both cover ${phase}. Are they two separate risks, or one?`,
        options: [
          { id: 'two', label: 'Two separate risks' },
          { id: 'one', label: `One risk — keep pages ${prev.sourcePage}–${prev.sourcePage! + 1} only`, leavesOut: [r.key] },
        ],
      });
    }
    // Read between the lines is not on its own a doubt — Review already marks
    // those rows with an outlined tick. Ira asks only where the passage doesn't
    // read like a control at all: nobody reviews, approves, checks or matches.
    if (r.sopRead === 'inferred' && !CONTROL_WORDS.test(String(r.values.controlActivity ?? ''))) {
      const ctl = lineOf(pages, page, 'Control');
      out.push({
        id: `inferred:${r.key}`,
        kind: 'inferred',
        page,
        lineIds: ctl ? [ctl.id] : [],
        topic: short(String(r.values.controlTitle ?? '').trim()) || 'this control',
        ask: `Page ${page} doesn't call this a control in so many words — Ira read it from the passage highlighted. Is it a control?`,
        options: [
          { id: 'yes', label: 'Yes, it’s a control' },
          { id: 'no', label: 'No, leave it out', leavesOut: [r.key] },
        ],
      });
    }
  });
  return out.sort((a, b) => a.page - b.page);
}

/** Rows the answers keep out of the draft. */
export function rowsLeftOutBy(questions: SopQuestion[], answers: Record<string, string>): string[] {
  return questions.flatMap(q => q.options.find(o => o.id === answers[q.id])?.leavesOut ?? []);
}

// ── answers remembered per SOP file, for the session ─────────────────────────
const remembered = new Map<string, Record<string, string>>();

export function rememberedAnswers(fileName: string): Record<string, string> {
  return { ...(remembered.get(fileName) ?? {}) };
}

export function rememberAnswer(fileName: string, questionId: string, optionId: string): void {
  remembered.set(fileName, { ...(remembered.get(fileName) ?? {}), [questionId]: optionId });
}
