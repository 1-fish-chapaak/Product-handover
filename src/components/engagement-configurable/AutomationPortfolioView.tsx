// ─── Automation Projects — Portfolio / Monitoring Landing View ────────────
// Shows multiple automation project cards before opening a specific workspace.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, Activity, Workflow, AlertTriangle, Shield, ArrowLeft,
  Clock, ChevronRight, BarChart3, CheckCircle2, Calendar,
  Play, TrendingUp, FileText, Filter,
} from 'lucide-react';
import type { ConfigurableEngagement, AutomationProjectConfig } from './configurableEngagementTypes';
import { EngagementPatternType, EngagementStatus, AutomationOutputType, RunType, RunFrequency } from './configurableEngagementTypes';

// ─── Mock Portfolio Data ─────────────────────────────────────────────────

export interface AutomationProjectCard {
  id: string;
  name: string;
  description: string;
  businessProcess: string;
  entity: string;
  status: 'Active' | 'Draft' | 'Needs Setup' | 'Paused' | 'Scheduled';
  workflowsCount: number;
  activeWorkflows: number;
  exceptionsCount: number;
  openExceptions: number;
  casesCount: number;
  recordsProcessed: number;
  frequency: string;
  lastRunStatus: 'Completed' | 'Failed' | 'Pending' | 'Never';
  lastRunAt: string;
  nextRunAt: string;
  outputTypes: string[];
  owner: string;
  completionPct: number;
}

