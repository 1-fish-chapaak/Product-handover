import { useCallback, useMemo, useState } from 'react';
import { Sparkles, Plus, FileSpreadsheet } from 'lucide-react';
import { AuditifyHelloEffect } from '../shared/HelloEffect';
import { WORKFLOWS } from '../../data/mockData';
import { getActiveWorkflowEdit } from '../../data/workflowActions';
import { LIBRARY_WORKFLOWS } from '../workflow/WorkflowLibraryView';
import DataSourcePanel from '../concierge-workflow-builder/DataSourcePanel';
import { SAMPLE_WORKFLOWS } from '../concierge-workflow-builder/sampleWorkflows';
import type { JourneyFiles, RunResult, StepSpec } from '../concierge-workflow-builder/types';
import EditClarificationStage from './EditClarificationStage';
import EditChatPanel from './EditChatPanel';
import DataPickerModal, { type AttachmentSelection } from '../chat/DataPickerModal';
import { useAuditLog } from '../../context/AdminDataContext';
import type {
  EditChatMessage,
  EditClarificationStep,
  PlanStep,
  ValidateClarifyQuestion,
} from './types';

interface Props {
  workflowId: string;
  onBack: () => void;
}

const CLARIFICATION_STEPS: EditClarificationStep[] = [
  {
    id: 'date-range',
    question: 'First, what date range should I cover?',
    options: ['Last 30 days', 'Last 90 days', 'Full FY26', 'Custom range'],
    shortLabel: 'Date range',
  },
  {
    id: 'sources',
    question: 'Which data sources should I edit on this run?',
    options: [
      'All linked sources',
      'Only ERP modules',
      'Only file uploads',
      'Pick individually in the editor',
    ],
    shortLabel: 'Sources',
  },
  {
    id: 'thresholds',
    question: 'Adjust matching thresholds?',
    options: [
      'Keep current (5% tolerance)',
      'Tighten to 1%',
      'Loosen to 10%',
      'Switch to exact match only',
    ],
    shortLabel: 'Thresholds',
  },
  {
    id: 'output',
    question: 'Anything to change about the output?',
    options: [
      'Keep current columns + layout',
      'Add variance + status columns',
      'Switch to dashboard layout',
      'Re-route delivery (Slack / email)',
    ],
    shortLabel: 'Output',
  },
];

// Pre-run ambiguities surfaced when the user kicks off Validate Workflow —
// mirrors the AI Concierge builder's VALIDATE_QUESTIONS so the experience
// is consistent across journeys.
const VALIDATE_QUESTIONS: ValidateClarifyQuestion[] = [
  {
    id: 'matching-logic',
    title: 'What matching logic should I use?',
    options: [
      'Exact field matching',
      'Fuzzy match with tolerance',
      'AI-powered pattern detection',
      "Custom rules (I'll define)",
    ],
  },
  {
    id: 'tolerance-preset',
    title: 'What tolerance should I apply for amount comparisons?',
    options: ['Strict (±1%)', 'Moderate (±5%)', 'Relaxed (±10%)', 'Custom'],
  },
];

function tolerancePctFromAnswer(answer?: string): string {
  if (!answer) return '±5%';
  if (answer.startsWith('Strict')) return '±1%';
  if (answer.startsWith('Moderate')) return '±5%';
  if (answer.startsWith('Relaxed')) return '±10%';
  return answer;
}

let _msgCounter = 0;
const nextMsgId = () => `edit-${++_msgCounter}`;

function resolveWorkflowName(workflowId: string): string | null {
  const wf = WORKFLOWS.find((w) => w.id === workflowId);
  if (wf) return wf.name;
  const lib = LIBRARY_WORKFLOWS.find((w) => w.id === workflowId);
  if (lib) return lib.name;
  return null;
}

