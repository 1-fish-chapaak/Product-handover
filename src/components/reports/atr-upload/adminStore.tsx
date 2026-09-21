import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useCurrentUser } from '../../../context/CurrentUserContext';
import {
  SECTION_OPTIONS, REVIEW_TYPE_OPTIONS, AUDIT_LOCATION_OPTIONS,
  REGION_OPTIONS, LOCATION_OPTIONS, FUNCTION_OPTIONS,
} from './reportClassification';
import {
  CLASSIFICATION_OPTIONS, RISK_OPTIONS, ROOT_CAUSE_OPTIONS, SOLUTION_TYPE_OPTIONS, RISK_IMPLICATIONS_OPTIONS,
} from './observationFields';
import { type EscalationMatrixSet, cloneDefaultMatrixSet, normalizeEscalationSet } from './escalationMatrix';
import {
  BUILTIN_REPORT_FIELDS, DEFAULT_REPORT_FIELDS_CONFIG, builtinRequired, customFieldKey,
  type ReportFieldsConfig, type CustomReportField,
} from './reportFields';

// ─── ATR admin settings ───
// Runtime-editable configuration so the platform can flex with organisational
// change without a code release: the List-of-Values (dropdown vocabularies) and
// the default Escalation Matrix. Persisted to localStorage. New admin features
// (approval chains, templates, …) plug into the same store.

/** One editable list of values, grouped for the admin UI. */
export interface LovDef {
  key: string;
  label: string;
  group: 'report' | 'observation';
  /** Where the value is used, shown as a hint in the admin UI. */
  hint: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const LOV_DEFS: LovDef[] = [
  { key: 'section',          label: 'Section',           group: 'report',      hint: 'Report details' },
  { key: 'reviewType',       label: 'Review Type',       group: 'report',      hint: 'Report details' },
  { key: 'auditLocation',    label: 'Audit Location',    group: 'report',      hint: 'Report details' },
  { key: 'region',           label: 'Region',            group: 'report',      hint: 'Report details' },
  { key: 'location',         label: 'Location (City)',   group: 'report',      hint: 'Report details' },
  { key: 'function',         label: 'Function',          group: 'report',      hint: 'Report details' },
  { key: 'rootCause',        label: 'Root Cause',        group: 'observation', hint: 'Each observation' },
  { key: 'solutionType',     label: 'Solution Type',     group: 'observation', hint: 'Each observation' },
  { key: 'riskImplications', label: 'Risk Implications', group: 'observation', hint: 'Each observation' },
  { key: 'risk',             label: 'Risk Significance', group: 'observation', hint: 'Each observation' },
  { key: 'classification',   label: 'Classification',    group: 'observation', hint: 'Each observation' },
];

const DEFAULT_LOVS: Record<string, string[]> = {
  section: [...SECTION_OPTIONS],
  reviewType: REVIEW_TYPE_OPTIONS.map(o => o.value),
  auditLocation: [...AUDIT_LOCATION_OPTIONS],
  region: [...REGION_OPTIONS],
  location: [...LOCATION_OPTIONS],
  function: [...FUNCTION_OPTIONS],
  rootCause: [...ROOT_CAUSE_OPTIONS],
  solutionType: [...SOLUTION_TYPE_OPTIONS],
  riskImplications: [...RISK_IMPLICATIONS_OPTIONS],
  risk: [...RISK_OPTIONS],
  classification: [...CLASSIFICATION_OPTIONS],
};

// ─── Transaction logs ───
// Action-level audit trail of every change made in Create Report, so
// modifications can be monitored. Kept newest-first, capped to the most recent.
export type LogAction = 'Extract' | 'Generate' | 'Edit' | 'Resolve' | 'Skip' | 'Link' | 'Unlink' | 'Remove' | 'Config';

export interface TransactionLog {
  id: string;
  at: string;      // ISO timestamp
  user: string;
  action: LogAction;
  /** What was affected — report name, list name, observation, etc. */
  target: string;
  /** Human-readable description of the change. */
  detail: string;
}

const LOG_CAP = 500;

const STORAGE_KEY = 'irame.atr-admin.v1';

interface AdminState {
  lovs: Record<string, string[]>;
  /** The escalation cadence per observation severity (or one shared cadence). */
  escalation: EscalationMatrixSet;
  logs: TransactionLog[];
  /** Which report-details fields are mandatory + the admin-added custom fields. */
  reportFields: ReportFieldsConfig;
}

function loadState(): AdminState {
  const base: AdminState = { lovs: cloneLovs(DEFAULT_LOVS), escalation: cloneDefaultMatrixSet(), logs: [], reportFields: { required: {}, hidden: {}, custom: [] } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AdminState>;
    return {
      // Merge so any newly-added LOV key falls back to its default.
      lovs: { ...base.lovs, ...(parsed.lovs ?? {}) },
      // A legacy single cadence (before severities) becomes the shared cadence.
      escalation: parsed.escalation ? normalizeEscalationSet(parsed.escalation) : base.escalation,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      reportFields: {
        required: { ...(parsed.reportFields?.required ?? {}) },
        hidden: { ...(parsed.reportFields?.hidden ?? {}) },
        custom: Array.isArray(parsed.reportFields?.custom) ? parsed.reportFields!.custom : [],
      },
    };
  } catch { return base; }
}

function cloneLovs(l: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(l).map(([k, v]) => [k, [...v]]));
}

