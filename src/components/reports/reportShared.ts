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

// ─── Our words for how bad a problem is ──────────────────────────────────────
//
// One place. The severity picker shows this list, and it is the "ours" side of
// the rating-word matching screen an imported template opens with. Two lists
// would drift, and then the screen would offer a word the picker cannot set.

export type OurRating = 'high' | 'medium' | 'low';

export const OUR_SCALE: { value: OurRating; label: string; dot: string }[] = [
  { value: 'low', label: 'Low', dot: 'bg-compliant' },
  { value: 'medium', label: 'Medium', dot: 'bg-mitigated' },
  { value: 'high', label: 'High', dot: 'bg-risk' },
];

/** Our word → their word, settled once on the matching screen and saved on the
 *  template. Every rating a report prints is swapped through this. */
export type ScaleMap = Partial<Record<OurRating, string>>;

/** The words that plainly mean one of ours, worst first inside each rating so
 *  a client using both High and Critical gets the closer of the two. Only the
 *  easy ones: anything else is left for the client to sort on the screen. */
const RATING_SYNONYMS: Record<OurRating, RegExp[]> = {
  high: [/^high$/i, /^critical$/i, /^significant$/i, /^major$/i, /^severe$/i, /^(priority\s*)?(1|i|one)$/i, /^p1$/i, /^red$/i, /^unsatisfactory$/i],
  medium: [/^medium$/i, /^moderate$/i, /^med$/i, /^(priority\s*)?(2|ii|two)$/i, /^p2$/i, /^amber$/i, /^needs improvement$/i],
  low: [/^low$/i, /^minor$/i, /^(priority\s*)?(3|iii|three)$/i, /^p3$/i, /^green$/i, /^observation$/i, /^advisory$/i],
};

/**
 * The easy ones, filled in. One of their words per rating of ours, never the
 * same word twice, and nothing guessed: a rating we cannot match plainly is
 * left blank for the client to sort on the screen.
 */
export function proposeScaleMap(theirWords: string[] | undefined): ScaleMap {
  const words = (theirWords ?? []).map(w => w.trim()).filter(Boolean);
  if (words.length === 0) return {};
  const map: ScaleMap = {};
  const taken = new Set<string>();
  for (const { value } of OUR_SCALE) {
    for (const re of RATING_SYNONYMS[value]) {
      const hit = words.find(w => re.test(w) && !taken.has(w));
      if (hit) { map[value] = hit; taken.add(hit); break; }
    }
  }
  return map;
}

/** Their words the matching screen left unused: levels they have and we never
 *  raise, which is the client's call to make, not ours. */
export function unusedScaleWords(theirWords: string[] | undefined, map: ScaleMap): string[] {
  const used = new Set(Object.values(map).map(w => w.toLowerCase()));
  return (theirWords ?? []).filter(w => w.trim() && !used.has(w.trim().toLowerCase()));
}

/** Say one of our ratings in the client's own word. Always swapped through the
 *  map they settled, so the client never sees our wording in their document. */
export function sayRating(severity: string | undefined, map?: ScaleMap, scale?: string[]): string {
  const raw = (severity ?? '').trim();
  if (!raw) return raw;
  const ours = raw.toLowerCase();
  const mapped = map?.[ours as OurRating]
    // Our data carries Critical as well as High. It is not a level the picker
    // offers, so it prints as their worst word rather than as ours.
    ?? (ours === 'critical' ? map?.high : undefined);
  if (mapped) return mapped;
  // A template imported before the matching screen existed: fall back to the
  // captured scale by position, which is what it did before.
  if (scale?.length) {
    const hit = scale.find(s => s.toLowerCase() === ours);
    if (hit) return hit;
    if (ours === 'high' || ours === 'critical') return scale[0];
    if (ours === 'medium' || ours === 'moderate') return scale[Math.floor((scale.length - 1) / 2)];
    return scale[scale.length - 1];
  }
  return raw;
}

/** The letter a problem number carries for its rating, taken from the word the
 *  card prints, so the two can never disagree. */
