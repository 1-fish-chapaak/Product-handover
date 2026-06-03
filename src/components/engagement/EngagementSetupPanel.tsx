import DatePicker from '../shared/DatePicker';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, CheckCircle2, AlertTriangle, Calendar, Users, Shield,
  FileText, ArrowRight, Edit3, Target, Clock, Zap, Lock,
  ChevronDown, ChevronRight, ShieldCheck, BarChart3, Play, XCircle
} from 'lucide-react';

// ─── Types (matches AuditPlanningView) ───────────────────────────────────────

type EngagementLifecycle = 'draft' | 'planned' | 'frozen' | 'signed-off' | 'active' | 'in-progress' | 'pending-review' | 'closed';

interface EngagementData {
  id: string;
  name: string;
  auditType: string;
  framework: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  plannedStartDate: string;
  plannedEndDate: string;
  owner: string;
  reviewer: string;
  description: string;
  sourceRacmVersionId: string;
  engagementSnapshotId: string | null;
  businessProcess: string;
  status: EngagementLifecycle;
  controls: number;
  plannedHours: number;
  priority: string;
  riskScore: number;
}

// ─── Mock controls for RACM preview ─────────────────────────────────────────

const MOCK_RACM_CONTROLS = [
  { id: 'CTR-001', name: 'PO dual sign-off approval workflow', domain: 'P2P — Purchase Order', isKey: false },
  { id: 'CTR-002', name: 'Automated credit limit monitoring', domain: 'O2C — Credit Management', isKey: true },
  { id: 'CTR-003', name: 'Three-way PO/GRN/Invoice matching', domain: 'P2P — Vendor Payment', isKey: true },
  { id: 'CTR-004', name: 'GL reconciliation — monthly auto', domain: 'R2R — Financial Close', isKey: true },
  { id: 'CTR-005', name: 'Duplicate invoice detection workflow', domain: 'P2P — Vendor Payment', isKey: true },
  { id: 'CTR-006', name: 'SOD violation detector real-time', domain: 'P2P — Access Controls', isKey: false },
  { id: 'CTR-007', name: 'Revenue recognition compliance check', domain: 'O2C — Invoice Mgmt', isKey: true },
  { id: 'CTR-008', name: 'Journal entry management review', domain: 'R2R — Financial Close', isKey: true },
];

// ─── Validation ──────────────────────────────────────────────────────────────

interface CheckItem {
  label: string;
  met: boolean;
  critical: boolean;
  resolution: string;
}

function getActivationChecklist(eng: EngagementData): CheckItem[] {
  return [
    { label: 'RACM version linked', met: !!eng.sourceRacmVersionId, critical: true, resolution: 'Link a RACM version to define the control scope' },
    { label: 'Owner assigned', met: !!eng.owner, critical: true, resolution: 'Assign a lead auditor as engagement owner' },
    { label: 'Reviewer assigned', met: !!eng.reviewer, critical: true, resolution: 'Assign a reviewer for sign-off authority' },
    { label: 'Audit period defined', met: !!eng.auditPeriodStart && !!eng.auditPeriodEnd, critical: true, resolution: 'Set the audit period start and end dates' },
    { label: 'Planned dates set', met: !!eng.plannedStartDate && !!eng.plannedEndDate, critical: true, resolution: 'Set planned start and end dates for execution' },
    { label: 'At least one control mapped', met: eng.controls > 0, critical: true, resolution: 'Link a RACM version with in-scope controls' },
    { label: 'Workflow availability checked', met: eng.controls > 0 && !!eng.sourceRacmVersionId, critical: true, resolution: 'Ensure workflows/test scripts exist for mapped controls' },
  ];
}

// ─── DRAFT VIEW ──────────────────────────────────────────────────────────────

