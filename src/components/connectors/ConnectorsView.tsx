/**
 * Connectors — the catalogue section of the Platform Usage page.
 *
 * What this build can look up outside the workspace's own data, and what each
 * lookup costs.
 *
 * A section, not a page: the shell above it owns the title, the subhead, the
 * page tabs and the scroll. What is left here is the family switch and the
 * catalogue itself, so the two families sit on one screen rather than a nav
 * entry apart. A new provider family arrives as another pill.
 *
 * Read-only, deliberately. Nothing here authorises spend or holds a
 * credential: the operation list, its prices and its gates are build constants
 * that come with a release rather than with a setting.
 */

import { useState } from 'react';
import { Boxes, Landmark } from 'lucide-react';
import TabPills from '../ui/TabPills';
import GovtApisTab from './GovtApisTab';

/** Families that have a panel behind them. `family` is typed to these alone,
 *  so an unbuilt one cannot become the selection by accident. */
type FamilyId = 'govt-apis';

export default function ConnectorsView() {
  const [family, setFamily] = useState<FamilyId>('govt-apis');

  return (
    <section className="space-y-4 pb-2">
      <TabPills
        tabs={[
          { id: 'govt-apis', label: 'Govt APIs', icon: Landmark },
          // Announced but not built. Rendered disabled rather than hidden: a
          // missing family reads as a feature nobody thought of, a disabled one
          // reads as a feature that is coming.
          { id: 'erp', label: 'ERP connectors', icon: Boxes, pending: true, pendingLabel: 'Not built yet' },
        ]}
        current={family}
        onSelect={id => setFamily(id as FamilyId)}
      />

      {family === 'govt-apis' ? <GovtApisTab /> : null}
    </section>
  );
}
