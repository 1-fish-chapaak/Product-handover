import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { BadgeCheck, Mail, Sparkles, Upload } from 'lucide-react';
import DialogFocus from '../shared/DialogFocus';
import { OriginPicker } from './parts';
import { cn } from '../../lib/cn';
import type { DesignWaiverReason, FileOrigin } from './types';

/** Which plan step a missing file holds. */
export type FileAskStep = 'design' | 'population' | 'operating';

export interface FileAskRow {
  key: string;
  label: string;
  /** One line under the name — who it was asked from, or which attributes need it. */
  detail?: string;
  /** The same accept list the page's own picker for this slot carries. */
  accept: string;
  multiple: boolean;
  /** A design element — the only kind that can be accounted for as not applicable. */
  docId?: string;
  /** A population source: where it came from is asked before it lands (per-file provenance). */
  origin?: boolean;
}

// The page's waiver reasons and button words (ControlDossier's WAIVER_BTN), kept
// here as plain strings — this file must not read a sox-icfr export at load.
const WAIVERS: { reason: DesignWaiverReason; label: string }[] = [
  { reason: 'Prepared by the audit team', label: 'Audit team prepared it' },
  { reason: 'Held by the client — inspected in situ', label: 'Inspected at the client' },
  { reason: 'Not applicable — design tested off the control description', label: 'Not applicable' },
];

const STEP_LINE: Record<FileAskStep, string> = {
  design: 'Test of design — I can’t read the design checks until this is on file.',
  population: 'Population — I can’t build the population until the source data is on the audit.',
  operating: 'Test of operating effectiveness — I can’t validate these attributes until their files are in.',
};

const typesOf = (accept: string) => accept.split(',').map(x => x.replace('.', '').toUpperCase()).join(', ');

function Row({ row, onFiles, onWaive }: {
  row: FileAskRow;
  onFiles: (row: FileAskRow, files: File[], origin?: FileOrigin) => void;
  onWaive: (row: FileAskRow, reason: DesignWaiverReason, note: string) => void;
}) {
  const [over, setOver] = useState(false);
  const [waiving, setWaiving] = useState(false);
  const [note, setNote] = useState('');
  // A population source waits here for its provenance before it lands.
  const [staged, setStaged] = useState<File | null>(null);
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (row.origin) { setStaged(files[0]); return; }
    onFiles(row, row.multiple ? files : files.slice(0, 1));
  };
  return (
    <li className="rounded-lg border border-canvas-border p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-ink-800 min-w-0 truncate">{row.label}</span>
        <span className="shrink-0 text-[0.625rem] font-bold uppercase tracking-wide px-1 h-3.75 inline-flex items-center rounded bg-brand-50 text-brand-700">Required</span>
        {row.docId && !waiving && (
          <button type="button" onClick={() => setWaiving(true)}
            className="ml-auto shrink-0 h-6 px-2 rounded-md text-[0.6875rem] font-semibold text-ink-500 hover:text-evidence-700 inline-flex items-center gap-1 cursor-pointer">
            <BadgeCheck size={11} /> Not applicable
          </button>
        )}
      </div>
      {row.detail && <p className="mt-0.5 text-[0.6875rem] text-ink-500">{row.detail}</p>}
      {waiving ? (
        <div className="mt-2 p-2.5 rounded-lg border border-high-200 bg-high-50/40">
          <label className="block text-[0.75rem] font-semibold text-high-700 mb-1.5" htmlFor={`waive-${row.key}`}>Why won’t {row.label} be provided? The working paper prints this.</label>
          <textarea id={`waive-${row.key}`} autoFocus value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Record your rationale — retained in the working paper."
            className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-high-200 resize-none" />
          <div className="flex items-center justify-end gap-1.5 mt-2 flex-wrap">
            {!note.trim() && <span className="mr-auto text-[0.6875rem] text-ink-500">Write the reason first — the buttons wait for it.</span>}
            <button type="button" onClick={() => { setWaiving(false); setNote(''); }} className="h-7 px-2.5 text-[0.75rem] font-semibold text-ink-500 hover:text-ink-800 cursor-pointer">Cancel</button>
            {WAIVERS.map(w => (
              <button key={w.reason} type="button" disabled={!note.trim()} onClick={() => onWaive(row, w.reason, note.trim())}
                className="h-7 px-2.5 text-[0.75rem] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 cursor-pointer">{w.label}</button>
            ))}
          </div>
        </div>
      ) : staged ? (
        <div className="mt-2">
          <p className="text-[0.75rem] text-ink-700 mb-1.5"><span className="font-semibold">{staged.name}</span> — where did this file come from? It is asked once and kept on the file.</p>
          <OriginPicker onPick={o => onFiles(row, [staged], o)} />
          <button type="button" onClick={() => setStaged(null)} className="mt-1.5 text-[0.6875rem] text-ink-400 hover:text-ink-700 cursor-pointer">Choose a different file</button>
        </div>
      ) : (
        <label
          onDragEnter={e => { e.preventDefault(); setOver(true); }}
          onDragOver={e => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
          className={cn('mt-2 block cursor-pointer rounded-md border border-dashed px-3 py-3.5 text-center transition-colors focus-within:ring-2 focus-within:ring-brand-200',
            over ? 'border-brand-400 bg-brand-50/50' : 'border-canvas-border bg-canvas-elevated hover:border-brand-300 hover:bg-brand-50/30')}>
          <input type="file" accept={row.accept} multiple={row.multiple} className="sr-only"
            aria-label={`Upload ${row.label}`}
            onChange={e => { take(e.target.files); e.target.value = ''; }} />
          <Upload size={14} className="mx-auto text-ink-400 mb-1" aria-hidden />
          <p className="text-[0.6875rem] font-semibold text-ink-700 leading-tight">Drop the file here or browse</p>
          <p className="text-[0.6875rem] text-ink-400 mt-0.5">{typesOf(row.accept)}</p>
        </label>
      )}
    </li>
  );
}

