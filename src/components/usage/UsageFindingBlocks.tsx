/**
 * PU-25, PU-29 and PU-30. What the assistant noticed, how long findings have
 * been sitting there, and whether they turned out to be real.
 *
 * Three things go wrong on blocks like these and all three are guarded here.
 *
 * Per-run and consolidated insights are never added together. A consolidated
 * insight is the assistant reading a whole engagement and saying one thing
 * about all of its runs, so a total would count the same observation twice.
 *
 * Ageing runs from the day a finding was first raised, not from the last time
 * the check ran. Open means nobody has dealt with it, not that the problem is
 * still there, and the label says so.
 *
 * The false-positive rate is divided by findings somebody has actually
 * classified. Divide by everything and a page with a large untouched backlog
 * reports a flattering rate; a rate of nought would read as perfection when it
 * really means nobody has checked.
 */

import {
  fmtInt, fmtPct, fmtOneDp, openLabel, plural,
  type AgeingFigures, type InsightFigures, type Period, type QualityFigures,
} from '../../data/platform-usage-metrics';
import { formatDate } from '../../data/platform-usage';
import { Bars, Block, DataTable, Drill, Empty, Fig, Fold, MadeList, MadeRow } from './usageKit';

/* ── PU-25 · AI insights ─────────────────────────────────────────────────── */

export function AiInsights({ insights, period }: { insights: InsightFigures; period: Period }) {
  if (insights.perRun === 0 && insights.consolidated === 0) {
    return (
      <Block id="insights" title="What the assistant noticed" lede={null}>
        <Empty
          kind="quiet"
          title={`The assistant wrote nothing up ${period.phrase}.`}
          detail="It writes an insight when it spots a pattern inside a check, and one per engagement when it reads a whole audit at once."
        />
      </Block>
    );
  }

  const perRun = insights.rows.filter(i => i.kind === 'per-run');
  const consolidated = insights.rows.filter(i => i.kind === 'consolidated');

  /*
   * The bars are split by kind, the way the block's own rule asks.
   *
   * One severity chart across both kinds put four bars adding to 38 under a
   * head that said 31, which reads as the head being wrong. It is not: a
   * consolidated insight summarises the per-run ones it was written over, so
   * the two kinds are never added. Splitting the chart is the only way to draw
   * this without printing a total the page refuses to stand behind.
   */
  const splitBySeverity = (rows: typeof insights.rows) => insights.bySeverity
    .map(row => ({ label: row.label, value: rows.filter(i => i.severity === row.label).length }))
    .filter(row => row.value > 0);

  const splitByCategory = (rows: typeof insights.rows) => insights.byCategory
    .map(row => ({ label: row.label, value: rows.filter(i => i.category === row.label).length }))
    .filter(row => row.value > 0);

  // A window can hold one kind and not the other, so the kind that is actually
  // there leads and the other one folds under it. Neither chart is ever drawn
  // over an empty set with a caption saying "the 0 written".
  const leadIsPerRun = perRun.length > 0;
  const leadRows = leadIsPerRun ? perRun : consolidated;
  const foldRows = leadIsPerRun ? consolidated : [];
  const leadSeverity = splitBySeverity(leadRows);
  const foldSeverity = splitBySeverity(foldRows);
  const leadCategory = splitByCategory(leadRows);

  const list = (rows: typeof insights.rows) => (
    <MadeList>
      {rows.map(insight => (
        <MadeRow
          key={insight.id}
          name={insight.title}
          madeBy={`${insight.severity} · ${insight.category}`}
          when={formatDate(insight.at)}
        />
      ))}
    </MadeList>
  );

  return (
    <Block
      id="insights"
      title="What the assistant noticed"
      code="AI-INSIGHTS"
      figure={fmtInt(insights.perRun)}
      context={<>written inside a single check, and {fmtInt(insights.consolidated)} across a whole engagement</>}
      hint="Two kinds, counted apart. A consolidated insight summarises the per-run ones, so adding them together would count the same observation twice."
      lede={
        <>
          The assistant wrote <Fig>{fmtInt(insights.perRun)}</Fig>{' '}
          {insights.perRun === 1 ? 'insight' : 'insights'} inside individual checks{' '}
          {period.phrase}, and <Fig>{fmtInt(insights.consolidated)}</Fig> more reading whole
          engagements at once.
        </>
      }
      chart={
        <div>
          <Bars
            rows={leadSeverity}
            caption={leadIsPerRun
              ? <>The {plural(insights.perRun, 'insight', 'insights')} written inside a single check, by severity.</>
              : <>The {plural(insights.consolidated, 'insight', 'insights')} written across a whole engagement, by severity.</>}
          />
          {leadCategory.length > 0 && (
            <Fold label="Split by category">
              <Bars rows={leadCategory} />
            </Fold>
          )}
          {foldSeverity.length > 0 && (
            <Fold label={`The ${plural(insights.consolidated, 'insight', 'insights')} written across a whole engagement`}>
              <Bars
                rows={foldSeverity}
                caption="Kept apart from the bars above. Each of these reads a whole engagement, so adding the two together would count the same observation twice."
              />
            </Fold>
          )}
        </div>
      }
      table={
        <DataTable
          head={['Split', 'Insights']}
          rows={[
            ...splitBySeverity(perRun).map(row => [`Inside one check · ${row.label} severity`, fmtInt(row.value)] as (string | number)[]),
            ...splitBySeverity(consolidated).map(row => [`Across an engagement · ${row.label} severity`, fmtInt(row.value)] as (string | number)[]),
            ...splitByCategory(perRun).map(row => [`Inside one check · ${row.label}`, fmtInt(row.value)] as (string | number)[]),
            ...(perRun.length === 0
              ? splitByCategory(consolidated).map(row => [`Across an engagement · ${row.label}`, fmtInt(row.value)] as (string | number)[])
              : []),
          ]}
        />
      }
    >
      <div className="mb-4 space-y-2">
        {/* Two lists rather than one, because one list would need one total. */}
        {perRun.length > 0 && (
          <Drill label={openLabel(perRun.length, 'written inside one check', 'written inside one check')}>
            {list(perRun)}
          </Drill>
        )}
        {consolidated.length > 0 && (
          <Drill label={openLabel(consolidated.length, 'written across an engagement', 'written across an engagement')}>
            {list(consolidated)}
          </Drill>
        )}
      </div>
    </Block>
  );
}

