// Convert to a reference format — the New template journey, mirrored from
// staging (reports/convert). Four steps on one page:
//   1. Your audit       — a whole engagement or one report (the content)
//   2. What it will say — the parts, tick/untick, edit, reorder, add, remove
//   3. The format       — upload the reference report (its pages = template)
//   4. How it reads     — nine optional shaping questions
// Step 1 sits alone as a centred card; choosing a source opens 2–4.

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Plus, Trash2, Pencil, FileUp,
  WandSparkles, ChevronDown, X, FileText,
} from 'lucide-react';

type Source = 'engagement' | 'report';
type ChipTone = 'auto' | 'write' | 'data';

export type ConvertPart = {
  id: string;
  name: string;
  chip: string;
  tone: ChipTone;
  /** A line under the name, read off the audit (figures / observations). */
  note?: string;
  /** Pencil opens a text box for the words in this part. */
  editable: boolean;
  text: string;
  included: boolean;
};

export type ConvertRequest = {
  sourceKind: Source;
  sourceName: string;
  parts: ConvertPart[];
  file: File;
  answers: Record<number, string>;
};

const CHIP_TONE: Record<ChipTone, string> = {
  auto: 'bg-evidence-50 text-evidence-700',
  write: 'bg-mitigated-50 text-mitigated-700',
  data: 'bg-compliant-50 text-compliant-700',
};

const QUESTIONS: { q: string; options: { label: string; hint?: string }[] }[] = [
  { q: 'Should the report include a background section?', options: [
    { label: 'Full introduction', hint: 'scope, objectives, period, team' },
    { label: 'Scope and review period only' },
    { label: 'Brief background inline with the first observation' },
    { label: 'No background', hint: 'go straight to observations' },
  ]},
  { q: 'What level of detail is required per finding?', options: [
    { label: 'Summary only', hint: 'one line per observation in a table' },
    { label: 'Standard', hint: 'observation, risk, recommendation, management action' },
    { label: 'Full', hint: 'adds root cause, run output and evidence' },
    { label: 'Dual', hint: 'a summary table, then the full detail behind it' },
  ]},
  { q: 'Which risk rating framework applies?', options: [
    { label: 'High / Medium / Low' },
    { label: 'Issue type A / B / C' },
    { label: "The client's own scale" },
    { label: 'No formal rating' },
  ]},
  { q: 'Should root cause be classified per observation?', options: [
    { label: 'Structured tags (design / procedural / system)' },
    { label: 'Narrative root cause only' },
    { label: 'Root cause with an impact matrix' },
    { label: 'No root cause section' },
  ]},
  { q: 'Should financial impact be quantified?', options: [
    { label: 'A value scorecard of its own' },
    { label: 'Figures inline with each observation' },
    { label: 'Qualitative impact only' },
    { label: 'No financial impact' },
  ]},
  { q: 'Should management action plans be included?', options: [
    { label: 'Full', hint: 'response, owner and due date' },
    { label: 'Management comment only' },
    { label: 'Blank placeholders to be filled in later' },
    { label: 'None', hint: 'recommendations only' },
  ]},
  { q: 'Do you want a visual observation summary?', options: [
    { label: 'Full dashboard', hint: 'charts by rating and by process' },
    { label: 'Summary table only' },
    { label: 'Dashboard with financial impact highlighted' },
    { label: 'No summary', hint: 'straight to detailed observations' },
  ]},
  { q: 'How should exception and transaction data be handled?', options: [
    { label: 'Inline with each observation' },
    { label: 'A separate annexure at the end' },
    { label: 'Aggregated numbers only, data supplied separately' },
    { label: 'Not in the report' },
  ]},
  { q: 'How many observations should the report carry?', options: [
    { label: 'The ten most significant' },
    { label: 'The twenty-five most significant' },
    { label: 'High and medium rated only' },
    { label: 'Every observation recorded' },
  ]},
];

let partSeq = 0;
const part = (name: string, chip: string, tone: ChipTone, editable: boolean, note?: string): ConvertPart =>
  ({ id: `cp-${++partSeq}`, name, chip, tone, editable, note, text: '', included: true });

/** The parts a converted report carries, with what fills each one. Counts are
 *  read off the chosen audit; the rest the author writes. */
