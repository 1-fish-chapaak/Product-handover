/**
 * Create RACM, for the RACM tab on the Engagements page (S11).
 *
 *   chooser (entity · process · RACM file or SOP) → file picker → import review → saved to the tab
 *
 * The same flow opens from three places: the tab's own Create RACM button, a
 * process on New engagement's Scope step that has no RACM yet (process fixed),
 * and an engagement's "Add RACM" (upload one there and then). Wherever it opens,
 * the RACM lands on the tab — engagements only ever copy from there.
 *
 * Needs no engagement: the entity list is every company already named on a SOX
 * engagement, plus any typed here.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Sparkles, X } from 'lucide-react';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import RacmImportReview, { type RacmImportMeta } from './RacmImportReview';
import { addLibraryRacm, knownCompanies, racmLibrary, type LibraryRacm } from './racmLibrary';
import type { Control } from './types';

/** The processes a SOX RACM is usually written for; anything else is named by hand. */
export const SOX_RACM_PROCESSES = [
  'Order to Cash', 'Procure to Pay', 'Record to Report', 'Inventory', 'Fixed Assets',
  'Payroll (Hire to Retire)', 'Treasury', 'Tax', 'IT General Controls',
];

const NEW_OPTION = '__new__';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5 block';
const fieldCls = 'w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200';
const cardCls = 'text-left rounded-xl border border-canvas-border p-4 transition-colors cursor-pointer hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-canvas-border disabled:hover:bg-transparent';

