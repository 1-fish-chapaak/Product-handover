import { inferColumnType } from '../../../data/dashboardUpdate';

/** Inline column list under a replace row (name + type). In normal flow — a
 *  popover would clip against the dialog's scroll container. */
export default function SourceColumnsPanel({ columns }: { columns: string[] }) {
  return (
    <div className="mt-2 rounded-lg border border-canvas-border bg-canvas p-3 max-h-48 overflow-y-auto" data-testid="source-columns">
      {columns.length === 0 ? (
        <p className="text-xs text-ink-500">No column info available.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {columns.map(col => (
            <li key={col} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-900 truncate">{col}</span>
              <span className="text-xs text-ink-400 uppercase shrink-0">{inferColumnType(col)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
