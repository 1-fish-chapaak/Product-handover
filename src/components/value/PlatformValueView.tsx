/**
 * Platform Value.
 *
 * Platform Usage answers what this workspace did. This page answers what that
 * was worth, which is a different promise and a harder one: the platform can
 * count what it did, and it cannot watch somebody doing the same work by hand.
 *
 * So the page obeys one rule. Work is valued only where the client's own
 * control documentation says how long it takes, or where somebody timed an
 * auditor doing it. Everything else is counted, listed, and left without a
 * figure. That makes the headline a floor rather than a total, and the page
 * says so in those words wherever it appears.
 *
 * Three readers, one calculation underneath. A finance lead reads the return
 * against the running cost. A team head reads capacity and who is not getting
 * it. Everybody else reads their own week. The scope switch is a lens and
 * never a key: it only ever offers a view the reader could already see, and
 * the cost line exists on one scope only.
 */

import { useState } from 'react';
import {
  ALL_TIME, BAND_LABEL, PERSONA_QUESTION, PERSONA_TITLE, REFUSAL, adoptionGap, benchmarking,
  dataAsOfLabel, entitledViews, fmtHours, fmtInr, fmtInt, fmtOneDp, fmtPct, personaFor,
  priorRange, rangeLabel, rangeMonths, rangePhrase, rangePresets, showsCost, snapshot, topWins,
  type Persona, type Range, type Scope,
} from '../../data/value/model';
import { DEFAULT_SETTINGS, GROUP_LABEL, type ValueSettings } from '../../data/value/settings';
import { useAdminData } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import AssumptionsFooter from './AssumptionsFooter';
import CompanyValue from './CompanyValue';
import ControlsBenchmarks from './ControlsBenchmarks';
import DigestPreview from './DigestPreview';
import MyValue from './MyValue';
import SetupScreen from './SetupScreen';
import TeamValue from './TeamValue';
import ValueSettingsPanel from './ValueSettingsPanel';

type Tab = 'value' | 'controls' | 'settings' | 'digest';

const TAB_LABEL: Record<Tab, string> = {
  value: 'Value',
  controls: 'Controls and benchmarks',
  settings: 'Settings',
  digest: 'Monthly note',
};

function readerScope(persona: Persona, team: string | null, name: string, email: string): Scope {
  if (persona === 'cfo') return { persona, subject: 'the company' };
  if (persona === 'head_of_team') return { persona, subject: team ?? 'your team', team: team ?? undefined };
  return { persona, subject: 'you', userEmail: email, userName: name };
}

/** A date box holds a day; the model holds an instant. */
const toInput = (ms: number | null): string =>
  (ms === null ? '' : new Date(ms).toISOString().slice(0, 10));

const fromInput = (value: string, endOfDay: boolean): number | null => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return endOfDay ? Date.UTC(y, m - 1, d, 23, 59, 59) : Date.UTC(y, m - 1, d);
};

