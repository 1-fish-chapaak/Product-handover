/** ── The evidence, with the part the answer rests on marked ──────────────────
 *  A design check used to produce a verdict and nothing you could check it
 *  against: the file was named in a chip and never opened. This renders the
 *  file the check was validated against and boxes the passage the answer came
 *  from, so a reviewer can read the conclusion and the thing it was drawn from
 *  side by side (user ask, 25 Sep).
 *
 *  The marks are FOUND, not authored. A PDF is read with pdf.js and the quote
 *  located among its text items; a spreadsheet is read with the same SheetJS
 *  the imports use and the matching cells marked. That means it works on a
 *  document the client uploaded, not only on one we prepared — which is the
 *  difference between a feature and a screenshot.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import { getPdfjs } from '../data-sources/datasetFiles';
import type { EvidenceFile } from './types';

/** A box to draw over a rendered page, in CSS pixels of that page. */
interface Mark { page: number; x: number; y: number; w: number; h: number; quote: string }

/** Rendering every page of a long document inside a modal is a cost nobody
 *  asked for; the passage being cited is near the front in any evidence
 *  document worth citing. */
const MAX_PAGES = 6;
const SCALE = 1.35;

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

interface Props {
  file: EvidenceFile;
  /** Phrases to find and box. The first one that matches wins the scroll. */
  quotes: string[];
  /** Which quote the reader is on, so the others stay quiet. */
  active?: string;
}

export default function EvidenceAnnotator({ file, quotes, active }: Props) {
  if (!file.url) return <NoBytes file={file} />;
  if (file.kind === 'PDF') return <PdfAnnotator file={file} quotes={quotes} active={active} />;
  if (file.kind === 'XLSX' || file.kind === 'CSV') return <SheetAnnotator file={file} quotes={quotes} active={active} />;
  return <ImageEvidence file={file} />;
}

/** A file that was seeded rather than picked from this machine has no bytes to
 *  show. Saying so is better than an empty frame that looks broken. */
function NoBytes({ file }: { file: EvidenceFile }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-2">
      <FileText size={20} className="text-ink-300" />
      <p className="text-[0.78125rem] font-semibold text-ink-700">{file.name}</p>
      <p className="text-[0.71875rem] text-ink-500 leading-relaxed max-w-[26rem]">
        This file was attached in an earlier session, so its contents aren’t on this machine to mark up.
        Re-attach it on the design element to see the passage behind the answer.
      </p>
    </div>
  );
}

function ImageEvidence({ file }: { file: EvidenceFile }) {
  return (
    <div className="p-4">
      <img src={file.url} alt={file.name} className="w-full rounded-lg border border-canvas-border" />
    </div>
  );
}

