// ─── TOE as a grid, and its files listed once (agentic UI review #5, 30 Sep) ─────
// The review: "one pass/fail per attribute, and the same required file listed 4
// times". An attribute's verdict hides which ITEMS failed it, and every attribute
// that needs the invoice register asked for it again. So: an item × attribute
// grid of small dots, the clean items folded into one line, only the mismatches
// open; and every file named once, with the attributes it serves beside it.
//
// No sox-icfr export is read at module load here (the folder's import cycle turns
// that into a TDZ throw) — helpers are only called inside render.
import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Upload, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { mapEvidence } from './controlChatEvidence';
import { itemResult, requiredFilesOf } from './helpers';
import type { Control, EvidenceFile, OperatingStep, Sample, TestResult } from './types';

const cellOf = (step: OperatingStep, item: Sample): TestResult => itemResult(step, item);

/** One cell. Green and red are outcomes, so they are the only colours; a hollow
 *  ring is "not tested" — nothing claimed, nothing to colour. */
function Dot({ r, title }: { r: TestResult; title: string }) {
  return (
    <span title={title} aria-label={title} role="img"
      className={cn('inline-block w-2 h-2 rounded-full',
        r === 'Pass' ? 'bg-compliant-500' : r === 'Fail' ? 'bg-risk-500' : 'border border-ink-300 bg-transparent')} />
  );
}

