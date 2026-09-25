/**
 * RACM import review — everything between choosing a file on the RACM tab and a
 * RACM appearing in its list. Nothing reaches the engagement until Import.
 *
 *   Upload a RACM (A5):  Columns (match the file's columns to our fields) → Review → Import
 *   Upload an SOP (A6):  Prompt (read it, edit it, validate it) → extraction → Review → Import
 *
 * An SOP produces more than a matrix (25 Sep): the same draft rows are read
 * back as a process NARRATIVE as well, on a toggle inside Review, and the
 * prompt on the step before drives both. A RACM workbook has no toggle — it
 * arrived as a matrix. `SopNarrativeView` renders it; `sopNarrative.ts` holds
 * the stage → risk → control spine it is built on.
 *
 * Review is the same screen for both, and it asks ONE question of every row:
 * does this control go into the RACM? The tick box is the answer, and it is the
 * only thing that decides — nothing else on the screen sets a row's fate.
 *
 * Everything a row still needs is stated in ONE box directly beneath it, never
 * scattered across its cells (24 Sep rework). There are two kinds of box:
 *
 *   `BlankFixRow`     the row can go in, but something is missing — a value the
 *                     file left blank, or a frequency. Fill it here, take Ira's
 *                     reading of it, or leave the row out.
 *   `DuplicateBand`   the row is a duplicate: every field in `DUPLICATE_FIELDS`
 *                     matches a control already on file, so it starts left out.
 *                     It prints both sides field by field, so the reason is read
 *                     rather than taken on trust (24 Sep: "specify a clear
 *                     reason why you are suggesting leaving the column out").
 *
 * Ira suggests missing attributes and design checks per row (A7) and fills what
 * she can read off a row's other columns, listed with her reasons (A9); merged
 * duplicate design checks are counted (R2). The reading and matching itself
 * lives in racmImport.ts; this file only decides what the reviewer sees and
 * when a value is written.
 */
import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, AlignLeft, ArrowLeft, Check, CheckCircle2, ChevronDown, ChevronRight, Circle, Copy, FileSpreadsheet, FileText, FileWarning,
  Loader2, Paperclip, RotateCcw, Search, Sparkles, Star, Table2, Undo2, Workflow, X,
} from 'lucide-react';
import SopNarrativeView from './SopNarrativeView';
import SopFlowchartView from './SopFlowchartView';
import { riskKeyOf } from './sopNarrative';
import { racmTemplateForProcesses } from './mockData';
import {
  CODE_OK, assignRacmIds, cleanCode, entityCodeTakenBy, peekEntityCode, peekProcessCode, processCodeTakenBy,
  setEntityCode, setProcessCode,
} from './racmIds';
import { useToast } from '../shared/Toast';
import { useAdminData, useAuditLog, type UserStatus } from '../../context/AdminDataContext';
import { Pill } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import { configureFromSample, rememberMapping, useRacmConfig } from './racmConfig';
import { racmSetupKeyFor } from './racmLibrary';
import { CONTROL_CLASSES, RISK_LIKELIHOODS, RISK_RATINGS, TESTING_STRATEGIES } from './types';
import type { Control, ControlType, Frequency, Nature } from './types';
import {
  RACM_FIELDS, DEFAULT_SOP_PROMPT, CORE_BLANK_LABEL, CORE_BLANK_ORDER, ASSERTION_ORDER,
  readRacmWorkbook, guessHeaderRow, matchColumns, needsAttention, normaliseHeader,
  buildImportRows, rowFromValues, proposeBlankFills, iraCanFill, suggestForRow, importRowsToControls, draftRowsFromSop,
  coreBlanks, extraBlanks, extraLabel, extraValue, rowBlocked, rowRepeats, setRowExtra, headerMapping,
  DUPLICATE_FIELDS, controlDuplicateValues, duplicateValues,
  type BlankFill, type ColumnMatch, type CoreBlank, type DuplicateValues, type ExtraColumn, type ImportRow,
  type RacmFieldKey, type SheetData,
} from './racmImport';

type Step = 'columns' | 'prompt' | 'review';

/** The three readings of one SOP draft (25 Sep). Same rows, same prompt behind
 *  all of them — a narrative to read, a flowchart to follow, a matrix to work
 *  on. Edit the prompt and all three change together, because none of them
 *  holds any data of its own. */
type ReviewView = 'narrative' | 'flowchart' | 'matrix';
const REVIEW_VIEWS: { key: ReviewView; label: string; Icon: typeof AlignLeft; hint: string }[] = [
  { key: 'narrative', label: 'Narrative', Icon: AlignLeft, hint: 'The process written out, stage by stage' },
  { key: 'flowchart', label: 'Flowchart', Icon: Workflow, hint: 'The risks mapped onto the process, with their controls' },
  { key: 'matrix', label: 'Matrix', Icon: Table2, hint: 'The rows, and what goes into the RACM' },
];

export interface RacmImportMeta {
  source: 'racm' | 'sop';
  fileName: string;
  /** The SOP, viewable for the session. */
  url?: string;
  /** True when the file had no rows and the process template was used instead. */
  fromTemplate?: boolean;
}

export interface RacmImportReviewProps {
  mode: 'racm' | 'sop';
  file: File;
  process: string;
  /** The company chosen in the Create RACM chooser — rows without an entity
   *  column take it. '' when none was chosen. */
  entity: string;
  /** The controls a new row is checked against for duplicates (A8) — every RACM
   *  on the RACM tab, or the engagement's own register. */
  existing: Control[];
  onClose: () => void;
  /** Import pressed: the rows as controls, IDs already ENTITY/PROCESS/R001/C001.
   *  The caller saves them (to the RACM tab, or the engagement). */
  onImport: (controls: Control[], meta: RacmImportMeta) => void;
}

const RACM_STEPS: { key: Step; label: string }[] = [{ key: 'columns', label: 'Columns' }, { key: 'review', label: 'Review' }];
const SOP_STEPS: { key: Step; label: string }[] = [{ key: 'prompt', label: 'Prompt' }, { key: 'review', label: 'Review' }];

/** Never "Continuous" — a control that runs all the time is tested at the
 *  frequency its evidence is produced at, so the reviewer picks that. */
