// ─── Knowledge Hub — Smart Learn (platform memory registry) ────────────────
//
// The browsable home of the shared memory store (Memory Management PRD §4).
// Scope follows surface for governance — approvals & renewals happen in My
// Queue, tenant guardrails in Admin — so this page is deliberately NOT a
// fourth approval surface. It answers one question: "what does IRA know
// about how we work, and why?" Every row carries its provenance; safe
// lifecycle actions (forget, renew, undo) run inline; governance actions
// deep-link out to their owning surface.

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  UserRound, Users, Briefcase, Building2,
  SlidersHorizontal, BookOpen, Landmark, PenLine, ShieldCheck,
  Brain, Search, ChevronDown, ChevronRight, CalendarClock, Zap,
  Eye, Inbox, Info, Check, CircleSlash, Undo2, ArrowRight, Lock,
  ArrowUpRight, ScrollText, History, Clock,
} from 'lucide-react';
import Drawer from '../shared/Drawer';
import ConfirmationModal from '../shared/ConfirmationModal';
import {
  MEMORY_STORE, SCOPE_META, SCOPE_ORDER, KIND_META,
  RECALLS_THIS_WEEK, RENEWAL_TARGET,
  type PlatformMemory, type MemoryScope, type MemoryKind,
} from '../../data/memoryStore';

// ─── Icon maps (meta stores lucide names; this surface binds them) ─────────

const SCOPE_ICON: Record<MemoryScope, React.ComponentType<{ size?: number; className?: string }>> = {
  personal: UserRound, team: Users, engagement: Briefcase, tenant: Building2,
};

const KIND_ICON: Record<MemoryKind, React.ComponentType<{ size?: number; className?: string }>> = {
  preference: SlidersHorizontal, vocabulary: BookOpen, convention: Users,
  fact: Landmark, correction: PenLine, guardrail: ShieldCheck,
};

// Personalization kinds carry brand; governed facts stay neutral; compliance
// guardrails read evidence-blue. Colour is a scanning aid, never the only
// signal — the kind label is always written out in the meta line.
const KIND_TINT: Record<MemoryKind, string> = {
  preference: 'bg-brand-50 text-brand-700',
  vocabulary: 'bg-brand-50 text-brand-700',
  correction: 'bg-brand-50 text-brand-700',
  convention: 'bg-canvas text-ink-500',
  fact: 'bg-canvas text-ink-500',
  guardrail: 'bg-evidence-50 text-evidence-700',
};

const SCOPE_PILL: Record<MemoryScope, string> = {
  personal: 'bg-brand-50 text-brand-700',
  team: 'bg-canvas text-ink-600',
  engagement: 'bg-canvas text-ink-600',
  tenant: 'bg-evidence-50 text-evidence-700',
};

// ─── Local state shapes ─────────────────────────────────────────────────────

/** Per-memory local decisions layered over the seed store. `forgotten` covers
 *  both a personal forget and a governed retire — same mechanics, different
 *  copy. `renewedTo` replaces the review date and clears the renewal flag. */
interface MemoryOverride { forgotten?: boolean; renewedTo?: string; }

type StatusFilterId = 'all' | 'active' | 'pending' | 'review';
const STATUS_FILTERS: { id: StatusFilterId; label: string }[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Awaiting approval' },
  { id: 'review', label: 'Review due' },
];

/** Deep-link into another surface without prop-drilling setView — the same
 *  CustomEvent the report modals use (App.tsx `app:navigate-view`). */
function navigateTo(view: string) {
  window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view } }));
}

/** The seed memory with local overrides applied. */
function effective(m: PlatformMemory, o?: MemoryOverride): PlatformMemory {
  if (!o?.renewedTo) return m;
  return { ...m, reviewBy: o.renewedTo, renewDue: false };
}

// ─── How memory works (explainer strip) ─────────────────────────────────────

