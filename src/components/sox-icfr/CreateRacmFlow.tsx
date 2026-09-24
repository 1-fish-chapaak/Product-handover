/**
 * Create RACM, for the RACM tab on the Engagements page (S11).
 *
 *   file (RACM or SOP) → where it belongs (entity · process) → import review → saved to the tab
 *
 * The file comes first (23 Sep). It used to be the other way round — two
 * dropdowns, then the upload — which asked the auditor to declare what the
 * matrix was before anyone had seen it, and answered nothing the file itself
 * couldn't answer better. With the file in hand Ira reads the entity off its
 * own entity column and the process off its name, so the second screen is
 * usually a confirmation rather than a question.
 *
 * Entity still has to be settled before the import wizard opens: it decides
 * which client group's column set-up the headers are matched against.
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
import { ArrowLeft, FileText, FileUp, Sparkles, X } from 'lucide-react';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useAuditLog } from '../../context/AdminDataContext';
import { FormSelect, type SelectOption } from '../shared/FilterSelect';
import RacmImportReview, { type RacmImportMeta } from './RacmImportReview';
import { guessHeaderRow, matchColumns, readRacmWorkbook } from './racmImport';
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
const cardCls = 'text-left rounded-xl border border-canvas-border p-4 transition-colors cursor-pointer hover:border-brand-300 hover:bg-brand-50/40';
const ghostBtn = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 hover:bg-canvas-subtle cursor-pointer';
const primaryBtn = 'inline-flex items-center gap-1.5 h-8 px-4 rounded-lg text-[0.78125rem] font-semibold bg-brand-600 text-white hover:bg-brand-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600';

/** A name nobody else on the tab has — "Treasury — Altura Solar Pvt Ltd (2)". */
function uniqueRacmName(base: string): string {
  const taken = new Set(racmLibrary().map(r => r.name.toLowerCase()));
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} (${n})`;
  return name;
}

// ── What Ira can tell from the file itself ──────────────────────────────────

/** The names clients actually give these processes in a file name. */
const PROCESS_ALIASES: [RegExp, string][] = [
  [/\bo2c\b|\border to cash\b|\brevenue\b/, 'Order to Cash'],
  [/\bp2p\b|\bprocure to pay\b|\bpurchase to pay\b/, 'Procure to Pay'],
  [/\br2r\b|\brecord to report\b|\bfinancial close\b/, 'Record to Report'],
  [/\bh2r\b|\bhire to retire\b|\bpayroll\b/, 'Payroll (Hire to Retire)'],
  [/\bitgc\b|\bit general control/, 'IT General Controls'],
  [/\binventor(y|ies)\b/, 'Inventory'],
  [/\bfixed assets?\b/, 'Fixed Assets'],
  [/\btreasury\b/, 'Treasury'],
  [/\btax\b/, 'Tax'],
];

/** Punctuation, case and separators thrown away — "Altura-O2C_v3" reads the
 *  same as "altura o2c v3", which is what matching a file name needs. */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The one company this text names, or nothing. A partial hit only counts when
 *  a single company fits: "Altura" belongs to four of them, and picking between
 *  siblings on a coin toss is worse than leaving the box empty. */
function companyIn(text: string, companies: string[]): string | undefined {
  const t = squash(text);
  if (!t) return undefined;
  const exact = companies.find(c => squash(c) === t);
  if (exact) return exact;
  const inside = companies.filter(c => squash(c).length > 3 && t.includes(squash(c)));
  return inside.length === 1 ? inside[0] : undefined;
}

export type ReadFrom = 'column' | 'name';
export interface Placement {
  entity?: string; entityFrom?: ReadFrom;
  process?: string; processFrom?: ReadFrom;
}

/** Read the file for where it belongs. Never throws: a file Ira can't open just
 *  leaves the boxes empty, and the import wizard is the place that explains why
 *  a workbook couldn't be read — saying it twice, in a modal that can't offer
 *  the template either, would only be noise. */
export async function detectPlacement(mode: 'racm' | 'sop', file: File, companies: string[]): Promise<Placement> {
  const out: Placement = {};

  const name = squash(file.name);
  const alias = PROCESS_ALIASES.find(([re]) => re.test(name));
  if (alias) { out.process = alias[1]; out.processFrom = 'name'; }

  // An SOP is a procedure document — there is no entity column to read, so the
  // file name is all she has for it.
  if (mode === 'racm') {
    try {
      const sheets = await readRacmWorkbook(file);
      const rows = sheets[0]?.rows ?? [];
      const headerRow = guessHeaderRow(rows);
      const column = matchColumns(rows[headerRow] ?? []).find(m => m.field === 'entity')?.column;
      if (column != null) {
        for (const row of rows.slice(headerRow + 1)) {
          const hit = companyIn(row[column] ?? '', companies);
          if (hit) { out.entity = hit; out.entityFrom = 'column'; break; }
        }
      }
    } catch { /* unreadable here is not an error — see above */ }
  }
  if (!out.entity) {
    const hit = companyIn(file.name, companies);
    if (hit) { out.entity = hit; out.entityFrom = 'name'; }
  }
  return out;
}

/** Under a field Ira filled: where she read it, and the way back to blank. */
function ReadNote({ from, what, onPutBack }: { from: ReadFrom; what: string; onPutBack: () => void }) {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[0.6875rem] leading-snug text-ink-500">
      <Sparkles size={11} className="text-brand-600 shrink-0" aria-hidden />
      <span>Read by Ira from {from === 'column' ? "the file's Entity column" : 'the file name'}</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={onPutBack} aria-label={`Put back — clear Ira's ${what}`}
        className="font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer">Put back</button>
    </p>
  );
}

