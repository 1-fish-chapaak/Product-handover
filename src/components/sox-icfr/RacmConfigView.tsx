/**
 * RACM → Config. What shape a client's RACM is.
 *
 * Three answers on one scroll, in the order the questions get asked during an
 * import: which columns a row cannot arrive without, which of the client's own
 * columns are carried even though nothing reads them, and what each heading was
 * taken to mean the last time the same workbook turned up.
 *
 * ONE SET-UP PER CLIENT (22 Sep), so the screen opens with the question of whose
 * shape is being edited: Altura's columns are not the Airline group's. Nothing
 * here chooses which set-up an upload follows — the company picked at Create
 * RACM decides that — so the picker is only ever "whose columns am I looking at",
 * and it is not remembered between visits.
 *
 * Everything here writes straight to that client's shape in `racmConfig`, which
 * is what the import review reads — so a change made on this screen is felt by
 * the very next upload for them, with nothing to save.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, History, Info, ListChecks, Lock, Plus, RotateCcw, Table2, X } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { FormSelect } from '../shared/FilterSelect';
import { RACM_FIELDS, isAlwaysRequired, type RacmFieldKey } from './racmImport';
import { DEFAULT_CORE, extraLabel, racmConfig, resetRacmConfig, savedSetupKeys, setRacmConfig, useRacmConfig, type ExtraColumn, type ExtraKind } from './racmConfig';
import { knownCompanies } from './racmLibrary';

const FIELD_LABEL: Record<string, string> = Object.fromEntries(RACM_FIELDS.map(f => [f.key, f.label]));

/** The 22 Sep list — every control needs these, whatever the file carries, so
 *  they are shown locked rather than switchable. Listed first because nobody
 *  argues about them, which leaves the real choices sitting together below. */
const BACKBONE = RACM_FIELDS.filter(f => isAlwaysRequired(f.key));
const DISCRETIONARY = RACM_FIELDS.filter(f => !isAlwaysRequired(f.key));

/** What the picker calls a set-up. `default` is the one an upload falls back to
 *  when it names no company at all. */
const setupLabel = (key: string) => (key === 'default' ? 'All clients' : key);

/** "Altura Infra Group's" — a name that already ends in s takes the bare apostrophe. */
const possessive = (name: string) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

/**
 * Who can be picked: every client group the product knows, then any single
 * company with a set-up of its own because it belongs to no group yet.
 *
 * Read fresh on every render rather than memoised — the hint beside each name
 * says whether that client has been set up, and it has to be true the moment
 * this screen sets one up or puts one back.
 */
function setupOptions(selected: string): { value: string; label: string }[] {
  const groups = knownCompanies().map(g => g.group).sort((a, b) => a.localeCompare(b));
  const keys = groups.concat(savedSetupKeys().filter(k => !groups.includes(k)));
  // A set-up put back to the built-in shape drops out of the saved list, and
  // the person who did it is still standing on that client.
  if (!keys.includes(selected)) keys.push(selected);
  return keys.map(key => ({
    value: key,
    // The client on screen is named bare: the line beside the picker already
    // says its state in full ("Set up from altura-racm.xlsx"), and the picker
    // shows this label a second time when it is shut.
    label: key === selected ? setupLabel(key)
      : `${setupLabel(key)} · ${racmConfig(key).configured ? 'set up' : 'built-in'}`,
  }));
}

const inputCls = 'w-full h-9 px-3 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas-elevated text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
/** The client picker, wearing the same clothes as the inputs below it. */
const pickerCls = 'h-9 px-3 min-w-[15rem] max-w-[22rem] text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas-elevated text-ink-900 transition-colors';
const primaryBtnCls = 'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-brand-600';
const outlineBtnCls = 'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-brand-200 hover:bg-brand-50/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-canvas-elevated disabled:hover:text-ink-600';
const quietBtnCls = 'h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer';

