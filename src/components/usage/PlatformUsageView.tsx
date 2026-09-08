/**
 * Platform Usage.
 *
 * What this workspace has done, counted from the record and from nothing else.
 *
 * Every figure on this page has a column behind it. There is no assumed rate,
 * no modelled saving and no money, because the platform records no price, no
 * token and no salary, and a figure invented here would be one a reader could
 * never check against anything. The last section names the questions the page
 * cannot answer, so a gap is read as a gap rather than as a nought.
 *
 * The page reads and never writes. The window and the reader are view
 * controls, and they are the only inputs in the feature.
 */

import { useState } from 'react';
import {
  GAPS, NOW_RECORDED, PERSONA_QUESTION, PERSONA_TITLE, REFUSAL, TEAMS, dataAsOfLabel, entitledViews, fmtBytes,
  fmtInt, fmtLatency, fmtPct, fmtSeconds, formatDate, formatMonth, period, periodOptions,
  personaFor, plural, snapshot, type Persona, type PeriodId, type Scope,
} from '../../data/usage/metrics';
import { Grid, Group, Lede, Line, Note, Num, Unmeasured, Working, type GroupSpec } from './chrome';
import { useAdminData } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';

/** The reader this page opens as, from what their role may read. */
function readerScope(persona: Persona, team: string | null, name: string, email: string): Scope {
  if (persona === 'cfo') return { persona, subject: 'the company' };
  if (persona === 'head_of_team') return { persona, subject: team ?? 'your team', team: team ?? undefined };
  return { persona, subject: 'you', userEmail: email, userName: name };
}

