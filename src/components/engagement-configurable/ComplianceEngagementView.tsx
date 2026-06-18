// ─── Compliance Engagement View — Process Hub-aligned landing ─────────────
// Visually matches Process Hub Engagement View / Execution screen.
// Shows compliance engagement cards; clicking opens V3 Compliance workspace.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Briefcase, Search, Plus, ArrowLeft, Calendar, Users,
  ChevronRight, CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react';
import type { ConfigurableEngagement, ComplianceConfig } from './configurableEngagementTypes';
import {
  EngagementPatternType, EngagementStatus,
  ComplianceFramework, ControlScopeSource, TestingInputMethod,
} from './configurableEngagementTypes';

// ─── Mock Compliance Engagements ─────────────────────────────────────────

interface ComplianceEngagementCard {
  id: string;
  name: string;
  type: string;
  framework: string;
  owner: string;
  reviewer: string;
  status: 'active' | 'complete' | 'draft' | 'review';
  controls: number;
  tested: number;
  effective: number;
  deficiencies: number;
  start: string;
  end: string;
  bps: string[];
}

const MOCK_COMPLIANCE_ENGAGEMENTS: ComplianceEngagementCard[] = [
  { id: 'eng-001', name: 'P2P — SOX Audit', type: 'Financial Internal Control', framework: 'SOX / ICFR', owner: 'Tushar Goel', reviewer: 'Karan Mehta', status: 'active', controls: 14, tested: 8, effective: 7, deficiencies: 1, start: 'Jan 2026', end: 'Jun 2026', bps: ['P2P'] },
  { id: 'eng-002', name: 'O2C — SOX Audit', type: 'Financial Internal Control', framework: 'SOX / ICFR', owner: 'Neha Joshi', reviewer: 'Karan Mehta', status: 'active', controls: 10, tested: 4, effective: 4, deficiencies: 0, start: 'Jan 2026', end: 'Jun 2026', bps: ['O2C'] },
  { id: 'eng-003', name: 'R2R — SOX Audit', type: 'Financial Internal Control', framework: 'SOX / ICFR', owner: 'Karan Mehta', reviewer: 'Sneha Desai', status: 'active', controls: 12, tested: 6, effective: 5, deficiencies: 2, start: 'Jan 2026', end: 'Jun 2026', bps: ['R2R'] },
  { id: 'eng-004', name: 'S2C — Contract Review', type: 'Internal Audit', framework: 'Custom', owner: 'Rohan Patel', reviewer: 'Deepak Bansal', status: 'draft', controls: 8, tested: 0, effective: 0, deficiencies: 0, start: 'Apr 2026', end: 'Sep 2026', bps: ['S2C'] },
  { id: 'eng-005', name: 'P2P — IFC Assessment', type: 'Financial Internal Control', framework: 'IFC / ICOFR', owner: 'Sneha Desai', reviewer: 'Tushar Goel', status: 'review', controls: 11, tested: 11, effective: 9, deficiencies: 2, start: 'Oct 2025', end: 'Mar 2026', bps: ['P2P'] },
];

