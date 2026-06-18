/**
 * Permission gate for UI affordances.
 *
 *   <Gated permission="wf_create">              → hides children if not allowed
 *   <Gated permission="wf_run" mode="disable">  → renders children disabled+dimmed
 *
 * `mode="hide"` (default) suits primary create buttons; `mode="disable"` suits
 * row actions you want to keep visible but inert. For imperative checks, use
 * `useCan()` from CurrentUserContext directly.
 */

import type { ReactNode } from 'react';
import { useCan } from '../../context/CurrentUserContext';
import type { PermissionKey } from '../../data/rbac';

interface GatedProps {
  permission: PermissionKey | PermissionKey[];
  mode?: 'hide' | 'disable';
  /** Rendered instead of children when hidden (mode="hide"). */
  fallback?: ReactNode;
  title?: string;
  children: ReactNode;
}

export default function Gated({ permission, mode = 'hide', fallback = null, title, children }: GatedProps) {
  const { can, canAny } = useCan();
  const allowed = Array.isArray(permission) ? canAny(permission) : can(permission);

  if (allowed) return <>{children}</>;
  if (mode === 'hide') return <>{fallback}</>;

  return (
    <span
      aria-disabled
      title={title ?? 'You do not have permission for this action'}
      className="opacity-40 pointer-events-none cursor-not-allowed"
    >
      {children}
    </span>
  );
}
