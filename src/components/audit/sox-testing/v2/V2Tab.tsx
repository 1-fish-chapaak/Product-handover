import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Flag, Building2, X, FileSearch, RefreshCw } from 'lucide-react';
import { useToast } from '../../../shared/Toast';
import V2ScopingWizard from './V2ScopingWizard';
import RollForwardWizard from '../RollForwardWizard';
import ProgrammeView from '../ProgrammeView';
import { fmtCr, type CyclePhase, type SoxProgramme } from '../soxTestingData';
import { V2C_PROGRAMMES, registerV2CProgramme } from './v2ClassicStore';

/**
 * SOX Testing · V2 — parity baseline: an exact copy of the Programmes tab
 * (same wizard, summary modal, roll-forward and card→workspace behaviour)
 * running on its own store, so call-aligned features can be added here one
 * decision at a time without touching the classic flow.
 */

const PHASE_CLS: Record<CyclePhase, string> = {
  Scoping: 'bg-brand-50 text-brand-700',
  'Design testing': 'bg-evidence-50 text-evidence-700',
  'Interim testing': 'bg-evidence-50 text-evidence-700',
  'Roll-forward': 'bg-mitigated-50 text-mitigated-700',
  'Year-end testing': 'bg-mitigated-50 text-mitigated-700',
  Reporting: 'bg-compliant-50 text-compliant-700',
};

type TabView = 'home' | 'wizard' | { programmeId: string } | { rollFromId: string };

interface Props {
  /** Routes into the classic SOX workspace (tabs + control testing). */
  onOpenEngagement: (engagementId: string) => void;
}

