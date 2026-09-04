// ─── Knowledge Hub — Smart Learn (the ONE platform memory registry) ─────────
//
// Decision D2 (9 Aug 2026): every memory — engagement, report, dashboard,
// source, all of it — lists HERE with the rest. The complexity rule that keeps
// the chrome calm: each axis gets exactly one job —
//   · SCOPE structures the page (sections, closest-to-you first, + Source)
//   · KIND badges the row (icon + label, never page structure)
//   · SURFACE ("fires in") filters — one Filter menu, no extra toolbar chrome
// Engagement and Source sections sub-group rows under their owning entity,
// collapsed with attention counts, so a lead scans headers, not sixty rows.
//
// Governance still follows scope-follows-surface: approvals in My Queue, org
// rules in Admin, personal forgets on the avatar menu. Rows here run only the
// safe inline actions (forget/retire, renew, undo) — all through the shared
// session layer (memorySession.ts) so every surface reflects each decision.

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  UserRound, Users, Briefcase, Building2, Database,
  SlidersHorizontal, BookOpen, Landmark, PenLine, ShieldCheck, Route, Repeat,
  Brain, Search, ChevronDown, ChevronRight, CalendarClock, Zap,
  Eye, Inbox, Info, Check, CircleSlash, Undo2, ArrowRight, Lock,
  ArrowUpRight, ScrollText, History, Clock, TriangleAlert, Filter,
} from 'lucide-react';
import Drawer from '../shared/Drawer';
import {
  SCOPE_META, SCOPE_ORDER, KIND_META, KIND_ORDER, SURFACE_META, SURFACE_ORDER,
  RECALLS_THIS_WEEK, RENEWAL_TARGET, entitiesForScope,
  type PlatformMemory, type MemoryScope, type MemoryKind, type MemorySurface,
} from '../../data/memoryStore';
import {
  useMemorySessionVersion, allMemories, isGone, decisionFor,
  forgetMemory, undoForget, renewMemory, isPersonalCleared, undoClearPersonal,
} from '../../data/memorySession';
import { FiresInChips } from '../shared/memory/MemoryKit';

// ─── Icon maps (meta stores lucide names; this surface binds them) ─────────

const SCOPE_ICON: Record<MemoryScope, React.ComponentType<{ size?: number; className?: string }>> = {
  personal: UserRound, team: Users, engagement: Briefcase, organization: Building2, source: Database,
};

const KIND_ICON: Record<MemoryKind, React.ComponentType<{ size?: number; className?: string }>> = {
  preference: SlidersHorizontal, vocabulary: BookOpen, fact: Landmark,
  correction: PenLine, decision: Route, routine: Repeat, rule: ShieldCheck,
};

// Personalization kinds carry brand; governed facts/decisions stay neutral;
// enforced rules read evidence-blue. Colour is a scanning aid, never the only
// signal — the kind label is always written out in the meta line.
const KIND_TINT: Record<MemoryKind, string> = {
  preference: 'bg-brand-50 text-brand-700',
  vocabulary: 'bg-brand-50 text-brand-700',
  correction: 'bg-brand-50 text-brand-700',
  routine: 'bg-brand-50 text-brand-700',
  fact: 'bg-canvas text-ink-500',
  decision: 'bg-canvas text-ink-500',
  rule: 'bg-evidence-50 text-evidence-700',
};

const SCOPE_PILL: Record<MemoryScope, string> = {
  personal: 'bg-brand-50 text-brand-700',
  team: 'bg-canvas text-ink-600',
  engagement: 'bg-canvas text-ink-600',
  organization: 'bg-evidence-50 text-evidence-700',
  source: 'bg-evidence-50 text-evidence-700',
};

type StatusFilterId = 'all' | 'active' | 'proposed' | 'review';
const STATUS_FILTERS: { id: StatusFilterId; label: string }[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'proposed', label: 'Awaiting approval' },
  { id: 'review', label: 'Review due' },
];

