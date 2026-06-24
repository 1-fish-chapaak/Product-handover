import { useRef, useState, useId } from 'react';
import { CloudUpload, FileText, X, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../../shared/Toast';
import { formatBytes } from '../format';

// Reusable drag-and-drop file zone. Generalises the inline dropzone pattern in
// UploadReportModal.tsx (lines ~328–359) so Screens 2A / 2B share one component.
// Validates by extension + max size and surfaces errors through the shared toast.
// Once a file is accepted the zone flips to a "filled" state that lists the
// file(s) INSIDE the box (with Replace / Add-another), so nothing renders above
// the surrounding layout.

interface FileDropZoneProps {
  /** Display label, e.g. "Upload Audit Report". */
  label: string;
  /** Allowed extensions without the dot, lowercase: ['pdf','docx','xlsx','pptx']. */
  acceptExt: string[];
  /** Accept >1 file (annexures). Default false. */
  multiple?: boolean;
  /** Max size per file in MB. Default 20. */
  maxSizeMb?: number;
  /** Helper text under the label. */
  hint?: string;
  /** Currently accepted file(s) — controlled by the parent. */
  files: File[];
  onFiles: (files: File[]) => void;
  onRemove?: (index: number) => void;
  /** Compact secondary zone (e.g. optional annexures). */
  variant?: 'primary' | 'secondary';
}

export default function FileDropZone({
  label, acceptExt, multiple = false, maxSizeMb = 20, hint, files, onFiles, onRemove, variant = 'primary',
}: FileDropZoneProps) {
  const { addToast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputId = useId();
  const accept = acceptExt.map(e => `.${e}`).join(',');

  const validate = (f: File): boolean => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!acceptExt.includes(ext)) {
      addToast({ type: 'error', message: `Unsupported file type ".${ext}". Accepted: ${acceptExt.map(e => `.${e}`).join(', ')}.` });
      return false;
    }
    if (f.size > maxSizeMb * 1024 * 1024) {
      addToast({ type: 'error', message: `"${f.name}" is ${formatBytes(f.size)} — over the ${maxSizeMb} MB limit.` });
      return false;
    }
    return true;
  };

  const accept_ = (list: FileList | null | undefined) => {
    if (!list || list.length === 0) return;
    const valid = Array.from(list).filter(validate);
    if (valid.length === 0) return;
    onFiles(multiple ? [...files, ...valid] : [valid[0]]);
  };

  const browse = () => inputRef.current?.click();
  const hasFiles = files.length > 0;
  const pad = variant === 'secondary' ? 'p-2.5' : 'p-3';

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); accept_(e.dataTransfer.files); }}
      className={`rounded-[12px] border-2 transition-colors ${
        hasFiles
          ? 'border-solid border-brand-200 bg-brand-50/30'
          : `border-dashed ${dragOver ? 'border-brand-500 bg-brand-50/60' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200 hover:bg-brand-50/30'}`
      }`}
    >
      {!hasFiles ? (
        <button
          type="button"
          onClick={browse}
          aria-label={label}
          className={`w-full flex flex-col items-center justify-center gap-1 text-center cursor-pointer ${variant === 'secondary' ? 'py-3.5 px-4' : 'py-7 px-6'}`}
        >
          <span className={`inline-flex items-center justify-center rounded-full ${variant === 'secondary' ? 'w-8 h-8 mb-0.5' : 'w-10 h-10'} ${dragOver ? 'bg-brand-100 text-brand-700' : 'bg-brand-50 text-brand-600'}`}>
            <CloudUpload size={variant === 'secondary' ? 16 : 19} aria-hidden="true" />
          </span>
          <span className={`font-semibold text-ink-800 ${variant === 'secondary' ? 'text-[12.5px]' : 'text-[13.5px]'}`}>{label}</span>
          <span className="text-[12px] text-ink-500">
            Drag &amp; drop or <span className="text-brand-700 font-medium">browse</span>
            {hint ? ` · ${hint}` : ''}
          </span>
          <span className="text-[11px] text-ink-400">{acceptExt.map(e => `.${e}`).join(' · ')} · up to {maxSizeMb} MB</span>
        </button>
      ) : (
        <div className={pad}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 size={13} className="text-compliant-700 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</span>
          </div>
          <ul className="space-y-1.5">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-[8px] border border-canvas-border bg-canvas-elevated px-3 py-2">
                <FileText size={15} className="text-brand-600 shrink-0" aria-hidden="true" />
                <span className="text-[12.5px] font-medium text-ink-800 truncate flex-1">{f.name}</span>
                <span className="text-[11px] text-ink-400 tabular-nums shrink-0">{formatBytes(f.size)}</span>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Remove ${f.name}`}
                    className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={browse}
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:underline cursor-pointer"
          >
            {multiple ? <><Plus size={13} aria-hidden="true" /> Add another file</> : <><RefreshCw size={12} aria-hidden="true" /> Replace file</>}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={e => { accept_(e.target.files); e.currentTarget.value = ''; }}
      />
    </div>
  );
}
