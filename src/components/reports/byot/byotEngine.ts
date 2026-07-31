// ─── Bring Your Own Template — the reading engine ───────────────────────────
//
// THE ONE RULE: extraction keeps the SKELETON, never the CONTENT. Section
// order, headings, tables, ratings and branding survive. Their findings, their
// figures, their names and their dates are thrown away.
//
// A PDF never says "this line is a heading" or "this box is a table", so the
// engine guesses from clues: size, boldness, position, numbering, alignment,
// repetition. It reads the file six times and each read answers exactly one
// question, so when a result is wrong we can point at the read that failed:
//
//   1  Unpack            what text pieces exist, and where do they sit?
//   2  Remove furniture   which lines repeat on every page? Lift them out and
//                         keep them as pre filled settings, not headings.
//   3  Build the tree     which lines are headings, and in what order?
//   4  Classify blocks    inside a section, is this prose, a table, a stat
//                         strip, a slot or a callout?
//   5  Spot repeats       does any shape appear more than once? Save it once
//                         and mark it as repeating. The count never matters.
//   6  Name what we found section purpose, fill case, rating words, confidence.
//                         Never numbers, never new sections.
//
// Rules first, naming last: geometry decides WHAT EXISTS, labelling decides
// WHAT TO CALL IT.

import { getPdfjs } from '../../data-sources/datasetFiles';
import {
  buildDeckTree, looksLikeADeck, pageHeading, pageIsDivider, pageSignature,
  type DeckUnit,
} from './deckRules';
import type { BlockFill, SectionFill, DataBinding, TemplateBlock } from '../reportShared';
// The four situations that raise "check this", shared with the review screen so
// the engine and the card it draws speak from one list rather than two.
import type { CheckReason } from '../sectionReviewShared';

export type { BlockFill, SectionFill, DataBinding, CheckReason };

// ═══ What the engine hands back ══════════════════════════════════════════════

export type ReadEvidence = 'explicit' | 'inferred';

export interface ReadBlock extends TemplateBlock {
  /** How sure passes 4 and 5 are (0 to 1). Grounds the "check this" flag. */
  confidence: number;
  page?: number;
  /** Up to two source lines for the review screen. Never persisted. */
  preview?: string[];
}

export interface ReadSection {
  name: string;
  /** One line purpose, always pre filled by pass 6, never an empty prompt. */
  description: string;
  fill: SectionFill;
  /** Why the engine guessed this fill, in plain words the user can check. */
  fillReason?: string;
  binding?: DataBinding;
  blocks: ReadBlock[];
  evidence: ReadEvidence;
  confidence: number;
  /** Which of the four situations put this part in the check queue, if any. */
  flag?: CheckReason;
  page?: number;
  appendix?: boolean;
  /** Carrier paperwork wrapped around the real report. Excluded with one
   *  confirmation question in review, never in silence. */
  wrapper?: boolean;
  source?: string[];
}

/** Pass 2's output. Stored as pre filled settings the user verifies. */
export interface ReadFurniture {
  header: string[];
  footer: string[];
  pageNumberPattern?: string;
  confidentiality?: string;
  fields: {
    auditTitle?: string;
    auditEntity?: string;
    auditPeriod?: string;
    preparedBy?: string;
    reportId?: string;
  };
}

/** The only valid sanity check, and it is relative: our section list against
 *  the report's own contents page. A 40 section report with a 40 entry
 *  contents page is correct, not a failure. */
export interface ReadTocCheck {
  docEntries: number;
  detected: number;
  verdict: 'match' | 'over-split' | 'under-detected';
}

/** A section the template does not keep, listed once at review so nothing
 *  disappears in silence. The client covers these per report through Add
 *  Observation. */
export interface ReadDropped {
  name: string;
  why: string;
  /** Not really left out: its structure came back as a template setting. */
  captured?: boolean;
  /** A block inside a section we KEPT, not a section of its own. Its claim was
   *  vetoed by the section's heading, so it is listed here rather than left
   *  unaccounted for — and it must never be promoted back into a section.
   *  Anything counting sections has to skip these. */
  block?: boolean;
}

export interface ReadResult {
  furniture: ReadFurniture | null;
  sections: ReadSection[];
  /** Sections neither detector claimed. Said once, never silently. */
  dropped: ReadDropped[];
  /** Headings with nothing beneath them. Not added, never silently dropped. */
  skipped: string[];
  pageCount: number;
  /** Page snapshots for the side by side review. Transient, never saved. */
  pages?: string[];
  snapshotLimit: number;
  findingScale?: string[];
  opinionScale?: string[];
  coverColor?: string;
  toc?: ReadTocCheck;
  /** The signature block, captured as a SETTING rather than a section. There is
   *  nothing to generate in a sign-off: role labels and empty boxes are the
   *  whole feature, so it sits with page numbers and the watermark. */
  signoff?: { roles: string[] };
  /** A closing or "thank you" page, captured the same way and for the same
   *  reason: the shape is the whole feature, so there is nothing to generate. */
  closing?: { lines: string[] };
  /** Their brand mark, as a data URL. Only a deck hands one over reliably: a
   *  PDF's images are drawing operations with nothing saying which is a logo. */
  logo?: string;
  /** Whether the reader counted pages or slides. Only the wording changes. */
  unit?: 'page' | 'slide';
}

export type ReadFailReason =
  | 'unsupported' | 'too-large' | 'password' | 'scanned' | 'too-long' | 'unreadable'
  /** A deck with nothing readable in it: every slide is a picture, or the file
   *  is a shell with no slides at all. */
  | 'empty-deck'
  /** An older binary .ppt, which is a different file format entirely. */
  | 'legacy-ppt';
export type ReadOutcome =
  | { ok: true; result: ReadResult }
  | { ok: false; reason: ReadFailReason; pageCount?: number };

// ═══ Guardrails ══════════════════════════════════════════════════════════════

export const MAX_BYTES = 30 * 1024 * 1024;
/** "Upload a representative report." A 300 page pack is not a template. */
export const PAGE_CAP = 50;
export const SNAPSHOT_MAX = 24;
export const SNAPSHOT_WIDTH = 520;
export const SECTION_CAP = 48;

// ═══ Clue constants ══════════════════════════════════════════════════════════

/** Share of the page height treated as the header / footer margin band. */
const BAND = 0.08;
/** A line is running furniture when it recurs on this share of pages. */
export const REPEAT_SHARE = 0.6;
/** …or when it appears in the SAME PLACE on this many pages. Nothing that
 *  repeats in one spot page after page is content. */
export const REPEAT_PAGES = 3;
/** How close two lines must sit vertically to count as the same position. */
const POSITION_TOLERANCE = 6;
/** A line reads as a heading at this multiple of the body text size. */
const HEADING_SIZE = 1.14;

const NUMBERED = /^(\d+(?:\.\d+)*)[.)]?\s+(\S.*)$/;
const LETTERED = /^([A-Z])[.)]\s+(\S.*)$/;
const APPENDIX = /^(appendix|annexure|annex|schedule|exhibit)\s+([A-Z0-9]+)\b[:.\-\s]*(.*)$/i;
// The optional tail: a consultant deck glues the finding's rating LETTER onto
// the end of its own running-header title ("… (contd.)  H"), same as it does
// on the title's first appearance. "(contd.)" no longer sits at the string's
// own end once that letter trails it, so the plain end-anchored version below
// stopped matching a continuation page at all — the merge that is supposed to
// fold "(contd.)" back into the page before it silently never fired, and the
// stray page went on to be read as a whole extra finding. A bare 1-2 letter
// token is never real title content, whatever it says, so it is tolerated
// generically here rather than checked against the client's own scale words —
// deckShapedTree runs before the scale is known.
const CONTINUED = /\(?\bcont(?:inued|d)?\.?\)?\s*(?:[A-Za-z]{1,2}\s*)?$/i;
export const CONTENTS = /^(table of contents|contents|index)$/i;
const PAGE_NUMBER = /^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i;
export const CONFIDENTIAL = /\b(strictly\s+)?(confidential|private and confidential|internal use only|restricted)\b/i;
export const WRAPPER = /\b(committee|cabinet|financial implications|legal implications|report to|cover sheet|covering report|decision required|recommendation to)\b/i;
export const SIGNOFF = /\b(sign[\s-]?off|signature|approvals?|prepared by and approved)\b/i;
const ROLE = /\b(prepared by|reviewed by|approved by|authorised by|authorized by|head of internal audit|chief audit executive|audit manager|engagement partner|director)\b/i;
/** Words that make a short cell read as somebody's role on a signature row. */
const ROLE_TITLE = /\b(lead|head|chair|chairman|director|partner|manager|officer|controller|executive|auditor|prepared|reviewed|approved|authorised|authorized|signed)\b/i;
/** A cross reference: the line points at a section instead of opening one. */
const POINTER = /\b(see|refer(?:red)?\s+to|as\s+(?:set\s+out|described)\s+in|per)\s+(section|appendix|annexure|para(?:graph)?|part|table)\s*[\dA-Z][\d.]*/i;
/** Noise that sits between real content and must never be proposed. */
const BLANK_PAGE = /^(this )?page (is )?intentionally left blank$|^\[?this page.*blank\]?$/i;
/** The only words that name a section on their own. Everything else that is
 *  one word long is a wrapped fragment, a watermark or a stray label. */
const SINGLE_WORD_SECTION = /^(introduction|background|scope|objective|objectives|approach|methodology|findings|observations|recommendations|conclusion|conclusions|summary|opinion|limitations|appendix|appendices|annexure|glossary|definitions|sources|distribution|contents|acknowledgements?)$/i;
/** A finding reference: letters, then numbers, joined by dashes or slashes.
 *  Deliberately strict — "IFRS16" and "FY26" are not finding IDs, and a loose
 *  match turns every section into a repeating card. */
export const FINDING_ID = /\b[A-Z]{2,4}[-/]\d{2,4}[-/][A-Z]?\d{1,3}\b|\b[A-Z]{1,3}-\d{1,3}\b/;

/** Field labels worth keeping off the cover and the letterhead. */
const FIELD_LABELS: { key: keyof ReadFurniture['fields']; re: RegExp }[] = [
  { key: 'auditTitle', re: /^(report title|audit title|title|subject)$/i },
  { key: 'auditEntity', re: /^(entity|organisation|organization|company|client|auditee|business unit)$/i },
  { key: 'auditPeriod', re: /^(period|audit period|period covered|financial year|reporting period|for the year)$/i },
  { key: 'preparedBy', re: /^(prepared by|issued by|author|audit lead)$/i },
  { key: 'reportId', re: /^(report (reference|ref|no\.?|number|id)|reference|ref)$/i },
];

/** Boilerplate fingerprints: the phrasings that mark words as standard, and
 *  that must therefore print unchanged. Names are a hint, the wording is the
 *  evidence. */
// The memo's own list of what prints word for word: rating and root-cause
// definitions, APPROACH AND METHODOLOGY, "how to read this report", the legal
// and conformance lines. Approach and methodology were missing, and the pages
// that name themselves that way were reaching the catch-all instead — the bug
// meter's whole point. They sit at the weak end of the fixed-wording check, so
// a heading like "Scope, objectives and approach" that a data check already
// claimed is untouched: this only catches what nothing else wanted.
// "Assurance" is deliberately NOT here. A page named for it is this audit's own
// verdict ("net risk is assessed as MODERATE… REASONABLE assurance over the
// Council's approach"), not the table that defines the words, and the table
// already matches on "definitions" or "criteria". Left out with the opinion's
// own reason, which is what it is.
const FIXED_NAME = /\b(rating (definitions?|scale)|definitions?|criteria|significance|how to read|basis of|conformance|standards?|disclaimer|glossary|legal|statement of responsibility|approach|methodolog(y|ies))\b/i;
const FIXED_PHRASE = /\b(is defined as|are defined as|for the purposes of this report|in (conformance|compliance) with (the )?(international )?standards|conforms? (to|with) the|the following definitions|this report (should|must) be read|no assurance is given|does not constitute|shall not be (relied|reproduced)|without our prior written consent)\b/i;

/** WHOSE WORDS ARE THESE? Much of the boilerplate in a client's old report was
 *  written by the consultant who ran that engagement — "we have completed the
 *  audit", "our procedures", a firm's name on the letterhead. Printing another
 *  firm's voice on the client's own reports would certify an engagement that
 *  never happened, so wording carrying either is kept as a STARTING DRAFT and
 *  flagged for the client to make theirs. Definitions and scale rules carry no
 *  voice at all, so they lock as they are. */
const FIRST_PERSON = /\b(we|us|our|ours|ourselves)\b/i;
const FIRM_NAME = /\b(LLP|LLC|Chartered Accountants|&\s*Co\.?|&\s*Associates|PwC|Price\s?waterhouse\s?Coopers|KPMG|Deloitte|Ernst\s*&\s*Young|Grant Thornton|BDO|RSM|Mazars|Crowe|Baker Tilly|Advisory Services|Consulting (Private|Pvt|Services))\b/;

/** Captions that count things Irame records, so a stat card carrying them is
 *  computable. A financial caption is the same card shape and is NOT. */
const COUNT_NOUN = /\b(exceptions?|findings?|observations?|issues?|open|closed|tested|samples?|controls? tested|recommendations?|actions?|overdue|total)\b/i;
const MONEY_NOUN = /\b(revenue|margins?|profit|cash|cost|turnover|ebitda|crore|cr\b|₹|\$|£|€)/i;

// ─── What "fills from audit results" actually means ─────────────────────────
//
// Not a feeling. Once a report's queries have run, Irame holds exactly this:
//
//   per query    id · title · category tag · rating in our words · the written
//                finding and what to verify · its recommendation · exception
//                counts (total, open, closed) · check health %
//   per report   title · period · financial year · author · generation date ·
//                the queries it was built from · the categories they carry
//   worked out   counts by rating · a table of the findings (ref, rating,
//                action) · summary text restating findings, counts, actions
//
// And it holds NONE of this:
//
//   money        revenue, margins, impact amounts, anything with a currency
//   decisions    made before the queries ran: why this audit, what was
//                deliberately excluded, the formal opinion
//   answers      other people's: management responses, owners, agreed dates
//   the past     what happened to last audit's actions, direction of travel
//   the org      who they are, what they do, their systems' contents
//
// The five checks below are shape-tests for the first list. If a part needs
// anything from the second, no check may fire — by design, because a claimed
// part we cannot fill is a part the AI fills with things we never found.

/** Somebody else's answer. A column of these is a column we wait on, never one
 *  we produce, so it may ride along on a table but can never carry the claim. */
const HUMAN_COLUMN = /\b(owner|responsib\w*|due|target|status|management (response|comment|reply)|auditee response|agreed|accountable|action(ee| by))\b/i;
/** Columns our own results carry, which are the ones that let a table fill. */
const OUR_COLUMN = /\b(ref|reference|rating|severity|priority|grading|finding|observation|exception|issue|recommendation|action|area|cycle|process|category|critical|high|medium|low|total|count|number|no\.)\b/i;

/** What happened to last audit's actions. We do not track it yet, so a part
 *  built on it is left out and logged rather than claimed and left blank. */
const PRIOR_PERIOD = /\b(follow[\s-]?up|previous (audit|report|year|period)|prior (year|period|audit)|last (audit|year)|brought forward|carried forward|status of (previous|prior)|not implemented|repeat (finding|observation|issue)s?|since (the )?last)\b/i;
/** Decisions taken before the queries ran. The formal opinion is one of them:
 *  our results carry ratings and counts, never a verdict on the engagement. */
const PRE_QUERY_DECISION = /\b((audit|assurance|overall|formal|our) opinion|basis (of|for) (our )?opinion|why this audit|audit rationale|reasons? for (the )?audit|scope (exclusions?|limitations?)|out of scope|excluded from (the )?(scope|review))\b/i;

/** The headings a committee cover sheet is made of. A council or board report
 *  wraps the real audit in a standing form: what it is for, what it costs,
 *  what the law says, who to contact. Any ONE of these words can appear in a
 *  perfectly ordinary audit report ("Recommendations" is a section we keep),
 *  so no single heading may name a cover sheet. Two or more of them in one
 *  document is the form, and then the whole run is the wrapper the memo says
 *  to leave out. */
const COMMITTEE_FORM = /^(purpose of (the )?report|recommendations?|current situation|(financial|legal|environmental|staffing|resource|equalit(y|ies)|climate|risk) implications?|impact assessments?|outcomes?|background papers?|report author contact details|contact details|appendices|linked reports?|decision required)\b/i;

/** The back matter's own group name, standing alone as a heading. It names the
 *  pages that follow rather than holding anything itself, so each of those is
 *  judged on its own and this is a marker, not a part. */
const GROUP_MARKER = /^(appendices|appendix|annexures?|annexes?|attachments?|enclosures?|exhibits?|supporting (documents?|information))\s*$/i;

/** What to call a vetoed block on the left-out list when it carried no label
 *  of its own. Its section's name leads, because the row has to be findable in
 *  the document the client is looking at. */
const VETOED_BLOCK_NOUN: Record<RawBlock['kind'], string> = {
  narrative: 'the writing on it',
  table: 'its table',
  stat: 'its row of numbers',
  slot: 'its fill-in boxes',
  callout: 'its highlighted box',
  chart: 'its chart',
  cards: 'its repeating card',
  signoff: 'its sign-off block',
};

/**
 * WHAT THIS HEADING SAYS WE DO NOT HOLD — read before a single block is kept.
 *
 * This is the data list having the last word, and it has to have it BEFORE the
 * keeps happen, not after. Read afterwards it becomes a section-level verdict
 * thrown over blocks that were already kept, which is the downward override the
 * memo bans and the state `keepSection` now treats as impossible. So the
 * heading stops the CLAIM instead: a page about the year's plan may still hold
 * wording that prints unchanged, but nothing inside it may say it fills from
 * audit results. With every claim vetoed the section keeps nothing, and the
 * same reason then leaves it out whole — a drop with a name on it, rather than
 * a keep with an empty box in it.
 *
 * Only reasons about data we do not hold live here. The two that read the
 * heading's STRUCTURE — a group name, a committee form field — are not about
 * data at all and stay in `notHeldReason`, where nothing was kept anyway.
 */
function claimVetoReason(name: string, body = ''): string | undefined {
  if (AUDIT_PLAN.test(name)) {
    return 'Not included: this is the year’s audit plan, so it covers audits outside this report.';
  }
  if (PRIOR_PERIOD.test(name)) {
    return 'Not included: it needs what happened to last audit’s actions, and we do not track that yet.';
  }
  if (FORMAL_OPINION.test(name)) {
    return 'Not included: the formal opinion is the auditor’s own judgment, so we never write it for you.';
  }
  if (PRE_QUERY_DECISION.test(name) || OUT_OF_SCOPE.test(name)) {
    return 'Not included: it needs decisions taken before the queries ran, like what was deliberately left out of scope.';
  }
  // The aim of the audit and the background to it are both decided before a
  // single query runs: why this audit, and who the organisation is. Named,
  // because a generic line on a part we plainly recognise just invites "why did
  // you remove my introduction?".
  if (AIM_OF_AUDIT.test(name)) {
    return 'Not included: why this audit was done is decided before the queries run, so it is yours to write.';
  }
  if (BACKGROUND_NAME.test(name)) {
    return 'Not included: this is background about your organisation, and our audit checks do not produce that.';
  }
  // A limitations page vetoed here is not the standard wording — that is kept
  // as fixed text, which claims nothing and so is never vetoed. This is the
  // impression classifier, and this is the ONLY power it has: it can stop a
  // claim, it can name a drop, and it can never take a section that kept
  // something. Seven of eight blocks kept and the section dropped anyway is
  // the caught case, and it turned a 21-page report into an empty template.
  if (LIMITS_NAME.test(name)) {
    return 'Not included: it describes how this particular audit went, which is different in every report.';
  }
  if (FINANCIAL_NAME.test(name)) {
    return 'Not included: these are financial figures from your books, and our audit checks do not produce those.';
  }
  if (HUMAN_ANSWER_NAME.test(name)) {
    return 'Not included: these are other people’s answers. They come in one report at a time through Add Observation.';
  }
  if (body && ADVISORY_PROSE.test(name)) {
    return 'Not included: advice without a rating on it, so we cannot tell which findings it belongs to. Add it to a report through Add Observation.';
  }
  return undefined;
}

/**
 * The reason a section that kept NOTHING is left out, named by what it needs
 * rather than by a shrug.
 *
 * Every branch is behind the one gate at the top, because keeps flow up and
 * drops never flow down: a heading holding a block we kept is a section,
 * whatever its words suggest, and our own report's "Appendix" — which holds
 * its sources list — is the caught case. The data-availability reasons already
 * ran as claim vetoes before the keeps, so anything reaching here with claims
 * vetoed arrives with nothing kept and gets the same words.
 *
 * `coverSheet` says this document carries a committee form, which is what
 * lets its standing headings be named as one rather than shrugged at one by
 * one. It is a document-level fact because the words on their own mean nothing.
 */
function notHeldReason(name: string, body = '', nothingKept = false, coverSheet = false): string | undefined {
  if (!nothingKept) return undefined;
  const veto = claimVetoReason(name, body);
  if (veto) return veto;
  // The body only ever names a drop, never causes one, which is why it is read
  // on a section where nothing was kept and nowhere else.
  if (financialBody(body)) {
    return 'Not included: these are financial figures from your books, and our audit checks do not produce those.';
  }
  // The back matter's own group name. It names what follows and holds nothing,
  // so the pages under it are judged one by one and it is not a part itself.
  if (GROUP_MARKER.test(name)) {
    return 'Not included: this heading names the pages that follow rather than holding anything itself, so each of those is judged on its own.';
  }
  // Last of the named reasons, because every earlier one is more specific:
  // "Purpose of report" is the aim of the audit before it is a form field.
  if (coverSheet && COMMITTEE_FORM.test(name)) {
    return 'Not included: this is part of the committee cover sheet wrapped around your report, not the report itself.';
  }
  return undefined;
}

/** The year's plan of audits. A committee deck opens with it, and it covers
 *  every audit but this one. Scoped as decision 10, deliberately not built. */
