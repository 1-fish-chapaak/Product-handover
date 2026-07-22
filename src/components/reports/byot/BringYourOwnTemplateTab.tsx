// Bring Your Own Template — the whole journey on one tab.
//
// The one rule: extraction keeps the SKELETON, never the CONTENT. Section
// order, headings, tables, ratings, branding stay; their findings and figures
// are thrown away. The tab walks the five steps from the client's chair:
// upload one past report (PDF) → the six passes read its shape → they review
// what we found side by side with their own document → save → every future
// report generates in their shape.
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
import { SHAKY_CONFIDENCE, type CanvasSection, type CanvasBlock } from '../sectionReviewShared';
import { readTemplateFromReport, type ReadResult, type ReadOutcome } from './byotEngine';
import type { EditableTemplate, TemplateBlock } from '../reportShared';

// ─── The six passes ─────────────────────────────────────────────────────────
// One read, one question. Six separate reads means that when the result is
// wrong we can point at exactly which read failed instead of debugging magic.
const PASSES = [
  { title: 'Pull the text out', question: 'Every bit of text with its page, its spot, its size and its weight.' },
  { title: 'Take off tops and bottoms', question: 'Page numbers and “Confidential” stamps come off, and are saved as settings you check.' },
  { title: 'Find the headings', question: 'Big, rare and numbered means a heading. That gives the sections, in order.' },
  { title: 'Work out each block', question: 'Paragraph, table, row of numbers, box to fill in, highlighted note or chart?' },
  { title: 'Look for repeats', question: 'A shape that repeats is saved once and marked “as many as needed”.' },
  { title: 'The AI names things', question: 'What each section is for, and which words you use for how bad a problem is.' },
] as const;

const PASS_MS = 900;
const READ_MS = PASSES.length * PASS_MS;
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
// V1 accepts one format done well. Everything else converts to PDF in one
// click, nothing converts the other way, so PDF is the funnel.
const FORMATS = [
  { format: 'A normal PDF', note: 'saved out of Word or any writing tool', verdict: 'Works today', tone: 'ok' },
  { format: 'A Word file', note: 'the file most teams write in', verdict: 'Later. For now, save it as a PDF and upload that.', tone: 'soon' },
  { format: 'A scanned PDF', note: 'a photo of a printed report', verdict: 'Later. No text inside, only a picture. We spot it and say so.', tone: 'soon' },
  { format: 'PowerPoint, Excel, images, links', note: '', verdict: 'No. Taken out of the picker, so it stops offering what we cannot do.', tone: 'no' },
] as const;

function classifyUpload(name: string): 'pdf' | 'word' | 'ppt' | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'ppt' || ext === 'pptx') return 'ppt';
  return null;
}

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
    ...(hf?.confidentiality || hf?.header.length ? { headerText: hf.confidentiality || hf.header.join('  ·  ') } : {}),
    ...(hf?.footer.length ? { footerText: hf.footer.join('  ·  ') } : {}),
    ...(result.coverColor ? { brandColor: result.coverColor } : {}),
    ...(result.findingScale ? { findingScale: result.findingScale } : {}),
    ...(result.opinionScale ? { opinionScale: result.opinionScale } : {}),
    ...(signRoles ? {
      signoffEnabled: true,
      signatories: signRoles.map((role, i) => ({ id: `sig-byot-${i}`, role })),
    } : {}),
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