export function ratingLetter(severity: string | undefined, map?: ScaleMap, scale?: string[]): string {
  const word = sayRating(severity, map, scale);
  return (word.match(/[A-Za-z]/)?.[0] ?? '').toUpperCase();
}

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
  { match: /appendix|annexure|attachment|schedule/i, blurb: 'Supporting schedules, source query outputs, and workpapers retained with this report.' },
  { match: /background|introduction|context/i, blurb: 'Why the audit was carried out and the context a reader needs before the findings.' },
  { match: /distribution|circulation/i, blurb: 'Who this report goes to, and in what capacity each recipient receives it.' },
  { match: /limitation|disclaimer|reliance/i, blurb: 'What this report does not cover, and the basis on which it may be relied upon.' },
];
export function sectionBlurb(name: string): string {
  const hit = SECTION_BLURBS.find(b => b.match.test(name));
  return hit ? hit.blurb : GENERIC_SECTION_BLURB;
}

/** The blurb a section falls back to when its name matches nothing known.
 *  Exported so the report reader can recognise a section that is still empty
 *  and show it as an empty state rather than printing the guidance as prose. */
export const GENERIC_SECTION_BLURB = 'Describe what this section will cover in the generated report.';

/** True when the text under a section heading is the "what belongs here" line
 *  rather than something written about this audit. Guidance is right in the
 *  template preview, where the reader is designing the shape. In a generated
 *  report it is a placeholder pretending to be a finding, so the reader shows
 *  it as an empty state instead. */
export function isSectionGuidance(name: string, text?: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return true;
  return t === sectionBlurb(name).trim() || t === GENERIC_SECTION_BLURB;
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

// What a template prints when it carries none of its own. One source, because
// the letterhead a client approves at review has to be the letterhead the save
// actually produces — a preview that guesses differently is a preview of a
// different report.
export const LETTERHEAD_SOFT_MAX = 60;
/** The characters a page strip is joined by. Ours is the middle dot, but a
 *  line lifted off someone's pages arrives in whatever their document used: a
 *  pipe, a bullet, a dash between two words with spaces around it. A dash with
 *  no spaces is inside a word (Procure-to-Pay), so it is left alone. */
const LETTERHEAD_SEPARATOR = /\s*[·|•]\s*|\s+[–—]\s+/;
/** The parts of a stored letterhead line, whatever it was joined by. */
export const splitLetterhead = (text: string): string[] =>
  text.split(LETTERHEAD_SEPARATOR).map(p => p.trim()).filter(Boolean);
/** A letterhead line out of the parts a read found running along the foot of
 *  their pages. Their document repeats those parts on every page, so the raw
 *  join comes back as "PwC · Section 1 · PwC · PwC Page 2 · …": the same firm
 *  name three times and a page number that is already its own setting. Repeats
 *  go, page counters go, and the line stops at the field's own limit on a
 *  separator rather than mid-word — the letterhead prints one line, so a
 *  115-character one was never going to survive anyway. */
export const letterheadLine = (parts: string[]): string => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of parts) {
    const part = raw
      // A page counter is a setting of its own, and it is what makes the same
      // strip read differently on every page: "PwC Page 2", "2 of 17 Internal
      // Audit". Only counter shapes go; "Section 1" is their wording and stays.
      .replace(/\bpages?\s*\d+\b/gi, ' ')
      .replace(/\b\d+\s*of\s*\d+\b/gi, ' ')
      .replace(/[·|•]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // A stray letter or digit left behind by a split is not a letterhead part.
    if (part.length < 2 || !/[a-z]/i.test(part)) continue;
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const next = kept.length ? `${kept.join(' · ')} · ${part}` : part;
    if (next.length > LETTERHEAD_SOFT_MAX) {
      // One part on its own, longer than the line allows: keep as much of their
      // wording as fits rather than dropping the line altogether.
      if (!kept.length) kept.push(part.slice(0, LETTERHEAD_SOFT_MAX).trim());
      break;
    }
    kept.push(part);
  }
  return kept.join(' · ');
};
/** Page counter shapes, the giveaway that a line was lifted off their pages
 *  rather than typed: the same strip reads "Page 2" on one page and "Page 3" on
 *  the next, and the page number is already its own setting. */
