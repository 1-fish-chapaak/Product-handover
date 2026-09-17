import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Pencil, Check, X, Lock, Building2, CalendarRange, UserCheck, CalendarClock,
  Hash, Shield, ClipboardList, MapPin, CalendarDays, Briefcase, UserCog, FileText,
  Globe, Landmark, ChevronDown, Tag,
} from 'lucide-react';
import DatePicker from '../../../shared/DatePicker';
import { useAdminSettings } from '../adminStore';
import type { ReportMeta } from '../types';

const INPUT_CLS = 'w-full h-9 px-3 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const LOCKED_CLS = 'w-full h-9 px-3 bg-canvas border border-canvas-border rounded-md text-[0.8125rem] text-ink-500 cursor-default outline-none';

function Field({ label, locked, children, className = '' }: { label: string; locked?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">
        {label}{locked && <Lock size={10} className="text-ink-300" aria-hidden="true" />}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] | { value: string; label: string }[] }) {
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={`${INPUT_CLS} appearance-none pr-8 cursor-pointer`}>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

// One read-only fact — icon + label + value, rendered uniformly for every cover
// detail (classification and cover facts alike, per the design).
function Fact({ icon: Icon, label, value, locked, className = '' }: { icon: typeof Building2; label: string; value?: string; locked?: boolean; className?: string }) {
  return (
    <div className={`flex items-start gap-2 min-w-0 ${className}`}>
      <Icon size={14} className="text-ink-400 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">
          {label}{locked && <Lock size={9} className="text-ink-300" aria-hidden="true" />}
        </div>
        <div className="text-[0.8125rem] text-ink-800 truncate" title={value || '—'}>{value?.trim() || <span className="text-ink-400">—</span>}</div>
      </div>
    </div>
  );
}

/** The editable report-details header shown atop an opened report. A quiet facts
 *  card at rest; "Edit details" flips it to an inline form the user can save or
 *  cancel — available anytime. Financial Year and Generated On are locked (auto). */
export default function EditableReportHeader({ meta, onChange }: {
  meta: ReportMeta;
  onChange: (patch: Partial<ReportMeta>) => void;
}) {
  const { lov, reportFields, isFieldHidden } = useAdminSettings();
  // Fields hidden in Reports → Admin are left off the header too.
  const show = (key: string) => !isFieldHidden(key);
  const customFields = reportFields.custom.filter(f => show(f.key));
  const setCustom = (key: string, v: string) => setDraft(d => ({ ...d, custom: { ...(d.custom ?? {}), [key]: v } }));
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [draft, setDraft] = useState<ReportMeta>(meta);

  const open = () => { setDraft(meta); setEditing(true); };
  const save = () => { onChange(draft); setEditing(false); };
  const set = (patch: Partial<ReportMeta>) => setDraft(d => ({ ...d, ...patch }));

  // The header shows the report NAME (the uploaded report / file). Audit Title is
  // a separate detail field below.
  const title = meta.reportName?.trim() || meta.auditTitle?.trim() || 'Untitled report';

  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[0.8125rem] font-semibold text-ink-900">Edit report details</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[0.75rem] font-semibold text-ink-600 hover:text-ink-900 hover:bg-draft-50 cursor-pointer transition-colors"><X size={14} aria-hidden="true" /> Cancel</button>
                <button onClick={save} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[0.75rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors"><Check size={14} aria-hidden="true" /> Save details</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
              {/* Identity */}
              <Field label="Report Name"><input value={draft.reportName ?? ''} onChange={e => set({ reportName: e.target.value })} placeholder="Names the report and its ATR" className={INPUT_CLS} /></Field>
              {show('auditTitle') && <Field label="Audit Title"><input value={draft.auditTitle ?? ''} onChange={e => set({ auditTitle: e.target.value })} placeholder="e.g. Procurement & Dispatch Process" className={INPUT_CLS} /></Field>}
              {show('auditEntity') && <Field label="Audit Entity"><input value={draft.auditEntity ?? ''} onChange={e => set({ auditEntity: e.target.value })} placeholder="e.g. ABC Manufacturing Ltd" className={INPUT_CLS} /></Field>}
              {show('auditFunction') && <Field label="Function"><Select value={draft.auditFunction ?? ''} onChange={v => set({ auditFunction: v })} options={lov('function')} /></Field>}
              {/* Classification */}
              {show('section') && <Field label="Section"><Select value={draft.section ?? ''} onChange={v => set({ section: v })} options={lov('section')} /></Field>}
              {show('reviewType') && <Field label="Review type"><Select value={draft.reviewType ?? ''} onChange={v => set({ reviewType: v })} options={lov('reviewType')} /></Field>}
              {show('auditLocation') && <Field label="Audit location"><Select value={draft.auditLocation ?? ''} onChange={v => set({ auditLocation: v })} options={lov('auditLocation')} /></Field>}
              {/* Geography + reference */}
              {show('region') && <Field label="Region"><Select value={draft.region ?? ''} onChange={v => set({ region: v })} options={lov('region')} /></Field>}
              {show('location') && <Field label="Location (City)"><Select value={draft.location ?? ''} onChange={v => set({ location: v })} options={lov('location')} /></Field>}
              {show('reportNumber') && <Field label="Report Number"><input value={draft.reportNumber ?? ''} onChange={e => set({ reportNumber: e.target.value })} placeholder="e.g. IA/2025-26/003" className={INPUT_CLS} /></Field>}
              <Field label="Financial Year" locked><input value={draft.financialYear ?? ''} readOnly aria-readonly title="Financial Year is derived from the audit period and can't be edited" className={LOCKED_CLS} /></Field>
              {show('auditPeriod') && <Field label="Audit Period" locked><input value={draft.auditPeriod ?? ''} readOnly aria-readonly title="Audit Period is set from the uploaded report and can't be edited" className={LOCKED_CLS} /></Field>}
              {/* People / auto */}
              {show('preparedBy') && <Field label="Prepared By"><input value={draft.preparedBy ?? ''} onChange={e => set({ preparedBy: e.target.value })} placeholder="e.g. Internal Audit Team" className={INPUT_CLS} /></Field>}
              <Field label="Audit SPOC" locked><input value={draft.auditSpoc ?? ''} readOnly aria-readonly title="The signed-in user who created this ATR — not editable" className={LOCKED_CLS} /></Field>
              <Field label="Generated On" locked><input value={draft.generatedOn ?? ''} readOnly aria-readonly title="Generated On is set automatically and can't be edited" className={LOCKED_CLS} /></Field>
              {/* Custom fields added in Reports → Admin */}
              {customFields.map(f => {
                const v = draft.custom?.[f.key] ?? '';
                return (
                  <Field key={f.key} label={f.label}>
                    {f.type === 'select' ? <Select value={v} onChange={val => setCustom(f.key, val)} options={lov(f.key)} />
                      : f.type === 'date' ? <DatePicker value={v} onChange={e => setCustom(f.key, e.target.value)} placeholder="Pick a date" className={INPUT_CLS} aria-label={f.label} />
                      : <input type={f.type === 'number' ? 'number' : 'text'} value={v} onChange={e => setCustom(f.key, e.target.value)} placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`} className={INPUT_CLS} />}
                  </Field>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <button onClick={() => setExpanded(e => !e)} aria-expanded={expanded} aria-label={expanded ? 'Collapse report details' : 'Expand report details'} className="flex items-center gap-2 min-w-0 text-left cursor-pointer group">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-ink-400 group-hover:text-ink-700 group-hover:bg-canvas transition-colors shrink-0">
                  <motion.span animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.2 }} className="inline-flex"><ChevronDown size={16} aria-hidden="true" /></motion.span>
                </span>
                <h2 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight truncate min-w-0" title={title}>{title}</h2>
              </button>
              <button onClick={open} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-canvas-border text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer transition-colors shrink-0">
                <Pencil size={13} aria-hidden="true" /> Edit details
              </button>
            </div>
            {/* Same grouping + order as the edit form: identity · classification ·
                reference · people/auto. Collapsible via the chevron. */}
            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div key="facts" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="mt-4 pt-4 border-t border-canvas-border grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3.5">
                    {/* Identity */}
                    {show('auditTitle') && <Fact icon={FileText} label="Audit Title" value={meta.auditTitle} />}
                    {show('auditEntity') && <Fact icon={Building2} label="Audit Entity" value={meta.auditEntity} />}
                    {show('auditFunction') && <Fact icon={Briefcase} label="Function" value={meta.auditFunction} />}
                    {/* Classification */}
                    {show('section') && <Fact icon={Shield} label="Section" value={meta.section} />}
                    {show('reviewType') && <Fact icon={ClipboardList} label="Review type" value={meta.reviewType} />}
                    {show('auditLocation') && <Fact icon={Landmark} label="Audit location" value={meta.auditLocation} />}
                    {/* Geography + reference */}
                    {show('region') && <Fact icon={Globe} label="Region" value={meta.region} />}
                    {show('location') && <Fact icon={MapPin} label="Location (City)" value={meta.location} />}
                    {show('reportNumber') && <Fact icon={Hash} label="Report Number" value={meta.reportNumber} />}
                    {/* Reference + period */}
                    <Fact icon={CalendarDays} label="Financial Year" value={meta.financialYear} locked />
                    {show('auditPeriod') && <Fact icon={CalendarRange} label="Audit Period" value={meta.auditPeriod} locked />}
                    {show('preparedBy') && <Fact icon={UserCheck} label="Prepared By" value={meta.preparedBy} />}
                    <Fact icon={UserCog} label="Audit SPOC" value={meta.auditSpoc} locked />
                    <Fact icon={CalendarClock} label="Generated On" value={meta.generatedOn} locked />
                    {customFields.map(f => <Fact key={f.key} icon={Tag} label={f.label} value={meta.custom?.[f.key]} />)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
