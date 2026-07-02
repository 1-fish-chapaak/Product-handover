import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  Eye,
  Filter,
  GripVertical,
  MoreVertical,
  Pin,
  PinOff,
  Search,
  Tag,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  AlertCircle,
  Plus,
  Download,
  Pencil,
  Trash2,
  UserPlus,
  RotateCcw,
  CheckCircle2,
  ClipboardCheck,
} from 'lucide-react';
import {
  GRC_CASE_DETAILS,
  type GrcException,
  type GrcExceptionStatus,
  type GrcExceptionClassification,
  type GrcActionStatus,
} from '../../data/mockData';
import type { ExceptionRole } from '../../hooks/useAppState';
import { unreadCommentCount } from './commentStore';
import { useToast } from '../shared/Toast';
import { useWorkflow } from './workflow/WorkflowContext';
import { canAct, currentLevel, primaryAssignment } from './workflow/workflowEngine';
import { userName } from './workflow/workflowData';
import type { Assignment } from './workflow/workflowTypes';

// Plain-language approval state for the table's Approval column. `yourTurn`
// flags when the acting user (header "Acting as") is the one who must act now.
function approvalCellMeta(a: Assignment | undefined, currentUserId: string): { label: string; cls: string; dot: string; yourTurn: boolean } | null {
  if (!a || a.status === 'pulled-back') return null;
  const assignee = userName(a.assigneeId);
  const assigneeTurn = (a.status === 'drafting' || a.status === 'rejected') && currentUserId === a.assigneeId;
  const approverTurn = a.status === 'in-approval' && canAct(a, currentUserId).ok;
  const cls = a.draft?.classification ?? '';
  const actionable = cls === 'Design Deficiency' || cls === 'System Deficiency' || cls === 'Procedural Non-Compliance';
  switch (a.status) {
    case 'approved': {
      // Action Taken cleared the whole chain → case is closed.
      if (a.actionCycle) {
        const impl = a.draft?.actionStatus;
        return { label: impl ? `Approved · ${impl}` : 'Approved', cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant', yourTurn: false };
      }
      // Actionable plan approved but the case isn't closed yet — it's back with the
      // Risk Owner to carry out the action. Keep a live status, not a flat Approved.
      if (actionable) {
        return { label: `Plan approved · action with ${assignee}`, cls: 'bg-evidence-50 text-evidence-700', dot: 'bg-evidence', yourTurn: currentUserId === a.assigneeId };
      }
      // BAU / False Positive — classification approved, case closed.
      return { label: 'Approved · closed', cls: 'bg-compliant-50 text-compliant-700', dot: 'bg-compliant', yourTurn: false };
    }
    case 'rejected':           return { label: `Returned to ${assignee}`, cls: 'bg-risk-50 text-risk-700', dot: 'bg-risk', yourTurn: assigneeTurn };
    case 'escalated':          return { label: 'Escalated to assigner', cls: 'bg-mitigated-50 text-mitigated-700', dot: 'bg-mitigated', yourTurn: false };
    case 'needs-reassignment': return { label: 'Needs reassignment', cls: 'bg-risk-50 text-risk-700', dot: 'bg-risk', yourTurn: false };
    case 'drafting': {
      if (a.persona === 'auditor') return { label: `Lead review · ${assignee}`, cls: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500', yourTurn: assigneeTurn };
      // "Drafting" (the classify/work stage) is the assignee's alone — they see it as
      // their turn; everyone else just sees the case is assigned to that person.
      return assigneeTurn
        ? { label: `Drafting · ${assignee}`, cls: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500', yourTurn: true }
        : { label: `Assigned · ${assignee}`, cls: 'bg-[#F4F2F7] text-ink-600', dot: 'bg-ink-300', yourTurn: false };
    }
    default: {
      const lvl = currentLevel(a);
      const approvers = lvl ? lvl.assigneeIds.map(userName).join(', ') : '';
      // Tag the cycle so reviewers know whether they're approving the plan or the
      // action taken; the auditor phase already reads from the auditor level names.
      const phaseTag = a.actionCycle ? 'Action review' : 'Plan review';
      const base = lvl ? `${lvl.name.split('—')[0].trim()} · ${approvers}` : 'In approval';
      return { label: `${base} · ${phaseTag}`, cls: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500', yourTurn: approverTurn };
    }
  }
}

// ─── Tokens ───
const STATUS_STYLE: Record<GrcExceptionStatus, string> = {
  Open:           'bg-evidence-50 text-evidence-700',
  'Under Review': 'bg-mitigated-50 text-mitigated-700',
  Closed:         'bg-compliant-50 text-compliant-700',
};
// Display label — the data value 'Under Review' renders as 'In-Progress' across the UI.
const STATUS_LABEL: Record<GrcExceptionStatus, string> = {
  Open:           'Open',
  'Under Review': 'In-Progress',
  Closed:         'Closed',
};
const CLASSIFICATION_STYLE: Record<GrcExceptionClassification, string> = {
  Unclassified:                'bg-[#F4F2F7] text-ink-600',
  'Design Deficiency':         'bg-high-50 text-high-700',
  'System Deficiency':         'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
  'Others':                    'bg-mitigated-50 text-mitigated-700',
  'Business as Usual':         'bg-compliant-50 text-compliant-700',
  'False Positive':            'bg-[#EEEEF1] text-ink-600',
};
// Combined Action Review status — folds the auditor decision and the
// implementation outcome into a single column so users see one verdict
// per row rather than two interdependent columns.
type ActionReviewBase = 'Pending' | 'Approved' | 'Rejected';
type CombinedActionReview =
  | 'Pending'
  | 'Approved (Implemented)'
  | 'Approved (Partially Implemented)'
  | 'Rejected (Discrepancy)'
  | 'Approved'   // Business as Usual / False Positive — no action plan, just classification verdict
  | 'Rejected';  // same — auditor disagreed with the BAU/FP classification

const COMBINED_REVIEW_STYLE: Record<CombinedActionReview, string> = {
  'Pending':                          'bg-[#EEEEF1] text-ink-600',
  'Approved (Implemented)':           'bg-compliant-50 text-compliant-700',
  'Approved (Partially Implemented)': 'bg-mitigated-50 text-mitigated-700',
  'Rejected (Discrepancy)':           'bg-risk-50 text-risk-700',
  'Approved':                         'bg-compliant-50 text-compliant-700',
  'Rejected':                         'bg-risk-50 text-risk-700',
};
// Display label — 'Pending' (no auditor decision yet) renders as 'Pending Review'.
const COMBINED_REVIEW_LABEL: Record<CombinedActionReview, string> = {
  'Pending':                          'Pending Review',
  'Approved (Implemented)':           'Approved (Implemented)',
  'Approved (Partially Implemented)': 'Approved (Partially Implemented)',
  'Rejected (Discrepancy)':           'Rejected (Discrepancy)',
  'Approved':                         'Approved',
  'Rejected':                         'Rejected',
};

// Classifications that don't carry an action plan — review verdict is plain Approved/Rejected.
const NO_PLAN_CLASSIFICATIONS = new Set<string>(['Business as Usual', 'False Positive']);

// Legacy mock data sometimes stores 'Implemented' in actionReview — normalise.
function normaliseActionReview(v: string): ActionReviewBase {
  if (v === 'Approved' || v === 'Rejected' || v === 'Pending') return v;
  if (v === 'Implemented') return 'Approved';
  return 'Pending';
}

function combineActionReview(
  actionReview: string,
  actionStatus: GrcActionStatus,
  classification: string,
): CombinedActionReview {
  const norm = normaliseActionReview(actionReview);
  // BAU / False Positive — no action plan; show plain Approved / Rejected / Pending.
  if (NO_PLAN_CLASSIFICATIONS.has(classification)) {
    if (norm === 'Pending') return 'Pending';
    if (norm === 'Rejected') return 'Rejected';
    return 'Approved';
  }
  if (norm === 'Rejected' || actionStatus === 'Discrepancy') return 'Rejected (Discrepancy)';
  if (norm === 'Pending') return 'Pending';
  // Approved: pick the partial / implemented variant.
  if (actionStatus === 'Partially Implemented') return 'Approved (Partially Implemented)';
  return 'Approved (Implemented)';
}

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 text-[11px] font-medium rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

function PrimaryButton({ children, icon, onClick }: { children: React.ReactNode; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-7 px-3 text-[11.5px] font-semibold text-white bg-brand-600 rounded-[7px] hover:bg-brand-500 transition-colors cursor-pointer whitespace-nowrap"
    >
      {icon}
      {children}
    </button>
  );
}

function GhostButton({ children, icon, onClick }: { children: React.ReactNode; icon?: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-7 px-3 text-[11.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[7px] hover:border-brand-200 hover:text-brand-700 transition-colors cursor-pointer whitespace-nowrap"
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Column types ───
// Canonical exception columns use the literal names below. Dynamic data
// columns (sourced from QUERY_TABLES) use a `data:<column-name>` key so the
// rest of the system can detect them by prefix.
export type ColumnKey = string;
type CanonicalColumnKey =
  | 'select'
  | 'id'
  | 'riskCategory'
  | 'status'
  | 'classification'
  | 'actionReview'
  | 'actionableId'
  | 'lastUpdated'
  | 'assignedTo'
  | 'classify'
  | 'action';

type PinSide = 'left' | 'right' | null;
type FilterValue = string[]; // multi-select; single-value search uses a single-item array.

interface ColumnDef {
  key: ColumnKey;
  label: string;
  alwaysVisible?: boolean;     // cannot be hidden
  alwaysPinned?: PinSide;      // fixed pin position (locked, no menu)
  defaultPin?: PinSide;        // initial pin (user can change via menu)
  draggable?: boolean;
  filterable?: boolean;
  filterOptions?: string[];
  filterMode?: 'multi' | 'text';
  accessor?: (ex: GrcException) => string;
  align?: 'left' | 'center';
  minWidth?: number;
}

const ALL_CLASSIFICATIONS: GrcExceptionClassification[] = [
  'Unclassified', 'Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance', 'Others', 'Business as Usual', 'False Positive',
];
const ALL_COMBINED_REVIEW_LABELS: string[] = [
  'Under Review',
  'Approved (Implemented)',
  'Approved (Partially Implemented)',
  'Rejected (Discrepancy)',
  'Approved',
  'Rejected',
];

function combinedReviewAccessor(ex: GrcException): string {
  const actionStatus = GRC_CASE_DETAILS[ex.id]?.actionStatus ?? 'Pending';
  return COMBINED_REVIEW_LABEL[combineActionReview(ex.actionReview, actionStatus, ex.classification)];
}

// Action-state filter options for auditor's Classify / Action columns —
// reflect what the row-action button actually says.
const CLASSIFY_AUDIT_OPTIONS  = ['Review Classification', 'View'] as const;
const ACTION_AUDIT_OPTIONS    = ['Review Action', 'View'] as const;

function classifyAuditAccessor(ex: GrcException): string {
  return ex.classificationReview === 'Pending' && ex.classification !== 'Unclassified'
    ? 'Review Classification'
    : 'View';
}
function actionAuditAccessor(ex: GrcException): string {
  return ex.actionReview === 'Pending' && ex.classification !== 'Unclassified'
    ? 'Review Action'
    : 'View';
}

function buildColumnDefs(
  role: ExceptionRole,
  riskCategories: string[],
  dataColumnNames: string[] = [],
): ColumnDef[] {
  const isAuditor = role === 'auditor';
  // Dynamic columns sourced from the source query's output table — keys are
  // namespaced `data:<name>` so the rest of the table system (filter, render,
  // visibility) can detect them by prefix.
  // Hide any "Status" column coming from the source query — status is no longer
  // surfaced in Exceptions & Cases (the Action Review column conveys the state).
  const dataColDefs: ColumnDef[] = dataColumnNames
    .filter(name => name.trim().toLowerCase() !== 'status')
    .map(name => ({
      key: `data:${name}`,
      label: name,
      draggable: true,
      filterable: false,
      minWidth: 140,
    }));
  const base: ColumnDef[] = [
    { key: 'select',         label: '',               alwaysVisible: true,  draggable: false, alwaysPinned: 'left', minWidth: 40 },
    { key: 'id',             label: 'Exception ID',   alwaysVisible: true,  draggable: true, defaultPin: 'left', filterable: true, filterMode: 'text', accessor: (e) => e.id },
    // Data columns from the source query's output table flow directly after
    // the Exception ID so the auditor sees the case data first.
    ...dataColDefs,
    { key: 'riskCategory',   label: 'Risk Category',  draggable: true, filterable: true, filterMode: 'multi', filterOptions: riskCategories, accessor: (e) => e.riskCategory },
    { key: 'classification', label: 'Classification', draggable: true, filterable: true, filterMode: 'multi', filterOptions: ALL_CLASSIFICATIONS, accessor: (e) => e.classification },
    { key: 'actionReview',   label: 'Action Review',  draggable: true, filterable: true, filterMode: 'multi', filterOptions: ALL_COMBINED_REVIEW_LABELS, accessor: combinedReviewAccessor, minWidth: 220 },
    { key: 'dueDate',        label: 'Due Date',       draggable: true, filterable: false, accessor: (e) => e.dueDate ?? '', minWidth: 170 },
    { key: 'actionableId',   label: 'Actionable ID',  draggable: true, filterable: true, filterMode: 'text', accessor: (e) => e.bulkId ?? '', minWidth: 110 },
    { key: 'lastUpdated',    label: 'Last Updated',   draggable: true, filterable: false, accessor: (e) => e.lastUpdated },
    { key: 'assignedTo',     label: 'Assigned To',    draggable: true, filterable: true,  filterMode: 'text', accessor: (e) => (e.assignees ?? (e.assignedTo ? [e.assignedTo] : [])).map(a => a.name).join(', '), minWidth: 160 },
    // Approval is split into two columns: the flow(s) assigned (RO / Auditor route)
    // and the live status (who's working on it / who the approval is pending with).
    { key: 'approvalRoute',  label: 'Approval Flow',  draggable: true, filterable: false, minWidth: 150 },
    { key: 'approvalStatus', label: 'Approval Status', draggable: true, filterable: false, minWidth: 180 },
  ];
  // Risk Owner gets the Classify CTA; Auditor only sees the Action CTA.
  if (!isAuditor) {
    base.push({ key: 'classify', label: 'Classify', alwaysVisible: true, alwaysPinned: 'right', align: 'center', minWidth: 150 });
  }
  if (isAuditor) {
    base.push({
      key: 'action', label: 'Action', alwaysVisible: true,
      defaultPin: 'right', draggable: true,
      filterable: true, filterMode: 'multi', filterOptions: [...ACTION_AUDIT_OPTIONS],
      accessor: actionAuditAccessor,
      align: 'center', minWidth: 150,
    });
  }
  return base;
}

// ─── Popover ───
function useOutsideClick<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);
  return ref;
}

function Popover({
  open,
  onClose,
  children,
  className = '',
  align = 'start',
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end';
}) {
  const ref = useOutsideClick<HTMLDivElement>(onClose);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute z-20 mt-1 bg-canvas-elevated border border-canvas-border rounded-[10px] shadow-xl ${
        align === 'end' ? 'right-0' : 'left-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Columns toggle ───
function ColumnsToggle({
  columns,
  visibility,
  onVisibilityChange,
  onReset,
}: {
  columns: ColumnDef[];
  visibility: Record<ColumnKey, boolean>;
  onVisibilityChange: (key: ColumnKey, visible: boolean) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[12.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer"
      >
        <Eye size={13} />
        Columns
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="end" className="w-[240px] py-1.5">
        <div className="px-3 py-2 border-b border-canvas-border flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">Show columns</span>
          <button onClick={onReset} className="text-[11px] text-brand-700 hover:text-brand-600 cursor-pointer">Reset</button>
        </div>
        <ul className="py-1 max-h-[320px] overflow-y-auto">
          {columns.filter(c => c.label !== '').map(col => {
            const disabled = !!col.alwaysVisible;
            const checked = visibility[col.key];
            return (
              <li key={col.key}>
                <label
                  className={`flex items-center gap-2 px-3 py-1.5 text-[12.5px] ${
                    disabled ? 'text-ink-400 cursor-not-allowed' : 'text-ink-800 hover:bg-[#FAFAFB] cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onVisibilityChange(col.key, e.target.checked)}
                    className="accent-brand-600 cursor-pointer"
                  />
                  {col.label}
                  {disabled && <span className="ml-auto text-[10px] text-ink-400">locked</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}

// ─── Column header menu (filter + pin) ───
function HeaderMenu({
  col,
  filterValue,
  onFilterChange,
  pin,
  onPin,
}: {
  col: ColumnDef;
  filterValue: FilterValue;
  onFilterChange: (v: FilterValue) => void;
  pin: PinSide;
  onPin: (side: PinSide) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const hasFilter = filterValue.length > 0;

  if (col.alwaysPinned) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center gap-1 ml-auto">
      {col.filterable && (
        <div className="relative">
          <button
            onClick={() => { setFilterOpen(o => !o); setOpen(false); }}
            className={`w-5 h-5 flex items-center justify-center rounded cursor-pointer ${
              hasFilter ? 'text-brand-700 bg-brand-50' : 'text-ink-400 hover:text-brand-700 hover:bg-[#F4F2F7]'
            }`}
            aria-label={`Filter ${col.label}`}
          >
            <Filter size={11} />
          </button>
          <Popover
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            align={pin === 'right' ? 'end' : 'start'}
            className="w-[220px] py-1.5 normal-case tracking-normal"
          >
            {col.filterMode === 'text' ? (
              <div className="p-2">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    value={filterValue[0] ?? ''}
                    onChange={(e) => onFilterChange(e.target.value ? [e.target.value] : [])}
                    placeholder={`Search ${col.label.toLowerCase()}...`}
                    className="w-full h-8 pl-7 pr-2 text-[12px] bg-canvas-elevated border border-canvas-border rounded-[6px] focus:outline-none focus:border-brand-600"
                  />
                </div>
                {hasFilter && (
                  <button
                    onClick={() => onFilterChange([])}
                    className="mt-1.5 w-full text-[11px] text-ink-500 hover:text-brand-700 cursor-pointer text-left"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="px-3 py-1.5 border-b border-canvas-border flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-500">Filter</span>
                  {hasFilter && (
                    <button onClick={() => onFilterChange([])} className="text-[11px] text-brand-700 hover:text-brand-600 cursor-pointer">
                      Clear
                    </button>
                  )}
                </div>
                <ul className="py-1 max-h-[260px] overflow-y-auto">
                  {(col.filterOptions ?? []).map(opt => {
                    const checked = filterValue.includes(opt);
                    return (
                      <li key={opt}>
                        <label className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-ink-800 hover:bg-[#FAFAFB] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              onFilterChange(
                                checked ? filterValue.filter(v => v !== opt) : [...filterValue, opt]
                              );
                            }}
                            className="accent-brand-600 cursor-pointer"
                          />
                          {opt}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Popover>
        </div>
      )}
      <div className="relative">
        <button
          onClick={() => { setOpen(o => !o); setFilterOpen(false); }}
          className="w-5 h-5 flex items-center justify-center rounded text-ink-400 hover:text-brand-700 hover:bg-[#F4F2F7] cursor-pointer"
          aria-label={`More options for ${col.label}`}
        >
          <MoreVertical size={11} />
        </button>
        <Popover open={open} onClose={() => setOpen(false)} align="end" className="w-[180px] py-1 normal-case tracking-normal">
          <button
            onClick={() => { onPin('left'); setOpen(false); }}
            className={`flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#FAFAFB] cursor-pointer ${pin === 'left' ? 'text-brand-700' : 'text-ink-800'}`}
          >
            <Pin size={13} className="-rotate-45" />
            Pin to left
            {pin === 'left' && <Check size={13} className="ml-auto" />}
          </button>
          <button
            onClick={() => { onPin('right'); setOpen(false); }}
            className={`flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#FAFAFB] cursor-pointer ${pin === 'right' ? 'text-brand-700' : 'text-ink-800'}`}
          >
            <Pin size={13} className="rotate-45" />
            Pin to right
            {pin === 'right' && <Check size={13} className="ml-auto" />}
          </button>
          {pin && (
            <button
              onClick={() => { onPin(null); setOpen(false); }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-ink-800 hover:bg-[#FAFAFB] cursor-pointer border-t border-canvas-border"
            >
              <PinOff size={13} />
              Unpin
            </button>
          )}
        </Popover>
      </div>
    </div>
  );
}

// ─── Cell rendering ───
const fmtDate = (iso?: string) => {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function renderCell(
  col: ColumnKey,
  ex: GrcException,
  role: ExceptionRole,
  selected: boolean,
  onToggleSelect: () => void,
  onOpenClassification: () => void,
  onOpenAction: () => void,
  onOpenActionable: (bulkId: string) => void,
  onAssign: () => void,
  dataRow: string[] | undefined,
  dataColumnNames: string[],
  onOpenDetail?: (ex: GrcException) => void,
  onRequestDueDate?: (ex: GrcException) => void,
  onReviewDueDate?: (ex: GrcException) => void,
  onMarkComplete?: () => void,
  assignment?: Assignment,
  currentUserId?: string,
  auditorRouteName?: string,
): React.ReactNode {
  // Overdue is dynamically derived from the action-plan due date set during
  // classification. The legacy `flags: ['Overdue']` array on the default mock
  // still wins so the demo data continues to render the chip.
  const dueDate = ex.dueDate;
  const dueDateOverdue = (() => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  })();
  const isOverdue = dueDateOverdue || ex.flags?.includes('Overdue');
  const isBulk = ex.flags?.includes('Bulk');
  const overdueTooltip = dueDate
    ? `Due date was ${new Date(dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'Past action due date';

  // Unread-comment badge on the Classify & Action CTAs. It appears ONLY for the
  // receiver — the persona who has comments waiting from the other reviewer.
  // The author of a comment never sees a badge for their own post; it surfaces
  // for the recipient and clears once they open the case's review modal.
  const unreadComments = unreadCommentCount(ex.id, role);
  const withCommentBadge = (node: React.ReactNode) => {
    if (unreadComments === 0) return node;
    return (
      <span className="relative inline-flex">
        {node}
        <span
          title={`${unreadComments} new comment${unreadComments === 1 ? '' : 's'} from the other reviewer`}
          className="absolute -top-1.5 -right-1.5 z-10 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums bg-brand-600 text-white ring-2 ring-canvas-elevated"
        >
          {unreadComments}
        </span>
      </span>
    );
  };

  // Route-aware actor context — the acting user's relationship to the assignment
  // decides their CTAs, independent of the role toggle. On a route only the work-
  // assignee classifies (everyone else is read-only here); the current-level
  // approver reviews the management action plan from the Action column.
  const onRoute = !!assignment;
  const isWorkAssignee = !!assignment && !!currentUserId && assignment.assigneeId === currentUserId;
  const routeApprovalTurn =
    !!assignment && assignment.status === 'in-approval' && !!currentUserId && canAct(assignment, currentUserId).ok;

  // Triage ownership (before a route exists): the Auditor assigns a case to a Risk
  // Owner, recorded in `assignees`. Only that owner classifies; other Risk Owners
  // see View until the case is routed on to a specific work-assignee.
  const triageOwnerNames = (ex.assignees ?? (ex.assignedTo ? [ex.assignedTo] : [])).map(a => a.name);
  const isTriaged = triageOwnerNames.length > 0;
  const isTriageOwner = !!currentUserId && triageOwnerNames.includes(userName(currentUserId));
  // Read-only in the Classify column when the case belongs to someone else —
  // either a route work-assignee, or a triage owner you are not.
  const classifyLockedToOther = (onRoute && !isWorkAssignee) || (!onRoute && isTriaged && !isTriageOwner);
  // A route rejection returns the case to the assignee (the person who classified
  // it) to re-classify and resubmit.
  const routeRejectedToMe = !!assignment && assignment.status === 'rejected' && isWorkAssignee;

  // Dynamic data column from the source-query output table.
  if (col.startsWith('data:')) {
    const name = col.slice(5);
    const idx = dataColumnNames.indexOf(name);
    const value = idx >= 0 ? dataRow?.[idx + 1] : undefined;
    return value
      ? <span className="text-ink-800 text-[12.5px]">{value}</span>
      : <span className="text-ink-400 text-[12.5px]">—</span>;
  }

  switch (col) {
    case 'select':
      return (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="accent-brand-600 cursor-pointer"
          aria-label={`Select ${ex.id}`}
        />
      );
    case 'id':
      return (
        <div className="flex flex-col gap-1">
          <span className="text-ink-800 font-medium text-[12.5px] font-mono">
            {ex.id}
          </span>
          {(isOverdue || isBulk || ex.dueDateRevision?.status === 'Pending') && (
            <div className="flex items-center gap-1 flex-wrap">
              {isOverdue && (
                <span
                  title={overdueTooltip}
                  className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-medium bg-risk-50 text-risk-700 rounded-full cursor-help"
                >
                  <AlertTriangle size={9} />
                  Overdue
                </span>
              )}
              {isBulk && (
                ex.bulkId ? (
                  <button
                    type="button"
                    onClick={() => onOpenActionable(ex.bulkId!)}
                    title={`View the ${ex.bulkId} linked group`}
                    className="inline-flex items-center h-5 px-2 text-[10px] font-medium bg-brand-50 text-brand-700 rounded-full hover:bg-brand-100 cursor-pointer transition-colors"
                  >
                    Bulk
                  </button>
                ) : (
                  <span className="inline-flex items-center h-5 px-2 text-[10px] font-medium bg-brand-50 text-brand-700 rounded-full">
                    Bulk
                  </span>
                )
              )}
              {ex.dueDateRevision?.status === 'Pending' && (
                <span
                  title={`Revised due date awaiting auditor approval · Previous ${ex.dueDateRevision.previousDueDate} → Revised ${ex.dueDateRevision.revisedDueDate}`}
                  className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-medium bg-mitigated-50 text-mitigated-700 rounded-full cursor-help"
                >
                  <CalendarClock size={9} />
                  Date change · pending
                </span>
              )}
            </div>
          )}
        </div>
      );
    case 'riskCategory':
      return <span className="text-ink-800 text-[12.5px]">{ex.riskCategory}</span>;
    case 'status':
      return <Pill className={STATUS_STYLE[ex.status]}>{STATUS_LABEL[ex.status]}</Pill>;
    case 'classification':
      return <Pill className={CLASSIFICATION_STYLE[ex.classification]}>{ex.classification}</Pill>;
    case 'actionReview': {
      const actionStatus = GRC_CASE_DETAILS[ex.id]?.actionStatus ?? 'Pending';
      const combined = combineActionReview(ex.actionReview, actionStatus, ex.classification);
      return <Pill className={COMBINED_REVIEW_STYLE[combined]}>{COMBINED_REVIEW_LABEL[combined]}</Pill>;
    }
    case 'actionableId':
      // The Actionable ID is generated when the case is classified as actionable.
      // (The linked bulk group is reachable via the "Bulk" chip on the ID column.)
      return ex.actionableId ? (
        <span
          className="inline-flex items-center h-6 px-2.5 text-[11.5px] font-mono font-medium bg-brand-50 text-brand-700 rounded-full"
          title={`Actionable ID ${ex.actionableId}`}
        >
          {ex.actionableId}
        </span>
      ) : (
        <span className="text-ink-400 text-[12.5px]">—</span>
      );
    case 'lastUpdated':
      return <span className="text-ink-500 text-[11.5px] tabular-nums whitespace-nowrap">{ex.lastUpdated}</span>;
    case 'approvalRoute': {
      // Which approval flow(s) the case is on — Risk Owner route (lifecycle) and/or
      // Auditor route (separate; runs in the Auditor phase). Kept segregated.
      const roRouteName = assignment?.workflowName;
      if (!roRouteName && !auditorRouteName) {
        return (
          <span title="This case has not been assigned to an approval flow." className="inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 text-[11px] font-medium rounded-full bg-[#F4F2F7] text-ink-500 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-300" /> No flow
          </span>
        );
      }
      return (
        <div className="flex flex-col items-start gap-1">
          {roRouteName && (
            <span title={`Risk Owner flow · ${roRouteName}`} className="inline-flex items-center gap-1 h-[18px] pl-1.5 pr-2 text-[9px] font-semibold uppercase tracking-[0.04em] rounded-full bg-brand-50 text-brand-700">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> RO route
            </span>
          )}
          {auditorRouteName && (
            <span title={`Auditor flow · ${auditorRouteName} (runs in the Auditor phase)`} className="inline-flex items-center gap-1 h-[18px] pl-1.5 pr-2 text-[9px] font-semibold uppercase tracking-[0.04em] rounded-full bg-evidence-50 text-evidence-700">
              <span className="w-1.5 h-1.5 rounded-full bg-evidence" /> Auditor route
            </span>
          )}
        </div>
      );
    }
    case 'approvalStatus': {
      // Who's currently working on it / who the approval is pending with. Never an
      // action surface — the work is done from the Classify / Action columns.
      const meta = approvalCellMeta(assignment, currentUserId ?? '');
      if (!meta) return <span className="text-ink-400 text-[12px]">—</span>;
      return (
        <span
          title={`${meta.label}${meta.yourTurn ? ' · your turn — act from the Classify / Action column' : ''}`}
          className="inline-flex items-center gap-1.5 max-w-full min-w-0"
        >
          <span className={`inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 text-[11px] font-semibold rounded-full max-w-[180px] ${meta.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
            <span className="truncate">{meta.label}</span>
          </span>
          {meta.yourTurn && <span className="inline-flex items-center h-5 px-1.5 text-[9px] font-bold uppercase tracking-wide bg-brand-600 text-white rounded-full shrink-0 shadow-[0_1px_2px_rgba(106,18,205,0.3)]">You</span>}
        </span>
      );
    }
    case 'assignedTo': {
      const allAssignees = ex.assignees ?? (ex.assignedTo ? [ex.assignedTo] : []);
      if (allAssignees.length > 1) {
        const MAX_VISIBLE = 4;
        const visible = allAssignees.slice(0, MAX_VISIBLE);
        const overflow = allAssignees.length - visible.length;
        const overflowNames = allAssignees.slice(MAX_VISIBLE).map(a => a.name).join(', ');
        return (
          <button
            type="button"
            onClick={onAssign}
            title="Change assignees"
            className="group/asg inline-flex items-center min-w-0 rounded-[8px] px-1 -mx-1 py-0.5 hover:bg-brand-50/60 cursor-pointer transition-colors"
          >
            {visible.map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                className={`group/av relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold border-2 border-canvas-elevated shrink-0 hover:z-10 ${i === 0 ? '' : '-ml-2'}`}
                aria-label={a.name}
              >
                {a.initials}
                <span
                  className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/av:opacity-100 transition-opacity z-50"
                  role="tooltip"
                >
                  {a.name}
                </span>
              </span>
            ))}
            {overflow > 0 && (
              <span
                className="group/av relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold border-2 border-canvas-elevated shrink-0 hover:z-10 -ml-2"
                aria-label={`${overflow} more: ${overflowNames}`}
              >
                +{overflow}
                <span
                  className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/av:opacity-100 transition-opacity z-50"
                  role="tooltip"
                >
                  {overflowNames}
                </span>
              </span>
            )}
            <span className="ml-1.5 opacity-0 group-hover/asg:opacity-100 transition-opacity text-brand-600 shrink-0"><Pencil size={12} /></span>
          </button>
        );
      }
      return allAssignees.length === 1 ? (
        <button
          type="button"
          onClick={onAssign}
          title="Change assignee"
          className="group/asg inline-flex items-center gap-2 min-w-0 rounded-[8px] px-1.5 -mx-1.5 py-0.5 hover:bg-brand-50/60 cursor-pointer transition-colors"
        >
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold shrink-0">
            {allAssignees[0].initials}
          </span>
          <span className="text-ink-700 text-[12.5px] truncate">{allAssignees[0].name}</span>
          <span className="opacity-0 group-hover/asg:opacity-100 transition-opacity text-brand-600 shrink-0"><Pencil size={11} /></span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onAssign}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11.5px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 hover:border-brand-200 rounded-[6px] transition-colors cursor-pointer"
          title={`Assign ${ex.id} to a user`}
        >
          <UserPlus size={12} />
          Assign
        </button>
      );
    }
    case 'classify': {
      let cta: React.ReactNode;
      if (classifyLockedToOther) {
        // The case belongs to another Risk Owner — the triage owner the Auditor
        // assigned, or the route work-assignee. The current-level approver gets a
        // Review CTA that opens the full action-review modal (plan + action taken +
        // decision + ATR); everyone else is read-only (View).
        cta = routeApprovalTurn
          ? <PrimaryButton icon={<ClipboardCheck size={12} />} onClick={onOpenAction}>Review</PrimaryButton>
          : <GhostButton icon={<Eye size={12} />} onClick={onOpenClassification}>View</GhostButton>;
      } else if (role === 'risk-owner') {
        if (routeRejectedToMe || ex.actionReview === 'Rejected') {
          // Rejected in the route → reopened for the classifier. If the ACTION TAKEN
          // was rejected (a completion exists), the plan stays locked and only the
          // action is revised (Revise Action). Otherwise the plan was rejected →
          // re-classify with the rejected plan locked.
          const actionRejected = ex.actionReview === 'Rejected' && !!GRC_CASE_DETAILS[ex.id]?.completion;
          cta = actionRejected
            ? <PrimaryButton icon={<RotateCcw size={12} />} onClick={() => onMarkComplete?.()}>Revise Action</PrimaryButton>
            : <PrimaryButton icon={<RotateCcw size={12} />} onClick={onOpenClassification}>Re-Classify</PrimaryButton>;
        } else if (ex.classification === 'Unclassified') {
          cta = <PrimaryButton icon={<Tag size={12} />} onClick={onOpenClassification}>Classify</PrimaryButton>;
        } else if (ex.actionPhase === 'in-progress') {
          // Plan accepted → Risk Owner implements, then marks the action complete (with evidence).
          cta = <PrimaryButton icon={<CheckCircle2 size={12} />} onClick={() => onMarkComplete?.()}>Mark Complete</PrimaryButton>;
        } else {
          cta = <GhostButton icon={<Eye size={12} />} onClick={onOpenClassification}>View</GhostButton>;
        }
      } else {
        cta = ex.classificationReview === 'Pending' && ex.classification !== 'Unclassified'
          ? <PrimaryButton icon={<Tag size={12} />} onClick={onOpenClassification}>Review Classification</PrimaryButton>
          : <GhostButton icon={<Eye size={12} />} onClick={onOpenClassification}>View</GhostButton>;
      }
      return withCommentBadge(cta);
    }
    case 'action': {
      const phase = ex.actionPhase;
      const actionableClass = ex.classification === 'Design Deficiency' || ex.classification === 'System Deficiency' || ex.classification === 'Procedural Non-Compliance';
      let cta: React.ReactNode;
      // On a route, the current-level approver reviews from here: the management
      // action plan (actionable cases), the classification (non-actionable), or
      // the completed action at the completion stage. Others are read-only.
      if (onRoute) {
        if (routeApprovalTurn) {
          cta = phase === 'completion-review'
            ? <PrimaryButton icon={<ArrowLeft size={12} className="rotate-180" />} onClick={onOpenAction}>Review Action</PrimaryButton>
            : actionableClass
              ? <PrimaryButton icon={<ClipboardCheck size={12} />} onClick={onOpenAction}>Review Plan</PrimaryButton>
              : <PrimaryButton icon={<ClipboardCheck size={12} />} onClick={onOpenAction}>Review</PrimaryButton>;
        } else {
          cta = <GhostButton icon={<Eye size={12} />} onClick={onOpenAction}>View</GhostButton>;
        }
      } else if (role === 'risk-owner') {
        cta = <GhostButton icon={<Eye size={12} />} onClick={onOpenAction}>View</GhostButton>;
      } else {
        // Auditor: review the plan, then the completion; single review for non-actionable.
        const planStage = phase === 'plan-review' || (actionableClass && !phase && ex.actionReview === 'Pending' && ex.classification !== 'Unclassified');
        if (planStage) {
          cta = <PrimaryButton icon={<ClipboardCheck size={12} />} onClick={onOpenAction}>Review Plan</PrimaryButton>;
        } else if (phase === 'completion-review') {
          cta = <PrimaryButton icon={<ArrowLeft size={12} className="rotate-180" />} onClick={onOpenAction}>Review Action</PrimaryButton>;
        } else if (!actionableClass && ex.actionReview === 'Pending' && ex.classification !== 'Unclassified') {
          cta = <PrimaryButton icon={<ArrowLeft size={12} className="rotate-180" />} onClick={onOpenAction}>Review</PrimaryButton>;
        } else {
          cta = <GhostButton icon={<Eye size={12} />} onClick={onOpenAction}>View</GhostButton>;
        }
      }
      return withCommentBadge(cta);
    }
    case 'dueDate': {
      const due = ex.dueDate;
      const rev = ex.dueDateRevision;
      if (!due && !rev) return <span className="text-ink-400 text-[12.5px]">—</span>;
      const revPending = rev?.status === 'Pending';
      const isActionable =
        ex.classification === 'Design Deficiency' ||
        ex.classification === 'System Deficiency' ||
        ex.classification === 'Procedural Non-Compliance';
      return (
        <div className="flex flex-col items-start gap-1.5">
          <span className={`inline-flex items-center gap-1.5 text-[12.5px] tabular-nums ${isOverdue ? 'text-risk-700 font-medium' : 'text-ink-800'}`}>
            <Calendar size={12} className={isOverdue ? 'text-risk-700' : 'text-ink-400'} />
            {fmtDate(due)}
          </span>
          {revPending ? (
            role === 'auditor' ? (
              onReviewDueDate && (
                <button
                  type="button"
                  onClick={() => onReviewDueDate(ex)}
                  title={`Review revised due date · ${rev?.previousDueDate} → ${rev?.revisedDueDate}`}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-white bg-mitigated hover:bg-mitigated-700 rounded-[6px] transition-colors cursor-pointer"
                >
                  <CalendarClock size={11} />
                  Review date
                </button>
              )
            ) : (
              <span
                title={`Awaiting auditor approval · ${fmtDate(rev?.previousDueDate)} → ${fmtDate(rev?.revisedDueDate)}`}
                className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium bg-mitigated-50 text-mitigated-700 rounded-[6px] cursor-help"
              >
                <CalendarClock size={11} />
                Change requested
              </span>
            )
          ) : role === 'risk-owner' && isActionable && due && onRequestDueDate ? (
            <button
              type="button"
              onClick={() => onRequestDueDate(ex)}
              title="Request a revised due date (auditor-approved)"
              className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-100 hover:border-brand-200 rounded-[6px] transition-colors cursor-pointer"
            >
              <CalendarClock size={11} />
              Request change
            </button>
          ) : rev?.status === 'Approved' ? (
            <span className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium bg-compliant-50 text-compliant-700 rounded-[6px]">
              <CalendarClock size={11} />
              Revised
            </span>
          ) : rev?.status === 'Rejected' ? (
            <span className="inline-flex items-center gap-1 h-6 px-2 text-[11px] font-medium bg-risk-50 text-risk-700 rounded-[6px]">
              Change rejected
            </span>
          ) : null}
        </div>
      );
    }
  }
}

// ─── Main table ───
export interface ExceptionsTableProps {
  exceptions: GrcException[];
  role: ExceptionRole;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
  onOpenClassification: (ex: GrcException) => void;
  onOpenAction: (ex: GrcException) => void;
  /** Risk-owner: mark an accepted action plan complete (with evidence). */
  onMarkComplete?: (ex: GrcException) => void;
  /** Risk-owner: request a revised action-plan due date (auditor-approved). */
  onRequestDueDate?: (ex: GrcException) => void;
  /** Auditor: review a pending revised-due-date request. */
  onReviewDueDate?: (ex: GrcException) => void;
  onOpenActionable?: (bulkId: string) => void;
  onAssign?: (ex: GrcException) => void;
  headerLeading?: React.ReactNode;
  headerExtras?: React.ReactNode;
  sampleSheets?: { id: string; name: string }[];
  activeSheetId?: string;
  onChangeSheet?: (id: string) => void;
  /** When true, skip the outer border + rounded chrome so the table can be
   *  composed inside a parent card (e.g. merged with a source-query header). */
  bare?: boolean;
  /** Source query's output table — when present, its non-first columns are
   *  merged into the exceptions table right after the Exception ID. Rows
   *  join to exceptions on the first column (treated as a Case ID). */
  extraColumns?: { columns: string[]; rows: string[][] };
  /** Fired when a row's Exception ID is clicked — opens the detail drawer. */
  onOpenDetail?: (ex: GrcException) => void;
}

type VisibilityMap = Record<ColumnKey, boolean>;
type PinsMap = Record<ColumnKey, PinSide>;
type FiltersMap = Record<ColumnKey, FilterValue>;

export default function ExceptionsTable({
  exceptions,
  role,
  selected,
  onToggleSelect,
  onToggleAll,
  onOpenClassification,
  onOpenAction,
  onMarkComplete,
  onRequestDueDate,
  onReviewDueDate,
  onOpenActionable,
  onAssign,
  headerLeading,
  headerExtras,
  sampleSheets = [],
  activeSheetId = 'all',
  bare = false,
  extraColumns,
  onOpenDetail,
  onChangeSheet,
}: ExceptionsTableProps) {
  const riskCategories = useMemo(
    () => Array.from(new Set(exceptions.map(e => e.riskCategory))).sort(),
    [exceptions],
  );
  // Data-column names from the source query (skip the first column — it's
  // the join key matched against ex.id).
  const dataColumnNames = useMemo(
    () => (extraColumns?.columns ?? []).slice(1),
    [extraColumns],
  );
  // Lookup map: ex.id → matched data row (or undefined).
  const dataRowByCaseId = useMemo(() => {
    const map = new Map<string, string[]>();
    extraColumns?.rows.forEach(row => { if (row[0]) map.set(row[0], row); });
    return map;
  }, [extraColumns]);
  const defs = useMemo(
    () => buildColumnDefs(role, riskCategories, dataColumnNames),
    [role, riskCategories, dataColumnNames],
  );
  const defByKey = useMemo(() => Object.fromEntries(defs.map(d => [d.key, d])) as Record<ColumnKey, ColumnDef>, [defs]);

  const defaultOrder = useMemo(() => defs.map(d => d.key), [defs]);
  const defaultVisibility = useMemo(() => {
    const v = {} as VisibilityMap;
    defs.forEach(d => { v[d.key] = true; });
    return v;
  }, [defs]);
  const defaultPins = useMemo(() => {
    const p = {} as PinsMap;
    defs.forEach(d => { p[d.key] = d.alwaysPinned ?? d.defaultPin ?? null; });
    return p;
  }, [defs]);
  const emptyFilters = useMemo(() => {
    const f = {} as FiltersMap;
    defs.forEach(d => { f[d.key] = []; });
    return f;
  }, [defs]);

  const [order, setOrder] = useState<ColumnKey[]>(defaultOrder);
  const [visibility, setVisibility] = useState<VisibilityMap>(defaultVisibility);
  const [pins, setPins] = useState<PinsMap>(defaultPins);
  const [filters, setFilters] = useState<FiltersMap>(emptyFilters);

  // Keep order/visibility/pins consistent when role OR data columns change.
  const dataColumnsKey = dataColumnNames.join('|');
  useEffect(() => {
    setOrder(prev => {
      const known = new Set(prev);
      const missing = defaultOrder.filter(k => !known.has(k));
      const trimmed = prev.filter(k => defaultOrder.includes(k));
      return [...trimmed, ...missing];
    });
    setVisibility(prev => {
      const next = { ...defaultVisibility };
      defaultOrder.forEach(k => { if (prev[k] !== undefined) next[k] = prev[k]; });
      return next;
    });
    setPins(prev => {
      const next = { ...defaultPins };
      defaultOrder.forEach(k => {
        const def = defByKey[k];
        // Always-locked wins → user's last choice → column's default → unpinned.
        next[k] = def.alwaysPinned ?? prev[k] ?? def.defaultPin ?? null;
      });
      return next;
    });
    setFilters(prev => {
      const next = { ...emptyFilters };
      defaultOrder.forEach(k => { if (prev[k] !== undefined) next[k] = prev[k]; });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, dataColumnsKey]);

  const resetVisibility = useCallback(() => setVisibility(defaultVisibility), [defaultVisibility]);

  // Drag-and-drop ordering (only among unpinned, non-locked columns).
  const [draggingKey, setDraggingKey] = useState<ColumnKey | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<ColumnKey | null>(null);

  const handleDragStart = (key: ColumnKey) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
    setDraggingKey(key);
  };
  const handleDragOver = (key: ColumnKey) => (e: React.DragEvent) => {
    if (!draggingKey || draggingKey === key) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetKey(key);
  };
  const handleDrop = (key: ColumnKey) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingKey || draggingKey === key) {
      setDraggingKey(null); setDropTargetKey(null); return;
    }
    setOrder(prev => {
      const next = prev.filter(k => k !== draggingKey);
      const targetIdx = next.indexOf(key);
      if (targetIdx === -1) return prev;
      next.splice(targetIdx, 0, draggingKey);
      return next;
    });
    setDraggingKey(null); setDropTargetKey(null);
  };
  const handleDragEnd = () => { setDraggingKey(null); setDropTargetKey(null); };

  // Filter rows against active filters.
  const filteredExceptions = useMemo(() => {
    return exceptions.filter(ex => {
      for (const k of defaultOrder) {
        const def = defByKey[k];
        if (!def.filterable) continue;
        // Mid-role-switch render: filters may not yet include keys newly
        // introduced by the role change — guard against undefined.
        const value = filters[k];
        if (!value || !value.length) continue;
        const actual = def.accessor?.(ex) ?? '';
        if (def.filterMode === 'text') {
          if (!actual.toLowerCase().includes(String(value[0]).toLowerCase())) return false;
        } else {
          if (!value.includes(actual)) return false;
        }
      }
      return true;
    });
  }, [exceptions, filters, defByKey, defaultOrder]);

  const allIds = useMemo(() => filteredExceptions.map(e => e.id), [filteredExceptions]);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSizeMenuOpen, setPageSizeMenuOpen] = useState(false);

  const { addToast } = useToast();
  // Approval-route assignment per case (newest, non-recalled) for the Approval column.
  const { assignments, currentUserId, auditorRoutes } = useWorkflow();
  // A case can carry two assignments — the Risk Owner's live lifecycle one and an
  // auditor route the Auditor marked separately (a dormant route-holder until the
  // handoff copies its levels in). The row shows ONE coherent status via the shared
  // primaryAssignment selector (most-advanced in the chain, Risk Owner winning ties).
  const assignmentByEx = useMemo(() => {
    const m = new Map<string, Assignment>();
    assignments.forEach(a => {
      if (m.has(a.exceptionId)) return;
      const primary = primaryAssignment(assignments, a.exceptionId);
      if (primary) m.set(a.exceptionId, primary);
    });
    return m;
  }, [assignments]);

  // Filter Set + Export CSV menus
  const [filterSetOpen, setFilterSetOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const filterSetRef = useOutsideClick<HTMLDivElement>(() => setFilterSetOpen(false));
  const exportMenuRef = useOutsideClick<HTMLDivElement>(() => setExportMenuOpen(false));

  // Saved Filter Sets (max 10)
  type SavedFilterSet = { id: string; name: string; filters: FiltersMap };
  const [savedFilterSets, setSavedFilterSets] = useState<SavedFilterSet[]>([]);
  const [activeFilterSetId, setActiveFilterSetId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateName, setGenerateName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedSetIds, setExpandedSetIds] = useState<Set<string>>(new Set());
  const totalPages = Math.max(1, Math.ceil(filteredExceptions.length / pageSize));

  // Snap currentPage when filters change or page size shrinks below current page.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  useEffect(() => { setCurrentPage(1); }, [filters, pageSize]);

  const pagedExceptions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExceptions.slice(start, start + pageSize);
  }, [filteredExceptions, currentPage, pageSize]);
  const pagedIds = useMemo(() => pagedExceptions.map(e => e.id), [pagedExceptions]);

  const pageSelected = pagedIds.length > 0 && pagedIds.every(id => selected.has(id));
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = pagedIds.some(id => selected.has(id));
  const showAllOnPageBanner = pageSelected && !allSelected && totalPages > 1;

  // Select-mode dropdown in the header checkbox (All Cases / This Page).
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);

  const handleHeaderCheckbox = () => {
    // Parent's onToggleAll: if every passed id is already selected → clears them;
    // otherwise selects them all. Passing pagedIds gives the right behaviour for
    // both "nothing selected" and "indeterminate" states.
    onToggleAll(pagedIds);
  };

  const selectAllCases = () => {
    // Add every filtered id that isn't already selected.
    const missing = allIds.filter(id => !selected.has(id));
    if (missing.length) onToggleAll(missing);
    setSelectMenuOpen(false);
  };
  const selectThisPage = () => {
    const missing = pagedIds.filter(id => !selected.has(id));
    if (missing.length) onToggleAll(missing);
    setSelectMenuOpen(false);
  };
  const selectMenuRef = useOutsideClick<HTMLDivElement>(() => setSelectMenuOpen(false));
  const pageSizeMenuRef = useOutsideClick<HTMLDivElement>(() => setPageSizeMenuOpen(false));

  // Compose render order: left-pinned (in order) → unpinned (in order) → right-pinned (in order).
  const renderOrder = useMemo(() => {
    const visible = order.filter(k => visibility[k]);
    const left = visible.filter(k => pins[k] === 'left');
    const right = visible.filter(k => pins[k] === 'right');
    const middle = visible.filter(k => !pins[k]);
    return [...left, ...middle, ...right];
  }, [order, visibility, pins]);

  // Cumulative left/right offsets so multiple pinned columns don't overlap.
  // Each pinned column sticks at the sum of widths of the pinned columns
  // closer to the same edge.
  const pinOffsets = useMemo(() => {
    const off: Partial<Record<ColumnKey, number>> = {};
    const fallback = 120;
    let leftSoFar = 0;
    for (const k of renderOrder) {
      // During a role swap there's a brief render where stale state still
      // references a removed column key — fall back gracefully.
      const def = defByKey[k];
      if (!def) continue;
      if (pins[k] === 'left') {
        off[k] = leftSoFar;
        leftSoFar += def.minWidth ?? fallback;
      }
    }
    let rightSoFar = 0;
    for (let i = renderOrder.length - 1; i >= 0; i--) {
      const k = renderOrder[i];
      const def = defByKey[k];
      if (!def) continue;
      if (pins[k] === 'right') {
        off[k] = rightSoFar;
        rightSoFar += def.minWidth ?? fallback;
      }
    }
    return off;
  }, [renderOrder, pins, defByKey]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).reduce((sum, v) => sum + (v.length > 0 ? 1 : 0), 0),
    [filters],
  );

  const activeFilterEntries = useMemo(
    () => (Object.entries(filters) as [ColumnKey, FilterValue][])
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => ({ key: k, label: defByKey[k]?.label || k, values: v.join(', ') })),
    [filters, defByKey],
  );

  const openGenerateModal = () => {
    setGenerateName('');
    setGenerateModalOpen(true);
    setFilterSetOpen(false);
  };
  const closeGenerateModal = () => setGenerateModalOpen(false);
  const saveFilterSet = () => {
    const name = generateName.trim();
    if (!name || activeFilterCount === 0 || savedFilterSets.length >= 10) return;
    const id = `fs-${Date.now()}`;
    setSavedFilterSets(prev => [...prev, { id, name, filters: { ...filters } }]);
    setActiveFilterSetId(id);
    closeGenerateModal();
    addToast({ type: 'success', message: 'Filter set has been created' });
  };
  const applyFilterSet = (set: SavedFilterSet) => {
    setFilters(set.filters);
    setActiveFilterSetId(set.id);
    setFilterSetOpen(false);
  };
  const deleteFilterSet = (id: string) => {
    setSavedFilterSets(prev => prev.filter(s => s.id !== id));
    if (activeFilterSetId === id) setActiveFilterSetId(null);
    if (renamingId === id) setRenamingId(null);
  };
  const startRename = (set: SavedFilterSet) => {
    setRenamingId(set.id);
    setRenameValue(set.name);
  };
  const commitRename = () => {
    const name = renameValue.trim();
    if (!name || !renamingId) { setRenamingId(null); return; }
    setSavedFilterSets(prev => prev.map(s => s.id === renamingId ? { ...s, name } : s));
    setRenamingId(null);
  };
  const cancelRename = () => setRenamingId(null);

  return (
    <div className="flex-1 flex flex-col min-h-0">
    <div className={`${bare ? '' : 'border border-canvas-border rounded-[12px]'} overflow-hidden flex-1 flex flex-col min-h-0`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-canvas-border gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Filter Set dropdown — replaces the previous "N Exceptions" label */}
          <div className="relative" ref={filterSetRef}>
            <button
              type="button"
              onClick={() => setFilterSetOpen(o => !o)}
              className={`inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 text-[12.5px] font-medium rounded-[8px] border cursor-pointer transition-colors ${
                filterSetOpen
                  ? 'bg-brand-50 border-brand-200 text-brand-700'
                  : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200'
              }`}
              aria-haspopup="menu"
              aria-expanded={filterSetOpen}
            >
              <LayoutGrid size={13} />
              Filter Set
              {savedFilterSets.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10.5px] font-semibold text-white bg-brand-700 rounded-full tabular-nums">
                  {savedFilterSets.length}
                </span>
              )}
              {filterSetOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {filterSetOpen && (
              <div className="absolute z-30 left-0 top-9 w-[300px] bg-canvas-elevated border border-canvas-border rounded-[10px] shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-canvas-border">
                  <span className="text-[12.5px] font-medium text-ink-700">Saved Sets</span>
                  <span className="text-[11.5px] text-ink-500 tabular-nums">{savedFilterSets.length}/10</span>
                </div>
                {savedFilterSets.length === 0 ? (
                  <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                    <AlertCircle size={20} className="text-ink-400 mb-2.5" />
                    <span className="text-[12.5px] text-ink-500">No filter sets saved yet</span>
                  </div>
                ) : (
                  <ul className="max-h-[320px] overflow-y-auto py-1">
                    {savedFilterSets.map(set => {
                      const isActive = activeFilterSetId === set.id;
                      const isRenaming = renamingId === set.id;
                      const isExpanded = expandedSetIds.has(set.id);
                      const setEntries = (Object.entries(set.filters) as [ColumnKey, FilterValue][])
                        .filter(([, v]) => v.length > 0)
                        .map(([k, v]) => ({ key: k, label: defByKey[k]?.label || k, values: v.join(', ') }));
                      const toggleExpand = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setExpandedSetIds(prev => {
                          const next = new Set(prev);
                          if (next.has(set.id)) next.delete(set.id);
                          else next.add(set.id);
                          return next;
                        });
                      };
                      return (
                        <li key={set.id}>
                          <div
                            className="group flex items-center gap-1.5 px-2 py-2 text-[12.5px] cursor-pointer hover:bg-[#FAFAFB]"
                            onClick={() => { if (!isRenaming) applyFilterSet(set); }}
                          >
                            {isRenaming ? (
                              <>
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={e => setRenameValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                                    else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  className="flex-1 min-w-0 px-2 py-1 text-[12.5px] rounded border border-brand-200 focus:outline-none focus:border-brand-400 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); commitRename(); }}
                                  className="text-brand-700 hover:text-brand-800 cursor-pointer"
                                  aria-label="Confirm rename"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); cancelRename(); }}
                                  className="text-ink-500 hover:text-ink-700 cursor-pointer"
                                  aria-label="Cancel rename"
                                >
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={toggleExpand}
                                  className="p-1 text-ink-500 hover:text-brand-700 cursor-pointer shrink-0"
                                  aria-label={isExpanded ? `Collapse ${set.name}` : `Expand ${set.name}`}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                                <span className={`flex-1 min-w-0 truncate ${isActive ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>{set.name}</span>
                                <span className="text-[11px] text-ink-500 tabular-nums shrink-0">{setEntries.length}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); startRename(set); }}
                                    className="p-1 text-ink-500 hover:text-brand-700 cursor-pointer"
                                    aria-label={`Rename ${set.name}`}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); deleteFilterSet(set.id); }}
                                    className="p-1 text-ink-500 hover:text-risk-700 cursor-pointer"
                                    aria-label={`Delete ${set.name}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          {isExpanded && !isRenaming && setEntries.length > 0 && (
                            <ul className="pl-9 pr-3 pb-2 space-y-1">
                              {setEntries.map(entry => (
                                <li
                                  key={entry.key}
                                  title={`${entry.label}: ${entry.values}`}
                                  className="text-[11.5px] text-ink-500 truncate"
                                >
                                  <span className="text-ink-700 font-medium">{entry.label}:</span>{' '}
                                  <span>{entry.values}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={openGenerateModal}
                  disabled={activeFilterCount === 0 || savedFilterSets.length >= 10}
                  title={
                    savedFilterSets.length >= 10
                      ? 'Maximum of 10 saved sets reached'
                      : activeFilterCount === 0
                        ? 'Apply at least one filter to save a set'
                        : undefined
                  }
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium text-ink-500 border-t border-canvas-border hover:bg-[#FAFAFB] hover:text-brand-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ink-500 disabled:hover:bg-transparent"
                >
                  <Plus size={13} />
                  Generate Filter Set
                </button>
              </div>
            )}
          </div>
          {activeFilterEntries.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeFilterEntries.map(entry => (
                <button
                  key={entry.key}
                  onClick={() => setFilters(prev => ({ ...prev, [entry.key]: [] }))}
                  title={`${entry.label}: ${entry.values}`}
                  className="inline-flex items-center gap-1.5 h-6 px-2 text-[11px] font-medium bg-brand-50 text-brand-700 rounded-full hover:bg-brand-100 cursor-pointer max-w-[260px]"
                >
                  <Filter size={10} className="shrink-0" />
                  <span className="truncate">{entry.values}</span>
                  <X size={10} className="shrink-0" />
                </button>
              ))}
              {activeFilterEntries.length > 1 && (
                <button
                  onClick={() => setFilters(emptyFilters)}
                  className="inline-flex items-center h-6 px-2 text-[11px] font-medium text-ink-500 hover:text-brand-700 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerLeading}
          <ColumnsToggle
            columns={defs}
            visibility={visibility}
            onVisibilityChange={(k, v) => setVisibility(prev => ({ ...prev, [k]: v }))}
            onReset={resetVisibility}
          />
          {headerExtras}
        </div>
      </div>

      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-canvas-elevated border-b border-canvas-border text-left text-ink-500 uppercase tracking-wider">
              {renderOrder.map((key) => {
                const def = defByKey[key];
                if (!def) return null;
                const pinned = pins[key];
                const isDragTarget = dropTargetKey === key;
                const isDragging = draggingKey === key;
                const offset = pinOffsets[key] ?? 0;
                const stickyStyle: React.CSSProperties = pinned
                  ? {
                      position: 'sticky',
                      [pinned === 'left' ? 'left' : 'right']: offset,
                      zIndex: 5,
                      background: '#FFFFFF',
                      boxShadow: pinned === 'left' ? '1px 0 0 var(--color-canvas-border)' : '-1px 0 0 var(--color-canvas-border)',
                    }
                  : {};
                // Lock pinned columns to their declared width so cumulative offsets stay accurate.
                const widthStyle: React.CSSProperties = pinned && def.minWidth
                  ? { width: def.minWidth, minWidth: def.minWidth, maxWidth: def.minWidth }
                  : { minWidth: def.minWidth };
                return (
                  <th
                    key={key}
                    style={{ ...stickyStyle, ...widthStyle }}
                    draggable={def.draggable && !pinned}
                    onDragStart={def.draggable && !pinned ? handleDragStart(key) : undefined}
                    onDragOver={def.draggable && !pinned ? handleDragOver(key) : undefined}
                    onDrop={def.draggable && !pinned ? handleDrop(key) : undefined}
                    onDragEnd={handleDragEnd}
                    className={`px-3 py-3 font-medium text-[10.5px] align-middle transition-colors ${
                      def.align === 'center' ? 'text-center' : ''
                    } ${isDragTarget ? 'bg-brand-50' : ''} ${isDragging ? 'opacity-50' : ''}`}
                  >
                    {key === 'select' ? (
                      <div className="relative inline-flex items-center gap-1" ref={selectMenuRef}>
                        <input
                          type="checkbox"
                          checked={pageSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = !pageSelected && someSelected;
                          }}
                          onChange={handleHeaderCheckbox}
                          className="accent-brand-600 cursor-pointer"
                          aria-label="Select rows on this page"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectMenuOpen(o => !o)}
                          className="w-4 h-4 flex items-center justify-center rounded text-ink-400 hover:text-brand-700 hover:bg-[#F4F2F7] cursor-pointer"
                          aria-label="Selection menu"
                        >
                          <ChevronDown size={12} />
                        </button>
                        {selectMenuOpen && (
                          <div className="absolute z-30 left-0 top-6 w-[140px] bg-canvas-elevated border border-canvas-border rounded-[10px] shadow-xl py-1 normal-case tracking-normal">
                            <button
                              type="button"
                              onClick={selectAllCases}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-ink-800 hover:bg-[#FAFAFB] cursor-pointer"
                            >
                              All Cases
                              {allSelected && <Check size={13} className="ml-auto text-brand-700" />}
                            </button>
                            <button
                              type="button"
                              onClick={selectThisPage}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 text-[12.5px] text-ink-800 hover:bg-[#FAFAFB] cursor-pointer"
                            >
                              This Page
                              {pageSelected && !allSelected && <Check size={13} className="ml-auto text-brand-700" />}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`flex items-center gap-1 ${def.align === 'center' ? 'justify-center' : ''}`}>
                        {def.draggable && !pinned && (
                          <GripVertical size={11} className="text-ink-300 shrink-0 cursor-grab active:cursor-grabbing" />
                        )}
                        <span className="whitespace-nowrap">{def.label}</span>
                        {pinned && (
                          <Pin size={9} className={`text-brand-600 shrink-0 ${pinned === 'left' ? '-rotate-45' : 'rotate-45'}`} />
                        )}
                        {def.filterable || !def.alwaysPinned ? (
                          <HeaderMenu
                            col={def}
                            filterValue={filters[key] ?? []}
                            onFilterChange={(v) => setFilters(prev => ({ ...prev, [key]: v }))}
                            pin={pinned}
                            onPin={(side) => setPins(prev => ({ ...prev, [key]: side }))}
                          />
                        ) : null}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showAllOnPageBanner && (
              <tr className="bg-brand-50/40 border-b border-canvas-border">
                <td colSpan={renderOrder.length} className="px-5 py-2.5 text-center text-[12.5px] text-ink-700">
                  All <span className="font-semibold">{pagedIds.length}</span> Cases on this page are selected.{' '}
                  <button
                    type="button"
                    onClick={selectAllCases}
                    className="text-brand-700 font-semibold underline hover:text-brand-600 cursor-pointer"
                  >
                    Select all {filteredExceptions.length} Cases.
                  </button>
                </td>
              </tr>
            )}
            {filteredExceptions.length === 0 ? (
              <tr>
                <td colSpan={renderOrder.length} className="px-6 py-10 text-center text-[13px] text-ink-500">
                  No exceptions match the active filters.
                </td>
              </tr>
            ) : (
              pagedExceptions.map((ex, rowIndex) => {
                const sel = selected.has(ex.id);
                // Selection wins over the overdue tint — selection is the
                // user's active UI state and needs to read first; the
                // Overdue pill in the ID cell still carries that signal.
                const rowBg = sel ? 'bg-brand-50' : 'hover:bg-[#FAFAFB]';
                const rowBgForPin = sel ? '#F7F0FF' : '#FFFFFF';
                // Data-row lookup: prefer Case-ID match; fall back to row
                // index so mock data without a real ID link still renders.
                const dataRow = dataRowByCaseId.get(ex.id)
                  ?? (extraColumns?.rows.length
                    ? extraColumns.rows[rowIndex % extraColumns.rows.length]
                    : undefined);
                return (
                  <tr key={ex.id} className={`border-b border-canvas-border last:border-b-0 transition-colors ${rowBg}`}>
                    {renderOrder.map((key) => {
                      const def = defByKey[key];
                      if (!def) return null;
                      const pinned = pins[key];
                      const offset = pinOffsets[key] ?? 0;
                      const stickyStyle: React.CSSProperties = pinned
                        ? {
                            position: 'sticky',
                            [pinned === 'left' ? 'left' : 'right']: offset,
                            zIndex: 4,
                            background: rowBgForPin,
                            boxShadow: pinned === 'left' ? '1px 0 0 var(--color-canvas-border)' : '-1px 0 0 var(--color-canvas-border)',
                          }
                        : {};
                      const widthStyle: React.CSSProperties = pinned && def.minWidth
                        ? { width: def.minWidth, minWidth: def.minWidth, maxWidth: def.minWidth }
                        : { minWidth: def.minWidth };
                      return (
                        <td
                          key={key}
                          style={{ ...stickyStyle, ...widthStyle }}
                          className={`px-3 py-3 align-middle ${def.align === 'center' ? 'text-center' : ''} ${key === 'id' ? 'align-top' : ''}`}
                        >
                          {renderCell(
                            key,
                            ex,
                            role,
                            sel,
                            () => onToggleSelect(ex.id),
                            () => onOpenClassification(ex),
                            () => onOpenAction(ex),
                            (bulkId) => onOpenActionable?.(bulkId),
                            () => onAssign?.(ex),
                            dataRow,
                            dataColumnNames,
                            onOpenDetail,
                            onRequestDueDate,
                            onReviewDueDate,
                            () => onMarkComplete?.(ex),
                            assignmentByEx.get(ex.id),
                            currentUserId,
                            auditorRoutes[ex.id]?.name,
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer — sits inside the table card, attached at the bottom */}
      <div className="flex items-center justify-between gap-5 px-5 py-3 border-t border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-700">
        <div className="flex items-center gap-3 min-w-0">
        {/* Export CSV split button — left side */}
        <div className="relative inline-flex items-stretch" ref={exportMenuRef}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-8 pl-3 pr-3 text-[12.5px] font-medium text-brand-700 bg-canvas-elevated border border-canvas-border rounded-l-[6px] hover:border-brand-200 cursor-pointer"
          >
            <Download size={13} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setExportMenuOpen(o => !o)}
            className="inline-flex items-center justify-center w-7 h-8 bg-canvas-elevated border-y border-r border-canvas-border rounded-r-[6px] text-ink-500 hover:text-brand-700 hover:border-brand-200 cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            aria-label="Export options"
          >
            <ChevronDown size={12} />
          </button>
          {exportMenuOpen && (
            <div className="absolute z-30 left-0 bottom-full mb-1 w-[140px] bg-canvas-elevated border border-canvas-border rounded-[8px] shadow-xl py-1">
              <button
                type="button"
                onClick={() => setExportMenuOpen(false)}
                className="block w-full text-left px-3 py-1.5 text-[12.5px] text-ink-800 hover:bg-[#FAFAFB] cursor-pointer"
              >
                All Data
              </button>
            </div>
          )}
        </div>

        {sampleSheets.length > 0 && (
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => onChangeSheet?.('all')}
              className={`shrink-0 inline-flex items-center h-7 px-3 text-[12px] font-medium rounded-[6px] cursor-pointer transition-colors ${
                activeSheetId === 'all'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              All Data
            </button>
            {sampleSheets.map(sheet => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => onChangeSheet?.(sheet.id)}
                className={`shrink-0 inline-flex items-center h-7 px-3 text-[12px] font-medium rounded-[6px] cursor-pointer transition-colors max-w-[160px] ${
                  activeSheetId === sheet.id
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
                title={sheet.name}
              >
                <span className="truncate">{sheet.name}</span>
              </button>
            ))}
          </div>
        )}
        </div>

        <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 relative" ref={pageSizeMenuRef}>
          <span className="text-brand-700 font-medium">Rows per page :</span>
          <button
            type="button"
            onClick={() => setPageSizeMenuOpen(o => !o)}
            className="inline-flex items-center justify-between gap-1.5 h-7 w-[64px] px-2 bg-canvas-elevated border border-canvas-border rounded-[6px] hover:border-brand-200 cursor-pointer tabular-nums"
          >
            {pageSize}
            <ChevronDown size={12} className="text-ink-500" />
          </button>
          {pageSizeMenuOpen && (
            <div className="absolute z-20 left-[calc(100%-64px)] bottom-full mb-1 w-[64px] bg-canvas-elevated border border-canvas-border rounded-[8px] shadow-xl py-1">
              {PAGE_SIZE_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setPageSize(n); setPageSizeMenuOpen(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-[12.5px] tabular-nums hover:bg-[#FAFAFB] cursor-pointer ${
                    n === pageSize ? 'text-brand-700 font-medium bg-brand-50/40' : 'text-ink-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="tabular-nums">
          Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-ink-500 hover:bg-[#F4F2F7] hover:text-brand-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 disabled:cursor-not-allowed cursor-pointer"
            aria-label="First page"
          >
            <ChevronsLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-ink-500 hover:bg-[#F4F2F7] hover:text-brand-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-ink-500 hover:bg-[#F4F2F7] hover:text-brand-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] text-ink-500 hover:bg-[#F4F2F7] hover:text-brand-700 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-500 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Last page"
          >
            <ChevronsRight size={15} />
          </button>
        </div>
        </div>
      </div>
    </div>

      {generateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={closeGenerateModal}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative bg-canvas-elevated rounded-[14px] shadow-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Generate Filter Set"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-canvas-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
                  <LayoutGrid size={15} />
                </div>
                <h3 className="text-[14px] font-semibold text-ink-900">Generate Filter Set</h3>
              </div>
              <button
                type="button"
                onClick={closeGenerateModal}
                className="p-1.5 hover:bg-[#F4F2F7] rounded-md text-ink-500 cursor-pointer"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12.5px] font-semibold text-ink-700">Filter Set Name</label>
                  <span className="text-[11.5px] text-ink-500 tabular-nums">{savedFilterSets.length} of 10 created</span>
                </div>
                <input
                  autoFocus
                  value={generateName}
                  onChange={e => setGenerateName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveFilterSet(); } }}
                  placeholder="Enter filter set name"
                  className="w-full px-3 py-2.5 rounded-[8px] border border-canvas-border text-[13px] focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 bg-canvas-elevated"
                />
              </div>
              <div className="rounded-[10px] border border-canvas-border bg-[#FAFAFB] p-3.5">
                <div className="text-[12px] font-semibold text-ink-700 mb-2">Active Filters:</div>
                {activeFilterEntries.length === 0 ? (
                  <p className="text-[12px] text-ink-500">No filters currently applied.</p>
                ) : (
                  <ul className="space-y-1">
                    {activeFilterEntries.map(entry => (
                      <li key={entry.key} className="flex items-start gap-2 text-[12.5px] text-ink-700">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-ink-400 shrink-0" />
                        <span><span className="text-ink-500">{entry.label}:</span> {entry.values}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border">
              <button
                type="button"
                onClick={closeGenerateModal}
                className="px-4 py-2 text-[12.5px] font-medium text-ink-700 border border-canvas-border rounded-[8px] hover:bg-[#F4F2F7] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveFilterSet}
                disabled={!generateName.trim() || activeFilterCount === 0 || savedFilterSets.length >= 10}
                className="px-5 py-2 text-[12.5px] font-semibold text-white bg-brand-600 rounded-[8px] hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
