/**
 * Administration → Platform Usage.
 *
 * Platform Usage is a page that reads. It has no editor on it, so the two things
 * a person can type live here, each behind its own permission: a tenant can hand
 * bill entry to finance ops without handing over the company wide numbers it
 * feeds.
 *
 * ## The assumptions
 *
 * Nobody has to fill anything in. The four numbers ship with labelled starting
 * values, and the two the platform can measure switch to the customer's own
 * recorded pace the moment the guards pass: ninety days of history and enough
 * records, outliers trimmed. That happens on its own and writes an audit row.
 *
 * An administrator can pin a value over the top. It is rare and it is meant to
 * be, because pinning stops the platform improving the number by itself, so the
 * screen says that rather than presenting a pin as the normal way to work.
 *
 * ## The vendor's bill
 *
 * Optional, forever. Without a bill the page still counts how many paid lookups
 * ran and simply does not claim a cost; the hours and rupees saved never depend
 * on it. With one, the window is costed exactly and history fills in behind it.
 * The list shows its own gaps, so a forgotten bill is visible here rather than
 * discovered in a board meeting.
 */

import { useMemo, useState } from 'react';
import { ArrowRight, Check, Info, Pin, PinOff, Trash2 } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useToast } from '../shared/Toast';
import EmptyState from '../shared/EmptyState';
import { FIELD_INPUT, FIELD_LABEL, FIELD_SELECT, BTN_CTA_PRIMARY, BTN_ROW } from './adminTokens';
import {
  ANCHOR, PAID_LOOKUPS, formatDate, formatMonth, loadInvoices, loadPrices,
  loadUsageChanges, removeInvoice, removePrice, saveInvoice, savePrice, startOfMonthUtc,
  type LookupPrice, type VendorInvoice,
} from '../../data/platform-usage';
import {
  MEASURABLE, SETTING_LABEL, SETTING_SHORT, SOURCE_FIELD, SOURCE_LABEL,
  calibrate, fmtInt, fmtMoneyExact, fmtOneDp, fmtPaise, invoiceLedger, loadSettings, pinSetting, unpinSetting,
  type NumericSetting, type UsageSettings,
} from '../../data/platform-usage-metrics';

/** The month a date input gives back, as the first of that month in UTC. */
const monthValueToMs = (value: string): number | null => {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) : null;
};

const msToMonthValue = (ms: number): string => new Date(ms).toISOString().slice(0, 7);

