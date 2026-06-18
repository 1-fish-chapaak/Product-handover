// Mock files contained inside file-type data sources. Keyed by DataSource.id.
// Curated entries exist for a few demo ids; every other file/folder source gets
// a realistic listing synthesised on demand by `filesForSource` (see bottom).
// Database/api/cloud sources surface their detail differently.

import * as XLSX from 'xlsx';
// Vite worker import — a real Worker constructor for pdf.js (more reliable than
// a ?url workerSrc for the ESM worker). pdf.js itself stays lazily imported.
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { DataSource } from './sources';

export type FileFormat = 'PDF' | 'CSV' | 'XLSX';
export type FileStatus = 'processed' | 'processing' | 'failed';

export interface DatasetFile {
  id: string;
  name: string;
  format: FileFormat;
  /** Bytes — formatted at render time. */
  sizeBytes: number;
  uploadedAt: string; // ISO date
  /** Pages for PDF; rows for CSV/XLSX. */
  pages?: number;
  rows?: number;
  status: FileStatus;
}

const KB = 1024;
const MB = KB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

// Per-source file lists. Names mirror the parent dataset where it makes sense.
export const DATASET_FILES: Record<string, DatasetFile[]> = {
  // Demo Agreements — 3 PDFs (matches the inspiration screenshot)
  'f-09': [
    { id: 'fa-09-1', name: 'Agreement 1.1.pdf',          format: 'PDF', sizeBytes: 752 * KB,  uploadedAt: '2026-04-16', pages: 14, status: 'processed' },
    { id: 'fa-09-2', name: 'Agreement 2 — TTR 1.pdf',    format: 'PDF', sizeBytes: 656 * KB,  uploadedAt: '2026-04-16', pages: 22, status: 'processed' },
    { id: 'fa-09-3', name: 'Agreement 3 — THSL1 1.pdf',  format: 'PDF', sizeBytes: 479 * KB,  uploadedAt: '2026-04-16', pages: 9,  status: 'processed' },
  ],
  'f-01': [
    { id: 'fa-01-1', name: 'AI_Fare_Audit_Q1_2026.xlsx', format: 'XLSX', sizeBytes: 8.4 * MB, uploadedAt: '2026-04-23', rows: 48230, status: 'processed' },
    { id: 'fa-01-2', name: 'AI_Fare_Audit_Q4_2025.xlsx', format: 'XLSX', sizeBytes: 4.0 * MB, uploadedAt: '2026-04-23', rows: 22104, status: 'processed' },
  ],
  'f-02': [
    { id: 'fa-02-1', name: 'PwC_Status_Report_Apr.pdf',  format: 'PDF',  sizeBytes: 1.2 * MB, uploadedAt: '2026-04-23', pages: 32, status: 'processed' },
    { id: 'fa-02-2', name: 'PwC_Findings_Annex.pdf',     format: 'PDF',  sizeBytes: 0.9 * MB, uploadedAt: '2026-04-23', pages: 18, status: 'processing' },
  ],
  'f-03': [
    { id: 'fa-03-1', name: 'emaar_extraction_master.csv', format: 'CSV', sizeBytes: 4.8 * MB, uploadedAt: '2026-04-20', rows: 119240, status: 'processed' },
  ],
  'f-04': [
    { id: 'fa-04-1', name: 'emaar_payments_q1.xlsx',     format: 'XLSX', sizeBytes: 3.2 * MB, uploadedAt: '2026-04-20', rows: 84120, status: 'processed' },
    { id: 'fa-04-2', name: 'emaar_payments_q4.xlsx',     format: 'XLSX', sizeBytes: 3.0 * MB, uploadedAt: '2026-04-20', rows: 76503, status: 'processed' },
  ],
  'f-05': [
    { id: 'fa-05-1', name: 'Loan_Details_FY26.pdf',      format: 'PDF',  sizeBytes: 5.4 * MB, uploadedAt: '2026-04-20', pages: 88, status: 'processed' },
    { id: 'fa-05-2', name: 'Loan_Details_Annex_A.pdf',   format: 'PDF',  sizeBytes: 2.1 * MB, uploadedAt: '2026-04-20', pages: 24, status: 'processed' },
    { id: 'fa-05-3', name: 'Loan_Schedule_2026.xlsx',    format: 'XLSX', sizeBytes: 1.2 * MB, uploadedAt: '2026-04-20', rows: 1280, status: 'failed' },
  ],
  'f-06': [
    { id: 'fa-06-1', name: 'remittance_bank_demo.csv',   format: 'CSV',  sizeBytes: 1.4 * MB, uploadedAt: '2026-04-20', rows: 38420, status: 'processed' },
  ],
  'f-07': [
    { id: 'fa-07-1', name: 'media_demo_revenue.xlsx',    format: 'XLSX', sizeBytes: 5.6 * MB, uploadedAt: '2026-04-17', rows: 42130, status: 'processed' },
    { id: 'fa-07-2', name: 'media_demo_costs.xlsx',      format: 'XLSX', sizeBytes: 3.5 * MB, uploadedAt: '2026-04-17', rows: 28490, status: 'processed' },
  ],
  'f-08': [
    { id: 'fa-08-1', name: 'demo_invoices_1604.csv',     format: 'CSV',  sizeBytes: 3.3 * MB, uploadedAt: '2026-04-16', rows: 91204, status: 'processed' },
  ],
  'f-10': [
    { id: 'fa-10-1', name: 'MB5B_inventory.xlsx',        format: 'XLSX', sizeBytes: 3.8 * MB, uploadedAt: '2026-04-16', rows: 31280, status: 'processed' },
    { id: 'fa-10-2', name: 'MB5B_aging.xlsx',            format: 'XLSX', sizeBytes: 1.9 * MB, uploadedAt: '2026-04-16', rows: 14920, status: 'processed' },
  ],
  'f-11': [
    { id: 'fa-11-1', name: 'AI_HR_KPI_employees.csv',    format: 'CSV',  sizeBytes: 2.9 * MB, uploadedAt: '2026-04-15', rows: 18230, status: 'processed' },
  ],
  'f-12': [
    { id: 'fa-12-1', name: 'NSE_agreement_sample.pdf',   format: 'PDF',  sizeBytes: 4.4 * MB, uploadedAt: '2026-04-14', pages: 56, status: 'processed' },
  ],
  'f-13': [
    { id: 'fa-13-1', name: 'NSE_AP_Q1.xlsx',             format: 'XLSX', sizeBytes: 4.2 * MB, uploadedAt: '2026-04-14', rows: 38120, status: 'processed' },
    { id: 'fa-13-2', name: 'NSE_AP_Q4.xlsx',             format: 'XLSX', sizeBytes: 3.4 * MB, uploadedAt: '2026-04-14', rows: 31490, status: 'processed' },
  ],
  'f-14': [
    { id: 'fa-14-1', name: 'NSE_position_limits.csv',    format: 'CSV',  sizeBytes: 1.8 * MB, uploadedAt: '2026-04-12', rows: 24190, status: 'processed' },
  ],
  'f-15': [
    { id: 'fa-15-1', name: 'NSE_penalties_shortfall.xlsx', format: 'XLSX', sizeBytes: 3.5 * MB, uploadedAt: '2026-04-12', rows: 9810, status: 'processed' },
  ],
  'f-16': [
    { id: 'fa-16-1', name: 'AI_HR_bills_vs_reimburse.xlsx', format: 'XLSX', sizeBytes: 6.0 * MB, uploadedAt: '2026-04-10', rows: 28430, status: 'processed' },
  ],
};

