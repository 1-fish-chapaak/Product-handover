// ─── Deck rules ─────────────────────────────────────────────────────────────
//
// THE FILE'S ENDING PICKS THE READER. THE DOCUMENT'S SHAPE PICKS THE RULES.
//
// A .pptx goes to the PowerPoint reader and a .pdf to the PDF reader, but a
// consultant report is very often a deck the client saved to PDF before
// uploading. Its labels are burnt away, so it has to go through the PDF reader
// — and if that reader then looks for numbered headings and stitched
// paragraphs, it finds none of either and extracts nothing at all.
//
// So the rules live here, once, applied to whichever reader saw a deck:
//
//   · one unit is one part, or one stamp of a repeating card
//   · a divider unit names the run that follows it, and is not content itself
//   · the section name repeated at the top of its own pages is furniture
//   · a run of units repeats once per audit, so repeat-spotting looks across
//     sequences and not just inside one unit
//
// A "unit" is a slide or a page. Whoever calls in has already answered the two
// questions only they can answer — what the unit's heading is, and what shape
// it has — so everything below is the same for both.

import {
  norm, median, titleCaseIfCaps, WRAPPER, SECTION_CAP,
  type Line, type SpineSection, type Tree,
} from './byotEngine';

export type DeckUnit = {
  /** Slide or page number, 1-based, in reading order. */
  n: number;
  /** What this unit is called, and whether the file said so outright. A deck
   *  saved to PDF never says so, which is why the flag matters. */
  heading?: { text: string; explicit: boolean };
  /** Everything under the heading. The heading's own line is not in here. */
  lines: Line[];
  /** The unit's shape, with its words deliberately left out: two finding
   *  slides say different things and are still the same stamp. */
  signature: string;
  /** One short line and nothing else: this unit names the run that follows. */
  divider: boolean;
  /** Not a part of the report: the cover, their contents page, the closing
   *  page. Each is handled by the caller and skipped here. */
  skip?: boolean;
};

/** Longest useful stamp. A snapshot unit plus its findings is three or four;
 *  past that a "repeat" is really the whole deck saying the same thing twice. */
const MAX_STAMP_SPAN = 4;

/**
 * A CARD'S FIELD LABEL, WEARING A SLIDE. Some decks give every box of a finding
 * its own slide: the finding's title, then "Observation:", then "Root Cause",
 * then "Findings", and the whole run again for the next finding. Read one slide
 * at a time, each of those is a part nobody can name, and one deck came back as
 * thirty separate drops.
 *
 * They are blocks of one multi-slide stamp, and the tell is that the same label
 * titles recur in the same order. Plurals count here, unlike in a written
 * report: on a slide "Observations" is the box's name, not a section of the
 * document.
 */
const FIELD_LABEL_SLIDE = /^(observations?|findings?|exceptions?|issues?|root causes?|causes?|risks?|implications?|impacts?|recommendations?|management (response|comment)s?|action plans?|agreed actions?|responsibilit(y|ies)|background|criteria|status|process|sub[\s-]?process)\b[:\s]*$/i;

/** How often a label has to come round before it reads as a box rather than a
 *  part. Once is a section; twice is the format repeating. */
const FIELD_LABEL_REPEATS = 2;

/**
 * Field-labelled slides folded into the finding they belong to, before anything
 * looks for repeats. Each becomes a labelled block, so the finding is one unit
 * again and the run of findings is one stamp.
 */
