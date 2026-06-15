import { ArrowLeft, FileWarning, Target, ShieldCheck, AlertTriangle, RotateCcw } from 'lucide-react';
import { useIcfr } from './store';
import { formatINR, isReasonablyPossible, severityOf } from './helpers';
import { SeverityPill } from './parts';
import { Pill } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';

const MW_INDICATORS = ['Restatement', 'Senior-mgmt fraud', 'Material misstatement ICFR missed', 'Ineffective governance'];

export function DeficienciesView() {
  const { eng, back, openControl, updateDeficiency } = useIcfr();
  const M = eng.materiality;
  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Command center</button>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Deficiencies</h1>
          <p className="text-[13px] text-ink-500 mt-0.5">Severity is computed: likelihood × magnitude vs materiality ({formatINR(M)}), with MW indicators. Remediation never lowers it.</p>
        </div>
      </div>

      {eng.deficiencies.length === 0 ? (
        <div className="rounded-2xl border border-canvas-border bg-canvas-elevated p-12 text-center text-ink-500">No deficiencies — all tested controls effective.</div>
      ) : (
        <div className="space-y-3">
          {eng.deficiencies.map(d => {
            const sev = severityOf(d, M);
            const material = d.magnitude >= M;
            return (
              <div key={d.id} className="rounded-2xl border border-canvas-border bg-canvas-elevated p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-ink-600">{d.id}</span>
                    <button onClick={() => openControl(d.controlId)} className="font-mono text-[12px] text-brand-700 hover:underline cursor-pointer">{d.controlId}</button>
                    <Pill tone={d.kind === 'design' ? 'mitigated' : 'evidence'}>{d.kind === 'design' ? 'Design' : 'Operating'}</Pill>
                  </div>
                  <SeverityPill s={sev} />
                </div>
                <p className="text-[13px] text-ink-800 leading-relaxed">{d.description}</p>
                <p className="text-[12px] text-ink-500 mt-1"><span className="font-semibold">Root cause:</span> {d.rootCause}</p>

                {/* editable severity inputs — recomputed live */}
                <div className="mt-3 rounded-lg border border-canvas-border p-3 space-y-2.5">
                  <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Severity inputs — recomputed live</div>
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <span className="text-ink-500 w-[120px]">Likelihood</span>
                    {(['Remote', 'Reasonably possible', 'Probable'] as const).map(l => (
                      <button key={l} onClick={() => updateDeficiency(d.id, { likelihood: l })} className={cn('h-7 px-2.5 rounded-md border text-[11.5px] font-semibold cursor-pointer transition-colors', d.likelihood === l ? 'bg-brand-50 border-brand-200 text-brand-700' : 'border-canvas-border text-ink-600 hover:bg-paper-50')}>{l}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-ink-500 w-[120px]">Magnitude ₹</span>
                    <input type="number" value={d.magnitude} onChange={e => updateDeficiency(d.id, { magnitude: Number(e.target.value) || 0 })} className="h-8 w-44 px-2.5 rounded-md border border-canvas-border text-[12.5px] tabular-nums focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50" />
                    <span className={cn('text-[11.5px]', material ? 'text-risk-700 font-semibold' : 'text-ink-400')}>{material ? '≥' : '<'} materiality {formatINR(M)}</span>
                  </div>
                  <div className="flex items-start gap-2 text-[12px] flex-wrap">
                    <span className="text-ink-500 w-[120px] mt-1">MW indicators</span>
                    {MW_INDICATORS.map(ind => { const on = d.mwIndicators.includes(ind); return <button key={ind} onClick={() => updateDeficiency(d.id, { mwIndicators: on ? d.mwIndicators.filter(x => x !== ind) : [...d.mwIndicators, ind] })} className={cn('h-7 px-2.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors', on ? 'bg-risk-50 border-risk-700/40 text-risk-700' : 'border-canvas-border text-ink-500 hover:bg-paper-50')}>{ind}</button>; })}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] flex-wrap">
                    <span className="text-ink-500 w-[120px]">Compensating control</span>
                    <select value={d.compensatingControlId ?? ''} onChange={e => updateDeficiency(d.id, { compensatingControlId: e.target.value || undefined })} className="h-8 px-2.5 rounded-md border border-canvas-border text-[12px] bg-white cursor-pointer focus:outline-none focus:border-brand-300">
                      <option value="">None</option>
                      {eng.controls.filter(c => c.id !== d.controlId).map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                    </select>
                    {d.compensatingControlId && <span className="text-ink-400 text-[11px]">caps severity — never clears the deficiency</span>}
                  </div>
                  <p className="text-[12px] text-ink-600 pt-2 border-t border-canvas-border">→ {d.likelihood} × {formatINR(d.magnitude)} (vs {formatINR(M)}){d.mwIndicators.length ? ' + MW indicator' : ''} ⇒ <span className="font-bold text-ink-800">{sev}</span></p>
                </div>

                {/* remediation (tracked; does not lower severity) */}
                <div className="mt-3 rounded-lg border border-canvas-border bg-paper-50/50 px-3 py-2.5">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-ink-500 mb-1"><RotateCcw size={12} /> Remediation</div>
                  <div className="text-[12.5px] text-ink-700">{d.remediation.action}</div>
                  <div className="text-[11.5px] text-ink-400 mt-0.5">Owner {d.remediation.owner} · due {d.remediation.date ?? '—'} · <span className="font-medium text-ink-600">{d.remediation.status}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-lg border border-canvas-border px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-ink-400 font-semibold">{label}</div><div className={cn('font-medium mt-0.5', tone)}>{value}</div></div>;
}

export function ScopeView() {
  const { eng, back } = useIcfr();
  const keyControls = eng.controls.filter(c => c.isKey).length;
  return (
    <div className="space-y-4">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer transition-colors"><ArrowLeft size={14} /> Command center</button>
      <div>
        <h1 className="text-[22px] font-bold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>Scope & materiality</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">Materiality drives which accounts &amp; assertions are in scope, and which key controls we test.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Target size={15} className="text-brand-600" />} label="Overall materiality" value={formatINR(eng.materiality)} />
        <Stat icon={<Target size={15} className="text-ink-400" />} label="Performance materiality" value={formatINR(eng.performanceMateriality)} />
        <Stat icon={<ShieldCheck size={15} className="text-compliant-700" />} label="Key controls in scope" value={String(keyControls)} />
        <Stat icon={<AlertTriangle size={15} className="text-mitigated-700" />} label="Accounts in scope" value={String(eng.accounts.filter(a => a.inScope).length)} />
      </div>

      <section className="rounded-2xl border border-canvas-border bg-canvas-elevated overflow-hidden">
        <header className="px-4 py-3 border-b border-canvas-border"><h2 className="text-[13px] font-semibold text-ink-800">Significant accounts &amp; disclosures</h2></header>
        <table className="w-full text-[12.5px]">
          <thead><tr className="text-ink-500 border-b border-canvas-border">{['Account', 'Balance', 'In scope', 'Assertions'].map(h => <th key={h} className="text-left font-semibold uppercase tracking-wide text-[10px] px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {eng.accounts.map(a => (
              <tr key={a.id} className="border-b border-canvas-border/60 last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink-800">{a.name}</td>
                <td className="px-4 py-2.5 tabular-nums text-ink-600">{formatINR(a.balance)}</td>
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
      <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold mb-1.5">{icon}{label}</div>
      <div className="text-[18px] font-bold text-ink-900 tabular-nums">{value}</div>
    </div>
  );
}

export { FileWarning };
