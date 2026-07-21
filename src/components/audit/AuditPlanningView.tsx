import DatePicker from '../shared/DatePicker';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock, CheckCircle2, Flag, Target, Calendar,
  Users, ShieldCheck, ClipboardList, LayoutGrid,
  X, ChevronDown, Plus, Edit3, AlertTriangle,
  DollarSign, BarChart3, Clock, Zap, ArrowRight,
  Play, FileCheck, Eye, Copy, Upload, Search, ArrowLeft,
  XCircle, Activity, ChevronRight, Info
} from 'lucide-react';
import Orb from '../shared/Orb';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import EngagementSetupPanel from '../engagement/EngagementSetupPanel';
import RacmMappingWorkspace from './RacmMappingWorkspace';
import { computeRacmState, RACM_STATUS_STYLES, RACM_READINESS_STYLES, RACM_ACTION_STYLES, type RacmSummaryInput, type ComputedRacmState } from './racmStateEngine';
import { RACM_SEED_DATA, type RacmEntry } from './RacmListTable';

// ─── Types (Finalized Engagement Model) ──────────────────────────────────────

type EngagementLifecycle = 'draft' | 'planned' | 'frozen' | 'signed-off' | 'active' | 'in-progress' | 'pending-review' | 'closed';
type AuditType = 'Financial Internal Control' | 'Operational Audit' | 'Compliance Audit' | 'IT Audit' | 'Concurrent Audit' | 'Internal Audit' | 'Other';
type FrameworkType = 'SOX ICFR' | 'IFC' | 'COSO' | 'SOC 1' | 'SOC 2' | 'ISO 27001' | 'Internal Policy' | 'Custom';
type ProcessType = 'P2P' | 'O2C' | 'R2R' | 'S2C' | 'ITGC' | 'Cross';
type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
type TabId = 'racm' | 'execution' | 'timeline' | 'resources' | 'risk-matrix' | 'budget';
type RiskStatus = 'at-risk' | 'stable' | 'unvalidated';

interface AuditEngagement {
  id: string;
  name: string;
  auditType: AuditType;
  framework: FrameworkType;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  owner: string;
  reviewer: string;
  description: string;
  sourceRacmVersionId: string;
  engagementSnapshotId: string | null;
  businessProcess: ProcessType;
  status: EngagementLifecycle;
  controls: number;
  plannedHours: number;
  priority: PriorityLevel;
  riskScore: number;
  // Execution metrics
  controlsTested: number;
  controlsEffective: number;
  controlsFailed: number;
  pendingReview: number;
  riskStatus: RiskStatus;
  isOverdue: boolean;
  lastActivity: string;
  // Gantt positioning (relative to FY months)
  start: number;
  duration: number;
  color: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  capacity: number;
  skills: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COLOR_PALETTE = [
  '#6a12cd', '#0284c7', '#d97706', '#059669', '#7c3aed',
  '#dc2626', '#0891b2', '#c026d3', '#ea580c', '#4f46e5',
  '#16a34a', '#9333ea', '#e11d48', '#0d9488',
];

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const PROCESSES: ProcessType[] = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC', 'Cross'];
const AUDIT_TYPES: AuditType[] = ['Financial Internal Control', 'Operational Audit', 'Compliance Audit', 'IT Audit', 'Concurrent Audit', 'Internal Audit', 'Other'];
const FRAMEWORKS: FrameworkType[] = ['SOX ICFR', 'IFC', 'COSO', 'SOC 1', 'SOC 2', 'ISO 27001', 'Internal Policy', 'Custom'];
const PRIORITIES: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

const RACM_VERSIONS = [
  { id: 'racm-v2.1', label: 'RACM v2.1 (Current — Feb 2026)' },
  { id: 'racm-v2.0', label: 'RACM v2.0 (Nov 2025)' },
  { id: 'racm-v1.9', label: 'RACM v1.9 (Aug 2025)' },
  { id: 'racm-v1.8', label: 'RACM v1.8 (May 2025)' },
];

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm-1', name: 'Tushar Goel', role: 'Senior Auditor', avatar: 'TG', capacity: 160, skills: ['P2P', 'SOX', 'AP'] },
  { id: 'tm-2', name: 'Deepak Bansal', role: 'IT Audit Specialist', avatar: 'DB', capacity: 160, skills: ['ITGC', 'Security', 'Access'] },
  { id: 'tm-3', name: 'Neha Joshi', role: 'Senior Auditor', avatar: 'NJ', capacity: 160, skills: ['O2C', 'Revenue', 'SOX'] },
  { id: 'tm-4', name: 'Karan Mehta', role: 'Audit Manager', avatar: 'KM', capacity: 120, skills: ['SOX', 'R2R', 'Planning'] },
  { id: 'tm-5', name: 'Sneha Desai', role: 'Risk Analyst', avatar: 'SD', capacity: 160, skills: ['Risk', 'IFC', 'S2C'] },
  { id: 'tm-6', name: 'Rohan Patel', role: 'Staff Auditor', avatar: 'RP', capacity: 160, skills: ['S2C', 'Contracts', 'Vendor'] },
  { id: 'tm-7', name: 'Priya Singh', role: 'Staff Auditor', avatar: 'PS', capacity: 160, skills: ['P2P', 'Vendor', 'Risk'] },
];

const INITIAL_AUDIT_PLAN: AuditEngagement[] = [
  {
    id: 'ap-1', name: 'P2P — SOX Audit', auditType: 'Financial Internal Control', framework: 'SOX ICFR', businessProcess: 'P2P',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-04-01', plannedEndDate: '2025-06-30',
    actualStartDate: '2025-04-05', actualEndDate: '',
    owner: 'Tushar Goel', reviewer: 'Karan Mehta',
    description: 'Comprehensive SOX audit covering AP, PO, and vendor master controls with focus on segregation of duties and transaction authorization.',
    sourceRacmVersionId: 'racm-v2.1', engagementSnapshotId: 'snap-001',
    status: 'active', controls: 24, plannedHours: 480, priority: 'Critical', riskScore: 85,
    controlsTested: 18, controlsEffective: 14, controlsFailed: 2, pendingReview: 3, riskStatus: 'at-risk', isOverdue: false, lastActivity: '2 hours ago',
    start: 0, duration: 3, color: '#6a12cd',
  },
  {
    id: 'ap-2', name: 'O2C — SOX Audit', auditType: 'Financial Internal Control', framework: 'SOX ICFR', businessProcess: 'O2C',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-05-01', plannedEndDate: '2025-07-31',
    actualStartDate: '2025-05-02', actualEndDate: '',
    owner: 'Neha Joshi', reviewer: 'Sneha Desai',
    description: 'SOX compliance audit for Order-to-Cash process including revenue recognition and AR controls.',
    sourceRacmVersionId: 'racm-v2.1', engagementSnapshotId: 'snap-002',
    status: 'active', controls: 18, plannedHours: 360, priority: 'High', riskScore: 72,
    controlsTested: 8, controlsEffective: 7, controlsFailed: 0, pendingReview: 1, riskStatus: 'stable', isOverdue: false, lastActivity: '1 day ago',
    start: 1, duration: 3, color: '#0284c7',
  },
  {
    id: 'ap-3', name: 'R2R — SOX Audit', auditType: 'Financial Internal Control', framework: 'SOX ICFR', businessProcess: 'R2R',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-04-01', plannedEndDate: '2025-08-31',
    actualStartDate: '2025-04-03', actualEndDate: '',
    owner: 'Karan Mehta', reviewer: 'Abhinav S',
    description: 'Record-to-Report SOX audit covering journal entries, reconciliations, and financial close processes.',
    sourceRacmVersionId: 'racm-v2.1', engagementSnapshotId: 'snap-003',
    status: 'in-progress', controls: 31, plannedHours: 520, priority: 'Critical', riskScore: 90,
    controlsTested: 26, controlsEffective: 20, controlsFailed: 3, pendingReview: 5, riskStatus: 'at-risk', isOverdue: true, lastActivity: '5 hours ago',
    start: 0, duration: 5, color: '#d97706',
  },
  {
    id: 'ap-4', name: 'S2C — Contract Review', auditType: 'Internal Audit', framework: 'Internal Policy', businessProcess: 'S2C',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-07-01', plannedEndDate: '2025-09-30',
    actualStartDate: '', actualEndDate: '',
    owner: 'Rohan Patel', reviewer: 'Priya Singh',
    description: 'Internal audit of Source-to-Contract process focusing on new contract lifecycle and vendor management.',
    sourceRacmVersionId: 'racm-v1.8', engagementSnapshotId: null,
    status: 'planned', controls: 14, plannedHours: 240, priority: 'Medium', riskScore: 45,
    controlsTested: 0, controlsEffective: 0, controlsFailed: 0, pendingReview: 0, riskStatus: 'unvalidated', isOverdue: false, lastActivity: '—',
    start: 3, duration: 3, color: '#059669',
  },
  {
    id: 'ap-5', name: 'P2P — IFC Assessment', auditType: 'Financial Internal Control', framework: 'IFC', businessProcess: 'P2P',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-08-01', plannedEndDate: '2025-10-31',
    actualStartDate: '', actualEndDate: '',
    owner: 'Sneha Desai', reviewer: 'Karan Mehta',
    description: 'Internal Financial Controls assessment for Procure-to-Pay process using COBIT framework.',
    sourceRacmVersionId: 'racm-v2.0', engagementSnapshotId: null,
    status: 'planned', controls: 18, plannedHours: 300, priority: 'High', riskScore: 68,
    controlsTested: 0, controlsEffective: 0, controlsFailed: 0, pendingReview: 0, riskStatus: 'unvalidated', isOverdue: false, lastActivity: '—',
    start: 4, duration: 3, color: '#6a12cd',
  },
  {
    id: 'ap-6', name: 'IT General Controls', auditType: 'IT Audit', framework: 'ISO 27001', businessProcess: 'ITGC',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-06-01', plannedEndDate: '2026-01-31',
    actualStartDate: '2025-06-03', actualEndDate: '',
    owner: 'Deepak Bansal', reviewer: 'Tushar Goel',
    description: 'IT General Controls audit covering access management, change management, operations, and SDLC controls.',
    sourceRacmVersionId: 'racm-v2.1', engagementSnapshotId: 'snap-006',
    status: 'active', controls: 15, plannedHours: 640, priority: 'Critical', riskScore: 82,
    controlsTested: 9, controlsEffective: 8, controlsFailed: 0, pendingReview: 2, riskStatus: 'stable', isOverdue: false, lastActivity: '3 hours ago',
    start: 2, duration: 8, color: '#7c3aed',
  },
  {
    id: 'ap-7', name: 'Vendor Risk Assessment', auditType: 'Operational Audit', framework: 'Internal Policy', businessProcess: 'P2P',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2025-10-01', plannedEndDate: '2025-11-30',
    actualStartDate: '', actualEndDate: '',
    owner: 'Priya Singh', reviewer: 'Neha Joshi',
    description: 'Third-party vendor risk assessment focusing on vendor master data and procurement controls.',
    sourceRacmVersionId: 'racm-v1.9', engagementSnapshotId: null,
    status: 'draft', controls: 8, plannedHours: 160, priority: 'Medium', riskScore: 55,
    controlsTested: 0, controlsEffective: 0, controlsFailed: 0, pendingReview: 0, riskStatus: 'unvalidated', isOverdue: false, lastActivity: '—',
    start: 6, duration: 2, color: '#dc2626',
  },
  {
    id: 'ap-8', name: 'Year-End Close Review', auditType: 'Financial Internal Control', framework: 'SOX ICFR', businessProcess: 'R2R',
    auditPeriodStart: '2025-04-01', auditPeriodEnd: '2026-03-31',
    plannedStartDate: '2026-01-01', plannedEndDate: '2026-02-28',
    actualStartDate: '', actualEndDate: '',
    owner: 'Karan Mehta', reviewer: 'Abhinav S',
    description: 'Year-end closing procedures and adjustments review for SOX compliance.',
    sourceRacmVersionId: 'racm-v2.1', engagementSnapshotId: null,
    status: 'planned', controls: 12, plannedHours: 200, priority: 'High', riskScore: 60,
    controlsTested: 0, controlsEffective: 0, controlsFailed: 0, pendingReview: 0, riskStatus: 'unvalidated', isOverdue: false, lastActivity: '—',
    start: 9, duration: 2, color: '#d97706',
  },
];

const MILESTONES = [
  { month: 2, label: 'Q1 Review', icon: Flag },
  { month: 5, label: 'Mid-Year Assessment', icon: Target },
  { month: 8, label: 'Q3 Review', icon: Flag },
  { month: 11, label: 'Year-End Close', icon: CheckCircle2 },
];

const SIGNOFF_LOG = [
  { name: 'Karan Mehta', role: 'Audit Manager', action: 'Plan Created', date: 'Jan 15, 2026', status: 'completed' as const },
  { name: 'Sneha Desai', role: 'Risk Lead', action: 'Risk Assessment Review', date: 'Feb 10, 2026', status: 'completed' as const },
  { name: 'Abhinav S', role: 'Audit Director', action: 'Final Sign-Off', date: 'Mar 1, 2026', status: 'pending' as const },
];

const SIGNERS = ['Karan Mehta', 'Sneha Desai', 'Abhinav S'];

function getRacmLabel(versionId: string): string {
  const found = RACM_VERSIONS.find(r => r.id === versionId);
  return found ? found.label.replace(/\s*\(.*\)/, '') : versionId;
}

function getScopeLabel(eng: { businessProcess: ProcessType; auditType: AuditType; framework: FrameworkType }): string {
  if (eng.businessProcess === 'Cross') return 'P2P + O2C + R2R + ITGC';
  if (eng.businessProcess === 'ITGC') return 'ITGC (Cross Process)';
  if (eng.framework === 'SOX ICFR' || eng.framework === 'IFC') return `${eng.businessProcess} + ITGC`;
  return eng.businessProcess;
}

function getRacmDisplayName(eng: { businessProcess: ProcessType; auditType: AuditType; sourceRacmVersionId: string }): string {
  const prefix = eng.businessProcess === 'Cross' ? 'Cross-Process' : eng.businessProcess;
  const type = eng.auditType;
  const ver = getRacmLabel(eng.sourceRacmVersionId);
  return `${prefix} ${type} ${ver}`;
}