export interface AdminSettingsValue {
  lovs: Record<string, string[]>;
  /** The values for one list (defaults to [] for an unknown key). */
  lov: (key: string) => string[];
  /** Replace a list's values wholesale (the LOV editor builds the new array). */
  setLov: (key: string, values: string[]) => void;
  /** Restore a list to its shipped defaults. */
  resetLov: (key: string) => void;
  escalation: EscalationMatrixSet;
  setEscalation: (next: EscalationMatrixSet) => void;
  /** The action-level transaction log (newest first). */
  logs: TransactionLog[];
  /** Record one change made in Create Report. */
  addLog: (entry: { action: LogAction; target: string; detail: string }) => void;
  /** Report-details form configuration: mandatory flags + custom fields. */
  reportFields: ReportFieldsConfig;
  /** Whether a report-details field (built-in or custom key) is mandatory. */
  isFieldRequired: (key: string) => boolean;
  setFieldRequired: (key: string, required: boolean) => void;
  /** Whether a report-details field is hidden from the form and report header. */
  isFieldHidden: (key: string) => boolean;
  setFieldHidden: (key: string, hidden: boolean) => void;
  /** Add a custom field; returns it (with its generated key). A dropdown field
   *  starts with an empty list of values under that key. */
  addCustomField: (field: Omit<CustomReportField, 'key'>) => CustomReportField;
  updateCustomField: (key: string, patch: Partial<Omit<CustomReportField, 'key'>>) => void;
  /** Remove a custom field (and its list of values, if it was a dropdown). */
  removeCustomField: (key: string) => void;
  /** Every list of values to manage: the built-in lists plus one per custom
   *  dropdown field. */
  lovDefs: LovDef[];
}

