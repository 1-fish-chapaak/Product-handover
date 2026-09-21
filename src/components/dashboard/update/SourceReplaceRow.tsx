import { useState } from 'react';
import { FileSpreadsheet, Loader2, Table2, X } from 'lucide-react';
import Select from '../../ui/Select';
import { fileSourceHint, type DashboardFileSource } from '../../../data/dashboardUpdate';
import type { PoolFile } from './useFilePool';
import type { ReplaceState } from './useFileReplacements';
import SchemaDiffPanel from './SchemaDiffPanel';
import SourceColumnsPanel from './SourceColumnsPanel';
import { innerPanelCls } from './theme';

/** One replaceable file on Upload Data. Line 1: the file currently in use,
 *  the Columns toggle, and a dropdown assigning a pool file to it. The column
 *  check and its result render on their own lines below. */
export default function SourceReplaceRow({ source, state, disabled, pool, onAssign, onClear }: {
  source: DashboardFileSource;
  state: ReplaceState | undefined;
  disabled: boolean;
  /** Ready pool entries the dropdown assigns from. */
  pool: PoolFile[];
  onAssign: (poolFile: PoolFile) => void;
  onClear: () => void;
}) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const status = state?.status ?? 'idle';
  const validating = status === 'validating';

  return (
    <div className={`${innerPanelCls} p-3`} data-testid="source-replace-row">
      <div className="flex items-center gap-2.5">
        <FileSpreadsheet size={18} className="text-brand-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900 truncate" title={source.displayName}>{source.displayName}</p>
          <p className="text-xs text-ink-400 truncate">{fileSourceHint(source)}</p>
        </div>
        <button
          type="button"
          onClick={() => setColumnsOpen(v => !v)}
          className={`p-1.5 rounded-md cursor-pointer shrink-0 transition-colors ${columnsOpen ? 'text-brand-700 bg-brand-50' : 'text-ink-500 hover:text-brand-700 hover:bg-canvas'}`}
          title="View this file's columns"
          aria-label="View this file's columns"
          aria-pressed={columnsOpen}
        >
          <Table2 size={15} />
        </button>
        <div className="w-80 shrink-0">
          <Select
            value={state?.newSourceId ?? ''}
            onChange={e => {
              const picked = pool.find(p => p.sourceId === e.target.value);
              if (picked) onAssign(picked); else onClear();
            }}
            disabled={disabled || validating || pool.length === 0}
            title={state?.fileName ?? 'Select a replacement from the pool'}
            aria-label={`Replacement for ${source.displayName}`}
            data-testid="source-replace-select"
          >
            <option value="">{pool.length === 0 ? 'Add files to the pool first' : 'Keep the current file'}</option>
            {pool.map(p => <option key={p.sourceId} value={p.sourceId}>{p.name}</option>)}
          </Select>
        </div>
        {/* Reserved slot: keeps every dropdown on the same right edge whether
            or not a replacement is assigned. */}
        <span className="w-6 flex justify-center shrink-0">
          {Boolean(state?.newSourceId) && !validating && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-brand-100/60 cursor-pointer transition-colors"
              title="Discard this replacement"
              aria-label="Discard this replacement"
            >
              <X size={13} />
            </button>
          )}
        </span>
      </div>
      {validating && (
        <p className="mt-1.5 pl-7 flex items-center gap-1.5 text-xs text-ink-500">
          <Loader2 size={11} className="animate-spin shrink-0" />
          Checking columns against the dashboard widgets…
        </p>
      )}
      {columnsOpen && <SourceColumnsPanel columns={source.columns} />}
      {state?.diff && <SchemaDiffPanel diff={state.diff} />}
    </div>
  );
}
