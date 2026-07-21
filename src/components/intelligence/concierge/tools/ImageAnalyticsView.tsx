import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  Image as ImageIcon,
  MessagesSquare,
  GitCompareArrows,
  ClipboardCheck,
  Clock,
  Play,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileSearch,
} from 'lucide-react';
import {
  ToolShell,
  UploadZone,
  ProgressPanel,
  ResultShell,
  JobHistory,
  useConciergeJob,
} from '../ConciergeKit';
import type { PickedFile, HistoryJob } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Image Analytics — three vision sub-modes (Chat · Compare · Audit) + History.
// Every mode rides the shared mock job engine (useConciergeJob); only the
// inputs, stages, and result renderer differ. Production swaps buildResult for
// the Gemini-Vision pipeline; the prototype carries metadata-only files.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Result types ────────────────────────────────────────────────────────────

type ChatResult = { answer: string };
type CompareResult = { answer: string };

interface AuditKpi {
  kpiNumber: number;
  kpiDescription: string;
  status: 'Compliant' | 'Non-Compliant';
  reasoning: string;
  recommendation: string;
}
interface AuditResult {
  summary: string;
  kpis: AuditKpi[];
}

type AnyResult = ChatResult | CompareResult | AuditResult;

// ─── Mode identity ───────────────────────────────────────────────────────────

type ModeId = 'chat' | 'compare' | 'audit';

interface ModeConfig {
  id: ModeId;
  label: string;
  icon: ElementType;
  // Primary image dropzone
  accept: string;
  uploadHint: string;
  // Optional second dropzone (audit guidelines)
  dual?: {
    label: string;
    accept: string;
    hint: string;
    primaryLabel: string; // label above the image zone in dual layout
  };
  // The textarea
  promptLabel: string;
  promptPlaceholder: string;
  promptRequired: boolean;
  minImages: number;
  ctaIdle: string; // verb on the run button
  // Engine
  stages: { id: string; label: string }[];
  messages: string[];
  totalMs: number;
  checking: string[];
  tips: string[];
  // Result
  resultTitle: string;
  buildResult: (input: { images: PickedFile[]; prompt: string }) => AnyResult;
}

// ─── Fixtures (realistic mock answers) ───────────────────────────────────────

const CHAT_ANSWER = `## What the images show

The set captures a **warehouse loading bay during an active shift**. Across the
frames I can identify three consistent subjects and a few notable details.

**Main subjects**
- Two operators in **high-visibility vests** — one staged at the dock edge, one
  steering a manual pallet jack.
- A **forklift** (counterbalance type) idling beside lane 4, forks lowered.
- Stacked **euro-pallets**, roughly chest height, shrink-wrapped and labelled.

**Setting & lighting**
Indoor, overhead sodium lighting with daylight spilling through the open shutter
on the right. The floor markings (yellow walkways, hatched keep-clear zones) are
crisp and recently painted.

**Text & symbols I can read**
- A wall sign: *"SPEED LIMIT 5 KM/H — PEDESTRIANS HAVE PRIORITY"*.
- Pallet labels carrying batch codes in the form \`LOT-2024-####\`.

**Things worth flagging**
1. The forklift operator is **not wearing a hard hat**, though the zone signage
   requires head protection.
2. One pallet overhangs the marked staging square by ~15 cm into the walkway.

> Ask a follow-up — e.g. "list only the safety violations" — to narrow the read.`;

const COMPARE_ANSWER = `## Comparison summary

I aligned the images on the shared dock-door reference and compared them
side-by-side. They depict the **same bay before and after a reorganisation**.

| Aspect | Image 1 (before) | Image 2 (after) |
| --- | --- | --- |
| Walkway clearance | Partially blocked by a stray pallet | Fully clear, repainted |
| PPE compliance | Operator without hard hat | Both operators in hard hats |
| Pallet stacking | Uneven, one leaning stack | Squared, within staging marks |
| Signage | Faded 5 km/h sign | New reflective sign installed |

**Key differences**
- **Housekeeping improved markedly** — the obstruction at the lane-4 entrance is
  gone and floor markings are sharper.
- **PPE adoption is now complete**: the head-protection gap visible in image 1
  has been closed.
- A **new fire-extinguisher station** appears on the right wall in image 2 that
  was absent before.

**What stayed the same**
The structural layout, dock-door positions, and the forklift model are
identical, confirming this is the same location at two points in time.

> Net read: image 2 represents a **safer, better-organised** state of the bay.`;

