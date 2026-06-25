// Shared cell renderer for query result tables — matches the dashboard table
// styling exactly (DashboardView "Excel Issues Log"): first column brand-700,
// Severity/Risk → coloured bordered pills, Status → plain grey, Expected → bold.
// Used by both the "Choose What to Include" modal and the attached report card.

// Severity-pill palette from the dashboard table — bordered rounded-full pills.
export const SEVERITY_PILL: Record<string, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200',
  High: 'bg-orange-50 text-orange-700 border-orange-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-green-50 text-green-700 border-green-200',
};

/** Per-cell styling matching the dashboard table. */
export function cellRender(value: string, header: string, first: boolean) {
  if (/severit|^risk/i.test(header)) {
    return (
      <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${SEVERITY_PILL[value] || 'bg-gray-50 text-gray-600 border-canvas-border'}`}>
        {value}
      </span>
    );
  }
  const cls = first
    ? 'font-semibold text-brand-700'
    : /status/i.test(header) ? 'text-ink-500'
    : /expected/i.test(header) ? 'font-medium text-ink-900'
    : 'text-ink-800';
  return <span className={cls}>{value}</span>;
}
