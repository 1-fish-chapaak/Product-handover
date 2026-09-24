import { monthRange, periodSide, presetRange } from './comparePresets';
import type { CompareConfig, CompareSide, Grain, PeriodSeries } from './compareTypes';

const GRAINS: Grain[] = ['day', 'week', 'month', 'quarter', 'year'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function validPeriods(x: unknown): PeriodSeries | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const p = x as Record<string, unknown>;
  const ok = typeof p.from === 'string' && ISO.test(p.from) && typeof p.to === 'string' && ISO.test(p.to)
    && typeof p.grain === 'string' && (GRAINS as string[]).includes(p.grain);
  return ok ? { from: p.from as string, to: p.to as string, grain: p.grain as Grain } : undefined;
}

// Per-dashboard persistence, beside `irame.dashboard.sync.<id>`.
export const COMPARE_STORAGE_PREFIX = 'irame.dashboard.compare.v1.';
export const compareStorageKey = (dashboardId: string): string => `${COMPARE_STORAGE_PREFIX}${dashboardId}`;

/** Off by default. When switched on with nothing chosen: this month vs last
 *  month, grouped bars — "this month" being the dashboard's data clock (the
 *  seed model runs in 2026; a workbook's clock is its last dated row). */
export function defaultCompareConfig(now: Date = new Date(), clock?: Date): CompareConfig {
  const anchor = clock ?? (now.getUTCFullYear() === 2026 ? now : new Date(Date.UTC(2026, 8, 15)));
  const a = presetRange('last-month', anchor);
  const b = presetRange('this-month', anchor);
  return { enabled: false, a: periodSide(a), b: periodSide(b), chartMode: 'side-by-side', polarity: {} };
}
export const DEFAULT_COMPARE_CONFIG: CompareConfig = defaultCompareConfig();

/** The demo pair every scenario starts from. */
export const MAY_VS_AUG: Pick<CompareConfig, 'a' | 'b'> = { a: periodSide(monthRange(2026, 5)), b: periodSide(monthRange(2026, 8)) };

export function isValidSide(x: unknown): x is CompareSide {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  if (s.kind === 'period') return typeof s.from === 'string' && typeof s.to === 'string' && typeof s.label === 'string';
  if (s.kind === 'entity') return typeof s.table === 'string' && typeof s.column === 'string' && (typeof s.value === 'string' || typeof s.value === 'number') && typeof s.label === 'string';
  return false;
}

export function loadCompareConfig(dashboardId: string, clock?: Date): CompareConfig {
  const base = defaultCompareConfig(new Date(), clock);
  try {
    const raw = localStorage.getItem(compareStorageKey(dashboardId));
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<CompareConfig>;
    return {
      ...base,
      enabled: !!p.enabled,
      a: isValidSide(p.a) ? p.a : base.a,
      b: isValidSide(p.b) ? p.b : base.b,
      chartMode: p.chartMode === 'overlay' ? 'overlay' : 'side-by-side',
      polarity: p.polarity && typeof p.polarity === 'object' ? p.polarity : {},
      normalizePerDay: !!p.normalizePerDay,
      seedOverrides: p.seedOverrides && typeof p.seedOverrides === 'object' ? p.seedOverrides : undefined,
      periods: validPeriods(p.periods),
    };
  } catch { return base; }
}

export function saveCompareConfig(dashboardId: string, cfg: CompareConfig): void {
  try { localStorage.setItem(compareStorageKey(dashboardId), JSON.stringify(cfg)); } catch { /* quota */ }
}