/** "Ira needs a file to continue" (product decision, 5 Oct) — Automatic only,
 *  on a started plan, when the step Ira is on cannot run for a missing file.
 *  Every missing file of that one step, one row each. What happens to a file,
 *  an ask or a waiver is the chat pane's — this only collects the answer. */
export default function IraFileAsk({ code, step, rows, owner, asked, onFiles, onWaive, onAsk, onSkip }: {
  code: string; step: FileAskStep; rows: FileAskRow[];
  owner: string;
  /** Already asked of the owner — "Ask the owner instead" says so rather than asking twice. */
  asked: string | null;
  onFiles: (row: FileAskRow, files: File[], origin?: FileOrigin) => void;
  onWaive: (row: FileAskRow, reason: DesignWaiverReason, note: string) => void;
  onAsk: () => void;
  onSkip: () => void;
}) {
  return createPortal(
    <div className="modal-backdrop">
      <motion.div role="dialog" aria-modal="true" aria-labelledby="ira-file-ask-title" className="modal" style={{ maxWidth: 520 }}
        initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <DialogFocus onEscape={onSkip} />
        <div className="px-5 py-3.5 border-b border-canvas-border">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600" aria-hidden />
            <h3 id="ira-file-ask-title" className="text-[0.875rem] font-bold text-ink-900">Ira needs a file to continue</h3>
          </div>
          <p className="mt-1 text-[0.75rem] text-ink-500"><span className="font-semibold text-ink-700">{code}</span> · {STEP_LINE[step]}</p>
        </div>
        <ul className="px-5 py-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {rows.map(r => <Row key={r.key} row={r} onFiles={onFiles} onWaive={onWaive} />)}
        </ul>
        <div className="px-5 py-3 border-t border-canvas-border flex items-center gap-2 flex-wrap">
          {asked
            ? <span className="text-[0.75rem] font-semibold text-ink-500">{asked}</span>
            : (
              <button type="button" onClick={onAsk}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer">
                <Mail size={12} aria-hidden /> Ask the owner instead
              </button>
            )}
          <span className="text-[0.6875rem] text-ink-400 truncate">{asked ? '' : `Goes to ${owner}, due in three days`}</span>
          <button type="button" onClick={onSkip}
            className="ml-auto h-8 px-3 rounded-lg text-[0.75rem] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer">Skip for now</button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