/* ── PU-29 · Findings ageing ─────────────────────────────────────────────── */

export function FindingsAgeing({
  ageing, subject, onOpenException,
}: {
  ageing: AgeingFigures;
  subject: string;
  onOpenException: (id: string) => void;
}) {
  if (ageing.open === 0) {
    return (
      <Block id="ageing" title="How long findings have been open" lede={null}>
        <Empty
          kind="quiet"
          title={`Nothing is open against ${subject}.`}
          detail="A finding stays open until a person resolves it, so an empty list here means every one of them has been dealt with."
        />
      </Block>
    );
  }

  return (
    <Block
      id="ageing"
      title="How long findings have been open"
      code="FIND-AGEING"
      figure={fmtInt(ageing.overThirty)}
      of={fmtInt(ageing.open)}
      tone={ageing.overThirty > 0 ? 'risk' : 'plain'}
      /* The caveat about the window belongs in the fold, not in the one line a
         reader gets for free. It was a 30 word disclaimer wrapped around a
         seven word fact, and the fact was the part being lost. */
      context="open more than 30 days, of everything still open today"
      hint="Age runs from the day a finding was first raised. A repeat occurrence never created a second row, so this really is how long it has been sitting there. This block ignores the window: it counts every finding nobody has closed, whenever it was raised, so it can be larger or smaller than the open figure in the block above."
      lede={
        ageing.overThirty > 0
          ? (
            <>
              <Fig>{fmtInt(ageing.overThirty)}</Fig>{' '}
              {ageing.overThirty === 1 ? 'finding has' : 'findings have'} been open more than 30 days,
              out of <Fig>{fmtInt(ageing.open)}</Fig> open in all. That count ignores the window: it
              is every finding nobody has closed, whenever it was raised, so it will not match the
              open figure in the block above.
            </>
          )
          : (
            <>
              All <Fig>{fmtInt(ageing.open)}</Fig> open{' '}
              {ageing.open === 1 ? 'finding is' : 'findings are'} less than a month old. That counts
              every finding nobody has closed, whenever it was raised, so it will not match the open
              figure in the block above.
            </>
          )
      }
      chart={
        <Bars
          rows={ageing.buckets.map(b => ({ label: b.label, value: b.value }))}
          tone="risk"
          caption={ageing.open === 1
            ? <>The one open finding, by age, whenever it was raised, so this ignores the window at the top of the page.</>
            : <>All {fmtInt(ageing.open)} open findings by age, whenever they were raised, so this ignores the window at the top of the page.</>}
        />
      }
      table={
        <DataTable
          head={['Age', 'Findings']}
          rows={ageing.buckets.map(b => [b.label, fmtInt(b.value)])}
        />
      }
      footer={
        <>
          Open means nobody has resolved it yet, not that the problem is still there.
          {ageing.excludedLegacy > 0 && (
            <>
              {' '}
              {fmtInt(ageing.excludedLegacy)}{' '}
              {ageing.excludedLegacy === 1 ? 'finding is' : 'findings are'} left out because they were
              raised before de-duplication shipped and nothing guarantees they are distinct.
            </>
          )}
        </>
      }
    >
      {ageing.oldest.length > 0 && (
        <div className="mb-4">
          <Drill label={openLabel(ageing.oldest.length, 'open more than 30 days', 'open more than 30 days')}>
            <MadeList>
              {ageing.oldest.map(ex => (
                <MadeRow
                  key={ex.id}
                  name={`${ex.ref} · ${ex.title}`}
                  madeBy={`${ex.severity} · owned by ${ex.assignee.name}`}
                  when={`raised ${formatDate(ex.detectedAt)}`}
                  note={`due ${formatDate(ex.dueAt)}`}
                  onOpen={() => onOpenException(ex.engagementId)}
                />
              ))}
            </MadeList>
          </Drill>
        </div>
      )}
    </Block>
  );
}

