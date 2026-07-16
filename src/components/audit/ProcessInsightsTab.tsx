// ─── Process Hub — AI Insights section ────────────────────────────────────
//
// The post-execution intelligence layer for a Business Process. Surfaces what
// the Insight Memory Engine has learned ACROSS the process's workflow runs —
// patterns no single run can reveal — and runs each candidate through a Human
// Approval Gate before it can be promoted to shared Enterprise Context.
//
// Rendered as the "AI Insights" tab inside a Process Hub business-process
// detail, so it uses the Process Hub palette (ink / brand / canvas / paper,
// with compliant | mitigated | risk for severity) — the same token system as
// the workflow executor's memory panel.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain, Sparkles, ShieldCheck, X, Maximize2, ChevronDown, Clock, ArrowRight,
  Info, Gauge, Check, Layers, Calendar, ScrollText, Database, Zap, GitBranch,
  Repeat2, TrendingUp, Users, Network, GitCompareArrows, Unplug, UserX,
  Activity, Timer, MailQuestion, CircleSlash, Undo2,
} from 'lucide-react';
import {
  PROCESS_INSIGHTS, ENTERPRISE_CONTEXT, PATTERN_META, CONFIDENCE_FACTOR_META,
  SEVERITY_ORDER, SEVERITY_LABEL, MEMORY_CANDIDATE_THRESHOLD,
  displayConfidencePct, isMemoryCandidate,
  type MemoryInsight, type InsightSeverity, type PatternType, type ApprovalStatus,
  type EnterpriseContextEntry, type KpiDriftPoint,
} from '../../data/insightMemory';

// ─── Pattern → icon map ───────────────────────────────────────────────────

const PATTERN_ICON: Record<PatternType, React.ComponentType<{ size?: number; className?: string }>> = {
  'recurring-output-anomaly': Repeat2,
  'kpi-trend-drift': TrendingUp,
  'cohort-anomaly': Users,
  'cross-workflow-correlation': Network,
  'memory-conflict': GitCompareArrows,
  'schema-decay': Unplug,
  'user-override-pattern': UserX,
  'emerging-trend': Activity,
  'workflow-efficiency-gap': Timer,
  'distribution-engagement-gap': MailQuestion,
};

// ─── Severity styling (Process Hub palette) ───────────────────────────────

const SEV: Record<InsightSeverity, { pill: string; dot: string; iconWrap: string }> = {
  high: { pill: 'bg-risk-50 text-risk border-risk/25', dot: 'bg-risk', iconWrap: 'bg-risk-50 text-risk' },
  med:  { pill: 'bg-mitigated-50 text-mitigated-700 border-mitigated-200', dot: 'bg-mitigated-700', iconWrap: 'bg-mitigated-50 text-mitigated-700' },
  low:  { pill: 'bg-canvas text-ink-500 border-canvas-border', dot: 'bg-ink-300', iconWrap: 'bg-canvas text-ink-500' },
};

const DETECTED_BY_LABEL: Record<MemoryInsight['detectedBy'], { label: string; text: string }> = {
  traceable: { label: 'Traceable rule', text: 'text-compliant-700' },
  formula:   { label: 'Formula', text: 'text-compliant-700' },
  llm:       { label: 'LLM explanation', text: 'text-brand-700' },
  'human-gate': { label: 'Human gate', text: 'text-ink-500' },
};

function confBar(pct: number): string {
  if (pct >= 70) return 'bg-compliant';
  if (pct >= MEMORY_CANDIDATE_THRESHOLD * 100) return 'bg-mitigated';
  return 'bg-ink-300';
}
function confDot(pct: number): string {
  if (pct >= 70) return 'rgb(var(--compliant, 16 185 129))';
  return pct >= 45 ? 'rgb(217 119 6)' : 'rgb(148 163 184)';
}

// ─── Sparkline (KPI drift) ────────────────────────────────────────────────

