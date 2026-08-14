/**
 * PU-18 · The four assumptions, where each one came from, and what changing it does.
 *
 * Two things make this panel more than a form.
 *
 * **The preview.** One of these numbers swings the headline eightfold, and
 * somebody who discovers that in a board pack three months later will never
 * trust the page again. So the headline recomputes as the field is typed, against
 * the runs currently on screen, before anything is saved.
 *
 * **The suggestion.** The platform measures what it can measure from the
 * customer's own timestamps and offers it. The job's whole output is a sentence
 * and a button: nothing is ever applied on its own, because a number that
 * changed itself is a number nobody can defend. Adopting it flips the value and
 * its source together, and the audit event records before, after and source.
 *
 * The two money settings carry no suggestion and never will. No platform knows
 * what an auditor hour costs or how long a working month is, so those stay
 * business-entered and the panel says so rather than leaving a gap that reads
 * like a missing feature.
 */

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import Modal from '../shared/Modal';
import { BTN_CANCEL, BTN_PRIMARY, FIELD_INPUT, FIELD_LABEL } from '../admin/adminTokens';
import {
  DEFAULT_SETTINGS, SETTING_LABEL, SOURCE_FIELD, SOURCE_LABEL, fmtHours, fmtInt, fmtMoney,
  fmtPeople, valueOf,
  type Calibration, type NumericSetting, type SettingSource, type Suggestion, type UsageSettings,
} from '../../data/platform-usage-metrics';
import type { WorkflowRun } from '../../data/platform-usage';

const KEYS: NumericSetting[] = [
  'manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth',
];

const HELP: Record<NumericSetting, string> = {
  manualReviewRate: 'The single biggest lever here. Halve it and every saving figure doubles.',
  manualControlTestHours: 'Used only by runs that test a control and produce no rows.',
  hourlyRate: 'A blended rate, in rupees. It turns hours into money and does nothing else.',
  hoursPerPersonPerMonth: 'What turns hours into a number of people.',
};

/** The unit each suggestion is spoken in. */
const UNIT: Partial<Record<NumericSetting, string>> = {
  manualReviewRate: 'rows an hour',
  manualControlTestHours: 'hours a test',
};

