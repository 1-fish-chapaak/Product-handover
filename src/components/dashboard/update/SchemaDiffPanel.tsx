import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import type { SchemaDiff } from '../../../data/dashboardUpdate';

/** Column diff for a proposed replacement. A mismatch shows only its headline
 *  and counts by default (these lists run to dozens of columns); the detail
 *  expands on click. Missing/extra columns block; type differences are advisory. */
export default function SchemaDiffPanel({ diff, comparedTo = 'the original source' }: {
  diff: SchemaDiff;
  /** What the new file was compared against, for the heading wording. */
  comparedTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const counts = [
    diff.missingColumns.length > 0 ? `${diff.missingColumns.length} missing` : '',
    diff.extraColumns.length > 0 ? `${diff.extraColumns.length} extra` : '',
    diff.dtypeMismatches.length > 0 ? `${diff.dtypeMismatches.length} type differences` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="mt-2 rounded-lg border border-canvas-border bg-canvas p-3 text-xs" data-testid="schema-diff">
      {diff.compatible ? (
        <p className="flex items-center gap-1.5 text-compliant-700 font-medium">
          <CheckCircle2 size={14} />
          Columns match. Saving will switch the widgets to this file.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-1.5 text-risk-700 font-medium cursor-pointer text-left"
          data-testid="schema-diff-toggle"
        >
          <XCircle size={14} className="shrink-0" />
          <span className="min-w-0 truncate">Columns don’t match {comparedTo}.</span>
          <span className="ml-auto flex items-center gap-1 text-ink-500 font-normal shrink-0">
            {counts}
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </button>
      )}
      {(open || diff.compatible) && (diff.missingColumns.length > 0 || diff.extraColumns.length > 0 || diff.dtypeMismatches.length > 0) && (
        <div className="mt-2">
          {diff.missingColumns.length > 0 && (
            <div className="mb-2">
              <p className="font-semibold text-ink-700 mb-1">Missing columns (present in the original, absent in the new file):</p>
              <ul className="list-disc pl-5 text-ink-500 max-h-40 overflow-y-auto">
                {diff.missingColumns.map(col => <li key={col}>{col}</li>)}
              </ul>
            </div>
          )}
          {diff.extraColumns.length > 0 && (
            <div className="mb-2">
              <p className="font-semibold text-ink-700 mb-1">Extra columns (not in the original source):</p>
              <ul className="list-disc pl-5 text-ink-500 max-h-40 overflow-y-auto">
                {diff.extraColumns.map(col => <li key={col}>{col}</li>)}
              </ul>
            </div>
          )}
          {diff.dtypeMismatches.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-semibold text-ink-500 mb-1">
                <AlertTriangle size={13} />
                Type differences (allowed, verify the values look right):
              </p>
              <ul className="list-disc pl-5 text-ink-500 max-h-40 overflow-y-auto">
                {diff.dtypeMismatches.map(m => <li key={m.column}>{m.column}: {m.expected} → {m.actual}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
