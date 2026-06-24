import { useRef, useState, useId } from 'react';
import { CloudUpload, FileText, X } from 'lucide-react';
import { useToast } from '../../../shared/Toast';
import { formatBytes } from '../format';

// Reusable drag-and-drop file zone. Generalises the inline dropzone pattern in
// UploadReportModal.tsx (lines ~328–359) so Screens 2A / 2B share one component.
// Validates by extension + max size and surfaces errors through the shared toast.

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

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); accept_(e.dataTransfer.files); }}
        aria-label={label}
        className={`w-full flex flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed transition-colors cursor-pointer text-center ${
          variant === 'secondary' ? 'py-5 px-5' : 'py-7 px-6'
        } ${
          dragOver ? 'border-brand-500 bg-brand-50/60' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200 hover:bg-brand-50/30'
        }`}
      >
        <span className={`inline-flex items-center justify-center rounded-full ${variant === 'secondary' ? 'w-8 h-8' : 'w-10 h-10'} ${dragOver ? 'bg-brand-100 text-brand-700' : 'bg-brand-50 text-brand-600'}`}>
          <CloudUpload size={variant === 'secondary' ? 16 : 19} aria-hidden="true" />
        </span>
        <span className={`font-semibold text-ink-800 ${variant === 'secondary' ? 'text-[12.5px]' : 'text-[13.5px]'}`}>{label}</span>
        <span className="text-[12px] text-ink-500">
          Drag &amp; drop or <span className="text-brand-700 font-medium">browse</span>
          {hint ? ` · ${hint}` : ''}
        </span>
        <span className="text-[11px] text-ink-400">{acceptExt.map(e => `.${e}`).join(' · ')} · up to {maxSizeMb} MB</span>
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={e => { accept_(e.target.files); e.currentTarget.value = ''; }}
      />

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-[8px] border border-canvas-border bg-canvas-elevated px-3 py-2">
              <FileText size={15} className="text-brand-600 shrink-0" aria-hidden="true" />
              <span className="text-[12.5px] text-ink-800 truncate flex-1">{f.name}</span>
              <span className="text-[11px] text-ink-400 tabular-nums shrink-0">{formatBytes(f.size)}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove ${f.name}`}
                  className="text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
