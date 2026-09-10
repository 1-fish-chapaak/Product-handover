/**
 * The connector catalogue — every external lookup this build can run.
 *
 * Transcribed from the backend catalog (`connectors/catalog/govt_kyc.py`,
 * `govt_kyb.py`, `stub.py`), which is where the real thing lives. A row here is
 * a declaration the run bills against, so the fields are the declaration's
 * fields and nothing else: there is no connection, no credential, no cap and no
 * per-workspace rate, because the tables behind those were removed and the
 * catalogue is identical for every workspace.
 *
 * The price on a row is a build constant, not a quote. Where the backend
 * declares no price the row carries `null`, and every surface reading it has to
 * keep that apart from zero: "not priced" shown as ₹0.00 invites approving a
 * spend nobody was quoted, and shown as "Free" it invites running a paid lookup
 * believing it costs nothing.
 */

export interface ConnectorOperation {
  op_key: string;
  op_version: string;
  /** The gate key an environment enables in CONNECTORS_ENABLED. */
  connector_kind: string;
  title: string;
  cardinality: string;
  /** `always_live` | `ttl:<n>d` — how long the GATEWAY may reuse a response.
   *  Advisory, and it must be read that way: nothing is stored on our side, so
   *  this describes the provider's window rather than a promise of ours. */
  freshness: string;
  inputs: string[];
  outputs: string[];
  billable: boolean;
  /** Both gates passed: the kind is enabled AND the response shape has been
   *  verified against a recorded fixture. */
  enabled: boolean;
  outputs_verified: boolean;
  /** Cost of ONE call. `null` means no price is on file — render "not priced",
   *  never 0 and never "free". */
  unit_price: number | null;
  currency: string;
  /** `any_response` | `success` — whether a lookup that finds nothing is still
   *  charged. On most aggregator contracts it is, which changes what a run over
   *  a dirty column costs. */
  bill_on: string | null;
}

const ANY_RESPONSE = 'any_response';
const TTL_14D = 'ttl:14d';

/** The declared operations, in the order the backend declares them.
 *
 *  Every one is listed, including the test stub, because the filters below are
 *  what decide which surface shows what. A catalogue trimmed at source cannot
 *  be checked against the backend it claims to mirror.
 */
