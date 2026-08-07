// ─── Escalation Matrix: model + schedule engine ───
// A per-report configuration that governs the automated mailer cadence for every
// open exception / action item inside an observation. The user sets this up once
// (Step 2 of the upload flow) and it then drives reminders + escalations off each
// item's due date. Everything here is pure + deterministic — no side effects, no
// real mail — so the same engine powers the live preview and the per-observation
// timeline shown on the ATR.
//
// Default preset mirrors the requirement screenshot:
//   • Initial trigger mail 1 day before due date (now a flexible list — add
//     7-day / 3-day / on-due triggers as needed)
//   • Reminders: R1 at Due+2, R2 at R1+2, R3 at R2+2 (or switch to continuous
//     daily reminders until the exception is handled)
//   • Escalations: Esc-1 at R3+2, Esc-2 at Esc-1+2, Esc-3 at Esc-2+2 — each rung
//     cc'ing specific named recipients picked from the employee directory
//   • Recurring escalation every alternate day to the Esc-3 list, incrementing
//     the escalation number, until status is updated
//   • Mailers on weekdays only; only to active employees

// ─── recipient directory (mock) ───
// Named people the user picks per escalation rung, each with a clear position.
export interface EscalationEmployee {
  id: string;
  name: string;
  position: string;
  active: boolean;
}

export const ESCALATION_EMPLOYEES: EscalationEmployee[] = [
  { id: 'emp-rm',  name: 'Rahul Verma',    position: 'Reporting Manager',        active: true },
  { id: 'emp-mgr', name: 'Anjali Sharma',  position: 'Department Manager',       active: true },
  { id: 'emp-fh',  name: 'Karan Mehta',    position: 'Functional Head',          active: true },
  { id: 'emp-hia', name: 'Deepak Bansal',  position: 'Head of Internal Audit',   active: true },
  { id: 'emp-cro', name: 'Meera Iyer',     position: 'Chief Risk Officer',       active: true },
  { id: 'emp-cfo', name: 'Sanjay Kapoor',  position: 'Chief Financial Officer',  active: true },
];

export const employeeById = (id: string): EscalationEmployee | undefined =>
  ESCALATION_EMPLOYEES.find(e => e.id === id);

/** "Rahul Verma (Reporting Manager), Anjali Sharma (Department Manager)". */
export function ccLabel(cc: string[]): string {
  if (!cc.length) return 'Assignee only';
  return cc.map(id => { const e = employeeById(id); return e ? `${e.name} (${e.position})` : id; }).join(', ');
}

/** "Anjali Sharma + Deepak Bansal" — names only, for notes. */
export function ccNames(cc: string[]): string {
  if (!cc.length) return 'the assignee';
  return cc.map(id => employeeById(id)?.name ?? id).join(' + ');
}

/** One escalation rung — an offset (from the previous rung) plus its recipients. */
export interface EscalationRung {
  /** Days after the anchor this rung fires (Esc-1 anchors on the last reminder;
   *  Esc-2.. anchor on the previous escalation). */
  offsetDays: number;
  /** Employee ids cc'd at this rung (beyond the assignee on the To line). */
  cc: string[];
}

/** The recurring "chase forever" rung that runs after the last configured
 *  escalation, until the item's status is updated. */
export interface RecurringEscalation {
  enabled: boolean;
  /** Cadence in days (2 = every alternate day). */
  everyDays: number;
  cc: string[];
  /** Copy-only flag — the recurrence stops when the item status changes. */
  untilStatusUpdated: boolean;
}

/** The full, user-editable escalation configuration for a report. */
export interface EscalationMatrixConfig {
  /** Master switch — off = no mailers for this report. */
  enabled: boolean;
  /** Heads-up mails BEFORE the due date, as a list of "days before" offsets.
   *  0 means "on the due date". e.g. [7, 3, 1] → three heads-ups. */
  initialTriggers: number[];
  /** When true, ignore the staged reminder cadence and send a reminder every day
   *  until the exception is handled. */
  reminderDaily: boolean;
  /** Staged reminder cadence (used when reminderDaily is false). reminders[0] is
   *  measured from the due date; each later entry from the previous reminder. */
  reminders: number[];
  /** Escalation cadence. escalations[0] is measured from the last reminder;
   *  each later entry from the previous escalation. */
  escalations: EscalationRung[];
  recurring: RecurringEscalation;
  /** Skip weekends — a mailer landing on Sat/Sun rolls forward to Monday. */
  weekdaysOnly: boolean;
  /** Suppress mailers to deactivated employees. */
  activeEmployeesOnly: boolean;
}

