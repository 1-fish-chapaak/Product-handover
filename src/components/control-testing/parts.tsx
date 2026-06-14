import { type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Loader2, CircleDot, CheckCircle2, XCircle, MinusCircle, FileText, Sheet, Image as ImageIcon, Bot, ClipboardCheck, UserCheck, Gavel } from 'lucide-react';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import {
  ROLE_LABEL,
  STAGE_LABEL,
  type AttributeMethod,
  type AutoVerdict,
  type ControlMethod,
  type ControlTest,
  type EvidenceFile,
  type OwnerVerdict,
  type Role,
  type SelfAssessment,
  type Stage,
  type TestResult,
} from './types';

// ─── status helpers ─────────────────────────────────────────────────────────────

export function controlStatus(c: ControlTest): { tone: Tone; label: string } {
  switch (c.stage) {
    case 'awaiting-self-assessment':
      return c.overdue ? { tone: 'risk', label: 'Overdue' } : { tone: 'mitigated', label: 'Self-assessment due' };
    case 'awaiting-owner-review':
      return { tone: 'evidence', label: 'Owner review' };
    case 'awaiting-audit':
      return { tone: 'info', label: 'Awaiting audit' };
    case 'audit-phase-1':
      return { tone: 'evidence', label: 'Audit · Phase 1' };
    case 'audit-phase-2':
      return { tone: 'evidence', label: 'Audit · Phase 2' };
    case 'concluded':
      return c.conclusion === 'Ineffective' ? { tone: 'risk', label: 'Ineffective' } : { tone: 'compliant', label: 'Effective' };
  }
}

export function ControlStatusPill({ c }: { c: ControlTest }) {
  const s = controlStatus(c);
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function StagePill({ stage }: { stage: Stage }) {
  const tone: Tone = stage === 'concluded' ? 'compliant' : stage === 'awaiting-self-assessment' ? 'mitigated' : 'evidence';
  return <Pill tone={tone}>{STAGE_LABEL[stage]}</Pill>;
}

const METHOD_TONE: Record<ControlMethod, Tone> = { Automated: 'evidence', 'Self-assessed': 'info', Hybrid: 'mitigated' };
export function MethodChip({ method }: { method: ControlMethod | AttributeMethod }) {
  return <Pill tone={METHOD_TONE[method as ControlMethod]}>{method}</Pill>;
}

export function ResultChip({ result }: { result: TestResult | null }) {
  if (!result) return <span className="inline-flex items-center gap-1 text-[12px] text-ink-400"><MinusCircle size={13} /> Not tested</span>;
  return result === 'Pass'
    ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-compliant-700"><CheckCircle2 size={13} /> Pass</span>
    : <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-risk-700"><XCircle size={13} /> Fail</span>;
}

const AUTO_TONE: Record<AutoVerdict, Tone> = { Pass: 'compliant', Fail: 'risk', Hold: 'mitigated' };
export function AutoVerdictChip({ verdict, confidence }: { verdict: AutoVerdict | null; confidence?: number }) {
  if (!verdict) return <Pill tone="draft">Not run</Pill>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Bot size={13} className="text-brand-600" />
      <Pill tone={AUTO_TONE[verdict]}>{verdict}</Pill>
      {confidence != null && <span className="text-[11px] text-ink-400 tabular-nums">{confidence}%</span>}
    </span>
  );
}

export function SelfAssessmentChip({ outcome }: { outcome: SelfAssessment | null }) {
  if (!outcome) return <span className="text-[12px] text-ink-400">—</span>;
  return <Pill tone={outcome === 'OK' ? 'compliant' : 'risk'}>{outcome}</Pill>;
}

export function OwnerVerdictChip({ verdict }: { verdict: OwnerVerdict | null }) {
  if (!verdict) return <span className="text-[12px] text-ink-400">—</span>;
  return <Pill tone={verdict === 'Pass' ? 'compliant' : 'risk'}>{verdict}</Pill>;
}

// ─── evidence ───────────────────────────────────────────────────────────────────

const EV_ICON: Record<EvidenceFile['kind'], typeof FileText> = { PDF: FileText, XLSX: Sheet, CSV: Sheet, IMG: ImageIcon };
export function EvidenceChip({ file }: { file: EvidenceFile }) {
  const Icon = EV_ICON[file.kind];
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full pl-1.5 pr-2 h-6 rounded-md bg-paper-50 border border-canvas-border text-[11.5px] text-ink-700" title={`${file.name} · ${file.uploadedBy} · ${file.uploadedAt}`}>
      <Icon size={12} className="text-ink-400 shrink-0" />
      <span className="truncate max-w-[160px] font-mono">{file.name}</span>
    </span>
  );
}

// ─── role switcher ──────────────────────────────────────────────────────────────

const ROLE_ICON: Record<Role, typeof UserCheck> = { performer: ClipboardCheck, owner: UserCheck, auditor: Gavel };

