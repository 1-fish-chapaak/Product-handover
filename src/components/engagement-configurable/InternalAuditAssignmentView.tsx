// ─── Internal Audit Assignment View — Landing / Portfolio Page ────────────
// Shows IA assignment cards; clicking opens V3 IA workspace.
// Matches Compliance Engagement View and Automation Portfolio visual pattern.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck, Search, Plus, ArrowLeft, Calendar, Users,
  ChevronRight, FileText, AlertTriangle, CheckCircle2, Clock, Eye,
} from 'lucide-react';
import type { ConfigurableEngagement, InternalAuditConfig } from './configurableEngagementTypes';
import {
  EngagementPatternType, EngagementStatus,
  AuditScopeLevel,
} from './configurableEngagementTypes';

// ─── Mock IA Assignments ────────────────────────────────────────────────

interface IAAssignmentCard {
  id: string;
  name: string;
  businessProcess: string;
  entity: string;
  owner: string;
  reviewer: string;
  status: 'draft' | 'in-progress' | 'observations' | 'discussion' | 'report' | 'action-tracking' | 'closed';
  observations: number;
  openObservations: number;
  actionPlans: number;
  actionPlansDue: number;
  start: string;
  end: string;
  nextAction: string;
}

const MOCK_IA_ASSIGNMENTS: IAAssignmentCard[] = [
  { id: 'ia-001', name: 'P2P Process Review', businessProcess: 'Procure to Pay', entity: 'Corporate', owner: 'Karan Mehta', reviewer: 'Sneha Desai', status: 'in-progress', observations: 3, openObservations: 2, actionPlans: 1, actionPlansDue: 0, start: 'Jan 2026', end: 'Jun 2026', nextAction: 'Review Observations' },
  { id: 'ia-002', name: 'Vendor Onboarding Audit', businessProcess: 'Vendor Management', entity: 'Corporate', owner: 'Tushar Goel', reviewer: 'Karan Mehta', status: 'observations', observations: 5, openObservations: 3, actionPlans: 2, actionPlansDue: 1, start: 'Feb 2026', end: 'Jul 2026', nextAction: 'Start Discussion' },
  { id: 'ia-003', name: 'Inventory Management Review', businessProcess: 'Inventory', entity: 'Plant — Pune', owner: 'Neha Joshi', reviewer: 'Rohan Patel', status: 'discussion', observations: 4, openObservations: 1, actionPlans: 3, actionPlansDue: 2, start: 'Mar 2026', end: 'Aug 2026', nextAction: 'Prepare Final Report' },
  { id: 'ia-004', name: 'Payroll Process Audit', businessProcess: 'HR & Payroll', entity: 'Corporate', owner: 'Rohan Patel', reviewer: 'Sneha Desai', status: 'report', observations: 6, openObservations: 0, actionPlans: 4, actionPlansDue: 3, start: 'Dec 2025', end: 'May 2026', nextAction: 'Finalize Report' },
  { id: 'ia-005', name: 'Contract Compliance Review', businessProcess: 'Source to Contract', entity: 'Corporate', owner: 'Sneha Desai', reviewer: 'Tushar Goel', status: 'draft', observations: 0, openObservations: 0, actionPlans: 0, actionPlansDue: 0, start: 'Apr 2026', end: 'Sep 2026', nextAction: 'Define Scope' },
  { id: 'ia-006', name: 'Branch Operations Audit', businessProcess: 'Operations', entity: 'Branch — Mumbai', owner: 'Deepak Bansal', reviewer: 'Karan Mehta', status: 'action-tracking', observations: 7, openObservations: 0, actionPlans: 5, actionPlansDue: 2, start: 'Oct 2025', end: 'Mar 2026', nextAction: 'Track Action Plan' },
  { id: 'ia-007', name: 'IT General Controls Review', businessProcess: 'IT Operations', entity: 'Corporate', owner: 'Karan Mehta', reviewer: 'Neha Joshi', status: 'closed', observations: 3, openObservations: 0, actionPlans: 2, actionPlansDue: 0, start: 'Jul 2025', end: 'Dec 2025', nextAction: '—' },
];

