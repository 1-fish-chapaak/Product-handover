// ─── ATR Builder working model ───
// The multi-stage ATR journey (entry → extract → validate → annexure → decision
// → preview) carries each observation as a *working* record that tracks
// selection, completeness, skipped fields and linked annexures on top of the
// canonical AtrObservation. These helpers stay pure so the steps can be dumb.
import * as XLSX from 'xlsx';
import type { AtrObservation, AtrInsight } from './atrTypes';
import { SAMPLE_OBSERVATIONS } from './atrTemplate';

export type ComplField =
  | 'description' | 'riskSummary' | 'classification' | 'risk'
  | 'recommendation' | 'actionTaken' | 'evidence';

export const COMPLETENESS_FIELDS: ComplField[] = [
  'description', 'riskSummary', 'classification', 'risk', 'recommendation', 'actionTaken', 'evidence',
];

export const FIELD_LABEL: Record<ComplField, string> = {
  description: 'Observation Description',
  riskSummary: 'Risk Summary',
  classification: 'Classification Status',
  risk: 'Risk Significance',
  recommendation: 'Recommendation / Action Plan',
  actionTaken: 'Action Taken',
  evidence: 'Evidence',
};

export type LinkState = 'confirmed' | 'review' | 'unlinked';
export type Completeness = 'Complete' | 'Partial' | 'Incomplete';

export interface AtrAnnexure {
  id: string;
  name: string;
  rows: number;
}

export interface AtrWorkObs extends AtrObservation {
  _id: string;
  /** Included in the ATR (Stage 2 selection). */
  selected: boolean;
  /** Field keys the user explicitly marked N/A (counts as resolved). */
  skipped: ComplField[];
  /** Linked exception annexures (Stage 3). */
  annexures: AtrAnnexure[];
  /** AI-link confidence state (Stage 3). */
  linkState: LinkState;
}

// ─── Real annexures from the uploaded files ───
// Reads each uploaded Excel/CSV annexure and counts its data rows (excluding the
// header). Non-tabular files keep a row count of 0. These become the Stage 3
// linking pool, so the mapping reflects what the user actually uploaded.
export async function parseAnnexureFiles(files: File[]): Promise<AtrAnnexure[]> {
  const out: AtrAnnexure[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    let rows = 0;
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      try {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }).length : 0;
      } catch { rows = 0; }
    }
    out.push({ id: `up-anx-${i}`, name: f.name, rows });
  }
  return out;
}

// ─── Annexures already embedded in the uploaded report/template ───
// A filled Excel template (or an uploaded report workbook) often carries its
// exception data as extra sheets. We treat every sheet that isn't the
// observations / instructions / cover sheet as an annexure and fetch it straight
// from the file — no separate upload needed.
export async function extractEmbeddedAnnexures(file: File): Promise<AtrAnnexure[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['xlsx', 'xls'].includes(ext)) return [];
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const out: AtrAnnexure[] = [];
    wb.SheetNames.forEach((name, i) => {
      if (/observation|instruction|summary|cover|readme|guide/i.test(name)) return;
      const sheet = wb.Sheets[name];
      const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }).length : 0;
      if (rows > 0) out.push({ id: `emb-anx-${i}`, name: `${name} (from report)`, rows });
    });
    return out;
  } catch { return []; }
}

// Pool of mock exception annexures — used only as a demo fallback when the user
// hasn't uploaded any annexure files.
export const ANNEXURE_POOL: AtrAnnexure[] = [
  { id: 'anx-01', name: 'Annexure A — Vendor Master Exceptions.xlsx', rows: 14 },
  { id: 'anx-02', name: 'Annexure B — 3-Way Match Bypass.xlsx', rows: 23 },
  { id: 'anx-03', name: 'Annexure C — Freight Rate Approval Gaps.xlsx', rows: 2 },
  { id: 'anx-04', name: 'Annexure D — FG Stock Variance.xlsx', rows: 4 },
  { id: 'anx-05', name: 'Annexure E — Scrap Sale Reconciliation.xlsx', rows: 3 },
  { id: 'anx-06', name: 'Annexure F — Supporting Workpapers.xlsx', rows: 9 },
];

