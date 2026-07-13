import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { computeSla } from './workflowEngine';

const TONE = {
  'on-track': { cls: 'bg-compliant-50 text-compliant-700', Icon: CheckCircle2 },
  'at-risk':  { cls: 'bg-mitigated-50 text-mitigated-700', Icon: Clock },
  'overdue':  { cls: 'bg-risk-50 text-risk-700',           Icon: AlertTriangle },
} as const;

/** SLA pill for a level/assignment — on-track / at-risk / overdue with a label. */
export default function SLABadge({ startIso, slaHours, compact = false }: { startIso: string; slaHours: number; compact?: boolean }) {
  const sla = computeSla(startIso, slaHours);
  const t = TONE[sla.state];
  return (
    <span
      title={`SLA ${slaHours}h · ${sla.label}`}
      className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[0.65625rem] font-semibold whitespace-nowrap ${t.cls}`}
    >
      <t.Icon size={10} />
      {compact ? sla.label : `SLA · ${sla.label}`}
    </span>
  );
}
