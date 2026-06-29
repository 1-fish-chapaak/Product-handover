// Smart Upload → report-template. Drops the old "trust the black box" flow for a
// transparent, side-by-side review canvas: the uploaded document on the left, the
// AI-detected sections on the right with an evidence-grounded signal, inline
// rename / delete-with-undo / drag-reorder / add, two-way jump-to-source, and a
// format-match verdict when checking against a reference format.
// (Template Studio §4–§5 — "AI proposes, the human curates.")

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { motion, Reorder, useDragControls } from 'motion/react';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, XCircle,
  Plus, Trash2, CornerDownRight, ShieldCheck, GripVertical, Tag,
  ArrowUpToLine, ArrowDownToLine, ChevronLeft, ChevronRight, Check, X,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { Skeleton } from '../shared/Skeleton';
import { REPORT_TYPES, sectionCoverage, typeSectionsFor, type ReportTypeName, type EditableTemplate, type TypeSection } from './reportShared';

// We can't yet score a model "confidence", so the badge is grounded in the kind
// of evidence the detector actually has: an explicit styled heading, a heading
// inferred from surrounding content, or a fragment that may not be a heading at
// all. Honest labels beat a confidence colour we can't back up (§4 checklist).
type Evidence = 'explicit' | 'inferred' | 'fragment' | 'added';
type DetectedSection = { id: string; name: string; evidence: Evidence };

const EVIDENCE_META: Record<Evidence, { label: string; pill: string; dot: string; tint: string; text: string; flag: boolean }> = {
  explicit: { label: 'Explicit heading', pill: 'bg-compliant-50 text-compliant-700 border-compliant', dot: 'bg-compliant-500', tint: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', flag: false },
  inferred: { label: 'Inferred — review', pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated', dot: 'bg-mitigated-500', tint: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', flag: true },
  fragment: { label: 'Possible fragment', pill: 'bg-high-50 text-high-700 border-high', dot: 'bg-high-500', tint: 'bg-high-50 text-high-700', text: 'text-high-700', flag: true },
  added: { label: 'Added for type', pill: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-500', tint: 'bg-brand-50 text-brand-700', text: 'text-brand-700', flag: false },
};

type FormatReference = { templateName: string; sections: string[] };

type Verdict =
  | { kind: 'match' }
  | { kind: 'drift'; missing: string[]; added: string[]; reordered: boolean }
  | { kind: 'mismatch' };

const norm = (s: string) => s.trim().toLowerCase();

// Segmented coverage meter — one pip per required/recommended section, filled as
// the document covers it. Pips read the gap at a glance without parsing "1/3".
function CoverageMeter({ label, present, total, required = false }: { label: string; present: number; total: number; required?: boolean }) {
  const complete = present >= total;
  const fill = required ? 'bg-compliant-500' : 'bg-brand-400';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[0.6875rem] font-medium text-ink-500">{label}</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 w-3.5 rounded-full transition-colors ${i < present ? fill : 'bg-ink-900/[0.08]'}`} />
        ))}
      </span>
      <span className={`text-[0.6875rem] font-semibold tabular-nums ${complete ? 'text-compliant-700' : required ? 'text-high-700' : 'text-ink-500'}`}>{present}/{total}</span>
    </span>
  );
}

function computeVerdict(detectedNames: string[], reference: string[]): Verdict {
  const det = detectedNames.map(s => s.trim()).filter(Boolean);
  const detNorm = det.map(norm);
  const refNorm = reference.map(norm);
  const missing = reference.filter(r => !detNorm.includes(norm(r)));
  const added = det.filter(d => !refNorm.includes(norm(d)));
  const coverage = reference.length ? (reference.length - missing.length) / reference.length : 1;
  if (coverage < 0.5) return { kind: 'mismatch' };
  const commonRef = refNorm.filter(r => detNorm.includes(r));
  const commonDet = detNorm.filter(d => refNorm.includes(d));
  const reordered = !commonRef.every((r, i) => commonDet[i] === r);
  if (!missing.length && !added.length && !reordered) return { kind: 'match' };
  return { kind: 'drift', missing, added, reordered };
}

// Mock of what the extraction engine hands back after the structure-only pass
// (§4.1, Option A). Evidence drives the badge; order is preserved as found.
const DETECTED: DetectedSection[] = [
  { id: 'd1', name: 'Executive Summary',        evidence: 'explicit' },
  { id: 'd2', name: 'Scope & Objectives',       evidence: 'explicit' },
  { id: 'd3', name: 'Testing Methodology',      evidence: 'inferred' },
  { id: 'd4', name: 'Control Testing Results',  evidence: 'explicit' },
  { id: 'd5', name: 'Detailed Findings',        evidence: 'inferred' },
  { id: 'd6', name: 'Corrective Actions',       evidence: 'fragment' },
  { id: 'd7', name: 'Appendix',                 evidence: 'explicit' },
];