/**
 * The screenshot preset — the editable starting point every new report gets.
 *
 * Off by default. Turning this on sends reminder and escalation mail to named
 * people and their managers, so it is a decision the auditor makes on purpose
 * rather than something that starts running because they uploaded a file. The
 * cadence below is the preset it starts from once they do switch it on.
 */
export const DEFAULT_ESCALATION_MATRIX: EscalationMatrixConfig = {
  enabled: false,
  initialTriggers: [1],
  reminderDaily: false,
  reminders: [2, 2, 2],
  escalations: [
    { offsetDays: 2, cc: ['emp-rm'] },                  // Esc-1 at R3+2 — Reporting Manager
    { offsetDays: 2, cc: ['emp-rm'] },                  // Esc-2 same recipients
    { offsetDays: 2, cc: ['emp-mgr', 'emp-hia'] },      // Esc-3 — Manager + Head of Internal Audit
  ],
  recurring: {
    enabled: true,
    everyDays: 2,
    cc: ['emp-mgr', 'emp-hia'],                         // Esc-3 recipient list
    untilStatusUpdated: true,
  },
  weekdaysOnly: true,
  activeEmployeesOnly: true,
};

/** Deep clone of the default — hand this to fresh state so edits never mutate
 *  the shared preset object. */
export const cloneDefaultMatrix = (): EscalationMatrixConfig =>
  JSON.parse(JSON.stringify(DEFAULT_ESCALATION_MATRIX));

// ─── date helpers ───

const DAY_MS = 86_400_000;

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Roll a weekend date forward to the next Monday (Sat +2, Sun +1). */
function rollToWeekday(d: Date): Date {
  if (d.getDay() === 6) return addDays(d, 2);
  if (d.getDay() === 0) return addDays(d, 1);
  return d;
}

/** Parse a due date that may be ISO ("2026-06-30") or "DD Mon YYYY"
 *  ("30 Jun 2026"). Returns null when it can't be read. */