function defaultParts(queries: number): ConvertPart[] {
  const q = Math.max(1, queries);
  const exceptions = Math.max(1, Math.round(q * 0.8));
  return [
    part('Cover page', 'engagement name, period', 'auto', false),
    part('Disclaimer / report usage limitation', 'you write this', 'write', true),
    part('Table of contents', 'the parts below', 'auto', false),
    part('Introduction / Background', 'you write this', 'write', true),
    part('Audit Scope', 'you write this', 'write', true),
    part('Rating / Risk Classification Criteria', 'you write this', 'write', true),
    part('Executive summary', '4 figures', 'data', true, `This report aggregates ${q} audit ${q === 1 ? 'query' : 'queries'} with KPIs rolled up across the workflow.`),
    part('Summary of observations', `${q} rows`, 'data', true, `${exceptions} ${exceptions === 1 ? 'test' : 'tests'} raised exceptions; ${exceptions + 4} still open.`),
    part('Detailed observations', `${Math.max(1, q - 2)} findings`, 'data', false),
    part('Annexures', `${q} run outputs`, 'data', false),
    part('Follow-up / conclusion', 'you write this', 'write', true),
  ];
}

const STEP_BADGE = 'shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-[0.75rem] font-bold text-white';
const EYEBROW = 'text-[0.6875rem] font-semibold uppercase tracking-[0.08em]';
const ICON_BTN = 'inline-flex items-center justify-center w-6 h-6 rounded text-ink-400 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent';

