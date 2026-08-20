// ─────────────────────────────────────────────────────────────────────────────
// Per-engagement register drafted by One-Click Audit — the risks, controls and
// monitoring workflows the user reviewed in the wizard before going live.
//
// The engagement record itself only carries a control *count*, so without this
// store an AI-drafted engagement would open showing the generic process-based
// RACM library instead of the register the user actually approved.
//
// Keyed by engagement id and backed by localStorage, so a drafted register
// survives a reload the same way created engagements do.
//
// A register is written for every created engagement, including SOX / ICFR and
// Compliance ones. Only the Internal Audit / Automation surfaces read it today;
// the other two seed their own workspaces and ignore what's stored here.
// ─────────────────────────────────────────────────────────────────────────────
import type { ProcessCode } from './engagements';
import type {
  Automation,
  ControlAttribute,
  ControlType,
  Frequency,
  RACMRow,
  SoxAssertion,
} from './racm';

// ── Persisted shapes ─────────────────────────────────────────────────────────
// Deliberately self-contained rather than re-using the wizard's `Recommended*`
// types: keeps this data module free of a component import, and keeps the
// stored payload stable if the wizard's own types drift.

export interface DraftedRisk {
  id: string;
  title: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
}

export interface DraftedControl {
  id: string;
  /** Human control code, e.g. 'AP-C01'. */
  controlId: string;
  /** Id of the DraftedRisk this control mitigates. */
  riskId: string;
  title: string;
  description: string;
  /** Free text from the wizard ('Continuous', 'Per run', …) — mapped on read. */
  frequency: string;
  controlType: ControlType;
  /** Wizard casing ('IT-Dependent') differs from the RACM union — mapped on read. */
  automation: 'Automated' | 'IT-Dependent' | 'Manual';
  isKey: boolean;
}

export interface DraftedWorkflow {
  id: string;
  name: string;
  description: string;
  cadence: string;
  /** Human code of the control this workflow evidences, e.g. 'AP-C01'. */
  controlId: string;
}

export interface DraftedRegister {
  engagementId: string;
  /** Stored so the adapters below can build RACM rows without a registry lookup. */
  process: ProcessCode;
  risks: DraftedRisk[];
  controls: DraftedControl[];
  workflows: DraftedWorkflow[];
}

// ── Store ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'irame.draftedRegisters';

function load(): Record<string, DraftedRegister> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Module-level cache — also the rehydration step: registers persisted in an
// earlier session are available to the read paths as soon as this module loads.
let cache: Record<string, DraftedRegister> = load();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — keep the in-memory copy */
  }
}

/** The register drafted for an engagement, or undefined if it wasn't AI-drafted. */
export function getDraftedRegister(engagementId: string): DraftedRegister | undefined {
  return cache[engagementId];
}

/** Whether this engagement opens with an AI-drafted register rather than library seeds. */
export function hasDraftedRegister(engagementId: string): boolean {
  return cache[engagementId] !== undefined;
}

/** Persist the registers for a batch of newly-created engagements. */
export function addDraftedRegisters(registers: DraftedRegister[]): void {
  if (registers.length === 0) return;
  const next = { ...cache };
  registers.forEach(r => {
    next[r.engagementId] = r;
  });
  cache = next;
  persist();
}

// ── Adapters: drafted register → the shapes the engagement surfaces consume ──
//
// Everything downstream (the Controls tab, the RACM, the working paper) already
// reads `RACMRow[]`, so one adapter feeds every read path.

/** Wizard frequency strings → the RACM `Frequency` union. Total: unknown → Event-driven. */
const FREQUENCY_MAP: Record<string, Frequency> = {
  Continuous: 'Daily',
  Daily: 'Daily',
  Weekly: 'Weekly',
  Monthly: 'Monthly',
  Quarterly: 'Quarterly',
  Annual: 'Annual',
  Annually: 'Annual',
  'Per run': 'Event-driven',
  'Per change': 'Event-driven',
  'Per event': 'Event-driven',
};

/** Wizard automation values → the RACM `Automation` union (note the casing gap). */
const AUTOMATION_MAP: Record<string, Automation> = {
  Automated: 'Automated',
  'IT-Dependent': 'IT-dependent',
  Manual: 'Manual',
};

/** Control-code prefix → sub-process heading, so drafted rows group sensibly. */
const SUBPROCESS_MAP: Record<string, string> = {
  AP: 'Accounts Payable',
  JE: 'Journal Entries',
  VM: 'Vendor Master',
  HR: 'Workforce & Access',
  RV: 'Revenue Recognition',
};

/** Population / sample defaults per frequency — keeps sampling defensible. */
const SAMPLING: Record<Frequency, { populationSize: number; defaultSampleSize: number }> = {
  Daily: { populationSize: 365, defaultSampleSize: 25 },
  Weekly: { populationSize: 52, defaultSampleSize: 8 },
  Monthly: { populationSize: 12, defaultSampleSize: 3 },
  Quarterly: { populationSize: 4, defaultSampleSize: 2 },
  Annual: { populationSize: 1, defaultSampleSize: 1 },
  'Event-driven': { populationSize: 120, defaultSampleSize: 25 },
};

