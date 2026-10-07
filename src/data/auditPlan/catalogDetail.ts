/**
 * The rest of each standard control's definition — who owns it, the
 * assertions it addresses, and its test attributes (what is checked, how it
 * passes, how it fails, what evidence proves it). A standard control is
 * complete from day one: adapting only points it at the client's data.
 *
 * Attribute tuple: [name, how it's tested, passes when, fails when, evidence].
 */
import type { EvidenceType, TestAttribute } from '../../components/governance/controlTypes';
import { CHECK_CATALOG } from './catalog';

type Attr = [string, string, string, string, EvidenceType];

interface Detail {
  owner: string;
  assertions: string[];
  attrs: Attr[];
}

export const CATALOG_DETAIL: Record<string, Detail> = {
  // ── Procure-to-Pay ──
  'p2p-dup': { owner: 'AP Manager', assertions: ['occurrence', 'accuracy'], attrs: [
    ['Duplicate block is configured', 'Inspect the ERP duplicate-check settings for the period', 'Vendor + reference + amount block active on every company code', 'Block disabled, or tolerance widened without approval', 'System Log'],
    ['Whole population scanned', 'Re-perform the exact and fuzzy match over every posted invoice', 'No unflagged duplicates in the population', 'A duplicate pair posted and paid without a flag', 'Invoice'],
    ['Released flags were approved', 'Trace each released flag to its approver and reason', 'Every release carries AP supervisor sign-off', 'Flag released without approval or reason', 'Approval'],
  ] },
  'p2p-3wm': { owner: 'AP Manager', assertions: ['occurrence', 'accuracy', 'existence'], attrs: [
    ['PO exists and is released', 'Match each paid invoice to a released PO', 'Every paid invoice links to a released PO', 'Invoice paid without a PO or against an unreleased one', 'PO'],
    ['Goods received before payment', 'Compare GRN posting date with payment date', 'GRN posted before the payment run', 'Payment made with no GRN, or a GRN back-dated after payment', 'GRN'],
    ['Price and quantity within tolerance', 'Recompute invoice vs PO vs GRN variance', 'Variance within 2% / ₹10k', 'Variance above tolerance with no DOA override', 'Invoice'],
  ] },
  'p2p-po-approval': { owner: 'Procurement Head', assertions: ['authorization'], attrs: [
    ['Approver holds the right DOA level', 'Map each PO approver to the DOA matrix for its value', 'Approver authorised for the PO value', 'PO approved below the required level', 'Approval'],
    ['No threshold splitting', 'Group same-vendor POs raised within 7 days by the same requester', 'No group sums above a threshold its parts stay under', 'Split POs that dodge a DOA threshold', 'PO'],
    ['DOA in the ERP matches the signed matrix', 'Compare release strategies to the board-approved DOA', 'Limits match the current matrix', 'ERP limits differ from the approved matrix', 'Other'],
  ] },
  'p2p-vendor-master': { owner: 'Vendor Master Team Lead', assertions: ['authorization', 'existence'], attrs: [
    ['Bank changes independently approved', 'Trace each bank-detail change to an approver other than the requester', 'Maker and checker differ on every change', 'Change made and approved by the same user', 'Approval'],
    ['Change verified with the vendor', 'Inspect the call-back or letterhead confirmation for each change', 'Confirmation on file before the change took effect', 'No vendor confirmation on file', 'Other'],
    ['No payment straight after a change', 'Compare change time with the next payment to that vendor', 'No payment within 48 h of an unreviewed change', 'Payment released within 48 h of a bank change', 'System Log'],
  ] },
  'p2p-emp-vendor': { owner: 'Internal Audit Manager', assertions: ['occurrence', 'existence'], attrs: [
    ['Screening covers every active vendor', 'Confirm the screen ran on the full vendor and employee masters', 'Every active vendor screened this month', 'Vendors or employees left out of the screen', 'System Log'],
    ['Matches investigated', 'Trace each bank / address / PAN match to a documented investigation', 'Every match cleared or escalated with notes', 'Match left open beyond 30 days', 'Other'],
    ['Conflicts declared', 'Compare matches to the conflict-of-interest register', 'Every genuine relationship was declared', 'Undeclared employee–vendor relationship', 'Other'],
  ] },
  'p2p-inactive-vendor': { owner: 'AP Manager', assertions: ['occurrence', 'authorization'], attrs: [
    ['Blocked vendors cannot be paid', 'Inspect payment-block flags on blocked vendors', 'Payment block set on every blocked vendor', 'Blocked vendor without a payment block', 'System Log'],
    ['No payments to dormant vendors', 'List payments to vendors inactive for 12+ months', 'Each has a reactivation approval', 'Payment to a dormant vendor without reactivation', 'Approval'],
    ['KYC on file before payment', 'Check PAN and GST for every paid vendor', 'PAN and GST present and valid', 'Vendor paid without valid PAN / GST', 'Other'],
  ] },
  'p2p-price-variance': { owner: 'Procurement Head', assertions: ['valuation', 'accuracy'], attrs: [
    ['Higher-price share reviewed monthly', 'Inspect the monthly price-share review sign-off', 'Review signed within 10 days of month end', 'No review, or signed late', 'Approval'],
    ['Variances explained', 'Trace items where the dearer vendor won >50% to a justification', 'Each has a documented reason (quality, lead time)', 'Unexplained preference for the dearer vendor', 'Other'],
  ] },
  'p2p-weekend-pay': { owner: 'Treasury Manager', assertions: ['authorization', 'occurrence'], attrs: [
    ['Off-cycle payments approved', 'Trace each off-cycle or weekend payment to CFO approval', 'CFO approval before release', 'Released without CFO approval', 'Approval'],
    ['Urgency documented', 'Inspect the reason recorded for each urgent payment', 'A business reason is on file', 'No reason recorded', 'Other'],
    ['Payment run log intact', 'Compare bank file to approved payment proposal', 'Bank file matches the approved proposal', 'Payments added after approval', 'System Log'],
  ] },
  'p2p-backdated': { owner: 'AP Manager', assertions: ['cutoff', 'occurrence'], attrs: [
    ['Receipt date not before invoice date', 'Compare received date with invoice date for every invoice', 'Received date on or after invoice date', 'Received date earlier than invoice date', 'Invoice'],
    ['Period-end receipts in the right period', 'Inspect invoices received ±5 days around period end', 'Recorded in the period received', 'Shifted across the period end', 'Invoice'],
  ] },
  'p2p-doa-review': { owner: 'CFO', assertions: ['authorization'], attrs: [
    ['Matrix reviewed this year', 'Inspect board minutes approving the DOA', 'Approved within the last 12 months', 'No approval in the last 12 months', 'Other'],
    ['ERP limits updated after approval', 'Compare ERP release strategies to the approved matrix', 'Changes applied within 30 days', 'ERP still on the old limits', 'System Log'],
  ] },

  // ── Order-to-Cash ──
  'o2c-price': { owner: 'Sales Operations Manager', assertions: ['accuracy', 'valuation'], attrs: [
    ['Billed at list price', 'Compare billed price with the approved condition record', 'Every line at list or an approved discount', 'Price below list without approval', 'Invoice'],
    ['Discounts approved', 'Trace each manual discount to commercial approval', 'Approval on file before billing', 'Discount without approval', 'Approval'],
    ['Same customer, same price', 'Group lines by material and customer in the period', 'One price per material per customer, or explained', 'Unexplained rate differences', 'Invoice'],
  ] },
  'o2c-credit-limit': { owner: 'Credit Control Manager', assertions: ['authorization', 'valuation'], attrs: [
    ['Over-limit orders blocked', 'Inspect credit-check settings on order types', 'Automatic block on every order type', 'Order types without a credit check', 'System Log'],
    ['Releases approved by credit control', 'Trace each released over-limit order to its approver', 'Released by authorised credit staff only', 'Released by sales or an unauthorised user', 'Approval'],
    ['Exposure monitored', 'Compare released exposure with the customer limit', 'Exposure reviewed weekly', 'Exposure above limit not reviewed', 'Other'],
  ] },
  'o2c-cutoff': { owner: 'Financial Controller', assertions: ['cutoff', 'occurrence'], attrs: [
    ['Revenue matches delivery period', 'Compare billing date with goods-issue date ±5 days of period end', 'Billed in the period goods were delivered', 'Billed before delivery', 'Invoice'],
    ['Cut-off adjustments booked', 'Inspect accrual / deferral journals at period end', 'Adjustments booked for every exception', 'Exceptions left unadjusted', 'Other'],
  ] },
  'o2c-credit-notes': { owner: 'Financial Controller', assertions: ['occurrence', 'authorization'], attrs: [
    ['Credit notes approved', 'Trace each credit note to an approver', 'Approved per DOA before posting', 'Posted without approval', 'Approval'],
    ['Backed by a return or dispute', 'Match each credit note to a return or dispute record', 'Every credit note has a reason document', 'No return or dispute behind it', 'Other'],
    ['No post-period reversals of revenue', 'List credit notes in the first 15 days after period end', 'Reviewed and, where material, adjusted back', 'Material reversal not adjusted', 'Invoice'],
  ] },
  'o2c-unapplied': { owner: 'AR Manager', assertions: ['existence', 'valuation'], attrs: [
    ['Unapplied cash aged', 'Age every unapplied receipt', 'Nothing over 30 days without a note', 'Receipts over 30 days unexplained', 'Other'],
    ['Cleared to the right invoice', 'Trace a sample of applications to remittance advice', 'Applied per the remittance', 'Applied to the wrong invoice or customer', 'Invoice'],
  ] },
  'o2c-customer-master': { owner: 'Credit Control Manager', assertions: ['authorization'], attrs: [
    ['Credit term changes approved', 'Trace term and limit changes to an approver', 'Approved by credit control', 'Changed without approval', 'Approval'],
    ['Maker–checker on the master', 'Compare who changed with who approved', 'Different users', 'Same user changed and approved', 'System Log'],
  ] },

  // ── Record-to-Report ──
  'r2r-manual-je': { owner: 'Financial Controller', assertions: ['occurrence', 'authorization'], attrs: [
    ['High-value journals approved', 'Trace manual journals above ₹10L to approval', 'Approved before posting', 'Posted without approval', 'Approval'],
    ['After-hours postings explained', 'List journals posted after 8 pm, weekends or holidays', 'Each has a documented reason', 'Unexplained off-hours posting', 'System Log'],
    ['Supporting documents attached', 'Inspect support for a sample of manual journals', 'Support agrees to the entry', 'Missing or inconsistent support', 'Other'],
  ] },
  'r2r-sod-je': { owner: 'Financial Controller', assertions: ['authorization'], attrs: [
    ['Preparer is not the approver', 'Compare preparer and approver on every journal', 'Different users on every journal', 'Self-approved journal', 'System Log'],
    ['Workflow cannot be bypassed', 'Inspect posting authorisations for direct-post access', 'No user can post without approval', 'Direct-post access exists', 'System Log'],
  ] },
  'r2r-round': { owner: 'Financial Controller', assertions: ['valuation', 'occurrence'], attrs: [
    ['Round-sum journals reviewed', 'List journals in round lakhs / crores with one-line narratives', 'Each reviewed and supported', 'Unsupported round-sum estimate', 'Other'],
    ['Estimates have a basis', 'Inspect the calculation behind each estimate', 'A documented basis exists', 'No basis for the amount', 'Other'],
  ] },
  'r2r-recon': { owner: 'GL Accountant', assertions: ['completeness', 'accuracy', 'existence'], attrs: [
    ['Every key account reconciled', 'Check the reconciliation log for all key accounts', 'Reconciled within 5 days of month end', 'Account not reconciled or late', 'Other'],
    ['Differences cleared', 'Trace reconciling items to resolution', 'No item over 60 days', 'Stale reconciling items', 'Other'],
    ['Reviewed and signed', 'Inspect preparer and reviewer sign-off', 'Signed by both', 'Missing review', 'Approval'],
  ] },
  'r2r-suspense': { owner: 'GL Accountant', assertions: ['completeness', 'valuation'], attrs: [
    ['Suspense cleared within 30 days', 'Age every open suspense item', 'Nothing older than 30 days', 'Items older than 30 days', 'Other'],
    ['Clearing entries correct', 'Trace a sample of clearings to their final account', 'Cleared to the right account', 'Misclassified clearing', 'Other'],
  ] },
  'r2r-topside': { owner: 'CFO', assertions: ['occurrence', 'valuation', 'authorization'], attrs: [
    ['Every top-side entry supported', 'Inspect support for each consolidation adjustment', 'Support agrees to the entry', 'Missing or inconsistent support', 'Other'],
    ['Approved by the CFO', 'Trace each entry to CFO sign-off', 'Signed before the pack closes', 'No sign-off', 'Approval'],
  ] },

  // ── Source-to-Contract ──
  's2c-contract': { owner: 'Contracts Manager', assertions: ['occurrence', 'authorization'], attrs: [
    ['Invoices fall inside a live contract', 'Match invoices to contract validity dates', 'Every invoice dated within the contract term', 'Spend after expiry', 'Invoice'],
    ['Spend within the contract cap', 'Sum spend per contract against its cap', 'Spend at or below the cap', 'Spend above the cap without an amendment', 'Other'],
    ['Scope respected', 'Compare invoiced items to contract scope', 'Every line in scope', 'Out-of-scope lines billed', 'Invoice'],
  ] },
  's2c-single-source': { owner: 'Procurement Head', assertions: ['authorization'], attrs: [
    ['Three bids above threshold', 'Count bids for each award above ₹25L', 'Three bids, or a justification', 'Fewer bids and no justification', 'Other'],
    ['Justification approved', 'Trace single-source justifications to approval', 'Approved per DOA', 'Unapproved justification', 'Approval'],
  ] },
  's2c-concentration': { owner: 'Procurement Head', assertions: ['completeness'], attrs: [
    ['Concentration reviewed quarterly', 'Inspect the quarterly concentration review', 'Reviewed within the quarter', 'No review', 'Approval'],
    ['Dependencies have a mitigation', 'Check vendors above 30% category share for a mitigation plan', 'Plan documented', 'No plan for a critical dependency', 'Other'],
  ] },
  's2c-onboarding': { owner: 'Vendor Master Team Lead', assertions: ['existence', 'authorization'], attrs: [
    ['KYC complete before activation', 'Inspect onboarding files for new vendors', 'KYC, PAN, GST and bank proof on file', 'Activated with missing KYC', 'Other'],
    ['Sanctions screened', 'Check sanctions screening evidence', 'Screened before activation', 'Not screened', 'System Log'],
    ['Activation approved', 'Trace activation to procurement approval', 'Approved before first PO', 'No approval', 'Approval'],
  ] },

  // ── Inventory ──
  'inv-negative': { owner: 'Inventory Controller', assertions: ['existence', 'accuracy'], attrs: [
    ['Negative stock disallowed', 'Inspect plant settings for negative stock', 'Disallowed on every plant', 'Allowed on a plant', 'System Log'],
    ['Negative balances investigated', 'List days with negative book stock and trace to investigation', 'Each investigated and corrected', 'Uninvestigated negative balance', 'Other'],
  ] },
  'inv-writeoff': { owner: 'Plant Controller', assertions: ['authorization', 'valuation'], attrs: [
    ['Write-offs approved per DOA', 'Trace scrap and write-off movements above ₹1L to approval', 'Approved at the right DOA level', 'Posted without approval', 'Approval'],
    ['Physical disposal evidenced', 'Inspect disposal certificates for scrapped stock', 'Certificate on file', 'No disposal evidence', 'Other'],
    ['Posted to the right GL', 'Check the GL account on write-off movements', 'Booked to the write-off account', 'Booked elsewhere', 'System Log'],
  ] },
  'inv-slow': { owner: 'Inventory Controller', assertions: ['valuation'], attrs: [
    ['Slow-moving list reviewed', 'Inspect the quarterly slow-moving review', 'Reviewed and signed each quarter', 'No review', 'Approval'],
    ['Provision booked', 'Compare provision to the ageing policy', 'Provision per policy', 'Under-provided obsolete stock', 'Other'],
  ] },
  'inv-count': { owner: 'Inventory Controller', assertions: ['existence', 'completeness'], attrs: [
    ['Counts cover the plan', 'Compare completed counts to the cycle-count plan', 'Plan completed for the period', 'Locations not counted', 'Other'],
    ['Variances investigated before posting', 'Trace variances above 2% to investigation', 'Investigated before adjustment', 'Adjusted without investigation', 'Approval'],
    ['Recounts by a different person', 'Compare counter and recounter', 'Different people', 'Same person recounted', 'Other'],
  ] },
  'inv-grn-backdated': { owner: 'Stores Manager', assertions: ['cutoff'], attrs: [
    ['Posting date matches arrival', 'Compare GRN posting date with entry date', 'Within 3 days', 'Back-dated more than 3 days', 'GRN'],
    ['Period-end GRNs in the right period', 'Inspect GRNs ±5 days of period end', 'Recorded in the arrival period', 'Shifted across the period end', 'GRN'],
  ] },
  'inv-nrv': { owner: 'Financial Controller', assertions: ['valuation'], attrs: [
    ['NRV computed each quarter', 'Inspect the NRV working', 'Prepared and reviewed', 'No working', 'Other'],
    ['Provision matches the working', 'Compare the provision journal to the working', 'Agrees', 'Differs without explanation', 'Approval'],
  ] },

  // ── IT General Controls ──
  'itgc-terminated': { owner: 'IT Security Manager', assertions: ['authorization'], attrs: [
    ['Leavers removed within 24 h', 'Compare HR exit dates with ERP deactivation dates', 'Deactivated within 24 h', 'Active beyond 24 h', 'System Log'],
    ['No logins after exit', 'Check login history after each exit date', 'No post-exit logins', 'Login after exit', 'System Log'],
  ] },
  'itgc-privileged': { owner: 'IT Security Manager', assertions: ['authorization'], attrs: [
    ['Privileged sessions logged', 'Confirm the security audit log is on for privileged users', 'Logging active', 'Logging off for a privileged user', 'System Log'],
    ['Sessions reviewed weekly', 'Inspect weekly review sign-off', 'Reviewed every week', 'Missed weeks', 'Approval'],
    ['Changes during sessions authorised', 'Trace changes in long sessions to tickets', 'Every change has a ticket', 'Unticketed change', 'System Log'],
  ] },
  'itgc-sod': { owner: 'IT Security Manager', assertions: ['authorization'], attrs: [
    ['Rule-set is current', 'Confirm the SoD rule-set version and approval', 'Approved this year', 'Outdated rule-set', 'Other'],
    ['Conflicts removed or mitigated', 'List users with conflicting roles', 'Each removed or has a mitigating control', 'Unmitigated conflict', 'System Log'],
  ] },
  'itgc-change': { owner: 'IT Change Manager', assertions: ['authorization'], attrs: [
    ['Every deployment has an approved ticket', 'Match deployments to change tickets', 'Approved before deploy', 'Deployed without approval', 'System Log'],
    ['Tested before production', 'Inspect test evidence on the ticket', 'Test sign-off present', 'No test evidence', 'Other'],
    ['Developers can’t deploy', 'Check production access for developers', 'No developer has deploy rights', 'Developer with deploy rights', 'System Log'],
  ] },
  'itgc-uar': { owner: 'IT Security Manager', assertions: ['authorization', 'existence'], attrs: [
    ['Review completed this quarter', 'Inspect recertification sign-offs for each system', 'Signed by every business owner', 'Missing sign-off', 'Approval'],
    ['Removals actioned', 'Trace access marked for removal to deactivation', 'Removed within 5 days', 'Still active', 'System Log'],
  ] },
};

/** Test attributes for a standard control, in the shape the Control Library
 *  and control detail page use. */
export function stdAttributes(key: string, controlId: string): TestAttribute[] {
  const d = CATALOG_DETAIL[key];
  if (!d) return [];
  return d.attrs.map(([name, how, pass, fail, evidence], i) => ({
    id: `${controlId}-A${i + 1}`,
    label: `A${i + 1}`,
    name,
    description: how,
    evidenceRequired: true,
    evidenceType: evidence,
    mandatory: i === 0 || d.attrs.length <= 2,
    passCriteria: pass,
    failureCriteria: fail,
    status: 'Active',
  }));
}

export const stdOwner = (key: string) => CATALOG_DETAIL[key]?.owner ?? 'Control owner';
export const stdAssertions = (key: string) => CATALOG_DETAIL[key]?.assertions ?? [];

/** Every catalog entry has its detail — a guard for anyone adding controls. */
export const MISSING_DETAIL = CHECK_CATALOG.filter(e => !CATALOG_DETAIL[e.key]).map(e => e.key);
