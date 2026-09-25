import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { findEngagement } from '../../data/engagements';
import { EngagementTabBar, type TabDef } from '../audit/EngagementTabBar';
import { IcfrProvider, useIcfr, type SoxTab } from './store';
import type { SoxTabLike } from './types';
import { AUDIT_TABS, defWord, isNewFlow, NEW_FLOW_BODY_CLASS } from './flow';
import { ownersOf } from './auditScope';
import { seedMetaFor } from './racmLibrary';
import SoxClassicInner from './SoxClassicApp';
import { OwnerPicker, RoleSwitcher, SoxBreadcrumb } from './parts';
import NotificationsBell from './NotificationsBell';
import Overview from './Overview';
import EngagementOverview from './EngagementOverview';
import Racm, { RacmLanding } from './Racm';
import RiskLibrary from './RiskLibrary';
import ControlRegister from './ControlRegister';
import ControlLibrary from './ControlLibrary';
import ControlDossier from './ControlDossier';
import ControlLibraryDetail from './ControlLibraryDetail';
import AuditLogsView from './AuditLogsView';
import AuditConfigView from './AuditConfigView';
import SamplingMethodologyView from './SamplingMethodologyView';
import AuditArchiveView from './AuditArchiveView';
import { DeficienciesView, HandoffsView, ScopeView } from './extraViews';
import RacmFullPageEditor from '../audit/RacmFullPageEditor';
/* Control Library — LENS SWAP (user ask, 30 Jul). The Control Library tab now
   shows the LIBRARY lens (ControlLibrary: attributes, workflow mapping, run
   history, audit runs) instead of the TESTING lens (ControlRegister: design /
   operating tracks, conclusion, due-now). ControlRegister is untouched and
   still renders on every classic SOX engagement (SoxClassicApp) — only this
   reworked shell switched. Flip LIBRARY_LENS to false to park the new lens and
   bring the testing lens straight back; nothing else has to change. */
const LIBRARY_LENS = true;
/* Three surfaces are UNREACHABLE (user ask). Their files are untouched and still
   compile — nothing was deleted, only unwired, so restoring one is re-importing
   it and putting its branch back:

     ConfigurationView  — the engagement's entities / TBs / period / materiality.
                          The engagement's Configuration TAB is back (23 Sep) but
                          this file did not come back with it: the tab holds the
                          sampling methodology and nothing else. Entities, TBs,
                          period and materiality are still per cycle, on
                          AuditConfigView.
     DashboardView      — the engagement read-out that listed audits, from the
                          Dashboard / Audit logs pair the engagement used to have
     RunsView           — the engagement-wide run registry, which the SOX audit
                          tab used to hold before it became the audit register

// import ConfigurationView from './ConfigurationView';
// import DashboardView from './DashboardView';
// import RunsView from './RunsView';
*/

const SOX_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  /* RACM — PARKED (S11): RACMs live on the Engagements page's RACM tab. An
     engagement keeps only its Control library, holding the controls it copied
     in with Add RACM (AddRacmModal). Only this line is commented out: the
     'racm' SoxTab/View types, the RacmLanding / Racm branches below, the
     matrix breadcrumb and the store's RACM actions all stay wired and
     compiling, so restoring the tab is uncommenting it. Every route that used
     to land here now opens Add RACM or the Control Library tab instead. */
  // { id: 'racm', label: 'RACM' }, // 'Risk & Control Matrix' tooltip can't be set here — TabDef has no title field & EngagementTabBar owns the item title. Flagged.
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
  /* Deficiency management is not an ENGAGEMENT tab either — it is one of the
     audit's four (AUDIT_TABS below). Reached from the engagement level it is
     still a DRILL-IN under a breadcrumb: every route in calls
     setView('deficiencies'), which works at either level. */
  { id: 'runs', label: 'SOX testing' },
  /* Configuration is BACK at the engagement level (23 Sep), carrying one thing:
     the sampling methodology (#22). It was parked because period, scope, TB / GL
     and materiality are all set per cycle — there was nothing engagement-wide
     left to configure. Sampling is the first setting that genuinely is: the
     approach does not change between a year's interim and year-end rounds, so
     putting it on an audit would let two rounds of one year test off different
     tables, and putting it on a control is the 124-separate-decisions problem
     the client raised.
     The AUDIT keeps its own Configuration — same tab id, different page, the way
     Overview and Control Library already fork by level (see `body` below).
     The old engagement-wide ConfigurationView — entities, TBs, period,
     materiality — stays parked; none of it came back with this. */
  { id: 'config', label: 'Configuration' },
];

