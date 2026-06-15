import { motion } from 'motion/react';
import { Gavel, UserCheck, ShieldQuestion, CheckCircle2, XCircle, Circle, Bot, Hand, Workflow as WorkflowIcon } from 'lucide-react';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import { STAGE_LABEL, type Conclusion, type Court, type Nature, type Role, type Severity, type Stage, type TestResult } from './types';

const CONCLUSION_TONE: Record<Conclusion, Tone> = { Effective: 'compliant', Ineffective: 'risk', 'In progress': 'evidence', 'Not started': 'draft' };
export function ConclusionPill({ c }: { c: Conclusion }) { return <Pill tone={CONCLUSION_TONE[c]}>{c}</Pill>; }

export function StagePill({ stage }: { stage: Stage }) {
  const tone: Tone = stage === 'signed-off' ? 'compliant' : stage === 'concluded' ? 'evidence' : stage === 'remediation' ? 'high' : stage === 'pbc-requested' || stage === 'not-started' ? 'draft' : 'info';
  return <Pill tone={tone}>{STAGE_LABEL[stage]}</Pill>;
}

const SEVERITY_TONE: Record<Severity, Tone> = { 'Material Weakness': 'risk', 'Significant Deficiency': 'high', Deficiency: 'mitigated' };
export function SeverityPill({ s }: { s: Severity }) { return <Pill tone={SEVERITY_TONE[s]}>{s}</Pill>; }

export function NatureChip({ nature }: { nature: Nature }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 h-[22px] rounded-md border text-[0.65625rem] font-semibold', nature === 'Automated' ? 'bg-evidence-50 border-evidence-100 text-evidence-700' : 'bg-brand-50 border-brand-100 text-brand-700')}>
      {nature === 'Automated' ? <WorkflowIcon size={10} /> : <Hand size={10} />}{nature}
    </span>
  );
}

export function ResultChip({ result }: { result: TestResult }) {
  if (result === 'Pass') return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-compliant-700"><CheckCircle2 size={13} /> Pass</span>;
  if (result === 'Fail') return <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-risk-700"><XCircle size={13} /> Fail</span>;
  return <span className="inline-flex items-center gap-1 text-[12px] text-ink-400"><Circle size={11} /> Not tested</span>;
}

// ─── The baton — whose court is the ball in ──────────────────────────────────────

const COURT: Record<Court, { tone: Tone; label: string; Icon: typeof Gavel }> = {
  auditor: { tone: 'info', label: 'Your court', Icon: Gavel },
  'risk-owner': { tone: 'mitigated', label: 'Risk owner', Icon: UserCheck },
  reviewer: { tone: 'evidence', label: 'Reviewer', Icon: ShieldQuestion },
  none: { tone: 'compliant', label: 'Closed', Icon: CheckCircle2 },
};
export function CourtBadge({ court, fromRole }: { court: Court; fromRole?: Role }) {
  const c = COURT[court];
  // "Your court" only when the viewer's role matches; else name the holder.
  const label = court === 'auditor' && fromRole && fromRole !== 'auditor' ? 'Auditor'
    : court === 'risk-owner' && fromRole === 'risk-owner' ? 'You'
    : c.label;
  return <span className="inline-flex items-center gap-1"><c.Icon size={12} className="text-ink-400" /><Pill tone={c.tone}>{label}</Pill></span>;
}

// ─── role switcher (demo affordance) ─────────────────────────────────────────────

const ROLE_ICON: Record<Role, typeof Gavel> = { auditor: Gavel, reviewer: ShieldQuestion, 'risk-owner': UserCheck };
const ROLE_NAME: Record<Role, string> = { auditor: 'Auditor', reviewer: 'Reviewer', 'risk-owner': 'Risk Owner' };
export function RoleSwitcher({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  return (
    <div className="inline-flex items-center p-1 rounded-xl bg-paper-50 border border-canvas-border">
      {(['auditor', 'reviewer', 'risk-owner'] as Role[]).map(r => {
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