const PAGE_COUNTER = /\bpages?\s*\d+\b|\b\d+\s*of\s*\d+\b/i;
/** Whether a stored letterhead line is one WE joined out of a read, rather than
 *  one the user typed. Length alone cannot tell them apart: a long footer
 *  somebody wrote by hand is theirs and must be left exactly as written. A raw
 *  join always carries the marks of the page strip it came from — several parts
 *  separated by a join character, and either the same part more than once or a
 *  page counter. Nothing else is rewritten. */
export const looksLikeCapturedLetterhead = (text: string): boolean => {
  if (text.length <= LETTERHEAD_SOFT_MAX) return false;
  const parts = splitLetterhead(text);
  if (parts.length < 2) return false;
  const seen = new Set<string>();
  for (const part of parts) {
    if (PAGE_COUNTER.test(part)) return true;
    const key = part.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
};
/** The one format internal audit reports are written in. More than one template
 *  can carry the flag — two saved before the one-holder rule existed, or a blob
 *  hand-edited — and then every one of them claims the slot. The newest wins,
 *  which is the one saved last, and the rest keep everything except the flag. */
export const oneDefaultOnly = <T extends { isDefault?: boolean }>(templates: T[]): T[] => {
  let held = false;
  return templates.map(t => {
    if (!t.isDefault) return t;
    if (held) return { ...t, isDefault: undefined };
    held = true;
    return t;
  });
};
export const DEFAULT_TEMPLATE_BRAND = 'Irame';
/* No platform letterhead line. A template prints the confidentiality line a
 * read of the client's own report captured, and nothing at all otherwise: the
 * old "Confidential · For Internal Use Only" default was ours, not theirs. */
export const DEFAULT_THEME = 'Purple & White';
/** The one fact a template's cover actually has, in one place, because the
 *  same cover is drawn on three surfaces (the editor's live page, the check
 *  screen's to-be page and the template sheet) and they must not drift apart.
 *
 *  Date, Period, a reference number — every per-report blank the BYOT spec's
 *  cover shape names — belong to the ENGINE that fills a generated report's
 *  cover, not to this preview. The person looking at this screen is building
 *  the template, not reading a report: there is no date, no period, nothing
 *  behind those labels for them, so showing them here is noise, not shape.
 *  Organisation is the one fact a template actually settles, typed once with
 *  a platform default. */
export const templateCoverFields = (brand?: string): { label: string; value: string }[] => [
  { label: 'Generated by', value: brand?.trim() || DEFAULT_TEMPLATE_BRAND },
];
export const defaultFooterText = (brand?: string) => `Generated by ${brand?.trim() || DEFAULT_TEMPLATE_BRAND}`;

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
 *  never scraped from an uploaded report. `cards` is a repeating finding card
 *  (one saved shape, stamped once per finding); `human` is a slot only a real
 *  person may fill (sign-off, management response) — the AI never writes it.
 *  Legacy single-kind sections only — new BYOT sections carry `blocks`. */
export type SectionKind = 'text' | 'kpi' | 'chart' | 'table' | 'cards' | 'human';

// ─── BYOT block model ────────────────────────────────────────────────────────
// A section = heading + description + typed blocks. Extraction keeps the
// skeleton, never the content: block shapes and labels survive, values don't.

/** Where a block's content comes from at generation — the five cases, minus
 *  'mixed' (a section-level answer). A section is never silently skipped:
 *  query  → auto-filled from query data (fills by binding, prints their name)
 *  manual → kept, rendered empty, "No data connected — fill in manually"
 *  fixed  → prints word-for-word every time, never rewritten
 *  human  → a prompted empty state only a real person may fill */
export type BlockFill = 'query' | 'manual' | 'fixed' | 'human';
/** Section-level fill. 'mixed' = fill types attach to its blocks individually
 *  (a fixed objective + human scope list + data table under one heading). */
export type SectionFill = BlockFill | 'mixed';

/** Our side of a query-filled section's two identities: the DISPLAY NAME is
 *  theirs (printed exactly); the BINDING is ours — which concept fills it.
 *  Filling by binding works in any wording; matching heading text wouldn't. */
export type DataBinding =
  | 'findings' | 'summary' | 'metrics' | 'actions'
  /** The in-scope list, drafted from the category tags the report's queries
   *  carry. The client edits it; we never claim to know what was excluded. */
  | 'scope'
  /** An evidence annexure a finding points at ("Refer Annexure 1.1"): the
   *  exception rows the finding was raised from, in their annexure layout.
   *  Amounts inside our own exception rows are query output, so the money rule
   *  does not bar them — it bars figures from the client's books. */
  | 'evidence';

/** The kinds of building block a client report uses. */
export type TemplateBlockKind =
  | 'narrative'   // prose under a (sub-)heading
  | 'table'       // real table — column names kept, rows thrown away
  | 'stat'        // a stat strip: big numbers with captions (labels kept)
  | 'slot'        // fill-in-the-blank label + value pairs (labels kept)
  | 'callout'     // text set apart as a note / key point
  | 'chart'       // a figure placeholder
  | 'cards'       // one repeating card shape, stamped once per finding
  | 'signoff';    // signature slots (roles kept)

/** One typed block inside a template section. */
export type TemplateBlock = {
  kind: TemplateBlockKind;
  /** The label the block carried (sub-heading, caption, metric name). */
  label?: string;
  fill: BlockFill;
  binding?: DataBinding;
  /** Tables — column names from the header row (names only, rows discarded). */
  columns?: string[];
  /** Tables — the header row's column spans, so a merged header survives. A
   *  table's merge pattern is part of its shape; its values never are. */
  columnSpans?: number[];
  /** Charts — how the chart existed in their file. Only a real chart object
   *  carries labels we can read; a hand-drawn one is guessed from how its
   *  boxes are arranged, and a pasted one is an image with nothing in it. */
  chartKind?: 'object' | 'drawn' | 'picture';
  /** Charts — the slice / axis labels. "High, Medium, Low" makes a chart we
   *  can fill from severity counts; "Revenue" makes one we cannot. The old
   *  numbers are never kept either way. */
  chartLabels?: string[];
  /** Tables — set when rows reuse the finding IDs: auto-built from findings. */
  linkedTo?: string;
  /** Cards — field labels, human-only fields, ID shape, repeat count. */
  cardFields?: string[];
  humanFields?: string[];
  idPattern?: string;
  cardCount?: number;
  /** Fixed text — the verbatim lines this block prints, word-for-word. */
  fixedBody?: string[];
  /** Fixed text whose only changing values are report details we hold: the
   *  client name, the period, the date, the report title. The wording is kept
   *  exactly and those spots become blanks ({{entity}}, {{period}}, {{date}},
   *  {{title}}, {{reference}}, {{preparedBy}}) filled from the report each
   *  time. A disclaimer naming the client is textbook fixed wording, and the
   *  no-changing-values gate would otherwise throw it away. */
  frame?: boolean;
  /** Fixed wording that still speaks in the voice of whoever wrote their old
   *  report — "we have completed the audit", "our procedures", a firm's name.
   *  Printing another firm's voice on the client's own reports would certify an
   *  engagement that never happened, so the wording is kept as a STARTING DRAFT
   *  and flagged. The client edits it once and the flag clears: from then on it
   *  is locked wording like any other. Definitions and scale rules carry no
   *  voice, so they never get this. */
  authored?: boolean;
  /** Evidence annexures — which one this is, in the order the report prints
   *  them. An annexure holds ONE finding's exception rows, so annexure n fills
   *  from finding n's rows rather than from the first finding's every time. */
  evidenceIndex?: number;
  /** Stat strips / slots — the captions or labels kept (values discarded). */
  slotLabels?: string[];
  /** Sign-off — signatory roles found (Prepared by, Approved by…). */
  signRoles?: string[];
  /** A severity-split section ("Detailed findings — medium") holds the same
   *  repeating card, filtered to one rating. Without it every section claims
   *  every finding and generation stamps each one into all of them. */
  severity?: string;
  /** One block printed in two places (the net-risk table on the cover AND in
   *  the executive summary) is stored ONCE and placed twice. The definition
   *  carries `refId`; every other placement carries `ref` and no shape of its
   *  own, so editing the shape once keeps both positions in step. */
  refId?: string;
  ref?: string;
};

/** All blocks a template defines by `refId`, so a placement (`ref`) can be
 *  resolved back to the one stored shape. */
export function collectBlockLibrary(sections: TemplateSection[]): Record<string, TemplateBlock> {
  const lib: Record<string, TemplateBlock> = {};
  for (const s of sections) {
    for (const b of s.blocks ?? []) if (b.refId) lib[b.refId] = b;
  }
  return lib;
}

/** A placement resolved to the shape it points at. Its own label wins, so the
 *  second position can carry the heading the document gave it there. */
export function resolveBlock(block: TemplateBlock, library?: Record<string, TemplateBlock>): TemplateBlock {
  if (!block.ref) return block;
  const def = library?.[block.ref];
  if (!def) return block;
  return { ...def, refId: undefined, ref: block.ref, label: block.label ?? def.label, fill: block.fill };
}

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
  /** For table blocks — the column names read from the document's header row.
   *  Only the names survive extraction; the rows are always thrown away. */
  columns?: string[];
  /** For a table that reuses the finding IDs — the name of the findings section
   *  it's auto-built from, so the two sections can't disagree. */
  linkedTo?: string;
  /** For repeating cards — the field labels each card carries, in order. */
  cardFields?: string[];
  /** For repeating cards — the fields only a real person may fill (they render
   *  as an empty "awaiting response" slot, never AI-written). */
  humanFields?: string[];
  /** For repeating cards — the document's finding-ID shape, digits generalised
   *  ("IA-##-H##"). */
  idPattern?: string;
  /** For repeating cards — how many repeats the uploaded report carried. */
  cardCount?: number;
  /** Fixed text: this section prints word-for-word every time and is never
   *  rewritten at generation (rating definitions, legal lines). */
  fixed?: boolean;
  /** The verbatim lines a fixed section prints. */
  fixedBody?: string[];
  /** Where this section's content comes from at generation (the five cases).
   *  Guessed by extraction, confirmed by the user at review. Absent = query. */
  fill?: SectionFill;
  /** The data concept that fills this section (query-filled sections). */
  binding?: DataBinding;
  /** The section's typed blocks (BYOT). When present, generation renders these
   *  in order; the legacy single-kind fields above are for older templates. */
  blocks?: TemplateBlock[];
  /** Door 2 of "no data connected": content typed once in a generated report
   *  and remembered — pre-fills this section in every future report. Setup
   *  that never changes (distribution list, intro paragraph), not audit data. */
  savedContent?: string;
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
  /** A closing page — the "thank you" slide a committee deck ends on. Captured
   *  the same way the sign-off block is, and for the same reason: the shape IS
   *  the feature, so there is nothing to generate. Off unless their own report
   *  had one, and then it prints their exact closing line at the end. */
  closingEnabled?: boolean;
  closingText?: string[];
  /** The document's own rating language, captured at import — the finding scale
   *  (e.g. Critical / High / Medium / Low) and the overall-opinion scale (e.g.
   *  Effective → Unsatisfactory). Generated reports speak these words. */
  findingScale?: string[];
  opinionScale?: string[];
  /** Their word for each of ours, settled on the matching screen at import.
   *  Every rating a report prints goes through this — the tag on the card, the
   *  severity picker, the count strips, the letter in the problem number and
   *  the written sentences — so the client never sees our wording. */
  scaleMap?: ScaleMap;
  /** Free-form tags for findability once the library grows (§9). */
  tags?: string[];
  /** The engagement this template was built for, set once after creation.
   *  Informational only — it labels the template, it does not restrict who
   *  can use it or hide it from any other engagement's reports. */
  engagementId?: string;
  /** The file this format was read from, kept so the builder can still say
   *  where the shape came from long after the import ran. Nothing is read back
   *  out of the file; this is the name only. */
  sourceFileName?: string;
  /** Set when the answer was "all internal audit reports": every internal
   *  audit report is written in this format. One format holds it at a time, so
   *  saving another into it clears this flag from the old one, which stays on
   *  the list. Nothing is hidden by it and any single report can still be
   *  switched from its own Apply Template picker. */
  isDefault?: boolean;
};

