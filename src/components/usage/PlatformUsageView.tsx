/**
 * Platform Usage. One reader, one job, two sections.
 *
 * The reader is the audit lead. The job is to be ready for the committee, and
 * to know what is slipping before somebody else finds it. Everything on the
 * page is that person's own record: there is no rate for an auditor hour, no
 * saving worked out from one, and no figure here that we invented.
 *
 * ## The shape
 *
 * **The pack.** Six lines and nothing else on the first screen, the quarter
 * read against the financial year it sits in. Somebody who reads only the six
 * sentences understands the quarter. Flows get two columns. Stocks get one
 * figure and the date it is true at, because a stock has no quarter value and
 * no year value and printing one as two columns makes the page read as broken.
 *
 * **What the platform did.** Everything else, twelve folded rows below the
 * pack, each showing its own answer while closed so the whole thing reads as a
 * contents page. Nothing is deleted. The change is that the first screen no
 * longer competes with it.
 *
 * ## What is not here, and why
 *
 * The "Viewing as" switch and its three readers are gone. A CFO does not log
 * into an internal audit tool, and what is waiting on me is a home screen
 * question rather than a reporting one. What survives is scope: the whole
 * company, one team, or your own work. It narrows, it never widens, and it
 * never reaches sideways into somebody else's team.
 *
 * There is no comparison against an earlier window anywhere. The year to
 * date's own prior window starts before the records do, so a delta on it
 * printed a hundred per cent fall that never happened.
 *
 * ## Read only, without exception
 *
 * No control on this page changes state. Rows link to the screen that owns an
 * action; they never perform one. Nothing ranks people, no figure is
 * benchmarked against another company, and the one write in the whole feature
 * is the audit event an export emits.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Download, FileText } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import { useMemorySessionVersion } from '../../data/memorySession';
import { COVERAGE_NOTE, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import {
  DEFAULT_WINDOW, SCOPE_LABEL,
  calibrate, fmtDuration, fmtInt, fmtMoneyExact, fmtPct, scopeCeiling, scopeOptions, snapshot,
  windowShort, windows,
  type AttentionCard, type AttentionTarget, type Scope, type ScopeLevel, type UsageSnapshot,
  type WindowId,
} from '../../data/platform-usage-metrics';
import { AttentionStrip } from './usageKit';
import { UsagePack } from './UsagePack';
import { AiUsageByArea, ContractCost, ValueOverTime } from './UsageValueBlocks';
import { ControlCoverage, ExceptionsCaught, NeverTested, RiskPicture } from './UsageCoverageBlocks';
import { CcmCoverage, Reliability, SamplingOutcomes, StuckNow, TeamWork } from './UsageOperationsBlocks';
import { CreatedThisPeriod, DashboardsAndAlerts, EngagementPortfolio, ReportsMade, WorkVolume } from './UsageProductBlocks';
import { AiInsights, FindingQuality, FindingsAgeing } from './UsageFindingBlocks';
import { PastTheirDate } from './UsageCommitteeBlocks';
import { SmartLearn } from './UsageSmartLearn';
import { downloadUsageCsv } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

/* ── Section two, as a contents page ─────────────────────────────────────── */

/** Where an attention card's block lives, so a card can open its row. */
const ROW_OF_CARD: Partial<Record<AttentionTarget, string>> = {
  stuck: 'stuck',
  controls: 'monitoring',
  risks: 'monitoring',
  sampling: 'sampling',
  memory: 'learn',
};

/** Where a card goes when this reader's page has no row for it. */
const CARD_ELSEWHERE: Record<AttentionTarget, string> = {
  stuck: 'workflow-library',
  risks: 'audit-risk-register',
  controls: 'governance-controls',
  sampling: 'engagements',
  queue: 'my-queue',
  memory: 'knowledge-hub',
};

/**
 * One folded row.
 *
 * The name and its own answer are both readable while closed, which is what
 * makes twelve of these read as a contents page rather than a wall. The whole
 * head is the control, because unlike the pack there is nothing else in the row
 * competing to be clicked.
 */
