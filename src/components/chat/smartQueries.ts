/**
 * Smart queries — the question bank behind the "Generating smart queries"
 * banner on Ask IRA. Ira "profiles" the attached dataset (or the connected
 * sources when nothing is attached yet) and surfaces ready-to-ask questions
 * grouped by the business process they interrogate.
 *
 * Data-only module: the banner + modal live in SmartQueriesModal.tsx.
 */

export type SmartQueryTone = 'brand' | 'amber' | 'emerald' | 'sky' | 'rose' | 'slate';

export interface SmartQuestion {
  id: string;
  /** Pasted into the composer verbatim on click. */
  text: string;
  /** Short technique chip shown on the card (e.g. "Benford", "Duplicates"). */
  tag: string;
}

export interface SmartQuestionSection {
  /** null → single unlabeled list (most process categories). */
  name: string | null;
  questions: SmartQuestion[];
}

export interface SmartQueryCategory {
  id: string;
  name: string;
  /** One-liner under the name in the category rail. */
  blurb: string;
  /** Accent for the technique chips in this category. */
  tone: SmartQueryTone;
  /** Columns/fields Ira claims to have matched — evidence line in the pane header. */
  signals: string[];
  sections: SmartQuestionSection[];
}

export const SMART_QUERY_CATEGORIES: SmartQueryCategory[] = [
  {
    id: 'anomaly',
    name: 'Anomaly detection',
    blurb: "Benford's Law, pattern breaks & fraud indicators",
    tone: 'brand',
    signals: ['Invoice Amount (₹)', 'Vendor Name', 'Date', 'Status'],
    sections: [
      {
        name: "Benford's Law",
        questions: [
          { id: 'an-b1', tag: 'Benford', text: "Run a Benford's Law first-digit analysis on Invoice Amount and flag the vendors whose distribution deviates the most." },
          { id: 'an-b2', tag: 'Benford', text: "Test payment amounts against Benford's second-digit distribution and list the top 20 outlier transactions with their vendors." },
          { id: 'an-b3', tag: 'Benford', text: "Compare first-two-digit Benford deviation by quarter — did any period drift materially after March?" },
        ],
      },
      {
        name: 'Business patterns',
        questions: [
          { id: 'an-p1', tag: 'Thresholds', text: 'Flag invoices landing just below approval thresholds (₹49,000–₹50,000) and group them by requester.' },
          { id: 'an-p2', tag: 'Round amounts', text: 'Find transactions with round amounts (multiples of ₹10,000) recorded within 3 days of month-end.' },
          { id: 'an-p3', tag: 'Duplicates', text: 'Detect duplicate invoices — same vendor and amount, dates within 7 days, but different invoice numbers.' },
          { id: 'an-p4', tag: 'Timing', text: 'Identify weekend or holiday postings made by users who normally post only on weekdays.' },
        ],
      },
      {
        name: 'Other fraud indicators',
        questions: [
          { id: 'an-f1', tag: 'Collusion', text: 'Match vendor bank accounts against employee bank accounts and list any overlaps.' },
          { id: 'an-f2', tag: 'Ghost vendor', text: 'Find vendors sharing an address, PAN, or phone number with another active vendor.' },
          { id: 'an-f3', tag: 'New vendor', text: 'List payments above ₹1 lakh made to vendors created within 30 days of their first payment.' },
          { id: 'an-f4', tag: 'Sequence', text: 'Flag sequential invoice numbers from the same vendor that arrive out of date order.' },
        ],
      },
    ],
  },
  {
    id: 'procurement',
    name: 'Procurement',
    blurb: 'POs, tendering, receiving & buyer conduct',
    tone: 'amber',
    signals: ['PO No', 'GRN Date', 'Buyer', 'Item Code'],
    sections: [
      {
        name: null,
        questions: [
          { id: 'pr-1', tag: 'Retro PO', text: 'Show purchase orders raised after the invoice date (retrospective POs), grouped by department.' },
          { id: 'pr-2', tag: 'Split orders', text: 'List purchases split across multiple POs to the same vendor within 5 days that together exceed the tender threshold.' },
          { id: 'pr-3', tag: 'Price variance', text: 'Compare unit prices for the same item code across vendors and flag variances above 20%.' },
          { id: 'pr-4', tag: 'Self-approval', text: 'Which buyers approved their own purchase orders, and for what total value?' },
          { id: 'pr-5', tag: 'Over-receipt', text: 'Show GRN quantities exceeding PO quantities, with the receiving user and vendor.' },
        ],
      },
    ],
  },
  {
    id: 'o2c',
    name: 'Order to Cash',
    blurb: 'Billing, receipts, credit notes & revenue timing',
    tone: 'emerald',
    signals: ['Customer', 'Invoice No', 'Receipt Date', 'Credit Note'],
    sections: [
      {
        name: null,
        questions: [
          { id: 'oc-1', tag: 'Unapplied cash', text: 'Age unapplied customer receipts and flag credits parked for more than 90 days.' },
          { id: 'oc-2', tag: 'Cut-off', text: 'Find credit notes issued within 15 days of quarter-end and reversed in the following period.' },
          { id: 'oc-3', tag: 'DSO', text: 'List customers whose days-sales-outstanding worsened by more than 20 days quarter over quarter.' },
          { id: 'oc-4', tag: 'Unbilled', text: 'Show shipments without a matching invoice that are older than 30 days — potential unbilled revenue.' },
          { id: 'oc-5', tag: 'Overrides', text: 'Flag manual price overrides more than 15% below list price, grouped by sales rep.' },
        ],
      },
    ],
  },
  {
    id: 'i2p',
    name: 'Invoice to Pay',
    blurb: '3-way match, payment runs & bank changes',
    tone: 'sky',
    signals: ['Invoice No', 'PO No', 'Payment Ref', 'Bank Account'],
    sections: [
      {
        name: null,
        questions: [
          { id: 'ip-1', tag: '3-way match', text: 'Find three-way-match exceptions — invoice, PO, and GRN mismatches in quantity or amount.' },
          { id: 'ip-2', tag: 'Discounts', text: 'List invoices paid before the due date where the early-payment discount was NOT captured.' },
          { id: 'ip-3', tag: 'Duplicates', text: 'Show duplicate payments — same vendor, amount, and reference appearing across payment runs.' },
          { id: 'ip-4', tag: 'No PO', text: 'Which invoices were paid without a purchase order, and who approved each of them?' },
          { id: 'ip-5', tag: 'Bank change', text: 'Flag vendor bank account changes followed by a payment within 7 days of the change.' },
        ],
      },
    ],
  },
  {
    id: 'je',
    name: 'Journal entries',
    blurb: 'Manual JEs, period-close moves & approvals',
    tone: 'rose',
    signals: ['JE No', 'Preparer', 'Approver', 'Posting Date'],
    sections: [
      {
        name: null,
        questions: [
          { id: 'je-1', tag: 'Post-close', text: 'List manual journal entries posted after period close, by preparer and approver.' },
          { id: 'je-2', tag: 'Round amounts', text: 'Flag journal entries with round amounts above ₹10 lakh posted to revenue or reserve accounts.' },
          { id: 'je-3', tag: 'SoD', text: 'Show entries where the preparer and approver are the same person, or approval happened within 60 seconds of posting.' },
          { id: 'je-4', tag: 'Spikes', text: 'Which GL accounts spiked in the last 5 days of the quarter versus their trailing 90-day average?' },
        ],
      },
    ],
  },
  {
    id: 'vendor',
    name: 'Vendor master',
    blurb: 'Master-data hygiene & change history',
    tone: 'slate',
    signals: ['Vendor Name', 'PAN', 'Bank Account', 'Created By'],
    sections: [
      {
        name: null,
        questions: [
          { id: 've-1', tag: 'Dormant', text: 'List dormant vendors (no activity for 12+ months) that suddenly received a payment this quarter.' },
          { id: 've-2', tag: 'Missing PAN', text: 'Which active vendors are missing a PAN, GSTIN, or bank account on file, and what did we pay them this year?' },
          { id: 've-3', tag: 'One-time', text: 'Show one-time vendors with cumulative payments above ₹5 lakh — should any be registered vendors?' },
          { id: 've-4', tag: 'Changes', text: 'Summarise vendor master changes this quarter by user — who edited bank details most often?' },
        ],
      },
    ],
  },
];

export const SMART_QUERY_QUESTION_COUNT = SMART_QUERY_CATEGORIES
  .reduce((n, c) => n + c.sections.reduce((m, s) => m + s.questions.length, 0), 0);

export const SMART_QUERY_PROCESS_COUNT = SMART_QUERY_CATEGORIES.length;

/**
 * Human label for what Ira analyzed. Attached files/sources win; with nothing
 * attached we fall back to the demo workspace's connected sources so the
 * banner still has something true to say.
 */
export function describeAnalyzedData(
  fileNames: string[],
  sourceNames: string[],
): { label: string; fromAttachment: boolean } {
  const names = [...fileNames, ...sourceNames].filter(Boolean);
  if (names.length === 0) {
    return { label: 'SAP ERP: AP Module · Vendor Master Data · GL Transaction History', fromAttachment: false };
  }
  const shown = names.slice(0, 2).join(' · ');
  const extra = names.length - 2;
  return { label: extra > 0 ? `${shown} +${extra} more` : shown, fromAttachment: true };
}
