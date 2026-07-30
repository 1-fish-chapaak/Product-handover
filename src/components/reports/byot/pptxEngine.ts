// ─── Bring Your Own Template — reading a PowerPoint ─────────────────────────
//
// A PowerPoint is the opposite problem to a PDF. Where a PDF labels nothing, a
// .pptx labels nearly everything: it says outright "this box is the slide
// title", "this is a table", "this slide uses that layout". Most of the
// guessing the PDF reader has to do is simply not needed here, so passes one to
// five shrink to almost nothing.
//
// What does NOT change is everything after the reading. The two questions, the
// rating words, the sign-off setting, the descriptions and the fill cases all
// come from the shared assembler in byotEngine, which is why a deck and a
// document describing the same report come out as the same template.
//
// Two corrections learned from a real committee deck, and both are in here:
//
//   · THE REPETITION RULE OUTRANKS THE LABELS. A title box carrying the same
//     text on every slide is the company name used as a running header, so it
//     is furniture even though PowerPoint calls it the title. The real heading
//     is the next box down.
//   · A STAMP CAN SPAN SEVERAL SLIDES IN A ROW. A snapshot slide followed by
//     its finding slides, the whole run repeating once per audit, so
//     repeat-spotting looks across slide sequences and not just inside one
//     slide.

import { openZip, type Zip } from './zip';
import {
  assemble, classifyStamped,
  norm, median,
  MAX_BYTES, PAGE_CAP, SNAPSHOT_MAX, SNAPSHOT_WIDTH,
  REPEAT_PAGES, REPEAT_SHARE, CONTENTS, CONFIDENTIAL,
  type Line, type SpineSection, type Tree, type RawBlock,
  type ReadOutcome, type ReadFurniture,
} from './byotEngine';
import { buildDeckTree as buildDeckTree_, type DeckUnit } from './deckRules';

// ═══ Units and defaults ══════════════════════════════════════════════════════

/** English Metric Units per point. Everything is converted once, at the edge,
 *  so the rest of the engine only ever sees points, same as the PDF path. */
const EMU_PER_PT = 12700;
const pt = (emu: number) => emu / EMU_PER_PT;

/** When a run does not state its size, the placeholder it sits in decides. The
 *  real answer is inherited down layout → master → theme, but the relative
 *  sizes are what the reader uses and these hold that order. */
const DEFAULT_SIZE: Record<string, number> = {
  ctrTitle: 40, title: 30, subTitle: 20, body: 18, ftr: 11, sldNum: 11, dt: 11, '': 18,
};

/** A slide that says goodbye rather than saying anything. */
const CLOSING = /\b(thank you|thanks|any questions|questions\?|q\s*&\s*a|end of (the )?(report|presentation)|contact us)\b/i;
/** A slide that lists what is coming rather than being one of the things. */
const AGENDA = /^(agenda|overview|what we will cover|today'?s agenda)$/i;

// ═══ What comes out of the file ══════════════════════════════════════════════

type Para = { text: string; size: number; bold: boolean; lvl: number };

type Shape = {
  kind: 'text' | 'table' | 'chart' | 'picture';
  /** What PowerPoint itself calls this box: title, body, ftr, sldNum, dt. */
  ph: string;
  x: number; y: number; w: number; h: number;
  paras: Para[];
  rows?: string[][];
  /** Column left edges in points, from the table's own grid. */
  colX?: number[];
  label?: string;
  /** Pictures — the relationship id of the image this box shows, which is how
   *  the file points at the bytes in ppt/media. */
  embed?: string;
  /** Charts — which of the three kinds this is, and what it is labelled. */
  chartKind?: 'object' | 'drawn' | 'picture';
  chartRel?: string;
  chartLabels?: string[];
  /** Tables — the header row's column spans, so a merged header survives. */
  colSpans?: number[];
};

type Slide = {
  n: number;
  hidden: boolean;
  layout: string;
  shapes: Shape[];
  /** Relationship id → part path, so a picture can find its own bytes. */
  rels: Map<string, string>;
};

type Deck = {
  slides: Slide[];
  width: number;
  height: number;
  accent?: string;
  logo?: string;
};

// ═══ XML helpers ═════════════════════════════════════════════════════════════
// Office files always use the a: and p: prefixes, but a parser that goes by
// local name cannot be broken by a file that does not.

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

/** The relationships namespace, where r:id and r:embed actually live. */
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** A part's relationships: id → the part it points at, as a full zip path. */
function readRels(xml: string | undefined, base: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!xml) return out;
  for (const r of tags(parse(xml), 'Relationship')) {
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target') ?? '';
    if (!id || !target || /^https?:/i.test(target)) continue;
    // Targets are relative to the part's own folder: "../media/image1.png"
    // from ppt/slides is ppt/media/image1.png.
    const parts = `${base}/${target}`.split('/');
    const stack: string[] = [];
    for (const p of parts) {
      if (p === '.' || p === '') continue;
      if (p === '..') stack.pop();
      else stack.push(p);
    }
    out.set(id, stack.join('/'));
  }
  return out;
}

