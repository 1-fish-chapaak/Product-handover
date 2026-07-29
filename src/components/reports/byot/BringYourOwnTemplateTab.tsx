// Bring Your Own Template — the whole journey on one tab.
//
// The one rule: extraction keeps the SKELETON, never the CONTENT. Section
// order, headings, tables, ratings, branding stay; their findings and figures
// are thrown away. The tab walks the five steps from the client's chair:
// upload one past report → the six passes read its shape → they review what we
// found side by side with their own document → save → every future report
// generates in their shape.
//
// Two file shapes come in: a PowerPoint, which is what most clients present to
// a committee, and a PDF, which is what they keep on file. The deck is the
// easier read of the two, because the file labels its own parts.
//
// Being 80% right and letting the user fix the rest in two minutes is the
// design choice here, which is why review is a real step and not a formality.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud, FileText, Check, Loader2, AlertTriangle, ArrowLeft,
  ShieldCheck, Sparkles, RotateCcw,
} from 'lucide-react';
import { useToast } from '../../shared/Toast';
import SectionReviewCanvas from '../SectionReviewCanvas';
import { SHAKY_CONFIDENCE, reviewChrome, type CanvasSection, type CanvasBlock } from '../sectionReviewShared';
import { readTemplateFromReport, classifyUpload } from './byotRead';
import type { ReadResult, ReadOutcome } from './byotRead';
import { type EditableTemplate, type TemplateBlock } from '../reportShared';

// ─── The six passes ─────────────────────────────────────────────────────────
// One read, one question. Six separate reads means that when the result is
// wrong we can point at exactly which read failed instead of debugging magic.
//
// A deck runs the same six, but the first five have almost nothing to do: the
// file says outright which box is the title, which shape is a table and which
// layout repeats. Only the reading changes. The template that comes out is
// identical either way, so the list says so rather than pretending otherwise.
const PDF_PASSES = [
  { title: 'Pull the text out', question: 'Every bit of text with its page, its spot, its size and its weight.' },
  { title: 'Take off tops and bottoms', question: 'Page numbers and “Confidential” stamps come off, and are saved as settings you check.' },
  { title: 'Find the headings', question: 'Big, rare and numbered means a heading. That gives the sections, in order.' },
  { title: 'Work out each block', question: 'Paragraph, table, row of numbers, box to fill in, highlighted note or chart?' },
  { title: 'Look for repeats', question: 'A shape that repeats is saved once and marked “as many as needed”.' },
  { title: 'The AI names things', question: 'What each section is for, and which words you use for how bad a problem is.' },
] as const;

const DECK_PASSES = [
  { title: 'Open the slides', question: 'Every box with what PowerPoint calls it, where it sits and what it says.' },
  { title: 'Take off the running header', question: 'A box saying the same thing on every slide is a running header, even if it is the title box. It is saved as a setting.' },
  { title: 'Read the headings', question: 'The title box names the slide, and a divider slide names the run that follows it. Nothing to guess.' },
  { title: 'Work out each block', question: 'A table object is a table, with its real columns. Same for the rest of the boxes.' },
  { title: 'Look for repeats', question: 'One slide per finding, or a run of slides repeating together. Saved once, marked “as many as needed”.' },
  { title: 'The AI names things', question: 'What each part is for, and which words you use for how bad a problem is.' },
] as const;

const PASS_MS = 900;
const READ_MS = PDF_PASSES.length * PASS_MS;
const EXTRACT_TIMEOUT_MS = 60_000;

const TEMPLATE_NAME_MAX = 60;

type Stage = 'upload' | 'reading' | 'review' | 'saved';

type Saved = {
  name: string;
  sections: number;
  dropped: number;
  captured: string[];
};

