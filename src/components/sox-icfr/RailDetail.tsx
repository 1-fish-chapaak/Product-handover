/**
 * ── The rail's third layer — the full working, and the file at the passage ──
 * A result reads in three layers (agentic UI review #3, 30 Sep): one line on the
 * row, the reasons on hover, and the whole working with its quoted passages —
 * which lives HERE, in the control page's 400px rail, not in a modal over it.
 * The modal hid the page the verdict was about; the rail keeps both in view.
 *
 * Hovering a result underlines its source file; clicking opens that file at the
 * passage (the 'file' kind). Anything on the page reaches the rail through
 * `useOpenRailDetail()`, so a row never needs the rail's state threaded to it.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — only inside components — and it never
 * imports ControlDossier (which imports this).
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Paperclip, Quote } from 'lucide-react';
import { cn } from '../../lib/cn';
import EvidenceAnnotator from './EvidenceAnnotator';
import { Tickmark } from './parts';
import { confidenceOf, documentSystemRows, requiredFilesOf } from './helpers';
import type { AuditRecord, Control, DesignPoint, EvidenceFile, OperatingStep, Sample, ValidationResult } from './types';

export type RailDetail =
  | { kind: 'working'; title: string; validation: ValidationResult; control: Control; step?: OperatingStep; evidence?: EvidenceFile; confKey?: string;
      /** The round the sample was drawn in (sampleHome) — dates each item the way the sample grid does. */
      home?: AuditRecord;
      /** Opens with this passage already boxed and scrolled to — the one a
       *  clicked result rests on (a design check's cite, or a sampled item's
       *  ref in its file). Absent: nothing picked, every passage marked. */
      focusCite?: string }
  | { kind: 'file'; file: EvidenceFile; label?: string; quotes?: string[] };

export const RailDetailContext = createContext<(d: RailDetail) => void>(() => {});
export function useOpenRailDetail() { return useContext(RailDetailContext); }

const EYEBROW = 'text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400';

/** The passage a verdict rests on: on a Fail, the first failed answer's cite;
 *  otherwise the first cited answer's. Nothing when Ira reached no verdict
 *  (couldn't test) or no answer was read in a file (it came from the matrix). */
export function verdictCite(v?: ValidationResult): string | undefined {
  if (!v?.result) return undefined;
  const cited = v.qa.filter(x => !!x.cite);
  return (v.result === 'Fail' ? cited.find(x => !x.pass) : undefined)?.cite ?? cited[0]?.cite;
}

/** The file a design check's working opens on — the same rule PointRow uses:
 *  its own proof first, then the first openable file of the elements it cites. */
export function pointEvidence(c: Control, p: DesignPoint): EvidenceFile | undefined {
  const linked = c.design.documents.filter(d => p.evidencedBy?.includes(d.id)).flatMap(d => d.files ?? []);
  return p.auditorProof?.file ?? linked.find(x => !!x.url) ?? linked[0];
}

/** One sampled item × attribute: the file the attribute was run against, and
 *  the item's ref to box in it — the row that item is in. */
export function itemFocus(c: Control, s: OperatingStep, it: Sample): { evidence?: EvidenceFile; focusCite: string } {
  const files = requiredFilesOf(s, c).map(f => f.file).filter((f): f is EvidenceFile => !!f);
  const evidence = files.find(f => f.name === s.validation?.fileName) ?? files.find(f => !!f.url) ?? files[0];
  return { evidence, focusCite: it.ref };
}

/**
 * Per-drawn-item results for one attribute, moved out of ControlDossier's modal
 * (agentic UI review #3, 30 Sep). A 5-column grid needed 36rem and scrolled
 * sideways in a 400px rail, so each item is now a compact 2-line row: sample ·
 * verdict on top, field — document vs system underneath. Nothing when no sample
 * has been drawn; the caller says what that means in its own words.
 */
