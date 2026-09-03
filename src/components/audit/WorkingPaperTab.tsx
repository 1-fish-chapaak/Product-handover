import { useEffect, useMemo, useState } from 'react';
import {
  FileText, Download, CheckCircle2, SquareArrowOutUpRight, ChevronDown, Check,
  XCircle, AlertTriangle, Clock,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import type { Engagement } from '../../data/engagements';
import { generateRacmForProcess, type RACMRow } from '../../data/racm';
import { PEOPLE } from '../../data/grc-domain';
import { useEngagementWorkspace } from './engagementWorkspace';
import { buildWpControls, downloadControlWorkingPaper } from './workingPaper';
import SmartTable from '../shared/SmartTable';
import AtrReviewDrawer from '../reports/AtrReviewDrawer';
import { loadBaselineVersions } from '../reports/atrReview';
import { DEFAULT_REPORT_AUDIENCE, type Audience } from '../shared/audience';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { useCan } from '../../context/CurrentUserContext';
import { AnimatePresence } from 'motion/react';
import ControlReportView from './ControlReportView';
import { ReportPill } from '../reports/ReportPill';
import { ApplyTemplateChip } from '../reports/ReportBarControls';
import { REPORT_TEMPLATES } from '../../data/mockData';

// Formats the author saved from the template builder. Read straight from the
// same store the Reports module writes, so this tab lists the formats that
// actually exist rather than the built-in three.
const CUSTOM_TEMPLATES_KEY = 'irame.reports.customTemplates.v2';
/** The format an audit's control reports come out in, keyed by engagement. */
const AUDIT_FORMAT_KEY = 'irame.engagements.reportFormat.v1';
/** Who can open a control report, keyed by engagement then control. */
const CONTROL_AUDIENCE_KEY = 'irame.engagements.controlReportAudience.v1';
const CONTROL_FORMAT_KEY = 'irame.engagements.controlReportFormat.v1';

function readCustomTemplates(): typeof REPORT_TEMPLATES[number][] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as typeof REPORT_TEMPLATES[number][]) : [];
  } catch { return []; }
}
/** A format set on one control paper, overriding the audit's. Keyed by
 *  engagement, then control. */
