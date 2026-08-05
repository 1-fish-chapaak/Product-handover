// Shared, non-component pieces of the section review canvas — the evidence
// model, the fill-case labels, and the canvas section/block shapes. Kept out of
// the .tsx so the component file exports only components (Fast Refresh intact).

import {
  brandGradient, reportGradient, reportAccent,
  DEFAULT_TEMPLATE_BRAND, DEFAULT_THEME, defaultFooterText, BLANK_TEMPLATE, letterheadLine,
} from './reportShared';
import type { SectionFill, DataBinding, TemplateBlock } from './reportShared';

/**
 * "Check this" is never a mood. It is raised by exactly four situations, and a
 * flagged row jumps to the top of the review list with the tension named:
 *
 *   half-yes     a check fired on part of the evidence and failed on the rest
 *   unlabelled   the file labelled nothing, so we read position and arrangement
 *   twins        two parts resolved to the same thing and were merged
 *   no-line      the describing pass could not write a one-line summary
 *
 * Anything outside these four is not a flag: it is either kept or left out.
 */
export type CheckReason = 'half-yes' | 'unlabelled' | 'twins' | 'no-line';

/** What the flag says on the card. The tension itself, never "we are unsure":
 *  the user can act on a named tension and cannot act on a doubt. */
export const CHECK_REASON: Record<CheckReason, string> = {
  'half-yes': 'Some of this comes from your audit results and some of it does not. Say which, and we fill the rest.',
  unlabelled: 'The file labels nothing here, so we read it by where the boxes sit. Confirm what it is and it fills.',
  twins: 'Two headings pointed at the same part, so we merged them into one. Confirm that was right.',
  'no-line': 'We could not summarise this in one line. Add one.',
};

// The badge is grounded in the kind of evidence the detector actually has: an
// explicit styled heading, a heading inferred from size/boldness, a possible
// fragment, or a section added after the fact. Honest labels beat a confidence
// colour we can't back up.
export type Evidence = 'explicit' | 'inferred' | 'fragment' | 'added';

/** One typed block on the review canvas — the persisted block shape plus the
 *  detection facts review renders (confidence, page, source preview). */
export interface CanvasBlock extends TemplateBlock {
  id: string;
  confidence?: number;
  page?: number;
  preview?: string[];
}

/** A section on the review canvas: heading + description + typed blocks.
 *  `source` (body lines beneath the heading) is present only for detected
 *  sections — it drives "show in document" and marks detected vs added. */
export interface CanvasSection {
  id: string;
  name: string;
  /** One-line purpose — pre-filled by pass 6, editable, never an empty prompt. */
  description?: string;
  evidence: Evidence;
  /** Where content comes from at generation — the engine's guess; the user
   *  confirms it with the dropdown. 'mixed' = per-block fills differ. */
  fill?: SectionFill;
  /** Why the engine guessed this fill — one grey line of evidence the user
   *  checks against their own document. Cleared when the user overrides. */
  fillReason?: string;
  binding?: DataBinding;
  /** The section's typed blocks, expandable under the row. */
  blocks?: CanvasBlock[];
  source?: string[];
  /** How sure the detector is (0–1). At or below SHAKY_CONFIDENCE the row is
   *  flagged "check this" so the user fixes the doubtful 20% first. */
  confidence?: number;
  /** Which of the four situations raised "check this", when one did. The chip
   *  then names the tension instead of leaving the user to guess at it. */
  flag?: CheckReason;
  /** 1-based page of the uploaded PDF — drives jump-to-page. */
  page?: number;
  /** Appendix section (lettered heading). */
  appendix?: boolean;
  /** Carrier paperwork around the real report — excluded with one confirmation
   *  question, never silently. */
  wrapper?: boolean;
}

/** The only valid sanity check the canvas shows, and it is relative: our
 *  section list against the report's own contents page. A 40 section report
 *  with a 40 entry contents page is correct, not a failure. The reader hands
 *  back its own `ReadTocCheck` of the same shape, the way `ReadSection` and
 *  `CanvasSection` stay separate declarations. */
export interface TocCheck {
  docEntries: number;
  detected: number;
  verdict: 'match' | 'over-split' | 'under-detected';
}

/** Detections at or below this confidence are surfaced as "check this" so the
 *  user fixes the doubtful ones instead of proof-reading everything. */
