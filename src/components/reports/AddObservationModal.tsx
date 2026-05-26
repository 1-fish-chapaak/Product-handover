import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, CloudUpload, Paperclip, FileText, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';

// ─── Types ────────────────────────────────────────────────────────────────

export type ObservationAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
};

export type ObservationDraft = {
  name: string;
  description: string;
  attachments: ObservationAttachment[];
};

// Shape the parent passes when reopening the modal in edit mode.
export type EditingObservationInput = {
  id: string;
  obsId: string;
  name: string;
  description: string;
  attachments?: ObservationAttachment[];
};

// Shape the modal emits via onSave.
export type ObservationSavePayload = {
  name: string;
  description: string;
  attachments?: ObservationAttachment[];
};

// ─── Helpers (also reusable by callers) ──────────────────────────────────

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const ATTACHMENT_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentVisual(mime: string): { Icon: React.ElementType; tone: string } {
  if (mime === 'application/pdf') return { Icon: FileText, tone: 'text-risk-700' };
  if (mime === 'text/csv' || mime.includes('spreadsheet') || mime === 'application/vnd.ms-excel')
    return { Icon: FileSpreadsheet, tone: 'text-compliant-700' };
  if (mime === 'application/msword' || mime.includes('wordprocessing'))
    return { Icon: FileText, tone: 'text-evidence-700' };
  return { Icon: Paperclip, tone: 'text-text-muted' };
}

// Compute the next OBS-NNN id given the list of existing ids.
export function computeNextObservationId(existingIds: string[]): string {
  const maxN = existingIds.reduce((max, id) => {
    const m = id.match(/^OBS-(\d+)$/i);
    const n = m ? parseInt(m[1], 10) : 0;
    return n > max ? n : max;
  }, 0);
  return `OBS-${String(maxN + 1).padStart(3, '0')}`;
}

// ─── Modal ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  editing: EditingObservationInput | null;
  nextObsId: string;
  onClose: () => void;
  onSave: (payload: ObservationSavePayload) => void;
}

// Max file size as a printable string ("10 MB"), derived from the byte
// constant so microcopy stays in sync with the hard limit.
const ATTACHMENT_MAX_LABEL = `${Math.floor(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB`;

// Allowed top-level MIME categories for observation attachments. Image and
// PDF only — spreadsheets / docs are filtered out at the drop zone so users
// get an explicit reject instead of a silent attach.
function isAllowedAttachmentMime(mime: string): boolean {
  if (!mime) return false;
  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf') return true;
  return false;
}

