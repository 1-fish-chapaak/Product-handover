import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The wizard renders a single sticky footer region below the scroll area; each
// step portals its primary actions into it via <WizardFooter>. This keeps the
// CTA pinned and always visible (matching the shared Modal footer pattern)
// while the step's form state stays local to the step.

// eslint-disable-next-line react-refresh/only-export-components
export const FooterSlotContext = createContext<HTMLElement | null>(null);

/** Render children into the wizard's sticky footer. No-op until the slot mounts. */
export function WizardFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlotContext);
  return slot ? createPortal(children, slot) : null;
}