// ─── Field presence ───
function hasValue(obs: AtrObservation, f: ComplField): boolean {
  switch (f) {
    case 'description': return !!obs.description?.trim();
    case 'riskSummary': return !!obs.riskSummary?.trim();
    case 'classification': return !!obs.classification;
    case 'risk': return !!obs.risk;
    case 'recommendation': return obs.actionPlans.some(p => p.text?.trim());
    case 'actionTaken': return obs.actionPlans.some(p => p.actionTaken?.trim());
    case 'evidence': return obs.actionPlans.some(p => p.evidence?.trim());
  }
}

/** Required fields that are neither present nor explicitly skipped. */
export function missingFields(obs: AtrWorkObs): ComplField[] {
  return COMPLETENESS_FIELDS.filter(f => !hasValue(obs, f) && !obs.skipped.includes(f));
}

/** Completeness badge — based on present fields (skips don't count as present). */
export function completeness(obs: AtrWorkObs): Completeness {
  const present = COMPLETENESS_FIELDS.filter(f => hasValue(obs, f)).length;
  if (present === COMPLETENESS_FIELDS.length) return 'Complete';
  if (present <= 1) return 'Incomplete';
  return 'Partial';
}

/** Min bar to be includable in the ATR: a title + a description. */
export function isIncludable(obs: AtrWorkObs): boolean {
  return !!obs.title?.trim() && !!obs.description?.trim();
}

