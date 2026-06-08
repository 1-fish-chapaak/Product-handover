import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle, Shield, Workflow as WorkflowIcon, Activity, Clock,
  ChevronRight, Info, FileText, History, TrendingUp, Flame,
} from 'lucide-react';

// ── Shapes (loose — mirrors the untyped mock seeds in mockData.ts) ──────────
export interface OvRisk { id: string; name: string; ctls: number; keyCtls: number; lastUpdated: string | null; severity: string; bpId: string; status: string }
export interface OvControl { id: string; name: string; desc: string; isKey: boolean; riskId: string; status: string }
export interface OvWorkflow { id: string; name: string; desc: string; bpId: string; type: string; lastRun: string | null; runs: number; status: string }
export interface OvSop { id: string; name: string; version: string; by: string; at: string; racmId: string | null; status: string }
export interface OvRacm { id: string; name: string; fw: string; status: string; owner: string; lastRun: string }

export type OvSectionKey = 'sop' | 'racm' | 'risks' | 'controls' | 'workflows';

export interface BPOverviewDashboardProps {
  bp: { id: string; name: string; abbr: string; owner?: string };
  risks: OvRisk[];
  controls: OvControl[];
  workflows: OvWorkflow[];
  sops: OvSop[];
  racms: OvRacm[];
  attention: { text: string; section: OvSectionKey }[];
  onOpenSection: (k: OvSectionKey) => void;
}

// Severity → swatch (matches the risk palette used across the app).
const SEV_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#B42318' },
  high: { label: 'High', color: '#C2410C' },
  medium: { label: 'Medium', color: '#B45309' },
  low: { label: 'Low', color: '#9A8FAE' },
};
const SEV_ORDER = ['critical', 'high', 'medium', 'low'];

const CTL_META: Record<string, { label: string; color: string; cls: string }> = {
  effective: { label: 'Effective', color: '#15803D', cls: 'bg-compliant' },
  ineffective: { label: 'Ineffective', color: '#B42318', cls: 'bg-risk' },
  'not-tested': { label: 'Not tested', color: '#9A8FAE', cls: 'bg-ink-300' },
};