export default function PlatformUsageView() {
  const admin = useAdminData();
  const { currentUser, can } = useCurrentUser();
  // Who is reading, and how far up they may look. A lens, never a key: the
  // switch only ever offers a view the reader could already see.
  //
  // The team comes off the Administration roster rather than off the signed-in
  // record, because that is the one place membership is kept.
  const rosterEntry = admin.users.find(u => u.email === currentUser?.email);
  const myTeam = rosterEntry?.team && rosterEntry.team !== '—' ? rosterEntry.team : null;
  const ceiling: Persona = personaFor(
    { usage: can('ad_usage'), people: can('ad_usage_people') },
    myTeam,
  );
  const offered = entitledViews(ceiling, myTeam);

  const [persona, setPersona] = useState<Persona>(offered[0]);
  const [periodId, setPeriodId] = useState<PeriodId>('this-quarter');
  const [open, setOpen] = useState<Record<string, boolean>>({ ran: true, gaps: true });

  // Memoized by the React Compiler rather than by hand. A manual dependency
  // list here has to name `myTeam`, which the compiler cannot prove stable.
  const scope = readerScope(persona, myTeam, currentUser?.name ?? 'you', currentUser?.email ?? '');
  const p = period(periodId);
  const { runs, tested, found, produced, queries, imports, workspace } = snapshot(scope, p);

  // A stale link can still ask for a view above the reader's entitlement. It
  // is refused in words: an empty page would read as "no data" and hide a
  // permissions bug.
  if (!offered.includes(persona)) {
    return (
      // The shell hands a view a fixed height and clips it, so every view owns
      // its own scroll. Without this the page is simply cut off at the fold.
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-16">
          <h1 className="text-[1.25rem] font-semibold text-ink-900">Platform Usage</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-500">{REFUSAL}</p>
        </div>
      </div>
    );
  }

  const groups: GroupSpec[] = [];

  /* ── What ran ────────────────────────────────────────────────────────── */

  groups.push({
    id: 'ran',
    title: 'What ran',
    answer: !runs.attributable
      ? 'A check that ran cannot be put against a person, so this is read on the team or company view.'
      : runs.total === 0
        ? `Nothing ran ${p.phrase}.`
        : `${plural(runs.complete, 'check finished', 'checks finished')} in ${fmtSeconds(runs.platformSeconds)} of platform time.`,
    body: !runs.attributable ? (
      <Unmeasured>
        A workflow execution records which workflow ran and when, and no user. The column for it
        exists on the table and nothing ever writes it, so a check that ran reaches a team through
        its workflow and never reaches a person. Your own line here would be a guess, so there is
        not one.
      </Unmeasured>
    ) : runs.total === 0 ? (
      <Unmeasured>
        No check started {p.phrase}. This is a count of nought rather than a figure we could not
        work out.
      </Unmeasured>
    ) : (
      <>
        <Lede>
          <Working sum={`${fmtInt(runs.complete)} of ${fmtInt(runs.total)} executions reached a complete status. ${fmtInt(runs.failed)} failed and ${fmtInt(runs.blocked)} were blocked before they ran.`}>
            <Num>{fmtInt(runs.complete)}</Num>
          </Working>{' '}
          checks finished {p.phrase}, taking{' '}
          <Working sum={`Summed duration_secs across the ${fmtInt(runs.complete)} completed runs. The median run took ${fmtSeconds(runs.medianSeconds)}. This is the only duration the product records anywhere.`}>
            <Num>{fmtSeconds(runs.platformSeconds)}</Num>
          </Working>{' '}
          of platform time between them, and they returned{' '}
          <Working sum={`Rows across the output tables of the completed runs, derived from each run's output at read time rather than stored as a column. These are the rows a check returned, not the rows it read.`}>
            <Num>{fmtInt(runs.outputRows)}</Num>
          </Working>{' '}
          rows for somebody to look at.
        </Lede>

        <div className="max-w-xl">
          <Line
            label="Failed or blocked"
            value={fmtInt(runs.failed + runs.blocked)}
            sub={`${fmtSeconds(runs.wastedSeconds)} of platform time spent on runs that produced nothing. A failed run makes no output tables, so it carries no row count either.`}
          />
          <Line
            label="Median run"
            value={fmtSeconds(runs.medianSeconds)}
            sub="Half the completed runs were quicker than this and half were slower."
          />
        </div>

        <Grid
          columns={[
            { head: 'Workflow' },
            { head: 'Team' },
            { head: 'Runs', align: 'right' },
            { head: 'Failed', align: 'right' },
            { head: 'Platform time', align: 'right' },
            { head: 'Last run', align: 'right' },
          ]}
          rows={runs.workflows.map(w => [
            w.name,
            w.team,
            fmtInt(w.runs),
            fmtInt(w.failed),
            fmtSeconds(w.platformSeconds),
            w.lastRunAt === null ? '—' : formatDate(w.lastRunAt),
          ])}
          caption={
            <>
              A run belongs to a team through the workflow it came from, which is the only route
              there is: the execution itself carries no team and no person.
            </>
          }
        />

        {runs.byMonth.length > 1 ? (
          <Grid
            columns={[{ head: 'Month' }, { head: 'Runs', align: 'right' }, { head: 'Failed', align: 'right' }]}
            rows={runs.byMonth.map(m => [formatMonth(m.at), fmtInt(m.runs), fmtInt(m.failed)])}
            caption="Counted on the day each run started."
          />
        ) : null}
      </>
    ),
  });

  /* ── What was tested ─────────────────────────────────────────────────── */

  groups.push({
    id: 'tested',
    title: 'What was tested',
    answer: tested.populations.length === 0 && tested.sampleRuns.length === 0
      ? `No population was loaded and no sample was tested ${p.phrase}.`
      : `${plural(tested.populations.length, 'population', 'populations')} holding ${fmtInt(tested.populationRows)} rows, and ${plural(tested.sampleRuns.length, 'sample test', 'sample tests')}.`,
    body: (
      <>
        {tested.populations.length === 0 ? (
          <Unmeasured>
            No population was loaded {p.phrase}. A population loaded in an earlier window is still
            being tested; it is counted in the window it arrived in, which is the only date the
            record carries.
          </Unmeasured>
        ) : (
          <>
            <Lede>
              <Working sum={`Row counts as recorded on each population when it was loaded. The rows live in columnar storage and this count is the metadata kept beside them, so it is read rather than counted here.`}>
                <Num>{fmtInt(tested.populationRows)}</Num>
              </Working>{' '}
              rows across <Num>{fmtInt(tested.populations.length)}</Num> populations, taking{' '}
              <Num>{fmtBytes(tested.populationBytes)}</Num> of storage.
            </Lede>
            <Grid
              columns={[
                { head: 'Population' },
                { head: 'Source' },
                { head: 'Loaded by' },
                { head: 'Rows', align: 'right' },
                { head: 'Size', align: 'right' },
                { head: 'Loaded', align: 'right' },
              ]}
              rows={tested.populations.map(pop => [
                pop.name,
                pop.sourceType === 'upload' ? 'Uploaded file' : 'Database connection',
                pop.uploadedBy.name,
                fmtInt(pop.rowCount),
                fmtBytes(pop.sizeBytes),
                formatDate(pop.createdAt),
              ])}
              caption={
                <>
                  A population is what a control was tested against. How much of it any one check
                  read is not recorded, so these rows are what was available to test and not a
                  claim about coverage.
                </>
              }
            />
          </>
        )}

        {tested.sampleRuns.length > 0 ? (
          <div className="max-w-xl">
            <Line
              label="Samples drawn"
              value={fmtInt(tested.samples.length)}
              sub={`${fmtInt(tested.sampleRows)} rows selected out of the populations above for testing by hand.`}
            />
            <Line
              label="Sample tests run"
              value={fmtInt(tested.sampleRuns.length)}
              sub={`${fmtInt(tested.samplePassed)} passed and ${fmtInt(tested.sampleFailed)} failed or errored. A sample run records who ran it but not how long it took.`}
            />
            <Line
              label="Evidence attached"
              value={fmtBytes(tested.evidenceBytes)}
              sub="Files attached to those tests, sized as recorded on each run."
            />
          </div>
        ) : null}
      </>
    ),
  });

  /* ── What it found ───────────────────────────────────────────────────── */

  groups.push({
    id: 'found',
    title: 'What it found',
    answer: found.total === 0
      ? `Nothing was flagged ${p.phrase}.`
      : `${plural(found.total, 'exception', 'exceptions')}, ${fmtInt(found.high)} of them high, and ${fmtPct(found.closedPct)} are closed.`,
    body: found.total === 0 ? (
      <Unmeasured>
        No exception was flagged {p.phrase}. Checks ran and returned rows; nobody raised one of
        those rows as an exception inside this window.
      </Unmeasured>
    ) : (
      <>
        <Lede>
          <Working sum={`One row per exception on the staging table, counted on the date it was flagged. Severity and status are columns on that row, so both are read rather than worked out.`}>
            <Num>{fmtInt(found.total)}</Num>
          </Working>{' '}
          exceptions were flagged {p.phrase}. <Num>{fmtInt(found.closed)}</Num> are closed and{' '}
          <Num>{fmtInt(found.open)}</Num> are still open, of which{' '}
          <Num>{fmtInt(found.overdue)}</Num>{' '}
          {found.overdue === 1 ? 'is' : 'are'} past a date somebody set on them.
        </Lede>

        <div className="max-w-xl">
          <Line label="High" value={fmtInt(found.high)} />
          <Line label="Medium" value={fmtInt(found.medium)} />
          <Line label="Low" value={fmtInt(found.low)} />
        </div>

        <Grid
          columns={[
            { head: 'Check' },
            { head: 'Exceptions', align: 'right' },
            { head: 'High', align: 'right' },
            { head: 'Still open', align: 'right' },
          ]}
          rows={found.byWorkflow.map(w => [w.name, fmtInt(w.total), fmtInt(w.high), fmtInt(w.open)])}
          caption={
            <>
              Only exceptions where somebody set a due date can be overdue, so the overdue count is
              a floor rather than a total.
            </>
          }
        />
      </>
    ),
  });

  /* ── What came out ───────────────────────────────────────────────────── */

  groups.push({
    id: 'produced',
    title: 'What came out',
    answer: produced.reports.length === 0 && produced.snapshots.length === 0
      ? `No report was started and no document was generated ${p.phrase}.`
      : `${plural(produced.reports.length, 'report', 'reports')} and ${plural(produced.snapshots.length, 'document generated', 'documents generated')}, ${fmtInt(produced.pages)} pages in all.`,
    body: produced.reports.length === 0 && produced.snapshots.length === 0 ? (
      <Unmeasured>
        Nothing was produced {p.phrase}.
      </Unmeasured>
    ) : (
      <>
        <div className="max-w-xl">
          <Line
            label="Reports started"
            value={fmtInt(produced.reports.length)}
            sub={`${fmtInt(produced.finalReports)} of them are final. A report carries an owner and a team, so both views can read it.`}
          />
          <Line
            label="Documents generated"
            value={fmtInt(produced.snapshots.length)}
            sub={`${fmtInt(produced.pages)} pages, ${fmtBytes(produced.documentBytes)} of files. One row is written per generation, so a report regenerated three times counts three times.`}
          />
        </div>
        {produced.byPerson.length > 0 ? (
          <Grid
            columns={[{ head: 'Generated by' }, { head: 'Documents', align: 'right' }, { head: 'Pages', align: 'right' }]}
            rows={produced.byPerson.map(r => [r.name, fmtInt(r.documents), fmtInt(r.pages)])}
            caption={
              <>
                This is the one part of the audit trail that names a person on the work itself: the
                document record keeps who generated it.
              </>
            }
          />
        ) : null}
      </>
    ),
  });

  /* ── Database queries ────────────────────────────────────────────────── */

  groups.push({
    id: 'queries',
    title: 'Queries against your own databases',
    answer: queries.total === 0
      ? `No connected database was queried ${p.phrase}.`
      : `${plural(queries.total, 'query', 'queries')} returning ${fmtInt(queries.rows)} rows, at a median of ${fmtLatency(queries.medianLatencyMs)}.`,
    body: queries.total === 0 ? (
      <Unmeasured>
        Nothing was queried against a connected database {p.phrase}.
      </Unmeasured>
    ) : (
      <>
        <Lede>
          <Working sum={`Every query the platform sends to a connected database writes an audit row carrying its row count, its latency and, on engines that report one, the bytes it scanned. Failed queries are written too, which is why ${fmtInt(queries.failures)} of these returned nothing.`}>
            <Num>{fmtInt(queries.total)}</Num>
          </Working>{' '}
          queries ran {p.phrase}, returning <Num>{fmtInt(queries.rows)}</Num> rows. The median took{' '}
          <Num>{fmtLatency(queries.medianLatencyMs)}</Num> and the slowest{' '}
          <Num>{fmtLatency(queries.slowestMs)}</Num>.
        </Lede>
        <Grid
          columns={[
            { head: 'Connection' },
            { head: 'Engine' },
            { head: 'Queries', align: 'right' },
            { head: 'Rows', align: 'right' },
            { head: 'Median', align: 'right' },
            { head: 'Scanned', align: 'right' },
          ]}
          rows={queries.lines.map(l => [
            l.name,
            l.engine,
            fmtInt(l.queries),
            fmtInt(l.rows),
            fmtLatency(l.medianLatencyMs),
            l.bytesScanned === null ? 'not reported' : fmtBytes(l.bytesScanned),
          ])}
          caption={
            <>
              {queries.enginesWithoutBytes.length > 0
                ? `${queries.enginesWithoutBytes.join(' and ')} do not report how much data a query scanned, so those rows read "not reported" rather than nought. `
                : ''}
              {plural(queries.failures, 'query', 'queries')} failed and{' '}
              {queries.failures === 1 ? 'is' : 'are'} still counted here: a query that timed out
              still ran against the database.
            </>
          }
        />
      </>
    ),
  });

  /* ── Imports ─────────────────────────────────────────────────────────── */

  groups.push({
    id: 'imports',
    title: 'What was imported',
    answer: imports.imports.length === 0
      ? `Nothing was imported ${p.phrase}.`
      : `${plural(imports.imports.length, 'import', 'imports')} carrying ${fmtInt(imports.rowsTotal)} rows, which became ${fmtInt(imports.controls)} controls.`,
    body: imports.imports.length === 0 ? (
      <Unmeasured>No risk and control matrix was imported {p.phrase}.</Unmeasured>
    ) : (
      <div className="max-w-xl">
        <Line
          label="Rows in the files"
          value={fmtInt(imports.rowsTotal)}
          sub={`${fmtInt(imports.rowsProcessed)} were processed. ${plural(imports.failed, 'import', 'imports')} failed part way, which is why those two figures differ.`}
        />
        <Line label="Risks created" value={fmtInt(imports.risks)} />
        <Line label="Controls created" value={fmtInt(imports.controls)} />
      </div>
    ),
  });

  /* ── The workspace ───────────────────────────────────────────────────── */

  groups.push({
    id: 'workspace',
    title: 'Who is on the workspace',
    answer: `${plural(workspace.active, 'active seat', 'active seats')}${workspace.suspended > 0 ? `, ${fmtInt(workspace.suspended)} suspended` : ''}.`,
    body: (
      <>
        <Grid
          columns={[{ head: 'Person' }, { head: 'Team' }, { head: 'Last signed in', align: 'right' }]}
          rows={workspace.lastLogins.map(r => [
            r.name,
            r.team,
            r.at === null ? 'never' : formatDate(r.at),
          ])}
          caption={
            <>
              One timestamp per person, overwritten on each sign in. There is no history behind it,
              so this page cannot say how often anybody signs in, and it never counts active users.
            </>
          }
        />
        {workspace.teams.length > 1 ? (
          <Grid
            columns={[{ head: 'Team' }, { head: 'Seats', align: 'right' }]}
            rows={workspace.teams.map(t => [t.team, fmtInt(t.seats)])}
          />
        ) : null}
        <Note>
          {plural(workspace.events.length, 'administration change', 'administration changes')} were
          recorded {p.phrase}: invitations, roles, team membership and account status. Those are the
          only actions the activity log carries, so nothing here counts a screen anybody opened.
        </Note>
      </>
    ),
  });

  /* ── The gaps ────────────────────────────────────────────────────────── */

  groups.push({
    id: 'gaps',
    title: 'What this page cannot tell you',
    answer: `${plural(GAPS.length, 'question', 'questions')} the record does not answer, named rather than left blank.`,
    body: (
      <>
        <Lede>
          Every figure above is read from a column. These are the questions people ask of a usage
          page that this one refuses, because answering them would mean inventing the number.
        </Lede>
        <Grid
          columns={[{ head: 'Question' }, { head: 'Why not' }]}
          rows={GAPS.map(g => [g.question, g.why])}
        />
        <Note>
          Each of these becomes answerable the day the platform writes the column. Until then a
          figure here would be a guess wearing a number's clothes.
        </Note>
        {NOW_RECORDED.length > 0 ? (
          <>
            <Lede>
              {plural(NOW_RECORDED.length, 'question', 'questions')} that used to be on that list, and
              are not any more. The platform writes the column now, so the page can read it.
            </Lede>
            <Grid
              columns={[{ head: 'Question' }, { head: 'What is recorded' }]}
              rows={NOW_RECORDED.map(g => [g.question, g.how])}
            />
          </>
        ) : null}
      </>
    ),
  });

  return (
    // The shell gives a view a fixed height and clips whatever overflows, so
    // the scroll belongs to the view. The measured column sits inside the
    // scroller rather than around it, so the scrollbar tracks the window edge.
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <header className="border-b border-canvas-border pb-5">
          <h1 className="text-[1.25rem] font-semibold text-ink-900">Platform Usage</h1>
          <p className="mt-1 text-[0.875rem] text-ink-500">
            {PERSONA_QUESTION[persona]}? Read for {scope.subject}, {p.label.toLowerCase()}.{' '}
            {dataAsOfLabel()}.
          </p>

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
              Window
              <select
                value={periodId}
                onChange={e => setPeriodId(e.target.value as PeriodId)}
                className="rounded border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.875rem] text-ink-800"
              >
                {periodOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div>
          {groups.map(spec => (
            <Group
              key={spec.id}
              spec={spec}
              open={open[spec.id] ?? false}
              onToggle={() => setOpen(o => ({ ...o, [spec.id]: !(o[spec.id] ?? false) }))}
            />
          ))}
        </div>

        <p className="mt-6 text-[0.75rem] leading-relaxed text-ink-400">
          This page reads and never writes. Nothing on it is estimated, modelled or priced: every
          figure is a count or a sum of something the platform records. Teams on this workspace:{' '}
          {TEAMS.join(', ')}.
        </p>
      </div>
    </div>
  );
}