/** A name nobody else on the tab has — "Treasury — Altura Solar Pvt Ltd (2)". */
function uniqueRacmName(base: string): string {
  const taken = new Set(racmLibrary().map(r => r.name.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;
  return name;
}

export interface CreateRacmFlowProps {
  /** Set when the process is already decided (a Scope step row). */
  fixedProcess?: string;
  /** Pre-selected company — e.g. the in-scope company carrying most of the process. */
  defaultEntity?: string;
  /** Publish the rows as they are saved, instead of landing them as drafts.
   *
   *  Set only by the Scope step. Uploading a RACM *into* a scoping decision is
   *  itself the decision to use it — the auditor is standing in the engagement
   *  saying "this process is tested from this matrix". Landing it as a draft
   *  would make it vanish from the list it was uploaded into and send them to
   *  another tab to publish it. From the RACM tab, where the library is being
   *  built rather than used, publishing stays the separate deliberate step. */
  publishOnCreate?: boolean;
  onClose: () => void;
  /** The RACM was saved to the tab. */
  onCreated: (racm: LibraryRacm) => void;
}

export default function CreateRacmFlow({ fixedProcess, defaultEntity, publishOnCreate, onClose, onCreated }: CreateRacmFlowProps) {
  const { currentUser } = useCurrentUser();
  const logEvent = useAuditLog();
  const groups = useMemo(() => knownCompanies(), []);
  const firstCompany = groups[0]?.companies[0] ?? '';

  const [entityChoice, setEntityChoice] = useState(() => defaultEntity ?? firstCompany ?? NEW_OPTION);
  const [typedEntity, setTypedEntity] = useState('');
  const [processChoice, setProcessChoice] = useState(fixedProcess ?? SOX_RACM_PROCESSES[0]!);
  const [typedProcess, setTypedProcess] = useState('');
  const [picked, setPicked] = useState<{ mode: 'racm' | 'sop'; file: File } | null>(null);

  const entity = entityChoice === NEW_OPTION ? typedEntity.trim() : entityChoice;
  const process = fixedProcess ?? (processChoice === NEW_OPTION ? typedProcess.trim() : processChoice);
  const ready = !!entity && !!process;
  const sameProcess = useMemo(() => racmLibrary().filter(r => r.process.toLowerCase() === process.toLowerCase()).length, [process]);

  const racmInput = useRef<HTMLInputElement>(null);
  const sopInput = useRef<HTMLInputElement>(null);
  const onFile = (mode: 'racm' | 'sop') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setPicked({ mode, file });
  };

  useEffect(() => {
    if (picked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, picked]);

  const save = (controls: Control[], meta: RacmImportMeta) => {
    const racm = addLibraryRacm({
      name: uniqueRacmName(`${process} — ${entity}`),
      process,
      entity,
      source: meta.source,
      fileName: meta.fileName,
      ...(meta.url ? { sopUrl: meta.url } : {}),
      controls,
      createdBy: currentUser?.name ?? 'You',
      ...(publishOnCreate
        ? { published: controls.map(c => c.id), publishedAt: 'just now', publishedBy: currentUser?.name ?? 'You' }
        : {}),
    });
    logEvent({
      action: meta.source === 'sop' ? 'Create' : 'Upload',
      description: `${meta.source === 'sop' ? 'Extracted' : meta.fromTemplate ? 'Created from the template' : 'Imported'} "${racm.name}" on the RACM tab — ${controls.length} control${controls.length === 1 ? '' : 's'} from "${meta.fileName}"`,
      module: 'SOX ICFR',
      entity: 'RACM',
    });
    onCreated(racm);
  };

  if (picked) {
    return (
      <RacmImportReview mode={picked.mode} file={picked.file} process={process} entity={entity}
        existing={racmLibrary().flatMap(r => r.controls)}
        onClose={onClose} onImport={save} />
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-racm-title">
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="create-racm-title" className="text-[15px] font-semibold text-ink-900">{fixedProcess ? `Upload a RACM for ${fixedProcess}` : 'Create RACM'}</h2>
              <p className="text-[12.5px] text-ink-500 mt-0.5">Start from an existing matrix, or extract one from an SOP. It's saved to the RACM tab.</p>
            </div>
            <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Close"><X size={15} /></button>
          </div>
        </div>
        <div className="p-5">
          <label htmlFor="create-racm-entity" className={labelCls}>Entity</label>
          <select id="create-racm-entity" value={entityChoice} onChange={e => setEntityChoice(e.target.value)} className={`${fieldCls} cursor-pointer`}>
            {groups.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.companies.map(c => <option key={`${g.group}-${c}`} value={c}>{c}</option>)}
              </optgroup>
            ))}
            {defaultEntity && !groups.some(g => g.companies.includes(defaultEntity)) && <option value={defaultEntity}>{defaultEntity}</option>}
            <option value={NEW_OPTION}>＋ Type a new company…</option>
          </select>
          {entityChoice === NEW_OPTION && (
            <input value={typedEntity} onChange={e => setTypedEntity(e.target.value)} autoFocus
              placeholder="e.g. Altura Hydro Pvt Ltd" aria-label="New company name" className={`${fieldCls} mt-2 placeholder:text-ink-400`} />
          )}
          <p className="text-[11.5px] text-ink-400 mt-1.5 mb-4">The company the matrix is tested at. A file with its own entity column sets it row by row.</p>

          {!fixedProcess && (
            <>
              <label htmlFor="create-racm-process" className={labelCls}>Business process</label>
              <select id="create-racm-process" value={processChoice} onChange={e => setProcessChoice(e.target.value)} className={`${fieldCls} cursor-pointer`}>
                {SOX_RACM_PROCESSES.map(p => <option key={p} value={p}>{p}</option>)}
                <option value={NEW_OPTION}>＋ Name another process…</option>
              </select>
              {processChoice === NEW_OPTION && (
                <input value={typedProcess} onChange={e => setTypedProcess(e.target.value)} autoFocus
                  placeholder="e.g. Leases" aria-label="New process name" className={`${fieldCls} mt-2 placeholder:text-ink-400`} />
              )}
              <p className="text-[11.5px] text-ink-400 mt-1.5">
                {sameProcess > 0
                  ? `${process} already has ${sameProcess} RACM${sameProcess === 1 ? '' : 's'} on the tab — this one is added beside ${sameProcess === 1 ? 'it' : 'them'}.`
                  : 'A process can have several RACMs.'}
              </p>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button onClick={() => racmInput.current?.click()} disabled={!ready} className={cardCls}>
              <span className="p-2 rounded-lg bg-evidence-50 inline-flex mb-2.5"><FileUp size={15} className="text-evidence-700" /></span>
              <span className="block text-[13px] font-semibold text-ink-900 mb-1">Upload a RACM</span>
              <span className="block text-[11.5px] text-ink-500 leading-relaxed">Import an existing matrix (.xlsx / .csv).</span>
            </button>
            <button onClick={() => sopInput.current?.click()} disabled={!ready} className={cardCls}>
              <span className="p-2 rounded-lg bg-brand-50 inline-flex mb-2.5"><Sparkles size={15} className="text-brand-600" /></span>
              <span className="block text-[13px] font-semibold text-ink-900 mb-1">Upload an SOP <span className="text-ink-400">→</span> extract</span>
              <span className="block text-[11.5px] text-ink-500 leading-relaxed">Ira reads a procedure (.pdf / .docx) and drafts the RACM.</span>
            </button>
          </div>
          <input ref={racmInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile('racm')} aria-label="Upload a RACM workbook" />
          <input ref={sopInput} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onFile('sop')} aria-label="Upload an SOP to extract a RACM from" />
        </div>
      </div>
    </div>
  );
}
