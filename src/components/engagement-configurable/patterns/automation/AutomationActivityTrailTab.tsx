// ─── Automation Project — Activity Trail Tab ─────────────────────────────
// Timeline-style activity log grouped by date, filterable by workflow and type.

import React, { useMemo, useState } from 'react';
import {
  Clock, Workflow, AlertTriangle, FileText, Shield, Play, CheckCircle2,
  UserPlus, Settings, ChevronDown, X,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../../configurableEngagementTypes';
import type { AutomationProjectWorkspaceState } from './automationInputData';

type ActivityType = 'RUN' | 'EXCEPTION' | 'ASSIGNMENT' | 'REPORT' | 'OUTPUT' | 'CONFIG';

interface ActivityEntry {
  id: string;
  timestamp: string;
  sortKey: number;
  type: ActivityType;
  title: string;
  subtitle: string;
  actor: string;
  workflowName?: string;
  severity?: 'info' | 'warning' | 'success' | 'error';
}

const TYPE_ICON: Record<ActivityType, { icon: React.ElementType; color: string; bg: string }> = {
  RUN:        { icon: Play,           color: 'text-purple-600',  bg: 'bg-purple-100' },
  EXCEPTION:  { icon: AlertTriangle,  color: 'text-amber-600',   bg: 'bg-amber-100' },
  ASSIGNMENT: { icon: UserPlus,       color: 'text-blue-600',    bg: 'bg-blue-100' },
  REPORT:     { icon: FileText,       color: 'text-primary',     bg: 'bg-primary/15' },
  OUTPUT:     { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-100' },
  CONFIG:     { icon: Settings,       color: 'text-ink-500',    bg: 'bg-canvas-border' },
};

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-l-blue-300',
  warning: 'border-l-amber-400',
  success: 'border-l-emerald-400',
  error: 'border-l-red-400',
};

function parseDate(ts: string): Date {
  if (!ts) return new Date();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date() : d;
}

function getDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((today.getTime() - entryDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  if (diff < 7) return `${diff}D AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function formatTime(ts: string): string {
  const d = parseDate(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function buildActivityTrail(engagement: ConfigurableEngagement, state: AutomationProjectWorkspaceState): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let counter = 0;
  const id = () => `act-${++counter}`;
  const sk = (ts: string) => parseDate(ts).getTime();

  // Project creation
  entries.push({
    id: id(), timestamp: engagement.createdAt, sortKey: sk(engagement.createdAt), type: 'CONFIG',
    title: 'Project created',
    subtitle: `${engagement.owner} created "${engagement.name}"`,
    actor: engagement.owner, severity: 'info',
  });

  // Input data
  if (state.inputData.selectedSourceIds.length > 0) {
    entries.push({
      id: id(), timestamp: engagement.updatedAt, sortKey: sk(engagement.updatedAt) + 1, type: 'CONFIG',
      title: 'Input data configured',
      subtitle: `${state.inputData.selectedSourceIds.length} data source(s) selected`,
      actor: engagement.owner, severity: 'info',
    });
  }

  // Workflow setup
  const wfNames = state.setup.selectedWorkflowNames?.length ? state.setup.selectedWorkflowNames : (state.setup.selectedWorkflowName ? [state.setup.selectedWorkflowName] : []);
  if (wfNames.length > 0) {
    entries.push({
      id: id(), timestamp: engagement.updatedAt, sortKey: sk(engagement.updatedAt) + 2, type: 'CONFIG',
      title: 'Workflows configured',
      subtitle: `${wfNames.length} workflow(s): ${wfNames.join(', ')}`,
      actor: engagement.owner, severity: 'info',
    });
  }

  // Runs, outputs, exceptions
  for (const run of state.runs.runs) {
    const wfLabel = run.workflowNames?.length ? run.workflowNames.join(', ') : run.workflowName || '';

    if (run.status === 'COMPLETED' && run.completedAt) {
      entries.push({
        id: id(), timestamp: run.completedAt, sortKey: sk(run.completedAt), type: 'RUN',
        title: `Workflow run — ${wfLabel || run.runName}`,
        subtitle: `${run.exceptionCount} exceptions detected · ${run.processedRecords.toLocaleString()} records processed`,
        actor: run.runBy, severity: run.exceptionCount > 0 ? 'warning' : 'success',
      });

      for (const ex of run.exceptions) {
        const exId = ex.id.slice(-6).toUpperCase();
        entries.push({
          id: id(), timestamp: run.completedAt, sortKey: sk(run.completedAt) + 1, type: 'EXCEPTION',
          title: `EX-${exId} — ${ex.title}`,
          subtitle: `${ex.severity} · ${ex.sourceWorkflowName || wfLabel}`,
          actor: 'System', workflowName: ex.sourceWorkflowName, severity: ex.severity === 'HIGH' || ex.severity === 'CRITICAL' ? 'error' : 'warning',
        });
      }

      // Assignments
      for (const ex of run.exceptions.filter(e => e.status === 'CASE_CANDIDATE')) {
        const exId = ex.id.slice(-6).toUpperCase();
        entries.push({
          id: id(), timestamp: ex.caseCandidateMarkedAt || run.completedAt, sortKey: sk(ex.caseCandidateMarkedAt || run.completedAt) + 2, type: 'ASSIGNMENT',
          title: `EX-${exId} assigned to ${ex.assignedOwner || 'unassigned'}`,
          subtitle: `${ex.sourceWorkflowName || wfLabel}${ex.dueDate ? ` · Due: ${ex.dueDate}` : ''}`,
          actor: ex.caseCandidateMarkedBy || engagement.owner, workflowName: ex.sourceWorkflowName, severity: 'info',
        });
      }

      // Dismissed
      for (const ex of run.exceptions.filter(e => e.status === 'DISMISSED')) {
        const exId = ex.id.slice(-6).toUpperCase();
        entries.push({
          id: id(), timestamp: run.completedAt, sortKey: sk(run.completedAt) + 3, type: 'EXCEPTION',
          title: `EX-${exId} closed — false positive (dismissed)`,
          subtitle: `${ex.sourceWorkflowName || wfLabel}`,
          actor: engagement.owner, workflowName: ex.sourceWorkflowName, severity: 'info',
        });
      }
    }

    if (run.status === 'FAILED' && run.completedAt) {
      entries.push({
        id: id(), timestamp: run.completedAt, sortKey: sk(run.completedAt), type: 'RUN',
        title: `Workflow run failed — ${wfLabel || run.runName}`,
        subtitle: run.summary,
        actor: run.runBy, severity: 'error',
      });
    }
  }

  // Reports
  for (const report of state.reports.reports) {
    entries.push({
      id: id(), timestamp: report.generatedAt, sortKey: sk(report.generatedAt), type: 'REPORT',
      title: `Report generated — ${report.title}`,
      subtitle: `Status: ${report.status}`,
      actor: engagement.owner, severity: 'info',
    });
    if (report.status === 'FINAL' && report.finalizedAt) {
      entries.push({
        id: id(), timestamp: report.finalizedAt, sortKey: sk(report.finalizedAt), type: 'REPORT',
        title: `Report finalized — ${report.title}`,
        subtitle: `Finalized by ${report.finalizedBy}`,
        actor: report.finalizedBy, severity: 'success',
      });
    }
  }

  entries.sort((a, b) => b.sortKey - a.sortKey);
  return entries;
}

// ─── Group entries by date ──────────────────────────────────────────────

interface DateGroup { label: string; entries: ActivityEntry[] }

function groupByDate(entries: ActivityEntry[]): DateGroup[] {
  const map = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const label = getDateLabel(parseDate(e.timestamp));
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
}

// ─── Component ──────────────────────────────────────────────────────────

interface Props {
  engagement: ConfigurableEngagement;
  automationState: AutomationProjectWorkspaceState;
}

type TypeFilter = 'All' | 'Exceptions' | 'Workflow runs' | 'Other';

export default function AutomationActivityTrailTab({ engagement, automationState }: Props) {
  const entries = useMemo(() => buildActivityTrail(engagement, automationState), [engagement, automationState]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [wfDropdownOpen, setWfDropdownOpen] = useState(false);

  // Derive workflow names
  const workflowNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of entries) {
      if (e.workflowName) names.add(e.workflowName);
    }
    return Array.from(names).sort();
  }, [entries]);

  // Filter
  const filtered = useMemo(() => {
    let list = entries;
    if (workflowFilter) list = list.filter(e => e.workflowName === workflowFilter || e.type === 'RUN' || e.type === 'CONFIG' || e.type === 'REPORT');
    if (typeFilter === 'Exceptions') list = list.filter(e => e.type === 'EXCEPTION' || e.type === 'ASSIGNMENT');
    else if (typeFilter === 'Workflow runs') list = list.filter(e => e.type === 'RUN');
    else if (typeFilter === 'Other') list = list.filter(e => e.type === 'CONFIG' || e.type === 'REPORT' || e.type === 'OUTPUT');
    return list;
  }, [entries, typeFilter, workflowFilter]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  // Type filter counts
  const exCount = entries.filter(e => e.type === 'EXCEPTION' || e.type === 'ASSIGNMENT').length;
  const runCount = entries.filter(e => e.type === 'RUN').length;
  const otherCount = entries.filter(e => e.type === 'CONFIG' || e.type === 'REPORT' || e.type === 'OUTPUT').length;

  const TYPE_FILTERS: { label: TypeFilter; count: number }[] = [
    { label: 'All', count: entries.length },
    { label: 'Exceptions', count: exCount },
    { label: 'Workflow runs', count: runCount },
    { label: 'Other', count: otherCount },
  ];

  return (
    <div className="space-y-0">
      {/* ── Filter bar ── */}
      <div className="flex items-center gap-4 pb-4 border-b border-border-light">
        {/* Workflow dropdown */}
        <div className="relative">
          <div className="text-[0.5625rem] font-semibold text-ink-400 uppercase tracking-wider mb-1">Workflow</div>
          <button onClick={() => setWfDropdownOpen(!wfDropdownOpen)}
            className="flex items-center gap-1.5 h-8 px-3 min-w-[160px] text-[0.75rem] font-medium text-text bg-white border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
            <Workflow size={12} className="text-primary shrink-0" />
            <span className="flex-1 text-left truncate">{workflowFilter || 'All workflows'}</span>
            <ChevronDown size={12} className="text-ink-400 shrink-0" />
          </button>
          {wfDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setWfDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-20 w-64 bg-white border border-border-light rounded-lg shadow-lg overflow-hidden">
                <button onClick={() => { setWorkflowFilter(''); setWfDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[0.75rem] hover:bg-surface-2/30 cursor-pointer transition-colors ${!workflowFilter ? 'font-semibold text-primary bg-primary/5' : 'text-text'}`}>
                  All workflows
                </button>
                {workflowNames.map(name => (
                  <button key={name} onClick={() => { setWorkflowFilter(name); setWfDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[0.75rem] hover:bg-surface-2/30 cursor-pointer transition-colors ${workflowFilter === name ? 'font-semibold text-primary bg-primary/5' : 'text-text'}`}>
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Type pills */}
        <div>
          <div className="text-[0.5625rem] font-semibold text-ink-400 uppercase tracking-wider mb-1">Type</div>
          <div className="flex items-center gap-1.5">
            {TYPE_FILTERS.map(f => (
              <button key={f.label} onClick={() => setTypeFilter(f.label)}
                className={`h-8 px-3 rounded-full text-[0.6875rem] font-semibold cursor-pointer transition-colors ${
                  typeFilter === f.label
                    ? 'bg-primary text-white'
                    : 'bg-canvas text-ink-500 hover:bg-canvas-border'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event count */}
        <div className="ml-auto text-[0.6875rem] text-ink-400 self-end pb-1">
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Timeline ── */}
      {groups.length === 0 ? (
        <div className="py-16 text-center">
          <Clock size={32} className="text-ink-300 mx-auto mb-3" />
          <p className="text-[0.875rem] font-semibold text-text mb-1">No Activity Yet</p>
          <p className="text-[0.75rem] text-text-muted">Events will appear here as you run workflows and manage exceptions.</p>
        </div>
      ) : (
        <div className="pt-2">
          {groups.map(group => (
            <div key={group.label}>
              {/* Date header */}
              <div className="flex items-center gap-3 py-3 sticky top-0 bg-surface z-10">
                <span className="text-[0.6875rem] font-bold text-ink-400 tracking-wider">{group.label}</span>
                <span className="text-[0.625rem] text-ink-300">({group.entries.length})</span>
                <div className="flex-1 border-b border-border-light/50" />
              </div>

              {/* Entries */}
              <div className="space-y-1 pb-2">
                {group.entries.map(entry => {
                  const icon = TYPE_ICON[entry.type];
                  const Icon = icon.icon;
                  const borderCls = SEVERITY_BORDER[entry.severity || 'info'];
                  return (
                    <div key={entry.id} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border-l-[3px] ${borderCls} hover:bg-white transition-colors`}>
                      {/* Icon */}
                      <div className={`w-7 h-7 rounded-full ${icon.bg} ${icon.color} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon size={13} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] font-semibold text-text leading-snug">{entry.title}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[0.625rem] text-ink-400">
                          {entry.workflowName && (
                            <>
                              <span className="flex items-center gap-0.5 text-primary/70 font-medium">
                                <Workflow size={9} />{entry.workflowName}
                              </span>
                              <span className="text-ink-300">·</span>
                            </>
                          )}
                          <span>{entry.subtitle}</span>
                        </div>
                      </div>

                      {/* Time + actor */}
                      <div className="text-right shrink-0">
                        <div className="text-[0.625rem] text-ink-300 tabular-nums">{formatTime(entry.timestamp)}</div>
                        <div className="text-[0.625rem] text-ink-400 mt-0.5">{entry.actor}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