// ── PDF ────────────────────────────────────────────────────────────────────
function PdfAnnotator({ file, quotes, active }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [pages, setPages] = useState<{ n: number; w: number; h: number }[]>([]);
  const canvases = useRef(new Map<number, HTMLCanvasElement>());

  // The quote list is rebuilt on every render by the caller; depend on its
  // content rather than its identity or this re-renders the document forever.
  const key = useMemo(() => quotes.map(squash).join('||'), [quotes]);

  useEffect(() => {
    let dead = false;
    (async () => {
      setState('loading');
      try {
        const pdfjs = await getPdfjs();
        const data = await (await fetch(file.url!)).arrayBuffer();
        if (dead) return;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
        const count = Math.min(doc.numPages, MAX_PAGES);
        const found: Mark[] = [];
        const dims: { n: number; w: number; h: number }[] = [];
        const wanted = key ? key.split('||').filter(Boolean) : [];

        for (let n = 1; n <= count; n++) {
          if (dead) return;
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: SCALE });
          dims.push({ n, w: viewport.width, h: viewport.height });

          const canvas = canvases.current.get(n);
          if (canvas) {
            const ratio = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * ratio);
            canvas.height = Math.floor(viewport.height * ratio);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
              await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            }
          }

          // ── locate the quotes among this page's text items ───────────────
          // A phrase rarely lives in one item, so the page is flattened into a
          // single string with each item's span recorded, the match is made on
          // that string, and every item the match touches gets a box. Boxing
          // the union rather than the exact glyphs is deliberate: a tight box
          // round part of a word reads like a rendering fault.
          const text = await page.getTextContent();
          const spans: { from: number; to: number; item: any }[] = [];
          let flat = '';
          for (const item of text.items as any[]) {
            if (typeof item.str !== 'string') continue;
            const piece = item.str;
            if (!piece) continue;
            const from = flat.length;
            flat += piece;
            spans.push({ from, to: flat.length, item });
            if (!piece.endsWith(' ')) flat += ' ';
          }
          const hay = squash(flat);
          // squash() collapses runs of whitespace, which shifts indexes; rebuild
          // a parallel index map so a hit in the squashed string can be traced
          // back to the original offsets.
          const map: number[] = [];
          let prevSpace = true;
          for (let i = 0; i < flat.length; i++) {
            const ch = flat[i];
            const isSpace = /\s/.test(ch);
            if (isSpace && prevSpace) continue;
            map.push(i);
            prevSpace = isSpace;
          }

          for (const q of wanted) {
            // Each citation carries alternatives; the first that appears in
            // this document wins, and the mark keeps the citation's own
            // identity so the left-hand answer still owns it.
            const alt = q.split('|').map(a => a.trim()).filter(Boolean).find(a => hay.includes(a));
            if (!alt) continue;
            let at = hay.indexOf(alt);
            while (at >= 0) {
              const startRaw = map[at] ?? 0;
              const endRaw = map[Math.min(at + alt.length - 1, map.length - 1)] ?? flat.length;
              const touched = spans.filter(s => s.to > startRaw && s.from <= endRaw);
              for (const s of touched) {
                const tx = pdfjs.Util.transform(viewport.transform, s.item.transform);
                const h = Math.hypot(tx[2], tx[3]) || 10;
                const w = (s.item.width ?? 0) * SCALE;
                found.push({ page: n, x: tx[4], y: tx[5] - h, w: w || 40, h, quote: q });
              }
              at = hay.indexOf(alt, at + Math.max(alt.length, 1));
              // One passage per page per quote is enough to point at.
              break;
            }
          }
        }
        if (dead) return;
        setPages(dims);
        setMarks(found);
        setState('ready');
      } catch {
        if (!dead) setState('failed');
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.url, key]);

  // Bring the cited passage into view once it has been found.
  useEffect(() => {
    if (state !== 'ready' || !holder.current) return;
    const want = active ? squash(active) : marks[0]?.quote;
    const hit = marks.find(m => m.quote === want) ?? marks[0];
    if (!hit) return;
    const el = holder.current.querySelector<HTMLElement>(`[data-page="${hit.page}"]`);
    if (el) holder.current.scrollTo({ top: Math.max(0, el.offsetTop + hit.y - 120), behavior: 'smooth' });
  }, [state, marks, active]);

  const activeQ = active ? squash(active) : undefined;

  return (
    <div ref={holder} className="h-full overflow-y-auto bg-paper-50/60 px-4 py-4">
      {state === 'loading' && (
        <div className="h-full flex items-center justify-center gap-2 text-ink-400">
          <Loader2 size={14} className="animate-spin" /><span className="text-[0.75rem]">Reading {file.name}…</span>
        </div>
      )}
      {state === 'failed' && (
        <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
          <AlertTriangle size={18} className="text-mitigated-600" />
          <p className="text-[0.75rem] text-ink-600 max-w-[24rem]">
            {file.name} couldn’t be rendered here. It may be password-protected or damaged.
          </p>
        </div>
      )}
      <div className={cn('space-y-4', state !== 'ready' && 'hidden')}>
        {(pages.length ? pages : [{ n: 1, w: 0, h: 0 }]).map(p => (
          <div key={p.n} data-page={p.n} className="relative mx-auto shadow-sm" style={{ width: p.w || undefined }}>
            <canvas
              ref={el => { if (el) canvases.current.set(p.n, el); }}
              className="block rounded border border-canvas-border bg-white"
            />
            {marks.filter(m => m.page === p.n).map((m, i) => {
              const on = !activeQ || m.quote === activeQ;
              return (
                <span
                  key={i}
                  aria-hidden
                  className={cn('absolute rounded-[2px] pointer-events-none transition-opacity',
                    on ? 'opacity-100' : 'opacity-25')}
                  style={{
                    left: m.x - 2, top: m.y - 2, width: m.w + 4, height: m.h + 4,
                    // A dashed brand outline over a wash — readable on a white
                    // page without hiding the words underneath it.
                    outline: `2px dashed ${on ? 'rgb(109 40 217)' : 'rgb(148 163 184)'}`,
                    background: on ? 'rgba(139, 92, 246, 0.16)' : 'transparent',
                  }}
                />
              );
            })}
          </div>
        ))}
        {state === 'ready' && marks.length === 0 && (
          <p className="text-center text-[0.71875rem] text-ink-500 py-2">
            Nothing in this document matched the wording behind the answer — the page is shown unmarked.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Spreadsheet ────────────────────────────────────────────────────────────
function SheetAnnotator({ file, quotes, active }: Props) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [sheetName, setSheetName] = useState('');
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const buf = await (await fetch(file.url!)).arrayBuffer();
        if (dead) return;
        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        const name = wb.SheetNames[0];
        const ws = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: false });
        if (dead) return;
        setSheetName(name);
        // Enough rows to show the hit in context without rendering a ledger.
        setRows(aoa.slice(0, 250).map(r => (Array.isArray(r) ? r : []).map(v => String(v ?? ''))));
        setState('ready');
      } catch { if (!dead) setState('failed'); }
    })();
    return () => { dead = true; };
  }, [file.url]);

  const wanted = quotes.map(squash).filter(Boolean);
  const activeQ = active ? squash(active) : undefined;
  const hitOf = (cell: string): string | null => {
    const c = squash(cell);
    if (!c) return null;
    return wanted.find(q => q.split('|').map(a => a.trim()).filter(Boolean).some(a => c.includes(a))) ?? null;
  };

  useEffect(() => {
    if (state !== 'ready' || !holder.current) return;
    const el = holder.current.querySelector<HTMLElement>('[data-hit="1"]');
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [state, activeQ]);

  if (state === 'loading') {
    return <div className="h-full flex items-center justify-center gap-2 text-ink-400"><Loader2 size={14} className="animate-spin" /><span className="text-[0.75rem]">Reading {file.name}…</span></div>;
  }
  if (state === 'failed' || !rows) {
    return <div className="h-full flex items-center justify-center px-6 text-center"><p className="text-[0.75rem] text-ink-600">{file.name} couldn’t be read as a spreadsheet.</p></div>;
  }

  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  let first = true;

  return (
    <div ref={holder} className="h-full overflow-auto bg-paper-50/60">
      <div className="px-3 py-2 text-[0.65625rem] font-semibold text-ink-500 sticky top-0 bg-canvas-elevated border-b border-canvas-border z-10">
        {file.name}{sheetName && <span className="text-ink-400"> · {sheetName}</span>}
      </div>
      <table className="text-[0.6875rem] border-collapse">
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              <td className="sticky left-0 bg-paper-50 text-ink-300 text-[0.625rem] px-2 border border-canvas-border/60 text-right select-none">{ri + 1}</td>
              {Array.from({ length: width }).map((_, ci) => {
                const cell = r[ci] ?? '';
                const hit = hitOf(cell);
                const on = !!hit && (!activeQ || hit === activeQ);
                const mark = on && first;
                if (mark) first = false;
                return (
                  <td key={ci} data-hit={mark ? '1' : undefined}
                    className={cn('px-2 py-1 border border-canvas-border/60 whitespace-nowrap max-w-[16rem] truncate',
                      ri === 0 ? 'font-semibold text-ink-700 bg-paper-50/80' : 'text-ink-700 bg-white',
                      on && 'outline outline-2 outline-dashed outline-brand-600 bg-brand-50 font-semibold relative z-[1]',
                      hit && !on && 'bg-paper-100')}
                    title={cell}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
