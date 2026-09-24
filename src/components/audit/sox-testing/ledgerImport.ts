/** ── Reading a client's trial balance and general ledger ───────────────────
 *  Both used to be simulated. The TB upload ignored the file and loaded the
 *  seeded Airline Group figures; anything the seed did not know about got four
 *  identical captions — Revenue 120, Opex 64, Receivables 38, Payables 27 —
 *  which meant every company in a group came out the same size and materiality
 *  had nothing to decide. This reads the file (24 Sep).
 *
 *  A trial balance is account-level: each row is a ledger account with a debit
 *  or a credit. Captions are the grouping the scoping step works in, so the
 *  rows are summed into captions here rather than assumed.
 *
 *  The general ledger is the layer beneath: journal lines that reference the
 *  same accounts, so a caption can be opened and read back to its postings.
 */
import * as XLSX from 'xlsx';
import type { GroupEntity, ProcessName, TbCaption } from './soxTestingData';

/** Only a spreadsheet can be read honestly — same rule as the org chart. */
const READABLE = /\.(xlsx|xlsm|xlsb|xls|csv|tsv)$/i;
export const isReadableLedger = (fileName: string): boolean => READABLE.test(fileName.trim());

const norm = (text: string): string =>
  String(text ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function readWorkbook(file: File): Promise<{ name: string; rows: string[][] }[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const raw = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: true }) : [];
    return { name, rows: raw.map(r => (Array.isArray(r) ? r : []).map(v => String(v ?? '').trim())) };
  });
}

// ── Columns ────────────────────────────────────────────────────────────────
type LedgerField =
  | 'entityId' | 'entityName' | 'accountCode' | 'accountName' | 'caption' | 'process'
  | 'debit' | 'credit' | 'balance' | 'period' | 'system'
  | 'date' | 'docNo' | 'description' | 'entryType' | 'postedBy';

/** Most specific first — "entity name" must not be claimed by "entity". */
const FIELDS: { key: LedgerField; synonyms: string[] }[] = [
  { key: 'entityId',    synonyms: ['entity id', 'entity code', 'company code', 'company id', 'legal entity id', 'bukrs'] },
  { key: 'entityName',  synonyms: ['entity name', 'legal entity name', 'company name', 'legal entity', 'entity', 'company'] },
  { key: 'accountCode', synonyms: ['account code', 'gl code', 'gl account', 'account no', 'account number', 'ledger code', 'hkont'] },
  { key: 'accountName', synonyms: ['account name', 'account description', 'gl description', 'ledger account', 'account'] },
  { key: 'caption',     synonyms: ['fs caption', 'financial statement caption', 'financial statement line', 'fsli', 'caption', 'grouping', 'account group', 'fs line item'] },
  { key: 'process',     synonyms: ['process', 'business process', 'cycle', 'process mapping'] },
  { key: 'debit',       synonyms: ['debit inr cr', 'debit amount', 'debit', 'dr', 'dr amount'] },
  { key: 'credit',      synonyms: ['credit inr cr', 'credit amount', 'credit', 'cr', 'cr amount'] },
  { key: 'balance',     synonyms: ['closing balance inr cr', 'closing balance', 'balance', 'net balance', 'amount', 'ytd balance', 'year end balance'] },
  { key: 'period',      synonyms: ['period', 'financial year', 'fiscal year', 'year', 'fy'] },
  { key: 'system',      synonyms: ['source system', 'system', 'erp', 'source'] },
  { key: 'date',        synonyms: ['posting date', 'document date', 'entry date', 'date', 'budat'] },
  { key: 'docNo',       synonyms: ['document no', 'document number', 'journal no', 'je no', 'voucher no', 'reference', 'belnr'] },
  { key: 'description', synonyms: ['description', 'narration', 'line text', 'particulars', 'text'] },
  { key: 'entryType',   synonyms: ['entry type', 'journal type', 'posting type', 'manual or automatic', 'source type'] },
  { key: 'postedBy',    synonyms: ['posted by', 'created by', 'user', 'user id', 'usnam'] },
];

function matchColumns(header: string[]): Partial<Record<LedgerField, number>> {
  const h = header.map(norm);
  const taken = new Set<number>();
  const found: Partial<Record<LedgerField, number>> = {};
  for (const { key, synonyms } of FIELDS) {
    const i = h.findIndex((c, idx) => !taken.has(idx) && c && synonyms.includes(c));
    if (i >= 0) { found[key] = i; taken.add(i); }
  }
  for (const { key, synonyms } of FIELDS) {
    if (found[key] !== undefined) continue;
    const i = h.findIndex((c, idx) => !taken.has(idx) && c && synonyms.some(s => c.includes(s)));
    if (i >= 0) { found[key] = i; taken.add(i); }
  }
  return found;
}

