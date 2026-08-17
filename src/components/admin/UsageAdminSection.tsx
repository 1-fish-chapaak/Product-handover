/**
 * Administration → Platform Usage. A statement, not a form.
 *
 * There is nothing here to fill in, and that is the design. Platform Usage rests
 * on two kinds of number, and neither of them is the customer's to type:
 *
 * · **The assumptions** behind every value figure. Two of them the platform
 *   measures from the customer's own recorded pace, and they switch themselves to
 *   the measured rate the moment the guards pass, silently and audited. The other
 *   two are money, which no platform can measure, so they run on their labelled
 *   defaults. If a tenant genuinely needs a different value it is set in
 *   configuration by support or engineering and arrives labelled as a manual
 *   value. No screen offers an input for any of them.
 *
 * · **The contract prices** for the paid lookups. Those were agreed when the deal
 *   was signed, so irame's own operations seed them platform-side. The customer
 *   reads them here and sees the cost they produce on the page, labelled "as per
 *   your contract". There is no price form and no bill screen anywhere in the
 *   product.
 *
 * So this screen shows the values, where each came from, and the audit trail. It
 * is read only by design rather than by oversight, and it says so, because a
 * screen with no controls on it should explain why rather than look unfinished.
 */

import { useMemo } from 'react';
import { Info, Lock } from 'lucide-react';
import { useCan } from '../../context/CurrentUserContext';
import EmptyState from '../shared/EmptyState';
import {
  PAID_LOOKUPS, formatDate, loadContractPrices, loadUsageChanges,
} from '../../data/platform-usage';
import {
  MEASURABLE, SETTING_LABEL, SETTING_SHORT, SOURCE_FIELD, SOURCE_LABEL,
  applyCalibration, calibrate, contractLedger, fmtInt, fmtMoneyExact, fmtOneDp, fmtPaise,
  fmtRate, loadSettings, type NumericSetting,
} from '../../data/platform-usage-metrics';

