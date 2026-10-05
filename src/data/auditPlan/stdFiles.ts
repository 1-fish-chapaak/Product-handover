/**
 * Standard input files — what the standard library's workflows read, named
 * the way auditors ask for them: the SAP report / table code plus a plain
 * name for non-SAP clients.
 *
 * Every catalog `dataNeeds` entry resolves to one of these, so adapting a
 * selection of controls asks for each file once, however many workflows it
 * feeds. `matches` is the Knowledge Hub source a file auto-matches when it's
 * already connected; files without one have to be uploaded.
 */
import type { CatalogEntry } from './catalog';
import { isFreshWorkspace } from './workspace';

export interface StandardFile {
  id: string;
  /** SAP report / table code, e.g. ME2N. */
  code: string;
  name: string;
  hint: string;
  /** Knowledge Hub source (SEED name) this file auto-matches, if connected. */
  matches?: string;
  /** Rough row count of the matched source, for the analysis trail. */
  rows?: string;
}

/** Words an uploaded file's name may use for each standard file — how a
 *  bulk drop places "Sales_Orders_FY26.xlsx" into VA05 without asking. */
const ALIASES: Record<string, string[]> = {
  fbl1n: ['vendor line', 'ap invoice', 'invoice register', 'payment register', 'payments', 'accounts payable'],
  me2n: ['purchase order', 'po list', 'po register', 'pos'],
  mb51: ['material movement', 'material document', 'goods receipt', 'grn', 'movements', 'stock movement'],
  mb5b: ['stock on posting', 'stock balance', 'closing stock', 'stock'],
  mara: ['material master', 'materials'],
  mi24: ['physical inventory', 'count', 'cycle count', 'stock take'],
  lfa1: ['vendor master', 'supplier master', 'vendors'],
  cdhdr: ['change document', 'change log', 'master data change'],
  pa0001: ['employee', 'hr master', 'staff', 'leavers'],
  doa: ['delegation', 'authority', 'approval matrix', 'doa'],
  va05: ['sales order', 'orders'],
  vf05: ['billing', 'sales invoice', 'credit note', 'invoices'],
  vl06o: ['deliver', 'outbound', 'dispatch', 'shipment'],
  kna1: ['customer master', 'customers', 'credit limit'],
  vk13: ['pricing', 'price list', 'condition'],
  fbl5n: ['customer line', 'receivable', 'receipts', 'collections', 'ar ledger'],
  fagll03: ['gl line', 'journal', 'general ledger', 'je'],
  f01: ['trial balance', 'tb'],
  suim: ['user list', 'users', 'roles', 'user access'],
  sm20: ['security audit', 'audit log', 'privileged', 'session log'],
  sod: ['sod', 'segregation', 'rule set', 'ruleset', 'conflict'],
  chg: ['change ticket', 'deployment', 'itsm', 'release', 'jira'],
  me3n: ['contract', 'outline agreement', 'agreements'],
  me4n: ['rfq', 'quotation', 'bids', 'sourcing'],
};

/** Best standard file for an uploaded file's name, among the candidates —
 *  SAP code first (MB51_Jan.xlsx), then the plain-language aliases. */
export function placeUpload(fileName: string, candidates: StandardFile[]): StandardFile | undefined {
  const n = fileName.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[_\-.]+/g, ' ');
  const tokens = new Set(n.split(/\s+/));
  const byCode = candidates.find(f => tokens.has(f.code.toLowerCase().replace(/\./g, '')) || tokens.has(f.code.toLowerCase()));
  if (byCode) return byCode;
  let best: { f: StandardFile; score: number } | undefined;
  for (const f of candidates) {
    for (const a of ALIASES[f.id] ?? []) {
      const hit = a.includes(' ') ? n.includes(a) : tokens.has(a) || tokens.has(`${a}s`);
      // Longer aliases are more specific — "vendor master" beats "vendors".
      if (hit && (!best || a.length > best.score)) best = { f, score: a.length };
    }
  }
  return best?.f;
}

