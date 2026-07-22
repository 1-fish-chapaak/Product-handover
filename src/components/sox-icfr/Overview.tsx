import { useMemo } from 'react';
import {
  AlertTriangle, Inbox, Scale, ArrowRight, ShieldCheck, Upload, MessageSquare, FileWarning,
} from 'lucide-react';
import { useIcfr } from './store';
import {
  controlConclusion, engagementProgress, formatINR, isClearlyTrivial, severityOf, trackResult,
} from './helpers';
import { cn } from '../../lib/cn';
import RiskOwnerPortal from './RiskOwnerPortal';
import type { Control, Severity, TaskType } from './types';

const fmt = (n: number) => formatINR(n);

// process spine colours — on-theme purple/blue families, mirrors the Control Library shelves
const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]!; }

const SEV_META: { key: Severity; label: string; dot: string; text: string }[] = [
  { key: 'Material Weakness', label: 'Material weakness', dot: 'bg-risk-500', text: 'text-risk-700' },
  { key: 'Significant Deficiency', label: 'Significant deficiency', dot: 'bg-high-500', text: 'text-high-700' },
  { key: 'Deficiency', label: 'Deficiency', dot: 'bg-mitigated-500', text: 'text-mitigated-700' },
];

const HANDOFF_META: Record<TaskType, { label: string; Icon: typeof Upload; tone: string }> = {
  pbc: { label: 'Document requests', Icon: Upload, tone: 'text-evidence-700' },
  query: { label: 'Open questions', Icon: MessageSquare, tone: 'text-brand-700' },
  remediation: { label: 'Remediations', Icon: FileWarning, tone: 'text-high-700' },
};