/** Every descendant with this local name, in document order. */
function tags(root: Element | Document, name: string): Element[] {
  const out: Element[] = [];
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (child.localName === name) out.push(child);
      walk(child);
    }
  };
  const start = root instanceof Document ? root.documentElement : root;
  if (start) walk(start);
  return out;
}

/** The first descendant with this local name. */
const tag = (root: Element | Document, name: string): Element | undefined => tags(root, name)[0];

/** …but only inside this element, not inside a nested one of the same shape. */
function childTag(el: Element, name: string): Element | undefined {
  for (const child of Array.from(el.children)) if (child.localName === name) return child;
  return undefined;
}

const num = (v: string | null | undefined, fallback = 0) => {
  // A missing attribute must fall back, not read as zero. Number(null) is 0
  // and Number('') is 0, so the emptiness has to be checked before the parse —
  // otherwise an unstated slide size comes out as 0 and an unmerged table cell
  // comes out spanning nothing.
  if (v === null || v === undefined || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ═══ Pass 1 — unpack the deck ════════════════════════════════════════════════
// Every slide comes out as a list of boxes with what PowerPoint calls them,
// where they sit, and what they say. No guessing at any point: the file states
// all of it.

/** Slide paths in presentation order, which is not the order they are numbered
 *  in on disk. The order list points at relationship ids; the relationships
 *  point at the files. */
async function slideOrder(zip: Zip): Promise<string[]> {
  const pres = await zip.text('ppt/presentation.xml');
  const rels = await zip.text('ppt/_rels/presentation.xml.rels');
  if (!pres || !rels) return [];

  const byId = new Map<string, string>();
  for (const r of tags(parse(rels), 'Relationship')) {
    const target = r.getAttribute('Target') ?? '';
    byId.set(r.getAttribute('Id') ?? '', target.replace(/^\/?(ppt\/)?/, 'ppt/'));
  }
  return tags(parse(pres), 'sldId')
    .map(s => byId.get(s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
      ?? s.getAttribute('r:id') ?? ''))
    .filter((p): p is string => !!p && p.includes('slides/'));
}

/** The paragraphs inside a text body, each one a line of its own. */
function readParas(txBody: Element, ph: string): Para[] {
  const out: Para[] = [];
  for (const p of tags(txBody, 'p')) {
    const runs = tags(p, 'r');
    const text = runs.map(r => childTag(r, 't')?.textContent ?? '').join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const sizes = runs.map(r => num(childTag(r, 'rPr')?.getAttribute('sz'), 0)).filter(Boolean);
    const bold = runs.some(r => childTag(r, 'rPr')?.getAttribute('b') === '1');
    out.push({
      text,
      // PowerPoint stores point sizes times one hundred.
      size: sizes.length ? Math.max(...sizes) / 100 : (DEFAULT_SIZE[ph] ?? DEFAULT_SIZE['']),
      bold,
      lvl: num(childTag(p, 'pPr')?.getAttribute('lvl'), 0),
    });
  }
  return out;
}

/**
 * A group of boxes arranged to look like a chart. The consultant-deck habit:
 * rectangles sized to a value with a text box under each. The file never says
 * "chart", so this is a guess by arrangement — several boxes of the same kind
 * sharing a baseline or a left edge — and it is only ever a guess, which is
 * why it is flagged rather than filled.
 */
function looksHandDrawn(inner: Shape[]): boolean {
  if (inner.length < 4) return false;
  if (inner.some(s => s.kind === 'table' || s.kind === 'chart')) return false;
  // No box may carry a sentence: a chart is labels, not prose.
  if (inner.some(s => s.paras.some(p => p.text.split(/\s+/).length > 6))) return false;
  const round = (n: number) => Math.round(n / 12);
  const bottoms = new Map<number, number>();
  const lefts = new Map<number, number>();
  for (const s of inner) {
    bottoms.set(round(s.y + s.h), (bottoms.get(round(s.y + s.h)) ?? 0) + 1);
    lefts.set(round(s.x), (lefts.get(round(s.x)) ?? 0) + 1);
  }
  const aligned = Math.max(...bottoms.values(), ...lefts.values());
  return aligned >= 3;
}

function readShapes(spTree: Element): Shape[] {
  const shapes: Shape[] = [];

  const frameOf = (el: Element) => {
    const off = tag(el, 'off');
    const ext = tag(el, 'ext');
    return {
      x: pt(num(off?.getAttribute('x'))),
      y: pt(num(off?.getAttribute('y'))),
      w: pt(num(ext?.getAttribute('cx'))),
      h: pt(num(ext?.getAttribute('cy'))),
    };
  };

  for (const el of Array.from(spTree.children)) {
    if (el.localName === 'sp') {
      const ph = tag(el, 'ph')?.getAttribute('type') ?? (tag(el, 'ph') ? 'body' : '');
      const txBody = childTag(el, 'txBody');
      const paras = txBody ? readParas(txBody, ph) : [];
      if (paras.length === 0) continue;                    // an empty box says nothing
      shapes.push({ kind: 'text', ph, ...frameOf(el), paras });
      continue;
    }

    if (el.localName === 'graphicFrame') {
      const frame = frameOf(el);
      const tbl = tag(el, 'tbl');
      if (tbl) {
        // A real table with real columns. No lining-up geometry needed: the
        // file says which cell is in which column.
        const widths = tags(tbl, 'gridCol').map(c => pt(num(c.getAttribute('w'))));
        const colX: number[] = [];
        let running = frame.x;
        for (const w of widths) { colX.push(running); running += w; }
        const trs = tags(tbl, 'tr');
        const rows = trs.map(tr =>
          tags(tr, 'tc').map(tc => {
            const body = childTag(tc, 'txBody');
            return body ? readParas(body, '').map(p => p.text).join(' ').trim() : '';
          }));
        // The merge pattern is part of the table's shape, so it survives; the
        // values inside every cell do not.
        const colSpans = trs.length
          ? tags(trs[0], 'tc').map(tc => num(tc.getAttribute('gridSpan'), 1))
          : undefined;
        if (rows.length) shapes.push({ kind: 'table', ph: '', ...frame, paras: [], rows, colX, colSpans });
        continue;
      }
      const uri = tag(el, 'graphicData')?.getAttribute('uri') ?? '';
      if (/chart/i.test(uri)) {
        const ref = tag(el, 'chart');
        shapes.push({
          kind: 'chart', ph: '', ...frame, paras: [],
          chartKind: 'object',
          chartRel: ref?.getAttributeNS(REL_NS, 'id') ?? ref?.getAttribute('r:id') ?? undefined,
          label: tag(el, 'cNvPr')?.getAttribute('name') ?? 'Chart',
        });
      }
      continue;
    }

    if (el.localName === 'pic') {
      const blip = tag(el, 'blip');
      shapes.push({
        kind: 'picture', ph: '', ...frameOf(el), paras: [],
        embed: blip?.getAttributeNS(REL_NS, 'embed') ?? blip?.getAttribute('r:embed') ?? undefined,
        label: tag(el, 'cNvPr')?.getAttribute('name') ?? undefined,
      });
      continue;
    }

    // A group box holds its own shapes. A consultant deck's habit is to draw a
    // bar chart out of rectangles and text boxes and group them, and the file
    // then says only "group of shapes" — so a group that is mostly plain boxes
    // laid out in a row is read as a chart we had to guess at, and the client
    // says what it is at review. Anything else is flattened.
    if (el.localName === 'grpSp') {
      const inner = readShapes(el);
      const drawn = looksHandDrawn(inner);
      if (drawn) {
        const frame = frameOf(el);
        shapes.push({
          kind: 'chart', ph: '', ...frame, paras: [],
          chartKind: 'drawn',
          chartLabels: inner.flatMap(sh => sh.paras.map(p => p.text)).filter(t => t.length <= 40).slice(0, 12),
          label: tag(el, 'cNvPr')?.getAttribute('name') ?? 'Chart',
        });
        continue;
      }
      shapes.push(...inner);
    }
  }

  return shapes.sort((a, b) => (Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x));
}

/**
 * A real chart object declares its own labels, so we read them and throw the
 * numbers away. "High / Medium / Low" is a chart of severity counts, which we
 * can produce; "Revenue" is money, which we cannot. The template stores what
 * the chart IS, never what it said.
 */
async function readChartLabels(zip: Zip, path: string): Promise<string[]> {
  const xml = await zip.text(path);
  if (!xml) return [];
  const doc = parse(xml);
  const out: string[] = [];
  // Category labels first — a pie's slice names — then the series names.
  for (const cat of tags(doc, 'cat')) {
    for (const v of tags(cat, 'v')) {
      const t = (v.textContent ?? '').trim();
      if (t && !/^-?[\d,.]+$/.test(t) && !out.includes(t)) out.push(t);
    }
  }
  for (const tx of tags(doc, 'tx')) {
    for (const v of tags(tx, 'v')) {
      const t = (v.textContent ?? '').trim();
      if (t && !/^-?[\d,.]+$/.test(t) && !out.includes(t)) out.push(t);
    }
  }
  const title = tag(doc, 'title');
  if (title) {
    for (const v of tags(title, 't')) {
      const t = (v.textContent ?? '').trim();
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, 12);
}

async function unpackDeck(zip: Zip): Promise<Deck> {
  const paths = await slideOrder(zip);
  const slides: Slide[] = [];

  for (let i = 0; i < paths.length && slides.length < PAGE_CAP + 1; i++) {
    const xml = await zip.text(paths[i]);
    if (!xml) continue;
    const doc = parse(xml);
    const spTree = tag(doc, 'spTree');
    if (!spTree) continue;

    // Which layout the slide inherits from. Slides built from the same layout
    // are the same kind of slide, which is the strongest repeat clue a deck
    // gives us.
    const relsXml = await zip.text(paths[i].replace(/slides\/([^/]+)$/, 'slides/_rels/$1.rels'));
    const rels = readRels(relsXml, 'ppt/slides');
    const layout = [...rels.values()].find(t => t.includes('slideLayout')) ?? '';

    const shapes = readShapes(spTree);
    // A real chart object points at its own part, which holds the labels.
    for (const shape of shapes) {
      if (shape.chartKind !== 'object' || !shape.chartRel) continue;
      const target = rels.get(shape.chartRel);
      if (target) shape.chartLabels = await readChartLabels(zip, target);
    }

    slides.push({
      n: slides.length + 1,
      // A hidden slide was deliberately taken out of the deck, so it is not
      // part of the format either.
      hidden: doc.documentElement?.getAttribute('show') === '0',
      layout: layout.split('/').pop() ?? '',
      shapes,
      rels,
    });
  }

  const pres = await zip.text('ppt/presentation.xml');
  const size = pres ? tag(parse(pres), 'sldSz') : undefined;

  // The slide master is the design layer every slide inherits from, so the
  // brand colour is handed over whole instead of being sampled off a picture
  // the way it has to be in a PDF.
  let accent: string | undefined;
  const themeName = zip.names.find(n => /^ppt\/theme\/theme\d+\.xml$/.test(n));
  const theme = themeName ? await zip.text(themeName) : undefined;
  if (theme) {
    const scheme = tag(parse(theme), 'clrScheme');
    const pick = (name: string) => {
      const el = scheme ? childTag(scheme, name) : undefined;
      const hex = el ? tag(el, 'srgbClr')?.getAttribute('val') : undefined;
      return hex ? `#${hex.toLowerCase()}` : undefined;
    };
    accent = pick('accent1') ?? pick('dk2');
  }

  const width = pt(num(size?.getAttribute('cx'), 12192000));
  const height = pt(num(size?.getAttribute('cy'), 6858000));

  return { slides, width, height, accent, logo: await findLogo(zip, slides, width, height) };
}

// ─── The logo ───────────────────────────────────────────────────────────────
// Same rule as the running header, because it is the same kind of thing: the
// mark that appears in the same corner slide after slide is the brand, and a
// picture used once is an illustration. The slide master is asked first, since
// a deck that puts its logo there has already answered the question.

/** How big a picture may be before it stops being a mark and starts being a
 *  background. Half the slide either way is generous and still excludes the
 *  full-bleed cover images decks open on. */
const LOGO_MAX_SHARE = 0.5;
/** A mark that would bloat every template it is saved into is not worth it. */
const LOGO_MAX_BYTES = 512 * 1024;

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
};

async function toDataUrl(zip: Zip, path: string): Promise<string | undefined> {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  const mime = MIME[ext];
  if (!mime) return undefined;                          // emf/wmf will not render
  const bytes = await zip.bytes(path);
  if (!bytes || bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return undefined;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function findLogo(zip: Zip, slides: Slide[], width: number, height: number): Promise<string | undefined> {
  const live = slides.filter(s => !s.hidden);
  const smallEnough = (s: Shape) => s.w > 0 && s.h > 0
    && s.w <= width * LOGO_MAX_SHARE && s.h <= height * LOGO_MAX_SHARE;

  // The master is the design layer every slide inherits from, so a picture
  // sitting on it is by definition on every slide.
  const masterName = zip.names.find(n => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(n));
  if (masterName) {
    const xml = await zip.text(masterName);
    const spTree = xml ? tag(parse(xml), 'spTree') : undefined;
    if (spTree) {
      const rels = readRels(
        await zip.text(masterName.replace(/slideMasters\/([^/]+)$/, 'slideMasters/_rels/$1.rels')),
        'ppt/slideMasters',
      );
      for (const pic of readShapes(spTree).filter(s => s.kind === 'picture' && smallEnough(s))) {
        const target = pic.embed ? rels.get(pic.embed) : undefined;
        const url = target ? await toDataUrl(zip, target) : undefined;
        if (url) return url;
      }
    }
  }

  // Otherwise the repetition rule: the same image, in the same place, on three
  // or more slides. One picture used once is a diagram, not a brand.
  const seen = new Map<string, { slides: Set<number>; path: string; area: number }>();
  for (const slide of live) {
    for (const pic of slide.shapes) {
      if (pic.kind !== 'picture' || !pic.embed || !smallEnough(pic)) continue;
      const path = slide.rels.get(pic.embed);
      if (!path) continue;
      const key = `${path}|${Math.round(pic.x / 24)}|${Math.round(pic.y / 24)}`;
      const cur = seen.get(key) ?? { slides: new Set<number>(), path, area: pic.w * pic.h };
      cur.slides.add(slide.n);
      seen.set(key, cur);
    }
  }
  const repeated = [...seen.values()]
    .filter(v => v.slides.size >= Math.min(REPEAT_PAGES, live.length))
    .sort((a, b) => b.slides.size - a.slides.size || a.area - b.area);
  for (const hit of repeated) {
    const url = await toDataUrl(zip, hit.path);
    if (url) return url;
  }

  // Last resort: a small picture on the title slide. A cover mark is a brand
  // often enough to offer, and the review screen is where it gets confirmed.
  const cover = live[0];
  for (const pic of cover?.shapes.filter(s => s.kind === 'picture' && smallEnough(s)) ?? []) {
    const path = pic.embed ? cover.rels.get(pic.embed) : undefined;
    const url = path ? await toDataUrl(zip, path) : undefined;
    if (url) return url;
  }
  return undefined;
}

// ═══ Pass 2 — the furniture, by repetition ═══════════════════════════════════
// The rule that outranks the labels. A box carrying the same words in the same
// place on slide after slide is a running header, whatever PowerPoint calls it,
// so it is lifted out and kept as a setting. The heading is then whichever box
// is left.

type DeckFurniture = { furniture: ReadFurniture | null; struck: Set<string> };

/** What makes two boxes "the same box in the same place": the same words with
 *  the digits masked, at roughly the same height on the slide. A picture has no
 *  words, so it is the same picture in the same place — which is exactly how
 *  the brand mark is told from an illustration. */
const shapeSlot = (s: Shape) =>
  s.kind === 'picture'
    ? `pic:${s.embed ?? ''}|${Math.round(s.y / 24)}|${Math.round(s.x / 24)}`
    : `${Math.round(s.y / 24)}|${norm(s.paras.map(p => p.text).join(' ').replace(/\d+/g, '#'))}`;

function deckFurniture(deck: Deck): DeckFurniture {
  const live = deck.slides.filter(s => !s.hidden);
  const seen = new Map<string, { slides: Set<number>; text: string; y: number }>();

  // The brand mark is furniture in exactly the same sense the running header
  // is: the same picture in the same corner slide after slide. Leaving it in
  // makes a divider slide look like it carries content, and the run it was
  // introducing then loses its name.
  const picSeen = new Map<string, Set<number>>();
  for (const slide of live) {
    for (const shape of slide.shapes) {
      if (shape.kind !== 'picture' || !shape.embed) continue;
      const key = shapeSlot(shape);
      (picSeen.get(key) ?? picSeen.set(key, new Set()).get(key)!).add(slide.n);
    }
  }

  for (const slide of live) {
    for (const shape of slide.shapes) {
      if (shape.kind !== 'text') continue;
      // A wall of prose that happens to be reused is still content. Furniture
      // is short by nature: a name, a stamp, a page number.
      const text = shape.paras.map(p => p.text).join(' ');
      if (!text || text.length > 120 || shape.paras.length > 2) continue;
      // …but never one or two characters. A single letter in a corner is how
      // consultant decks print the RATING (H, M, L), and three slides rated
      // Medium is not a running header — striking it loses the rating and,
      // with it, the repeat that makes those slides one card.
      if (text.replace(/[^A-Za-z0-9]/g, '').length <= 2) continue;
      const key = shapeSlot(shape);
      if (!key.split('|')[1]) continue;
      const cur = seen.get(key) ?? { slides: new Set<number>(), text, y: shape.y };
      cur.slides.add(slide.n);
      seen.set(key, cur);
    }
  }

  const header: string[] = [];
  const footer: string[] = [];
  const struck = new Set<string>();
  let pageNumberPattern: string | undefined;

  const threshold = Math.max(REPEAT_PAGES, Math.ceil(live.length * REPEAT_SHARE));
  for (const [key, v] of seen) {
    // The placeholders PowerPoint reserves for furniture are furniture at
    // once; everything else has to earn it by repeating.
    if (v.slides.size < Math.min(threshold, REPEAT_PAGES)) continue;
    // FURNITURE RECURS THROUGHOUT THE DECK. A box saying the same thing on a
    // run of NEIGHBOURING slides and nowhere else is one part running across
    // them — a finding whose title is printed again on each of its four slides.
    // Strike that and the finding loses its name, its slides stop being one
    // finding, and each of them comes back as a part nobody can place.
    const pages = [...v.slides];
    const consecutive = Math.max(...pages) - Math.min(...pages) + 1 === v.slides.size;
    if (consecutive && v.slides.size < threshold) continue;
    struck.add(key);
    if (/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(v.text.trim())) {
      pageNumberPattern = /of|\//i.test(v.text) ? 'Page N of M' : 'N';
      continue;
    }
    (v.y < deck.height * 0.5 ? header : footer).push(v.text.trim());
  }

  // The footer line, the slide number and the date come off the master and are
  // furniture by definition, never by repetition.
  for (const slide of live) {
    for (const shape of slide.shapes) {
      if (!['ftr', 'sldNum', 'dt'].includes(shape.ph)) continue;
      struck.add(shapeSlot(shape));
      const text = shape.paras.map(p => p.text).join(' ').trim();
      if (!text) continue;
      if (shape.ph === 'sldNum') { pageNumberPattern ??= 'N'; continue; }
      if (!footer.includes(text) && !header.includes(text)) footer.push(text);
    }
  }

  for (const [key, slides] of picSeen) {
    if (slides.size >= Math.min(threshold, REPEAT_PAGES)) struck.add(key);
  }

  const all = [...header, ...footer];
  const confidentiality = all.map(t => t.match(CONFIDENTIAL)?.[0]).find(Boolean);
  return {
    furniture: all.length || pageNumberPattern
      ? { header, footer, pageNumberPattern, confidentiality, fields: {} }
      : null,
    struck,
  };
}

// ═══ Pass 3 — the tree ═══════════════════════════════════════════════════════
// One slide is one part, or one stamp of a repeating card. Grouping comes from
// the divider slides.

/** The boxes that survived the furniture pass, in reading order. */
const liveShapes = (slide: Slide, struck: Set<string>) =>
  slide.shapes.filter(s => !struck.has(shapeSlot(s)));

/** The slide's real heading: its title box if that box survived, otherwise the
 *  next box down. This is the repetition rule outranking the label. */
function headingOf(shapes: Shape[]): { text: string; explicit: boolean } | undefined {
  const titled = shapes.find(s => s.kind === 'text' && /title/i.test(s.ph));
  if (titled?.paras.length) return { text: titled.paras[0].text, explicit: true };

  for (const s of shapes) {
    if (s.kind !== 'text' || !s.paras.length) continue;
    const first = s.paras[0];
    const words = first.text.split(/\s+/).length;
    if (words > 14 || first.text.length > 110) continue;
    if (/[.;,]$/.test(first.text)) continue;
    return { text: first.text, explicit: false };
  }
  return undefined;
}

/** A box's paragraphs become lines, keeping their real positions so the block
 *  classifier reads a deck exactly the way it reads a page. */
function shapeToLines(shape: Shape, page: number, skipFirstPara: boolean): Line[] {
  if (shape.kind === 'table' && shape.rows) {
    return shape.rows.map((row, ri) => {
      // Empty cells KEEP their place. A merged header leaves the cell under it
      // blank, and dropping blanks shifts every column left so the rows stop
      // lining up and the table stops reading as a table at all.
      const cells = row.map((text, ci) => ({
        text: text.trim(),
        x: shape.colX?.[ci] ?? shape.x + ci * 60,
        right: (shape.colX?.[ci + 1] ?? shape.x + shape.w) - 4,
      }));
      return {
        text: cells.map(c => c.text).join('  '),
        cells,
        x: shape.x,
        y: shape.y + ri * 14,
        size: 12,
        bold: ri === 0,
        page,
        // The file states the header's merges, so pass 4 does not have to work
        // them out from where the text sits.
        ...(ri === 0 && shape.colSpans?.some(n => n > 1) ? { spans: shape.colSpans } : {}),
      };
    }).filter(l => l.cells.some(c => c.text));
  }

  const paras = skipFirstPara ? shape.paras.slice(1) : shape.paras;
  return paras.map((p, pi) => ({
    text: p.text,
    cells: [{ text: p.text, x: shape.x + p.lvl * 12, right: shape.x + shape.w }],
    x: shape.x + p.lvl * 12,
    y: shape.y + (skipFirstPara ? pi + 1 : pi) * (p.size * 1.35),
    size: p.size,
    bold: p.bold,
    page,
  }));
}

/** A slide with one short line on it and nothing else is naming the run of
 *  slides that follows, not saying anything itself. */
function isDivider(shapes: Shape[]): boolean {
  // "Nothing else on it" means nothing at all — not a table, not a chart, and
  // not a picture either. A slide with a title and a pasted image is a real
  // part of the report, and reading it as a divider swallows every slide after
  // it into a section that was never there.
  if (shapes.some(s => s.kind !== 'text')) return false;
  const text = shapes.filter(s => s.kind === 'text');
  if (text.length !== 1) return false;
  const paras = text[0].paras;
  return paras.length === 1 && paras[0].text.split(/\s+/).length <= 10;
}

/** The signature a slide is matched on when looking for repeats. Text is
 *  deliberately excluded: two finding slides say different things and are still
 *  the same stamp. */
const slideSignature = (slide: Slide, shapes: Shape[]) =>
  `${slide.layout}#${shapes.map(s => `${s.kind}:${s.ph}:${Math.round(s.x / 36)}:${Math.round(s.y / 36)}`).join('|')}`;

function buildDeckTree(deck: Deck, struck: Set<string>): { tree: Tree; closing?: { lines: string[] } } {
  const live = deck.slides.filter(s => !s.hidden);
  const shapesOf = new Map<number, Shape[]>();
  for (const s of live) shapesOf.set(s.n, liveShapes(s, struck));

  const cover: Line[] = [];
  let closing: { lines: string[] } | undefined;
  let docEntries = 0;

  // Slides become units, and the shared deck rules take it from there. What
  // only PowerPoint can answer is answered here: which box is the title, which
  // layout the slide uses, and which slides are not parts of the report.
  const units: DeckUnit[] = [];
  live.forEach((slide, idx) => {
    const shapes = shapesOf.get(slide.n) ?? [];
    const heading = headingOf(shapes);
    const flat = shapes.flatMap(s => s.paras.map(p => p.text));

    // The cover comes from the master and the file's own details, not from the
    // opening slide's wording, so slide one is read as a letterhead.
    if (idx === 0) {
      cover.push(...shapes.flatMap(s => shapeToLines(s, slide.n, false)));
      return;
    }

    // A closing page carries a sign-off line and the brand and NOTHING else.
    // A table, a chart or a picture on the last slide means it is a real part
    // of the report — an appendix of sources reads as two text boxes too, and
    // swallowing it as a closing page loses the whole section.
    const isLast = idx === live.length - 1;
    const words = flat.join(' ').split(/\s+/).filter(Boolean).length;
    const onlyText = shapes.every(sh => sh.kind === 'text');
    if (isLast && onlyText && flat.length <= 3 && words <= 14
      && (CLOSING.test(flat.join(' ')) || flat.length <= 2)) {
      closing = { lines: flat };
      return;
    }

    // Their own agenda slide is never copied. Our export engine builds a
    // contents page of its own; this one is read only as the sanity check.
    if (heading && (AGENDA.test(heading.text.trim()) || CONTENTS.test(heading.text.trim()))) {
      docEntries += Math.max(0, flat.length - 1);
      return;
    }

    // The heading's own box is dropped from the body: it is the part's name,
    // not one of the part's blocks.
    const lines: Line[] = [];
    shapes.forEach((shape, si) => {
      const isHeadingBox = !!heading && shape.paras[0]?.text === heading.text;
      if (isHeadingBox && si === 0) return;
      lines.push(...shapeToLines(shape, slide.n, isHeadingBox));
    });

    units.push({
      n: slide.n,
      heading,
      lines,
      signature: slideSignature(slide, shapes),
      divider: isDivider(shapes),
    });
  });

  return { tree: buildDeckTree_(units, cover, docEntries), closing };
}

// ═══ Passes 4 and 5 for a deck ═══════════════════════════════════════════════
// The block classifier is shared with the PDF path unchanged. Only the folding
// of a repeating run is different, because a deck's repeat spans whole slides
// and the PDF path's repeat spans blocks.

function classifyDeckSlide(section: SpineSection, bodySize: number): RawBlock[] {
  // Charts belong to the part they sit on. They are recorded so the review
  // screen can say we saw them, and the detectors decide whether we can fill
  // them from their labels.
  const charts = (section.charts ?? []).map<RawBlock>(c => ({
    kind: 'chart',
    label: c.label,
    chartKind: c.kind,
    chartLabels: c.labels.length ? c.labels : undefined,
    // A real chart object stated its labels. A hand-drawn one was guessed at
    // from how its boxes sit, and a pasted picture says nothing at all, so
    // neither is ever as sure as the file's own answer.
    confidence: c.kind === 'object' ? 0.85 : c.kind === 'drawn' ? 0.5 : 0.4,
    page: section.page,
    lines: c.labels,
  }));
  return [...classifyStamped(section, bodySize), ...charts];
}

// ═══ Slide previews ══════════════════════════════════════════════════════════
// The review screen puts what we found beside the slide it came from. A deck
// carries no picture of itself, so each slide is redrawn from the boxes we
// read: same positions, same sizes, same words. It is a picture of what the
// reader saw, which is exactly what the reviewer needs to check.

function renderSlide(slide: Slide, deck: Deck, accent: string): string | undefined {
  const canvas = document.createElement('canvas');
  const scale = SNAPSHOT_WIDTH / deck.width;
  canvas.width = Math.round(deck.width * scale);
  canvas.height = Math.round(deck.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';

  const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));

  for (const shape of slide.shapes) {
    const x = clamp(shape.x * scale, canvas.width);
    const y = clamp(shape.y * scale, canvas.height);
    const w = Math.max(4, shape.w * scale);

    if (shape.kind === 'picture' || shape.kind === 'chart') {
      ctx.fillStyle = shape.kind === 'chart' ? '#eceafd' : '#f1f0f5';
      ctx.fillRect(x, y, w, Math.max(4, shape.h * scale));
      continue;
    }

    if (shape.kind === 'table' && shape.rows) {
      const rowH = Math.max(7, (shape.h * scale) / Math.max(shape.rows.length, 1));
      shape.rows.forEach((row, ri) => {
        const ry = y + ri * rowH;
        ctx.fillStyle = ri === 0 ? '#e9e7f4' : '#ffffff';
        ctx.fillRect(x, ry, w, rowH);
        ctx.strokeStyle = '#d9d7e6';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, ry, w, rowH);
        ctx.fillStyle = '#3c3a52';
        ctx.font = `${ri === 0 ? '600 ' : ''}${Math.max(5, rowH * 0.5)}px Inter, system-ui, sans-serif`;
        row.forEach((cell, ci) => {
          const cx = (shape.colX?.[ci] ?? shape.x + (ci * shape.w) / Math.max(row.length, 1)) * scale;
          ctx.fillText(cell.slice(0, 26), cx + 2, ry + rowH * 0.24, Math.max(10, w / row.length - 4));
        });
      });
      continue;
    }

    let cursor = y;
    for (const p of shape.paras) {
      const size = Math.max(5, p.size * scale);
      const title = /title/i.test(shape.ph);
      ctx.fillStyle = title ? accent : '#3c3a52';
      ctx.font = `${p.bold || title ? '600 ' : ''}${size}px Inter, system-ui, sans-serif`;
      // One paragraph, wrapped to the box it lives in, so a long bullet reads
      // as a long bullet instead of running off the slide.
      const words = p.text.split(/\s+/);
      let line = '';
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > w && line) {
          ctx.fillText(line, x + p.lvl * 12 * scale, cursor);
          cursor += size * 1.25;
          line = word;
        } else line = next;
        if (cursor > canvas.height) break;
      }
      if (line && cursor <= canvas.height) ctx.fillText(line, x + p.lvl * 12 * scale, cursor);
      cursor += size * 1.45;
    }
  }

  return canvas.toDataURL('image/jpeg', 0.72);
}