const PROCESS_BADGE_COLORS: Record<ProcessType, string> = {
  P2P: 'bg-canvas text-ink-600 border-canvas-border/60',
  O2C: 'bg-canvas text-ink-600 border-canvas-border/60',
  R2R: 'bg-canvas text-ink-600 border-canvas-border/60',
  S2C: 'bg-canvas text-ink-600 border-canvas-border/60',
  ITGC: 'bg-canvas text-ink-600 border-canvas-border/60',
  Cross: 'bg-canvas text-ink-600 border-canvas-border/60',
};

function getCurrentMonth(): number { return 11; }

function formatDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Lifecycle helpers ───────────────────────────────────────────────────────

const LIFECYCLE_ORDER: EngagementLifecycle[] = ['draft', 'planned', 'frozen', 'signed-off', 'active', 'in-progress', 'pending-review', 'closed'];

function lifecycleLabel(s: EngagementLifecycle): string {
  const map: Record<EngagementLifecycle, string> = {
    'draft': 'Draft', 'planned': 'Planned', 'frozen': 'Frozen', 'signed-off': 'Signed Off',
    'active': 'Active', 'in-progress': 'In Progress', 'pending-review': 'Pending Review', 'closed': 'Closed',
  };
  return map[s];
}

function lifecycleTone(s: EngagementLifecycle): string {
  const map: Record<EngagementLifecycle, string> = {
    'draft': 'bg-canvas text-ink-600',
    'planned': 'bg-canvas text-ink-600',
    'frozen': 'bg-blue-50 text-blue-700',
    'signed-off': 'bg-emerald-50 text-emerald-700',
    'active': 'bg-emerald-50 text-emerald-700',
    'in-progress': 'bg-blue-50 text-blue-700',
    'pending-review': 'bg-amber-50 text-amber-700',
    'closed': 'bg-canvas text-ink-500',
  };
  return map[s];
}

function isExecutionPhase(s: EngagementLifecycle): boolean {
  return ['active', 'in-progress', 'pending-review', 'closed'].includes(s);
}

// ─── Custom Dropdown ─────────────────────────────────────────────────────────

function Dropdown<T extends string>({
  label, value, options, onChange, disabled = false, renderOption,
}: {
  label: string; value: T; options: T[]; onChange: (val: T) => void;
  disabled?: boolean; renderOption?: (opt: T) => React.ReactNode;
}) {

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="mb-3">
      <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(p => !p)}
          className={`w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] transition-colors bg-white ${
            disabled ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'text-text hover:border-primary/30 cursor-pointer'
          }`}
        >
          <span>{renderOption ? renderOption(value) : value}</span>
          {!disabled && <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-full mt-1 bg-white border border-border-light rounded-xl shadow-lg overflow-hidden z-50 max-h-48 overflow-y-auto"
            >
              {options.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[0.75rem] transition-colors cursor-pointer ${
                    value === opt ? 'bg-primary/10 text-primary font-semibold' : 'text-text-secondary hover:bg-surface-2'
                  }`}
                >
                  {renderOption ? renderOption(opt) : opt}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, index }: {
  label: string; value: string | number; icon: React.ElementType; color: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className="glass-card p-5 hover:border-primary/20 transition-all duration-300 cursor-default"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${color} transition-transform duration-300`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold text-text">{value}</div>
      <div className="text-[0.75rem] text-text-muted mt-1">{label}</div>
    </motion.div>
  );
}

// ─── RACM Dashboard (governance setup tab) ──────────────────────────────────

// RacmEntry type and RACM_SEED_DATA imported from RacmListTable

// Helper: get computed state for any RACM entry
function getRacmComputed(racm: RacmEntry): ComputedRacmState {
  return computeRacmState({
    risks: racm.risks,
    controls: racm.controls,
    mappedRisks: racm.mappedRisks,
    unmappedRisks: racm.unmappedRisks,
    keyControls: racm.keyControls,
    workflowCoverage: racm.workflowCoverage,
    attributesCoverage: racm.attributesCoverage,
    isValidated: racm.isValidated,
    linkedToEngagement: racm.linkedToEngagement,
  });
}

const MOCK_RACMS = RACM_SEED_DATA;

type MappingStatus = 'Not Started' | 'In Progress' | 'Complete';
function getMappingStatus(racm: RacmEntry): MappingStatus {
  if (racm.mappedRisks === 0) return 'Not Started';
  if (racm.mappedRisks < racm.risks) return 'In Progress';
  return 'Complete';
}
const MAPPING_STYLES: Record<MappingStatus, string> = {
  'Not Started': 'bg-canvas text-ink-500',
  'In Progress': 'bg-amber-50 text-amber-600',
  'Complete': 'bg-emerald-50 text-emerald-600',
};
type Readiness = 'Mapping Incomplete' | 'Workflow Missing' | 'Ready';
function getReadiness(racm: RacmEntry): Readiness {
  if (racm.unmappedRisks > 0 || racm.mappedRisks < racm.risks) return 'Mapping Incomplete';
  if (racm.workflowCoverage < 100) return 'Workflow Missing';
  return 'Ready';
}
const READINESS_STYLES: Record<Readiness, string> = {
  'Mapping Incomplete': 'bg-amber-50 text-amber-700',
  'Workflow Missing': 'bg-amber-50/60 text-amber-600',
  'Ready': 'bg-emerald-50 text-emerald-700',
};

const BP_DOT_COLORS: Record<string, string> = { P2P: '#6a12cd', O2C: '#0284c7', R2R: '#d97706', S2C: '#059669', ITGC: '#16a34a' };

// Imported RACM row shape
interface ImportedRacmRow {
  sourceRow: number;
  riskName: string;
  riskDescription: string;
  process: string;
  controlText: string;
  controlOwner: string;
  controlType: string;
  frequency: string;
  mappingStatus: 'Not Mapped' | 'Partially Mapped' | 'Mapped';
}

// Mock parsed data from an Excel import
const MOCK_PARSED_ROWS: ImportedRacmRow[] = [
  { sourceRow: 2, riskName: 'Unauthorized vendor payments', riskDescription: 'Payments processed without proper PO or approval', process: 'P2P', controlText: 'Three-way match of PO, GRN, and Invoice before payment', controlOwner: 'Rajiv Sharma', controlType: 'Key', frequency: 'Per transaction', mappingStatus: 'Not Mapped' },
  { sourceRow: 3, riskName: 'Duplicate invoices processed', riskDescription: 'Same invoice paid twice due to weak detection', process: 'P2P', controlText: 'Automated duplicate detection scan before payment release', controlOwner: 'Rajiv Sharma', controlType: 'Key', frequency: 'Per transaction', mappingStatus: 'Not Mapped' },
  { sourceRow: 4, riskName: 'Fictitious vendor registration', riskDescription: 'Vendor created without verification of identity and bank details', process: 'P2P', controlText: 'Multi-level approval for new vendor registration with tax ID verification', controlOwner: 'Deepak Bansal', controlType: 'Key', frequency: 'Per transaction', mappingStatus: 'Not Mapped' },
  { sourceRow: 5, riskName: 'Unauthorized PO creation', riskDescription: 'Purchase orders above threshold committed without dual sign-off', process: 'P2P', controlText: 'Dual approval workflow for POs exceeding $10K threshold', controlOwner: 'Meera Patel', controlType: 'Non-Key', frequency: 'Per transaction', mappingStatus: 'Not Mapped' },
  { sourceRow: 6, riskName: 'SOD violation in AP', riskDescription: 'Same user creates and approves payment', process: 'P2P', controlText: 'Real-time SOD conflict detection and blocking', controlOwner: 'IT Security', controlType: 'Key', frequency: 'Continuous', mappingStatus: 'Not Mapped' },
  { sourceRow: 7, riskName: 'Revenue recognition timing', riskDescription: 'Revenue recognized before performance obligation completion', process: 'O2C', controlText: 'ASC 606 compliance check on all revenue transactions', controlOwner: 'Neha Joshi', controlType: 'Key', frequency: 'Monthly', mappingStatus: 'Not Mapped' },
  { sourceRow: 8, riskName: 'Incorrect journal entries', riskDescription: 'Manual JE posted without review or with incorrect amounts', process: 'R2R', controlText: 'AI anomaly detection on journal entries with management review', controlOwner: 'Rohan Patel', controlType: 'Key', frequency: 'Daily', mappingStatus: 'Not Mapped' },
  { sourceRow: 9, riskName: 'GL balance discrepancy', riskDescription: 'Subsidiary balances do not reconcile to consolidated GL', process: 'R2R', controlText: 'Monthly GL reconciliation across all entities', controlOwner: 'Karan Mehta', controlType: 'Non-Key', frequency: 'Monthly', mappingStatus: 'Not Mapped' },
];

const COLUMN_OPTIONS = ['Risk Name', 'Risk Description', 'Process', 'Control Description', 'Control Owner', 'Control Type', 'Frequency', '— Skip —'];

// ─── RACM Import Drawer ─────────────────────────────────────────────────────

