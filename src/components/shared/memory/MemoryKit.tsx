// ─── Memory grammar kit — the nine components every surface composes ────────
//
// Design plan §03 ("Memory across the platform", approved 9 Aug 2026): memory
// is one product, not six features. Surfaces never invent their own memory UI;
// they place these pieces. The constitution the kit enforces:
//   · always attributed — every mark opens MemoryPeek, one anatomy everywhere
//   · applied is visible — chips/badges/receipts, never silent application
//   · personal learns instantly with undo; shared proposes into My Queue
//   · warnings not errors (drift blocks trust, not the run); rules never
//     offer an override
//   · demote/decay, never delete — everything just-learned can be undone
//
// All components are self-contained (own popover state) so host surfaces wire
// zero plumbing beyond the memory row and their local handlers.

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain, Check, ChevronDown, ChevronRight, CircleSlash, Lock,
  Sparkles, TriangleAlert, Undo2, X,
} from 'lucide-react';
import {
  KIND_META, SCOPE_META, SURFACE_META,
  type PlatformMemory,
} from '../../../data/memoryStore';

// ─── Deep links ─────────────────────────────────────────────────────────────

/** Open the registry focused on one memory row (App.tsx routes the event). */
export function navigateToMemory(id: string) {
  window.dispatchEvent(new CustomEvent('app:navigate-view', {
    detail: { view: 'knowledge-hub', tab: 'learn', focusId: id },
  }));
}

/** Open Smart Learn without a row focus. */
export function navigateToSmartLearn() {
  window.dispatchEvent(new CustomEvent('app:navigate-view', {
    detail: { view: 'knowledge-hub', tab: 'learn' },
  }));
}

// ─── 2 · MemoryPeek — the one "why am I seeing this" anatomy ────────────────

export function MemoryPeekPanel({ memory, onClose, onCorrect, onSkip, align = 'left' }: {
  memory: PlatformMemory;
  onClose: () => void;
  /** Seeds the exact question memory spared (AM10). Hidden for rules. */
  onCorrect?: () => void;
  /** "Skip this time" — this application only. */
  onSkip?: () => void;
  align?: 'left' | 'right';
}) {
  const kind = KIND_META[memory.kind];
  const scope = SCOPE_META[memory.scope];
  const isRule = memory.kind === 'rule';
  const kicker = isRule ? 'Rule — enforced' : memory.scope === 'organization' ? 'Enterprise memory' : 'From memory';
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className={`absolute z-50 mt-2 w-[340px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-3.5 text-left ${align === 'right' ? 'right-0' : 'left-0'}`}
        role="dialog" aria-label="Why am I seeing this"
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[0.625rem] font-bold uppercase tracking-[0.08em] ${isRule ? 'text-evidence-700' : 'text-brand-700'}`}>{kicker}</span>
          {isRule && <Lock size={10} className="text-evidence-700" />}
        </div>
        <p className="mt-1.5 text-[0.8125rem] font-medium leading-snug text-ink-900">{memory.statement}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[0.625rem] font-bold text-brand-700">
            {kind.label} · {scope.label}
          </span>
          {memory.confidence != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-compliant-50 px-2 py-0.5 text-[0.625rem] font-semibold text-compliant-700">
              <Check size={9} strokeWidth={3} /> {Math.round(memory.confidence * 100)}% still applies
            </span>
          )}
          {memory.renewDue && memory.reviewBy && (
            <span className="inline-flex items-center rounded-full bg-mitigated-50 px-2 py-0.5 text-[0.625rem] font-semibold text-mitigated-700">Review due {memory.reviewBy}</span>
          )}
        </div>
        <div className="mt-2.5 border-t border-canvas-border pt-2 text-[0.6875rem] leading-relaxed text-ink-500">
          {memory.source} · {memory.learnedOn}
          {memory.approvedBy && <> · approved by {memory.approvedBy}</>}
          <span className="tabular-nums"> · recalled {memory.recallCount}×</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-canvas-border pt-2.5">
          {!isRule && onCorrect && (
            <button type="button" onClick={() => { onCorrect(); onClose(); }}
              className="inline-flex h-7 items-center rounded-md border border-canvas-border px-2.5 text-[0.6875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
              Not right? Correct it
            </button>
          )}
          {!isRule && onSkip && (
            <button type="button" onClick={() => { onSkip(); onClose(); }}
              className="inline-flex h-7 items-center rounded-md px-2 text-[0.6875rem] font-medium text-ink-500 hover:text-ink-700 transition-colors cursor-pointer">
              Skip this time
            </button>
          )}
          <button type="button" onClick={() => { onClose(); navigateToMemory(memory.id); }}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
            Manage <ChevronRight size={11} />
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── 1 · MemoryChip — the mark a memory leaves when it acts ─────────────────

export function MemoryChip({ memory, form = 'badge', label, onRemove, onCorrect, align, className = '' }: {
  memory: PlatformMemory;
  /** filter = removable default · badge = annotation · definition = first-use chip. */
  form?: 'filter' | 'badge' | 'definition';
  /** Override the chip text (defaults derive from the statement). */
  label?: string;
  /** Filter form only — remove for this session. */
  onRemove?: () => void;
  onCorrect?: () => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = label ?? memory.statement;
  const base = 'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors cursor-pointer';
  const tone = form === 'filter'
    ? 'border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300'
    : form === 'definition'
      ? 'border-evidence-200 bg-evidence-50 text-evidence-700 hover:border-evidence-300'
      : 'border-canvas-border bg-canvas-elevated text-ink-500 hover:border-brand-200 hover:text-ink-700';
  return (
    <span className={`relative inline-flex max-w-full ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} title="Why am I seeing this?"
        className={`${base} ${tone}`}>
        <Brain size={11} className="shrink-0 opacity-70" />
        <span className="truncate">{text}</span>
        {form === 'filter' && onRemove && (
          <span
            role="button" tabIndex={0} aria-label="Remove for this session"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onRemove(); } }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-brand-100 cursor-pointer"
          >
            <X size={10} strokeWidth={2.5} />
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <span className="absolute left-0 top-full block">
            <MemoryPeekPanel memory={memory} align={align} onClose={() => setOpen(false)} onCorrect={onCorrect} />
          </span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ─── 3 · MemoryOffer — ask before applying, with a quantified stake ─────────

