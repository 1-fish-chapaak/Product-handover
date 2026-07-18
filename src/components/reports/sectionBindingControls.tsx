// Shared controls for a section's block type and its data binding, used by both
// the Template Editor outline and the import Review Canvas so the two surfaces
// bind a placeholder to a query the same way.
//
// The rule the whole feature turns on: a kpi/chart/table section holds no numbers
// of its own. A DataBinding names which query, and which field within it, fills
// the block at generate. The upload gives the section; the query gives the
// numbers — never scraped from the uploaded report.

import { Check, Info, X } from 'lucide-react';
import { bindableSources, fieldsForKind, knownScopeAreas, type GeneratedQueryDef } from './templateQueryPool';
import type { SectionKind, DataBinding, CatalogId } from './reportShared';

// The four block types, offered as a compact segmented control. Text is a
// heading + body; the other three are placeholders bound to query data.
const KIND_OPTIONS: { value: SectionKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'kpi', label: 'KPI' },
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
];

export function KindPicker({ value, onChange, size = 'md' }: { value: SectionKind; onChange: (k: SectionKind) => void; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-7 text-[0.6875rem]' : 'h-9 text-[0.75rem]';
  return (
    <div role="radiogroup" aria-label="Section type" className="inline-flex rounded-[8px] border border-canvas-border bg-canvas/40 p-0.5">
      {KIND_OPTIONS.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`no-focus-ring ${h} px-2.5 rounded-[6px] font-semibold transition-colors cursor-pointer ${active ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// The content-node control for a TEXT section — how a custom-named text section
// maps to the content model: prose (auto, inferred from the name), the findings
// pool (optionally scoped to one area, so a "7.2 Payments" section shows only
// that area's findings), or the recommendations rollup. This is the binding for a
// custom text section that should pull findings — no raw query wiring.
const TEXT_NODE_OPTS: { value: '' | 'findings' | 'recommendations'; label: string }[] = [
  { value: '', label: 'Prose (auto)' },
  { value: 'findings', label: 'Findings' },
  { value: 'recommendations', label: 'Recommendations' },
];
export function TextSourceControl({ catalogId, scopeFilter, onSetNode, onSetScope }: {
  catalogId?: CatalogId;
  scopeFilter?: string;
  onSetNode: (node: 'findings' | 'recommendations' | undefined) => void;
  onSetScope: (scope: string | undefined) => void;
}) {
  const scopes = knownScopeAreas();
  const selectClass = 'no-focus-ring h-7 text-[0.6875rem] max-w-[14rem] rounded-[6px] border border-canvas-border bg-white px-2 font-medium text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600/20';
  const current = catalogId === 'findings' || catalogId === 'recommendations' ? catalogId : '';
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[8px] border border-dashed border-canvas-border bg-canvas/40 px-2.5 py-2" onPointerDown={e => e.stopPropagation()}>
      <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">Fills from</span>
      <select aria-label="Content source" value={current} onChange={e => onSetNode((e.target.value || undefined) as 'findings' | 'recommendations' | undefined)} className={selectClass}>
        {TEXT_NODE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {catalogId === 'findings' && scopes.length > 0 && (
        <select aria-label="Scope area" value={scopeFilter ?? ''} onChange={e => onSetScope(e.target.value || undefined)} className={selectClass}>
          <option value="">All scope areas</option>
          {scopes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
    </div>
  );
}

// The binding row for a kpi/chart/table section — "Fills from [query] · [field]".
// Bound reads calm (evidence tint); unbound reads as an open task (amber), so the
// author can see at a glance which placeholders still need a source. Numbers come
// from the query at generate, never from the uploaded report.
export function SectionBindingControl({ kind, binding, onBind, dense = false, queries }: {
  kind: SectionKind;
  binding?: DataBinding;
  onBind: (b: DataBinding | undefined) => void;
  dense?: boolean;
  /** The report's live queries, when a report context supplies them — the picker
   *  then offers this report's real queries instead of the design-time catalog. */
  queries?: GeneratedQueryDef[];
}) {
  const sources = bindableSources(queries);
  const src = binding?.queryKey ? sources.find(s => s.queryKey === binding.queryKey) : undefined;
  const fields = fieldsForKind(src, kind);
  const bound = !!binding?.queryKey;
  const selectH = dense ? 'h-7 text-[0.6875rem]' : 'h-8 text-[0.75rem]';
  const selectClass = `no-focus-ring ${selectH} max-w-[15rem] rounded-[6px] border bg-white px-2 font-medium text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600/20`;
  const pickQuery = (queryKey: string) => {
    if (!queryKey) { onBind(undefined); return; }
    const next = sources.find(s => s.queryKey === queryKey);
    const first = fieldsForKind(next, kind)[0];
    onBind({ queryKey, ...(first ? { field: first.id } : {}) });
  };
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-[8px] border border-dashed ${dense ? 'px-2.5 py-2' : 'mt-3 px-3 py-2.5'} ${bound ? 'border-evidence-200 bg-evidence-50/50' : 'border-high-300 bg-high-50/40'}`}
      onPointerDown={e => e.stopPropagation()}
    >
      <span className={`inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${bound ? 'text-evidence-700' : 'text-high-700'}`}>
        {bound ? <Check size={12} /> : <Info size={12} />}
        {bound ? 'Fills from' : 'Unbound'}
      </span>
      <select
        aria-label="Query"
        value={binding?.queryKey ?? ''}
        onChange={e => pickQuery(e.target.value)}
        className={`${selectClass} ${bound ? 'border-evidence-200' : 'border-high-300'}`}
      >
        <option value="">Pick a query…</option>
        {sources.map(s => <option key={s.queryKey} value={s.queryKey}>{s.label}</option>)}
      </select>
      {bound && fields.length > 0 && (
        <select
          aria-label="Field"
          value={binding?.field ?? ''}
          onChange={e => onBind({ queryKey: binding!.queryKey, field: e.target.value || undefined })}
          className={`${selectClass} border-evidence-200`}
        >
          {fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      )}
      {bound && (
        <button
          type="button"
          onClick={() => onBind(undefined)}
          aria-label="Clear binding"
          className="no-focus-ring ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