const AUDIT_SUMMARY =
  'Evaluated 6 site photos against the uploaded "Warehouse Safety & PPE Standard ' +
  'v3.2". Six KPIs were extracted from the guideline document and checked image ' +
  'by image. Four KPIs are Compliant and two are Non-Compliant — the gaps centre ' +
  'on head protection and walkway housekeeping. Closing both findings would bring ' +
  'the site to full compliance with the standard.';

const AUDIT_KPIS: AuditKpi[] = [
  {
    kpiNumber: 1,
    kpiDescription: 'High-visibility clothing worn by all floor personnel',
    status: 'Compliant',
    reasoning:
      'Every person visible on the warehouse floor across all frames is wearing a Class 2 hi-vis vest in good condition.',
    recommendation: 'No action required — maintain current issue and inspection routine.',
  },
  {
    kpiNumber: 2,
    kpiDescription: 'Head protection (hard hat) in designated zones',
    status: 'Non-Compliant',
    reasoning:
      'The forklift operator in frames 2 and 4 is not wearing a hard hat despite standing inside a posted head-protection zone.',
    recommendation:
      'Re-brief the shift on mandatory hard-hat zones and add a hat-check at the bay entrance before the next operating window.',
  },
  {
    kpiNumber: 3,
    kpiDescription: 'Pedestrian walkways kept clear and unobstructed',
    status: 'Non-Compliant',
    reasoning:
      'A shrink-wrapped pallet overhangs the marked staging square by roughly 15 cm into the yellow walkway in frame 1.',
    recommendation:
      'Reposition the pallet inside the staging bounds and add a daily housekeeping check to the supervisor walk-round.',
  },
  {
    kpiNumber: 4,
    kpiDescription: 'Floor markings legible and maintained',
    status: 'Compliant',
    reasoning:
      'Walkway lines, hatched keep-clear zones, and staging squares are crisp and recently repainted in all frames.',
    recommendation: 'No action required — schedule the next repaint per the standard interval.',
  },
  {
    kpiNumber: 5,
    kpiDescription: 'Mandatory safety signage present and visible',
    status: 'Compliant',
    reasoning:
      'The 5 km/h speed-limit and pedestrian-priority signage is mounted, reflective, and unobstructed.',
    recommendation: 'No action required.',
  },
  {
    kpiNumber: 6,
    kpiDescription: 'Fire-extinguisher stations accessible and unblocked',
    status: 'Compliant',
    reasoning:
      'The wall-mounted extinguisher station is in place with a clear approach and an in-date inspection tag.',
    recommendation: 'No action required — continue monthly tag checks.',
  },
];

// ─── Mode configs ────────────────────────────────────────────────────────────

const CHAT_CONFIG: ModeConfig = {
  id: 'chat',
  label: 'Image Chat',
  icon: MessagesSquare,
  accept: 'image/*',
  uploadHint: 'JPEG, PNG, WebP, HEIC — up to 50 MB each',
  promptLabel: 'Your question',
  promptPlaceholder:
    'E.g. What is the main subject in these images? Describe any safety hazards you can see…',
  promptRequired: true,
  minImages: 1,
  ctaIdle: 'Ask question',
  stages: [
    { id: 'upload', label: 'Upload' },
    { id: 'vision', label: 'Vision analysis' },
    { id: 'answer', label: 'Answer' },
  ],
  messages: [
    'Receiving your images…',
    'Reading subjects, text, and scene context with vision…',
    'Composing a detailed answer…',
  ],
  totalMs: 6000,
  checking: [
    'Objects, people, and their attributes',
    'Any text or symbols in frame',
    'Scene, lighting, and spatial layout',
    'Direct answers to your question',
  ],
  tips: [
    'Ask a focused question ("list only the hazards") to get a tighter answer.',
    'You can upload several images at once — the answer reasons across all of them.',
    'Vision can read signage and labels, so ask about printed text too.',
  ],
  resultTitle: 'Answer ready',
  buildResult: () => ({ answer: CHAT_ANSWER }),
};