export function SampleResultsTable({ control, step, home }: { control: Control; step: OperatingStep; home?: AuditRecord }) {
  const rows = documentSystemRows(control, step, home);
  if (rows.length === 0) return null;
  const matched = rows.filter(r => r.result === 'Pass').length;
  // a run from before the sample existed carries no per-item verdicts — say so
  // rather than showing a list that reads as "everything untested"
  const stale = rows.every(r => r.result === 'Not tested');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className={EYEBROW}>Document vs system — each item</div>
        {!stale && <span className="text-[0.6875rem] text-ink-400 tabular-nums">{matched}/{rows.length} match</span>}
      </div>
      {stale && (
        <p className="text-[0.75rem] text-mitigated-700 inline-flex items-start gap-1 mb-2">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          This ran before the sample was extracted — run it again to test each item.
        </p>
      )}
      <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
        {rows.map(r => {
          const miss = r.result === 'Fail';
          return (
            <div key={r.id} className="px-3 py-1.5 text-[0.75rem]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-ink-700 truncate min-w-0" title={r.ref}>{r.ref}</span>
                <span className={cn('ml-auto shrink-0 inline-flex items-center gap-1 font-bold', r.result === 'Pass' ? 'text-compliant-700' : miss ? 'text-risk-700' : 'text-ink-400')}>
                  <Tickmark result={r.result} size={13} /> {r.result === 'Pass' ? 'Match' : miss ? 'Mismatch' : 'Not compared'}
                </span>
              </div>
              <div className="mt-0.5 text-[0.6875rem] text-ink-500 truncate tabular-nums" title={`${r.field}: document ${r.document}, system ${r.system}`}>
                {r.field} — doc <span className="text-ink-700">{r.document}</span> · system <span className={miss ? 'text-risk-700 font-semibold' : 'text-ink-700'}>{r.system}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The full working — everything QAResultsModal showed, stacked for 400px
 *  (agentic UI review #3, 30 Sep). The document sits BELOW the checks rather
 *  than beside them; clicking a check moves the mark in it. */
function Working({ d }: { d: Extract<RailDetail, { kind: 'working' }> }) {
  const { title, validation, control, step, evidence, confKey, home, focusCite } = d;
  const { qa, summary, table, blocked } = validation;
  const passed = qa.filter(x => x.pass).length;
  // The header states what the checks below actually came to. A run saved with
  // its answers but no verdict on it read "Not tested" over "1/1 check passed"
  // (click-through, 5 Oct) — so with no stored verdict, the answers decide it.
  const result = validation.result ?? (blocked || qa.length === 0 ? undefined : passed === qa.length ? 'Pass' : 'Fail');
  const conf = confidenceOf(validation, confKey ?? title);
  const answerQuotes = qa.map(x => x.cite).filter((q): q is string => !!q);
  // a sampled item's ref is not one of the answers' cites — add it so it is found
  const quotes = focusCite && !answerQuotes.includes(focusCite) ? [...answerQuotes, focusCite] : answerQuotes;
  const showEvidence = !!evidence && quotes.length > 0;
  const [activeCite, setActiveCite] = useState<string | undefined>(focusCite);
  // Opened from a result (one click): bring the file into view, the passage
  // already boxed in it — the annotator scrolls to the passage itself.
  const fileBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusCite && showEvidence) fileBox.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // an operating attribute's real item-level answer is the drawn sample; the
  // generated table is the fallback for design considerations (never sampled)
  const sampled = !!control.operating.sampling?.samples.length && !!step;
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        {/* the verdict line — one line, the same tick the row carries */}
        <div className="flex items-center gap-2">
          <Tickmark result={result ?? 'Not tested'} size={18} confidence={conf} blocked={!!blocked} />
          <span className={cn('text-[0.8125rem] font-bold', result === 'Pass' ? 'text-compliant-700' : result === 'Fail' ? 'text-risk-700' : 'text-mitigated-800')}>
            {result ?? (blocked ? "Couldn't test" : 'Not tested')}
          </span>
          {conf != null && <span className="ml-auto text-[0.6875rem] text-ink-400 tabular-nums">Ira · {conf}% sure</span>}
        </div>
        {blocked && !result && <p className="text-[0.75rem] text-mitigated-800 leading-relaxed">{blocked}</p>}
        {summary && <p className="text-[0.75rem] text-ink-700 leading-relaxed">{summary}</p>}
        {sampled && <SampleResultsTable control={control} step={step!} home={home} />}
        {table && !sampled && (
          <div>
            <div className={cn(EYEBROW, 'mb-1.5')}>{table.columns.includes('System says') ? 'Document vs system data' : 'Evidence checked'}</div>
            <div className="rounded-lg border border-canvas-border overflow-x-auto">
              <table className="w-full text-[0.6875rem]">
                <thead><tr className="bg-paper-50/60 border-b border-canvas-border">{table.columns.map(c => <th key={c} className="text-left font-semibold text-ink-600 px-2 py-1.5 whitespace-nowrap">{c}</th>)}</tr></thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-canvas-border/60 last:border-0">
                      {row.map((cell, ci) => {
                        const isResult = ci === table.columns.length - 1;
                        return <td key={ci} className={cn('px-2 py-1.5', isResult ? cn('font-bold', cell === 'Pass' || cell === 'Match' ? 'text-compliant-700' : cell === 'Fail' || cell === 'Mismatch' ? 'text-risk-700' : 'text-ink-600') : 'text-ink-700', ci === 0 && 'font-mono text-ink-500')}>{cell}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <div className={cn(EYEBROW, 'mb-1.5')}>Checks</div>
          <div className="space-y-2">
            {qa.map((item, i) => {
              const on = showEvidence && !!item.cite && activeCite === item.cite;
              return (
                <div key={i} className={cn('flex items-start gap-2.5 rounded-lg -mx-2 px-2 py-1.5 transition-colors',
                  showEvidence && item.cite && 'cursor-pointer hover:bg-paper-50',
                  // evidence blue, matching the mark on the document (25 Sep)
                  on && 'bg-evidence-50')}
                  onClick={() => { if (showEvidence && item.cite) setActiveCite(on ? undefined : item.cite); }}
                  {...(showEvidence && item.cite ? {
                    role: 'button', tabIndex: 0, 'aria-pressed': on,
                    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveCite(on ? undefined : item.cite); } },
                  } : {})}>
                  <Tickmark result={item.pass ? 'Pass' : 'Fail'} size={16} />
                  <div className="min-w-0">
                    <div className="text-[0.75rem] font-semibold text-ink-900">{item.q}</div>
                    <div className="text-[0.75rem] text-ink-600 mt-0.5 leading-relaxed">{item.a}</div>
                    {/* names the document, never the search wording (25 Sep) */}
                    {showEvidence && item.cite && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-evidence-700">
                        <Quote size={9} /><span className="truncate">Read in {evidence!.name}</span>
                        <span className="text-ink-400 font-normal shrink-0">{on ? '· marked below' : '· show me'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {showEvidence && (
          <div ref={fileBox} className="rounded-lg border border-canvas-border overflow-hidden flex flex-col h-112 scroll-mt-3">
            <div className="px-3 py-1.5 border-b border-canvas-border bg-canvas-elevated flex items-center gap-2">
              <Paperclip size={11} className="text-ink-400 shrink-0" />
              <span className="text-[0.75rem] font-semibold text-ink-700 truncate">{evidence!.name}</span>
              <span className="text-[0.6875rem] text-ink-400 ml-auto shrink-0">{!activeCite ? 'every cited passage' : answerQuotes.includes(activeCite) ? 'that answer’s passage' : `${activeCite} marked`}</span>
            </div>
            <div className="flex-1 min-h-0"><EvidenceAnnotator file={evidence!} quotes={quotes} active={activeCite} /></div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 py-2 border-t border-canvas-border text-[0.75rem] text-ink-500 tabular-nums">
        {passed}/{qa.length} {qa.length === 1 ? 'check' : 'checks'} passed
      </div>
    </>
  );
}

export default function RailDetailPane({ detail, onBack }: { detail: RailDetail; onBack: () => void }) {
  const title = detail.kind === 'file' ? (detail.label ?? detail.file.name) : detail.title;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-canvas-border">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer shrink-0">
          <ArrowLeft size={12} /> Back
        </button>
        <span className="text-[0.75rem] font-semibold text-ink-800 truncate min-w-0" title={title}>{title}</span>
      </div>
      {detail.kind === 'working'
        // keyed so a second "View results" starts with no check selected — and a
        // click on a different result starts on that result's passage
        ? <Working key={`${detail.confKey ?? detail.title}|${detail.focusCite ?? ''}`} d={detail} />
        : (
          <>
            <div className="shrink-0 px-4 py-2 border-b border-canvas-border bg-canvas-elevated flex items-center gap-2">
              <Paperclip size={11} className="text-ink-400 shrink-0" />
              <span className="text-[0.75rem] font-semibold text-ink-700 truncate">{detail.file.name}</span>
              <span className="ml-auto shrink-0 text-[0.6875rem] font-bold text-ink-400">{detail.file.kind}</span>
            </div>
            {/* the file opened AT the passage: the first quote is the marked one */}
            <div className="flex-1 min-h-0">
              <EvidenceAnnotator key={detail.file.id} file={detail.file} quotes={detail.quotes ?? []} active={detail.quotes?.[0]} />
            </div>
          </>
        )}
    </div>
  );
}
