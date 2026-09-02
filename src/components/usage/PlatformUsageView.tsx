/**
 * Platform Usage. One page, three readers, one question.
 *
 * Built from `Platform-Usage-Build-Spec_2.pdf` (11 Aug 2026). The page answers
 * one question: is the platform earning its keep? A CFO asks it as "is this
 * paying for itself", a head of team as "is anything stuck", an internal
 * auditor as "what is waiting on me". It is one page with a "Viewing as" switch
 * at the top rather than three pages, and the switch changes whose data you see
 * and which block comes first. It never changes the layout, the wording or the
 * names of things, so somebody who changes roles never has to relearn the page.
 *
 * ## Three rules hold the switch
 *
 * **It is a lens, not a key.** Switching never shows anybody data they could not
 * otherwise see. A view the reader is not entitled to is not offered.
 *
 * **Down your own line only.** You can narrow into your own team or into your
 * own work. You can never look sideways into somebody else's team.
 *
 * **The screen always says what you are looking at**, in one line above the
 * blocks: who, what scope, which window, how fresh.
 *
 * ## Three tabs, the Knowledge Hub's
 *
 * Value, Coverage and Activity, underlined on the foot of the header strip the
 * way the Knowledge Hub tabs its own page. Every reader gets the same three in
 * the same order, so the switch still never changes the shape of the page. What
 * the switch changes is which tab opens first and which blocks it holds: a CFO
 * lands on Value, a head of team and an auditor land on Activity, where what is
 * stuck and what is waiting on them live.
 *
 * ## Answers first, machinery never
 *
 * Every view opens with at most three attention cards, each a sentence with one
 * thing to do, and they sit above the tabs rather than on one, so no reader can
 * be standing on a tab that hides them. Under the cards are blocks that lead
 * with a sentence rather than a tile.
 * Somebody who reads only those sentences understands the whole page. It works
 * with zero setup: no form is ever the price of seeing your numbers.
 *
 * There is no editor anywhere in this feature. The two measurable assumptions
 * replace themselves from the customer's own recorded history and the two that
 * cannot be measured are labelled defaults. Lookup prices are contract terms our
 * operations team seeds when the deal is signed, so cost appears by itself and
 * says "as per your contract".
 *
 * ## Read-only, without exception
 *
 * No control on this page changes state. Blocks link to the screen that owns an
 * action; they never perform one. Nothing ranks people, no figure is
 * benchmarked against another company, and there are no seats or licences here
 * because they are not a concept in this product.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Download, FileText, Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import { useMemorySessionVersion } from '../../data/memorySession';
import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import {
  DEFAULT_WINDOW, PERSONA_QUESTION, PERSONA_SCOPE_LABEL, PERSONA_TITLE, REFUSAL,
  calibrate, entitledViews, personaFor, snapshot, windowOf, windowOptions,
  type AttentionCard, type AttentionTarget, type Persona, type QueueFigures, type Scope,
  type WindowId,
} from '../../data/platform-usage-metrics';
import { AttentionStrip, BlockGroup, UsageTabs } from './usageKit';
import {
  AiUsageByArea, AssumptionsReference, CostAndNetValue, HeadlineValue, NetValueHero,
  SensitivityBlock, ValueOverTime,
} from './UsageValueBlocks';
import { ControlCoverage, ExceptionsCaught, NeverTested, RiskPicture } from './UsageCoverageBlocks';
import { CcmCoverage, MyQueue, MyWork, Reliability, SamplingOutcomes, StuckNow, TeamWork } from './UsageOperationsBlocks';
import { CreatedThisPeriod, DashboardsAndAlerts, EngagementPortfolio, ReportsMade, WorkVolume } from './UsageProductBlocks';
import { AiInsights, FindingQuality, FindingsAgeing } from './UsageFindingBlocks';
import { PastTheirDate, PlanCompletion } from './UsageCommitteeBlocks';
import { pack } from '../../data/audit-coverage';
import { SmartLearn } from './UsageSmartLearn';
import { downloadUsageCsv } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

/* ── The three tabs ──────────────────────────────────────────────────────── */

