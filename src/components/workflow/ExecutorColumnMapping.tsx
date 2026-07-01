import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  X,
  File as FileIcon,
  Eye,
  ArrowLeftRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
  Plus,
  Check,
} from 'lucide-react';
import type {
  WorkflowDraft,
  JourneyFiles,
  JourneyAlignments,
  ColumnAlignment,
  ColumnDType,
} from '../concierge-workflow-builder/types';
import SlotFunctionTag from './SlotFunctionTag';

interface Props {
  workflow: WorkflowDraft;
  files: JourneyFiles;
  setFiles: (f: JourneyFiles) => void;
  alignments: JourneyAlignments;
  setAlignments: (a: JourneyAlignments) => void;
}

function snakeCase(s: string): string {
  return s
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function tierForConfidence(value: number) {
  if (value >= 90) {
    return {
      text: 'text-compliant-700',
      pillBg: 'bg-compliant-50',
      pillBorder: 'border-compliant/30',
      bar: 'bg-compliant',
    };
  }
  if (value >= 70) {
    return {
      text: 'text-mitigated-700',
      pillBg: 'bg-mitigated-50',
      pillBorder: 'border-mitigated/30',
      bar: 'bg-mitigated',
    };
  }
  return {
    text: 'text-risk-700',
    pillBg: 'bg-risk-50',
    pillBorder: 'border-risk/30',
    bar: 'bg-risk',
  };
}

const METRIC_ROWS: {
  key: keyof ColumnAlignment['breakdown'];
  label: string;
  weight: number;
  description: string;
  bar: string;
}[] = [
  {
    key: 'nameSimilarity',
    label: 'Name Similarity',
    weight: 35,
    description: 'Fuzzy string matching & token comparison',
    bar: 'bg-risk',
  },
  {
    key: 'typeCompatibility',
    label: 'Type Compatibility',
    weight: 25,
    description: 'Data type inference & format alignment',
    bar: 'bg-brand-600',
  },
  {
    key: 'statisticalProfile',
    label: 'Statistical Profile',
    weight: 20,
    description: 'Value distribution, cardinality & null ratio',
    bar: 'bg-high',
  },
  {
    key: 'semanticSimilarity',
    label: 'Semantic Similarity',
    weight: 20,
    description: 'Embedding-based meaning comparison',
    bar: 'bg-high',
  },
];

interface JustificationAnchor {
  rect: DOMRect;
  alignmentId: string;
}

// Position a portaled menu against an anchor button, opening UPWARD when there
// isn't enough room below (so bottom-of-list dropdowns never clip against the
// scroll container). Repositions on scroll/resize while open.
function useAnchoredPosition(
  anchorEl: HTMLElement | null,
  menuRef: { current: HTMLElement | null },
  opts: { align?: 'left' | 'right'; minWidth?: number; matchWidth?: boolean } = {},
) {
  const { align = 'left', minWidth = 0, matchWidth = false } = opts;
  const [pos, setPos] = useState<{ top: number; left: number; width?: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorEl) return;
    const compute = () => {
      const menu = menuRef.current;
      const a = anchorEl.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const menuH = menu?.offsetHeight ?? 0;
      const menuW = matchWidth ? Math.max(a.width, minWidth) : menu?.offsetWidth ?? minWidth;
      const vH = window.innerHeight;
      const vW = window.innerWidth;
      const spaceBelow = vH - a.bottom;
      const spaceAbove = a.top;
      const openUp = spaceBelow < menuH + margin + gap && spaceAbove > spaceBelow;
      const top = openUp ? Math.max(margin, a.top - menuH - gap) : a.bottom + gap;
      let left = align === 'right' ? a.right - menuW : a.left;
      if (left + menuW > vW - margin) left = vW - menuW - margin;
      if (left < margin) left = margin;
      setPos({ top, left, width: matchWidth ? menuW : undefined });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [anchorEl, menuRef, align, minWidth, matchWidth]);

  return pos;
}

export default function ExecutorColumnMapping({
  workflow,
  files,
  setFiles,
  alignments,
  setAlignments,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(workflow.inputs[0]?.id ?? null);
  const [autoExpanded, setAutoExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(workflow.inputs.map((i) => [i.id, false])),
  );
  const [justification, setJustification] = useState<JustificationAnchor | null>(null);
  const [targetPickerFor, setTargetPickerFor] = useState<string | null>(null);
  const [userMapped, setUserMapped] = useState<Set<string>>(() => new Set());
  const [previewInput, setPreviewInput] = useState<{ name: string; files: { name: string }[] } | null>(null);
  const [selectFileOpen, setSelectFileOpen] = useState<string | null>(null);
  const [selectFileSearch, setSelectFileSearch] = useState('');

  const allUploadedFiles = useMemo(() => {
    const all: { name: string; inputId: string }[] = [];
    Object.entries(files).forEach(([inputId, fileList]) => {
      fileList.forEach((f) => all.push({ name: f.name, inputId }));
    });
    return all;
  }, [files]);

  const updateAlignmentTarget = (inputId: string, alignmentId: string, targetName: string) => {
    const current = alignments[inputId] ?? [];
    const next = current.map((a) =>
      a.id === alignmentId
        ? {
            ...a,
            target: { name: targetName, dtype: a.target?.dtype ?? a.source.dtype },
            reason: null,
          }
        : a,
    );
    setAlignments({ ...alignments, [inputId]: next });
    setUserMapped((prev) => {
      const next = new Set(prev);
      next.add(alignmentId);
      return next;
    });
  };

  const removeFile = (inputId: string, name: string) => {
    setFiles({ ...files, [inputId]: (files[inputId] ?? []).filter((f) => f.name !== name) });
  };

  const targetOptions = (inputId: string) => {
    const input = workflow.inputs.find((i) => i.id === inputId);
    const cols = input?.columns ?? input?.columnSpecs?.map((c) => c.name) ?? [];
    const set = new Set<string>();
    cols.forEach((c) => {
      set.add(c);
      set.add(snakeCase(c));
    });
    return Array.from(set);
  };

  let activeAlignment: { alignment: ColumnAlignment; inputId: string } | null = null;
  if (justification) {
    for (const inputId of Object.keys(alignments)) {
      const found = alignments[inputId].find((a) => a.id === justification.alignmentId);
      if (found) {
        activeAlignment = { alignment: found, inputId };
        break;
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3"
    >
      {workflow.inputs.map((input) => {
        const inputAlignments = alignments[input.id] ?? [];
        // Three confidence slabs: ≥90 auto-mapped, 70–89 review (auto-mapped but
        // worth a glance), <70 needs attention (manual mapping).
        const auto = inputAlignments.filter((a) => a.confidence >= 90);
        const review = inputAlignments.filter((a) => a.confidence >= 70 && a.confidence < 90);
        const attention = inputAlignments.filter((a) => a.confidence < 70);
        const mapped = inputAlignments.filter((a) => a.confidence >= 70).length;
        const total = inputAlignments.length;
        const matchPct = total
          ? Math.round(inputAlignments.reduce((sum, a) => sum + a.confidence, 0) / total)
          : 0;
        const matchTier = tierForConfidence(matchPct);
        const isOpen = expanded === input.id;
        const uploaded = files[input.id] ?? [];
        // Auto-mapped group is collapsed by default — high-confidence rows need
        // no review, so they stay tucked away until the user expands them.
        const autoOpen = autoExpanded[input.id] ?? false;
        const avgAuto = auto.length
          ? Math.round(auto.reduce((sum, a) => sum + a.confidence, 0) / auto.length)
          : 0;

        return (
          <section
            key={input.id}
            className={[
              'rounded-2xl border bg-canvas-elevated overflow-visible transition-colors',
              isOpen ? 'border-brand-400/60 ring-1 ring-brand-400/20' : 'border-canvas-border',
            ].join(' ')}
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : input.id)}
              className="w-full flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-brand-50/30 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-ink-900">{input.name}</span>
                  <SlotFunctionTag input={input} />
                </div>
                <p className="text-[11.5px] text-ink-400 mt-0.5 line-clamp-1">{input.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[18px] font-bold text-ink-800 tabular-nums leading-tight">
                    {mapped}/{total}
                  </span>
                  <span className="text-[10px] text-ink-400 font-semibold leading-tight">
                    column
                    <br />
                    mapped
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {/* Mapped sources */}
            <div className="px-5 pb-4">
              <div className="border-t border-canvas-border/40 mb-3" />

              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400 shrink-0">
                    Mapped Sources
                  </span>
                  {uploaded.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewInput({ name: input.name, files: uploaded })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated hover:border-ink-300 hover:text-ink-800 px-2.5 py-0.5 text-[11px] font-semibold text-ink-600 transition-colors cursor-pointer shrink-0"
                    >
                      <Eye size={11} />
                      Preview
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <SelectFileDropdown
                    isOpen={selectFileOpen === input.id}
                    onToggle={() => {
                      setSelectFileOpen(selectFileOpen === input.id ? null : input.id);
                      setSelectFileSearch('');
                    }}
                    onClose={() => setSelectFileOpen(null)}
                    search={selectFileSearch}
                    setSearch={setSelectFileSearch}
                    allFiles={allUploadedFiles}
                    currentFiles={uploaded}
                    onToggleFile={(fileName, isCurrentlySelected) => {
                      const current = files[input.id] ?? [];
                      if (isCurrentlySelected) {
                        setFiles({ ...files, [input.id]: current.filter((f) => f.name !== fileName) });
                      } else {
                        const source = allUploadedFiles.find((f) => f.name === fileName);
                        if (source) {
                          const original = (files[source.inputId] ?? []).find((f) => f.name === fileName);
                          setFiles({
                            ...files,
                            [input.id]: [...current, original ?? { name: fileName, size: 0 }],
                          });
                        }
                      }
                    }}
                  />
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] shrink-0',
                      matchTier.text,
                      matchTier.pillBg,
                    ].join(' ')}
                  >
                    {matchPct}% match
                  </span>
                  <button
                    type="button"
                    title="Match score is the average confidence across all column alignments for this source."
                    className="text-ink-400 hover:text-ink-600 transition-colors cursor-help shrink-0"
                  >
                    <Info size={12} />
                  </button>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-1.5">
                {uploaded.length === 0 ? (
                  <span className="text-[11.5px] text-ink-400 italic">
                    No files mapped. Upload or choose a file to get started.
                  </span>
                ) : (
                  <>
                    {uploaded.slice(0, 2).map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        title={f.name}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/60 bg-brand-50/60 pl-2.5 pr-1.5 py-1 text-[11.5px] text-ink-700"
                      >
                        <FileIcon size={11} className="text-brand-600/70 shrink-0" />
                        <span className="max-w-[180px] truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(input.id, f.name)}
                          className="p-0.5 rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                          aria-label="Remove file"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {uploaded.length > 2 && (
                      <MoreFilesChip files={uploaded.slice(2)} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Column alignment */}
            {isOpen && total > 0 && (
              <div className="border-t border-canvas-border/40">
                <div className="px-5 pt-4 pb-1">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
                    Column Alignment
                  </span>
                </div>

                {/* Table headers */}
                <div className="grid grid-cols-[1fr_1fr_120px] gap-3 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
                  <span>Source Column</span>
                  <span>Target Schema</span>
                  <span className="text-right">Confidence</span>
                </div>

                {/* Auto-mapped group */}
                {auto.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setAutoExpanded((prev) => ({ ...prev, [input.id]: !autoOpen }))
                      }
                      className="w-full flex items-center justify-between gap-3 px-5 py-2 bg-brand-50/40 border-y border-brand-100/60 hover:bg-brand-50/60 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2 text-[12px] text-brand-700 font-semibold">
                        <CheckCircle2 size={14} className="text-brand-600" />
                        <span>{auto.length} fields auto-mapped</span>
                        <span className="text-ink-400 font-normal">·</span>
                        <span className="text-ink-500 font-normal">avg {avgAuto}% confidence</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700">
                        {autoOpen ? 'Collapse' : 'Expand'}
                        {autoOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>

                    {autoOpen && (
                      <div className="divide-y divide-canvas-border/40">
                        {auto.map((a) => (
                          <AlignmentRow
                            key={a.id}
                            alignment={a}
                            inputId={input.id}
                            tone="auto"
                            userMapped={userMapped.has(a.id)}
                            targetOptions={targetOptions(input.id)}
                            isPickerOpen={targetPickerFor === a.id}
                            onTogglePicker={() =>
                              setTargetPickerFor(targetPickerFor === a.id ? null : a.id)
                            }
                            onPickTarget={(name) => {
                              updateAlignmentTarget(input.id, a.id, name);
                              setTargetPickerFor(null);
                            }}
                            onShowJustification={(rect) =>
                              setJustification({ rect, alignmentId: a.id })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Review group (70–89) — auto-mapped but flagged for a glance */}
                {review.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-5 py-2 border-y border-canvas-border text-[11.5px] font-bold uppercase tracking-[0.1em] text-mitigated-700">
                      <AlertCircle size={13} />
                      Review recommended ({review.length})
                    </div>
                    <div className="divide-y divide-canvas-border/40">
                      {review.map((a) => (
                        <AlignmentRow
                          key={a.id}
                          alignment={a}
                          inputId={input.id}
                          tone="attention"
                          userMapped={userMapped.has(a.id)}
                          targetOptions={targetOptions(input.id)}
                          isPickerOpen={targetPickerFor === a.id}
                          onTogglePicker={() =>
                            setTargetPickerFor(targetPickerFor === a.id ? null : a.id)
                          }
                          onPickTarget={(name) => {
                            updateAlignmentTarget(input.id, a.id, name);
                            setTargetPickerFor(null);
                          }}
                          onShowJustification={(rect) =>
                            setJustification({ rect, alignmentId: a.id })
                          }
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Needs attention group (<70) — not auto-mapped, manual required */}
                {attention.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-5 py-2 bg-mitigated-50/60 border-y border-mitigated/20 text-[11.5px] font-bold uppercase tracking-[0.1em] text-mitigated-700">
                      <AlertTriangle size={13} />
                      Needs attention ({attention.length})
                    </div>
                    <div className="divide-y divide-canvas-border/40">
                      {attention.map((a) => (
                        <AlignmentRow
                          key={a.id}
                          alignment={a}
                          inputId={input.id}
                          tone="attention"
                          userMapped={userMapped.has(a.id)}
                          targetOptions={targetOptions(input.id)}
                          isPickerOpen={targetPickerFor === a.id}
                          onTogglePicker={() =>
                            setTargetPickerFor(targetPickerFor === a.id ? null : a.id)
                          }
                          onPickTarget={(name) => {
                            updateAlignmentTarget(input.id, a.id, name);
                            setTargetPickerFor(null);
                          }}
                          onShowJustification={(rect) =>
                            setJustification({ rect, alignmentId: a.id })
                          }
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* AI Justification popover */}
      <AnimatePresence>
        {justification && activeAlignment && (
          <JustificationPopover
            anchor={justification.rect}
            alignment={activeAlignment.alignment}
            onClose={() => setJustification(null)}
          />
        )}
      </AnimatePresence>

      {/* Preview modal */}
      {previewInput && (
        <DataPreviewModal
          schemaName={previewInput.name}
          fileName={previewInput.files[0]?.name ?? ''}
          onClose={() => setPreviewInput(null)}
        />
      )}
    </motion.div>
  );
}

// ── Alignment row ────────────────────────────────────────────────────

function AlignmentRow({
  alignment,
  tone,
  userMapped,
  targetOptions,
  isPickerOpen,
  onTogglePicker,
  onPickTarget,
  onShowJustification,
}: {
  alignment: ColumnAlignment;
  inputId: string;
  tone: 'auto' | 'attention';
  userMapped: boolean;
  targetOptions: string[];
  isPickerOpen: boolean;
  onTogglePicker: () => void;
  onPickTarget: (name: string) => void;
  onShowJustification: (rect: DOMRect) => void;
}) {
  const tier = tierForConfidence(alignment.confidence);
  const infoBtnRef = useRef<HTMLButtonElement>(null);

  // Force unmapped rendering for confidence < 70 unless the user has explicitly picked.
  const isUnmapped = !userMapped && (alignment.confidence < 70 || !alignment.target);

  // The amber highlight is reserved for rows that still need the user to act.
  // A mapped row — whether auto-mapped (review-recommended) or just hand-mapped
  // in "needs attention" — goes calm/white, so the fill tracks "resolved vs not"
  // rather than the tier label.
  const rowBg = isUnmapped
    ? 'bg-mitigated-50/60'
    : tone === 'auto'
      ? 'bg-brand-50/30'
      : 'bg-canvas-elevated';

  return (
    <div
      className={[
        'grid grid-cols-[1fr_1fr_120px] gap-3 items-center px-5 py-2.5 transition-colors',
        rowBg,
      ].join(' ')}
    >
      {/* Source */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[12.5px] font-semibold text-ink-800 truncate">
          {alignment.source.name}
        </span>
        <DTypeChip dtype={alignment.source.dtype} />
      </div>

      {/* Arrow + target */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-ink-400 shrink-0">→</span>
        <TargetPicker
          current={isUnmapped ? null : alignment.target?.name ?? null}
          dtype={alignment.target?.dtype ?? alignment.source.dtype}
          options={targetOptions}
          isOpen={isPickerOpen}
          onToggle={onTogglePicker}
          onPick={onPickTarget}
        />
      </div>

      {/* Confidence */}
      <div className="flex items-center justify-end gap-1.5">
        {!isUnmapped ? (
          <>
            <span className={`text-[13px] font-bold tabular-nums ${tier.text}`}>
              {alignment.confidence}%
            </span>
            <button
              ref={infoBtnRef}
              type="button"
              onClick={() => {
                if (infoBtnRef.current) {
                  onShowJustification(infoBtnRef.current.getBoundingClientRect());
                }
              }}
              className={`rounded-full p-0.5 ${tier.text} hover:bg-canvas transition-colors cursor-pointer`}
              aria-label="Show AI justification"
            >
              <Info size={12} />
            </button>
          </>
        ) : (
          <span className="text-[11.5px] text-ink-400">—</span>
        )}
      </div>
    </div>
  );
}

function DTypeChip({ dtype }: { dtype: ColumnDType }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider bg-canvas text-ink-500 border border-canvas-border shrink-0">
      {dtype}
    </span>
  );
}

// "+N more" pill that reveals the collapsed file names on hover. Native `title`
// tooltips are slow and easy to miss, so this shows the list instantly.
function MoreFilesChip({ files }: { files: { name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (files.length === 0) return null;
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="inline-flex items-center rounded-lg border border-brand-200/60 bg-brand-50/40 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 cursor-default">
        + {files.length} more
      </span>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[160px] max-w-[280px] rounded-lg border border-canvas-border bg-canvas-elevated p-1.5 shadow-[0_10px_28px_-12px_rgba(15,8,30,0.28)]">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[11.5px] text-ink-700"
            >
              <FileIcon size={11} className="text-brand-600/70 shrink-0" />
              <span className="truncate">{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

// ── Target picker dropdown ───────────────────────────────────────────

function TargetPicker({
  current,
  dtype,
  options,
  isOpen,
  onToggle,
  onPick,
}: {
  current: string | null;
  dtype: ColumnDType;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onPick: (name: string) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!current) {
    return (
      <div className="relative min-w-0">
        <button
          ref={btnRef}
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-brand-400 bg-canvas-elevated hover:bg-brand-50/40 px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors cursor-pointer"
        >
          <Plus size={12} />
          Map column
          <ChevronDown size={12} />
        </button>
        {isOpen && (
          <PickerMenu anchorEl={btnRef.current} options={options} current={null} onPick={onPick} onClose={onToggle} />
        )}
      </div>
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        className="w-full inline-flex items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/30 px-2 py-1.5 text-[12px] text-ink-800 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-brand-700 truncate">{current}</span>
          <DTypeChip dtype={dtype} />
        </span>
        <ChevronDown size={12} className="text-ink-400 shrink-0" />
      </button>
      {isOpen && <PickerMenu anchorEl={btnRef.current} options={options} current={current} onPick={onPick} onClose={onToggle} />}
    </div>
  );
}

function PickerMenu({
  anchorEl,
  options,
  current,
  onPick,
  onClose,
}: {
  anchorEl: HTMLButtonElement | null;
  options: string[];
  current: string | null;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPosition(anchorEl, menuRef, { matchWidth: true, minWidth: 240 });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorEl?.contains(t)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [anchorEl, onClose]);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(query.toLowerCase()),
  );

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 9999,
      }}
      className="min-w-[240px] bg-canvas-elevated rounded-lg border border-brand-300 shadow-lg overflow-hidden"
    >
      <div className="px-2.5 py-2 border-b border-canvas-border/60">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search columns..."
          className="w-full text-[12px] text-ink-800 placeholder:text-ink-400 outline-none bg-transparent"
        />
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-[11.5px] text-ink-400 italic">No matches.</p>
        ) : (
          filtered.map((opt) => {
            const selected = opt === current;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onPick(opt)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-left transition-colors cursor-pointer ${
                  selected ? 'bg-brand-50/60 text-brand-700 font-semibold' : 'text-ink-700 hover:bg-brand-50/40'
                }`}
              >
                <span className="truncate">{opt}</span>
                {selected && <Check size={12} className="text-brand-600 shrink-0 ml-auto" />}
              </button>
            );
          })
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── AI Justification popover ─────────────────────────────────────────

function JustificationPopover({
  anchor,
  alignment,
  onClose,
}: {
  anchor: DOMRect;
  alignment: ColumnAlignment;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const POPOVER_WIDTH = 340;
  const POPOVER_HEIGHT_GUESS = 460;
  const margin = 12;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Default: open to the left of the anchor (since the info icon sits at the right edge)
  let left = anchor.left - POPOVER_WIDTH - margin;
  if (left < margin) left = anchor.right + margin;
  if (left + POPOVER_WIDTH > viewportW - margin) left = viewportW - POPOVER_WIDTH - margin;

  let top = anchor.top - 6;
  if (top + POPOVER_HEIGHT_GUESS > viewportH - margin) {
    top = Math.max(margin, viewportH - POPOVER_HEIGHT_GUESS - margin);
  }

  const tier = tierForConfidence(alignment.confidence);

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 4 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'fixed', top, left, width: POPOVER_WIDTH, zIndex: 9999 }}
      className="bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-canvas-border/60">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-700">
          <Sparkles size={11} />
          AI Justification
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-400 hover:text-ink-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Metric rows */}
      <div className="px-4 py-3 space-y-3">
        {METRIC_ROWS.map((m) => {
          const value = alignment.breakdown[m.key];
          const valueTier = tierForConfidence(value);
          return (
            <div key={m.key}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[12.5px] font-bold text-ink-800">
                  {m.label}{' '}
                  <span className="text-ink-400 font-normal text-[11px]">×{m.weight}%</span>
                </span>
                <span className={`text-[12.5px] font-bold tabular-nums ${valueTier.text}`}>
                  {value}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-canvas overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full rounded-full ${m.bar}`}
                  style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
                />
              </div>
              <p className="text-[11px] text-ink-500 mt-1">{m.description}</p>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="px-4 pb-3 pt-1">
        <p className="text-[11.5px] text-ink-700 leading-snug">{alignment.explanation}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-canvas-border/60 bg-canvas/40">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${tier.text} ${tier.pillBg} ${tier.pillBorder}`}
        >
          Overall: {alignment.confidence}%
        </span>
        <span className="text-[11px] text-ink-500 truncate">
          {alignment.source.name} → {alignment.target?.name ?? '—'}
        </span>
      </div>
    </motion.div>,
    document.body,
  );
}

// ── Select File(s) dropdown ──────────────────────────────────────────

function SelectFileDropdown({
  isOpen,
  onToggle,
  onClose,
  search,
  setSearch,
  allFiles,
  currentFiles,
  onToggleFile,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  search: string;
  setSearch: (s: string) => void;
  allFiles: { name: string; inputId: string }[];
  currentFiles: { name: string }[];
  onToggleFile: (fileName: string, isCurrentlySelected: boolean) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-canvas-elevated hover:bg-brand-50 px-3 py-1.5 text-[11.5px] font-semibold text-brand-700 transition-colors cursor-pointer"
      >
        <ArrowLeftRight size={12} />
        Select File(s)
      </button>

      {isOpen && (
        <SelectFileMenu
          anchorEl={btnRef.current}
          onClose={onClose}
          search={search}
          setSearch={setSearch}
          allFiles={allFiles}
          currentFiles={currentFiles}
          onToggleFile={onToggleFile}
        />
      )}
    </div>
  );
}

function SelectFileMenu({
  anchorEl,
  onClose,
  search,
  setSearch,
  allFiles,
  currentFiles,
  onToggleFile,
}: {
  anchorEl: HTMLButtonElement | null;
  onClose: () => void;
  search: string;
  setSearch: (s: string) => void;
  allFiles: { name: string; inputId: string }[];
  currentFiles: { name: string }[];
  onToggleFile: (fileName: string, isCurrentlySelected: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pos = useAnchoredPosition(anchorEl, menuRef, { align: 'right' });

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 0);
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorEl?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorEl, onClose]);

  const currentNames = new Set(currentFiles.map((f) => f.name));
  const filtered = allFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 9999,
      }}
      className="w-72 bg-canvas-elevated rounded-xl border border-canvas-border shadow-lg overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-canvas-border/60">
        <Search size={14} className="text-ink-400 shrink-0" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full text-[12px] text-ink-700 placeholder:text-ink-400 outline-none bg-transparent"
        />
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.length > 0 ? (
          filtered.map((f, i) => {
            const isSelected = currentNames.has(f.name);
            return (
              <label
                key={`${f.name}-${i}`}
                className={`flex items-center gap-2.5 px-3 py-2 text-[12px] cursor-pointer transition-colors ${
                  isSelected ? 'text-ink-800' : 'text-ink-600 hover:bg-brand-50/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleFile(f.name, isSelected)}
                  className="size-3.5 rounded border-ink-300 accent-brand-600 shrink-0 cursor-pointer"
                />
                <span className="truncate">{f.name}</span>
              </label>
            );
          })
        ) : (
          <p className="px-3 py-3 text-[11px] text-ink-400 text-center">No files found</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Data preview modal ───────────────────────────────────────────────

const PREVIEW_DATA = [
  { row: 1, invoice_no: 'INV-001', vendor_id: 'V-1042', amount: '12,450.00', gl_code: '5010', invoice_date: '2024-01-05' },
  { row: 2, invoice_no: 'INV-002', vendor_id: 'V-2381', amount: '8,200.00', gl_code: '5020', invoice_date: '2024-01-12' },
  { row: 3, invoice_no: 'INV-003', vendor_id: 'V-1042', amount: '3,750.50', gl_code: '5010', invoice_date: '2024-01-18' },
  { row: 4, invoice_no: 'INV-004', vendor_id: 'V-9901', amount: '22,000.00', gl_code: '6030', invoice_date: '2024-01-22' },
  { row: 5, invoice_no: 'INV-005', vendor_id: 'V-3310', amount: '5,600.00', gl_code: '5020', invoice_date: '2024-01-29' },
];

const PREVIEW_COLUMNS = ['ROW', 'INVOICE_NO', 'VENDOR_ID', 'AMOUNT', 'GL_CODE', 'INVOICE_DATE'];

function DataPreviewModal({
  schemaName,
  fileName,
  onClose,
}: {
  schemaName: string;
  fileName: string;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-[680px] max-h-[80vh] bg-canvas-elevated rounded-2xl shadow-2xl border border-canvas-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
              <FileIcon size={16} className="text-brand-600" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-ink-900">{schemaName}</div>
              <div className="text-[11.5px] text-ink-400">{fileName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-canvas-border bg-canvas/60">
                {PREVIEW_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_DATA.map((row) => (
                <tr key={row.row} className="border-b border-canvas-border/40 hover:bg-brand-50/20 transition-colors">
                  <td className="px-4 py-2.5 text-ink-400 tabular-nums">{row.row}</td>
                  <td className="px-4 py-2.5 text-ink-800 font-medium">{row.invoice_no}</td>
                  <td className="px-4 py-2.5 text-ink-800">{row.vendor_id}</td>
                  <td className="px-4 py-2.5 text-ink-800 tabular-nums text-right">{row.amount}</td>
                  <td className="px-4 py-2.5 text-ink-800 tabular-nums">{row.gl_code}</td>
                  <td className="px-4 py-2.5 text-ink-800 tabular-nums">{row.invoice_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-canvas-border">
          <span className="text-[11px] text-ink-400">Previewing first 5 entries</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-[12px] font-semibold px-4 py-2 transition-colors cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