function SectionRow({
  id, title, answer, open, onToggle, children,
}: {
  id: string;
  title: string;
  answer: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div id={`row-${id}`} className="border-t border-canvas-border scroll-mt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-baseline gap-4 px-6 py-4 text-left hover:bg-canvas transition-colors"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 self-center text-ink-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[1rem] font-medium text-ink-900 shrink-0">{title}</span>
        <span className="flex-1 min-w-0 text-right text-[0.875rem] text-ink-500 truncate tabular-nums">{answer}</span>
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

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

  // The weekly job, run as the page is read. Once both guards pass, a measured
  // value quietly replaces a starting one. It settles before the first render,
  // so no reader watches a starting value flash to a measured one.
  const [settings] = useState(() => calibrate());

  /* ── Who is reading, and how far they may see ───────────────────────────── */

  const me = users.find(u => u.email === currentUser?.email);
  const myTeam = me?.team && me.team !== '—' ? me.team : null;
  const myName = me?.name ?? currentUser?.name ?? '';

  const ceiling: ScopeLevel = useMemo(
    () => scopeCeiling({ usage: can('ad_usage'), people: can('ad_usage_people'), self: can('ad_usage_self') }, myTeam),
    [can, myTeam],
  );

  const levels = useMemo(() => scopeOptions(ceiling, myTeam), [ceiling, myTeam]);
  const [requested, setRequested] = useState<ScopeLevel>(ceiling);

  // The requested scope is resolved against the entitlement rather than
  // trusted, so a scope above the reader's rights is clamped back to their own
  // ceiling and never widens what they can see.
  const level = levels.includes(requested) ? requested : ceiling;

  const canExport = can('ad_usage_export');
  const canSeePeople = can('ad_usage_people');

  const scope = useMemo<Scope>(() => {
    if (level === 'company') return { level: 'company', subject: 'the company' };
    if (level === 'team') {
      return { level: 'team', subject: myTeam ?? 'your team', team: myTeam ?? undefined, userEmail: currentUser?.email, userName: myName };
    }
    return { level: 'person', subject: 'you', userEmail: currentUser?.email, userName: myName };
  }, [level, myTeam, currentUser?.email, myName]);

  /* ── The two windows, read together ─────────────────────────────────────── */

  const both = useMemo(() => windows(), []);

  const quarter = useMemo<UsageSnapshot>(
    () => snapshot(scope, both.quarter, settings),
    // memoryVersion is a real input even though it is not read directly: a
    // decision taken on the Smart Learn screen changes what this page counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, both, settings, memoryVersion],
  );
  const ytd = useMemo<UsageSnapshot>(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => snapshot(scope, both.ytd, settings), [scope, both, settings, memoryVersion],
  );

  /*
   * The pack always shows both windows. Section two shows one at a time,
   * because a folded block of its own is a block, not a column, and printing
   * every one of them twice would double a page the pack exists to shorten.
   */
  const [windowId, setWindowId] = useState<WindowId>(DEFAULT_WINDOW);
  const data = windowId === 'fy-ytd' ? ytd : quarter;
  const period = data.period;

  /* ── Which rows are open ────────────────────────────────────────────────── */

  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));

  const onAct = (card: AttentionCard) => {
    const row = ROW_OF_CARD[card.target];
    if (!row) {
      if (card.target === 'memory') openSmartLearn();
      else navigate(CARD_ELSEWHERE[card.target], card.focusId ?? '');
      return;
    }
    setOpenRows(prev => ({ ...prev, [row]: true }));
    // The row has to render open before it can be scrolled to, so this waits a
    // frame rather than reading the DOM on the line that asked for it.
    window.setTimeout(() => {
      document.getElementById(`row-${row}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  /* ── Export ─────────────────────────────────────────────────────────────── */

  const onExportCsv = () => {
    downloadUsageCsv(data);
    addToast({ type: 'success', message: 'Exported. The file carries the scope, the window and the assumptions.' });
  };

  const onExportPdf = async () => {
    await downloadUsagePdf(data);
    addToast({ type: 'success', message: 'Exported as a PDF, with the coverage note on the first page.' });
  };

  /* ── The twelve ─────────────────────────────────────────────────────────── */

  const cost = data.cost.totalPaise / 100;
  const alertsOn = data.product.alertsConfigured.length;

  const rows: { id: string; title: string; answer: ReactNode; body: ReactNode }[] = [
    {
      id: 'volume',
      title: 'Work volume',
      answer: `${fmtInt(data.volume.runs)} checks ran, ${fmtDuration(data.value.machineHours)} of machine time`,
      body: (
        <>
          <WorkVolume
            volume={data.volume}
            machineHours={data.value.machineHours}
            period={period}
            subject={scope.subject}
            onOpenRuns={() => navigate('workflow-library')}
          />
          <ValueOverTime buckets={data.buckets} period={period} />
          <CreatedThisPeriod created={data.created} period={period} />
          {/* The per person table needs its own right. Without it the rest of
              the page still opens, which is the difference between a narrower
              page and an empty one. */}
          {canSeePeople && <TeamWork people={data.people} period={period} subject={scope.subject} />}
        </>
      ),
    },
    {
      id: 'reliability',
      title: 'Runs and reliability',
      answer: data.reliability.rows.length === 0
        ? 'nothing failed'
        : `${fmtInt(data.volume.failed)} runs failed, ${fmtDuration(data.reliability.wastedHours)} wasted`,
      body: <Reliability rows={data.reliability.rows} wastedHours={data.reliability.wastedHours} period={period} />,
    },
    {
      id: 'stuck',
      title: 'What is stuck',
      answer: data.stuck.length === 0 ? 'nothing is stuck' : `${fmtInt(data.stuck.length)} runs need somebody`,
      body: (
        <>
          <StuckNow stuck={data.stuck} period={period} onOpenRun={id => navigate('workflow-library', id)} />
          <PastTheirDate coverage={data.committee} period={period} onOpen={(view, id) => navigate(view, id)} />
        </>
      ),
    },
    {
      id: 'sampling',
      title: 'Sampling outcomes',
      answer: data.sampling.total === 0
        ? 'nobody sampled anything'
        : `${fmtInt(data.sampling.total)} validations, ${data.sampling.passRatePct !== null ? `${fmtPct(data.sampling.passRatePct)} passed` : 'none settled yet'}`,
      body: <SamplingOutcomes sampling={data.sampling} period={period} />,
    },
    {
      id: 'monitoring',
      title: 'Continuous monitoring',
      answer: `${fmtInt(data.coverage.tested.length)} of ${fmtInt(data.coverage.controlsInLibrary)} controls exercised, ${fmtInt(data.risks.unmapped.length)} risks with no control`,
      body: (
        <>
          <CcmCoverage ccm={data.ccm} period={period} />
          <ControlCoverage
            coverage={data.coverage}
            period={period}
            checksPerformed={data.value.checksPerformed}
            coveredRows={data.value.coveredRows}
          />
          <NeverTested coverage={data.coverage} period={period} />
          <RiskPicture risks={data.risks} scope={scope} onOpenRisks={() => navigate('audit-risk-register')} />
        </>
      ),
    },
    {
      id: 'caught',
      title: 'Exceptions caught',
      answer: `${fmtInt(data.exceptions.total)} found, ${fmtInt(data.ageing.open)} still open`,
      body: (
        <>
          <ExceptionsCaught
            exceptions={data.exceptions}
            period={period}
            subject={scope.subject}
            onOpenException={id => navigate('engagements', id)}
          />
          <FindingsAgeing
            ageing={data.ageing}
            subject={scope.subject}
            onOpenException={id => navigate('engagements', id)}
          />
          <FindingQuality quality={data.quality} period={period} />
        </>
      ),
    },
    {
      id: 'insights',
      title: 'AI insights',
      answer: `${fmtInt(data.insights.perRun + data.insights.consolidated)} raised by the assistant`,
      body: (
        <>
          <AiInsights insights={data.insights} period={period} />
          <AiUsageByArea rows={data.aiUsage} period={period} />
        </>
      ),
    },
    {
      id: 'portfolio',
      title: 'Engagement portfolio',
      answer: `${fmtInt(data.portfolio.open)} open, ${fmtInt(data.portfolio.slipping)} past their planned end`,
      body: (
        <EngagementPortfolio
          portfolio={data.portfolio}
          period={period}
          onOpenEngagement={id => navigate('engagements', id)}
        />
      ),
    },
    {
      id: 'reports',
      title: 'Reports made',
      answer: data.reports.made.length === 0
        ? 'no report was made'
        : `${fmtInt(data.reports.made.length)} made, ${fmtInt(data.reports.shared.length)} shared`,
      body: <ReportsMade reports={data.reports} period={period} />,
    },
    {
      id: 'dashboards',
      title: 'Dashboards and alerts',
      answer: `${fmtInt(data.product.dashboardsBuilt.length)} dashboards built, ${fmtInt(alertsOn)} alerts set up`,
      body: <DashboardsAndAlerts product={data.product} period={period} />,
    },
    {
      id: 'cost',
      title: 'What it cost under the contract',
      answer: cost > 0 ? `${fmtMoneyExact(cost)} charged, as per your contract` : 'nothing charged',
      body: <ContractCost cost={data.cost} period={period} />,
    },
    {
      id: 'learn',
      title: 'Smart Learn',
      answer: `${fmtInt(data.learn.active.length)} things the assistant knows, ${fmtInt(data.learn.pending.length)} waiting on you`,
      body: <SmartLearn learn={data.learn} scope={scope} onOpenSmartLearn={openSmartLearn} />,
    },
  ];

  /* ── The header line ────────────────────────────────────────────────────── */

  /*
   * The whole sentence, even though the filter carries part of it.
   *
   * A screenshot of this page lands in a board pack with no filter beside it,
   * and a figure whose scope and windows cannot be read off the same image is a
   * figure nobody can defend six weeks later.
   */
  const scopeLine = [
    SCOPE_LABEL[level] + (level === 'team' && myTeam ? ` · ${myTeam}` : ''),
    `${windowShort(both.quarter)}, ${formatDate(both.quarter.from)} to ${formatDate(both.quarter.to)}`,
    `${windowShort(both.ytd)}, ${formatDate(both.ytd.from)} to ${formatDate(both.ytd.to)}`,
    dataAsOfLabel(),
  ].join(' · ');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="shrink-0">
        <div className="bg-canvas-elevated px-6 lg:px-12 xl:px-[124px] pt-8 pb-5 border-b border-canvas-border">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[2.5rem] font-semibold tracking-tight text-ink-900 leading-[1.1]">Platform Usage</h1>
              <p className="mt-1.5 text-[0.875rem] text-ink-500 leading-relaxed max-w-2xl">
                What the committee will ask about, and what is slipping.
              </p>
            </div>

            {/* The scope filter narrows and never widens: only the scopes this
                reader is entitled to appear, so it can never reach sideways
                into somebody else's team. One option is furniture, so a reader
                with one scope sees no filter at all. */}
            {levels.length > 1 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[0.75rem] text-ink-500">Showing</span>
                <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                  {levels.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRequested(option)}
                      aria-pressed={level === option}
                      className={`h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
                        level === option ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-brand-700'
                      }`}
                    >
                      {SCOPE_LABEL[option]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.75rem] text-ink-500 tabular-nums">{scopeLine}</p>

            {canExport && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={onExportCsv}>
                  CSV
                </Button>
                <Button variant="primary" size="sm" leftIcon={<FileText size={14} />} onClick={onExportPdf}>
                  PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-12 xl:px-[124px] py-6 space-y-8 max-w-[1400px]">
          <section aria-label="Needs your attention">
            <AttentionStrip cards={quarter.attention} onAct={onAct} />
          </section>

          <UsagePack quarter={quarter} ytd={ytd} />

          <section aria-label="What the platform did">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-[1.125rem] font-semibold text-ink-900">What the platform did</h2>

              {/* The pack reads both windows side by side. These rows read one
                  at a time, and the control says which. */}
              <div className="inline-flex items-center gap-2">
                <span className="text-[0.75rem] text-ink-500">Showing</span>
                <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                  {[both.quarter, both.ytd].map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWindowId(option.id)}
                      aria-pressed={windowId === option.id}
                      className={`h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
                        windowId === option.id ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:text-brand-700'
                      }`}
                    >
                      {windowShort(option)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
              {rows.map(row => (
                <SectionRow
                  key={row.id}
                  id={row.id}
                  title={row.title}
                  answer={row.answer}
                  open={Boolean(openRows[row.id])}
                  onToggle={() => toggle(row.id)}
                >
                  {row.body}
                </SectionRow>
              ))}
            </div>
          </section>

          <p className="text-[0.75rem] text-ink-500 max-w-[80ch] leading-relaxed border-t border-canvas-border pt-4">
            {COVERAGE_NOTE}
          </p>
        </div>
      </div>
    </div>
  );
}
