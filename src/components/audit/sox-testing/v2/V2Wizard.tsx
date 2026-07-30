import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Building2, Check, FileSpreadsheet, Info, Landmark,
  Loader2, Plus, Sparkles, Trash2, Upload, Users,
} from 'lucide-react';
import { StepRail } from '../ScopingWizard';
import { fmtCr } from '../soxTestingData';
import { OWNER_NAMES } from '../../../../data/grc-domain';
import { registerEngagement, type ProcessCode } from '../../../../data/engagements';
import { useAuditLog } from '../../../../context/AdminDataContext';
import {
  ITGC_SYSTEMS, PEOPLE_SUGGESTIONS, V2_BASIS_OPTIONS, V2_PROCESS_NAMES,
  V2_QUAL_REASONS, V2_SEED_ENTITIES, V2_SEED_GROUP, V2_SEED_QUAL_PICKS,
  V2_SEED_TB_FILES, V2_WORKSTREAMS, deriveEntityScope, deriveV2Racms,
  v2CaptionsForEntities, v2EntityShort, v2GenCode, workstreamRacms,
  type V2Basis, type V2Caption, type V2Entity, type V2PeopleRow,
  type V2ProcessName, type V2Programme, type V2QualPick, type V2Workstream,
} from './v2Data';

const STEPS = [
  'Cycle', 'Materiality', 'Group & TBs', 'Entity scope',
  'Captions', 'Workstreams', 'People', 'Review',
] as const;

const inputCls = 'w-full px-3 py-2.5 border border-border rounded-lg text-[0.8125rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5 block';
const segActive = 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20';
const segIdle = 'border-border bg-white text-text-secondary hover:bg-surface-2';

interface Props {
  onCancel: () => void;
  onCreated: (p: V2Programme) => void;
}

