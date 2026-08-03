import { useState } from 'react';
import { ArrowRight, ChevronDown, Lightbulb, ExternalLink, Sparkles, Check } from 'lucide-react';
import { getSopRelationships } from '../../data/processHubJoins';
import { SOP_AI_RECOMMENDATIONS } from '../../data/mockData';
import {
  getActionsForTarget, getActionStatus, actionKey, useInsightCacheVersion,
  type TargetedAction,
} from '../shared/insightCache';
import { ActionDrawer, InsightDrawer } from '../shared/TargetedActions';
import type { LayeredInsight } from '../../data/layeredInsights';

// Severity → soft pastel card tint + matching hairline + id colour + meta badge
// (critical=risk, high=high, medium=mitigated, low=compliant). Replaces the old
// 3px left stripe with a full soft tint so the card reads its severity at a glance.
const SEVERITY: Record<string, { card: string; id: string; badge: string; label: string }> = {
  critical: { card: 'bg-risk-50 border-risk-100', id: 'text-risk-700', badge: 'bg-risk-100 text-risk-700', label: 'Critical' },
  high: { card: 'bg-high-50 border-high-100', id: 'text-high-700', badge: 'bg-high-100 text-high-700', label: 'High' },
  medium: { card: 'bg-mitigated-50 border-mitigated-100', id: 'text-mitigated-700', badge: 'bg-mitigated-100 text-mitigated-700', label: 'Medium' },
  low: { card: 'bg-compliant-50 border-compliant-100', id: 'text-compliant-700', badge: 'bg-compliant-100 text-compliant-700', label: 'Low' },
};

// Control status → soft pastel card tint + matching hairline + id colour + badge.
const CTRL_STATUS: Record<string, { card: string; id: string; badge: string; label: string }> = {
  effective: { card: 'bg-compliant-50 border-compliant-100', id: 'text-compliant-700', badge: 'bg-compliant-100 text-compliant-700', label: 'Effective' },
  ineffective: { card: 'bg-risk-50 border-risk-100', id: 'text-risk-700', badge: 'bg-risk-100 text-risk-700', label: 'Ineffective' },
  'not-tested': { card: 'bg-draft-50 border-canvas-border', id: 'text-draft-700', badge: 'bg-paper-200 text-ink-600', label: 'Not tested' },
};

// AI recommendation kind → tone for the small type tag.
const REC_TYPE: Record<string, string> = {
  add: 'bg-compliant-50 text-compliant-700',
  improve: 'bg-evidence-50 text-evidence-700',
  update: 'bg-mitigated-50 text-mitigated-700',
  remove: 'bg-risk-50 text-risk-700',
};

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">{children}</p>;
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center self-center pt-6" aria-hidden="true">
      <ArrowRight size={20} className="text-ink-300" />
    </div>
  );
}

// A generated action's intent, mapped into the SOP chips' existing type/impact
// vocabulary so both sources read as one list.
const INTENT_TO_TYPE: Record<string, string> = { create: 'add', edit: 'update', retest: 'improve', aggregate: 'improve', monitor: 'improve' };
const PRIORITY_TO_IMPACT: Record<string, 'high' | 'medium' | 'low'> = { 'do-now': 'high', 'this-period': 'medium', advisory: 'low' };