export default function UsageSettingsPanel({
  settings,
  calibration,
  runs,
  months,
  periodLabel,
  onSave,
  onClose,
}: {
  settings: UsageSettings;
  calibration: Calibration;
  /** The runs currently on screen, so the preview is of what the reader sees. */
  runs: WorkflowRun[];
  months: number;
  periodLabel: string;
  onSave: (next: UsageSettings, changes: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<UsageSettings>(settings);

  const before = useMemo(() => valueOf(runs, settings, months), [runs, settings, months]);
  const after = useMemo(() => valueOf(runs, draft, months), [runs, draft, months]);
  const dirty = KEYS.some(k => draft[k] !== settings[k])
    || (Object.values(SOURCE_FIELD) as (keyof UsageSettings)[]).some(f => draft[f] !== settings[f]);

  const suggestionFor = (k: NumericSetting): { value: Suggestion | null; reason: string | null } =>
    k === 'manualReviewRate'
      ? { value: calibration.reviewRate, reason: calibration.reviewRateReason }
      : k === 'manualControlTestHours'
        ? { value: calibration.controlTestHours, reason: calibration.controlTestHoursReason }
        : { value: null, reason: null };

  const sourceOf = (k: NumericSetting): SettingSource | null => {
    const field = SOURCE_FIELD[k];
    return field ? draft[field] : null;
  };

  /** Typing over a value makes it a hand-set number, and it says so from then on. */
  const type = (k: NumericSetting, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const field = SOURCE_FIELD[k];
    setDraft(d => ({ ...d, [k]: n, ...(field ? { [field]: 'manual' as SettingSource } : {}) }));
  };

  /** One click switches the live value and its source together. */
  const adopt = (k: NumericSetting, s: Suggestion) => {
    const field = SOURCE_FIELD[k];
    setDraft(d => ({ ...d, [k]: s.value, ...(field ? { [field]: 'measured' as SettingSource } : {}) }));
  };

  const save = () => {
    const changes = KEYS.filter(k => draft[k] !== settings[k]).map(k => {
      const field = SOURCE_FIELD[k];
      const source = field ? ` (${SOURCE_LABEL[draft[field]]})` : '';
      return `${SETTING_LABEL[k]}: ${settings[k]} to ${draft[k]}${source}`;
    });
    onSave(draft, changes);
  };

  return (
    <Modal
      title="Settings"
      subtitle="Four settings drive every value claim. Two the platform can measure from your own history and suggest; two only the business can set."
      width="max-w-[680px]"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_SETTINGS)}
            className="text-[0.75rem] text-ink-500 hover:text-ink-800"
          >
            Reset to the starting values
          </button>
          <div className="flex items-center gap-2">
            <button type="button" className={BTN_CANCEL} onClick={onClose}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} onClick={save} disabled={!dirty}>
              Save and recalculate
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
          {KEYS.map(k => {
            const source = sourceOf(k);
            const { value: suggestion, reason } = suggestionFor(k);
            const alreadyAdopted = suggestion !== null && draft[k] === suggestion.value && source === 'measured';

            return (
              <div key={k}>
                <label className={FIELD_LABEL} htmlFor={`setting-${k}`}>{SETTING_LABEL[k]}</label>
                <input
                  id={`setting-${k}`}
                  type="number"
                  min={1}
                  value={draft[k]}
                  onChange={e => type(k, e.target.value)}
                  className={`${FIELD_INPUT} tabular-nums`}
                />
                {source && (
                  <p className="mt-1 text-[0.75rem] text-ink-400" data-source={source}>
                    {SOURCE_LABEL[source]}
                  </p>
                )}
                <p className="mt-1 text-[0.75rem] text-ink-500">{HELP[k]}</p>

                {suggestion && !alreadyAdopted && (
                  <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2.5">
                    <p className="text-[0.75rem] text-ink-700">
                      Your team got through{' '}
                      <span className="font-semibold tabular-nums">
                        {fmtInt(suggestion.value)} {UNIT[k]}
                      </span>{' '}
                      over the last {suggestion.windowDays} days, across{' '}
                      <span className="tabular-nums">{fmtInt(suggestion.sampleN)}</span> timed reviews.
                    </p>
                    <button
                      type="button"
                      onClick={() => adopt(k, suggestion)}
                      className="mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-medium hover:bg-brand-700"
                    >
                      Use it
                    </button>
                  </div>
                )}

                {alreadyAdopted && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] text-compliant-700">
                    <Check size={13} /> Using the measured rate
                  </p>
                )}

                {!suggestion && reason && (
                  <p className="mt-2 text-[0.75rem] text-ink-400">{reason}</p>
                )}

                {!SOURCE_FIELD[k] && (
                  <p className="mt-2 text-[0.75rem] text-ink-400">
                    No platform can measure this one. It stays yours to set.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* The preview. Live, before saving, against the runs on screen. */}
        <div className="rounded-xl border border-canvas-border bg-canvas px-4 py-3.5">
          <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">
            What this does to {periodLabel.toLowerCase()}
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-4">
            {[
              { label: 'Hours saved', now: fmtHours(before.hours), next: fmtHours(after.hours) },
              { label: 'Worth', now: fmtMoney(before.money), next: fmtMoney(after.money) },
              { label: 'People', now: fmtPeople(before.people), next: fmtPeople(after.people) },
            ].map(row => (
              <div key={row.label}>
                <div className="text-[0.75rem] text-ink-500">{row.label}</div>
                <div className="mt-0.5 text-[1rem] font-semibold text-ink-900 tabular-nums">{row.next}</div>
                {row.now !== row.next && (
                  <div className="text-[0.75rem] text-ink-400 tabular-nums line-through">{row.now}</div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.75rem] text-ink-500">
            Reviewing an exception and checking rows by hand are related work, not identical work, so a measured
            rate is a recorded proxy rather than the thing itself. Saving records who changed what, from what to
            what, and where the new value came from.
          </p>
        </div>
      </div>
    </Modal>
  );
}
