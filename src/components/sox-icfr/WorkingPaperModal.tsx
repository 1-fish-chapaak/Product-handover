import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, Download, FileSpreadsheet, PenLine, X } from 'lucide-react';
import { controlConclusion, icfrConclusion, isControlFinal, isControlLocked, isEngagementLocked, openMaterialWeaknesses } from './helpers';
import { buildControlPaper, downloadControlWorkingPaper, downloadIcfrWorkingPaper, SIGNOFF_TITLE, type PaperBlock } from './icfrWorkingPaper';
import { useIcfr } from './store';
import { cn } from '../../lib/cn';
import type { Control, IcfrEngagement } from './types';

// An irreversible sign-off act (sign / countersign) routes through a one-line
// attest confirm before it commits — a recorded signature can't be taken back.
type AttestReq = { kind: 'sign' | 'counter'; run: () => void };

// The working paper, previewed as the document it exports to: same blocks, same
// reading order as the .xlsx. Sign-off happens here — the auditor signs a
// concluded control's paper, the reviewer countersigns. Download only from here.

const tickCls = (v: string): string =>
  v === 'P' ? 'text-compliant-700 font-bold' : v === 'r' ? 'text-risk-700 font-bold' : 'text-ink-300';

function Block({ b }: { b: PaperBlock }) {
  if (b.kind === 'heading') {
    return (
      <div>
        <div className="text-[14px] font-bold text-ink-900" style={{ fontFamily: "'Source Serif 4', serif" }}>{b.text}</div>
        <div className="text-[11.5px] text-ink-500 mt-0.5">{b.sub}</div>
      </div>
    );
  }
  if (b.kind === 'kv') {
    return (
      <div>
        {b.title && <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 mb-1.5">{b.title}</div>}
        <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
          {b.rows.map(([k, v], i) => (
            <div key={i} className="flex gap-3 px-3 py-1.5 text-[12px]">
              <span className="w-[150px] shrink-0 text-ink-500">{k}</span>
              <span className={cn('text-ink-800 min-w-0', /NOT YET/.test(v) && 'text-ink-400')}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (b.kind === 'table') {
    return (
      <div>
        <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 mb-0.5">{b.title}</div>
        {b.note && <div className="text-[11px] text-ink-400 mb-1.5">{b.note}</div>}
        <div className="rounded-lg border border-canvas-border overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-paper-50/70 text-left">
                {b.headers.map((h, i) => <th key={i} className="px-2.5 py-1.5 font-semibold text-ink-600 whitespace-nowrap border-b border-canvas-border">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-canvas-border">
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td key={ci} className={cn('px-2.5 py-1.5 align-top text-ink-700',
                      b.tickFrom != null && ci >= b.tickFrom ? cn('font-mono text-center whitespace-nowrap', tickCls(cell)) : undefined,
                      ci === 0 && 'font-mono text-ink-400 whitespace-nowrap')}>{cell}</td>
                  ))}
                </tr>
              ))}
              {b.rows.length === 0 && <tr><td colSpan={b.headers.length} className="px-2.5 py-2 text-ink-400">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-[12px]',
      b.tone === 'good' ? 'border-compliant-200 bg-compliant-50/40' : b.tone === 'bad' ? 'border-risk-200 bg-risk-50/40' : 'border-canvas-border bg-paper-50/40')}>
      <span className={cn('font-bold uppercase tracking-wide text-[10.5px] mr-2', b.tone === 'good' ? 'text-compliant-700' : b.tone === 'bad' ? 'text-risk-700' : 'text-ink-500')}>{b.label}</span>
      <span className="text-ink-800">{b.text}</span>
    </div>
  );
}

/** This paper's own sign-off — state rows + the hat's action, in place. */
function ControlSignoff({ eng, c, onAttest }: { eng: IcfrEngagement; c: Control; onAttest: (req: AttestReq) => void }) {
  const { role, me, signOffControlWp } = useIcfr();
  const so = c.wpSignoff;
  const concluded = isControlLocked(c);
  const engLocked = isEngagementLocked(eng);
  // pending review notes hold the countersign — same guard as the store —
  // and the paper's preparer never countersigns their own work (four-eyes)
  const notesPending = eng.reviewNotes.filter(n => n.controlId === c.id && n.status !== 'Closed').length;
  const canSign = role === 'auditor' && concluded && !so?.preparer && !engLocked;
  const canCounter = role === 'reviewer' && !!so?.preparer && !so?.reviewer && !engLocked && notesPending === 0 && so?.preparer?.by !== me;
  return (
    <div className="rounded-xl border border-canvas-border bg-paper-50/40 p-3.5 space-y-2">
      <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 inline-flex items-center gap-1.5"><PenLine size={12} /> {SIGNOFF_TITLE}</div>
      <div className="flex items-center gap-2 text-[12.5px]">
        {so?.preparer ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <Circle size={13} className="text-ink-300 shrink-0" />}
        <span className="text-ink-500 w-[118px] shrink-0">Prepared by</span>
        <span className={cn('font-medium min-w-0 truncate', so?.preparer ? 'text-ink-800' : 'text-ink-400')}>{so?.preparer ? `${so.preparer.by} · ${so.preparer.at}` : `${eng.preparer} — not yet signed`}</span>
        {canSign && (
          <button onClick={() => onAttest({ kind: 'sign', run: () => signOffControlWp(c.id, 'preparer') })}
            className="ml-auto h-7 px-2.5 shrink-0 rounded-lg bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1"><PenLine size={11} /> Sign off this paper</button>
        )}
        {role === 'auditor' && !concluded && !so?.preparer && (
          <span className="ml-auto shrink-0 text-[10.5px] text-ink-400">conclude the control to sign</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12.5px]">
        {so?.reviewer ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <Circle size={13} className="text-ink-300 shrink-0" />}
        <span className="text-ink-500 w-[118px] shrink-0">Countersigned by</span>
        <span className={cn('font-medium min-w-0 truncate', so?.reviewer ? 'text-ink-800' : 'text-ink-400')}>{so?.reviewer ? `${so.reviewer.by} · ${so.reviewer.at}` : `${eng.reviewer} — not yet countersigned`}</span>
        {canCounter && (
          <button onClick={() => onAttest({ kind: 'counter', run: () => signOffControlWp(c.id, 'reviewer') })}
            className="ml-auto h-7 px-2.5 shrink-0 rounded-lg bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1"><PenLine size={11} /> Countersign</button>
        )}
        {role === 'reviewer' && !so?.preparer && (
          <span className="ml-auto shrink-0 text-[10.5px] text-ink-400">waits for the preparer's signature</span>
        )}
        {role === 'reviewer' && !!so?.preparer && !so?.reviewer && notesPending > 0 && (
          <span className="ml-auto shrink-0 text-[10.5px] text-ink-400">{notesPending} review note{notesPending === 1 ? '' : 's'} must close before the countersign</span>
        )}
      </div>
    </div>
  );
}

/** Engagement-level sign-off (the opinion) — same gate as the Overview card. */
function EngagementSignoff({ eng, onAttest }: { eng: IcfrEngagement; onAttest: (req: AttestReq) => void }) {
  const { role, signOffEngagement } = useIcfr();
  const so = eng.signoff;
  const conclusion = so.icfrConclusion ?? icfrConclusion(eng);
  const stamped = !!so.icfrConclusion;
  const effective = conclusion !== 'Not effective';
  const mwOpen = openMaterialWeaknesses(eng).length;
  // same gate as Overview: every paper concluded AND countersigned by the reviewer
  const reviewed = eng.controls.filter(isControlFinal).length;
  const ready = eng.controls.length > 0 && reviewed === eng.controls.length;
  const canSign = role === 'auditor' && ready && !so.preparer;
  const canCounter = role === 'reviewer' && !!so.preparer && !so.reviewer;
  return (
    <div className="rounded-xl border border-canvas-border bg-paper-50/40 p-3.5 space-y-2">
      <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 inline-flex items-center gap-1.5"><PenLine size={12} /> Sign-off — included in the file</div>
      <div className="flex items-center gap-2 text-[12.5px]">
        {so.preparer ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <Circle size={13} className="text-ink-300 shrink-0" />}
        <span className="text-ink-500 w-[118px] shrink-0">Prepared by</span>
        <span className={cn('font-medium min-w-0 truncate', so.preparer ? 'text-ink-800' : 'text-ink-400')}>{so.preparer ? `${so.preparer.by} · ${so.preparer.at}` : `${eng.preparer} — not yet signed`}</span>
        {canSign && (
          <button onClick={() => onAttest({ kind: 'sign', run: () => signOffEngagement('preparer') })}
            className="ml-auto h-7 px-2.5 shrink-0 rounded-lg bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1"><PenLine size={11} /> Sign off as preparer</button>
        )}
        {role === 'auditor' && !ready && !so.preparer && (
          <span className="ml-auto shrink-0 text-[10.5px] text-ink-400">{reviewed}/{eng.controls.length} papers countersigned — sign-off unlocks when every paper is reviewed</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12.5px]">
        {so.reviewer ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <Circle size={13} className="text-ink-300 shrink-0" />}
        <span className="text-ink-500 w-[118px] shrink-0">Countersigned by</span>
        <span className={cn('font-medium min-w-0 truncate', so.reviewer ? 'text-ink-800' : 'text-ink-400')}>{so.reviewer ? `${so.reviewer.by} · ${so.reviewer.at}` : `${eng.reviewer} — not yet countersigned`}</span>
        {canCounter && (
          <button onClick={() => onAttest({ kind: 'counter', run: () => signOffEngagement('reviewer') })}
            className="ml-auto h-7 px-2.5 shrink-0 rounded-lg bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1"><PenLine size={11} /> Countersign</button>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12.5px] pt-1.5 border-t border-canvas-border">
        <span className="text-ink-500 w-[140px] shrink-0">ICFR conclusion</span>
        <span className={cn('font-bold', effective ? 'text-compliant-700' : 'text-risk-700')}>{effective ? 'Effective' : 'Not effective'}</span>
        <span className="text-[11px] text-ink-400">{stamped ? 'stamped at sign-off' : `live — not yet signed${mwOpen ? ` · ${mwOpen} material weakness${mwOpen === 1 ? '' : 'es'} open` : ''}`}</span>
      </div>
    </div>
  );
}

export default function WorkingPaperModal({ eng, control, onClose }: { eng: IcfrEngagement; control?: Control; onClose: () => void }) {
  // an irreversible sign-off waits behind this attest confirm before it commits
  const [attest, setAttest] = useState<AttestReq | null>(null);

  // Escape closes the preview — but while the attest confirm is open it only
  // dismisses that confirm, so a stray Esc can never walk out of a sign-off.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (attest) setAttest(null);
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [attest, onClose]);

  const sheets: { name: string; detail: string }[] = [
    { name: 'Index', detail: 'engagement header, materiality, progress' },
    { name: 'Sign-off', detail: 'preparer · countersign · ICFR conclusion' },
    { name: 'Control Summary', detail: `${eng.controls.length} controls` },
    { name: 'Design Testing', detail: `${eng.controls.length} rows` },
    { name: 'Operating Testing', detail: `${eng.controls.reduce((n, c) => n + c.operating.steps.length, 0)} attribute rows` },
    { name: 'Deficiencies', detail: `${eng.deficiencies.length} exceptions` },
    { name: 'Scope', detail: `${eng.accounts.length} significant accounts` },
  ];
  const fileName = control ? `Working_Paper_${control.id}.xlsx` : `Working_Paper_ICFR_${eng.code}.xlsx`;
  const blocks = control ? buildControlPaper(eng, control) : [];

  return createPortal(
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border shrink-0">
          <h3 className="text-[14px] font-bold text-ink-900 inline-flex items-center gap-2"><FileSpreadsheet size={15} className="text-brand-600" /> Working paper — preview</h3>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0" style={{ maxHeight: 'min(72vh, 760px)' }}>
          {control ? (
            // the paper itself — exactly what the file will contain
            blocks.map((b, i) => {
              if (b.kind === 'kv' && b.title === SIGNOFF_TITLE) return <ControlSignoff key={i} eng={eng} c={control} onAttest={setAttest} />;
              if (b.kind === 'note' && b.label === 'Conclusion') {
                const bad = b.tone === 'bad';
                return (
                  <div key={i} className={cn('rounded-lg border-2 px-3 py-2.5 text-[13px] font-bold inline-flex items-center gap-2',
                    b.tone === 'good' ? 'border-compliant-300 bg-compliant-50/50 text-compliant-700' : bad ? 'border-risk-300 bg-risk-50/50 text-risk-700' : 'border-canvas-border text-ink-600')}>
                    <span className="uppercase tracking-wide text-[10.5px]">Conclusion</span> {b.text}
                  </div>
                );
              }
              return <Block key={i} b={b} />;
            })
          ) : (
            <>
              <EngagementSignoff eng={eng} onAttest={setAttest} />
              <div>
                <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 mb-1.5">Sheets in {fileName}</div>
                {/* a display list of what the file holds — inert rows, not tappable buttons */}
                <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
                  {sheets.map(s => (
                    <div key={s.name} className="flex items-center gap-2.5 text-[12.5px] px-3 py-1.5">
                      <FileSpreadsheet size={13} className="text-compliant-600 shrink-0" />
                      <span className="font-semibold text-ink-800 w-[150px]">{s.name}</span>
                      <span className="text-ink-500 truncate">{s.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-canvas-border shrink-0">
          <span className="text-[11px] text-ink-400 truncate">{fileName}{control ? ` · single sheet, this exact layout · conclusion ${controlConclusion(control)}` : ''}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:bg-paper-50 cursor-pointer">Close</button>
            <button onClick={() => { if (control) downloadControlWorkingPaper(eng, control); else downloadIcfrWorkingPaper(eng); onClose(); }}
              className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><Download size={14} /> Download .xlsx</button>
          </div>
        </div>
      </div>
    </div>

    {/* attest confirm — an irreversible signature never commits on a bare click */}
    {attest && (
      <div className="modal-backdrop" onClick={() => setAttest(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink-900 inline-flex items-center gap-2"><PenLine size={15} className="text-brand-600" /> {attest.kind === 'sign' ? 'Sign off this paper?' : 'Countersign this paper?'}</h2>
              <button onClick={() => setAttest(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
            </div>
          </div>
          <div className="p-5">
            <p className="text-[12.5px] text-ink-600 leading-relaxed">{attest.kind === 'sign' ? 'Confirm — sign off this working paper? Your signature is recorded.' : 'Confirm — countersign? This closes the paper.'}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setAttest(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
              <button onClick={() => { attest.run(); setAttest(null); }} className="h-9 px-3.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"><PenLine size={13} /> {attest.kind === 'sign' ? 'Sign off' : 'Countersign'}</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>,
    document.body,
  );
}
