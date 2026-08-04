import { assessSeverity, conclusionOf } from './helpers';
import { auditCovers } from './auditScope';
import type { AuditRecord, AuditRound, Conclusion, Control, Deficiency, IcfrEngagement, Severity } from './types';

/**
 * The engagement's audit portfolio — everything the engagement-level Overview
 * reads, in one place.
 *
 * The split this module encodes: an AUDIT knows how one cycle is going; the
 * ENGAGEMENT has to know where this entity's ICFR stands across every cycle. The
 * second question is only answerable above an audit, which is why these
 * selectors live apart from the audit-scoped `useAuditControls`.
 *
 * Live vs archived. Exactly one audit at a time holds live results — they sit on
 * the controls themselves. Every other audit carries an `archive` snapshot taken
 * when the next cycle started. Each selector below states which side it reads, so
 * nobody double-counts a deficiency by reading both.
 */

// ── Round windows ────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * What a round actually covers, as real dates.
 *
 * Splits the cycle three ways so that a missing round leaves a visible hole in
 * the coverage timeline rather than a silently shorter bar. A financial year runs
 * Apr–Mar, so its interim sits in the PRIOR calendar year and only the year-end
 * round falls in the naming year; a calendar year is the simpler case.
 *
 * `year` is the year the cycle ENDS on, matching AuditRecord.fiscalYear.
 */
export function roundWindow(basis: 'fy' | 'cy', year: number, round: AuditRound): { from: string; to: string; label: string } {
  if (basis === 'fy') {
    const s = year - 1;
    if (round === 'interim') return { from: iso(s, 4, 1), to: iso(s, 9, 30), label: `Apr – Sep ${s}` };
    if (round === 'rollforward') return { from: iso(s, 10, 1), to: iso(s, 12, 31), label: `Oct – Dec ${s}` };
    return { from: iso(year, 1, 1), to: iso(year, 3, 31), label: `Jan – Mar ${year}` };
  }
  if (round === 'interim') return { from: iso(year, 1, 1), to: iso(year, 6, 30), label: `Jan – Jun ${year}` };
  if (round === 'rollforward') return { from: iso(year, 7, 1), to: iso(year, 9, 30), label: `Jul – Sep ${year}` };
  return { from: iso(year, 10, 1), to: iso(year, 12, 31), label: `Oct – Dec ${year}` };
}

/** The twelve months of a cycle, in the order they run — the timeline's x-axis. */
export function cycleMonths(basis: 'fy' | 'cy', year: number): { label: string; key: string }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = basis === 'fy' ? (i + 3) % 12 : i;          // fy starts at Apr (index 3)
    const y = basis === 'fy' ? (m >= 3 ? year - 1 : year) : year;
    return { label: MONTHS[m]!, key: `${y}-${String(m + 1).padStart(2, '0')}` };
  });
}

/** Which of those twelve slots an audit occupies — [start, count]. */
export function windowSlots(a: AuditRecord): { start: number; span: number } {
  // Quarter / custom audits never reach here — auditsByYear below only groups
  // fy/cy audits into the portfolio this is read from — but the type is wider
  // than that guarantee, so fall back to 'fy' rather than assert.
  const months = cycleMonths(a.yearBasis === 'cy' ? 'cy' : 'fy', a.fiscalYear).map(m => m.key);
  const from = a.windowFrom.slice(0, 7);
  const to = a.windowTo.slice(0, 7);
  const start = Math.max(0, months.indexOf(from));
  const end = months.indexOf(to);
  return { start, span: Math.max(1, (end < 0 ? months.length - 1 : end) - start + 1) };
}

/** Months of a cycle no audit covers — what roll-forward planning is driven by. */
export function uncoveredMonths(audits: AuditRecord[], basis: 'fy' | 'cy', year: number): string[] {
  const months = cycleMonths(basis, year);
  const covered = new Set<string>();
  audits.forEach(a => {
    const { start, span } = windowSlots(a);
    for (let i = start; i < start + span && i < months.length; i += 1) covered.add(months[i]!.key);
  });
  return months.filter(m => !covered.has(m.key)).map(m => m.label);
}

// ── Status ───────────────────────────────────────────────────────────────────

export type AuditStatus = 'planned' | 'active' | 'concluded';