/** Deep-link into another surface without prop-drilling setView — the same
 *  CustomEvent the report modals use (App.tsx `app:navigate-view`). */
function navigateTo(view: string) {
  window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view } }));
}

// ─── How memory works (explainer strip) ─────────────────────────────────────

function MemoryExplainer() {
  const points = [
    { icon: Eye, title: 'Observed with evidence', body: 'IRA notices repeated preferences, corrections and decisions across sessions, runs and edits — and keeps the receipts for each.' },
    { icon: Inbox, title: 'Approved by humans', body: 'Anything shared needs a human yes. Proposals and renewals arrive in My Queue as badged work; personal memories stay yours.' },
    { icon: Zap, title: 'One shared store', body: 'Chat, runs, reports, dashboards and sources read the same store — an approval in one place changes what every surface applies.' },
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

// ─── Unified Filter menu — Status · Kind · Fires in (one control, D2 spec) ──

interface Filters {
  status: StatusFilterId;
  kind: 'all' | MemoryKind;
  surface: 'all' | MemorySurface;
}

function FilterSection<T extends string>({ title, options, active, onPick }: {
  title: string;
  options: { id: T; label: string; count: number }[];
  active: T;
  onPick: (id: T) => void;
}) {
  return (
    <div>
      <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">{title}</div>
      {options.map(o => {
        const checked = active === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            aria-pressed={checked}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-canvas transition-colors cursor-pointer"
          >
            <span className={`flex size-4 items-center justify-center rounded-full border transition-colors ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-canvas-border bg-canvas-elevated'}`}>
              {checked && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="flex-1 text-[12px] font-medium text-ink-800">{o.label}</span>
            <span className="text-[11px] tabular-nums text-ink-400">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilterMenu({ filters, onChange, live }: {
  filters: Filters;
  onChange: (f: Filters) => void;
  live: PlatformMemory[];
}) {
  const [open, setOpen] = useState(false);
  const activeCount = (filters.status !== 'all' ? 1 : 0) + (filters.kind !== 'all' ? 1 : 0) + (filters.surface !== 'all' ? 1 : 0);
  const statusCount = (f: StatusFilterId) =>
    f === 'all' ? live.length
      : f === 'proposed' ? live.filter(m => m.status === 'proposed').length
        : f === 'review' ? live.filter(m => m.renewDue).length
          : live.filter(m => m.status === 'active').length;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${open || activeCount > 0 ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
      >
        <Filter size={12} />
        Filter{activeCount > 0 && <span className="tabular-nums">· {activeCount}</span>}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-30 mt-2 max-h-[420px] w-[250px] overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-2"
            >
              <FilterSection
                title="Status"
                active={filters.status}
                onPick={id => onChange({ ...filters, status: id })}
                options={STATUS_FILTERS.map(f => ({ id: f.id, label: f.label, count: statusCount(f.id) }))}
              />
              <div className="my-1 h-px bg-canvas-border" />
              <FilterSection
                title="Kind"
                active={filters.kind}
                onPick={id => onChange({ ...filters, kind: id })}
                options={[
                  { id: 'all' as const, label: 'All kinds', count: live.length },
                  ...KIND_ORDER.map(k => ({ id: k, label: KIND_META[k].label, count: live.filter(m => m.kind === k).length })),
                ]}
              />
              <div className="my-1 h-px bg-canvas-border" />
              <FilterSection
                title="Fires in"
                active={filters.surface}
                onPick={id => onChange({ ...filters, surface: id })}
                options={[
                  { id: 'all' as const, label: 'All surfaces', count: live.length },
                  ...SURFACE_ORDER.map(s => ({ id: s, label: SURFACE_META[s].label, count: live.filter(m => m.firesIn.includes(s)).length })),
                ]}
              />
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
  const isProposed = memory.status === 'proposed';
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
        id={`memory-row-${memory.id}`}
        className="group w-full rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-left hover:border-brand-200 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${KIND_TINT[memory.kind]}`}>
            <KindIcon size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-snug text-ink-900">{memory.statement}</p>
            {isProposed && memory.pendingNote ? (
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                <span className="font-semibold text-ink-600">{kind.label}</span>
                <span className="text-ink-300"> · </span>
                {memory.pendingNote}
              </p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-ink-400">
                <span className="font-semibold text-ink-600">{kind.label}</span>
                <span className="text-ink-300">·</span>
                <FiresInChips memory={memory} />
                <span className="text-ink-300">·</span>
                <span>{memory.source}</span>
                <span className="text-ink-300">·</span>
                <span className="tabular-nums">Recalled {memory.recallCount}×</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            {memory.drifted && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mitigated-200 bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">
                <TriangleAlert size={10} /> Drifted
              </span>
            )}
            {isProposed && (
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
            {(memory.scope === 'organization' || memory.kind === 'rule') && (
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

// A forgotten/retired row collapses to a slim undo strip.
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
  const isProposed = memory.status === 'proposed';
  const isPersonal = memory.scope === 'personal';
  const isGoverned = memory.scope === 'organization' || memory.kind === 'rule';
  const version = memory.versions?.[0]?.version;

  const footer = (
    <>
      {isPersonal && (
        <button type="button" onClick={onForget}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-risk/30 px-3.5 text-[12px] font-semibold text-risk hover:bg-risk-50 transition-colors cursor-pointer">
          <CircleSlash size={13} /> Forget this memory
        </button>
      )}
      {!isPersonal && !isGoverned && !isProposed && (
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
      {isProposed && (
        <button type="button" onClick={() => navigateTo('my-queue')}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3.5 text-[12px] font-semibold text-white hover:bg-brand-500 transition-colors cursor-pointer">
          Review in My Queue <ArrowRight size={13} />
        </button>
      )}
      {isGoverned && (
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
      subtitle={<span className="font-mono text-[11px] text-ink-400">{memory.id} · {scope.label} scope{memory.entity ? ` · ${memory.entity.label}` : ''} · learned {memory.learnedOn}</span>}
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-6">
        {/* The memory itself */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3.5">
          <p className="text-[15px] font-medium leading-relaxed text-ink-900">{memory.statement}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${SCOPE_PILL[memory.scope]}`}>{scope.label}</span>
            {isProposed ? (
              <span className="inline-flex items-center rounded-full bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">Awaiting approval</span>
            ) : memory.status === 'retired' ? (
              <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-ink-500">Retired</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-compliant-50 px-2 py-0.5 text-[10px] font-bold text-compliant-700">Active</span>
            )}
            {memory.drifted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700"><TriangleAlert size={9} /> Schema drifted</span>
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

        {memory.drifted && (
          <div className="flex items-start gap-2 rounded-lg border border-mitigated-200 bg-mitigated-50 px-3 py-2.5">
            <TriangleAlert size={14} className="mt-px shrink-0 text-mitigated-700" />
            <span className="text-[12px] leading-relaxed text-mitigated-700">
              The schema this was written against changed ({memory.fingerprint}). Review it in the source’s drift list before the next run relies on it.
            </span>
          </div>
        )}

        {/* Facts about the fact */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
          <MetaCell label="Recalled">{memory.recallCount} times</MetaCell>
          <MetaCell label="Last recalled">{memory.lastRecalled}</MetaCell>
          {memory.approvedBy && <MetaCell label="Approved by">{memory.approvedBy}{memory.approvedOn ? ` · ${memory.approvedOn}` : ''}</MetaCell>}
          {memory.reviewBy && <MetaCell label="Review by">{memory.reviewBy}</MetaCell>}
          {memory.entity && <MetaCell label={memory.scope === 'source' ? 'Source' : 'Engagement'}>{memory.entity.label}</MetaCell>}
          <MetaCell label="Learned from">{memory.source}</MetaCell>
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

        {/* Where it fires — the "one store, many surfaces" contract, made real */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Zap size={13} className="text-ink-400" />
            <h3 className="text-[12px] font-bold text-ink-800">Fires in</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {memory.firesIn.map(r => (
              <span key={r} className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">{SURFACE_META[r].label}</span>
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

export default function SmartLearnView({ focusMemoryId }: { focusMemoryId?: string | null }) {
  useMemorySessionVersion();

  const [scopeFilter, setScopeFilter] = useState<'all' | MemoryScope>('all');
  const [filters, setFilters] = useState<Filters>({ status: 'all', kind: 'all', surface: 'all' });
  const [query, setQuery] = useState('');
  const [showExplainer, setShowExplainer] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  const memories = allMemories();
  const personalCleared = isPersonalCleared();
  const live = memories.filter(m => !isGone(m));

  // Deep-link focus ("Manage →" from any chip, or ?memory= in the URL):
  // open the row's drawer and expand its entity group.
  useEffect(() => {
    if (!focusMemoryId) return;
    const target = memories.find(m => m.id === focusMemoryId);
    if (!target) return;
    setSelectedId(focusMemoryId);
    if (target.entity) setOpenGroups(g => new Set([...g, `${target.scope}:${target.entity!.id}`]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMemoryId]);

  const matchesFilters = (m: PlatformMemory) => {
    if (filters.status === 'proposed' && m.status !== 'proposed') return false;
    if (filters.status === 'review' && !m.renewDue) return false;
    if (filters.status === 'active' && m.status !== 'active') return false;
    if (filters.kind !== 'all' && m.kind !== filters.kind) return false;
    if (filters.surface !== 'all' && !m.firesIn.includes(filters.surface)) return false;
    return true;
  };
  const matchesQuery = (m: PlatformMemory) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      m.statement.toLowerCase().includes(q) ||
      m.source.toLowerCase().includes(q) ||
      KIND_META[m.kind].label.toLowerCase().includes(q) ||
      (m.entity?.label.toLowerCase().includes(q) ?? false) ||
      m.firesIn.some(s => SURFACE_META[s].label.toLowerCase().includes(q))
    );
  };

  const groups = SCOPE_ORDER
    .filter(s => scopeFilter === 'all' || scopeFilter === s)
    .map(s => ({
      scope: s,
      items: memories.filter(m =>
        m.scope === s && matchesFilters(m) && matchesQuery(m) &&
        !(personalCleared && s === 'personal')),
    }));

  const scopeCounts = useMemo(() => {
    const counts = { all: live.length } as Record<'all' | MemoryScope, number>;
    SCOPE_ORDER.forEach(s => { counts[s] = live.filter(m => m.scope === s).length; });
    return counts;
  }, [live]);

  const proposedCount = live.filter(m => m.status === 'proposed').length;
  const reviewCount = live.filter(m => m.renewDue).length;

  const stats = [
    { label: 'Active memories', value: live.filter(m => m.status === 'active').length, tone: 'text-ink-900', Icon: Brain, iconWrap: 'bg-brand-50 text-brand-600' },
    { label: 'Awaiting approval', value: proposedCount, tone: proposedCount > 0 ? 'text-mitigated-700' : 'text-ink-900', Icon: Inbox, iconWrap: proposedCount > 0 ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-400', onClick: () => navigateTo('my-queue'), hint: 'Review in My Queue' },
    { label: 'Due for review', value: reviewCount, tone: reviewCount > 0 ? 'text-mitigated-700' : 'text-ink-900', Icon: CalendarClock, iconWrap: reviewCount > 0 ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-400' },
    { label: 'Recalls this week', value: RECALLS_THIS_WEEK, tone: 'text-ink-900', Icon: Zap, iconWrap: 'bg-compliant-50 text-compliant-700' },
  ] as const;

  const selected = selectedId ? memories.find(m => m.id === selectedId) : undefined;
  const anyVisible = groups.some(g => g.items.length > 0) || (personalCleared && groups.some(g => g.scope === 'personal'));

  const toggleGroup = (key: string) =>
    setOpenGroups(g => {
      const next = new Set(g);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const renderRows = (items: PlatformMemory[]) => (
    <div className="space-y-2">
      {items.map((m, i) =>
        decisionFor(m.id)?.forgotten ? (
          <ForgottenStrip key={m.id} memory={m} onUndo={() => undoForget(m)} />
        ) : (
          <MemoryRow
            key={m.id}
            memory={m}
            index={i}
            onOpen={() => setSelectedId(m.id)}
            onRenew={() => renewMemory(m)}
          />
        ),
      )}
    </div>
  );

  return (
    <div className="pb-8">
      {/* Intro row — what this registry is + page-level controls */}
      <div className="flex items-start justify-between gap-4 pb-4">
        <p className="mt-1 text-[13px] text-ink-500">
          Every memory <span className="font-semibold text-ink-800">IRA</span> holds — across chat, runs, engagements, reports, dashboards and data sources — in one place, traceable and governed. Worked where it fires; listed here.
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

      {/* Toolbar — scope chips · search · one Filter menu (zero net new chrome) */}
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
          <FilterMenu filters={filters} onChange={setFilters} live={live} />
        </div>
      </div>

      {/* The registry */}
      {!anyVisible ? (
        <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated py-10 text-center">
          <p className="text-[13px] font-semibold text-ink-700">No memories match this filter.</p>
          <button
            type="button"
            onClick={() => { setScopeFilter('all'); setFilters({ status: 'all', kind: 'all', surface: 'all' }); setQuery(''); }}
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
            // Engagement and Source sections sub-group under their entity —
            // collapsed headers carry the attention counts (D2 spec).
            const entities = entitiesForScope(g.scope, g.items);
            const grouped = (g.scope === 'engagement' || g.scope === 'source') && entities.length > 0;
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
                      onClick={() => undoClearPersonal()}
                      className="mt-2.5 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"
                    >
                      <Undo2 size={12} /> Undo
                    </button>
                  </div>
                ) : grouped ? (
                  <div className="space-y-2.5">
                    {entities.map(ent => {
                      const key = `${g.scope}:${ent.id}`;
                      const rows = g.items.filter(m => m.entity?.id === ent.id);
                      if (rows.length === 0) return null;
                      const liveRows = rows.filter(m => !isGone(m));
                      const pending = liveRows.filter(m => m.status === 'proposed').length;
                      const drifted = liveRows.filter(m => m.drifted).length;
                      const review = liveRows.filter(m => m.renewDue).length;
                      const open = openGroups.has(key);
                      return (
                        <div key={key} className="rounded-xl border border-canvas-border bg-canvas">
                          <button
                            type="button"
                            onClick={() => toggleGroup(key)}
                            aria-expanded={open}
                            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left cursor-pointer"
                          >
                            <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex text-ink-400">
                              <ChevronRight size={13} />
                            </motion.span>
                            <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-ink-800">{ent.label}</span>
                            <span className="rounded-full border border-canvas-border bg-canvas-elevated px-1.5 py-px text-[10px] font-bold tabular-nums text-ink-500">{liveRows.length}</span>
                            <span className="ml-auto flex items-center gap-1.5">
                              {pending > 0 && <span className="rounded-full bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">{pending} pending</span>}
                              {drifted > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700"><TriangleAlert size={9} /> {drifted} drifted</span>}
                              {review > 0 && <span className="rounded-full bg-mitigated-50 px-2 py-0.5 text-[10px] font-bold text-mitigated-700">{review} review due</span>}
                            </span>
                          </button>
                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ height: { duration: 0.25, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-canvas-border p-2.5">{renderRows(rows)}</div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                    {/* Rows without an entity (e.g. team routines shown under a scope filter) */}
                    {g.items.some(m => !m.entity) && renderRows(g.items.filter(m => !m.entity))}
                  </div>
                ) : (
                  renderRows(g.items)
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
            justRenewed={!!decisionFor(selected.id)?.renewedTo}
            onClose={() => setSelectedId(null)}
            onForget={() => { forgetMemory(selected); setSelectedId(null); }}
            onRenew={() => renewMemory(selected)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
