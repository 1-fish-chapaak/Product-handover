import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Gavel, UserCheck, ShieldCheck, CheckCircle2, XCircle, Circle, Bot, Hand, Workflow as WorkflowIcon, Cpu, Check, X, ChevronDown, AlertCircle, AlertTriangle, MinusCircle } from 'lucide-react';
// Cpu is the module's icon for "this runs on a machine" — the nature chip uses it
// too, which is what makes the ITGC banner read as being about the same thing.
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import type { Conclusion, Court, ExceptionGrade, FileOrigin, Nature, Role, TestResult, TrackConclusion } from './types';

const CONCLUSION_TONE: Record<Conclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'In progress': 'evidence', 'Not started': 'draft' };
// one word for one state: the 'Not started' conclusion WEARS "Not tested" — the
// same label the tracks, the RACM roll-up and the Risk Register use
export function ConclusionPill({ c }: { c: Conclusion }) { return <Pill tone={CONCLUSION_TONE[c]}>{c === 'Not started' ? 'Not tested' : c}</Pill>; }

const TRACK_TONE: Record<TrackConclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'Not tested': 'draft' };
export function TrackPill({ c }: { c: TrackConclusion }) { return <Pill tone={TRACK_TONE[c]}>{c}</Pill>; }

// Four outcomes, not three: Clearly Trivial is what the engine returns when the
// exposure sits under the de-minimis floor, and it reads as its own grade because
// the ladder stopped there — it was never evaluated down to a deficiency.
const SEVERITY_TONE: Record<ExceptionGrade, Tone> = { 'Material Weakness': 'risk', 'Significant Deficiency': 'high', Deficiency: 'mitigated', 'Clearly Trivial': 'draft' };
export function SeverityPill({ s }: { s: ExceptionGrade }) { return <Pill tone={SEVERITY_TONE[s]}>{s}</Pill>; }

/** The house switch. Lifted here because the control page, the rules editor and
 *  the scope table all need the same one. `disabled` matters on a locked control:
 *  the store silently refuses the patch, so the switch has to look refused. */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={cn('toggle', on && 'on', disabled && 'opacity-40 cursor-not-allowed')} />;
}

export function NatureChip({ nature, small }: { nature: Nature; small?: boolean }) {
  const Icon = nature === 'Automated' ? WorkflowIcon : nature === 'IT-dependent' ? Cpu : Hand;
  const tone = nature === 'Automated' ? 'bg-evidence-50 border-evidence-100 text-evidence-700' : nature === 'IT-dependent' ? 'bg-brand-50 border-brand-100 text-brand-700' : 'bg-paper-50 border-canvas-border text-ink-600';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border font-semibold whitespace-nowrap', tone, small ? 'px-1.5 h-5 text-[0.625rem]' : 'px-2 h-[22px] text-[0.65625rem]')}>
      <Icon size={small ? 9 : 10} />{nature}
    </span>
  );
}

export function ResultChip({ result }: { result: TestResult }) {
  if (result === 'Pass') return <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-compliant-700"><CheckCircle2 size={13} /> Pass</span>;
  if (result === 'Fail') return <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-risk-700"><XCircle size={13} /> Fail</span>;
  return <span className="inline-flex items-center gap-1 text-[0.75rem] text-ink-400"><Circle size={11} /> Not tested</span>;
}

// ─── The tickmark — auditor's signature mark on a tested item ────────────────────
export function Tickmark({ result, size = 18 }: { result: TestResult | 'Effective' | 'Ineffective'; size?: number }) {
  const pass = result === 'Pass' || result === 'Effective';
  const fail = result === 'Fail' || result === 'Ineffective';
  return (
    <span
      className={cn('sox-tick inline-flex items-center justify-center font-mono font-bold select-none', pass ? 'sox-tick-ok' : fail ? 'sox-tick-ko' : 'sox-tick-none')}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
      aria-label={typeof result === 'string' ? result : ''}
    >
      {pass ? '✓' : fail ? '✗' : '–'}
    </span>
  );
}

