/**
 * Platform Usage — one page, three readers.
 *
 * Built from `Platform-Usage-Build-Spec_6.pdf`. The page answers one question:
 * is the platform earning its keep? A CFO asks it as "is this paying for
 * itself", a team lead as "is anything stuck", an auditor as "what is waiting on
 * me". So this is one page with a lens at the top rather than three pages. The
 * lens changes whose data you see and which block comes first. It never changes
 * the layout, the wording, or the names of things, so somebody who changes role
 * never has to learn the page again.
 *
 * ## The lens is a lens, not a key
 *
 * Entitlement comes from the permissions the signed in role actually holds, and
 * a view somebody is not entitled to is never offered:
 *
 *   ad_usage         the whole company, and the cost figures
 *   ad_usage_people  their own team, and themselves
 *   ad_usage_self    themselves, and nothing else
 *
 * You can narrow down your own line. You can never look sideways into somebody
 * else's team. Switching shows nobody anything they could not otherwise see, so
 * the switch is a convenience rather than a privilege.
 *
 * ## Answers first, machinery never
 *
 * Every view opens with at most three attention cards, each a sentence with one
 * thing to do, then with blocks that lead with a sentence rather than a tile. A
 * reader who reads only those sentences understands the whole page.
 *
 * There is no editor anywhere on this page. The assumptions behind the value
 * figures measure themselves from the customer's own recorded pace, and the one
 * number a person types, the vendor's monthly bill, lives in Administration
 * behind its own permission. When the page needs it, it asks as an attention
 * card and hands the reader over.
 *
 * ## What this page will not do
 *
 * No seat or licence counts, because seats are not a concept here. No benchmarks
 * against other companies, because no such data exists. No per user cost. No
 * alerts and no thresholds: the page reports, it does not notify. And nothing
 * here ranks people.
 */

import { useMemo, useState } from 'react';
import { CalendarRange, Download, FileText } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import FloatingLines from '../shared/FloatingLines';
import { approveMemory, rejectMemory, useMemorySessionVersion } from '../../data/memorySession';
import type { PlatformMemory } from '../../data/memoryStore';
import {
  ANCHOR, COVERAGE_NOTE, RUNS, TRACED_EXCEPTIONS, dataAsOfLabel, formatDate, isoDay,
} from '../../data/platform-usage';
import {
  PERSONA_QUESTION, PERSONA_TITLE, applyCalibration, attentionCards, loadSettings,
  period as buildPeriod, periodOptions, snapshot, volumeOverTime,
  type AttentionCard, type CustomRange, type Persona, type PeriodId, type QueueItem, type Scope,
  type UsageSettings,
} from '../../data/platform-usage-metrics';
import { AttentionStrip, BlockGroup } from './usageKit';
import {
  AiUsageByArea, CostToRunBlock, CreatedThisPeriod, HeadlineValue, ValueOverTime, WorkVolume,
} from './UsageValueBlocks';
import { ControlCoverage, ExceptionsCaughtBlock, NeverExercisedBlock } from './UsageCoverageBlocks';
import { MyQueue, MyWork, PerPersonOutcomes, Reliability, StuckRuns } from './UsageOperationsBlocks';
import { DashboardsAndAlerts, InsightsGenerated, ReportsMade, SamplingOutcomes } from './UsageProductBlocks';
import { CcmCoverage, EngagementPortfolioBlock, RiskPictureBlock } from './UsagePortfolioBlocks';
import { SmartLearn } from './UsageSmartLearn';
import { downloadUsageCsv } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

/** What the lens shows, said as the data rather than as a job title. */
const LENS_SCOPE: Record<Persona, string> = {
  cfo: 'Whole company',
  head_of_team: 'My team',
  auditor: 'Just me',
};