export default function AddObservationModal({ open, editing, nextObsId, onClose, onSave }: Props) {
  const { addToast } = useToast();
  const [obsForm, setObsForm] = useState<ObservationDraft>({ name: '', description: '', attachments: [] });
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const dragCounter = useRef(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useFocusTrap(dialogRef, open, onClose);

  // Sync form when (re)opening — populate from `editing`, or reset to blank.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setObsForm({
        name: editing.name,
        description: editing.description,
        attachments: editing.attachments ? [...editing.attachments] : [],
      });
    } else {
      setObsForm({ name: '', description: '', attachments: [] });
    }
    dragCounter.current = 0;
    setIsDraggingFiles(false);
    setIsSaving(false);
    setShowErrors(false);
  }, [open, editing]);

  const handleObservationAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const queue = Array.from(files);
    let rejectedSize = 0;
    let rejectedFolder = 0;
    let rejectedType = 0;
    queue.forEach((file) => {
      // Folder drops surface as a zero-byte, zero-type entry on most browsers.
      if (file.size === 0 && file.type === '') {
        rejectedFolder += 1;
        return;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        rejectedSize += 1;
        return;
      }
      if (!isAllowedAttachmentMime(file.type)) {
        rejectedType += 1;
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result ?? '');
        if (!dataUrl) return;
        setObsForm(prev => ({
          ...prev,
          attachments: [
            ...prev.attachments,
            {
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              size: file.size,
              mimeType: file.type || 'application/octet-stream',
              dataUrl,
            },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });
    if (rejectedSize > 0) {
      addToast({
        type: 'info',
        message: rejectedSize === 1
          ? `1 file skipped — over the ${ATTACHMENT_MAX_LABEL} per-file limit.`
          : `${rejectedSize} files skipped — over the ${ATTACHMENT_MAX_LABEL} per-file limit.`,
      });
    }
    if (rejectedFolder > 0) {
      addToast({
        type: 'info',
        message: 'Folders cannot be attached. Drop individual files instead.',
      });
    }
    if (rejectedType > 0) {
      addToast({
        type: 'error',
        message: 'Only images and PDFs are supported.',
      });
    }
  };

  const removeAttachment = (id: string) => {
    setObsForm(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== id) }));
  };

  const handleModalDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounter.current += 1;
    setIsDraggingFiles(true);
  };
  const handleModalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingFiles(false);
  };
  const handleModalDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingFiles(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleObservationAttachments(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const missingFields: { id: string; label: string }[] = [];
  if (!obsForm.name.trim()) missingFields.push({ id: 'observation-name', label: 'Name' });

  const handleSave = () => {
    if (isSaving) return;
    if (missingFields.length > 0) {
      setShowErrors(true);
      // Defer focus to the next paint so the summary renders first.
      window.requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
      return;
    }
    setIsSaving(true);
    // Brief delay so the spinner has time to register — matches the
    // template-apply latency pattern used elsewhere in the report.
    window.setTimeout(() => {
      onSave({
        name: obsForm.name.trim(),
        description: obsForm.description.trim(),
        attachments: obsForm.attachments.length > 0 ? obsForm.attachments : undefined,
      });
    }, 250);
  };

  const scrollToField = (fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLInputElement).focus?.();
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          onDragEnter={handleModalDragEnter}
          onDragLeave={handleModalDragLeave}
          onDragOver={handleModalDragOver}
          onDrop={handleModalDrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-observation-title"
          tabIndex={-1}
          className="relative bg-white rounded-[16px] border border-border-light shadow-2xl w-[520px] max-w-[calc(100vw-32px)] p-6"
        >
          {isDraggingFiles && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-1 z-10 rounded-[12px] border-2 border-dashed border-primary bg-primary-xlight/90 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
            >
              <div className="text-center">
                <CloudUpload size={28} className="text-primary mx-auto mb-2" strokeWidth={1.75} />
                <div className="text-[14px] font-semibold text-primary">Drop to attach files</div>
                <div className="text-[11px] text-text-secondary mt-1">PNG, JPG, PDF up to {ATTACHMENT_MAX_LABEL}</div>
              </div>
            </motion.div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-md text-text-muted hover:text-text hover:bg-paper-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
          >
            <X size={16} />
          </button>
          <h3 id="add-observation-title" className="text-[16px] font-bold text-text tracking-tight mb-5">
            {editing ? 'Edit observation' : 'Add observation'}
          </h3>

          {showErrors && missingFields.length > 0 && (
            <div
              role="alert"
              className="mb-4 border border-risk-200 bg-risk-50 rounded-[8px] px-3 py-2 text-[12.5px] text-risk-800"
            >
              <div className="font-semibold mb-0.5">
                {missingFields.length === 1 ? 'One field needs attention' : `${missingFields.length} fields need attention`}
              </div>
              <ul className="space-y-0.5">
                {missingFields.map(f => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => scrollToField(f.id)}
                      className="underline underline-offset-2 hover:text-risk-900 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 rounded"
                    >
                      {f.label} is required
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Observation ID</label>
              <input
                type="text"
                value={editing?.obsId ?? nextObsId}
                readOnly
                className="w-full bg-paper-50 border border-border-light rounded-[8px] px-3 py-2 text-[13px] font-mono text-text tabular-nums cursor-default"
              />
            </div>

            <div>
              <label htmlFor="observation-name" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Name <span className="text-risk ml-0.5 normal-case font-normal">*</span>
              </label>
              <input
                id="observation-name"
                ref={nameInputRef}
                type="text"
                value={obsForm.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setObsForm(prev => ({ ...prev, name: v }));
                  if (showErrors && v.trim()) setShowErrors(false);
                }}
                placeholder="e.g. Vendor master review gap"
                aria-invalid={showErrors && !obsForm.name.trim() ? 'true' : undefined}
                aria-required="true"
                autoFocus
                className={`w-full bg-white border rounded-[8px] px-3 py-2 text-[13px] text-text focus:outline-none focus:ring-2 transition-all ${
                  showErrors && !obsForm.name.trim()
                    ? 'border-risk-300 focus:border-risk-400 focus:ring-risk-200/60'
                    : 'border-border-light focus:border-primary/40 focus:ring-primary/15'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Description</label>
              <div className="bg-white border border-border-light rounded-[8px] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition-all overflow-hidden">
                <textarea
                  value={obsForm.description}
                  onChange={(e) => setObsForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Add observation details, evidence, and recommended actions."
                  rows={4}
                  className="w-full bg-transparent border-0 px-3 pt-2 pb-1 text-[13px] text-text focus:outline-none focus:ring-0 resize-none"
                />
                {obsForm.attachments.length > 0 && (
                  <ul className="px-3 pb-2 space-y-1.5">
                    {obsForm.attachments.map(att => {
                      const isImage = isImageMime(att.mimeType);
                      const { Icon, tone } = attachmentVisual(att.mimeType);
                      return (
                        <li
                          key={att.id}
                          className="flex items-center gap-2.5 px-2 py-1.5 bg-paper-50 border border-border-light rounded-[6px]"
                        >
                          {isImage ? (
                            <div className="w-8 h-8 rounded-[4px] border border-border-light overflow-hidden bg-white shrink-0">
                              <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-[4px] border border-border-light bg-white inline-flex items-center justify-center shrink-0 ${tone}`}>
                              <Icon size={15} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] text-text font-medium truncate">{att.name}</div>
                            <div className="text-[10.5px] text-text-muted tabular-nums">{formatFileSize(att.size)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id)}
                            aria-label={`Remove ${att.name}`}
                            className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-risk-700 hover:bg-white transition-colors cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex items-center justify-between px-2 py-1.5 border-t border-border-light/60 bg-paper-50/40">
                  <label
                    title={`Attach files (PNG, JPG, PDF up to ${ATTACHMENT_MAX_LABEL})`}
                    className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[11.5px] font-medium text-text-secondary hover:text-primary hover:bg-primary-xlight transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-brand-600/40 focus-within:ring-offset-1"
                  >
                    <Paperclip size={13} />
                    <span>{obsForm.attachments.length > 0 ? 'Add more files' : 'Attach files'}</span>
                    <input
                      type="file"
                      multiple
                      accept={ATTACHMENT_ACCEPT}
                      onChange={(e) => {
                        handleObservationAttachments(e.target.files);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  {obsForm.attachments.length > 0 && (
                    <span className="text-[10.5px] text-text-muted tabular-nums pr-1">
                      {obsForm.attachments.length} {obsForm.attachments.length === 1 ? 'file' : 'files'}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-400">
                PNG, JPG, PDF up to {ATTACHMENT_MAX_LABEL}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-6">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex items-center justify-center h-9 px-4 text-[13px] font-semibold text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              aria-busy={isSaving || undefined}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-5 text-[13px] font-semibold text-white bg-primary rounded-[8px] hover:bg-primary-hover disabled:bg-primary/60 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              {isSaving
                ? 'Saving…'
                : editing
                  ? 'Update observation'
                  : 'Save observation'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