export function RoleSwitcher({ role, onChange, counts }: { role: Role; onChange: (r: Role) => void; counts: Record<Role, number> }) {
  return (
    <div className="inline-flex items-center p-1 rounded-xl bg-paper-50 border border-canvas-border">
      {(['performer', 'owner', 'auditor'] as Role[]).map((r) => {
        const Icon = ROLE_ICON[r];
        const active = role === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={cn(
              'relative inline-flex items-center gap-2 px-3.5 h-9 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer',
              active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            {active && (
              <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-canvas-elevated shadow-[0_2px_8px_-3px_rgba(15,8,30,0.25)] ring-1 ring-brand-100" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
            )}
            <span className="relative inline-flex items-center gap-2">
              <Icon size={15} />
              {ROLE_LABEL[r]}
              {counts[r] > 0 && (
                <span className={cn('inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-bold tabular-nums', active ? 'bg-brand-600 text-white' : 'bg-paper-200 text-ink-600')}>
                  {counts[r]}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── lifecycle stepper ──────────────────────────────────────────────────────────

const STEPS: { stage: Stage; short: string }[] = [
  { stage: 'awaiting-self-assessment', short: 'Self-assess' },
  { stage: 'awaiting-owner-review', short: 'Owner' },
  { stage: 'audit-phase-1', short: 'Phase 1' },
  { stage: 'audit-phase-2', short: 'Phase 2' },
  { stage: 'concluded', short: 'Conclude' },
];

function stageIndex(stage: Stage): number {
  if (stage === 'awaiting-audit') return 1.5; // between owner and phase 1
  return STEPS.findIndex((s) => s.stage === stage);
}

export function LifecycleStepper({ c }: { c: ControlTest }) {
  const current = stageIndex(c.stage);
  const failed = c.conclusion === 'Ineffective';
  return (
    <div className="flex items-center w-full">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = Math.floor(current) === i || (current === 1.5 && i === 1);
        const isConcludeFail = step.stage === 'concluded' && failed;
        return (
          <div key={step.stage} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-colors',
                  isConcludeFail && (done || active) ? 'bg-risk text-white' : done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-200' : 'bg-paper-100 text-ink-400',
                )}
              >
                {done ? <CheckCircle2 size={13} /> : active ? <CircleDot size={13} /> : i + 1}
              </span>
              <span className={cn('text-[10.5px] font-medium whitespace-nowrap', active ? 'text-ink-800' : done ? 'text-ink-600' : 'text-ink-400')}>{step.short}</span>
            </div>
            {i < STEPS.length - 1 && <span className={cn('h-px flex-1 mx-1.5 -mt-4', i < current ? 'bg-brand-300' : 'bg-paper-200')} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── async button ───────────────────────────────────────────────────────────────

export function AsyncButton({
  loading,
  disabled,
  onClick,
  children,
  icon,
  variant = 'primary',
  size = 'md',
  className,
}: {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const VAR: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-800 disabled:bg-brand-100 disabled:text-brand-300',
    secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:bg-canvas disabled:text-ink-400',
    outline: 'bg-canvas-elevated text-ink-700 border border-canvas-border hover:border-brand-300 disabled:bg-canvas disabled:text-ink-400',
    ghost: 'bg-transparent text-ink-500 hover:bg-brand-50 hover:text-brand-700 disabled:text-ink-300',
    destructive: 'bg-risk text-white hover:bg-risk-700 disabled:bg-risk-50 disabled:text-risk',
  };
  const SZ: Record<string, string> = { sm: 'h-7 text-[12.5px] px-3 gap-1.5', md: 'h-9 text-[13px] px-4 gap-2' };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn('inline-flex items-center justify-center rounded-lg font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed', VAR[variant], SZ[size], className)}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── workflow mini-table ────────────────────────────────────────────────────────

export function MiniTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-canvas-border">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-paper-50 border-b border-canvas-border">
            {columns.map((col) => (
              <th key={col} className="text-left font-semibold text-ink-500 px-3 py-1.5 whitespace-nowrap uppercase tracking-wide text-[10.5px]">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-canvas-border/60 last:border-0">
              {row.map((cell, ci) => {
                const danger = typeof cell === 'string' && /^(yes|bypass|single|no grn|fail)/i.test(cell.trim());
                return (
                  <td key={ci} className={cn('px-3 py-1.5 whitespace-nowrap font-mono tabular-nums', ci === 0 ? 'text-ink-800 font-semibold' : danger ? 'text-risk-700 font-semibold' : 'text-ink-600')}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── small section card ─────────────────────────────────────────────────────────

export function SectionCard({ title, icon, right, children, className }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-canvas-border bg-canvas-elevated', className)}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-canvas-border">
        <h3 className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-800">{icon}{title}</h3>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