export default function UsageAdminSection({ onOpenLogs }: { onOpenLogs: () => void }) {
  const { can } = useCan();
  const canSettings = can('ad_usage_settings');
  const canInvoices = can('ad_usage_invoices');

  return (
    <div className="space-y-10">
      {canSettings && <Assumptions onOpenLogs={onOpenLogs} />}
      {canInvoices && <VendorBills />}
      {canInvoices && <PerApiPrices />}
      {!canSettings && !canInvoices && (
        <EmptyState
          icon={Info}
          title="Nothing here needs you"
          body="Platform Usage looks after its own numbers. The two a person can set are behind permissions your role does not hold."
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * The four assumptions
 * ────────────────────────────────────────────────────────────────────────── */

function Assumptions({ onOpenLogs }: { onOpenLogs: () => void }) {
  const { currentUser } = useCurrentUser();
  const { addToast } = useToast();
  const [settings, setSettings] = useState<UsageSettings>(() => loadSettings());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const measurement = useMemo(() => calibrate(), []);

  const by = currentUser?.name ?? 'an administrator';

  const pin = (key: NumericSetting) => {
    const raw = Number(drafts[key]);
    if (!Number.isFinite(raw) || raw <= 0) {
      addToast({ type: 'error', message: 'Enter a number above zero.' });
      return;
    }
    setSettings(pinSetting(key, raw, by));
    setDrafts(prev => ({ ...prev, [key]: '' }));
    addToast({ type: 'success', message: 'Pinned. Platform Usage recalculates from this value, and stops measuring it.' });
  };

  const unpin = (key: NumericSetting) => {
    setSettings(unpinSetting(key, by));
    addToast({ type: 'success', message: 'Unpinned. The platform measures this one from your own records again.' });
  };

  const keys: NumericSetting[] = ['manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth'];

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">The assumptions behind every value figure</h3>
        <p className="mt-1 text-[0.875rem] text-ink-500 max-w-[80ch] leading-relaxed">
          Two of these the platform measures from your own recorded pace, so they need nobody's attention. The
          other two are money, which no platform can measure, so they stay yours. Pinning a value is rare: it
          stops the platform improving that number by itself.
        </p>
      </header>

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
        {keys.map(key => {
          const source = settings[SOURCE_FIELD[key]] as 'default' | 'measured' | 'manual';
          const measurable = MEASURABLE.includes(key);
          const measured = key === 'manualReviewRate' ? settings.measuredReviewRate : key === 'manualControlTestHours' ? settings.measuredControlTestHours : null;
          const value = key === 'hourlyRate' ? fmtMoneyExact(settings[key]) : key === 'manualControlTestHours' ? fmtOneDp(settings[key]) : fmtInt(settings[key]);

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
                      Pinned, so the platform is not applying what it measures. It still measures underneath:{' '}
                      {measured === null ? 'nothing yet' : `${fmtOneDp(measured)} from your own records`}.
                    </>
                  ) : source === 'measured' ? (
                    <>
                      Measured from {fmtInt(settings.measuredSampleN ?? 0)} of your own records
                      {settings.measuredFrom ? `, from ${formatDate(settings.measuredFrom)}` : ''}
                      {settings.measuredAt ? `, last checked ${formatDate(settings.measuredAt)}` : ''}. It updates itself weekly.
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
                    No platform can measure this one, so it runs on its labelled default until somebody decides
                    otherwise. Whatever it is set to, it is the same for every team, because per team values
                    would make teams impossible to compare.
                  </>
                )}
              </p>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className={FIELD_LABEL} htmlFor={`pin-${key}`}>Pin a value</label>
                  <input
                    id={`pin-${key}`}
                    inputMode="decimal"
                    value={drafts[key] ?? ''}
                    onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={String(settings[key])}
                    className={`${FIELD_INPUT} w-40 tabular-nums`}
                  />
                </div>
                <button type="button" onClick={() => pin(key)} className={BTN_ROW}>
                  <Pin size={13} /> Pin
                </button>
                {source === 'manual' && (
                  <button type="button" onClick={() => unpin(key)} className={BTN_ROW}>
                    <PinOff size={13} /> Unpin
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[0.75rem] text-ink-500 flex items-start gap-1.5">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>
          Every change here, and every measurement the platform applies on its own, writes a row with the old
          value, the new value and where it came from.{' '}
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
 * The vendor's monthly bill (PU-19 layer 2)
 * ────────────────────────────────────────────────────────────────────────── */

function VendorBills() {
  const { currentUser } = useCurrentUser();
  const { addToast } = useToast();
  const [invoices, setInvoices] = useState<VendorInvoice[]>(() => loadInvoices());
  const [vendor, setVendor] = useState('');
  const [month, setMonth] = useState(() => msToMonthValue(startOfMonthUtc(ANCHOR)));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Both read the store rather than the state, so the entered bills are the
  // dependency even though neither call takes them as an argument.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ledger = useMemo(() => invoiceLedger(), [invoices]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const changes = useMemo(() => loadUsageChanges().filter(c => c.entity === 'vendor_invoice'), [invoices]);

  const submit = () => {
    const periodMonth = monthValueToMs(month);
    const rupees = Number(amount);
    if (!vendor.trim()) {
      addToast({ type: 'error', message: 'Say who billed us.' });
      return;
    }
    if (periodMonth === null) {
      addToast({ type: 'error', message: 'Pick the month the bill covers.' });
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      addToast({ type: 'error', message: 'Enter the amount on the bill.' });
      return;
    }
    setInvoices(saveInvoice({
      vendor: vendor.trim(),
      periodMonth,
      amountPaise: Math.round(rupees * 100),
      note: note.trim() || null,
      enteredBy: currentUser?.name ?? 'an administrator',
      enteredAt: ANCHOR,
    }));
    setAmount('');
    setNote('');
    addToast({ type: 'success', message: `${formatMonth(periodMonth)} is now costed exactly, on Platform Usage.` });
  };

  const remove = (invoice: VendorInvoice) => {
    setInvoices(removeInvoice(invoice.vendor, invoice.periodMonth));
    addToast({ type: 'success', message: 'Removed. That month goes back to showing lookups without a cost.' });
  };

  const missing = ledger.filter(row => row.invoice === null);

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">The vendor's monthly bill</h3>
        <p className="mt-1 text-[0.875rem] text-ink-500 max-w-[80ch] leading-relaxed">
          One number a month, the one finance already knows with certainty. With it, the paid lookups on Platform
          Usage are costed to the paisa. Without it the page still counts the lookups and claims no cost, so this
          is optional forever. Past months can be entered at any time and the history fills in behind them.
        </p>
      </header>

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-vendor">Who billed us</label>
            <input id="bill-vendor" value={vendor} onChange={e => setVendor(e.target.value)} className={FIELD_INPUT} placeholder="The verification vendor" />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-month">Month the bill covers</label>
            <input
              id="bill-month"
              type="month"
              value={month}
              max={msToMonthValue(ANCHOR)}
              onChange={e => setMonth(e.target.value)}
              className={`${FIELD_INPUT} tabular-nums`}
            />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-amount">Amount on the bill, in rupees</label>
            <input
              id="bill-amount"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={`${FIELD_INPUT} tabular-nums`}
              placeholder="68400"
            />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-note">Anything worth saying</label>
            <input id="bill-note" value={note} onChange={e => setNote(e.target.value)} className={FIELD_INPUT} placeholder="A credit note, a dispute" />
          </div>
        </div>
        <div className="mt-3">
          <button type="button" onClick={submit} className={BTN_CTA_PRIMARY}>
            <Check size={15} /> Enter this bill
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-canvas-border bg-canvas px-5 py-4">
          <p className="text-[0.875rem] font-semibold text-ink-900">Months with lookups and no bill</p>
          <ul className="mt-2 space-y-1">
            {missing.slice(0, 6).map(row => (
              <li key={row.at} className="text-[0.875rem] text-ink-700 tabular-nums">
                {row.label}: {fmtInt(row.calls)} calls recorded, no bill yet
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.75rem] text-ink-500">
            Each of these months stays uncosted on Platform Usage until its bill arrives. The months around it
            still show.
          </p>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-canvas-border bg-canvas-elevated">
          <table className="w-full text-[0.875rem]">
            <thead>
              <tr className="border-b border-canvas-border">
                {['Month', 'Vendor', 'Amount', 'Calls that month', 'Works out at', 'Entered by', ''].map(head => (
                  <th key={head} scope="col" className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.filter(row => row.invoice !== null).map(row => {
                const invoice = row.invoice as VendorInvoice;
                return (
                  <tr key={`${invoice.vendor}-${invoice.periodMonth}`} className="border-b border-canvas-border last:border-0">
                    <td className="px-4 py-2.5 text-ink-800">{row.label}</td>
                    <td className="px-4 py-2.5 text-ink-800">{invoice.vendor}</td>
                    <td className="px-4 py-2.5 text-ink-800 tabular-nums">{fmtPaise(invoice.amountPaise)}</td>
                    <td className="px-4 py-2.5 text-ink-800 tabular-nums">{fmtInt(row.calls)}</td>
                    <td className="px-4 py-2.5 text-ink-600 tabular-nums">
                      {row.calls === 0 ? 'no calls recorded' : `${fmtPaise(Math.round(invoice.amountPaise / row.calls))} a call, derived from this bill`}
                    </td>
                    <td className="px-4 py-2.5 text-ink-600">{invoice.enteredBy}, {formatDate(invoice.enteredAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => remove(invoice)} className={BTN_ROW}>
                        <Trash2 size={13} /> Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {changes.length > 0 && (
        <p className="mt-3 text-[0.75rem] text-ink-500">
          {fmtInt(changes.length)} {changes.length === 1 ? 'change' : 'changes'} to the bills are on the record, the
          newest by {changes[0].by} on {formatDate(changes[0].at)}.
        </p>
      )}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Per API prices (PU-19 layer 3, optional)
 * ────────────────────────────────────────────────────────────────────────── */

function PerApiPrices() {
  const { currentUser } = useCurrentUser();
  const { addToast } = useToast();
  const [prices, setPrices] = useState<LookupPrice[]>(() => loadPrices());
  const [lookupId, setLookupId] = useState(PAID_LOOKUPS[0].id);
  const [vendor, setVendor] = useState('');
  const [unit, setUnit] = useState<'run' | 'row'>('run');
  const [price, setPrice] = useState('');
  const [from, setFrom] = useState(() => new Date(ANCHOR).toISOString().slice(0, 10));

  const submit = () => {
    const rupees = Number(price);
    const effectiveFrom = Date.parse(`${from}T00:00:00Z`);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      addToast({ type: 'error', message: 'Enter the charge for one successful call.' });
      return;
    }
    if (Number.isNaN(effectiveFrom)) {
      addToast({ type: 'error', message: 'Pick the date this price starts.' });
      return;
    }
    const lookup = PAID_LOOKUPS.find(l => l.id === lookupId);
    setPrices(savePrice({
      lookupId,
      vendor: vendor.trim() || 'the verification vendor',
      apiName: lookup?.name ?? lookupId,
      billingUnit: unit,
      pricePaise: Math.round(rupees * 100),
      effectiveFrom,
      enteredBy: currentUser?.name ?? 'an administrator',
      enteredAt: ANCHOR,
    }));
    setPrice('');
    addToast({ type: 'success', message: 'Saved. A renegotiation later starts a new row rather than rewriting this one.' });
  };

  return (
    <section>
      <header className="mb-4">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">Prices per API, if the split matters</h3>
        <p className="mt-1 text-[0.875rem] text-ink-500 max-w-[80ch] leading-relaxed">
          Only needed to split the cost per API. The bill above already costs the window exactly, so this is a
          refinement rather than a requirement. One thing to get right: whether the vendor charges once per run
          or once per row, which differs by API and has to be read from each one's stored program. Getting it
          wrong puts the figure out by a factor of a thousand.
        </p>
      </header>

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className={FIELD_LABEL} htmlFor="price-api">API</label>
            <select id="price-api" value={lookupId} onChange={e => setLookupId(e.target.value)} className={FIELD_SELECT}>
              {PAID_LOOKUPS.map(lookup => <option key={lookup.id} value={lookup.id}>{lookup.name}</option>)}
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="price-vendor">Who bills us</label>
            <input id="price-vendor" value={vendor} onChange={e => setVendor(e.target.value)} className={FIELD_INPUT} placeholder="The verification vendor" />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="price-unit">Charged per</label>
            <select id="price-unit" value={unit} onChange={e => setUnit(e.target.value as 'run' | 'row')} className={FIELD_SELECT}>
              <option value="run">run</option>
              <option value="row">row</option>
            </select>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="price-amount">Charge for one success, in rupees</label>
            <input id="price-amount" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} className={`${FIELD_INPUT} tabular-nums`} placeholder="1.75" />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="price-from">In force from</label>
            <input id="price-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${FIELD_INPUT} tabular-nums`} />
          </div>
        </div>
        <div className="mt-3">
          <button type="button" onClick={submit} className={BTN_CTA_PRIMARY}>
            <Check size={15} /> Save this price
          </button>
        </div>
      </div>

      {prices.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-canvas-border bg-canvas-elevated">
          <table className="w-full text-[0.875rem]">
            <thead>
              <tr className="border-b border-canvas-border">
                {['API', 'Vendor', 'Charged per', 'Charge', 'In force', 'Entered by', ''].map(head => (
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
                  <td className="px-4 py-2.5 text-ink-800 tabular-nums">{fmtPaise(row.pricePaise)}</td>
                  <td className="px-4 py-2.5 text-ink-600 tabular-nums">
                    {formatDate(row.effectiveFrom)}
                    {row.effectiveTo === null ? ' onwards' : ` to ${formatDate(row.effectiveTo)}`}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{row.enteredBy}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setPrices(removePrice(row.lookupId, row.effectiveFrom));
                        addToast({ type: 'success', message: 'Removed.' });
                      }}
                      className={BTN_ROW}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[0.75rem] text-ink-500 border-t border-canvas-border">
            An API with a price row here is a billable one. There is no second list to keep in sync.{' '}
            <span className="inline-flex items-center gap-1">
              A per API total should reconcile against the bill for the same month
              <ArrowRight size={12} />
            </span>{' '}
            and a mismatch is worth showing rather than hiding.
          </p>
        </div>
      )}
    </section>
  );
}