// A "secretly last year's layout" upload checked against a reference format (the
// Air India example, §5): 'Corrective Actions' is gone, an unexpected
// 'Management Letter' appears — so the verdict reads ⚠️ Drifted.
const DETECTED_DRIFTED: DetectedSection[] = [
  { id: 'd1', name: 'Executive Summary',        evidence: 'explicit' },
  { id: 'd2', name: 'Scope & Objectives',       evidence: 'explicit' },
  { id: 'd3', name: 'Testing Methodology',      evidence: 'inferred' },
  { id: 'd4', name: 'Control Testing Results',  evidence: 'explicit' },
  { id: 'd5', name: 'Detailed Findings',        evidence: 'inferred' },
  { id: 'd6', name: 'Management Letter',        evidence: 'fragment' },
  { id: 'd7', name: 'Appendix',                 evidence: 'explicit' },
];

const SOURCE_BODY: Record<string, string[]> = {
  d1: ['This report sets out the results of the annual review across the in-scope business processes for the period under examination.'],
  d2: ['The review covered financial reporting controls, access management, and change management across four operating units.'],
  d3: ['Testing combined walkthroughs, re-performance, and sample-based inspection. Sample sizes followed the standard risk-tiering.'],
  d4: ['Of the 42 key controls tested, 38 operated effectively. Four exceptions were noted and are detailed in the section below.'],
  d5: ['Each exception is described with its root cause, the affected control, and the population impact observed during testing.'],
  d6: ['Management responses and remediation owners were recorded where provided. Some items remained open at the time of writing.'],
  d7: ['Supporting schedules, the control matrix, and the population reconciliation are attached for reference.'],
};

// Shared wizard shell — mirrors GenerateReportWizard exactly: a centred panel
// with an icon-titled header, a horizontal step progress row, a scrolling body
// and a sticky footer. Keeping the chrome identical is what makes this read as
// "from the platform" rather than a one-off modal.
const WIZARD_STEPS = ['Report type', 'Match', 'Save'];

