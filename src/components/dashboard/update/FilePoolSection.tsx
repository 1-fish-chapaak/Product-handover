import { useRef } from 'react';
import { FilePlus2, Loader2, X } from 'lucide-react';
import type { FilePool } from './useFilePool';
import SheetPickerModal from './SheetPickerModal';
import { outlineBtnCls } from './theme';

/** The shared file pool: pick MANY files at once, each becomes a chip. A
 *  multi-sheet workbook opens the sheet picker (one per workbook) and each
 *  picked sheet becomes its own pool entry. Rows and slots then assign from
 *  the pool via their dropdowns. */
export default function FilePoolSection({ pool, disabled, onRemove }: {
  pool: FilePool;
  disabled: boolean;
  /** Owned by the parent — removal must also unassign dependent rows/slots. */
  onRemove: (sourceId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { pool: entries, failedPool, isUploading, uploadError, sheetPicker } = pool;

  return (
    <div className="rounded-xl border border-canvas-border bg-canvas p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink-700">Files in pool ({entries.length})</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || isUploading || sheetPicker !== null}
          className={outlineBtnCls}
          data-testid="pool-add-files"
        >
          {isUploading ? <Loader2 size={13} className="animate-spin" /> : <FilePlus2 size={13} />}
          {isUploading ? 'Uploading…' : 'Add files'}
        </button>
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-ink-500">
          Add new files here. You can pick several at once; multi-sheet workbooks will ask which sheets to use.
        </p>
      )}
      {entries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(p => (
            <span
              key={p.sourceId}
              className={`flex items-center gap-1.5 pl-2.5 pr-1.5 h-7 rounded-full border text-xs max-w-72 ${p.status === 'failed' ? 'border-risk-200 bg-risk-50 text-risk-700' : 'border-canvas-border bg-canvas-elevated text-ink-700'}`}
              title={p.error ?? p.name}
              data-testid="pool-chip"
            >
              {p.status === 'processing' && <Loader2 size={11} className="animate-spin shrink-0 text-ink-400" />}
              <span className="truncate">{p.name}</span>
              <button
                type="button"
                onClick={() => onRemove(p.sourceId)}
                disabled={disabled}
                className="p-0.5 text-ink-400 hover:text-ink-700 disabled:opacity-40 cursor-pointer shrink-0"
                title="Remove from pool"
                aria-label={`Remove ${p.name} from pool`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Ingestion failures state the exact cause — a red chip alone says
          something broke but not what to do, and the reason must not be
          reachable only by hovering. */}
      {failedPool.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="pool-file-errors">
          {failedPool.map(p => (
            <p key={p.sourceId} className="text-xs text-risk-700 wrap-break-word">
              <span className="font-semibold">{p.name}:</span> {p.error ?? 'This file couldn’t be processed.'}
            </p>
          ))}
        </div>
      )}
      {uploadError !== null && <p className="text-xs text-risk-700 wrap-break-word">{uploadError}</p>}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        multiple
        className="hidden"
        data-testid="pool-file-input"
        onChange={e => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) void pool.addFiles(files);
        }}
      />
      {sheetPicker && (
        <SheetPickerModal
          key={`${sheetPicker.file.name}-${pool.sheetPickerPosition?.current ?? 0}`}
          item={sheetPicker}
          position={pool.sheetPickerPosition}
          onConfirm={pool.confirmPickedSheets}
          onCancel={pool.cancelSheetPicker}
        />
      )}
    </div>
  );
}
