import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarRange, Check, ChevronDown, FileSpreadsheet,
  Grid3x3, Landmark, Lock, Paperclip, Pencil, Plus, Scale, Sparkles, Star, Trash2, Upload, X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FlowModal } from '../audit/sox-testing/SoxTestingTab';
import DesignControlAddModal from '../audit/DesignControlAddModal';
import { StepRail } from '../audit/sox-testing/ScopingWizard';
import { FormSelect } from '../shared/FilterSelect';
import { CustomDatePicker } from '../shared/CustomDatePicker';
import {
  BASIS_OPTIONS, currentFyEnd, entityShort, QUAL_REASONS, ruleOverall,
  type GroupEntity, type MaterialityBasis, type TbCaption,
} from '../audit/sox-testing/soxTestingData';
import { auditStatus } from './auditPortfolio';
import {
  auditCovers, chainDepth, COVERAGE_TARGET, programmeFor, type DerivedScopeRow, deriveEntityScope,
  entitiesFor, entitiesInFiles, entityTotals, materialAccounts, mergeScopeEntities, normaliseProcess,
  type ProcessScopeRow, recommendProcesses, SOX_MAPPING_PROCESSES,
} from './auditScope';
import { conclusionOf, isEngagementLocked, spreadPhrase, trackResult } from './helpers';
import RacmImportReview from './RacmImportReview';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import {
  AUDIT_ROUNDS, AUDIT_SAMPLE_METHODS, AUDIT_SAMPLE_SPREADS, DEFAULT_AUDIT_SAMPLING,
  type AuditRecord, type AuditRound, type AuditSampleMethod, type AuditSampleSpread, type AuditScopeKind, type Control, type FileOrigin,
} from './types';
import { cn } from '../../lib/cn';

/**
 * New audit — the wizard behind the New audit button on the Overview and the
 * SOX audit tab.
 *
 * Audit period → Review (S11 follow-up, user ask). Materiality, the trial
 * balance and scoping are done once, when the engagement is created, so an audit
 * no longer asks for them: it tests every control in the engagement's Control
 * Library (the ones scoped at creation plus any added since with Add RACM) and
 * takes its materiality and TB / GL from the engagement. The two steps that used
 * to sit in between are PARKED behind SCOPING_STEPS below; what follows
 * describes them as they were.
 *
 * Period → Materiality & files → Scope → Review (user ask). Materiality leads
 * because that is the order the work happens in: you set the threshold, load the
 * trial balance it is applied to, and what comes back is what should be in
 * scope — so scope is the answer, not the opening question. The trial balance is
 * required now (user ask) for every audit but a roll-forward: its material
 * accounts are mapped to processes on that step, and Scope opens on Ira's
 * process recommendation built from that mapping. A roll-forward's files stay
 * optional — its scope is its parent's conclusions, not the numbers.
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

/** PARKED (S11 follow-up): Materiality & files and Scope. Scoping moved to
 *  engagement creation. Flip back to true to restore both steps — their blocks,
 *  gates and footer hints are all behind this flag, and create() goes back to
 *  building the scope from them. */
const SCOPING_STEPS = false;
const STEPS: readonly string[] = SCOPING_STEPS
  ? ['Audit period', 'Materiality & files', 'Scope', 'Review']
  : ['Audit period', 'Review'];
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