/**
 * Two levels again (user ask).
 *
 * The ENGAGEMENT is the tabs in SOX_TABS above — Overview, Control Library,
 * SOX audit (the audit register) and Configuration, which holds the one setting
 * that is genuinely engagement-wide: the sampling methodology every audit and
 * every control reads off. (RACM is parked, S11 — RACMs live on the
 * Engagements page's RACM tab.) Opening an audit from that register,
 * or creating one (createAudit opens what it creates), swaps in AUDIT_TABS behind
 * a breadcrumb: that cycle's Dashboard, its Control Library — only the controls
 * its scope covers, reset to Not started by createAudit — its deficiencies and
 * its Configuration.
 *
 * What stays retired: DashboardView, the engagement-level Dashboard / Audit logs
 * pair it belonged to, and ConfigurationView — the engagement's old entities /
 * TBs / period / materiality page, which the revived Configuration tab does not
 * bring back. Their files are untouched and still compile.
 *
 * Deficiency management is a TAB inside an audit and a DRILL-IN outside one —
 * hence the `inAudit` term in `isRoot` below. Every route into it calls
 * setView('deficiencies'), which works at either level.
 *
 * What survives without an audit: every reader of the open audit already had a
 * fallback for the pre-first-audit state, and they all take it now —
 * useAuditControls returns the full control set rather than an audit's scope,
 * and the working paper's period line falls back to the engagement's own span
 * (periodLine in icfrWorkingPaper.ts). So nothing goes blank; the numbers are
 * engagement-wide instead of cycle-wide.
 */
