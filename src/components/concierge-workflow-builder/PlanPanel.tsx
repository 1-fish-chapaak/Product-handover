import { useRef, useState } from 'react';
import {
  ListChecks,
  Table2,
  FileOutput,
  Check,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  BookOpenText,
  Lightbulb,
  Plus,
  X,
  PanelRightClose,
  Send,
  Sparkles,
  Mail,
  MessageSquare,
  Database,
  Globe,
  FileSpreadsheet,
  Percent,
  CalendarDays,
  SlidersHorizontal,
} from 'lucide-react';
import type { WorkflowDraft, InputNote } from './types';
import ToleranceSection from './ToleranceSection';

type Tab = 'plan' | 'input' | 'output';

interface MappedRisk {
  id: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Mapped' | 'Gap';
  title: string;
  process: string;
  evidence: string;
  controlsCount: number;
}

const SEVERITY_COLORS: Record<MappedRisk['severity'], string> = {
  Critical: 'text-risk bg-risk-50',
  High: 'text-high bg-high-50',
  Medium: 'text-mitigated bg-mitigated-50',
  Low: 'text-compliant bg-compliant-50',
};

const MAPPED_RISKS: MappedRisk[] = [
  {
    id: 'R-AP-001',
    severity: 'High',
    status: 'Mapped',
    title: 'Duplicate invoice payments resulting in financial leakage',
    process: 'Accounts Payable',
    evidence: 'E O',
    controlsCount: 2,
  },
  {
    id: 'R-AP-002',
    severity: 'Critical',
    status: 'Mapped',
    title: 'Payments to unapproved or fictitious vendors',
    process: 'Accounts Payable',
    evidence: 'E',
    controlsCount: 3,
  },
  {
    id: 'R-AP-003',
    severity: 'Medium',
    status: 'Mapped',
    title: 'GL coding deviation from policy matrix',
    process: 'General Ledger',
    evidence: 'O',
    controlsCount: 1,
  },
  {
    id: 'R-AP-004',
    severity: 'Medium',
    status: 'Gap',
    title: 'Segregation-of-duties breach on invoice posting',
    process: 'Accounts Payable',
    evidence: '—',
    controlsCount: 0,
  },
];

export interface ExecutorParameters {
  threshold: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  workflow: WorkflowDraft | null;
  step?: number;
  open: boolean;
  onToggleOpen: () => void;
  activeTab?: Tab;
  onTabChange?: (t: Tab) => void;
  parameters?: ExecutorParameters;
  onParametersChange?: (next: ExecutorParameters) => void;
  visibleTabs?: Tab[];
}

const TABS: { key: Tab; label: string; icon: typeof ListChecks }[] = [
  { key: 'plan', label: 'Plan', icon: ListChecks },
  { key: 'input', label: 'Input Config', icon: Table2 },
  { key: 'output', label: 'Output Config', icon: FileOutput },
];

