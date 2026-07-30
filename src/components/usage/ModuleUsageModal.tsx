/**
 * Platform Usage — the area drill-down, for an area with no section behind it.
 *
 * Every real area of the product now opens ONE modal: the section modal, which
 * carries this usage panel at the top and that area's inventory underneath. Two
 * pop-ups for one area — usage from Top areas, inventory from Sections — was the
 * page telling you about Reports in two places and never both at once.
 *
 * This modal survives for exactly one case: 'Other', the bucket an unrecognised
 * module string falls into. 'Other' has usage (it is real activity) and no
 * inventory (there is no register behind a name nothing maps), so the usage panel
 * IS the whole story. It is also the case that should be rare by design — 'Other'
 * filling up means a screen forgot to register itself, and the point of the
 * bucket is that this becomes visible instead of silently inflating a real area.
 */

import Modal from '../shared/Modal';
import ModuleUsagePanel from './ModuleUsagePanel';
import type { UsageModule, UsageDay, UserUsageRow } from '../../data/platform-usage';

export default function ModuleUsageModal({
  module, days, priorDays, totalActions, rows, rangeDays, onClose,
}: {
  module: UsageModule;
  days: UsageDay[];
  priorDays: UsageDay[];
  totalActions: number;
  rows: UserUsageRow[];
  rangeDays: number;
  onClose: () => void;
}) {
  return (
    <Modal
      title={module}
      subtitle={`Activity in the last ${rangeDays} days. This area has no register behind it.`}
      width="max-w-[560px]"
      onClose={onClose}
      ariaLabel={`${module} usage`}
    >
      <ModuleUsagePanel
        module={module}
        days={days}
        priorDays={priorDays}
        totalActions={totalActions}
        rows={rows}
        rangeDays={rangeDays}
      />
    </Modal>
  );
}
