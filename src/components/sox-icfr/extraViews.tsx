import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Building2, ChevronRight, Circle, History, Lightbulb, Lock, MessageSquare, Paperclip, Sparkles, Target, ShieldCheck, AlertTriangle, RotateCcw, Scale, CheckCircle2, Upload, X, XCircle, FileWarning, Sliders, GitMerge, Route } from 'lucide-react';
import { useIcfr } from './store';
import { defWord } from './flow';
import { useToast } from '../shared/Toast';
import { assessSeverity, computeSeverity, formatINR, isClearlyTrivial, isEngagementLocked, SEVERITY_RANK } from './helpers';
import { SeverityPill, Toggle } from './parts';
import { FormSelect } from '../shared/FilterSelect';
import MaterialityWorksheet from './MaterialityWorksheet';
import { Pill, type Tone } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';
import { EXPOSURE_LABEL, exposureTotal, GAP_HINT, GAP_LABEL, MW_INDICATOR_CATALOGUE, type Assertion, type Deficiency, type ExceptionStatus, type Exposure, type GapType, type IcfrEngagement, type Severity, type SignificantAccount, type TaskType } from './types';

/** A blank price sheet — patching one line must never drop the other two. */
const NO_EXPOSURE: Exposure = { recovery: 0, workingCapital: 0, leakage: 0 };
const GAP_TYPES: GapType[] = ['MDG', 'ITDG', 'TG'];

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
function RemediationPlan({ d, isOwner, locked = false, onPatch, onAttach }: { d: Deficiency; isOwner: boolean; locked?: boolean; onPatch: (patch: Partial<Deficiency['remediation']>) => void; onAttach: (fileName: string) => void }) {
  const r = d.remediation;
  // a sealed engagement retires the owner's pen along with everyone else's
  const editable = isOwner && !locked && (d.status === 'Identified' || d.status === 'Remediation');
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

// ─── Exceptions — the lifecycle ──────────────────────────────────────────────────
const STAGES: ExceptionStatus[] = ['Identified', 'Remediation', 'Retest', 'Awaiting reviewer', 'Closed'];
const STATUS_TONE: Record<ExceptionStatus, Tone> = { Identified: 'high', Remediation: 'mitigated', Retest: 'evidence', 'Awaiting reviewer': 'info', Closed: 'compliant' };
const MW_INDICATORS = MW_INDICATOR_CATALOGUE as readonly string[];

export function DeficienciesView() {
  const { eng, role, me, meOwner, openControl, updateDeficiency, setExceptionStatus, recordRetest, signOffException, reopenException, updateRemediation, addRemediationEvidence } = useIcfr();
  const { addToast } = useToast();
  // Classic engagements still call these exceptions; the rework renamed them.
  const W = defWord(eng.id);
  const M = eng.materiality; const rules = eng.rules;
  // closing an exception is the terminal four-eyes act — it commits behind an attest confirm
  const [closingId, setClosingId] = useState<string | null>(null);
  // …and a mistaken close comes back only with a recorded reason — same weight, same modal
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  // three lines, three lanes: the owner remediates, the auditor evaluates &
  // retests, the reviewer closes — each hat only sees its own actions.
  const isAuditor = role === 'auditor';
  const isOwner = role === 'risk-owner';
  // a countersigned engagement is a sealed record — the store already drops
  // every write, so the page must say so and put its pens away
  const locked = isEngagementLocked(eng);
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
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 text-center text-ink-500">{isOwner ? `No ${W.many} on your controls.` : `No ${W.many} — all tested controls effective.`}</div>
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
                    {/* the gap taxonomy — a design gap needs a redesign, a testing
                        gap needs discipline, so the label is what the fix follows */}
                    {d.gapType && <span title={GAP_HINT[d.gapType]}><Pill tone={d.gapType === 'TG' ? 'evidence' : 'high'}>{GAP_LABEL[d.gapType]}</Pill></span>}
                    {ct && <Pill tone="draft">Clearly trivial</Pill>}
                    {exposureTotal(d.exposure) > 0 && <span className="text-[11.5px] font-semibold text-ink-600 tabular-nums">worth {fmt(exposureTotal(d.exposure))}</span>}
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
                {/* severity — the auditor evaluates; owner and reviewer read the
                    grade. A sealed engagement retires the auditor's pens too. */}
                {isAuditor && !locked ? (
                  <div className="rounded-lg border border-canvas-border p-3 space-y-2.5">
                    <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Severity inputs — recomputed live vs the ground rules</div>
                    {/* what kind of gap it is — defaulted when the exception was
                        raised, re-typed here when the walkthrough says otherwise */}
                    <div className="flex items-center gap-2 flex-wrap text-[12px]">
                      <span className="text-ink-500 w-[120px]">Gap type</span>
                      {GAP_TYPES.map(g => (
                        <button key={g} title={GAP_HINT[g]} onClick={() => updateDeficiency(d.id, { gapType: g })}
                          className={cn('h-7 px-2.5 rounded-md border text-[11.5px] font-semibold cursor-pointer transition-colors', d.gapType === g ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{GAP_LABEL[g]}</button>
                      ))}
                    </div>
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
                    {/* …and what the gap is actually worth, split three ways. This
                        is money already on the table, not the exposure above: it is
                        what makes a finding something the CFO acts on. */}
                    <div className="rounded-md border border-canvas-border bg-paper-50/40 p-2.5 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Priced impact — what the gap is worth</span>
                        {exposureTotal(d.exposure) > 0 && <span className="text-[11.5px] font-semibold text-ink-700 tabular-nums">total {fmt(exposureTotal(d.exposure))}</span>}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(Object.keys(EXPOSURE_LABEL) as (keyof typeof EXPOSURE_LABEL)[]).map(k => (
                          <label key={k} className="block min-w-0">
                            <span className="block text-[10.5px] text-ink-500 mb-1">{EXPOSURE_LABEL[k]}</span>
                            <input type="number" value={d.exposure?.[k] ?? 0}
                              onChange={e => updateDeficiency(d.id, { exposure: { ...NO_EXPOSURE, ...d.exposure, [k]: Number(e.target.value) || 0 } })}
                              className="h-8 w-full px-2.5 rounded-md border border-canvas-border text-[12.5px] tabular-nums focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                          </label>
                        ))}
                      </div>
                      <input value={d.exposure?.basis ?? ''}
                        onChange={e => updateDeficiency(d.id, { exposure: { ...NO_EXPOSURE, ...d.exposure, basis: e.target.value } })}
                        placeholder="How the numbers were arrived at — the arithmetic behind the claim"
                        className="h-8 w-full px-2.5 rounded-md border border-canvas-border text-[12px] focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                    </div>
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
                      <span className="text-ink-700"><span className="text-ink-400">Gap type</span> · {d.gapType ? GAP_LABEL[d.gapType] : 'Not typed'}</span>
                      {exposureTotal(d.exposure) > 0 && (
                        <span className="text-ink-700 sm:col-span-2">
                          <span className="text-ink-400">Priced impact</span> · {fmt(exposureTotal(d.exposure))}
                          <span className="text-ink-400"> ({(Object.keys(EXPOSURE_LABEL) as (keyof typeof EXPOSURE_LABEL)[]).filter(k => (d.exposure as Exposure)[k] > 0).map(k => `${EXPOSURE_LABEL[k].toLowerCase()} ${fmt((d.exposure as Exposure)[k])}`).join(' · ')})</span>
                        </span>
                      )}
                      {d.prudentOverride && <span className="text-high-700 font-medium">Prudent-official — raised to {d.prudentOverride.to}</span>}
                    </div>
                    {/* the owner sees their classification, never the engagement's thresholds */}
                    <SeverityConclusion d={d} assess={assess} M={M} showMateriality={!isOwner} />
                  </div>
                )}

                {/* remediation — the owner's plan; editable in their hat until submitted */}
                <RemediationPlan d={d} isOwner={isOwner} locked={locked} onPatch={patch => updateRemediation(d.id, patch)} onAttach={name => addRemediationEvidence(d.id, name)} />
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {/* owner's lane: start remediation (auditor may route it too), then submit the fix for retest.
                      A sealed engagement shows the standing stage, never a pen. */}
                  {!locked && d.status === 'Identified' && (
                    role !== 'reviewer'
                      ? <button onClick={() => setExceptionStatus(d.id, 'Remediation')} className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Start remediation</button>
                      : <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><RotateCcw size={14} className="text-ink-400" /> Awaiting remediation — {d.remediation.owner}</span>
                  )}
                  {!locked && d.status === 'Remediation' && (
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
                  {!locked && d.status === 'Retest' && (
                    isAuditor ? <>
                      <button onClick={() => recordRetest(d.id, 'Pass')} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Retest passed — to reviewer</button>
                      <button onClick={() => recordRetest(d.id, 'Fail')} className="h-8 px-3 rounded-lg border border-risk-300 text-risk-700 text-[12px] font-semibold hover:bg-risk-50 cursor-pointer inline-flex items-center gap-1.5"><XCircle size={13} /> Retest failed</button>
                    </> : <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><CheckCircle2 size={14} className="text-ink-400" /> With the auditor for retest{isOwner ? ' — you never test your own fix' : ''}</span>
                  )}
                  {/* four-eyes: only the reviewer hat closes, and never the person who ran the retest */}
                  {!locked && d.status === 'Awaiting reviewer' && (
                    role !== 'reviewer' ? (
                      <span className="text-[12px] text-ink-500 inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-ink-400" /> Awaiting reviewer — only the reviewer closes{d.retest ? ` (retest ${d.retest.result} · ${d.retest.by})` : ''}</span>
                    ) : d.retest && d.retest.by === me ? (
                      <span className="text-[12px] font-semibold text-high-700 inline-flex items-center gap-1.5"><XCircle size={14} /> A different person must close — you recorded this retest.</span>
                    ) : (
                      <button onClick={() => setClosingId(d.id)} className="h-8 px-3 rounded-lg bg-compliant-600 text-white text-[12px] font-semibold hover:bg-compliant-700 cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
                    )
                  )}
                  {d.status === 'Closed' && d.signoff && <span className="text-[12px] font-semibold text-compliant-700 inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> Closed — signed off by {d.signoff.by}</span>}
                  {/* the way back in: audit-side only, never one-click — the reason is the record */}
                  {!locked && !isOwner && d.status === 'Closed' && (
                    <button onClick={() => { setReopeningId(d.id); setReopenReason(''); }}
                      className="h-8 px-3 rounded-lg border border-high-300 text-high-700 text-[12px] font-semibold hover:bg-high-50 cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reopen — reason required</button>
                  )}
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
                <h2 className="text-[15px] font-semibold text-ink-900">Close this {W.one}?</h2>
                <button onClick={() => setClosingId(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed">Confirm — close <span className="font-mono font-semibold text-ink-800">{closingId}</span>? Your reviewer sign-off is recorded against it. Closing is the final act in the four-eyes review — it comes back only through a reopen with a recorded reason.</p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setClosingId(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={() => { signOffException(closingId); setClosingId(null); }} className="h-9 px-3.5 rounded-lg bg-compliant-600 text-white text-[12.5px] font-semibold hover:bg-compliant-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Close — reviewer sign-off</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* reopen — the mirror of the close: same weight, and the reason IS the record */}
      {reopeningId && (
        <div className="modal-backdrop" onClick={() => setReopeningId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink-900 inline-flex items-center gap-2"><RotateCcw size={15} className="text-high-700" /> Reopen this exception?</h2>
                <button onClick={() => setReopeningId(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] text-ink-600 leading-relaxed"><span className="font-mono font-semibold text-ink-800">{reopeningId}</span> returns to Remediation — the reviewer sign-off and retest clear, and your reason goes on the trail with your name.</p>
              <textarea autoFocus value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={2}
                placeholder="Why it comes back — e.g. the fix regressed, or new occurrences surfaced"
                className="mt-3 w-full px-3 py-2 rounded-lg border border-canvas-border bg-canvas-elevated text-[12.5px] resize-none focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setReopeningId(null)} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button disabled={!reopenReason.trim()}
                  onClick={() => { reopenException(reopeningId, reopenReason.trim()); setReopeningId(null); addToast({ type: 'warning', title: 'Reopened', message: `${reopeningId} is back in remediation — the trail records why.` }); }}
                  className="h-9 px-3.5 rounded-lg bg-high-600 text-white text-[12.5px] font-semibold enabled:hover:bg-high-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center gap-1.5"><RotateCcw size={13} /> Reopen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
