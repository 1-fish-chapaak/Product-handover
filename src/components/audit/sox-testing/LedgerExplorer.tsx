/** ── What the ledgers actually said ────────────────────────────────────────
 *  The trial balance used to land as a filename and a tick. Now that it is
 *  read, there is something worth showing: every caption it carries, what each
 *  one is worth, and whether it clears performance materiality — which is the
 *  evidence behind the scoping decision the next step asks the user to make.
 *
 *  A caption opens onto the general ledger lines behind it, when a GL has been
 *  uploaded too. That is the drill an auditor does by hand on every engagement:
 *  the caption is the number, the postings are why, and the manual journals
 *  among them are where the risk sits.
 */
import { useState } from 'react';
import { ChevronRight, FileSpreadsheet, PenLine } from 'lucide-react';
import { cn } from '../../../lib/cn';
import type { GroupEntity, TbCaption } from './soxTestingData';
import { captionKey, type GlLine, type GlParseOk } from './ledgerImport';

/** Enough lines to make the point without turning the step into a ledger
 *  viewer — the rest are counted rather than drawn. */
const LINES_SHOWN = 40;

interface Props {
  entities: GroupEntity[];
  captions: TbCaption[];
  gl: GlParseOk | null;
  /** Performance materiality, in the same unit the captions carry. */
  perf: number;
  money: (v: number) => string;
  /** Rows the trial balance itself added — worth marking, because nobody
   *  typed them and nobody drew them on the chart. */
  addedByTb?: Set<string>;
}