// ─── The auditor's stamp — pressed onto the page on conclusion ────────────────────
export function Stamp({ result, size = 'sm', animate = true }: { result: 'Effective' | 'Ineffective'; size?: 'sm' | 'lg'; animate?: boolean }) {
  const ok = result === 'Effective';
  const lg = size === 'lg';
  const cls = cn('stamp', ok ? 'stamp-ok' : 'stamp-ko', lg && 'stamp-lg');
  const inner = <>{ok ? <Check size={lg ? 17 : 12} strokeWidth={3} /> : <X size={lg ? 17 : 12} strokeWidth={3} />} {result}</>;
  if (!animate) return <span className={cls}>{inner}</span>;
  return (
    <motion.span className={cls}
      initial={{ scale: lg ? 1.9 : 1.45, opacity: 0, rotate: -17 }}
      animate={{ scale: 1, opacity: lg ? 1 : 0.94, rotate: -7 }}
      transition={{ type: 'spring', stiffness: 340, damping: 13 }}
    >{inner}</motion.span>
  );
}

// ─── The baton — whose court is the ball in ──────────────────────────────────────
const COURT: Record<Court, { tone: Tone; label: string; Icon: typeof Gavel }> = {
  auditor: { tone: 'info', label: 'Your court', Icon: Gavel },
  'risk-owner': { tone: 'mitigated', label: 'Risk owner', Icon: UserCheck },
  reviewer: { tone: 'evidence', label: 'Reviewer', Icon: ShieldCheck },
  none: { tone: 'compliant', label: 'Closed', Icon: CheckCircle2 },
};
export function CourtBadge({ court, fromRole }: { court: Court; fromRole?: Role }) {
  const c = COURT[court];
  const label = court === 'auditor' && fromRole && fromRole !== 'auditor' ? 'Auditor'
    : court === 'risk-owner' && fromRole === 'risk-owner' ? 'You'
    : court === 'reviewer' && fromRole === 'reviewer' ? 'Your court'
    : c.label;
  return <span className="inline-flex items-center gap-1"><c.Icon size={12} className="text-ink-400" /><Pill tone={c.tone}>{label}</Pill></span>;
}

