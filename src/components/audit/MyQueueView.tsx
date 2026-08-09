/**
 * MyQueueView — personal cross-engagement queue for the Risk Owner persona.
 * Shows every open exception assigned to CURRENT_USER, sorted by SLA urgency,
 * with inline triage actions and a "delegate while you're away" affordance.
 */
import DatePicker from '../shared/DatePicker';
import { useMemo, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, Clock, Activity, CheckCircle2, Sparkles,
  ChevronDown, Filter, UserPlus, Zap, ArrowRight,
  CalendarRange, Tag, BellOff, Wand2, Check, X,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import Gated from '../shared/Gated';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { ENGAGEMENTS, PROCESS_COLORS } from '../../data/engagements';
import {
  ENGAGEMENT_EXCEPTIONS,
  type EngagementException,
  type Severity,
} from '../../data/engagement-exceptions';
import { CURRENT_USER, PEOPLE, myQueueFor, personForUser, slaStatus } from '../../data/grc-domain';
import {
  KIND_META, SCOPE_META, RENEWAL_TARGET, MEMORY_STORE,
  type PlatformMemory,
} from '../../data/memoryStore';
import {
  useMemorySessionVersion, allMemories, decisionFor,
  approveMemory, rejectMemory, undoQueueDecision, renewMemory, forgetMemory,
} from '../../data/memorySession';
import { Brain, Undo2, CalendarClock } from 'lucide-react';

interface Props {
  onOpenException: (engagementId: string, exceptionId: string) => void;
}

type ExStatus = EngagementException['status']; type SlaTone = 'risk' | 'mitigated' | 'compliant';

/** Parse a human "X ago" string ('15m ago', '4h ago', '5d ago') into hours. */
function openedToHours(opened: string): number {
  const m = opened.trim().match(/^(\d+)\s*([mhd])/i);
  if (!m) return 24;
  const n = Number(m[1]);
  return m[2].toLowerCase() === 'm' ? n / 60 : m[2].toLowerCase() === 'h' ? n : n * 24;
}

const SEV_CHIP: Record<Severity, string> = {
  Critical: 'bg-risk-50 text-risk-700 border-risk-50',
  High:     'bg-risk-50 text-risk-700 border-risk-50',
  Medium:   'bg-mitigated-50 text-mitigated-700 border-mitigated-50',
  Low:      'bg-compliant-50 text-compliant-700 border-compliant-50',
};
const SEV_DOT: Record<Severity, string> = {
  Critical: 'bg-risk', High: 'bg-risk', Medium: 'bg-mitigated-500', Low: 'bg-compliant',
};
const STATUS_CHIP: Record<ExStatus, string> = {
  Open:     'bg-risk-50 text-risk-700',
  Triaging: 'bg-mitigated-50 text-mitigated-700',
  Resolved: 'bg-compliant-50 text-compliant-700',
};
const TONE_PILL: Record<SlaTone, string> = {
  risk:      'bg-risk-50 text-risk-700 border-risk-50',
  mitigated: 'bg-mitigated-50 text-mitigated-700 border-mitigated-50',
  compliant: 'bg-compliant-50 text-compliant-700 border-compliant-50',
};
const TONE_BAR: Record<SlaTone, string> = {
  risk: 'bg-risk', mitigated: 'bg-mitigated-500', compliant: 'bg-compliant',
};
const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES: ExStatus[] = ['Open', 'Triaging'];

/** Mock "closed this week" entries — demo richness only, behind the toggle.
 *  Seeded against the fallback persona; re-assigned to the signed-in user at render. */
const RESOLVED_THIS_WEEK: EngagementException[] = [
  { id: 'rx-9001', ref: 'EX-1180', engagementId: 'eng-3', workflowId: 'wf2',
    workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate invoice — vendor V-7711 (tolerance match)',
    severity: 'Medium', status: 'Resolved', opened: '5d ago',
    assignee: CURRENT_USER.name, classification: 'False Positive', amount: '₹62K' },
  { id: 'rx-9002', ref: 'EX-1175', engagementId: 'eng-9', workflowId: 'wf1',
    workflowName: 'Three-Way Match (PO · GRN · Invoice)',
    title: 'PO/Invoice variance reconciled with vendor credit note',
    severity: 'High', status: 'Resolved', opened: '6d ago',
    assignee: CURRENT_USER.name, classification: 'Process Gap' },
  { id: 'rx-9003', ref: 'EX-1166', engagementId: 'eng-3', workflowId: 'wf2',
    workflowName: 'Duplicate Invoice Detector',
    title: 'Duplicate posting reversed — vendor V-0044',
    severity: 'Medium', status: 'Resolved', opened: '4d ago',
    assignee: CURRENT_USER.name, classification: 'Control Deficiency' },
  { id: 'rx-9004', ref: 'EX-1159', engagementId: 'eng-7', workflowId: 'wf4',
    workflowName: 'Vendor Master Change Monitor',
    title: 'Vendor onboarded — KYC backfilled within SLA',
    severity: 'Low', status: 'Resolved', opened: '3d ago',
    assignee: CURRENT_USER.name, classification: 'False Positive' },
];

/** Quick-classify templates — chips that mock applying a rationale in one click. */
const CLASSIFY_TEMPLATES: { id: string; label: string; tone: string; icon: typeof Tag }[] = [
  { id: 't1', label: 'False Positive — legitimate retry',    tone: 'border-compliant-50 text-compliant-700 hover:bg-compliant-50', icon: Check },
  { id: 't2', label: 'Control Deficiency — duplicate match', tone: 'border-risk-50 text-risk-700 hover:bg-risk-50',                icon: AlertTriangle },
  { id: 't3', label: 'Process Gap — missing SOP step',       tone: 'border-mitigated-50 text-mitigated-700 hover:bg-mitigated-50', icon: Wand2 },
  { id: 't4', label: 'False Positive — tolerance match',     tone: 'border-evidence-50 text-evidence-700 hover:bg-evidence-50',    icon: Tag },
];

// ─── Memory approvals & renewals ────────────────────────────────────────────
// The governance inbox for the shared memory store (scope-follows-surface:
// shared memory is approved HERE, not in the registry). Decisions run through
// the shared session layer, so an approval instantly flips the row in Smart
// Learn, the engagement Memory tab, and every surface that recalls it — and
// every decision lands in the audit log's Memory module.

/** Scope-adjust presets offered on approve (PRD: approval may narrow scope). */
const APPROVE_PRESETS: { id: string; label: string }[] = [
  { id: 'as-proposed', label: 'Approve as proposed' },
  { id: 'engagement-only', label: 'Approve for this engagement only' },
  { id: 'expiry-90', label: 'Approve with a 90-day expiry' },
];

function MemoryQueueCard({ memory, meName }: { memory: PlatformMemory; meName: string }) {
  const { addToast } = useToast();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const d = decisionFor(memory.id);

  if (d?.approved) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-compliant-50 bg-compliant-50/60 px-4 py-2.5">
        <Check size={14} strokeWidth={3} className="shrink-0 text-compliant-700" />
        <span className="min-w-0 flex-1 truncate text-[0.75rem] text-compliant-700">
          <span className="font-semibold">Approved{d.approved.note ? ` — ${d.approved.note}` : ''}.</span> Active everywhere the memory fires; logged to the audit trail.
        </span>
        <button onClick={() => undoQueueDecision(memory)}
          className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer">
          <Undo2 size={11} /> Undo
        </button>
      </div>
    );
  }
  if (d?.rejected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border-light bg-surface-2 px-4 py-2.5">
        <X size={13} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-[0.75rem] text-text-secondary">
          Rejected — the proposal is retired, not deleted. It may return if the signal strengthens.
        </span>
        <button onClick={() => undoQueueDecision(memory)}
          className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-primary hover:underline cursor-pointer">
          <Undo2 size={11} /> Undo
        </button>
      </div>
    );
  }

  const approve = (note?: string) => {
    approveMemory(memory, meName, note);
    addToast({ type: 'success', message: 'Memory approved — active on every surface it fires in.' });
  };

  return (
    <div className="rounded-xl border border-border-light bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Brain size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-medium leading-snug text-text">{memory.statement}</p>
          <p className="mt-1 text-[0.6875rem] leading-relaxed text-text-secondary">
            <span className="font-mono font-semibold text-primary">{KIND_META[memory.kind].label} · {SCOPE_META[memory.scope].label}</span>
            <span className="text-text-muted"> · </span>
            {memory.pendingNote ?? memory.source}
            <span className="text-text-muted"> · {memory.evidence.length} evidence item{memory.evidence.length === 1 ? '' : 's'}</span>
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-11">
        <button onClick={() => approve()}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[0.75rem] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer">
          Approve
        </button>
        <div className="relative">
          <button onClick={() => setAdjustOpen(o => !o)} aria-expanded={adjustOpen}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border-light bg-white px-3 text-[0.75rem] font-semibold text-text-secondary hover:border-primary/40 hover:text-primary transition-colors cursor-pointer">
            Adjust scope <ChevronDown size={12} className={`transition-transform ${adjustOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {adjustOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setAdjustOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 z-30 mt-1.5 w-[240px] rounded-lg border border-border-light bg-white p-1.5 shadow-xl"
                >
                  {APPROVE_PRESETS.map(p => (
                    <button key={p.id}
                      onClick={() => { setAdjustOpen(false); approve(p.id === 'as-proposed' ? undefined : p.label.replace('Approve ', '')); }}
                      className="block w-full rounded-md px-2.5 py-1.5 text-left text-[0.75rem] font-medium text-text hover:bg-surface-2 transition-colors cursor-pointer">
                      {p.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => { rejectMemory(memory, meName); addToast({ type: 'info', message: 'Proposal rejected — retired with its audit trail, not deleted.' }); }}
          className="inline-flex h-8 items-center rounded-md px-2 text-[0.75rem] font-semibold text-text-muted hover:text-risk-700 transition-colors cursor-pointer">
          Reject
        </button>
      </div>
    </div>
  );
}

function MemoryRenewalCard({ memory }: { memory: PlatformMemory }) {
  const { addToast } = useToast();
  const d = decisionFor(memory.id);
  if (d?.renewedTo) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-compliant-50 bg-compliant-50/60 px-4 py-2.5">
        <Check size={14} strokeWidth={3} className="shrink-0 text-compliant-700" />
        <span className="min-w-0 flex-1 truncate text-[0.75rem] font-semibold text-compliant-700">Renewed — next review {d.renewedTo}. Logged.</span>
      </div>
    );
  }
  if (d?.forgotten) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border-light bg-surface-2 px-4 py-2.5">
        <X size={13} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate text-[0.75rem] text-text-secondary">Retired — removed from shared memory and logged.</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-mitigated-50 bg-mitigated-50/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-mitigated-50 text-mitigated-700">
          <CalendarClock size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-medium leading-snug text-text">{memory.statement}</p>
          <p className="mt-1 text-[0.6875rem] text-text-secondary">
            <span className="font-mono font-semibold text-mitigated-700">Review due {memory.reviewBy}</span>
            <span className="text-text-muted"> · {KIND_META[memory.kind].label} · {SCOPE_META[memory.scope].label} · recalled {memory.recallCount}×</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <button onClick={() => { renewMemory(memory); addToast({ type: 'success', message: `Renewed until ${RENEWAL_TARGET}.` }); }}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[0.75rem] font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer">
            Renew until {RENEWAL_TARGET}
          </button>
          <button onClick={() => { forgetMemory(memory); addToast({ type: 'info', message: 'Memory retired — logged to the audit trail.' }); }}
            className="inline-flex h-8 items-center rounded-md px-2 text-[0.75rem] font-semibold text-text-muted hover:text-risk-700 transition-colors cursor-pointer">
            Retire
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryQueueSection({ meName }: { meName: string }) {
  useMemorySessionVersion();
  const all = allMemories();
  // Proposals: seed-proposed rows plus session captures, still shown after a
  // decision (as undoable receipts) so the queue never "loses" an item mid-look.
  const proposals = all.filter(m => {
    const d = decisionFor(m.id);
    return m.status === 'proposed' || d?.approved != null || d?.rejected === true;
  });
  const seedProposedIds = new Set(MEMORY_STORE.filter(m => m.status === 'proposed').map(m => m.id));
  const orderedProposals = [
    ...proposals.filter(m => seedProposedIds.has(m.id)),
    ...proposals.filter(m => !seedProposedIds.has(m.id)),
  ];
  const renewals = all.filter(m => m.renewDue || decisionFor(m.id)?.renewedTo);
  const openCount = orderedProposals.filter(m => m.status === 'proposed').length
    + renewals.filter(m => m.renewDue).length;
  if (orderedProposals.length === 0 && renewals.length === 0) return null;
  return (
    <section aria-label="Memory approvals and renewals" className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Brain size={13} className="text-primary" />
          <h2 className="text-[0.75rem] font-bold uppercase tracking-wider text-text">Memory approvals &amp; renewals</h2>
          {openCount > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[0.625rem] font-bold tabular-nums text-primary">{openCount}</span>
          )}
        </span>
        <span className="text-[0.6875rem] text-text-muted">
          Proposals from the shared store — nothing becomes team, engagement or org memory without a yes here.
        </span>
      </div>
      <div className="space-y-2">
        {orderedProposals.map(m => <MemoryQueueCard key={m.id} memory={m} meName={meName} />)}
        {renewals.map(m => <MemoryRenewalCard key={m.id} memory={m} />)}
      </div>
    </section>
  );
}

export default function MyQueueView({ onOpenException }: Props): JSX.Element {
  const { addToast } = useToast();
  // The queue follows the real platform login: resolve the signed-in user to
  // their engagement-roster person (fallback persona when signed out).
  const { currentUser } = useCurrentUser();
  const me = useMemo(() => personForUser(currentUser?.name), [currentUser?.name]);

  const [sevFilter, setSevFilter] = useState<Set<Severity>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<ExStatus>>(new Set());
  const [engFilter, setEngFilter] = useState<string>('All');
  const [showResolved, setShowResolved] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const myQueue = useMemo<EngagementException[]>(
    () => myQueueFor(ENGAGEMENT_EXCEPTIONS, me),
    [me],
  );

  const resolvedThisWeek = useMemo<EngagementException[]>(
    () => RESOLVED_THIS_WEEK.map(e => ({ ...e, assignee: me.name })),
    [me.name],
  );

  const kpis = useMemo(() => {
    let dueToday = 0;
    let overdue = 0;
    let inTriage = 0;
    myQueue.forEach(ex => {
      const sla = slaStatus(openedToHours(ex.opened), ex.severity);
      if (sla.tone === 'risk') overdue += 1;
      else if (sla.tone === 'mitigated') dueToday += 1;
      if (ex.status === 'Triaging') inTriage += 1;
    });
    return { dueToday, overdue, inTriage, closedThisWeek: 7 };
  }, [myQueue]);

  const visible = useMemo(() => {
    const pool: EngagementException[] = showResolved
      ? [...myQueue, ...resolvedThisWeek]
      : myQueue;
    const out = pool.filter(ex => {
      if (sevFilter.size > 0 && !sevFilter.has(ex.severity)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(ex.status)) return false;
      if (engFilter !== 'All' && ex.engagementId !== engFilter) return false;
      return true;
    });
    // Overdue (risk) → due-soon (mitigated) → compliant; within tone, more-aged first.
    const TONE_RANK: Record<SlaTone, number> = { risk: 0, mitigated: 1, compliant: 2 };
    return out
      .map(ex => ({ ex, sla: slaStatus(openedToHours(ex.opened), ex.severity) }))
      .sort((a, b) => {
        const t = TONE_RANK[a.sla.tone] - TONE_RANK[b.sla.tone];
        if (t !== 0) return t;
        return b.sla.pct - a.sla.pct;
      });
  }, [myQueue, resolvedThisWeek, sevFilter, statusFilter, engFilter, showResolved]);

  const engagementOptions = useMemo(() => {
    const ids = new Set(myQueue.map(e => e.engagementId));
    return ENGAGEMENTS.filter(e => ids.has(e.id));
  }, [myQueue]);

  function toggle<T>(setter: (u: (p: Set<T>) => Set<T>) => void, v: T) {
    setter(prev => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  }
  function resetFilters() {
    setSevFilter(new Set());
    setStatusFilter(new Set());
    setEngFilter('All');
  }
  const hasFilters = sevFilter.size > 0 || statusFilter.size > 0 || engFilter !== 'All';

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <div className="p-8 relative">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-semibold text-text-muted tracking-wider uppercase mb-1">
              My Queue
            </div>
            <h1 className="text-[2rem] font-bold text-text leading-tight">
              My queue — {me.name}
            </h1>
            <p className="text-[0.8125rem] text-text-secondary mt-1.5 max-w-xl">
              Everything that&apos;s waiting on you across every engagement.
            </p>
          </div>
          <DelegationCard
            meName={me.name}
            open={delegateOpen}
            onToggle={() => setDelegateOpen(v => !v)}
            onActivate={(d) => {
              addToast({
                message: `Delegation active until ${d.until} — routing to ${d.to}`,
                type: 'success',
              });
              setDelegateOpen(false);
            }}
          />
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <KpiTile label="Due Today" value={kpis.dueToday} icon={AlertTriangle}
            tint="bg-risk-50 border-risk-50" valueCls="text-risk-700" iconCls="text-risk-700"
            sub="SLA at risk in <24h" />
          <KpiTile label="Overdue" value={kpis.overdue} icon={Clock}
            tint="bg-risk-50 border-risk-50" valueCls="text-risk-700" iconCls="text-risk-700"
            sub="SLA already breached" />
          <KpiTile label="In Triage" value={kpis.inTriage} icon={Activity}
            tint="bg-evidence-50 border-evidence-50" valueCls="text-evidence-700" iconCls="text-evidence-700"
            sub="Assigned to you" />
          <KpiTile label="Closed This Week" value={kpis.closedThisWeek} icon={CheckCircle2}
            tint="bg-compliant-50 border-compliant-50" valueCls="text-compliant-700" iconCls="text-compliant-700"
            sub="Across all engagements" />
        </div>

        {/* Memory governance inbox — sits above the exception queue because it
            is different work (approve/renew shared memory) with its own SLA. */}
        <MemoryQueueSection meName={me.name} />

        <div className="flex items-center gap-4 mb-4 flex-wrap text-[0.6875rem]">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-text-muted" />
            <span className="font-bold text-text-muted uppercase tracking-wide">Severity</span>
            <div className="flex gap-1">
              {SEVERITIES.map(s => (
                <button key={s} onClick={() => toggle(setSevFilter, s)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    sevFilter.has(s)
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="w-px h-5 bg-border-light" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-muted uppercase tracking-wide">Status</span>
            <div className="flex gap-1">
              {STATUSES.map(s => (
                <button key={s} onClick={() => toggle(setStatusFilter, s)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                    statusFilter.has(s)
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>
          <div className="w-px h-5 bg-border-light" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-muted uppercase tracking-wide">Engagement</span>
            <div className="relative">
              <select
                value={engFilter}
                onChange={e => setEngFilter(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1 rounded-full bg-surface-2 text-text font-semibold text-[0.6875rem] border border-border-light outline-none focus:border-primary/40 cursor-pointer"
              >
                <option value="All">All engagements</option>
                {engagementOptions.map(e => (
                  <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>
          <div className="w-px h-5 bg-border-light" />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              className="accent-primary cursor-pointer"
            />
            <span className="font-bold text-text-muted uppercase tracking-wide">
              Show resolved (this week)
            </span>
          </label>
          {hasFilters && (
            <button onClick={resetFilters}
              className="ml-auto text-[0.6875rem] font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer"
            >Clear filters</button>
          )}
        </div>

        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-1">
            <Wand2 size={12} className="text-primary" />
            <span className="text-[0.75rem] font-bold uppercase tracking-wider text-text-muted">
              Quick Classify
            </span>
          </div>
          <Gated permission="exc_classify" mode="disable" title="You don't have permission to classify exceptions">
          {CLASSIFY_TEMPLATES.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id}
                onClick={() => addToast({
                  message: selectedIds.size > 0
                    ? `Applied "${t.label}" to ${selectedIds.size} selected`
                    : `Applied "${t.label}" to selected`,
                  type: 'success',
                })}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-white text-[0.6875rem] font-semibold transition-colors cursor-pointer ${t.tone}`}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}
          </Gated>
        </div>

        {visible.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onClear={resetFilters} />
        ) : (
          <div className="border border-border-light rounded-xl bg-white overflow-hidden">
            <div className="grid grid-cols-[120px_180px_minmax(0,1fr)_150px_130px] gap-4 px-5 py-3 border-b border-border-light text-[0.75rem] uppercase tracking-wider font-semibold text-text-muted/80 bg-surface-2/30">
              <div>Severity</div>
              <div>Engagement</div>
              <div>Exception</div>
              <div>SLA</div>
              <div className="text-right">Actions</div>
            </div>
            <AnimatePresence initial={false}>
              {visible.map(({ ex, sla }, i) => (
                <QueueRow
                  key={ex.id}
                  ex={ex}
                  sla={sla}
                  index={i}
                  selected={selectedIds.has(ex.id)}
                  onToggleSelect={() => toggle(setSelectedIds, ex.id)}
                  onAction={(label) => addToast({
                    message: `${label} — ${ex.ref}`,
                    type: 'info',
                  })}
                  onOpen={() => onOpenException(ex.engagementId, ex.id)}
                />
              ))}
            </AnimatePresence>
            <div className="px-5 py-2.5 text-[0.6875rem] text-text-muted bg-surface-2/30 border-t border-border-light flex items-center justify-between">
              <span>
                {visible.length} item{visible.length === 1 ? '' : 's'} in your queue
                {showResolved && ' (incl. resolved this week)'}
              </span>
              {selectedIds.size > 0 && (
                <span className="text-primary font-semibold">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiTile({
  label, value, icon: Icon, tint, valueCls, iconCls, sub,
}: {
  label: string;
  value: number | string;
  icon: typeof AlertTriangle;
  tint: string;
  valueCls: string;
  iconCls: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-xl p-4 border ${tint}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.75rem] uppercase tracking-wide font-semibold text-text-muted">
          {label}
        </span>
        <Icon size={14} className={iconCls} />
      </div>
      <div className={`text-[1.75rem] font-bold tabular-nums leading-none ${valueCls}`}>
        {value}
      </div>
      {sub && <div className="text-[0.6875rem] text-text-muted mt-1.5">{sub}</div>}
    </div>
  );
}

function QueueRow({
  ex, sla, index, selected, onToggleSelect, onAction, onOpen,
}: {
  ex: EngagementException;
  sla: { label: string; tone: SlaTone; pct: number };
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onAction: (label: string) => void;
  onOpen: () => void;
}) {
  const eng = ENGAGEMENTS.find(e => e.id === ex.engagementId);
  const processColor = eng ? PROCESS_COLORS[eng.process] : '#6a12cd';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.018, 0.4) }}
      onClick={onOpen}
      className={`grid grid-cols-[120px_180px_minmax(0,1fr)_150px_130px] gap-4 px-5 py-4 border-b border-border-light last:border-0 transition-colors cursor-pointer group items-center ${
        selected ? 'bg-primary/5' : 'hover:bg-surface-2/30'
      }`}
    >
      {/* Severity column with selector */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
          onClick={(e) => e.stopPropagation()}
          className="accent-primary cursor-pointer"
        />
        <span className={`inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-semibold border ${SEV_CHIP[ex.severity]}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${SEV_DOT[ex.severity]}`} aria-hidden="true" />
          {ex.severity}
        </span>
      </div>

      {/* Engagement chip — process-colored */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md text-[0.6875rem] font-semibold bg-white border border-border-light hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer min-w-0 max-w-full"
        title={eng?.name ?? 'Open engagement'}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: processColor }} />
        <span className="truncate text-text-secondary">{eng?.code ?? ex.engagementId}</span>
        <span className="text-border-light shrink-0">·</span>
        <span className="truncate text-text">{eng?.process}</span>
      </button>

      {/* Exception ref + title + workflow */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[0.6875rem] text-text-muted tabular-nums">{ex.ref}</span>
          <span className={`inline-flex items-center px-1.5 h-4 rounded text-[0.75rem] font-semibold ${STATUS_CHIP[ex.status]}`}>
            {ex.status}
          </span>
          {ex.amount && (
            <span className="inline-flex items-center px-1.5 h-4 rounded text-[0.75rem] font-bold bg-surface-2 text-text-secondary tabular-nums">
              {ex.amount}
            </span>
          )}
        </div>
        <div className="text-[0.8125rem] font-semibold text-text mt-0.5 truncate" title={ex.title}>
          {ex.title}
        </div>
        <div className="text-[0.6875rem] text-text-muted mt-0.5 truncate">
          {ex.workflowName} <span className="text-border">·</span> opened {ex.opened}
        </div>
      </div>

      {/* SLA countdown pill */}
      <div className="flex flex-col gap-1 min-w-0">
        <span className={`inline-flex items-center self-start gap-1 px-2 h-5 rounded-full text-[0.75rem] font-semibold border ${TONE_PILL[sla.tone]}`}>
          <Clock size={10} />
          {sla.label}
        </span>
        <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${TONE_BAR[sla.tone]}`} style={{ width: `${sla.pct}%` }} />
        </div>
      </div>

      {/* Inline quick actions */}
      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <Gated permission="exc_classify" mode="disable" title="You don't have permission to classify exceptions">
          <RowButton icon={Tag} label="Classify" onClick={() => onAction('Classification panel opened')} />
        </Gated>
        <Gated permission="exc_assign" mode="disable" title="You don't have permission to reassign exceptions">
          <RowButton icon={UserPlus} label="Reassign" onClick={() => onAction('Reassign drawer opened')} />
        </Gated>
        <Gated permission="exc_resolve" mode="disable" title="You don't have permission to snooze exceptions">
          <RowButton icon={BellOff} label="Snooze" onClick={() => onAction('Snoozed for 24h')} />
        </Gated>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.6875rem] font-semibold transition-colors cursor-pointer"
          title="Open exception"
        >
          Open <ArrowRight size={11} />
        </button>
      </div>
    </motion.div>
  );
}

function RowButton({
  icon: Icon, label, onClick,
}: {
  icon: typeof Tag;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
      title={label}
      aria-label={label}
    >
      <Icon size={13} />
    </button>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  if (hasFilters) {
    return (
      <div className="border border-border-light rounded-xl p-14 text-center bg-white">
        <Filter size={28} className="text-text-muted mx-auto mb-3" />
        <p className="text-[0.875rem] font-semibold text-text mb-1">No exceptions match your filters</p>
        <p className="text-[0.75rem] text-text-muted mb-4">Try clearing the severity, status, or engagement filter.</p>
        <button onClick={onClear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
        >Clear filters</button>
      </div>
    );
  }
  return (
    <div className="border border-border-light rounded-xl p-14 text-center bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-compliant-50/40 via-transparent to-evidence-50/30 pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-compliant-50 text-compliant-700 mb-3">
          <Sparkles size={22} />
        </div>
        <p className="text-[0.9375rem] font-semibold text-text mb-1">All caught up!</p>
        <p className="text-[0.75rem] text-text-muted">
          Nothing in your queue. Take a breath — or jump into another engagement.
        </p>
      </div>
    </div>
  );
}

function DelegationCard({
  meName, open, onToggle, onActivate,
}: {
  meName: string;
  open: boolean;
  onToggle: () => void;
  onActivate: (d: { from: string; until: string; to: string }) => void;
}) {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(PEOPLE.find(p => p.name !== meName)?.name ?? PEOPLE[0].name);

  return (
    <div className="w-[300px] shrink-0 rounded-lg border border-border-light bg-white p-4 relative">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-md bg-evidence-50 text-evidence-700 flex items-center justify-center">
            <Zap size={14} />
          </div>
          <div>
            <div className="text-[0.75rem] font-semibold text-text leading-tight">
              Delegate while you&apos;re away
            </div>
            <div className="text-[0.75rem] text-text-muted leading-tight">
              Auto-route to a teammate
            </div>
          </div>
        </div>
        <button onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? 'Collapse delegation form' : 'Expand delegation form'}
          className="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          {open ? <X size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2.5">
              <div>
                <label className="flex items-center gap-1 text-[0.625rem] uppercase tracking-wide font-bold text-text-muted mb-1">
                  <CalendarRange size={10} />
                  Range
                </label>
                <div className="flex items-center gap-1.5">
                  <DatePicker value={from} onChange={e => setFrom(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 text-[0.6875rem] border border-border-light rounded-md text-text outline-none focus:border-primary/40 bg-white" />
                  <span className="text-text-muted text-[0.6875rem]">→</span>
                  <DatePicker value={until} onChange={e => setUntil(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 text-[0.6875rem] border border-border-light rounded-md text-text outline-none focus:border-primary/40 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-[0.625rem] uppercase tracking-wide font-bold text-text-muted mb-1">
                  Delegate to
                </label>
                <select value={to} onChange={e => setTo(e.target.value)}
                  className="w-full px-2 py-1.5 text-[0.6875rem] border border-border-light rounded-md bg-white text-text outline-none focus:border-primary/40 cursor-pointer"
                >
                  {PEOPLE.filter(p => p.name !== meName).map(p => (
                    <option key={p.id} value={p.name}>{p.name} — {p.role}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => onActivate({ from, until, to })}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold transition-colors cursor-pointer"
              >
                <Check size={12} />
                Activate delegation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
