/** ── Reading a table out of whatever file the client sends ──────────────────
 *  The three scoping uploads — org chart, trial balance, general ledger — used
 *  to read spreadsheets only and refuse everything else (24 Sep). Clients keep
 *  these documents as PDFs, Word files and scans just as often, so every one of
 *  them is read here into the same shape a spreadsheet gives: one grid of
 *  trimmed string cells per table. The parsers downstream never learn which
 *  kind of file it was.
 *
 *  - Spreadsheet (.xlsx / .xls / .csv): SheetJS, as before.
 *  - PDF: the text pdf.js finds, put back into rows by where it sits on the
 *    page. A page with no text is a scan and is read by OCR.
 *  - Word (.docx): mammoth turns it into HTML and its tables are read; a
 *    document with no table falls back to its lines.
 *  - Old Word (.doc): the text stream of the binary file, cells split where
 *    Word marks them.
 *  - Image: OCR (tesseract), the words put back into rows the same way a PDF's
 *    are.
 *
 *  mammoth and tesseract are imported only when such a file arrives, so the
 *  page does not carry them until somebody needs them.
 *
 *  Self-contained on purpose — the parsers that use it must not reach into the
 *  RACM importer (an import cycle bit the org chart once already).
 */
import * as XLSX from 'xlsx';

export interface ReadSheet { name: string; rows: string[][] }
export type ReadVia = 'sheet' | 'pdf' | 'word' | 'scan';
/** For a PDF or an image, the text as it sat on each page is handed back too,
 *  read or not — a drawn org chart has no table, but its boxes still name
 *  every company (orgChartImport reads them from this). */
export type TableReadResult =
  | { ok: true; sheets: ReadSheet[]; via: ReadVia; pages?: PlacedText[][] }
  | { ok: false; reason: 'no-table' | 'unsupported'; pages?: PlacedText[][] };

const SHEET = /\.(xlsx|xlsm|xlsb|xls|csv|tsv)$/i;
const PDF = /\.pdf$/i;
const DOCX = /\.docx$/i;
const DOC = /\.doc$/i;
const IMAGE = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;

/** What the upload controls offer — the formats this file can actually read. */
export const TABLE_FILE_ACCEPT =
  '.xlsx,.xlsm,.xlsb,.xls,.csv,.tsv,.pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff';

export const isReadableTableFile = (fileName: string): boolean => {
  const n = fileName.trim();
  return SHEET.test(n) || PDF.test(n) || DOCX.test(n) || DOC.test(n) || IMAGE.test(n);
};

/** An image is always a scan — the caller can say so before reading starts. */
export const isScanFile = (fileName: string): boolean => IMAGE.test(fileName.trim());

const clean = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Drops rows with nothing in them, and the "Page 2 of 5" a printed report
 *  stamps on every page — neither is a row of the table. */
function tidy(rows: string[][]): string[][] {
  return rows.filter(r => {
    const filled = r.filter(c => c);
    if (!filled.length) return false;
    if (filled.length === 1 && /^page\s+\d+(\s*(of|\/)\s*\d+)?$/i.test(filled[0])) return false;
    return true;
  });
}

// ── Text placed on a page → rows and columns ───────────────────────────────
/** One run of text and where it sits. `y` runs DOWN the page (a PDF's runs up,
 *  so the reader flips it), `h` is roughly the font size. */
export interface PlacedText { x: number; y: number; w: number; h: number; text: string }

/**
 * Puts loose text back into a grid, the way a reader's eye does.
 *
 * Lines first: runs whose baselines sit within half a line of each other are
 * one row. Columns next: across every row that has more than one cell, which
 * stretches of the page carry text and which are blank all the way down. The
 * blank stretches are the gutters between columns. A single stray run that
 * bridges a gutter (a long name touching the next column) is outvoted rather
 * than allowed to merge two columns.
 */
