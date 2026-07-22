import { ArrowLeft, Target, ShieldCheck, AlertTriangle, RotateCcw, Scale, CheckCircle2, XCircle, Sliders, GitMerge, Route, Building2, Lock, Paperclip, Sparkles } from 'lucide-react';
import { useIcfr } from './store';
import { computeSeverity, formatINR, severityOf, isClearlyTrivial } from './helpers';
import { SeverityPill } from './parts';
import MaterialityWorksheet from './MaterialityWorksheet';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import { useAuditLog } from '../../context/AdminDataContext';
import { MW_INDICATOR_CATALOGUE, type ExceptionStatus } from './types';

const fmt = (n: number) => formatINR(n);
const fmtFull = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('toggle', on && 'on')} />;
}

// ─── Configuration — entity, materiality (locked at go-live) & the ground rules ──
export function ScopeView() {
  const { eng, back, updateRules, updateMateriality, racmDocs } = useIcfr();
  const M = eng.materiality; const r = eng.rules;
  const locked = !!eng.materialityBasis?.lockedAt;
  const pm = eng.performanceMateriality;
  const ctt = r.clearlyTrivial;
  const sd = M * r.sdBandPct / 100;
  const pmPct = M ? Math.round((pm / M) * 100) : 0;
  const cttPct = M ? Math.round((ctt / M) * 100) : 0;

  const LADDER: { label: string; band: string; tone: string }[] = [
    { label: 'Clearly trivial', band: `≤ ${fmtFull(ctt)}`, tone: 'text-ink-500 bg-paper-50 border-canvas-border' },
    { label: 'Deficiency', band: `> ${fmtFull(ctt)} and < ${fmtFull(sd)}`, tone: 'text-mitigated-700 bg-mitigated-50/50 border-mitigated-200' },
    { label: 'Significant deficiency', band: `≥ ${fmtFull(sd)}  ·  ${r.sdBandPct}% of materiality`, tone: 'text-high-700 bg-high-50/50 border-high-200' },
    { label: 'Material weakness', band: `≥ ${fmtFull(M)}  or any MW indicator`, tone: 'text-risk-700 bg-risk-50/50 border-risk-200' },
  ];

  return (
    <div className="space-y-5">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Back</button>
      <div>
        <h1 className="text-[1.375rem] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Configuration</h1>
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
            <Money label="Overall materiality" value={M} onChange={v => updateMateriality({ materiality: v })} hint="The financial-statement materiality benchmark." />
            <Money label="Performance materiality" value={pm} onChange={v => updateMateriality({ performanceMateriality: v })} hint={`${pmPct}% of overall — the testing threshold.`} />
            <Money label="Clearly-trivial threshold" value={ctt} onChange={v => updateRules({ clearlyTrivial: v })} hint={`${cttPct}% of overall — below this, logged but not evaluated.`} />
          </div>
        )}
      </section>

      {/* severity ladder */}
      <section className="rounded-lg border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Exception severity ladder</h2>
          <label className="inline-flex items-center gap-2 text-[0.75rem] text-ink-600"><Sliders size={13} /> Significant-deficiency band
            <input type="number" min={1} max={100} value={r.sdBandPct} onChange={e => updateRules({ sdBandPct: Math.max(1, Math.min(100, +e.target.value || 0)) })} className="h-8 w-16 px-2 rounded-lg border border-canvas-border text-[0.78125rem] tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-200" />
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
          <Toggle on={r.aggregate} onChange={v => updateRules({ aggregate: v })} label="Aggregation" />
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[0.8125rem] font-bold text-ink-800 inline-flex items-center gap-1.5"><Route size={14} className="text-brand-600" /> Auto-routing</div><p className="text-[0.75rem] text-ink-500 mt-1">Route an exception to the owner (remediation) or the auditor (sign-off) by computed severity.</p></div>
          <Toggle on={r.autoRoute} onChange={v => updateRules({ autoRoute: v })} label="Auto-routing" />
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
              <button key={ind} onClick={() => updateRules({ mwIndicators: on ? r.mwIndicators.filter(x => x !== ind) : [...r.mwIndicators, ind] })} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer', on ? 'border-risk-200 bg-risk-50/40' : 'border-canvas-border hover:border-ink-300')}>
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

// ─── Exceptions — the lifecycle ──────────────────────────────────────────────────
const STAGES: ExceptionStatus[] = ['Identified', 'Remediation', 'Retest', 'Closed'];
const STATUS_TONE: Record<ExceptionStatus, Tone> = { Identified: 'high', Remediation: 'mitigated', Retest: 'evidence', Closed: 'compliant' };
const MW_INDICATORS = MW_INDICATOR_CATALOGUE as readonly string[];

