/**
 * Administration → Platform Usage.
 *
 * Platform Usage is a page that reads. It has no editor on it: the assumptions
 * behind its value figures improve on their own from the customer's own recorded
 * pace, and the vendor's bill is a finance job, not a reader's job. Both of the
 * things a person can type therefore live here, behind their own permissions —
 * a tenant can hand invoice entry to finance ops without handing over the
 * company-wide numbers it feeds.
 *
 * ## Assumptions
 *
 * Nobody has to fill anything in. The four numbers ship with labelled starting
 * values and the two measurable ones switch to the customer's measured pace the
 * moment the guards pass, silently and audited. An admin can pin a value over
 * that, which is rare and is meant to be: pinning stops the platform improving
 * the number by itself, so the screen says so rather than presenting the pin as
 * the normal way to work.
 *
 * ## The vendor's bill
 *
 * Optional, forever. Without a bill the page still shows how many paid lookups
 * ran and simply does not claim a cost; the hours and rupees saved never depend
 * on it. With one, the period is costed exactly and history fills in behind it.
 */

import { useMemo, useState } from 'react';
import { IndianRupee, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useCan, useCurrentUser } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { BTN_CTA_OUTLINE, FIELD_INPUT, FIELD_LABEL } from './adminTokens';
import {
  ANCHOR, addInvoice, addPrice, formatDate, isoDay, loadInvoices, loadPricing, loadUsageChanges,
  recordUsageChange, removeInvoice, removePrice, startOfMonthUtc,
  type VendorInvoice, type WorkflowApiPrice,
} from '../../data/platform-usage';
import {
  SETTING_LABEL, SOURCE_FIELD, SOURCE_LABEL, applyMeasured, calibrate, fmtInt, loadSettings, saveSettings,
  type NumericSetting, type SettingSource, type UsageSettings,
} from '../../data/platform-usage-metrics';
import { WORKFLOWS } from '../../data/mockData';

const KEYS: NumericSetting[] = [
  'manualReviewRate', 'manualControlTestHours', 'hourlyRate', 'hoursPerPersonPerMonth',
];

const HELP: Record<NumericSetting, string> = {
  manualReviewRate: 'The single biggest lever here. Halve it and every saving figure doubles.',
  manualControlTestHours: 'Used only by runs that test a control and produce no rows.',
  hourlyRate: 'A blended rate, in rupees. It turns hours into money and does nothing else.',
  hoursPerPersonPerMonth: 'What turns hours into a number of people.',
};

/** Money to the paisa. A rate of one rupee seventy five printed as "2" is a different contract. */
const RUPEES = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const rupees = (paise: number): string => RUPEES.format(paise / 100);

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (ms: number): string => MONTH_FMT.format(new Date(ms));
const monthValue = (ms: number): string => new Date(ms).toISOString().slice(0, 7);

const priceLine = (row: WorkflowApiPrice): string =>
  `${rupees(row.pricePaise)} per ${row.billingUnit === 'row' ? 'row checked' : 'run'}`;

export default function UsageAdminSection({ onOpenLogs }: { onOpenLogs: () => void }) {
  const { can } = useCan();
  const canSettings = can('ad_usage_settings');
  const canInvoices = can('ad_usage_invoices');

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[1.0625rem] font-bold text-ink-900">Platform Usage</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-500 max-w-2xl">
            The two numbers a person types rather than reads. Everything else on the Platform Usage page is
            computed from what the product already records, and every change made here lands in the audit
            log's <span className="font-semibold text-ink-700">Platform Usage</span> module.
          </p>
        </div>
        <button onClick={onOpenLogs} className={BTN_CTA_OUTLINE}>
          Usage audit trail
        </button>
      </div>

      {canSettings && <Assumptions />}
      {canInvoices && <VendorBills />}

      {!canSettings && !canInvoices && (
        <p className="text-[0.8125rem] text-ink-500">
          Your role does not hold either of the two Platform Usage permissions, so there is nothing to change
          here.
        </p>
      )}
    </div>
  );
}

/* ── PU-18 · the four assumptions ────────────────────────────────────────── */