export function parseDueDate(v?: string | null): Date | null {
  if (!v) return null;
  const s = v.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export const fmtDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// ─── schedule engine ───

export type EscalationKind = 'initial' | 'reminder' | 'escalation' | 'recurring';

export interface EscalationEvent {
  /** 1-based ordinal across the whole schedule (for stable keys). */
  seq: number;
  kind: EscalationKind;
  /** Short code — 'T-7', 'On due', 'R1', 'Esc-1', 'Esc-4' (recurring keeps counting). */
  code: string;
  /** Human title — 'Heads-up (7d before)', 'Reminder 1', 'Escalation 1'. */
  title: string;
  /** The (weekday-adjusted) date the mailer fires. */
  date: Date;
  /** True when the raw date landed on a weekend and was rolled to Monday. */
  rolledFromWeekend: boolean;
  /** Employee ids cc'd (empty = assignee only). */
  cc: string[];
}

/** How many recurring rungs to materialise for preview/tracking (the real thing
 *  runs "until status updated"; we render a finite window). */
const RECURRING_PREVIEW_COUNT = 3;
/** How many daily reminders to render before the schedule notes "…and so on". */
const DAILY_REMINDER_PREVIEW = 5;

/** Expand a config + due date into the ordered list of mailer events. */
export function computeEscalationSchedule(
  due: Date,
  cfg: EscalationMatrixConfig,
  opts: { recurringCount?: number } = {},
): EscalationEvent[] {
  const events: EscalationEvent[] = [];
  let seq = 0;
  // Push a rung and return its *adjusted* (weekday-rolled) date, so later rungs
  // chain off the actual send date — "R2 at R1+2" means 2 days after R1 lands.
  const push = (kind: EscalationKind, code: string, title: string, raw: Date, cc: string[]): Date => {
    const date = cfg.weekdaysOnly ? rollToWeekday(raw) : raw;
    events.push({ seq: ++seq, kind, code, title, date, rolledFromWeekend: cfg.weekdaysOnly && isWeekend(raw), cc });
    return date;
  };

  // 1 — initial heads-up mails, one per configured "days before" offset.
  [...cfg.initialTriggers].sort((a, b) => b - a).forEach(daysBefore => {
    const code = daysBefore === 0 ? 'On due' : `T-${daysBefore}`;
    const title = daysBefore === 0 ? 'Heads-up (on due date)' : `Heads-up (${daysBefore}d before)`;
    push('initial', code, title, addDays(due, -daysBefore), []);
  });

  // 2 — reminders. Staged: R1 counts from the due date, each later reminder from
  // the previous one. Daily: a reminder every day until handled (finite preview).
  let anchor = due;
  if (cfg.reminderDaily) {
    for (let i = 0; i < DAILY_REMINDER_PREVIEW; i++) {
      anchor = push('reminder', `R${i + 1}`, `Daily reminder ${i + 1}`, addDays(anchor, 1), []);
    }
  } else {
    cfg.reminders.forEach((off, i) => {
      anchor = push('reminder', `R${i + 1}`, `Reminder ${i + 1}`, addDays(anchor, off), []);
    });
  }

  // 3 — escalations, continuing from the last reminder's send date.
  let escNumber = 0;
  cfg.escalations.forEach((rung, i) => {
    escNumber = i + 1;
    anchor = push('escalation', `Esc-${escNumber}`, `Escalation ${escNumber}`, addDays(anchor, rung.offsetDays), rung.cc);
  });

  // 4 — recurring, incrementing the escalation number, until status updated.
  if (cfg.recurring.enabled && cfg.recurring.everyDays > 0) {
    const n = opts.recurringCount ?? RECURRING_PREVIEW_COUNT;
    for (let i = 0; i < n; i++) {
      escNumber += 1;
      anchor = push('recurring', `Esc-${escNumber}`, `Recurring escalation ${escNumber}`, addDays(anchor, cfg.recurring.everyDays), cfg.recurring.cc);
    }
  }

  return events;
}

export interface EscalationState {
  /** Events whose date is on or before `today`. */
  firedCount: number;
  /** The next mailer due (undefined once the schedule is exhausted). */
  next?: EscalationEvent;
  /** The most recent fired event (the current rung). */
  current?: EscalationEvent;
  /** True when today is past the due date. */
  overdue: boolean;
  /** True when the item has entered the escalation (not just reminder) phase. */
  escalating: boolean;
}

/** Given a due date + config, where does an open item stand relative to `today`? */
export function deriveEscalationState(
  due: Date,
  cfg: EscalationMatrixConfig,
  today: Date,
): EscalationState {
  const schedule = computeEscalationSchedule(due, cfg);
  const t = today.getTime();
  const fired = schedule.filter(e => e.date.getTime() <= t);
  const next = schedule.find(e => e.date.getTime() > t);
  const current = fired[fired.length - 1];
  return {
    firedCount: fired.length,
    next,
    current,
    overdue: t > due.getTime(),
    escalating: !!current && (current.kind === 'escalation' || current.kind === 'recurring'),
  };
}

// ─── summaries (for the compact card + chips) ───

/** One-line recap of the matrix for the collapsed card. */
export function summarizeMatrix(cfg: EscalationMatrixConfig): string {
  if (!cfg.enabled) return 'Escalation mailers off';
  const t = cfg.initialTriggers.length;
  const parts = [
    t === 0 ? 'No pre-due trigger' : `${t} pre-due trigger${t === 1 ? '' : 's'}`,
    cfg.reminderDaily ? 'daily reminders' : `${cfg.reminders.length} reminder${cfg.reminders.length === 1 ? '' : 's'}`,
    `${cfg.escalations.length} escalation${cfg.escalations.length === 1 ? '' : 's'}`,
  ];
  if (cfg.recurring.enabled) parts.push(`then every ${cfg.recurring.everyDays}d`);
  return parts.join(' · ');
}