function KeepDiscard() {
  const rows = [
    {
      head: 'What we keep',
      tone: 'keep',
      items: [
        'Sections we can fill from your audit results: findings, counts, the summary, recommendations, action tables',
        'Wording that never changes: rating definitions, how to read the report, the professional standards line',
        'Your headings, your layout, your order',
        'Your look: logo colour, the style of the top and bottom of every page, and your words for how bad a problem is',
      ],
    },
    {
      head: 'What we leave out',
      tone: 'drop',
      items: [
        'Every finding, figure, name and date from the report you upload',
        'Sections we cannot fill: what was checked, management replies, financial tables, admin pages',
        'You see that list before you save, and anything else goes in one report at a time through Add Observation',
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
            {r.items.map(i => (
              <li key={i} className="flex gap-2 text-[0.8125rem] text-ink-500 leading-relaxed">
                <span className={`mt-[0.4rem] h-1 w-1 shrink-0 rounded-full ${r.tone === 'keep' ? 'bg-compliant-500' : 'bg-high-500'}`} />
                {i}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── The tab ────────────────────────────────────────────────────────────────

export default function BringYourOwnTemplateTab({
  onSaveTemplate,
  onDone,
}: {
  /** Saves the finished skeleton into the custom template library. */
  onSaveTemplate: (t: EditableTemplate) => void;
  /** Jump to the Templates tab once a template is saved. */
  onDone?: () => void;
}) {
  const { addToast } = useToast();
  const [stage, setStage] = useState<Stage>('upload');
  const [fileName, setFileName] = useState('');
  const [pass, setPass] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ReadResult | null>(null);
  const [sections, setSections] = useState<CanvasSection[]>([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<Saved | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The pass list ticks in step with the read. The parse resolves behind it.
  useEffect(() => {
    if (stage !== 'reading') return;
    const id = window.setInterval(() => setPass(p => Math.min(p + 1, PASSES.length - 1)), PASS_MS);
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
    // Every decline is said out loud, and Word gets its one click path.
    if (kind === 'word') {
      addToast({ type: 'info', message: 'Word files come later. Save it as a PDF (File → Save as PDF) and upload that.' });
      return;
    }
    if (kind === 'ppt') {
      addToast({ type: 'info', message: 'We cannot read PowerPoint. Save the report as a PDF and upload that.' });
      return;
    }
    if (!kind) {
      addToast({ type: 'error', message: 'Upload one old report as a PDF. That is the one format we can read today.' });
      return;
    }

    setFileName(file.name);
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
          : outcome.reason === 'too-long' ? `This report is ${outcome.pageCount} pages. Upload one of about 50 pages or fewer, typical of your work.`
          : outcome.reason === 'too-large' ? `“${file.name}” is too big to read here. Keep it under 30 MB.`
          : `We could not read “${file.name}”. Try saving it as a PDF again and uploading that.`,
      });
      return;
    }

    const detected = toCanvas(outcome.result);
    setResult(outcome.result);
    setSections(detected);
    setName(
      (outcome.result.furniture?.fields.auditTitle
        || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      ).slice(0, TEMPLATE_NAME_MAX),
    );
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
    setSaved({ name: clean, sections: template.sections.length, dropped: result.dropped.length, captured });
    // The uploaded file is only needed for the side by side review, so it goes
    // the moment the template is saved. Said in the UI, and true.
    setResult(null);
    setSections([]);
    setStage('saved');
  };

  const shaky = sections.filter(s => s.evidence !== 'added' && s.confidence !== undefined && s.confidence <= SHAKY_CONFIDENCE).length;

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
                accept=".pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }}
              />
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <UploadCloud size={20} />
              </div>
              <p className="mt-3 text-[1rem] font-semibold text-ink-900">Upload one old report as a PDF</p>
              <p className="mt-1 text-[0.875rem] text-ink-500">
                One old report is enough. Every report we make for you after that looks the same way. Nothing to set up:
                no settings, no questions to answer.
              </p>
              <p className="mt-3 text-[0.75rem] text-ink-400">
                One file · up to about 50 pages · pick a report typical of your work · we delete it once the template is saved
              </p>
            </div>

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
                  <p className="text-[0.75rem] text-ink-500">Six reads. Five are just measuring; the AI runs last, only to name what the measuring found.</p>
                </div>
              </div>

              <ol className="mt-5 space-y-1">
                {PASSES.map((p, i) => {
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
            {/* Layer 1 of the "how do I know what to pick" answer: do not make
                them choose. Every dropdown is already set. */}
            <header className="shrink-0 flex items-center justify-between gap-4 border-b border-canvas-border px-5 py-3">
              <div className="min-w-0">
                <h3 className="text-[0.875rem] font-semibold text-ink-900">What we found in {fileName}</h3>
                <p className="text-[0.75rem] text-ink-500 truncate">
                  We kept {sections.length} section{sections.length === 1 ? '' : 's'} we can fill from your audit results. Confirm, rename, reorder or untick them.
                  {(result.dropped.length > 0) && <> The other sections from your report are listed at the end.</>}
                  {shaky > 0 && <span className="text-mitigated-700 font-medium"> {shaky} we are unsure about, listed first.</span>}
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
                lockFill
                notIncluded={result.dropped}
                reportChrome={{
                  title: name || 'Untitled template',
                  brand: result.furniture?.fields.auditEntity ?? 'Your organisation',
                  headerText: result.furniture?.confidentiality || result.furniture?.header.join('  ·  '),
                  footerText: result.furniture?.footer.join('  ·  '),
                  accent: result.coverColor,
                }}
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
                <span className="text-[0.75rem] text-ink-400">
                  {sections.filter(s => s.name.trim() && !s.wrapper).length} sections kept · none of their words
                </span>
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
                {saved.dropped > 0 && <>{saved.dropped} section{saved.dropped === 1 ? '' : 's'} from your report are not in the template. Anything else goes in one report at a time through Add Observation. </>}
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