const AUDIT_PLAN = /\b((annual|yearly|year'?s) (audit )?plan|audit plan|plan (for the year|status)|planned audits|status of (the )?plan)\b/i;
/** The auditor's accountable judgment on the engagement. */
// "Assurance assessment" is "overall assessment" with the words swapped, and it
// holds the same sentence: this audit's own verdict on the control framework.
// It was reaching the catch-all, which invites "why did you remove this?" about
// the one page whose answer we actually know.
const FORMAL_OPINION = /\b((audit|assurance|overall|formal|our) opinion|basis (of|for) (our )?opinion|overall (conclusion|assessment|assurance)|assurance assessment)\b/i;
/** Their books: revenue, margins, ratios. Not our query output. */
const FINANCIAL_NAME = /\b(financial (statements?|extracts?|highlights?|tables?|summary|performance)|profit (and|&) loss|balance sheet|ratios?|revenue|margins?|turnover|cost implications?)\b/i;

/** …and the same page when its HEADING says nothing about money. "Segment and
 *  geographic performance" and "Working capital, cash and shareholder returns"
 *  are their books from top to bottom, and a heading list will never cover
 *  every way a company names its own numbers. So the body answers: rows of
 *  currency and crore, and nothing our own results count. Named, because a
 *  generic line on a page of ₹ crore tables reads as if we did not look. */
const CURRENCY_LINE = /[₹$€£]|\b(crore|cr\.|lakh|mn|bn|million|billion)\b/i;
/** The things a company measures itself by. Only ever read on a section where
 *  nothing at all was kept, so it names a drop and can never cause one. */
const FINANCIAL_MEASURE = /\b(revenue|profit|margin|turnover|growth|segment|geograph|cash flow|working capital|receivabl|unbilled|dividend|buyback|ebitda|year[\s-]on[\s-]year|constant currency|days sales outstanding|dso|free cash|shareholder|earnings|fy\d{2})\b/i;
function financialBody(body: string): boolean {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 4) return false;
  const money = lines.filter(l =>
    CURRENCY_LINE.test(l) || MONEY_NOUN.test(l) || FINANCIAL_MEASURE.test(l)).length;
  const ours = lines.filter(l => FINDING_ID.test(l) || COUNT_NOUN.test(l)).length;
  return money >= 3 && money >= lines.length * 0.25 && money > ours;
}
/** Pages that are somebody else's answers from end to end. */
const HUMAN_ANSWER_NAME = /\b(management (response|comment|repl(y|ies))s?|auditee (response|comment)s?|action (owner|taken) report|responses? (from|of) management)\b/i;
/** What the audit set out to test. A decision taken before the queries ran. */
const AIM_OF_AUDIT = /\b(audit objectives?|objectives? of (the )?(audit|review|assignment)|purpose of (the )?(report|audit|review)|aims? of (the )?(audit|review))\b/i;
/** Who the organisation is and how it works. Their business, not our results. */
const BACKGROUND_NAME = /^(introduction|background|about (the|this)|context)\b/i;
/** How the work went this time: what was late, what was unavailable. */
const LIMITS_NAME = /\b(limitations?|constraints?|caveats?)\b/i;
/** Advice with no rating attached, so nothing ties it to a finding. */
const ADVISORY_PROSE = /\b(advisory|good practice|observations? for (improvement|consideration)|points? for (consideration|noting)|other (matters|recommendations))\b/i;

/** A sources or basis appendix: the list of what the report was built from. */
const SOURCES_NAME = /\b(sources?|data sources?|queries|checks? (run|performed)|basis of preparation|information (used|relied))\b/i;
/** …and the same appendix when its heading says only "Appendix". The list
 *  itself is the evidence: it names the queries the report was built from,
 *  which is a detail Irame holds about every report it makes. */
const SOURCES_BODY = /\b(source quer(y|ies)|quer(y|ies) (used|run|executed)|full query outputs?|data sources?\s*:|built from the (following )?quer)/i;

/** Slot labels the system already knows about every report it generates. */
const METADATA_LABEL = /^(report (title|date|reference|ref|no\.?|number|id)|title|subject|audit (title|period|date)|period|date|prepared by|issued by|author|audit lead|version)$/i;

/** Rating vocabularies. Whichever set the document uses becomes a setting, and
 *  generated reports then speak their words instead of ours. */
const FINDING_SCALES = [
  ['Critical', 'High', 'Medium', 'Low'],
  ['High', 'Medium', 'Low'],
  ['Priority 1', 'Priority 2', 'Priority 3'],
  ['Significant', 'Moderate', 'Minor'],
  ['Fundamental', 'Significant', 'Housekeeping'],
];
const OPINION_SCALES = [
  ['Effective', 'Substantially effective', 'Partially effective', 'Unsatisfactory'],
  ['Substantial', 'Reasonable', 'Limited', 'No assurance'],
  ['Comprehensive', 'Substantial', 'Partial', 'Limited'],
  ['Satisfactory', 'Needs improvement', 'Unsatisfactory'],
  ['Green', 'Amber', 'Red'],
];

// ═══ Internal shapes ═════════════════════════════════════════════════════════

type Piece = { text: string; x: number; right: number; y: number; size: number; bold: boolean };
export type Line = {
  text: string; cells: { text: string; x: number; right: number }[];
  x: number; y: number; size: number; bold: boolean; page: number;
  /** A table header row's column spans, when the file stated them. A PDF never
   *  does; a deck always does. */
  spans?: number[];
  /** This line opens a page but carries on the sentence the page before it
   *  left unfinished, so it belongs to that page's last block. */
  continuation?: boolean;
  /** First line of a new column on a two-column page. A column boundary is a
   *  block boundary: without it the foot of the left column and the head of the
   *  right one run together into one paragraph, which is how PwC's approach
   *  bullets ended up inside its limitation wording and neither could be
   *  claimed as what it is. */
  columnBreak?: boolean;
};

type Unpacked = {
  pageCount: number;
  /** Lines per page, top of page first. */
  perPage: Line[][];
  /** Width over height per page. A deck saved to PDF is sideways. */
  aspects: number[];
  textItems: number;
  snapshots: string[];
  coverColor?: string;
  bodySize: number;
};

type Furnished = {
  furniture: ReadFurniture | null;
  /** Body lines per page with the running furniture lifted out. */
  body: Line[][];
  headerLines: Set<string>;
};

export type SpineSection = {
  name: string;
  level: number;
  page: number;
  evidence: ReadEvidence;
  confidence: number;
  appendix: boolean;
  wrapper: boolean;
  /** Everything under the heading, including deeper sub headings. */
  lines: Line[];
  /** Charts the reader saw. Three kinds, and which one it is decides what we
   *  may do with it. A PDF chart is a picture, so only a deck fills this in. */
  charts?: { kind: 'object' | 'drawn' | 'picture'; label?: string; labels: string[] }[];
  /** A repeating stamp: the same run of slides once per finding. Each entry is
   *  one repetition's lines, so the shape is kept once and the count with it. */
  stamp?: Line[][];
  /** Two headings resolved to this one part and were merged into it. The merge
   *  is worth a second pair of eyes, so it becomes a "check this". */
  twin?: boolean;
  /** Their own box labels, when the stamp was found by its frame row. These
   *  become the card's fields, so the card keeps their wording. */
  frameFields?: string[];
};

export type Tree = {
  spine: SpineSection[];
  skipped: string[];
  cover: Line[];
  toc?: ReadTocCheck;
};

/** Blocks before pass 6, still carrying the raw lines the classifier saw. */
export type RawBlock = Omit<TemplateBlock, 'fill'> & {
  confidence: number;
  page?: number;
  lines: string[];
};

// ═══ Small helpers ═══════════════════════════════════════════════════════════

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const median = (ns: number[]) => {
  if (ns.length === 0) return 10;
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
export const titleCase = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
/** Digits generalised: "IA-26-H01" becomes "IA-##-H##". */
const generalisePattern = (id: string) => id.replace(/\d/g, '#');
/** …and back again, so rows can be tested against the document's own shape. */
const idPatternToRegex = (pattern: string) =>
  new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/#/g, '\\d'), 'g');
const isNumeric = (s: string) => /^[₹$€£]?\s*-?[\d,.]+\s*(%|cr|mn|bn|k|m)?$/i.test(s.trim()) && /\d/.test(s);
const sentenceish = (s: string) => s.split(/\s+/).length > 12 || /[.;:]$/.test(s.trim());

/** A heading is a COMPLETE LINE. These are the tells that a candidate is body
 *  text a wrapped paragraph tore in half: it opens mid-phrase, it stops
 *  mid-phrase, it carries a bullet, or there is next to nothing in it.
 *
 *  This is the cheapest bug the reader has and the most expensive one to
 *  leave in. Every fragment promoted here becomes a section, fails both
 *  questions (there is nothing in half a sentence to claim), and lands in the
 *  left-out list with the catch-all reason — one shredded paragraph produced
 *  five of them on the Aberdeen report. The fix is not a better reason. It is
 *  not making it a section. */
const BULLET_CHAR = /[•▪●◦‣]/;
/** Ends on a word that cannot end a title: an article, a preposition, a
 *  conjunction, a bare auxiliary, or a comma. */
const STOPS_MID_PHRASE = /(?:,\s*|\b(?:a|an|the|and|or|but|of|in|on|at|to|for|from|with|by|as|is|are|was|were|be|been|that|which|who|whose|into|onto|over|under|per|via|about|between|during|including|its|their|our|this|these|those)\s*)$/i;
function fragmentLine(text: string): boolean {
  const t = text.trim();
  // Blank or near-blank. "igh" — a rating word the reader shredded — shipped once.
  if (t.replace(/[^A-Za-z0-9]/g, '').length < 3) return true;
  if (BULLET_CHAR.test(t)) return true;
  // Opens mid-phrase. A lowercase first letter is the tell, unless the word
  // itself is capitalised inside ("eProcurement Review", "iPhone Estate").
  if (/^[a-z]/.test(t) && !/^[a-z]+[A-Z]/.test(t)) return true;
  if (STOPS_MID_PHRASE.test(t)) return true;
  return false;
}

// ═══ Pass 1 — unpack ═════════════════════════════════════════════════════════
// Every text piece comes out with its facts: words, page, position, size,
// boldness. Pieces on one baseline become a line; a wide gap inside a line
// splits it into cells, which is what makes a table detectable later.

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[]; styles?: Record<string, { fontFamily?: string }> }>;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
};

async function passUnpack(doc: PdfDoc): Promise<Unpacked> {
  const perPage: Line[][] = [];
  const aspects: number[] = [];
  const snapshots: string[] = [];
  let textItems = 0;
  let coverColor: string | undefined;
  const sizes: number[] = [];
  lastColumns.length = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const styles = content.styles ?? {};

    const pieces: Piece[] = [];
    for (const raw of content.items) {
      const item = raw as { str?: string; transform?: number[]; width?: number; fontName?: string; height?: number };
      const text = (item.str ?? '').replace(/\s+/g, ' ');
      if (!item.transform) continue;
      textItems += text.trim() ? 1 : 0;
      if (!text.trim()) continue;
      const [a, b, , , e, f] = item.transform;
      const size = Math.hypot(a, b) || item.height || 10;
      const family = styles[item.fontName ?? '']?.fontFamily ?? item.fontName ?? '';
      pieces.push({
        text,
        x: e,
        right: e + (item.width ?? text.length * size * 0.5),
        // Flip to a top down axis so "first on the page" is simply smallest y.
        y: viewport.height - f,
        size,
        bold: /bold|black|heavy|semib/i.test(family),
      });
      sizes.push(size);
    }

    // This page's own body size, because the gutter test is measured in ems and
    // the document median is not known until every page has been read.
    const pageBody = median(pieces.map(pc => pc.size)) || 10;
    const runs = columnRuns(pieces, pageBody, p);
    perPage.push(runs.flatMap(run => {
      const lines = piecesToLines(run, p);
      // Every run of a split page opens a new column or follows a full-width
      // line, and either way the text does not carry on from what came before.
      // The FIRST run counts too: it starts a fresh column, so the page before
      // it does not flow into it either. Without that, page 3's limitation
      // wording ran on into page 4's revenue overview and the paragraph failed
      // the fixed-wording gate on a figure it never contained.
      if (runs.length > 1 && lines[0]) lines[0] = { ...lines[0], columnBreak: true };
      return lines;
    }));
    aspects.push(viewport.height > 0 ? viewport.width / viewport.height : 1);

    // Page snapshots for the side by side review, plus the cover colour that
    // becomes the brand candidate. Both are read only from page images.
    if (snapshots.length < SNAPSHOT_MAX) {
      const canvas = document.createElement('canvas');
      const scale = SNAPSHOT_WIDTH / viewport.width;
      canvas.width = Math.round(viewport.width * scale);
      canvas.height = Math.round(viewport.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise;
          snapshots.push(canvas.toDataURL('image/jpeg', 0.72));
          if (p === 1) coverColor = dominantColor(ctx, canvas.width, canvas.height);
        } catch { /* a page that will not paint just has no snapshot */ }
      }
    }
  }

  return { pageCount: doc.numPages, perPage, aspects, textItems, snapshots, coverColor, bodySize: median(sizes) };
}

/** Why each page did or did not split into columns. A debug hook like
 *  `lastRead`: when a page comes back interleaved, this says which guard
 *  turned it down, so the next guess is not a guess. */
export const lastColumns: { page: number; split: boolean; why: string }[] = [];

/**
 * TWO COLUMNS ARE TWO READINGS, NOT ONE WIDE ONE.
 *
 * A PDF states no reading order. Bucketing pieces by baseline across the whole
 * page width is right for one column and wrong for two: the left column's line
 * and the right column's line share a baseline, so they come back as one line,
 * and the page reads as its two halves alternating sentence by sentence. The
 * PwC front matter is the caught case — "Commission, Payment Gateway, Shipping,
 * Logistics etc..) We will however, communicate to you as appropriate" is the
 * end of a left-column list glued to the middle of a right-column sentence, and
 * once that is the stored fixed wording it prints that way in every report.
 *
 * So the page is split at its gutter first and each column read top to bottom
 * on its own. Anything that crosses the gutter is full width by definition — a
 * spanning heading, a wide table row — and cuts the page into zones, which is
 * what keeps a heading above its two columns rather than inside one of them.
 *
 * Deliberately hard to trigger, because a two-column TABLE looks like this from
 * a distance and splitting one would tear every row in half. All of: enough
 * text to have a layout at all, a genuinely empty band near the middle, that
 * band wider than any cell gap (a gutter is set in ems, a table gap in points),
 * real content on both sides, and almost nothing crossing it.
 */
function columnRuns(pieces: Piece[], bodySize: number, page = 0): Piece[][] {
  const single = [pieces];
  const no = (why: string) => { lastColumns.push({ page, split: false, why }); return single; };
  if (pieces.length < 25) return no(`only ${pieces.length} pieces`);
  const left = Math.min(...pieces.map(p => p.x));
  const right = Math.max(...pieces.map(p => p.right));
  const span = right - left;
  if (span <= 0) return no('no width');

  // How many of the page's rows put ink in each slice of the text extent?
  // Counted in ROWS, not pieces, or a dense table column outvotes a paragraph.
  const N = 60;
  const cover = new Array<number>(N).fill(0);
  const rows = new Map<number, Piece[]>();
  for (const p of pieces) {
    const key = Math.round(p.y / Math.max(2, p.size * 0.55));
    (rows.get(key) ?? rows.set(key, []).get(key)!).push(p);
  }
  for (const row of rows.values()) {
    const hit = new Set<number>();
    for (const p of row) {
      const a = Math.max(0, Math.floor(((p.x - left) / span) * N));
      const b = Math.min(N - 1, Math.ceil(((p.right - left) / span) * N) - 1);
      for (let i = a; i <= b; i++) hit.add(i);
    }
    for (const i of hit) cover[i] += 1;
  }
  // QUIET, NOT EMPTY. Requiring a completely empty band means one full-width
  // heading anywhere on the page hides the gutter under it, and then nothing
  // ever splits — which is exactly what happened on the first build of this.
  // A gutter is where almost no row puts ink; the rows that do cross it are
  // handled below as the spanning lines they are.
  const quiet = Math.max(1, Math.round(Math.max(...cover) * 0.12));
  let best: { a: number; b: number } | null = null;
  for (let i = 0; i < N;) {
    if (cover[i] > quiet) { i++; continue; }
    let j = i;
    while (j + 1 < N && cover[j + 1] <= quiet) j++;
    const mid = ((i + j + 1) / 2) / N;
    if (mid > 0.3 && mid < 0.7 && (!best || j - i > best.b - best.a)) best = { a: i, b: j };
    i = j + 1;
  }
  if (!best) return no(`no quiet band (quiet<=${quiet}, peak ${Math.max(...cover)})`);
  const gutterStart = left + (best.a / N) * span;
  const gutterEnd = left + ((best.b + 1) / N) * span;
  // Measured in ems, because that is how a gutter is set. A page-width floor
  // was tried and is wrong: a wide page with a normal 2.4em gutter fails it,
  // which is what kept the PwC front matter interleaved. The absolute floor is
  // only there so a 4pt page cannot split on a hairline.
  const width = gutterEnd - gutterStart;
  const need = Math.max(bodySize * 1.8, 10);
  if (width < need) return no(`gutter ${width.toFixed(1)} < ${need.toFixed(1)} (body ${bodySize.toFixed(1)})`);

  const inLeft = pieces.filter(p => p.right <= gutterStart + 0.5);
  const inRight = pieces.filter(p => p.x >= gutterEnd - 0.5);
  const crossing = pieces.filter(p => p.x < gutterEnd - 0.5 && p.right > gutterStart + 0.5);
  if (inLeft.length < pieces.length * 0.25 || inRight.length < pieces.length * 0.25) {
    return no(`lopsided ${inLeft.length}/${inRight.length} of ${pieces.length}`);
  }
  if (crossing.length > pieces.length * 0.15) return no(`${crossing.length} of ${pieces.length} cross`);

  // COLUMNS OF TEXT, NOT COLUMNS OF A TABLE. A wide two-column table has the
  // same silhouette from here — ink, gap, ink — and splitting one reads every
  // row's halves as two unrelated runs, which loses the row.
  //
  // The tell is whether the two sides SHARE BASELINES. A table's rows pair up
  // by definition: each left cell has its right cell on the same line. Two
  // columns of text are independent flows and drift apart within a line or two.
  // Measured across this corpus the two populations do not overlap — the PwC
  // text pages sit at 0.18–0.32 and its annexure tables at 0.76–0.88 — so the
  // line is drawn at half and there is nothing near it.
  //
  // Line length was tried first and is the wrong test: it reads a left column
  // of bullets ("• Marketing Promotion Revenue") as table cells and refuses to
  // split the page, which left PwC's approach list and its limitation wording
  // running together in one block. A words floor survives only to keep a page
  // of bare figures out; one side making sentences is enough.
  const keyOf = (pc: Piece) => Math.round(pc.y / Math.max(2, pc.size * 0.55));
  const lk = new Set(inLeft.map(keyOf));
  const rk = new Set(inRight.map(keyOf));
  let paired = 0;
  for (const k of lk) if (rk.has(k)) paired++;
  const pairFrac = lk.size ? paired / lk.size : 0;
  const wordiness = (side: Piece[]) => {
    const perRow = new Map<number, number>();
    for (const pc of side) {
      const k = keyOf(pc);
      perRow.set(k, (perRow.get(k) ?? 0) + pc.text.trim().split(/\s+/).filter(Boolean).length);
    }
    return { rows: perRow.size, words: median([...perRow.values()]) };
  };
  const wl = wordiness(inLeft);
  const wr = wordiness(inRight);
  if (wl.rows < 3 || wr.rows < 3 || Math.max(wl.words, wr.words) < 5 || pairFrac >= 0.5) {
    return no(`not text columns (${wl.rows}r/${wl.words}w · ${wr.rows}r/${wr.words}w · pair ${pairFrac.toFixed(2)})`);
  }

  // Full-width lines cut the page into zones. Within a zone, left then right.
  const cuts: Piece[][] = [];
  for (const p of [...crossing].sort((a, b) => a.y - b.y)) {
    const open = cuts[cuts.length - 1];
    if (open && Math.abs(p.y - open[0].y) <= Math.max(2, p.size * 0.55)) open.push(p);
    else cuts.push([p]);
  }
  const runs: Piece[][] = [];
  const zone = (lo: number, hi: number) => {
    const zl = inLeft.filter(p => p.y > lo && p.y <= hi);
    const zr = inRight.filter(p => p.y > lo && p.y <= hi);
    if (zl.length) runs.push(zl);
    if (zr.length) runs.push(zr);
  };
  let from = -Infinity;
  for (const cut of cuts) {
    const at = Math.min(...cut.map(p => p.y)) - 0.5;
    zone(from, at);
    runs.push(cut);
    from = at;
  }
  zone(from, Infinity);
  lastColumns.push({ page, split: true, why: `gutter ${gutterStart.toFixed(0)}–${gutterEnd.toFixed(0)}, ${runs.length} runs, ${crossing.length} spanning, pair ${pairFrac.toFixed(2)}` });
  return runs.length ? runs : single;
}

/** Pieces on a shared baseline become one line; wide gaps split it into cells. */
function piecesToLines(pieces: Piece[], page: number): Line[] {
  const sorted = [...pieces].sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x));
  const lines: Line[] = [];
  let bucket: Piece[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const ordered = [...bucket].sort((a, b) => a.x - b.x);
    const size = Math.max(...ordered.map(p => p.size));
    const cells: { text: string; x: number; right: number }[] = [];
    for (const p of ordered) {
      const last = cells[cells.length - 1];
      // A gap wider than roughly two characters starts a new cell — this is
      // the alignment clue that makes a real table readable as a table.
      if (last && p.x - last.right < size * 1.1) {
        last.text = `${last.text}${p.x - last.right > size * 0.18 ? ' ' : ''}${p.text}`.replace(/\s+/g, ' ');
        last.right = Math.max(last.right, p.right);
      } else {
        cells.push({ text: p.text.trim(), x: p.x, right: p.right });
      }
    }
    const clean = cells.map(c => ({ ...c, text: c.text.trim() })).filter(c => c.text);
    if (clean.length > 0) {
      lines.push({
        text: clean.map(c => c.text).join('  '),
        cells: clean,
        x: clean[0].x,
        y: ordered[0].y,
        size,
        bold: ordered.some(p => p.bold),
        page,
      });
    }
    bucket = [];
  };

  for (const p of sorted) {
    if (bucket.length === 0) { bucket = [p]; continue; }
    const ref = bucket[bucket.length - 1];
    if (Math.abs(p.y - ref.y) <= Math.max(2, ref.size * 0.55)) bucket.push(p);
    else { flush(); bucket = [p]; }
  }
  flush();
  return lines;
}

/** The strongest saturated colour on the cover, used as the brand candidate. */
function dominantColor(ctx: CanvasRenderingContext2D, w: number, h: number): string | undefined {
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, Math.min(h, Math.round(h * 0.45))).data; } catch { return undefined; }
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4 * 12) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 40 || max < 40 || max > 245) continue; // grey, black, paper
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { n: cur.n + 1, r: cur.r + r, g: cur.g + g, b: cur.b + b });
  }
  const best = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  if (!best || best.n < 25) return undefined;
  const hex = (v: number) => Math.round(v / best.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}

// ═══ Pass 2 — remove furniture ═══════════════════════════════════════════════
// Which lines repeat on every page? Page numbers, "Confidential" footers, the
// running title. They are lifted out of the reading so they are never misread
// as headings, and kept as pre filled settings the user verifies instead of
// types.