export function foldFieldLabelSlides(units: DeckUnit[]): DeckUnit[] {
  const uses = new Map<string, number>();
  for (const u of units) {
    const name = u.heading?.text.trim();
    if (name && FIELD_LABEL_SLIDE.test(name)) uses.set(norm(name), (uses.get(norm(name)) ?? 0) + 1);
  }
  const recurring = (name: string) => (uses.get(norm(name)) ?? 0) >= FIELD_LABEL_REPEATS;

  const out: DeckUnit[] = [];
  /** The boxes each finding has collected, in the order they were printed. */
  const fields = new Map<DeckUnit, string[]>();
  for (const unit of units) {
    const name = unit.heading?.text.trim();
    const previous = out[out.length - 1];
    if (unit.skip || !name || !previous || previous.skip
      || !FIELD_LABEL_SLIDE.test(name) || !recurring(name)) {
      out.push(unit);
      continue;
    }
    const label = titleCaseIfCaps(name.replace(/[\s:]+$/, ''));
    previous.lines.push({
      text: `§§${label}`,
      cells: [{ text: label, x: 0, right: 0 }],
      x: 0, y: 0, size: 0, bold: true, page: unit.n,
    });
    previous.lines.push(...unit.lines);
    // ITS BOXES ARE ITS SHAPE. Once a finding is a run of labelled boxes, the
    // labels in order are what makes two findings the same stamp — not the
    // contents of the boxes, which differ by definition. One finding's
    // observation is a table and the next one's is a paragraph, and they are
    // still the same part of the same format.
    fields.set(previous, [...(fields.get(previous) ?? []), label.toLowerCase()]);
    previous.signature = `fields:${fields.get(previous)!.join('|')}`;
  }
  return out;
}

export type Run = { start: number; span: number; reps: number };

/**
 * Repeat-spotting across SEQUENCES, not just inside one unit. A run of `span`
 * units repeating `reps` times is one stamp: the shape is saved once and the
 * count goes with it, never the content.
 */
export function findStamps(sigs: string[]): Run[] {
  const runs: Run[] = [];
  let i = 0;
  while (i < sigs.length) {
    let best: Run | null = null;
    for (let span = 1; span <= MAX_STAMP_SPAN && i + span * 2 <= sigs.length; span++) {
      let reps = 1;
      while (
        i + (reps + 1) * span <= sigs.length &&
        sigs.slice(i + reps * span, i + (reps + 1) * span).join('~') === sigs.slice(i, i + span).join('~')
      ) reps++;
      // Coverage decides, so a snapshot-plus-findings run beats the single
      // unit inside it. On a tie the shorter span wins: one unit is one card
      // is the common truth, and the simpler reading is the safer one.
      if (reps >= 2 && (!best || span * reps > best.span * best.reps)) best = { start: i, span, reps };
    }
    if (best) { runs.push(best); i += best.span * best.reps; continue; }
    i++;
  }
  return runs;
}

/**
 * What a stamp's headings have in common, which is the only part of them that
 * belongs to the format. "Procurement · snapshot", "Payroll · snapshot" and
 * "Treasury · snapshot" share "snapshot"; the rest names one audit area and
 * would be this upload's content sitting in a template that must hold none.
 *
 * Undefined when they share nothing, and the caller falls back rather than
 * inventing a name.
 */
export function sharedName(names: string[]): string | undefined {
  const clean = names.map(n => n.trim()).filter(Boolean);
  if (clean.length === 0) return undefined;
  if (clean.length === 1) return clean[0];
  if (clean.every(n => norm(n) === norm(clean[0]))) return clean[0];

  const words = clean.map(n => n.split(/\s+/));
  const common = words[0].filter(w =>
    // A separator or a reference number is not a word they have in common in
    // any useful sense, so neither can carry the name on its own.
    /[a-z]/i.test(w) && w.replace(/\W/g, '').length > 2 &&
    words.every(ws => ws.some(x => norm(x) === norm(w))));
  if (common.length === 0) return undefined;
  // Assembled from their words but not written by them, so the capital at the
  // front is ours to add: a heading reading "snapshot" looks broken.
  const joined = titleCaseIfCaps(common.join(' ')).replace(/^[\W_]+|[\W_]+$/g, '');
  return joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : undefined;
}

/**
 * The walk. Dividers open groups, the units under them become labelled blocks
 * inside those groups, and a repeating run always becomes a section of its own
 * because the stamp has to have one home for the findings to print into.
 */
