import { useState } from 'react';
import { Type, Hash, Plus, X, ChevronDown, Link2, Check } from 'lucide-react';
import type { ModelTable, Relationship, WidgetModelField, AggFn } from './relationshipTypes';
import { tablesConnected } from './joinEngine';

const AGGS: { value: AggFn; label: string }[] = [
  { value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Average' }, { value: 'count', label: 'Count' },
  { value: 'countDistinct', label: 'Distinct count' }, { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' },
];

/** Pick fields from one or more related tables. Tables connected to the current
 *  selection are marked; an unconnected selection prompts to connect tables. */
export default function MultiTableFieldPicker({
  tables, relationships, selected, onChange, onConnectTables,
}: {
  tables: ModelTable[];
  relationships: Relationship[];
  selected: WidgetModelField[];
  onChange: (next: WidgetModelField[]) => void;
  onConnectTables: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([tables[0]?.id].filter(Boolean) as string[]));
  const selectedTables = [...new Set(selected.map(f => f.table))];
  const isSelected = (t: string, c: string) => selected.some(f => f.table === t && f.column === c);

  const toggleField = (table: string, column: string, role: 'dimension' | 'measure') => {
    if (isSelected(table, column)) { onChange(selected.filter(f => !(f.table === table && f.column === column))); return; }
    onChange([...selected, role === 'measure' ? { table, column, role, agg: 'sum' } : { table, column, role }]);
  };
  const setAgg = (i: number, agg: AggFn) => onChange(selected.map((f, idx) => (idx === i ? { ...f, agg } : f)));
  const removeAt = (i: number) => onChange(selected.filter((_, idx) => idx !== i));

  const connectable = (tid: string) => selectedTables.length === 0 || tablesConnected(relationships, [...new Set([...selectedTables, tid])]);
  const notConnected = selectedTables.length > 1 && !tablesConnected(relationships, selectedTables);

  const labelFor = (t: string, c: string) => tables.find(x => x.id === t)?.columns.find(col => col.name === c)?.label ?? c;
  const tableName = (t: string) => tables.find(x => x.id === t)?.name ?? t;

  const dims = selected.filter(f => f.role === 'dimension');
  const measures = selected.filter(f => f.role === 'measure');

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-3 h-full min-h-0">
      {/* Table / field tree */}
      <div className="border border-border-light rounded-[10px] overflow-y-auto">
        {tables.map(t => {
          const open = expanded.has(t.id);
          const conn = connectable(t.id);
          return (
            <div key={t.id} className="border-b border-border-light/60 last:border-b-0">
              <button onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-paper-50 cursor-pointer">
                <ChevronDown size={13} className={`text-text-muted transition-transform ${open ? '' : '-rotate-90'}`} />
                <span className="text-[12.5px] font-semibold text-text flex-1 text-left truncate">{t.name}</span>
                {selectedTables.length > 0 && conn && !selectedTables.includes(t.id) && (
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 text-[9.5px] font-semibold bg-compliant-50 text-compliant-700 rounded-full"><Link2 size={9} /> connected</span>
                )}
              </button>
              {open && (
                <div className="pb-1.5">
                  {t.columns.map(c => {
                    const on = isSelected(t.id, c.name);
                    return (
                      <button key={c.name} onClick={() => toggleField(t.id, c.name, c.role)} className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left cursor-pointer ${on ? 'bg-primary-xlight/50' : 'hover:bg-paper-50'}`}>
                        {c.role === 'measure' ? <Hash size={12} className="text-evidence-700 shrink-0" /> : <Type size={12} className="text-text-muted shrink-0" />}
                        <span className="text-[12px] text-text flex-1 truncate">{c.label}</span>
                        {on ? <Check size={12} className="text-primary" /> : <Plus size={12} className="text-text-muted/50" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected fields */}
      <div className="border border-border-light rounded-[10px] p-3 overflow-y-auto flex flex-col gap-3">
        {notConnected && (
          <div className="rounded-[8px] bg-mitigated-50 border border-mitigated/30 px-2.5 py-2">
            <p className="text-[11.5px] text-mitigated-700 leading-snug mb-1.5">These tables aren't connected, so they can't be combined yet.</p>
            <button onClick={onConnectTables} className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-primary bg-white border border-primary/20 rounded-[8px] hover:bg-primary-xlight cursor-pointer"><Link2 size={11} /> Connect tables</button>
          </div>
        )}

        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Group by (dimensions)</div>
          {dims.length === 0 ? <p className="text-[11px] text-text-muted/70">Add a text/category field — e.g. Vendor Name, Month.</p> : (
            <div className="flex flex-wrap gap-1.5">
              {dims.map(f => {
                const idx = selected.indexOf(f);
                return (
                  <span key={`${f.table}.${f.column}`} className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 bg-paper-50 border border-border-light rounded-[8px] text-[11.5px] text-text">
                    <span className="text-text-muted text-[10px]">{tableName(f.table)} ·</span> {labelFor(f.table, f.column)}
                    <button onClick={() => removeAt(idx)} className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-risk-700 cursor-pointer"><X size={11} /></button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">Values (measures)</div>
          {measures.length === 0 ? <p className="text-[11px] text-text-muted/70">Add a numeric field — e.g. Invoice Amount, Duplicate Count.</p> : (
            <div className="space-y-1.5">
              {measures.map(f => {
                const idx = selected.indexOf(f);
                return (
                  <div key={`${f.table}.${f.column}`} className="flex items-center gap-1.5">
                    <select value={f.agg ?? 'sum'} onChange={e => setAgg(idx, e.target.value as AggFn)} className="h-7 px-1.5 bg-white border border-border-light rounded-[8px] text-[11px] text-text cursor-pointer focus:outline-none focus:border-primary/40">
                      {AGGS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    <span className="flex-1 inline-flex items-center gap-1 h-7 px-2 bg-paper-50 border border-border-light rounded-[8px] text-[11.5px] text-text min-w-0">
                      <span className="text-text-muted text-[10px] shrink-0">{tableName(f.table)} ·</span> <span className="truncate">{labelFor(f.table, f.column)}</span>
                    </span>
                    <button onClick={() => removeAt(idx)} className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-risk-700 cursor-pointer shrink-0"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