function passRemoveFurniture(unpacked: Unpacked): Furnished {
  const { perPage } = unpacked;
  const pages = perPage.length;
  if (pages === 0) return { furniture: null, body: [], headerLines: new Set() };

  const heightOf = (page: Line[]) => Math.max(...page.map(l => l.y), 1);
  // Two lines are "the same line in the same place" when their text matches
  // with the digits masked (page numbers change) and they sit within a few
  // points of each other vertically.
  const slot = (line: Line) => `${Math.round(line.y / POSITION_TOLERANCE)}|${norm(line.text.replace(/\d+/g, '#'))}`;

  // THE FIRST THING PASS 2 DOES: any line that appears in the same position on
  // three or more pages is furniture. A running header, a footer, a page
  // number, a watermark, a letterhead strip. Content does not repeat itself in
  // the same spot page after page, so nothing here is ever content.
  const bySlot = new Map<string, { pages: Set<number>; top: number; text: string }>();
  perPage.forEach((page, pi) => {
    const height = Math.max(heightOf(page), 1);
    const bandTop = height * BAND;
    const inBand = (l: Line) => l.y <= bandTop || l.y >= height * (1 - BAND);
    for (const line of page) {
      // The one exception: a row of three or more aligned cells in the body of
      // the page is a table row, and a table continuing across pages repeats
      // its header row in exactly the same spot. Striking those would take the
      // column names with them. In the margins, three cells is still a running
      // header, so the band is exempt from the exception.
      if (line.cells.length >= 3 && !inBand(line)) continue;
      const key = slot(line);
      if (!key.split('|')[1]) continue;
      const cur = bySlot.get(key) ?? { pages: new Set<number>(), top: 0, text: line.text };
      cur.pages.add(pi);
      if (line.y <= bandTop) cur.top++;
      bySlot.set(key, cur);
    }
  });

  const header: string[] = [];
  const footer: string[] = [];
  /** Position-keyed slots to strike out, and their plain text keys. */
  const strikeSlots = new Set<string>();
  const headerLines = new Set<string>();
  let pageNumberPattern: string | undefined;

  for (const [key, v] of bySlot) {
    if (v.pages.size < REPEAT_PAGES) continue;
    strikeSlots.add(key);
    headerLines.add(key.split('|').slice(1).join('|'));
    if (PAGE_NUMBER.test(v.text.trim())) {
      pageNumberPattern = /of|\//i.test(v.text) ? 'Page N of M' : 'N';
      continue;
    }
    (v.top >= v.pages.size / 2 ? header : footer).push(v.text.trim());
  }

  // Second net, for documents whose furniture drifts a few points down the
  // page: the same short line recurring on most pages, wherever it sits.
  const loose = new Map<string, { count: number; top: number; text: string }>();
  perPage.forEach(page => {
    const bandTop = Math.max(heightOf(page), 1) * BAND;
    const local = new Set<string>();
    for (const line of page) {
      if (line.cells.length > 2 || line.text.length > 120) continue;
      const key = norm(line.text.replace(/\d+/g, '#'));
      if (!key || local.has(key)) continue;
      local.add(key);
      const cur = loose.get(key) ?? { count: 0, top: 0, text: line.text };
      loose.set(key, { count: cur.count + 1, top: cur.top + (line.y <= bandTop ? 1 : 0), text: cur.text });
    }
  });
  const threshold = Math.max(2, Math.ceil(pages * REPEAT_SHARE));
  for (const [key, v] of loose) {
    if (v.count < threshold || headerLines.has(key)) continue;
    headerLines.add(key);
    if (PAGE_NUMBER.test(v.text.trim())) {
      pageNumberPattern = /of|\//i.test(v.text) ? 'Page N of M' : 'N';
      continue;
    }
    (v.top >= v.count / 2 ? header : footer).push(v.text.trim());
  }

  // Single page reports have nothing repeating, which is a valid result.
  const body = perPage.map(page => page.filter(line => {
    if (strikeSlots.has(slot(line))) return false;
    return !headerLines.has(norm(line.text.replace(/\d+/g, '#')));
  }));

  const all = [...header, ...footer];
  const confidentiality = all.map(t => t.match(CONFIDENTIAL)?.[0]).find(Boolean);
  const furniture: ReadFurniture | null = all.length || pageNumberPattern
    ? { header, footer, pageNumberPattern, confidentiality, fields: {} }
    : null;

  markPageContinuations(body);

  return { furniture, body, headerLines };
}

/**
 * A paragraph does not stop at a page break. Once the furniture is gone, the
 * first line of a page is a continuation when it starts mid sentence, or when
 * the page before it ended without finishing one, and no heading sits above
 * it. Those lines join the previous page's last block instead of opening a
 * new one, so one paragraph is never read as two.
 */
