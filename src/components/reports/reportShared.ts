// ─── Reports shared keystone ─────────────────────────────────────────────────
//
// Types, constant maps, and pure helpers shared across the Reports module
// (ReportsView and the components extracted out of it). Kept dependency-light —
// imports only react / lucide / mockData — so it can be imported anywhere in the
// reports/ tree without creating a cycle.

import type { ElementType } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, BarChart3, FileText,
  TrendingUp, Lightbulb, BookOpen, Loader2,
} from 'lucide-react';
import { REPORT_TEMPLATES, GENERATED_REPORTS } from '../../data/mockData';
import type { GeneratedQueryDef } from './templateQueryPool';
import type { AtrReportData } from './atrTypes';
import type { ToastType } from '../shared/Toast';

// ─── Icon + category maps ────────────────────────────────────────────────────

export const ICON_MAP: Record<string, ElementType> = {
  shield: Shield,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle2,
  'bar-chart': BarChart3,
  'file-text': FileText,
  'trending-up': TrendingUp,
  'clipboard-check': CheckCircle2,
  'lightbulb': Lightbulb,
  'book-open': BookOpen,
};

export const CATEGORY_COLORS: Record<string, string> = {
  Compliance: 'text-evidence-700 bg-evidence-50',
  Risk: 'text-high-700 bg-high-50',
  Controls: 'text-brand-700 bg-brand-50',
  Analytics: 'text-brand-700 bg-brand-50',
  Audit: 'text-risk-700 bg-risk-50',
  Executive: 'text-indigo-600 bg-indigo-50',
  SOX: 'text-evidence-700 bg-evidence-50',
  ATR: 'text-brand-700 bg-brand-50',
  Other: 'text-ink-500 bg-paper-50',
};

/** Controlled vocabulary for a template's report type. Fixed for now (a clean
 *  taxonomy keeps filtering/reporting useful); "Other" is the escape hatch. */
export const REPORT_TYPES = ['Audit', 'Compliance', 'SOX', 'ATR', 'Risk', 'Other'] as const;
export type ReportTypeName = typeof REPORT_TYPES[number];

// ── Report type → required / recommended sections (PRD §4.6) ─────────────────
// Each type carries a curated set, split into `required` (the must-haves that
// define the type) and `recommended` (the usual rest). Picking a type pre-fills
// these in the editor, and on upload shows the user what their document is
// missing for the chosen type. `match` keeps presence-detection tolerant of
// naming variants (a detected "Detailed Findings" satisfies the Audit
// "Findings / Observations"). First-pass set, to confirm with auditors.
export type SectionTier = 'required' | 'recommended';
export type TypeSection = { name: string; icon: string; tier: SectionTier; match: RegExp };

