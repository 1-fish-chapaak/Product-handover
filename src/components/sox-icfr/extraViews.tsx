import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Building2, ChevronDown, ChevronRight, ChevronUp, Circle, Download, History, Info, Lightbulb, Lock, MessageSquare, MessageSquareWarning, Paperclip, Sparkles, Target, ShieldCheck, AlertTriangle, RotateCcw, Scale, CheckCircle2, Upload, X, XCircle, FileWarning, Sliders, GitMerge, Route } from 'lucide-react';
import { useIcfr } from './store';
import { defWord } from './flow';
import { useToast } from '../shared/Toast';
import { aggregationKeys, courtForException, exceptionCourtDetail, formatINR, gradeException, isClearlyTrivial, isEngagementLocked, needsRatingConfirmation, previewRegrades, retestReadiness, type ExceptionGradeResult, type RetestReadiness, type RulesPatch } from './helpers';
import { CourtBadge, SeverityPill, Toggle } from './parts';
import { FormSelect, HeaderFilter } from '../shared/FilterSelect';
import MaterialityWorksheet from './MaterialityWorksheet';
import ConfirmationModal from '../shared/ConfirmationModal';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
// PARKED (Aug 2026): EXPOSURE_LABEL, exposureTotal, GAP_HINT, GAP_LABEL and the
// Exposure / GapType types — priced impact and the gap taxonomy are off the card.
// `gapNature` replaces the latter, derived read-only from the track and the nature.
import RemediationBriefModal from './RemediationBriefModal';
import { CHALLENGED_INPUT_LABEL, EXCEPTION_STEPS, gapNature, GRADE_RANK, MW_INDICATOR_CATALOGUE, SEVERITY_URGENCY, type Assertion, type ChallengedInput, type Court, type Deficiency, type ExceptionGrade, type ExceptionStatus, type IcfrEngagement, type RetestRound, type Severity, type SignificantAccount, type TaskType } from './types';

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
  const { eng, role, updateRules, applyRules } = useIcfr();
  const M = eng.materiality; const r = eng.rules;
  const locked = !!eng.materialityBasis?.lockedAt;
  const pm = eng.performanceMateriality;
  const ctt = r.clearlyTrivial;
  const pmPct = M ? Math.round((pm / M) * 100) : 0;
  const cttPct = M ? Math.round((ctt / M) * 100) : 0;

  // ── the four grading thresholds edit as a DRAFT ──────────────────────────────
  // Restored Aug 2026 (Step-2 action item 24). These four numbers ARE the grading
  // basis: severity is computed on read from live state, so moving one silently
  // re-grades every open exception across the register, the reviewer queue, the
  // working paper and the engagement conclusion. Editing them straight into the
  // store — which is what the 23 Jul merge left behind — is a change nobody
  // authorised, nobody explained and nobody can find afterwards.
  //
  // So nothing here touches the engagement until it has been reviewed against the
  // exceptions it would move and given a reason. applyRules writes both.
  const saved = useMemo(() => ({ M, pm, ctt, band: r.sdBandPct }), [M, pm, ctt, r.sdBandPct]);
  const [draft, setDraft] = useState(saved);
  const [reviewing, setReviewing] = useState(false);
  // Somebody else moved the thresholds (another audit on this engagement, or a
  // reset) — the draft is stale, not a pending edit. Rebase rather than fight it.
  const [savedSeed, setSavedSeed] = useState(saved);
  if (savedSeed !== saved) { setSavedSeed(saved); setDraft(saved); }

  const dirty = draft.M !== saved.M || draft.pm !== saved.pm || draft.ctt !== saved.ctt || draft.band !== saved.band;
  const canEditRules = role === 'auditor' && !isEngagementLocked(eng);
  const patch: RulesPatch = { materiality: draft.M, performanceMateriality: draft.pm, clearlyTrivial: draft.ctt, sdBandPct: draft.band };
  // The ladder previews the DRAFT, so the bands move as you type — the point of
  // the review step is seeing the consequence before committing to it.
  const sd = draft.M * draft.band / 100;

  /** The edit waiting on a yes. Held as a thunk so the confirm doesn't need to
   *  know which of the settings it is about to change. Still used by the
   *  policies and MW indicators, which apply immediately: they do not shift a
   *  threshold, so there is no re-grade to preview. */
  const [pending, setPending] = useState<{ what: string; apply: () => void } | null>(null);
  const guard = (what: string, apply: () => void) => {
    if (!sharedWith?.length) { apply(); return; }
    setPending({ what, apply });
  };
  const setRules = (what: string, patch: Parameters<typeof updateRules>[0]) => guard(what, () => updateRules(patch));

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
            <Money label="Overall materiality" value={draft.M} readOnly={!canEditRules} onChange={v => setDraft(d => ({ ...d, M: v }))} hint="The financial-statement materiality benchmark." />
            <Money label="Performance materiality" value={draft.pm} readOnly={!canEditRules} onChange={v => setDraft(d => ({ ...d, pm: v }))} hint={`${pmPct}% of overall — the testing threshold.`} />
            <Money label="Clearly-trivial threshold" value={draft.ctt} readOnly={!canEditRules} onChange={v => setDraft(d => ({ ...d, ctt: v }))} hint={`${cttPct}% of overall — below this, logged but not evaluated.`} />
          </div>
        )}
      </section>

      {/* ── nothing has moved yet ───────────────────────────────────────────────
          Appears only once a threshold is actually different. It says what is
          pending rather than just offering a button, because the fields above
          look committed the moment you finish typing in them. */}
      {dirty && !eng.materialityBasis && (
        <div className="rounded-xl border border-mitigated-200 bg-mitigated-50/40 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[0.75rem] text-mitigated-800 leading-relaxed min-w-0 inline-flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span><span className="font-bold">Not saved yet.</span> These are the grading basis — moving them re-grades exceptions that were already concluded, so the change is reviewed against them first.</span>
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setDraft(saved)} className="h-9 px-3.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] font-semibold text-ink-600 hover:border-ink-300 transition-colors cursor-pointer">Discard</button>
            <button onClick={() => setReviewing(true)} className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"><Scale size={14} /> Review &amp; apply</button>
          </div>
        </div>
      )}
      {reviewing && <RulesReviewModal eng={eng} patch={patch} onClose={() => setReviewing(false)} onApply={reason => { applyRules(patch, reason); setReviewing(false); }} />}

      {/* severity ladder */}
      <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Exception severity ladder</h2>
          <label className="inline-flex items-center gap-2 text-[0.75rem] text-ink-600"><Sliders size={13} /> Significant-deficiency band
            {canEditRules
              ? <input type="number" min={1} max={100} value={draft.band} onChange={e => setDraft(d => ({ ...d, band: Math.max(1, Math.min(100, +e.target.value || 0)) }))} className="h-8 w-16 px-2 rounded-lg border border-canvas-border text-[0.78125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
              : <b className="font-semibold tabular-nums text-ink-800">{draft.band}</b>}
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
          {/* Absent, not disabled — the rule the deficiency screens already
              follow. The store has always refused these writes from anyone but
              the auditor, so a reviewer clicking a live switch got silence: the
              same no-op the risk owner's Conclude buttons used to give. What a
              hat cannot do, it is not shown. */}
          {canEditRules
            ? <Toggle on={r.aggregate} onChange={v => setRules('aggregation', { aggregate: v })} label="Aggregation" />
            : <Pill tone={r.aggregate ? 'compliant' : 'draft'}>{r.aggregate ? 'On' : 'Off'}</Pill>}
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Route size={14} className="text-brand-600" /> Auto-routing</div><p className="text-[0.75rem] text-ink-500 mt-1">Route an exception to the owner (remediation) or the auditor (sign-off) by computed severity.</p></div>
          {canEditRules
            ? <Toggle on={r.autoRoute} onChange={v => setRules('auto-routing', { autoRoute: v })} label="Auto-routing" />
            : <Pill tone={r.autoRoute ? 'compliant' : 'draft'}>{r.autoRoute ? 'On' : 'Off'}</Pill>}
        </div>
      </section>

      {/* MW indicators */}
      <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-1"><AlertTriangle size={15} className="text-risk-600" /> Material-weakness indicators</h2>
        <p className="text-[0.75rem] text-ink-500 mb-3">If any in-force indicator is present on an exception, it is a material weakness regardless of magnitude.</p>
        <div className="space-y-1.5">
          {/* Same rule as the toggles above: only the auditor gets a control.
              Everyone else reads which indicators are in force, because that is
              a fact of the engagement they are entitled to — it is the ability
              to change it that is not theirs. */}
          {MW_INDICATOR_CATALOGUE.map(ind => {
            const on = r.mwIndicators.includes(ind);
            const body = (
              <>
                <span className={cn('w-[18px] h-[18px] rounded-sm border flex items-center justify-center shrink-0', on ? 'bg-risk-600 border-risk-600 text-white' : 'border-ink-300')}>{on && <CheckCircle2 size={12} />}</span>
                <span className="text-[0.78125rem] text-ink-800">{ind}</span>
              </>
            );
            const shell = cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left', on ? 'border-risk-200 bg-risk-50/40' : 'border-canvas-border');
            return canEditRules ? (
              <button key={ind} onClick={() => setRules('the material-weakness indicators', { mwIndicators: on ? r.mwIndicators.filter(x => x !== ind) : [...r.mwIndicators, ind] })}
                className={cn(shell, 'transition-colors cursor-pointer', !on && 'hover:border-ink-300')}>{body}</button>
            ) : (
              <div key={ind} className={shell}>{body}</div>
            );
          })}
        </div>
      </section>

      {/* ── what the thresholds used to be ──────────────────────────────────────
          The log was written by applyRules from the day it was built and read by
          nothing, so a change that re-graded a finding left no trace anyone could
          follow. It is on this page rather than the audit trail because the
          question it answers — "was this always the number?" — is asked here. */}
      {eng.rulesLog.length > 0 && (
        <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
          <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-1"><History size={15} className="text-brand-600" /> Changes to the ground rules</h2>
          <p className="text-[0.75rem] text-ink-500 mb-3">Every threshold change since the engagement opened, and the exceptions each one re-graded.</p>
          <div className="space-y-2.5">
            {eng.rulesLog.map(entry => (
              <div key={entry.id} className="rounded-xl border border-canvas-border bg-paper-50/50 px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-[0.78125rem] font-semibold text-ink-800">
                    {entry.changes.map(c => `${c.field} ${c.from} → ${c.to}`).join('  ·  ')}
                  </span>
                  <span className="text-[0.6875rem] text-ink-400 shrink-0">{entry.by} · {entry.at}</span>
                </div>
                <p className="text-[0.71875rem] text-ink-600 leading-relaxed mt-1"><span className="text-ink-400">Why</span> · {entry.reason}</p>
                {entry.regraded.length > 0 ? (
                  <div className="mt-2 pt-2 border-t border-canvas-border">
                    <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Re-graded {entry.regraded.length}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.regraded.map(g => (
                        <span key={g.defId} className="inline-flex items-center gap-1.5 rounded-md border border-canvas-border bg-canvas-elevated px-2 py-1 text-[0.65625rem] text-ink-600">
                          <span className="font-mono">{g.defId}</span>
                          <span className="text-ink-400">{g.from}</span>
                          <ArrowRight size={9} className="text-ink-300" />
                          <span className={cn('font-semibold', GRADE_RANK[g.to as ExceptionGrade] > GRADE_RANK[g.from as ExceptionGrade] ? 'text-risk-700' : 'text-compliant-700')}>{g.to}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[0.6875rem] text-ink-400">No exception changed grade.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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
function Money({ label, value, onChange, hint, readOnly }: { label: string; value: number; onChange: (v: number) => void; hint: string; readOnly?: boolean }) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold text-ink-500 mb-1.5">{label}</div>
      {readOnly ? (
        <div className="h-10 flex items-center text-[0.8125rem] tabular-nums font-semibold text-ink-800">{fmtFull(value)}</div>
      ) : (
        <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-ink-400 pointer-events-none">₹</span>
          <input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, +e.target.value || 0))} className="w-full h-10 pl-7 pr-3 rounded-lg border border-canvas-border text-[0.8125rem] tabular-nums text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
      )}
      <div className="text-[0.6875rem] text-ink-400 mt-1">{hint}</div>
    </div>
  );
}

/** Review &amp; apply — the guarded path for moving a grading threshold.
 *
 *  Rebuilt Aug 2026 (Step-2 action item 24). This modal existed, was deleted on
 *  20 Jul when the screen went read-only, and never came back when the 23 Jul
 *  merge made the fields editable again — which left the store's applyRules,
 *  previewRegrades and rulesLog fully built and completely unreachable, and the
 *  live inputs wired to the UNguarded mutators instead.
 *
 *  It shows the consequence before the commitment: which exceptions move grade,
 *  in which direction, and it will not apply without a reason. That reason and
 *  the re-grade list are what the rules log carries afterwards. */
function RulesReviewModal({ eng, patch, onClose, onApply }: { eng: IcfrEngagement; patch: RulesPatch; onClose: () => void; onApply: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const regrades = useMemo(() => previewRegrades(eng, patch), [eng, patch]);
  const rows: { field: string; from: string; to: string }[] = [
    { field: 'Overall materiality', from: fmtFull(eng.materiality), to: fmtFull(patch.materiality ?? eng.materiality) },
    { field: 'Performance materiality', from: fmtFull(eng.performanceMateriality), to: fmtFull(patch.performanceMateriality ?? eng.performanceMateriality) },
    { field: 'Clearly-trivial threshold', from: fmtFull(eng.rules.clearlyTrivial), to: fmtFull(patch.clearlyTrivial ?? eng.rules.clearlyTrivial) },
    { field: 'Significant-deficiency band', from: `${eng.rules.sdBandPct}%`, to: `${patch.sdBandPct ?? eng.rules.sdBandPct}%` },
  ].filter(x => x.from !== x.to);
  // Worse is worse: a threshold cut that promotes a finding to Material Weakness
  // is the case the reviewer has to see, so it is counted separately.
  const worse = regrades.filter(g => GRADE_RANK[g.to as ExceptionGrade] > GRADE_RANK[g.from as ExceptionGrade]).length;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-canvas-border">
          <h3 className="text-[0.875rem] font-bold text-ink-900 inline-flex items-center gap-2"><Scale size={16} className="text-brand-600" /> Review &amp; apply</h3>
          <p className="text-[0.75rem] text-ink-500 mt-1">Nothing has changed yet. This is what applying would do.</p>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">What changes</span>
            <div className="space-y-1">
              {rows.map(x => (
                <div key={x.field} className="flex items-center justify-between gap-3 rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2">
                  <span className="text-[0.75rem] text-ink-700">{x.field}</span>
                  <span className="text-[0.75rem] tabular-nums shrink-0"><span className="text-ink-400">{x.from}</span> <ArrowRight size={10} className="inline -mt-0.5 text-ink-300" /> <span className="font-bold text-ink-900">{x.to}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">
              {regrades.length === 0 ? 'Exceptions affected' : `Exceptions re-graded — ${regrades.length}${worse ? `, ${worse} more severe` : ''}`}
            </span>
            {regrades.length === 0 ? (
              <p className="text-[0.75rem] text-ink-500 leading-relaxed rounded-lg border border-compliant-200 bg-compliant-50/40 px-3 py-2.5">
                None. No open exception crosses a band at the new thresholds — this change is safe to make.
              </p>
            ) : (
              <>
                <p className="text-[0.71875rem] text-mitigated-800 leading-relaxed mb-2 inline-flex items-start gap-1.5">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>These were already concluded and graded. Applying re-grades them everywhere at once — the register, the reviewer queue, the working paper and the engagement conclusion.</span>
                </p>
                <div className="space-y-1">
                  {regrades.map(g => {
                    const d = eng.deficiencies.find(x => x.id === g.defId);
                    const up = GRADE_RANK[g.to as ExceptionGrade] > GRADE_RANK[g.from as ExceptionGrade];
                    return (
                      <div key={g.defId} className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2', up ? 'border-risk-200 bg-risk-50/40' : 'border-compliant-200 bg-compliant-50/30')}>
                        <span className="min-w-0">
                          <span className="font-mono text-[0.6875rem] text-ink-500">{g.defId}</span>
                          {d && <span className="block text-[0.71875rem] text-ink-700 truncate max-w-[300px]" title={d.description}>{d.controlId} · {d.description}</span>}
                        </span>
                        <span className="text-[0.71875rem] shrink-0"><span className="text-ink-400">{g.from}</span> <ArrowRight size={10} className="inline -mt-0.5 text-ink-300" /> <span className={cn('font-bold', up ? 'text-risk-700' : 'text-compliant-700')}>{g.to}</span></span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div>
            <span className="block text-[0.625rem] font-bold uppercase tracking-wider text-ink-400 mb-1.5">Why this is changing</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="e.g. the audited balance came in materially above the planning estimate, so overall materiality is re-cut on the final figure"
              className="w-full px-3 py-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.75rem] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-200" />
            <p className="text-[0.625rem] text-ink-400 mt-1">Recorded against the change, with your name and every exception it moved.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border bg-paper-50/40">
          <button onClick={onClose} className="h-9 px-3.5 text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
          <button disabled={!reason.trim()} title={reason.trim() ? undefined : 'A threshold change needs a reason on the record.'}
            onClick={() => onApply(reason.trim())}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Apply the change</button>
        </div>
      </div>
    </div>,
    document.body);
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

/** The register's columns. Widths are fixed on everything except the finding,
 *  which takes whatever is left — it is the only cell holding a sentence, and
 *  the rest are pills and one number that never need more room than they ask
 *  for. `DEF_COLS` is the colSpan an opened row's body sits across. */
const DEF_COL_W = { id: 152, track: 104, exposure: 116, severity: 176, status: 136, court: 158 };
const DEF_COLS = 7;

/** Filter menus read in the order the thing itself runs in — severity worst
 *  first (it is a ladder), stage in lifecycle order, court in the order the
 *  baton passes — never alphabetically, which would scatter both. */
const SEVERITY_ORDER = ['Material Weakness', 'Significant Deficiency', 'Deficiency', 'Clearly Trivial'] as const;
const STAGE_ORDER = ['Identified', 'Rating review', 'Planning', 'Plan review', 'Remediation', 'Retest', 'Awaiting reviewer', 'Closed'] as const;
const COURT_ORDER = ['auditor', 'risk-owner', 'reviewer', 'none'] as const;
const COURT_LABEL: Record<Court, string> = { auditor: 'Auditor', 'risk-owner': 'Risk owner', reviewer: 'Reviewer', none: 'Closed' };

export function DeficienciesView() {
  const { eng, role, meOwner, focusDefId } = useIcfr();
  // Classic engagements still call these exceptions; the rework renamed them.
  const W = defWord(eng.id);
  const isOwner = role === 'risk-owner';
  // a countersigned engagement is a sealed record — the store already drops
  // every write, so the page must say so and put its pens away
  const locked = isEngagementLocked(eng);
  // person-lane: the owner sees only exceptions riding their own controls
  const all = isOwner ? eng.deficiencies.filter(d => eng.controls.find(c => c.id === d.controlId)?.owner === meOwner) : eng.deficiencies;

  // ── Column filters ────────────────────────────────────────────────────────────
  // In the headers, like the control register's — the column IS the trigger, so a
  // filter is set where its effect is read rather than off a toolbar above.
  const [track, setTrack] = useState('All');
  const [severity, setSeverity] = useState('All');
  const [stage, setStage] = useState('All');
  const [court, setCourt] = useState('All');
  const clearFilters = () => { setTrack('All'); setSeverity('All'); setStage('All'); setCourt('All'); };
  const engaged = track !== 'All' || severity !== 'All' || stage !== 'All' || court !== 'All';

  // Severity is computed, not stored — the same grade the row shows, so the
  // filter can never disagree with the pill it filtered on.
  const graded = useMemo(() => all.map(d => ({
    d, grade: gradeException(d, eng).grade, court: courtForException(d),
  })), [all, eng]);

  // Only the values actually present are offered: a menu naming a stage no
  // finding is standing on is a filter that can only empty the table.
  const opts = <T extends string>(values: readonly T[], order: readonly T[]) =>
    ['All', ...order.filter(v => values.includes(v))];
  const trackOpts = opts(Array.from(new Set(all.map(d => d.track))), ['design', 'operating'] as const)
    .map(v => (v === 'All' ? v : { value: v, label: v === 'design' ? 'TOD' : 'TOE' }));
  const severityOpts = opts(Array.from(new Set(graded.map(g => g.grade))), SEVERITY_ORDER);
  const stageOpts = opts(Array.from(new Set(all.map(d => d.status))), STAGE_ORDER);
  const courtOpts = opts(Array.from(new Set(graded.map(g => g.court))), COURT_ORDER)
    .map(v => (v === 'All' ? v : { value: v, label: COURT_LABEL[v as Court] }));

  const rows = graded.filter(g =>
    (track === 'All' || g.d.track === track)
    && (severity === 'All' || g.grade === severity)
    && (stage === 'All' || g.d.status === stage)
    && (court === 'All' || g.court === court));

  return (
    <div className="space-y-3">
      {/* No page title or standfirst — the breadcrumb and the tab above already
          name this page (user ask, Aug 2026), and the aggregation strip that used
          to sit here went with them. What survives is the one thing neither of
          those says: that the record is sealed. */}
      {locked && (
        <p className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500 bg-paper-100 border border-canvas-border rounded-lg px-2.5 py-1.5">
          <Lock size={12} className="text-ink-400 shrink-0" />
          The engagement is countersigned, so this record is sealed — severity, remediation and stages are as they stood at conclusion.
        </p>
      )}

      {all.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 text-center text-ink-500">{isOwner ? `No ${W.many} on your controls.` : `No ${W.many} — all tested controls effective.`}</div>
      ) : (
        // The register. One row per finding, opening in place — the columns are
        // what makes a page of these triageable: severity, stage and whose court
        // it is in line up down the page instead of being re-found in each card.
        <div className="reg-wrap def-reg">
          <table className="border-collapse w-full" style={{ tableLayout: 'fixed', minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: DEF_COL_W.id }} />
              <col />
              <col style={{ width: DEF_COL_W.track }} />
              <col style={{ width: DEF_COL_W.exposure }} />
              <col style={{ width: DEF_COL_W.severity }} />
              <col style={{ width: DEF_COL_W.status }} />
              <col style={{ width: DEF_COL_W.court }} />
            </colgroup>
            <thead className="reg-head">
              <tr>
                <th>{W.one[0]!.toUpperCase() + W.one.slice(1)}</th>
                <th>Finding</th>
                <th title="A TOD gap is in how the control is built; a TOE gap is in how it ran">
                  <HeaderFilter label="Track" value={track} options={trackOpts} allLabel="All tracks" onChange={setTrack} ariaLabel="Filter by track" />
                </th>
                <th className="num" title="What could have slipped through while the control was broken — not the error actually found">Exposure</th>
                <th><HeaderFilter label="Severity" value={severity} options={severityOpts} allLabel="All severities" onChange={setSeverity} ariaLabel="Filter by severity" /></th>
                <th><HeaderFilter label="Stage" value={stage} options={stageOpts} allLabel="All stages" onChange={setStage} ariaLabel="Filter by stage" /></th>
                <th title="Whose move it is — the owner remediates, the auditor evaluates and retests, the reviewer closes">
                  <HeaderFilter label="Court" value={court} options={courtOpts} allLabel="Any court" onChange={setCourt} ariaLabel="Filter by court" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ d }) => <DeficiencyCard key={d.id} d={d} layout="row" defaultOpen={d.id === focusDefId} />)}
              {rows.length === 0 && (
                <tr><td colSpan={DEF_COLS} className="text-center py-16 text-ink-400 text-[13px]">
                  No {W.many} match these filters. <button onClick={clearFilters} className="text-brand-700 font-semibold hover:underline cursor-pointer">Clear filters</button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Only once a filter is on: with nothing set the table IS the count, and
          saying it twice is noise. */}
      {engaged && all.length > 0 && (
        <p className="text-[0.71875rem] text-ink-400">Showing {rows.length} of {all.length} {W.many}. <button onClick={clearFilters} className="text-brand-700 font-semibold hover:underline cursor-pointer">Clear filters</button></p>
      )}
    </div>
  );
}

/** ONE deficiency, opening in place — as a REGISTER ROW on the management page,
 *  or as a card on a control's own paper.
 *
 *  Lives here rather than inside DeficienciesView because the control's own paper
 *  shows it too: a control that concluded ineffective raises a deficiency, and the
 *  auditor standing on that paper should be able to grade it and plan the fix
 *  without leaving for another tab and finding their place again. Same body, same
 *  writes, same four-eyes rules, wherever it is opened from.
 *
 *  The two layouts differ only in the collapsed summary. On the management page a
 *  register is the right shape — the columns line up, so severity, stage and whose
 *  court it is in can be COMPARED down the page instead of re-read per card. On a
 *  control's paper there is only ever one of these and no column to line it up
 *  with, so it stays a card, and comes up open because you asked for it.
 *
 *  Expanded, one of these is most of a screen — severity inputs, MW indicators,
 *  the remediation plan and the lifecycle actions — so it opens under its own row
 *  rather than replacing it, and each row owns its open state and both confirm
 *  modals. Deliberately not an accordion: comparing two findings side by side is
 *  a real thing an auditor does, and snapping one shut to open another would take
 *  that away. */
export function DeficiencyCard({ d, defaultOpen = false, showControlLink = true, layout = 'card' }: { d: Deficiency; defaultOpen?: boolean; showControlLink?: boolean; layout?: 'card' | 'row' }) {
  const {
    eng, role, me, openControl, updateDeficiency, setExceptionStatus, completeSizing, confirmRating, returnRating,
    submitPlan, reviewPlan, signOffException, reopenException, updateRemediation, addRemediationEvidence,
    raiseChallenge, respondToChallenge, meOwner, focusDefId, clearFocusDef,
  } = useIcfr();
  const { addToast } = useToast();
  const W = defWord(eng.id);
  const M = eng.materiality;
  const [open, setOpen] = useState(defaultOpen);
  // Asked-for rows bring themselves into view. The focus is consumed on arrival:
  // it answers one click, and coming back to this page later should open nothing.
  const cardRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (!defaultOpen || focusDefId !== d.id) return;
    const t = window.setTimeout(() => {
      (cardRef.current ?? rowRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  // the owner's disagreement: which input, why, and optionally what proves it
  const [challenging, setChallenging] = useState(false);
  const [challengeInput, setChallengeInput] = useState<ChallengedInput>('exposure');
  const [challengeWhy, setChallengeWhy] = useState('');
  const [challengeFile, setChallengeFile] = useState('');
  // the auditor's answer to one of them — a reason is required either way
  const [answering, setAnswering] = useState<null | { id: string; decision: 'Accepted' | 'Declined' }>(null);
  const [answerReason, setAnswerReason] = useState('');
  // the owner's own copy of this exception, previewed before it is taken away
  const [briefOpen, setBriefOpen] = useState(false);
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

  // Down to open, up to close. Deliberately NOT a rotating right-chevron: '›' is
  // the app's drill-in mark (the handoff rows use it to leave the page), and this
  // opens in place. The pair also states which way the row is about to move,
  // which one rotating glyph only implies.
  const chevron = open
    ? <ChevronUp size={15} className="shrink-0 text-brand-700" />
    : <ChevronDown size={15} className="shrink-0 text-ink-400" />;
  // stopPropagation: opening the control is a different journey from opening the
  // row, and the two must not fire together. On the control's own paper that
  // journey is a circle, so the id stays a label there rather than a link back.
  const controlLink = showControlLink
    ? <button onClick={e => { e.stopPropagation(); openControl(d.controlId); }} className="font-mono text-[12px] text-brand-700 hover:underline cursor-pointer">{d.controlId}</button>
    : <span className="font-mono text-[12px] text-ink-500">{d.controlId}</span>;
  // The whole summary is the toggle — a body this tall needs a target bigger than
  // a chevron. Never a <button>, because the control link inside it is one and a
  // button inside a button is invalid; same role/tabIndex/onKeyDown pattern the
  // audit register rows use.
  const onToggleKey = (e: ReactKeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } };

  // The expanded body — identical in both layouts, so it is built once and
  // dropped either into the card or into a full-width row beneath this one.
  const detail = open ? (<>
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
            {/* ── the owner reads the numbers, and argues on the record ─────────
                404(a) is management's assessment of its own controls, and the
                process owner is management — they need the exposure to argue for
                budget and the likelihood to rank this against everything else on
                their desk. The hazard was never that they see the figures; it is
                that they talk the auditor down in a corridor and the grade moves
                with nothing on the paper. So the figures show, read-only, and the
                disagreement gets somewhere to go.

                Three things stay back. The RULER — materiality, the bands, the
                clearly-trivial floor — because plans start getting sized to clear
                a threshold rather than to fix a cause. The AGGREGATION GROUP,
                because it holds other people's findings from other processes.
                And WHICH MW INDICATOR fired: those name things like senior-
                management fraud, often about individuals and often unconfirmed,
                so the escalation shows and the reason does not. */}
            {isOwner ? (
              <>
                <div className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                  <span className="text-ink-700"><span className="text-ink-400">Classification</span> · <b className="font-semibold">{result.grade}</b></span>
                  <span className="text-ink-700"><span className="text-ink-400">Fix due</span> · {d.remediation.date ?? 'not set yet'}</span>
                  <span className="text-ink-700"><span className="text-ink-400">Exposure</span> · {fmt(d.magnitude)}</span>
                  <span className="text-ink-700"><span className="text-ink-400">Likelihood</span> · {d.likelihood}</span>
                  {/* Whether it actually bit, not merely whether it was named. A
                      cap that was blocked still gets said — "TRY-02 protects you"
                      is a false comfort when the grade stands — but never WHY it
                      was blocked, since the reason is a conclusion about someone
                      else's control. */}
                  {d.compensatingControlId && (
                    <span className="text-ink-700 sm:col-span-2">
                      <span className="text-ink-400">Compensating control</span> · {d.compensatingControlId} — {result.cap
                        ? 'it capped how far this grade could rise. It does not clear the exception.'
                        : 'considered, and it did not change the grade. A compensating control never clears an exception either way.'}
                    </span>
                  )}
                  {/* That it was escalated, never what escalated it. */}
                  {d.mwIndicators.length > 0 && (
                    <span className="text-high-700 font-medium sm:col-span-2">Escalated — a reportable condition was recorded against this control, which sets the grade whatever the exposure.</span>
                  )}
                </div>
                <p className="text-[0.75rem] text-ink-600">{SEVERITY_URGENCY[result.grade]}</p>
                {d.planReview?.decision === 'Rejected' && d.planReview.reason && (
                  <p className="text-[12px] text-risk-700"><span className="text-ink-400">Plan returned</span> · {d.planReview.reason}</p>
                )}
                {/* One action, and it changes nothing by itself — see the store. */}
                {!locked && d.status !== 'Closed' && !challenging && !d.challenges?.some(ch => !ch.response) && (
                  <button onClick={() => setChallenging(true)}
                    className="mt-1 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer">
                    <MessageSquareWarning size={12} /> Disagree with this assessment
                  </button>
                )}
                {challenging && (
                  <div className="mt-1 rounded-lg border border-high-200 bg-high-50/40 p-2.5 space-y-2">
                    <p className="text-[0.71875rem] text-ink-600">
                      This goes to the audit team as a tracked item. It does not change the rating on its own — they answer it, either way, with a reason.
                    </p>
                    <label className="block">
                      <span className="text-[0.65625rem] uppercase tracking-wide font-semibold text-ink-500">What do you dispute?</span>
                      <select value={challengeInput} onChange={e => setChallengeInput(e.target.value as ChallengedInput)}
                        className="mt-1 w-full px-2 py-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 focus:outline-none focus:border-brand-300">
                        {(Object.keys(CHALLENGED_INPUT_LABEL) as ChallengedInput[]).map(k => (
                          <option key={k} value={k}>{CHALLENGED_INPUT_LABEL[k]}</option>
                        ))}
                      </select>
                    </label>
                    <textarea value={challengeWhy} onChange={e => setChallengeWhy(e.target.value)} rows={3}
                      placeholder="Why the number is wrong, and what it should be instead"
                      className="w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 resize-none focus:outline-none focus:border-brand-300" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <input value={challengeFile} onChange={e => setChallengeFile(e.target.value)}
                        placeholder="Supporting file (optional)"
                        className="flex-1 min-w-[180px] px-2 py-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] text-ink-800 focus:outline-none focus:border-brand-300" />
                      <button disabled={!challengeWhy.trim()}
                        onClick={() => { raiseChallenge(d.id, challengeInput, challengeWhy, challengeFile.trim() || undefined); setChallenging(false); setChallengeWhy(''); setChallengeFile(''); }}
                        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-brand-600 text-white text-[0.71875rem] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                        Send to the audit team
                      </button>
                      <button onClick={() => { setChallenging(false); setChallengeWhy(''); setChallengeFile(''); }}
                        className="h-7 px-2.5 rounded-md text-[0.71875rem] text-ink-500 hover:text-ink-700 cursor-pointer">Cancel</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
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
            )}
            {/* The rule-by-rule working shows the thresholds being applied, so it
                is the auditor's and the reviewer's view only. */}
            {!isOwner && <SeverityConclusion result={result} showMateriality />}
          </div>
        )}

        {/* ── The argument about the grade, kept where the grade is ─────────────
            Every role reads this, and that is the point: the reviewer confirming
            a rating can see it was contested and how it was answered, which is
            exactly what an informal conversation never leaves behind. */}
        {(d.challenges?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-canvas-border px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-wide font-semibold text-ink-500">
              <MessageSquareWarning size={12} /> Challenges to this assessment
              <span className="normal-case tracking-normal font-medium text-ink-500">{d.challenges!.length}</span>
            </div>
            {d.challenges!.map(ch => (
              <div key={ch.id} className="text-[0.75rem] text-ink-700 border-l-2 border-high-200 pl-2.5">
                <p>
                  <b className="font-semibold">{ch.by}</b> disputed the <b className="font-semibold">{ch.input}</b>
                  <span className="text-ink-400"> · {ch.at} · graded {ch.gradeAtRaise} at the time</span>
                </p>
                <p className="text-ink-600">{ch.reasoning}</p>
                {ch.evidence?.map(f => (
                  <p key={f.id} className="text-[0.6875rem] text-ink-400 inline-flex items-center gap-1"><Paperclip size={10} /> {f.name}</p>
                ))}
                {ch.response ? (
                  <p className={cn('mt-1', ch.response.decision === 'Accepted' ? 'text-compliant-700' : 'text-ink-600')}>
                    <b className="font-semibold">{ch.response.decision}</b> by {ch.response.by} — {ch.response.reason}
                    {ch.response.decision === 'Accepted' && <span className="text-ink-400"> The input was then edited on the record, and the engine re-graded.</span>}
                  </p>
                ) : isAuditor && !locked ? (
                  answering?.id === ch.id ? (
                    <div className="mt-1.5 space-y-1.5">
                      <textarea value={answerReason} onChange={e => setAnswerReason(e.target.value)} rows={2}
                        placeholder={answering.decision === 'Accepted' ? 'What you accept, and what you will change' : 'Why the number stands'}
                        className="w-full px-2.5 py-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-800 resize-none focus:outline-none focus:border-brand-300" />
                      <div className="flex items-center gap-2">
                        <button disabled={!answerReason.trim()}
                          onClick={() => { respondToChallenge(d.id, ch.id, answering.decision, answerReason); setAnswering(null); setAnswerReason(''); }}
                          className="h-7 px-3 rounded-md bg-brand-600 text-white text-[0.71875rem] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                          Record — {answering.decision.toLowerCase()}
                        </button>
                        <button onClick={() => { setAnswering(null); setAnswerReason(''); }}
                          className="h-7 px-2.5 rounded-md text-[0.71875rem] text-ink-500 hover:text-ink-700 cursor-pointer">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <button onClick={() => { setAnswering({ id: ch.id, decision: 'Accepted' }); setAnswerReason(''); }}
                        className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer">Accept</button>
                      <button onClick={() => { setAnswering({ id: ch.id, decision: 'Declined' }); setAnswerReason(''); }}
                        className="h-7 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-risk-300 hover:text-risk-700 cursor-pointer">Decline — reason required</button>
                    </div>
                  )
                ) : (
                  <p className="mt-1 text-[0.71875rem] text-ink-400">With the audit team — they answer it either way, with a reason.</p>
                )}
              </div>
            ))}
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
          {/* The owner's own copy. Not the working paper filtered down — a separate
              artefact built from owner-safe fields, so handing it over cannot leak
              the audit's file. Their door to it is here, on the exception it is
              about. */}
          {isOwner && (
            <button onClick={() => setBriefOpen(true)}
              className="h-8 px-3 rounded-lg border border-canvas-border text-ink-700 text-[12px] font-semibold hover:border-brand-300 hover:text-brand-700 cursor-pointer inline-flex items-center gap-1.5"><Download size={13} /> Remediation brief</button>
          )}
          {/* the way back in: audit-side only, never one-click — the reason is the record */}
          {!locked && !isOwner && d.status === 'Closed' && (
            <button onClick={() => { setReopening(true); setReopenReason(''); }}
              className="h-8 px-3 rounded-lg border border-high-300 text-high-700 text-[12px] font-semibold hover:bg-high-50 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reopen — reason required</button>
          )}
        </div>
  </>) : null;

  // Both confirms, portalled and layout-agnostic.
  const modals = (<>
      {briefOpen && <RemediationBriefModal defId={d.id} onClose={() => setBriefOpen(false)} />}
      {/* Attest confirm — closing is the terminal four-eyes act, so it never
          commits on a bare click. Portalled: this body also renders inside the
          control's paper, under animated ancestors that would otherwise become
          the containing block for a fixed backdrop — and inside a table row,
          where a backdrop could not live at all. */}
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
  </>);

  // ── Register row — the management page ────────────────────────────────────────
  // The body opens in a row of its own underneath rather than inside a cell, so
  // it gets the full width of the table and the summary above it stays a row you
  // can still read across.
  if (layout === 'row') return (
    <>
      <tr ref={rowRef} className={cn('reg-row', open && 'open')}
        role="button" tabIndex={0} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${d.id}`}
        onClick={() => setOpen(o => !o)} onKeyDown={onToggleKey}>
        <td className="tight">
          <span className="inline-flex items-center gap-1.5">{chevron}<span className="font-mono text-[12px] font-semibold text-ink-800">{d.id}</span></span>
          <div className="ml-[21px]">{controlLink}</div>
        </td>
        <td className="tight">
          <span className="reg-clamp text-[12.5px] text-ink-800" title={d.description}>{d.description}</span>
          {/* A fix that has missed twice is not a remediation problem any more,
              so the count rides the collapsed row where triage happens. */}
          {failures >= 2 && <div className="mt-1"><Pill tone="risk">{failures} failed retests</Pill></div>}
        </td>
        <td><Pill tone={d.track === 'design' ? 'mitigated' : 'evidence'}>{d.track === 'design' ? 'TOD' : 'TOE'}</Pill></td>
        {/* What could have slipped through — the number severity is graded on.
            The owner is never shown the engagement's thresholds, so the
            over-materiality mark is audit-side only. */}
        <td className={cn('text-right tabular-nums text-[12.5px]', !isOwner && material ? 'text-risk-700 font-semibold' : 'text-ink-700')}
          title={ct ? 'Clearly trivial' : !isOwner && material ? `At or over materiality ${fmt(M)}` : undefined}>
          {fmt(d.magnitude)}
        </td>
        <td><SeverityPill s={grade} /></td>
        <td><Pill tone={STATUS_TONE[d.status]}>{d.status}</Pill></td>
        <td><CourtBadge court={courtForException(d)} fromRole={role} /></td>
      </tr>
      {open && <tr className="def-detail"><td colSpan={DEF_COLS}>{detail}</td></tr>}
      {modals}
    </>
  );

  // ── Card — on a control's own paper, where there is only ever one ─────────────
  return (
    <>
      <div ref={cardRef} className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
        <div role="button" tabIndex={0} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${d.id}`}
          onClick={() => setOpen(o => !o)} onKeyDown={onToggleKey} className="cursor-pointer">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 flex-wrap min-w-0">
              {chevron}
              <span className="font-mono text-[12px] font-semibold text-ink-600">{d.id}</span>
              {controlLink}
              <Pill tone={d.track === 'design' ? 'mitigated' : 'evidence'}>{d.track === 'design' ? 'TOD' : 'TOE'}</Pill>
              {/* PARKED (Aug 2026) — the Gap type pill and the priced-impact teaser.
                  Manual vs IT is already settled by the control's nature, design vs
                  operating by the track pill beside this, and priced impact is an
                  internal-audit number that was never ICFR magnitude. */}
              {failures >= 2 && <Pill tone="risk">{failures} failed retests</Pill>}
            </div>
            <div className="inline-flex items-center gap-2 shrink-0"><Pill tone={STATUS_TONE[d.status]}>{d.status}</Pill><SeverityPill s={grade} /></div>
          </div>
          {/* The finding itself stays on the collapsed header — clamped to one
              line. Without it it reads as an id and some pills, and you would
              have to open it to find out what it was. */}
          <p className={cn('text-[13px] text-ink-800 leading-relaxed mt-2.5', !open && 'truncate')}>{d.description}</p>
        </div>
        {detail}
      </div>
      {modals}
    </>
  );
}
