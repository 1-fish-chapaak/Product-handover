import { useEffect, useRef, useState } from 'react';
import {
  Table2, Plus, Trash2, RotateCcw, Download, Upload, Save,
  FileText, Hash, Calendar, Type, Heading, Rows3, AlertTriangle,
  Layers, Bookmark, X,
} from 'lucide-react';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob } from '../types';

// ─── Result type ─────────────────────────────────────────────────────────────

type Result = {
  columns: string[];
  rows: Record<string, string>[];
  summary: { total_rows: number; total_pages: number; files_processed: number };
  validation_flags: { row: number; reason: string }[];
};

// ─── Schema field model ──────────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'date';
type FieldSource = 'header' | 'table';
type Field = {
  id: string;
  name: string;
  type: FieldType;
  description?: string;
  source: FieldSource;
};

type LayoutProfile = { id: string; name: string; fields: Field[] };

const PROFILES_KEY = 'te_layout_profiles';
const SOURCE_KEY = '__te_source__';

let _fid = 0;
const fieldId = () => `f${Date.now().toString(36)}${(_fid++).toString(36)}`;

// Mirrors INITIAL_EXTRACTION_FIELDS from the reference (page.jsx / constants).
const INITIAL_FIELDS: Field[] = [
  { id: 'h1', name: 'invoice_number', type: 'string', description: 'Invoice ID', source: 'header' },
  { id: 'h2', name: 'invoice_date', type: 'date', description: 'Date YYYY-MM-DD', source: 'header' },
  { id: 't1', name: 'description', type: 'string', description: 'Item name', source: 'table' },
  { id: 't2', name: 'amount', type: 'number', description: 'Total price', source: 'table' },
];

const sanitizeName = (raw: string) =>
  raw.replace(/\W/g, '_').replace(/_+/g, '_').toLowerCase();

// ─── Mock fixtures ───────────────────────────────────────────────────────────
// Deterministic-ish sample values keyed off field name + type, so the generated
// table reads like a real extraction regardless of the user's schema.

const SAMPLE_DESCRIPTIONS = [
  'Cloud platform — annual license',
  'Professional services (40h)',
  'Onboarding & enablement',
  'Premium support tier',
  'Data migration package',
  'Add-on: advanced analytics',
  'Seat expansion (25 users)',
  'Sandbox environment',
  'Security review retainer',
  'Quarterly health check',
  'API call overage',
  'Custom integration build',
];
const SAMPLE_VENDORS = ['Northwind Ltd', 'Acme Corp', 'Globex SA', 'Initech Inc', 'Umbrella Co', 'Soylent BV'];
const SAMPLE_STATUS = ['Approved', 'Pending', 'Paid', 'Overdue', 'Draft'];
const SAMPLE_CURRENCIES = ['USD', 'EUR', 'GBP'];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

function fakeValue(field: Field, rowIdx: number, fileIdx: number): string {
  const n = field.name.toLowerCase();
  if (field.type === 'number') {
    if (n.includes('qty') || n.includes('quantity') || n.includes('count')) return String(1 + ((rowIdx * 3 + fileIdx) % 12));
    if (n.includes('tax') || n.includes('vat')) return (((rowIdx + 1) * 13.37) % 200 + 4).toFixed(2);
    if (n.includes('rate') || n.includes('price') || n.includes('unit')) return ((((rowIdx + 2) * 137) % 950) + 19.5).toFixed(2);
    return ((((rowIdx + 1) * 821 + fileIdx * 53) % 9000) + 120.75).toFixed(2);
  }
  if (field.type === 'date') {
    const day = String(1 + ((rowIdx + fileIdx) % 27)).padStart(2, '0');
    const month = String(1 + ((rowIdx * 2 + fileIdx) % 12)).padStart(2, '0');
    return `2026-${month}-${day}`;
  }
  // string
  if (n.includes('invoice') && (n.includes('no') || n.includes('num') || n.includes('id'))) return `INV-2026-${String(1042 + rowIdx + fileIdx * 7).padStart(5, '0')}`;
  if (n.includes('po') || n.includes('order')) return `PO-${String(8800 + rowIdx * 3 + fileIdx).padStart(5, '0')}`;
  if (n.includes('vendor') || n.includes('supplier') || n.includes('customer') || n.includes('client')) return pick(SAMPLE_VENDORS, rowIdx + fileIdx);
  if (n.includes('status')) return pick(SAMPLE_STATUS, rowIdx);
  if (n.includes('currency') || n.includes('ccy')) return pick(SAMPLE_CURRENCIES, fileIdx);
  if (n.includes('desc') || n.includes('item') || n.includes('line') || n.includes('product') || n.includes('service')) return pick(SAMPLE_DESCRIPTIONS, rowIdx);
  if (n.includes('sku') || n.includes('code')) return `SKU-${String.fromCharCode(65 + (rowIdx % 26))}${String(100 + rowIdx).padStart(3, '0')}`;
  return `${field.name.replace(/_/g, ' ')} ${rowIdx + 1}`;
}