// ─── User-uploaded file persistence ─────────────────────────────────────────
// The DATASET_FILES record above is hardcoded demo data; entries keyed `f-01`
// through `f-16` are referenced by the SEED in `sources.ts`. When SEED is
// empty (production default) those entries are dead weight in memory but
// harmless — no source references them.
//
// User uploads add NEW entries to DATASET_FILES at runtime. To survive a page
// reload, those entries are mirrored to localStorage via setSourceFiles /
// removeSourceFiles below. On module load, anything previously persisted is
// merged back into the in-memory map.
//
// This is the same swap pattern as `useKnowledgeSources` — when a backend
// is wired, replace the two setters to POST/DELETE against the API and remove
// the on-load hydration. No other call site needs to change.

const USER_FILES_STORAGE_KEY = 'kh:datasetFiles:v1';

function loadUserDatasetFiles(): Record<string, DatasetFile[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(USER_FILES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, DatasetFile[]>;
  } catch {
    return {};
  }
}

function saveUserDatasetFiles(map: Record<string, DatasetFile[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_FILES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // QuotaExceededError or similar — non-fatal; user just won't get persistence
    // for this write. A real backend impl removes this failure mode.
  }
}

// Hydrate persisted user uploads into the in-memory map on module load.
if (typeof window !== 'undefined') {
  const persisted = loadUserDatasetFiles();
  for (const [sourceId, files] of Object.entries(persisted)) {
    DATASET_FILES[sourceId] = files;
  }
}

/** Set (or replace) the file list for a source id. Mirrors to localStorage so
 *  the detail view survives a reload. Used by the picker confirm path. */
export function setSourceFiles(sourceId: string, files: DatasetFile[]): void {
  DATASET_FILES[sourceId] = files;
  const userMap = loadUserDatasetFiles();
  userMap[sourceId] = files;
  saveUserDatasetFiles(userMap);
}

/** Remove the file list for a source id. Called when the source is deleted so
 *  we don't leak orphan entries into localStorage. */
