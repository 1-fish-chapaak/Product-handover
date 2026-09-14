/**
 * RACM import review — everything between choosing a file on the RACM tab and a
 * RACM appearing in its list. Nothing reaches the engagement until Import.
 *
 *   Upload a RACM (A5):  Columns (match the file's columns to our fields) → Review → Import
 *   Upload an SOP (A6):  Prompt (read it, edit it, validate it) → extraction → Review → Import
 *
 * Review is the same screen for both: a frequency Ira can't use blocks its row
 * until one is picked (A13), Ira suggests missing attributes and design checks
 * per row (A7), a row that repeats another RACM's control is flagged (A8), blank
 * cells can be filled from the row's other columns — previewed, decided, then
 * applied (A9) — and merged duplicate design checks are counted (R2). The
 * reading and matching itself lives in racmImport.ts; this file only decides
 * what the reviewer sees and when a value is written.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Circle, FileSpreadsheet, FileText, FileWarning,
  Loader2, Paperclip, RotateCcw, Sparkles, Star, Wand2, X,
} from 'lucide-react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { Pill } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import type { Frequency } from './types';
import {
  RACM_FIELDS, DEFAULT_SOP_PROMPT,
  readRacmWorkbook, guessHeaderRow, matchColumns, needsAttention,
  buildImportRows, rowFromValues, proposeBlankFills, suggestForRow, importRowsToControls, draftRowsFromSop,
  type ColumnMatch, type ImportRow, type RacmFieldKey, type SheetData,
} from './racmImport';

type Step = 'columns' | 'prompt' | 'review';

export interface RacmImportReviewProps {
  mode: 'racm' | 'sop';
  file: File;
  process: string;
  /** The company chosen in the Create RACM chooser — '' when the engagement names none. */
  entity: string;
  onClose: () => void;
  /** Called after the RACM is created, with the number of controls it got. */
  onImported: (count: number) => void;
}

const RACM_STEPS: { key: Step; label: string }[] = [{ key: 'columns', label: 'Columns' }, { key: 'review', label: 'Review' }];
const SOP_STEPS: { key: Step; label: string }[] = [{ key: 'prompt', label: 'Prompt' }, { key: 'review', label: 'Review' }];

/** Never "Continuous" — a control that runs all the time is tested at the
 *  frequency its evidence is produced at, so the reviewer picks that. */
