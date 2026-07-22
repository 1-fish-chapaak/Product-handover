import { motion } from 'motion/react';
import {
  Building2, Landmark, Flag, FileSpreadsheet, Layers, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { SoxBreadcrumb } from '../../sox-icfr/parts';
import {
  BEYOND_TB, CYCLE_PHASES, fmtCr, type CyclePhase, type SoxProgramme,
} from './soxTestingData';

const PHASE_CLS: Record<CyclePhase, string> = {
  Scoping: 'bg-brand-50 text-brand-700',
  'Design testing': 'bg-evidence-50 text-evidence-700',
  'Interim testing': 'bg-evidence-50 text-evidence-700',
  'Roll-forward': 'bg-mitigated-50 text-mitigated-700',
  'Year-end testing': 'bg-mitigated-50 text-mitigated-700',
  Reporting: 'bg-compliant-50 text-compliant-700',
};

interface Props {
  programme: SoxProgramme;
  onBack: () => void;
}

export default function ProgrammeView({ programme: p, onBack }: Props) {
  const currentIdx = CYCLE_PHASES.findIndex(c => c.phase === p.phase);
  const totalControls = p.racms.reduce((s, r) => s + (r.controls ?? 0), 0);
  const totalEffective = p.racms.reduce((s, r) => s + (r.effective ?? 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <SoxBreadcrumb items={[{ label: 'SOX Testing', onClick: onBack }, { label: `${p.fy} programme` }]} />

      {/* Header — anchored to "as of", not a start/end range */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap pr-8">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-[20px] font-bold text-text leading-tight">{p.name}</h2>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${PHASE_CLS[p.phase]}`}>
              {p.phase}
            </span>
            {p.rolledFromFy && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-brand-50 text-brand-700">
                <RefreshCw size={10} /> Rolled forward from {p.rolledFromFy}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-text-secondary flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-semibold text-text">
              <Flag size={12} className="text-brand-700" />
              Opinion as of {p.asOf}
            </span>
            <span className="text-border">·</span>
            <span>{p.entities.length} entities</span>
            <span className="text-border">·</span>
            <span>{p.racms.length} in-scope processes</span>
            {p.owner && (<>
              <span className="text-border">·</span>
              <span>{p.owner}</span>
            </>)}
            {totalControls > 0 && (<>
              <span className="text-border">·</span>
              <span className="tabular-nums">{totalEffective}/{totalControls} controls effective</span>
            </>)}
          </div>
        </div>
      </div>

      {/* Cycle timeline — period-based, one anchor date */}
      <div className="border border-border-light rounded-xl bg-white p-4 mb-5">
        <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Audit cycle</div>
        <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {CYCLE_PHASES.map((c, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const anchor = c.phase === 'Year-end testing';
            return (
              <div key={c.phase} className="flex items-center gap-1.5 shrink-0">
                {i > 0 && <div className={`w-4 h-px ${done || active ? 'bg-brand-300' : 'bg-border-light'}`} />}
                <div className={`px-3 py-2 rounded-lg border min-w-[118px] ${
                  active ? 'border-primary/50 bg-primary/5'
                  : done ? 'border-border-light bg-surface-2/60'
                  : 'border-border-light bg-white'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {done && <CheckCircle2 size={11} className="text-compliant-700 shrink-0" />}
                    {anchor && !done && <Flag size={11} className={active ? 'text-primary' : 'text-text-muted'} />}
                    <span className={`text-[11.5px] font-semibold ${active ? 'text-primary' : done ? 'text-text-secondary' : 'text-text-muted'}`}>
                      {c.phase}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5 tabular-nums">{c.window}</div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-text-muted mt-2.5 leading-relaxed">
          There is no start and end date — the external auditor opines on control effectiveness <span className="font-semibold text-text-secondary">as of {p.asOf}</span>. Testing runs through the year; scoping opened the cycle in April.
        </p>
      </div>

      {/* Scope summary */}
      <div className="grid grid-cols-1 gap-3 mb-5">
        <div className="border border-border-light rounded-xl bg-white p-4">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Materiality</div>
          <SummaryRow label="Overall" value={fmtCr(p.materiality.overall)} strong
            note={p.materiality.basis === 'custom' ? 'Set directly' : `${p.materiality.pct}% of ${p.materiality.benchmarkLabel.toLowerCase()}`} />
          <SummaryRow label="Performance" value={fmtCr(p.materiality.overall * p.materiality.pmPct / 100)} note={`${p.materiality.pmPct}% of overall`} />
          <SummaryRow label="Clearly trivial" value={fmtCr(p.materiality.overall * p.materiality.cttPct / 100)} note={`${p.materiality.cttPct}% of overall`} last />
        </div>

        <div className="border border-border-light rounded-xl bg-white p-4">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Entities & trial balances</div>
          <div className="space-y-2">
            {p.entities.map(e => (
              <div key={e.id} className="flex items-center gap-2 min-w-0">
                {e.type === 'Holding'
                  ? <Landmark size={13} className="text-brand-700 shrink-0" />
                  : <Building2 size={13} className="text-text-muted shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-text truncate">{e.name} <span className="font-normal text-text-muted">· {e.ownership}%</span></div>
                  {e.tbFile && (
                    <div className="flex items-center gap-1 text-[10.5px] text-text-muted">
                      <FileSpreadsheet size={10} className="text-compliant-700 shrink-0" />
                      <span className="font-mono truncate">{e.tbFile}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-text-muted mt-3 pt-2.5 border-t border-border-light leading-relaxed">
            Opinion on the consolidated financials; scoping ran on each entity's own TB.
          </p>
        </div>

        <div className="border border-border-light rounded-xl bg-white p-4">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Scope funnel</div>
          <SummaryRow label="TB captions parsed" value={String(p.totalCaptions)} />
          <SummaryRow label="Above materiality" value={String(p.quantCount)} />
          <SummaryRow label="Qualitative scope-ins" value={String(p.qualCount)} />
          <SummaryRow label="Processes → RACMs" value={String(p.racms.length)} />
          <SummaryRow label="Group-level workstreams" value={String(p.beyondTb.length)} last />
        </div>
      </div>

      {/* Derived RACMs */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <Layers size={14} className="text-brand-700" />
        <h3 className="text-[14px] font-bold text-text">In-scope processes — one RACM each</h3>
        <span className="text-[11.5px] text-text-muted">derived from scoping, not picked by hand</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {p.racms.map(r => (
          <div key={r.process} className="border border-border-light rounded-xl bg-white p-4 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13.5px] font-semibold text-text">{r.process}</div>
              {r.controls != null && r.effective != null ? (
                <span className="text-[11px] tabular-nums text-text-secondary shrink-0">
                  <span className="font-semibold text-text">{r.effective}</span>/{r.controls} effective
                </span>
              ) : r.controls != null ? (
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 shrink-0" title="Design conclusions carried; operating effectiveness retested this cycle">
                  <RefreshCw size={9} /> {r.controls} carried — TOE retest
                </span>
              ) : (
                <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 shrink-0">
                  RACM shell — ready to build
                </span>
              )}
            </div>
            <div className="text-[10.5px] text-text-muted mt-0.5 mb-2.5">{r.entities.join(' · ')}</div>
            {r.controls != null && r.effective != null && (
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden mb-2.5">
                <div className="h-full bg-compliant rounded-full" style={{ width: `${Math.round((r.effective / r.controls) * 100)}%` }} />
              </div>
            )}
            <SourceChips sources={r.sources} max={4} />
          </div>
        ))}
      </div>

      {/* Beyond-TB workstreams */}
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Group-level workstreams — beyond the trial balance</div>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {BEYOND_TB.filter(b => p.beyondTb.includes(b.id)).map(b => (
          <div key={b.id} className="border border-dashed border-border rounded-xl bg-surface-2/40 p-3.5">
            <div className="text-[12.5px] font-semibold text-text-secondary">{b.name}</div>
            <div className="text-[10.5px] text-text-muted mt-1 leading-relaxed">{b.why}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** Caption chips, deduped across entities — "Employee benefit expense ×3"
 *  instead of the same label three times. Qual wins if any occurrence was a
 *  qualitative scope-in. */
export function SourceChips({ sources, max }: {
  sources: { caption: string; qualitative?: boolean }[];
  max: number;
}) {
  const uniq = new Map<string, { count: number; qualitative: boolean }>();
  for (const s of sources) {
    const u = uniq.get(s.caption) ?? { count: 0, qualitative: false };
    u.count += 1;
    u.qualitative = u.qualitative || !!s.qualitative;
    uniq.set(s.caption, u);
  }
  const rows = [...uniq.entries()];
  return (
    <div className="flex flex-wrap gap-1">
      {rows.slice(0, max).map(([caption, u]) => (
        <span key={caption} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
          u.qualitative ? 'bg-evidence-50 text-evidence-700' : 'bg-surface-2 text-text-secondary'
        }`}>
          {caption}
          {u.count > 1 && <span className="tabular-nums text-text-muted">×{u.count}</span>}
          {u.qualitative && <span className="font-bold uppercase text-[8.5px]">Qual</span>}
        </span>
      ))}
      {rows.length > max && (
        <span className="text-[10px] text-text-muted self-center">+{rows.length - max} more</span>
      )}
    </div>
  );
}

function SummaryRow({ label, value, note, strong, last }: {
  label: string; value: string; note?: string; strong?: boolean; last?: boolean;
}) {
  return (
    <div className={`py-1.5 ${last ? '' : 'border-b border-border-light'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] ${strong ? 'font-semibold text-text' : 'text-text-secondary'}`}>{label}</span>
        <span className={`font-mono tabular-nums ${strong ? 'text-[14px] font-bold text-text' : 'text-[12.5px] text-text'}`}>{value}</span>
      </div>
      {note && <div className="text-[10px] text-text-muted mt-0.5">{note}</div>}
    </div>
  );
}