const FREQUENCIES: Frequency[] = ['Annual', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Recurring', 'Ad-hoc'];

const NATURES: Nature[] = ['Manual', 'Automated', 'IT-dependent'];
const TYPES: ControlType[] = ['Preventive', 'Detective'];
/** What a client's own Yes / No column is answered with — words, so the value
 *  reads in the matrix the way their file writes it. */
const YES_NO = ['Yes', 'No'];

const EXTRACT_STEPS = ['Parsing the SOP', 'Identifying risks & control points', 'Mapping controls to risks', 'Drafting attributes & required files'];
const EXTRACT_STEP_MS = 400;
/** The header-row picker offers the first ten rows — a title block above the
 *  headers is common, ten rows of it is not. */
const HEADER_ROW_CHOICES = 10;
const MIN_PROMPT_CHARS = 40;

const FIELD_BY_KEY = new Map(RACM_FIELDS.map(f => [f.key, f]));
const fieldLabel = (k: RacmFieldKey) => FIELD_BY_KEY.get(k)?.label ?? k;
/** Title and activity stand in for each other: a matrix with either can import. */
const TITLE_PAIR: RacmFieldKey[] = ['controlTitle', 'controlActivity'];
/** Set once for every row at Review when the file has no column for them.
 *
 *  The process owner joined the other two on 24 Sep. An SOP names who performs
 *  a control but rarely who owns the process, so every row arrived asking for
 *  one — four identical boxes asking the same question four times, under a
 *  screen whose whole complaint was that too much was happening on it. One
 *  answer is right for all of them: this import IS one process. */
const PEOPLE_FIELDS: RacmFieldKey[] = ['riskOwner', 'owner', 'processOwner'];
/** Every field that names a person, so all three of them offer the same list. */
const ALL_PEOPLE_FIELDS: RacmFieldKey[] = ['riskOwner', 'owner', 'processOwner'];
const isPersonField = (field: RacmFieldKey): boolean => ALL_PEOPLE_FIELDS.includes(field);
/** A user who cannot sign in cannot own a control, so they are not offered —
 *  assigning one reads as an owner with nobody behind it. An invited user is
 *  offered: the invitation is out, and work is assigned ahead of acceptance all
 *  the time. */
const ASSIGNABLE: UserStatus[] = ['Active', 'Invited'];
/** What the file wrote, when it is not one of this tenant's users. Kept at the
 *  top of that row's list rather than dropped: the client named somebody for a
 *  reason, and a picker that cannot say what the matrix already says would make
 *  opening the row destroy the answer. */
const fromFileOption = (current: string, people: string[]): string[] =>
  current && !people.includes(current) ? [current] : [];

const labelCls = 'text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-1.5 block';
const selectCls = 'h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200';
const primaryBtn = 'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';
const secondaryBtn = 'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer';
const quietBtn = 'h-7 px-2 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

/**
 * Which column in the file, picked by name.
 *
 * A native <select> was fine when a RACM had a dozen columns. The matrices that
 * actually arrive carry forty or more — S.No. through Sign-off Date — and
 * finding "Control Frequency" in that list meant scrolling a list rendered by
 * the operating system, which cannot be searched and cannot be told apart from
 * the forty around it (user ask, 22 Sep).
 *
 * So it is a combobox: type a few letters, press Enter. Deliberately small —
 * no virtualisation, no fuzzy matching. It is one substring test against the
 * headers of one spreadsheet, and a menu that can be read.
 *
 * The menu is portalled to the body and positioned fixed, which is not
 * decoration: the picker sits in a cell of `.reg-wrap`, and that wrapper is
 * `overflow-x: auto; overflow-y: hidden` (register.css) — enough to clip an
 * absolutely-positioned menu down to a sliver. Anything drawn inside the table
 * is at the mercy of that clip, so the menu leaves the table.
 */
function ColumnPicker({ id, label, value, options, onPick }: {
  id: string;
  label: string;
  /** The chosen column index, or null for "not in this file". */
  value: number | null;
  options: { i: number; label: string }[];
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  /** Where the menu sits this frame, in viewport coordinates. */
  const [at, setAt] = useState<{ left: number; width: number; y: number; up: boolean; listMax: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  /** Focus on mount, not from the open effect: the menu is portalled, so it has
   *  not rendered yet when that effect runs and the ref is still null there. */
  const mountSearch = useCallback((el: HTMLInputElement | null) => { search.current = el; el?.focus(); }, []);

  useEffect(() => {
    if (!open) { setAt(null); return; }
    // The pane the trigger scrolls inside — the modal's body, since `.reg-wrap`
    // is `overflow-y: hidden` and so is not a scroller.
    let pane: HTMLElement | null = null;
    for (let n = box.current?.parentElement ?? null; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if (o === 'auto' || o === 'scroll') { pane = n; break; }
    }
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      // Scroll the trigger out of its pane and the menu would hang there
      // anchored to nothing. Close it instead.
      const clip = pane?.getBoundingClientRect();
      if (clip && (r.bottom < clip.top || r.top > clip.bottom)) { setOpen(false); return; }
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      // Flip up only when below genuinely can't hold a usable menu and above can.
      const up = below < 160 && above > below;
      const room = (up ? above : below) - 32 /* the search row */ - 8;
      setAt({
        left: r.left, width: r.width, up,
        y: up ? window.innerHeight - r.top + 4 : r.bottom + 4,
        listMax: Math.max(96, Math.min(224, room)),
      });
    };
    place();
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    // Capture, so the modal's own scroller carries the menu along with its trigger.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', away);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter(o => o.label.toLowerCase().includes(t)) : options;
  }, [q, options]);

  const chosen = value === null ? null : options.find(o => o.i === value);
  const take = (v: string) => { onPick(v); setOpen(false); setQ(''); };

  return (
    <div ref={box} className="relative">
      <button id={id} type="button" aria-label={label} aria-expanded={open} aria-haspopup="listbox"
        onClick={() => setOpen(o => !o)}
        className={cn(selectCls, 'w-full h-8 text-[0.75rem] flex items-center justify-between gap-1.5 text-left', open && 'border-brand-400')}>
        <span className={cn('truncate', chosen ? 'text-ink-800' : 'text-ink-400')}>{chosen ? chosen.label : '— Not in file —'}</span>
        <ChevronDown size={13} className={cn('shrink-0 transition-transform', open ? 'text-brand-600 rotate-180' : 'text-ink-400')} />
      </button>
      {open && at && createPortal(
        <div ref={pop} style={{ left: at.left, width: at.width, [at.up ? 'bottom' : 'top']: at.y }}
          className="fixed z-[120] rounded-lg border border-canvas-border bg-canvas-elevated shadow-[0_12px_32px_-12px_rgba(15,8,30,0.28)] overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 h-8 border-b border-canvas-border">
            <Search size={12} className="shrink-0 text-ink-400" />
            <input ref={mountSearch} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setQ(''); }
                // Enter takes the only thing left, which is what typing three
                // letters into a list of forty is for.
                if (e.key === 'Enter' && shown.length === 1) { e.preventDefault(); take(String(shown[0].i)); }
              }}
              placeholder="Search the file’s columns…" aria-label={`Search columns for ${label}`}
              className="min-w-0 flex-1 bg-transparent border-none outline-none text-[0.75rem] text-ink-800 placeholder:text-ink-400" />
            {q && <button type="button" onClick={() => { setQ(''); search.current?.focus(); }} aria-label="Clear the search"
              className="shrink-0 text-ink-400 hover:text-ink-700 cursor-pointer"><X size={11} /></button>}
          </div>
          <div role="listbox" style={{ maxHeight: at.listMax }} className="overflow-y-auto py-1">
            {/* Always offered, and never filtered away: "not in this file" is an
                answer, not a column, so searching for one must not hide it. */}
            <button type="button" role="option" aria-selected={value === null} onClick={() => take('')}
              className={cn('w-full text-left px-2.5 py-1.5 text-[0.75rem] flex items-center gap-1.5 cursor-pointer hover:bg-paper-50', value === null ? 'text-brand-700 font-semibold' : 'text-ink-500')}>
              {value === null ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
              — Not in file —
            </button>
            {shown.map(o => (
              <button key={o.i} type="button" role="option" aria-selected={value === o.i} onClick={() => take(String(o.i))}
                className={cn('w-full text-left px-2.5 py-1.5 text-[0.75rem] flex items-center gap-1.5 cursor-pointer hover:bg-paper-50', value === o.i ? 'text-brand-700 font-semibold' : 'text-ink-700')}>
                {value === o.i ? <Check size={11} className="shrink-0" /> : <span className="w-[11px] shrink-0" />}
                <span className="truncate">{o.label}</span>
              </button>
            ))}
            {shown.length === 0 && <p className="px-2.5 py-2 text-[0.71875rem] text-ink-400">No column in this file matches that.</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The register keeps names lower-cased; say them the way people write them. */
const titleCase = (s: string) => s.replace(/\b\w/g, ch => ch.toUpperCase());
const cell = (c: string | undefined) => String(c ?? '').trim();
const isBlankRow = (r: string[] | undefined) => !r || r.every(c => !cell(c));
const firstDataRow = (rows: string[][], headerRow: number) => rows.slice(headerRow + 1).find(r => !isBlankRow(r));

/** A, B … Z, AA — how a spreadsheet names a column with no header in it. */
function colLetter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** The first few cells of a row — enough to recognise the header row by. */
function rowPreview(r: string[] | undefined): string {
  const s = (r ?? []).map(cell).filter(Boolean).slice(0, 3).join(' · ');
  if (!s) return '(blank row)';
  return s.length > 64 ? `${s.slice(0, 63)}…` : s;
}

const idOf = (row: ImportRow) => cell(row.values.controlId) || '—';
const titleOf = (row: ImportRow) => cell(row.values.controlTitle) || cell(cell(row.values.controlActivity).split('\n')[0]) || '—';

function frequencyNote(row: ImportRow): string {
  if (row.frequencyFlag === 'continuous') return "Continuous isn't a control frequency — pick one";
  if (row.frequencyFlag === 'unreadable') return `"${cell(row.values.frequency)}" isn't a frequency we know — pick one`;
  return 'Blank in the file — pick one';
}

/** Suggestions a reviewer accepted, per row. Held apart from the row itself
 *  because a fill or a frequency pick rebuilds the row from its cell values
 *  (rowFromValues), which would otherwise drop them. */
interface Accepted { attributes: string[]; designChecks: string[] }
interface Suggestion { id: string; kind: 'attribute' | 'check'; text: string }

const norm = (s: string) => s.trim().toLowerCase();
function withAccepted(row: ImportRow, extra: Accepted | undefined): ImportRow {
  if (!extra) return row;
  const haveA = new Set(row.attributes.map(a => norm(a.text)));
  const haveC = new Set(row.designChecks.map(norm));
  return {
    ...row,
    attributes: [...row.attributes, ...extra.attributes.filter(t => !haveA.has(norm(t))).map(text => ({ text, requiredFiles: [] }))],
    designChecks: [...row.designChecks, ...extra.designChecks.filter(t => !haveC.has(norm(t)))],
  };
}

/** The field a core blank is written into. */
const BLANK_FIELD: Record<CoreBlank, RacmFieldKey> = {
  riskTitle: 'riskTitle', riskDescription: 'riskDescription', riskOwner: 'riskOwner',
  controlTitle: 'controlTitle', controlActivity: 'controlActivity', owner: 'owner',
  nature: 'nature', type: 'type', assertions: 'assertions', designChecks: 'designChecks', attributes: 'attributes',
  objective: 'objective', subProcess: 'subProcess', riskCategory: 'riskCategory', riskRating: 'riskRating', likelihood: 'likelihood',
  processOwner: 'processOwner', controlEvidence: 'controlEvidence', sopSectionRef: 'sopSectionRef',
  effectiveDate: 'effectiveDate', country: 'country', testingStrategy: 'testingStrategy',
};
const BLANK_TITLE: Record<CoreBlank, string> = {
  riskTitle: 'Risk title', riskDescription: 'Risk description', riskOwner: 'Risk owner',
  controlTitle: 'Control title', controlActivity: 'Control description', owner: 'Control owner',
  nature: 'Nature', type: 'Type', assertions: 'Assertions', designChecks: 'Design checks', attributes: 'Attributes',
  objective: 'Objective', subProcess: 'Sub-process', riskCategory: 'Risk category', riskRating: 'Risk rating', likelihood: 'Likelihood',
  processOwner: 'Process owner', controlEvidence: 'Control evidence', sopSectionRef: 'SOP section',
  effectiveDate: 'Effective date', country: 'Country', testingStrategy: 'Testing strategy',
};
const BLANK_PLACEHOLDER: Partial<Record<CoreBlank, string>> = {
  riskTitle: 'A few words naming the risk', riskDescription: 'What could go wrong', riskOwner: 'Who is accountable for the risk',
  controlTitle: 'One line — what the control is', controlActivity: 'What is done, by whom and how often', owner: 'Who performs the control',
  designChecks: 'One design check per line', attributes: 'One attribute per line',
  objective: 'What the control is there to achieve', subProcess: 'e.g. Vendor master maintenance',
  processOwner: 'Who runs the process day to day', controlEvidence: 'One document per line',
  sopSectionRef: 'e.g. § 4.2', country: 'e.g. India',
};
/** Written in a box that grows, one item per line where it is a list. */
const MULTILINE_BLANKS: CoreBlank[] = ['controlActivity', 'designChecks', 'attributes', 'objective', 'controlEvidence'];
/** Blanks answered from a list rather than typed. */
const BLANK_OPTIONS: Partial<Record<CoreBlank, readonly string[]>> = {
  nature: NATURES, type: TYPES, riskCategory: CONTROL_CLASSES, riskRating: RISK_RATINGS, likelihood: RISK_LIKELIHOODS, testingStrategy: TESTING_STRATEGIES,
};

/**
 * The values a row can't be imported without, asked for right under it (17 Sep
 * dev call). Each blank takes a typed value or Ira's suggestion — read off the
 * row's other cells, never a bare default — and the whole row can be left out
 * instead. A text value is written when the box loses focus (or on Enter), so
 * the row isn't rebuilt under the cursor.
 *
 * The client's own required columns are asked for underneath ours, in the same
 * boxes (22 Sep). Ira offers nothing beside them: a column that isn't ours has
 * no meaning she can read off the rest of the row.
 */
function BlankFixRow({ row, blanks, clientBlanks, fills, needsFrequency, frequencyNote: freqNote, frequencyIdea, attributeIdeas, checkIdeas, colSpan, people, onSet, onSetExtra, onLeaveOut }: {
  row: ImportRow;
  blanks: CoreBlank[];
  /** This client's own required columns the row left blank, written by header. */
  clientBlanks: ExtraColumn[];
  fills: BlankFill[];
  /** A frequency is required of every control (22 Sep) but is not a `CoreBlank`,
   *  so it is passed in beside them. It used to be asked for out in the
   *  Frequency column while the rest of the row's gaps were asked for here —
   *  the same question in two places, in two shapes. It is asked here now. */
  needsFrequency: boolean;
  /** Why this row has no frequency: blank, unreadable, or "Continuous". */
  frequencyNote: string;
  /** What Ira read the frequency as, if she could read one. */
  frequencyIdea?: string;
  attributeIdeas: string[];
  /** Ira's design checks for this row — offered when the row has none left. */
  checkIdeas: string[];
  colSpan: number;
  /** The tenant's assignable users — an owner blank is picked, never typed. */
  people: string[];
  onSet: (field: RacmFieldKey, value: string) => void;
  onSetExtra: (header: string, value: string) => void;
  /** Same state the row's tick box sets — offered here because this is where
   *  the reader learns the row cannot go in as it stands. */
  onLeaveOut: () => void;
}) {
  const [drafts, setDrafts] = useState<Partial<Record<CoreBlank, string>>>({});
  /** Kept apart from `drafts` because a client's header is their own spelling —
   *  nothing stops one reading as the name of a field of ours. */
  const [extraDrafts, setExtraDrafts] = useState<Record<string, string>>({});
  const [pickedAssertions, setPickedAssertions] = useState<string[]>([]);
  const commit = (b: CoreBlank) => {
    const v = (drafts[b] ?? '').trim();
    if (v) onSet(BLANK_FIELD[b], v);
  };
  const commitExtra = (e: ExtraColumn) => {
    const v = (extraDrafts[e.header] ?? '').trim();
    if (v) onSetExtra(e.header, v);
  };
  const ideaFor = (b: CoreBlank): { value: string; shown: string; reason: string } | null => {
    if (b === 'attributes' || b === 'designChecks') {
      const ideas = b === 'attributes' ? attributeIdeas : checkIdeas;
      return ideas.length
        ? { value: ideas.join('\n'), shown: ideas.join('; '), reason: 'read from the control description' }
        : null;
    }
    const f = fills.find(x => x.field === BLANK_FIELD[b]);
    return f ? { value: f.value, shown: f.value, reason: f.reason } : null;
  };
  const note = (b: CoreBlank) => {
    if (b === 'nature' && row.natureFlag === 'unreadable') return `"${cell(row.values.nature)}" isn't a nature we know — pick one`;
    if (b === 'type' && row.typeFlag === 'unreadable') return `"${cell(row.values.type)}" isn't a type we know — pick one`;
    if ((b === 'attributes' || b === 'designChecks') && !cell(row.values.controlActivity) && !cell(row.values.controlTitle)) {
      return 'Add a control description and Ira can suggest some';
    }
    return null;
  };
  /** No width here on purpose. `cn` only joins strings — it does not resolve
   *  Tailwind conflicts — so a `w-full` baked in beat every `w-48` added beside
   *  it, and a one-word Likelihood picker rendered as wide as the dialog. Each
   *  branch below states the width it wants. */
  const inputCls = 'h-8 px-2.5 rounded-lg border border-mitigated-300 bg-canvas-elevated text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200';
  /** Everything this box is asking for, counted once — the heading says how much
   *  work this row is, which is the thing a reviewer is deciding about. */
  const gaps = blanks.length + clientBlanks.length + (needsFrequency ? 1 : 0);
  return (
    <tr className="def-detail">
      <td colSpan={colSpan}>
        <div className="my-2 rounded-lg border border-canvas-border bg-paper-50/60 px-3.5 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <AlertTriangle size={12} className="text-mitigated-700 shrink-0" aria-hidden />
            <p className="text-[0.71875rem] font-semibold text-mitigated-700">
              {gaps === 1 ? 'One value is missing' : `${gaps} values are missing`} — fill {gaps === 1 ? 'it' : 'them'} in to import this row
            </p>
            <div className="flex-1" />
            {/* The way out, said where the problem is said (user ask, 24 Sep).
                It sets the same one thing the row's tick box sets and says the
                same word it says — not a second concept, a second door. */}
            <button type="button" onClick={onLeaveOut} className={quietBtn}
              aria-label={`Leave row ${row.rowNo} out of the import`}>Leave out</button>
          </div>
          <div className="space-y-2.5">
            {needsFrequency && (
              <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 items-start">
                <label htmlFor={`racm-import-freq-${row.key}`} className="pt-1.5 text-[0.71875rem] font-semibold text-ink-600">Frequency</label>
                <div className="min-w-0">
                  <select id={`racm-import-freq-${row.key}`} value="" aria-describedby={`racm-import-freq-note-${row.key}`}
                    onChange={e => { if (e.target.value) onSet('frequency', e.target.value); }}
                    className={cn(inputCls, 'w-48 cursor-pointer')}>
                    <option value="" disabled>Pick a frequency</option>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <p id={`racm-import-freq-note-${row.key}`} className="mt-1 text-[0.65625rem] leading-snug text-mitigated-700">{freqNote}</p>
                  {frequencyIdea && (
                    <p className="mt-1 flex items-start gap-1.5 text-[0.6875rem] leading-snug text-ink-600">
                      <Sparkles size={11} className="text-brand-600 mt-0.5 shrink-0" aria-hidden />
                      <span className="min-w-0"><span className="font-semibold text-ink-800">Ira suggests:</span> {frequencyIdea}</span>
                      <button type="button" onClick={() => onSet('frequency', frequencyIdea)}
                        aria-label={`Use Ira's frequency (${frequencyIdea}) for row ${row.rowNo}`}
                        className="shrink-0 h-5 px-1.5 -my-0.5 rounded font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer">
                        Use
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}
            {blanks.map(b => {
              const id = `racm-import-fix-${row.key}-${b}`;
              const idea = ideaFor(b);
              const hint = note(b);
              return (
                <div key={b} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 items-start">
                  <label htmlFor={id} className="pt-1.5 text-[0.71875rem] font-semibold text-ink-600">{BLANK_TITLE[b]}</label>
                  <div className="min-w-0">
                    {/* A person is picked from the tenant's users, never typed —
                        same rule as the Set-for-all box above, so the two can
                        never disagree about who an owner may be. */}
                    {isPersonField(BLANK_FIELD[b]) ? (
                      <select id={id} value="" onChange={e => { if (e.target.value) onSet(BLANK_FIELD[b], e.target.value); }}
                        className={cn(inputCls, 'w-48 cursor-pointer')}>
                        <option value="" disabled>{`Pick a ${BLANK_TITLE[b].toLowerCase()}`}</option>
                        {people.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : BLANK_OPTIONS[b] ? (
                      <select id={id} value="" onChange={e => { if (e.target.value) onSet(BLANK_FIELD[b], e.target.value); }}
                        className={cn(inputCls, 'w-48 cursor-pointer')}>
                        <option value="" disabled>{`Pick a ${BLANK_TITLE[b].toLowerCase()}`}</option>
                        {BLANK_OPTIONS[b]!.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : b === 'effectiveDate' ? (
                      <input id={id} type="date" value={drafts[b] ?? ''}
                        onChange={e => setDrafts(prev => ({ ...prev, [b]: e.target.value }))} onBlur={() => commit(b)}
                        className={cn(inputCls, 'w-48')} />
                    ) : b === 'assertions' ? (
                      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Assertions for row ${row.rowNo}`}>
                        {ASSERTION_ORDER.map(a => {
                          const on = pickedAssertions.includes(a);
                          return (
                            <button key={a} type="button" aria-pressed={on}
                              onClick={() => setPickedAssertions(prev => on ? prev.filter(x => x !== a) : [...prev, a])}
                              className={cn('h-7 px-2 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer',
                                on ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-ink-300')}>
                              {a}
                            </button>
                          );
                        })}
                        <button type="button" disabled={pickedAssertions.length === 0}
                          onClick={() => onSet('assertions', ASSERTION_ORDER.filter(a => pickedAssertions.includes(a)).join(', '))}
                          className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                          Set
                        </button>
                      </div>
                    ) : MULTILINE_BLANKS.includes(b) ? (
                      <textarea id={id} rows={2} value={drafts[b] ?? ''} placeholder={BLANK_PLACEHOLDER[b]}
                        onChange={e => setDrafts(prev => ({ ...prev, [b]: e.target.value }))} onBlur={() => commit(b)}
                        className={cn(inputCls, 'w-full h-auto py-1.5 resize-y leading-snug')} />
                    ) : (
                      <input id={id} value={drafts[b] ?? ''} placeholder={BLANK_PLACEHOLDER[b]}
                        onChange={e => setDrafts(prev => ({ ...prev, [b]: e.target.value }))} onBlur={() => commit(b)}
                        onKeyDown={e => { if (e.key === 'Enter') commit(b); }}
                        className={cn(inputCls, 'w-full')} />
                    )}
                    {hint && <p className="mt-1 text-[0.65625rem] leading-snug text-mitigated-700">{hint}</p>}
                    {idea && (
                      <p className="mt-1 flex items-start gap-1.5 text-[0.6875rem] leading-snug text-ink-600">
                        <Sparkles size={11} className="text-brand-600 mt-0.5 shrink-0" aria-hidden />
                        <span className="min-w-0">
                          <span className="font-semibold text-ink-800">Ira suggests:</span> {idea.shown}
                          <span className="text-ink-400"> — {idea.reason}</span>
                        </span>
                        <button type="button" onClick={() => onSet(BLANK_FIELD[b], idea.value)}
                          aria-label={`Use Ira's ${BLANK_TITLE[b].toLowerCase()} for row ${row.rowNo}`}
                          className="shrink-0 h-5 px-1.5 -my-0.5 rounded font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer">
                          Use
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Their columns, under ours, in the same boxes. The box a value is
                typed into follows what the column was defined to hold on the
                Config tab, so a date column can't take a sentence. */}
            {clientBlanks.map((e, i) => {
              const id = `racm-import-fix-${row.key}-extra-${i}`;
              const label = extraLabel(e);
              return (
                <div key={e.header} className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 items-start">
                  <label htmlFor={id} className="pt-1.5 text-[0.71875rem] font-semibold text-ink-600">{label}</label>
                  <div className="min-w-0">
                    {/* A list nobody has given choices to is a list of nothing:
                        it would offer a menu that can only be closed again, so
                        it takes typing until the Config tab names its values. */}
                    {e.kind === 'yesno' || (e.kind === 'list' && (e.options?.length ?? 0) > 0) ? (
                      <select id={id} value="" onChange={ev => { if (ev.target.value) onSetExtra(e.header, ev.target.value); }}
                        className={cn(inputCls, 'w-48 cursor-pointer')}>
                        <option value="" disabled>{e.kind === 'yesno' ? 'Pick Yes or No' : `Pick a ${label.toLowerCase()}`}</option>
                        {(e.kind === 'yesno' ? YES_NO : e.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : e.kind === 'date' ? (
                      <input id={id} type="date" value={extraDrafts[e.header] ?? ''}
                        onChange={ev => setExtraDrafts(prev => ({ ...prev, [e.header]: ev.target.value }))} onBlur={() => commitExtra(e)}
                        className={cn(inputCls, 'w-48')} />
                    ) : (
                      <input id={id} type={e.kind === 'number' ? 'number' : 'text'} value={extraDrafts[e.header] ?? ''}
                        onChange={ev => setExtraDrafts(prev => ({ ...prev, [e.header]: ev.target.value }))} onBlur={() => commitExtra(e)}
                        onKeyDown={ev => { if (ev.key === 'Enter') commitExtra(e); }}
                        className={cn(inputCls, e.kind === 'number' ? 'w-48' : 'w-full')} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );
}

/**
 * Why this row is being left out — stated in full, with both sides on screen.
 *
 * The old flag was one amber sentence: "Reads like AGR/INV/R001/C001 in the
 * Inventory RACM for Airline Group Ltd". It asked the reviewer to accept a
 * verdict about a control they could not see, reached by a similarity score
 * they had no way to inspect, and half the time it was wrong — two controls
 * that merely read alike were called the same control.
 *
 * Both halves of that are fixed. The rule is now exact (see `DUPLICATE_FIELDS`),
 * so a row is only ever called a duplicate when every field matches; and the
 * proof is printed here, field by field, row on the left and the control it
 * repeats on the right. Nobody has to take our word for it.
 *
 * There is NO button on this band. A duplicate arrives already left out, so the
 * only thing left to do is the opposite, and going the other way belongs to the
 * tick box alone — the row can never be in one state and read as another. That
 * was the whole trouble with "Put back" (user, 24 Sep), and it is not coming
 * back under another name. The band follows the box instead: tick the row and
 * the band says so.
 */
function DuplicateBand({ row, twin, included, colSpan }: {
  row: ImportRow;
  /** The six values of the control this row repeats. Undefined when the twin is
   *  a row that has since been edited out of matching — the band then states
   *  the verdict without the comparison rather than printing empty cells. */
  twin: DuplicateValues | undefined;
  included: boolean;
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);
  const dup = row.duplicateOf;
  if (!dup) return null;
  const mine = duplicateValues(row);
  const tableId = `racm-import-dup-${row.key}`;
  return (
    <tr className="def-detail">
      <td colSpan={colSpan}>
        <div className={cn('my-2 rounded-lg border px-3.5 py-3',
          included ? 'border-mitigated-300 bg-mitigated-50/60' : 'border-canvas-border bg-paper-50/60')}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Copy size={12} className={cn('shrink-0', included ? 'text-mitigated-700' : 'text-ink-500')} aria-hidden />
            <p className={cn('text-[0.71875rem] font-semibold', included ? 'text-mitigated-700' : 'text-ink-700')}>
              {included
                ? 'Duplicate — ticked back in, so it will be written a second time'
                : 'Duplicate — left out'}
            </p>
            <p className="text-[0.71875rem] text-ink-600">
              All {DUPLICATE_FIELDS.length} fields match{' '}
              <span className="font-mono font-semibold text-ink-800">{dup.name}</span> in {dup.where}.
            </p>
            <div className="flex-1" />
            {twin && (
              <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={tableId}
                className={cn(quietBtn, 'shrink-0')}>
                {open ? 'Hide the comparison' : 'See what matches'}
                <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
              </button>
            )}
          </div>
          {open && twin && (
            <div id={tableId} className="mt-3 rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden">
              <div className="grid grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 px-3 py-2 border-b border-canvas-border bg-paper-50">
                <span className="sr-only">Field</span>
                <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-500">This row</p>
                <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-500 truncate" title={dup.name}>{dup.name}</p>
              </div>
              {DUPLICATE_FIELDS.map(f => (
                <div key={f.key} className="grid grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 px-3 py-2 border-b border-canvas-border last:border-b-0">
                  <p className="text-[0.6875rem] font-semibold text-ink-600 flex items-start gap-1.5">
                    {/* The tick is not the signal, the two columns are — it only
                        saves re-reading a long sentence twice to be sure. */}
                    <Check size={11} className="text-compliant-600 mt-0.5 shrink-0" aria-hidden />
                    {f.label}
                  </p>
                  <p className="text-[0.6875rem] leading-snug text-ink-700 whitespace-pre-line">{cell(mine[f.key]) || '—'}</p>
                  <p className="text-[0.6875rem] leading-snug text-ink-700 whitespace-pre-line">{cell(twin[f.key]) || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function StepRail({ steps, current }: { steps: { key: Step; label: string }[]; current: Step }) {
  const at = steps.findIndex(s => s.key === current);
  return (
    // Fills the dialog (user ask, 24 Sep): the rail spans the width and the
    // line between the steps takes up whatever is left, so the last step sits
    // at the far edge instead of the whole thing huddling in the corner.
    <ol className="flex items-center gap-2 w-full" aria-label="Import steps">
      {steps.map((s, i) => {
        const done = i < at;
        const on = i === at;
        return (
          <li key={s.key} className={cn('flex items-center gap-2', i > 0 && 'flex-1 min-w-0')} aria-current={on ? 'step' : undefined}>
            {i > 0 && <span className={cn('flex-1 h-px min-w-[1.5rem]', done || on ? 'bg-brand-300' : 'bg-canvas-border')} aria-hidden />}
            <span className={cn('w-5 h-5 rounded-full inline-flex items-center justify-center text-[0.65625rem] font-semibold tabular-nums',
              done ? 'bg-compliant-50 text-compliant-700' : on ? 'bg-brand-600 text-white' : 'border border-canvas-border text-ink-400')}>
              {done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('text-[0.75rem]', on ? 'font-semibold text-ink-900' : done ? 'text-ink-600' : 'text-ink-400')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One person for every row still missing them (22 Sep). Rows stay held until
 * the field is filled; after Apply any single row is changed from its details.
 */
function SetForAllBox({ label, count, noColumn, people, onApply }: {
  label: string; count: number; noColumn: boolean; people: string[]; onApply: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  const id = `racm-import-all-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const apply = () => { if (value.trim()) { onApply(value); setValue(''); } };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-mitigated-200 bg-mitigated-50/60 px-3.5 py-2.5">
      <AlertTriangle size={12} className="text-mitigated-700 shrink-0" aria-hidden />
      <p className="text-[0.71875rem] font-semibold text-mitigated-700">
        {plural(count, 'row')} {count === 1 ? 'needs' : 'need'} a {label.toLowerCase()}
        {noColumn && <span className="font-normal text-ink-600"> — the file has no column for it</span>}
      </p>
      <div className="flex-1" />
      <label htmlFor={id} className="text-[0.71875rem] text-ink-600">Set for all rows</label>
      {/* The tenant's own users, not a typed name: an owner is somebody who can
          be asked for evidence, and a name nobody can route to is not one. */}
      <select id={id} value={value} onChange={e => setValue(e.target.value)}
        className="h-8 w-48 px-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
        <option value="" disabled>{`Pick a ${label.toLowerCase()}`}</option>
        {people.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="button" onClick={apply} disabled={!value.trim()}
        className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.71875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
        Apply
      </button>
    </div>
  );
}

/** How sure the match is. A required field with nothing matched is the only
 *  error; a low score is a prompt to look, not a block. */
function ConfidencePill({ match, missing }: { match: ColumnMatch; missing: boolean }) {
  if (match.column === null) return missing ? <Pill tone="risk">No column</Pill> : <span className="text-ink-300">—</span>;
  const tone = match.confidence >= 90 ? 'compliant' : match.confidence >= 70 ? 'draft' : 'mitigated';
  return <Pill tone={tone}>{match.confidence}%</Pill>;
}

export default function RacmImportReview({ mode, file, process, entity, existing, onClose, onImport }: RacmImportReviewProps) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  // The people this tenant can actually assign. Read from the workspace's own
  // user list rather than from names seen in past matrices: an owner has to be
  // somebody the product can route an evidence request to.
  const { users } = useAdminData();
  const tenantPeople = useMemo(
    () => Array.from(new Set(users.filter(u => ASSIGNABLE.includes(u.status)).map(u => u.name))).sort((a, b) => a.localeCompare(b)),
    [users],
  );
  // The team's column set-up: which columns a row can't arrive without, which
  // of the file's own columns to keep, and what its headers meant last time.
  // Whose columns this upload lands by: the client group of the company chosen
  // at Create RACM (22 Sep). Nobody is asked — the company already said.
  const setup = useMemo(() => racmSetupKeyFor(entity), [entity]);
  const cfg = useRacmConfig(setup.key);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(mode === 'racm' ? 'columns' : 'prompt');

  /** What the rows under review were built from — the column mapping, or the
   *  prompt. Going Back and on again without changing it keeps every review
   *  decision; changing it rebuilds the rows from scratch. */
  const builtFrom = useRef<string | null>(null);

  // ── Review state (both modes) ─────────────────────────────────────────────────
  const [rows, setRows] = useState<ImportRow[]>([]);
  /** Ira-suggested rows (SOP mode) the reviewer ticked. Unticked ones don't import. */
  const [acceptedRows, setAcceptedRows] = useState<Set<string>>(new Set());
  const [acceptedSugg, setAcceptedSugg] = useState<Record<string, Accepted>>({});
  const [dismissedSugg, setDismissedSugg] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [fillOpen, setFillOpen] = useState(false);
  /** What Ira has already written into the rows, per row — the value and the
   *  reason it was read from. This is a record of work done, not a queue of
   *  proposals: the values are in the rows from the moment Review opens. */
  const [iraFilled, setIraFilled] = useState<Record<string, BlankFill[]>>({});
  /** `${row.key}|${field}` Ira has already had a go at. She never has a second
   *  one: an undone value that filled itself back in would be a loop, and a
   *  reviewer who blanked a field meant it. */
  const filledOnce = useRef<Set<string>>(new Set());
  /** Rows the reviewer chose not to import rather than fix (17 Sep), plus the
   *  duplicates that start there. */
  const [leftOut, setLeftOut] = useState<Set<string>>(new Set());
  /** Rows the reviewer has ticked IN by hand. A duplicate they deliberately
   *  asked for is never taken away from them again by the effect below. */
  const askedFor = useRef<Set<string>>(new Set());
  /** Which reading of the SOP draft is on screen. Opens on the matrix: the tick
   *  boxes and the fix boxes live there, and they are what this step is for.
   *  The narrative is the same rows, read rather than worked on. */
  const [view, setView] = useState<ReviewView>('matrix');
  /** What the reviewer renamed a stage Ira grouped, keyed by the name she gave
   *  it. Held here rather than in the narrative because the flowchart shows the
   *  same stages: a rename on one is a rename on both. */
  const [stageNames, setStageNames] = useState<Record<string, string>>({});
  /** Set when the reviewer turns Ira's grouping down. Never reached when the
   *  SOP names its own stages — those are not ours to switch off. */
  const [ungrouped, setUngrouped] = useState(false);
  const stageNameFor = useCallback((name: string) => stageNames[name] ?? name, [stageNames]);
  /** Names typed straight onto the flowchart, instead of into the prompt (user
   *  ask, 25 Sep). Keyed by the DRAFT's own risk and control IDs, not by row
   *  key: the prompt beside the chart redraws the rows on every keystroke, and
   *  a name keyed to a row would be lost the moment it did. */
  const [riskNames, setRiskNames] = useState<Record<string, string>>({});
  const [controlNames, setControlNames] = useState<Record<string, string>>({});
  /**
   * A name typed onto the chart.
   *
   * Two things happen, and both are needed. The name is remembered against the
   * draft's own ID, so the next keystroke in the prompt does not wipe it; and
   * it is written into the rows that already exist, so a rename made in Review
   * — where the rows were drafted minutes ago — reaches the Matrix and the
   * import rather than only the box that was clicked.
   */
  const writeName = (field: 'riskTitle' | 'controlTitle', matches: (r: ImportRow) => boolean, to: string) =>
    setRows(prev => {
      const patches = new Map<string, Partial<Record<RacmFieldKey, string>>>();
      prev.forEach(r => { if (matches(r)) patches.set(r.key, { [field]: to }); });
      return patches.size ? rebuildRows(prev, patches) : prev;
    });
  const renameRisk = (key: string, to: string) => {
    setRiskNames(prev => ({ ...prev, [key]: to }));
    writeName('riskTitle', r => riskKeyOf(r) === key, to);
  };
  /** A control's title as it read the first time it was renamed. The stage
   *  grouping keeps reading this one, so typing a new name never re-files the
   *  control — see `inferStages`. */
  const [originalTitles, setOriginalTitles] = useState<Record<string, string>>({});
  const renameControl = (id: string, to: string, was: string) => {
    setOriginalTitles(prev => (prev[id] ? prev : { ...prev, [id]: was }));
    setControlNames(prev => ({ ...prev, [id]: to }));
    writeName('controlTitle', r => (cell(r.values.controlId) || r.key) === id, to);
  };
  const classifyBy = useCallback(
    (row: ImportRow) => originalTitles[cell(row.values.controlId) || row.key] ?? '',
    [originalTitles],
  );

  /** Start the review of a freshly built set of rows. A row that repeats a
   *  control this RACM already has starts left out — the 17 Sep call asked for
   *  repeats to be flagged and not created, so nobody has to notice one to avoid
   *  writing the control twice. Putting it back is a deliberate act. */
  const resetReview = (next: ImportRow[]) => {
    setAcceptedRows(new Set()); setAcceptedSugg(iraChecksFor(next)); setDismissedSugg({});
    setExpanded(new Set()); setFillOpen(false); setIraFilled({}); filledOnce.current = new Set();
    askedFor.current = new Set();
    setLeftOut(new Set(next.filter(rowRepeats).map(r => r.key)));
  };

  /** Design checks for the rows whose file carried none (22 Sep ask). A row that
   *  brought its own checks keeps them untouched — Ira adds where the file was
   *  silent, and never speaks over it. */
  const iraChecksFor = (next: ImportRow[]): Record<string, Accepted> => {
    const out: Record<string, Accepted> = {};
    next.forEach(r => {
      if (r.designChecks.length > 0) return;
      const { designChecks } = suggestForRow(r, process);
      if (designChecks.length) out[r.key] = { attributes: [], designChecks };
    });
    return out;
  };

  // ── Columns step (RACM) ───────────────────────────────────────────────────────
  const [read, setRead] = useState<{ status: 'loading' } | { status: 'failed' } | { status: 'ready'; sheets: SheetData[] }>({ status: 'loading' });
  const [sheetIx, setSheetIx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [matches, setMatches] = useState<ColumnMatch[]>([]);

  useEffect(() => {
    if (mode !== 'racm') return;
    let alive = true;
    readRacmWorkbook(file).then(sheets => {
      if (!alive) return;
      // Open on the first sheet that has something below its header row. A
      // workbook where no sheet does is as unreadable as one that won't parse.
      const ix = sheets.findIndex(s => !!firstDataRow(s.rows, guessHeaderRow(s.rows)));
      if (ix < 0) { setRead({ status: 'failed' }); return; }
      const sheetRows = sheets[ix]!.rows;
      const h = guessHeaderRow(sheetRows);
      setSheetIx(ix); setHeaderRow(h); setMatches(matchColumns(sheetRows[h] ?? [], cfg.mapping));
      setRead({ status: 'ready', sheets });
    }).catch(() => { if (alive) setRead({ status: 'failed' }); });
    return () => { alive = false; };
  }, [mode, file]);

  const sheet = read.status === 'ready' ? read.sheets[sheetIx] : undefined;
  const headers = sheet?.rows[headerRow] ?? [];
  const sample = sheet ? firstDataRow(sheet.rows, headerRow) : undefined;
  const dataRowCount = sheet ? sheet.rows.slice(headerRow + 1).filter(r => !isBlankRow(r)).length : 0;
  const attention = useMemo(() => (matches.length ? needsAttention(matches) : []), [matches]);
  /** Required fields nothing is mapped to. */
  const missingRequired = useMemo(
    () => matches.filter(m => m.column === null && !!FIELD_BY_KEY.get(m.field)?.required),
    [matches],
  );
  // ── what actually stops the import ────────────────────────────────────────
  // Every column comes across either way (see "Also imported" below), so the
  // only question this step asks is whether a REQUIRED one has a column — and
  // since 22 Sep the answer only stops the import when nothing can supply it.
  // Ira writes what she can read off the row (amber), the rest is filled in at
  // Review (grey — a risk owner, attributes to accept), and IDs are built. A
  // file with neither a control title nor a description column is the one
  // stop: there is nothing to derive a control FROM.
  const pairMissing = useMemo(() => !matches.some(m => TITLE_PAIR.includes(m.field) && m.column !== null), [matches]);
  const blocking = useMemo(() => (pairMissing ? missingRequired.filter(m => TITLE_PAIR.includes(m.field)) : []), [missingRequired, pairMissing]);
  const fillable = useMemo(() => missingRequired.filter(m => !blocking.includes(m) && iraCanFill(m.field)), [missingRequired, blocking]);
  const atReview = useMemo(() => missingRequired.filter(m => !blocking.includes(m) && !iraCanFill(m.field)), [missingRequired, blocking]);
  /** The client's own required columns this file doesn't carry. Every row is
   *  asked for them at Review and none of them is ever Ira's to draft: nothing
   *  in a row says what belongs in a column that isn't ours. Read the same way
   *  the import reads them — by normalised header, and only from a column no
   *  field above has claimed. */
  const extrasAtReview = useMemo(() => {
    const inFile = new Set((sheet?.rows[headerRow] ?? [])
      .map((h, i) => ({ header: normaliseHeader(cell(h)), i }))
      .filter(h => h.header && !matches.some(m => m.column === h.i))
      .map(h => h.header));
    return cfg.extras.filter(e => e.required && !inFile.has(normaliseHeader(e.header)));
  }, [sheet, headerRow, matches, cfg.extras]);
  /** Everything the reviewer fills in themselves — our fields and theirs. */
  const atReviewCount = atReview.length + extrasAtReview.length;
  /** The rows as the columns above would build them — read before anyone
   *  continues, so the step can say how much Ira will actually fill (22 Sep)
   *  rather than only that she will try. */
  const previewRows = useMemo(() => {
    if (mode !== 'racm' || !sheet) return [] as ImportRow[];
    try { return buildImportRows(sheet.rows, headerRow, matches, existing, process, entity, cfg.extras); } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sheet, headerRow, matches, process, entity, cfg.extras]);
  /** How many rows Ira can read each missing field off — hers to fill, and the
   *  suggestions she'll offer for the two lists. */
  const fillCounts = useMemo(() => {
    const out = new Map<RacmFieldKey, number>();
    const bump = (k: RacmFieldKey) => out.set(k, (out.get(k) ?? 0) + 1);
    previewRows.forEach(r => {
      proposeBlankFills(r).forEach(f => bump(f.field));
      const sugg = suggestForRow(r, process);
      if (sugg.designChecks.length) bump('designChecks');
      if (sugg.attributes.length) bump('attributes');
    });
    return out;
  }, [previewRows, process]);
  const columnCount = Math.max(headers.length, sample?.length ?? 0);
  const columnOptions = Array.from({ length: columnCount }, (_, i) => ({ i, label: cell(headers[i]) || `Column ${colLetter(i)} (no header)` }));
  const unusedColumns = columnOptions.filter(o => cell(headers[o.i]) && !matches.some(m => m.column === o.i));
  const headerChoices = sheet
    ? Array.from(new Set([...Array.from({ length: Math.min(HEADER_ROW_CHOICES, sheet.rows.length) }, (_, i) => i), headerRow])).sort((a, b) => a - b)
    : [];

  const pickSheet = (ix: number) => {
    if (read.status !== 'ready') return;
    const sheetRows = read.sheets[ix]?.rows ?? [];
    const h = guessHeaderRow(sheetRows);
    setSheetIx(ix); setHeaderRow(h); setMatches(matchColumns(sheetRows[h] ?? [], cfg.mapping));
  };
  const pickHeaderRow = (h: number) => {
    setHeaderRow(h);
    setMatches(matchColumns(sheet?.rows[h] ?? [], cfg.mapping));
  };
  // A hand-picked column is certain, and a column feeds one field: taking it
  // here releases it from whichever field had it before.
  const setColumn = (field: RacmFieldKey, value: string) => {
    const col = value === '' ? null : Number(value);
    setMatches(prev => prev.map(m => {
      if (m.field === field) return { ...m, column: col, confidence: col === null ? 0 : 100 };
      if (col !== null && m.column === col) return { ...m, column: null, confidence: 0 };
      return m;
    }));
  };

  const startFromTemplate = () => {
    const template = racmTemplateForProcesses([process], 'fresh').map(c => ({ ...c, ...(entity ? { entity } : {}) }));
    const pc = peekProcessCode(process);
    setProcessCode(process, pc);
    const controls = assignRacmIds(template, { processCode: pc, entityCodeOf: e => codeForEntity(e), useFileNumbers: false });
    onImport(controls, { source: 'racm', fileName: file.name, fromTemplate: true });
    logEvent({ action: 'Create', description: `Created the ${process} RACM from its template — "${file.name}" had no rows to read`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'RACM created', message: `The ${process} RACM starts from its template — "${file.name}" is kept as its source file.` });
    onClose();
  };

  const columnsToReview = () => {
    if (!sheet) return;
    const sig = JSON.stringify([sheetIx, headerRow, matches]);
    if (builtFrom.current !== sig) {
      const built = buildImportRows(sheet.rows, headerRow, matches, existing, process, entity, cfg.extras);
      setRows(built);
      resetReview(built);
      builtFrom.current = sig;
    }
    setStep('review');
  };

  // ── Prompt step (SOP) ─────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(DEFAULT_SOP_PROMPT);
  const [promptTooShort, setPromptTooShort] = useState(false);
  const [extract, setExtract] = useState<{ phase: 'idle' } | { phase: 'running'; done: number } | { phase: 'failed' }>({ phase: 'idle' });
  const extracting = extract.phase === 'running';
  const timers = useRef<number[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); }, []);
  useEffect(() => { if (extracting) progressRef.current?.scrollIntoView({ block: 'nearest' }); }, [extracting]);

  const validateAndExtract = () => {
    if (prompt.trim().length < MIN_PROMPT_CHARS) { setPromptTooShort(true); return; }
    setPromptTooShort(false);
    // the same prompt already produced the draft under review — go back to it
    // rather than throwing away what the reviewer decided there
    if (builtFrom.current === prompt) { setStep('review'); return; }
    const used = prompt;
    setExtract({ phase: 'running', done: 0 });
    timers.current = EXTRACT_STEPS.map((_, i) => window.setTimeout(() => setExtract({ phase: 'running', done: i + 1 }), (i + 1) * EXTRACT_STEP_MS));
    // a beat after the last tick, so the finished list is seen before it goes
    timers.current.push(window.setTimeout(() => {
      try {
        const drafted = draftWithNames(used);
        setRows(drafted);
        resetReview(drafted);
        builtFrom.current = used;
        setExtract({ phase: 'idle' });
        setStep('review');
      } catch {
        setExtract({ phase: 'failed' });
      }
    }, EXTRACT_STEPS.length * EXTRACT_STEP_MS + 300));
  };

  /**
   * The draft for a prompt, with the reviewer's own names written over Ira's.
   *
   * Used twice on purpose: once for the live chart beside the prompt, once by
   * the extraction itself. One builder means the chart is never a flattering
   * preview of a draft that then lands different.
   */
  const draftWithNames = useCallback((text: string): ImportRow[] => {
    const draft = draftRowsFromSop(process, file.name, text, existing, entity);
    const patches = new Map<string, Partial<Record<RacmFieldKey, string>>>();
    draft.forEach(r => {
      const patch: Partial<Record<RacmFieldKey, string>> = {};
      // The same keys the chart drew the boxes under — see `riskKeyOf`.
      const rid = riskKeyOf(r);
      const cid = cell(r.values.controlId) || r.key;
      if (rid && riskNames[rid]) patch.riskTitle = riskNames[rid];
      if (cid && controlNames[cid]) patch.controlTitle = controlNames[cid];
      if (Object.keys(patch).length) patches.set(r.key, patch);
    });
    if (!patches.size) return draft;
    // Rebuilt in order, because a renamed row is also checked against the rows
    // above it — the same rule `rebuildRows` follows in Review.
    const out: ImportRow[] = [];
    for (const r of draft) {
      const patch = patches.get(r.key);
      out.push(rowFromValues(patch ? { ...r.values, ...patch } : r.values, r, existing, process, out, entity));
    }
    return out;
  }, [process, file.name, existing, entity, riskNames, controlNames]);

  /** The chart that sits beside the prompt. Deferred so a long prompt stays
   *  smooth to type in — the chart catches up a frame later. */
  const livePrompt = useDeferredValue(prompt);
  const liveDraft = useMemo(
    () => (mode === 'sop' ? draftWithNames(livePrompt) : []),
    [mode, draftWithNames, livePrompt],
  );

  // ── Review derivations ────────────────────────────────────────────────────────
  const effective = useMemo(() => rows.map(r => withAccepted(r, acceptedSugg[r.key])), [rows, acceptedSugg]);
  const isCandidate = (r: ImportRow) => r.origin !== 'suggested' || acceptedRows.has(r.key);
  /** In or out — the one thing a row's tick box says (user ask, 24 Sep).
   *
   *  Two sets used to decide it and they were ANDed, not opposed: `acceptedRows`
   *  for Ira's own drafts, `leftOut` for everything else. So a suggestion held
   *  back as a repeat needed BOTH a tick and a "Put back" before it would
   *  import, and an unticked suggestion showed no sign at all that it would
   *  not — no grey, no strip, nothing. The reader this is built for is an
   *  auditor, not an engineer; they get one box, and it means what it says.
   *
   *  The two sets stay underneath, kept honest by the one control. */
  const isIncluded = (r: ImportRow) => isCandidate(r) && !leftOut.has(r.key);
  const setIncluded = (r: ImportRow, on: boolean) => {
    if (on) askedFor.current.add(r.key);
    setLeftOut(prev => { const n = new Set(prev); if (on) n.delete(r.key); else n.add(r.key); return n; });
    if (r.origin === 'suggested') setAcceptedRows(prev => { const n = new Set(prev); if (on) n.add(r.key); else n.delete(r.key); return n; });
  };
  const included = useMemo(() => effective.filter(r => (r.origin !== 'suggested' || acceptedRows.has(r.key)) && !leftOut.has(r.key)), [effective, acceptedRows, leftOut]);
  /** The other side of a duplicate — the control this row repeats, so the band
   *  under it can print both and let the reviewer judge. `controlId` names
   *  either a control on the engagement or an earlier row of this same file. */
  const twinValues = useCallback((row: ImportRow): DuplicateValues | undefined => {
    const id = row.duplicateOf?.controlId;
    if (!id) return undefined;
    const c = existing.find(x => x.id === id);
    if (c) return controlDuplicateValues(c);
    const twin = effective.find(x => x.key === id);
    return twin ? duplicateValues(twin) : undefined;
  }, [existing, effective]);
  const setAllIncluded = (on: boolean) => {
    setLeftOut(on ? new Set() : new Set(effective.map(r => r.key)));
    setAcceptedRows(on ? new Set(effective.filter(r => r.origin === 'suggested').map(r => r.key)) : new Set());
  };
  /**
   * A row that BECOMES a duplicate is left out, the same as one that arrived as
   * one.
   *
   * `resetReview` reads the rows once, at extraction. But a row is only ever
   * called a duplicate when all six fields are filled (see `DUPLICATE_FIELDS`),
   * and Ira fills blanks a moment LATER — so a row that arrived missing its risk
   * title was not a duplicate when the list was first read, and became one the
   * instant she supplied it. Left to `resetReview` alone, the header counted it
   * as a duplicate while the row itself sat ticked and going in, and the band
   * under it read "ticked back in" about a tick nobody had made.
   *
   * The same happens from an edit: filling in a value by hand, or changing one,
   * can make a row read exactly like the row above it.
   *
   * This only ever ADDS. A row the reviewer ticked in themselves is in
   * `askedFor` and is never taken off them, and a row that stops being a
   * duplicate stays where the reviewer last put it rather than jumping back on
   * its own.
   */
  useEffect(() => {
    const newly = rows.filter(r => rowRepeats(r) && !leftOut.has(r.key) && !askedFor.current.has(r.key));
    if (newly.length) setLeftOut(prev => new Set([...prev, ...newly.map(r => r.key)]));
  }, [rows, leftOut]);

  const suggestions = useMemo(() => {
    const out = new Map<string, Suggestion[]>();
    effective.forEach(r => {
      const s = suggestForRow(r, process);
      const gone = new Set(dismissedSugg[r.key] ?? []);
      out.set(r.key, [
        ...s.designChecks.map(text => ({ id: `check:${text}`, kind: 'check' as const, text })),
        ...s.attributes.map(text => ({ id: `attribute:${text}`, kind: 'attribute' as const, text })),
      ].filter(x => !gone.has(x.id)));
    });
    return out;
  }, [effective, dismissedSugg, process]);
  /** Anything Ira could still read but hasn't — normally empty, since the effect
   *  above writes them. It is what `BlankFixRow` offers beside a core blank she
   *  could not fill on her own. */
  const fills = useMemo(() => effective.map(row => ({ row, fills: proposeBlankFills(row) })).filter(g => g.fills.length > 0), [effective]);
  /** Ira's values, in row order, for the panel that lists what she did. */
  const filledList = useMemo(
    () => effective.map(row => ({ row, fills: iraFilled[row.key] ?? [] })).filter(g => g.fills.length > 0),
    [effective, iraFilled],
  );
  const filledCount = filledList.reduce((n, g) => n + g.fills.length, 0);
  const iraCheckCount = useMemo(
    () => Object.values(acceptedSugg).reduce((n, a) => n + a.designChecks.length, 0),
    [acceptedSugg],
  );

  const attributeCount = included.reduce((n, r) => n + r.attributes.length, 0);
  const requiredFileCount = included.reduce((n, r) => n + r.attributes.reduce((m, a) => m + a.requiredFiles.length, 0), 0);
  const mergedCount = included.reduce((n, r) => n + r.mergedDuplicateChecks, 0);
  /** Rows still held back — no frequency, or a core value blank, or one of the
   *  client's own required columns left empty. */
  const needFix = included.filter(r => rowBlocked(r, cfg.core, cfg.extras)).length;
  /** What those rows are missing, said once each, in a fixed order. A client's
   *  column is named the way their file spells it, so it can be found there. */
  const missingLabels = useMemo(() => {
    const found = new Set<CoreBlank>();
    const theirs = new Map<string, string>();
    let noFrequency = false;
    included.forEach(r => {
      if (r.frequency === null) noFrequency = true;
      coreBlanks(r, cfg.core).forEach(b => found.add(b));
      extraBlanks(r, cfg.extras).forEach(e => theirs.set(e.header, extraLabel(e)));
    });
    return [
      ...CORE_BLANK_ORDER.filter(b => found.has(b)).map(b => CORE_BLANK_LABEL[b]),
      ...theirs.values(),
      ...(noFrequency ? ['a frequency'] : []),
    ];
  }, [included, cfg.core, cfg.extras]);
  /** THE PEOPLE A WHOLE FILE MAY LACK A COLUMN FOR (22 Sep). Nothing in a row
   *  says who owns its risk, so Ira can't read one — the reviewer sets it once
   *  for every row still missing it, then changes any single row in its
   *  details. Only rows still going in are counted. */
  const peopleGaps = useMemo(
    () => PEOPLE_FIELDS
      .map(field => ({ field, rows: included.filter(r => !cell(r.values[field])).map(r => r.key) }))
      .filter(g => g.rows.length > 0),
    [included],
  );
  const setForAll = (field: RacmFieldKey, value: string) => {
    const v = value.trim();
    const gap = peopleGaps.find(g => g.field === field);
    if (!v || !gap) return;
    setRows(prev => rebuildRows(prev, new Map(gap.rows.map(k => [k, { [field]: v }]))));
    addToast({ type: 'success', title: `${fieldLabel(field)} set on ${plural(gap.rows.length, 'row')}`, message: 'Change any single row from its details.' });
  };
  const fillsByRow = useMemo(() => new Map(fills.map(g => [g.row.key, g.fills])), [fills]);
  /** Rows that say, field for field, what a control already on file says.
   *  Counted over every row under review, left out or not, so the summary can
   *  explain the gap between how many rows there are and how many are going in. */
  const duplicateCount = effective.filter(rowRepeats).length;
  /** Duplicates the reviewer has ticked back in anyway.
   *
   *  This no longer blocks the import (24 Sep). It used to: the row offered a
   *  tick box, and ticking it disabled Import and answered "untick them to
   *  import the rest" — a control that, used, broke the screen. The tick box is
   *  the decision. All this count does now is say out loud, next to the button,
   *  that a second copy is about to be written, so nobody does it unread. */
  const duplicatesIncluded = included.filter(rowRepeats).length;
  // ── IDs (S11) ─────────────────────────────────────────────────────────────────
  // ENTITY/PROCESS/R001/C001. The codes start from the register (or the names)
  // and can be edited here; a code another process or company already uses is
  // refused, so an ID means the same thing on every RACM and engagement.
  const [processCode, setProcessCodeDraft] = useState(() => peekProcessCode(process));
  const [entityCodeDrafts, setEntityCodeDrafts] = useState<Record<string, string>>({});
  const [codesOpen, setCodesOpen] = useState(false);
  const rowEntity = (row: ImportRow) => cell(row.values.entity) || entity;
  const entityNames = useMemo(() => Array.from(new Set(included.map(rowEntity).filter(Boolean))), [included, entity]); // eslint-disable-line react-hooks/exhaustive-deps
  const codeForEntity = (name: string | undefined) => (name ? entityCodeDrafts[name] ?? peekEntityCode(name) : entityCodeDrafts[''] ?? 'ENT');
  const processCodeError = !CODE_OK(processCode) ? 'Use exactly 3 letters or digits'
    : processCodeTakenBy(processCode, process) ? `Already the code for ${titleCase(processCodeTakenBy(processCode, process)!)}` : null;
  const entityCodeErrors = entityNames.map(name => {
    const code = codeForEntity(name);
    const clash = entityNames.find(other => other !== name && codeForEntity(other) === code);
    const error = !CODE_OK(code) ? 'Use exactly 3 letters or digits'
      : entityCodeTakenBy(code, name) ? `Already the code for ${titleCase(entityCodeTakenBy(code, name)!)}`
      : clash ? `Same code as ${clash}` : null;
    return { name, code, error };
  });
  const codesOk = !processCodeError && entityCodeErrors.every(e => !e.error);
  /** Open on ask — or on its own the moment a code is refused, since a closed
   *  panel is no place to keep the one field standing between here and Import. */
  const codesShown = codesOpen || !codesOk;
  /** The ID each included row will import under, keyed by row. */
  const newIds = useMemo(() => {
    // No ID in the file: numbered by row order, and rows with no Risk ID but the
    // same risk description share a risk — the same rule the import uses.
    const noDigits = (t: string) => t.replace(/\d/g, d => 'abcdefghij'[Number(d)]!);
    const stand = included.map(r => ({
      id: cell(r.values.controlId) || `~row-${noDigits(r.key)}`,
      riskId: cell(r.values.riskId) || `~risk-${noDigits(norm(cell(r.values.riskDescription)) || r.key)}`,
      entity: rowEntity(r) || undefined,
    }) as unknown as Control);
    const out = assignRacmIds(stand, { processCode: cleanCode(processCode) || 'GEN', entityCodeOf: codeForEntity, useFileNumbers: true });
    return new Map(included.map((r, i) => [r.key, out[i]!.id]));
  }, [included, processCode, entityCodeDrafts, entity]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The ID a row will carry once imported — what every view should call it, so
   *  the narrative and the matrix never name the same control two ways. */
  const idFor = useCallback((row: ImportRow) => newIds.get(row.key) ?? idOf(row), [newIds]);

  const canImport = included.length > 0 && needFix === 0 && codesOk;

  const toggleExpanded = (key: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  /** Re-derive the whole list in order, writing `patches` in on the way. Every
   *  row is rebuilt, not just the edited one, because a row is also checked
   *  against the rows above it — a word changed here can make the row below a
   *  repeat of this one, or stop it being one. */
  const rebuildRows = (prev: ImportRow[], patches: Map<string, Partial<Record<RacmFieldKey, string>>>): ImportRow[] => {
    const next: ImportRow[] = [];
    for (const r of prev) {
      const patch = patches.get(r.key);
      next.push(rowFromValues(patch ? { ...r.values, ...patch } : r.values, r, existing, process, next, entity));
    }
    return next;
  };
  /** Write one value into a row and rebuild it — a blank filled in review. */
  const setValue = (rowKey: string, field: RacmFieldKey, value: string) =>
    setRows(prev => rebuildRows(prev, new Map([[rowKey, { [field]: value }]])));
  /** The same for one of the client's own columns. It can't go through
   *  `rebuildRows`, which patches fields: an extra has no field key, so the
   *  value is written on the row itself — and every row is still re-derived in
   *  order, for the reason `rebuildRows` gives. */
  const setExtra = (rowKey: string, header: string, value: string) =>
    setRows(prev => {
      const next: ImportRow[] = [];
      for (const r of prev) {
        next.push(r.key === rowKey
          ? setRowExtra(r, header, value, existing, process, next, entity)
          : rowFromValues(r.values, r, existing, process, next, entity));
      }
      return next;
    });

  /**
   * Ira fills what she can read off each row's other columns, as soon as the
   * rows exist (22 Sep: "jo bhi column ka data nahi hoga apne paas, wo required
   * column ka data AI suggest karega").
   *
   * This used to wait behind a collapsed panel that had to be opened, accepted
   * and applied, so a file with no Risk title column imported with no risk
   * titles — the proposal was computed and then sat there. The values now land
   * in the rows, marked and listed with their reasons, and Import is still the
   * only thing that writes anything.
   *
   * It settles: a filled field is no longer blank, so `proposeBlankFills` stops
   * proposing it, and `filledOnce` makes that guarantee independent of whether
   * the value survives the rebuild. Later edits still get their turn — typing a
   * frequency makes a testing strategy derivable, and that lands too.
   */
  useEffect(() => {
    if (step !== 'review' || rows.length === 0) return;
    const patches = new Map<string, Partial<Record<RacmFieldKey, string>>>();
    const done: Record<string, BlankFill[]> = {};
    rows.forEach(r => {
      const fresh = proposeBlankFills(r).filter(f => !filledOnce.current.has(`${r.key}|${f.field}`));
      if (!fresh.length) return;
      done[r.key] = fresh;
      patches.set(r.key, Object.fromEntries(fresh.map(f => [f.field, String(f.value)])));
    });
    if (patches.size === 0) return;
    Object.entries(done).forEach(([k, fs]) => fs.forEach(f => filledOnce.current.add(`${k}|${f.field}`)));
    setRows(prev => rebuildRows(prev, patches));
    setIraFilled(prev => {
      const next = { ...prev };
      Object.entries(done).forEach(([k, fs]) => { next[k] = [...(next[k] ?? []), ...fs]; });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, step]);

  /** Put one of Ira's values back to blank. She does not fill it again. */
  const undoFill = (rowKey: string, field: RacmFieldKey) => {
    setRows(prev => rebuildRows(prev, new Map([[rowKey, { [field]: '' }]])));
    setIraFilled(prev => {
      const left = (prev[rowKey] ?? []).filter(f => f.field !== field);
      const next = { ...prev };
      if (left.length) next[rowKey] = left; else delete next[rowKey];
      return next;
    });
  };
  const acceptSuggestion = (rowKey: string, s: Suggestion) => setAcceptedSugg(prev => {
    const cur = prev[rowKey] ?? { attributes: [], designChecks: [] };
    return { ...prev, [rowKey]: s.kind === 'attribute' ? { ...cur, attributes: [...cur.attributes, s.text] } : { ...cur, designChecks: [...cur.designChecks, s.text] } };
  });
  const dismissSuggestion = (rowKey: string, s: Suggestion) => setDismissedSugg(prev => ({ ...prev, [rowKey]: [...(prev[rowKey] ?? []), s.id] }));

  const undoAllFills = () => {
    const byRow = new Map<string, Partial<Record<RacmFieldKey, string>>>();
    filledList.forEach(({ row, fills: fs }) => byRow.set(row.key, Object.fromEntries(fs.map(f => [f.field, '']))));
    if (!byRow.size) return;
    setRows(prev => rebuildRows(prev, byRow));
    setIraFilled({});
    addToast({ type: 'info', title: `Cleared ${filledCount} value${filledCount === 1 ? '' : 's'}`, message: 'The rows read as the file wrote them. Nothing has been saved either way.' });
  };

  const doImport = () => {
    if (!canImport) return;
    let controls: Control[];
    try {
      controls = importRowsToControls(included, process, cfg.core, cfg.extras);
    } catch {
      addToast({ type: 'error', title: "Couldn't import", message: 'Fill every blank, or leave the row out, before importing.' });
      return;
    }
    // the codes as reviewed become the register's, then every row takes its ID
    setProcessCode(process, processCode);
    entityCodeErrors.forEach(e => setEntityCode(e.name, e.code));
    controls = assignRacmIds(
      controls.map((c, i) => ({ ...c, ...(rowEntity(included[i]!) ? { entity: rowEntity(included[i]!) } : {}) })),
      { processCode, entityCodeOf: codeForEntity, useFileNumbers: true },
    );
    // What the headers turned out to mean is only learned from an import that
    // actually went ahead. A mapping saved while the reviewer was still changing
    // their mind would teach the next upload a lesson nobody agreed to.
    if (mode === 'racm' && sheet) {
      const pairs = headerMapping(sheet.rows, headerRow, matches);
      // The first matrix a team uploads is the one that says what their RACM
      // looks like — which of our columns they carry, and which of theirs we
      // have no field for. After that the set-up is theirs to change on the
      // Config tab, so later uploads only add to what a header means.
      if (!cfg.configured) configureFromSample(setup.key, pairs, file.name);
      else rememberMapping(setup.key, pairs);
    }
    // the SOP stays viewable from the RACM's row menu for this session
    const url = mode === 'sop' ? URL.createObjectURL(file) : undefined;
    onImport(controls, { source: mode, fileName: file.name, url });
    const n = controls.length;
    logEvent(mode === 'sop'
      ? { action: 'Create', description: `Extracted the ${process} RACM from "${file.name}" — ${plural(n, 'control')}`, module: 'SOX ICFR', entity: 'RACM' }
      : { action: 'Upload', description: `Imported the ${process} RACM from "${file.name}" — ${plural(n, 'control')}`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: mode === 'sop' ? 'RACM extracted' : 'RACM imported', message: `${plural(n, 'control')} imported for ${process}` });
  };

  // ── Dialog behaviour ──────────────────────────────────────────────────────────
  useEffect(() => { dialogRef.current?.focus(); }, []);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);
  // Escape backs out of the fill panel first. It only closes the dialog on the
  // first step — past that there are review decisions an accidental key would
  // throw away, so leaving takes the Close button. The backdrop never closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (fillOpen) { setFillOpen(false); return; }
      if (step !== 'review' && !extracting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const steps = mode === 'racm' ? RACM_STEPS : SOP_STEPS;
  const reviewCols = 5;
  /** An SOP is turned into a narrative and a matrix; a RACM workbook arrives as
   *  a matrix already, so there is nothing to switch between and no toggle. */
  const showViews = mode === 'sop';
  const activeView: ReviewView = showViews ? view : 'matrix';

  return (
    <div className="modal-backdrop" style={{ padding: '6vh 20px' }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Import RACM — ${process}`}
        className="modal flex flex-col focus:outline-none" style={{ maxWidth: 1100, height: '88vh' }}>
        {/* head — what is being imported, into which RACM, and where in the flow */}
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-semibold text-ink-900">{mode === 'sop' ? `Extract the ${process} RACM` : `Import the ${process} RACM`}</h2>
              <p className="text-[0.75rem] text-ink-500 mt-0.5 flex items-center gap-1.5 min-w-0">
                {mode === 'sop' ? <FileText size={12} className="text-ink-400 shrink-0" /> : <FileSpreadsheet size={12} className="text-ink-400 shrink-0" />}
                <span className="truncate" title={file.name}>{file.name}</span>
                {entity && <><span className="text-ink-300" aria-hidden>·</span><span className="truncate">{entity}</span></>}
              </p>
            </div>
            <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        {/* Where you are in the flow — BELOW the header's divider and above the
            step itself (user ask, 24 Sep). Beside the ✕ it read as another
            control to press rather than a statement, and it crowded a long file
            name into a truncation. A band of its own, outside the scrolling
            body, so it stays put as the step scrolls. */}
        <div className="px-5 pt-3.5 pb-1 shrink-0">
          <StepRail steps={steps} current={step} />
        </div>

        {/* body — the only part that scrolls */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {/* ── Columns ── */}
          {step === 'columns' && read.status === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center" role="status" aria-live="polite">
              <Loader2 size={18} className="text-brand-600 animate-spin" />
              <p className="text-[0.8125rem] text-ink-600">Reading the file…</p>
            </div>
          )}

          {step === 'columns' && read.status === 'failed' && (
            <div className="h-full flex flex-col items-center justify-center text-center" role="alert">
              <span className="p-2.5 rounded-lg bg-mitigated-50 inline-flex mb-3"><FileWarning size={18} className="text-mitigated-700" /></span>
              <p className="text-[0.84375rem] font-semibold text-ink-900">We couldn't read rows from {file.name}.</p>
              <p className="text-[0.75rem] text-ink-500 mt-1 max-w-[28rem] leading-relaxed">
                It needs to be an .xlsx or .csv with a header row and at least one row below it. You can start from the template and edit the rows in the spreadsheet editor instead.
              </p>
              <button onClick={startFromTemplate} className={cn(primaryBtn, 'mt-4')}>Use the {process} template instead</button>
            </div>
          )}

          {step === 'columns' && read.status === 'ready' && sheet && (
            <>
              <div className="flex flex-wrap items-end gap-3 mb-4">
                {read.sheets.length > 1 && (
                  <div>
                    <label htmlFor="racm-import-sheet" className={labelCls}>Sheet</label>
                    <select id="racm-import-sheet" value={sheetIx} onChange={e => pickSheet(Number(e.target.value))} className={cn(selectCls, 'min-w-[12rem]')}>
                      {read.sheets.map((s, i) => <option key={`${s.name}-${i}`} value={i}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="min-w-0 flex-1 max-w-[32rem]">
                  <label htmlFor="racm-import-header-row" className={labelCls}>Header row</label>
                  <select id="racm-import-header-row" value={headerRow} onChange={e => pickHeaderRow(Number(e.target.value))} className={cn(selectCls, 'w-full')}>
                    {headerChoices.map(i => <option key={i} value={i}>Row {i + 1} — {rowPreview(sheet.rows[i])}</option>)}
                  </select>
                </div>
                <p className="text-[0.71875rem] text-ink-400 pb-2.5">{plural(dataRowCount, 'row')} below it</p>
              </div>

              {/* what to look at before continuing — said once, above the table it refers to */}
              {attention.length > 0 || extrasAtReview.length > 0 ? (
                <div className="rounded-lg border border-mitigated-200 bg-mitigated-50 px-3.5 py-2.5 mb-4">
                  <p className="text-[0.75rem] font-semibold text-mitigated-700 flex items-center gap-1.5"><AlertTriangle size={13} /> Needs attention</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {attention.map(m => (
                      <li key={m.field} className="text-[0.75rem] text-ink-700">
                        <span className="font-semibold text-ink-800">{fieldLabel(m.field)}</span> — {m.column === null ? 'No column found' : 'Low confidence — check it'}
                      </li>
                    ))}
                    {/* Their columns are named here too: a required one this
                        file doesn't carry holds every row at Review, which is
                        not something to find out only once you get there. */}
                    {extrasAtReview.map(e => (
                      <li key={e.header} className="text-[0.75rem] text-ink-700">
                        <span className="font-semibold text-ink-800">{extraLabel(e)}</span> — No column found, so you'll fill it in at Review
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[0.75rem] text-compliant-700 flex items-center gap-1.5 mb-4"><CheckCircle2 size={13} /> Every field we need has a column.</p>
              )}

              <div className="reg-wrap overflow-x-auto">
                <table className="w-full border-collapse table-fixed" style={{ minWidth: 760 }}>
                  <thead className="reg-head">
                    <tr>
                      <th style={{ width: 240 }}>Our field</th>
                      <th style={{ width: 290 }}>Column in your file</th>
                      <th style={{ width: 120 }}>Confidence</th>
                      <th>Sample value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(m => {
                      const f = FIELD_BY_KEY.get(m.field);
                      const sampleValue = m.column === null ? '' : cell(sample?.[m.column]);
                      return (
                        <tr key={m.field} className="reg-row reg-static">
                          <td>
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-ink-800 truncate">{f?.label ?? m.field}</span>
                              {f?.required && (
                                <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-wide text-ink-500 border border-canvas-border rounded px-1.5 leading-4"
                                  title={TITLE_PAIR.includes(m.field) ? 'Required — with only one of Control title and Control description in the file, Ira writes the other from it' : undefined}>Required</span>
                              )}
                            </span>
                          </td>
                          <td>
                            <ColumnPicker id={`racm-import-col-${m.field}`} label={`Column in your file for ${f?.label ?? m.field}`}
                              value={m.column} options={columnOptions} onPick={v => setColumn(m.field, v)} />
                          </td>
                          <td>
                            {/* A required field with no column, which Ira will
                                work out per row, is not a failure — it is the
                                assistant's job showing up. Amber and named,
                                rather than the red "missing" that means stop. */}
                            {fillable.some(x => x.field === m.field)
                              ? <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md bg-mitigated-50 text-mitigated-800 text-[0.65625rem] font-bold whitespace-nowrap" title="Not a column in this file — Ira reads it off the row's other columns at the next step, and shows you what it read it from">
                                  <Sparkles size={9} /> {previewRows.length > 0
                                    ? `Ira will fill — read on ${fillCounts.get(m.field) ?? 0} of ${previewRows.length} rows`
                                    : 'Ira will fill this'}
                                </span>
                              : atReview.some(x => x.field === m.field)
                                ? <span className="inline-flex items-center h-[22px] px-2 rounded-md bg-paper-100 text-ink-600 text-[0.65625rem] font-bold whitespace-nowrap" title="Not a column in this file — filled in at Review, row by row or once for every row">
                                    You'll fill at Review{previewRows.length > 0 ? ` · ${previewRows.length} rows` : ''}
                                  </span>
                                : <ConfidencePill match={m} missing={blocking.some(x => x.field === m.field)} />}
                          </td>
                          <td><span className="block truncate text-ink-500" title={sampleValue || undefined}>{sampleValue || <span className="text-ink-300">—</span>}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── the columns nothing above claimed ──────────────────────
                  This said "Columns not imported", which was not true and had
                  not been true for a long time: `buildImportRows` keeps every
                  unclaimed column on the row as an extra, and the matrix prints
                  all of them. What the table above decides is which columns the
                  product READS — the ones it tests and reports on — not which
                  ones survive the import (user ask, 22 Sep).

                  So it says what actually happens. A reader who came here to
                  rescue a column they thought was being dropped was being sent
                  to fix something that was not broken. */}
              {unusedColumns.length > 0 && (
                <div className="mt-4">
                  <p className={labelCls}>Also imported · {plural(unusedColumns.length, 'column')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unusedColumns.map(o => (
                      <span key={o.i} className="inline-flex items-center h-6 px-2 rounded-md border border-canvas-border bg-paper-50 text-[0.71875rem] text-ink-600">{o.label}</span>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-ink-400 mt-1.5">
                    {unusedColumns.length === 1 ? 'This one comes across' : 'These come across'} with every row and {unusedColumns.length === 1 ? 'shows' : 'show'} in the matrix, but nothing tests {unusedColumns.length === 1 ? 'it' : 'them'}. Point a field above at one to have it read.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Prompt ── */}
          {/* Full width (user ask, 24 Sep). It was capped at 54rem inside a
              1100px modal, so a quarter of the dialog sat empty beside the one
              thing the step is for — and the prompt is an instruction the reader
              edits, not prose they read, so the measure argument that earns a
              cap elsewhere does not apply. */}
          {step === 'prompt' && (
            <div>
              {/* While Ira runs, the run IS the screen (user ask, 24 Sep). The
                  progress list used to sit under a 16-row textarea that was
                  disabled and dimmed anyway — so the one thing actually happening
                  was the smallest thing on the page, below the fold on a short
                  window, under something nobody could use. The prompt steps
                  aside and comes back untouched if the draft fails. */}
              {extracting ? (
                <div ref={progressRef} role="status" aria-live="polite"
                  className="rounded-xl border border-canvas-border bg-paper-50/50 px-5 py-5">
                  <p className="text-[0.71875rem] font-semibold text-compliant-700 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Prompt validated
                  </p>
                  <h3 className="mt-2 text-[0.9375rem] font-semibold text-ink-900 flex items-center gap-2">
                    <Sparkles size={15} className="text-brand-600 shrink-0" aria-hidden />
                    Reading {file.name}
                  </h3>
                  <p className="mt-0.5 text-[0.75rem] text-ink-500">Drafting the {process} RACM — this takes a moment.</p>
                  {/* A quantity, not a verdict: how far through the four steps. */}
                  <div className="mt-3.5 h-1 rounded-full bg-paper-200 overflow-hidden" role="presentation">
                    <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
                      style={{ width: `${Math.round((extract.done / EXTRACT_STEPS.length) * 100)}%` }} />
                  </div>
                  <ul className="mt-3.5 space-y-2.5">
                    {EXTRACT_STEPS.map((s, i) => (
                      <li key={s} className="flex items-center gap-2.5 text-[0.8125rem]">
                        {i < extract.done
                          ? <CheckCircle2 size={15} className="text-compliant-600 shrink-0" />
                          : i === extract.done
                            ? <Loader2 size={15} className="text-brand-600 animate-spin shrink-0" />
                            : <Circle size={15} className="text-ink-300 shrink-0" />}
                        <span className={i < extract.done ? 'text-ink-500' : i === extract.done ? 'text-ink-900 font-semibold' : 'text-ink-400'}>{s}</span>
                      </li>
                    ))}
                  </ul>
                  {/* The last beat used to be 300ms of four ticks and no spinner —
                      a finished list that had not moved on, which reads as stuck. */}
                  {extract.done >= EXTRACT_STEPS.length && (
                    <p className="mt-3.5 text-[0.75rem] font-semibold text-brand-700 flex items-center gap-1.5">
                      <Loader2 size={13} className="animate-spin shrink-0" /> Opening the draft…
                    </p>
                  )}
                </div>
              ) : (
                /* The prompt and what it produces, side by side (user ask, 25
                   Sep): "flowchart mere prompt ke side mein aayega. Agar main
                   prompt change karungi, to flowchart bhi change ho jayega."
                   The chart is the prompt's read-out — type a line, watch the
                   controls it draws appear or go. It stacks on a narrow window,
                   prompt first, because the prompt is the thing being written. */
                <div className="grid gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] items-start">
                  <div>
                    <div className="flex items-end justify-between gap-3 mb-1.5">
                      <label htmlFor="sop-prompt" className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Extraction prompt</label>
                      <button type="button" onClick={() => { setPrompt(DEFAULT_SOP_PROMPT); setPromptTooShort(false); }} disabled={prompt === DEFAULT_SOP_PROMPT}
                        className="inline-flex items-center gap-1 text-[0.71875rem] font-semibold text-brand-700 enabled:hover:text-brand-800 disabled:text-ink-300 disabled:cursor-not-allowed cursor-pointer">
                        <RotateCcw size={11} /> Reset to default
                      </button>
                    </div>
                    <textarea id="sop-prompt" rows={16} value={prompt}
                      onChange={e => { setPrompt(e.target.value); if (promptTooShort) setPromptTooShort(false); }}
                      aria-invalid={promptTooShort || undefined} aria-describedby={promptTooShort ? 'sop-prompt-error' : 'sop-prompt-hint'}
                      className={cn('w-full rounded-lg border bg-canvas-elevated p-3 text-[0.78125rem] leading-relaxed text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-y',
                        promptTooShort ? 'border-risk-300' : 'border-canvas-border')} />
                    {promptTooShort
                      ? <p id="sop-prompt-error" role="alert" className="text-[0.71875rem] text-risk-700 mt-1.5">Write what Ira should extract — the prompt is too short to run.</p>
                      : <p id="sop-prompt-hint" className="text-[0.71875rem] text-ink-500 mt-1.5">Ira extracts only after you validate this prompt.</p>}
                    {extract.phase === 'failed' && (
                      <p role="alert" className="mt-4 text-[0.75rem] text-risk-700 flex items-center gap-1.5"><AlertTriangle size={13} /> Ira couldn't draft a RACM from {file.name} — try again.</p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">What this prompt draws</p>
                      <span className="text-[0.6875rem] text-ink-400 tabular-nums">{plural(liveDraft.length, 'control')}</span>
                    </div>
                    {/* A name is faster to fix here than to describe in the
                        prompt, so it can be typed straight onto the box — and it
                        survives the next keystroke in the prompt, because it is
                        stored against the draft's own IDs rather than the rows. */}
                    <p className="text-[0.71875rem] text-ink-500 mb-3">
                      Edit the prompt to change what Ira extracts. To change only a name, click it on the chart.
                    </p>
                    <div className="rounded-xl border border-canvas-border bg-paper-50/40 px-3 py-3 max-h-[30rem] overflow-y-auto">
                      {liveDraft.length === 0 ? (
                        <p className="py-10 text-center text-[0.75rem] text-ink-500">This prompt draws no controls. Widen it to see something here.</p>
                      ) : (
                        <SopFlowchartView compact rows={liveDraft} process={process} entity={entity} source={file.name}
                          idFor={r => cell(r.values.controlId) || r.key} omitted={0}
                          ungrouped={ungrouped} nameFor={stageNameFor} classifyBy={classifyBy} onUngroup={setUngrouped}
                          onRenameRisk={renameRisk} onRenameControl={renameControl} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Review ── */}
          {step === 'review' && (
            <>
              {/* Three tiers, because eight facts on one line is eight facts nobody
                  reads (user ask, 24 Sep). The ANSWER first — how many of these rows
                  are actually going in, which is the question the reader arrived
                  with and the number the button at the bottom repeats. Then only
                  what still needs a decision. Then the notes, small, at the end.
                  "N left out" and "N suggested · M accepted" have gone: the first
                  is the other half of a fraction now stated whole, the second is
                  what the tick boxes already show. */}
              <div className="mb-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-[0.9375rem] font-semibold text-ink-900 tabular-nums">
                    {included.length} of {plural(effective.length, 'row')} will be imported
                  </p>
                  <span className="text-[0.75rem] text-ink-500 tabular-nums">{plural(attributeCount, 'attribute')} · {plural(requiredFileCount, 'required file')}</span>
                  <div className="flex-1" />
                  {/* Brand, not amber. Ira filling a blank is help, and an amber
                      chip said "problem" about the one thing on this screen that
                      had already been dealt with. */}
                  <button type="button" onClick={() => setFillOpen(o => !o)} disabled={filledCount === 0} aria-expanded={fillOpen}
                    className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-[0.75rem] font-semibold text-brand-700 enabled:hover:border-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    <Sparkles size={13} aria-hidden /> Ira filled {filledCount} {filledCount === 1 ? 'blank' : 'blanks'}
                    <ChevronDown size={12} aria-hidden className={cn('transition-transform', fillOpen && 'rotate-180')} />
                  </button>
                </div>
                {/* Two sentences, where there were three amber pills (24 Sep).
                    "1 row needs a value · 3 rows already in this RACM · 2 possible
                    duplicates" was three counts in the colour of alarm, none of
                    which said what to do or where to look, and the middle two
                    counted the same idea twice. Each line now says what happened,
                    to how many rows, and what is expected of the reader — and
                    nothing appears at all when there is nothing to say. */}
                {(needFix > 0 || duplicateCount > 0) && (
                  <div className="mt-2 space-y-1">
                    {duplicateCount > 0 && (
                      <p className="flex items-start gap-1.5 text-[0.75rem] leading-snug text-ink-700">
                        <Copy size={12} className="mt-0.5 shrink-0 text-ink-500" aria-hidden />
                        <span>
                          <span className="font-semibold">{plural(duplicateCount, 'row')}</span>{' '}
                          {duplicateCount === 1 ? 'is a duplicate' : 'are duplicates'} of a control we already hold, so{' '}
                          {duplicateCount === 1 ? 'it is' : 'they are'} left out. Each one shows which control{' '}
                          {duplicateCount === 1 ? 'it repeats' : 'they repeat'}, field by field.
                        </span>
                      </p>
                    )}
                    {needFix > 0 && (
                      <p className="flex items-start gap-1.5 text-[0.75rem] leading-snug text-mitigated-700">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden />
                        <span>
                          <span className="font-semibold">{needFix} {needFix === 1 ? 'row needs' : 'rows need'} a value from you</span>{' '}
                          before {needFix === 1 ? 'it' : 'they'} can be imported — the box under{' '}
                          {needFix === 1 ? 'that row' : 'each row'} asks for it.
                        </span>
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-1.5 text-[0.6875rem] text-ink-400" title="Each client group has its own column set-up, on the RACM Config tab. This upload follows the group its company belongs to.">
                  {[`Using ${setup.label}'s columns`,
                    mergedCount > 0 && `${plural(mergedCount, 'duplicate design check')} merged`,
                    iraCheckCount > 0 && `${plural(iraCheckCount, 'design check')} written by Ira`].filter(Boolean).join(' · ')}
                </p>
              </div>

              {/* A9 — what Ira read off each row's other cells, already in the
                  rows below, with the reason and a way back to blank. Nothing
                  is saved until Import either way. */}
              {fillOpen && (
                <section aria-label="Values Ira filled" className="rounded-xl border border-mitigated-200 bg-canvas-elevated mb-3">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-canvas-border">
                    <div className="min-w-0">
                      <h3 className="text-[0.8125rem] font-semibold text-ink-900">Values Ira filled</h3>
                      <p className="text-[0.71875rem] text-ink-500">Read off each row's other cells where the file left the field blank. Clear any of them before you import.</p>
                    </div>
                    <div className="flex-1" />
                    <button type="button" onClick={undoAllFills} className={quietBtn}><Undo2 size={12} /> Clear all</button>
                  </div>
                  <div className="max-h-[18rem] overflow-y-auto">
                    {filledList.map(({ row, fills: fs }) => (
                      <div key={row.key} className="px-4 py-2.5 border-b border-canvas-border last:border-b-0">
                        <p className="text-[0.6875rem] font-semibold text-ink-500 mb-1.5">Row {row.rowNo} · <span className="font-mono">{idOf(row)}</span></p>
                        <ul className="space-y-2">
                          {fs.map(f => (
                            <li key={f.field} className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-[0.75rem] text-ink-700">
                                  <span className="font-semibold text-ink-800">{fieldLabel(f.field)}:</span>{' '}
                                  <span className="font-medium text-ink-900">{f.value}</span>
                                </p>
                                <p className="text-[0.6875rem] text-ink-400 leading-snug">{f.reason}</p>
                              </div>
                              <button type="button" onClick={() => undoFill(row.key, f.field)} className={cn(quietBtn, 'shrink-0')}
                                aria-label={`Clear ${fieldLabel(f.field)} on row ${row.rowNo} back to blank`}>
                                <Undo2 size={12} /> Clear
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Three things come out of one SOP (25 Sep) — this is the switch
                  between them. It sits BELOW the summary because the summary is
                  true of every view: how many rows are going in does not change
                  with the way you read them. */}
              {showViews && (
                <div role="tablist" aria-label="How to read this draft" className="inline-flex items-center gap-0.5 rounded-lg border border-canvas-border bg-paper-50 p-0.5 mb-4">
                  {REVIEW_VIEWS.map(({ key, label, Icon, hint }) => {
                    const on = activeView === key;
                    return (
                      <button key={key} type="button" role="tab" aria-selected={on} title={hint} onClick={() => setView(key)}
                        className={cn('h-7 px-3 inline-flex items-center gap-1.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer',
                          on ? 'bg-canvas text-ink-900 border border-canvas-border' : 'border border-transparent text-ink-500 hover:text-ink-800')}>
                        <Icon size={13} aria-hidden /> {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeView === 'narrative' && (
                <SopNarrativeView rows={included} process={process} entity={entity} source={file.name}
                  idFor={idFor} omitted={effective.length - included.length}
                  ungrouped={ungrouped} nameFor={stageNameFor} classifyBy={classifyBy}
                  onRenameStage={(name, to) => setStageNames(prev => ({ ...prev, [name]: to }))}
                  onUngroup={setUngrouped} />
              )}

              {activeView === 'flowchart' && (
                <SopFlowchartView rows={included} process={process} entity={entity} source={file.name}
                  idFor={idFor} omitted={effective.length - included.length}
                  ungrouped={ungrouped} nameFor={stageNameFor} classifyBy={classifyBy} onUngroup={setUngrouped}
                  onRenameRisk={renameRisk} onRenameControl={renameControl} />
              )}

              {activeView === 'matrix' && (<>
              {/* People a whole file may lack a column for — set once for every
                  row still missing one (22 Sep). */}
              {peopleGaps.map(g => (
                <SetForAllBox key={g.field} label={fieldLabel(g.field)} count={g.rows.length} people={tenantPeople}
                  noColumn={mode === 'racm' ? !matches.some(m => m.field === g.field && m.column !== null) : false}
                  onApply={v => setForAll(g.field, v)} />
              ))}

              {/* IDs (S11) — the short codes every row's ID is built from, in
                  the order they read (entity, then process). A band of three
                  labelled inputs sat here permanently for something almost
                  nobody changes; it now states the ID and opens on ask — or on
                  its own, the moment a code is wrong. */}
              {included.length > 0 && (
                <section aria-label="Control IDs" className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-2.5 mb-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className="min-w-0 text-[0.75rem] text-ink-600">
                      IDs will read{' '}
                      <span className="font-mono font-semibold text-ink-900">{newIds.get(included[0]!.key)}</span>
                      <span className="text-ink-400"> — entity / process / risk / control</span>
                    </p>
                    <div className="flex-1" />
                    <button type="button" onClick={() => setCodesOpen(o => !o)} aria-expanded={codesShown} aria-controls="racm-import-codes"
                      className={cn(quietBtn, 'shrink-0')}>
                      {codesShown ? 'Done' : 'Edit the codes'}
                      <ChevronDown size={12} aria-hidden className={cn('transition-transform', codesShown && 'rotate-180')} />
                    </button>
                  </div>
                  {codesShown && (
                    <div id="racm-import-codes" className="mt-3 pt-3 border-t border-canvas-border flex flex-wrap items-start gap-x-5 gap-y-2.5">
                      {entityCodeErrors.map(({ name, code, error }, i) => (
                        <div key={name}>
                          <label htmlFor={`racm-import-entity-code-${i}`} className={cn(labelCls, 'max-w-[16rem] truncate')} title={name}>Entity code · {name}</label>
                          <input id={`racm-import-entity-code-${i}`} value={code} maxLength={3} onChange={e => setEntityCodeDrafts(prev => ({ ...prev, [name]: cleanCode(e.target.value) }))}
                            aria-invalid={!!error} aria-describedby={error ? `racm-import-entity-code-error-${i}` : undefined}
                            className={cn('h-8 w-[5.5rem] px-2 rounded-lg border bg-canvas text-[0.78125rem] font-mono font-semibold text-ink-900 uppercase focus:outline-none focus:ring-2 focus:ring-brand-200', error ? 'border-risk-400' : 'border-canvas-border')} />
                          {error && <p id={`racm-import-entity-code-error-${i}`} className="mt-1 text-[0.6875rem] text-risk-700">{error}</p>}
                        </div>
                      ))}
                      <div>
                        <label htmlFor="racm-import-process-code" className={labelCls}>Process code · {process}</label>
                        <input id="racm-import-process-code" value={processCode} maxLength={3} onChange={e => setProcessCodeDraft(cleanCode(e.target.value))}
                          aria-invalid={!!processCodeError} aria-describedby={processCodeError ? 'racm-import-process-code-error' : undefined}
                          className={cn('h-8 w-[5.5rem] px-2 rounded-lg border bg-canvas text-[0.78125rem] font-mono font-semibold text-ink-900 uppercase focus:outline-none focus:ring-2 focus:ring-brand-200', processCodeError ? 'border-risk-400' : 'border-canvas-border')} />
                        {processCodeError && <p id="racm-import-process-code-error" className="mt-1 text-[0.6875rem] text-risk-700">{processCodeError}</p>}
                      </div>
                      <p className="min-w-0 flex-1 basis-[16rem] text-[0.71875rem] text-ink-500 leading-snug">
                        Numbers come from the file's own Risk ID and Control ID, else the row order.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-canvas-border py-14 text-center text-[0.78125rem] text-ink-500">
                  {mode === 'racm' ? 'No rows to import — nothing sits below the header row you picked.' : `Ira found no controls to draft from ${file.name}.`}
                </div>
              ) : (
                <div className="reg-wrap">
                  <table className="w-full border-collapse table-fixed" style={{ minWidth: 800 }}>
                    <thead className="reg-head">
                      <tr>
                        {/* One box per row, and one at the head for all of them. */}
                        <th style={{ width: 76 }}>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer" title="Import every row">
                            <input type="checkbox" aria-label="Import every row"
                              checked={included.length === effective.length && effective.length > 0}
                              ref={el => { if (el) el.indeterminate = included.length > 0 && included.length < effective.length; }}
                              onChange={e => setAllIncluded(e.target.checked)} className="accent-brand-600 cursor-pointer" />
                            Import
                          </label>
                        </th>
                        <th style={{ width: 148 }}>Control ID</th>
                        <th>Control</th>
                        <th style={{ width: 170 }}>Frequency</th>
                        <th style={{ width: 186 }}>Brings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effective.map(row => {
                        const open = expanded.has(row.key);
                        const sugg = suggestions.get(row.key) ?? [];
                        const checkSugg = sugg.filter(s => s.kind === 'check').length;
                        const attrSugg = sugg.length - checkSugg;
                        const detailId = `racm-import-detail-${row.key}`;
                        const addedAttrs = new Set((acceptedSugg[row.key]?.attributes ?? []).map(norm));
                        const addedChecks = new Set((acceptedSugg[row.key]?.designChecks ?? []).map(norm));
                        const isIn = isIncluded(row);
                        // Nothing is asked of a row that is not going in. A duplicate
                        // we already hold, or a draft nobody ticked, is not worth a
                        // risk owner, a set of design checks and a frequency first —
                        // that is work collected and then thrown away.
                        const blanks = isIn ? coreBlanks(row, cfg.core) : [];
                        const clientBlanks = isIn ? extraBlanks(row, cfg.extras) : [];
                        const rowFills = fillsByRow.get(row.key) ?? [];
                        const freqIdea = row.frequency ? undefined : rowFills.find(f => f.field === 'frequency');
                        /** Everything this row still needs, asked for in one box below it. */
                        const needsFix = isIn && (blanks.length > 0 || clientBlanks.length > 0 || row.frequency === null);
                        return (
                          <Fragment key={row.key}>
                            {/* Not `opacity-50` any more: half-faded text is the one thing a
                                reviewer still has to READ before deciding, and fading it said
                                "disabled" about a row that is entirely theirs to turn back on.
                                The unticked box carries the state; this only steps the row back. */}
                            <tr className={cn('reg-row reg-static', !isIn && 'bg-paper-50/70')}>
                              <td>
                                <label htmlFor={`racm-import-take-${row.key}`} className="inline-flex items-center gap-2 cursor-pointer"
                                  title={isIn ? `Row ${row.rowNo} will be imported` : `Row ${row.rowNo} will not be imported`}>
                                  <input id={`racm-import-take-${row.key}`} type="checkbox" checked={isIn}
                                    aria-label={`Import ${idOf(row)}`}
                                    onChange={e => setIncluded(row, e.target.checked)} className="accent-brand-600 cursor-pointer" />
                                  <span className={cn('text-[0.65625rem] font-semibold uppercase tracking-wide', isIn ? 'text-ink-500' : 'text-ink-400')}>{isIn ? 'In' : 'Out'}</span>
                                </label>
                              </td>
                              <td>
                                {newIds.get(row.key)
                                  ? <span className="font-mono text-[0.6875rem] font-semibold text-ink-800 break-all">{newIds.get(row.key)}</span>
                                  : <span className="text-ink-300">—</span>}
                                {cell(row.values.controlId) && <span className="block font-mono text-[0.625rem] text-ink-400 break-all mt-0.5">File: {cell(row.values.controlId)}</span>}
                              </td>
                              <td className="tight">
                                {/* The title IS the door. A 36px column holding only
                                    a chevron was a heading-wide target for the one
                                    thing every row can do. */}
                                <button type="button" onClick={() => toggleExpanded(row.key)} aria-expanded={open} aria-controls={detailId}
                                  title={cell(row.values.controlActivity) || titleOf(row)}
                                  className="group w-full flex items-start gap-1.5 text-left cursor-pointer">
                                  <ChevronRight size={13} aria-hidden
                                    className={cn('mt-0.5 shrink-0 text-ink-400 transition-transform group-hover:text-ink-700', open && 'rotate-90')} />
                                  <span className="min-w-0 text-[0.78125rem] font-medium text-ink-900 leading-snug line-clamp-2 group-hover:text-brand-700 transition-colors">
                                    {titleOf(row)}
                                  </span>
                                </button>
                                <div className="mt-1 ml-[1.15rem] flex items-center gap-1.5 flex-wrap">
                                  {/* The star moved here from a column of its own:
                                      "Key" described the control, so it belongs
                                      beside the control's name. */}
                                  {row.isKey && (
                                    <span className="inline-flex items-center gap-1 text-[0.65625rem] font-semibold text-mitigated-700" title="Key control">
                                      <Star size={11} className="fill-mitigated-200" aria-hidden /> Key
                                    </span>
                                  )}
                                  {row.origin === 'sop' && <Pill tone="evidence">From the SOP{row.sectionRef ? ` · ${row.sectionRef}` : ''}</Pill>}
                                  {row.origin === 'suggested' && <Pill tone="info">Suggested by Ira</Pill>}
                                  {row.origin === 'file' && <span className="font-mono text-[0.65625rem] text-ink-400">Row {row.rowNo}</span>}
                                </div>
                              </td>
                              <td className="tight">
                                {/* The picker is gone from this cell. A select, a
                                    note, Ira's reading and a "Leave out" button all
                                    lived in a 184px column while the row's OTHER
                                    missing values were asked for in a box below —
                                    two places, two shapes, one job. The cell now
                                    reports; the box below asks. */}
                                {row.frequency
                                  ? <span className="text-ink-700">{row.frequency}</span>
                                  : (
                                    <span className="inline-flex items-center gap-1 text-[0.71875rem] font-semibold text-mitigated-700">
                                      <AlertTriangle size={11} className="shrink-0" aria-hidden /> Not set
                                    </span>
                                  )}
                              </td>
                              <td className="tight">
                                <p className="text-[0.71875rem] text-ink-600 leading-snug tabular-nums">
                                  {plural(row.attributes.length, 'attribute')} · {plural(row.designChecks.length, 'check')}
                                </p>
                                {row.mergedDuplicateChecks > 0 && (
                                  <p className="text-[0.65625rem] text-ink-400">{row.mergedDuplicateChecks} merged</p>
                                )}
                                {sugg.length > 0 && (
                                  <button type="button" onClick={() => { if (!open) toggleExpanded(row.key); }} aria-controls={detailId}
                                    aria-label={`Ira suggests ${[checkSugg > 0 && plural(checkSugg, 'design check'), attrSugg > 0 && plural(attrSugg, 'attribute')].filter(Boolean).join(' and ')} — show them`}
                                    className="mt-1 h-6 px-1.5 -ml-1.5 inline-flex items-center gap-1 rounded-md text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer whitespace-nowrap">
                                    <Sparkles size={11} className="shrink-0" aria-hidden />
                                    {[checkSugg > 0 && `+${plural(checkSugg, 'check')}`, attrSugg > 0 && `+${plural(attrSugg, 'attribute')}`].filter(Boolean).join(' · ')} from Ira
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* A duplicate says why, in full, before anything else —
                                it is the one row on this screen that arrives with a
                                decision already taken for it. */}
                            {row.duplicateOf && (
                              <DuplicateBand key={`dup-${row.key}`} row={row} twin={twinValues(row)} included={isIn} colSpan={reviewCols} />
                            )}
                            {needsFix && (
                              <BlankFixRow key={`fix-${row.key}`} row={row} blanks={blanks} clientBlanks={clientBlanks} fills={rowFills}
                                needsFrequency={row.frequency === null} frequencyNote={frequencyNote(row)} frequencyIdea={freqIdea?.value}
                                attributeIdeas={sugg.filter(x => x.kind === 'attribute').map(x => x.text)}
                                checkIdeas={sugg.filter(x => x.kind === 'check').map(x => x.text)}
                                colSpan={reviewCols} people={tenantPeople} onSet={(field, value) => setValue(row.key, field, value)}
                                onSetExtra={(header, value) => setExtra(row.key, header, value)} onLeaveOut={() => setIncluded(row, false)} />
                            )}
                            {/* The "Left out — row N won't be imported. Put back" strip has gone
                                (user ask, 24 Sep). It was a second table row under every excluded
                                row, saying in a sentence what the tick box now says at a glance —
                                and "Put back" read as a different, undo-ish act from the tick
                                beside it, which is exactly the confusion it added. */}
                            {open && (
                              <tr className="def-detail" id={detailId}>
                                <td colSpan={reviewCols}>
                                  {/* The people on the row, editable — so a value set for
                                      every row at once can be changed on one (22 Sep). A
                                      name cleared here puts the row back in its fill box. */}
                                  <div className="pt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.71875rem]">
                                    {PEOPLE_FIELDS.map(f => (
                                      <label key={f} className="inline-flex items-center gap-1.5">
                                        <span className="font-semibold text-ink-500">{fieldLabel(f)}:</span>
                                        <select value={cell(row.values[f])}
                                          aria-label={`${fieldLabel(f)} for row ${row.rowNo}`}
                                          onChange={e => { if (e.target.value !== cell(row.values[f])) setValue(row.key, f, e.target.value); }}
                                          className="h-7 w-44 px-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
                                          <option value="">Nobody yet</option>
                                          {/* What the client's file wrote, when it names somebody
                                              this tenant has never added — kept so opening the row
                                              cannot quietly discard the matrix's own answer. */}
                                          {fromFileOption(cell(row.values[f]), tenantPeople).map(v => (
                                            <option key={v} value={v}>{v} — from the file</option>
                                          ))}
                                          {tenantPeople.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                      </label>
                                    ))}
                                  </div>
                                  {(cell(row.values.riskTitle) || cell(row.values.riskDescription) || cell(row.values.controlActivity) || cell(row.values.effectiveDate) || cell(row.values.country) || row.testingStrategy || Object.keys(row.extras).length > 0) && (
                                    <div className="pt-2.5 space-y-1 text-[0.71875rem] leading-relaxed">
                                      {cell(row.values.riskTitle) && (
                                        <p className="text-ink-600"><span className="font-semibold text-ink-500">Risk title:</span> {cell(row.values.riskTitle)}</p>
                                      )}
                                      {cell(row.values.riskDescription) && (
                                        <p className="text-ink-600"><span className="font-semibold text-ink-500">Risk{cell(row.values.riskId) ? ` ${cell(row.values.riskId)}` : ''}:</span> {cell(row.values.riskDescription)}</p>
                                      )}
                                      {cell(row.values.controlActivity) && (
                                        <p className="text-ink-600 whitespace-pre-line"><span className="font-semibold text-ink-500">Control description:</span> {cell(row.values.controlActivity)}</p>
                                      )}
                                      {/* The 17 Sep columns, shown only when the file
                                          carried them — three permanent dashes on every
                                          expanded row would say nothing. */}
                                      {Object.keys(row.extras).length > 0 && (
                                        // The file's own columns, said back to the
                                        // reviewer so they can see nothing was
                                        // thrown away on the way in.
                                        <p className="text-ink-500">
                                          <span className="font-semibold text-ink-500">Kept from the file:</span>{' '}
                                          {/* Named and ordered by the set-up, so a column
                                              renamed on the Config tab reads the same here
                                              as it will on the matrix after import. A value
                                              whose column is not in the set-up still shows,
                                              under the heading the file gave it. */}
                                          {[
                                            ...cfg.extras.map(e => [extraLabel(e), extraValue(row, e)] as const).filter(([, v]) => v),
                                            ...Object.entries(row.extras).filter(([k]) => !cfg.extras.some(e => normaliseHeader(e.header) === normaliseHeader(k))),
                                          ].map(([k, v]) => `${k} — ${v}`).join(' · ')}
                                        </p>
                                      )}
                                      {(cell(row.values.effectiveDate) || cell(row.values.country) || row.testingStrategy) && (
                                        <p className="text-ink-600">{[
                                          cell(row.values.effectiveDate) && `Effective ${cell(row.values.effectiveDate)}`,
                                          cell(row.values.country),
                                          row.testingStrategy,
                                        ].filter(Boolean).join(' · ')}</p>
                                      )}
                                    </div>
                                  )}
                                  <div className="grid gap-5 pt-3 md:grid-cols-3">
                                    <div className="min-w-0">
                                      <p className={labelCls}>Attributes ({row.attributes.length})</p>
                                      {row.attributes.length === 0 ? <p className="text-[0.71875rem] text-ink-400">None in the file.</p> : (
                                        <ol className="space-y-2">
                                          {row.attributes.map((a, i) => (
                                            <li key={`${a.text}-${i}`} className="text-[0.75rem] text-ink-700 flex gap-2">
                                              <span className="font-mono text-[0.65625rem] text-ink-400 tabular-nums mt-0.5 shrink-0">{i + 1}.</span>
                                              <span className="min-w-0">
                                                <span className="leading-snug">{a.text}</span>
                                                {addedAttrs.has(norm(a.text)) && <span className="ml-1.5 text-[0.625rem] font-semibold text-brand-700">Added from Ira</span>}
                                                <span className="mt-1 flex flex-wrap gap-1">
                                                  {a.requiredFiles.length === 0
                                                    ? <span className="text-[0.65625rem] text-ink-400">No required files</span>
                                                    : a.requiredFiles.map((rf, j) => (
                                                      <span key={`${rf}-${j}`} className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-canvas-border bg-canvas-elevated text-[0.65625rem] text-ink-600">
                                                        <Paperclip size={10} className="text-ink-400 shrink-0" /> {rf}
                                                      </span>
                                                    ))}
                                                </span>
                                              </span>
                                            </li>
                                          ))}
                                        </ol>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={labelCls}>Design checks ({row.designChecks.length})</p>
                                      {row.designChecks.length === 0 ? <p className="text-[0.71875rem] text-ink-400">None in the file.</p> : (
                                        <ul className="space-y-1.5">
                                          {row.designChecks.map((c, i) => (
                                            <li key={`${c}-${i}`} className="text-[0.75rem] text-ink-700 leading-snug flex gap-1.5">
                                              <Check size={11} className="text-ink-400 mt-0.5 shrink-0" />
                                              <span>{c}{addedChecks.has(norm(c)) && <span className="ml-1.5 text-[0.625rem] font-semibold text-brand-700">Added from Ira</span>}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      {row.mergedDuplicateChecks > 0 && (
                                        <p className="text-[0.6875rem] text-ink-400 mt-1.5">{plural(row.mergedDuplicateChecks, 'duplicate check')} merged into the ones above.</p>
                                      )}
                                    </div>
                                    {/* A7 — Ira's additions wait for a decision; accepted ones join the lists beside them */}
                                    <div className="min-w-0">
                                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-1.5 flex items-center gap-1"><Sparkles size={11} className="text-brand-600" /> Ira suggests</p>
                                      {sugg.length === 0 ? <p className="text-[0.71875rem] text-ink-400">Nothing to add.</p> : (
                                        <ul className="space-y-2">
                                          {sugg.map(s => {
                                            const kind = s.kind === 'check' ? 'design check' : 'attribute';
                                            return (
                                              <li key={s.id} className="rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 py-2">
                                                <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400">{s.kind === 'check' ? 'Design check' : 'Attribute'}</p>
                                                <p className="text-[0.75rem] text-ink-700 leading-snug mt-0.5">{s.text}</p>
                                                <div className="mt-1.5 flex items-center gap-1">
                                                  <button type="button" onClick={() => acceptSuggestion(row.key, s)} aria-label={`Accept ${kind}: ${s.text}`}
                                                    className="h-6 px-2 inline-flex items-center gap-1 rounded-md bg-brand-600 text-white text-[0.6875rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
                                                    <Check size={11} /> Accept
                                                  </button>
                                                  <button type="button" onClick={() => dismissSuggestion(row.key, s)} aria-label={`Dismiss ${kind}: ${s.text}`}
                                                    className="h-6 px-2 inline-flex items-center rounded-md text-[0.6875rem] font-semibold text-ink-500 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer">
                                                    Dismiss
                                                  </button>
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </>)}
            </>
          )}
        </div>

        {/* footer — always in view: the way back, and the one thing this step is for */}
        <div className="shrink-0 border-t border-canvas-border px-5 py-3 flex items-center gap-3">
          {step === 'review' ? (
            <button type="button" onClick={() => { setFillOpen(false); setStep(mode === 'racm' ? 'columns' : 'prompt'); }} className={secondaryBtn}><ArrowLeft size={13} /> Back</button>
          ) : (
            <button type="button" onClick={onClose} disabled={extracting} className={cn(secondaryBtn, 'disabled:opacity-40 disabled:cursor-not-allowed')}>Cancel</button>
          )}
          <div className="flex-1" />

          {step === 'columns' && read.status === 'ready' && (
            <>
              {(blocking.length > 0 || fillable.length > 0 || atReviewCount > 0 || dataRowCount === 0) && (
                <span className={cn('text-[0.71875rem]', blocking.length > 0 || dataRowCount === 0 ? 'text-ink-500' : 'text-ink-400 inline-flex items-center gap-1')}>
                  {dataRowCount === 0
                    ? 'No rows below the header row'
                    : blocking.length > 0
                      ? 'Pick a column for the control title or description to continue'
                      /* Nothing is holding the import — this is Ira saying what
                         it is about to do, and every fill is listed with its
                         reason at Review before anything is written. The count
                         she is not part of includes the client's own required
                         columns: those are only ever filled by hand. */
                      : fillable.length > 0
                        ? <><Sparkles size={11} className="text-brand-500 shrink-0" /> Ira will fill {plural(fillable.length, 'required field')} from the rows themselves{atReviewCount > 0 ? ` · ${atReviewCount} filled in at Review` : ''}</>
                        : `${plural(atReviewCount, 'required field')} ${atReviewCount === 1 ? 'is' : 'are'} filled in at Review`}
                </span>
              )}
              <button type="button" onClick={columnsToReview} disabled={blocking.length > 0 || dataRowCount === 0} className={primaryBtn}>Continue</button>
            </>
          )}

          {step === 'prompt' && (
            <button type="button" onClick={validateAndExtract} disabled={extracting} className={primaryBtn}>
              {extracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {extracting ? 'Extracting…' : 'Validate prompt & extract'}
            </button>
          )}

          {step === 'review' && (
            <>
              {/* Nothing ticked used to say NOTHING. Every message below counts
                  `included`, so with none of them the row of reasons went quiet
                  and the reader was left with a disabled button reading zero and
                  no account of why. It is the first thing to answer, not the
                  case nobody thought about. */}
              {included.length === 0 && (
                <span className="text-[0.71875rem] text-mitigated-700">
                  {effective.length === 0 ? 'Nothing to import.' : `No rows ticked — tick the ones to import, or Import all at the top of the list.`}
                </span>
              )}
              {included.length > 0 && needFix > 0 && (
                <span className="text-[0.71875rem] text-mitigated-700">
                  {needFix} {needFix === 1 ? 'row still needs' : 'rows still need'} {missingLabels.length > 1 ? `${missingLabels.slice(0, -1).join(', ')} or ${missingLabels[missingLabels.length - 1]}` : missingLabels[0]}
                </span>
              )}
              {included.length > 0 && needFix === 0 && !codesOk && (
                <span className="text-[0.71875rem] text-risk-700">Fix the ID codes to import</span>
              )}
              {/* A warning, not a wall. The reviewer has ticked a duplicate back
                  in, which is theirs to do — this only makes sure they read what
                  it means before pressing the button. */}
              {included.length > 0 && needFix === 0 && codesOk && duplicatesIncluded > 0 && (
                <span className="text-[0.71875rem] text-mitigated-700">
                  {duplicatesIncluded === 1
                    ? 'Includes 1 duplicate — that control will be written a second time'
                    : `Includes ${duplicatesIncluded} duplicates — those controls will be written a second time`}
                </span>
              )}
              <button type="button" onClick={doImport} disabled={!canImport} className={primaryBtn}>Import {plural(included.length, 'control')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
