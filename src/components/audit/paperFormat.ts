// How a control's working paper is laid out in the format the audit goes out
// in. The paper holds a fixed set of facts; a format supplies the headings and
// their order, and this decides which fact is printed under which heading.

/** The material a control paper is made of, in the order the paper states it.
 *  These are the facts; a format decides what headings they are printed under. */
export type PaperBlock = 'summary' | 'risk' | 'scope' | 'procedure' | 'results' | 'conclusion';

/** The paper's own heading for each fact, and what that heading promises. Used
 *  as the section title when the paper prints in its own shape, and as the
 *  label inside a section when a format folds several facts under one heading. */
export const BLOCK_META: Record<PaperBlock, { id: string; title: string; subtitle: string }> = {
  summary:    { id: 'wp-summary',    title: 'Summary',        subtitle: 'What the testing counted, and where it landed' },
  risk:       { id: 'wp-risk',       title: 'Risk addressed', subtitle: 'What this control exists to stop' },
  scope:      { id: 'wp-scope',      title: 'Scope',          subtitle: 'What was covered, and over what period' },
  procedure:  { id: 'wp-procedure',  title: 'Test procedure', subtitle: 'The steps performed' },
  results:    { id: 'wp-results',    title: 'Results',        subtitle: 'What the testing found' },
  conclusion: { id: 'wp-conclusion', title: 'Conclusion',     subtitle: '' },
};

const BLOCK_ORDER: PaperBlock[] = ['summary', 'risk', 'scope', 'procedure', 'results', 'conclusion'];

/** Which fact a format's section is asking for. A format names its own
 *  sections ("Audit Queries", "Recommendations"), so the paper is matched to
 *  them by what the name means, first match in this order winning. */
const BLOCK_PATTERNS: [PaperBlock, RegExp][] = [
  ['summary',    /\b(executive summary|summar(y|ies)|overview|opinion|introduction|report information)\b/i],
  ['risk',       /\brisks?\b/i],
  ['scope',      /\b(scope|objectives?|background|coverage)\b/i],
  ['procedure',  /\b(procedures?|methodolog(y|ies)|approach|test plan|testing performed|work performed)\b/i],
  ['results',    /\b(quer(y|ies)|findings?|results?|exceptions?|observations?|testing|issues?|deficienc(y|ies))\b/i],
  ['conclusion', /\b(recommendations?|conclusions?|actions?|management response|way forward|next steps)\b/i],
];

function blockAskedFor(sectionName: string): PaperBlock | null {
  for (const [block, re] of BLOCK_PATTERNS) if (re.test(sectionName)) return block;
  return null;
}

/** One printed section of the paper: a heading from the format (or the paper's
 *  own), and the facts printed under it. */
export interface PaperSection {
  id: string;
  title: string;
  subtitle?: string;
  blocks: PaperBlock[];
}

/** The paper laid out in the chosen format. With no format picked the paper
 *  prints in its own shape, one fact per section. With a format picked the
 *  format's sections and their order win, and every fact is placed under the
 *  heading that asks for it — a fact no heading asks for is printed under the
 *  section carrying the findings, so applying a format never drops the test. */
export function paperSections(format?: { sections?: { name: string }[] } | null): PaperSection[] {
  const named = format?.sections ?? [];
  if (named.length === 0) {
    return BLOCK_ORDER.map(b => ({
      id: BLOCK_META[b].id,
      title: BLOCK_META[b].title,
      subtitle: BLOCK_META[b].subtitle || undefined,
      blocks: [b],
    }));
  }
  const wants = named.map(s => blockAskedFor(s.name));
  const placed: PaperBlock[][] = named.map(() => []);
  const parked: PaperBlock[] = [];
  for (const b of BLOCK_ORDER) {
    const at = wants.indexOf(b);
    if (at === -1) parked.push(b); else placed[at].push(b);
  }
  if (parked.length) {
    // The findings section is where a working paper's testing belongs. Failing
    // that, the second section that asks for anything — a format whose opener
    // is a cover ("Report Information") wants the testing in the section after
    // it, not folded into the cover. Failing that, the first.
    const asking = placed.map((b, i) => (b.length ? i : -1)).filter(i => i !== -1);
    const target = wants.indexOf('results') !== -1
      ? wants.indexOf('results')
      : asking[1] ?? asking[0] ?? 0;
    placed[target] = BLOCK_ORDER.filter(b => placed[target].includes(b) || parked.includes(b));
  }
  return named.map((s, i) => ({
    id: `wp-sec-${i}`,
    title: s.name,
    // A section holding one fact can carry that fact's own sub text, but only
    // where the sub text still describes the format's own heading — the
    // summary's does under any name for it, the rest only under their own. A
    // section holding several facts labels them inside instead, so nothing is
    // claimed twice.
    subtitle: placed[i].length === 1 && (placed[i][0] === 'summary' || BLOCK_META[placed[i][0]].title === s.name)
      ? (BLOCK_META[placed[i][0]].subtitle || undefined)
      : undefined,
    blocks: placed[i],
  }));
}

/** How many sections a control paper has in the chosen format, before any
 *  observations are added — the number the list's sub text counts, the way a
 *  report row counts its own sections. */
export const paperSectionCount = (format?: { sections?: { name: string }[] } | null) =>
  paperSections(format).length;