function MemoryExplainer() {
  const points = [
    { icon: Eye, title: 'Observed with evidence', body: 'IRA notices repeated preferences, corrections and conventions across sessions, runs and edits — and keeps the receipts for each.' },
    { icon: Inbox, title: 'Approved by humans', body: 'Anything shared needs a human yes. Proposals and renewals arrive in My Queue as badged work; personal memories stay yours.' },
    { icon: Zap, title: 'One shared store', body: 'Chat, workflows and reports read the same store — an approval in one place changes what every surface applies.' },
    { icon: ShieldCheck, title: 'Versioned & audited', body: 'Every memory carries scope, version and review date. Changes and overrides land in the audit log’s Memory category.' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {points.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 360, damping: 22 }}
          className="rounded-xl border border-canvas-border bg-canvas-elevated p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <p.icon size={16} strokeWidth={2} />
            </span>
            <span className="font-mono text-[11px] font-medium tabular-nums text-ink-300">{`0${i + 1}`}</span>
          </div>
          <h4 className="text-[13px] font-semibold tracking-tight text-ink-900">{p.title}</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{p.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Status filter (single-select dropdown) ─────────────────────────────────

function StatusFilterMenu({ active, counts, onChange }: {
  active: StatusFilterId;
  counts: Record<StatusFilterId, number>;
  onChange: (id: StatusFilterId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = STATUS_FILTERS.find(f => f.id === active)!;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${open || active !== 'all' ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
      >
        {active === 'all' ? 'Status' : current.label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* click-away layer */}
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-30 mt-2 w-[220px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-2"
            >
              {STATUS_FILTERS.map(f => {
                const checked = active === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => { onChange(f.id); setOpen(false); }}
                    aria-pressed={checked}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-canvas transition-colors cursor-pointer"
                  >
                    <span className={`flex size-4 items-center justify-center rounded-full border transition-colors ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-canvas-border bg-canvas-elevated'}`}>
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 text-[12px] font-medium text-ink-800">{f.label}</span>
                    <span className="text-[11px] tabular-nums text-ink-400">{counts[f.id]}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Memory row ─────────────────────────────────────────────────────────────

function MemoryRow({ memory, index, onOpen, onRenew }: {
  memory: PlatformMemory;
  index: number;
  onOpen: () => void;
  onRenew: () => void;
}) {
  const KindIcon = KIND_ICON[memory.kind];
  const kind = KIND_META[memory.kind];
  const isPending = memory.status === 'pending';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.24), ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group w-full rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-left hover:border-brand-200 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${KIND_TINT[memory.kind]}`}>
            <KindIcon size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-snug text-ink-900">{memory.statement}</p>
            {isPending && memory.pendingNote ? (
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                <span className="font-semibold text-ink-600">{kind.label}</span>
                <span className="text-ink-300"> · </span>
                {memory.pendingNote}
              </p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-400">
                <span className="font-semibold text-ink-600">{kind.label}</span>
                <span className="text-ink-300">·</span>
                <span>{memory.source}</span>
                <span className="text-ink-300">·</span>
                <span className="tabular-nums">Recalled {memory.recallCount} times</span>
                <span className="text-ink-300">·</span>
                <span>Last used {memory.lastRecalled}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mitigated-200 bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">
                <Clock size={10} /> Awaiting approval
              </span>
            )}
            {memory.renewDue && memory.reviewBy && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-mitigated-200 bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">
                  <CalendarClock size={10} /> Review due {memory.reviewBy}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); onRenew(); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onRenew(); } }}
                  className="text-[11px] font-semibold text-brand-700 hover:underline cursor-pointer"
                >
                  Renew
                </span>
              </>
            )}
            {memory.scope === 'tenant' && (
              <span title="Managed in Admin" className="text-ink-300">
                <Lock size={12} aria-label="Managed in Admin" />
              </span>
            )}
            <ChevronRight size={15} className="text-ink-300 transition-colors group-hover:text-ink-500" />
          </div>
        </div>
      </button>
    </motion.div>
  );
}

// A forgotten/retired row collapses to a slim undo strip — same recipe as the
// insight approval gate's dismissed state, so the vocabulary stays consistent.
function ForgottenStrip({ memory, onUndo }: { memory: PlatformMemory; onUndo: () => void }) {
  const governed = memory.scope !== 'personal';
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas px-4 py-2.5">
      <CircleSlash size={14} className="shrink-0 text-ink-400" />
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-500">
        {governed
          ? <>Retired for everyone — removed from shared memory and logged to the audit trail.</>
          : <>Forgotten — IRA will no longer use this.</>}
      </span>
      <button type="button" onClick={onUndo}
        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline cursor-pointer">
        <Undo2 size={11} /> Undo
      </button>
    </motion.div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────────

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-0.5 text-[12px] font-medium text-ink-800">{children}</div>
    </div>
  );
}

function MemoryDrawer({ memory, justRenewed, onClose, onForget, onRenew }: {
  memory: PlatformMemory;
  justRenewed: boolean;
  onClose: () => void;
  onForget: () => void;
  onRenew: () => void;
}) {
  const scope = SCOPE_META[memory.scope];
  const kind = KIND_META[memory.kind];
  const isPending = memory.status === 'pending';
  const isPersonal = memory.scope === 'personal';
  const isTenant = memory.scope === 'tenant';
  const version = memory.versions?.[0]?.version;

  const footer = (
    <>
      {isPersonal && (
        <button type="button" onClick={onForget}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-risk/30 px-3.5 text-[12px] font-semibold text-risk hover:bg-risk-50 transition-colors cursor-pointer">
          <CircleSlash size={13} /> Forget this memory
        </button>
      )}
      {!isPersonal && !isTenant && !isPending && (
        <button type="button" onClick={onForget}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-risk/30 px-3.5 text-[12px] font-semibold text-risk hover:bg-risk-50 transition-colors cursor-pointer">
          <CircleSlash size={13} /> Retire memory
        </button>
      )}
      {memory.renewDue && (
        <button type="button" onClick={onRenew}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-[12px] font-semibold text-white hover:bg-brand-500 transition-colors cursor-pointer">
          <CalendarClock size={13} /> Renew until {RENEWAL_TARGET}
        </button>
      )}
      {isPending && (
        <button type="button" onClick={() => navigateTo('my-queue')}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-[12px] font-semibold text-white hover:bg-brand-500 transition-colors cursor-pointer">
          Review in My Queue <ArrowRight size={13} />
        </button>
      )}
      {isTenant && (
        <button type="button" onClick={() => navigateTo('admin-logs')}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-canvas-border px-3.5 text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
          View in audit log <ArrowUpRight size={13} />
        </button>
      )}
    </>
  );

  return (
    <Drawer
      title={kind.label}
      subtitle={<span className="font-mono text-[11px] text-ink-400">{memory.id} · {scope.label} scope · learned {memory.learnedOn}</span>}
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-6">
        {/* The memory itself */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3.5">
          <p className="text-[15px] font-medium leading-relaxed text-ink-900">{memory.statement}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${SCOPE_PILL[memory.scope]}`}>{scope.label}</span>
            {isPending ? (
              <span className="inline-flex items-center rounded-full bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">Awaiting approval</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-compliant-50 px-2 py-0.5 text-[10px] font-bold text-compliant-700">Active</span>
            )}
            {memory.confidence != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated px-2 py-0.5 text-[10px] font-semibold text-ink-700">
                <span className={`size-1.5 rounded-full ${memory.confidence >= 0.85 ? 'bg-compliant' : 'bg-mitigated'}`} />
                {Math.round(memory.confidence * 100)}% confidence
              </span>
            )}
            {version && (
              <span className="inline-flex items-center rounded-full border border-canvas-border bg-canvas-elevated px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-500">v{version}</span>
            )}
          </div>
        </div>

        {justRenewed && (
          <div className="flex items-center gap-2 rounded-lg border border-compliant/30 bg-compliant-50 px-3 py-2">
            <ShieldCheck size={14} className="shrink-0 text-compliant-700" />
            <span className="text-[12px] font-semibold text-compliant-700">Renewed — next review {RENEWAL_TARGET}. Logged to the audit trail.</span>
          </div>
        )}

        {/* Facts about the fact */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <MetaCell label="Recalled">{memory.recallCount} times</MetaCell>
          <MetaCell label="Last recalled">{memory.lastRecalled}</MetaCell>
          {memory.approvedBy && <MetaCell label="Approved by">{memory.approvedBy}{memory.approvedOn ? ` · ${memory.approvedOn}` : ''}</MetaCell>}
          {memory.reviewBy && <MetaCell label="Review by">{memory.reviewBy}</MetaCell>}
          <MetaCell label="Source">{memory.source}</MetaCell>
        </div>

        {/* Provenance — the receipts */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <ScrollText size={13} className="text-ink-400" />
            <h3 className="text-[12px] font-bold text-ink-800">Where this came from</h3>
          </div>
          <div className="space-y-1.5">
            {memory.evidence.map(ev => (
              <div key={ev.label} className="flex items-baseline gap-2 rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2">
                <span className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-700">{ev.label}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-400">{ev.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Who reads it — the "one store, many surfaces" contract */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Zap size={13} className="text-ink-400" />
            <h3 className="text-[12px] font-bold text-ink-800">Read by</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {memory.readBy.map(r => (
              <span key={r} className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">{r}</span>
            ))}
          </div>
        </div>

        {/* Version history */}
        {memory.versions && memory.versions.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <History size={13} className="text-ink-400" />
              <h3 className="text-[12px] font-bold text-ink-800">Version history</h3>
            </div>
            <div className="space-y-0">
              {memory.versions.map((v, i) => (
                <div key={v.version} className="relative flex gap-3 pb-3 last:pb-0">
                  {i < memory.versions!.length - 1 && (
                    <span className="absolute left-[7px] top-5 bottom-0 w-px bg-canvas-border" aria-hidden="true" />
                  )}
                  <span className={`mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 ${i === 0 ? 'border-brand-600 bg-brand-50' : 'border-canvas-border bg-canvas-elevated'}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-ink-800">v{v.version}</span>
                      {i === 0 && <span className="rounded-full bg-brand-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-brand-700">Current</span>}
                      <span className="text-[11px] tabular-nums text-ink-400">{v.date}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">{v.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Where governance lives — scope follows surface */}
        <div className="flex items-start gap-2 rounded-lg border border-canvas-border bg-canvas/50 px-3 py-2.5">
          <Info size={13} className="mt-px shrink-0 text-ink-400" />
          <p className="text-[11px] leading-relaxed text-ink-500">{scope.managedIn}</p>
        </div>
      </div>
    </Drawer>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────

export default function SmartLearnView() {
  const [scopeFilter, setScopeFilter] = useState<'all' | MemoryScope>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>('all');
  const [query, setQuery] = useState('');
  const [overrides, setOverrides] = useState<Record<string, MemoryOverride>>({});
  const [personalCleared, setPersonalCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const renew = (id: string) =>
    setOverrides(o => ({ ...o, [id]: { ...o[id], renewedTo: RENEWAL_TARGET } }));
  const forget = (id: string) =>
    setOverrides(o => ({ ...o, [id]: { ...o[id], forgotten: true } }));
  const undo = (id: string) =>
    setOverrides(o => { const next = { ...o }; delete next[id]; return next; });

  // Seed + overrides. Personal-cleared removes the whole personal scope.
  const memories = useMemo(
    () => MEMORY_STORE.map(m => effective(m, overrides[m.id])),
    [overrides],
  );
  const isGone = (m: PlatformMemory) =>
    (personalCleared && m.scope === 'personal') || !!overrides[m.id]?.forgotten;
  const live = memories.filter(m => !isGone(m));

  const matchesStatus = (m: PlatformMemory, f: StatusFilterId) =>
    f === 'all' ||
    (f === 'pending' && m.status === 'pending') ||
    (f === 'review' && !!m.renewDue) ||
    (f === 'active' && m.status === 'active');
  const matchesQuery = (m: PlatformMemory) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      m.statement.toLowerCase().includes(q) ||
      m.source.toLowerCase().includes(q) ||
      KIND_META[m.kind].label.toLowerCase().includes(q)
    );
  };

  // Rows per scope — forgotten items stay in place as undo strips (but a
  // cleared personal scope collapses to one card instead of five strips).
  const groups = SCOPE_ORDER
    .filter(s => scopeFilter === 'all' || scopeFilter === s)
    .map(s => ({
      scope: s,
      items: memories.filter(m =>
        m.scope === s && matchesStatus(m, statusFilter) && matchesQuery(m) &&
        !(personalCleared && s === 'personal')),
    }));

  const scopeCounts: Record<'all' | MemoryScope, number> = {
    all: live.length,
    personal: live.filter(m => m.scope === 'personal').length,
    team: live.filter(m => m.scope === 'team').length,
    engagement: live.filter(m => m.scope === 'engagement').length,
    tenant: live.filter(m => m.scope === 'tenant').length,
  };
  const statusCounts: Record<StatusFilterId, number> = {
    all: live.length,
    active: live.filter(m => m.status === 'active').length,
    pending: live.filter(m => m.status === 'pending').length,
    review: live.filter(m => m.renewDue).length,
  };

  const stats = [
    { label: 'Active memories', value: statusCounts.active, tone: 'text-ink-900', Icon: Brain, iconWrap: 'bg-brand-50 text-brand-600' },
    { label: 'Awaiting approval', value: statusCounts.pending, tone: statusCounts.pending > 0 ? 'text-mitigated-700' : 'text-ink-900', Icon: Inbox, iconWrap: statusCounts.pending > 0 ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-400', onClick: () => navigateTo('my-queue'), hint: 'Review in My Queue' },
    { label: 'Due for review', value: statusCounts.review, tone: statusCounts.review > 0 ? 'text-mitigated-700' : 'text-ink-900', Icon: CalendarClock, iconWrap: statusCounts.review > 0 ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-400' },
    { label: 'Recalls this week', value: RECALLS_THIS_WEEK, tone: 'text-ink-900', Icon: Zap, iconWrap: 'bg-compliant-50 text-compliant-700' },
  ] as const;

  const selected = selectedId ? memories.find(m => m.id === selectedId) : undefined;
  const anyVisible = groups.some(g => g.items.length > 0) || (personalCleared && groups.some(g => g.scope === 'personal'));

  return (
    <div className="pb-8">
      {/* Intro row — what this registry is + page-level controls */}
      <div className="flex items-start justify-between gap-4 pb-4">
        <p className="mt-1 text-[13px] text-ink-500">
          Every memory <span className="font-semibold text-ink-800">IRA</span> holds, in one place — traceable to its source, scoped to its owner, and never shared without approval.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplainer(s => !s)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-colors cursor-pointer ${showExplainer ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
          >
            <Info size={13} /> How memory works
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showExplainer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.25 } }}
            className="overflow-hidden"
          >
            <div className="pb-4"><MemoryExplainer /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary strip — the store's health at a glance */}
      <div className="mb-5 grid grid-cols-4 divide-x divide-canvas-border overflow-hidden rounded-xl border border-canvas-border bg-canvas-elevated">
        {stats.map(s => {
          const inner = (
            <>
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${s.iconWrap}`}>
                <s.Icon size={16} />
              </span>
              <div className="min-w-0 text-left">
                <div className={`text-[22px] font-bold leading-none tabular-nums ${s.tone}`}>{s.value}</div>
                <div className="mt-1 truncate text-[11px] text-ink-400">
                  {s.label}
                  {'hint' in s && s.value > 0 && <span className="ml-1 font-semibold text-brand-700">· {s.hint} →</span>}
                </div>
              </div>
            </>
          );
          return 'onClick' in s && s.value > 0 ? (
            <button key={s.label} type="button" onClick={s.onClick}
              className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas">
              {inner}
            </button>
          ) : (
            <div key={s.label} className="flex items-center gap-3 px-4 py-3.5">{inner}</div>
          );
        })}
      </div>

      {/* Toolbar — scope chips · search · status */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', ...SCOPE_ORDER] as const).map(s => {
            const isActive = scopeFilter === s;
            const label = s === 'all' ? 'All scopes' : SCOPE_META[s].label;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScopeFilter(s)}
                aria-pressed={isActive}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors cursor-pointer ${isActive ? 'bg-brand-600 text-white' : 'border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-brand-300 hover:text-ink-700'}`}
              >
                {label}
                <span className={`text-[10px] tabular-nums ${isActive ? 'text-white/70' : 'text-ink-400'}`}>{scopeCounts[s]}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search memories"
              className="h-9 w-[220px] rounded-md border border-canvas-border bg-canvas-elevated pl-8 pr-3 text-[12px] text-ink-800 placeholder:text-ink-400 transition-colors focus:border-brand-300 focus:outline-none"
            />
          </div>
          <StatusFilterMenu active={statusFilter} counts={statusCounts} onChange={setStatusFilter} />
        </div>
      </div>

      {/* The registry */}
      {!anyVisible ? (
        <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated py-10 text-center">
          <p className="text-[13px] font-semibold text-ink-700">No memories match this filter.</p>
          <button
            type="button"
            onClick={() => { setScopeFilter('all'); setStatusFilter('all'); setQuery(''); }}
            className="mt-1.5 cursor-pointer text-[12px] font-semibold text-brand-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map(g => {
            const meta = SCOPE_META[g.scope];
            const ScopeIcon = SCOPE_ICON[g.scope];
            const clearedHere = g.scope === 'personal' && personalCleared;
            if (g.items.length === 0 && !clearedHere) return null;
            return (
              <section key={g.scope} aria-label={`${meta.label} memories`}>
                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <ScopeIcon size={13} className="translate-y-px text-ink-400" />
                    <h2 className="text-[12px] font-bold uppercase tracking-wider text-ink-800">{meta.label}</h2>
                    <span className="rounded-full border border-canvas-border bg-canvas-elevated px-1.5 py-px text-[10px] font-bold tabular-nums text-ink-500">
                      {g.items.filter(m => !isGone(m)).length}
                    </span>
                  </span>
                  <span className="text-[11px] text-ink-400">{meta.note}</span>
                  {g.scope === 'personal' && !personalCleared && (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="ml-auto cursor-pointer text-[11px] font-semibold text-risk hover:underline"
                    >
                      Forget everything about me
                    </button>
                  )}
                </div>
                {clearedHere ? (
                  <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated px-6 py-8 text-center">
                    <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-canvas">
                      <Brain size={18} className="text-ink-400" />
                    </div>
                    <p className="text-[13px] font-semibold text-ink-700">IRA has forgotten everything about you.</p>
                    <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-ink-400">
                      New preferences will be proposed as you keep working — nothing returns without fresh evidence.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPersonalCleared(false)}
                      className="mt-2.5 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {g.items.map((m, i) =>
                      overrides[m.id]?.forgotten ? (
                        <ForgottenStrip key={m.id} memory={m} onUndo={() => undo(m.id)} />
                      ) : (
                        <MemoryRow
                          key={m.id}
                          memory={m}
                          index={i}
                          onOpen={() => setSelectedId(m.id)}
                          onRenew={() => renew(m.id)}
                        />
                      ),
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && !isGone(selected) && (
          <MemoryDrawer
            memory={selected}
            justRenewed={!!overrides[selected.id]?.renewedTo}
            onClose={() => setSelectedId(null)}
            onForget={() => { forget(selected.id); setSelectedId(null); }}
            onRenew={() => renew(selected.id)}
          />
        )}
      </AnimatePresence>

      {/* Forget-everything confirm — destructive, so it always asks */}
      <ConfirmationModal
        open={confirmClear}
        title="Forget everything about you?"
        description="IRA will stop using all personal preferences, vocabulary and corrections it has learned. Team, engagement and organization memories are not affected."
        confirmLabel="Forget everything"
        tone="destructive"
        onConfirm={() => { setPersonalCleared(true); setConfirmClear(false); setSelectedId(null); }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
