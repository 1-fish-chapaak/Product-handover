// Matching a detected heading to a known fill source (Template Studio §
// "Matching a detected section to a data source").
//
// When a report is imported, each detected heading is matched against the
// sections we know how to fill. A known name maps straight to its source; a
// synonym maps once the auditor confirms the alias; a narrative heading we have
// no query source for carries its own text; a kpi/chart/table placeholder needs
// a query binding; anything else is shown unmatched for the user to resolve.
//
// The synonym list is seeded from the 37 real reports and is editable — an
// auditor confirms a new alias once and it sticks.

import type { SectionMatch } from './sectionReviewShared';

/** A section we know how to fill, plus the source it fills from. `narrative` marks
 *  a section that carries the author's own text (no query source), so importing it
 *  never waits on a binding. */
type KnownSection = {
  /** Canonical display name. */
  name: string;
  /** Where the section fills from at generate (shown in the match chip). */
  source: string;
  /** True = prose the author writes/carries forward (Scope, Objective…); the
   *  report has no query number for it. */
  narrative?: boolean;
  /** A narrative section the auditor must state in their own words (opinion,
   *  objective, limitations) — not one we can generate. When set, the report
   *  prompts once and stores the value on reports.data under `dataKey`. Absent =
   *  static: the section's text just carries forward, no prompt. */
  dataKey?: string;
  /** Names that mean the same section. Matched case-insensitively, whole-string
   *  after trimming punctuation. Seeded from the real reports; editable. */
  aliases: string[];
};

// The canonical sections and their known fill sources. Aliases are the synonyms
// the real reports use for the same section.
export const KNOWN_SECTIONS: KnownSection[] = [
  {
    name: 'Executive Summary',
    source: 'Report summary',
    aliases: ['executive summary', 'summary', 'overview', 'management summary', 'abstract', 'synopsis', 'key messages'],
  },
  {
    name: 'Findings',
    source: 'Audit queries',
    aliases: ['findings', 'observations', 'findings and observations', 'matters arising', 'issues', 'issues identified', 'audit findings', 'audit queries', 'queries', 'exceptions', 'results', 'detailed findings', 'findings by area', 'findings by scope area', 'key findings', 'summary of findings', 'detailed findings by area'],
  },
  {
    name: 'Recommendations',
    source: 'Query audit output',
    aliases: ['recommendations', 'agreed action', 'agreed actions', 'management action plan', 'action plan', 'management actions', 'agreed management actions', 'remediation', 'corrective actions', 'way forward', 'summary of recommendations', 'recommendations summary', 'summary of agreed actions'],
  },
  {
    name: 'Appendix',
    source: 'Query sources and attachments',
    aliases: ['appendix', 'appendices', 'annex', 'annexure', 'annexures', 'exhibits', 'supporting evidence', 'references'],
  },
  // Narrative sections — the author's own prose. No query fills them, so an import
  // carries their text forward without waiting on a binding.
  {
    name: 'Scope',
    source: 'Author text',
    narrative: true,
    dataKey: 'scope',
    aliases: ['scope', 'scope and objectives', 'scope & objectives', 'audit scope', 'coverage', 'scope of work', 'scope of review'],
  },
  {
    name: 'Objective',
    source: 'Author text',
    narrative: true,
    dataKey: 'objective',
    aliases: ['objective', 'objectives', 'purpose', 'audit objectives', 'aim', 'aims', 'goals', 'background and objectives'],
  },
  {
    name: 'Methodology',
    source: 'Author text',
    narrative: true,
    aliases: ['methodology', 'testing methodology', 'approach', 'audit approach', 'basis of review', 'how we tested', 'our approach'],
  },
  {
    name: 'Limitations',
    source: 'Author text',
    narrative: true,
    dataKey: 'limitations',
    aliases: ['limitations', 'limitation of scope', 'scope limitations', 'disclaimer', 'caveats', 'restrictions'],
  },
  {
    name: 'Conclusion',
    source: 'Author text',
    narrative: true,
    dataKey: 'conclusion',
    aliases: ['conclusion', 'conclusions', 'opinion', 'audit opinion', 'overall opinion', 'overall conclusion', 'assurance opinion', 'assessment'],
  },
  {
    name: 'Background',
    source: 'Author text',
    narrative: true,
    aliases: ['background', 'context', 'introduction', 'about this review'],
  },
];