const COMPARE_CONFIG: ModeConfig = {
  id: 'compare',
  label: 'Compare',
  icon: GitCompareArrows,
  accept: 'image/*',
  uploadHint: 'Add at least 2 images — JPEG, PNG, WebP',
  promptLabel: 'Comparison instructions (optional)',
  promptPlaceholder:
    'E.g. Highlight differences in lighting and composition, focus on safety equipment…',
  promptRequired: false,
  minImages: 2,
  ctaIdle: 'Compare images',
  stages: [
    { id: 'upload', label: 'Upload' },
    { id: 'align', label: 'Align' },
    { id: 'compare', label: 'Compare' },
    { id: 'report', label: 'Report' },
  ],
  messages: [
    'Receiving your images…',
    'Aligning images on shared reference points…',
    'Detecting differences and similarities…',
    'Writing the comparison report…',
  ],
  totalMs: 7000,
  checking: [
    'Added, removed, or moved elements',
    'Changes in colour, lighting, and layout',
    'What stayed consistent across frames',
    'A clear before / after read',
  ],
  tips: [
    'Two angles of the same scene compare best — the AI aligns them first.',
    'Add instructions to steer the focus, e.g. "only compare the PPE".',
    'Order matters: the first image is treated as the baseline.',
  ],
  resultTitle: 'Comparison ready',
  buildResult: () => ({ answer: COMPARE_ANSWER }),
};

const AUDIT_CONFIG: ModeConfig = {
  id: 'audit',
  label: 'Audit Report',
  icon: ClipboardCheck,
  accept: 'image/*',
  uploadHint: 'JPEG, PNG, WebP',
  dual: {
    label: 'Guidelines',
    accept: '.pdf,.doc,.docx,.txt',
    hint: 'PDF, DOC, DOCX, or TXT — your compliance standard',
    primaryLabel: 'Images to audit',
  },
  promptLabel: 'Special instructions (optional)',
  promptPlaceholder:
    'E.g. Focus strictly on safety-gear compliance. Report findings in bullet points…',
  promptRequired: false,
  minImages: 1,
  ctaIdle: 'Generate audit report',
  stages: [
    { id: 'upload', label: 'Upload' },
    { id: 'extract', label: 'Extract KPIs' },
    { id: 'evaluate', label: 'Evaluate' },
    { id: 'report', label: 'Report' },
  ],
  messages: [
    'Receiving guidelines and images…',
    'Extracting measurable KPIs from your guidelines…',
    'Evaluating each image against every KPI…',
    'Assembling the structured audit report…',
  ],
  totalMs: 8500,
  checking: [
    'KPIs lifted from your guideline document',
    'Per-KPI evidence across the images',
    'A Compliant / Non-Compliant call for each',
    'A recommendation for every gap',
  ],
  tips: [
    'Clear, numbered guidelines produce sharper KPIs.',
    'Upload several angles so each KPI has supporting evidence.',
    'Instructions can narrow the audit, e.g. "PPE only".',
  ],
  resultTitle: 'Audit complete',
  buildResult: () => ({ summary: AUDIT_SUMMARY, kpis: AUDIT_KPIS }),
};

const MODE_CONFIGS: Record<ModeId, ModeConfig> = {
  chat: CHAT_CONFIG,
  compare: COMPARE_CONFIG,
  audit: AUDIT_CONFIG,
};

// ─── Result renderers ────────────────────────────────────────────────────────

const MD_CLASS =
  'prose prose-sm max-w-none text-ink-700 ' +
  'prose-headings:font-semibold prose-headings:text-ink-900 prose-headings:mt-4 prose-headings:mb-2 ' +
  'prose-p:my-2 prose-p:leading-relaxed prose-strong:text-ink-900 prose-strong:font-semibold ' +
  'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:marker:text-brand-400 ' +
  'prose-a:text-brand-700 prose-blockquote:border-l-brand-300 prose-blockquote:text-ink-600 ' +
  'prose-blockquote:not-italic prose-blockquote:font-normal ' +
  'prose-table:text-[0.8125rem] prose-th:text-ink-800 prose-th:font-semibold ' +
  'prose-td:border-canvas-border prose-th:border-canvas-border ' +
  'prose-code:text-brand-700 prose-code:before:content-none prose-code:after:content-none';

