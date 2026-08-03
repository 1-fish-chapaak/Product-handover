import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Building2, ChevronDown, ChevronRight, ChevronUp, Circle, History, Info, Lightbulb, Lock, MessageSquare, Paperclip, Sparkles, Target, ShieldCheck, AlertTriangle, RotateCcw, Scale, CheckCircle2, Upload, X, XCircle, FileWarning, Sliders, GitMerge, Route } from 'lucide-react';
import { useIcfr } from './store';
import { defWord } from './flow';
import { useToast } from '../shared/Toast';
import { aggregationKeys, computeSeverity, courtForException, exceptionCourtDetail, formatINR, gradeException, isClearlyTrivial, isEngagementLocked, needsRatingConfirmation, retestReadiness, type ExceptionGradeResult, type RetestReadiness } from './helpers';
import { CourtBadge, SeverityPill, Toggle } from './parts';
import { FormSelect } from '../shared/FilterSelect';
import MaterialityWorksheet from './MaterialityWorksheet';
import ConfirmationModal from '../shared/ConfirmationModal';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
// PARKED (Aug 2026): EXPOSURE_LABEL, exposureTotal, GAP_HINT, GAP_LABEL and the
// Exposure / GapType types — priced impact and the gap taxonomy are off the card.
// `gapNature` replaces the latter, derived read-only from the track and the nature.
import { EXCEPTION_STEPS, gapNature, GRADE_RANK, MW_INDICATOR_CATALOGUE, type Assertion, type Deficiency, type ExceptionGrade, type ExceptionStatus, type IcfrEngagement, type RetestRound, type Severity, type SignificantAccount, type TaskType } from './types';

const fmt = (n: number) => formatINR(n);
const fmtFull = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

// ─── Threshold advice — what this period's exceptions say about next period's rules ──
// Read-only guidance. The thresholds themselves are frozen once testing starts, so
// every observation here is framed as an input to the NEXT period's planning; none
// of it re-grades a finding already reached.
interface ScopeAdvice { tone: 'ok' | 'note'; headline: string; detail: string; evidence: string }

function scopeAdvice(eng: IcfrEngagement): ScopeAdvice {
  const defs = eng.deficiencies;
  const M = eng.materiality, ctt = eng.rules.clearlyTrivial;
  const sd = M * eng.rules.sdBandPct / 100;
  if (defs.length === 0) {
    return {
      tone: 'ok',
      headline: 'No exceptions yet — nothing to read against the thresholds',
      detail: 'Once exceptions are raised, this panel reports how they sit against the clearly-trivial and significant-deficiency lines.',
      evidence: '0 exceptions raised',
    };
  }
  const trivial = defs.filter(d => isClearlyTrivial(d.magnitude, eng.rules)).length;
  // an exception within 10% of a grading line would flip on a small threshold move —
  // the grade rests on judgment rather than a comfortable margin
  const near = (v: number, line: number) => line > 0 && Math.abs(v - line) / line <= 0.10;
  const borderline = defs.filter(d => near(d.magnitude, ctt) || near(d.magnitude, sd) || near(d.magnitude, M));
  const evidence = `${defs.length} exception${defs.length === 1 ? '' : 's'} · ${trivial} at or below clearly-trivial · ${borderline.length} within 10% of a grading line`;

  if (trivial / defs.length >= 0.5) {
    return {
      tone: 'note',
      headline: `The clearly-trivial line is catching most exceptions — consider raising it next period`,
      detail: `${trivial} of ${defs.length} sit at or below ${fmtFull(ctt)} (${Math.round((ctt / M) * 100)}% of materiality). A higher floor next period would keep the register focused on what can actually matter, without changing how anything here was graded.`,
      evidence,
    };
  }
  if (borderline.length > 0) {
    return {
      tone: 'note',
      headline: `${borderline.length} exception${borderline.length === 1 ? ' sits' : 's sit'} within 10% of a grading line`,
      detail: `${borderline.map(d => d.id).join(', ')} would change grade on a small threshold move, so ${borderline.length === 1 ? 'its' : 'their'} severity rests on judgment rather than margin. Document the reasoning, and revisit the band when planning next period.`,
      evidence,
    };
  }
  return {
    tone: 'ok',
    headline: 'Thresholds are holding — no change indicated',
    detail: 'Every exception sits clear of a grading line, so the severities are not sensitive to where the thresholds were drawn.',
    evidence,
  };
}

// ─── Materiality & scope — the ground rules ──────────────────────────────────────
/**
 * Materiality and the ground rules that follow from it — the thresholds, the
 * severity ladder, the aggregation / routing policies, the MW indicators and the
 * significant accounts.
 *
 * Lifted out of ScopeView so the audit's Configuration tab can carry it too
 * (user ask: the Dashboard's Materiality card now lands there rather than
 * opening a page of its own).
 *
 * `sharedWith` is the honest part of that move. These numbers live on the
 * ENGAGEMENT, but Configuration is per audit — so editing them from inside one
 * audit silently re-grades every other audit on the engagement. Pass the other
 * audits' names and every edit asks first, naming them. Omit it (the
 * engagement-level page, where the scope is obvious) and edits apply directly.
 */
