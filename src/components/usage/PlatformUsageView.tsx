/**
 * Platform Usage — one page, three readers.
 *
 * A CFO asks "is this paying for itself?", a team lead asks "is anything
 * stuck?", an auditor asks "what's waiting on me?". Rather than three pages this
 * is one page with a lens at the top. The lens changes whose data you see and
 * which block comes first. It never changes the layout, the wording, or the
 * names of things, so somebody who changes roles never has to relearn the page.
 *
 * ## The lens is a lens, not a key
 *
 * Entitlement is resolved from the permissions the signed-in role actually
 * holds, and a view somebody is not entitled to is never offered:
 *
 *   ad_usage         the whole company, the cost block, and the settings editor
 *   ad_usage_people  their own team, and themselves
 *   ad_usage_self    themselves, and nothing else
 *
 * You can narrow down your own line. You can never look sideways into somebody
 * else's team. Switching shows nobody anything they could not otherwise see.
 *
 * ## What this page will not do
 *
 * No seat or licence counts, because seats are not a concept here. No benchmarks
 * against other companies, because no such data exists. No per-user cost. No
 * alerts or thresholds: the page reports, it does not notify. And nothing here
 * ranks people.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, Download, IndianRupee, SlidersHorizontal } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { BTN_CTA_OUTLINE } from '../admin/adminTokens';
import { ANCHOR, COVERAGE_NOTE, HISTORY_START, dataAsOfLabel, formatDate } from '../../data/platform-usage';
import { useMemorySessionVersion } from '../../data/memorySession';
import {
  aiUsageByArea, ccm, controlCoverage, costToRun, createdThisPeriod, exceptionsCaught, insights, myQueue,
  neverExercised, netValue, perPersonOutcomes, period, periodOptions, portfolio, priorPeriod, productActivity,
  reliability, reportsActivity, riskPicture, runsIn, sampling, sensitivity, smartLearn,
  stuckRuns, valueOf, valueOverTime, volumeOverTime, wastedEffort, workVolume, calibrate,
  loadSettings, saveSettings, fmtHours, fmtInt, fmtPct,
  type CustomRange, type Persona, type PeriodId, type QueueItem, type Scope, type UsageSettings,
} from '../../data/platform-usage-metrics';
import { PageSection } from './usageKit';
import {
  AiUsageByArea, CostToRun, CreatedThisPeriod, HeadlineValue, SettingSensitivity, ValueOverTime, WorkVolume,
} from './UsageValueBlocks';
import { ControlCoverage, ExceptionsCaught, NeverExercisedBlock } from './UsageCoverageBlocks';
import { MyQueue, PerPersonOutcomes, Reliability, StuckRuns } from './UsageOperationsBlocks';
import { DashboardsAndAlerts, InsightsGenerated, ReportsMade, SamplingOutcomes } from './UsageProductBlocks';
import { CcmCoverage, EngagementPortfolioBlock, RiskPictureBlock } from './UsagePortfolioBlocks';
import { SmartLearn } from './UsageSmartLearn';
import UsageSettingsPanel from './UsageSettingsPanel';
import UsagePricingPanel from './UsagePricingPanel';
import { buildUsageCsv, downloadCsv, type ExportInput } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

/** What the lens is called on screen: the data it shows, not a job title. */
const LENS_LABEL: Record<Persona, string> = {
  cfo: 'Whole company',
  head_of_team: 'My team',
  auditor: 'Just me',
};

/** Deep-links out to the thing that needs doing, the way the palette does. */
function navigate(view: string, id = '') {
  window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', { detail: { view, id } }));
}

/** Smart Learn is a tab of the Knowledge Hub, so it takes the tabbed nav event. */
function openSmartLearn() {
  window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view: 'knowledge-hub', tab: 'learn' } }));
}

