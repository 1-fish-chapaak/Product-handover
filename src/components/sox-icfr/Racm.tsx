import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Circle, FileSpreadsheet, FlaskConical, MessageSquareWarning,
  Search, Star, Table2, X, Check, MessageSquarePlus, RotateCcw,
} from 'lucide-react';
import { useIcfr } from './store';
import { controlConclusion, trackResult } from './helpers';
import { Pill } from '../shared/StatusBadge';
import { NatureChip, Tickmark } from './parts';
import BulkTestModal from './BulkTestModal';
import { cn } from '../../lib/cn';
import type { Control } from './types';

const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]!; }

type ReviewFilter = 'All' | 'Pending' | 'Approved' | 'Remark';

/** Roll-up status of one RACM — shared by the landing cards and the matrix header. */
function matrixStatusOf(controls: Control[]): { label: string; tone: Parameters<typeof Pill>[0]['tone'] } {
  const concl = controls.map(controlConclusion);
  if (concl.includes('Ineffective')) return { label: 'Exceptions', tone: 'risk' };
  if (concl.every(x => x === 'Not started')) return { label: 'Draft', tone: 'draft' };
  if (concl.every(x => x === 'Effective')) return { label: 'Concluded', tone: 'compliant' };
  return { label: 'In testing', tone: 'evidence' };
}

/**
 * RACM tab landing — one RACM per business process, each shown as a document
 * card. Opening a card shows that process's full risks & controls matrix; the
 * spreadsheet editor stays one click away per RACM.
 */
export function RacmLanding() {
  const { eng, openRacmMatrix, openRacmEditor } = useIcfr();

  const processes = useMemo(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => ({ name, rows }));
  }, [eng.controls]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>RACM</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">One risk &amp; control matrix per business process — open one to review and test its rows.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {processes.map(({ name, rows }) => {
          const status = matrixStatusOf(rows);
          const risks = new Set(rows.map(c => c.riskId)).size;
          const approved = rows.filter(c => c.racmReview?.status === 'Approved').length;
          const remarks = rows.filter(c => c.racmReview?.status === 'Remark').length;
          return (
            <div key={name} role="button" tabIndex={0} aria-label={`Open ${name} RACM`}
              onClick={() => openRacmMatrix(name)} onKeyDown={e => { if (e.key === 'Enter') openRacmMatrix(name); }}
              className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 cursor-pointer hover:border-brand-300 transition-colors group">
              <div className="flex items-start gap-3.5">
                <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Table2 size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: spineColor(name) }} />
                    <h2 className="text-[15px] font-semibold text-ink-900 truncate" style={{ fontFamily: "'Source Serif 4', serif" }}>{name} — RACM</h2>
                    <span className="font-mono text-[11px] text-ink-400">v1.0</span>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </div>
                  <p className="text-[12.5px] text-ink-500 mt-1">{risks} risk{risks === 1 ? '' : 's'} · {rows.length} control{rows.length === 1 ? '' : 's'}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 max-w-[220px] h-2 rounded-full bg-paper-100 overflow-hidden flex">
                      <span className="h-full bg-compliant-500" style={{ width: `${(approved / Math.max(1, rows.length)) * 100}%` }} />
                      <span className="h-full bg-high-400" style={{ width: `${(remarks / Math.max(1, rows.length)) * 100}%` }} />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-400">{approved}/{rows.length} approved</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-canvas-border">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 group-hover:text-brand-800">Open RACM <ArrowRight size={14} /></span>
                <span className="flex-1" />
                <button onClick={e => { e.stopPropagation(); openRacmEditor({ name: `${name} — RACM`, process: name }); }}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer">
                  <FileSpreadsheet size={13} /> Spreadsheet editor
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The auditor's review status on one RACM row — approval, remark, or pending. */
function ReviewCell({ c }: { c: Control }) {
  const r = c.racmReview;
  if (!r) return <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400"><Circle size={11} /> Pending review</span>;
  if (r.status === 'Approved') {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-compliant-700"><CheckCircle2 size={13} /> Approved</span>
        <span className="text-[10.5px] text-ink-400">{r.by} · {r.at}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5 min-w-0">
      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-high-700"><MessageSquareWarning size={13} /> Remark</span>
      <span className="text-[10.5px] text-ink-500 truncate max-w-[200px]" title={r.remark}>{r.remark}</span>
    </span>
  );
}

/**
 * One business process's RACM — the full risks & controls matrix, rows in W/P
 * order. Every row carries the auditor's approval / remark status; the
 * spreadsheet editor remains one click away for cell-by-cell editing.
 */
