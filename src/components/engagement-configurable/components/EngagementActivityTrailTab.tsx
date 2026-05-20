// ─── Shared Activity Trail Tab ───────────────────────────────────────────
// Works for all engagement patterns — Compliance, IA, and Automation.

import React, { useMemo, useState } from 'react';
import {
  Clock, Workflow, AlertTriangle, FileText, Shield, Play, CheckCircle2,
  UserPlus, Settings, ChevronDown, Search, Eye, Send, ClipboardCheck,
} from 'lucide-react';
import type { ConfigurableEngagement } from '../configurableEngagementTypes';
import { EngagementPatternType } from '../configurableEngagementTypes';
import type { ComplianceWorkspaceState } from '../patterns/compliance/complianceRequestsData';
import type { InternalAuditWorkspaceState } from '../patterns/internal-audit/internalAuditScopeData';
import type { AutomationProjectWorkspaceState } from '../patterns/automation/automationInputData';

type ActivityType = 'CONFIG' | 'RUN' | 'FINDING' | 'OBSERVATION' | 'REVIEW' | 'REPORT' | 'ACTION';

interface ActivityEntry {
  id: string;
  timestamp: string;
  sortKey: number;
  type: ActivityType;
  title: string;
  subtitle: string;
  actor: string;
  severity?: 'info' | 'warning' | 'success' | 'error';
}

const TYPE_ICON: Record<ActivityType, { icon: React.ElementType; color: string; bg: string }> = {
  CONFIG:      { icon: Settings,       color: 'text-gray-500',    bg: 'bg-gray-200' },
  RUN:         { icon: Play,           color: 'text-purple-600',  bg: 'bg-purple-100' },
  FINDING:     { icon: AlertTriangle,  color: 'text-amber-600',   bg: 'bg-amber-100' },
  OBSERVATION: { icon: Eye,            color: 'text-blue-600',    bg: 'bg-blue-100' },
  REVIEW:      { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-100' },
  REPORT:      { icon: FileText,       color: 'text-primary',     bg: 'bg-primary/15' },
  ACTION:      { icon: ClipboardCheck, color: 'text-indigo-600',  bg: 'bg-indigo-100' },
};

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-l-blue-300', warning: 'border-l-amber-400', success: 'border-l-emerald-400', error: 'border-l-red-400',
};

function parseDate(ts: string): Date { const d = new Date(ts); return isNaN(d.getTime()) ? new Date() : d; }
function getDateLabel(date: Date): string {
  const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((today.getTime() - entryDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'TODAY'; if (diff === 1) return 'YESTERDAY'; if (diff < 7) return `${diff}D AGO`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}
function formatTime(ts: string): string { return parseDate(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); }

// ── Build entries per pattern ────────────────────────────────────────────

function buildComplianceTrail(eng: ConfigurableEngagement, state: ComplianceWorkspaceState): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let c = 0; const id = () => `act-${++c}`; const sk = (ts: string) => parseDate(ts).getTime();
  entries.push({ id: id(), timestamp: eng.createdAt, sortKey: sk(eng.createdAt), type: 'CONFIG', title: 'Engagement created', subtitle: `${eng.name} created by ${eng.owner}`, actor: eng.owner, severity: 'info' });
  // PBC requests
  for (const req of state.requests) {
    entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'CONFIG', title: `PBC Request: ${req.title}`, subtitle: `Status: ${req.status}`, actor: eng.owner, severity: req.status === 'Received' ? 'success' : 'info' });
  }
  // Samples
  for (const batch of state.samplesEvidence.batches) {
    entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'RUN', title: `Sample batch: ${batch.name}`, subtitle: `${batch.sampleCount} samples · ${batch.linkedControlIds.join(', ') || 'General'}`, actor: eng.owner, severity: 'info' });
  }
  // Attribute testing
  for (const result of state.attributeTesting.results) {
    entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'FINDING', title: `Attribute tested: ${result.attributeId}`, subtitle: `Result: ${result.result} · ${result.controlId}`, actor: eng.owner, severity: result.result === 'FAIL' ? 'error' : result.result === 'PASS' ? 'success' : 'warning' });
  }
  // Reviews
  for (const review of state.review.reviews) {
    entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'REVIEW', title: `Review: ${review.controlId}`, subtitle: `Status: ${review.status}`, actor: review.reviewedBy || eng.reviewer || eng.owner, severity: review.status === 'APPROVED' ? 'success' : 'info' });
  }
  // Conclusions
  for (const concl of state.conclusion.conclusions) {
    const val = concl.finalConclusion || concl.recommendedConclusion || 'PENDING';
    entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'REPORT', title: `Conclusion: ${concl.controlId}`, subtitle: `${val} — ${concl.remarks || 'No remarks'}`, actor: eng.owner, severity: val === 'EFFECTIVE' ? 'success' : val === 'INEFFECTIVE' ? 'error' : 'warning' });
  }
  entries.sort((a, b) => b.sortKey - a.sortKey);
  return entries;
}

