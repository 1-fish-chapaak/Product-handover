import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Check, X, Pencil, Search, Lock, Sparkles,
  Type, List, CalendarDays, Hash, Info, FormInput, Asterisk, Eye, EyeOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../../shared/Button';
import Toggle from '../../../shared/Toggle';
import ConfirmDialog from '../../ConfirmDialog';
import { useToast } from '../../../shared/Toast';
import { useAdminSettings, LOV_DEFS } from '../adminStore';
import {
  BUILTIN_REPORT_FIELDS, AUTO_REPORT_FIELDS, REPORT_FIELD_TYPE_LABEL,
  type ReportFieldType, type CustomReportField,
} from '../reportFields';

const INPUT_CLS = 'w-full h-9 px-3 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const SMALL_INPUT_CLS = 'w-full h-8 px-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

// ─── One unified catalogue: every field the admin can shape ───
// Report-details fields (built-in + custom), the observation-analysis dropdowns,
// and the auto-filled fields. Selecting one on the left shows all its settings
// on the right — requirement, type, and (for dropdowns) the list of values — so
// there is one place to look instead of a page of cards.
type Kind = 'text' | 'select' | 'date' | 'number' | 'daterange' | 'auto';
interface Item {
  key: string;
  label: string;
  group: 'report' | 'observation' | 'auto';
  kind: Kind;
  /** Where the dropdown's values live (select kinds only). */
  lovKey?: string;
  required?: boolean;
  lockedRequired?: boolean;
  /** Left off the form + report header (report-group fields only). */
  hidden?: boolean;
  note?: string;
  custom?: CustomReportField;
}

const KIND_ICON: Record<Kind, LucideIcon> = { text: Type, select: List, date: CalendarDays, daterange: CalendarDays, number: Hash, auto: Lock };
const KIND_LABEL: Record<Kind, string> = { text: 'Text', select: 'Dropdown', date: 'Date', daterange: 'Date range', number: 'Number', auto: 'Auto-filled' };
const TYPES: ReportFieldType[] = ['text', 'select', 'date', 'number'];

function KindChip({ kind, size = 'md' }: { kind: Kind; size?: 'sm' | 'md' }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-paper-100 text-ink-600 font-medium whitespace-nowrap ${size === 'sm' ? 'h-5 px-1.5 text-[0.625rem]' : 'h-6 px-2 text-[0.6875rem]'}`}>
      <Icon size={size === 'sm' ? 10 : 11} aria-hidden="true" /> {KIND_LABEL[kind]}
    </span>
  );
}

/** Segmented type picker for the add / edit forms. */
function TypePicker({ value, onChange }: { value: ReportFieldType; onChange: (t: ReportFieldType) => void }) {
  return (
    <div role="radiogroup" aria-label="Field type" className="inline-flex items-center rounded-md border border-canvas-border bg-canvas-elevated p-0.5">
      {TYPES.map(t => {
        const Icon = KIND_ICON[t];
        const on = value === t;
        return (
          <button
            key={t} type="button" role="radio" aria-checked={on} onClick={() => onChange(t)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-sm text-[0.75rem] font-semibold transition-colors cursor-pointer ${on ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-canvas hover:text-ink-900'}`}
          >
            <Icon size={13} aria-hidden="true" /> {REPORT_FIELD_TYPE_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}