export function removeSourceFiles(sourceId: string): void {
  // Drop any persisted bytes for this source's files so they don't orphan.
  for (const f of DATASET_FILES[sourceId] ?? []) {
    const mem = FILE_BLOBS.get(f.id);
    if (mem) { URL.revokeObjectURL(mem.url); FILE_BLOBS.delete(f.id); }
    idbDelete(f.id);
  }
  delete DATASET_FILES[sourceId];
  const userMap = loadUserDatasetFiles();
  if (sourceId in userMap) {
    delete userMap[sourceId];
    saveUserDatasetFiles(userMap);
  }
}

// ─── Real uploaded-file bytes (persisted for real previews) ──────────────────
// When the user uploads a file we keep its bytes so the detail view can show a
// REAL preview (the actual PDF in an iframe, the actual rows as a table). The
// in-memory map holds object URLs for instant same-session access; the bytes
// are ALSO persisted to IndexedDB so the real preview survives a page reload
// (object URLs themselves can't be serialised, but the File can). A backend
// swaps this for a real file URL.
const FILE_BLOBS = new Map<string, { url: string; mime: string }>();

const IDB_NAME = 'kh-file-bytes';
const IDB_STORE = 'files';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Without this, a blocked open (another tab holding an older version) would
    // never settle — the promise, and any preview awaiting it, would hang.
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

async function idbPut(id: string, file: File): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(file, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* private mode / quota — preview just won't survive reload */ }
}

async function idbGet(id: string): Promise<File | undefined> {
  try {
    const db = await openIdb();
    return await new Promise<File | undefined>((res) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r = tx.objectStore(IDB_STORE).get(id);
      r.onsuccess = () => res(r.result as File | undefined);
      r.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}

function idbDelete(id: string): void {
  try { openIdb().then(db => db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(id)); } catch { /* noop */ }
}

export function registerFileBlob(fileId: string, file: File): void {
  const existing = FILE_BLOBS.get(fileId);
  if (existing) URL.revokeObjectURL(existing.url);
  FILE_BLOBS.set(fileId, { url: URL.createObjectURL(file), mime: file.type });
  void idbPut(fileId, file); // persist bytes so the real preview survives reload
}

/** Synchronous in-memory lookup — instant for files uploaded this session. */
export function getFileBlob(fileId: string): { url: string; mime: string } | undefined {
  return FILE_BLOBS.get(fileId);
}

/** Returns the in-memory blob, or rehydrates it from IndexedDB (after a reload
 *  the object URLs are gone but the persisted bytes are not). */
export async function loadFileBlob(fileId: string): Promise<{ url: string; mime: string } | undefined> {
  const mem = FILE_BLOBS.get(fileId);
  if (mem) return mem;
  try {
    const file = await idbGet(fileId);
    if (!file) return undefined;
    // createObjectURL throws on a corrupt/non-Blob entry — guard it so the
    // caller resolves to "no bytes" (and renders the mock preview) instead of
    // the rejection bubbling up and pinning the preview's loading skeleton.
    const entry = { url: URL.createObjectURL(file), mime: file.type };
    FILE_BLOBS.set(fileId, entry);
    return entry;
  } catch {
    return undefined;
  }
}

/** Lazily import pdf.js with the worker configured. Shared by page-count and
 *  the canvas page renderer. */
let pdfWorkerSet = false;
export async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfWorkerSet) {
    pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
    pdfWorkerSet = true;
  }
  return pdfjs;
}

// Deep content parsing (pdf.js / SheetJS) needs the whole file in memory and
// runs synchronously. Above this size we skip the parse — loading + parsing a
// large file (let alone a batch of them in parallel on "Add") spikes memory and
// blocks the main thread, which can hang or crash the tab. Callers fall back to
// the size-based estimate. It is NOT an upload size limit; the file still adds.
const DEEP_PARSE_MAX_BYTES = 30 * 1024 * 1024; // 30 MB

/** Real page count for a PDF File via pdf.js. Returns null on failure (or when
 *  the file is too large to parse inline) so the caller can fall back to the
 *  byte-size estimate. pdf.js is imported lazily. */
export async function countPdfPages(file: File): Promise<number | null> {
  if (file.size > DEEP_PARSE_MAX_BYTES) return null;
  try {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const n = doc.numPages;
    await doc.destroy();
    return n;
  } catch {
    return null;
  }
}

/** Real data-row count (excluding the header row) for a CSV/XLSX File, parsed
 *  with SheetJS. Returns null if it can't be read — callers then fall back to
 *  the byte-size estimate. Lets uploads show a true row count, not a guess. */
export async function countSheetRows(file: File): Promise<number | null> {
  if (file.size > DEEP_PARSE_MAX_BYTES) return null;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    return Math.max(0, data.length - 1);
  } catch {
    return null;
  }
}