function Sparkline({ series }: { series: KpiDriftPoint[] }) {
  // Responsive: drawn in a 0–100 coordinate space, stretched to fill its container
  // (preserveAspectRatio none) with a non-scaling stroke; dots are HTML so they stay round.
  const vals = series.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const padX = 3, padY = 14;
  const pts = series.map((p, i) => {
    const x = series.length === 1 ? 50 : padX + (i / (series.length - 1)) * (100 - padX * 2);
    const y = padY + (1 - (p.value - min) / span) * (100 - padY * 2);
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},100 L${pts[0].x.toFixed(2)},100 Z`;
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={area} fill="rgb(220 38 38 / 0.08)" />
        <path d={line} fill="none" stroke="rgb(220 38 38)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pts.map((p, i) => {
        const isLast = i === pts.length - 1;
        return (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`, top: `${p.y}%`,
              width: isLast ? 9 : 6, height: isLast ? 9 : 6,
              transform: 'translate(-50%, -50%)',
              background: isLast ? 'rgb(220 38 38)' : 'rgb(255 255 255)',
              border: '1.5px solid rgb(220 38 38)',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Confidence pill + factor breakdown ───────────────────────────────────

function ConfidencePill({ insight }: { insight: MemoryInsight }) {
  const [open, setOpen] = useState(false);
  // displayConfidencePct honours an engine-scored confidenceOverride, so this
  // pill agrees with the layered-insight surfaces for single-run findings.
  const pct = displayConfidencePct(insight);
  const isCandidate = isMemoryCandidate(insight);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated px-2 py-0.5 text-[11px] font-semibold text-ink-800 hover:border-brand-300 transition-colors cursor-pointer"
        title="How this confidence was scored"
      >
        <span className="size-1.5 rounded-full" style={{ background: confDot(pct) }} />
        {pct}% confidence
        <Info size={11} className="text-ink-400" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-30 mt-2 w-[300px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-3.5"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12px] font-bold text-ink-800">Confidence breakdown</span>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-700 cursor-pointer"><X size={13} /></button>
            </div>
            <div className="space-y-2.5">
              {CONFIDENCE_FACTOR_META.map(m => {
                const v = Math.round(insight.factors[m.key] * 100);
                return (
                  <div key={m.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-ink-800">{m.label}</span>
                      <span className="font-bold tabular-nums text-ink-800">{v}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-canvas mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${confBar(v)}`} style={{ width: `${v}%` }} />
                    </div>
                    <p className="text-[10px] text-ink-400 mt-0.5">{m.hint}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2.5 border-t border-canvas-border flex items-center justify-between">
              <span className="text-[10px] text-ink-400 font-mono">freq × diversity × recency × impact</span>
              <span className={`text-[11px] font-bold ${isCandidate ? 'text-compliant-700' : 'text-ink-400'}`}>
                {pct}% {isCandidate ? '· candidate' : '· below gate'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Evidence bundle (expandable) ─────────────────────────────────────────

function EvidenceRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-ink-400 mt-0.5 shrink-0">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 w-[64px] shrink-0 mt-0.5">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function EvidenceBundleView({ insight }: { insight: MemoryInsight }) {
  const [open, setOpen] = useState(false);
  const ev = insight.evidence;
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-canvas transition-colors"
      >
        <ScrollText size={13} className="text-ink-400" />
        <span className="text-[11px] font-semibold text-ink-800">Evidence</span>
        <span className="text-[10px] text-ink-400">{ev.runsAnalysed} runs · {ev.timeWindow}</span>
        <ChevronDown size={13} className={`ml-auto text-ink-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-canvas-border/60">
              <EvidenceRow icon={<Layers size={12} />} label="Workflows">
                <div className="flex flex-wrap gap-1">
                  {ev.workflows.map(w => (
                    <span key={w} className="inline-flex items-center rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 text-[10px] font-semibold">{w}</span>
                  ))}
                </div>
              </EvidenceRow>
              <EvidenceRow icon={<Database size={12} />} label="Entities">
                <div className="flex flex-wrap gap-1">
                  {ev.entities.map(e => (
                    <span key={e} className="inline-flex items-center rounded-md bg-canvas text-ink-700 px-1.5 py-0.5 text-[10px] font-mono">{e}</span>
                  ))}
                </div>
              </EvidenceRow>
              {ev.kpiValues && ev.kpiValues.length > 0 && (
                <EvidenceRow icon={<TrendingUp size={12} />} label="KPI values">
                  <div className="flex flex-wrap gap-2">
                    {ev.kpiValues.map(k => (
                      <span key={k.label} className="text-[11px] text-ink-700">
                        {k.label}: <span className="font-bold tabular-nums">{k.value}</span>
                        {k.delta && <span className="text-risk font-semibold ml-1">{k.delta}</span>}
                      </span>
                    ))}
                  </div>
                </EvidenceRow>
              )}
              {ev.runRefs && ev.runRefs.length > 0 && (
                <EvidenceRow icon={<Clock size={12} />} label="Source runs">
                  <div className="flex flex-col gap-1">
                    {ev.runRefs.map(r => (
                      <div key={r.id} className="flex items-center gap-2 text-[11px]">
                        <span className="text-ink-700 font-medium">{r.label}</span>
                        <span className="text-ink-400 ml-auto tabular-nums">{r.date}</span>
                      </div>
                    ))}
                  </div>
                </EvidenceRow>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Approval gate ────────────────────────────────────────────────────────

const SCOPE_PRESETS = ['All AP workflows', 'This business process', 'This workflow only'];
const EXPIRY_PRESETS = ['No expiry', 'Review in 30 days', 'Review in 90 days'];

function ApprovalGate({ decision, onApprove, onUndo }: {
  decision?: Decision;
  onApprove: (scope: string, expiry: string) => void;
  onUndo: () => void;
}) {
  const [scoping, setScoping] = useState(false);
  const [scope, setScope] = useState(SCOPE_PRESETS[0]);
  const [expiry, setExpiry] = useState(EXPIRY_PRESETS[0]);

  if (decision?.status === 'approved' || decision?.status === 'scoped') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-compliant-50 border border-compliant/30 px-3 py-2">
        <ShieldCheck size={14} className="text-compliant-700 shrink-0" />
        <span className="text-[12px] font-semibold text-compliant-700">Promoted to Enterprise Context</span>
        <span className="text-[11px] text-compliant-700/80">· {decision.scope}{decision.expiry && decision.expiry !== 'No expiry' ? ` · ${decision.expiry}` : ''}</span>
        <button type="button" onClick={onUndo} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-compliant-700 hover:text-compliant-800 cursor-pointer">
          <Undo2 size={11} /> Undo
        </button>
      </div>
    );
  }
  if (decision?.status === 'dismissed') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-canvas border border-canvas-border px-3 py-2">
        <CircleSlash size={14} className="text-ink-400 shrink-0" />
        <span className="text-[12px] font-medium text-ink-500">Dismissed — memory may re-surface this if the signal strengthens</span>
        <button type="button" onClick={onUndo} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline cursor-pointer">
          <Undo2 size={11} /> Undo
        </button>
      </div>
    );
  }

  return (
    <div>
      <AnimatePresence initial={false}>
        {scoping && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="rounded-lg border border-canvas-border bg-canvas/50 p-3 mb-2 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Scope</div>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPE_PRESETS.map(s => (
                    <button key={s} type="button" onClick={() => setScope(s)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${scope === s ? 'bg-brand-600 text-white' : 'bg-canvas-elevated border border-canvas-border text-ink-500 hover:border-brand-300'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Expiry</div>
                <div className="flex flex-wrap gap-1.5">
                  {EXPIRY_PRESETS.map(e => (
                    <button key={e} type="button" onClick={() => setExpiry(e)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${expiry === e ? 'bg-brand-600 text-white' : 'bg-canvas-elevated border border-canvas-border text-ink-500 hover:border-brand-300'}`}>{e}</button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onApprove(scope, expiry)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-500 transition-colors cursor-pointer"
        >
          <ShieldCheck size={13} /> Approve &amp; promote
        </button>
        <button
          type="button"
          onClick={() => setScoping(s => !s)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${scoping ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
        >
          <GitBranch size={13} /> Adjust scope
        </button>
      </div>
      <p className="text-[10px] text-ink-400 mt-2 flex items-start gap-1.5 leading-relaxed">
        <Info size={11} className="mt-px shrink-0" /> Approving writes this to shared memory the Intent Agent, Data Scout &amp; Output Formatter all read from. Every decision is logged.
      </p>
    </div>
  );
}

// ─── KPI chart (large, expanded view) ────────────────────────────────────

function LargeKpiChart({ series }: { series: KpiDriftPoint[] }) {
  const vals = series.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const padX = 5, padY = 18;
  const pts = series.map((p, i) => {
    const x = series.length === 1 ? 50 : padX + (i / (series.length - 1)) * (100 - padX * 2);
    const y = padY + (1 - (p.value - min) / span) * (100 - padY * 2);
    return { x, y };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},100 L${pts[0].x.toFixed(2)},100 Z`;
  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-px w-full bg-canvas-border/50" />)}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={area} fill="rgb(220 38 38 / 0.07)" />
          <path d={line} fill="none" stroke="rgb(220 38 38)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1;
          return (
            <div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}>
              <span className={`absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap text-[14px] font-bold tabular-nums ${isLast ? 'text-risk' : 'text-ink-800'}`}>
                {series[i].label}
              </span>
              <span className="block rounded-full" style={{ width: isLast ? 14 : 10, height: isLast ? 14 : 10, background: isLast ? 'rgb(220 38 38)' : 'rgb(255 255 255)', border: '2px solid rgb(220 38 38)' }} />
            </div>
          );
        })}
      </div>
      <div className="relative mt-4 h-5">
        {pts.map((p, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-[12px] font-medium text-ink-500" style={{ left: `${p.x}%` }}>{series[i].period}</span>
        ))}
      </div>
    </div>
  );
}

function KpiChartModal({ insight, onClose }: { insight: MemoryInsight; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const meta = PATTERN_META[insight.type];
  const ev = insight.evidence;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="flex h-[800px] max-h-[90vh] w-[1000px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-canvas-border bg-canvas-elevated shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-canvas-border px-6 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold text-ink-500">{meta.label}</span>
              <span className="text-[11px] text-ink-400">{insight.scope}</span>
            </div>
            <h3 className="text-[17px] font-bold leading-snug text-ink-900">{insight.title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-canvas hover:text-ink-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 p-6">
          <div className="h-full rounded-xl border border-canvas-border bg-canvas/40 p-6 pt-8">
            {insight.series && <LargeKpiChart series={insight.series} />}
          </div>
        </div>

        <div className="space-y-2 border-t border-canvas-border px-6 py-4">
          <p className="text-[13px] leading-relaxed text-ink-600">{insight.description}</p>
          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            <ScrollText size={13} />
            <span>{ev.runsAnalysed} runs · {ev.timeWindow}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────

function InsightCard({ insight, decision, onApprove, onDismiss, onUndo }: {
  insight: MemoryInsight;
  decision?: Decision;
  onApprove: (scope: string, expiry: string) => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const meta = PATTERN_META[insight.type];
  const Icon = PATTERN_ICON[insight.type];
  const sev = SEV[insight.severity];
  const detected = DETECTED_BY_LABEL[insight.detectedBy];
  const [chartOpen, setChartOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-200 transition-colors"
    >
      <div className="flex gap-3.5">
        <span className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${sev.iconWrap}`}>
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          {/* Title on the left; severity / type / confidence grouped on the right */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h4 className="text-[15px] font-bold text-ink-900 leading-snug">{insight.title}</h4>
              <p className="text-[11px] text-ink-400 mt-1">{insight.scope}</p>
            </div>
            <div className="flex items-center justify-end gap-3 shrink-0">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sev.pill}`}>
                <span className={`size-1.5 rounded-full ${sev.dot}`} /> {SEVERITY_LABEL[insight.severity]}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                <span className="font-semibold text-ink-600">{meta.label}</span>
                <span className="text-ink-300">·</span>
                <span className={`inline-flex items-center gap-1 font-semibold ${detected.text}`}>
                  {insight.detectedBy === 'llm' ? <Sparkles size={11} /> : <Zap size={11} />} {detected.label}
                </span>
              </span>
              <ConfidencePill insight={insight} />
            </div>
          </div>
        </div>
      </div>

          {insight.series ? (
            /* 2×2 grid — left: description (top) + Evidence (bottom) · right: graph (top) + KPI (bottom) */
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="flex flex-col justify-between gap-3 min-w-0">
                <div className="space-y-2.5">
                  <p className="text-[13px] text-ink-500 leading-relaxed">{insight.description}</p>
                  {insight.conflictsWith && (
                    <div className="flex items-start gap-2 rounded-lg border border-mitigated-200 bg-mitigated-50/50 px-3 py-2">
                      <GitCompareArrows size={13} className="text-mitigated-700 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-mitigated-700 leading-relaxed">
                        Contradicts <span className="font-semibold">{insight.conflictsWith}</span>
                      </span>
                    </div>
                  )}
                </div>
                <EvidenceBundleView insight={insight} />
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-canvas-border bg-canvas/40 p-3">
                <button
                  type="button"
                  onClick={() => setChartOpen(true)}
                  title="Expand chart"
                  className="group relative min-h-[64px] flex-1 cursor-pointer rounded-md transition-colors hover:bg-canvas/50"
                >
                  <Sparkline series={insight.series} />
                  <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md bg-canvas-elevated/90 text-ink-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    <Maximize2 size={13} />
                  </span>
                </button>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${insight.series.length}, minmax(0, 1fr))` }}>
                  {insight.series.map((p, idx) => (
                    <div key={p.period} className="text-center">
                      <div className="text-[10px] text-ink-400">{p.period}</div>
                      <div className={`text-[12px] font-bold tabular-nums ${idx === insight.series!.length - 1 ? 'text-risk' : 'text-ink-800'}`}>{p.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-ink-500 leading-relaxed mt-2.5">{insight.description}</p>
              {insight.conflictsWith && (
                <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-mitigated-200 bg-mitigated-50/50 px-3 py-2">
                  <GitCompareArrows size={13} className="text-mitigated-700 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-mitigated-700 leading-relaxed">
                    Contradicts <span className="font-semibold">{insight.conflictsWith}</span>
                  </span>
                </div>
              )}
              <div className="mt-3">
                <EvidenceBundleView insight={insight} />
              </div>
            </>
          )}

      {/* Action zone — recommendation + decision, as a full-width canvas footer */}
      <div className="mt-4 pt-3.5 border-t border-dotted border-canvas-border space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowRight size={12} className="text-brand-600 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">Recommended action</span>
            </div>
            <p className="text-[12px] text-ink-800 leading-relaxed">{insight.recommendedAction}</p>
          </div>
          {!decision && (
            <button
              type="button"
              onClick={onDismiss}
              title="Dismiss"
              aria-label="Dismiss insight"
              className="flex size-7 shrink-0 -mr-1 items-center justify-center rounded-md text-ink-400 hover:text-risk hover:bg-risk-50 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <ApprovalGate decision={decision} onApprove={onApprove} onUndo={onUndo} />
      </div>

      {createPortal(
        <AnimatePresence>
          {chartOpen && insight.series && (
            <KpiChartModal insight={insight} onClose={() => setChartOpen(false)} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </motion.div>
  );
}

// ─── Enterprise Context panel ─────────────────────────────────────────────

function EnterpriseContextPanel({ entries }: { entries: EnterpriseContextEntry[] }) {
  return (
    <div className="rounded-2xl border border-canvas-border bg-brand-50/40 p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="size-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center"><Brain size={16} /></span>
        <div>
          <h3 className="text-[15px] font-bold text-ink-900 leading-tight">Enterprise Context</h3>
          <p className="text-[11px] text-ink-500">Governed institutional memory · shared across the tenant · read by every future run</p>
        </div>
        <span className="ml-auto inline-flex items-center rounded-full bg-canvas-elevated border border-canvas-border px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-800">{entries.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {entries.map(e => (
          <motion.div key={e.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-canvas-border bg-canvas-elevated px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <ShieldCheck size={13} className="text-compliant-700 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-ink-800 font-medium leading-snug">{e.fact}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1 text-[10px] text-ink-400">
                  <span className="inline-flex items-center rounded bg-canvas px-1.5 py-0.5 font-semibold text-ink-500">{e.scope}</span>
                  <span>{e.origin}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span>Approved by {e.approvedBy} · {e.approvedOn}</span>
                    {e.expiry && <span className="inline-flex items-center gap-1 text-mitigated-700"><Calendar size={10} />{e.expiry}</span>}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── How-it-works strip ───────────────────────────────────────────────────

function EngineExplainer() {
  const points = [
    { icon: Zap, title: 'Heuristic-first', body: 'Traceable rules and thresholds detect every pattern. The LLM only writes the explanation — it can’t invent evidence.' },
    { icon: Network, title: 'Correlated across runs', body: 'Signals are joined across runs, workflows, entities and time — surfacing what no single run can show.' },
    { icon: Gauge, title: 'Confidence-scored', body: 'frequency × source diversity × recency × business impact. A threshold gates memory candidacy.' },
    { icon: ShieldCheck, title: 'Human-gated', body: 'Nothing reaches shared Enterprise Context without explicit analyst approval. Every decision is logged.' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {points.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 360, damping: 22 }}
          className="rounded-xl border border-canvas-border bg-canvas-elevated p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <p.icon size={16} strokeWidth={2} />
            </span>
            <span className="font-mono text-[11px] font-medium tabular-nums text-ink-300">{`0${i + 1}`}</span>
          </div>
          <h4 className="text-[13px] font-semibold tracking-tight text-ink-900">{p.title}</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{p.body}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Decision state ───────────────────────────────────────────────────────

interface Decision { status: ApprovalStatus; scope: string; expiry: string; }

// ─── Severity filter (dropdown) ───────────────────────────────────────────

function SeverityFilterMenu({ insights, active, onToggle, onReset }: {
  insights: MemoryInsight[];
  active: Set<InsightSeverity>;
  onToggle: (sev: InsightSeverity) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const allActive = active.size === SEVERITY_ORDER.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${open || !allActive ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
      >
        Severity
        {!allActive && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold tabular-nums text-white">{active.size}</span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-30 mt-2 w-[224px] rounded-xl border border-canvas-border bg-canvas-elevated shadow-xl p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Filter by severity</span>
              <button
                type="button"
                onClick={onReset}
                disabled={allActive}
                className="text-[11px] font-semibold text-brand-700 hover:underline cursor-pointer disabled:text-ink-300 disabled:no-underline disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
            <div className="space-y-0.5">
              {SEVERITY_ORDER.map(sev => {
                const checked = active.has(sev);
                const count = insights.filter(i => i.severity === sev).length;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => onToggle(sev)}
                    aria-pressed={checked}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-canvas transition-colors cursor-pointer"
                  >
                    <span className={`flex size-4 items-center justify-center rounded border transition-colors ${checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-canvas-border bg-canvas-elevated'}`}>
                      {checked && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className={`size-1.5 rounded-full ${SEV[sev].dot}`} />
                    <span className="flex-1 text-[12px] font-medium text-ink-800">{SEVERITY_LABEL[sev]}</span>
                    <span className="text-[11px] tabular-nums text-ink-400">{count}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────

export default function ProcessInsightsTab({ bpAbbr = 'P2P', bpName }: { bpAbbr?: string; bpName?: string }) {
  const insights = PROCESS_INSIGHTS;
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [showExplainer, setShowExplainer] = useState(false);
  const [activeSeverities, setActiveSeverities] = useState<Set<InsightSeverity>>(() => new Set(SEVERITY_ORDER));
  const toggleSeverity = (sev: InsightSeverity) =>
    setActiveSeverities(prev => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev); else next.add(sev);
      return next;
    });

  const runCount = insights.reduce((max, i) => Math.max(max, i.evidence.runsAnalysed), 0);

  const approve = (id: string) => (scope: string, expiry: string) =>
    setDecisions(d => ({ ...d, [id]: { status: 'scoped', scope, expiry } }));
  const dismiss = (id: string) => () =>
    setDecisions(d => ({ ...d, [id]: { status: 'dismissed', scope: '', expiry: '' } }));
  const undo = (id: string) => () =>
    setDecisions(d => { const next = { ...d }; delete next[id]; return next; });

  const promoted = useMemo<EnterpriseContextEntry[]>(() => {
    const fromApprovals = insights
      .filter(i => { const s = decisions[i.id]?.status; return s === 'approved' || s === 'scoped'; })
      .map<EnterpriseContextEntry>(i => ({
        id: `ec-${i.id}`,
        fact: i.recommendedAction,
        origin: `Promoted from ${PATTERN_META[i.type].label} · ${i.scope}`,
        approvedBy: 'You',
        approvedOn: '28 Jun 2026',
        scope: decisions[i.id]?.scope || 'This business process',
        expiry: decisions[i.id]?.expiry && decisions[i.id]?.expiry !== 'No expiry' ? decisions[i.id]?.expiry : undefined,
      }));
    return [...fromApprovals, ...ENTERPRISE_CONTEXT];
  }, [decisions, insights]);

  const pending = insights.filter(i => !decisions[i.id]).length;
  const highCount = insights.filter(i => i.severity === 'high' && !decisions[i.id]).length;

  const grouped = useMemo(() => SEVERITY_ORDER.map(sev => ({
    sev, items: insights.filter(i => i.severity === sev),
  })).filter(g => g.items.length > 0), [insights]);
  const visibleGroups = grouped.filter(g => activeSeverities.has(g.sev));

  const stats = [
    { label: 'Candidates pending', value: pending, tone: 'text-ink-900', Icon: Gauge, iconWrap: 'bg-brand-50 text-brand-600' },
    { label: 'High severity', value: highCount, tone: highCount > 0 ? 'text-risk' : 'text-ink-900', Icon: TrendingUp, iconWrap: highCount > 0 ? 'bg-risk-50 text-risk' : 'bg-canvas text-ink-400' },
    { label: 'Runs analysed', value: runCount, tone: 'text-ink-900', Icon: Database, iconWrap: 'bg-canvas text-ink-500' },
    { label: 'In Enterprise Context', value: promoted.length, tone: 'text-compliant-700', Icon: ShieldCheck, iconWrap: 'bg-compliant-50 text-compliant-700' },
  ];

  return (
    <div className="flex flex-col pt-2 pb-8">
      {/* Header */}
      <div className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] text-ink-500 mt-1">
              Patterns memory learned across <span className="font-semibold text-ink-800">{runCount} runs</span> of the <span className="font-semibold text-ink-800">{bpName ?? bpAbbr}</span> process — risks and drift no single run can reveal.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeverityFilterMenu
              insights={insights}
              active={activeSeverities}
              onToggle={toggleSeverity}
              onReset={() => setActiveSeverities(new Set(SEVERITY_ORDER))}
            />
            <button
              type="button"
              onClick={() => setShowExplainer(s => !s)}
              className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${showExplainer ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
            >
              <Info size={13} /> How memory works
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showExplainer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.25 } }}
            className="overflow-hidden"
          >
            <div className="pb-4"><EngineExplainer /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary bar — the detection → promotion funnel, in one cohesive strip */}
      <div className="grid grid-cols-4 divide-x divide-canvas-border rounded-xl border border-canvas-border bg-canvas-elevated mb-6 overflow-hidden">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-3 px-4 py-3.5">
            <span className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${s.iconWrap}`}>
              <s.Icon size={16} />
            </span>
            <div className="min-w-0">
              <div className={`text-[22px] font-bold tabular-nums leading-none ${s.tone}`}>{s.value}</div>
              <div className="text-[11px] text-ink-400 mt-1 truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Insight groups */}
      <div className="space-y-6">
        {visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-elevated py-10 text-center">
            <p className="text-[13px] font-semibold text-ink-700">No insights match this filter</p>
            <button type="button" onClick={() => setActiveSeverities(new Set(SEVERITY_ORDER))} className="mt-1.5 text-[12px] font-semibold text-brand-700 hover:underline cursor-pointer">Show all severities</button>
          </div>
        ) : visibleGroups.map(g => (
          <div key={g.sev}>
            <div className="space-y-3">
              {g.items.map(i => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  decision={decisions[i.id]}
                  onApprove={approve(i.id)}
                  onDismiss={dismiss(i.id)}
                  onUndo={undo(i.id)}
                />
              ))}
            </div>
          </div>
        ))}

        <EnterpriseContextPanel entries={promoted} />
      </div>
    </div>
  );
}