/* ── PU-30 · Finding quality ─────────────────────────────────────────────── */

export function FindingQuality({ quality, period }: { quality: QualityFigures; period: Period }) {
  if (quality.classified === 0) {
    return (
      <Block id="quality" title="Whether the findings were real" lede={null}>
        <Empty
          kind="quiet"
          title={`No finding has been classified ${period.phrase}.`}
          detail={
            quality.unclassified > 0
              ? `${fmtInt(quality.unclassified)} are waiting for a risk owner to call them. Until somebody does, there is no rate to show: nought per cent would read as perfection when it really means nobody has looked.`
              : 'A risk owner marks each finding as real or a false alarm, and the rate follows from that.'
          }
        />
      </Block>
    );
  }

  const split = [
    { label: 'Called real', value: quality.truePositives },
    { label: 'Called a false alarm', value: quality.falsePositives },
    { label: 'Nobody has looked yet', value: quality.unclassified },
  ];

  return (
    <Block
      id="quality"
      title="Whether the findings were real"
      code="FIND-QUALITY"
      figure={quality.falsePositiveRatePct !== null ? fmtPct(quality.falsePositiveRatePct) : '—'}
      context={quality.falsePositiveRatePct !== null
        ? <>of the {fmtInt(quality.classified)} a risk owner classified turned out to be the rule firing on something fine</>
        : <>nobody has classified a finding yet, so there is no rate</>}
      hint="The rate is out of findings somebody has actually classified. The ones nobody has looked at are shown as their own bar and never join the denominator."
      lede={
        <>
          <Fig>{fmtOneDp(quality.falsePositiveRatePct ?? 0)}%</Fig> of the{' '}
          <Fig>{fmtInt(quality.classified)}</Fig> findings a risk owner has classified{' '}
          {period.phrase} turned out to be the rule firing on something that was fine.
          {quality.unclassified > 0 && (
            <> Another <Fig>{fmtInt(quality.unclassified)}</Fig> have not been classified at all.</>
          )}
        </>
      }
      chart={
        <div>
          <Bars
            rows={split}
            caption={<>All {fmtInt(quality.classified + quality.unclassified)} findings raised {period.phrase}. The rate above is out of the {fmtInt(quality.classified)} somebody has classified, so the last bar is not in it.</>}
          />
          <Fold label="Why they happened, and why the rule fired anyway">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="text-[0.75rem] text-ink-500 mb-2">Why the real ones happened</p>
                {quality.byRootCause.length > 0
                  ? <Bars rows={quality.byRootCause} />
                  : <Empty kind="quiet" title="No root cause has been recorded yet." />}
              </div>
              <div>
                <p className="text-[0.75rem] text-ink-500 mb-2">Why the rule fired anyway</p>
                {quality.byFalsePositiveReason.length > 0
                  ? <Bars rows={quality.byFalsePositiveReason} tone="risk" />
                  : <Empty kind="quiet" title="No false alarm has been recorded in this window." />}
              </div>
            </div>
          </Fold>
        </div>
      }
      table={
        <DataTable
          head={['Verdict or cause', 'Findings']}
          rows={[
            ...split.map(r => [r.label, fmtInt(r.value)] as (string | number)[]),
            ...quality.byRootCause.map(r => [`Root cause: ${r.label}`, fmtInt(r.value)] as (string | number)[]),
            ...quality.byFalsePositiveReason.map(r => [`False alarm: ${r.label}`, fmtInt(r.value)] as (string | number)[]),
          ]}
        />
      }
      footer="A rising false-alarm rate means a control's rule wants tuning. It does not mean the team is failing."
    />
  );
}