export const STANDARD_FILES: StandardFile[] = [
  { id: 'fbl1n', code: 'FBL1N', name: 'Vendor line items', hint: 'AP invoices and payments, with document and clearing dates', matches: 'SAP ERP: AP Module', rows: '1.2M rows' },
  { id: 'me2n', code: 'ME2N', name: 'Purchase orders', hint: 'PO lines with vendor, value, approver and release status', matches: 'SAP ERP: AP Module', rows: '1.2M rows' },
  { id: 'mb51', code: 'MB51', name: 'Material movements', hint: 'Goods receipts, issues, scrap and transfers by movement type' },
  { id: 'mb5b', code: 'MB5B', name: 'Stock on posting date', hint: 'Opening, closing and movement quantity per material and plant', matches: 'MB5B Demo', rows: '2 files' },
  { id: 'mara', code: 'MARA', name: 'Material master', hint: 'Material type, valuation class and unit of measure' },
  { id: 'mi24', code: 'MI24', name: 'Physical inventory documents', hint: 'Count documents with book and counted quantities' },
  { id: 'lfa1', code: 'LFA1', name: 'Vendor master', hint: 'Vendor name, bank account, PAN / GST and block flags', matches: 'Vendor Master Data', rows: '892 rows' },
  { id: 'cdhdr', code: 'CDHDR', name: 'Change documents', hint: 'Who changed which master-data field, and when', matches: 'Vendor Master Data', rows: '892 rows' },
  { id: 'pa0001', code: 'PA0001', name: 'Employee master', hint: 'Employees with bank account, address and exit date', matches: 'Workday HRIS', rows: '234 rows' },
  { id: 'doa', code: 'DOA', name: 'Delegation of authority matrix', hint: 'Approval limits by role and document type' },
  { id: 'va05', code: 'VA05', name: 'Sales orders', hint: 'Orders with customer, value and credit-release user' },
  { id: 'vf05', code: 'VF05', name: 'Billing documents', hint: 'Sales invoices and credit notes with billing dates' },
  { id: 'vl06o', code: 'VL06O', name: 'Outbound deliveries', hint: 'Delivery and goods-issue dates per order' },
  { id: 'kna1', code: 'KNA1', name: 'Customer master', hint: 'Customers with credit limits and credit terms' },
  { id: 'vk13', code: 'VK13', name: 'Pricing conditions', hint: 'Approved price list per material and customer' },
  { id: 'fbl5n', code: 'FBL5N', name: 'Customer line items', hint: 'AR invoices, receipts and unapplied cash' },
  { id: 'fagll03', code: 'FAGLL03', name: 'GL line items', hint: 'Journal lines with preparer, approver and entry time', matches: 'GL Transaction History', rows: '3.8M rows' },
  { id: 'f01', code: 'F.01', name: 'Trial balance', hint: 'Period-end balances by GL account', matches: 'GL Transaction History', rows: '3.8M rows' },
  { id: 'suim', code: 'SUIM', name: 'User list & roles', hint: 'ERP users, their roles and validity dates' },
  { id: 'sm20', code: 'SM20', name: 'Security audit log', hint: 'Privileged sessions and the transactions run in them' },
  { id: 'sod', code: 'SoD', name: 'SoD rule-set', hint: 'Conflicting role combinations to test for' },
  { id: 'chg', code: 'ITSM', name: 'Change tickets & deployments', hint: 'Production deployments with their approved tickets' },
  { id: 'me3n', code: 'ME3N', name: 'Contracts (outline agreements)', hint: 'Contract value cap, scope and validity' },
  { id: 'me4n', code: 'ME4N', name: 'RFQs & quotations', hint: 'Sourcing events with bids received' },
];

