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

/** One-line "what belongs here" description per section. Shown as body copy in the
 *  template preview and used as the starter text when a report is generated, so a
 *  fresh section reads like a real report section. Keyword-matched so it fits
 *  custom / imported section names, with a generic fallback. */
const SECTION_BLURBS: { match: RegExp; blurb: string }[] = [
  { match: /executive|summary/i, blurb: 'A high-level overview of the audit’s purpose, key findings, and overall opinion.' },
  { match: /scope|objective/i, blurb: 'What the audit covered, the period reviewed, and the objectives it set out to test.' },
  { match: /methodology/i, blurb: 'How the work was performed — approach, sampling, and the data sources used.' },
  { match: /finding|observation|audit quer|issue/i, blurb: 'The issues identified during testing, each with evidence and a risk rating.' },
  { match: /recommendation|management action|map\b/i, blurb: 'Actionable steps to address each finding and strengthen the control environment.' },
  { match: /management response|response/i, blurb: 'Management’s agreed actions, owners, and target dates for each recommendation.' },
  { match: /conclusion|opinion|assertion/i, blurb: 'The overall assessment and audit opinion based on the work performed.' },
  { match: /sign-?off|approval/i, blurb: 'Approvals and signatures confirming the report is final.' },
  { match: /control environment/i, blurb: 'An overview of the control environment relevant to the areas under review.' },
  { match: /control testing|testing results/i, blurb: 'Results of control testing, showing design and operating effectiveness.' },
  { match: /deficienc|exception|gap|non-?compliance/i, blurb: 'Control gaps and exceptions raised, with severity and the processes affected.' },
  { match: /remediation|action plan/i, blurb: 'The plan to close each gap — owners, actions, and remediation timelines.' },
  { match: /framework|regulat/i, blurb: 'The regulations and frameworks in scope for this assessment.' },
  { match: /risk (finding|register)|register/i, blurb: 'The risks identified, captured as a register with context and ownership.' },
  { match: /rating|significance|severity/i, blurb: 'How each item is rated for likelihood and impact, and why it matters.' },
  { match: /heatmap/i, blurb: 'A visual summary of risks plotted by likelihood and impact.' },
  { match: /mitigation|treatment/i, blurb: 'Planned mitigations or treatments for the significant risks.' },
  { match: /action taken/i, blurb: 'The action taken against each original recommendation, with current status.' },
  { match: /closure|classification|status/i, blurb: 'Closure status and classification for each item being tracked.' },
  { match: /evidence/i, blurb: 'Supporting evidence and artefacts referenced by this report.' },
  { match: /due date|timeline|due/i, blurb: 'Target and actual dates for the actions being tracked.' },
  { match: /verification|auditor comment|management comment/i, blurb: 'Auditor verification notes and comments on the actions taken.' },
];
export function sectionBlurb(name: string): string {
  const hit = SECTION_BLURBS.find(b => b.match.test(name));
  return hit ? hit.blurb : 'Describe what this section will cover in the generated report.';
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

/** Theme name → cover-banner gradient (deep → mid). Single source of truth for
 *  the editor swatch picker (it iterates these keys) and the report cover banner.
 *  Add a combination here (and to TEMPLATE_THEME_SWATCH below) to expose it. */
export const TEMPLATE_THEME_GRADIENT: Record<string, [string, string]> = {
  'Purple & White': ['#5b0fb0', '#6a12cd'],
  'Indigo & Sky': ['#1e1b4b', '#4f46e5'],
  'Navy & Gold': ['#1a2744', '#2b3c5e'],
  'Ocean & Cyan': ['#083344', '#0891b2'],
  'Teal & Light': ['#0a7268', '#0d9488'],
  'Forest & Sage': ['#14432a', '#15803d'],
  'Slate & Blue': ['#1e293b', '#3b5573'],
  'Charcoal & Graphite': ['#18181b', '#3f3f46'],
  'Burgundy & Wine': ['#4c0519', '#9f1239'],
  'Bronze & Sand': ['#431407', '#9a3412'],
};

/** Theme name → the two named colours, shown as a pair of dots in the picker so
 *  the combination reads literally (purple + white, navy + gold…). Keep the keys
 *  in sync with TEMPLATE_THEME_GRADIENT. */
export const TEMPLATE_THEME_SWATCH: Record<string, [string, string]> = {
  'Purple & White': ['#6a12cd', '#f7f7fb'],
  'Indigo & Sky': ['#4f46e5', '#7dd3fc'],
  'Navy & Gold': ['#1a2744', '#c9a24b'],
  'Ocean & Cyan': ['#0e4b5e', '#06b6d4'],
  'Teal & Light': ['#0d9488', '#d7f7f1'],
  'Forest & Sage': ['#15803d', '#a7d3ac'],
  'Slate & Blue': ['#334155', '#3b82f6'],
  'Charcoal & Graphite': ['#1c1c1f', '#71717a'],
  'Burgundy & Wine': ['#9f1239', '#5a0b22'],
  'Bronze & Sand': ['#9a3412', '#e4c7a1'],
};

/** Theme name → content accent (section numbers, underline ticks, outline-rail
 *  index) so a themed report's body accents match its cover instead of clashing
 *  with brand purple. Each is readable on white. Falls back to brand-700 when a
 *  report has no theme. */
export const TEMPLATE_THEME_ACCENT: Record<string, string> = {
  'Purple & White': '#550fa5',
  'Indigo & Sky': '#4f46e5',
  'Navy & Gold': '#26436e',
  'Ocean & Cyan': '#0e7490',
  'Teal & Light': '#0d9488',
  'Forest & Sage': '#15803d',
  'Slate & Blue': '#3f5f86',
  'Charcoal & Graphite': '#3f3f46',
  'Burgundy & Wine': '#9f1239',
  'Bronze & Sand': '#9a3412',
};

// ─── Brand colour → report palette ──────────────────────────────────────────
// A single custom brand colour drives the report cover gradient + body accent,
// so changing it re-skins the whole report. Named themes above remain quick
// presets; a set brandColour overrides them.
const DEFAULT_BRAND = '#6a12cd';
/** Accept #rgb / #rrggbb (with or without #); returns null for anything else so
 *  callers can fall back rather than render a broken colour. */
function parseHexColor(hex?: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
export function isValidHexColor(hex?: string): boolean {
  return parseHexColor(hex) !== null;
}
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(n => clamp255(n).toString(16).padStart(2, '0')).join('');
/** Mix a colour toward a target ([0..1] amount toward target). */
function mixColor(c: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }, amount: number) {
  return { r: c.r + (target.r - c.r) * amount, g: c.g + (target.g - c.g) * amount, b: c.b + (target.b - c.b) * amount };
}
const BLACK = { r: 0, g: 0, b: 0 };
// Relative luminance (WCAG) for readability decisions.
function luminance(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Report cover gradient [deep, mid] derived from a brand colour — deep is the
 *  colour darkened, mid is the colour (matches the preset deep→mid look). A light
 *  brand colour is darkened first so white title text stays legible on the
 *  banner. Invalid/absent colour falls back to the brand purple gradient. */
export function brandGradient(hex?: string): [string, string] {
  const c = parseHexColor(hex);
  if (!c) return ['#3b0b72', DEFAULT_BRAND];
  let mid = c;
  let guard = 0;
  while (luminance(mid) > 0.42 && guard < 14) { mid = mixColor(mid, BLACK, 0.16); guard += 1; }
  const deep = mixColor(mid, BLACK, 0.42);
  return [toHex(deep.r, deep.g, deep.b), toHex(mid.r, mid.g, mid.b)];
}

/** Body accent (section numbers / ticks) from a brand colour — darkened enough
 *  to stay readable on white. Very light brand colours darken more. */
export function brandAccent(hex?: string): string {
  const c = parseHexColor(hex);
  if (!c) return '#550fa5';
  let out = c;
  // Darken toward black until luminance is low enough to read on white.
  let guard = 0;
  while (luminance(out) > 0.28 && guard < 12) { out = mixColor(out, BLACK, 0.18); guard += 1; }
  return toHex(out.r, out.g, out.b);
}

/** The report cover gradient: a valid custom brandColor wins, else the named
 *  theme, else undefined (callers default to brand purple). */
export function reportGradient(theme?: string, brandColor?: string): [string, string] | undefined {
  if (isValidHexColor(brandColor)) return brandGradient(brandColor);
  return theme ? TEMPLATE_THEME_GRADIENT[theme] : undefined;
}
/** The report body accent (numbers/ticks): custom brandColor wins, else theme. */
export function reportAccent(theme?: string, brandColor?: string): string {
  if (isValidHexColor(brandColor)) return brandAccent(brandColor);
  return (theme && TEMPLATE_THEME_ACCENT[theme]) || '#550fa5';
}

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

/** Page watermark config — a text or image mark laid diagonally across every
 *  page, with opacity / rotation / size controls. */
export type WatermarkPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';

export type WatermarkConfig = {
  enabled: boolean;
  mode: 'text' | 'image';
  text: string;
  imageDataUrl?: string;
  opacity: number;   // 0..1 (rendered fill)
  rotation: number;  // degrees, -90..90
  size: number;      // % of page width, 20..100
  /** Where the mark sits on the page. Absent = center (back-compat). */
  position?: WatermarkPosition;
};

export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: false,
  mode: 'text',
  text: 'CONFIDENTIAL',
  opacity: 0.08,
  rotation: -35,
  size: 60,
  position: 'center',
};

/** A section's block type (§4.7). Text is prose; KPI and Chart are *placeholders*
 *  — they hold no numbers. Values come from trusted query data at generate time,
 *  never scraped from an uploaded report. */
export type SectionKind = 'text' | 'kpi' | 'chart' | 'table';

/** One section in a template outline. */
export type TemplateSection = {
  name: string;
  icon: string;
  /** Author-editable one-line description of what the section covers. Absent =
   *  fall back to the auto blurb (sectionBlurb). Editable inline in the editor. */
  description?: string;
  /** Block type — text (a heading) or a kpi/chart/table placeholder. Absent = text.
   *  Placeholders are set by import detection; their numbers fill from query data
   *  at generate time, never scraped from an upload. */
  kind?: SectionKind;
  /** For KPI/chart/table placeholders — the label the block carried. */
  metric?: string;
  /** For chart blocks — the chart style. */
  chartType?: 'bar' | 'line';
};

/** A report template plus the optional branding the Customize editor sets.
 *  Standard templates omit these; custom templates persist them. */
export type EditableTemplate = Omit<typeof REPORT_TEMPLATES[number], 'sections'> & {
  sections: TemplateSection[];
  brand?: string;
  theme?: string;
  /** Custom brand colour (hex). When set, drives the report cover gradient +
   *  body accent, overriding the named `theme`. */
  brandColor?: string;
  headerText?: string;
  footerText?: string;
  /** Brand logo (data URL) shown on the letterhead cover. */
  logoDataUrl?: string;
  /** Diagonal page watermark (text or image). */
  watermark?: WatermarkConfig;
  /** Page numbers on the printed / exported report. Absent = on (reports
   *  paginate by default; the toggle removes them). */
  pageNumbers?: boolean;
  /** Sign-off block on the report. When enabled, `signatories` define the roles
   *  (Prepared by, Approved by…) each report gets a manual sign / sign-off for. */
  signoffEnabled?: boolean;
  signatories?: SignatorySlot[];
  /** Free-form tags for findability once the library grows (§9). */
  tags?: string[];
};

export type QueryShape = { id: string; risk: string; severity: string; title: string; addedBy: string; kpis: { label: string; value: string; color: string }[]; summary: string; findings: string[]; observations: string[]; answer: string; chartData: number[] };

export type QueryComment = { id: string; queryId: string; queryTitle: string; author: string; initials: string; timestamp: string; text: string; attachment?: string; attachments?: string[] };

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
  /** Custom brand colour (hex) carried from the template — drives cover + accent. */
  brandColor?: string;
  headerText?: string;
  footerText?: string;
  /** Page numbers on the exported report (carried from the template). Absent = on. */
  pageNumbers?: boolean;
  /** Sign-off block config carried from the template. */
  signoffEnabled?: boolean;
  signatories?: SignatorySlot[];
  /** Runtime sign state, keyed by signatory-slot id — set when a report is
   *  manually signed, cleared on sign-off. */
  signoffs?: Record<string, Signoff>;
};

/** A sign-off slot on the report: a role (Prepared by / Approved by…) and an
 *  optional pre-assigned name. */
export type SignatorySlot = { id: string; role: string; name?: string };
/** The manual sign record for a slot. */
export type Signoff = { signedBy: string; signedAt: string };
/** Default rows seeded when the sign-off block is first enabled. */
export const DEFAULT_SIGNATORIES: SignatorySlot[] = [
  { id: 'sig-prepared', role: 'Prepared by' },
  { id: 'sig-reviewed', role: 'Reviewed by' },
  { id: 'sig-approved', role: 'Approved by' },
];

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
