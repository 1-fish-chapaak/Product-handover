import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BadgeCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import './register.css';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { findEngagement } from '../../data/engagements';
import { EngagementTabBar, type TabDef } from '../audit/EngagementTabBar';
import { IcfrProvider, useIcfr, type SoxTab } from './store';
import { RoleSwitcher } from './parts';
import NotificationsBell from './NotificationsBell';
import Overview from './Overview';
import Racm, { RacmLanding } from './Racm';
import RiskLibrary from './RiskLibrary';
import ControlRegister from './ControlRegister';
import ControlDossier from './ControlDossier';
import RunsView from './RunsView';
import { DeficienciesView, ScopeView } from './extraViews';
import RacmFullPageEditor from '../audit/RacmFullPageEditor';

const SOX_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'racm', label: 'RACM' },
  { id: 'risks', label: 'Risk Library' },
  { id: 'controls', label: 'Control Library' },
  { id: 'runs', label: 'Runs' },
];

function Inner({ onBack }: { onBack?: () => void }) {
  const { eng, role, tab, view, racmEditor, setRole, setTab, togglePeriod, back } = useIcfr();
  const concluded = !!(eng.signoff.preparer && eng.signoff.reviewer);

  const topBar = (
    <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-canvas-border shrink-0">
      <div className="max-w-[1320px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={15} /></button>}
          <span className="inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center"><ShieldCheck size={16} className="text-white" /></span>
            <span className="font-mono text-[12px] font-semibold text-ink-700">{eng.code}</span>
            <span className="text-[13px] font-semibold text-ink-900 truncate">{eng.name}</span>
            <button onClick={togglePeriod} title="Switch period — Interim ⇄ Year-end (roll-forward)" className="text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 h-5 inline-flex items-center gap-1 rounded-full cursor-pointer transition-colors">{eng.period}<RefreshCw size={10} /></button>
            {concluded && (
              <span title={`Signed off — ${eng.signoff.preparer!.by}, countersigned ${eng.signoff.reviewer!.by}`} className="text-[11px] font-semibold text-compliant-700 bg-compliant-50 px-2 h-5 inline-flex items-center gap-1 rounded-full">
                <BadgeCheck size={11} /> Concluded
              </span>
            )}
          </span>
        </div>
        {/* The switcher is a demo affordance — it previews the other persona
            without changing who is signed in, hence the "Viewing as" prefix. */}
        <div className="flex items-center gap-3 shrink-0">
          <NotificationsBell />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Viewing as</span>
          <RoleSwitcher role={role} onChange={setRole} />
        </div>
      </div>
    </div>
  );

  // The RACM spreadsheet editor takes over full-height — the Process-Hub experience.
  if (view === 'racm-editor') {
    return (
      <div className="sox-book-ui h-full flex flex-col bg-canvas">
        {topBar}
        <div className="flex-1 min-h-0">
          <RacmFullPageEditor onBack={back} backLabel="Back to RACM" racmName={racmEditor?.name} racmId={`sox-racm-${eng.id}-${(racmEditor?.process ?? 'all').replace(/\s+/g, '-').toLowerCase()}`} processLabel={racmEditor?.process} />
        </div>
      </div>
    );
  }

  // The five tabs are the primary nav; everything else is a drill-in reached from them.
  const isRoot = view === 'overview' || view === 'racm' || view === 'racm-list' || view === 'risks' || view === 'register' || view === 'runs';
  const body = view === 'dossier' ? <ControlDossier />
    : view === 'deficiencies' ? <DeficienciesView />
    : view === 'scope' ? <ScopeView />
    : tab === 'overview' ? <Overview />
    : tab === 'racm' ? (view === 'racm-list' ? <Racm /> : <RacmLanding />)
    : tab === 'risks' ? <RiskLibrary />
    : tab === 'runs' ? <RunsView />
    : <ControlRegister />;

  return (
    <div className="sox-book-ui h-full overflow-y-auto bg-canvas">
      {topBar}
      <div className="max-w-[1320px] mx-auto px-6 py-6">
        {isRoot && (
          <EngagementTabBar tabs={SOX_TABS} activeTab={tab} onSelect={(id) => setTab(id as SoxTab)} storageKey={`sox-${eng.id}`} size="md" />
        )}
        <AnimatePresence mode="wait">
          <motion.div key={`${role}-${tab}-${view}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function SoxIcfrApp({ engagementId, onBack }: { engagementId?: string; onBack?: () => void }) {
  // The SOX persona follows the platform login: risk owners land in the
  // Risk Owner view, reviewers in the Reviewer view; everyone else — including
  // signed-out — defaults to Auditor. The keyed provider re-seeds on login change.
  const { currentUser } = useCurrentUser();
  const initialRole = currentUser?.roleId === 'role-risk' ? 'risk-owner' : currentUser?.roleId === 'role-reviewer' ? 'reviewer' : 'auditor';
  const eng = engagementId ? findEngagement(engagementId) : undefined;
  const seedMeta = eng ? { id: eng.id, code: eng.code, name: eng.name, process: eng.process, periodStart: eng.periodStart, periodEnd: eng.periodEnd, owner: eng.owner, materiality: eng.soxConfig?.overallMateriality, performanceMateriality: eng.soxConfig?.performanceMateriality, clearlyTrivial: eng.soxConfig?.clearlyTrivial, sdBandPct: eng.soxConfig?.sdBandPct } : undefined;
  return (
    <IcfrProvider key={currentUser?.id ?? 'signed-out'} initialRole={initialRole} seedMeta={seedMeta}>
      <Inner onBack={onBack} />
    </IcfrProvider>
  );
}
