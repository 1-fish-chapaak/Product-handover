import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Gavel, UserCheck, ShieldCheck, CheckCircle2, XCircle, Circle, Bot, Hand, Workflow as WorkflowIcon, Cpu, Check, X, ChevronDown, AlertCircle, AlertTriangle } from 'lucide-react';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import type { Conclusion, Court, Nature, Role, Severity, TestResult, TrackConclusion } from './types';

const CONCLUSION_TONE: Record<Conclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'In progress': 'evidence', 'Not started': 'draft' };
// one word for one state: the 'Not started' conclusion WEARS "Not tested" — the
// same label the tracks, the RACM roll-up and the Risk Register use
export function ConclusionPill({ c }: { c: Conclusion }) { return <Pill tone={CONCLUSION_TONE[c]}>{c === 'Not started' ? 'Not tested' : c}</Pill>; }

const TRACK_TONE: Record<TrackConclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'Not tested': 'draft' };
export function TrackPill({ c }: { c: TrackConclusion }) { return <Pill tone={TRACK_TONE[c]}>{c}</Pill>; }

const SEVERITY_TONE: Record<Severity, Tone> = { 'Material Weakness': 'risk', 'Significant Deficiency': 'high', Deficiency: 'mitigated' };
export function SeverityPill({ s }: { s: Severity }) { return <Pill tone={SEVERITY_TONE[s]}>{s}</Pill>; }

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
  /** One grey sentence under the title — what the score means and what gates on it. */
  explainer?: string;
  gate?: boolean;
  forceRed?: boolean;
};

export const ragColor = (m: RagMeterDef): string =>
  m.forceRed || m.pct < 40 ? 'var(--color-risk-500)' : m.pct < (m.gate ? 100 : 80) ? 'var(--color-high-400)' : 'var(--color-compliant-500)';
const ragWord = (m: RagMeterDef): string => (ragColor(m).includes('risk') ? 'red' : ragColor(m).includes('high') ? 'amber' : 'green');

/** Confidence scores in a 3-column grid — each card carries the big ring with
 *  the status word beside it, then a bold "label — detail" title and a
 *  one-line explainer; the whole card tints with its RAG state. */
export function RagStrip({ meters }: { meters: RagMeterDef[] }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {meters.map(m => {
        const state = ragWord(m);
        const tint = state === 'red' ? 'border-risk-200 bg-risk-50/50'
          : state === 'amber' ? 'border-high-200 bg-high-50/50'
          : 'border-compliant-200 bg-compliant-50/50';
        const statusCls = state === 'red' ? 'text-risk-700' : state === 'amber' ? 'text-high-700' : 'text-compliant-700';
        const StatusIcon = state === 'red' ? AlertTriangle : state === 'amber' ? AlertCircle : CheckCircle2;
        const statusWord = state === 'red' ? 'Needs attention' : state === 'amber' ? 'In progress' : m.pct === 100 ? 'Complete' : 'On track';
        return (
          <div key={m.label} role="img" aria-label={`${m.label} ${m.pct}% — ${state}`}
            className={cn('rounded-2xl border p-4 flex items-start gap-3.5', tint)}>
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 44 44" className="w-14 h-14 -rotate-90">
                <circle cx="22" cy="22" r="18" fill="var(--color-canvas-elevated)" stroke="var(--color-paper-200)" strokeWidth="5.5" />
                <circle cx="22" cy="22" r="18" fill="none" stroke={ragColor(m)} strokeWidth="5.5" strokeLinecap="round" strokeDasharray={`${(m.pct / 100) * 113} 113`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums text-ink-900">{m.pct}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-ink-900 leading-snug">{m.label}</div>
                  <div className="text-[12px] font-semibold text-ink-700 mt-0.5">{m.detail}</div>
                </div>
                <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] font-bold shrink-0', statusCls)}>
                  <StatusIcon size={14} /> {statusWord}
                </span>
              </div>
              {m.explainer && <p className="text-[11.5px] text-ink-500 mt-1 leading-relaxed">{m.explainer}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { Bot };