export default function SopRelationshipMap({ sopId, sopName }: { sopId?: string; sopName: string }) {
  const [recsOpen, setRecsOpen] = useState(false);
  const [drawerAction, setDrawerAction] = useState<TargetedAction | null>(null);
  const [insightDetail, setInsightDetail] = useState<LayeredInsight | null>(null);
  // Re-render when a generation completes anywhere — insight-sourced actions
  // targeting this SOP appear live once the engagement-level Generate runs.
  useInsightCacheVersion();

  const rel = sopId ? getSopRelationships(sopId) : { racm: null, risks: [], controls: [] };
  const { racm, risks, controls } = rel;
  const recs = sopId ? SOP_AI_RECOMMENDATIONS[sopId] ?? [] : [];
  // Actions that landed HERE from generated insights (Rule 2: a missing
  // control has no row of its own, so "create" actions surface on the SOP).
  const generated = sopId
    ? getActionsForTarget('sop', sopId).filter(a => getActionStatus(a) !== 'dismissed')
    : [];
  const totalRecs = generated.length + recs.length;

  const bpId = racm?.bpId ?? risks[0]?.bpId ?? '';
  const openInHub = (section: string, key: string, id: string) => {
    if (!id || !bpId) return;
    const params = new URLSearchParams({ view: 'bp-detail', bp: bpId, section });
    params.set(key, id);
    window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank');
  };

  if (!racm && risks.length === 0 && controls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <p className="text-[0.875rem] font-semibold text-ink-700">No linked entities</p>
        <p className="text-[0.8125rem] text-ink-400 mt-1">This SOP isn’t linked to a RACM, risks, or controls yet.</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      {/* Columns: SOP → RACMs → Risks → Controls */}
      <div className="flex items-start gap-3 pb-2">
        {/* SOP — the subject of this preview, not a drill target */}
        <div className="flex-1 min-w-0">
          <ColumnHeader>SOP</ColumnHeader>
          <div className="w-full rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-brand-600">SOP</p>
            <p className="mt-0.5 text-[0.8125rem] font-semibold text-brand-700 leading-snug">{sopName}</p>
          </div>
        </div>

        <Arrow />

        {/* RACM */}
        <div className="flex-1 min-w-0">
          <ColumnHeader>RACMs</ColumnHeader>
          {racm ? (
            <button
              type="button"
              onClick={() => openInHub('racm', 'racm', racm.id.toLowerCase())}
              title="Open RACM in a new tab"
              className="group w-full rounded-lg border border-evidence-100 bg-evidence-50 px-3 py-2.5 text-left transition-shadow hover:shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className="flex items-center gap-1 font-mono text-[0.75rem] font-semibold text-evidence-700">
                {racm.id}
                <ExternalLink size={11} className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
              <p className="mt-0.5 text-[0.78125rem] font-medium text-ink-800 leading-snug line-clamp-2">{racm.name}</p>
            </button>
          ) : (
            <div className="w-full rounded-lg border border-dashed border-canvas-border bg-paper-50 px-3 py-2.5 text-[0.75rem] text-ink-400">No RACM</div>
          )}
        </div>

        <Arrow />

        {/* Risks */}
        <div className="flex-1 min-w-0">
          <ColumnHeader>Risks</ColumnHeader>
          <div className="flex flex-col gap-2">
            {risks.map((r) => {
              const sev = SEVERITY[r.severity] ?? SEVERITY.medium;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openInHub('risks', 'risk', r.id)}
                  title="Open risk in a new tab"
                  className={`group w-full rounded-lg border px-3 py-2.5 text-left transition-shadow hover:shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${sev.card}`}
                >
                  <span className={`flex items-center gap-1 font-mono text-[0.75rem] font-semibold ${sev.id}`}>
                    {r.id}
                    <ExternalLink size={11} className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <p className="mt-0.5 text-[0.78125rem] font-medium text-ink-800 leading-snug line-clamp-2">{r.name}</p>
                  <span className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${sev.badge}`}>{sev.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Arrow />

        {/* Controls */}
        <div className="flex-1 min-w-0">
          <ColumnHeader>Controls</ColumnHeader>
          <div className="flex flex-col gap-2">
            {controls.map((c) => {
              const status = CTRL_STATUS[c.status] ?? null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openInHub('controls', 'control', c.id)}
                  title="Open control in a new tab"
                  className={`group w-full rounded-lg border px-3 py-2.5 text-left transition-shadow hover:shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${status?.card ?? 'border-canvas-border bg-white'}`}
                >
                  <span className={`flex items-center gap-1 font-mono text-[0.75rem] font-semibold ${status?.id ?? 'text-ink-700'}`}>
                    {c.id}
                    <ExternalLink size={11} className="text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <p className="mt-0.5 text-[0.78125rem] font-medium text-ink-800 leading-snug line-clamp-2">{c.name}</p>
                  {status && (
                    <span className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${status.badge}`}>{status.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Recommendations — flat disclosure (no sparkle / no gradient per DESIGN.md).
          Two sources in one list: insight-sourced targeted actions first (click
          to act in place, with provenance), then the baseline document-scan recs. */}
      {totalRecs > 0 && (
        <div className="mt-6 rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
          <button
            type="button"
            onClick={() => setRecsOpen((o) => !o)}
            aria-expanded={recsOpen}
            className="flex w-full items-center gap-2 px-4 py-3 hover:bg-paper-50/60 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Lightbulb size={15} className="text-brand-600" />
            <span className="text-[0.8125rem] font-semibold text-ink-900">AI Recommendations</span>
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-50 text-brand-700 text-[0.6875rem] font-bold tabular-nums">{totalRecs}</span>
            {generated.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-brand-600">
                <Sparkles size={10} aria-hidden="true" /> {generated.length} from insights
              </span>
            )}
            <ChevronDown size={16} className={`ml-auto text-ink-400 transition-transform ${recsOpen ? '' : '-rotate-90'}`} />
          </button>
          {recsOpen && (
            <ul className="px-4 pb-3 pt-1 border-t border-canvas-border space-y-2.5">
              {generated.map((a) => {
                const applied = getActionStatus(a) === 'applied';
                const type = INTENT_TO_TYPE[a.rec.intent ?? ''] ?? 'improve';
                const impact = PRIORITY_TO_IMPACT[a.rec.priority];
                return (
                  <li key={actionKey(a)}>
                    <button
                      type="button"
                      onClick={() => setDrawerAction(a)}
                      title="Review this action — apply it, work it in Ask IRA, or dismiss it"
                      className="group flex w-full items-start gap-2.5 text-left cursor-pointer"
                    >
                      <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide ${applied ? 'bg-compliant-50 text-compliant-700' : REC_TYPE[type] ?? 'bg-paper-100 text-ink-600'}`}>
                        {applied ? <Check size={11} aria-hidden="true" /> : type}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[0.8125rem] leading-snug transition-colors ${applied ? 'text-ink-500' : 'text-ink-700 group-hover:text-brand-700'}`}>{a.rec.title}</span>
                        <span className="mt-0.5 flex items-center gap-2 text-[0.65625rem]">
                          <span className={`font-bold ${impact === 'high' ? 'text-risk-700' : impact === 'medium' ? 'text-mitigated-700' : 'text-ink-500'}`}>{impact} impact</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
                            <Sparkles size={9} aria-hidden="true" /> from insight · {a.source.subjectLabel}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {recs.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide ${REC_TYPE[rec.type] ?? 'bg-paper-100 text-ink-600'}`}>{rec.type}</span>
                  <p className="text-[0.8125rem] text-ink-700 leading-snug">{rec.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Act-in-place drawer for an insight-sourced action. */}
      <ActionDrawer
        action={drawerAction}
        onClose={() => setDrawerAction(null)}
        onViewAnchor={() => { if (drawerAction) setInsightDetail(drawerAction.source); }}
      />
      <InsightDrawer insight={insightDetail} onClose={() => setInsightDetail(null)} />
    </div>
  );
}
