/**
 * THE SOP AS PAGES — what Ira reads, page by page (7 Oct, SOP extraction rework).
 *
 * The call on 6 Oct: an LLM handed the whole SOP and asked for RACM rows
 * paraphrases them, so the matrix stops matching the document. The fix is to
 * read the SOP's layout first, then copy its words exactly from where they sit.
 * The prototype holds no real SOP text, so this file builds the pages a real
 * SOP of this shape would have — out of the draft itself, so that every risk,
 * control and "how to test" paragraph on a page is the SAME string as the row
 * field it feeds. That is the claim the screens make ("word for word, p.12"),
 * and here it is true by construction rather than by luck.
 *
 * Shape, the one Akshat described: a cover, a summary before, the body — one
 * risk-control block every two pages, all in the same format — and a closing
 * page after. Page one of a block holds the section heading, the risk and the
 * control; page two holds the "how to test" paragraph and the evidence kept.
 *
 * Pure and deterministic: the same rows give the same pages, so a question
 * asked about page 14 still points at page 14 after a re-render.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — only types, and only inside functions.
 */
import type { ImportRow } from './racmImport';

export interface SopPageLine {
  id: string;
  text: string;
  /** What the line is, said in the margin of the page picture — "Risk",
   *  "Control", "How to test". Absent on running prose. */
  label?: string;
}

export interface SopPage {
  no: number;
  heading?: string;
  lines: SopPageLine[];
  kind: 'cover' | 'summary' | 'body' | 'conclusion';
}

/** The layout Ira reports before it extracts anything: where the blocks are,
 *  how long each is, and which part of a block becomes which RACM field. */
export interface SopStructure {
  totalPages: number;
  bodyFrom: number;
  bodyTo: number;
  pagesPerBlock: number;
  fieldMap: { part: string; field: string }[];
}

/** Front matter before the first block: cover, purpose and scope, roles. */
const FRONT_PAGES = 3;
const PAGES_PER_BLOCK = 2;

/** The SOP's "how to test" paragraph for a row, written from what the row says
 *  is checked and kept. Empty when the row lists neither. */
function guidanceFor(row: ImportRow): string {
  // The row's attributes are short fragments ("Evidence of review"), so they are
  // listed after a colon rather than forced into a sentence they don't fit.
  const clean = (s: string) => s.trim().replace(/[.;]+$/, '');
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const steps = String(row.values.attributes ?? '').split('\n').map(clean).filter(Boolean);
  const evidence = String(row.values.controlEvidence ?? '').split(/;\s*/).map(clean).filter(Boolean);
  if (!steps.length && !evidence.length) return '';
  const look = steps.length ? `To test this control, look at each item for: ${steps.map(lower).join('; ')}.` : '';
  const kept = evidence.length ? `Evidence to ask for: ${evidence.map(lower).join('; ')}.` : '';
  return [look, kept].filter(Boolean).join(' ');
}

/** The SOP rows in the order the document gives them — the only rows that have
 *  a place in it. A file upload's rows have no SOP behind them. */
const sopRowsOf = (rows: ImportRow[]) => rows.filter(r => r.origin === 'sop');

/** Page number of the first page of block `i` (0-based). */
const blockStart = (i: number) => FRONT_PAGES + 1 + i * PAGES_PER_BLOCK;

