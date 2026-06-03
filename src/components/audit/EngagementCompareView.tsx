import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, Plus, X, AlertTriangle, CheckCircle2, Clock,
  Workflow, Shield, TrendingUp, GitCompare,
} from 'lucide-react';
import Orb from '../shared/Orb';
import { ENGAGEMENTS, PROCESS_COLORS, type Engagement } from '../../data/engagements';
import { exceptionsForEngagement } from '../../data/engagement-exceptions';

interface Props {
  onBack: () => void;
}

function metrics(eng: Engagement) {
  const exs = exceptionsForEngagement(eng.id);
  const open = exs.filter(e => e.status === 'Open').length;
  const triaging = exs.filter(e => e.status === 'Triaging').length;
  const resolved = exs.filter(e => e.status === 'Resolved').length;
  return {
    health: eng.health,
    controls: eng.controls,
    openIssues: open + triaging,
    closed: resolved,
    total: exs.length,
    mttr: eng.type === 'Automation' ? '6.2 h' : '2.4 d',
  };
}

const TYPE_TINT: Record<Engagement['type'], string> = {
  Compliance: 'border-brand-100 bg-brand-50/40',
  'Internal Audit': 'border-evidence-100 bg-evidence-50/40',
  Automation: 'border-compliant-100 bg-compliant-50/40',
};

const HEALTH_BAR = (h: number): string =>
  h >= 85 ? 'bg-compliant' : h >= 65 ? 'bg-mitigated-500' : 'bg-risk';

const HEALTH_TEXT = (h: number): string =>
  h >= 85 ? 'text-compliant-700' : h >= 65 ? 'text-mitigated-700' : 'text-risk-700';