function buildIATrail(eng: ConfigurableEngagement, state: InternalAuditWorkspaceState): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let c = 0; const id = () => `act-${++c}`; const sk = (ts: string) => parseDate(ts).getTime();
  entries.push({ id: id(), timestamp: eng.createdAt, sortKey: sk(eng.createdAt), type: 'CONFIG', title: 'Assignment created', subtitle: `${eng.name} created by ${eng.owner}`, actor: eng.owner, severity: 'info' });
  // Scope
  if (state.scope.businessProcessId) {
    entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'CONFIG', title: 'Scope defined', subtitle: `Process: ${state.scope.businessProcessId} · ${state.scope.sopIds.length} SOPs · ${state.scope.racmVersionIds.length} RACMs`, actor: eng.owner, severity: 'info' });
  }
  // Announcement
  if (state.announcement.status === 'SENT' || state.announcement.status === 'ACKNOWLEDGED') {
    entries.push({ id: id(), timestamp: state.announcement.sentAt || eng.updatedAt, sortKey: sk(state.announcement.sentAt || eng.updatedAt), type: 'ACTION', title: 'Announcement sent', subtitle: `To: ${state.announcement.recipients}`, actor: state.announcement.sentBy || eng.owner, severity: 'success' });
  }
  // IDR requests
  for (const req of state.requests.requests) {
    if (req.status !== 'DRAFT') {
      entries.push({ id: id(), timestamp: eng.updatedAt, sortKey: sk(eng.updatedAt) + c, type: 'CONFIG', title: `IDR: ${req.title}`, subtitle: `Status: ${req.status}`, actor: eng.owner, severity: req.status === 'RECEIVED' ? 'success' : 'info' });
    }
  }
  // Analysis runs
  for (const run of state.analysis.runs.filter(r => r.status === 'COMPLETED')) {
    entries.push({ id: id(), timestamp: run.completedAt || eng.updatedAt, sortKey: sk(run.completedAt || eng.updatedAt), type: 'RUN', title: `Workflow run: ${run.workflowName || run.title}`, subtitle: `${run.exceptions.length} finding(s) · ${run.linkedScopeLabel}`, actor: run.runBy, severity: run.exceptions.length > 0 ? 'warning' : 'success' });
  }
  // Observations
  for (const obs of state.observations.observations) {
    entries.push({ id: id(), timestamp: obs.createdAt, sortKey: sk(obs.createdAt) + c, type: 'OBSERVATION', title: `Observation: ${obs.title}`, subtitle: `${obs.severity} · ${obs.status} · ${obs.linkedScopeLabel}`, actor: eng.owner, severity: obs.severity === 'HIGH' || obs.severity === 'CRITICAL' ? 'error' : 'warning' });
  }
  // Discussion
  for (const disc of state.discussion.items.filter(i => i.status !== 'NOT_STARTED')) {
    entries.push({ id: id(), timestamp: disc.lastUpdatedAt, sortKey: sk(disc.lastUpdatedAt) + c, type: 'REVIEW', title: `Discussion: ${disc.observationTitle}`, subtitle: `Status: ${disc.status.replace(/_/g, ' ')}`, actor: eng.owner, severity: disc.status === 'AGREED' || disc.status === 'READY_FOR_REPORT' ? 'success' : 'info' });
  }
  // Final report
  if (state.finalReport.initialized) {
    entries.push({ id: id(), timestamp: state.finalReport.reportDate || eng.updatedAt, sortKey: sk(state.finalReport.reportDate || eng.updatedAt) + c, type: 'REPORT', title: `Final Report: ${state.finalReport.status}`, subtitle: state.finalReport.reportTitle || eng.name, actor: state.finalReport.preparedBy || eng.owner, severity: state.finalReport.status === 'ISSUED' ? 'success' : 'info' });
  }
  entries.sort((a, b) => b.sortKey - a.sortKey);
  return entries;
}

// ── Component ────────────────────────────────────────────────────────────

type TypeFilter = 'All' | 'Config' | 'Runs' | 'Findings' | 'Observations' | 'Reviews' | 'Reports';