export function DeficienciesView() {
  const { eng, back, openControl, updateDeficiency, setExceptionStatus, recordRetest, signOffException } = useIcfr();
  const logEvent = useAuditLog();
  const M = eng.materiality; const rules = eng.rules;

  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Back</button>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[1.375rem] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Exceptions</h1>
          <p className="text-[0.8125rem] text-ink-500 mt-0.5">Severity is computed against materiality ({fmt(M)}); each exception runs the lifecycle — identify → remediate → retest → close.</p>
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
            <h2 className="text-[0.75rem] font-semibold text-ink-500 uppercase tracking-wide">Aggregation — individually-minor deficiencies combine by commonality</h2>
            {agg.map(([group, ds]) => {
              const sum = ds.reduce((n, d) => n + d.magnitude, 0);
              const lk = LBYR[Math.max(...ds.map(d => LRANK[d.likelihood] ?? 0))]!;
              const mw = Array.from(new Set(ds.flatMap(d => d.mwIndicators)));
              return (
                <div key={group} className="rounded-xl border border-mitigated-200 bg-mitigated-50/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[0.78125rem] text-ink-700"><span className="font-semibold">{group}</span> · {ds.length} deficiencies · combined {fmt(sum)} (vs {fmt(M)})</div>
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
            const sev = severityOf(d, M, rules);
            const material = d.magnitude >= M;
            const stageIdx = STAGES.indexOf(d.status);
            return (
              <div key={d.id} className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="inline-flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[0.75rem] font-semibold text-ink-600">{d.id}</span>
                    <button onClick={() => openControl(d.controlId)} className="font-mono text-[0.75rem] text-brand-700 hover:underline cursor-pointer">{d.controlId}</button>
                    <Pill tone={d.track === 'design' ? 'mitigated' : 'evidence'}>{d.track === 'design' ? 'Design' : 'Operating'}</Pill>
                    {ct && <Pill tone="draft">Clearly trivial</Pill>}
                  </div>
                  <div className="inline-flex items-center gap-2"><Pill tone={STATUS_TONE[d.status]}>{d.status}</Pill><SeverityPill s={sev} /></div>
                </div>
                <p className="text-[0.8125rem] text-ink-800 leading-relaxed">{d.description}</p>
                <p className="text-[0.75rem] text-ink-500 mt-1"><span className="font-semibold">Root cause:</span> {d.rootCause}</p>

                {/* lifecycle stepper */}
                <div className="flex items-center gap-1.5 my-3">
                  {STAGES.map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
                      <span className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.6875rem] font-semibold whitespace-nowrap', i < stageIdx ? 'bg-compliant-50 text-compliant-700' : i === stageIdx ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-400')}>
                        {i < stageIdx ? <CheckCircle2 size={12} /> : <span className="w-[14px] text-center">{i + 1}</span>}{s}
                      </span>
                      {i < STAGES.length - 1 && <span className={cn('h-px flex-1', i < stageIdx ? 'bg-compliant-300' : 'bg-paper-200')} />}
                    </div>
                  ))}
                </div>

                {/* severity inputs */}
                <div className="rounded-lg border border-canvas-border p-3 space-y-2.5">
                  <div className="text-[0.65625rem] uppercase tracking-wide text-ink-400 font-semibold">Severity inputs — recomputed live vs the ground rules</div>
                  <div className="flex items-center gap-2 flex-wrap text-[0.75rem]">
                    <span className="text-ink-500 w-[120px]">Likelihood</span>
                    {(['Remote', 'Reasonably possible', 'Probable'] as const).map(l => (
                      <button key={l} onClick={() => updateDeficiency(d.id, { likelihood: l })} className={cn('h-7 px-2.5 rounded-md border text-[0.71875rem] font-semibold cursor-pointer transition-colors', d.likelihood === l ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{l}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[0.75rem]">
                    <span className="text-ink-500 w-[120px]">Magnitude ₹</span>
                    <input type="number" value={d.magnitude} onChange={e => updateDeficiency(d.id, { magnitude: Number(e.target.value) || 0 })} className="h-8 w-44 px-2.5 rounded-md border border-canvas-border text-[0.78125rem] tabular-nums focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                    <span className={cn('text-[0.71875rem]', material ? 'text-risk-700 font-semibold' : 'text-ink-400')}>{material ? '≥' : '<'} materiality {fmt(M)}{ct ? ' · clearly trivial' : ''}</span>
                  </div>
                  <div className="flex items-start gap-2 text-[0.75rem] flex-wrap">
                    <span className="text-ink-500 w-[120px] mt-1">MW indicators</span>
                    {MW_INDICATORS.map(ind => { const on = d.mwIndicators.includes(ind); return <button key={ind} onClick={() => updateDeficiency(d.id, { mwIndicators: on ? d.mwIndicators.filter(x => x !== ind) : [...d.mwIndicators, ind] })} className={cn('h-7 px-2.5 rounded-md border text-[0.6875rem] font-semibold cursor-pointer transition-colors text-left', on ? 'bg-risk-50 border-risk-200 text-risk-700' : 'border-canvas-border text-ink-500 hover:bg-paper-50')}>{ind.length > 36 ? ind.slice(0, 34) + '…' : ind}</button>; })}
                  </div>
                  <div className="flex items-center gap-2 text-[0.75rem] flex-wrap">
                    <span className="text-ink-500 w-[120px]">Compensating control</span>
                    <select value={d.compensatingControlId ?? ''} onChange={e => updateDeficiency(d.id, { compensatingControlId: e.target.value || undefined })} className="h-8 px-2.5 rounded-md border border-canvas-border text-[0.75rem] bg-canvas-elevated cursor-pointer focus:outline-none focus:border-brand-300">
                      <option value="">None</option>
                      {eng.controls.filter(c => c.id !== d.controlId).slice(0, 30).map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                    {d.compensatingControlId && <span className="text-ink-400 text-[0.6875rem]">caps severity — never clears the deficiency</span>}
                  </div>
                  <p className="text-[0.75rem] text-ink-600 pt-2 border-t border-canvas-border">→ {d.likelihood} × {fmt(d.magnitude)} (vs {fmt(M)}){d.mwIndicators.length ? ' + MW indicator' : ''} ⇒ <span className="font-bold text-ink-800">{sev}</span></p>
                </div>

                {/* remediation + lifecycle actions */}
                <div className="mt-3 rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2.5">
                  <div className="inline-flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-wide font-semibold text-ink-500 mb-1"><RotateCcw size={12} /> Remediation</div>
                  <div className="text-[0.78125rem] text-ink-700">{d.remediation.action}</div>
                  <div className="text-[0.71875rem] text-ink-400 mt-0.5">Owner {d.remediation.owner} · due {d.remediation.date ?? '—'} · <span className="font-medium text-ink-600">{d.remediation.status}</span>{d.retest && <> · retest <span className={d.retest.result === 'Pass' ? 'text-compliant-700 font-semibold' : 'text-risk-700 font-semibold'}>{d.retest.result}</span></>}{d.signoff && <> · signed off by {d.signoff.by}</>}</div>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {d.status === 'Identified' && <button onClick={() => setExceptionStatus(d.id, 'Remediation')} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Start remediation</button>}
                  {d.status === 'Remediation' && <button onClick={() => setExceptionStatus(d.id, 'Retest')} className="h-8 px-3 rounded-lg bg-evidence-600 text-white text-[0.75rem] font-semibold hover:bg-evidence-700 cursor-pointer inline-flex items-center gap-1.5">Submit for retest</button>}
                  {d.status === 'Retest' && <>
                    <button onClick={() => { recordRetest(d.id, 'Pass'); logEvent({ action: 'Update', description: `Recorded exception retest for ${d.id} — Pass`, module: 'Exceptions', entity: 'Exception' }); }} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[0.75rem] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Retest passed — close</button>
                    <button onClick={() => { recordRetest(d.id, 'Fail'); logEvent({ action: 'Update', description: `Recorded exception retest for ${d.id} — Fail`, module: 'Exceptions', entity: 'Exception' }); }} className="h-8 px-3 rounded-lg border border-risk-300 text-risk-700 text-[0.75rem] font-semibold hover:bg-risk-50 cursor-pointer inline-flex items-center gap-1.5"><XCircle size={13} /> Retest failed</button>
                  </>}
                  {d.status === 'Closed' && !d.signoff && <button onClick={() => { signOffException(d.id); logEvent({ action: 'Update', description: `Signed off exception ${d.id}`, module: 'Exceptions', entity: 'Exception' }); }} className="h-8 px-3 rounded-lg border border-canvas-border text-ink-700 text-[0.75rem] font-semibold hover:border-brand-300 hover:text-brand-700 cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Auditor sign-off</button>}
                  {d.status === 'Closed' && d.signoff && <span className="text-[0.75rem] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Closed &amp; signed off</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
