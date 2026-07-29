import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { findEngagement } from '../../data/engagements';
import { EngagementTabBar, type TabDef } from '../audit/EngagementTabBar';
import { IcfrProvider, useIcfr, type SoxTab } from './store';
import { OwnerPicker, RoleSwitcher, SoxBreadcrumb } from './parts';
import NotificationsBell from './NotificationsBell';
import Overview from './Overview';
import Racm, { RacmLanding } from './Racm';
import RiskLibrary from './RiskLibrary';
import ControlRegister from './ControlRegister';
import ControlDossier from './ControlDossier';
import RunsView from './RunsView';
import { DeficienciesView, HandoffsView, ScopeView } from './extraViews';
import RacmFullPageEditor from '../audit/RacmFullPageEditor';
/* Configuration is PARKED behind the Audit logs tab (user ask) — see the
   'config' entry in SOX_TABS. ConfigurationView.tsx is untouched and still
   compiles; restore by uncommenting this import and swapping the render
   branch below back from <AuditLogsView /> to <ConfigurationView />.
// import ConfigurationView from './ConfigurationView';
*/
import AuditLogsView from './AuditLogsView';

const SOX_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'racm', label: 'RACM' }, // 'Risk & Control Matrix' tooltip can't be set here — TabDef has no title field & EngagementTabBar owns the item title. Flagged.
  /* Risk Register — PARKED from the engagement tabs (user ask). Only this one
     line is commented out: the 'risks' SoxTab/View types, TAB_ROOT, RETURNABLE,
     the `tab === 'risks' ? <RiskLibrary />` branch below and the dossier
     breadcrumb's 'Risk Register' label all stay wired and compiling, so
     restoring the tab is uncommenting this line.
     Known consequence while it's off — RiskLibrary was the only surface
     carrying the inherent / residual heatmaps, so risk exposure isn't visible
     anywhere in a SOX engagement; the RACM lists risk rows but doesn't score
     them. Nothing navigates into the tab, so no link is left dangling. */
  // { id: 'risks', label: 'Risk Register' },
  { id: 'controls', label: 'Control Library' },
  /* Test runs — PARKED from the engagement tabs (user ask). As with the Risk
     Register above, only this line is commented out: the 'runs' SoxTab/View
     types, TAB_ROOT, RETURNABLE, the `tab === 'runs' ? <RunsView />` branch
     below and the dossier breadcrumb's 'Test runs' label all stay wired, so
     restoring the tab is uncommenting this line. The registry itself keeps
     recording (store.tsx addRun / bulkTestControls) and mockData keeps seeding
     it, so a restored tab shows full history rather than an empty list.
     Known consequence while it's off — RunsView was the only engagement-wide
     run log (every run across all controls, filterable by kind and date), so
     that roll-up isn't visible anywhere. Per-control history survives on the
     control page (ControlDossier reads eng.executions), so testing evidence
     isn't lost — only the cross-control view, and the run → control drill-in.
     The one inbound link, BulkTestModal's "View run" button, was removed with
     this park; restoring the tab means restoring that button too. */
  // { id: 'runs', label: 'Test runs' },
  /* Was 'Configuration' — renamed to Audit logs and ungated so it shows on
     every SOX engagement (user ask). The id stays 'config' on purpose: it is
     internal only, and renaming it would ripple through SoxTab, View, TAB_ROOT
     and RETURNABLE in store.tsx for no user-visible gain. */
  { id: 'config', label: 'Audit logs' },
];

