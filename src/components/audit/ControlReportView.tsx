// One control's working paper, opened as the report it is: a letterhead, a
// numbered body, and the same command bar every other open report in the
// product carries — back, the format it comes out in, download. A format that
// carries branding (one imported from a real report) re-letterheads this page;
// the built-in formats have no branding of their own, so those keep the house
// letterhead and only the named format changes. The format belongs to the whole
// audit, so picking one here changes every control report in it.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, AlertTriangle, Check, CheckCircle2, Download, Edit3, FileText, History, List, ListChecks, Pencil, Plus, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { ReportBrandBanner, ReportNumberedHeading, ReportKpiTiles } from '../reports/ReportDocumentChrome';
import { ApplyTemplateChip, ReportVisibilityChip } from '../reports/ReportBarControls';
import type { Audience } from '../shared/audience';
import { reportAccent, reportGradient, sectionBlurb, type EditableTemplate } from '../reports/reportShared';
import type { REPORT_TEMPLATES } from '../../data/mockData';
import { attachmentVisual, formatFileSize, isImageMime, openAttachmentInNewTab, type ObservationAttachment } from '../reports/AddObservationModal';
import { BLOCK_META, paperSections, type PaperBlock, type PaperSection } from './paperFormat';

/** An observation an auditor added to this paper by hand. */
export interface ControlObservation {
  id: string;
  obsId: string;
  title: string;
  description: string;
  attachments?: ObservationAttachment[];
}

export interface ControlReport {
  controlId: string;
  description: string;
  isKey: boolean;
  subProcess: string;
  riskId: string;
  riskDescription: string;
  scope: string;
  testProcedure: string;
  results: string;
  conclusion: string;
  status: string;
  attributesInScope: number;
  attributesTested: number;
  exceptionsFound: number;
}

/** One section of the paper, as its own card — the same shell a report's
 *  section gets in the reader, so a paper reads as the same kind of document. */
function SectionCard({ n, id, title, subtitle, right, index, children }: {
  n: number; id: string; title: string; subtitle?: string; right?: React.ReactNode; index: number; children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-lg border border-canvas-border px-6 py-5 scroll-mt-24"
    >
      <ReportNumberedHeading n={n} title={title} subtitle={subtitle} right={right} />
      {children}
    </motion.section>
  );
}

