import { useState, useRef, useEffect } from 'react';
import {
  Lock, Building2, CalendarRange, UserCheck, CalendarClock,
  Hash, Shield, ClipboardList, MapPin, CalendarDays, Briefcase, UserCog, FileText,
  Globe, Landmark, Tag, Pencil,
} from 'lucide-react';
import DatePicker from '../../../shared/DatePicker';
import { useAdminSettings } from '../adminStore';
import { financialYearOf, splitPeriod, joinPeriod } from '../reportClassification';
import { templateCarries } from '../../templateFields';
import type { ReportMeta } from '../types';

const INPUT_CLS = 'w-full h-8 px-2.5 bg-canvas-elevated border border-brand-400 rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none ring-2 ring-brand-500/10';

type FactKind = 'text' | 'number' | 'select' | 'date';

/** The control one fact turns into while it is being edited.
 *
 *  Mounted only for the fact being edited, so its draft starts from that fact's
 *  current value without an effect to resync it. A list that commits the moment
 *  something is picked has nothing to cancel; a free-text field commits on
 *  Enter or on leaving, and Escape puts back what was there. */
function FactEditor({ kind, value, options, placeholder, label, onCommit, onCancel }: {
  kind: FactKind;
  value: string;
  options?: readonly string[];
  placeholder?: string;
  label: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  if (kind === 'select') {
    return (
      <div className="relative">
        <select
          ref={ref as React.Ref<HTMLSelectElement>}
          value={draft}
          aria-label={label}
          onChange={e => onCommit(e.target.value)}
          onBlur={onCancel}
          onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}
          className={`${INPUT_CLS} appearance-none pr-7 cursor-pointer`}
        >
          <option value="">—</option>
          {(options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    );
  }

  if (kind === 'date') {
    return (
      <DatePicker
        value={draft}
        aria-label={label}
        onChange={e => onCommit(e.target.value)}
        placeholder="Pick a date"
        className={INPUT_CLS}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      type={kind === 'number' ? 'number' : 'text'}
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(draft); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      className={INPUT_CLS}
    />
  );
}

/** Audit Period — one stored string, two dates to pick. The pair stacks inside
 *  the fact's own cell so the grid reserves nothing for it at rest, and it stays
 *  open until the user leaves it: picking a start and then an end is two
 *  actions, and committing after the first would blank the field. */
function PeriodEditor({ value, onCommit, onCancel }: {
  value?: string;
  onCommit: (period: string, financialYear: string) => void;
  onCancel: () => void;
}) {
  const [half, setHalf] = useState<[string, string]>(() => splitPeriod(value));
  const wrap = useRef<HTMLDivElement>(null);

  // Leaving the pair closes it. `relatedTarget` keeps the move between the two
  // date inputs from counting as leaving.
  const onBlur = (e: React.FocusEvent) => {
    if (!wrap.current?.contains(e.relatedTarget as Node | null)) onCancel();
  };
  const pick = (i: 0 | 1, iso: string) => {
    const next: [string, string] = i === 0 ? [iso, half[1]] : [half[0], iso];
    setHalf(next);
    // Financial Year follows the period rather than being typed — the end date
    // decides it, falling back to the start while the range is half-picked.
    onCommit(joinPeriod(next[0], next[1]), financialYearOf(next[1] || next[0]));
  };

  return (
    <div ref={wrap} onBlur={onBlur} className="flex flex-col gap-1.5" onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <DatePicker value={half[0]} onChange={e => pick(0, e.target.value)} max={half[1] || undefined} placeholder="Start date" className={INPUT_CLS} aria-label="Audit period start date" />
      <DatePicker value={half[1]} onChange={e => pick(1, e.target.value)} min={half[0] || undefined} placeholder="End date" className={INPUT_CLS} aria-label="Audit period end date" />
    </div>
  );
}

/** One fact — icon, label, and the value. The value is the control: clicking it
 *  edits it in place, which is the only edit affordance here. Locked facts
 *  (derived or stamped by the platform) render as plain text with the padlock
 *  their label already carries. */
function Fact({ icon: Icon, label, value, locked, editing, onEdit, className = '', children }: {
  icon: typeof Building2;
  label: string;
  value?: string;
  locked?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  className?: string;
  /** The editor, rendered in place of the value while this fact is being edited. */
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2 min-w-0 ${className}`}>
      <Icon size={14} className="text-ink-400 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">
          {label}{locked && <Lock size={9} className="text-ink-300" aria-hidden="true" />}
        </div>
        {editing ? (
          <div className="mt-0.5">{children}</div>
        ) : locked ? (
          <div className="text-[0.8125rem] text-ink-500 truncate" title={value || '—'}>{value?.trim() || <span className="text-ink-400">—</span>}</div>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            className="group w-full flex items-center gap-1.5 text-left -mx-1 px-1 py-0.5 rounded-sm hover:bg-brand-50/70 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <span className="text-[0.8125rem] text-ink-800 truncate" title={value || '—'}>{value?.trim() || <span className="text-ink-400">—</span>}</span>
            <Pencil size={11} className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/** The report-details header shown atop an opened report: every cover fact, each
 *  edited by clicking it. There is no separate edit mode — a field is its own
 *  control, so changing one thing costs one click instead of opening a form,
 *  changing it, and saving. Financial Year, Audit SPOC and Generated On are
 *  derived or stamped by the platform and stay read-only. */
export default function EditableReportHeader({ meta, onChange, fields }: {
  meta: ReportMeta;
  onChange: (patch: Partial<ReportMeta>) => void;
  /** The header fields the chosen report format prints, or null when it has no
   *  opinion. A field the finished report will not carry is not worth asking
   *  for, so it is left off here too. */
  fields?: string[] | null;
}) {
  const { lov, reportFields, isFieldHidden } = useAdminSettings();
  // A field has to clear both gates: not hidden in Reports → Admin, and carried
  // by the format this report is being written in.
  const show = (key: string) => !isFieldHidden(key) && templateCarries(fields ?? null, key);
  const customFields = reportFields.custom.filter(f => show(f.key));

  // One fact at a time is open. Holding it here rather than inside each fact is
  // what makes opening a second one close the first.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const close = () => setEditingKey(null);
  const commit = (patch: Partial<ReportMeta>) => { onChange(patch); close(); };
  const setCustom = (key: string, v: string) => commit({ custom: { ...(meta.custom ?? {}), [key]: v } });

  // A text or list fact, wired to the one editing slot.
  const editable = (key: string, icon: typeof Building2, label: string, value: string | undefined, kind: FactKind, options?: readonly string[], placeholder?: string) => (
    <Fact
      key={key}
      icon={icon}
      label={label}
      value={value}
      editing={editingKey === key}
      onEdit={() => setEditingKey(key)}
    >
      <FactEditor
        kind={kind}
        label={label}
        value={value ?? ''}
        options={options}
        placeholder={placeholder}
        onCommit={v => commit({ [key]: v } as Partial<ReportMeta>)}
        onCancel={close}
      />
    </Fact>
  );

  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
      {/* Identity · classification · reference · people/auto — the order the
          report prints them in, with the Report Name leading. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3.5">
        {/* The Report Name is how this report is found in Reports, not only a
            field it prints, so it is always here even if the format drops it. */}
        {editable('reportName', FileText, 'Report Name', meta.reportName, 'text', undefined, 'Names the report and its ATR')}
        {show('auditTitle') && editable('auditTitle', FileText, 'Audit Title', meta.auditTitle, 'text', undefined, 'e.g. Procurement & Dispatch Process')}
        {show('auditEntity') && editable('auditEntity', Building2, 'Audit Entity', meta.auditEntity, 'text', undefined, 'e.g. ABC Manufacturing Ltd')}
        {show('auditFunction') && editable('auditFunction', Briefcase, 'Function', meta.auditFunction, 'select', lov('function'))}
        {show('section') && editable('section', Shield, 'Section', meta.section, 'select', lov('section'))}
        {show('reviewType') && editable('reviewType', ClipboardList, 'Review type', meta.reviewType, 'select', lov('reviewType'))}
        {show('auditLocation') && editable('auditLocation', Landmark, 'Audit location', meta.auditLocation, 'select', lov('auditLocation'))}
        {show('region') && editable('region', Globe, 'Region', meta.region, 'select', lov('region'))}
        {show('location') && editable('location', MapPin, 'Location (City)', meta.location, 'select', lov('location'))}
        {show('reportNumber') && editable('reportNumber', Hash, 'Report Number', meta.reportNumber, 'text', undefined, 'e.g. IA/2025-26/003')}
        {show('auditPeriod') && (
          <Fact
            icon={CalendarRange}
            label="Audit Period"
            value={meta.auditPeriod}
            editing={editingKey === 'auditPeriod'}
            onEdit={() => setEditingKey('auditPeriod')}
          >
            <PeriodEditor
              value={meta.auditPeriod}
              onCommit={(auditPeriod, financialYear) => onChange({ auditPeriod, financialYear })}
              onCancel={close}
            />
          </Fact>
        )}
        {show('financialYear') && <Fact icon={CalendarDays} label="Financial Year" value={meta.financialYear} locked />}
        {show('preparedBy') && editable('preparedBy', UserCheck, 'Prepared By', meta.preparedBy, 'text', undefined, 'e.g. Internal Audit Team')}
        {show('auditSpoc') && <Fact icon={UserCog} label="Audit SPOC" value={meta.auditSpoc} locked />}
        {show('generatedOn') && <Fact icon={CalendarClock} label="Generated On" value={meta.generatedOn} locked />}
        {/* Custom fields added in Reports → Admin */}
        {customFields.map(f => (
          <Fact
            key={f.key}
            icon={Tag}
            label={f.label}
            value={meta.custom?.[f.key]}
            editing={editingKey === f.key}
            onEdit={() => setEditingKey(f.key)}
          >
            <FactEditor
              kind={f.type === 'select' ? 'select' : f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
              label={f.label}
              value={meta.custom?.[f.key] ?? ''}
              options={f.type === 'select' ? lov(f.key) : undefined}
              placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`}
              onCommit={v => setCustom(f.key, v)}
              onCancel={close}
            />
          </Fact>
        ))}
      </div>
    </div>
  );
}