export function buildDeckTree(units: DeckUnit[], cover: Line[], docEntries: number): Tree {
  // Boxes-as-slides are folded back into their finding first, so repeat-spotting
  // sees one unit per finding instead of one per box.
  const content = foldFieldLabelSlides(units.filter(u => !u.skip));
  const skipped: string[] = [];

  const stampAt = new Map<number, Run>();
  for (const run of findStamps(content.map(u => u.signature))) stampAt.set(run.start, run);

  const spine: SpineSection[] = [];
  let group: SpineSection | null = null;

  const openSection = (name: string, page: number, explicit: boolean, wrapper: boolean): SpineSection => {
    const section: SpineSection = {
      name: titleCaseIfCaps(name.trim()),
      level: 1,
      page,
      evidence: explicit ? 'explicit' : 'inferred',
      // PowerPoint said which box is the title, so an explicit heading is not
      // a guess the way the biggest line on a printed page is.
      confidence: explicit ? 0.95 : 0.7,
      appendix: false,
      wrapper,
      lines: [],
    };
    spine.push(section);
    return section;
  };

  for (let i = 0; i < content.length;) {
    const unit = content[i];
    const run = stampAt.get(i);

    if (run) {
      const reps: Line[][] = [];
      for (let r = 0; r < run.reps; r++) {
        const lines: Line[] = [];
        for (let k = 0; k < run.span; k++) lines.push(...content[i + r * run.span + k].lines);
        reps.push(lines);
      }

      // Named after the divider that introduced it when there was one, because
      // the divider is what the run is called. With no divider, the name comes
      // from what every repetition SHARES, never from the first one: "Payroll ·
      // findings" is one audit area, and a template that holds a content word
      // is not a template.
      const useGroup = group && group.lines.length === 0;
      const shared = sharedName(
        Array.from({ length: run.reps }, (_, r) => content[i + r * run.span].heading?.text ?? ''));
      const name = useGroup ? group!.name : shared ?? 'Findings';
      const section = useGroup
        ? group!
        : openSection(name, unit.n, !!unit.heading?.explicit && !!shared, false);
      section.stamp = reps;
      section.lines = reps[0];
      group = null;
      i += run.span * run.reps;
      continue;
    }

    // A divider names the part the units following it belong to.
    if (unit.divider && unit.heading) {
      group = openSection(unit.heading.text, unit.n, unit.heading.explicit, WRAPPER.test(unit.heading.text));
      i++;
      continue;
    }

    if (!unit.heading) {
      // Nothing on the unit reads as a heading. Its content still belongs
      // somewhere, so it joins the part it sits under rather than vanishing.
      const target = group ?? spine[spine.length - 1];
      if (target) target.lines.push(...unit.lines);
      i++;
      continue;
    }

    if (group) {
      // Inside a group, a unit is a block of the part, so its own title
      // becomes the label on that block. This is where a deck gets its second
      // level from.
      group.lines.push({
        text: `§§${unit.heading.text}`,
        cells: [{ text: unit.heading.text, x: 0, right: 0 }],
        x: 0, y: 0, size: 0, bold: true, page: unit.n,
      });
      group.lines.push(...unit.lines);
      i++;
      continue;
    }

    const section = openSection(
      unit.heading.text, unit.n, unit.heading.explicit, unit.n <= 2 && WRAPPER.test(unit.heading.text));
    section.lines.push(...unit.lines);
    i++;
  }

  // A heading with nothing under it is not a part. It is never dropped in
  // silence either: the caller offers it back.
  const kept: SpineSection[] = [];
  for (const s of spine) {
    if (s.lines.some(l => !l.text.startsWith('§§') && l.text.trim().length > 3)) kept.push(s);
    else skipped.push(s.name);
  }

  const detected = Math.min(kept.length, SECTION_CAP);
  return {
    spine: kept.slice(0, SECTION_CAP),
    skipped,
    cover,
    toc: docEntries > 0
      ? {
        docEntries,
        detected,
        verdict: detected > docEntries * 1.5 ? 'over-split'
          : detected < docEntries * 0.6 ? 'under-detected'
            : 'match',
      }
      : undefined,
  };
}

// ═══ Is this PDF really a deck? ══════════════════════════════════════════════
//
// Four tells, none of them conclusive alone. Two or more and the PDF is read
// with deck rules instead of document rules.

export type DeckShape = { isDeck: boolean; tells: string[] };

/** A page is "sideways" at this width-to-height ratio or wider. */
const LANDSCAPE = 1.25;
/** One topic per page means few lines on it. A written report runs to forty. */
const SPARSE_LINES = 18;

