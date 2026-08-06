import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Search, Plus, Building2, Rows3, Star, FileText, X, Send, LayoutGrid, List,
  FlaskConical, ListChecks, Sparkles, Workflow, History, ArrowRight, Clock,
} from 'lucide-react';
import { FilterSelect, HeaderFilter, triggerCls } from '../shared/FilterSelect';
import Drawer from '../shared/Drawer';
import { GROUP_OPTIONS, groupKeyOf, useColumnWidths, type GroupBy } from './registerColumns';
import { useAuditControls } from './useAuditControls';
import { useIcfr } from './store';
import { auditCovers, isOwnerOf, ownersOf } from './auditScope';
import {
  conclusionOf, controlCode, courtFor, failedItgcs, isAwaitingReview, isControlFinal, isEngagementLocked, isItgcDependent, isTestDueNow,
} from './helpers';
import { ItgcCascadeBanner, NatureChip, Th, Tickmark } from './parts';
import NewControlPanel from './NewControlPanel';
import WorkingPaperModal from './WorkingPaperModal';
import { useToast } from '../shared/Toast';
import { cn } from '../../lib/cn';
import type { AuditRecord, Control, IcfrEngagement, RunKind, RunRecord } from './types';

/**
 * Control Library — the LIBRARY lens (user ask, 30 Jul).
 *
 * What the engagement-level Control Library answers here is "what is this
 * control made of and what has happened to it": how many attributes it is
 * tested against, how many of those a workflow evidences, what has been run on
 * it and when, and which audit cycles it sits in. Four facts, all of them
 * already in the store — nothing here is invented.
 *
 * The TESTING lens — design and operating effectiveness side by side, the
 * conclusion pill, the due-now / awaiting-review rail — is PARKED, not deleted.
 * It is `ControlRegister.tsx`, untouched, and it still renders for every classic
 * SOX engagement (SoxClassicApp). Restoring it here is flipping LIBRARY_LENS in
 * SoxIcfrApp.tsx; nothing else has to move.
 *
 * Known consequence while the testing lens is off: the Overview's counts (Due
 * now, Effective, Awaiting review, Waiting on owner) used to land on a filtered
 * register. They still land here filtered — the preset arrives as a dismissible
 * chip above the list (see `preset` below) — but there is no dropdown to reach
 * those views from cold, because they are testing questions and this lens does
 * not ask them. The control page and the RACM still carry every conclusion.
 */

// binding colours, one per process — same shelf spines as the testing lens, so a
// process keeps its colour across both
const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]; }

export const KIND_META: Record<RunKind, { label: string; Icon: typeof FlaskConical; chip: string }> = {
  'bulk-test': { label: 'Bulk test', Icon: FlaskConical, chip: 'bg-brand-50 text-brand-700' },
  'control-test': { label: 'Control test', Icon: ListChecks, chip: 'bg-evidence-50 text-evidence-700' },
  'workflow-run': { label: 'Workflow run', Icon: Workflow, chip: 'bg-compliant-50 text-compliant-700' },
  'ai-validation': { label: 'AI validation', Icon: Sparkles, chip: 'bg-mitigated-50 text-mitigated-700' },
};

// ── the four facts ───────────────────────────────────────────────────────────────

/** Attributes, and how many of them a workflow evidences.
 *
 *  Attribute-level only, deliberately: every seeded design consideration also
 *  carries a workflow, so counting those would add the same constant to every
 *  control and say nothing. Attributes are where mapping is a choice — it is
 *  what `mapStepWorkflow` writes — so that is the number worth showing. */
export function attributeStats(c: Control): { attrs: number; mapped: number } {
  const attrs = c.operating.steps.length;
  return { attrs, mapped: c.operating.steps.filter(s => s.workflowId).length };
}

/** Every run this control appears in, newest first (the registry is stored that
 *  way, so document order is date order). */
export function runsForControl(runs: RunRecord[], controlId: string): RunRecord[] {
  return runs.filter(r => r.controls.some(rc => rc.controlId === controlId));
}

/** This control's outcome inside one run. */
export const outcomeIn = (r: RunRecord, controlId: string) => r.controls.find(rc => rc.controlId === controlId);

export const auditsForControl = (eng: IcfrEngagement, c: Control): AuditRecord[] =>
  eng.audits.filter(a => auditCovers(a, c, eng.id));

// ── filters ─────────────────────────────────────────────────────────────────────

