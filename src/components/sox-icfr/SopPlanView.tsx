/**
 * PLAN — what Ira will take from where, confirmed before anything is extracted
 * (7 Oct, SOP extraction rework, stage 4).
 *
 * The 6 Oct call: once the reading and the questions are done, show the plan as
 * a picture — "from this part I'll take this, and put it in that field" — and
 * let the reader say yes before the extraction runs. Extraction then copies the
 * SOP's own words; nothing is rewritten.
 *
 * Drawn as a mapping, part of a block on the left, RACM field on the right, an
 * arrow between, with the first block's real text under each part so the
 * reader checks the plan against the page rather than against a description of
 * it.
 *
 * TDZ note: types and a leaf component only from this folder.
 */
import { ArrowRight, FileText, Sparkles, Table2 } from 'lucide-react';
import type { ImportRow } from './racmImport';
import type { SopPage, SopStructure } from './sopPages';

interface Props {
  fileName: string;
  pages: SopPage[];
  structure: SopStructure;
  rows: ImportRow[];
  /** Rows the reader's answers keep out of the draft. */
  leftOut: number;
}

/** The first block's own text for each part of the map, so the plan is read
 *  against a real example. */
function exampleFor(part: string, first?: SopPage, second?: SopPage): string | undefined {
  const line = (p: SopPage | undefined, label: string) => p?.lines.find(l => l.label === label)?.text;
  if (/heading/i.test(part)) return first?.heading;
  if (/risk/i.test(part)) return line(first, 'Risk');
  if (/objective/i.test(part)) return line(first, 'Objective');
  if (/^control/i.test(part)) return line(first, 'Control');
  if (/how to test/i.test(part)) return line(second, 'How to test');
  if (/performed by/i.test(part)) return line(second, 'Performed by');
  return undefined;
}

export default function SopPlanView({ fileName, pages, structure, rows, leftOut }: Props) {
  const blocks = rows.filter(r => r.origin === 'sop' && r.sourcePage).length;
  const first = pages.find(p => p.no === structure.bodyFrom);
  const second = pages.find(p => p.no === structure.bodyFrom + 1);
  const going = Math.max(0, blocks - leftOut);

  return (
    <div className="max-w-4xl">
      <p className="text-[0.9375rem] font-semibold text-ink-900">Here is how Ira will extract {fileName}</p>
      <p className="mt-1 text-[0.8125rem] text-ink-600 flex items-center gap-1.5">
        <Sparkles size={13} className="text-brand-500 shrink-0" aria-hidden />
        Ira will copy the SOP’s exact words into each field — nothing is rewritten or summarised.
      </p>
      <p className="mt-2 text-[0.75rem] text-ink-500 tabular-nums">
        {blocks} {blocks === 1 ? 'block' : 'blocks'} on pages {structure.bodyFrom}–{structure.bodyTo}, so {going} {going === 1 ? 'row' : 'rows'}
        {leftOut > 0 && ` — ${leftOut} left out by your ${leftOut === 1 ? 'answer' : 'answers'}`}. Each row keeps the page it came from.
      </p>

      {/* the map: part of a block → RACM field */}
      <div className="mt-4 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,13rem)] gap-x-2 items-end pb-2 border-b border-canvas-border">
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
            <FileText size={11} aria-hidden /> In each SOP block <span className="normal-case tracking-normal font-normal">· example from pages {structure.bodyFrom}–{structure.bodyFrom + 1}</span>
          </p>
          <span />
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
            <Table2 size={11} aria-hidden /> RACM field
          </p>
        </div>
        <ol className="divide-y divide-canvas-border">
          {structure.fieldMap.map(m => {
            const example = exampleFor(m.part, first, second);
            return (
              <li key={m.part} className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,13rem)] gap-x-2 items-center py-2.5">
                <div className="min-w-0 rounded-lg border border-canvas-border bg-paper-50 px-3 py-2">
                  <p className="text-[0.75rem] font-semibold text-ink-800">{m.part}</p>
                  {example && <p className="mt-0.5 text-[0.6875rem] leading-snug text-ink-500 line-clamp-2">“{example}”</p>}
                </div>
                <ArrowRight size={16} className="mx-auto text-ink-300" aria-label="goes into" />
                <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                  <p className="text-[0.75rem] font-semibold text-brand-800">{m.field}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-3 text-[0.75rem] text-ink-500">
        Fields the SOP doesn’t state — like the risk owner and rating — stay blank for you to fill in at Review.
      </p>
    </div>
  );
}
