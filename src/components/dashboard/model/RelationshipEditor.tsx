import { useState } from 'react';
import { Plus, X, ArrowLeftRight, Info } from 'lucide-react';
import type { ModelTable, Relationship, ColumnPair } from './relationshipTypes';
import { tableById, pairHasActive } from './joinEngine';

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full h-9 px-2.5 bg-white border border-border-light rounded-[8px] text-[12.5px] text-text focus:outline-none focus:border-primary/40 cursor-pointer">
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Create / edit one relationship. Supports multi-column joins and the
 *  single-active-per-pair rule (Active is disabled when one already exists). */
export default function RelationshipEditor({
  tables, relationships, initial, onSave, onCancel,
}: {
  tables: ModelTable[];
  relationships: Relationship[];
  initial?: Relationship;
  onSave: (rel: Relationship) => void;
  onCancel: () => void;
}) {
  const [leftTable, setLeftTable] = useState(initial?.leftTable ?? '');
  const [rightTable, setRightTable] = useState(initial?.rightTable ?? '');
  const [pairs, setPairs] = useState<ColumnPair[]>(initial?.columnPairs ?? [{ left: '', right: '' }]);
  const [active, setActive] = useState(initial?.active ?? true);

  const lt = tableById(tables, leftTable);
  const rt = tableById(tables, rightTable);

  // Another active relationship already covers this pair? (ignore self when editing)
  const otherActive = !!leftTable && !!rightTable &&
    pairHasActive(relationships.filter(r => r.id !== initial?.id), leftTable, rightTable);
  const effectiveActive = otherActive ? false : active;

  const valid = leftTable && rightTable && leftTable !== rightTable &&
    pairs.length > 0 && pairs.every(p => p.left && p.right);

  const setPair = (i: number, patch: Partial<ColumnPair>) =>
    setPairs(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <div className="p-5">
      <h4 className="text-[14px] font-semibold text-text mb-1">{initial ? 'Edit connection' : 'New connection'}</h4>
      <p className="text-[12px] text-text-muted mb-4">Pick two tables and the column(s) that match between them. Rows are combined where those columns are equal.</p>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mb-3">
        <Select value={leftTable} onChange={v => { setLeftTable(v); setPairs([{ left: '', right: '' }]); }} placeholder="Select a table…" options={tables.filter(t => t.id !== rightTable).map(t => ({ value: t.id, label: t.name }))} />
        <ArrowLeftRight size={16} className="text-text-muted" />
        <Select value={rightTable} onChange={v => { setRightTable(v); setPairs([{ left: '', right: '' }]); }} placeholder="Select a table…" options={tables.filter(t => t.id !== leftTable).map(t => ({ value: t.id, label: t.name }))} />
      </div>

      {lt && rt && (
        <div className="space-y-2 mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Matching columns</div>
          {pairs.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <Select value={p.left} onChange={v => setPair(i, { left: v })} placeholder={`${lt.name} column…`} options={lt.columns.map(c => ({ value: c.name, label: c.label }))} />
              <span className="text-text-muted text-[12px]">=</span>
              <Select value={p.right} onChange={v => setPair(i, { right: v })} placeholder={`${rt.name} column…`} options={rt.columns.map(c => ({ value: c.name, label: c.label }))} />
              <button onClick={() => setPairs(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)} disabled={pairs.length === 1} className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"><X size={13} /></button>
            </div>
          ))}
          <button onClick={() => setPairs(prev => [...prev, { left: '', right: '' }])} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-hover cursor-pointer">
            <Plus size={13} /> Add another matching column (multi-column join)
          </button>
        </div>
      )}

      <label className={`flex items-center gap-2 mb-1 ${otherActive ? 'opacity-60' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={effectiveActive} disabled={otherActive} onChange={e => setActive(e.target.checked)} className="w-4 h-4 accent-brand-600 cursor-pointer disabled:cursor-not-allowed" />
        <span className="text-[12.5px] text-text">Use this connection when combining these tables (active)</span>
      </label>
      {otherActive && (
        <p className="text-[11.5px] text-mitigated-700 bg-mitigated-50 border border-mitigated/30 rounded-[8px] px-2.5 py-1.5 inline-flex items-start gap-1.5 mb-1">
          <Info size={13} className="mt-px shrink-0" /> An active connection already exists for these tables — this one will be saved as <b>Inactive</b>. You can switch which one is active from the list.
        </p>
      )}

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-light">
        <button onClick={onCancel} className="h-9 px-4 text-[12.5px] font-medium text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 cursor-pointer">Cancel</button>
        <button
          onClick={() => valid && onSave({ id: initial?.id ?? `rel-${Date.now()}`, leftTable, rightTable, columnPairs: pairs, active: effectiveActive })}
          disabled={!valid}
          className="h-9 px-5 text-[12.5px] font-semibold text-white bg-primary hover:bg-primary-hover rounded-[8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {initial ? 'Save connection' : 'Create connection'}
        </button>
      </div>
    </div>
  );
}
