import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MousePointerClick } from 'lucide-react';
import { KpiTile } from '../shared/KpiTile';
import { Skeleton } from '../shared/Skeleton';
import { RoleSwitcher } from './parts';
import { ControlList } from './ControlList';
import { ControlDetail } from './ControlDetail';
import { ROLE_LABEL, type Role } from './types';
import { queueForRole, statsForRole, useControlTesting } from './useControlTesting';

const ROLE_BLURB: Record<Role, string> = {
  performer: 'Perform each control on its frequency and attest OK / Not OK with evidence.',
  owner: 'Review what performers submitted — accept, or fail for insufficient documentation.',
  auditor: 'Independently test each control across Phase 1 and Phase 2, then conclude.',
};

export function ControlTestingWorkspace({ engagementName }: { engagementName?: string }) {
  const api = useControlTesting();
  const { controls, loading } = api;

  // Land on the first role that actually has work to do.
  const initialRole = useMemo<Role>(() => {
    const order: Role[] = ['performer', 'owner', 'auditor'];
    return order.find((r) => queueForRole(controls, r).actionable.length > 0) ?? 'auditor';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [role, setRole] = useState<Role>(initialRole);

  const counts = useMemo<Record<Role, number>>(
    () => ({
      performer: queueForRole(controls, 'performer').actionable.length,
      owner: queueForRole(controls, 'owner').actionable.length,
      auditor: queueForRole(controls, 'auditor').actionable.length,
    }),
    [controls],
  );

  const stats = useMemo(() => statsForRole(controls, role), [controls, role]);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const q = queueForRole(controls, initialRole);
    return q.actionable[0]?.controlId ?? controls[0]?.controlId ?? null;
  });

  const selected = controls.find((c) => c.controlId === selectedId) ?? null;

  const onChangeRole = (r: Role) => {
    setRole(r);
    // Jump selection to this role's first actionable control, for momentum.
    const q = queueForRole(controls, r);
    if (q.actionable.length > 0) setSelectedId(q.actionable[0]!.controlId);
  };

  return (
    <div className="space-y-5">
      {/* intro + role switcher */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[18px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Control Testing
          </h2>
          <p className="text-[13px] text-ink-500 mt-0.5 max-w-[560px]">
            One loop — self-assessment to independent audit — across {engagementName ?? 'this engagement'}.
            <span className="text-ink-700"> {ROLE_BLURB[role]}</span>
          </p>
        </div>
        <RoleSwitcher role={role} onChange={onChangeRole} counts={counts} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="list">
        <KpiTile index={0} label="Controls in scope" value={String(controls.length)} />
        <KpiTile index={1} label={`${ROLE_LABEL[role]} · needs you`} value={String(stats.actionable)} valueClassName={stats.actionable > 0 ? 'text-brand-700' : 'text-ink-900'} />
        <KpiTile index={2} label="In progress" value={String(stats.inFlight)} />
        <KpiTile index={3} label="Ineffective" value={String(stats.failed)} valueClassName={stats.failed > 0 ? 'text-risk-700' : 'text-ink-900'} />
      </div>

      {/* master / detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-[72vh] min-h-[560px]">
        <div className="rounded-2xl border border-canvas-border bg-paper-50/40 p-3 min-h-0">
          <ControlList controls={controls} role={role} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
        </div>

        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5 min-h-0 overflow-hidden">
          {loading ? (
            <DetailSkeleton />
          ) : selected ? (
            <AnimatePresence mode="wait">
              <motion.div key={selected.controlId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="h-full min-h-0">
                <ControlDetail control={selected} role={role} api={api} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-4"><MousePointerClick size={20} className="text-brand-700" /></div>
              <p className="text-[15px] font-semibold text-ink-800">Select a control</p>
              <p className="text-[13px] text-ink-500 mt-1 max-w-[320px]">Pick a control on the left to view its attributes, self-assessment trail, and testing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton width="w-28" height="h-3" /><Skeleton width="w-80" height="h-5" /></div>
        <Skeleton width="w-20" height="h-6" rounded="rounded-full" />
      </div>
      <Skeleton width="w-full" height="h-14" rounded="rounded-xl" />
      <Skeleton width="w-full" height="h-40" rounded="rounded-xl" />
      <Skeleton width="w-full" height="h-56" rounded="rounded-xl" />
    </div>
  );
}

// default export for convenient lazy import
export default ControlTestingWorkspace;