export function rowsFromPlacedText(input: PlacedText[]): string[][] {
  const items = input.filter(t => t.text.trim() && t.w >= 0 && t.h > 0);
  if (!items.length) return [];

  // ── Lines
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: PlacedText[][] = [];
  let lineY = -Infinity;
  let lineH = 0;
  for (const t of sorted) {
    const cur = lines[lines.length - 1];
    if (cur && Math.abs(t.y - lineY) <= Math.max(lineH, t.h) * 0.5) cur.push(t);
    else { lines.push([t]); lineY = t.y; lineH = t.h; }
  }
  lines.forEach(l => l.sort((a, b) => a.x - b.x));

  // ── Cells within a line: runs closer than most of a character are one cell.
  // A word space is about a third of the text's height; a column gutter is
  // wider than the text is tall.
  type Span = { x0: number; x1: number; items: PlacedText[] };
  const cellsOf = (line: PlacedText[]): Span[] => {
    const out: Span[] = [];
    for (const t of line) {
      const last = out[out.length - 1];
      if (last && t.x - last.x1 < t.h * 0.8) { last.x1 = Math.max(last.x1, t.x + t.w); last.items.push(t); }
      else out.push({ x0: t.x, x1: t.x + t.w, items: [t] });
    }
    return out;
  };

  // ── Columns: where text sits across the rows that look like table rows
  const tableLines = lines.map(cellsOf).filter(c => c.length > 1);
  const minX = Math.floor(Math.min(...items.map(t => t.x)));
  const maxX = Math.ceil(Math.max(...items.map(t => t.x + t.w)));
  let columns: { x0: number; x1: number }[];
  if (!tableLines.length) {
    columns = [{ x0: minX, x1: maxX }];
  } else {
    const width = maxX - minX + 1;
    const cover = new Array<number>(width).fill(0);
    for (const cells of tableLines) {
      for (const c of cells) {
        for (let x = Math.max(0, Math.floor(c.x0) - minX); x <= Math.min(width - 1, Math.ceil(c.x1) - minX); x++) cover[x]++;
      }
    }
    const gutter = Math.floor(tableLines.length * 0.04);
    columns = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const on = x < width && cover[x] > gutter;
      if (on && start < 0) start = x;
      if (!on && start >= 0) { columns.push({ x0: start + minX, x1: x - 1 + minX }); start = -1; }
    }
    if (!columns.length) columns = [{ x0: minX, x1: maxX }];
  }

  // ── Each cell goes to the column it overlaps most (or sits nearest). A
  // header sits wider than the right-aligned figures under it, so its words
  // are placed as one cell rather than one by one into the gutter. A cell that
  // spans two columns is two cells too close together: it is split at its
  // widest gaps, one piece per column.
  const overlapOf = (a: number, b: number, c: { x0: number; x1: number }) => Math.min(b, c.x1) - Math.max(a, c.x0);
  const nearest = (a: number, b: number): number => {
    let best = 0, bestScore = -Infinity;
    columns.forEach((c, i) => {
      const overlap = overlapOf(a, b, c);
      const score = overlap > 0 ? overlap : -Math.min(Math.abs(a - c.x1), Math.abs(b - c.x0));
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  };
  const joinRuns = (runs: PlacedText[]): string => {
    let text = '';
    let end = -Infinity;
    for (const t of runs) {
      const s = t.text.trim();
      // Runs that touch are one word split by the PDF (a ligature, a kerning
      // change) — joined without a space. A real gap is a space.
      text = !text ? s : t.x - end < t.h * 0.12 ? `${text}${s}` : `${text} ${s}`;
      end = t.x + t.w;
    }
    return text;
  };

  return tidy(lines.map(line => {
    const row = columns.map(() => '');
    const put = (i: number, runs: PlacedText[]) => {
      const text = joinRuns(runs);
      row[i] = row[i] ? `${row[i]} ${text}` : text;
    };
    for (const cell of cellsOf(line)) {
      const spanned = columns.map((c, i) => ({ c, i })).filter(({ c }) => overlapOf(cell.x0, cell.x1, c) > 0).map(x => x.i);
      if (spanned.length <= 1 || cell.items.length < 2) { put(spanned[0] ?? nearest(cell.x0, cell.x1), cell.items); continue; }
      const k = Math.min(spanned.length, cell.items.length);
      const gaps = cell.items.slice(1).map((t, j) => ({ j: j + 1, gap: t.x - (cell.items[j].x + cell.items[j].w) }));
      const cuts = gaps.sort((a, b) => b.gap - a.gap).slice(0, k - 1).map(g => g.j).sort((a, b) => a - b);
      let from = 0;
      [...cuts, cell.items.length].forEach((to, n) => {
        const piece = cell.items.slice(from, to);
        const end = piece[piece.length - 1];
        put(n < spanned.length ? nearest(piece[0].x, end.x + end.w) : spanned[spanned.length - 1], piece);
        from = to;
      });
    }
    return row.map(clean);
  }));
}

/** Lines of plain text, split where a table's columns would be: a tab, or a
 *  gap of two spaces or more. */
export function rowsFromTextLines(text: string): string[][] {
  return tidy(text.split(/\r?\n/).map(l => l.split(/\t| {2,}/).map(clean)));
}

/** Several tables with the same columns are one table broken across pages —
 *  read them as one. Tables that differ stay apart for the parser to choose. */
function joinTables(tables: string[][][], label: string): ReadSheet[] {
  const usable = tables.map(tidy).filter(t => t.length);
  if (!usable.length) return [];
  const width = (t: string[][]) => Math.max(...t.map(r => r.length));
  if (usable.every(t => width(t) === width(usable[0]))) return [{ name: label, rows: usable.flat() }];
  return usable.map((rows, i) => ({ name: `${label} ${i + 1}`, rows }));
}

// ── Spreadsheet ────────────────────────────────────────────────────────────
function readSheetFile(buf: ArrayBuffer): ReadSheet[] {
  const wb = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const raw = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: true }) : [];
    return { name, rows: raw.map(r => (Array.isArray(r) ? r : []).map(v => String(v ?? '').trim())) };
  });
}