type Coverage = 'All' | 'full' | 'partial' | 'none' | 'run' | 'never';
// ── Columns ─────────────────────────────────────────────────────────────────────
//
// The library's own lens (attributes, workflow coverage, where it has been used)
// with the RACM columns the audit register grew. Widths and drag behaviour come
// from the shared hook, so the two registers can never diverge on how they feel.
const LIB_COLS = [
  { key: 'process', w: 130 },
  { key: 'control', w: 330 },
  { key: 'entity', w: 160 },
  { key: 'type', w: 124 },
  { key: 'frequency', w: 116 },
  { key: 'owner', w: 144 },
  { key: 'objective', w: 250 },
  { key: 'nature', w: 108 },
  { key: 'attributes', w: 92 },
  { key: 'workflows', w: 150 },
  { key: 'runs', w: 120 },
  { key: 'last', w: 180 },
] as const;
const COLW_KEY = 'sox-library-colw';

const COVERAGE_OPTIONS: { value: Coverage; label: string }[] = [
  { value: 'All', label: 'All controls' },
  { value: 'full', label: 'Every attribute mapped' },
  { value: 'partial', label: 'Some attributes mapped' },
  { value: 'none', label: 'No workflows mapped' },
  { value: 'run', label: 'Has been run' },
  { value: 'never', label: 'Never run' },
];

/** The Overview's counts still deep-link in. They are testing questions, so the
 *  lens has no dropdown for them — it honours the preset once and says so. */
const PRESET_LABEL: Record<string, string> = {
  due: 'Tests due now', court: 'In your court', design: 'TOD not tested', 'design-done': 'TOD concluded',
  operating: 'TOE not tested', 'operating-done': 'TOE concluded', effective: 'Effective',
  exceptions: 'Not effective', review: 'Awaiting review', owner: 'Waiting on owner',
  open: 'Not concluded', papers: 'Awaiting sign-off', key: 'Key controls',
  itgc: 'Test-of-one withdrawn',
};

// ── card ────────────────────────────────────────────────────────────────────────

/** "Last run" fact, self-contained tags (label baked into the tag text, not a
 *  separate eyebrow above it) — shared between the grid card and the
 *  control's own detail page, so they never drift apart. Not clickable — the
 *  full history itself lives on the control's own page now. */
export function LastRunFact({ c, runs }: { c: Control; runs: RunRecord[] }) {
  const last = runs[0];
  const lastOutcome = last ? outcomeIn(last, c.id) : undefined;
  const Kind = last ? KIND_META[last.kind] : undefined;
  if (!(last && Kind && lastOutcome)) {
    return (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-paper-50 border border-canvas-border text-[0.625rem] font-semibold text-ink-400">
        <Clock size={10} /> Never run
      </span>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-paper-50 border border-canvas-border text-[0.625rem] font-semibold text-ink-500">
          <Clock size={10} /> Last run: {last.at}
        </span>
        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-paper-50 border border-canvas-border text-[0.625rem] font-semibold text-ink-500">
          <History size={10} /> {runs.length} run{runs.length === 1 ? '' : 's'}
        </span>
      </div>
      <span className="inline-flex items-center gap-1 shrink-0">
        <Tickmark result={lastOutcome.outcome} size={13} />
        <span className={cn('text-[0.6875rem] font-semibold', lastOutcome.outcome === 'Effective' ? 'text-compliant-700' : 'text-risk-700')}>{lastOutcome.outcome}</span>
      </span>
    </div>
  );
}

function LibraryCard({ c, runs, audits, onOpen, selectable, selected, onToggle }: {
  c: Control; runs: RunRecord[]; audits: AuditRecord[];
  onOpen: () => void;
  selectable?: boolean; selected?: boolean; onToggle?: () => void;
}) {
  const { attrs, mapped } = attributeStats(c);

  return (
    <div role="button" tabIndex={0} className={cn('ac-card text-left', selected && 'ring-2 ring-brand-200 border-brand-300')}
      onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }} aria-label={`Open ${c.id} — ${c.description}`}>
      <div className="flex items-center gap-2">
        {selectable && (
          <input type="checkbox" checked={!!selected} onClick={e => e.stopPropagation()} onChange={onToggle}
            className="cursor-pointer accent-brand-600 shrink-0" aria-label={`Select ${c.id}`} />
        )}
        <span className="ac-eyebrow"><span className="dot" style={{ background: spineColor(c.process) }} /><span className="lbl">{c.process}</span></span>
        <span className="ml-auto inline-flex items-center gap-2 shrink-0">
          {c.isKey && <Star size={11} className="text-mitigated-500 fill-mitigated-100" />}
        </span>
      </div>
      <h3 className="ac-title mt-2">{c.description}</h3>
      <div className="ac-meta">{controlCode(c)} · {c.nature} · {c.frequency}</div>
      {/* The company this row is tested at, on its own line — same as the audit
          register: at another company it is a different control with its own life. */}
      {c.entity && (
        <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-600 min-w-0" title={c.entity}>
          <Building2 size={11} className="text-ink-300 shrink-0" />
          <span className="truncate font-medium">{c.entity}</span>
        </div>
      )}
      <div className="ac-div" />

      {/* three stats, equal weight, side by side — was three ragged label/value
          rows (one truncating a repeated audit-period list mid-word) */}
      <div className="grid grid-cols-3 gap-x-2">
        <div>
          <div className="text-[1.0625rem] font-bold text-ink-900 tabular-nums leading-none">{attrs}</div>
          <div className="text-[0.65625rem] text-ink-500 font-medium mt-1.5">Attributes</div>
        </div>
        <div>
          <div className={cn('text-[1.0625rem] font-bold tabular-nums leading-none', mapped === 0 ? 'text-ink-400' : 'text-ink-900')}>{mapped}</div>
          <div className="text-[0.65625rem] text-ink-500 font-medium mt-1.5">Mapped</div>
        </div>
        <div>
          <div className={cn('text-[1.0625rem] font-bold tabular-nums leading-none', audits.length === 0 ? 'text-ink-400' : 'text-ink-900')}>{audits.length}</div>
          <div className="text-[0.65625rem] text-ink-500 font-medium mt-1.5">Audit runs</div>
        </div>
      </div>

      <div className="ac-div" />
      <LastRunFact c={c} runs={runs} />
    </div>
  );
}