// ─── Upload validation ──────────────────────────────────────────────────────
// What a real ingest pipeline must reject before a file enters the catalog.
// Runs client-side here (no backend yet) but uses the same parsers the rest of
// the app relies on: pdf.js for PDF (its PasswordException flags encryption)
// and SheetJS for XLSX. CSV can't be encrypted, so we only sniff for binary
// garbage that signals a mislabeled/corrupt file. No upper size limit — large
// files are allowed.

// The only file types the Knowledge Hub accepts. Single source of truth shared
// by BOTH upload entry points (the Add-source picker and a source's detail-view
// "Add files to this folder") so the restriction can't drift between them.
export const KH_ALLOWED_EXTS = ['.pdf', '.csv', '.xls', '.xlsx', '.ods', '.pptx', '.jpg', '.jpeg', '.png'] as const;
// Human-readable label for the supported formats, shown in the picker hint and
// the "unsupported type" toast. Kept here so both copies stay in sync with the
// gate above (note: .jpeg shares the JPG label).
export const KH_ALLOWED_LABEL = 'PDF · CSV · XLS · XLSX · ODS · PPTX · JPG · PNG';
// `accept` attribute string for the native file/folder inputs.
export const KH_ALLOWED_ACCEPT = KH_ALLOWED_EXTS.join(',');
export function isAllowedKnowledgeFile(name: string): boolean {
  const lower = name.toLowerCase();
  return KH_ALLOWED_EXTS.some(ext => lower.endsWith(ext));
}

export type UploadValidation = { ok: true } | { ok: false; reason: string };

export async function validateUploadFile(file: File): Promise<UploadValidation> {
  // Empty files carry nothing to index — the only size gate we keep.
  if (file.size === 0) return { ok: false, reason: 'File is empty' };

  const ext = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();

  // CSVs can't be encrypted — only sniff the first chunk for binary/NUL bytes.
  // Crucially we read ONLY the head slice, never the whole (possibly huge) file.
  if (ext === 'csv') {
    try {
      const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
      if (head.includes(0)) return { ok: false, reason: 'File appears corrupted' };
    } catch {
      // Couldn't even read the head — don't block it; backend will validate.
    }
    return { ok: true };
  }

  // XLSX: sniff the header instead of parsing the whole workbook. A full
  // SheetJS parse loads the entire file into memory AND runs synchronously on
  // the main thread — validating several files at once then freezes the UI (and
  // the upload progress bars). The first bytes classify it without a parse:
  //   "PK\x03\x04"       → ZIP-based OOXML → a real .xlsx
  //   "\xD0\xCF\x11\xE0" → OLE/CFB container → legacy .xls or an encrypted
  //                         OOXML wrapper → treat as locked/unsupported
  if (ext === 'xlsx') {
    try {
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
      const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
      if (isOle) return { ok: false, reason: 'Password-protected — unlock it first' };
      if (!isZip) return { ok: false, reason: 'File appears corrupted' };
    } catch {
      // Couldn't read the head — don't block it; the backend will validate.
    }
    return { ok: true };
  }

  // Big PDF: skip the in-browser parse and let it through.
  if (file.size > DEEP_PARSE_MAX_BYTES) return { ok: true };

  if (ext === 'pdf') {
    let buf: ArrayBuffer;
    try {
      buf = await file.arrayBuffer();
    } catch {
      // Read failed (e.g. memory pressure) — accept rather than reject.
      return { ok: true };
    }
    try {
      const pdfjs = await getPdfjs();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      await doc.destroy();
    } catch (e) {
      const name = (e as { name?: string } | null | undefined)?.name;
      if (name === 'PasswordException') return { ok: false, reason: 'Password-protected — unlock it first' };
      return { ok: false, reason: 'File appears corrupted' };
    }
  }

  return { ok: true };
}

// Per-format Editorial GRC tone token. Used by the file-row icon tile.
export const FORMAT_TONES: Record<FileFormat, { bg: string; text: string }> = {
  PDF:  { bg: 'bg-risk-50',      text: 'text-risk' },
  CSV:  { bg: 'bg-compliant-50', text: 'text-compliant' },
  XLSX: { bg: 'bg-brand-50',     text: 'text-brand-700' },
};

// ─── On-demand file synthesis ────────────────────────────────────────────────
// Most sources have no curated DATASET_FILES entry. Rather than show an empty
// "upload" prompt when one is opened, we synthesise a realistic, DETERMINISTIC
// file listing from the source itself:
//   • a single file mirrors its own name + size (so its preview opens), and
//   • a folder is filled with the number of files its subtype advertises
//     ("Folder · 12 Files" → 12 rows).
// Deterministic (no Math.random) so the list is stable across re-renders, and
// curated / user-uploaded entries in DATASET_FILES always win.