export const TYPE_SECTION_MAP: Record<ReportTypeName, TypeSection[]> = {
  Audit: [
    { name: 'Executive Summary',          icon: 'file-text',      tier: 'recommended', match: /executive|summary/i },
    { name: 'Scope & Objectives',         icon: 'file-text',      tier: 'recommended', match: /scope|objective/i },
    { name: 'Testing Methodology',        icon: 'file-text',      tier: 'recommended', match: /methodology/i },
    { name: 'Findings / Observations',    icon: 'check-circle',   tier: 'required',    match: /finding|observation|audit quer/i },
    { name: 'Recommendations',            icon: 'trending-up',    tier: 'required',    match: /recommendation/i },
    { name: 'Management Response',         icon: 'book-open',      tier: 'recommended', match: /management response|response/i },
    { name: 'Conclusion / Audit Opinion', icon: 'shield',         tier: 'required',    match: /conclusion|opinion/i },
    { name: 'Sign-off',                   icon: 'shield',         tier: 'recommended', match: /sign-?off|approval/i },
  ],
  SOX: [
    { name: 'Executive Summary',                 icon: 'file-text',      tier: 'recommended', match: /executive|summary/i },
    { name: 'Scope & Methodology',               icon: 'file-text',      tier: 'recommended', match: /scope|methodology/i },
    { name: 'Control Environment Overview',      icon: 'file-text',      tier: 'recommended', match: /control environment/i },
    { name: 'Control Testing Results',           icon: 'check-circle',   tier: 'required',    match: /control testing|testing results/i },
    { name: 'Deficiencies / Exceptions',         icon: 'alert-triangle', tier: 'required',    match: /deficienc|exception/i },
    { name: 'Remediation Plan',                  icon: 'check-circle',   tier: 'recommended', match: /remediation/i },
    { name: 'Conclusion / Management Assertion', icon: 'shield',         tier: 'required',    match: /conclusion|assertion/i },
    { name: 'Sign-off',                          icon: 'shield',         tier: 'recommended', match: /sign-?off|approval/i },
  ],
  Compliance: [
    { name: 'Executive Summary',            icon: 'file-text',      tier: 'recommended', match: /executive|summary/i },
    { name: 'Regulatory Scope & Framework', icon: 'file-text',      tier: 'recommended', match: /scope|framework|regulat/i },
    { name: 'Compliance Assessment',        icon: 'check-circle',   tier: 'required',    match: /compliance assessment|assessment|testing/i },
    { name: 'Gaps / Non-compliance',        icon: 'alert-triangle', tier: 'required',    match: /gap|non-?compliance/i },
    { name: 'Remediation / Action Plan',    icon: 'check-circle',   tier: 'recommended', match: /remediation|action plan/i },
    { name: 'Conclusion',                   icon: 'shield',         tier: 'required',    match: /conclusion/i },
    { name: 'Sign-off',                     icon: 'shield',         tier: 'recommended', match: /sign-?off|approval/i },
  ],
  Risk: [
    { name: 'Executive Summary',           icon: 'file-text',      tier: 'recommended', match: /executive|summary/i },
    { name: 'Risk Methodology',            icon: 'file-text',      tier: 'recommended', match: /methodology/i },
    { name: 'Risk Findings / Register',    icon: 'check-circle',   tier: 'required',    match: /risk (finding|register)|register|finding/i },
    { name: 'Risk Rating / Significance',  icon: 'alert-triangle', tier: 'required',    match: /rating|significance/i },
    { name: 'Risk Heatmap / Summary',      icon: 'bar-chart',      tier: 'recommended', match: /heatmap/i },
    { name: 'Mitigation / Treatment Plan', icon: 'check-circle',   tier: 'required',    match: /mitigation|treatment/i },
    { name: 'Conclusion',                  icon: 'shield',         tier: 'recommended', match: /conclusion/i },
  ],
  ATR: [
    { name: 'Observation / Finding',           icon: 'check-circle',   tier: 'required',    match: /observation|finding/i },
    { name: 'Action Taken',                    icon: 'check-circle',   tier: 'required',    match: /action taken|action/i },
    { name: 'Closure / Classification Status', icon: 'bar-chart',      tier: 'required',    match: /closure|classification|status/i },
    { name: 'Original Recommendation (MAP)',   icon: 'trending-up',    tier: 'recommended', match: /recommendation|management action|map/i },
    { name: 'Risk Significance',               icon: 'alert-triangle', tier: 'recommended', match: /risk significance|significance|severity/i },
    { name: 'Due Date',                        icon: 'file-text',      tier: 'recommended', match: /due date|timeline|due/i },
    { name: 'Auditor Verification / Comments', icon: 'book-open',      tier: 'recommended', match: /verification|auditor comment|management comment/i },
    { name: 'Supporting Evidence',             icon: 'file-text',      tier: 'recommended', match: /evidence/i },
  ],
  Other: [],
};

/** The curated section set for a type (required + recommended). Empty for Other. */
export function typeSectionsFor(type: ReportTypeName): TypeSection[] {
  return TYPE_SECTION_MAP[type] ?? [];
}

/** Coverage of a type's sections against the current/detected section names.
 *  `match` makes detection tolerant of naming variants. */
export function sectionCoverage(type: ReportTypeName, sectionNames: string[]) {
  const spec = typeSectionsFor(type);
  const present = (e: TypeSection) => sectionNames.some(n => e.match.test(n));
  const required = spec.filter(s => s.tier === 'required');
  const recommended = spec.filter(s => s.tier === 'recommended');
  return {
    spec,
    requiredTotal: required.length,
    requiredPresent: required.filter(present).length,
    recommendedTotal: recommended.length,
    recommendedPresent: recommended.filter(present).length,
    missingRequired: required.filter(s => !present(s)),
    missingRecommended: recommended.filter(s => !present(s)),
    allMissing: spec.filter(s => !present(s)),
  };
}

export const SECTION_ICONS: Record<string, ElementType> = {
  'file-text': FileText,
  'alert-triangle': AlertTriangle,
  'shield': Shield,
  'check-circle': CheckCircle2,
  'bar-chart': BarChart3,
  'trending-up': TrendingUp,
  'clipboard-check': CheckCircle2,
  'lightbulb': Lightbulb,
  'book-open': BookOpen,
};