function buildComplianceEngagement(card: ComplianceEngagementCard): ConfigurableEngagement {
  const config: ComplianceConfig = {
    patternType: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
    framework: card.framework.includes('SOX') ? ComplianceFramework.SOX_ICFR : card.framework.includes('IFC') ? ComplianceFramework.IFC : ComplianceFramework.SOX_ICFR,
    auditType: card.type,
    auditPeriodStart: '',
    auditPeriodEnd: '',
    controlScopeSource: ControlScopeSource.RACM_VERSION,
    defaultTestingInputMethod: TestingInputMethod.UPLOAD_SELECTED_SAMPLES,
    allowControlLevelOverride: true,
    reviewerRequired: true,
    requestPbcEnabled: true,
  };
  return {
    id: card.id, name: card.name,
    patternType: EngagementPatternType.COMPLIANCE_CONTROL_TESTING,
    displayLabel: 'Engagement', description: `${card.type} engagement for ${card.bps.join(', ')} business process.`,
    owner: card.owner, reviewer: card.reviewer,
    businessProcess: card.bps.join(', '),
    status: card.status === 'active' ? EngagementStatus.IN_PROGRESS : card.status === 'complete' ? EngagementStatus.COMPLETED : card.status === 'review' ? EngagementStatus.PENDING_REVIEW : EngagementStatus.DRAFT,
    stage: card.status === 'active' ? 'Testing In Progress' : card.status === 'complete' ? 'Concluded' : card.status === 'review' ? 'Pending Review' : 'Draft',
    config, outputs: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

// ─── Component ───────────────────────────────────────────────────────────

const STATUS_TONE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-evidence-50', text: 'text-evidence-700', label: 'In Fieldwork' },
  complete: { bg: 'bg-compliant-50', text: 'text-compliant-700', label: 'Closed' },
  draft: { bg: 'bg-paper-100', text: 'text-ink-600', label: 'Planned' },
  review: { bg: 'bg-mitigated-50', text: 'text-mitigated-700', label: 'Pending Review' },
};

interface Props {
  onOpenEngagement: (engagement: ConfigurableEngagement) => void;
  onCreateNew: () => void;
  onBack: () => void;
}

export default function ComplianceEngagementView({ onOpenEngagement, onCreateNew, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const engagements = MOCK_COMPLIANCE_ENGAGEMENTS;

  const filtered = engagements.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.owner.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    return true;
  });

  // KPI aggregates
  const totalControls = engagements.reduce((s, e) => s + e.controls, 0);
  const totalTested = engagements.reduce((s, e) => s + e.tested, 0);
  const totalEffective = engagements.reduce((s, e) => s + e.effective, 0);
  const totalDeficiencies = engagements.reduce((s, e) => s + e.deficiencies, 0);
  const activeCount = engagements.filter(e => e.status === 'active').length;

  const statuses = [
    { key: 'active', label: 'Active' },
    { key: 'review', label: 'Pending Review' },
    { key: 'draft', label: 'Planned' },
    { key: 'complete', label: 'Closed' },
  ];

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[0.8125rem] text-ink-400 hover:text-brand-700 transition-colors cursor-pointer">
        <ArrowLeft size={14} />Back to Engagement Library
      </button>

      {/* Header — matches Process Hub style */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium text-white">
              <Shield size={16} />
            </div>
            <h1 className="text-xl font-bold text-text">Engagement View</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1 ml-9">Compliance control testing engagements across your business.</p>
        </div>
        <button onClick={onCreateNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-medium text-white text-[0.8125rem] font-semibold hover:from-primary-hover hover:to-primary transition-all cursor-pointer shadow-sm">
          <Plus size={14} />Plan Engagement
        </button>
      </div>

      {/* KPI strip */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border-light">
          <span className="text-[0.6875rem] text-text-muted">Engagements</span>
          <span className="text-[0.9375rem] font-bold text-text tabular-nums">{engagements.length}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border-light">
          <span className="text-[0.6875rem] text-text-muted">Controls</span>
          <span className="text-[0.9375rem] font-bold text-text tabular-nums">{totalControls}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border-light">
          <span className="text-[0.6875rem] text-text-muted">Tested</span>
          <span className="text-[0.9375rem] font-bold text-evidence-700 tabular-nums">{totalTested}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border-light">
          <span className="text-[0.6875rem] text-text-muted">Effective</span>
          <span className="text-[0.9375rem] font-bold text-compliant-700 tabular-nums">{totalEffective}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-border-light">
          <span className="text-[0.6875rem] text-text-muted">Deficiencies</span>
          <span className={`text-[0.9375rem] font-bold tabular-nums ${totalDeficiencies > 0 ? 'text-risk-700' : 'text-text'}`}>{totalDeficiencies}</span>
        </div>
      </div>

      {/* Search + status filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search engagements..."
            className="w-full pl-9 pr-4 h-9 rounded-md border border-border-light bg-white text-[0.8125rem] text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors" />
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-full text-[0.75rem] font-semibold cursor-pointer transition-all ${!statusFilter ? 'bg-brand-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-brand-50'}`}>
            All ({engagements.length})
          </button>
          {statuses.map(s => {
            const count = engagements.filter(e => e.status === s.key).length;
            if (count === 0) return null;
            return (
              <button key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? '' : s.key)}
                className={`px-3 py-1.5 rounded-full text-[0.75rem] font-semibold cursor-pointer transition-all ${statusFilter === s.key ? 'bg-brand-600 text-white shadow-sm' : 'bg-canvas-elevated text-ink-500 hover:bg-brand-50'}`}>
                {s.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Engagement cards — matches Process Hub EngagementCard style */}
      <div className="grid grid-cols-2 gap-5">
        <AnimatePresence>
          {filtered.map((eng, i) => {
            const tone = STATUS_TONE[eng.status] || STATUS_TONE.draft;
            const progressPct = eng.controls > 0 ? Math.round((eng.tested / eng.controls) * 100) : 0;
            const effectivePct = eng.tested > 0 ? Math.round((eng.effective / eng.tested) * 100) : 0;
            return (
              <motion.button
                key={eng.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => onOpenEngagement(buildComplianceEngagement(eng))}
                className="text-left group relative bg-white rounded-2xl border border-border-light p-6 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary-xlight flex items-center justify-center shrink-0">
                      <Briefcase size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.9375rem] font-semibold text-text group-hover:text-primary transition-colors truncate">{eng.name}</div>
                      <div className="text-[0.75rem] text-text-muted mt-0.5 flex items-center gap-2">
                        <span className="font-mono">{eng.id.toUpperCase()}</span>
                        <span className="text-text-muted/50">·</span>
                        <span>{eng.type}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 h-6 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap ${tone.bg} ${tone.text}`}>
                    {tone.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-lg bg-surface-2/80 border border-border-light/50 p-2.5">
                    <div className="text-[1.125rem] font-semibold text-text tabular-nums leading-none mb-1">{eng.controls}</div>
                    <div className="text-[0.6875rem] text-text-muted">Controls</div>
                  </div>
                  <div className="rounded-lg bg-surface-2/80 border border-border-light/50 p-2.5">
                    <div className="text-[1.125rem] font-semibold text-text tabular-nums leading-none mb-1">{eng.tested}</div>
                    <div className="text-[0.6875rem] text-text-muted">Tested</div>
                  </div>
                  <div className="rounded-lg bg-surface-2/80 border border-border-light/50 p-2.5">
                    <div className={`text-[1.125rem] font-semibold tabular-nums leading-none mb-1 ${eng.deficiencies > 0 ? 'text-risk-700' : 'text-text'}`}>{eng.deficiencies}</div>
                    <div className="text-[0.6875rem] text-text-muted">Deficiencies</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6, delay: 0.15 + i * 0.05 }} className="h-full rounded-full bg-primary" />
                  </div>
                  <span className="text-[0.75rem] font-semibold text-text-secondary tabular-nums">{progressPct}%</span>
                </div>

                <div className="flex items-center justify-between text-[0.75rem] text-text-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><Users size={11} />{eng.owner}</span>
                    <span className="text-text-muted/50">·</span>
                    <span className="flex items-center gap-1.5"><Calendar size={11} />{eng.start} – {eng.end}</span>
                  </div>
                  {eng.tested > 0 && (
                    <span className="font-mono text-[0.6875rem]">{effectivePct}% effective</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[0.8125rem] text-text-muted">No engagements match your search.</div>
      )}
    </div>
  );
}