export default function V2Wizard({ onCancel, onCreated }: Props) {
  const logEvent = useAuditLog();
  const [step, setStep] = useState(0);

  // Step 1 — cycle & identity. No engagement-type tiles: SOX is its own
  // module here, so the tab already IS the type.
  const [name, setName] = useState('');
  const [code, setCode] = useState(v2GenCode());
  const [owner, setOwner] = useState(OWNER_NAMES[0]);
  const [conv, setConv] = useState<'mar' | 'dec'>('dec');
  const [fyEnd, setFyEnd] = useState(2027);
  const FY_OPTIONS = conv === 'mar'
    ? [2026, 2027, 2028].map(y => ({ value: y, label: `FY ${y - 1}-${String(y).slice(-2)}` }))
    : [2025, 2026, 2027].map(y => ({ value: y, label: `FY ${y}` }));
  const fy = `FY${String(fyEnd).slice(-2)}`;
  const asOf = conv === 'mar' ? `31 Mar ${fyEnd}` : `31 Dec ${fyEnd}`;

  // Step 2 — materiality FIRST (before any entity is judged). PM is the
  // working threshold the next steps scope with.
  const [basis, setBasis] = useState<V2Basis>('pbt');
  const basisOpt = V2_BASIS_OPTIONS.find(b => b.id === basis)!;
  const [benchmark, setBenchmark] = useState(basisOpt.defaultBenchmark);
  const [pct, setPct] = useState(basisOpt.defaultPct);
  const [pmPct, setPmPct] = useState(75);
  const [cttPct, setCttPct] = useState(5);
  const overallCr = basis === 'custom' ? benchmark : Math.round(benchmark * pct * 100) / 10000;
  const pm = Math.round(overallCr * pmPct) / 100;

  // Step 3 — group & TB upload per entity
  const [groupName, setGroupName] = useState(V2_SEED_GROUP);
  const [entities, setEntities] = useState<V2Entity[]>(() => V2_SEED_ENTITIES.map(e => ({ ...e })));
  const [uploads, setUploads] = useState<Record<string, 'parsing' | { file: string; lines: number }>>({});
  const allUploaded = entities.every(e => typeof uploads[e.id] === 'object');
  const captions = useMemo<V2Caption[]>(() => v2CaptionsForEntities(entities), [entities]);

  // Step 4 — entity scope: derived + coverage target + manual pull-in overrides
  const [coverageTarget, setCoverageTarget] = useState(60);
  const [coverageOverrides, setCoverageOverrides] = useState<Record<string, boolean>>({});

  // Step 5 — qualitative overlay (a pick pulls its entity in too)
  const [qual, setQual] = useState<Record<string, V2QualPick & { on: boolean }>>(() => {
    const init: Record<string, V2QualPick & { on: boolean }> = {};
    for (const p of V2_SEED_QUAL_PICKS) init[p.captionId] = { ...p, on: true };
    return init;
  });
  const qualIds = useMemo(
    () => new Set(Object.values(qual).filter(q => q.on).map(q => q.captionId)),
    [qual],
  );

  // Step 6 — mapping overrides + workstreams + ITGC systems
  const [mapping, setMapping] = useState<Record<string, V2ProcessName>>({});
  const [wsPicked, setWsPicked] = useState<V2Workstream['id'][]>(['itgc', 'elc', 'fscp', 'consol']);
  const [systems, setSystems] = useState<string[]>(['SAP S/4HANA', 'Oracle EPM', 'Kyriba']);

  // Step 7 — people per derived area
  const [people, setPeople] = useState<Record<string, Omit<V2PeopleRow, 'area'>>>({});

  const mappedCaptions = useMemo(
    () => captions.map(c => ({ ...c, process: mapping[c.id] ?? c.process })),
    [captions, mapping],
  );
  const scope = useMemo(
    () => deriveEntityScope(entities, mappedCaptions, pm, coverageTarget, qualIds, coverageOverrides),
    [entities, mappedCaptions, pm, coverageTarget, qualIds, coverageOverrides],
  );
  const derived = useMemo(() => deriveV2Racms(scope.inScope, entities), [scope, entities]);
  const wsRacms = useMemo(() => workstreamRacms(wsPicked, systems, 'Group'), [wsPicked, systems]);
  const allAreas = [...derived.map(r => r.area), ...wsRacms.map(r => r.area)];
  const inEntities = scope.decisions.filter(d => d.status !== 'out');
  const belowPm = mappedCaptions.filter(c => c.balance < pm);

  const peopleFor = (area: string): Omit<V2PeopleRow, 'area'> =>
    people[area] ?? PEOPLE_SUGGESTIONS[area] ?? { processOwner: '', poEmail: '', controlOwner: '', coEmail: '' };

  const canContinue = [
    name.trim().length > 0 && code.trim().length > 0,
    benchmark > 0 && (basis === 'custom' || pct > 0),
    groupName.trim().length > 0 && entities.length > 0 && entities.every(e => e.name.trim()) && allUploaded,
    inEntities.length > 0,
    true,
    true,
    allAreas.every(a => peopleFor(a).processOwner.trim().length > 0),
    derived.length > 0,
  ][step];

  const simulateUpload = (entityId: string) => {
    setUploads(prev => ({ ...prev, [entityId]: 'parsing' }));
    const seeded = V2_SEED_TB_FILES[entityId];
    const ent = entities.find(e => e.id === entityId);
    const slug = (ent?.name ?? 'entity').toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    const result = seeded ?? { file: `${slug}-tb.xlsx`, lines: 52 };
    window.setTimeout(() => setUploads(prev => ({ ...prev, [entityId]: result })), 700);
  };

  const create = () => {
    const id = `sox-v2-${Date.now()}`;
    const racms = [...derived, ...wsRacms].map(r => ({ ...r, controls: r.controls || 0 }));
    // A real runtime engagement backs every V2 programme — "Open workspace"
    // routes into the classic SOX bench, seeded fresh with the derived areas.
    const CR = 10_000_000;
    registerEngagement({
      id,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: `SOX 404 / ICFR programme — V2 scoping: ${inEntities.length}/${entities.length} entities in scope (${scope.coveragePct}% coverage), ${racms.length} RACMs.`,
      type: 'SOX / ICFR',
      soxConfig: {
        overallMateriality: Math.round(overallCr * CR),
        performanceMateriality: Math.round(pm * CR),
        clearlyTrivial: Math.round(overallCr * cttPct / 100 * CR),
        sdBandPct: 20,
        aggregate: true,
        keyOnly: true,
      },
      soxProcesses: racms.map(r => r.area),
      soxSeedMode: 'fresh',
      process: ({ 'Procure to Pay': 'P2P', 'Order to Cash': 'O2C' } as Partial<Record<string, ProcessCode>>)[derived[0]?.area ?? ''] ?? 'P2P',
      framework: 'COSO 2013 / SOX 404',
      owner,
      status: 'Active',
      periodStart: conv === 'mar' ? `Apr ${fyEnd - 1}` : `Jan ${fyEnd}`,
      periodEnd: conv === 'mar' ? `Mar ${fyEnd}` : `Dec ${fyEnd}`,
      startDate: conv === 'mar' ? `${fyEnd - 1}-04-01` : `${fyEnd}-01-01`,
      endDate: conv === 'mar' ? `${fyEnd}-03-31` : `${fyEnd}-12-31`,
      entity: groupName.trim(),
      controls: 0,
      health: 0,
      openIssues: 0,
      lastActivity: 'Just created',
      nextScheduled: `Scoping — opinion as of ${asOf}`,
    });
    const programme: V2Programme = {
      id,
      engagementId: id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      owner,
      fy,
      asOf,
      conv,
      phase: 'Scoping',
      groupName: groupName.trim(),
      entities: entities.map(e => {
        const up = uploads[e.id];
        return typeof up === 'object' ? { ...e, tbFile: up.file, tbLines: up.lines } : { ...e };
      }),
      captions: mappedCaptions,
      entityScope: scope.decisions,
      coverageTargetPct: coverageTarget,
      coveragePct: scope.coveragePct,
      materiality: {
        basis,
        benchmarkLabel: basisOpt.benchmarkLabel,
        benchmark,
        pct: basis === 'custom' ? 100 : pct,
        overall: overallCr,
        pmPct,
        cttPct,
      },
      revisions: [],
      qualPicks: Object.values(qual).filter(q => q.on).map(({ on: _on, ...pick }) => pick),
      racms,
      people: allAreas.map(a => ({ area: a, ...peopleFor(a) })),
      controls: [],
      chase: [],
    };
    logEvent({
      action: 'Create',
      description: `Created SOX V2 programme "${name.trim()}" — ${inEntities.length}/${entities.length} entities in scope (${scope.coveragePct}% coverage), ${racms.length} RACMs, PM ${fmtCr(pm)}`,
      module: 'SOX ICFR',
      entity: 'Engagement',
    });
    onCreated(programme);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">New engagement · V2</div>
      <StepRail steps={STEPS} step={step} onStepClick={setStep} />

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {step === 0 && (
          <StepShell
            title="Cycle & identity"
            sub="SOX is its own module — no engagement-type picker. Name the cycle, pick the fiscal year and the year-end the auditor opines 'as of'."
          >
            <div className="space-y-4 max-w-2xl">
              <div>
                <label className={labelCls}>Engagement name <span className="text-risk-700">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FY27 ICFR — Altura Infra Group" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Code <span className="text-risk-700">*</span></label>
                  <input value={code} onChange={e => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} />
                </div>
                <div>
                  <label className={labelCls}>Engagement owner <span className="text-risk-700">*</span></label>
                  <select value={owner} onChange={e => setOwner(e.target.value)} className={selectCls}>
                    {OWNER_NAMES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fiscal year / audit period <span className="text-risk-700">*</span></label>
                  <select value={fyEnd} onChange={e => setFyEnd(Number(e.target.value))} className={selectCls}>
                    {FY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Opinion “as of” — year-end <span className="text-risk-700">*</span></label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => { if (conv !== 'dec') { setConv('dec'); setFyEnd(y => y - 1); } }}
                      className={`px-2 py-2.5 rounded-lg border text-[0.75rem] font-bold tabular-nums transition-all cursor-pointer ${conv === 'dec' ? segActive : segIdle}`}
                    >
                      31 Dec {conv === 'dec' ? fyEnd : fyEnd - 1}
                    </button>
                    <button
                      onClick={() => { if (conv !== 'mar') { setConv('mar'); setFyEnd(y => y + 1); } }}
                      className={`px-2 py-2.5 rounded-lg border text-[0.75rem] font-bold tabular-nums transition-all cursor-pointer ${conv === 'mar' ? segActive : segIdle}`}
                    >
                      31 Mar {conv === 'mar' ? fyEnd : fyEnd + 1}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50/50 border border-brand-100">
                <Info size={13} className="text-brand-700 shrink-0 mt-0.5" />
                <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                  Nothing else is asked here. Materiality comes next — and from there the trial
                  balances decide which entities and processes are in scope. The cycle calendar
                  will follow the {conv === 'dec' ? 'December' : 'March'} year-end.
                </p>
              </div>
            </div>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="Materiality — before any entity is judged"
            sub="Pick the basis, set the ladder. Performance materiality is the working threshold — every trial-balance caption is compared against it in the steps ahead."
          >
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {V2_BASIS_OPTIONS.map(b => {
                const active = basis === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => { setBasis(b.id); setBenchmark(b.defaultBenchmark); setPct(b.defaultPct); }}
                    className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      active ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border-light bg-white hover:border-primary/30'
                    }`}
                  >
                    <div className={`text-[12.5px] font-semibold ${active ? 'text-primary' : 'text-text'}`}>{b.label}</div>
                    <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{b.hint}</div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="border border-border-light rounded-xl bg-white p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className={labelCls}>{basisOpt.benchmarkLabel} (₹ Cr)</div>
                    <input type="number" min={0} value={benchmark} onChange={e => setBenchmark(Number(e.target.value))}
                      className="w-full px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                  </div>
                  {basis !== 'custom' && (
                    <div>
                      <div className={labelCls}>Basis %</div>
                      <input type="number" min={0.1} max={100} step={0.05} value={pct} onChange={e => setPct(Number(e.target.value))}
                        className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                    </div>
                  )}
                </div>
                <div>
                  <div className={labelCls}>Performance materiality (% of overall)</div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={50} max={75} step={5} value={pmPct} onChange={e => setPmPct(Number(e.target.value))}
                      className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                    <span className="text-[12px] text-text-muted">auditors typically set 50–75%</span>
                  </div>
                </div>
                <div>
                  <div className={labelCls}>Clearly-trivial threshold (% of overall)</div>
                  <input type="number" min={1} max={10} value={cttPct} onChange={e => setCttPct(Number(e.target.value))}
                    className="w-20 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10" />
                </div>
              </div>
              <div className="border border-border-light rounded-xl bg-white p-4">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">Computed thresholds</div>
                <LadderRow label="Overall materiality" value={fmtCr(overallCr)} note={basis === 'custom' ? 'Set directly' : `${pct}% × ${fmtCr(benchmark)}`} />
                <LadderRow label="Performance materiality" value={fmtCr(pm)} strong note={`${pmPct}% of overall — the scoping threshold`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall`} last />
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border-light">
                  <Info size={13} className="text-text-muted shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-text-muted leading-relaxed">
                    Captions at or above {fmtCr(pm)} scope their entity in automatically.
                    If results shift mid-year, materiality can be revised from the programme
                    page — new areas scope in through the same derivation.
                  </p>
                </div>
              </div>
            </div>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            title="Group & trial balances"
            sub="List the group and upload one trial balance per entity. Nothing is scoped by hand here — the next step shows what the numbers decide."
          >
            <div className="max-w-xl mb-4">
              <div className={labelCls}>Group (listed / holding)</div>
              <input value={groupName} onChange={e => setGroupName(e.target.value)} className={inputCls} />
            </div>
            <div className="border border-border-light rounded-xl bg-white overflow-hidden mb-4">
              <div className="grid grid-cols-[2.2fr_0.9fr_0.7fr_1.4fr_44px] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>Entity</div><div>Type</div><div className="text-right">Group share</div><div>Trial balance</div><div />
              </div>
              {entities.map((ent, i) => {
                const up = uploads[ent.id];
                return (
                  <div key={ent.id} className="grid grid-cols-[2.2fr_0.9fr_0.7fr_1.4fr_44px] gap-3 px-4 py-2.5 items-center border-b border-border-light last:border-b-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {ent.type === 'Holding'
                        ? <Landmark size={14} className="text-brand-700 shrink-0" />
                        : <Building2 size={14} className="text-text-muted shrink-0" />}
                      <input
                        value={ent.name}
                        onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="w-full text-[13px] text-text bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                      />
                    </div>
                    <select
                      value={ent.type}
                      onChange={e => setEntities(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value as V2Entity['type'] } : x))}
                      className="text-[12px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                    >
                      <option>Holding</option>
                      <option>Subsidiary</option>
                    </select>
                    <div className="text-[12px] font-mono tabular-nums text-right text-text-secondary">{ent.sharePct}%</div>
                    <div className="min-w-0">
                      {up === undefined && (
                        <button
                          onClick={() => simulateUpload(ent.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-white hover:bg-primary-xlight/40 hover:border-primary/30 text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
                        >
                          <Upload size={11} /> Upload TB
                        </button>
                      )}
                      {up === 'parsing' && (
                        <span className="flex items-center gap-1.5 text-[11px] text-text-muted"><Loader2 size={11} className="animate-spin" /> Parsing…</span>
                      )}
                      {typeof up === 'object' && (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <FileSpreadsheet size={12} className="text-compliant-700 shrink-0" />
                          <span className="text-[10.5px] font-mono text-text-secondary truncate">{up.file}</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setEntities(prev => prev.filter((_, j) => j !== i))}
                      disabled={entities.length === 1}
                      aria-label={`Remove ${ent.name}`}
                      className="p-1.5 rounded-md text-text-muted hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer justify-self-end"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => setEntities(prev => [...prev, { id: `v-new-${prev.length}-${Date.now()}`, name: '', type: 'Subsidiary', sharePct: 4 }])}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold text-primary hover:bg-primary/5 w-full transition-colors cursor-pointer"
              >
                <Plus size={13} /> Add entity
              </button>
            </div>
            {!allUploaded && (
              <p className="text-[11.5px] text-text-muted">Every entity needs its trial balance before the scope can be derived.</p>
            )}
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            title="Entity scope — derived, not typed"
            sub={`An entity is in scope when any caption clears performance materiality (${fmtCr(pm)}). If the in-scope share misses the coverage target, the largest remaining entities are pulled in.`}
          >
            {/* Coverage meter */}
            <div className="border border-border-light rounded-xl bg-white p-4 mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Group coverage</div>
                <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                  Target
                  <input
                    type="number" min={40} max={95} step={5} value={coverageTarget}
                    onChange={e => setCoverageTarget(Number(e.target.value))}
                    className="w-16 px-2 py-1 text-[12px] tabular-nums border border-border rounded-md bg-white text-text outline-none focus:border-primary/40"
                  />
                  % — agreed with the auditors, configurable
                </div>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${scope.coveragePct >= coverageTarget ? 'bg-compliant' : 'bg-risk-500'}`}
                  style={{ width: `${Math.min(scope.coveragePct, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11.5px]">
                <span className={`font-semibold tabular-nums ${scope.coveragePct >= coverageTarget ? 'text-compliant-700' : 'text-risk-700'}`}>
                  {scope.coveragePct}% covered
                </span>
                <span className="text-text-muted tabular-nums">target {coverageTarget}%</span>
              </div>
            </div>

            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              {scope.decisions
                .slice()
                .sort((a, b) => Number(a.status === 'out') - Number(b.status === 'out'))
                .map(d => {
                  const ent = entities.find(e => e.id === d.entityId);
                  if (!ent) return null;
                  const isOut = d.status === 'out';
                  return (
                    <div key={d.entityId} className={`flex items-center gap-3 px-4 py-2.5 border-b border-border-light last:border-b-0 ${isOut ? '' : 'bg-brand-50/20'}`}>
                      {ent.type === 'Holding'
                        ? <Landmark size={13} className="text-brand-700 shrink-0" />
                        : <Building2 size={13} className="text-text-muted shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <span className={`text-[12.5px] font-semibold ${isOut ? 'text-text-muted' : 'text-text'}`}>{ent.name}</span>
                        <span className="text-[11px] text-text-muted ml-2">{d.reason}</span>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-text-muted shrink-0">{ent.sharePct}%</span>
                      <EntityStatusChip status={d.status} />
                      {(d.status === 'out' || d.status === 'coverage') && (
                        <button
                          role="switch"
                          aria-checked={d.status === 'coverage'}
                          aria-label={`Keep ${ent.name} in scope`}
                          onClick={() => setCoverageOverrides(prev => ({ ...prev, [ent.id]: d.status === 'out' }))}
                          className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 ${d.status === 'coverage' ? 'bg-primary' : 'bg-surface-3'}`}
                        >
                          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${d.status === 'coverage' ? 'left-[18px]' : 'left-[2px]'}`} />
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
            <p className="text-[11.5px] text-text-muted mt-3">
              {inEntities.length} of {entities.length} entities in scope. Qualitative picks on the
              next step can still pull an out entity in.
            </p>
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Captions & the qualitative overlay"
            sub={`Everything at or above ${fmtCr(pm)} is flagged automatically. Below the line, scope captions in by judgement — a pick pulls its entity into scope too.`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[12px] font-semibold text-text">{scope.inScope.length} captions in scope</span>
              <span className="text-[11.5px] text-text-muted">
                {scope.inScope.filter(s => s.via === 'quant').length} above PM · {scope.inScope.filter(s => s.via === 'coverage').length} via coverage · {scope.inScope.filter(s => s.via === 'qual').length} qualitative
              </span>
            </div>
            <div className="border border-border-light rounded-xl bg-white overflow-hidden mb-4">
              <div className="grid grid-cols-[1.8fr_0.9fr_0.7fr_0.9fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>In-scope caption</div><div>Entity</div><div className="text-right">Balance</div><div className="text-right">Via</div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {scope.inScope.map(({ caption: c, via }) => (
                  <div key={`${c.id}-${via}`} className="grid grid-cols-[1.8fr_0.9fr_0.7fr_0.9fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0">
                    <div className="text-[12.5px] text-text truncate">{c.caption}</div>
                    <div className="text-[11.5px] text-text-muted">{v2EntityShort(c.entityId, entities)}</div>
                    <div className="text-[12px] font-mono tabular-nums text-right text-text-secondary">{fmtCr(c.balance)}</div>
                    <div className="justify-self-end"><ViaChip via={via} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Below {fmtCr(pm)} — scope in by judgement</div>
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="max-h-[240px] overflow-y-auto">
                {belowPm.map(row => {
                  const q = qual[row.id];
                  const on = q?.on ?? false;
                  return (
                    <div key={row.id} className={`border-b border-border-light last:border-b-0 ${on ? 'bg-evidence-50/30' : ''}`}>
                      <div className="grid grid-cols-[1.7fr_0.8fr_0.6fr_1.6fr] gap-3 px-4 py-2 items-center">
                        <div className="text-[12.5px] text-text truncate">{row.caption}</div>
                        <div className="text-[11.5px] text-text-muted">{v2EntityShort(row.entityId, entities)}</div>
                        <div className="text-[12px] font-mono tabular-nums text-right text-text-secondary">{fmtCr(row.balance)}</div>
                        <div className="flex items-center gap-2">
                          <button
                            role="switch"
                            aria-checked={on}
                            aria-label={`Scope in ${row.caption}`}
                            onClick={() => setQual(prev => ({
                              ...prev,
                              [row.id]: on
                                ? { ...prev[row.id], on: false }
                                : { captionId: row.id, reason: prev[row.id]?.reason ?? V2_QUAL_REASONS[0], note: prev[row.id]?.note ?? '', on: true },
                            }))}
                            className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer shrink-0 ${on ? 'bg-primary' : 'bg-surface-3'}`}
                          >
                            <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all ${on ? 'left-[18px]' : 'left-[2px]'}`} />
                          </button>
                          {on && (
                            <select
                              value={q?.reason}
                              onChange={e => setQual(prev => ({ ...prev, [row.id]: { ...prev[row.id], reason: e.target.value as V2QualPick['reason'] } }))}
                              className="text-[11px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer min-w-0"
                            >
                              {V2_QUAL_REASONS.map(r => <option key={r}>{r}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                      {on && q?.note && (
                        <div className="px-4 pb-2 -mt-0.5"><p className="text-[11px] text-text-muted leading-relaxed">{q.note}</p></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            title="Processes & group workstreams"
            sub="Each in-scope caption maps to its process — every in-scope process becomes a RACM. The group workstreams become RACMs too, and ITGC is scoped by IT system."
          >
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-4">
                <div className="border border-border-light rounded-xl bg-white overflow-hidden">
                  <div className="grid grid-cols-[1.7fr_1.2fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                    <div>In-scope caption</div><div>Process</div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {scope.inScope.map(({ caption: row }) => (
                      <div key={row.id} className="grid grid-cols-[1.7fr_1.2fr] gap-3 px-4 py-2 items-center border-b border-border-light last:border-b-0">
                        <div className="min-w-0">
                          <span className="text-[12px] text-text truncate block">{row.caption}</span>
                          <span className="text-[10.5px] text-text-muted">{v2EntityShort(row.entityId, entities)}</span>
                        </div>
                        <select
                          value={row.process}
                          onChange={e => setMapping(prev => ({ ...prev, [row.id]: e.target.value as V2ProcessName }))}
                          className="text-[11.5px] text-text-secondary bg-white border border-border rounded-md px-2 py-1 outline-none focus:border-primary/40 cursor-pointer"
                        >
                          {V2_PROCESS_NAMES.map(p => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-border-light rounded-xl bg-white p-4">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Sparkles size={13} className="text-brand-700" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Derived process RACMs</span>
                  </div>
                  {derived.map(r => (
                    <div key={r.area} className="flex items-center justify-between gap-2 py-1">
                      <span className="text-[12.5px] font-semibold text-text">{r.area}</span>
                      <span className="text-[11px] text-text-muted tabular-nums">{r.sources.length} caption{r.sources.length === 1 ? '' : 's'} · {r.entities.length} entit{r.entities.length === 1 ? 'y' : 'ies'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="border border-border-light rounded-xl bg-white p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Group workstreams — each becomes a RACM</div>
                  <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Not display cards — these seed real RACM shells alongside the process RACMs.</p>
                  <div className="space-y-1.5">
                    {V2_WORKSTREAMS.map(w => {
                      const on = wsPicked.includes(w.id);
                      return (
                        <button
                          key={w.id}
                          onClick={() => setWsPicked(prev => on ? prev.filter(x => x !== w.id) : [...prev, w.id])}
                          className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            on ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-surface-2/50 hover:bg-surface-2'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5 border ${on ? 'bg-primary border-primary text-white' : 'border-border bg-white'}`}>
                            {on && <Check size={10} />}
                          </span>
                          <span>
                            <span className="block text-[12px] font-semibold text-text">{w.name}</span>
                            <span className="block text-[11px] text-text-muted leading-relaxed mt-0.5">{w.why}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {wsPicked.includes('itgc') && (
                  <div className="border border-border-light rounded-xl bg-white p-4">
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">ITGC — scope the IT systems</div>
                    <p className="text-[11px] text-text-muted mb-2.5 leading-relaxed">A separate scoping exercise: the systems that impact financial reporting, not the trial balance.</p>
                    <div className="space-y-1">
                      {ITGC_SYSTEMS.map(s => {
                        const on = systems.includes(s.name);
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSystems(prev => on ? prev.filter(x => x !== s.name) : [...prev, s.name])}
                            className={`w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                              on ? 'border-primary/30 bg-primary/5' : 'border-transparent bg-surface-2/50 hover:bg-surface-2'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded inline-flex items-center justify-center shrink-0 border ${on ? 'bg-primary border-primary text-white' : 'border-border bg-white'}`}>
                              {on && <Check size={10} />}
                            </span>
                            <span className="text-[12px] font-semibold text-text">{s.name}</span>
                            <span className="text-[10.5px] text-text-muted ml-auto">{s.role}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </StepShell>
        )}

        {step === 6 && (
          <StepShell
            title="People — who owns what"
            sub="Every RACM needs a process owner (who gives the data) and a control owner (who performs the control). Evidence requests and reminders go to these email addresses."
          >
            <div className="border border-border-light rounded-xl bg-white overflow-hidden">
              <div className="grid grid-cols-[1fr_1.4fr_1.4fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
                <div>RACM</div><div>Process owner — gives the data</div><div>Control owner — performs the control</div>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                {allAreas.map(area => {
                  const row = peopleFor(area);
                  return (
                    <div key={area} className="grid grid-cols-[1fr_1.4fr_1.4fr] gap-3 px-4 py-2.5 items-center border-b border-border-light last:border-b-0">
                      <div className="text-[12.5px] font-semibold text-text">{area}</div>
                      <div>
                        <input
                          value={row.processOwner}
                          onChange={e => setPeople(prev => ({ ...prev, [area]: { ...peopleFor(area), processOwner: e.target.value } }))}
                          placeholder="Name — role"
                          className="w-full text-[12px] text-text bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                        />
                        <div className="text-[10.5px] font-mono text-text-muted truncate">{row.poEmail || '—'}</div>
                      </div>
                      <div>
                        <input
                          value={row.controlOwner}
                          onChange={e => setPeople(prev => ({ ...prev, [area]: { ...peopleFor(area), controlOwner: e.target.value } }))}
                          placeholder="Name — role"
                          className="w-full text-[12px] text-text bg-transparent outline-none border-b border-transparent focus:border-primary/40 transition-colors py-0.5"
                        />
                        <div className="text-[10.5px] font-mono text-text-muted truncate">{row.coEmail || '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50/50 border border-brand-100 mt-3">
              <Users size={13} className="text-brand-700 shrink-0 mt-0.5" />
              <p className="text-[0.75rem] text-text-secondary leading-relaxed">
                The control owner may be the CFO while the data comes from a finance manager —
                that's why both are captured. Population requests, per-sample document asks and
                reminders are emailed to the process owner once effectiveness testing opens.
              </p>
            </div>
          </StepShell>
        )}

        {step === 7 && (
          <StepShell
            title="Review — the scoping decided everything"
            sub="Entities, processes and RACMs below were derived from materiality and the trial balances — nothing was picked by hand."
          >
            <div className="grid grid-cols-3 gap-3 mb-4">
              <ReviewCard title="Entity scope">
                <div className="text-[13px] font-semibold text-text mb-1">{inEntities.length} of {entities.length} in scope</div>
                <div className="text-[11.5px] text-text-secondary mb-2 tabular-nums">{scope.coveragePct}% coverage · target {coverageTarget}%</div>
                {scope.decisions.filter(d => d.status !== 'out').map(d => (
                  <div key={d.entityId} className="flex items-center gap-1.5 py-0.5">
                    <span className="text-[11.5px] text-text-secondary truncate">{entities.find(e => e.id === d.entityId)?.name}</span>
                    <EntityStatusChip status={d.status} small />
                  </div>
                ))}
              </ReviewCard>
              <ReviewCard title="Materiality">
                <LadderRow label="Overall" value={fmtCr(overallCr)} note={basis === 'custom' ? 'Set directly' : `${pct}% of ${basisOpt.benchmarkLabel.toLowerCase()}`} />
                <LadderRow label="Performance" value={fmtCr(pm)} strong note={`${pmPct}% — the scoping threshold`} />
                <LadderRow label="Clearly trivial" value={fmtCr(overallCr * cttPct / 100)} note={`${cttPct}% of overall`} last />
              </ReviewCard>
              <ReviewCard title="Scope funnel">
                <FunnelRow label="TB captions parsed" value={captions.length} />
                <FunnelRow label="Entities in scope" value={inEntities.length} />
                <FunnelRow label="Captions in scope" value={scope.inScope.length} />
                <FunnelRow label="Process RACMs" value={derived.length} />
                <FunnelRow label="Workstream RACMs" value={wsRacms.length} last />
              </ReviewCard>
            </div>
            <div className="border border-border-light rounded-xl bg-white p-4">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                RACMs to be generated — {derived.length + wsRacms.length} total
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {derived.map(r => (
                  <div key={r.area} className="rounded-lg p-3 bg-surface-2/50">
                    <div className="text-[12.5px] font-semibold text-text">{r.area}</div>
                    <div className="text-[10.5px] text-text-muted mt-0.5 tabular-nums">
                      {r.sources.length} caption{r.sources.length === 1 ? '' : 's'} · {r.entities.join(', ')}
                    </div>
                    <div className="text-[10.5px] text-text-muted mt-1">
                      PO {peopleFor(r.area).processOwner.split('—')[0].trim() || '—'} · CO {peopleFor(r.area).controlOwner.split('—')[0].trim() || '—'}
                    </div>
                  </div>
                ))}
                {wsRacms.map(r => (
                  <div key={r.area} className="rounded-lg p-3 bg-brand-50/40">
                    <div className="text-[12.5px] font-semibold text-text">{r.area} <span className="text-[9.5px] font-bold uppercase tracking-wide text-brand-700 ml-1">workstream</span></div>
                    <div className="text-[10.5px] text-text-muted mt-0.5">
                      {r.systems ? r.systems.join(' · ') : 'Group level'}
                    </div>
                    <div className="text-[10.5px] text-text-muted mt-1">
                      PO {peopleFor(r.area).processOwner.split('—')[0].trim() || '—'} · CO {peopleFor(r.area).controlOwner.split('—')[0].trim() || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StepShell>
        )}
      </motion.div>

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
            disabled={!canContinue}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={13} /> Create {fy} programme
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function EntityStatusChip({ status, small }: { status: string; small?: boolean }) {
  const cls =
    status === 'derived' ? 'bg-brand-50 text-brand-700'
    : status === 'coverage' ? 'bg-mitigated-50 text-mitigated-700'
    : status === 'qualitative' ? 'bg-evidence-50 text-evidence-700'
    : status === 'revision' ? 'bg-evidence-50 text-evidence-700'
    : 'bg-surface-2 text-text-muted';
  const label =
    status === 'derived' ? 'In — derived'
    : status === 'coverage' ? 'In — coverage'
    : status === 'qualitative' ? 'In — qualitative'
    : status === 'revision' ? 'In — revision'
    : 'Out of scope';
  return (
    <span className={`inline-flex items-center shrink-0 rounded-full font-semibold ${cls} ${small ? 'px-1.5 h-4 text-[9px]' : 'px-2 h-5 text-[10px]'}`}>
      {label}
    </span>
  );
}

export function ViaChip({ via }: { via: 'quant' | 'qual' | 'coverage' | 'revision' }) {
  const map = {
    quant: ['Above PM', 'bg-brand-50 text-brand-700'],
    qual: ['Qualitative', 'bg-evidence-50 text-evidence-700'],
    coverage: ['Coverage', 'bg-mitigated-50 text-mitigated-700'],
    revision: ['Revision', 'bg-evidence-50 text-evidence-700'],
  } as const;
  const [label, cls] = map[via];
  return <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function StepShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[18px] font-bold text-text">{title}</h2>
      <p className="text-[12.5px] text-text-secondary mt-1 mb-5 max-w-2xl leading-relaxed">{sub}</p>
      {children}
    </div>
  );
}

function LadderRow({ label, value, note, strong, last }: {
  label: string; value: string; note?: string; strong?: boolean; last?: boolean;
}) {
  return (
    <div className={`py-2 ${last ? '' : 'border-b border-border-light'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] ${strong ? 'font-semibold text-text' : 'text-text-secondary'}`}>{label}</span>
        <span className={`font-mono tabular-nums ${strong ? 'text-[15px] font-bold text-text' : 'text-[13px] text-text'}`}>{value}</span>
      </div>
      {note && <div className="text-[10.5px] text-text-muted mt-0.5">{note}</div>}
    </div>
  );
}

function FunnelRow({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${last ? '' : 'border-b border-border-light'}`}>
      <span className="text-[12px] text-text-secondary">{label}</span>
      <span className="text-[13px] font-bold tabular-nums text-text">{value}</span>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border-light rounded-xl bg-white p-4">
      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">{title}</div>
      {children}
    </div>
  );
}