// ═══ The deck entry point ════════════════════════════════════════════════════

export async function readTemplateFromDeck(file: File): Promise<ReadOutcome> {
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too-large' };

  let zip: Zip;
  try {
    zip = await openZip(await file.arrayBuffer());
  } catch {
    // A .ppt from before 2007 is a different file format that is not a zip at
    // all, so the message has to be different too.
    return { ok: false, reason: /\.ppt$/i.test(file.name) ? 'legacy-ppt' : 'unreadable' };
  }

  // A password protected Office file is an encrypted container with the real
  // document inside it, so the parts we need simply are not there.
  if (!zip.has('ppt/presentation.xml')) {
    return { ok: false, reason: zip.has('EncryptedPackage') ? 'password' : 'unreadable' };
  }

  try {
    const deck = await unpackDeck(zip);
    const live = deck.slides.filter(s => !s.hidden);
    if (live.length === 0) return { ok: false, reason: 'empty-deck' };
    if (live.length > PAGE_CAP) return { ok: false, reason: 'too-long', pageCount: live.length };
    // Every slide a picture means there is nothing to read, the same way a
    // scanned PDF has nothing to read. Said honestly either way.
    if (!live.some(s => s.shapes.some(sh => sh.kind === 'text' || sh.kind === 'table'))) {
      return { ok: false, reason: 'empty-deck', pageCount: live.length };
    }

    const { furniture, struck } = deckFurniture(deck);
    const { tree, closing } = buildDeckTree(deck, struck);

    // Charts belong to the part they sit on, and are recorded so the review
    // screen can say we saw them and left them out.
    // Charts belong to the part they sit on. All three kinds are recorded, so
    // the review screen can say we saw them whether or not we can fill them.
    // A picture that is not the brand mark is at most a picture spot: no
    // labels, no data, and never guessed at.
    const chartsBySlide = new Map<number, NonNullable<SpineSection['charts']>>();
    for (const slide of live) {
      const found: NonNullable<SpineSection['charts']> = [];
      for (const sh of slide.shapes) {
        if (sh.kind === 'chart') {
          found.push({ kind: sh.chartKind ?? 'object', label: sh.label, labels: sh.chartLabels ?? [] });
        } else if (sh.kind === 'picture' && sh.w * sh.h > deck.width * deck.height * 0.06) {
          found.push({ kind: 'picture', label: sh.label, labels: [] });
        }
      }
      if (found.length) chartsBySlide.set(slide.n, found);
    }
    for (const section of tree.spine) {
      const pages = new Set(section.lines.map(l => l.page));
      const found = [...pages].flatMap(p => chartsBySlide.get(p) ?? []);
      if (found.length) section.charts = found;
    }

    const body = live.map(slide => liveShapes(slide, struck).flatMap(s => shapeToLines(s, slide.n, false)));
    const bodySize = median(body.flat().map(l => l.size).filter(Boolean));

    const accent = deck.accent ?? '#4c3ac9';
    const snapshots = live.slice(0, SNAPSHOT_MAX)
      .map(s => renderSlide(s, deck, accent))
      .filter((s): s is string => !!s);

    const result = assemble({
      tree,
      furniture,
      body,
      bodySize,
      pageCount: live.length,
      snapshots,
      coverColor: deck.accent,
      classify: s => classifyDeckSlide(s, bodySize),
      closing,
      logo: deck.logo,
    });

    return { ok: true, result: { ...result, unit: 'slide' } };
  } catch (err) {
    // Same reason as the PDF reader: the invariant throw has to be readable by
    // whoever has to fix the check that broke it.
    console.error('[byot] deck read failed', err);
    return { ok: false, reason: 'unreadable' };
  }
}