export const CONNECTOR_OPERATIONS: ConnectorOperation[] = [
  {
    op_key: 'govt.pan_basic',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: "Verify a PAN and return the registered holder's name and status.",
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['pan'],
    outputs: ['pan', 'name', 'status', 'name_validated', 'name_match', 'name_match_score'],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.pan_details_plus',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Verify a PAN with an expected name and return the fuller holder profile, including the name-match result.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['pan', 'name'],
    outputs: [
      'pan', 'fullname', 'first_name', 'middle_name', 'last_name', 'pan_status', 'pan_type',
      'pan_allotment_date', 'is_director', 'is_salaried', 'is_sole_proprietor',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.driving_licence',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Verify a driving licence number against its date of birth.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['dl_number', 'dob'],
    outputs: [
      'dl_number', 'holder_name', 'status', 'date_of_issue', 'date_of_last_transaction',
      'issuing_authority', 'non_transport_valid_from', 'non_transport_valid_to',
      'transport_valid_from', 'transport_valid_to',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.voter_id',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Verify a voter ID (EPIC) number and return the roll entry.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['epic_number'],
    outputs: [
      'epic_no', 'name', 'gender', 'age', 'is_active', 'status_type', 'state', 'district',
      'assembly_constituency', 'assembly_constituency_no', 'parliamentary_constituency',
      'part_number', 'section_number', 'serial_in_part', 'polling_station', 'last_update',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.passport',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Verify a passport file number against its date of birth.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['file_number', 'dob'],
    outputs: [
      'file_number', 'application_type', 'application_date', 'date_of_dispatch', 'given_name',
      'surname',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.vehicle_rc',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Look up a vehicle registration certificate by registration number.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['reg_no'],
    outputs: [
      'reg_no', 'status', 'status_as_on', 'reg_date', 'rc_expiry_date', 'owner_name',
      'owner_count', 'reg_authority', 'rto_code', 'vehicle_class', 'vehicle_category',
      'body_type', 'model', 'manufacturer', 'manufactured_month_year', 'colour', 'chassis',
      'engine', 'norms_type', 'is_commercial', 'financed', 'rc_financer', 'insurer',
      'insurance_policy_number', 'insurance_valid_upto', 'pucc_number', 'pucc_valid_upto',
      'tax_valid_upto', 'blacklist_status',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.uan_advanced',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Look up an EPFO Universal Account Number, and the employment history recorded against that provident-fund account.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['uan'],
    outputs: [
      'uan', 'uan_count', 'is_employed', 'date_of_exit_marked', 'employer_name',
      'employer_establishment_id', 'date_of_joining', 'date_of_exit', 'leave_reason',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.email_verification',
    op_version: 'v1',
    connector_kind: 'govt-kyc',
    title: 'Check whether an email address is deliverable and how risky it looks.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['email'],
    outputs: [
      'is_email_valid', 'is_verified', 'email_name', 'is_generic_email', 'is_webmail',
      'is_mx_records_present', 'is_smtp_server_valid', 'is_smtp_email_valid',
      'domain_created_on', 'domain_updated_on', 'domain_expires_on', 'domain_is_expired',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.gst_basic',
    op_version: 'v1',
    connector_kind: 'govt-kyb',
    title: "Verify a GSTIN and return the registered taxpayer's particulars and registration status.",
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['gstin'],
    outputs: [
      'gstin', 'status', 'legal_name', 'trade_name', 'registration_date', 'cancellation_date',
      'constitution', 'taxpayer_type', 'principal_address', 'state_jurisdiction',
      'centre_jurisdiction', 'aadhaar_verified', 'einvoice_enabled',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.gst_advanced',
    op_version: 'v1',
    connector_kind: 'govt-kyb',
    title: "Look up a GSTIN's full profile: particulars, filing history and return-compliance detail beyond the basic registration check.",
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['gstin'],
    outputs: [
      'gstin', 'status', 'legal_name', 'trade_name', 'registration_date', 'cancellation_date',
      'constitution', 'taxpayer_type', 'principal_address', 'state_jurisdiction',
      'centre_jurisdiction', 'aadhaar_verified', 'einvoice_enabled', 'einvoice_mandated',
      'aggregate_turnover', 'aggregate_turnover_fy', 'gross_total_income',
      'gross_total_income_fy', 'percent_tax_in_cash', 'late_filings_total', 'late_filings_gstr1',
      'late_filings_gstr3b', 'late_filings_gstr9',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.gst_by_pan',
    op_version: 'v1',
    connector_kind: 'govt-kyb',
    title: 'Find every GST registration held against a PAN, across states.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['pan'],
    outputs: ['registration_count'],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.udyam_basic',
    op_version: 'v1',
    connector_kind: 'govt-kyb',
    title: 'Verify a Udyam (MSME) registration number and return its particulars.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['udyam_reg_no'],
    outputs: [
      'udyam_reg_no', 'registration_date', 'enterprise_name', 'enterprise_type',
      'organization_type', 'major_activity', 'date_of_incorporation', 'date_of_commencement',
      'social_category', 'udyam_category', 'district_industries_center', 'msme_dfo',
      'official_city', 'official_district', 'official_state', 'official_pincode',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.udyam_by_pan',
    op_version: 'v1',
    connector_kind: 'govt-kyb',
    title: 'Find the Udyam (MSME) registration held against a PAN.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['pan'],
    outputs: [
      'udyam_reg_no', 'enterprise_name', 'enterprise_type', 'organization_type',
      'major_activity', 'registration_date', 'date_of_incorporation', 'date_of_commencement',
      'social_category', 'district_industries_center', 'msme_dfo', 'official_city',
      'official_district', 'official_state', 'official_pincode',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 15,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    op_key: 'govt.cin_advanced',
    op_version: 'v1',
    connector_kind: 'govt-kyb',
    title: 'Look up a company by CIN: incorporation particulars, directors and filing status from the MCA register.',
    cardinality: 'enrich',
    freshness: TTL_14D,
    inputs: ['cin'],
    outputs: [
      'cin', 'company_name', 'company_status', 'class_of_company', 'company_category',
      'company_subcategory', 'date_of_incorporation', 'registered_address', 'registered_city',
      'registered_state', 'registered_pincode', 'registration_number', 'roc_code',
      'authorised_capital', 'paid_up_capital', 'number_of_members', 'date_of_last_agm',
      'date_of_balance_sheet', 'active_compliance', 'whether_listed', 'status_under_cirp',
    ],
    billable: true,
    enabled: true,
    outputs_verified: true,
    unit_price: 10,
    currency: 'INR',
    bill_on: ANY_RESPONSE,
  },
  {
    // The local test stub. A real entry in a dev build, and deliberately not a
    // government one: listing it under Govt APIs would state something untrue
    // about where the data came from. `isGovtKind` is what keeps it off.
    op_key: 'stub.reference_check',
    op_version: 'v1',
    connector_kind: 'test-stub',
    title: 'TEST CONNECTOR. It returns synthetic data from a local stub, never a real registry.',
    cardinality: 'enrich',
    freshness: 'ttl:1h',
    inputs: ['ref_code'],
    outputs: [],
    billable: false,
    enabled: false,
    outputs_verified: true,
    unit_price: null,
    currency: 'INR',
    bill_on: null,
  },
];

/* ── display helpers ─────────────────────────────────────────────────────── */

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€' };

/** Money, with "not priced" kept distinct from zero.
 *
 *  The reader has to be able to tell "this is free" from "we do not know what
 *  this costs". Mirrors `connectors/catalog/base.py:format_amount`. */
export function formatSpendAmount(amount: number | null, currency = 'INR'): string {
  if (amount == null) return 'not priced';
  const symbol = SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Why an operation cannot be used yet, or `null` when it can.
 *
 *  Two gates fail for different reasons and need different remedies, so they
 *  must not collapse into one "unavailable" state: an unverified operation is
 *  waiting on us, a disabled one is waiting on a deploy. */
export function operationBlockedReason(op: ConnectorOperation): string | null {
  if (!op.outputs_verified) return 'Response shape not verified yet, so it cannot be enabled.';
  if (!op.enabled) return 'Not switched on in this environment.';
  return null;
}

/** Plain-language freshness, for a screen whose reader is an auditor rather
 *  than an engineer.
 *
 *  Every label says re-asked, never frozen, and that is the product behaviour
 *  rather than a limitation: a registry answer is current state, so a re-run is
 *  asking about today and must be able to come back different. The window below
 *  only says how long the provider may answer from its own cache. */
export function freshnessLabel(freshness: string): string {
  if (freshness === 'always_live') return 'Always re-asked';
  const ttl = /^ttl:(\d+)([dh])$/.exec(freshness);
  if (ttl) {
    const [, n, unit] = ttl;
    const window = `${n} ${unit === 'd' ? 'day' : 'hour'}${n === '1' ? '' : 's'}`;
    return `Re-asked, and the provider may reuse its answer for ${window}`;
  }
  // Unrecognised value, so say what the code DOES rather than what the string
  // claims. Every path re-asks.
  return 'Re-asked on every run';
}

/** Is this a government registry lookup?
 *
 *  Prefix-matched rather than compared against a fixed list, so a second
 *  statutory family (`govt-mca`, say) appears on the Govt APIs tab the day the
 *  backend declares it. */
export function isGovtKind(kind: string): boolean {
  return kind.startsWith('govt');
}

/** The government operations, ordered by op_key.
 *
 *  Sorted by key rather than by availability so a row does not move when an
 *  operation is switched on. A table whose rows move is one nobody can cite. */
export function govtOperations(operations: ConnectorOperation[]): ConnectorOperation[] {
  return operations
    .filter(op => isGovtKind(op.connector_kind))
    .sort((a, b) => a.op_key.localeCompare(b.op_key));
}

/* ── table rows ──────────────────────────────────────────────────────────── */

/** One row of the Govt APIs table.
 *
 *  A type alias rather than an interface because `SmartTable<T>` constrains T
 *  to `Record<string, unknown>`, which an interface cannot satisfy. The flat
 *  string fields exist so the table's own search and sort work on what the
 *  reader can see; `operation` rides along for the cells that need the raw
 *  declaration. */
export type GovtApiRow = {
  id: string;
  title: string;
  opKey: string;
  provides: string;
  returns: string;
  cost: string;
  refresh: string;
  operation: ConnectorOperation;
};

export function toGovtApiRow(op: ConnectorOperation): GovtApiRow {
  return {
    id: op.op_key,
    title: op.title,
    opKey: op.op_key,
    provides: op.inputs.join(', ') || '—',
    returns: op.outputs.join(', ') || '—',
    cost: operationCostLabel(op),
    refresh: freshnessLabel(op.freshness),
    operation: op,
  };
}

/* ── price ───────────────────────────────────────────────────────────────── */

/** Headline price for one call.
 *
 *  Three states that must stay distinguishable: free (never bills), priced, and
 *  unpriced (billable, no price declared). */
export function operationCostLabel(op: ConnectorOperation): string {
  if (!op.billable) return 'Free';
  if (op.unit_price == null) return 'Not priced';
  return `${formatSpendAmount(op.unit_price, op.currency)} / call`;
}

const BILL_ON_PHRASE: Record<string, string> = {
  any_response: 'Charged on any response, including “no record found”',
  success: 'Charged only when a record is found',
};

/** The qualifiers behind the headline price, as a sentence.
 *
 *  `bill_on` is the one most likely to surprise: a lookup over a column with
 *  bad values still costs money on most contracts, so someone sizing a run
 *  needs it before they approve rather than after they are invoiced. */
export function operationCostDetail(op: ConnectorOperation): string {
  if (!op.billable) return 'This operation never bills.';
  if (op.unit_price == null) {
    return 'No price is declared for this lookup yet, so the cost is unknown rather than free.';
  }
  const billing = op.bill_on ? (BILL_ON_PHRASE[op.bill_on] ?? op.bill_on) : 'Charged per call';
  return `${billing}.`;
}