let _seq = 0;
const uid = () => `wob-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

// ─── Build working observations + AI-suggested annexure links ───
// Heuristic mock: each observation is linked to the annexure whose row count
// matches its exception count; otherwise mapped positionally. The last few get
// lower-confidence states so the Stage 3 review has something to do.
export function toWorkObs(observations: AtrObservation[], pool: AtrAnnexure[] = ANNEXURE_POOL): AtrWorkObs[] {
  return observations.map((o, i): AtrWorkObs => {
    const byRows = o.exceptions != null ? pool.find(a => a.rows === o.exceptions) : undefined;
    const positional = pool.length ? pool[i % pool.length] : undefined;
    const linked = byRows ?? (i < pool.length ? positional : undefined);
    const linkState: LinkState = byRows ? 'confirmed' : linked ? 'review' : 'unlinked';
    return {
      ...o,
      _id: uid(),
      selected: true,
      skipped: [],
      annexures: linked ? [linked] : [],
      linkState,
    };
  });
}

export function blankWorkObs(): AtrWorkObs {
  return {
    title: '', description: '', risk: 'Medium', status: 'Open',
    actionPlans: [{ text: '', status: 'Pending' }],
    _id: uid(), selected: true, skipped: [], annexures: [], linkState: 'unlinked',
  };
}

export function selectedCount(obs: AtrWorkObs[]): number {
  return obs.filter(o => o.selected).length;
}

/** Selected observations that still have unresolved missing fields. */
export function unresolvedCount(obs: AtrWorkObs[]): number {
  return obs.filter(o => o.selected && missingFields(o).length > 0).length;
}

/** Strip the working metadata back to plain AtrObservations for the ATR doc. */
export function toAtrObservations(obs: AtrWorkObs[]): AtrObservation[] {
  return obs.filter(o => o.selected).map(({ _id, selected, skipped, annexures, linkState, ...rest }) => {
    void _id; void selected; void skipped; void annexures; void linkState;
    return rest;
  });
}

export const totalExceptionRows = (obs: AtrWorkObs[]): number =>
  obs.filter(o => o.selected).reduce((n, o) => n + o.annexures.reduce((m, a) => m + a.rows, 0), 0);

// ─── Import from Engagement (mock source) ───
// A handful of internal-audit engagements, each carrying observations the ATR
// can be built from. Subsets the canonical sample so the demo stays realistic.
export interface EngagementSource {
  id: string;
  name: string;
  period: string;
  /** ISO start/end of the fiscal period — pre-fills the Audit Period date fields. */
  periodStart: string;
  periodEnd: string;
  observations: () => AtrObservation[];
}
export const ENGAGEMENT_SOURCES: EngagementSource[] = [
  { id: 'eng-p2p', name: 'Procure-to-Pay Controls Review', period: 'Q1 FY 2025-26', periodStart: '2025-04-01', periodEnd: '2025-06-30', observations: () => SAMPLE_OBSERVATIONS.filter(o => o.process?.includes('Procurement') || o.process?.includes('Dispatch')) },
  { id: 'eng-inv', name: 'Inventory & Stock Management Audit', period: 'Q2 FY 2025-26', periodStart: '2025-07-01', periodEnd: '2025-09-30', observations: () => SAMPLE_OBSERVATIONS.filter(o => o.process?.includes('Inventory')) },
  { id: 'eng-all', name: 'FY26 Internal Audit — Full Scope', period: 'FY 2025-26', periodStart: '2025-04-01', periodEnd: '2026-03-31', observations: () => SAMPLE_OBSERVATIONS },
];

// ─── Section-level regeneration: Key Insights ───
// Recomputes auditor insights from the observation roll-up, with a little
// variation each call so "Regenerate" visibly refreshes the section.
export function regenerateInsights(observations: AtrObservation[]): AtrInsight[] {
  const sel = observations;
  const closed = sel.filter(o => o.status === 'Closed').length;
  const overdue = sel.filter(o => o.status === 'Overdue').length;
  const open = sel.filter(o => o.status === 'Open' || o.status === 'In Progress').length;
  const high = sel.filter(o => o.risk === 'High').length;
  const out: AtrInsight[] = [];

  const openers = ['Overall remediation posture', 'Management response summary', 'Where the audit stands'];
  out.push({
    title: openers[Math.floor(Math.random() * openers.length)],
    body: `Of ${sel.length} observation${sel.length === 1 ? '' : 's'}, ${closed} ${closed === 1 ? 'is' : 'are'} closed, ${open} in progress${overdue ? `, and ${overdue} overdue` : ''}. ${high ? `${high} carry High risk significance and warrant Audit Committee visibility.` : 'Risk exposure is concentrated in the medium band.'}`,
  });
  if (overdue > 0) out.push({ title: 'Overdue items need escalation', body: `${overdue} observation${overdue === 1 ? '' : 's'} ${overdue === 1 ? 'has' : 'have'} slipped past the agreed timeline. Recommend a fixed go-live with weekly status to the Audit Committee.` });
  if (closed > 0) out.push({ title: 'Effective controls to sustain', body: `${closed} fully remediated observation${closed === 1 ? '' : 's'} show strong management responsiveness — schedule a follow-up to confirm sustained operation.` });
  out.push({ title: 'Recommended follow-up', body: 'A follow-up review is recommended next quarter to validate in-progress items and confirm implemented controls operate as designed.' });
  return out;
}

// ─── Duplicate detection across observations within the same ATR ───
function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
/** Returns the set of _ids that share a normalized title with another row. */
export function duplicateIds(obs: AtrWorkObs[]): Set<string> {
  const byTitle = new Map<string, string[]>();
  obs.forEach(o => {
    const k = normTitle(o.title);
    if (!k) return;
    byTitle.set(k, [...(byTitle.get(k) ?? []), o._id]);
  });
  const dupes = new Set<string>();
  byTitle.forEach(ids => { if (ids.length > 1) ids.forEach(id => dupes.add(id)); });
  return dupes;
}

// ─── ATR from the report it was launched from ───
// "Generate ATR" on a report used to open a canned demo document, so the ATR a
// reader saw named a different entity, a different author and a different set
// of observations to the report underneath it. This composes the ATR out of the
// report's own query cards, its own added observations and its own cover meta,
// so the preview is that report restated in ATR form and nothing else.

export interface AtrSourceQuery {
  id: string;
  title: string;
  risk?: string;
  severity?: string;
  summary?: string;
  findings?: string[];
  observations?: string[];
}

export interface AtrSourceObservation {
  obsId: string;
  title: string;
  description?: string;
}

export interface AtrSourceReport {
  id?: string;
  name: string;
  generatedBy?: string;
  generatedAt?: string;
  reportPeriod?: string;
  execSummary?: string;
}

const toRisk = (severity?: string): AtrObservation['risk'] =>
  severity === 'Medium' ? 'Medium' : severity === 'Low' ? 'Low' : 'High';

const classifyFrom = (risk?: string): AtrObservation['classification'] => {
  const r = (risk ?? '').toLowerCase();
  if (r.includes('compliance')) return 'Procedural Non-Compliance';
  if (r.includes('operational') || r.includes('technology') || r.includes('it')) return 'System Deficiency';
  return 'Design Deficiency';
};

/** Reads a KPI value off a query's resolved KPI set. */
const kpiNumber = (kpis: { label: string; value: string }[], label: string): number => {
  const hit = kpis.find(k => k.label.toLowerCase() === label);
  if (!hit) return 0;
  const n = Number(String(hit.value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function atrFromReport(
  report: AtrSourceReport,
  queries: AtrSourceQuery[],
  observations: AtrSourceObservation[],
  kpisFor: (q: AtrSourceQuery) => { label: string; value: string }[],
  execSummaryText?: string,
): { meta: import('./atrTypes').AtrMeta; observations: AtrObservation[]; insights: AtrInsight[] } {
  const queryObs: AtrObservation[] = queries.map(q => {
    const kpis = kpisFor(q);
    const total = kpiNumber(kpis, 'total exceptions');
    const open = kpiNumber(kpis, 'open');
    const closed = kpiNumber(kpis, 'closed');
    // An observation with nothing left open reads as Closed; one with a closure
    // already recorded is in flight; anything else is still Open.
    const status: AtrObservation['status'] =
      total > 0 && open === 0 ? 'Closed' : closed > 0 ? 'In Progress' : 'Open';
    // The query's own recommendations become the management action plans. The
    // findings stay as the evidence line beneath them, which is where they sit
    // on the query card too.
    const plans = (q.observations?.length ? q.observations : q.findings ?? []).map((text, i) => ({
      title: `Action ${i + 1}`,
      text,
      status: (status === 'Closed' ? 'Implemented' : 'Pending') as 'Implemented' | 'Pending',
      evidence: (q.findings ?? [])[i],
    }));
    return {
      title: q.title,
      process: q.risk,
      description: q.summary,
      querySummary: `${q.id} · ${q.title}`,
      riskSummary: (q.observations ?? [])[0],
      classification: classifyFrom(q.risk),
      risk: toRisk(q.severity),
      status,
      exceptions: total || undefined,
      actionPlans: plans,
    };
  });

  // Observations the auditor added by hand on the report carry no query data,
  // so they arrive with their description and no action plan rather than an
  // invented one.
  const manualObs: AtrObservation[] = observations.map(o => ({
    title: o.title,
    description: o.description,
    querySummary: o.obsId,
    risk: 'Medium' as const,
    status: 'Open' as const,
    actionPlans: [],
  }));

  const all = [...queryObs, ...manualObs];
  const totalExceptions = all.reduce((n, o) => n + (o.exceptions ?? 0), 0);

  const insights: AtrInsight[] = [];
  const summary = execSummaryText ?? report.execSummary;
  if (summary?.trim()) insights.push({ title: 'Executive summary', body: summary.trim() });
  const openCount = all.filter(o => o.status !== 'Closed').length;
  if (all.length > 0) {
    insights.push({
      title: openCount === 0 ? 'Every observation is closed' : `${openCount} of ${all.length} observations still need action`,
      body: openCount === 0
        ? 'Each observation in this report has been remediated and evidenced. A follow-up review can confirm the controls keep operating.'
        : `This ATR carries ${all.length} observation${all.length === 1 ? '' : 's'} from “${report.name}”. ${openCount} ${openCount === 1 ? 'is' : 'are'} still open or in progress and ${openCount === 1 ? 'needs' : 'need'} a dated action plan from the risk owner.`,
    });
  }

  return {
    meta: {
      reportId: report.id ? `ATR-${report.id.toUpperCase()}` : 'ATR-DRAFT',
      auditTitle: report.name,
      auditPeriod: report.reportPeriod ?? '',
      preparedBy: report.generatedBy ?? 'You',
      generatedOn: report.generatedAt ?? '',
      auditEntity: report.name,
      totalExceptions: totalExceptions || undefined,
    },
    observations: all,
    insights,
  };
}