const RACM_OPTIONS = [
  { id: 'racm-v2.1', label: 'RACM v2.1 (Current — Feb 2026)', controls: 24 },
  { id: 'racm-v2.0', label: 'RACM v2.0 (Nov 2025)', controls: 18 },
  { id: 'racm-v1.9', label: 'RACM v1.9 (Aug 2025)', controls: 14 },
  { id: 'racm-v1.8', label: 'RACM v1.8 (May 2025)', controls: 12 },
];

function DraftSetup({ eng, onClose, onMoveToPlanned, onUpdate }: { eng: EngagementData; onClose: () => void; onMoveToPlanned: (id: string) => void; onUpdate?: (id: string, updates: Partial<EngagementData>) => void }) {
  const [showControls, setShowControls] = useState(false);
  const [showRacmPicker, setShowRacmPicker] = useState(false);
  const checklist = getActivationChecklist(eng);
  const criticalMet = checklist.filter(c => c.critical).every(c => c.met);
  const allMet = checklist.every(c => c.met);
  const completionPct = Math.round((checklist.filter(c => c.met).length / checklist.length) * 100);

  return (
    <div className="space-y-6">
      {/* Setup Progress */}
      <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.03] p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-[0.625rem] font-bold text-primary uppercase">Engagement Setup</span>
            <p className="text-[0.8125rem] font-semibold text-text mt-0.5">Configure this engagement before moving to Planned</p>
          </div>
          <div className="text-right">
            <span className="text-[1.125rem] font-bold text-primary tabular-nums">{completionPct}%</span>
            <p className="text-[0.625rem] text-text-muted">Complete</p>
          </div>
        </div>
        <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${completionPct}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-primary" />
        </div>
      </div>

      {/* Basic Info */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Edit3 size={11} />
          Basic Information
          <span className="text-[0.5625rem] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded ml-1">Editable</span>
        </h4>
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Engagement Name</span><p className="text-[0.75rem] font-medium text-text">{eng.name || <span className="text-high-700 italic">Not set</span>}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Audit Type</span><p className="text-[0.75rem] text-text">{eng.auditType}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Framework</span><p className="text-[0.75rem] text-text">{eng.framework}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Business Process</span><p className="text-[0.75rem] text-text">{eng.businessProcess}</p></div>
          </div>
        </div>
      </div>

      {/* Audit Period & Timeline (Editable) */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <Calendar size={11} />Audit Period & Timeline
          <span className="text-[0.5625rem] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded ml-1">Editable</span>
        </h4>
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Audit Period Start</label>
              <DatePicker value={eng.auditPeriodStart} onChange={e => onUpdate?.(eng.id, { auditPeriodStart: e.target.value })}
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white transition-all" />
            </div>
            <div>
              <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Audit Period End</label>
              <DatePicker value={eng.auditPeriodEnd} onChange={e => onUpdate?.(eng.id, { auditPeriodEnd: e.target.value })}
                className="w-full px-2.5 py-2 border border-border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white transition-all" />
            </div>
            <div>
              <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Planned Start *</label>
              <DatePicker value={eng.plannedStartDate} onChange={e => onUpdate?.(eng.id, { plannedStartDate: e.target.value })}
                className={`w-full px-2.5 py-2 border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white transition-all ${!eng.plannedStartDate ? 'border-risk/40' : 'border-border'}`} />
            </div>
            <div>
              <label className="text-[0.625rem] text-text-muted uppercase block mb-1">Planned End *</label>
              <DatePicker value={eng.plannedEndDate} onChange={e => onUpdate?.(eng.id, { plannedEndDate: e.target.value })}
                className={`w-full px-2.5 py-2 border rounded-lg text-[0.75rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 bg-white transition-all ${!eng.plannedEndDate ? 'border-risk/40' : 'border-border'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* RACM Version */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5"><FileText size={11} />Linked RACM Version <span className="text-[0.5625rem] text-risk-700 font-bold">MANDATORY</span></h4>
        <div className={`glass-card rounded-xl p-4 ${eng.sourceRacmVersionId && eng.controls > 0 ? 'border-compliant/20' : 'border-risk/30 bg-risk-50/10'}`}>
          {eng.sourceRacmVersionId && eng.controls > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-compliant-700" />
                  <div>
                    <p className="text-[0.75rem] font-semibold text-text">{RACM_OPTIONS.find(r => r.id === eng.sourceRacmVersionId)?.label || eng.sourceRacmVersionId}</p>
                    <p className="text-[0.625rem] text-text-muted">{eng.controls} controls in scope</p>
                  </div>
                </div>
                <button onClick={() => setShowRacmPicker(!showRacmPicker)} className="text-[0.6875rem] text-primary font-semibold hover:underline cursor-pointer">Change</button>
              </div>
              {showRacmPicker && (
                <div className="mt-2 space-y-1 border-t border-border-light pt-2">
                  {RACM_OPTIONS.map(r => (
                    <button key={r.id} onClick={() => {
                      onUpdate?.(eng.id, { sourceRacmVersionId: r.id, controls: r.controls });
                      setShowRacmPicker(false);
                    }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[0.75rem] transition-colors cursor-pointer ${
                      eng.sourceRacmVersionId === r.id ? 'bg-primary/10 text-primary font-semibold' : 'text-text-secondary hover:bg-surface-2'
                    }`}>
                      <span>{r.label}</span>
                      <span className="text-[0.625rem] text-text-muted">{r.controls} controls</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-risk-700" />
                  <p className="text-[0.75rem] font-medium text-risk-700">{eng.sourceRacmVersionId ? 'RACM linked but no controls — select a version with controls' : 'No RACM version linked — required before activation'}</p>
                </div>
              </div>
              <div className="space-y-1">
                {RACM_OPTIONS.map(r => (
                  <button key={r.id} onClick={() => {
                    onUpdate?.(eng.id, { sourceRacmVersionId: r.id, controls: r.controls });
                  }} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[0.75rem] transition-colors cursor-pointer ${
                    eng.sourceRacmVersionId === r.id ? 'bg-primary/10 text-primary font-semibold' : 'text-text-secondary hover:bg-surface-2'
                  }`}>
                    <span>{r.label}</span>
                    <span className="text-[0.625rem] text-text-muted">{r.controls} controls</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls Preview */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5">
          <ShieldCheck size={11} />
          Controls Preview
          <span className="text-[0.625rem] text-text-muted font-normal ml-1">({eng.controls} controls · read-only)</span>
        </h4>
        {eng.controls > 0 ? (
          <div className="glass-card rounded-xl overflow-hidden">
            <button onClick={() => setShowControls(!showControls)} className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-2/30 transition-colors">
              <span className="text-[0.75rem] font-medium text-text">{eng.controls} controls from {eng.sourceRacmVersionId}</span>
              <ChevronDown size={14} className={`text-text-muted transition-transform ${showControls ? 'rotate-180' : ''}`} />
            </button>
            {showControls && (
              <div className="border-t border-border-light">
                {MOCK_RACM_CONTROLS.slice(0, eng.controls > 8 ? 8 : eng.controls).map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-surface-2/20">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.625rem] font-mono text-text-muted">{c.id}</span>
                      <span className="text-[0.6875rem] font-medium text-text">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.625rem] text-text-muted">{c.domain}</span>
                      {c.isKey && <span className="text-[0.5625rem] font-bold bg-mitigated-50 text-mitigated-700 px-1.5 py-0.5 rounded">KEY</span>}
                    </div>
                  </div>
                ))}
                {eng.controls > 8 && <div className="px-4 py-2 text-[0.6875rem] text-text-muted text-center">+ {eng.controls - 8} more controls</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card rounded-xl p-4 border-risk/20 bg-risk-50/10">
            <div className="flex items-center gap-2"><XCircle size={14} className="text-risk-700" /><p className="text-[0.75rem] text-risk-700 font-medium">No controls mapped — link a RACM version first</p></div>
          </div>
        )}
      </div>

      {/* Assignment */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5"><Users size={11} />Assignment</h4>
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Owner / Lead Auditor</span>
              <p className={`text-[0.75rem] font-medium ${eng.owner ? 'text-text' : 'text-high-700 italic'}`}>{eng.owner || 'Not assigned'}</p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Reviewer</span>
              <p className={`text-[0.75rem] font-medium ${eng.reviewer ? 'text-text' : 'text-text-muted italic'}`}>{eng.reviewer || 'Not assigned'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Description</h4>
        <div className="glass-card rounded-xl p-4">
          <p className={`text-[0.75rem] leading-relaxed ${eng.description ? 'text-text-secondary' : 'text-text-muted italic'}`}>{eng.description || 'No description provided yet.'}</p>
        </div>
      </div>

      {/* Setup Checklist */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Setup Checklist</h4>
        <div className="glass-card rounded-xl p-4 space-y-2">
          {checklist.map(item => (
            <div key={item.label}>
              <div className="flex items-center gap-2.5">
                {item.met ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-risk shrink-0" />}
                <span className={`text-[0.75rem] flex-1 ${item.met ? 'text-text-secondary' : 'text-risk-700 font-medium'}`}>{item.label}</span>
                {!item.met && <span className="text-[0.5625rem] font-bold text-risk-700 bg-risk-50 px-1.5 py-0.5 rounded">Required</span>}
              </div>
              {!item.met && <p className="text-[0.625rem] text-risk-700/70 ml-6 mt-0.5">{item.resolution}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <button
          onClick={() => criticalMet && onMoveToPlanned(eng.id)}
          disabled={!criticalMet}
          className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-[0.8125rem] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <ArrowRight size={14} />
          Move to Planned
        </button>
      </div>
      {!criticalMet && (
        <p className="text-[0.6875rem] text-risk-700 text-center">Complete all required items before moving to Planned.</p>
      )}
    </div>
  );
}

// ─── PLANNED VIEW ────────────────────────────────────────────────────────────

function PlannedOverview({ eng, onClose, onActivate }: { eng: EngagementData; onClose: () => void; onActivate: (id: string) => void }) {
  const checklist = getActivationChecklist(eng);
  const allCriticalMet = checklist.every(c => c.met);
  const keyControls = MOCK_RACM_CONTROLS.filter(c => c.isKey).length;
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-6">
      {/* Ready State Banner */}
      {allCriticalMet ? (
        <div className="rounded-xl border-2 border-compliant/30 bg-compliant-50/30 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-compliant-700 shrink-0" />
            <div>
              <p className="text-[0.8125rem] font-bold text-compliant-700">Ready for Activation</p>
              <p className="text-[0.6875rem] text-compliant-700/80">All prerequisites are met. Activate to create an immutable snapshot and begin execution.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-high/30 bg-high-50/30 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-high-700 shrink-0" />
            <div>
              <p className="text-[0.8125rem] font-bold text-high-700">Not Ready for Activation</p>
              <p className="text-[0.6875rem] text-high-700/80">Some prerequisites are missing. Review the checklist below.</p>
            </div>
          </div>
        </div>
      )}

      {/* Engagement Summary */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Engagement Summary</h4>
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Engagement</span><p className="text-[0.75rem] font-semibold text-text">{eng.name}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Audit Type / Framework</span><p className="text-[0.75rem] text-text">{eng.auditType} / {eng.framework}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Business Process</span><p className="text-[0.75rem] text-text">{eng.businessProcess}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Priority</span><p className={`text-[0.75rem] font-semibold ${eng.priority === 'Critical' ? 'text-risk-700' : eng.priority === 'High' ? 'text-high-700' : eng.priority === 'Medium' ? 'text-mitigated-700' : 'text-compliant-700'}`}>{eng.priority}</p></div>
          </div>
          {eng.description && <p className="text-[0.75rem] text-text-secondary leading-relaxed mt-3 pt-3 border-t border-border-light/60">{eng.description}</p>}
        </div>
      </div>

      {/* Linked RACM */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5"><FileText size={11} />Linked RACM</h4>
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-compliant-700" />
            <span className="text-[0.75rem] font-semibold text-text">{eng.sourceRacmVersionId}</span>
          </div>
        </div>
      </div>

      {/* Scope KPIs */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Scope & Resources</h4>
        <div className="grid grid-cols-4 gap-3">
          <div className="glass-card rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{eng.controls}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Total Controls</div>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-brand-700 tabular-nums">{keyControls}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Key Controls</div>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-text tabular-nums">{eng.plannedHours}</div>
            <div className="text-[0.5625rem] text-text-muted uppercase">Planned Hours</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5"><Calendar size={11} />Timeline</h4>
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-[0.625rem] text-text-muted uppercase">Audit Period</span><p className="text-[0.75rem] text-text">{eng.auditPeriodStart} — {eng.auditPeriodEnd}</p></div>
            <div><span className="text-[0.625rem] text-text-muted uppercase">Planned Dates</span><p className="text-[0.75rem] text-text">{eng.plannedStartDate || '—'} — {eng.plannedEndDate || '—'}</p></div>
          </div>
        </div>
      </div>

      {/* Assigned Users */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2 flex items-center gap-1.5"><Users size={11} />Assigned Team</h4>
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Owner / Lead Auditor</span>
              <p className="text-[0.75rem] font-medium text-text">{eng.owner}</p>
            </div>
            <div>
              <span className="text-[0.625rem] text-text-muted uppercase">Reviewer</span>
              <p className="text-[0.75rem] font-medium text-text">{eng.reviewer || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activation Checklist */}
      <div>
        <h4 className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Activation Checklist</h4>
        <div className="glass-card rounded-xl p-4 space-y-2">
          {checklist.map(item => (
            <div key={item.label}>
              <div className="flex items-center gap-2.5">
                {item.met
                  ? <CheckCircle2 size={14} className="text-compliant-700 shrink-0" />
                  : <XCircle size={14} className="text-risk-700 shrink-0" />
                }
                <span className={`text-[0.75rem] flex-1 ${item.met ? 'text-text-secondary' : 'text-risk-700 font-medium'}`}>{item.label}</span>
                {!item.met && <span className="text-[0.5625rem] font-bold text-risk-700 bg-risk-50 px-1.5 py-0.5 rounded">Required</span>}
              </div>
              {!item.met && (
                <p className="text-[0.625rem] text-risk-700/70 ml-6 mt-0.5">{item.resolution}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA — opens confirmation */}
      {!showConfirm ? (
        <>
          <button
            onClick={() => allCriticalMet && setShowConfirm(true)}
            disabled={!allCriticalMet}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-medium hover:brightness-110 text-white rounded-xl text-[0.8125rem] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap size={14} />
            Activate Engagement
          </button>
          {!allCriticalMet && <p className="text-[0.6875rem] text-risk-700 text-center">Resolve all required items before activation.</p>}
        </>
      ) : (
        /* ── ACTIVATION CONFIRMATION ── */
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium">
                <Lock size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-[0.875rem] font-bold text-text">Activate Engagement?</h3>
                <p className="text-[0.6875rem] text-text-muted">This is a controlled audit transition and cannot be undone.</p>
              </div>
            </div>

            {/* What activation does */}
            <div className="mb-4">
              <p className="text-[0.6875rem] font-bold text-text-muted uppercase mb-2">Activating this engagement will:</p>
              <div className="space-y-1.5">
                {[
                  'Create an immutable Engagement Snapshot from ' + eng.sourceRacmVersionId,
                  'Lock the engagement scope for execution',
                  'Create execution records for ' + eng.controls + ' in-scope controls',
                  'Enable population upload, sampling, evidence collection, testing, working paper, and review flows',
                  'Prevent further RACM scope changes inside this engagement',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-2 text-[0.6875rem]">
                    <ChevronRight size={10} className="text-primary mt-0.5 shrink-0" />
                    <span className="text-text-secondary">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist recap (all green) */}
            <div className="mb-4 p-3 bg-compliant-50/30 rounded-lg border border-compliant/20">
              <p className="text-[0.625rem] font-bold text-compliant-700 uppercase mb-1.5">All prerequisites verified</p>
              <div className="grid grid-cols-2 gap-1">
                {checklist.map(item => (
                  <div key={item.label} className="flex items-center gap-1.5 text-[0.625rem] text-compliant-700">
                    <CheckCircle2 size={10} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement summary */}
            <div className="p-3 bg-surface-2 rounded-lg text-[0.75rem] space-y-1 mb-4">
              <div className="flex justify-between"><span className="text-text-muted">Engagement</span><span className="font-medium text-text">{eng.name}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">RACM Version</span><span className="font-medium text-text">{eng.sourceRacmVersionId}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Controls</span><span className="font-medium text-text">{eng.controls}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Owner</span><span className="font-medium text-text">{eng.owner}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Reviewer</span><span className="font-medium text-text">{eng.reviewer}</span></div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-high-50/50 rounded-lg border border-high/20 mb-4">
              <AlertTriangle size={13} className="text-high-700 mt-0.5 shrink-0" />
              <p className="text-[0.625rem] text-high-700">This action cannot be undone. Configuration changes will be locked for the duration of execution.</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-[0.75rem] font-medium text-text-secondary hover:bg-surface-2 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={() => onActivate(eng.id)}
                className="flex-1 py-2.5 bg-gradient-to-r from-primary to-primary-medium hover:brightness-110 text-white rounded-xl text-[0.75rem] font-bold transition-all cursor-pointer flex items-center justify-center gap-2">
                <Zap size={13} />
                Confirm Activation
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── MAIN PANEL ──────────────────────────────────────────────────────────────

interface Props {
  engagement: EngagementData;
  onClose: () => void;
  onMoveToPlanned: (id: string) => void;
  onActivate: (id: string) => void;
  onUpdateEngagement?: (id: string, updates: Partial<EngagementData>) => void;
}

export default function EngagementSetupPanel({ engagement, onClose, onMoveToPlanned, onActivate, onUpdateEngagement }: Props) {
  const isDraft = engagement.status === 'draft';
  const isPlanned = engagement.status === 'planned' || engagement.status === 'frozen' || engagement.status === 'signed-off';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[560px] z-50 bg-white border-l border-border-light shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-light">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2.5 h-6 rounded-full text-[0.6875rem] font-semibold inline-flex items-center ${
                  isDraft ? 'bg-draft-50 text-draft-700' : 'bg-evidence-50 text-evidence-700'
                }`}>{isDraft ? 'Draft' : 'Planned'}</span>
                {engagement.priority && (
                  <span className={`text-[0.625rem] font-bold ${
                    engagement.priority === 'Critical' ? 'text-risk-700' : engagement.priority === 'High' ? 'text-high-700' : 'text-mitigated-700'
                  }`}>{engagement.priority} Priority</span>
                )}
              </div>
              <h2 className="text-[0.9375rem] font-bold text-text">{isDraft ? 'Engagement Setup Workspace' : 'Pre-Execution Overview'}</h2>
              <p className="text-[0.6875rem] text-text-muted mt-0.5">{engagement.name}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer shrink-0"><X size={16} className="text-text-muted" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isDraft
            ? <DraftSetup eng={engagement} onClose={onClose} onMoveToPlanned={onMoveToPlanned} onUpdate={onUpdateEngagement} />
            : <PlannedOverview eng={engagement} onClose={onClose} onActivate={onActivate} />
          }
        </div>
      </motion.div>
    </>
  );
}
