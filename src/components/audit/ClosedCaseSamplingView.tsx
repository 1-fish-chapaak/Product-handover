/**
 * Closed-Case Sampling View
 *
 * Auditor surface for randomly sampling N closed (resolved) exceptions and
 * validating the risk-owner's classification + resolution rationale. The view
 * records a per-case decision (Agree / Disagree / Need info) and produces a
 * concurrence score that becomes part of the audit trail.
 */

import { useMemo, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Shuffle, RefreshCw, Check, X, MoreHorizontal,
  FileCheck, Calendar, ChevronDown, Filter, ClipboardCheck,
  AlertTriangle, CheckCircle2, Clock, UserCheck, FilePlus2,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { ENGAGEMENTS, PROCESS_COLORS } from '../../data/engagements';
import {
  ENGAGEMENT_EXCEPTIONS,
  type EngagementException,
  type Classification,
} from '../../data/engagement-exceptions';
import { PEOPLE } from '../../data/grc-domain';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

type Period = '7d' | '30d' | '90d' | 'custom';
type ClassFilter = 'All' | Classification;
type Decision = 'pending' | 'agree' | 'disagree' | 'info';

interface SampleCase extends EngagementException {
  closedOn: string; // formatted "Apr 25, 2026"
  daysAgo: number;
  rationale: string;
}

interface CaseDecision {
  decision: Decision;
  newClassification?: Classification;
  reason?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CLASSIFICATION_FILTERS: ClassFilter[] = ['All', 'Control Deficiency', 'Process Gap', 'False Positive', 'Other'];
const PRESETS = [5, 10, 25, 50];
const PERIOD_LABEL: Record<Period, string> = {
  '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', custom: 'Custom range',
};
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, custom: 365 };

const CLASS_PILL: Record<Classification, string> = {
  'Control Deficiency': 'bg-risk-50 text-risk-700 border-risk-50',
  'Process Gap':        'bg-mitigated-50 text-mitigated-700 border-mitigated-50',
  'False Positive':     'bg-compliant-50 text-compliant-700 border-compliant-50',
  'Other':              'bg-surface-2 text-text-secondary border-border-light',
};

const SEV_BADGE: Record<EngagementException['severity'], string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-50',
  High:     'bg-high-50 text-high-700 border-high-50',
  Medium:   'bg-mitigated-50 text-mitigated-700 border-mitigated-50',
  Low:      'bg-compliant-50 text-compliant-700 border-compliant-50',
};

const DECISION_BORDER: Record<Decision, string> = {
  pending:  'border-border-light',
  agree:    'border-compliant/40',
  disagree: 'border-risk/40',
  info:     'border-mitigated/40',
};