/** The visible per-section Edit / Done toggle, matching the reader's. */
function EditToggle({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={editing}
      className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold rounded-md border transition-colors cursor-pointer ${
        editing
          ? 'text-white bg-brand-600 border-brand-600 hover:bg-brand-700'
          : 'text-brand-600 bg-brand-50 border-brand-600/20 hover:bg-brand-50/70 hover:border-brand-600/35'
      }`}
    >
      {editing ? <><Check size={14} /> Done</> : <><Edit3 size={13} /> Edit</>}
    </button>
  );
}

/** A section's prose, editable in place. Saves as you go on blur; Esc drops the
 *  in-flight change, the same contract the reader's sections have. */
function PaperProse({ value, editing, onSave, onCancel, mono, lead }: {
  value: string; editing: boolean; onSave: (next: string) => void; onCancel: () => void; mono?: boolean;
  /** Document-size prose for the summary, the way the reader sets its lede. */
  lead?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);
  useEffect(() => { if (editing) { setDraft(value); cancelledRef.current = false; } }, [editing, value]);
  // The summary lede is set exactly as the internal audit report sets its
  // executive summary — same measure, size, leading and ink — so the two
  // documents read as the same format.
  const bodyCls = lead ? 'max-w-[80ch] text-[1.0625rem] text-ink-700 leading-[1.8]' : 'text-[0.875rem] text-ink-700 leading-relaxed';
  if (!editing) {
    return mono
      ? <pre className={`whitespace-pre-wrap font-sans ${bodyCls}`}>{value}</pre>
      : <p className={`${bodyCls} whitespace-pre-wrap`}>{value}</p>;
  }
  const commit = () => {
    if (cancelledRef.current) return;
    const trimmed = draft.trim();
    onSave(trimmed.length ? trimmed : value);
  };
  return (
    <div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        autoFocus
        rows={Math.max(3, Math.ceil(draft.length / 88))}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); cancelledRef.current = true; onCancel(); } }}
        className={`w-full resize-y rounded-md border border-brand-600/40 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-600/15 ${bodyCls}`}
      />
      <p className="mt-1.5 text-[0.6875rem] text-ink-400">Edits save as you go. Press Done when finished, or Esc to discard this change.</p>
    </div>
  );
}

/** The reader's outline rail — the same card, header and rows the reports
 *  reader uses, listing this paper's sections. */
function OutlineRail({ activeId, sections, observations, onJump, onAddObservation }: {
  activeId: string | null;
  sections: PaperSection[];
  observations: ControlObservation[];
  onJump: (id: string) => void;
  onAddObservation: () => void;
}) {
  const rows = [
    ...sections.map(sec => ({ id: sec.id, label: sec.title })),
    ...observations.map(o => ({ id: o.id, label: `${o.obsId} · ${o.title}` })),
  ];
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-3.5">
      <div className="flex items-center gap-2 mb-3 px-1">
        <List size={13} className="text-ink-400" />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-ink-400">On this page</span>
        <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-400">{rows.length}</span>
      </div>
      <ol className="list-none p-0 m-0 space-y-0.5">
        {rows.map((row, i) => (
          <li
            key={row.id}
            onClick={() => onJump(row.id)}
            className={`flex items-center gap-1.5 py-2 pl-1 pr-1 rounded-md cursor-pointer transition-colors hover:bg-brand-50/50 ${activeId === row.id ? 'bg-brand-50/60' : ''}`}
          >
            <span className="shrink-0 w-5 text-[0.6875rem] text-brand-500 font-semibold font-mono tabular-nums text-right">{String(i + 1).padStart(2, '0')}</span>
            <span className="flex-1 min-w-0 text-[0.8125rem] font-medium text-ink-600 truncate">{row.label}</span>
          </li>
        ))}
      </ol>
      <button
        onClick={onAddObservation}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/15 rounded-md hover:bg-brand-50/70 hover:border-brand-600/30 transition-colors cursor-pointer"
      >
        <Plus size={14} />
        Add Observation
      </button>
    </div>
  );
}

export default function ControlReportView({
  report, period, recordedBy, recordedOn, version, summary, conclusionClass, conclusionToneText, conclusionIcon: Ic,
  documentNoun = 'Report',
  showKeyControlTag = true,
  templates, activeFormat, fallbackFormatName, onSelectFormat,
  audience, onAudienceChange, onOpenActivity, onShare, onGenerateAtr, onBack, onDownload,
  observations, onAddObservation, onEditObservation, onDeleteObservation, onSaveField, onRegenerateSummary,
}: {
  report: ControlReport;
  period: string;
  recordedBy: string;
  /** The day this paper was recorded, as the reports list states it. */
  recordedOn: string;
  /** What version the paper is on. Stated in the byline the way the reports
   *  reader states a report's, so the number on the list row and the number on
   *  the document are visibly the same one. */
  version?: number;
  /** The paper in a sentence: scope, counts, conclusion. Editable. */
  summary: string;
  conclusionClass: string;
  /** The conclusion's text tone, for the summary tile. */
  conclusionToneText: string;
  conclusionIcon: React.ElementType;
  /** What this document is called on screen. An internal audit opens it as
   *  the report it is; a compliance engagement calls it a working paper. */
  documentNoun?: string;
  /** "Key control" is an ICFR classification. A compliance engagement tags
   *  the letterhead with it; an internal audit report does not carry it. */
  showKeyControlTag?: boolean;
  templates: typeof REPORT_TEMPLATES[number][];
  /** The format the whole audit goes out in, or null while none is picked. */
  activeFormat: typeof REPORT_TEMPLATES[number] | null;
  /** What the audit falls back to when no format has been picked. */
  fallbackFormatName: string;
  /** Picks the format for the whole audit, not for this control alone. */
  onSelectFormat: (t: typeof REPORT_TEMPLATES[number]) => void;
  /** Who can open this control report. */
  audience: Audience;
  onAudienceChange: (a: Audience) => void;
  /** Opens the review drawer — comments and version history for this paper. */
  onOpenActivity: () => void;
  /** Absent when the reader cannot share, so the button is not shown at all. */
  onShare?: (e: React.MouseEvent<HTMLElement>) => void;
  /** Restates this paper as an Action Taken Report. Absent where the
   *  engagement has no ATR path, so the button is not shown at all. */
  onGenerateAtr?: () => void;
  /** Observations the auditor added to this paper, in the order they were added. */
  observations: ControlObservation[];
  onAddObservation: () => void;
  onEditObservation: (o: ControlObservation) => void;
  onDeleteObservation: (o: ControlObservation) => void;
  /** Saves an edited section of the paper. The prose sections are the auditor's
   *  own words, so they are editable here and kept with the paper. */
  onSaveField: (field: 'summary' | 'scope' | 'testProcedure' | 'results', value: string) => void;
  /** Drops an edited summary back to the one derived from the test results. */
  onRegenerateSummary: () => void;
  onBack: () => void;
  onDownload: () => void;
}) {
  const brand = activeFormat as EditableTemplate | null;
  // The paper printed in the chosen format: the format's section names, in the
  // format's order, carrying this control's facts. No format picked and the
  // paper prints in its own shape.
  const sections = useMemo(() => paperSections(activeFormat), [activeFormat]);
  // Which section the reader is on, so the rail tracks the scroll the way the
  // reports reader's does.
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const ids = [...sections.map(sec => sec.id), ...observations.map(o => o.id)];
    const els = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-84px 0px -62% 0px', threshold: 0 },
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [observations, sections]);
  const [editingSection, setEditingSection] = useState<'summary' | 'scope' | 'testProcedure' | 'results' | null>(null);
  const jumpTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // What sits on the right of a fact's heading — the way to edit it, and for
  // the summary the way to write it again from the test results.
  const blockRight = (b: PaperBlock): React.ReactNode => {
    if (b === 'summary') {
      return (
        <div className="flex items-center gap-2">
          {/* The sentence is written from the test results, so this puts it
              back to what those results say — the way out of an edit that has
              gone stale. */}
          <button
            onClick={onRegenerateSummary}
            title="Write this summary again from the current test results"
            className="group/regen inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-600 bg-brand-50 border border-brand-600/20 rounded-md hover:bg-brand-50/70 hover:border-brand-600/35 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className="transition-transform duration-300 group-hover/regen:rotate-180" /> Regenerate
          </button>
          <EditToggle editing={editingSection === 'summary'} onToggle={() => setEditingSection(p => p === 'summary' ? null : 'summary')} />
        </div>
      );
    }
    const field = b === 'scope' ? 'scope' : b === 'procedure' ? 'testProcedure' : b === 'results' ? 'results' : null;
    if (!field) return null;
    return <EditToggle editing={editingSection === field} onToggle={() => setEditingSection(p => p === field ? null : field)} />;
  };

  // One fact of the paper. The counts are the same ones the working paper
  // exports, so the summary is the one place they are stated rather than a
  // table repeating them further down.
  const blockBody = (b: PaperBlock): React.ReactNode => {
    switch (b) {
      case 'summary':
        return (
          <>
            <div className="pb-6 border-b border-canvas-border mb-6">
              <ReportKpiTiles
                stats={[
                  { label: 'Attributes in scope', value: String(report.attributesInScope), icon: ListChecks, color: 'text-ink-900' },
                  { label: 'Attributes tested', value: String(report.attributesTested), icon: CheckCircle2, color: 'text-evidence-700' },
                  { label: 'Exceptions', value: String(report.exceptionsFound), icon: AlertTriangle, color: report.exceptionsFound > 0 ? 'text-risk-700' : 'text-compliant-700' },
                  { label: 'Pass rate', value: report.attributesTested > 0
                      ? `${Math.round(((report.attributesTested - report.exceptionsFound) / report.attributesTested) * 100)}%`
                      : '—', icon: Ic, color: conclusionToneText },
                ]}
              />
            </div>
            <PaperProse
              lead
              value={summary}
              editing={editingSection === 'summary'}
              onSave={v => onSaveField('summary', v)}
              onCancel={() => setEditingSection(null)}
            />
          </>
        );
      case 'risk':
        return (
          <p className="text-[0.875rem] text-ink-700 leading-relaxed">
            <span className="font-mono text-[0.75rem] text-ink-400">{report.riskId}</span> · {report.riskDescription}
          </p>
        );
      case 'scope':
        return (
          <PaperProse
            value={report.scope}
            editing={editingSection === 'scope'}
            onSave={v => onSaveField('scope', v)}
            onCancel={() => setEditingSection(null)}
          />
        );
      case 'procedure':
        return (
          <PaperProse
            mono
            value={report.testProcedure}
            editing={editingSection === 'testProcedure'}
            onSave={v => onSaveField('testProcedure', v)}
            onCancel={() => setEditingSection(null)}
          />
        );
      case 'results':
        return (
          <PaperProse
            value={report.results}
            editing={editingSection === 'results'}
            onSave={v => onSaveField('results', v)}
            onCancel={() => setEditingSection(null)}
          />
        );
      case 'conclusion':
        return (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-[0.8125rem] font-semibold ${conclusionClass}`}>
              <Ic size={13} /> {report.conclusion}
            </span>
            <span className="text-[0.8125rem] text-ink-400">{documentNoun} status: {report.status}</span>
          </div>
        );
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="report-printable h-full overflow-y-auto bg-canvas"
      ref={rootRef}
    >
      {/* Command bar — page-coloured and borderless, the same row the reports
          reader uses, so an opened working paper is the same object. */}
      <div className="sticky top-0 z-30 bg-canvas px-6 lg:px-12 xl:px-[124px] h-16 flex items-center justify-between gap-4 print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Audit Report
        </button>
        <div className="flex items-center gap-2">
          {/* The format, then who can open it, then what you can do with it —
              the same row, in the same order, as the reports reader. */}
          <ApplyTemplateChip
            templates={templates}
            activeId={activeFormat?.id ?? null}
            activeName={activeFormat?.name ?? fallbackFormatName}
            onSelect={onSelectFormat}
          />
          <ReportVisibilityChip audience={audience} onChange={onAudienceChange} />
          <button
            onClick={onOpenActivity}
            title={`View this ${documentNoun.toLowerCase()}'s comments and version history`}
            aria-label="View comments and version history"
            className="flex items-center justify-center w-9 h-9 text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <History size={16} />
          </button>
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
            </button>
          )}
          {/* This paper restated as an Action Taken Report — in the command bar
              with the other things you can do with the document, the same place
              the reports reader keeps it. */}
          {onGenerateAtr && (
            <button
              onClick={onGenerateAtr}
              title="Generate Action Taken Report"
              className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <FileText size={14} /> <span className="hidden sm:inline">Action Taken Report</span>
            </button>
          )}
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          >
            <Download size={14} /> Download
          </button>
        </div>
      </div>

      {/* Reader workspace — the outline rail beside a document column, the same
          frame the reports reader uses, so a paper opened here sits where a
          report opened there does. */}
      <div
        className="px-6 lg:px-12 xl:px-[124px] pt-3 pb-8 flex items-start gap-8 xl:gap-10"
        // The chosen format's colour runs through the body the way it does in
        // the reports reader — section numbers, ticks, the outline rail.
        style={{ '--rep-accent': reportAccent(brand?.theme, brand?.brandColor) } as React.CSSProperties}
      >
        <aside className="hidden xl:block w-[252px] shrink-0 sticky top-[72px] self-start max-h-[calc(100vh-96px)] overflow-y-auto pr-1 -mr-1 print:hidden">
          <OutlineRail activeId={activeId} sections={sections} observations={observations} onJump={jumpTo} onAddObservation={onAddObservation} />
        </aside>
        <div className="min-w-0 flex-1">
          {/* Letterhead — its own card, the way the reader's cover sits above
              the sections rather than inside the first one. */}
          <div className="rounded-lg overflow-hidden mb-5 border border-canvas-border bg-white">
            <ReportBrandBanner
              title={report.description}
              gradient={reportGradient(brand?.theme, brand?.brandColor)}
              logo={brand?.logoDataUrl}
              eyebrow={
                <span className="font-mono text-[0.6875rem] tracking-[0.04em] text-white/65">
                  {report.controlId}{showKeyControlTag && report.isKey ? ' · KEY CONTROL' : ''}
                </span>
              }
              footer={
                // Exactly the reader cover's byline, fact for fact: who
                // recorded it, when, how much it covers, over what period, then
                // the format it goes out in. The engagement and sub-process are
                // not repeated here — the Scope and Summary sections state both.
                // Each divider is its own item rather than a prefix on the
                // fact that follows it, so a byline that wraps never opens a
                // line on a stray pipe.
                <div className="flex items-center gap-1.5 text-[0.8125rem] flex-wrap">
                  {[recordedBy, recordedOn, version ? `v${version}` : null, `${report.attributesTested} / ${report.attributesInScope} attributes tested`, period].filter(Boolean).map((part, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span className="text-white/30 mx-0.5" aria-hidden="true">|</span>}
                      <span className={i === 0 ? 'font-semibold text-white' : 'text-white/70'}>{part}</span>
                    </Fragment>
                  ))}
                  <span className="inline-flex items-center h-6 px-2.5 ml-1 text-[0.6875rem] font-medium text-white bg-white/15 border border-white/25 rounded-full whitespace-nowrap">
                    {activeFormat?.name ?? fallbackFormatName}
                  </span>
                </div>
              }
            />
          </div>
          {/* The body sits on the same 16px section rhythm as the internal
              audit report reader, under the same 20px gap from the letterhead. */}
          <div className="space-y-4">

            {/* The body, printed under the chosen format's headings. Each of the
                paper's facts is placed under the heading that asks for it; a
                heading that folds several facts labels them inside, and a
                heading the paper has nothing for says so rather than
                inventing filler. */}
            {sections.map((sec, si) => (
              <SectionCard
                key={sec.id}
                n={si + 1}
                index={si}
                id={sec.id}
                title={sec.title}
                subtitle={sec.blocks.length === 1 && sec.blocks[0] === 'conclusion' && sec.title === BLOCK_META.conclusion.title
                  ? `Recorded by ${recordedBy}`
                  : sec.subtitle}
                right={sec.blocks.length === 1 ? blockRight(sec.blocks[0]) : undefined}
              >
                {sec.blocks.length === 0 ? (
                  <p className="text-[0.875rem] text-ink-400 leading-relaxed">
                    Nothing written here yet. {sectionBlurb(sec.title)}
                  </p>
                ) : sec.blocks.length === 1 ? (
                  blockBody(sec.blocks[0])
                ) : (
                  sec.blocks.map((b, bi) => (
                    <div key={b} className={bi > 0 ? 'mt-6 pt-6 border-t border-canvas-border' : ''}>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <h3 className="text-[0.8125rem] font-bold text-ink-800">{BLOCK_META[b].title}</h3>
                        {blockRight(b)}
                      </div>
                      {blockBody(b)}
                    </div>
                  ))
                )}
              </SectionCard>
            ))}

            {/* Observations the auditor added to this paper. They number on from
                the paper's own sections and carry their own edit / remove, the
                way an observation added to a report does. */}
            {observations.map((o, i) => (
              <SectionCard
                key={o.id}
                n={sections.length + i + 1}
                index={sections.length + i}
                id={o.id}
                title={o.title}
                subtitle={o.obsId}
                right={
                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => onEditObservation(o)}
                      title={`Edit ${o.obsId}`}
                      aria-label={`Edit ${o.obsId}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:text-brand-700 hover:border-ink-300/70 transition-colors cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteObservation(o)}
                      title={`Remove ${o.obsId}`}
                      aria-label={`Remove ${o.obsId}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-canvas-border bg-canvas-elevated text-ink-500 hover:text-risk-700 hover:border-risk-200 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                }
              >
                <p className="text-[0.875rem] text-ink-700 leading-relaxed whitespace-pre-wrap">{o.description}</p>
                {!!o.attachments?.length && (
                  <ul className="mt-3 flex flex-wrap gap-2 list-none p-0">
                    {o.attachments.map(a => {
                      const { Icon, tone } = attachmentVisual(a.mimeType);
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => openAttachmentInNewTab(a)}
                            title={`Open ${a.name} in a new tab`}
                            className="inline-flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-700 hover:border-brand-600/40 transition-colors cursor-pointer"
                          >
                            {isImageMime(a.mimeType) ? (
                              <img src={a.dataUrl} alt="" className="w-7 h-7 rounded object-cover border border-canvas-border" />
                            ) : (
                              <span className="w-7 h-7 rounded border border-canvas-border bg-white inline-flex items-center justify-center">
                                <Icon size={13} className={tone} />
                              </span>
                            )}
                            <span className="max-w-[200px] truncate">{a.name}</span>
                            <span className="text-ink-400 tabular-nums">{formatFileSize(a.size)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
