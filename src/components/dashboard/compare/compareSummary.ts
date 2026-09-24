import { formatPct, formatSigned, formatValue } from './compareEngine';
import type { CompareResult, CompareSide, CompareSummary, CompareTone, DeltaStat } from './compareTypes';

// "What changed" — a deterministic reading of a CompareResult. Every number in
// the text comes from the result; the words only interpret direction against
// the metric's polarity.

const VERB: Record<CompareTone, string> = { good: 'improved', bad: 'worsened', neutral: 'changed' };

/** "Sum of Invoice Amount (₹)" → "Invoice Amount" */
export function plainSeries(label: string): string {
  return label.replace(/^(Sum|Average|Count|Distinct|Min|Max) of /, '').replace(/\s*\(₹\)\s*$/, '').trim();
}

function movement(series: string, stat: DeltaStat, a: CompareSide, b: CompareSide): string {
  const name = plainSeries(series);
  if (stat.a === 0 && stat.b === 0) return `${name} was zero in both ${a.label} and ${b.label}.`;
  if (stat.a === 0) return `${name} appeared in ${b.label} at ${formatValue(stat.b, series)} — nothing in ${a.label}.`;
  if (stat.delta === 0) return `${name} held at ${formatValue(stat.a, series)} in both ${a.label} and ${b.label}.`;
  return `${name} moved from ${formatValue(stat.a, series)} in ${a.label} to ${formatValue(stat.b, series)} in ${b.label} (${formatPct(stat.pct, stat.a)}) — ${VERB[stat.tone]}.`;
}

export function summarizeCompare(result: CompareResult, ctx: { a: CompareSide; b: CompareSide; xLabel: string; title?: string }): CompareSummary {
  const { a, b } = ctx;
  const [first, ...rest] = result.series;
  const bullets: string[] = [];
  const caveats: string[] = [];

  if (!first) return { headline: 'Nothing to compare — this widget has no measure.', bullets, caveats };
  const headline = movement(first, result.kpi[first], a, b);
  rest.forEach(s => bullets.push(movement(s, result.kpi[s], a, b)));

  // Biggest movers across the rows (skip a single positional pair — it is the headline).
  const rows = result.merged.filter(r => r.presentIn === 'both' || result.alignBy === 'label');
  if (rows.length >= 2) {
    const sorted = [...rows].sort((x, y) => Math.abs(y.values[first].delta) - Math.abs(x.values[first].delta));
    const top = sorted[0];
    const topStat = top.values[first];
    if (topStat.delta !== 0) {
      const dir = topStat.delta > 0 ? 'rose' : 'fell';
      const qual = topStat.tone === 'bad' ? 'Largest deterioration' : topStat.tone === 'good' ? 'Largest improvement' : 'Largest move';
      bullets.push(`${qual}: ${top.label} — ${plainSeries(first)} ${dir} ${formatSigned(topStat.delta, first).replace(/^[+−]/, '')} (${formatPct(topStat.pct, topStat.a)}).`);
      const opposite = sorted.find(r => Math.sign(r.values[first].delta) === -Math.sign(topStat.delta));
      if (opposite) {
        const os = opposite.values[first];
        bullets.push(`Moving the other way: ${opposite.label} — ${plainSeries(first)} ${os.delta > 0 ? 'rose' : 'fell'} ${formatSigned(os.delta, first).replace(/^[+−]/, '')} (${formatPct(os.pct, os.a)}).`);
      }
      const total = rows.reduce((acc, r) => acc + Math.abs(r.values[first].delta), 0);
      const share = total > 0 ? Math.abs(topStat.delta) / total : 0;
      if (share >= 0.4 && rows.length >= 3) bullets.push(`${top.label} accounts for ${Math.round(share * 100)}% of the total movement in ${plainSeries(first)}.`);
    }
    const up = rows.filter(r => r.values[first].delta > 0).length, down = rows.filter(r => r.values[first].delta < 0).length;
    if (up && down) bullets.push(`${up} ${ctx.xLabel.toLowerCase()} value${up === 1 ? '' : 's'} rose while ${down} fell.`);
  }

  result.caveats.forEach(c => {
    switch (c.kind) {
      case 'range-length': caveats.push(`${a.label} spans ${c.aDays} days and ${b.label} spans ${c.bDays} — totals are not like-for-like.`); break;
      case 'suppressed-filter': caveats.push(`The ${c.label} filter is paused while comparing.`); break;
      case 'no-data': caveats.push(`No rows fall in ${c.side === 'a' ? a.label : b.label} for this widget.`); break;
      case 'no-date-column': caveats.push('This widget has no date column to place a period on.'); break;
      case 'entity-dimension-on-axis': caveats.push('The compared dimension is also this chart’s axis, so each side is a single bar.'); break;
      case 'empty-periods': break;
    }
  });

  return { headline, bullets: bullets.slice(0, 4), caveats };
}