export const SHAKY_CONFIDENCE = 0.7;

export const EVIDENCE_META: Record<Evidence, { label: string; dot: string; tint: string; text: string; flag: boolean }> = {
  explicit: { label: 'Explicit heading', dot: 'bg-compliant-500', tint: 'bg-compliant-50 text-compliant-700', text: 'text-compliant-700', flag: false },
  inferred: { label: 'Inferred — review', dot: 'bg-mitigated-500', tint: 'bg-mitigated-50 text-mitigated-700', text: 'text-mitigated-700', flag: true },
  fragment: { label: 'Possible fragment', dot: 'bg-high-500', tint: 'bg-high-50 text-high-700', text: 'text-high-700', flag: true },
  added: { label: 'Added for type', dot: 'bg-brand-500', tint: 'bg-brand-50 text-brand-700', text: 'text-brand-700', flag: false },
};

/**
 * The tag every part carries. A tag is not decoration: it is the instruction
 * the filling step reads. Here the client verifies it; at generation the engine
 * obeys it; and when a capability grows, only the tag changes and nothing else.
 *
 * The five fill cases, in dropdown order. The engine pre-selects; the user's
 * job is verify, not choose. Each option is explained by CONSEQUENCE — what
 * it does to their report, not what it is — so the question becomes "who
 * writes this part of my report?", answerable by anyone.
 */
export const FILL_META: Record<SectionFill, { label: string; hint: string; tint: string }> = {
  query: { label: 'Fills from audit results', hint: 'We write this fresh in every report from your audit results. It is the one place the AI writes.', tint: 'bg-compliant-50 text-compliant-700' },
  manual: { label: 'No data connected', hint: 'Appears blank in every report, for you to fill.', tint: 'bg-canvas text-ink-500' },
  fixed: { label: 'Fixed wording', hint: 'Prints these words exactly. The AI is never consulted.', tint: 'bg-brand-50 text-brand-700' },
  human: { label: 'A person fills this', hint: 'An empty box waiting for someone’s input.', tint: 'bg-mitigated-50 text-mitigated-700' },
  mixed: { label: 'Mixed, per block', hint: 'Different parts behave differently, so each block below carries its own tag.', tint: 'bg-evidence-50 text-evidence-700' },
};

/** Fixed wording whose only changing values are report details we hold, so the
 *  client name, the period and the dates print as blanks we fill each time.
 *  It is its own tag rather than a footnote on fixed wording, because what it
 *  makes happen at generation is different. */
export const FRAME_META = {
  label: 'Fixed frame with blanks',
  hint: 'Prints these words exactly, with your name, your period and the dates filled in each report.',
  tint: 'bg-brand-50 text-brand-700',
};

/** The tag a part actually shows: a fixed block whose changing values are
 *  report details is a frame, not plain fixed wording. */
export function fillTag(fill: SectionFill, frame?: boolean) {
  return fill === 'fixed' && frame ? FRAME_META : FILL_META[fill];
}

/** Every tag a part can carry, and what each one makes happen. Shown on the
 *  review screen so "verify the tags" is a job the client can actually do. */
export const TAG_GLOSSARY: { label: string; does: string; tint: string }[] = [
  { label: FILL_META.query.label, does: 'We write it fresh each report from your audit results. The only place the AI writes.', tint: FILL_META.query.tint },
  { label: FILL_META.fixed.label, does: 'Prints your stored words exactly. The AI is not consulted.', tint: FILL_META.fixed.tint },
  { label: FRAME_META.label, does: 'The same, with your name, period and dates filled in each time.', tint: FRAME_META.tint },
  { label: 'Setting', does: 'Structure printed on every report, like the signature page or the letterhead. Verified once.', tint: 'bg-evidence-50 text-evidence-700' },
  { label: 'Routed', does: 'Used by the engine, never a section. Your contents page feeds ours; dividers become group markers.', tint: 'bg-canvas text-ink-600' },
  { label: 'Check this', does: 'Kept, but sent to the top of this list with the reason we are unsure named.', tint: 'bg-mitigated-50 text-mitigated-700' },
  { label: 'Left out', does: 'Not in the template, listed once with its reason. Covered per report through Add Observation.', tint: 'bg-high-50 text-high-700' },
];

