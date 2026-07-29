import { useState } from 'react';
import {
  AlertTriangle, Building2, CalendarRange, FileSpreadsheet, Landmark, Loader2,
  Plus, RefreshCw, Scale, Trash2, Upload, X,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { findEngagement } from '../../data/engagements';
import { useIcfr } from './store';
import {
  BASIS_OPTIONS, PROGRAMMES, SEED_QUAL_PICKS, SEED_TB_FILES,
  captionsForEntities, deriveRacms, fmtCr, ruleOverall,
  type GroupEntity, type MaterialityRule, type SoxProgramme,
} from '../audit/sox-testing/soxTestingData';

/** The programme's group-default rule always sits first and can't be deleted. */
const GROUP_RULE_ID = 'rule-group';

/** Per-entity "Upload TB" button — was briefly parked, then the user
 *  reverted. Set false to park it again (rows without a TB show a dash). */
const TB_UPLOAD_BTN = true;

const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const selectCls = 'text-[12px] text-ink-600 bg-white border border-canvas-border rounded-md px-2 py-1.5 outline-none focus:border-brand-400 cursor-pointer';
const uploadBtnCls = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-canvas-border bg-white hover:bg-brand-50/60 hover:border-brand-300 text-[11px] font-semibold text-ink-600 hover:text-brand-700 transition-colors cursor-pointer';

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-bold text-ink-400 uppercase tracking-wider mb-1.5">{children}</div>;
}

/**
 * Configuration — the post-creation working surface for a scoping-backed SOX
 * engagement: entities, trial balances, testing period and materiality rules
 * (incl. per-entity component rules). Edits save instantly onto the programme;
 * "Re-derive scope" recalculates the in-scope processes and reconciles the
 * live workspace RACMs. The Materiality & scope page stays the formal record.
 */
export default function ConfigurationView() {
  const { eng, reconcileScope } = useIcfr();
  const prog = PROGRAMMES.find(p => p.engagementId === eng.id);
  if (!prog) return null;
  return <ConfigInner key={prog.id} prog={prog} engId={eng.id} reconcileScope={reconcileScope} />;
}