export default function Racm() {
  const { eng, role, racmProcess, setView, openRacmEditor, openControl, approveRacmRows, remarkRacmRow, clearRacmReview } = useIcfr();
  const [q, setQ] = useState('');
  const [review, setReview] = useState<ReviewFilter>('All');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [remarkFor, setRemarkFor] = useState<Control | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [bulkTestIds, setBulkTestIds] = useState<string[] | null>(null);

  const isAuditor = role === 'auditor';
  const proc = racmProcess ?? eng.controls[0]?.process ?? '';
  const controls = useMemo(() => eng.controls.filter(c => c.process === proc), [eng.controls, proc]);

  const counts = useMemo(() => ({
    approved: controls.filter(c => c.racmReview?.status === 'Approved').length,
    remarks: controls.filter(c => c.racmReview?.status === 'Remark').length,
    pending: controls.filter(c => !c.racmReview).length,
  }), [controls]);

  const matrixStatus = useMemo(() => matrixStatusOf(controls), [controls]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return controls.filter(c => {
      if (review === 'Approved' && c.racmReview?.status !== 'Approved') return false;
      if (review === 'Remark' && c.racmReview?.status !== 'Remark') return false;
      if (review === 'Pending' && c.racmReview) return false;
      if (term && !(`${c.id} ${c.wpRef} ${c.riskId} ${c.riskDescription} ${c.description} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      return true;
    }).sort((a, b) => a.wpRef.localeCompare(b.wpRef));
  }, [controls, q, review]);

  const allVisible = filtered.map(c => c.id);
  const allSelected = allVisible.length > 0 && allVisible.every(id => sel.has(id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(allVisible));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const openRemark = (c: Control) => { setRemarkFor(c); setRemarkText(c.racmReview?.status === 'Remark' ? (c.racmReview.remark ?? '') : ''); };
  const saveRemark = () => { if (remarkFor && remarkText.trim()) { remarkRacmRow(remarkFor.id, remarkText.trim()); setRemarkFor(null); } };

  const risks = new Set(controls.map(c => c.riskId)).size;
  const colSpan = isAuditor ? 9 : 8;

  const reviewChip = (id: ReviewFilter, label: string, n: number, Icon: typeof CheckCircle2, cls: string) => (
    <button onClick={() => setReview(review === id ? 'All' : id)}
      className={cn('view-chip', review === id && 'on')} title={`${n} ${label.toLowerCase()}`}>
      <Icon size={12} className={review === id ? undefined : cls} /> {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <div>
      <button onClick={() => setView('racm')} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors mb-3">
        <ArrowLeft size={14} /> RACMs
      </button>
      {/* header — this process's RACM */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: spineColor(proc) }} />
            <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>{proc} — Risk &amp; Control Matrix</h1>
            <span className="font-mono text-[11px] text-ink-400">v1.0</span>
            <Pill tone={matrixStatus.tone}>{matrixStatus.label}</Pill>
          </div>
          <p className="text-[13px] text-ink-500 mt-0.5">{eng.entity} · {risks} risks · {controls.length} controls</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAuditor && (
            <button onClick={() => setBulkTestIds(sel.size ? Array.from(sel) : filtered.map(c => c.id))}
              title={sel.size ? `Bulk test the ${sel.size} selected rows` : 'Bulk test all rows in view'}
              className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] font-semibold text-ink-700 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer">
              <FlaskConical size={14} /> {sel.size > 0 ? <>Bulk test <span className="tabular-nums text-brand-700">({sel.size})</span></> : <>Bulk test all <span className="tabular-nums text-ink-400">({filtered.length})</span></>}
            </button>
          )}
          <button onClick={() => openRacmEditor({ name: `${proc} — RACM`, process: proc })}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
            <FileSpreadsheet size={15} /> Open spreadsheet editor
          </button>
        </div>
      </div>

      {/* auditor-review summary — the approval state of the matrix at a glance */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mr-0.5">Auditor review</span>
        {reviewChip('Approved', 'Approved', counts.approved, CheckCircle2, 'text-compliant-600')}
        {reviewChip('Remark', 'Remarks', counts.remarks, MessageSquareWarning, 'text-high-600')}
        {reviewChip('Pending', 'Pending', counts.pending, Circle, 'text-ink-400')}
        <div className="flex-1 min-w-[120px] max-w-[260px] h-2 rounded-full bg-paper-100 overflow-hidden flex ml-1">
          <span className="h-full bg-compliant-500" style={{ width: `${(counts.approved / Math.max(1, controls.length)) * 100}%` }} />
          <span className="h-full bg-high-400" style={{ width: `${(counts.remarks / Math.max(1, controls.length)) * 100}%` }} />
        </div>
        <span className="text-[11px] tabular-nums text-ink-400">{counts.approved}/{controls.length} approved</span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search risks, controls, owners…" className="h-9 w-60 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
      </div>

      {/* the matrix — flat rows in W/P order (already scoped to one process) */}
      <div className="reg-wrap">
        <table className="w-full border-collapse">
          <thead className="reg-head">
            <tr>
              {isAuditor && <th style={{ width: 34 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer accent-brand-600" aria-label="Select all rows" /></th>}
              <th style={{ width: 64 }}>W/P</th>
              <th style={{ width: 230 }}>Risk</th>
              <th>Control</th>
              <th style={{ width: 96 }}>Nature</th>
              <th style={{ width: 84 }}>① Design</th>
              <th style={{ width: 84 }}>② Operating</th>
              <th style={{ width: 220 }}>Auditor review</th>
              <th style={{ width: 76 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const d = trackResult(c.design); const o = trackResult(c.operating);
              return (
                <tr key={c.id} className={cn('reg-row', sel.has(c.id) && 'sel')} onClick={() => openControl(c.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openControl(c.id); }} role="button" aria-label={`Open ${c.id} — ${c.description}`}>
                  {/* toggle from the input's change only — a td-level toggle would double-fire when the checkbox itself is clicked */}
                  {isAuditor && <td onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) toggle(c.id); }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer accent-brand-600" aria-label={`Select ${c.id}`} /></td>}
                  <td><span className="wp-ref">{c.wpRef}</span></td>
                  <td className="tight">
                    <div className="font-mono text-[10.5px] font-bold text-ink-500">{c.riskId}</div>
                    <div className="text-[11.5px] text-ink-600 leading-snug line-clamp-2">{c.riskDescription}</div>
                  </td>
                  <td className="tight">
                    <div className="flex items-center gap-1.5">
                      {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                      <span className="font-semibold text-ink-900 text-[12.5px] truncate max-w-[340px]">{c.description}</span>
                    </div>
                    <div className="text-[11px] text-ink-400 mt-0.5">{c.id} · {c.subProcess} · {c.frequency} · {c.owner} · {c.assertions[0]}{c.assertions.length > 1 ? ` +${c.assertions.length - 1}` : ''}</div>
                  </td>
                  <td><NatureChip nature={c.nature} small /></td>
                  <td><span className="inline-flex items-center gap-1.5"><Tickmark result={d === 'Effective' ? 'Pass' : d === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} /></span></td>
                  <td><span className="inline-flex items-center gap-1.5"><Tickmark result={o === 'Effective' ? 'Pass' : o === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} /></span></td>
                  <td><ReviewCell c={c} /></td>
                  <td onClick={e => e.stopPropagation()}>
                    {isAuditor && (
                      <span className="inline-flex items-center gap-1">
                        {c.racmReview?.status === 'Approved' ? (
                          <button onClick={() => clearRacmReview(c.id)} title="Withdraw approval" aria-label={`Withdraw approval on ${c.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border text-ink-400 hover:text-ink-700 hover:border-ink-300 transition-colors cursor-pointer"><RotateCcw size={12} /></button>
                        ) : (
                          <button onClick={() => approveRacmRows([c.id])} title="Approve row" aria-label={`Approve ${c.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border text-compliant-700 hover:bg-compliant-50 hover:border-compliant-300 transition-colors cursor-pointer"><Check size={13} /></button>
                        )}
                        <button onClick={() => openRemark(c)} title="Add remark" aria-label={`Remark on ${c.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border text-high-700 hover:bg-high-50 hover:border-high-300 transition-colors cursor-pointer"><MessageSquarePlus size={13} /></button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={colSpan} className="text-center py-16 text-ink-400 text-[13px]">
                <Table2 size={20} className="mx-auto mb-2 opacity-40" /> No RACM rows match these filters. <button onClick={() => { setQ(''); setReview('All'); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[11.5px] text-ink-400">Showing {filtered.length} of {controls.length} rows</div>

      {/* bulk bar — test and approve controls in one go */}
      {isAuditor && sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-2.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,8,30,0.6)]">
          <span className="text-[12.5px] font-semibold">{sel.size} selected</span>
          <span className="w-px h-5 bg-white/20" />
          <button onClick={() => { setBulkTestIds(Array.from(sel)); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FlaskConical size={14} /> Test controls</button>
          <button onClick={() => { approveRacmRows(Array.from(sel)); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><CheckCircle2 size={14} /> Approve rows</button>
          <button onClick={() => setSel(new Set())} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      {/* bulk test — compile files → attach unique datasets → execute */}
      {bulkTestIds && <BulkTestModal controlIds={bulkTestIds} onClose={() => setBulkTestIds(null)} />}

      {/* remark modal */}
      {remarkFor && (
        <div className="modal-backdrop" onClick={() => setRemarkFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900">Remark — <span className="wp-ref">{remarkFor.wpRef}</span></h2>
                <button onClick={() => setRemarkFor(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
              <p className="text-[12px] text-ink-500 mt-1 line-clamp-2">{remarkFor.description}</p>
            </div>
            <div className="p-5">
              <textarea value={remarkText} onChange={e => setRemarkText(e.target.value)} rows={4} autoFocus
                placeholder="What must change before this row can be approved?"
                className="w-full rounded-lg border border-canvas-border bg-canvas-elevated p-3 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
              <div className="mt-3 flex items-center justify-end gap-2">
                {remarkFor.racmReview && (
                  <button onClick={() => { clearRacmReview(remarkFor.id); setRemarkFor(null); }} className="h-9 px-3 mr-auto text-[12.5px] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Clear review</button>
                )}
                <button onClick={() => setRemarkFor(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={saveRemark} disabled={!remarkText.trim()} className="h-9 px-3.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer">Save remark</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