export default function PlanPanel({
  workflow,
  step,
  open,
  onToggleOpen,
  activeTab,
  onTabChange,
  parameters,
  onParametersChange,
  visibleTabs,
}: Props) {
  const shownTabs = visibleTabs
    ? TABS.filter((t) => visibleTabs.includes(t.key))
    : TABS;
  const [internalTab, setInternalTab] = useState<Tab>(step === 3 ? 'input' : 'plan');
  const requestedTab = activeTab ?? internalTab;
  const tab: Tab = shownTabs.some((t) => t.key === requestedTab)
    ? requestedTab
    : (shownTabs[0]?.key ?? 'plan');
  const setTab = (t: Tab) => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  // Switch to input config tab when entering step 3
  const prevStepRef = useRef(step);
  if (step !== prevStepRef.current) {
    prevStepRef.current = step;
    if (step === 3) {
      setTab('input');
    }
  }

  if (!open) {
    return (
      <aside className="flex flex-col h-full bg-canvas-elevated border-l border-canvas-border min-h-0 w-12 shrink-0">
        <div className="flex flex-col items-center pt-3 gap-1">
          {shownTabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                title={t.label}
                onClick={() => {
                  setTab(t.key);
                  onToggleOpen();
                }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-ink-400 hover:bg-canvas hover:text-ink-700'
                }`}
              >
                <t.icon size={15} />
              </button>
            );
          })}
          <div className="w-6 h-px bg-canvas-border my-2" />
          <button
            type="button"
            title="Expand panel"
            onClick={onToggleOpen}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-400 hover:bg-canvas hover:text-ink-700 transition-colors cursor-pointer"
          >
            <PanelRightClose size={15} className="rotate-180" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col h-full bg-canvas-elevated border-l border-canvas-border min-h-0">
      {/* Tabs */}
      <div className="h-14 border-b border-canvas-border flex items-end px-2 shrink-0">
        {shownTabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                'inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 pb-2.5 -mb-px border-b-2 transition-colors cursor-pointer',
                active
                  ? 'text-brand-700 border-brand-600'
                  : 'text-ink-400 border-transparent hover:text-ink-600',
              ].join(' ')}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          title="Collapse panel"
          onClick={onToggleOpen}
          className="ml-auto mb-2 w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-canvas hover:text-ink-700 transition-colors cursor-pointer"
        >
          <PanelRightClose size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3 bg-canvas">
        {tab === 'plan' && (
          <>
            <PlanSection workflow={workflow} />
            <RACMSection />
          </>
        )}
        {tab === 'input' && (
          <InputConfigSection
            workflow={workflow}
            parameters={parameters}
            onParametersChange={onParametersChange}
          />
        )}
        {tab === 'output' && <OutputConfigSection workflow={workflow} />}
      </div>
    </aside>
  );
}

function PlanSection({ workflow }: { workflow: WorkflowDraft | null }) {
  if (!workflow) {
    return (
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
        <p className="text-[12px] text-ink-400">
          The execution plan appears once you generate a workflow.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
      <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400 mb-3">
        Query Execution Plan
      </div>
      <ol className="space-y-3">
        {workflow.steps.map((s, idx) => (
          <li key={s.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[12px] font-bold">
                {idx + 1}
              </div>
              {idx < workflow.steps.length - 1 && (
                <div className="w-px flex-1 min-h-[16px] bg-canvas-border mt-1" />
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="text-[12px] font-semibold text-ink-800 truncate">{s.name}</div>
              <div className="text-[12px] text-ink-400 leading-relaxed">{s.description}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-lg border border-compliant/40 bg-compliant-50 p-2.5 flex items-start gap-2">
        <div className="w-5 h-5 rounded-full bg-compliant text-white flex items-center justify-center shrink-0 mt-0.5">
          <Check size={11} />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-bold uppercase tracking-wider text-compliant-700">
            {workflow.output.type === 'flags'
              ? 'Flags Output'
              : workflow.output.type === 'table'
                ? 'Table Output'
                : 'Summary Output'}
          </div>
          <div className="text-[12px] font-semibold text-ink-800 leading-tight">
            {workflow.output.title}
          </div>
        </div>
      </div>
    </div>
  );
}

function RACMSection() {
  const mapped = MAPPED_RISKS.filter((r) => r.status === 'Mapped').length;
  const total = MAPPED_RISKS.length;
  const coverage = Math.round((mapped / total) * 100);
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
          <ShieldCheck size={14} className="text-brand-600" />
        </div>
        <div>
          <div className="text-[12px] font-semibold text-ink-800 leading-tight">
            Risk &amp; Control Matrix
          </div>
          <div className="text-[12px] text-ink-400">
            {MAPPED_RISKS.length} risks · {MAPPED_RISKS.reduce((n, r) => n + r.controlsCount, 0)}{' '}
            controls
          </div>
        </div>
      </div>

      <div className="mt-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-bold uppercase tracking-wider text-ink-400">
            Control Coverage
          </span>
          <span className="text-[12px] font-semibold text-ink-600">
            {mapped}/{total}
            {total - mapped > 0 && (
              <span className="ml-1 text-mitigated-700">
                {total - mapped} gap{total - mapped === 1 ? '' : 's'}
              </span>
            )}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-canvas-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-compliant rounded-full"
            style={{ width: `${coverage}%` }}
          />
        </div>
      </div>

      <div className="text-[12px] font-bold uppercase tracking-wider text-ink-400 mb-2">
        Mapped Risks
      </div>
      <ul className="space-y-2">
        {MAPPED_RISKS.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-canvas-border bg-canvas p-2.5 hover:border-brand-300 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <ChevronRight size={11} className="text-ink-400 shrink-0" />
              <span className="text-[12px] font-semibold text-ink-800">{r.id}</span>
              <span
                className={`text-[12px] uppercase tracking-wider font-bold rounded-full px-1.5 py-0.5 ${SEVERITY_COLORS[r.severity]}`}
              >
                {r.severity}
              </span>
              <span
                className={[
                  'text-[12px] uppercase tracking-wider font-bold rounded-full px-1.5 py-0.5',
                  r.status === 'Mapped'
                    ? 'text-evidence bg-evidence-50'
                    : 'text-mitigated bg-mitigated-50',
                ].join(' ')}
              >
                {r.status}
              </span>
            </div>
            <div className="text-[12px] text-ink-700 leading-snug mb-1">{r.title}</div>
            <div className="flex items-center gap-2 text-[12px] text-ink-400">
              <span>{r.process}</span>
              <span>·</span>
              <span className="font-mono">{r.evidence}</span>
              <span>·</span>
              <span>{r.controlsCount} controls</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DEFAULT_NOTES: InputNote[] = [
  {
    id: 'n1',
    name: 'Rate Card Reference',
    description: 'Standard rate card with approved vendor pricing tiers',
    aiSuggested: true,
    enabled: true,
  },
  {
    id: 'n2',
    name: 'Audit Policy Guide',
    description: 'Internal audit thresholds and escalation criteria',
    aiSuggested: true,
    enabled: false,
  },
];

const DEFAULT_AI_SUGGESTIONS = [
  'Historical benchmark data for trend comparison',
  'Approval matrix for authority validation',
];

let _noteIdCounter = 1000;
function nextNoteId(): string {
  return `n-${++_noteIdCounter}`;
}

function InputConfigSection({
  workflow,
  parameters,
  onParametersChange,
}: {
  workflow: WorkflowDraft | null;
  parameters?: ExecutorParameters;
  onParametersChange?: (next: ExecutorParameters) => void;
}) {
  const [notes, setNotes] = useState<InputNote[]>(DEFAULT_NOTES);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_AI_SUGGESTIONS);
  const [addingNote, setAddingNote] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const updateParam = <K extends keyof ExecutorParameters>(key: K, value: ExecutorParameters[K]) => {
    if (!parameters || !onParametersChange) return;
    onParametersChange({ ...parameters, [key]: value });
  };

  const toggleNote = (id: string) =>
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n)));

  const acceptSuggestion = (idx: number) => {
    const text = suggestions[idx];
    const id = nextNoteId();
    setNotes((prev) => [
      ...prev,
      { id, name: text, description: 'AI-suggested reference note', aiSuggested: true, enabled: true },
    ]);
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addNote = () => {
    if (!newName.trim()) return;
    const id = nextNoteId();
    setNotes((prev) => [
      ...prev,
      {
        id,
        name: newName.trim(),
        description: newDesc.trim() || 'User note',
        aiSuggested: false,
        enabled: true,
      },
    ]);
    setNewName('');
    setNewDesc('');
    setAddingNote(false);
  };

  return (
    <div className="space-y-3">
      {parameters && onParametersChange && (
        <div className="rounded-xl border border-canvas-border bg-canvas-elevated">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-canvas-border">
            <SlidersHorizontal size={13} className="text-ink-400" />
            <span className="text-[12px] font-semibold text-ink-700 flex-1">Parameters</span>
            <span className="text-[12px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-1.5 py-0.5">
              LIVE
            </span>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-ink-600 flex items-center gap-1.5 mb-1">
                <Percent size={11} className="text-brand-600" />
                Match Threshold
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={parameters.threshold}
                  onChange={(e) => updateParam('threshold', e.target.value)}
                  className="w-full rounded-lg border border-canvas-border bg-canvas-elevated pl-2.5 pr-7 py-1.5 text-[12px] font-mono text-ink-800 focus:outline-none focus:border-brand-400 transition-colors"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">%</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-ink-600 flex items-center gap-1.5 mb-1">
                <CalendarDays size={11} className="text-brand-600" />
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={parameters.dateFrom}
                  onChange={(e) => updateParam('dateFrom', e.target.value)}
                  className="rounded-lg border border-canvas-border bg-canvas-elevated px-2 py-1.5 text-[12px] font-mono text-ink-800 focus:outline-none focus:border-brand-400 transition-colors"
                />
                <input
                  type="date"
                  value={parameters.dateTo}
                  onChange={(e) => updateParam('dateTo', e.target.value)}
                  className="rounded-lg border border-canvas-border bg-canvas-elevated px-2 py-1.5 text-[12px] font-mono text-ink-800 focus:outline-none focus:border-brand-400 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <ToleranceSection />

      {/* Notes */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-canvas-border">
          <BookOpenText size={13} className="text-ink-400" />
          <span className="text-[12px] font-semibold text-ink-700 flex-1">Notes</span>
          <span className="text-[12px] font-semibold text-ink-400">
            {notes.length} ref{notes.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-2 space-y-2">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-2.5 transition-colors ${
                n.enabled
                  ? 'border-brand-200 bg-brand-50/20'
                  : 'border-canvas-border bg-canvas'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                    n.enabled
                      ? 'bg-brand-50 border-brand-200 text-brand-600'
                      : 'bg-white border-canvas-border text-ink-400'
                  }`}
                >
                  <BookOpenText size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-ink-800 truncate">
                      {n.name}
                    </span>
                    {n.aiSuggested && (
                      <span className="text-[12px] font-bold leading-none bg-brand-50 text-brand-700 border border-brand-200 rounded px-1 py-0.5">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink-400 mt-0.5 leading-relaxed">
                    {n.description}
                  </p>
                </div>
                <Toggle enabled={n.enabled} onToggle={() => toggleNote(n.id)} />
              </div>
            </div>
          ))}

          {suggestions.length > 0 && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={11} className="text-brand-600" />
                <span className="text-[12px] font-bold text-brand-700 uppercase tracking-wider">
                  AI Suggestions
                </span>
              </div>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => acceptSuggestion(i)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/70 border border-brand-100 hover:bg-white hover:border-brand-300 transition-colors cursor-pointer group"
                  >
                    <Plus size={11} className="text-brand-400 group-hover:text-brand-700" />
                    <span className="text-[12px] text-brand-700 text-left flex-1">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {addingNote ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50/20 p-2.5 space-y-1.5">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Note title"
                autoFocus
                className="w-full rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1.5 text-[12px] font-semibold text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-400 transition-colors"
              />
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short description (optional)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addNote();
                  if (e.key === 'Escape') {
                    setAddingNote(false);
                    setNewName('');
                    setNewDesc('');
                  }
                }}
                className="w-full rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1.5 text-[12px] text-ink-600 placeholder:text-ink-400 focus:outline-none focus:border-brand-400 transition-colors"
              />
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!newName.trim()}
                  className={`inline-flex items-center gap-1 rounded-md text-[12px] font-semibold px-2 py-1 transition-colors ${
                    newName.trim()
                      ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
                      : 'bg-brand-100 text-brand-300 cursor-not-allowed'
                  }`}
                >
                  <Check size={10} />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingNote(false);
                    setNewName('');
                    setNewDesc('');
                  }}
                  className="inline-flex items-center gap-1 rounded-md text-[12px] font-semibold px-2 py-1 text-ink-500 hover:bg-canvas transition-colors cursor-pointer"
                >
                  <X size={10} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingNote(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-canvas-border bg-canvas hover:border-brand-300 hover:text-brand-700 text-ink-400 text-[12px] font-semibold px-3 py-2 transition-colors cursor-pointer"
            >
              <Plus size={12} />
              Add Note
            </button>
          )}
        </div>
      </div>

      {/* Context: which workflow */}
      {workflow && (
        <div className="text-center text-[12px] uppercase tracking-wider text-ink-400 font-semibold">
          For {workflow.name}
        </div>
      )}
    </div>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'relative w-8 h-[18px] rounded-full transition-colors shrink-0 cursor-pointer',
        enabled ? 'bg-brand-600' : 'bg-canvas-border',
      ].join(' ')}
      aria-pressed={enabled}
    >
      <span
        className={[
          'absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-[16px]' : 'translate-x-[2px]',
        ].join(' ')}
      />
    </button>
  );
}