function buildResult(files: PickedFile[], options: Record<string, unknown>): Result {
  const fields = ((options.fields as Field[]) ?? INITIAL_FIELDS).filter((f) => f.name.trim());
  const safeFiles = files.length > 0 ? files : [{ name: 'sample.pdf', size: 0, type: 'application/pdf' }];
  const columns = fields.map((f) => f.name);

  const rows: Record<string, string>[] = [];
  let totalPages = 0;

  safeFiles.forEach((file, fi) => {
    // 2–4 pages per file, 2–4 line rows per page.
    const pages = 2 + (fi % 3);
    totalPages += pages;
    for (let p = 1; p <= pages; p++) {
      const lineRows = 2 + ((fi + p) % 3);
      for (let r = 0; r < lineRows; r++) {
        const rowIdx = rows.length;
        const row: Record<string, string> = {};
        fields.forEach((f) => {
          row[f.name] = fakeValue(f, rowIdx, fi);
        });
        // Source meta — keeps the mock honest about file + page provenance.
        row[SOURCE_KEY] = `${file.name} · p.${p}`;
        rows.push(row);
      }
    }
  });

  // A handful of believable validation flags.
  const numberCols = fields.filter((f) => f.type === 'number').map((f) => f.name);
  const dateCols = fields.filter((f) => f.type === 'date').map((f) => f.name);
  const validation_flags: { row: number; reason: string }[] = [];
  if (rows.length > 2 && numberCols.length) {
    rows[2][numberCols[0]] = '—';
    validation_flags.push({ row: 2, reason: `Missing value for "${numberCols[0]}" — could not parse a number on this line.` });
  }
  if (rows.length > 5 && dateCols.length) {
    rows[5][dateCols[0]] = '13/2026';
    validation_flags.push({ row: 5, reason: `"${dateCols[0]}" does not match the expected date format (YYYY-MM-DD).` });
  }
  if (rows.length > 7 && numberCols.length) {
    validation_flags.push({ row: 7, reason: 'Row total does not reconcile with line items (off by 2%).' });
  }

  return {
    columns,
    rows,
    summary: { total_rows: rows.length, total_pages: totalPages, files_processed: safeFiles.length },
    validation_flags,
  };
}

// ─── CSV helpers (no libs) ───────────────────────────────────────────────────

const csvCell = (v: string) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportResultsCsv(result: Result) {
  const cols = [...result.columns, 'Source'];
  const header = cols.map(csvCell).join(',');
  const body = result.rows
    .map((r) => [...result.columns.map((c) => r[c] ?? ''), r[SOURCE_KEY] ?? ''].map(csvCell).join(','))
    .join('\n');
  download(`table-extract-${Date.now()}.csv`, `${header}\n${body}`);
}

function exportSchemaCsv(fields: Field[]) {
  const header = 'name,type,description,source';
  const body = fields.map((f) => [f.name, f.type, f.description ?? '', f.source].map(csvCell).join(',')).join('\n');
  download(`extraction-layout-${Date.now()}.csv`, `${header}\n${body}`);
}

// Tolerant CSV line splitter (handles quoted commas).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function parseSchemaCsv(text: string): Field[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  // Skip header row if it looks like one.
  const start = /name/i.test(lines[0]) && /type/i.test(lines[0]) ? 1 : 0;
  const fields: Field[] = [];
  for (let i = start; i < lines.length; i++) {
    const [name, type, description, source] = splitCsvLine(lines[i]);
    if (!name) continue;
    fields.push({
      id: fieldId(),
      name: sanitizeName(name),
      type: (['string', 'number', 'date'].includes(type) ? type : 'string') as FieldType,
      description: description || '',
      source: (source === 'header' ? 'header' : 'table') as FieldSource,
    });
  }
  return fields;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TYPE_META: Record<FieldType, { label: string; icon: typeof Type }> = {
  string: { label: 'Text', icon: Type },
  number: { label: 'Number', icon: Hash },
  date: { label: 'Date', icon: Calendar },
};