export function MemoryOffer({ memory, title, stake, primaryLabel, onAccept, acceptedNote, onNever, kicker = 'IRA noticed', className = '' }: {
  memory?: PlatformMemory;
  title: string;
  /** The payoff line — offers without a stake don't ship (§03). */
  stake: string;
  primaryLabel: string;
  onAccept: () => void;
  /** Receipt copy once accepted ("Replayed from memory — ₹0 AI cost"). */
  acceptedNote: string;
  onNever?: () => void;
  kicker?: string;
  className?: string;
}) {
  const [state, setState] = useState<'offered' | 'accepted' | 'declined' | 'never'>('offered');
  const [peek, setPeek] = useState(false);
  if (state === 'declined') return null;
  if (state === 'never') {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas px-3.5 py-2 ${className}`}>
        <CircleSlash size={13} className="shrink-0 text-ink-400" />
        <span className="min-w-0 flex-1 text-[0.75rem] text-ink-500">Noted — this won’t be offered again. The routine decays; it isn’t deleted.</span>
        <button type="button" onClick={() => setState('offered')} className="text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">Undo</button>
      </div>
    );
  }
  if (state === 'accepted') {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-compliant/30 bg-compliant-50 px-3.5 py-2.5 ${className}`}>
        <Check size={14} strokeWidth={3} className="shrink-0 text-compliant-700" />
        <span className="min-w-0 flex-1 text-[0.75rem] font-semibold text-compliant-700">{acceptedNote}</span>
      </div>
    );
  }
  return (
    <div className={`relative rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Sparkles size={11} className="text-brand-600" />
        <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-brand-700">{kicker}</span>
        {memory && (
          <button type="button" onClick={() => setPeek(p => !p)} className="ml-auto text-[0.6875rem] font-medium text-ink-400 hover:text-brand-700 transition-colors cursor-pointer">
            Why?
          </button>
        )}
      </div>
      <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-ink-900">{title}</p>
      <p className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-500">{stake}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setState('accepted'); onAccept(); }}
          className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3 text-[0.75rem] font-semibold text-white hover:bg-brand-500 transition-colors cursor-pointer">
          {primaryLabel}
        </button>
        <button type="button" onClick={() => setState('declined')}
          className="inline-flex h-8 items-center rounded-md border border-canvas-border bg-canvas-elevated px-3 text-[0.75rem] font-semibold text-ink-600 hover:border-brand-300 transition-colors cursor-pointer">
          Not now
        </button>
        <button type="button" onClick={() => { setState('never'); onNever?.(); }}
          className="inline-flex h-8 items-center px-1.5 text-[0.6875rem] font-medium text-ink-400 hover:text-ink-600 transition-colors cursor-pointer">
          Don’t offer this
        </button>
      </div>
      <AnimatePresence>
        {peek && memory && (
          <span className="absolute right-3 top-9 block">
            <MemoryPeekPanel memory={memory} align="right" onClose={() => setPeek(false)} />
          </span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 4 · JustLearned — the receipt (undo-rate metric lives here) ────────────

export function JustLearned({ statement, shared, queueNote, onUndo, className = '' }: {
  statement: string;
  /** Shared scopes: nothing applied yet — receipt says where the proposal went. */
  shared?: boolean;
  queueNote?: string;
  onUndo: () => void;
  className?: string;
}) {
  const [undone, setUndone] = useState(false);
  if (undone) {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-2 ${className}`}>
        <Undo2 size={12} className="shrink-0 text-ink-400" />
        <span className="text-[0.75rem] text-ink-500">Undone — nothing was kept.</span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${shared ? 'border-canvas-border bg-canvas-elevated' : 'border-compliant/30 bg-compliant-50'} ${className}`}>
      <span className={`text-[0.625rem] font-bold uppercase tracking-[0.08em] shrink-0 ${shared ? 'text-ink-500' : 'text-compliant-700'}`}>
        {shared ? 'Proposed' : 'Learned'}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.75rem] text-ink-700">{statement}</span>
      {shared && (
        <span className="shrink-0 rounded-full bg-mitigated-50 px-2 py-0.5 text-[0.625rem] font-bold text-mitigated-700">{queueNote ?? '→ My Queue'}</span>
      )}
      <button type="button" onClick={() => { setUndone(true); onUndo(); }}
        className="inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">
        <Undo2 size={11} /> Undo
      </button>
    </div>
  );
}

// ─── 5 · MemoryGuard — interception: drift, wrong file, bad data, hard rules ─

export function MemoryGuard({ tone, kicker, title, body, primaryLabel, onPrimary, secondaryLabel, onSecondary, memory, className = '' }: {
  /** warn = amber, blocks trust not the run · rule = enforced, no override. */
  tone: 'warn' | 'rule';
  kicker?: string;
  title: string;
  body: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  memory?: PlatformMemory;
  className?: string;
}) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const warn = tone === 'warn';
  if (resolved) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-compliant/30 bg-compliant-50 px-3.5 py-2.5 ${className}`}>
        <Check size={14} strokeWidth={3} className="shrink-0 text-compliant-700" />
        <span className="text-[0.75rem] font-semibold text-compliant-700">{resolved} Logged to the audit trail.</span>
      </div>
    );
  }
  return (
    <div className={`relative rounded-xl border px-4 py-3 ${warn ? 'border-mitigated-200 bg-mitigated-50/60' : 'border-evidence-200 bg-evidence-50/60'} ${className}`}>
      <div className="flex items-center gap-1.5">
        {warn ? <TriangleAlert size={12} className="text-mitigated-700" /> : <Lock size={11} className="text-evidence-700" />}
        <span className={`text-[0.625rem] font-bold uppercase tracking-[0.08em] ${warn ? 'text-mitigated-700' : 'text-evidence-700'}`}>
          {kicker ?? (warn ? 'Check before trusting' : 'Rule applied — cannot override')}
        </span>
        {memory && (
          <button type="button" onClick={() => setPeek(p => !p)} className="ml-auto text-[0.6875rem] font-medium text-ink-400 hover:text-brand-700 transition-colors cursor-pointer">Why?</button>
        )}
      </div>
      <p className="mt-1 text-[0.8125rem] font-semibold leading-snug text-ink-900">{title}</p>
      <div className="mt-0.5 text-[0.75rem] leading-relaxed text-ink-600">{body}</div>
      {warn && (primaryLabel || secondaryLabel) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {primaryLabel && (
            <button type="button" onClick={() => { onPrimary?.(); setResolved(`${primaryLabel} — done.`); }}
              className="inline-flex h-8 items-center rounded-md bg-ink-900 px-3 text-[0.75rem] font-semibold text-white hover:bg-ink-800 transition-colors cursor-pointer">
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && (
            <button type="button" onClick={() => { onSecondary?.(); setResolved(`${secondaryLabel} — flagged for the next run.`); }}
              className="inline-flex h-8 items-center rounded-md border border-canvas-border bg-canvas-elevated px-3 text-[0.75rem] font-semibold text-ink-600 hover:border-mitigated-300 transition-colors cursor-pointer">
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
      <AnimatePresence>
        {peek && memory && (
          <span className="absolute right-3 top-9 block">
            <MemoryPeekPanel memory={memory} align="right" onClose={() => setPeek(false)} />
          </span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 6 · CaptureCard — documentation at the moment of confusion ─────────────

export function CaptureCard({ answerSummary, kindLabel, scopeLabel, shared, onSave, className = '' }: {
  /** What the user just told us ("Payment amount is `amt_pd`"). */
  answerSummary: ReactNode;
  kindLabel: string;
  scopeLabel: string;
  /** Shared scopes propose into My Queue instead of activating. */
  shared?: boolean;
  onSave: () => void;
  className?: string;
}) {
  const [state, setState] = useState<'offered' | 'saved' | 'dismissed'>('offered');
  if (state === 'dismissed') return null;
  if (state === 'saved') {
    return (
      <div className={`flex items-center gap-2 rounded-lg border border-compliant/30 bg-compliant-50 px-3 py-2 ${className}`}>
        <Check size={13} strokeWidth={3} className="shrink-0 text-compliant-700" />
        <span className="text-[0.75rem] font-semibold text-compliant-700">
          {shared ? 'Proposed to shared memory — review lands in My Queue.' : 'Saved — IRA will never ask this again.'}
        </span>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border border-dashed border-brand-300 bg-brand-50/40 px-3.5 py-2.5 ${className}`}>
      <div className="flex items-center gap-1.5">
        <Brain size={11} className="text-brand-600" />
        <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-brand-700">Keep this?</span>
        <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 font-mono text-[0.625rem] font-bold text-brand-700">{kindLabel} · {scopeLabel}</span>
      </div>
      <div className="mt-1 text-[0.75rem] leading-relaxed text-ink-700">{answerSummary}</div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={() => { setState('saved'); onSave(); }}
          className="inline-flex h-7 items-center rounded-md bg-brand-600 px-2.5 text-[0.6875rem] font-semibold text-white hover:bg-brand-500 transition-colors cursor-pointer">
          {shared ? 'Propose — never ask again' : 'Save — never ask again'}
        </button>
        <button type="button" onClick={() => setState('dismissed')}
          className="inline-flex h-7 items-center px-1.5 text-[0.6875rem] font-medium text-ink-500 hover:text-ink-700 transition-colors cursor-pointer">
          Just this once
        </button>
      </div>
    </div>
  );
}

// ─── 7 · SinceYouLeft — re-entry digest + resume ────────────────────────────

export function SinceYouLeft({ kicker, headline, resume, onResume, className = '' }: {
  kicker: string;
  headline: ReactNode;
  resume?: string;
  onResume?: () => void;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-2.5 ${className}`}>
      <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-brand-700 shrink-0">{kicker}</span>
      <span className="min-w-0 flex-1 text-[0.8125rem] text-ink-700">{headline}</span>
      {resume && onResume && (
        <span className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[0.75rem] text-ink-400">{resume}</span>
          <button type="button" onClick={onResume}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 text-[0.6875rem] font-semibold text-brand-700 hover:border-brand-300 transition-colors cursor-pointer">
            Continue <ChevronRight size={11} />
          </button>
        </span>
      )}
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-ink-300 hover:text-ink-600 transition-colors cursor-pointer">
        <X size={12} />
      </button>
    </div>
  );
}

// ─── 9 · KnownIssuesFold — false positives leave findings, keep receipts ────

export function KnownIssuesFold({ count, note, children, className = '' }: {
  count: number;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <div className={`rounded-xl border border-canvas-border bg-canvas ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left cursor-pointer">
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex text-ink-400">
          <ChevronRight size={13} />
        </motion.span>
        <span className="text-[0.75rem] font-semibold text-ink-700">Known issues from memory ({count})</span>
        {note && <span className="hidden sm:inline min-w-0 flex-1 truncate text-[0.6875rem] text-ink-400">{note}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.25, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }}
            className="overflow-hidden">
            <div className="border-t border-canvas-border px-3.5 py-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Row helper — mono "fires in" chips used by registry-style rows ─────────

export function FiresInChips({ memory }: { memory: PlatformMemory }) {
  return (
    <span className="inline-flex items-center gap-1">
      {memory.firesIn.map(s => (
        <span key={s} className="rounded border border-canvas-border bg-canvas px-1 py-px font-mono text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-400">
          {SURFACE_META[s].label}
        </span>
      ))}
    </span>
  );
}
