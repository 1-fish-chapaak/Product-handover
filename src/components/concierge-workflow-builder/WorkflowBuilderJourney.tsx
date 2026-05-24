import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { type JourneyStep } from './Stepper';
import StepWritePrompt from './StepWritePrompt';
import AIAssistantPanel, { type ChatMessage, type ContextChip, type InlineClarifyProps, type PrimaryAction, type QuickReply, type ToleranceCardState } from './AIAssistantPanel';
import DataSourcePanel from './DataSourcePanel';
import UploadDataModal from './UploadDataModal';
import SaveWorkflowModal from './SaveWorkflowModal';
import ClarificationPanel from './ClarificationPanel';
import { SAMPLE_WORKFLOWS } from './sampleWorkflows';
import { generateWorkflow, getClarifyQuestions, runWorkflow, seedAlignments } from './mockApi';
import type {
  ClarifyAnswers,
  ClarifyQuestion,
  InputSpec,
  JourneyAlignments,
  JourneyFiles,
  JourneyMappings,
  RunResult,
  UploadedFile,
  WorkflowDraft,
} from './types';

interface Props {
  onBack: () => void;
  /**
   * If provided, the journey skips the Step 1 prompt page and lands the user
   * directly on the clarification screen for a workflow generated from this
   * prompt. Used by the chat empty-state Submit-with-toggle handoff.
   */
  initialPrompt?: string;
  /** Fired once the seed prompt has been consumed, so the parent can clear it. */
  onInitialPromptConsumed?: () => void;
}

const STEP_META: Record<JourneyStep, { title: string; action: string }> = {
  1: { title: 'Describe your workflow', action: 'Generate' },
  2: { title: 'Upload Data Files', action: '' },
  3: { title: 'Data Mapping', action: 'Confirm & Proceed' },
  4: { title: 'Review & Run', action: 'Validate workflow' },
};

let msgCounter = 0;
const nextMsgId = () => `m-${++msgCounter}`;

// Universal loader duration for in-chat processing indicators.
const LOADER_MS = 3000;

