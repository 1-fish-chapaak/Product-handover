import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Circle, ClipboardCheck, ExternalLink, FileSpreadsheet, FlaskConical, Loader2, MessageSquareWarning,
  Paperclip, Search, Star, Table2, UploadCloud, X, Check, MessageSquarePlus, RotateCcw,
} from 'lucide-react';
import { useIcfr } from './store';
import { controlConclusion, trackResult } from './helpers';
import { useToast } from '../shared/Toast';
import { Pill } from '../shared/StatusBadge';
import { NatureChip, Tickmark } from './parts';
import { FilterSelect } from '../shared/FilterSelect';
import BulkTestModal from './BulkTestModal';
import ColumnFilter from '../shared/ColumnFilter';
import { cn } from '../../lib/cn';
import type { Control } from './types';

const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]!; }

// The spreadsheet editor opens in its own tab (the Process Hub pattern) — same
// racmId the in-app editor used, so persisted edits stay attached to the sheet.
function openEditorTab(engId: string, process: string): void {
  const params = new URLSearchParams({
    view: 'racm-full-editor',
    racmId: `sox-racm-${engId}-${process.replace(/\s+/g, '-').toLowerCase()}`,
    racmName: `${process} — RACM`,
    processLabel: process,
  });
  window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
}

type ReviewFilter = 'All' | 'Pending' | 'Approved' | 'Remark';

/** Roll-up status of one RACM — shared by the landing cards and the matrix header. */
function matrixStatusOf(controls: Control[]): { label: string; tone: Parameters<typeof Pill>[0]['tone'] } {
  const concl = controls.map(controlConclusion);
  if (concl.includes('Ineffective')) return { label: 'Exceptions', tone: 'risk' };
  if (concl.every(x => x === 'Not started')) return { label: 'Not tested', tone: 'draft' };
  if (concl.every(x => x === 'Effective')) return { label: 'Concluded', tone: 'compliant' };
  return { label: 'In testing', tone: 'evidence' };
}

/**
 * RACM tab landing — one RACM per business process, one row per RACM in the
 * module's register-table language. Every fact the old document cards carried
 * survives as a column: title (icon tile, spine colour, version), matrix
 * status, risk / control counts, the pre-testing review meter, and the row's
 * actions. Clicking a row opens that process's full risks & controls matrix;
 * the spreadsheet editor stays one click away per RACM.
 */
