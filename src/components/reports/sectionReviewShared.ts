// Shared, non-component pieces of the section review canvas — the evidence
// model, the fill-case labels, and the canvas section/block shapes. Kept out of
// the .tsx so the component file exports only components (Fast Refresh intact).

import type { SectionFill, DataBinding, TemplateBlock } from './reportShared';

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
  /** 1-based page of the uploaded PDF — drives jump-to-page. */
  page?: number;
  /** Appendix section (lettered heading). */
  appendix?: boolean;
  /** Carrier paperwork around the real report — excluded with one confirmation
   *  question, never silently. */
  wrapper?: boolean;
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

/** The five fill cases, in dropdown order. The engine pre-selects; the user's
 *  job is verify, not choose. Each option is explained by CONSEQUENCE — what
 *  it does to their report, not what it is — so the question becomes "who
 *  writes this part of my report?", answerable by anyone. */
export const FILL_META: Record<SectionFill, { label: string; hint: string; tint: string }> = {
  query: { label: 'Fills from audit data', hint: 'We write this automatically from your audit results.', tint: 'bg-compliant-50 text-compliant-700' },
  manual: { label: 'No data connected', hint: 'Appears blank in every report, for you to fill.', tint: 'bg-canvas text-ink-500' },
  fixed: { label: 'Fixed text', hint: 'Prints exactly these words, never rewritten.', tint: 'bg-brand-50 text-brand-700' },
  human: { label: 'A person fills this', hint: 'An empty box waiting for someone’s input.', tint: 'bg-mitigated-50 text-mitigated-700' },
  mixed: { label: 'Mixed — per block', hint: 'Different parts behave differently — set each below.', tint: 'bg-evidence-50 text-evidence-700' },
};

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