const VALIDATE_QUESTIONS: ClarifyQuestion[] = [
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

function tolerancePctFromAnswer(answer: string | undefined): number {
  if (!answer) return 5;
  if (answer.startsWith('Strict')) return 1;
  if (answer.startsWith('Moderate')) return 5;
  if (answer.startsWith('Relaxed')) return 10;
  return 5;
}

export default function WorkflowBuilderJourney({ onBack, initialPrompt, onInitialPromptConsumed }: Props) {
  const [step, setStep] = useState<JourneyStep>(1);
  const [prompt, setPrompt] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowDraft | null>(null);
  const [files, setFiles] = useState<JourneyFiles>({});
  const [mappings, setMappings] = useState<JourneyMappings>({});
  const [alignments, setAlignments] = useState<JourneyAlignments>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState<UploadedFile[]>([]);
  // Tracks the workflow id we've auto-opened the upload modal for, so we only
  // open it once per workflow when the user first reaches step 2.
  const uploadModalSeededFor = useRef<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [clarifyPhase, setClarifyPhase] = useState<'initial' | 'validate' | null>(null);
  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyQuestion[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<ClarifyAnswers>({});
  const [clarifyIndex, setClarifyIndex] = useState(0);
  const [focusedInput, setFocusedInput] = useState<InputSpec | null>(null);
  const [mapExpandedId, setMapExpandedId] = useState<string | null>(null);
  const [mapSeededFor, setMapSeededFor] = useState<string | null>(null);
  const [reviewExpandedSource, setReviewExpandedSource] = useState<string | null>(null);
  const [workflowSaved, setWorkflowSaved] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const DEFAULT_TOLERANCE: ToleranceCardState = {
    mode: 'percentage',
    percentage: 5,
    absolute: 500,
    enabled: true,
  };
  const [tolerance, setTolerance] = useState<ToleranceCardState>(DEFAULT_TOLERANCE);
  // Ref so completeValidatePhase (declared before executeRun) can call it.
  const executeRunRef = useRef<((t: ToleranceCardState) => void) | null>(null);

  // Tracks IDs of step-specific card messages so each is pushed once per workflow.
  const pushedStepCardRef = useRef<
    Partial<Record<'upload' | 'map' | 'review' | 'output' | 'view-preview', string>>
  >({});

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextMsgId(),
      role: 'assistant',
      text: 'Describe the audit workflow you want to build, or attach the data you want to work with.',
    },
  ]);

  const pushAssistant = useCallback((text: string) => {
    setMessages((m) => [...m, { id: nextMsgId(), role: 'assistant', text }]);
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((m) => [...m, { id: nextMsgId(), role: 'user', text }]);
  }, []);

  const pushEvent = useCallback(
    (text: string, tone: 'link' | 'info' | 'success' = 'link') => {
      setMessages((m) => [...m, { id: nextMsgId(), role: 'event', text, tone }]);
    },
    [],
  );

  const pushAssistantAfterDelay = useCallback(
    (text: string, delay = 500) => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        pushAssistant(text);
      }, delay);
    },
    [pushAssistant],
  );

  const applyWorkflow = useCallback(
    (
      draft: WorkflowDraft,
      howArrived: 'prompt' | 'template' | 'guide',
      userPrompt?: string,
    ) => {
      setWorkflow(draft);

      // Carry forward Step 1 chat-input attachments into the workflow's
      // input map. Each file fills the next empty required input; extras
      // pile up on the first input. Mirrors UploadDataModal.pickTargetInputId.
      const carried = draftAttachments;
      const seededFiles: JourneyFiles = {};
      if (carried.length > 0) {
        const reqInputs = draft.inputs.filter((i) => i.required);
        const fallback = draft.inputs[0]?.id ?? '';
        for (const f of carried) {
          let target = '';
          for (const inp of reqInputs) {
            if ((seededFiles[inp.id] ?? []).length === 0) {
              target = inp.id;
              break;
            }
          }
          if (!target) target = fallback;
          if (!target) continue;
          seededFiles[target] = [...(seededFiles[target] ?? []), f];
        }
      }
      setFiles(seededFiles);
      setDraftAttachments([]);
      setMappings({});
      setAlignments(seedAlignments(draft));
      setResult(null);
      setWorkflowSaved(false);
      setPreviewRevealed(false);
      pushedStepCardRef.current = {};
      uploadModalSeededFor.current = null;
      setUploadModalOpen(false);
      const questions = getClarifyQuestions(draft);
      setClarifyQuestions(questions);
      setClarifyAnswers({});
      setClarifyIndex(0);
      setClarifyPhase('initial');
      setClarifying(true);
      const intro =
        howArrived === 'guide'
          ? `I've pre-filled the prompt for **${draft.name}** and built the workflow. Before I begin, a few quick clarifications — pick what fits below.`
          : howArrived === 'template'
            ? `Starting from the **${draft.name}** template. Before I begin, a few quick clarifications — pick what fits below.`
            : `I've analyzed your prompt and built the **${draft.name}** workflow. Before I begin, a few quick clarifications — pick what fits below.`;
      const seed: ChatMessage[] = [];
      // Preserve the user's originating input as the first message in history.
      if (userPrompt && userPrompt.trim()) {
        seed.push({ id: nextMsgId(), role: 'user', text: userPrompt.trim() });
      } else if (howArrived === 'template') {
        seed.push({
          id: nextMsgId(),
          role: 'user',
          text: `Use the **${draft.name}** template.`,
        });
      }
      // Surface carried-forward attachments in the chat so they're visible
      // in conversation history, not just on the Step 2 upload card.
      if (carried.length > 0) {
        const names = carried.map((f) => f.name).join(', ');
        seed.push({
          id: nextMsgId(),
          role: 'user',
          text: `Attached ${carried.length} file${carried.length > 1 ? 's' : ''}: ${names}`,
        });
      }
      seed.push({ id: nextMsgId(), role: 'assistant', text: intro });
      setMessages(seed);
      setStep(2);
    },
    [draftAttachments],
  );

  const finishClarifying = useCallback(
    (assistantText: string) => {
      setClarifying(false);
      setClarifyPhase(null);
      pushAssistantAfterDelay(assistantText, 400);
    },
    [pushAssistantAfterDelay],
  );

  const completeValidatePhase = useCallback(
    (finalAnswers: ClarifyAnswers) => {
      const pct = tolerancePctFromAnswer(finalAnswers['tolerance-preset']);
      const nextTolerance = { ...tolerance, percentage: pct, enabled: true };
      setTolerance(nextTolerance);
      setClarifying(false);
      setClarifyPhase(null);
      pushAssistantAfterDelay(
        `Got it — running with **±${pct}%** amount tolerance.`,
        300,
      );
      // Kick off the run; executeRun handles the chat status updates.
      setTimeout(() => executeRunRef.current?.(nextTolerance), 500);
    },
    [tolerance, pushAssistantAfterDelay],
  );

  const handleClarifyAnswer = useCallback(
    (questionId: string, answer: string) => {
      pushUser(answer);
      const nextAnswers = { ...clarifyAnswers, [questionId]: answer };
      setClarifyAnswers(nextAnswers);
      const nextIdx = clarifyIndex + 1;
      if (nextIdx >= clarifyQuestions.length) {
        if (clarifyPhase === 'validate') {
          completeValidatePhase(nextAnswers);
        } else {
          finishClarifying(
            'Got it — locked those in. Drop the required data files into the upload window so I can map them.',
          );
        }
      } else {
        setClarifyIndex(nextIdx);
      }
    },
    [clarifyIndex, clarifyQuestions.length, clarifyAnswers, clarifyPhase, pushUser, finishClarifying, completeValidatePhase],
  );

  const handleClarifySkip = useCallback(
    (questionId: string) => {
      const nextAnswers = { ...clarifyAnswers, [questionId]: '' };
      setClarifyAnswers(nextAnswers);
      const nextIdx = clarifyIndex + 1;
      if (nextIdx >= clarifyQuestions.length) {
        if (clarifyPhase === 'validate') {
          completeValidatePhase(nextAnswers);
        } else {
          finishClarifying(
            "OK, proceeding with defaults where you skipped. Drop the required data files into the upload window so I can map them.",
          );
        }
      } else {
        setClarifyIndex(nextIdx);
      }
    },
    [clarifyIndex, clarifyQuestions.length, clarifyAnswers, clarifyPhase, finishClarifying, completeValidatePhase],
  );

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    const draft = generateWorkflow(prompt);
    applyWorkflow(draft, 'prompt', prompt);
  }, [prompt, applyWorkflow]);

  // When the journey is opened with a pre-seeded prompt (e.g. handed off from
  // the chat empty-state Submit), auto-generate and skip Step 1. The user lands
  // on the clarification screen so the journey feels like a continuation of
  // the chat composer rather than a separate intake.
  const seededPromptRef = useRef<string | null>(null);
  useEffect(() => {
    const seed = initialPrompt?.trim();
    if (!seed) return;
    if (seededPromptRef.current === seed) return;
    seededPromptRef.current = seed;
    setPrompt(seed);
    const draft = generateWorkflow(seed);
    applyWorkflow(draft, 'prompt', seed);
    onInitialPromptConsumed?.();
  }, [initialPrompt, applyWorkflow, onInitialPromptConsumed]);

  const handlePickTemplate = useCallback(
    (id: string) => {
      const template = SAMPLE_WORKFLOWS.find((w) => w.id === id);
      if (!template) return;
      setPrompt(template.logicPrompt);
      applyWorkflow(
        { ...template, id: `draft-${Date.now()}` },
        'template',
      );
    },
    [applyWorkflow],
  );

  const handleAttachDraft = useCallback(
    (payload: { files: UploadedFile[]; linkedSources: string[] }) => {
      const merged = [
        ...payload.files,
        ...payload.linkedSources.map<UploadedFile>((name) => ({
          name,
          size: 0,
          linkedSource: true,
        })),
      ];
      if (merged.length === 0) return;
      setDraftAttachments((prev) => [...prev, ...merged]);
    },
    [],
  );

  const executeRun = useCallback(
    async (_t: ToleranceCardState) => {
      if (!workflow) return;
      setRunning(true);
      try {
        const r = await runWorkflow(workflow, files, mappings);
        setResult(r);
        pushAssistantAfterDelay(
          `Finished. The **${r.title}** is ready — ${r.rows.length} rows, ${r.stats[0]?.value ?? ''} records scanned.`,
          300,
        );
      } finally {
        setRunning(false);
      }
    },
    [workflow, files, mappings, pushAssistantAfterDelay],
  );

  useEffect(() => {
    executeRunRef.current = executeRun;
  }, [executeRun]);

  const startValidateClarification = useCallback(() => {
    pushUser(STEP_META[4].action);
    setClarifyQuestions(VALIDATE_QUESTIONS);
    setClarifyAnswers({});
    setClarifyIndex(0);
    setClarifyPhase('validate');
    setClarifying(true);
    pushAssistantAfterDelay(
      "Before I kick off the run, I've spotted a couple of ambiguities — pick what fits below.",
      350,
    );
  }, [pushUser, pushAssistantAfterDelay]);

  const handleTopAction = useCallback(() => {
    if (step === 3) {
      pushUser(STEP_META[3].action);
      const loaderId = nextMsgId();
      setMessages((m) => [
        ...m,
        { id: loaderId, role: 'loader', text: 'Confirming mappings…' },
      ]);
      setTimeout(() => {
        setMessages((m) =>
          m
            .filter((msg) => msg.id !== loaderId)
            .concat({
              id: nextMsgId(),
              role: 'assistant',
              text: 'Mappings confirmed — opening review.',
            }),
        );
        setStep(4);
      }, LOADER_MS);
    } else if (step === 4) {
      startValidateClarification();
    }
  }, [step, pushUser, startValidateClarification]);

  const handleSaveWorkflow = useCallback(() => {
    if (!workflow || workflowSaved) return;
    setSaveModalOpen(true);
  }, [workflow, workflowSaved]);

  const handleSaveWorkflowConfirm = useCallback(
    (payload: {
      name: string;
      bpId: string;
      businessProcess: string;
      racmId: string;
      racm: string;
      description: string;
    }) => {
      if (!workflow) return;
      setWorkflow({ ...workflow, name: payload.name, description: payload.description });
      setWorkflowSaved(true);
      setSaveModalOpen(false);
      pushUser('Save Workflow');
      pushEvent(
        `**${payload.name}** saved to **${payload.businessProcess} · ${payload.racm}**.`,
        'success',
      );
    },
    [workflow, pushUser, pushEvent],
  );

  // All steps now host their CTAs inline (or auto-progress), so the top-bar
  // primary action is unused. Kept as undefined to preserve the AIAssistantPanel prop shape.
  const primaryAction: PrimaryAction | undefined = undefined;

  const inlineClarifyProps: InlineClarifyProps | undefined = useMemo(() => {
    if (!clarifying || clarifyPhase !== 'validate') return undefined;
    const question = clarifyQuestions[clarifyIndex];
    if (!question) return undefined;
    return {
      question,
      index: clarifyIndex,
      total: clarifyQuestions.length,
      stepLabel: `Step ${step} · Validate Workflow`,
      onAnswer: handleClarifyAnswer,
      onSkip: handleClarifySkip,
    };
  }, [clarifying, clarifyPhase, clarifyQuestions, clarifyIndex, step, handleClarifyAnswer, handleClarifySkip]);

  // Step 3 starts with all sections collapsed; the user expands via Edit.
  useEffect(() => {
    if (step !== 3 || !workflow) return;
    if (mapSeededFor === workflow.id) return;
    setMapExpandedId(null);
    setMapSeededFor(workflow.id);
  }, [step, workflow, mapSeededFor]);

  const mapFocusedInput = useMemo(() => {
    if (step !== 3 || !workflow || !mapExpandedId) return null;
    return workflow.inputs.find((i) => i.id === mapExpandedId) ?? null;
  }, [step, workflow, mapExpandedId]);

  const reviewFocusedStep = useMemo(() => {
    if (step !== 4 || !workflow || !reviewExpandedSource) return null;
    const stepId = reviewExpandedSource.split(':')[0];
    return workflow.steps.find((s) => s.id === stepId) ?? null;
  }, [step, workflow, reviewExpandedSource]);

  const rawQuickReplies: QuickReply[] | undefined = useMemo(() => {
    if (step === 2 && workflow && focusedInput) {
      const cols = focusedInput.columns ?? [];
      const colsText = cols.length
        ? cols.map((c) => `• ${c}`).join('\n')
        : 'No specific columns listed for this input.';
      return [
        {
          id: 'focus-cols',
          label: `What columns does ${focusedInput.name} need?`,
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `**${focusedInput.name}** expects these columns:\n${colsText}`,
              400,
            ),
        },
        {
          id: 'focus-link',
          label: `Link a data source for ${focusedInput.name}`,
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `In the card below, scroll to **Choose from existing data files** and pick a source — it will be linked to **${focusedInput.name}** automatically.`,
              400,
            ),
        },
        {
          id: 'focus-sample',
          label: `Show a sample ${focusedInput.type.toUpperCase()} format`,
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `A typical **${focusedInput.name}** file is a ${focusedInput.type.toUpperCase()} with ${cols.length || 'the'} columns in the first row, followed by data rows.${focusedInput.description ? `\n\n${focusedInput.description}` : ''}`,
              400,
            ),
        },
      ];
    }
    if (step === 3 && mapFocusedInput) {
      const total = mapFocusedInput.columns?.length || 0;
      return [
        {
          id: 'cols-recommend',
          label: 'Recommend columns',
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `For **${mapFocusedInput.name}**, I'd keep the join keys, amounts, and dates — ${total} column${total === 1 ? '' : 's'} available. Toggle any you don't need in the card below.`,
              400,
            ),
        },
        {
          id: 'cols-explain',
          label: 'Explain a column',
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `Pick any column in the **${mapFocusedInput.name}** card and I'll describe what it holds, its type, and how the workflow uses it.`,
              400,
            ),
        },
        {
          id: 'cols-preview',
          label: 'Preview sample rows',
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `Click **Preview** on the **${mapFocusedInput.name}** card to inspect the first few rows from the attached file.`,
              400,
            ),
        },
      ];
    }
    if (step === 4 && reviewFocusedStep) {
      return [
        {
          id: 'review-quality',
          label: 'Check data quality',
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `Running data-quality checks for **${reviewFocusedStep.name}** — null ratios, duplicates, and out-of-range values across all linked sources.`,
              400,
            ),
        },
        {
          id: 'review-preview',
          label: 'Preview schema',
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `**${reviewFocusedStep.name}** uses ${reviewFocusedStep.dataFiles.length} data source${reviewFocusedStep.dataFiles.length === 1 ? '' : 's'}. Expand a source in the review card below to see its column roles.`,
              400,
            ),
        },
        {
          id: 'review-explain',
          label: 'Explain extraction logic',
          emphasis: 'outline',
          onClick: () =>
            pushAssistantAfterDelay(
              `**${reviewFocusedStep.name}** (${reviewFocusedStep.type}) — ${reviewFocusedStep.description}`,
              400,
            ),
        },
      ];
    }
    return undefined;
  }, [
    step,
    workflow,
    focusedInput,
    mapFocusedInput,
    reviewFocusedStep,
    alignments,
    pushAssistantAfterDelay,
  ]);

  const contextChip: ContextChip | undefined = useMemo(() => {
    if (step === 2 && focusedInput) {
      const uploaded = (files[focusedInput.id] ?? []).length;
      const subtitleBits: string[] = [focusedInput.type.toUpperCase()];
      if (focusedInput.required) subtitleBits.push('Required');
      subtitleBits.push(uploaded > 0 ? `${uploaded} added` : 'No file yet');
      return {
        title: focusedInput.name,
        subtitle: subtitleBits.join(' · '),
        onDismiss: () => setFocusedInput(null),
      };
    }
    if (step === 3 && mapFocusedInput) {
      const total = mapFocusedInput.columns?.length || 0;
      return {
        title: mapFocusedInput.name,
        subtitle: `${total} column${total === 1 ? '' : 's'} available`,
        onDismiss: () => setMapExpandedId(null),
      };
    }
    if (step === 4 && reviewFocusedStep && workflow) {
      const idx = workflow.steps.findIndex((s) => s.id === reviewFocusedStep.id);
      return {
        title: reviewFocusedStep.name,
        subtitle: `Step ${idx + 1} · ${reviewFocusedStep.type}`,
        onDismiss: () => setReviewExpandedSource(null),
      };
    }
    return undefined;
  }, [step, focusedInput, mapFocusedInput, reviewFocusedStep, workflow, files, alignments]);

  const chatPlaceholder = useMemo(() => {
    if (step === 2 && focusedInput) return `Ask about ${focusedInput.name}…`;
    if (step === 3 && mapFocusedInput) return `Ask about Data Mapping…`;
    if (step === 4 && reviewFocusedStep) return `Ask about ${reviewFocusedStep.name}…`;
    return undefined;
  }, [step, focusedInput, mapFocusedInput, reviewFocusedStep]);

  // Wrap every quick reply so the user's selection is recorded in chat history
  // before the underlying action fires.
  const quickRepliesForStep: QuickReply[] | undefined = useMemo(() => {
    if (!rawQuickReplies) return undefined;
    return rawQuickReplies.map((r) => ({
      ...r,
      onClick: () => {
        pushUser(r.label);
        r.onClick();
      },
    }));
  }, [rawQuickReplies, pushUser]);


  const handleUserSend = useCallback(
    (text: string) => {
      pushUser(text);
      pushAssistantAfterDelay(
        `Noted — “${text.slice(0, 80)}${text.length > 80 ? '…' : ''}”. I've kept that in mind for the current step.`,
        600,
      );
    },
    [pushUser, pushAssistantAfterDelay],
  );

  // Push step-specific card messages as the journey advances.
  const pushStepCardOnce = useCallback(
    (kind: 'upload' | 'map' | 'review' | 'output' | 'view-preview') => {
      if (pushedStepCardRef.current[kind]) return;
      const id = nextMsgId();
      pushedStepCardRef.current[kind] = id;
      setMessages((m) => [
        ...m,
        { id, role: 'card', text: '', cardType: kind },
      ]);
    },
    [],
  );

  useEffect(() => {
    if (clarifying || !workflow) return;
    if (step === 2) pushStepCardOnce('upload');
    else if (step === 3) pushStepCardOnce('map');
    else if (step === 4) pushStepCardOnce('review');
  }, [step, clarifying, workflow, pushStepCardOnce]);

  // Auto-open the upload modal once per workflow when the user first reaches
  // step 2 (after initial clarifications). Re-opens are user-driven. If
  // attachments carried forward from Step 1 already satisfy every required
  // input, skip the auto-open — the user has nothing to add.
  useEffect(() => {
    if (!workflow || step !== 2 || clarifying) return;
    if (uploadModalSeededFor.current === workflow.id) return;
    uploadModalSeededFor.current = workflow.id;
    const allRequiredFilled = workflow.inputs
      .filter((i) => i.required)
      .every((i) => (files[i.id] ?? []).length > 0);
    if (allRequiredFilled) return;
    setUploadModalOpen(true);
  }, [workflow, step, clarifying, files]);

  // Auto-verify and advance to step 3 once all required files are added.
  // Replaces the manual "Verify with Ira" CTA — user closes the upload modal
  // and the journey continues without an extra click.
  const autoVerifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!workflow || step !== 2 || clarifying || uploadModalOpen) return;
    if (autoVerifiedRef.current === workflow.id) return;
    const allRequiredFilled = workflow.inputs
      .filter((i) => i.required)
      .every((i) => (files[i.id] ?? []).length > 0);
    if (!allRequiredFilled) return;
    autoVerifiedRef.current = workflow.id;
    const loaderId = nextMsgId();
    setMessages((m) => [
      ...m,
      { id: loaderId, role: 'loader', text: 'Verifying files…' },
    ]);
    const t = setTimeout(() => {
      setMessages((m) =>
        m
          .filter((msg) => msg.id !== loaderId)
          .concat({
            id: nextMsgId(),
            role: 'assistant',
            text: 'Files verified — moving to data mapping.',
          }),
      );
      setStep(3);
    }, LOADER_MS);
    return () => clearTimeout(t);
  }, [workflow, step, clarifying, uploadModalOpen, files]);

  // Once the run finishes, surface the "View Preview" CTA in chat. The full
  // output card is held back until the user opens the preview — this gives
  // them a moment to inspect the output schema in the right-side Configure
  // tab first.
  useEffect(() => {
    if (!result) return;
    if (previewRevealed) {
      pushStepCardOnce('output');
    } else {
      pushStepCardOnce('view-preview');
    }
  }, [result, previewRevealed, pushStepCardOnce]);

  const handleViewPreview = useCallback(() => {
    if (previewRevealed) return;
    setPreviewRevealed(true);
    pushUser('View Preview');
  }, [previewRevealed, pushUser]);

  const uploadCardProps = useMemo(() => {
    if (!workflow) return undefined;
    return {
      workflow,
      files,
      setFiles,
      // Upload UI now lives in the modal — chat card only shows the
      // "Data added" list (with a re-open trigger).
      view: 'list-only' as const,
      onOpenUploadModal: () => setUploadModalOpen(true),
      onLinkSource: (sourceName: string, inputName: string) => {
        pushEvent(`Linked **${sourceName}** → **${inputName}**`, 'link');
      },
      onFocusInput: (input: InputSpec) => {
        setFocusedInput((prev) => (prev?.id === input.id ? null : input));
      },
      focusedInputId: focusedInput?.id ?? null,
    };
  }, [workflow, files, focusedInput, pushEvent]);

  const uploadModalLinkSource = useCallback(
    (sourceName: string, inputName: string) => {
      pushEvent(`Linked **${sourceName}** → **${inputName}**`, 'link');
    },
    [pushEvent],
  );

  const mapCardProps = useMemo(() => {
    if (!workflow) return undefined;
    return {
      workflow,
      files,
      setFiles,
      alignments,
      expandedInputId: mapExpandedId,
      onToggleExpand: (id: string) =>
        setMapExpandedId((prev) => (prev === id ? null : id)),
      onConfirm: step === 3 ? handleTopAction : undefined,
      confirmDisabled: step !== 3,
    };
  }, [workflow, files, alignments, mapExpandedId, step, handleTopAction]);

  const reviewCardProps = useMemo(() => {
    if (!workflow) return undefined;
    const showValidate = step === 4 && !running && !result;
    return {
      workflow,
      setWorkflow,
      files,
      mappings,
      setMappings,
      running,
      result,
      expandedSource: reviewExpandedSource,
      setExpandedSource: setReviewExpandedSource,
      onValidate: showValidate ? handleTopAction : undefined,
      validateDisabled: !showValidate,
    };
  }, [workflow, files, mappings, running, result, reviewExpandedSource, step, handleTopAction]);

  const outputCardProps = useMemo(() => {
    if (!workflow) return undefined;
    return {
      workflow,
      result,
      running,
      onSave: result ? handleSaveWorkflow : undefined,
      saved: workflowSaved,
    };
  }, [workflow, result, running, handleSaveWorkflow, workflowSaved]);

  const viewPreviewCardProps = useMemo(() => {
    if (!result) return undefined;
    return {
      onClick: handleViewPreview,
      revealed: previewRevealed,
    };
  }, [result, previewRevealed, handleViewPreview]);

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Body */}
      {step === 1 ? (
        <motion.div
          key="step-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto"
          style={{
            background:
              'linear-gradient(180deg, #f8f5ff 0%, #fafafa 280px)',
          }}
        >
          <div className="px-6 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-600 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              Back to AI Concierge
            </button>
          </div>
          <StepWritePrompt
            prompt={prompt}
            setPrompt={setPrompt}
            onGenerate={handleGenerate}
            onPickTemplate={handlePickTemplate}
            onOpenAttach={() => setUploadModalOpen(true)}
            attachmentCount={draftAttachments.length}
          />
        </motion.div>
      ) : (
        /* Steps 2–4 — single narrow, centered chat. All step UI renders
           as cards inside the chat. Clarification still overlays full-width first. */
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence initial={false}>
            {(!clarifying || clarifyPhase === 'validate') && (
              <motion.div
                key="journey"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 bg-canvas"
              >
                {step >= 3 && workflow ? (
                  <div className="flex h-full w-full">
                    <div className="flex-1 min-w-0 h-full flex justify-center">
                      <div className="w-full h-full max-w-[920px]">
                        <AIAssistantPanel
                          messages={messages}
                          quickReplies={quickRepliesForStep}
                          contextChip={contextChip}
                          primaryAction={primaryAction}
                          placeholder={chatPlaceholder}
                          onSend={handleUserSend}
                          onOpenAttach={() => setUploadModalOpen(true)}
                          input={chatInput}
                          setInput={setChatInput}
                          onBack={onBack}
                          isTyping={isTyping}
                          uploadCard={uploadCardProps}
                          mapCard={mapCardProps}
                          reviewCard={reviewCardProps}
                          outputCard={outputCardProps}
                          viewPreviewCard={viewPreviewCardProps}
                          inlineClarify={inlineClarifyProps}
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 h-full">
                      <DataSourcePanel
                        workflow={workflow}
                        files={files}
                        setFiles={setFiles}
                        result={result}
                        running={running}
                        step={step}
                        previewRevealed={previewRevealed}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full w-full flex justify-center">
                    <div className="w-full h-full max-w-[920px]">
                      <AIAssistantPanel
                        messages={messages}
                        quickReplies={quickRepliesForStep}
                        contextChip={contextChip}
                        primaryAction={primaryAction}
                        placeholder={chatPlaceholder}
                        onSend={handleUserSend}
                        onOpenAttach={() => setUploadModalOpen(true)}
                        input={chatInput}
                        setInput={setChatInput}
                        onBack={onBack}
                        isTyping={isTyping}
                        uploadCard={uploadCardProps}
                        mapCard={mapCardProps}
                        reviewCard={reviewCardProps}
                        outputCard={outputCardProps}
                        viewPreviewCard={viewPreviewCardProps}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clarification — full-width view for initial phase only (before step 2 upload) */}
          <AnimatePresence>
            {clarifying && clarifyPhase === 'initial' && workflow && (
              <motion.div
                key="clarify"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-10 bg-canvas"
              >
                <ClarificationPanel
                  questions={clarifyQuestions}
                  index={clarifyIndex}
                  answers={clarifyAnswers}
                  onAnswer={handleClarifyAnswer}
                  onSkip={handleClarifySkip}
                  onBack={onBack}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <UploadDataModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        workflow={workflow}
        files={files}
        setFiles={setFiles}
        onLinkSource={uploadModalLinkSource}
        onAttachDraft={handleAttachDraft}
      />

      {workflow && (
        <SaveWorkflowModal
          open={saveModalOpen}
          onClose={() => setSaveModalOpen(false)}
          workflow={workflow}
          onConfirm={handleSaveWorkflowConfirm}
        />
      )}
    </div>
  );
}