/** Short type label for a block chip. */
export const BLOCK_KIND_LABEL: Record<TemplateBlock['kind'], string> = {
  narrative: 'Text',
  table: 'Table',
  stat: 'Stat strip',
  slot: 'Fill-in slots',
  callout: 'Callout',
  chart: 'Chart',
  cards: 'Repeating card',
  signoff: 'Sign-off',
};

/** The letterhead the review canvas prints around the curated outline. */
export type ReviewChrome = {
  title: string;
  desc?: string;
  brand: string;
  headerText?: string;
  footerText?: string;
  gradient?: [string, string];
  accent?: string;
  logo?: string;
};

/**
 * Build that letterhead from what the read captured, falling back to what the
 * saved template will actually print. Both review surfaces call this, because
 * the cover a client approves has to be the cover the save produces: two
 * surfaces guessing their own fallbacks is two different promises, and the one
 * they see is decided by which door they came through.
 *
 * Their captured value always wins. Where the read found nothing, the caller's
 * own value stands in (the editor has a live brand and letterhead being typed);
 * where the caller has nothing either, the platform's defaults do, which is
 * exactly what the template will render with.
 */
export function reviewChrome(
  read: {
    furniture?: { confidentiality?: string; header: string[]; footer: string[]; fields: { auditEntity?: string } } | null;
    coverColor?: string;
    logo?: string;
  } | null | undefined,
  fallback: {
    title: string;
    desc?: string;
    brand?: string;
    headerText?: string;
    footerText?: string;
    theme?: string;
    brandColor?: string;
    logo?: string;
  },
): ReviewChrome {
  const f = read?.furniture;
  const brand = f?.fields.auditEntity || fallback.brand?.trim() || DEFAULT_TEMPLATE_BRAND;
  // Built, never joined raw: the same builder the editor's own fields use, so
  // the line on this cover is the line the template saves. A raw join brings
  // back the page counter ("PwC Page 2") and any repeat.
  const theirHeader = f?.confidentiality ? letterheadLine([f.confidentiality]) : (f?.header.length ? letterheadLine(f.header) : '');
  const theirFooter = f?.footer.length ? letterheadLine(f.footer) : '';
  const theme = fallback.theme || DEFAULT_THEME;
  return {
    title: fallback.title.trim() || BLANK_TEMPLATE.name,
    // The line under the title is the template's own, and a brand new one has
    // the blank template's. Defaulted here so neither surface invents its own.
    desc: fallback.desc || BLANK_TEMPLATE.desc,
    brand,
    // Their own running header if the read found one, and nothing otherwise:
    // a letterhead only says what their document said.
    headerText: theirHeader || fallback.headerText || '',
    footerText: theirFooter || fallback.footerText || defaultFooterText(brand),
    gradient: read?.coverColor
      ? brandGradient(read.coverColor)
      : reportGradient(theme, fallback.brandColor),
    accent: read?.coverColor ?? reportAccent(theme, fallback.brandColor),
    logo: read?.logo || fallback.logo || undefined,
  };
}

/**
 * When we cannot read the report.
 *
 * Some reports are too unusual to read: two parts found out of fifteen. Below
 * that floor the check screen is a pretence, so it is skipped and the builder
 * opens with whatever we did find, saying honestly that we read it badly.
 *
 * What is counted is PARTS, not sections. One repeating card standing for
 * fourteen findings is fourteen parts of their report accounted for, and
 * calling that a bad read because it came back as one section would be exactly
 * backwards: folding a deck into one repeating unit is the reader working.
 *
 * Their own contents page is the measure wherever the document has one, because
 * "too few parts" only means anything against how many the document claims. A
 * short memo with three parts is read perfectly; a 15-entry report read as two
 * is not.
 */
export function belowTheReadFloor(read: {
  toc?: { docEntries: number };
  pageCount: number;
  sections: { blocks?: { cardCount?: number }[] }[];
}): boolean {
  const parts = read.sections.reduce((n, s) => {
    const blocks = s.blocks ?? [];
    return n + Math.max(1, blocks.reduce((m, b) => m + (b.cardCount ?? 1), 0));
  }, 0);
  const claimed = read.toc?.docEntries ?? 0;
  if (claimed >= 6) return parts < Math.ceil(claimed / 3);
  return parts < 3 && read.pageCount >= 8;
}
