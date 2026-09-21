import { Bell, AtSign, ShieldAlert, FileText, Briefcase, Workflow, LayoutDashboard, type LucideIcon } from 'lucide-react';
import type { AppNotification } from './types';

// One small icon says which part of the platform spoke. Neutral by default —
// the whole system reads as one voice; only a critical event or a mention
// earns a tint, and even then a quiet one.
const MODULE_ICON: Record<string, LucideIcon> = {
  'Exceptions Management': ShieldAlert,
  'ATR & Reports': FileText,
  'Engagements': Briefcase,
  'Workflows & Data': Workflow,
  'Dashboards': LayoutDashboard,
};
const CATEGORY_ICON: Record<string, LucideIcon> = {
  exception: ShieldAlert, report: FileText, engagement: Briefcase, workflow: Workflow,
};

type NotificationTone = 'neutral' | 'critical' | 'mention';

function toneOf(n: AppNotification): NotificationTone {
  if (n.mention) return 'mention';
  if (n.priority === 'P0' || n.severity === 'critical') return 'critical';
  return 'neutral';
}

// One quiet tile for everyone; only the glyph colour shifts for a critical
// event or a mention, so the list never turns into a wall of red.
const TONE: Record<NotificationTone, string> = {
  neutral: 'bg-paper-100 text-ink-600',
  critical: 'bg-paper-100 text-risk-700',
  mention: 'bg-paper-100 text-brand-700',
};

export default function NotificationIcon({ n, size = 'md' }: { n: AppNotification; size?: 'sm' | 'md' }) {
  const tone = toneOf(n);
  const Icon = tone === 'mention' ? AtSign : (n.module && MODULE_ICON[n.module]) || CATEGORY_ICON[n.category] || Bell;
  const box = size === 'sm' ? 'w-6 h-6 rounded-sm' : 'w-7 h-7 rounded-md';
  return (
    <span className={`${box} ${TONE[tone]} inline-flex items-center justify-center shrink-0`} aria-hidden="true">
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={1.75} />
    </span>
  );
}