export function MaterialityGroundRules({ sharedWith }: { sharedWith?: string[] }) {
  const { eng, updateRules, updateMateriality } = useIcfr();
  const M = eng.materiality; const r = eng.rules;
  const locked = !!eng.materialityBasis?.lockedAt;
  const pm = eng.performanceMateriality;
  const ctt = r.clearlyTrivial;
  const sd = M * r.sdBandPct / 100;
  const pmPct = M ? Math.round((pm / M) * 100) : 0;
  const cttPct = M ? Math.round((ctt / M) * 100) : 0;

  /** The edit waiting on a yes. Held as a thunk so the confirm doesn't need to
   *  know which of the five settings it is about to change. */
  const [pending, setPending] = useState<{ what: string; apply: () => void } | null>(null);
  const guard = (what: string, apply: () => void) => {
    if (!sharedWith?.length) { apply(); return; }
    setPending({ what, apply });
  };
  const setRules = (what: string, patch: Parameters<typeof updateRules>[0]) => guard(what, () => updateRules(patch));
  const setMat = (what: string, patch: Parameters<typeof updateMateriality>[0]) => guard(what, () => updateMateriality(patch));

  const LADDER: { label: string; band: string; tone: string }[] = [
    { label: 'Clearly trivial', band: `≤ ${fmtFull(ctt)}`, tone: 'text-ink-500 bg-paper-50 border-canvas-border' },
    { label: 'Deficiency', band: `> ${fmtFull(ctt)} and < ${fmtFull(sd)}`, tone: 'text-mitigated-700 bg-mitigated-50/50 border-mitigated-200' },
    { label: 'Significant deficiency', band: `≥ ${fmtFull(sd)}  ·  ${r.sdBandPct}% of materiality`, tone: 'text-high-700 bg-high-50/50 border-high-200' },
    { label: 'Material weakness', band: `≥ ${fmtFull(M)}  or any MW indicator`, tone: 'text-risk-700 bg-risk-50/50 border-risk-200' },
  ];

  return (
    <div className="space-y-5" id="materiality-ground-rules">
      {sharedWith?.length ? (
        <div className="flex items-start gap-2 rounded-lg border border-canvas-border bg-paper-50/60 px-3.5 py-2.5">
          <Info size={13} className="text-ink-500 shrink-0 mt-0.5" />
          <p className="text-[0.75rem] text-ink-600 leading-relaxed">
            These are the <span className="font-semibold text-ink-900">engagement's</span> ground rules, not this audit's —
            changing them here also re-grades {sharedWith.length === 1 ? <>the <span className="font-semibold text-ink-900">{sharedWith[0]}</span> audit</> : <><span className="font-semibold text-ink-900">{sharedWith.length}</span> other audits</>} on this engagement. You'll be asked to confirm.
          </p>
        </div>
      ) : null}
      {pending && (
        <ConfirmationModal
          open
          tone="primary"
          title={`Change ${pending.what} for every audit?`}
          description={<>
            {pending.what[0]!.toUpperCase() + pending.what.slice(1)} is set once for the engagement, so this also applies to{' '}
            <b>{sharedWith?.join(', ')}</b>. Exceptions already graded against the old rule are re-graded.
          </>}
          confirmLabel="Change it"
          onConfirm={() => { pending.apply(); setPending(null); }}
          onClose={() => setPending(null)}
        />
      )}

      {/* materiality — the worksheet, locked once the engagement went live */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Target size={15} className="text-brand-600" /> Materiality</h2>
          {locked && <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-500 bg-paper-50 border border-canvas-border rounded-full px-2 h-5"><Lock size={10} /> Locked at go-live</span>}
        </div>
        {eng.materialityBasis ? (
          <MaterialityWorksheet basis={eng.materialityBasis} locked={locked} />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Money label="Overall materiality" value={M} onChange={v => setMat('overall materiality', { materiality: v })} hint="The financial-statement materiality benchmark." />
            <Money label="Performance materiality" value={pm} onChange={v => setMat('performance materiality', { performanceMateriality: v })} hint={`${pmPct}% of overall — the testing threshold.`} />
            <Money label="Clearly-trivial threshold" value={ctt} onChange={v => setRules('the clearly-trivial threshold', { clearlyTrivial: v })} hint={`${cttPct}% of overall — below this, logged but not evaluated.`} />
          </div>
        )}
      </section>

      {/* severity ladder */}
      <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Exception severity ladder</h2>
          <label className="inline-flex items-center gap-2 text-[0.75rem] text-ink-600"><Sliders size={13} /> Significant-deficiency band
            <input type="number" min={1} max={100} value={r.sdBandPct} onChange={e => setRules('the significant-deficiency band', { sdBandPct: Math.max(1, Math.min(100, +e.target.value || 0)) })} className="h-8 w-16 px-2 rounded-lg border border-canvas-border text-[0.78125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
            <span className="text-ink-400">% of materiality</span>
          </label>
        </div>
        <div className="space-y-2">
          {LADDER.map((row, i) => (
            <div key={row.label} className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5', row.tone)}>
              <span className="inline-flex items-center gap-2.5"><span className="font-mono text-[0.6875rem] font-bold opacity-60">{i + 1}</span><span className="text-[0.8125rem] font-bold">{row.label}</span></span>
              <span className="text-[0.75rem] tabular-nums font-medium">{row.band}</span>
            </div>
          ))}
        </div>
        <p className="text-[0.71875rem] text-ink-400 mt-2.5">Severity = likelihood (more than remote) × magnitude vs materiality. A compensating control can cap — never clear — a deficiency.</p>
      </section>

      {/* policies */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><GitMerge size={14} className="text-brand-600" /> Aggregation</div><p className="text-[0.75rem] text-ink-500 mt-1">Combine individually-minor deficiencies by commonality and evaluate them together.</p></div>
          <Toggle on={r.aggregate} onChange={v => setRules('aggregation', { aggregate: v })} label="Aggregation" />
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Route size={14} className="text-brand-600" /> Auto-routing</div><p className="text-[0.75rem] text-ink-500 mt-1">Route an exception to the owner (remediation) or the auditor (sign-off) by computed severity.</p></div>
          <Toggle on={r.autoRoute} onChange={v => setRules('auto-routing', { autoRoute: v })} label="Auto-routing" />
        </div>
      </section>

      {/* MW indicators */}
      <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-1"><AlertTriangle size={15} className="text-risk-600" /> Material-weakness indicators</h2>
        <p className="text-[0.75rem] text-ink-500 mb-3">If any in-force indicator is present on an exception, it is a material weakness regardless of magnitude.</p>
        <div className="space-y-1.5">
          {MW_INDICATOR_CATALOGUE.map(ind => {
            const on = r.mwIndicators.includes(ind);
            return (
              <button key={ind} onClick={() => setRules('the material-weakness indicators', { mwIndicators: on ? r.mwIndicators.filter(x => x !== ind) : [...r.mwIndicators, ind] })} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer', on ? 'border-risk-200 bg-risk-50/40' : 'border-canvas-border hover:border-ink-300')}>
                <span className={cn('w-[18px] h-[18px] rounded-sm border flex items-center justify-center shrink-0', on ? 'bg-risk-600 border-risk-600 text-white' : 'border-ink-300')}>{on && <CheckCircle2 size={12} />}</span>
                <span className="text-[0.78125rem] text-ink-800">{ind}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* significant accounts */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <header className="px-4 py-3 border-b border-canvas-border flex items-center justify-between"><h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-600" /> Significant accounts &amp; disclosures</h2><span className="text-[0.71875rem] text-ink-400">{eng.accounts.filter(a => a.inScope).length} in scope</span></header>
        <table className="w-full text-[0.78125rem]">
          <thead><tr className="text-ink-500 border-b border-canvas-border">{['Account', 'Balance', 'In scope', 'Assertions'].map(h => <th key={h} className="text-left font-semibold uppercase tracking-wide text-[0.625rem] px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {eng.accounts.map(a => (
              <tr key={a.id} className="border-b border-canvas-border/60 last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink-800">{a.name}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink-600">{fmt(a.balance)}</td>
                <td className="px-4 py-2.5">{a.inScope ? <Pill tone="compliant">In scope</Pill> : <Pill tone="draft">Out</Pill>}</td>
                <td className="px-4 py-2.5 text-ink-500">{a.assertions.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/**
 * Materiality & scoping, as its own page. Still reachable from the engagement
 * Overview's "Entities & scope" row — the audit Dashboard's Materiality card
 * now goes to the audit's Configuration tab instead (user ask), which renders
 * the same ground rules inline.
 */
export function ScopeView() {
  const { eng, back, racmDocs } = useIcfr();
  return (
    <div className="space-y-5">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Back</button>
      <div>
        <h1 className="text-[1.375rem] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Materiality &amp; scoping</h1>
        <p className="text-[0.8125rem] text-ink-500 mt-0.5">Entity, materiality and the ground rules that drive how every exception is evaluated, sized, and routed. Materiality locks at go-live.</p>
      </div>

      {/* entity & source */}
      <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><Building2 size={15} className="text-brand-600" /> Entity</h2>
        <div className="flex items-start gap-3.5">
          <span className="w-10 h-10 rounded-xl bg-brand-600 text-white inline-flex items-center justify-center shrink-0"><Building2 size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.875rem] font-semibold text-ink-900">{eng.entity}</div>
            <div className="text-[0.75rem] text-ink-500 mt-0.5">
              {eng.entityDetected
                ? <><Sparkles size={11} className="inline -mt-0.5 text-brand-600" /> Detected from {eng.entityDetected.source} · company code <b className="font-mono">{eng.entityDetected.companyCode}</b></>
                : `${eng.framework} · ${eng.periodStart} – ${eng.periodEnd}`}
              {eng.live && <> · <span className="font-semibold text-compliant-700">Live{eng.wentLiveAt ? ` since ${eng.wentLiveAt}` : ''}</span></>}
            </div>
            {racmDocs.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {racmDocs.map(d => <span key={d.id} className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-canvas-border bg-paper-50/50 text-[0.6875rem] font-medium text-ink-600"><Paperclip size={10} /> {d.name}</span>)}
              </div>
            )}
          </div>
        </div>
      </section>

      <MaterialityGroundRules />
    </div>
  );
}


const ALL_ASSERTIONS: Assertion[] =['Existence / Occurrence', 'Completeness', 'Accuracy', 'Valuation', 'Cut-off', 'Rights & Obligations', 'Presentation'];

// One editable scoping row: in/out toggle, assertion chips, expandable WCGWs.
function AccountRow({ a, canEdit, onPatch }: { a: SignificantAccount; canEdit: boolean; onPatch: (patch: Partial<SignificantAccount>) => void }) {
  const [open, setOpen] = useState(false);
  const [newWcgw, setNewWcgw] = useState('');
  const toggleAssertion = (as_: Assertion) => onPatch({ assertions: a.assertions.includes(as_) ? a.assertions.filter(x => x !== as_) : [...a.assertions, as_] });
  return (
    <>
      <tr className={cn('border-b border-canvas-border/60', !open && 'last:border-0', !a.inScope && 'opacity-60')}>
        <td className="px-4 py-2.5 font-medium text-ink-800">{a.name}</td>
        <td className="px-4 py-2.5 tabular-nums text-ink-600">{fmt(a.balance)}</td>
        <td className="px-4 py-2.5 text-ink-500">{a.process ?? '—'}</td>
        <td className="px-4 py-2.5">
          {canEdit
            ? <span className="inline-flex items-center gap-2">
                <Toggle on={a.inScope} onChange={v => onPatch({ inScope: v })} label={a.inScope ? 'In scope — click to take out of scope' : 'Out of scope — click to bring into scope'} />
                <span className={cn('text-[11.5px] font-semibold', a.inScope ? 'text-compliant-700' : 'text-ink-400')}>{a.inScope ? 'In scope' : 'Out'}</span>
              </span>
            : a.inScope ? <Pill tone="compliant">In scope</Pill> : <Pill tone="draft">Out</Pill>}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1 flex-wrap">
            {ALL_ASSERTIONS.map(as_ => {
              const on = a.assertions.includes(as_);
              if (!canEdit && !on) return null;
              return (
                <button key={as_} disabled={!canEdit} onClick={() => toggleAssertion(as_)}
                  className={cn('h-6 px-1.5 rounded-md border text-[10.5px] font-semibold transition-colors', on ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-400', canEdit && 'cursor-pointer hover:border-ink-300')}>
                  {as_.replace(' / Occurrence', '/Occ.')}
                </button>
              );
            })}
          </div>
        </td>
        <td className="px-4 py-2.5">
          <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
            {(a.wcgw?.length ?? 0)} WCGW{(a.wcgw?.length ?? 0) === 1 ? '' : 's'} {open ? '▾' : '▸'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-canvas-border/60 last:border-0 bg-paper-50/40">
          <td colSpan={6} className="px-4 py-3">
            <div className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400 mb-1.5">What could go wrong — {a.name}</div>
            <ul className="space-y-1 mb-2">
              {(a.wcgw ?? []).map((w, i) => (
                <li key={i} className="flex items-center gap-2 text-[12px] text-ink-700">
                  <span className="w-1 h-1 rounded-full bg-risk-400 shrink-0" /> {w}
                  {canEdit && <button onClick={() => onPatch({ wcgw: (a.wcgw ?? []).filter((_, j) => j !== i) })} className="text-ink-300 hover:text-risk-600 cursor-pointer text-[11px]">remove</button>}
                </li>
              ))}
              {(a.wcgw?.length ?? 0) === 0 && <li className="text-[12px] text-ink-400">None captured — a relevant assertion should trace to at least one WCGW.</li>}
            </ul>
            {canEdit && (
              <div className="flex items-center gap-2">
                <input value={newWcgw} onChange={e => setNewWcgw(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newWcgw.trim()) { onPatch({ wcgw: [...(a.wcgw ?? []), newWcgw.trim()] }); setNewWcgw(''); } }}
                  placeholder="e.g. Sales near period end recorded in the wrong period"
                  className="h-8 flex-1 max-w-[480px] px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[12px] focus:outline-none focus:border-brand-300" />
                <button disabled={!newWcgw.trim()} onClick={() => { onPatch({ wcgw: [...(a.wcgw ?? []), newWcgw.trim()] }); setNewWcgw(''); }}
                  className="h-8 px-2.5 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// Editors get the input; readers get plain text — a threshold is never a
function Money({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint: string }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold text-ink-500 mb-1.5">{label}</div>
      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-ink-400 pointer-events-none">₹</span>
        <input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, +e.target.value || 0))} className="w-full h-10 pl-7 pr-3 rounded-lg border border-canvas-border text-[0.8125rem] tabular-nums text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
      </div>
      <div className="text-[0.6875rem] text-ink-400 mt-1">{hint}</div>
    </div>
  );
}


// Prudent-official override — judgment can raise the grade above the math, never
// lower it, and always with a recorded rationale (the handbook's judgment floor).
function PrudentRow({ d, baseFinal, onApply, onClear }: { d: Deficiency; baseFinal: ExceptionGrade; onApply: (to: Severity, rationale: string) => void; onClear: () => void }) {
  const [pending, setPending] = useState<Severity | null>(null);
  const [note, setNote] = useState('');
  const options = (['Significant Deficiency', 'Material Weakness'] as Severity[]).filter(s => GRADE_RANK[s] > GRADE_RANK[baseFinal]);
  return (
    <div className="flex items-start gap-2 text-[12px] flex-wrap">
      <span className="text-ink-500 w-[120px] mt-1">Prudent official</span>
      {d.prudentOverride ? (
        <span className="text-[11.5px] text-high-700 inline-flex items-center gap-1.5 flex-wrap mt-1">
          <b className="font-semibold">raised to {d.prudentOverride.to}</b> — “{d.prudentOverride.rationale}” <span className="text-ink-400">· {d.prudentOverride.by}</span>
          <button onClick={onClear} className="text-ink-400 hover:text-ink-700 cursor-pointer inline-flex items-center gap-0.5"><RotateCcw size={10} /> undo</button>
        </span>
      ) : options.length === 0 ? (
        <span className="text-[11.5px] text-ink-400 mt-1">already at the top of the ladder — nothing to raise</span>
      ) : pending ? (
        <span className="flex items-center gap-2 flex-1 min-w-[260px]">
          <input autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder={`Why would a prudent official call this ${pending === 'Material Weakness' ? 'a material weakness' : 'a significant deficiency'}?`}
            className="h-8 flex-1 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] focus:outline-none focus:border-brand-300" />
          <button disabled={!note.trim()} onClick={() => { onApply(pending, note.trim()); setPending(null); setNote(''); }} className="h-8 px-2.5 rounded-md bg-brand-600 text-white text-[11.5px] font-semibold disabled:opacity-40 cursor-pointer">Raise</button>
          <button onClick={() => { setPending(null); setNote(''); }} className="h-8 px-2 rounded-md border border-canvas-border text-[11.5px] text-ink-600 cursor-pointer">Cancel</button>
        </span>
      ) : (
        <>
          {options.map(s => (
            <button key={s} onClick={() => setPending(s)} className="h-7 px-2.5 rounded-md border border-canvas-border text-[11px] font-semibold text-ink-600 hover:border-high-300 hover:text-high-700 cursor-pointer transition-colors">Raise to {s}</button>
          ))}
          <span className="text-[10.5px] text-ink-400 mt-1.5">judgment goes up only — rationale recorded</span>
        </>
      )}
    </div>
  );
}

// A remediation due date is stored as a string — either ISO 'YYYY-MM-DD' (what the
// date picker writes) or a legacy '30 Jun'-style label from seed data. These helpers
// read BOTH shapes, so overdue detection can never silently no-op on a value it
// failed to parse (the old free-text field's failure mode).
function parseDue(date: string | null): number | null {
  if (!date) return null;
  const s = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const t = Date.parse(`${s}T00:00:00`); return Number.isNaN(t) ? null : t; }
  const withYear = /\b\d{4}\b/.test(s) ? s : `${s} ${new Date().getFullYear()}`;
  const t = Date.parse(withYear);
  return Number.isNaN(t) ? null : t;
}
function dueIsPast(date: string | null): boolean {
  const t = parseDue(date);
  return t !== null && t < Date.now();
}
// Stored due → value for <input type="date"> (ISO 'YYYY-MM-DD', '' when unset/unparseable).
function toDateInputValue(date: string | null): string {
  if (!date) return '';
  const s = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = parseDue(s);
  if (t === null) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Stored due → human label for read-only display ('—' when unset).
function formatDueLabel(date: string | null): string {
  if (!date) return '—';
  const s = date.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return s;
}

// ─── ③ The plan — the owner writes it, the auditor only judges it ────────────────
// Editable in the owner's hat while the exception is still theirs: step ③ before
// it goes up for review, step ④ while the fix is being done. Once it is with the
// auditor it is frozen. Everyone else reads it.
function PlanBlock({ d, isOwner, locked = false, onPatch, onAttach }: { d: Deficiency; isOwner: boolean; locked?: boolean; onPatch: (patch: Partial<Deficiency['remediation']>) => void; onAttach: (fileName: string) => void }) {
  const r = d.remediation;
  // a sealed engagement retires the owner's pen along with everyone else's
  const editable = isOwner && !locked && (d.status === 'Planning' || d.status === 'Remediation');
  const planning = d.status === 'Planning';
  const overdue = dueIsPast(r.date) && r.status !== 'Done';
  const files = r.evidence ?? [];
  const rejected = d.planReview?.decision === 'Rejected';
  return (
    <div className="rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-ink-500 mb-1.5">
        <RotateCcw size={12} /> The fix{isOwner ? ' — your commitment' : ''}
        <span className="ml-auto normal-case tracking-normal font-medium text-ink-600">{r.status}</span>
        {overdue && <span className="normal-case tracking-normal inline-flex items-center gap-1 text-[10.5px] font-bold text-risk-700 bg-risk-50 border border-risk-200 rounded px-1.5 h-5"><AlertTriangle size={10} /> overdue — escalate</span>}
      </div>

      {/* A rejection is not a status change, it is a message — so it reads as one,
          in the owner's lane, above the fields they have to rewrite. */}
      {rejected && d.planReview?.reason && (
        <div className="mb-2 rounded-md border border-high-200 bg-high-50/60 px-2.5 py-2 text-[0.75rem] text-high-800">
          <b className="font-semibold">Sent back by {d.planReview.by}</b> — {d.planReview.reason}
        </div>
      )}

      {editable ? (
        <div className="space-y-1.5">
          <input value={r.action} onChange={e => onPatch({ action: e.target.value })}
            placeholder="What fixes the root cause — not the symptom (e.g. normalise the match key, not recover the 4 invoices)"
            className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 focus:outline-none focus:border-brand-300" />
          <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
            <span className="text-ink-400">Responsible person</span>
            <input value={r.owner} onChange={e => onPatch({ owner: e.target.value })} placeholder="Who does it"
              className="h-7 w-56 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] focus:outline-none focus:border-brand-300" />
            <span className="text-ink-400">Due</span>
            <input type="date" value={toDateInputValue(r.date)} onChange={e => onPatch({ date: e.target.value || null })}
              className={cn('h-7 w-40 px-2 rounded-md border bg-canvas-elevated text-[11.5px] tabular-nums focus:outline-none focus:border-brand-300', overdue ? 'border-risk-300 text-risk-700' : 'border-canvas-border')} />
          </div>
        </div>
      ) : (
        <>
          <div className="text-[0.78125rem] text-ink-700">{r.action || <span className="text-ink-400">Not written yet.</span>}</div>
          <div className="text-[0.71875rem] text-ink-400 mt-0.5">{r.owner} · due {formatDueLabel(r.date)}{d.retest && <> · latest retest <span className={d.retest.result === 'Pass' ? 'text-compliant-700 font-semibold' : 'text-risk-700 font-semibold'}>{d.retest.result}</span></>}{d.signoff && <> · signed off by {d.signoff.by}</>}</div>
        </>
      )}

      {/* The auditor's verdict on the plan, once given — their whole say in it. */}
      {d.planReview?.decision === 'Accepted' && (
        <p className="text-[0.71875rem] text-compliant-700 font-semibold mt-1.5 inline-flex items-center gap-1"><CheckCircle2 size={11} /> Addresses the root cause — accepted by {d.planReview.by}</p>
      )}

      {/* ④ Evidence. Only once the plan is accepted and the fix is being done —
          there is nothing to evidence while the plan is still being written. */}
      {!planning && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-[0.65625rem] uppercase tracking-wide font-semibold text-ink-400">Fix evidence</span>
          {files.map(f => (
            <span key={f.id} className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.65625rem] font-semibold text-ink-600"><Paperclip size={10} /> {f.name}</span>
          ))}
          {files.length === 0 && !editable && <span className="text-[0.6875rem] text-ink-400">none attached</span>}
          {editable && (
            <button onClick={() => onAttach(`${d.id.toLowerCase()}-fix-evidence${files.length ? `-${files.length + 1}` : ''}.pdf`)}
              className="h-6 px-2 rounded-md border border-dashed border-canvas-border text-[0.65625rem] font-semibold text-ink-500 hover:text-brand-700 hover:border-brand-300 cursor-pointer inline-flex items-center gap-1 transition-colors"><Paperclip size={10} /> Attach evidence</button>
          )}
          {editable && files.length === 0 && <span className="text-[0.65625rem] text-mitigated-700">required before you can submit for retest</span>}
        </div>
      )}
    </div>
  );
}

// ─── The conclusion, and the working behind it ───────────────────────────────────
// Lead with the grade; the derivation is folded away, so the card reads as an
// answer first and an equation only on request. The working is not prose written
// alongside the calculation — it IS the calculation, emitted by the engine in the
// order the rules ran, which is why a rule that did nothing still gets a line.
function SeverityConclusion({ result, showMateriality }: { result: ExceptionGradeResult; showMateriality: boolean }) {
  const [showWorking, setShowWorking] = useState(false);
  const shown = showMateriality ? result.working : result.working.filter(w => w.n !== 5 || !w.fired);
  return (
    <div className="pt-2 border-t border-canvas-border">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400">Conclusion</span>
        <SeverityPill s={result.grade} />
        <button onClick={() => setShowWorking(w => !w)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
          {showWorking ? 'Hide working' : 'Show working'} <span className="text-[9px] leading-none">{showWorking ? '▾' : '▸'}</span>
        </button>
      </div>
      {showWorking && (
        <ol className="mt-2 space-y-1">
          {shown.map((w, i) => (
            <li key={`${w.n}-${i}`} className="flex items-start gap-2 text-[0.71875rem] leading-relaxed">
              <span className={cn('mt-[3px] shrink-0 w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[0.59375rem] font-bold tabular-nums',
                w.fired ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-400')}>{w.n}</span>
              <span className={cn('min-w-0', w.fired ? 'text-ink-800' : 'text-ink-400')}>
                <b className="font-semibold">{w.rule}</b> — {w.detail}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── ⑤ The retest ────────────────────────────────────────────────────────────────
// A fresh sample off the period SINCE THE FIX, marked against the SAME attributes
// the original test used, item by item. The verdict is derived from the grid and
// never typed — a retest whose result can be asserted independently of its marks
// is not evidence of anything.
function RetestPanel({ d }: { d: Deficiency }) {
  const { drawRetestSample, setRetestResult, recordRetest } = useIcfr();
  const [rationale, setRationale] = useState('');
  const draft = d.retestDraft;

  if (!draft) {
    return (
      <div className="rounded-lg border border-canvas-border bg-paper-50/40 px-3 py-3">
        <div className="text-[0.6875rem] uppercase tracking-wide font-semibold text-ink-500 mb-1">Retest — draw the sample</div>
        <p className="text-[0.75rem] text-ink-600 mb-2.5">
          Items come off the period since the fix landed only. Anything from before it was produced by the broken control and proves nothing about the repair.
        </p>
        <button onClick={() => drawRetestSample(d.id)}
          className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><Target size={13} /> Draw post-fix sample</button>
      </div>
    );
  }

  const marks = draft.samples.flatMap(s => draft.attributes.map(a => draft.results[s.id]?.[a.code] ?? 'Not tested'));
  const done = !marks.includes('Not tested');
  const willFail = marks.includes('Fail');
  const cell = (sampleId: string, code: string) => draft.results[sampleId]?.[code] ?? 'Not tested';

  return (
    <div className="rounded-lg border border-canvas-border bg-paper-50/40 px-3 py-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[0.6875rem] uppercase tracking-wide font-semibold text-ink-500">Retest {draft.n} — {draft.samples.length} items</span>
        <span className="text-[0.6875rem] text-ink-500">drawn from {draft.windowFrom} → {draft.windowTo}</span>
        <span className="ml-auto text-[0.6875rem] font-semibold tabular-nums text-ink-500">{marks.filter(m => m !== 'Not tested').length} / {marks.length} marked</span>
      </div>
      <p className="text-[0.6875rem] text-ink-400">Same attributes as the original test — a retest that invents its own is not a retest of anything.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-[0.71875rem] border-collapse">
          <thead>
            <tr className="text-left">
              <th className="py-1.5 pr-3 font-semibold text-ink-500 whitespace-nowrap">Item</th>
              <th className="py-1.5 pr-3 font-semibold text-ink-500 whitespace-nowrap">Date</th>
              {draft.attributes.map(a => (
                <th key={a.code} title={a.description} className="py-1.5 px-2 font-semibold text-ink-500 whitespace-nowrap">{a.code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {draft.samples.map(s => (
              <tr key={s.id} className="border-t border-canvas-border">
                <td className="py-1.5 pr-3 font-mono text-ink-700 whitespace-nowrap">{s.ref}</td>
                <td className="py-1.5 pr-3 tabular-nums text-ink-500 whitespace-nowrap">{s.date}</td>
                {draft.attributes.map(a => {
                  const v = cell(s.id, a.code);
                  return (
                    <td key={a.code} className="py-1.5 px-2">
                      <div className="inline-flex rounded-md border border-canvas-border overflow-hidden">
                        {(['Pass', 'Fail'] as const).map(r => (
                          <button key={r} onClick={() => setRetestResult(d.id, s.id, a.code, r)}
                            aria-label={`${s.ref} ${a.code} ${r}`}
                            className={cn('h-6 px-2 text-[0.65625rem] font-bold cursor-pointer transition-colors',
                              v === r
                                ? (r === 'Pass' ? 'bg-compliant-600 text-white' : 'bg-risk-600 text-white')
                                : 'bg-canvas-elevated text-ink-400 hover:bg-paper-100')}>{r === 'Pass' ? 'P' : 'F'}</button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {done && willFail && (
        <textarea value={rationale} onChange={e => setRationale(e.target.value)} rows={2}
          placeholder="Why it failed again — the owner reads this when the plan comes back to them"
          className="w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] resize-none focus:outline-none focus:border-brand-300" />
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {done ? (
          <button onClick={() => recordRetest(d.id, rationale.trim() || undefined)} disabled={willFail && !rationale.trim()}
            title={willFail && !rationale.trim() ? 'A failed retest goes back to the owner — tell them why' : undefined}
            className={cn('h-8 px-3 rounded-lg text-white text-[0.75rem] font-semibold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
              willFail ? 'bg-risk-600 enabled:hover:bg-risk-700' : 'bg-compliant-600 enabled:hover:bg-compliant-700')}>
            {willFail ? <><XCircle size={13} /> Record retest {draft.n} — failed</> : <><CheckCircle2 size={13} /> Record retest {draft.n} — passed</>}
          </button>
        ) : (
          <span className="text-[0.71875rem] text-ink-400">Mark every item against every attribute — the verdict comes off the grid, not a button.</span>
        )}
      </div>
    </div>
  );
}

/** Every retest that has already run. Two failures put it in front of the reviewer:
 *  a fix that has missed twice is not a remediation problem any more. */
function RetestHistory({ rounds }: { rounds: RetestRound[] }) {
  if (!rounds.length) return null;
  const failures = rounds.filter(r => r.result === 'Fail').length;
  return (
    <div className="rounded-lg border border-canvas-border px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap text-[0.6875rem] uppercase tracking-wide font-semibold text-ink-500 mb-1.5">
        <History size={12} /> Retest history
        <span className="normal-case tracking-normal font-medium text-ink-500">attempt {rounds.length}</span>
        {failures >= 2 && (
          <span className="normal-case tracking-normal inline-flex items-center gap-1 text-[0.65625rem] font-bold text-risk-700 bg-risk-50 border border-risk-200 rounded px-1.5 h-5">
            <AlertTriangle size={10} /> {failures} failures — flagged to the reviewer
          </span>
        )}
      </div>
      <ol className="space-y-1">
        {rounds.map(r => (
          <li key={r.n} className="text-[0.75rem] text-ink-600 flex items-start gap-2">
            <span className="tabular-nums text-ink-400 shrink-0">{r.n}.</span>
            <span className="min-w-0">
              <b className={cn('font-semibold', r.result === 'Pass' ? 'text-compliant-700' : 'text-risk-700')}>{r.result}</b>
              <span className="text-ink-400"> · {r.samples.length} items from {r.windowFrom} → {r.windowTo} · {r.by}</span>
              {r.rationale && <span className="block text-ink-600">{r.rationale}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** When the fix will have run long enough to be worth sampling — and, when that
 *  lands after the books close, the warning that says so NOW rather than in March. */
function RetestReadyLine({ readiness }: { readiness: RetestReadiness }) {
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-[0.75rem] flex items-start gap-2',
      readiness.beyondPeriodEnd ? 'border-high-200 bg-high-50/60 text-high-800' : 'border-canvas-border bg-paper-50/40 text-ink-600')}>
      {readiness.beyondPeriodEnd ? <AlertTriangle size={13} className="mt-[2px] shrink-0" /> : <History size={13} className="mt-[2px] shrink-0 text-ink-400" />}
      <span className="min-w-0">
        <b className="font-semibold">Retestable from {readiness.label}</b> — {readiness.reason}
      </span>
    </div>
  );
}

// ─── Handoffs — open requests between audit and the first line ───────────────────
// Same type labels as the Overview card; same row anatomy as the owner's checklist.
const HANDOFF_GROUPS: { type: TaskType; label: string; Icon: typeof Upload; tone: string }[] = [
  { type: 'pbc', label: 'Document requests', Icon: Upload, tone: 'text-evidence-700' },
  { type: 'query', label: 'Open questions', Icon: MessageSquare, tone: 'text-brand-700' },
  { type: 'remediation', label: 'Remediations', Icon: FileWarning, tone: 'text-high-700' },
];

export function HandoffsView() {
  const { eng, openControl } = useIcfr();
  const open = eng.tasks.filter(t => t.status === 'open');
  const cleared = eng.tasks.length - open.length;
  const rowCls = 'w-full flex items-center gap-2.5 py-1.5 px-2 -mx-1 rounded-lg text-left hover:bg-paper-100 transition-colors cursor-pointer group';
  return (
    <div className="space-y-4">
      {/* getting back up is the breadcrumb's job (rendered by the shell):
          Engagements / engagement / Handoffs */}
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Handoffs</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Open requests between audit and the first line — documents, questions and remediations. A row opens its control.</p>
      </div>

      {open.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-compliant-50 flex items-center justify-center"><CheckCircle2 size={22} className="text-compliant-700" /></div>
          <p className="text-[15px] font-semibold text-ink-800">No open handoffs</p>
          <p className="text-[13px] text-ink-500">Nothing is waiting on either side right now.</p>
        </div>
      ) : HANDOFF_GROUPS.map(g => {
        const rows = open.filter(t => t.type === g.type);
        if (rows.length === 0) return null;
        return (
          <section key={g.type} className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
            <div className="flex items-center gap-2 mb-2">
              <g.Icon size={15} className={g.tone} />
              <h2 className="text-[13px] font-bold text-ink-800">{g.label}</h2>
              <span className="ml-auto text-[11px] font-semibold text-ink-400">{rows.length} open</span>
            </div>
            <div className="space-y-0.5">
              {rows.map(t => (
                <button key={t.id} onClick={() => openControl(t.controlId)} className={rowCls}>
                  <span className="w-4 flex justify-center shrink-0"><Circle size={11} className={t.overdue ? 'text-risk-700' : 'text-ink-400'} /></span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">
                    <b className="font-semibold text-ink-900">{t.title}</b> <span className="text-ink-400">· {t.controlId} · with {t.assignee}</span>
                  </span>
                  <span className={cn('shrink-0 text-[11.5px] font-semibold', t.overdue ? 'text-risk-700' : 'text-ink-400')}>{t.dueLabel}</span>
                  <ChevronRight size={14} className="shrink-0 text-ink-300 group-hover:text-ink-500 transition-colors" />
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {cleared > 0 && <p className="text-[11.5px] text-ink-400">{cleared} already submitted or cleared — each control's activity trail keeps the history.</p>}
    </div>
  );
}

// ─── Exceptions — the six steps ──────────────────────────────────────────────────
// Eight states, six steps: sizing parks for the reviewer when it lands on
// significant or worse, and planning parks for the auditor to judge the plan. Both
// handoffs happen INSIDE a step, so the stepper stays six wide.
const STATUS_TONE: Record<ExceptionStatus, Tone> = {
  Identified: 'high',
  'Rating review': 'info',
  Planning: 'mitigated',
  'Plan review': 'info',
  Remediation: 'mitigated',
  Retest: 'evidence',
  'Awaiting reviewer': 'info',
  Closed: 'compliant',
};
/** Which of the six steps this exception is standing on. 'Identified' spans steps
 *  ① and ②: it is still being raised until the root cause is written, and being
 *  sized once it is. */
function currentStep(d: Deficiency): number {
  if (d.status === 'Identified') return d.rootCause.trim() ? 2 : 1;
  return EXCEPTION_STEPS.find(s => s.states.includes(d.status))?.n ?? 1;
}
const MW_INDICATORS = MW_INDICATOR_CATALOGUE as readonly string[];

export function DeficienciesView() {
  const { eng, role, meOwner, focusDefId } = useIcfr();
  // Classic engagements still call these exceptions; the rework renamed them.
  const W = defWord(eng.id);
  const M = eng.materiality; const rules = eng.rules;
  const isOwner = role === 'risk-owner';
  // a countersigned engagement is a sealed record — the store already drops
  // every write, so the page must say so and put its pens away
  const locked = isEngagementLocked(eng);
  // person-lane: the owner sees only exceptions riding their own controls
  const defs = isOwner ? eng.deficiencies.filter(d => eng.controls.find(c => c.id === d.controlId)?.owner === meOwner) : eng.deficiencies;

  return (
    <div className="space-y-4">
      {/* getting back up is the breadcrumb's job (rendered by the shell):
          Engagements / engagement / Exceptions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{isOwner ? W.mine : W.page}</h1>
            {locked && <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500 bg-paper-100 border border-canvas-border rounded-full px-2 h-[20px]">
              <Lock size={11} className="text-ink-400" /> Engagement concluded · read-only
            </span>}
          </div>
          <p className="text-[13px] text-ink-500 mt-0.5">
            {locked
              ? 'The engagement is countersigned, so this record is sealed — severity, remediation and stages are as they stood at conclusion.'
              : isOwner
              ? `${W.Many} on your controls — commit the plan, execute the fix, and submit for retest. The auditor evaluates severity; the reviewer closes.`
              : <>Severity is computed against materiality ({fmt(M)}). Three lanes: the owner remediates, the auditor evaluates &amp; retests, the reviewer closes.</>}
          </p>
        </div>
      </div>

      {/* Aggregation — engagement-wide, audit-side only. The groups are the ones
          the engine itself uses at rule 6: a shared process or assertion, both read
          off the control and the attributes that failed, plus whatever the auditor
          linked by root cause. Clearly-trivial items never join a group — rule 3
          stopped them before aggregation was reached. */}
      {rules.aggregate && !isOwner && (() => {
        const LRANK: Record<string, number> = { Remote: 0, 'Reasonably possible': 1, Probable: 2 };
        const LBYR = ['Remote', 'Reasonably possible', 'Probable'] as const;
        const groups = new Map<string, { kind: string; label: string; ds: typeof eng.deficiencies }>();
        let trivial = 0;
        eng.deficiencies.forEach(d => {
          if (d.status === 'Closed') return;
          if (isClearlyTrivial(d.magnitude, rules)) { trivial += 1; return; }
          aggregationKeys(d, eng).forEach(k => {
            const hit = groups.get(k.key) ?? { kind: k.kind, label: k.key.split(':').slice(1).join(':'), ds: [] };
            groups.set(k.key, { ...hit, ds: [...hit.ds, d] });
          });
        });
        const agg = Array.from(groups.entries()).filter(([, g]) => g.ds.length > 1);
        if (!agg.length) return null;
        return (
          <div className="space-y-2">
            <h2 className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide">Aggregation — individually-minor deficiencies combine by commonality</h2>
            {agg.map(([key, g]) => {
              const sum = g.ds.reduce((n, d) => n + d.magnitude, 0);
              const lk = LBYR[Math.max(...g.ds.map(d => LRANK[d.likelihood] ?? 0))]!;
              const mw = Array.from(new Set(g.ds.flatMap(d => d.mwIndicators)));
              return (
                <div key={key} className="rounded-xl border border-mitigated-200 bg-mitigated-50/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[12.5px] text-ink-700">
                    <span className="text-ink-400">{g.kind}</span> <span className="font-semibold">{g.label}</span> · {g.ds.length} exceptions ({g.ds.map(d => d.id).join(', ')}) · combined {fmt(sum)} (vs {fmt(M)})
                  </div>
                  <SeverityPill s={computeSeverity(lk, sum, M, mw, rules.sdBandPct / 100)} />
                </div>
              );
            })}
            {trivial > 0 && <p className="text-[0.71875rem] text-ink-400">{trivial} clearly-trivial logged, never aggregated — the ladder stops at rule 3.</p>}
          </div>
        );
      })()}

      {defs.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 text-center text-ink-500">{isOwner ? `No ${W.many} on your controls.` : `No ${W.many} — all tested controls effective.`}</div>
      ) : (
        <div className="space-y-3">
          {defs.map(d => <DeficiencyCard key={d.id} d={d} defaultOpen={d.id === focusDefId} />)}
        </div>
      )}
    </div>
  );
}

/** ONE deficiency, as a card that opens in place.
 *
 *  Lives here rather than inside DeficienciesView because the control's own paper
 *  shows it too: a control that concluded ineffective raises a deficiency, and the
 *  auditor standing on that paper should be able to grade it and plan the fix
 *  without leaving for another tab and finding their place again. Same card, same
 *  writes, same four-eyes rules, wherever it is opened from.
 *
 *  In a LIST it starts collapsed (user ask). Expanded, one of these is most of a
 *  screen — severity inputs, priced impact, MW indicators, the remediation plan
 *  and the lifecycle actions — so a stack of them buried the one you came to find.
 *  Collapsed, the header still carries everything needed to triage: which finding,
 *  on which control, how bad, and where it has got to. Opened from a control's own
 *  paper there is only ever one, and you asked for it, so it comes up open.
 *
 *  Each card owns its open state and both confirm modals — deliberately not an
 *  accordion, because comparing two findings side by side is a real thing an
 *  auditor does, and snapping one shut to open another would take that away. */
export function DeficiencyCard({ d, defaultOpen = false, showControlLink = true }: { d: Deficiency; defaultOpen?: boolean; showControlLink?: boolean }) {
  const {
    eng, role, me, openControl, updateDeficiency, setExceptionStatus, completeSizing, confirmRating, returnRating,
    submitPlan, reviewPlan, signOffException, reopenException, updateRemediation, addRemediationEvidence,
    focusDefId, clearFocusDef,
  } = useIcfr();
  const { addToast } = useToast();
  const W = defWord(eng.id);
  const M = eng.materiality;
  const [open, setOpen] = useState(defaultOpen);
  // Asked-for cards bring themselves into view. The focus is consumed on arrival:
  // it answers one click, and coming back to this page later should open nothing.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!defaultOpen || focusDefId !== d.id) return;
    const t = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      clearFocusDef();
    }, 160);
    return () => window.clearTimeout(t);
  }, [defaultOpen, focusDefId, d.id, clearFocusDef]);
  // closing an exception is the terminal four-eyes act — it commits behind an attest
  // confirm; a mistaken close comes back only with a recorded reason, same weight.
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  // a rejection — of the rating or of the plan — never commits without a reason
  const [rejecting, setRejecting] = useState<null | 'rating' | 'plan'>(null);
  const [rejectReason, setRejectReason] = useState('');
  const isAuditor = role === 'auditor';
  const isOwner = role === 'risk-owner';
  const isReviewer = role === 'reviewer';
  // a countersigned engagement is a sealed record — the store already drops
  // every write, so the card must say so and put its pens away
  const locked = isEngagementLocked(eng);
  // Root-cause links on offer: the other live exceptions this one could be said to
  // share a mechanism with. Process and assertion group themselves; this is the one
  // the auditor has to state, because free prose cannot be matched.
  const linkOptions = useMemo(
    () => eng.deficiencies.filter(x => x.id !== d.id && x.status !== 'Closed').map(x => ({ value: x.id, label: `${x.id} — ${x.controlId}` })),
    [eng.deficiencies, d.id],
  );

  const control = eng.controls.find(c => c.id === d.controlId);
  const result = gradeException(d, eng);
  const grade = result.grade;
  const ct = grade === 'Clearly Trivial';
  const material = d.magnitude >= M;
  const step = currentStep(d);
  const rounds = d.retests ?? [];
  const failures = rounds.filter(r => r.result === 'Fail').length;
  const readiness = retestReadiness(d, control, eng.periodEnd);
  const court = exceptionCourtDetail(d, eng);
  // ② Severity is the auditor's throughout, so the inputs stay live while the
  // exception is still on the audit side — including during the reviewer's
  // confirmation, which is a conversation about the grade and often changes it.
  // Once the owner has it the numbers freeze: re-grading a fix already underway
  // moves the goalposts. A grade that does move loses its confirmation, which
  // `updateDeficiency` handles, so the reviewer never silently owns a number
  // they did not agree.
  const sizing = isAuditor && !locked && (d.status === 'Identified' || d.status === 'Rating review');
  const r = d.remediation;
  const planReady = !!r.action.trim() && !!r.owner.trim() && !!r.date;

  return (
    <>
      <div ref={cardRef} className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
        {/* The whole header strip is the toggle — a card this tall needs a
            target bigger than a chevron. A div rather than a button because
            the control link inside it is itself a button, and a button
            inside a button is invalid; same role/tabIndex/onKeyDown pattern
            the audit register rows use. */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${d.id}`}
          onClick={() => setOpen(o => !o)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
          className="cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 flex-wrap min-w-0">
              {/* Down to open, up to close. Deliberately NOT a rotating
                  right-chevron: '›' is the app's drill-in mark (the handoff
                  rows above use it to leave the page), and this opens in
                  place. The pair also states which way the card is about to
                  move, which one rotating glyph only implies. */}
              {open
                ? <ChevronUp size={15} className="shrink-0 text-brand-700" />
                : <ChevronDown size={15} className="shrink-0 text-ink-400" />}
              <span className="font-mono text-[12px] font-semibold text-ink-600">{d.id}</span>
              {/* stopPropagation: opening the control is a different journey
                  from opening the card, and the two must not fire together */}
              {/* …and on the control's own paper that journey is a circle, so the
                  id stays as a label there rather than a link back to here */}
              {showControlLink
                ? <button onClick={e => { e.stopPropagation(); openControl(d.controlId); }} className="font-mono text-[12px] text-brand-700 hover:underline cursor-pointer">{d.controlId}</button>
                : <span className="font-mono text-[12px] text-ink-500">{d.controlId}</span>}
              <Pill tone={d.track === 'design' ? 'mitigated' : 'evidence'}>{d.track === 'design' ? 'Design' : 'Operating'}</Pill>
              {/* PARKED (Aug 2026) — the Gap type pill and the priced-impact teaser.
                  Manual vs IT is already settled by the control's nature, design vs
                  operating by the track pill beside this, and priced impact is an
                  internal-audit number that was never ICFR magnitude. */}
              {/* A fix that has missed twice is not a remediation problem any more,
                  so the count rides the collapsed row where triage happens. */}
              {failures >= 2 && <Pill tone="risk">{failures} failed retests</Pill>}
            </div>
            <div className="inline-flex items-center gap-2 shrink-0"><Pill tone={STATUS_TONE[d.status]}>{d.status}</Pill><SeverityPill s={grade} /></div>
          </div>
          {/* The finding itself stays on the collapsed row — clamped to one
              line. Without it the row reads as an id and some pills, and you
              would have to open every card to find the one you wanted. */}
          <p className={cn('text-[13px] text-ink-800 leading-relaxed mt-2.5', !open && 'truncate')}>{d.description}</p>
        </div>

        {open && (<>
        {/* ① The mechanism — what has to change for the fix to be a fix. It sits at
            the top of the card because everything below is judged against it: the
            plan at ③, and the auditor's one question at plan review. */}
        <div className="mt-2.5 rounded-lg border border-canvas-border bg-paper-50/40 px-3 py-2.5">
          <div className="text-[0.65625rem] uppercase tracking-wide font-semibold text-ink-400 mb-1">Root cause</div>
          {sizing ? (
            <>
              <textarea value={d.rootCause} onChange={e => updateDeficiency(d.id, { rootCause: e.target.value })} rows={2}
                placeholder="The mechanism, not the count — “the system allows manual posting that bypasses approval”, not “3 of 25 lacked approval”"
                className="w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 resize-none focus:outline-none focus:border-brand-300" />
              {!d.rootCause.trim() && <p className="text-[0.65625rem] text-mitigated-700 mt-1">Needed before this can be sized — the grade and the plan both hang off it.</p>}
            </>
          ) : (
            <p className="text-[0.78125rem] text-ink-700">{d.rootCause || <span className="text-ink-400">Not written yet.</span>}</p>
          )}
          {d.failedSamples && d.failedSamples.length > 0 && (
            <p className="text-[0.6875rem] text-ink-400 mt-1.5">Found in {d.failedSamples.slice(0, 6).join(', ')}{d.failedSamples.length > 6 ? ` +${d.failedSamples.length - 6} more` : ''}</p>
          )}
          {d.unableToTestReason && (
            <p className="text-[0.6875rem] text-high-700 mt-1.5"><b className="font-semibold">Never evidenced</b> — {d.unableToTestReason}</p>
          )}
        </div>

        {/* the six steps */}
        <div className="flex items-center gap-1.5 my-3">
          {EXCEPTION_STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5 flex-1 last:flex-none">
              <span className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap', s.n < step ? 'bg-compliant-50 text-compliant-700' : s.n === step ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-400')}>
                {s.n < step ? <CheckCircle2 size={12} /> : <span className="w-[14px] text-center">{s.n}</span>}{s.title}
              </span>
              {i < EXCEPTION_STEPS.length - 1 && <span className={cn('h-px flex-1', s.n < step ? 'bg-compliant-300' : 'bg-paper-200')} />}
            </div>
          ))}
        </div>

        {/* ─── Current state — whose court, and what they are doing with it ─────
            The same baton the control's own paper carries, answered for an
            exception. The stepper says where it has got to; this says who is
            holding it up, by name — a role cannot be chased for an answer. It
            replaces the per-status "with X" lines that used to sit down beside
            the buttons, so the fact is stated once and in one place. */}
        <div className="flex items-center gap-2.5 flex-wrap rounded-lg border border-canvas-border bg-paper-50/40 px-3 py-2">
          <span className="text-[0.65625rem] font-semibold text-ink-400 uppercase tracking-wide">Current state</span>
          <CourtBadge court={courtForException(d)} fromRole={role} />
          {d.status === 'Closed'
            ? <span className="text-[0.75rem] text-ink-600">Signed off by <b className="font-semibold text-ink-800">{court.who}</b></span>
            : <span className="text-[0.75rem] text-ink-600"><b className="font-semibold text-ink-800">{court.who}</b> — {court.doing}</span>}
          <span className="ml-auto text-[0.71875rem] font-semibold text-ink-400">Step {step} of 6 · {d.status}</span>
        </div>

        {/* severity + the fix — the owner's card leads with THEIR work (visual reverse) */}
        <div className={cn('mt-3 flex flex-col gap-3', isOwner && 'flex-col-reverse')}>
        {/* ② Sizing — the auditor's, and only while it is still with them. Once the
            rating has gone up for confirmation it is a record, not a form. */}
        {sizing ? (
          <div className="rounded-lg border border-canvas-border p-3 space-y-2.5">
            <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Severity inputs — recomputed live vs the ground rules</div>
            {d.ratingReturn && (
              <div className="rounded-md border border-high-200 bg-high-50/60 px-2.5 py-2 text-[0.75rem] text-high-800">
                <b className="font-semibold">Sent back by {d.ratingReturn.by}</b> — {d.ratingReturn.reason}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap text-[12px]">
              <span className="text-ink-500 w-[120px]">Likelihood</span>
              {(['Remote', 'Reasonably possible', 'Probable'] as const).map(l => (
                <button key={l} onClick={() => updateDeficiency(d.id, { likelihood: l })} className={cn('h-7 px-2.5 rounded-md border text-[11.5px] font-semibold cursor-pointer transition-colors', d.likelihood === l ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-ink-500 w-[120px]">Exposure ₹</span>
              <input type="number" value={d.magnitude} onChange={e => updateDeficiency(d.id, { magnitude: Number(e.target.value) || 0 })} aria-label="Exposure in rupees" className="h-8 w-44 px-2.5 rounded-md border border-canvas-border text-[0.78125rem] tabular-nums focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
              <span className={cn('text-[11.5px]', material ? 'text-risk-700 font-semibold' : 'text-ink-400')}>{material ? '≥' : '<'} materiality {fmt(M)}{ct ? ' · clearly trivial' : ''}</span>
            </div>
            <p className="text-[10.5px] text-ink-400 pl-[128px] -mt-1">What <b className="font-semibold text-ink-500">could</b> have slipped through while the control was broken — not the error actually found.</p>
            <div className="flex items-start gap-2 text-[12px] flex-wrap">
              <span className="text-ink-500 w-[120px] mt-1">MW indicators</span>
              {MW_INDICATORS.map(ind => { const on = d.mwIndicators.includes(ind); return <button key={ind} onClick={() => updateDeficiency(d.id, { mwIndicators: on ? d.mwIndicators.filter(x => x !== ind) : [...d.mwIndicators, ind] })} title={ind} className={cn('h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors text-left', on ? 'bg-risk-50 border-risk-200 text-risk-700' : 'border-canvas-border text-ink-500 hover:bg-paper-50')}>{ind.length > 36 ? ind.slice(0, 34) + '…' : ind}</button>; })}
            </div>
            <div className="flex items-center gap-2 text-[12px] flex-wrap">
              <span className="text-ink-500 w-[120px]">Compensating control</span>
              <FormSelect value={d.compensatingControlId ?? ''} onChange={v => updateDeficiency(d.id, { compensatingControlId: v || undefined })}
                options={[{ value: '', label: 'None' }, ...eng.controls.filter(c => c.id !== d.controlId).map(c => { const short = c.description.length > 42 ? c.description.slice(0, 40).trimEnd() + '…' : c.description; return { value: c.id, label: `${c.id} — ${short}` }; })]}
                className="h-8 max-w-[300px] px-2.5 rounded-md border border-canvas-border text-[12px] bg-canvas-elevated focus:outline-none focus:border-brand-300"
                menuCls="w-[340px]" ariaLabel="Compensating control" />
              {d.compensatingControlId && (
                result.cap ? <span className="text-compliant-700 text-[0.6875rem] font-semibold">capping Material Weakness → Significant Deficiency — never clears the exception</span>
                : result.capBlocked === 'not-effective' ? <span className="text-high-700 text-[0.6875rem] font-semibold">no cap — {d.compensatingControlId} isn't concluded effective in this engagement</span>
                : result.capBlocked === 'mw-indicator' ? <span className="text-risk-700 text-[0.6875rem] font-semibold">no cap — MW indicators can't be argued down</span>
                : <span className="text-ink-400 text-[11px]">in place — the cap only rescues a Material Weakness grade, and never clears the exception</span>
              )}
            </div>
            {/* Aggregation. Process and assertion come off the control and the
                attributes that failed, so they are shown, not asked. The only thing
                the auditor has to state is a shared MECHANISM — free prose cannot
                be matched, so it is named by pointing at the other exception. */}
            <div className="flex items-start gap-2 text-[0.75rem] flex-wrap">
              <span className="text-ink-500 w-[120px] mt-1.5">Aggregation</span>
              <div className="flex-1 min-w-[260px] space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {aggregationKeys(d, eng).map(k => (
                    <span key={k.key} className="inline-flex items-center h-6 px-2 rounded-md bg-paper-100 text-[0.65625rem] font-semibold text-ink-600">{k.kind} · {k.key.split(':')[1]}</span>
                  ))}
                  <span className="text-[0.65625rem] text-ink-400">derived — not asked</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <FormSelect value={d.rootCauseLinkId ?? ''} onChange={v => updateDeficiency(d.id, { rootCauseLinkId: v || undefined })}
                    options={[{ value: '', label: 'Not linked' }, ...linkOptions]}
                    className="h-8 px-2.5 rounded-md border border-canvas-border text-[0.75rem] bg-canvas-elevated focus:outline-none focus:border-brand-300"
                    ariaLabel="Same root cause as" />
                  <span className="text-ink-400 text-[0.6875rem]">same root cause as — links two exceptions the derivation can't see</span>
                </div>
              </div>
            </div>
            <PrudentRow d={d} baseFinal={gradeException({ ...d, prudentOverride: undefined }, eng).grade}
              onApply={(to, rationale) => updateDeficiency(d.id, { prudentOverride: { to, rationale, by: me, at: 'just now' } })}
              onClear={() => updateDeficiency(d.id, { prudentOverride: undefined })} />
            <SeverityConclusion result={result} showMateriality />
          </div>
        ) : (
          <div className="rounded-lg border border-canvas-border bg-paper-50/30 p-3 space-y-1.5">
            <div className="text-[0.65625rem] uppercase tracking-wide text-ink-400 font-semibold">Severity — evaluated by the auditor{isOwner ? '; your part is the fix below' : ''}</div>
            <div className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
              <span className="text-ink-700"><span className="text-ink-400">Likelihood</span> · {d.likelihood}</span>
              <span className="text-ink-700"><span className="text-ink-400">Exposure</span> · {fmt(d.magnitude)}{ct ? ' (clearly trivial)' : ''}</span>
              <span className="text-ink-700"><span className="text-ink-400">MW indicators</span> · {d.mwIndicators.length ? `${d.mwIndicators.length} in force` : 'None'}</span>
              <span className="text-ink-700"><span className="text-ink-400">Compensating control</span> · {d.compensatingControlId ?? 'None'}</span>
              {/* "Nothing else" and "never asked" are different answers, and only
                  one of them is a result. When rule 1 or rule 3 settles the grade
                  the ladder stops before aggregation is reached, so this says the
                  rule that stopped it rather than reporting an empty search. */}
              <span className="text-ink-700"><span className="text-ink-400">Aggregates with</span> · {
                !result.working.some(w => w.n === 6)
                  ? (d.mwIndicators.length > 0 ? 'not reached — an indicator settled it at rule 1' : 'not reached — the exposure is clearly trivial')
                  : result.aggregate
                    ? `${result.aggregate.members - 1} more, sharing ${result.aggregate.sharedBy}`
                    : 'nothing else shares its process, assertion or root cause'
              }</span>
              {control && <span className="text-ink-700"><span className="text-ink-400">Gap nature</span> · {gapNature(d.track, control.nature)}</span>}
              {d.prudentOverride && <span className="text-high-700 font-medium sm:col-span-2">Prudent-official — raised to {d.prudentOverride.to}</span>}
            </div>
            {/* the owner sees their classification, never the engagement's thresholds */}
            <SeverityConclusion result={result} showMateriality={!isOwner} />
          </div>
        )}

        {/* The reviewer's confirmation, once it exists — the grade is agreed, and
            the record says by whom.
            A confirmation is agreement to a NUMBER, not to a field, and the number
            can move without anyone touching this exception: aggregation reads the
            whole engagement, so a new finding elsewhere sharing its process or
            assertion re-grades it. When that happens the old signature is stale,
            and showing it beside a different conclusion would put two grades on
            one card and let the reviewer own one they never saw. */}
        {d.ratingConfirm && (
          d.ratingConfirm.grade === grade ? (
            <p className="text-[0.71875rem] text-compliant-700 font-semibold inline-flex items-center gap-1.5"><ShieldCheck size={12} /> Rated {d.ratingConfirm.grade}, confirmed by {d.ratingConfirm.by}</p>
          ) : (
            <div className="rounded-lg border border-high-200 bg-high-50/60 px-3 py-2 text-[0.75rem] text-high-800 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-[2px] shrink-0" />
              <span className="min-w-0">
                <b className="font-semibold">The confirmed rating no longer matches.</b> {d.ratingConfirm.by} confirmed this as {d.ratingConfirm.grade}; it now grades <b className="font-semibold">{grade}</b>
                {result.aggregate?.raised ? ' after combining with other exceptions' : ''}. It needs confirming again.
              </span>
            </div>
          )
        )}

        {/* ③④ The fix. Nothing to show before the exception reaches the owner —
            there is no plan to read while it is still being graded. */}
        {step >= 3 && (
          <PlanBlock d={d} isOwner={isOwner} locked={locked} onPatch={patch => updateRemediation(d.id, patch)} onAttach={name => addRemediationEvidence(d.id, name)} />
        )}

        {/* When it can actually be retested — and the warning when that is after the
            books close, raised now while a date can still be moved. */}
        {step >= 3 && d.status !== 'Closed' && <RetestReadyLine readiness={readiness} />}

        {/* ⑤ The retest itself — the auditor's grid, in their hat only. */}
        {!locked && d.status === 'Retest' && isAuditor && <RetestPanel d={d} />}

        <RetestHistory rounds={rounds} />
        </div>

        {/* One role per state. Whatever this hat cannot do is ABSENT here, not
            greyed out — a disabled button teaches you the shape of someone else's
            job. What everyone does get is a plain line saying whose court it is in,
            because "nothing to do" and "nothing happening" are different answers. */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {/* ② the auditor finishes sizing */}
          {!locked && d.status === 'Identified' && (
            isAuditor ? (
              d.rootCause.trim()
                ? <button onClick={() => completeSizing(d.id)} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5">
                    <Scale size={13} /> {needsRatingConfirmation(grade) ? `Rated ${grade} — send to the reviewer` : `Rated ${grade} — hand to ${d.remediation.owner}`}
                  </button>
                : <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1.5"><Info size={14} className="text-ink-400" /> Write the root cause first — the grade and the plan both hang off it.</span>
            ) : null
          )}

          {/* ② blocking confirmation: significant or worse does not move until the
              reviewer agrees the grade */}
          {!locked && d.status === 'Rating review' && (
            isReviewer ? (
              rejecting === 'rating' ? (
                <div className="flex items-center gap-2 flex-wrap w-full">
                  <input autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="Why the grade is wrong — the auditor rewrites it against this"
                    className="h-8 flex-1 min-w-[240px] px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] focus:outline-none focus:border-brand-300" />
                  <button disabled={!rejectReason.trim()} onClick={() => { returnRating(d.id, rejectReason.trim()); setRejecting(null); setRejectReason(''); }}
                    className="h-8 px-3 rounded-lg bg-high-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-high-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Send back</button>
                  <button onClick={() => { setRejecting(null); setRejectReason(''); }} className="h-8 px-2.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 cursor-pointer">Cancel</button>
                </div>
              ) : <>
                <button onClick={() => confirmRating(d.id)} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[0.75rem] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Confirm {grade}</button>
                <button onClick={() => { setRejecting('rating'); setRejectReason(''); }} className="h-8 px-3 rounded-lg border border-high-300 text-high-700 text-[0.75rem] font-semibold hover:bg-high-50 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Send back — reason required</button>
              </>
            ) : <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-ink-400" /> Blocked — no fix starts until the {grade} rating is confirmed</span>
          )}

          {/* ③ the owner writes the plan */}
          {!locked && d.status === 'Planning' && (
            isOwner ? (
              planReady
                ? <button onClick={() => submitPlan(d.id)} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><ArrowRight size={13} /> Submit the plan for review</button>
                : <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1.5"><Info size={14} className="text-ink-400" /> The action, who does it and a due date — all three before it can go up.</span>
            ) : null
          )}

          {/* ③ the auditor's one say in the plan: does it address the root cause? */}
          {!locked && d.status === 'Plan review' && (
            isAuditor ? (
              rejecting === 'plan' ? (
                <div className="flex items-center gap-2 flex-wrap w-full">
                  <input autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="What it misses about the root cause — the owner rewrites the plan against this"
                    className="h-8 flex-1 min-w-[240px] px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] focus:outline-none focus:border-brand-300" />
                  <button disabled={!rejectReason.trim()} onClick={() => { reviewPlan(d.id, 'Rejected', rejectReason.trim()); setRejecting(null); setRejectReason(''); }}
                    className="h-8 px-3 rounded-lg bg-high-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-high-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Send back</button>
                  <button onClick={() => { setRejecting(null); setRejectReason(''); }} className="h-8 px-2.5 rounded-lg border border-canvas-border text-[0.75rem] font-semibold text-ink-600 cursor-pointer">Cancel</button>
                </div>
              ) : <>
                <span className="text-[0.71875rem] text-ink-500 w-full">Does this address the root cause? You judge the plan — you never write or execute it.</span>
                <button onClick={() => reviewPlan(d.id, 'Accepted')} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[0.75rem] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Accept the plan</button>
                <button onClick={() => { setRejecting('plan'); setRejectReason(''); }} className="h-8 px-3 rounded-lg border border-high-300 text-high-700 text-[0.75rem] font-semibold hover:bg-high-50 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reject — reason required</button>
              </>
            ) : null
          )}

          {/* ④ the owner does the work, and "done" needs proof: this is the one gate
              the flow keeps as a disabled button rather than an absent one, because
              it is the owner's OWN action they have not finished qualifying for */}
          {!locked && d.status === 'Remediation' && (
            isOwner
              ? (() => {
                  const hasEvidence = (d.remediation.evidence?.length ?? 0) > 0;
                  return (
                    <button onClick={() => setExceptionStatus(d.id, 'Retest')} disabled={!hasEvidence}
                      title={hasEvidence ? 'Marks your fix as done and hands it to the auditor' : 'Attach evidence of the fix first — "done" needs proof'}
                      className="h-8 px-3 rounded-lg bg-evidence-600 text-white text-[0.75rem] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5">Fixed — submit for retest</button>
                  );
                })()
              : null
          )}

          {/* ⑤ the retest is the auditor's; the panel above carries its actions */}
          {!locked && d.status === 'Retest' && isOwner && (
            <span className="text-[0.75rem] text-ink-500 inline-flex items-center gap-1.5"><Target size={14} className="text-ink-400" /> You never test your own fix — the auditor retests it.</span>
          )}

          {/* ⑥ four-eyes: only the reviewer hat closes, and never the person who ran the retest */}
          {!locked && d.status === 'Awaiting reviewer' && (
            !isReviewer ? (
              <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-ink-400" /> Awaiting reviewer — only the reviewer closes{d.retest ? ` (retest ${d.retest.result} · ${d.retest.by})` : ''}</span>
            ) : d.retest && d.retest.by === me ? (
              <span className="text-[12px] font-semibold text-high-700 inline-flex items-center gap-1.5"><XCircle size={14} /> A different person must close — you recorded this retest.</span>
            ) : (
              <button onClick={() => setClosing(true)} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
            )
          )}
          {d.status === 'Closed' && d.signoff && <span className="text-[12px] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Closed — signed off by {d.signoff.by}</span>}
          {/* the way back in: audit-side only, never one-click — the reason is the record */}
          {!locked && !isOwner && d.status === 'Closed' && (
            <button onClick={() => { setReopening(true); setReopenReason(''); }}
              className="h-8 px-3 rounded-lg border border-high-300 text-high-700 text-[12px] font-semibold hover:bg-high-50 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reopen — reason required</button>
          )}
        </div>
        </>)}
      </div>

      {/* Attest confirm — closing is the terminal four-eyes act, so it never
          commits on a bare click. Portalled: this card also renders inside the
          control's paper, under animated ancestors that would otherwise become
          the containing block for a fixed backdrop. */}
      {closing && createPortal(
        <div className="modal-backdrop" onClick={() => setClosing(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900">Close this {W.one}?</h2>
                <button onClick={() => setClosing(false)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed">Confirm — close <span className="font-mono font-semibold text-ink-800">{d.id}</span>? Your reviewer sign-off is recorded against it. Closing is the final act in the four-eyes review — it comes back only through a reopen with a recorded reason.</p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setClosing(false)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={() => { signOffException(d.id); setClosing(false); }} className="h-9 px-3.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* reopen — the mirror of the close: same weight, same portal, and the reason IS the record */}
      {reopening && createPortal(
        <div className="modal-backdrop" onClick={() => setReopening(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900 inline-flex items-center gap-2"><RotateCcw size={15} className="text-high-700" /> Reopen this exception?</h2>
                <button onClick={() => setReopening(false)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed"><span className="font-mono font-semibold text-ink-800">{d.id}</span> returns to Remediation — the reviewer sign-off and retest clear, and your reason goes on the trail with your name.</p>
              <textarea autoFocus value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={2}
                placeholder="Why it comes back — e.g. the fix regressed, or new occurrences surfaced"
                className="mt-3 w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setReopening(false)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button disabled={!reopenReason.trim()}
                  onClick={() => { reopenException(d.id, reopenReason.trim()); setReopening(false); addToast({ type: 'warning', title: 'Reopened', message: `${d.id} is back in remediation — the trail records why.` }); }}
                  className="h-9 px-3.5 rounded-lg bg-high-600 text-white text-[12.5px] font-semibold enabled:hover:bg-high-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reopen</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