type TabId = 'value' | 'coverage' | 'activity';

/**
 * Three tabs, the same three for every reader, so the "Viewing as" switch still
 * changes whose data you see and never the shape of the page. What differs by
 * reader is which tab opens first and which blocks a tab holds.
 */
const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: 'value', label: 'Value', icon: TrendingUp },
  { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  { id: 'activity', label: 'Activity', icon: Activity },
];

/**
 * The tab each block lives on, so an attention card can open the right tab
 * before it scrolls. Every anchor in `src/components/usage` appears here; a
 * block missing from this map would leave its card scrolling to nothing.
 */
const TAB_OF_BLOCK: Record<string, TabId> = {
  hero: 'value', 'over-time': 'value', headline: 'value', 'my-work': 'value',
  cost: 'value', sensitivity: 'value', assumptions: 'value',
  coverage: 'coverage', never: 'coverage', portfolio: 'coverage', risks: 'coverage',
  'past-date': 'coverage', 'plan-completion': 'coverage',
  ccm: 'coverage', sampling: 'coverage', caught: 'coverage', ageing: 'coverage', quality: 'coverage',
  stuck: 'activity', reliability: 'activity', queue: 'activity', people: 'activity',
  volume: 'activity', created: 'activity', dashboards: 'activity', reports: 'activity',
  'ai-usage': 'activity', insights: 'activity', memory: 'activity',
};

/**
 * Where each reader lands. A CFO is here for the money, so Value opens first. A
 * head of team and an auditor are here for what is stuck and what is waiting on
 * them, which are both on Activity.
 */
const DEFAULT_TAB: Record<Persona, TabId> = {
  cfo: 'value',
  head_of_team: 'activity',
  auditor: 'activity',
};

/**
 * The card targets each view actually has a block for. A card aimed at anything
 * else leaves for the screen that owns the work rather than opening a tab on a
 * block this reader has not got. Keep this beside the tab definitions below: if
 * a block moves off a view, its line here moves with it.
 */
const CARD_BLOCK_ON_VIEW: Record<Persona, AttentionTarget[]> = {
  cfo: ['risks', 'controls', 'memory'],
  head_of_team: ['stuck', 'risks', 'controls', 'sampling', 'memory'],
  auditor: ['queue', 'memory'],
};

/** Where a card sends a reader whose view has no block for it. */
const CARD_ELSEWHERE: Record<AttentionTarget, string> = {
  stuck: 'workflow-library',
  risks: 'audit-risk-register',
  controls: 'governance-controls',
  sampling: 'engagements',
  queue: 'my-queue',
  memory: 'knowledge-hub',
};

/** Deep links out to the thing that needs doing, the way the palette does. */
function navigate(view: string, id = '') {
  window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', { detail: { kind: 'control', id, view } }));
}

/** Smart Learn is a tab of the Knowledge Hub, so it takes the tabbed event. */
function openSmartLearn() {
  window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view: 'knowledge-hub', tab: 'learn' } }));
}

