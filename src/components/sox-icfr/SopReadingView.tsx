/**
 * READING — the first SOP step, where Ira shows what it is doing (7 Oct, SOP
 * extraction rework, stage 2).
 *
 * The 6 Oct call: users don't mind waiting, they panic when nothing seems to be
 * happening. So the step says, the whole time, where Ira is: first a look over
 * every page to learn the layout, then the STRUCTURE it found (where the
 * risk-control blocks are, how long each is, which part becomes which field),
 * then page by page, each block logged as it is read. It replaces the two
 * "what should Ira extract" choices — Ira extracts only what the SOP says.
 *
 * Presentation only. The parent owns how far the reading has got (`readUpTo`,
 * pages read so far), so stepping back to this screen shows the log as it was
 * rather than reading the document again.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — only inside functions.
 */
import type { ReactNode } from 'react';
import { Check, FileText, Loader2, Sparkles } from 'lucide-react';
import type { SopPage, SopStructure } from './sopPages';

interface Props {
  fileName: string;
  pages: SopPage[];
  structure: SopStructure | null;
  /** Pages read so far. 0 = still looking over the whole document. */
  readUpTo: number;
  /** The numbered outline, drawn under the structure once it is known. */
  outline: ReactNode;
  /** Ira's questions — the side panel, on top of the right-hand column so it
   *  sits beside the reading (stage 3). */
  aside?: ReactNode;
}

/** One line of the log: a run of pages and what Ira found on it. */
interface LogEntry { from: number; to: number; title: string; found: string }

/** The log, a block at a time — the front matter as one entry, each two-page
 *  risk-control block as one, the closing page as one. */
function logEntries(pages: SopPage[]): LogEntry[] {
  const out: LogEntry[] = [];
  const front = pages.filter(p => p.kind === 'cover' || p.kind === 'summary');
  if (front.length) out.push({ from: front[0]!.no, to: front.at(-1)!.no, title: 'Cover, purpose and roles', found: 'no controls' });
  const body = pages.filter(p => p.kind === 'body');
  for (let i = 0; i < body.length; i += 2) {
    const a = body[i]!, b = body[i + 1];
    const lines = [...a.lines, ...(b?.lines ?? [])];
    const has = (label: string) => lines.some(l => l.label === label);
    const found = [has('Risk') && 'a risk', has('Control') && 'its control', has('How to test') && 'how to test it'].filter(Boolean) as string[];
    out.push({
      from: a.no, to: b?.no ?? a.no,
      title: (a.heading ?? `Page ${a.no}`).replace(/ \(continued\)$/, ''),
      found: found.length ? found.length === 1 ? found[0]! : `${found.slice(0, -1).join(', ')} and ${found.at(-1)}` : 'nothing to extract',
    });
  }
  const end = pages.filter(p => p.kind === 'conclusion');
  if (end.length) out.push({ from: end[0]!.no, to: end.at(-1)!.no, title: 'Review and approval', found: 'no controls' });
  return out;
}

const pagesLabel = (e: LogEntry) => (e.from === e.to ? `Page ${e.from}` : `Pages ${e.from}–${e.to}`);

export default function SopReadingView({ fileName, pages, structure, readUpTo, outline, aside }: Props) {
  const total = pages.length;
  const done = total > 0 && readUpTo >= total;
  const skimming = readUpTo === 0 && !done;
  const entries = logEntries(pages);
  // Read entries, then the one being read; the rest are not on screen yet.
  const shown = done ? entries : entries.filter(e => e.from <= readUpTo + 1);
  const current = done ? null : entries.find(e => readUpTo + 1 >= e.from && readUpTo + 1 <= e.to) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] items-start">
      {/* ── the log ── */}
      <div className="min-w-0">
        <div role="status" aria-live="polite">
          <p className="text-[0.75rem] text-ink-600 flex items-center gap-1.5">
            {done
              ? <Check size={12} className="text-compliant-600 shrink-0" aria-hidden />
              : <Sparkles size={12} className="text-brand-500 shrink-0" aria-hidden />}
            {done ? `Read all ${total} pages of ${fileName}`
              : skimming ? `Looking over all ${total} pages of ${fileName} to learn its layout…`
              : `Reading page ${readUpTo + 1} of ${total}…`}
          </p>
          {/* A quantity, not a verdict: how far through the document. */}
          <div className="mt-1 h-0.5 rounded-full bg-paper-100 overflow-hidden" role="presentation">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
              style={{ width: `${total ? Math.round((Math.min(readUpTo, total) / total) * 100) : 0}%` }} />
          </div>
        </div>

        {!skimming && (
          <ol className="mt-3 space-y-1.5" aria-label="What Ira has read">
            {shown.map(e => {
              const reading = current === e;
              return (
                <li key={e.from} className="flex items-start gap-2 text-[0.75rem] leading-snug">
                  {reading
                    ? <Loader2 size={12} className="mt-0.5 shrink-0 text-brand-500 animate-spin" aria-hidden />
                    : <Check size={12} className="mt-0.5 shrink-0 text-ink-400" aria-hidden />}
                  <span className="min-w-0">
                    <span className="font-mono text-ink-500">{pagesLabel(e)}</span>
                    <span className="text-ink-300" aria-hidden> · </span>
                    <span className="text-ink-900">{e.title}</span>
                    {!reading && <span className="block text-ink-500">{e.found === 'no controls' || e.found === 'nothing to extract' ? e.found.charAt(0).toUpperCase() + e.found.slice(1) : `Found ${e.found}`}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* ── what Ira found the document to be ── */}
      <div className="min-w-0 space-y-3">
        {!skimming && aside}
        {skimming || !structure ? (
          <div className="rounded-xl border border-dashed border-canvas-border px-4 py-6 text-center text-[0.75rem] text-ink-500">
            The structure appears here once Ira has looked over the whole document.
          </div>
        ) : (
          <section aria-label="Structure Ira found" className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
              <FileText size={11} aria-hidden /> Structure
            </p>
            <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-900">
              Pages {structure.bodyFrom}–{structure.bodyTo} hold the risks and controls, about {structure.pagesPerBlock} pages each, all in the same format.
              {structure.bodyFrom > 1 && ` Pages 1–${structure.bodyFrom - 1} are the cover and summary`}
              {structure.totalPages > structure.bodyTo && `${structure.bodyFrom > 1 ? ', and page' : ' Page'} ${structure.totalPages} closes it`}.
            </p>
            <p className="mt-2.5 text-[0.6875rem] font-semibold text-ink-500">From each block, Ira will take</p>
            <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[0.75rem]">
              {structure.fieldMap.map(m => (
                <div key={m.part} className="contents">
                  <dt className="text-ink-600">{m.part}</dt>
                  <dd className="text-ink-900"><span className="text-ink-300" aria-hidden>→ </span>{m.field}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {!skimming && outline}
      </div>
    </div>
  );
}
