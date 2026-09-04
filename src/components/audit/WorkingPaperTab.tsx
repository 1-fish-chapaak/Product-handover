import { useEffect, useMemo, useState } from 'react';
import {
  FileText, BookOpen, Download, CheckCircle2, SquareArrowOutUpRight,
  AlertTriangle, Clock, Share2, XCircle, Info, Trash2, X, Layers,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import type { Engagement } from '../../data/engagements';
import { generateRacmForProcess, type RACMRow } from '../../data/racm';
import { PEOPLE } from '../../data/grc-domain';
import { exceptionsForEngagement, type Severity } from '../../data/engagement-exceptions';
import { useEngagementWorkspace } from './engagementWorkspace';
import { buildWpControls, downloadControlWorkingPaper, type WpControl } from './workingPaper';
import SmartTable from '../shared/SmartTable';
import ListToolbar, { ToolbarViewToggle } from '../shared/ListToolbar';
import InfiniteCardGrid from '../shared/InfiniteCardGrid';
import ReportCard from '../shared/ReportCard';
import EmptyState from '../shared/EmptyState';
import AtrReviewDrawer from '../reports/AtrReviewDrawer';
import GenerateATRModal from '../exceptions/GenerateATRModal';
import type { AtrReportData } from '../reports/atrTypes';
import { loadBaselineVersions, appendVersion, peekVersion } from '../reports/atrReview';
import { DEFAULT_REPORT_AUDIENCE, type Audience } from '../shared/audience';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useCan } from '../../context/CurrentUserContext';
import { AnimatePresence, motion } from 'motion/react';
import ControlReportView, { type ControlObservation } from './ControlReportView';
import { paperSectionCount } from './paperFormat';
import AddObservationModal, { computeNextObservationId, type EditingObservationInput, type ObservationSavePayload } from '../reports/AddObservationModal';
import ConfirmDialog from '../reports/ConfirmDialog';
import { ReportPill } from '../reports/ReportPill';
import { ActionTooltip, ReportNameCell, SourceChip } from '../reports/reportTableCells';
import { REPORT_COL_W, renderedQueryCount, renderedSectionCount, startReportDownload } from '../reports/reportShared';
import ColumnFilter from '../shared/ColumnFilter';
import { ApplyTemplateChip } from '../reports/ReportBarControls';
import { REPORT_TEMPLATES, GENERATED_REPORTS, GENERATED_REPORTS_KEY } from '../../data/mockData';
import ReportView from '../reports/ReportView';
import { BulkAuditVariantView } from '../reports/BulkAuditVariants';
import type { GeneratedReport } from '../reports/reportShared';

// Formats the author saved from the template builder. Read straight from the
// same store the Reports module writes, so this tab lists the formats that
// actually exist rather than the built-in three.
const CUSTOM_TEMPLATES_KEY = 'irame.reports.customTemplates.v2';
/** The format an audit's control reports come out in, keyed by engagement. */
/** What each editable part of a control paper is called in a log line and in
 *  the version history — the paper's own name for the fact, whatever heading
 *  the chosen format happens to print it under. */
const PAPER_FIELD_LABEL: Record<'summary' | 'scope' | 'testProcedure' | 'results', string> = {
  summary: 'Summary', scope: 'Scope', testProcedure: 'Test procedure', results: 'Results',
};

const AUDIT_FORMAT_KEY = 'irame.engagements.reportFormat.v1';
/** Who can open a control report, keyed by engagement then control. */
const CONTROL_AUDIENCE_KEY = 'irame.engagements.controlReportAudience.v1';
/** Observations added by hand to a control report, keyed by engagement then control. */
const CONTROL_OBSERVATION_KEY = 'irame.engagements.controlObservations.v1';
/** Edited prose on a control report, keyed by engagement then control. */
const CONTROL_EDIT_KEY = 'irame.engagements.controlPaperEdits.v1';

/** The sections of a paper an auditor can rewrite in place. */
type PaperEdits = { summary?: string; scope?: string; testProcedure?: string; results?: string };

