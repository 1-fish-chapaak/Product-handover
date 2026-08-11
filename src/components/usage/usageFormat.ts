/** Dates as this page says them, kept out of the metric layer. */
import { formatDate } from '../../data/platform-usage';

export { fmtDuration, fmtHours, fmtInt, fmtMoney, fmtPct, fmtPeople, fmtUsd, plural } from '../../data/platform-usage-metrics';

/** "12 Apr 2026" — the one date format the page uses, everywhere. */
export const formatWhen = (ms: number): string => formatDate(ms);
