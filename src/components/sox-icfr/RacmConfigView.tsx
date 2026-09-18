/**
 * Engagements → Config. What shape this team's RACM is.
 *
 * Three answers on one scroll, in the order the questions get asked during an
 * import: which columns a row cannot arrive without, which of the client's own
 * columns are carried even though nothing reads them, and what each heading was
 * taken to mean the last time the same workbook turned up.
 *
 * Everything here writes straight to the shared shape in `racmConfig`, which is
 * what the import review reads — so a change made on this screen is felt by the
 * very next upload, with nothing to save.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, History, Info, ListChecks, Plus, RotateCcw, Table2, X } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { RACM_FIELDS, type RacmFieldKey } from './racmImport';
import { DEFAULT_CORE, resetRacmConfig, setRacmConfig, useRacmConfig } from './racmConfig';

const FIELD_LABEL: Record<string, string> = Object.fromEntries(RACM_FIELDS.map(f => [f.key, f.label]));

/** The four the product has always insisted on. They are listed first because
 *  they are the ones nobody argues about — which leaves the rest of the list,
 *  where the real choices are, sitting together and easy to scan. */
const BACKBONE = RACM_FIELDS.filter(f => f.required);
const DISCRETIONARY = RACM_FIELDS.filter(f => !f.required);