export function looksLikeADeck(
  body: Line[][], aspects: number[], hasRunningFurniture: boolean,
): DeckShape {
  const pages = body.length;
  if (pages < 4) return { isDeck: false, tells: [] };
  const tells: string[] = [];

  // 1 · Sideways pages, and this one is REQUIRED. The other three all turn up
  // on ordinary written reports too — a short report has few lines per page and
  // every report has a running footer — so on their own they flip a document
  // that was never a deck, and it is then read with the wrong rules end to end.
  // A deck saved to PDF is landscape; a written report is portrait.
  const landscape = aspects.filter(a => a >= LANDSCAPE).length;
  if (landscape < pages * 0.8) return { isDeck: false, tells: [] };
  tells.push('sideways pages');

  // 2 · One topic per page. Slides carry a title and a handful of lines, not
  //     the running prose a document page carries.
  const sparse = body.filter(p => p.length > 0 && p.length <= SPARSE_LINES).length;
  if (sparse >= pages * 0.7) tells.push('one topic per page');

  // 3 · Pages carrying nothing but one line. Those are divider pages, and a
  //     written report does not have them.
  const dividers = body.filter(p => p.length > 0 && p.length <= 2
    && p[0].text.trim().split(/\s+/).length <= 10).length;
  if (dividers >= 1) tells.push('divider pages');

  // 4 · The same logo and page number on every page. Pass 2 has already found
  //     these, so the question is only whether there were any.
  if (hasRunningFurniture) tells.push('the same furniture on every page');

  return { isDeck: tells.length >= 2, tells };
}

/**
 * The heading of a deck-shaped page: the biggest line near the top, short
 * enough to be a title. A printed slide never numbers its heading, which is
 * exactly why the document reader finds nothing on one.
 */
export function pageHeading(lines: Line[]): { text: string; explicit: boolean } | undefined {
  if (lines.length === 0) return undefined;
  const top = Math.min(...lines.map(l => l.y));
  const bottom = Math.max(...lines.map(l => l.y), top + 1);
  const band = top + (bottom - top) * 0.28;
  // BIGGER THAN THE WRITING AROUND IT, not biggest on the page. One oversized
  // thing — a decorative figure, a watermark, a section number set large — then
  // outranks every real title, and page after page comes back with no heading
  // at all. Six observation pages of a consultant report were read as one
  // section because of exactly that.
  const body = median(lines.map(l => l.size));

  let best: { line: Line; text: string } | undefined;
  for (const line of lines) {
    if (line.y > band) continue;
    const text = line.text.trim();
    const words = text.split(/\s+/).length;
    if (!text || words > 14 || text.length > 110) continue;
    if (line.cells.length > 2) continue;                 // a table row, not a title
    if (/[.;,]$/.test(text)) continue;
    if (line.size < body * 1.08 && !line.bold) continue; // no bigger than the body
    // The largest candidate in the band wins, so a small running label sitting
    // above the real title does not take its place.
    if (!best || line.size > best.line.size) best = { line, text };
  }
  return best ? { text: titleCaseIfCaps(best.text), explicit: false } : undefined;
}

/** A page carrying one short line and nothing else names the run that follows. */
export function pageIsDivider(lines: Line[]): boolean {
  const real = lines.filter(l => l.text.trim().length > 0);
  return real.length > 0 && real.length <= 2
    && real[0].text.trim().split(/\s+/).length <= 10
    && real.every(l => l.cells.length <= 1);
}

/**
 * A deck page's shape, with its words left out so two finding pages match. On a
 * printed slide there are no object types to read, so the shape is how the text
 * is laid out: how many lines, how many are table rows, how wide the widest row
 * is, and whether the page has a title.
 *
 * The banding here has to be fine enough to tell a SNAPSHOT page from the
 * OBSERVATION page that follows it. Too coarse and the two collapse into one
 * repeat, the card shape is taken from the snapshot alone, and the run is
 * dropped for carrying no rating — which is exactly what a lossier version of
 * this function did.
 */
export function pageSignature(lines: Line[]): string {
  const rows = lines.filter(l => l.cells.length >= 2);
  const widest = Math.max(0, ...lines.map(l => l.cells.length));
  // Pairs of lines, so one wrapped line does not make two pages differ, while
  // a page with two more lines than its neighbour still reads as another kind.
  return `${lines.length >> 1}:${rows.length}:${widest}:${pageHeading(lines) ? 'h' : '-'}`;
}
