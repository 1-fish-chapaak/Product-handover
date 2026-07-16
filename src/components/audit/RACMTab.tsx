/**
 * RACM Tab — a RACM *library* for a Compliance / Internal Audit engagement.
 *
 * Level 1 (default): a list of RACMs, one per sub-process, each backed by its
 * SOP (Standard Operating Procedure). The user can start a fresh area by either
 * uploading a RACM (.xlsx) directly, or uploading an SOP (.pdf/.docx) and letting
 * the system extract the RACM (risks, controls, attributes) from it.
 *
 * Level 2: clicking a RACM opens that area's matrix — toolbar, stats, the dense
 * RACM table, and a per-row detail drawer. The SOP can be previewed in a side panel.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronDown, Download, Upload, Filter, FileText, Layers,
  AlertTriangle, Shield, Key, ListTree, Library, Eye, X, Workflow, Calendar,
  CheckCircle2, User, ArrowUpRight, ArrowLeft, BookOpen, Sparkles, Plus,
  Loader2, FileStack, FileUp,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import Gated from '../shared/Gated';
import { Button } from '../shared/Button';
import ListPlaceholder from '../shared/ListPlaceholder';
import type { Engagement } from '../../data/engagements';
import {
  racmRowsForProcess,
  groupRacmBySubProcess,
  generateRacmForProcess,
  attrCode,
  type RACMRow,
  type ControlAttribute,
  type ControlType,
  type Automation,
} from '../../data/racm';
import { useEngagementWorkspace, type WorkspaceControl } from './engagementWorkspace';
import AIRecommendsPopover from '../shared/AIRecommendsPopover';
import { actionableRacmRecs } from '../../data/layeredInsights';

/** Adapt a user-added control into a RACM row so it renders in the matrix. */
function customControlToRacmRow(c: WorkspaceControl, process: Engagement['process']): RACMRow {
  return {
    id: `${c.controlId}-row`,
    process,
    subProcess: c.subProcess,
    riskId: `R-${c.controlId}`,
    riskDescription: `Risk addressed by control ${c.controlId}.`,
    controlId: c.controlId,
    controlDescription: c.description,
    attributes: c.attributes,
    assertion: 'Accuracy',
    frequency: c.frequency,
    controlType: 'Preventive',
    automation: 'Manual',
    isKey: c.isKey,
  };
}

interface Props {
  engagement: Engagement;
  /** Open the full-page RACM editor (optionally scoped to a specific RACM). */
  onOpenFullEditor?: (override?: { racmName?: string; processLabel?: string }) => void;
}

// ─── Token maps ───────────────────────────────────────────────────────────────

const TYPE_CLS: Record<ControlType, string> = {
  Preventive: 'bg-compliant-50 text-compliant-700 border-compliant-100/70',
  Detective:  'bg-evidence-50 text-evidence-700 border-evidence-100/70',
};

const AUTOMATION_CLS: Record<Automation, string> = {
  Manual:         'bg-mitigated-50 text-mitigated-700 border-mitigated-100/70',
  'IT-dependent': 'bg-surface-2 text-text-secondary border-border-light',
  Automated:      'bg-brand-50 text-brand-600 border-brand-100/70',
};

// ─── RACM-library model ───────────────────────────────────────────────────────

interface SopDoc {
  name: string;
  version: string;
  uploadedAgo: string;
  sections: string[];
  /** True when the RACM for this area was extracted from this SOP. */
  extracted: boolean;
}

interface RacmEntry {
  id: string;
  name: string;
  subProcess: string;
  rows: RACMRow[];
  sop: SopDoc | null;
  source: 'library' | 'uploaded' | 'sop-extracted';
  updatedAgo: string;
}

const SOP_SECTIONS = [
  'Purpose & scope',
  'Roles & responsibilities',
  'Process steps & approvals',
  'Key controls & checkpoints',
  'Exceptions & escalation',
  'Records & retention',
];

const SOURCE_BADGE: Record<RacmEntry['source'], { label: string; cls: string }> = {
  library:        { label: 'Library',  cls: 'bg-surface-2 text-text-secondary border-border-light' },
  uploaded:       { label: 'Uploaded', cls: 'bg-evidence-50 text-evidence-700 border-evidence-100/70' },
  'sop-extracted':{ label: 'From SOP', cls: 'bg-brand-50 text-brand-600 border-brand-100/70' },
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function defaultSopFor(sub: string): SopDoc {
  const base = sub.replace(/[^A-Za-z0-9]+/g, '_');
  const major = (strHash(sub) % 3) + 1;
  return { name: `${base}_SOP_v${major}.pdf`, version: `v${major}.0`, uploadedAgo: `${(strHash(sub) % 6) + 2}d ago`, sections: SOP_SECTIONS, extracted: false };
}
/** Derive a readable area name from an uploaded SOP filename. */
function areaFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\bSOP\b/ig, '')
    .replace(/\bv?\d+(\.\d+)?\b/gi, '')
    .trim();
  return base ? base.replace(/\b\w/g, c => c.toUpperCase()) : 'New Process';
}

function entryStats(rows: RACMRow[]) {
  return {
    risks: new Set(rows.map(r => r.riskId)).size,
    controls: new Set(rows.map(r => r.controlId)).size,
    keyControls: new Set(rows.filter(r => r.isKey).map(r => r.controlId)).size,
    attributes: rows.reduce((acc, r) => acc + r.attributes.length, 0),
  };
}

// ─── Container ────────────────────────────────────────────────────────────────