/** Normalise a heading for matching: lowercase, strip a leading enumerator and
 *  surrounding punctuation, collapse whitespace, drop a trailing colon. */
function normalizeHeading(name: string): string {
  return name
    .toLowerCase()
    .replace(/^\s*(?:\d+(?:[.)]\d+)*[.)]?|[a-z][.)]|[ivxlcm]+[.)])\s+/i, '')
    .replace(/[:;.]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// An appendix is conventionally titled by its family word plus a letter/number and
// often its own subtitle: "Appendix A", "Appendix A — Rating definitions",
// "Annexure III — Evidence", "Schedule 2". The subtitle means a whole-string alias
// match can't catch it, so any heading that *starts* with an appendix-family word
// resolves to the Appendix source.
const APPENDIX_PREFIX_RE = /^(appendix|appendices|annex|annexure|annexures|schedule|schedules|exhibit|exhibits)\b/;

/** The canonical section a heading resolves to (by exact name or alias), or null.
 *  Exposed so callers can label the source or offer the same list for manual
 *  mapping of an unmatched heading. */
export function knownSectionFor(name: string): KnownSection | null {
  const n = normalizeHeading(name);
  if (!n) return null;
  const exact = KNOWN_SECTIONS.find(k => k.aliases.includes(n) || normalizeHeading(k.name) === n);
  if (exact) return exact;
  if (APPENDIX_PREFIX_RE.test(n)) return KNOWN_SECTIONS.find(k => k.name === 'Appendix') ?? null;
  return null;
}

/** Whether a normalised heading is the section's own canonical name (Case 1) vs a
 *  synonym of it (Case 2). */
function isCanonical(k: KnownSection, name: string): boolean {
  return normalizeHeading(k.name) === normalizeHeading(name);
}

/** Match a detected heading to a data source. A known section fills from its
 *  source (Case 1) or via a confirmed synonym (Case 2). Everything else — a
 *  recognised prose section OR a header we've never seen — is a Narrative (Case 3):
 *  its own text carries forward. Narrative is the default, not a failure, so an
 *  unrecognised custom header ("Regulatory Impact") is never dropped or forced into
 *  a data source; the auditor can still re-map it in review. */
export function matchHeading(name: string): SectionMatch {
  const known = knownSectionFor(name);
  if (!known) return { kind: 'narrative' };
  if (known.narrative) return { kind: 'narrative' };
  if (isCanonical(known, name)) return { kind: 'known', source: known.source };
  return { kind: 'synonym', source: known.source, alias: known.name };
}

/** If a section (by name or synonym) is a narrative one the auditor must state
 *  themselves, the reports.data key + canonical label its value stores under.
 *  Null for query-filled or static sections. Drives the "prompt once" input. */
export function auditorValueField(name: string): { key: string; label: string } | null {
  const known = knownSectionFor(name);
  if (known?.narrative && known.dataKey) return { key: known.dataKey, label: known.name };
  return null;
}

/** A short human label for a match, shown as the per-row status chip in review. */
export function matchLabel(match: SectionMatch | undefined): { label: string; tone: 'ok' | 'info' | 'warn' } | null {
  if (!match) return null;
  switch (match.kind) {
    case 'known': return { label: `Maps to ${match.source}`, tone: 'ok' };
    case 'synonym': return { label: `Reads as ${match.alias}`, tone: 'info' };
    case 'narrative': return { label: 'Your text carries forward', tone: 'info' };
    case 'unmatched': return { label: 'Unmatched — resolve', tone: 'warn' };
    case 'duplicate': return { label: `Duplicate — ${match.source} already mapped`, tone: 'warn' };
  }
}
