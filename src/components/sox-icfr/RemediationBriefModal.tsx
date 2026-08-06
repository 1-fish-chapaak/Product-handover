import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Download, FileText, X } from 'lucide-react';
import { buildRemediationBrief, type BriefBlock } from './remediationBrief';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { cn } from '../../lib/cn';

// ── The risk owner's document (Step-2 action item 23) ────────────────────────────
// The working paper is the AUDIT's evidence file and the first line never receives
// it: it carries sample lists and results, the materiality thresholds, the severity
// rule set, review notes, override rationales and other people's controls. Handing
// it over tells the auditee exactly what will be tested and at what threshold.
//
// This is the separate artefact they DO get — built from owner-safe fields upwards
// rather than by filtering the paper down. That direction is the whole point: a
// filtered copy of an audit file needs every field to be right forever, and one
// missed field leaks the lot. See remediationBrief.ts for what is and is not read.

function Block({ b }: { b: BriefBlock }) {
  if (b.kind === 'heading') {
    return (
      <div>
        <div className="text-[0.875rem] font-bold text-ink-900" style={{ fontFamily: "'Source Serif 4', serif" }}>{b.text}</div>
        <div className="text-[0.71875rem] text-ink-500 mt-0.5">{b.sub}</div>
      </div>
    );
  }
  if (b.kind === 'kv') {
    return (
      <div>
        {b.title && <div className="text-[0.65625rem] uppercase tracking-wide font-semibold text-ink-400 mb-1.5">{b.title}</div>}
        <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
          {b.rows.map(([k, v], i) => (
            <div key={i} className="flex gap-3 px-3 py-1.5 text-[0.75rem]">
              <span className="w-[150px] shrink-0 text-ink-500">{k}</span>
              <span className="text-ink-800 min-w-0">{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (b.kind === 'table') {
    return (
      <div>
        <div className="text-[0.65625rem] uppercase tracking-wide font-semibold text-ink-400 mb-1.5">{b.title}</div>
        {b.note && <p className="text-[0.6875rem] text-ink-500 mb-1.5">{b.note}</p>}
        {/* Wide content scrolls inside its own box — the sheet must never make
            the page scroll sideways. */}
        <div className="rounded-lg border border-canvas-border overflow-x-auto">
          <table className="w-full text-[0.71875rem]">
            <thead><tr className="border-b border-canvas-border bg-paper-50/60">{b.headers.map(h => <th key={h} className="text-left font-semibold text-ink-500 px-3 py-1.5 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {b.rows.length === 0
                ? <tr><td colSpan={b.headers.length} className="px-3 py-3 text-ink-400">Nothing here.</td></tr>
                : b.rows.map((r, i) => (
                  <tr key={i} className="border-b border-canvas-border/60 last:border-0">
                    {r.map((cell, j) => <td key={j} className="px-3 py-1.5 text-ink-700 align-top">{cell}</td>)}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const tone = b.tone === 'good' ? 'border-compliant-200 bg-compliant-50/40 text-compliant-700'
    : b.tone === 'bad' ? 'border-risk-200 bg-risk-50/40 text-risk-700'
      : 'border-canvas-border bg-paper-50/60 text-ink-600';
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', tone)}>
      <span className="block text-[0.625rem] font-bold uppercase tracking-wider opacity-70 mb-0.5">{b.label}</span>
      <p className="text-[0.71875rem] leading-relaxed">{b.text}</p>
    </div>
  );
}

function download(blocks: BriefBlock[], who: string): void {
  const wb = XLSX.utils.book_new();
  const aoa: (string | number)[][] = [];
  blocks.forEach(b => {
    if (b.kind === 'heading') { aoa.push([b.text], [b.sub]); }
    else if (b.kind === 'kv') { if (b.title) aoa.push([b.title.toUpperCase()]); b.rows.forEach(r => aoa.push(r)); }
    else if (b.kind === 'table') {
      aoa.push([b.title.toUpperCase()]);
      if (b.note) aoa.push([b.note]);
      aoa.push(b.headers, ...b.rows);
    } else { aoa.push([b.label.toUpperCase(), b.text]); }
    aoa.push([]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 60 }, { wch: 28 }, { wch: 28 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Remediation brief');
  XLSX.writeFile(wb, `Remediation_Brief_${who.replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`);
}

export default function RemediationBriefModal({ defId, onClose }: { defId?: string; onClose: () => void }) {
  const { eng, meOwner } = useIcfr();
  const logEvent = useAuditLog();
  const blocks = buildRemediationBrief(eng, meOwner, defId);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal flex flex-col" style={{ maxWidth: 860, maxHeight: '86vh' }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[0.875rem] font-bold text-ink-900 inline-flex items-center gap-2"><FileText size={16} className="text-brand-600" /> Remediation brief</h3>
            <p className="text-[0.75rem] text-ink-500 mt-1">What was found on your controls, what you owe, and what you have already given us. Yours to share with your team.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-900 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {blocks.length === 0
            ? <p className="text-[0.78125rem] text-ink-500 py-8 text-center">Nothing outstanding on your controls.</p>
            : blocks.map((b, i) => <Block key={i} b={b} />)}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <button onClick={onClose} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Close</button>
          <button
            disabled={blocks.length === 0}
            onClick={() => { download(blocks, meOwner); logEvent({ action: 'Export', description: `Downloaded a remediation brief${defId ? ` for ${defId}` : ''} — ${meOwner}`, module: 'SOX ICFR', entity: 'Evidence' }); }}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"><Download size={14} /> Download</button>
        </div>
      </div>
    </div>,
    document.body);
}