export default function PlatformValueView() {
  const admin = useAdminData();
  const { currentUser, can } = useCurrentUser();

  // The team comes off the Administration roster rather than off the signed in
  // record, because that is the one place membership is kept.
  const rosterEntry = admin.users.find(u => u.email === currentUser?.email);
  const myTeam = rosterEntry?.team && rosterEntry.team !== '—' ? rosterEntry.team : null;
  const ceiling: Persona = personaFor(
    { usage: can('ad_usage'), people: can('ad_usage_people') },
    myTeam,
  );
  const offered = entitledViews(ceiling, myTeam);
  const isAdmin = can('ad_usage');

  const [persona, setPersona] = useState<Persona>(offered[0]);
  const [range, setRange] = useState<Range>(() => rangePresets[2].make());
  const [tab, setTab] = useState<Tab>('value');
  const [settings, setSettings] = useState<ValueSettings>(DEFAULT_SETTINGS);

  const name = currentUser?.name ?? 'you';
  const email = currentUser?.email ?? '';
  const scope = readerScope(persona, myTeam, name, email);
  const phrase = rangePhrase(range);
  const snap = snapshot(scope, range, settings);
  const before = priorRange(range);
  const prior = before ? snapshot(scope, before, settings) : null;

  // The gate is read on the company's run volume, not on the reader's own, so
  // a quiet auditor does not see a setup screen a busy workspace has outgrown.
  const platform = snapshot({ persona: 'cfo', subject: 'the company' }, ALL_TIME, settings);
  const belowThreshold = platform.runCoveragePct < settings.minCoveragePct;
  // The worklist reads the whole company over the range on screen, whichever
  // scope the reader happens to be looking at.
  const companyOverRange = snapshot({ persona: 'cfo', subject: 'the company' }, range, settings);

  // A stale link can still ask for a view above the reader's entitlement. It
  // is refused in words, because an empty page reads as no data and would hide
  // a permissions bug.
  if (!offered.includes(persona)) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-16">
          <h1 className="text-[1.25rem] font-semibold text-ink-900">Platform Value</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-500">{REFUSAL}</p>
        </div>
      </div>
    );
  }

  const tabs: Tab[] = isAdmin ? ['value', 'controls', 'settings', 'digest'] : ['value', 'digest'];

  const exportCsv = () => {
    const lines: string[][] = [
      ['Platform Value', rangeLabel(range), `Read for ${scope.subject}`, dataAsOfLabel()],
      [],
      ['Figure', 'Value', 'Note'],
      ['Hours returned', snap.hours.toFixed(2), 'A floor. Unvalued work is not in it.'],
      ['Value created in rupees', Math.round(snap.inr).toString(), `At ${settings.hourlyRateInr} an hour`],
      ['Auditor months', snap.auditorMonths.toFixed(2), ''],
      ['Things counted', snap.counted.toString(), ''],
      ['Things valued', snap.valued.toString(), ''],
      ['Documented share of counted work', `${Math.round(snap.coverage.documentedPct)}%`, ''],
      ['Measured share of counted work', `${Math.round(snap.coverage.measuredPct)}%`, ''],
      ['Not yet valued', `${Math.round(snap.coverage.unvaluedPct)}%`, ''],
      ...(showsCost(persona)
        ? [
          ['Running cost in rupees', Math.round(snap.cost.totalInr).toString(), snap.cost.unpricedRows > 0 ? 'A floor. Some models have no published price.' : ''],
          ['Net of running cost in rupees', Math.round(snap.cost.netInr).toString(), ''],
        ]
        : []),
      [],
      ['Workflow', 'Band', 'Control', 'Runs', 'Manual minutes', 'How we know', 'Hours back', 'Rupees'],
      ...snap.workflows.map(w => [
        w.name, BAND_LABEL[w.band], w.controlIds.join(' '), w.runs.toString(),
        w.manualMinutes === null ? 'not established' : Math.round(w.manualMinutes).toString(),
        w.basis ?? 'not valued',
        w.basis ? w.hours.toFixed(2) : '',
        w.basis ? Math.round(w.inr).toString() : '',
      ]),
      [],
      ['Counted and not valued', 'How much', 'Why'],
      ...snap.unvalued.map(u => [u.what, u.events.toString(), u.reason]),
      [],
      ['Kind of work', 'Counted', 'Valued', 'Hours back', 'Rupees'],
      ...snap.groups.map(g => [
        GROUP_LABEL[g.group], g.counted.toString(), g.valued.toString(),
        g.hours.toFixed(2), Math.round(g.inr).toString(),
      ]),
    ];
    const csv = lines
      .map(row => row.map(cell => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'platform-value.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const activePreset = rangePresets.find(p => {
    const made = p.make();
    return made.from === range.from && made.to === range.to;
  });

  return (
    // The app shell is overflow-hidden and each view carries its own scroll,
    // which is what Platform Usage does. Without this the page is cut off at
    // the fold and nothing below it can be reached at all.
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <header className="border-b border-canvas-border pb-5">
        <h1 className="text-[1.25rem] font-semibold text-ink-900">Platform Value</h1>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-ink-500">
          {PERSONA_QUESTION[persona]}? Read for {scope.subject}, {rangeLabel(range)}.{' '}
          {dataAsOfLabel()}.
        </p>

        {!belowThreshold ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              {offered.length > 1 ? (
                <div className="flex items-center gap-1">
                  {offered.map(view => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setPersona(view)}
                      className={`rounded px-2.5 py-1 text-[0.875rem] ${
                        view === persona
                          ? 'bg-ink-900 text-canvas-elevated'
                          : 'text-ink-500 hover:bg-canvas hover:text-ink-800'
                      }`}
                    >
                      {PERSONA_TITLE[view]}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-[0.875rem] text-ink-500">
                From
                <input
                  type="date"
                  value={toInput(range.from)}
                  onChange={e => setRange(r => ({ ...r, from: fromInput(e.target.value, false) }))}
                  className="rounded border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.875rem] text-ink-800"
                />
              </label>
              <label className="flex items-center gap-2 text-[0.875rem] text-ink-500">
                To
                <input
                  type="date"
                  value={toInput(range.to)}
                  onChange={e => setRange(r => ({ ...r, to: fromInput(e.target.value, true) }))}
                  className="rounded border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.875rem] text-ink-800"
                />
              </label>

              <button
                type="button"
                onClick={exportCsv}
                className="text-[0.875rem] text-ink-600 underline decoration-dotted underline-offset-2 hover:text-ink-900"
              >
                Download this as a spreadsheet
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {rangePresets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRange(p.make())}
                  className={`text-[0.75rem] ${
                    activePreset?.id === p.id
                      ? 'text-ink-900 underline underline-offset-2'
                      : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <span className="text-[0.75rem] text-ink-400">
                {range.from === null && range.to === null
                  ? 'With no dates set this is every figure since the workspace started.'
                  : 'Clear both dates for all time.'}
              </span>
            </div>

            {tabs.length > 1 ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-5 border-t border-canvas-border pt-3">
                {tabs.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`text-[0.875rem] ${
                      t === tab
                        ? 'font-medium text-ink-900 underline underline-offset-[6px]'
                        : 'text-ink-500 hover:text-ink-800'
                    }`}
                  >
                    {TAB_LABEL[t]}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </header>

      {belowThreshold ? (
        <SetupScreen
          platform={platform}
          settings={settings}
          isAdmin={isAdmin}
          onSettings={setSettings}
        />
      ) : (
        <div className="pt-5">
          {tab === 'value' ? (
            <>
              {persona === 'cfo' ? (
                <CompanyValue
                  snap={snap}
                  prior={prior}
                  phrase={phrase}
                  settings={settings}
                  onOpenControls={() => setTab(isAdmin ? 'controls' : 'value')}
                />
              ) : null}

              {persona === 'head_of_team' && myTeam ? (
                <TeamValue
                  snap={snap}
                  phrase={phrase}
                  months={rangeMonths(range)}
                  settings={settings}
                  team={myTeam}
                  adoption={adoptionGap(myTeam, range, settings)}
                  bench={benchmarking(myTeam, range, settings)}
                  onOpenControls={() => setTab(isAdmin ? 'controls' : 'value')}
                />
              ) : null}

              {persona === 'auditor' ? (
                <MyValue
                  snap={snap}
                  phrase={phrase}
                  settings={settings}
                  wins={topWins(scope, range, settings)}
                  name={name.split(' ')[0]}
                />
              ) : null}

              <AssumptionsFooter settings={settings} />
            </>
          ) : null}

          {tab === 'controls' ? (
            <ControlsBenchmarks
              r={range}
              phrase={phrase}
              snap={companyOverRange}
              gatePct={platform.runCoveragePct}
              settings={settings}
              onSettings={setSettings}
            />
          ) : null}

          {tab === 'settings' ? (
            <ValueSettingsPanel settings={settings} onSettings={setSettings} />
          ) : null}

          {tab === 'digest' ? (
            <DigestPreview
              settings={settings}
              team={myTeam}
              personEmail={email}
              personName={name}
            />
          ) : null}
        </div>
      )}

      {!belowThreshold ? (
        <p className="mt-8 border-t border-canvas-border pt-4 text-[0.75rem] leading-relaxed text-ink-400">
          Nothing on this page is estimated. A figure appears only where your own control
          documentation says how long the work takes by hand, or where somebody timed an auditor
          doing it. Everything else is counted and left without a value, which is why the headline
          is a floor and grows as evidence grows rather than as the platform gets busier.
          {showsCost(persona)
            ? ` At least ${fmtHours(snap.hours)} and ${fmtInr(snap.inr)} against a running cost of ${fmtInr(snap.cost.totalInr)}, from ${fmtInt(snap.valued)} of ${fmtInt(snap.counted)} things counted, which is ${fmtPct(snap.coverage.valuedPct)} coverage and ${fmtOneDp(snap.auditorMonths)} auditor months.`
            : ''}
        </p>
      ) : null}
      </div>
    </div>
  );
}