// ─── Upload rules ───────────────────────────────────────────────────────────
// A PowerPoint first, a PDF second. Those are the two shapes client reports
// actually arrive in: decks for committees, PDFs for the file. Everything else
// turns into one of those in a click, so the picker offers those two and says
// plainly what it does with the rest.
const FORMATS = [
  { format: 'A PowerPoint (.pptx)', note: 'the deck you present to the committee', verdict: 'Works today, and it is the easier read', tone: 'ok' },
  { format: 'A normal PDF', note: 'saved out of Word or any writing tool', verdict: 'Works today', tone: 'ok' },
  { format: 'A Word file', note: 'the file most teams write in', verdict: 'Later. For now, save it as a PDF and upload that.', tone: 'soon' },
  { format: 'A scanned PDF', note: 'a photo of a printed report', verdict: 'Later. No text inside, only a picture. We spot it and say so.', tone: 'soon' },
  { format: 'Excel, images, links, older .ppt', note: '', verdict: 'No. Taken out of the picker, so it stops offering what we cannot do.', tone: 'no' },
] as const;

// The engine's hierarchical output becomes review rows: a section with its
// typed blocks, its pre-filled description and its guessed fill case intact.
function toCanvas(result: ReadResult): CanvasSection[] {
  return result.sections.map((s, i) => ({
    id: `byot-${i}`,
    name: s.name.replace(/^\s*(?:\d+(?:\.\d+)*[.)]?|[A-Z][.)])\s+/, '').trim() || s.name,
    description: s.description,
    evidence: s.evidence,
    fill: s.fill,
    fillReason: s.fillReason,
    binding: s.binding,
    blocks: s.blocks.map((b, bi) => ({ ...b, id: `byot-${i}-b${bi}` })),
    confidence: s.confidence,
    flag: s.flag,
    page: s.page,
    appendix: s.appendix,
    wrapper: s.wrapper,
    source: s.source,
  }));
}

// Strip the review-only detection facts. The saved skeleton keeps shape and
// labels only, which is what makes it stable, shareable and versionable.
function toTemplateBlock(b: CanvasBlock): TemplateBlock {
  const { id, confidence, page, preview, ...block } = b;
  void id; void confidence; void page; void preview;
  return block;
}

// Everything pass 2 and pass 6 captured lands as template settings the user
// verifies, never as content.
function buildTemplate(
  secs: CanvasSection[], result: ReadResult, fileName: string, name: string,
): { template: EditableTemplate; captured: string[] } {
  const hf = result.furniture;
  const captured: string[] = [];

  // The sign-off is a SETTING, not a section: role labels and empty boxes with
  // nothing to generate. It comes back next to page numbers and the watermark,
  // which is where structure a human completes belongs.
  const signRoles = result.signoff?.roles
    ?? secs.map(s => (s.blocks ?? []).find(b => b.kind === 'signoff' && (b.signRoles?.length ?? 0) > 0)?.signRoles).find(Boolean);

  if (hf?.header.length || hf?.confidentiality) captured.push('running header');
  if (hf?.footer.length) captured.push('footer');
  if (result.coverColor) captured.push('brand colour');
  if (result.findingScale) captured.push('finding rating scale');
  if (result.opinionScale) captured.push('opinion scale');
  if (signRoles) captured.push(`signature block with ${signRoles.length} role${signRoles.length === 1 ? '' : 's'}`);
  // A closing page is the same kind of thing as the signature block: shape,
  // not writing. There is nothing to generate in it, so it is a setting that
  // prints their exact closing line at the end of every report.
  if (result.closing?.lines.length) captured.push('closing page');
  if (result.logo) captured.push('logo');

  // Sections that are only a sign off block become the template's signature
  // block instead of a duplicate prose section. Wrapper paperwork the user did
  // not keep is excluded here too, after its confirmation in review.
  const kept = secs.filter(s =>
    s.name.trim() &&
    !s.wrapper &&
    !((s.blocks ?? []).length > 0 && (s.blocks ?? []).every(b => b.kind === 'signoff')));

  const template: EditableTemplate = {
    id: `rt-byot-${Date.now().toString(36)}`,
    name,
    desc: `Your own report format, read from ${fileName}.`,
    category: 'Custom',
    icon: 'file-text',
    sections: kept.map(s => ({
      name: s.name.trim(),
      icon: 'file-text',
      ...(s.description ? { description: s.description } : {}),
      ...(s.fill ? { fill: s.fill } : {}),
      ...(s.binding ? { binding: s.binding } : {}),
      ...(s.blocks?.length ? { blocks: s.blocks.map(toTemplateBlock) } : {}),
    })),
    // The organisation the review screen showed on the letterhead is the one
    // the saved template has to carry, or the result contradicts the preview
    // the user just approved.
    ...(hf?.fields.auditEntity ? { brand: hf.fields.auditEntity } : {}),
    ...(hf?.confidentiality || hf?.header.length ? { headerText: hf.confidentiality || hf.header.join('  ·  ') } : {}),
    ...(hf?.footer.length ? { footerText: hf.footer.join('  ·  ') } : {}),
    ...(result.coverColor ? { brandColor: result.coverColor } : {}),
    ...(result.findingScale ? { findingScale: result.findingScale } : {}),
    ...(result.opinionScale ? { opinionScale: result.opinionScale } : {}),
    ...(signRoles ? {
      signoffEnabled: true,
      signatories: signRoles.map((role, i) => ({ id: `sig-byot-${i}`, role })),
    } : {}),
    ...(result.closing?.lines.length ? {
      closingEnabled: true,
      closingText: result.closing.lines,
    } : {}),
    ...(result.logo ? { logoDataUrl: result.logo } : {}),
    tags: ['Imported'],
  };

  return { template, captured };
}