export default function Overview() {
  const { eng, role, setView, setTab } = useIcfr();
  const stats = engagementProgress(eng);
  const M = eng.materiality;
  const isOwner = role === 'risk-owner';

  const sev = useMemo(() => {
    const c: Record<Severity, number> = { 'Material Weakness': 0, 'Significant Deficiency': 0, Deficiency: 0 };
    let open = 0;
    eng.deficiencies.forEach(d => { c[severityOf(d, M, eng.rules)] += 1; if (d.status !== 'Closed') open += 1; });
    return { c, open, trivial: eng.deficiencies.filter(d => isClearlyTrivial(d.magnitude, eng.rules)).length };
  }, [eng.deficiencies, M, eng.rules]);

  const openTasks = eng.tasks.filter(t => t.status === 'open');
  const handoffs: Record<TaskType, number> = {
    pbc: openTasks.filter(t => t.type === 'pbc').length,
    query: openTasks.filter(t => t.type === 'query').length,
    remediation: openTasks.filter(t => t.type === 'remediation').length,
  };

  const processes = useMemo(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => {
      const concl = rows.map(controlConclusion);
      return {
        name, total: rows.length,
        designDone: rows.filter(c => trackResult(c.design) !== 'Not tested').length,
        operatingDone: rows.filter(c => trackResult(c.operating) !== 'Not tested').length,
        effective: concl.filter(x => x === 'Effective').length,
        ineffective: concl.filter(x => x === 'Ineffective').length,
        inProgress: concl.filter(x => x === 'In progress').length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [eng.controls]);

  const tiles = [
    { k: 'Design concluded', v: `${stats.designDone}/${stats.total}`, t: 'text-brand-700' },
    { k: 'Operating concluded', v: `${stats.operatingDone}/${stats.total}`, t: 'text-evidence-700' },
    { k: 'Effective', v: stats.effective, t: 'text-compliant-700' },
    { k: 'Ineffective', v: stats.ineffective, t: 'text-risk-700' },
    { k: 'Waiting on owner', v: stats.waitingOnOwner, t: 'text-mitigated-700' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.375rem] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>Overview</h1>
        <p className="text-[0.8125rem] text-ink-500 mt-0.5">{eng.controls.length} controls · {eng.framework} · {eng.period} period</p>
      </div>

      {/* Risk owner's actionable inbox leads — first-line owners act before they browse status. */}
      {isOwner && (
        <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
          <RiskOwnerPortal />
        </section>
      )}

      {/* progress rail */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map(s => (
          <div key={s.k} className="rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3">
            <div className={cn('text-[1.25rem] font-bold tabular-nums', s.t)}>{s.v}</div>
            <div className="text-[0.71875rem] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </div>
        ))}
      </div>

      {/* exceptions · handoffs · materiality */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* exceptions */}
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><AlertTriangle size={15} className="text-risk-600" /> Exceptions</h2>
            <span className="text-[0.6875rem] font-semibold text-ink-400">{sev.open} open · {eng.deficiencies.length} total</span>
          </div>
          <div className="space-y-2 flex-1">
            {SEV_META.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                <span className="text-[0.78125rem] text-ink-600">{s.label}</span>
                <span className={cn('ml-auto text-[0.9375rem] font-bold tabular-nums', s.text)}>{sev.c[s.key]}</span>
              </div>
            ))}
            {sev.trivial > 0 && <div className="text-[0.6875rem] text-ink-400 pt-1">{sev.trivial} clearly trivial (logged, not evaluated)</div>}
          </div>
          <button onClick={() => setView('deficiencies')} className="mt-3 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">Manage exceptions <ArrowRight size={13} /></button>
        </div>

        {/* handoffs */}
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Inbox size={15} className="text-evidence-600" /> Handoffs</h2>
            <span className="text-[0.6875rem] font-semibold text-ink-400">{openTasks.length} open</span>
          </div>
          <div className="space-y-2 flex-1">
            {(Object.keys(HANDOFF_META) as TaskType[]).map(t => {
              const m = HANDOFF_META[t];
              return (
                <div key={t} className="flex items-center gap-2">
                  <m.Icon size={13} className={m.tone} />
                  <span className="text-[0.78125rem] text-ink-600">{m.label}</span>
                  <span className="ml-auto text-[0.9375rem] font-bold tabular-nums text-ink-800">{handoffs[t]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[0.75rem] text-ink-500">{stats.waitingOnOwner} control{stats.waitingOnOwner === 1 ? '' : 's'} waiting on the risk owner</div>
        </div>

        {/* materiality */}
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Materiality</h2>
          </div>
          <div className="space-y-2 flex-1">
            {[
              { k: 'Overall', v: M },
              { k: 'Performance', v: eng.performanceMateriality },
              { k: 'Clearly trivial', v: eng.rules.clearlyTrivial },
            ].map(r => (
              <div key={r.k} className="flex items-center gap-2">
                <span className="text-[0.78125rem] text-ink-600">{r.k}</span>
                <span className="ml-auto text-[0.84375rem] font-bold tabular-nums text-ink-800">{fmt(r.v)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setView('scope')} className="mt-3 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors">Configuration <ArrowRight size={13} /></button>
        </div>
      </div>

      {/* by process */}
      <section>
        <h2 className="text-[0.75rem] font-semibold text-ink-500 uppercase tracking-wide mb-2.5 inline-flex items-center gap-1.5"><ShieldCheck size={13} /> By process</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {processes.map(p => {
            const notStarted = p.total - p.effective - p.ineffective - p.inProgress;
            const seg = (n: number, color: string) => n > 0 ? <span style={{ width: `${(n / p.total) * 100}%`, background: color }} className="h-full" /> : null;
            return (
              <button key={p.name} onClick={() => setTab('controls')} className="text-left rounded-lg border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 hover:shadow-[0_4px_16px_-8px_rgba(15,8,30,0.25)] transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: spineColor(p.name) }} />
                  <span className="text-[0.84375rem] font-semibold text-ink-900 truncate">{p.name}</span>
                  <span className="ml-auto text-[0.71875rem] font-semibold text-ink-400 tabular-nums">{p.total} controls</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-paper-100 mb-2.5">
                  {seg(p.effective, 'var(--color-compliant-500)')}
                  {seg(p.ineffective, 'var(--color-risk-500)')}
                  {seg(p.inProgress, 'var(--color-brand-400)')}
                  {seg(notStarted, 'var(--color-paper-300)')}
                </div>
                <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[0.6875rem] text-ink-500">
                  <span><b className="text-compliant-700">{p.effective}</b> effective</span>
                  {p.ineffective > 0 && <span><b className="text-risk-700">{p.ineffective}</b> ineffective</span>}
                  <span className="ml-auto tabular-nums">D {p.designDone}/{p.total} · O {p.operatingDone}/{p.total}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
