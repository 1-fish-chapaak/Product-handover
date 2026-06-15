import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import './register.css';
import { IcfrProvider, useIcfr } from './store';
import { RoleSwitcher } from './parts';
import ControlRegister from './ControlRegister';
import ControlDossier from './ControlDossier';
import RiskOwnerPortal from './RiskOwnerPortal';
import { DeficienciesView, ScopeView } from './extraViews';
import SetupWizard from './SetupWizard';

function Inner({ onBack }: { onBack?: () => void }) {
  const { eng, role, view, setRole, togglePeriod } = useIcfr();

  const body = role === 'risk-owner'
    ? <RiskOwnerPortal />
    : view === 'dossier' ? <ControlDossier />
    : view === 'deficiencies' ? <DeficienciesView />
    : view === 'scope' ? <ScopeView />
    : view === 'setup' ? <SetupWizard />
    : <ControlRegister />;

  return (
    <div className="sox-book-ui h-full overflow-y-auto bg-canvas">
      {/* top bar */}
      <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-canvas-border">
        <div className="max-w-[1320px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={15} /></button>}
            <span className="inline-flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center"><ShieldCheck size={16} className="text-white" /></span>
              <span className="font-mono text-[12px] font-semibold text-ink-700">{eng.code}</span>
              <span className="text-[13px] font-semibold text-ink-900 truncate">{eng.name}</span>
              <button onClick={togglePeriod} title="Switch period — Interim ⇄ Year-end (roll-forward)" className="text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 h-5 inline-flex items-center gap-1 rounded-full cursor-pointer transition-colors">{eng.period}<RefreshCw size={10} /></button>
            </span>
          </div>
          <RoleSwitcher role={role} onChange={setRole} />
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={`${role}-${view}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SoxIcfrApp({ onBack }: { onBack?: () => void }) {
  return (
    <IcfrProvider initialRole="auditor">
      <Inner onBack={onBack} />
    </IcfrProvider>
  );
}