function Assumptions() {
  const { currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const { addToast } = useToast();

  // The stored value already carries whatever the calibration job applied on
  // its own, so this screen reads the same numbers the page reads.
  const [settings, setSettings] = useState<UsageSettings>(() => loadSettings());
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const calibration = useMemo(() => calibrate({ persona: 'cfo', label: 'the whole company' }), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => loadUsageChanges().filter(c => c.entity === 'usage_setting'), [version]);

  const sourceOf = (k: NumericSetting): SettingSource | null => {
    const field = SOURCE_FIELD[k];
    return field ? settings[field] : null;
  };

  const measuredFor = (k: NumericSetting) =>
    k === 'manualReviewRate' ? calibration.reviewRate
      : k === 'manualControlTestHours' ? calibration.controlTestHours
        : null;

  const reasonFor = (k: NumericSetting) =>
    k === 'manualReviewRate' ? calibration.reviewRateReason
      : k === 'manualControlTestHours' ? calibration.controlTestHoursReason
        : null;

  const write = (next: UsageSettings, field: string, from: string, to: string, source: string) => {
    saveSettings(next);
    setSettings(next);
    recordUsageChange({
      entity: 'usage_setting',
      field,
      from,
      to,
      source,
      by: currentUser?.name ?? 'Unknown',
      at: ANCHOR,
    });
    setVersion(v => v + 1);
    logEvent({
      action: 'Update',
      module: 'Platform Usage',
      entity: 'Usage assumption',
      description: `${field}: ${from} to ${to} (${source})`,
    });
  };

  /** Pinning stops the platform improving the number by itself. */
  const pin = (k: NumericSetting) => {
    const value = Number(draft[k]);
    if (!Number.isFinite(value) || value <= 0 || value === settings[k]) return;
    const field = SOURCE_FIELD[k];
    const next: UsageSettings = { ...settings, [k]: value, ...(field ? { [field]: 'manual' as SettingSource } : {}) };
    write(next, SETTING_LABEL[k], String(settings[k]), String(value), SOURCE_LABEL.manual);
    setDraft(d => ({ ...d, [k]: '' }));
    addToast({ type: 'success', message: 'Pinned. Platform Usage recalculates from this value.' });
  };

  /** Unpinning hands the number back to the calibration job. */
  const unpin = (k: NumericSetting) => {
    const field = SOURCE_FIELD[k];
    if (!field) return;
    const released: UsageSettings = { ...settings, [field]: 'default' as SettingSource };
    const { settings: next, changes } = applyMeasured(released, calibration);
    const to = String(next[k]);
    write(
      next,
      SETTING_LABEL[k],
      String(settings[k]),
      to,
      changes.length > 0 ? SOURCE_LABEL.measured : SOURCE_LABEL.default,
    );
    addToast({ type: 'success', message: 'Unpinned. The platform measures this one again.' });
  };

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center gap-1.5">
        <SlidersHorizontal size={13} className="text-evidence-700" />
        <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-ink-800">The four assumptions</h3>
      </div>
      <p className="mb-3 text-[0.8125rem] text-ink-500 max-w-2xl">
        Every value figure on Platform Usage is an estimate and says so. Two of these four the platform
        measures from your own recorded pace and applies on its own once there is enough history; the two
        money ones no platform can measure, so they stay yours. Pinning a value is rare: it stops the
        platform improving that number by itself.
      </p>

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
        {KEYS.map(k => {
          const source = sourceOf(k);
          const measured = measuredFor(k);
          const reason = reasonFor(k);
          return (
            <div key={k} className="px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-medium text-ink-900">{SETTING_LABEL[k]}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink-500 max-w-[62ch]">{HELP[k]}</p>
                  <p className="mt-1 text-[0.75rem] text-ink-400">
                    <span className="tabular-nums text-ink-700 font-medium">{fmtInt(settings[k])}</span>
                    {source && <> · {SOURCE_LABEL[source]}</>}
                    {!source && <> · {SOURCE_LABEL.default}, and no platform can measure this one</>}
                  </p>
                  {measured && source !== 'manual' && (
                    <p className="mt-1 text-[0.75rem] text-ink-500 tabular-nums">
                      Measured at {fmtInt(measured.value)} across {fmtInt(measured.sampleN)} timed reviews in the
                      last {measured.windowDays} days.
                    </p>
                  )}
                  {!measured && reason && <p className="mt-1 text-[0.75rem] text-ink-400">{reason}</p>}
                </div>

                <div className="flex items-end gap-2 shrink-0">
                  <div>
                    <label className={FIELD_LABEL} htmlFor={`pin-${k}`}>Pin a value</label>
                    <input
                      id={`pin-${k}`}
                      type="number"
                      min={1}
                      value={draft[k] ?? ''}
                      placeholder={String(settings[k])}
                      onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))}
                      className={`${FIELD_INPUT} tabular-nums w-32`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => pin(k)}
                    disabled={!draft[k]}
                    className="h-9 px-3 rounded-md border border-canvas-border text-[0.8125rem] font-medium text-ink-700 hover:text-brand-700 hover:border-brand-200 disabled:opacity-40"
                  >
                    Pin
                  </button>
                  {source === 'manual' && (
                    <button
                      type="button"
                      onClick={() => unpin(k)}
                      className="h-9 px-3 rounded-md text-[0.8125rem] font-medium text-brand-700 hover:underline"
                    >
                      Unpin
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">Every change</h4>
          <ul className="mt-1 divide-y divide-canvas-border border-t border-canvas-border">
            {history.map((c, i) => (
              <li key={`${c.field}-${c.at}-${i}`} className="py-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[0.8125rem] text-ink-800">
                    {c.field} <span className="tabular-nums text-ink-600">· {c.from} to {c.to}</span>
                  </span>
                  <span className="text-[0.75rem] text-ink-400 shrink-0 tabular-nums">{formatDate(c.at)}</span>
                </div>
                <p className="text-[0.75rem] text-ink-500">{c.by}{c.source && <> · {c.source}</>}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── PU-19 · the vendor's bill, and the optional per-API split ───────────── */

function VendorBills() {
  const { currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const enteredBy = currentUser?.name ?? 'Unknown';

  const [invoices, setInvoices] = useState<VendorInvoice[]>(() => loadInvoices());
  const [vendor, setVendor] = useState('');
  const [month, setMonth] = useState(() => monthValue(ANCHOR));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [splitOpen, setSplitOpen] = useState(false);

  const billAmount = Number(amount);
  const billValid = vendor.trim() !== '' && Number.isFinite(billAmount) && billAmount > 0;

  const log = (description: string) =>
    logEvent({ action: 'Update', module: 'Platform Usage', entity: 'Paid lookup cost', description });

  const addBill = () => {
    if (!billValid) return;
    const parsed = Date.parse(`${month}-01T00:00:00Z`);
    if (Number.isNaN(parsed)) return;
    const periodMonth = startOfMonthUtc(parsed);
    const paise = Math.round(billAmount * 100);
    setInvoices(addInvoice({
      vendor: vendor.trim(),
      periodMonth,
      amountPaise: paise,
      note: note.trim() || null,
      enteredBy,
      enteredAt: ANCHOR,
    }));
    recordUsageChange({
      entity: 'vendor_invoice',
      field: `${monthLabel(periodMonth)} · ${vendor.trim()}`,
      from: null,
      to: rupees(paise),
      source: null,
      by: enteredBy,
      at: ANCHOR,
    });
    log(`Entered ${vendor.trim()}'s bill for ${monthLabel(periodMonth)}: ${rupees(paise)}`);
    setAmount('');
    setNote('');
  };

  const dropBill = (i: VendorInvoice) => {
    setInvoices(removeInvoice(i.vendor, i.periodMonth));
    recordUsageChange({
      entity: 'vendor_invoice',
      field: `${monthLabel(i.periodMonth)} · ${i.vendor}`,
      from: rupees(i.amountPaise),
      to: 'removed',
      source: null,
      by: enteredBy,
      at: ANCHOR,
    });
    log(`Removed ${i.vendor}'s bill for ${monthLabel(i.periodMonth)}`);
  };

  /* Layer 3 · the optional per-API split */

  const [prices, setPrices] = useState<WorkflowApiPrice[]>(() => loadPricing());
  const [workflowId, setWorkflowId] = useState<string>(WORKFLOWS[0]?.id ?? '');
  const [apiVendor, setApiVendor] = useState('');
  const [apiName, setApiName] = useState('');
  const [unit, setUnit] = useState<'run' | 'row' | ''>('');
  const [priceText, setPriceText] = useState('');
  const [from, setFrom] = useState(() => isoDay(ANCHOR));

  const nameOf = useMemo(() => new Map(WORKFLOWS.map(w => [w.id, w.name])), []);
  const pricedNow = useMemo(() => {
    const live = new Set<string>();
    prices.forEach(r => { if (r.effectiveTo === null) live.add(r.workflowId); });
    return live;
  }, [prices]);

  const priceAmount = Number(priceText);
  const priceValid = workflowId !== '' && unit !== '' && Number.isFinite(priceAmount) && priceAmount > 0;

  const addApiPrice = () => {
    if (!priceValid) return;
    const effectiveFrom = Date.parse(`${from}T00:00:00Z`);
    if (Number.isNaN(effectiveFrom)) return;
    const name = nameOf.get(workflowId) ?? workflowId;
    setPrices(addPrice({
      workflowId,
      vendor: apiVendor.trim() || 'Not named',
      apiName: apiName.trim() || name,
      billingUnit: unit,
      pricePaise: Math.round(priceAmount * 100),
      effectiveFrom,
    }));
    log(`Split "${name}" at ${rupees(Math.round(priceAmount * 100))} per ${unit === 'row' ? 'row' : 'run'} from ${formatDate(effectiveFrom)}`);
    setPriceText('');
    setApiVendor('');
    setApiName('');
    setUnit('');
  };

  const dropApiPrice = (r: WorkflowApiPrice) => {
    setPrices(removePrice(r.workflowId, r.effectiveFrom));
    log(`Removed the per API price on "${nameOf.get(r.workflowId) ?? r.workflowId}" from ${formatDate(r.effectiveFrom)}`);
  };

  const billed = invoices.reduce((sum, i) => sum + i.amountPaise, 0);

  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <IndianRupee size={13} className="text-evidence-700" />
        <h3 className="text-[0.75rem] font-bold uppercase tracking-wider text-ink-800">The vendor's bill</h3>
      </div>
      <p className="mb-3 text-[0.8125rem] text-ink-500 max-w-2xl">
        Optional, forever. Without a bill Platform Usage still shows how many paid lookups ran and simply does
        not claim a cost, and the hours and rupees saved never depend on it. With one, the period is costed
        exactly, backwards through every month entered, and it is the same number finance reconciles.
      </p>

      <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-vendor">Vendor</label>
            <input id="bill-vendor" value={vendor} onChange={e => setVendor(e.target.value)} className={FIELD_INPUT} placeholder="Who billed us" />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-month">Month</label>
            <input id="bill-month" type="month" value={month} onChange={e => setMonth(e.target.value)} className={`${FIELD_INPUT} tabular-nums`} />
            <p className="mt-1 text-[0.75rem] text-ink-500">Past months can be entered at any time.</p>
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-amount">Amount in rupees</label>
            <input
              id="bill-amount" type="number" min={0} step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} className={`${FIELD_INPUT} tabular-nums`} placeholder="0.00"
            />
          </div>
          <div>
            <label className={FIELD_LABEL} htmlFor="bill-note">Note</label>
            <input id="bill-note" value={note} onChange={e => setNote(e.target.value)} className={FIELD_INPUT} placeholder="Credit note, dispute, anything worth saying" />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={addBill}
              disabled={!billValid}
              className="h-9 px-3.5 rounded-md bg-brand-600 text-white text-[0.875rem] font-medium hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600"
            >
              Enter this bill
            </button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <p className="mt-4 text-[0.8125rem] text-ink-500">
            No bill entered yet, so Platform Usage says the period has no invoice rather than showing a cost
            built from a guess.
          </p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
              {invoices.map(i => (
                <li key={`${i.vendor}-${i.periodMonth}`} className="py-2.5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.875rem] text-ink-900 tabular-nums">
                      {monthLabel(i.periodMonth)} · {rupees(i.amountPaise)}
                    </p>
                    <p className="text-[0.75rem] text-ink-500">
                      {i.vendor} · entered by {i.enteredBy}
                      {i.note && <> · {i.note}</>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dropBill(i)}
                    aria-label={`Remove ${i.vendor}'s bill for ${monthLabel(i.periodMonth)}`}
                    className="shrink-0 h-7 w-7 grid place-items-center rounded-md border border-canvas-border text-ink-500 hover:text-risk-700 hover:border-risk-200"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.75rem] text-ink-500 tabular-nums">
              {fmtInt(invoices.length)} {invoices.length === 1 ? 'bill' : 'bills'} entered, {rupees(billed)} in
              total. A window is costed once every month in it has its bill.
            </p>
          </>
        )}
      </div>

      {/* Layer 3, and it says out loud that it is optional. */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSplitOpen(v => !v)}
          className="text-[0.8125rem] font-medium text-brand-700 hover:underline"
        >
          {splitOpen ? 'Hide the per API split' : 'Split the bill per API (optional)'}
        </button>

        {splitOpen && (
          <div className="mt-3 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-4">
            <p className="text-[0.75rem] text-ink-500 max-w-[70ch]">
              Only worth filling if the business wants the cost split per workflow. The unit has no default on
              purpose: a run checking 500 vendors usually makes 500 calls, and guessing that puts the split out
              by a thousandfold. The bill above needs none of this.
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL} htmlFor="price-workflow">Workflow</label>
                <select id="price-workflow" value={workflowId} onChange={e => setWorkflowId(e.target.value)} className={FIELD_INPUT}>
                  {WORKFLOWS.map(w => (
                    <option key={w.id} value={w.id}>{w.name}{pricedNow.has(w.id) ? ' (split)' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="price-vendor">Vendor</label>
                <input id="price-vendor" value={apiVendor} onChange={e => setApiVendor(e.target.value)} className={FIELD_INPUT} placeholder="Who bills us" />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="price-api">What it verifies</label>
                <input id="price-api" value={apiName} onChange={e => setApiName(e.target.value)} className={FIELD_INPUT} placeholder="PAN, GST, vehicle" />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="price-unit">Billed per</label>
                <select id="price-unit" value={unit} onChange={e => setUnit(e.target.value as 'run' | 'row' | '')} className={FIELD_INPUT}>
                  <option value="">Pick one</option>
                  <option value="run">Run, one call however many rows</option>
                  <option value="row">Row, one call for every row checked</option>
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="price-amount">Price in rupees</label>
                <input
                  id="price-amount" type="number" min={0} step="0.01" value={priceText}
                  onChange={e => setPriceText(e.target.value)} className={`${FIELD_INPUT} tabular-nums`} placeholder="0.00"
                />
                <p className="mt-1 text-[0.75rem] text-ink-500">Charged on a call that succeeds.</p>
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="price-from">In force from</label>
                <input id="price-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${FIELD_INPUT} tabular-nums`} />
                <p className="mt-1 text-[0.75rem] text-ink-500">Runs before this date keep the price in force then.</p>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addApiPrice}
                  disabled={!priceValid}
                  className="h-9 px-3.5 rounded-md border border-canvas-border text-[0.875rem] font-medium text-ink-700 hover:text-brand-700 hover:border-brand-200 disabled:opacity-40"
                >
                  Add this price
                </button>
              </div>
            </div>

            {prices.length > 0 && (
              <>
                <ul className="mt-4 divide-y divide-canvas-border border-t border-canvas-border">
                  {prices.map(r => (
                    <li key={`${r.workflowId}-${r.effectiveFrom}`} className="py-2.5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[0.875rem] text-ink-900">{nameOf.get(r.workflowId) ?? r.workflowId}</p>
                        <p className="text-[0.75rem] text-ink-500 tabular-nums">
                          {priceLine(r)} · {r.vendor} · {r.apiName} · from {formatDate(r.effectiveFrom)}
                          {r.effectiveTo !== null && <> to {formatDate(r.effectiveTo)}</>}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => dropApiPrice(r)}
                        aria-label={`Remove the price on ${nameOf.get(r.workflowId) ?? r.workflowId}`}
                        className="shrink-0 h-7 w-7 grid place-items-center rounded-md border border-canvas-border text-ink-500 hover:text-risk-700 hover:border-risk-200"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[0.75rem] text-ink-500 tabular-nums">
                  {fmtInt(pricedNow.size)} of {fmtInt(WORKFLOWS.length)} workflows are split. Platform Usage
                  compares that split against the bill and says so when the two disagree.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
