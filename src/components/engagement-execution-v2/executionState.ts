// ─── Engagement Execution V2 — Display Constants ─────────────────────────
// Style maps for rendering status badges in UI.
// All derivation logic lives in helpers.ts — this file is display-only.

import { ControlExecStatus } from './types';

// ─── Execution Status Display ─────────────────────────────────────────────

export const EXEC_STATUS_DISPLAY: Record<ControlExecStatus, { label: string; bg: string; text: string }> = {
  [ControlExecStatus.NOT_STARTED]:          { label: 'Not Started',          bg: 'bg-gray-100',    text: 'text-gray-600' },
  [ControlExecStatus.POPULATION_READY]:     { label: 'Population Ready',     bg: 'bg-amber-50',    text: 'text-amber-700' },
  [ControlExecStatus.TEST_ITEMS_READY]:     { label: 'Test Items Ready',     bg: 'bg-amber-50',    text: 'text-amber-600' },
  [ControlExecStatus.EVIDENCE_IN_PROGRESS]: { label: 'Evidence In Progress', bg: 'bg-blue-50',     text: 'text-blue-600' },
  [ControlExecStatus.EVIDENCE_READY]:       { label: 'Evidence Ready',       bg: 'bg-blue-50',     text: 'text-blue-700' },
  [ControlExecStatus.TESTING_IN_PROGRESS]:  { label: 'Testing In Progress',  bg: 'bg-blue-50',     text: 'text-blue-700' },
  [ControlExecStatus.TESTING_COMPLETE]:     { label: 'Testing Complete',     bg: 'bg-purple-50',   text: 'text-purple-700' },
  [ControlExecStatus.PENDING_REVIEW]:       { label: 'Pending Review',       bg: 'bg-purple-50',   text: 'text-purple-600' },
  [ControlExecStatus.REJECTED]:             { label: 'Rejected',             bg: 'bg-red-50',      text: 'text-red-700' },
  [ControlExecStatus.CONCLUDED]:            { label: 'Concluded',            bg: 'bg-emerald-50',  text: 'text-emerald-700' },
};

// ─── Conclusion Display ───────────────────────────────────────────────────

export const CONCLUSION_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  EFFECTIVE:   { label: 'Effective',   bg: 'bg-emerald-50', text: 'text-emerald-700' },
  INEFFECTIVE: { label: 'Ineffective', bg: 'bg-red-50',     text: 'text-red-700' },
};

// ─── Automation Class Display ─────────────────────────────────────────────

export const AUTOMATION_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  AUTOMATED:    { label: 'Automated',    bg: 'bg-evidence-50', text: 'text-evidence-700' },
  MANUAL:       { label: 'Manual',       bg: 'bg-gray-100',    text: 'text-gray-600' },
  IT_DEPENDENT: { label: 'IT-Dependent', bg: 'bg-purple-50',   text: 'text-purple-700' },
};

// ─── Importance Class Display ─────────────────────────────────────────────

export const IMPORTANCE_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  KEY:     { label: 'Key',     bg: 'bg-primary/10', text: 'text-primary' },
  NON_KEY: { label: 'Non-Key', bg: 'bg-gray-100',   text: 'text-gray-600' },
};

// ─── Nature Class Display ─────────────────────────────────────────────────

export const NATURE_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  PREVENTIVE: { label: 'Preventive', bg: 'bg-blue-50',   text: 'text-blue-700' },
  DETECTIVE:  { label: 'Detective',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  CORRECTIVE: { label: 'Corrective', bg: 'bg-purple-50', text: 'text-purple-700' },
};

// ─── Derived Control Type Display ─────────────────────────────────────────

export const CONTROL_TYPE_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  Automated: { label: 'Automated', bg: 'bg-evidence-50', text: 'text-evidence-700' },
  Manual:    { label: 'Manual',    bg: 'bg-gray-100',    text: 'text-gray-600' },
  Hybrid:    { label: 'Hybrid',    bg: 'bg-purple-50',   text: 'text-purple-700' },
};

// ─── Evidence Status Display ──────────────────────────────────────────────

export const EVIDENCE_STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  NOT_UPLOADED: { label: 'Not Uploaded', bg: 'bg-gray-100',   text: 'text-gray-500' },
  PARTIAL:      { label: 'Partial',      bg: 'bg-amber-50',   text: 'text-amber-600' },
  READY:        { label: 'Ready',        bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

// ─── Review Status Display ────────────────────────────────────────────────

export const REVIEW_STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  NOT_SUBMITTED: { label: '—',        bg: 'bg-gray-50',    text: 'text-gray-400' },
  PENDING:       { label: 'Pending',  bg: 'bg-purple-50',  text: 'text-purple-600' },
  APPROVED:      { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  REJECTED:      { label: 'Rejected', bg: 'bg-red-50',     text: 'text-red-700' },
};