const RATIONALE: Record<Classification, string> = {
  'False Positive':
    'Vendor confirmed legitimate retry under contract. Sample is part of standard month-end batch.',
  'Control Deficiency':
    'Duplicate detection threshold was too lax; tightened from 0.85 to 0.92 and backtested 90 days.',
  'Process Gap':
    'Operator skipped the SOP-mandated PO threshold approval step. SOP refreshed and operators retrained.',
  'Other':
    'Mixed cause — required management override and is documented under risk acceptance memo.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Demo "today" is May 15, 2026 — fixed so the seed dates render stable. */
function formatClosedDate(daysAgo: number): string {
  const d = new Date(2026, 4, 15); // May 15, 2026
  d.setDate(d.getDate() - daysAgo);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Deterministic shuffle using Fisher-Yates with a Math.random seed. */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickClassification(seed: number): Classification {
  const opts: Classification[] = ['Control Deficiency', 'Process Gap', 'False Positive', 'Other'];
  return opts[seed % opts.length];
}

// ─── Synthetic resolved cases (augment the small seed) ───────────────────────

const SYNTHETIC_RESOLVED: SampleCase[] = (() => {
  const seeds = [
    { id: 'ex-9001', ref: 'EX-9001', engId: 'eng-3', wf: 'wf2', wfName: 'Duplicate Invoice Detector',
      title: 'Duplicate posting flagged — vendor V-1188 (resolved)',
      detail: 'Same vendor / amount / PAN match — investigated.',
      severity: 'Medium' as const, daysAgo: 6,  classIdx: 2, assignee: 'Priya Singh',  amount: '₹62K' },
    { id: 'ex-9002', ref: 'EX-9002', engId: 'eng-6', wf: 'wf4', wfName: 'Vendor Master Change Monitor',
      title: 'Privileged role change reviewed and closed',
      detail: 'Change happened inside the formal window after retroactive ticketing.',
      severity: 'High' as const,   daysAgo: 12, classIdx: 0, assignee: 'Deepak Bansal' },
    { id: 'ex-9003', ref: 'EX-9003', engId: 'eng-9', wf: 'wf1', wfName: 'Three-Way Match (PO · GRN · Invoice)',
      title: 'PO/GRN tolerance mismatch — vendor V-4421',
      detail: 'Mismatch within 2% tolerance, signed off by AP manager.',
      severity: 'Low' as const,    daysAgo: 18, classIdx: 1, assignee: 'Rohan Patel',   amount: '₹14K diff' },
    { id: 'ex-9004', ref: 'EX-9004', engId: 'eng-8', wf: 'wf2', wfName: 'Revenue Recognition Monitor',
      title: 'Cutoff anomaly — order shipped on month-end',
      detail: 'Reviewed against shipping docs; correctly booked in following period.',
      severity: 'Medium' as const, daysAgo: 22, classIdx: 2, assignee: 'Neha Joshi' },
    { id: 'ex-9005', ref: 'EX-9005', engId: 'eng-3', wf: 'wf2', wfName: 'Duplicate Invoice Detector',
      title: 'Near-duplicate invoice — same amount, different PO',
      severity: 'Low' as const,    daysAgo: 28, classIdx: 2, assignee: 'Priya Singh',   amount: '₹38K' },
    { id: 'ex-9006', ref: 'EX-9006', engId: 'eng-6', wf: 'wf3', wfName: 'PO Approval Threshold Scan',
      title: 'Threshold override on emergency PO — justified',
      detail: 'CFO override documented in change log within 24 hours of trigger.',
      severity: 'High' as const,   daysAgo: 33, classIdx: 3, assignee: 'Tushar Goel' },
    { id: 'ex-9007', ref: 'EX-9007', engId: 'eng-9', wf: 'wf1', wfName: 'Three-Way Match (PO · GRN · Invoice)',
      title: 'GRN posted without inspection — caught in batch run',
      severity: 'Critical' as const, daysAgo: 41, classIdx: 1, assignee: 'Rohan Patel', amount: '₹3.1L' },
    { id: 'ex-9008', ref: 'EX-9008', engId: 'eng-1', wf: 'wf2', wfName: 'Duplicate Invoice Detector',
      title: 'Duplicate flagged in SOX testing sample (resolved)',
      severity: 'Medium' as const, daysAgo: 47, classIdx: 0, assignee: 'Sneha Desai' },
    { id: 'ex-9009', ref: 'EX-9009', engId: 'eng-8', wf: 'wf2', wfName: 'Revenue Recognition Monitor',
      title: 'Deferred revenue release timing investigated',
      detail: 'Contract milestone confirmed by sales ops; release was correct.',
      severity: 'Medium' as const, daysAgo: 55, classIdx: 2, assignee: 'Neha Joshi' },
    { id: 'ex-9010', ref: 'EX-9010', engId: 'eng-6', wf: 'wf4', wfName: 'Vendor Master Change Monitor',
      title: 'Bank account change validated via call-back',
      detail: 'Phone-verified the change with vendor controller; closed clean.',
      severity: 'High' as const,   daysAgo: 64, classIdx: 2, assignee: 'Deepak Bansal' },
  ];
  return seeds.map((s) => {
    const cls = pickClassification(s.classIdx);
    return {
      id: s.id, ref: s.ref, engagementId: s.engId, workflowId: s.wf, workflowName: s.wfName,
      title: s.title, detail: s.detail, severity: s.severity, status: 'Resolved' as const,
      opened: `${s.daysAgo + 2}d ago`, assignee: s.assignee, classification: cls, amount: s.amount,
      closedOn: formatClosedDate(s.daysAgo), daysAgo: s.daysAgo, rationale: RATIONALE[cls],
    };
  });
})();

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClosedCaseSamplingView({ onBack }: Props): JSX.Element {
  const { addToast } = useToast();

  // Config state
  const [engagementScope, setEngagementScope] = useState<Set<string>>(new Set()); // empty = all
  const [scopeOpen, setScopeOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');
  const [classFilter, setClassFilter] = useState<ClassFilter>('All');
  const [sampleSize, setSampleSize] = useState(10);

  const { can } = useCan();
  // Sample state
  const [sample, setSample] = useState<SampleCase[]>([]);
  const [decisions, setDecisions] = useState<Record<string, CaseDecision>>({});
  const [disagreeOpen, setDisagreeOpen] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Pool: real resolved + synthetic (with rationale generated by classification)
  const fullPool = useMemo<SampleCase[]>(() => {
    const realResolved = ENGAGEMENT_EXCEPTIONS.filter(e => e.status === 'Resolved').map((e, i) => {
      const cls: Classification = e.classification ?? pickClassification(i);
      const daysAgo = randInt(3, 75);
      return {
        ...e,
        classification: cls,
        closedOn: formatClosedDate(daysAgo),
        daysAgo,
        rationale: RATIONALE[cls],
      };
    });
    return [...realResolved, ...SYNTHETIC_RESOLVED];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtered pool by scope + period + classification
  const availablePool = useMemo(() => {
    return fullPool.filter(c => {
      if (engagementScope.size > 0 && !engagementScope.has(c.engagementId)) return false;
      if (c.daysAgo > PERIOD_DAYS[period]) return false;
      if (classFilter !== 'All' && c.classification !== classFilter) return false;
      return true;
    });
  }, [fullPool, engagementScope, period, classFilter]);

  // ── Engagement lookup (for chips)
  const engById = useMemo(() => {
    const m = new Map<string, typeof ENGAGEMENTS[number]>();
    ENGAGEMENTS.forEach(e => m.set(e.id, e));
    return m;
  }, []);

  // ── Summary counts
  const agreed   = sample.filter(c => decisions[c.id]?.decision === 'agree').length;
  const disagreed= sample.filter(c => decisions[c.id]?.decision === 'disagree').length;
  const needInfo = sample.filter(c => decisions[c.id]?.decision === 'info').length;
  const pending  = sample.length - agreed - disagreed - needInfo;
  const decided  = agreed + disagreed;
  const accuracy = decided === 0 ? 0 : Math.round((agreed / decided) * 100);

  // ── Actions
  function drawSample() {
    if (availablePool.length === 0) {
      addToast({ type: 'warning', message: 'No resolved cases match the current filters.' });
      return;
    }
    const n = Math.min(sampleSize, availablePool.length);
    const next = shuffle(availablePool).slice(0, n);
    setSample(next);
    setDecisions({});
    setDisagreeOpen({});
    addToast({ type: 'success', message: `Drew ${n} random closed case${n === 1 ? '' : 's'} for review.` });
  }

  function recordDecision(caseId: string, decision: Decision, extra?: Partial<CaseDecision>) {
    if (!can('exc_triage')) return; // sampling decisions are a triage action
    setDecisions(prev => ({ ...prev, [caseId]: { decision, ...extra } }));
    if (decision !== 'disagree') {
      setDisagreeOpen(prev => ({ ...prev, [caseId]: false }));
    }
  }

  function toggleScope(id: string) {
    setEngagementScope(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function finalize() {
    setConfirmOpen(false);
    addToast({
      type: 'success',
      message: `Review recorded — ${decided} decisions logged · ${accuracy}% concurrence with risk-owner classification.`,
    });
    // Reset for a fresh round
    setSample([]);
    setDecisions({});
    setDisagreeOpen({});
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-white relative">
      <div className="p-8 max-w-[1280px] mx-auto">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Page header */}
        <div className="mb-6">
          <div className="text-[0.75rem] font-bold tracking-[0.18em] text-primary uppercase mb-1.5">
            Audit Quality
          </div>
          <h1 className="text-[1.75rem] font-bold text-ink-900 tracking-tight leading-tight">
            Closed-Case Sampling
          </h1>
          <p className="text-[0.75rem] text-text-secondary mt-2 max-w-2xl leading-relaxed">
            Sample resolved exceptions to validate risk-owner classifications. Builds the audit-trail for your own review.
          </p>
        </div>

        {/* Configuration bar */}
        <div className="glass-card rounded-2xl p-5 mb-5">
          <div className="flex items-end gap-4 flex-wrap">
            {/* Engagement scope */}
            <div className="relative min-w-[220px]">
              <label className="text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                Engagement scope
              </label>
              <button
                onClick={() => setScopeOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-white text-[0.75rem] text-text hover:border-primary/40 transition-colors cursor-pointer"
              >
                <Filter size={12} className="text-text-muted" />
                <span className="flex-1 text-left truncate">
                  {engagementScope.size === 0 ? 'All engagements' : `${engagementScope.size} selected`}
                </span>
                <span className="text-[0.6875rem] text-text-muted tabular-nums">{availablePool.length} cases</span>
                <ChevronDown size={12} className={`text-text-muted transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {scopeOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute z-20 mt-1 w-[340px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-white shadow-lg p-1.5"
                  >
                    {ENGAGEMENTS.map(e => {
                      const checked = engagementScope.has(e.id);
                      return (
                        <button
                          key={e.id}
                          onClick={() => toggleScope(e.id)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-2/60 transition-colors cursor-pointer text-left"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            checked ? 'bg-primary border-primary text-white' : 'border-border bg-white'
                          }`}>
                            {checked && <Check size={10} strokeWidth={3} />}
                          </span>
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: PROCESS_COLORS[e.process] }}
                          />
                          <span className="text-[0.75rem] text-text flex-1 truncate">{e.name}</span>
                          <span className="font-mono text-[0.75rem] text-text-muted">{e.code}</span>
                        </button>
                      );
                    })}
                    {engagementScope.size > 0 && (
                      <button
                        onClick={() => setEngagementScope(new Set())}
                        className="w-full text-[0.6875rem] font-semibold text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg cursor-pointer mt-1 border-t border-border-light"
                      >
                        Clear selection
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Period */}
            <div className="min-w-[160px]">
              <label className="text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                Period
              </label>
              <div className="relative">
                <Calendar size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-white text-[0.75rem] text-text outline-none hover:border-primary/40 focus:border-primary/40 cursor-pointer appearance-none"
                >
                  {(['7d', '30d', '90d', 'custom'] as Period[]).map(p => (
                    <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sample size + presets */}
            <div className="min-w-[200px]">
              <label className="text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                Sample size
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={availablePool.length || 100}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2.5 py-2 rounded-lg border border-border bg-white text-[0.75rem] text-text outline-none focus:border-primary/40 tabular-nums"
                />
                <div className="flex items-center gap-0.5">
                  {PRESETS.map(n => (
                    <button
                      key={n}
                      onClick={() => setSampleSize(n)}
                      className={`px-2 py-1 rounded-md text-[0.6875rem] font-semibold transition-colors cursor-pointer tabular-nums ${
                        sampleSize === n ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Draw button */}
            <div className="ml-auto">
              <button
                onClick={drawSample}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer shadow-sm"
              >
                <Shuffle size={14} />
                Draw sample
              </button>
            </div>
          </div>

          {/* Classification pill toggle */}
          <div className="mt-4 pt-4 border-t border-border-light flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wide">Classification</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CLASSIFICATION_FILTERS.map(c => (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  className={`px-2.5 py-1 rounded-full text-[0.75rem] font-semibold transition-colors cursor-pointer ${
                    classFilter === c
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <AnimatePresence>
          {sample.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-4 mb-5 flex items-center gap-6 flex-wrap"
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-primary" />
                <span className="text-[0.8125rem] font-semibold text-text">
                  {sample.length} sample{sample.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[0.75rem]">
                <span className="w-2 h-2 rounded-full bg-compliant" />
                <span className="text-text tabular-nums font-medium">{agreed}</span>
                <span className="text-text-muted">agreed</span>
              </div>
              <div className="flex items-center gap-1.5 text-[0.75rem]">
                <span className="w-2 h-2 rounded-full bg-risk" />
                <span className="text-text tabular-nums font-medium">{disagreed}</span>
                <span className="text-text-muted">disagreed</span>
              </div>
              <div className="flex items-center gap-1.5 text-[0.75rem]">
                <span className="w-2 h-2 rounded-full bg-mitigated" />
                <span className="text-text tabular-nums font-medium">{needInfo}</span>
                <span className="text-text-muted">need info</span>
              </div>
              <div className="flex items-center gap-1.5 text-[0.75rem]">
                <span className="w-2 h-2 rounded-full bg-text-muted/40" />
                <span className="text-text tabular-nums font-medium">{pending}</span>
                <span className="text-text-muted">pending</span>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[0.625rem] uppercase tracking-wider text-text-muted font-semibold">Concurrence</div>
                  <div className="text-[1.125rem] font-bold tabular-nums text-text leading-none mt-0.5">
                    {decided === 0 ? '—' : `${accuracy}%`}
                  </div>
                </div>
                <button
                  onClick={() => { setSample([]); setDecisions({}); setDisagreeOpen({}); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] font-semibold text-text-secondary hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
                >
                  <RefreshCw size={11} /> Reset
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards list */}
        {sample.length === 0 ? (
          <EmptyState available={availablePool.length} />
        ) : (
          <div className="space-y-3">
            {sample.map((c, i) => (
              <SampleCard
                key={c.id}
                index={i}
                sampleCase={c}
                engagementName={engById.get(c.engagementId)?.name ?? '—'}
                engagementProcess={engById.get(c.engagementId)?.process ?? 'P2P'}
                decision={decisions[c.id]?.decision ?? 'pending'}
                disagreeOpen={!!disagreeOpen[c.id]}
                onRecord={(d, extra) => recordDecision(c.id, d, extra)}
                onToggleDisagree={(open) => setDisagreeOpen(prev => ({ ...prev, [c.id]: open }))}
              />
            ))}

            {/* Finalize CTA */}
            <div className="pt-4 flex items-center justify-end">
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={decided === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <FileCheck size={14} /> Finalize review
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirmOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0 bg-ink-900/40 backdrop-blur-[3px]"
              onClick={() => setConfirmOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="relative bg-paper-0 rounded-2xl shadow-xl border border-paper-200 w-full max-w-md p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-brand-50 text-brand-700">
                  <FileCheck size={18} />
                </div>
                <div>
                  <h3 className="text-[0.9375rem] font-bold text-text mb-1">Finalize closed-case review</h3>
                  <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                    You're recording your review of <span className="font-semibold text-text">{sample.length} sample{sample.length === 1 ? '' : 's'}</span>
                    {' '}(<span className="text-compliant-700 font-semibold">{agreed} agreed</span>,{' '}
                    <span className="text-risk-700 font-semibold">{disagreed} disagreed</span>). The auditor record will reflect{' '}
                    <span className="font-bold text-text">{accuracy}% concurrence</span> with the risk-owner classification.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-border bg-white text-[0.75rem] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={finalize}
                  className="px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
                >
                  Record review
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ available }: { available: number }): JSX.Element {
  return (
    <div className="border border-dashed border-border rounded-2xl py-16 px-6 text-center bg-canvas/60">
      <div className="w-14 h-14 rounded-2xl bg-primary/[0.08] text-primary inline-flex items-center justify-center mb-3">
        <Shuffle size={22} />
      </div>
      <h3 className="text-[0.9375rem] font-semibold text-text mb-1.5">Draw a sample to begin</h3>
      <p className="text-[0.75rem] text-text-muted max-w-md mx-auto leading-relaxed">
        Configure your scope, period, and sample size above, then draw a random sample
        from the <span className="font-semibold text-text tabular-nums">{available}</span> resolved
        case{available === 1 ? '' : 's'} matching your filters.
      </p>
    </div>
  );
}

// ─── Sample Card ─────────────────────────────────────────────────────────────

interface SampleCardProps {
  index: number;
  sampleCase: SampleCase;
  engagementName: string;
  engagementProcess: keyof typeof PROCESS_COLORS;
  decision: Decision;
  disagreeOpen: boolean;
  onRecord: (d: Decision, extra?: Partial<CaseDecision>) => void;
  onToggleDisagree: (open: boolean) => void;
}

function SampleCard({
  index, sampleCase: c, engagementName, engagementProcess, decision, disagreeOpen, onRecord, onToggleDisagree,
}: SampleCardProps): JSX.Element {
  const [newClass, setNewClass] = useState<Classification>(c.classification ?? 'Control Deficiency');
  const [reason, setReason] = useState('');
  const cls = c.classification ?? 'Other';
  const processColor = PROCESS_COLORS[engagementProcess];
  const owner = PEOPLE.find(p => p.name === c.assignee);

  // Mini timeline events (Created → Assigned → Classified → Closed)
  const trail = [
    { id: 'created',   label: 'Created',    icon: FilePlus2,   tone: 'bg-evidence-50 text-evidence-700',     sub: `${c.daysAgo + 3}d ago` },
    { id: 'assigned',  label: 'Assigned',   icon: UserCheck,   tone: 'bg-brand-50 text-brand-700',           sub: c.assignee },
    { id: 'classified',label: 'Classified', icon: Filter,      tone: 'bg-mitigated-50 text-mitigated-700',   sub: cls },
    { id: 'closed',    label: 'Closed',     icon: CheckCircle2,tone: 'bg-compliant-50 text-compliant-700',   sub: c.closedOn },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.03 }}
      className={`rounded-2xl border bg-white p-5 transition-colors ${DECISION_BORDER[decision]}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="font-mono text-[0.75rem] tracking-tight text-ink-500">{c.ref}</span>
        <span
          className="inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[0.75rem] font-semibold border"
          style={{
            background: `${processColor}14`,
            borderColor: `${processColor}33`,
            color: processColor,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: processColor }} />
          {engagementName}
        </span>
        <span className={`inline-flex items-center px-2 h-5 rounded-full text-[0.75rem] font-semibold border ${CLASS_PILL[cls]}`}>
          {cls}
        </span>
        <span className={`inline-flex items-center px-2 h-5 rounded-full text-[0.75rem] font-bold uppercase border ${SEV_BADGE[c.severity]}`}>
          {c.severity}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] text-text-muted">
          <Clock size={11} /> Closed {c.closedOn}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[0.75rem] font-bold text-text leading-snug mb-3">{c.title}</h3>

      {/* Rationale */}
      <div className="rounded-xl border border-border-light bg-canvas px-4 py-3 mb-4">
        <div className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted mb-1">Resolution rationale</div>
        <p className="text-[0.8125rem] text-text leading-relaxed">
          {c.rationale}
          {c.detail && <span className="text-text-muted"> {c.detail}</span>}
        </p>
      </div>

      {/* Mini ATR strip */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {trail.map((ev, idx) => (
            <div key={ev.id} className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ev.tone}`}>
                  <ev.icon size={12} />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.6875rem] font-semibold text-text leading-tight">{ev.label}</div>
                  <div className="text-[0.75rem] text-text-muted truncate">{ev.sub}</div>
                </div>
              </div>
              {idx < trail.length - 1 && (
                <div className="flex-1 h-px bg-border-light min-w-[12px]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decision buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <DecisionButton
          active={decision === 'agree'}
          activeCls="bg-compliant-50 border-compliant/40 text-compliant-700"
          icon={Check}
          label="Agree"
          onClick={() => onRecord('agree')}
        />
        <DecisionButton
          active={decision === 'disagree'}
          activeCls="bg-risk-50 border-risk/40 text-risk-700"
          icon={X}
          label="Disagree"
          onClick={() => { onRecord('disagree', { newClassification: newClass, reason }); onToggleDisagree(true); }}
        />
        <DecisionButton
          active={decision === 'info'}
          activeCls="bg-mitigated-50 border-mitigated/40 text-mitigated-700"
          icon={MoreHorizontal}
          label="Need more info"
          onClick={() => onRecord('info')}
        />
        {decision !== 'pending' && (
          <span className="ml-auto text-[0.6875rem] text-text-muted">
            {owner ? `Owner: ${owner.name}` : c.assignee}
          </span>
        )}
      </div>

      {/* Disagree inline form */}
      <AnimatePresence>
        {decision === 'disagree' && disagreeOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                  Reclassify as
                </label>
                <select
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value as Classification)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-[0.75rem] text-text outline-none focus:border-primary/40 cursor-pointer"
                >
                  {(['Control Deficiency', 'Process Gap', 'False Positive', 'Other'] as Classification[]).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.6875rem] font-semibold text-text-muted uppercase tracking-wide block mb-1.5">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why does this case need a different classification?"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-white text-[0.75rem] text-text outline-none focus:border-primary/40 resize-none placeholder:text-text-muted/70"
                />
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => onToggleDisagree(false)}
                  className="px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Collapse
                </button>
                <button
                  onClick={() => { onRecord('disagree', { newClassification: newClass, reason }); onToggleDisagree(false); }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-risk text-white text-[0.75rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer"
                >
                  <AlertTriangle size={11} /> Submit disagreement
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Decision Button ─────────────────────────────────────────────────────────

interface DecisionButtonProps {
  active: boolean;
  activeCls: string;
  icon: typeof Check;
  label: string;
  onClick: () => void;
}

function DecisionButton({ active, activeCls, icon: Icon, label, onClick }: DecisionButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.75rem] font-semibold transition-colors cursor-pointer ${
        active ? activeCls : 'border-border bg-white text-text-secondary hover:border-primary/30 hover:bg-surface-2'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