// ── run history — as a drawer (grid/table quick-look) or inline (control page) ────

/** The run history list itself, independent of how it's framed — a drawer on
 *  the grid, inline on the control's own page (user ask, 30 Jul: run history
 *  belongs on the control page, not gated behind a side sheet there). */
export function RunHistoryList({ c, runs }: { c: Control; runs: RunRecord[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-[0.8125rem] text-ink-400 py-10 text-center">
        Nothing has been run on this control yet.<br />
        A control test, a workflow run or an AI validation all land here.
      </p>
    );
  }
  return (
    <ol className="space-y-2.5">
      {runs.map(r => {
        const meta = KIND_META[r.kind];
        const mine = outcomeIn(r, c.id);
        return (
          <li key={r.id} className="rounded-xl border border-canvas-border bg-canvas-elevated p-3.5">
            <div className="flex items-start gap-2.5">
              <span className={cn('h-6 w-6 rounded-md inline-flex items-center justify-center shrink-0', meta.chip)}>
                <meta.Icon size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{r.label}</span>
                  <span className="ml-auto text-[0.6875rem] text-ink-400 shrink-0 tabular-nums">{r.at}</span>
                </div>
                {r.detail && <p className="text-[0.71875rem] text-ink-500 mt-0.5">{r.detail}</p>}
                <div className="flex items-center gap-2.5 mt-2 flex-wrap text-[0.6875rem] text-ink-500">
                  <span className={cn('px-1.5 h-[1.125rem] inline-flex items-center rounded font-semibold', meta.chip)}>{meta.label}</span>
                  {mine && (
                    <span className="inline-flex items-center gap-1">
                      <Tickmark result={mine.outcome} size={13} />
                      <span className={cn('font-semibold', mine.outcome === 'Effective' ? 'text-compliant-700' : 'text-risk-700')}>{mine.outcome}</span>
                      <span className="text-ink-400">· {mine.checks} check{mine.checks === 1 ? '' : 's'}</span>
                    </span>
                  )}
                  {r.controls.length > 1 && <span className="text-ink-400">with {r.controls.length - 1} other control{r.controls.length === 2 ? '' : 's'}</span>}
                  <span className="text-ink-400">{r.by}</span>
                </div>
                {r.datasets && r.datasets.length > 0 && (
                  <p className="text-[0.65625rem] text-ink-400 mt-1.5">Ran against {r.datasets.join(', ')}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RunHistoryDrawer({ c, runs, onClose, onOpenControl }: {
  c: Control; runs: RunRecord[]; onClose: () => void; onOpenControl: () => void;
}) {
  return (
    <Drawer
      title={`Run history — ${c.wpRef}`}
      subtitle={<span className="text-[0.75rem] text-ink-500">{controlCode(c)} · {c.description}</span>}
      onClose={onClose}
      ariaLabel={`Run history for ${c.id}`}
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer">Close</button>
          <button onClick={onOpenControl} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
            Open control page <ArrowRight size={14} />
          </button>
        </div>
      )}
    >
      <RunHistoryList c={c} runs={runs} />
    </Drawer>
  );
}

// ── the tab ─────────────────────────────────────────────────────────────────────

export default function ControlLibrary() {
  const { eng, role, meOwner, openControl, requestDesignDocs, registerPreset, clearRegisterPreset } = useIcfr();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState(false);
  const [q, setQ] = useState('');
  const [process, setProcess] = useState('All');
  const [nature, setNature] = useState('All');
  const [coverage, setCoverage] = useState<Coverage>('All');
  // Parity with the audit register: stacked by process or by company, opening on
  // the table because the library is a working list, not a browse surface.
  const [groupBy, setGroupBy] = useState<GroupBy>('process');
  const [dense, setDense] = useState(false);
  const [layout, setLayout] = useState<'cards' | 'table'>('table');
  const [entity, setEntity] = useState('All');
  const [ctype, setCtype] = useState('All');
  const [frequency, setFrequency] = useState('All');
  const [owner, setOwner] = useState('All');
  const { widthOf, totalWidth, th } = useColumnWidths(COLW_KEY, LIB_COLS);
  const [sel, setSel] = useState<Set<string>>(new Set());
  // An Overview count arrives with intent. The lens honours it once as a chip
  // rather than a dropdown — see PRESET_LABEL.
  const [preset, setPreset] = useState<string | null>(null);

  const auditScoped = useAuditControls(eng.controls);
  useEffect(() => {
    if (!registerPreset) return;
    if (registerPreset.process) setProcess(registerPreset.process);
    if (registerPreset.view && registerPreset.view !== 'all') setPreset(registerPreset.view);
    clearRegisterPreset();
  }, [registerPreset, clearRegisterPreset]);

  // Person-lane: the owner's library is their own controls, never the engagement's.
  // "Their own" means either capacity — accountable for it, or running it. The
  // process owner is who evidence requests reach, so a list that showed them
  // nothing would be showing nothing to the person being chased.
  const scoped = useMemo(
    () => (role === 'risk-owner' ? auditScoped.filter(c => isOwnerOf(c, meOwner)) : auditScoped),
    [auditScoped, role, meOwner],
  );
  // Column-filter option lists — built from what is actually in front of you, so a
  // filter can never offer a value that returns nothing.
  const processes = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.process)))], [scoped]);
  const entities = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.entity).filter(Boolean) as string[])).sort()], [scoped]);
  const frequencies = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.frequency)))], [scoped]);
  // Both names are filterable — you may be looking for what someone is
  // accountable for, or for what they run.
  const owners = useMemo(() => ['All', ...Array.from(new Set(scoped.flatMap(c => { const o = ownersOf(c); return o.single ? [o.controlOwner] : [o.controlOwner, o.processOwner]; }))).sort()], [scoped]);
  const ctypes = useMemo(() => ['All', ...Array.from(new Set(scoped.map(c => c.type))).sort()], [scoped]);

  // run history per control, computed once for the whole list
  const runsBy = useMemo(() => {
    const map = new Map<string, RunRecord[]>();
    scoped.forEach(c => map.set(c.id, runsForControl(eng.runs, c.id)));
    return map;
  }, [scoped, eng.runs]);
  const auditsBy = useMemo(() => {
    const map = new Map<string, AuditRecord[]>();
    scoped.forEach(c => map.set(c.id, auditsForControl(eng, c)));
    return map;
  }, [scoped, eng]);

  const rail = useMemo(() => {
    const attrs = scoped.reduce((n, c) => n + attributeStats(c).attrs, 0);
    const mapped = scoped.reduce((n, c) => n + attributeStats(c).mapped, 0);
    const runIds = new Set<string>();
    scoped.forEach(c => (runsBy.get(c.id) ?? []).forEach(r => runIds.add(r.id)));
    return { attrs, mapped, runs: runIds.size };
  }, [scoped, runsBy]);

  const matchesCoverage = (c: Control): boolean => {
    if (coverage === 'All') return true;
    const { attrs, mapped } = attributeStats(c);
    if (coverage === 'full') return attrs > 0 && mapped === attrs;
    if (coverage === 'partial') return mapped > 0 && mapped < attrs;
    if (coverage === 'none') return mapped === 0;
    const n = (runsBy.get(c.id) ?? []).length;
    return coverage === 'run' ? n > 0 : n === 0;
  };
  // The parked testing lens owned these predicates; the preset chip borrows them.
  const matchesPreset = (c: Control): boolean => {
    switch (preset) {
      case 'due': return isTestDueNow(c);
      case 'court': return courtFor(c, eng.tasks, eng.reviewNotes) === role;
      case 'design': return c.design.conclusion === 'Not tested';
      case 'design-done': return c.design.conclusion !== 'Not tested';
      case 'operating': return c.operating.conclusion === 'Not tested';
      case 'operating-done': return c.operating.conclusion !== 'Not tested';
      case 'effective': return conclusionOf(eng, c) === 'Effective';
      case 'exceptions': return conclusionOf(eng, c) === 'Ineffective';
      case 'review': return isAwaitingReview(c);
      case 'owner': return courtFor(c, eng.tasks, eng.reviewNotes) === 'risk-owner';
      case 'open': return conclusionOf(eng, c) === 'In progress';
      case 'papers': return conclusionOf(eng, c) !== 'In progress' && !isControlFinal(c);
      case 'key': return c.isKey;
      // The controls an ITGC failure landed on — same predicate as the testing
      // lens, so the banner lands on the same set from either screen.
      case 'itgc': return isItgcDependent(c) && failedItgcs(eng).length > 0;
      default: return true;
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return scoped.filter(c => {
      if (process !== 'All' && c.process !== process) return false;
      if (nature !== 'All' && c.nature !== nature) return false;
      if (entity !== 'All' && c.entity !== entity) return false;
      if (ctype !== 'All' && c.type !== ctype) return false;
      if (frequency !== 'All' && c.frequency !== frequency) return false;
      if (owner !== 'All' && !isOwnerOf(c, owner)) return false;
      if (!matchesCoverage(c)) return false;
      if (preset && !matchesPreset(c)) return false;
      if (term && !(`${controlCode(c)} ${c.description} ${c.entity ?? ''} ${c.process} ${c.subProcess} ${c.owner}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [scoped, q, process, nature, entity, ctype, frequency, owner, coverage, preset, runsBy, eng.tasks, eng.reviewNotes, role]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', rows: filtered }];
    const map = new Map<string, Control[]>();
    for (const c of filtered) { const k = groupKeyOf(c, groupBy); if (!map.has(k)) map.set(k, []); map.get(k)!.push(c); }
    return Array.from(map, ([key, rows]) => ({ key, rows: rows.sort((a, b) => controlCode(a).localeCompare(controlCode(b))) }));
  }, [filtered, groupBy]);

  // PARKED (Aug 2026) — select-all went with the checkbox column. `toggle` stays:
  // the card view still selects, and that is what feeds the bulk bar.
  //   const allVisible = filtered.map(c => c.id);
  //   const allSelected = allVisible.length > 0 && allVisible.every(id => sel.has(id));
  //   const toggleAll = () => setSel(allSelected ? new Set() : new Set(allVisible));
  const toggle = (id: string) => setSel(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearFilters = () => { setQ(''); setProcess('All'); setNature('All'); setCoverage('All'); setEntity('All'); setCtype('All'); setFrequency('All'); setOwner('All'); setPreset(null); };

  const historyControl = historyFor ? scoped.find(c => c.id === historyFor) : undefined;
  const colSpan = LIB_COLS.length;

  return (
    <div>
      {/* toolbar — first, matching the sibling tabs (RACM, SOX audit), so the
          filters sit directly under the tab bar. Column filters live in the
          table head, per the Jul 24 ask. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search controls and owners…" className="h-9 w-64 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="flex-1" />
        {/* Same three controls as the audit register, in the same shapes: no "GROUP"
            prefix (the value says it), Dense wearing the dropdown's 36px trigger
            rather than the 28px `.filter-pill`, and the platform's own view toggle
            with list on the left. */}
        <FilterSelect value={groupBy} options={GROUP_OPTIONS} engaged={groupBy !== 'none'}
          onChange={v => setGroupBy(v as GroupBy)} ariaLabel="Group the library by" align="right" />
        {layout === 'table' && (
          <button onClick={() => setDense(d => !d)} className={triggerCls(dense, false)} aria-pressed={dense}>
            <Rows3 size={13} className={dense ? 'text-brand-600' : 'text-ink-400'} /> Dense
          </button>
        )}
        <div className="flex items-center gap-0.5 p-0.5 h-9 rounded-lg border border-canvas-border bg-canvas-elevated">
          <button onClick={() => setLayout('table')} title="List view" aria-label="List view" aria-pressed={layout === 'table'}
            className={cn('p-1.5 rounded-sm cursor-pointer transition-colors', layout === 'table' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><List size={16} /></button>
          <button onClick={() => setLayout('cards')} title="Grid view" aria-label="Grid view" aria-pressed={layout === 'cards'}
            className={cn('p-1.5 rounded-sm cursor-pointer transition-colors', layout === 'cards' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><LayoutGrid size={16} /></button>
        </div>
        <span className="w-px h-6 bg-canvas-border mx-0.5" aria-hidden />
        {role !== 'risk-owner' && <button onClick={() => setReportPreview(true)} title="Audit report — observations and the management action plan" className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer"><FileText size={14} /> Audit report</button>}
        {role === 'auditor' && !isEngagementLocked(eng) && <button onClick={() => setCreating(true)} className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Plus size={15} /> New control</button>}
      </div>

      {/* KPI rail — what the library is made of, not how testing is going */}
      <div className="flex items-stretch gap-3 mb-4 flex-wrap">
        {[
          { k: role === 'risk-owner' ? 'Controls in your name' : 'Controls', v: String(scoped.length), t: 'text-ink-900' },
          { k: 'Attributes', v: String(rail.attrs), t: 'text-ink-900' },
          { k: 'Workflows mapped', v: `${rail.mapped} of ${rail.attrs}`, t: rail.mapped === rail.attrs && rail.attrs > 0 ? 'text-compliant-700' : 'text-evidence-700' },
          { k: 'Runs logged', v: String(rail.runs), t: 'text-brand-700' },
          { k: 'Audit runs', v: String(eng.audits.length), t: 'text-mitigated-700' },
        ].map(s => (
          <div key={s.k} className="flex-1 min-w-[7.5rem] rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-2.5">
            <div className={cn('text-[1.25rem] font-bold tabular-nums leading-6', s.t)}>{s.v}</div>
            <div className="text-[0.71875rem] text-ink-500 font-medium mt-0.5">{s.k}</div>
          </div>
        ))}
      </div>

      {/* The cascade reaches this lens too: the library is where somebody browses
          controls without an audit open, and the shortcut is withdrawn there just
          the same. Same banner, same set — it sets the preset this lens already
          understands rather than inventing a second filter. Auditor and reviewer
          only, same as the register and the control page. */}
      {role !== 'risk-owner' && failedItgcs(eng).length > 0 && (
        <div className="mb-4">
          <ItgcCascadeBanner
            failed={failedItgcs(eng).map(f => ({ id: f.id, code: controlCode(f), description: f.description }))}
            affected={scoped.filter(isItgcDependent).length}
            onOpenControl={openControl}
            onShowAffected={preset === 'itgc' ? undefined : () => setPreset('itgc')}
          />
        </div>
      )}

      {/* an Overview count sent us here with intent — say so, and let it go */}
      {preset && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[0.71875rem] text-ink-500">Filtered from the Overview:</span>
          <button onClick={() => setPreset(null)}
            className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-2 rounded-full border border-brand-200 bg-brand-50 text-[0.71875rem] font-semibold text-brand-700 hover:border-brand-300 cursor-pointer transition-colors"
            aria-label={`Clear the ${PRESET_LABEL[preset] ?? preset} filter`}>
            {PRESET_LABEL[preset] ?? preset} <X size={12} />
          </button>
        </div>
      )}

      {layout === 'cards' ? (
        <div>
          {groups.map(g => {
            const attrs = g.rows.reduce((n, c) => n + attributeStats(c).attrs, 0);
            const mapped = g.rows.reduce((n, c) => n + attributeStats(c).mapped, 0);
            return (
              <div key={g.key || 'flat'} className="shelf">
                {g.key && (
                  <div className="shelf-head">
                    <span className="shelf-swatch" style={{ background: spineColor(g.key) }} />
                    <span className="shelf-title">{g.key}</span>
                    <span className="text-[0.71875rem] text-ink-400 font-medium">· {g.rows.length}</span>
                    <span className="text-[0.65625rem] font-semibold text-ink-400 hidden md:inline">{attrs} attributes · {mapped} mapped to workflows</span>
                    <span className="shelf-board" />
                  </div>
                )}
                <div className="card-grid">
                  {g.rows.map(c => (
                    <LibraryCard key={c.id} c={c} runs={runsBy.get(c.id) ?? []} audits={auditsBy.get(c.id) ?? []}
                      onOpen={() => openControl(c.id)}
                      selectable={role === 'auditor'} selected={sel.has(c.id)} onToggle={() => toggle(c.id)} />
                  ))}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-ink-400 text-[0.8125rem] rounded-2xl border border-dashed border-canvas-border">No controls match these filters. <button onClick={clearFilters} className="text-brand-700 font-semibold hover:underline cursor-pointer">Clear filters</button></div>
          )}
        </div>
      ) : (
        <div className={cn('reg-wrap', dense && 'reg-dense')}>
          {/* Fixed layout + a colgroup means the widths are the ones on record, not
              whatever the longest cell argued for — which is what lets a drag hold. */}
          <table className="border-collapse" style={{ tableLayout: 'fixed', width: totalWidth }}>
            <colgroup>{LIB_COLS.map(c => <col key={c.key} style={{ width: widthOf(c.key) }} />)}</colgroup>
            <thead className="reg-head">
              <tr>
                <Th {...th('process')}><HeaderFilter label="Process" value={process} options={processes} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" /></Th>
                <Th {...th('control')}>Control</Th>
                <Th {...th('entity')}><HeaderFilter label="Entity" value={entity} options={entities} allLabel="All entities" onChange={setEntity} ariaLabel="Filter by entity" /></Th>
                <Th {...th('type')} title="Preventive controls stop it happening; detective controls find it after it has">
                  <HeaderFilter label="Control type" value={ctype} options={ctypes} allLabel="All types" onChange={setCtype} ariaLabel="Filter by control type" />
                </Th>
                <Th {...th('frequency')}><HeaderFilter label="Frequency" value={frequency} options={frequencies} allLabel="All frequencies" onChange={setFrequency} ariaLabel="Filter by frequency" /></Th>
                <Th {...th('owner')}><HeaderFilter label="Control Owner" value={owner} options={owners} allLabel="All control owners" onChange={setOwner} ariaLabel="Filter by control owner" /></Th>
                <Th {...th('objective')} title="What the control is for — the outcome it secures">Objective</Th>
                <Th {...th('nature')}><HeaderFilter label="Nature" value={nature} options={['All', 'Manual', 'Automated', 'IT-dependent']} allLabel="All natures" onChange={setNature} ariaLabel="Filter by nature" /></Th>
                <Th {...th('attributes')} title="Test attributes this control is proven against">Attributes</Th>
                <Th {...th('workflows')}>
                  <HeaderFilter label="Workflows" value={coverage} engaged={coverage !== 'All'}
                    options={COVERAGE_OPTIONS} onChange={v => setCoverage(v as Coverage)} ariaLabel="Filter by workflow coverage" />
                </Th>
                <Th {...th('runs')} title="Audit cycles whose scope covers this control">Audit runs</Th>
                <Th {...th('last')}>Last run</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <FragmentGroup key={g.key || 'flat'}>
                  {g.key && (
                    <tr className="reg-group-row"><td colSpan={colSpan}>
                      <span className="inline-flex items-center gap-2">{g.key}<span className="text-ink-400 font-medium">· {g.rows.length}</span>
                        <span className="ml-2 text-[0.65625rem] font-semibold text-ink-400">
                          {g.rows.reduce((n, c) => n + attributeStats(c).attrs, 0)} attributes · {g.rows.reduce((n, c) => n + attributeStats(c).mapped, 0)} mapped to workflows
                        </span>
                      </span>
                    </td></tr>
                  )}
                  {g.rows.map(c => {
                    const { attrs, mapped } = attributeStats(c);
                    const pct = attrs === 0 ? 0 : Math.round((mapped / attrs) * 100);
                    const rs = runsBy.get(c.id) ?? [];
                    const as = auditsBy.get(c.id) ?? [];
                    const last = rs[0];
                    const lastOutcome = last ? outcomeIn(last, c.id) : undefined;
                    return (
                      <tr key={c.id} className={cn('reg-row', sel.has(c.id) && 'sel')} onClick={() => openControl(c.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openControl(c.id); }} role="button" aria-label={`Open ${c.id} — ${c.description}`}>
                        {/* PARKED (Aug 2026) — the select-all / per-row checkbox column.
                            Selection still runs on the CARD view, which is what feeds the
                            bulk bar, so nothing downstream is dead.
                        <td onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) toggle(c.id); }}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="cursor-pointer accent-brand-600" aria-label={`Select ${c.id}`} /></td>
                        */}
                        <td className="text-[0.71875rem] text-ink-600"><span className="truncate block" title={c.process}>{c.process}</span></td>
                        <td className="tight">
                          <div className="flex items-center gap-1.5">
                            {c.isKey && <Star size={12} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                            <span className="font-semibold text-ink-900 text-[0.78125rem] truncate min-w-0">{c.description}</span>
                          </div>
                          {/* process and owner have their own columns now — saying them
                              twice on the same row is noise. */}
                          <div className="text-[0.6875rem] text-ink-400 mt-0.5">{controlCode(c)} · {c.subProcess}</div>
                        </td>
                        <td className="text-[0.71875rem] text-ink-700">
                          {c.entity
                            ? <span className="inline-flex items-center gap-1.5 min-w-0" title={c.entity}><Building2 size={12} className="text-ink-300 shrink-0" /><span className="truncate">{c.entity}</span></span>
                            : <span className="text-ink-300">—</span>}
                        </td>
                        <td className="text-[0.71875rem] text-ink-600">{c.type}</td>
                        <td className="text-[0.71875rem] text-ink-600">{c.frequency}</td>
                        <td className="text-[0.71875rem] text-ink-600"><span className="truncate block" title={c.owner}>{c.owner}</span></td>
                        <td className="text-[0.71875rem] text-ink-500">
                          <span className="reg-clamp" title={c.objective ?? undefined}>{c.objective ?? '—'}</span>
                        </td>
                        <td><NatureChip nature={c.nature} small /></td>
                        <td className="tabular-nums font-semibold text-ink-800">{attrs}</td>
                        <td>
                          <span className="cell-track">
                            <span className={cn('text-[0.6875rem] font-semibold tabular-nums', mapped === 0 ? 'text-ink-400' : 'text-ink-700')}>{mapped} of {attrs}</span>
                            <span className="meter" aria-hidden><span style={{ width: `${pct}%`, background: mapped === attrs && attrs > 0 ? 'var(--color-compliant-500)' : mapped === 0 ? 'var(--color-ink-300)' : 'var(--color-evidence-500)' }} /></span>
                          </span>
                        </td>
                        <td>
                          {as.length === 0
                            ? <span className="text-ink-400 text-[0.6875rem]">None yet</span>
                            : (
                              <span className="inline-flex flex-col leading-tight">
                                <span className="text-[0.71875rem] font-semibold text-ink-800 tabular-nums">{as.length}</span>
                                <span className="text-[0.625rem] text-ink-400">{as.map(a => a.period).join(' · ')}</span>
                              </span>
                            )}
                        </td>
                        <td>
                          {last && lastOutcome ? (
                            <button onClick={e => { e.stopPropagation(); setHistoryFor(c.id); }}
                              className="inline-flex items-center gap-1.5 text-left cursor-pointer group/run"
                              aria-label={`Run history for ${c.wpRef}`}>
                              <Tickmark result={lastOutcome.outcome} size={14} />
                              <span className="flex flex-col leading-tight min-w-0">
                                <span className="text-[0.6875rem] font-semibold text-ink-700 truncate group-hover/run:text-brand-700 transition-colors">{KIND_META[last.kind].label} · {last.at}</span>
                                <span className="text-[0.625rem] text-ink-400">{rs.length} run{rs.length === 1 ? '' : 's'} in history</span>
                              </span>
                            </button>
                          ) : <span className="text-ink-400 text-[0.6875rem]">Never run</span>}
                        </td>
                      </tr>
                    );
                  })}
                </FragmentGroup>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={colSpan} className="text-center py-16 text-ink-400 text-[0.8125rem]">No controls match these filters. <button onClick={clearFilters} className="text-brand-700 font-semibold hover:underline cursor-pointer">Clear filters</button></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 text-[0.71875rem] text-ink-400">Showing {filtered.length} of {scoped.length} controls</div>

      {/* bulk bar — no bulk TEST here (user ask, 30 Jul: SOX controls aren't
          bulk-tested); the library is still where design documents are chased. */}
      {sel.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-ink-900 text-white rounded-2xl pl-4 pr-2.5 py-2.5 shadow-[0_12px_40px_-12px_rgba(15,8,30,0.6)]">
          <span className="text-[0.78125rem] font-semibold">{sel.size} selected</span>
          <span className="w-px h-5 bg-white/20" />
          {role === 'auditor' && <button onClick={() => { requestDesignDocs(Array.from(sel)); addToast({ type: 'success', title: 'Requests sent', message: `Document requests raised on ${sel.size} control${sel.size === 1 ? '' : 's'} — the owners see them as tasks.` }); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[0.78125rem] font-semibold transition-colors cursor-pointer"><FileText size={14} /> Request design documents</button>}
          <button onClick={() => { openControl(Array.from(sel)[0]); setSel(new Set()); }} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[0.78125rem] font-semibold transition-colors cursor-pointer"><Send size={14} /> Open first</button>
          <button onClick={() => setSel(new Set())} className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors cursor-pointer" aria-label="Clear selection"><X size={15} /></button>
        </div>
      )}

      <AnimatePresence>
        {historyControl && (
          <RunHistoryDrawer
            c={historyControl}
            runs={runsBy.get(historyControl.id) ?? []}
            onClose={() => setHistoryFor(null)}
            onOpenControl={() => { const id = historyControl.id; setHistoryFor(null); openControl(id); }}
          />
        )}
      </AnimatePresence>

      {creating && <NewControlPanel onClose={() => setCreating(false)} />}
      {/* the paper and the report follow the filters — only the visible controls go in */}
      {reportPreview && <WorkingPaperModal eng={eng} controls={filtered} report onClose={() => setReportPreview(false)} />}
    </div>
  );
}

function FragmentGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