// ── PDF ────────────────────────────────────────────────────────────────────
let pdfWorkerSet = false;
async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfWorkerSet) {
    // Same set-up as the data-sources reader: a real Worker for pdf.js.
    const { default: PdfjsWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker');
    pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
    pdfWorkerSet = true;
  }
  return pdfjs;
}

/** pdf.js text items carry their position in `transform` — x at [4], the
 *  baseline at [5], measured up from the page's foot. */
interface PdfTextItem { str: string; transform: number[]; width: number; height: number }

/**
 * A PDF's text as sheets. The whole document read as one grid comes first —
 * a table that runs on from page to page without repeating its header reads
 * as one. Then each page on its own, with consecutive pages that repeat the
 * same header joined (5 Oct): a report that opens with drawn charts and ends
 * with its register used to be read as one grid, and the charts' columns
 * scrambled the register's, so no table was found at all.
 */
export function sheetsFromPdfPages(pages: PlacedText[][]): ReadSheet[] {
  const whole = rowsFromPlacedText(pages.flat());
  const sheets: ReadSheet[] = whole.length ? [{ name: 'PDF', rows: whole }] : [];
  if (pages.length < 2) return sheets;
  const headerAt = (rows: string[][]) => rows.findIndex(r => r.filter(c => c).length >= 3);
  const keyOf = (rows: string[][], i: number) => (i < 0 ? '' : rows[i].map(c => c.toLowerCase()).join('|'));
  let group: { from: number; to: number; key: string; rows: string[][] } | null = null;
  const flush = () => {
    if (group?.rows.length) {
      sheets.push({ name: group.from === group.to ? `Page ${group.from}` : `Pages ${group.from}–${group.to}`, rows: group.rows });
    }
    group = null;
  };
  pages.forEach((page, n) => {
    const rows = rowsFromPlacedText(page);
    const h = headerAt(rows);
    const key = keyOf(rows, h);
    if (group && key && key === group.key) {
      group.rows.push(...rows.slice(h + 1));
      group.to = n + 1;
      return;
    }
    flush();
    group = { from: n + 1, to: n + 1, key, rows };
  });
  flush();
  return sheets;
}

async function readPdf(buf: ArrayBuffer, onScan?: () => void): Promise<{ sheets: ReadSheet[]; scanned: boolean; pages: PlacedText[][] }> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: PlacedText[][] = [];
  let scanned = false;
  let top = 0;
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const view = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = (content.items as unknown[]).filter((i): i is PdfTextItem => !!i && typeof (i as PdfTextItem).str === 'string');
      const placed: PlacedText[] = [];
      pages.push(placed);
      if (items.some(i => i.str.trim())) {
        for (const i of items) {
          const h = i.height || Math.abs(i.transform[3]) || 10;
          placed.push({ x: i.transform[4], y: top + (view.height - i.transform[5]), w: i.width, h, text: i.str });
        }
      } else {
        // No text on the page: it is a picture of one. Draw it and read it.
        if (!scanned) onScan?.();
        scanned = true;
        const scale = 2;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          for (const w of await ocrWords(canvas)) placed.push({ ...w, x: w.x / scale, y: top + w.y / scale, w: w.w / scale, h: w.h / scale });
        }
      }
      top += view.height + 20;
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return { sheets: sheetsFromPdfPages(pages), scanned, pages };
}

