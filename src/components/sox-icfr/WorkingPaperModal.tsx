import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, Download, FileSpreadsheet, PenLine, X } from 'lucide-react';
import { controlConclusion, icfrConclusion, openMaterialWeaknesses } from './helpers';
import { downloadControlWorkingPaper, downloadIcfrWorkingPaper } from './icfrWorkingPaper';
import { cn } from '../../lib/cn';
import type { Control, IcfrEngagement } from './types';

// Preview before the file leaves the app: the sign-off block the export will
// carry, and what's inside each sheet. Download happens from here, never directly.
export default function WorkingPaperModal({ eng, control, onClose }: { eng: IcfrEngagement; control?: Control; onClose: () => void }) {
  const so = eng.signoff;
  const conclusion = so.icfrConclusion ?? icfrConclusion(eng);
  const stamped = !!so.icfrConclusion;
  const effective = conclusion !== 'Not effective';
  const mwOpen = openMaterialWeaknesses(eng).length;
  const def = control ? eng.deficiencies.find(d => d.controlId === control.id) : undefined;

  const sheets: { name: string; detail: string }[] = control
    ? [
        { name: 'Control', detail: `${control.wpRef} · ${control.id} · conclusion ${controlConclusion(control)}` },
        { name: 'Design (TOD)', detail: `${control.design.documents.length} documents · ${control.design.points.length} considerations` },
        { name: 'Operating (TOE)', detail: `${control.operating.steps.length} attributes · method ${control.operating.method}` },
        ...(control.operating.sampling?.samples.length ? [{ name: 'Sampling', detail: `${control.operating.sampling.samples.length} sampled items` }] : []),
        ...(def ? [{ name: 'Deficiency', detail: `${def.id} · ${def.status}` }] : []),
      ]
    : [
        { name: 'Index', detail: 'engagement header, materiality, progress' },
        { name: 'Sign-off', detail: 'preparer · countersign · ICFR conclusion' },
        { name: 'Control Summary', detail: `${eng.controls.length} controls` },
        { name: 'Design Testing', detail: `${eng.controls.length} rows` },
        { name: 'Operating Testing', detail: `${eng.controls.reduce((n, c) => n + c.operating.steps.length, 0)} attribute rows` },
        { name: 'Deficiencies', detail: `${eng.deficiencies.length} exceptions` },
        { name: 'Scope', detail: `${eng.accounts.length} significant accounts` },
      ];
  const fileName = control ? `Working_Paper_${control.id}.xlsx` : `Working_Paper_ICFR_${eng.code}.xlsx`;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-[540px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <h3 className="text-[14px] font-bold text-ink-900 inline-flex items-center gap-2"><FileSpreadsheet size={15} className="text-brand-600" /> Working paper — preview</h3>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          {control && (
            <div className="text-[12.5px] text-ink-700"><span className="font-mono font-semibold text-ink-500">{control.wpRef}</span> · {control.description}</div>
          )}

          {/* the sign-off block that travels with the export */}
          <div className="rounded-xl border border-canvas-border bg-paper-50/40 p-3.5 space-y-2">
            <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 inline-flex items-center gap-1.5"><PenLine size={12} /> Sign-off — included in the file</div>
            <div className="flex items-center gap-2 text-[12.5px]">
              {so.preparer ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <Circle size={13} className="text-ink-300 shrink-0" />}
              <span className="text-ink-500 w-[118px]">Prepared by</span>
              <span className={cn('font-medium', so.preparer ? 'text-ink-800' : 'text-ink-400')}>{so.preparer ? `${so.preparer.by} · ${so.preparer.at}` : `${eng.preparer} — not yet signed`}</span>
            </div>
            <div className="flex items-center gap-2 text-[12.5px]">
              {so.reviewer ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <Circle size={13} className="text-ink-300 shrink-0" />}
              <span className="text-ink-500 w-[118px]">Countersigned by</span>
              <span className={cn('font-medium', so.reviewer ? 'text-ink-800' : 'text-ink-400')}>{so.reviewer ? `${so.reviewer.by} · ${so.reviewer.at}` : `${eng.reviewer} — not yet countersigned`}</span>
            </div>
            <div className="flex items-center gap-2 text-[12.5px] pt-1.5 border-t border-canvas-border">
              <span className="text-ink-500 w-[140px] shrink-0">ICFR conclusion</span>
              <span className={cn('font-bold', effective ? 'text-compliant-700' : 'text-risk-700')}>{effective ? 'Effective' : 'Not effective'}</span>
              <span className="text-[11px] text-ink-400">{stamped ? 'stamped at sign-off' : `live — not yet signed${mwOpen ? ` · ${mwOpen} material weakness${mwOpen === 1 ? '' : 'es'} open` : ''}`}</span>
            </div>
          </div>

          {/* what's inside */}
          <div>
            <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 mb-1.5">Sheets in {fileName}</div>
            <div className="space-y-1">
              {sheets.map(s => (
                <div key={s.name} className="flex items-center gap-2.5 text-[12.5px] rounded-lg border border-canvas-border px-3 py-1.5">
                  <FileSpreadsheet size={13} className="text-compliant-600 shrink-0" />
                  <span className="font-semibold text-ink-800 w-[150px]">{s.name}</span>
                  <span className="text-ink-500 truncate">{s.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border">
          <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:bg-paper-50 cursor-pointer">Cancel</button>
          <button onClick={() => { if (control) downloadControlWorkingPaper(eng, control); else downloadIcfrWorkingPaper(eng); onClose(); }}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><Download size={14} /> Download .xlsx</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
