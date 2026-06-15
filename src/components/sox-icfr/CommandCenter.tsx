import { useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Clock, FileWarning, Inbox, ShieldCheck } from 'lucide-react';
import { useIcfr } from './store';
import { controlConclusion, courtFor, engagementProgress, formatINR, severityOf } from './helpers';
import { Bar, ConclusionPill, CourtBadge, NatureChip, SeverityPill, StagePill } from './parts';
import { cn } from '../../lib/cn';
import type { Control } from './types';

export default function CommandCenter() {
  const { eng, role, openControl, setView } = useIcfr();
  const p = useMemo(() => engagementProgress(eng), [eng]);

  const needsYou = eng.controls.filter(c => courtFor(c, eng.tasks) === role && c.stage !== 'signed-off');
  const waiting = eng.controls.filter(c => courtFor(c, eng.tasks) === 'risk-owner');
  const reviewNotes = eng.tasks.filter(t => t.assigneeRole === 'auditor' && t.status === 'open');

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{eng.name}</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{eng.entity} · {eng.framework} · {eng.periodStart} – {eng.periodEnd}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('scope')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors">Scope & materiality</button>
          <button onClick={() => setView('deficiencies')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors"><FileWarning size={14} /> Deficiencies <span className="tabular-nums text-risk-700">{eng.deficiencies.length}</span></button>
        </div>
      </div>

      {/* progress strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Materiality"><span className="text-[18px] font-bold text-ink-900 tabular-nums">{formatINR(eng.materiality)}</span><span className="text-[11px] text-ink-400 ml-1.5">PM {formatINR(eng.performanceMateriality)}</span></Tile>
        <Tile label="Test of Design"><Bar value={p.todDone} total={p.total} /></Tile>
        <Tile label="Operating effectiveness"><Bar value={p.toeDone} total={p.total} tone="bg-evidence-600" /></Tile>
        <Tile label="Concluded"><span className="text-[18px] font-bold text-compliant-700 tabular-nums">{p.effective}</span><span className="text-ink-300 mx-1">·</span><span className="text-[18px] font-bold text-risk-700 tabular-nums">{p.deficient}</span><span className="text-[11px] text-ink-400 ml-1.5">eff · def</span></Tile>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* controls board */}
        <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
          <header className="px-4 py-3 border-b border-canvas-border flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ink-800">Controls <span className="text-ink-400 font-normal">({eng.controls.length})</span></h2>
            <span className="text-[11px] text-ink-400">click a control to test it</span>
          </header>
          <div className="divide-y divide-canvas-border">
            {eng.controls.map(c => <ControlRow key={c.id} c={c} onOpen={() => openControl(c.id)} eng={eng} />)}
          </div>
        </section>

        {/* right rail */}
        <div className="space-y-4">
          <Rail title="Needs you" icon={<Inbox size={14} className="text-brand-600" />} count={needsYou.length + reviewNotes.length}>
            {reviewNotes.map(t => (
              <button key={t.id} onClick={() => openControl(t.controlId)} className="w-full text-left rounded-lg border border-canvas-border p-2.5 hover:border-brand-200 cursor-pointer transition-colors">
                <div className="text-[11px] font-semibold text-evidence-700 mb-0.5">Review note</div>
                <div className="text-[12.5px] text-ink-800 leading-snug">{t.title}</div>
              </button>
            ))}
            {needsYou.map(c => (
              <button key={c.id} onClick={() => openControl(c.id)} className="w-full text-left rounded-lg border border-canvas-border p-2.5 hover:border-brand-200 cursor-pointer transition-colors">
                <div className="flex items-center justify-between"><span className="font-mono text-[11px] font-semibold text-ink-600">{c.id}</span><StagePill stage={c.stage} /></div>
                <div className="text-[12.5px] text-ink-800 leading-snug mt-1 line-clamp-1">{c.description}</div>
              </button>
            ))}
            {needsYou.length + reviewNotes.length === 0 && <Empty icon={<ShieldCheck size={16} />} text="Nothing in your court." />}
          </Rail>

          <Rail title="Waiting on risk owner" icon={<Clock size={14} className="text-mitigated-700" />} count={waiting.length}>
            {waiting.map(c => {
              const task = eng.tasks.find(t => t.controlId === c.id && t.assigneeRole === 'risk-owner' && t.status === 'open');
              return (
                <div key={c.id} className="rounded-lg border border-canvas-border p-2.5">
                  <div className="flex items-center justify-between"><span className="font-mono text-[11px] font-semibold text-ink-600">{c.id}</span><span className="text-[11px] text-ink-400">{task?.dueLabel ?? c.owner}</span></div>
                  <div className="text-[12px] text-ink-600 leading-snug mt-0.5">{task?.title ?? `Owner: ${c.owner}`}</div>
                </div>
              );
            })}
            {waiting.length === 0 && <Empty icon={<Clock size={16} />} text="No open requests." />}
          </Rail>
        </div>
      </div>
    </div>
  );
}

function ControlRow({ c, onOpen, eng }: { c: Control; onOpen: () => void; eng: ReturnType<typeof useIcfr>['eng'] }) {
  const concl = controlConclusion(c);
  const court = courtFor(c, eng.tasks);
  const def = eng.deficiencies.find(d => d.controlId === c.id);
  return (
    <motion.button layout onClick={onOpen} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-paper-50/60 transition-colors cursor-pointer">
      <span className="font-mono text-[12px] font-semibold text-brand-700 w-[78px] shrink-0">{c.id}</span>
      <span className="text-[13px] text-ink-800 flex-1 min-w-0 truncate">{c.description}</span>
      {c.isKey && <span className="text-[9.5px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded shrink-0">Key</span>}
      <span className="shrink-0 hidden md:block"><NatureChip nature={c.nature} /></span>
      <span className="shrink-0 hidden lg:block"><StagePill stage={c.stage} /></span>
      {def ? <span className="shrink-0"><SeverityPill s={severityOf(def, eng.materiality)} /></span> : <span className="shrink-0"><ConclusionPill c={concl} /></span>}
      <span className="shrink-0 w-[88px] flex justify-end"><CourtBadge court={court} /></span>
      <ArrowRight size={14} className="text-ink-300 shrink-0" />
    </motion.button>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold mb-1.5">{label}</div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function Rail({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-canvas-border bg-canvas-elevated">
      <header className="px-3.5 py-2.5 border-b border-canvas-border flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-800">{icon}{title}</span>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-paper-100 text-[11px] font-bold text-ink-600 tabular-nums">{count}</span>
      </header>
      <div className="p-2.5 space-y-2 max-h-[420px] overflow-y-auto">{children}</div>
    </section>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex flex-col items-center text-center py-5 text-ink-400 gap-1.5"><span className="text-ink-300">{icon}</span><span className="text-[12px]">{text}</span></div>;
}

export { AlertTriangle };