const Ctx = createContext<AdminSettingsValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminSettings = (): AdminSettingsValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdminSettings must be used within AdminSettingsProvider');
  return v;
};

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>(loadState);
  // Latest state for callbacks that need to read (not just update) it synchronously.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const { currentUser } = useCurrentUser();
  // Keep the latest user in a ref so addLog stays a stable callback.
  const userRef = useRef(currentUser?.name ?? 'You');
  useEffect(() => { userRef.current = currentUser?.name ?? 'You'; }, [currentUser]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const addLog = useCallback((entry: { action: LogAction; target: string; detail: string }) => {
    const log: TransactionLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      user: userRef.current,
      ...entry,
    };
    setState(s => ({ ...s, logs: [log, ...s.logs].slice(0, LOG_CAP) }));
  }, []);

  const lov = useCallback((key: string) => state.lovs[key] ?? [], [state.lovs]);
  const setLov = useCallback((key: string, values: string[]) => {
    setState(s => ({ ...s, lovs: { ...s.lovs, [key]: values } }));
  }, []);
  const resetLov = useCallback((key: string) => {
    setState(s => ({ ...s, lovs: { ...s.lovs, [key]: [...(DEFAULT_LOVS[key] ?? [])] } }));
  }, []);
  const setEscalation = useCallback((next: EscalationMatrixSet) => {
    setState(s => ({ ...s, escalation: next }));
  }, []);

  // ── Report-details fields ──
  const reportFields = state.reportFields ?? DEFAULT_REPORT_FIELDS_CONFIG;
  const isFieldRequired = useCallback((key: string) => {
    const cfg = state.reportFields ?? DEFAULT_REPORT_FIELDS_CONFIG;
    const builtin = BUILTIN_REPORT_FIELDS.find(f => f.key === key);
    if (builtin) return builtinRequired(builtin, cfg);
    if (cfg.hidden?.[key]) return false;
    return cfg.custom.find(f => f.key === key)?.required ?? false;
  }, [state.reportFields]);
  const isFieldHidden = useCallback((key: string) => {
    const builtin = BUILTIN_REPORT_FIELDS.find(f => f.key === key);
    if (builtin?.lockedRequired) return false;
    return !!(state.reportFields ?? DEFAULT_REPORT_FIELDS_CONFIG).hidden?.[key];
  }, [state.reportFields]);
  const setFieldHidden = useCallback((key: string, hidden: boolean) => {
    setState(s => {
      const builtin = BUILTIN_REPORT_FIELDS.find(f => f.key === key);
      if (builtin?.lockedRequired) return s;
      return { ...s, reportFields: { ...s.reportFields, hidden: { ...(s.reportFields.hidden ?? {}), [key]: hidden } } };
    });
  }, []);
  const setFieldRequired = useCallback((key: string, required: boolean) => {
    setState(s => {
      const cfg = s.reportFields;
      const builtin = BUILTIN_REPORT_FIELDS.find(f => f.key === key);
      if (builtin) {
        if (builtin.lockedRequired) return s;
        return { ...s, reportFields: { ...cfg, required: { ...cfg.required, [key]: required } } };
      }
      return { ...s, reportFields: { ...cfg, custom: cfg.custom.map(f => (f.key === key ? { ...f, required } : f)) } };
    });
  }, []);
  const addCustomField = useCallback((field: Omit<CustomReportField, 'key'>): CustomReportField => {
    const taken = [...BUILTIN_REPORT_FIELDS.map(f => f.key as string), ...stateRef.current.reportFields.custom.map(f => f.key), ...Object.keys(stateRef.current.lovs)];
    const created: CustomReportField = { ...field, label: field.label.trim(), key: customFieldKey(field.label, taken) };
    setState(s => ({
      ...s,
      reportFields: { ...s.reportFields, custom: [...s.reportFields.custom, created] },
      lovs: created.type === 'select' ? { ...s.lovs, [created.key]: s.lovs[created.key] ?? [] } : s.lovs,
    }));
    return created;
  }, []);
  const updateCustomField = useCallback((key: string, patch: Partial<Omit<CustomReportField, 'key'>>) => {
    setState(s => ({
      ...s,
      reportFields: { ...s.reportFields, custom: s.reportFields.custom.map(f => (f.key === key ? { ...f, ...patch } : f)) },
      // Switching a field to a dropdown gives it an (empty) list to manage.
      lovs: patch.type === 'select' && !s.lovs[key] ? { ...s.lovs, [key]: [] } : s.lovs,
    }));
  }, []);
  const removeCustomField = useCallback((key: string) => {
    setState(s => {
      const lovs = { ...s.lovs }; delete lovs[key];
      const hidden = { ...(s.reportFields.hidden ?? {}) }; delete hidden[key];
      return { ...s, lovs, reportFields: { ...s.reportFields, hidden, custom: s.reportFields.custom.filter(f => f.key !== key) } };
    });
  }, []);
  const lovDefs: LovDef[] = [
    ...LOV_DEFS,
    ...reportFields.custom.filter(f => f.type === 'select').map(f => ({ key: f.key, label: f.label, group: 'report' as const, hint: 'Custom field' })),
  ];

  const value: AdminSettingsValue = {
    lovs: state.lovs, lov, setLov, resetLov, escalation: state.escalation, setEscalation,
    logs: state.logs, addLog,
    reportFields, isFieldRequired, setFieldRequired, isFieldHidden, setFieldHidden, addCustomField, updateCustomField, removeCustomField, lovDefs,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
