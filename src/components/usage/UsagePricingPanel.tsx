/**
 * PU-19 · Cost the paid lookups, invoice first.
 *
 * The platform verifies things against outside registries and somebody bills us
 * for those calls. Every one of those calls is already recorded, so the only
 * thing standing between the page and a real cost is what we paid.
 *
 * The spec's three layers, in the order they are worth doing:
 *
 * **Layer 1** needs nothing entered: the volume is already counted.
 *
 * **Layer 2, the primary input.** One number a month: the vendor's bill. Nobody
 * filling a price form reliably knows a per-API rate, or whether a workflow
 * bills once a run or once a row. Everybody knows the number on the invoice, and
 * summed over a window it is exact and reconciles against what finance paid.
 *
 * **Layer 3, optional.** Per-API prices, only if the business wants the cost
 * split per workflow. Its total for a month should land on the invoice for the
 * same month, and where it does not, the gap is shown rather than hidden.
 *
 * Both follow the settings-editor pattern: entered values are visible next to
 * every figure they produce, every change is audited, and a renegotiated price
 * starts a new row rather than rewriting an old one.
 */

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '../shared/Modal';
import { BTN_CANCEL, FIELD_INPUT, FIELD_LABEL } from '../admin/adminTokens';
import {
  ANCHOR, addInvoice, addPrice, formatDate, isoDay, loadInvoices, loadPricing, removeInvoice, removePrice,
  startOfMonthUtc, type VendorInvoice, type WorkflowApiPrice,
} from '../../data/platform-usage';
import { WORKFLOWS } from '../../data/mockData';
import { Drill } from './usageKit';
import { fmtInt } from '../../data/platform-usage-metrics';

/**
 * Money to the paisa.
 *
 * The page's usual money format rounds to whole rupees, which is right for a
 * saving of eighty five lakh and wrong for a rate of one rupee seventy five:
 * printed as "2" it is a different contract.
 */
const RUPEES = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const rupees = (paise: number): string => RUPEES.format(paise / 100);

const MONTH_FMT = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (ms: number): string => MONTH_FMT.format(new Date(ms));

/** A moment as the month input wants it. */
const monthValue = (ms: number): string => new Date(ms).toISOString().slice(0, 7);

/** "3 bills", said the way the rest of the page says counts. */
const bills = (n: number): string => `${fmtInt(n)} ${n === 1 ? 'bill' : 'bills'}`;

/** What a run of this workflow costs, per the row in force. */
const priceLine = (row: WorkflowApiPrice): string =>
  `${rupees(row.pricePaise)} per ${row.billingUnit === 'row' ? 'row checked' : 'run'}`;