/** Where an attention card sends the reader. */
function scrollToBlock(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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

  // The weekly calibration job, run as the page is read. Once the guards pass
  // the two measurable numbers switch to the customer's own recorded pace,
  // silently and audited. Nobody is asked to confirm anything, because at the
  // scale this runs at nobody would. It settles before the first render, so no
  // reader ever sees the starting value flash to the measured one.
  const [settings] = useState<UsageSettings>(() => applyCalibration(loadSettings()));

  /* ── Who is reading, and what they may see ──────────────────────────────── */

  const me = users.find(u => u.email === currentUser?.email);
  const myTeam = me?.team && me.team !== '—' ? me.team : null;
  const myName = me?.name ?? currentUser?.name ?? '';

  const canExport = can('ad_usage_export');

  const entitled = useMemo<Persona[]>(() => {
    const out: Persona[] = [];
    if (can('ad_usage')) out.push('cfo');
    if ((can('ad_usage') || can('ad_usage_people')) && myTeam) out.push('head_of_team');
    // Everybody signed in always gets their own view. No request, no approval.
    out.push('auditor');
    return out;
  }, [can, myTeam]);

  const [persona, setPersona] = useState<Persona>(() => entitled[0]);
  const lens = entitled.includes(persona) ? persona : entitled[0];

  const scope = useMemo<Scope>(() => {
    if (lens === 'cfo') return { persona: 'cfo', label: 'the whole company' };
    if (lens === 'head_of_team') {
      return { persona: 'head_of_team', label: myTeam ?? 'your team', team: myTeam ?? undefined, userEmail: currentUser?.email, userName: myName };
    }
    return { persona: 'auditor', label: 'your own work', userEmail: currentUser?.email, userName: myName };
  }, [lens, myTeam, currentUser?.email, myName]);

  /** Whose saving it is, said inside a sentence. */
  const subject = lens === 'cfo' ? 'the company' : lens === 'head_of_team' ? (myTeam ?? 'your team') : 'you';

  // An auditor reads their own work in hours and never in rupees. "You saved 84
  // hours" is an achievement; "you saved ₹1,00,800" is somebody pricing them.
  const showMoney = lens !== 'auditor';

  /* ── The window ─────────────────────────────────────────────────────────── */

  const options = useMemo(() => periodOptions(), []);
  const [periodId, setPeriodId] = useState<PeriodId>(() => {
    const wanted: PeriodId = 'this-quarter';
    return options.some(o => o.id === wanted) ? wanted : options[0].id;
  });
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const period = useMemo(() => buildPeriod(periodId, custom), [periodId, custom]);

  /* ── Every number on the view, assembled once ───────────────────────────── */

  const data = useMemo(
    () => snapshot(scope, period, settings),
    // memoryVersion is a real input even though it is not read directly:
    // approving a proposal on this page changes what PU-20 counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, period, settings, memoryVersion],
  );

  const volumeBuckets = useMemo(() => volumeOverTime(period, scope), [period, scope]);

  const cards = useMemo(
    () => attentionCards(scope, period, {
      risks: data.risks,
      stuck: data.stuck,
      never: data.never,
      queue: data.queue,
      sampling: data.sampling,
      smartLearn: data.learn,
    }),
    [scope, period, data],
  );

  /* ── Acting on a card ───────────────────────────────────────────────────── */

  const onAct = (card: AttentionCard) => {
    if (card.target === 'memory') {
      scrollToBlock('memory');
      return;
    }
    scrollToBlock(card.target === 'controls' ? 'never' : card.target);
  };

  const onOpenQueueItem = (item: QueueItem) => navigate(item.target.view, item.target.id ?? '');

  const onApproveMemory = (memory: PlatformMemory) => {
    approveMemory(memory, myName || 'you');
    addToast({ type: 'success', message: 'Approved. The assistant will use it from the next question.' });
  };

  const onRejectMemory = (memory: PlatformMemory) => {
    rejectMemory(memory, myName || 'you');
    addToast({ type: 'success', message: 'Rejected. It is off the list and the decision is on the record.' });
  };

  /* ── The auditor's own three numbers ────────────────────────────────────── */

  const myRuns = useMemo(
    () => RUNS.filter(run => run.actor.email === currentUser?.email && run.completedAt !== null
      && run.completedAt >= period.from && run.completedAt <= period.to),
    [currentUser?.email, period],
  );
  const myExceptions = useMemo(
    () => TRACED_EXCEPTIONS.filter(ex => ex.assignee === myName && ex.openedAt >= period.from && ex.openedAt <= period.to),
    [myName, period],
  );

  /* ── Export ─────────────────────────────────────────────────────────────── */

  const onExportCsv = () => {
    downloadUsageCsv(data, volumeBuckets);
    addToast({ type: 'success', message: 'Exported. The file carries the scope, the window and the assumptions.' });
  };

  const onExportPdf = async () => {
    await downloadUsagePdf(data, volumeBuckets);
    addToast({ type: 'success', message: 'Exported as a PDF, with the coverage note on the first page.' });
  };

  /* ── The blocks, in the order each reader needs them ─────────────────────── */

  const headline = (
    <HeadlineValue
      value={data.value}
      priorValue={data.priorValue}
      net={data.net}
      cost={data.cost}
      settings={settings}
      period={period}
      scope={scope}
      subject={subject}
      changes={data.changes}
      showMoney={showMoney}
      onOpenCost={() => scrollToBlock('cost')}
    />
  );

  const valueOverTime = (
    <ValueOverTime buckets={data.overTime} period={period} settings={settings} showMoney={showMoney} />
  );

  const smartLearnBlock = (
    <SmartLearn
      learn={data.learn}
      scope={scope}
      onOpenSmartLearn={openSmartLearn}
      onApprove={onApproveMemory}
      onReject={onRejectMemory}
    />
  );

  const cfoView = (
    <>
      <BlockGroup title="What it was worth">
        {headline}
        <CostToRunBlock cost={data.cost} lookups={data.lookups} period={period} />
        {valueOverTime}
      </BlockGroup>

      <BlockGroup title="What it covered">
        <ControlCoverage coverage={data.coverage} period={period} scope={scope} />
        <NeverExercisedBlock never={data.never} scope={scope} />
        <EngagementPortfolioBlock portfolio={data.portfolio} period={period} onOpenEngagement={id => navigate('engagements', id)} />
        <RiskPictureBlock risks={data.risks} scope={scope} onOpenRisks={() => navigate('audit-risk-register')} />
      </BlockGroup>

      <BlockGroup title="What the platform did">
        <ExceptionsCaughtBlock
          exceptions={data.exceptions}
          period={period}
          subject={subject}
          onOpenException={id => navigate('engagements', id)}
        />
        <SamplingOutcomes sampling={data.sampling} period={period} subject={subject} />
        <WorkVolume volume={data.volume} overTime={volumeBuckets} subject={subject} period={period} onOpenRuns={() => navigate('workflow-library')} />
        <CreatedThisPeriod created={data.created} period={period} subject={subject} />
        <DashboardsAndAlerts product={data.product} period={period} subject={subject} />
        <ReportsMade reports={data.reports} period={period} subject={subject} />
        <InsightsGenerated insights={data.insights} period={period} subject={subject} />
        <CcmCoverage ccm={data.ccm} period={period} />
      </BlockGroup>

      <BlockGroup title="What the AI did, and what it knows">
        <AiUsageByArea rows={data.aiUsage} />
        {smartLearnBlock}
      </BlockGroup>
    </>
  );

  const headOfTeamView = (
    <>
      <BlockGroup title="What needs doing">
        <StuckRuns stuck={data.stuck} period={period} subject={subject} onOpenRuns={() => navigate('workflow-library')} />
        <Reliability rows={data.reliability} wasted={data.wasted} period={period} />
        <NeverExercisedBlock never={data.never} scope={scope} />
      </BlockGroup>

      <BlockGroup title="How the testing is going">
        <SamplingOutcomes sampling={data.sampling} period={period} subject={subject} />
        <CcmCoverage ccm={data.ccm} period={period} />
        <RiskPictureBlock risks={data.risks} scope={scope} onOpenRisks={() => navigate('audit-risk-register')} />
        <ExceptionsCaughtBlock
          exceptions={data.exceptions}
          period={period}
          subject={subject}
          onOpenException={id => navigate('engagements', id)}
        />
      </BlockGroup>

      <BlockGroup title="What the team did">
        <PerPersonOutcomes people={data.people} period={period} team={myTeam ?? 'your team'} />
        <WorkVolume volume={data.volume} overTime={volumeBuckets} subject={subject} period={period} onOpenRuns={() => navigate('workflow-library')} />
        <CreatedThisPeriod created={data.created} period={period} subject={subject} />
        <DashboardsAndAlerts product={data.product} period={period} subject={subject} />
        <ReportsMade reports={data.reports} period={period} subject={subject} />
        <InsightsGenerated insights={data.insights} period={period} subject={subject} />
        {smartLearnBlock}
        {headline}
      </BlockGroup>
    </>
  );

  const auditorView = (
    <>
      <BlockGroup title="What needs you">
        <MyQueue queue={data.queue} onOpen={onOpenQueueItem} />
      </BlockGroup>

      <BlockGroup title="Your own work">
        <MyWork
          runs={myRuns.length}
          failed={myRuns.filter(r => r.status === 'failed').length}
          exceptions={myExceptions.length}
          openExceptions={myExceptions.filter(ex => ex.status !== 'Resolved').length}
          hours={data.value.hours}
          period={period}
        />
        <ExceptionsCaughtBlock
          exceptions={data.exceptions}
          period={period}
          subject={subject}
          onOpenException={id => navigate('engagements', id)}
        />
        <WorkVolume volume={data.volume} overTime={volumeBuckets} subject={subject} period={period} onOpenRuns={() => navigate('workflow-library')} />
        {headline}
        {valueOverTime}
        <InsightsGenerated insights={data.insights} period={period} subject={subject} />
      </BlockGroup>

      <BlockGroup title="What the assistant knows">{smartLearnBlock}</BlockGroup>
    </>
  );

  /* ── The page ───────────────────────────────────────────────────────────── */

  const scopeLine = [
    `Viewing as ${PERSONA_TITLE[lens]}`,
    LENS_SCOPE[lens],
    period.id === 'custom' && custom
      ? `${formatDate(custom.from)} to ${formatDate(custom.to)}`
      : `${period.label}, ${formatDate(period.from)} to ${formatDate(period.to)}`,
    dataAsOfLabel(),
  ].join(' · ');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Header strip, the same shape Administration and the Knowledge Hub use:
          one full bleed panel with the page title, the lens switch, and the
          scope line that says what you are looking at. */}
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
              <p className="mt-2 text-[1rem] text-ink-500 leading-relaxed max-w-2xl">
                {PERSONA_QUESTION[lens]}
              </p>
            </div>

            {entitled.length > 1 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[0.75rem] text-ink-400">Viewing as</span>
                <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                  {entitled.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPersona(option)}
                      aria-pressed={lens === option}
                      className={`h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
                        lens === option ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-brand-700'
                      }`}
                    >
                      {PERSONA_TITLE[option]}
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
                {options.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      if (option.id === 'custom') {
                        setCustomOpen(true);
                        return;
                      }
                      setCustomOpen(false);
                      setPeriodId(option.id);
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
                  if (custom) setPeriodId('custom');
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-12 xl:px-[124px] py-8 space-y-8 max-w-[1400px]">
          <section aria-label="Needs your attention">
            <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-400 mb-3">
              Needs your attention
            </h2>
            <AttentionStrip cards={cards} onAct={onAct} />
          </section>

          {lens === 'cfo' ? cfoView : lens === 'head_of_team' ? headOfTeamView : auditorView}

          <p className="text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed border-t border-canvas-border pt-4">
            {COVERAGE_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}