export default function LedgerExplorer({ entities, captions, gl, perf, money, addedByTb }: Props) {
  const [openEntity, setOpenEntity] = useState<string | null>(entities[0]?.id ?? null);
  const [openCaption, setOpenCaption] = useState<string | null>(null);

  const spoken = entities.filter(e => captions.some(c => c.entityId === e.id));
  if (!spoken.length) return null;

  return (
    <div className="mt-6 pt-5 border-t border-canvas-border">
      <h4 className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">
        What the trial balance says
        <span className="font-normal text-ink-500">
          {' · '}{captions.length} caption{captions.length === 1 ? '' : 's'} across {spoken.length} compan{spoken.length === 1 ? 'y' : 'ies'}
        </span>
      </h4>
      <p className="text-[0.75rem] text-ink-500 mb-3 leading-relaxed">
        Read from the file you uploaded. Anything at or above {money(perf)} clears performance materiality on its own.
        {gl && ' Open a caption to see the ledger lines behind it.'}
      </p>

      <div className="rounded-xl border border-canvas-border bg-white overflow-hidden">
        {spoken.map(ent => {
          const mine = captions.filter(c => c.entityId === ent.id).slice().sort((a, b) => b.balance - a.balance);
          const above = mine.filter(c => c.balance >= perf).length;
          const total = mine.reduce((t, c) => t + c.balance, 0);
          const isOpen = openEntity === ent.id;
          return (
            <div key={ent.id} className="border-b border-canvas-border last:border-b-0">
              <button
                onClick={() => { setOpenEntity(isOpen ? null : ent.id); setOpenCaption(null); }}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <ChevronRight size={13} className={cn('shrink-0 text-ink-400 transition-transform', isOpen && 'rotate-90')} />
                <span className="text-[0.8125rem] font-semibold text-ink-900 truncate flex-1 min-w-0">{ent.name}</span>
                {addedByTb?.has(ent.id) && (
                  <span className="shrink-0 text-[0.625rem] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                    found in the TB
                  </span>
                )}
                <span className="shrink-0 text-[0.6875rem] text-ink-500">
                  {mine.length} caption{mine.length === 1 ? '' : 's'} · {above} above PM
                </span>
                <span className="shrink-0 text-[0.75rem] text-ink-800 tabular-nums w-24 text-right">{money(total)}</span>
              </button>

              {isOpen && (
                <div className="border-t border-canvas-border">
                  {mine.map(c => {
                    const lines = gl?.byCaption.get(captionKey(ent.id, c.caption)) ?? [];
                    const key = `${ent.id}::${c.caption}`;
                    const shown = openCaption === key;
                    const material = c.balance >= perf;
                    return (
                      <div key={c.id} className="border-b border-canvas-border last:border-b-0">
                        <button
                          onClick={() => lines.length && setOpenCaption(shown ? null : key)}
                          aria-expanded={lines.length ? shown : undefined}
                          disabled={!lines.length}
                          className={cn(
                            'w-full grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_auto] gap-2.5 items-center pl-9 pr-3.5 py-1.5 text-left transition-colors',
                            lines.length ? 'hover:bg-surface-2 cursor-pointer' : 'cursor-default',
                          )}
                        >
                          <span className="text-[0.75rem] text-ink-900 truncate flex items-center gap-1.5" title={c.caption}>
                            {lines.length > 0 && (
                              <ChevronRight size={11} className={cn('shrink-0 text-ink-400 transition-transform', shown && 'rotate-90')} />
                            )}
                            <span className={cn('truncate', !lines.length && 'pl-[1.15rem]')}>{c.caption}</span>
                          </span>
                          <span className="text-[0.6875rem] text-ink-500 truncate">{c.process}</span>
                          <span className="text-[0.625rem] font-semibold">
                            {material
                              ? <span className="px-1.5 py-0.5 rounded bg-high-50 text-high-700 border border-high-100">above PM</span>
                              : <span className="px-1.5 py-0.5 rounded bg-paper-100 text-ink-500 border border-border-light">below PM</span>}
                          </span>
                          <span className="text-[0.75rem] text-ink-800 tabular-nums w-24 text-right">{money(c.balance)}</span>
                        </button>

                        {shown && lines.length > 0 && <GlLines lines={lines} money={money} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The postings behind one caption. Manual journals are called out rather than
 *  left to be spotted: they are the ones an auditor pulls first, because a
 *  posting somebody keyed by hand is a posting that went around the system. */
function GlLines({ lines, money }: { lines: GlLine[]; money: (v: number) => string }) {
  const manual = lines.filter(l => l.manual);
  const shown = lines.slice(0, LINES_SHOWN);
  return (
    <div className="bg-surface-2 border-t border-canvas-border px-3.5 py-2.5">
      <div className="flex items-center gap-2 mb-2 pl-5">
        <FileSpreadsheet size={11} className="text-ink-400 shrink-0" />
        <span className="text-[0.6875rem] text-ink-600">
          {lines.length} ledger line{lines.length === 1 ? '' : 's'}
          {manual.length > 0 && (
            <> · <span className="text-high-700 font-semibold">{manual.length} keyed by hand</span></>
          )}
        </span>
      </div>
      <div className="rounded-lg border border-canvas-border bg-white overflow-hidden">
        <div className="grid grid-cols-[6rem_7rem_minmax(0,1.5fr)_7rem_minmax(0,0.8fr)] gap-2 px-2.5 py-1.5 border-b border-canvas-border text-[0.5625rem] font-bold text-ink-400 uppercase tracking-wider">
          <span>Date</span><span>Document</span><span>Description</span><span className="text-right">Amount</span><span>Posted by</span>
        </div>
        {shown.map((l, i) => (
          <div
            key={`${l.docNo}-${i}`}
            className={cn(
              'grid grid-cols-[6rem_7rem_minmax(0,1.5fr)_7rem_minmax(0,0.8fr)] gap-2 px-2.5 py-1 items-center border-b border-canvas-border last:border-b-0',
              l.manual && 'bg-high-50/40',
            )}
          >
            <span className="text-[0.6875rem] text-ink-600 tabular-nums">{l.date}</span>
            <span className="text-[0.6875rem] text-ink-700 truncate flex items-center gap-1" title={l.docNo}>
              {l.manual && <PenLine size={9} className="text-high-700 shrink-0" aria-label="Manual journal" />}
              <span className="truncate">{l.docNo}</span>
            </span>
            <span className="text-[0.6875rem] text-ink-600 truncate" title={l.description}>{l.description}</span>
            <span className="text-[0.6875rem] text-ink-900 tabular-nums text-right">{money(l.amount)}</span>
            <span className="text-[0.6875rem] text-ink-500 truncate" title={l.postedBy}>{l.postedBy}</span>
          </div>
        ))}
      </div>
      {lines.length > shown.length && (
        <p className="text-[0.625rem] text-ink-400 mt-1.5 pl-5">
          Showing the first {shown.length} of {lines.length} lines.
        </p>
      )}
    </div>
  );
}
