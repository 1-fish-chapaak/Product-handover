import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Circle, ClipboardCheck, ExternalLink, FileSpreadsheet, FileUp, Loader2, MessageSquareWarning,
  Paperclip, Plus, Search, Sparkles, Star, Table2, UploadCloud, X, Check, MessageSquarePlus, RotateCcw,
} from 'lucide-react';
import { useAuditControls } from './useAuditControls';
import { defWord } from './flow';
import { useIcfr } from './store';
import { controlConclusion, trackResult } from './helpers';
import { useToast } from '../shared/Toast';
import { Pill } from '../shared/StatusBadge';
import { NatureChip, Tickmark } from './parts';
import { FilterSelect } from '../shared/FilterSelect';
import ColumnFilter from '../shared/ColumnFilter';
import { cn } from '../../lib/cn';
import { isEngagementLocked } from './helpers';
import { CONTROL_CLASSES } from './types';
import type { Control } from './types';

/** The processes a SOX RACM can be created for — the scoping wizard's seven
 *  plus the two cycles it doesn't scope from the trial balance. A process
 *  already in scope is filtered out at the picker, since the landing lists
 *  exactly one RACM per process; anything outside the list is named by hand. */
const SOX_PROCESSES = [
  'Order to Cash', 'Procure to Pay', 'Record to Report', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax', 'IT General Controls',
];

/** Sentinel for the picker's "name it yourself" option — mirrors the New
 *  control form's "＋ Add new process…". */
const NEW_PROCESS = '__new__';

/** Reads a RACM name out of an uploaded file name — drops the extension and the
 *  RACM/SOP/version noise, then title-cases what's left (the Process Hub rule). */
function racmNameFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/\b(racm|sop|final|draft|v?\d+(\.\d+)*)\b/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
function matrixStatusOf(controls: Control[], engagementId: string): { label: string; tone: Parameters<typeof Pill>[0]['tone'] } {
  const concl = controls.map(controlConclusion);
  if (concl.includes('Ineffective')) return { label: defWord(engagementId).Many, tone: 'risk' };
  if (concl.every(x => x === 'Not started')) return { label: 'Not tested', tone: 'draft' };
  if (concl.every(x => x === 'Effective')) return { label: 'Concluded', tone: 'compliant' };
  return { label: 'In testing', tone: 'evidence' };
}

/**
 * Create RACM — the Process Hub's chooser, carried over to SOX. Two ways in:
 * bring an existing matrix, or let IRA draft one from a procedure. The one
 * thing SOX has to ask that the Process Hub doesn't is WHICH process: the Hub
 * runs inside a single business process, this landing spans all of them.
 */
