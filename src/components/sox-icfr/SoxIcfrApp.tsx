import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { findEngagement } from '../../data/engagements';
import { EngagementTabBar, type TabDef } from '../audit/EngagementTabBar';
import { IcfrProvider, useIcfr, type SoxTab } from './store';
import { OwnerPicker, RoleSwitcher } from './parts';
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
  { id: 'racm', label: 'RACM' }, // 'Risk & Control Matrix' tooltip can't be set here — TabDef has no title field & EngagementTabBar owns the item title. Flagged.
  { id: 'risks', label: 'Risk Library' },
  { id: 'controls', label: 'Control Library' },
  { id: 'runs', label: 'Test runs' },
];

function Inner({ onBack }: { onBack?: () => void }) {
  const { eng, role, tab, view, racmEditor, meOwner, setMeOwner, setRole, setTab, back } = useIcfr();
  const concluded = !!(eng.signoff.preparer && eng.signoff.reviewer);
  // The owner's SOX is a to-do list, not a workspace: just their inbox (Overview)
  // and their controls. RACM, Risk Library and Runs are audit-side surfaces.
  const tabs = role === 'risk-owner' ? SOX_TABS.filter(t => t.id === 'overview' || t.id === 'controls') : SOX_TABS;
  const owners = Array.from(new Set(eng.controls.map(c => c.owner))).sort();

  // Header matches the production engagement page: a "Back to Engagements" line,
  // then avatar-initials tile + name + status/type pills, with code · Configuration
  // beneath — the tabs sit tight underneath.
  const initials = eng.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || eng.code.slice(0, 3);
  const topBar = (
    <div className={cn('bg-canvas shrink-0', view === 'racm-editor' && 'border-b border-canvas-border')}>
      <div className="max-w-[1320px] mx-auto px-6 pt-4">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to Engagements"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"
          >
            <ArrowLeft size={15} /> Back to Engagements
          </button>
        )}
        <div className="mt-3 flex items-start gap-3.5">
          <span className="w-12 h-12 rounded-xl bg-brand-600 text-white text-[14px] font-semibold flex items-center justify-center shrink-0 select-none" aria-hidden>{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <h1 className="text-[22px] leading-7 font-bold text-ink-900 tracking-tight truncate min-w-0">{eng.name}</h1>
              {concluded ? (
                <span title={`Signed off — ${eng.signoff.preparer!.by}, countersigned ${eng.signoff.reviewer!.by}`} className="text-[11.5px] font-semibold text-compliant-700 bg-compliant-50 border border-compliant-200 px-2 h-[22px] inline-flex items-center gap-1 rounded-full shrink-0">
                  <BadgeCheck size={11} /> Concluded
                </span>
              ) : (
                <span className="text-[11.5px] font-semibold text-compliant-700 bg-compliant-50 border border-compliant-200 px-2 h-[22px] inline-flex items-center rounded-full shrink-0">Active</span>
              )}
              {/* Module chip — same job as the type pill on the production header. */}
              <span className="text-[11.5px] font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 h-[22px] inline-flex items-center rounded-full shrink-0">SOX / ICFR</span>
            </div>
            <div className="mt-1 text-[12px] text-ink-500">
              <span className="font-mono font-semibold">{eng.code}</span>
            </div>
          </div>
          {/* The switcher is a demo affordance — it previews the other persona
              without changing who is signed in, hence the "Viewing as" prefix.
              Quieted to a meta control: split off from the real actions by a
              divider and muted at rest, rising to full strength on hover/focus. */}
          <div className="flex items-center gap-3 shrink-0 pt-1.5">
            <NotificationsBell />
            <span className="w-px h-6 bg-canvas-border" aria-hidden />
            <div className="flex items-center gap-2 opacity-75 hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">Viewing as</span>
              <RoleSwitcher role={role} onChange={setRole} />
              {role === 'risk-owner' && <OwnerPicker owner={meOwner} options={owners} onChange={setMeOwner} />}
            </div>
          </div>
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
      <div className="max-w-[1320px] mx-auto px-6 pt-4 pb-6">
        {isRoot && (
          <EngagementTabBar tabs={tabs} activeTab={tab} onSelect={(id) => setTab(id as SoxTab)} storageKey={`sox-${eng.id}`} size="md" />
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
