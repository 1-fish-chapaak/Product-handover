import { useMemo, useState } from 'react';
import { Search, Check, ChevronDown, Eraser, List, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';

export type SlicerMode = 'list' | 'dropdown' | 'between';

const MODES: { id: SlicerMode; label: string; Icon: typeof List; numericOnly?: boolean }[] = [
  { id: 'list', label: 'List', Icon: List },
  { id: 'dropdown', label: 'Dropdown', Icon: ChevronsUpDown },
  { id: 'between', label: 'Between', Icon: SlidersHorizontal, numericOnly: true },
];

/**
 * Power BI–style slicer visual. Binds to a single model field and emits the set
 * of selected values; the dashboard feeds those into its ModelFilter pipeline so
 * every related widget filters (Power BI page-filter semantics). Supports the
 * three canonical slicer modes — List, Dropdown, Between (numeric range) — plus
 * search, Select all, single/multi-select and a clear (eraser) affordance.
 */
export default function SlicerWidget({
  colLabel, colType, values, mode, onModeChange, single, onSingleChange, selected, onChange,
}: {
  colLabel: string;
  colType: 'string' | 'number' | 'date';
  values: (string | number)[];
  mode: SlicerMode;
  onModeChange: (m: SlicerMode) => void;
  single: boolean;
  onSingleChange: (v: boolean) => void;
  selected: (string | number)[];
  onChange: (v: (string | number)[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const isNumeric = colType === 'number';

  const has = (v: string | number) => selected.some(s => String(s) === String(v));
  const filtered = useMemo(
    () => values.filter(v => !search || String(v).toLowerCase().includes(search.toLowerCase())),
    [values, search],
  );
  const allSelected = filtered.length > 0 && filtered.every(has);

  const toggle = (v: string | number) => {
    if (single) { onChange(has(v) && selected.length === 1 ? [] : [v]); return; }
    onChange(has(v) ? selected.filter(s => String(s) !== String(v)) : [...selected, v]);
  };
  const toggleAll = () => {
    if (allSelected) onChange(selected.filter(s => !filtered.some(f => String(f) === String(s))));
    else onChange([...new Set([...selected.map(String), ...filtered.map(String)])].map(k => {
      const orig = values.find(v => String(v) === k); return orig ?? k;
    }));
  };
  const clear = () => onChange([]);

  const selectionLabel = selected.length === 0 ? 'All' : selected.length === 1 ? String(selected[0]) : `${selected.length} selected`;

  // ── Between (numeric range) ──
  const nums = useMemo(() => values.map(Number).filter(n => !Number.isNaN(n)), [values]);
  const lo = nums.length ? Math.min(...nums) : 0;
  const hi = nums.length ? Math.max(...nums) : 0;
  const curMin = selected.length ? Math.min(...selected.map(Number)) : lo;
  const curMax = selected.length ? Math.max(...selected.map(Number)) : hi;
  const applyRange = (min: number, max: number) => {
    const inRange = values.filter(v => Number(v) >= min && Number(v) <= max);
    onChange(inRange.length === values.length ? [] : inRange); // full range ⇒ inactive
  };

  const activeMode: SlicerMode = mode === 'between' && !isNumeric ? 'list' : mode;

  return (
    <div className="h-full w-full flex flex-col p-3" onClick={e => e.stopPropagation()}>
      {/* Toolbar — mode switcher · clear */}
      <div className="flex items-center gap-1.5 mb-2 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] border border-canvas-border bg-canvas text-[11px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 cursor-pointer"
            title="Slicer style"
          >
            {(() => { const M = MODES.find(m => m.id === activeMode)!; return <><M.Icon size={12} aria-hidden="true" /> {M.label}</>; })()}
            <ChevronDown size={11} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="absolute z-30 mt-1 left-0 w-[160px] rounded-[9px] border border-canvas-border bg-canvas-elevated shadow-lg overflow-hidden">
              {MODES.map(m => {
                const disabled = m.numericOnly && !isNumeric;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => { onModeChange(m.id); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-canvas cursor-pointer'} ${activeMode === m.id ? 'text-brand-700 font-semibold' : 'text-ink-700'}`}
                  >
                    <m.Icon size={13} aria-hidden="true" /> {m.label}
                    {activeMode === m.id && <Check size={12} className="ml-auto text-brand-600" />}
                  </button>
                );
              })}
              {activeMode !== 'between' && (
                <>
                  <div className="h-px bg-canvas-border" />
                  <button
                    type="button"
                    onClick={() => { onSingleChange(!single); if (!single && selected.length > 1) onChange([selected[0]]); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-ink-700 hover:bg-canvas cursor-pointer"
                  >
                    <span className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center ${single ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border'}`}>{single && <Check size={10} />}</span>
                    Single select
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10.5px] text-ink-400 tabular-nums">{selected.length ? `${selected.length} of ${values.length}` : `${values.length} items`}</span>
          <button type="button" onClick={clear} disabled={!selected.length} title="Clear selection" className="w-6 h-6 inline-flex items-center justify-center rounded-[6px] text-ink-400 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"><Eraser size={13} /></button>
        </div>
      </div>

      {/* Body per mode */}
      {activeMode === 'between' ? (
        <div className="flex-1 flex flex-col justify-center gap-3 px-1">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-1">Min</label>
              <input type="number" value={curMin} min={lo} max={curMax} onChange={e => applyRange(Number(e.target.value), curMax)}
                className="w-full h-8 px-2 rounded-[7px] border border-canvas-border bg-canvas text-[12.5px] tabular-nums text-ink-800 focus:outline-none focus:border-brand-400" />
            </div>
            <span className="text-ink-300 mt-4">–</span>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-1">Max</label>
              <input type="number" value={curMax} min={curMin} max={hi} onChange={e => applyRange(curMin, Number(e.target.value))}
                className="w-full h-8 px-2 rounded-[7px] border border-canvas-border bg-canvas text-[12.5px] tabular-nums text-ink-800 focus:outline-none focus:border-brand-400" />
            </div>
          </div>
          {/* Range track */}
          <div className="px-0.5">
            <div className="relative h-1.5 rounded-full bg-brand-50">
              <div className="absolute h-full rounded-full bg-brand-500" style={{ left: `${hi > lo ? ((curMin - lo) / (hi - lo)) * 100 : 0}%`, right: `${hi > lo ? (1 - (curMax - lo) / (hi - lo)) * 100 : 0}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-ink-400 tabular-nums"><span>{lo}</span><span>{hi}</span></div>
          </div>
          <p className="text-[11px] text-ink-500 text-center">{selected.length ? `Filtering ${curLabel(curMin, curMax)}` : 'Full range — no filter applied'}</p>
        </div>
      ) : activeMode === 'dropdown' ? (
        <div className="flex-1 min-h-0">
          <button type="button" onClick={() => setDropOpen(o => !o)}
            className="w-full flex items-center gap-2 h-9 px-3 rounded-[8px] border border-canvas-border bg-canvas text-[12.5px] text-ink-700 hover:border-brand-300 cursor-pointer">
            <span className="truncate">{selectionLabel}</span>
            <ChevronDown size={14} className={`ml-auto shrink-0 text-ink-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropOpen && (
            <div className="mt-1.5 rounded-[9px] border border-canvas-border bg-canvas-elevated shadow-sm flex flex-col max-h-[calc(100%-52px)] overflow-hidden">
              <ValueSearch value={search} onChange={setSearch} />
              <ValueList values={filtered} has={has} toggle={toggle} single={single} allSelected={allSelected} onToggleAll={toggleAll} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <ValueSearch value={search} onChange={setSearch} />
          <ValueList values={filtered} has={has} toggle={toggle} single={single} allSelected={allSelected} onToggleAll={toggleAll} />
        </div>
      )}

      <div className="shrink-0 pt-2 mt-1 border-t border-canvas-border flex items-center gap-1.5">
        <span className="text-[10px] text-ink-400 truncate">Filters: <span className="font-semibold text-ink-600">{colLabel}</span></span>
      </div>
    </div>
  );
}

const curLabel = (min: number, max: number) => `${min} – ${max}`;

function ValueSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative shrink-0 mb-1.5">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="Search…"
        className="w-full h-8 pl-8 pr-2 rounded-[7px] border border-canvas-border bg-canvas text-[12px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-400" />
    </div>
  );
}

function ValueList({ values, has, toggle, single, allSelected, onToggleAll }: {
  values: (string | number)[];
  has: (v: string | number) => boolean;
  toggle: (v: string | number) => void;
  single: boolean;
  allSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
      {!single && values.length > 0 && (
        <button type="button" onClick={onToggleAll} className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-[6px] hover:bg-canvas cursor-pointer">
          <Box checked={allSelected} />
          <span className="text-[12px] font-semibold text-ink-700">Select all</span>
        </button>
      )}
      {values.map(v => (
        <button key={String(v)} type="button" onClick={() => toggle(v)} className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-[6px] hover:bg-canvas cursor-pointer text-left">
          {single ? <Radio checked={has(v)} /> : <Box checked={has(v)} />}
          <span className={`text-[12.5px] truncate ${has(v) ? 'text-brand-700 font-semibold' : 'text-ink-700'}`}>{String(v)}</span>
        </button>
      ))}
      {values.length === 0 && <p className="text-[12px] text-ink-400 px-1.5 py-3 text-center">No matching values.</p>}
    </div>
  );
}

const Box = ({ checked }: { checked: boolean }) => (
  <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-canvas'}`}>{checked && <Check size={11} strokeWidth={3} />}</span>
);
const Radio = ({ checked }: { checked: boolean }) => (
  <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${checked ? 'border-brand-600' : 'border-canvas-border'}`}>{checked && <span className="w-2 h-2 rounded-full bg-brand-600" />}</span>
);