export function RacmLanding() {
  const { eng, openRacmMatrix } = useIcfr();

  const processes = useMemo(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => ({ name, rows }));
  }, [eng.controls]);

  return (
    <>
    {/* uploads live inside each process's matrix — a RACM is per-process, so the
        drilled page (where the process is fixed) owns the "Upload RACM / SOP" */}
    <div className="reg-wrap">
      <table className="w-full border-collapse">
        <thead className="reg-head">
          <tr>
            <th>RACM</th>
            <th style={{ width: 118 }}>Status</th>
            <th style={{ width: 64 }}>Risks</th>
            <th style={{ width: 82 }}>Controls</th>
            <th style={{ width: 236 }}>Pre-testing review</th>
            <th style={{ width: 230 }} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {processes.map(({ name, rows }) => {
            const status = matrixStatusOf(rows);
            const risks = new Set(rows.map(c => c.riskId)).size;
            const approved = rows.filter(c => c.racmReview?.status === 'Approved').length;
            const remarks = rows.filter(c => c.racmReview?.status === 'Remark').length;
            return (
              <tr key={name} className="reg-row" role="button" tabIndex={0} aria-label={`Open ${name} RACM`}
                onClick={() => openRacmMatrix(name)} onKeyDown={e => { if (e.key === 'Enter') openRacmMatrix(name); }}>
                <td>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Table2 size={15} /></span>
                    <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: spineColor(name) }} aria-hidden />
                    <span className="text-[13.5px] font-semibold text-ink-900 truncate" style={{ fontFamily: "'Source Serif 4', serif" }}>{name} — RACM</span>
                    <span className="font-mono text-[11px] text-ink-400 shrink-0">v1.0</span>
                  </span>
                </td>
                <td><Pill tone={status.tone}>{status.label}</Pill></td>
                <td><span className="tabular-nums font-medium text-ink-600">{risks}</span></td>
                <td><span className="tabular-nums font-medium text-ink-600">{rows.length}</span></td>
                <td>
                  <span className="flex items-center gap-2">
                    <span className="w-[120px] h-2 rounded-full bg-paper-100 overflow-hidden flex shrink-0">
                      <span className="h-full bg-compliant-500" style={{ width: `${(approved / Math.max(1, rows.length)) * 100}%` }} />
                      <span className="h-full bg-high-400" style={{ width: `${(remarks / Math.max(1, rows.length)) * 100}%` }} />
                    </span>
                    <span className="text-[11px] tabular-nums text-ink-400 whitespace-nowrap">{approved}/{rows.length} approved</span>
                  </span>
                </td>
                <td>
                  <span className="flex items-center justify-end">
                    <button onClick={e => { e.stopPropagation(); openEditorTab(eng.id, name); }}
                      title="Opens in a new tab" aria-label="Open spreadsheet editor in a new tab"
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12px] font-semibold text-ink-600 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer whitespace-nowrap">
                      <FileSpreadsheet size={13} /> Spreadsheet editor <ExternalLink size={12} className="text-ink-400" />
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

/** The auditor's review status on one RACM row — approval, remark, or pending. */
function ReviewCell({ c }: { c: Control }) {
  const r = c.racmReview;
  if (!r) return <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400"><Circle size={11} /> Pending review</span>;
  if (r.status === 'Approved') {
    // pre-testing review pass — reads as "ready to test", NOT a tested-effective
    // result; distinct icon + wording keep it clear of the ✓ test tickmarks.
    return (
      <span className="inline-flex flex-col gap-0.5 min-w-0">
        <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-compliant-700"><ClipboardCheck size={13} /> Ready to test</span>
        {/* who + when only — "Approved" is already said by the headline above */}
        <span className="text-[10.5px] text-ink-400 truncate max-w-[180px]" title={`Approved · ${r.by} · ${r.at}`}>{r.by} · {r.at}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5 min-w-0">
      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-high-700"><MessageSquareWarning size={13} /> Remark</span>
      <span className="text-[10.5px] text-ink-500 truncate max-w-[180px]" title={r.remark}>{r.remark}</span>
    </span>
  );
}

/**
 * One business process's RACM — the full risks & controls matrix, rows in W/P
 * order. Every row carries the auditor's approval / remark status; the
 * spreadsheet editor remains one click away for cell-by-cell editing.
 */
export default function Racm() {
  const { eng, role, racmProcess, openControl, approveRacmRows, remarkRacmRow, clearRacmReview, racmDocs, addRacmDoc } = useIcfr();
  const { addToast } = useToast();
  const [q, setQ] = useState('');
  const [review, setReview] = useState<ReviewFilter>('All');
  // column filters — empty array = column unfiltered
  const [natureF, setNatureF] = useState<string[]>([]);
  const [designF, setDesignF] = useState<string[]>([]);
  const [operatingF, setOperatingF] = useState<string[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [remarkFor, setRemarkFor] = useState<Control | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [bulkTestIds, setBulkTestIds] = useState<string[] | null>(null);
  // a bulk approve whose selection carries open remarks waits behind a confirm
  const [bulkApproveIds, setBulkApproveIds] = useState<string[] | null>(null);
  // Upload a RACM / SOP for THIS process — the drilled page is where the
  // process is fixed, so the doc pins to this matrix and the toast names it.
  const [importing, setImporting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAuditor = role === 'auditor';
  const proc = racmProcess ?? eng.controls[0]?.process ?? '';
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setImporting(f.name);
    window.setTimeout(() => {
      addRacmDoc(f.name, proc);
      setImporting(null);
      addToast({ type: 'success', title: 'Imported', message: `${f.name} attached to ${proc} — RACM. Rows and test attributes read from the document.` });
    }, 1600);
  };
  const myDocs = racmDocs.filter(d => !d.process || d.process === proc);
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
      if (natureF.length && !natureF.includes(c.nature)) return false;
      if (designF.length && !designF.includes(trackResult(c.design))) return false;
      if (operatingF.length && !operatingF.includes(trackResult(c.operating))) return false;
      if (term && !(`${c.id} ${c.wpRef} ${c.riskId} ${c.riskDescription} ${c.description} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      return true;
    }).sort((a, b) => a.wpRef.localeCompare(b.wpRef));
  }, [controls, q, review, natureF, designF, operatingF]);

  const allVisible = filtered.map(c => c.id);
  const allSelected = allVisible.length > 0 && allVisible.every(id => sel.has(id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(allVisible));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const openRemark = (c: Control) => { setRemarkFor(c); setRemarkText(c.racmReview?.status === 'Remark' ? (c.racmReview.remark ?? '') : ''); };
  const saveRemark = () => { if (remarkFor && remarkText.trim()) { remarkRacmRow(remarkFor.id, remarkText.trim()); setRemarkFor(null); } };

  // the row-select column only renders for the auditor (only they have bulk actions)
  const colSpan = isAuditor ? 9 : 8;

  return (
    <div>
      {/* header — this process's RACM. Getting back up is the breadcrumb's job
          (rendered by the shell): Engagements / engagement / RACM / this matrix. */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: spineColor(proc) }} />
            <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>{proc} — Risk &amp; Control Matrix</h1>
            <span className="font-mono text-[11px] text-ink-400">v1.0</span>
            <Pill tone={matrixStatus.tone}>{matrixStatus.label}</Pill>
          </div>
        </div>
      </div>

      {/* toolbar — search + status filter on the left, the matrix's actions on the right */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search risks, controls, owners…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <FilterSelect prefix="Status" engaged={review !== 'All'} value={review}
          options={[
            { value: 'All', label: `All (${controls.length})` },
            { value: 'Approved', label: `Approved (${counts.approved})` },
            { value: 'Remark', label: `Remarks (${counts.remarks})` },
            { value: 'Pending', label: `Pending (${counts.pending})` },
          ]}
          onChange={v => setReview(v as ReviewFilter)} ariaLabel="Filter by review status" />
        <div className="flex-1" />
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.docx" className="hidden" onChange={onPickFile} aria-label="Upload RACM or SOP document" />
        <button onClick={() => fileRef.current?.click()} disabled={!!importing}
          title={`Upload a RACM workbook or SOP for ${proc} — rows and test attributes are read from the document`}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] font-semibold text-ink-700 hover:text-brand-700 hover:border-brand-300 disabled:opacity-60 transition-colors cursor-pointer">
          {importing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} {importing ? 'Importing…' : 'Upload RACM / SOP'}
        </button>
        {isAuditor && <button onClick={() => setBulkTestIds(sel.size ? Array.from(sel) : filtered.map(c => c.id))}
          title={sel.size ? `Bulk test the ${sel.size} selected rows` : 'Bulk test all rows in view'}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] font-semibold text-ink-700 hover:text-brand-700 hover:border-brand-300 transition-colors cursor-pointer">
          <FlaskConical size={14} /> {sel.size > 0 ? <>Bulk test <span className="tabular-nums text-brand-700">({sel.size})</span></> : <>Bulk test all <span className="tabular-nums text-ink-400">({filtered.length})</span></>}
        </button>}
        <button onClick={() => openEditorTab(eng.id, proc)}
          title="Opens in a new tab" aria-label="Open spreadsheet editor in a new tab"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
          <FileSpreadsheet size={15} /> Open spreadsheet editor <ExternalLink size={13} className="opacity-80" />
        </button>
      </div>

      {/* source documents pinned to the matrix */}
      {myDocs.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Source documents</span>
          {myDocs.map(d => (
            <span key={d.id} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[11.5px] font-medium text-ink-700">
              <Paperclip size={11} className="text-ink-400" /> {d.name}
              <span className="text-ink-400">· {d.uploadedAt}</span>
            </span>
          ))}
        </div>
      )}

      {/* the matrix — flat rows in W/P order (already scoped to one process).
          The tickmark legend is VISIBLE — hover-titles alone fail touch and
          keyboard users, and Design→Operating is the one rule worth teaching. */}
      <div className="flex items-center gap-1.5 mb-2 text-[11.5px] text-ink-400">
        <span className="text-compliant-700 font-semibold">✓</span> effective
        <span className="text-ink-300" aria-hidden>·</span>
        <span className="text-risk-700 font-semibold">✗</span> ineffective
        <span className="text-ink-300" aria-hidden>·</span>
        <span className="font-semibold">–</span> not tested
        <span className="text-ink-300" aria-hidden>·</span>
        <span>Design → Operating is the test order</span>
      </div>
      <div className="reg-wrap">
        <table className="w-full border-collapse">
          <thead className="reg-head">
            <tr>
              {isAuditor && <th style={{ width: 34 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer accent-brand-600" aria-label="Select all rows" /></th>}
              <th style={{ width: 56 }} title="Working-paper reference">W/P</th>
              <th style={{ width: 200 }}>Risk</th>
              <th>Control</th>
              <th style={{ width: 104 }}>
                <span className="inline-flex items-center gap-1">Nature
                  <ColumnFilter label="Nature" options={['Manual', 'Automated', 'IT-dependent']} value={natureF} onChange={setNatureF} />
                </span>
              </th>
              <th style={{ width: 88 }} title="Test of design — tested first; operating unlocks after design passes">
                <span className="inline-flex items-center gap-1">Design
                  <ColumnFilter label="Design" options={['Effective', 'Ineffective', 'Not tested']} value={designF} onChange={setDesignF} />
                </span>
              </th>
              <th style={{ width: 104 }} title="Test of operating effectiveness — tested after design">
                <span className="inline-flex items-center gap-1">Operating
                  <ColumnFilter label="Operating" options={['Effective', 'Ineffective', 'Not tested']} value={operatingF} onChange={setOperatingF} />
                </span>
              </th>
              <th style={{ width: 200 }} title="Approving a row means the control as documented is ready to test">Pre-testing review</th>
              <th style={{ width: 88 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const d = trackResult(c.design); const o = trackResult(c.operating);
              const ineffective = controlConclusion(c) === 'Ineffective';
              return (
                <tr key={c.id} className={cn('reg-row', sel.has(c.id) && 'sel')} onClick={() => openControl(c.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openControl(c.id); }} role="button" aria-label={`Open ${c.id} — ${c.description}`}
                  style={ineffective ? { boxShadow: 'inset 3px 0 0 var(--color-risk-500)' } : undefined}>
                  {/* row-select — auditor only (they alone have bulk actions); toggle from the input's change only, a td-level toggle would double-fire when the checkbox itself is clicked */}
                  {isAuditor && <td onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) toggle(c.id); }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer accent-brand-600" aria-label={`Select ${c.id}`} /></td>}
                  <td><span className="wp-ref">{c.wpRef}</span></td>
                  <td className="tight">
                    <div className="font-mono text-[10.5px] font-bold text-ink-500">{c.riskId}</div>
                    <div className="text-[11.5px] text-ink-600 leading-snug line-clamp-2" title={c.riskDescription}>{c.riskDescription}</div>
                  </td>
                  <td className="tight">
                    <div className="flex items-center gap-1.5">
                      {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                      <span className="font-semibold text-ink-900 text-[12.5px] truncate max-w-[300px]" title={c.description}>{c.description}</span>
                      {/* the auditor's verdict — kept loud so the risk owner can't miss it */}
                      {ineffective && <Pill tone="risk">Ineffective</Pill>}
                    </div>
                    {/* the highest-value supporting facts only — identity · sub-process · owner; guarded so an empty field never leaves a dangling middot */}
                    <div className="text-[11px] text-ink-400 mt-0.5 truncate max-w-[360px]" title={[c.id, c.subProcess, c.owner].filter(Boolean).join(' · ')}>
                      {[c.id, c.subProcess, c.owner].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td><NatureChip nature={c.nature} small /></td>
                  <td><span className="inline-flex items-center gap-1.5 cursor-help" title={`Design — ${d}`}><Tickmark result={d === 'Effective' ? 'Pass' : d === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} /></span></td>
                  <td><span className="inline-flex items-center gap-1.5 cursor-help" title={`Operating — ${o}`}><Tickmark result={o === 'Effective' ? 'Pass' : o === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} /></span></td>
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
                <Table2 size={20} className="mx-auto mb-2 opacity-40" /> No RACM rows match these filters. <button onClick={() => { setQ(''); setReview('All'); setNatureF([]); setDesignF([]); setOperatingF([]); }} className="text-brand-700 font-semibold hover:underline">Clear filters</button>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-[11.5px] text-ink-400">Showing {filtered.length} of {controls.length} rows</div>

      {/* bulk bar — testing and approving rows are both the auditor's lane (D1); non-auditors have no bulk actions, so no checkboxes and no bar */}
      {isAuditor && sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-2.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,8,30,0.6)]">
          <span className="text-[12.5px] font-semibold">{sel.size} selected</span>
          <span className="w-px h-5 bg-white/20" />
          {isAuditor && <button onClick={() => { setBulkTestIds(Array.from(sel)); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><FlaskConical size={14} /> Test controls</button>}
          {isAuditor && <button onClick={() => {
            const ids = Array.from(sel);
            // approving over an open remark erases it — that never happens silently
            const remarked = ids.filter(id => controls.find(c => c.id === id)?.racmReview?.status === 'Remark').length;
            if (remarked > 0) { setBulkApproveIds(ids); return; }
            approveRacmRows(ids); setSel(new Set());
          }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12.5px] font-semibold transition-colors cursor-pointer"><CheckCircle2 size={14} /> Approve rows</button>}
          <button onClick={() => setSel(new Set())} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      {/* bulk test — compile files → attach unique datasets → execute */}
      {bulkTestIds && <BulkTestModal controlIds={bulkTestIds} onClose={() => setBulkTestIds(null)} />}

      {/* bulk approve over open remarks — say what gets erased before it is */}
      {bulkApproveIds && (() => {
        const remarked = bulkApproveIds.filter(id => controls.find(c => c.id === id)?.racmReview?.status === 'Remark').length;
        return (
          <div className="modal-backdrop" onClick={() => setBulkApproveIds(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-ink-900">Approve {bulkApproveIds.length} row{bulkApproveIds.length === 1 ? '' : 's'}?</h2>
                  <button onClick={() => setBulkApproveIds(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
                </div>
              </div>
              <div className="p-5">
                <p className="text-[12.5px] text-ink-600 leading-relaxed">{remarked} of them {remarked === 1 ? 'has an open remark' : 'have open remarks'} — approving clears {remarked === 1 ? 'it' : 'them'} from the record.</p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => setBulkApproveIds(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                  <button onClick={() => { approveRacmRows(bulkApproveIds); setSel(new Set()); setBulkApproveIds(null); }}
                    className="h-9 px-3.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Approve anyway</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