export default function WorkflowEditInChatJourney({ workflowId, onBack }: Props) {
  const logEvent = useAuditLog();
  // Insight → editor handoff (a boot-time fact, read once per tab). When an
  // insight sent the reader here, the change to make is already known — so the
  // journey skips the generic clarify stage and opens the editor grounded in
  // that insight: context banner up top, recap + suggested change in the chat.
  const insightCtx = getActiveWorkflowEdit();
  const workflowName = resolveWorkflowName(workflowId) ?? insightCtx?.workflowName ?? null;

  // Every entry — insight tile or the details page's "Edit in Chat" — lands on
  // the chat hello screen first (review call Aug 11): editing banner, connected
  // source, and a composer already holding "I want to change". Submitting the
  // intent drops straight into the editor with that message leading the thread.
  const [phase, setPhase] = useState<'landing' | 'clarify' | 'editor'>('landing');
  const [landingInput, setLandingInput] = useState('I want to change');
  // Editor sub-stage. mapping = step 3 (Input Config tab); review = step 4
  // (Plan tab) — mirrors the AI Concierge builder's Map Data → Review & Run.
  const [editorStage, setEditorStage] = useState<'mapping' | 'review'>('mapping');
  const [chatInput, setChatInput] = useState('');
  const [rightOpen, setRightOpen] = useState(true);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const [editsSaved, setEditsSaved] = useState(false);
  // Synthetic result populated after Validate clarifications complete. Drives
  // DataSourcePanel to auto-jump to Output Config (and Preview once revealed).
  const [editResult, setEditResult] = useState<RunResult | null>(null);
  const [validateClarify, setValidateClarify] = useState<{
    answers: Record<string, string>;
  } | null>(null);

  // Attach (+) wiring for the shared clarification card — mirrors chat's
  // DataPickerModal: 'source' picks land in attachedSources, 'upload' picks
  // become stub File objects in attachFiles.
  const [showDataPicker, setShowDataPicker] = useState(false);
  const [attachedSources, setAttachedSources] = useState<AttachmentSelection[]>([]);
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const handleDataPickerConfirm = useCallback((selections: AttachmentSelection[]) => {
    const sources = selections.filter((s) => s.kind === 'source');
    const uploads = selections.filter((s) => s.kind === 'upload');
    if (sources.length > 0) setAttachedSources((prev) => [...prev, ...sources]);
    if (uploads.length > 0) {
      const stubs = uploads.map((u) => new File([''], u.name, { type: 'application/octet-stream' }));
      setAttachFiles((prev) => [...prev, ...stubs]);
    }
    setShowDataPicker(false);
  }, []);
  const attachProps = {
    onAttach: () => setShowDataPicker(true),
    attachedSources,
    files: attachFiles,
    onRemoveSource: (i: number) => setAttachedSources((prev) => prev.filter((_, j) => j !== i)),
    onRemoveFile: (i: number) => setAttachFiles((prev) => prev.filter((_, j) => j !== i)),
  };

  // Hydrate the right-side workspace from the canonical Vendor Contract
  // Compliance sample so it ships with the same Folders / Files / Plan /
  // Output config the AI Concierge builder shows at the Map Data step.
  const draft = useMemo(() => SAMPLE_WORKFLOWS[0], []);
  const [editFiles, setEditFiles] = useState<JourneyFiles>(() => {
    // Pre-seed each input with a placeholder file so the panel shows the
    // mapped state instead of an empty drop-zone.
    const seeded: JourneyFiles = {};
    draft.inputs.forEach((i) => {
      seeded[i.id] = [
        { name: `${i.name.toLowerCase().replace(/\s+/g, '_')}_current.${i.type === 'pdf' ? 'pdf' : 'csv'}`, size: 84_000 },
      ];
    });
    return seeded;
  });
  // DataSourcePanel auto-selects the tab from `step`: 3 = Input Config,
  // 4 = Plan. Manual tab clicks still take precedence after the transition.
  const panelStep = editorStage === 'review' ? 4 : 3;

  const initialMessages = useMemo<EditChatMessage[]>(() => {
    const base = buildInitialMessages(workflowName ?? 'Workflow');
    if (!insightCtx) return base;
    // The insight leads the thread: what was found, the unconfirmed cause, and
    // the one change it argues for — already queued, nothing to restate.
    const recap: EditChatMessage = {
      id: nextMsgId(),
      role: 'ira',
      text: [
        `You've arrived from an insight on **${insightCtx.subjectLabel}**: “${insightCtx.takeaway}”`,
        insightCtx.cause ? `\nLikely cause — confirm before relying on it: ${insightCtx.cause}` : '',
        `\nI've queued the suggested change: **${insightCtx.suggestedChange}**`,
        `\nReview the mapping on the right, refine anything here in chat, then hit **Confirm & Proceed** — I'll validate before anything runs.`,
      ].join('\n'),
    };
    return [recap, ...base];
  }, [workflowName, insightCtx]);
  const [messages, setMessages] = useState<EditChatMessage[]>(initialMessages);

  const handleClarificationsComplete = useCallback(
    (a: Record<number, string>) => {
      // Synthesize a recap message at the top of the editor chat so the
      // editor is grounded in what the user just chose.
      const summary = CLARIFICATION_STEPS.map((s, i) => {
        const ans = a[i];
        if (!ans) return null;
        return `• **${s.shortLabel}:** ${ans}`;
      })
        .filter(Boolean)
        .join('\n');

      const recap: EditChatMessage = {
        id: nextMsgId(),
        role: 'ira',
        text:
          summary.length > 0
            ? `Locked in your edit scope:\n${summary}\n\nI've opened the workspace on the right. Adjust anything inline, then hit **Confirm & Proceed**.`
            : 'Skipped the quick check. Opening the editor with current settings. Adjust anything on the right and hit **Confirm & Proceed** when ready.',
      };
      setMessages([recap, ...initialMessages]);
      setPhase('editor');
      setEditorStage('mapping');
    },
    [initialMessages],
  );

  const handleSend = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), role: 'user', text },
      {
        id: nextMsgId(),
        role: 'ira',
        text: `Noted: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}". I've reflected that in the workspace on the right.`,
      },
    ]);
  }, []);

  const handleConfirmProceed = useCallback(() => {
    // Mirror the AI Concierge builder journey: Map Data → Review & Run.
    // Flip the editor stage to review (panel auto-jumps to the Plan tab via
    // panelStep=4) and post a workflow-plan card + Validate workflow CTA.
    setEditorStage('review');
    setRightOpen(true);

    const planSteps = draft.steps.map((s) => ({
      name: s.name,
      badge: badgeForStepType(s.type),
    }));

    setMessages((prev) => [
      ...prev,
      {
        id: nextMsgId(),
        role: 'ira',
        text: 'Mappings confirmed. Opening review.',
      },
      {
        id: nextMsgId(),
        role: 'ira',
        workflowPlan: {
          totalSteps: draft.steps.length,
          durationLabel: '~12s',
          steps: planSteps,
          outputLabel: draft.output.title,
          outputRows: '~5 rows',
        },
        showValidateWorkflow: true,
        showViewWorkspace: true,
      },
    ]);
  }, [draft]);

  const handleValidateWorkflow = useCallback(() => {
    // Surface pre-run clarifications inline before kicking off the validation
    // pass. Mirrors the AI Concierge builder's Validate-step ambiguity check.
    setMessages((prev) => [
      ...prev,
      {
        id: nextMsgId(),
        role: 'ira',
        text: "Before I kick off the run, I've spotted a couple of ambiguities. Pick what fits below.",
      },
    ]);
    setValidateClarify({ answers: {} });
  }, []);

  const finishValidateClarifications = useCallback(
    (answers: Record<string, string>) => {
      setValidateClarify(null);

      const tolerance = tolerancePctFromAnswer(answers['tolerance-preset']);

      // Push a recap + output-schema CTA + finished receipt, then drop a
      // synthetic result so DataSourcePanel auto-jumps to Output Config.
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId(),
          role: 'ira',
          text: `Got it. Running with **${tolerance}** amount tolerance.`,
        },
        {
          id: nextMsgId(),
          role: 'ira',
          text: 'Review the output schema on the right, then open the preview when ready.',
          showViewPreview: true,
        },
        {
          id: nextMsgId(),
          role: 'ira',
          text: `Finished. The **${draft.output.title}** is ready — 5 rows, 12375 records scanned.`,
        },
      ]);

      // Synthetic RunResult — its presence flips DataSourcePanel to Output
      // Config (and to Preview once previewRevealed=true).
      setEditResult({
        outputType: draft.output.type,
        title: draft.output.title,
        description: draft.output.description,
        stats: [
          { label: 'Records Scanned', value: '12,375', tone: 'primary' },
          { label: 'Flags', value: '8', tone: 'risk' },
          { label: 'Amount at Risk', value: '₹6.16L', tone: 'warning' },
          { label: 'Confidence', value: '72%', tone: 'ok' },
        ],
        columns: ['Invoice', 'Vendor', 'Amount', 'Issue', 'Severity'],
        rows: [
          { cells: ['INV-4521', 'Acme Corp', '₹45,200', 'Duplicate of INV-3102', 'Critical'], status: 'flagged' },
          { cells: ['INV-4533', 'Global Supplies', '₹1,28,750', 'No matching PO', 'High'], status: 'flagged' },
          { cells: ['INV-4558', 'TechVendor', '₹67,400', 'Out-of-scope line', 'Medium'], status: 'warning' },
          { cells: ['INV-4589', 'Pinnacle', '₹89,600', 'Off-policy GL code', 'Medium'], status: 'warning' },
          { cells: ['INV-4612', 'Atlas Mfg', '₹23,100', 'Clean', 'Low'], status: 'ok' },
        ],
      });
    },
    [draft],
  );

  // Validate-step clarification mapped onto the shared chat Q&A card. Answers
  // are keyed by question id; the card navigates internally (Back / Next /
  // Done) and submits all at once, then the run kicks off. ✕ cancels the set.
  const validateClarifyCard = validateClarify
    ? (() => {
        const answersArr: Record<number, string[]> = {};
        VALIDATE_QUESTIONS.forEach((q, i) => {
          const a = validateClarify.answers[q.id];
          if (a) answersArr[i] = [a];
        });
        return {
          data: {
            intro: '',
            questions: VALIDATE_QUESTIONS.map((q) => ({ question: q.title, options: q.options })),
            answers: answersArr,
            status: 'open' as const,
          },
          onSetAnswer: (qi: number, ans: string[]) => {
            setValidateClarify((prev) => {
              if (!prev) return prev;
              const id = VALIDATE_QUESTIONS[qi].id;
              const next = { ...prev.answers };
              if (ans[0]) next[id] = ans[0];
              else delete next[id];
              return { answers: next };
            });
          },
          onSubmit: () => {
            const a = validateClarify.answers;
            setValidateClarify(null);
            finishValidateClarifications(a);
          },
          onCancel: () => setValidateClarify(null),
          ...attachProps,
        };
      })()
    : null;

  const handleViewPreview = useCallback(() => {
    setPreviewRevealed(true);
    setMessages((prev) => [
      ...prev,
      { id: nextMsgId(), role: 'user', text: 'View Preview' },
      { id: nextMsgId(), role: 'ira', outputSummary: true },
    ]);
  }, []);

  const handleSaveEdits = useCallback(() => {
    setEditsSaved(true);
    logEvent({
      action: 'Update',
      description: workflowName ? `Saved workflow edits to "${workflowName}"` : 'Saved workflow edits',
      module: 'Workflows',
      entity: 'Workflow',
    });
  }, [logEvent, workflowName]);

  if (phase === 'landing') {
    const connectedFile = Object.values(editFiles)[0]?.[0]?.name ?? null;
    const submitIntent = () => {
      const text = landingInput.trim();
      if (text) {
        setMessages((prev) => [{ id: nextMsgId(), role: 'user', text }, ...prev]);
      }
      setPhase('editor');
    };
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-canvas">
        <div className="m-auto w-[52.5rem] max-w-full px-6 py-10 text-center">
          {/* The hello mark + heading — the same welcome the chat hero gives,
              so editing reads as a conversation, not a form. */}
          <AuditifyHelloEffect className="text-primary h-14 mx-auto mb-5" speed={0.7} />
          <h1 className="text-[2.125rem] font-medium tracking-[-0.02em] mb-2 text-ink-900/85">
            Audit smarter. <span className="font-bold">Not harder.</span>
          </h1>
          <p className="text-[0.9375rem] text-ink-500">
            Let <span className="font-semibold text-ink-700">Ira</span> handle your grunt tasks. Just ask.
          </p>

          {/* What this tab IS — the version contract up front, before a word
              is typed: edits never overwrite, they save as the next version. */}
          <div className="mx-auto mt-8 max-w-[42rem] rounded-r-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5 text-left">
            <p className="text-[0.8125rem] font-bold text-amber-900">
              📝 Editing {workflowName ?? 'this workflow'} — current latest is v1
            </p>
            <p className="mt-0.5 text-[0.75rem] font-medium text-amber-700">
              Make changes and click “Save as new version” → creates v2
            </p>
          </div>

          {/* The source already wired to this workflow — carried in, not re-picked. */}
          {connectedFile && (
            <div className="mt-3 flex items-center justify-center gap-2 text-[0.8125rem]">
              <span className="font-semibold text-ink-700">Connected:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/50 px-2.5 py-1 text-[0.75rem] font-medium text-brand-700">
                <FileSpreadsheet size={12} aria-hidden="true" />
                {connectedFile}
                <span className="text-[0.625rem] font-bold uppercase text-ink-400">· {connectedFile.split('.').pop()}</span>
              </span>
            </div>
          )}

          {/* Composer — pre-filled with the intent so the reader only has to
              finish the sentence. Enter submits; the message leads the thread. */}
          <div className="ai-border mx-auto mt-4 max-w-[42rem] text-left">
            <textarea
              value={landingInput}
              onChange={(e) => setLandingInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitIntent();
                }
              }}
              rows={3}
              aria-label="Describe the change you want to make"
              className="w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3.5 text-[0.875rem] text-ink-900 outline-none placeholder:text-ink-400"
              autoFocus
            />
            <div className="flex items-center gap-2 px-3 pb-3">
              <button
                type="button"
                onClick={() => setShowDataPicker(true)}
                title="Attach a data source"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-canvas hover:text-ink-700 transition-colors cursor-pointer"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={submitIntent}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[0.8125rem] font-semibold text-white hover:bg-brand-500 active:bg-brand-800 transition-colors cursor-pointer"
              >
                <Sparkles size={13} aria-hidden="true" /> Submit
              </button>
            </div>
          </div>
        </div>
        <DataPickerModal
          open={showDataPicker}
          onClose={() => setShowDataPicker(false)}
          onConfirm={handleDataPickerConfirm}
        />
      </div>
    );
  }

  if (phase === 'clarify') {
    return (
      <div className="flex flex-col h-full bg-canvas">
        <EditClarificationStage
          steps={CLARIFICATION_STEPS}
          onBack={onBack}
          onComplete={handleClarificationsComplete}
          {...attachProps}
        />
        <DataPickerModal
          open={showDataPicker}
          onClose={() => setShowDataPicker(false)}
          onConfirm={handleDataPickerConfirm}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Insight provenance — the one strip that says why this tab exists and
          reassures that the report the reader came from is still where it was. */}
      {insightCtx && (
        <div className="shrink-0 flex items-center gap-2 border-b border-brand-100 bg-brand-50/60 px-4 py-2">
          <Sparkles size={12} className="shrink-0 text-brand-600" aria-hidden="true" />
          <span className="shrink-0 text-[0.625rem] font-bold uppercase tracking-wider text-brand-700">Editing from insight</span>
          <span className="min-w-0 truncate text-[0.75rem] font-medium text-ink-700" title={insightCtx.takeaway}>
            {insightCtx.takeaway}
          </span>
          <span className="ml-auto hidden md:inline shrink-0 text-[0.6875rem] text-ink-400">
            Your insight report stays open in the original tab.
          </span>
        </div>
      )}
      {/* Body — 50% chat / 50% workspace (mirrors the AI Concierge builder journey from Map Data step onward) */}
      <div
        className="flex-1 min-h-0 grid transition-[grid-template-columns] duration-300"
        style={{
          gridTemplateColumns: rightOpen ? '50% 50%' : '1fr 48px',
        }}
      >
        <EditChatPanel
          messages={messages}
          input={chatInput}
          setInput={setChatInput}
          onSend={handleSend}
          onBack={onBack}
          onConfirmProceed={handleConfirmProceed}
          onViewWorkspace={() => setRightOpen(true)}
          onValidateWorkflow={handleValidateWorkflow}
          onViewPreview={handleViewPreview}
          draft={draft}
          editResult={editResult}
          onSaveEdits={handleSaveEdits}
          editsSaved={editsSaved}
          clarify={validateClarifyCard}
        />

        {/* Use the AI Concierge builder's own DataSourcePanel so the
            Input Config / Plan / Output Config / Preview tabs are visually
            and structurally identical to the builder journey. */}
        <DataSourcePanel
          workflow={draft}
          files={editFiles}
          setFiles={setEditFiles}
          result={editResult}
          step={panelStep}
          previewRevealed={previewRevealed}
        />
      </div>
      <DataPickerModal
        open={showDataPicker}
        onClose={() => setShowDataPicker(false)}
        onConfirm={handleDataPickerConfirm}
      />
    </div>
  );
}