function readControlFormats(engagementId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONTROL_FORMAT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const forEng = parsed && typeof parsed === 'object' ? parsed[engagementId] : null;
    return forEng && typeof forEng === 'object' ? (forEng as Record<string, string>) : {};
  } catch { return {}; }
}
function writeControlFormats(engagementId: string, map: Record<string, string>): void {
  try {
    const raw = localStorage.getItem(CONTROL_FORMAT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    if (Object.keys(map).length === 0) delete next[engagementId]; else next[engagementId] = map;
    localStorage.setItem(CONTROL_FORMAT_KEY, JSON.stringify(next));
  } catch { /* a full or blocked store — the override just does not persist */ }
}
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

interface Props {
  engagement: Engagement;
  /** Told when a control report is open, so the page around this tab can step
   *  out of the way — an open report is the page, and it carries its own back
   *  button. */
  onReaderChange?: (open: boolean) => void;
}

type PaperConclusion = 'Effective' | 'Deficient' | 'Inconclusive' | 'Not yet tested';

type PaperStatus = 'Draft' | 'In Review' | 'Signed-off';

interface ControlPaper {
  row: RACMRow;
  scope: string;
  samplesSelected: number;
  samplesTested: number;
  exceptionsFound: number;
  testProcedure: string;
  results: string;
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
  paper: ControlPaper;
}


const CONCLUSION_CLS: Record<PaperConclusion, string> = {
  Effective:        'bg-compliant-50 text-compliant-700 border-compliant-100',
  Deficient:        'bg-risk-50 text-risk-700 border-risk-100',
  Inconclusive:     'bg-mitigated-50 text-mitigated-700 border-mitigated-100',
  'Not yet tested': 'bg-surface-2 text-text-muted border-border-light',
};

/** The four conclusion buckets, in the order an audit reads them: what passed,
 *  what failed, what could not be called, what is still outstanding. */
const CONCLUSION_SPLIT = [
  { key: 'effective'    as const, label: 'Effective',      bar: 'bg-compliant',   text: 'text-compliant-700' },
  { key: 'deficient'    as const, label: 'Deficient',      bar: 'bg-risk',        text: 'text-risk-700' },
  { key: 'inconclusive' as const, label: 'Inconclusive',   bar: 'bg-mitigated',   text: 'text-mitigated-700' },
  { key: 'notTested'    as const, label: 'Not yet tested', bar: 'bg-ink-300',     text: 'text-ink-500' },
];

/** The conclusion as a word rather than a chip — it rides in the row's subline
 *  now that the table carries the Reports list's four columns. */
const CONCLUSION_TEXT: Record<PaperConclusion, string> = {
  Effective:        'text-compliant-700',
  Deficient:        'text-risk-700',
  Inconclusive:     'text-mitigated-700',
  'Not yet tested': 'text-ink-400',
};

const CONCLUSION_ICON: Record<PaperConclusion, React.ElementType> = {
  Effective: CheckCircle2,
  Deficient: XCircle,
  Inconclusive: AlertTriangle,
  'Not yet tested': Clock,
};

/** Derive a stable working-paper from a RACM row using engagement.health.
 *  Demo-only — in production this would be authored data. */
/** The format one control paper goes out in. A row that has not been given its
 *  own format says the audit's, so "Standard" on ten rows is not ten separate
 *  decisions — it is the one the audit made. */
function RowFormatPicker({ templates, activeId, fallbackName, onSelect, onReset }: {
  templates: typeof REPORT_TEMPLATES[number][];
  activeId: string | null;
  fallbackName: string;
  onSelect: (t: typeof REPORT_TEMPLATES[number]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const inherited = !activeId;
  const active = templates.find(t => t.id === activeId) ?? null;
  const label = active?.name ?? fallbackName;
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={inherited
          ? `Follows the audit's format (${fallbackName}). Pick one here to override it for this control only.`
          : `This control goes out in ${label}, overriding the audit's format`}
        className={`inline-flex items-center gap-1 h-6 max-w-full px-2.5 rounded-full border text-[0.6875rem] font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${
          inherited
            ? 'bg-draft-50 text-ink-600 border-canvas-border hover:border-ink-300/70'
            : 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={11} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute left-0 top-full mt-1.5 w-[248px] bg-white rounded-lg shadow-[0_16px_40px_-12px_rgba(15,8,30,0.22)] border border-canvas-border z-50 overflow-hidden">
            <div className="px-3.5 pt-3 pb-1.5">
              <span className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-[0.12em]">Format for this control</span>
            </div>
            <div className="max-h-[240px] overflow-y-auto pb-1">
              <button
                role="menuitem"
                onClick={() => { setOpen(false); onReset(); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-canvas transition-colors cursor-pointer"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-semibold text-ink-800">Follow the audit</span>
                  <span className="block text-[0.75rem] text-ink-500 truncate">{fallbackName}</span>
                </span>
                {inherited && <Check size={14} className="shrink-0 text-brand-600" />}
              </button>
              {templates.map(t => (
                <button
                  key={t.id}
                  role="menuitem"
                  onClick={() => { setOpen(false); onSelect(t); }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-canvas transition-colors cursor-pointer"
                >
                  <span className="min-w-0 flex-1 text-[0.8125rem] font-medium text-ink-800 truncate">{t.name}</span>
                  {!inherited && t.id === activeId && <Check size={14} className="shrink-0 text-brand-600" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function deriveControlPaper(row: RACMRow, engagement: Engagement, idx: number): ControlPaper {
  const health = engagement.health / 100;
  const baseTested = Math.random() > 0.5; // not needed — make deterministic
  // Deterministic seed from controlId
  const h = Array.from(row.controlId).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const sampled = 5 + (h % 20);                                      // 5–24 samples
  const tested = Math.min(sampled, Math.round(sampled * (health > 0 ? Math.min(1, health + 0.05) : 0)));
  const failureRate = 1 - health;
  const exceptions = Math.max(0, Math.round(tested * failureRate * 0.4));
  const conclusion: PaperConclusion =
    tested === 0 ? 'Not yet tested'
    : exceptions === 0 ? 'Effective'
    : exceptions > tested * 0.2 ? 'Deficient'
    : 'Inconclusive';
  const status: PaperStatus =
    engagement.status === 'Closed' ? 'Signed-off'
    : engagement.status === 'Review' ? 'In Review'
    : 'Draft';
  void idx; void baseTested;
  return {
    row,
    scope: `Test ${row.controlDescription.toLowerCase()} for the engagement period ${engagement.periodStart} – ${engagement.periodEnd}.`,
    samplesSelected: sampled,
    samplesTested: tested,
    exceptionsFound: exceptions,
    testProcedure: row.attributes.map(a => `• ${a.testProcedure}`).join('\n'),
    results: exceptions === 0
      ? `All ${tested} sample${tested === 1 ? '' : 's'} passed. Control operating as designed.`
      : `${exceptions} of ${tested} samples failed. Exceptions investigated and documented in case management.`,
    conclusion,
    status,
  };
}

export default function WorkingPaperTab({ engagement, onReaderChange }: Props) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const isIA = engagement.type === 'Internal Audit';
  const titleShort = isIA ? 'Report' : 'Paper';

  // The seeded RACM library only holds P2P rows, so asking it directly left
  // every other process with an empty report: no per-control papers, a scope of
  // zero, and nothing to export. `generateRacmForProcess` returns the library
  // rows when it has them and process-appropriate rows when it does not, which
  // is what the RACM tab and Business Processes already use.
  const racmRows = useMemo(() => generateRacmForProcess(engagement.process), [engagement.process]);
  const papers = useMemo(() => racmRows.map((r, i) => deriveControlPaper(r, engagement, i)), [racmRows, engagement]);

  // Working-paper rows (.xlsx) — built from the shared engagement workspace so the
  // controls/attributes match the Controls tab. Excel, not PDF.
  const ws = useEngagementWorkspace();
  const wpToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  // The format this engagement's report comes out in — the same control every
  // open report carries, so a format picked in Reports is pickable here too.
  const formatOptions = useMemo(() => {
    const custom = readCustomTemplates();
    const seen = new Set<string>();
    return [...REPORT_TEMPLATES, ...custom].filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, []);
  const wpMeta = { preparedBy: engagement.owner, reviewedBy: 'Pending reviewer sign-off', preparedOn: wpToday };
  const downloadOne = (controlId: string) => {
    const c = wpById.get(controlId);
    if (!c) return;
    downloadControlWorkingPaper(engagement, c, wpMeta);
    addToast({ type: 'success', message: `Working_Paper_${controlId}.xlsx downloaded` });
    logEvent({ action: 'Export', description: `Downloaded working paper Working_Paper_${controlId}.xlsx for control ${controlId}`, module: 'Engagements', entity: 'Working Paper' });
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
  // A control paper can go out in a different format from the rest of the
  // audit. Most follow the audit and say so; the override is the exception.
  const [controlFormats, setControlFormats] = useState<Record<string, string>>(() => readControlFormats(engagement.id));
  const setControlFormat = (controlId: string, templateId: string | null) => {
    setControlFormats(prev => {
      const next = { ...prev };
      if (templateId) next[controlId] = templateId; else delete next[controlId];
      writeControlFormats(engagement.id, next);
      return next;
    });
  };
  const auditFormatName = auditFormat?.name ?? 'Standard';

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
  const [reviewTab, setReviewTab] = useState<'comments' | 'versions'>('comments');
  const { openShare } = useShare();
  const { can } = useCan();

  useEffect(() => { onReaderChange?.(openControlId !== null); }, [openControlId, onReaderChange]);
  // Leaving the tab with a report open must not leave the chrome hidden.
  useEffect(() => () => onReaderChange?.(false), [onReaderChange]);

  // Summary stats
  const totals = useMemo(() => {
    const t = { effective: 0, deficient: 0, inconclusive: 0, notTested: 0, totalSamples: 0, totalExceptions: 0 };
    papers.forEach(p => {
      if (p.conclusion === 'Effective')        t.effective++;
      else if (p.conclusion === 'Deficient')   t.deficient++;
      else if (p.conclusion === 'Inconclusive') t.inconclusive++;
      else                                       t.notTested++;
      t.totalSamples    += p.samplesTested;
      t.totalExceptions += p.exceptionsFound;
    });
    return t;
  }, [papers]);

  const overallConclusion: PaperConclusion =
    totals.deficient > 0 ? 'Deficient'
    : totals.inconclusive > 0 ? 'Inconclusive'
    : totals.effective > 0 ? 'Effective'
    : 'Not yet tested';

  // Who the control papers are recorded by.
  const preparer = useMemo(
    () => PEOPLE.find(p => p.role === 'Auditor' || p.role === 'Manager') ?? PEOPLE[0],
    [],
  );

  // Export is the one action left on this tab, and an empty audit has nothing
  // to export.
  const hasControls = papers.length > 0;

  // A control's working paper, opened as a report. It replaces the tab body
  // rather than sitting in a modal, so it reads (and prints) as the document it
  // is and the reader gets the whole width.
  const openPaper = openControlId ? papers.find(pa => pa.row.controlId === openControlId) ?? null : null;
  if (openPaper) {
    // The review trail is this paper's own, keyed by engagement and control, and
    // starts at the one real event: the paper being recorded.
    const reviewId = `wp-${engagement.id}-${openPaper.row.controlId}`;
    const reviewName = `${openPaper.row.controlId} · ${openPaper.row.controlDescription}`;
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
          scope: openPaper.scope,
          testProcedure: openPaper.testProcedure,
          results: openPaper.results,
          conclusion: openPaper.conclusion,
          status: openPaper.status,
          samplesSelected: openPaper.samplesSelected,
          samplesTested: openPaper.samplesTested,
          exceptionsFound: openPaper.exceptionsFound,
        }}
        engagementName={engagement.name}
        period={`${engagement.periodStart} – ${engagement.periodEnd}`}
        recordedBy={preparer.name}
        conclusionClass={CONCLUSION_CLS[openPaper.conclusion]}
        conclusionIcon={CONCLUSION_ICON[openPaper.conclusion]}
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
            initialVersions={loadBaselineVersions(reviewId, { by: preparer.name, at: wpToday, label: 'Working paper recorded' })}
            me={preparer.name}
          />
        )}
      </AnimatePresence>
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Engagement summary — a two-line band, not a page of its own. The
          engagement header directly above already carries the name, the code,
          the description and the control counts, so repeating them here cost a
          screen of height and said nothing new. What is left is only what this
          tab knows: the conclusion, where the controls landed, and the four
          facts that frame the opinion. */}
      <div className="rounded-lg border border-canvas-border bg-white px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[0.8125rem] font-semibold border shrink-0 ${CONCLUSION_CLS[overallConclusion]}`}>
            {(() => { const Ic = CONCLUSION_ICON[overallConclusion]; return <Ic size={14} />; })()}
            {overallConclusion}
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
                      title={`${n} ${seg.label.toLowerCase()}`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center gap-3.5 flex-wrap shrink-0">
                {CONCLUSION_SPLIT.map(seg => (
                  <span key={seg.key} className="inline-flex items-baseline gap-1.5">
                    <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full self-center ${seg.bar}`} />
                    <span className={`text-[0.8125rem] font-bold tabular-nums ${seg.text}`}>{totals[seg.key]}</span>
                    <span className="text-[0.75rem] text-ink-500">{seg.label}</span>
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
            // Samples tested is off the internal-audit band for the same reason
            // materiality is: the count is generated from control-id hashes,
            // not from testing anyone performed.
            ...(isIA ? [] : [{ label: 'Samples tested', value: String(totals.totalSamples) }]),
            { label: 'Exceptions', value: String(totals.totalExceptions) },
          ].map(f => (
            <span key={f.label} className="inline-flex items-baseline gap-1.5 min-w-0">
              <span className="text-ink-400">{f.label}</span>
              <span className="font-semibold text-ink-900 truncate">{f.value}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Per-control working papers — one row per control, the same table
          shape the Reports list uses, so a set of ten reads as a set of ten
          rather than ten of the same card stacked. Opening a row keeps the
          full working paper underneath it. */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-[0.75rem] font-semibold text-text">
            Per-control {titleShort.toLowerCase()}s <span className="text-text-muted font-normal">({papers.length})</span>
          </h3>
          {/* The format is the audit's, so it is set once here rather than on
              every row. Every control report below comes out in it. */}
          {hasControls && (
            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] text-ink-400">Format for this audit</span>
              <ApplyTemplateChip
                templates={formatOptions}
                activeId={auditFormatId}
                activeName={auditFormat?.name ?? 'Standard'}
                onSelect={t => setAuditFormat(t.id)}
              />
            </div>
          )}
        </div>
        {papers.length === 0 ? (
          <div className="border border-border-light rounded-xl p-12 text-center bg-white">
            <FileText size={28} className="text-text-muted mx-auto mb-3" />
            <p className="text-[0.875rem] font-semibold text-text mb-1">No controls in scope</p>
            <p className="text-[0.75rem] text-text-muted">Upload a RACM or add controls in the Controls tab.</p>
          </div>
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
            paginated={papers.length > 20}
            pageSize={20}
            keyField="controlId"
            data={papers.map(pa => ({
              controlId: pa.row.controlId,
              name: pa.row.controlDescription,
              subline: `${pa.row.subProcess} · ${pa.samplesTested} / ${pa.samplesSelected} samples tested · ${pa.exceptionsFound} exception${pa.exceptionsFound === 1 ? '' : 's'}`,
              generated: wpToday,
              isKey: pa.row.isKey,
              conclusion: pa.conclusion,
              status: pa.status,
              paper: pa,
            })) as unknown as Record<string, unknown>[]}
            onRowClick={(item) => setOpenControlId((item as unknown as PaperRow).controlId)}
            columns={[
              { key: 'name', label: 'Report', truncate: true, render: (item) => {
                const row = item as unknown as PaperRow;
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
                      <div className="mt-0.5 flex items-center gap-1.5 text-[0.75rem] text-ink-400 min-w-0">
                        <span className={`font-semibold shrink-0 ${CONCLUSION_TEXT[row.conclusion]}`}>{row.conclusion}</span>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="shrink-0">{row.status}</span>
                        <span aria-hidden="true" className="shrink-0">·</span>
                        <span className="truncate" title={row.subline}>{row.subline}</span>
                      </div>
                    </div>
                  </div>
                );
              }},
              { key: 'isKey', label: 'Type', width: '7.5rem', render: (item) => (
                (item as unknown as PaperRow).isKey
                  ? <ReportPill tone="mitigated">Key control</ReportPill>
                  : <ReportPill tone="draft">Standard</ReportPill>
              )},
              { key: 'format', label: 'Format', width: '11rem', sortable: false, render: (item) => {
                const row = item as unknown as PaperRow;
                return (
                  <RowFormatPicker
                    templates={formatOptions}
                    activeId={controlFormats[row.controlId] ?? null}
                    fallbackName={auditFormatName}
                    onSelect={t => setControlFormat(row.controlId, t.id)}
                    onReset={() => setControlFormat(row.controlId, null)}
                  />
                );
              }},
              { key: 'generated', label: 'Generated', width: '9rem', render: (item) => (
                <span className="text-[0.75rem] tabular-nums text-ink-500 whitespace-nowrap">{(item as unknown as PaperRow).generated}</span>
              )},
              { key: 'actions', label: '', width: '5.5rem', sortable: false, align: 'right', render: (item) => {
                const id = (item as unknown as PaperRow).controlId;
                return (
                  <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadOne(id); }}
                      title="Download this control's working paper (.xlsx)"
                      aria-label="Download working paper"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenControlId(id); }}
                      title="Open this working paper as a report"
                      aria-label="Open report"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:border-ink-300/70 hover:text-brand-700 hover:bg-canvas transition-colors cursor-pointer"
                    >
                      <SquareArrowOutUpRight size={14} />
                    </button>
                  </div>
                );
              }},
            ]}
          />
          </div>
        )}
      </div>
    </div>
  );
}