export type QueryShape = { id: string; risk: string; severity: string; title: string; addedBy: string; kpis: { label: string; value: string; color: string }[]; summary: string; findings: string[]; observations: string[]; answer: string; chartData: number[] };

/** Query blocks a seeded demo report renders when it carries no generated
 *  queries of its own. Mirrors ReportView's DEFAULT_QUERIES — keep in step. */
export const DEMO_QUERY_COUNT = 2;

/**
 * How many query blocks this report actually renders when opened.
 *
 * The seed registry carries an advertised `queries` number that pre-dates the
 * reader, so a card could promise five queries and the reader open with two.
 * One rule, read by the list and the reader alike, so the count on the card is
 * the count on the page.
 */
export function renderedQueryCount(report: {
  generatedQueries?: unknown[];
  workflowResults?: unknown[];
  atrData?: unknown;
  queries?: number;
}): number {
  if (report.generatedQueries?.length) return report.generatedQueries.length;
  if (report.workflowResults?.length) return 0;
  if (report.atrData) return 0;
  return DEMO_QUERY_COUNT;
}

/**
 * Sections the report opens with: the executive summary, then one per query or
 * workflow run. This is the number the reader's outline shows, so the chip on
 * the card is checkable against the page it opens.
 *
 * It replaced a page count. Pages are not knowable from the registry: a PDF or
 * a Word file paginates on content, so a long results table quietly runs onto
 * another page and any number stated up front is wrong. The download modal
 * states pages only where they are exact, which is the PowerPoint deck.
 */
