// Shared class strings for the Update-dashboard dialog so Upload Data, Run
// Workflows, Sync Live Data and Previous Runs render as one surface.

/** Inner panel behind mapping rows (input slots / source rows): a soft brand
 *  tint with the white controls sitting on top. */
export const innerPanelCls = 'rounded-lg border border-brand-200/70 bg-brand-50/60';

/** A titled section card (Dashboard files / one workflow / one run list). */
export const sectionCls = 'rounded-xl border border-canvas-border bg-canvas p-4';

/** Primary CTA inside the dialog (Save / Bulk run / Sync now). */
export const primaryBtnCls =
  'inline-flex items-center gap-1.5 px-4 h-9 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer disabled:bg-canvas-border disabled:text-ink-400 disabled:shadow-none disabled:cursor-not-allowed shrink-0';

/** Quiet bordered button (Add files / Schedule / Back). */
export const outlineBtnCls =
  'inline-flex items-center gap-1.5 px-3 h-8 border border-canvas-border bg-canvas-elevated hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 text-ink-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0';

/** Text-only link button (Select all). */
export const linkBtnCls =
  'inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-600 disabled:opacity-50 cursor-pointer shrink-0';