/**
 * Which audit owns the live results.
 *
 * There is exactly one, and it is the newest unarchived record: creating an audit
 * prepends it and archives whatever was live. Everything else unarchived is
 * planned — a round that hasn't run. This matters because two audits can cover
 * the same controls, and without this the planned round would read the live
 * cycle's numbers as its own.
 */
export const liveAuditId = (eng: IcfrEngagement): string | undefined => eng.audits.find(a => !a.archive)?.id;
export const isLiveAudit = (a: AuditRecord, eng: IcfrEngagement) => a.id === liveAuditId(eng);

/**
 * Derived, never stored: a stored status goes stale the moment somebody tests a
 * control. Concluded means signed and countersigned, or archived. Of the rest,
 * only the live audit can be active, and only once something it covers has
 * actually been tested.
 */
export function auditStatus(a: AuditRecord, eng: IcfrEngagement): AuditStatus {
  if (a.archive || (a.signoff?.preparer && a.signoff?.reviewer)) return 'concluded';
  if (!isLiveAudit(a, eng)) return 'planned';
  const covered = eng.controls.filter(c => auditCovers(a, c, eng.id));
  return covered.some(c => conclusionOf(eng, c) !== 'Not started') ? 'active' : 'planned';
}

// ── Grouping ─────────────────────────────────────────────────────────────────

const ROUND_ORDER: Record<AuditRound, number> = { interim: 0, rollforward: 1, yearend: 2 };

/** Newest fiscal year first, and within a year the rounds in the order they run. */
export function auditsByYear(eng: IcfrEngagement): { year: number; basis: 'fy' | 'cy'; audits: AuditRecord[] }[] {
  const years = new Map<number, AuditRecord[]>();
  eng.audits.forEach(a => {
    // Quarter and custom audits are one-off checks, not a round of a named
    // annual cycle — grouping one into a fiscal year here would place it on a
    // 12-month coverage timeline built for a cycle it was never scoped against.
    if (a.yearBasis !== 'fy' && a.yearBasis !== 'cy') return;
    if (!years.has(a.fiscalYear)) years.set(a.fiscalYear, []);
    years.get(a.fiscalYear)!.push(a);
  });
  return Array.from(years, ([year, audits]) => ({
    year,
    basis: audits[0]!.yearBasis as 'fy' | 'cy',
    audits: audits.slice().sort((x, y) => ROUND_ORDER[x.round] - ROUND_ORDER[y.round]),
  })).sort((x, y) => y.year - x.year);
}

// ── Per-audit read-out ───────────────────────────────────────────────────────

export interface AuditProgress { total: number; effective: number; ineffective: number; concluded: number }

/** How far an audit got, off its archive when it has one and off the live
 *  controls when it is the current cycle. */
export function auditProgress(a: AuditRecord, eng: IcfrEngagement): AuditProgress {
  if (a.archive) {
    const rows = a.archive.conclusions;
    return {
      total: rows.length,
      effective: rows.filter(r => r.conclusion === 'Effective').length,
      ineffective: rows.filter(r => r.conclusion === 'Ineffective').length,
      concluded: rows.filter(r => r.conclusion === 'Effective' || r.conclusion === 'Ineffective').length,
    };
  }
  const covered = eng.controls.filter(c => auditCovers(a, c, eng.id));
  // A planned round has not run. Its scope is real, so the total counts, but the
  // live cycle's conclusions are not its results and must not be shown as them.
  if (!isLiveAudit(a, eng)) return { total: covered.length, effective: 0, ineffective: 0, concluded: 0 };
  const concl = covered.map(c => conclusionOf(eng, c));
  return {
    total: covered.length,
    effective: concl.filter(x => x === 'Effective').length,
    ineffective: concl.filter(x => x === 'Ineffective').length,
    concluded: concl.filter(x => x === 'Effective' || x === 'Ineffective').length,
  };
}

/** An audit's deficiencies with severity resolved — archived ones carry theirs. */
export function auditDeficiencies(a: AuditRecord, eng: IcfrEngagement): (Deficiency & { severity: Severity })[] {
  if (a.archive) return a.archive.deficiencies;
  // Same reason as auditProgress: a planned round has raised nothing.
  if (!isLiveAudit(a, eng)) return [];
  const covered = new Set(eng.controls.filter(c => auditCovers(a, c, eng.id)).map(c => c.id));
  return eng.deficiencies
    .filter(d => covered.has(d.controlId))
    .map(d => ({ ...d, severity: assessSeverity(d, eng).final }));
}

// ── Cross-audit ──────────────────────────────────────────────────────────────