export function ToeGrid({ control, onOpenWorking }: { control: Control; onOpenWorking?: (step: OperatingStep, item?: Sample) => void }) {
  const [showClean, setShowClean] = useState(false);
  const steps = control.operating.steps;
  const items = control.operating.sampling?.samples ?? [];
  if (!steps.length || !items.length) return null;

  // Clean = every attribute passed on this item. Those fold into one line: a
  // reviewer reads the count, not twenty identical green rows. Anything with a
  // Fail stays open, and an item still untested lists normally — it is not
  // clean, it is unfinished.
  const clean = items.filter(it => steps.every(s => cellOf(s, it) === 'Pass'));
  const rest = items.filter(it => !clean.includes(it));
  const failing = (it: Sample) => steps.some(s => cellOf(s, it) === 'Fail');
  // Mismatches first, then the unfinished — the order a reviewer works them.
  const ordered = [...rest.filter(failing), ...rest.filter(it => !failing(it))];

  const row = (it: Sample) => (
    <tr key={it.id} className={cn('border-t border-canvas-border', failing(it) && 'bg-risk-50/40')}>
      <td className="sticky left-0 bg-inherit px-2 py-1 font-mono text-[0.6875rem] text-ink-700 whitespace-nowrap">
        {it.ref}{it.extension && <span className="ml-1 text-[0.6875rem] text-ink-400" title="Drawn in the extension round">ext</span>}
      </td>
      {steps.map(s => {
        const r = cellOf(s, it);
        const title = `${s.code} · ${it.ref} · ${r === 'Pass' ? 'Match' : r === 'Fail' ? 'Mismatch' : 'Not tested'}`;
        // A cell Ira answered opens that attribute's working with this item
        // marked in its file; an untested cell has nothing to show.
        const open = onOpenWorking && s.validation?.result && r !== 'Not tested';
        return (
          <td key={s.id} className="px-2 py-1 text-center">
            {open
              ? <button type="button" onClick={() => onOpenWorking(s, it)} aria-label={`${title} — see where Ira read it`}
                  className="inline-flex p-1 -m-1 rounded cursor-pointer hover:bg-paper-100"><Dot r={r} title={`${title} — see where Ira read it`} /></button>
              : <Dot r={r} title={title} />}
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-auto min-w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="sticky left-0 bg-canvas px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Item</th>
            {steps.map(s => (
              <th key={s.id} className="px-2 py-1 text-center">
                {/* The code opens the attribute's Ira working only where there is a
                    run to show; otherwise it is a label, not a dead button. */}
                {s.validation && onOpenWorking
                  ? <button onClick={() => onOpenWorking(s)} title={s.description}
                      className="font-mono text-[0.6875rem] font-semibold text-brand-700 hover:underline cursor-pointer">{s.code}</button>
                  : <span title={s.description} className="font-mono text-[0.6875rem] font-semibold text-ink-600">{s.code}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clean.length > 0 && (
            <tr className="border-t border-canvas-border">
              <td colSpan={steps.length + 1} className="px-2 py-1">
                <button onClick={() => setShowClean(v => !v)} aria-expanded={showClean}
                  className="inline-flex items-center gap-1 text-[0.6875rem] text-ink-600 hover:text-ink-800 cursor-pointer">
                  {showClean ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <span className="inline-block w-2 h-2 rounded-full bg-compliant-500" aria-hidden />
                  {clean.length} of {items.length} items clean
                  <span className="text-ink-400">· {showClean ? 'hide' : 'show'}</span>
                </button>
              </td>
            </tr>
          )}
          {showClean && clean.map(row)}
          {ordered.map(row)}
        </tbody>
      </table>
      <p className="mt-1 px-2 text-[0.6875rem] text-ink-400">Green = match · red = mismatch · ring = not tested</p>
    </div>
  );
}

/** One required file, however many attributes ask for it — keyed by its label,
 *  normalised, since each attribute holds its own copy of the line. */
interface FileGroup { label: string; slots: { step: OperatingStep; fileId: string; file?: EvidenceFile }[] }
const norm = (l: string) => l.trim().replace(/\s+/g, ' ').toLowerCase();

export function ToeFiles({ control, canEdit, onOpenFile }: { control: Control; canEdit: boolean; onOpenFile?: (file: EvidenceFile, stepIds: string[]) => void }) {
  const { uploadRequiredFile, clearRequiredFile } = useIcfr();
  const logEvent = useAuditLog();
  // Files from "Upload several" that matched no line — named here until placed
  // or discarded, never dropped silently (user ask, 1 Oct: multi-upload back).
  const [spare, setSpare] = useState<string[]>([]);
  // The picked files' bytes, by name — a spare placed later still carries its
  // object URL, so the evidence viewer opens the file rather than just its name.
  const urls = useRef(new Map<string, string>());
  const groups = new Map<string, FileGroup>();
  for (const step of control.operating.steps) {
    for (const f of requiredFilesOf(step, control)) {
      const k = norm(f.label);
      const g = groups.get(k) ?? { label: f.label, slots: [] };
      g.slots.push({ step, fileId: f.id, file: f.file });
      groups.set(k, g);
    }
  }
  const list = [...groups.values()];
  if (!list.length) return null;
  // A file counts as in only when EVERY attribute that needs it has it — a line
  // half-filled (an old per-attribute upload) still owes the others theirs.
  const isIn = (g: FileGroup) => g.slots.every(s => s.file);
  const inCount = list.filter(isIn).length;

  const upload = (g: FileGroup, name: string, url = urls.current.get(name)) => {
    g.slots.forEach(s => uploadRequiredFile(control.id, s.step.id, s.fileId, name, url));
    logEvent({ action: 'Upload', description: `Uploaded ${name} as "${g.label}" for ${Array.from(new Set(g.slots.map(s => s.step.code))).join(', ')} (${control.id})`, module: 'SOX ICFR', entity: 'Evidence' });
  };
  // "Upload several": pick a pile, and Ira's mapper (the chat rail's own, one
  // mapper in the product) puts each file on the line it proves. A match fills
  // that line for every attribute sharing it; the rest wait below for a person.
  const takePile = (files: FileList | null) => {
    if (!files?.length) return;
    const left: string[] = [];
    Array.from(files).forEach(f => urls.current.set(f.name, URL.createObjectURL(f)));
    mapEvidence(control, Array.from(files).map(f => f.name)).forEach(m => {
      const g = m.slot ? groups.get(norm(m.slot.label)) : undefined;
      if (g) upload(g, m.name); else left.push(m.name);
    });
    setSpare(prev => [...prev, ...left]);
  };
  const place = (name: string, label: string) => {
    const g = groups.get(norm(label));
    if (g) upload(g, name);
    setSpare(prev => prev.filter(n => n !== name));
  };
  const remove = (g: FileGroup) => g.slots.forEach(s => s.file && clearRequiredFile(control.id, s.step.id, s.fileId));

  return (
    <div>
      <div className="px-2 py-1 flex items-center gap-2">
        <span className="text-[0.6875rem] font-semibold text-ink-700">Files <span className="font-normal text-ink-400">· {inCount} of {list.length} in</span></span>
        {canEdit && list.length > 1 && (
          <label title="Choose several files at once — each one is matched to the line it proves; anything with no line waits for you"
            className="ml-auto h-6 px-2 rounded-md border border-brand-200 bg-canvas-elevated text-brand-700 text-[0.6875rem] font-semibold hover:border-brand-400 hover:bg-brand-50 focus-within:ring-2 focus-within:ring-brand-200 inline-flex items-center gap-1 cursor-pointer">
            <input type="file" multiple className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
              aria-label="Upload several files at once" onChange={e => { takePile(e.target.files); e.target.value = ''; }} />
            <Upload size={10} /> {inCount === 0 ? `Upload all ${list.length}` : 'Upload several'}
          </label>
        )}
      </div>
      {spare.length > 0 && (
        <div className="mx-2 mb-1.5 rounded-md border border-canvas-border bg-paper-50/60 px-2.5 py-2 space-y-1.5">
          <p className="text-[0.6875rem] text-ink-600">{spare.length === 1 ? 'This file matched no line' : `${spare.length} files matched no line`} — pick where {spare.length === 1 ? 'it goes' : 'each goes'}, or discard.</p>
          {spare.map(name => (
            <div key={name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-ink-800" title={name}>{name}</span>
              <select defaultValue="" aria-label={`Line for ${name}`} onChange={e => e.target.value && place(name, e.target.value)}
                className="h-6 max-w-48 rounded-md border border-canvas-border bg-canvas-elevated px-1.5 text-[0.6875rem] text-ink-700 focus:outline-none focus:border-brand-300 cursor-pointer">
                <option value="" disabled>Put on…</option>
                {list.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
              </select>
              <button onClick={() => setSpare(prev => prev.filter(n => n !== name))} aria-label={`Discard ${name}`} title="Discard"
                className="h-6 w-6 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer"><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
      <ul className="divide-y divide-canvas-border">
        {list.map(g => {
          const file = g.slots.find(s => s.file)?.file;
          const codes = Array.from(new Set(g.slots.map(s => s.step.code))).join(' · ');
          const full = isIn(g);
          return (
            <li key={g.label} className="flex items-center gap-2 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[0.75rem] font-medium text-ink-800 truncate" title={g.label}>{g.label}</div>
                <div className="text-[0.6875rem] text-ink-400">
                  for {codes}{file && !full && <span className="text-ink-500"> · not yet on every attribute</span>}
                </div>
              </div>
              {file && (onOpenFile
                ? <button onClick={() => onOpenFile(file, g.slots.map(s => s.step.id))} title={file.name}
                    className="max-w-44 truncate text-[0.6875rem] font-medium text-brand-700 hover:underline cursor-pointer">{file.name}</button>
                : <span title={file.name} className="max-w-44 truncate text-[0.6875rem] text-ink-700">{file.name}</span>)}
              {!file && !canEdit && <span className="text-[0.6875rem] text-ink-400">Not in</span>}
              {canEdit && (
                <label className="h-6 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-ink-600 text-[0.6875rem] font-semibold hover:border-brand-300 hover:text-brand-700 focus-within:ring-2 focus-within:ring-brand-200 inline-flex items-center gap-1 cursor-pointer shrink-0">
                  <input type="file" className="sr-only" aria-label={`${file ? 'Replace' : 'Upload'} ${g.label}`}
                    onChange={e => { const f = e.target.files?.[0]; if (f) upload(g, f.name, URL.createObjectURL(f)); e.target.value = ''; }} />
                  <Upload size={10} /> {file ? 'Replace' : 'Upload'}
                </label>
              )}
              {canEdit && file && (
                <button onClick={() => remove(g)} aria-label={`Remove the file for ${g.label}`} title="Remove the uploaded file"
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer shrink-0"><X size={11} /></button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