interface Props {
  engagement: ConfigurableEngagement;
  complianceState?: ComplianceWorkspaceState;
  iaState?: InternalAuditWorkspaceState;
}

export default function EngagementActivityTrailTab({ engagement, complianceState, iaState }: Props) {
  const entries = useMemo(() => {
    if (engagement.patternType === EngagementPatternType.COMPLIANCE_CONTROL_TESTING && complianceState) {
      return buildComplianceTrail(engagement, complianceState);
    }
    if (engagement.patternType === EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT && iaState) {
      return buildIATrail(engagement, iaState);
    }
    return [{ id: 'act-1', timestamp: engagement.createdAt, sortKey: Date.now(), type: 'CONFIG' as ActivityType, title: 'Engagement created', subtitle: `${engagement.name}`, actor: engagement.owner, severity: 'info' as const }];
  }, [engagement, complianceState, iaState]);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = entries;
    if (typeFilter === 'Config') list = list.filter(e => e.type === 'CONFIG');
    else if (typeFilter === 'Runs') list = list.filter(e => e.type === 'RUN');
    else if (typeFilter === 'Findings') list = list.filter(e => e.type === 'FINDING');
    else if (typeFilter === 'Observations') list = list.filter(e => e.type === 'OBSERVATION');
    else if (typeFilter === 'Reviews') list = list.filter(e => e.type === 'REVIEW');
    else if (typeFilter === 'Reports') list = list.filter(e => e.type === 'REPORT' || e.type === 'ACTION');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q));
    }
    return list;
  }, [entries, typeFilter, search]);

  // Group by date
  const groups = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const e of filtered) { const label = getDateLabel(parseDate(e.timestamp)); if (!map.has(label)) map.set(label, []); map.get(label)!.push(e); }
    return Array.from(map.entries()).map(([label, entries]) => ({ label, entries }));
  }, [filtered]);

  const TYPE_FILTERS = ([
    { label: 'All' as TypeFilter, count: entries.length },
    { label: 'Config' as TypeFilter, count: entries.filter(e => e.type === 'CONFIG').length },
    { label: 'Runs' as TypeFilter, count: entries.filter(e => e.type === 'RUN').length },
    { label: 'Findings' as TypeFilter, count: entries.filter(e => e.type === 'FINDING').length },
    { label: 'Observations' as TypeFilter, count: entries.filter(e => e.type === 'OBSERVATION').length },
    { label: 'Reviews' as TypeFilter, count: entries.filter(e => e.type === 'REVIEW').length },
    { label: 'Reports' as TypeFilter, count: entries.filter(e => e.type === 'REPORT' || e.type === 'ACTION').length },
  ] as { label: TypeFilter; count: number }[]).filter(f => f.label === 'All' || f.count > 0);

  return (
    <div className="space-y-0">
      {/* Filter bar */}
      <div className="flex items-center gap-4 pb-4 border-b border-border-light">
        <div>
          <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Type</div>
          <div className="flex items-center gap-1.5">
            {TYPE_FILTERS.map(f => (
              <button key={f.label} onClick={() => setTypeFilter(f.label)}
                className={`h-8 px-3 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${typeFilter === f.label ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto text-[11px] text-gray-400 self-end pb-1">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Timeline */}
      {groups.length === 0 ? (
        <div className="py-16 text-center">
          <Clock size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-text mb-1">No Activity Yet</p>
          <p className="text-[12px] text-text-muted">Events will appear here as you work on this engagement.</p>
        </div>
      ) : (
        <div className="pt-2">
          {groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 py-3 sticky top-0 bg-surface z-10">
                <span className="text-[11px] font-bold text-gray-400 tracking-wider">{group.label}</span>
                <span className="text-[10px] text-gray-300">({group.entries.length})</span>
                <div className="flex-1 border-b border-border-light/50" />
              </div>
              <div className="space-y-1 pb-2">
                {group.entries.map(entry => {
                  const icon = TYPE_ICON[entry.type]; const Icon = icon.icon;
                  const borderCls = SEVERITY_BORDER[entry.severity || 'info'];
                  return (
                    <div key={entry.id} className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border-l-[3px] ${borderCls} hover:bg-white transition-colors`}>
                      <div className={`w-7 h-7 rounded-full ${icon.bg} ${icon.color} flex items-center justify-center shrink-0 mt-0.5`}><Icon size={13} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-text leading-snug">{entry.title}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{entry.subtitle}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-gray-300 tabular-nums">{formatTime(entry.timestamp)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{entry.actor}</div>
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
