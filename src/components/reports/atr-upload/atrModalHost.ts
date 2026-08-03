import { createContext, useContext } from 'react';
import type { EscalationMatrixConfig } from './escalationMatrix';

/** Lets deep children (e.g. the Escalation Matrix card) ask the ATR upload modal
 *  host to swap in a full-frame editor instead of stacking a nested modal. */
export interface AtrModalHost {
  openEscalationEditor: (config: EscalationMatrixConfig, onChange: (c: EscalationMatrixConfig) => void) => void;
}

export const AtrModalHostContext = createContext<AtrModalHost | null>(null);

export const useAtrModalHost = () => useContext(AtrModalHostContext);