const inputCls = 'w-full h-9 px-3 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas-elevated text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
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
function CoreRow({ label, on, disabled, onChange }: {
  label: string; on: boolean; disabled: boolean; onChange: (on: boolean) => void;
}) {
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

/**
 * The column list, split down the middle.
 *
 * Two stacked lists rather than one grid: `divide-y` rules between siblings and
 * not after the last one, so neither half doubles its hairline against the
 * panel's own border however many columns land in it.
 */
function FieldGrid({ fields, core, disabled, onToggle }: {
  fields: typeof RACM_FIELDS;
  core: Set<RacmFieldKey>;
  disabled: boolean;
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
            <CoreRow key={f.key} label={f.label} on={core.has(f.key)} disabled={disabled}
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
  const cfg = useRacmConfig();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [draftExtra, setDraftExtra] = useState('');
  const [confirming, setConfirming] = useState<'reset' | 'forget-all' | null>(null);

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
    setRacmConfig({ core: RACM_FIELDS.map(f => f.key).filter(k => wanted.has(k)) });
    logEvent({
      action: 'Update',
      description: `${FIELD_LABEL[key]} ${on ? 'is now required on every RACM row' : 'is no longer required on a RACM row'}`,
      module: 'SOX ICFR', entity: 'RACM',
    });
  };

  const addExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draftExtra.trim();
    if (!name) return;
    if (cfg.extras.some(x => x.toLowerCase() === name.toLowerCase())) {
      addToast({ type: 'warning', title: 'Already kept', message: `"${name}" is already on the list of columns carried through.` });
      return;
    }
    setRacmConfig({ extras: [...cfg.extras, name] });
    setDraftExtra('');
    logEvent({ action: 'Update', description: `Now keeping the client column "${name}" on RACM rows`, module: 'SOX ICFR', entity: 'RACM' });
  };

  const removeExtra = (name: string) => {
    setRacmConfig({ extras: cfg.extras.filter(x => x !== name) });
    logEvent({ action: 'Update', description: `Stopped keeping the client column "${name}" on RACM rows`, module: 'SOX ICFR', entity: 'RACM' });
  };

  const forgetHeading = (heading: string) => {
    const next = { ...cfg.mapping };
    delete next[heading];
    setRacmConfig({ mapping: next });
    logEvent({ action: 'Delete', description: `Forgot what the column heading "${heading}" was taken to mean`, module: 'SOX ICFR', entity: 'RACM' });
  };

  const confirmForgetAll = () => {
    const count = remembered.length;
    setConfirming(null);
    setRacmConfig({ mapping: {} });
    logEvent({ action: 'Delete', description: `Forgot ${count} remembered RACM column heading${count === 1 ? '' : 's'}`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'Headings forgotten', message: 'The next upload matches its columns from scratch.' });
  };

  const confirmReset = () => {
    setConfirming(null);
    resetRacmConfig();
    logEvent({ action: 'Update', description: 'Reset the RACM shape to the built-in columns', module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'Back to the built-in shape', message: 'Required columns, kept columns and remembered headings are all as they started.' });
  };

  const { Icon: SetUpIcon, text: setUpText } = cfg.configured
    ? cfg.sampleFileName
      ? { Icon: FileSpreadsheet, text: `Set up from ${cfg.sampleFileName}` }
      : { Icon: CheckCircle2, text: 'Set up by hand on this screen' }
    : { Icon: Info, text: 'Still the shape the product ships with — nobody has changed anything yet' };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.78125rem] text-ink-500 leading-relaxed max-w-[68ch]">
            Every client writes their matrix differently. This is where the team says what theirs looks like, so an
            upload lands the same way every month instead of being matched up by hand each time.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-600">
            <SetUpIcon size={13} className="text-ink-400 shrink-0" /> {setUpText}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setConfirming('reset')}
            disabled={!cfg.configured}
            title={cfg.configured ? 'Put every column back the way the product ships it' : 'Nothing has been changed, so there is nothing to put back'}
            className={`${outlineBtnCls} shrink-0`}
          >
            <RotateCcw size={13} /> Reset to the built-in shape
          </button>
        )}
      </div>

      {!canManage && (
        <p className="rounded-lg border border-canvas-border bg-paper-50 px-4 py-3 text-[0.75rem] text-ink-500 leading-relaxed">
          You can see how the team's matrix is shaped. Changing it is for whoever sets up engagements.
        </p>
      )}

      {/* ── 1 · what a row cannot arrive without ──────────────────────────── */}
      <Section
        icon={<ListChecks size={15} className="text-brand-600" />}
        title="Columns every row must have"
        blurb="Turn a column on and an upload holds back any row that leaves it blank — the person importing either fills it in there or leaves that row out. Everything switched off can arrive empty and be finished later."
        count={`${cfg.core.length} of ${RACM_FIELDS.length} on`}
      >
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">The backbone</p>
        <p className="text-[0.71875rem] text-ink-500 mb-2 leading-relaxed max-w-[62ch]">
          A row without these is hard to call a control at all, so they are almost always on — but a client whose
          file genuinely has no such column can switch one off rather than fail every upload.
        </p>
        <FieldGrid fields={BACKBONE} core={core} disabled={!canManage} onToggle={toggleCore} />

        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400 mt-5 mb-2">Everything else</p>
        <FieldGrid fields={DISCRETIONARY} core={core} disabled={!canManage} onToggle={toggleCore} />
      </Section>

      {/* ── 2 · the client's own columns ──────────────────────────────────── */}
      <Section
        icon={<Table2 size={15} className="text-brand-600" />}
        title="Columns kept from the client's file"
        blurb="A column the product has no field for is carried onto the row anyway — it shows on the matrix and comes back out in an export — but nothing in the product reads it or tests against it."
        count={cfg.extras.length ? `${cfg.extras.length} kept` : undefined}
      >
        {cfg.extras.length === 0 ? (
          <EmptyNote>
            Nothing kept yet. When a matrix arrives with a column the product has no field for — a cost centre, a COSO
            reference, the client's own review note — naming it here means its values ride along on every row instead
            of being dropped on the way in.
          </EmptyNote>
        ) : (
          <ul className="rounded-lg border border-canvas-border overflow-hidden">
            {cfg.extras.map(name => (
              <li key={name} className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-canvas-border last:border-b-0">
                <span className="font-mono text-[0.75rem] text-ink-700 truncate" title={name}>{name}</span>
                {canManage && (
                  <button type="button" onClick={() => removeExtra(name)} className={quietBtnCls}
                    aria-label={`Stop keeping the column "${name}"`} title={`Stop keeping "${name}"`}>
                    <X size={14} />
                  </button>
                )}
              </li>
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
            Nothing remembered yet. Once a matrix has been imported, every heading in it turns up here beside what it
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
                  {confirming === 'reset' ? 'Reset to the built-in shape?' : `Forget all ${remembered.length} headings?`}
                </h2>
                <button onClick={() => setConfirming(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              {confirming === 'reset' ? (
                <>
                  <p className="text-[0.78125rem] text-ink-600 leading-relaxed">
                    Required columns go back to the {DEFAULT_CORE.length} the product ships with
                    — {DEFAULT_CORE.map(k => FIELD_LABEL[k]).join(', ')}. Every column kept from the client's file and
                    every remembered heading is dropped.
                  </p>
                  <p className="mt-3 text-[0.75rem] text-ink-500 leading-relaxed">
                    RACMs already imported keep the columns they came in with. This only changes how the next upload is read.
                  </p>
                </>
              ) : (
                <p className="text-[0.78125rem] text-ink-600 leading-relaxed">
                  The next upload matches its columns from scratch, with nothing offered up front — including the
                  headings someone chose to leave out, which will be suggested again.
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