// ─── Small pieces ───────────────────────────────────────────────────────────

function Rule() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-ink-900/15 bg-white px-4 py-3">
      <span className="shrink-0 mt-px inline-flex items-center rounded bg-ink-900 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-white">
        The one rule
      </span>
      <p className="text-[0.875rem] text-ink-900 leading-relaxed">
        We copy <span className="font-semibold text-brand-700">how your report looks</span>, not{' '}
        <span className="font-semibold text-brand-700">what it says</span>. We keep the sections we can fill from your
        audit results and the wording that never changes. The rest stays out, and we say which before you save.
      </p>
    </div>
  );
}

// Two kinds of part make it in. Everything else is left out, and we say so on
// screen. Word for word the same lists the Create template screen shows, so
// the promise does not change depending on which door you came through.
function KeepDiscard() {
  const rows = [
    {
      head: 'What we keep',
      tone: 'keep',
      items: [
        ['Parts we can fill from your audit results', 'the findings, the counts, the summary, recommendations, action tables, the cover details'],
        ['Parts whose wording never changes', 'rating definitions, how to read this report, the professional standards line, confidentiality notes'],
        ['Your look', 'headings, layout and order, your logo and colour, your letterhead, and your words for how bad a problem is'],
      ],
    },
    {
      head: 'What we leave out',
      tone: 'drop',
      items: [
        ['Every word and number in the file', 'the findings, figures, names and dates from the report you upload'],
        ['Parts we cannot fill', 'what was checked, replies from management, financial tables, admin pages, the aim of the audit'],
      ],
    },
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(r => (
        <div key={r.head} className="rounded-lg border border-canvas-border bg-white p-4">
          <p className={`text-[0.75rem] font-semibold uppercase tracking-[0.08em] ${r.tone === 'keep' ? 'text-compliant-700' : 'text-high-700'}`}>
            {r.head}
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {r.items.map(([head, body]) => (
              <li key={head} className="flex gap-2 text-[0.8125rem] text-ink-500 leading-relaxed">
                <span className={`mt-[0.4rem] h-1 w-1 shrink-0 rounded-full ${r.tone === 'keep' ? 'bg-compliant-500' : 'bg-high-500'}`} />
                <span><span className="font-medium text-ink-800">{head}</span>, {body}</span>
              </li>
            ))}
          </ul>
          {r.tone === 'drop' && (
            <p className="mt-2.5 text-[0.75rem] leading-relaxed text-ink-400">
              You see that list once, before you save, each with its reason. Anything else goes in one report at a time
              through Add Observation. The signature page is the exception, and comes back as a setting.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// The whole journey in one picture. You do one step of it: everything before
// the check screen happens with nothing on screen, and our own standard format
// is never touched.
function WhatHappens() {
  const steps = [
    { n: 1, head: 'You upload', sub: 'one past report' },
    { n: 2, head: 'We read it', sub: 'six reads' },
    { n: 3, head: 'You check it', sub: 'rename, untick' },
    { n: 4, head: 'Saved', sub: 'your file deleted' },
    { n: 5, head: 'Every report', sub: 'comes out your way' },
  ];
  return (
    <div className="rounded-lg border border-canvas-border bg-white px-4 py-3">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-400">
        What happens <span className="font-normal normal-case tracking-normal">· you do one step of it</span>
      </p>
      <ol className="mt-2.5 grid gap-1.5 sm:grid-cols-5">
        {steps.map(s => (
          <li key={s.n} className={`rounded-md border px-2.5 py-1.5 ${s.n === 3 ? 'border-brand-300 bg-brand-50/60' : 'border-canvas-border bg-canvas/50'}`}>
            <span className={`block text-[0.8125rem] font-semibold leading-snug ${s.n === 3 ? 'text-brand-700' : 'text-ink-800'}`}>
              <span className="tabular-nums text-ink-400">{s.n}.</span> {s.head}
            </span>
            <span className="block text-[0.75rem] leading-snug text-ink-400">{s.sub}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── The tab ────────────────────────────────────────────────────────────────

export default function BringYourOwnTemplateTab({
  onSaveTemplate,
  onDone,
  existingTemplateNames = [],
}: {
  /** Saves the finished skeleton into the custom template library. */
  onSaveTemplate: (t: EditableTemplate) => void;
  /** Jump to the Templates tab once a template is saved. */
  onDone?: () => void;
  /** Every template name already taken, so the name we seed is one the save
   *  can actually keep. Renaming it behind their back at save would mean the
   *  letterhead they approved is not the one they get. */
  existingTemplateNames?: string[];
}) {
  const { addToast } = useToast();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [pass, setPass] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<'deck' | 'pdf'>('pdf');
  const [result, setResult] = useState<ReadResult | null>(null);
  const [sections, setSections] = useState<CanvasSection[]>([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<Saved | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const passes = reading === 'deck' ? DECK_PASSES : PDF_PASSES;

  // The pass list ticks in step with the read. The parse resolves behind it.
  useEffect(() => {
    if (stage !== 'reading') return;
    const id = window.setInterval(() => setPass(p => Math.min(p + 1, PDF_PASSES.length - 1)), PASS_MS);
    return () => window.clearInterval(id);
  }, [stage]);

  const reset = () => {
    setStage('upload');
    setResult(null);
    setSections([]);
    setFileName('');
    setName('');
    setSaved(null);
  };

  const handleFile = async (file: File) => {
    const kind = classifyUpload(file.name);
    // Every decline is said out loud, and each one names the way out of it.
    if (kind === 'word') {
      addToast({ type: 'info', message: 'Word files come later. Save it as a PDF (File → Save as PDF) and upload that.' });
      return;
    }
    if (kind === 'legacy-ppt') {
      addToast({ type: 'info', message: 'That is an older .ppt, which is a different file format. Open it in PowerPoint and save it as .pptx, then upload that.' });
      return;
    }
    if (kind === 'spreadsheet') {
      addToast({ type: 'info', message: 'A spreadsheet has no report format in it. Upload the PowerPoint or the PDF you send out.' });
      return;
    }
    if (!kind) {
      addToast({ type: 'error', message: 'Upload one old report as a PowerPoint (.pptx) or a PDF. Those are the two we can read.' });
      return;
    }

    setFileName(file.name);
    setReading(kind);
    setPass(0);
    setStage('reading');
    let outcome: ReadOutcome;
    try {
      const [res] = await Promise.all([
        Promise.race<ReadOutcome>([
          readTemplateFromReport(file),
          new Promise<ReadOutcome>((_, reject) =>
            setTimeout(() => reject(new Error('extract-timeout')), EXTRACT_TIMEOUT_MS)),
        ]),
        new Promise(resolve => setTimeout(resolve, READ_MS)),
      ]);
      outcome = res;
    } catch {
      outcome = { ok: false, reason: 'unreadable' };
    }

    if (!outcome.ok) {
      setStage('upload');
      addToast({
        type: 'error',
        message:
          outcome.reason === 'password' ? `“${file.name}” is password protected. Remove the password and upload it again.`
          : outcome.reason === 'scanned' ? 'This looks like a scan, so there is no text inside, only a picture. Please upload the original PDF.'
          : outcome.reason === 'empty-deck' ? 'Every slide in this deck is a picture, so there is no text to read. Upload the deck you actually edit in PowerPoint.'
          : outcome.reason === 'legacy-ppt' ? 'That is an older .ppt. Open it in PowerPoint and save it as .pptx, then upload that.'
          : outcome.reason === 'too-long' ? `This report is ${outcome.pageCount} ${kind === 'deck' ? 'slides' : 'pages'}. Upload one of about 50 or fewer, typical of your work.`
          : outcome.reason === 'too-large' ? `“${file.name}” is too big to read here. Keep it under 30 MB.`
          : `We could not read “${file.name}”. Try saving it again from ${kind === 'deck' ? 'PowerPoint' : 'the tool you wrote it in'} and uploading that.`,
      });
      return;
    }

    const detected = toCanvas(outcome.result);
    setResult(outcome.result);
    setSections(detected);
    // Their document's title, else the filename — and never one already taken.
    const wanted = outcome.result.furniture?.fields.auditTitle
      || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const taken = new Set(existingTemplateNames.map(n => n.toLowerCase()));
    let unique = wanted;
    for (let i = 2; taken.has(unique.toLowerCase()) && i < 100; i++) unique = `${wanted} (${i})`;
    setName(unique.slice(0, TEMPLATE_NAME_MAX));
    setStage('review');

    // Headings with nothing beneath them are not turned into sections, but they
    // are never dropped in silence either.
    const skipped = outcome.result.skipped ?? [];
    if (skipped.length > 0) {
      addToast({
        type: 'info',
        message: `${skipped.length} heading${skipped.length === 1 ? ' had' : 's had'} nothing underneath, so ${skipped.length === 1 ? 'it was' : 'they were'} left out: ${skipped.map(s => `"${s}"`).join(', ')}.`,
      });
    }
  };

  const save = () => {
    if (!result) return;
    const clean = name.trim();
    if (!clean) { addToast({ type: 'error', message: 'Give the template a name first.' }); return; }
    const named = sections.filter(s => s.name.trim());
    if (named.length === 0) { addToast({ type: 'error', message: 'Keep at least one section before saving.' }); return; }

    const { template, captured } = buildTemplate(sections, result, fileName, clean);
    onSaveTemplate(template);
    // Only what was really left out counts as left out. A section that came
    // back as a setting is listed as kept just above, so counting it here too
    // would tell the user we dropped something we did not.
    setSaved({
      name: clean,
      sections: template.sections.length,
      dropped: result.dropped.filter(d => !d.captured).length,
      captured,
    });
    // The uploaded file is only needed for the side by side review, so it goes
    // the moment the template is saved. Said in the UI, and true.
    setResult(null);
    setSections([]);
    setStage('saved');
  };

  // The check queue: one of the four named situations, or a detector that could
  // not call it cleanly. Both put the section first on the review list.
  const shaky = sections.filter(s =>
    s.evidence !== 'added'
    && (!!s.flag || (s.confidence !== undefined && s.confidence <= SHAKY_CONFIDENCE))).length;
  // Some decks are built free-hand: text boxes drawn anywhere, layouts ignored,
  // titles typed into plain boxes. Those lose their labels and get read by
  // position and size instead, the way a PDF is. The giveaway is how few
  // headings PowerPoint itself named, so the caveat is shown on the evidence
  // rather than on every deck.
  // No floor on the section count: a hand built deck reads badly, so it
  // produces FEW sections, which is exactly when the caveat is worth saying.
  const freehandDeck = result?.unit === 'slide'
    && sections.length > 0
    && sections.filter(s => s.evidence === 'inferred').length > sections.length * 0.4;

  return (
    <div className="pb-4">
      <AnimatePresence mode="wait">

        {/* ── Step 1 · Upload ─────────────────────────────────────────────── */}
        {stage === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl space-y-5"
          >
            {/* What we are promising, in the words the memo closes on. */}
            <p className="text-[1.125rem] font-semibold leading-snug text-ink-900">
              Give us one old report, and every report we make for you will look like you made it yourself.
            </p>

            <Rule />

            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className={`rounded-lg border border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
                dragging ? 'border-brand-600 bg-brand-50/60' : 'border-canvas-border bg-white hover:border-brand-300 hover:bg-canvas'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pptx,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
              />
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <UploadCloud size={20} />
              </div>
              <p className="mt-3 text-[1rem] font-semibold text-ink-900">Upload one old report, as a PowerPoint or a PDF</p>
              <p className="mt-1 text-[0.875rem] text-ink-500">
                One old report is enough. Every report we make for you after that looks the same way. Nothing to set up:
                no settings, no questions to answer.
              </p>
              <p className="mt-3 text-[0.75rem] text-ink-400">
                One file · .pptx or .pdf · up to about 50 slides or pages · pick a report typical of your work · we keep it only while you set this up and delete it when you save
              </p>
            </div>

            <WhatHappens />

            <KeepDiscard />

            <div className="rounded-lg border border-canvas-border bg-white overflow-hidden">
              <p className="px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-500 border-b border-canvas-border bg-canvas">
                What you can upload
              </p>
              <ul>
                {FORMATS.map(f => (
                  <li key={f.format} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 border-b border-canvas-border last:border-b-0">
                    <span className="text-[0.875rem] font-medium text-ink-900">{f.format}</span>
                    {f.note && <span className="text-[0.75rem] text-ink-400">{f.note}</span>}
                    <span className={`ml-auto text-[0.8125rem] ${
                      f.tone === 'ok' ? 'text-compliant-700 font-medium' : f.tone === 'soon' ? 'text-mitigated-700' : 'text-ink-400'
                    }`}>
                      {f.verdict}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}

        {/* ── Step 2 · The six passes ─────────────────────────────────────── */}
        {stage === 'reading' && (
          <motion.div
            key="reading"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="rounded-lg border border-canvas-border bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.875rem] font-semibold text-ink-900 truncate">Reading {fileName}</p>
                  <p className="text-[0.75rem] text-ink-500">
                    {reading === 'deck'
                      ? 'Six reads. A deck labels its own parts, so the first five have little to work out. The AI runs last, only to name what was found.'
                      : 'Six reads. Five are just measuring; the AI runs last, only to name what the measuring found.'}
                  </p>
                </div>
              </div>

              <ol className="mt-5 space-y-1">
                {passes.map((p, i) => {
                  const done = i < pass;
                  const active = i === pass;
                  return (
                    <li key={p.title} className={`flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors ${active ? 'bg-brand-50/60' : ''}`}>
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-canvas-border bg-white text-ink-400">
                        {done ? <Check size={12} className="text-compliant-600" />
                          : active ? <Loader2 size={12} className="animate-spin text-brand-600" />
                          : <span className="text-[0.625rem] font-semibold tabular-nums">{i + 1}</span>}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[0.875rem] font-medium ${done || active ? 'text-ink-900' : 'text-ink-400'}`}>{p.title}</p>
                        <p className="text-[0.75rem] text-ink-500 leading-relaxed">{p.question}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </motion.div>
        )}

        {/* ── Step 3 · Review ─────────────────────────────────────────────── */}
        {stage === 'review' && result && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-[calc(100vh-16rem)] min-h-[560px] flex-col rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden"
          >
            {/* Do not make them choose. Every tag is already set, so the job
                here is verify, not decide. */}
            <header className="shrink-0 flex items-center justify-between gap-4 border-b border-canvas-border px-5 py-3">
              <div className="min-w-0">
                <h3 className="text-[0.875rem] font-semibold text-ink-900">What we found in {fileName}</h3>
                <p className="text-[0.75rem] text-ink-500">
                  We kept {sections.length} section{sections.length === 1 ? '' : 's'} we can fill from your audit results. Confirm, rename, reorder or untick them.
                  {(result.dropped.length > 0) && <> The other sections from your report are not included, and they are listed at the end with the reason.</>}
                  {shaky > 0 && <span className="text-mitigated-700 font-medium"> {shaky} we are unsure about, listed first.</span>}
                  {freehandDeck && (
                    <span className="text-mitigated-700"> This deck looks hand built, with the text typed into plain boxes rather than the title and layout slots, so we read it by position and size instead. Worth a closer look than usual.</span>
                  )}
                </p>
              </div>
              <button
                onClick={reset}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[0.8125rem] font-semibold text-ink-500 hover:text-ink-900 hover:bg-canvas transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} /> Start over
              </button>
            </header>

            <div className="flex-1 min-h-0 px-5 py-4 flex flex-col">
              <SectionReviewCanvas
                sections={sections}
                onSectionsChange={setSections}
                pages={result.pages}
                pageCount={result.pageCount}
                toc={result.toc}
                unit={result.unit ?? 'page'}
                notIncluded={result.dropped}
                // Their captured letterhead where the read found one, and the
                // defaults the saved template will print everywhere else. Built
                // in one place with the editor's review, so the cover approved
                // here is the cover the save produces either way.
                reportChrome={reviewChrome(result, { title: name })}
              />
            </div>

            <footer className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-canvas-border px-5 py-3">
              <label className="flex items-center gap-2 min-w-0">
                <span className="text-[0.75rem] font-medium text-ink-500 shrink-0">Template name</span>
                <input
                  value={name}
                  maxLength={TEMPLATE_NAME_MAX}
                  onChange={e => setName(e.target.value)}
                  className="h-9 w-64 max-w-full rounded-md border border-canvas-border bg-white px-3 text-[0.875rem] text-ink-900 focus:outline-none focus:border-brand-600/40 focus:ring-2 focus:ring-brand-600/10"
                />
              </label>
              <div className="flex items-center gap-3">
                {/* The trade-off, said on the check screen rather than after
                    they export something and find the gap. */}
                <div className="min-w-0 max-w-[52ch] text-right">
                  <span className="block text-[0.75rem] text-ink-500">
                    {sections.filter(s => s.name.trim() && !s.wrapper).length} sections kept · none of their words
                  </span>
                  <span className="block text-[0.75rem] leading-snug text-ink-400">
                    We make the findings and the summary in your format. What was checked, replies from management and admin pages come in one report at a time.
                  </span>
                </div>
                <button
                  onClick={save}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
                >
                  <ShieldCheck size={14} /> Save as template
                </button>
              </div>
            </footer>
          </motion.div>
        )}

        {/* ── Step 4 · Saved ──────────────────────────────────────────────── */}
        {stage === 'saved' && saved && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <div className="rounded-lg border border-canvas-border bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-compliant-50 text-compliant-700">
                <Sparkles size={18} />
              </div>
              <h3 className="mt-3 text-[1.125rem] font-semibold text-ink-900">“{saved.name}” is saved</h3>
              <p className="mt-1 text-[0.875rem] text-ink-500 leading-relaxed">
                {saved.sections} section{saved.sections === 1 ? '' : 's'} saved with none of their words in them. Each one is either filled from your audit results or printed word for word.
                {saved.captured.length > 0 && <> We also kept your {saved.captured.join(', ')}.</>}
                {' '}It sits next to the standard templates, and every report you make with it looks this way.
              </p>
              <p className="mt-2 text-[0.75rem] text-ink-400">
                {saved.dropped > 0 && <>{saved.dropped} section{saved.dropped === 1 ? ' from your report is' : 's from your report are'} not in the template. Anything else goes in one report at a time through Add Observation. </>}
                The report you uploaded has been deleted. We only needed it while you checked what we found.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {onDone && (
                  <button
                    onClick={onDone}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 transition-colors cursor-pointer"
                  >
                    <FileText size={14} /> See it in Templates
                  </button>
                )}
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-[0.8125rem] font-semibold text-ink-800 bg-white border border-canvas-border hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} /> Upload another report
                </button>
              </div>
            </div>

            {/* Honest about the edges, up front. Each one is exactly what the
                review step exists to catch. */}
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-canvas-border bg-canvas px-4 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-mitigated-600" />
              <p className="text-[0.75rem] text-ink-500 leading-relaxed">
                Edits you make inside a report stay in that report. The template only changes when you deliberately
                change the template.
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