export default function ConvertFormatView({
  engagements, reports, onBack, onConvert,
}: {
  engagements: { id: string; name: string; queries?: number }[];
  reports: { id: string; name: string; queries?: number }[];
  onBack: () => void;
  onConvert: (req: ConvertRequest) => void;
}) {
  const [source, setSource] = useState<Source>('engagement');
  const [pickId, setPickId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [parts, setParts] = useState<ConvertPart[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const list = source === 'engagement' ? engagements : reports;
  const picked = list.find(x => x.id === pickId);
  const includedCount = parts.filter(p => p.included).length;
  const answered = Object.keys(answers).length;

  const next = () => {
    if (!picked) return;
    setParts(defaultParts(picked.queries ?? (source === 'engagement' ? 6 : 3)));
    setConfirmed(true);
  };

  const move = (i: number, d: -1 | 1) => setParts(prev => {
    const j = i + d;
    if (j < 0 || j >= prev.length) return prev;
    const copy = [...prev];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const addAfter = (i: number) => setParts(prev => {
    const p = part('New part', 'you write this', 'write', true);
    setEditingId(p.id);
    return [...prev.slice(0, i + 1), p, ...prev.slice(i + 1)];
  });
  const update = (id: string, patch: Partial<ConvertPart>) =>
    setParts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const takeFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(pdf|pptx?)$/i.test(f.name)) return;
    setFile(f);
  };

  const canConvert = !!file && includedCount > 0;

  const header = useMemo(() => (
    <>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-500 hover:text-ink-800 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Reports
      </button>
      <h1 className="font-display text-[2rem] font-[420] tracking-tight text-ink-900 leading-[1.15] mt-4">
        Convert to a reference format
      </h1>
    </>
  ), [onBack]);

  // ── Step 1 alone: a centred card over the blurred page ──
  if (!confirmed) {
    return (
      <div className="h-full relative overflow-y-auto bg-white bg-mesh-gradient">
        <div className="absolute inset-0 bg-white/40 backdrop-blur-md" aria-hidden />
        <div className="relative min-h-full flex items-center justify-center px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[708px] bg-canvas-elevated border border-canvas-border rounded-2xl shadow-[0_24px_60px_-20px_rgba(60,20,120,0.18)] p-8"
          >
            {header}
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-400">
              Upload any audit report — a client’s, your firm’s, a Big Four deck — and get your audit back in a format like it. Their pages are the template; your audit results are the content.
            </p>

            <section className="mt-6 rounded-xl border border-canvas-border overflow-hidden">
              <div className="flex items-start gap-3 px-4 pt-4 pb-3 bg-gradient-to-b from-brand-50/70 to-transparent">
                <span className={`${STEP_BADGE} bg-brand-600 mt-0.5`}>1</span>
                <div>
                  <div className={`${EYEBROW} text-brand-600`}>Your audit</div>
                  <h2 className="text-[1.0625rem] font-semibold text-ink-900">What are we converting?</h2>
                  <p className="text-[0.8125rem] text-ink-400 mt-1">Its findings, figures and annexures are the content. Nothing is rewritten or invented.</p>
                </div>
              </div>
              <div className="px-4 pb-4 pt-3">
                <div className="flex gap-2">
                  {([['engagement', 'A whole engagement'], ['report', 'One report']] as const).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setSource(k); setPickId(''); }}
                      className={`h-9 px-3.5 rounded-lg text-[0.8125rem] font-semibold border transition-colors cursor-pointer ${
                        source === k ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border text-ink-800 hover:border-brand-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[0.75rem] text-ink-400 mt-2.5">
                  {source === 'engagement'
                    ? 'Every run in the engagement — all findings, the full exception register, every annexure.'
                    : 'Just the runs on one report.'}
                </p>
                <select
                  value={pickId}
                  onChange={e => setPickId(e.target.value)}
                  className="mt-2.5 w-full h-11 px-3.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.875rem] text-ink-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-600/20 cursor-pointer"
                >
                  <option value="">{source === 'engagement' ? 'Choose an engagement' : 'Choose a report'}</option>
                  {list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            </section>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                disabled={!picked}
                onClick={next}
                title="Read the audit and show what the report will say, part by part"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-[0.875rem] font-semibold transition-colors cursor-pointer bg-brand-600 text-white hover:bg-brand-500 disabled:bg-draft-50 disabled:text-ink-400 disabled:cursor-not-allowed"
              >
                <ArrowRight size={15} /> Next: review the content
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Steps 2–4 ──
  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-12 py-8">
        {header}
        <p className="mt-2 text-[0.9375rem] text-ink-400">Their pages are the template; your audit results are the content.</p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_388px] gap-6 items-start">
          {/* Step 2 — the parts */}
          <section className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
            <div className="flex items-start gap-3 px-4 pt-4 pb-3 bg-gradient-to-b from-brand-50/70 to-transparent">
              <span className={`${STEP_BADGE} bg-brand-600 mt-0.5`}>2</span>
              <div className="min-w-0 flex-1">
                <div className={`${EYEBROW} text-brand-600`}>What the report will say</div>
                <h2 className="text-[1.0625rem] font-semibold text-ink-900 truncate">{picked?.name}</h2>
                <p className="text-[0.8125rem] text-ink-400 mt-0.5">
                  {includedCount} of {parts.length} parts included · untick to leave one out, pencil to edit the words.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setConfirmed(false); setEditingId(null); }}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-800 hover:border-brand-200 cursor-pointer"
              >
                <ArrowLeft size={14} /> Change
              </button>
            </div>
            <div className="px-4 pb-4 space-y-2">
              <AnimatePresence initial={false}>
                {parts.map((p, i) => {
                  const editing = editingId === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`rounded-lg border px-3 py-2.5 bg-canvas-elevated ${editing ? 'border-brand-300' : 'border-canvas-border'} ${p.included ? '' : 'opacity-55'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={p.included}
                          onChange={e => update(p.id, { included: e.target.checked })}
                          aria-label={`Include ${p.name}`}
                          className="w-4 h-4 accent-brand-600 cursor-pointer"
                        />
                        <span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded bg-brand-50 text-brand-700 font-mono text-[0.6875rem] font-semibold">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {editing && p.name === 'New part' ? (
                          <input
                            autoFocus
                            value={p.name}
                            onChange={e => update(p.id, { name: e.target.value })}
                            onFocus={e => e.target.select()}
                            className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-brand-300 text-[0.875rem] font-semibold text-ink-900 outline-none"
                          />
                        ) : (
                          <span className="flex-1 min-w-0 truncate text-[0.875rem] font-semibold text-ink-900">{p.name}</span>
                        )}
                        <span className={`shrink-0 inline-flex items-center h-6 px-2 rounded-md text-[0.6875rem] font-semibold ${CHIP_TONE[p.tone]}`}>{p.chip}</span>
                        <div className="shrink-0 flex items-center gap-0.5">
                          {p.editable && (
                            <button type="button" className={ICON_BTN} aria-label={`Edit ${p.name}`} onClick={() => setEditingId(editing ? null : p.id)}>
                              <Pencil size={13} />
                            </button>
                          )}
                          <button type="button" className={ICON_BTN} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
                          <button type="button" className={ICON_BTN} aria-label="Move down" disabled={i === parts.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
                          <button type="button" className={ICON_BTN} aria-label="Add a part below" onClick={() => addAfter(i)}><Plus size={13} /></button>
                          <button type="button" className={`${ICON_BTN} hover:!text-risk-700`} aria-label={`Remove ${p.name}`} onClick={() => setParts(prev => prev.filter(x => x.id !== p.id))}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {p.note && <p className="mt-1 pl-[3.75rem] -ml-4 text-[0.75rem] text-ink-400">{p.note}</p>}
                      {editing && (
                        <textarea
                          autoFocus={p.name !== 'New part'}
                          value={p.text}
                          onChange={e => update(p.id, { text: e.target.value })}
                          placeholder={`Write the ${p.name.toLowerCase()} here...`}
                          rows={4}
                          className="mt-2 ml-14 w-[calc(100%-3.5rem)] rounded-md border border-canvas-border px-3 py-2 text-[0.8125rem] text-ink-800 outline-none focus:border-brand-400 resize-y"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>

          {/* Step 3 — the reference report */}
          <div className="space-y-3 lg:sticky lg:top-4">
            <section className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
              <div className="flex items-start gap-3 px-4 pt-4 pb-3 bg-gradient-to-b from-evidence-50 to-transparent">
                <span className={`${STEP_BADGE} bg-evidence-700 mt-0.5`}>3</span>
                <div>
                  <div className={`${EYEBROW} text-evidence-700`}>The format you want</div>
                  <h2 className="text-[1.0625rem] font-semibold text-ink-900">Upload the reference report</h2>
                </div>
              </div>
              <div className="px-4 pb-4">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.pptx,.ppt"
                  className="hidden"
                  onChange={e => { takeFile(e.target.files?.[0]); e.target.value = ''; }}
                />
                {file ? (
                  <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-4">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 text-brand-700"><FileText size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.8125rem] font-semibold text-ink-900 truncate">{file.name}</div>
                      <div className="text-[0.75rem] text-ink-400">{(file.size / 1024 / 1024).toFixed(1)} MB · its pages become the template</div>
                    </div>
                    <button type="button" className={ICON_BTN} aria-label="Remove file" onClick={() => setFile(null)}><X size={14} /></button>
                  </div>
                ) : (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files?.[0]); }}
                    className={`flex flex-col items-center text-center rounded-xl border-2 border-dashed px-6 py-7 transition-colors ${dragOver ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border'}`}
                  >
                    <FileUp size={26} className="text-brand-600" strokeWidth={1.75} />
                    <div className="mt-3 text-[0.9375rem] font-semibold text-ink-900">Drop the report whose format you want</div>
                    <p className="mt-1 text-[0.8125rem] text-ink-400 leading-snug">
                      PDF or PowerPoint. Its pages become the template — cover, dividers, observation pages, tables, footers.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="mt-4 h-9 px-4 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-900 hover:border-brand-200 cursor-pointer"
                    >
                      Choose a file
                    </button>
                  </div>
                )}
              </div>
            </section>
            <button
              type="button"
              disabled={!canConvert}
              onClick={() => file && onConvert({ sourceKind: source, sourceName: picked?.name ?? '', parts: parts.filter(p => p.included), file, answers })}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl text-[0.875rem] font-semibold transition-colors cursor-pointer bg-brand-600 text-white hover:bg-brand-500 disabled:bg-draft-50 disabled:text-ink-400 disabled:cursor-not-allowed"
            >
              <WandSparkles size={15} /> Convert to this format
            </button>
          </div>
        </div>

        {/* Step 4 — optional shaping questions */}
        <section className="mt-6 rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
          <button
            type="button"
            onClick={() => setShapeOpen(o => !o)}
            aria-expanded={shapeOpen}
            className="w-full flex items-start gap-3 px-4 py-4 text-left bg-gradient-to-b from-brand-50/70 to-transparent cursor-pointer"
          >
            <span className={`${STEP_BADGE} bg-brand-600 mt-2.5`}>4</span>
            <div className="flex-1">
              <div className={`${EYEBROW} text-brand-600`}>How the report should read</div>
              <h2 className="text-[1.0625rem] font-semibold text-ink-900">Shape it before we write it</h2>
              <p className="text-[0.8125rem] text-ink-400 mt-0.5">
                {answered > 0 ? `${answered} of ${QUESTIONS.length} answered` : 'Optional — the full report unless you say otherwise'}
              </p>
            </div>
            <ChevronDown size={16} className={`mt-4 text-ink-400 transition-transform ${shapeOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {shapeOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-canvas-border"
              >
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                  {QUESTIONS.map((item, qi) => {
                    const chosen = answers[qi];
                    const hint = item.options.find(o => o.label === chosen)?.hint;
                    return (
                      <div key={qi} className={`rounded-lg border p-3.5 transition-colors ${chosen ? 'border-brand-300 bg-brand-50/30' : 'border-canvas-border bg-paper-50/60'}`}>
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-[0.6875rem] font-semibold ${chosen ? 'bg-brand-600 text-white' : 'bg-draft-50 text-ink-400'}`}>{qi + 1}</span>
                          <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-snug">{item.q}</h3>
                        </div>
                        <div className="mt-2.5 pl-7 flex flex-wrap gap-1.5">
                          {item.options.map(o => (
                            <button
                              key={o.label}
                              type="button"
                              onClick={() => setAnswers(prev => {
                                const nextAnswers = { ...prev };
                                if (nextAnswers[qi] === o.label) delete nextAnswers[qi];
                                else nextAnswers[qi] = o.label;
                                return nextAnswers;
                              })}
                              className={`px-2.5 py-1 rounded-md border text-[0.75rem] font-medium transition-colors cursor-pointer ${
                                chosen === o.label ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas-elevated border-canvas-border text-ink-700 hover:border-brand-200'
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                        {hint && <p className="mt-2 pl-7 text-[0.75rem] text-ink-400">{hint}</p>}
                      </div>
                    );
                  })}
                </div>
                {answered > 0 && (
                  <div className="px-4 pb-4">
                    <button type="button" onClick={() => setAnswers({})} className="text-[0.75rem] text-ink-400 hover:text-ink-700 cursor-pointer">
                      Clear all answers
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