/** Theme name → cover-banner gradient (deep → mid). Mirrors the editor swatches. */
export const TEMPLATE_THEME_GRADIENT: Record<string, [string, string]> = {
  'Purple & White': ['#5b0fb0', '#6a12cd'],
  'Navy & Gold': ['#1a2744', '#2b3c5e'],
  'Teal & Light': ['#0a7268', '#0d9488'],
  'Slate & Blue': ['#1e293b', '#3b5573'],
};

// Blank base for the create-from-scratch flow — the TemplateEditor opens on
// this with an empty section list and a name the user is expected to replace.
export const BLANK_TEMPLATE = {
  id: 'ct-blank',
  name: 'Untitled Template',
  desc: 'Custom template',
  category: 'Custom',
  icon: 'file-text',
  sections: [] as { name: string; icon: string }[],
};

// Merge template lists into a single deduped option list (by id). Used to build
// the Apply Template dropdown: standard + the user's active customs + the
// report's own template (which may be a removed seed not in the active list).
// Lives here (not in TemplateEditor) so that module exports only components,
// keeping React Fast Refresh working for the editor.
export function mergeTemplateOptions(
  ...lists: (typeof REPORT_TEMPLATES[number] | null | undefined)[][]
): typeof REPORT_TEMPLATES[number][] {
  const seen = new Set<string>();
  const out: typeof REPORT_TEMPLATES[number][] = [];
  for (const t of lists.flat()) {
    if (t && !seen.has(t.id)) { seen.add(t.id); out.push(t); }
  }
  return out;
}

// ─── Report-type classification ──────────────────────────────────────────────
//
// A report's type is resolved from the most authoritative signal available, in
// priority order: explicit `kind` → originating template → ATR payload presence
// → name match (last resort, so renaming can never silently reclassify).
const TEMPLATE_KIND: Record<string, 'atr' | 'sox' | 'ia'> = {
  'rt-007': 'atr',
  'rt-001': 'sox',
  'rt-internal-audit': 'ia',
};

// Derive the kind for a freshly created report from its template. Stored as the
// report's explicit `kind` so the classification is frozen at creation.
export function templateKind(t?: { id?: string; name?: string } | null): 'atr' | 'sox' | 'ia' {
  if (t?.id && TEMPLATE_KIND[t.id]) return TEMPLATE_KIND[t.id];
  const name = (t?.name ?? '').toLowerCase();
  if (/\batr\b|action taken/.test(name)) return 'atr';
  if (/\bsox\b/.test(name)) return 'sox';
  return 'ia';
}

export function reportKind(r: { name?: string; atrData?: unknown; kind?: 'atr' | 'sox' | 'ia'; templateId?: string; tag?: string }): 'atr' | 'sox' | 'ia' {
  // Bulk Audit is an IA-style engagement — IA and Bulk are unified, and a Bulk
  // report is never SOX (regardless of its template or name).
  if (r.tag === 'Bulk Audit') return 'ia';
  if (r.kind) return r.kind;
  if (r.templateId && TEMPLATE_KIND[r.templateId]) return TEMPLATE_KIND[r.templateId];
  if (r.atrData) return 'atr';
  if (/\bsox\b/i.test(r.name ?? '')) return 'sox';
  return 'ia';
}

// ─── Shared types ────────────────────────────────────────────────────────────

export type AttachedQuery = {
  id: string;
  kind: 'query' | 'source' | 'upload';
  label: string;
  attachedAt: string;
  attachedBy: string;
};

// Shared shape used by Bulk Audit reports. A workflow result is the bulk-run
// counterpart of a saved query — same place in the report, different content.
export type WorkflowResult = {
  id: string;
  workflowId: string;        // display id, e.g. "P2P-001"
  name: string;
  businessProcess?: string;
  severity: 'High' | 'Medium' | 'Low';
  riskOwner?: string;        // optional — empty until the user fills it in
  findings: string[];
  observations: string[];
  outputTable?: {
    columns: string[];
    rows: (string | number)[][];
  };
  /** Run-time status. Missing = treated as 'succeeded' for back-compat with
   *  pre-existing reports. Failed runs are excluded from the report body and
   *  only acknowledged via a callout in the Executive Summary. */
  runStatus?: 'succeeded' | 'failed';
  /** Why the run failed. Only set when runStatus === 'failed'. */
  failureReason?: 'errored' | 'skipped';
};

// The bulk audit report detail page renders in a single editorial treatment.
export type BulkAuditAestheticVariant = 'editorial';

/** A report template plus the optional branding the Customize editor sets.
 *  Standard templates omit these; custom templates persist them. */
