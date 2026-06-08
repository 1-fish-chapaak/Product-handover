/**
 * Administration — shared design tokens (constants only).
 *
 * Single source of truth for the form-field, button, and row-action classes
 * that AdminView and RolesWorkspace both consume. Presentational widgets live in
 * the sibling `AdminPrimitives.tsx` (kept separate so Fast Refresh stays happy:
 * a module may export components OR constants, not both).
 */

/* ── Form fields (canonical drawer / modal contents) ── */
export const FIELD_LABEL = 'block text-[0.75rem] font-semibold text-ink-700 mb-1.5';
export const FIELD_INPUT =
  'w-full px-3 h-10 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 outline-none placeholder:text-ink-400 focus:border-brand-600 transition-colors';
export const FIELD_SELECT = `${FIELD_INPUT} appearance-none cursor-pointer pr-9`;
export const FIELD_TEXTAREA =
  'w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 outline-none placeholder:text-ink-400 resize-none focus:border-brand-600 transition-colors';

/* ── Modal-footer buttons (h-9) ── */
export const BTN_CANCEL =
  'h-9 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas transition-colors cursor-pointer';
export const BTN_PRIMARY =
  'h-9 px-5 text-[0.8125rem] font-semibold text-white bg-brand-600 rounded-md hover:bg-brand-500 active:bg-brand-800 transition-colors cursor-pointer';

/* ── Page CTAs — flat, h-10, rounded-md (the spine actions). ── */
export const BTN_CTA_PRIMARY =
  'flex items-center gap-2 px-4 h-10 rounded-md bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer';
export const BTN_CTA_OUTLINE =
  'flex items-center gap-2 px-4 h-10 rounded-md border border-canvas-border bg-canvas-elevated text-ink-700 text-[0.8125rem] font-semibold hover:border-brand-200 hover:bg-canvas transition-colors cursor-pointer';

/* ── Row action — a small outlined secondary button (icon + word). Resting
      hairline border + elevated bg so it reads as a button at rest; hover
      darkens the border, tints bg, and turns the label brand. Mirrors
      BTN_CTA_OUTLINE at row scale (h-7). ── */
export const BTN_ROW =
  'inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] font-medium text-ink-600 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer';

/* ── Preset chip (Roles / Create Role) — a quick-set button: hairline border at
      rest so it reads as actionable, brand wash when it matches the selection. ── */
export const presetChip = (active: boolean) =>
  `inline-flex items-center px-3 h-7 rounded-full text-[0.75rem] font-medium border transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
    active
      ? 'bg-brand-50 text-brand-700 border-brand-200'
      : 'bg-canvas-elevated text-ink-600 border-canvas-border hover:border-brand-200 hover:text-brand-700 hover:bg-brand-50/50'
  }`;

/* ── Stat-ledger cell shape ── */
import type { LucideIcon } from 'lucide-react';
export interface Stat {
  key: string;
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  /** 'attention' tints the KPI card amber (mitigated) to flag an actionable gap. */
  tone?: 'attention';
}