// ─── role switcher (demo affordance) ─────────────────────────────────────────────
const ROLE_ICON: Record<Role, typeof Gavel> = { auditor: Gavel, 'risk-owner': UserCheck, reviewer: ShieldCheck };
const ROLE_NAME: Record<Role, string> = { auditor: 'Auditor', 'risk-owner': 'Risk Owner', reviewer: 'Reviewer' };
export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="inline-flex items-center p-1 rounded-xl bg-paper-50 border border-canvas-border">
      {(['auditor', 'risk-owner', 'reviewer'] as Role[]).map(r => {
        const Icon = ROLE_ICON[r];
        const active = role === r;
        return (
          <button key={r} onClick={() => onChange(r)} className={cn('relative inline-flex items-center gap-2 px-3 h-8 rounded-lg text-[0.78125rem] font-semibold transition-colors cursor-pointer', active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700')}>
            {active && <motion.span layoutId="icfr-role-pill" className="absolute inset-0 rounded-lg bg-canvas-elevated shadow-[0_2px_8px_-3px_rgba(15,8,30,0.25)] ring-1 ring-brand-100" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
            <span className="relative inline-flex items-center gap-1.5"><Icon size={14} />{ROLE_NAME[r]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── owner persona picker — which first-line hat "You" wears in owner mode ───────
// The demo switcher's second level: person-lane, not role-lane. Only rendered
// while Viewing as Risk Owner; every owner surface scopes to this name.
export function OwnerPicker({ owner, options, onChange }: { owner: string; options: string[]; onChange: (o: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);          // keyboard-highlighted option (aria-activedescendant target)
  const triggerRef = useRef<HTMLButtonElement | null>(null);   // focus stays on the trigger the whole time the menu is open
  const listRef = useRef<HTMLDivElement | null>(null);
  const short = owner.split(' · ')[0];
  const last = options.length - 1;
  const optId = (i: number) => `owner-persona-opt-${i}`;

  // Keep the highlighted row in view. Focus never leaves the trigger — the active
  // option is tracked via aria-activedescendant, not roving DOM focus (matches ShareModal).
  useEffect(() => {
    if (open && activeIndex >= 0) (listRef.current?.children[activeIndex] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const openMenu = (index = Math.max(0, options.indexOf(owner))) => { setActiveIndex(index); setOpen(true); };
  const closeMenu = (returnFocus = false) => { setOpen(false); setActiveIndex(-1); if (returnFocus) triggerRef.current?.focus(); };
  const select = (o: string) => { onChange(o); closeMenu(true); };

  return (
    <div className="relative">
      <button ref={triggerRef} onClick={() => { if (!open) openMenu(); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); open ? setActiveIndex(i => Math.min(last, i + 1)) : openMenu(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); open ? setActiveIndex(i => Math.max(0, i - 1)) : openMenu(last); }
          else if (!open) return;                                                    // closed: let Enter/Space open via native click
          else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
          else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (activeIndex >= 0 && options[activeIndex]) select(options[activeIndex]); }
          else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
          else if (e.key === 'End') { e.preventDefault(); setActiveIndex(last); }
          else if (e.key === 'Tab') closeMenu();                                      // dismiss and let focus flow to the next control
        }}
        aria-label="Owner persona" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? 'owner-persona-menu' : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optId(activeIndex) : undefined}
        title={`Acting as ${owner}`}
        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[12px] font-semibold text-ink-700 hover:border-mitigated-300 hover:text-mitigated-700 transition-colors cursor-pointer">
        <UserCheck size={13} className="text-mitigated-600" /> as {short}<ChevronDown size={12} className="text-ink-400" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => closeMenu()} />
            <motion.div ref={listRef} id="owner-persona-menu" role="menu" aria-label="Owner persona"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 mt-1.5 z-20 w-64 max-h-72 overflow-y-auto rounded-xl border border-canvas-border bg-canvas-elevated shadow-[0_16px_40px_-16px_rgba(15,8,30,.4)] p-1">
              {options.map((o, i) => (
                <button key={o} id={optId(i)} role="menuitemradio" aria-checked={o === owner} tabIndex={-1}
                  onClick={() => select(o)} onMouseEnter={() => setActiveIndex(i)}
                  className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] cursor-pointer flex items-center gap-2', i === activeIndex && 'bg-paper-50', o === owner ? 'text-mitigated-700 font-semibold' : 'text-ink-700')}>
                  {o === owner ? <Check size={12} /> : <span className="w-3" />}{o}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Breadcrumb for the SOX drill-in pages, in the Process Hub trail's language:
 * mono, a back arrow on the first crumb only, then slash-separated steps up.
 * With `onBack`, the arrow instead stands alone before the crumbs as a
 * one-level-up button, and the first crumb stays a plain link.
 * A drilled-in surface (the RACM matrix) drops the engagement header, so this
 * line carries the whole "where am I" job and every step back out.
 */
export function SoxBreadcrumb({ items, onBack }: { items: { label: string; onClick?: () => void }[]; onBack?: () => void }) {
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-[0.75rem] tracking-tight flex items-center gap-1.5 min-w-0 mb-3">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back"
          className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 rounded-sm">
          <ArrowLeft size={12} />
        </button>
      )}
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-ink-300" aria-hidden>/</span>}
            {item.onClick && !last ? (
              <button type="button" onClick={item.onClick}
                className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 rounded-sm">
                {i === 0 && !onBack && <ArrowLeft size={12} className="shrink-0" />}{item.label}
              </button>
            ) : (
              <span className="text-ink-700 truncate" aria-current={last ? 'page' : undefined}>{item.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Bar({ value, total, tone = 'bg-brand-500' }: { value: number; total: number; tone?: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-paper-100 overflow-hidden"><div className={cn('h-full transition-all', tone)} style={{ width: `${pct}%` }} /></div>
      <span className="text-[0.6875rem] tabular-nums text-ink-500 font-medium w-12 text-right">{value}/{total}</span>
    </div>
  );
}

// ─── RAG meters — red / amber / green rings shared by the dossier and Overview ───
// One rule everywhere: red below 40, amber to 79, green from 80 — except gate
// metrics (they lock a conclusion, so green only at 100) and forceRed (an
// ineffective conclusion is red no matter the percentage).
export type RagMeterDef = {
  label: string;
  pct: number;
  detail: string;
  gate?: boolean;
  forceRed?: boolean;
  /** Nothing to measure yet — no required elements, no attributes, no controls.
   *  Zero out of zero still computes 0%, but reading that as red would put a
   *  control nobody has set up next to one whose every check failed. This says
   *  "not set up" in neutral grey instead, and the arc draws nothing. */
  empty?: boolean;
  /** The arithmetic behind the number, revealed when the card is opened. One
   *  line: what is divided by what. The counting rules that go with it live as
   *  comments beside each meter — they belong to whoever maintains the score,
   *  not to the reader checking a percentage. */
  formula?: string;
};

export const ragColor = (m: RagMeterDef): string =>
  m.empty ? 'var(--color-ink-300)'
    : m.forceRed || m.pct < 40 ? 'var(--color-risk-500)' : m.pct < (m.gate ? 100 : 80) ? 'var(--color-high-400)' : 'var(--color-compliant-500)';
const ragWord = (m: RagMeterDef): string => (m.empty ? 'none' : ragColor(m).includes('risk') ? 'red' : ragColor(m).includes('high') ? 'amber' : 'green');

/** One confidence score as a card that opens.
 *
 *  SHUT it is the reading: a ring carrying the percentage and the score's name,
 *  nothing else. Every card is then the same height, so a row of them scans as
 *  one line of numbers rather than four paragraphs of different lengths.
 *
 *  OPEN it is the arithmetic and nothing else: the fraction, the status, and one
 *  line saying what is divided by what. Neither a prose paragraph nor a list of
 *  counting rules — a reader who opens a score wants the sum, and the longer the
 *  body ran the less alike the four open cards looked.
 *
 *  Colour is spent on exceptions only: a red or amber score tints its whole card
 *  so it pulls the eye out of the row, while a healthy score sits on the plain
 *  card surface. Three green washes side by side shout as loudly as the one card
 *  that actually needs reading. */
export function RagCard({ m }: { m: RagMeterDef; /** @deprecated the card no longer stacks — it opens */ stacked?: boolean }) {
  const [open, setOpen] = useState(false);
  const state = ragWord(m);
  const tint = state === 'red' ? 'border-risk-200 bg-risk-50/50'
    : state === 'amber' ? 'border-high-200 bg-high-50/40'
    : 'border-canvas-border bg-canvas-elevated';
  const statusCls = state === 'none' ? 'text-ink-400' : state === 'red' ? 'text-risk-700' : state === 'amber' ? 'text-high-700' : 'text-compliant-700';
  const StatusIcon = state === 'none' ? MinusCircle : state === 'red' ? AlertTriangle : state === 'amber' ? AlertCircle : CheckCircle2;
  const statusWord = state === 'none' ? 'Not set up'
    : state === 'red' ? 'Needs attention' : state === 'amber' ? 'In progress' : m.pct === 100 ? 'Complete' : 'On track';
  // r=16 → circumference 100.5, so the dash length is all but the percentage
  // itself. A round cap on a zero-length arc draws a floating dot, so a score
  // of nothing draws no arc at all.
  const C = 2 * Math.PI * 16;
  const bodyId = `rag-${m.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  // Height, by state. Shut, the card sizes to itself — every shut card is the
  // same height anyway, and stretching them to whichever neighbour is open would
  // leave empty boxes around it. Open, it fills the row, so several open cards
  // read as one block rather than four ragged columns.
  return (
    <div className={cn('rounded-xl border transition-colors', open ? 'h-full' : 'self-start', tint)}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={bodyId}
        aria-label={m.empty ? `${m.label} — not set up` : `${m.label} ${m.pct}% — ${state}`}
        className="w-full min-h-[4.75rem] text-left p-3.5 flex items-center gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 rounded-xl">
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 40 40" className="w-12 h-12 -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-paper-200)" strokeWidth="4" />
            {!m.empty && m.pct > 0 && (
              <circle cx="20" cy="20" r="16" fill="none" stroke={ragColor(m)} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(m.pct / 100) * C} ${C}`} />
            )}
          </svg>
          <span className={cn('absolute inset-0 flex items-center justify-center text-[0.6875rem] font-bold tabular-nums', m.empty ? 'text-ink-300' : 'text-ink-900')}>{m.empty ? '—' : `${m.pct}%`}</span>
        </div>
        <div className="text-[0.8125rem] font-bold text-ink-900 leading-snug min-w-0 flex-1">{m.label}</div>
        <ChevronDown size={15} className={cn('shrink-0 text-ink-400 transition-transform', open && 'rotate-180')} />
      </button>
      {/* Fade-and-lift, never a height animation: the body is a formula and four
          or five rules, and an animated height that measures a beat early cuts
          the last rule in half. Nothing here is tall enough to need the reveal
          to be gradual. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={bodyId} key="body" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}>
            <div className="px-3.5 pb-3.5 pt-0.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[0.75rem] font-semibold text-ink-700 min-w-0">{m.detail}</div>
                <span className={cn('inline-flex items-center gap-1 text-[0.6875rem] font-bold shrink-0', statusCls)}>
                  <StatusIcon size={12} /> {statusWord}
                </span>
              </div>
              {m.formula && (
                <div className="mt-2.5 rounded-lg border border-canvas-border bg-paper-50/70 px-3 py-2.5">
                  <div className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">How this is counted</div>
                  <div className="mt-1 font-mono text-[0.6875rem] leading-relaxed text-ink-800">{m.formula}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The scores side by side, one column each — the same height as each other shut,
 *  and the same height as each other open. Four of them break to two rows of two
 *  rather than squeezing a fourth column onto a laptop. */
export function RagStrip({ meters }: { meters: RagMeterDef[] }) {
  return (
    <div className={cn('grid gap-2.5', meters.length === 4 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3')}>
      {meters.map(m => <RagCard key={m.label} m={m} />)}
    </div>
  );
}

/**
 * The ITGC cascade at engagement level — the blast radius, on the two screens
 * where somebody would otherwise never learn it happened.
 *
 * One IT general control concluded ineffective withdraws "test of one" from
 * every automated and IT-dependent control in the engagement: their operating
 * tests come back and their samples resize. That is a large, silent change made
 * from a completely different page, so it is said here, with the count it
 * affects, the control that caused it, and the way to both.
 *
 * Rendered by the caller only when `failed.length > 0` — a banner that renders
 * itself empty is a banner nobody trusts the absence of.
 */
export function ItgcCascadeBanner({ failed, affected, onOpenControl, onShowAffected }: {
  failed: { id: string; code: string; description: string }[];
  affected: number;
  onOpenControl: (id: string) => void;
  onShowAffected?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-mitigated-200 bg-mitigated-50/60 p-4 flex items-start gap-3">
      <Cpu size={16} className="text-mitigated-700 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[0.8125rem] font-bold text-mitigated-800">
          Test of one is withdrawn across the engagement
        </h3>
        <p className="text-[0.75rem] text-ink-700 leading-relaxed mt-1">
          {failed.length === 1 ? 'An IT general control' : `${failed.length} IT general controls`} concluded ineffective, so{' '}
          <b className="font-semibold text-ink-900">{affected}</b> automated and IT-dependent control{affected === 1 ? '' : 's'} lost
          the one-instance shortcut — population, sample and TOE are back on them, and their samples are sized like manual controls.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {failed.map(f => (
            <button key={f.id} onClick={() => onOpenControl(f.id)} title={f.description}
              className="inline-flex items-center gap-1.5 max-w-full px-2 h-[22px] rounded-md border border-mitigated-200 bg-canvas-elevated text-[0.6875rem] font-semibold text-mitigated-800 hover:border-mitigated-400 transition-colors cursor-pointer">
              <span className="font-mono">{f.code}</span>
              <span className="truncate font-medium text-ink-600">{f.description}</span>
            </button>
          ))}
          {onShowAffected && affected > 0 && (
            <button onClick={onShowAffected}
              className="inline-flex items-center gap-1 px-2 h-[22px] rounded-md text-[0.6875rem] font-bold text-mitigated-800 hover:bg-mitigated-100 transition-colors cursor-pointer">
              Show the {affected} affected <ChevronDown size={12} className="-rotate-90" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The two-answer question, wherever a file enters the audit.
 *
 *  Deliberately not a dropdown: two answers, both weighty, neither a default.
 *  Shared by the control-level upload here and the audit-level upload on
 *  Configuration, so the question reads identically wherever it is put. */
export function OriginPicker({ value, onPick, disabled }: { value?: FileOrigin; onPick: (o: FileOrigin) => void; disabled?: boolean }) {
  const OPTIONS: { id: FileOrigin; hint: string }[] = [
    { id: 'System export', hint: 'Pulled straight out of the system of record' },
    { id: 'Client-prepared', hint: 'Assembled by the client before it reached you' },
  ];
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {OPTIONS.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" disabled={disabled} onClick={() => onPick(o.id)}
            className={cn('text-left rounded-lg border px-3 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              on ? 'border-brand-300 bg-brand-50' : 'border-canvas-border bg-canvas-elevated enabled:hover:border-ink-300 cursor-pointer')}>
            <span className={cn('flex items-center gap-1.5 text-[0.78125rem] font-semibold', on ? 'text-brand-700' : 'text-ink-800')}>
              {on && <Check size={12} className="shrink-0" />}{o.id}
            </span>
            <span className="block text-[0.65625rem] text-ink-400 mt-0.5 leading-snug">{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export { Bot };

/** A header cell with a resize grip on its right edge. Module-level on purpose:
 *  declared inside a register it would remount on every keystroke and slam the
 *  open column-filter menu shut. */
export function Th({ width, onResize, title, children }: {
  width: number; onResize: (e: React.MouseEvent) => void; title?: string; children: React.ReactNode;
}) {
  return (
    <th style={{ width }} title={title} className="relative">
      {children}
      <span onMouseDown={onResize} onClick={e => e.stopPropagation()} className="reg-grip" aria-hidden />
    </th>
  );
}
