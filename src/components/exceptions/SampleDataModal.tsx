import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Wand2, Plus, Trash2, ChevronDown, Info } from 'lucide-react';

type Mode = 'filter' | 'sample';

interface FilterRow {
  id: string;
  columnKey: string;
  condition: string;
}

export interface SampleDataPayload {
  name: string;
  mode: Mode;
  filterRows?: FilterRow[];
  samplePct?: number;
}

const COLUMN_OPTIONS = [
  { key: 'id',             label: 'Exception ID' },
  { key: 'riskCategory',   label: 'Risk Category' },
  { key: 'severity',       label: 'Severity' },
  { key: 'status',         label: 'Status' },
  { key: 'classification', label: 'Classification' },
  { key: 'classReview',    label: 'Class. Review' },
  { key: 'actionReview',   label: 'Action Review' },
  { key: 'lastUpdated',    label: 'Last Updated' },
];

const CONDITION_OPTIONS = [
  { key: '',             label: 'None' },
  { key: 'is',           label: 'Is' },
  { key: 'is-not',       label: 'Is not' },
  { key: 'contains',     label: 'Contains' },
  { key: 'does-not',     label: 'Does not contain' },
  { key: 'is-empty',     label: 'Is empty' },
  { key: 'is-not-empty', label: 'Is not empty' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.75rem] text-ink-500">{children}</span>;
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`relative ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 pl-3 pr-9 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 appearance-none focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20 cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
    </div>
  );
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
        checked ? 'border-brand-600' : 'border-ink-300'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${checked ? 'bg-brand-600' : 'bg-transparent'}`} />
    </span>
  );
}

export default function SampleDataModal({
  onClose,
  onCreate,
  defaultName = 'Sample Data 1',
  availableCount = 5,
  totalCount = 5,
}: {
  onClose: () => void;
  onCreate: (payload: SampleDataPayload) => void;
  defaultName?: string;
  availableCount?: number;
  totalCount?: number;
}) {
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<Mode>('filter');
  const [filters, setFilters] = useState<FilterRow[]>([
    { id: `f-${Date.now()}-1`, columnKey: '', condition: '' },
    { id: `f-${Date.now()}-2`, columnKey: '', condition: '' },
  ]);
  const [samplePct, setSamplePct] = useState(80);

  const canCreate = useMemo(() => {
    if (!name.trim()) return false;
    if (mode === 'sample') return samplePct > 0;
    return true; // filter rows are optional per reference
  }, [name, mode, samplePct]);

  const updateFilter = (id: string, patch: Partial<FilterRow>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };
  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };
  const addFilter = () => {
    setFilters(prev => [...prev, { id: `f-${Date.now()}-${prev.length + 1}`, columnKey: '', condition: '' }]);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-[94vw] max-h-[92vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[60] flex flex-col"
        role="dialog"
        aria-label="Sample the Data"
      >
        {/* Header */}
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Wand2 size={18} />
            </div>
            <div>
              <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">Sample the Data</h2>
              <p className="text-[0.75rem] text-ink-500 mt-1 leading-snug">
                Create a filtered or partial sample of your data to review, investigate, and resolve audit cases more efficiently.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* File name */}
          <div>
            <FieldLabel>File Name</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
            />
          </div>

          {/* Mode selector: Filter Rows by */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="sample-mode"
                checked={mode === 'filter'}
                onChange={() => setMode('filter')}
                className="sr-only"
              />
              <Radio checked={mode === 'filter'} />
              <span className="text-[0.8125rem] font-medium text-ink-800">Filter Rows by</span>
              <span className="text-[0.75rem] text-ink-500">(Optional)</span>
            </label>

            {mode === 'filter' && (
              <div className="mt-3 space-y-3">
                {filters.map((f) => (
                  <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] gap-3">
                    <div>
                      <FieldLabel>Column Name</FieldLabel>
                      <div className="mt-1">
                        <Select
                          value={f.columnKey}
                          onChange={(v) => updateFilter(f.id, { columnKey: v })}
                          options={COLUMN_OPTIONS}
                          placeholder="Select column"
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Format cells if...</FieldLabel>
                      <div className="mt-1">
                        <Select
                          value={f.condition}
                          onChange={(v) => updateFilter(f.id, { condition: v })}
                          options={CONDITION_OPTIONS.filter(o => o.key !== '')}
                          placeholder="None"
                          disabled={!f.columnKey}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeFilter(f.id)}
                      className="self-end w-10 h-10 rounded-[8px] flex items-center justify-center text-ink-400 hover:text-risk hover:bg-risk-50 cursor-pointer"
                      aria-label="Remove filter row"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addFilter}
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 hover:text-brand-700 cursor-pointer"
                >
                  <Plus size={13} />
                  Add another item
                </button>
              </div>
            )}
          </div>

          {/* Mode selector: Sample Rows (%) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="sample-mode"
                checked={mode === 'sample'}
                onChange={() => setMode('sample')}
                className="sr-only"
              />
              <Radio checked={mode === 'sample'} />
              <span className="text-[0.8125rem] font-medium text-ink-800">Sample Rows (%)</span>
            </label>

            {mode === 'sample' && (
              <div className="mt-3 space-y-3">
                <div className="relative w-[200px]">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={samplePct}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setSamplePct(Number.isFinite(v) ? Math.max(1, Math.min(100, v)) : 1);
                    }}
                    className="w-full h-10 pl-3 pr-9 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[0.8125rem] text-ink-800 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/20"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.75rem] text-ink-500">%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={samplePct}
                  onChange={(e) => setSamplePct(Number(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer"
                  style={{ accentColor: 'var(--color-brand-600)' }}
                />
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 bg-evidence-50/60 border border-evidence-50 rounded-[8px] px-3 py-2.5">
            <Info size={13} className="text-evidence-700 mt-0.5 shrink-0" />
            <p className="text-[0.75rem] text-ink-700 leading-snug">
              <span className="font-semibold">Note:</span> New Sample Data Sheet will be created.{' '}
              <span className="tabular-nums">{availableCount}/{totalCount}</span> Sample data sets available.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-5 text-[0.8125rem] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!canCreate) return;
              onCreate({
                name: name.trim(),
                mode,
                filterRows: mode === 'filter' ? filters.filter(f => f.columnKey) : undefined,
                samplePct: mode === 'sample' ? samplePct : undefined,
              });
            }}
            disabled={!canCreate}
            className={`h-10 px-5 text-[0.8125rem] font-semibold rounded-[8px] transition-colors ${
              canCreate
                ? 'bg-brand-600 text-white hover:bg-brand-500 cursor-pointer'
                : 'bg-brand-600/50 text-white/80 cursor-not-allowed'
            }`}
          >
            Create
          </button>
        </footer>
      </motion.div>
    </>
  );
}
