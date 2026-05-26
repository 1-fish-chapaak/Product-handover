import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  X,
  File as FileIcon,
  Search,
  Check,
  Pencil,
  ArrowLeft,
  Shapes,
  ShieldCheck,
} from 'lucide-react';
import type {
  WorkflowDraft,
  JourneyFiles,
  JourneyAlignments,
} from './types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { cn } from '../../lib/cn';

interface Props {
  workflow: WorkflowDraft;
  files: JourneyFiles;
  // Kept for backward compatibility with the parent — no longer used in this card.
  setFiles: (f: JourneyFiles) => void;
  alignments: JourneyAlignments;
  expandedInputId?: string | null;
  onToggleExpand?: (inputId: string) => void;
  onViewWorkspace?: () => void;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
}

export default function StepMapData({
  workflow,
  files,
  expandedInputId,
  onToggleExpand,
  onViewWorkspace,
  onConfirm,
  confirmDisabled,
}: Props) {
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null);
  const expanded = expandedInputId !== undefined ? expandedInputId : internalExpanded;
  const toggleExpanded = (inputId: string) => {
    if (onToggleExpand) {
      onToggleExpand(inputId);
    } else {
      setInternalExpanded((prev) => (prev === inputId ? null : inputId));
    }
  };

  const [previewInput, setPreviewInput] = useState<{ name: string; files: { name: string }[] } | null>(null);

  // Column selection state — seeded with ALL columns selected per input.
  const [selectedByInput, setSelectedByInput] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    workflow.inputs.forEach((inp) => {
      init[inp.id] = new Set(inp.columns ?? []);
    });
    return init;
  });
  const [searchByInput, setSearchByInput] = useState<Record<string, string>>({});

  const toggleColumn = (inputId: string, col: string) => {
    setSelectedByInput((prev) => {
      const next = { ...prev };
      const cur = new Set(prev[inputId] ?? []);
      if (cur.has(col)) cur.delete(col);
      else cur.add(col);
      next[inputId] = cur;
      return next;
    });
  };

  const selectAll = (inputId: string, cols: string[]) => {
    setSelectedByInput((prev) => ({ ...prev, [inputId]: new Set(cols) }));
  };
  const deselectAll = (inputId: string) => {
    setSelectedByInput((prev) => ({ ...prev, [inputId]: new Set() }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2.5"
    >
      {workflow.inputs.map((input) => {
        const allCols = input.columns ?? [];
        const selected = selectedByInput[input.id] ?? new Set<string>();
        const search = searchByInput[input.id] ?? '';
        const filteredCols = allCols.filter((c) =>
          c.toLowerCase().includes(search.toLowerCase()),
        );
        const isOpen = expanded === input.id;
        const uploaded = files[input.id] ?? [];
        const sourceName = uploaded[0]?.name ?? 'No source mapped';
        const selectedCols = allCols.filter((c) => selected.has(c));

        return (
          <section
            key={input.id}
            className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden"
          >
            {/* Compact header row */}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[15px] font-semibold text-ink-900 shrink-0">
                  {input.name}
                </span>
                <ArrowLeft size={13} className="text-ink-400 shrink-0" />
                <button
                  type="button"
                  onClick={() =>
                    uploaded.length > 0 &&
                    setPreviewInput({ name: input.name, files: uploaded })
                  }
                  disabled={uploaded.length === 0}
                  className={cn(
                    'text-[13px] truncate text-left transition-colors',
                    uploaded.length > 0
                      ? 'text-ink-500 hover:text-brand-700 cursor-pointer'
                      : 'text-ink-400 italic cursor-default',
                  )}
                >
                  {sourceName}
                </button>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[12px] text-ink-400 tabular-nums whitespace-nowrap">
                  {selected.size} of {allCols.length} cols
                </span>
                <button
                  type="button"
                  onClick={() => toggleExpanded(input.id)}
                  aria-expanded={isOpen}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer transition-colors"
                >
                  <Pencil size={12} />
                  Edit
                </button>
              </div>
            </div>

            {/* Collapsed: selected column pills */}
            {!isOpen && (
              <div className="px-4 pb-3">
                {selectedCols.length === 0 ? (
                  <span className="text-[12px] text-ink-400 italic">
                    No columns selected.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCols.map((col) => (
                      <span
                        key={col}
                        className="inline-flex items-center rounded-lg bg-brand-50 border border-brand-100 px-2.5 py-1 text-[12px] text-ink-800 font-medium"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Expanded: column picker */}
            {isOpen && (
              <div className="border-t border-canvas-border/60 px-4 py-3">
                {allCols.length === 0 ? (
                  <div className="text-[12px] text-ink-400">
                    No columns detected for {input.name}.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                        Select columns to use
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => selectAll(input.id, allCols)}
                          className="text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer px-1 py-0.5 transition-colors"
                        >
                          Select all
                        </button>
                        <span className="text-ink-300">·</span>
                        <button
                          type="button"
                          onClick={() => deselectAll(input.id)}
                          className="text-[12px] font-semibold text-ink-500 hover:text-ink-700 cursor-pointer px-1 py-0.5 transition-colors"
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>

                    <div className="relative mb-2.5">
                      <Search
                        size={12}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 z-10"
                      />
                      <Input
                        sizeVariant="sm"
                        type="text"
                        value={search}
                        onChange={(e) =>
                          setSearchByInput((prev) => ({
                            ...prev,
                            [input.id]: e.target.value,
                          }))
                        }
                        placeholder="Type to filter columns…"
                        className="rounded-full pl-8"
                      />
                    </div>

                    {filteredCols.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-canvas-border px-3 py-4 text-center text-[12px] text-ink-400">
                        No columns match &ldquo;{search}&rdquo;.
                      </div>
                    ) : (
                      <ul className="grid grid-cols-2 gap-1.5">
                        {filteredCols.map((col) => {
                          const isSelected = selected.has(col);
                          return (
                            <li key={col}>
                              <button
                                type="button"
                                onClick={() => toggleColumn(input.id, col)}
                                aria-pressed={isSelected}
                                className={cn(
                                  'w-full flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-left transition-colors cursor-pointer',
                                  isSelected
                                    ? 'border-brand-400 bg-brand-50/60'
                                    : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/30',
                                )}
                              >
                                <span
                                  className={cn(
                                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors',
                                    isSelected
                                      ? 'bg-brand-600 text-white'
                                      : 'border border-canvas-border bg-canvas',
                                  )}
                                >
                                  {isSelected && (
                                    <Check size={12} strokeWidth={3} />
                                  )}
                                </span>
                                <span className="flex-1 text-[13px] font-medium text-ink-800 truncate">
                                  {col}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}

      <div className="flex items-center justify-between gap-2">
        {onConfirm ? (
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={confirmDisabled}
            leadingIcon={<ShieldCheck size={13} />}
          >
            Confirm &amp; Proceed
          </Button>
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewWorkspace?.()}
          leadingIcon={<Shapes size={13} />}
        >
          View Workspace
        </Button>
      </div>

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

// ─── Data Preview Modal ──────────────────────────────────────────────

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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 8, 30, 0.5)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-[680px] max-h-[80vh] bg-canvas-elevated rounded-xl border border-canvas-border overflow-hidden shadow-[0_18px_48px_-18px_rgba(15,8,30,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <FileIcon size={16} className="text-brand-600" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink-900">{schemaName}</div>
              <div className="text-[12px] text-ink-400 font-mono">{fileName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-canvas transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-canvas-border bg-canvas/60">
                {PREVIEW_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-400"
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
          <span className="text-[12px] text-ink-400">Previewing first 5 entries</span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close Preview
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