function buildInitialMessages(workflowName: string): EditChatMessage[] {
  return [
    {
      id: nextMsgId(),
      role: 'ira',
      text: `Re-opened **${workflowName}** for editing. Below is the current configuration — change anything in the workspace on the right, then hit **Confirm & Proceed** to save.`,
    },
    {
      id: nextMsgId(),
      role: 'ira',
      text: 'Drop the required data files into the upload window so I can map them.',
      linkedSources: [
        { source: 'SAP ERP: AP Module', target: 'Invoices' },
        { source: 'GL Transaction History', target: 'Purchase Orders' },
        { source: 'Vendor Master Data', target: 'Contracts Register' },
      ],
      showViewWorkspace: true,
    },
    {
      id: nextMsgId(),
      role: 'ira',
      text: 'Files verified. Moving to data mapping.',
    },
    {
      id: nextMsgId(),
      role: 'ira',
      mappings: [
        {
          name: 'Invoices',
          from: 'SAP ERP: AP Module',
          cols: ['Invoice No', 'Vendor', 'PO Ref', 'Amount', 'Line Item', 'Invoice Date'],
          ofTotal: 6,
        },
        {
          name: 'Purchase Orders',
          from: 'GL Transaction History',
          cols: ['PO No', 'Vendor', 'Contract Ref', 'Amount', 'Line Item', 'Status'],
          ofTotal: 6,
        },
        {
          name: 'Contracts Register',
          from: 'Vendor Master Data',
          cols: ['Contract Ref', 'Vendor', 'Scope', 'Cap', 'End Date'],
          ofTotal: 5,
        },
      ],
      showConfirmProceed: true,
      showViewWorkspace: true,
    },
  ];
}

function badgeForStepType(type: StepSpec['type']): PlanStep['badge'] {
  switch (type) {
    case 'extract':
      return 'INGESTION';
    case 'compare':
      return 'COMPARISON';
    case 'validate':
      return 'VALIDATION';
    case 'flag':
      return 'FLAGGING';
    case 'analyze':
      return 'ANALYSIS';
    case 'summarize':
      return 'SUMMARY';
    case 'calculate':
      return 'CALCULATION';
    default:
      return 'INGESTION';
  }
}
