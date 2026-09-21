import { Loader2, X } from 'lucide-react';
import Select from '../../ui/Select';
import type { WorkflowInput } from '../../../data/dashboardUpdate';
import type { PoolFile } from './useFilePool';
import type { InputSlot } from './useInputSlots';
import SchemaDiffPanel from './SchemaDiffPanel';

/** One replaceable input of a linked workflow. Line 1: the input and a
 *  dropdown assigning a pool file to it. Line 2: the column check's result. */
export default function WorkflowInputSlotRow({ input, slot, disabled, pool, onAssign, onClear }: {
  input: WorkflowInput;
  slot: InputSlot;
  disabled: boolean;
  pool: PoolFile[];
  onAssign: (poolFile: PoolFile) => void;
  onClear: () => void;
}) {
  const validating = slot.status === 'validating';
  return (
    <div className="flex flex-col gap-0.5 py-0.5" data-testid="input-slot-row">
      <div className="flex items-center gap-2 text-xs min-w-0">
        <span className="font-medium text-ink-700 flex-1 min-w-0 truncate" title={`${input.inputName} (last used: ${input.fileName})`}>
          {input.inputName}:
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <div className="w-80 shrink-0">
            <Select
              sizeVariant="sm"
              value={slot.newSourceId ?? ''}
              onChange={e => {
                const picked = pool.find(p => p.sourceId === e.target.value);
                if (picked) onAssign(picked); else onClear();
              }}
              disabled={disabled || validating || pool.length === 0}
              title={slot.newFileName ?? 'Select a file from the pool'}
              aria-label={`File for ${input.inputName}`}
              data-testid="input-slot-select"
            >
              {/* No "keep the last-used file" option — the run gate needs every
                  input filled, so it only ever led to a disabled button. */}
              <option value="">{pool.length === 0 ? 'Add files to the pool first' : 'Choose a file…'}</option>
              {pool.map(p => <option key={p.sourceId} value={p.sourceId}>{p.name}</option>)}
            </Select>
          </div>
          <span className="w-6 flex justify-center shrink-0">
            {slot.newSourceId !== null && !validating && (
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-brand-100/60 disabled:opacity-40 cursor-pointer transition-colors"
                title="Clear this file"
                aria-label="Clear this file"
              >
                <X size={13} />
              </button>
            )}
          </span>
        </span>
      </div>
      {validating && (
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <Loader2 size={11} className="animate-spin shrink-0" />
          Checking columns against the current file…
        </p>
      )}
      {slot.status === 'ready' && (
        <p className="text-xs text-compliant-700 truncate" title={`Replaces ${input.fileName}`}>
          Will be used in the next run, replacing {input.fileName}
        </p>
      )}
      {slot.status === 'incompatible' && slot.diff && <SchemaDiffPanel diff={slot.diff} comparedTo="the workflow input" />}
    </div>
  );
}