/** Every page of the SOP, in order. */
export function sopPagesFor(process: string, rows: ImportRow[]): SopPage[] {
  const body = sopRowsOf(rows);
  const owners = Array.from(new Set(body.map(r => String(r.values.owner ?? '').trim()).filter(Boolean))).slice(0, 4);
  const phases = Array.from(new Set(body.map(r => String(r.values.subProcess ?? '').trim()).filter(Boolean)));

  const pages: SopPage[] = [
    { no: 1, kind: 'cover', heading: `${process} — Standard Operating Procedure`, lines: [
      { id: 'p1-l1', text: 'Finance Operations · Internal use only' },
      { id: 'p1-l2', text: 'Version 3.2 · approved by the Financial Controller' },
    ] },
    { no: 2, kind: 'summary', heading: '1. Purpose and scope', lines: [
      { id: 'p2-l1', text: `This procedure sets out how ${process.toLowerCase()} is run, the risks in each stage and the controls that answer them.` },
      { id: 'p2-l2', text: phases.length ? `It covers ${phases.join(', ')}.` : 'It covers every stage of the process.' },
    ] },
    { no: 3, kind: 'summary', heading: '2. Roles and responsibilities', lines: owners.length
      ? owners.map((o, i) => ({ id: `p3-l${i + 1}`, text: `${o} performs the controls assigned to that role and keeps the evidence named in each section.` }))
      : [{ id: 'p3-l1', text: 'Each control names the role that performs it and the evidence it keeps.' }] },
  ];

  body.forEach((r, i) => {
    const a = blockStart(i), b = a + 1;
    const heading = [r.sectionRef, String(r.values.subProcess ?? '').trim() || String(r.values.controlTitle ?? '').trim()].filter(Boolean).join(' ');
    const first: SopPageLine[] = [];
    if (r.values.riskDescription) first.push({ id: `p${a}-risk`, label: 'Risk', text: String(r.values.riskDescription) });
    if (r.values.objective) first.push({ id: `p${a}-obj`, label: 'Objective', text: String(r.values.objective) });
    if (r.values.controlActivity) first.push({ id: `p${a}-ctl`, label: 'Control', text: String(r.values.controlActivity) });
    pages.push({ no: a, kind: 'body', heading: heading || `Section ${i + 1}`, lines: first });

    const second: SopPageLine[] = [];
    const guidance = guidanceFor(r);
    if (guidance) second.push({ id: `p${b}-test`, label: 'How to test', text: guidance });
    if (r.values.owner) second.push({ id: `p${b}-who`, label: 'Performed by', text: String(r.values.owner) });
    if (!second.length) second.push({ id: `p${b}-l1`, text: 'Exceptions are raised to the process owner and closed before period end.' });
    pages.push({ no: b, kind: 'body', heading: `${heading || `Section ${i + 1}`} (continued)`, lines: second });
  });

  const last = blockStart(body.length);
  pages.push({ no: last, kind: 'conclusion', heading: `${FRONT_PAGES + body.length + 1}. Review and approval`, lines: [
    { id: `p${last}-l1`, text: 'This procedure is reviewed every year, and after any change to the systems or roles it names.' },
    { id: `p${last}-l2`, text: 'Questions go to the process owner.' },
  ] });
  return pages;
}

/** The layout Ira reports first — read off the same pages. */
export function sopStructureFor(process: string, rows: ImportRow[]): SopStructure {
  const pages = sopPagesFor(process, rows);
  const body = pages.filter(p => p.kind === 'body');
  return {
    totalPages: pages.length,
    bodyFrom: body[0]?.no ?? 0,
    bodyTo: body.at(-1)?.no ?? 0,
    pagesPerBlock: PAGES_PER_BLOCK,
    // Only the parts this SOP actually has: a map that promises a "Performed by"
    // line the document never writes is a plan Ira can't keep.
    fieldMap: FIELD_MAP.filter(m => !m.label || body.some(p => p.lines.some(l => l.label === m.label))).map(({ part, field }) => ({ part, field })),
  };
}

/** Which part of a block goes into which field — `label` is the line it reads. */
const FIELD_MAP: { part: string; field: string; label?: string }[] = [
  { part: 'Section heading', field: 'Sub-process' },
  { part: 'Risk paragraph', field: 'Risk description', label: 'Risk' },
  { part: 'Objective paragraph', field: 'Control objective', label: 'Objective' },
  { part: 'Control paragraph', field: 'Control activity', label: 'Control' },
  { part: '“How to test” paragraph, next page', field: 'Test guidance', label: 'How to test' },
  { part: '“Performed by” line', field: 'Control owner', label: 'Performed by' },
];

/** One page by number, or undefined. */
export const sopPageOf = (pages: SopPage[], no: number): SopPage | undefined => pages.find(p => p.no === no);

/**
 * The drafted rows with where each was read: its page, the lines its risk and
 * control came from, and its "how to test" paragraph. Rows that are not the
 * SOP's own come back unchanged.
 */
export function withSopSources(process: string, rows: ImportRow[]): ImportRow[] {
  const pages = sopPagesFor(process, rows);
  let block = 0;
  return rows.map(r => {
    if (r.origin !== 'sop') return r;
    const a = blockStart(block++), b = a + 1;
    const first = sopPageOf(pages, a), second = sopPageOf(pages, b);
    const sourceLines = (first?.lines ?? []).filter(l => l.label === 'Risk' || l.label === 'Control').map(l => l.id);
    const test = second?.lines.find(l => l.label === 'How to test');
    return {
      ...r,
      sourcePage: a,
      sourceLines,
      ...(test ? { testGuidance: { text: test.text, page: b, lineIds: [test.id] } } : {}),
    };
  });
}