function Inner({ onBack, backLabel = 'Back to Engagements' }: { onBack?: () => void; backLabel?: string }) {
  // the breadcrumb names where ← actually lands — "Engagements" or "SOX Testing"
  const backCrumb = backLabel.replace(/^Back to /, '');
  const { eng, role, tab, view, racmEditor, racmProcess, meOwner, selectedControlId, returnView, setMeOwner, setRole, setTab, setView, back } = useIcfr();
  const concluded = !!(eng.signoff.preparer && eng.signoff.reviewer);
  // The owner's SOX is a to-do list, not a workspace: just their inbox (Overview)
  // and their controls. RACM, Risk Register and Runs are audit-side surfaces.
  // Audit logs carries no scoping gate: it's on every SOX engagement (user ask),
  // unlike the Configuration tab it replaced, which only rendered for
  // engagements the SOX Testing wizard had created a programme record for.
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
            aria-label={backLabel}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"
          >
            <ArrowLeft size={15} /> {backLabel}
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
              divider and muted at rest, rising to full strength on hover/focus.
              This whole header (and with it the switcher) is engagement-level
              only — the control detail page renders without it. */}
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

  // The tabs are the primary nav; everything else is a drill-in reached from them.
  // A drilled-in RACM matrix stands alone like the control page — no engagement
  // header, no tabs; its breadcrumb carries the context and every step back up.
  const isRacmMatrix = view === 'racm-list';
  const isScope = view === 'scope';
  const isDeficiencies = view === 'deficiencies';
  const isHandoffs = view === 'handoffs';
  // drilled-in document pages carry a breadcrumb instead of the engagement header
  const isDrillIn = isRacmMatrix || isScope || isDeficiencies || isHandoffs;
  const isRoot = view === 'overview' || view === 'racm' || view === 'risks' || view === 'register' || view === 'runs' || view === 'config';
  const body = view === 'dossier' ? <ControlDossier />
    : view === 'deficiencies' ? <DeficienciesView />
    : view === 'handoffs' ? <HandoffsView />
    : view === 'scope' ? <ScopeView />
    : tab === 'overview' ? <Overview />
    : tab === 'racm' ? (view === 'racm-list' ? <Racm /> : <RacmLanding />)
    : tab === 'risks' ? <RiskLibrary />
    : tab === 'runs' ? <RunsView />
    : tab === 'config' ? <AuditLogsView />
    : <ControlRegister />;

  return (
    <div className="sox-book-ui h-full overflow-y-auto bg-canvas">
      {/* The control detail page and the RACM matrix stand alone — no engagement
          header, no role switcher; the persona is fixed until you go back to the
          engagement. */}
      {view !== 'dossier' && !isDrillIn && topBar}
      <div className="max-w-[1320px] mx-auto px-6 pt-4 pb-6">
        {isRoot && (
          <EngagementTabBar tabs={tabs} activeTab={tab} onSelect={(id) => setTab(id as SoxTab)} storageKey={`sox-${eng.id}`} size="md" />
        )}
        {isRacmMatrix && (
          <SoxBreadcrumb onBack={() => setView('racm')} items={[
            ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
            { label: eng.name, onClick: () => setTab('overview') },
            { label: 'RACM', onClick: () => setView('racm') },
            { label: racmProcess ?? eng.controls[0]?.process ?? 'Matrix' },
          ]} />
        )}
        {isScope && (
          /* one level up from the ground rules is the engagement itself — always
             its Overview, not whichever tab happened to be open when it was opened */
          <SoxBreadcrumb onBack={() => setTab('overview')} items={[
            ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
            { label: eng.name, onClick: () => setTab('overview') },
            { label: 'Materiality & scope' },
          ]} />
        )}
        {view === 'dossier' && (() => {
          /* the dossier's trail names where ← actually lands — back() returns
             to the context it was opened from, not a pinned page */
          const VIEW_LABEL: Record<string, string> = {
            register: 'Control Library', 'racm-list': 'RACM', racm: 'RACM', deficiencies: 'Exceptions',
            scope: 'Materiality & scope', runs: 'Test runs', overview: 'Overview', risks: 'Risk Register', handoffs: 'Handoffs',
          };
          const from = VIEW_LABEL[returnView ?? ''] ?? VIEW_LABEL[tab === 'controls' ? 'register' : tab] ?? 'Overview';
          const wpRef = eng.controls.find(c => c.id === selectedControlId)?.wpRef ?? 'Control';
          return (
            <SoxBreadcrumb onBack={back} items={[
              ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
              { label: eng.name, onClick: () => setTab('overview') },
              { label: from, onClick: back },
              { label: wpRef },
            ]} />
          );
        })()}
        {isHandoffs && (
          <SoxBreadcrumb onBack={back} items={[
            ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
            { label: eng.name, onClick: () => setTab('overview') },
            { label: 'Handoffs' },
          ]} />
        )}
        {isDeficiencies && (
          /* Reached from the Overview, a control's dossier, the reviewer queue and
             notifications — so the arrow returns to context, not a pinned page.
             The persona switcher rides along here (it does not on the other
             drill-ins): this page IS the three-lines handoff, walked by switching
             hats — owner remediates, auditor retests, reviewer closes. */
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SoxBreadcrumb onBack={back} items={[
              ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
              { label: eng.name, onClick: () => setTab('overview') },
              { label: role === 'risk-owner' ? 'My exceptions' : 'Exceptions' },
            ]} />
            <div className="flex items-center gap-2 mb-3 shrink-0 opacity-75 hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">Viewing as</span>
              <RoleSwitcher role={role} onChange={setRole} />
              {role === 'risk-owner' && <OwnerPicker owner={meOwner} options={owners} onChange={setMeOwner} />}
            </div>
          </div>
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

export default function SoxIcfrApp({ engagementId, onBack, backLabel }: { engagementId?: string; onBack?: () => void; backLabel?: string }) {
  // The SOX persona follows the platform login: risk owners land in the
  // Risk Owner view, reviewers in the Reviewer view; everyone else — including
  // signed-out — defaults to Auditor. The keyed provider re-seeds on login change.
  const { currentUser } = useCurrentUser();
  const initialRole = currentUser?.roleId === 'role-risk' ? 'risk-owner' : currentUser?.roleId === 'role-reviewer' ? 'reviewer' : 'auditor';
  const eng = engagementId ? findEngagement(engagementId) : undefined;
  const seedMeta = eng ? { id: eng.id, code: eng.code, name: eng.name, process: eng.process, processes: eng.soxProcesses, seedMode: eng.soxSeedMode, periodStart: eng.periodStart, periodEnd: eng.periodEnd, owner: eng.owner, materiality: eng.soxConfig?.overallMateriality, performanceMateriality: eng.soxConfig?.performanceMateriality, clearlyTrivial: eng.soxConfig?.clearlyTrivial, sdBandPct: eng.soxConfig?.sdBandPct } : undefined;
  return (
    <IcfrProvider key={currentUser?.id ?? 'signed-out'} initialRole={initialRole} seedMeta={seedMeta}>
      <Inner onBack={onBack} backLabel={backLabel} />
    </IcfrProvider>
  );
}