function Section({ icon, title, blurb, count, action, children }: {
  icon: React.ReactNode;
  title: string;
  /** One line of plain English: what this part of the screen decides. */
  blurb: string;
  count?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-canvas-border bg-canvas-elevated p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5">{icon} {title}</h2>
          <p className="text-[0.71875rem] text-ink-500 mt-1 leading-relaxed max-w-[62ch]">{blurb}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {count && <span className="text-[0.71875rem] text-ink-500 tabular-nums whitespace-nowrap">{count}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Teaching copy where a list would be, rather than the word "None". */
function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-canvas-border bg-paper-50 px-4 py-3.5 text-[0.75rem] text-ink-500 leading-relaxed max-w-[70ch]">
      {children}
    </p>
  );
}

/**
 * One column and whether a row can arrive without it.
 *
 * The whole row is the switch — the label is the thing being toggled, so making
 * it part of the hit area costs nothing and saves aiming at a 34px track.
 */
function CoreRow({ label, on, disabled, locked = false, onChange }: {
  label: string; on: boolean; disabled: boolean; locked?: boolean; onChange: (on: boolean) => void;
}) {
  if (locked) {
    return (
      <div className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5">
        <span className="text-[0.8125rem] text-ink-900 font-medium">{label}</span>
        <span className="inline-flex items-center gap-1 text-[0.71875rem] text-ink-500" title="Every control needs this — it can't be switched off">
          <Lock size={11} className="text-ink-400" aria-hidden /> Always
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-paper-50 cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <span className={cn('text-[0.8125rem]', on ? 'text-ink-900 font-medium' : 'text-ink-600')}>{label}</span>
      <span aria-hidden className={cn('toggle block pointer-events-none', on && 'on', disabled && 'opacity-40')} />
    </button>
  );
}

const EXTRA_KINDS: { value: ExtraKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'A number' },
  { value: 'date', label: 'A date' },
  { value: 'yesno', label: 'Yes or no' },
  { value: 'list', label: 'One of a list' },
];

/**
 * One of the client's own columns: what we call it, what it holds, and whether a
 * row can arrive without it.
 *
 * The name box edits `label` and never `header`. The file's own spelling is what
 * the upload matches on, so it is shown underneath rather than made editable —
 * renaming the thing we show must not quietly stop the column being found.
 */
function ExtraRow({ column, disabled, onPatch, onRemove }: {
  column: ExtraColumn; disabled: boolean;
  onPatch: (patch: Partial<ExtraColumn>, note?: string) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(extraLabel(column));
  const [choices, setChoices] = useState((column.options ?? []).join(', '));

  // Written on leaving the box, not on every keystroke: the set-up is saved as
  // it is typed, and re-saving per character would log a line per character too.
  const commitName = () => {
    const next = name.trim();
    if (next === extraLabel(column)) return;
    if (!next) { setName(extraLabel(column)); return; }
    onPatch({ label: next === column.header ? undefined : next }, `Renamed the client column "${column.header}" to "${next}"`);
  };
  const commitChoices = () => {
    const options = choices.split(',').map(s => s.trim()).filter(Boolean);
    if (options.join('|') === (column.options ?? []).join('|')) return;
    onPatch({ options }, `Set the choices for the client column "${column.header}"`);
  };

  return (
    <li className="px-3.5 py-2.5 border-b border-canvas-border last:border-b-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <input
            value={name} disabled={disabled}
            onChange={e => setName(e.target.value)} onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            aria-label={`What to call the column "${column.header}"`}
            className={cn(inputCls, 'h-8')}
          />
          {extraLabel(column) !== column.header && (
            <p className="mt-1 font-mono text-[0.6875rem] text-ink-400 truncate" title={column.header}>
              {column.header} in the file
            </p>
          )}
        </div>
        {/* Read-only viewers get the answer, not a picker they can't use. */}
        {disabled ? (
          <span className="shrink-0 text-[0.75rem] text-ink-500 w-[9rem]">{EXTRA_KINDS.find(k => k.value === column.kind)?.label}</span>
        ) : (
          <FormSelect
            value={column.kind} onChange={v => onPatch({ kind: v as ExtraKind }, `Set what the client column "${column.header}" holds`)}
            className={cn(pickerCls, 'h-8 min-w-[9rem]')} ariaLabel={`What "${extraLabel(column)}" holds`}
            options={EXTRA_KINDS}
          />
        )}
        <button
          type="button" role="switch" aria-checked={column.required} disabled={disabled}
          onClick={() => onPatch({ required: !column.required }, `${column.required ? 'Stopped requiring' : 'Now requiring'} the client column "${column.header}" on every row`)}
          className="inline-flex items-center gap-2 px-2 h-8 rounded-lg text-[0.75rem] text-ink-600 hover:bg-paper-50 cursor-pointer disabled:cursor-not-allowed shrink-0"
          title={column.required ? 'A row cannot be imported with this blank' : 'A row can be imported with this blank'}
        >
          Required
          <span aria-hidden className={cn('toggle block pointer-events-none', column.required && 'on', disabled && 'opacity-40')} />
        </button>
        {!disabled && (
          <button type="button" onClick={onRemove} className={quietBtnCls}
            aria-label={`Stop keeping the column "${column.header}"`} title={`Stop keeping "${column.header}"`}>
            <X size={14} />
          </button>
        )}
      </div>
      {column.kind === 'list' && (
        <input
          value={choices} disabled={disabled}
          onChange={e => setChoices(e.target.value)} onBlur={commitChoices}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="The values it may hold, separated by commas"
          aria-label={`The values "${extraLabel(column)}" may hold`}
          className={cn(inputCls, 'h-8 mt-2')}
        />
      )}
    </li>
  );
}

/**
 * The column list, split down the middle.
 *
 * Two stacked lists rather than one grid: `divide-y` rules between siblings and
 * not after the last one, so neither half doubles its hairline against the
 * panel's own border however many columns land in it.
 */
function FieldGrid({ fields, core, disabled, locked = false, onToggle }: {
  fields: typeof RACM_FIELDS;
  core: Set<RacmFieldKey>;
  disabled: boolean;
  /** Shown as always on, with no switch — the 22 Sep list. */
  locked?: boolean;
  onToggle: (key: RacmFieldKey, on: boolean) => void;
}) {
  const half = Math.ceil(fields.length / 2);
  const columns = [fields.slice(0, half), fields.slice(half)];
  return (
    <div className="rounded-lg border border-canvas-border overflow-hidden grid sm:grid-cols-2">
      {columns.map((column, i) => (
        <div key={i} className={cn('divide-y divide-canvas-border',
          i === 0 ? 'sm:border-r sm:border-canvas-border' : 'border-t border-canvas-border sm:border-t-0')}>
          {column.map(f => (
            <CoreRow key={f.key} label={f.label} on={locked || core.has(f.key)} disabled={disabled} locked={locked}
              onChange={on => onToggle(f.key, on)} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function RacmConfigView({ canManage }: {
  /** Changing the shape — the same permission that creates engagements. */
  canManage: boolean;
}) {
  // Whose columns are on screen. Opens on the first client group the product
  // knows rather than on a "no client" shape, because every real upload keys on
  // a client — the built-in shape is what a client reads as before anyone has
  // touched it, not a thing to edit on its own.
  const [setupKey, setSetupKey] = useState(() => knownCompanies()[0]?.group ?? savedSetupKeys()[0] ?? 'default');
  const cfg = useRacmConfig(setupKey);
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [draftExtra, setDraftExtra] = useState('');
  const [confirming, setConfirming] = useState<'reset' | 'forget-all' | null>(null);

  const label = setupLabel(setupKey);
  const options = setupOptions(setupKey);

  const core = useMemo(() => new Set(cfg.core), [cfg.core]);
  /** Alphabetical, because a remembered heading is looked up by its spelling —
   *  the order the files happened to arrive in is no help at all. */
  const remembered = useMemo(
    () => Object.entries(cfg.mapping).sort(([a], [b]) => a.localeCompare(b)),
    [cfg.mapping],
  );

  const toggleCore = (key: RacmFieldKey, on: boolean) => {
    const wanted = new Set(core);
    if (on) wanted.add(key); else wanted.delete(key);
    // Stored in RACM_FIELDS order so the list reads the same here, in the import
    // review and in anything that spells the core columns out in a sentence.
    setRacmConfig(setupKey, { core: RACM_FIELDS.map(f => f.key).filter(k => wanted.has(k)) });
    logEvent({
      action: 'Update',
      description: `${FIELD_LABEL[key]} ${on ? 'is now required on every RACM row' : 'is no longer required on a RACM row'} for ${label}`,
      module: 'SOX ICFR', entity: 'RACM',
    });
  };

  const addExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draftExtra.trim();
    if (!name) return;
    if (cfg.extras.some(x => x.header.toLowerCase() === name.toLowerCase())) {
      addToast({ type: 'warning', title: 'Already kept', message: `"${name}" is already on the list of columns carried through for ${label}.` });
      return;
    }
    // Plain text, and not compulsory, until someone says otherwise: all the
    // file has told us is that the column exists.
    setRacmConfig(setupKey, { extras: [...cfg.extras, { header: name, kind: 'text', required: false }] });
    setDraftExtra('');
    logEvent({ action: 'Update', description: `Now keeping the client column "${name}" on RACM rows for ${label}`, module: 'SOX ICFR', entity: 'RACM' });
  };

  const removeExtra = (header: string) => {
    setRacmConfig(setupKey, { extras: cfg.extras.filter(x => x.header !== header) });
    logEvent({ action: 'Update', description: `Stopped keeping the client column "${header}" on RACM rows for ${label}`, module: 'SOX ICFR', entity: 'RACM' });
  };

  /** Change one of the client's columns in place. Keyed on the file's own
   *  heading, never on what we call it, so a rename can't lose the column. */
  const patchExtra = (header: string, patch: Partial<ExtraColumn>, note?: string) => {
    setRacmConfig(setupKey, { extras: cfg.extras.map(x => (x.header === header ? { ...x, ...patch } : x)) });
    if (note) logEvent({ action: 'Update', description: `${note} for ${label}`, module: 'SOX ICFR', entity: 'RACM' });
  };

  const forgetHeading = (heading: string) => {
    const next = { ...cfg.mapping };
    delete next[heading];
    setRacmConfig(setupKey, { mapping: next });
    logEvent({ action: 'Delete', description: `Forgot what the column heading "${heading}" was taken to mean for ${label}`, module: 'SOX ICFR', entity: 'RACM' });
  };

  const confirmForgetAll = () => {
    const count = remembered.length;
    setConfirming(null);
    setRacmConfig(setupKey, { mapping: {} });
    logEvent({ action: 'Delete', description: `Forgot ${count} remembered RACM column heading${count === 1 ? '' : 's'} for ${label}`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'Headings forgotten', message: `The next upload for ${label} matches its columns from scratch.` });
  };

  const confirmReset = () => {
    setConfirming(null);
    resetRacmConfig(setupKey);
    logEvent({ action: 'Update', description: `Reset the RACM shape for ${label} to the built-in columns`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'Back to the built-in shape', message: `Required columns, kept columns and remembered headings for ${label} are all as they started.` });
  };

  const { Icon: SetUpIcon, text: setUpText } = cfg.configured
    ? cfg.sampleFileName
      ? { Icon: FileSpreadsheet, text: `Set up from ${cfg.sampleFileName}` }
      : { Icon: CheckCircle2, text: 'Set up by hand on this screen' }
    : { Icon: Info, text: `Still the shape the product ships with — nothing set up for ${label} yet` };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.78125rem] text-ink-500 leading-relaxed max-w-[68ch]">
            Every client writes their matrix differently. {setupKey === 'default'
              ? 'This is the shape an upload falls back to when no company was named.'
              : `This is ${possessive(label)} shape: an upload for any of its companies lands this way.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[0.78125rem] font-semibold text-ink-700 whitespace-nowrap">Column set-up for:</span>
              <FormSelect
                value={setupKey}
                options={options}
                onChange={setSetupKey}
                className={pickerCls}
                ariaLabel="Column set-up for"
                menuCls="w-full min-w-[15rem]"
              />
            </div>
            <p className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-600">
              <SetUpIcon size={13} className="text-ink-400 shrink-0" /> {setUpText}
            </p>
          </div>
          <p className="mt-2 text-[0.71875rem] text-ink-400 leading-relaxed max-w-[68ch]">
            The company picked at Create RACM decides which set-up an upload follows — this tab only edits them.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setConfirming('reset')}
            disabled={!cfg.configured}
            title={cfg.configured ? `Put every column back the way the product ships it for ${label}` : `Nothing has been changed for ${label}, so there is nothing to put back`}
            className={`${outlineBtnCls} shrink-0`}
          >
            <RotateCcw size={13} /> Reset to the built-in shape
          </button>
        )}
      </div>

      {!canManage && (
        <p className="rounded-lg border border-canvas-border bg-paper-50 px-4 py-3 text-[0.75rem] text-ink-500 leading-relaxed">
          You can see how each client's matrix is shaped. Changing it is for whoever sets up engagements.
        </p>
      )}

      {/* ── 1 · what a row cannot arrive without ──────────────────────────── */}
      <Section
        icon={<ListChecks size={15} className="text-brand-600" />}
        title="Columns every row must have"
        blurb="An upload holds back any row that leaves a required column blank — the person importing either fills it in there or leaves that row out. Everything switched off can arrive empty and be finished later."
        count={`${cfg.core.length} of ${RACM_FIELDS.length} on`}
      >
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Always required</p>
        <p className="text-[0.71875rem] text-ink-500 mb-2 leading-relaxed max-w-[62ch]">
          Every control needs these, whatever the client's file carries. A file without one of them still uploads:
          Ira fills what she can read from the row, IDs are built, and the rest is filled in at Review.
        </p>
        <FieldGrid fields={BACKBONE} core={core} disabled={!canManage} locked onToggle={toggleCore} />

        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mt-5 mb-2">Everything else</p>
        <FieldGrid fields={DISCRETIONARY} core={core} disabled={!canManage} onToggle={toggleCore} />
      </Section>

      {/* ── 2 · the client's own columns ──────────────────────────────────── */}
      <Section
        icon={<Table2 size={15} className="text-brand-600" />}
        title="The client's own columns"
        blurb="A column the product has no field for is carried onto the row anyway — it shows on the matrix, in the spreadsheet editor and in an export. Say what it holds and the upload checks it; make it required and a row can't come in with it blank."
        count={cfg.extras.length ? `${cfg.extras.length} kept` : undefined}
      >
        {cfg.extras.length === 0 ? (
          <EmptyNote>
            Nothing kept for {label} yet. When a matrix arrives with a column the product has no field for — a cost centre, a COSO
            reference, the client's own review note — naming it here means its values ride along on every row instead
            of being dropped on the way in.
          </EmptyNote>
        ) : (
          <ul className="rounded-lg border border-canvas-border overflow-hidden">
            {cfg.extras.map(e => (
              <ExtraRow key={e.header} column={e} disabled={!canManage}
                onPatch={(patch, note) => patchExtra(e.header, patch, note)}
                onRemove={() => removeExtra(e.header)} />
            ))}
          </ul>
        )}

        {canManage && (
          <form onSubmit={addExtra} className="flex items-center gap-2 mt-3 max-w-[30rem]">
            <input
              value={draftExtra}
              onChange={e => setDraftExtra(e.target.value)}
              placeholder="Column heading, spelled as the file spells it"
              aria-label="Heading of a column to keep"
              className={inputCls}
            />
            <button type="submit" disabled={!draftExtra.trim()} className={`${primaryBtnCls} shrink-0`}>
              <Plus size={13} /> Keep it
            </button>
          </form>
        )}
      </Section>

      {/* ── 3 · what a heading meant last time ────────────────────────────── */}
      <Section
        icon={<History size={15} className="text-brand-600" />}
        title="What a heading meant last time"
        blurb="Matching a file's headings to fields is work, and the same workbook comes back every month. What each heading was taken to mean is remembered and offered first next time — including the ones deliberately left out."
        count={remembered.length ? `${remembered.length} remembered` : undefined}
        action={canManage && remembered.length > 0 ? (
          <button type="button" onClick={() => setConfirming('forget-all')} className={outlineBtnCls}>
            Forget all
          </button>
        ) : undefined}
      >
        {remembered.length === 0 ? (
          <EmptyNote>
            Nothing remembered for {label} yet. Once a matrix has been imported, every heading in it turns up here beside what it
            was read as — so the same file next month needs no matching at all, and a heading someone chose to ignore
            stays ignored instead of being suggested again.
          </EmptyNote>
        ) : (
          <>
            <div className="reg-wrap">
              <table className="w-full border-collapse" style={{ minWidth: 540 }}>
                <thead className="reg-head">
                  <tr>
                    <th>What the file said</th>
                    <th>What it was taken to mean</th>
                    {canManage && <th style={{ width: 56 }} aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {remembered.map(([heading, field]) => (
                    <tr key={heading} className="reg-row reg-static">
                      <td><span className="font-mono text-[0.75rem] text-ink-700">{heading}</span></td>
                      <td>
                        {field
                          ? <span className="text-[0.78125rem] text-ink-800">{FIELD_LABEL[field] ?? field}</span>
                          : <span className="text-[0.78125rem] text-ink-400">Left out</span>}
                      </td>
                      {canManage && (
                        <td>
                          <span className="flex justify-end">
                            <button type="button" onClick={() => forgetHeading(heading)} className={quietBtnCls}
                              aria-label={`Forget what "${heading}" meant`} title={`Forget what "${heading}" meant`}>
                              <X size={14} />
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Said once, here, because the simplified spelling in the left column
                is the first thing that looks wrong to someone who knows the file. */}
            <p className="mt-2.5 px-1 text-[0.6875rem] text-ink-400 leading-relaxed">
              Capitals and punctuation are ignored when a heading is matched, so headings are shown in their
              simplified spelling.
            </p>
          </>
        )}
      </Section>

      {confirming && (
        <div className="modal-backdrop" onClick={() => setConfirming(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="racm-config-confirm-title"
            onKeyDown={e => { if (e.key === 'Escape') setConfirming(null); }}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 id="racm-config-confirm-title" className="text-[0.9375rem] font-semibold text-ink-900">
                  {confirming === 'reset' ? `Reset ${label} to the built-in shape?` : `Forget all ${remembered.length} headings?`}
                </h2>
                <button onClick={() => setConfirming(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              {confirming === 'reset' ? (
                <>
                  <p className="text-[0.78125rem] text-ink-600 leading-relaxed">
                    Required columns for {label} go back to the {DEFAULT_CORE.length} the product ships with
                    — {DEFAULT_CORE.map(k => FIELD_LABEL[k]).join(', ')}. Every column kept from their file and
                    every remembered heading is dropped. No other client is touched.
                  </p>
                  <p className="mt-3 text-[0.75rem] text-ink-500 leading-relaxed">
                    RACMs already imported keep the columns they came in with. This only changes how the next upload
                    for {label} is read.
                  </p>
                </>
              ) : (
                <p className="text-[0.78125rem] text-ink-600 leading-relaxed">
                  The next upload for {label} matches its columns from scratch, with nothing offered up front —
                  including the headings someone chose to leave out, which will be suggested again.
                </p>
              )}
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setConfirming(null)} autoFocus className="h-9 px-3.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={confirming === 'reset' ? confirmReset : confirmForgetAll}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.78125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer">
                  {confirming === 'reset' ? <><RotateCcw size={13} /> Reset</> : 'Forget all'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
