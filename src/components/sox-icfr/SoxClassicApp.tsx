import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, BadgeCheck } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { EngagementTabBar, type TabDef } from '../audit/EngagementTabBar';
import { useIcfr, type SoxTab } from './store';
import { AUDIT_TABS, defWord } from './flow';
import { ownersOf } from './auditScope';
import type { SoxTabLike } from './types';
import { OwnerPicker, RoleSwitcher, SoxBreadcrumb } from './parts';
import NotificationsBell from './NotificationsBell';
import Overview from './Overview';
import EngagementOverview from './EngagementOverview';
import AuditConfigView from './AuditConfigView';
import AuditArchiveView from './AuditArchiveView';
import Racm, { RacmLanding } from './Racm';
import RiskLibrary from './RiskLibrary';
import ControlRegister from './ControlRegister';
import ControlLibrary from './ControlLibrary';
import ControlDossier from './ControlDossier';
import ControlLibraryDetail from './ControlLibraryDetail';
import AuditLogsView from './AuditLogsView';
import { DeficienciesView, HandoffsView, ScopeView } from './extraViews';
import RacmFullPageEditor from '../audit/RacmFullPageEditor';
import SamplingMethodologyView from './SamplingMethodologyView';
// PARKED with the old engagement-wide Configuration page — see SOX_TABS below.
// import ConfigurationView from './ConfigurationView';

/**
 * The SOX engagement as it stood before the audit-first rework (commit 1a0fe4d),
 * kept verbatim for every engagement except the one the new flow is being built
 * on. See flow.ts for why.
 *
 * No audits, deficiencies reached as a drill-in. What this file pins is the
 * SHELL — which tabs exist, what the drill-ins are, what a failed control is
 * called. It is not a feature freeze: the surfaces it renders (ControlDossier,
 * Racm, DeficienciesView, the working paper) are the same components the new flow
 * uses, so work landing there lands here too. That is deliberate — new capability
 * ships to every SOX engagement, and only the reworked journey is held back.
 */
/* Control Library — LENS SWAP (user ask, 30 Jul), same as the reworked shell.
   Kept as its own flag here rather than importing SoxIcfrApp's, so the two
   shells can't accidentally couple through it. ControlRegister is untouched
   and still compiles — flip this to false to bring the testing lens straight
   back for every classic engagement. */
const LIBRARY_LENS = true;

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
  /* Risk Register — PARKED from the engagement tabs (user ask), matching the
     park already in place on the reworked flow. Only this line is commented
     out: the 'risks' SoxTab/View types, TAB_ROOT, RETURNABLE, the
     `tab === 'risks' ? <RiskLibrary />` branch below and the dossier
     breadcrumb's 'Risk Register' label all stay wired and compiling, so
     restoring the tab is uncommenting this line.
     Known consequence while it's off — RiskLibrary was the only surface
     carrying the inherent / residual heatmaps, so risk exposure isn't visible
     anywhere in a SOX engagement; the RACM lists risk rows but doesn't score
     them. Nothing navigates into the tab, so no link is left dangling. */
  // { id: 'risks', label: 'Risk Register' },
  { id: 'controls', label: 'Control Library' },
  { id: 'runs', label: 'SOX testing' },
  /* Configuration is BACK (23 Sep), carrying the same one thing the reworked
     shell's does: the sampling methodology (#22). It had been parked because
     period, scope, TB / GL and materiality are all set per cycle and nothing
     engagement-wide was left to configure.

     It has to come back HERE and not only on the reworked shell, because only
     `sox-v2-fy26` takes that shell — every engagement the wizard creates lands
     on this one. Those engagements now arrive carrying the lead's proposed
     methodology, unsigned, and testing waits on a reviewer's signature that
     can only be given on this tab. Without it the proposal had no door, and
     the gate would have held shut with nothing able to open it.

     What does NOT come back is the old engagement-wide ConfigurationView —
     entities, trial balances, re-deriving scope. That park stands (user ask);
     its branch below stays wired, so restoring it is swapping the component. */
  { id: 'config', label: 'Configuration' },
];