export default function RACMTab({ engagement, onOpenFullEditor }: Props): JSX.Element {
  const { addToast } = useToast();
  const ws = useEngagementWorkspace();
  const libraryRows = useMemo(() => racmRowsForProcess(engagement.process), [engagement.process]);

  // When a full RACM is uploaded it replaces the library rows for every area.
  const [uploadedRows, setUploadedRows] = useState<RACMRow[]>([]);
  // SOP per entry id — seed every sub-process with one except the last (to demo the extract path).
  const [sopByEntry, setSopByEntry] = useState<Record<string, SopDoc | null>>(() => {
    const groups = groupRacmBySubProcess(racmRowsForProcess(engagement.process));
    const map: Record<string, SopDoc | null> = {};
    groups.forEach((g, i) => { map[slug(g.subProcess)] = i === groups.length - 1 ? null : defaultSopFor(g.subProcess); });
    return map;
  });
  // Brand-new RACMs created by extracting from an SOP (a new area not in the library).
  const [extraEntries, setExtraEntries] = useState<RacmEntry[]>([]);

  const [sopPreview, setSopPreview] = useState<RacmEntry | null>(null);
  // Fallback in-tab matrix — only used in contexts that don't provide a full-page editor.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);
  // Holds the in-flight extraction timer so Cancel can abort it cleanly.
  const extractTimer = useRef<number | null>(null);
  const cancelExtraction = () => {
    if (extractTimer.current != null) { window.clearTimeout(extractTimer.current); extractTimer.current = null; }
    setExtracting(null);
    addToast({ type: 'info', message: 'Extraction cancelled. No RACM was created.' });
  };

  const racmFileRef = useRef<HTMLInputElement | null>(null);
  const sopFileRef = useRef<HTMLInputElement | null>(null);
  const sopTargetRef = useRef<string>('new'); // entry id, or 'new'

  const baseRows = uploadedRows.length > 0 ? uploadedRows : libraryRows;
  const customRows = useMemo(
    () => ws.racmControls.map(c => customControlToRacmRow(c, engagement.process)),
    [ws.racmControls, engagement.process],
  );

  const libraryEntries = useMemo<RacmEntry[]>(() => {
    const groups = groupRacmBySubProcess([...customRows, ...baseRows]);
    return groups.map(g => {
      const id = slug(g.subProcess);
      const sop = sopByEntry[id] ?? null;
      const source: RacmEntry['source'] = uploadedRows.length > 0 ? 'uploaded' : sop?.extracted ? 'sop-extracted' : 'library';
      return { id, name: `${g.subProcess} RACM`, subProcess: g.subProcess, rows: g.rows, sop, source, updatedAgo: defaultSopFor(g.subProcess).uploadedAgo };
    });
  }, [customRows, baseRows, sopByEntry, uploadedRows.length]);

  const entries = useMemo(() => [...extraEntries, ...libraryEntries], [extraEntries, libraryEntries]);
  const selected = entries.find(e => e.id === selectedId) ?? null;

  // Opening a RACM goes straight to the full-page editor (not an in-tab sub-page).
  // The in-tab matrix is only a fallback for contexts that don't wire an editor.
  const openEditor = (entry: RacmEntry) => {
    if (onOpenFullEditor) onOpenFullEditor({ racmName: entry.name, processLabel: entry.subProcess });
    else setSelectedId(entry.id);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const triggerRacmUpload = () => { setNewOpen(false); racmFileRef.current?.click(); };
  const triggerSopUpload = (target: string) => { sopTargetRef.current = target; setNewOpen(false); sopFileRef.current?.click(); };

  const onRacmFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const rows = generateRacmForProcess(engagement.process);
      setUploadedRows(rows);
      const areas = new Set(rows.map(r => r.subProcess)).size;
      addToast({ type: 'success', message: `Imported \`${file.name}\`: ${rows.length} rows · ${areas} RACM${areas === 1 ? '' : 's'}` });
    }
    e.target.value = '';
  };

  const onSopFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filename = file.name;
    const target = sopTargetRef.current;
    e.target.value = '';
    setExtracting(filename);
    // Simulate the SOP → RACM extraction pipeline.
    extractTimer.current = window.setTimeout(() => {
      extractTimer.current = null;
      const sop: SopDoc = { name: filename, version: 'v1.0', uploadedAgo: 'just now', sections: SOP_SECTIONS, extracted: true };
      if (target === 'new') {
        const area = areaFromFilename(filename);
        const id = `extra-${slug(area)}-${extraEntries.length + 1}`;
        const gen = generateRacmForProcess(engagement.process).slice(0, 5).map((r, i) => ({
          ...r,
          id: `${id}-row-${i}`,
          subProcess: area,
          riskId: `R-${slug(area).toUpperCase().replace(/-/g, '')}-${i + 1}`,
          controlId: `C-${slug(area).toUpperCase().replace(/-/g, '').slice(0, 6)}-${String(i + 1).padStart(2, '0')}`,
        }));
        const attrs = gen.reduce((s, r) => s + r.attributes.length, 0);
        const entry: RacmEntry = { id, name: `${area} RACM`, subProcess: area, rows: gen, sop, source: 'sop-extracted', updatedAgo: 'just now' };
        setExtraEntries(prev => [entry, ...prev]);
        addToast({ type: 'success', message: `Extracted ${gen.length} controls · ${attrs} attributes from \`${filename}\`` });
        setExtracting(null);
        setSopPreview(entry); // show what was extracted, right on the list
      } else {
        setSopByEntry(prev => ({ ...prev, [target]: sop }));
        addToast({ type: 'success', message: `Linked \`${filename}\` & extracted controls for this RACM` });
        setExtracting(null);
      }
    }, 1600);
  };

  const hiddenInputs = (
    <>
      <input ref={racmFileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onRacmFile} />
      <input ref={sopFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onSopFile} />
    </>
  );

  // ── Matrix detail (fallback only — when no editor is wired) ─────────────────
  if (selected) {
    return (
      <>
        <RacmMatrixView
          entry={selected}
          framework={engagement.framework}
          onBack={() => setSelectedId(null)}
          onViewSop={() => setSopPreview(selected)}
          onUploadSop={() => triggerSopUpload(selected.id)}
          onOpenFullEditor={onOpenFullEditor ? () => onOpenFullEditor() : undefined}
        />
        {hiddenInputs}
        <AnimatePresence>{sopPreview && <SopPreviewDrawer entry={sopPreview} onClose={() => setSopPreview(null)} />}</AnimatePresence>
        <AnimatePresence>{extracting && <ExtractionOverlay filename={extracting} onCancel={cancelExtraction} />}</AnimatePresence>
      </>
    );
  }

  // ── Library list ────────────────────────────────────────────────────────────
  return (
    <>
      <RacmLibraryList
        process={engagement.process}
        framework={engagement.framework}
        entries={entries}
        onOpen={openEditor}
        onViewSop={setSopPreview}
        onNew={() => setNewOpen(true)}
        onUploadRacm={triggerRacmUpload}
        onUploadSop={triggerSopUpload}
      />
      {hiddenInputs}
      <AnimatePresence>{newOpen && <NewRacmModal onClose={() => setNewOpen(false)} onUploadRacm={triggerRacmUpload} onUploadSop={() => triggerSopUpload('new')} />}</AnimatePresence>
      <AnimatePresence>{sopPreview && <SopPreviewDrawer entry={sopPreview} onClose={() => setSopPreview(null)} />}</AnimatePresence>
      <AnimatePresence>{extracting && <ExtractionOverlay filename={extracting} onCancel={cancelExtraction} />}</AnimatePresence>
    </>
  );
}

