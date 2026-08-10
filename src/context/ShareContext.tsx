import { createContext, useContext, type ReactNode, type MouseEvent } from 'react';

/** What is being shared — drives the modal title ("Share this <kind>"). */
export type ShareKind = 'workspace' | 'report' | 'dashboard' | 'workflow-output' | 'process' | 'risk' | 'control' | 'engagement' | 'racm';

export type ShareAnchorRect = {
  top: number; left: number; right: number; bottom: number; width: number; height: number;
};

/** Capture a trigger's on-screen rect so the share popover can anchor next to it. */
export const rectFromEvent = (e: MouseEvent<HTMLElement>): ShareAnchorRect => {
  const r = e.currentTarget.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};

export interface ShareApi {
  /** Open the single platform Share modal, anchored to the trigger. */
  openShare: (opts: {
    type: ShareKind;
    id?: string;
    /** What the thing is called. Shown in the popover header so a share opened
     *  from a long list says which row it is about. */
    name?: string;
    anchor?: ShareAnchorRect;
  }) => void;
}

const ShareContext = createContext<ShareApi | null>(null);

export function ShareProvider({ openShare, children }: { openShare: ShareApi['openShare']; children: ReactNode }) {
  return <ShareContext.Provider value={{ openShare }}>{children}</ShareContext.Provider>;
}

export function useShare(): ShareApi {
  const ctx = useContext(ShareContext);
  if (!ctx) throw new Error('useShare must be used within a ShareProvider');
  return ctx;
}