function RacmImportDrawer({ onClose, onImport }: { onClose: () => void; onImport: (rows: ImportedRacmRow[]) => void }) {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({
    0: 'Risk Name', 1: 'Risk Description', 2: 'Process', 3: 'Control Description', 4: 'Control Owner', 5: 'Control Type', 6: 'Frequency',
  });

  const steps = ['Upload File', 'Parse Preview', 'Column Mapping', 'Review Rows', 'Confirm Import'];

  const handleFileDrop = () => {
    setFileName('RACM_FY26_P2P_v2.xlsx');
    setStep(1);
  };

  const previewHeaders = ['Risk Name', 'Risk Description', 'Process', 'Control Description', 'Control Owner', 'Type', 'Frequency'];
  const previewRows = MOCK_PARSED_ROWS.slice(0, 4);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <motion.aside initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[640px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog" aria-label="Import RACM">

        {/* Header */}
        <header className="shrink-0 px-6 pt-5 pb-0 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2"><Upload size={18} className="text-brand-600" /><h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">Import RACM</h2></div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Upload an Excel or CSV file containing risk and control data.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1 -mb-px">
            {steps.map((s, i) => (
              <button key={s} onClick={() => { if (i < step) setStep(i); }}
                className={`pb-3 px-2 text-[0.6875rem] font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                  i === step ? 'border-brand-600 text-brand-700' : i < step ? 'border-transparent text-brand-500 hover:text-brand-700' : 'border-transparent text-ink-400'
                }`}>
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[0.5625rem] font-bold mr-1 ${
                  i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-ink-400'
                }`}>{i < step ? '✓' : i + 1}</span>{s}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>

              {/* Step 0: Upload */}
              {step === 0 && (
                <div className="space-y-4">
                  <div onClick={handleFileDrop}
                    className="border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary/40 hover:bg-primary-xlight/20 transition-all cursor-pointer">
                    <Upload size={32} className="mx-auto text-ink-300 mb-3" />
                    <p className="text-[0.875rem] font-semibold text-text mb-1">Drop your RACM file here</p>
                    <p className="text-[0.75rem] text-text-muted">or click to browse. Supports .xlsx, .xls, .csv</p>
                    <p className="text-[0.625rem] text-text-muted mt-3">Maximum file size: 10MB</p>
                  </div>
                  <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2">
                    <p className="text-[0.625rem] text-ink-400">Expected columns: Risk Name, Risk Description, Process, Control Description, Control Owner, Control Type, Frequency</p>
                  </div>
                </div>
              )}

              {/* Step 1: Parse Preview */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-compliant-50/50 border border-compliant/20">
                    <CheckCircle2 size={16} className="text-compliant-700 shrink-0" />
                    <div>
                      <span className="text-[0.75rem] font-semibold text-compliant-700">File parsed successfully</span>
                      <span className="text-[0.75rem] text-compliant-700/70 ml-2">{fileName} — {MOCK_PARSED_ROWS.length} rows, {previewHeaders.length} columns detected</span>
                    </div>
                  </div>
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.6875rem]">
                        <thead><tr className="border-b border-border bg-surface-2/50">
                          <th className="px-2 py-2 text-left text-[0.5625rem] font-semibold text-text-muted uppercase w-8">Row</th>
                          {previewHeaders.map(h => <th key={h} className="px-2 py-2 text-left text-[0.5625rem] font-semibold text-text-muted uppercase">{h}</th>)}
                        </tr></thead>
                        <tbody>{previewRows.map((r, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="px-2 py-1.5 text-[0.625rem] font-mono text-ink-400">{r.sourceRow}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text truncate max-w-[100px]">{r.riskName}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text-muted truncate max-w-[120px]">{r.riskDescription}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text">{r.process}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text truncate max-w-[140px]">{r.controlText}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text-muted">{r.controlOwner}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text-muted">{r.controlType}</td>
                            <td className="px-2 py-1.5 text-[0.625rem] text-text-muted">{r.frequency}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="px-3 py-2 border-t border-border bg-surface-2/30 text-[0.625rem] text-text-muted">Showing {previewRows.length} of {MOCK_PARSED_ROWS.length} rows</div>
                  </div>
                </div>
              )}

              {/* Step 2: Column Mapping */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-[0.75rem] text-text-muted">Map each detected column to the correct RACM field.</p>
                  <div className="space-y-2">
                    {previewHeaders.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-canvas-border bg-white">
                        <div className="w-[140px] shrink-0">
                          <span className="text-[0.6875rem] font-mono text-ink-500">Column {i + 1}</span>
                          <div className="text-[0.75rem] font-medium text-text">{h}</div>
                        </div>
                        <ArrowRight size={14} className="text-ink-300 shrink-0" />
                        <select value={columnMapping[i] || '— Skip —'} onChange={e => setColumnMapping(prev => ({ ...prev, [i]: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-white text-[0.75rem] text-text outline-none focus:border-primary/40 cursor-pointer">
                          {COLUMN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {columnMapping[i] && columnMapping[i] !== '— Skip —' && <CheckCircle2 size={14} className="text-compliant-700 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Review Rows */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.75rem] text-text-muted">{MOCK_PARSED_ROWS.length} rows ready for import</p>
                    <span className="px-2.5 h-5 rounded-full text-[0.625rem] font-semibold bg-evidence-50 text-evidence-700 inline-flex items-center">All unmapped — mapping happens after import</span>
                  </div>
                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.6875rem]">
                        <thead><tr className="border-b border-border bg-surface-2/50">
                          {['Row', 'Risk Name', 'Process', 'Control Text', 'Owner', 'Type', 'Status'].map(h =>
                            <th key={h} className="px-3 py-2.5 text-left text-[0.5625rem] font-semibold text-text-muted uppercase whitespace-nowrap">{h}</th>
                          )}
                        </tr></thead>
                        <tbody>{MOCK_PARSED_ROWS.map((r, i) => (
                          <tr key={i} className="border-b border-border/40 hover:bg-surface-2/30 transition-colors">
                            <td className="px-3 py-2 text-[0.625rem] font-mono text-ink-400">{r.sourceRow}</td>
                            <td className="px-3 py-2"><div className="text-[0.6875rem] font-medium text-text">{r.riskName}</div><div className="text-[0.75rem] text-text-muted truncate max-w-[160px]">{r.riskDescription}</div></td>
                            <td className="px-3 py-2 text-[0.6875rem] text-text">{r.process}</td>
                            <td className="px-3 py-2 text-[0.625rem] text-text-secondary truncate max-w-[180px]">{r.controlText}</td>
                            <td className="px-3 py-2 text-[0.625rem] text-text-muted">{r.controlOwner}</td>
                            <td className="px-3 py-2"><span className={`px-1.5 h-4 rounded text-[0.5625rem] font-bold inline-flex items-center ${r.controlType === 'Key' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-500'}`}>{r.controlType}</span></td>
                            <td className="px-3 py-2"><span className="px-1.5 h-4 rounded text-[0.5625rem] font-bold bg-draft-50 text-draft-700 inline-flex items-center">Not Mapped</span></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2">
                    <p className="text-[0.625rem] text-ink-400">Imported control descriptions are preserved as source references. Map them to Control Library objects after import.</p>
                  </div>
                </div>
              )}

              {/* Step 4: Confirm */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="glass-card p-6 text-center">
                    <CheckCircle2 size={36} className="mx-auto text-compliant-700 mb-3" />
                    <h3 className="text-[1rem] font-bold text-text mb-1">Ready to Import</h3>
                    <p className="text-[0.8125rem] text-text-muted mb-4">This will create {MOCK_PARSED_ROWS.length} risk-control rows from {fileName}</p>
                    <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                      <div><div className="text-xl font-bold text-text">{MOCK_PARSED_ROWS.length}</div><div className="text-[0.625rem] text-text-muted">Rows</div></div>
                      <div><div className="text-xl font-bold text-text">{new Set(MOCK_PARSED_ROWS.map(r => r.riskName)).size}</div><div className="text-[0.625rem] text-text-muted">Unique Risks</div></div>
                      <div><div className="text-xl font-bold text-text">{new Set(MOCK_PARSED_ROWS.map(r => r.process)).size}</div><div className="text-[0.625rem] text-text-muted">Processes</div></div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-mitigated/30 bg-mitigated-50 px-4 py-3 flex items-start gap-2.5">
                    <Info size={14} className="text-mitigated-700 mt-0.5 shrink-0" />
                    <div className="text-[0.6875rem] text-mitigated-700 leading-relaxed">
                      Imported controls are <strong>not</strong> automatically created as system controls. They are preserved as source references. You will need to map each control text to a Control Library object or create new controls.
                    </div>
                  </div>
                  <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2 flex items-start gap-2 opacity-50">
                    <Activity size={11} className="text-ink-400 mt-0.5 shrink-0" />
                    <span className="text-[0.625rem] text-ink-400">AI auto-mapping — coming soon. Suggested matches will appear here in a future release.</span>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border bg-canvas flex items-center justify-between">
          <div className="text-[0.6875rem] text-ink-400">Step {step + 1} of {steps.length}</div>
          <div className="flex items-center gap-3">
            {step > 0 && <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Back</button>}
            {step < 4 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={step === 0}
                className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                {step === 3 ? 'Review Complete' : 'Continue'}
              </button>
            ) : (
              <button onClick={() => onImport(MOCK_PARSED_ROWS)}
                className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer">
                Confirm Import
              </button>
            )}
          </div>
        </footer>
      </motion.aside>
    </>
  );
}

// ─── RACM Dashboard with import integration ─────────────────────────────────

function RacmDashboard({ engagements, onGoToExecution }: { engagements: { sourceRacmVersionId: string }[]; onGoToExecution: () => void }) {
  const { addToast } = useToast();
  const { can } = useCan();
  const logEvent = useAuditLog();
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [importedRows, setImportedRows] = useState<ImportedRacmRow[]>([]);
  const [showMappingWorkspace, setShowMappingWorkspace] = useState(false);
  const [mappingRacm, setMappingRacm] = useState<RacmEntry | null>(null);
  const [showCreateRacmModal, setShowCreateRacmModal] = useState(false);
  const [racmList, setRacmList] = useState<RacmEntry[]>(MOCK_RACMS);
  const [selectedRacmId, setSelectedRacmId] = useState<string | null>(null);

  const handleImport = (rows: ImportedRacmRow[]) => {
    setImportedRows(rows);
    setShowImportDrawer(false);
    addToast({ message: `${rows.length} rows imported — review and map controls below`, type: 'success' });
    logEvent({ action: 'Create', description: `Imported ${rows.length} RACM rows from file`, module: 'Governance', entity: 'RACM' });
  };

  const handleMapRow = (idx: number) => {
    const row = importedRows[idx];
    setImportedRows(prev => prev.map((r, i) => i === idx ? { ...r, mappingStatus: 'Mapped' } : r));
    addToast({ message: `Control mapped to Control Library`, type: 'success' });
    logEvent({ action: 'Create', description: `Mapped control for risk "${row?.riskName ?? 'Unknown'}" to the Control Library`, module: 'Control Library', entity: 'Control' });
  };

  // Summary KPIs (all derived from data)
  const totalRacms = racmList.length;
  const totalRisks = racmList.reduce((s, r) => s + r.risks, 0);
  const totalControls = racmList.reduce((s, r) => s + r.controls, 0);
  const totalUnmapped = racmList.reduce((s, r) => s + r.unmappedRisks, 0);
  const computedStates = racmList.map(r => getRacmComputed(r));
  const readyCount = computedStates.filter(s => s.readiness === 'Ready').length;
  const avgCoverage = totalRacms > 0 ? Math.round(racmList.reduce((s, r) => s + r.workflowCoverage, 0) / totalRacms) : 0;

  const mappedImportCount = importedRows.filter(r => r.mappingStatus === 'Mapped').length;
  const unmappedImportCount = importedRows.filter(r => r.mappingStatus === 'Not Mapped').length;

  const MAP_STATUS_CLS: Record<string, string> = {
    'Not Mapped': 'bg-draft-50 text-draft-700',
    'Partially Mapped': 'bg-mitigated-50 text-mitigated-700',
    'Mapped': 'bg-compliant-50 text-compliant-700',
  };

  // If RACM setup workspace is open, render it
  const selectedRacm = selectedRacmId ? racmList.find(r => r.id === selectedRacmId) : null;
  if (selectedRacm) {
    return <RacmSetupWorkspace
      racm={selectedRacm}
      onBack={() => setSelectedRacmId(null)}
      onStartMapping={() => { setMappingRacm(selectedRacm); setSelectedRacmId(null); setShowMappingWorkspace(true); }}
      onImport={() => { setSelectedRacmId(null); setShowImportDrawer(true); }}
    />;
  }

  // If mapping workspace is open, render it instead of the dashboard
  if (showMappingWorkspace && mappingRacm) {
    const mappingState = getRacmComputed(mappingRacm);
    return <RacmMappingWorkspace
      racmId={mappingRacm.id}
      racmName={mappingRacm.name}
      racmProcess={mappingRacm.process}
      isEmpty={mappingRacm.risks === 0 && mappingState.status === 'Draft'}
      onBack={() => {
        setShowMappingWorkspace(false);
        setMappingRacm(null);
      }}
      onGoToExecution={() => { setShowMappingWorkspace(false); setMappingRacm(null); onGoToExecution(); }}
    />;
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="text-[0.75rem] text-text-muted">{totalRacms} RACM{totalRacms !== 1 ? 's' : ''} across {new Set(racmList.map(r => r.process)).size} processes</div>
        <div className="flex items-center gap-2">
          {can('plan_edit') && (
            <button onClick={() => setShowImportDrawer(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:bg-white transition-colors cursor-pointer">
              <Upload size={13} />Import RACM
            </button>
          )}
          {can('plan_edit') && (
            <button onClick={() => setShowCreateRacmModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-primary/30 bg-primary/5 rounded-lg text-[0.75rem] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer">
              <Plus size={13} />Create RACM
            </button>
          )}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total RACMs', value: totalRacms, color: 'text-brand-700 bg-brand-50' },
          { label: 'Risks', value: totalRisks, color: 'text-risk-700 bg-risk-50' },
          { label: 'Controls', value: totalControls, color: 'text-evidence-700 bg-evidence-50' },
          { label: 'Unmapped', value: totalUnmapped, color: totalUnmapped > 0 ? 'text-high-700 bg-high-50' : 'text-compliant-700 bg-compliant-50' },
          { label: 'Ready', value: `${readyCount}/${totalRacms}`, color: 'text-compliant-700 bg-compliant-50' },
          { label: 'Workflow Coverage', value: `${avgCoverage}%`, color: 'text-brand-700 bg-brand-50' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${kpi.color.split(' ')[0]}`}>{kpi.value}</div>
            <div className="text-[0.625rem] text-text-muted mt-0.5">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* RACM table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="border-b border-border bg-surface-2/50">
                {['RACM', 'Process', 'Framework', 'Risks', 'Controls', 'Key Controls', 'Mapping Status', 'Readiness', ''].map(h => (
                  <th key={h || 'action'} className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {racmList.map((racm, i) => {
                const mapping = getMappingStatus(racm);
                const readiness = getReadiness(racm);
                return (
                  <motion.tr key={racm.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-canvas/60 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {racm.linkedToEngagement && <Lock size={10} className="text-ink-400 shrink-0" />}
                        <span className="text-[0.75rem] font-medium text-text">{racm.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center px-2 h-5 rounded-full text-[0.625rem] font-semibold bg-canvas text-ink-600 border border-canvas-border/60">{racm.process}</span>
                    </td>
                    <td className="px-3 py-3"><span className="text-[0.6875rem] text-ink-500">{racm.framework}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.75rem] text-text tabular-nums">{racm.risks}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.75rem] text-text tabular-nums">{racm.controls}</span></td>
                    <td className="px-3 py-3"><span className="text-[0.75rem] text-ink-500 tabular-nums">{racm.keyControls}</span></td>
                    <td className="px-3 py-3">
                      <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${MAPPING_STYLES[mapping]}`}>{mapping}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 h-5 rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${READINESS_STYLES[readiness]}`}>{readiness}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => { setMappingRacm(racm); setShowMappingWorkspace(true); }}
                        className="px-2 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 bg-canvas text-ink-600 hover:bg-canvas-border/70">
                        View<ChevronRight size={8} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/30">
          <span className="text-[0.6875rem] text-text-muted">{racmList.length} RACM{racmList.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* ── Imported Rows Review ── */}
      {importedRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.8125rem] font-semibold text-text flex items-center gap-2">
              <Upload size={14} className="text-brand-600" />Imported RACM — Review & Map
            </h3>
            <div className="flex items-center gap-3 text-[0.6875rem]">
              <span className="text-compliant-700 font-medium">{mappedImportCount} mapped</span>
              <span className="text-draft-700 font-medium">{unmappedImportCount} unmapped</span>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.6875rem]">
                <thead><tr className="border-b border-border bg-surface-2/50">
                  {['Row', 'Risk', 'Process', 'Imported Control Text', 'Owner', 'Type', 'Mapping', 'Action'].map(h =>
                    <th key={h} className="px-3 py-2.5 text-left text-[0.5625rem] font-semibold text-text-muted uppercase whitespace-nowrap">{h}</th>
                  )}
                </tr></thead>
                <tbody>{importedRows.map((r, i) => (
                  <tr key={i} className={`border-b border-border/40 transition-colors ${r.mappingStatus === 'Not Mapped' ? 'bg-risk-50/10 hover:bg-risk-50/20' : 'hover:bg-surface-2/30'}`}>
                    <td className="px-3 py-2 text-[0.625rem] font-mono text-ink-400">{r.sourceRow}</td>
                    <td className="px-3 py-2">
                      <div className="text-[0.6875rem] font-medium text-text">{r.riskName}</div>
                      <div className="text-[0.75rem] text-text-muted truncate max-w-[140px]">{r.riskDescription}</div>
                    </td>
                    <td className="px-3 py-2 text-[0.6875rem] text-text">{r.process}</td>
                    <td className="px-3 py-2 text-[0.625rem] text-text-secondary max-w-[180px]"><span className="line-clamp-2">{r.controlText}</span></td>
                    <td className="px-3 py-2 text-[0.625rem] text-text-muted">{r.controlOwner}</td>
                    <td className="px-3 py-2"><span className={`px-1.5 h-4 rounded text-[0.5625rem] font-bold inline-flex items-center ${r.controlType === 'Key' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-canvas text-ink-500'}`}>{r.controlType}</span></td>
                    <td className="px-3 py-2"><span className={`px-1.5 h-4 rounded text-[0.5625rem] font-bold inline-flex items-center ${MAP_STATUS_CLS[r.mappingStatus]}`}>{r.mappingStatus}</span></td>
                    <td className="px-3 py-2">
                      {r.mappingStatus === 'Not Mapped' ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleMapRow(i)}
                            className="px-2 py-0.5 rounded text-[0.5625rem] font-bold text-primary bg-primary/10 hover:bg-primary/15 cursor-pointer transition-colors">Map Control</button>
                          <button onClick={() => { handleMapRow(i); addToast({ message: 'New control created in Control Library', type: 'success' }); }}
                            className="px-2 py-0.5 rounded text-[0.5625rem] font-bold text-brand-700 bg-brand-50 hover:bg-brand-50/80 cursor-pointer transition-colors">Create New</button>
                        </div>
                      ) : (
                        <span className="text-[0.625rem] text-compliant-700 font-medium flex items-center gap-1"><CheckCircle2 size={10} />Done</span>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-border bg-surface-2/30 text-[0.625rem] text-text-muted">
              Source: imported file · {importedRows.length} rows · Source row numbers preserved for traceability
            </div>
          </div>
        </div>
      )}

      {/* Governance notice */}
      <div className="rounded-lg border border-canvas-border bg-canvas px-4 py-3 flex items-start gap-2.5">
        <ShieldCheck size={13} className="text-ink-400 mt-0.5 shrink-0" />
        <p className="text-[0.6875rem] text-ink-400 leading-relaxed">
          RACM is the governance mapping layer — it defines which risks are mitigated by which controls and how they will be tested.
          It does not contain samples, evidence, or testing conclusions. Those belong to the Execution tab.
        </p>
      </div>

      {/* Import RACM Drawer */}
      <AnimatePresence>
        {showImportDrawer && (
          <RacmImportDrawer onClose={() => setShowImportDrawer(false)} onImport={handleImport} />
        )}
      </AnimatePresence>

      {/* Create RACM Modal */}
      <AnimatePresence>
        {showCreateRacmModal && (
          <CreateRacmModal
            onClose={() => setShowCreateRacmModal(false)}
            onCreate={(newRacm) => {
              setRacmList(prev => [newRacm, ...prev]);
              setShowCreateRacmModal(false);
              addToast({ message: `RACM "${newRacm.name}" created — status: Draft`, type: 'success' });
              logEvent({ action: 'Create', description: `Created RACM "${newRacm.name}"`, module: 'Governance', entity: 'RACM' });
              setSelectedRacmId(newRacm.id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── RACM Setup Workspace ───────────────────────────────────────────────────

interface SetupRisk { id: string; name: string; description: string; process: string; sourceRow: string; }

function RacmSetupWorkspace({ racm, onBack, onStartMapping, onImport }: {
  racm: RacmEntry;
  onBack: () => void;
  onStartMapping: () => void;
  onImport: () => void;
}) {
  const { addToast } = useToast();
  const { can } = useCan();
  const logEvent = useAuditLog();
  const computed = getRacmComputed(racm);
  const statusCls = RACM_STATUS_STYLES[computed.status];

  const [localRisks, setLocalRisks] = useState<SetupRisk[]>([]);
  const [showAddRisk, setShowAddRisk] = useState(false);
  const [riskName, setRiskName] = useState('');
  const [riskDesc, setRiskDesc] = useState('');

  const totalRisks = racm.risks + localRisks.length;

  const kpis = [
    { label: 'Total Risks', value: totalRisks, color: totalRisks > 0 ? 'text-text' : 'text-text-muted' },
    { label: 'Mapped Risks', value: racm.mappedRisks, color: racm.mappedRisks > 0 ? 'text-emerald-700' : 'text-text-muted' },
    { label: 'Unmapped Risks', value: totalRisks - racm.mappedRisks, color: totalRisks > racm.mappedRisks ? 'text-red-600' : 'text-text-muted' },
    { label: 'Controls Linked', value: racm.controls, color: racm.controls > 0 ? 'text-text' : 'text-text-muted' },
    { label: 'Workflow Coverage', value: `${racm.workflowCoverage}%`, color: racm.workflowCoverage >= 80 ? 'text-emerald-700' : racm.workflowCoverage > 0 ? 'text-amber-600' : 'text-text-muted' },
    { label: 'Readiness', value: computed.readiness, color: computed.readiness === 'Ready' ? 'text-emerald-700' : 'text-amber-600' },
  ];

  const handleAddRisk = () => {
    if (!riskName.trim()) return;
    const id = `RSK-${String(100 + localRisks.length + 1).padStart(3, '0')}`;
    setLocalRisks(prev => [...prev, { id, name: riskName, description: riskDesc, process: racm.process, sourceRow: 'Manual' }]);
    setRiskName(''); setRiskDesc(''); setShowAddRisk(false);
    addToast({ message: `Risk "${riskName}" added`, type: 'success' });
    logEvent({ action: 'Create', description: `Added risk "${riskName}" to RACM "${racm.name}"`, module: 'Risk Register', entity: 'Risk' });
  };

  const handleImportRisks = () => {
    // Simulate importing 5 risks from a file
    const imported: SetupRisk[] = [
      { id: 'RSK-IMP-001', name: 'Unauthorized payments without PO', description: 'Payments processed without matching purchase order', process: racm.process, sourceRow: 'Row 2' },
      { id: 'RSK-IMP-002', name: 'Duplicate vendor invoices', description: 'Same invoice submitted and paid twice', process: racm.process, sourceRow: 'Row 3' },
      { id: 'RSK-IMP-003', name: 'Vendor master data manipulation', description: 'Unauthorized changes to vendor bank details', process: racm.process, sourceRow: 'Row 4' },
      { id: 'RSK-IMP-004', name: 'Threshold bypass for approvals', description: 'High-value transactions processed without required approvals', process: racm.process, sourceRow: 'Row 5' },
      { id: 'RSK-IMP-005', name: 'Segregation of duties violation', description: 'Same user creates and approves transactions', process: racm.process, sourceRow: 'Row 6' },
    ];
    setLocalRisks(prev => [...prev, ...imported]);
    addToast({ message: `5 risks imported from file — ready for mapping`, type: 'success' });
    logEvent({ action: 'Create', description: `Imported ${imported.length} risks from file into RACM "${racm.name}"`, module: 'Risk Register', entity: 'Risk' });
  };

  const handleProceedToMapping = () => {
    addToast({ message: `${totalRisks} risks ready — opening mapping workspace`, type: 'info' });
    onStartMapping();
  };

  const isEmpty = totalRisks === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium cursor-pointer transition-colors mb-3">
          <ArrowLeft size={14} />Back to RACM List
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium"><LayoutGrid size={18} className="text-white" /></div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[1rem] font-bold text-text">{racm.name}</h2>
              <span className="text-[0.6875rem] font-mono text-ink-400">{racm.version}</span>
              <span className={`px-2 h-5 rounded-full text-[0.625rem] font-semibold inline-flex items-center ${statusCls}`}>{computed.status}</span>
            </div>
            <div className="flex items-center gap-3 text-[0.75rem] text-text-muted mt-0.5">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: BP_DOT_COLORS[racm.process] || '#6B5D82' }} />{racm.process}</span>
              <span>{racm.framework}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="glass-card p-3 text-center">
            <div className={`text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[0.625rem] text-text-muted mt-0.5">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {can('plan_edit') && (
          <button onClick={() => setShowAddRisk(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer">
            <Plus size={13} />Add Risk
          </button>
        )}
        <button onClick={handleImportRisks}
          className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:bg-white transition-colors cursor-pointer">
          <Upload size={13} />Import Risks from File
        </button>
        {totalRisks > 0 && (
          <button onClick={handleProceedToMapping}
            className="flex items-center gap-1.5 px-4 py-2 border border-primary/30 bg-primary/5 rounded-lg text-[0.75rem] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer ml-auto">
            <Target size={13} />Proceed to Mapping
          </button>
        )}
      </div>

      {/* Helper text */}
      <div className="rounded-lg border border-canvas-border bg-canvas px-4 py-3 flex items-start gap-2.5">
        <Info size={13} className="text-primary/60 mt-0.5 shrink-0" />
        <p className="text-[0.6875rem] text-ink-500 leading-relaxed">Define risks first, then map controls to establish risk coverage. Mapping happens in the next step — just create risks here.</p>
      </div>

      {/* Add Risk inline form */}
      <AnimatePresence>
        {showAddRisk && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card p-4 space-y-3">
              <div className="text-[0.75rem] font-bold text-brand-700">Add Risk</div>
              <div>
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1">Risk Name *</label>
                <input value={riskName} onChange={e => setRiskName(e.target.value)} placeholder="e.g. Unauthorized vendor payments"
                  className="w-full px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" autoFocus />
              </div>
              <div>
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1">Risk Description</label>
                <textarea value={riskDesc} onChange={e => setRiskDesc(e.target.value)} rows={2} placeholder="Describe the risk..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none" />
              </div>
              <div className="flex items-center gap-2 text-[0.6875rem] text-ink-400">
                <span>Process: <strong className="text-text">{racm.process}</strong></span>
                <span>·</span>
                <span>ID: auto-generated</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handleAddRisk} disabled={!riskName.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Add Risk</button>
                <button onClick={() => { setShowAddRisk(false); setRiskName(''); setRiskDesc(''); }}
                  className="px-4 py-2 border border-border rounded-lg text-[0.75rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Risks table / empty state */}
      {isEmpty && !showAddRisk ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-10 text-center">
          <AlertTriangle size={36} className="mx-auto text-ink-300 mb-3" />
          <p className="text-[0.9375rem] font-semibold text-ink-600 mb-1">No risks added yet</p>
          <p className="text-[0.8125rem] text-ink-400 mb-5 max-w-md mx-auto">Start by adding risks manually or importing a RACM file with existing risk and control data.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setShowAddRisk(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"><Plus size={14} />Add Risk</button>
            <button onClick={handleImportRisks} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-[0.8125rem] font-medium text-text-secondary hover:bg-white transition-colors cursor-pointer"><Upload size={14} />Import Risks</button>
          </div>
        </motion.div>
      ) : localRisks.length > 0 ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[0.75rem]">
              <thead><tr className="border-b border-border bg-surface-2/50">
                {['ID', 'Risk Name', 'Process', 'Source', 'Status'].map(h =>
                  <th key={h} className="px-3 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase">{h}</th>
                )}
              </tr></thead>
              <tbody>{localRisks.map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-border/40 hover:bg-surface-2/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-[0.6875rem] text-ink-500">{r.id}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-[0.75rem] font-medium text-text">{r.name}</div>
                    {r.description && <div className="text-[0.625rem] text-text-muted truncate max-w-[250px]">{r.description}</div>}
                  </td>
                  <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1 text-[0.6875rem]"><span className="w-1.5 h-1.5 rounded-full" style={{ background: BP_DOT_COLORS[r.process] || '#6B5D82' }} />{r.process}</span></td>
                  <td className="px-3 py-2.5 text-[0.6875rem] text-ink-400">{r.sourceRow}</td>
                  <td className="px-3 py-2.5"><span className="px-1.5 h-4 rounded text-[0.5625rem] font-bold bg-draft-50 text-draft-700 inline-flex items-center">Unmapped</span></td>
                </motion.tr>
              ))}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/30">
            <span className="text-[0.6875rem] text-text-muted">{localRisks.length} risk{localRisks.length !== 1 ? 's' : ''} added</span>
            <button onClick={handleProceedToMapping}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.6875rem] font-semibold transition-colors cursor-pointer">
              <Target size={11} />Proceed to Mapping <ChevronRight size={10} />
            </button>
          </div>
        </div>
      ) : racm.risks > 0 ? (
        <div className="glass-card p-5">
          <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Existing Risks ({racm.risks})</h3>
          <p className="text-[0.75rem] text-ink-400">This RACM has {racm.risks} risks from seed data.</p>
          <button onClick={handleProceedToMapping}
            className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer">
            <Target size={13} />Open Mapping Workspace
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Create RACM Modal ──────────────────────────────────────────────────────

const RACM_PROCESSES = ['P2P', 'O2C', 'R2R', 'S2C', 'ITGC', 'Cross'];
const RACM_AUDIT_TYPES = ['IFC', 'Internal Audit', 'Operational Audit', 'Concurrent Audit', 'ITGC'];
const RACM_FY_OPTIONS = ['FY25', 'FY26', 'FY27'];
const RACM_FRAMEWORKS = ['SOX ICFR', 'ISO 27001', 'Internal Policy', 'Custom'];

function CreateRacmModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: RacmEntry) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [process, setProcess] = useState('P2P');
  const [auditType, setAuditType] = useState('');
  const [financialYear, setFinancialYear] = useState('FY26');
  const [framework, setFramework] = useState('');
  const [owner, setOwner] = useState('Current User');

  const isValid = name.trim().length > 0 && auditType !== '' && financialYear !== '' && owner.trim().length > 0;

  const handleCreate = () => {
    if (!isValid) return;
    onCreate({
      id: `racm-${Date.now()}`,
      name,
      version: 'v1.0',
      process,
      framework: framework || auditType,
      risks: 0,
      controls: 0,
      mappedRisks: 0,
      unmappedRisks: 0,
      keyControls: 0,
      workflowCoverage: 0,
      attributesCoverage: 0,
      isValidated: false,
      linkedToEngagement: false,
    });
  };

  const fieldCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
  const labelCls = 'text-[0.75rem] font-semibold text-text-muted block mb-1.5';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-xl border border-canvas-border w-full max-w-[480px] flex flex-col" onClick={e => e.stopPropagation()}>

          <div className="px-6 pt-5 pb-4 border-b border-canvas-border flex items-start justify-between">
            <div>
              <h2 className="text-[1.125rem] font-semibold text-ink-900">Create RACM</h2>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Define a new Risk & Control Matrix for audit governance.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ maxHeight: 480 }}>
            {/* Section 1: Basic Info */}
            <div className="space-y-3">
              <h3 className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">Basic Info</h3>
              <div>
                <label className={labelCls}>RACM Name <span className="text-red-400">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FY26 P2P — Vendor Payment" className={fieldCls} autoFocus />
              </div>
              <div>
                <label className={labelCls}>Description <span className="font-normal text-ink-400">(optional)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Brief description of scope..." className={fieldCls + ' resize-none'} />
              </div>
            </div>

            {/* Section 2: Audit Context */}
            <div className="space-y-3">
              <h3 className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">Audit Context</h3>
              <div>
                <label className={labelCls}>Business Process <span className="text-red-400">*</span></label>
                <select value={process} onChange={e => setProcess(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                  {RACM_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Audit Type <span className="text-red-400">*</span></label>
                  <select value={auditType} onChange={e => setAuditType(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                    <option value="">Select audit type...</option>
                    {RACM_AUDIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Financial Year <span className="text-red-400">*</span></label>
                  <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                    {RACM_FY_OPTIONS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Framework <span className="font-normal text-ink-400">(optional)</span></label>
                <select value={framework} onChange={e => setFramework(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none'}>
                  <option value="">Select framework...</option>
                  {RACM_FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Section 3: Ownership */}
            <div className="space-y-3">
              <h3 className="text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">Ownership</h3>
              <div>
                <label className={labelCls}>RACM Owner <span className="text-red-400">*</span></label>
                <input value={owner} onChange={e => setOwner(e.target.value)} className={fieldCls} />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-canvas-border text-[0.8125rem] font-medium text-ink-600 hover:bg-canvas transition-colors cursor-pointer">Cancel</button>
            <button onClick={handleCreate} disabled={!isValid}
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              Create RACM
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

// ─── Gantt Tooltip ───────────────────────────────────────────────────────────

function GanttTooltip({ item, position }: { item: AuditEngagement; position: { x: number; y: number } }) {
  const startMonth = MONTHS[item.start];
  const endMonth = MONTHS[(item.start + item.duration - 1) % 12];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[60] pointer-events-none"
      style={{ left: position.x + 12, top: position.y - 8 }}
    >
      <div className="glass-card-strong rounded-xl p-3 shadow-xl min-w-[240px]">
        <div className="text-[0.75rem] font-bold text-text mb-1.5">{item.name}</div>
        <div className="space-y-1">
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">Type / Framework</span>
            <span className="text-text font-medium">{item.auditType} / {item.framework}</span>
          </div>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">Owner</span>
            <span className="text-text font-medium">{item.owner}</span>
          </div>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">Duration</span>
            <span className="text-text font-medium">{item.duration} months ({startMonth} — {endMonth})</span>
          </div>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">Controls</span>
            <span className="text-text font-medium">{item.controls}</span>
          </div>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">RACM Version</span>
            <span className="text-text font-medium">{item.sourceRacmVersionId}</span>
          </div>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">Status</span>
            <span className={`font-bold px-1.5 py-0.5 rounded-full ${lifecycleTone(item.status)}`}>{lifecycleLabel(item.status)}</span>
          </div>
          <div className="flex justify-between text-[0.75rem]">
            <span className="text-text-muted">Priority</span>
            <span className={`font-bold ${
              item.priority === 'Critical' ? 'text-risk-700' :
              item.priority === 'High' ? 'text-high-700' :
              item.priority === 'Medium' ? 'text-mitigated-700' :
              'text-compliant-700'
            }`}>{item.priority}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Gantt Chart ─────────────────────────────────────────────────────────────

function GanttChart({
  items, frozen, onClickEngagement, processFilter, statusFilter,
}: {
  items: AuditEngagement[];
  frozen: boolean;
  onClickEngagement: (item: AuditEngagement) => void;
  processFilter: string;
  statusFilter: string;
}) {
  const totalMonths = 12;
  const currentMonth = getCurrentMonth();
  const [hoveredItem, setHoveredItem] = useState<AuditEngagement | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const filtered = items.filter(item => {
    if (processFilter !== 'All' && item.businessProcess !== processFilter) return false;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Active' && !isExecutionPhase(item.status)) return false;
      if (statusFilter === 'Planned' && !['draft', 'planned', 'frozen', 'signed-off'].includes(item.status)) return false;
    }
    return true;
  });

  return (
    <div className="glass-card p-5 overflow-hidden">
      <div className="relative">
        {/* Month headers */}
        <div className="flex border-b border-border-light pb-2 mb-3">
          {MONTHS.map((m, i) => (
            <div
              key={m}
              className={`flex-1 text-center text-[0.75rem] font-semibold ${
                i === currentMonth ? 'text-primary' : 'text-text-muted'
              }`}
            >
              {m}
            </div>
          ))}
        </div>

        {/* Current month indicator */}
        <div
          className="absolute top-0 bottom-0 w-px bg-primary/30 z-10"
          style={{ left: `${((currentMonth + 0.8) / totalMonths) * 100}%` }}
        >
          <div className="absolute -top-1 -translate-x-1/2 w-2 h-2 rounded-full bg-primary" />
        </div>

        {/* Bars */}
        <div className="space-y-2 relative">
          {filtered.map((item, idx) => (
            <div key={item.id} className="relative h-9 flex items-center">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.duration / totalMonths) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.2 + idx * 0.05 }}
                className={`absolute h-7 rounded-lg shadow-sm flex items-center px-2 transition-all ${
                  frozen ? 'cursor-pointer' : 'cursor-pointer hover:shadow-md hover:brightness-110'
                }`}
                style={{
                  left: `${(item.start / totalMonths) * 100}%`,
                  background: `linear-gradient(135deg, ${item.color}dd, ${item.color}99)`,
                }}
                onClick={() => onClickEngagement(item)}
                onMouseEnter={(e) => {
                  setHoveredItem(item);
                  setMousePos({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <span className="text-white text-[0.75rem] font-semibold truncate drop-shadow-sm">
                  {item.name}
                </span>
                {item.engagementSnapshotId && (
                  <div className="ml-auto shrink-0 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center" title="Snapshot created">
                    <Copy size={8} className="text-white" />
                  </div>
                )}
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredItem && <GanttTooltip item={hoveredItem} position={mousePos} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Milestones ──────────────────────────────────────────────────────────────

function MilestonesStrip() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3">
      <div className="glass-card px-5 py-3">
        <div className="flex items-center">
          {MILESTONES.map((ms, i) => {
            const Icon = ms.icon;
            return (
              <div key={ms.label} className="flex items-center" style={{ marginLeft: i === 0 ? `${(ms.month / 12) * 100}%` : `${((ms.month - MILESTONES[i - 1].month) / 12) * 100 - 3}%` }}>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/5 border border-primary/10">
                  <Icon size={11} className="text-primary" />
                  <span className="text-[0.75rem] font-medium text-primary whitespace-nowrap">{ms.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Lifecycle Stepper ───────────────────────────────────────────────────────

function LifecycleStepper({ status }: { status: EngagementLifecycle }) {
  const planningSteps: EngagementLifecycle[] = ['draft', 'planned', 'frozen', 'signed-off'];
  const executionSteps: EngagementLifecycle[] = ['active', 'in-progress', 'pending-review', 'closed'];
  const currentIdx = LIFECYCLE_ORDER.indexOf(status);

  return (
    <div className="mb-4">
      <div className="text-[0.625rem] font-bold text-text-muted uppercase mb-2">Lifecycle</div>
      <div className="flex gap-1">
        {[...planningSteps, ...executionSteps].map((step, i) => {
          const isActive = step === status;
          const isPast = LIFECYCLE_ORDER.indexOf(step) < currentIdx;

          return (
            <div key={step} className="flex items-center gap-1">
              {i === 4 && <div className="w-px h-5 bg-border-light mx-1" />}
              <div className={`px-2 py-1 rounded-md text-[0.625rem] font-semibold transition-all ${
                isActive ? lifecycleTone(step) + ' ring-1 ring-current/20' :
                isPast ? 'bg-compliant-50/60 text-compliant-700/60' :
                'bg-paper-50 text-ink-400'
              }`}>
                {lifecycleLabel(step)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Engagement Drawer (Upgraded) ────────────────────────────────────────────

function EngagementDrawer({
  engagement, isCreate, frozen, onClose, onSave, onDelete, onActivate, onViewExecution,
}: {
  engagement: AuditEngagement;
  isCreate: boolean;
  frozen: boolean;
  onClose: () => void;
  onSave: (updated: AuditEngagement) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
  onViewExecution?: (id: string) => void;
}) {
  const [form, setForm] = useState<AuditEngagement>({ ...engagement });

  const update = <K extends keyof AuditEngagement>(key: K, value: AuditEngagement[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const readOnly = frozen && !isCreate;
  const canActivate = form.status === 'signed-off' && !isCreate;
  const isInExecution = isExecutionPhase(form.status);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[460px] z-50 glass-card-strong border-l border-border-light shadow-2xl overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.9375rem] font-bold text-text">
              {isCreate ? 'Create Engagement' : isInExecution ? 'Engagement Detail' : 'Edit Engagement'}
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer">
              <X size={16} className="text-text-muted" />
            </button>
          </div>

          {/* Lifecycle stepper */}
          {!isCreate && <LifecycleStepper status={form.status} />}

          {/* Frozen banner */}
          {readOnly && !isInExecution && (
            <div className="flex items-center gap-2.5 p-3 bg-evidence-50 rounded-xl mb-4 border border-evidence">
              <Lock size={14} className="text-evidence-700 shrink-0" />
              <span className="text-[0.75rem] text-evidence-700 font-medium">Plan is frozen — fields are read-only.</span>
            </div>
          )}

          {/* Execution banner + RACM lock */}
          {isInExecution && (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-compliant-50 rounded-xl border border-compliant">
                <div className="flex items-center gap-2.5">
                  <Play size={14} className="text-compliant-700 shrink-0" />
                  <div>
                    <span className="text-[0.75rem] text-compliant-700 font-semibold block">In Execution</span>
                    <span className="text-[0.6875rem] text-compliant-700/80">Snapshot: {form.engagementSnapshotId || '—'}</span>
                  </div>
                </div>
              {onViewExecution && (
                <button onClick={() => onViewExecution(form.id)} className="px-3 py-1.5 bg-compliant hover:brightness-110 text-white rounded-lg text-[0.6875rem] font-semibold transition-all cursor-pointer flex items-center gap-1.5">
                  <ArrowRight size={11} />
                  Open Hub
                </button>
              )}
              </div>
              {/* RACM Lock Badge */}
              <div className="flex items-center gap-2.5 p-3 bg-brand-50/50 rounded-xl border border-brand-100">
                <Lock size={13} className="text-brand-700 shrink-0" />
                <div className="flex-1">
                  <span className="text-[0.6875rem] font-semibold text-brand-700">Snapshot locked from {form.sourceRacmVersionId}</span>
                  <p className="text-[0.625rem] text-brand-600 mt-0.5">RACM, audit period, and control scope are immutable during execution.</p>
                </div>
              </div>
              {/* Scope change warning */}
              <div className="flex items-start gap-2 p-2.5 bg-surface-2/50 rounded-lg">
                <AlertTriangle size={11} className="text-text-muted mt-0.5 shrink-0" />
                <p className="text-[0.625rem] text-text-muted">Scope changes require creating a new RACM version and new engagement snapshot.</p>
              </div>
            </div>
          )}

          {/* Activation CTA */}
          {canActivate && (
            <button
              onClick={() => onActivate(form.id)}
              className="w-full flex items-center justify-center gap-2 py-3 mb-4 bg-gradient-to-r from-primary to-primary-medium hover:brightness-110 text-white rounded-xl text-[0.8125rem] font-bold transition-all cursor-pointer"
            >
              <Zap size={14} />
              Activate Engagement
            </button>
          )}

          {/* ── Fields ── */}
          <div className="space-y-0">
            {/* Name */}
            <div className="mb-3">
              <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Engagement Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                disabled={readOnly || isInExecution}
                placeholder="e.g., P2P — SOX Audit FY26"
                className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all ${
                  (readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white'
                }`}
              />
            </div>

            {/* Audit Type */}
            <div className="mb-3">
              <Dropdown<AuditType>
                label="Audit Type *"
                value={form.auditType}
                options={AUDIT_TYPES}
                onChange={(v) => update('auditType', v)}
                disabled={readOnly || isInExecution}
              />
              <p className="text-[0.625rem] text-text-muted mt-0.5 px-1">Audit type defines the nature of the audit.</p>
            </div>

            {/* Framework / Compliance Scope */}
            <div className="mb-3">
              <Dropdown<FrameworkType>
                label="Framework / Compliance Scope *"
                value={form.framework}
                options={FRAMEWORKS}
                onChange={(v) => update('framework', v)}
                disabled={readOnly || isInExecution}
              />
              <p className="text-[0.625rem] text-text-muted mt-0.5 px-1">Framework defines the compliance or assurance standard.</p>
            </div>

            {/* SOX Enforcement Panel */}
            <div className={`mb-3 rounded-xl border px-4 py-3 ${form.framework === 'SOX ICFR' ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface-2/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[0.6875rem] font-bold text-text-muted uppercase">SOX Enforcement</span>
                {form.framework === 'SOX ICFR' ? (
                  <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-bold bg-brand-100 text-brand-700">Enabled</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-medium bg-canvas text-ink-500">Disabled</span>
                )}
              </div>
              {form.framework === 'SOX ICFR' ? (
                <p className="text-[0.625rem] text-brand-700 leading-relaxed">Reviewer approval, evidence requirements, key-control validation, and period locking will be enforced.</p>
              ) : (
                <p className="text-[0.625rem] text-text-muted leading-relaxed">Standard engagement rules will apply.</p>
              )}
              <p className="text-[0.5625rem] text-text-muted mt-1 italic">SOX enforcement is driven by framework, not audit type.</p>
            </div>

            {/* Primary Business Process / Domain */}
            <div className="mb-3">
              <Dropdown<ProcessType>
                label="Primary Business Process / Domain *"
                value={form.businessProcess}
                options={PROCESSES}
                onChange={(v) => update('businessProcess', v)}
                disabled={readOnly || isInExecution}
              />
              <p className="text-[0.625rem] text-text-muted mt-0.5 px-1">Used for planning and filtering. Execution scope comes from linked RACM.</p>
            </div>

            {/* Audit Period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="mb-3">
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Audit Period Start *</label>
                <DatePicker value={form.auditPeriodStart} onChange={e => update('auditPeriodStart', e.target.value)}
                  disabled={readOnly || isInExecution}
                  className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all ${(readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white'}`}
                />
              </div>
              <div className="mb-3">
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Audit Period End *</label>
                <DatePicker value={form.auditPeriodEnd} onChange={e => update('auditPeriodEnd', e.target.value)}
                  disabled={readOnly || isInExecution}
                  className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all ${(readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white'}`}
                />
              </div>
            </div>

            {/* Planned Start/End */}
            <div className="grid grid-cols-2 gap-3">
              <div className="mb-3">
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Planned Start *</label>
                <DatePicker value={form.plannedStartDate} onChange={e => update('plannedStartDate', e.target.value)}
                  disabled={readOnly || isInExecution}
                  className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all ${(readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white'}`}
                />
              </div>
              <div className="mb-3">
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Planned End *</label>
                <DatePicker value={form.plannedEndDate} onChange={e => update('plannedEndDate', e.target.value)}
                  disabled={readOnly || isInExecution}
                  className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all ${(readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white'}`}
                />
              </div>
            </div>

            {/* Actual dates (read-only, shown only in execution) */}
            {isInExecution && (
              <div className="grid grid-cols-2 gap-3">
                <div className="mb-3">
                  <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Actual Start</label>
                  <div className="px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] bg-surface-2 text-text-secondary">
                    {formatDate(form.actualStartDate)}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Actual End</label>
                  <div className="px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] bg-surface-2 text-text-secondary">
                    {formatDate(form.actualEndDate)}
                  </div>
                </div>
              </div>
            )}

            {/* Owner & Reviewer */}
            <div className="grid grid-cols-2 gap-3">
              <Dropdown<string>
                label="Owner *"
                value={form.owner}
                options={TEAM_MEMBERS.map(m => m.name)}
                onChange={(v) => update('owner', v)}
                disabled={readOnly || isInExecution}
              />
              <Dropdown<string>
                label="Reviewer *"
                value={form.reviewer}
                options={[...TEAM_MEMBERS.map(m => m.name), 'Abhinav S']}
                onChange={(v) => update('reviewer', v)}
                disabled={readOnly || isInExecution}
              />
            </div>

            {/* RACM Version */}
            <div className="mb-3">
              <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">RACM Version *</label>
              <div className="relative">
                <Dropdown<string>
                  label=""
                  value={RACM_VERSIONS.find(r => r.id === form.sourceRacmVersionId)?.label || form.sourceRacmVersionId}
                  options={RACM_VERSIONS.map(r => r.label)}
                  onChange={(v) => {
                    const found = RACM_VERSIONS.find(r => r.label === v);
                    if (found) update('sourceRacmVersionId', found.id);
                  }}
                  disabled={readOnly || isInExecution}
                />
              </div>
            </div>

            {/* Snapshot info (if exists) */}
            {form.engagementSnapshotId && (
              <div className="mb-3 p-3 bg-brand-50/50 rounded-xl border border-brand-100">
                <div className="flex items-center gap-2 mb-1">
                  <Copy size={12} className="text-brand-600" />
                  <span className="text-[0.6875rem] font-bold text-brand-700 uppercase">Engagement Snapshot</span>
                </div>
                <div className="text-[0.75rem] text-brand-700 font-mono">{form.engagementSnapshotId}</div>
                <div className="text-[0.6875rem] text-brand-600 mt-0.5">Immutable copy of RACM {form.sourceRacmVersionId} created at activation</div>
              </div>
            )}

            {/* Gantt positioning */}
            <div className="grid grid-cols-2 gap-3">
              <Dropdown<string>
                label="Start Month"
                value={MONTHS[form.start]}
                options={MONTHS}
                onChange={(v) => update('start', MONTHS.indexOf(v))}
                disabled={readOnly || isInExecution}
              />
              <div className="mb-3">
                <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Duration (months)</label>
                <input type="number" min={1} max={12} value={form.duration}
                  onChange={(e) => update('duration', Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                  disabled={readOnly || isInExecution}
                  className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all ${(readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white'}`}
                />
              </div>
            </div>

            {/* Priority & Risk Score — hidden from create form */}

            {/* Description */}
            <div className="mb-3">
              <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                disabled={readOnly || isInExecution}
                placeholder="Describe the scope and objectives of this engagement..."
                className={`w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none h-24 ${
                  (readOnly || isInExecution) ? 'bg-surface-2 text-text-muted cursor-not-allowed' : 'bg-white placeholder:text-text-muted/50'
                }`}
              />
            </div>
          </div>

          {/* Actions */}
          {!(readOnly || isInExecution) && (
            <div className="mt-5 pt-4 border-t border-border-light">
              <button
                onClick={() => onSave(form)}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.8125rem] font-semibold transition-colors cursor-pointer mb-3"
              >
                {isCreate ? 'Create Engagement' : 'Save Changes'}
              </button>
              {!isCreate && (
                <button
                  onClick={() => onDelete(form.id)}
                  className="w-full py-2 text-risk-700 hover:bg-risk-50 rounded-xl text-[0.75rem] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Remove from Plan
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Modal Backdrop ──────────────────────────────────────────────────────────

function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-border-light max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Activation Modal (proper component — no IIFE) ──────────────────────────

function ActivationModal({ engagement, activating, activationError, activationLog, activationSteps, onConfirm, onClose, getBlockers }: {
  engagement: AuditEngagement | undefined;
  activating: boolean;
  activationError: string | null;
  activationLog: string[];
  activationSteps: string[];
  onConfirm: () => void;
  onClose: () => void;
  getBlockers: (eng: AuditEngagement) => { blocking: string[]; warnings: string[] };
}) {
  if (!engagement) return null;

  const blockers = getBlockers(engagement);
  const hasBlockers = blockers.blocking.length > 0;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        {!activating ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium"><Lock size={16} className="text-white" /></div>
                <h3 className="text-[0.9375rem] font-bold text-text">Activate Engagement?</h3>
              </div>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"><X size={16} className="text-text-muted" /></button>
            </div>

            {activationError && (
              <div className="flex items-start gap-2.5 p-3 bg-risk-50 rounded-xl mb-4 border border-risk/30">
                <XCircle size={14} className="text-risk-700 mt-0.5 shrink-0" />
                <p className="text-[0.75rem] text-risk-700 font-medium">{activationError}</p>
              </div>
            )}

            {hasBlockers ? (
              <div className="p-3 bg-risk-50/50 rounded-xl mb-4 border border-risk/20">
                <p className="text-[0.6875rem] font-bold text-risk-700 uppercase mb-2">Activation Blocked</p>
                <div className="space-y-1">
                  {blockers.blocking.map(b => (
                    <div key={b} className="flex items-center gap-2 text-[0.6875rem] text-risk-700"><XCircle size={11} className="shrink-0" /><span>{b}</span></div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-compliant-50/30 rounded-xl mb-4 border border-compliant/20">
                <p className="text-[0.625rem] font-bold text-compliant-700 uppercase mb-1.5">All pre-flight checks passed</p>
                <div className="grid grid-cols-2 gap-1">
                  {['RACM linked', 'Owner assigned', 'Reviewer assigned', 'Period defined', 'Dates set', 'Controls mapped', 'Workflows available'].map(item => (
                    <div key={item} className="flex items-center gap-1.5 text-[0.625rem] text-compliant-700"><CheckCircle2 size={10} />{item}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Activating this engagement will:</p>
              <div className="space-y-1.5">
                {[
                  `Create an immutable Engagement Snapshot from ${engagement.sourceRacmVersionId}`,
                  'Lock the engagement scope — RACM changes will not affect this engagement',
                  `Create execution records for ${engagement.controls} in-scope controls`,
                  'Initialize test instances (Ready if workflow linked, Not Configured otherwise)',
                  'Enable population upload, sampling, evidence, testing, working paper, and review',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2 text-[0.6875rem]">
                    <ChevronRight size={10} className="text-primary mt-0.5 shrink-0" />
                    <span className="text-text-secondary">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-surface-2 rounded-xl mb-4 text-[0.75rem] space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">Engagement</span><span className="font-medium text-text">{engagement.name}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">RACM Version</span><span className="font-medium text-text">{engagement.sourceRacmVersionId}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Controls</span><span className="font-medium text-text">{engagement.controls}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Owner</span><span className="font-medium text-text">{engagement.owner}</span></div>
            </div>

            <div className="flex items-start gap-2.5 p-3 bg-high-50/50 rounded-xl mb-5 border border-high/20">
              <AlertTriangle size={14} className="text-high-700 mt-0.5 shrink-0" />
              <p className="text-[0.6875rem] text-high-700">This action cannot be undone. The snapshot is immutable and scope changes require a new engagement.</p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-[0.75rem] font-medium text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">Cancel</button>
              <button onClick={onConfirm} disabled={hasBlockers}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-medium hover:brightness-110 text-white rounded-xl text-[0.8125rem] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                <Zap size={14} />Confirm Activation
              </button>
            </div>
          </>
        ) : (
          <div className="py-6">
            <div className="text-center mb-5">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="mx-auto mb-3 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-medium flex items-center justify-center">
                <Zap size={20} className="text-white" />
              </motion.div>
              <h3 className="text-[0.9375rem] font-bold text-text">Activating Engagement</h3>
              <p className="text-[0.6875rem] text-text-muted mt-1">{engagement.name}</p>
            </div>
            <div className="space-y-2 max-w-sm mx-auto mb-4">
              {activationSteps.map((step, i) => (
                <motion.div key={step} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.4 }}
                  className="flex items-center gap-3 text-[0.75rem]">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.4 + 0.3 }}>
                    <CheckCircle2 size={14} className="text-compliant-700" />
                  </motion.div>
                  <span className={i === activationSteps.length - 1 ? 'font-bold text-compliant-700' : 'text-text-secondary'}>{step}</span>
                </motion.div>
              ))}
            </div>
            {activationLog.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="max-w-sm mx-auto p-3 bg-surface-2/50 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-[0.5625rem] font-bold text-text-muted uppercase mb-1">Audit Log</p>
                {activationLog.map((entry, i) => (
                  <p key={i} className="text-[0.5625rem] font-mono text-text-muted leading-relaxed">{entry}</p>
                ))}
              </motion.div>
            )}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: activationSteps.length * 0.4 + 0.5 }}
              className="text-[0.625rem] text-text-muted text-center mt-3">Redirecting to execution workspace...</motion.p>
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  onNavigateToExecution?: (engagementId: string) => void;
  /** When true, hides header/KPIs/attention — used when embedded inside Programs */
  embedded?: boolean;
}

export default function AuditPlanningView({ onNavigateToExecution, embedded = false }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [plan, setPlan] = useState<AuditEngagement[]>(INITIAL_AUDIT_PLAN);
  const [planFrozen, setPlanFrozen] = useState(false);
  const [signedOff, setSignedOff] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState<string | null>(null);
  const [selectedSigner, setSelectedSigner] = useState(SIGNERS[0]);
  const [signOffComment, setSignOffComment] = useState('');
  const [signerDropdownOpen, setSignerDropdownOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('execution');
  const [processFilter, setProcessFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [drawerEngagement, setDrawerEngagement] = useState<AuditEngagement | null>(null);
  const [drawerIsCreate, setDrawerIsCreate] = useState(false);
  const [setupPanelEngagement, setSetupPanelEngagement] = useState<AuditEngagement | null>(null);
  const [engFilter, setEngFilter] = useState('all');
  const [engSearch, setEngSearch] = useState('');
  const [expandedEngId, setExpandedEngId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationLog, setActivationLog] = useState<string[]>([]);
  const activationSteps = [
    'Creating Engagement Snapshot...',
    'Freezing risk & control mapping...',
    'Binding workflows to controls...',
    'Initializing test instances...',
    'Setting control execution states...',
    'Writing audit log...',
    'Activation complete!',
  ];

  // Full activation validation
  function getActivationBlockers(eng: AuditEngagement): { blocking: string[]; warnings: string[] } {
    const blocking: string[] = [];
    const warnings: string[] = [];
    if (!eng.sourceRacmVersionId) blocking.push('No RACM version linked');
    if (eng.controls === 0) blocking.push('No controls mapped');
    if (!eng.auditPeriodStart || !eng.auditPeriodEnd) blocking.push('Audit period not defined');
    if (!eng.owner) blocking.push('Owner not assigned');
    if (!eng.reviewer) blocking.push('Reviewer not assigned');
    if (!eng.plannedStartDate || !eng.plannedEndDate) blocking.push('Planned dates not set');
    // Workflow warning (non-blocking) — in demo all controls have workflows, but simulate the check
    // If any controls lacked workflows, they'd enter as "Not Configured"
    return { blocking, warnings };
  }

  const handleFreeze = () => setShowFreezeModal(true);

  const confirmFreeze = () => {
    setPlanFrozen(true);
    // Move all draft/planned engagements to frozen
    setPlan(prev => prev.map(p =>
      ['draft', 'planned'].includes(p.status) ? { ...p, status: 'frozen' as EngagementLifecycle } : p
    ));
    setShowFreezeModal(false);
    addToast({ type: 'success', message: 'Audit plan frozen — scheduling locked' });
    logEvent({ action: 'Update', description: 'Froze audit plan', module: 'Engagements', entity: 'Audit Plan' });
  };

  const handleSignOff = () => {
    if (signedOff) return;
    setShowSignOffModal(true);
  };

  const confirmSignOff = () => {
    setSignedOff(true);
    // Move frozen engagements to signed-off
    setPlan(prev => prev.map(p =>
      p.status === 'frozen' ? { ...p, status: 'signed-off' as EngagementLifecycle } : p
    ));
    setShowSignOffModal(false);
    setSignOffComment('');
    addToast({ type: 'success', message: 'Audit plan signed off — engagements ready for activation' });
    logEvent({ action: 'Update', description: 'Signed off audit plan', module: 'Engagements', entity: 'Audit Plan' });
  };

  const handleActivate = (id: string) => {
    setShowActivateModal(id);
  };

  const confirmActivate = (directId?: string) => {
    const engId = directId || showActivateModal;
    if (!engId) { console.warn('confirmActivate: no engId'); return; }
    const eng = plan.find(p => p.id === engId);
    if (!eng) { console.warn('confirmActivate: engagement not found:', engId); return; }

    console.log('Activation started —', eng.name, engId);

    // Full pre-flight validation
    const { blocking } = getActivationBlockers(eng);
    if (blocking.length > 0) {
      console.warn('Activation blocked:', blocking);
      setActivationError(`Activation blocked: ${blocking.join(', ')}. Please resolve and try again.`);
      return;
    }

    setActivationError(null);
    setActivationLog([]);
    setActivating(true);

    const now = new Date();
    const snapshotId = `SNAP-${engId.toUpperCase()}-${now.getTime().toString(36).toUpperCase()}`;
    console.log('Snapshot ID:', snapshotId);

    // Build audit log entries as activation progresses
    const logEntries = [
      `[${now.toISOString()}] engagement_activation_started — ${eng.name} (${engId})`,
      `[${now.toISOString()}] engagement_snapshot_created — ${snapshotId} from ${eng.sourceRacmVersionId}`,
      `[${now.toISOString()}] racm_scope_frozen — ${eng.controls} controls locked`,
      `[${now.toISOString()}] test_instances_initialized — ${eng.controls} instances created`,
      `[${now.toISOString()}] control_states_set — Ready: ${eng.controls}, Not Configured: 0`,
      `[${now.toISOString()}] audit_log_written — 6 events recorded`,
      `[${now.toISOString()}] engagement_activated — ${eng.name} is now Active`,
    ];

    // Simulate progressive log writing
    logEntries.forEach((entry, i) => {
      setTimeout(() => setActivationLog(prev => [...prev, entry]), i * 400 + 200);
    });

    // After animation completes, apply all mutations
    const totalDelay = activationSteps.length * 400 + 500;
    console.log(`Activation pipeline running — will complete in ${totalDelay}ms`);

    setTimeout(() => {
      try {
        console.log('Snapshot created:', snapshotId);

        setPlan(prev => prev.map(p => {
          if (p.id !== engId) return p;
          return {
            ...p,
            status: 'active' as EngagementLifecycle,
            engagementSnapshotId: snapshotId,
            actualStartDate: now.toISOString().split('T')[0],
            controlsTested: 0,
            controlsEffective: 0,
            controlsFailed: 0,
            pendingReview: 0,
            riskStatus: 'unvalidated' as RiskStatus,
            isOverdue: false,
            lastActivity: 'Just now',
          };
        }));

        console.log('Controls initialized — all set to Ready');
        console.log('Activation completed —', eng.name);

        setActivating(false);
        setShowActivateModal(null);
        setDrawerEngagement(null);
        setSetupPanelEngagement(null);

        addToast({
          type: 'success',
          message: 'Engagement activated successfully. Execution workspace is ready.',
        });

        // Redirect to execution dashboard
        if (onNavigateToExecution) {
          console.log('Redirecting to execution hub...');
          setTimeout(() => onNavigateToExecution(engId), 300);
        }
      } catch (err) {
        // Rollback: engagement stays in its previous state (no mutation applied)
        console.error('Activation failed:', err);
        setActivating(false);
        setActivationError('Activation failed. Engagement remains in Planned state. Please try again.');
        setActivationLog(prev => [...prev, `[${new Date().toISOString()}] engagement_activation_failed — rollback, status unchanged`]);
        addToast({ type: 'error', message: 'Activation failed. Please try again.' });
      }
    }, totalDelay);
  };

  const openEditDrawer = (item: AuditEngagement) => {
    // Route based on lifecycle state
    if (item.status === 'draft' || item.status === 'planned' || item.status === 'frozen' || item.status === 'signed-off') {
      setSetupPanelEngagement(item);
      return;
    }
    // Active/execution engagements go to hub
    if (isExecutionPhase(item.status) && onNavigateToExecution) {
      onNavigateToExecution(item.id);
      return;
    }
    // Fallback to drawer
    setDrawerEngagement(item);
    setDrawerIsCreate(false);
  };

  const openCreateDrawer = () => {
    const newId = `ap-${Date.now()}`;
    const colorIdx = plan.length % COLOR_PALETTE.length;
    setDrawerEngagement({
      id: newId,
      name: '',
      auditType: 'Financial Internal Control',
      framework: 'SOX ICFR',
      businessProcess: 'P2P',
      auditPeriodStart: '2025-04-01',
      auditPeriodEnd: '2026-03-31',
      plannedStartDate: '',
      plannedEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      owner: TEAM_MEMBERS[0].name,
      reviewer: TEAM_MEMBERS[3].name,
      description: '',
      sourceRacmVersionId: 'racm-v2.1',
      engagementSnapshotId: null,
      status: 'draft',
      controls: 0,
      plannedHours: 0,
      priority: 'Medium',
      riskScore: 50,
      controlsTested: 0,
      controlsEffective: 0,
      controlsFailed: 0,
      pendingReview: 0,
      riskStatus: 'unvalidated',
      isOverdue: false,
      lastActivity: '—',
      start: 0,
      duration: 3,
      color: COLOR_PALETTE[colorIdx],
    });
    setDrawerIsCreate(true);
  };

  const handleSaveEngagement = (updated: AuditEngagement) => {
    if (drawerIsCreate) {
      setPlan(prev => [...prev, updated]);
      addToast({ type: 'success', message: `"${updated.name}" created as Draft` });
      logEvent({ action: 'Create', description: `Created engagement "${updated.name}" as Draft`, module: 'Engagements', entity: 'Engagement' });
    } else {
      setPlan(prev => prev.map(p => p.id === updated.id ? updated : p));
      addToast({ type: 'success', message: `"${updated.name}" updated` });
      logEvent({ action: 'Update', description: `Updated engagement "${updated.name}"`, module: 'Engagements', entity: 'Engagement' });
    }
    setDrawerEngagement(null);
  };

  const handleMoveToPlanned = (id: string) => {
    const item = plan.find(p => p.id === id);
    setPlan(prev => prev.map(p => p.id === id ? { ...p, status: 'planned' as EngagementLifecycle } : p));
    setSetupPanelEngagement(null);
    addToast({ type: 'success', message: 'Engagement moved to Planned — ready for review and activation' });
    logEvent({ action: 'Update', description: `Moved engagement "${item?.name ?? id}" to Planned`, module: 'Engagements', entity: 'Engagement' });
  };

  const handleSetupActivate = (id: string) => {
    console.log('Setup panel activation requested, id:', id);
    setSetupPanelEngagement(null);
    // Open the activation modal for the user to see progress
    // Use a small delay so the panel closes cleanly before modal opens
    setTimeout(() => {
      setShowActivateModal(id);
    }, 150);
  };

  const handleDeleteEngagement = (id: string) => {
    const item = plan.find(p => p.id === id);
    setPlan(prev => prev.filter(p => p.id !== id));
    addToast({ type: 'warning', message: `"${item?.name}" removed from plan` });
    logEvent({ action: 'Delete', description: `Removed engagement "${item?.name ?? id}" from the audit plan`, module: 'Engagements', entity: 'Engagement' });
    setDrawerEngagement(null);
  };

  const totalControls = plan.reduce((sum, a) => sum + a.controls, 0);
  const uniqueProcesses = new Set(plan.map(a => a.businessProcess)).size;
  const activeCount = plan.filter(p => isExecutionPhase(p.status)).length;

  // Execution KPIs
  const atRiskEngagements = plan.filter(p => p.riskStatus === 'at-risk').length;
  const totalPendingReview = plan.reduce((sum, a) => sum + a.pendingReview, 0);
  const overdueEngagements = plan.filter(p => p.isOverdue).length;
  const onTrackEngagements = plan.filter(p => isExecutionPhase(p.status) && p.riskStatus === 'stable').length;
  const totalFailed = plan.reduce((sum, a) => sum + a.controlsFailed, 0);
  const activeEngagements = plan.filter(p => isExecutionPhase(p.status));

  // Attention items
  const attentionItems: { type: 'overdue' | 'review' | 'failed'; label: string; count: number }[] = [];
  if (overdueEngagements > 0) attentionItems.push({ type: 'overdue', label: 'Overdue engagements', count: overdueEngagements });
  if (totalPendingReview > 0) attentionItems.push({ type: 'review', label: 'Controls pending review', count: totalPendingReview });
  if (totalFailed > 0) attentionItems.push({ type: 'failed', label: 'Failed controls', count: totalFailed });

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'racm', label: 'RACM', icon: LayoutGrid },
    { id: 'execution', label: 'Execution', icon: Zap },
  ];

  const processFilterOptions = ['All', ...PROCESSES.filter(p => p !== 'Cross')];
  const statusFilterOptions = ['All', 'Active', 'Planned'];

  return (
    <div className={`h-full overflow-y-auto ${embedded ? '' : 'bg-white bg-mesh-gradient'} relative`}>
      {!embedded && <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />}

      <div className={embedded ? '' : 'p-8 relative'}>
        {/* Header — hidden when embedded */}
        {!embedded && (
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium text-white">
                  <Calendar size={16} />
                </div>
                <h1 className="text-xl font-bold text-text">Audit Planning</h1>
              </div>
              <p className="text-sm text-text-secondary mt-1 ml-9">FY26 Annual Audit Plan — April 2025 to March 2026</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={openCreateDrawer}
                className="flex items-center gap-1.5 px-3 py-2 border border-primary/30 bg-primary/5 rounded-lg text-[0.75rem] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                Add Engagement
              </button>
            </div>
          </div>
        )}

        {/* KPI Strip — hidden when embedded */}
        {!embedded && (
          <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <KpiCard label="Engagements" value={plan.length} icon={ClipboardList} color="text-primary bg-primary-xlight" index={0} />
            <KpiCard label="In Execution" value={activeCount} icon={Zap} color="text-evidence-700 bg-evidence-50" index={1} />
            <KpiCard label="Total Controls" value={totalControls} icon={ShieldCheck} color="text-compliant-700 bg-compliant-50" index={2} />
            <KpiCard label="On Track" value={onTrackEngagements} icon={CheckCircle2} color="text-compliant-700 bg-compliant-50" index={3} />
            <KpiCard label="Pending Review" value={totalPendingReview} icon={Clock} color="text-mitigated-700 bg-mitigated-50" index={4} />
            <KpiCard label="Overdue" value={overdueEngagements} icon={XCircle} color="text-risk-700 bg-risk-50" index={5} />
            <KpiCard label="Failed Controls" value={totalFailed} icon={XCircle} color="text-high-700 bg-high-50" index={6} />
          </div>
        )}

        {/* Embedded toolbar — New Engagement button when inside Programs */}
        {embedded && (
          <div className="flex items-center justify-between mb-4">
            <div className="text-[0.75rem] text-text-muted">{plan.length} engagement{plan.length !== 1 ? 's' : ''}</div>
            <button onClick={openCreateDrawer}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
              <Plus size={14} />Plan Engagement
            </button>
          </div>
        )}

        {/* Attention Strip — hidden when embedded */}
        {!embedded && attentionItems.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-risk-50/50 border border-risk/20">
              <AlertTriangle size={16} className="text-risk-700 shrink-0" />
              <span className="text-[0.75rem] font-bold text-risk-700">Attention Required:</span>
              <div className="flex items-center gap-4">
                {attentionItems.map(item => (
                  <span key={item.type} className={`text-[0.75rem] font-medium ${
                    item.type === 'overdue' ? 'text-risk-700' : item.type === 'failed' ? 'text-high-700' : 'text-mitigated-700'
                  }`}>
                    {item.count} {item.label}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex items-center border-b border-border-light mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[0.8125rem] font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {activeTab === 'timeline' && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] font-bold text-text-muted">Filter by Primary Process:</span>
              <div className="flex gap-1">
                {processFilterOptions.map(opt => (
                  <button key={opt} onClick={() => setProcessFilter(opt)}
                    className={`px-2.5 py-1 rounded-full text-[0.75rem] font-semibold transition-all cursor-pointer ${
                      processFilter === opt ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                    }`}>{opt}</button>
                ))}
              </div>
            </div>
            <div className="w-px h-5 bg-border-light" />
            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] font-bold text-text-muted">Status:</span>
              <div className="flex gap-1">
                {statusFilterOptions.map(opt => (
                  <button key={opt} onClick={() => setStatusFilter(opt)}
                    className={`px-2.5 py-1 rounded-full text-[0.75rem] font-semibold transition-all cursor-pointer ${
                      statusFilter === opt ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                    }`}>{opt}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* ── RACM TAB ── */}
          {activeTab === 'racm' && (
            <motion.div key="racm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              <RacmDashboard engagements={plan} onGoToExecution={() => setActiveTab('execution')} />
            </motion.div>
          )}

          {/* ── EXECUTION TAB ── */}
          {activeTab === 'execution' && (() => {
            const filterOptions = [
              { key: 'all', label: 'All', count: plan.length },
              { key: 'active', label: 'Active', count: plan.filter(p => isExecutionPhase(p.status)).length },
              { key: 'planned', label: 'Planned', count: plan.filter(p => ['planned', 'frozen', 'signed-off'].includes(p.status)).length },
              { key: 'draft', label: 'Draft', count: plan.filter(p => p.status === 'draft').length },
              { key: 'review', label: 'Pending Review', count: plan.filter(p => p.pendingReview > 0).length },
              { key: 'at-risk', label: 'At Risk', count: plan.filter(p => p.riskStatus === 'at-risk' || p.controlsFailed > 0).length },
            ];

            const filteredPlan = plan.filter(eng => {
              // Search filter
              if (engSearch) {
                const q = engSearch.toLowerCase();
                const matchesSearch = eng.name.toLowerCase().includes(q)
                  || eng.owner.toLowerCase().includes(q)
                  || eng.reviewer.toLowerCase().includes(q)
                  || eng.businessProcess.toLowerCase().includes(q)
                  || getRacmDisplayName(eng).toLowerCase().includes(q);
                if (!matchesSearch) return false;
              }
              // Process filter
              if (processFilter !== 'All' && eng.businessProcess !== processFilter) return false;
              // Status filter
              if (engFilter === 'all') return true;
              if (engFilter === 'active') return isExecutionPhase(eng.status);
              if (engFilter === 'planned') return ['planned', 'frozen', 'signed-off'].includes(eng.status);
              if (engFilter === 'draft') return eng.status === 'draft';
              if (engFilter === 'at-risk') return eng.riskStatus === 'at-risk' || eng.controlsFailed > 0;
              if (engFilter === 'review') return eng.pendingReview > 0;
              return true;
            });

            const getAttention = (eng: AuditEngagement): { label: string; cls: string } => {
              if (eng.isOverdue) return { label: 'Overdue', cls: 'bg-red-50 text-red-700' };
              if (eng.controlsFailed > 0) return { label: 'Failed Controls', cls: 'bg-red-50 text-red-600' };
              if (eng.pendingReview > 0) return { label: 'Needs Review', cls: 'bg-amber-50 text-amber-700' };
              if (!isExecutionPhase(eng.status)) return { label: 'Not Started', cls: 'bg-canvas text-ink-400' };
              if (eng.riskStatus === 'at-risk') return { label: 'At Risk', cls: 'bg-amber-50 text-amber-700' };
              return { label: 'On Track', cls: 'bg-emerald-50 text-emerald-700' };
            };

            const getNextAction = (eng: AuditEngagement): { label: string; cls: string } => {
              if (eng.status === 'draft') return { label: 'Configure', cls: 'bg-canvas text-ink-600 hover:bg-canvas-border/70' };
              if (['planned', 'frozen', 'signed-off'].includes(eng.status)) return { label: 'Activate', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
              if (eng.controlsFailed > 0) return { label: 'View Findings', cls: 'bg-red-50 text-red-700 hover:bg-red-100/70' };
              if (eng.pendingReview > 0) return { label: 'Review Pending', cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100/70' };
              if (eng.controlsTested === 0 && isExecutionPhase(eng.status)) return { label: 'Start Testing', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
              if (eng.controlsTested < eng.controls) return { label: 'Continue Testing', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
              if (eng.status === 'closed') return { label: 'View Report', cls: 'bg-canvas text-ink-600 hover:bg-canvas-border/70' };
              return { label: 'View Engagement', cls: 'bg-primary/10 text-primary hover:bg-primary/20' };
            };

            // Summary card KPIs
            const summaryCards = [
              { label: 'Total Engagements', value: plan.length, cls: 'text-primary bg-primary-xlight' },
              { label: 'Active / In Execution', value: plan.filter(p => isExecutionPhase(p.status)).length, cls: 'text-emerald-700 bg-emerald-50' },
              { label: 'Pending Review', value: plan.filter(p => p.pendingReview > 0).length, cls: 'text-amber-700 bg-amber-50' },
              { label: 'At Risk / Failed', value: plan.filter(p => p.riskStatus === 'at-risk' || p.controlsFailed > 0).length, cls: 'text-red-700 bg-red-50' },
              { label: 'Planned', value: plan.filter(p => ['planned', 'frozen', 'signed-off'].includes(p.status)).length, cls: 'text-ink-600 bg-canvas' },
            ];

            const formatAuditPeriod = (start: string, end: string) => {
              if (!start || !end) return '';
              const s = new Date(start);
              const e = new Date(end);
              return `${s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — ${e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
            };

            return (
              <motion.div key="execution" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {/* Summary Cards */}
                <div className="grid grid-cols-5 gap-2.5 mb-4">
                  {summaryCards.map((card, i) => (
                    <motion.div key={card.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass-card px-3 py-2.5 flex items-center gap-2.5">
                      <div className={`text-lg font-bold tabular-nums ${card.cls.split(' ')[0]}`}>{card.value}</div>
                      <div className="text-[0.625rem] text-text-muted leading-tight">{card.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Filters + Search */}
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {filterOptions.map(f => (
                        <button key={f.key} onClick={() => setEngFilter(f.key)}
                          className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold transition-all cursor-pointer ${
                            engFilter === f.key ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted hover:bg-primary/10 hover:text-primary'
                          }`}>
                          {f.label}
                          {f.count > 0 && <span className={`ml-1 text-[0.625rem] tabular-nums ${engFilter === f.key ? 'text-white/80' : 'text-text-muted/60'}`}>{f.count}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="w-px h-5 bg-border-light" />
                    <div className="flex items-center gap-1.5">
                      {processFilterOptions.map(opt => (
                        <button key={opt} onClick={() => setProcessFilter(opt)}
                          className={`px-2 py-1 rounded-full text-[0.625rem] font-semibold transition-all cursor-pointer ${
                            processFilter === opt ? 'bg-evidence-700 text-white' : 'bg-surface-2 text-text-muted hover:bg-evidence-50 hover:text-evidence-700'
                          }`}>{opt}</button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="text" placeholder="Search engagements, RACM, owner..." value={engSearch} onChange={e => setEngSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-[0.6875rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted/60 outline-none focus:border-primary/40 transition-colors w-56" />
                  </div>
                </div>

                {/* Engagement Table */}
                {filteredPlan.length === 0 ? (
                  <div className="glass-card p-12 text-center">
                    <ClipboardList size={32} className="text-text-muted mx-auto mb-3" />
                    <p className="text-[0.875rem] font-semibold text-text mb-1">
                      {plan.length === 0 ? 'No engagements planned yet' : 'No engagements match this filter'}
                    </p>
                    <p className="text-[0.75rem] text-text-muted max-w-sm mx-auto mb-4">
                      {plan.length === 0
                        ? 'Create your first engagement by selecting a business process and RACM.'
                        : 'Try adjusting your filters or search query above.'}
                    </p>
                    {plan.length === 0 && (
                      <button onClick={openCreateDrawer} className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer">
                        <Plus size={13} />Plan Engagement
                      </button>
                    )}
                  </div>
                ) : (
                <>
                {/* Helper text */}
                <div className="flex items-start gap-2 mb-3 px-1">
                  <Info size={12} className="text-primary/50 shrink-0 mt-0.5" />
                  <p className="text-[0.625rem] text-text-muted leading-relaxed">
                    Engagements are organized by primary business process. Execution details are available inside each engagement.
                  </p>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[0.75rem]">
                      <thead>
                        <tr className="border-b border-border bg-surface-2/40">
                          {['Engagement', 'Type / Framework', 'Owner', 'Status', 'Attention', 'Next Action'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-[0.625rem] font-semibold text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPlan.map((eng, i) => {
                          const action = getNextAction(eng);
                          const attention = getAttention(eng);
                          const isExpanded = expandedEngId === eng.id;
                          const auditPeriod = formatAuditPeriod(eng.auditPeriodStart, eng.auditPeriodEnd);

                          return (
                            <React.Fragment key={eng.id}>
                              <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                                onClick={() => {
                                  if (isExecutionPhase(eng.status) && onNavigateToExecution) onNavigateToExecution(eng.id);
                                  else openEditDrawer(eng);
                                }}
                                className={`border-b border-border/40 hover:bg-primary/[0.02] transition-colors cursor-pointer group ${eng.isOverdue ? 'border-l-[3px] border-l-red-400' : ''}`}>
                                {/* Engagement — enriched with process chip, period, alert */}
                                <td className="px-4 py-3.5">
                                  <div className="min-w-0 max-w-[320px]">
                                    <span className="text-[0.75rem] font-semibold text-text leading-snug">{eng.name}</span>
                                    <div className="text-[0.625rem] text-text-muted/80 mt-0.5 truncate">RACM: {getRacmDisplayName(eng)}</div>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <span className={`px-1.5 h-[18px] rounded text-[0.5625rem] font-bold border inline-flex items-center ${PROCESS_BADGE_COLORS[eng.businessProcess]}`}>
                                        {eng.businessProcess === 'Cross' ? 'Cross' : eng.businessProcess}
                                      </span>
                                      {auditPeriod && <span className="text-[0.5625rem] text-text-muted/60">{auditPeriod}</span>}
                                      {eng.isOverdue && <span className="px-1.5 h-[18px] rounded text-[0.5rem] font-bold bg-red-50 text-red-600 inline-flex items-center">OVERDUE</span>}
                                      {eng.riskStatus === 'at-risk' && !eng.isOverdue && <span className="px-1.5 h-[18px] rounded text-[0.5rem] font-bold bg-amber-50 text-amber-600 inline-flex items-center">AT RISK</span>}
                                    </div>
                                  </div>
                                </td>
                                {/* Type / Framework */}
                                <td className="px-4 py-3.5">
                                  <div className="text-[0.6875rem] text-text-secondary leading-snug">{eng.auditType}</div>
                                  <div className="text-[0.625rem] text-text-muted/70 mt-0.5">{eng.framework}</div>
                                </td>
                                {/* Owner */}
                                <td className="px-4 py-3.5">
                                  <div className="text-[0.6875rem] font-medium text-text">{eng.owner.split(' ')[0]}</div>
                                  <div className="text-[0.75rem] text-text-muted/70 mt-0.5">{eng.reviewer.split(' ')[0]}</div>
                                </td>
                                {/* Status */}
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 h-[20px] rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${lifecycleTone(eng.status)}`}>{lifecycleLabel(eng.status)}</span>
                                </td>
                                {/* Attention */}
                                <td className="px-4 py-3.5">
                                  <span className={`px-2 h-[20px] rounded-full text-[0.5625rem] font-semibold inline-flex items-center ${attention.cls}`}>{attention.label}</span>
                                </td>
                                {/* Next Action */}
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-1">
                                    <span className={`px-2.5 py-1 rounded-lg text-[0.625rem] font-bold cursor-pointer transition-colors inline-flex items-center gap-1 ${action.cls}`}>
                                      {action.label}<ChevronRight size={9} />
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExpandedEngId(isExpanded ? null : eng.id); }}
                                      className="p-1 rounded hover:bg-canvas text-text-muted/50 hover:text-text transition-colors cursor-pointer"
                                      title="Show details"
                                    >
                                      <ChevronDown size={11} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                              {/* Expanded detail row */}
                              {isExpanded && (
                                <tr className="bg-surface-2/20 border-b border-border/30">
                                  <td colSpan={6} className="px-5 py-3">
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.15 }}
                                      className="grid grid-cols-6 gap-5 text-[0.6875rem]">
                                      <div><span className="text-text-muted/70 block text-[0.5625rem] uppercase font-semibold mb-0.5 tracking-wide">Controls</span><span className="font-bold text-text tabular-nums">{eng.controls}</span></div>
                                      <div><span className="text-text-muted/70 block text-[0.5625rem] uppercase font-semibold mb-0.5 tracking-wide">Tested</span><span className="font-bold text-text tabular-nums">{eng.controlsTested}</span></div>
                                      <div><span className="text-text-muted/70 block text-[0.5625rem] uppercase font-semibold mb-0.5 tracking-wide">Effective</span><span className="font-bold text-emerald-700 tabular-nums">{eng.controlsEffective}</span></div>
                                      <div><span className="text-text-muted/70 block text-[0.5625rem] uppercase font-semibold mb-0.5 tracking-wide">Failed</span><span className={`font-bold tabular-nums ${eng.controlsFailed > 0 ? 'text-red-600' : 'text-text-muted/50'}`}>{eng.controlsFailed}</span></div>
                                      <div><span className="text-text-muted/70 block text-[0.5625rem] uppercase font-semibold mb-0.5 tracking-wide">Pending Review</span><span className="font-bold text-text tabular-nums">{eng.pendingReview}</span></div>
                                      <div><span className="text-text-muted/70 block text-[0.5625rem] uppercase font-semibold mb-0.5 tracking-wide">Last Activity</span><span className="text-text-secondary">{eng.lastActivity}</span></div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-2 border-t border-border/40 bg-surface-2/20">
                    <span className="text-[0.625rem] text-text-muted">{filteredPlan.length} of {plan.length} engagements</span>
                  </div>
                </div>
                </>
                )}
              </motion.div>
            );
          })()}

          {/* ── TIMELINE TAB ── */}
          {activeTab === 'timeline' && (
            <motion.div key="timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <GanttChart items={plan} frozen={planFrozen} onClickEngagement={openEditDrawer} processFilter={processFilter} statusFilter={statusFilter} />
              <MilestonesStrip />

              {/* Current Execution Progress */}
              {plan.some(p => isExecutionPhase(p.status)) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6">
                  <h2 className="text-[0.9375rem] font-semibold text-text mb-3">Execution Progress</h2>
                  <div className="glass-card p-5">
                    <div className="space-y-4">
                      {plan.filter(p => isExecutionPhase(p.status)).map((eng, i) => {
                        const progressMap: Record<string, number> = { 'ap-1': 72, 'ap-2': 44, 'ap-3': 85, 'ap-6': 60 };
                        const progress = progressMap[eng.id] || 0;
                        const tested = Math.round((progress / 100) * eng.controls);

                        return (
                          <div key={eng.id}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: eng.color }} />
                                <span className="text-[0.75rem] font-medium text-text">{eng.name}</span>
                                <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full ${lifecycleTone(eng.status)}`}>
                                  {lifecycleLabel(eng.status)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[0.75rem] text-text-muted">{tested}/{eng.controls} controls</span>
                                <span className="text-[0.75rem] font-bold font-mono text-text">{progress}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                                className="h-full rounded-full"
                                style={{ background: eng.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Engagement Drawer */}
      <AnimatePresence>
        {drawerEngagement && (
          <EngagementDrawer
            engagement={drawerEngagement}
            isCreate={drawerIsCreate}
            frozen={planFrozen}
            onClose={() => setDrawerEngagement(null)}
            onSave={handleSaveEngagement}
            onDelete={handleDeleteEngagement}
            onActivate={handleActivate}
            onViewExecution={onNavigateToExecution ? (id) => { setDrawerEngagement(null); onNavigateToExecution(id); } : undefined}
          />
        )}
      </AnimatePresence>

      {/* Engagement Setup Panel (Draft / Planned) */}
      <AnimatePresence>
        {setupPanelEngagement && (
          <EngagementSetupPanel
            engagement={setupPanelEngagement}
            onClose={() => setSetupPanelEngagement(null)}
            onMoveToPlanned={handleMoveToPlanned}
            onActivate={handleSetupActivate}
            onUpdateEngagement={(id, updates) => {
              // Update the engagement in the plan
              setPlan(prev => prev.map(p => p.id === id ? { ...p, ...updates } as AuditEngagement : p));
              // Also update the setup panel's view of the engagement
              setSetupPanelEngagement(prev => prev && prev.id === id ? { ...prev, ...updates } as AuditEngagement : prev);
            }}
          />
        )}
      </AnimatePresence>

      {/* Activation Modal */}
      <AnimatePresence>
        {showActivateModal && <ActivationModal
          engagement={plan.find(p => p.id === showActivateModal)}
          activating={activating}
          activationError={activationError}
          activationLog={activationLog}
          activationSteps={activationSteps}
          onConfirm={() => confirmActivate()}
          onClose={() => { if (!activating) { setShowActivateModal(null); setActivationError(null); } }}
          getBlockers={getActivationBlockers}
        />}
      </AnimatePresence>
    </div>
  );
}