function parseSubtypeBytes(subtype: string): number | null {
  const m = subtype.match(/([\d.]+)\s*(B|KB|MB|GB)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const unit = m[2].toUpperCase();
  if (unit === 'B')  return Math.round(n);
  if (unit === 'KB') return Math.round(n * KB);
  if (unit === 'MB') return Math.round(n * MB);
  return Math.round(n * MB * 1024); // GB
}

function formatFromName(name: string): FileFormat {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'csv') return 'CSV';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') return 'XLSX';
  return 'PDF'; // pdf and anything else preview as PDF
}

function parseFolderCount(subtype: string): number {
  const m = subtype.match(/(\d+)\s*files?/i);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

/** Derive a sensible page count (PDF) or row count (CSV/XLSX) from a file's
 *  byte size, so synthesised AND freshly-uploaded files preview consistently. */
export function metaForFormat(fmt: FileFormat, bytes: number): Pick<DatasetFile, 'pages' | 'rows'> {
  return fmt === 'PDF'
    ? { pages: Math.max(1, Math.round(bytes / (45 * KB))) }
    : { rows: Math.max(1, Math.round(bytes / 80)) };
}

// Deterministic pseudo-size from a seed integer — stable across renders.
function seededBytes(seed: number, fmt: FileFormat): number {
  const base = fmt === 'PDF' ? 320 * KB : fmt === 'CSV' ? 1.1 * MB : 740 * KB;
  const jitter = ((seed * 2654435761) % 1000) / 1000; // 0..1, deterministic
  return Math.round(base * (0.4 + jitter * 1.8));
}

// Realistic audit document names used to fill folders. Format inferred from ext.
const FOLDER_FILE_POOL: string[] = [
  'Control_Matrix.xlsx', 'Process_Walkthrough.pdf', 'Test_of_Design.xlsx',
  'Sample_Selection.csv', 'Evidence_Log.xlsx', 'Management_Response.pdf',
  'Risk_Assessment.pdf', 'Reconciliation.xlsx', 'Exception_Report.csv',
  'Sign_Off_Memo.pdf', 'Population_Extract.csv', 'Findings_Summary.pdf',
  'Remediation_Plan.xlsx', 'Interview_Notes.pdf', 'Journal_Entries.csv',
  'Approval_Workflow.pdf', 'Vendor_Listing.xlsx', 'Access_Review.xlsx',
  'Policy_Extract.pdf', 'Trial_Balance.xlsx', 'GL_Detail.csv',
  'Aging_Analysis.xlsx', 'Variance_Notes.pdf', 'Supporting_Invoices.pdf',
];

function folderFileName(i: number): string {
  if (i < FOLDER_FILE_POOL.length) return FOLDER_FILE_POOL[i];
  // Wrap with a numeric suffix so names stay unique past the pool size.
  const base = FOLDER_FILE_POOL[i % FOLDER_FILE_POOL.length];
  const dot = base.lastIndexOf('.');
  return `${base.slice(0, dot)}_${Math.floor(i / FOLDER_FILE_POOL.length) + 1}${base.slice(dot)}`;
}

/** Files contained in a source — curated entry if one exists, otherwise a
 *  deterministic synthetic listing derived from the source itself. Integrations
 *  (database/api/cloud) have no file listing and return []. */
export function filesForSource(source: DataSource): DatasetFile[] {
  const curated = DATASET_FILES[source.id];
  if (curated) return curated;
  if (source.type !== 'file') return [];

  const uploadedAt = (source.displayDate ?? source.createdAt).slice(0, 10);

  if (source.isFolder) {
    const count = parseFolderCount(source.subtype);
    return Array.from({ length: count }, (_, i) => {
      const name = folderFileName(i);
      const fmt = formatFromName(name);
      const bytes = seededBytes(i + 1, fmt);
      return {
        id: `${source.id}-f${i + 1}`,
        name, format: fmt, sizeBytes: bytes, uploadedAt,
        ...metaForFormat(fmt, bytes),
        status: 'processed' as FileStatus,
      };
    });
  }

  // Single file mirrors its own name + size.
  const fmt = formatFromName(source.name);
  const bytes = parseSubtypeBytes(source.subtype) ?? seededBytes(1, fmt);
  return [{
    id: `${source.id}-f1`,
    name: source.name, format: fmt, sizeBytes: bytes, uploadedAt,
    ...metaForFormat(fmt, bytes),
    status: bytes === 0 ? 'failed' : 'processed',
  }];
}

// ─── Integration configs (database / api / cloud sources) ────────────────────
// Masked by default — sensitive fields (password, secret, token) render as ••••••
// with a copy-to-clipboard fallback to the support contact.

export interface ConfigField {
  label: string;
  value: string;
  /** When true, render as masked (••••••) until reveal-on-click. Sensitive fields. */
  sensitive?: boolean;
}

export interface IntegrationConfig {
  /** Provider name shown in the header (e.g., "Oracle", "PostgreSQL", "Google Drive"). */
  provider: string;
  /** Last-tested connection state. Surface as a status pill in the config card. */
  health: 'healthy' | 'degraded' | 'failed' | 'untested';
  fields: ConfigField[];
}

// ─── DB schemas (mock) ───────────────────────────────────────────────────────
// What the backend would expose via Knowledge Hub once a DB connection is wired
// up: the whitelisted tables and their columns. Drives the live-SQL dashboard
// flow — Add Widget renders this as a Database → Table → Column tree, and
// drag-to-canvas lets the user build charts without writing SQL by hand.

export type DbColumnKind = 'dimension' | 'measure';
export type DbColumnDataType = 'string' | 'number' | 'date' | 'boolean';

export interface DbColumn {
  /** Raw column name as it lives in the database. */
  name: string;
  /** Human-friendly label rendered in the tree and used for chart axes. */
  label: string;
  kind: DbColumnKind;
  dataType: DbColumnDataType;
}

export interface DbTable {
  schema: string;
  name: string;
  rowCount: number;
  columns: DbColumn[];
}

export const DB_SCHEMAS: Record<string, DbTable[]> = {
  // Oracle SAP-ERP — AP module
  'db-01': [
    {
      schema: 'AP_MODULE', name: 'INVOICE_HEADER', rowCount: 1_204_530,
      columns: [
        { name: 'INVOICE_DATE',     label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'PERIOD_MONTH',     label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'REGION_CODE',      label: 'Region',              kind: 'dimension', dataType: 'string' },
        { name: 'VENDOR_NAME',      label: 'Vendor Name',         kind: 'dimension', dataType: 'string' },
        { name: 'STATUS',           label: 'Status',              kind: 'dimension', dataType: 'string' },
        { name: 'CATEGORY',         label: 'Category',            kind: 'dimension', dataType: 'string' },
        { name: 'INVOICE_AMOUNT',   label: 'Invoice Amount (₹)',  kind: 'measure',   dataType: 'number' },
        { name: 'AMOUNT_AT_RISK',   label: 'Amount at Risk (₹)',  kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'AP_MODULE', name: 'DUPLICATE_AUDIT', rowCount: 184_220,
      columns: [
        { name: 'AUDIT_DATE',       label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'INVOICE_ID',       label: 'Invoice ID',          kind: 'dimension', dataType: 'string' },
        { name: 'DUPLICATE_COUNT',  label: 'Duplicate Count',     kind: 'measure',   dataType: 'number' },
        { name: 'DUPLICATE_SCORE',  label: 'Duplicate Score (%)', kind: 'measure',   dataType: 'number' },
        { name: 'INVOICES_SCANNED', label: 'Invoices Scanned',    kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
  // PostgreSQL — vendor master
  'db-02': [
    {
      schema: 'public', name: 'vendors', rowCount: 24_180,
      columns: [
        { name: 'vendor_id',     label: 'Vendor ID',     kind: 'dimension', dataType: 'string' },
        { name: 'vendor_name',   label: 'Vendor Name',   kind: 'dimension', dataType: 'string' },
        { name: 'region',        label: 'Region',        kind: 'dimension', dataType: 'string' },
        { name: 'category',      label: 'Category',      kind: 'dimension', dataType: 'string' },
        { name: 'status',        label: 'Status',        kind: 'dimension', dataType: 'string' },
        { name: 'risk_score',    label: 'Risk Score',    kind: 'measure',   dataType: 'number' },
        { name: 'credit_limit',  label: 'Credit Limit',  kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'public', name: 'invoices', rowCount: 1_842_310,
      columns: [
        { name: 'invoice_id',     label: 'Invoice ID',          kind: 'dimension', dataType: 'string' },
        { name: 'invoice_date',   label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'period_month',   label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'vendor_id',      label: 'Vendor ID',           kind: 'dimension', dataType: 'string' },
        { name: 'department',     label: 'Department',          kind: 'dimension', dataType: 'string' },
        { name: 'status',         label: 'Status',              kind: 'dimension', dataType: 'string' },
        { name: 'invoice_amount', label: 'Invoice Amount (₹)',  kind: 'measure',   dataType: 'number' },
        { name: 'duplicate_flag', label: 'Duplicate Count',     kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'public', name: 'payment_terms', rowCount: 312,
      columns: [
        { name: 'term_code',     label: 'Term Code',     kind: 'dimension', dataType: 'string' },
        { name: 'term_label',    label: 'Term',          kind: 'dimension', dataType: 'string' },
        { name: 'days_net',      label: 'Days (Net)',    kind: 'measure',   dataType: 'number' },
        { name: 'discount_pct',  label: 'Discount (%)',  kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
  // Snowflake — GL history
  'db-03': [
    {
      schema: 'GL_HISTORY', name: 'JOURNAL_ENTRIES', rowCount: 8_410_220,
      columns: [
        { name: 'POSTING_DATE',  label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'PERIOD',        label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'ACCOUNT',       label: 'Account',             kind: 'dimension', dataType: 'string' },
        { name: 'COST_CENTER',   label: 'Cost Center',         kind: 'dimension', dataType: 'string' },
        { name: 'DEPARTMENT',    label: 'Department',          kind: 'dimension', dataType: 'string' },
        { name: 'AMOUNT',        label: 'Amount (₹)',          kind: 'measure',   dataType: 'number' },
        { name: 'AMOUNT_AT_RISK',label: 'Amount at Risk (₹)',  kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'GL_HISTORY', name: 'CONTROL_TESTS', rowCount: 12_840,
      columns: [
        { name: 'TEST_DATE',     label: 'Date',              kind: 'dimension', dataType: 'date'   },
        { name: 'CONTROL_ID',    label: 'Control ID',        kind: 'dimension', dataType: 'string' },
        { name: 'CONTROL_NAME',  label: 'Control Name',      kind: 'dimension', dataType: 'string' },
        { name: 'OUTCOME',       label: 'Status',            kind: 'dimension', dataType: 'string' },
        { name: 'PASS_COUNT',    label: 'Pass Count',        kind: 'measure',   dataType: 'number' },
        { name: 'FAIL_COUNT',    label: 'Fail Count',        kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
  // Workday HRIS
  'db-04': [
    {
      schema: 'public', name: 'employees', rowCount: 18_230,
      columns: [
        { name: 'employee_id',   label: 'Employee ID',   kind: 'dimension', dataType: 'string' },
        { name: 'department',    label: 'Department',    kind: 'dimension', dataType: 'string' },
        { name: 'region',        label: 'Region',        kind: 'dimension', dataType: 'string' },
        { name: 'hire_date',     label: 'Hire Date',     kind: 'dimension', dataType: 'date'   },
        { name: 'status',        label: 'Status',        kind: 'dimension', dataType: 'string' },
        { name: 'headcount',     label: 'Headcount',     kind: 'measure',   dataType: 'number' },
        { name: 'salary_cost',   label: 'Salary Cost',   kind: 'measure',   dataType: 'number' },
      ],
    },
    {
      schema: 'public', name: 'expense_claims', rowCount: 142_310,
      columns: [
        { name: 'claim_date',    label: 'Date',                kind: 'dimension', dataType: 'date'   },
        { name: 'period_month',  label: 'Month',               kind: 'dimension', dataType: 'string' },
        { name: 'department',    label: 'Department',          kind: 'dimension', dataType: 'string' },
        { name: 'category',      label: 'Category',            kind: 'dimension', dataType: 'string' },
        { name: 'status',        label: 'Status',              kind: 'dimension', dataType: 'string' },
        { name: 'claim_amount',  label: 'Amount (₹)',          kind: 'measure',   dataType: 'number' },
        { name: 'duplicate_cnt', label: 'Duplicate Count',     kind: 'measure',   dataType: 'number' },
      ],
    },
  ],
};

// Masked by default — sensitive fields (password, secret, token) render as ••••••
// with a copy-to-clipboard fallback to the support contact.

export const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  'db-01': {
    provider: 'Oracle Database',
    health: 'healthy',
    fields: [
      { label: 'Host',      value: 'sap-erp-prod.internal.irame.ai' },
      { label: 'Port',      value: '1521' },
      { label: 'Service',   value: 'SAPERP' },
      { label: 'Schema',    value: 'AP_MODULE' },
      { label: 'Username',  value: 'irame_reader' },
      { label: 'Password',  value: 'a4tWNcK9z2QmYpv7rL', sensitive: true },
      { label: 'SSL Mode',  value: 'require' },
    ],
  },
  'db-02': {
    provider: 'PostgreSQL',
    health: 'healthy',
    fields: [
      { label: 'Host',      value: 'vendor-master.internal.irame.ai' },
      { label: 'Port',      value: '5432' },
      { label: 'Database',  value: 'vendor_master' },
      { label: 'Schema',    value: 'public' },
      { label: 'Username',  value: 'irame_reader' },
      { label: 'Password',  value: 'kPx2vNm8qZ4tYbR', sensitive: true },
      { label: 'SSL Mode',  value: 'verify-full' },
    ],
  },
  'db-03': {
    provider: 'Snowflake',
    health: 'degraded',
    fields: [
      { label: 'Account',     value: 'IRAME-XYZ12345.us-east-1' },
      { label: 'Warehouse',   value: 'AUDIT_WH' },
      { label: 'Database',    value: 'GL_HISTORY' },
      { label: 'Role',        value: 'AUDITOR_RO' },
      { label: 'Username',    value: 'svc_irame_audit' },
      { label: 'Private Key', value: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcw…', sensitive: true },
    ],
  },
  'db-04': {
    provider: 'PostgreSQL',
    health: 'healthy',
    fields: [
      { label: 'Host',      value: 'workday-hris.internal.irame.ai' },
      { label: 'Port',      value: '5432' },
      { label: 'Database',  value: 'workday_hris' },
      { label: 'Username',  value: 'irame_reader' },
      { label: 'Password',  value: 'jLm5xQp2vRz8nTk', sensitive: true },
      { label: 'SSL Mode',  value: 'require' },
    ],
  },
  'api-01': {
    provider: 'Workday REST API',
    health: 'healthy',
    fields: [
      { label: 'Base URL',     value: 'https://wd5-impl.workday.com/ccx/api/v1/irame' },
      { label: 'Auth Type',    value: 'OAuth 2.0 (Client Credentials)' },
      { label: 'Client ID',    value: 'irame-audit-prod' },
      { label: 'Client Secret', value: 'wQp9_XnT4zKrL2vBmYj8Hs', sensitive: true },
      { label: 'Token URL',    value: 'https://wd5-impl.workday.com/ccx/oauth2/irame/token' },
      { label: 'Scopes',       value: 'audit.read events.read' },
    ],
  },
  'api-02': {
    provider: 'NetSuite REST',
    health: 'healthy',
    fields: [
      { label: 'Account ID',  value: 'TSTDRV2147483' },
      { label: 'Base URL',    value: 'https://TSTDRV2147483.suitetalk.api.netsuite.com' },
      { label: 'Auth Type',   value: 'API Key (TBA)' },
      { label: 'Consumer Key', value: 'a8K3pQv2nR9zMmYpL4tWNcK9z2QmYpv7rL', sensitive: true },
      { label: 'Token Secret', value: 'xL7wQp9_XnT4zKrL2vBmYj8HsRtVbN', sensitive: true },
    ],
  },
  'api-03': {
    provider: 'JIRA Cloud REST',
    health: 'untested',
    fields: [
      { label: 'Site URL',  value: 'https://irame.atlassian.net' },
      { label: 'Auth Type', value: 'API Token (Basic)' },
      { label: 'Email',     value: 'svc-audit@irame.ai' },
      { label: 'API Token', value: 'ATATT3xFfGF0z2kPxQp9_XnT4zKrL2vBmYj8Hs', sensitive: true },
      { label: 'Project',   value: 'AUDIT' },
    ],
  },
  'cl-01': {
    provider: 'AWS S3',
    health: 'healthy',
    fields: [
      { label: 'Bucket',         value: 'auditify-evidence-bucket' },
      { label: 'Region',         value: 'us-east-1' },
      { label: 'Auth Type',      value: 'IAM Role (cross-account)' },
      { label: 'Role ARN',       value: 'arn:aws:iam::141813993525:role/IrameAuditReader' },
      { label: 'External ID',    value: 'irame-prod-2026-04', sensitive: true },
      { label: 'KMS Key Alias',  value: 'alias/auditify-evidence-kms' },
    ],
  },
  'cl-02': {
    provider: 'Google Drive',
    health: 'healthy',
    fields: [
      { label: 'Workspace',         value: 'irame.ai' },
      { label: 'Auth Type',         value: 'Service Account' },
      { label: 'Service Account',   value: 'irame-drive-reader@gen-lang-client-0250661731.iam.gserviceaccount.com' },
      { label: 'Key (JSON)',        value: '{"type":"service_account","project_id":"gen-lang-client-0250661731",…}', sensitive: true },
      { label: 'Folder ID',         value: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345' },
      { label: 'Scopes',            value: 'drive.readonly drive.metadata.readonly' },
    ],
  },
  'cl-03': {
    provider: 'Microsoft 365 SharePoint',
    health: 'healthy',
    fields: [
      { label: 'Tenant ID',     value: 'aBcDeFgH-1234-5678-9012-irameTenantId' },
      { label: 'Site URL',      value: 'https://irame.sharepoint.com/sites/AuditLibrary' },
      { label: 'Auth Type',     value: 'Azure AD App (Client Credentials)' },
      { label: 'Client ID',     value: 'a8K3pQv2-nR9z-MmYp-L4tW-NcK9z2QmYpv7' },
      { label: 'Client Secret', value: 'xL7wQp9_XnT4zKrL2vBmYj8HsRtVbN_3jK', sensitive: true },
      { label: 'Scopes',        value: 'Sites.Read.All Files.Read.All' },
    ],
  },
};