/** Add / edit form for a custom field. */
function FieldForm({ initial, existingLabels, onSave, onCancel, submitLabel }: {
  initial?: CustomReportField;
  existingLabels: string[];
  onSave: (f: Omit<CustomReportField, 'key'>) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [type, setType] = useState<ReportFieldType>(initial?.type ?? 'text');
  const [required, setRequired] = useState(initial?.required ?? false);
  const [placeholder, setPlaceholder] = useState(initial?.placeholder ?? '');
  const trimmed = label.trim();
  const clash = !!trimmed && existingLabels.some(l => l.toLowerCase() === trimmed.toLowerCase() && l.toLowerCase() !== (initial?.label ?? '').toLowerCase());
  const ok = !!trimmed && !clash;
  const submit = () => { if (ok) onSave({ label: trimmed, type, required, placeholder: placeholder.trim() || undefined }); };
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/30 p-5">
      <h4 className="text-[0.875rem] font-semibold text-ink-900 mb-4">{initial ? `Edit “${initial.label}”` : 'Add a field to Report details'}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-4">
        <div>
          <label className="block text-[0.75rem] font-semibold text-ink-700 mb-1.5">Field name <span className="text-risk-700">*</span></label>
          <input
            autoFocus value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
            placeholder="e.g. Cost Centre, Auditee Head, Engagement Code"
            aria-invalid={clash}
            className={`${INPUT_CLS} ${clash ? 'border-risk-400' : ''}`}
          />
          {clash && <p className="mt-1 text-[0.6875rem] text-risk-700">A field called “{trimmed}” already exists.</p>}
        </div>
        <div>
          <label className="block text-[0.75rem] font-semibold text-ink-700 mb-1.5">What kind of answer?</label>
          <TypePicker value={type} onChange={setType} />
        </div>
        {type !== 'select' && type !== 'date' && (
          <div className="sm:col-span-2">
            <label className="block text-[0.75rem] font-semibold text-ink-700 mb-1.5">Placeholder <span className="font-normal text-ink-400">· optional hint shown inside the empty field</span></label>
            <input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder={type === 'number' ? 'e.g. 12' : 'e.g. Enter the cost centre code'} className={INPUT_CLS} />
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2.5 cursor-pointer">
          <Toggle checked={required} onChange={setRequired} ariaLabel="Mandatory" />
          <span className="text-[0.8125rem] text-ink-700">{required ? 'Mandatory — must be filled before extracting' : 'Optional — can be left blank'}</span>
        </label>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="md" leftIcon={<X size={14} />} onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="md" leftIcon={<Check size={14} />} onClick={submit} disabled={!ok}>{submitLabel}</Button>
        </div>
      </div>
      {type === 'select' && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[0.71875rem] text-ink-500"><Info size={12} aria-hidden="true" /> You'll add the dropdown's options right after saving.</p>
      )}
    </div>
  );
}

/** The values editor for one dropdown — add, rename, reorder, remove, reset. */
function ValuesEditor({ lovKey, label, custom }: { lovKey: string; label: string; custom?: boolean }) {
  const { lov, setLov, resetLov, addLog } = useAdminSettings();
  const { addToast } = useToast();
  const values = lov(lovKey);
  const [adding, setAdding] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const commitAdd = () => {
    const v = adding.trim();
    if (!v) return;
    if (values.some(x => x.toLowerCase() === v.toLowerCase())) { addToast({ type: 'warning', message: `"${v}" is already in ${label}.` }); return; }
    setLov(lovKey, [...values, v]);
    addLog({ action: 'Config', target: `${label} list`, detail: `Added value "${v}"` });
    setAdding('');
  };
  const rename = (i: number) => {
    const v = editDraft.trim();
    if (!v) return;
    if (values.some((x, idx) => idx !== i && x.toLowerCase() === v.toLowerCase())) { addToast({ type: 'warning', message: `"${v}" already exists in ${label}.` }); return; }
    const prev = values[i];
    setLov(lovKey, values.map((x, idx) => (idx === i ? v : x)));
    addLog({ action: 'Config', target: `${label} list`, detail: `Renamed "${prev}" to "${v}"` });
    setEditIndex(null);
  };
  const remove = (i: number) => {
    const removed = values[i];
    setLov(lovKey, values.filter((_, idx) => idx !== i));
    addLog({ action: 'Config', target: `${label} list`, detail: `Removed value "${removed}"` });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= values.length) return;
    const next = [...values];
    [next[i], next[j]] = [next[j], next[i]];
    setLov(lovKey, next);
    addLog({ action: 'Config', target: `${label} list`, detail: `Reordered "${values[i]}"` });
  };
  const reset = () => { resetLov(lovKey); addLog({ action: 'Config', target: `${label} list`, detail: 'Reset list to defaults' }); };

  return (
    <section className="rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-canvas-border bg-canvas/40">
        <div>
          <h4 className="text-[0.8125rem] font-semibold text-ink-900 leading-tight">Dropdown options</h4>
          <p className="text-[0.6875rem] text-ink-400">What users can pick for {label} · <span className="tabular-nums">{values.length}</span> option{values.length === 1 ? '' : 's'} · the order here is the order users see</p>
        </div>
        {!custom && (
          <button onClick={reset} title="Restore the shipped defaults" className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[0.6875rem] font-semibold text-ink-500 hover:text-ink-900 hover:bg-draft-50 cursor-pointer transition-colors shrink-0">
            <RotateCcw size={12} aria-hidden="true" /> Reset to defaults
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-canvas-border">
        <input
          value={adding} onChange={e => setAdding(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitAdd(); }}
          placeholder={`Type a new ${label.toLowerCase()} option and press Enter…`}
          className={`${SMALL_INPUT_CLS} flex-1`}
        />
        <Button variant="outline" size="sm" shape="md" leftIcon={<Plus size={14} />} onClick={commitAdd} disabled={!adding.trim()}>Add option</Button>
      </div>

      <ul className="p-2 space-y-0.5 max-h-[420px] overflow-y-auto">
        {values.map((v, i) => (
          <li key={`${v}-${i}`} className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-canvas transition-colors">
            <span className="w-5 shrink-0 text-center text-[0.6875rem] font-semibold tabular-nums text-ink-300">{i + 1}</span>
            {editIndex === i ? (
              <>
                <input
                  autoFocus value={editDraft} onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') rename(i); if (e.key === 'Escape') setEditIndex(null); }}
                  className={`${SMALL_INPUT_CLS} flex-1`}
                />
                <button onClick={() => rename(i)} aria-label="Save" className="w-7 h-7 inline-flex items-center justify-center rounded-md text-white bg-brand-600 hover:bg-brand-500 cursor-pointer shrink-0"><Check size={13} /></button>
                <button onClick={() => setEditIndex(null)} aria-label="Cancel" className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-500 hover:text-ink-800 hover:bg-draft-50 cursor-pointer shrink-0"><X size={13} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 truncate text-[0.8125rem] text-ink-800" title={v}>{v}</span>
                <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <div className="flex items-center rounded-sm border border-canvas-border overflow-hidden mr-0.5">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="w-6 h-6 inline-flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-colors"><ChevronUp size={13} /></button>
                    <span className="w-px h-4 bg-canvas-border" aria-hidden="true" />
                    <button onClick={() => move(i, 1)} disabled={i === values.length - 1} aria-label="Move down" className="w-6 h-6 inline-flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-colors"><ChevronDown size={13} /></button>
                  </div>
                  <button onClick={() => { setEditIndex(i); setEditDraft(v); }} aria-label={`Rename ${v}`} className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors"><Pencil size={12.5} /></button>
                  <button onClick={() => remove(i)} aria-label={`Remove ${v}`} className="w-7 h-7 inline-flex items-center justify-center rounded-sm text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer transition-colors"><Trash2 size={12.5} /></button>
                </div>
              </>
            )}
          </li>
        ))}
        {values.length === 0 && (
          <li className="px-2 py-6 text-center text-[0.75rem] text-ink-400">No options yet — users will see an empty dropdown until you add some above.</li>
        )}
      </ul>
    </section>
  );
}

/** Admin → "Fields & Lists of Values". One surface for everything about the
 *  fields users fill in: which are mandatory, which are dropdowns and what they
 *  offer, plus custom fields. Master (field list) on the left, detail on the
 *  right — no page-long stack of cards. */
export default function LovManager() {
  const { lov, reportFields, isFieldRequired, setFieldRequired, isFieldHidden, setFieldHidden, addCustomField, updateCustomField, removeCustomField, addLog } = useAdminSettings();
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>(BUILTIN_REPORT_FIELDS[0].key);
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view');
  const [pendingDelete, setPendingDelete] = useState<CustomReportField | null>(null);

  // Build the catalogue: report fields (built-in, then custom), observation
  // dropdowns, auto-filled fields.
  const items = useMemo<Item[]>(() => [
    ...BUILTIN_REPORT_FIELDS.map<Item>(f => ({
      key: f.key, label: f.label, group: 'report', kind: f.type, lovKey: f.lovKey,
      required: isFieldRequired(f.key), lockedRequired: f.lockedRequired, hidden: isFieldHidden(f.key), note: f.note,
    })),
    ...reportFields.custom.map<Item>(f => ({
      key: f.key, label: f.label, group: 'report', kind: f.type, lovKey: f.type === 'select' ? f.key : undefined,
      required: isFieldRequired(f.key), hidden: isFieldHidden(f.key), custom: f,
    })),
    ...LOV_DEFS.filter(d => d.group === 'observation').map<Item>(d => ({
      key: d.key, label: d.label, group: 'observation', kind: 'select', lovKey: d.key, note: 'On every extracted observation',
    })),
    ...AUTO_REPORT_FIELDS.map<Item>(f => ({ key: f.key, label: f.label, group: 'auto', kind: 'auto', note: f.note })),
  ], [reportFields.custom, isFieldRequired, isFieldHidden]);

  const q = query.trim().toLowerCase();
  const matches = (it: Item) => !q
    || it.label.toLowerCase().includes(q)
    || (it.lovKey ? lov(it.lovKey).some(v => v.toLowerCase().includes(q)) : false);
  const groups: { id: Item['group']; title: string; blurb: string }[] = [
    { id: 'report', title: 'Report details', blurb: 'Filled when a report is created' },
    { id: 'observation', title: 'Observation analysis', blurb: 'Picked on each observation' },
    { id: 'auto', title: 'Auto-filled', blurb: 'Set by the platform' },
  ];
  const selected = items.find(i => i.key === selectedKey) ?? items[0];
  const allLabels = items.map(i => i.label);
  const mandatoryCount = items.filter(i => i.group === 'report' && i.required).length;
  const reportCount = items.filter(i => i.group === 'report').length;
  const hiddenCount = items.filter(i => i.group === 'report' && i.hidden).length;

  const select = (key: string) => { setSelectedKey(key); setMode('view'); };
  const toggleRequired = (it: Item) => (next: boolean) => {
    setFieldRequired(it.key, next);
    addLog({ action: 'Config', target: 'Report details fields', detail: `Made "${it.label}" ${next ? 'mandatory' : 'optional'}` });
  };
  const toggleHidden = (it: Item) => {
    const next = !it.hidden;
    setFieldHidden(it.key, next);
    addLog({ action: 'Config', target: 'Report details fields', detail: `${next ? 'Hid' : 'Unhid'} "${it.label}" ${next ? 'from' : 'on'} the report details form` });
    addToast({ type: 'success', message: next ? `"${it.label}" is now hidden from the report details form.` : `"${it.label}" is shown on the report details form again.` });
  };
  const create = (f: Omit<CustomReportField, 'key'>) => {
    const created = addCustomField(f);
    addLog({ action: 'Config', target: 'Report details fields', detail: `Added ${f.required ? 'mandatory' : 'optional'} ${REPORT_FIELD_TYPE_LABEL[f.type].toLowerCase()} field "${created.label}"` });
    addToast({ type: 'success', message: created.type === 'select' ? `"${created.label}" added — now add its dropdown options.` : `"${created.label}" added to the report details form.` });
    setSelectedKey(created.key); setMode('view');
  };
  const saveEdit = (f: Omit<CustomReportField, 'key'>) => {
    if (!selected.custom) return;
    updateCustomField(selected.key, f);
    addLog({ action: 'Config', target: 'Report details fields', detail: `Updated custom field "${f.label}"` });
    setMode('view');
  };
  const confirmDelete = () => {
    if (!pendingDelete) return;
    removeCustomField(pendingDelete.key);
    addLog({ action: 'Config', target: 'Report details fields', detail: `Removed custom field "${pendingDelete.label}"` });
    addToast({ type: 'success', message: `"${pendingDelete.label}" removed from the report details form.` });
    if (selectedKey === pendingDelete.key) setSelectedKey(BUILTIN_REPORT_FIELDS[0].key);
    setPendingDelete(null);
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Title row */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FormInput size={18} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Fields &amp; Lists of Values</h3>
            <p className="text-[0.8125rem] text-ink-500 mt-0.5">Pick a field to decide whether it's mandatory, add your own fields, and manage what each dropdown offers. Changes apply to Create Report immediately. <span className="text-ink-700 font-medium tabular-nums">{mandatoryCount} of {reportCount}</span> report details are mandatory{hiddenCount > 0 && <>, <span className="text-ink-700 font-medium tabular-nums">{hiddenCount}</span> hidden</>}.</p>
          </div>
        </div>
        <Button variant="primary" size="md" shape="md" leftIcon={<Plus size={15} />} onClick={() => setMode('add')} disabled={mode === 'add'}>Add field</Button>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Master — the field list */}
        <aside className="w-[300px] shrink-0 border-r border-canvas-border flex flex-col min-h-0">
          <div className="p-3 border-b border-canvas-border">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input
                value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a field or an option…"
                className="w-full h-8 pl-8 pr-7 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all"
              />
              {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded-full text-ink-400 hover:text-ink-700 hover:bg-canvas cursor-pointer"><X size={11} /></button>}
            </div>
          </div>
          <nav className="flex-1 min-h-0 overflow-y-auto p-2" aria-label="Fields">
            {groups.map(g => {
              const rows = items.filter(i => i.group === g.id && matches(i));
              if (rows.length === 0) return null;
              return (
                <div key={g.id} className="mb-3">
                  <div className="px-2 pt-1.5 pb-1">
                    <div className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">{g.title}</div>
                    <div className="text-[0.625rem] text-ink-300">{g.blurb}</div>
                  </div>
                  <ul className="space-y-0.5">
                    {rows.map(it => {
                      const on = selected.key === it.key && mode !== 'add';
                      const Icon = KIND_ICON[it.kind];
                      return (
                        <li key={it.key}>
                          <button
                            onClick={() => select(it.key)} aria-current={on ? 'true' : undefined}
                            className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left cursor-pointer transition-colors ${on ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-canvas hover:text-ink-900'} ${it.hidden && !on ? 'opacity-55' : ''}`}
                          >
                            <Icon size={14} className={`shrink-0 ${on ? 'text-brand-600' : 'text-ink-400'}`} aria-hidden="true" />
                            <span className={`flex-1 min-w-0 truncate text-[0.8125rem] font-medium ${it.hidden ? 'line-through decoration-ink-300' : ''}`}>{it.label}</span>
                            {it.custom && <Sparkles size={11} className="text-brand-500 shrink-0" aria-label="Custom field" />}
                            {it.group === 'report' && it.hidden && <span title="Hidden from the form" className="inline-flex items-center gap-1 text-[0.625rem] text-ink-400 shrink-0"><EyeOff size={11} aria-hidden="true" /> hidden</span>}
                            {it.group === 'report' && !it.hidden && (
                              it.required
                                ? <span title="Mandatory" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-risk-50 text-risk-700 shrink-0"><Asterisk size={10} aria-hidden="true" /></span>
                                : <span className="text-[0.625rem] text-ink-300 shrink-0">optional</span>
                            )}
                            {it.lovKey && <span className="text-[0.6875rem] tabular-nums text-ink-400 shrink-0">{lov(it.lovKey).length}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {items.filter(matches).length === 0 && (
              <p className="px-3 py-8 text-center text-[0.75rem] text-ink-400">Nothing matches “{query}”.</p>
            )}
          </nav>
        </aside>

        {/* Detail — everything about the selected field */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait" initial={false}>
            {mode === 'add' ? (
              <motion.div key="add" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <FieldForm existingLabels={allLabels} onSave={create} onCancel={() => setMode('view')} submitLabel="Add field" />
              </motion.div>
            ) : mode === 'edit' && selected.custom ? (
              <motion.div key={`edit-${selected.key}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <FieldForm initial={selected.custom} existingLabels={allLabels} onSave={saveEdit} onCancel={() => setMode('view')} submitLabel="Save changes" />
              </motion.div>
            ) : (
              <motion.div key={selected.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="space-y-4">
                {/* Field header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight">{selected.label}</h4>
                      <KindChip kind={selected.kind} />
                      {selected.custom && <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-brand-50 text-brand-700 text-[0.625rem] font-semibold uppercase tracking-wide"><Sparkles size={10} aria-hidden="true" /> Custom</span>}
                    </div>
                    <p className="text-[0.8125rem] text-ink-500 mt-1">
                      {selected.group === 'auto' ? `${selected.note}. Users see it but can't change it.`
                        : selected.group === 'observation' ? 'A dropdown on every extracted observation. Manage the options users can pick below.'
                        : selected.hidden ? 'Hidden — not shown on the Report details form or the report header right now. Unhide it to bring it back.'
                        : selected.kind === 'select' ? 'Shown on the Report details form as a dropdown. Set whether it must be filled, and manage its options below.'
                        : selected.kind === 'daterange' ? 'Shown on the Report details form as a start and end date. The Financial Year is worked out from it.'
                        : `Shown on the Report details form as a ${KIND_LABEL[selected.kind].toLowerCase()} field.`}
                    </p>
                  </div>
                  {selected.group === 'report' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {selected.custom && <Button variant="outline" size="sm" shape="md" leftIcon={<Pencil size={13} />} onClick={() => setMode('edit')}>Edit</Button>}
                      {!selected.lockedRequired && (
                        <Button variant="outline" size="sm" shape="md" leftIcon={selected.hidden ? <Eye size={13} /> : <EyeOff size={13} />} onClick={() => toggleHidden(selected)}>
                          {selected.hidden ? 'Unhide' : 'Hide'}
                        </Button>
                      )}
                      {selected.custom
                        ? <Button variant="outline" size="sm" shape="md" leftIcon={<Trash2 size={13} />} onClick={() => setPendingDelete(selected.custom!)}>Delete</Button>
                        : <span title="Built-in fields are part of the report structure — hide them instead of deleting." className="inline-flex items-center gap-1 h-8 px-2 text-[0.6875rem] text-ink-400"><Info size={11} aria-hidden="true" /> Built-in · hide instead of delete</span>}
                    </div>
                  )}
                </div>

                {/* Visibility */}
                {selected.group === 'report' && (
                  <section className={`rounded-lg border px-4 py-3.5 flex items-center justify-between gap-4 ${selected.hidden ? 'border-mitigated-200 bg-mitigated-50/40' : 'border-canvas-border bg-canvas-elevated'}`}>
                    <div className="min-w-0">
                      <h5 className="text-[0.8125rem] font-semibold text-ink-900">Shown on the form</h5>
                      <p className="text-[0.75rem] text-ink-500 mt-0.5">
                        {selected.lockedRequired ? `Always shown — ${selected.note?.toLowerCase() ?? 'the platform needs it'}.`
                          : selected.hidden ? 'Hidden. Users won\u2019t see this field when creating a report, and it\u2019s left off the report header. Values already saved on existing reports are kept.'
                          : 'Users see this field when creating a report. Hide it to take it off the form without deleting it.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[0.75rem] font-medium ${selected.hidden ? 'text-ink-400' : 'text-ink-800'}`}>{selected.hidden ? 'Hidden' : 'Shown'}</span>
                      {selected.lockedRequired
                        ? <Lock size={14} className="text-ink-300" aria-label="Locked" />
                        : <Toggle checked={!selected.hidden} onChange={() => toggleHidden(selected)} ariaLabel={`${selected.label} shown on the form`} />}
                    </div>
                  </section>
                )}

                {/* Requirement — only meaningful while the field is shown */}
                {selected.group === 'report' && !selected.hidden && (
                  <section className="rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h5 className="text-[0.8125rem] font-semibold text-ink-900">Mandatory field</h5>
                      <p className="text-[0.75rem] text-ink-500 mt-0.5">
                        {selected.lockedRequired ? `Always mandatory — ${selected.note?.toLowerCase() ?? 'the platform needs it'}.`
                          : selected.required ? 'Users must fill this in before they can extract a report.'
                          : 'Users can leave this blank. It still prints on the report when filled.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[0.75rem] font-medium ${selected.required ? 'text-ink-800' : 'text-ink-400'}`}>{selected.required ? 'Mandatory' : 'Optional'}</span>
                      {selected.lockedRequired
                        ? <Lock size={14} className="text-ink-300" aria-label="Locked" />
                        : <Toggle checked={!!selected.required} onChange={toggleRequired(selected)} ariaLabel={`${selected.label} mandatory`} />}
                    </div>
                  </section>
                )}

                {/* Custom text/number placeholder note */}
                {selected.custom && selected.kind !== 'select' && selected.kind !== 'date' && (
                  <section className="rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3.5">
                    <h5 className="text-[0.8125rem] font-semibold text-ink-900">Placeholder</h5>
                    <p className="text-[0.75rem] text-ink-500 mt-0.5">{selected.custom.placeholder ? <>Shows “{selected.custom.placeholder}” inside the empty field.</> : 'No placeholder — use Edit to add a hint for users.'}</p>
                  </section>
                )}

                {/* Dropdown options */}
                {selected.lovKey && <ValuesEditor lovKey={selected.lovKey} label={selected.label} custom={!!selected.custom} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this field?"
        description={pendingDelete ? <><span className="font-semibold text-ink-800">“{pendingDelete.label}”</span> will be removed from the report details form{pendingDelete.type === 'select' ? ', along with its dropdown options' : ''}. Values already saved on existing reports are kept but no longer shown.</> : ''}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
