import { motion } from 'motion/react';
import { Gavel, UserCheck, CheckCircle2, XCircle, Circle, Bot, Hand, Workflow as WorkflowIcon, Cpu, Check, X } from 'lucide-react';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import type { Conclusion, Court, Nature, Role, Severity, TestResult, TrackConclusion } from './types';

const CONCLUSION_TONE: Record<Conclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'In progress': 'evidence', 'Not started': 'draft' };
export function ConclusionPill({ c }: { c: Conclusion }) { return <Pill tone={CONCLUSION_TONE[c]}>{c}</Pill>; }

const TRACK_TONE: Record<TrackConclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'Not tested': 'draft' };
export function TrackPill({ c }: { c: TrackConclusion }) { return <Pill tone={TRACK_TONE[c]}>{c}</Pill>; }

const SEVERITY_TONE: Record<Severity, Tone> = { 'Material Weakness': 'risk', 'Significant Deficiency': 'high', Deficiency: 'mitigated' };
export function SeverityPill({ s }: { s: Severity }) { return <Pill tone={SEVERITY_TONE[s]}>{s}</Pill>; }

export function NatureChip({ nature, small }: { nature: Nature; small?: boolean }) {
  const Icon = nature === 'Automated' ? WorkflowIcon : nature === 'IT-dependent' ? Cpu : Hand;
  const tone = nature === 'Automated' ? 'bg-evidence-50 border-evidence-100 text-evidence-700' : nature === 'IT-dependent' ? 'bg-brand-50 border-brand-100 text-brand-700' : 'bg-paper-50 border-canvas-border text-ink-600';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border font-semibold', tone, small ? 'px-1.5 h-5 text-[10px]' : 'px-2 h-[22px] text-[0.65625rem]')}>
      <Icon size={small ? 9 : 10} />{nature}
    </span>
  );
}

export function ResultChip({ result }: { result: TestResult }) {
  if (result === 'Pass') return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-compliant-700"><CheckCircle2 size={13} /> Pass</span>;
  if (result === 'Fail') return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-risk-700"><XCircle size={13} /> Fail</span>;
  return <span className="inline-flex items-center gap-1 text-[12px] text-ink-400"><Circle size={11} /> Not tested</span>;
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
  none: { tone: 'compliant', label: 'Closed', Icon: CheckCircle2 },
};
export function CourtBadge({ court, fromRole }: { court: Court; fromRole?: Role }) {
  const c = COURT[court];
  const label = court === 'auditor' && fromRole && fromRole !== 'auditor' ? 'Auditor'
    : court === 'risk-owner' && fromRole === 'risk-owner' ? 'You'
    : c.label;
  return <span className="inline-flex items-center gap-1"><c.Icon size={12} className="text-ink-400" /><Pill tone={c.tone}>{label}</Pill></span>;
}

// ─── role switcher (demo affordance) ─────────────────────────────────────────────
const ROLE_ICON: Record<Role, typeof Gavel> = { auditor: Gavel, 'risk-owner': UserCheck };
const ROLE_NAME: Record<Role, string> = { auditor: 'Auditor', 'risk-owner': 'Risk Owner' };
export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="inline-flex items-center p-1 rounded-xl bg-paper-50 border border-canvas-border">
      {(['auditor', 'risk-owner'] as Role[]).map(r => {
        const Icon = ROLE_ICON[r];
        const active = role === r;
        return (
          <button key={r} onClick={() => onChange(r)} className={cn('relative inline-flex items-center gap-2 px-3 h-8 rounded-lg text-[12.5px] font-semibold transition-colors cursor-pointer', active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700')}>
            {active && <motion.span layoutId="icfr-role-pill" className="absolute inset-0 rounded-lg bg-canvas-elevated shadow-[0_2px_8px_-3px_rgba(15,8,30,0.25)] ring-1 ring-brand-100" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
            <span className="relative inline-flex items-center gap-1.5"><Icon size={14} />{ROLE_NAME[r]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Bar({ value, total, tone = 'bg-brand-500' }: { value: number; total: number; tone?: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-paper-100 overflow-hidden"><div className={cn('h-full transition-all', tone)} style={{ width: `${pct}%` }} /></div>
      <span className="text-[11px] tabular-nums text-ink-500 font-medium w-12 text-right">{value}/{total}</span>
    </div>
  );
}

export { Bot };