export function renderedSectionCount(report: {
  generatedQueries?: unknown[];
  workflowResults?: unknown[];
  atrData?: unknown;
  queries?: number;
}): number {
  return 1 + renderedQueryCount(report) + (report.workflowResults?.length ?? 0);
}

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

/**
 * Executive-summary tiles rolled up from the query cards printed below them.
 *
 * The row used to carry four fixed numbers that tied to nothing on the page, so
 * a reader who added the query cards up got a different answer to the headline.
 * Every tile here is a sum of what the sections actually show: exceptions and
 * closures come off the same KPI sets the cards render, and the risk count is a
 * count of the cards rated High. A query that reports something other than
 * exceptions (a data-quality pass, say) contributes nothing to the exception
 * total, which is the honest answer rather than a synthesised one.
 */
export function rollupReportStats(
  queries: { id: string; severity?: string; kpis?: { label: string; value: string }[] }[],
  kpisFor: (q: { id: string; severity?: string; kpis?: { label: string; value: string }[] }) => { label: string; value: string }[],
) {
  let total = 0;
  let closed = 0;
  for (const q of queries) {
    const kpis = kpisFor(q);
    const find = (label: string) => kpis.find(k => k.label.toLowerCase() === label)?.value;
    total += parseNumeric(find('total exceptions') ?? '0');
    closed += parseNumeric(find('closed') ?? '0');
  }
  const highRisk = queries.filter(q => q.severity === 'High').length;
  const health = total > 0 ? Math.round((closed / total) * 100) : 0;
  return [
    { label: 'Total Exceptions', value: total.toLocaleString(), icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
    { label: 'Closed',           value: closed.toLocaleString(), icon: CheckCircle2, color: 'text-compliant-700 bg-compliant-50' },
    { label: 'High-Risk Queries', value: String(highRisk),       icon: Shield,       color: 'text-risk-700 bg-risk-50' },
    { label: 'Closure Rate',     value: `${health}%`,            icon: TrendingUp,   color: 'text-evidence-700 bg-evidence-50' },
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
   *  note blocks around the query body; typed blocks — tables, repeating cards,
   *  fixed text, human slots — render as their block shape). */
  templateSections?: TemplateSection[];
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
  /** Closing page carried from the template. */
  closingEnabled?: boolean;
  closingText?: string[];
  /** Brand mark carried from the template, shown on the report letterhead. */
  logoDataUrl?: string;
  /** Rating language carried from the template (captured at import). */
  findingScale?: string[];
  opinionScale?: string[];
  /** Their word for each of ours, carried from the template. Every rating this
   *  report prints is swapped through it. */
  scaleMap?: ScaleMap;
  /** Runtime sign state, keyed by signatory-slot id — set when a report is
   *  manually signed, cleared on sign-off. */
  signoffs?: Record<string, Signoff>;
  /** Template picked from the reader's Apply Template control. Set once the
   *  user applies one, and preferred over `templateId` when the reader reopens,
   *  so the choice survives navigating away and reloads. */
  appliedTemplateId?: string;
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

