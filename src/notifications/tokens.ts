import type { LucideIcon } from 'lucide-react';
import { ShieldAlert, FileText, Briefcase, Workflow, LayoutDashboard } from 'lucide-react';
import type { NotificationModule } from './catalogue';

export const MODULE_ICON: Record<NotificationModule, LucideIcon> = {
  'Exceptions Management': ShieldAlert,
  'ATR & Reports': FileText, 'Engagements': Briefcase, 'Workflows & Data': Workflow, 'Dashboards': LayoutDashboard,
};
export const MODULE_TINT: Record<NotificationModule, string> = {
  'Exceptions Management': 'bg-risk-50 text-risk-700',
  'ATR & Reports': 'bg-paper-100 text-ink-700', 'Engagements': 'bg-mitigated-50 text-mitigated-700', 'Workflows & Data': 'bg-compliant-50 text-compliant-700', 'Dashboards': 'bg-draft-50 text-ink-600',
};