export default function PlatformUsageView() {
  const { currentUser } = useCurrentUser();
  const { can } = useCan();
  const { users, logs, logEvent } = useAdminData();
  const { addToast } = useToast();
  const memoryVersion = useMemorySessionVersion();

  const [settings, setSettings] = useState<UsageSettings>(() => loadSettings());
  const [editingSettings, setEditingSettings] = useState(false);
  // PU-19. Entering a price is the one thing that can turn "work avoided" into
  // net value, so the version counter recomputes every cost figure on save.
  const [editingPrices, setEditingPrices] = useState(false);
  const [pricingVersion, setPricingVersion] = useState(0);

  /* ── Who is reading, and what they may see ──────────────────────────────── */

  const me = users.find(u => u.email === currentUser?.email);
  const myTeam = me?.team && me.team !== '—' ? me.team : null;

  const entitled = useMemo<Persona[]>(() => {
    const out: Persona[] = [];
    if (can('ad_usage')) out.push('cfo');
    if ((can('ad_usage') || can('ad_usage_people')) && myTeam) out.push('head_of_team');
    // Everybody signed in always gets their own view. No request, no approval.
    out.push('auditor');
    return out;
  }, [can, myTeam]);

  const [persona, setPersona] = useState<Persona>(() => entitled[0]);
  const activePersona = entitled.includes(persona) ? persona : entitled[0];

  const scope = useMemo<Scope>(() => {
    if (activePersona === 'cfo') return { persona: 'cfo', label: 'the whole company' };
    if (activePersona === 'head_of_team') {
      return { persona: 'head_of_team', label: myTeam ?? 'your team', team: myTeam ?? undefined };
    }
    return { persona: 'auditor', label: 'only your own work', userEmail: currentUser?.email };
  }, [activePersona, myTeam, currentUser?.email]);

  /* ── The window ─────────────────────────────────────────────────────────── */

  const options = useMemo(() => periodOptions(), []);
  const [periodId, setPeriodId] = useState<PeriodId>(activePersona === 'cfo' ? 'this-quarter' : 'this-month');
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const p = useMemo(() => period(periodId, custom), [periodId, custom]);
  const prior = useMemo(() => priorPeriod(p), [p]);

  /* ── The numbers ────────────────────────────────────────────────────────── */

  // An auditor reads their own work in hours. A rupee figure against one
  // person's name reads as somebody pricing their work, and the page does not
  // do that to anybody.
  const showMoney = activePersona !== 'auditor';

  const periodRuns = useMemo(() => runsIn(p, scope), [p, scope]);
  const value = useMemo(() => valueOf(periodRuns, settings, p.months), [periodRuns, settings, p.months]);
  const priorValue = useMemo(
    () => (prior ? valueOf(runsIn(prior, scope), settings, prior.months) : null),
    [prior, scope, settings],
  );
  const wasted = useMemo(() => wastedEffort(periodRuns), [periodRuns]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cost = useMemo(() => costToRun(p, scope), [p, scope, pricingVersion]);
  const coverage = useMemo(() => controlCoverage(p, scope), [p, scope]);
  const never = useMemo(() => neverExercised(), []);
  const exceptions = useMemo(() => exceptionsCaught(p, scope), [p, scope]);
  const volume = useMemo(() => workVolume(p, scope), [p, scope]);
  const created = useMemo(() => createdThisPeriod(p, scope, logs, users), [p, scope, logs, users]);
  const volumeSeries = useMemo(() => volumeOverTime(p, scope), [p, scope]);
  const timeline = useMemo(() => valueOverTime(p, scope, settings), [p, scope, settings]);
  const reliabilityData = useMemo(() => reliability(p, scope), [p, scope]);
  const stuck = useMemo(() => stuckRuns(p, scope), [p, scope]);
  const ai = useMemo(() => aiUsageByArea(p, scope), [p, scope]);
  const people = useMemo(() => (myTeam ? perPersonOutcomes(p, myTeam, users) : []), [p, myTeam, users]);
  // memoryVersion is the dependency the linter cannot see: approving a memory
  // mutates the shared store rather than a prop, and this is what recomputes.
  const queue = useMemo(
    () => myQueue(currentUser?.name ?? '', activePersona !== 'auditor'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser?.name, activePersona, memoryVersion],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memory = useMemo(() => smartLearn(scope), [scope, memoryVersion]);
  const swing = useMemo(() => sensitivity(periodRuns, settings, p.months), [periodRuns, settings, p.months]);
  // The rest of the product: what was built on it, what was written up, what was
  // tested, what the assistant noticed, and the shape of the audit work itself.
  const product = useMemo(() => productActivity(p, scope, logs, users), [p, scope, logs, users]);
  const reports = useMemo(() => reportsActivity(p, scope, logs, users), [p, scope, logs, users]);
  const samples = useMemo(() => sampling(p, scope), [p, scope]);
  const insightRows = useMemo(() => insights(p, scope), [p, scope]);
  const risks = useMemo(() => riskPicture(p, scope), [p, scope]);
  const engagements = useMemo(() => portfolio(p, scope, logs, users), [p, scope, logs, users]);
  const monitoring = useMemo(() => ccm(p, scope), [p, scope]);
  // The calibration job's output, scoped the same way everything else is.
  const calibration = useMemo(() => calibrate(scope), [scope]);
  const net = netValue(value, cost);

  /* ── Actions ────────────────────────────────────────────────────────────── */

  const onSaveSettings = (next: UsageSettings, changes: string[]) => {
    setSettings(next);
    saveSettings(next);
    setEditingSettings(false);
    logEvent({
      action: 'Update',
      module: 'Platform Usage',
      entity: 'Usage settings',
      description: `Changed the assumptions behind Platform Usage. ${changes.join('; ')}`,
    });
    addToast({ type: 'success', message: 'Saved. Every figure on this page has been recalculated.' });
  };

  const onOpenQueueItem = (item: QueueItem) => navigate(item.target.view, item.target.id);

  /* ── What a folded section says ─────────────────────────────────────────── */

  // A folded section is not a hidden one. Each header carries the figures a
  // reader would otherwise scroll for, so folding costs them a fact rather than
  // the facts.
  const auditSummary = [
    `${fmtPct(coverage.pct)} of controls exercised`,
    risks.unmappedSevere > 0 ? `${fmtInt(risks.unmappedSevere)} severe risks uncovered` : 'no severe risk uncovered',
    `${fmtInt(engagements.total)} engagements`,
    exceptions.total > 0 ? `${fmtInt(exceptions.open)} exceptions open` : 'nothing caught',
  ].join(' · ');

  const behindSummary = [
    `${fmtInt(volume[0]?.count ?? 0)} ${(volume[0]?.label ?? 'runs').toLowerCase()}`,
    `${fmtInt(created.reduce((n, a) => n + a.count, 0))} records created`,
    `${fmtInt(product.alertsFired)} alerts fired`,
    `${fmtInt(reports.made)} reports made`,
  ].join(' · ');

  const teamGapSummary = [
    `${fmtInt(never.controls.length)} controls never tested`,
    samples.total > 0 ? `${fmtInt(samples.failed + samples.errored)} validations need a look` : 'no validation ran',
    monitoring.engagementsOn > 0 ? `${fmtInt(monitoring.engagementsOn)} monitored continuously` : 'nothing monitored continuously',
  ].join(' · ');

  const teamWorkSummary = [
    `${fmtInt(people.length)} people`,
    `${fmtInt(created.reduce((n, a) => n + a.count, 0))} records created`,
    `${fmtHours(value.hours)} hours saved`,
  ].join(' · ');

  // Both formats carry the same payload, and carry it at the top: whose view,
  // which window, the settings the value figures rest on, and what the page does
  // not cover. A figure that travels without those is how a partial number ends
  // up in a pack as a total.
  const exportInput = (): ExportInput => ({
    scope,
    period: p,
    settings,
    value,
    showMoney,
    cost: activePersona === 'cfo' ? cost : null,
    coverage: activePersona === 'auditor' ? null : coverage,
    neverExercised: activePersona === 'auditor' ? null : never,
    volume,
    created: activePersona === 'auditor' ? null : created,
    ai: activePersona === 'cfo' ? ai : null,
    exceptions,
    smartLearn: memory,
    wasted,
    // Each of these travels only where the view shows it, so an export can never
    // carry a figure the reader was not entitled to see on screen.
    product: activePersona === 'auditor' ? null : product,
    reports: activePersona === 'auditor' ? null : reports,
    sampling: activePersona === 'auditor' ? null : samples,
    insights: insightRows,
    risks: activePersona === 'auditor' ? null : risks,
    portfolio: activePersona === 'auditor' ? null : engagements,
    ccm: activePersona === 'auditor' ? null : monitoring,
  });

  const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const baseName = `platform-usage-${activePersona}-${stamp(p.from)}-to-${stamp(p.to)}`;

  const logExport = (format: string) =>
    logEvent({
      action: 'Export',
      module: 'Platform Usage',
      entity: p.label,
      description: `Exported Platform Usage as ${format}. ${LENS_LABEL[activePersona]}, ${p.label}.`,
    });

  const onExportCsv = () => {
    downloadCsv(`${baseName}.csv`, buildUsageCsv(exportInput()));
    logExport('CSV');
  };

  const onExportPdf = async () => {
    try {
      await downloadUsagePdf(exportInput(), `${baseName}.pdf`);
      logExport('PDF');
    } catch {
      addToast({ type: 'error', message: 'The PDF could not be built. Try the CSV instead.' });
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[76rem] mx-auto px-8 py-6">
        <header className="mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-[1.25rem] font-semibold text-ink-900 leading-tight">Platform Usage</h1>

            <div className="flex items-center gap-2 shrink-0">
              <PeriodPicker
                options={options}
                active={periodId}
                custom={custom}
                onPick={id => { setPeriodId(id); if (id !== 'custom') setCustom(null); }}
                onCustom={range => { setCustom(range); setPeriodId('custom'); }}
              />
              {/* The settings editor is CFO only. Per-team assumptions would make
                  two teams' numbers incomparable, which is worse than one team
                  disagreeing with the rate. */}
              {can('ad_usage') && (
                <>
                  {/* Both labels are the spec's own words: "the settings editor"
                      and "Cost the paid lookups" (PU-19). Nothing on this page is
                      named anything the document does not name it. */}
                  <button type="button" onClick={() => setEditingSettings(true)} className={BTN_CTA_OUTLINE}>
                    <SlidersHorizontal size={14} />
                    Settings
                  </button>
                  <button type="button" onClick={() => setEditingPrices(true)} className={BTN_CTA_OUTLINE}>
                    <IndianRupee size={14} />
                    Cost the paid lookups
                  </button>
                </>
              )}
              {can('ad_usage_export') && <ExportMenu onCsv={onExportCsv} onPdf={onExportPdf} />}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <LensSwitch entitled={entitled} active={activePersona} onChange={setPersona} />
            {/* The screen always says what you are looking at. */}
            <p className="text-[0.75rem] text-ink-500 tabular-nums">
              You are seeing {scope.label} · {formatDate(p.from)} to {formatDate(p.to)} · {dataAsOfLabel()}
            </p>
          </div>

          {/* The one line a page called Platform Usage has to carry, or it is
              read as covering everything. One line, not a panel. */}
          <p className="mt-2 text-[0.75rem] text-ink-400">{COVERAGE_NOTE}</p>
        </header>

        <div className="space-y-7 pb-10">
          {activePersona === 'cfo' && (
            <>
              <PageSection title="What it was worth">
                <HeadlineValue
                  value={value} prior={priorValue} periodLabel={p.label} priorLabel={prior?.label ?? null}
                  settings={settings} showMoney={showMoney} wasted={wasted} netValue={net}
                  onEditSettings={() => setEditingSettings(true)}
                />
                <ValueOverTime points={timeline} showMoney={showMoney} />
                <SettingSensitivity rows={swing} onEdit={() => setEditingSettings(true)} />
                <CostToRun cost={cost} />
              </PageSection>

              <PageSection
                title="The audit work"
                hint="What the platform reached, where the audits stand, and what was caught"
                summary={auditSummary}
                collapsible
                defaultOpen={false}
              >
                <ControlCoverage coverage={coverage} />
                <NeverExercisedBlock
                  data={never}
                  onOpenControls={() => navigate('governance-controls')}
                  onOpenWorkflows={() => navigate('workflow-library')}
                />
                <EngagementPortfolioBlock
                  data={engagements}
                  periodLabel={p.label}
                  onOpenEngagement={id => navigate('engagements', id)}
                  onOpenExceptions={id => navigate('manage-exceptions', id)}
                  onOpenReports={() => navigate('reports')}
                />
                <RiskPictureBlock data={risks} periodLabel={p.label} onOpenRisks={() => navigate('audit-risk-register')} />
                <ExceptionsCaught data={exceptions} periodLabel={p.label} onOpenException={id => navigate('manage-exceptions', id)} />
                <SamplingOutcomes data={samples} />
              </PageSection>

              <PageSection
                title="Behind the numbers"
                hint="Where the work actually happened"
                summary={behindSummary}
                collapsible
                defaultOpen={false}
              >
                <WorkVolume units={volume} series={volumeSeries} />
                <CreatedThisPeriod areas={created} />
                <DashboardsAndAlerts data={product} periodLabel={p.label} onOpenDashboards={() => navigate('dashboards')} />
                <ReportsMade data={reports} periodLabel={p.label} onOpenReports={() => navigate('reports')} />
                <InsightsGenerated data={insightRows} />
                <CcmCoverage data={monitoring} />
                <AiUsageByArea rows={ai} />
                <SmartLearn data={memory} scopeLabel="Across the whole company" onManage={openSmartLearn} />
              </PageSection>
            </>
          )}

          {activePersona === 'head_of_team' && (
            <>
              <PageSection title="Needs you now">
                <StuckRuns runs={stuck} onOpenRun={() => navigate('workflow-library')} />
                <Reliability data={reliabilityData} />
              </PageSection>

              <PageSection
                title="Gaps"
                hint="Things nothing has checked yet"
                summary={teamGapSummary}
                collapsible
                defaultOpen={false}
              >
                <NeverExercisedBlock
                  data={never}
                  onOpenControls={() => navigate('governance-controls')}
                  onOpenWorkflows={() => navigate('workflow-library')}
                />
                <SamplingOutcomes data={samples} />
                <CcmCoverage data={monitoring} />
                <RiskPictureBlock data={risks} periodLabel={p.label} onOpenRisks={() => navigate('audit-risk-register')} />
              </PageSection>

              <PageSection title="Your team" summary={teamWorkSummary} collapsible defaultOpen={false}>
                <PerPersonOutcomes rows={people} team={myTeam ?? ''} />
                <CreatedThisPeriod areas={created} />
                <DashboardsAndAlerts data={product} periodLabel={p.label} onOpenDashboards={() => navigate('dashboards')} />
                <ReportsMade data={reports} periodLabel={p.label} onOpenReports={() => navigate('reports')} />
                <InsightsGenerated data={insightRows} />
                <SmartLearn
                  data={memory}
                  scopeLabel={`Memories held for ${myTeam ?? 'your team'}`}
                  onManage={openSmartLearn}
                />
                {/* Small, and at the bottom. A team lead cannot act on a rupee
                    figure; they can act on a workflow that failed four times. */}
                <HeadlineValue
                  compact
                  value={value} prior={priorValue} periodLabel={p.label} priorLabel={prior?.label ?? null}
                  settings={settings} showMoney={showMoney} wasted={wasted} netValue={net}
                />
              </PageSection>
            </>
          )}

          {activePersona === 'auditor' && (
            <>
              <PageSection title="Needs you now">
                <MyQueue items={queue} onOpen={onOpenQueueItem} />
              </PageSection>

              <PageSection title="What you got through">
                <WorkVolume units={volume} series={volumeSeries} />
                <ExceptionsCaught data={exceptions} periodLabel={p.label} onOpenException={id => navigate('manage-exceptions', id)} />
                <InsightsGenerated data={insightRows} />
                <HeadlineValue
                  value={value} prior={priorValue} periodLabel={p.label} priorLabel={prior?.label ?? null}
                  settings={settings} showMoney={showMoney} wasted={wasted} netValue={net}
                />
                <ValueOverTime points={timeline} showMoney={showMoney} />
                <SmartLearn data={memory} scopeLabel="What it has learned about you" onManage={openSmartLearn} />
              </PageSection>
            </>
          )}
        </div>
      </div>

      {editingPrices && (
        <UsagePricingPanel
          enteredBy={currentUser?.name ?? 'Unknown'}
          onClose={() => setEditingPrices(false)}
          onSaved={change => {
            setPricingVersion(v => v + 1);
            logEvent({
              action: 'Update',
              module: 'Platform Usage',
              entity: 'Paid lookup cost',
              description: change,
            });
          }}
        />
      )}

      {editingSettings && (
        <UsageSettingsPanel
          settings={settings}
          calibration={calibration}
          runs={periodRuns}
          months={p.months}
          periodLabel={p.label}
          onSave={onSaveSettings}
          onClose={() => setEditingSettings(false)}
        />
      )}
    </div>
  );
}

/* ── The period control ──────────────────────────────────────────────────── */

/**
 * Four fixed windows plus a custom range.
 *
 * The custom inputs are bounded by the record the platform actually holds, so
 * nobody can pick a fortnight there are no records for and read the resulting
 * zero as "nothing happened".
 */
function PeriodPicker({
  options,
  active,
  custom,
  onPick,
  onCustom,
}: {
  options: { id: PeriodId; label: string }[];
  active: PeriodId;
  custom: CustomRange | null;
  onPick: (id: PeriodId) => void;
  onCustom: (range: CustomRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({ from: iso(custom?.from ?? HISTORY_START), to: iso(custom?.to ?? ANCHOR) }));
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const label = active === 'custom' && custom
    ? `${formatDate(custom.from)} to ${formatDate(custom.to)}`
    : options.find(o => o.id === active)?.label ?? 'This quarter';

  const item = (selected: boolean) =>
    `w-full text-left h-8 px-2.5 rounded-md text-[0.75rem] ${
      selected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700'
    }`;

  const applyCustom = () => {
    const from = Date.parse(`${draft.from}T00:00:00Z`);
    const to = Date.parse(`${draft.to}T23:59:59Z`);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return;
    onCustom({ from, to });
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="listbox" className={BTN_CTA_OUTLINE}>
        <CalendarRange size={14} />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-64 p-1 rounded-xl border border-canvas-border bg-canvas-elevated shadow-lg">
          <div role="listbox">
            {options.map(o => (
              <button
                key={o.id} type="button" role="option" aria-selected={active === o.id}
                className={item(active === o.id)}
                onClick={() => { onPick(o.id); setOpen(false); }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-1 pt-2 border-t border-canvas-border px-2.5 pb-1.5">
            <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">Custom range</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date" aria-label="From" min={iso(HISTORY_START)} max={iso(ANCHOR)} value={draft.from}
                onChange={e => setDraft(d => ({ ...d, from: e.target.value }))}
                className="flex-1 min-w-0 h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] tabular-nums"
              />
              <span className="text-[0.75rem] text-ink-400">to</span>
              <input
                type="date" aria-label="To" min={iso(HISTORY_START)} max={iso(ANCHOR)} value={draft.to}
                onChange={e => setDraft(d => ({ ...d, to: e.target.value }))}
                className="flex-1 min-w-0 h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] tabular-nums"
              />
            </div>
            <p className="mt-1.5 text-[0.75rem] text-ink-400">
              The platform holds records from {formatDate(HISTORY_START)} to {formatDate(ANCHOR)}.
            </p>
            <button
              type="button" onClick={applyCustom}
              className="mt-2 w-full h-8 rounded-md bg-brand-600 text-white text-[0.75rem] font-medium hover:bg-brand-700"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function useDismiss(ref: React.RefObject<HTMLDivElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close, ref]);
}

/** Export is two formats, so the button is a menu rather than a guess. */
function ExportMenu({ onCsv, onPdf }: { onCsv: () => void; onPdf: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const item = 'w-full text-left h-8 px-2.5 rounded-md text-[0.75rem] text-ink-700 hover:bg-brand-50 hover:text-brand-700';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="menu" className={BTN_CTA_OUTLINE}>
        <Download size={14} />
        Export
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-44 p-1 rounded-xl border border-canvas-border bg-canvas-elevated shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onPdf(); }}>
            Download as PDF
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onCsv(); }}>
            Download as CSV
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The lens.
 *
 * A control with one option is not a control: somebody entitled to a single view
 * gets no switch, because the scope line beside it already says what they are
 * looking at and saying it twice reads as a bug.
 */
function LensSwitch({
  entitled,
  active,
  onChange,
}: {
  entitled: Persona[];
  active: Persona;
  onChange: (p: Persona) => void;
}) {
  if (entitled.length < 2) return null;

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-canvas-border bg-canvas-elevated">
      {entitled.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={p === active}
          className={`h-7 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
            p === active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {LENS_LABEL[p]}
        </button>
      ))}
    </div>
  );
}
