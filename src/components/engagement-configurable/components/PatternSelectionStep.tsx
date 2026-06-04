import React from 'react';
import { Shield, ClipboardCheck, Workflow, ChevronRight, Lightbulb, ArrowRight } from 'lucide-react';
import type { EngagementPatternType } from '../configurableEngagementTypes';
import { EngagementPatternType as EPT } from '../configurableEngagementTypes';
import { ENGAGEMENT_PATTERNS_LIST, type EngagementPatternDefinition } from '../engagementPatterns';

const PATTERN_ICONS: Record<string, React.ElementType> = {
  Shield,
  ClipboardCheck,
  Workflow,
};

// ── Rich metadata per pattern ──────────────────────────────────────────

const PATTERN_META: Record<string, {
  purpose: string;
  bestFor: string[];
  cta: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  iconBg: string;
}> = {
  [EPT.COMPLIANCE_CONTROL_TESTING]: {
    purpose: 'Framework-driven control testing using RACM/controls, samples, evidence, attribute testing, working paper, review, and conclusion.',
    bestFor: ['SOX / IFC / ICFR testing', 'Control effectiveness testing', 'RACM-based testing', 'Sample/evidence/attribute testing'],
    cta: 'Start Compliance Testing',
    accent: 'text-primary',
    accentBg: 'bg-primary/5',
    accentBorder: 'border-primary/20 hover:border-primary/40',
    iconBg: 'bg-primary/10',
  },
  [EPT.INTERNAL_AUDIT_ASSIGNMENT]: {
    purpose: 'Scope-driven audit assignment with announcement, IDR, analysis, observations, discussion, final report, and action tracking.',
    bestFor: ['Process & operational audits', 'Policy & SOP reviews', 'Vendor onboarding audit', 'Internal audit assignments'],
    cta: 'Start IA Assignment',
    accent: 'text-purple-600',
    accentBg: 'bg-purple-50/50',
    accentBorder: 'border-purple-200/60 hover:border-purple-300',
    iconBg: 'bg-purple-100',
  },
  [EPT.WORKFLOW_AUTOMATION_PROJECT]: {
    purpose: 'Workflow-driven automation project for running workflows, reviewing exceptions, managing cases, reports, and activity tracking.',
    bestFor: ['Continuous monitoring', 'Reconciliation automation', 'Duplicate invoice detection', 'Exception detection & MIS reporting'],
    cta: 'Start Automation Project',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-50/50',
    accentBorder: 'border-emerald-200/60 hover:border-emerald-300',
    iconBg: 'bg-emerald-100',
  },
};

const RECOMMENDATIONS = [
  { pattern: 'Compliance Control Testing', when: 'you need control testing with samples, evidence, attributes, and control conclusion.' },
  { pattern: 'Internal Audit Assignment', when: 'you need to perform an audit from scope to observations, final report, and action plan.' },
  { pattern: 'Workflow Automation Project', when: 'you need to run workflows, detect exceptions, monitor continuously, or generate automated reports.' },
];

// ─── Component ──────────────────────────────────────────────────────────

interface Props {
  selectedPattern: EngagementPatternType | null;
  onSelect: (pattern: EngagementPatternType) => void;
}

export default function PatternSelectionStep({ selectedPattern, onSelect }: Props) {
  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h2 className="text-[1.25rem] font-bold text-text tracking-tight">Engagement Library</h2>
        <p className="text-[0.8125rem] text-text-muted mt-1 leading-relaxed max-w-2xl">
          Choose the right engagement pattern for control testing, internal audit assignments, or workflow-driven automation projects.
        </p>
        <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 text-[0.6875rem] text-blue-600 max-w-2xl">
          <Lightbulb size={13} className="shrink-0 mt-0.5" />
          <span>Each engagement pattern comes with its own workflow, tabs, review steps, and reporting structure.</span>
        </div>
      </div>

      {/* ── Summary mini-cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Compliance-ready', sub: 'Control Testing', color: 'text-primary', icon: Shield },
          { label: 'IA Lifecycle', sub: 'Audit Assignment', color: 'text-purple-600', icon: ClipboardCheck },
          { label: 'Workflow Automation', sub: 'Automation Projects', color: 'text-emerald-600', icon: Workflow },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border-light bg-white px-4 py-3">
            <s.icon size={16} className={s.color} />
            <div>
              <div className={`text-[0.75rem] font-semibold ${s.color}`}>{s.label}</div>
              <div className="text-[0.625rem] text-gray-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pattern cards ── */}
      <div className="grid grid-cols-1 gap-4">
        {ENGAGEMENT_PATTERNS_LIST.map((pattern: EngagementPatternDefinition) => {
          const meta = PATTERN_META[pattern.id];
          const Icon = PATTERN_ICONS[pattern.iconName || 'Shield'] || Shield;
          if (!meta) return null;

          return (
            <div
              key={pattern.id}
              className={`rounded-2xl border bg-white overflow-hidden transition-all ${meta.accentBorder} hover:shadow-md hover:shadow-black/5`}
            >
              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl ${meta.iconBg} shrink-0`}>
                    <Icon size={20} className={meta.accent} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[0.9375rem] font-bold text-text">{pattern.label}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[0.5625rem] font-bold ${meta.accentBg} ${meta.accent}`}>
                        {pattern.displayLabel}
                      </span>
                    </div>
                    <p className="text-[0.75rem] text-text-muted leading-relaxed">{meta.purpose}</p>
                  </div>
                </div>

                {/* Best for */}
                <div className="mb-3">
                  <div className="text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Best for</div>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.bestFor.map(item => (
                      <span key={item} className="px-2 py-0.5 rounded-full bg-surface-2/50 border border-border-light/50 text-[0.625rem] text-text-muted font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Flow chips */}
                <div className="mb-4">
                  <div className="text-[0.5625rem] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Workflow</div>
                  <div className="flex flex-wrap items-center gap-1">
                    {pattern.workspaceTabs.map((tab, i) => (
                      <React.Fragment key={tab.id}>
                        <span className={`px-2 py-0.5 rounded-md text-[0.5625rem] font-semibold ${meta.accentBg} ${meta.accent}`}>
                          {tab.label}
                        </span>
                        {i < pattern.workspaceTabs.length - 1 && (
                          <ChevronRight size={9} className="text-gray-300 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => onSelect(pattern.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[0.75rem] font-semibold text-white cursor-pointer transition-all ${
                    pattern.id === EPT.COMPLIANCE_CONTROL_TESTING ? 'bg-primary hover:bg-primary/90' :
                    pattern.id === EPT.INTERNAL_AUDIT_ASSIGNMENT ? 'bg-purple-600 hover:bg-purple-700' :
                    'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {meta.cta}
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Which one should I choose? ── */}
      <div className="rounded-xl border border-border-light bg-white p-5">
        <h4 className="text-[0.8125rem] font-bold text-text mb-3 flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-500" />
          Which one should I choose?
        </h4>
        <div className="space-y-2">
          {RECOMMENDATIONS.map(rec => (
            <div key={rec.pattern} className="flex items-start gap-2 text-[0.75rem] text-text-secondary leading-relaxed">
              <span className="text-primary mt-0.5 shrink-0 font-bold">&#8226;</span>
              <span>
                Choose <span className="font-semibold text-text">{rec.pattern}</span> when {rec.when}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