function parseDate(s: string | null | undefined): number {
  if (!s || s === 'Never') return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

// Small SVG donut. Segments render clockwise from 12 o'clock.
function Donut({ segments, total, centerValue, centerLabel }: {
  segments: { value: number; color: string }[];
  total: number;
  centerValue: string;
  centerLabel: string;
}) {
  const r = 46, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F1EEF6" strokeWidth="13" />
        {total > 0 && segments.filter(s => s.value > 0).map((s, i) => {
          const dash = (s.value / total) * C;
          const el = (
            <circle
              key={i} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="13"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.625rem] font-semibold text-ink-900 leading-none tabular-nums">{centerValue}</span>
        <span className="text-[0.625rem] uppercase tracking-wider text-ink-400 mt-1">{centerLabel}</span>
      </div>
    </div>
  );
}

function Card({ title, subtitle, icon: Icon, right, children, onClick }: {
  title: string; subtitle?: string; icon?: React.ComponentType<{ size?: number; className?: string }>;
  right?: React.ReactNode; children: React.ReactNode; onClick?: () => void;
}) {
  return (
    <section className="rounded-xl border border-canvas-border bg-white p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight flex items-center gap-2">
            {Icon && <Icon size={15} className="text-ink-400" />}{title}
          </h3>
          {subtitle && <p className="text-[0.75rem] text-ink-400 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
      {onClick && (
        <button
          type="button" onClick={onClick}
          className="mt-4 self-start text-[0.75rem] font-medium text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 cursor-pointer"
        >
          View all <ChevronRight size={13} />
        </button>
      )}
    </section>
  );
}

// Greyed "coming soon" wash used by the no-data placeholder widgets.
function PlaceholderNote({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-0/90 border border-canvas-border text-[0.71875rem] font-medium text-ink-500 shadow-sm">
        <Info size={12} className="text-ink-400" /> {text}
      </span>
    </div>
  );
}

export default function BPOverviewDashboard({
  bp, risks, controls, workflows, sops, racms, attention, onOpenSection,
}: BPOverviewDashboardProps) {
  // ── Risk severity breakdown ──
  const sevCounts = useMemo(() => {
    const c: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach(r => { const k = (r.severity || 'low').toLowerCase(); if (k in c) c[k]++; });
    return c;
  }, [risks]);
  const openRisks = useMemo(() => risks.filter(r => r.status !== 'mitigated').length, [risks]);

  // ── Control status breakdown ──
  const ctlCounts = useMemo(() => {
    const c: Record<string, number> = { effective: 0, ineffective: 0, 'not-tested': 0 };
    controls.forEach(ctl => { const k = ctl.status || 'not-tested'; c[k] = (c[k] ?? 0) + 1; });
    return c;
  }, [controls]);

  // ── Coverage funnel: each risk's depth of protection ──
  const funnel = useMemo(() => {
    const identified = risks.length;
    const controlled = risks.filter(r => r.ctls > 0).length;
    const keyCovered = risks.filter(r => r.keyCtls > 0).length;
    const effective = risks.filter(r => controls.some(c => c.riskId === r.id && c.status === 'effective')).length;
    return [
      { label: 'Risks identified', n: identified, hint: 'all risks on this process' },
      { label: 'Mapped to a control', n: controlled, hint: 'have at least one control' },
      { label: 'Covered by a key control', n: keyCovered, hint: 'a key control is in place' },
      { label: 'Key control effective', n: effective, hint: 'control tested effective' },
    ];
  }, [risks, controls]);
  const funnelMax = funnel[0]?.n || 1;

  // ── Workflows grouped by type ──
  const wfGroups = useMemo(() => {
    const map = new Map<string, OvWorkflow[]>();
    workflows.forEach(w => { const t = w.type || 'Other'; if (!map.has(t)) map.set(t, []); map.get(t)!.push(w); });
    return [...map.entries()];
  }, [workflows]);

  // ── At-a-glance meta ──
  const frameworks = useMemo(() => [...new Set(racms.map(r => r.fw).filter(Boolean))], [racms]);
  const owner = bp.owner ?? racms[0]?.owner ?? 'Unassigned';

  // ── Recent changes — newest activity stitched from seed dates ──
  const recent = useMemo(() => {
    const items: { text: string; sub: string; ts: number; section: OvSectionKey }[] = [];
    sops.forEach(s => items.push({ text: `${s.name} ${s.version}`, sub: `SOP · ${s.by}`, ts: parseDate(s.at), section: 'sop' }));
    racms.forEach(r => items.push({ text: r.name, sub: `RACM · ${r.status === 'draft' ? 'draft saved' : 'last run'}`, ts: parseDate(r.lastRun), section: 'racm' }));
    risks.forEach(r => { if (r.lastUpdated) items.push({ text: r.name, sub: `Risk · ${r.id}`, ts: parseDate(r.lastUpdated), section: 'risks' }); });
    return items.filter(i => i.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [sops, racms, risks]);
  const fmtDay = (ts: number) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  // ── Controls-by-status percentages (largest-remainder so they sum to 100) ──
  const ctlPcts = useMemo(() => {
    const total = controls.length;
    if (total === 0) return {} as Record<string, number>;
    const keys = Object.keys(CTL_META);
    const raws = keys.map(k => (ctlCounts[k] ?? 0) / total * 100);
    const floors = raws.map(Math.floor);
    const remainders = raws.map((v, i) => v - floors[i]);
    let leftover = 100 - floors.reduce((a, b) => a + b, 0);
    const order = remainders.map((r, i) => [r, i] as [number, number]).sort((a, b) => b[0] - a[0]);
    for (const [, idx] of order) {
      if (leftover <= 0) break;
      floors[idx]++;
      leftover--;
    }
    return Object.fromEntries(keys.map((k, i) => [k, floors[i]])) as Record<string, number>;
  }, [controls, ctlCounts]);

  const sevSegments = SEV_ORDER.map(k => ({ value: sevCounts[k], color: SEV_META[k].color }));
  const ctlTotal = controls.length;

  return (
    <div className="space-y-5 mb-5">
      {/* ── Row 1 · Risk severity donut │ Control status bar ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Risks by severity" subtitle="Open and mitigated risks across this process." icon={AlertTriangle} onClick={() => onOpenSection('risks')}>
          {risks.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-400 py-6">No risks captured yet. Add them in the Risks tab.</p>
          ) : (
            <div className="flex items-center gap-6">
              <Donut segments={sevSegments} total={risks.length} centerValue={String(openRisks)} centerLabel="Open" />
              <ul className="flex-1 space-y-2 min-w-0">
                {SEV_ORDER.map(k => (
                  <li key={k} className="flex items-center gap-2.5 text-[0.8125rem]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEV_META[k].color }} />
                    <span className="text-ink-700 flex-1">{SEV_META[k].label}</span>
                    <span className="font-semibold text-ink-900 tabular-nums">{sevCounts[k]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Controls by status" subtitle="Design effectiveness of the controls on this process." icon={Shield} onClick={() => onOpenSection('controls')}>
          {ctlTotal === 0 ? (
            <p className="text-[0.8125rem] text-ink-400 py-6">No controls defined yet.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {Object.entries(CTL_META).map(([k, meta]) => {
                const n = ctlCounts[k] ?? 0;
                const pct = ctlPcts[k] ?? 0;
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-[0.8125rem] mb-1">
                      <span className="text-ink-700">{meta.label}</span>
                      <span className="text-ink-500 tabular-nums"><span className="font-semibold text-ink-900">{n}</span> · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-paper-100 overflow-hidden">
                      <div className={`h-full rounded-full ${meta.cls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 2 · Workflow effectiveness (placeholder) │ Coverage funnel ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Workflow effectiveness · last 90 days" subtitle="How often each workflow's flags turn out to be real." icon={TrendingUp}>
          <div className="relative">
            <div className="space-y-3 pt-1 opacity-40 select-none" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-[0.8125rem] mb-1">
                    <span className="text-ink-600 truncate">Workflow</span>
                    <span className="text-ink-400">—</span>
                  </div>
                  <div className="h-2 rounded-full bg-paper-100 overflow-hidden"><div className="h-full rounded-full bg-ink-200" style={{ width: `${[60, 40, 75, 30][i % 4]}%` }} /></div>
                </div>
              ))}
            </div>
            <PlaceholderNote text="Run history not captured yet" />
          </div>
        </Card>

        <Card title="Coverage funnel" subtitle="Where protection drops off, risk → effective control." icon={Activity}>
          <div className="space-y-2.5 pt-1">
            {funnel.map((f, i) => {
              const pct = Math.round((f.n / funnelMax) * 100);
              // Baseline row (i===0): hide the "100%" label when controls=0 to avoid false "full coverage" read
              const showPct = !(i === 0 && controls.length === 0);
              return (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-[0.78125rem] mb-1">
                    <span className="text-ink-700" title={f.hint}>{f.label}</span>
                    <span className="text-ink-500 tabular-nums">
                      <span className="font-semibold text-ink-900">{f.n}</span>
                      {showPct && <> · {pct}%</>}
                      {i === 0 && controls.length === 0 && <span className="text-ink-400 ml-1 text-[0.6875rem]">(no controls linked yet)</span>}
                    </span>
                  </div>
                  <div className="h-6 rounded-md bg-paper-100 overflow-hidden">
                    <div
                      className="h-full rounded-md bg-brand-600 transition-all"
                      style={{ width: `${Math.max(pct, f.n > 0 ? 6 : 0)}%`, opacity: 1 - i * 0.12 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Row 3 · 14-day activity heatmap (placeholder) ── */}
      <Card title="Activity (last 14 days)" subtitle="Rows are workflows; each cell is a day." icon={Clock}>
        <div className="relative">
          <div className="opacity-50 select-none" aria-hidden="true">
            {(['a', 'b', 'c'] as const).map((id) => (
              <div key={id} className="flex items-center gap-3 mb-1.5">
                <span className="w-44 shrink-0 text-[0.75rem] text-ink-500 truncate">Workflow</span>
                <div className="flex gap-1 flex-1">
                  {Array.from({ length: 14 }).map((_, d) => (
                    <span key={d} className="flex-1 h-5 rounded-xs bg-paper-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <PlaceholderNote text="Daily activity history coming soon" />
        </div>
      </Card>

      {/* ── Row 4 · Workflows by type ── */}
      <Card title="Workflows" subtitle="Operational workflows linked to this process, grouped by type." icon={WorkflowIcon} onClick={() => onOpenSection('workflows')}>
        {workflows.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-400 py-4">No workflows linked yet.</p>
        ) : (
          <div className="space-y-4">
            {wfGroups.map(([type, items]) => (
              <div key={type}>
                <div className="flex items-center gap-1.5 mb-2 text-[0.65625rem] font-bold uppercase tracking-wider text-ink-400">
                  <WorkflowIcon size={12} /> {type} · {items.length}
                </div>
                <div className="space-y-1.5">
                  {items.map(w => (
                    <div key={w.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-light bg-white">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${w.status === 'active' ? 'bg-compliant' : 'bg-ink-300'}`} />
                      <span className="text-[0.8125rem] font-medium text-ink-800 truncate flex-1">{w.name}</span>
                      <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{w.runs} runs · last run {w.lastRun ?? '—'}</span>
                      <span className={`text-[0.65625rem] font-semibold px-2 py-0.5 rounded-full shrink-0 ${w.status === 'active' ? 'bg-compliant-50 text-compliant-700' : 'bg-paper-100 text-ink-500'}`}>
                        {w.status === 'active' ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Row 5 · At a glance │ Needs attention + recent ── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Process at a glance" icon={FileText}>
          <dl className="divide-y divide-border-light text-[0.8125rem]">
            {[
              ['Process', `${bp.name} · ${bp.abbr}`],
              ['Frameworks', frameworks.length ? frameworks.join(', ') : '—'],
              ['Owner', owner],
              ['SOPs', String(sops.length)],
              ['RACMs', String(racms.length)],
              ['Last updated', recent[0] ? fmtDay(recent[0].ts) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2.5 gap-4">
                <dt className="text-ink-400">{k}</dt>
                <dd className="font-medium text-ink-800 text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Needs attention" icon={Flame}>
            {attention.length === 0 ? (
              <p className="text-[0.8125rem] text-ink-400">Everything on this process is on track.</p>
            ) : (
              <ul className="space-y-1.5">
                {attention.map((a, i) => (
                  <li key={i}>
                    <button
                      type="button" onClick={() => onOpenSection(a.section)}
                      className="w-full flex items-start gap-2.5 text-left px-3 py-2 rounded-lg hover:bg-paper-50 transition-colors cursor-pointer group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-risk mt-1.5 shrink-0" />
                      <span className="text-[0.78125rem] text-ink-700 flex-1 leading-snug">{a.text}</span>
                      <ChevronRight size={14} className="text-ink-300 group-hover:text-brand-600 shrink-0 mt-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent changes" icon={History}>
            {recent.length === 0 ? (
              <p className="text-[0.8125rem] text-ink-400">No recent changes recorded.</p>
            ) : (
              <ul className="space-y-2.5">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.78125rem] text-ink-800 truncate">{r.text}</p>
                      <p className="text-[0.6875rem] text-ink-400">{r.sub}</p>
                    </div>
                    <span className="text-[0.6875rem] text-ink-400 shrink-0 tabular-nums">{fmtDay(r.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// Subtle first-paint reveal so the dashboard eases in with the rest of the page.
export function BPOverviewDashboardReveal(props: BPOverviewDashboardProps & { reveal?: boolean }) {
  const { reveal, ...rest } = props;
  if (!reveal) return <BPOverviewDashboard {...rest} />;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
      <BPOverviewDashboard {...rest} />
    </motion.div>
  );
}
