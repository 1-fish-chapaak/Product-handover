import { formatPct, formatSigned, formatValue } from './compareEngine';
import { plainSeries } from './compareSummary';
import type { CompareSummary, CompareTone, SeriesCompareResult } from './compareTypes';

// "What changed" across three periods or more. Same rule as the two-sided
// summary: every number comes from the result, the words only read direction
// against the metric's polarity.

const VERB: Record<CompareTone, string> = { good: 'improved', bad: 'worsened', neutral: 'changed' };

export function summarizeSeries(result: SeriesCompareResult, ctx: { title?: string } = {}): CompareSummary {
  void ctx;
  const bullets: string[] = [];
  const caveats: string[] = [];
  const first = result.series[0];
  const sides = result.sides;
  if (!first || sides.length < 2) return { headline: 'Nothing to compare — this widget has no measure.', bullets, caveats };

  const name = plainSeries(first);
  const totals = result.totals[first] ?? [];
  const span = result.span[first];
  const headline = span.a === 0 && span.b === 0
    ? `${name} was zero across all ${sides.length} ${sides.length === 1 ? 'period' : 'periods'}.`
    : `${name} moved from ${formatValue(span.a, first)} in ${sides[0].label} to ${formatValue(span.b, first)} in ${sides[sides.length - 1].label} (${formatPct(span.pct, span.a)}) — ${VERB[span.tone]}.`;

  // Best and worst period on the measure itself.
  const ranked = totals.map((v, i) => ({ v, i })).sort((x, y) => y.v - x.v);
  if (ranked.length >= 2 && ranked[0].v !== ranked[ranked.length - 1].v) {
    const hi = ranked[0], lo = ranked[ranked.length - 1];
    bullets.push(`Highest ${sides[hi.i].label} at ${formatValue(hi.v, first)}; lowest ${sides[lo.i].label} at ${formatValue(lo.v, first)}.`);
  }

  // The single biggest step between neighbouring periods.
  const steps = result.steps[first] ?? [];
  const biggest = steps.reduce<{ i: number; abs: number } | null>((acc, s, i) => (s && Math.abs(s.delta) > (acc?.abs ?? 0) ? { i, abs: Math.abs(s.delta) } : acc), null);
  if (biggest) {
    const s = steps[biggest.i]!;
    const qual = s.tone === 'bad' ? 'Sharpest deterioration' : s.tone === 'good' ? 'Sharpest improvement' : 'Sharpest move';
    bullets.push(`${qual}: ${sides[biggest.i - 1].label} → ${sides[biggest.i].label}, ${s.delta > 0 ? 'up' : 'down'} ${formatSigned(s.delta, first).replace(/^[+−]/, '')} (${formatPct(s.pct, s.a)}).`);
  }
  const up = steps.filter(s => s && s.delta > 0).length, down = steps.filter(s => s && s.delta < 0).length;
  if (up + down > 0) bullets.push(`${name} rose in ${up} of ${up + down} step${up + down === 1 ? '' : 's'} and fell in ${down}.`);

  // Biggest mover among the categories, when the widget keeps its own axis.
  if (result.axis === 'category' && result.rows.length >= 2) {
    const sorted = [...result.rows].sort((x, y) => Math.abs(y.span[first]?.delta ?? 0) - Math.abs(x.span[first]?.delta ?? 0));
    const top = sorted[0]?.span[first];
    if (top && top.delta !== 0) {
      bullets.push(`Biggest mover across the span: ${sorted[0].label} — ${top.delta > 0 ? 'up' : 'down'} ${formatSigned(top.delta, first).replace(/^[+−]/, '')} (${formatPct(top.pct, top.a)}).`);
    }
  }

  result.caveats.forEach(c => {
    switch (c.kind) {
      case 'range-length': caveats.push(`The periods are not all the same length (${c.aDays}–${c.bDays} days), so totals are not strictly like-for-like.`); break;
      case 'suppressed-filter': caveats.push(`The ${c.label} filter is paused while comparing.`); break;
      case 'no-data': caveats.push('No rows fall in any of these periods for this widget.'); break;
      case 'no-date-column': caveats.push('This widget has no date column to place a period on.'); break;
      case 'entity-dimension-on-axis': break;
      case 'empty-periods': {
        const shown = c.labels.slice(0, 4).join(', ');
        caveats.push(`${c.labels.length} of ${c.of} periods have no rows at all (${shown}${c.labels.length > 4 ? ' …' : ''}) — the source has no data there.`);
        break;
      }
    }
  });

  return { headline, bullets: bullets.slice(0, 4), caveats };
}
