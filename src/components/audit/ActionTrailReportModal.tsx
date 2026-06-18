import DatePicker from '../shared/DatePicker';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Sparkles, Calendar, Loader2, FileText, Download, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle2, Activity, Lightbulb,
} from 'lucide-react';
import { AVG_TIME_TO_CLOSE, formatChartDay, type ActivityEvent } from '../../data/engagement-activity';
import type { Engagement } from '../../data/engagements';
import { useToast } from '../shared/Toast';

type Preset = '7' | '30' | '90' | 'full' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: '90', label: 'Last 90 days' },
  { id: 'full', label: 'Full engagement period' },
  { id: 'custom', label: 'Custom range' },
];

/** Today, fixed to the prototype's current date so custom-range math is deterministic. */
const TODAY = new Date('2026-05-24');

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr);
  return Math.round((TODAY.getTime() - d.getTime()) / 86_400_000);
}

interface Props {
  eng: Engagement;
  events: ActivityEvent[];
  onClose: () => void;
}

export default function ActionTrailReportModal({ eng, events, onClose }: Props) {
  const { addToast } = useToast();
  const [preset, setPreset] = useState<Preset>('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [stage, setStage] = useState<'setup' | 'generating' | 'report'>('setup');

  const periodLabel = useMemo(() => {
    if (preset === 'full') return `Full engagement period (${eng.periodStart} – ${eng.periodEnd})`;
    if (preset === 'custom') return from && to ? `${from} → ${to}` : 'Custom range';
    return PRESETS.find(p => p.id === preset)!.label;
  }, [preset, from, to, eng.periodStart, eng.periodEnd]);

  const customValid = preset !== 'custom' || (from.trim() !== '' && to.trim() !== '');

  // Events that fall inside the selected window.
  const windowEvents = useMemo(() => {
    if (preset === 'full') return events;
    if (preset === 'custom') {
      if (!from || !to) return events;
      const hi = daysAgo(from); // older bound → larger dayOffset
      const lo = daysAgo(to);   // newer bound → smaller dayOffset
      const min = Math.min(lo, hi);
      const max = Math.max(lo, hi);
      return events.filter(e => e.dayOffset >= min && e.dayOffset <= max);
    }
    const n = Number(preset);
    return events.filter(e => e.dayOffset < n);
  }, [events, preset, from, to]);

  const metrics = useMemo(() => {
    const count = (t: ActivityEvent['type']) => windowEvents.filter(e => e.type === t).length;
    const opened = count('exception_fired');
    const closed = count('exception_closed');
    const runs = count('workflow_run');
    const assigned = count('exception_assigned');
    const classified = count('exception_classified');
    const evidence = count('evidence_uploaded');

    // Busiest day
    const byDay = new Map<number, number>();
    windowEvents.forEach(e => byDay.set(e.dayOffset, (byDay.get(e.dayOffset) ?? 0) + 1));
    const busiest = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];

    // Most active workflow
    const byWf = new Map<string, number>();
    windowEvents.forEach(e => { if (e.workflowName) byWf.set(e.workflowName, (byWf.get(e.workflowName) ?? 0) + 1); });
    const topWf = Array.from(byWf.entries()).sort((a, b) => b[1] - a[1])[0];

    // A few notable events (fired exceptions with detail first, then any with detail)
    const notable = [...windowEvents]
      .filter(e => e.type === 'exception_fired' || e.detail)
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .slice(0, 4);

    return {
      opened, closed, runs, assigned, classified, evidence,
      total: windowEvents.length,
      net: opened - closed,
      avgClose: AVG_TIME_TO_CLOSE[eng.id] ?? '—',
      busiestDay: busiest ? formatChartDay(busiest[0]) : '—',
      busiestCount: busiest ? busiest[1] : 0,
      topWorkflow: topWf ? topWf[0] : '—',
      topWorkflowCount: topWf ? topWf[1] : 0,
      notable,
    };
  }, [windowEvents, eng.id]);

  const recommendations = useMemo(() => {
    const r: string[] = [];
    if (metrics.net > 0) {
      r.push(`Open exceptions grew by ${metrics.net} over this period (${metrics.opened} opened vs ${metrics.closed} closed). Allocate additional triage capacity to prevent backlog.`);
    } else if (metrics.net < 0) {
      r.push(`The team cleared more than it opened (net ${metrics.net}). Maintain current triage cadence.`);
    }
    if (metrics.topWorkflowCount > 0) {
      r.push(`"${metrics.topWorkflow}" drove the most activity (${metrics.topWorkflowCount} events). Review its threshold tuning to reduce false positives.`);
    }
    r.push(`Average time-to-close is ${metrics.avgClose}. Consider codifying an SLA for high-severity exceptions.`);
    if (metrics.evidence === 0) {
      r.push('No evidence was attached in this window — ensure supporting documentation is captured for audit defensibility.');
    }
    return r;
  }, [metrics]);

  const handleGenerate = () => {
    if (!customValid) return;
    setStage('generating');
    window.setTimeout(() => setStage('report'), 1700);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[640px] max-h-[86vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-border-light">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary-medium shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-[1rem] font-bold text-text">Action Trail Report</h2>
              <p className="text-[0.75rem] text-text-secondary mt-0.5">{eng.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* ── Setup ── */}
        {stage === 'setup' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-[0.75rem] font-semibold text-text mb-2">Period of analysis</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold border transition-colors cursor-pointer ${
                        preset === p.id
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-text-secondary border-border hover:border-primary/30 hover:text-primary'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {preset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.75rem] font-medium text-text-secondary mb-1">From</label>
                    <DatePicker value={from} onChange={e => setFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border text-[0.8125rem] text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                  </div>
                  <div>
                    <label className="block text-[0.75rem] font-medium text-text-secondary mb-1">To</label>
                    <DatePicker value={to} onChange={e => setTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border text-[0.8125rem] text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface-2/50 border border-border-light text-[0.75rem] text-text-secondary">
                <Calendar size={13} className="text-text-muted shrink-0" />
                <span><span className="font-semibold text-text">{metrics.total}</span> events in {periodLabel.toLowerCase()}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border-light bg-surface-1/40">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[0.8125rem] font-semibold text-text-secondary transition-colors cursor-pointer">Cancel</button>
              <button
                onClick={handleGenerate}
                disabled={!customValid}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-text-muted/30 disabled:cursor-not-allowed text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
              >
                <Sparkles size={14} />Generate with AI
              </button>
            </div>
          </>
        )}

        {/* ── Generating ── */}
        {stage === 'generating' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-3">
            <Loader2 size={28} className="text-primary animate-spin" />
            <div className="text-[0.75rem] font-semibold text-text">Analysing the action trail…</div>
            <div className="text-[0.75rem] text-text-muted">Summarising {metrics.total} events across {periodLabel.toLowerCase()}</div>
          </div>
        )}

        {/* ── Report ── */}
        {stage === 'report' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[0.625rem] font-bold uppercase tracking-wide bg-primary/10 text-primary">
                  <Sparkles size={10} />AI-generated
                </span>
                <span className="text-[0.75rem] text-text-muted">{periodLabel}</span>
              </div>

              {/* Executive summary */}
              <Section icon={FileText} title="Executive summary">
                <p className="text-[0.8125rem] text-text-secondary leading-relaxed">
                  Over {periodLabel.toLowerCase()}, <span className="font-semibold text-text">{eng.name}</span> logged{' '}
                  <span className="font-semibold text-text">{metrics.total}</span> trail events —{' '}
                  <span className="font-semibold text-risk-700">{metrics.opened}</span> exceptions opened and{' '}
                  <span className="font-semibold text-compliant-700">{metrics.closed}</span> closed
                  {metrics.net > 0
                    ? `, leaving a net increase of ${metrics.net} open items`
                    : metrics.net < 0
                      ? `, a net reduction of ${Math.abs(metrics.net)} open items`
                      : ', keeping the open backlog flat'}.
                  {' '}Activity peaked on <span className="font-semibold text-text">{metrics.busiestDay}</span>
                  {metrics.topWorkflowCount > 0 && <> and was concentrated in <span className="font-semibold text-text">{metrics.topWorkflow}</span></>}.
                  Average time-to-close held at <span className="font-semibold text-text">{metrics.avgClose}</span>.
                </p>
              </Section>

              {/* Key metrics */}
              <Section icon={TrendingUp} title="Key metrics">
                <div className="grid grid-cols-3 gap-2.5">
                  <Stat label="Opened" value={metrics.opened} tone="text-risk-700" icon={AlertTriangle} />
                  <Stat label="Closed" value={metrics.closed} tone="text-compliant-700" icon={CheckCircle2} />
                  <Stat label="Workflow runs" value={metrics.runs} tone="text-text" icon={Activity} />
                  <Stat label="Assigned" value={metrics.assigned} tone="text-text" />
                  <Stat label="Classified" value={metrics.classified} tone="text-text" />
                  <Stat label="Avg close" value={metrics.avgClose} tone="text-text" />
                </div>
              </Section>

              {/* Notable events & patterns */}
              <Section icon={AlertTriangle} title="Notable events & patterns">
                <ul className="space-y-2">
                  <li className="text-[0.75rem] text-text-secondary flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    Busiest day was <span className="font-semibold text-text">{metrics.busiestDay}</span> with {metrics.busiestCount} events.
                  </li>
                  {metrics.topWorkflowCount > 0 && (
                    <li className="text-[0.75rem] text-text-secondary flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><span className="font-semibold text-text">{metrics.topWorkflow}</span> generated the most activity ({metrics.topWorkflowCount} events).</span>
                    </li>
                  )}
                  {metrics.notable.map(e => (
                    <li key={e.id} className="text-[0.75rem] text-text-secondary flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>
                        <span className="font-medium text-text">{e.title}</span>
                        {e.detail && <span className="text-text-muted"> — {e.detail}</span>}
                        <span className="text-text-muted/70"> · {formatChartDay(e.dayOffset)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              {/* Recommendations */}
              <Section icon={Lightbulb} title="Recommendations">
                <ul className="space-y-2">
                  {recommendations.map((r, i) => (
                    <li key={i} className="text-[0.75rem] text-text-secondary flex gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[0.625rem] font-bold shrink-0 mt-0.5">{i + 1}</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border-light bg-surface-1/40">
              <button
                onClick={() => setStage('setup')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[0.75rem] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />Change period
              </button>
              <button
                onClick={() => { addToast({ message: 'Action trail report exported (PDF)', type: 'success' }); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[0.8125rem] font-semibold transition-colors cursor-pointer"
              >
                <Download size={14} />Export PDF
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="text-primary" />
        <h3 className="text-[0.75rem] font-bold text-text uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: number | string; tone: string; icon?: React.ElementType }) {
  return (
    <div className="rounded-lg border border-border-light bg-white px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[0.625rem] uppercase tracking-wide font-semibold text-text-muted">{label}</span>
        {Icon && <Icon size={11} className="text-text-muted" />}
      </div>
      <div className={`text-[1.125rem] font-bold tabular-nums leading-none ${tone}`}>{value}</div>
    </div>
  );
}