/** Table or cards on the per-control list — remembered, like the Reports list. */
// Working papers removed from this engagement's list. Kept per engagement, so
// a paper deleted here stays deleted on the next visit.
const CONTROL_REMOVED_KEY = 'irame.engagements.removedControlPapers.v1';
function readRemovedPapers(engagementId: string): string[] {
  try {
    const raw = localStorage.getItem(CONTROL_REMOVED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const forEng = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return Array.isArray(forEng) ? forEng.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}
function writeRemovedPapers(engagementId: string, ids: string[]): void {
  try {
    const raw = localStorage.getItem(CONTROL_REMOVED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (ids.length === 0) delete next[engagementId]; else next[engagementId] = ids;
    localStorage.setItem(CONTROL_REMOVED_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the removal just does not persist */ }
}

const PAPER_VIEW_KEY = 'irame.engagements.controlReports.viewMode';

/** How a report on this tab was produced: the audit's one bulk run across
 *  every linked workflow, or a single control tested on its own. Only the
 *  bulk run is tagged in the Type column; both are options in its filter. */
const RUN_BULK = 'Bulk Audit';
const RUN_SINGLE = 'Single run';
const RUN_OPTIONS = [RUN_BULK, RUN_SINGLE];

function readPaperView(): 'list' | 'grid' {
  try { return localStorage.getItem(PAPER_VIEW_KEY) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
}
function writePaperView(mode: 'list' | 'grid'): void {
  try { localStorage.setItem(PAPER_VIEW_KEY, mode); } catch { /* a blocked store just does not remember */ }
}

function readCustomTemplates(): typeof REPORT_TEMPLATES[number][] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as typeof REPORT_TEMPLATES[number][]) : [];
  } catch { return []; }
}
/** Save a format built from a report back to the workspace's format list. The
 *  app's own store reads the same key, so the storage event is dispatched by
 *  hand — same-tab listeners never hear the real one — and the format shows up
 *  in Reports without a reload. */
function saveCustomTemplate(t: typeof REPORT_TEMPLATES[number]): void {
  try {
    const raw = JSON.stringify([t, ...readCustomTemplates().filter(x => x.id !== t.id)]);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, raw);
    window.dispatchEvent(new StorageEvent('storage', { key: CUSTOM_TEMPLATES_KEY, newValue: raw }));
  } catch { /* a full or blocked store — the format just does not persist */ }
}

/** What the reader changes on a report: the format applied to it, its
 *  description, its sign-offs, and who can open it. */
type ReportOverride = Partial<Pick<GeneratedReport, 'appliedTemplateId' | 'description' | 'signoffs' | 'shareAudience'>>;

/** The report library the Reports module keeps. An audit lists the same
 *  reports it does, so a change made from the reader here is written straight
 *  back to that library: one report, one format, wherever it is opened. */
function readStoredReports(): GeneratedReport[] {
  try {
    const raw = localStorage.getItem(GENERATED_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed as GeneratedReport[];
  } catch { /* an unreadable blob — fall back to the seed library */ }
  return [...GENERATED_REPORTS] as GeneratedReport[];
}
function writeStoredReports(next: GeneratedReport[]): void {
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(GENERATED_REPORTS_KEY, raw);
    // A real storage event reaches only the other tabs, so the one the Reports
    // module listens for is dispatched by hand: the list — and any report open
    // in it — picks the change up without a reload.
    window.dispatchEvent(new StorageEvent('storage', { key: GENERATED_REPORTS_KEY, newValue: raw }));
  } catch { /* a full or blocked store — the change just does not persist */ }
}

/** The audit's own bulk run is not in that library: it is built for this
 *  engagement and named after it, so what the reader changes on it is kept
 *  per engagement instead. */
const REPORT_OVERRIDE_KEY = 'irame.engagements.reportOverrides.v1';
function readReportOverrides(engagementId: string): Record<string, ReportOverride> {
  try {
    const raw = localStorage.getItem(REPORT_OVERRIDE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const forEng = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return forEng && typeof forEng === 'object' ? (forEng as Record<string, ReportOverride>) : {};
  } catch { return {}; }
}
function writeReportOverrides(engagementId: string, map: Record<string, ReportOverride>): void {
  try {
    const raw = localStorage.getItem(REPORT_OVERRIDE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (Object.keys(map).length === 0) delete next[engagementId]; else next[engagementId] = map;
    localStorage.setItem(REPORT_OVERRIDE_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the change just does not persist */ }
}

/** A format set on one control paper, overriding the audit's. Keyed by
 *  engagement, then control. */
function readAuditFormat(engagementId: string): string | null {
  try {
    const raw = localStorage.getItem(AUDIT_FORMAT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const id = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return typeof id === 'string' ? id : null;
  } catch { return null; }
}
function writeAuditFormat(engagementId: string, templateId: string | null): void {
  try {
    const raw = localStorage.getItem(AUDIT_FORMAT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (templateId) next[engagementId] = templateId; else delete next[engagementId];
    localStorage.setItem(AUDIT_FORMAT_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the format just does not persist */ }
}

function readControlAudiences(engagementId: string): Record<string, Audience> {
  try {
    const raw = localStorage.getItem(CONTROL_AUDIENCE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const forEng = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return forEng && typeof forEng === 'object' ? (forEng as Record<string, Audience>) : {};
  } catch { return {}; }
}
function writeControlAudiences(engagementId: string, map: Record<string, Audience>): void {
  try {
    const raw = localStorage.getItem(CONTROL_AUDIENCE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (Object.keys(map).length === 0) delete next[engagementId]; else next[engagementId] = map;
    localStorage.setItem(CONTROL_AUDIENCE_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the choice just does not persist */ }
}

function readControlObservations(engagementId: string): Record<string, ControlObservation[]> {
  try {
    const raw = localStorage.getItem(CONTROL_OBSERVATION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const forEng = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return forEng && typeof forEng === 'object' ? (forEng as Record<string, ControlObservation[]>) : {};
  } catch { return {}; }
}
function writeControlObservations(engagementId: string, map: Record<string, ControlObservation[]>): void {
  try {
    const raw = localStorage.getItem(CONTROL_OBSERVATION_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (Object.keys(map).length === 0) delete next[engagementId]; else next[engagementId] = map;
    localStorage.setItem(CONTROL_OBSERVATION_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the observation just does not persist */ }
}

function readControlEdits(engagementId: string): Record<string, PaperEdits> {
  try {
    const raw = localStorage.getItem(CONTROL_EDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const forEng = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return forEng && typeof forEng === 'object' ? (forEng as Record<string, PaperEdits>) : {};
  } catch { return {}; }
}
function writeControlEdits(engagementId: string, map: Record<string, PaperEdits>): void {
  try {
    const raw = localStorage.getItem(CONTROL_EDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (Object.keys(map).length === 0) delete next[engagementId]; else next[engagementId] = map;
    localStorage.setItem(CONTROL_EDIT_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the edit just does not persist */ }
}

interface Props {
  engagement: Engagement;
  /** Told when a control report is open, so the page around this tab can step
   *  out of the way — an open report is the page, and it carries its own back
   *  button. */
  onReaderChange?: (open: boolean) => void;
  /** Opens the Findings tab. The band's numbers are the way in: a number an
   *  auditor reads is one they want to act on. */
  onOpenFindings?: () => void;
}

/** How an internal audit rates a control it has tested. This is the module's
 *  base vocabulary — the workspace is an internal audit workspace, so SOX is
 *  the translation rather than the other way round. */
type PaperConclusion = 'Satisfactory' | 'Needs improvement' | 'Inconclusive' | 'Not yet tested';

type PaperStatus = 'Draft' | 'In Review' | 'Signed-off';

interface ControlPaper {
  row: RACMRow;
  scope: string;
  attributesInScope: number;
  attributesTested: number;
  exceptionsFound: number;
  testProcedure: string;
  results: string;
  /** The paper in a sentence — scope, counts, and where it landed. */
  summary: string;
  conclusion: PaperConclusion;
  status: PaperStatus;
}
/** One row of the per-control table. Flat, because SmartTable sorts on the
 *  cell values rather than reaching into the paper. */
interface PaperRow {
  controlId: string;
  name: string;
  subline: string;
  isKey: boolean;
  conclusion: PaperConclusion;
  status: PaperStatus;
  generated: string;
  paper?: ControlPaper;
  /** The audit report this row opens. An internal audit lists its reports
   *  here — the same object the Reports module holds — so the row opens the
   *  product's own reader instead of a per-control paper. */
  report?: GeneratedReport;
  /** Standard or Custom — the format this row's report is written in. */
  source?: 'system' | 'custom';
  /** The audit's bulk run: one report over every workflow linked to the
   *  engagement rather than one control's testing. It rides in the same list. */
  bulk?: boolean;
}


const CONCLUSION_CLS: Record<PaperConclusion, string> = {
  Satisfactory:        'bg-compliant-50 text-compliant-700 border-compliant-100',
  'Needs improvement': 'bg-risk-50 text-risk-700 border-risk-100',
  Inconclusive:        'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  'Not yet tested':    'bg-surface-2 text-text-muted border-border-light',
};

/** The four conclusion buckets, in the order an audit reads them: what passed,
 *  what failed, what could not be called, what is still outstanding. */
const CONCLUSION_SPLIT: {
  key: 'satisfactory' | 'needsWork' | 'inconclusive' | 'notTested';
  label: PaperConclusion;
  bar: string;
  text: string;
}[] = [
  { key: 'satisfactory', label: 'Satisfactory',      bar: 'bg-compliant',   text: 'text-compliant-700' },
  { key: 'needsWork',    label: 'Needs improvement', bar: 'bg-risk',        text: 'text-risk-700' },
  { key: 'inconclusive', label: 'Inconclusive',      bar: 'bg-mitigated',   text: 'text-mitigated-700' },
  { key: 'notTested',    label: 'Not yet tested',    bar: 'bg-ink-300',     text: 'text-ink-500' },
];

/** What an internal audit puts its name to: a rating for the audit, read off
 *  the findings it raised rather than off control effectiveness. */
type AuditRating = 'Satisfactory' | 'Needs improvement' | 'Unsatisfactory';

const RATING_CLS: Record<AuditRating, string> = {
  Satisfactory:        'bg-compliant-50 text-compliant-700 border-compliant-100',
  'Needs improvement': 'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  Unsatisfactory:      'bg-risk-50 text-risk-700 border-risk-100',
};
/** What the rating means, said plainly. The formal word (Satisfactory, Needs
 *  improvement, Unsatisfactory) is what an audit file calls it, and it is in
 *  the help beside the chip; the chip itself says what is actually true. */
const RATING_WORD: Record<AuditRating, string> = {
  Satisfactory:        'Nothing open',
  'Needs improvement': 'Issues to fix',
  Unsatisfactory:      'Critical issues open',
};
const RATING_ICON: Record<AuditRating, React.ElementType> = {
  Satisfactory: CheckCircle2,
  'Needs improvement': AlertTriangle,
  Unsatisfactory: XCircle,
};

/** The findings split, most serious first. Same four severities the Findings
 *  tab and the engagement overview count, so the audit reads the same number
 *  wherever it is opened. */
const SEVERITY_SPLIT: { key: Severity; bar: string; text: string }[] = [
  { key: 'Critical', bar: 'bg-risk',       text: 'text-risk-700' },
  { key: 'High',     bar: 'bg-high',       text: 'text-high-700' },
  { key: 'Medium',   bar: 'bg-mitigated',  text: 'text-mitigated-700' },
  { key: 'Low',      bar: 'bg-compliant',  text: 'text-compliant-700' },
];

/** The rating is derived, never typed in, so the chip carries a short note on
 *  where it came from. Click rather than hover: it sits above a list, and a
 *  hover card there is unreadable on the way past. */
function RatingHelp({ rating, open, critical, total }: {
  rating: AuditRating;
  /** Findings still open on this audit. */
  open: number;
  /** How many of those are critical. */
  critical: number;
  /** Every finding raised, closed ones included. */
  total: number;
}) {
  const [shown, setShown] = useState(false);
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const why =
    critical > 0 ? `${n(critical, 'critical finding')} open.`
    : open > 0 ? `${n(open, 'finding')} open, none critical.`
    : total > 0 ? 'Everything raised is closed.'
    : 'Nothing raised yet.';
  // What moves it, in one line. Without this the popover says where the rating
  // came from but not how to change it, which is the only thing an auditor
  // wants from it.
  const fix =
    rating === 'Unsatisfactory' ? `Close the ${n(critical, 'critical finding')} to reach Issues to fix.`
    : rating === 'Needs improvement' ? `Close the ${n(open, 'open finding')} to reach Nothing open.`
    : 'A new finding moves this; a critical one makes it Critical issues open.';
  const rules: { dot: string; text: string; on: boolean }[] = [
    { dot: 'bg-risk',      text: 'Critical open',        on: rating === 'Unsatisfactory' },
    { dot: 'bg-mitigated', text: 'Open, none critical',  on: rating === 'Needs improvement' },
    { dot: 'bg-compliant', text: 'Nothing open',         on: rating === 'Satisfactory' },
  ];
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShown(v => !v)}
        aria-haspopup="dialog"
        aria-expanded={shown}
        aria-label="Where this rating comes from"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-ink-400 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
      >
        <Info size={14} />
      </button>
      {shown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShown(false)} />
          <div
            role="dialog"
            className="absolute left-0 top-full mt-2 w-[248px] bg-white rounded-lg shadow-[0_16px_40px_-12px_rgba(15,8,30,0.22)] border border-canvas-border z-50 p-3 text-left"
          >
            <p className="text-[0.8125rem] font-semibold text-ink-900">{why}</p>
            {/* The three rules, one line each, with the one in force marked. */}
            <ul className="mt-2.5 space-y-1.5">
              {rules.map(r => (
                <li key={r.text} className={`flex items-center gap-2 text-[0.75rem] ${r.on ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>
                  <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
                  {r.text}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 pt-2.5 border-t border-canvas-border text-[0.75rem] text-ink-800">{fix}</p>
            <p className="mt-1.5 text-[0.6875rem] text-ink-400">
              From the {n(total, 'finding')} on Findings. Not set by hand.
            </p>
          </div>
        </>
      )}
    </span>
  );
}

/** A compliance or SOX ICFR engagement concludes on whether a control can be
 *  relied on for financial reporting, so on those engagements — and only
 *  there — the same four buckets go out in ICFR words. */
const SOX_CONCLUSION_WORD: Record<PaperConclusion, string> = {
  Satisfactory:        'Effective',
  'Needs improvement': 'Deficient',
  Inconclusive:        'Inconclusive',
  'Not yet tested':    'Not yet tested',
};
function conclusionWord(c: PaperConclusion, isIA: boolean): string {
  return isIA ? c : SOX_CONCLUSION_WORD[c];
}

/** The conclusion as a word rather than a chip — it rides in the row's subline
 *  now that the table carries the Reports list's four columns. */
const CONCLUSION_TEXT: Record<PaperConclusion, string> = {
  Satisfactory:        'text-compliant-700',
  'Needs improvement': 'text-risk-700',
  Inconclusive:        'text-mitigated-700',
  'Not yet tested':    'text-ink-400',
};

const CONCLUSION_ICON: Record<PaperConclusion, React.ElementType> = {
  Satisfactory: CheckCircle2,
  'Needs improvement': AlertTriangle,
  Inconclusive: AlertTriangle,
  'Not yet tested': Clock,
};

/** Derive a stable working-paper from a RACM row using engagement.health.
 *  Demo-only — in production this would be authored data. */

/** A control's working paper, read from the same attribute results the .xlsx
 *  export is built from. One set of numbers for the page, the list and the
 *  file: what was in scope, what was tested, what failed. A control with no
 *  workspace row has no test results to read, so it reads as untested rather
 *  than inventing counts. */
function deriveControlPaper(row: RACMRow, engagement: Engagement, wp: WpControl | undefined): ControlPaper {
  const attrs = wp?.attributes ?? [];
  const inScope = wp ? attrs.length : row.attributes.length;
  const tested = attrs.filter(a => a.result !== 'Not tested').length;
  const exceptions = attrs.filter(a => a.result === 'Fail').length;
  const conclusion: PaperConclusion =
    !wp || wp.status === 'Not tested' ? 'Not yet tested'
    : wp.status === 'Pass' ? 'Satisfactory'
    : wp.status === 'Fail' ? 'Needs improvement'
    : 'Inconclusive';
  // Internal audit rates the control; a compliance engagement concludes on it.
  // Written out rather than lowercasing the rating, so "needs improvement"
  // reads as a sentence.
  const ia = engagement.type === 'Internal Audit';
  const verdictClause = ia
    ? (conclusion === 'Satisfactory' ? 'the control is rated satisfactory'
      : conclusion === 'Needs improvement' ? 'the control needs improvement'
      : 'no rating could be reached')
    : `the control is concluded ${SOX_CONCLUSION_WORD[conclusion].toLowerCase()}`;
  const status: PaperStatus =
    engagement.status === 'Closed' ? 'Signed-off'
    : engagement.status === 'Review' ? 'In Review'
    : 'Draft';
  return {
    row,
    scope: `Tests “${row.controlDescription}” across ${row.subProcess} for the engagement period ${engagement.periodStart} – ${engagement.periodEnd}.`,
    attributesInScope: inScope,
    attributesTested: tested,
    exceptionsFound: exceptions,
    testProcedure: row.attributes.map(a => `• ${a.testProcedure}`).join('\n'),
    summary: tested === 0
      ? `${row.controlId} carries ${inScope} test attribute${inScope === 1 ? '' : 's'} in ${row.subProcess}. None has been tested for ${engagement.periodStart} – ${engagement.periodEnd} yet, so the ${ia ? 'report' : 'paper'} reaches no conclusion.`
      : `${row.controlId} carries ${inScope} test attribute${inScope === 1 ? '' : 's'} in ${row.subProcess}. ${tested} ${tested === 1 ? 'was' : 'were'} tested for ${engagement.periodStart} – ${engagement.periodEnd} and ${exceptions === 0 ? 'none failed' : `${exceptions} failed`}, so ${verdictClause}.`,
    results: tested === 0
      ? `None of the ${inScope} attribute${inScope === 1 ? '' : 's'} in scope has been tested yet.`
      : exceptions === 0
        ? `All ${tested} tested attribute${tested === 1 ? '' : 's'} passed. Control operating as designed.`
        : `${exceptions} of ${tested} tested attribute${tested === 1 ? '' : 's'} failed. Exceptions are logged on the Exceptions sheet of the ${engagement.type === 'Internal Audit' ? 'spreadsheet' : 'working paper'}.`,
    conclusion,
    status,
  };
}

export default function WorkingPaperTab({ engagement, onReaderChange, onOpenFindings }: Props) {
  const { addToast, updateToast } = useToast();
  const logEvent = useAuditLog();
  const isIA = engagement.type === 'Internal Audit';
  // "Working paper" is the compliance / SOX ICFR artefact: a preparer's record
  // of testing, signed off by a reviewer. An internal audit issues a report.
  // So no internal-audit surface says working paper — not the heading, not a
  // button, not a toast, not the activity log. One place decides the word.
  const docNoun = isIA ? 'report' : 'working paper';
  // An audit report is the same report the Reports library holds, so taking it
  // off this list removes it from the audit rather than deleting it. A control's
  // working paper belongs to this audit alone, so that one is a delete.
  const rmVerb = isIA ? 'Remove' : 'Delete';
  const DocNoun = isIA ? 'Report' : 'Working paper';
  const logEntity = isIA ? 'Report' : 'Working Paper';

  // The seeded RACM library only holds P2P rows, so asking it directly left
  // every other process with an empty report: no per-control papers, a scope of
  // zero, and nothing to export. `generateRacmForProcess` returns the library
  // rows when it has them and process-appropriate rows when it does not, which
  // is what the RACM tab and Business Processes already use.
  const racmRows = useMemo(() => generateRacmForProcess(engagement.process), [engagement.process]);

  // Working-paper rows (.xlsx) — built from the shared engagement workspace so the
  // controls/attributes match the Controls tab. Excel, not PDF.
  const ws = useEngagementWorkspace();
  const wpToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  // The list's Generated column reads the way the Reports list's does
  // ("Sep 4, 2026"), not the working paper's own en-GB stamp.
  const generatedOn = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const riskByControl = useMemo(() => {
    const m = new Map<string, string>();
    racmRows.forEach(r => { if (!m.has(r.controlId)) m.set(r.controlId, r.riskDescription); });
    return m;
  }, [racmRows]);
  const wpControls = useMemo(() => buildWpControls(ws.controls, {
    health: engagement.health,
    owner: engagement.owner,
    testedOn: wpToday,
    linkedWorkflows: (id) => ws.workflowIdsForAttribute(id).map(wid => ({ id: wid, name: ws.workflows.find(w => w.id === wid)?.name ?? wid })),
    riskForControl: (id) => riskByControl.get(id),
  }), [ws, engagement.health, engagement.owner, wpToday, riskByControl]);
  const wpById = useMemo(() => new Map(wpControls.map(c => [c.controlId, c])), [wpControls]);
  // The papers the page shows, derived from those same wp controls so the
  // document, the list and the exported file can never disagree.
  // Papers deleted from this list, and the one waiting on its confirmation.
  // A deleted paper only leaves the list: its edits and observations stay put,
  // so Undo puts the paper back exactly as it was.
  const [removedPapers, setRemovedPapers] = useState<string[]>(() => readRemovedPapers(engagement.id));
  const [paperToDelete, setPaperToDelete] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const setRemoved = (next: string[]) => { setRemovedPapers(next); writeRemovedPapers(engagement.id, next); };
  const papers = useMemo(
    () => racmRows
      .filter(r => !removedPapers.includes(r.controlId))
      .map(r => deriveControlPaper(r, engagement, wpById.get(r.controlId))),
    [racmRows, engagement, wpById, removedPapers],
  );
  // The formats built in this workspace. Held in state rather than read once,
  // so a format saved from inside an open report is immediately pickable.
  const [customFormats, setCustomFormats] = useState<typeof REPORT_TEMPLATES[number][]>(() => readCustomTemplates());
  const customFormatIds = useMemo(() => new Set(customFormats.map(t => t.id)), [customFormats]);
  // The report library, and what the reader changed on the audit's own bulk
  // run. A change to a library report is written back to the library; the bulk
  // run is not in it, so its changes are kept per engagement.
  const [storedReports, setStoredReports] = useState<GeneratedReport[]>(readStoredReports);
  const [reportOverrides, setReportOverrides] = useState<Record<string, ReportOverride>>(() => readReportOverrides(engagement.id));
  // Somewhere else in the app changed the library — the Reports list, or
  // another tab. Take what it wrote rather than holding a stale copy.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== GENERATED_REPORTS_KEY || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setStoredReports(parsed as GeneratedReport[]);
      } catch { /* a half-written blob — keep what we have */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const patchReport = (reportId: string, patch: ReportOverride) => {
    if (storedReports.some(r => r.id === reportId)) {
      const next = storedReports.map(r => (r.id === reportId ? { ...r, ...patch } : r));
      setStoredReports(next);
      writeStoredReports(next);
      return;
    }
    setReportOverrides(prev => {
      const next = { ...prev, [reportId]: { ...prev[reportId], ...patch } };
      writeReportOverrides(engagement.id, next);
      return next;
    });
  };

  // The reports this internal audit publishes. An internal audit does not write
  // one document per control: it writes audit reports, the same object the
  // Reports module holds, and this tab lists the ones that belong to this
  // audit. A compliance engagement keeps its per-control papers above.
  const engagementReports = useMemo<GeneratedReport[]>(() => {
    if (!isIA) return [];
    return storedReports
      .filter(r => r.tag === 'Internal Audit')
      // Read straight from the library, so the report here is the report there
      // — same id, same format, same comments and versions. Only the period is
      // restated, from the engagement it belongs to.
      .map(r => ({
        ...r,
        reportPeriod: `${engagement.periodStart} – ${engagement.periodEnd}`,
      } as GeneratedReport))
      .filter(r => !removedPapers.includes(r.id));
  }, [isIA, engagement.periodStart, engagement.periodEnd, removedPapers, storedReports]);
  const reportById = useMemo(() => new Map(engagementReports.map(r => [r.id, r])), [engagementReports]);
  // The format this engagement's report comes out in — the same control every
  // open report carries, so a format picked in Reports is pickable here too.
  const formatOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...REPORT_TEMPLATES, ...customFormats].filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, [customFormats]);
  const wpMeta = { preparedBy: engagement.owner, reviewedBy: 'Pending reviewer sign-off', preparedOn: wpToday };
  const downloadOne = (controlId: string, opts?: { quiet?: boolean }) => {
    // An audit report downloads the way it does in Reports; only a control's
    // working paper produces the .xlsx.
    const rep = reportById.get(controlId);
    if (rep) {
      startReportDownload(addToast, updateToast, rep.name);
      logEvent({ action: 'Export', description: `Downloaded report "${rep.name}"`, module: 'Engagements', entity: logEntity });
      return;
    }
    const c = wpById.get(controlId);
    if (!c) return;
    // The export names the file itself — an internal audit downloads a report,
    // a compliance engagement a working paper — so the toast reads the name
    // back rather than guessing it.
    const fileName = downloadControlWorkingPaper(engagement, c, wpMeta);
    if (!opts?.quiet) addToast({ type: 'success', message: `${fileName} downloaded` });
    logEvent({ action: 'Export', description: `Downloaded ${docNoun} ${fileName} for control ${controlId}`, module: 'Engagements', entity: logEntity });
  };

  // The control whose working paper is open as a report. Null = the list.
  const [openControlId, setOpenControlId] = useState<string | null>(null);
  // The format the whole audit's control reports come out in. It is one choice
  // for the audit, not a choice per control: an audit goes out in a single
  // format, so the picker lives above the list and every report follows it.
  const [auditFormatId, setAuditFormatId] = useState<string | null>(() => readAuditFormat(engagement.id));
  const setAuditFormat = (templateId: string | null) => {
    setAuditFormatId(templateId);
    writeAuditFormat(engagement.id, templateId);
  };
  const auditFormat = auditFormatId ? formatOptions.find(t => t.id === auditFormatId) ?? null : null;
  // Standard or Custom — what the Format column says in Reports. A format built
  // in this workspace reads Custom, a built-in one reads Standard. The format is
  // one choice for the whole audit, so every row carries the same chip.
  const auditFormatSource: 'system' | 'custom' =
    auditFormatId && customFormatIds.has(auditFormatId) ? 'custom' : 'system';
  // Who can open each control report, and the review drawer the History
  // button opens. Both belong to the open report, so they live beside it.
  const [controlAudiences, setControlAudiences] = useState<Record<string, Audience>>(() => readControlAudiences(engagement.id));
  const setControlAudience = (controlId: string, a: Audience) => {
    setControlAudiences(prev => {
      const next = { ...prev, [controlId]: a };
      writeControlAudiences(engagement.id, next);
      return next;
    });
  };
  const [reviewOpen, setReviewOpen] = useState(false);
  const [atrOpen, setAtrOpen] = useState(false);
  // Observations added by hand to a control paper. They live on the paper, so
  // they are keyed by control and survive a reload.
  const [observationsByControl, setObservationsByControl] = useState<Record<string, ControlObservation[]>>(() => readControlObservations(engagement.id));
  const [addObsOpen, setAddObsOpen] = useState(false);
  const [paperEdits, setPaperEdits] = useState<Record<string, PaperEdits>>(() => readControlEdits(engagement.id));
  const savePaperField = (controlId: string, field: keyof PaperEdits, value: string) => {
    setPaperEdits(prev => {
      const next = { ...prev, [controlId]: { ...prev[controlId], [field]: value } };
      writeControlEdits(engagement.id, next);
      return next;
    });
  };
  const [editingObs, setEditingObs] = useState<EditingObservationInput | null>(null);
  const writeObservations = (controlId: string, list: ControlObservation[]) => {
    setObservationsByControl(prev => {
      const next = { ...prev };
      if (list.length) next[controlId] = list; else delete next[controlId];
      writeControlObservations(engagement.id, next);
      return next;
    });
  };
  const [reviewTab, setReviewTab] = useState<'comments' | 'versions'>('comments');
  const { openShare } = useShare();
  const { can } = useCan();

  // The audit's bulk run, open in the reader.
  // Declared before the reader-state effect below, which reads it.
  const [bulkOpen, setBulkOpen] = useState(false);
  // An audit report of this engagement, open in the product's own reader.
  // Held by id, not as a snapshot, so a format applied inside the reader
  // re-renders the report it was applied to.
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const openReport = openReportId ? engagementReports.find(r => r.id === openReportId) ?? null : null;
  useEffect(() => { onReaderChange?.(openControlId !== null || bulkOpen || openReportId !== null); }, [openControlId, bulkOpen, openReportId, onReaderChange]);
  // Leaving the tab with a report open must not leave the chrome hidden.
  useEffect(() => () => onReaderChange?.(false), [onReaderChange]);

  // Summary stats
  const totals = useMemo(() => {
    const t = { satisfactory: 0, needsWork: 0, inconclusive: 0, notTested: 0, totalAttributesTested: 0, totalExceptions: 0 };
    papers.forEach(p => {
      if (p.conclusion === 'Satisfactory')           t.satisfactory++;
      else if (p.conclusion === 'Needs improvement') t.needsWork++;
      else if (p.conclusion === 'Inconclusive')      t.inconclusive++;
      else                                       t.notTested++;
      t.totalAttributesTested += p.attributesTested;
      t.totalExceptions += p.exceptionsFound;
    });
    return t;
  }, [papers]);

  // The audit's own record: the findings it raised, the same rows the Findings
  // tab lists and the overview charts. Control conclusions describe fieldwork;
  // findings are what the report is about.
  const findings = useMemo(() => exceptionsForEngagement(engagement.id), [engagement.id]);
  const openFindings = useMemo(() => findings.filter(f => f.status !== 'Resolved'), [findings]);
  const findingsBySeverity = useMemo(() => {
    const c: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    openFindings.forEach(f => { c[f.severity] += 1; });
    return c;
  }, [openFindings]);
  // The four numbers the band's legend carries, in the words and tones a
  // report's summary uses.
  // The band counts what the Findings tab counts, in the same three states and
  // the same words: awaiting triage, being worked, closed. One vocabulary, so
  // the two screens can never read as two different audits.
  const awaitingTriage = findings.filter(f => f.status === 'Open').length;
  const inProgress = findings.filter(f => f.status === 'Triaging').length;
  const resolved = findings.length - openFindings.length;
  const closureRate = findings.length > 0 ? Math.round((resolved / findings.length) * 100) : 0;
  const auditRating: AuditRating =
    openFindings.length === 0 ? 'Satisfactory'
    : findingsBySeverity.Critical > 0 ? 'Unsatisfactory'
    : 'Needs improvement';
  const overallConclusion: PaperConclusion =
    totals.needsWork > 0 ? 'Needs improvement'
    : totals.inconclusive > 0 ? 'Inconclusive'
    : totals.satisfactory > 0 ? 'Satisfactory'
    : 'Not yet tested';

  // Who the control papers are recorded by.
  const preparer = useMemo(
    () => PEOPLE.find(p => p.role === 'Auditor' || p.role === 'Manager') ?? PEOPLE[0],
    [],
  );

  // ── The paper's version trail. A control report starts at v1 — the paper
  // being recorded — and every real change a user makes appends a version: an
  // observation added, edited or removed, a section rewritten, a summary put
  // back to the test results. One record, read by the list row, the report's
  // own byline and the review drawer's history, so the three can never
  // disagree. The tick re-reads it after a change; nothing else stores it.
  const [versionTick, setVersionTick] = useState(0);
  const paperReviewId = (controlId: string) => `wp-${engagement.id}-${controlId}`;
  const recordPaperVersion = (controlId: string, label: string, changes?: string[]) => {
    const id = paperReviewId(controlId);
    const trail = loadBaselineVersions(id, { by: preparer.name, at: wpToday, label: `${DocNoun} recorded` });
    appendVersion(id, trail, label, 'draft', preparer.name, changes);
    setVersionTick(t => t + 1);
  };

  // Export is the one action left on this tab, and an empty audit has nothing
  // to export.
  const hasControls = papers.length > 0;

  // The list itself — searched, filtered by type and shown as a table or as
  // cards, exactly the way the Reports list works. Internal audit only: a
  // compliance engagement's working papers keep the plain list they have.
  const [paperSearch, setPaperSearch] = useState('');
  const [paperView, setPaperView] = useState<'list' | 'grid'>(() => readPaperView());
  const [runFilter, setRunFilter] = useState<string[]>([]);
  // Picking several reports at once, the way the Reports list does it: ticking
  // a row starts a selection, the bulk bar ends it. No mode to turn on first.
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(() => new Set());
  const isSelectingPapers = selectedPapers.size > 0;
  const togglePaperSelect = (id: string) => setSelectedPapers(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  useEffect(() => { writePaperView(paperView); }, [paperView]);

  // The audit's bulk run, the same object the Reports list holds, opened in
  // the same reader. It belongs to this audit, so it is listed with it.
  const bulkReport = useMemo<GeneratedReport | null>(() => {
    if (!isIA) return null;
    const seed = GENERATED_REPORTS.find(r => r.tag === 'Bulk Audit');
    if (!seed) return null;
    return {
      ...seed,
      id: `bulk-${engagement.id}`,
      name: `Bulk Audit of ${engagement.process} workflows`,
      description: `Every workflow linked to ${engagement.name}, run together and reported as one.`,
      generatedAt: wpToday,
      // Type is stated rather than inferred from whichever template happens to
      // be on it.
      kind: 'ia',
      // The audit's format governs every report on this tab, this one too. With
      // no format chosen the report carries none either, so it opens saying
      // Apply Template instead of claiming a template nobody applied.
      templateId: auditFormatId ?? '',
      appliedTemplateId: auditFormatId ?? undefined,
      // A format applied from inside this report wins over the audit's.
      ...reportOverrides[`bulk-${engagement.id}`],
    } as GeneratedReport;
  }, [isIA, engagement.id, engagement.name, engagement.process, wpToday, auditFormatId, reportOverrides]);

  const bulkRow = useMemo<PaperRow | null>(() => bulkReport && !removedPapers.includes(bulkReport.id) ? {
    controlId: bulkReport.id,
    name: bulkReport.name,
    subline: `${bulkReport.workflowResults?.length ?? 0} workflows · ${bulkReport.queries} queries`,
    isKey: false,
    conclusion: 'Not yet tested',
    status: 'Draft',
    generated: bulkReport.generatedAt,
    source: customFormatIds.has(bulkReport.appliedTemplateId ?? bulkReport.templateId) ? 'custom' : 'system',
    bulk: true,
  } : null, [bulkReport, removedPapers, customFormatIds]);

  const paperRows = useMemo<PaperRow[]>(() => papers.map(pa => ({
    controlId: pa.row.controlId,
    name: pa.row.controlDescription,
    // The same line the Reports list writes, from this paper's own data: the
    // version it is on ("v5 · 2 observations · 2 action plans"), then what the
    // document is made of ("2 queries · 3 sections"), then what was added to it.
    subline: (() => {
      const obs = observationsByControl[pa.row.controlId]?.length ?? 0;
      const parts = [
        `v${peekVersion(`wp-${engagement.id}-${pa.row.controlId}`)}`,
        `${pa.attributesInScope} attribute${pa.attributesInScope === 1 ? '' : 's'}`,
        `${paperSectionCount(auditFormat)} sections`,
      ];
      if (obs > 0) parts.push(`${obs} observation${obs === 1 ? '' : 's'}`);
      return parts.join(' · ');
    })(),
    generated: generatedOn,
    isKey: pa.row.isKey,
    conclusion: pa.conclusion,
    status: pa.status,
    paper: pa,
    // versionTick: the trail lives in storage, so the row re-reads it after
    // a change rather than mirroring it in state.
  })), [papers, generatedOn, observationsByControl, auditFormat, engagement.id, versionTick]);

  // An internal audit's rows are its reports, written the way the Reports list
  // writes them: what the document is made of, then when it was generated.
  const reportRows = useMemo<PaperRow[]>(() => engagementReports.map(r => {
    const q = renderedQueryCount(r);
    // A format applied from the reader rewrites the body, so the row counts the
    // sections that format brings rather than the ones the report was made with.
    const applied = formatOptions.find(t => t.id === r.appliedTemplateId);
    const sec = renderedSectionCount(applied?.sections?.length ? { ...r, templateSections: applied.sections } : r);
    return {
      controlId: r.id,
      name: r.name,
      // The version it is on, then what the document is made of — the same
      // line a control paper's row writes. The reader appends a version for
      // every real change (an observation added, a section rewritten), so the
      // number here is that record, not a second count of it.
      subline: `v${peekVersion(r.id)} · ${q} ${q === 1 ? 'query' : 'queries'} · ${sec} ${sec === 1 ? 'section' : 'sections'}`,
      generated: r.generatedAt,
      isKey: false,
      conclusion: 'Not yet tested' as PaperConclusion,
      status: 'Draft' as PaperStatus,
      // Standard or Custom, per report: each one carries the format applied to
      // it rather than a single chip repeated down the column.
      source: (customFormatIds.has(r.appliedTemplateId ?? r.templateId) ? 'custom' : 'system') as 'custom' | 'system',
      report: r,
    };
    // openReport: the version trail is written while the report is open, so
    // the row re-reads it when the reader closes.
  }), [engagementReports, customFormatIds, formatOptions, openReport]);
  // What the list is made of: an internal audit's reports, or a compliance
  // engagement's per-control papers.
  const listRows = isIA ? reportRows : paperRows;
  const listCount = listRows.length + (bulkRow ? 1 : 0);

  const visibleRows = useMemo(() => {
    const q = paperSearch.trim().toLowerCase();
    const rows = bulkRow ? [bulkRow, ...listRows] : listRows;
    return rows.filter(r => {
      if (runFilter.length > 0 && !runFilter.includes(r.bulk ? RUN_BULK : RUN_SINGLE)) return false;
      if (!q) return true;
      return `${r.controlId} ${r.name} ${r.subline} ${conclusionWord(r.conclusion, isIA)} ${r.status}`.toLowerCase().includes(q);
    });
  }, [listRows, bulkRow, paperSearch, runFilter, isIA]);
  const filtered = paperSearch.trim().length > 0 || runFilter.length > 0;
  const selectableVisibleIds = useMemo(() => visibleRows.filter(r => !r.bulk).map(r => r.controlId), [visibleRows]);
  const allVisibleSelected = selectableVisibleIds.length > 0 && selectableVisibleIds.every(id => selectedPapers.has(id));
  // Only real working papers can be deleted; the bulk audit row is a report of
  // the audit, not one of its papers.
  const bulkDeletableIds = useMemo(
    () => listRows.filter(r => selectedPapers.has(r.controlId)).map(r => r.controlId),
    [listRows, selectedPapers],
  );
  const toggleSelectAllPapers = () => setSelectedPapers(prev => (
    allVisibleSelected
      ? new Set([...prev].filter(id => !selectableVisibleIds.includes(id)))
      : new Set([...prev, ...selectableVisibleIds])
  ));
  const clearPaperSelection = () => setSelectedPapers(new Set());
  const downloadSelected = () => {
    const ids = visibleRows.filter(r => selectedPapers.has(r.controlId)).map(r => r.controlId);
    ids.forEach(id => downloadOne(id, { quiet: true }));
    addToast({ type: 'success', message: `${ids.length} ${ids.length === 1 ? 'report' : 'reports'} downloaded` });
    logEvent({ action: 'Export', description: `Downloaded ${ids.length} control reports from ${engagement.code}`, module: 'Engagements', entity: logEntity });
    clearPaperSelection();
  };

  // An audit report opens in the product's own reader, so it reads here
  // exactly as it reads in Reports.
  if (openReport) {
    return (
      <ReportView
        report={openReport}
        onBack={() => setOpenReportId(null)}
        backLabel="Back to Audit Report"
        // Only the workspace's own formats: the reader merges the standard
        // three in itself, and reads this list to tell Custom from Standard.
        customTemplates={customFormats}
        onApplyTemplate={(id, templateId) => {
          patchReport(id, { appliedTemplateId: templateId });
          logEvent({ action: 'Update', description: `Applied format "${formatOptions.find(t => t.id === templateId)?.name ?? templateId}" to report "${openReport.name}"`, module: 'Engagements', entity: logEntity });
        }}
        onUpdateDescription={(id, description) => patchReport(id, { description })}
        onUpdateSignoffs={(id, signoffs) => patchReport(id, { signoffs })}
        onChangeAudience={(id, shareAudience) => patchReport(id, { shareAudience })}
        onSaveAsTemplate={t => {
          // A second format cannot carry the same name as one already here, so
          // the copy is numbered the way Reports numbers it.
          const taken = formatOptions.map(x => x.name.toLowerCase());
          let name = t.name;
          for (let i = 2; taken.includes(name.toLowerCase()); i++) name = `${t.name} (${i})`;
          saveCustomTemplate({ ...t, name });
          setCustomFormats(readCustomTemplates());
          addToast({ type: 'success', message: `Format "${name}" saved to Custom formats.` });
          logEvent({ action: 'Create', description: `Saved format "${name}" from report "${openReport.name}"`, module: 'Engagements', entity: logEntity });
        }}
        onShare={can('rp_share')
          ? () => openShare({ type: 'report', id: openReport.id, name: openReport.name })
          : undefined}
      />
    );
  }

  // The bulk run opens in the reader Reports opens a bulk audit with: the same
  // component, the same treatment, the same data.
  if (bulkOpen && bulkReport) {
    return (
      <BulkAuditVariantView
        report={{ ...bulkReport, aestheticVariant: bulkReport.aestheticVariant ?? 'editorial' }}
        onBack={() => setBulkOpen(false)}
        backLabel="Back to Audit Report"
        templates={formatOptions}
        onApplyTemplate={(id, templateId) => {
          patchReport(id, { appliedTemplateId: templateId });
          logEvent({ action: 'Update', description: `Applied format "${formatOptions.find(t => t.id === templateId)?.name ?? templateId}" to report "${bulkReport.name}"`, module: 'Engagements', entity: logEntity });
        }}
        onChangeAudience={(id, shareAudience) => patchReport(id, { shareAudience })}
        onShare={can('rp_share')
          ? () => openShare({ type: 'report', id: bulkReport.id, name: bulkReport.name })
          : undefined}
      />
    );
  }

  // A control's working paper, opened as a report. It replaces the tab body
  // rather than sitting in a modal, so it reads (and prints) as the document it
  // is and the reader gets the whole width.
  const openPaper = openControlId ? papers.find(pa => pa.row.controlId === openControlId) ?? null : null;
  if (openPaper) {
    // The review trail is this paper's own, keyed by engagement and control, and
    // starts at the one real event: the paper being recorded.
    const reviewId = `wp-${engagement.id}-${openPaper.row.controlId}`;
    const reviewName = `${openPaper.row.controlId} · ${openPaper.row.controlDescription}`;
    // This paper as an Action Taken Report: one observation, the control, built
    // from what the paper actually holds. Nothing is invented — no action plans
    // are listed because none have been recorded against this control yet, and
    // the ATR is editable so the risk owner's are typed in there.
    const paperObservations = observationsByControl[openPaper.row.controlId] ?? [];
    const edits = paperEdits[openPaper.row.controlId] ?? {};
    const controlId = openPaper.row.controlId;
    const saveObservation = ({ name, description, attachments }: ObservationSavePayload) => {
      if (editingObs) {
        writeObservations(controlId, paperObservations.map(o =>
          o.id === editingObs.id ? { ...o, title: name, description, attachments } : o));
        addToast({ type: 'success', message: `${editingObs.obsId} updated.` });
        logEvent({ action: 'Update', description: `Edited observation ${editingObs.obsId} on ${docNoun} ${controlId}`, module: 'Engagements', entity: logEntity });
        recordPaperVersion(controlId, `Edited ${editingObs.obsId}`, [`Edited observation ${editingObs.obsId} — “${name}”`]);
      } else {
        const obsId = computeNextObservationId(paperObservations.map(o => o.obsId));
        writeObservations(controlId, [...paperObservations, {
          id: `wp-obs-${Date.now()}`, obsId, title: name, description, attachments,
        }]);
        addToast({ type: 'success', message: `${obsId} added.` });
        logEvent({ action: 'Create', description: `Added observation ${obsId} to ${docNoun} ${controlId}`, module: 'Engagements', entity: logEntity });
        recordPaperVersion(controlId, `Added ${obsId}`, [`Added observation ${obsId} — “${name}”`]);
      }
      setAddObsOpen(false);
      setEditingObs(null);
    };
    const deleteObservation = (o: ControlObservation) => {
      writeObservations(controlId, paperObservations.filter(x => x.id !== o.id));
      addToast({ type: 'success', message: `${o.obsId} removed.` });
      logEvent({ action: 'Delete', description: `Removed observation ${o.obsId} from ${docNoun} ${controlId}`, module: 'Engagements', entity: logEntity });
      recordPaperVersion(controlId, `Removed ${o.obsId}`, [`Removed observation ${o.obsId} — “${o.title}”`]);
    };

    const atrData: AtrReportData = {
      meta: {
        reportId: `ATR-${openPaper.row.controlId}`,
        auditTitle: reviewName,
        auditPeriod: `${engagement.periodStart} – ${engagement.periodEnd}`,
        preparedBy: preparer.name,
        generatedOn: wpToday,
        auditEntity: engagement.name,
        totalExceptions: openPaper.exceptionsFound || undefined,
      },
      observations: [{
        title: openPaper.row.controlDescription,
        process: openPaper.row.subProcess,
        description: edits.results ?? openPaper.results,
        querySummary: `${openPaper.row.controlId} · ${openPaper.attributesTested} of ${openPaper.attributesInScope} attributes tested`,
        riskSummary: `${openPaper.row.riskId} · ${openPaper.row.riskDescription}`,
        risk: openPaper.conclusion === 'Needs improvement' ? 'High' : openPaper.conclusion === 'Inconclusive' ? 'Medium' : 'Low',
        status: openPaper.conclusion === 'Satisfactory' ? 'Closed' : 'Open',
        exceptions: openPaper.exceptionsFound || undefined,
        actionPlans: [],
      },
      // Observations added by hand carry their own text and no invented plan,
      // the same way a report's manual observations reach an ATR.
      ...paperObservations.map(o => ({
        title: o.title,
        description: o.description,
        querySummary: o.obsId,
        risk: 'Medium' as const,
        status: 'Open' as const,
        actionPlans: [],
      }))],
      insights: [{
        title: `Conclusion — ${conclusionWord(openPaper.conclusion, isIA)}`,
        body: openPaper.conclusion === 'Satisfactory'
          ? `${openPaper.attributesTested} of ${openPaper.attributesInScope} attributes were tested and none failed, so this control needs no action.`
          : `${openPaper.exceptionsFound} of ${openPaper.attributesTested} tested attributes failed, so this control needs a dated action plan from the risk owner.`,
      }],
    };
    return (
      <>
      <ControlReportView
        report={{
          controlId: openPaper.row.controlId,
          description: openPaper.row.controlDescription,
          isKey: openPaper.row.isKey,
          subProcess: openPaper.row.subProcess,
          riskId: openPaper.row.riskId,
          riskDescription: openPaper.row.riskDescription,
          scope: edits.scope ?? openPaper.scope,
          testProcedure: edits.testProcedure ?? openPaper.testProcedure,
          results: edits.results ?? openPaper.results,
          conclusion: conclusionWord(openPaper.conclusion, isIA),
          status: openPaper.status,
          attributesInScope: openPaper.attributesInScope,
          attributesTested: openPaper.attributesTested,
          exceptionsFound: openPaper.exceptionsFound,
        }}
        period={`${engagement.periodStart} – ${engagement.periodEnd}`}
        recordedBy={preparer.name}
        recordedOn={wpToday}
        version={peekVersion(reviewId)}
        summary={edits.summary ?? openPaper.summary}
        conclusionToneText={CONCLUSION_TEXT[openPaper.conclusion]}
        conclusionClass={CONCLUSION_CLS[openPaper.conclusion]}
        conclusionIcon={CONCLUSION_ICON[openPaper.conclusion]}
        documentNoun={DocNoun}
        showKeyControlTag={!isIA}
        templates={formatOptions}
        activeFormat={auditFormat}
        fallbackFormatName="Standard"
        onSelectFormat={t => setAuditFormat(t.id)}
        audience={controlAudiences[openPaper.row.controlId] ?? DEFAULT_REPORT_AUDIENCE}
        onAudienceChange={a => setControlAudience(openPaper.row.controlId, a)}
        onOpenActivity={() => { setReviewTab('comments'); setReviewOpen(true); }}
        onShare={can('rp_share')
          ? (e) => openShare({ type: 'control', id: openPaper.row.controlId, name: reviewName, anchor: rectFromEvent(e) })
          : undefined}
        onGenerateAtr={isIA ? () => setAtrOpen(true) : undefined}
        observations={paperObservations}
        onAddObservation={() => { setEditingObs(null); setAddObsOpen(true); }}
        onEditObservation={o => { setEditingObs({ id: o.id, obsId: o.obsId, name: o.title, description: o.description, attachments: o.attachments }); setAddObsOpen(true); }}
        onDeleteObservation={deleteObservation}
        onRegenerateSummary={() => {
          // Nothing was edited away, so nothing changed and no version is due.
          if (edits.summary === undefined) {
            addToast({ type: 'success', message: 'Summary is already the one written from the test results.' });
            return;
          }
          setPaperEdits(prev => {
            const forControl = { ...prev[controlId] };
            delete forControl.summary;
            const next = { ...prev, [controlId]: forControl };
            writeControlEdits(engagement.id, next);
            return next;
          });
          addToast({ type: 'success', message: 'Summary written again from the test results.' });
          recordPaperVersion(controlId, 'Regenerated Summary', ['Summary written again from the test results']);
        }}
        onSaveField={(field, value) => {
          // An Edit / Done round trip that changed nothing is not a version. The
          // prose autosaves on blur, so the same text comes back through here
          // whenever a section is opened and closed untouched.
          const before = { summary: edits.summary ?? openPaper.summary,
            scope: edits.scope ?? openPaper.scope,
            testProcedure: edits.testProcedure ?? openPaper.testProcedure,
            results: edits.results ?? openPaper.results }[field];
          if (before === value) return;
          savePaperField(controlId, field, value);
          logEvent({ action: 'Update', description: `Edited ${PAPER_FIELD_LABEL[field].toLowerCase()} on ${docNoun} ${controlId}`, module: 'Engagements', entity: logEntity });
          recordPaperVersion(controlId, `Edited “${PAPER_FIELD_LABEL[field]}”`, [`Edited “${PAPER_FIELD_LABEL[field]}” content`]);
        }}
        onBack={() => setOpenControlId(null)}
        onDownload={() => downloadOne(openPaper.row.controlId)}
      />
      <AnimatePresence>
        {reviewOpen && (
          <AtrReviewDrawer
            reportId={reviewId}
            reportName={reviewName}
            tab={reviewTab}
            onTab={setReviewTab}
            onClose={() => setReviewOpen(false)}
            initialVersions={loadBaselineVersions(reviewId, { by: preparer.name, at: wpToday, label: `${DocNoun} recorded` })}
            me={preparer.name}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {atrOpen && <GenerateATRModal onClose={() => setAtrOpen(false)} atrData={atrData} />}
      </AnimatePresence>
      <AddObservationModal
        open={addObsOpen}
        editing={editingObs}
        nextObsId={computeNextObservationId(paperObservations.map(o => o.obsId))}
        onClose={() => { setAddObsOpen(false); setEditingObs(null); }}
        onSave={saveObservation}
      />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Engagement summary — a two-line band, not a page of its own. An
          internal audit is summarised by what it found: the rating it carries,
          the findings behind that rating, and the facts that frame them. A
          compliance engagement is summarised by control effectiveness instead,
          so it keeps the conclusion split it has always had. */}
      {isIA ? (
      <div className="rounded-lg border border-canvas-border bg-white px-4 py-2.5">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[0.8125rem] font-semibold border shrink-0 -mr-2.5 ${RATING_CLS[auditRating]}`}>
            {(() => { const Ic = RATING_ICON[auditRating]; return <Ic size={14} />; })()}
            {RATING_WORD[auditRating]}
          </span>
          <RatingHelp
            rating={auditRating}
            open={openFindings.length}
            critical={findingsBySeverity.Critical}
            total={findings.length}
          />

          {openFindings.length === 0 ? (
            <span className="text-[0.75rem] text-ink-500">
              {findings.length === 0 ? 'No findings raised on this audit.' : 'Every finding raised has been closed.'}
            </span>
          ) : (
            /* What an auditor acts on, in the order they act on it: what is
               still open, how much of that is serious, and how far the audit
               has got through it. Each count opens the Findings tab, because a
               number worth reading is a number worth acting on. One accent
               only — the serious count — so the row reads as a priority, not
               as decoration. */
            <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpenFindings?.()}
                disabled={!onOpenFindings}
                title="Open the Findings tab"
                className="inline-flex items-baseline gap-1.5 rounded-md px-1 -mx-1 enabled:hover:bg-canvas enabled:cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <span className="text-[1.0625rem] font-bold tabular-nums text-ink-900 leading-none">{awaitingTriage}</span>
                <span className="text-[0.75rem] text-ink-500">open</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenFindings?.()}
                disabled={!onOpenFindings}
                title="Open the Findings tab"
                className="inline-flex items-baseline gap-1.5 rounded-md px-1 -mx-1 enabled:hover:bg-canvas enabled:cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <span className="text-[0.8125rem] font-bold tabular-nums text-ink-700">{inProgress}</span>
                <span className="text-[0.75rem] text-ink-500">in progress</span>
              </button>

              {/* How far the audit has got, as one quiet bar. A single tone:
                  the filled part is what is closed, the track is what is not. */}
              <button
                type="button"
                onClick={() => onOpenFindings?.()}
                disabled={!onOpenFindings}
                title={`${resolved} of ${findings.length} closed — open the Findings tab`}
                className="inline-flex items-center gap-2.5 min-w-[9rem] flex-1 rounded-md px-1 -mx-1 enabled:hover:bg-canvas enabled:cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
              >
                <span className="h-1.5 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-canvas-border">
                  <span className="block h-full rounded-full bg-compliant transition-[width] duration-500" style={{ width: `${closureRate}%` }} />
                </span>
                <span className="inline-flex items-baseline gap-1.5 text-[0.75rem] text-ink-500 whitespace-nowrap">
                  <span className="font-semibold tabular-nums text-ink-700">{resolved}</span>
                  of
                  <span className="font-semibold tabular-nums text-ink-700">{findings.length}</span>
                  closed
                  <span className="tabular-nums text-ink-400">({closureRate}%)</span>
                </span>
              </button>
            </div>
          )}

          {/* What the audit covers, quiet and on the same line — the band is
              one row, not a card with a second storey. */}
          <span className="inline-flex items-center gap-2 text-[0.75rem] text-ink-400 shrink-0">
            <span aria-hidden="true" className="w-px h-3.5 bg-canvas-border" />
            {engagement.process} · {engagement.periodStart} – {engagement.periodEnd}
          </span>
        </div>


      </div>
      ) : (
      <div className="rounded-lg border border-canvas-border bg-white px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[0.8125rem] font-semibold border shrink-0 ${CONCLUSION_CLS[overallConclusion]}`}>
            {(() => { const Ic = CONCLUSION_ICON[overallConclusion]; return <Ic size={14} />; })()}
            {conclusionWord(overallConclusion, isIA)}
          </span>

          {hasControls && (
            <>
              {/* The bar takes the slack, so the band stays one line wide on any
                  viewport instead of wrapping into a second block. */}
              <div className="flex h-1.5 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-canvas-border">
                {CONCLUSION_SPLIT.map(seg => {
                  const n = totals[seg.key];
                  if (n === 0) return null;
                  return (
                    <div
                      key={seg.key}
                      className={seg.bar}
                      style={{ width: `${(n / papers.length) * 100}%` }}
                      title={`${n} ${conclusionWord(seg.label, isIA).toLowerCase()}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-3.5 flex-wrap shrink-0">
                {CONCLUSION_SPLIT.map(seg => (
                  <span key={seg.key} className="inline-flex items-baseline gap-1.5">
                    <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full self-center ${seg.bar}`} />
                    <span className={`text-[0.8125rem] font-bold tabular-nums ${seg.text}`}>{totals[seg.key]}</span>
                    <span className="text-[0.75rem] text-ink-500">{conclusionWord(seg.label, isIA)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* The facts that frame the opinion, on one line. Each is a label and a
            value rather than a bare string, so "Internal Policy" is readable as
            the framework without a column header to look up. */}
        <div className="mt-2.5 pt-2.5 border-t border-canvas-border flex items-center gap-x-5 gap-y-1 flex-wrap text-[0.75rem]">
          {[
            { label: 'Scope', value: `${racmRows.length} ${racmRows.length === 1 ? 'control' : 'controls'}` },
            { label: 'Framework', value: engagement.framework },
            { label: 'Period', value: `${engagement.periodStart} – ${engagement.periodEnd}` },
            // Materiality is off the internal-audit band. The figure printed
            // here is a fixed ₹50K for every engagement, and a number an
            // auditor would act on cannot be a placeholder. SOX keeps it: a
            // SOX engagement captures materiality at creation.
            ...(isIA ? [] : [{ label: 'Materiality', value: '₹50K' }]),
            // Attributes tested stays off the internal-audit band: the band
            // already carries the conclusion split, and the count belongs to
            // each paper rather than to the opinion.
            ...(isIA ? [] : [{ label: 'Attributes tested', value: String(totals.totalAttributesTested) }]),
            { label: 'Exceptions', value: String(totals.totalExceptions) },
          ].map(f => (
            <span key={f.label} className="inline-flex items-baseline gap-1.5 min-w-0">
              <span className="text-ink-400">{f.label}</span>
              <span className="font-semibold text-ink-900 truncate">{f.value}</span>
            </span>
          ))}
        </div>
      </div>
      )}

      {/* What was picked, and what can be done with the lot: the same dark bar
          the rest of the product shows for a multi-selection. */}
      <AnimatePresence>
        {isIA && selectedPapers.size > 0 && (
          <motion.div
            key="papers-bulk-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            role="toolbar"
            aria-label="Bulk actions for selected reports"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pl-4 pr-2 py-2 rounded-lg bg-brand-900 text-white shadow-[0_8px_28px_rgb(15_8_30_/_0.28)] ring-1 ring-white/10"
          >
            <span className="text-[0.8125rem] font-semibold tabular-nums text-white">{selectedPapers.size} selected</span>
            {selectableVisibleIds.length > 0 && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
                <button
                  type="button"
                  onClick={toggleSelectAllPapers}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-colors text-white/80 hover:text-white hover:bg-white/10"
                >
                  {allVisibleSelected ? 'Deselect all' : `Select all (${selectableVisibleIds.length})`}
                </button>
              </>
            )}
            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
            <button
              type="button"
              onClick={downloadSelected}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-colors text-white/80 hover:text-white hover:bg-white/10"
            >
              <Download size={14} /> Download
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-colors text-risk-300 hover:text-white hover:bg-risk-700"
            >
              <Trash2 size={14} /> Remove
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" aria-hidden />
            <button
              type="button"
              onClick={clearPaperSelection}
              aria-label="Cancel selection"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The per-control list, on every engagement type. An internal audit
          publishes a report per control here and opens it in the reader; a
          compliance engagement keeps the plainer list it has always had. */}
      <div className="space-y-2.5">
        {/* A compliance engagement still sets the format for the whole audit
            from here. On an internal audit the format is set from the open
            report, the way every other report in the product sets it. */}
        {!isIA && hasControls && (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <span className="text-[0.75rem] text-ink-400">Format for this audit</span>
            <ApplyTemplateChip
              templates={formatOptions}
              activeId={auditFormatId}
              activeName={auditFormat?.name ?? 'Standard'}
              onSelect={t => setAuditFormat(t.id)}
            />
          </div>
        )}

        {/* Search, then table-or-cards. No type filter: every row in an
            internal audit engagement is an internal audit report, so there is
            nothing to filter by. There is no "generate" button either — a
            control report exists because the control is in scope. */}
        {isIA && listCount > 0 && (
          <ListToolbar
            search={paperSearch}
            onSearch={setPaperSearch}
            searchPlaceholder="Search reports…"
            trailing={
              <>
                {/* The type filter lives in the table's Type header, on the column
                    it filters. Cards have no header, so the toolbar keeps it there. */}
                {paperView === 'grid' && (
                  <ColumnFilter
                    variant="button"
                    icon
                    selectIndicator="checkbox"
                    label="Type"
                    options={RUN_OPTIONS}
                    value={runFilter}
                    onChange={setRunFilter}
                    align="end"
                  />
                )}
                <ToolbarViewToggle mode={paperView} onChange={setPaperView} />
              </>
            }
          />
        )}

        {listCount === 0 ? (
          <div className="border border-border-light rounded-xl p-12 text-center bg-white">
            <FileText size={28} className="text-text-muted mx-auto mb-3" />
            <p className="text-[0.875rem] font-semibold text-text mb-1">{isIA ? 'No reports yet' : 'No controls in scope'}</p>
            <p className="text-[0.75rem] text-text-muted">{isIA ? 'Reports published on this audit are listed here.' : 'Upload a RACM or add controls in the Controls tab.'}</p>
          </div>
        ) : isIA && paperView === 'grid' ? (
          visibleRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports match your filters"
              body="Try a different search or type."
              size="compact"
            />
          ) : (
            <InfiniteCardGrid
              items={visibleRows}
              resetKey={paperSearch}
              renderItem={(row, i) => row.bulk ? (
                <ReportCard
                  key={row.controlId}
                  index={i}
                  icon={Layers}
                  iconClass="bg-mitigated-50 text-mitigated-700"
                  eyebrow="Bulk Audit"
                  title={row.name}
                  description={row.subline}
                  footerRight={<span className="text-[0.6875rem] tabular-nums text-ink-400">{row.generated}</span>}
                  onClick={() => setBulkOpen(true)}
                />
              ) : (
                <ReportCard
                  key={row.controlId}
                  index={i}
                  icon={FileText}
                  iconClass="bg-brand-50 text-brand-700"
                  eyebrow={isIA ? 'Internal audit report' : (row.isKey ? 'Key control' : 'Standard')}
                  title={row.name}
                  description={row.subline}
                  badge={row.report ? <SourceChip source={row.source ?? auditFormatSource} /> : undefined}
                  pills={row.report ? undefined : [conclusionWord(row.conclusion, isIA), row.status]}
                  footerRight={<span className="text-[0.6875rem] tabular-nums text-ink-400">{row.generated}</span>}
                  onClick={() => { if (row.report) setOpenReportId(row.report.id); else setOpenControlId(row.controlId); }}
                  selectable
                  selected={selectedPapers.has(row.controlId)}
                  isSelecting={isSelectingPapers}
                  onToggleSelect={() => togglePaperSelect(row.controlId)}
                  actions={
                    <>
                      <ActionTooltip label="Download">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadOne(row.controlId); }}
                          aria-label={`Download ${docNoun}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                        >
                          <Download size={14} />
                        </button>
                      </ActionTooltip>
                      {can('rp_share') && (
                        <ActionTooltip label="Share">
                          <button
                            onClick={(e) => { e.stopPropagation(); openShare(row.report ? { type: 'report', id: row.controlId, name: row.name, anchor: rectFromEvent(e) } : { type: 'control', id: row.controlId, name: `${row.controlId} · ${row.name}`, anchor: rectFromEvent(e) }); }}
                            aria-label="Share"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                          >
                            <Share2 size={14} />
                          </button>
                        </ActionTooltip>
                      )}
                    </>
                  }
                />
              )}
            />
          )
        ) : (
          // The same card the Reports list puts its table in, so a table of
          // reports reads as the same object in both places.
          <div className="rounded-lg border border-canvas-border bg-canvas-elevated overflow-clip">
          <SmartTable
            className=""
            variant="modern"
            dense
            searchable={false}
            showSortHint
            stickyHeader
            stickyHeaderTop="top-0"
            fixedLayout
            hideResultCount
            paginated={visibleRows.length > 20}
            pageSize={20}
            keyField="controlId"
            data={visibleRows as unknown as Record<string, unknown>[]}
            onRowClick={(item) => {
              const row = item as unknown as PaperRow;
              if (row.bulk) setBulkOpen(true);
              else if (row.report) setOpenReportId(row.report.id);
              else setOpenControlId(row.controlId);
            }}
            emptyContent={
              <EmptyState
                icon={FileText}
                title={filtered ? 'No reports match your filters' : isIA ? 'No reports yet' : 'No controls in scope'}
                body={filtered ? 'Try a different search or type.' : isIA ? 'Reports published on this audit are listed here.' : 'Upload a RACM or add controls in the Controls tab.'}
                size="compact"
              />
            }
            columns={[
              { key: 'name', label: 'Report', truncate: true, render: (item) => {
                const row = item as unknown as PaperRow;
                if (row.bulk) {
                  return (
                    <ReportNameCell
                      icon={Layers}
                      iconClass="bg-mitigated-50 text-mitigated-700"
                      name={row.name}
                      subline={row.subline}
                      onClick={() => setBulkOpen(true)}
                    />
                  );
                }
                if (isIA) {
                  return (
                    <ReportNameCell
                      icon={BookOpen}
                      iconClass="bg-brand-50 text-brand-700"
                      name={row.name}
                      subline={
                        /* What the report is made of — the same shape a report
                           row uses ("2 queries · 3 sections"). */
                        <span className="truncate">{row.subline}</span>
                      }
                      onClick={() => { if (row.report) setOpenReportId(row.report.id); else setOpenControlId(row.controlId); }}
                      selectable={!row.bulk}
                      selected={selectedPapers.has(row.controlId)}
                      isSelecting={isSelectingPapers}
                      onToggleSelect={() => togglePaperSelect(row.controlId)}
                    />
                  );
                }
                return (
                  <div className="flex items-center gap-3 min-w-0">
                    <span aria-hidden="true" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md text-brand-600 bg-brand-50">
                      <FileText size={16} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[0.75rem] text-ink-400 shrink-0">{row.controlId}</span>
                        <span className="text-[0.875rem] font-semibold tracking-[-0.006em] text-ink-900 truncate" title={row.name}>{row.name}</span>
                      </div>
                      <div className="mt-0.5 text-[0.75rem] text-ink-400 truncate" title={row.subline}>{row.subline}</div>
                    </div>
                  </div>
                );
              }},
              /* No Type column on an internal audit: every row here is an
                 internal audit report, so the column would repeat the same
                 pill ten times. Whether the control is a key control is control
                 data and rides in the subline. A compliance engagement keeps
                 the column, where it separates key controls from the rest. */
              ...(isIA ? [] : [{ key: 'isKey', label: 'Type', width: '7.5rem', render: (item: Record<string, unknown>) => (
                (item as unknown as PaperRow).isKey
                  ? <ReportPill tone="mitigated">Key control</ReportPill>
                  : <ReportPill tone="draft">Standard</ReportPill>
              )}]),
              /* Only the bulk run is tagged. Every other row here is a single
                 run, which is the norm on this tab, so its cell stays empty
                 rather than repeating one chip down the whole column. */
              ...(isIA ? [{ key: 'run', label: 'Type', width: REPORT_COL_W.source,
                filter: <ColumnFilter selectIndicator="checkbox" label="Type" options={RUN_OPTIONS} value={runFilter} onChange={setRunFilter} align="end" />,
                render: (item: Record<string, unknown>) => (
                (item as unknown as PaperRow).bulk
                  ? <ReportPill tone="mitigated">{RUN_BULK}</ReportPill>
                  : null
              )}] : []),
              /* Format — the same column the Reports list carries, in the same
                 place: after what the row is, before when it was generated. Each
                 row reads the format applied to that report. */
              ...(isIA ? [{ key: 'source', label: 'Format', width: REPORT_COL_W.source, render: (item: Record<string, unknown>) => (
                <SourceChip source={(item as unknown as PaperRow).source ?? auditFormatSource} />
              )}] : []),
              { key: 'generated', label: 'Generated', width: isIA ? REPORT_COL_W.generated : '9rem', render: (item) => (
                <span className="text-[0.75rem] tabular-nums text-ink-500 whitespace-nowrap">{(item as unknown as PaperRow).generated}</span>
              )},
              { key: 'actions', label: '', width: isIA ? REPORT_COL_W.actions : '5.5rem', sortable: false, align: 'right', render: (item) => {
                const row = item as unknown as PaperRow;
                const id = row.controlId;
                // The bulk run takes the same three actions, pointed at the
                // report rather than at a control's workbook.
                if (row.bulk) {
                  return (
                    <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <ActionTooltip label="Download">
                        <button
                          onClick={(e) => { e.stopPropagation(); startReportDownload(addToast, updateToast, row.name); }}
                          aria-label="Download report"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                        >
                          <Download size={14} />
                        </button>
                      </ActionTooltip>
                      {can('rp_share') && (
                        <ActionTooltip label="Share">
                          <button
                            onClick={(e) => { e.stopPropagation(); openShare({ type: 'report', id, name: row.name, anchor: rectFromEvent(e) }); }}
                            aria-label="Share"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                          >
                            <Share2 size={14} />
                          </button>
                        </ActionTooltip>
                      )}
                      <ActionTooltip label={rmVerb}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPaperToDelete({ id, name: row.name }); }}
                          aria-label={`${rmVerb} report`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-risk-200 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </ActionTooltip>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    {isIA ? (
                      <>
                        <ActionTooltip label="Download">
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadOne(id); }}
                            aria-label={`Download ${docNoun}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                          >
                            <Download size={14} />
                          </button>
                        </ActionTooltip>
                        {can('rp_share') && (
                          <ActionTooltip label="Share">
                            <button
                              onClick={(e) => { e.stopPropagation(); openShare(row.report ? { type: 'report', id, name: row.name, anchor: rectFromEvent(e) } : { type: 'control', id, name: `${id} · ${row.name}`, anchor: rectFromEvent(e) }); }}
                              aria-label="Share"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                            >
                              <Share2 size={14} />
                            </button>
                          </ActionTooltip>
                        )}
                        <ActionTooltip label={rmVerb}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPaperToDelete({ id, name: row.name }); }}
                            aria-label={`${rmVerb} ${docNoun}`}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-risk-200 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </ActionTooltip>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadOne(id); }}
                          title={`Download this control's ${docNoun} (.xlsx)`}
                          aria-label={`Download ${docNoun}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenControlId(id); }}
                          title={`Open this ${docNoun}`}
                          aria-label="Open report"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                        >
                          <SquareArrowOutUpRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              }},
            ]}
          />
          </div>
        )}
      </div>

      {/* Removing the selection takes those papers off this list; the toast
          puts them all back. The bulk audit is not a working paper, so a
          selection that includes it removes only the papers. */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`${rmVerb} ${bulkDeletableIds.length} ${bulkDeletableIds.length === 1 ? docNoun : `${docNoun}s`}${isIA ? ' from this audit' : ''}?`}
        description={<>This will remove <span className="font-semibold text-ink-800">{bulkDeletableIds.length} {bulkDeletableIds.length === 1 ? docNoun : `${docNoun}s`}</span> from this audit. You can undo this from the toast for a few seconds.</>}
        confirmLabel={rmVerb}
        destructive
        onConfirm={() => {
          const ids = bulkDeletableIds;
          setRemoved([...removedPapers, ...ids.filter(id => !removedPapers.includes(id))]);
          setBulkDeleteOpen(false);
          clearPaperSelection();
          logEvent({ action: 'Delete', description: `Deleted ${ids.length} ${docNoun}${ids.length === 1 ? '' : 's'} on ${engagement.name}`, module: 'Engagements', entity: logEntity });
          addToast({
            type: 'success',
            message: `${ids.length} ${docNoun}${ids.length === 1 ? '' : 's'} ${isIA ? 'removed from this audit' : 'deleted'}.`,
            action: ids.length ? { label: 'Undo', onClick: () => setRemoved(readRemovedPapers(engagement.id).filter(x => !ids.includes(x))) } : undefined,
          });
        }}
      />

      {/* Deleting a paper takes it off this list; the toast puts it back. */}
      <ConfirmDialog
        open={!!paperToDelete}
        onClose={() => setPaperToDelete(null)}
        title={`${rmVerb} ${docNoun}${isIA ? ' from this audit' : ''}?`}
        description={paperToDelete && (
          <>This will remove <span className="font-semibold text-ink-800">{paperToDelete.name}</span> from this audit's {docNoun}s. You can undo this from the toast for a few seconds.</>
        )}
        confirmLabel={rmVerb}
        destructive
        onConfirm={() => {
          if (!paperToDelete) return;
          const { id, name } = paperToDelete;
          setRemoved([...removedPapers, id]);
          setPaperToDelete(null);
          setSelectedPapers(prev => { const next = new Set(prev); next.delete(id); return next; });
          logEvent({ action: 'Delete', description: `Deleted ${docNoun} for control ${id}`, module: 'Engagements', entity: logEntity });
          addToast({
            type: 'success',
            message: `${name} ${isIA ? 'removed from this audit' : 'deleted'}.`,
            action: { label: 'Undo', onClick: () => setRemoved(readRemovedPapers(engagement.id).filter(x => x !== id)) },
          });
        }}
      />
    </div>
  );
}
