/**
 * ── Materiality benchmarks, read off the trial balance (agentic UX #8) ──────
 * The review found the TB uploaded and then ignored: picking "% of revenue"
 * filled a fixed ₹5,240 Cr whatever the file said. Ira now adds the figure up
 * from the file's own captions and shows which ones went in, and which were
 * left out and why. It never writes the number — the auditor presses Use.
 *
 * The parser keeps each caption at its gross size (`Math.abs`), so the sign of
 * a line is gone; what a caption IS is read off its name instead, the way an
 * auditor reads a bare trial balance. Captions are summed across every company
 * in the file, before any intercompany elimination — the working says so.
 */
import type { MaterialityBasis, TbCaption } from './soxTestingData';

type Kind = 'revenue' | 'otherIncome' | 'expense' | 'asset' | 'equity' | 'other';

function kindOf(caption: string): Kind {
  const c = caption.toLowerCase();
  if (/other income|interest income|dividend income|non[- ]operating income/.test(c)) return 'otherIncome';
  if (/revenue|sales|turnover/.test(c)) return 'revenue';
  if (/equity|reserves?\b|share capital|retained earnings/.test(c)) return 'equity';
  if (/expense|cost|depreciat|amortis|amortiz|purchases|wages|salar/.test(c)) return 'expense';
  if (/property|plant|equipment|capital work|investment|receivable|cash|bank|current assets?|inventor|intangible|goodwill|deposit|prepaid|right[- ]of[- ]use|advances?\b/.test(c)) return 'asset';
  return 'other';
}

export interface WorkingLine { caption: string; amount: number; sign: '+' | '−' }
export interface BenchmarkWorking {
  amount: number;
  lines: WorkingLine[];
  /** Captions a reader might expect in, and why they are not. */
  leftOut: { caption: string; amount: number; why: string }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One figure per basis Ira could work out, or nothing for that basis. */
export function benchmarksFromTb(captions: TbCaption[]): Partial<Record<MaterialityBasis, BenchmarkWorking>> {
  // Same caption across companies is one line of the working.
  const by = new Map<string, number>();
  for (const c of captions) by.set(c.caption, (by.get(c.caption) ?? 0) + c.balance);
  const rows = [...by.entries()].map(([caption, amount]) => ({ caption, amount: r2(amount), kind: kindOf(caption) }));
  const of = (k: Kind) => rows.filter(r => r.kind === k);
  const sum = (xs: { amount: number }[]) => r2(xs.reduce((a, x) => a + x.amount, 0));
  const plus = (xs: { caption: string; amount: number }[]): WorkingLine[] => xs.map(x => ({ caption: x.caption, amount: x.amount, sign: '+' }));
  const minus = (xs: { caption: string; amount: number }[]): WorkingLine[] => xs.map(x => ({ caption: x.caption, amount: x.amount, sign: '−' }));

  const revenue = of('revenue');
  const other = of('otherIncome');
  const expense = of('expense');
  const asset = of('asset');
  const equity = of('equity');
  const out: Partial<Record<MaterialityBasis, BenchmarkWorking>> = {};

  if (revenue.length) {
    out.revenue = {
      amount: sum(revenue), lines: plus(revenue),
      leftOut: other.map(o => ({ caption: o.caption, amount: o.amount, why: 'not earned from operations' })),
    };
  }
  if (expense.length) out.expenses = { amount: sum(expense), lines: plus(expense), leftOut: [] };
  if (revenue.length && expense.length) {
    const pbt = r2(sum(revenue) + sum(other) - sum(expense));
    // A loss is not a base to take a percentage of — say so rather than offer it.
    if (pbt > 0) out.pbt = { amount: pbt, lines: [...plus(revenue), ...plus(other), ...minus(expense)], leftOut: [] };
  }
  if (asset.length) out.assets = { amount: sum(asset), lines: plus(asset), leftOut: [] };
  if (equity.length) out.netAssets = { amount: sum(equity), lines: plus(equity), leftOut: [] };
  return out;
}