function Inner({ onBack, backLabel = 'Back to Engagements' }: { onBack?: () => void; backLabel?: string }) {
  // the breadcrumb names where ← actually lands — "Engagements" or "SOX Testing"
  const backCrumb = backLabel.replace(/^Back to /, '');
  const { eng, role, tab, view, racmEditor, racmProcess, meOwner, selectedControlId, returnView, openAuditId, closeAudit, setMeOwner, setRole, setTab, setView, back } = useIcfr();
  // Engagement-level signoff is never written — cycles conclude on each audit's
  // own record, and the engagement outlives them, so the header pill stays Active.
  const concluded = !!(eng.signoff.preparer && eng.signoff.reviewer);
  const W = defWord(eng.id);
  const audit = eng.audits.find(a => a.id === openAuditId);
  const inAudit = !!audit;

  // The owner's SOX is a to-do list, not a workspace: their inbox, their controls
  // and their exceptions. RACM and the audit register stay auditor-side.
  //
  // The exceptions tab is not optional for them. Steps ③ and ④ — writing the plan
  // and doing the fix — are the owner's, and a role that cannot reach its own
  // work cannot do it. The list scopes itself to their controls, so this is their
  // queue rather than the engagement's exposure.
  const levelTabs = inAudit ? AUDIT_TABS : SOX_TABS;
  const tabs = role === 'risk-owner'
    ? [
        ...levelTabs.filter(t => t.id === 'overview' || t.id === 'controls'),
        { id: 'deficiencies' as const, label: W.mine },
      ]
    : levelTabs;
  // Every first-line name on the engagement, both capacities — a process owner
  // has controls to answer for too, so they need to be someone you can be.
  const owners = Array.from(new Set(eng.controls.flatMap(c => {
    const o = ownersOf(c);
    return o.single ? [o.controlOwner] : [o.controlOwner, o.processOwner];
  }))).sort();

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
  const isHandoffs = view === 'handoffs';
  // drilled-in document pages carry a breadcrumb instead of the engagement header.
  // Deficiencies is one again now that its tab is parked — 'deficiencies' is out
  // of `isRoot` below so the tab bar gives way to its own trail.
  // Deficiencies keeps the tab bar inside an audit (it IS one of the four) and
  // stands alone under a breadcrumb outside one.
  const isDeficiencies = view === 'deficiencies' && !inAudit;
  const isDrillIn = isRacmMatrix || isScope || isHandoffs || isDeficiencies;
  // The audit's control page runs two panes — a scrolling stepper and a rail
  // beside it that has to stay put — so it takes the height rather than the
  // scroll. Everything else here keeps the ordinary one-scroll page, including
  // the library's control page, which is deliberately one column.
  const dossierPanes = view === 'dossier' && inAudit;
  const isRoot = view === 'overview' || view === 'racm' || view === 'risks' || view === 'register'
    || view === 'runs' || view === 'config' || (inAudit && view === 'deficiencies');
  // A CONCLUDED audit is read from its archive, not from the live controls —
  // otherwise this year's figures would render under last year's breadcrumb. It
  // takes over every one of the audit's four tabs.
  const body = (inAudit && audit!.archive && isRoot)
    ? <AuditArchiveView audit={audit!} tab={(tab === 'racm' || tab === 'risks' || tab === 'runs' ? 'overview' : tab) as SoxTabLike} />
    // The engagement-root control page is the LIBRARY lens's own detail view —
    // structure and workflow mapping, no testing. Inside an audit it is still
    // the full testing page.
    : view === 'dossier' ? (inAudit ? <ControlDossier /> : <ControlLibraryDetail />)
    : (view === 'deficiencies' || tab === 'deficiencies') ? <DeficienciesView />
    : view === 'handoffs' ? <HandoffsView />
    : view === 'scope' ? <ScopeView />
    // Two different pages behind one tab. Outside an audit the engagement's
    // Overview is the AUDIT PORTFOLIO — audits as rows, cross-audit roll-ups,
    // coverage. Inside one it is that audit's Dashboard: controls, materiality,
    // sign-off. With several audits running, a single page could not answer
    // "16/20 of what" without naming the audit.
    // The risk owner never gets the portfolio: their engagement-level tabs are an
    // inbox and their controls, and the inbox (RiskOwnerPortal, inside Overview)
    // is engagement-wide anyway — their controls and their deficiencies, whichever
    // audit is testing them. A portfolio of audits is an auditor's question.
    : tab === 'overview' ? ((inAudit || role === 'risk-owner') ? <Overview /> : <EngagementOverview />)
    : tab === 'racm' ? (view === 'racm-list' ? <Racm /> : <RacmLanding />)
    : tab === 'risks' ? <RiskLibrary />
    : tab === 'runs' ? <AuditLogsView />
    // Two pages behind one tab, like Overview and Control Library above. Inside
    // an audit, Configuration is that cycle's own settings; at the engagement it
    // is the sampling methodology, which is agreed once and outlives every audit
    // that reads it.
    : tab === 'config' ? (audit ? <AuditConfigView audit={audit} /> : <SamplingMethodologyView />)
    // Two different Control Library lenses (user ask, 30 Jul): the engagement
    // root asks "what is this control made of" (ControlLibrary — attributes,
    // workflow mapping). Inside an audit the question is "did it pass" — TOD
    // and TOE results, Not tested/Effective/Ineffective — so that's always
    // ControlRegister there, independent of LIBRARY_LENS.
    : inAudit ? <ControlRegister />
    : LIBRARY_LENS ? <ControlLibrary />
    : <ControlRegister />;

  return (
    <div className={cn('sox-book-ui h-full bg-canvas',
      // CLIP, not hidden (25 Sep). The control page's header band is drawn
      // `left-[-50vw] right-[-50vw]` so the white runs to both screen edges,
      // which leaves this box ~700px of overflow it must not show. `hidden`
      // hides the scrollbar but still lets the browser scroll the box sideways
      // to reveal something it has just focused — a modal closing, a field
      // opening — and with no scrollbar to put it back, the page stays shunted
      // with its left edge cut off: the breadcrumb reading "ents /" and the
      // control's name starting mid-word. `clip` refuses the scroll itself, so
      // there is nothing to come back from.
      // `overflow-clip` on BOTH axes, not `overflow-x-clip` alone: per CSS
      // Overflow 3, `clip` on one axis degrades to `hidden` unless the other
      // axis is also clip/visible — so `overflow-x-clip overflow-y-hidden`
      // computes to plain hidden and changes nothing. This box never scrolled
      // on either axis (it was `overflow-hidden`); its children own the
      // scrolling, so clipping both is the exact non-scrolling equivalent.
      //
      // The scrolling branch below has to stay `hidden` for the same spec
      // reason — `overflow-y: auto` forces `overflow-x: clip` back to hidden —
      // so a full-bleed band on a page that scrolls vertically can still be
      // shunted. No page in that branch carries one today.
      dossierPanes ? 'overflow-clip flex flex-col' : 'overflow-y-auto overflow-x-hidden')}>
      {/* The control detail page and the RACM matrix stand alone — no engagement
          header, no role switcher; the persona is fixed until you go back to the
          engagement. */}
      {view !== 'dossier' && !isDrillIn && !inAudit && topBar}
      {/* The control page runs to a 32px gutter rather than a centred 1320px
          column (user, 22 Sep — matching the production app). It is the one
          page here that is two panes wide, and a centred column spent the
          difference on empty canvas either side of the work. */}
      <div className={cn('pt-4 w-full',
        dossierPanes ? 'flex-1 min-h-0 flex flex-col px-8' : 'max-w-[1320px] mx-auto px-6 pb-6')}>
        {/* Inside an audit the engagement header gives way to a breadcrumb, but
            the persona switcher comes WITH it: every testing, review and
            sign-off action lives inside an audit, so this is where switching
            hats has to be possible. */}
        {inAudit && isRoot && (
          <div className="flex items-start justify-between gap-3">
            <SoxBreadcrumb onBack={closeAudit} items={[
              ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
              { label: eng.name, onClick: closeAudit },
              { label: audit!.period },
            ]} />
            <div className="flex items-center gap-3 shrink-0 -mt-1">
              <NotificationsBell />
              <span className="w-px h-6 bg-canvas-border" aria-hidden />
              <div className="flex items-center gap-2 opacity-75 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">Viewing as</span>
                <RoleSwitcher role={role} onChange={setRole} />
                {role === 'risk-owner' && <OwnerPicker owner={meOwner} options={owners} onChange={setMeOwner} />}
              </div>
            </div>
          </div>
        )}
        {/* One bar, two levels — the engagement's four tabs, or the open audit's.
            Separate storage keys so reordering one doesn't reorder the other. */}
        {isRoot && (
          <EngagementTabBar
            tabs={tabs}
            activeTab={tab}
            onSelect={(id) => setTab(id as SoxTab)}
            storageKey={inAudit ? `sox-audit-${eng.id}` : `sox-${eng.id}`}
            size="md"
          />
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
            register: 'Control Library', 'racm-list': 'RACM', racm: 'RACM', deficiencies: 'Deficiency management',
            scope: 'Materiality & scope', runs: 'SOX testing', overview: 'Overview', risks: 'Risk Register', handoffs: 'Handoffs',
          };
          const from = VIEW_LABEL[returnView ?? ''] ?? VIEW_LABEL[tab === 'controls' ? 'register' : tab] ?? 'Overview';
          const wpRef = eng.controls.find(c => c.id === selectedControlId)?.wpRef ?? 'Control';
          const trail = (
            <SoxBreadcrumb onBack={back} items={[
              ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
              { label: eng.name, onClick: () => setTab('overview') },
              { label: from, onClick: back },
              { label: wpRef },
            ]} />
          );
          // The white band behind this went with the header's own (22 Sep):
          // the header is a card on the canvas now, and a full-bleed strip
          // above a card reads as a seam rather than a region.
          return trail;
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
             hats — owner remediates, auditor retests, reviewer closes. Back on a
             breadcrumb now that its tab is parked. */
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SoxBreadcrumb onBack={back} items={[
              ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
              { label: eng.name, onClick: () => setTab('overview') },
              { label: role === 'risk-owner' ? W.mine : W.page },
            ]} />
            <div className="flex items-center gap-2 mb-3 shrink-0 opacity-75 hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">Viewing as</span>
              <RoleSwitcher role={role} onChange={setRole} />
              {role === 'risk-owner' && <OwnerPicker owner={meOwner} options={owners} onChange={setMeOwner} />}
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={`${role}-${openAuditId ?? 'eng'}-${tab}-${view}`} className={cn(dossierPanes && 'flex-1 min-h-0 flex flex-col')}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
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
  const seedMeta = eng ? seedMetaFor(eng) : undefined;
  return (
    <IcfrProvider key={currentUser?.id ?? 'signed-out'} initialRole={initialRole} seedMeta={seedMeta}>
      <Flow onBack={onBack} backLabel={backLabel} />
    </IcfrProvider>
  );
}

/**
 * One fork, read from inside the provider so it sees the seeded id rather than
 * the prop (which is absent on the standalone route).
 *
 * The new audit-first journey runs on one engagement while it is being designed;
 * everything else renders the pre-rework layout, untouched. See flow.ts.
 */
function Flow({ onBack, backLabel }: { onBack?: () => void; backLabel?: string }) {
  const { eng } = useIcfr();
  const newFlow = isNewFlow(eng.id);

  // Portalled modals land on document.body, out of reach of any React ancestor,
  // so CSS that must not touch the classic engagements hangs off a body class.
  useEffect(() => {
    if (!newFlow) return;
    document.body.classList.add(NEW_FLOW_BODY_CLASS);
    return () => document.body.classList.remove(NEW_FLOW_BODY_CLASS);
  }, [newFlow]);

  return newFlow
    ? <Inner onBack={onBack} backLabel={backLabel} />
    : <SoxClassicInner onBack={onBack} backLabel={backLabel} />;
}