export default function PlatformUsageView() {
  const { currentUser } = useCurrentUser();
  const { can } = useCan();
  const { users } = useAdminData();
  const { addToast } = useToast();
  const memoryVersion = useMemorySessionVersion();

  /* ── The assumptions, which look after themselves ───────────────────────── */

  // The weekly job, run as the page is read. Once both guards pass, a measured
  // value quietly replaces a starting one. Nobody is asked to confirm it,
  // because at ten thousand people nobody clicks. It settles before the first
  // render, so no reader watches a starting value flash to a measured one.
  const [settings] = useState(() => calibrate());

  /* ── Who is reading, and how far up they may see ────────────────────────── */

  const me = users.find(u => u.email === currentUser?.email);
  const myTeam = me?.team && me.team !== '—' ? me.team : null;
  const myName = me?.name ?? currentUser?.name ?? '';

  // The highest view this role may read. Everyone gets at least their own work:
  // this page is self-serve, and no request or approval stands in front of it.
  const ceiling: Persona = useMemo(
    () => personaFor({ usage: can('ad_usage'), people: can('ad_usage_people'), self: can('ad_usage_self') }, myTeam),
    [can, myTeam],
  );

  const views = useMemo(() => entitledViews(ceiling, myTeam), [ceiling, myTeam]);
  const [requested, setRequested] = useState<Persona>(ceiling);

  // The server resolves the requested view against the entitlement rather than
  // trusting the client. An unentitled request is refused, never quietly
  // downgraded and never rendered as an empty page.
  const entitled = views.includes(requested);
  const persona = entitled ? requested : ceiling;

  const canExport = can('ad_usage_export');

  const scope = useMemo<Scope>(() => {
    if (persona === 'cfo') return { persona: 'cfo', subject: 'the company' };
    if (persona === 'head_of_team') {
      return { persona: 'head_of_team', subject: myTeam ?? 'your team', team: myTeam ?? undefined, userEmail: currentUser?.email, userName: myName };
    }
    return { persona: 'auditor', subject: 'you', userEmail: currentUser?.email, userName: myName };
  }, [persona, myTeam, currentUser?.email, myName]);

  // An auditor reads their own work in hours and never in rupees. "You saved 84
  // hours" is an achievement; "you saved ₹1,00,800" is somebody pricing them.
  const showMoney = persona !== 'auditor';

  /* ── The window ─────────────────────────────────────────────────────────── */

  // Two windows and no third. The page opens on the quarter, because that is
  // the window the committee asks about, and the year to date is the context it
  // gets read in.
  const [windowId, setWindowId] = useState<WindowId>(DEFAULT_WINDOW);

  const chooseWindow = (id: WindowId) => setWindowId(id);

  /* ── The tab ────────────────────────────────────────────────────────────── */

  // Same rule as the window: each view opens on the tab it is meant to be read
  // on, and once a reader has picked a tab for themselves, changing view keeps
  // their choice rather than overruling it.
  const [tab, setTab] = useState<TabId>(() => DEFAULT_TAB[ceiling]);
  const [tabChosen, setTabChosen] = useState(false);

  const chooseTab = (id: TabId) => {
    setTabChosen(true);
    setTab(id);
  };

  const chooseView = (view: Persona) => {
    setRequested(view);
    if (!tabChosen) setTab(DEFAULT_TAB[view]);
  };
  const period = useMemo(() => windowOf(windowId), [windowId]);

  /* ── Every number on the view, assembled once ───────────────────────────── */

  const data = useMemo(
    () => snapshot(scope, period, settings),
    // memoryVersion is a real input even though it is not read directly: a
    // decision taken on the Smart Learn screen changes what this page counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, period, settings, memoryVersion],
  );

  /*
   * The committee's own figures, on the same window the page is reading.
   *
   * They are the whole company's, which is why they appear on the CFO view and
   * nowhere else: a head of team may never look sideways at another team's
   * work, and these numbers cannot be narrowed to one line of it.
   */
  const committee = useMemo(() => pack(period), [period]);

  /* ── Acting on a card ───────────────────────────────────────────────────── */

  /**
   * This opens the tab the block lives on, scrolls to it, and leaves for the
   * thing itself when this reader's view has no such block. No path through
   * here ends in neither, because a card that quietly does nothing is worse
   * than no card at all.
   *
   * The block is waited for rather than read straight away: the tab it lives on
   * may still be crossfading in, so `getElementById` on the next line would
   * find nothing and send the reader away from a block that was about to
   * appear.
   */
  const onAct = (card: AttentionCard) => {
    const leave = () => {
      if (card.target === 'memory') {
        openSmartLearn();
        return;
      }
      navigate(CARD_ELSEWHERE[card.target], card.focusId ?? '');
    };

    if (!CARD_BLOCK_ON_VIEW[persona].includes(card.target)) {
      leave();
      return;
    }

    const blockId = card.target === 'controls' ? 'never' : card.target;
    const owner = TAB_OF_BLOCK[blockId];
    if (owner && owner !== tab) chooseTab(owner);

    let tries = 0;
    const reach = () => {
      const block = document.getElementById(blockId);
      if (block) {
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (tries++ > 20) {
        leave();
        return;
      }
      window.setTimeout(reach, 50);
    };
    reach();
  };

  const onOpenQueueItem = (item: QueueFigures['items'][number]) => navigate(item.target.view, item.target.id ?? '');

  /* ── Export ─────────────────────────────────────────────────────────────── */

  const onExportCsv = () => {
    downloadUsageCsv(data);
    addToast({ type: 'success', message: 'Exported. The file carries the scope, the window and the assumptions.' });
  };

  const onExportPdf = async () => {
    await downloadUsagePdf(data);
    addToast({ type: 'success', message: 'Exported as a PDF, with the coverage note on the first page.' });
  };

  /* ── A refusal, never a blank page ──────────────────────────────────────── */

  if (!entitled) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas px-6">
        <div className="max-w-lg text-center">
          <Lock size={20} className="mx-auto text-ink-400" />
          <h1 className="mt-3 text-[1.25rem] font-semibold text-ink-900">Platform Usage</h1>
          <p className="mt-2 text-[0.875rem] text-ink-600 leading-relaxed">{REFUSAL}</p>
          <button
            type="button"
            onClick={() => chooseView(ceiling)}
            className="mt-4 h-8 px-3 rounded-lg border border-canvas-border text-[0.75rem] font-medium text-ink-700 hover:border-brand-200 hover:text-brand-700"
          >
            Go to the {PERSONA_TITLE[ceiling]} view
          </button>
        </div>
      </div>
    );
  }

  /*
   * There is no page-level figure strip.
   *
   * Every block now carries its own figure in its head, the way the AI insight
   * cards do everywhere else in this product. A strip on top of that printed
   * the same four numbers twice on one screen, which was the loudest complaint
   * about this page and the easiest to fix: one figure, one place.
   */

  /* ── The blocks, in the order each reader needs them ─────────────────────── */

  const smartLearnBlock = <SmartLearn learn={data.learn} scope={scope} onOpenSmartLearn={openSmartLearn} />;

  const exceptionsBlock = (
    <ExceptionsCaught
      exceptions={data.exceptions}
      period={period}
      subject={scope.subject}
      onOpenException={id => navigate('engagements', id)}
    />
  );

  /*
   * CFO. Value opens first: hours, rupees and people this quarter, then the
   * cost, the net figure and what it all rests on. Coverage carries what was
   * tested and what that testing caught. Activity carries what the platform and
   * the assistant did. The cost figures and the assumptions live only here.
   */
  const cfoTabs: Record<TabId, ReactNode> = {
    value: (
      <>
        <BlockGroup title="What it was worth">
          <NetValueHero
            value={data.value}
            change={data.change}
            cost={data.cost}
            netRupees={data.netRupees}
            period={period}
            settings={settings}
          />
          {/* No separate headline block here: the hero above is the headline and
              carries the whole sum, so a second block would say it all again. */}
          <ValueOverTime buckets={data.buckets} period={period} settings={settings} showMoney />
        </BlockGroup>

        <BlockGroup title="What it cost, and what it rests on">
          <CostAndNetValue cost={data.cost} value={data.value} netRupees={data.netRupees} period={period} />
          <SensitivityBlock rows={data.sensitivity} settings={settings} />
          <AssumptionsReference settings={settings} />
        </BlockGroup>
      </>
    ),

    coverage: (
      <>
        {/*
          * Coverage first, the committee's questions last.
          *
          * The committee group used to open this tab, so a reader who came here
          * to find out what was covered met an eighty row table of overdue
          * action plans, three pages of it, before a single coverage figure. The
          * overdue work is not less important; it is the answer to a different
          * question, and it reads better once the tab has said what was tested
          * and what that testing caught.
          */}
        <BlockGroup title="What it covered">
          <ControlCoverage
            coverage={data.coverage}
            period={period}
            checksPerformed={data.value.checksPerformed}
            coveredRows={data.value.coveredRows}
          />
          <NeverTested coverage={data.coverage} period={period} />
          <EngagementPortfolio
            portfolio={data.portfolio}
            period={period}
            onOpenEngagement={id => navigate('engagements', id)}
          />
          <RiskPicture risks={data.risks} scope={scope} onOpenRisks={() => navigate('audit-risk-register')} />
          <CcmCoverage ccm={data.ccm} period={period} />
        </BlockGroup>

        <BlockGroup title="What it caught">
          {exceptionsBlock}
          <FindingsAgeing
            ageing={data.ageing}
            subject={scope.subject}
            onOpenException={id => navigate('engagements', id)}
          />
          <FindingQuality quality={data.quality} period={period} />
        </BlockGroup>

        <BlockGroup title="What the committee will ask">
          <PastTheirDate
            coverage={committee}
            period={period}
            onOpen={(view, id) => navigate(view, id)}
          />
          <PlanCompletion coverage={committee} period={period} />
        </BlockGroup>
      </>
    ),

    activity: (
      <>
        <BlockGroup title="What the platform did">
          <WorkVolume volume={data.volume} period={period} subject={scope.subject} onOpenRuns={() => navigate('workflow-library')} />
          <CreatedThisPeriod created={data.created} period={period} />
          <DashboardsAndAlerts product={data.product} period={period} />
          <ReportsMade reports={data.reports} period={period} />
        </BlockGroup>

        <BlockGroup title="What the AI did, and what it knows">
          <AiUsageByArea rows={data.aiUsage} period={period} />
          <AiInsights insights={data.insights} period={period} />
          {smartLearnBlock}
        </BlockGroup>
      </>
    ),
  };

  /*
   * Head of Team. Activity opens first, on what is stuck with the real error
   * text on each run. A team lead cannot act on a lakh saved; they can act on
   * "this workflow failed four times this week with the same error", so the
   * savings sit on their own tab and the design trade-offs go this view's way.
   */
  const headOfTeamTabs: Record<TabId, ReactNode> = {
    value: (
      <BlockGroup title="What the team's work was worth">
        <HeadlineValue
          value={data.value}
          prior={data.prior}
          change={data.change}
          period={period}
          scope={scope}
          settings={settings}
          showMoney={showMoney}
        />
        <ValueOverTime buckets={data.buckets} period={period} settings={settings} showMoney={showMoney} />
      </BlockGroup>
    ),

    coverage: (
      <>
        <BlockGroup title="How the testing is going">
          <NeverTested coverage={data.coverage} period={period} />
          <SamplingOutcomes sampling={data.sampling} period={period} />
          <CcmCoverage ccm={data.ccm} period={period} />
          <RiskPicture risks={data.risks} scope={scope} onOpenRisks={() => navigate('audit-risk-register')} />
        </BlockGroup>

        <BlockGroup title="What the team caught">
          {exceptionsBlock}
          <FindingsAgeing
            ageing={data.ageing}
            subject={scope.subject}
            onOpenException={id => navigate('engagements', id)}
          />
          <FindingQuality quality={data.quality} period={period} />
        </BlockGroup>
      </>
    ),

    activity: (
      <>
        <BlockGroup title="What needs doing">
          <StuckNow stuck={data.stuck} period={period} onOpenRun={id => navigate('workflow-library', id)} />
          <Reliability rows={data.reliability.rows} wastedHours={data.reliability.wastedHours} period={period} />
        </BlockGroup>

        <BlockGroup title="What the team did">
          <TeamWork people={data.people} period={period} team={myTeam ?? 'your team'} />
          <CreatedThisPeriod created={data.created} period={period} />
          {smartLearnBlock}
        </BlockGroup>
      </>
    ),
  };

  /*
   * Internal Auditor. Activity opens first on their queue, overdue first, each
   * item one click from the thing that needs doing. Their own numbers are in
   * hours and never in rupees, and no other person appears anywhere on this
   * view: no average, no percentile, no comparison of any kind.
   */
  const auditorTabs: Record<TabId, ReactNode> = {
    value: (
      <BlockGroup title="Your own work">
        <MyWork value={data.value} exceptions={data.exceptions} period={period} settings={settings} />
        <ValueOverTime buckets={data.buckets} period={period} settings={settings} showMoney={false} />
      </BlockGroup>
    ),

    coverage: (
      <BlockGroup title="What you caught">
        {exceptionsBlock}
        <FindingsAgeing
          ageing={data.ageing}
          subject={scope.subject}
          onOpenException={id => navigate('engagements', id)}
        />
        <SamplingOutcomes sampling={data.sampling} period={period} />
      </BlockGroup>
    ),

    activity: (
      <>
        <BlockGroup title="What needs you">
          <MyQueue queue={data.queue} onOpen={onOpenQueueItem} />
        </BlockGroup>

        <BlockGroup title="What the assistant knows">{smartLearnBlock}</BlockGroup>
      </>
    ),
  };

  const tabs = persona === 'cfo' ? cfoTabs : persona === 'head_of_team' ? headOfTeamTabs : auditorTabs;

  /* ── The page ───────────────────────────────────────────────────────────── */

  /*
   * The whole sentence, even though the switch and the window pills each carry
   * part of it.
   *
   * It reads as a repetition on screen and it is not one: this line is what
   * travels. A screenshot of this page lands in a board pack with no switch and
   * no pills beside it, and a figure whose scope and window cannot be read off
   * the same image is a figure nobody can defend six weeks later.
   */
  const scopeLine = [
    `Viewing as ${PERSONA_TITLE[persona]}`,
    PERSONA_SCOPE_LABEL[persona] + (persona === 'head_of_team' && myTeam ? ` · ${myTeam}` : ''),
    `${period.label}, ${formatDate(period.from)} to ${formatDate(period.to)}`,
    dataAsOfLabel(),
  ].join(' · ');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="shrink-0">
        <div className="bg-canvas-elevated px-6 lg:px-12 xl:px-[124px] pt-8 border-b border-canvas-border">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[2.5rem] font-semibold tracking-tight text-ink-900 leading-[1.1]">Platform Usage</h1>
              <p className="mt-1.5 text-[0.875rem] text-ink-500 leading-relaxed max-w-2xl">{PERSONA_QUESTION[persona]}</p>
            </div>

            {/*
              * The switch. Only the views this reader is entitled to appear, so
              * it can narrow down their own line and can never reach sideways
              * into somebody else's team. One reader with one view sees no
              * switch, because a control with one option is furniture.
              */}
            {views.length > 1 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[0.75rem] text-ink-500">Viewing as</span>
                <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                  {views.map(view => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => chooseView(view)}
                      aria-pressed={persona === view}
                      className={`h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
                        persona === view ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-brand-700'
                      }`}
                    >
                      {PERSONA_TITLE[view]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.75rem] text-ink-500 tabular-nums">{scopeLine}</p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                {windowOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseWindow(option.id)}
                    aria-pressed={windowId === option.id}
                    className={`h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
                      windowId === option.id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:text-brand-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {canExport && (
                <>
                  <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={onExportCsv}>
                    CSV
                  </Button>
                  <Button variant="primary" size="sm" leftIcon={<FileText size={14} />} onClick={onExportPdf}>
                    PDF
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* The tabs sit on the strip's own border, which is their underline
              track, so the page grows one control rather than one more box. */}
          <div className="mt-5 -mb-px">
            <UsageTabs tabs={TABS} active={tab} onChange={chooseTab} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-12 xl:px-[124px] py-6 space-y-6 max-w-[1400px]">
          {/* The attention strip sits above the tabs' content rather than on a
              tab, because at most three cards are the one thing every reader
              must see whichever tab they are standing on. */}
          <section aria-label="Needs your attention">
            <AttentionStrip cards={data.attention} onAct={onAct} />
          </section>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="space-y-8"
            >
              {tabs[tab]}
            </motion.div>
          </AnimatePresence>

          <p className="text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed border-t border-canvas-border pt-4">
            {COVERAGE_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}
