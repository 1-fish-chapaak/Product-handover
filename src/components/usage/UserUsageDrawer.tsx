/**
 * Platform Usage — member drill-down drawer.
 *
 * Read-only detail for one member: identity, activity trend over the selected
 * range, module mix, AI stats, and their real audit-log events from the
 * current session. All numbers derive from the same row the table shows, so
 * the drawer always reconciles with the list. Managing the person happens in
 * Administration (footer link) — never here.
 */

import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import Drawer from '../shared/Drawer';
import { StatusBadge, ActionBadge } from '../shared/StatusBadge';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { getRole } from '../../data/rbac';
import type { AuditLog } from '../../context/AdminDataContext';
import {
  userDailySeries, userModuleMix, liveLogsToday, SEGMENT_LABELS,
  type UserUsageRow, type UsageDay, type EngagementSegment,
} from '../../data/platform-usage';

const fmt = (n: number) => n.toLocaleString('en-US');

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.6875rem] font-semibold text-ink-500 uppercase tracking-[0.14em] mb-2.5">{children}</div>;
}

export default function UserUsageDrawer({
  row, days, logs, rangeDays, segment, onClose,
}: {
  row: UserUsageRow;
  days: UsageDay[];
  logs: AuditLog[];
  rangeDays: number;
  /** The member's engagement segment for this range (computed by the view). */
  segment?: EngagementSegment;
  onClose: () => void;
}) {
  const { user } = row;
  const roleName = getRole(user.roleId)?.name ?? '—';
  const series = userDailySeries(row, days);
  const mix = userModuleMix(row);
  const mixMax = Math.max(1, ...mix.map(m => m.count));
  const sessionEvents = liveLogsToday(logs).filter(l => l.user === user.name).slice(0, 5);

  return (
    <Drawer
      title={user.name}
      subtitle={user.email}
      width="max-w-[520px]"
      onClose={onClose}
    >
      {/* Identity */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-canvas-border">
        <InitialsAvatar name={user.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.875rem] font-semibold text-ink-900">{roleName}</span>
            <StatusBadge status={user.status.toLowerCase()} />
            {segment && (
              <span className="inline-flex items-center px-2 h-6 rounded-full border border-canvas-border bg-canvas text-[0.6875rem] font-medium text-ink-600 whitespace-nowrap">
                {SEGMENT_LABELS[segment]}{segment === 'Power' ? ' user' : ''}
              </span>
            )}
          </div>
          <div className="text-[0.75rem] text-ink-500 mt-0.5">
            {user.team === '—' ? 'No team' : user.team}
            <span className="mx-1.5 text-ink-300">·</span>
            Last active <span className={`font-mono tabular-nums ${user.lastLogin === 'Never' ? 'italic' : ''}`}>{user.lastLogin}</span>
          </div>
        </div>
      </div>

      {/* Activity over the range */}
      <div className="py-5 border-b border-canvas-border">
        <SectionLabel>Activity · last {rangeDays} days</SectionLabel>
        <div className="flex items-center gap-6 mb-3">
          <div>
            <div className="text-[1.25rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(row.actions)}</div>
            <div className="text-[0.6875rem] text-ink-500 mt-1">Actions</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(row.aiQueries)}</div>
            <div className="text-[0.6875rem] text-ink-500 mt-1">AI queries</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(row.downloads)}</div>
            <div className="text-[0.6875rem] text-ink-500 mt-1">Downloads</div>
          </div>
        </div>
        {row.actions > 0 ? (
          <ResponsiveContainer width="100%" height={88}>
            <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="userDrawerFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6A12CD" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6A12CD" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="actions" stroke="#6A12CD" strokeWidth={1.5} fill="url(#userDrawerFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[0.8125rem] text-ink-400">No activity in this range.</p>
        )}
      </div>

      {/* Module mix */}
      {mix.length > 0 && (
        <div className="py-5 border-b border-canvas-border">
          <SectionLabel>Module mix</SectionLabel>
          <div className="space-y-3">
            {mix.map(({ module, count }) => (
              <div key={module}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[0.75rem] font-medium text-ink-700">{module}</span>
                  <span className="text-[0.75rem] text-ink-500 tabular-nums">{fmt(count)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-brand-50 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(3, (count / mixMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* This session */}
      <div className="py-5">
        <SectionLabel>This session</SectionLabel>
        {sessionEvents.length > 0 ? (
          <div className="space-y-3">
            {sessionEvents.map(ev => (
              <div key={ev.id} className="flex items-start gap-2.5">
                <ActionBadge action={ev.action} />
                <div className="min-w-0 flex-1">
                  <div className="text-[0.8125rem] text-ink-800 leading-snug">{ev.description}</div>
                  <div className="text-[0.6875rem] text-ink-400 font-mono tabular-nums mt-0.5">{ev.timestamp.split(' ')[1]}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.8125rem] text-ink-400">No activity in this session yet.</p>
        )}
      </div>
    </Drawer>
  );
}
