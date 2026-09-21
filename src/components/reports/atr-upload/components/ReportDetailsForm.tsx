import { useState, useEffect, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import DatePicker from '../../../shared/DatePicker';
import { useCurrentUser } from '../../../../context/CurrentUserContext';
import { useAdminSettings } from '../adminStore';
import { financialYearOf, isReportNumberTaken } from '../reportClassification';
import { BUILTIN_REPORT_FIELDS, type BuiltinReportField, type CustomReportField } from '../reportFields';
import type { ReportMeta } from '../types';

const INPUT_CLS = 'w-full h-9 px-3 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

// ISO "yyyy-mm-dd" → "DD Mon YYYY".
const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
// "DD Mon YYYY" → ISO "yyyy-mm-dd" (the reverse, for re-opening a saved draft).
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const toIso = (label: string) => {
  // en-GB prints "Sept", which Date() will not parse — match on the prefix.
  const m = label.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const month = m ? MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) : -1;
  if (!m || month < 0) return '';
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
// The stored "start – end" period back into its two ISO dates.
const splitPeriod = (period?: string): [string, string] => {
  const [a, b] = (period ?? '').split(/\s+[–-]\s+/);
  return [a ? toIso(a) : '', b ? toIso(b) : ''];
};

function Field({ label, required, hint, children, className = '' }: { label: string; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[0.75rem] font-semibold text-ink-700 mb-1.5">
        {label}{required && <span className="text-risk-700"> *</span>}
        {hint && <span className="font-normal text-ink-400"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// Native select styled to match the text inputs, with a chevron affordance.
// A "Select…" placeholder sits first so the user makes a deliberate choice.
function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value as T)} className={`${INPUT_CLS} appearance-none pr-8 cursor-pointer ${value ? '' : 'text-ink-400'}`}>
        <option value="" disabled>Select…</option>
        {options.map(o => <option key={o.value} value={o.value} className="text-ink-800">{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

export interface ReportDetailsValue {
  meta: Partial<ReportMeta>;
  /** All required detail fields present. */
  complete: boolean;
  /** Report Number already used in this Section + Financial Year. */
  duplicate: boolean;
  /** Names of missing required detail fields (for the parent's footer message). */
  outstanding: string[];
}

// Built-in text/select values, keyed by field. The audit period is two dates.
type Values = Record<BuiltinReportField['key'], string>;
const EMPTY_VALUES: Values = {
  reportName: '', auditTitle: '', auditEntity: '', auditFunction: '', section: '', reviewType: '', auditLocation: '',
  region: '', location: '', reportNumber: '', auditPeriod: '', preparedBy: '',
};

/**
 * The shared ATR cover-details form — the built-in fields (title, entity,
 * classification, period, people) plus any custom fields the admin has added.
 * Which fields are mandatory comes from Reports → Admin → Lists of Values →
 * Report details fields. Used by BOTH upload methods (existing report + IRAME
 * template) so they capture the same details. Reports validity + built meta up
 * via `onChange`.
 */
export default function ReportDetailsForm({ onChange, intro, suggestedReportName, omit = [], reportNameError, initial, showHeader = true }: {
  onChange: (v: ReportDetailsValue) => void;
  intro?: ReactNode;
  /** Hide the "Report details" heading + intro when the host provides its own. */
  showHeader?: boolean;
  /** Values to start from — a draft the user is coming back to. */
  initial?: Partial<ReportMeta>;
  /** The uploaded file's name (sans extension) — auto-fills Report Name until
   *  the user types their own. */
  suggestedReportName?: string;
  /** Built-in fields the host already asks for elsewhere — left off the form
   *  and off the completeness check. */
  omit?: BuiltinReportField['key'][];
  /** Shown under Report Name when the host rejects it (names are unique). */
  reportNameError?: string;
}) {
  const { currentUser } = useCurrentUser();
  // Audit SPOC is the signed-in user who's creating the ATR — never editable.
  const auditSpoc = currentUser?.name ?? '';

  // Dropdown vocabularies + field config come from the admin-managed settings.
  const { lov, isFieldRequired, isFieldHidden, reportFields } = useAdminSettings();
  const opts = (key: string) => lov(key).map(v => ({ value: v, label: v }));
  // Hidden fields (Reports → Admin) are left off the form entirely.
  const builtinFields = BUILTIN_REPORT_FIELDS.filter(f => !isFieldHidden(f.key) && !omit.includes(f.key));
  const customFields = reportFields.custom.filter(f => !isFieldHidden(f.key));

  // Everything starts empty so the user consciously fills each detail — unless
  // they are coming back to a draft, which starts where they left it.
  const [values, setValues] = useState<Values>(() => ({
    ...EMPTY_VALUES,
    ...(initial ? Object.fromEntries((Object.keys(EMPTY_VALUES) as BuiltinReportField['key'][]).filter(k => k !== 'auditPeriod' && initial[k]).map(k => [k, initial[k] as string])) : {}),
  }));
  const [periodStart, setPeriodStart] = useState(() => splitPeriod(initial?.auditPeriod)[0]);
  const [periodEnd, setPeriodEnd] = useState(() => splitPeriod(initial?.auditPeriod)[1]);
  const [custom, setCustom] = useState<Record<string, string>>(() => ({ ...(initial?.custom ?? {}) }));
  const [generatedOn] = useState(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
  const set = (key: BuiltinReportField['key'], v: string) => setValues(prev => ({ ...prev, [key]: v }));

  // Report Name follows the uploaded file's name until the user renames it —
  // then their name sticks, even if they swap the file.
  const [reportNameTouched, setReportNameTouched] = useState(() => !!initial?.reportName?.trim());
  useEffect(() => {
    if (reportNameTouched) return;
    setValues(prev => (prev.reportName === (suggestedReportName ?? '') ? prev : { ...prev, reportName: suggestedReportName ?? '' }));
  }, [suggestedReportName, reportNameTouched]);

  const { section, reportNumber } = values;
  const financialYear = financialYearOf(periodEnd || periodStart);
  const duplicate = !!reportNumber.trim() && !!financialYear && isReportNumberTaken(section, financialYear, reportNumber);

  // A field's current value, as the completeness check sees it.
  const filled = (f: BuiltinReportField) => (f.key === 'auditPeriod' ? !!(periodStart && periodEnd) : !!values[f.key].trim());
  const outstanding: string[] = [
    ...builtinFields.filter(f => isFieldRequired(f.key) && !filled(f)).map(f => f.label),
    ...customFields.filter(f => f.required && !(custom[f.key] ?? '').trim()).map(f => f.label),
  ];
  const complete = outstanding.length === 0;

  // Report validity + built meta up whenever anything changes. `onChange` is a
  // stable state setter in the parents, so this never loops.
  const customJson = JSON.stringify(custom);
  useEffect(() => {
    const trimmedCustom = Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    onChange({
      meta: {
        reportName: values.reportName.trim(),
        reportNumber: reportNumber.trim(),
        section, reviewType: values.reviewType, auditLocation: values.auditLocation, region: values.region, location: values.location,
        auditFunction: values.auditFunction, auditSpoc, financialYear,
        auditTitle: values.auditTitle.trim(),
        auditEntity: values.auditEntity.trim(),
        auditPeriod: periodStart && periodEnd ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}` : '',
        preparedBy: values.preparedBy.trim(),
        generatedOn,
        custom: Object.keys(trimmedCustom).length ? trimmedCustom : undefined,
        customLabels: Object.keys(trimmedCustom).length ? Object.fromEntries(customFields.filter(f => trimmedCustom[f.key]).map(f => [f.key, f.label])) : undefined,
      },
      complete, duplicate, outstanding,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, customJson, auditSpoc, periodStart, periodEnd, generatedOn, financialYear, complete, duplicate, outstanding.join('|')]);

  // One built-in field → its control.
  const builtin = (f: BuiltinReportField) => {
    const required = isFieldRequired(f.key);
    if (f.key === 'auditPeriod') {
      return (
        <Field key={f.key} label={f.label} required={required} hint="date range" className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <DatePicker value={periodStart} onChange={e => setPeriodStart(e.target.value)} max={periodEnd || undefined} placeholder="Start date" className={INPUT_CLS} aria-label="Audit period start date" />
            <span className="text-ink-400 shrink-0">–</span>
            <DatePicker value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} min={periodStart || undefined} placeholder="End date" className={INPUT_CLS} aria-label="Audit period end date" />
          </div>
        </Field>
      );
    }
    if (f.key === 'reportName') {
      return (
        <Field key={f.key} label={f.label} required={required} hint={suggestedReportName && !reportNameTouched ? 'from the uploaded file · rename anytime' : undefined}>
          <input
            value={values.reportName}
            onChange={e => { setReportNameTouched(true); set('reportName', e.target.value); }}
            placeholder={suggestedReportName ? undefined : 'e.g. Q3 Treasury Controls Review'}
            aria-invalid={!!reportNameError}
            className={`${INPUT_CLS} ${reportNameError ? 'border-risk-400 focus:border-risk-500 focus:ring-risk-500/10' : ''}`}
          />
          {reportNameError && (
            <p className="mt-1 flex items-start gap-1 text-[0.6875rem] text-risk-700 leading-snug">
              <AlertCircle size={12} className="mt-px shrink-0" aria-hidden="true" />
              {reportNameError}
            </p>
          )}
        </Field>
      );
    }
    if (f.key === 'reportNumber') {
      return (
        <Field key={f.key} label={f.label} required={required} hint={financialYear ? `unique · ${financialYear}` : 'read or type'}>
          <input
            value={reportNumber}
            onChange={e => set('reportNumber', e.target.value)}
            placeholder={f.placeholder}
            aria-invalid={duplicate}
            className={`${INPUT_CLS} ${duplicate ? 'border-risk-400 focus:border-risk-500 focus:ring-risk-500/10' : ''}`}
          />
          {duplicate && (
            <p className="mt-1 flex items-start gap-1 text-[0.6875rem] text-risk-700 leading-snug">
              <AlertCircle size={12} className="mt-px shrink-0" aria-hidden="true" />
              Already used in {section} for {financialYear}. Report Numbers must be unique per section within a financial year.
            </p>
          )}
        </Field>
      );
    }
    if (f.type === 'select') {
      return (
        <Field key={f.key} label={f.label} required={required}>
          <Select value={values[f.key]} onChange={v => set(f.key, v)} options={opts(f.lovKey!)} />
        </Field>
      );
    }
    return (
      <Field key={f.key} label={f.label} required={required}>
        <input value={values[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} className={INPUT_CLS} />
      </Field>
    );
  };

  // One admin-added custom field → its control, by type.
  const customControl = (f: CustomReportField) => {
    const v = custom[f.key] ?? '';
    const setV = (next: string) => setCustom(prev => ({ ...prev, [f.key]: next }));
    return (
      <Field key={f.key} label={f.label} required={f.required}>
        {f.type === 'select' ? <Select value={v} onChange={setV} options={opts(f.key)} />
          : f.type === 'date' ? <DatePicker value={v} onChange={e => setV(e.target.value)} placeholder="Pick a date" className={INPUT_CLS} aria-label={f.label} />
          : <input type={f.type === 'number' ? 'number' : 'text'} value={v} onChange={e => setV(e.target.value)} placeholder={f.placeholder || (f.type === 'number' ? 'e.g. 12' : `Enter ${f.label.toLowerCase()}`)} className={INPUT_CLS} />}
      </Field>
    );
  };

  return (
    <div className="text-left">
      {showHeader && (
        <div className="mb-3.5">
          <h3 className="text-[0.8125rem] font-semibold text-ink-900">Report details</h3>
          <p className="text-[0.75rem] text-ink-500 mt-0.5">{intro ?? 'These print on the ATR cover. Confirm the classification and cover facts here.'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
        {/* Built-in fields, in catalogue order: identity · classification ·
            geography + reference · period + people. */}
        {builtinFields.map(builtin)}

        {/* Auto / locked */}
        <Field label="Audit SPOC" hint="you · auto">
          <input value={auditSpoc} readOnly aria-readonly title="The signed-in user creating this ATR — not editable" className={`${INPUT_CLS} bg-canvas text-ink-600 cursor-default focus:ring-0 focus:border-canvas-border`} />
        </Field>
        <Field label="Generated On" hint="auto">
          <input value={generatedOn} readOnly aria-readonly className={`${INPUT_CLS} bg-canvas text-ink-600 cursor-default focus:ring-0 focus:border-canvas-border`} />
        </Field>

        {/* Custom fields added in Reports → Admin. */}
        {customFields.map(customControl)}
      </div>
    </div>
  );
}