const FREQUENCIES: Frequency[] = ['Annual', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Recurring', 'Ad-hoc'];

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

const labelCls = 'text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-1.5 block';
const selectCls = 'h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200';
const primaryBtn = 'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';
const secondaryBtn = 'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer';
const quietBtn = 'h-7 px-2 inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
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

function StepRail({ steps, current }: { steps: { key: Step; label: string }[]; current: Step }) {
  const at = steps.findIndex(s => s.key === current);
  return (
    <ol className="flex items-center gap-2" aria-label="Import steps">
      {steps.map((s, i) => {
        const done = i < at;
        const on = i === at;
        return (
          <li key={s.key} className="flex items-center gap-2" aria-current={on ? 'step' : undefined}>
            {i > 0 && <span className={cn('w-6 h-px', done || on ? 'bg-brand-300' : 'bg-canvas-border')} aria-hidden />}
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

/** How sure the match is. A required field with nothing matched is the only
 *  error; a low score is a prompt to look, not a block. */
function ConfidencePill({ match, missing }: { match: ColumnMatch; missing: boolean }) {
  if (match.column === null) return missing ? <Pill tone="risk">No column</Pill> : <span className="text-ink-300">—</span>;
  const tone = match.confidence >= 90 ? 'compliant' : match.confidence >= 70 ? 'draft' : 'mitigated';
  return <Pill tone={tone}>{match.confidence}%</Pill>;
}

export default function RacmImportReview({ mode, file, process, entity, onClose, onImported }: RacmImportReviewProps) {
  const { eng, createRacm } = useIcfr();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
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
  /** Keyed `${row.key}|${field}`; absent = undecided. Nothing is written until Apply. */
  const [fillDecisions, setFillDecisions] = useState<Record<string, 'accept' | 'reject'>>({});

  const resetReview = () => {
    setAcceptedRows(new Set()); setAcceptedSugg({}); setDismissedSugg({});
    setExpanded(new Set()); setFillOpen(false); setFillDecisions({});
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
      setSheetIx(ix); setHeaderRow(h); setMatches(matchColumns(sheetRows[h] ?? []));
      setRead({ status: 'ready', sheets });
    }).catch(() => { if (alive) setRead({ status: 'failed' }); });
    return () => { alive = false; };
  }, [mode, file]);

  const sheet = read.status === 'ready' ? read.sheets[sheetIx] : undefined;
  const headers = sheet?.rows[headerRow] ?? [];
  const sample = sheet ? firstDataRow(sheet.rows, headerRow) : undefined;
  const dataRowCount = sheet ? sheet.rows.slice(headerRow + 1).filter(r => !isBlankRow(r)).length : 0;
  const attention = useMemo(() => (matches.length ? needsAttention(matches) : []), [matches]);
  /** Required fields nothing is mapped to — these, and only these, hold Continue. */
  const missingRequired = useMemo(() => {
    const pairMapped = matches.some(m => TITLE_PAIR.includes(m.field) && m.column !== null);
    return matches.filter(m => {
      if (m.column !== null || !FIELD_BY_KEY.get(m.field)?.required) return false;
      return TITLE_PAIR.includes(m.field) ? !pairMapped : true;
    });
  }, [matches]);
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
    setSheetIx(ix); setHeaderRow(h); setMatches(matchColumns(sheetRows[h] ?? []));
  };
  const pickHeaderRow = (h: number) => {
    setHeaderRow(h);
    setMatches(matchColumns(sheet?.rows[h] ?? []));
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
    createRacm(process, file.name, entity, { source: 'racm' });
    logEvent({ action: 'Create', description: `Created the ${process} RACM from its template — "${file.name}" had no rows to read`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'RACM created', message: `The ${process} RACM starts from its template — "${file.name}" is kept as its source file.` });
    onClose();
  };

  const columnsToReview = () => {
    if (!sheet) return;
    const sig = JSON.stringify([sheetIx, headerRow, matches]);
    if (builtFrom.current !== sig) {
      setRows(buildImportRows(sheet.rows, headerRow, matches, eng.controls, process));
      resetReview();
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
        setRows(draftRowsFromSop(process, file.name, used, eng.controls));
        resetReview();
        builtFrom.current = used;
        setExtract({ phase: 'idle' });
        setStep('review');
      } catch {
        setExtract({ phase: 'failed' });
      }
    }, EXTRACT_STEPS.length * EXTRACT_STEP_MS + 300));
  };

  // ── Review derivations ────────────────────────────────────────────────────────
  const effective = useMemo(() => rows.map(r => withAccepted(r, acceptedSugg[r.key])), [rows, acceptedSugg]);
  const included = useMemo(() => effective.filter(r => r.origin !== 'suggested' || acceptedRows.has(r.key)), [effective, acceptedRows]);
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
  const fills = useMemo(() => effective.map(row => ({ row, fills: proposeBlankFills(row) })).filter(g => g.fills.length > 0), [effective]);
  const fillCount = fills.reduce((n, g) => n + g.fills.length, 0);
  const fillKey = (rowKey: string, field: RacmFieldKey) => `${rowKey}|${field}`;
  const fillTally = fills.reduce((t, g) => {
    g.fills.forEach(f => { const d = fillDecisions[fillKey(g.row.key, f.field)]; if (d === 'accept') t.accepted++; else if (d === 'reject') t.rejected++; });
    return t;
  }, { accepted: 0, rejected: 0 });

  const attributeCount = included.reduce((n, r) => n + r.attributes.length, 0);
  const requiredFileCount = included.reduce((n, r) => n + r.attributes.reduce((m, a) => m + a.requiredFiles.length, 0), 0);
  const mergedCount = included.reduce((n, r) => n + r.mergedDuplicateChecks, 0);
  const needFrequency = included.filter(r => r.frequency === null).length;
  const duplicateCount = included.filter(r => r.duplicateOf).length;
  const suggestedRowCount = rows.filter(r => r.origin === 'suggested').length;
  const canImport = included.length > 0 && needFrequency === 0;

  const toggleExpanded = (key: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleRow = (key: string) => setAcceptedRows(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const pickFrequency = (rowKey: string, value: Frequency) =>
    setRows(prev => prev.map(r => (r.key === rowKey ? rowFromValues({ ...r.values, frequency: value }, r, eng.controls, process) : r)));
  const acceptSuggestion = (rowKey: string, s: Suggestion) => setAcceptedSugg(prev => {
    const cur = prev[rowKey] ?? { attributes: [], designChecks: [] };
    return { ...prev, [rowKey]: s.kind === 'attribute' ? { ...cur, attributes: [...cur.attributes, s.text] } : { ...cur, designChecks: [...cur.designChecks, s.text] } };
  });
  const dismissSuggestion = (rowKey: string, s: Suggestion) => setDismissedSugg(prev => ({ ...prev, [rowKey]: [...(prev[rowKey] ?? []), s.id] }));

  const decideFill = (key: string, d: 'accept' | 'reject') => setFillDecisions(prev => {
    const n = { ...prev };
    if (n[key] === d) delete n[key]; else n[key] = d;   // pressing the chosen one again undecides it
    return n;
  });
  const decideAllFills = (d: 'accept' | 'reject') => setFillDecisions(Object.fromEntries(fills.flatMap(g => g.fills.map(f => [fillKey(g.row.key, f.field), d]))));
  const cancelFills = () => { setFillOpen(false); setFillDecisions({}); };
  const applyFills = () => {
    const byRow = new Map<string, Partial<Record<RacmFieldKey, string>>>();
    let n = 0;
    fills.forEach(({ row, fills: fs }) => fs.forEach(f => {
      if (fillDecisions[fillKey(row.key, f.field)] !== 'accept') return;
      byRow.set(row.key, { ...(byRow.get(row.key) ?? {}), [f.field]: f.value });
      n++;
    }));
    if (!n) return;
    setRows(prev => prev.map(r => { const patch = byRow.get(r.key); return patch ? rowFromValues({ ...r.values, ...patch }, r, eng.controls, process) : r; }));
    cancelFills();
    addToast({ type: 'success', title: `Filled ${n} blank${n === 1 ? '' : 's'}`, message: 'The values are in the review rows — nothing is saved until you import.' });
  };

  const doImport = () => {
    if (!canImport) return;
    let controls;
    try {
      controls = importRowsToControls(included, process);
    } catch {
      addToast({ type: 'error', title: "Couldn't import", message: 'Every row needs a frequency before it can be imported.' });
      return;
    }
    // the SOP stays viewable from the RACM's row menu for this session
    const url = mode === 'sop' ? URL.createObjectURL(file) : undefined;
    createRacm(process, file.name, entity, { controls, source: mode, url });
    const n = controls.length;
    logEvent(mode === 'sop'
      ? { action: 'Create', description: `Extracted the ${process} RACM from "${file.name}" — ${plural(n, 'control')}`, module: 'SOX ICFR', entity: 'RACM' }
      : { action: 'Upload', description: `Imported the ${process} RACM from "${file.name}" — ${plural(n, 'control')}`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: mode === 'sop' ? 'RACM extracted' : 'RACM imported', message: `${plural(n, 'control')} added to the ${process} RACM` });
    onImported(n);
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
      if (fillOpen) { cancelFills(); return; }
      if (step !== 'review' && !extracting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const steps = mode === 'racm' ? RACM_STEPS : SOP_STEPS;
  const reviewCols = mode === 'sop' ? 9 : 8;

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
            <div className="flex items-center gap-4 shrink-0">
              <StepRail steps={steps} current={step} />
              <button onClick={onClose} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
            </div>
          </div>
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
              {attention.length > 0 ? (
                <div className="rounded-lg border border-mitigated-200 bg-mitigated-50 px-3.5 py-2.5 mb-4">
                  <p className="text-[0.75rem] font-semibold text-mitigated-700 flex items-center gap-1.5"><AlertTriangle size={13} /> Needs attention</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {attention.map(m => (
                      <li key={m.field} className="text-[0.75rem] text-ink-700">
                        <span className="font-semibold text-ink-800">{fieldLabel(m.field)}</span> — {m.column === null ? 'No column found' : 'Low confidence — check it'}
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
                                  title={TITLE_PAIR.includes(m.field) ? 'Control title or Control activity — one of the two is enough' : undefined}>Required</span>
                              )}
                            </span>
                          </td>
                          <td>
                            <select id={`racm-import-col-${m.field}`} aria-label={`Column in your file for ${f?.label ?? m.field}`}
                              value={m.column === null ? '' : String(m.column)} onChange={e => setColumn(m.field, e.target.value)}
                              className={cn(selectCls, 'w-full h-8 text-[0.75rem]')}>
                              <option value="">— Not in file —</option>
                              {columnOptions.map(o => <option key={o.i} value={o.i}>{o.label}</option>)}
                            </select>
                          </td>
                          <td><ConfidencePill match={m} missing={missingRequired.some(x => x.field === m.field)} /></td>
                          <td><span className="block truncate text-ink-500" title={sampleValue || undefined}>{sampleValue || <span className="text-ink-300">—</span>}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {unusedColumns.length > 0 && (
                <div className="mt-4">
                  <p className={labelCls}>Columns not imported</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unusedColumns.map(o => (
                      <span key={o.i} className="inline-flex items-center h-6 px-2 rounded-md border border-canvas-border bg-paper-50 text-[0.71875rem] text-ink-600">{o.label}</span>
                    ))}
                  </div>
                  <p className="text-[0.6875rem] text-ink-400 mt-1.5">Pick one for a field in the table to bring it in.</p>
                </div>
              )}
            </>
          )}

          {/* ── Prompt ── */}
          {step === 'prompt' && (
            <div className="max-w-[54rem]">
              <div className="flex items-end justify-between gap-3 mb-1.5">
                <label htmlFor="sop-prompt" className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">Extraction prompt</label>
                <button type="button" onClick={() => { setPrompt(DEFAULT_SOP_PROMPT); setPromptTooShort(false); }} disabled={prompt === DEFAULT_SOP_PROMPT || extracting}
                  className="inline-flex items-center gap-1 text-[0.71875rem] font-semibold text-brand-700 enabled:hover:text-brand-800 disabled:text-ink-300 disabled:cursor-not-allowed cursor-pointer">
                  <RotateCcw size={11} /> Reset to default
                </button>
              </div>
              <textarea id="sop-prompt" rows={16} value={prompt} disabled={extracting}
                onChange={e => { setPrompt(e.target.value); if (promptTooShort) setPromptTooShort(false); }}
                aria-invalid={promptTooShort || undefined} aria-describedby={promptTooShort ? 'sop-prompt-error' : 'sop-prompt-hint'}
                className={cn('w-full rounded-lg border bg-canvas-elevated p-3 text-[0.78125rem] leading-relaxed text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-y disabled:opacity-60',
                  promptTooShort ? 'border-risk-300' : 'border-canvas-border')} />
              {promptTooShort
                ? <p id="sop-prompt-error" role="alert" className="text-[0.71875rem] text-risk-700 mt-1.5">Write what Ira should extract — the prompt is too short to run.</p>
                : <p id="sop-prompt-hint" className="text-[0.71875rem] text-ink-500 mt-1.5">Ira extracts only after you validate this prompt.</p>}

              {extract.phase === 'running' && (
                <div ref={progressRef} className="mt-4" role="status" aria-live="polite">
                  <p className="text-[0.75rem] font-semibold text-compliant-700 flex items-center gap-1.5"><CheckCircle2 size={13} /> Prompt validated</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {EXTRACT_STEPS.map((s, i) => (
                      <li key={s} className="flex items-center gap-2 text-[0.71875rem]">
                        {i < extract.done
                          ? <CheckCircle2 size={12} className="text-compliant-600 shrink-0" />
                          : i === extract.done
                            ? <Loader2 size={12} className="text-brand-600 animate-spin shrink-0" />
                            : <Circle size={12} className="text-ink-300 shrink-0" />}
                        <span className={i < extract.done ? 'text-ink-600' : i === extract.done ? 'text-ink-800 font-medium' : 'text-ink-400'}>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {extract.phase === 'failed' && (
                <p role="alert" className="mt-4 text-[0.75rem] text-risk-700 flex items-center gap-1.5"><AlertTriangle size={13} /> Ira couldn't draft a RACM from {file.name} — try again.</p>
              )}
            </div>
          )}

          {/* ── Review ── */}
          {step === 'review' && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
                <p className="text-[0.78125rem] text-ink-600 tabular-nums">
                  <span className="font-semibold text-ink-900">{plural(included.length, 'control')}</span> · {plural(attributeCount, 'attribute')} · {plural(requiredFileCount, 'required file')}
                </p>
                {mergedCount > 0 && <span className="text-[0.71875rem] text-ink-500 tabular-nums">{plural(mergedCount, 'duplicate design check')} merged</span>}
                {needFrequency > 0 && <Pill tone="mitigated">{needFrequency} {needFrequency === 1 ? 'row needs' : 'rows need'} a frequency</Pill>}
                {duplicateCount > 0 && <Pill tone="mitigated">{plural(duplicateCount, 'possible duplicate')}</Pill>}
                {mode === 'sop' && suggestedRowCount > 0 && (
                  <span className="text-[0.71875rem] text-ink-500 tabular-nums">{suggestedRowCount} suggested by Ira · {acceptedRows.size} accepted</span>
                )}
                <div className="flex-1" />
                <button type="button" onClick={() => (fillOpen ? cancelFills() : setFillOpen(true))} disabled={fillCount === 0} aria-expanded={fillOpen}
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] font-semibold text-ink-700 enabled:hover:text-brand-700 enabled:hover:border-brand-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
                  <Wand2 size={13} /> Fill blanks from other columns
                  <span className="min-w-5 h-5 px-1 rounded-full bg-paper-100 text-ink-600 text-[0.6875rem] tabular-nums inline-flex items-center justify-center">{fillCount}</span>
                </button>
              </div>

              {/* A9 — every proposal shown before → after. Decisions are held here and
                  only Apply writes them into the rows below. */}
              {fillOpen && (
                <section aria-label="Fill blanks from other columns" className="rounded-xl border border-canvas-border bg-canvas-elevated mb-3">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-canvas-border">
                    <div className="min-w-0">
                      <h3 className="text-[0.8125rem] font-semibold text-ink-900">Fill blanks from other columns</h3>
                      <p className="text-[0.71875rem] text-ink-500">Values read off each row's other cells. Nothing changes until you apply.</p>
                    </div>
                    <div className="flex-1" />
                    <button type="button" onClick={() => decideAllFills('accept')} className={quietBtn}><Check size={12} /> Accept all</button>
                    <button type="button" onClick={() => decideAllFills('reject')} className={quietBtn}><X size={12} /> Reject all</button>
                  </div>
                  <div className="max-h-[18rem] overflow-y-auto">
                    {fills.map(({ row, fills: fs }) => (
                      <div key={row.key} className="px-4 py-2.5 border-b border-canvas-border last:border-b-0">
                        <p className="text-[0.6875rem] font-semibold text-ink-500 mb-1.5">Row {row.rowNo} · <span className="font-mono">{idOf(row)}</span></p>
                        <ul className="space-y-2">
                          {fs.map(f => {
                            const k = fillKey(row.key, f.field);
                            const d = fillDecisions[k];
                            return (
                              <li key={f.field} className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[0.75rem] text-ink-700">
                                    <span className="font-semibold text-ink-800">{fieldLabel(f.field)}:</span>{' '}
                                    <span className="text-ink-400" aria-hidden>—</span><span className="sr-only">blank</span>{' '}
                                    <span className="text-ink-400" aria-hidden>→</span><span className="sr-only">becomes</span>{' '}
                                    <span className="font-medium text-ink-900">{f.value}</span>
                                  </p>
                                  <p className="text-[0.6875rem] text-ink-400 leading-snug">{f.reason}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`${fieldLabel(f.field)} on row ${row.rowNo}`}>
                                  <button type="button" aria-pressed={d === 'accept'} onClick={() => decideFill(k, 'accept')}
                                    className={cn(quietBtn, d === 'accept' && 'bg-compliant-50 border-compliant-300 text-compliant-700 hover:text-compliant-700 hover:border-compliant-300')}>
                                    <Check size={12} /> Accept
                                  </button>
                                  <button type="button" aria-pressed={d === 'reject'} onClick={() => decideFill(k, 'reject')}
                                    className={cn(quietBtn, d === 'reject' && 'bg-paper-100 border-ink-300 text-ink-800')}>
                                    <X size={12} /> Reject
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 border-t border-canvas-border">
                    <span className="mr-auto text-[0.71875rem] text-ink-400 tabular-nums">
                      {fillTally.accepted} accepted · {fillTally.rejected} rejected · {fillCount - fillTally.accepted - fillTally.rejected} undecided
                    </span>
                    <button type="button" onClick={cancelFills} className={cn(secondaryBtn, 'h-8')}>Cancel</button>
                    <button type="button" onClick={applyFills} disabled={fillTally.accepted === 0} className={cn(primaryBtn, 'h-8')}>Apply {fillTally.accepted} accepted</button>
                  </div>
                </section>
              )}

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-canvas-border py-14 text-center text-[0.78125rem] text-ink-500">
                  {mode === 'racm' ? 'No rows to import — nothing sits below the header row you picked.' : `Ira found no controls to draft from ${file.name}.`}
                </div>
              ) : (
                <div className="reg-wrap overflow-x-auto">
                  <table className="w-full border-collapse table-fixed" style={{ minWidth: mode === 'sop' ? 1040 : 960 }}>
                    <thead className="reg-head">
                      <tr>
                        {mode === 'sop' && <th style={{ width: 84 }}><span className="sr-only">Accept suggested row</span></th>}
                        <th style={{ width: 36 }}><span className="sr-only">Details</span></th>
                        <th style={{ width: 100 }}>Control ID</th>
                        <th>Control</th>
                        <th style={{ width: 184 }}>Frequency</th>
                        <th style={{ width: 52 }}>Key</th>
                        <th style={{ width: 92 }}>Attributes</th>
                        <th style={{ width: 112 }}>Design checks</th>
                        <th style={{ width: 168 }}>Ira suggests</th>
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
                        return (
                          <Fragment key={row.key}>
                            <tr className="reg-row reg-static">
                              {mode === 'sop' && (
                                <td>
                                  {row.origin === 'suggested' && (
                                    <label htmlFor={`racm-import-accept-${row.key}`} className="inline-flex items-center gap-1.5 text-[0.71875rem] font-semibold text-ink-600 cursor-pointer">
                                      <input id={`racm-import-accept-${row.key}`} type="checkbox" checked={acceptedRows.has(row.key)} onChange={() => toggleRow(row.key)} className="accent-brand-600 cursor-pointer" />
                                      Accept
                                    </label>
                                  )}
                                </td>
                              )}
                              <td>
                                <button type="button" onClick={() => toggleExpanded(row.key)} aria-expanded={open} aria-controls={detailId}
                                  aria-label={`${open ? 'Hide' : 'Show'} attributes and design checks for ${idOf(row)}`}
                                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 hover:bg-paper-50 cursor-pointer">
                                  <ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} />
                                </button>
                              </td>
                              <td><span className="font-mono text-[0.71875rem] font-semibold text-ink-700 break-all">{idOf(row)}</span></td>
                              <td className="tight">
                                <div className="text-[0.78125rem] font-medium text-ink-900 leading-snug line-clamp-2" title={cell(row.values.controlActivity) || titleOf(row)}>{titleOf(row)}</div>
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  {row.origin === 'sop' && <Pill tone="evidence">From the SOP{row.sectionRef ? ` · ${row.sectionRef}` : ''}</Pill>}
                                  {row.origin === 'suggested' && <Pill tone="info">Suggested by Ira</Pill>}
                                  {row.origin === 'file' && <span className="font-mono text-[0.65625rem] text-ink-400">Row {row.rowNo}</span>}
                                </div>
                                {/* A8 — a warning, not a block: the same control can legitimately sit in two processes */}
                                {row.duplicateOf && (
                                  <p className="mt-1 text-[0.6875rem] leading-snug text-mitigated-700 flex items-start gap-1 whitespace-normal">
                                    <AlertTriangle size={11} className="mt-0.5 shrink-0" /> <span>{row.duplicateOf.reason}</span>
                                  </p>
                                )}
                              </td>
                              <td className="tight">
                                {row.frequency ? <span className="text-ink-700">{row.frequency}</span> : (
                                  <>
                                    <select id={`racm-import-freq-${row.key}`} aria-label={`Frequency for ${idOf(row)}`} aria-describedby={`racm-import-freq-note-${row.key}`}
                                      value="" onChange={e => { if (e.target.value) pickFrequency(row.key, e.target.value as Frequency); }}
                                      className="w-full h-8 px-2 rounded-lg border border-mitigated-300 bg-canvas-elevated text-[0.75rem] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
                                      <option value="" disabled>Pick a frequency</option>
                                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <p id={`racm-import-freq-note-${row.key}`} className="mt-1 text-[0.65625rem] leading-snug text-mitigated-700 whitespace-normal">{frequencyNote(row)}</p>
                                  </>
                                )}
                              </td>
                              <td>
                                {row.isKey
                                  ? <span role="img" aria-label="Key control" title="Key control" className="inline-flex"><Star size={13} className="text-mitigated-600 fill-mitigated-200" aria-hidden /></span>
                                  : <span className="text-ink-300">—</span>}
                              </td>
                              <td>
                                <button type="button" onClick={() => toggleExpanded(row.key)} aria-expanded={open} aria-controls={detailId}
                                  aria-label={`${plural(row.attributes.length, 'attribute')} — ${open ? 'hide' : 'show'} them`}
                                  className="tabular-nums font-medium text-ink-700 hover:text-brand-700 underline decoration-dotted decoration-ink-300 underline-offset-2 cursor-pointer">
                                  {row.attributes.length}
                                </button>
                              </td>
                              <td>
                                <span className="tabular-nums font-medium text-ink-700">{row.designChecks.length}</span>
                                {row.mergedDuplicateChecks > 0 && <span className="block text-[0.65625rem] text-ink-400">{row.mergedDuplicateChecks} merged</span>}
                              </td>
                              <td>
                                {sugg.length > 0 ? (
                                  <button type="button" onClick={() => { if (!open) toggleExpanded(row.key); }} aria-controls={detailId}
                                    className="h-7 px-2 -ml-2 inline-flex items-center gap-1 rounded-md text-[0.71875rem] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer whitespace-nowrap">
                                    <Sparkles size={12} className="shrink-0" />
                                    {[checkSugg > 0 && `+${plural(checkSugg, 'check')}`, attrSugg > 0 && `+${plural(attrSugg, 'attribute')}`].filter(Boolean).join(' · ')}
                                  </button>
                                ) : <span className="text-ink-300">—</span>}
                              </td>
                            </tr>

                            {open && (
                              <tr className="def-detail" id={detailId}>
                                <td colSpan={reviewCols}>
                                  {(cell(row.values.riskDescription) || cell(row.values.controlActivity)) && (
                                    <div className="pt-2.5 space-y-1 text-[0.71875rem] leading-relaxed">
                                      {cell(row.values.riskDescription) && (
                                        <p className="text-ink-600"><span className="font-semibold text-ink-500">Risk{cell(row.values.riskId) ? ` ${cell(row.values.riskId)}` : ''}:</span> {cell(row.values.riskDescription)}</p>
                                      )}
                                      {cell(row.values.controlActivity) && (
                                        <p className="text-ink-600 whitespace-pre-line"><span className="font-semibold text-ink-500">Activity:</span> {cell(row.values.controlActivity)}</p>
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
            </>
          )}
        </div>

        {/* footer — always in view: the way back, and the one thing this step is for */}
        <div className="shrink-0 border-t border-canvas-border px-5 py-3 flex items-center gap-3">
          {step === 'review' ? (
            <button type="button" onClick={() => { cancelFills(); setStep(mode === 'racm' ? 'columns' : 'prompt'); }} className={secondaryBtn}><ArrowLeft size={13} /> Back</button>
          ) : (
            <button type="button" onClick={onClose} disabled={extracting} className={cn(secondaryBtn, 'disabled:opacity-40 disabled:cursor-not-allowed')}>Cancel</button>
          )}
          <div className="flex-1" />

          {step === 'columns' && read.status === 'ready' && (
            <>
              {(missingRequired.length > 0 || dataRowCount === 0) && (
                <span className="text-[0.71875rem] text-ink-500">
                  {dataRowCount === 0
                    ? 'No rows below the header row'
                    : missingRequired.length === 1
                      ? `Pick a column for ${fieldLabel(missingRequired[0]!.field)} to continue`
                      : `${missingRequired.length} required fields still need a column`}
                </span>
              )}
              <button type="button" onClick={columnsToReview} disabled={missingRequired.length > 0 || dataRowCount === 0} className={primaryBtn}>Continue</button>
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
              {needFrequency > 0 && (
                <span className="text-[0.71875rem] text-mitigated-700">{needFrequency} {needFrequency === 1 ? 'row still needs' : 'rows still need'} a frequency</span>
              )}
              <button type="button" onClick={doImport} disabled={!canImport} className={primaryBtn}>Import {plural(included.length, 'control')}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