function NewRacmModal({ available, inScope, onClose, onPick }: {
  /** canonical processes with no RACM yet — the picker's options */
  available: string[];
  /** every process already carrying a RACM — guards a hand-typed duplicate */
  inScope: string[];
  onClose: () => void;
  onPick: (process: string, source: 'racm' | 'sop') => void;
}) {
  // every process may already be in scope — then naming one is the only way in
  const [choice, setChoice] = useState(available[0] ?? NEW_PROCESS);
  const [custom, setCustom] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const process = choice === NEW_PROCESS ? custom.trim() : choice;
  const taken = !!process && inScope.some(p => p.toLowerCase() === process.toLowerCase());
  const ready = !!process && !taken;
  const cardCls = 'text-left rounded-xl border border-canvas-border p-4 transition-colors cursor-pointer hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-canvas-border disabled:hover:bg-transparent';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create RACM">
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Create RACM</h2>
              <p className="text-[12.5px] text-ink-500 mt-0.5">Start from an existing matrix, or extract one from an SOP.</p>
            </div>
            <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Close"><X size={15} /></button>
          </div>
        </div>
        <div className="p-5">
          <label htmlFor="new-racm-process" className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5 block">Business process</label>
          <select id="new-racm-process" value={choice} onChange={e => setChoice(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
            {available.map(p => <option key={p} value={p}>{p}</option>)}
            <option value={NEW_PROCESS}>＋ Name another process…</option>
          </select>
          <p className="text-[11.5px] text-ink-400 mt-1.5">
            {available.length
              ? "Processes already carrying a RACM aren't listed — a process has one."
              : 'Every standard process already has a RACM, so name the new one yourself.'}
          </p>
          {choice === NEW_PROCESS && (
            <input value={custom} onChange={e => setCustom(e.target.value)} autoFocus
              placeholder="e.g. Leases" aria-label="New process name"
              className="w-full h-9 px-3 mt-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
          )}
          {taken && <p className="text-[11.5px] text-risk-700 mt-1.5">{process} already has a RACM — open it from the list instead.</p>}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button onClick={() => onPick(process, 'racm')} disabled={!ready} className={cardCls}>
              <span className="p-2 rounded-lg bg-evidence-50 inline-flex mb-2.5"><FileUp size={15} className="text-evidence-700" /></span>
              <span className="block text-[13px] font-semibold text-ink-900 mb-1">Upload a RACM</span>
              <span className="block text-[11.5px] text-ink-500 leading-relaxed">Import an existing matrix (.xlsx / .csv).</span>
            </button>
            <button onClick={() => onPick(process, 'sop')} disabled={!ready} className={cardCls}>
              <span className="p-2 rounded-lg bg-brand-50 inline-flex mb-2.5"><Sparkles size={15} className="text-brand-600" /></span>
              <span className="block text-[13px] font-semibold text-ink-900 mb-1 flex items-center gap-1.5">Upload an SOP <span className="text-ink-400">→</span> extract</span>
              <span className="block text-[11.5px] text-ink-500 leading-relaxed">IRA reads a procedure (.pdf / .docx) and drafts the RACM.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** SOP → RACM extraction: a docked progress card, not a blocking modal, so the
 *  rest of the tab stays usable while IRA reads the procedure. */
function RacmExtractionOverlay({ filename, onCancel }: { filename: string; onCancel: () => void }) {
  const STEPS = ['Parsing the SOP document', 'Identifying risks & control points', 'Mapping controls to risks', 'Drafting attributes & test procedures'];
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers = STEPS.map((_, i) => window.setTimeout(() => setDone(i + 1), (i + 1) * 380));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-6 right-6 z-[110] w-[360px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_24px_60px_-20px_rgba(15,8,30,.55)] p-4">
      <div className="flex items-start gap-2.5">
        <Loader2 size={15} className="text-brand-600 animate-spin shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-ink-900">Extracting a RACM</p>
          <p className="text-[11.5px] text-ink-400 truncate">{filename}</p>
        </div>
        <button onClick={onCancel} className="text-[11.5px] font-semibold text-ink-400 hover:text-ink-700 cursor-pointer shrink-0">Cancel</button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-[11.5px]">
            {i < done
              ? <CheckCircle2 size={12} className="text-compliant-600 shrink-0" />
              : <Circle size={12} className={cn('shrink-0', i === done ? 'text-brand-500' : 'text-ink-300')} />}
            <span className={i < done ? 'text-ink-600' : i === done ? 'text-ink-800 font-medium' : 'text-ink-400'}>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const { eng, role, openRacmMatrix, createRacm } = useIcfr();
  const { addToast } = useToast();

  // The matrix shows what the OPEN audit covers — its entities' processes.
  // Falls back to every control when no audit is open or its scope is empty.
  const scoped = useAuditControls(eng.controls);
  const processes = useMemo(() => {
    const map = new Map<string, Control[]>();
    scoped.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => ({ name, rows }));
  }, [scoped]);

  // Create RACM — chooser → file picker → (SOP only) extraction → new row.
  const [creating, setCreating] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  const racmFileRef = useRef<HTMLInputElement>(null);
  const sopFileRef = useRef<HTMLInputElement>(null);
  const pendingProcess = useRef<string>('');
  const extractTimer = useRef<number | null>(null);
  useEffect(() => () => { if (extractTimer.current != null) window.clearTimeout(extractTimer.current); }, []);

  const canCreate = role === 'auditor' && !isEngagementLocked(eng);
  const inScope = useMemo(() => processes.map(p => p.name), [processes]);
  const available = useMemo(() => {
    const have = new Set(inScope);
    return SOX_PROCESSES.filter(p => !have.has(p));
  }, [inScope]);

  // the chooser hands back the process + which door; the file picker follows
  const onPick = (process: string, source: 'racm' | 'sop') => {
    pendingProcess.current = process;
    setCreating(false);
    (source === 'racm' ? racmFileRef : sopFileRef).current?.click();
  };

  // an imported matrix lands straight away — there is nothing to read out of it
  const onRacmFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const process = pendingProcess.current;
    e.target.value = '';
    if (!file || !process) return;
    createRacm(process, file.name);
    addToast({ type: 'success', title: 'RACM created', message: `Imported "${file.name}" — the ${process} RACM is now in the list.` });
  };

  // an SOP has to be read first — same staged extraction the Process Hub runs
  const onSopFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const process = pendingProcess.current;
    e.target.value = '';
    if (!file || !process) return;
    setExtracting(file.name);
    extractTimer.current = window.setTimeout(() => {
      extractTimer.current = null;
      setExtracting(null);
      createRacm(process, file.name);
      const label = racmNameFromFilename(file.name);
      addToast({ type: 'success', title: 'RACM extracted', message: `Drafted the ${process} RACM from "${label || file.name}" — review its rows before testing.` });
    }, 1600);
  };

  const cancelExtraction = () => {
    if (extractTimer.current != null) { window.clearTimeout(extractTimer.current); extractTimer.current = null; }
    setExtracting(null);
    addToast({ type: 'info', title: 'Extraction cancelled', message: 'No RACM was created.' });
  };

  return (
    <>
    {/* toolbar — the landing's only action. Per-matrix uploads stay on the
        drilled page (where the process is already fixed); this one creates the
        matrix itself, so it asks which process first. */}
    {canCreate && (
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1" />
        <button onClick={() => setCreating(true)}
          title="Create a RACM for a process — import a matrix, or extract one from an SOP"
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
          <Plus size={15} /> Create RACM
        </button>
      </div>
    )}
    <input ref={racmFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onRacmFile} aria-label="Upload a RACM workbook" />
    <input ref={sopFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onSopFile} aria-label="Upload an SOP to extract a RACM from" />
    {creating && <NewRacmModal available={available} inScope={inScope} onClose={() => setCreating(false)} onPick={onPick} />}
    {extracting && <RacmExtractionOverlay filename={extracting} onCancel={cancelExtraction} />}
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
            const status = matrixStatusOf(rows, eng.id);
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
  const [classF, setClassF] = useState<string[]>([]);
  const [natureF, setNatureF] = useState<string[]>([]);
  const [designF, setDesignF] = useState<string[]>([]);
  const [operatingF, setOperatingF] = useState<string[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [remarkFor, setRemarkFor] = useState<Control | null>(null);
  const [remarkText, setRemarkText] = useState('');
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

  const matrixStatus = useMemo(() => matrixStatusOf(controls, eng.id), [controls, eng.id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return controls.filter(c => {
      if (review === 'Approved' && c.racmReview?.status !== 'Approved') return false;
      if (review === 'Remark' && c.racmReview?.status !== 'Remark') return false;
      if (review === 'Pending' && c.racmReview) return false;
      if (classF.length && !(c.clazz && classF.includes(c.clazz))) return false;
      if (natureF.length && !natureF.includes(c.nature)) return false;
      if (designF.length && !designF.includes(trackResult(c.design))) return false;
      if (operatingF.length && !operatingF.includes(trackResult(c.operating))) return false;
      if (term && !(`${c.id} ${c.wpRef} ${c.riskId} ${c.riskDescription} ${c.description} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      return true;
    }).sort((a, b) => a.wpRef.localeCompare(b.wpRef));
  }, [controls, q, review, classF, natureF, designF, operatingF]);

  const allVisible = filtered.map(c => c.id);
  const allSelected = allVisible.length > 0 && allVisible.every(id => sel.has(id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(allVisible));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const openRemark = (c: Control) => { setRemarkFor(c); setRemarkText(c.racmReview?.status === 'Remark' ? (c.racmReview.remark ?? '') : ''); };
  const saveRemark = () => { if (remarkFor && remarkText.trim()) { remarkRacmRow(remarkFor.id, remarkText.trim()); setRemarkFor(null); } };

  // the row-select column only renders for the auditor (only they have bulk actions)
  // 13 columns: W/P · Risk · Root cause · Control · Nature · Design · Operating ·
  // Performed by · Evidence W/P · Report ref · Pre-testing review · actions (+ select)
  const colSpan = isAuditor ? 14 : 13;

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
              {/* why the risk exists — the source RACM carries it beside the risk,
                  because a control aimed at the symptom is the commonest design gap */}
              <th style={{ width: 200 }} title="The condition underneath the risk — what makes it possible">Root cause</th>
              <th>Control</th>
              <th style={{ width: 104 }} title="The RACM's classification — financial, operational or compliance">
                <span className="inline-flex items-center gap-1">Class
                  <ColumnFilter label="Class" options={[...CONTROL_CLASSES]} value={classF} onChange={setClassF} />
                </span>
              </th>
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
              {/* who did the work, where the evidence lives, and which report
                  paragraph the row lands in — the source RACM's own columns */}
              <th style={{ width: 110 }} title="Who on the audit team performed the work">Performed by</th>
              <th style={{ width: 150 }} title="Where the evidence physically lives — hard-copy file reference and soft-copy path">Evidence W/P</th>
              <th style={{ width: 92 }} title="The paragraph in the issued report this row lands in">Report ref</th>
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
                    {c.rootCause
                      ? <div className="text-[11.5px] text-ink-600 leading-snug line-clamp-2" title={c.rootCause}>{c.rootCause}</div>
                      : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="tight">
                    <div className="flex items-center gap-1.5">
                      {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                      {/* NOT truncated. Cutting the control statement at 300px was
                          the readability complaint itself — you could not read what
                          the control does without opening the row. Two lines, the
                          same clamp the risk and root-cause cells use. */}
                      <span className="font-semibold text-ink-900 text-[12.5px] leading-snug line-clamp-2" title={c.controlActivity ?? c.description}>{c.description}</span>
                      {/* the auditor's verdict — kept loud so the risk owner can't miss it */}
                      {ineffective && <Pill tone="risk">Ineffective</Pill>}
                    </div>
                    {/* the highest-value supporting facts only — identity · sub-process · owner; guarded so an empty field never leaves a dangling middot */}
                    <div className="text-[11px] text-ink-400 mt-0.5 truncate max-w-[360px]" title={[c.id, c.subProcess, c.owner].filter(Boolean).join(' · ')}>
                      {[c.id, c.subProcess, c.owner].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td>{c.clazz ? <Pill tone="draft">{c.clazz}</Pill> : <span className="text-ink-300">—</span>}</td>
                  <td><NatureChip nature={c.nature} small /></td>
                  <td><span className="inline-flex items-center gap-1.5 cursor-help" title={`Design — ${d}`}><Tickmark result={d === 'Effective' ? 'Pass' : d === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} /></span></td>
                  <td><span className="inline-flex items-center gap-1.5 cursor-help" title={`Operating — ${o}`}><Tickmark result={o === 'Effective' ? 'Pass' : o === 'Ineffective' ? 'Fail' : 'Not tested'} size={16} /></span></td>
                  <td>{c.performedBy ? <span className="text-[11.5px] text-ink-600">{c.performedBy}</span> : <span className="text-ink-300">—</span>}</td>
                  <td className="tight">
                    {c.wpRefHard || c.wpRefSoft ? (
                      <>
                        {c.wpRefHard && <div className="font-mono text-[10.5px] text-ink-600" title={`Hard-copy file — ${c.wpRefHard}`}>{c.wpRefHard}</div>}
                        {c.wpRefSoft && <div className="font-mono text-[10px] text-ink-400 truncate max-w-[140px]" title={`Soft-copy path — ${c.wpRefSoft}`}>{c.wpRefSoft}</div>}
                      </>
                    ) : <span className="text-ink-300">—</span>}
                  </td>
                  <td>{c.reportRef ? <span className="font-mono text-[11px] text-ink-600">{c.reportRef}</span> : <span className="text-ink-300">—</span>}</td>
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