function MarkdownResult({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-6">
      <div className={MD_CLASS}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AuditKpi['status'] }) {
  const compliant = status === 'Compliant';
  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold ${
        compliant ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700'
      }`}
    >
      {compliant ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {status}
    </span>
  );
}

function AuditResultView({ result }: { result: AuditResult }) {
  const passed = result.kpis.filter((k) => k.status === 'Compliant').length;
  const failed = result.kpis.length - passed;
  return (
    <div className="space-y-5">
      {/* KPI tally */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">KPIs checked</p>
          <p className="mt-1 text-[1.75rem] font-semibold tabular-nums text-ink-900 leading-none">
            {result.kpis.length}
          </p>
        </div>
        <div className="rounded-lg border border-compliant-50 bg-compliant-50/60 p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-compliant-700">Compliant</p>
          <p className="mt-1 text-[1.75rem] font-semibold tabular-nums text-compliant-700 leading-none">{passed}</p>
        </div>
        <div className="rounded-lg border border-risk-50 bg-risk-50/60 p-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-risk-700">Non-Compliant</p>
          <p className="mt-1 text-[1.75rem] font-semibold tabular-nums text-risk-700 leading-none">{failed}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-canvas-border bg-paper-50/70 p-5">
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Summary</p>
        <p className="text-[0.875rem] leading-relaxed text-ink-700">{result.summary}</p>
      </div>

      {/* KPI cards */}
      <div>
        <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
          KPI evaluations <span className="text-ink-600">({result.kpis.length})</span>
        </p>
        <div className="space-y-3">
          {result.kpis.map((kpi) => {
            const compliant = kpi.status === 'Compliant';
            return (
              <div
                key={kpi.kpiNumber}
                className="rounded-lg border border-canvas-border bg-canvas-elevated p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h5 className="text-[0.875rem] font-semibold text-ink-900">
                    <span className="text-ink-400">KPI {kpi.kpiNumber}.</span> {kpi.kpiDescription}
                  </h5>
                  <StatusPill status={kpi.status} />
                </div>
                <p className="mb-2 text-[0.8125rem] leading-relaxed text-ink-600">
                  <span className="font-semibold text-ink-800">Reasoning:</span> {kpi.reasoning || '—'}
                </p>
                {!compliant && (
                  <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3">
                    <p className="text-[0.8125rem] leading-relaxed text-ink-700">
                      <span className="font-semibold text-brand-700">Recommendation:</span>{' '}
                      {kpi.recommendation || '—'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderResult(mode: ModeId, result: AnyResult) {
  if (mode === 'audit') return <AuditResultView result={result as AuditResult} />;
  return <MarkdownResult text={(result as ChatResult).answer} />;
}

// ─── ImageMode — one self-contained flow (per active mode) ────────────────────

function ImageMode({
  config,
  onComplete,
  seededResult,
  seedKey,
}: {
  config: ModeConfig;
  onComplete: (mode: ModeId, fileNames: string[]) => void;
  seededResult: AnyResult | null;
  seedKey: number;
}) {
  const [images, setImages] = useState<PickedFile[]>([]);
  const [guidelines, setGuidelines] = useState<PickedFile[]>([]);
  const [prompt, setPrompt] = useState('');

  const job = useConciergeJob<{ images: PickedFile[]; prompt: string }, AnyResult>({
    stages: config.stages,
    messages: config.messages,
    totalMs: config.totalMs,
    buildResult: config.buildResult,
    toolName: `Image Analytics · ${config.label}`,
  });

  // Open-from-history: jump straight to a finished result.
  useEffect(() => {
    if (seededResult) job.complete(seededResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const startedRef = useRef(false);
  useEffect(() => {
    if (job.state.status === 'COMPLETED' && job.state.elapsedMs && startedRef.current) {
      startedRef.current = false;
      const names = [...guidelines.map((f) => f.name), ...images.map((f) => f.name)];
      onComplete(config.id, names);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.state.status]);

  const resetAll = () => {
    job.reset();
    setImages([]);
    setGuidelines([]);
    setPrompt('');
  };

  const fileLabel = [...guidelines.map((f) => f.name), ...images.map((f) => f.name)].join(', ');

  const enoughImages = images.length >= config.minImages;
  const enoughGuidelines = config.dual ? guidelines.length > 0 : true;
  const promptOk = config.promptRequired ? prompt.trim().length > 0 : true;
  const runnable = enoughImages && enoughGuidelines && promptOk;

  const run = () => {
    startedRef.current = true;
    job.start({ images, prompt: prompt.trim() });
  };

  // ── Processing ──
  if (job.state.status === 'UPLOADING' || job.state.status === 'PROCESSING') {
    return (
      <ProgressPanel
        state={job.state}
        stages={config.stages}
        fileName={fileLabel}
        onCancel={resetAll}
        checking={config.checking}
        tips={config.tips}
      />
    );
  }

  // ── Error ──
  if (job.state.status === 'ERROR') {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <AlertCircle size={28} className="mx-auto mb-3 text-risk-700" />
        <p className="text-[0.875rem] text-ink-700">{job.state.error ?? 'Something went wrong.'}</p>
        <button onClick={resetAll} className="mt-4 cursor-pointer text-[0.8125rem] font-semibold text-brand-700">
          Try again
        </button>
      </div>
    );
  }

  // ── Completed ──
  if (job.state.status === 'COMPLETED' && job.state.result) {
    return (
      <ResultShell title={config.resultTitle} elapsedMs={job.state.elapsedMs} onNew={resetAll}>
        {renderResult(config.id, job.state.result)}
      </ResultShell>
    );
  }

  // ── Idle (input) ──
  return (
    <div className="mx-auto max-w-2xl">
      {config.dual ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">
              1. {config.dual.label}
            </label>
            <UploadZone
              accept={config.dual.accept}
              multiple
              files={guidelines}
              onFiles={setGuidelines}
              hint={config.dual.hint}
            />
          </div>
          <div>
            <label className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">
              2. {config.dual.primaryLabel}
            </label>
            <UploadZone
              accept={config.accept}
              multiple
              files={images}
              onFiles={setImages}
              hint={config.uploadHint}
            />
          </div>
        </div>
      ) : (
        <UploadZone
          accept={config.accept}
          multiple
          files={images}
          onFiles={setImages}
          hint={config.uploadHint}
        />
      )}

      {/* Min-images nudge for compare */}
      {config.minImages > 1 && images.length > 0 && images.length < config.minImages && (
        <p className="mt-2 text-[0.75rem] font-medium text-mitigated-700">
          Add at least {config.minImages} images to compare.
        </p>
      )}

      {/* Prompt / instructions */}
      <div className="mt-4">
        <label className="mb-1.5 block text-[0.8125rem] font-semibold text-ink-700">
          {config.dual ? '3. ' : ''}
          {config.promptLabel}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={config.promptPlaceholder}
          rows={3}
          className="w-full resize-none rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-[0.875rem] text-ink-800 placeholder:text-ink-400 transition-colors focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <button
        disabled={!runnable}
        onClick={run}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[0.875rem] font-semibold transition-colors ${
          runnable
            ? 'cursor-pointer bg-brand-600 text-white hover:bg-brand-500'
            : 'cursor-not-allowed bg-brand-100 text-brand-300'
        }`}
      >
        <Play size={14} /> {config.ctaIdle}
        {config.id !== 'audit' && images.length > 0 && (
          <span className="opacity-80">
            ({images.length} image{images.length > 1 ? 's' : ''})
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Seeded history ──────────────────────────────────────────────────────────

const HISTORY_SEED: HistoryJob[] = [
  {
    id: 'seed-audit-1',
    files: ['safety-standard-v3.2.pdf', 'bay-frame-01.jpg', 'bay-frame-02.jpg', '+4 more'],
    status: 'COMPLETED',
    createdAt: '2h ago',
    meta: 'Audit · 4/6 compliant',
  },
  {
    id: 'seed-chat-1',
    files: ['loading-bay-wide.jpg', 'loading-bay-detail.jpg'],
    status: 'COMPLETED',
    createdAt: 'Yesterday',
    meta: 'Chat',
  },
  {
    id: 'seed-compare-1',
    files: ['before.png', 'after.png'],
    status: 'COMPLETED',
    createdAt: '2 days ago',
    meta: 'Compare',
  },
  {
    id: 'seed-compare-2',
    files: ['shelf-a.jpg', 'shelf-b.jpg', 'shelf-c.jpg'],
    status: 'IN_PROGRESS',
    createdAt: '3 days ago',
  },
];

// Map a history row back to the mode + canned result to re-open.
function seedToMode(id: string): { mode: ModeId; result: AnyResult } | null {
  if (id.startsWith('seed-audit')) return { mode: 'audit', result: { summary: AUDIT_SUMMARY, kpis: AUDIT_KPIS } };
  if (id.startsWith('seed-chat')) return { mode: 'chat', result: { answer: CHAT_ANSWER } };
  if (id.startsWith('seed-compare')) return { mode: 'compare', result: { answer: COMPARE_ANSWER } };
  return null;
}

// ─── Root view ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'chat', label: 'Image Chat', icon: MessagesSquare },
  { id: 'compare', label: 'Compare', icon: GitCompareArrows },
  { id: 'audit', label: 'Audit Report', icon: ClipboardCheck },
  { id: 'history', label: 'History', icon: Clock },
];

let _seq = 0;
const newJobId = () => `ia-${Date.now()}-${_seq++}`;

export default function ImageAnalyticsView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<string>('chat');
  const [history, setHistory] = useState<HistoryJob[]>(HISTORY_SEED);

  // When a history row is opened, we re-mount the target mode with a seed.
  const [seed, setSeed] = useState<{ mode: ModeId; result: AnyResult; key: number } | null>(null);

  // Per-mode remount key so switching modes / opening history resets state.
  const [modeKeys, setModeKeys] = useState<Record<ModeId, number>>({ chat: 0, compare: 0, audit: 0 });

  const activeMode = (tab === 'history' ? null : (tab as ModeId)) as ModeId | null;

  const logCompletion = (mode: ModeId, fileNames: string[]) => {
    const cfg = MODE_CONFIGS[mode];
    setHistory((prev) => [
      {
        id: newJobId(),
        files: fileNames.length ? fileNames : ['(images)'],
        status: 'COMPLETED',
        createdAt: 'Just now',
        meta: cfg.label.replace(' Report', ''),
      },
      ...prev,
    ]);
  };

  const openFromHistory = (id: string) => {
    const m = seedToMode(id);
    if (!m) return;
    setSeed({ mode: m.mode, result: m.result, key: Date.now() });
    setModeKeys((k) => ({ ...k, [m.mode]: k[m.mode] + 1 }));
    setTab(m.mode);
  };

  const onTab = (id: string) => {
    if (id !== tab) {
      // Fresh state whenever a mode tab is (re)selected, and drop any pending seed.
      if (id !== 'history') {
        setSeed(null);
        setModeKeys((k) => ({ ...k, [id as ModeId]: k[id as ModeId] + 1 }));
      }
      setTab(id);
    }
  };

  const subtitleByMode: Record<string, string> = useMemo(
    () => ({
      chat: 'Upload images and ask anything — vision reads objects, text, and scene context, then answers.',
      compare: 'Upload two or more images and get a clear before / after read of what changed.',
      audit: 'Upload a guideline document and site images — get a per-KPI compliance report.',
      history: 'Re-open a finished analysis or clear out old runs.',
    }),
    [],
  );

  return (
    <ToolShell
      title="Image Analytics"
      subtitle={subtitleByMode[tab]}
      icon={ImageIcon}
      onBack={onBack}
      tabs={TABS}
      activeTab={tab}
      onTab={onTab}
    >
      {activeMode ? (
        <motion.div
          key={`${activeMode}-${modeKeys[activeMode]}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <ImageMode
            config={MODE_CONFIGS[activeMode]}
            onComplete={logCompletion}
            seededResult={seed && seed.mode === activeMode ? seed.result : null}
            seedKey={seed && seed.mode === activeMode ? seed.key : modeKeys[activeMode]}
          />
        </motion.div>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-2 text-[0.8125rem] text-ink-500">
            <FileSearch size={15} className="text-ink-400" />
            <span>{history.length} analysis run{history.length === 1 ? '' : 's'}</span>
          </div>
          <JobHistory
            jobs={history}
            onOpen={openFromHistory}
            onDelete={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
          />
        </div>
      )}
    </ToolShell>
  );
}