export default function NewAuditWizard({ onClose, prefillFrom }: {
  onClose: () => void;
  /** Set when the sheet was opened by a Roll forward button (user ask — one
   *  screen, one rulebook: the separate roll-forward sheet is gone). The wizard
   *  opens on this audit's year with the next pass pre-picked: interim →
   *  roll-forward, roll-forward → year-end, and past a year-end into the next
   *  year's interim. Every gate still applies — a blocked round stays blocked,
   *  with its reason showing, rather than being forced through. */
  prefillFrom?: AuditRecord;
}) {
  const { eng, role, createAudit, createRacm, registerFile, addControl, addDesignPoint, setControlKey, me } = useIcfr();
  const logEvent = useAuditLog();
  const { addToast } = useToast();
  const [step, setStep] = useState(0);

  /** What the Roll forward button on `prefillFrom` means, resolved once. */
  const prefill = prefillFrom ? {
    basis: (prefillFrom.yearBasis === 'cy' ? 'cy' : 'fy') as 'fy' | 'cy',
    year: prefillFrom.round === 'yearend' ? prefillFrom.fiscalYear + 1 : prefillFrom.fiscalYear,
    round: (prefillFrom.round === 'interim' ? 'rollforward'
      : prefillFrom.round === 'rollforward' ? 'yearend'
      : 'interim') as AuditRound,
  } : null;

  // ── Period ───────────────────────────────────────────────────────────────
  // Financial year first, round second, dates last (user ask) — the year decides
  // which rounds are even available, and the round decides what the dates can
  // be, so the questions run in dependency order. The free From/To mode this
  // step used to be is gone: every audit is now one of the three rounds inside a
  // named year, and the only date a user ever types is the interim cut-off.
  const [yearBasis, setYearBasis] = useState<'fy' | 'cy'>(prefill?.basis ?? 'fy');
  // The year the cycle ENDS on (FY 2026-27 ⇒ 2027), matching AuditRecord.fiscalYear.
  const [year, setYear] = useState<number>(prefill ? prefill.year : currentFyEnd);
  const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // The current year plus a step either side and two ahead — audits are planned
  // for the running year or the coming one (user ask), never created inline.
  // Cheap enough to rebuild per render, which lets a Roll forward arriving from
  // an older cycle add its year instead of rendering as an unlabelled value.
  const yearMid = yearBasis === 'fy' ? currentFyEnd() : currentFyEnd() - 1;
  const yearOptions = [yearMid - 1, yearMid, yearMid + 1, yearMid + 2];
  if (prefill && prefill.basis === yearBasis && !yearOptions.includes(prefill.year)) yearOptions.unshift(prefill.year);

  const yearLabelOf = (b: 'fy' | 'cy', y: number) => (b === 'fy' ? `FY ${y - 1}-${String(y).slice(-2)}` : `CY ${y}`);
  const yearSpanOf = (b: 'fy' | 'cy', y: number) => (b === 'fy' ? `Apr ${y - 1} – Mar ${y}` : `Jan – Dec ${y}`);
  const yearStart = yearBasis === 'fy' ? `${year - 1}-04-01` : `${year}-01-01`;
  const yearEnd = yearBasis === 'fy' ? `${year}-03-31` : `${year}-12-31`;
  const periodLabel = yearLabelOf(yearBasis, year);
  const periodSpan = yearSpanOf(yearBasis, year);

  const shiftDay = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** Which round of the cycle this is. Starts unanswered (user ask): the date
   *  fields don't render until it is, because what they can hold depends on it. */
  const [round, setRound] = useState<AuditRound | null>(null);
  /** The concluded interim a roll-forward extends — its parent. */
  const [parentId, setParentId] = useState<string | null>(null);
  /** Interim / year-end From — prefilled with the year start, editable. */
  const [fromDate, setFromDate] = useState('');
  /** The interim cut-off. The one date in the flow that is genuinely the
   *  auditor's to pick. */
  const [cutoff, setCutoff] = useState('');

  // ── Round availability ───────────────────────────────────────────────────
  // Interim + roll-forward, or year-end alone — those are the two ways coverage
  // legitimately reaches the year end, and these gates keep every other
  // combination uncreatable rather than merely inadvisable.
  const sameYearAudits = useMemo(
    () => eng.audits.filter(a => a.yearBasis === yearBasis && a.fiscalYear === year),
    [eng.audits, yearBasis, year],
  );
  const hasYearEnd = sameYearAudits.some(a => a.round === 'yearend');
  const yearInterims = sameYearAudits.filter(a => a.round === 'interim');
  // Concluded = signed by preparer AND reviewer, or archived — auditStatus's
  // meaning of the word (user ask). An unsigned interim is still someone's open
  // work, and a roll-forward can only extend an answer that has been given.
  const concludedInterims = useMemo(
    () => sameYearAudits.filter(a => a.round === 'interim' && auditStatus(a, eng) === 'concluded'),
    [sameYearAudits, eng],
  );

  /** null = available; a string = why it isn't. A greyed-out option with no
   *  explanation sends people to support (user ask), so the reason renders. */
  const roundGate: Record<AuditRound, string | null> = {
    interim: hasYearEnd ? `A year-end audit already covers ${periodLabel}.` : null,
    // A year-end round closes the year on the balance-sheet date, so there is
    // nothing left for a roll-forward to extend towards — the same reason
    // interim is blocked above. Without this the year-end could be signed and a
    // roll-forward still opened after it, back-filling a window the ICFR opinion
    // had already been given on.
    rollforward: hasYearEnd ? `A year-end audit already closes ${periodLabel} — there is nothing left to extend towards.`
      : concludedInterims.length > 0 ? null
      : yearInterims.length > 0
        ? `Sign off the ${periodLabel} interim first — a roll-forward extends a concluded interim.`
        : `Create and conclude an interim audit for ${periodLabel} first.`,
    yearend: hasYearEnd ? `A year-end audit already exists for ${periodLabel}.` : null,
  };

  /** What an audit concluded, control by control. A concluded audit's results
   *  live in one of two places: on its archive snapshot once a later cycle has
   *  started, or still on the controls themselves while it is the signed live
   *  cycle — this reads whichever holds them. The results are only READ here;
   *  they stay on the audit that produced them, never copied forward. */
  const verdictsFor = (a: AuditRecord) => (a.archive
    ? a.archive.conclusions.map(v => ({ id: v.controlId, wpRef: v.wpRef, description: v.description, process: v.process, conclusion: v.conclusion, design: v.design }))
    : eng.controls.filter(c => auditCovers(a, c, eng.id)).map(c => ({ id: c.id, wpRef: c.wpRef, description: c.description, process: c.process, conclusion: conclusionOf(eng, c), design: trackResult(c.design) })));
  const effectiveIdsOf = (a: AuditRecord) => verdictsFor(a).filter(v => v.conclusion === 'Effective').map(v => v.id);

  /** The controls this roll-forward carries — starts as everything the parent
   *  concluded effective, narrowable but never widenable past that list. */
  const [rfPicked, setRfPicked] = useState<string[]>([]);
  const toggleRf = (id: string) =>
    setRfPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  /** Changing the year restarts everything under it — round availability and
   *  every date depend on the answer, so stale picks must not survive it. */
  const changeYear = (b: 'fy' | 'cy', y: number) => {
    setYearBasis(b);
    setYear(y);
    setRound(null);
    setParentId(null);
    setFromDate('');
    setCutoff('');
    setRfPicked([]);
  };

  const applyRound = (r: AuditRound, preferredParentId?: string) => {
    setRound(r);
    // Prefill, don't dictate: interim and year-end open on the year start and
    // stay editable. Roll-forward's dates are derived below and never held in
    // state — deriving on render is what makes them impossible to edit.
    setFromDate(r === 'rollforward' ? '' : yearStart);
    setCutoff('');
    // The interim the Roll forward button was pressed on when there was one,
    // else the newest concluded interim by cut-off.
    const pick = r === 'rollforward'
      ? concludedInterims.find(a => a.id === preferredParentId)
        ?? [...concludedInterims].sort((a, b) => b.windowTo.localeCompare(a.windowTo))[0]
      : undefined;
    setParentId(pick?.id ?? null);
    setRfPicked(pick ? effectiveIdsOf(pick) : []);
  };
  const pickRound = (r: AuditRound) => {
    if (roundGate[r]) return;
    applyRound(r);
  };

  // Opened from a Roll forward button: pre-pick the next pass, once, on mount.
  // A gated round is NOT forced through — the sheet opens on the right year
  // with the round unchosen and the gate's reason showing, which is the answer
  // to "why can't I roll this forward" rather than a silently broken prefill.
  useEffect(() => {
    if (!prefill || roundGate[prefill.round]) return;
    applyRound(prefill.round, prefillFrom!.id);
    // Mount-only by design — re-running would stamp the prefill back over the
    // user's later choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Swapping the parent swaps whose conclusions the scope is built from, so
   *  the carried list resets to the new parent's effective controls. */
  const changeParent = (id: string) => {
    setParentId(id);
    const a = concludedInterims.find(x => x.id === id);
    setRfPicked(a ? effectiveIdsOf(a) : []);
  };

  const parent = concludedInterims.find(a => a.id === parentId);
  // The parent's conclusions split the roll-forward's world in three (user
  // ask): effective controls carry (design travels, operating re-tested to
  // year end, narrowable); FAILED controls come along MANDATORILY with their
  // open findings — no untick, an open finding must not be droppable from
  // scope — and TOD is retested only where TOD itself failed; controls the
  // interim never touched stay out, because a roll-forward has nothing of
  // theirs to extend — they wait for the year-end audit.
  const parentVerdicts = parent ? verdictsFor(parent) : [];
  const rfEffective = parentVerdicts.filter(v => v.conclusion === 'Effective');
  const rfFailed = parentVerdicts.filter(v => v.conclusion === 'Ineffective');
  const rfExcluded = parentVerdicts.filter(v => v.conclusion !== 'Effective' && v.conclusion !== 'Ineffective');
  /** Open findings riding with a control into the roll-forward. */
  const openDefCount = (controlId: string) =>
    eng.deficiencies.filter(d => d.controlId === controlId && d.status !== 'Closed').length;
  // The derived window. Roll-forward picks up the day after its parent stopped
  // and runs to the year end — a gap or an overlap between the two is a hole in
  // the year's coverage that no later screen would catch, so neither date is a
  // choice. Year-end always closes on the year end for the same reason: the
  // ICFR opinion is given as of that date.
  const windowFrom = round === 'rollforward' ? (parent ? shiftDay(parent.windowTo, 1) : '') : fromDate;
  const windowTo = round === 'interim' ? cutoff : yearEnd;
  // The interim cut-off must stop short of the year end — a cut-off ON it is a
  // year-end audit wearing the wrong name. maxDate on the picker enforces it at
  // the source, and this mirrors that for the Continue gate.
  const periodValid = round === 'interim' ? !!fromDate && !!cutoff && fromDate <= cutoff && cutoff < yearEnd
    : round === 'rollforward' ? !!parent
    : round === 'yearend' ? !!fromDate && fromDate <= yearEnd
    : false;

  // ── Sampling methodology (A28) ───────────────────────────────────────────
  // Agreed once for the whole audit — how items are selected and what every
  // control's draw has to be spread across — so no control picks its own. A new
  // audit starts on a plain random draw with no spread asked for.
  const [sampMethod, setSampMethod] = useState<AuditSampleMethod>(DEFAULT_AUDIT_SAMPLING.method);
  const [sampSpread, setSampSpread] = useState<AuditSampleSpread[]>(DEFAULT_AUDIT_SAMPLING.spread);
  const toggleSpread = (id: AuditSampleSpread) =>
    setSampSpread(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  /** What the audit is created with. A roll-forward reads its interim's, the way
   *  it reads the year and the materiality rule — two halves of one year are
   *  sampled one way. */
  const sampFinal = round === 'rollforward' && parent
    ? (parent.sampling ?? DEFAULT_AUDIT_SAMPLING)
    : { method: sampMethod, spread: AUDIT_SAMPLE_SPREADS.map(x => x.id).filter(id => sampSpread.includes(id)) };

  // ── Files ────────────────────────────────────────────────────────────────
  // Provenance rides with the file from the moment it is picked — it is a
  // property of the FILE, and this is where the file enters the audit.
  const [files, setFiles] = useState<{ name: string; kind: 'tb' | 'gl'; origin?: FileOrigin }[]>([]);
  /** A trial balance is attached. Required before Materiality & files will pass
   *  on anything but a roll-forward (user ask) — the account mapping and Ira's
   *  process recommendation both read it. The general ledger never is. */
  const hasTb = files.some(f => f.kind === 'tb');
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

  /** The rule this audit will actually be created with. A roll-forward reads
   *  its parent's, verbatim (user ask) — an interim and its roll-forward are
   *  two halves of one year, and two figures for one year would grade the same
   *  deficiency two different ways. Everything else reads the step's inputs.
   *  The 75 / 5 fallbacks match what every reader of pmPct / ctPct assumes for
   *  audits created before the wizard asked for them. */
  const matFinal = round === 'rollforward' && parent
    ? { ...parent.materiality, pmPct: parent.materiality.pmPct ?? 75, ctPct: parent.materiality.ctPct ?? 5, overall: parent.overall }
    : { basisLabel: basisOpt.label, benchmark, pct, pmPct, ctPct, overall };
  const matPerf = matFinal.overall * matFinal.pmPct / 100;
  const matTrivial = matFinal.overall * matFinal.ctPct / 100;

  // ── From the engagement (S11 follow-up) ──────────────────────────────────
  // What the audit is created with now the wizard no longer asks: the rule and
  // files set when the engagement was created. The programme record holds them
  // (every SOX engagement has one, created or back-filled); an engagement
  // without one falls back to its own thresholds, stored in rupees.
  const programme = useMemo(() => programmeFor(eng.id), [eng.id]);
  const engMat = useMemo(() => {
    const m = programme?.materiality;
    if (m) return { basisLabel: m.benchmarkLabel, benchmark: m.benchmark, pct: m.pct, pmPct: m.pmPct, ctPct: m.cttPct, overall: m.overall };
    const overallCr = eng.materiality / 10_000_000;
    return {
      basisLabel: 'Overall materiality', benchmark: overallCr, pct: 100, overall: overallCr,
      pmPct: eng.materiality ? Math.round(eng.performanceMateriality / eng.materiality * 100) : 75,
      ctPct: eng.materiality ? Math.round(eng.rules.clearlyTrivial / eng.materiality * 100) : 5,
    };
  }, [programme, eng.materiality, eng.performanceMateriality, eng.rules.clearlyTrivial]);
  const engFiles = useMemo<{ name: string; kind: 'tb' | 'gl' }[]>(() => {
    if (programme?.scoping?.files.length) return programme.scoping.files;
    const tbs = Array.from(new Set((programme?.entities ?? []).map(e => e.tbFile).filter((f): f is string => !!f)));
    return tbs.map(name => ({ name, kind: 'tb' as const }));
  }, [programme]);
  /** Every control the audit will test — the whole Control Library, by process. */
  const libraryByProcess = useMemo(() => {
    const map = new Map<string, number>();
    eng.controls.forEach(c => map.set(c.process, (map.get(c.process) ?? 0) + 1));
    return Array.from(map, ([process, count]) => ({ process, count })).sort((a, b) => a.process.localeCompare(b.process));
  }, [eng.controls]);

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
  /** Which RACM the add-control screen is adding to. Null when it's closed —
   *  the RACM is settled by the row the button was pressed on, so the form
   *  never has to ask which matrix this belongs to. */
  const [addCtrlRacm, setAddCtrlRacm] = useState<string | null>(null);
  /** Controls created on this wizard's add-control screen. Handed to
   *  createAudit so they aren't reset along with the rest of the scope. */
  const [addedControlIds, setAddedControlIds] = useState<string[]>([]);
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

  /**
   * Key / non-key, set from the row being scoped.
   *
   * Scoping is where the question actually comes up — you are looking at the
   * matrix deciding what this round covers, and "that one is key too" is the
   * thought you have there, not on a control's own page three clicks away.
   *
   * It is the SAME judgement the control page sets, on the same field, so it
   * lands on the engagement's control and shows up wherever that control is
   * read: the RACM, both registers, the working paper and the audit report.
   *
   * No concluded-control guard, unlike the control page: scoping runs before
   * any testing exists. A new audit is created with nothing tested, and a
   * roll-forward carries the RACM and its controls but starts testing from
   * zero, so the question is always asked of an untested control.
   */
  const toggleKey = (c: Control) => {
    setControlKey(c.id, !c.isKey);
    logEvent({
      action: 'Update', module: 'SOX ICFR', entity: 'Control',
      description: `${c.isKey ? 'Unmarked' : 'Marked'} ${c.id} as a key control while scoping a new audit`,
    });
    // A row that stops being key would vanish out from under the cursor while
    // the key-only switch is on, so the switch gives way — same as it does when
    // a non-key control is added to a RACM.
    if (keyOnly && c.isKey) setKeyOnly(false);
  };

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

  // ── Material accounts → processes (A34a) ─────────────────────────────────
  // Asked on Materiality & files once a trial balance is attached, and only of
  // the accounts that clear performance materiality — so it re-lists itself as
  // the rule on that step changes. Ira pre-fills each account with the process
  // its caption suggests; the auditor corrects any that landed wrong.
  /** The auditor's picks, by caption id. Absent means "Ira's suggestion". Kept
   *  for an account that drops below the threshold, so it comes back as it was
   *  left if the rule moves back. */
  const [accountMap, setAccountMap] = useState<Record<string, string>>({});
  const materialRows = useMemo(() => (hasTb ? materialAccounts(eng.id, perf) : []), [eng.id, perf, hasTb]);
  const processOf = useCallback(
    (c: TbCaption) => accountMap[c.id] ?? normaliseProcess(c.process),
    [accountMap],
  );
  /** Every process the engagement already has a RACM for, by its normalised name. */
  const racmProcessNames = useMemo(() => racms.map(r => normaliseProcess(r.name)), [racms]);
  const racmFor = (process: string) => racms.find(r => normaliseProcess(r.name) === process);
  /** The standard SOX list, then any other process the engagement keeps a RACM
   *  for (IT General Controls, say). A process with no RACM yet says so in its
   *  label — mapping an account there is allowed, but it is a process nothing
   *  can be tested in until one is uploaded. */
  const mappingOptions = useMemo(() => {
    const names = [...SOX_MAPPING_PROCESSES, ...racmProcessNames.filter(p => !(SOX_MAPPING_PROCESSES as readonly string[]).includes(p))];
    return names.map(p => ({ value: p, label: racmProcessNames.includes(p) ? p : `${p} · no RACM yet` }));
  }, [racmProcessNames]);

  // ── Processes in scope (A34b / A34c) ─────────────────────────────────────
  // Ira's recommendation, from the mapping: a process is in when a material
  // account maps to it. The auditor moves any process against that with a note,
  // the same way a company is overruled — and bringing one IN against it is a
  // qualitative pick, which takes a reason from the list as well.
  const processRows = useMemo(
    () => recommendProcesses(materialRows.map(c => ({ balance: c.balance, process: processOf(c) })), racmProcessNames),
    [materialRows, processOf, racmProcessNames],
  );
  /** Where the auditor overruled Ira, by process. Absent means "as recommended",
   *  so an entry always argues with the recommendation — `true` is a
   *  qualitative pick, `false` a recommended process taken out. */
  const [procOverrides, setProcOverrides] = useState<Record<string, boolean>>({});
  /** Saved reasons and the ones being typed — same split, and the same Cancel
   *  semantics, as the companies' `scopeNotes` / `noteDrafts`. */
  const [procNotes, setProcNotes] = useState<Record<string, string>>({});
  const [procNoteDrafts, setProcNoteDrafts] = useState<Record<string, string>>({});
  /** The qualitative reason, saved and draft. '' in a draft = not picked yet. */
  const [procReasons, setProcReasons] = useState<Record<string, string>>({});
  const [procReasonDrafts, setProcReasonDrafts] = useState<Record<string, string>>({});
  const procInScope = (r: ProcessScopeRow) => procOverrides[r.process] ?? r.recommended;

  /** Drop every trace of a move — the process is back where Ira had it. */
  const clearProcMove = (process: string) => {
    const strip = <T,>(prev: Record<string, T>): Record<string, T> => {
      if (!(process in prev)) return prev;
      const out = { ...prev }; delete out[process]; return out;
    };
    setProcOverrides(strip);
    setProcNotes(strip);
    setProcNoteDrafts(strip);
    setProcReasons(strip);
    setProcReasonDrafts(strip);
  };
  /** Flip one process, and open its note box. Landing back on the
   *  recommendation clears the move and its note, as with a company. */
  const flipProcess = (r: ProcessScopeRow) => {
    const next = !procInScope(r);
    if (next === r.recommended) { clearProcMove(r.process); return; }
    setProcOverrides(prev => ({ ...prev, [r.process]: next }));
    setProcNoteDrafts(prev => ({ ...prev, [r.process]: procNotes[r.process] ?? '' }));
    if (next) setProcReasonDrafts(prev => ({ ...prev, [r.process]: procReasons[r.process] ?? '' }));
  };
  const saveProcNote = (process: string) => {
    const text = (procNoteDrafts[process] ?? '').trim();
    const qualitative = procOverrides[process] === true;
    const reason = procReasonDrafts[process] ?? '';
    if (!text || (qualitative && !reason)) return;
    setProcNotes(prev => ({ ...prev, [process]: text }));
    if (qualitative) setProcReasons(prev => ({ ...prev, [process]: reason }));
    setProcNoteDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
    setProcReasonDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
  };
  /** Re-editing a saved note: throw the edit away. Backing out of a fresh flip:
   *  no move without a reason, so the process goes back where Ira had it. */
  const cancelProcNote = (process: string) => {
    if (!procNotes[process]) { clearProcMove(process); return; }
    setProcNoteDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
    setProcReasonDrafts(prev => { const out = { ...prev }; delete out[process]; return out; });
  };

  // Remapping an account or moving the rule re-draws the rows: a process can
  // lose its row, or Ira can come round to the auditor's view. Either way the
  // move no longer argues with anything, so it goes — along with its note, or
  // it would sit there holding Continue for a decision nobody is making.
  useEffect(() => {
    const rec = new Map(processRows.map(r => [r.process, r.recommended]));
    Object.entries(procOverrides).forEach(([p, v]) => {
      if (!rec.has(p) || rec.get(p) === v) clearProcMove(p);
    });
    // Keyed on the rows alone — the overrides are read, not watched; a flip
    // never changes the rows, so there is nothing to catch there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processRows]);

  /** Every process the auditor moved, with its reason. Drives the note gate,
   *  Review and the audit record. */
  const procChanges = processRows
    .filter(r => procOverrides[r.process] !== undefined)
    .map(r => ({
      ...r,
      inScope: procOverrides[r.process]!,
      qualitative: procOverrides[r.process] === true,
      reason: procReasons[r.process] ?? '',
      note: (procNotes[r.process] ?? '').trim(),
    }));
  const procNotesOutstanding = procChanges.filter(c => !c.note || (c.qualitative && !c.reason)).length;
  const scopedProcesses = processRows.filter(procInScope);
  const recommendedCount = processRows.filter(r => r.recommended).length;
  /** In scope with nothing to test it with. Continue holds until each has a
   *  RACM uploaded, or is moved out with a note. */
  const noRacmInScope = scopedProcesses.filter(r => !racmFor(r.process)).map(r => r.process);

  // ── Upload RACM, from the Processes panel ────────────────────────────────
  // The RACM tab's own import review, with the process already settled by the
  // row the button was pressed on. Nothing reaches the engagement until it
  // imports, and it imports through the same store path the tab uses.
  const canUploadRacm = role === 'auditor' && !isEngagementLocked(eng);
  const [racmUpload, setRacmUpload] = useState<{ file: File; process: string; entity: string } | null>(null);
  /** The process whose RACM is on its way in. The store adds the controls a
   *  render later, so they are picked up off `eng.controls` below rather than
   *  out of the import callback — which also catches the review's "use the
   *  template instead", a path that creates the RACM without calling it. */
  const [awaitingRacm, setAwaitingRacm] = useState<string | null>(null);
  const uploadRacm = (process: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      // The matrix belongs to one company (createRacm stamps it on every row) —
      // the one carrying most of this process's material balance.
      const top = [...materialRows].filter(c => processOf(c) === process).sort((a, b) => b.balance - a.balance)[0];
      setRacmUpload({ file, process, entity: (top && entities.find(e => e.id === top.entityId)?.name) ?? '' });
      setAwaitingRacm(process);
    };
    input.click();
  };
  useEffect(() => {
    if (!awaitingRacm) return;
    const rows = eng.controls.filter(c => normaliseProcess(c.process) === awaitingRacm);
    if (!rows.length) return;
    const ids = rows.map(c => c.id);
    // Born for this audit, like a control added on the RACM side — creating the
    // audit must not reset away the attributes and design checks just imported.
    setAddedControlIds(prev => Array.from(new Set([...prev, ...ids])));
    // Onto the RACM side, ticked. An untouched RACM side is left alone: its
    // first open pre-ticks every in-scope process's RACM, this one included.
    if (scopeKind === 'racm' || picked.length || pickedControls.length) {
      const name = rows[0]!.process;
      if (keyOnly && rows.some(c => !c.isKey)) setKeyOnly(false);
      setPicked(prev => (prev.includes(name) ? prev : [...prev, name]));
      setPickedControls(prev => Array.from(new Set([...prev, ...ids])));
    }
    setAwaitingRacm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng.controls, awaitingRacm]);

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
  /** Why they overruled it, by entity id. Written in the box that opens under a
   *  flipped row, and required before Continue (user ask) — a scope decision
   *  that argues with the trial balance has to say what it knows that the
   *  numbers don't. */
  const [scopeNotes, setScopeNotes] = useState<Record<string, string>>({});
  /** The note being typed, by entity id — separate from the saved one above so
   *  Cancel has something to throw away (user ask). An entry here means that
   *  row's box is open for editing; no entry means it's saved and collapsed.
   *  Only a SAVED note releases Continue, which is what makes Save mean
   *  something rather than decorate a field that already committed itself. */
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

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

  /** Companies left out while the company that HOLDS them is in. Not an error —
   *  a 26%-owned terminal under an in-scope parent can be a deliberate omission
   *  — but it is a decision, and on a flat list nobody could see it had been
   *  made. Named so the reviewer can ask about it before the audit starts.
   *
   *  Only from the THIRD level down. Leaving out a subsidiary held directly by
   *  the top company is ordinary scoping — it is what the coverage meter above
   *  already governs, and flagging it fires on every audit ever scoped, which
   *  is how a warning gets ignored. A sub-group split is the news: taking
   *  Roadways in while the parks it holds stay out. */
  const splitFromParent = useMemo(
    () => scope.rows.filter(r => {
      if (inScope(r) || r.status === 'absent' || !r.parentId) return false;
      if (chainDepth(r, scope.rows) < 2) return false;
      const parent = scope.rows.find(x => x.id === r.parentId);
      return !!parent && inScope(parent);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope.rows, overrides],
  );

  /** What the derivation said before anyone touched it — the baseline a flip is
   *  measured against. */
  const derived = (r: DerivedScopeRow) => r.status === 'tb' || r.status === 'coverage';
  /** Flip one company in or out, and open the note box under it.
   *
   *  Landing back on the derivation drops the override entirely and takes the
   *  note with it: once the audit agrees with the numbers again there is no
   *  decision left to explain, so holding Continue for a note would be asking
   *  the auditor to justify changing their mind back. */
  const flipEntity = (r: DerivedScopeRow) => {
    const next = !inScope(r);
    const backToDerived = next === derived(r);
    setOverrides(prev => {
      const out = { ...prev };
      if (backToDerived) delete out[r.id]; else out[r.id] = next;
      return out;
    });
    if (backToDerived) {
      setScopeNotes(prev => { const out = { ...prev }; delete out[r.id]; return out; });
      setNoteDrafts(prev => { const out = { ...prev }; delete out[r.id]; return out; });
    } else {
      // Moving the company opens its box straight away, primed with whatever
      // reason was already given if this row has been round the houses before.
      setNoteDrafts(prev => ({ ...prev, [r.id]: scopeNotes[r.id] ?? '' }));
    }
  };
  /** Commit the typed reason. */
  const saveNote = (id: string) => {
    const text = (noteDrafts[id] ?? '').trim();
    if (!text) return;
    setScopeNotes(prev => ({ ...prev, [id]: text }));
    setNoteDrafts(prev => { const out = { ...prev }; delete out[id]; return out; });
  };
  /** Cancel means two different things, and the difference is whether a reason
   *  was ever saved. Re-editing one: drop the edit, keep what was there. Backing
   *  out of a fresh flip: there can't be a change without a reason, so cancelling
   *  the reason puts the company back where the trial balance had it. */
  const cancelNote = (r: DerivedScopeRow) => {
    setNoteDrafts(prev => { const out = { ...prev }; delete out[r.id]; return out; });
    if (scopeNotes[r.id]) return;
    setOverrides(prev => { const out = { ...prev }; delete out[r.id]; return out; });
  };
  /** Every company the auditor moved, with the reason they gave. Drives the note
   *  gate, the Review step and the audit record. */
  const scopeChanges = useMemo(
    () => scope.rows
      .filter(r => r.status !== 'absent' && overrides[r.id] !== undefined)
      .map(r => ({
        entityId: r.id,
        name: r.name,
        inScope: !!overrides[r.id],
        note: (scopeNotes[r.id] ?? '').trim(),
      })),
    [scope.rows, overrides, scopeNotes],
  );
  /** Flipped rows still waiting on their note. Continue holds until it's zero. */
  const notesOutstanding = scopeChanges.filter(c => !c.note).length;
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
    // The notes follow their overrides out — a reason for a company that no
    // longer has a row would otherwise sit there holding Continue hostage.
    setScopeNotes(prev => {
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => live.has(id)));
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
    setNoteDrafts(prev => {
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
   * of the processes in scope on the Processes panel above (A34b) — that panel
   * is where the processes in play were decided, so making you re-derive it by
   * hand was busywork. It used to pre-tick from the in-scope companies instead.
   * It only ever pre-ticks an untouched list — once you have picked, going back
   * and forth leaves your selection exactly as you left it.
   */
  const switchKind = (kind: AuditScopeKind) => {
    if (kind === scopeKind) return;
    setScopeKind(kind);
    setOpenRacm(null);
    if (kind !== 'racm' || picked.length || pickedControls.length) return;

    const fromProcesses = scopedProcesses.map(r => r.process);
    // Only a process that actually has a RACM here can be ticked — one still
    // waiting on its upload has nothing under it yet.
    const live = racms.filter(r => fromProcesses.includes(normaliseProcess(r.name)));
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
  // Materiality & files waits on a trial balance as well as the rule (user ask)
  // — the account mapping and the Scope step's recommendation both read it. The
  // general ledger never holds Continue.
  const canContinue = step === 0 ? periodValid
    : !SCOPING_STEPS ? true
    // Roll-forward inherits the rule read-only, so its materiality half has
    // nothing to answer — the step is only its (optional) files.
    : step === 1 ? (round === 'rollforward' || (hasTb && benchmark > 0 && (basis === 'custom' || pct > 0)))
    // Scoping by RACM means picking controls: a RACM ticked with nothing
    // under it covers nothing, so Continue waits for at least one row.
    // Every company the auditor moved owes a reason before the step will pass
    // (user ask) — the scope is the audit's defence, so it can't leave here
    // with an unexplained change in it. The Processes panel sits over both
    // sides, so its notes and its no-RACM gate hold either way.
    : step === 2 ? (round === 'rollforward'
      // The mandatory full-retest group counts — a roll-forward that carries
      // only failed controls is still a real audit.
      ? rfPicked.length + rfFailed.length > 0
      : procNotesOutstanding === 0 && noRacmInScope.length === 0
        && (scopeKind === 'entity' ? scopedEntities.length > 0 && notesOutstanding === 0 : pickedControls.length > 0))
    : true;

  /** Moved companies and moved processes still owed a note — one count for the
   *  footer, which says what the greyed Continue is waiting for. */
  const notesDue = notesOutstanding + (round !== 'rollforward' ? procNotesOutstanding : 0);

  const create = () => {
    if (!round) return;
    const isRf = round === 'rollforward' && !!parent;
    /** A roll-forward's scope is controls, whichever side the parent was scoped
     *  on — the carried list plus the mandatory full-retest group IS the scope,
     *  stored as hand-picked controlIds so the covers() precedence does the rest. */
    const rfIds = [...rfPicked, ...rfFailed.map(v => v.id)];
    const rfNames = Array.from(new Set(parentVerdicts.filter(v => rfIds.includes(v.id)).map(v => v.process)));
    if (!SCOPING_STEPS) {
      // S11 follow-up: every control in the Control Library, whatever the round —
      // a roll-forward too. createAudit still carries an effective interim design
      // forward and resets the rest; it just carries it across the whole library.
      createAudit({
        period: periodLabel,
        yearBasis,
        fiscalYear: year,
        periodSpan,
        round,
        windowFrom,
        windowTo,
        rolledFromId: isRf ? parent!.id : undefined,
        scopeKind: 'racm',
        scopeNames: libraryByProcess.map(p => p.process),
        scopeIds: [],
        controlIds: eng.controls.map(c => c.id),
        files: engFiles,
        materiality: { basisLabel: engMat.basisLabel, benchmark: engMat.benchmark, pct: engMat.pct, pmPct: engMat.pmPct, ctPct: engMat.ctPct },
        overall: engMat.overall,
        sampling: sampFinal,
      });
      addToast({
        type: 'success',
        title: 'Audit created',
        message: `${periodLabel}${isRf ? ` roll-forward from the ${parent!.period} interim` : ''} — ${eng.controls.length} control${eng.controls.length === 1 ? '' : 's'} across ${libraryByProcess.length} process${libraryByProcess.length === 1 ? '' : 'es'}.`,
      });
      onClose();
      return;
    }
    createAudit({
      period: periodLabel,
      // A real fy/cy again — the 'custom' this used to stamp kept every audit
      // created here off the engagement's coverage timeline, which only groups
      // named cycles (auditsByYear).
      yearBasis,
      fiscalYear: year,
      periodSpan,
      round,
      windowFrom,
      windowTo,
      // A roll-forward records the interim it extends — the parent is a hard
      // requirement, not a breadcrumb: dates and (downstream) materiality and
      // scope all read from it.
      rolledFromId: isRf ? parent!.id : undefined,
      scopeKind: isRf ? 'racm' : scopeKind,
      scopeNames: isRf ? rfNames : pickedNames,
      scopeIds: !isRf && scopeKind === 'entity' ? scopedEntities.map(r => r.id) : [],
      // Only the RACM side picks control by control; scoping by entity lets the
      // entities' processes decide, so it leaves this empty on purpose.
      controlIds: isRf ? rfIds : scopeKind === 'racm' ? pickedControls : [],
      // The overrules travel with the audit — the reason a company is in or out
      // is only worth asking for if it survives past the wizard.
      scopeNotes: !isRf && scopeKind === 'entity' && scopeChanges.length ? scopeChanges : undefined,
      // A34a–c — the mapping the recommendation was built from, and the
      // Processes panel as it stood. A roll-forward answers neither: its scope
      // is its parent's conclusions.
      accountProcesses: isRf ? undefined : Object.fromEntries(materialRows.map(c => [c.id, processOf(c)])),
      processScope: isRf ? undefined : processRows.map(r => {
        const move = procChanges.find(c => c.process === r.process);
        return {
          process: r.process, total: r.total, accounts: r.accounts, recommended: r.recommended,
          inScope: procInScope(r),
          ...(move?.qualitative ? { qualitativeReason: move.reason } : {}),
          ...(move ? { note: move.note } : {}),
        };
      }),
      files: files.map(f => ({ name: f.name, kind: f.kind })),
      // matFinal already resolved the roll-forward question: the parent's rule
      // verbatim, or the step's own inputs.
      materiality: { basisLabel: matFinal.basisLabel, benchmark: matFinal.benchmark, pct: matFinal.pct, pmPct: matFinal.pmPct, ctPct: matFinal.ctPct },
      overall: matFinal.overall,
      sampling: sampFinal,
    }, { freshControlIds: addedControlIds });
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
      message: isRf
        ? `${periodLabel} roll-forward — ${rfPicked.length} control${rfPicked.length === 1 ? '' : 's'} carried forward from the ${parent!.period} interim${rfFailed.length ? `, ${rfFailed.length} failed control${rfFailed.length === 1 ? '' : 's'} in for a full retest` : ''}.`
        : scopeKind === 'entity'
          ? `${periodLabel} — ${scopedEntities.length} entit${scopedEntities.length === 1 ? 'y' : 'ies'} in scope, ${coveragePct}% of the group.`
          : `${periodLabel} — ${pickedControls.length} control${pickedControls.length === 1 ? '' : 's'} across ${picked.length} RACM${picked.length === 1 ? '' : 's'}.`,
    });
    onClose();
  };

  /** Add a control to the RACM the button was pressed on, then tick it straight
   *  into scope — you added it because the audit needs it, so making you find it
   *  in the list and tick it again would be busywork. */
  const createControl = (input: { description: string; isKey: boolean; subProcess: string; attributes: string[] }) => {
    const process = addCtrlRacm;
    if (!process) return;
    const description = input.description.trim();
    const id = addControl({
      description,
      process,
      subProcess: input.subProcess.trim() || 'General',
      // The scope step is not the place to write up a control — these are the
      // fields the RACM tab fills in properly. Sensible defaults, editable there.
      riskId: '', riskDescription: '',
      nature: 'Manual', frequency: 'Monthly',
      owner: me, isKey: input.isKey,
      assertions: [],
    });
    // addControl returns '' on a locked engagement rather than throwing.
    if (!id) {
      addToast({ type: 'error', title: 'Control not added', message: 'This engagement is locked.' });
      return;
    }
    // The attributes typed on the form become the control's design
    // considerations — the SOX equivalent of "what this control has to achieve",
    // and the list its walkthrough is tested against.
    input.attributes.map(a => a.trim()).filter(Boolean).forEach(a => addDesignPoint(id, a));
    // Remembered so creating the audit doesn't reset it and wipe those checks.
    setAddedControlIds(prev => [...prev, id]);
    // A non-key control added while "key controls only" is on would be ticked
    // into scope and then filtered out of sight — selected but invisible, which
    // is exactly what that switch was written to avoid. Turning it off costs
    // nothing: it only ever unlocks the rest, it never drops what's picked.
    if (keyOnly && !input.isKey) setKeyOnly(false);
    setPicked(prev => (prev.includes(process) ? prev : [...prev, process]));
    setPickedControls(prev => [...prev, id]);
    setOpenRacm(process);
    setAddCtrlRacm(null);
    addToast({ type: 'success', title: 'Control added', message: `${description} — added to ${process} and put in scope.` });
  };

  return (
    <>
    {/* With hideClose, FlowModal only calls onClose for Escape. The RACM import
        review decides for itself what Escape means (it won't close on Review),
        so while it is open the sheet under it must not also hear the key and
        throw the whole wizard away. */}
    <FlowModal label="New audit" widthCls="w-full max-w-[560px]" variant="sheet" hideClose onClose={racmUpload ? () => {} : onClose}>
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
          <StepShell title="Audit period" sub="Which year this audit belongs to, which pass of it this is, and the window that pass covers.">
            {/* Year first (user ask): interim, roll-forward and year-end only
                mean anything relative to a financial year, so everything below
                depends on this answer — changing it resets the rest.

                Except a roll-forward (user ask): its year was answered when the
                parent interim was created, and the same year carries through —
                so the basis toggle goes away and the year renders locked, like
                the dates. Re-asking would invite editing a settled answer, and
                changing it here would silently reset the round. */}
            {round === 'rollforward' && parent ? (
              <>
                <label className={labelCls}>Financial year</label>
                <div className="w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-canvas text-ink-600 flex items-center justify-between gap-2">
                  <span>{periodLabel} · {periodSpan}</span>
                  <Lock size={12} className="text-ink-400 shrink-0" />
                </div>
                <p className="text-[11px] text-ink-400 mt-1.5">Set with the interim this roll-forward continues — one year, answered once.</p>
              </>
            ) : (
              <>
                <label className={labelCls}>Year runs</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([['fy', 'Apr – Mar'], ['cy', 'Jan – Dec']] as const).map(([b, label]) => (
                    <button
                      key={b}
                      onClick={() => changeYear(b, b === 'fy' ? currentFyEnd() : currentFyEnd() - 1)}
                      className={cn(
                        'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all cursor-pointer',
                        yearBasis === b
                          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                          : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className={`${labelCls} mt-4`}>Financial year</label>
                <FormSelect
                  value={String(year)}
                  options={yearOptions.map(y => ({ value: String(y), label: `${yearLabelOf(yearBasis, y)}  ·  ${yearSpanOf(yearBasis, y)}` }))}
                  onChange={v => changeYear(yearBasis, Number(v))}
                  className={selectCls}
                  ariaLabel="Financial year"
                />
              </>
            )}

            {/* The round decides what the dates can be, so it is asked before
                they render. Interim + roll-forward, or year-end alone — the two
                legitimate routes to the year end — is what the disabled states
                enforce, and a disabled option always says why. */}
            <label className={`${labelCls} mt-4`}>Round</label>
            <div className="grid grid-cols-3 gap-1.5">
              {AUDIT_ROUNDS.map(r => {
                const gate = roundGate[r.id];
                return (
                  <button
                    key={r.id}
                    onClick={() => pickRound(r.id)}
                    disabled={!!gate}
                    aria-disabled={!!gate || undefined}
                    title={gate ?? undefined}
                    className={cn(
                      'px-2 py-2 rounded-lg border text-[12px] font-bold transition-all',
                      gate
                        ? 'border-canvas-border bg-canvas text-ink-300 cursor-not-allowed'
                        : round === r.id
                          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15 cursor-pointer'
                          : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40 cursor-pointer',
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {round && <p className="text-[11px] text-ink-400 mt-1.5">{AUDIT_ROUNDS.find(r => r.id === round)!.hint}</p>}
            {AUDIT_ROUNDS.filter(r => roundGate[r.id]).map(r => (
              <p key={r.id} className="text-[11px] text-ink-400 mt-1.5 flex items-start gap-1.5">
                <Lock size={11} className="shrink-0 mt-[1px]" />
                <span><span className="font-semibold text-ink-500">{r.label}</span> — {roundGate[r.id]}</span>
              </p>
            ))}

            {/* Roll-forward's parent — the concluded interim it extends. Sits
                between the round and the dates because the dates derive from it. */}
            {round === 'rollforward' && (
              <>
                <label className={`${labelCls} mt-4`}>Continues from</label>
                <FormSelect
                  value={parentId ?? ''}
                  options={concludedInterims.map(a => ({
                    value: a.id,
                    label: `${a.period} interim  ·  ${fmtDate(a.windowFrom)} – ${fmtDate(a.windowTo)}`,
                  }))}
                  onChange={changeParent}
                  className={selectCls}
                  ariaLabel="Parent interim audit"
                />
                <p className="text-[11px] text-ink-400 mt-1.5">
                  The interim whose evidence this roll-forward extends to the year end.
                </p>
              </>
            )}

            {/* Dates render only once the round is chosen — what they can hold
                depends on it. Interim: From editable, To is the auditor's
                cut-off, capped a day short of the year end (a cut-off ON it is a
                year-end audit wearing the wrong name). Roll-forward: both
                derived, neither editable — a gap or overlap against the parent
                is a coverage hole nothing downstream would catch. Year-end: runs
                to the year end, because that is the date the opinion speaks to. */}
            {round && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className={labelCls}>From</label>
                  {round === 'rollforward' ? (
                    <div className="w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-canvas text-ink-600 flex items-center justify-between gap-2">
                      <span>{windowFrom ? fmtDate(windowFrom) : '—'}</span>
                      <Lock size={12} className="text-ink-400 shrink-0" />
                    </div>
                  ) : (
                    <CustomDatePicker
                      value={fromDate}
                      onChange={setFromDate}
                      minDate={yearStart}
                      maxDate={round === 'interim' ? (cutoff || shiftDay(yearEnd, -1)) : yearEnd}
                    />
                  )}
                </div>
                <div>
                  <label className={labelCls}>{round === 'interim' ? 'To — interim cut-off' : 'To'}</label>
                  {round === 'interim' ? (
                    <CustomDatePicker
                      value={cutoff}
                      onChange={setCutoff}
                      minDate={fromDate || yearStart}
                      maxDate={shiftDay(yearEnd, -1)}
                    />
                  ) : (
                    <div className="w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-canvas text-ink-600 flex items-center justify-between gap-2">
                      <span>{fmtDate(yearEnd)}</span>
                      <Lock size={12} className="text-ink-400 shrink-0" />
                    </div>
                  )}
                </div>
              </div>
            )}
            {round === 'rollforward' && parent && (
              <p className="text-[11px] text-ink-400 mt-1.5">
                Starts the day after the {parent.period} interim's cut-off and runs to the year end — derived, so the two windows can't gap or overlap.
              </p>
            )}

            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
              <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                {!round
                  ? <>Pick which pass of <span className="font-semibold text-ink-900">{periodLabel}</span> this audit is — the dates follow from it.</>
                  : periodValid
                    ? <>This <span className="font-semibold text-ink-900">{AUDIT_ROUNDS.find(r => r.id === round)!.label.toLowerCase()}</span> audit covers{' '}
                      <span className="font-semibold text-ink-900">{fmtDate(windowFrom)} – {fmtDate(windowTo)}</span> of {periodLabel}.</>
                    : round === 'interim'
                      ? 'Pick the cut-off — the date interim testing stops. Everything after it is what a roll-forward or year-end will cover.'
                      : 'Pick the concluded interim this roll-forward continues from.'}
              </p>
            </div>

            {/* Sampling methodology (A28) — after the dates, once the round is
                known, because a roll-forward doesn't get to answer it. Agreed
                here for every control in the audit: each control's Sample step
                reads it and asks only how many items. A roll-forward still
                waiting on its parent has no answer to show yet. */}
            {round && (round !== 'rollforward' || parent) && (
              <div className="mt-6 pt-5 border-t border-canvas-border">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-[0.8125rem] font-semibold text-ink-900">Sampling methodology</h4>
                  {round === 'rollforward' && parent && (
                    <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">
                      <Lock size={10} /> Inherited
                    </span>
                  )}
                </div>
                <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
                  How every control in this audit picks its samples. Each control then sets only how many items.
                </p>
                {round === 'rollforward' && parent ? (
                  /* Read-only, like the year above: the interim answered it, and
                     one year is sampled one way. */
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Selection</label>
                        <div className="w-full px-3 py-2 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas text-ink-600 flex items-center justify-between gap-2">
                          <span>{sampFinal.method}</span>
                          <Lock size={12} className="text-ink-400 shrink-0" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Spread by</label>
                        <div className="w-full px-3 py-2 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas text-ink-600 flex items-center justify-between gap-2">
                          <span className="truncate">
                            {sampFinal.spread.length
                              ? AUDIT_SAMPLE_SPREADS.filter(x => sampFinal.spread.includes(x.id)).map(x => x.label).join(', ')
                              : 'Not spread'}
                          </span>
                          <Lock size={12} className="text-ink-400 shrink-0" />
                        </div>
                      </div>
                    </div>
                    <p className="text-[0.6875rem] text-ink-400 mt-1.5">From the {parent.period} interim — can't be changed here.</p>
                  </>
                ) : (
                  <>
                    <label className={labelCls}>Selection</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {AUDIT_SAMPLE_METHODS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setSampMethod(m.id)}
                          aria-pressed={sampMethod === m.id}
                          className={cn(
                            'px-2 py-2 rounded-lg border text-[0.75rem] font-bold transition-all cursor-pointer',
                            sampMethod === m.id
                              ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                              : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                          )}
                        >
                          {m.id}
                        </button>
                      ))}
                    </div>
                    <p className="text-[0.6875rem] text-ink-400 mt-1.5">{AUDIT_SAMPLE_METHODS.find(m => m.id === sampMethod)!.hint}</p>

                    {/* Any, all or none — each one ticked gets items of its own
                        in every control's draw. */}
                    <label className={`${labelCls} mt-4`}>Spread by</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {AUDIT_SAMPLE_SPREADS.map(x => {
                        const on = sampSpread.includes(x.id);
                        return (
                          <button
                            key={x.id}
                            onClick={() => toggleSpread(x.id)}
                            aria-pressed={on}
                            className={cn(
                              'px-2 py-2 rounded-lg border text-[0.75rem] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5',
                              on
                                ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                                : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40',
                            )}
                          >
                            {on && <Check size={12} className="shrink-0" />}{x.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[0.6875rem] text-ink-400 mt-1.5">
                      {sampSpread.length
                        ? `Every control's draw is split across ${AUDIT_SAMPLE_SPREADS.filter(x => sampSpread.includes(x.id)).map(x => x.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}, with at least one item in each.`
                        : 'Not spread — items fall wherever the selection puts them. Pick any that every draw has to reach.'}
                    </p>
                  </>
                )}
              </div>
            )}
          </StepShell>
        )}

        {/* No StepShell here (user ask): the step title and strapline were removed.
            The rail above already names the step, and each half carries its own
            heading, so a third layer of titling was just noise. */}
        {SCOPING_STEPS && step === 1 && (
          <div>
            {/* Files lead (user ask): the trial balance is what the threshold
                below gets applied TO, so it is loaded first. Required now for
                everything but a roll-forward (user ask) — its material accounts
                are mapped below and decide the processes in scope. The general
                ledger stays optional throughout. */}
            <div className="flex items-baseline gap-2 mb-0.5">
              <h4 className="text-[13px] font-semibold text-ink-900">Trial balance &amp; general ledger</h4>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {round === 'rollforward' ? 'Optional' : 'Trial balance required'}
              </span>
            </div>
            <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
              {round === 'rollforward'
                ? 'Attach them if this audit needs them — you can add them later instead.'
                : 'Upload the trial balance to continue — its material accounts decide which processes this audit covers. The general ledger can be added later.'}
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

            {/* Roll-forward inherits the parent's rule, read-only (user ask):
                an interim and its roll-forward are two halves of one year, and
                two materiality figures for one year would grade the same
                deficiency two different ways. Display only — nothing here can
                be edited, and the create() payload reads matFinal, not inputs. */}
            {round === 'rollforward' && parent ? (
              <div className="mt-6 pt-5 border-t border-canvas-border">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-[13px] font-semibold text-ink-900">Materiality rule</h4>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    <Lock size={10} /> Inherited
                  </span>
                </div>
                <p className="text-[0.75rem] text-ink-500 mb-4 leading-relaxed">
                  Carried from the {parent.period} interim and not editable here — an interim and its
                  roll-forward are two halves of one year, and two figures would grade the same
                  deficiency two different ways.
                </p>
                <div className="rounded-xl border border-canvas-border bg-white p-3.5">
                  {([
                    ['Overall materiality', money(matFinal.overall), matFinal.basisLabel, true],
                    ['Performance materiality', money(matPerf), `${matFinal.pmPct}% of overall — the working threshold for testing`, false],
                    ['Clearly trivial', money(matTrivial), `${matFinal.ctPct}% of overall — below this, differences are passed`, false],
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
              </div>
            ) : (
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
            )}

            {/* ── Map material accounts to processes (A34a) ──────────────────
                After the rule, because it reads it: only accounts at or above
                performance materiality are listed, so the list redraws as the
                rule above changes. Appears once a trial balance is attached.
                Not on a roll-forward — its scope isn't built from processes. */}
            {round !== 'rollforward' && hasTb && (
              <div className="mt-6 pt-5 border-t border-canvas-border">
                <h4 className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5">
                  Map material accounts to processes
                  <span className="font-normal text-ink-500"> · {materialRows.length} account{materialRows.length === 1 ? '' : 's'} ≥ {money(perf)} (PM)</span>
                </h4>
                <p className="text-[0.75rem] text-ink-500 mb-3 leading-relaxed">
                  Ira suggested a process for each account — change any that landed on the wrong one.
                </p>
                {materialRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-canvas-border bg-white text-[0.71875rem] text-ink-400 px-4 py-5 text-center">
                    No account in the trial balance reaches {money(perf)} — nothing to map at this threshold.
                  </p>
                ) : (
                  /* No overflow-hidden: the process menus open downward out of
                     the last rows, and clipping them would hide the options. */
                  <div className="rounded-xl border border-canvas-border bg-white">
                    <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,1.45fr)] gap-2.5 px-3.5 py-2 border-b border-canvas-border text-[0.625rem] font-bold text-ink-400 uppercase tracking-wider">
                      <span>Account</span><span>Entity</span><span className="text-right">Balance</span><span>Process</span>
                    </div>
                    {materialRows.map(c => (
                      <div key={c.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.75fr)_minmax(0,1.45fr)] gap-2.5 items-center px-3.5 py-2 border-b border-canvas-border last:border-b-0">
                        <span className="text-[0.75rem] text-ink-900 truncate" title={c.caption}>{c.caption}</span>
                        <span className="text-[0.71875rem] text-ink-500 truncate">{entityShort(c.entityId, entities)}</span>
                        <span className="text-[0.75rem] text-ink-800 tabular-nums text-right">{money(c.balance)}</span>
                        <FormSelect
                          value={processOf(c)}
                          options={mappingOptions}
                          onChange={v => setAccountMap(prev => ({ ...prev, [c.id]: v }))}
                          className="w-full h-8 px-2.5 text-[0.75rem] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 transition-all"
                          ariaLabel={`Process for ${c.caption}`}
                          align="right"
                          menuCls="w-[220px]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Roll-forward scope: the parent decides ─────────────────────────
            No entity/RACM choice here (user ask) — a roll-forward can only
            carry controls the parent interim tested and concluded effective.
            The list is narrowable, never widenable: what failed or went
            untested is shown excluded, each with its reason. */}
        {SCOPING_STEPS && step === 2 && round === 'rollforward' && parent && (
          <StepShell title="What this audit covers" sub={`What the ${parent.period} interim proved carries forward, and what it failed comes along for a full retest — with its open findings.`}>
            <p className="mb-2 px-1 text-[11px] text-ink-500">
              <span className="font-semibold text-ink-900 tabular-nums">{rfPicked.length}</span> of {rfEffective.length} effective control{rfEffective.length === 1 ? '' : 's'} carried forward
              {rfFailed.length > 0 && <> · <span className="font-semibold text-ink-900 tabular-nums">{rfFailed.length}</span> failed — full retest</>}
            </p>
            <div className="border border-canvas-border rounded-xl overflow-hidden">
              {rfEffective.length === 0 ? (
                <p className="text-[11.5px] text-ink-400 px-4 py-6 text-center">
                  The {parent.period} interim concluded nothing effective{rfFailed.length ? ' — only the failed controls below come along, for a full retest' : ' — there is nothing to roll forward'}.
                </p>
              ) : rfEffective.map(v => {
                const on = rfPicked.includes(v.id);
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleRf(v.id)}
                    className="w-full flex items-start gap-3 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0 bg-white hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
                  >
                    <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                      on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white')}>
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12.5px] text-ink-900 truncate">
                        <span className="font-semibold">{v.wpRef}</span> · {v.description}
                      </span>
                      {/* No sample-size promise here (user ask) — how big the
                          draw is stays the auditor's call on the control page. */}
                      <span className="block text-[11px] text-ink-400 mt-0.5">{v.process} · Effective at interim — design carries, operating retested to year end</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Failed at interim: mandatory, no checkbox (user ask) ────────
                "Wo saara jaaye" — a control the interim failed cannot be left
                out of the roll-forward, because dropping an open finding from
                scope is the one move a wizard must not allow. Each row says
                what its retest is: TOD is retested only where TOD failed; a
                TOE-only failure keeps its carried design and re-tests the
                operating side in full. Open findings ride along. */}
            {rfFailed.length > 0 && (
              <>
                <h5 className="text-[12px] font-semibold text-ink-900 mt-4 mb-0.5">Full retest — failed at interim</h5>
                <p className="text-[11px] text-ink-500 mb-2 leading-relaxed">
                  Always in scope — a failed control and its open findings can't be left behind by the
                  round that exists to close the year.
                </p>
                <div className="border border-canvas-border rounded-xl overflow-hidden">
                  {rfFailed.map(v => {
                    const defs = openDefCount(v.id);
                    return (
                      <div key={v.id} className="flex items-start gap-3 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0 bg-white">
                        <Lock size={13} className="text-ink-400 shrink-0 mt-0.5" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12.5px] text-ink-900 truncate">
                            <span className="font-semibold">{v.wpRef}</span> · {v.description}
                          </span>
                          <span className="block text-[11px] text-ink-400 mt-0.5">
                            {v.process} · {v.design === 'Effective'
                              ? 'TOD carried — operating retested in full'
                              : 'TOD failed at interim — design retested too'}
                            {defs > 0 && <> · <span className="font-semibold text-high-700">{defs} open finding{defs === 1 ? '' : 's'} carr{defs === 1 ? 'ies' : 'y'} with it</span></>}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {rfExcluded.length > 0 && (
              <>
                <h5 className="text-[12px] font-semibold text-ink-900 mt-4 mb-0.5">Not carried forward</h5>
                <p className="text-[11px] text-ink-500 mb-2 leading-relaxed">
                  Not tested at interim — a roll-forward has nothing of theirs to extend. These wait for
                  the year-end audit.
                </p>
                <div className="border border-canvas-border rounded-xl overflow-hidden">
                  {rfExcluded.map(v => (
                    <div key={v.id} className="flex items-start gap-3 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0 bg-white opacity-50">
                      <X size={14} className="text-ink-400 shrink-0 mt-0.5" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12.5px] text-ink-900 truncate">
                          <span className="font-semibold">{v.wpRef}</span> · {v.description}
                        </span>
                        <span className="block text-[11px] text-ink-400 mt-0.5">
                          {v.process} · Not tested at interim — belongs in a year-end audit
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </StepShell>
        )}

        {SCOPING_STEPS && step === 2 && !(round === 'rollforward' && parent) && (
          <StepShell title="What this audit covers" sub="Scope by entity or by RACM — one or the other, then pick as many as the audit covers.">
            {/* ── Processes (A34b / A34c) ─────────────────────────────────────
                Above the entity / RACM choice, because it holds for both: Ira's
                recommendation from the accounts mapped on the previous step,
                overruled row by row with a note — the companies' interaction,
                one level down. Bringing a process in against Ira is a
                qualitative pick and takes a reason from the list too. An
                in-scope process with no RACM can't be tested, so the row offers
                the RACM tab's import right there, and Continue waits on it. */}
            <div className="mb-5">
              <h4 className="text-[0.8125rem] font-semibold text-ink-900 mb-0.5 flex items-center gap-1.5">
                <Sparkles size={13} className="text-brand-600 shrink-0" />
                <span>
                  Ira recommends {recommendedCount} process{recommendedCount === 1 ? '' : 'es'}
                  <span className="font-normal text-ink-500"> — from the material accounts you mapped</span>
                </span>
              </h4>
              <p className="text-[0.75rem] text-ink-500 mb-2 leading-relaxed">
                Move any process against the recommendation and say why.
              </p>
              <div className="border border-canvas-border rounded-xl overflow-hidden">
                {processRows.length === 0 ? (
                  <p className="text-[0.71875rem] text-ink-400 px-4 py-6 text-center">
                    No material accounts mapped and no RACMs on this engagement yet.
                  </p>
                ) : processRows.map(r => {
                  const on = procInScope(r);
                  const racm = racmFor(r.process);
                  const move = procOverrides[r.process];
                  const qualitative = move === true;
                  const editing = procNoteDrafts[r.process] !== undefined;
                  const reasonDraft = procReasonDrafts[r.process] ?? '';
                  return (
                    <div key={r.process} className="bg-white border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 transition-colors">
                      <div className="flex items-start gap-3 px-4 py-2.5">
                        <Grid3x3 size={14} className="text-ink-400 shrink-0 mt-0.5" />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-[0.8125rem] text-ink-900 truncate">{r.process}</span>
                            {qualitative && (
                              <span className="shrink-0 px-1.5 rounded border border-brand-200 bg-brand-50 text-[0.625rem] font-semibold text-brand-700 leading-4">Qualitative</span>
                            )}
                          </span>
                          <span className="block text-[0.65625rem] text-ink-500 mt-0.5 leading-relaxed tabular-nums">
                            {r.accounts > 0
                              ? `${money(r.total)} · ${r.accounts} material account${r.accounts === 1 ? '' : 's'}`
                              : 'No material accounts'}
                          </span>
                          {/* Can it be tested — asked only of a process that is
                              in, because that is the only time it matters. */}
                          {on && (racm ? (
                            <span className="flex items-center gap-1 mt-1 text-[0.65625rem] font-semibold text-compliant-700">
                              <Check size={11} className="shrink-0" /> {r.process} · {racm.count} control{racm.count === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span className="block mt-1">
                              <span className="flex items-center gap-1 text-[0.65625rem] font-semibold text-risk-700">
                                <X size={11} className="shrink-0" /> No RACM — can't be tested.
                              </span>
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                                <button
                                  onClick={() => uploadRacm(r.process)}
                                  disabled={!canUploadRacm}
                                  title={canUploadRacm ? `Upload the ${r.process} RACM` : 'Only an auditor can upload a RACM, and not on a locked engagement'}
                                  className="h-7 px-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.71875rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                  <Upload size={12} /> Upload RACM
                                </button>
                                <span className="text-[0.65625rem] text-ink-500">or move it out with a note</span>
                              </span>
                            </span>
                          ))}
                        </span>
                        <span className={cn('shrink-0 mt-1 text-[0.6875rem] font-semibold', on ? 'text-ink-700' : 'text-ink-400')}>
                          {on ? 'In scope' : 'Out'}
                        </span>
                        <button
                          role="switch"
                          aria-checked={on}
                          aria-label={`${on ? 'Take' : 'Bring'} ${r.process} ${on ? 'out of' : 'into'} scope`}
                          onClick={() => flipProcess(r)}
                          className="shrink-0 mt-1 cursor-pointer"
                        >
                          <span className={cn('block w-8 h-[18px] rounded-full relative transition-colors', on ? 'bg-brand-600' : 'bg-canvas-border')}>
                            <span className={cn('absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
                          </span>
                        </button>
                      </div>

                      {/* ── Why ── same box, same tint and same Save / Edit /
                          Cancel as a moved company. A qualitative pick asks for
                          its reason from the list first, then the note. */}
                      <AnimatePresence initial={false}>
                        {move !== undefined && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="mx-4 mb-3 p-3 rounded-xl border border-high-200 bg-high-50/40">
                              <span className="text-[0.6875rem] font-semibold text-high-700 mb-1.5 flex items-center gap-1.5">
                                <Pencil size={11} className="shrink-0" />
                                {on ? 'Why is this process in scope?' : 'Why is this process out of scope?'}
                              </span>
                              {editing ? (
                                <>
                                  {qualitative && (
                                    <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label={`Reason ${r.process} is in scope`}>
                                      {QUAL_REASONS.map(q => (
                                        <button
                                          key={q}
                                          onClick={() => setProcReasonDrafts(prev => ({ ...prev, [r.process]: q }))}
                                          aria-pressed={reasonDraft === q}
                                          className={cn('h-7 px-2 rounded-md border text-[0.6875rem] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1',
                                            reasonDraft === q ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border bg-white text-ink-600 hover:border-ink-300')}
                                        >
                                          {reasonDraft === q && <Check size={11} className="shrink-0" />}{q}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <textarea
                                    aria-label={on ? `Why ${r.process} is in scope` : `Why ${r.process} is out of scope`}
                                    autoFocus
                                    rows={2}
                                    value={procNoteDrafts[r.process] ?? ''}
                                    onChange={e => setProcNoteDrafts(prev => ({ ...prev, [r.process]: e.target.value }))}
                                    placeholder="Record your rationale — retained in the working paper."
                                    className="w-full text-[0.75rem] rounded-lg border border-canvas-border bg-white px-2.5 py-2 text-ink-800 placeholder:text-ink-400 outline-none focus:border-high-300 focus:ring-2 focus:ring-high-200/60 resize-none transition-all"
                                  />
                                  <div className="flex items-center justify-end gap-2 mt-2">
                                    <button
                                      onClick={() => cancelProcNote(r.process)}
                                      className="h-7 px-2.5 text-[0.71875rem] font-semibold text-ink-500 hover:text-ink-800 transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => saveProcNote(r.process)}
                                      disabled={!(procNoteDrafts[r.process] ?? '').trim() || (qualitative && !reasonDraft)}
                                      className="h-7 px-3 text-[0.71875rem] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 transition-colors cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[0.75rem] text-ink-700 leading-relaxed min-w-0 whitespace-pre-wrap">
                                    {qualitative && procReasons[r.process] && <span className="font-semibold text-ink-900">{procReasons[r.process]} — </span>}
                                    {procNotes[r.process]}
                                  </p>
                                  <button
                                    onClick={() => {
                                      setProcNoteDrafts(prev => ({ ...prev, [r.process]: procNotes[r.process] ?? '' }));
                                      if (qualitative) setProcReasonDrafts(prev => ({ ...prev, [r.process]: procReasons[r.process] ?? '' }));
                                    }}
                                    className="shrink-0 h-6 px-2 text-[0.71875rem] font-semibold text-high-700 hover:bg-high-100/60 rounded-md transition-colors cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

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
                {/* Same phantom-token fix as the entity rows' switch below. */}
                <span className={cn('w-8 h-[18px] rounded-full relative shrink-0 transition-colors', keyOnly ? 'bg-brand-600' : 'bg-canvas-border')}>
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

            {/* The star on each row is an 11px glyph that both STATES the key
                judgement and SETS it. Unlabelled it is decoration, so it is
                named once here rather than left to be discovered by hovering
                the right pixel. Sits directly above the list it explains. */}
            {scopeKind === 'racm' && (
              <p className="mb-2 px-1 flex items-center gap-1.5 text-[11px] text-ink-500">
                <Star size={11} className="text-mitigated-600 fill-mitigated-200 shrink-0" />
                Key control
                <span className="text-ink-300">·</span>
                <Star size={11} className="text-ink-300 shrink-0" />
                Non-key — click a star to change it
              </p>
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

            {scopeKind === 'entity' && splitFromParent.length > 0 && (
              <p className="flex items-start gap-1.5 mb-2 text-[11px] text-high-700">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span>
                  {splitFromParent.length} compan{splitFromParent.length === 1 ? 'y is' : 'ies are'} held by a
                  company that IS in scope, but left out{': '}
                  <b className="font-semibold">{splitFromParent.map(r => r.name).join(', ')}</b>.
                </span>
              </p>
            )}

            <div className="border border-canvas-border rounded-xl overflow-hidden">
              {scopeKind === 'entity' ? (
                scope.rows.length === 0 ? (
                  <p className="text-[11.5px] text-ink-400 px-4 py-6 text-center">No entities on this engagement yet.</p>
                ) : scope.rows.map(row => {
                  const on = inScope(row);
                  const absent = row.status === 'absent';
                  const depth = chainDepth(row, scope.rows);
                  /* Moved off what the trial balance derived — so this row owes
                     a reason, and the box below it is open until it gets one. */
                  const changed = !absent && overrides[row.id] !== undefined;
                  /** Box open for typing, as opposed to showing a saved reason. */
                  const editing = noteDrafts[row.id] !== undefined;
                  return (
                    /* One white surface throughout (user ask). An excluded row
                       carries the design system's disabled treatment instead of
                       a tinted band — DESIGN.md §Disabled: opacity-50. */
                    <div
                      key={row.id}
                      className={cn(
                        'bg-white border-b border-canvas-border last:border-b-0 transition-colors',
                        absent ? 'opacity-50' : 'hover:bg-brand-50/40',
                      )}
                    >
                    <div className="flex items-start gap-3 px-4 py-2.5">
                      {/* Indent carries the group's shape, and ONLY the name
                          moves: the toggle stays in its own column so the
                          switches read as one straight line down the list
                          (user ask). A row you can flip should not wander left
                          and right depending on how deep it sits. */}
                      {depth > 0 && <span aria-hidden className="shrink-0" style={{ width: depth * 12 }} />}
                      {depth >= 2 && (
                        <span aria-hidden className="text-[11px] text-ink-300 leading-none shrink-0 mt-1 -mr-1.5">↳</span>
                      )}
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
                          onClick={() => flipEntity(row)}
                          className="shrink-0 mt-1 cursor-pointer"
                        >
                          {/* Off is bg-canvas-border, per DESIGN.md's form-control
                              line. It used to be bg-ink-200 — a token that has
                              never existed (the ink ramp starts at 300), so the
                              utility was never generated and the off track came
                              out fully transparent: a white knob on a white row. */}
                          <span className={cn('block w-8 h-[18px] rounded-full relative transition-colors', on ? 'bg-brand-600' : 'bg-canvas-border')}>
                            <span className={cn('absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all', on ? 'left-[16px]' : 'left-[2px]')} />
                          </span>
                        </button>
                      )}
                    </div>

                    {/* ── Why ─────────────────────────────────────────────────
                        Opens under any company the auditor moved, in either
                        direction (user ask), and Continue waits on it. The
                        override tint is the house one for a judgement that
                        argues with the evidence — same treatment the control
                        dossier uses when a conclusion is overridden. */}
                    <AnimatePresence initial={false}>
                      {changed && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-4 mb-3 p-3 rounded-xl border border-high-200 bg-high-50/40">
                            <span className="text-[11px] font-semibold text-high-700 mb-1.5 flex items-center gap-1.5">
                              <Pencil size={11} className="shrink-0" />
                              {on ? 'Why is this company in scope?' : 'Why is this company out of scope?'}
                            </span>
                            {editing ? (
                              <>
                                <textarea
                                  id={`scope-why-${row.id}`}
                                  aria-label={on ? `Why ${row.name} is in scope` : `Why ${row.name} is out of scope`}
                                  autoFocus
                                  rows={2}
                                  value={noteDrafts[row.id] ?? ''}
                                  onChange={e => setNoteDrafts(prev => ({ ...prev, [row.id]: e.target.value }))}
                                  placeholder="Record your rationale — retained in the working paper."
                                  className="w-full text-[12px] rounded-lg border border-canvas-border bg-white px-2.5 py-2 text-ink-800 placeholder:text-ink-400 outline-none focus:border-high-300 focus:ring-2 focus:ring-high-200/60 resize-none transition-all"
                                />
                                <div className="flex items-center justify-end gap-2 mt-2">
                                  <button
                                    onClick={() => cancelNote(row)}
                                    className="h-7 px-2.5 text-[11.5px] font-semibold text-ink-500 hover:text-ink-800 transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => saveNote(row.id)}
                                    disabled={!(noteDrafts[row.id] ?? '').trim()}
                                    className="h-7 px-3 text-[11.5px] font-semibold rounded-lg bg-high-600 text-white disabled:opacity-40 enabled:hover:bg-high-700 transition-colors cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </>
                            ) : (
                              /* Saved — the reason reads back as text, so a list
                                 of moved companies stays scannable instead of
                                 being a column of open textareas. */
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[12px] text-ink-700 leading-relaxed min-w-0 whitespace-pre-wrap">{scopeNotes[row.id]}</p>
                                <button
                                  onClick={() => setNoteDrafts(prev => ({ ...prev, [row.id]: scopeNotes[row.id] ?? '' }))}
                                  className="shrink-0 h-6 px-2 text-[11.5px] font-semibold text-high-700 hover:bg-high-100/60 rounded-md transition-colors cursor-pointer"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                      </button>
                      {/* On the RACM row beside the chevron (user ask), so a
                          missing control can be added without opening the matrix
                          first. Its own button rather than part of the row's:
                          nesting a button inside a button isn't valid, and this
                          one must not expand the RACM. */}
                      <button
                        onClick={() => setAddCtrlRacm(o.id)}
                        title={`Add a control to ${o.primary}`}
                        aria-label={`Add a control to ${o.primary}`}
                        className="shrink-0 inline-flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-md text-[11px] font-semibold text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer"
                      >
                        <Plus size={12} className="shrink-0" /> Control
                      </button>
                      <button
                        onClick={() => setOpenRacm(expanded ? null : o.id)}
                        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${o.primary}`}
                        aria-expanded={expanded}
                        className="shrink-0 cursor-pointer"
                      >
                        <ChevronDown size={14} className={cn('text-ink-400 transition-transform', expanded && 'rotate-180')} />
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
                          const settable = role === 'auditor';
                          return (
                            // A div, not a button: the star inside it is one, and a
                            // button inside a button is invalid. Same
                            // role/tabIndex/onKeyDown pattern the registers use.
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={0}
                              aria-pressed={ticked}
                              // Named explicitly. Without it the row's name is
                              // computed from its contents — which now starts
                              // with the star button's own label, so the row
                              // and the star announced as near-identical
                              // controls and matched the same query.
                              aria-label={`${c.id} — ${c.description}`}
                              onClick={() => toggleControl(o.id, c.id)}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleControl(o.id, c.id); } }}
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
                                  {/* The star states the judgement AND sets it. It
                                      shows on every row now, hollow when non-key —
                                      an empty space is not something you can click,
                                      and marking a control key is the whole point. */}
                                  {settable ? (
                                    <button
                                      onClick={e => { e.stopPropagation(); toggleKey(c); }}
                                      title={`${c.id} is ${c.isKey ? 'a key control' : 'non-key'} — click to mark it ${c.isKey ? 'non-key' : 'key'}`}
                                      aria-label={`${c.id} is ${c.isKey ? 'a key control' : 'non-key'}. Mark it ${c.isKey ? 'non-key' : 'key'}`}
                                      className="shrink-0 w-[18px] h-[18px] -ml-[3px] inline-flex items-center justify-center rounded cursor-pointer transition-colors hover:bg-mitigated-100"
                                    >
                                      <Star size={11} className={c.isKey ? 'text-mitigated-600 fill-mitigated-200' : 'text-ink-300'} />
                                    </button>
                                  ) : c.isKey && <Star size={11} className="text-mitigated-600 fill-mitigated-200 shrink-0" />}
                                  <span className="text-[12px] text-ink-800 truncate">{c.description}</span>
                                </span>
                                {/* The company, not just the id's @suffix. A
                                    control runs at several of them and the rows
                                    are otherwise word-for-word identical — five
                                    controls across two companies read as five
                                    duplicated pairs without this. */}
                                <span className="flex items-center gap-1.5 mt-0.5 min-w-0 text-[10.5px] text-ink-400">
                                  <span className="font-mono shrink-0">{c.id} · {c.subProcess}</span>
                                  {c.entity && (
                                    <span className="inline-flex items-center gap-1 min-w-0" title={c.entity}>
                                      <span className="text-ink-300">·</span>
                                      <Building2 size={10} className="shrink-0 text-ink-300" />
                                      <span className="truncate">{c.entity}</span>
                                    </span>
                                  )}
                                </span>
                              </span>
                            </div>
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
          <StepShell title="Review" sub="Check it over — creating the audit adds it to this engagement's SOX testing tab.">
            <div className="rounded-xl border border-canvas-border bg-white p-4">
              {/* Same order the steps ran in — Period, then materiality and its
                  files, then what they scoped. */}
              <ReviewRow label="Financial year" value={<>{periodLabel} <span className="font-normal text-ink-400">· {periodSpan}</span></>} />
              <ReviewRow label="Round" value={AUDIT_ROUNDS.find(r => r.id === round)?.label ?? '—'} />
              {round === 'rollforward' && parent && (
                <ReviewRow label="Continues from" value={`${parent.period} interim`} />
              )}
              <ReviewRow label="Window" value={windowFrom && windowTo ? `${fmtDate(windowFrom)} – ${fmtDate(windowTo)}` : '—'} />
              <ReviewRow label="Sampling" value={<>{sampFinal.method} <span className="font-normal text-ink-400">· {spreadPhrase(sampFinal.spread)}{round === 'rollforward' ? ' · from parent' : ''}</span></>} />
              {/* S11 follow-up — what the engagement already settled, read-only:
                  the rule and files set when it was created, and the whole
                  Control Library as the scope. */}
              {!SCOPING_STEPS && (
                <>
                  <ReviewRow label="Materiality" value={<>{money(engMat.overall)} <span className="font-normal text-ink-400">· {engMat.basisLabel}</span></>} />
                  <ReviewRow label="Performance materiality" value={<>{money(engMat.overall * engMat.pmPct / 100)} <span className="font-normal text-ink-400">· {engMat.pmPct}% of overall</span></>} />
                  <ReviewRow label="Clearly trivial" value={<>{money(engMat.overall * engMat.ctPct / 100)} <span className="font-normal text-ink-400">· {engMat.ctPct}% of overall</span></>} />
                  <ReviewRow label="TB / GL" value={engFiles.length === 0 ? <span className="font-normal text-ink-400">None on the engagement</span> : engFiles.map(f => f.name).join(', ')} />
                  <p className="text-[0.6875rem] text-ink-400 -mt-1 mb-2">Materiality and the trial balance were set when the engagement was created.</p>
                  <ReviewRow
                    label="Controls"
                    value={<>
                      {eng.controls.length} <span className="font-normal text-ink-400">· every control in the Control Library</span>
                      <span className="block space-y-0.5 mt-1">
                        {libraryByProcess.map(p => (
                          <span key={p.process} className="block text-[0.6875rem] font-normal text-ink-500">{p.process} · {p.count}</span>
                        ))}
                      </span>
                    </>}
                  />
                </>
              )}
              {SCOPING_STEPS && <>
              {/* matFinal, not the step's inputs — a roll-forward reviews the
                  rule it will actually be created with: its parent's. */}
              <ReviewRow label="Materiality" value={<>₹{matFinal.overall} Cr <span className="font-normal text-ink-400">· {matFinal.basisLabel}{round === 'rollforward' ? ' · from parent' : ''}</span></>} />
              <ReviewRow label="Performance materiality" value={<>{money(matPerf)} <span className="font-normal text-ink-400">· {matFinal.pmPct}% of overall</span></>} />
              <ReviewRow label="Clearly trivial" value={<>{money(matTrivial)} <span className="font-normal text-ink-400">· {matFinal.ctPct}% of overall</span></>} />
              <ReviewRow
                label="TB / GL"
                value={files.length === 0 ? <span className="font-normal text-ink-400">Not attached</span> : files.map(f => f.name).join(', ')}
              />
              {/* A34a–c — the mapping, then the processes it led to: which are
                  in on Ira's word, which on the auditor's (with the reason),
                  and which were taken out and why. Same order the steps ran. */}
              {round !== 'rollforward' && (
                <>
                  <ReviewRow
                    label="Account mapping"
                    value={<>{materialRows.length} material account{materialRows.length === 1 ? '' : 's'} mapped <span className="font-normal text-ink-400">· ≥ {money(perf)}</span></>}
                  />
                  <ReviewRow
                    label="Processes in scope"
                    value={scopedProcesses.length === 0 ? <span className="font-normal text-ink-400">None</span> : (
                      <span className="block space-y-1.5">
                        {scopedProcesses.map(r => {
                          const move = procChanges.find(c => c.process === r.process);
                          return (
                            <span key={r.process} className="block">
                              {r.process}
                              <span className="font-normal text-ink-400"> · {move?.qualitative ? 'qualitative' : 'recommended'}</span>
                              {move?.qualitative && (
                                <span className="block text-[0.6875rem] font-normal text-ink-500 leading-relaxed">{move.reason} — {move.note}</span>
                              )}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  />
                  {procChanges.some(c => !c.inScope) && (
                    <ReviewRow
                      label="Processes moved out"
                      value={(
                        <span className="block space-y-1.5">
                          {procChanges.filter(c => !c.inScope).map(c => (
                            <span key={c.process} className="block">
                              {c.process}
                              <span className="block text-[0.6875rem] font-normal text-ink-500 leading-relaxed">{c.note}</span>
                            </span>
                          ))}
                        </span>
                      )}
                    />
                  )}
                </>
              )}
              {round === 'rollforward' ? (
                <ReviewRow
                  label="Carried forward"
                  value={<>
                    {rfPicked.length} control{rfPicked.length === 1 ? '' : 's'} <span className="font-normal text-ink-400">· effective at interim</span>
                    {rfFailed.length > 0 && <> + {rfFailed.length} <span className="font-normal text-ink-400">· full retest</span></>}
                  </>}
                />
              ) : (
                <>
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
                </>
              )}
              {/* Where the auditor overruled the trial balance, and why. This is
                  the part of the scope that isn't self-evident from the numbers,
                  so it's the part worth re-reading before creating the audit. */}
              {round !== 'rollforward' && scopeKind === 'entity' && scopeChanges.length > 0 && (
                <ReviewRow
                  label="Scope changes"
                  value={(
                    <span className="block space-y-1.5">
                      {scopeChanges.map(c => (
                        <span key={c.entityId} className="block">
                          {c.name}
                          <span className="font-normal text-ink-400"> · {c.inScope ? 'brought in' : 'taken out'}</span>
                          <span className="block text-[11px] font-normal text-ink-500 leading-relaxed">{c.note}</span>
                        </span>
                      ))}
                    </span>
                  )}
                />
              )}
              </>}
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
          {/* Says what the greyed button is waiting for. Without it a disabled
              Continue is a dead end — the boxes are further up the scroll. */}
          {SCOPING_STEPS && step === 1 && round !== 'rollforward' && !hasTb && (
            <span className="text-[0.71875rem] text-high-700 font-medium">Upload a trial balance to continue</span>
          )}
          {/* A process that can't be tested outranks a missing note — it names
              what to upload, which the boxes further up don't. */}
          {SCOPING_STEPS && step === 2 && round !== 'rollforward' && noRacmInScope.length > 0 ? (
            <span className="text-[0.71875rem] text-high-700 font-medium text-right">
              {noRacmInScope.join(', ').replace(/, ([^,]*)$/, ' and $1')} {noRacmInScope.length === 1 ? 'has' : 'have'} no RACM
            </span>
          ) : SCOPING_STEPS && step === 2 && notesDue > 0 && (
            <span className="text-[0.71875rem] text-high-700 font-medium">
              {notesDue} change{notesDue === 1 ? '' : 's'} need{notesDue === 1 ? 's' : ''} a note
            </span>
          )}
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

    {/* Rendered beside the sheet rather than inside it: both are fixed-position
        overlays, and a later sibling wins the stack without either having to
        know the other's z-index. A sheet, not a dialog (user ask) — arriving
        from a sheet, it reads as one level deeper rather than a context switch. */}
    <AnimatePresence>
      {addCtrlRacm && (
        <DesignControlAddModal
          presentation="sheet"
          subProcesses={Array.from(new Set(
            eng.controls.filter(c => c.process === addCtrlRacm).map(c => c.subProcess).filter(Boolean),
          ))}
          onClose={() => setAddCtrlRacm(null)}
          onCreate={createControl}
        />
      )}
    </AnimatePresence>

    {/* Upload RACM, from a process row that can't be tested yet — the RACM
        tab's import review itself, same Columns → Review → Import, beside the
        sheet for the same stacking reason as the add-control screen. Its
        controls are picked up off the engagement by the awaitingRacm effect. */}
    {racmUpload && (
      <RacmImportReview
        mode="racm"
        file={racmUpload.file}
        process={racmUpload.process}
        entity={racmUpload.entity}
        existing={eng.controls}
        onClose={() => setRacmUpload(null)}
        onImport={(controls, meta) => { createRacm(racmUpload.process, meta.fileName, racmUpload.entity, { controls, source: meta.source, url: meta.url }); setRacmUpload(null); }}
      />
    )}
    </>
  );
}