// ── OCR ────────────────────────────────────────────────────────────────────
/** Every word tesseract finds, placed on its line. A word takes its LINE's
 *  middle and height rather than its own — "ance" and "Total" sit on one line
 *  but their boxes do not line up. */
export async function ocrWords(image: Blob | HTMLCanvasElement): Promise<PlacedText[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    const out: PlacedText[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const h = Math.max(1, line.bbox.y1 - line.bbox.y0);
          const y = (line.bbox.y0 + line.bbox.y1) / 2;
          for (const word of line.words) {
            if (!word.text.trim()) continue;
            out.push({ x: word.bbox.x0, y, w: word.bbox.x1 - word.bbox.x0, h, text: word.text });
          }
        }
      }
    }
    return out;
  } finally {
    await worker.terminate();
  }
}

// ── Word (.docx) ───────────────────────────────────────────────────────────
/** The tables in mammoth's HTML, as rows. */
export function rowsFromDocxHtml(html: string): ReadSheet[] {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  // Only the outermost tables — a table nested in a cell is part of that cell.
  const tables = Array.from(dom.querySelectorAll('table')).filter(t => !t.parentElement?.closest('table'));
  const grids = tables.map(t =>
    Array.from(t.querySelectorAll('tr'))
      .filter(tr => tr.closest('table') === t)
      .map(tr => Array.from(tr.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH').map(c => clean(c.textContent))));
  return joinTables(grids, 'Word');
}

async function readDocx(buf: ArrayBuffer): Promise<ReadSheet[]> {
  const mod = await import('mammoth');
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const fromTables = rowsFromDocxHtml(html);
  if (fromTables.length) return fromTables;
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
  const rows = rowsFromTextLines(text);
  return rows.length ? [{ name: 'Word', rows }] : [];
}

// ── Old Word (.doc) ────────────────────────────────────────────────────────
/**
 * The text of a Word 97–2003 file. Its body is not stored in order: a table
 * of pieces (the CLX, in the 0Table / 1Table stream) says where each run of
 * text lives in the WordDocument stream and whether it is one byte a character
 * or two. Read in piece order that gives the document's text, in which Word
 * ends every paragraph with \r and every table cell with \x07.
 */
export function wordDocText(buf: ArrayBuffer | Uint8Array): string {
  // SheetJS carries the compound-file reader it uses for .xls; no second copy.
  const CFB = (XLSX as unknown as { CFB?: typeof XLSX.CFB; default?: { CFB: typeof XLSX.CFB } }).CFB
    ?? (XLSX as unknown as { default?: { CFB: typeof XLSX.CFB } }).default?.CFB;
  if (!CFB) return '';
  const cfb = CFB.read(buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: 'array' });
  const streamOf = (name: string): Uint8Array | undefined => {
    const entry = CFB.find(cfb, name);
    const content = entry?.content as Uint8Array | number[] | undefined;
    return content ? (content instanceof Uint8Array ? content : Uint8Array.from(content)) : undefined;
  };
  const wd = streamOf('WordDocument');
  if (!wd || wd.length < 0x1aa) return '';
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (dv.getUint16(0, true) !== 0xa5ec) return '';
  const whichTable = (dv.getUint16(0x0a, true) & 0x0200) ? '1Table' : '0Table';
  const table = streamOf(whichTable);
  const fcClx = dv.getUint32(0x01a2, true);
  const lcbClx = dv.getUint32(0x01a6, true);
  if (!table || !lcbClx || fcClx + lcbClx > table.length) return '';
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength);

  let pos = fcClx;
  const end = fcClx + lcbClx;
  while (pos < end && table[pos] === 0x01) pos += 3 + tv.getUint16(pos + 1, true); // Prc — formatting, skipped
  if (table[pos] !== 0x02) return '';
  const lcb = tv.getUint32(pos + 1, true);
  const plc = pos + 5;
  const n = Math.floor((lcb - 4) / 12);
  const latin = new TextDecoder('windows-1252');
  const utf16 = new TextDecoder('utf-16le');
  let text = '';
  for (let i = 0; i < n; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true);
    const cpEnd = tv.getUint32(plc + (i + 1) * 4, true);
    const pcd = plc + (n + 1) * 4 + i * 8;
    const fcRaw = tv.getUint32(pcd + 2, true);
    const chars = cpEnd - cpStart;
    if (chars <= 0) continue;
    if (fcRaw & 0x40000000) {
      const at = (fcRaw & 0x3fffffff) / 2;
      text += latin.decode(wd.subarray(at, at + chars));
    } else {
      text += utf16.decode(wd.subarray(fcRaw, fcRaw + chars * 2));
    }
  }
  return text;
}