export default function UsageAdminSection({ onOpenLogs }: { onOpenLogs: () => void }) {
  const { can } = useCan();
  const canSettings = can('ad_usage_settings');

  if (!canSettings) {
    return (
      <EmptyState
        icon={Info}
        title="Nothing here needs you"
        body="Platform Usage looks after its own numbers. Reading the assumptions and the contract behind them is behind a permission your role does not hold."
      />
    );
  }

  return (
    <div className="space-y-10">
      <Assumptions onOpenLogs={onOpenLogs} />
      <ContractPrices />
      <ChangeTrail onOpenLogs={onOpenLogs} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * The four assumptions, read only
 * ────────────────────────────────────────────────────────────────────────── */

function Assumptions({ onOpenLogs }: { onOpenLogs: () => void }) {
  // Reading this screen runs the same calibration the page runs, so the two can
  // never show a different value for the same setting.
  const settings = useMemo(() => applyCalibration(loadSettings()), []);
  const measurement = useMemo(() => calibrate(), []);

  const keys: NumericSetting[] = ['manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth'];

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">The assumptions behind every value figure</h3>
        <p className="mt-1 text-[0.875rem] text-ink-500 max-w-[80ch] leading-relaxed">
          Nobody fills these in. Two of them the platform measures from your own recorded pace and updates
          weekly on its own. The other two are money, which no platform can measure, so they run on their
          labelled starting values. They are the same for every team, because per team values would make two
          teams' numbers impossible to compare.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
          <Lock size={13} /> Read only. A different value is set in configuration, by support, and arrives
          labelled as a manual value.
        </p>
      </header>

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
        {keys.map(key => {
          const source = settings[SOURCE_FIELD[key]] as 'default' | 'measured' | 'manual';
          const measurable = MEASURABLE.includes(key);
          const measured = key === 'manualReviewRate'
            ? settings.measuredReviewRate
            : key === 'manualControlTestHours' ? settings.measuredControlTestHours : null;
          const sampleN = key === 'manualReviewRate'
            ? settings.measuredReviewSampleN
            : key === 'manualControlTestHours' ? settings.measuredControlTestSampleN : null;
          const value = key === 'hourlyRate'
            ? fmtMoneyExact(settings[key])
            : key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : fmtInt(settings[key]);

          return (
            <div key={key} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-semibold text-ink-900">{SETTING_SHORT[key]}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink-500">{SETTING_LABEL[key]}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[1.25rem] font-semibold text-ink-900 tabular-nums leading-none">{value}</p>
                  <p className="mt-1 text-[0.75rem] text-ink-500">{SOURCE_LABEL[source]}</p>
                </div>
              </div>

              <p className="mt-2 text-[0.75rem] text-ink-500 max-w-[80ch]">
                {measurable ? (
                  source === 'manual' ? (
                    <>
                      Set in configuration, so the platform is not applying what it measures. It still measures
                      underneath:{' '}
                      {measured === null ? 'nothing yet' : `${fmtOneDp(measured)} from your own records`}.
                    </>
                  ) : source === 'measured' ? (
                    <>
                      Measured from {fmtInt(sampleN ?? 0)} of your own records
                      {settings.measuredFrom ? `, from ${formatDate(settings.measuredFrom)}` : ''}
                      {settings.measuredAt ? `, last checked ${formatDate(settings.measuredAt)}` : ''}. It updates
                      itself weekly.
                    </>
                  ) : (
                    <>
                      Still the shipped starting value.{' '}
                      {measurement.blockedBy
                        ? `The platform cannot measure it yet: ${measurement.blockedBy}.`
                        : 'It switches to your measured pace as soon as the guards pass.'}
                    </>
                  )
                ) : (
                  <>
                    No platform can measure this one, so it runs on its labelled default. Every figure it feeds
                    says "estimated" and prints this value next to it.
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[0.75rem] text-ink-500 flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>
          Every measurement the platform applies writes a row with the old value, the new value and where it came
          from.{' '}
          <button type="button" onClick={onOpenLogs} className="font-medium text-brand-700 hover:underline">
            Open the audit log
          </button>
          .
        </span>
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * The contract, read only
 * ────────────────────────────────────────────────────────────────────────── */

function ContractPrices() {
  const prices = useMemo(() => loadContractPrices(), []);
  const ledger = useMemo(() => contractLedger(), []);

  const priced = new Set(prices.map(row => row.lookupId));
  const notInContract = PAID_LOOKUPS.filter(lookup => !priced.has(lookup.id));

  if (prices.length === 0) {
    return (
      <section>
        <header className="mb-4">
          <h3 className="text-[1.125rem] font-semibold text-ink-900">What your contract charges</h3>
        </header>
        <EmptyState
          icon={Lock}
          title="Your contract prices have not been loaded yet"
          body="Lookup prices are agreed when the deal is signed and seeded by irame. Until they arrive, Platform Usage counts the paid lookups and claims no cost. Nothing on the value side of the page depends on them."
        />
      </section>
    );
  }

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">What your contract charges</h3>
        <p className="mt-1 text-[0.875rem] text-ink-500 max-w-[80ch] leading-relaxed">
          The prices for the paid verification lookups, as agreed in your contract. They are seeded by irame when
          the deal is signed, and Platform Usage costs your recorded volume at them. A renegotiation opens a new
          row rather than rewriting the old one, so a price change this month never moves last month's figure.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500">
          <Lock size={13} /> Read only. These are contract terms, not settings.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-canvas-border bg-canvas-elevated">
        <table className="w-full text-[0.875rem]">
          <thead>
            <tr className="border-b border-canvas-border">
              {['API', 'Vendor', 'Charged per', 'Charge', 'In force', 'Set by'].map(head => (
                <th key={head} scope="col" className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.map(row => (
              <tr key={`${row.lookupId}-${row.effectiveFrom}`} className="border-b border-canvas-border last:border-0">
                <td className="px-4 py-2.5 text-ink-800">{row.apiName}</td>
                <td className="px-4 py-2.5 text-ink-800">{row.vendor}</td>
                <td className="px-4 py-2.5 text-ink-800">{row.billingUnit}</td>
                <td className="px-4 py-2.5 text-ink-800 tabular-nums">{fmtRate(row.pricePaise)}</td>
                <td className="px-4 py-2.5 text-ink-600 tabular-nums">
                  {formatDate(row.effectiveFrom)}
                  {row.effectiveTo === null ? ' onwards' : ` to ${formatDate(row.effectiveTo)}`}
                </td>
                <td className="px-4 py-2.5 text-ink-600">{row.setBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-[0.75rem] text-ink-500 border-t border-canvas-border">
          Charged per run means one charge for a whole run however many rows it checked. Charged per row means one
          charge for each successful call. Which applies is a contract term, verified once against the workflow's
          own stored program.
        </p>
      </div>

      {notInContract.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-5 py-4">
          <p className="text-[0.875rem] font-semibold text-ink-900">Lookups your contract does not price yet</p>
          <p className="mt-1 text-[0.875rem] text-ink-700">{notInContract.map(l => l.name).join(' · ')}</p>
          <p className="mt-1 text-[0.75rem] text-ink-500">
            Calls on these are counted on Platform Usage and charged nothing. Adding them is a contract change on
            our side, so there is nothing for you to do here.
          </p>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-canvas-border bg-canvas-elevated">
          <table className="w-full text-[0.875rem]">
            <thead>
              <tr className="border-b border-canvas-border">
                {['Month', 'Successful lookups', 'Charged', 'Not priced yet'].map(head => (
                  <th key={head} scope="col" className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map(row => (
                <tr key={row.at} className="border-b border-canvas-border last:border-0">
                  <td className="px-4 py-2.5 text-ink-800">{row.label}</td>
                  <td className="px-4 py-2.5 text-ink-800 tabular-nums">{fmtInt(row.calls)}</td>
                  <td className="px-4 py-2.5 text-ink-800 tabular-nums">{fmtPaise(row.chargedPaise)}</td>
                  <td className="px-4 py-2.5 text-ink-600 tabular-nums">
                    {row.unpricedCalls === 0 ? 'none' : `${fmtInt(row.unpricedCalls)} calls`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * The trail behind both
 * ────────────────────────────────────────────────────────────────────────── */

function ChangeTrail({ onOpenLogs }: { onOpenLogs: () => void }) {
  const rows = useMemo(() => loadUsageChanges(), []);
  if (rows.length === 0) return null;

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">Every change to a number behind a figure</h3>
        <p className="mt-1 text-[0.875rem] text-ink-500 max-w-[80ch] leading-relaxed">
          What changed, from what to what, who changed it and when. The platform writes a row whenever it moves an
          assumption to your measured pace, and every contract price is a row too, because a price that changed
          last month explains a cost that changed last month.
        </p>
      </header>

      <ul className="divide-y divide-canvas-border rounded-xl border border-canvas-border bg-canvas-elevated">
        {rows.slice(0, 20).map((row, i) => (
          <li key={`${row.field}-${row.at}-${i}`} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.875rem] text-ink-800">
                {row.field}
                {row.from !== null && row.to !== null && (
                  <span className="tabular-nums text-ink-600"> · {row.from} to {row.to}</span>
                )}
                {row.from === null && row.to !== null && <span className="tabular-nums text-ink-600"> · {row.to}</span>}
              </span>
              <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatDate(row.at)}</span>
            </div>
            <p className="text-[0.75rem] text-ink-500">
              {row.by}
              {row.source && <> · {row.source}</>}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[0.75rem] text-ink-500">
        {rows.length > 20 && <>Showing the 20 newest of {fmtInt(rows.length)}. </>}
        <button type="button" onClick={onOpenLogs} className="font-medium text-brand-700 hover:underline">
          Open the audit log
        </button>{' '}
        for everything else the workspace recorded.
      </p>
    </section>
  );
}
