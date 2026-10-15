/**
 * Controls as the risk register sees them — the Control Library's own rows
 * and statuses, turned into how much each control actually takes off a risk.
 *
 * A control only mitigates as far as it is evidenced: a live workflow with a
 * clean last run counts in full; one whose run raised exceptions counts for
 * about half; a standard control still waiting for the client's data counts
 * for little. So adapting the standard library and approving its workflows
 * lowers residual risk on the register, visibly.
 */
import type { ControlRow } from '../../components/governance/controlTypes';
import { CONTROL_LIBRARY } from '../controlLibrary';
import { CHECK_CATALOG, readinessOf, standardControlRows, type StdState } from '../auditPlan';
import { LAST_RUN_EXCEPTIONS } from './seed';

export type ControlStatus = 'live' | 'awaiting-review' | 'needs-data' | 'manual' | 'no-workflow' | 'draft';

export const isStdControl = (c: ControlRow) => c.library === 'standard';

/** The Control Library's status for a control — one rule for both screens. */
export function controlStatusOf(c: ControlRow, std: StdState): ControlStatus {
  if (isStdControl(c)) {
    const e = CHECK_CATALOG.find(x => x.key === c.stdKey);
    return e ? readinessOf(e, std) : 'needs-data';
  }
  if (c.status === 'Draft') return 'draft';
  return c.linkedWorkflows.length > 0 ? 'live' : c.automation === 'Manual' ? 'manual' : 'no-workflow';
}

export interface ControlEffect {
  status: ControlStatus;
  /** 0–1: how much of its design weight the control delivers today. */
  effectiveness: number;
  label: string;
  /** Exceptions in the last run (live controls only). */
  exceptions: number;
  /** Design weight — nature × key × automation. */
  weight: number;
}

const NATURE_W: Record<ControlRow['nature'], number> = { Preventive: 1, Detective: 0.8, Corrective: 0.6 };
const AUTO_W: Record<ControlRow['automation'], number> = { Automated: 1, 'IT-dependent': 0.9, Manual: 0.75 };

export function controlEffect(c: ControlRow, std: StdState): ControlEffect {
  const status = controlStatusOf(c, std);
  const weight = NATURE_W[c.nature] * (c.classification === 'Key' ? 1.2 : 1) * AUTO_W[c.automation];
  const exceptions = status === 'live' ? LAST_RUN_EXCEPTIONS[c.controlId] ?? 0 : 0;
  const [effectiveness, label] =
    status === 'live' ? (exceptions > 0 ? [0.55, `Live — ${exceptions} exception${exceptions === 1 ? '' : 's'} in last run`] : [1, 'Live — last run clean'])
      : status === 'manual' ? [0.65, 'Tested by walkthrough']
        : status === 'awaiting-review' ? [0.35, 'Built — awaiting your review']
          : status === 'needs-data' ? [0.25, 'Designed — not yet evidenced on your data']
            : status === 'no-workflow' ? [0.3, 'Operating — no test linked']
              : [0, 'Draft — not operating'];
  return { status, effectiveness, label, exceptions, weight };
}

/** Every control in the library, by control ID (C-001, P2P-C01 …). */
export function controlIndex(std: StdState, extra: ControlRow[] = []): Map<string, ControlRow> {
  const m = new Map<string, ControlRow>();
  for (const c of [...CONTROL_LIBRARY, ...standardControlRows(std), ...extra]) if (!m.has(c.controlId)) m.set(c.controlId, c);
  return m;
}
