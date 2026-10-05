/**
 * Audit with AI — a full page, launched from the Workflow Builder.
 *
 *   1. Context & scope   connected data, documentation, last reports, other
 *                        files; then every domain or a chosen few.
 *   (Ira analyses)       a staged trail derived from what was attached.
 *   2. Recommended plan  one engagement per domain → controls → one check
 *                        each (reuse / new + impact / manual), coverage
 *                        before → after, and where the checks land.
 *   3. Timeline          phase plan per engagement, editable start.
 *   4. Create            commit; then open the engagement or build the new
 *                        checks with Ira one by one.
 *
 * Replaces the One-Click Audit modal, which kept only a control count on
 * save; this page commits controls and checks (see data/auditPlan/commit).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Check, Database, FileText, History, Layers, Plus, Upload, X,
  ChevronDown, CalendarDays, Workflow as WorkflowIcon, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '../shared/Button';
import { Pill } from '../shared/StatusBadge';
import { StepRail } from '../audit/sox-testing/ScopingWizard';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';
import { SEED } from '../data-sources/sources';
import { ATR_LIBRARY } from '../../data/atrLibrary';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import type { ProcessCode } from '../../data/engagements';
import {
  CHECK_CATALOG, PROCESS_BLURB, PROCESS_LONG, coverageFor, commitPlan, planFromContext, portfolioCoverage, withPhases,
  loadAuditDraft, saveAuditDraft, clearAuditDraft, createBatch, itemsFromPlanRows,
  type AuditPlan, type AuditPlanContext, type CommittedEngagement, type PlanEngagement,
} from '../../data/auditPlan';
import { LIBRARY_WORKFLOWS } from '../workflow/WorkflowLibraryView';
import { CheckMix, ControlCheckCard, CoverageMeter, IraMark, PlanGantt, TargetPicker } from './PlanParts';
import AdaptDataModal from './AdaptDataModal';

interface Props {
  onBack: () => void;
  onOpenEngagement: (engagementId: string) => void;
  /** A batch of this plan's new checks, built on the files the user chose. */
  onBuildBatch: (batchId: string) => void;
  onOpenLibrary: () => void;
}

const STEPS = ['Context & scope', 'Recommended plan', 'Timeline', 'Create'] as const;
const DOMAINS: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC'];

/** Documentation already in the Knowledge Hub that reads as audit context. */
const KNOWN_DOCUMENTS = [
  { name: 'P2P Standard Operating Procedure.pdf', meta: 'SOP · 42 pages' },
  { name: 'Delegation of Authority matrix.xlsx', meta: 'DOA · 6 sheets' },
  { name: 'Revenue recognition policy.pdf', meta: 'Policy · 18 pages' },
  { name: 'IT access management policy.pdf', meta: 'Policy · 12 pages' },
];

const DATABASES = SEED.filter(s => s.type === 'database');

type Stage = 'context' | 'analysing' | 'plan' | 'timeline' | 'create' | 'done';
const STAGE_STEP: Record<Stage, number> = { context: 0, analysing: 0, plan: 1, timeline: 2, create: 3, done: 3 };

