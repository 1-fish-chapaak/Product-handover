import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, History, Target, ShieldCheck, AlertTriangle, RotateCcw, Scale, CheckCircle2, X, XCircle, Sliders, GitMerge, Route } from 'lucide-react';
import { useIcfr } from './store';
import { assessSeverity, computeSeverity, formatINR, isClearlyTrivial, isEngagementLocked, previewRegrades, type RulesPatch } from './helpers';
import { SeverityPill } from './parts';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import { MW_INDICATOR_CATALOGUE, type ExceptionStatus, type IcfrEngagement } from './types';

const fmt = (n: number) => formatINR(n);
const fmtFull = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('toggle', on && 'on')} />;
}

// ─── Materiality & scope — the ground rules ──────────────────────────────────────
export function ScopeView() {
  const { eng, role, back, updateRules, applyRules } = useIcfr();
  const r = eng.rules;
  // The four grading thresholds edit as a DRAFT — nothing hits the engagement
  // until it's reviewed and applied (mid-engagement changes re-grade exceptions).
  const saved = { M: eng.materiality, pm: eng.performanceMateriality, ctt: r.clearlyTrivial, band: r.sdBandPct };
  const [draft, setDraft] = useState(saved);
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => { setDraft({ M: eng.materiality, pm: eng.performanceMateriality, ctt: eng.rules.clearlyTrivial, band: eng.rules.sdBandPct }); }, [eng.materiality, eng.performanceMateriality, eng.rules.clearlyTrivial, eng.rules.sdBandPct]);
  const dirty = draft.M !== saved.M || draft.pm !== saved.pm || draft.ctt !== saved.ctt || draft.band !== saved.band;
  const canEditRules = role === 'auditor' && !isEngagementLocked(eng);
  const patch: RulesPatch = { materiality: draft.M, performanceMateriality: draft.pm, clearlyTrivial: draft.ctt, sdBandPct: draft.band };

  const M = draft.M;
  const pm = draft.pm;
  const ctt = draft.ctt;
  const sd = M * draft.band / 100;
  const pmPct = M ? Math.round((pm / M) * 100) : 0;
  const cttPct = M ? Math.round((ctt / M) * 100) : 0;

  const LADDER: { label: string; band: string; tone: string }[] = [
    { label: 'Clearly trivial', band: `≤ ${fmtFull(ctt)}`, tone: 'text-ink-500 bg-paper-50 border-canvas-border' },
    { label: 'Deficiency', band: `> ${fmtFull(ctt)} and < ${fmtFull(sd)}`, tone: 'text-mitigated-700 bg-mitigated-50/50 border-mitigated-200' },
    { label: 'Significant deficiency', band: `≥ ${fmtFull(sd)}  ·  ${draft.band}% of materiality`, tone: 'text-high-700 bg-high-50/50 border-high-200' },
    { label: 'Material weakness', band: `≥ ${fmtFull(M)}  or any MW indicator`, tone: 'text-risk-700 bg-risk-50/50 border-risk-200' },
  ];

  return (
    <div className="space-y-5">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Back</button>
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Materiality &amp; scope</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">The ground rules that drive how every exception is evaluated, sized, and routed. Set them once — they apply across all controls.</p>
      </div>

      {/* materiality — draft edits; nothing applies until reviewed */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><Target size={15} className="text-brand-600" /> Materiality</h2>
        <div className="grid grid-cols-3 gap-4">
          <Money label="Overall materiality" value={M} disabled={!canEditRules} onChange={v => setDraft(d => ({ ...d, M: v }))} hint="The financial-statement materiality benchmark." />
          <Money label="Performance materiality" value={pm} disabled={!canEditRules} onChange={v => setDraft(d => ({ ...d, pm: v }))} hint={`${pmPct}% of overall — the testing threshold.`} />
          <Money label="Clearly-trivial threshold" value={ctt} disabled={!canEditRules} onChange={v => setDraft(d => ({ ...d, ctt: v }))} hint={`${cttPct}% of overall — below this, logged but not evaluated.`} />
        </div>
        {dirty && (
          <div className="mt-4 rounded-xl border border-high-200 bg-high-50/50 px-4 py-3 flex items-center gap-3 flex-wrap">
            <AlertTriangle size={15} className="text-high-700 shrink-0" />
            <div className="flex-1 min-w-[220px]">
              <div className="text-[12.5px] font-semibold text-ink-800">You're changing the ground rules mid-engagement</div>
              <div className="text-[11.5px] text-ink-500">Nothing is saved yet. Review which exceptions would change grade, record why, then apply.</div>
            </div>
            <button onClick={() => setReviewing(true)} className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5">Review &amp; apply <ArrowRight size={13} /></button>
            <button onClick={() => setDraft(saved)} className="h-8 px-3 rounded-lg border border-canvas-border text-[12px] font-semibold text-ink-600 hover:bg-paper-50 cursor-pointer">Discard</button>
          </div>
        )}
      </section>

      {/* severity ladder */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Exception severity ladder</h2>
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-600"><Sliders size={13} /> Significant-deficiency band
            <input type="number" min={1} max={100} value={draft.band} disabled={!canEditRules} onChange={e => setDraft(d => ({ ...d, band: Math.max(1, Math.min(100, +e.target.value || 0)) }))} className="h-8 w-16 px-2 rounded-lg border border-canvas-border text-[12.5px] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50" />
            <span className="text-ink-400">% of materiality</span>
          </label>
        </div>
        <div className="space-y-2">
          {LADDER.map((row, i) => (
            <div key={row.label} className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5', row.tone)}>
              <span className="inline-flex items-center gap-2.5"><span className="font-mono text-[11px] font-bold opacity-60">{i + 1}</span><span className="text-[13px] font-bold">{row.label}</span></span>
              <span className="text-[12px] tabular-nums font-medium">{row.band}</span>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-400 mt-2.5">Severity = likelihood (more than remote) × magnitude vs materiality. A compensating control can cap — never clear — a deficiency.</p>
      </section>

      {/* policies */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><GitMerge size={14} className="text-brand-600" /> Aggregation</div><p className="text-[12px] text-ink-500 mt-1">Combine individually-minor deficiencies by commonality and evaluate them together.</p></div>
          <Toggle on={r.aggregate} onChange={v => updateRules({ aggregate: v })} label="Aggregation" />
        </div>
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Route size={14} className="text-brand-600" /> Auto-routing</div><p className="text-[12px] text-ink-500 mt-1">Route an exception to the owner (remediation) or the auditor (sign-off) by computed severity.</p></div>
          <Toggle on={r.autoRoute} onChange={v => updateRules({ autoRoute: v })} label="Auto-routing" />
        </div>
      </section>

      {/* MW indicators */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-1"><AlertTriangle size={15} className="text-risk-600" /> Material-weakness indicators</h2>
        <p className="text-[12px] text-ink-500 mb-3">If any in-force indicator is present on an exception, it is a material weakness regardless of magnitude.</p>
        <div className="space-y-1.5">
          {MW_INDICATOR_CATALOGUE.map(ind => {
            const on = r.mwIndicators.includes(ind);
            return (
              <button key={ind} onClick={() => updateRules({ mwIndicators: on ? r.mwIndicators.filter(x => x !== ind) : [...r.mwIndicators, ind] })} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer', on ? 'border-risk-200 bg-risk-50/40' : 'border-canvas-border hover:border-ink-300')}>
                <span className={cn('w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0', on ? 'bg-risk-600 border-risk-600 text-white' : 'border-ink-300')}>{on && <CheckCircle2 size={12} />}</span>
                <span className="text-[12.5px] text-ink-800">{ind}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ground-rules change history — the audit trail for mid-engagement edits */}
      {eng.rulesLog.length > 0 && (
        <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-3"><History size={15} className="text-brand-600" /> Ground-rules change history</h2>
          <div className="space-y-2.5">
            {eng.rulesLog.map(entry => (
              <div key={entry.id} className="rounded-xl border border-canvas-border bg-paper-50/40 px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap text-[12px]">
                  {entry.changes.map(c => (
                    <span key={c.field} className="inline-flex items-center gap-1.5 text-ink-700"><b className="font-semibold">{c.field}</b> {c.from} <ArrowRight size={11} className="text-ink-400" /> <b className="font-semibold">{c.to}</b></span>
                  ))}
                  <span className="ml-auto text-[11.5px] text-ink-400">{entry.by} · {entry.at}</span>
                </div>
                <div className="text-[12px] text-ink-500 mt-1 italic">“{entry.reason}”</div>
                <div className="text-[11.5px] mt-1.5">
                  {entry.regraded.length === 0 ? <span className="text-ink-400">No exception changed grade.</span> : (
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      {entry.regraded.map(rg => (
                        <span key={rg.defId} className="inline-flex items-center gap-1 text-ink-600"><span className="font-mono font-semibold">{rg.defId}</span> {rg.from} <ArrowRight size={10} className="text-ink-400" /> <b className="font-semibold">{rg.to}</b></span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {reviewing && <RulesReviewModal eng={eng} patch={patch} onClose={() => setReviewing(false)} onApply={reason => { applyRules(patch, reason); setReviewing(false); }} />}

      {/* significant accounts */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <header className="px-4 py-3 border-b border-canvas-border flex items-center justify-between"><h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-600" /> Significant accounts &amp; disclosures</h2><span className="text-[11.5px] text-ink-400">{eng.accounts.filter(a => a.inScope).length} in scope</span></header>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-ink-500 border-b border-canvas-border">{['Account', 'Balance', 'In scope', 'Assertions'].map(h => <th key={h} className="text-left font-semibold uppercase tracking-wide text-[10px] px-4 py-2">{h}</th>)}</tr></thead>
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

function Money({ label, value, onChange, hint, disabled }: { label: string; value: number; onChange: (v: number) => void; hint: string; disabled?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-ink-500 mb-1.5">{label}</div>
      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-400 pointer-events-none">₹</span>
        <input type="number" min={0} value={value} disabled={disabled} onChange={e => onChange(Math.max(0, +e.target.value || 0))} className="w-full h-10 pl-7 pr-3 rounded-lg border border-canvas-border text-[13px] tabular-nums text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-50 disabled:cursor-not-allowed" />
      </div>
      <div className="text-[11px] text-ink-400 mt-1">{hint}</div>
    </div>
  );
}

// The gate on mid-engagement ground-rule changes: show exactly what changes and
// which exceptions re-grade, demand a reason, then apply — one logged entry.
function RulesReviewModal({ eng, patch, onClose, onApply }: { eng: IcfrEngagement; patch: RulesPatch; onClose: () => void; onApply: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const fmtVal = (field: string, v: number) => field === 'SD band' ? `${v}%` : fmt(v);
  const fields: { field: string; from: number; to: number }[] = [
    { field: 'Overall materiality', from: eng.materiality, to: patch.materiality ?? eng.materiality },
    { field: 'Performance materiality', from: eng.performanceMateriality, to: patch.performanceMateriality ?? eng.performanceMateriality },
    { field: 'Clearly-trivial threshold', from: eng.rules.clearlyTrivial, to: patch.clearlyTrivial ?? eng.rules.clearlyTrivial },
    { field: 'SD band', from: eng.rules.sdBandPct, to: patch.sdBandPct ?? eng.rules.sdBandPct },
  ];
  const changes = fields.filter(f => f.from !== f.to);
  const regrades = previewRegrades(eng, patch);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal max-w-[560px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-canvas-border">
          <h3 className="text-[14px] font-bold text-ink-900 inline-flex items-center gap-2"><Scale size={15} className="text-brand-600" /> Changing the ground rules</h3>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-50 cursor-pointer"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            {changes.map(c => (
              <div key={c.field} className="flex items-center gap-2 text-[13px]">
                <span className="text-ink-500 w-[190px]">{c.field}</span>
                <span className="tabular-nums text-ink-600">{fmtVal(c.field, c.from)}</span>
                <ArrowRight size={12} className="text-ink-400" />
                <span className="tabular-nums font-semibold text-ink-900">{fmtVal(c.field, c.to)}</span>
              </div>
            ))}
          </div>
          <div className={cn('rounded-xl border px-4 py-3', regrades.length ? 'border-high-200 bg-high-50/40' : 'border-canvas-border bg-paper-50/40')}>
            <div className="text-[12px] font-semibold text-ink-800 mb-1.5">{regrades.length ? `${regrades.length} open exception${regrades.length === 1 ? '' : 's'} would change grade` : 'No open exception changes grade'}</div>
            {regrades.map(rg => (
              <div key={rg.defId} className="flex items-center gap-2 text-[12.5px] text-ink-700">
                <span className="font-mono font-semibold">{rg.defId}</span>
                <SeverityPill s={rg.from} /> <ArrowRight size={12} className="text-ink-400" /> <SeverityPill s={rg.to} />
              </div>
            ))}
          </div>
          <div>
            <div className="text-[11.5px] font-semibold text-ink-600 mb-1.5">Why is this changing mid-engagement? <span className="text-ink-400 font-normal">— recorded in the change history</span></div>
            <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="e.g. Revised benchmark after the Q2 forecast update"
              className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-canvas-border">
          <button onClick={onClose} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:bg-paper-50 cursor-pointer">Cancel</button>
          <button disabled={!reason.trim()} onClick={() => onApply(reason.trim())}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Apply new ground rules</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Exceptions — the lifecycle ──────────────────────────────────────────────────
const STAGES: ExceptionStatus[] = ['Identified', 'Remediation', 'Retest', 'Awaiting reviewer', 'Closed'];
const STATUS_TONE: Record<ExceptionStatus, Tone> = { Identified: 'high', Remediation: 'mitigated', Retest: 'evidence', 'Awaiting reviewer': 'info', Closed: 'compliant' };
const MW_INDICATORS = MW_INDICATOR_CATALOGUE as readonly string[];

export function DeficienciesView() {
  const { eng, role, me, back, openControl, updateDeficiency, setExceptionStatus, recordRetest, signOffException } = useIcfr();
  const M = eng.materiality; const rules = eng.rules;

  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Back</button>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Exceptions</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">Severity is computed against materiality ({fmt(M)}); each exception runs the lifecycle — identify → remediate → retest → reviewer closes.</p>
        </div>
      </div>

      {/* aggregation */}
      {rules.aggregate && (() => {
        const LRANK: Record<string, number> = { Remote: 0, 'Reasonably possible': 1, Probable: 2 };
        const LBYR = ['Remote', 'Reasonably possible', 'Probable'] as const;
        const groups = new Map<string, typeof eng.deficiencies>();
        eng.deficiencies.forEach(d => { const k = d.aggregationGroup ?? 'Ungrouped'; groups.set(k, [...(groups.get(k) ?? []), d]); });
        const agg = Array.from(groups.entries()).filter(([, ds]) => ds.length > 1);
        if (!agg.length) return null;
        return (
          <div className="space-y-2">
            <h2 className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide">Aggregation — individually-minor deficiencies combine by commonality</h2>
            {agg.map(([group, ds]) => {
              const sum = ds.reduce((n, d) => n + d.magnitude, 0);
              const lk = LBYR[Math.max(...ds.map(d => LRANK[d.likelihood] ?? 0))]!;
              const mw = Array.from(new Set(ds.flatMap(d => d.mwIndicators)));
              return (
                <div key={group} className="rounded-xl border border-mitigated-200 bg-mitigated-50/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[12.5px] text-ink-700"><span className="font-semibold">{group}</span> · {ds.length} deficiencies · combined {fmt(sum)} (vs {fmt(M)})</div>
                  <SeverityPill s={computeSeverity(lk, sum, M, mw, rules.sdBandPct / 100)} />
                </div>
              );
            })}
          </div>
        );
      })()}

      {eng.deficiencies.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 text-center text-ink-500">No exceptions — all tested controls effective.</div>
      ) : (
        <div className="space-y-3">
          {eng.deficiencies.map(d => {
            const ct = isClearlyTrivial(d.magnitude, rules);
            const assess = assessSeverity(d, eng);
            const sev = assess.final;
            const material = d.magnitude >= M;
            const stageIdx = STAGES.indexOf(d.status);
            return (
              <div key={d.id} className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="inline-flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[12px] font-semibold text-ink-600">{d.id}</span>
                    <button onClick={() => openControl(d.controlId)} className="font-mono text-[12px] text-brand-700 hover:underline cursor-pointer">{d.controlId}</button>
                    <Pill tone={d.track === 'design' ? 'mitigated' : 'evidence'}>{d.track === 'design' ? 'Design' : 'Operating'}</Pill>
                    {ct && <Pill tone="draft">Clearly trivial</Pill>}
                  </div>
                  <div className="inline-flex items-center gap-2"><Pill tone={STATUS_TONE[d.status]}>{d.status}</Pill><SeverityPill s={sev} /></div>
                </div>
                <p className="text-[13px] text-ink-800 leading-relaxed">{d.description}</p>
                <p className="text-[12px] text-ink-500 mt-1"><span className="font-semibold">Root cause:</span> {d.rootCause}</p>

                {/* lifecycle stepper */}
                <div className="flex items-center gap-1.5 my-3">
                  {STAGES.map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
                      <span className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap', i < stageIdx ? 'bg-compliant-50 text-compliant-700' : i === stageIdx ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-400')}>
                        {i < stageIdx ? <CheckCircle2 size={12} /> : <span className="w-[14px] text-center">{i + 1}</span>}{s}
                      </span>
                      {i < STAGES.length - 1 && <span className={cn('h-px flex-1', i < stageIdx ? 'bg-compliant-300' : 'bg-paper-200')} />}
                    </div>
                  ))}
                </div>

                {/* severity inputs */}
                <div className="rounded-lg border border-canvas-border p-3 space-y-2.5">
                  <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Severity inputs — recomputed live vs the ground rules</div>
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <span className="text-ink-500 w-[120px]">Likelihood</span>
                    {(['Remote', 'Reasonably possible', 'Probable'] as const).map(l => (
                      <button key={l} onClick={() => updateDeficiency(d.id, { likelihood: l })} className={cn('h-7 px-2.5 rounded-md border text-[11.5px] font-semibold cursor-pointer transition-colors', d.likelihood === l ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{l}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-ink-500 w-[120px]">Magnitude ₹</span>
                    <input type="number" value={d.magnitude} onChange={e => updateDeficiency(d.id, { magnitude: Number(e.target.value) || 0 })} className="h-8 w-44 px-2.5 rounded-md border border-canvas-border text-[12.5px] tabular-nums focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                    <span className={cn('text-[11.5px]', material ? 'text-risk-700 font-semibold' : 'text-ink-400')}>{material ? '≥' : '<'} materiality {fmt(M)}{ct ? ' · clearly trivial' : ''}</span>
                  </div>
                  <div className="flex items-start gap-2 text-[12px] flex-wrap">
                    <span className="text-ink-500 w-[120px] mt-1">MW indicators</span>
                    {MW_INDICATORS.map(ind => { const on = d.mwIndicators.includes(ind); return <button key={ind} onClick={() => updateDeficiency(d.id, { mwIndicators: on ? d.mwIndicators.filter(x => x !== ind) : [...d.mwIndicators, ind] })} className={cn('h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors text-left', on ? 'bg-risk-50 border-risk-200 text-risk-700' : 'border-canvas-border text-ink-500 hover:bg-paper-50')}>{ind.length > 36 ? ind.slice(0, 34) + '…' : ind}</button>; })}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] flex-wrap">
                    <span className="text-ink-500 w-[120px]">Compensating control</span>
                    <select value={d.compensatingControlId ?? ''} onChange={e => updateDeficiency(d.id, { compensatingControlId: e.target.value || undefined })} className="h-8 px-2.5 rounded-md border border-canvas-border text-[12px] bg-canvas-elevated cursor-pointer focus:outline-none focus:border-brand-300">
                      <option value="">None</option>
                      {eng.controls.filter(c => c.id !== d.controlId).slice(0, 30).map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                    {d.compensatingControlId && (
                      assess.capped ? <span className="text-compliant-700 text-[11px] font-semibold">capping Material Weakness → Significant Deficiency — never clears the exception</span>
                      : assess.capBlocked === 'not-effective' ? <span className="text-high-700 text-[11px] font-semibold">no cap — {d.compensatingControlId} isn't concluded effective in this engagement</span>
                      : assess.capBlocked === 'mw-indicator' ? <span className="text-risk-700 text-[11px] font-semibold">no cap — MW indicators can't be argued down</span>
                      : <span className="text-ink-400 text-[11px]">in place — the cap only rescues a Material Weakness grade, and never clears the exception</span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink-600 pt-2 border-t border-canvas-border">
                    → {d.likelihood} × {fmt(d.magnitude)} (vs {fmt(M)}){d.mwIndicators.length ? ' + MW indicator' : ''} ⇒ <span className={cn('font-bold', assess.capped ? 'text-ink-500 line-through' : 'text-ink-800')}>{assess.raw}</span>
                    {assess.capped && <> · capped by {d.compensatingControlId} (effective) ⇒ <span className="font-bold text-ink-800">{assess.final}</span></>}
                  </p>
                </div>

                {/* remediation + lifecycle actions */}
                <div className="mt-3 rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2.5">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-ink-500 mb-1"><RotateCcw size={12} /> Remediation</div>
                  <div className="text-[12.5px] text-ink-700">{d.remediation.action}</div>
                  <div className="text-[11.5px] text-ink-400 mt-0.5">Owner {d.remediation.owner} · due {d.remediation.date ?? '—'} · <span className="font-medium text-ink-600">{d.remediation.status}</span>{d.retest && <> · retest <span className={d.retest.result === 'Pass' ? 'text-compliant-700 font-semibold' : 'text-risk-700 font-semibold'}>{d.retest.result}</span></>}{d.signoff && <> · signed off by {d.signoff.by}</>}</div>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {d.status === 'Identified' && <button onClick={() => setExceptionStatus(d.id, 'Remediation')} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Start remediation</button>}
                  {d.status === 'Remediation' && <button onClick={() => setExceptionStatus(d.id, 'Retest')} className="h-8 px-3 rounded-lg bg-evidence-600 text-white text-[12px] font-semibold hover:bg-evidence-700 cursor-pointer inline-flex items-center gap-1.5">Submit for retest</button>}
                  {d.status === 'Retest' && <>
                    <button onClick={() => recordRetest(d.id, 'Pass')} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Retest passed — to reviewer</button>
                    <button onClick={() => recordRetest(d.id, 'Fail')} className="h-8 px-3 rounded-lg border border-risk-300 text-risk-700 text-[12px] font-semibold hover:bg-risk-50 cursor-pointer inline-flex items-center gap-1.5"><XCircle size={13} /> Retest failed</button>
                  </>}
                  {/* four-eyes: only the reviewer hat closes, and never the person who ran the retest */}
                  {d.status === 'Awaiting reviewer' && (
                    role !== 'reviewer' ? (
                      <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-ink-400" /> Awaiting reviewer — only the reviewer closes{d.retest ? ` (retest ${d.retest.result} · ${d.retest.by})` : ''}</span>
                    ) : d.retest && d.retest.by === me ? (
                      <span className="text-[12px] font-semibold text-high-700 inline-flex items-center gap-1.5"><XCircle size={14} /> A different person must close — you recorded this retest.</span>
                    ) : (
                      <button onClick={() => signOffException(d.id)} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
                    )
                  )}
                  {d.status === 'Closed' && d.signoff && <span className="text-[12px] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Closed — signed off by {d.signoff.by}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