/** The box for naming one the list hasn't got, and the way back to the list.
 *  It stands in place of the dropdown rather than under it: a picker showing
 *  the same words being typed below it says the same thing twice. */
function NameIt({ value, onChange, what, placeholder, onBackToList }: {
  value: string; onChange: (v: string) => void; what: string; placeholder: string; onBackToList: () => void;
}) {
  return (
    <>
      <input value={value} onChange={e => onChange(e.target.value)} autoFocus
        placeholder={placeholder} aria-label={`New ${what} name`}
        className={`${fieldCls} placeholder:text-ink-400`} />
      <button type="button" onClick={onBackToList}
        className="mt-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer">
        <ArrowLeft size={11} aria-hidden /> Pick from the list instead
      </button>
    </>
  );
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
  const allCompanies = useMemo(() => groups.flatMap(g => g.companies), [groups]);

  const [picked, setPicked] = useState<{ mode: 'racm' | 'sop'; file: File } | null>(null);
  /** Entity and process are settled — hand over to the import wizard. */
  const [confirmed, setConfirmed] = useState(false);

  // Nothing is chosen for anybody: a company named here is one Ira read off the
  // file or one the auditor picked, never whichever happened to sort first.
  const [entityChoice, setEntityChoice] = useState(defaultEntity ?? '');
  const [typedEntity, setTypedEntity] = useState('');
  const [processChoice, setProcessChoice] = useState(fixedProcess ?? '');
  const [typedProcess, setTypedProcess] = useState('');

  const [reading, setReading] = useState(false);
  const [readFrom, setReadFrom] = useState<{ entity?: ReadFrom; process?: ReadFrom }>({});

  // The companies, under their client group. A company typed here has no group
  // yet, so it carries its own heading rather than sitting silently at the end.
  const entityOptions = useMemo(() => {
    const list: SelectOption[] = groups.flatMap(g => g.companies.map(c => ({ value: c, label: c, group: g.group })));
    if (defaultEntity && !allCompanies.includes(defaultEntity)) list.push({ value: defaultEntity, label: defaultEntity, group: 'From the engagement' });
    return list;
  }, [groups, allCompanies, defaultEntity]);

  const processOptions = useMemo(() => SOX_RACM_PROCESSES.map(p => ({ value: p, label: p })), []);

  const entity = entityChoice === NEW_OPTION ? typedEntity.trim() : entityChoice;
  const process = fixedProcess ?? (processChoice === NEW_OPTION ? typedProcess.trim() : processChoice);
  const ready = !!entity && !!process;
  const sameProcess = useMemo(
    () => (process ? racmLibrary().filter(r => r.process.toLowerCase() === process.toLowerCase()).length : 0),
    [process],
  );

  const racmInput = useRef<HTMLInputElement>(null);
  const sopInput = useRef<HTMLInputElement>(null);
  /** The file a read belongs to. A second pick while the first is still being
   *  read must not have the first one's answers land on top of it. */
  const readToken = useRef(0);

  const onFile = (mode: 'racm' | 'sop') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const token = ++readToken.current;
    setPicked({ mode, file });
    setReadFrom({});
    setReading(true);
    const found = await detectPlacement(mode, file, allCompanies);
    if (token !== readToken.current) return;
    setReading(false);
    // What the caller already knows beats what Ira reads: a Scope step row has
    // been told the process by the engagement it sits in.
    if (!defaultEntity && found.entity) { setEntityChoice(found.entity); setReadFrom(p => ({ ...p, entity: found.entityFrom })); }
    if (!fixedProcess && found.process) { setProcessChoice(found.process); setReadFrom(p => ({ ...p, process: found.processFrom })); }
  };

  const startOver = () => { readToken.current++; setPicked(null); setReading(false); setReadFrom({}); };

  useEffect(() => {
    if (confirmed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, confirmed]);

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

  if (picked && confirmed) {
    return (
      <RacmImportReview mode={picked.mode} file={picked.file} process={process} entity={entity}
        existing={racmLibrary().flatMap(r => r.controls)}
        onClose={onClose} onImport={save} />
    );
  }

  const noun = picked?.mode === 'sop' ? 'procedure' : 'matrix';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="create-racm-title">
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="create-racm-title" className="text-[15px] font-semibold text-ink-900">{fixedProcess ? `Upload a RACM for ${fixedProcess}` : 'Create RACM'}</h2>
              <p className="text-[12.5px] text-ink-500 mt-0.5">
                {picked
                  ? `Where does this ${noun} belong?`
                  : "Start from an existing matrix, or extract one from an SOP. It's saved to the RACM tab."}
              </p>
            </div>
            <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        {/* ── The file first ─────────────────────────────────────────────── */}
        {!picked && (
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => racmInput.current?.click()} className={cardCls}>
                <span className="p-2 rounded-lg bg-evidence-50 inline-flex mb-2.5"><FileUp size={15} className="text-evidence-700" /></span>
                <span className="block text-[13px] font-semibold text-ink-900 mb-1">Upload a RACM</span>
                <span className="block text-[11.5px] text-ink-500 leading-relaxed">Import an existing matrix (.xlsx / .csv).</span>
              </button>
              <button onClick={() => sopInput.current?.click()} className={cardCls}>
                <span className="p-2 rounded-lg bg-brand-50 inline-flex mb-2.5"><Sparkles size={15} className="text-brand-600" /></span>
                <span className="block text-[13px] font-semibold text-ink-900 mb-1">Upload an SOP <span className="text-ink-400">→</span> extract</span>
                <span className="block text-[11.5px] text-ink-500 leading-relaxed">Ira reads a procedure (.pdf / .docx) and drafts the RACM.</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Then where it belongs ──────────────────────────────────────── */}
        {picked && (
          <div className="p-5">
            <div className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-paper-50 px-3 py-2.5 mb-4">
              <FileText size={15} className="text-ink-400 shrink-0" aria-hidden />
              <span className="text-[0.78125rem] text-ink-800 truncate flex-1" title={picked.file.name}>{picked.file.name}</span>
              <button type="button" onClick={startOver}
                className="text-[0.6875rem] font-semibold text-brand-700 hover:text-brand-800 hover:underline cursor-pointer shrink-0">Change</button>
            </div>

            <span id="create-racm-entity" className={labelCls}>Entity</span>
            {entityChoice === NEW_OPTION ? (
              <NameIt value={typedEntity} onChange={setTypedEntity} what="company"
                placeholder="e.g. Altura Hydro Pvt Ltd" onBackToList={() => { setTypedEntity(''); setEntityChoice(''); }} />
            ) : (
              <FormSelect
                value={entityChoice}
                options={entityOptions}
                onChange={v => { setEntityChoice(v); setReadFrom(p => ({ ...p, entity: undefined })); }}
                className={`${fieldCls} h-9`}
                ariaLabel="Entity"
                portal
                placeholder={reading ? 'Reading the file…' : 'Choose the company…'}
                searchPlaceholder="Search companies"
                action={{ label: 'Add a company', onClick: () => { setEntityChoice(NEW_OPTION); setReadFrom(p => ({ ...p, entity: undefined })); } }}
              />
            )}
            {readFrom.entity
              ? <ReadNote from={readFrom.entity} what="entity" onPutBack={() => { setEntityChoice(''); setReadFrom(p => ({ ...p, entity: undefined })); }} />
              : <p className="text-[11.5px] text-ink-400 mt-1.5">The company the matrix is tested at. A file with its own entity column sets it row by row.</p>}

            {!fixedProcess && (
              <div className="mt-4">
                <span id="create-racm-process" className={labelCls}>Business process</span>
                {processChoice === NEW_OPTION ? (
                  <NameIt value={typedProcess} onChange={setTypedProcess} what="process"
                    placeholder="e.g. Leases" onBackToList={() => { setTypedProcess(''); setProcessChoice(''); }} />
                ) : (
                  <FormSelect
                    value={processChoice}
                    options={processOptions}
                    onChange={v => { setProcessChoice(v); setReadFrom(p => ({ ...p, process: undefined })); }}
                    className={`${fieldCls} h-9`}
                    ariaLabel="Business process"
                    portal
                    placeholder={reading ? 'Reading the file…' : 'Choose the process…'}
                    action={{ label: 'Add a process', onClick: () => { setProcessChoice(NEW_OPTION); setReadFrom(p => ({ ...p, process: undefined })); } }}
                  />
                )}
                {readFrom.process
                  ? <ReadNote from={readFrom.process} what="business process" onPutBack={() => { setProcessChoice(''); setReadFrom(p => ({ ...p, process: undefined })); }} />
                  : <p className="text-[11.5px] text-ink-400 mt-1.5">
                      {sameProcess > 0
                        ? `${process} already has ${sameProcess} RACM${sameProcess === 1 ? '' : 's'} on the tab — this one is added beside ${sameProcess === 1 ? 'it' : 'them'}.`
                        : 'A process can have several RACMs.'}
                    </p>}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={startOver} className={ghostBtn}><ArrowLeft size={13} /> Back</button>
              <button type="button" onClick={() => setConfirmed(true)} disabled={!ready} className={primaryBtn}>Continue</button>
            </div>
          </div>
        )}

        <input ref={racmInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile('racm')} aria-label="Upload a RACM workbook" />
        <input ref={sopInput} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={onFile('sop')} aria-label="Upload an SOP to extract a RACM from" />
      </div>
    </div>
  );
}