export default function AuditWithAiView({ onBack, onOpenEngagement, onBuildBatch, onOpenLibrary }: Props) {
  const { currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore progress if the user left mid-way (or reloaded).
  const [draft] = useState(loadAuditDraft);
  const [stage, setStage] = useState<Stage>(draft?.stage ?? 'context');
  // ── Step 1: context ──
  const [databases, setDatabases] = useState<string[]>(draft?.databases ?? ['SAP ERP: AP Module', 'Vendor Master Data', 'GL Transaction History']);
  const [documents, setDocuments] = useState<string[]>(draft?.documents ?? ['P2P Standard Operating Procedure.pdf', 'Delegation of Authority matrix.xlsx']);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>(draft?.uploadedDocs ?? []);
  const [reports, setReports] = useState<string[]>(draft?.reports ?? ([ATR_LIBRARY[0]?.id].filter(Boolean) as string[]));
  const [files, setFiles] = useState<string[]>(draft?.files ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scopeAll, setScopeAll] = useState(draft?.scopeAll ?? true);
  const [domains, setDomains] = useState<ProcessCode[]>(draft?.domains ?? ['P2P', 'R2R']);
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const docInputRef = useRef<HTMLInputElement>(null);

  // ── Plan ──
  const [plan, setPlan] = useState<AuditPlan | null>(draft?.plan ?? null);
  const [expanded, setExpanded] = useState<string | null>(draft?.plan?.engagements[0]?.id ?? null);
  const [committed, setCommitted] = useState<CommittedEngagement[] | null>(null);

  const scopeDomains = scopeAll ? DOMAINS : domains;
  const ctx: AuditPlanContext = useMemo(() => ({
    databases, documents: [...documents, ...uploadedDocs], reports, files, notes,
  }), [databases, documents, uploadedDocs, reports, files, notes]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [stage]);

  // Keep the draft as the user works; drop it once the plan is created.
  useEffect(() => {
    if (stage === 'done') { clearAuditDraft(); return; }
    saveAuditDraft({
      stage: stage === 'analysing' ? 'context' : stage,
      databases, documents, uploadedDocs, reports, files, scopeAll, domains, notes, plan,
    });
  }, [stage, databases, documents, uploadedDocs, reports, files, scopeAll, domains, notes, plan]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  const startAnalysis = () => {
    setStage('analysing');
    logEvent({ action: 'Create', description: `Audit with AI — planning ${scopeDomains.join(', ')}`, module: 'Workflow Builder', entity: 'Audit plan' });
  };

  const onAnalysisDone = () => {
    const p = planFromContext(ctx, scopeDomains, { owner: currentUser?.name ?? 'You' });
    setPlan(p);
    setExpanded(p.engagements[0]?.id ?? null);
    setStage('plan');
  };

  const updateEng = (id: string, fn: (e: PlanEngagement) => PlanEngagement) =>
    setPlan(p => (p ? { ...p, engagements: p.engagements.map(e => (e.id === id ? fn(e) : e)) } : p));

  const selectedEngs = plan?.engagements.filter(e => e.selected) ?? [];

  const create = () => {
    if (!plan) return;
    const result = commitPlan(plan);
    setCommitted(result);
    setStage('done');
    logEvent({
      action: 'Create',
      description: `Audit with AI — created ${result.filter(r => r.created).length} engagement(s), ${result.reduce((s, r) => s + r.newChecks.length, 0)} draft checks`,
      module: 'Engagements',
      entity: 'Engagement',
    });
  };

  const canContinue = stage === 'context'
    ? scopeDomains.length > 0
    : stage === 'plan' || stage === 'timeline'
      ? selectedEngs.some(e => e.controls.some(c => c.selected))
      : true;

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-white">
      <div className="max-w-[68rem] mx-auto px-6 md:px-10 pt-8 pb-32">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[0.75rem] text-ink-500 hover:text-brand-700 font-medium mb-5 cursor-pointer transition-colors"
        >
          <ArrowLeft size={14} /> Workflow Builder
        </button>

        <header className="flex items-start gap-4 mb-6">
          <IraMark size={40} />
          <div className="min-w-0">
            <div className="font-mono text-[0.6875rem] text-ink-500 tracking-tight">Audit with AI</div>
            <h1 className="font-serif text-[2.125rem] tracking-tight text-ink-900 leading-[1.15]">
              {stage === 'done' ? 'Your audit plan is live' : 'Plan a full audit from what you already have'}
            </h1>
            <p className="text-[0.875rem] text-ink-500 mt-1 max-w-[46rem]">
              Point Ira at your data, documentation and last reports. It recommends engagements, the controls in each,
              and a check for every control — reusing workflows you already have and sizing what new ones would add.
            </p>
          </div>
        </header>

        {stage !== 'analysing' && stage !== 'done' && (
          <StepRail
            steps={STEPS}
            step={STAGE_STEP[stage]}
            onStepClick={(i) => {
              if (i === 0) setStage('context');
              else if (i === 1 && plan) setStage('plan');
              else if (i === 2 && plan) setStage('timeline');
            }}
          />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            {stage === 'context' && (
              <ContextStep
                databases={databases} onToggleDb={n => setDatabases(d => toggle(d, n))}
                documents={documents} onToggleDoc={n => setDocuments(d => toggle(d, n))}
                uploadedDocs={uploadedDocs} onRemoveUploadedDoc={n => setUploadedDocs(d => d.filter(x => x !== n))}
                onUploadDocs={() => docInputRef.current?.click()}
                reports={reports} onToggleReport={id => setReports(r => toggle(r, id))}
                files={files} onRemoveFile={n => setFiles(f => f.filter(x => x !== n))}
                onAddFiles={() => setPickerOpen(true)}
                scopeAll={scopeAll} setScopeAll={setScopeAll}
                domains={domains} onToggleDomain={d => setDomains(ds => toggle(ds, d))}
                notes={notes} setNotes={setNotes}
              />
            )}
            {stage === 'analysing' && <AnalysingStep ctx={ctx} domains={scopeDomains} onDone={onAnalysisDone} />}
            {stage === 'plan' && plan && (
              <PlanStep
                plan={plan}
                expanded={expanded}
                setExpanded={setExpanded}
                updateEng={updateEng}
              />
            )}
            {stage === 'timeline' && plan && <TimelineStep plan={plan} updateEng={updateEng} />}
            {stage === 'create' && plan && <CreateStep plan={plan} />}
            {stage === 'done' && committed && (
              <DoneStep
                committed={committed}
                onOpenEngagement={onOpenEngagement}
                owner={currentUser?.name ?? 'You'}
                onBuildBatch={onBuildBatch}
                onOpenLibrary={onOpenLibrary}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky action bar */}
      {stage !== 'analysing' && stage !== 'done' && (
        <div className="sticky bottom-0 z-10 border-t border-canvas-border bg-white/95 backdrop-blur-sm">
          <div className="max-w-[68rem] mx-auto px-6 md:px-10 h-16 flex items-center justify-between gap-4">
            <FooterSummary stage={stage} ctx={ctx} domains={scopeDomains} plan={plan} />
            <div className="flex items-center gap-2 shrink-0">
              {stage !== 'context' && (
                <Button
                  variant="outline"
                  onClick={() => setStage(stage === 'plan' ? 'context' : stage === 'timeline' ? 'plan' : 'timeline')}
                >
                  Back
                </Button>
              )}
              {stage === 'context' && (
                <Button variant="primary" disabled={!canContinue} onClick={startAnalysis} rightIcon={<ArrowRight size={14} />}>
                  Build my audit plan
                </Button>
              )}
              {stage === 'plan' && (
                <Button variant="primary" disabled={!canContinue} onClick={() => setStage('timeline')} rightIcon={<ArrowRight size={14} />}>
                  Review timeline
                </Button>
              )}
              {stage === 'timeline' && (
                <Button variant="primary" disabled={!canContinue} onClick={() => setStage('create')} rightIcon={<ArrowRight size={14} />}>
                  Review & create
                </Button>
              )}
              {stage === 'create' && (
                <button
                  type="button"
                  onClick={create}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-gradient-to-r from-brand-600 to-fuchsia-600 text-white text-[0.8125rem] font-semibold hover:opacity-95 transition-opacity cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Check size={14} /> Create {selectedEngs.length} engagement{selectedEngs.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <input
        ref={docInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xlsx,.xls,.txt"
        className="hidden"
        onChange={e => {
          const names = Array.from(e.target.files ?? []).map(f => f.name);
          setUploadedDocs(d => [...d, ...names.filter(n => !d.includes(n))]);
          e.target.value = '';
        }}
      />
      <DataPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add files & sources"
        confirmLabel="Add to context"
        onConfirm={(sel: AttachmentSelection[]) => {
          const names = sel.map(s => s.name);
          setFiles(f => [...f, ...names.filter(n => !f.includes(n))]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Context & scope
// ─────────────────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, hint, children, action }: {
  icon: React.ElementType; title: string; hint: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="py-6 border-t border-canvas-border first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-2.5">
          <Icon size={16} className="text-ink-500 mt-0.5 shrink-0" aria-hidden />
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-ink-900">{title}</h2>
            <p className="text-[0.8125rem] text-ink-500">{hint}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SelectTile({ selected, onClick, title, meta, icon: Icon }: {
  selected: boolean; onClick: () => void; title: string; meta: string; icon: React.ElementType;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={`text-left rounded-lg border p-3 flex items-start gap-3 transition-colors cursor-pointer ${
        selected ? 'border-brand-600 bg-brand-50/50' : 'border-canvas-border bg-white hover:border-brand-200'
      }`}
    >
      <span className={`size-8 rounded-md flex items-center justify-center shrink-0 ${selected ? 'bg-brand-100 text-brand-700' : 'bg-paper-100 text-ink-500'}`}>
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-medium text-ink-900 truncate">{title}</span>
        <span className="block text-[0.75rem] text-ink-500 truncate">{meta}</span>
      </span>
      <span className={`size-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${selected ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300'}`}>
        {selected && <Check size={11} strokeWidth={3} />}
      </span>
    </button>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1 rounded-full bg-paper-100 text-[0.75rem] text-ink-700">
      <span className="truncate max-w-[16rem]">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="size-5 rounded-full flex items-center justify-center hover:bg-paper-300/60 cursor-pointer">
        <X size={11} />
      </button>
    </span>
  );
}

function ContextStep(p: {
  databases: string[]; onToggleDb: (n: string) => void;
  documents: string[]; onToggleDoc: (n: string) => void;
  uploadedDocs: string[]; onRemoveUploadedDoc: (n: string) => void; onUploadDocs: () => void;
  reports: string[]; onToggleReport: (id: string) => void;
  files: string[]; onRemoveFile: (n: string) => void; onAddFiles: () => void;
  scopeAll: boolean; setScopeAll: (v: boolean) => void;
  domains: ProcessCode[]; onToggleDomain: (d: ProcessCode) => void;
  notes: string; setNotes: (v: string) => void;
}) {
  return (
    <div>
      <Section icon={Database} title="Connected data" hint="Ira reads schemas and profiles — raw rows never leave your perimeter.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {DATABASES.map(db => (
            <SelectTile key={db.id} icon={Database} title={db.name} meta={db.subtype} selected={p.databases.includes(db.name)} onClick={() => p.onToggleDb(db.name)} />
          ))}
        </div>
      </Section>

      <Section
        icon={FileText}
        title="Documentation"
        hint="SOPs, policies and the DOA matrix — Ira reads them for control language and thresholds."
        action={<Button variant="outline" size="sm" leftIcon={<Upload size={13} />} onClick={p.onUploadDocs}>Upload</Button>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {KNOWN_DOCUMENTS.map(d => (
            <SelectTile key={d.name} icon={FileText} title={d.name} meta={d.meta} selected={p.documents.includes(d.name)} onClick={() => p.onToggleDoc(d.name)} />
          ))}
        </div>
        {p.uploadedDocs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {p.uploadedDocs.map(n => <RemovableChip key={n} label={n} onRemove={() => p.onRemoveUploadedDoc(n)} />)}
          </div>
        )}
      </Section>

      <Section icon={History} title="Last audit reports" hint="Prior findings raise the impact of the checks that would catch them again.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {ATR_LIBRARY.slice(0, 3).map(r => (
            <SelectTile key={r.id} icon={History} title={r.name} meta={`${r.area} · ${r.generatedAt.split(',').slice(0, 2).join(',')}`} selected={p.reports.includes(r.id)} onClick={() => p.onToggleReport(r.id)} />
          ))}
        </div>
      </Section>

      <Section
        icon={Plus}
        title="Anything else"
        hint="Extracts, prior working papers, risk registers — any file or source in the Knowledge Hub."
        action={<Button variant="outline" size="sm" leftIcon={<Plus size={13} />} onClick={p.onAddFiles}>Add files</Button>}
      >
        {p.files.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-400">Nothing added.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {p.files.map(n => <RemovableChip key={n} label={n} onRemove={() => p.onRemoveFile(n)} />)}
          </div>
        )}
      </Section>

      <Section icon={Layers} title="What should Ira audit?" hint="Everything gets one engagement per domain. Or pick the domains you care about.">
        <div role="radiogroup" aria-label="Audit scope" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
          {[
            { all: true, title: 'Audit everything', sub: 'All five domains — one engagement each' },
            { all: false, title: 'Specific domains', sub: 'Choose one or more below' },
          ].map(o => {
            const active = p.scopeAll === o.all;
            return (
              <button
                key={o.title}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => p.setScopeAll(o.all)}
                className={`text-left rounded-lg border px-4 py-3 transition-colors cursor-pointer ${active ? 'border-brand-600 bg-brand-50/50' : 'border-canvas-border hover:border-brand-200'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`size-3.5 rounded-full border flex items-center justify-center ${active ? 'border-brand-600' : 'border-ink-300'}`}>
                    {active && <span className="size-1.5 rounded-full bg-brand-600" />}
                  </span>
                  <span className="text-[0.875rem] font-semibold text-ink-900">{o.title}</span>
                </div>
                <div className="mt-0.5 pl-[1.375rem] text-[0.75rem] text-ink-500">{o.sub}</div>
              </button>
            );
          })}
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 ${p.scopeAll ? 'opacity-60' : ''}`}>
          {DOMAINS.map(d => {
            const on = p.scopeAll || p.domains.includes(d);
            const count = CHECK_CATALOG.filter(e => e.process === d).length;
            return (
              <button
                key={d}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={p.scopeAll}
                onClick={() => p.onToggleDomain(d)}
                className={`text-left rounded-lg border p-3 transition-colors ${p.scopeAll ? 'cursor-default' : 'cursor-pointer'} ${on ? 'border-brand-600 bg-brand-50/50' : 'border-canvas-border hover:border-brand-200'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.75rem] font-semibold text-ink-900">{d}</span>
                  <span className="text-[0.6875rem] text-ink-400 tabular-nums">{count} controls</span>
                </div>
                <div className="mt-1 text-[0.8125rem] font-medium text-ink-900">{PROCESS_LONG[d]}</div>
                <div className="text-[0.6875rem] text-ink-500 leading-snug">{PROCESS_BLURB[d]}</div>
              </button>
            );
          })}
        </div>
        <label className="block mt-4">
          <span className="text-[0.75rem] font-medium text-ink-600">Anything Ira should focus on? <span className="text-ink-400 font-normal">Optional</span></span>
          <textarea
            value={p.notes}
            onChange={e => p.setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Vendor fraud is the board's main concern this year; the GL migrated to Snowflake in June."
            className="mt-1.5 w-full rounded-md border border-canvas-border px-3 py-2 text-[0.8125rem] text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-300 focus:ring-2 focus:ring-primary/10 resize-none"
          />
        </label>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysing — the trail is derived from what was attached, not canned copy.
// ─────────────────────────────────────────────────────────────────────────────

function AnalysingStep({ ctx, domains, onDone }: { ctx: AuditPlanContext; domains: ProcessCode[]; onDone: () => void }) {
  const reduced = useReducedMotion();
  const controlCount = CHECK_CATALOG.filter(e => domains.includes(e.process)).length;
  const reportNames = ATR_LIBRARY.filter(r => ctx.reports.includes(r.id)).map(r => r.name);
  const steps = [
    ctx.databases.length > 0 ? `Reading schemas of ${ctx.databases.join(', ')}` : 'No database connected — planning from the catalog',
    ctx.documents.length > 0 ? `Parsing ${ctx.documents.length} document${ctx.documents.length === 1 ? '' : 's'} for control language and thresholds` : 'No documentation attached',
    reportNames.length > 0 ? `Pulling prior findings from ${reportNames.join(', ')}` : 'No prior reports attached',
    ...(ctx.files.length > 0 ? [`Profiling ${ctx.files.length} additional file${ctx.files.length === 1 ? '' : 's'}`] : []),
    `Matching ${controlCount} key controls across ${domains.join(', ')}`,
    `Checking ${LIBRARY_WORKFLOWS.length} library workflows for reuse`,
    'Sizing coverage and drafting the timeline',
  ];
  const [done, setDone] = useState(0);
  const stepMs = reduced ? 120 : 650;
  useEffect(() => {
    if (done >= steps.length) {
      const t = window.setTimeout(onDone, reduced ? 50 : 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setDone(d => d + 1), stepMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <div className="max-w-[40rem] mx-auto mt-10 rounded-lg border border-canvas-border bg-canvas-elevated p-6" aria-live="polite">
      <div className="flex items-center gap-3 mb-4">
        <IraMark size={28} />
        <div>
          <div className="text-[0.9375rem] font-semibold text-ink-900">Ira is building your plan</div>
          <div className="text-[0.75rem] text-ink-500">{domains.length} domain{domains.length === 1 ? '' : 's'} · {controlCount} controls in scope</div>
        </div>
      </div>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-start gap-2.5 text-[0.8125rem] ${i < done ? 'text-ink-700' : i === done ? 'text-ink-900 font-medium' : 'text-ink-300'}`}>
            <span className="mt-0.5 size-4 flex items-center justify-center shrink-0">
              {i < done ? <Check size={14} className="text-compliant-700" /> : i === done ? <Loader2 size={14} className="animate-spin text-brand-600" /> : <span className="size-1.5 rounded-full bg-ink-300" />}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Recommended plan
// ─────────────────────────────────────────────────────────────────────────────

type CheckFilter = 'all' | 'new' | 'reuse' | 'manual';

function PlanStep({ plan, expanded, setExpanded, updateEng }: {
  plan: AuditPlan;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  updateEng: (id: string, fn: (e: PlanEngagement) => PlanEngagement) => void;
}) {
  const selected = plan.engagements.filter(e => e.selected);
  const allControls = selected.flatMap(e => e.controls.filter(c => c.selected));
  const portfolio = portfolioCoverage(plan.engagements);
  const newChecks = allControls.filter(c => c.check.kind === 'new');
  const highNew = newChecks.filter(c => c.check.impact === 'High').length;

  return (
    <div>
      {/* Portfolio summary */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-3 mb-6">
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
          <div className="text-[0.75rem] font-medium text-ink-600 mb-2">Ira recommends</div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { v: selected.length, l: 'engagements' },
              { v: allControls.length, l: 'controls' },
              { v: allControls.filter(c => c.check.kind === 'reuse').length, l: 'reuse existing' },
              { v: newChecks.length, l: 'need your data' },
            ].map(k => (
              <div key={k.l}>
                <div className="font-mono tabular-nums text-[1.5rem] font-semibold text-ink-900 leading-none">{k.v}</div>
                <div className="mt-1 text-[0.6875rem] text-ink-500">{k.l}</div>
              </div>
            ))}
          </div>
          {highNew > 0 && (
            <p className="mt-3 text-[0.75rem] text-ink-600">
              <span className="font-semibold text-ink-900">{highNew}</span> of the new checks are high impact — they close gaps on high-rated risks or repeat findings.
            </p>
          )}
        </div>
        <CoverageMeter coverage={portfolio} label="Portfolio automated test coverage" />
      </div>

      <ul className="space-y-3">
        {plan.engagements.map(eng => (
          <EngagementCard
            key={eng.id}
            eng={eng}
            open={expanded === eng.id}
            onToggleOpen={() => setExpanded(expanded === eng.id ? null : eng.id)}
            updateEng={updateEng}
          />
        ))}
      </ul>
    </div>
  );
}

function EngagementCard({ eng, open, onToggleOpen, updateEng }: {
  eng: PlanEngagement;
  open: boolean;
  onToggleOpen: () => void;
  updateEng: (id: string, fn: (e: PlanEngagement) => PlanEngagement) => void;
}) {
  const [filter, setFilter] = useState<CheckFilter>('all');
  const cov = coverageFor(eng.process, eng.controls);
  const shown = eng.controls.filter(c => filter === 'all' || c.check.kind === filter);
  const count = (k: CheckFilter) => (k === 'all' ? eng.controls.length : eng.controls.filter(c => c.check.kind === k).length);

  return (
    <li className={`rounded-lg border bg-canvas-elevated transition-colors ${eng.selected ? 'border-canvas-border' : 'border-dashed border-canvas-border'}`}>
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={eng.selected}
          aria-label={`Include ${eng.name}`}
          onClick={() => updateEng(eng.id, e => ({ ...e, selected: !e.selected }))}
          className={`mt-1 size-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${eng.selected ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 bg-white'}`}
        >
          {eng.selected && <Check size={11} strokeWidth={3} />}
        </button>
        <div className={`min-w-0 flex-1 ${eng.selected ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-2 text-[0.6875rem] text-ink-500">
            <span className="font-mono font-semibold text-ink-700">{eng.process}</span>
            <span aria-hidden>·</span>
            <span>{eng.type}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{eng.confidence}% confidence</span>
          </div>
          <input
            value={eng.name}
            onChange={e => updateEng(eng.id, x => ({ ...x, name: e.target.value }))}
            aria-label="Engagement name"
            className="mt-0.5 w-full bg-transparent text-[1.0625rem] font-semibold text-ink-900 outline-none rounded focus:ring-2 focus:ring-primary/15 -mx-1 px-1"
          />
          <p className="mt-1 text-[0.8125rem] text-ink-600 leading-relaxed">{eng.rationale}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.6875rem] text-ink-400">Grounded in</span>
            {eng.sources.map(s => (
              <span key={s} className="inline-flex items-center h-6 px-2 rounded-md bg-paper-100 text-[0.6875rem] text-ink-600">{s}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_21rem] gap-4 items-end">
            <CheckMix controls={eng.controls} />
            <CoverageMeter coverage={cov} label={`${eng.process} coverage`} compact />
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-label={open ? 'Collapse controls' : 'Expand controls'}
          className="size-8 rounded-md flex items-center justify-center text-ink-500 hover:bg-brand-50 cursor-pointer shrink-0"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && eng.selected && (
        <div className="border-t border-canvas-border p-4 bg-paper-50/40">
          <div className="mb-4">
            <div className="text-[0.75rem] font-medium text-ink-600 mb-1.5">Where these checks go</div>
            <TargetPicker engagement={eng} onChange={target => updateEng(eng.id, e => ({ ...e, target }))} />
          </div>
          <div role="tablist" aria-label="Filter checks" className="flex items-center gap-1 mb-3">
            {(['all', 'new', 'reuse', 'manual'] as CheckFilter[]).map(k => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={`h-7 px-3 rounded-full text-[0.75rem] font-medium cursor-pointer transition-colors ${filter === k ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-paper-100'}`}
              >
                {{ all: 'All', new: 'Need data', reuse: 'Reuse existing', manual: 'Manual' }[k]} <span className="tabular-nums opacity-70">{count(k)}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {shown.map(c => (
              <ControlCheckCard
                key={c.id}
                control={c}
                onToggle={() => updateEng(eng.id, e => withPhases({ ...e, controls: e.controls.map(x => (x.id === c.id ? { ...x, selected: !x.selected } : x)) }))}
              />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Timeline
// ─────────────────────────────────────────────────────────────────────────────

const fmtDay = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function TimelineStep({ plan, updateEng }: { plan: AuditPlan; updateEng: (id: string, fn: (e: PlanEngagement) => PlanEngagement) => void }) {
  const selected = plan.engagements.filter(e => e.selected);
  const first = selected.map(e => e.phases[0]?.start).sort()[0];
  const last = selected.map(e => e.phases[e.phases.length - 1]?.end).sort().reverse()[0];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[0.9375rem] font-semibold text-ink-900">Plan of record</h2>
        {first && last && <span className="text-[0.8125rem] text-ink-500 tabular-nums">{fmtDay(first)} – {fmtDay(last)}</span>}
      </div>
      <PlanGantt engagements={plan.engagements} />
      <p className="mt-2 text-[0.75rem] text-ink-500">
        Engagements start two weeks apart so fieldwork doesn't overlap. The build phase is sized at two new checks a week; data readiness gets an extra week when a source isn't connected yet.
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {selected.map(e => (
          <div key={e.id} className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[0.6875rem] text-ink-500">{e.process}</div>
                <div className="text-[0.875rem] font-semibold text-ink-900 truncate">{e.name}</div>
              </div>
              <label className="flex items-center gap-1.5 text-[0.75rem] text-ink-600 shrink-0">
                <CalendarDays size={13} aria-hidden /> Start
                <input
                  type="date"
                  value={e.phases[0]?.start ?? ''}
                  onChange={ev => ev.target.value && updateEng(e.id, x => withPhases(x, ev.target.value))}
                  className="h-8 rounded-md border border-canvas-border px-2 text-[0.75rem] font-mono tabular-nums outline-none focus:border-brand-300"
                />
              </label>
            </div>
            <table className="mt-3 w-full text-[0.8125rem]">
              <tbody>
                {e.phases.map(p => (
                  <tr key={p.key} className="border-t border-canvas-border first:border-t-0">
                    <td className="py-1.5 text-ink-700">{p.label}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-[0.75rem] text-ink-500">{fmtDay(p.start).replace(/, \d{4}$/, '')} – {fmtDay(p.end).replace(/, \d{4}$/, '')}</td>
                    <td className="py-1.5 pl-3 text-right font-mono tabular-nums text-[0.75rem] text-ink-400 w-12">{p.weeks} wk</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Create
// ─────────────────────────────────────────────────────────────────────────────

function CreateStep({ plan }: { plan: AuditPlan }) {
  const selected = plan.engagements.filter(e => e.selected);
  return (
    <div>
      <h2 className="text-[0.9375rem] font-semibold text-ink-900 mb-1">What happens when you create</h2>
      <p className="text-[0.8125rem] text-ink-500 mb-4">
        Each engagement is created as Planned with its controls. Reused workflows are linked to their controls; new checks land in the Workflow Library as drafts, ready for Ira to build one by one.
      </p>
      <ul className="space-y-2.5">
        {selected.map(e => {
          const sel = e.controls.filter(c => c.selected);
          const n = (k: string) => sel.filter(c => c.check.kind === k).length;
          const cov = coverageFor(e.process, e.controls);
          return (
            <li key={e.id} className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.6875rem] font-semibold text-ink-700">{e.process}</span>
                  {e.target.kind === 'new'
                    ? <Pill tone="info">New engagement</Pill>
                    : <Pill tone="evidence">Adds to {e.target.engagementName}</Pill>}
                </div>
                <div className="mt-1 text-[0.875rem] font-semibold text-ink-900 truncate">{e.name}</div>
                <div className="mt-0.5 text-[0.75rem] text-ink-500 tabular-nums">
                  {sel.length} controls · {n('reuse')} linked · {n('new')} draft checks · {n('manual')} manual · {e.phases.reduce((s, p) => s + p.weeks, 0)} weeks
                </div>
              </div>
              <div className="w-full md:w-[16rem] shrink-0">
                <CoverageMeter coverage={cov} label="Coverage" compact />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DoneStep({ committed, owner, onOpenEngagement, onBuildBatch, onOpenLibrary }: {
  committed: CommittedEngagement[];
  onOpenEngagement: (id: string) => void;
  owner: string;
  onBuildBatch: (batchId: string) => void;
  onOpenLibrary: () => void;
}) {
  // Ask for the files first (matched sources, bulk upload), then build.
  const [adaptFor, setAdaptFor] = useState<CommittedEngagement | null>(null);
  const drafts = committed.reduce((s, c) => s + c.newChecks.length, 0);
  return (
    <div>
      <p className="text-[0.875rem] text-ink-600 mb-4">
        {committed.filter(c => c.created).length} engagement{committed.filter(c => c.created).length === 1 ? '' : 's'} created
        {committed.some(c => !c.created) ? `, ${committed.filter(c => !c.created).length} extended` : ''}. {drafts} new check{drafts === 1 ? ' is' : 's are'} waiting as drafts.
      </p>
      <ul className="space-y-2.5">
        {committed.map(c => (
          <li key={c.engagementId} className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-compliant-700" aria-hidden />
                <span className="text-[0.875rem] font-semibold text-ink-900 truncate">{c.engagementName}</span>
              </div>
              <div className="mt-0.5 pl-[1.375rem] text-[0.75rem] text-ink-500 tabular-nums">
                {c.controls.length} controls · {c.reused} linked · {c.newChecks.length} drafts · {c.manual} manual
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" rightIcon={<ExternalLink size={12} />} onClick={() => onOpenEngagement(c.engagementId)}>
                Open engagement
              </Button>
              {c.newChecks.length > 0 && (
                <Button variant="primary" size="sm" leftIcon={<WorkflowIcon size={13} />} onClick={() => setAdaptFor(c)}>
                  Build {c.newChecks.length} check{c.newChecks.length === 1 ? '' : 's'} with Ira
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {drafts > 0 && (
        <button onClick={onOpenLibrary} className="mt-4 text-[0.8125rem] font-medium text-brand-700 hover:underline cursor-pointer">
          See the drafts in the Workflow Library →
        </button>
      )}
      <AnimatePresence>
        {adaptFor && (
          <AdaptDataModal
            keys={adaptFor.newChecks.map(r => r.stdKey).filter((x): x is string => !!x)}
            onClose={() => setAdaptFor(null)}
            onContinue={(choices) => {
              const c = adaptFor;
              setAdaptFor(null);
              const items = itemsFromPlanRows(c.newChecks, choices);
              const batchId = createBatch({
                title: `Building ${items.length} check${items.length === 1 ? '' : 's'} for ${c.engagementName}`,
                origin: 'audit-plan',
                engagementId: c.engagementId,
                engagementName: c.engagementName,
                owner,
                items,
              });
              onBuildBatch(batchId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FooterSummary({ stage, ctx, domains, plan }: { stage: Stage; ctx: AuditPlanContext; domains: ProcessCode[]; plan: AuditPlan | null }) {
  if (stage === 'context') {
    const parts = [
      `${ctx.databases.length} source${ctx.databases.length === 1 ? '' : 's'}`,
      `${ctx.documents.length} document${ctx.documents.length === 1 ? '' : 's'}`,
      `${ctx.reports.length} report${ctx.reports.length === 1 ? '' : 's'}`,
      ...(ctx.files.length ? [`${ctx.files.length} file${ctx.files.length === 1 ? '' : 's'}`] : []),
    ];
    return (
      <div className="text-[0.8125rem] text-ink-500 truncate">
        {parts.join(' · ')} <span className="text-ink-300">|</span> <span className="text-ink-900 font-medium">{domains.length === 5 ? 'All domains' : domains.join(', ') || 'No domain picked'}</span>
      </div>
    );
  }
  if (!plan) return <span />;
  const cov = portfolioCoverage(plan.engagements);
  const sel = plan.engagements.filter(e => e.selected);
  return (
    <div className="text-[0.8125rem] text-ink-500 truncate tabular-nums">
      {sel.length} engagement{sel.length === 1 ? '' : 's'} · {sel.reduce((s, e) => s + e.controls.filter(c => c.selected).length, 0)} controls ·{' '}
      coverage <span className="font-mono text-ink-900">{cov.beforePct}% → <span className="text-brand-700 font-semibold">{cov.afterPct}%</span></span>
    </div>
  );
}
