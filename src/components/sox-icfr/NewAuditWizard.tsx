import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, CalendarRange, Check, ChevronDown, FileSpreadsheet, Grid3x3,
  Landmark, Paperclip, Scale, Sparkles, Star, Trash2, Upload, X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { FlowModal } from '../audit/sox-testing/SoxTestingTab';
import { StepRail } from '../audit/sox-testing/ScopingWizard';
import { FormSelect } from '../shared/FilterSelect';
import { CustomDatePicker } from '../shared/CustomDatePicker';
import {
  BASIS_OPTIONS, ruleOverall,
  type GroupEntity, type MaterialityBasis,
} from '../audit/sox-testing/soxTestingData';
import {
  COVERAGE_TARGET, type DerivedScopeRow, deriveEntityScope,
  entitiesFor, entitiesInFiles, entityTotals, mergeScopeEntities, racmsForEntities,
} from './auditScope';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { AUDIT_ROUNDS, type AuditRound, type AuditScopeKind, type Control, type FileOrigin } from './types';
import { cn } from '../../lib/cn';

/**
 * New audit — the wizard behind the New audit button on the Overview and the
 * SOX audit tab.
 *
 * Period → Materiality & files → Scope → Review (user ask). Materiality leads
 * because that is the order the work happens in: you set the threshold, load the
 * trial balance it is applied to, and what comes back is what should be in
 * scope — so scope is the answer, not the opening question. The files half stays
 * optional — Continue gates on the materiality half alone.
 *
 * Scope is a hard either/or by design: you pick entities OR RACMs, and
 * switching sides clears the other selection rather than quietly keeping both.
 *
 * Entities come from the engagement's programme record when it has one. This
 * wizard is on EVERY SOX engagement now, including ones the scoping wizard never
 * created a programme for, so those fall back to the demo group (SEED_ENTITIES)
 * — a prototype stand-in, not a real derivation.
 *
 * RACMs are the engagement's processes: a RACM here IS a process's set of
 * controls, the same equivalence Racm.tsx and createRacm() work from.
 */

const STEPS = ['Period', 'Materiality & files', 'Scope', 'Review'] as const;
const REVIEW = STEPS.length - 1;

const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
/** A FormSelect trigger wearing the input's clothes. Native <select> is avoided
 *  on purpose: its open menu is the OS one, which ignores the product theme. */
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'block text-[11px] font-semibold text-ink-500 mb-1.5';

function StepShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[0.9375rem] font-semibold text-ink-900 tracking-tight">{title}</h3>
      <p className="text-[0.75rem] text-ink-500 mt-0.5 mb-4 leading-relaxed">{sub}</p>
      {children}
    </div>
  );
}

/** Review rows — label left, value right, matching the wizard's review cards. */
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-canvas-border last:border-b-0">
      <span className="text-[11.5px] text-ink-500 shrink-0">{label}</span>
      <span className="text-[12.5px] font-semibold text-ink-900 text-right min-w-0">{value}</span>
    </div>
  );
}

