import { ArrowLeft, FileWarning, Target, ShieldCheck, AlertTriangle, RotateCcw } from 'lucide-react';
import { useIcfr } from './store';
import { formatINR, isReasonablyPossible, severityOf } from './helpers';
import { SeverityPill } from './parts';
import { Pill } from '../shared/StatusBadge';
import { cn } from '../../lib/cn';

export function DeficienciesView() {
  const { eng, back, openControl } = useIcfr();
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

                {/* the computed severity derivation */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
                  <Cell label="Likelihood" value={d.likelihood} tone={isReasonablyPossible(d.likelihood) ? 'text-mitigated-700' : 'text-ink-700'} />
                  <Cell label="Magnitude" value={`${formatINR(d.magnitude)} ${material ? '≥' : '<'} materiality`} tone={material ? 'text-risk-700' : 'text-ink-700'} />
                  <Cell label="MW indicators" value={d.mwIndicators.length ? d.mwIndicators.join(', ') : 'None'} tone={d.mwIndicators.length ? 'text-risk-700' : 'text-ink-700'} />
                </div>
                <p className="text-[11.5px] text-ink-400 mt-1.5">→ {d.likelihood} × {formatINR(d.magnitude)} (vs {formatINR(M)}) ⇒ <span className="font-semibold text-ink-600">{sev}</span></p>

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