export type EditableTemplate = typeof REPORT_TEMPLATES[number] & {
  brand?: string;
  theme?: string;
  headerText?: string;
  footerText?: string;
  /** The "golden copy": section names of the reference sample this template is
   *  validated against. Set when a Smart Upload is marked as the reference format;
   *  drives the format-match verdict on later uploads (Template Studio §5).
   *  (Field name kept as `approvedSections` for stored-data compatibility.) */
  approvedSections?: string[];
  referenceFileName?: string;
};

// A seeded custom template that already has a reference format, so the
// format-match verdict (Template Studio §5) is demonstrable without first
// uploading twice. Mirrors the Air India "Annual Safety Audit" example: its
// reference format expects a "Corrective Actions" section, which the scripted
// drifted upload is missing. App.tsx prepends it to the custom-templates list.
export const SEED_APPROVED_TEMPLATE: EditableTemplate = {
  id: 'ct-seed-safety-audit',
  name: 'Annual Safety Audit Report',
  desc: 'Built from Annual_Safety_Audit_2025.pdf — 7 sections, set as the reference format.',
  category: 'Audit',
  icon: 'shield',
  sections: [
    { name: 'Executive Summary', icon: 'file-text' },
    { name: 'Scope & Objectives', icon: 'file-text' },
    { name: 'Testing Methodology', icon: 'file-text' },
    { name: 'Control Testing Results', icon: 'check-circle' },
    { name: 'Detailed Findings', icon: 'alert-triangle' },
    { name: 'Corrective Actions', icon: 'check-circle' },
    { name: 'Appendix', icon: 'file-text' },
  ],
  approvedSections: ['Executive Summary', 'Scope & Objectives', 'Testing Methodology', 'Control Testing Results', 'Detailed Findings', 'Corrective Actions', 'Appendix'],
  referenceFileName: 'Annual_Safety_Audit_2025.pdf',
};

export type QueryShape = { id: string; risk: string; severity: string; title: string; addedBy: string; kpis: { label: string; value: string; color: string }[]; summary: string; findings: string[]; observations: string[]; answer: string; chartData: number[] };

export type QueryComment = { id: string; queryId: string; queryTitle: string; author: string; initials: string; timestamp: string; text: string; attachment?: string };

// ─── Pure helpers ────────────────────────────────────────────────────────────

export function parseNumeric(v: string): number {
  const match = String(v).match(/-?\d[\d,.]*/);
  if (!match) return 0;
  return Number(match[0].replace(/[,\s]/g, '')) || 0;
}

