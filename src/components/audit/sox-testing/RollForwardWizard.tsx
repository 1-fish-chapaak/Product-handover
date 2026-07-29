import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowDown, ArrowUp, Building2, Check, FileSpreadsheet,
  Flag, Loader2, RefreshCw, Upload, Eye,
} from 'lucide-react';
import { StepRail } from './ScopingWizard';
import { SourceChips } from './ProgrammeView';
import { OWNER_NAMES } from '../../../data/grc-domain';
import { registerEngagement, type ProcessCode } from '../../../data/engagements';
import { useAuditLog } from '../../../context/AdminDataContext';
import {
  BEYOND_TB, SEED_QUAL_PICKS, captionsForEntities, deriveRacms, entityShort,
  fmtCr, genCode, rollBalance,
  type ProcessName, type SoxProgramme, type TbCaption,
} from './soxTestingData';

const STEPS = ['Cycle', 'Refresh trial balances', 'Review changes'] as const;

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const labelCls = 'text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block';

interface RolledCaption extends TbCaption {
  prior: number;
}

interface Props {
  prior: SoxProgramme;
  onCancel: () => void;
  onCreated: (p: SoxProgramme) => void;
}

export default function RollForwardWizard({ prior, onCancel, onCreated }: Props) {
  const logEvent = useAuditLog();
  const [step, setStep] = useState(0);

  // Target cycle is pure recurrence — prior year + 1, same year-end
  // convention. Nothing about dates is asked.
  const priorYear = Number(/\d{4}/.exec(prior.asOf)?.[0] ?? 2026);
  const conv: 'mar' | 'dec' = prior.asOf.includes('Dec') ? 'dec' : 'mar';
  const targetYear = priorYear + 1;
  const fy = `FY${String(targetYear).slice(-2)}`;
  const fyLabel = conv === 'mar' ? `FY ${targetYear - 1}-${String(targetYear).slice(-2)}` : `FY ${targetYear}`;
  const asOf = `${conv === 'mar' ? '31 Mar' : '31 Dec'} ${targetYear}`;

  // Step 1 — identity (prefilled from the prior cycle)
  const [name, setName] = useState(() =>
    /FY\d{2}/.test(prior.name) ? prior.name.replace(/FY\d{2}/, fy) : `${fy} — ${prior.name}`);
  const [code, setCode] = useState(genCode());
  const [owner, setOwner] = useState(prior.owner ?? OWNER_NAMES[0]);

  // Step 2 — materiality re-set on the new year's benchmark; basis, PM% and
  // CTT% carry forward from last year as editable defaults.
  const [benchmark, setBenchmark] = useState(() => Math.round(prior.materiality.benchmark * 1.107));
  const { basis, benchmarkLabel, pct } = prior.materiality;
  const [pmPct, setPmPct] = useState(prior.materiality.pmPct);
  const [cttPct, setCttPct] = useState(prior.materiality.cttPct);
  const overallCr = basis === 'custom' ? benchmark : Math.round(benchmark * pct * 100) / 10000;
  const [uploads, setUploads] = useState<Record<string, 'parsing' | { file: string; lines: number }>>({});
  const allUploaded = prior.entities.every(e => typeof uploads[e.id] === 'object');

  /** Prior-year captions with this year's balances. */
  const rolled = useMemo<RolledCaption[]>(
    () => captionsForEntities(prior.entities).map(c => ({ ...c, prior: c.balance, balance: rollBalance(c) })),
    [prior.entities],
  );

  const priorThreshold = prior.materiality.overall;
  const qualIds = useMemo(() => new Set(SEED_QUAL_PICKS.map(q => q.captionId)), []);

  const carriedRows = rolled.filter(c => c.prior >= priorThreshold && c.balance >= overallCr);
  const newlyIn = rolled.filter(c => c.prior < priorThreshold && c.balance >= overallCr);
  const droppedRows = rolled.filter(c => c.prior >= priorThreshold && c.balance < overallCr);
  const qualCarry = rolled.filter(c => qualIds.has(c.id) && c.balance < overallCr);

  /** Dropped captions the user elects to keep in scope anyway. */
  const [keepDropped, setKeepDropped] = useState<Record<string, boolean>>({});

  const inScope = useMemo(() => {
    const kept = droppedRows.filter(c => keepDropped[c.id]);
    return [...carriedRows, ...newlyIn, ...qualCarry, ...kept];
  }, [carriedRows, newlyIn, qualCarry, droppedRows, keepDropped]);

  const qualIdSet = useMemo(() => new Set([
    ...qualCarry.map(c => c.id),
    ...droppedRows.filter(c => keepDropped[c.id]).map(c => c.id),
  ]), [qualCarry, droppedRows, keepDropped]);

  const derived = useMemo(() => {
    const racms = deriveRacms(inScope, qualIdSet, prior.entities);
    for (const r of racms) {
      const prev = prior.racms.find(x => x.process === r.process);
      if (prev) {
        r.carried = true;
        if (prev.controls != null) r.controls = prev.controls;
      }
    }
    return racms;
  }, [inScope, qualIdSet, prior]);

  const canContinue = [
    name.trim().length > 0 && code.trim().length > 0,
    benchmark > 0 && allUploaded,
    true,
  ][step];

  const simulateUpload = (entityId: string) => {
    setUploads(prev => ({ ...prev, [entityId]: 'parsing' }));
    const ent = prior.entities.find(e => e.id === entityId);
    const fyLower = fy.toLowerCase();
    const file = ent?.tbFile
      ? ent.tbFile.replace(/fy\d{2}/i, fyLower)
      : `${(ent?.name ?? 'entity').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}-tb-${fyLower}.xlsx`;
    const lines = ent?.tbLines ?? 120;
    window.setTimeout(() => {
      setUploads(prev => ({ ...prev, [entityId]: { file, lines: lines + 3 } }));
    }, 700);
  };

  const create = () => {
    const id = `sox-prog-${Date.now()}`;
    const CR = 10_000_000;
    registerEngagement({
      id,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: `SOX 404 / ICFR programme — rolled forward from ${prior.fy}; scoping and RACMs carried with ${newlyIn.length} addition${newlyIn.length === 1 ? '' : 's'} and ${droppedRows.filter(c => !keepDropped[c.id]).length} descope${droppedRows.filter(c => !keepDropped[c.id]).length === 1 ? '' : 's'}.`,
      type: 'SOX / ICFR',
      soxConfig: {
        overallMateriality: Math.round(overallCr * CR),
        performanceMateriality: Math.round(overallCr * pmPct / 100 * CR),
        clearlyTrivial: Math.round(overallCr * cttPct / 100 * CR),
        sdBandPct: 20,
        aggregate: true,
        keyOnly: true,
      },
      soxProcesses: derived.map(r => r.process),
      // Design conclusions travel with the roll-forward only when the prior
      // cycle actually tested something; a rolled shell starts fresh.
      soxSeedMode: prior.racms.some(r => r.controls != null) ? 'carried' : 'fresh',
      process: ({ 'Procure to Pay': 'P2P', 'Order to Cash': 'O2C' } as Partial<Record<ProcessName, ProcessCode>>)[derived[0]?.process] ?? 'P2P',
      framework: 'COSO 2013 / SOX 404',
      owner,
      status: 'Active',
      periodStart: conv === 'mar' ? `Apr ${targetYear - 1}` : `Jan ${targetYear}`,
      periodEnd: conv === 'mar' ? `Mar ${targetYear}` : `Dec ${targetYear}`,
      startDate: conv === 'mar' ? `${targetYear - 1}-04-01` : `${targetYear}-01-01`,
      endDate: conv === 'mar' ? `${targetYear}-03-31` : `${targetYear}-12-31`,
      entity: prior.groupName,
      controls: 0,
      health: 0,
      openIssues: 0,
      lastActivity: 'Just rolled forward',
      nextScheduled: `Scoping refresh — opinion as of ${asOf}`,
    });
    logEvent({
      action: 'Create',
      description: `Rolled forward SOX ICFR engagement "${name.trim()}" from ${prior.fy} — ${derived.length} RACMs carried, ${newlyIn.length} caption(s) newly in scope, materiality ${fmtCr(overallCr)}`,
      module: 'SOX ICFR',
      entity: 'Engagement',
    });
    onCreated({
      id,
      engagementId: id,
      rolledFromFy: prior.fy,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      owner,
      fy,
      asOf,
      phase: 'Scoping',
      groupName: prior.groupName,
      entities: prior.entities.map(e => {
        const up = uploads[e.id];
        return typeof up === 'object' ? { ...e, tbFile: up.file, tbLines: up.lines } : { ...e };
      }),
      materiality: { basis, benchmarkLabel, benchmark, pct, overall: overallCr, pmPct, cttPct },
      totalCaptions: rolled.length,
      quantCount: carriedRows.length + newlyIn.length,
      qualCount: qualIdSet.size,
      racms: derived,
      beyondTb: prior.beyondTb,
    });
  };

  const delta = (c: RolledCaption) => Math.round(((c.balance - c.prior) / c.prior) * 100);

  return (
    // min-h-full + flex column: the footer pins to the modal's bottom edge on
    // short steps instead of floating right under the content.
    <div className="flex flex-col min-h-full">
      {/* Pinned header — eyebrow + stepper stay put while the step content
          scrolls beneath (same treatment as the scoping wizard). */}
      {/* -top-6 + pt-12 — see ScopingWizard for the full reasoning: with plain
          `top-0` the -mt-6 made sticky push the header 24px past the space
          layout reserved for it, so it painted over the top of every step. */}
      <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-12 pb-1">
        <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">Roll forward</div>
        <StepRail steps={STEPS} step={step} onStepClick={setStep} />
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {step === 0 && (
          <div>
            <h2 className="text-[18px] font-bold text-text">Roll forward from {prior.fy}</h2>
            <p className="text-[12.5px] text-text-secondary mt-1 mb-5 max-w-2xl leading-relaxed">
              SOX recurs every year — nothing starts from scratch. Scoping, qualitative judgements,
              group-level workstreams and RACMs carry forward from <span className="font-semibold text-text">{prior.name}</span>;
              you only review what changed.
            </p>

            {/* The cycle itself is not a question — it's recurrence. */}
            <div className="flex items-center gap-2.5 mb-5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-[12px] font-semibold">
                <RefreshCw size={12} /> {prior.fy} → {fy}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-text-secondary text-[12px] font-semibold">
                {fyLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-text-secondary text-[12px] font-semibold">
                <Flag size={12} className="text-brand-700" /> opinion as of {asOf}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-text-secondary text-[12px] font-semibold">
                <Building2 size={12} /> {prior.entities.length} entities carried
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Engagement name</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Code</label>
                <input value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} />
              </div>
              <div>
                <label className={labelCls}>Owner</label>
                <select value={owner} onChange={e => setOwner(e.target.value)} className={inputCls + ' cursor-pointer appearance-none'}>
                  {OWNER_NAMES.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-[18px] font-bold text-text">Refresh the numbers</h2>
            <p className="text-[12.5px] text-text-secondary mt-1 mb-5 max-w-2xl leading-relaxed">
              Materiality is re-set on the new year's benchmark (basis, PM% and clearly-trivial carry
              forward), and each entity's fresh trial balance is compared caption-by-caption to {prior.fy}.
            </p>

            <div className="grid grid-cols-2 gap-4 items-start mb-5">
              <div className="border border-border-light rounded-xl bg-white p-4 space-y-4">
                <div>
                  <label className={labelCls}>{benchmarkLabel} (₹ Cr) — {fy}</label>
                  <input
                    type="number" min={0}
                    value={benchmark}
                    onChange={e => setBenchmark(Number(e.target.value))}
                    className="w-40 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                  <p className="text-[11px] text-text-muted mt-2">
                    {prior.fy}: {fmtCr(prior.materiality.benchmark)} · basis {basis === 'custom' ? 'custom' : `${pct}%`} carried
                  </p>
                </div>
                {basis !== 'custom' && (
                  <div>
                    <label className={labelCls}>Overall materiality (₹ Cr)</label>
                    <div className="flex items-center gap-2">
                      <div className="w-40 px-3 py-2 text-[13px] font-semibold tabular-nums border border-border-light rounded-lg bg-surface-2/60 text-text">
                        {fmtCr(overallCr)}
                      </div>
                      <span className="text-[12px] text-text-muted">= {pct}% × {fmtCr(benchmark)}</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Performance materiality (% of overall)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={50} max={75} step={5}
                      value={pmPct}
                      onChange={e => setPmPct(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    />
                    <span className="text-[12px] text-text-muted">carried from {prior.fy} — edit if reliance changed</span>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Clearly-trivial threshold (% of overall)</label>
                  <input
                    type="number" min={1} max={10}
                    value={cttPct}
                    onChange={e => setCttPct(Number(e.target.value))}
                    className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>
              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Materiality — {fy} vs {prior.fy}</div>
                <div className="flex items-baseline justify-between py-1 border-b border-border-light">
                  <span className="text-[12px] font-semibold text-text">Overall</span>
                  <span className="font-mono tabular-nums text-[13px] text-text">{fmtCr(priorThreshold)} → <span className="font-bold">{fmtCr(overallCr)}</span></span>
                </div>
                <div className="flex items-baseline justify-between py-1 border-b border-border-light">
                  <span className="text-[12px] text-text-secondary">Performance · {pmPct}%</span>
                  <span className="font-mono tabular-nums text-[12px] text-text">{fmtCr(priorThreshold * prior.materiality.pmPct / 100)} → <span className="font-semibold">{fmtCr(overallCr * pmPct / 100)}</span></span>
                </div>
                <div className="flex items-baseline justify-between py-1">
                  <span className="text-[12px] text-text-secondary">Clearly trivial · {cttPct}%</span>
                  <span className="font-mono tabular-nums text-[12px] text-text">{fmtCr(priorThreshold * prior.materiality.cttPct / 100)} → <span className="font-semibold">{fmtCr(overallCr * cttPct / 100)}</span></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {prior.entities.map(ent => {
                const up = uploads[ent.id];
                return (
                  <div key={ent.id} className="border border-border-light rounded-xl bg-white p-3.5">
                    <div className="text-[12.5px] font-semibold text-text truncate">{ent.name}</div>
                    <div className="text-[10.5px] text-text-muted mb-2.5">{ent.type} · {ent.ownership}%</div>
                    {up === undefined && (
                      <button
                        onClick={() => simulateUpload(ent.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[11.5px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
                      >
                        <Upload size={12} /> Upload {fy} trial balance
                      </button>
                    )}
                    {up === 'parsing' && (
                      <div className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
                        <Loader2 size={12} className="animate-spin" /> Comparing to {prior.fy}…
                      </div>
                    )}
                    {typeof up === 'object' && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileSpreadsheet size={13} className="text-compliant-700 shrink-0" />
                        <span className="text-[11px] font-mono text-text-secondary truncate">{up.file}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {allUploaded && (
              <>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-text">Year-over-year movement</span>
                  <span className="text-[11.5px] text-text-muted">
                    {carriedRows.length} carried · {newlyIn.length} newly in scope · {droppedRows.length} fell below {fmtCr(overallCr)}
                  </span>
                </div>
                <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                  <div className="grid grid-cols-[1.7fr_0.7fr_0.8fr_0.8fr_0.5fr_1.1fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                    <div>Caption</div><div>Entity</div><div className="text-right">{prior.fy}</div><div className="text-right">{fy}</div><div className="text-right">Δ</div><div className="text-right">Status</div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {[...newlyIn, ...droppedRows, ...carriedRows].map(row => {
                      const isNew = row.prior < priorThreshold && row.balance >= overallCr;
                      const isDropped = row.prior >= priorThreshold && row.balance < overallCr;
                      const d = delta(row);
                      return (
                        <div key={row.id} className={`grid grid-cols-[1.7fr_0.7fr_0.8fr_0.8fr_0.5fr_1.1fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0 ${isNew || isDropped ? 'bg-brand-50/30' : ''}`}>
                          <div className="text-[12.5px] text-text">{row.caption}</div>
                          <div className="text-[11px] text-text-muted">{entityShort(row.entityId, prior.entities)}</div>
                          <div className="text-[12px] font-mono tabular-nums text-right text-text-muted">{fmtCr(row.prior)}</div>
                          <div className="text-[12px] font-mono tabular-nums text-right text-text">{fmtCr(row.balance)}</div>
                          <div className={`text-[11px] font-mono tabular-nums text-right inline-flex items-center justify-end gap-0.5 ${d >= 0 ? 'text-text-secondary' : 'text-text-muted'}`}>
                            {d >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}{Math.abs(d)}%
                          </div>
                          <div className="justify-self-end">
                            {isNew ? (
                              <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-semibold bg-brand-100 text-brand-800">Newly in scope</span>
                            ) : isDropped ? (
                              <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-mitigated-50 text-mitigated-700">Fell below — review</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-medium bg-surface-2 text-text-secondary"><Check size={10} /> Carried</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-[18px] font-bold text-text">Review the changes — everything else carries</h2>
            <p className="text-[12.5px] text-text-secondary mt-1 mb-5 max-w-2xl leading-relaxed">
              Only the deltas need a decision. Carried captions, qualitative judgements and
              group-level workstreams roll forward untouched.
            </p>

            <div className="space-y-3 mb-4">
              {newlyIn.length > 0 && (
                <div className="border border-border-light rounded-xl bg-white p-4">
                  <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wider mb-2">Newly in scope ({newlyIn.length})</div>
                  {newlyIn.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="text-[12.5px] text-text">{c.caption} <span className="text-text-muted">· {entityShort(c.entityId, prior.entities)}</span></span>
                      <span className="text-[11.5px] font-mono tabular-nums text-text-secondary">{fmtCr(c.prior)} → {fmtCr(c.balance)} — crossed {fmtCr(overallCr)}</span>
                    </div>
                  ))}
                </div>
              )}

              {droppedRows.length > 0 && (
                <div className="border border-border-light rounded-xl bg-white p-4">
                  <div className="text-[11px] font-bold text-mitigated-700 uppercase tracking-wider mb-1">Fell below materiality ({droppedRows.length})</div>
                  <p className="text-[11px] text-text-muted mb-2 leading-relaxed">Descoping needs judgement — a caption that was in scope last year drops out only if nothing qualitative keeps it in.</p>
                  {droppedRows.map(c => {
                    const keep = keepDropped[c.id] ?? false;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="text-[12.5px] text-text">{c.caption} <span className="text-text-muted">· {entityShort(c.entityId, prior.entities)}</span></span>
                        <span className="flex items-center gap-2.5">
                          <span className="text-[11.5px] font-mono tabular-nums text-text-secondary">{fmtCr(c.prior)} → {fmtCr(c.balance)}</span>
                          <button
                            role="switch"
                            aria-checked={keep}
                            aria-label={`Keep ${c.caption} in scope`}
                            onClick={() => setKeepDropped(prev => ({ ...prev, [c.id]: !keep }))}
                            className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 ${keep ? 'bg-primary' : 'bg-surface-3'}`}
                          >
                            <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${keep ? 'left-[18px]' : 'left-[2px]'}`} />
                          </button>
                          <span className="text-[11px] text-text-muted w-16">{keep ? 'Kept in' : 'Descoped'}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Eye size={12} className="text-evidence-700" />
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Qualitative judgements — carried ({qualCarry.length})</span>
                </div>
                {qualCarry.map(c => {
                  const pick = SEED_QUAL_PICKS.find(q => q.captionId === c.id);
                  return (
                    <div key={c.id} className="py-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12.5px] text-text">{c.caption} <span className="text-text-muted">· {entityShort(c.entityId, prior.entities)}</span></span>
                        <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-evidence-50 text-evidence-700">{pick?.reason ?? 'Carried'}</span>
                      </div>
                      {pick && <p className="text-[11px] text-text-muted mt-0.5">{pick.note}</p>}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2.5 border-t border-border-light">
                  {BEYOND_TB.filter(b => prior.beyondTb.includes(b.id)).map(b => (
                    <span key={b.id} className="inline-flex items-center px-2 h-5 rounded-md text-[10.5px] font-semibold bg-surface-2 text-text-secondary border border-border-light">{b.short} — carried</span>
                  ))}
                </div>
              </div>

              {/* RACMs carried */}
              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  RACMs — carried with design, operating retest planned
                </div>
                <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
                  Controls and design conclusions roll forward from {prior.fy}; operating effectiveness is retested in {fy}.
                </p>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {derived.map(r => (
                    <div key={r.process} className="rounded-lg p-3 bg-surface-2/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-[12.5px] font-semibold text-text">{r.process}</div>
                        {r.carried && (
                          <span className="inline-flex items-center gap-1 px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-brand-50 text-brand-700 shrink-0" title={`Rolled forward from ${prior.fy}`}>
                            <RefreshCw size={8} /> {prior.fy}
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-text-muted mt-0.5 mb-2 tabular-nums">
                        {r.controls != null ? `${r.controls} controls carried` : 'New RACM shell'} · {r.entities.join(', ')}
                      </div>
                      <SourceChips sources={r.sources} max={2} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Footer — sticky inside the modal scroll */}
      <div className="mt-auto pt-6" />
      <div className="flex items-center justify-between py-4 border-t border-border-light sticky bottom-0 bg-canvas -mx-6 px-6">
        <button
          onClick={() => (step === 0 ? onCancel() : setStep(s => s - 1))}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => canContinue && setStep(s => s + 1)}
            disabled={!canContinue}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ArrowRight size={13} />
          </button>
        ) : (
          <button
            onClick={create}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
          >
            <Check size={13} /> Create {fy} programme
          </button>
        )}
      </div>
    </div>
  );
}
