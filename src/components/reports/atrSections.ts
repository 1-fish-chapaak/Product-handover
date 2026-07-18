// ATR document section keys + labels. Kept in their own module so AtrDocument.tsx
// only exports a component (React Fast Refresh requirement).

export type AtrSectionKey = 'summary' | 'process' | 'details' | 'insights' | 'signoff';

export const ATR_SECTION_ORDER: AtrSectionKey[] = ['summary', 'process', 'details', 'insights', 'signoff'];

export const ATR_SECTION_LABEL: Record<AtrSectionKey, string> = {
  summary: 'Executive Summary',
  process: 'Observation Wise Summary',
  details: 'Observation Details',
  insights: 'Key Insights & Recommendations',
  signoff: 'Approvals & Sign-Off',
};

/** The strapline under each ATR section heading. Shared so the ATR document and
 *  the template preview read from one source instead of duplicating the copy. */
export const ATR_SECTION_SUBTITLE: Record<AtrSectionKey, string> = {
  summary: 'Overall observation and management action plan rollup',
  process: 'Exceptions, management action plans and status — per observation',
  details: 'Issue, risk, management action plan, evidence and verification',
  insights: 'Auditor observations and forward-looking guidance',
  signoff: 'Digital authorisation of this Action Taken Report',
};

/** Subtitle by section NAME (not key) — the preview only knows a template's
 *  section names. Returns undefined for names the ATR document doesn't carry. */
export function atrSubtitleFor(name: string): string | undefined {
  const key = (Object.keys(ATR_SECTION_LABEL) as AtrSectionKey[])
    .find(k => ATR_SECTION_LABEL[k].toLowerCase() === name.trim().toLowerCase());
  return key ? ATR_SECTION_SUBTITLE[key] : undefined;
}

/** A fuller, plain-English description of what each ATR section does. Shown as
 *  the body line in the template preview so an ATR template explains its sections
 *  the same way an Internal Audit one does. The real ATR fills these sections
 *  with run data (KPI tiles, observation cards), so this is preview copy. */
export const ATR_SECTION_DESCRIPTION: Record<AtrSectionKey, string> = {
  summary: 'Sums up the whole Action Taken Report in a few lines. It says how many observations were raised, how many have been actioned or closed, and the overall picture, so a busy reader can see where things stand without reading every observation.',
  process: 'Lists every observation with its current status. For each one it shows the exception raised, the management action plan against it, and whether that action is open, in progress, or closed, so the reader can track progress at a glance.',
  details: 'Goes deep on each observation one at a time. It sets out the issue, the risk it carries, the management action plan, the evidence attached, and the auditor’s verification, so the full story behind every item is in one place.',
  insights: 'Steps back from the individual items to draw out the themes. It gives the auditor’s broader observations and forward-looking guidance, so the reader learns what to watch and improve beyond the immediate fixes.',
  signoff: 'Records who authorised the report and when. Each signatory digitally confirms they have reviewed it and agree it is final, so there is a clear trail of accountability for the Action Taken Report.',
};

/** Description by section NAME, for the preview. Undefined for names the ATR
 *  document doesn't carry. */
export function atrDescriptionFor(name: string): string | undefined {
  const key = (Object.keys(ATR_SECTION_LABEL) as AtrSectionKey[])
    .find(k => ATR_SECTION_LABEL[k].toLowerCase() === name.trim().toLowerCase());
  return key ? ATR_SECTION_DESCRIPTION[key] : undefined;
}