export const MOCK_AUTOMATION_PROJECTS: AutomationProjectCard[] = [
  {
    id: 'ap-001', name: 'Duplicate Invoice Monitoring', description: 'Detect and flag duplicate invoices across vendor ledgers using automated matching and pattern recognition workflows.',
    businessProcess: 'Procure to Pay', entity: 'Corporate', status: 'Active', workflowsCount: 3, activeWorkflows: 3,
    exceptionsCount: 12, openExceptions: 4, casesCount: 5, recordsProcessed: 24806,
    frequency: 'Daily', lastRunStatus: 'Completed', lastRunAt: 'May 16, 2026 06:00 AM', nextRunAt: 'May 17, 2026 06:00 AM',
    outputTypes: ['Report', 'Dashboard', 'Case Management'], owner: 'Karan Mehta', completionPct: 85,
  },
  {
    id: 'ap-002', name: 'Vendor Master Monitoring', description: 'Monitor vendor master data changes, detect unauthorized modifications, and flag dormant vendor reactivations.',
    businessProcess: 'Procure to Pay', entity: 'Corporate', status: 'Active', workflowsCount: 2, activeWorkflows: 2,
    exceptionsCount: 7, openExceptions: 2, casesCount: 3, recordsProcessed: 1842,
    frequency: 'Weekly', lastRunStatus: 'Completed', lastRunAt: 'May 12, 2026 09:00 AM', nextRunAt: 'May 19, 2026 09:00 AM',
    outputTypes: ['Report', 'Dashboard'], owner: 'Deepak Bansal', completionPct: 92,
  },
  {
    id: 'ap-003', name: 'Payment Control Monitoring', description: 'Validate payment batches against authorization limits, detect split payments, and match payments to approved POs.',
    businessProcess: 'Procure to Pay', entity: 'Regional — South', status: 'Active', workflowsCount: 4, activeWorkflows: 3,
    exceptionsCount: 18, openExceptions: 6, casesCount: 8, recordsProcessed: 15420,
    frequency: 'Daily', lastRunStatus: 'Completed', lastRunAt: 'May 16, 2026 07:30 AM', nextRunAt: 'May 17, 2026 07:30 AM',
    outputTypes: ['Report', 'Dashboard', 'Case Management'], owner: 'Tushar Goel', completionPct: 72,
  },
  {
    id: 'ap-004', name: 'Invoice Posting Monitoring', description: 'Monitor invoice posting accuracy, detect posting errors, and validate GL account mappings against business rules.',
    businessProcess: 'Record to Report', entity: 'Corporate', status: 'Scheduled', workflowsCount: 2, activeWorkflows: 2,
    exceptionsCount: 3, openExceptions: 1, casesCount: 1, recordsProcessed: 8900,
    frequency: 'Monthly', lastRunStatus: 'Completed', lastRunAt: 'Apr 30, 2026 11:00 PM', nextRunAt: 'May 31, 2026 11:00 PM',
    outputTypes: ['Report', 'Dashboard'], owner: 'Sneha Desai', completionPct: 95,
  },
  {
    id: 'ap-005', name: 'Tax Compliance Monitoring', description: 'Validate tax calculations, withholding compliance, and GST/TDS return accuracy against transaction data.',
    businessProcess: 'Record to Report', entity: 'All Entities', status: 'Draft', workflowsCount: 1, activeWorkflows: 0,
    exceptionsCount: 0, openExceptions: 0, casesCount: 0, recordsProcessed: 0,
    frequency: 'Monthly', lastRunStatus: 'Never', lastRunAt: '', nextRunAt: '',
    outputTypes: ['Report'], owner: 'Neha Joshi', completionPct: 15,
  },
  {
    id: 'ap-006', name: 'Forensic Checks Monitoring', description: 'Run forensic analytics on transaction patterns to detect unusual activity, round-amount transactions, and Benford\'s law deviations.',
    businessProcess: 'Procure to Pay', entity: 'Corporate', status: 'Active', workflowsCount: 3, activeWorkflows: 3,
    exceptionsCount: 9, openExceptions: 3, casesCount: 4, recordsProcessed: 32100,
    frequency: 'Weekly', lastRunStatus: 'Completed', lastRunAt: 'May 14, 2026 02:00 AM', nextRunAt: 'May 21, 2026 02:00 AM',
    outputTypes: ['Report', 'Dashboard', 'Case Management'], owner: 'Karan Mehta', completionPct: 78,
  },
  {
    id: 'ap-007', name: 'Vendor Advance Monitoring', description: 'Track outstanding vendor advances, aging analysis, and reconciliation against goods/services received.',
    businessProcess: 'Procure to Pay', entity: 'Regional — North', status: 'Needs Setup', workflowsCount: 0, activeWorkflows: 0,
    exceptionsCount: 0, openExceptions: 0, casesCount: 0, recordsProcessed: 0,
    frequency: '', lastRunStatus: 'Never', lastRunAt: '', nextRunAt: '',
    outputTypes: ['Report', 'Case Management'], owner: 'Rohan Patel', completionPct: 5,
  },
  {
    id: 'ap-008', name: 'GRN Invoice Matching Monitoring', description: 'Three-way match between GRN, purchase orders, and invoices to detect quantity/price mismatches and partial receipts.',
    businessProcess: 'Procure to Pay', entity: 'Corporate', status: 'Paused', workflowsCount: 2, activeWorkflows: 0,
    exceptionsCount: 5, openExceptions: 5, casesCount: 0, recordsProcessed: 4200,
    frequency: 'Daily', lastRunStatus: 'Failed', lastRunAt: 'May 10, 2026 06:00 AM', nextRunAt: '',
    outputTypes: ['Report', 'Dashboard'], owner: 'Tushar Goel', completionPct: 45,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  Active: 'text-compliant-700 bg-compliant-50',
  Draft: 'text-ink-400 bg-canvas-elevated',
  'Needs Setup': 'text-high-700 bg-high-50',
  Paused: 'text-mitigated-700 bg-mitigated-50',
  Scheduled: 'text-evidence-700 bg-evidence-50',
};

const RUN_STATUS_CLS: Record<string, string> = {
  Completed: 'text-compliant-700',
  Failed: 'text-risk-700',
  Pending: 'text-mitigated-700',
  Never: 'text-ink-400',
};

function buildEngagementFromCard(card: AutomationProjectCard): ConfigurableEngagement {
  const outputTypes: AutomationOutputType[] = [];
  if (card.outputTypes.includes('Report')) outputTypes.push(AutomationOutputType.REPORT);
  if (card.outputTypes.includes('Dashboard')) outputTypes.push(AutomationOutputType.DASHBOARD);
  if (card.outputTypes.includes('Case Management')) outputTypes.push(AutomationOutputType.CASE_MANAGEMENT);
  if (card.outputTypes.includes('Email')) outputTypes.push(AutomationOutputType.EMAIL);
  if (card.outputTypes.includes('Downloadable File')) outputTypes.push(AutomationOutputType.DOWNLOADABLE_FILE);
  if (!outputTypes.includes(AutomationOutputType.REPORT)) outputTypes.push(AutomationOutputType.REPORT);

  const config: AutomationProjectConfig = {
    patternType: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
    inputType: 'EXCEL_CSV',
    automationSetupMode: 'SELECT_EXISTING_WORKFLOW',
    outputTypes,
    reportRequired: true,
    reviewRequired: false,
    caseCreationEnabled: card.outputTypes.includes('Case Management'),
    runType: card.frequency ? RunType.RECURRING : RunType.AD_HOC,
    frequency: card.frequency === 'Daily' ? RunFrequency.DAILY : card.frequency === 'Weekly' ? RunFrequency.WEEKLY : card.frequency === 'Monthly' ? RunFrequency.MONTHLY : undefined,
  };

  return {
    id: card.id,
    name: card.name,
    patternType: EngagementPatternType.WORKFLOW_AUTOMATION_PROJECT,
    displayLabel: 'Project',
    description: card.description,
    owner: card.owner,
    businessProcess: card.businessProcess,
    entityOrLocation: card.entity,
    status: card.status === 'Active' || card.status === 'Scheduled' ? EngagementStatus.ACTIVE : card.status === 'Paused' ? EngagementStatus.ON_HOLD : EngagementStatus.DRAFT,
    stage: card.status,
    config,
    outputs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Portfolio Component ─────────────────────────────────────────────────

interface Props {
  onOpenProject: (engagement: ConfigurableEngagement) => void;
  onCreateNew: () => void;
  onBack?: () => void;
}

export default function AutomationPortfolioView({ onOpenProject, onCreateNew, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const projects = MOCK_AUTOMATION_PROJECTS;

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  // KPI aggregates
  const activeCount = projects.filter(p => p.status === 'Active' || p.status === 'Scheduled').length;
  const totalWorkflows = projects.reduce((s, p) => s + p.activeWorkflows, 0);
  const totalOpenEx = projects.reduce((s, p) => s + p.openExceptions, 0);
  const totalCases = projects.reduce((s, p) => s + p.casesCount, 0);
  const scheduledCount = projects.filter(p => p.frequency && p.status !== 'Paused' && p.status !== 'Draft' && p.status !== 'Needs Setup').length;
  const totalRecords = projects.reduce((s, p) => s + p.recordsProcessed, 0);

  const statuses = ['Active', 'Scheduled', 'Draft', 'Needs Setup', 'Paused'];

  return (
    <div className="space-y-7">
      {/* Back to Work Type */}
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-brand-700 transition-colors cursor-pointer -mb-3">
          <ArrowLeft size={14} />Back to Engagement Library
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-ink-900 tracking-tight">Automation Projects</h2>
          <p className="text-[13px] text-ink-400 mt-1">Monitor recurring workflow automations, exceptions, cases, and reporting across project areas.</p>
        </div>
        <button onClick={onCreateNew}
          className="flex items-center gap-2 px-5 h-11 rounded-xl bg-gradient-to-r from-primary to-primary-medium text-white text-[13px] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer shadow-sm shrink-0">
          <Plus size={15} />Create Automation Project
        </button>
      </div>

      {/* KPI cards — matches platform DashboardView KPI pattern */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { title: 'Active Projects', value: activeCount, icon: Activity, color: 'text-compliant bg-compliant-50' },
          { title: 'Workflows Running', value: totalWorkflows, icon: Workflow, color: 'text-evidence-700 bg-evidence-50' },
          { title: 'Open Exceptions', value: totalOpenEx, icon: AlertTriangle, color: totalOpenEx > 0 ? 'text-high-700 bg-high-50' : 'text-compliant bg-compliant-50' },
          { title: 'Cases Assigned', value: totalCases, icon: Shield, color: 'text-brand-700 bg-brand-50' },
          { title: 'Scheduled Runs', value: scheduledCount, icon: Calendar, color: 'text-evidence-700 bg-evidence-50' },
          { title: 'Records Processed', value: totalRecords.toLocaleString(), icon: BarChart3, color: 'text-ink-500 bg-canvas-elevated' },
        ].map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + i * 0.04 }}
            className="glass-card rounded-xl px-5 py-4 hover:border-brand-200 transition-all">
            <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide mb-3">{kpi.title}</p>
            <p className="text-[26px] font-bold text-ink-900 leading-none tabular-nums">{kpi.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[380px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
            className="w-full pl-10 pr-4 h-10 rounded-xl border border-canvas-border bg-white text-[13px] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all" />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setStatusFilter('')}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-all ${!statusFilter ? 'bg-brand-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-brand-50 hover:text-brand-700'}`}>
            All ({projects.length})
          </button>
          {statuses.map(s => {
            const count = projects.filter(p => p.status === s).length;
            if (count === 0) return null;
            return (
              <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer transition-all ${statusFilter === s ? 'bg-brand-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-brand-50 hover:text-brand-700'}`}>
                {s} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Project cards — matches platform DashboardListPage card pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        <AnimatePresence>
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onOpenProject(buildEngagementFromCard(project))}
              className="glass-card rounded-xl p-6 cursor-pointer group relative flex flex-col hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/40 transition-all"
            >
              {/* Top: icon + status */}
              <div className="flex items-start justify-between mb-4">
                <div className="inline-flex p-2.5 rounded-xl bg-brand-50 text-brand-700">
                  <Activity size={18} />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_CLS[project.status] || 'bg-canvas-elevated text-ink-400'}`}>
                  {project.status}
                </span>
              </div>

              {/* Title + description */}
              <div className="mb-4 flex-1">
                <h3 className="text-[15px] font-semibold text-ink-900 group-hover:text-brand-700 transition-colors mb-1.5">
                  {project.name}
                </h3>
                <p className="text-[12px] text-ink-500 leading-relaxed line-clamp-2">{project.description}</p>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 gap-3 mb-4 py-3 rounded-xl bg-canvas-elevated/50">
                {[
                  { value: project.activeWorkflows, label: 'Workflows', cls: '' },
                  { value: project.openExceptions, label: 'Open Exc.', cls: project.openExceptions > 0 ? 'text-high-700' : '' },
                  { value: project.casesCount, label: 'Cases', cls: '' },
                  { value: project.recordsProcessed > 999 ? `${(project.recordsProcessed / 1000).toFixed(1)}K` : project.recordsProcessed, label: 'Records', cls: '' },
                ].map(m => (
                  <div key={m.label} className="text-center">
                    <div className={`text-[16px] font-bold tabular-nums ${m.cls || 'text-ink-900'}`}>{m.value}</div>
                    <div className="text-[10px] text-ink-400 font-medium">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-ink-400 font-medium">Coverage</span>
                  <span className="text-[11px] font-bold text-ink-600">{project.completionPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-canvas-border overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${project.completionPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04 + 0.2 }}
                    className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-canvas-border mt-auto">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-ink-500 font-medium">{project.businessProcess}</span>
                  {project.frequency && (
                    <span className="flex items-center gap-1 text-ink-400">
                      <Calendar size={11} />{project.frequency}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {project.lastRunStatus !== 'Never' && (
                    <span className={`text-[11px] font-semibold flex items-center gap-1 ${RUN_STATUS_CLS[project.lastRunStatus]}`}>
                      {project.lastRunStatus === 'Completed' && <CheckCircle2 size={11} />}
                      {project.lastRunStatus}
                    </span>
                  )}
                  <ChevronRight size={15} className="text-ink-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="glass-card rounded-2xl p-16 text-center">
          <Search size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="text-[14px] text-ink-500 font-medium">No projects match your search.</p>
          <p className="text-[12px] text-ink-400 mt-1">Try adjusting your filters or search term.</p>
        </div>
      )}
    </div>
  );
}