/** Word's own marks back into rows: \x07 closes a cell, and a second \x07
 *  straight after the last cell closes the row. Paragraphs outside a table
 *  become rows of their own, split on tabs or wide gaps. */
export function rowsFromWordText(text: string): ReadSheet[] {
  // Field codes and other control marks carry no table content.
  const t = text.replace(/[\x00-\x06\x08\x0b\x0c\x0e-\x1f]/g, '');
  const tables: string[][][] = [];
  const loose: string[][] = [];
  let rows: string[][] = [];
  let cells: string[] = [];
  let buf = '';
  let width: number | undefined;
  let lastWasCell = false;
  const endTable = () => { if (rows.length) tables.push(rows); rows = []; width = undefined; };
  for (const ch of t) {
    if (ch === '\x07') {
      const rowEnd = width !== undefined ? cells.length === width : buf === '' && lastWasCell && cells.length > 0;
      if (rowEnd) { if (width === undefined) width = cells.length; rows.push(cells.map(clean)); cells = []; }
      else cells.push(buf);
      buf = '';
      lastWasCell = true;
      continue;
    }
    if (ch === '\r') {
      if (cells.length) { buf += ' '; continue; } // a second paragraph inside a cell
      endTable();
      loose.push(...rowsFromTextLines(buf));
      buf = '';
      lastWasCell = false;
      continue;
    }
    buf += ch;
    lastWasCell = false;
  }
  endTable();
  if (buf.trim()) loose.push(...rowsFromTextLines(buf));
  const fromTables = joinTables(tables, 'Word');
  if (fromTables.length) return fromTables;
  const rest = tidy(loose);
  return rest.length ? [{ name: 'Word', rows: rest }] : [];
}

// ── The one entry point ────────────────────────────────────────────────────
/**
 * Reads any of the formats above into rows. `onScan` fires the moment OCR is
 * needed, so the upload can say a scan takes a few seconds — an image says so
 * straight away, a PDF only once a page turns out to have no text.
 */
export async function readTableRows(file: File, onScan?: () => void): Promise<TableReadResult> {
  const name = file.name.trim();
  if (!isReadableTableFile(name)) return { ok: false, reason: 'unsupported' };
  try {
    let sheets: ReadSheet[];
    let via: ReadVia;
    let pages: PlacedText[][] | undefined;
    if (SHEET.test(name)) {
      sheets = readSheetFile(await file.arrayBuffer());
      via = 'sheet';
    } else if (PDF.test(name)) {
      const r = await readPdf(await file.arrayBuffer(), onScan);
      sheets = r.sheets;
      pages = r.pages;
      via = r.scanned ? 'scan' : 'pdf';
    } else if (DOCX.test(name)) {
      sheets = await readDocx(await file.arrayBuffer());
      via = 'word';
    } else if (DOC.test(name)) {
      sheets = rowsFromWordText(wordDocText(await file.arrayBuffer()));
      via = 'word';
    } else {
      onScan?.();
      const words = await ocrWords(file);
      pages = [words];
      const rows = rowsFromPlacedText(words);
      sheets = rows.length ? [{ name: 'Scan', rows }] : [];
      via = 'scan';
    }
    // A table is at least two rows (a header and something under it) and two
    // columns. Anything less is prose, a blank page, or a scan nobody can read.
    const usable = sheets.filter(s => {
      const filled = s.rows.filter(r => r.filter(c => c).length >= 2);
      return filled.length >= 2;
    });
    return usable.length ? { ok: true, sheets: usable, via, pages } : { ok: false, reason: 'no-table', pages };
  } catch {
    return { ok: false, reason: 'no-table' };
  }
}