export type SeverityCount = Record<Severity, number>;
const emptyCount = (): SeverityCount => ({ 'Material Weakness': 0, 'Significant Deficiency': 0, Deficiency: 0 });

/**
 * Deficiencies by severity across every audit of one fiscal year.
 *
 * The reason this can only exist here: aggregation does not respect a process
 * boundary. Two parallel audits can each raise a small deficiency against the
 * same account and assertion, and neither audit can see the other's — only the
 * engagement can add them up.
 */
export function yearSeverityRollup(eng: IcfrEngagement, audits: AuditRecord[]): {
  counts: SeverityCount; open: number; total: number; mwOpen: number;
} {
  const counts = emptyCount();
  let open = 0; let total = 0; let mwOpen = 0;
  audits.forEach(a => {
    auditDeficiencies(a, eng).forEach(d => {
      counts[d.severity] += 1;
      total += 1;
      if (d.status !== 'Closed') { open += 1; if (d.severity === 'Material Weakness') mwOpen += 1; }
    });
  });
  return { counts, open, total, mwOpen };
}

/** Open material weaknesses anywhere on the engagement, with the audit that
 *  raised each one. One of these puts the whole entity's conclusion at risk, so
 *  it belongs above any single audit. */
export function mwWatchlist(eng: IcfrEngagement): { audit: AuditRecord; deficiency: Deficiency & { severity: Severity } }[] {
  return eng.audits.flatMap(a => auditDeficiencies(a, eng)
    .filter(d => d.severity === 'Material Weakness' && d.status !== 'Closed')
    .map(deficiency => ({ audit: a, deficiency })));
}

/**
 * Aggregation groups where more than one audit of the same year contributed.
 *
 * These are the ones a single audit cannot evaluate correctly: individually
 * immaterial, material once combined.
 */
export function crossAuditAggregation(eng: IcfrEngagement, audits: AuditRecord[]): {
  group: string; audits: string[]; count: number; combined: number;
}[] {
  const groups = new Map<string, { audits: Set<string>; count: number; combined: number }>();
  audits.forEach(a => {
    auditDeficiencies(a, eng).forEach(d => {
      const key = d.aggregationGroup ?? 'Ungrouped';
      if (!groups.has(key)) groups.set(key, { audits: new Set(), count: 0, combined: 0 });
      const g = groups.get(key)!;
      g.audits.add(`${a.period} · ${a.round}`);
      g.count += 1;
      g.combined += d.magnitude;
    });
  });
  return Array.from(groups, ([group, g]) => ({ group, audits: Array.from(g.audits), count: g.count, combined: g.combined }))
    .filter(g => g.audits.length > 1)
    .sort((x, y) => y.combined - x.combined);
}

/** Controls that more than one audit covers — test once, rely many. Two audits
 *  testing the same control is duplicated effort worth seeing. */
export function controlsInManyAudits(eng: IcfrEngagement): { control: Control; audits: AuditRecord[] }[] {
  return eng.controls
    .map(control => ({ control, audits: eng.audits.filter(a => auditCovers(a, control, eng.id)) }))
    .filter(x => x.audits.length > 1);
}

/**
 * Do this year's audits measure against the same ruler?
 *
 * One opinion needs one materiality. Two audits of the same entity and year with
 * different thresholds is a silent correctness bug — a deficiency judged
 * immaterial by one would be material to the other, and nothing in either audit
 * would say so.
 */
export function materialityConsistency(audits: AuditRecord[]): { consistent: boolean; values: number[] } {
  const values = Array.from(new Set(audits.map(a => a.overall))).sort((a, b) => a - b);
  return { consistent: values.length <= 1, values };
}

/**
 * Deficiencies raised in a prior year and where they got to.
 *
 * Next year's audit starts here: an unverified prior-year deficiency is a
 * standing question, not history.
 */
export function priorYearDeficiencies(eng: IcfrEngagement, currentYear: number): {
  audit: AuditRecord; deficiency: Deficiency & { severity: Severity }; verified: boolean;
}[] {
  return eng.audits
    .filter(a => a.fiscalYear < currentYear)
    .flatMap(a => auditDeficiencies(a, eng).map(deficiency => ({
      audit: a,
      deficiency,
      // Retested and passed, or signed off as closed — anything else is open.
      verified: deficiency.retest?.result === 'Pass' || deficiency.status === 'Closed',
    })));
}
