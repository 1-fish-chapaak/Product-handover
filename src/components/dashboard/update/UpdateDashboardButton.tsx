import { Upload } from 'lucide-react';

/** Header entry for the Update-Dashboard-Data dialog. The dashboard view
 *  renders it only when the dialog has something actionable: a replaceable
 *  file, a file-based workflow, or a database-connected one. */
export default function UpdateDashboardButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 h-9 border border-canvas-border bg-canvas-elevated rounded-lg text-ink-700 hover:text-brand-700 hover:bg-brand-50 hover:border-brand-200 text-[0.75rem] font-semibold transition-colors cursor-pointer"
      title="Bring this dashboard onto new data"
      data-testid="update-dashboard-button"
    >
      <Upload size={14} />
      Update Dashboard
    </button>
  );
}
