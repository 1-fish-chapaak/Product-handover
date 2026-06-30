import { useMemo } from 'react';
import { FileSpreadsheet, ArrowRight, Star, ShieldCheck, Table2 } from 'lucide-react';
import { useIcfr } from './store';
import { controlConclusion, trackResult } from './helpers';
import { Pill } from '../shared/StatusBadge';
import type { Control } from './types';

const BINDINGS = ['#6A12CD', '#0369A1', '#550FA5', '#075985', '#8838DE', '#0284C7', '#3B0B72', '#1E3A5F'];
function spineColor(p: string): string { let h = 0; for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return BINDINGS[h % BINDINGS.length]!; }

interface RacmRow {
  process: string;
  controls: Control[];
  risks: number;
  key: number;
  designDone: number;
  operatingDone: number;
  effective: number;
  ineffective: number;
}

/**
 * RACM — the engagement's risk & control matrices, one per process. Each opens in
 * the full spreadsheet editor (the same experience as Process Hub → RACM), where
 * risks, controls, assertions and test attributes are edited cell-by-cell.
 */
export default function Racm() {
  const { eng, openRacmEditor } = useIcfr();

  const rows = useMemo<RacmRow[]>(() => {
    const map = new Map<string, Control[]>();
    eng.controls.forEach(c => { if (!map.has(c.process)) map.set(c.process, []); map.get(c.process)!.push(c); });
    return Array.from(map, ([process, controls]) => {
      const concl = controls.map(controlConclusion);
      return {
        process, controls,
        risks: new Set(controls.map(c => c.riskId)).size,
        key: controls.filter(c => c.isKey).length,
        designDone: controls.filter(c => trackResult(c.design) !== 'Not tested').length,
        operatingDone: controls.filter(c => trackResult(c.operating) !== 'Not tested').length,
        effective: concl.filter(x => x === 'Effective').length,
        ineffective: concl.filter(x => x === 'Ineffective').length,
      };
    }).sort((a, b) => b.controls.length - a.controls.length);
  }, [eng.controls]);

  const status = (r: RacmRow): { label: string; tone: Parameters<typeof Pill>[0]['tone'] } => {
    if (r.ineffective > 0) return { label: 'Exceptions', tone: 'risk' };
    if (r.designDone + r.operatingDone === 0) return { label: 'Draft', tone: 'draft' };
    if (r.effective === r.controls.length) return { label: 'Concluded', tone: 'compliant' };
    return { label: 'In testing', tone: 'evidence' };
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight" style={{ fontFamily: "'Source Serif 4', serif" }}>RACM</h1>
        <p className="text-[13px] text-ink-500 mt-0.5">{rows.length} risk &amp; control {rows.length === 1 ? 'matrix' : 'matrices'} · {eng.controls.length} controls · open one to edit in the spreadsheet</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(r => {
          const st = status(r);
          const color = spineColor(r.process);
          return (
            <button key={r.process} onClick={() => openRacmEditor({ name: `${r.process} RACM`, process: r.process })}
              className="group text-left rounded-2xl border border-canvas-border bg-canvas-elevated p-4 hover:border-brand-300 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.3)] transition-all cursor-pointer flex flex-col">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}><FileSpreadsheet size={19} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-ink-900 leading-snug truncate">{r.process} RACM</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wide px-1.5 h-[18px] inline-flex items-center rounded" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>{r.process}</span>
                    <span className="font-mono text-[10.5px] text-ink-400">v0.1</span>
                  </div>
                </div>
                <Pill tone={st.tone}>{st.label}</Pill>
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                {[
                  { v: r.risks, k: 'Risks' },
                  { v: r.controls.length, k: 'Controls' },
                  { v: r.key, k: 'Key' },
                ].map(s => (
                  <div key={s.k} className="rounded-lg bg-paper-50/60 border border-canvas-border/70 py-1.5">
                    <div className="text-[16px] font-bold tabular-nums text-ink-800 leading-none">{s.v}</div>
                    <div className="text-[10px] text-ink-400 font-medium mt-0.5">{s.k}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-ink-500">
                <span className="inline-flex items-center gap-1"><ShieldCheck size={12} className="text-compliant-600" /> {r.effective} effective</span>
                {r.ineffective > 0 && <span className="text-risk-700 font-medium">{r.ineffective} ineffective</span>}
                <span className="ml-auto tabular-nums text-ink-400">D {r.designDone}/{r.controls.length} · O {r.operatingDone}/{r.controls.length}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-canvas-border flex items-center justify-between">
                {r.key > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-ink-400"><Star size={11} className="text-mitigated-500 fill-mitigated-100" /> {r.key} key controls</span>}
                <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 group-hover:gap-1.5 transition-all">Open editor <ArrowRight size={13} /></span>
              </div>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="col-span-full text-center py-16 text-ink-400 text-[13px] rounded-2xl border border-dashed border-canvas-border">
            <Table2 size={20} className="mx-auto mb-2 opacity-40" /> No RACM yet for this engagement.
          </div>
        )}
      </div>
    </div>
  );
}