function WizardPanel({ subtitle, activeIdx, onClose, footer, children }: {
  subtitle: ReactNode;
  activeIdx: number;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
        className="fixed inset-0 bg-[rgba(15,8,30,0.78)] backdrop-blur-[6px] z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1040px] max-w-[95vw] h-[662px] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog" aria-modal="true" aria-label="New template from a report"
      >
        {/* Title bar + stepper */}
        <header className="shrink-0 px-6 pt-3 pb-3 border-b border-canvas-border">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">New template from a report</h2>
                <p className="text-[0.75rem] text-ink-500 leading-snug">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-draft-50 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          {/* Three-step progress — Report type → Match → Save (mirrors the Generate wizard). */}
          <div className="flex items-center gap-2">
            {WIZARD_STEPS.map((label, i) => {
              const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo';
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full text-[0.75rem] font-semibold ${
                    state === 'active' ? 'bg-brand-50 text-brand-700' : state === 'done' ? 'bg-compliant-50 text-compliant-700' : 'bg-draft-50 text-ink-500'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[0.625rem] ${
                      state === 'active' ? 'bg-brand-600 text-white' : state === 'done' ? 'bg-compliant text-white' : 'bg-ink-300 text-white'
                    }`}>
                      {state === 'done' ? <Check size={10} /> : i + 1}
                    </span>
                    {label}
                  </span>
                  {i < WIZARD_STEPS.length - 1 && <span className="w-5 h-px bg-canvas-border" />}
                </div>
              );
            })}
          </div>
        </header>

        <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">{children}</div>

        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border">{footer}</footer>
      </motion.div>
    </>
  );
}

const cancelBtnCls = 'inline-flex items-center justify-center h-9 px-4 text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:bg-paper-50 transition-colors cursor-pointer rounded-[8px]';
const backBtnCls = 'inline-flex items-center gap-1.5 h-9 pl-3 pr-4 text-[0.8125rem] font-semibold text-ink-700 hover:text-ink-900 hover:bg-paper-50 transition-colors cursor-pointer rounded-[8px]';
const primaryBtnCls = 'inline-flex items-center justify-center gap-1.5 h-9 px-5 bg-brand-600 text-white text-[0.8125rem] font-semibold transition-colors rounded-[8px] enabled:hover:bg-brand-500 enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export default function UploadTemplateModal({ onClose, onSave, reference, existingNames = [] }: {
  onClose: () => void;
  onSave?: (t: EditableTemplate) => void;
  reference?: FormatReference;
  existingNames?: string[];
}) {
  const { addToast } = useToast();
  const validating = !!reference;
  const [step, setStep] = useState<'setup' | 'analyzing' | 'match' | 'save'>('setup');
  const [templateName, setTemplateName] = useState(validating ? reference!.templateName : '');
  const [reportType, setReportType] = useState<ReportTypeName>('Audit');
  const [pickedFile, setPickedFile] = useState<{ name: string; size: string } | null>(null);
  const [sections, setSections] = useState<DetectedSection[]>(validating ? DETECTED_DRIFTED : DETECTED);
  const [refDropped, setRefDropped] = useState(false);
  const activeRef = refDropped ? undefined : reference;
  const [setAsApproved, setSetAsApproved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rightRefs = useRef<Record<string, HTMLElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);       // left (source) flash
  const [rightFlashId, setRightFlashId] = useState<string | null>(null); // right (detected) flash
  const [found, setFound] = useState(0); // # sections "discovered" during the scan

  // Escape to close + lock the background scroll while open (the shell is bespoke
  // now, so it owns this the way the shared Modal used to).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const ALLOWED_EXT = ['docx', 'pdf'];
  const handleFilePicked = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) {
      addToast({ type: 'error', message: `Can't read ${ext ? `".${ext}"` : 'that file'}. Upload a PDF or Word (.docx) document.` });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const sizeMb = file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    setPickedFile({ name: file.name, size: sizeMb });
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (base) setTemplateName(base.replace(/\b\w/g, c => c.toUpperCase()));
    setStep('analyzing');
  };

  const initialDetected = validating ? DETECTED_DRIFTED : DETECTED;

  useEffect(() => {
    if (step !== 'analyzing') return;
    // A live scan: the beam sweeps the source on the left while sections are
    // "discovered" one-by-one on the right, then we move to the match step.
    setFound(0);
    const total = initialDetected.length;
    const per = 460;
    const timers = initialDetected.map((_, i) => setTimeout(() => setFound(i + 1), per * (i + 1)));
    const done = setTimeout(() => setStep('match'), per * total + 750);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const flaggedCount = useMemo(
    () => sections.filter(s => EVIDENCE_META[s.evidence].flag).length,
    [sections],
  );
  const hasEmptyName = sections.some(s => !s.name.trim());
  const trimmedName = templateName.trim();
  const nameTaken = !validating && !!trimmedName
    && existingNames.some(n => n.toLowerCase() === trimmedName.toLowerCase());

  const verdict = useMemo<Verdict | null>(
    () => (activeRef ? computeVerdict(sections.map(s => s.name), activeRef.sections) : null),
    [activeRef, sections],
  );

  const jumpToSource = (id: string) => {
    const el = sourceRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    setTimeout(() => setFlashId(curr => (curr === id ? null : curr)), 1200);
  };
  const jumpToSection = (id: string) => {
    const el = rightRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setRightFlashId(id);
    setTimeout(() => setRightFlashId(curr => (curr === id ? null : curr)), 1200);
  };
  const jumpToFirstFlagged = () => {
    const first = sections.find(s => EVIDENCE_META[s.evidence].flag);
    if (first) jumpToSection(first.id);
  };

  const renameSection = (id: string, name: string) =>
    setSections(prev => prev.map(s => (s.id === id ? { ...s, name } : s)));
  // Delete is reversible — a misclick shouldn't silently drop a section (§ checklist).
  const deleteSection = (id: string) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const removed = sections[idx];
    setSections(prev => prev.filter(s => s.id !== id));
    addToast({
      type: 'info',
      message: `Removed “${removed.name || 'Untitled section'}”.`,
      secondaryAction: { label: 'Undo', onClick: () => setSections(prev => {
        if (prev.some(s => s.id === removed.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, removed);
        return next;
      }) },
    });
  };
  // Fragment → merge (PRD §4.7.1): a detected fragment is almost always one
  // section the detector split in two, so fold it into the neighbour. The target
  // (the section above/below) survives, keeping its name; the fragment row goes,
  // its body absorbed into the target at generate time. Reversible like delete.
  const mergeSection = (id: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const fragment = sections[idx];
    const target = sections[targetIdx];
    setSections(prev => prev.filter(s => s.id !== id));
    addToast({
      type: 'info',
      message: `Merged “${fragment.name || 'fragment'}” into “${target.name || 'the section ' + direction}”.`,
      secondaryAction: { label: 'Undo', onClick: () => setSections(prev => {
        if (prev.some(s => s.id === fragment.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(idx, next.length), 0, fragment);
        return next;
      }) },
    });
  };
  const addSection = () =>
    setSections(prev => [...prev, { id: `new-${Date.now()}`, name: '', evidence: 'explicit' }]);

  // Coverage of the detected sections against the chosen type's required /
  // recommended set. Recomputes when the user switches the type dropdown.
  const typeCoverage = sectionCoverage(reportType, sections.map(s => s.name));
  // Append the type's sections the document is missing, marked "added for type".
  const addTypeSections = (list: TypeSection[]) =>
    setSections(prev => [
      ...prev,
      ...list
        .filter(spec => !prev.some(p => spec.match.test(p.name)))
        .map(spec => ({ id: `type-${Date.now()}-${spec.name}`, name: spec.name, evidence: 'added' as Evidence })),
    ]);

  const addMissing = (missing: string[]) => {
    if (!activeRef) return;
    setSections(prev => {
      const next = [...prev];
      for (const name of missing) {
        const refIdx = activeRef.sections.findIndex(r => norm(r) === norm(name));
        const at = Math.min(refIdx < 0 ? next.length : refIdx, next.length);
        next.splice(at, 0, { id: `add-${Date.now()}-${name}`, name, evidence: 'inferred' });
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!trimmedName) { addToast({ type: 'error', message: 'Give the template a name before saving.' }); return; }
    if (hasEmptyName) { addToast({ type: 'error', message: 'Name every section before saving.' }); return; }
    const kept = sections.filter(s => s.name.trim());
    if (!kept.length) { addToast({ type: 'error', message: 'Keep at least one section before saving.' }); return; }
    const isApproved = validating ? !refDropped : setAsApproved;
    if (onSave) {
      onSave({
        id: `ct-upload-${Date.now()}`,
        name: trimmedName,
        desc: `Built from ${pickedFile?.name ?? 'an uploaded document'} — ${kept.length} sections${isApproved ? ', set as the reference format' : ''}.`,
        category: reportType,
        icon: 'file-text',
        sections: kept.map(s => ({ name: s.name.trim(), icon: 'file-text' })),
        ...(isApproved ? { approvedSections: kept.map(s => s.name.trim()), referenceFileName: pickedFile?.name } : {}),
      } as EditableTemplate);
    } else {
      addToast({ type: 'success', message: `"${trimmedName}" saved to template library.` });
    }
    onClose();
  };

  const recommended = typeSectionsFor(reportType);
  // Display label only — the underlying value stays 'Audit' so the section map
  // and coverage lookups keep working.
  const typeLabel = (t: ReportTypeName) => (t === 'Audit' ? 'Internal Audit' : t);
  const flowIdx = step === 'setup' ? 0 : step === 'save' ? 2 : 1;

  const subtitle: ReactNode =
    step === 'setup' ? 'Pick the report type, then upload a document to turn into a template.'
    : step === 'analyzing' ? 'Reading the document structure — headings only, no data values.'
    : step === 'save' ? 'Review the final structure, name it, and save.'
    : validating
      ? <span>Comparing this upload to the <span className="font-medium text-ink-700">{reference!.templateName}</span> reference format.</span>
      : flaggedCount > 0
        ? <button onClick={jumpToFirstFlagged} className="inline-flex items-center gap-1.5 px-2 py-0.5 -ml-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.75rem] font-semibold hover:bg-mitigated-100 transition-colors cursor-pointer"><AlertTriangle size={12} /> {flaggedCount} section{flaggedCount > 1 ? 's' : ''} need a look — jump to the first</button>
        : `What we found, matched against the ${typeLabel(reportType)} structure.`;

  const footer: ReactNode =
    step === 'setup' || step === 'analyzing' ? (
      <div className="flex justify-end">
        <button onClick={onClose} className={cancelBtnCls}>Cancel</button>
      </div>
    ) : step === 'match' ? (
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setStep('setup')} className={backBtnCls}><ChevronLeft size={15} /> Back</button>
        <div className="flex items-center gap-3">
          <span className="text-[0.6875rem] text-high-700 font-medium">{hasEmptyName ? 'Name every section before continuing.' : ''}</span>
          <button onClick={() => setStep('save')} disabled={hasEmptyName} className={primaryBtnCls}>Continue <ChevronRight size={15} /></button>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setStep('match')} className={backBtnCls}><ChevronLeft size={15} /> Back</button>
        <div className="flex items-center gap-3">
          <span className="text-[0.6875rem] text-high-700 font-medium">{hasEmptyName ? 'Name every section before saving.' : ''}</span>
          <button onClick={handleSave} disabled={hasEmptyName || !trimmedName} className={primaryBtnCls}>Save template</button>
        </div>
      </div>
    );

  return (
    <WizardPanel subtitle={subtitle} activeIdx={flowIdx} onClose={onClose} footer={footer}>
      {/* ── Step 1: report type + recommended sections + upload ──────────────── */}
      {step === 'setup' && (
        <>
          <p className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400 mb-2">Report type</p>
          <div className="shrink-0 flex flex-wrap gap-1.5">
            {REPORT_TYPES.filter(t => ['Audit', 'SOX', 'ATR'].includes(t)).map(t => {
              const on = reportType === t;
              return (
                <button
                  key={t}
                  onClick={() => setReportType(t)}
                  className={`h-8 px-3 rounded-[8px] text-[0.8125rem] font-medium border transition-colors cursor-pointer ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-canvas-border bg-white text-ink-600 hover:border-brand-300 hover:text-ink-800'}`}
                >
                  {typeLabel(t)}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 mt-4 flex gap-4">
            {/* Upload — one-third. */}
            <div className="flex-1 basis-0 min-w-0 flex flex-col">
              <input ref={fileInputRef} type="file" accept=".docx,.pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePicked(f); }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-h-0 w-full border border-dashed border-ink-300/70 hover:border-brand-400 rounded-[12px] flex flex-col items-center justify-center gap-2.5 transition-colors hover:bg-brand-50/40 cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-full bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <Upload size={20} className="text-brand-600" />
                </div>
                <div className="text-center px-6">
                  <p className="text-[0.8125rem] font-semibold text-ink-800">Drop your report here, or <span className="text-brand-700">browse</span></p>
                  <p className="text-[0.75rem] text-ink-400 mt-0.5">PDF or Word (.docx), up to 25 MB</p>
                </div>
              </button>
            </div>

            {/* Expected sections — two-thirds, same bordered-list language as Save. */}
            <div className="flex-[2] basis-0 min-w-0 flex flex-col rounded-[12px] border border-canvas-border overflow-hidden">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-canvas-border flex items-center gap-2 bg-canvas">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Expected sections</span>
                {recommended.length > 0 && <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{recommended.length}</span>}
              </div>
              {recommended.length > 0 ? (
                <ul className="flex-1 overflow-y-auto divide-y divide-canvas-border">
                  {recommended.map(s => {
                    const req = s.tier === 'required';
                    return (
                      <li key={s.name} className="flex items-center gap-2.5 px-3.5 py-2">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${req ? 'bg-high-700' : 'bg-ink-300'}`} />
                        <span className="flex-1 min-w-0 truncate text-[0.8125rem] text-ink-700">{s.name}</span>
                        <span className={`text-[0.6875rem] font-medium ${req ? 'text-high-700' : 'text-ink-400'}`}>{req ? 'Required' : 'Recommended'}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex-1 flex items-center justify-center px-6 text-center">
                  <p className="text-[0.8125rem] text-ink-400 leading-relaxed">“Other” has no fixed structure — whatever we detect becomes the template.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Step 2 (loading): a live document scan ───────────────────────────── */}
      {step === 'analyzing' && (
        <>
          {/* Live progress — a real count + bar, not a spinner. */}
          <div className="shrink-0 mb-3">
            <div className="flex items-center gap-2 text-[0.8125rem]">
              <span className="font-medium text-ink-800 truncate">Scanning {pickedFile?.name ?? 'your report'}</span>
              <span className="ml-auto shrink-0 text-[0.75rem] tabular-nums text-ink-500">{found} of {initialDetected.length} sections found</span>
            </div>
            <div className="mt-2 h-1 w-full rounded-full bg-paper-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-brand-500"
                animate={{ width: `${(found / initialDetected.length) * 100}%` }}
                transition={{ ease: [0.2, 0, 0, 1], duration: 0.4 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Left — the document, with a scan beam sweeping down. Headings light
                up as the scan reaches them. */}
            <div className="flex flex-col min-h-0 border border-canvas-border rounded-[12px] overflow-hidden bg-canvas">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-canvas-border flex items-center gap-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Source document</span>
                {pickedFile?.name && <span className="text-[0.75rem] text-ink-500 truncate">· {pickedFile.name}</span>}
              </div>
              <div className="relative flex-1 overflow-hidden p-5 space-y-4">
                {initialDetected.map((d, i) => {
                  const scanned = i < found;
                  return (
                    <div key={d.id} className="space-y-1">
                      <h4 className={`text-[0.8125rem] font-bold transition-colors duration-500 ${scanned ? 'text-ink-900' : 'text-ink-300'}`}>{d.name}</h4>
                      {(SOURCE_BODY[d.id] ?? []).map((line, j) => (
                        <p key={j} className={`text-[0.6875rem] leading-relaxed transition-colors duration-500 ${scanned ? 'text-ink-500' : 'text-ink-300/60'}`}>{line}</p>
                      ))}
                    </div>
                  );
                })}
                {/* sweep beam — a soft brand light passing over the page */}
                <motion.div
                  className="pointer-events-none absolute inset-x-0 -mt-5 h-12"
                  initial={{ top: '-3rem' }}
                  animate={{ top: ['-3rem', '100%'] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="h-12 w-full bg-gradient-to-b from-brand-500/[0.12] to-transparent" />
                  <div className="h-[2px] w-full -mt-px bg-gradient-to-r from-transparent via-brand-500 to-transparent shadow-[0_0_16px_3px_rgba(106,18,205,0.35)]" />
                </motion.div>
              </div>
            </div>

            {/* Right — sections pop in one-by-one as they're discovered. */}
            <div className="flex flex-col min-h-0 border border-canvas-border rounded-[12px] overflow-hidden bg-white">
              <div className="shrink-0 px-3.5 py-2.5 border-b border-canvas-border bg-canvas flex items-center gap-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Detected sections</span>
                <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-brand-700">{found}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {initialDetected.map((d, i) =>
                  i < found ? (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                      className="flex items-center gap-2.5 border border-canvas-border rounded-[10px] px-3 py-2.5 bg-white"
                    >
                      <span className="w-5 h-5 shrink-0 rounded-[6px] bg-ink-900/[0.05] text-ink-500 flex items-center justify-center text-[0.6875rem] font-bold tabular-nums">{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate text-[0.8125rem] font-semibold text-ink-900">{d.name}</span>
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 500, damping: 18 }}>
                        <CheckCircle2 size={15} className="text-compliant" />
                      </motion.span>
                    </motion.div>
                  ) : (
                    <div key={d.id} className="flex items-center gap-2.5 border border-dashed border-canvas-border rounded-[10px] px-3 py-2.5 opacity-50">
                      <Skeleton width="w-5" height="h-5" rounded="rounded-[6px]" />
                      <Skeleton width="w-2/5" height="h-3.5" />
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Step 2: match the detected sections against the chosen type ──────── */}
      {step === 'match' && (
        <>
          {verdict && (
            <div className="shrink-0">
              <FormatVerdictBanner
                verdict={verdict}
                templateName={activeRef!.templateName}
                onAddMissing={verdict.kind === 'drift' && verdict.missing.length ? () => addMissing(verdict.missing) : undefined}
                onStartFresh={verdict.kind === 'mismatch' ? () => setRefDropped(true) : undefined}
              />
            </div>
          )}
          {typeCoverage.spec.length > 0 && (
            <div className="shrink-0 mb-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
                <span className="inline-flex items-center gap-2 shrink-0">
                  <Tag size={14} className="text-ink-400" />
                  <span className="text-[0.8125rem] font-semibold text-ink-800">{typeLabel(reportType)} coverage</span>
                </span>
                <CoverageMeter label="Required" present={typeCoverage.requiredPresent} total={typeCoverage.requiredTotal} required />
                <CoverageMeter label="Recommended" present={typeCoverage.recommendedPresent} total={typeCoverage.recommendedTotal} />
                {typeCoverage.allMissing.length > 0 && (
                  <button onClick={() => addTypeSections(typeCoverage.allMissing)} className="ml-auto inline-flex items-center gap-1 h-7 px-3 rounded-full bg-brand-600 text-white text-[0.6875rem] font-semibold hover:bg-brand-500 transition-colors cursor-pointer shrink-0">
                    <Plus size={12} /> Add {typeCoverage.allMissing.length} missing
                  </button>
                )}
              </div>
              {typeCoverage.allMissing.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.6875rem] font-medium text-ink-400 mr-0.5">Missing</span>
                  {typeCoverage.allMissing.map(spec => {
                    const req = spec.tier === 'required';
                    return (
                      <button
                        key={spec.name}
                        onClick={() => addTypeSections([spec])}
                        title={`Add "${spec.name}"`}
                        className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-[0.6875rem] font-medium cursor-pointer transition-colors ${req ? 'border-high/40 bg-high-50 text-high-700 hover:bg-high-100' : 'border-canvas-border bg-white text-ink-600 hover:border-brand-600/40 hover:text-brand-700'}`}
                      >
                        <Plus size={11} className="shrink-0 opacity-60" />
                        {spec.name}
                        {req && <span className="w-1 h-1 rounded-full bg-high-600 shrink-0" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-[1fr_1px_1fr] flex-1 min-h-0">
            {/* Left — the source document */}
            <section className="flex flex-col min-h-0 pr-6">
              <header className="shrink-0 flex items-baseline gap-2 mb-3">
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Source document</h3>
                {pickedFile?.name && <span className="text-[0.75rem] text-ink-500 truncate">{pickedFile.name}</span>}
                {pickedFile?.size && <span className="text-[0.6875rem] text-ink-300 ml-auto shrink-0 tabular-nums">{pickedFile.size}</span>}
              </header>
              <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
                {initialDetected.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    ref={el => { sourceRefs.current[d.id] = el as unknown as HTMLDivElement; }}
                    onClick={() => jumpToSection(d.id)}
                    title="Show this section in the detected list"
                    className={`group/src block w-full text-left rounded-[10px] px-3 py-2.5 transition-colors duration-300 cursor-pointer hover:bg-canvas ${flashId === d.id ? 'bg-brand-600/[0.07] ring-1 ring-brand-600/25' : ''}`}
                  >
                    <h4 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-900 mb-0.5">
                      <span className="truncate">{d.name}</span>
                      <CornerDownRight size={11} className="shrink-0 text-brand-600 opacity-0 group-hover/src:opacity-100 transition-opacity" />
                    </h4>
                    {(SOURCE_BODY[d.id] ?? []).map((line, i) => (
                      <p key={i} className="text-[0.6875rem] leading-relaxed text-ink-400">{line}</p>
                    ))}
                  </button>
                ))}
              </div>
            </section>

            {/* Hairline divider — one line instead of two facing card borders. */}
            <div className="bg-canvas-border" aria-hidden="true" />

            {/* Right — detected sections to curate */}
            <section className="flex flex-col min-h-0 pl-6">
              <header className="shrink-0 mb-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Detected sections</h3>
                  <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-ink-900/[0.05] text-[0.625rem] font-semibold tabular-nums text-ink-500">{sections.length}</span>
                </div>
                {/* Evidence legend — decodes the index-chip colours at a glance. */}
                <div className="flex items-center gap-3 mt-2 text-[0.625rem] font-medium text-ink-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-compliant-500" /> Explicit</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-mitigated-500" /> Review</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-high-500" /> Fragment</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Added</span>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto -mx-2 px-2">
                <Reorder.Group axis="y" values={sections} onReorder={setSections} className="space-y-0.5">
                  {sections.map((s, i) => (
                    <SectionRow
                      key={s.id}
                      section={s}
                      index={i}
                      total={sections.length}
                      isDetected={initialDetected.some(d => d.id === s.id)}
                      flashed={rightFlashId === s.id}
                      registerRef={el => { rightRefs.current[s.id] = el; }}
                      onRename={name => renameSection(s.id, name)}
                      onDelete={() => deleteSection(s.id)}
                      onJump={() => jumpToSource(s.id)}
                      onMerge={dir => mergeSection(s.id, dir)}
                    />
                  ))}
                </Reorder.Group>
                <button
                  onClick={addSection}
                  className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[10px] text-[0.75rem] font-medium text-ink-400 hover:text-brand-600 hover:bg-brand-600/[0.04] transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Add a section the detector missed
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {/* ── Step 3: name & save ──────────────────────────────────────────────── */}
      {step === 'save' && (
        <>
          <div className="flex-1 min-h-0 flex flex-col rounded-[12px] border border-canvas-border overflow-hidden">
            <div className="shrink-0 px-3.5 py-2.5 border-b border-canvas-border flex items-center gap-2 bg-canvas">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Final structure</span>
              <button onClick={() => setStep('match')} className="text-[0.6875rem] font-medium text-brand-600 hover:text-brand-700 transition-colors cursor-pointer">Edit</button>
              <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{sections.length}</span>
            </div>
            <ol className="flex-1 overflow-y-auto divide-y divide-canvas-border">
              {sections.map((s, i) => {
                const meta = EVIDENCE_META[s.evidence];
                return (
                  <li key={s.id} className="flex items-center gap-2.5 px-3.5 py-2">
                    <span className="w-5 h-5 shrink-0 rounded-[6px] bg-ink-900/[0.05] text-ink-500 flex items-center justify-center text-[0.6875rem] font-bold tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-[0.8125rem] font-medium text-ink-800">{s.name || 'Untitled section'}</span>
                    <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium text-ink-400 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Name + reference format */}
          <div className="shrink-0 mt-4 flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-[200px] flex-1">
              <label className="text-[0.6875rem] font-medium text-ink-500">Template name</label>
              <input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name"
                className={`w-full px-3 py-2 border text-[0.8125rem] focus:outline-none focus:ring-2 focus:ring-brand-600/10 rounded-[8px] ${nameTaken ? 'border-mitigated/60' : 'border-canvas-border focus:border-brand-600/40'}`}
              />
              {nameTaken && <span className="text-[0.625rem] text-mitigated-700 pl-1">A template named “{trimmedName}” exists — saving creates a copy.</span>}
            </div>
            {!validating && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none shrink-0 max-w-[260px] pb-1">
                <input type="checkbox" checked={setAsApproved} onChange={e => setSetAsApproved(e.target.checked)} className="sr-only peer" />
                <span className="mt-0.5 w-4 h-4 rounded-[5px] border border-canvas-border peer-checked:bg-brand-600 peer-checked:border-brand-600 flex items-center justify-center transition-colors shrink-0">
                  {setAsApproved && <CheckCircle2 size={12} className="text-white" />}
                </span>
                <span className="leading-tight">
                  <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-700">
                    <ShieldCheck size={13} className={setAsApproved ? 'text-brand-600' : 'text-ink-400'} />
                    Use this as the reference format
                  </span>
                  <span className="block text-[0.625rem] text-ink-400 mt-0.5">We'll check future uploads against this layout.</span>
                </span>
              </label>
            )}
            {validating && (
              <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 shrink-0 pb-2.5">
                <ShieldCheck size={13} className="text-brand-600" />
                Checking against <span className="font-medium text-ink-700">{reference!.templateName}</span>
              </span>
            )}
          </div>
        </>
      )}
    </WizardPanel>
  );
}

// One draggable detected-section row. Owns its own drag controls so the handle
// (not the text input) starts the drag.
function SectionRow({ section, index, total, isDetected, flashed, registerRef, onRename, onDelete, onJump, onMerge }: {
  section: DetectedSection;
  index: number;
  total: number;
  isDetected: boolean;
  flashed: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onJump: () => void;
  onMerge: (direction: 'up' | 'down') => void;
}) {
  const controls = useDragControls();
  const meta = EVIDENCE_META[section.evidence];
  const empty = !section.name.trim();
  const isFragment = section.evidence === 'fragment';
  const canMerge = isFragment && (index > 0 || index < total - 1);
  // Flat list rows — no per-row border. The chosen background is the only fill,
  // and it stays quiet unless the row actually needs attention.
  const bg = flashed
    ? 'bg-brand-600/[0.07]'
    : empty
      ? 'bg-high-50/50'
      : meta.flag
        ? 'bg-mitigated-50/40'
        : 'hover:bg-canvas';
  const numTint = empty ? 'bg-high-50 text-high-700' : meta.tint;
  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={controls}
      ref={registerRef}
      whileDrag={{ scale: 1.015, boxShadow: '0 12px 28px -12px rgba(15,8,30,0.28)' }}
      className={`group relative rounded-[10px] px-2.5 py-2 transition-colors ${bg} ${flashed ? 'ring-1 ring-brand-600/25' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <button
          onPointerDown={e => controls.start(e)}
          aria-label="Drag to reorder"
          className="-ml-1.5 touch-none cursor-grab active:cursor-grabbing text-ink-300 hover:text-ink-500 transition-all shrink-0 opacity-0 group-hover:opacity-100"
        >
          <GripVertical size={14} />
        </button>
        {/* The index chip carries the evidence colour — status without a rail. */}
        <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[0.6875rem] font-bold tabular-nums ${numTint}`}>{index + 1}</span>
        <input
          value={section.name}
          onChange={e => onRename(e.target.value)}
          placeholder="Name this section"
          className="flex-1 min-w-0 bg-transparent text-[0.8125rem] font-semibold text-ink-900 focus:outline-none placeholder:font-medium placeholder:text-high-400"
        />
        {/* Tiered status — clean rows stay a quiet grey label; only the rows that
            need a look pick up the evidence colour + warning glyph. */}
        <span className={`inline-flex items-center gap-1.5 text-[0.625rem] font-medium shrink-0 ${meta.flag ? meta.text : 'text-ink-400'}`}>
          {meta.flag ? <AlertTriangle size={10} /> : <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
          {meta.label}
        </span>
        <button
          onClick={onDelete}
          aria-label="Remove section"
          className="p-1 rounded-[6px] text-ink-300 hover:text-high-700 hover:bg-high-50 transition-all cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {(isDetected || canMerge || empty) && (
        <div className="flex items-center gap-2 mt-1 pl-[2.25rem]">
          {isDetected && (
            <button onClick={onJump} className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-ink-400 hover:text-brand-600 transition-colors cursor-pointer">
              <CornerDownRight size={10} /> Show in document
            </button>
          )}
          {/* A fragment is usually one section split in two — let the user fold it
              into the neighbour, the fix the red badge otherwise lacks (§4.7.1). */}
          {canMerge && (
            <span className="inline-flex items-center gap-1">
              {index > 0 && (
                <button onClick={() => onMerge('up')} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-50 text-[0.625rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
                  <ArrowUpToLine size={10} /> Merge up
                </button>
              )}
              {index < total - 1 && (
                <button onClick={() => onMerge('down')} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-50 text-[0.625rem] font-semibold text-brand-700 hover:bg-brand-100 transition-colors cursor-pointer">
                  <ArrowDownToLine size={10} /> Merge down
                </button>
              )}
            </span>
          )}
          {empty && <span className="text-[0.625rem] text-high-700 font-medium">Name required</span>}
        </div>
      )}
    </Reorder.Item>
  );
}

// The §5 centerpiece — a plain verdict the system can stand behind, with the
// specifics and the next action, never a silent pass-through.
function FormatVerdictBanner({ verdict, templateName, onAddMissing, onStartFresh }: {
  verdict: Verdict;
  templateName: string;
  onAddMissing?: () => void;
  onStartFresh?: () => void;
}) {
  const list = (names: string[]) => names.map(n => `“${n}”`).join(', ');
  const tone =
    verdict.kind === 'match'
      ? { wrap: 'bg-compliant-50 border-compliant', icon: <CheckCircle2 size={16} className="text-compliant-700" />, title: 'text-compliant-700' }
      : verdict.kind === 'drift'
        ? { wrap: 'bg-mitigated-50 border-mitigated', icon: <AlertTriangle size={16} className="text-mitigated-700" />, title: 'text-mitigated-700' }
        : { wrap: 'bg-high-50 border-high', icon: <XCircle size={16} className="text-high-700" />, title: 'text-high-700' };
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className={`mb-3 flex items-start gap-3 rounded-[12px] border px-4 py-3 ${tone.wrap}`}>
      <span className="mt-0.5 shrink-0">{tone.icon}</span>
      <div className="min-w-0 flex-1">
        {verdict.kind === 'match' && (
          <p className={`text-[0.8125rem] font-semibold ${tone.title}`}>Matches the reference format — every expected section is present, in order.</p>
        )}
        {verdict.kind === 'drift' && (
          <>
            <p className={`text-[0.8125rem] font-semibold ${tone.title}`}>Drifted from the {templateName} format</p>
            <ul className="mt-1 space-y-0.5 text-[0.75rem] text-ink-600">
              {verdict.missing.length > 0 && <li>{verdict.missing.length} expected section{verdict.missing.length > 1 ? 's' : ''} missing: {list(verdict.missing)}</li>}
              {verdict.added.length > 0 && <li>{verdict.added.length} unexpected section{verdict.added.length > 1 ? 's' : ''} added: {list(verdict.added)}</li>}
              {verdict.reordered && verdict.missing.length === 0 && verdict.added.length === 0 && <li>Sections are out of the expected order.</li>}
            </ul>
          </>
        )}
        {verdict.kind === 'mismatch' && (
          <p className={`text-[0.8125rem] font-semibold ${tone.title}`}>This doesn’t look like the {templateName} format.</p>
        )}
      </div>
      {onAddMissing && (
        <button onClick={onAddMissing} className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-mitigated-700 text-white text-[0.75rem] font-semibold hover:opacity-90 transition-opacity cursor-pointer">
          <Plus size={13} /> Add missing
        </button>
      )}
      {onStartFresh && (
        <button onClick={onStartFresh} className="shrink-0 inline-flex items-center h-8 px-3 rounded-[8px] border border-high/40 bg-white text-high-700 text-[0.75rem] font-semibold hover:bg-high-50 transition-colors cursor-pointer">
          Start a new template
        </button>
      )}
    </motion.div>
  );
}