function FieldRow({
  field, onChange, onRemove,
}: {
  field: Field;
  onChange: (patch: Partial<Field>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 hover:border-brand-300 transition-colors">
      <div className="flex-1 min-w-0 space-y-1.5">
        <input
          value={field.name}
          onChange={(e) => onChange({ name: sanitizeName(e.target.value) })}
          placeholder="field_name"
          className="w-full bg-transparent text-[0.8125rem] font-semibold text-ink-800 lowercase outline-none border-b border-transparent focus:border-brand-300 pb-0.5"
        />
        <div className="flex items-center gap-1.5">
          <div className="relative shrink-0">
            <select
              value={field.type}
              onChange={(e) => onChange({ type: e.target.value as FieldType })}
              className="appearance-none rounded-md bg-paper-50 border border-canvas-border text-[0.6875rem] font-semibold text-ink-600 pl-2 pr-5 py-1 outline-none focus:border-brand-300 cursor-pointer"
            >
              <option value="string">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
          </div>
          <input
            value={field.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="AI hint (optional)…"
            className="flex-1 min-w-0 bg-transparent text-[0.6875rem] italic text-ink-500 outline-none border-b border-transparent focus:border-brand-300 pb-0.5"
          />
        </div>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${field.name || 'field'}`}
        className="shrink-0 p-1 rounded-md text-ink-400 opacity-0 group-hover:opacity-100 hover:text-risk-700 hover:bg-risk-50 transition cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function FieldColumn({
  title, icon: Icon, source, fields, onAdd, onChange, onRemove,
}: {
  title: string;
  icon: typeof Heading;
  source: FieldSource;
  fields: Field[];
  onAdd: (s: FieldSource) => void;
  onChange: (id: string, patch: Partial<Field>) => void;
  onRemove: (id: string) => void;
}) {
  const list = fields.filter((f) => f.source === source);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-700">
          <Icon size={13} className="text-brand-600" /> {title}
          <span className="text-ink-400 font-normal">({list.length})</span>
        </span>
        <button
          onClick={() => onAdd(source)}
          className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 px-2 py-1 cursor-pointer"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-1.5">
        {list.map((f) => (
          <FieldRow key={f.id} field={f} onChange={(p) => onChange(f.id, p)} onRemove={() => onRemove(f.id)} />
        ))}
        {list.length === 0 && (
          <p className="text-[0.6875rem] text-ink-400 italic text-center py-3 rounded-lg border border-dashed border-canvas-border">
            No {source === 'header' ? 'header' : 'line-item'} fields yet
          </p>
        )}
      </div>
    </div>
  );
}

function SchemaBuilder({
  fields, setFields,
}: {
  fields: Field[];
  setFields: (f: Field[]) => void;
}) {
  const [profiles, setProfiles] = useState<LayoutProfile[]>(() => {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      return raw ? (JSON.parse(raw) as LayoutProfile[]) : [];
    } catch {
      return [];
    }
  });
  const [profileName, setProfileName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const persist = (next: LayoutProfile[]) => {
    setProfiles(next);
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const addField = (source: FieldSource) =>
    setFields([
      ...fields,
      { id: fieldId(), name: source === 'header' ? 'new_field' : 'new_column', type: 'string', description: '', source },
    ]);
  const changeField = (id: string, patch: Partial<Field>) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeField = (id: string) => setFields(fields.filter((f) => f.id !== id));

  const saveProfile = () => {
    const name = profileName.trim();
    if (!name || !fields.length) return;
    const clone = fields.map((f) => ({ ...f }));
    const existing = profiles.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const next = existing
      ? profiles.map((p) => (p.id === existing.id ? { ...p, fields: clone } : p))
      : [...profiles, { id: `p${Date.now()}`, name, fields: clone }];
    persist(next);
    setProfileName('');
  };
  const loadProfile = (p: LayoutProfile) => setFields(p.fields.map((f) => ({ ...f, id: fieldId() })));
  const deleteProfile = (id: string) => persist(profiles.filter((p) => p.id !== id));

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseSchemaCsv(String(ev.target?.result ?? ''));
      if (parsed.length) setFields(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="mt-4 rounded-[14px] border border-canvas-border bg-canvas-elevated overflow-hidden">
      {/* Header / toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-canvas-border bg-paper-50/60 flex-wrap">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-800">
            <Layers size={14} className="text-brand-600" /> Extraction schema
          </p>
          <p className="text-[0.6875rem] text-ink-500 mt-0.5">
            Define the columns to pull from each PDF. {fields.length} field{fields.length === 1 ? '' : 's'} mapped.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFields(INITIAL_FIELDS.map((f) => ({ ...f, id: fieldId() })))}
            title="Reset to default invoice schema"
            className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 px-2 py-1 cursor-pointer"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={() => importRef.current?.click()}
            title="Import schema from CSV"
            className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 px-2 py-1 cursor-pointer"
          >
            <Upload size={12} /> Import
          </button>
          <button
            onClick={() => exportSchemaCsv(fields)}
            disabled={!fields.length}
            title="Export schema as CSV"
            className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.6875rem] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 px-2 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={12} /> Export
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onImport} />
        </div>
      </div>

      {/* Field columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4">
        <FieldColumn
          title="Header metadata" icon={Heading} source="header"
          fields={fields} onAdd={addField} onChange={changeField} onRemove={removeField}
        />
        <FieldColumn
          title="Line items (table)" icon={Rows3} source="table"
          fields={fields} onAdd={addField} onChange={changeField} onRemove={removeField}
        />
      </div>

      {/* Layout profiles */}
      <div className="px-4 pb-4 pt-3 border-t border-canvas-border">
        <p className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">
          <Bookmark size={12} /> Layout profiles
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveProfile(); }}
            placeholder="Name this layout…"
            className="flex-1 min-w-[10rem] rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-700 px-2.5 py-1.5 outline-none focus:border-brand-300"
          />
          <button
            onClick={saveProfile}
            disabled={!profileName.trim() || !fields.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold px-3 py-1.5 cursor-pointer disabled:bg-brand-100 disabled:text-brand-300 disabled:cursor-not-allowed"
          >
            <Save size={13} /> Save
          </button>
        </div>
        {profiles.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {profiles.map((p) => (
              <span
                key={p.id}
                className="group inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-paper-50/70 pl-2.5 pr-1.5 py-1 text-[0.75rem] text-ink-700"
              >
                <button onClick={() => loadProfile(p)} className="font-medium hover:text-brand-700 cursor-pointer">
                  {p.name}
                </button>
                <span className="text-ink-300 text-[0.625rem] tabular-nums">{p.fields.length}</span>
                <button
                  onClick={() => deleteProfile(p.id)}
                  aria-label={`Delete ${p.name}`}
                  className="text-ink-400 hover:text-risk-700 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper that wires SchemaBuilder to ConciergeFlow's options (options.fields).
function SchemaControls({
  options, set,
}: {
  options: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
}) {
  // Seed options.fields with the defaults on first render.
  useEffect(() => {
    if (!options.fields) set({ fields: INITIAL_FIELDS.map((f) => ({ ...f })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fields = (options.fields as Field[]) ?? INITIAL_FIELDS;
  return <SchemaBuilder fields={fields} setFields={(f) => set({ fields: f })} />;
}

// ─── Result rendering ────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, tone = 'brand' }: { icon: typeof Rows3; label: string; value: number; tone?: 'brand' | 'warn' }) {
  const warn = tone === 'warn' && value > 0;
  return (
    <div className={`flex items-center gap-3 rounded-[12px] border px-4 py-3.5 ${warn ? 'border-amber-200 bg-amber-50/60' : 'border-canvas-border bg-canvas-elevated'}`}>
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${warn ? 'bg-amber-100' : 'bg-brand-50'}`}>
        <Icon size={17} className={warn ? 'text-amber-700' : 'text-brand-700'} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] text-ink-500 leading-tight">{label}</p>
        <p className="text-[1.25rem] font-semibold text-ink-900 leading-tight tabular-nums mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const { columns, rows, summary, validation_flags } = result;
  const flagged = new Set(validation_flags.map((f) => f.row));

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Rows3} label="Rows extracted" value={summary.total_rows} />
        <StatCard icon={FileText} label="Pages processed" value={summary.total_pages} />
        <StatCard icon={Layers} label="Files processed" value={summary.files_processed} />
        <StatCard icon={AlertTriangle} label="Validation flags" value={validation_flags.length} tone="warn" />
      </div>

      {/* Extracted rows */}
      <div className="rounded-[12px] border border-canvas-border overflow-hidden">
        <div className="px-4 py-2.5 border-b border-canvas-border bg-paper-50/70 flex items-center justify-between">
          <p className="text-[0.75rem] font-semibold text-ink-700">Extracted rows</p>
          <p className="text-[0.6875rem] text-ink-400 tabular-nums">{rows.length} total</p>
        </div>
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-paper-50">
              <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-3 py-2.5 whitespace-nowrap">#</th>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2.5 whitespace-nowrap">{c.replace(/_/g, ' ')}</th>
                ))}
                <th className="px-3 py-2.5 whitespace-nowrap">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isFlagged = flagged.has(i);
                return (
                  <tr
                    key={i}
                    className={`border-t border-canvas-border transition-colors ${isFlagged ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-paper-50/50'}`}
                  >
                    <td className="px-3 py-2 text-[0.75rem] text-ink-400 tabular-nums whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {isFlagged && <AlertTriangle size={11} className="text-amber-600 shrink-0" />}
                        {i + 1}
                      </span>
                    </td>
                    {columns.map((c) => (
                      <td key={c} className="px-3 py-2 text-[0.8125rem] text-ink-800 max-w-[16rem] truncate" title={row[c]}>
                        {row[c] === '—' || row[c] === undefined || row[c] === '' ? <span className="text-ink-300">—</span> : row[c]}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-[0.6875rem] text-ink-400 font-mono whitespace-nowrap">{row[SOURCE_KEY] ?? '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-[0.8125rem] text-ink-400">
                    No rows extracted. Adjust the schema and try again.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation flags */}
      {validation_flags.length > 0 && (
        <div className="rounded-[12px] border border-amber-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50">
            <p className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-700">
              <AlertTriangle size={13} /> Validation flags ({validation_flags.length})
            </p>
          </div>
          <ul className="divide-y divide-amber-100 max-h-48 overflow-y-auto">
            {validation_flags.map((f, i) => (
              <li key={i} className="px-4 py-2.5 flex items-start gap-3 text-[0.8125rem]">
                <span className="shrink-0 mt-px font-mono text-[0.6875rem] font-semibold text-amber-700">Row {f.row + 1}</span>
                <span className="text-ink-600 leading-relaxed">{f.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── History seed ────────────────────────────────────────────────────────────

const HISTORY_SEED: HistoryJob[] = [
  { id: 'te-seed-1', files: ['march-invoices.pdf', 'april-invoices.pdf'], status: 'COMPLETED', createdAt: '2h ago', meta: '34 rows' },
  { id: 'te-seed-2', files: ['vendor-statement-q1.pdf'], status: 'COMPLETED', createdAt: 'Yesterday', meta: '12 rows' },
];

// ─── Main view ───────────────────────────────────────────────────────────────

export default function TableExtractorView({ onBack }: { onBack: () => void }) {
  return (
    <ConciergeFlow<Result>
      title="Table Extractor"
      subtitle="Define a schema, drop in PDFs, and pull structured tables — header metadata and line items — into rows you can export."
      icon={Table2}
      onBack={onBack}
      accept="application/pdf"
      multiple
      maxSizeMb={100}
      uploadHint="PDF only — up to 100 MB"
      uploadCtaLabel="Extract tables"
      stages={[
        { id: 'upload', label: 'Upload' },
        { id: 'detect', label: 'Detect tables' },
        { id: 'map', label: 'Map schema' },
        { id: 'extract', label: 'Extract rows' },
        { id: 'validate', label: 'Validate' },
      ]}
      messages={[
        'Reading document structure…',
        'Detecting tables and header regions…',
        'Mapping your schema to the page layout…',
        'Extracting rows page by page…',
        'Validating types and reconciling totals…',
      ]}
      totalMs={5200}
      checking={[
        'Header metadata vs. each schema field',
        'Line-item table boundaries on every page',
        'Number and date formats per column',
        'Row totals reconcile with line items',
      ]}
      tips={[
        'Add an AI hint to a field (e.g. "Date YYYY-MM-DD") to nudge how a value is read.',
        'Save a reusable Layout profile so the next batch is one click away.',
        'Import or export your schema as CSV to share layouts with your team.',
        'Flagged rows are highlighted in amber — review them before exporting.',
      ]}
      preUpload={
        <p className="text-[0.8125rem] text-ink-500 leading-relaxed mb-4">
          Works best on invoices, statements, and structured reports. Set up the schema below, then upload one or more PDFs.
        </p>
      }
      extraControls={(options, set) => <SchemaControls options={options} set={set} />}
      canRun={(files, options) => files.length > 0 && ((options.fields as Field[])?.length ?? 0) > 0}
      buildResult={buildResult}
      renderResult={(result) => <ResultView result={result} />}
      resultActions={(result) => (
        <button
          onClick={() => exportResultsCsv(result)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 px-3.5 py-2 transition-colors cursor-pointer"
        >
          <Download size={14} /> Export CSV
        </button>
      )}
      historyMeta={(result) => `${result.summary.total_rows} rows`}
      historySeed={HISTORY_SEED}
    />
  );
}