export default function SoxClassicInner({ onBack, backLabel = 'Back to Engagements' }: { onBack?: () => void; backLabel?: string }) {
  // the breadcrumb names where ← actually lands — "Engagements" or "SOX Testing"
  const backCrumb = backLabel.replace(/^Back to /, '');
  const { eng, role, tab, view, racmEditor, racmProcess, meOwner, selectedControlId, returnView, openAuditId, closeAudit, setMeOwner, setRole, setTab, setView, back } = useIcfr();
  const concluded = !!(eng.signoff.preparer && eng.signoff.reviewer);
  /* Audits reached this shell with the portfolio Overview, so opening one has to
     work here too — a register row whose Open button did nothing would be worse
     than no register. Same two levels and the same AUDIT_TABS as the reworked
     shell, imported rather than restated so the two can't drift. What still
     differs between the shells is the WORDING (exception vs deficiency, see
     flow.ts), which is why they remain separate files. */
  const audit = eng.audits.find(a => a.id === openAuditId);
  const inAudit = !!audit;
  // The owner's SOX is a to-do list, not a workspace: their inbox, their controls
  // and their own findings. RACM and the audit register are auditor-side surfaces.
  //
  // That third tab was missing here while the reworked shell had it, which left
  // the owner on every classic engagement with no route at all to the findings
  // they are the ones being asked to fix — the deficiency page exists, and they
  // simply could not reach it. Same three tabs on both shells now; only the
  // WORDING differs, which is what defWord is for.
  const levelTabs = inAudit ? AUDIT_TABS : SOX_TABS;
  const tabs = role === 'risk-owner'
    ? [
        ...levelTabs.filter(t => t.id === 'overview' || t.id === 'controls'),
        { id: 'deficiencies' as const, label: defWord(eng.id).mine },
      ]
    : levelTabs;
  // Both capacities — see the same list in SoxIcfrApp.
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

  // The five tabs are the primary nav; everything else is a drill-in reached from them.
  // A drilled-in RACM matrix stands alone like the control page — no engagement
  // header, no tabs; its breadcrumb carries the context and every step back up.
  const isRacmMatrix = view === 'racm-list';
  const isScope = view === 'scope';
  // Deficiencies is one of the audit's four tabs inside an audit, and a
  // breadcrumbed drill-in outside one.
  const isDeficiencies = view === 'deficiencies' && !inAudit;
  const isHandoffs = view === 'handoffs';
  // drilled-in document pages carry a breadcrumb instead of the engagement header
  const isDrillIn = isRacmMatrix || isScope || isDeficiencies || isHandoffs;
  // Same as the reworked shell: the audit's control page runs two panes and
  // takes the height rather than the scroll. It has to be kept in step here —
  // ControlDossier's row is `flex-1 min-h-0`, which collapses to nothing if
  // the page above it has no height of its own to give.
  const dossierPanes = view === 'dossier' && inAudit;
  const isRoot = view === 'overview' || view === 'racm' || view === 'risks' || view === 'register'
    || view === 'runs' || view === 'config' || (inAudit && view === 'deficiencies');
  // Same as the reworked shell: a concluded audit is its archive, read-only.
  const body = (inAudit && audit!.archive && isRoot)
    ? <AuditArchiveView audit={audit!} tab={(tab === 'racm' || tab === 'risks' || tab === 'runs' ? 'overview' : tab) as SoxTabLike} />
    : view === 'dossier' ? (inAudit ? <ControlDossier /> : <ControlLibraryDetail />)
    : view === 'deficiencies' ? <DeficienciesView />
    : view === 'handoffs' ? <HandoffsView />
    : view === 'scope' ? <ScopeView />
    // The engagement's Overview is the audit portfolio; the audit's own Dashboard
    // is Overview.tsx, reached by opening an audit. This shell has no audit level,
    // so it only ever shows the portfolio — see SoxIcfrApp for the pair.
    // Inside an audit for the audit side; at engagement level it is the owner's
    // own tab — their findings span whichever audit is testing them.
    : ((inAudit || role === 'risk-owner') && tab === 'deficiencies') ? <DeficienciesView />
    : (inAudit && tab === 'config') ? <AuditConfigView audit={audit!} />
    // The risk owner never gets the portfolio: their engagement-level tabs are an
    // inbox and their controls, and the inbox (RiskOwnerPortal, inside Overview)
    // is engagement-wide anyway — their controls and their deficiencies, whichever
    // audit is testing them. A portfolio of audits is an auditor's question.
    : tab === 'overview' ? ((inAudit || role === 'risk-owner') ? <Overview /> : <EngagementOverview />)
    : tab === 'racm' ? (view === 'racm-list' ? <Racm /> : <RacmLanding />)
    : tab === 'risks' ? <RiskLibrary />
    : tab === 'runs' ? <AuditLogsView />
    // The engagement level holds the methodology; the audit level holds the
    // cycle's own settings (above). Same tab id, two pages, forking by level
    // exactly as Overview and Control Library already do.
    : tab === 'config' ? <SamplingMethodologyView />
    // Two different Control Library lenses (user ask, 30 Jul), same split as
    // the reworked shell: engagement root = ControlLibrary (attributes,
    // workflow mapping); inside an audit = ControlRegister (TOD/TOE results,
    // Not tested/Effective/Ineffective), independent of LIBRARY_LENS.
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
      {/* 32px gutter on the control page, as in the reworked shell. */}
      <div className={cn('pt-4 w-full',
        dossierPanes ? 'flex-1 min-h-0 flex flex-col px-8' : 'max-w-[1320px] mx-auto px-6 pb-6')}>
        {inAudit && isRoot && (
          <div className="flex items-start justify-between gap-3">
            <SoxBreadcrumb onBack={closeAudit} items={[
              ...(onBack ? [{ label: backCrumb, onClick: onBack }] : []),
              { label: eng.name, onClick: closeAudit },
              { label: `${audit!.period} · ${audit!.round === 'interim' ? 'Interim' : audit!.round === 'rollforward' ? 'Roll-forward' : 'Year-end'}` },
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
        {isRoot && (
          <EngagementTabBar tabs={tabs} activeTab={tab} onSelect={(id) => setTab(id as SoxTab)} storageKey={inAudit ? `sox-audit-${eng.id}` : `sox-${eng.id}`} size="md" />
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
          // The library's control page carries a white header band that runs to
          // both screen edges; the trail sits on the same white, so the two
          // read as one region rather than a strip floating on the canvas.
          // Both control pages carry that band now, so both trails sit on it.
          return (
            <div className="relative flow-root -mt-4 pt-4">
              <div aria-hidden className="absolute inset-y-0 left-[-50vw] right-[-50vw] bg-canvas-elevated" />
              <div className="relative">{trail}</div>
            </div>
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
          <motion.div key={`${role}-${tab}-${view}`} className={cn(dossierPanes && 'flex-1 min-h-0 flex flex-col')}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