// ─── Library list ─────────────────────────────────────────────────────────────

function RacmLibraryList({
  process, framework, entries, onOpen, onViewSop, onNew, onUploadRacm, onUploadSop,
}: {
  process: string;
  framework: string;
  entries: RacmEntry[];
  onOpen: (entry: RacmEntry) => void;
  onViewSop: (entry: RacmEntry) => void;
  onNew: () => void;
  onUploadRacm: () => void;
  onUploadSop: (target: string) => void;
}): JSX.Element {
  const totals = useMemo(() => {
    const rows = entries.flatMap(e => e.rows);
    return { ...entryStats(rows), racms: entries.length, withSop: entries.filter(e => e.sop).length };
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-card rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-brand-50 shrink-0"><FileStack size={16} className="text-brand-600" /></div>
          <div className="min-w-0">
            <div className="text-[0.90625rem] font-semibold text-text leading-tight">RACM Library</div>
            <div className="text-[0.6875rem] text-text-muted mt-0.5">
              {process} · {framework}
              <span className="text-border mx-1.5">·</span>
              {totals.racms} RACM{totals.racms === 1 ? '' : 's'}
              <span className="text-border mx-1.5">·</span>
              {totals.withSop}/{totals.racms} with SOP
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Gated permission="racm_generate" mode="disable" title="You don't have permission to create a RACM">
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[0.78125rem] font-semibold transition-colors cursor-pointer"
          >
            <Plus size={14} /> New RACM
          </button>
          </Gated>
        </div>
      </div>

      {entries.length === 0 ? (
        <RacmOnboarding onUploadRacm={onUploadRacm} onUploadSop={() => onUploadSop('new')} />
      ) : (
        <div className="space-y-2.5">
          {entries.map(entry => (
            <RacmEntryCard
              key={entry.id}
              entry={entry}
              onOpen={() => onOpen(entry)}
              onViewSop={() => onViewSop(entry)}
              onUploadSop={() => onUploadSop(entry.id)}
            />
          ))}
          {/* Inline start hint at the bottom of an existing list */}
          <Gated permission="racm_generate" mode="disable" title="You don't have permission to create a RACM">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-border-light text-[0.78125rem] font-medium text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary-xlight/30 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Start a new RACM: upload a RACM or an SOP to extract from
          </button>
          </Gated>
        </div>
      )}
    </div>
  );
}

function RacmOnboarding({ onUploadRacm, onUploadSop }: { onUploadRacm: () => void; onUploadSop: () => void }): JSX.Element {
  return (
    <ListPlaceholder
      icon={FileStack}
      title="Start your RACM library"
      body="Begin with an existing matrix, or upload an SOP and let IRA extract the risks, controls, and attributes for you."
      action={
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
          <Gated permission="racm_edit" mode="disable" title="You don't have permission to upload a RACM">
          <button onClick={onUploadRacm} className="group text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
            <div className="p-2 rounded-lg bg-evidence-50 inline-flex mb-3"><Upload size={16} className="text-evidence-700" /></div>
            <div className="text-[0.84375rem] font-semibold text-text mb-1">Upload a RACM</div>
            <div className="text-[0.71875rem] text-text-muted leading-relaxed">Import an existing matrix (.xlsx). Risks, controls, and attributes load straight in.</div>
          </button>
          </Gated>
          <Gated permission="racm_generate" mode="disable" title="You don't have permission to extract a RACM">
          <button onClick={onUploadSop} className="group text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
            <div className="p-2 rounded-lg bg-brand-50 inline-flex mb-3"><Sparkles size={16} className="text-brand-600" /></div>
            <div className="text-[0.84375rem] font-semibold text-text mb-1 flex items-center gap-1.5">Upload an SOP <span className="text-text-muted">→</span> extract</div>
            <div className="text-[0.71875rem] text-text-muted leading-relaxed">Upload a procedure doc (.pdf/.docx). IRA reads it and drafts the RACM for you.</div>
          </button>
          </Gated>
        </div>
      }
    />
  );
}

function RacmEntryCard({ entry, onOpen, onViewSop, onUploadSop }: {
  entry: RacmEntry;
  onOpen: () => void;
  onViewSop: () => void;
  onUploadSop: () => void;
}): JSX.Element {
  const s = entryStats(entry.rows);
  const badge = SOURCE_BADGE[entry.source];
  const racmRecs = actionableRacmRecs({ subjectLabel: entry.name, risks: s.risks, controls: s.controls, keyControls: s.keyControls, attributes: s.attributes, hasSop: Boolean(entry.sop) });
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
      <div className="p-2.5 rounded-xl bg-brand-50 shrink-0"><BookOpen size={18} className="text-brand-600" /></div>

      {/* Identity + counts */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onOpen} className="text-[0.875rem] font-semibold text-text hover:text-primary transition-colors cursor-pointer text-left">
            {entry.name}
          </button>
          <span className={`inline-flex items-center px-1.5 h-4 rounded text-[0.59375rem] font-bold uppercase tracking-wider border ${badge.cls}`}>{badge.label}</span>
          {racmRecs.length > 0 && <AIRecommendsPopover recs={racmRecs} subjectLabel={entry.name} subjectSub={entry.subProcess} className="shrink-0" />}
        </div>
        <div className="text-[0.6875rem] text-text-muted mt-1 tabular-nums">
          {s.risks} risk{s.risks === 1 ? '' : 's'}
          <span className="text-border mx-1.5">·</span>
          {s.controls} control{s.controls === 1 ? '' : 's'}
          {s.keyControls > 0 && (<><span className="text-border mx-1.5">·</span><span className="text-mitigated-700 font-semibold">{s.keyControls} key</span></>)}
          <span className="text-border mx-1.5">·</span>
          {s.attributes} attribute{s.attributes === 1 ? '' : 's'}
          <span className="text-border mx-1.5">·</span>
          updated {entry.updatedAgo}
        </div>
      </div>

      {/* SOP — clearly visible on the right, just left of Open */}
      {entry.sop ? (
        <button
          onClick={onViewSop}
          title="View SOP"
          className="shrink-0 hidden sm:flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border-light bg-surface-1/50 hover:border-primary/40 hover:bg-primary-xlight/30 transition-colors cursor-pointer max-w-[280px] text-left group"
        >
          <div className="p-1.5 rounded-md bg-brand-50 shrink-0"><FileText size={14} className="text-brand-600" /></div>
          <div className="min-w-0">
            <div className="text-[0.59375rem] uppercase tracking-wider font-bold text-text-muted leading-none mb-0.5">SOP · {entry.sop.version}</div>
            <div className="text-[0.75rem] font-medium text-text truncate leading-tight">{entry.sop.name}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-text-muted group-hover:text-primary shrink-0">
            <Eye size={13} /> View
          </span>
        </button>
      ) : (
        <Gated permission="racm_generate" mode="disable" title="You don't have permission to extract a RACM">
        <button
          onClick={onUploadSop}
          title="Upload an SOP and extract the RACM from it"
          className="shrink-0 hidden sm:flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-mitigated-300 bg-mitigated-50/40 hover:bg-mitigated-50 transition-colors cursor-pointer text-left"
        >
          <div className="p-1.5 rounded-md bg-mitigated-50 shrink-0"><Sparkles size={14} className="text-mitigated-700" /></div>
          <div className="min-w-0">
            <div className="text-[0.59375rem] uppercase tracking-wider font-bold text-mitigated-700 leading-none mb-0.5">No SOP</div>
            <div className="text-[0.75rem] font-medium text-mitigated-700 truncate leading-tight">Upload SOP → extract</div>
          </div>
        </button>
        </Gated>
      )}

      <button
        onClick={onOpen}
        title="Open in the full-page RACM editor"
        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[0.78125rem] font-semibold transition-colors cursor-pointer"
      >
        Open in editor <ArrowUpRight size={14} />
      </button>
    </div>
  );
}