function buildIAEngagement(card: IAAssignmentCard): ConfigurableEngagement {
  const config: InternalAuditConfig = {
    patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
    scopeLevel: AuditScopeLevel.PROCESS,
    businessProcessId: card.businessProcess,
    subProcessId: '',
    auditPeriodStart: '',
    auditPeriodEnd: '',
    sopIds: [],
    racmVersionId: '',
    checklistId: '',
    processOwner: card.owner,
    idrEnabled: true,
    announcementRequired: true,
    finalReportRequired: true,
    actionTrackingEnabled: true,
  };

  const statusMap: Record<string, EngagementStatus> = {
    'draft': EngagementStatus.DRAFT,
    'in-progress': EngagementStatus.IN_PROGRESS,
    'observations': EngagementStatus.IN_PROGRESS,
    'discussion': EngagementStatus.IN_PROGRESS,
    'report': EngagementStatus.PENDING_REVIEW,
    'action-tracking': EngagementStatus.IN_PROGRESS,
    'closed': EngagementStatus.COMPLETED,
  };

  const stageMap: Record<string, string> = {
    'draft': 'Draft',
    'in-progress': 'Fieldwork',
    'observations': 'Observations Drafted',
    'discussion': 'Discussion Pending',
    'report': 'Final Report Pending',
    'action-tracking': 'Action Tracking',
    'closed': 'Closed',
  };

  return {
    id: card.id,
    name: card.name,
    patternType: EngagementPatternType.INTERNAL_AUDIT_ASSIGNMENT,
    displayLabel: 'Audit Assignment',
    description: `Internal audit assignment for ${card.businessProcess} process.`,
    owner: card.owner,
    reviewer: card.reviewer,
    businessProcess: card.businessProcess,
    entityOrLocation: card.entity,
    status: statusMap[card.status] || EngagementStatus.DRAFT,
    stage: stageMap[card.status] || 'Draft',
    config,
    outputs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Component ──────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, { bg: string; text: string; label: string }> = {
  'draft':           { bg: 'bg-paper-100',     text: 'text-ink-600',        label: 'Draft' },
  'in-progress':     { bg: 'bg-evidence-50',   text: 'text-evidence-700',   label: 'In Progress' },
  'observations':    { bg: 'bg-mitigated-50',  text: 'text-mitigated-700',  label: 'Observations Drafted' },
  'discussion':      { bg: 'bg-brand-50',      text: 'text-brand-700',      label: 'Discussion Pending' },
  'report':          { bg: 'bg-high-50',       text: 'text-high-700',       label: 'Final Report Pending' },
  'action-tracking': { bg: 'bg-risk-50',       text: 'text-risk-700',       label: 'Action Tracking' },
  'closed':          { bg: 'bg-compliant-50',  text: 'text-compliant-700',  label: 'Closed' },
};

const NEXT_ACTION_ICON: Record<string, React.ElementType> = {
  'Define Scope': FileText,
  'Send Announcement': ChevronRight,
  'Review IDR': Eye,
  'Run Analysis': ChevronRight,
  'Review Observations': AlertTriangle,
  'Start Discussion': ChevronRight,
  'Prepare Final Report': FileText,
  'Finalize Report': FileText,
  'Track Action Plan': CheckCircle2,
};

interface Props {
  onOpenAssignment: (engagement: ConfigurableEngagement) => void;
  onCreateNew: () => void;
  onBack: () => void;
}

export default function InternalAuditAssignmentView({ onOpenAssignment, onCreateNew, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const assignments = MOCK_IA_ASSIGNMENTS;

  const filtered = assignments.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.owner.toLowerCase().includes(search.toLowerCase()) && !a.businessProcess.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  // KPI aggregates
  const totalAssignments = assignments.length;
  const inProgress = assignments.filter(a => ['in-progress', 'observations', 'discussion'].includes(a.status)).length;
  const pendingReview = assignments.filter(a => a.status === 'report').length;
  const totalObsOpen = assignments.reduce((s, a) => s + a.openObservations, 0);
  const totalActionsDue = assignments.reduce((s, a) => s + a.actionPlansDue, 0);
  const closedCount = assignments.filter(a => a.status === 'closed').length;

  const statusGroups = [
    { key: 'draft', label: 'Draft' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'observations', label: 'Observations' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'report', label: 'Report' },
    { key: 'action-tracking', label: 'Action Tracking' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[0.8125rem] text-ink-400 hover:text-brand-700 transition-colors cursor-pointer">
        <ArrowLeft size={14} />Back to Engagement Library
      </button>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-600 to-purple-500 text-white">
              <ClipboardCheck size={16} />
            </div>
            <h1 className="text-xl font-bold text-text">Internal Audit Assignments</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1 ml-9">Plan, execute, review, and track internal audit assignments from scope to final report and action plan.</p>
        </div>
        <button onClick={onCreateNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white text-[0.8125rem] font-semibold hover:from-purple-700 hover:to-purple-600 transition-all cursor-pointer shadow-sm">
          <Plus size={14} />Create IA Assignment
        </button>
      </div>

      {/* KPI strip */}
      <div className="flex items-center gap-4">
        {[
          { label: 'Assignments', value: totalAssignments, color: 'text-text' },
          { label: 'In Progress', value: inProgress, color: 'text-evidence-700' },
          { label: 'Pending Report', value: pendingReview, color: pendingReview > 0 ? 'text-high-700' : 'text-text' },
          { label: 'Observations Open', value: totalObsOpen, color: totalObsOpen > 0 ? 'text-mitigated-700' : 'text-text' },
          { label: 'Actions Due', value: totalActionsDue, color: totalActionsDue > 0 ? 'text-risk-700' : 'text-text' },
          { label: 'Closed', value: closedCount, color: 'text-compliant-700' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border-light">
            <span className="text-[0.6875rem] text-text-muted">{s.label}</span>
            <span className={`text-[0.9375rem] font-bold tabular-nums ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Search + status filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assignments..."
            className="w-full pl-9 pr-4 h-9 rounded-md border border-border-light bg-white text-[0.8125rem] text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-[0.75rem] font-semibold cursor-pointer transition-all ${!statusFilter ? 'bg-purple-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-purple-50'}`}>
            All ({assignments.length})
          </button>
          {statusGroups.map(s => {
            const count = assignments.filter(a => a.status === s.key).length;
            if (count === 0) return null;
            return (
              <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
                className={`px-3 py-1.5 rounded-full text-[0.75rem] font-semibold cursor-pointer transition-all ${statusFilter === s.key ? 'bg-purple-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-purple-50'}`}>
                {s.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Assignment table */}
      <div className="rounded-xl border border-border-light bg-white overflow-hidden">
        <table className="w-full text-[0.75rem]">
          <thead>
            <tr className="border-b border-border-light bg-surface-2/30 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left">Assignment</th>
              <th className="px-4 py-2.5 text-left">Entity</th>
              <th className="px-4 py-2.5 text-left">Owner</th>
              <th className="px-4 py-2.5 text-center">Status</th>
              <th className="px-4 py-2.5 text-center">Observations</th>
              <th className="px-4 py-2.5 text-center">Actions Due</th>
              <th className="px-4 py-2.5 text-left">Period</th>
              <th className="px-4 py-2.5 text-left">Next Action</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((a, i) => {
                const tone = STATUS_TONE[a.status] || STATUS_TONE.draft;
                const NextIcon = NEXT_ACTION_ICON[a.nextAction] || ChevronRight;
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => onOpenAssignment(buildIAEngagement(a))}
                    className="border-b border-border-light/50 hover:bg-purple-50/20 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text group-hover:text-purple-700 transition-colors">{a.name}</div>
                      <div className="text-[0.625rem] text-gray-400 mt-0.5">{a.businessProcess}</div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{a.entity}</td>
                    <td className="px-4 py-3">
                      <div className="text-text font-medium">{a.owner}</div>
                      <div className="text-[0.625rem] text-gray-400">{a.reviewer}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-semibold ${tone.bg} ${tone.text}`}>
                        {tone.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.observations > 0 ? (
                        <div>
                          <span className="font-semibold text-text tabular-nums">{a.observations}</span>
                          {a.openObservations > 0 && (
                            <span className="text-[0.625rem] text-mitigated-700 ml-1">({a.openObservations} open)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.actionPlansDue > 0 ? (
                        <span className="font-semibold text-risk-700 tabular-nums">{a.actionPlansDue}</span>
                      ) : a.actionPlans > 0 ? (
                        <span className="text-compliant-700 font-medium tabular-nums">{a.actionPlans}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      <span className="flex items-center gap-1"><Calendar size={10} />{a.start} – {a.end}</span>
                    </td>
                    <td className="px-4 py-3">
                      {a.nextAction !== '—' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-[0.625rem] font-semibold">
                          <NextIcon size={10} />{a.nextAction}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[0.8125rem] text-text-muted">No assignments match your search.</div>
        )}
      </div>
    </div>
  );
}