type OutputLayout = 'table' | 'dashboard' | 'summary';
type KpiKey = 'total' | 'duplicates' | 'amount' | 'comparison' | 'trend';
type ChannelKey = 'email' | 'slack' | 'erp' | 'webhook' | 'csv';

interface DeliveryChannel {
  enabled: boolean;
  to: string;
  frequency: 'every' | 'critical' | 'daily';
}

const KPI_ITEMS: { key: KpiKey; label: string; badge?: string }[] = [
  { key: 'total', label: 'Total Records Scanned' },
  { key: 'duplicates', label: 'Duplicates Found' },
  { key: 'amount', label: 'Amount at Risk' },
  { key: 'comparison', label: 'Comparison vs Last Run', badge: 'DELTA' },
  { key: 'trend', label: 'Duplicate Trend (30 days)' },
];

const CHANNEL_META: Record<
  ChannelKey,
  { label: string; icon: typeof Mail; placeholder: string }
> = {
  email: { label: 'Email digest', icon: Mail, placeholder: 'finance-team@company.com' },
  slack: { label: 'Slack channel', icon: MessageSquare, placeholder: '#ap-alerts' },
  erp: { label: 'ERP push', icon: Database, placeholder: 'SAP endpoint URL' },
  webhook: { label: 'Webhook', icon: Globe, placeholder: 'https://hooks.example.com/...' },
  csv: { label: 'Auto-export CSV', icon: FileSpreadsheet, placeholder: '/shared/exports/' },
};