// ─── Matrix detail (one RACM / sub-process) ───────────────────────────────────

function RacmMatrixView({ entry, framework, onBack, onViewSop, onUploadSop, onOpenFullEditor }: {
  entry: RacmEntry;
  framework: string;
  onBack: () => void;
  onViewSop: () => void;
  onUploadSop: () => void;
  onOpenFullEditor?: () => void;
}): JSX.Element {
  const { addToast } = useToast();
  const [keyOnly, setKeyOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<RACMRow | null>(null);

  const filteredRows = useMemo(() => (keyOnly ? entry.rows.filter(r => r.isKey) : entry.rows), [entry.rows, keyOnly]);
  const groups = useMemo(() => groupRacmBySubProcess(filteredRows), [filteredRows]);
  const stats = useMemo(() => entryStats(entry.rows), [entry.rows]);

  const toggleGroup = (sp: string) => setCollapsed(prev => { const n = new Set(prev); n.has(sp) ? n.delete(sp) : n.add(sp); return n; });
  const toggleRow = (id: string) => setExpandedRow(prev => (prev === id ? null : id));

  return (
    <div className="space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[0.78125rem] font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer">
        <ArrowLeft size={14} /> Back to RACM Library
      </button>

      {/* Toolbar */}
      <div className="glass-card rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-brand-50 shrink-0"><BookOpen size={16} className="text-brand-600" /></div>
          <div className="min-w-0">
            <div className="text-[0.90625rem] font-semibold text-text leading-tight">{entry.name}</div>
            <div className="text-[0.6875rem] text-text-muted mt-0.5">{entry.subProcess} · {framework}</div>
          </div>
        </div>

        {/* SOP chip */}
        <div className="flex items-center gap-2">
          {entry.sop ? (
            <button
              onClick={onViewSop}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-surface-2 hover:bg-primary-xlight/50 border border-border-light hover:border-primary/30 text-[0.71875rem] text-text-secondary hover:text-primary transition-colors cursor-pointer max-w-[260px]"
              title="Preview SOP"
            >
              <FileText size={12} className="shrink-0" />
              <span className="font-medium truncate">{entry.sop.name}</span>
              <Eye size={12} className="shrink-0" />
            </button>
          ) : (
            <button
              onClick={onUploadSop}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-dashed border-mitigated-300 text-[0.71875rem] font-medium text-mitigated-700 hover:bg-mitigated-50 transition-colors cursor-pointer"
            >
              <Sparkles size={12} /> Upload SOP → extract
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onOpenFullEditor && (
            <Gated permission="racm_edit" mode="disable" title="You don't have permission to edit a RACM">
            <button onClick={onOpenFullEditor} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.75rem] font-semibold transition-colors cursor-pointer" title="Open the full-page editor">
              <ArrowUpRight size={12} /> Open in editor
            </button>
            </Gated>
          )}
          <Gated permission="ctrl_export" mode="disable" title="You don't have permission to export">
          <button onClick={() => addToast({ message: `Downloading ${entry.name} as XLSX…`, type: 'info' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[0.75rem] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer">
            <Download size={12} /> Download
          </button>
          </Gated>
          <button
            onClick={() => setKeyOnly(v => !v)}
            aria-pressed={keyOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.75rem] font-semibold transition-colors cursor-pointer ${keyOnly ? 'bg-brand-50 border-brand-100/70 text-brand-600 hover:bg-brand-50/80' : 'bg-white border-border-light text-text-secondary hover:bg-primary-xlight/40 hover:border-primary/30 hover:text-primary'}`}
            title="Filter to key controls only"
          >
            <Filter size={12} /> Key controls only
            {keyOnly && <span className="ml-1 px-1.5 h-4 rounded-full text-[0.59375rem] font-bold bg-brand-600 text-white inline-flex items-center tabular-nums">{stats.keyControls}</span>}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        <StatTile icon={<AlertTriangle size={11} className="text-risk-700" />} label="Risks" value={stats.risks} sub="unique" />
        <StatTile icon={<Shield size={11} className="text-brand-600" />} label="Controls" value={stats.controls} sub="mapped" />
        <StatTile icon={<Key size={11} className="text-mitigated-700" />} label="Key Controls" value={stats.keyControls} sub={`of ${stats.controls}`} />
        <StatTile icon={<ListTree size={11} className="text-evidence-700" />} label="Attributes" value={stats.attributes} sub="across rows" />
        <StatTile icon={<BookOpen size={11} className="text-compliant-700" />} label="SOP" value={entry.sop ? 1 : 0} sub={entry.sop ? 'linked' : 'none'} />
      </div>

      {/* Table */}
      {filteredRows.length === 0 ? (
        <ListPlaceholder
          icon={Filter}
          title="No key controls in this RACM"
          body="Turn off the “Key controls only” filter to see all rows."
        />
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const isCollapsed = collapsed.has(group.subProcess);
            const groupRisks = new Set(group.rows.map(r => r.riskId)).size;
            const groupControls = new Set(group.rows.map(r => r.controlId)).size;
            const groupKey = group.rows.filter(r => r.isKey).length;
            return (
              <div key={group.subProcess} className="glass-card rounded-xl overflow-hidden">
                <button onClick={() => toggleGroup(group.subProcess)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors cursor-pointer text-left" aria-expanded={!isCollapsed}>
                  <div className="p-1.5 rounded-lg bg-brand-50 shrink-0"><Layers size={13} className="text-brand-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[0.84375rem] font-semibold text-text">{group.subProcess}</span>
                      <span className="text-[0.6875rem] text-text-muted">
                        {groupRisks} risk{groupRisks === 1 ? '' : 's'}
                        <span className="text-border mx-1.5">·</span>
                        {groupControls} control{groupControls === 1 ? '' : 's'}
                        {groupKey > 0 && (<><span className="text-border mx-1.5">·</span><span className="text-mitigated-700 font-semibold">{groupKey} key</span></>)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`text-text-muted transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }} className="overflow-hidden border-t border-border-light">
                      <RACMTable rows={group.rows} expandedRow={expandedRow} onToggleRow={toggleRow} onIdClick={() => addToast({ message: 'Risk/Control detail opening soon', type: 'info' })} onOpenDetail={setDetailRow} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>{detailRow && <RACMDetailDrawer row={detailRow} onClose={() => setDetailRow(null)} />}</AnimatePresence>
    </div>
  );
}

// ─── New RACM modal ───────────────────────────────────────────────────────────

function NewRacmModal({ onClose, onUploadRacm, onUploadSop }: { onClose: () => void; onUploadRacm: () => void; onUploadSop: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[560px] bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border-light">
          <div>
            <h2 className="text-[1rem] font-bold text-text">Create RACM</h2>
            <p className="text-[0.78125rem] text-text-secondary mt-0.5">Start from an existing matrix, or extract one from an SOP.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0"><X size={16} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-3">
          <button onClick={onUploadRacm} className="text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
            <div className="p-2 rounded-lg bg-evidence-50 inline-flex mb-3"><FileUp size={16} className="text-evidence-700" /></div>
            <div className="text-[0.84375rem] font-semibold text-text mb-1">Upload a RACM</div>
            <div className="text-[0.71875rem] text-text-muted leading-relaxed">Import an existing matrix (.xlsx / .csv).</div>
          </button>
          <button onClick={onUploadSop} className="text-left rounded-xl border border-border-light hover:border-primary/40 hover:bg-primary-xlight/30 p-5 transition-colors cursor-pointer">
            <div className="p-2 rounded-lg bg-brand-50 inline-flex mb-3"><Sparkles size={16} className="text-brand-600" /></div>
            <div className="text-[0.84375rem] font-semibold text-text mb-1 flex items-center gap-1.5">Upload an SOP <span className="text-text-muted">→</span> extract</div>
            <div className="text-[0.71875rem] text-text-muted leading-relaxed">IRA reads a procedure (.pdf/.docx) and drafts the RACM.</div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── SOP preview drawer ───────────────────────────────────────────────────────

function SopPreviewDrawer({ entry, onClose }: { entry: RacmEntry; onClose: () => void }): JSX.Element {
  const { addToast } = useToast();
  const sop = entry.sop;
  const stats = entryStats(entry.rows);
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[560px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50" role="dialog" aria-label="SOP preview"
      >
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-brand-50"><BookOpen size={14} className="text-brand-600" /></div>
              <span className="text-[0.65625rem] font-bold uppercase tracking-wider text-text-muted">SOP · {entry.subProcess}</span>
            </div>
            <h2 className="text-[1rem] font-bold text-ink-900 leading-snug truncate">{sop?.name ?? 'No SOP linked'}</h2>
            {sop && <div className="text-[0.6875rem] text-text-muted mt-0.5">{sop.version} · uploaded {sop.uploadedAgo}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0"><X size={16} /></button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Extracted summary */}
          <div className="rounded-xl border border-brand-100/70 bg-brand-50/30 p-4">
            <div className="flex items-center gap-1.5 mb-2"><Sparkles size={12} className="text-brand-600" /><span className="text-[0.65625rem] uppercase tracking-wider font-bold text-brand-700">Extracted from this SOP</span></div>
            <p className="text-[0.78125rem] text-text leading-relaxed">
              <span className="font-semibold tabular-nums">{stats.controls}</span> controls · <span className="font-semibold tabular-nums">{stats.risks}</span> risks · <span className="font-semibold tabular-nums">{stats.attributes}</span> attributes were mapped into the <span className="font-semibold">{entry.name}</span>.
            </p>
          </div>

          {/* Section outline */}
          <section>
            <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted mb-2">Document outline</h3>
            <ol className="space-y-1.5">
              {(sop?.sections ?? SOP_SECTIONS).map((sec, i) => (
                <li key={sec} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light bg-white">
                  <span className="w-5 h-5 rounded-md bg-surface-2 text-text-secondary text-[0.6875rem] font-bold inline-flex items-center justify-center tabular-nums shrink-0">{i + 1}</span>
                  <span className="text-[0.78125rem] text-text">{sec}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Extracted controls */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">Extracted controls</h3>
              <span className="text-[0.6875rem] text-text-muted">{entry.rows.length} rows</span>
            </div>
            <div className="space-y-1.5">
              {entry.rows.map(r => (
                <div key={r.id} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border-light bg-white">
                  <span className="text-[0.65625rem] font-mono font-semibold text-brand-600 bg-brand-50 border border-brand-100/70 rounded px-1.5 py-0.5 shrink-0 mt-0.5">{r.controlId}</span>
                  <p className="text-[0.75rem] text-text leading-snug">{r.controlDescription}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download size={12} />} onClick={() => addToast({ message: `Downloading ${sop?.name ?? 'SOP'}…`, type: 'info' })}>
            Download SOP
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>Close</Button>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── Extraction overlay ───────────────────────────────────────────────────────

function ExtractionOverlay({ filename, onCancel }: { filename: string; onCancel?: () => void }): JSX.Element {
  const steps = ['Parsing the SOP document', 'Identifying risks & control points', 'Mapping controls to risks', 'Drafting attributes & test procedures'];
  // Reassure (don't alarm) if extraction runs long, and always offer an escape.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }} className="relative w-full max-w-[440px] bg-white rounded-xl shadow-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-brand-50"><Loader2 size={20} className="text-brand-600 animate-spin" /></div>
          <div className="min-w-0">
            <div className="text-[1rem] font-bold text-ink-900">Extracting RACM from SOP</div>
            <div className="text-[0.71875rem] text-text-muted truncate flex items-center gap-1"><FileText size={11} />{filename}</div>
          </div>
        </div>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <motion.div
              key={s}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.32, duration: 0.3 }}
              className="flex items-center gap-2.5 text-[0.75rem] text-text-secondary"
            >
              <span className="w-4 h-4 rounded-full bg-brand-50 border border-brand-100 inline-flex items-center justify-center shrink-0">
                <Sparkles size={9} className="text-brand-600" />
              </span>
              {s}
            </motion.div>
          ))}
        </div>
        <div className="mt-5 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <motion.div className="h-full bg-brand-500 rounded-full" initial={{ width: '6%' }} animate={{ width: '92%' }} transition={{ duration: 1.5, ease: 'easeInOut' }} />
        </div>
        {slow && (
          <p className="mt-3 text-[0.6875rem] text-text-muted text-center">Still working. This is taking longer than usual…</p>
        )}
        {onCancel && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="text-[1.375rem] font-bold text-text leading-none tabular-nums">
        {value}
      </div>
      <div className="text-[0.65625rem] text-text-muted mt-1">{sub}</div>
    </div>
  );
}

function RACMTable({
  rows,
  expandedRow,
  onToggleRow,
  onIdClick,
  onOpenDetail,
}: {
  rows: RACMRow[];
  expandedRow: string | null;
  onToggleRow: (id: string) => void;
  onIdClick: () => void;
  onOpenDetail: (row: RACMRow) => void;
}) {
  return (
    <div className="text-[0.75rem]">
      {/* Column header */}
      <div
        className="grid items-center gap-3 px-4 py-2 bg-surface-2/40 border-b border-border-light text-[0.625rem] uppercase tracking-wider font-semibold text-text-muted/80"
        style={{ gridTemplateColumns: '22% 28% 10% 9% 9% 10% 5% 76px' }}
      >
        <div>Risk</div>
        <div>Control</div>
        <div>Assertion</div>
        <div>Frequency</div>
        <div>Type</div>
        <div>Automation</div>
        <div>Key</div>
        <div className="text-right">Actions</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border-light/60">
        {rows.map(row => {
          const isOpen = expandedRow === row.id;
          return (
            <div key={row.id} className="bg-white">
              <div
                className="grid items-start gap-3 px-4 py-3 hover:bg-surface-2/30 transition-colors"
                style={{ gridTemplateColumns: '22% 28% 10% 9% 9% 10% 5% 76px' }}
              >
                {/* Risk */}
                <div className="min-w-0">
                  <button
                    onClick={onIdClick}
                    className="text-[0.65625rem] font-mono font-semibold text-brand-600 hover:text-brand-700 hover:underline tabular-nums cursor-pointer"
                  >
                    {row.riskId}
                  </button>
                  <p className="text-[0.75rem] text-text mt-1 leading-snug line-clamp-3">
                    {row.riskDescription}
                  </p>
                </div>

                {/* Control */}
                <div className="min-w-0">
                  <button
                    onClick={onIdClick}
                    className="text-[0.65625rem] font-mono font-semibold text-brand-600 hover:text-brand-700 hover:underline tabular-nums cursor-pointer"
                  >
                    {row.controlId}
                  </button>
                  <p className="text-[0.75rem] text-text mt-1 leading-snug line-clamp-3">
                    {row.controlDescription}
                  </p>
                </div>

                {/* Assertion */}
                <div className="min-w-0">
                  <span className="inline-flex items-center px-2 h-5 rounded-md text-[0.65625rem] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                    {row.assertion}
                  </span>
                </div>

                {/* Frequency */}
                <div className="text-[0.71875rem] text-text-secondary">
                  {row.frequency}
                </div>

                {/* Type */}
                <div>
                  <span className={`inline-flex items-center px-2 h-5 rounded-md text-[0.65625rem] font-semibold border ${TYPE_CLS[row.controlType]}`}>
                    {row.controlType}
                  </span>
                </div>

                {/* Automation */}
                <div>
                  <span className={`inline-flex items-center px-2 h-5 rounded-md text-[0.65625rem] font-semibold border ${AUTOMATION_CLS[row.automation]}`}>
                    {row.automation}
                  </span>
                </div>

                {/* Key */}
                <div>
                  {row.isKey ? (
                    <span
                      title="Key control"
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.625rem] font-bold border border-mitigated-100/70"
                    >
                      K
                    </span>
                  ) : (
                    <span className="text-text-muted text-[0.6875rem]">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onOpenDetail(row)}
                    className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    aria-label="View details"
                    title="View detailed risk-control mapping"
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    onClick={() => onToggleRow(row.id)}
                    className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    aria-label={isOpen ? 'Collapse attributes' : 'Expand attributes'}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Attributes */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <AttributesList attributes={row.attributes} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttributesList({ attributes }: { attributes: ControlAttribute[] }) {
  return (
    <div className="px-4 pb-4 pt-1 bg-surface-2/30">
      <div className="border-l-2 border-brand-100 pl-4 ml-7 space-y-2.5">
        <div className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-text-muted">
          <ListTree size={11} className="text-brand-600" />
          Attributes & test procedures
          <span className="ml-0.5 text-text-muted/80 normal-case tracking-normal font-medium">
            ({attributes.length})
          </span>
        </div>
        <ul className="space-y-2">
          {attributes.map(attr => (
            <li
              key={attr.id}
              className="grid grid-cols-[88px_1fr] gap-3 items-start"
            >
              <span className="text-[0.65625rem] font-mono font-semibold text-brand-600 bg-brand-50 border border-brand-100/70 rounded px-1.5 py-0.5 tabular-nums leading-tight inline-flex items-center justify-center text-center">
                {attrCode(attr.id)}
              </span>
              <div className="min-w-0">
                <p className="text-[0.75rem] text-text leading-snug">
                  {attr.description}
                </p>
                <p className="text-[0.6875rem] italic text-text-muted mt-1 leading-snug">
                  {attr.testProcedure}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RACM Detail Drawer — full risk-control mapping for one RACM row
// ═════════════════════════════════════════════════════════════════════════════

function RACMDetailDrawer({ row, onClose }: { row: RACMRow; onClose: () => void }) {
  const { addToast } = useToast();

  // Mock linked workflows + test history for the demo. In a real system these
  // would be authored data tied to the control id.
  const linkedWorkflows = [
    { code: 'WF-P2P-001', name: 'Three-Way Match (PO · GRN · Invoice)', confidence: 92 },
    { code: 'WF-P2P-002', name: 'Duplicate Invoice Detector',           confidence: 78 },
    { code: 'WF-P2P-003', name: 'PO Approval Threshold Scan',           confidence: 64 },
  ];
  const testHistory = [
    { period: 'FY25 Q4', conclusion: 'Effective', tester: 'Tushar Goel', date: 'Mar 28, 2026' },
    { period: 'FY25 Q3', conclusion: 'Effective', tester: 'Neha Joshi',  date: 'Dec 18, 2025' },
    { period: 'FY25 Q2', conclusion: 'Inconclusive', tester: 'Tushar Goel', date: 'Sep 22, 2025' },
  ];
  const totalEvidence = row.attributes.reduce((s, a) => s + a.requiredEvidence.length, 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[640px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label="RACM row detail"
      >
        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-brand-50"><Library size={14} className="text-brand-600" /></div>
              <span className="text-[0.65625rem] font-bold uppercase tracking-wider text-text-muted">RACM row · {row.subProcess}</span>
              {row.isKey && (
                <span className="inline-flex items-center px-1.5 h-4 rounded text-[0.59375rem] font-bold bg-mitigated-50 text-mitigated-700 border border-mitigated-100/70">KEY</span>
              )}
            </div>
            <h2 className="text-[1rem] font-bold text-ink-900 leading-snug">
              <span className="font-mono text-brand-600">{row.riskId}</span>
              <span className="text-text-muted mx-2">→</span>
              <span className="font-mono text-brand-600">{row.controlId}</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Risk + Control mapped */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-risk-100/60 bg-risk-50/30 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} className="text-risk-700" />
                <span className="text-[0.65625rem] uppercase tracking-wider font-bold text-risk-700">Risk</span>
              </div>
              <div className="font-mono text-[0.6875rem] text-text-secondary mb-1.5">{row.riskId}</div>
              <p className="text-[0.78125rem] text-text leading-relaxed">{row.riskDescription}</p>
            </div>
            <div className="rounded-xl border border-compliant-100/60 bg-compliant-50/30 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield size={12} className="text-compliant-700" />
                <span className="text-[0.65625rem] uppercase tracking-wider font-bold text-compliant-700">Control</span>
              </div>
              <div className="font-mono text-[0.6875rem] text-text-secondary mb-1.5">{row.controlId}</div>
              <p className="text-[0.78125rem] text-text leading-relaxed">{row.controlDescription}</p>
            </div>
          </div>

          {/* Metadata chips */}
          <div className="flex items-center gap-2 flex-wrap text-[0.6875rem]">
            <Pill label="Assertion" value={row.assertion} />
            <Pill label="Frequency" value={row.frequency} />
            <Pill label="Type" value={row.controlType} />
            <Pill label="Automation" value={row.automation} />
          </div>

          {/* Attributes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">Attributes · sub-controls</h3>
              <span className="text-[0.6875rem] text-text-muted">{row.attributes.length} · {totalEvidence} evidence types required</span>
            </div>
            <div className="space-y-2.5">
              {row.attributes.map(a => (
                <div key={a.id} className="rounded-lg border border-border-light p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-1.5 h-4 rounded text-[0.625rem] font-bold bg-brand-50 text-brand-700 font-mono">{attrCode(a.id)}</span>
                    <span className="text-[0.78125rem] font-semibold text-text">{a.description}</span>
                  </div>
                  <p className="text-[0.71875rem] italic text-text-muted mb-2">{a.testProcedure}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[0.625rem] font-bold uppercase tracking-wider text-text-muted">Required evidence:</span>
                    {a.requiredEvidence.map(ev => (
                      <span key={ev} className="inline-flex items-center gap-1 px-1.5 h-4 rounded text-[0.625rem] font-medium bg-surface-2 text-text-secondary border border-border-light">
                        <FileText size={9} />{ev}
                      </span>
                    ))}
                  </div>
                  <div className="text-[0.65625rem] text-text-muted mt-1.5">
                    Population: <span className="font-medium tabular-nums">{a.populationSize.toLocaleString()}</span> · Default sample: <span className="font-medium tabular-nums">{a.defaultSampleSize}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Linked workflows */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">Linked workflows</h3>
              <button
                onClick={() => addToast({ message: 'Manage workflow links in the Controls tab', type: 'info' })}
                className="text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                Manage in Controls <ArrowUpRight size={10} />
              </button>
            </div>
            <div className="space-y-1.5">
              {linkedWorkflows.map(wf => (
                <div key={wf.code} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light">
                  <Workflow size={13} className="text-brand-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.78125rem] font-medium text-text truncate">{wf.name}</div>
                    <div className="text-[0.65625rem] text-text-muted font-mono">{wf.code}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full ${wf.confidence >= 85 ? 'bg-compliant' : wf.confidence >= 65 ? 'bg-mitigated' : 'bg-text-muted'}`} style={{ width: `${wf.confidence}%` }} />
                    </div>
                    <span className="text-[0.65625rem] font-bold text-text tabular-nums w-8 text-right">{wf.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Test history */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">Test history</h3>
              <span className="text-[0.6875rem] text-text-muted">last 3 periods</span>
            </div>
            <div className="space-y-1.5">
              {testHistory.map(h => (
                <div key={h.period} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-light">
                  <Calendar size={12} className="text-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.78125rem] font-medium text-text">{h.period}</div>
                    <div className="text-[0.65625rem] text-text-muted flex items-center gap-1.5">
                      <User size={9} />{h.tester}
                      <span className="text-border">·</span>
                      <span>{h.date}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 h-5 rounded text-[0.625rem] font-bold ${
                    h.conclusion === 'Effective' ? 'bg-compliant-50 text-compliant-700'
                    : h.conclusion === 'Deficient' ? 'bg-risk-50 text-risk-700'
                    : 'bg-mitigated-50 text-mitigated-700'
                  }`}>
                    <CheckCircle2 size={10} />
                    {h.conclusion}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Eye size={12} />}
            onClick={() => addToast({ message: 'Opening test workspace in Controls tab…', type: 'info' })}
          >
            Open in Controls
          </Button>
        </footer>
      </motion.aside>
    </>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md bg-surface-2 text-text-secondary border border-border-light">
      <span className="text-[0.625rem] uppercase tracking-wider font-bold text-text-muted">{label}</span>
      <span className="text-[0.6875rem] font-semibold text-text">{value}</span>
    </div>
  );
}