/** A row that names an account, or names a caption and carries a number, is a
 *  ledger row. Anything above it is a title block. */
function findHeaderRow(rows: string[][]): number {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cols = matchColumns(rows[r] ?? []);
    const hasAmount = cols.balance !== undefined || cols.debit !== undefined || cols.credit !== undefined;
    if (hasAmount && (cols.accountName !== undefined || cols.caption !== undefined)) return r;
  }
  return 0;
}

/** "1,412.45", "(38.20)" and "38.20 Cr" all read as numbers; a bracketed figure
 *  is negative, the way an accountant writes it. */
function parseAmount(cell: string): number {
  const raw = String(cell ?? '').trim();
  if (!raw) return 0;
  const negative = /^\(.*\)$/.test(raw);
  const t = raw.replace(/[()]/g, '').replace(/[^0-9.\-]/g, '');
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

/** Dates land in whatever shape the sheet reader hands back — a CSV's ISO date
 *  comes through as "1/21/26" once Excel has had an opinion about it. Everything
 *  is pulled back to ISO so the lines sort chronologically rather than
 *  alphabetically, which put 1 January after 10 October. */
function normaliseDate(cell: string): string {
  const t = String(cell ?? '').trim();
  if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  // An Excel date is a day count from 30 Dec 1899, and a sheet that carries no
  // format string hands it over as that bare number — "45942.229" rather than a
  // date. Left unread it printed the serial straight into the drill-down.
  // Bounded to a plausible range so a document number or an amount that happens
  // to be numeric is never mistaken for a date.
  if (/^\d{5}(?:\.\d+)?$/.test(t)) {
    const serial = Number(t);
    if (serial >= 20000 && serial <= 60000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    // Sheets written here are m/d/y; a day above twelve settles it either way.
    let [, a, b, y] = m;
    let month = Number(a), day = Number(b);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toISOString().slice(0, 10);
}

const PROCESSES: ProcessName[] = ['Order to Cash', 'Procure to Pay', 'Inventory', 'Fixed Assets', 'Payroll (Hire to Retire)', 'Treasury', 'Tax'];

/** The file's own process column where it has one; otherwise read off the
 *  caption, which is what an auditor would do with a bare trial balance. */
function processFor(processCell: string, caption: string): ProcessName {
  const p = norm(processCell);
  if (p) {
    const exact = PROCESSES.find(x => norm(x) === p);
    if (exact) return exact;
    if (/o2c|order to cash|revenue|sales|receivab/.test(p)) return 'Order to Cash';
    if (/p2p|procure|payable|purchas|expense/.test(p)) return 'Procure to Pay';
    if (/inventor|stock|warehouse/.test(p)) return 'Inventory';
    if (/fixed asset|ppe|capex|f2a/.test(p)) return 'Fixed Assets';
    if (/payroll|h2r|hire to retire|employee|hr/.test(p)) return 'Payroll (Hire to Retire)';
    if (/treasur|cash|bank|borrow|debt|invest/.test(p)) return 'Treasury';
    if (/\btax\b|gst|vat/.test(p)) return 'Tax';
  }
  const c = norm(caption);
  if (/revenue|sales|receivab|unbilled|customer/.test(c)) return 'Order to Cash';
  if (/payable|purchas|material|o and m|operating expense|other expense|supplier|vendor/.test(c)) return 'Procure to Pay';
  if (/inventor|stock|work in progress|finished goods|stores/.test(c)) return 'Inventory';
  if (/property|plant|equipment|ppe|capital work|depreciat|amortis|intangible/.test(c)) return 'Fixed Assets';
  if (/employee|payroll|salar|wages|gratuity|provident|leave/.test(c)) return 'Payroll (Hire to Retire)';
  if (/cash|bank|borrowing|finance cost|interest|investment|equity|reserve|deposit|lease liab/.test(c)) return 'Treasury';
  if (/\btax\b|deferred tax|gst|vat|tds/.test(c)) return 'Tax';
  return 'Procure to Pay';
}

// ── Trial balance ──────────────────────────────────────────────────────────
export interface TbEntityResult {
  /** The row in the wizard's table this entity matched, when it matched one. */
  entityId?: string;
  /** What the file called it — used when it matched nothing, so the user can
   *  be offered the company rather than told a number went missing. */
  fileName: string;
  fileEntityId: string;
  lines: number;
  captions: TbCaption[];
}

export interface TbParseOk {
  ok: true;
  /** Captions for every company that matched a row in the table. */
  captions: TbCaption[];
  /** file + line count per matched entity id, for the entity table's TB cell. */
  perEntity: Record<string, { file: string; lines: number }>;
  /** Companies the trial balance carries that the table has no row for. The
   *  point of a TB in scoping: it finds what the org chart missed. */
  unmatched: TbEntityResult[];
  totalLines: number;
  period?: string;
}
export type TbParseResult = TbParseOk | { ok: false; reason: string };

/** Matches the file's companies to the table's rows, by name first and then by
 *  whatever id the file carries. Names are compared loosely — "Ltd" and
 *  "Limited", "Pvt" and "Private" are one spelling. */
function entityMatcher(entities: GroupEntity[]) {
  const squash = (s: string) =>
    norm(s)
      .replace(/\b(limited|ltd)\b/g, 'ltd')
      .replace(/\b(private|pvt)\b/g, 'pvt')
      .replace(/\b(incorporated|inc)\b/g, 'inc')
      .replace(/\b(company|co)\b/g, 'co')
      .replace(/\s+/g, ' ')
      .trim();
  const byName = new Map(entities.map(e => [squash(e.name), e.id]));
  const byIdTail = new Map(entities.map(e => [norm(e.id).replace(/^oc /, ''), e.id]));
  return (fileName: string, fileId: string): string | undefined =>
    byName.get(squash(fileName)) ?? (fileId ? byIdTail.get(norm(fileId)) : undefined);
}

export async function parseTrialBalanceFile(file: File, entities: GroupEntity[]): Promise<TbParseResult> {
  if (!isReadableLedger(file.name)) return { ok: false, reason: 'not-a-spreadsheet' };

  let sheets: { name: string; rows: string[][] }[];
  try { sheets = await readWorkbook(file); } catch { return { ok: false, reason: 'unreadable' }; }

  let best: { rows: string[][]; header: number; cols: Partial<Record<LedgerField, number>> } | null = null;
  for (const s of sheets) {
    const header = findHeaderRow(s.rows);
    const cols = matchColumns(s.rows[header] ?? []);
    const usable = cols.balance !== undefined || cols.debit !== undefined || cols.credit !== undefined;
    if (!usable) continue;
    if (!best || Object.keys(cols).length > Object.keys(best.cols).length) best = { rows: s.rows, header, cols };
  }
  if (!best) return { ok: false, reason: 'no-amount-column' };

  const { rows, header, cols } = best;
  const at = (row: string[], k: LedgerField) => (cols[k] === undefined ? '' : String(row[cols[k]!] ?? '').trim());
  const match = entityMatcher(entities);

  /** entity key → caption → running total */
  const buckets = new Map<string, { fileName: string; fileId: string; lines: number; caps: Map<string, { balance: number; process: ProcessName }> }>();
  let period: string | undefined;
  let total = 0;

  for (let r = header + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const accountName = at(row, 'accountName');
    const captionCell = at(row, 'caption');
    if (!accountName && !captionCell) continue;
    if (/^(?:total|grand total|sub ?total)\b/i.test(accountName || captionCell)) continue;

    const fileEntityName = at(row, 'entityName');
    const fileEntityId = at(row, 'entityId');
    // A trial balance for a single company often names it once, in a title
    // row, rather than on every line. Everything then belongs to one bucket.
    const key = (fileEntityId || fileEntityName || '__single__').toLowerCase();

    const bal = cols.balance !== undefined
      ? parseAmount(at(row, 'balance'))
      : parseAmount(at(row, 'debit')) - parseAmount(at(row, 'credit'));
    const caption = captionCell || accountName;
    if (!caption) continue;

    if (!period) period = at(row, 'period') || undefined;
    let b = buckets.get(key);
    if (!b) { b = { fileName: fileEntityName, fileId: fileEntityId, lines: 0, caps: new Map() }; buckets.set(key, b); }
    b.lines++; total++;
    const existing = b.caps.get(caption);
    // Captions are read at their gross size. A trial balance signs a credit
    // negative, and a revenue caption that reported as minus three thousand
    // crore would sort below every cost line and fall out of scope.
    const add = Math.abs(bal);
    if (existing) existing.balance = Math.round((existing.balance + add) * 100) / 100;
    else b.caps.set(caption, { balance: Math.round(add * 100) / 100, process: processFor(at(row, 'process'), caption) });
  }

  if (!buckets.size) return { ok: false, reason: 'no-rows' };

  const captions: TbCaption[] = [];
  const perEntity: Record<string, { file: string; lines: number }> = {};
  const unmatched: TbEntityResult[] = [];

  for (const [, b] of buckets) {
    const matched = buckets.size === 1 && !b.fileName && entities.length === 1
      ? entities[0].id
      : match(b.fileName, b.fileId);
    const caps = [...b.caps.entries()]
      .sort((x, y) => y[1].balance - x[1].balance)
      .map(([caption, v], i) => ({
        id: `tb-${matched ?? (norm(b.fileName || b.fileId) || 'x')}-${String(i + 1).padStart(2, '0')}`.replace(/\s+/g, '-'),
        entityId: matched ?? '',
        caption,
        balance: v.balance,
        process: v.process,
      }));
    if (matched) {
      perEntity[matched] = { file: file.name, lines: b.lines };
      captions.push(...caps);
    } else {
      unmatched.push({ fileName: b.fileName || b.fileId, fileEntityId: b.fileId, lines: b.lines, captions: caps });
    }
  }

  if (!captions.length && !unmatched.length) return { ok: false, reason: 'no-rows' };
  return { ok: true, captions, perEntity, unmatched, totalLines: total, period };
}

// ── General ledger ─────────────────────────────────────────────────────────
export interface GlLine {
  entityId: string;
  date: string;
  docNo: string;
  accountCode: string;
  accountName: string;
  caption: string;
  description: string;
  amount: number;
  manual: boolean;
  postedBy: string;
  system: string;
}

export interface GlParseOk {
  ok: true;
  lines: GlLine[];
  /** `${entityId}::${caption}` → the lines behind it, for the drill-down. */
  byCaption: Map<string, GlLine[]>;
  totalLines: number;
  matchedEntities: number;
  unmatchedNames: string[];
}
export type GlParseResult = GlParseOk | { ok: false; reason: string };

export const captionKey = (entityId: string, caption: string) => `${entityId}::${caption.toLowerCase().trim()}`;

export async function parseGeneralLedgerFile(file: File, entities: GroupEntity[]): Promise<GlParseResult> {
  if (!isReadableLedger(file.name)) return { ok: false, reason: 'not-a-spreadsheet' };

  let sheets: { name: string; rows: string[][] }[];
  try { sheets = await readWorkbook(file); } catch { return { ok: false, reason: 'unreadable' }; }

  let best: { rows: string[][]; header: number; cols: Partial<Record<LedgerField, number>> } | null = null;
  for (const s of sheets) {
    const header = findHeaderRow(s.rows);
    const cols = matchColumns(s.rows[header] ?? []);
    const usable = (cols.debit !== undefined || cols.credit !== undefined || cols.balance !== undefined)
      && (cols.date !== undefined || cols.docNo !== undefined);
    if (!usable) continue;
    if (!best || Object.keys(cols).length > Object.keys(best.cols).length) best = { rows: s.rows, header, cols };
  }
  if (!best) return { ok: false, reason: 'not-a-ledger' };

  const { rows, header, cols } = best;
  const at = (row: string[], k: LedgerField) => (cols[k] === undefined ? '' : String(row[cols[k]!] ?? '').trim());
  const match = entityMatcher(entities);

  const lines: GlLine[] = [];
  const unmatchedNames = new Set<string>();
  const matchedEntities = new Set<string>();

  for (let r = header + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const accountName = at(row, 'accountName');
    const captionCell = at(row, 'caption');
    const docNo = at(row, 'docNo');
    if (!accountName && !captionCell && !docNo) continue;
    if (/^(?:total|grand total|sub ?total)\b/i.test(accountName || captionCell)) continue;

    const fileEntityName = at(row, 'entityName');
    const fileEntityId = at(row, 'entityId');
    const entityId = match(fileEntityName, fileEntityId);
    if (!entityId) { if (fileEntityName || fileEntityId) unmatchedNames.add(fileEntityName || fileEntityId); continue; }
    matchedEntities.add(entityId);

    const amount = cols.debit !== undefined || cols.credit !== undefined
      ? Math.abs(parseAmount(at(row, 'debit'))) + Math.abs(parseAmount(at(row, 'credit')))
      : Math.abs(parseAmount(at(row, 'balance')));
    const entryType = norm(at(row, 'entryType'));

    lines.push({
      entityId,
      date: normaliseDate(at(row, 'date')),
      docNo,
      accountCode: at(row, 'accountCode'),
      accountName,
      caption: captionCell || accountName,
      description: at(row, 'description'),
      amount,
      // A manual journal is the one an auditor looks for first.
      manual: /manual|journal entry|\bje\b|adjust/.test(entryType) || /^je[-\s]/i.test(docNo),
      postedBy: at(row, 'postedBy'),
      system: at(row, 'system'),
    });
  }

  if (!lines.length) return { ok: false, reason: 'no-rows' };

  const byCaption = new Map<string, GlLine[]>();
  for (const l of lines) {
    const k = captionKey(l.entityId, l.caption);
    const bucket = byCaption.get(k);
    if (bucket) bucket.push(l); else byCaption.set(k, [l]);
  }
  for (const bucket of byCaption.values()) bucket.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { ok: true, lines, byCaption, totalLines: lines.length, matchedEntities: matchedEntities.size, unmatchedNames: [...unmatchedNames] };
}