export function computeQueryKpis(query: QueryShape) {
  const firstVal = parseNumeric((query.kpis ?? [])[0]?.value ?? '0');
  const total = firstVal > 0 ? firstVal : 40 + (query.id.charCodeAt(query.id.length - 1) % 120);
  const closed = Math.max(0, Math.round(total * (0.45 + ((query.id.charCodeAt(0) % 10) / 40))));
  const open = Math.max(0, total - closed);
  const healthPct = total > 0 ? Math.round((closed / total) * 100) : 0;
  return [
    { label: 'Total Exceptions', value: total.toLocaleString(),  icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
    { label: 'Open',             value: open.toLocaleString(),   icon: Loader2,       color: 'text-mitigated-700 bg-mitigated-50' },
    { label: 'Closed',           value: closed.toLocaleString(), icon: CheckCircle2,  color: 'text-compliant-700 bg-compliant-50' },
    { label: 'Check Health',     value: `${healthPct}%`,         icon: TrendingUp,    color: 'text-evidence-700 bg-evidence-50' },
  ];
}

// A generated/saved report, shared by the landing (ReportsView) and the detail
// reader (ReportView). Built on the mock seed shape plus the fields the wizard,
// templates, ATR flow, and sharing add at runtime.
export type GeneratedReport = typeof GENERATED_REPORTS[number] & {
  /** Authoritative report framework/type, frozen at creation. Preferred over
   *  any name- or template-based inference (see `reportKind`). */
  kind?: 'atr' | 'sox' | 'ia';
  /** Queries the Generate wizard baked into this report — when present, the
   *  report body renders these instead of the demo DEFAULT_QUERIES. */
  generatedQueries?: GeneratedQueryDef[];
  /** Executive-summary rollup composed from generatedQueries at generate time. */
  execSummary?: string;
  /** Audit coverage window stated on the cover (e.g. "FY26 Q2"), set in the wizard. */
  reportPeriod?: string;
  /** The template's advertised sections, baked at generate time so the report
   *  delivers the structure the template card promises (rendered as editable
   *  note blocks around the query body). */
  templateSections?: { name: string; icon: string }[];
  description?: string;
  workflowResults?: WorkflowResult[];
  aestheticVariant?: BulkAuditAestheticVariant;
  /** Explicit override for read-only state (Shared with me, archived). */
  isReadOnly?: boolean;
  /** Display name of the user who shared the report — surfaces in the chip. */
  sharedByName?: string;
  /** Present when this report is a generated Action Taken Report (renders via
   *  AtrReportView instead of the standard template/query report layout). */
  atrData?: AtrReportData;
  /** Monotonic save counter for an uploaded ATR — drives the v1, v2, … label.
   *  Lives on the persisted card so it survives the wizard closing on save. */
  atrVersion?: number;
  /** ATR-tab metadata for a saved ATR version. */
  riskOwner?: string;
  sourceReport?: string;
  /** Template branding carried onto the report at generate time (from the
   *  template's Customize fields) — applied to the cover banner / footer. */
  brand?: string;
  theme?: string;
  headerText?: string;
  footerText?: string;
};

// Simulated report download — shows a 'loading' toast that resolves to a
// 'success' toast after a short "preparing" delay. No real file is produced
// (the prototype's report exports are all mock).
export function startReportDownload(
  addToast: (t: { type: ToastType; message: string }) => string,
  updateToast: (id: string, patch: { type: ToastType; message: string }) => void,
  reportName: string,
  ext = 'pdf',
) {
  const file = `${reportName}.${ext}`;
  const id = addToast({ type: 'loading', message: `Preparing ${file}…` });
  window.setTimeout(() => {
    updateToast(id, { type: 'success', message: `${file} downloaded.` });
  }, 1800);
}

// First-run seeds for Custom Templates — used only until the user's own
// customs are persisted to localStorage.
export const CUSTOM_TEMPLATES = [
  {
    id: 'ct-custom-01',
    name: 'Third-Party Vendor Risk Scorecard',
    desc: 'Custom scorecard for third-party vendors with risk tiers, control gaps, and remediation SLAs.',
    category: 'Risk',
    icon: 'alert-triangle',
    sections: [
      { name: 'Vendor Overview', icon: 'file-text' },
      { name: 'Risk Tier Summary', icon: 'alert-triangle' },
      { name: 'Control Gaps', icon: 'shield' },
      { name: 'Remediation Plan', icon: 'check-circle' },
    ],
  },
  {
    id: 'ct-custom-02',
    name: 'Quarterly Audit Snapshot',
    desc: 'One-page executive snapshot of quarterly audit findings and status.',
    category: 'Audit',
    icon: 'file-text',
    sections: [
      { name: 'Quarter Summary', icon: 'file-text' },
      { name: 'Key Findings', icon: 'alert-triangle' },
      { name: 'Status & Owners', icon: 'check-circle' },
    ],
  },
  {
    id: 'ct-003',
    name: 'Internal Controls Health Report',
    desc: 'Tracks control design effectiveness and operating effectiveness across business processes.',
    category: 'Controls',
    icon: 'check-circle',
    sections: [
      { name: 'Scope', icon: 'file-text' },
      { name: 'Design Effectiveness', icon: 'shield' },
      { name: 'Operating Effectiveness', icon: 'check-circle' },
      { name: 'Recommendations', icon: 'trending-up' },
    ],
  },
  {
    id: 'ct-004',
    name: 'Board Slide Deck',
    desc: 'Executive board-ready deck with headline metrics, risk heatmap, and narrative commentary.',
    category: 'Executive',
    icon: 'trending-up',
    sections: [
      { name: 'Headline Metrics', icon: 'bar-chart' },
      { name: 'Risk Heatmap', icon: 'alert-triangle' },
      { name: 'Narrative', icon: 'file-text' },
      { name: 'Outlook', icon: 'trending-up' },
    ],
  },
  {
    id: 'ct-005',
    name: 'Ad-hoc Exception Summary',
    desc: 'Quick exception digest grouped by owner with action taken and resolution status.',
    category: 'Risk',
    icon: 'alert-triangle',
    sections: [
      { name: 'Exception List', icon: 'alert-triangle' },
      { name: 'Owner Responses', icon: 'file-text' },
      { name: 'Resolution Status', icon: 'check-circle' },
    ],
  },
  {
    id: 'ct-006',
    name: 'Finance Close Checklist',
    desc: 'Period-close checklist with reconciliation status, journal review, and sign-offs.',
    category: 'Audit',
    icon: 'clipboard-check',
    sections: [
      { name: 'Reconciliations', icon: 'check-circle' },
      { name: 'Journal Review', icon: 'file-text' },
      { name: 'Sign-offs', icon: 'shield' },
    ],
  },
];