function OutputConfigSection({ workflow }: { workflow: WorkflowDraft | null }) {
  const [kpiChecks, setKpiChecks] = useState<Record<KpiKey, boolean>>({
    total: true,
    duplicates: true,
    amount: true,
    comparison: false,
    trend: false,
  });
  const [outputLayout, setOutputLayout] = useState<OutputLayout>('dashboard');
  const [channels, setChannels] = useState<Record<ChannelKey, DeliveryChannel>>({
    email: { enabled: true, to: '', frequency: 'critical' },
    slack: { enabled: true, to: '', frequency: 'every' },
    erp: { enabled: false, to: '', frequency: 'every' },
    webhook: { enabled: false, to: '', frequency: 'every' },
    csv: { enabled: false, to: '', frequency: 'every' },
  });
  const [expandedChannel, setExpandedChannel] = useState<ChannelKey | null>('email');

  return (
    <div className="space-y-3">
      {/* Dashboard KPIs */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
        <div className="text-[13px] font-semibold text-ink-800 mb-3">Dashboard KPIs</div>
        <div className="space-y-2.5">
          {KPI_ITEMS.map(({ key, label, badge }) => {
            const checked = kpiChecks[key];
            return (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <button
                  type="button"
                  onClick={() => setKpiChecks((p) => ({ ...p, [key]: !p[key] }))}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    checked
                      ? 'bg-brand-600 border-brand-600'
                      : 'border-canvas-border bg-canvas-elevated group-hover:border-brand-400'
                  }`}
                  aria-pressed={checked}
                >
                  {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                </button>
                <span
                  className={`text-[13px] flex-1 ${checked ? 'text-ink-700 font-semibold' : 'text-ink-400'}`}
                >
                  {label}
                </span>
                {badge && (
                  <span className="text-[12px] font-bold px-1.5 py-0.5 rounded bg-mitigated-50 text-mitigated-700 border border-mitigated/30">
                    {badge}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Output Layout */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
        <div className="text-[13px] font-semibold text-ink-800 mb-3">Output Layout</div>
        <div className="flex gap-2">
          {(
            [
              { key: 'table', label: 'Table' },
              { key: 'dashboard', label: 'Dashboard' },
              { key: 'summary', label: 'Summary' },
            ] as const
          ).map(({ key, label }) => {
            const selected = outputLayout === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOutputLayout(key)}
                className={`flex-1 inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl border text-[12px] font-semibold transition-all cursor-pointer ${
                  selected
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-canvas-border bg-canvas text-ink-400 hover:border-brand-200 hover:text-brand-500 hover:bg-brand-50/40'
                }`}
              >
                {selected && <CheckCircle2 size={12} className="text-brand-600 shrink-0" />}
                {label}
              </button>
            );
          })}
        </div>

        {/* Preview */}
        <div className="mt-3 rounded-lg border border-canvas-border bg-canvas overflow-hidden">
          <OutputLayoutPreview layout={outputLayout} />
        </div>
      </div>

      {/* Delivery & Routing */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <Send size={13} className="text-ink-400" />
          <span className="text-[13px] font-semibold text-ink-800">Delivery & Routing</span>
          <span className="ml-auto text-[12px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 uppercase tracking-wide">
            New
          </span>
        </div>

        {/* AI tip banner */}
        <div className="flex items-start gap-2 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2.5 mb-3.5">
          <Sparkles size={13} className="text-brand-600 shrink-0 mt-0.5" />
          <p className="text-[12px] text-brand-700 leading-relaxed">
            Most AP teams route critical findings to Slack and email a summary to leadership.
            Configure once, auto-deliver on every run.
          </p>
        </div>

        <p className="text-[12px] font-bold text-ink-400 uppercase tracking-wider mb-2">
          After execution, send results to:
        </p>

        {/* Channel pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(CHANNEL_META) as ChannelKey[]).map((key) => {
            const meta = CHANNEL_META[key];
            const active = channels[key].enabled;
            const Icon = meta.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setChannels((p) => ({
                    ...p,
                    [key]: { ...p[key], enabled: !p[key].enabled },
                  }))
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer ${
                  active
                    ? 'bg-brand-50 text-brand-700 border-brand-300'
                    : 'bg-canvas-elevated text-ink-400 border-canvas-border hover:border-ink-300'
                }`}
              >
                <Icon size={12} />
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Expanded channel config */}
        {(Object.entries(channels) as [ChannelKey, DeliveryChannel][])
          .filter(([, v]) => v.enabled)
          .map(([key, ch]) => {
            const meta = CHANNEL_META[key];
            const isExpanded = expandedChannel === key;
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className="border border-canvas-border rounded-lg mb-2 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedChannel(isExpanded ? null : key)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-canvas transition-colors cursor-pointer"
                >
                  <Icon size={13} className="text-ink-500" />
                  <span className="text-[12px] font-semibold text-ink-700">{meta.label}</span>
                  <ChevronDown
                    size={13}
                    className={`text-ink-400 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-canvas-border pt-2.5">
                    <div>
                      <label className="text-[12px] font-bold text-ink-400 uppercase tracking-wider">
                        To:
                      </label>
                      <input
                        type="text"
                        value={ch.to}
                        onChange={(e) =>
                          setChannels((p) => ({
                            ...p,
                            [key]: { ...p[key], to: e.target.value },
                          }))
                        }
                        placeholder={meta.placeholder}
                        className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-canvas-border rounded-md bg-canvas-elevated text-ink-700 placeholder:text-ink-300 focus:outline-none focus:border-brand-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-bold text-ink-400 uppercase tracking-wider">
                        Send:
                      </label>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {(
                          [
                            { value: 'every', label: 'Every run' },
                            { value: 'critical', label: 'Only if critical' },
                            { value: 'daily', label: 'Daily digest' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setChannels((p) => ({
                                ...p,
                                [key]: { ...p[key], frequency: opt.value },
                              }))
                            }
                            className={`px-2.5 py-1 text-[12px] rounded-md border transition-all cursor-pointer ${
                              ch.frequency === opt.value
                                ? 'bg-brand-50 text-brand-700 border-brand-300 font-semibold'
                                : 'bg-canvas-elevated text-ink-400 border-canvas-border hover:border-ink-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {workflow && (
        <div className="text-center text-[12px] uppercase tracking-wider text-ink-400 font-semibold">
          For {workflow.name}
        </div>
      )}
    </div>
  );
}

function OutputLayoutPreview({ layout }: { layout: OutputLayout }) {
  if (layout === 'dashboard') {
    return (
      <div className="p-3">
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {['#C7E9DA', '#F7D7DB', '#C7E9DA', '#D9D4F5'].map((c, i) => (
            <div key={i} className="rounded-md bg-canvas-elevated border border-canvas-border p-1.5">
              <div className="h-0.5 w-[70%] rounded-full bg-ink-200 mb-1" />
              <div className="h-1.5 rounded-full" style={{ background: c }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-md bg-canvas-elevated border border-canvas-border p-2 h-16 flex items-end">
            <svg viewBox="0 0 100 40" className="w-full h-10" preserveAspectRatio="none">
              <path d="M0 32 L20 24 L40 28 L60 16 L80 12 L100 6" stroke="#6A12CD" strokeWidth="2" fill="none" />
              <path d="M0 36 L20 30 L40 32 L60 22 L80 20 L100 14" stroke="#C4B5FD" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <div className="rounded-md bg-canvas-elevated border border-canvas-border p-2 h-7 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-[3px] border-brand-600" />
            </div>
            <div className="rounded-md bg-canvas-elevated border border-canvas-border p-2 h-7 flex flex-col gap-1 justify-center">
              <div className="h-1 rounded-full bg-brand-200 w-[70%]" />
              <div className="h-1 rounded-full bg-brand-100 w-[50%]" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (layout === 'table') {
    return (
      <div className="p-3">
        <div className="rounded-md border border-canvas-border bg-canvas-elevated overflow-hidden">
          <div className="grid grid-cols-4 gap-2 px-2 py-1.5 bg-canvas border-b border-canvas-border">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-1.5 rounded-full bg-ink-300/60" />
            ))}
          </div>
          {[...Array(4)].map((_, r) => (
            <div
              key={r}
              className="grid grid-cols-4 gap-2 px-2 py-1.5 border-b border-canvas-border last:border-b-0"
            >
              {[...Array(4)].map((_, c) => (
                <div key={c} className="h-1 rounded-full bg-ink-200/80" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  // summary
  return (
    <div className="p-3 space-y-2">
      <div className="h-1.5 rounded-full bg-ink-300/70 w-[40%]" />
      <div className="space-y-1">
        <div className="h-1 rounded-full bg-ink-200/80 w-full" />
        <div className="h-1 rounded-full bg-ink-200/80 w-[90%]" />
        <div className="h-1 rounded-full bg-ink-200/80 w-[75%]" />
      </div>
      <div className="h-1.5 rounded-full bg-ink-300/70 w-[35%] mt-2" />
      <div className="space-y-1">
        <div className="h-1 rounded-full bg-ink-200/80 w-full" />
        <div className="h-1 rounded-full bg-ink-200/80 w-[80%]" />
      </div>
    </div>
  );
}