function markPageContinuations(body: Line[][]): void {
  for (let pi = 1; pi < body.length; pi++) {
    const first = body[pi][0];
    if (!first) continue;
    const previousPage = body[pi - 1];
    const last = previousPage[previousPage.length - 1];
    if (!last) continue;

    const opensLower = /^["'“‘([]?[a-z]/.test(first.text.trim());
    const previousUnfinished = !/[.!?:;]["'”’)\]]?$/.test(last.text.trim());
    if (!opensLower && !previousUnfinished) continue;
    // A heading of its own is never a continuation, whatever it starts with —
    // and that includes a LETTERED one. "B. Overview of Revenue & Payouts"
    // opens page 4 right after page 3 trails off on a comma, so
    // `previousUnfinished` alone would mark it a continuation and headingOf()
    // would never even be asked about it. The result was a heading silently
    // erased into the paragraph above it, which then absorbed the next
    // section's numbers and failed the fixed-wording gate for containing them.
    const trimmed = first.text.trim();
    const lettered = LETTERED.exec(trimmed);
    if (NUMBERED.test(trimmed) || APPENDIX.test(trimmed) || (lettered && !sentenceish(lettered[2]))) continue;
    if (first.cells.length > 2) continue;                 // a table row carries on as a table

    first.continuation = true;
  }
}

/** Label and value pairs off the cover become pre filled settings. Only the
 *  labels matter; the values are read once so the user can confirm them. */
export function deriveFields(lines: Line[]): ReadFurniture['fields'] {
  const fields: ReadFurniture['fields'] = {};
  for (const line of lines) {
    const pair = line.text.match(/^([A-Za-z][A-Za-z /.'-]{2,32})\s*[::]\s*(.+)$/)
      ?? (line.cells.length === 2 ? [null, line.cells[0].text, line.cells[1].text] as unknown as RegExpMatchArray : null);
    if (!pair) continue;
    const label = String(pair[1]).replace(/[::]\s*$/, '').trim();
    const value = String(pair[2]).trim();
    if (!value || value.length > 90) continue;
    for (const f of FIELD_LABELS) {
      if (f.re.test(label) && !fields[f.key]) fields[f.key] = value;
    }
  }
  return fields;
}

// ═══ Pass 3 — build the tree ═════════════════════════════════════════════════
// Which lines are headings, and in what order? Big, rare, numbered, alone on
// the line. Numbering depth is the level clue: "1." is a section, "1.1" is a
// block inside it, so the document's own nesting is matched rather than
// flattened. "…continued" pages merge back into the section they belong to.

type HeadingHit = { name: string; level: number; evidence: ReadEvidence; confidence: number; appendix: boolean };

function headingOf(line: Line, bodySize: number): HeadingHit | null {
  const text = line.text.trim();
  if (!text || text.length > 110) return null;
  if (line.cells.length > 2) return null;              // a table row, not a heading
  if (BLANK_PAGE.test(text)) return null;              // furniture-adjacent noise
  // Rule 4, pointer resolution. A heading carrying a cross reference is a link
  // to a section, not a section: "Procedures — (see section 7.1)" belongs to
  // the summary list it sits in. It stays a list item under its parent and no
  // second section is created for the same content.
  if (POINTER.test(text)) return null;
  // A date row reads as numbered text ("17 July 2026 …") but numbers a day,
  // not a section, so the guards below apply to numbered lines as well.
  if (!APPENDIX.test(text)) {
    // A heading is a complete line. Half of one is body text, whatever size
    // it is set in, and promoting it shreds a paragraph into sections.
    if (fragmentLine(text)) return null;
    // A line ending in a colon is leading into a list, and a line that is
    // mostly digits is a date or a reference. Neither names a section.
    if (/[.;,:]$/.test(text)) return null;
    // A full stop in the MIDDLE of the line is prose, however big it is set: a
    // heading names a part, it does not finish a sentence and start another.
    // Tested after the section number, so "1. Introduction" still reads as a
    // heading, and only after a lowercase letter or a digit, so "U.S. Payroll"
    // does not lose its heading to an initial. Our own generated summary is the
    // caught case: one sentence of its body came back as a section carrying the
    // rest of the summary inside it.
    if (/[a-z0-9]\.\s+\S/.test(text.replace(/^\s*(\d+(\.\d+)*|[A-Za-z])[.)]\s*/, ''))) return null;
    if (/^[A-Z]{1,3}\d{3,}\b/.test(text)) return null;
    const digits = (text.match(/\d/g) ?? []).length;
    if (digits > text.replace(/\s/g, '').length * 0.4) return null;
    // "Audit of Revenue Recognition — Reasonable assurance (June 2024)" is a
    // list entry: a name, a dash, then its value. Headings do not carry values.
    if (/\s[—–]\s\S/.test(text)) return null;
    if (/\)\s*$/.test(text) && /\s[—–(]/.test(text)) return null;
    // A single word is a fragment of a wrapped line far more often than it is
    // a section, so only the words that really do name sections pass.
    if (text.split(/\s+/).length < 2 && !SINGLE_WORD_SECTION.test(text)) return null;
  }

  const appendix = APPENDIX.exec(text);
  if (appendix) {
    const tail = appendix[3]?.replace(/^[\s—–\-:·]+/, '').trim();
    return {
      name: tail ? `${titleCase(appendix[1])} ${appendix[2]}: ${tail}` : `${titleCase(appendix[1])} ${appendix[2]}`,
      level: 1, evidence: 'explicit', confidence: 0.92, appendix: true,
    };
  }

  const numbered = NUMBERED.exec(text);
  if (numbered && !sentenceish(numbered[2])) {
    const depth = numbered[1].split('.').length;
    return { name: numbered[2].trim(), level: Math.min(depth, 3), evidence: 'explicit', confidence: 0.9, appendix: false };
  }

  // BIGGER *OR* BOLDER, not both. A lettered title needed weight to count, and
  // a report that letters its parts and sets them large but not bold had every
  // one of them read as body text — "B. Overview of Revenue & Payouts" at 14pt
  // over a 9.4pt body, sitting inside the paragraph above it. Size is the same
  // evidence weight is: what the page does to say "this names what follows".
  const lettered = LETTERED.exec(text);
  if (lettered && !sentenceish(lettered[2]) && (line.bold || line.size >= bodySize * HEADING_SIZE)) {
    return { name: lettered[2].trim(), level: 2, evidence: 'inferred', confidence: 0.7, appendix: false };
  }

  const big = line.size >= bodySize * HEADING_SIZE;
  const words = text.split(/\s+/).length;
  const caps = text === text.toUpperCase() && /[A-Z]{3}/.test(text);
  const alone = line.cells.length === 1;

  // Bold alone is not enough. A finding title is bold too, and promoting every
  // bold line is exactly the flat-detection failure: size or capitals have to
  // agree before a line is called a heading.
  if (alone && words <= 12 && (big || caps)) {
    const strong = big && (line.bold || caps);
    return {
      name: titleCaseIfCaps(text),
      level: big ? 1 : 2,
      evidence: strong ? 'explicit' : 'inferred',
      confidence: strong ? 0.85 : 0.6,
      appendix: false,
    };
  }
  return null;
}

/** A shouted line reads better in title case, but the words that are genuinely
 *  abbreviations stay shouted: FY2026 must not become Fy2026. */
export const titleCaseIfCaps = (s: string) =>
  s === s.toUpperCase() && s.length > 3
    ? s.split(/\s+/).map(w => (/\d/.test(w) || w.replace(/\W/g, '').length <= 4 ? w : titleCase(w.toLowerCase()))).join(' ')
    : s;

function passBuildTree(furnished: Furnished, unpacked: Unpacked): Tree {
  const { bodySize } = unpacked;
  const spine: SpineSection[] = [];
  const cover: Line[] = [];
  const skipped: string[] = [];
  let current: SpineSection | null = null;
  let docEntries = 0;
  let inContents = false;

  // A CARD'S FIELD LABEL NEVER OPENS A SECTION. Their findings print the same
  // bold labels once per finding — "Root Cause", "Risk", "Recommendation" — and
  // set larger than the body they read exactly like headings. Promoted, each
  // holds one finding's worth of text, is claimed by nothing, and leaves an
  // empty "Root Cause" part on the review screen that then gets dropped.
  //
  // The tell is recurrence: the same label once per finding. So the labels are
  // counted across the whole document first, and a recurring one is demoted to
  // what it is — a block label inside the stamp.
  const labelUse = new Map<string, number>();
  for (const page of furnished.body) {
    for (const line of page) {
      const hit = line.continuation ? null : headingOf(line, bodySize);
      if (hit && fieldHeading(hit.name)) labelUse.set(norm(hit.name), (labelUse.get(norm(hit.name)) ?? 0) + 1);
    }
  }
  const cardFieldLabel = (name: string) => (labelUse.get(norm(name)) ?? 0) >= 2;

  furnished.body.forEach((page, pi) => {
    for (const line of page) {
      // The report's own contents page is never copied into the template; our
      // export engine rebuilds one. It is read only as the sanity check.
      if (CONTENTS.test(line.text.trim())) { inContents = true; continue; }
      if (inContents) {
        const entry = /\.{3,}\s*\d+$|\s\d{1,3}$/.test(line.text.trim());
        if (entry) { docEntries++; continue; }
        // Two ordinary lines in a row end the contents page.
        if (line.text.trim().length > 60 || headingOf(line, bodySize)) inContents = false;
        else continue;
      }

      // A line that carries on the previous page's sentence is body text, even
      // if its size or capitals would otherwise read as a heading.
      const hit = line.continuation ? null : headingOf(line, bodySize);
      if (!hit) {
        if (current) current.lines.push(line);
        else if (pi === 0) cover.push(line);
        continue;
      }

      // The cover is a letterhead, not the first section. Until the report's
      // own numbering starts, page one is read as cover: its title and its
      // label-and-value pairs become settings, never headings.
      if (!current && pi === 0 && hit.evidence !== 'explicit') { cover.push(line); continue; }
      if (!current && pi === 0 && !hit.appendix && !NUMBERED.test(line.text.trim())) { cover.push(line); continue; }

      // A "…continued" heading, or the same heading again on the next page, is
      // one section spilling over, not two sections.
      const continued = CONTINUED.test(line.text.trim());
      const sameAsCurrent = current && norm(hit.name) === norm(current.name);
      if (current && (continued || sameAsCurrent)) continue;

      // Numbering depth decides the level: a level 2 heading is a block inside
      // the section above it, so sub headings never inflate the section list.
      // A recurring card field label is the same thing by a different route: it
      // is one of the finding's boxes, so it names a block, never a part.
      if ((hit.level > 1 || cardFieldLabel(hit.name)) && current) {
        current.lines.push({ ...line, text: `§§${hit.name}` });
        continue;
      }

      current = {
        name: hit.name,
        level: 1,
        page: line.page,
        evidence: hit.evidence,
        confidence: hit.confidence,
        appendix: hit.appendix,
        wrapper: line.page <= 2 && WRAPPER.test(line.text),
        lines: [],
      };
      spine.push(current);
    }
  });

  const resolved = unswallow(foldLookAlikes(spine), cardFieldLabel);

  // A heading with no prose beneath it is not a section. It is never dropped in
  // silence either: the caller offers it back.
  const kept: SpineSection[] = [];
  for (const s of resolved) {
    const prose = s.lines.some(l => !l.text.startsWith('§§') && l.text.trim().length > 3);
    if (prose) kept.push(s);
    else skipped.push(s.name);
  }

  const detected = Math.min(kept.length, SECTION_CAP);
  const toc: ReadTocCheck | undefined = docEntries > 0
    ? {
      docEntries,
      detected,
      // Relative, never absolute. Only a big gap either way is a real signal.
      verdict: detected > docEntries * 1.5 ? 'over-split'
        : detected < docEntries * 0.6 ? 'under-detected'
          : 'match',
    }
    : undefined;

  return { spine: kept.slice(0, SECTION_CAP), skipped, cover, toc };
}

/**
 * Takes the rating letter off the end of a heading, on the spine and on the
 * buried §§ markers alike, and hands the original line to `rated` so the run
 * still reads as rated.
 *
 * Deliberately narrow, because a trailing capital is not always a rating.
 * It only fires when the client's own scale gives at least two distinct
 * initials to match against, and only on a heading of three words or more:
 * "Annexure A" and "Part B" are NAMED by their letter and keep it.
 */
function stripTitleRatings(
  spine: SpineSection[],
  scale: string[] | undefined,
  rated: string[],
): SpineSection[] {
  const initials = new Set((scale ?? []).map(w => w.trim().charAt(0).toUpperCase()).filter(Boolean));
  if (initials.size < 2) return spine;
  /** The title without its letter, or null when the letter is part of the name. */
  const shorn = (name: string): string | null => {
    const m = /^(.*\S)\s+[([]?([A-Za-z])[)\]]?[.\s]*$/.exec(name);
    if (!m || !initials.has(m[2].toUpperCase())) return null;
    const head = m[1].trim();
    return head.split(/\s+/).length >= 3 ? head : null;
  };
  return spine.map(s => {
    const name = shorn(s.name);
    if (name) rated.push(s.name);
    const lines = s.lines.map(l => {
      if (!l.text.startsWith('§§')) return l;
      const inner = shorn(l.text.slice(2));
      if (!inner) return l;
      rated.push(l.text.slice(2));
      return { ...l, text: `§§${inner}` };
    });
    return name || lines !== s.lines ? { ...s, name: name ?? s.name, lines } : s;
  });
}

/**
 * THE SWALLOW GUARD — a section that IS the document is a mis-ranked heading,
 * never a verdict.
 *
 * A lettered opener ("A. Introduction and background") lands before any
 * numbering has started, so it becomes the first top-level section, and every
 * properly numbered heading after it ranks below and folds inside as a §§
 * marker. One section then holds twenty-one pages, and whatever verdict it gets
 * it gets for the whole report: kept, and the template is one enormous part;
 * dropped, and the template is empty. Both shipped.
 *
 * So the tree is re-ranked rather than judged. The buried markers come back up
 * as the parts they always were, and the opener keeps only the lines that were
 * genuinely its own.
 *
 * Two markers are NOT parts and stay buried, because promoting them is the
 * failure this guard would otherwise cause on a findings-heavy report: a card's
 * field label (already demoted by recurrence upstream), and any name appearing
 * more than once inside the host, which is a stamp's label by the same logic.
 * With fewer than two real parts left to promote there is nothing to re-rank
 * and the tree is returned untouched.
 */
function unswallow(spine: SpineSection[], isFieldLabel: (name: string) => boolean): SpineSection[] {
  const total = spine.reduce((n, s) => n + s.lines.length, 0);
  // Below this a "share of the document" means nothing — a four-page memo's
  // one real section legitimately holds most of it.
  if (total < 40) return spine;
  const idx = spine.findIndex(s => s.lines.length >= total * 0.7);
  if (idx < 0) return spine;
  const host = spine[idx];

  const uses = new Map<string, number>();
  for (const l of host.lines) {
    if (l.text.startsWith('§§')) {
      const n = norm(l.text.slice(2));
      uses.set(n, (uses.get(n) ?? 0) + 1);
    }
  }
  const promotable = (name: string) => !isFieldLabel(name) && (uses.get(norm(name)) ?? 0) === 1;
  const cuts = host.lines.filter(l => l.text.startsWith('§§') && promotable(l.text.slice(2)));
  if (cuts.length < 2) return spine;

  const rebuilt: SpineSection[] = [];
  // The opener's own lines, under its own name. Often empty, which is correct:
  // a heading that held nothing but other headings is a group marker, and the
  // prose filter downstream offers it back rather than inventing a part.
  let open: SpineSection = { ...host, lines: [] };
  for (const line of host.lines) {
    if (line.text.startsWith('§§') && promotable(line.text.slice(2))) {
      rebuilt.push(open);
      open = {
        name: line.text.slice(2),
        level: 1,
        page: line.page,
        evidence: 'inferred',
        confidence: 0.6,
        appendix: host.appendix,
        wrapper: false,
        lines: [],
      };
      continue;
    }
    open.lines.push(line);
  }
  rebuilt.push(open);

  return [...spine.slice(0, idx), ...rebuilt, ...spine.slice(idx + 1)];
}

/**
 * The look-alike traps: things that resemble a section but are not one.
 *
 *  · A run of three or more bare headings with nothing beneath them is a LIST,
 *    not three sections. Glossary terms, a summary's preview bullets and the
 *    rows of a definitions table all arrive in exactly this shape, so they fold
 *    back into the section above them as content.
 *  · Two sections with the same title, or a title that only differs by its
 *    cross-reference suffix, are one section written twice. Rule 4's backstop:
 *    merge them and flag the survivor so the user takes a look.
 */
function foldLookAlikes(spine: SpineSection[]): SpineSection[] {
  const hasProse = (s: SpineSection) => s.lines.some(l => !l.text.startsWith('§§') && l.text.trim().length > 3);

  // Fold runs of bare headings into the section that carries them.
  const folded: SpineSection[] = [];
  let i = 0;
  while (i < spine.length) {
    let run = 0;
    while (i + run < spine.length && !hasProse(spine[i + run])) run++;
    if (run >= 3 && folded.length > 0) {
      const parent = folded[folded.length - 1];
      for (let k = 0; k < run; k++) {
        const item = spine[i + k];
        parent.lines.push({ text: item.name, cells: [{ text: item.name, x: 0, right: 0 }], x: 0, y: 0, size: 0, bold: false, page: item.page });
        parent.lines.push(...item.lines);
      }
      i += run;
      continue;
    }
    folded.push(spine[i]);
    i++;
  }

  // Two sections with one title are one of two different things, and telling
  // them apart is the whole job here:
  //
  //   TWINS   the same content reached two ways — a pointer and its target, or
  //           a title repeated with a cross-reference suffix. Merge them, and
  //           flag the survivor so the client confirms the merge.
  //   A STAMP the same shape holding DIFFERENT content — "Findings" once per
  //           warehouse, per location, per audit. That is a repeat one level
  //           up: one section, stamped once per group. Three warehouses must
  //           not become three sections, and must not be merged into one
  //           either, which would throw two thirds of the report away.
  const byTitle = new Map<string, SpineSection>();
  const out: SpineSection[] = [];
  for (const s of folded) {
    const key = norm(s.name.replace(POINTER, '').replace(/[()—–\-:,]+\s*$/, ''));
    const first = key ? byTitle.get(key) : undefined;
    if (first) {
      if (sameContent(first, s)) {
        first.lines.push(...s.lines);
        first.evidence = 'inferred';
        first.confidence = Math.min(first.confidence, 0.6);
        first.twin = true;
      } else {
        // A stamp keeps the shape once and the count with it. The first
        // repetition is the shape; nothing from the rest is stored, which is
        // what keeps the template free of their content.
        first.stamp = [...(first.stamp ?? [first.lines]), s.lines];
      }
      continue;
    }
    if (key) byTitle.set(key, s);
    out.push(s);
  }
  return out;
}

/** Are these two same-named sections the same words, or the same shape around
 *  different words? Overlap of the words they use, which separates a
 *  cross-reference from a per-location repeat without reading either. */
function sameContent(a: SpineSection, b: SpineSection): boolean {
  const words = (s: SpineSection) => new Set(norm(s.lines.map(l => l.text).join(' ')).split(' ').filter(w => w.length > 3));
  const wa = words(a), wb = words(b);
  if (wa.size === 0 || wb.size === 0) return true;         // nothing to tell apart
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) > 0.6;
}

// ═══ Pass 4 — classify blocks ════════════════════════════════════════════════
// Inside a section, what is each chunk? Geometry answers, not vocabulary:
// aligned columns are a table, big numbers with small captions are a stat
// strip, a short label with a value is a slot, an indented note is a callout,
// everything else is prose.

export function passClassifyBlocks(section: SpineSection, bodySize: number): RawBlock[] {
  const blocks: RawBlock[] = [];
  const lines = section.lines;
  let i = 0;
  let subLabel: string | undefined;

  const pushNarrative = (buf: Line[]) => {
    if (buf.length === 0) return;
    blocks.push({
      kind: 'narrative',
      label: subLabel,
      confidence: 0.9,
      page: buf[0].page,
      lines: buf.map(l => l.text),
    });
    subLabel = undefined;
  };

  let prose: Line[] = [];
  while (i < lines.length) {
    const line = lines[i];

    // A column boundary ends whatever paragraph was running. Flushed before
    // anything else reads the line, because the line itself is ordinary — it is
    // only its position, at the head of a new column, that says the prose above
    // it has finished.
    // …unless the line genuinely finishes the sentence the page before left
    // open, which the continuation rule below already knows how to place.
    if (line.columnBreak && !line.continuation && prose.length > 0) { pushNarrative(prose); prose = []; }

    // The page break rule: this line finishes the sentence the previous page
    // left open, so it joins that page's last block instead of starting one.
    if (line.continuation) {
      if (prose.length > 0) { prose.push(line); i++; continue; }
      const previous = blocks[blocks.length - 1];
      if (previous) { previous.lines.push(line.text); i++; continue; }
    }

    // A sub heading kept from pass 3 labels the block that follows it.
    if (line.text.startsWith('§§')) {
      pushNarrative(prose); prose = [];
      subLabel = line.text.slice(2).trim();
      i++;
      continue;
    }

    // Table: two or more consecutive rows sharing at least two columns.
    const run = tableRun(lines, i);
    if (run > 1) {
      const rows = lines.slice(i, i + run);
      const head = rows[0];
      // Column names come from the header row only when it reads like one:
      // short labels, no numbers, no sentences. A first data row would
      // otherwise be saved as the column names, which is worse than none.
      const looksLikeHeader = head.cells.every(c =>
        c.text.split(/\s+/).length <= 4 && c.text.length <= 40 && !isNumeric(c.text));
      let columns = looksLikeHeader && (head.bold || head.text === head.text.toUpperCase() || rows.length > 2)
        ? head.cells.map(c => titleCaseIfCaps(c.text)).filter(Boolean)
        : undefined;

      // A MERGED header hides the real column names one row down: "Rating"
      // spanning three columns, with High / Medium / Low underneath it. Keeping
      // only the top row would lose exactly the names that say what the table
      // holds, so a spanned cell takes its names from the row below.
      const spans = head.spans;
      if (columns && spans?.some(n => n > 1) && rows[1]) {
        // Positional, blanks and all: the cell under a merged header is empty,
        // and dropping it shifts every sub-name one column left.
        const sub = rows[1].cells.map(c => titleCaseIfCaps(c.text));
        const flat: string[] = [];
        let si = 0;
        columns.forEach((name, ci) => {
          const span = spans[ci] ?? 1;
          if (span <= 1) { flat.push(name || sub[si] || ''); si += 1; return; }
          for (let k = 0; k < span; k++) flat.push(sub[si + k] || `${name} ${k + 1}`);
          si += span;
        });
        const clean = flat.filter(Boolean);
        if (clean.length >= columns.length) columns = clean;
      }

      // A header WRAPPED ABOVE THE TABLE. A narrow column makes its name wrap
      // onto two or three lines — "Rating" over "High/Medium/Low)" over the row
      // of "# · Observation · Repeat/New" — and each of those lines lands in the
      // prose above the table instead of in its header row. The table then has
      // no column names at all, which is what left a findings table looking like
      // an unclaimable grid. The names are recovered by POSITION: a cell sitting
      // over a column belongs to that column.
      if (!columns) {
        const recovered = headerAbove(prose, head);
        // Those lines were the header, so they leave the prose. Whatever came
        // before them is still prose and keeps its place above the table.
        if (recovered) {
          columns = recovered.columns;
          prose = prose.slice(0, prose.length - recovered.used);
        }
      }
      pushNarrative(prose); prose = [];

      blocks.push({
        kind: 'table',
        label: subLabel,
        columns: columns && columns.length >= 2 ? columns : undefined,
        // The merge pattern is part of the table's shape, so a merged header
        // comes out merged. Only a deck states it; a PDF never can.
        columnSpans: columns && head.spans?.some(n => n > 1) ? head.spans : undefined,
        confidence: columns ? 0.85 : 0.62,
        page: head.page,
        lines: rows.map(r => r.text),
      });
      subLabel = undefined;
      i += run;
      continue;
    }

    // Stat strip: a row of numbers with a caption row above or below. This and
    // a tiny two column table look almost identical, so confidence stays low
    // and the review screen surfaces it.
    const stat = statAt(lines, i, bodySize);
    if (stat) {
      pushNarrative(prose); prose = [];
      blocks.push({ kind: 'stat', label: subLabel, slotLabels: stat.captions, confidence: 0.6, page: line.page, lines: stat.lines });
      subLabel = undefined;
      i += stat.consumed;
      continue;
    }

    // Slot: a short label with a value beside it. The label survives, the value
    // is thrown away, which is exactly the fill in the blank shape.
    const slots = slotRun(lines, i);
    if (slots) {
      pushNarrative(prose); prose = [];
      blocks.push({ kind: 'slot', label: subLabel, slotLabels: slots.labels, confidence: 0.75, page: line.page, lines: slots.lines });
      subLabel = undefined;
      i += slots.consumed;
      continue;
    }

    // Callout: text set apart as a note or key message — and a COMPLETE one.
    // The same fragment test the headings use, for the same reason: "important
    // to recognize that there are inherent limitations in the" is the middle of
    // a sentence whose line happens to start on that word, and taking it for a
    // callout cut PwC's limitation paragraph in half. The remaining 22 lines
    // then opened mid-sentence and stopped reading as the fixed wording they
    // are, so the disclaimer went into the template as nothing at all.
    if (/^(note|important|key (message|point)|please note|caution|disclaimer)\b/i.test(line.text)
      && !fragmentLine(line.text)) {
      pushNarrative(prose); prose = [];
      blocks.push({ kind: 'callout', label: subLabel, confidence: 0.65, page: line.page, lines: [line.text] });
      subLabel = undefined;
      i++;
      continue;
    }

    // A SHORT LINE NAMING A FIXED-WORDING CONCEPT IS A LABEL, NOT PROSE.
    // "Limitation" sits on its own line above nineteen lines of boilerplate and
    // below the tail of an approach list. It is not set any bigger than the
    // body, so pass 3 never saw a heading, and the paragraph it opens stayed
    // glued to the list above it — one mixed block, claimable as nothing. This
    // is the block-level form of the rule the section level already applies:
    // test what is inside a mixed part, and boilerplate inside it stays as
    // fixed wording. It labels the block that follows, the way a §§ sub heading
    // does, so nothing is thrown away.
    const bare = line.text.trim();
    if (bare.split(/\s+/).length <= 4 && !/[.:,;]$/.test(bare)
      && (FRAME_NAME.test(bare) || FIXED_NAME.test(bare))) {
      pushNarrative(prose); prose = [];
      subLabel = bare;
      i++;
      continue;
    }

    prose.push(line);
    i++;
  }
  pushNarrative(prose);

  // A section made only of a signature list is a sign off block, roles kept.
  if (SIGNOFF.test(section.name)) {
    const roles: string[] = [];
    const add = (role: string) => {
      const clean = role.replace(/\s+/g, ' ').trim();
      // Their casing, kept: "Head of Internal Audit", never "Head Of Internal
      // Audit". The role labels are the whole point of the block.
      if (clean && !roles.some(r => norm(r) === norm(clean))) roles.push(clean);
    };
    for (const l of lines) {
      // A signature row: two to four short title cells side by side, at least
      // one of which reads like a role. This is how sign-off pages are laid
      // out, and it carries the roles a plain phrase match misses.
      if (l.cells.length >= 2 && l.cells.length <= 4
        && l.cells.every(c => c.text.length <= 44 && c.text.split(/\s+/).length <= 5 && /^[A-Z]/.test(c.text))
        && l.cells.some(c => ROLE_TITLE.test(c.text))) {
        l.cells.forEach(c => add(c.text));
        continue;
      }
      const m = l.text.match(ROLE);
      if (m) add(m[0]);
    }
    if (roles.length) return [{ kind: 'signoff', signRoles: roles, confidence: 0.85, page: section.page, lines: [] }];
  }

  return blocks;
}

/**
 * A table header that WRAPPED onto the lines above the table.
 *
 * A narrow column makes its name wrap, and each wrapped piece lands as its own
 * line above the first row, so the table itself has no header. The pieces are
 * put back by position: a cell sitting over a column belongs to that column,
 * top line first. Nothing is invented — every word comes from their own header.
 */
function headerAbove(prose: Line[], head: Line): { columns: string[]; used: number } | null {
  if (head.cells.length < 3) return null;
  // Only the last few lines, and only header-shaped ones: short labels, no
  // sentences, no values.
  const candidates: Line[] = [];
  for (let k = prose.length - 1; k >= 0 && candidates.length < 3; k--) {
    const line = prose[k];
    const shortEnough = line.cells.every(c => c.text.split(/\s+/).length <= 4 && c.text.length <= 34);
    if (!shortEnough || /[.;]$/.test(line.text.trim()) || line.cells.some(c => isNumeric(c.text))) break;
    candidates.unshift(line);
  }
  if (candidates.length === 0) return null;

  const names: string[][] = head.cells.map(() => []);
  let placed = 0;
  for (const line of candidates) {
    for (const cell of line.cells) {
      // Nearest column by left edge, and only if it really sits over one.
      let best = -1;
      let distance = Infinity;
      // The column this piece sits over. No distance cap: a header is often
      // centred over a wide column, so it can sit a long way from the column's
      // left edge and still plainly belong to it. Being nearer to this column
      // than to any other is the whole test.
      head.cells.forEach((column, ci) => {
        const d = Math.abs(column.x - cell.x);
        if (best < 0 || d < distance) { distance = d; best = ci; }
      });
      if (best < 0) continue;
      names[best].push(cell.text.trim());
      placed++;
    }
  }
  if (placed < 2) return null;

  const columns = names.map(parts => titleCaseIfCaps(parts.join(' ').replace(/\s+/g, ' ').trim()));
  return columns.filter(Boolean).length >= 2
    ? { columns: columns.map((c, i) => c || `Column ${i + 1}`), used: candidates.length }
    : null;
}

/** How many consecutive lines from `i` read as one table. */
function tableRun(lines: Line[], i: number): number {
  const first = lines[i];
  // Wrapped prose can fall into two cells by accident, so a table row also has
  // to be made of short cells, not sentences.
  const cellish = (l: Line) => l.cells.length >= 2 && l.cells.filter(c => c.text.length <= 60).length >= 2;
  if (!first || !cellish(first)) return 0;
  let n = 1;
  while (i + n < lines.length) {
    const next = lines[i + n];
    if (next.text.startsWith('§§') || !cellish(next)) break;
    // Columns line up when a cell starts near a cell of the first row.
    const aligned = next.cells.filter(c => first.cells.some(f => Math.abs(f.x - c.x) < 12)).length;
    if (aligned < Math.min(2, first.cells.length)) break;
    n++;
  }
  return n;
}

/** A stat strip: a numbers row plus its captions. */
function statAt(lines: Line[], i: number, bodySize: number): { captions: string[]; lines: string[]; consumed: number } | null {
  const line = lines[i];
  if (!line || line.cells.length < 2) return null;
  const numeric = line.cells.filter(c => isNumeric(c.text)).length;
  if (numeric < 2 || numeric < line.cells.length - 1) return null;
  if (line.size < bodySize * 1.2) return null;         // big numbers, not a data row
  const next = lines[i + 1];
  const captions = next && next.cells.length >= numeric && next.cells.every(c => c.text.split(/\s+/).length <= 4)
    ? next.cells.map(c => titleCaseIfCaps(c.text))
    : [];
  return { captions, lines: [line.text, ...(captions.length ? [next.text] : [])], consumed: captions.length ? 2 : 1 };
}

/** A run of label and value pairs. */
function slotRun(lines: Line[], i: number): { labels: string[]; lines: string[]; consumed: number } | null {
  const labels: string[] = [];
  const used: string[] = [];
  let n = 0;
  while (i + n < lines.length) {
    const line = lines[i + n];
    if (line.text.startsWith('§§')) break;
    const inline = line.text.match(/^([A-Za-z][A-Za-z /.'-]{2,34})\s*[::]\s*(\S.+)$/);
    const twoCell = line.cells.length === 2 && line.cells[0].text.length <= 34 && !sentenceish(line.cells[1].text);
    if (!inline && !twoCell) break;
    labels.push(titleCaseIfCaps((inline ? inline[1] : line.cells[0].text).replace(/[::]\s*$/, '').trim()));
    used.push(line.text);
    n++;
  }
  return n >= 2 ? { labels, lines: used, consumed: n } : null;
}

// ═══ Pass 5 — spot repeats ═══════════════════════════════════════════════════
// Does any shape appear more than once? Save it once and mark it as repeating.
// Two findings or two hundred, the template stores the shape and never the
// count, so the next report can stamp three or thirty.

export function passSpotRepeats(blocks: RawBlock[]): RawBlock[] {
  // A run of same shaped blocks carrying finding IDs is one repeating card.
  const ids = blocks.flatMap(b => b.lines.map(l => l.match(FINDING_ID)?.[0]).filter(Boolean) as string[]);
  // Distinct IDs, not occurrences: the same reference quoted twice in one
  // paragraph is a mention, while two different IDs are two stamped cards.
  const patterns = new Map<string, Set<string>>();
  for (const id of ids) {
    const key = generalisePattern(id);
    (patterns.get(key) ?? patterns.set(key, new Set()).get(key)!).add(id);
  }
  const best = [...patterns.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  const idPattern = best?.[0];
  const idCount = best?.[1].size ?? 0;

  const out: RawBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const sig = signature(blocks[i]);
    let n = 1;
    while (i + n < blocks.length && signature(blocks[i + n]) === sig) n++;

    if (n >= 2 && blocks[i].kind === 'table') {
      // One table split across pages is still one table. Repeating rows are
      // what a table already does, so it never becomes a card.
      out.push({ ...blocks[i], lines: blocks.slice(i, i + n).flatMap(b => b.lines) });
      i += n;
      continue;
    }
    if (n >= 2 && blocks[i].kind !== 'narrative') {
      // Same shape twice or more: one card, count discarded.
      out.push({ ...blocks[i], kind: 'cards', cardCount: n, lines: blocks[i].lines, confidence: 0.8 });
      i += n;
      continue;
    }
    out.push(blocks[i]);
    i++;
  }

  // Findings written as prose still repeat: the ID pattern is the giveaway.
  if (idPattern && idCount >= 2) {
    const first = out.findIndex(b => b.lines.some(l => FINDING_ID.test(l)));
    // A TABLE keyed by the finding IDs is the action-plan pattern: it is built
    // from the findings, not a second stack of finding cards. It keeps its
    // columns and is marked as derived instead of being restamped.
    if (first >= 0 && (out[first].kind === 'table' || out[first].kind === 'stat')) {
      out[first] = { ...out[first], idPattern, cardCount: idCount, linkedTo: out[first].linkedTo ?? 'findings' };
    } else if (first >= 0 && out[first].kind !== 'cards') {
      const fields = cardFieldsFrom(out.slice(first).flatMap(b => b.lines));
      out[first] = {
        ...out[first],
        kind: 'cards',
        idPattern,
        cardCount: idCount,
        cardFields: fields.fields.length ? fields.fields : undefined,
        humanFields: fields.human.length ? fields.human : undefined,
        confidence: 0.78,
      };
    } else if (first >= 0) {
      out[first] = { ...out[first], idPattern, cardCount: idCount };
    }
  }
  return out;
}

const signature = (b: RawBlock) =>
  `${b.kind}:${(b.columns ?? []).join('|')}:${(b.slotLabels ?? []).length}`;

/** The field labels a finding card carries, and the ones only a person fills. */
export function cardFieldsFrom(lines: string[]): { fields: string[]; human: string[] } {
  const known = [
    'Condition', 'Criteria', 'Cause', 'Effect', 'Impact', 'Observation', 'Risk',
    'Risk rating', 'Rating', 'Recommendation', 'Owner', 'Responsibility',
    'Due date', 'Target date', 'Management response', 'Agreed action', 'Status',
  ];
  const humanOnly = /^(management response|agreed action|owner|responsibility|due date|target date)$/i;
  const fields: string[] = [];
  const human: string[] = [];
  for (const label of known) {
    const re = new RegExp(`^\\s*${label}\\s*[::]`, 'i');
    if (!lines.some(l => re.test(l))) continue;
    fields.push(label);
    if (humanOnly.test(label)) human.push(label);
  }
  return { fields, human };
}

// ═══ Pass 6 — the two detectors ══════════════════════════════════════════════
//
// V1 keeps exactly two kinds of section: the ones that FILL FROM AUDIT DATA and
// the ones that are FIXED TEXT. Everything else is dropped from the template
// and said once, honestly, at review. There is no "who fills this?" question to
// answer, because a template that keeps a section we cannot fill is a template
// full of empty boxes. Anything else the client wants in a report they add per
// report through Add Observation, a flow that already exists.
//
// The template is their skin on our data.

/** Headings that name something our generator already produces. Wording is a
 *  weak signal on its own, which is why it is paired with position below: a
 *  rollup of recommendations comes AFTER the findings it rolls up. */
const CONCEPT_TITLES: { re: RegExp; binding: DataBinding; word: string; needsPosition: boolean }[] = [
  // Titles that say "rollup" outright. A report may summarise its
  // recommendations before it details them, so these do not depend on order,
  // only on the report having findings to roll up at all.
  { re: /\b(summary of recommendations?|recommendations? summary|summary of actions?|action plan|agreed actions?|management actions?|management response summary)\b/i, binding: 'actions', word: 'recommendations', needsPosition: false },
  { re: /\b(summary of (findings?|observations?|exceptions?)|findings? summary)\b/i, binding: 'findings', word: 'findings', needsPosition: false },
  // A summary that restates the findings, the counts and the recommendations is
  // worked out from things we hold, so we can write it. The formal OPINION is
  // not: a verdict on the engagement is decided before the queries run, so
  // "Audit opinion" and "Basis for our opinion" are deliberately absent here.
  { re: /\b(executive summary|summary of the audit|overall summary|management summary)\b/i, binding: 'summary', word: 'summary', needsPosition: false },
  // A bare "Recommendations" heading could be the client's own advice, so this
  // one leans on position: after the findings, it is a rollup of them.
  { re: /\b(recommendations?|grading of (audit )?recommendations?)\b/i, binding: 'actions', word: 'recommendations', needsPosition: true },
];

/**
 * The concept a heading names. Wording alone is weak, so it is read together
 * with the report itself: an explicit rollup title counts whenever the report
 * has findings to roll up, and a bare one counts once the findings have
 * already appeared above it.
 */
function conceptOf(
  sectionName: string, findingsSeen: boolean, docHasFindings: boolean,
): { binding: DataBinding; word: string } | undefined {
  const hit = CONCEPT_TITLES.find(c => c.re.test(sectionName));
  if (!hit) return undefined;
  if (hit.needsPosition ? !findingsSeen : !docHasFindings) return undefined;
  return { binding: hit.binding, word: hit.word };
}

type Detected =
  | { keep: 'query'; binding?: DataBinding; why: string; flag?: CheckReason; fixedBody?: undefined; frame?: undefined; authored?: undefined }
  /** `fixedBody` overrides the raw lines when the wording is kept as a FRAME:
   *  their sentence with the report details turned into blanks. */
  | { keep: 'fixed'; why: string; flag?: CheckReason; fixedBody?: string[]; frame?: boolean; authored?: boolean }
  | { keep: null; why: string; flag?: undefined; fixedBody?: undefined; frame?: undefined; authored?: undefined };

/** Context both detectors read: the report's own rating words, its finding
 *  reference shape, and how often a block's text appears in the document. */
type DetectContext = {
  scale?: string[];
  /** Organisations this report names, read from its letterhead and cover. */
  orgNames?: string[];
  /** Both scales the report speaks: finding ratings AND opinion levels. A
   *  legend table is built from either. */
  definitionWords?: string[];
  idPattern?: string;
  /** Normalised block text → how many times it appears in the report. */
  repeats: Map<string, number>;
  sectionName: string;
  /** What the HEADING says this section is, when it names a concept we
   *  generate, and whether its position agrees (a recommendations rollup sits
   *  after the findings, not before them). */
  concept?: { binding: DataBinding; word: string };
  /** Every line in the report that carries a rating word, so a part with no
   *  rating on it can still be rated BY the summary table that lists it. */
  ratedLines?: string[];
  /** This section is an annexure the findings point at ("Refer Annexure 1.1"),
   *  so a table inside it is the evidence behind a finding. */
  evidenceTarget?: boolean;
  /** This section is the scope, where a list of what was covered can be
   *  drafted from the category tags the report's queries carry. */
  scopeSection?: boolean;
  /** This section is a legend: two or more of their scale words, each with its
   *  explanation, counted across the whole section. A definitions page comes
   *  apart into a block per level in the read, so a single row inside such a
   *  section is still part of the legend and is kept whole as fixed wording. */
  definitionSection?: boolean;
  /** The report's own details, so wording whose only changing values are those
   *  can be kept as a fixed frame with blanks instead of being thrown away. */
  details?: ReadFurniture['fields'];
};

const bodyKey = (lines: string[]) => norm(lines.join(' ')).slice(0, 160);

/** Values that change from one report to the next. Fingerprint 1 of detector 2
 *  is the gate: one of these inside a block and it is not fixed text. */
/** The only figures a template may hold: a duration that states a rule ("within
 *  90 days"), and a list number. Everything else with a digit in it is this
 *  report's data, not the client's format. */
const RULE_FIGURE = /\b\d{1,3}\s?(?:calendar\s|working\s|business\s)?(?:day|days|week|weeks|month|months|year|years)\b/gi;
const LIST_NUMBER = /(?:^|\n)\s*\(?\d{1,2}[.)]\s/g;

/** An organisation this report names. Any of them, and the wording belongs to
 *  one report rather than to the format. */
/** CASE MATTERS. "Carlsberg India Private Limited" is a company; "during the
 *  limited time available" is a sentence, and a case-insensitive version of
 *  this pattern reads the second as the first — which quietly turned whole
 *  paragraphs of boilerplate into "this report's data". */
const ORG_NAME = /\b[A-Z][\w&.'’-]*(?:\s+(?:[A-Z][\w&.'’-]*|and|of|&))*\s+(Limited|Ltd\.?|Inc\.?|PLC|Plc|LLP|LLC|GmbH|S\.A\.|Corporation|Corp\.?|Company|Pvt\.?|Private Limited|Holdings|Group)\b/;
/** The bit of a company name that is the company FORM rather than the company:
 *  what to take off to get from "Acme Holdings Private Limited" to "Acme
 *  Holdings", which is what its own boilerplate calls it. */
const CORPORATE_SUFFIX = /[\s,]+(private\s+limited|pvt\.?\s*ltd\.?|public\s+limited|limited|ltd\.?|inc\.?|plc|llp|llc|gmbh|corporation|corp\.?|company|holdings|group)\.?$/i;
/** The same, for swapping every mention in a block out for the blank. */
const ORG_NAME_ALL = new RegExp(ORG_NAME.source, 'g');
/** Somebody's name, with the title a report gives it. */
const PERSON_NAME = /\b(Mr|Mrs|Ms|Dr|Shri|Smt|Prof)\.?\s+[A-Z][a-z]/;
/** A reference code: IA/FY26/FC-04, J2601, ITGC-03. */
const REFERENCE_CODE = /\b[A-Z]{1,5}\/[A-Z0-9]{2,}(?:\/[A-Z0-9-]+)*\b|\b[A-Z]{2,6}-\d{1,4}\b|\b[A-Z]\d{4,}\b/;

/**
 * Fingerprint 1, the gate. A block is fixed text only if it carries no number,
 * date, reference or organisation name that changes from one report to the
 * next. Anything that does, and that no audit-data check claimed, is dropped
 * rather than kept: printing last quarter's figures as this quarter's
 * boilerplate is the worst thing the template could do.
 */
function hasVariableData(text: string, orgNames: string[] = [], framed = false): boolean {
  // Strip the two figures a format is allowed to state, then any digit still
  // standing is a value from this particular report.
  const stripped = text.replace(RULE_FIGURE, ' ').replace(LIST_NUMBER, ' ');
  if (/\d/.test(stripped)) return true;
  if (FINDING_ID.test(text) || REFERENCE_CODE.test(text)) return true;
  // A month only counts as a changing value when it is part of a DATE. Two
  // reasons: "may" is an ordinary word ("the same may not be tested"), and a
  // month left stranded by a period that wrapped across two lines has already
  // had its day and year turned into blanks.
  if (new RegExp(`\\b${MONTH}\\w*\\s*[,'’]?\\s*\\d`).test(text)) return true;
  if (new RegExp(`\\d\\s*(?:st|nd|rd|th)?\\s+${MONTH}\\b`, 'i').test(text)) return true;
  if (/[₹$£€]/.test(text)) return true;
  // A FRAME EXISTS TO BLANK THE CLIENT'S NAME, so the name must not then veto
  // the frame. The tokeniser works line by line and a name the layout broke in
  // half ("Board of Directors of Paytm E-" / "Commerce management") survives it
  // untouched — and one unreachable half was enough to throw away a whole
  // limitation paragraph the memo names as textbook fixed wording. People are
  // still content and still veto: a name below is this report's team, not its
  // letterhead.
  if (!framed && ORG_NAME.test(text)) return true;
  // A person is this report's content, always: the people interviewed, the
  // owners, the team on the engagement. Keeping their names as fixed wording
  // would print last quarter's team into every report from then on.
  if (PERSON_NAME.test(text)) return true;
  return orgNames.some(name => name.length > 3 && text.toLowerCase().includes(name.toLowerCase()));
}

/** Every way a report writes a month, long or short. */
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/** Headings whose wording is a frame the client fills in each report: the same
 *  paragraph every quarter, with their name, the period and the dates in it. */
const FRAME_NAME = /\b(introduction|background|limitations?|disclaimer|purpose|about (this|the) (report|review|audit)|basis|scope of (this|the|our) (report|work|review)|confidentiality|distribution)\b/i;

/** A line about what was NOT looked at. A decision taken before the queries
 *  ran, so no query list can reconstruct it. */
const OUT_OF_SCOPE = /\b(out of scope|not (in scope|covered|included|examined|reviewed)|excluded from|exclusions?|we did not (review|examine|test))\b/i;

/** The scope section, where the list of what WAS covered can be drafted from
 *  the category tags the report's queries carry. */
const SCOPE_NAME = /\b(scope|coverage|areas? (covered|reviewed)|processes? covered|in[\s-]?scope|sub[\s-]?processes)\b/i;

/**
 * A fixed frame: their wording kept exactly, with the spots that change from
 * report to report turned into blanks we fill.
 *
 * Only report details qualify — the client's name, the report title, the
 * period, the dates, the reference, the author. Those are things Irame holds
 * about every report it makes, so the sentence survives intact and stays true.
 * Anything else that changes (a count, an amount, a finding reference) still
 * fails the gate, which is what stops last quarter's numbers printing forever.
 */
function frameOf(lines: string[], ctx: DetectContext): { lines: string[]; text: string } | null {
  const details = ctx.details ?? {};
  const swaps: { value: string; token: string }[] = [
    { value: details.auditTitle ?? '', token: '{{title}}' },
    { value: details.auditEntity ?? '', token: '{{entity}}' },
    { value: details.auditPeriod ?? '', token: '{{period}}' },
    { value: details.preparedBy ?? '', token: '{{preparedBy}}' },
    { value: details.reportId ?? '', token: '{{reference}}' },
    // Their legal name AND the short one. A cover reads "Paytm E-Commerce
    // Private Limited" and the disclaimer inside says "Board of Directors of
    // Paytm E-Commerce" — the same client, one form of which matches nothing,
    // so no blank is found, so no frame is built, so the org-name gate throws
    // the whole limitation paragraph away for naming the client it is written
    // for. Longest first, or the short form eats the long one's tail.
    ...(ctx.orgNames ?? []).flatMap(name => {
      const bare = name.replace(CORPORATE_SUFFIX, '').trim();
      return bare && bare !== name
        ? [{ value: name, token: '{{entity}}' }, { value: bare, token: '{{entity}}' }]
        : [{ value: name, token: '{{entity}}' }];
    }),
  ].filter(s => s.value.trim().length > 3);

  let hit = false;
  const out = lines.map(line => {
    // The client's own name is a report detail whether or not it turned up on
    // the letterhead we read. Their boilerplate says it in every report and it
    // is never this quarter's data, so it becomes the same blank.
    let next = line.replace(ORG_NAME_ALL, () => { hit = true; return '{{entity}}'; });
    for (const swap of swaps) {
      const before = next;
      next = next.replace(new RegExp(swap.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), swap.token);
      if (next !== before) hit = true;
    }
    // Dates and periods in every shape a report writes them, because ONE date
    // left unmatched fails the gate and loses an otherwise perfect piece of
    // boilerplate. The spacing is deliberately loose: a PDF turns "January 09,
    // 2018" into "January 09 , 2018", and an audit period wraps across two
    // lines as "December 01, 2017 to November" then "30, 2018".
    const dated = next
      .replace(new RegExp(`\\b\\d{1,2}\\s*(?:st|nd|rd|th)?\\s+${MONTH}\\s*,?\\s*\\d{2,4}\\b`, 'gi'), '{{date}}')
      .replace(new RegExp(`\\b${MONTH}\\s+\\d{1,2}\\s*,?\\s*\\d{2,4}\\b`, 'gi'), '{{date}}')
      // A day and a year, with the month left behind on the line above.
      .replace(/\b\d{1,2}\s*,\s*(?:19|20)\d{2}\b/g, '{{date}}')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '{{date}}')
      .replace(new RegExp(`\\b${MONTH}\\s*[’'-]?\\s*\\d{2,4}\\b`, 'gi'), '{{period}}')
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '{{date}}')
      .replace(/\bFY\s?\d{2,4}(?:\s?[-/]\s?\d{2,4})?\b/gi, '{{period}}')
      .replace(/\bQ[1-4]\s?(FY)?\s?\d{0,4}\b/gi, '{{period}}');
    if (dated !== next) hit = true;
    return dated;
  });

  // A period that wrapped mid-date: "December 01, 2017 to November" on one
  // line and "30, 2018" on the next. Both halves are blanked above, which
  // leaves a stranded month behind — one word, and the whole paragraph fails
  // the gate for it.
  for (let k = 0; k < out.length - 1; k++) {
    if (!/\{\{date\}\}|\{\{period\}\}/.test(out[k + 1])) continue;
    const trimmed = out[k].replace(new RegExp(`\\b${MONTH}\\s*$`, 'i'), '').trimEnd();
    if (trimmed !== out[k]) { out[k] = trimmed; hit = true; }
  }

  return hit ? { lines: out, text: out.join('\n') } : null;
}

/**
 * Rows that DEFINE the rating words, as opposed to counting them. "High —
 * issues with an enterprise wide impact…" is a definition; "High · 3" is a
 * count of this quarter's findings, and reading the second as the first turns
 * a severity count into fixed wording that prints last quarter's numbers.
 */
function definitionRowCount(lines: string[], scaleWords: string[]): number {
  if (scaleWords.length === 0) return 0;
  return lines.filter(line => {
    const word = scaleWords.find(w => line.toLowerCase().trimStart().startsWith(w.toLowerCase()));
    if (!word) return false;
    const rest = line.trim().slice(word.length).replace(/^[\s:·—–-]+/, '');
    // What follows the word has to be an explanation, not a figure.
    return rest.length > 15 && /[a-z]{4}/i.test(rest);
  }).length;
}

/**
 * A header with its rows lost. An annexure's grid can come apart in the read —
 * the column names wrap onto three lines and the rows land on the far side of a
 * page break — leaving what looks like prose that is really a table header.
 * Inside an annexure the findings point at, that header is the keepable part
 * anyway: the columns are their layout and the rows are ours to fill.
 */
function headerOnlyColumns(lines: string[]): string[] | null {
  const labelled = (rows: string[]) => {
    const labels = rows.flatMap(l => l.split(/\s{2,}/).map(t => t.trim()).filter(Boolean));
    if (labels.length < 3 || labels.length > 12) return null;
    const headerish = labels.every(l =>
      l.split(/\s+/).length <= 4 && l.length <= 32 && !/[.;:]$/.test(l) && !/^[\d,.%-]+$/.test(l));
    return headerish && rows.every(l => l.length <= 120) ? labels.map(l => titleCaseIfCaps(l)) : null;
  };

  // The whole block is the header, its rows lost at a page break…
  const all = labelled(lines);
  if (all) return all;

  // …or the header is the first line or three and the rows are underneath,
  // wrapped so raggedly that pass 4 never saw them line up. Either way the
  // columns are the part worth keeping: the rows are ours to fill.
  for (let k = Math.min(3, lines.length - 1); k >= 1; k--) {
    const head = labelled(lines.slice(0, k));
    const rows = lines.slice(k);
    if (head && rows.length >= 2 && rows.filter(r => /\d/.test(r)).length >= rows.length * 0.6) return head;
  }
  return null;
}

/** A standalone letter that is the initial of one of their rating words. Only
 *  a letter ON ITS OWN counts: "H" in a circle is a rating, the H in "High
 *  Street" is not. */
function letterRatingHits(block: RawBlock, scale?: string[]): number {
  if (!scale?.length) return 0;
  const initials = new Set(scale.map(w => w.trim().charAt(0).toUpperCase()).filter(Boolean));
  if (initials.size < 2) return 0;
  let hits = 0;
  for (const line of block.lines) {
    for (const token of line.split(/[\s|·,()[\]]+/)) {
      const t = token.replace(/[^A-Za-z]/g, '');
      if (t.length === 1 && initials.has(t.toUpperCase())) hits++;
    }
  }
  return hits;
}

/** Ticks under a column per level: a summary table whose COLUMNS are their
 *  rating words, with a mark in the one that applies. The columns carry the
 *  rating, so the table is rated even though no row says a word. */
function tickRatingHits(block: RawBlock, scale?: string[]): number {
  if (!scale?.length || block.kind !== 'table') return 0;
  const columns = block.columns ?? [];
  const named = columns.filter(c => scale.some(w => norm(w) === norm(c))).length;
  if (named < 2) return 0;
  const ticks = block.lines.filter(l => /[✓✔×✗xX√]|\byes\b/i.test(l)).length;
  return ticks > 0 ? named : 0;
}

/** The title of a repeating item, shortened to what a summary table would list
 *  it under. Long titles get truncated in a table, so the first few words are
 *  the only part worth matching on. */
const itemKey = (line: string) => norm(line).split(' ').filter(Boolean).slice(0, 6).join(' ');

/**
 * Is this repeating part rated SOMEWHERE ELSE? A committee deck lists its
 * findings once, with ratings, in a snapshot table, and then gives each one a
 * slide carrying no rating word at all. Those slides are still findings, and
 * the rating is still the client's, so the part is claimed and the rating is
 * read from the table that holds it.
 *
 * Two ways to match: the finding's own reference, or the opening words of its
 * title. Both have to land on a line that carries a rating word, so an
 * unrated list of the same items never qualifies.
 */
function ratedElsewhere(block: RawBlock, ctx: DetectContext): boolean {
  if (!ctx.ratedLines?.length) return false;
  const ratedText = ctx.ratedLines.join('\n');
  const ratedKeys = new Set(ctx.ratedLines.map(itemKey));

  for (const line of block.lines.slice(0, 12)) {
    const clean = line.trim();
    if (clean.length < 8) continue;
    const ref = clean.match(FINDING_ID)?.[0];
    if (ref && ratedText.includes(ref)) return true;
    const key = itemKey(clean);
    if (key.split(' ').length < 3) continue;
    if (ratedKeys.has(key)) return true;
    // A table cell truncates the title, so a rated line that STARTS the same
    // way is the same item.
    if (ctx.ratedLines.some(r => norm(r).includes(key) || key.includes(itemKey(r)))) return true;
  }
  return false;
}

/** The field names a finding carries. A table whose columns are these is the
 *  findings written as one table: one row per problem, columns as the fields. */
const FINDING_FIELD_COLUMN = /\b(observation|finding|issue|exception|condition|criteria|cause|root cause|effect|impact|risk|implication|recommendation|management (comment|response)|action|rating|severity|priority|grading|repeat)\b/i;

/**
 * Detector 1 — does this block fill from audit data?
 *
 * One question: could our generator have produced this shape? Shape, never
 * wording. Heading text is unreliable across clients ("Findings" here,
 * "Detailed observations" there); structure is not. Five checks, each carrying
 * the reason shown on the badge.
 */
function detectAuditData(block: RawBlock, ctx: DetectContext): Detected | null {
  const text = block.lines.join('\n');
  const scaleWords = ctx.scale?.length
    ? new RegExp(`\\b(${ctx.scale.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
    : null;
  // A rating is not always spelled out. Consultant reports print just the
  // LETTER in a corner circle (H, M, L), or a TICK under a column per level in
  // a summary table. Both resolve against the table of definitions, which is
  // where the full words came from, so a letter or a tick counts the same as
  // the word it stands for.
  const ratingHits = (scaleWords ? (text.match(scaleWords) ?? []).length : 0)
    + letterRatingHits(block, ctx.scale)
    + tickRatingHits(block, ctx.scale);
  const idHits = ctx.idPattern ? (text.match(idPatternToRegex(ctx.idPattern)) ?? []).length : 0;

  // Check 1 — a repeating shape whose slots carry the report's own rating
  // words. Only findings repeat WITH a rating: scope lists and appendix rows
  // repeat without one.
  //
  // The rating does not have to sit on the part itself. Committee decks put it
  // in a summary table that lists the findings with their ratings, and the
  // slides that follow carry none. A repeating part whose items appear in a
  // rated row of such a table is rated, by that table. The Carlsberg finding
  // slides are the caught case: three findings dropped for having no rating
  // word on them while the snapshot table rated all three.
  if (block.kind === 'cards') {
    // The boxes on the card are evidence in their own right. A part that
    // repeats with an ISSUE box and an ACTION box is a findings card whatever
    // it is titled: nothing else in a report repeats with that pair. Their
    // observation frame — Scope · Process · Issue · Action Plan — carries no
    // rating word at all, and dropping it drops the findings detail.
    const fields = block.cardFields ?? [];
    const saysIssue = fields.some(f => /issue|observation|finding|exception|condition|risk|implication/i.test(f));
    const saysAction = fields.some(f => /recommendation|action|management (comment|response)|root cause|responsib/i.test(f));
    if (saysIssue && saysAction) {
      return { keep: 'query', binding: 'findings', why: 'Kept: a set of boxes that repeats once per problem, with their own labels. Only problems repeat with an issue and an action on them.' };
    }
    const onTheCard = ratingHits >= 1 || fields.some(f => /rating|severity|priority|grading/i.test(f));
    if (onTheCard) {
      return { keep: 'query', binding: 'findings', why: 'Kept: a card that repeats with a rating on it. Only findings repeat with a rating, so this is ours to fill.' };
    }
    return ratedElsewhere(block, ctx)
      ? { keep: 'query', binding: 'findings', why: 'Kept: a part that repeats once per problem, and your own summary table rates each of them. The rating comes from there.' }
      : null;
  }

  // Check 5, second half — a sources appendix naming the queries the report was
  // built from. Which queries built a report is a detail Irame always holds, so
  // a list of them is ours to produce. It sits above the shape checks because a
  // sources table is a sources table whatever its columns look like.
  if ((SOURCES_NAME.test(ctx.sectionName) || SOURCES_NAME.test(block.label ?? '') || SOURCES_BODY.test(text))
    && (block.kind === 'table' || block.kind === 'narrative')) {
    return { keep: 'query', binding: 'metrics', why: 'Kept: a list of what the report was built from. We always know which queries built a report, so this is ours to write.' };
  }

  // Check 2 — stat cards whose captions count things we record. The caption
  // decides, not the card shape: "₹1,78,650 cr Revenue" is the same shape and
  // is not ours to fill.
  if (block.kind === 'stat') {
    const labels = block.slotLabels ?? [];
    const counted = labels.filter(l => COUNT_NOUN.test(l)).length;
    const money = labels.filter(l => MONEY_NOUN.test(l)).length;
    if (counted > 0 && money > 0) {
      return { keep: 'query', binding: 'metrics', flag: 'half-yes', why: 'This looks like statistics, but some of these figures are money, which our audit results do not hold.' };
    }
    if (counted >= 1 && counted >= labels.length - 1) {
      return { keep: 'query', binding: 'metrics', why: 'Kept: a row of numbers counting things we record, such as exceptions and findings.' };
    }
    return null;
  }

  // Check 2b — a chart, judged by its LABELS, the same rule as a row of
  // numbers. Slices named High / Medium / Low are severity counts, which we
  // produce; slices named after money are not. The old numbers are thrown away
  // either way: the template stores "a pie of severity counts", never counts.
  if (block.kind === 'chart') {
    const labels = block.chartLabels ?? [];
    // A pasted picture is an image to us. No labels, no data, nothing to read,
    // so it is never guessed at — the client decides at review whether the
    // picture spot stays at all.
    if (block.chartKind === 'picture') return null;
    const rated = labels.filter(l => (ctx.scale ?? []).some(w => norm(w) === norm(l))).length;
    const counted = labels.filter(l => COUNT_NOUN.test(l)).length;
    const money = labels.filter(l => MONEY_NOUN.test(l)).length;
    if (money > 0 || (rated === 0 && counted === 0)) return null;
    // A hand-drawn chart is a guess from how its boxes sit, so it is kept and
    // flagged. It is never filled until the client confirms what it is.
    return block.chartKind === 'drawn'
      ? { keep: 'query', binding: 'metrics', flag: 'unlabelled', why: 'Kept as our best guess: this is a chart drawn out of boxes rather than a real chart, so we read its arrangement. It never fills until you confirm what it is.' }
      : { keep: 'query', binding: 'metrics', why: 'Kept: a chart labelled with your rating words, so it fills from the counts we produce. Its old numbers are thrown away.' };
  }

  // Check 5, third part — the in-scope list. Which areas an audit covered is
  // drafted from the category tags the report's queries carry, and the client
  // edits it before it goes out. What was deliberately EXCLUDED is not ours:
  // no query list can reconstruct a decision taken before the queries ran.
  if (ctx.scopeSection && (block.kind === 'narrative' || block.kind === 'table' || block.kind === 'callout')) {
    if (OUT_OF_SCOPE.test(text)) return null;
    return {
      keep: 'query',
      binding: 'scope',
      why: 'Kept: the list of what this audit covered, drafted from the categories your queries carry. You edit it before it goes out.',
    };
  }

  // Check 6, continued — the same annexure, read badly. Its rows may have been
  // lost at a page break, leaving only the wrapped header, and that header is
  // still their layout for our exception rows.
  if (ctx.evidenceTarget && block.kind === 'narrative' && headerOnlyColumns(block.lines)) {
    return {
      keep: 'query',
      binding: 'evidence',
      why: 'Kept: the columns of an annexure your findings point at. Its rows come from the exception records behind the finding.',
    };
  }

  // Check 3 — a table keyed by the finding IDs is built FROM the findings, so
  // it is generatable too. Keyed by vendor names or account numbers, it is not.
  if (block.kind === 'table') {
    const columns = block.columns ?? [];

    // A table of DEFINITIONS is fixed wording, whatever its columns say. Their
    // rating scale states its own rules and prints identically every time, and
    // a header reading High / Medium / Low otherwise reads as severity counts
    // and claims the page as data we fill.
    const legendWords = ctx.definitionWords ?? ctx.scale ?? [];
    const definitionRows = definitionRowCount(block.lines, legendWords);
    const legendColumns = legendWords.length
      ? columns.filter(c => legendWords.some(w => norm(w) === norm(c))).length
      : 0;
    // A tick table rates the things it lists; a legend explains the words. The
    // ticks are what tell them apart.
    if (definitionRows >= 2) return null;
    if (legendColumns >= 2 && tickRatingHits(block, ctx.scale) === 0 && FIXED_NAME.test(ctx.sectionName)) return null;

    // Check 6 — an evidence annexure a finding points at. "Refer Annexure 1.1"
    // leads to a table of the actual records behind one finding: the flagged
    // vendor changes, the unapproved journals. Those rows ARE our exception
    // rows, so we hold them and can print them in their annexure layout.
    // Amounts inside them are our own query output, which is why the money rule
    // does not apply here: it bars figures from the client's books.
    // …unless the heading already names something we produce. "Appendix A:
    // Management Action Plan" sits in the same back pages as the evidence and
    // is not evidence: it is the action plan, built from the findings. Reading
    // it as records would print exception rows where the client expects agreed
    // actions, owners and dates.
    if (ctx.evidenceTarget && !ctx.concept) {
      return {
        keep: 'query',
        binding: 'evidence',
        why: 'Kept: the records behind a finding, which your report points at from the finding itself. It fills with that finding’s own exception rows.',
      };
    }

    // A COUNT table is not a findings table. "Risk | Number of Observation(s)"
    // with a row per rating level is the severity counts, which we produce from
    // our own records — one row per LEVEL, not one row per problem. It is
    // tested first, because its columns read like a finding's fields.
    const countColumns = columns.filter(c => /\b(number|count|no\.?|total|qty|quantity)\b/i.test(c)).length;
    const ratingColumns = columns.filter(c =>
      /\b(risk|rating|severity|priority|grading|significance)\b/i.test(c)).length;
    if (countColumns >= 1 && ratingColumns >= 1 && columns.length <= 3) {
      return { keep: 'query', binding: 'metrics', why: 'Kept: a count of your problems by rating, which is a number we work out from our own records.' };
    }

    // Check 1, in table form — the findings written as ONE table instead of one
    // card each: a row per problem, the columns being its fields. Nothing
    // "repeats" for pass 5 to spot, so without this the findings section itself
    // is dropped. "Observation Details" as one Observation / Risk /
    // Recommendation table is the caught case.
    const fieldColumns = columns.filter(c => FINDING_FIELD_COLUMN.test(c)).length;
    if (fieldColumns >= 2 && block.lines.length >= 2 && (ratingHits >= 1 || idHits >= 1 || ratedElsewhere(block, ctx))) {
      return {
        keep: 'query',
        binding: 'findings',
        why: 'Kept: a table where every row is one problem, so we stamp a row per problem instead of typing it fresh.',
      };
    }

    // A money column is the giveaway that the table is about the business, not
    // about the audit. We cannot produce a revenue figure, so the whole table
    // stays out rather than printing with a hole in it.
    if (columns.some(c => MONEY_NOUN.test(c))) return null;
    if (block.linkedTo || idHits >= 2) {
      return { keep: 'query', binding: 'actions', why: 'Kept: a table using the finding numbers, so it is built from the findings rather than typed fresh.' };
    }
    // …or the columns themselves name things our results count: rating levels,
    // problem counts, references. A column of somebody else's answers — owner,
    // agreed date, status — may ride along on a table our findings build, but
    // it can never carry the claim on its own: a table of nothing but those is
    // a table we would print empty.
    const ours = columns.filter(c =>
      COUNT_NOUN.test(c) || OUR_COLUMN.test(c) || (ctx.scale ?? []).some(w => norm(w) === norm(c))).length;
    if (ours === 0) return null;
    const waiting = columns.filter(c => HUMAN_COLUMN.test(c) && !OUR_COLUMN.test(c)).length;
    return ours >= 2 && ours + waiting >= columns.length - 1
      ? { keep: 'query', binding: 'actions', why: 'Kept: its columns name things our audit results count, so we fill it rather than leaving it empty.' }
      : null;
  }

  // Check 5 — label and value slots the system already knows for every report.
  if (block.kind === 'slot') {
    const labels = block.slotLabels ?? [];
    const known = labels.filter(l => METADATA_LABEL.test(l.trim())).length;
    return known >= 1 && known >= labels.length - 1
      ? { keep: 'query', why: 'Kept: boxes for details we already know, such as the title, the period and the date.' }
      : null;
  }

  // Check 4 — prose that rolls up the things above. Text summarising
  // generatable things is itself generatable; prose about the organisation,
  // the methodology or the scope shares nothing with the findings.
  if (block.kind === 'narrative' || block.kind === 'callout') {
    const counts = (text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(findings?|exceptions?|observations?|issues?|recommendations?|actions?)\b/gi) ?? []).length;
    const signals = [ratingHits >= 2, idHits >= 2, counts >= 1].filter(Boolean).length;
    return signals >= 2
      ? { keep: 'query', binding: 'summary', why: 'Kept: text that sums up the findings, and a summary of what we produce is something we can produce.' }
      : null;
  }

  return null;
}

/**
 * Detector 2 — is this block fixed text?
 *
 * Four fingerprints. The first is the gate: text carrying even one per-report
 * value cannot print identically next quarter. Past the gate, one of the other
 * three has to agree.
 */
function detectFixedText(block: RawBlock, ctx: DetectContext): Detected | null {
  if (block.kind === 'cards' || block.kind === 'stat' || block.kind === 'signoff' || block.kind === 'chart') return null;
  const text = block.lines.join('\n');
  if (!text.trim()) return null;

  // Fingerprint 2 · definition or legend structure: a table whose rows are the
  // rating words the scale detector already found. Definitions describe the
  // scale, not this audit.
  //
  // This one is tested BEFORE the gate, because it overrides it. A rating scale
  // states its own rules, thresholds and all: "High: over ₹1 M" prints
  // identically in every report the client will ever write. The Carlsberg
  // criteria page is the caught case — dropped for holding money, taking the
  // source of the client's own rating words with it.
  // A definitions block is not always a table. Decks print the scale as a run
  // of label-and-value lines — "High : > 1 M", "Medium : > 300 K to 1 M" — which
  // pass 4 reads as fill-in slots. Same evidence, different shape, so both
  // count. The Carlsberg criteria page arrives exactly this way.
  const scaleWords = ctx.definitionWords ?? ctx.scale ?? [];
  const definitionRows = (block.kind === 'table' || block.kind === 'slot' || ctx.definitionSection)
    ? definitionRowCount(block.lines, scaleWords)
    : 0;
  // Inside a legend, one row is enough. The page explains their scale a level
  // at a time and the read breaks it into a block per level, so demanding two
  // rows per block loses most of the page — and with it the source of the
  // client's own words. Cumberland's five assurance levels are the caught case.
  if (ctx.definitionSection && definitionRows >= 1) {
    return { keep: 'fixed', why: 'Kept word for word: part of the table that defines your rating words. It explains the words, not this audit.' };
  }
  // A legend can be a MATRIX instead of a list: the rating words across the
  // top, the kinds of impact down the side. Same evidence, turned ninety
  // degrees, and the impact thresholds inside it are still the scale's own
  // rules rather than this quarter's figures.
  const definitionColumns = scaleWords.length
    ? (block.columns ?? []).filter(c => scaleWords.some(w => norm(w) === norm(c))).length
    : 0;
  if (definitionRows >= 2 || definitionColumns >= 2) {
    return { keep: 'fixed', why: 'Kept word for word: a table of definitions. It explains the words, not this audit, so it holds for every report.' };
  }

  // Whose words are these? Everything past the definitions carries a voice, and
  // the voice in a consultant's report is the consultant's. Kept as a starting
  // draft, flagged, and locked once the client has made it theirs.
  const authored = FIRST_PERSON.test(text) || FIRM_NAME.test(text) ? { authored: true } : undefined;

  // Fingerprint 1 · the gate — nothing inside that changes per report. Except
  // that "changing" means changing PER REPORT: the client's name, the period,
  // the date and the report title are details we hold, so wording that varies
  // only in those is kept exactly as written with those spots as blanks. A
  // disclaimer naming the client and period is textbook fixed wording, and this
  // gate used to throw it away.
  // A frame has to be worth keeping as wording. One stray date line tokenises
  // perfectly and says nothing, so a frame needs some sentence left in it once
  // the blanks are taken out.
  const framed = frameOf(block.lines, ctx);
  const framedWords = framed
    ? framed.text.replace(/\{\{\w+\}\}/g, ' ').split(/\s+/).filter(w => /[a-z]/i.test(w)).length
    : 0;
  const usable = framed && framedWords >= 6 ? framed : null;
  if (hasVariableData(usable?.text ?? text, usable ? [] : ctx.orgNames, !!usable)) return null;
  const frame = usable
    ? { fixedBody: usable.lines, frame: true }
    : undefined;
  const framedNote = frame ? ' Your name, period and dates are filled in each time.' : '';

  // Fingerprint 3 · formal or regulatory phrasing. Paraphrasing a conformance
  // statement changes what it certifies, so the wording must not vary.
  if (FIXED_PHRASE.test(text) || CONFIDENTIAL.test(text)) {
    return { keep: 'fixed', ...frame, ...authored, why: `Kept word for word: formal wording. Change it and you change what it promises.${framedNote}` };
  }

  // Fingerprint 4 · front or back matter, or text repeated word for word. Text
  // the document itself repeats is already behaving as boilerplate.
  const repeated = (ctx.repeats.get(bodyKey(block.lines)) ?? 0) >= 2;
  if (repeated) {
    return { keep: 'fixed', ...frame, ...authored, why: `Kept word for word: the same wording shows up twice in their report, so it is already behaving as fixed wording.${framedNote}` };
  }

  // The weak end of fingerprint 4: the heading says this is front or back
  // matter, and nothing inside changes, but nothing else agrees. Kept and
  // flagged, because only the client knows whether these words really hold.
  const instructional = FIXED_NAME.test(ctx.sectionName) || FIXED_NAME.test(block.label ?? '')
    || FRAME_NAME.test(ctx.sectionName) || FRAME_NAME.test(block.label ?? '');
  if (instructional) {
    return { keep: 'fixed', ...frame, ...authored, flag: 'half-yes', why: `Looks fixed, please confirm: it explains the document rather than the audit, and nothing inside it changes.${framedNote}` };
  }

  // A frame is its own evidence, but only for real prose: wording that varies
  // ONLY in the client name, the period and the dates is a form the client
  // fills in each quarter. A one-line fragment is not, so it stays out.
  if (frame && text.split(/\s+/).length >= 15) {
    return { keep: 'fixed', ...frame, ...authored, why: 'Kept word for word as a frame: the only parts of it that change are your name, your period and the dates, so those become blanks we fill in each time.' };
  }

  // The gate alone proves nothing. Prose can be free of dates and amounts and
  // still be this quarter's writing, so it is not claimed as boilerplate.
  return null;
}

/** Check 4, second half: the shape said nothing, but the HEADING names a
 *  concept we generate and it sits where that concept belongs. A "Summary of
 *  recommendations" after the findings is a rollup of recommendations we
 *  already write, whatever words its paragraphs happen to share with them. */
function detectByTitle(block: RawBlock, ctx: DetectContext, firstProse: boolean): Detected | null {
  if (!ctx.concept) return null;
  if (block.kind === 'cards' || block.kind === 'signoff') return null;
  // A rollup is its opening paragraph and the table that carries it. The rest
  // of a long section still has to earn its place through the shape checks,
  // or the heading alone would drag every block under it into the template.
  if (block.kind === 'narrative' || block.kind === 'callout') {
    if (!firstProse) return null;
  } else if (block.kind === 'table' || block.kind === 'stat') {
    // The heading gets no more licence here than the shape does. A table of
    // nothing but other people's answers — owner, agreed date, status — is a
    // table we would print empty however the section above it is titled, so at
    // least one column has to name something our own results carry.
    const named = [...(block.columns ?? []), ...(block.slotLabels ?? [])];
    if (!named.some(c => OUR_COLUMN.test(c))) return null;
  } else {
    return null;
  }
  return {
    keep: 'query',
    binding: ctx.concept.binding,
    why: `Kept: a summary of the ${ctx.concept.word} we produce, judged by what the heading means and where it sits.`,
  };
}

function detectBlock(block: RawBlock, ctx: DetectContext, firstProse = false): Detected {
  return detectAuditData(block, ctx)
    ?? detectByTitle(block, ctx, firstProse)
    ?? detectFixedText(block, ctx)
    ?? { keep: null, why: 'Not included: nothing here comes from audit results, and it is not wording that never changes.' };
}

/** What the section is about, read from its own body. Never a quote: the
 *  template holds zero content, so the line names the subject, it does not
 *  repeat their words. Works on a section nobody has seen before, because the
 *  question "what does this section contain?" is answerable from any body. */
const TOPIC_CUES: { re: RegExp; says: string }[] = [
  { re: /\b(rating|grading|definitions?|criteria|scale)\b/i, says: 'the rating words this report uses' },
  { re: /\b(recommendations?|agreed actions?|action plan|remediation)\b/i, says: 'the recommendations and who owns them' },
  { re: /\b(findings?|exceptions?|weakness(es)?|observations?|deficienc\w+)\b/i, says: 'the findings raised' },
  { re: /\b(opinion|assurance|conclusions?)\b/i, says: 'the opinion and what it rests on' },
  { re: /\b(scopes?|in scope|out of scope|coverage|period covered)\b/i, says: 'what the audit covered' },
  { re: /\b(objectives?|purpose)\b/i, says: 'what the audit set out to test' },
  { re: /\b(distribut\w+|recipients?|circulat\w+|version history|issued to)\b/i, says: 'who receives the report and when' },
  { re: /\b(revenue|margins?|cash|ratios?|segments?|financial statements?|balance sheet|profitability)\b/i, says: 'the financial numbers behind the review' },
  { re: /\b(control environment|coso|control cycles?|entity level|processes)\b/i, says: 'the control areas assessed' },
  { re: /\b(signatures?|signed|sign[\s-]?off|approved by)\b/i, says: 'who signs the report off' },
  { re: /\b(sources?|basis of preparation|data used|methodolog\w+)\b/i, says: 'where the information came from' },
  { re: /\b(risks?|risk assessment)\b/i, says: 'the risks in view' },
  { re: /\b(samples?|sampling|tested|testing|walkthroughs?|procedures)\b/i, says: 'how the work was carried out' },
  { re: /\b(limitations?|constraints?|caveats?)\b/i, says: 'the limits on what this work can say' },
  { re: /\b(introduction|background|about (the|this))\b/i, says: 'the background to the review' },
];

/** The heading answers the question far more reliably than the body, so it
 *  carries the weight. The body only breaks a tie. */
function topicOf(name: string, body: string): string | undefined {
  let best: { says: string; score: number } | null = null;
  for (const cue of TOPIC_CUES) {
    const inName = cue.re.test(name) ? 5 : 0;
    const inBody = (body.match(new RegExp(cue.re.source, 'gi')) ?? []).length;
    // The body can only break a tie between headings, never outvote one. A
    // findings section is full of the word "rating" and is still a findings
    // section.
    // A cue found only in the body has to be insistent (three mentions or
    // more) before it names the section. A wrong line is worse than none.
    const score = inName + (inBody >= 3 ? 3 : inBody >= 1 ? 1 : 0);
    if (score >= 3 && (!best || score > best.score)) best = { says: cue.says, score };
  }
  return best?.says;
}

const SHAPE_WORDS: Record<string, string> = {
  narrative: 'writing', table: 'a table', stat: 'a row of numbers',
  slot: 'boxes to fill in', callout: 'a highlighted note', chart: 'a chart',
  cards: 'one card each', signoff: 'signature lines',
};

function describe(section: SpineSection, fill: SectionFill, blocks: ReadBlock[], severity?: string): string {
  const shapes = [...new Set(blocks.map(b => b.kind))];
  const topic = topicOf(section.name, section.lines.map(l => l.text).join('\n'));

  // Rule 1 · a description is timeless. A severity-split section says which
  // rating it holds, because that is true of every report it will ever
  // produce, unlike "2 findings were rated high", which is one upload's data.
  const subject = severity ? `findings rated ${severity.toLowerCase()}` : topic;
  const carries = shapes.length
    ? `${subject ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)}, in ` : 'Holds '}${shapes.map(s => SHAPE_WORDS[s] ?? s).join(', ')}.`
    : subject ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)}.` : '';
  // Nothing to say about it honestly. The review card then asks for the line
  // instead of printing a placeholder that reads as broken.
  if (!carries) return '';

  const filled =
    fill === 'query' ? 'Filled from your audit results.'
      : fill === 'fixed' ? 'Prints the same every time.'
        : fill === 'human' ? 'Waits for a person.'
          : fill === 'mixed' ? 'Its parts behave differently.'
            : 'Nothing connected to it yet.';
  return gateDescription(`${carries} ${filled}`);
}

/** Rule 2 · the no-variable-data gate applies to descriptions too. A count, a
 *  date, a percentage or a severity tally is one upload's data leaking into a
 *  template that must hold zero content, so the line is rejected mechanically
 *  rather than judged. */
function gateDescription(line: string): string {
  return /\d/.test(line) ? '' : line;
}

/** Rule 3 · per-section input, deduped output. Two sections carrying the same
 *  sentence means the annotation ran once and pasted, so both are rewritten
 *  from what actually distinguishes them: their own heading. */
function dedupeDescriptions(sections: ReadSection[]): void {
  const byLine = new Map<string, ReadSection[]>();
  for (const s of sections) {
    if (!s.description) continue;
    (byLine.get(s.description) ?? byLine.set(s.description, []).get(s.description)!).push(s);
  }
  for (const [line, group] of byLine) {
    if (group.length < 2) continue;
    for (const s of group) {
      const shapes = [...new Set(s.blocks.map(b => b.kind))].map(k => SHAPE_WORDS[k] ?? k).join(', ');
      const rewritten = gateDescription(`${s.name.trim()}: ${shapes || 'the shape kept from your report'}. ${line.split('. ').slice(-1)[0]}`);
      s.description = rewritten;
    }
  }
}

function detectScales(text: string): { findingScale?: string[]; opinionScale?: string[] } {
  const hay = text.toLowerCase();
  const pick = (sets: string[][]) => {
    let best: { set: string[]; hits: number; full: boolean } | null = null;
    for (const set of sets) {
      const hits = set.filter(w => hay.includes(w.toLowerCase())).length;
      if (hits < Math.max(2, set.length - 1)) continue;
      const full = hits === set.length;
      // A set the report uses in FULL beats a longer one it only nearly uses.
      // Three words present matches Critical/High/Medium/Low just as well as
      // High/Medium/Low, and offering the client a level their report has
      // never once printed is worse than offering a shorter list.
      if (!best || (full && !best.full) || (full === best.full && hits > best.hits)) {
        best = { set, hits, full };
      }
    }
    return best?.set;
  };
  return { findingScale: pick(FINDING_SCALES), opinionScale: pick(OPINION_SCALES) };
}

// ─── One block, two places ──────────────────────────────────────────────────
// A report often prints the same block twice: the net risk table on the cover
// and again in the executive summary, the ratings key in the summary and again
// in an appendix. That is one block referenced twice, not two blocks. The first
// occurrence keeps the shape and gets an id; the later ones become placements
// that point at it, so editing the shape once keeps every position in step.

/** What makes two blocks the same block: a named table or stat strip carrying
 *  exactly the same headings. Prose is never "one block"; slots and cards are
 *  excluded too, because a shape that recurs by design is pass 5's job, not a
 *  reference. */
function blockIdentity(b: ReadBlock): string | null {
  if (b.kind !== 'table' && b.kind !== 'stat') return null;
  const named = [...(b.columns ?? []), ...(b.slotLabels ?? [])];
  if (named.length < 2) return null;                    // too thin to match on
  return `${b.kind}:${named.map(n => norm(n)).join('|')}`;
}

/** A block printed in two or three places is one block placed more than once.
 *  A shape that turns up in half the report is a pattern, not a reference, so
 *  it is left alone. */
const MAX_PLACEMENTS = 3;

function linkRepeatedBlocks(sections: ReadSection[]): void {
  const homes = new Map<string, Set<string>>();
  for (const section of sections) {
    for (const b of section.blocks) {
      const identity = blockIdentity(b);
      if (!identity) continue;
      (homes.get(identity) ?? homes.set(identity, new Set()).get(identity)!).add(section.name);
    }
  }

  const first = new Map<string, ReadBlock>();
  let n = 0;
  for (const section of sections) {
    section.blocks = section.blocks.map(b => {
      const identity = blockIdentity(b);
      if (!identity) return b;
      const places = homes.get(identity)?.size ?? 0;
      if (places < 2 || places > MAX_PLACEMENTS) return b;
      const seen = first.get(identity);
      if (!seen) {
        first.set(identity, b);
        return b;
      }
      // Stored once: the definition gets its id the moment a second placement
      // needs it, so single-use blocks stay plain.
      if (!seen.refId) seen.refId = `blk-${++n}`;
      return {
        kind: b.kind,
        fill: b.fill,
        binding: b.binding,
        label: b.label,
        ref: seen.refId,
        confidence: b.confidence,
        page: b.page,
        preview: b.preview,
      };
    });
  }
}

// ═══ Passes 6 and after, shared ══════════════════════════════════════════════
//
// Everything below the reading is the same whatever the file was. A PDF has to
// be measured into a tree of sections; a PowerPoint says outright what its
// parts are. Once either one has produced a tree, the two detectors, the rating
// words, the sign-off setting and the descriptions run identically — which is
// why a deck and a document that describe the same report come out as the same
// template.

export type AssembleInput = {
  tree: Tree;
  furniture: ReadFurniture | null;
  /** Body lines per page or per slide, furniture already lifted out. */
  body: Line[][];
  bodySize: number;
  pageCount: number;
  snapshots: string[];
  coverColor?: string;
  /** Passes 4 and 5 for this file kind. A deck folds its own repeating runs of
   *  slides first, because the repetition spans several slides at a time. */
  classify: (section: SpineSection) => RawBlock[];
  /** A closing or "thank you" page. Shape, not writing, so it comes back as a
   *  setting the same way the signature page does. */
  closing?: { lines: string[] };
  /** Their brand mark, as a data URL, when the reader could find one. */
  logo?: string;
};

/**
 * THE OBSERVATION FRAME. A written report often gives each observation a page
 * laid out as the same set of boxes — "Scope · Process · Issue · Action Plan /
 * Management Comments" across the top, the observation underneath — and prints
 * that row again for the next one. Nothing repeats in the way pass 5 looks for,
 * because the repetition is marked by a row of BOX LABELS rather than by a
 * shape, so a report's entire findings detail can come back as one unreadable
 * section. The label row is the marker, and what sits between two markers is
 * one stamp of the card.
 */
const FRAME_LABEL = /^(scope|process|sub[\s-]?process|issue|observation|finding|risk|implication|impact|recommendation|action plan|management comments?|management response|root cause|responsibility|target date|status|rating|criteria|condition|cause|effect)\b/i;

function frameLabels(line: Line): string[] | null {
  const parts = line.cells.length >= 3
    ? line.cells.map(c => c.text)
    : line.text.split(/\s{2,}|\s*\|\s*/);
  const labels = parts.map(p => p.trim()).filter(p => p && p.split(/\s+/).length <= 4 && FRAME_LABEL.test(p));
  const distinct = [...new Set(labels.map(l => norm(l)))];
  // Three of their box labels on one line, and nothing else on it. Two is a
  // sentence that happens to use the words.
  return distinct.length >= 3 && labels.length >= parts.length - 1
    ? labels.map(l => titleCaseIfCaps(l))
    : null;
}

/**
 * A CARD'S FIELD LABEL STANDING ALONE. Each finding in their report carries the
 * same bold labels — "Root Cause", "Risk", "Recommendation", "Management
 * Response" — and a label set in bold on its own line reads exactly like a
 * heading. Promoted to a section it holds one finding's worth of text, is
 * claimed by nothing, and leaves the review screen with an empty "Root Cause"
 * part that then gets dropped. It is a block label inside the stamp.
 *
 * Singular on purpose. "Recommendations" and "Observations" are real sections
 * in most reports; "Recommendation" with one finding's text under it is not.
 */
const CARD_FIELD_HEADING = /^(root cause|risk|impact|implication|condition|criteria|cause|effect|observation|issue|finding|exception|recommendation|management (response|comment)|auditee response|action plan|agreed action|responsibility|responsible( person)?|target date|due date|status|rating|severity|process|sub[\s-]?process)$/i;

/** The heading with its numbering and punctuation off, so "3.2 Root Cause:"
 *  tests the same as "Root Cause". */
const fieldHeading = (name: string) =>
  CARD_FIELD_HEADING.test(name.trim().replace(/^[\d.)\s]+/, '').replace(/[\s:.\-–—]+$/, ''));

/** A heading that opens a real part of the report rather than carrying one on:
 *  a numbered section, an annexure, a back page. */
function structuralHeading(name: string): boolean {
  return /^\s*\d+(?:\.\d+)*[.)]?\s+\S/.test(name.trim())
    || /\b(annexure|appendix|exhibit|schedule)\b/i.test(name)
    || FIXED_NAME.test(name)
    || SCOPE_NAME.test(name)
    || FRAME_NAME.test(name);
}

/**
 * Sections whose bodies carry that frame, folded into one stamped part. A page
 * with no marker that follows one is the observation running on, so it joins
 * the stamp it continues rather than standing as a section of its own.
 */
function foldObservationFrames(spine: SpineSection[]): SpineSection[] {
  const out: SpineSection[] = [];
  let open: SpineSection | null = null;

  for (const section of spine) {
    const marks: number[] = [];
    let labels: string[] | undefined;
    section.lines.forEach((line, li) => {
      const hit = frameLabels(line);
      if (!hit) return;
      marks.push(li);
      labels ??= hit;
    });

    if (marks.length === 0) {
      // A continuation page carries the observation on: no frame row of its
      // own, no heading of its own worth the name. A NUMBERED part, an annexure
      // or a back page is none of those — it is the next real section, and
      // swallowing it would take the whole back half of the report with it.
      if (open && section.lines.length > 0 && !structuralHeading(section.name)) {
        const stamp = open.stamp!;
        stamp[stamp.length - 1] = [...stamp[stamp.length - 1], ...section.lines];
        continue;
      }
      open = null;
      out.push(section);
      continue;
    }

    const chunks: Line[][] = [];
    marks.forEach((start, k) => {
      const end = k + 1 < marks.length ? marks[k + 1] : section.lines.length;
      chunks.push(section.lines.slice(start + 1, end));
    });

    if (open) {
      open.stamp!.push(...chunks);
      continue;
    }
    // Whatever sits ABOVE the first frame row is the section's own body — the
    // table of observations that introduces them, most often — so it keeps its
    // place and the stamp is added underneath it.
    const head = section.lines.slice(0, marks[0]);
    open = {
      ...section,
      lines: head.length > 0 ? head : chunks[0],
      stamp: chunks,
      frameFields: labels,
    };
    out.push(open);
  }
  return out;
}

/**
 * An orphan page. A report's own numbering tells you where its parts begin —
 * "4. Table of Observations", "Annexure 2b" — so a page that follows one of
 * those with a heading of neither kind is that part carrying on, with the
 * biggest line on the page mistaken for a title. It is joined back to the part
 * it continues, which is the same rule as "…continued" one level up.
 */
function foldOrphanPages(spine: SpineSection[]): SpineSection[] {
  const out: SpineSection[] = [];
  for (const section of spine) {
    const previous = out[out.length - 1];
    // NUMBERED parts and annexures only. Those are the headings a report gives
    // its own parts, so a page after one with neither is that part carrying on.
    // A heading that merely reads like a back page ("Scope of our coverage")
    // proves nothing about what follows it, and using it here swallowed a whole
    // appendix run.
    const numbered = (name: string) =>
      /^\s*\d+(?:\.\d+)*[.)]?\s+\S/.test(name.trim()) || /\b(annexure|appendix|exhibit|schedule)\b/i.test(name);
    if (previous && numbered(previous.name) && !structuralHeading(section.name) && !section.stamp) {
      previous.lines.push(...section.lines);
      continue;
    }
    out.push(section);
  }
  return out;
}

/**
 * A run of sections that are really one repeating finding.
 *
 * A committee deck gives every finding its own slide, and the heading of that
 * slide is the finding's own title — so pass 3 quite correctly reads five
 * sections where the format has one. The tell is that the report rates those
 * titles somewhere else, in the snapshot table that lists them: a heading that
 * appears in a rated line is a finding, not a part of the format.
 *
 * Such a run folds into the part ahead of it as a stamp, because that part is
 * the one that rated them. With nothing ahead of it, the run becomes one
 * section of its own, named the only way that holds no content of theirs.
 */
function foldRatedRun(
  spine: SpineSection[],
  ratedLines: string[],
  /** Is this section part of the evidence the findings point at? Evidence is
   *  never another repetition of the finding it belongs to, so it is excluded
   *  from the stamp however much its title looks like one. */
  inAnnexure: (index: number) => boolean = () => false,
): SpineSection[] {
  if (ratedLines.length === 0 || spine.length < 2) return spine;
  const ratedKeys = new Set(ratedLines.map(itemKey));

  // Where each line of the report lives, so a heading can be tested against
  // every OTHER part's body. A heading listed as an item inside another part is
  // one of that part's items, not a part of the format in its own right.
  const listed: { words: Set<string>; section: number }[] = [];
  spine.forEach((s, si) => {
    for (const line of s.lines) {
      const words = new Set(itemKey(line.text).split(' ').filter(Boolean));
      if (words.size < 3) continue;
      listed.push({ words, section: si });
    }
  });

  /** Two titles say the same thing when most of their words agree. A summary
   *  table truncates, re-cases and sometimes mistypes what it lists — "O2O"
   *  printed as "020" is real — so an exact match finds a third of them and
   *  breaks the run at the first miss. */
  const agree = (a: Set<string>, b: Set<string>) => {
    let shared = 0;
    for (const w of a) if (b.has(w)) shared++;
    return shared / Math.min(a.size, b.size) >= 0.7;
  };

  const isFindingTitle = (name: string, index: number) => {
    const words = new Set(itemKey(name).split(' ').filter(Boolean));
    if (words.size < 3) return false;                          // too short to match on
    // LINKAGE OUTRANKS A NAME MATCH. An annexure a finding points at holds that
    // finding's evidence; folding it into the stamp makes it a twelfth copy of
    // the finding and takes the evidence off the review screen entirely. The
    // caught case is "Marketing Promotion Revenue - Intel Campaign", whose
    // title matches a scope bullet on the front page word for word.

    // A definitions or criteria page is never a finding, however often the
    // report quotes it. Folding one away costs the source of their rating
    // words, which is the one thing the back pages are for.
    if (FIXED_NAME.test(name)) return false;
    if (ratedKeys.has(itemKey(name))) return true;
    if (ratedLines.some(r => agree(words, new Set(itemKey(r).split(' ').filter(Boolean))))) return true;
    // Listed as an item in some other part of the report. A deck's snapshot
    // slide lists its findings by title and rates them by count beside the
    // list, so the titles themselves carry no rating word at all.
    // EVIDENCE IS LISTED BY THE FINDINGS, NOT BY THE SCOPE. A page in the
    // annexure region may be folded into the stamp on the strength of another
    // annexure-region part listing it — that is a finding naming the evidence
    // it points at. It may NOT be folded because the front matter happens to
    // name it: "Marketing Promotion Revenue - Intel Campaign" matches the scope
    // bullet "• Marketing Promotion Revenue" word for word, and folding on that
    // turned an evidence annexure into a twelfth copy of a finding and took the
    // evidence off the review screen. Whole-region exclusion was tried and is
    // wrong: the findings themselves sit in that region too.
    return listed.some(l => l.section !== index
      && (!inAnnexure(index) || inAnnexure(l.section))
      && agree(words, l.words));
  };
  /** Which parts list this title, for the single-page case below. */
  const listedBy = (name: string, index: number) => {
    const words = new Set(itemKey(name).split(' ').filter(Boolean));
    return listed.some(l => l.section === index && agree(words, l.words));
  };

  const out: SpineSection[] = [];
  /** Where the last emitted section sat in the original spine, so a single page
   *  can be tested against the part it actually follows. */
  let hostIdx = -1;
  let i = 0;
  while (i < spine.length) {
    let run = 0;
    while (i + run < spine.length && isFindingTitle(spine[i + run].name, i + run)) run++;
    // Two or more in a row is the format stamping the same shape per finding.
    // ONE page is only that if the part just above it is the part that lists
    // it — otherwise it is an ordinary section that happens to be mentioned
    // somewhere, and folding it away would lose it.
    const listedByHost = run === 1 && hostIdx >= 0 && listedBy(spine[i].name, hostIdx);
    if (run === 0 || (run === 1 && !listedByHost)) {
      out.push(spine[i]);
      hostIdx = i;
      i++;
      continue;
    }

    // Each repetition keeps its OWN heading as its first line. That heading is
    // where a consultant report puts the rating — "5. Improve monitoring of O2O
    // COD balances  M" — so a stamp that drops its headings is a stamp nothing
    // can prove is rated, and the findings are lost for want of one letter.
    const reps = Array.from({ length: run }, (_, k) => spine[i + k]).flatMap(section => {
      // A member that is ALREADY a stamp brings its own repetitions with it.
      // Flattening them keeps the count honest: two finding slides folded under
      // their snapshot are two findings, not one repetition of a pair.
      if (section.stamp?.length) return section.stamp;
      const anchor = section.lines[0];
      const title: Line = {
        text: section.name,
        cells: [{ text: section.name, x: 0, right: 0 }],
        x: 0, y: 0, size: anchor?.size ?? 10, bold: true, page: section.page,
      };
      return [[title, ...section.lines]];
    });
    const host = out[out.length - 1];
    if (host) {
      // The snapshot keeps its OWN shape — its count table, its chart — and
      // gains the stamp underneath it. Its lines are left alone, which is what
      // tells the classifier the stamp is an addition rather than the whole
      // section.
      host.stamp = reps;
    } else {
      out.push({ ...spine[i], name: 'Findings', stamp: reps, lines: reps[0] });
    }
    i += run;
  }

  // …and the same page can sit anywhere. A written report puts its observation
  // detail pages after the annexures, or between them, so a run is not always a
  // run. Any part still standing whose heading the report lists among its rated
  // observations is another repetition of that stamp, wherever it ended up.
  const homeOf = (name: string) => {
    const words = new Set(itemKey(name).split(' ').filter(Boolean));
    const hit = listed.find(l => agree(words, l.words));
    return hit ? spine[hit.section] : undefined;
  };
  const scattered: SpineSection[] = [];
  for (const section of out) {
    if (section.stamp || !isFindingTitle(section.name, spine.indexOf(section))) continue;
    const home = homeOf(section.name);
    const host = home && out.find(o => o === home || o.name === home.name);
    if (!host || host === section) continue;
    const anchor = section.lines[0];
    const title: Line = {
      text: section.name,
      cells: [{ text: section.name, x: 0, right: 0 }],
      x: 0, y: 0, size: anchor?.size ?? 10, bold: true, page: section.page,
    };
    host.stamp = [...(host.stamp ?? []), [title, ...section.lines]];
    scattered.push(section);
  }
  return out.filter(s => !scattered.includes(s));
}

/**
 * The last read, block by block, with the verdict each block got. Six separate
 * passes only pay off if a wrong result can be traced to the pass that failed,
 * and a section that was left out carries no trace of why in the result itself.
 * Overwritten by every read, never persisted, never shown to the client.
 */
export const lastRead: {
  section: string;
  blocks: { kind: string; label?: string; columns?: string[]; lines: string[] }[];
  verdicts: string[];
}[] = [];

export function assemble(input: AssembleInput): ReadResult {
  const { tree, body, bodySize, pageCount, snapshots, coverColor, classify } = input;
  lastRead.length = 0;
  {
    const furnished = { furniture: input.furniture, body, headerLines: new Set<string>() };
    const unpacked = { pageCount, coverColor, snapshots, bodySize };

    const bodyText = furnished.body.flat().map(l => l.text).join('\n');
    const { findingScale, opinionScale } = detectScales(bodyText);

    // Does this document carry a committee cover sheet? One standing heading
    // proves nothing — "Recommendations" is a section we keep — so it takes
    // two or more of the form's headings before the run can be named as one.
    const coverSheet = tree.spine.filter(s => COMMITTEE_FORM.test(s.name)).length >= 2;

    // The document's own finding reference shape, read once so every section's
    // tables can be tested against it (check 3).
    const docIdPattern = (bodyText.match(new RegExp(FINDING_ID.source, 'g')) ?? [])
      .map(generalisePattern)
      .sort((a, b) => a.length - b.length)[0];

    // The organisations this report names, taken from its own letterhead and
    // cover. A block repeating one of them is that report's wording, not the
    // client's format.
    const orgNames = [
      ...(furnished.furniture?.header ?? []),
      ...(furnished.furniture?.footer ?? []),
      ...tree.cover.map(l => l.text),
    ].flatMap(line => {
      const hit = line.match(ORG_NAME);
      return hit ? [hit[0].trim()] : [];
    });

    // Every line in the report that carries a rating word. A committee deck
    // rates its findings once, in a snapshot table, and the slides that follow
    // carry no rating at all — so a repeating part is allowed to take its
    // rating from here (check 1).
    const scaleRe = findingScale?.length
      ? new RegExp(`\\b(${findingScale.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i')
      : null;
    const ratedLines = scaleRe
      ? furnished.body.flat().map(l => l.text).filter(t => scaleRe.test(t) && t.trim().length > 8)
      : [];

    // A summary table often rates by COLUMN rather than by word: the header row
    // reads "No. · High · Medium · Low" and each row carries a tick under the
    // level that applies, so not one row says a rating word. The page it sits on
    // is rating everything it lists, so those rows join the rated lines — minus
    // the definitions page, which says the same words while listing nothing.
    if (findingScale?.length) {
      const wordCount = (t: string) => findingScale.filter(w => new RegExp(`\\b${w}\\b`, 'i').test(t)).length;
      for (const page of furnished.body) {
        const text = page.map(l => l.text).join('\n');
        if (!page.some(l => wordCount(l.text) >= 2)) continue;
        if (FIXED_NAME.test(text)) continue;                   // a definitions page rates nothing
        for (const line of page) {
          const clean = line.text.trim();
          if (clean.length <= 12 || clean.split(/\s+/).length < 3) continue;
          // THE PAGE'S OWN HEADING NAMES THE PAGE. It is never one of the rows
          // it lists, however many rating words its neighbours carry. Missed,
          // it becomes a false ratedLine match, `foldRatedRun` then reads the
          // section's own title as "a finding" and folds the ROLLUP PAGE ITSELF
          // in as the stamp's first repetition — so the card shape stored for
          // "the finding" is a summary table's columns, not a real finding's
          // fields, and the count comes out one page over what is really there.
          // The PwC "C. Overview of observations" page is the caught case: nine
          // named findings, a stamp of twelve, because the rollup heading and
          // a continued page both counted as findings of their own.
          if (headingOf(line, bodySize)) continue;
          ratedLines.push(clean);
        }
      }
    }

    // Which annexures the findings point AT. "Refer Annexure 1.1" in a finding
    // means annexure 1.1 holds that finding's own exception rows (check 6).
    // Naming it IS pointing at it. Some reports write "Refer Annexure 1.1" and
    // some just write "(Annexure 2a)" beside the finding, and both mean the
    // same thing: the records behind this finding are over there.
    const pointedAt = new Set<string>();
    const annexureLabel = /\b(annexure|appendix|exhibit|schedule)\s*[-–—:]?\s*([A-Za-z0-9]+(?:\.\d+)*)/gi;
    for (const line of furnished.body.flat()) {
      for (const hit of line.text.matchAll(annexureLabel)) {
        // The annexure's own title page names it too, so a label only counts as
        // a pointer when something else sits on the line with it.
        if (line.text.trim().length <= hit[0].length + 3) continue;
        pointedAt.add(`${hit[1].toLowerCase()} ${hit[2].toLowerCase()}`);
      }
    }
    // A RATING LETTER GLUED TO A TITLE IS NOT PART OF THE TITLE. Consultant
    // reports print the level as a single letter on the end of the finding's
    // own heading — "Improve controls over contract management H". Left there
    // it becomes part of the name, so the template ships a part called
    // "…contract management H", and the rating the letter was carrying is read
    // by nothing, because the word-based scan never matches a bare initial.
    // Parsed off, and the original heading joins the rated lines, which is
    // where the letter was trying to get to in the first place.
    const unlettered = stripTitleRatings(tree.spine, findingScale, ratedLines);

    // THE ANNEXURE REGION, READ BEFORE THE FOLD. It used to be worked out from
    // the folded list, which is one step too late: the fold had already taken
    // an evidence annexure for a repetition of the finding that points at it,
    // and by the time "linkage outranks topic" was applied there was nothing
    // left to apply it to. Same rule, same divider, just early enough to be
    // heard — and computed twice on purpose, because folding renumbers the
    // sections and the classifier below needs the folded indices.
    const annexDivider = /^(annexures?|appendices|appendix)\b/i;
    const annexureRegion = (list: SpineSection[]) => {
      const start = list.findIndex(sec =>
        annexDivider.test(sec.name.trim())
        || sec.lines.some(l => annexDivider.test(l.text.trim()) && l.text.trim().length <= 40));
      return (index: number) => start >= 0 && index > start && pointedAt.size >= 2;
    };

    // The tree, with its repeats folded: one stamp per finding, orphan pages
    // joined back to the part they continue. Everything after this reads the
    // folded list, so section positions mean the same thing throughout.
    const prefold = foldOrphanPages(foldObservationFrames(unlettered));
    const folded = foldRatedRun(prefold, ratedLines, annexureRegion(prefold));

    // THE ANNEXURE REGION. A report's evidence does not always announce itself
    // in every heading: one divider page reads "Annexures (Part 1)" and the
    // pages after it carry their own titles, some of which sound financial
    // ("Marketing Promotion Revenue — Intel Campaign"). LINKAGE OUTRANKS TOPIC:
    // if the findings point at the annexures at all, everything past that
    // divider is the evidence they point at, whatever it is titled. The money
    // rule still bars financial content NO finding points at — a revenue
    // overview page in the body of the report.
    const annexStart = folded.findIndex(sec =>
      annexDivider.test(sec.name.trim())
      || sec.lines.some(l => annexDivider.test(l.text.trim()) && l.text.trim().length <= 40));
    // …but the linkage has to be real. A report that mentions an appendix ONCE,
    // to send the reader to a definitions page ("see Appendix C for the
    // assurance levels"), is not pointing at evidence, and treating its back
    // pages as evidence prints exception rows under a management action plan
    // and under a page of definitions. So the region needs pointers the
    // findings actually made: a label named in a line that says something else
    // too, more than once.
    const findingsCiteAnnexures = pointedAt.size >= 2;
    const inAnnexureRegion = (index: number) =>
      annexStart >= 0 && index > annexStart && findingsCiteAnnexures;

    /** Does this section's heading name an annexure a finding points at? */
    const isEvidenceTarget = (name: string) => {
      // "Annexure 2a" and "Annexure 1.1" alike: the label is whatever the
      // report numbers them with, letters and all.
      const hit = name.match(/\b(annexure|appendix|exhibit|schedule)\s*[-–—:]?\s*([A-Za-z0-9]+(?:\.\d+)*)/i);
      if (!hit) return false;
      return pointedAt.has(`${hit[1].toLowerCase()} ${hit[2].toLowerCase()}`);
    };

    // The report's own details, read from the cover before detection rather
    // than after it, because a fixed frame needs to know which values are
    // report details and which are this quarter's data.
    const details = deriveFields([...tree.cover, ...furnished.body.flat().slice(0, 60)]);

    // One finding per page or per slide, with the ratings living back in the
    // snapshot table: each of those pages became its own section, named after
    // the finding it carries. They are not sections, they are one stamp, so
    // they fold into the part that rates them before anything is classified.
    const rawSections = folded.map((s, index) => ({ s, index, raw: classify(s) }));

    // Fingerprint 4 needs to know what the document repeats word for word, so
    // the whole report is counted once before either detector runs.
    const repeats = new Map<string, number>();
    for (const { raw } of rawSections) {
      for (const rb of raw) {
        const key = bodyKey(rb.lines);
        if (key) repeats.set(key, (repeats.get(key) ?? 0) + 1);
      }
    }

    const sections: ReadSection[] = [];
    const dropped: ReadDropped[] = [];

    /**
     * THE ONE DOOR OUT. Every section-level drop goes through here, and here
     * the invariant is enforced rather than described: a dropped section that
     * still holds kept blocks is an impossible state, so the run fails loudly
     * at the offending line instead of quietly emitting the drop.
     *
     * This is deliberately a throw. Five separate breaks survived the rule
     * while it was written down as advice — an impression overriding seven
     * kept blocks, a heading swallowing the document and then being verdicted,
     * blocks made the only judge and taking the findings section with them —
     * and each one shipped a template with the client's own report missing
     * from it. A read that would produce that is not a read worth returning,
     * and the caller already turns a thrown read into an honest "we could not
     * read this file" rather than a silently wrong template.
     */
    const dropSection = (kept: ReadBlock[], row: ReadDropped) => {
      if (kept.length > 0) {
        throw new Error(
          `BYOT invariant: "${row.name}" was dropped while holding ${kept.length} kept `
          + `block${kept.length === 1 ? '' : 's'} (${kept.map(b => b.fill).join(', ')}). `
          + 'Keeps flow up and drops never flow down: fix the check that claimed the block, '
          + `or the veto that took the section. Reason given: ${row.why}`,
        );
      }
      dropped.push(row);
    };
    // Position: a rollup only rolls up what came before it, so the findings
    // have to have appeared already for a recommendations heading to count.
    let findingsSeen = false;
    const signoffRoles: string[] = [];
    // Does this report have anything to roll up at all? A findings card or a
    // section that says so, and equally a report that words its problems as
    // RECOMMENDATIONS from end to end — a written council report has no
    // "Findings" heading anywhere and still raises one recommendation per
    // problem. Rated lines say the same thing: something in here is graded.
    // Without this, "Summary of Recommendations" is left out of a report that
    // is nothing but recommendations, which is the caught case in the memo.
    const docHasFindings = rawSections.some(({ s: sec, raw }) =>
      raw.some(b => b.kind === 'cards')
      || /\b(findings?|observations?|exceptions?|recommendations?)\b/i.test(sec.name))
      || ratedLines.length > 0;

    for (const { s, index, raw } of rawSections) {
      // A severity-split section ("Detailed findings — medium") is one
      // repeating card plus a filter, not a second card shape. Without the
      // filter each section claims every finding and generation stamps all of
      // them into all of the sections.
      const severity = (findingScale ?? []).find(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s.name));

      // A legend, counted across the whole section rather than block by block:
      // their scale words with an explanation beside each.
      const legendWords = [...(findingScale ?? []), ...(opinionScale ?? [])];
      const definitionSection = raw.reduce((n, rb) => n + definitionRowCount(rb.lines, legendWords), 0) >= 2;

      const ctx: DetectContext = {
        scale: findingScale,
        orgNames,
        definitionWords: legendWords,
        definitionSection,
        idPattern: docIdPattern,
        repeats,
        sectionName: s.name,
        concept: conceptOf(s.name, findingsSeen, docHasFindings),
        ratedLines,
        // Definitions outrank the region. A page that explains the words —
        // rating criteria, assurance levels — is fixed wording wherever it
        // sits, and claiming it as evidence would print exception rows under
        // the client's own scale.
        evidenceTarget: (isEvidenceTarget(s.name) || inAnnexureRegion(index))
          && !FIXED_NAME.test(s.name) && !definitionSection,
        scopeSection: SCOPE_NAME.test(s.name) && !PRIOR_PERIOD.test(s.name),
        details,
      };
      const firstProseIndex = raw.findIndex(b => b.kind === 'narrative' || b.kind === 'callout');
      const verdicts = raw.map((rb, i) => detectBlock(rb, ctx, i === firstProseIndex));

      lastRead.push({
        section: s.name,
        blocks: raw.map(b => ({ kind: b.kind, label: b.label, columns: b.columns, lines: b.lines.slice(0, 24) })),
        verdicts: verdicts.map(v => `${v.keep ?? 'out'} — ${v.why}`),
      });

      // The data list has the last word, and it takes it here — before a single
      // block is kept — so that no verdict ever has to reach back over a keep.
      // Two of the reasons outrank everything, findings and all: the year's
      // plan covers other audits, and last audit's actions are something we do
      // not track, so a stamp of finding cards inside one of those is still a
      // part we cannot fill. The rest defer to a rated card or to evidence a
      // finding points at, so a findings section is never lost for mentioning
      // money or a management response, and linkage still outranks topic.
      const body = s.lines.map(l => l.text).join('\n');
      const vetoOutranksCards = AUDIT_PLAN.test(s.name) || PRIOR_PERIOD.test(s.name);
      // The exemption is the SECTION's, not the block's. A rated card or
      // evidence a finding points at proves the part is ours whatever its
      // heading sounds like, and once that is proved the heading has no say
      // over anything else in it either — an "Executive summary and audit
      // opinion" holding finding cards keeps its summary prose too, and
      // linkage still outranks topic on the annexure beside it. Read per block
      // instead, the same heading strips four rollup blocks out of a section
      // it just admitted was ours.
      const exempt = !vetoOutranksCards
        && verdicts.some((v, i) => v.keep === 'query' && (v.binding === 'evidence' || raw[i].kind === 'cards'));
      const claimVeto = exempt ? undefined : claimVetoReason(s.name, body);

      // Only the blocks a detector claimed survive. A kept section is their
      // shape around our data, never a shape with an empty box in it.
      const blocks: ReadBlock[] = [];
      const kinds: Detected[] = [];
      // Blocks the veto took. They are not sections of their own and never
      // become any — they go to the left-out list with the reason that took
      // them, so a client reading it sees the same words either way.
      const vetoed: string[] = [];
      raw.forEach((rb, i) => {
        const v = verdicts[i];
        if (!v.keep) return;
        // The veto is about CLAIMS. A heading stops us claiming to fill a part
        // from data we do not hold — but wording kept word for word claims
        // nothing, so a block of fixed text survives its section's heading.
        // Their standard limitation paragraph is the caught case: boilerplate
        // that prints unchanged, taken out by a reason written for a
        // limitations page we could not place.
        if (claimVeto && v.keep === 'query') {
          vetoed.push(rb.label?.trim() || `${s.name} · ${VETOED_BLOCK_NOUN[rb.kind]}`);
          return;
        }
        const { lines, ...rest } = rb;
        // A header whose rows were lost is saved as the table it is, not as the
        // prose it looked like, or the template keeps their column names in a
        // paragraph nothing can fill.
        const salvaged = v.keep === 'query' && v.binding === 'evidence' && rb.kind === 'narrative'
          ? headerOnlyColumns(lines)
          : null;
        blocks.push({
          ...rest,
          ...(salvaged ? { kind: 'table' as const, columns: salvaged } : {}),
          ...(severity && rb.kind === 'cards' ? { severity } : {}),
          fill: v.keep,
          binding: v.keep === 'query' ? v.binding : undefined,
          // Fixed text is the one deliberate exception to throwing content
          // away: the words themselves must survive to print unchanged.
          // A frame keeps their wording with the report details as blanks, so
          // the fixed body is the tokenised one, not the original sentence.
          fixedBody: v.keep === 'fixed' ? (v.fixedBody ?? lines).slice(0, 20) : undefined,
          frame: v.keep === 'fixed' && v.frame ? true : undefined,
          // Their old report's boilerplate was written by whoever ran that
          // engagement. Kept as a draft in that voice, flagged until the client
          // says it speaks for them.
          authored: v.keep === 'fixed' && v.authored ? true : undefined,
          preview: lines.slice(0, 2),
        });
        kinds.push(v);
      });

      // A HALF YES IS NEVER A NO. A section where one block matched and the
      // rest did not used to be dropped as "only a scrap matched" — which is
      // the detector doing the review screen's job, and it cost us the page
      // that defines the client's own rating words. Whatever matched is kept,
      // the section is flagged, and the client unticks it in one click if we
      // were wrong.

      // Once a section has carried the findings, everything after it can roll
      // them up.
      // …and a report that words its problems as recommendations has carried
      // them once its recommendations section has been and gone.
      if (raw.some(b => b.kind === 'cards')
        || /\b(findings?|observations?|exceptions?|recommendations?)\b/i.test(s.name)) findingsSeen = true;

      const signRoles = raw.find(b => b.kind === 'signoff' && (b.signRoles?.length ?? 0) > 0)?.signRoles;
      if (signRoles?.length) signoffRoles.push(...signRoles.filter(r => !signoffRoles.includes(r)));

      // Blocks the claim veto took, listed one by one with the reason that took
      // them. They are not sections and never become any — this is the whole of
      // where an unkept block inside a kept section goes.
      if (claimVeto) for (const name of vetoed) dropped.push({ name, why: claimVeto, block: true });

      const nothingKept = blocks.length === 0;
      // Every reason is now behind one gate inside `notHeldReason`: a section
      // that kept something cannot be left out, whatever its heading says. The
      // data-availability reasons already ran, as vetoes, before the keeps.
      const notHeld = notHeldReason(s.name, body, nothingKept, coverSheet);
      if (notHeld) {
        dropSection(blocks, { name: s.name, why: notHeld });
        continue;
      }

      if (nothingKept) {
        if (signRoles?.length) {
          dropSection(blocks, {
            name: s.name,
            captured: true,
            why: 'Saved as a setting: the signature page, with the job titles it is signed off by.',
          });
          continue;
        }
        // The named reasons were already tried above, so anything reaching here
        // is a part we genuinely could not place. That is the only case the
        // generic line is for: on a recognisable part it just invites "why did
        // you remove this?".
        dropSection(blocks, {
          name: s.name,
          why: 'Not included: nothing here comes from audit results, and it is not wording that never changes.',
        });
        continue;
      }

      // The badge names what the section is: data first, because that is the
      // claim that decides what gets written.
      const lead = kinds.find(k => k.keep === 'query') ?? kinds[0];
      const fill: SectionFill = lead.keep === 'query' ? 'query' : 'fixed';

      const description = describe(s, fill, blocks, severity);
      // The four situations, in the order the client would notice them: a
      // tension inside the evidence, a merge they should confirm, a part read
      // without labels, and a line we could not write. Never more than one, so
      // the card states one thing to look at rather than a list of doubts.
      //
      // An inferred heading IS the unlabelled case, whichever reader saw the
      // file: nothing in it said "this line is the heading", so we went by size
      // and position. That covers the free-hand deck, the deck saved to PDF
      // with its labels burnt away, and the plain PDF that never had any.
      const flag: CheckReason | undefined =
        kinds.find(k => k.flag)?.flag
        ?? (s.twin ? 'twins' : undefined)
        ?? (s.evidence === 'inferred' ? 'unlabelled' : undefined)
        ?? (description ? undefined : 'no-line');

      sections.push({
        name: s.name,
        description,
        fill,
        fillReason: lead.why,
        binding: fill === 'query' ? blocks.find(b => b.binding)?.binding : undefined,
        blocks,
        evidence: s.evidence,
        // The section's own confidence is about the HEADING: was this really a
        // section? Any of the four flags pulls it into the check queue too,
        // which is exactly what review is for.
        confidence: flag ? Math.min(s.confidence, 0.65) : s.confidence,
        flag,
        page: s.page,
        appendix: s.appendix || undefined,
        wrapper: s.wrapper || undefined,
        source: s.lines.filter(l => !l.text.startsWith('§§')).slice(0, 2).map(l => l.text),
      });
    }

    // Once the report splits its findings by severity, every finding already
    // has exactly one home. Another card stamp somewhere else would print the
    // same findings a second time, so it is dropped and the section keeps the
    // prose that summarises them.
    if (sections.some(sec => sec.blocks.some(b => b.kind === 'cards' && b.severity))) {
      for (const sec of sections) {
        sec.blocks = sec.blocks.filter(b => b.kind !== 'cards' || b.severity);
      }
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].blocks.length > 0) continue;
        dropped.push({ name: sections[i].name, why: 'Not included: these findings already have a home in the sections split by rating.' });
        sections.splice(i, 1);
      }
    }

    dedupeDescriptions(sections);
    // The de-dupe can leave a section with no line at all: a rewrite carrying a
    // count is thrown out rather than judged, so the no-line flag is settled
    // after it rather than before.
    for (const sec of sections) {
      if (sec.description || sec.flag) continue;
      sec.flag = 'no-line';
      sec.confidence = Math.min(sec.confidence, 0.65);
    }
    linkRepeatedBlocks(sections);

    // THE TREE: query → finding → exceptions. An evidence annexure holds the
    // exception rows behind ONE finding, so annexure 1 is the first finding's
    // records and annexure 2 the second's. Numbering them here is what stops
    // every annexure in the template printing the same rows.
    // Numbered per ANNEXURE, not per block: one annexure is one finding's
    // records, and a grid the reader broke into three tables is still that one
    // finding's records.
    let evidenceSeen = 0;
    for (const sec of sections) {
      const mine = sec.blocks.filter(b => b.binding === 'evidence');
      if (mine.length === 0) continue;
      const index = evidenceSeen++;
      for (const b of mine) b.evidenceIndex = index;
    }

    // The cover's own label and value pairs land as pre filled settings, so a
    // cover title is captured as a setting instead of leaking in as a section.
    let furniture = furnished.furniture;
    const coverFields = deriveFields(tree.cover);
    if (!coverFields.auditTitle) {
      // The biggest line on the cover that reads like a title: not the web
      // address in the corner, not a reference code, not a label.
      const title = [...tree.cover]
        .filter(l =>
          l.text.trim().split(/\s+/).length >= 2 &&
          l.text.length >= 8 &&
          !CONFIDENTIAL.test(l.text) &&
          !/[::]$/.test(l.text) &&
          !/(https?:\/\/|www\.|\.com|\.co\.|\.org|\.net|@)/i.test(l.text) &&
          !/^[A-Z]?\d[\d/-]{2,}/.test(l.text.trim()))
        .sort((a, b) => b.size - a.size)[0]?.text;
      if (title) coverFields.auditTitle = title.trim();
    }
    if (furniture) furniture = { ...furniture, fields: coverFields };
    else if (Object.keys(coverFields).length) furniture = { header: [], footer: [], fields: coverFields };

    // A closing page is shape rather than writing, so it is reported as kept,
    // not as dropped. Saying "not included" about something we did keep is the
    // kind of lying label the review screen exists to avoid.
    if (input.closing) {
      dropped.push({
        name: 'Closing page',
        captured: true,
        why: 'Saved as a setting: your closing page, printed at the end of every report exactly as it is.',
      });
    }

    return {
      furniture,
      sections,
      skipped: tree.skipped.filter(name => !sections.some(s => norm(s.name) === norm(name))),
      dropped,
      pageCount: unpacked.pageCount,
      pages: unpacked.snapshots.length ? unpacked.snapshots : undefined,
      snapshotLimit: SNAPSHOT_MAX,
      findingScale,
      opinionScale,
      coverColor: unpacked.coverColor,
      toc: tree.toc,
      signoff: signoffRoles.length ? { roles: signoffRoles } : undefined,
      closing: input.closing,
      logo: input.logo,
    };
  }
}