const ASSERTIONS: SoxAssertion[] = [
  'Existence',
  'Completeness',
  'Accuracy',
  'Valuation',
  'Cutoff',
  'Presentation',
];

function codePrefix(controlId: string): string {
  return (controlId.split('-')[0] ?? '').toUpperCase();
}

export function draftedSubProcess(controlId: string): string {
  const prefix = codePrefix(controlId);
  return SUBPROCESS_MAP[prefix] ?? prefix ?? 'Drafted controls';
}

/** Ira drafts controls, not test steps — synthesise the attributes the workspace
 *  needs so testing, evidence and workflow links have something to hang off.
 *  Ids use the library's `{controlId}.{n}` form so `attrCode()` renders AP-C01-A1. */
function attributesFor(control: DraftedControl, frequency: Frequency): ControlAttribute[] {
  const sampling = SAMPLING[frequency];
  const attributes: ControlAttribute[] = [
    {
      id: `${control.controlId}.1`,
      description: control.title,
      testProcedure: `Inspect evidence that the control operated as described: ${control.description}`,
      requiredEvidence: ['System configuration or report', 'Reviewer sign-off'],
      populationSize: sampling.populationSize,
      defaultSampleSize: sampling.defaultSampleSize,
    },
  ];
  if (control.isKey) {
    attributes.push({
      id: `${control.controlId}.2`,
      description: 'Exceptions identified are investigated and resolved',
      testProcedure: 'Review the exception log and verify each item was resolved within SLA.',
      requiredEvidence: ['Exception log', 'Resolution evidence'],
      populationSize: Math.max(1, Math.round(sampling.populationSize / 10)),
      defaultSampleSize: Math.max(1, Math.round(sampling.defaultSampleSize / 2)),
    });
  }
  return attributes;
}

/**
 * The drafted register as RACM rows, or `undefined` when the engagement wasn't
 * AI-drafted. Returning undefined rather than [] is deliberate: it lets each
 * call site keep its own existing fallback untouched.
 */
export function draftedRacmRows(engagementId: string): RACMRow[] | undefined {
  const register = cache[engagementId];
  if (!register) return undefined;

  // Display codes for the risks that survived the user's selection. Controls
  // sharing a risk share one code, so risk counts stay accurate downstream.
  const riskCodes = new Map<string, { code: string; description: string }>();
  register.risks.forEach((risk, i) => {
    riskCodes.set(risk.id, {
      code: `RSK-${register.process}-${String(i + 1).padStart(2, '0')}`,
      description: `${risk.title}. ${risk.description}`,
    });
  });

  let orphans = 0;
  return register.controls.map((control, i) => {
    const frequency = FREQUENCY_MAP[control.frequency] ?? 'Event-driven';
    // The control's risk may have been deselected in the wizard — mint a
    // stand-in so the row still reads as a risk-to-control mapping.
    const risk = riskCodes.get(control.riskId) ?? {
      code: `RSK-${register.process}-U${++orphans}`,
      description: `Risk addressed by control ${control.controlId}.`,
    };
    return {
      id: `racm-${engagementId}-${control.id}`,
      process: register.process,
      subProcess: draftedSubProcess(control.controlId),
      riskId: risk.code,
      riskDescription: risk.description,
      controlId: control.controlId,
      controlDescription: control.description,
      attributes: attributesFor(control, frequency),
      assertion: ASSERTIONS[i % ASSERTIONS.length],
      frequency,
      controlType: control.controlType,
      automation: AUTOMATION_MAP[control.automation] ?? 'Manual',
      isKey: control.isKey,
    };
  });
}

/** The monitoring workflows drafted for an engagement, or undefined if none. */
export function draftedWorkflows(engagementId: string): DraftedWorkflow[] | undefined {
  return cache[engagementId]?.workflows;
}

/**
 * Attribute → workflow links derived from the register's own cross-links: each
 * drafted workflow names the control it evidences, so it lands on that control's
 * first attribute instead of the positional round-robin used for seeded data.
 * Undefined when there's no register, or when nothing matched a surviving control.
 */
export function draftedLinks(
  engagementId: string,
  base: { controlId: string; attributes: { id: string }[] }[],
): Record<string, string[]> | undefined {
  const register = cache[engagementId];
  if (!register) return undefined;

  const firstAttributeByControl = new Map<string, string>();
  base.forEach(control => {
    const attributeId = control.attributes[0]?.id;
    if (attributeId) firstAttributeByControl.set(control.controlId.toUpperCase(), attributeId);
  });

  const links: Record<string, string[]> = {};
  register.workflows.forEach(workflow => {
    const attributeId = firstAttributeByControl.get(workflow.controlId.toUpperCase());
    if (!attributeId) return;
    links[attributeId] = [...(links[attributeId] ?? []), workflow.id];
  });

  return Object.keys(links).length > 0 ? links : undefined;
}
