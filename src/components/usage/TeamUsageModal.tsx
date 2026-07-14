/**
 * Platform Usage — team drill-down modal.
 *
 * A team's members ranked by activity in the selected range, with the team's
 * totals. Numbers are the same per-member rows the Users lens shows, summed —
 * the two lenses always reconcile. Read-only; managing the team happens in
 * Administration.
 */

import Modal from '../shared/Modal';
import { InitialsAvatar } from '../admin/AdminPrimitives';
import { Eyebrow } from './usageChrome';
import { getRole } from '../../data/rbac';
import type { UserUsageRow } from '../../data/platform-usage';

const fmt = (n: number) => n.toLocaleString('en-US');

export default function TeamUsageModal({
  team, members, rangeDays, onClose,
}: {
  team: string;
  /** The team's member rows, any order — sorted by actions here. */
  members: UserUsageRow[];
  rangeDays: number;
  onClose: () => void;
}) {
  const sorted = [...members].sort((a, b) => b.actions - a.actions);
  const actions = members.reduce((s, m) => s + m.actions, 0);
  const aiQueries = members.reduce((s, m) => s + m.aiQueries, 0);

  return (
    <Modal
      title={team}
      subtitle={`${members.length} member${members.length !== 1 ? 's' : ''} · last ${rangeDays} days`}
      width="max-w-[560px]"
      onClose={onClose}
    >
      {/* Team totals */}
      <div className="flex items-center gap-6 pb-5 border-b border-canvas-border">
        <div>
          <div className="text-[1.5rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(actions)}</div>
          <div className="text-[0.6875rem] text-ink-500 mt-1">Actions</div>
        </div>
        <div>
          <div className="text-[1.5rem] font-bold text-ink-900 tabular-nums leading-none">{fmt(aiQueries)}</div>
          <div className="text-[0.6875rem] text-ink-500 mt-1">AI queries</div>
        </div>
      </div>

      {/* Members ranked by activity */}
      <div className="py-5">
        <Eyebrow className="mb-2.5">Members</Eyebrow>
        <div className="space-y-3">
          {sorted.map(m => (
            <div key={m.user.email} className="flex items-center gap-2.5">
              <InitialsAvatar name={m.user.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{m.user.name}</div>
                <div className="text-[0.6875rem] text-ink-400 truncate">{getRole(m.user.roleId)?.name ?? '—'}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[0.8125rem] font-semibold text-ink-900 tabular-nums">{fmt(m.actions)}</div>
                <div className="text-[0.625rem] text-ink-400 tabular-nums">{fmt(m.aiQueries)} AI</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