/**
 * Passes 4 and 5 for a section that REPEATS AS A WHOLE, whichever reader found
 * it: a run of slides once per finding, or the same section once per warehouse,
 * location or audit. Without a stamp it is the ordinary two passes, so one call
 * covers both kinds of section.
 */
export function classifyStamped(section: SpineSection, bodySize: number): RawBlock[] {
  // One repetition is still a stamp: a part folded in as "one per finding" with
  // a single finding in this particular report keeps the shape, and the count
  // is never what the template stores anyway.
  if (!section.stamp || section.stamp.length === 0) {
    return passSpotRepeats(passClassifyBlocks(section, bodySize));
  }

  // One stamp, saved once. The shape comes from the first repetition and the
  // count goes with it; nothing from repetitions two onward is kept, which is
  // what makes the template hold no content.
  const first = passClassifyBlocks({ ...section, lines: section.stamp[0] }, bodySize);
  const lines = section.stamp[0].map(l => l.text);
  const fields = cardFieldsFrom(lines);
  const labels = first.map(b => b.label).filter((l): l is string => !!l);

  // Every box the card carries, however it was labelled: the ones written
  // "Observation:" in the body, and the ones the reader folded in as their own
  // slide or sub-heading. Taking only the first kind loses the box that makes
  // the pair — a card with an issue and no action is not claimed, and their
  // findings are dropped over a colon.
  const boxes = [...fields.fields];
  for (const label of labels) {
    if (!boxes.some(f => f.toLowerCase() === label.toLowerCase())) boxes.push(label);
  }

  const card: RawBlock = {
    kind: 'cards',
    cardCount: section.stamp.length,
    cardFields: section.frameFields?.length ? section.frameFields
      : boxes.length ? boxes : undefined,
    humanFields: fields.human.length ? fields.human : undefined,
    columns: first.find(b => b.kind === 'table')?.columns,
    confidence: 0.88,
    page: section.page,
    lines,
  };

  // Whose lines are these? When the section IS the stamp — a run of slides
  // repeating as one part — the card is the whole section. When the stamp was
  // folded INTO a part that has its own body, that body is kept too: the
  // snapshot's count table and chart are not thrown away by the findings
  // landing underneath them.
  return section.lines === section.stamp[0]
    ? [card]
    : [...passSpotRepeats(passClassifyBlocks(section, bodySize)), card];
}