/** Which standard file satisfies each catalog data need. */
const NEED_TO_FILE: Record<string, string> = {
  'AP invoice register': 'fbl1n',
  'Payment register': 'fbl1n',
  'Purchase orders': 'me2n',
  'Goods receipts': 'mb51',
  'Material movements': 'mb51',
  'Stock on posting date': 'mb5b',
  'Material master': 'mara',
  'Physical inventory documents': 'mi24',
  'Vendor master': 'lfa1',
  'Vendor change log': 'cdhdr',
  'Change log': 'cdhdr',
  'Employee master': 'pa0001',
  'HR leavers list': 'pa0001',
  'DOA matrix': 'doa',
  'Sales orders': 'va05',
  'Sales invoices': 'vf05',
  'Credit notes': 'vf05',
  'Delivery notes': 'vl06o',
  'Customer master': 'kna1',
  'Price list': 'vk13',
  'Bank receipts': 'fbl5n',
  'AR ledger': 'fbl5n',
  'GL journal lines': 'fagll03',
  'Sub-ledger': 'fagll03',
  'GL trial balance': 'f01',
  'User list': 'suim',
  'ERP user list': 'suim',
  'ERP user roles': 'suim',
  'Access logs': 'sm20',
  'SoD rule-set': 'sod',
  'Deployment log': 'chg',
  'Change tickets': 'chg',
  'Contracts register': 'me3n',
  'Sourcing events': 'me4n',
};

/** A file by id. A fresh workspace has connected nothing yet, so nothing
 *  auto-matches there — every report is one to request. */
export function fileById(id: string): StandardFile | undefined {
  const f = STANDARD_FILES.find(x => x.id === id);
  return f && isFreshWorkspace() ? { ...f, matches: undefined, rows: undefined } : f;
}

/** The standard files one catalog entry reads (deduped, catalog order). */
export function filesForEntry(entry: CatalogEntry): StandardFile[] {
  const ids = Array.from(new Set(entry.dataNeeds.map(d => NEED_TO_FILE[d]).filter(Boolean)));
  return ids.map(id => fileById(id)).filter((f): f is StandardFile => !!f);
}

/** The standard files a list of data needs resolves to (deduped). */
export function filesForNeeds(needs: string[]): StandardFile[] {
  const ids = Array.from(new Set(needs.map(d => NEED_TO_FILE[d]).filter(Boolean)));
  return ids.map(id => fileById(id)).filter((f): f is StandardFile => !!f);
}

export interface RequiredFile {
  file: StandardFile;
  /** Keys of the selected entries this file feeds. */
  unlocks: string[];
}

/** Every file a selection of entries needs, once each, most-used first. */
export function requiredFilesFor(entries: CatalogEntry[]): RequiredFile[] {
  const map = new Map<string, RequiredFile>();
  for (const e of entries) {
    for (const f of filesForEntry(e)) {
      const cur = map.get(f.id) ?? { file: f, unlocks: [] };
      cur.unlocks.push(e.key);
      map.set(f.id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.unlocks.length - a.unlocks.length || a.file.code.localeCompare(b.file.code));
}

/** Where a file comes from once the user has resolved it in the modal. */
export type FileSourceChoice =
  | { kind: 'source'; name: string }
  /** `name` is the display label; `files` every uploaded file behind it. */
  | { kind: 'upload'; name: string; files?: string[] }
  | { kind: 'skip' };

/** An upload choice for one or more files (appending to an earlier upload). */
export function uploadChoice(names: string[], prev?: FileSourceChoice | null): FileSourceChoice {
  const files = Array.from(new Set([...(prev?.kind === 'upload' ? prev.files ?? [prev.name] : []), ...names]));
  return { kind: 'upload', name: files.length === 1 ? files[0] : `${files.length} files · ${files[0]}`, files };
}

/** Default resolution: the auto-match when there is one, else nothing yet. */
export function autoMatch(file: StandardFile): FileSourceChoice | null {
  return file.matches ? { kind: 'source', name: file.matches } : null;
}

/** Deterministic 0–1 hash — stable demo numbers (confidence, exception counts). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}