function ConfigInner({ prog, engId, reconcileScope }: {
  prog: SoxProgramme;
  engId: string;
  reconcileScope: (processes: string[]) => void;
}) {
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  const [groupName, setGroupName] = useState(prog.groupName);
  const [entities, setEntities] = useState<GroupEntity[]>(() => prog.entities.map(e => ({ ...e })));
  const [rules, setRules] = useState<MaterialityRule[]>(() => [
    { id: GROUP_RULE_ID, name: 'Group default', basis: prog.materiality.basis, benchmark: prog.materiality.benchmark, pct: prog.materiality.pct },
    ...(prog.matRules ?? []).map(r => ({ ...r })),
  ]);
  const [pmPct, setPmPct] = useState(prog.materiality.pmPct);
  const [cttPct, setCttPct] = useState(prog.materiality.cttPct);
  const [yearBasis, setYearBasis] = useState<'fy' | 'cy'>(() => (prog.asOf.includes('Mar') ? 'fy' : 'cy'));
  const [fyEnd, setFyEnd] = useState(() => Number(/\d{4}/.exec(prog.asOf)?.[0] ?? 2027));
  const [parsing, setParsing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastDerive, setLastDerive] = useState<string | null>(null);

  const groupRule = rules[0];
  const groupOverall = ruleOverall(groupRule);
  const canReDerive = entities.length > 0 && entities.every(e => e.name.trim());

  const YEAR_OPTIONS = yearBasis === 'fy'
    ? [2026, 2027, 2028].map(y => ({ value: y, label: `FY ${y - 1}-${String(y).slice(-2)}` }))
    : [2025, 2026, 2027].map(y => ({ value: y, label: `CY ${y}` }));

  /* Edits write straight onto the programme object (module store) so the
     scoping summary and landing card read the same truth. */
  const saveEntities = (updater: (prev: GroupEntity[]) => GroupEntity[], markStale = true) => {
    setEntities(prev => {
      const next = updater(prev);
      prog.entities = next;
      return next;
    });
    if (markStale) setStale(true);
  };

  const saveRules = (next: MaterialityRule[], nextPm = pmPct, nextCtt = cttPct) => {
    setRules(next);
    const g = next[0];
    const opt = BASIS_OPTIONS.find(b => b.id === g.basis);
    prog.materiality = {
      basis: g.basis,
      benchmarkLabel: opt?.benchmarkLabel ?? 'Overall materiality',
      benchmark: g.benchmark,
      pct: g.basis === 'custom' ? 100 : g.pct,
      overall: ruleOverall(g),
      pmPct: nextPm,
      cttPct: nextCtt,
    };
    prog.matRules = next.slice(1);
    setStale(true);
  };

  const patchRule = (id: string, patch: Partial<MaterialityRule>) =>
    saveRules(rules.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const applyPeriod = (basis: 'fy' | 'cy', end: number) => {
    setYearBasis(basis);
    setFyEnd(end);
    const asOf = basis === 'fy' ? `31 Mar ${end}` : `31 Dec ${end}`;
    const label = basis === 'fy' ? `FY ${end - 1}-${String(end).slice(-2)}` : `CY ${end}`;
    prog.asOf = asOf;
    prog.fy = `FY${String(end).slice(-2)}`;
    const e = findEngagement(engId);
    if (e) {
      e.periodStart = basis === 'fy' ? `Apr ${end - 1}` : `Jan ${end}`;
      e.periodEnd = basis === 'fy' ? `Mar ${end}` : `Dec ${end}`;
      e.startDate = basis === 'fy' ? `${end - 1}-04-01` : `${end}-01-01`;
      e.endDate = basis === 'fy' ? `${end}-03-31` : `${end}-12-31`;
    }
    logEvent({ action: 'Update', description: `SOX testing period set to ${label} — as of ${asOf}`, module: 'SOX ICFR', entity: 'Engagement' });
    addToast({ message: `Testing period set to ${label}`, type: 'success' });
  };

  const uploadTb = (ent: GroupEntity) => {
    setParsing(ent.id);
    const slug = ent.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '') || 'entity';
    const file = SEED_TB_FILES[ent.id] ?? { file: `${slug}-tb-${prog.fy.toLowerCase()}.xlsx`, lines: 96 };
    window.setTimeout(() => {
      setParsing(null);
      saveEntities(prev => prev.map(x => (x.id === ent.id ? { ...x, tbFile: file.file, tbLines: file.lines } : x)));
    }, 700);
  };

  const reDerive = () => {
    const thr = (entId: string) => {
      const ent = entities.find(x => x.id === entId);
      const r = ent?.ruleId ? rules.find(x => x.id === ent.ruleId) : undefined;
      return r ? ruleOverall(r) : groupOverall;
    };
    const caps = captionsForEntities(entities);
    const qualSeed = new Set(SEED_QUAL_PICKS.map(q => q.captionId));
    const quant = caps.filter(c => c.balance >= thr(c.entityId));
    const qual = caps.filter(c => c.balance < thr(c.entityId) && qualSeed.has(c.id));
    const derived = deriveRacms([...quant, ...qual], new Set(qual.map(c => c.id)), entities);
    // Processes that stay in scope keep their live testing counts.
    for (const r of derived) {
      const old = prog.racms.find(x => x.process === r.process);
      if (old?.controls != null) { r.controls = old.controls; r.effective = old.effective; }
    }
    prog.racms = derived;
    prog.totalCaptions = caps.length;
    prog.quantCount = quant.length;
    prog.qualCount = qual.length;
    prog.groupName = groupName.trim() || prog.groupName;
    const e = findEngagement(engId);
    const CR = 10_000_000;
    if (e) {
      e.soxProcesses = derived.map(r => r.process);
      e.soxConfig = {
        overallMateriality: Math.round(groupOverall * CR),
        performanceMateriality: Math.round(groupOverall * pmPct / 100 * CR),
        clearlyTrivial: Math.round(groupOverall * cttPct / 100 * CR),
        sdBandPct: e.soxConfig?.sdBandPct ?? 20,
        aggregate: e.soxConfig?.aggregate ?? true,
        keyOnly: e.soxConfig?.keyOnly ?? true,
      };
      e.entity = prog.groupName;
    }
    reconcileScope(derived.map(r => r.process));
    setStale(false);
    setLastDerive(`${derived.length} processes in scope — ${quant.length} quantitative + ${qual.length} qualitative captions across ${entities.length} entities.`);
    logEvent({ action: 'Update', description: `Scope re-derived from configuration — ${derived.length} in-scope processes, materiality ${fmtCr(groupOverall)}`, module: 'SOX ICFR', entity: 'Engagement' });
    addToast({ message: `Scope re-derived — ${derived.length} processes in scope`, type: 'success' });
  };

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[12.5px] text-ink-500">
          The working surface for this engagement's scoping configuration. Edits save instantly;
          the Materiality &amp; scope page remains the formal record and reflects the latest numbers.
        </p>
      </div>

      {stale && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-evidence-200 bg-evidence-50">
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-evidence-800">
            <AlertTriangle size={14} className="text-evidence-700 shrink-0" />
            Configuration changed — the derived scope may be stale.
          </div>
          <button
            onClick={reDerive}
            disabled={!canReDerive}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <RefreshCw size={12} /> Re-derive scope
          </button>
        </div>
      )}
      {!stale && lastDerive && (
        <div className="px-4 py-3 rounded-xl border border-compliant-200 bg-compliant-50 text-[12.5px] text-compliant-800">
          {lastDerive}
        </div>
      )}

      {/* ── Testing period ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-white p-5">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><CalendarRange size={15} className="text-brand-600" /> Testing period</h2>
        <p className="text-[11.5px] text-ink-500 mt-0.5 mb-4">An annual cycle, not a dated project — the cycle is named by the year the group reports on.</p>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label>Year type</Label>
            <div className="grid grid-cols-2 gap-1.5 w-[300px]">
              <button
                onClick={() => { if (yearBasis !== 'fy') applyPeriod('fy', fyEnd + 1); }}
                className={`px-2 py-1.5 rounded-lg border text-[12px] font-bold transition-all cursor-pointer ${yearBasis === 'fy' ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15' : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40'}`}
              >
                Financial year
                <span className="block text-[10px] font-semibold opacity-70">Apr – Mar</span>
              </button>
              <button
                onClick={() => { if (yearBasis !== 'cy') applyPeriod('cy', fyEnd - 1); }}
                className={`px-2 py-1.5 rounded-lg border text-[12px] font-bold transition-all cursor-pointer ${yearBasis === 'cy' ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15' : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40'}`}
              >
                Calendar year
                <span className="block text-[10px] font-semibold opacity-70">Jan – Dec</span>
              </button>
            </div>
          </div>
          <div>
            <Label>Audit period</Label>
            <select value={fyEnd} onChange={e => applyPeriod(yearBasis, Number(e.target.value))} className={`${selectCls} py-2 min-w-[140px]`}>
              {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="text-[11.5px] text-ink-400 pb-2.5">
            Testing runs {yearBasis === 'fy' ? `Apr ${fyEnd - 1} – Mar ${fyEnd}` : `Jan – Dec ${fyEnd}`} · opinion as of {prog.asOf}.
          </div>
        </div>
      </section>

      {/* ── Group & entities ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-white p-5">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Building2 size={15} className="text-brand-600" /> Group &amp; entities</h2>
        <p className="text-[11.5px] text-ink-500 mt-0.5 mb-4">Add or remove entities and their trial balances — then re-derive so scoping catches up.</p>
        <div className="max-w-md mb-4">
          <Label>Group (listed / holding)</Label>
          <input value={groupName} onChange={e => { setGroupName(e.target.value); prog.groupName = e.target.value; }} className={inputCls} />
        </div>
        <div className="border border-canvas-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1.6fr_0.8fr_1.5fr_1.2fr_76px] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-ink-400 border-b border-canvas-border bg-canvas">
            <div>Entity</div><div>Type</div><div>Trial balance</div><div>Materiality rule</div><div />
          </div>
          {entities.map(ent => (
            <div key={ent.id} className="grid grid-cols-[1.6fr_0.8fr_1.5fr_1.2fr_76px] gap-3 px-4 py-2.5 items-center border-b border-canvas-border last:border-b-0">
              <div className="flex items-center gap-2 min-w-0">
                {ent.type === 'Holding'
                  ? <Landmark size={14} className="text-brand-600 shrink-0" />
                  : <Building2 size={14} className="text-ink-400 shrink-0" />}
                <input
                  value={ent.name}
                  onChange={e => saveEntities(prev => prev.map(x => (x.id === ent.id ? { ...x, name: e.target.value } : x)), false)}
                  aria-label="Entity name"
                  placeholder="Entity name"
                  className="w-full text-[13px] text-ink-900 bg-transparent outline-none border-b border-transparent focus:border-brand-400 transition-colors py-0.5"
                />
              </div>
              <select
                value={ent.type}
                onChange={e => saveEntities(prev => prev.map(x => (x.id === ent.id ? { ...x, type: e.target.value as GroupEntity['type'] } : x)), false)}
                className={selectCls}
              >
                <option>Holding</option>
                <option>Subsidiary</option>
              </select>
              <div className="min-w-0">
                {parsing === ent.id ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-400"><Loader2 size={12} className="animate-spin" /> Parsing…</span>
                ) : ent.tbFile ? (
                  <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                    <FileSpreadsheet size={13} className="text-compliant-600 shrink-0" />
                    <span className="text-[11px] font-mono text-ink-600 truncate">{ent.tbFile}</span>
                    {ent.tbLines != null && <span className="text-[10.5px] text-ink-400 tabular-nums shrink-0">· {ent.tbLines}</span>}
                    <button
                      onClick={() => saveEntities(prev => prev.map(x => (x.id === ent.id ? { ...x, tbFile: undefined, tbLines: undefined } : x)))}
                      aria-label={`Remove trial balance for ${ent.name}`}
                      className="p-0.5 rounded text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ) : TB_UPLOAD_BTN ? (
                  <button onClick={() => uploadTb(ent)} className={uploadBtnCls}>
                    <Upload size={11} /> Upload TB
                  </button>
                ) : (
                  <span className="text-[11px] text-ink-400">—</span>
                )}
              </div>
              <select
                value={ent.ruleId ?? GROUP_RULE_ID}
                onChange={e => saveEntities(prev => prev.map(x => (x.id === ent.id ? { ...x, ruleId: e.target.value === GROUP_RULE_ID ? undefined : e.target.value } : x)))}
                aria-label={`Materiality rule for ${ent.name}`}
                className={selectCls}
              >
                {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {confirmDelete === `ent:${ent.id}` ? (
                <span className="flex items-center gap-1 justify-self-end">
                  <button
                    onClick={() => { saveEntities(prev => prev.filter(x => x.id !== ent.id)); setConfirmDelete(null); }}
                    className="px-2 py-1 rounded-md text-[10.5px] font-bold text-white bg-risk-600 hover:bg-risk-700 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                  <button onClick={() => setConfirmDelete(null)} aria-label="Keep entity" className="p-1 rounded-md text-ink-400 hover:bg-canvas cursor-pointer">
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDelete(`ent:${ent.id}`)}
                  disabled={entities.length === 1}
                  aria-label={`Remove ${ent.name}`}
                  className="p-1.5 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer justify-self-end"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => saveEntities(prev => [...prev, { id: `ent-cfg-${prev.length}-${Date.now()}`, name: '', type: 'Subsidiary', ownership: 100 }])}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50/60 w-full transition-colors cursor-pointer"
          >
            <Plus size={13} /> Add entity
          </button>
        </div>
      </section>

      {/* ── Materiality rules ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-canvas-border bg-white p-5">
        <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5"><Scale size={15} className="text-brand-600" /> Materiality rules</h2>
        <p className="text-[11.5px] text-ink-500 mt-0.5 mb-4">
          The group default drives scoping; add rules and assign them to entities for component-level thresholds.
        </p>
        <div className="space-y-2.5">
          {rules.map(r => {
            const isGroup = r.id === GROUP_RULE_ID;
            const assigned = entities.filter(e => (e.ruleId ?? GROUP_RULE_ID) === r.id).length;
            return (
              <div key={r.id} className="rounded-lg border border-canvas-border p-3.5">
                <div className="grid grid-cols-[1.4fr_1.5fr_1fr_0.7fr_1fr_28px] gap-3 items-end">
                  <div>
                    <Label>Rule</Label>
                    {isGroup ? (
                      <div className="text-[13px] font-semibold text-ink-900 py-2">Group default</div>
                    ) : (
                      <input
                        value={r.name}
                        onChange={e => patchRule(r.id, { name: e.target.value })}
                        aria-label="Rule name"
                        className={inputCls}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Basis</Label>
                    <select
                      value={r.basis}
                      onChange={e => {
                        const opt = BASIS_OPTIONS.find(b => b.id === e.target.value)!;
                        patchRule(r.id, { basis: opt.id, benchmark: opt.defaultBenchmark, pct: opt.defaultPct });
                      }}
                      aria-label={`Basis for ${r.name}`}
                      className={`${selectCls} w-full py-2`}
                    >
                      {BASIS_OPTIONS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>{r.basis === 'custom' ? 'Amount (₹ Cr)' : 'Benchmark (₹ Cr)'}</Label>
                    <input
                      type="number" min={0}
                      value={r.benchmark}
                      onChange={e => patchRule(r.id, { benchmark: Number(e.target.value) })}
                      aria-label={`Benchmark for ${r.name}`}
                      className={`${inputCls} tabular-nums`}
                    />
                  </div>
                  <div>
                    {r.basis !== 'custom' && (
                      <>
                        <Label>%</Label>
                        <input
                          type="number" min={0.1} max={100} step={0.1}
                          value={r.pct}
                          onChange={e => patchRule(r.id, { pct: Number(e.target.value) })}
                          aria-label={`Percentage for ${r.name}`}
                          className={`${inputCls} tabular-nums`}
                        />
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <Label>Overall</Label>
                    <div className="text-[13.5px] font-bold text-ink-900 tabular-nums py-1.5">{fmtCr(ruleOverall(r))}</div>
                  </div>
                  {!isGroup ? (
                    confirmDelete === `rule:${r.id}` ? (
                      <button
                        onClick={() => {
                          saveRules(rules.filter(x => x.id !== r.id));
                          saveEntities(prev => prev.map(e => (e.ruleId === r.id ? { ...e, ruleId: undefined } : e)));
                          setConfirmDelete(null);
                        }}
                        className="mb-1 px-1.5 py-1 rounded-md text-[10px] font-bold text-white bg-risk-600 hover:bg-risk-700 transition-colors cursor-pointer"
                      >
                        Del
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(`rule:${r.id}`)}
                        aria-label={`Delete ${r.name}`}
                        className="mb-1.5 p-1.5 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )
                  ) : <span />}
                </div>
                <div className="text-[10.5px] text-ink-400 mt-2">
                  {assigned} entit{assigned === 1 ? 'y' : 'ies'} on this rule{isGroup ? ' (every entity without its own assignment)' : ''}
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => saveRules([...rules, { id: `rule-${Date.now()}`, name: `Rule ${rules.length + 1}`, basis: 'custom', benchmark: 10, pct: 100 }])}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-canvas-border bg-white hover:bg-brand-50/60 hover:border-brand-300 text-[11.5px] font-semibold text-ink-600 hover:text-brand-700 transition-colors cursor-pointer"
        >
          <Plus size={12} /> Add rule
        </button>

        <div className="grid grid-cols-2 gap-4 mt-5 max-w-md">
          <div>
            <Label>Performance materiality (% of overall)</Label>
            <input
              type="number" min={50} max={75} step={5}
              value={pmPct}
              onChange={e => { setPmPct(Number(e.target.value)); saveRules(rules, Number(e.target.value), cttPct); }}
              className={`${inputCls} tabular-nums`}
            />
          </div>
          <div>
            <Label>Clearly trivial (% of overall)</Label>
            <input
              type="number" min={1} max={10}
              value={cttPct}
              onChange={e => { setCttPct(Number(e.target.value)); saveRules(rules, pmPct, Number(e.target.value)); }}
              className={`${inputCls} tabular-nums`}
            />
          </div>
        </div>
      </section>

    </div>
  );
}