export default function V2Tab({ onOpenEngagement }: Props) {
  const { addToast } = useToast();
  const [view, setView] = useState<TabView>('home');
  const [programmes, setProgrammes] = useState<SoxProgramme[]>(() => [...V2C_PROGRAMMES]);

  const handleCreated = (p: SoxProgramme) => {
    registerV2CProgramme(p);
    setProgrammes([...V2C_PROGRAMMES]);
    setView('home');
    addToast({
      message: p.rolledFromFy
        ? `${p.fy} programme rolled forward from ${p.rolledFromFy} — ${p.racms.length} RACMs carried`
        : `${p.fy} programme created — ${p.racms.length} RACMs derived from scoping`,
      type: 'success',
    });
  };

  const openProgramme = typeof view === 'object' && 'programmeId' in view
    ? programmes.find(x => x.id === view.programmeId)
    : undefined;
  const rollFrom = typeof view === 'object' && 'rollFromId' in view
    ? programmes.find(x => x.id === view.rollFromId)
    : undefined;

  /** The annual action lives on the latest cycle only — roll it into next year. */
  const asOfYear = (p: SoxProgramme) => Number(/\d{4}/.exec(p.asOf)?.[0] ?? 0);
  const latestId = programmes.reduce((best, p) => (asOfYear(p) > asOfYear(best) ? p : best), programmes[0])?.id;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => setView('wizard')}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <Plus size={14} /> New Engagement
          </button>
        </div>

        <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Programmes</div>
        {programmes.length === 0 && (
          <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-10 text-center">
            <FileSearch size={22} className="mx-auto text-text-muted mb-2.5" />
            <div className="text-[13.5px] font-semibold text-text">No SOX programmes yet</div>
            <p className="text-[12px] text-text-secondary mt-1 mb-4 max-w-sm mx-auto leading-relaxed">
              Start with scoping — materiality, trial balances and the qualitative overlay decide what lands in scope.
            </p>
            <button
              onClick={() => setView('wizard')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Plus size={14} /> New Engagement
            </button>
          </div>
        )}
        <div className="space-y-2.5">
          {programmes.map((p, i) => {
            const totalControls = p.racms.reduce((s, r) => s + (r.controls ?? 0), 0);
            const totalEffective = p.racms.reduce((s, r) => s + (r.effective ?? 0), 0);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                role="button"
                tabIndex={0}
                onClick={() => p.engagementId ? onOpenEngagement(p.engagementId) : setView({ programmeId: p.id })}
                onKeyDown={e => { if (e.key === 'Enter') (p.engagementId ? onOpenEngagement(p.engagementId) : setView({ programmeId: p.id })); }}
                className="w-full text-left px-6 py-5 rounded-xl border border-border-light bg-white hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-[14.5px] font-semibold text-text leading-snug">{p.name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PHASE_CLS[p.phase]}`}>
                    {p.phase}
                  </span>
                  <span className="ml-auto flex items-center gap-1 shrink-0">
                    {p.id === latestId && (
                      <button
                        onClick={e => { e.stopPropagation(); setView({ rollFromId: p.id }); }}
                        title={`Carry ${p.fy} scoping and RACMs into the next cycle`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                      >
                        <RefreshCw size={12} /> Roll forward
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); setView({ programmeId: p.id }); }}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      <FileSearch size={12} /> Scoping summary
                    </button>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11.5px] text-text-secondary flex-wrap">
                  {p.code && (<>
                    <span className="font-mono tracking-tight text-text-muted">{p.code}</span>
                    <span className="text-border">·</span>
                  </>)}
                  {p.rolledFromFy && (<>
                    <span className="inline-flex items-center gap-1 text-brand-700"><RefreshCw size={10} /> from {p.rolledFromFy}</span>
                    <span className="text-border">·</span>
                  </>)}
                  <span className="inline-flex items-center gap-1 font-semibold text-text">
                    <Flag size={11} className="text-brand-700" /> as of {p.asOf}
                  </span>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1"><Building2 size={11} /> {p.entities.length} entities</span>
                  <span className="text-border">·</span>
                  <span className="tabular-nums">{p.racms.length} processes → {p.racms.length} RACMs</span>
                  <span className="text-border">·</span>
                  <span className="tabular-nums">materiality {fmtCr(p.materiality.overall)} · performance {fmtCr(p.materiality.overall * p.materiality.pmPct / 100)} · trivial {fmtCr(p.materiality.overall * p.materiality.cttPct / 100)}</span>
                  {totalControls > 0 && totalEffective > 0 && (<>
                    <span className="text-border">·</span>
                    <span className="tabular-nums"><span className="font-semibold text-text">{totalEffective}</span>/{totalControls} controls effective</span>
                  </>)}
                  {totalControls > 0 && totalEffective === 0 && (<>
                    <span className="text-border">·</span>
                    <span className="tabular-nums">{totalControls} controls carried · TOE retest</span>
                  </>)}
                </div>
                <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                  {p.racms.slice(0, 7).map(r => (
                    <span key={r.process} className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">
                      {r.process}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence>
        {view !== 'home' && (
          <FlowModal
            key={view === 'wizard' ? 'wizard' : rollFrom ? `roll-${rollFrom.id}` : openProgramme?.id ?? 'programme'}
            label={view === 'wizard' ? 'New engagement' : rollFrom ? 'Roll forward' : 'SOX programme'}
            widthCls="w-[1000px]"
            onClose={() => setView('home')}
          >
            {view === 'wizard' ? (
              <V2ScopingWizard onCancel={() => setView('home')} onCreated={handleCreated} />
            ) : rollFrom ? (
              <RollForwardWizard prior={rollFrom} onCancel={() => setView('home')} onCreated={handleCreated} />
            ) : openProgramme ? (
              <ProgrammeView
                programme={openProgramme}
                onOpenWorkspace={openProgramme.engagementId ? () => { setView('home'); onOpenEngagement(openProgramme.engagementId!); } : undefined}
              />
            ) : null}
          </FlowModal>
        )}
      </AnimatePresence>
    </>
  );
}

/** Same fixed-size modal shell as the classic tab — closes on X or Escape
 *  only, so an overlay click mid-wizard can't discard scoping work. */
function FlowModal({ label, widthCls = 'w-[800px]', onClose, children }: {
  label: string;
  widthCls?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          role="dialog" aria-modal="true" aria-label={label}
          className={`pointer-events-auto relative ${widthCls} h-[800px] max-w-full max-h-full bg-canvas rounded-[1.25rem] border border-border-light shadow-[0_24px_64px_-16px_rgba(15,8,30,0.28)] overflow-hidden flex flex-col`}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          <div className="flex-1 overflow-y-auto p-6 pb-0">
            {children}
          </div>
        </motion.div>
      </div>
    </>
  );
}
