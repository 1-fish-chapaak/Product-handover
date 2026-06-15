import { useMemo, useState } from 'react';
import { Download, FileWarning, Plus, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { downloadIcfrWorkingPaper } from './icfrWorkingPaper';
import { controlConclusion, courtFor, engagementProgress } from './helpers';
import ControlBook, { coverClass } from './ControlBook';
import type { Control } from './types';

export default function CommandCenter() {
  const { eng, openControl, setView, rollForward } = useIcfr();
  const { addToast } = useToast();
  const p = useMemo(() => engagementProgress(eng), [eng]);
  const [bookId, setBookId] = useState<string | null>(null);

  const exportWp = () => { downloadIcfrWorkingPaper(eng); addToast({ type: 'success', title: 'Working paper exported', message: `Working_Paper_ICFR_${eng.code}.xlsx` }); };
  const doRollForward = () => { rollForward(); addToast({ type: 'success', title: 'Rolled forward to year-end', message: 'Automated controls benchmarked; manual controls reset for roll-forward testing.' }); };

  const next = (() => {
    const due = eng.controls.find(c => courtFor(c, eng.tasks) === 'auditor' && c.stage !== 'signed-off');
    if (due) return { text: `Open ${due.id} — ${due.description}`, run: () => setBookId(due.id) };
    if (eng.deficiencies.length) return { text: `Evaluate ${eng.deficiencies.length} deficiency${eng.deficiencies.length === 1 ? '' : 'ies'}`, run: () => setView('deficiencies') };
    return null;
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{eng.name}</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">{eng.entity} · {eng.framework} · {eng.periodStart} – {eng.periodEnd}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => setView('setup')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors"><Plus size={14} /> New</button>
          {eng.period === 'Interim' && <button onClick={doRollForward} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors"><RefreshCw size={14} /> Roll forward</button>}
          <button onClick={exportWp} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand-600 text-white text-[13px] font-semibold hover:bg-brand-500 cursor-pointer transition-colors"><Download size={14} /> Working paper</button>
          <button onClick={() => setView('scope')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors">Scope</button>
          <button onClick={() => setView('deficiencies')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[13px] font-semibold text-ink-700 hover:border-brand-300 cursor-pointer transition-colors"><FileWarning size={14} /> Deficiencies <span className="tabular-nums text-risk-700">{eng.deficiencies.length}</span></button>
        </div>
      </div>

      {next && (
        <button onClick={next.run} className="w-full flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 hover:bg-brand-50 cursor-pointer transition-colors group text-left">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand-800 min-w-0"><Sparkles size={15} className="text-brand-600 shrink-0" /><span className="truncate">Next: {next.text}</span></span>
          <ArrowRight size={16} className="text-brand-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </button>
      )}

      {/* progress rail */}
      <div className="cc-rail">
        <div className="cc-stat"><div className="k">Test of Design</div><div className="v">{p.todDone}<span className="d">/ {p.total}</span></div><div className="bar"><i style={{ width: `${(p.todDone / Math.max(1, p.total)) * 100}%` }} /></div><div className="sub">gates operating effectiveness</div></div>
        <div className="cc-stat toe"><div className="k">Operating effectiveness</div><div className="v">{p.toeDone}<span className="d">/ {p.total}</span></div><div className="bar"><i style={{ width: `${(p.toeDone / Math.max(1, p.total)) * 100}%` }} /></div><div className="sub">automated · manual</div></div>
        <div className="cc-stat"><div className="k">Deficiencies</div><div className="v">{eng.deficiencies.length}<span className="d">open</span></div><div className="bar"><i style={{ width: `${eng.deficiencies.length ? 30 : 0}%`, background: 'linear-gradient(90deg,var(--color-mitigated),#E0A85B)' }} /></div><div className="sub">severity computed</div></div>
        <div className="cc-stat"><div className="k">Whose court</div><div className="v">{p.waitingOnOwner}<span className="d">with owner</span></div><div className="bar"><i style={{ width: `${(p.waitingOnOwner / Math.max(1, p.total)) * 100}%`, background: 'linear-gradient(90deg,var(--color-mitigated),#E0A85B)' }} /></div><div className="sub">{eng.controls.filter(c => courtFor(c, eng.tasks) === 'reviewer').length} in review</div></div>
      </div>

      {/* the shelf */}
      <div className="shelf-frame">
        <div className="shelf">
          {eng.controls.map(c => <Spine key={c.id} c={c} eng={eng} onOpen={() => setBookId(c.id)} />)}
        </div>
        <div className="shelf-hint"><span>Open a volume to test it</span> · <span>each spine's ribbon shows whose court the control sits in</span></div>
      </div>

      {bookId && <ControlBook controlId={bookId} onClose={() => setBookId(null)} />}
    </div>
  );
}

function Spine({ c, eng, onOpen }: { c: Control; eng: ReturnType<typeof useIcfr>['eng']; onOpen: () => void }) {
  const concl = controlConclusion(c);
  const court = courtFor(c, eng.tasks);
  const sealed = c.stage === 'signed-off' || concl === 'Effective' || concl === 'Ineffective';
  const ribbon = sealed ? 'done' : court === 'risk-owner' ? 'them' : court === 'reviewer' ? 'review' : 'you';
  const total = c.attributes.length;
  const todPct = Math.round(c.attributes.filter(a => a.tod.result !== 'Not tested').length / total * 100);
  const toePct = Math.round(c.attributes.filter(a => a.toe.result !== 'Not tested').length / total * 100);
  return (
    <button className={`book-spine ${coverClass(c.id)}${sealed ? ' concluded' : ''}`} onClick={onOpen} aria-label={`Open control ${c.id}`}>
      <span className={`ribbon ${ribbon}`} />
      <span className="sid">{c.id}</span>
      <span className="snm">{c.description}</span>
      <span className="concl">{concl === 'Effective' ? 'sealed' : concl === 'Ineffective' ? 'deficiency' : ''}</span>
      <span className="sfoot">
        <span className="mini"><i style={{ width: `${todPct}%` }} /></span>
        <span className="mini"><i style={{ width: `${toePct}%` }} /></span>
      </span>
    </button>
  );
}
