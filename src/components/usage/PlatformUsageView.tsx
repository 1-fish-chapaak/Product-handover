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
 * ## Answers first, machinery never
 *
 * Every view opens with at most three attention cards, each a sentence with one
 * thing to do, then blocks that lead with a sentence rather than a tile.
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

import { useMemo, useState } from 'react';
import { CalendarRange, Download, FileText, Lock } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import FloatingLines from '../shared/FloatingLines';
import { useMemorySessionVersion } from '../../data/memorySession';
import { ANCHOR, COVERAGE_NOTE, dataAsOfLabel, formatDate, isoDay } from '../../data/platform-usage';
import {
  DEFAULT_PERIOD, PERSONA_QUESTION, PERSONA_SCOPE_LABEL, PERSONA_TITLE, REFUSAL,
  calibrate, entitledViews, period as buildPeriod, periodOptions, personaFor, snapshot,
  type AttentionCard, type AttentionTarget, type CustomRange, type Persona, type PeriodId,
  type QueueFigures, type Scope,
} from '../../data/platform-usage-metrics';
import { AttentionStrip, BlockGroup } from './usageKit';
import {
  AiUsageByArea, AssumptionsReference, CostAndNetValue, HeadlineValue, NetValueHero,
  SensitivityBlock, ValueOverTime,
} from './UsageValueBlocks';
import { ControlCoverage, ExceptionsCaught, NeverTested, RiskPicture } from './UsageCoverageBlocks';
import { CcmCoverage, MyQueue, MyWork, Reliability, SamplingOutcomes, StuckNow, TeamWork } from './UsageOperationsBlocks';
import { CreatedThisPeriod, DashboardsAndAlerts, EngagementPortfolio, ReportsMade, WorkVolume } from './UsageProductBlocks';
import { AiInsights, FindingQuality, FindingsAgeing } from './UsageFindingBlocks';
import { SmartLearn } from './UsageSmartLearn';
import { downloadUsageCsv } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

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

  const [periodId, setPeriodId] = useState<PeriodId>(() => DEFAULT_PERIOD[ceiling]);
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  // Until somebody picks a window for themselves, each view opens on the one it
  // is meant to be read in: the quarter for a CFO, the month for the two views
  // that are about what is happening now. Once a reader has chosen, switching
  // views keeps their choice rather than overruling it.
  const [periodChosen, setPeriodChosen] = useState(false);

  const choosePeriod = (id: PeriodId) => {
    setPeriodChosen(true);
    setPeriodId(id);
  };

  const chooseView = (view: Persona) => {
    setRequested(view);
    if (!periodChosen) setPeriodId(DEFAULT_PERIOD[view]);
  };
  const period = useMemo(() => buildPeriod(periodId, custom), [periodId, custom]);

  /* ── Every number on the view, assembled once ───────────────────────────── */

  const data = useMemo(
    () => snapshot(scope, period, settings),
    // memoryVersion is a real input even though it is not read directly: a
    // decision taken on the Smart Learn screen changes what this page counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, period, settings, memoryVersion],
  );

  /* ── Acting on a card ───────────────────────────────────────────────────── */

  /**
   * This scrolls to the block when the view has one, and leaves for the thing
   * itself when it does not. No path through here ends in neither, because a
   * card that quietly does nothing is worse than no card at all.
   */
  const onAct = (card: AttentionCard) => {
    const block = document.getElementById(card.target === 'controls' ? 'never' : card.target);
    if (block) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (card.target === 'memory') {
      openSmartLearn();
      return;
    }
    navigate(CARD_ELSEWHERE[card.target], card.focusId ?? '');
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
   * CFO. Opens on the headline: hours, rupees and people this quarter, then
   * cost and net value. Then value over time, coverage, the portfolio, the risk
   * picture, what was caught, volume, what was created, the product surfaces,
   * AI activity, and what the assistant knows. The cost figures and the
   * assumptions strip live only here.
   */
  const cfoView = (
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
        <ValueOverTime buckets={data.buckets} period={period} settings={settings} showMoney />
        <HeadlineValue
          value={data.value}
          prior={data.prior}
          change={data.change}
          period={period}
          scope={scope}
          settings={settings}
          showMoney
        />
      </BlockGroup>

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

      <BlockGroup title="What the platform did">
        <WorkVolume volume={data.volume} period={period} subject={scope.subject} onOpenRuns={() => navigate('workflow-library')} />
        <CreatedThisPeriod created={data.created} period={period} />
        <DashboardsAndAlerts product={data.product} period={period} />
        <ReportsMade reports={data.reports} period={period} />
        <CcmCoverage ccm={data.ccm} period={period} />
      </BlockGroup>

      <BlockGroup title="What the AI did, and what it knows">
        <AiUsageByArea rows={data.aiUsage} period={period} />
        <AiInsights insights={data.insights} period={period} />
        {smartLearnBlock}
      </BlockGroup>

      <BlockGroup title="What it cost, and what it rests on">
        <CostAndNetValue cost={data.cost} value={data.value} netRupees={data.netRupees} period={period} />
        <SensitivityBlock rows={data.sensitivity} settings={settings} />
        <AssumptionsReference settings={settings} />
      </BlockGroup>
    </>
  );

  /*
   * Head of Team. Opens on what is stuck, with the real error text on each run.
   * A team lead cannot act on "₹85 lakh saved"; they can act on "this workflow
   * failed four times this week with the same error", so the savings sit small
   * at the bottom and the design trade-offs go this view's way.
   */
  const headOfTeamView = (
    <>
      <BlockGroup title="What needs doing">
        <StuckNow stuck={data.stuck} period={period} onOpenRun={id => navigate('workflow-library', id)} />
        <Reliability rows={data.reliability.rows} wastedHours={data.reliability.wastedHours} period={period} />
        <NeverTested coverage={data.coverage} period={period} />
      </BlockGroup>

      <BlockGroup title="How the testing is going">
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

      <BlockGroup title="What the team did">
        <TeamWork people={data.people} period={period} team={myTeam ?? 'your team'} />
        <CreatedThisPeriod created={data.created} period={period} />
        {smartLearnBlock}
        <HeadlineValue
          value={data.value}
          prior={data.prior}
          change={data.change}
          period={period}
          scope={scope}
          settings={settings}
          showMoney={showMoney}
        />
      </BlockGroup>
    </>
  );

  /*
   * Internal Auditor. Their queue first, overdue first, each item one click
   * from the thing that needs doing. Then their own numbers, in hours and never
   * in rupees, and no other person appears anywhere on this view: no average,
   * no percentile, no comparison of any kind.
   */
  const auditorView = (
    <>
      <BlockGroup title="What needs you">
        <MyQueue queue={data.queue} onOpen={onOpenQueueItem} />
      </BlockGroup>

      <BlockGroup title="Your own work">
        <MyWork value={data.value} exceptions={data.exceptions} period={period} settings={settings} />
        {exceptionsBlock}
        <ValueOverTime buckets={data.buckets} period={period} settings={settings} showMoney={false} />
      </BlockGroup>

      <BlockGroup title="What the assistant knows">{smartLearnBlock}</BlockGroup>
    </>
  );

  /* ── The page ───────────────────────────────────────────────────────────── */

  const scopeLine = [
    `Viewing as ${PERSONA_TITLE[persona]}`,
    PERSONA_SCOPE_LABEL[persona] + (persona === 'head_of_team' && myTeam ? ` · ${myTeam}` : ''),
    period.id === 'custom' && custom
      ? `${formatDate(custom.from)} to ${formatDate(custom.to)}`
      : `${period.label}, ${formatDate(period.from)} to ${formatDate(period.to)}`,
    dataAsOfLabel(),
  ].join(' · ');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 shrink-0">
        <div className="bg-canvas-elevated -mx-6 lg:-mx-12 xl:-mx-[124px] px-6 lg:px-12 xl:px-[124px] -mt-8 pt-8 pb-5 border-b border-canvas-border relative overflow-hidden">
          <FloatingLines
            enabledWaves={['top', 'bottom']}
            lineCount={3}
            lineDistance={10}
            bendRadius={5}
            bendStrength={-0.3}
            interactive
            parallax
            color="#6a12cd"
            opacity={0.05}
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[2.125rem] font-semibold tracking-tight text-ink-900 leading-[1.15]">Platform Usage</h1>
              <p className="mt-2 text-[1rem] text-ink-500 leading-relaxed max-w-2xl">{PERSONA_QUESTION[persona]}</p>
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

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.75rem] text-ink-500 tabular-nums">{scopeLine}</p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                {periodOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (option.id === 'custom') {
                        setCustomOpen(true);
                        return;
                      }
                      setCustomOpen(false);
                      choosePeriod(option.id);
                    }}
                    aria-pressed={periodId === option.id}
                    className={`h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
                      periodId === option.id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:text-brand-700'
                    }`}
                  >
                    {option.id === 'custom' ? <CalendarRange size={13} className="inline -mt-0.5 mr-1" /> : null}
                    {option.label}
                  </button>
                ))}
              </div>

              {canExport && (
                <>
                  <button
                    type="button"
                    onClick={onExportCsv}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-canvas-border text-[0.75rem] font-medium text-ink-700 hover:border-brand-200 hover:text-brand-700"
                  >
                    <Download size={13} /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={onExportPdf}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-canvas-border text-[0.75rem] font-medium text-ink-700 hover:border-brand-200 hover:text-brand-700"
                  >
                    <FileText size={13} /> PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {customOpen && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-canvas-border bg-canvas px-4 py-3">
              <label className="text-[0.75rem] text-ink-600">
                From
                <input
                  type="date"
                  defaultValue={isoDay(period.from)}
                  max={isoDay(ANCHOR)}
                  onChange={e => {
                    const from = Date.parse(`${e.target.value}T00:00:00Z`);
                    if (!Number.isNaN(from)) setCustom(prev => ({ from, to: prev?.to ?? ANCHOR }));
                  }}
                  className="mt-1 block h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.875rem] text-ink-900 tabular-nums"
                />
              </label>
              <label className="text-[0.75rem] text-ink-600">
                To
                <input
                  type="date"
                  defaultValue={isoDay(period.to)}
                  max={isoDay(ANCHOR)}
                  onChange={e => {
                    const to = Date.parse(`${e.target.value}T23:59:59Z`);
                    if (!Number.isNaN(to)) setCustom(prev => ({ from: prev?.from ?? period.from, to }));
                  }}
                  className="mt-1 block h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.875rem] text-ink-900 tabular-nums"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (custom) choosePeriod('custom');
                  setCustomOpen(false);
                }}
                className="h-8 px-3 rounded-md bg-brand-600 text-white text-[0.75rem] font-medium"
              >
                Use this range
              </button>
              <p className="text-[0.75rem] text-ink-500">
                The comparison is always the window of the same length immediately before the one you pick.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-12 xl:px-[124px] py-8 space-y-8 max-w-[1400px]">
          <section aria-label="Needs your attention">
            <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-400 mb-3">
              Needs your attention
            </h2>
            <AttentionStrip cards={data.attention} onAct={onAct} />
          </section>

          {persona === 'cfo' ? cfoView : persona === 'head_of_team' ? headOfTeamView : auditorView}

          <p className="text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed border-t border-canvas-border pt-4">
            {COVERAGE_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}