// ═══ A PDF that is really a deck ═════════════════════════════════════════════
// Pass 3, replaced. Everything else about the read is unchanged, because only
// the way the parts are found differs: pass 2 has already lifted the running
// furniture out, and passes 4 to 6 never cared where a section came from.

function deckShapedTree(furnished: Furnished, findingScale?: string[]): Tree {
  const cover: Line[] = [];
  let docEntries = 0;
  const units: DeckUnit[] = [];

  // A RUNNING SECTION TITLE OUTRANKS THE PAGE'S OWN HEADING, the same way a
  // deck's title box does — tracked across the loop below as a run of
  // consecutive pages sharing one top-band candidate.
  let runningTitle: string | null = null;
  let runLength = 0;

  furnished.body.forEach((page, pi) => {
    const lines = page.filter(l => l.text.trim() && !BLANK_PAGE.test(l.text.trim()));
    if (lines.length === 0) return;

    // Page one is the letterhead, the same way slide one is.
    if (pi === 0) { cover.push(...lines); return; }

    let heading = pageHeading(lines);

    // Their own contents page is never copied; our export engine builds one.
    // It is read only as the sanity check. A deck rarely titles the page
    // "Contents": it prints a two-column list of section and page number, and
    // that shape is the giveaway. Left unrecognised it becomes a section, and
    // the review screen then reports their contents page as something we
    // dropped.
    const pageRows = lines.filter(l => l.cells.length >= 2 && /^\s*\d{1,3}\s*$/.test(l.cells[l.cells.length - 1].text)).length;
    const contentsHeader = lines.some(l =>
      l.cells.length >= 2 && /^(section|particulars?|topic|chapter|contents?|sr\.?|#)$/i.test(l.cells[0].text.trim())
      && /page/i.test(l.cells[l.cells.length - 1].text));
    if ((heading && CONTENTS.test(heading.text.trim())) || (contentsHeader && pageRows >= 3)) {
      docEntries += Math.max(0, lines.length - 1);
      return;
    }

    // pageHeading() picks the BIGGEST candidate in the top band, on ONE page,
    // in isolation. A written report exported to PDF often prints its current
    // section's own title as a running header — bigger than the real,
    // page-specific heading underneath it ("Executive summary" at 20pt over
    // "B. Overview of Revenue & Payouts" at 14pt) — and with no cross-page
    // memory, every page of that section reads the running header as ITS
    // heading. headKey folding below then merges them all into one section,
    // and every real sub-heading in between is never seen again — just body
    // text inside one giant block. The tell is repetition, exactly as it is
    // for a deck's title box (§09): the SAME candidate on two or more pages
    // running is furniture, and the real heading is what pageHeading finds
    // once that text is taken out of the running. First occurrence is kept —
    // that page is genuinely where the section starts.
    const key = heading ? norm(heading.text) : null;
    runLength = key && key === runningTitle ? runLength + 1 : 1;
    runningTitle = key;
    if (runLength >= 2 && heading) {
      const runningKey = key;
      heading = pageHeading(lines.filter(l => norm(l.text) !== runningKey));
    }

    // "The section name repeated at the top of its pages becomes furniture."
    // Pass 2 only strikes what repeats across the WHOLE document, so a heading
    // that runs for three pages of one part survives it. Here it is dropped
    // from the body of every page after the first, which is what stops one
    // part being read as three. The running title itself is dropped from the
    // body too, whether or not it ended up chosen as this page's heading.
    const body = lines.filter(l =>
      norm(l.text) !== runningTitle && (!heading || norm(l.text) !== norm(heading.text)));

    units.push({
      n: pi + 1,
      heading,
      lines: body,
      signature: pageSignature(lines),
      divider: pageIsDivider(lines),
    });
  });

  // A run of pages saying the same thing at the top is one part spilling over,
  // not one part per page. They fold into the first of the run before the deck
  // rules count anything.
  const folded: DeckUnit[] = [];
  // A RATING LETTER GLUED TO THE TITLE BREAKS THE MATCH, the same way it broke
  // a section's own heading (§05): a consultant deck's running-header repeats
  // "2. Improve controls over contract management  H" on every page of that
  // finding, but the FIRST page carries only the bare letter while a later,
  // continued page adds "(contd.)" in front of it — "…management H" and
  // "…management (contd.) H" then normalize to two different strings and the
  // pages never fold into one, so the finding comes back as two. Guarded the
  // same way stripTitleRatings is: needs two or more distinct scale initials
  // and a three-or-more-word head, so "Annexure A" keeps its letter and is
  // never mistaken for a rating.
  const initials = new Set((findingScale ?? []).map(w => w.trim().charAt(0).toUpperCase()).filter(Boolean));
  const unlettered = (text: string): string => {
    if (initials.size < 2) return text;
    const m = /^(.*\S)\s+[([]?([A-Za-z])[)\]]?[.\s]*$/.exec(text);
    if (!m || !initials.has(m[2].toUpperCase())) return text;
    return m[1].trim().split(/\s+/).length >= 3 ? m[1].trim() : text;
  };
  // "…(continued)" is the same part carrying on, so the suffix comes off before
  // the two headings are compared. Without that, one observation running over
  // two pages reads as two observations.
  const headKey = (h?: { text: string }) => (h ? norm(unlettered(h.text).replace(CONTINUED, '').trim()) : '');
  for (const unit of units) {
    const previous = folded[folded.length - 1];
    if (previous?.heading && unit.heading && headKey(previous.heading) === headKey(unit.heading)) {
      previous.lines.push(...unit.lines);
      continue;
    }
    folded.push(unit);
  }

  return buildDeckTree(folded, cover, docEntries);
}

// ═══ The PDF entry point ═════════════════════════════════════════════════════

export async function readTemplateFromPdf(file: File): Promise<ReadOutcome> {
  if (file.size > MAX_BYTES) return { ok: false, reason: 'too-large' };

  try {
    const pdfjs = await getPdfjs();
    const buf = await file.arrayBuffer();
    let doc: PdfDoc;
    try {
      doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise as unknown as PdfDoc;
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'PasswordException') return { ok: false, reason: 'password' };
      return { ok: false, reason: 'unreadable' };
    }
    if (doc.numPages > PAGE_CAP) {
      const pageCount = doc.numPages;
      await doc.destroy();
      return { ok: false, reason: 'too-long', pageCount };
    }

    const unpacked = await passUnpack(doc);
    await doc.destroy();
    // A scanned PDF is a photo of paper with no text inside. Said honestly,
    // never a silent failure or a fabricated outline.
    if (unpacked.textItems === 0) return { ok: false, reason: 'scanned', pageCount: unpacked.pageCount };

    const furnished = passRemoveFurniture(unpacked);

    // THE FILE'S ENDING PICKED THIS READER. THE DOCUMENT'S SHAPE PICKS THE
    // RULES. A consultant report is very often a deck saved to PDF before
    // upload: its labels are burnt away, so it lands here, and if we then look
    // for numbered headings and stitched paragraphs we find neither and
    // extract nothing at all.
    const shape = looksLikeADeck(
      furnished.body,
      unpacked.aspects,
      (furnished.furniture?.header.length ?? 0) + (furnished.furniture?.footer.length ?? 0) > 0
        || !!furnished.furniture?.pageNumberPattern,
    );
    // The scale, read early rather than only inside assemble(), because
    // deckShapedTree needs it too: a consultant deck glues the finding's own
    // rating letter onto its running-header title, on every page including its
    // continuations, and only the client's own scale says which trailing
    // letter is a rating rather than real title content ("Annexure A" keeps
    // its A). assemble() re-detects the same way afterwards — a second call on
    // the same pure function, not a second source of truth.
    const { findingScale: deckScale } = detectScales(furnished.body.flat().map(l => l.text).join('\n'));
    const tree = shape.isDeck
      ? deckShapedTree(furnished, deckScale)
      : passBuildTree(furnished, unpacked);

    return {
      ok: true,
      result: assemble({
        tree,
        furniture: furnished.furniture,
        body: furnished.body,
        bodySize: unpacked.bodySize,
        pageCount: unpacked.pageCount,
        snapshots: unpacked.snapshots,
        coverColor: unpacked.coverColor,
        // A stamp is folded into one card whichever reader found it: a run of
        // slides in a deck, or the same section repeated once per location in
        // a document. classifyStamped falls back to the ordinary passes when
        // there is no stamp, so one call covers both.
        classify: s => classifyStamped(s, unpacked.bodySize),
      }),
    };
  } catch (err) {
    // Loud where it can be heard. The client gets an honest decline either
    // way, but a swallowed invariant break is the same silence that let five
    // of them ship, so the message reaches the console with the section named.
    console.error('[byot] read failed', err);
    return { ok: false, reason: 'unreadable' };
  }
}
