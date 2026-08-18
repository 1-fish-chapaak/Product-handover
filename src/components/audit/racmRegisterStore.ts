// ─── Engagement RACM register store ──────────────────────────────────────
// Module-level, per-engagement store for the RACM register — the single list
// of risk-control rows an engagement owns. Lifted out of React state so the
// register survives every navigation (tab switches AND the full-page editor,
// which renders outside the workspace provider), and so the RACM tab, the
// Controls tab and the editor all read and write the same rows.
// In-memory only: a hard refresh reseeds from the process library (matches the
// rest of the demo, e.g. the approval-flow store).
import { useEffect, useState } from 'react';
import type { RACMRow } from '../../data/racm';

/** An SOP linked to one RACM — the document a RACM was extracted from. */
export interface SopDoc {
  name: string;
  version: string;
  uploadedAgo: string;
  sections: string[];
  /** True when the RACM for this area was extracted from this SOP. */
  extracted: boolean;
}

interface Register {
  rows: RACMRow[];
  /** SOPs the auditor linked, keyed by RACM entry id (slug of the sub-process). */
  sops: Record<string, SopDoc>;
}

const registers = new Map<string, Register>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const racmRegisters = {
  /** The register for an engagement, seeding it on first touch. */
  ensure(engagementId: string, seed: () => RACMRow[]): Register {
    let reg = registers.get(engagementId);
    if (!reg) {
      reg = { rows: seed(), sops: {} };
      registers.set(engagementId, reg);
    }
    return reg;
  },
  /** Rows only — undefined when the engagement has never been opened. */
  rows(engagementId: string): RACMRow[] | undefined {
    return registers.get(engagementId)?.rows;
  },
  replaceRows(engagementId: string, rows: RACMRow[]) {
    const reg = registers.get(engagementId) ?? { rows: [], sops: {} };
    registers.set(engagementId, { ...reg, rows });
    notify();
  },
  appendRows(engagementId: string, rows: RACMRow[]) {
    const reg = registers.get(engagementId) ?? { rows: [], sops: {} };
    const seen = new Set(reg.rows.map(r => r.id));
    registers.set(engagementId, { ...reg, rows: [...rows.filter(r => !seen.has(r.id)), ...reg.rows] });
    notify();
  },
  removeControl(engagementId: string, controlId: string) {
    const reg = registers.get(engagementId);
    if (!reg) return;
    registers.set(engagementId, { ...reg, rows: reg.rows.filter(r => r.controlId !== controlId) });
    notify();
  },
  setSop(engagementId: string, entryId: string, sop: SopDoc) {
    const reg = registers.get(engagementId) ?? { rows: [], sops: {} };
    registers.set(engagementId, { ...reg, sops: { ...reg.sops, [entryId]: sop } });
    notify();
  },
};

/** Subscribe a component to register changes (any engagement). */
export function useRacmRegisterVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = () => setV(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}