export default function UsagePricingPanel({
  enteredBy,
  onClose,
  onSaved,
}: {
  /** Whoever is signed in. A bill carries who entered it, like the settings. */
  enteredBy: string;
  onClose: () => void;
  /** Told what changed, so the page can log it and recalculate. */
  onSaved: (change: string) => void;
}) {
  /* ── Layer 2 · the month's bill ───────────────────────────────────────── */

  const [invoices, setInvoices] = useState<VendorInvoice[]>(() => loadInvoices());
  const [vendor, setVendor] = useState('');
  const [month, setMonth] = useState(() => monthValue(ANCHOR));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const billAmount = Number(amount);
  const billValid = vendor.trim() !== '' && Number.isFinite(billAmount) && billAmount > 0;

  const addBill = () => {
    if (!billValid) return;
    const parsed = Date.parse(`${month}-01T00:00:00Z`);
    if (Number.isNaN(parsed)) return;
    const periodMonth = startOfMonthUtc(parsed);
    setInvoices(addInvoice({
      vendor: vendor.trim(),
      periodMonth,
      amountPaise: Math.round(billAmount * 100),
      note: note.trim() || null,
      enteredBy,
      enteredAt: ANCHOR,
    }));
    onSaved(`Entered ${vendor.trim()}'s bill for ${monthLabel(periodMonth)}: ${rupees(Math.round(billAmount * 100))}`);
    setAmount('');
    setNote('');
  };

  const dropBill = (i: VendorInvoice) => {
    setInvoices(removeInvoice(i.vendor, i.periodMonth));
    onSaved(`Removed ${i.vendor}'s bill for ${monthLabel(i.periodMonth)}`);
  };

  /* ── Layer 3 · the optional per-API split ─────────────────────────────── */

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
    onSaved(`Split "${name}" at ${rupees(Math.round(priceAmount * 100))} per ${unit === 'row' ? 'row' : 'run'} from ${formatDate(effectiveFrom)}`);
    setPriceText('');
    setApiVendor('');
    setApiName('');
    setUnit('');
  };

  const dropApiPrice = (r: WorkflowApiPrice) => {
    setPrices(removePrice(r.workflowId, r.effectiveFrom));
    onSaved(`Removed the per API price on "${nameOf.get(r.workflowId) ?? r.workflowId}" from ${formatDate(r.effectiveFrom)}`);
  };

  const billed = invoices.reduce((sum, i) => sum + i.amountPaise, 0);

  return (
    <Modal
      title="Cost the paid lookups"
      subtitle="The calls are already counted. Enter the vendor's monthly bill and every period it covers is costed exactly, backwards through the record."
      width="max-w-[720px]"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.75rem] text-ink-500">
            Every figure you enter is shown next to the numbers it produces, and every change is on the record.
          </p>
          <button type="button" className={BTN_CANCEL} onClick={onClose}>Done</button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── The bill ────────────────────────────────────────────────────── */}
        <div>
          <h4 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-400">The month's bill</h4>
          <p className="mt-1 text-[0.75rem] text-ink-500">
            One row per vendor per month, the number as it appears on the invoice. The cost figure is the sum of
            these, so it is the same number finance reconciles.
          </p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label className={FIELD_LABEL} htmlFor="bill-vendor">Vendor</label>
              <input
                id="bill-vendor" value={vendor} onChange={e => setVendor(e.target.value)}
                className={FIELD_INPUT} placeholder="Who billed us"
              />
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="bill-month">Month</label>
              <input
                id="bill-month" type="month" value={month} onChange={e => setMonth(e.target.value)}
                className={`${FIELD_INPUT} tabular-nums`}
              />
              <p className="mt-1 text-[0.75rem] text-ink-500">Past months can be entered at any time.</p>
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="bill-amount">Amount in rupees</label>
              <input
                id="bill-amount" type="number" min={0} step="0.01" value={amount}
                onChange={e => setAmount(e.target.value)}
                className={`${FIELD_INPUT} tabular-nums`} placeholder="0.00"
              />
            </div>

            <div>
              <label className={FIELD_LABEL} htmlFor="bill-note">Note</label>
              <input
                id="bill-note" value={note} onChange={e => setNote(e.target.value)}
                className={FIELD_INPUT} placeholder="Credit note, dispute, anything worth saying"
              />
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
            <p className="mt-4 text-[0.875rem] text-ink-500">
              No bill entered yet, so the page says the period has no invoice rather than showing a cost built from
              a guess.
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
                {bills(invoices.length)} entered, {rupees(billed)} in total. A window is costed once every month in
                it has its bill.
              </p>
            </>
          )}
        </div>

        {/* ── The optional split ──────────────────────────────────────────── */}
        <div className="pt-5 border-t border-canvas-border">
          <Drill label="Split the bill per API (optional)" hideLabel="Hide the per API split">
            <p className="text-[0.75rem] text-ink-500">
              Only worth filling if the business wants the cost split per workflow. The unit has no default on
              purpose: a run checking 500 vendors usually makes 500 calls, and guessing that puts the split out by a
              thousandfold. The bill above needs none of this.
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div className="sm:col-span-2">
                <label className={FIELD_LABEL} htmlFor="price-workflow">Workflow</label>
                <select
                  id="price-workflow" value={workflowId}
                  onChange={e => setWorkflowId(e.target.value)} className={FIELD_INPUT}
                >
                  {WORKFLOWS.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}{pricedNow.has(w.id) ? ' (split)' : ''}
                    </option>
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
                <select
                  id="price-unit" value={unit}
                  onChange={e => setUnit(e.target.value as 'run' | 'row' | '')} className={FIELD_INPUT}
                >
                  <option value="">Pick one</option>
                  <option value="run">Run, one call however many rows</option>
                  <option value="row">Row, one call for every row checked</option>
                </select>
              </div>

              <div>
                <label className={FIELD_LABEL} htmlFor="price-amount">Price in rupees</label>
                <input
                  id="price-amount" type="number" min={0} step="0.01" value={priceText}
                  onChange={e => setPriceText(e.target.value)}
                  className={`${FIELD_INPUT} tabular-nums`} placeholder="0.00"
                />
                <p className="mt-1 text-[0.75rem] text-ink-500">Charged on a call that succeeds.</p>
              </div>

              <div>
                <label className={FIELD_LABEL} htmlFor="price-from">In force from</label>
                <input
                  id="price-from" type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className={`${FIELD_INPUT} tabular-nums`}
                />
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
                  {fmtInt(pricedNow.size)} of {fmtInt(WORKFLOWS.length)} workflows are split. The page compares that
                  split against the bill and says so when the two disagree.
                </p>
              </>
            )}
          </Drill>
        </div>
      </div>
    </Modal>
  );
}