export default function EngagementCompareView({ onBack }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(['eng-1', 'eng-3', 'eng-6']);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selected = useMemo(() => selectedIds.map(id => ENGAGEMENTS.find(e => e.id === id)).filter(Boolean) as Engagement[], [selectedIds]);

  const addEngagement = (id: string) => {
    if (selectedIds.includes(id) || selectedIds.length >= 4) return;
    setSelectedIds([...selectedIds, id]);
    setPickerOpen(false);
  };

  const removeEngagement = (id: string) => {
    setSelectedIds(selectedIds.filter(s => s !== id));
  };

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <Orb hoverIntensity={0.06} rotateOnHover hue={275} opacity={0.05} />
      <div className="p-8 relative">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[0.75rem] text-text-muted hover:text-primary font-medium mb-4 cursor-pointer transition-colors">
          <ArrowLeft size={14} />Back
        </button>

        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="text-[0.6875rem] font-semibold text-text-muted tracking-wider uppercase mb-1">Audit Quality</div>
            <h1 className="font-display text-[2rem] font-bold text-text leading-tight flex items-center gap-3">
              <GitCompare size={28} className="text-primary" />
              Engagement compare
            </h1>
            <p className="text-[0.8125rem] text-text-secondary mt-1.5 max-w-2xl">
              Pick 2-4 engagements to compare health, exception trends, and MTTR side-by-side.
            </p>
          </div>
          {selected.length < 4 && (
            <button
              onClick={() => setPickerOpen(p => !p)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"
            >
              <Plus size={14} />Add engagement
            </button>
          )}
        </div>

        {/* Picker dropdown */}
        {pickerOpen && (
          <div className="mb-4 glass-card rounded-xl p-3 max-w-md">
            <p className="text-[0.6875rem] text-text-muted uppercase tracking-wide font-semibold mb-2">Pick an engagement</p>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {ENGAGEMENTS.filter(e => !selectedIds.includes(e.id)).map(e => (
                <button
                  key={e.id}
                  onClick={() => addEngagement(e.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-2/40 transition-colors cursor-pointer text-left"
                >
                  <div className="w-7 h-7 rounded-lg text-white text-[0.625rem] font-bold flex items-center justify-center shrink-0" style={{ background: PROCESS_COLORS[e.process] }}>
                    {e.process}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.75rem] font-medium text-text truncate">{e.name}</div>
                    <div className="text-[0.75rem] text-text-muted">{e.type} · {e.code}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selected.length < 2 ? (
          <div className="border border-border-light rounded-xl p-14 text-center bg-white">
            <GitCompare size={28} className="text-text-muted mx-auto mb-3" />
            <p className="text-[0.875rem] font-semibold text-text mb-1">Pick at least 2 engagements to compare</p>
            <p className="text-[0.75rem] text-text-muted">Add another from the dropdown above.</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${selected.length === 2 ? 'grid-cols-2' : selected.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {selected.map((eng, i) => {
              const m = metrics(eng);
              return (
                <motion.div
                  key={eng.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`glass-card rounded-2xl p-5 border-2 ${TYPE_TINT[eng.type]} relative`}
                >
                  <button
                    onClick={() => removeEngagement(eng.id)}
                    className="absolute top-3 right-3 w-6 h-6 rounded-full text-text-muted hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <X size={12} />
                  </button>
                  <div className="flex items-start gap-3 mb-4 pr-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[0.75rem] font-bold shrink-0" style={{ background: PROCESS_COLORS[eng.process] }}>
                      {eng.process}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.75rem] font-bold text-text leading-snug">{eng.name}</div>
                      <div className="text-[0.6875rem] text-text-muted mt-0.5">{eng.type}{eng.subtype ? ` · ${eng.subtype}` : ''}</div>
                      <div className="text-[0.75rem] text-text-muted mt-0.5 font-mono">{eng.code}</div>
                    </div>
                  </div>

                  {/* Health */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[0.625rem] uppercase tracking-wide font-semibold text-text-muted">Health</span>
                      <span className={`text-[1.5rem] font-bold tabular-nums leading-none ${HEALTH_TEXT(m.health)}`}>{m.health}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full ${HEALTH_BAR(m.health)} transition-all`} style={{ width: `${m.health}%` }} />
                    </div>
                  </div>

                  {/* Metrics list */}
                  <dl className="space-y-2 text-[0.75rem] mb-4">
                    <Row icon={Shield} label="Controls / Workflows" value={m.controls} />
                    <Row icon={AlertTriangle} label="Open issues" value={m.openIssues} tone={m.openIssues > 0 ? 'text-risk-700' : 'text-text'} />
                    <Row icon={CheckCircle2} label="Resolved" value={m.closed} tone="text-compliant-700" />
                    <Row icon={Workflow} label="Linked workflows" value={4} />
                    <Row icon={Clock} label="MTTR" value={m.mttr} />
                    <Row icon={TrendingUp} label="Last activity" value={eng.lastActivity} />
                  </dl>

                  {/* Owner / Period */}
                  <div className="pt-3 border-t border-border-light/60 text-[0.6875rem] text-text-muted">
                    <div><span className="text-text-muted">Owner:</span> <span className="text-text-secondary">{eng.owner}</span></div>
                    <div className="mt-0.5"><span className="text-text-muted">Period:</span> <span className="text-text-secondary">{eng.periodStart} – {eng.periodEnd}</span></div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Differences callout */}
        {selected.length >= 2 && (
          <div className="mt-6 glass-card rounded-xl p-5">
            <h3 className="text-[0.75rem] font-bold text-ink-500 uppercase tracking-wider mb-3">Differences worth a closer look</h3>
            <ul className="space-y-2 text-[0.75rem] text-text-secondary">
              {(() => {
                const items: React.ReactNode[] = [];
                const healthRange = Math.max(...selected.map(e => e.health)) - Math.min(...selected.map(e => e.health));
                if (healthRange >= 20) {
                  const best = selected.reduce((a, b) => (a.health > b.health ? a : b));
                  const worst = selected.reduce((a, b) => (a.health < b.health ? a : b));
                  items.push(
                    <li key="health" className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-risk mt-1.5 shrink-0" />Health spread is <strong className="text-text">{healthRange} points</strong> — <span className="text-compliant-700 font-medium">{best.name}</span> leads, <span className="text-risk-700 font-medium">{worst.name}</span> trails.</li>
                  );
                }
                const openIssuesSpread = selected.map(e => metrics(e).openIssues);
                const maxOpen = Math.max(...openIssuesSpread);
                const minOpen = Math.min(...openIssuesSpread);
                if (maxOpen - minOpen >= 3) {
                  items.push(
                    <li key="open" className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-mitigated-500 mt-1.5 shrink-0" />Open-issue load varies <strong className="text-text">{maxOpen - minOpen}×</strong> — consider reallocating triage capacity.</li>
                  );
                }
                if (items.length === 0) {
                  items.push(<li key="none" className="text-text-muted">Engagements are roughly comparable — no significant outliers across health or load.</li>);
                }
                return items;
              })()}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number | string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-1.5 text-text-muted"><Icon size={11} />{label}</dt>
      <dd className={`font-bold tabular-nums ${tone ?? 'text-text'}`}>{value}</dd>
    </div>
  );
}
