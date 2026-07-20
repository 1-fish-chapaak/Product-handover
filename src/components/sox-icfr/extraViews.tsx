import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, History, Lightbulb, Lock, Paperclip, Target, ShieldCheck, AlertTriangle, RotateCcw, Scale, CheckCircle2, X, XCircle, Sliders, GitMerge, Route } from 'lucide-react';
import { useIcfr } from './store';
import { assessSeverity, computeSeverity, formatINR, isClearlyTrivial, isEngagementLocked, SEVERITY_RANK } from './helpers';
import { SeverityPill } from './parts';
import { FormSelect } from '../shared/FilterSelect';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import { MW_INDICATOR_CATALOGUE, type Assertion, type Deficiency, type ExceptionStatus, type IcfrEngagement, type Severity, type SignificantAccount } from './types';

const fmt = (n: number) => formatINR(n);
const fmtFull = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('toggle', on && 'on')} />;
}

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
export function ScopeView() {
  const { eng } = useIcfr();
  const r = eng.rules;
  // The ground rules are planning-time decisions: fixed before testing starts and
  // read-only for the rest of the engagement. Re-cutting materiality after seeing
  // results would re-grade findings already reached — so this screen only reads,
  // and any indicated change is carried into next period's planning instead.
  const M = eng.materiality;
  const pm = eng.performanceMateriality;
  const ctt = r.clearlyTrivial;
  const band = r.sdBandPct;
  const sd = M * band / 100;
  const pmPct = M ? Math.round((pm / M) * 100) : 0;
  const cttPct = M ? Math.round((ctt / M) * 100) : 0;

  const LADDER: { label: string; band: string; tone: string }[] = [
    { label: 'Clearly trivial', band: `≤ ${fmtFull(ctt)}`, tone: 'text-ink-500 bg-paper-50 border-canvas-border' },
    { label: 'Deficiency', band: `> ${fmtFull(ctt)} and < ${fmtFull(sd)}`, tone: 'text-mitigated-700 bg-mitigated-50/50 border-mitigated-200' },
    { label: 'Significant deficiency', band: `≥ ${fmtFull(sd)}  ·  ${band}% of materiality`, tone: 'text-high-700 bg-high-50/50 border-high-200' },
    { label: 'Material weakness', band: `≥ ${fmtFull(M)}  or any MW indicator`, tone: 'text-risk-700 bg-risk-50/50 border-risk-200' },
  ];

  // What this period's exceptions say about the thresholds. Advisory only: it
  // feeds NEXT period's planning, never a mid-flight re-grade of these findings.
  const advice = useMemo(() => scopeAdvice(eng), [eng]);

  return (
    <div className="space-y-5">
      {/* getting back up is the breadcrumb's job (rendered by the shell):
          Engagements / engagement / Materiality & scope */}
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Materiality &amp; scope</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">The ground rules that drive how every exception is evaluated, sized, and routed. Fixed at planning — they apply across all controls for the whole period.</p>
      </div>

      {/* materiality — read-only: these are planning-time decisions */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Target size={15} className="text-brand-600" /> Materiality</h2>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-500 bg-paper-50 border border-canvas-border rounded-full px-2.5 h-[22px]"
            title="Materiality is set before testing begins. Changing it mid-period would re-grade exceptions already concluded.">
            <Lock size={11} className="text-ink-400" /> Set at planning · read-only
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Money label="Overall materiality" value={M} hint="The financial-statement materiality benchmark." />
          <Money label="Performance materiality" value={pm} hint={`${pmPct}% of overall — the testing threshold.`} />
          <Money label="Clearly-trivial threshold" value={ctt} hint={`${cttPct}% of overall — below this, logged but not evaluated.`} />
        </div>
      </section>

      {/* what the period's exceptions say about the thresholds — advisory, next-period */}
      <section className={cn('rounded-2xl border p-5', advice.tone === 'note' ? 'border-mitigated-200 bg-mitigated-50/40' : 'border-canvas-border bg-canvas-elevated')}>
        <div className="flex items-start gap-3">
          <span className={cn('shrink-0 mt-0.5', advice.tone === 'note' ? 'text-mitigated-700' : 'text-compliant-700')}>
            {advice.tone === 'note' ? <Lightbulb size={16} /> : <CheckCircle2 size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-bold text-ink-800">{advice.headline}</h2>
            <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">{advice.detail}</p>
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <span className="text-[11px] tabular-nums text-ink-500 bg-canvas-elevated border border-canvas-border rounded-lg px-2 py-1">{advice.evidence}</span>
              <span className="text-[11px] text-ink-400">Carried into next period's planning — this period's grades stand.</span>
            </div>
          </div>
        </div>
      </section>

      {/* severity ladder */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Exception severity ladder</h2>
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-600"><Sliders size={13} /> Significant-deficiency band
            <b className="font-semibold tabular-nums text-ink-800">{band}</b>
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
          <Pill tone={r.aggregate ? 'compliant' : 'draft'}>{r.aggregate ? 'On' : 'Off'}</Pill>
        </div>
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4 flex items-start justify-between gap-3">
          <div><div className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Route size={14} className="text-brand-600" /> Auto-routing</div><p className="text-[12px] text-ink-500 mt-1">Route an exception to the owner (remediation) or the auditor (sign-off) by computed severity.</p></div>
          <Pill tone={r.autoRoute ? 'compliant' : 'draft'}>{r.autoRoute ? 'On' : 'Off'}</Pill>
        </div>
      </section>

      {/* MW indicators */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated p-5">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5 mb-1"><AlertTriangle size={15} className="text-risk-600" /> Material-weakness indicators</h2>
        <p className="text-[12px] text-ink-500 mb-3">If any in-force indicator is present on an exception, it is a material weakness regardless of magnitude.</p>
        <div className="space-y-1.5">
          {/* the in-force set reads as plain rows — never a live switch */}
          {MW_INDICATOR_CATALOGUE.map(ind => {
            const on = r.mwIndicators.includes(ind);
            return (
              <div key={ind} className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border', on ? 'border-risk-200 bg-risk-50/40' : 'border-canvas-border')}>
                <span className={cn('w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0', on ? 'bg-risk-600 border-risk-600 text-white' : 'border-ink-300')}>{on && <CheckCircle2 size={12} />}</span>
                <span className="text-[12.5px] text-ink-800">{ind}</span>
              </div>
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

      {/* significant accounts — the scoping front door: editable, with WCGWs */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <header className="px-4 py-3 border-b border-canvas-border flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><ShieldCheck size={15} className="text-brand-600" /> Significant accounts &amp; disclosures</h2>
          <span className="text-[11.5px] text-ink-400">{eng.accounts.filter(a => a.inScope).length} in scope · scoping unit = account × assertion</span>
        </header>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-ink-500 border-b border-canvas-border">{['Account', 'Balance', 'Process', 'In scope', 'Relevant assertions', 'What could go wrong'].map(h => <th key={h} className="text-left font-semibold uppercase tracking-wide text-[10px] px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {eng.accounts.map(a => <AccountRow key={a.id} a={a} canEdit={false} onPatch={() => {}} />)}
          </tbody>
        </table>
      </section>

      {/* coverage — where a relevant assertion has no key control, that's a gap */}
      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <header className="px-4 py-3 border-b border-canvas-border">
          <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Target size={15} className="text-brand-600" /> Coverage — account × assertion</h2>
          <p className="text-[11.5px] text-ink-400 mt-0.5">Key controls in each account's process, per relevant assertion. A relevant assertion with no key control is a design gap — a WCGW with nothing mapped to it.</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-ink-500 border-b border-canvas-border">
                <th className="text-left font-semibold uppercase tracking-wide text-[10px] px-4 py-2">Account</th>
                {ALL_ASSERTIONS.map(as_ => <th key={as_} className="text-center font-semibold uppercase tracking-wide text-[9.5px] px-2 py-2 whitespace-nowrap">{as_.replace(' / Occurrence', '/Occ.')}</th>)}
              </tr>
            </thead>
            <tbody>
              {eng.accounts.filter(a => a.inScope).map(a => (
                <tr key={a.id} className="border-b border-canvas-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink-800 whitespace-nowrap">{a.name}<span className="text-ink-400 font-normal"> · {a.process ?? '—'}</span></td>
                  {ALL_ASSERTIONS.map(as_ => {
                    const relevant = a.assertions.includes(as_);
                    if (!relevant) return <td key={as_} className="text-center text-ink-300 px-2 py-2.5">—</td>;
                    const n = eng.controls.filter(c => c.isKey && c.process === a.process && c.assertions.includes(as_)).length;
                    return (
                      <td key={as_} className="text-center px-2 py-2.5">
                        {n > 0
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-compliant-700 bg-compliant-50 border border-compliant-200 rounded-md px-1.5 h-5 tabular-nums" title={`${n} key control${n === 1 ? '' : 's'} in ${a.process}`}>{n}</span>
                          : <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-risk-700 bg-risk-50 border border-risk-200 rounded-md px-1.5 h-5" title="Relevant assertion with no key control — design gap by absence">gap</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const ALL_ASSERTIONS: Assertion[] = ['Existence / Occurrence', 'Completeness', 'Accuracy', 'Valuation', 'Cut-off', 'Rights & Obligations', 'Presentation'];

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
// disabled form control for someone who can't set it.
/** A threshold as stated at planning — read-only; these are never edited in-period. */
function Money({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-ink-500 mb-1.5">{label}</div>
      <div className="h-10 flex items-center text-[14px] font-semibold tabular-nums text-ink-800">{fmtFull(value)}</div>
      <div className="text-[11px] text-ink-400 mt-1">{hint}</div>
    </div>
  );
}


// Prudent-official override — judgment can raise the grade above the math, never
// lower it, and always with a recorded rationale (the handbook's judgment floor).
function PrudentRow({ d, baseFinal, onApply, onClear }: { d: Deficiency; baseFinal: Severity; onApply: (to: Severity, rationale: string) => void; onClear: () => void }) {
  const [pending, setPending] = useState<Severity | null>(null);
  const [note, setNote] = useState('');
  const options = (['Significant Deficiency', 'Material Weakness'] as Severity[]).filter(s => SEVERITY_RANK[s] > SEVERITY_RANK[baseFinal]);
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

// The remediation plan — the owner's commitment: the action on the root cause,
// who does it, by when, plus the evidence behind "done". Editable only in the
// owner's hat while the exception is still theirs; everyone else reads it.
function RemediationPlan({ d, isOwner, onPatch, onAttach }: { d: Deficiency; isOwner: boolean; onPatch: (patch: Partial<Deficiency['remediation']>) => void; onAttach: (fileName: string) => void }) {
  const r = d.remediation;
  const editable = isOwner && (d.status === 'Identified' || d.status === 'Remediation');
  const overdue = dueIsPast(r.date) && r.status !== 'Done';
  const files = r.evidence ?? [];
  return (
    <div className="rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-ink-500 mb-1.5">
        <RotateCcw size={12} /> Remediation{isOwner ? ' — your commitment' : ''}
        <span className="ml-auto normal-case tracking-normal font-medium text-ink-600">{r.status}</span>
        {overdue && <span className="normal-case tracking-normal inline-flex items-center gap-1 text-[10.5px] font-bold text-risk-700 bg-risk-50 border border-risk-200 rounded px-1.5 h-5"><AlertTriangle size={10} /> overdue — escalate</span>}
      </div>
      {editable ? (
        <div className="space-y-1.5">
          <input value={r.action} onChange={e => onPatch({ action: e.target.value })}
            placeholder="What fixes the root cause — not the symptom (e.g. normalise the match key, not recover the 4 invoices)"
            className="w-full h-8 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[12.5px] text-ink-800 focus:outline-none focus:border-brand-300" />
          <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
            <span className="text-ink-400">Owner</span>
            <input value={r.owner} onChange={e => onPatch({ owner: e.target.value })} placeholder="Who does it"
              className="h-7 w-56 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[11.5px] focus:outline-none focus:border-brand-300" />
            <span className="text-ink-400">Due</span>
            <input type="date" value={toDateInputValue(r.date)} onChange={e => onPatch({ date: e.target.value || null })}
              className={cn('h-7 w-40 px-2 rounded-md border bg-canvas-elevated text-[11.5px] tabular-nums focus:outline-none focus:border-brand-300', overdue ? 'border-risk-300 text-risk-700' : 'border-canvas-border')} />
          </div>
        </div>
      ) : (
        <>
          <div className="text-[12.5px] text-ink-700">{r.action}</div>
          <div className="text-[11.5px] text-ink-400 mt-0.5">Owner {r.owner} · due {formatDueLabel(r.date)}{d.retest && <> · retest <span className={d.retest.result === 'Pass' ? 'text-compliant-700 font-semibold' : 'text-risk-700 font-semibold'}>{d.retest.result}</span></>}{d.signoff && <> · signed off by {d.signoff.by}</>}</div>
        </>
      )}
      {/* evidence — "done" needs proof before the fix can be submitted for retest */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <span className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400">Evidence</span>
        {files.map(f => (
          <span key={f.id} className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-canvas-border bg-canvas-elevated text-[10.5px] font-semibold text-ink-600"><Paperclip size={10} /> {f.name}</span>
        ))}
        {files.length === 0 && !editable && <span className="text-[11px] text-ink-400">none attached</span>}
        {editable && (
          <button onClick={() => onAttach(`${d.id.toLowerCase()}-fix-evidence${files.length ? `-${files.length + 1}` : ''}.pdf`)}
            className="h-6 px-2 rounded-md border border-dashed border-canvas-border text-[10.5px] font-semibold text-ink-500 hover:text-brand-700 hover:border-brand-300 cursor-pointer inline-flex items-center gap-1 transition-colors"><Paperclip size={10} /> Attach evidence</button>
        )}
        {editable && files.length === 0 && <span className="text-[10.5px] text-mitigated-700">required before you can submit for retest</span>}
      </div>
    </div>
  );
}

// The severity conclusion — lead with the FINAL grade as a pill; the derivation (the
// struck-through cap/bump chain) is "working", tucked behind a toggle so the card
// reads as an answer first, an equation only on request.
function SeverityConclusion({ d, assess, M, showMateriality }: { d: Deficiency; assess: ReturnType<typeof assessSeverity>; M: number; showMateriality: boolean }) {
  const [showWorking, setShowWorking] = useState(false);
  return (
    <div className="pt-2 border-t border-canvas-border">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wide font-semibold text-ink-400">Conclusion</span>
        <SeverityPill s={assess.final} />
        <button onClick={() => setShowWorking(w => !w)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
          {showWorking ? 'Hide working' : 'Show working'} <span className="text-[9px] leading-none">{showWorking ? '▾' : '▸'}</span>
        </button>
      </div>
      {showWorking && (
        <p className="text-[12px] text-ink-600 mt-2">
          → {d.likelihood} × {fmt(d.magnitude)}{showMateriality && <> (vs {fmt(M)})</>}{d.mwIndicators.length ? ' + MW indicator' : ''} ⇒ <span className={cn('font-bold', assess.capped ? 'text-ink-500 line-through' : 'text-ink-800')}>{assess.raw}</span>
          {assess.capped && <> · capped by {d.compensatingControlId} (effective) ⇒ <span className={cn('font-bold', assess.bumped ? 'text-ink-500 line-through' : 'text-ink-800')}>{assess.bumped ? 'Significant Deficiency' : assess.final}</span></>}
          {assess.bumped && <> · prudent-official ⇒ <span className="font-bold text-high-700">{assess.final}</span></>}
        </p>
      )}
    </div>
  );
}

// ─── Exceptions — the lifecycle ──────────────────────────────────────────────────
const STAGES: ExceptionStatus[] = ['Identified', 'Remediation', 'Retest', 'Awaiting reviewer', 'Closed'];
const STATUS_TONE: Record<ExceptionStatus, Tone> = { Identified: 'high', Remediation: 'mitigated', Retest: 'evidence', 'Awaiting reviewer': 'info', Closed: 'compliant' };
const MW_INDICATORS = MW_INDICATOR_CATALOGUE as readonly string[];

export function DeficienciesView() {
  const { eng, role, me, meOwner, openControl, updateDeficiency, setExceptionStatus, recordRetest, signOffException, updateRemediation, addRemediationEvidence } = useIcfr();
  const M = eng.materiality; const rules = eng.rules;
  // closing an exception is the terminal four-eyes act — it commits behind an attest confirm
  const [closingId, setClosingId] = useState<string | null>(null);
  // three lines, three lanes: the owner remediates, the auditor evaluates &
  // retests, the reviewer closes — each hat only sees its own actions.
  const isAuditor = role === 'auditor';
  const isOwner = role === 'risk-owner';
  // person-lane: the owner sees only exceptions riding their own controls
  const defs = isOwner ? eng.deficiencies.filter(d => eng.controls.find(c => c.id === d.controlId)?.owner === meOwner) : eng.deficiencies;
  // aggregation groups on offer: every group already in use plus each process name
  const groupOptions = Array.from(new Set([
    ...eng.deficiencies.map(d => d.aggregationGroup).filter((g): g is string => !!g),
    ...eng.controls.map(c => c.process),
  ])).sort();

  return (
    <div className="space-y-4">
      {/* getting back up is the breadcrumb's job (rendered by the shell):
          Engagements / engagement / Exceptions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{isOwner ? 'My exceptions' : 'Exceptions'}</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">
            {isOwner
              ? 'Exceptions on your controls — commit the plan, execute the fix, and submit for retest. The auditor evaluates severity; the reviewer closes.'
              : <>Severity is computed against materiality ({fmt(M)}). Three lanes: the owner remediates, the auditor evaluates &amp; retests, the reviewer closes.</>}
          </p>
        </div>
      </div>

      {/* aggregation — engagement-wide math, audit-side only; clearly-trivial items
          are logged but never aggregated (5% rule) */}
      {rules.aggregate && !isOwner && (() => {
        const LRANK: Record<string, number> = { Remote: 0, 'Reasonably possible': 1, Probable: 2 };
        const LBYR = ['Remote', 'Reasonably possible', 'Probable'] as const;
        const groups = new Map<string, typeof eng.deficiencies>();
        const trivialByGroup = new Map<string, number>();
        eng.deficiencies.forEach(d => {
          const k = d.aggregationGroup ?? 'Ungrouped';
          if (isClearlyTrivial(d.magnitude, rules)) { trivialByGroup.set(k, (trivialByGroup.get(k) ?? 0) + 1); return; }
          groups.set(k, [...(groups.get(k) ?? []), d]);
        });
        const agg = Array.from(groups.entries()).filter(([, ds]) => ds.length > 1);
        if (!agg.length) return null;
        return (
          <div className="space-y-2">
            <h2 className="text-[12px] font-semibold text-ink-500 uppercase tracking-wide">Aggregation — individually-minor deficiencies combine by commonality</h2>
            {agg.map(([group, ds]) => {
              const sum = ds.reduce((n, d) => n + d.magnitude, 0);
              const lk = LBYR[Math.max(...ds.map(d => LRANK[d.likelihood] ?? 0))]!;
              const mw = Array.from(new Set(ds.flatMap(d => d.mwIndicators)));
              const trivial = trivialByGroup.get(group) ?? 0;
              return (
                <div key={group} className="rounded-xl border border-mitigated-200 bg-mitigated-50/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[12.5px] text-ink-700">
                    <span className="font-semibold">{group}</span> · {ds.length} deficiencies · combined {fmt(sum)} (vs {fmt(M)})
                    {trivial > 0 && <span className="text-ink-400"> · {trivial} clearly-trivial logged, not aggregated</span>}
                  </div>
                  <SeverityPill s={computeSeverity(lk, sum, M, mw, rules.sdBandPct / 100)} />
                </div>
              );
            })}
          </div>
        );
      })()}

      {defs.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 text-center text-ink-500">{isOwner ? 'No exceptions on your controls.' : 'No exceptions — all tested controls effective.'}</div>
      ) : (
        <div className="space-y-3">
          {defs.map(d => {
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

                {/* severity + remediation — the owner's card leads with THEIR work (visual reverse) */}
                <div className={cn('mt-3 flex flex-col gap-3', isOwner && 'flex-col-reverse')}>
                {/* severity — the auditor evaluates; owner and reviewer read the grade */}
                {isAuditor ? (
                  <div className="rounded-lg border border-canvas-border p-3 space-y-2.5">
                    <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Severity inputs — recomputed live vs the ground rules</div>
                    <div className="flex items-center gap-2 flex-wrap text-[12px]">
                      <span className="text-ink-500 w-[120px]">Likelihood</span>
                      {(['Remote', 'Reasonably possible', 'Probable'] as const).map(l => (
                        <button key={l} onClick={() => updateDeficiency(d.id, { likelihood: l })} className={cn('h-7 px-2.5 rounded-md border text-[11.5px] font-semibold cursor-pointer transition-colors', d.likelihood === l ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{l}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-ink-500 w-[120px]">Exposure ₹</span>
                      <input type="number" value={d.magnitude} onChange={e => updateDeficiency(d.id, { magnitude: Number(e.target.value) || 0 })} className="h-8 w-44 px-2.5 rounded-md border border-canvas-border text-[12.5px] tabular-nums focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
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
                        assess.capped ? <span className="text-compliant-700 text-[11px] font-semibold">capping Material Weakness → Significant Deficiency — never clears the exception</span>
                        : assess.capBlocked === 'not-effective' ? <span className="text-high-700 text-[11px] font-semibold">no cap — {d.compensatingControlId} isn't concluded effective in this engagement</span>
                        : assess.capBlocked === 'mw-indicator' ? <span className="text-risk-700 text-[11px] font-semibold">no cap — MW indicators can't be argued down</span>
                        : <span className="text-ink-400 text-[11px]">in place — the cap only rescues a Material Weakness grade, and never clears the exception</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] flex-wrap">
                      <span className="text-ink-500 w-[120px]">Aggregation group</span>
                      <FormSelect value={d.aggregationGroup ?? ''} onChange={v => updateDeficiency(d.id, { aggregationGroup: v || undefined })}
                        options={[{ value: '', label: 'Ungrouped' }, ...groupOptions]}
                        className="h-8 px-2.5 rounded-md border border-canvas-border text-[12px] bg-canvas-elevated focus:outline-none focus:border-brand-300"
                        ariaLabel="Aggregation group" />
                      <span className="text-ink-400 text-[11px]">minor deficiencies combine by commonality — account, process, or root cause</span>
                    </div>
                    <PrudentRow d={d} baseFinal={assessSeverity({ ...d, prudentOverride: undefined }, eng).final}
                      onApply={(to, rationale) => updateDeficiency(d.id, { prudentOverride: { to, rationale, by: me, at: 'just now' } })}
                      onClear={() => updateDeficiency(d.id, { prudentOverride: undefined })} />
                    <SeverityConclusion d={d} assess={assess} M={M} showMateriality />
                  </div>
                ) : (
                  <div className="rounded-lg border border-canvas-border bg-paper-50/30 p-3 space-y-1.5">
                    <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Severity — evaluated by the auditor{isOwner ? '; your part is the remediation below' : ''}</div>
                    <div className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                      <span className="text-ink-700"><span className="text-ink-400">Likelihood</span> · {d.likelihood}</span>
                      <span className="text-ink-700"><span className="text-ink-400">Exposure</span> · {fmt(d.magnitude)}{ct ? ' (clearly trivial)' : ''}</span>
                      <span className="text-ink-700"><span className="text-ink-400">MW indicators</span> · {d.mwIndicators.length ? `${d.mwIndicators.length} in force` : 'None'}</span>
                      <span className="text-ink-700"><span className="text-ink-400">Compensating control</span> · {d.compensatingControlId ?? 'None'}</span>
                      <span className="text-ink-700"><span className="text-ink-400">Aggregation group</span> · {d.aggregationGroup ?? 'Ungrouped'}</span>
                      {d.prudentOverride && <span className="text-high-700 font-medium">Prudent-official — raised to {d.prudentOverride.to}</span>}
                    </div>
                    {/* the owner sees their classification, never the engagement's thresholds */}
                    <SeverityConclusion d={d} assess={assess} M={M} showMateriality={!isOwner} />
                  </div>
                )}

                {/* remediation — the owner's plan; editable in their hat until submitted */}
                <RemediationPlan d={d} isOwner={isOwner} onPatch={patch => updateRemediation(d.id, patch)} onAttach={name => addRemediationEvidence(d.id, name)} />
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {/* owner's lane: start remediation (auditor may route it too), then submit the fix for retest */}
                  {d.status === 'Identified' && (
                    role !== 'reviewer'
                      ? <button onClick={() => setExceptionStatus(d.id, 'Remediation')} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Start remediation</button>
                      : <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><RotateCcw size={14} className="text-ink-400" /> Awaiting remediation — {d.remediation.owner}</span>
                  )}
                  {d.status === 'Remediation' && (
                    isOwner
                      ? (() => {
                          const hasEvidence = (d.remediation.evidence?.length ?? 0) > 0;
                          return (
                            <button onClick={() => setExceptionStatus(d.id, 'Retest')} disabled={!hasEvidence}
                              title={hasEvidence ? 'Marks your fix as done and hands it to the auditor' : 'Attach evidence of the fix first — "done" needs proof'}
                              className="h-8 px-3 rounded-lg bg-evidence-600 text-white text-[12px] font-semibold enabled:hover:bg-evidence-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5">Fixed — submit for retest</button>
                          );
                        })()
                      : <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><RotateCcw size={14} className="text-ink-400" /> With {d.remediation.owner} for remediation — the owner submits it for retest</span>
                  )}
                  {/* auditor's lane: only the auditor records retest results — never the owner of the fix */}
                  {d.status === 'Retest' && (
                    isAuditor ? <>
                      <button onClick={() => recordRetest(d.id, 'Pass')} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Retest passed — to reviewer</button>
                      <button onClick={() => recordRetest(d.id, 'Fail')} className="h-8 px-3 rounded-lg border border-risk-300 text-risk-700 text-[12px] font-semibold hover:bg-risk-50 cursor-pointer inline-flex items-center gap-1.5"><XCircle size={13} /> Retest failed</button>
                    </> : <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-ink-400" /> With the auditor for retest{isOwner ? ' — you never test your own fix' : ''}</span>
                  )}
                  {/* four-eyes: only the reviewer hat closes, and never the person who ran the retest */}
                  {d.status === 'Awaiting reviewer' && (
                    role !== 'reviewer' ? (
                      <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-ink-400" /> Awaiting reviewer — only the reviewer closes{d.retest ? ` (retest ${d.retest.result} · ${d.retest.by})` : ''}</span>
                    ) : d.retest && d.retest.by === me ? (
                      <span className="text-[12px] font-semibold text-high-700 inline-flex items-center gap-1.5"><XCircle size={14} /> A different person must close — you recorded this retest.</span>
                    ) : (
                      <button onClick={() => setClosingId(d.id)} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
                    )
                  )}
                  {d.status === 'Closed' && d.signoff && <span className="text-[12px] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Closed — signed off by {d.signoff.by}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* attest confirm — closing is the terminal four-eyes act, so it never commits on a bare click */}
      {closingId && (
        <div className="modal-backdrop" onClick={() => setClosingId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900">Close this exception?</h2>
                <button onClick={() => setClosingId(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed">Confirm — close <span className="font-mono font-semibold text-ink-800">{closingId}</span>? Your reviewer sign-off is recorded against it. Closing is the final act in the four-eyes review and can't be undone.</p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setClosingId(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={() => { signOffException(closingId); setClosingId(null); }} className="h-9 px-3.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
