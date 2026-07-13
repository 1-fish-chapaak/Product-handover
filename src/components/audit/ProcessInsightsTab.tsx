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

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Brain, Sparkles, ShieldCheck, X, ChevronDown, Clock, ArrowRight,
  Info, Layers, Calendar, ScrollText, Database, Zap, GitBranch,
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

const DETECTED_BY_LABEL: Record<MemoryInsight['detectedBy'], { label: string; cls: string }> = {
  traceable: { label: 'Traceable rule', cls: 'bg-compliant-50 text-compliant-700' },
  formula:   { label: 'Formula', cls: 'bg-compliant-50 text-compliant-700' },
  llm:       { label: 'LLM explanation', cls: 'bg-brand-50 text-brand-700' },
  'human-gate': { label: 'Human gate', cls: 'bg-canvas text-ink-500' },
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

/** Format a dollar figure or a null (missing master value) as an em dash. */
const fmt = (n: number | null): string => (n == null ? '—' : n.toFixed(2));

// ─── Evidence strength — the honesty signal ───────────────────────────────
// Grounded in the real bundle: how many runs back the signal and how diverse
// the sources are. Thin evidence is surfaced as an explicit caveat rather than
// hidden behind a single confidence number — so a reviewer knows what is proven
// versus merely directional before they promote it to shared memory.

function evidenceStrength(insight: MemoryInsight): {
  label: string; cls: string; tone: 'strong' | 'moderate' | 'limited'; caveat?: string;
} {
  const runs = insight.evidence.runsAnalysed;
  const diversity = insight.factors.sourceDiversity;
  if (runs >= 4 && diversity >= 0.6) {
    return { label: 'Strong evidence', cls: 'bg-compliant-50 text-compliant-700', tone: 'strong' };
  }
  if (runs <= 2 || diversity < 0.55) {
    return {
      label: 'Limited evidence', cls: 'bg-mitigated-50 text-mitigated-700', tone: 'limited',
      caveat: `Early signal — based on ${runs} run${runs === 1 ? '' : 's'}. Treat as directional, not proven; confidence should rise as more runs land.`,
    };
  }
  return { label: 'Moderate evidence', cls: 'bg-canvas text-ink-600', tone: 'moderate' };
}

// ─── Sparkline (KPI drift) ────────────────────────────────────────────────

function Sparkline({ series }: { series: KpiDriftPoint[] }) {
  const w = 220, h = 56, pad = 6;
  const vals = series.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = series.map((p, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.value - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={area} fill="rgb(220 38 38 / 0.08)" />
      <path d={path} fill="none" stroke="rgb(220 38 38)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 2.5}
          fill={i === pts.length - 1 ? 'rgb(220 38 38)' : 'white'} stroke="rgb(220 38 38)" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ─── Confidence pill + factor breakdown ───────────────────────────────────

function ConfidencePill({ insight }: { insight: MemoryInsight }) {
  const [open, setOpen] = useState(false);
  const pct = displayConfidencePct(insight);
  const isCandidate = isMemoryCandidate(insight);
  const engineScored = insight.confidenceOverride != null;
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
            {engineScored ? (
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                Engine-scored composite of frequency, source diversity, recency and business impact. This is a
                single-run finding, so the score reflects within-run concentration and dollar exposure rather than
                proven multi-period recurrence — see the evidence note on the card.
              </p>
            ) : (
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
            )}
            <div className="mt-3 pt-2.5 border-t border-canvas-border flex items-center justify-between">
              <span className="text-[10px] text-ink-400 font-mono">{engineScored ? 'engine composite · single run' : 'freq × diversity × recency × impact'}</span>
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
              {ev.rows && ev.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[10.5px] border-collapse">
                    <thead>
                      <tr className="text-ink-400">
                        <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Product</th>
                        <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Contract</th>
                        <th className="text-left font-semibold uppercase tracking-wider py-1 pr-2">Exception</th>
                        <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Paid</th>
                        <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">WAC</th>
                        <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Contract $</th>
                        <th className="text-right font-semibold uppercase tracking-wider py-1 pr-2">Revised</th>
                        <th className="text-right font-semibold uppercase tracking-wider py-1">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.rows.map(r => (
                        <tr key={r.productRef} className="border-t border-canvas-border/60 align-top">
                          <td className="py-1.5 pr-2 text-ink-800 font-medium max-w-[180px]">
                            {r.product}
                            <span className="block font-mono text-ink-400 text-[9.5px]">{r.productRef}</span>
                          </td>
                          <td className="py-1.5 pr-2 font-mono text-ink-500 whitespace-nowrap">{r.contractRef}</td>
                          <td className="py-1.5 pr-2 text-ink-600">{r.remark}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmt(r.paid)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmt(r.wac)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmt(r.contractPrice)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums text-ink-700">{fmt(r.revised)}</td>
                          <td className={`py-1.5 text-right tabular-nums font-semibold ${r.difference != null && r.difference < 0 ? 'text-risk' : 'text-ink-500'}`}>
                            {r.difference != null ? r.difference.toFixed(2) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-ink-400 mt-1.5">Sampled exception rows · dollar amounts</p>
                </div>
              )}
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

function ApprovalGate({ decision, onApprove, onDismiss, onUndo }: {
  decision?: Decision;
  onApprove: (scope: string, expiry: string) => void;
  onDismiss: () => void;
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
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-ink-400 hover:text-risk transition-colors cursor-pointer"
        >
          <X size={13} /> Dismiss
        </button>
      </div>
      <p className="text-[10px] text-ink-400 mt-1.5 flex items-center gap-1">
        <Info size={10} /> Approving writes this to shared memory the Intent Agent, Data Scout &amp; Output Formatter all read from. Every decision is logged.
      </p>
    </div>
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
  const strength = evidenceStrength(insight);
  const sourceCount = insight.evidence.workflows.length + insight.evidence.entities.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-200 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${sev.iconWrap}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sev.pill}`}>
              <span className={`size-1.5 rounded-full ${sev.dot}`} /> {SEVERITY_LABEL[insight.severity]}
            </span>
            <span className="inline-flex items-center rounded-full bg-canvas text-ink-500 px-2 py-0.5 text-[10px] font-semibold">{meta.label}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${detected.cls}`}>
              {insight.detectedBy === 'llm' ? <Sparkles size={9} /> : <Zap size={9} />}{detected.label}
            </span>
            <span className="text-[10px] text-ink-400 ml-auto">{insight.scope}</span>
          </div>
          <h4 className="text-[14px] font-bold text-ink-900 leading-snug">{insight.title}</h4>
        </div>
        <div className="shrink-0"><ConfidencePill insight={insight} /></div>
      </div>

      {/* Evidence strength — scannable state + an honest caveat when the signal is thin */}
      <div className="ml-12 mt-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${strength.cls}`}>
            {strength.tone === 'limited' ? <Info size={10} /> : <ShieldCheck size={10} />}
            {strength.label}
          </span>
          <span className="text-[10.5px] text-ink-400 tabular-nums">
            {insight.evidence.runsAnalysed} runs · {sourceCount} sources · detected {insight.detectedOn}
          </span>
        </div>
        {strength.caveat && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-mitigated-200 bg-mitigated-50/50 px-3 py-2">
            <Info size={13} className="text-mitigated-700 shrink-0 mt-0.5" />
            <span className="text-[11px] text-mitigated-700 leading-relaxed">{strength.caveat}</span>
          </div>
        )}
      </div>

      {insight.series && (
        <div className="flex items-center gap-4 mt-3 ml-12 rounded-xl border border-risk/15 bg-risk-50/20 p-3">
          <Sparkline series={insight.series} />
          <div className="flex items-center gap-3">
            {insight.series.map(p => (
              <div key={p.period} className="text-center">
                <div className="text-[10px] text-ink-400">{p.period}</div>
                <div className="text-[12px] font-bold tabular-nums text-ink-800">{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[13px] text-ink-500 leading-relaxed mt-2.5 ml-12">{insight.description}</p>

      {insight.conflictsWith && (
        <div className="ml-12 mt-2.5 flex items-start gap-2 rounded-lg border border-mitigated-200 bg-mitigated-50/50 px-3 py-2">
          <GitCompareArrows size={13} className="text-mitigated-700 shrink-0 mt-0.5" />
          <span className="text-[11px] text-mitigated-700 leading-relaxed">
            Contradicts <span className="font-semibold">{insight.conflictsWith}</span>
          </span>
        </div>
      )}

      <div className="ml-12 mt-3 space-y-2.5">
        <EvidenceBundleView insight={insight} />

        <div className="rounded-lg bg-brand-50/50 border border-brand-100 px-3 py-2.5">
          {insight.recommendedActions && insight.recommendedActions.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-2">
                <ArrowRight size={12} className="text-brand-600" /> Recommended actions · {insight.recommendedActions.length}
              </div>
              <ul className="space-y-2">
                {insight.recommendedActions.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[12px] text-ink-800 leading-relaxed">
                    <span className="mt-0.5 size-4 shrink-0 rounded border border-brand-200 bg-canvas-elevated text-[9px] font-bold text-brand-700 flex items-center justify-center tabular-nums">{idx + 1}</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-start gap-2">
              <ArrowRight size={14} className="text-brand-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-0.5">Recommended action</div>
                <p className="text-[12px] text-ink-800 leading-relaxed">{insight.recommendedAction}</p>
              </div>
            </div>
          )}
        </div>

        <ApprovalGate decision={decision} onApprove={onApprove} onDismiss={onDismiss} onUndo={onUndo} />
      </div>
    </motion.div>
  );
}

// ─── Enterprise Context panel ─────────────────────────────────────────────

function EnterpriseContextPanel({ entries }: { entries: EnterpriseContextEntry[] }) {
  return (
    <div className="rounded-2xl border border-canvas-border bg-gradient-to-br from-brand-50/40 to-canvas-elevated p-5">
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
    { icon: Info, title: 'Confidence-scored', body: 'frequency × source diversity × recency × business impact. A threshold gates memory candidacy.' },
    { icon: ShieldCheck, title: 'Human-gated', body: 'Nothing reaches shared Enterprise Context without explicit analyst approval. Every decision is logged.' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {points.map(p => (
        <div key={p.title} className="rounded-xl border border-canvas-border bg-canvas-elevated p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <p.icon size={13} className="text-brand-600" />
            <span className="text-[11px] font-bold text-ink-800">{p.title}</span>
          </div>
          <p className="text-[10px] text-ink-500 leading-relaxed">{p.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Decision state ───────────────────────────────────────────────────────

interface Decision { status: ApprovalStatus; scope: string; expiry: string; }

// ─── Main tab ─────────────────────────────────────────────────────────────

export default function ProcessInsightsTab({ bpAbbr = 'P2P', bpName }: { bpAbbr?: string; bpName?: string }) {
  const insights = PROCESS_INSIGHTS;
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [showExplainer, setShowExplainer] = useState(false);

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

  const stats = [
    { label: 'Candidates pending', value: pending, tone: 'text-ink-900' },
    { label: 'High severity', value: highCount, tone: highCount > 0 ? 'text-risk' : 'text-ink-900' },
    { label: 'Runs analysed', value: runCount, tone: 'text-ink-900' },
    { label: 'In Enterprise Context', value: promoted.length, tone: 'text-compliant-700' },
  ];

  return (
    <div className="flex flex-col pt-2 pb-8">
      {/* Header */}
      <div className="pb-4">
        <div className="font-mono text-[11px] text-ink-400 mb-1 tracking-tight flex items-center gap-1.5">
          <Sparkles size={11} className="text-brand-600" /> Insight Memory Engine
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold text-ink-900 tracking-tight leading-tight">AI Insights</h2>
            <p className="text-[13px] text-ink-500 mt-1">
              Patterns memory surfaced across <span className="font-semibold text-ink-800">{runCount} run{runCount === 1 ? '' : 's'}</span> of the <span className="font-semibold text-ink-800">{bpName ?? bpAbbr}</span> process — vendor risks and pricing drift no single row can reveal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowExplainer(s => !s)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-md border text-[12px] font-semibold transition-colors cursor-pointer ${showExplainer ? 'border-brand-300 text-brand-700 bg-brand-50' : 'border-canvas-border text-ink-500 hover:border-brand-300'}`}
          >
            <Info size={13} /> How memory works
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showExplainer && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="pb-4"><EngineExplainer /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-2.5 pb-5">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-canvas-border bg-canvas-elevated p-3.5">
            <div className={`text-[24px] font-bold tabular-nums leading-none ${s.tone}`}>{s.value}</div>
            <div className="text-[11px] text-ink-400 mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Insight groups */}
      <div className="space-y-6">
        {grouped.map(g => (
          <div key={g.sev}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className={`size-2 rounded-full ${SEV[g.sev].dot}`} />
              <h3 className="text-[12px] font-bold uppercase tracking-wider text-ink-800">{SEVERITY_LABEL[g.sev]} severity</h3>
              <span className="text-[11px] text-ink-400">{g.items.length}</span>
              <div className="flex-1 h-px bg-canvas-border ml-1" />
            </div>
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