export default function NewAuditWizard({ onClose }: { onClose: () => void }) {
  const { eng, createAudit, registerFile, me } = useIcfr();
  const { addToast } = useToast();
  const [step, setStep] = useState(0);

  // ── Period ───────────────────────────────────────────────────────────────
  // One shape only (user ask): the dates are picked by hand. The named-cycle
  // shortcuts — financial year, calendar year, quarter — were removed, so there
  // is no year type to choose between and no derived window to fall back on.
  // The window this audit tests IS the From / To below.
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const customValid = !!customFrom && !!customTo && customFrom <= customTo;
  const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  /** Which round of the cycle this is. SOX is not tested once a year: interim
   *  covers the first stretch, roll-forward extends it towards the year end, and
   *  the year-end round tests as of the balance-sheet date. It is the auditor's
   *  judgement, so it is asked rather than inferred. With the named cycles gone
   *  it is a label for which pass this is — the round no longer computes dates
   *  of its own, because there is no cycle left to split. */
  const [round, setRound] = useState<AuditRound>('interim');

  const periodLabel = customValid ? `${fmtDate(customFrom)} – ${fmtDate(customTo)}` : 'Custom period';
  const periodSpan = 'Custom range';
  const windowFrom = customFrom;
  const windowTo = customTo;

  // ── Files (optional) ─────────────────────────────────────────────────────
  // Provenance rides with the file from the moment it is picked — it is a
  // property of the FILE, and this is where the file enters the audit.
  const [files, setFiles] = useState<{ name: string; kind: 'tb' | 'gl'; origin?: FileOrigin }[]>([]);
  const addFile = (kind: 'tb' | 'gl') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    // A group files one trial balance per company, so picking several at once is
    // the normal case, not the exception (user ask).
    input.multiple = true;
    input.onchange = () => {
      const picked = Array.from(input.files ?? []);
      if (picked.length) setFiles(prev => [...prev, ...picked.map(f => ({ name: f.name, kind }))]);
    };
    input.click();
  };

  // ── Materiality ──────────────────────────────────────────────────────────
  // Declared before scope on purpose: performance materiality is the threshold
  // the scope derivation weighs every company against, so it has to exist first.
  const [basis, setBasis] = useState<MaterialityBasis>('pbt');
  const basisOpt = BASIS_OPTIONS.find(b => b.id === basis)!;
  const [benchmark, setBenchmark] = useState(basisOpt.defaultBenchmark);
  const [pct, setPct] = useState(basisOpt.defaultPct);
  const changeBasis = (id: MaterialityBasis) => {
    const opt = BASIS_OPTIONS.find(b => b.id === id)!;
    setBasis(id);
    setBenchmark(opt.defaultBenchmark);
    setPct(opt.defaultPct);
  };
  const overall = ruleOverall({ id: 'draft', name: 'Audit rule', basis, benchmark, pct });

  /** The two thresholds testing actually runs against, both a percentage OF
   *  overall (user ask — the step used to compute overall and stop there).
   *  75 / 5 are the SOX-standard starting points, and the ranges match the
   *  engagement-creation step this was replicated from: performance materiality
   *  50–75 in fives, clearly-trivial 1–10. */
  const [pmPct, setPmPct] = useState(75);
  const [ctPct, setCtPct] = useState(5);
  const perf = overall * pmPct / 100;
  const trivial = overall * ctPct / 100;
  /** Where a significant deficiency starts. Not asked here — it is an
   *  engagement-level ground rule, so the ladder reads the engagement's own
   *  band rather than inventing a second source of truth. */
  const sdPct = eng.rules.sdBandPct;
  const sd = overall * sdPct / 100;
  /** ₹ Cr in, readable money out — under a crore reads as lakhs, the way the
   *  Materiality & scope page and the Overview card already write it. */
  const money = (cr: number) => (cr >= 1 ? `₹${cr.toFixed(2)} Cr` : `₹${(cr * 100).toFixed(1)} L`);
  const LADDER = [
    { label: 'Clearly trivial', band: `≤ ${money(trivial)}`, tone: 'text-ink-500 bg-paper-50 border-canvas-border' },
    { label: 'Deficiency', band: `> ${money(trivial)} and < ${money(sd)}`, tone: 'text-mitigated-700 bg-mitigated-50/50 border-mitigated-200' },
    { label: 'Significant deficiency', band: `≥ ${money(sd)} · ${sdPct}% of overall`, tone: 'text-high-700 bg-high-50/50 border-high-200' },
    { label: 'Material weakness', band: `≥ ${money(overall)} or any MW indicator`, tone: 'text-risk-700 bg-risk-50/50 border-risk-200' },
  ];

  // ── Scope ────────────────────────────────────────────────────────────────
  const [scopeKind, setScopeKind] = useState<AuditScopeKind>('entity');
  const [picked, setPicked] = useState<string[]>([]);

  // entitiesFor looks in BOTH programme stores — the classic one and the V2
  // tab's, which is where the Altura group lives. Reading PROGRAMMES alone
  // silently offered the demo group's entities instead of the engagement's.
  const entities: GroupEntity[] = useMemo(() => entitiesFor(eng.id), [eng.id]);

  // A RACM is a process's set of controls — same grouping Racm.tsx uses. The
  // rows come along because the RACM side of this step picks control by control.
  const racms = useMemo(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([name, rows]) => ({ name, rows, count: rows.length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [eng.controls]);

  /** Which RACM is expanded. One at a time — the sheet is 560px, and two open
   *  lists turn the step into a scroll hunt. */
  const [openRacm, setOpenRacm] = useState<string | null>(null);
  /** Key controls only. SOX scopes to key controls far more often than not, so
   *  this is the switch that does the picking rather than a filter on the eye. */
  const [keyOnly, setKeyOnly] = useState(false);
  /** Controls chosen inside the RACMs, by id. A RACM ticked whole puts all of
   *  its ids in; unticking one row leaves the RACM partly selected. */
  const [pickedControls, setPickedControls] = useState<string[]>([]);

  /** What `keyOnly` lets you choose from within one RACM. */
  const rowsOf = useCallback(
    (name: string) => {
      const rows = racms.find(r => r.name === name)?.rows ?? [];
      return keyOnly ? rows.filter(c => c.isKey) : rows;
    },
    [racms, keyOnly],
  );

  // Turning "key controls only" ON picks every key control across every RACM
  // (user ask) — the switch does the picking, which is what its copy always
  // claimed. Non-key controls already ticked come off, because the switch is
  // now a statement about what this audit covers.
  //
  // Turning it OFF keeps that selection and merely unlocks the rest: the switch
  // only ever adds and unlocks, so flipping it back costs nothing.
  useEffect(() => {
    if (!keyOnly) return;
    const keyIds = eng.controls.filter(c => c.isKey).map(c => c.id);
    setPickedControls(keyIds);
    setPicked(Array.from(new Set(eng.controls.filter(c => c.isKey).map(c => c.process))));
  }, [keyOnly, eng.controls]);

  // ── The scope step's two sources ─────────────────────────────────────────
  // The engagement's entity register, and the entities the uploaded TB / GL
  // turned out to contain. Both are shown, matched by name: the register is kept
  // by hand and can be missing a company, the trial balance can't be (user ask).
  const dataEntities = useMemo(() => entitiesInFiles(eng.id, files.length > 0), [eng.id, files.length]);
  const entityRows = useMemo(() => mergeScopeEntities(entities, dataEntities), [entities, dataEntities]);

  /** Companies the auditor took off this audit's list. The register itself is
   *  untouched (user ask) — the next audit, once the trial balance turns up,
   *  offers them again. */
  const [dropped, setDropped] = useState<string[]>([]);
  /** Where the auditor overruled the derivation, by entity id. Absent means
   *  "whatever the numbers said". */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  // What the numbers say, weighed against the performance materiality set on
  // the previous step — so changing 75% to 60% up there re-scopes down here.
  const totals = useMemo(() => entityTotals(eng.id), [eng.id]);
  const scope = useMemo(
    () => deriveEntityScope(entityRows.filter(r => !dropped.includes(r.id)), totals, perf, money, files.length > 0),
    [entityRows, dropped, totals, perf, files.length],
  );
  /** In scope after the auditor has had their say. A company the trial balance
   *  never mentioned can't be overruled in — there is nothing to test it on. */
  const inScope = (r: DerivedScopeRow) =>
    r.status === 'absent' ? false : overrides[r.id] ?? (r.status === 'tb' || r.status === 'coverage');
  const scopedEntities = scope.rows.filter(inScope);
  /** Coverage after overrides, not the raw derivation — the bar has to follow
   *  what the audit actually covers, or it argues with the list beneath it. */
  const coveragePct = scope.groupTotal
    ? Math.round((scopedEntities.reduce((s, r) => s + r.total, 0) / scope.groupTotal) * 1000) / 10
    : 0;

  // Removing the trial balance takes its unregistered entities off the list with
  // it, so their overrides and drops have to go too — otherwise a company that
  // no longer has a row keeps voting on the coverage total.
  useEffect(() => {
    const live = new Set(entityRows.map(r => r.id));
    setOverrides(prev => {
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => live.has(id)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setDropped(prev => (prev.every(id => live.has(id)) ? prev : prev.filter(id => live.has(id))));
  }, [entityRows]);

  // RACMs are picked by process name, which IS their identity. Entities no
  // longer share this list — their rows come from the derivation above.
  const options = racms.map(r => ({ id: r.name, primary: r.name, secondary: `${r.count} control${r.count === 1 ? '' : 's'}` }));

  /**
   * Switching sides no longer clears the other's picks (user ask) — the two
   * sides are two views of one scope now, not a hard either/or.
   *
   * Opening the RACM side for the first time arrives pre-ticked with the RACMs
   * the in-scope companies feed: the trial balance already decided which
   * processes are in play, so making you re-derive that by hand was busywork.
   * It only ever pre-ticks an untouched list — once you have picked, going back
   * and forth leaves your selection exactly as you left it.
   */
  const switchKind = (kind: AuditScopeKind) => {
    if (kind === scopeKind) return;
    setScopeKind(kind);
    setOpenRacm(null);
    if (kind !== 'racm' || picked.length || pickedControls.length) return;

    const fromEntities = racmsForEntities(eng.id, scopedEntities.map(r => r.id));
    // The programme names the processes; this list is built from the controls,
    // so only the RACMs that actually exist here can be ticked.
    const live = racms.filter(r => fromEntities.includes(r.name));
    if (!live.length) return;
    setPicked(live.map(r => r.name));
    setPickedControls(live.flatMap(r => r.rows.map(c => c.id)));
  };
  /** Ticking a RACM takes its controls with it — whole RACM in, whole RACM out.
   *  Individual rows are then unticked inside, which leaves the RACM partly
   *  selected but still in scope. */
  const togglePick = (id: string) => {
    const on = picked.includes(id);
    setPicked(prev => (on ? prev.filter(x => x !== id) : [...prev, id]));
    if (scopeKind !== 'racm') return;
    const ids = rowsOf(id).map(c => c.id);
    setPickedControls(prev => (on
      ? prev.filter(x => !ids.includes(x))
      : Array.from(new Set([...prev, ...ids]))));
  };
  /** One control row. Unticking the last row of a RACM drops the RACM too —
   *  a RACM in scope with nothing selected under it covers nothing. */
  const toggleControl = (racm: string, controlId: string) => {
    setPickedControls(prev => {
      const next = prev.includes(controlId) ? prev.filter(x => x !== controlId) : [...prev, controlId];
      const ids = rowsOf(racm).map(c => c.id);
      const anyLeft = ids.some(id => next.includes(id));
      setPicked(p => (anyLeft ? (p.includes(racm) ? p : [...p, racm]) : p.filter(x => x !== racm)));
      return next;
    });
  };
  /** Display-ready labels for what's covered — ids are storage, not copy. */
  const pickedNames = scopeKind === 'entity'
    ? scopedEntities.map(r => r.name)
    : picked.map(id => options.find(o => o.id === id)?.primary ?? id);

  // ── Gates ────────────────────────────────────────────────────────────────
  // Files is skippable on purpose — everything else must be answered.
  // Materiality & files gates on the materiality half only: the TB / GL half is
  // optional, so an empty file list must never block Continue.
  const canContinue = step === 0 ? customValid
    : step === 1 ? benchmark > 0 && (basis === 'custom' || pct > 0)
    // Scoping by RACM means picking controls: a RACM ticked with nothing
    // under it covers nothing, so Continue waits for at least one row.
    : step === 2 ? (scopeKind === 'entity' ? scopedEntities.length > 0 : pickedControls.length > 0)
    : true;

  const create = () => {
    createAudit({
      period: periodLabel,
      yearBasis: 'custom',
      // The year the window closes in — the only year a hand-picked range names.
      fiscalYear: Number(customTo.slice(0, 4)),
      periodSpan,
      round,
      windowFrom,
      windowTo,
      scopeKind,
      scopeNames: pickedNames,
      scopeIds: scopeKind === 'entity' ? scopedEntities.map(r => r.id) : [],
      // Only the RACM side picks control by control; scoping by entity lets the
      // entities' processes decide, so it leaves this empty on purpose.
      controlIds: scopeKind === 'racm' ? pickedControls : [],
      files: files.map(f => ({ name: f.name, kind: f.kind })),
      materiality: { basisLabel: basisOpt.label, benchmark, pct, pmPct, ctPct },
      overall,
    });
    // The answers given upstairs become the files' records, so every control on
    // this audit inherits them and none is asked again.
    files.forEach(f => {
      if (!f.origin) return;
      registerFile({
        name: f.name, kind: f.kind === 'tb' ? 'Trial balance' : 'General ledger',
        rows: f.kind === 'tb' ? 1240 : 18432, from: `${periodLabel} audit`,
        uploadedBy: me, uploadedAt: 'just now', origin: f.origin, originBy: me, originAt: 'just now',
      });
    });
    addToast({
      type: 'success',
      title: 'Audit created',
      message: scopeKind === 'entity'
        ? `${periodLabel} — ${scopedEntities.length} entit${scopedEntities.length === 1 ? 'y' : 'ies'} in scope, ${coveragePct}% of the group.`
        : `${periodLabel} — ${pickedControls.length} control${pickedControls.length === 1 ? '' : 's'} across ${picked.length} RACM${picked.length === 1 ? '' : 's'}.`,
    });
    onClose();
  };

  return (
    <FlowModal label="New audit" widthCls="w-full max-w-[560px]" variant="sheet" hideClose onClose={onClose}>
      {/* FlowModal's sheet is one scroll container (flex-1 overflow-y-auto p-6
          pb-0), so a plain footer just flows after the content and floats
          mid-sheet on short steps. min-h-full + flex-col makes this fill the
          scrollport and the flex-1 body push the footer down; the footer's own
          sticky bottom-0 then keeps it pinned once a step does scroll. */}
      <div className="min-h-full flex flex-col">
      {/* Header pins to the scrollport like the scoping sheet's — see the
          sticky -top-6 note in ScopingWizard for why the offset is negative. */}
      <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-11 pb-1">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} className="text-brand-600 shrink-0" />
              <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">New audit</h2>
            </div>
            <p className="text-[0.75rem] text-ink-500">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
        </div>
        <StepRail steps={STEPS} step={step} onStepClick={setStep} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex-1">
        {step === 0 && (
          <StepShell title="Audit period" sub="The window this audit tests, and which pass of the year it is.">
            {/* The app's own picker, not the native one (user ask): a
                <input type="date"> opens the OS calendar, which ignores the
                product theme entirely — the same reason native <select> is
                avoided here. It portals, so the sheet's scroll can't clip it,
                and minDate stops To being set before From at the source. */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From</label>
                <CustomDatePicker value={customFrom} onChange={setCustomFrom} />
              </div>
              <div>
                <label className={labelCls}>To</label>
                <CustomDatePicker value={customTo} onChange={setCustomTo} minDate={customFrom || undefined} />
              </div>
            </div>
            {customFrom && customTo && !customValid && (
              <p className="text-[11.5px] text-risk-700 mt-2">The From date must be on or before the To date.</p>
            )}

            {/* Round is asked for every audit now. It carries no dates of its
                own — the From / To above are the window — so the buttons name
                the pass and the hint says what that pass is for. */}
            <label className={`${labelCls} mt-4`}>Round</label>
            <div className="grid grid-cols-3 gap-1.5">
              {AUDIT_ROUNDS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setRound(r.id)}
                  className={cn(
                    'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all cursor-pointer',
                    round === r.id
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                      : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-400 mt-1.5">{AUDIT_ROUNDS.find(r => r.id === round)!.hint}</p>

            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
              <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                {customValid
                  ? <>This <span className="font-semibold text-ink-900">{AUDIT_ROUNDS.find(r => r.id === round)!.label.toLowerCase()}</span> audit covers{' '}
                    <span className="font-semibold text-ink-900">{fmtDate(customFrom)} – {fmtDate(customTo)}</span>.</>
                  : 'Pick a From and To date to set the window this audit covers.'}
              </p>
            </div>
          </StepShell>
        )}

        {/* No StepShell here (user ask): the step title and strapline were removed.
            The rail above already names the step, and each half carries its own
            heading, so a third layer of titling was just noise. */}
        {step === 1 && (
          <div>
            {/* Files lead (user ask): the trial balance is what the threshold
                below gets applied TO, so it is loaded first. Optional all the
                same — Continue waits on the materiality half alone, never on
                this one. */}
            <div className="flex items-baseline gap-2 mb-0.5">
              <h4 className="text-[13px] font-semibold text-ink-900">Trial balance &amp; general ledger</h4>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Optional</span>
            </div>
            <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
              Attach them if this audit needs them — you can add them later instead.
            </p>

            {/* Each kind owns its uploads (user ask): a file lands INSIDE the box
                it was uploaded from, instead of in a shared list underneath where
                nothing tied it back to the box it came from. Empty, the box is a
                dashed prompt with a labelled Upload button; once it holds a file
                it becomes a solid card whose header carries an icon-only upload
                for adding another. */}
            <div className="space-y-2 mb-4">
              {([['tb', 'Trial balance'], ['gl', 'General ledger']] as const).map(([kind, title]) => {
                // Indices are carried along: `files` stays one flat list, so
                // remove / set-origin still address the real row, not the
                // position within this box.
                const mine = files.map((f, i) => ({ f, i })).filter(x => x.f.kind === kind);
                return (
                  <div key={kind} className={cn('rounded-lg border bg-white', mine.length ? 'border-canvas-border' : 'border-dashed border-canvas-border')}>
                    {mine.length === 0 ? (
                      /* Full width now (user ask), so the empty box reads across
                         rather than stacking four things down the middle. */
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <FileSpreadsheet size={16} className="text-brand-600 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold text-ink-800 truncate">{title}</span>
                          <span className="block text-[10.5px] text-ink-400">XLSX · CSV</span>
                        </span>
                        <button
                          onClick={() => addFile(kind)}
                          className="h-7 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[11.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer shrink-0"
                        >
                          <Upload size={12} /> Upload
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-canvas-border">
                          <FileSpreadsheet size={14} className="text-brand-600 shrink-0" />
                          <span className="text-[12px] font-semibold text-ink-800 flex-1 min-w-0 truncate">{title}</span>
                          <button
                            onClick={() => addFile(kind)}
                            title={`Upload another ${title.toLowerCase()}`}
                            aria-label={`Upload another ${title.toLowerCase()}`}
                            className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors cursor-pointer shrink-0"
                          >
                            <Upload size={13} />
                          </button>
                        </div>
                        {mine.map(({ f, i }) => (
                          <div key={`${f.name}-${i}`} className="px-3 py-2.5 border-b border-canvas-border last:border-b-0">
                            {/* No TB / GL chip any more — the box it sits in
                                already says which it is. */}
                            <div className="flex items-center gap-2">
                              <Paperclip size={12} className="text-ink-400 shrink-0" />
                              <span className="text-[12px] text-ink-900 flex-1 min-w-0 truncate" title={f.name}>{f.name}</span>
                              <button
                                onClick={() => setFiles(prev => prev.filter((_, x) => x !== i))}
                                className="text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"
                                aria-label={`Remove ${f.name}`}
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {/* Where it came from, asked as the file enters — the
                                audit carries the answer from here, and no control
                                is ever asked it again. */}
                            <div className="mt-2">
                              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-ink-400 mb-1">Came from</span>
                              <div className="grid grid-cols-2 gap-1.5">
                                {(['System export', 'Client-prepared'] as FileOrigin[]).map(o => (
                                  <button key={o} onClick={() => setFiles(prev => prev.map((x, n) => (n === i ? { ...x, origin: o } : x)))}
                                    className={cn('h-7 px-2 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1',
                                      f.origin === o ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border bg-white text-ink-600 hover:border-ink-300')}>
                                    {f.origin === o && <Check size={11} className="shrink-0" />}{o}
                                  </button>
                                ))}
                              </div>
                              {!f.origin && <p className="text-[10.5px] text-mitigated-800 font-semibold mt-1 leading-relaxed">Needed before a control can draw on it</p>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* The threshold — the half Continue gates on. */}
            <div className="mt-6 pt-5 border-t border-canvas-border">
              <h4 className="text-[13px] font-semibold text-ink-900 mb-0.5">Materiality rule</h4>
              <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
                Set before testing starts — exceptions are measured against it.
              </p>

              {/* Back to a dropdown (user ask), now five bases deep — the cards
                  cost half the step's height to say what the selected option's
                  hint says underneath in one line. */}
              <label className={labelCls}>Basis</label>
              <FormSelect
                value={basis}
                options={BASIS_OPTIONS.map(b => ({ value: b.id, label: b.label }))}
                onChange={v => changeBasis(v as MaterialityBasis)}
                className={`${selectCls} mb-1.5`}
                ariaLabel="Materiality basis"
                menuCls="w-full"
              />
              <p className="text-[11px] text-ink-400 mb-4">{basisOpt.hint}</p>

              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className={labelCls}>{basis === 'custom' ? 'Overall materiality (₹ Cr)' : `${basisOpt.benchmarkLabel} (₹ Cr)`}</label>
                  <input type="number" min={0} value={benchmark} onChange={e => setBenchmark(Number(e.target.value))} className={`${inputCls} tabular-nums`} />
                </div>
                {basis !== 'custom' && (
                  <div className="w-24">
                    <label className={labelCls}>Basis %</label>
                    <input type="number" min={0.1} max={100} step={0.1} value={pct} onChange={e => setPct(Number(e.target.value))} className={`${inputCls} tabular-nums`} />
                  </div>
                )}
              </div>

              {/* No overall-materiality callout here (user ask) — the computed
                  thresholds card below already opens with that number. */}

              {/* The two thresholds testing runs against (user ask). Both are a
                  share of overall, so they are asked as percentages and the
                  rupee figure is shown back — typing an amount that doesn't
                  match the percentage is the classic way these drift apart. */}
              {/* Stacked, not side by side (user ask) — full width lets each
                  row put its rupee figure on the same line as the percentage
                  that produced it, instead of wrapping the hint under a
                  half-width column. */}
              <div className="mt-4 space-y-3">
                {([
                  ['Performance materiality', pmPct, setPmPct, perf, 50, 75, 5, '% of overall — auditors typically set 50–75%'],
                  ['Clearly-trivial threshold', ctPct, setCtPct, trivial, 1, 10, 1, '% of overall — below this, differences are passed'],
                ] as const).map(([label, value, set, amount, lo, hi, stepBy, hint]) => (
                  <div key={label}>
                    <label className={labelCls}>{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={lo} max={hi} step={stepBy} value={value}
                        onChange={e => set(Math.min(hi, Math.max(lo, Number(e.target.value))))}
                        className={`${inputCls} tabular-nums w-20`}
                        aria-label={`${label} as a percentage of overall`}
                      />
                      <span className="text-[11.5px] text-ink-500 shrink-0">% of overall</span>
                      <span className="ml-auto text-[13px] font-semibold text-ink-900 tabular-nums shrink-0">{money(amount)}</span>
                    </div>
                    <p className="text-[11px] text-ink-400 leading-relaxed mt-1">{hint}</p>
                  </div>
                ))}
              </div>

              {/* Computed thresholds — the parked engagement-creation step's
                  summary card, brought over whole (user ask). It restates the
                  three amounts shown above; that repetition was raised and kept. */}
              <div className="mt-4 rounded-xl border border-canvas-border bg-white p-3.5">
                <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider mb-2">Computed thresholds</div>
                {([
                  ['Overall materiality', money(overall), basis === 'custom' ? 'Set directly' : `${pct}% × ₹${benchmark} Cr`, true],
                  ['Performance materiality', money(perf), `${pmPct}% of overall — the working threshold for testing`, false],
                  ['Clearly trivial', money(trivial), `${ctPct}% of overall — below this, differences are passed`, false],
                ] as const).map(([label, value, note, strong], i) => (
                  <div key={label} className={cn('py-2', i < 2 && 'border-b border-canvas-border')}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={cn('text-[12px]', strong ? 'font-semibold text-ink-900' : 'text-ink-600')}>{label}</span>
                      <span className={cn('tabular-nums', strong ? 'text-[14px] font-bold text-ink-900' : 'text-[12.5px] text-ink-800')}>{value}</span>
                    </div>
                    <div className="text-[10.5px] text-ink-400 mt-0.5">{note}</div>
                  </div>
                ))}
              </div>

              {/* Read-only — the ladder is where these numbers land, not another
                  place to set them. The significant-deficiency band comes from
                  the engagement's Materiality & scope rules. */}
              {overall > 0 && (
                <div className="mt-5">
                  <h5 className="text-[12px] font-semibold text-ink-900 mb-2">Where an exception would land</h5>
                  <div className="space-y-1">
                    {LADDER.map((r, i) => (
                      <div key={r.label} className={cn('flex items-center justify-between gap-3 px-3 py-2 rounded-lg border', r.tone)}>
                        <span className="text-[11.5px] font-semibold">
                          <span className="text-ink-300 tabular-nums mr-1.5">{i + 1}</span>{r.label}
                        </span>
                        <span className="text-[11px] tabular-nums text-right">{r.band}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-ink-400 mt-1.5 leading-relaxed">
                    Set on Materiality &amp; scope, shown here so you can see the effect before the audit is created.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <StepShell title="What this audit covers" sub="Scope by entity or by RACM — one or the other, then pick as many as the audit covers.">
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {([['entity', 'By entity', Building2], ['racm', 'By RACM', Grid3x3]] as const).map(([id, title, Icon]) => (
                <button
                  key={id}
                  onClick={() => switchKind(id)}
                  className={cn(
                    'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5',
                    scopeKind === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                      : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                  )}
                >
                  <Icon size={13} /> {title}
                </button>
              ))}
            </div>

            {/* Key controls only — the switch that does the picking, not a
                filter on the eye: SOX scopes to key controls far more often
                than not, and turning it on prunes anything non-key already
                selected rather than hiding it and quietly keeping it. */}
            {scopeKind === 'racm' && (
              <button
                role="switch"
                aria-checked={keyOnly}
                onClick={() => setKeyOnly(v => !v)}
                className="w-full mb-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-canvas-border bg-white hover:border-brand-300 transition-colors cursor-pointer text-left"
              >
                <span className={cn('w-8 h-[18px] rounded-full relative shrink-0 transition-colors', keyOnly ? 'bg-brand-600' : 'bg-ink-200')}>
                  <span className={cn('absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all', keyOnly ? 'left-[16px]' : 'left-[2px]')} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink-900">Key controls only</span>
                  <span className="block text-[11px] text-ink-500">
                    {keyOnly
                      ? 'Every key control is in scope. Untick any you don’t want.'
                      : 'Turn on to put every key control in scope at once.'}
                  </span>
                </span>
                <Star size={14} className={cn('ml-auto shrink-0', keyOnly ? 'text-mitigated-600 fill-mitigated-200' : 'text-ink-300')} />
              </button>
            )}

            {/* ── Entity side: derived, not picked ────────────────────────────
                The trial balance already says which companies carry enough to
                matter, so the wizard works it out and the auditor overrules it
                where judgement differs. The coverage bar is the headline: it is
                the one number that says whether the audit reaches far enough
                across the group. */}
            {scopeKind === 'entity' && scope.rows.length > 0 && (
              <div className="mb-3 rounded-xl border border-canvas-border bg-white px-3.5 py-3">
                <p className="text-[11.5px] text-ink-600 leading-relaxed">
                  <span className="text-[15px] font-bold text-ink-900 tabular-nums">{coveragePct}%</span> of the group covered
                  <span className="text-ink-400"> · target {COVERAGE_TARGET}%</span>
                </p>
                <span className="relative mt-2 block h-1.5 rounded-full bg-paper-100 overflow-visible">
                  <span
                    className={cn('absolute inset-y-0 left-0 rounded-full transition-all', coveragePct >= COVERAGE_TARGET ? 'bg-compliant-600' : 'bg-mitigated-500')}
                    style={{ width: `${Math.min(100, coveragePct)}%` }}
                  />
                  {/* The target, drawn where it falls — a bar with no mark on it
                      can't tell you whether you have cleared it. */}
                  <span className="absolute -top-0.5 h-2.5 w-px bg-ink-400" style={{ left: `${COVERAGE_TARGET}%` }} aria-hidden />
                </span>
                <p className="text-[11px] text-ink-400 mt-1.5 leading-relaxed">
                  {coveragePct >= COVERAGE_TARGET
                    ? 'Enough of the group is covered. Toggle any company in or out to overrule this.'
                    : `Below target — bring more companies in until ${COVERAGE_TARGET}% of the group is covered.`}
                </p>
              </div>
            )}

            <div className="border border-canvas-border rounded-xl overflow-hidden">
              {scopeKind === 'entity' ? (
                scope.rows.length === 0 ? (
                  <p className="text-[11.5px] text-ink-400 px-4 py-6 text-center">No entities on this engagement yet.</p>
                ) : scope.rows.map(row => {
                  const on = inScope(row);
                  const absent = row.status === 'absent';
                  return (
                    /* One white surface throughout (user ask). An excluded row
                       carries the design system's disabled treatment instead of
                       a tinted band — DESIGN.md §Disabled: opacity-50. */
                    <div
                      key={row.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-2.5 bg-white border-b border-canvas-border last:border-b-0 transition-colors',
                        absent ? 'opacity-50' : 'hover:bg-brand-50/40',
                      )}
                    >
                      {/* Colours stay as they are on every row — the wrapper's
                          opacity is what says "excluded", so the row reads as
                          the same row, dimmed. */}
                      {row.type === 'Holding'
                        ? <Landmark size={14} className="text-brand-600 shrink-0 mt-0.5" />
                        : <Building2 size={14} className="text-ink-400 shrink-0 mt-0.5" />}
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] text-ink-900 truncate">{row.name}</span>
                          {!absent && row.sharePct > 0 && (
                            <span className="text-[11px] tabular-nums text-ink-400 shrink-0 ml-auto">{row.sharePct}%</span>
                          )}
                        </span>
                        <span className="block text-[10.5px] text-ink-500 mt-0.5 leading-relaxed">{row.reason}</span>
                      </span>
                      {absent ? (
                        /* Nothing to weigh and nothing to test — so no toggle,
                           just the way out. Dropping it is this audit only; the
                           engagement keeps the company (user ask). */
                        <button
                          onClick={() => setDropped(prev => [...prev, row.id])}
                          aria-label={`Remove ${row.name} from this audit`}
                          title="Remove from this audit"
                          className="shrink-0 mt-0.5 p-1 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={`${on ? 'Take' : 'Bring'} ${row.name} ${on ? 'out of' : 'into'} scope`}
                          onClick={() => setOverrides(prev => ({ ...prev, [row.id]: !on }))}
                          className="shrink-0 mt-1 cursor-pointer"
                        >
                          <span className={cn('block w-8 h-[18px] rounded-full relative transition-colors', on ? 'bg-brand-600' : 'bg-ink-200')}>
                            <span className={cn('absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })
              ) : options.length === 0 ? (
                <p className="text-[11.5px] text-ink-400 px-4 py-6 text-center">
                  No RACMs yet — create one from the RACM tab first.
                </p>
              ) : options.map(o => {
                const on = picked.includes(o.id);

                // ── RACM row: tick the whole matrix, or open it and pick rows ──
                const rows = rowsOf(o.id);
                const chosen = rows.filter(c => pickedControls.includes(c.id)).length;
                const expanded = openRacm === o.id;
                return (
                  <div key={o.id} className="border-b border-canvas-border last:border-b-0">
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-50/40 transition-colors">
                      <button
                        onClick={() => togglePick(o.id)}
                        aria-label={`Select every control in ${o.primary}`}
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                          on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white',
                        )}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </button>
                      <Grid3x3 size={14} className="text-ink-400 shrink-0" />
                      <button
                        onClick={() => setOpenRacm(expanded ? null : o.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <span className="text-[13px] text-ink-900 truncate">{o.primary}</span>
                        <span className="text-[11px] text-ink-400 shrink-0 ml-auto tabular-nums">
                          {chosen > 0 ? `${chosen}/${rows.length} selected` : `${rows.length} control${rows.length === 1 ? '' : 's'}`}
                        </span>
                        <ChevronDown size={14} className={cn('text-ink-400 shrink-0 transition-transform', expanded && 'rotate-180')} />
                      </button>
                    </div>

                    {expanded && (
                      <div className="bg-canvas/60 border-t border-canvas-border">
                        {rows.length === 0 ? (
                          <p className="text-[11.5px] text-ink-400 px-4 py-4 text-center">
                            No key controls in this RACM — turn the switch off to see the rest.
                          </p>
                        ) : rows.map(c => {
                          const ticked = pickedControls.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleControl(o.id, c.id)}
                              className="w-full flex items-start gap-3 pl-9 pr-4 py-2 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
                            >
                              <span className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                                ticked ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white',
                              )}>
                                {ticked && <Check size={11} strokeWidth={3} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  {c.isKey && <Star size={11} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                                  <span className="text-[12px] text-ink-800 truncate">{c.description}</span>
                                </span>
                                <span className="block text-[10.5px] text-ink-400 font-mono mt-0.5">{c.id} · {c.subProcess}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] text-ink-400 mt-2">
              {scopeKind === 'entity'
                ? `${scopedEntities.length} entit${scopedEntities.length === 1 ? 'y' : 'ies'} in scope`
                : `${picked.length} RACM${picked.length === 1 ? '' : 's'} · ${pickedControls.length} control${pickedControls.length === 1 ? '' : 's'} selected`}
            </p>

          </StepShell>
        )}

        {step === REVIEW && (
          <StepShell title="Review" sub="Check it over — creating the audit adds it to this engagement's SOX audit tab.">
            <div className="rounded-xl border border-canvas-border bg-white p-4">
              {/* Same order the steps ran in — Period, then materiality and its
                  files, then what they scoped. */}
              {/* The dates ARE the period now, so "· Custom range" after them
                  would just say the same thing twice. Round always shows —
                  every audit answers it. */}
              <ReviewRow label="Period" value={periodLabel} />
              <ReviewRow label="Round" value={AUDIT_ROUNDS.find(r => r.id === round)!.label} />
              <ReviewRow label="Materiality" value={<>₹{overall} Cr <span className="font-normal text-ink-400">· {basisOpt.label}</span></>} />
              <ReviewRow label="Performance materiality" value={<>{money(perf)} <span className="font-normal text-ink-400">· {pmPct}% of overall</span></>} />
              <ReviewRow label="Clearly trivial" value={<>{money(trivial)} <span className="font-normal text-ink-400">· {ctPct}% of overall</span></>} />
              <ReviewRow
                label="TB / GL"
                value={files.length === 0 ? <span className="font-normal text-ink-400">Not attached</span> : files.map(f => f.name).join(', ')}
              />
              <ReviewRow
                label={scopeKind === 'entity' ? 'Entities' : 'RACMs'}
                value={pickedNames.join(', ')}
              />
              {scopeKind === 'racm' && (
                <ReviewRow
                  label="Controls"
                  value={<>{pickedControls.length} selected{keyOnly && <span className="font-normal text-ink-400"> · key controls only</span>}</>}
                />
              )}
            </div>
          </StepShell>
        )}
      </motion.div>

      {/* footer — Back / Continue. No Skip: files stopped being their own step,
          so there is nothing to skip past — Continue simply never waits on them.
          Pinned to the bottom of the sheet: -mx-6 px-6 bleeds it to the sheet
          edges, pb-6 restores the padding FlowModal drops with its pb-0. */}
      <div className="sticky bottom-0 z-10 bg-canvas -mx-6 px-6 mt-6 pt-4 pb-6 border-t border-canvas-border flex items-center justify-between gap-2">
        <button
          onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          {step < REVIEW ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canContinue}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Continue <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={create}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
            >
              <Check size={14} /> Create audit
            </button>
          )}
        </div>
      </div>
      </div>
    </FlowModal>
  );
}
