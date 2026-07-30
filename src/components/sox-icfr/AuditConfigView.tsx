import { Building2, CalendarRange, Check, FileSpreadsheet, Grid3x3, Paperclip, Scale, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { FormSelect } from '../shared/FilterSelect';
import { BASIS_OPTIONS, cycleYears, ruleOverall, type MaterialityBasis } from '../audit/sox-testing/soxTestingData';
import { entitiesFor, processesFor } from './auditScope';
import type { AuditRecord, AuditScopeKind } from './types';
import { cn } from '../../lib/cn';

/**
 * Configuration — the open audit's own settings.
 *
 * The same four things the New audit wizard captured (period, scope, TB / GL,
 * materiality), now editable in place. It edits the AUDIT, not the programme:
 * changing materiality here re-prices this audit's threshold and leaves every
 * other audit on the engagement untouched.
 *
 * Edits save instantly — there is no draft state to lose, and no Save button
 * pretending otherwise.
 */

const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'block text-[11px] font-semibold text-ink-500 mb-1.5';

const fyLabel = (y: number) => `FY ${y - 1}-${String(y).slice(-2)}`;
const cyLabel = (y: number) => `CY ${y}`;
const spanOf = (basis: 'fy' | 'cy', y: number) =>
  basis === 'fy' ? `Apr ${y - 1} – Mar ${y}` : `Jan – Dec ${y}`;
/** The end-year behind a stored label — 'FY 2026-27' / 'CY 2027' ⇒ 2027. */
const yearOf = (a: AuditRecord): number => {
  const m = /(\d{4})/.exec(a.period);
  const first = m ? Number(m[1]) : new Date().getFullYear();
  return a.yearBasis === 'fy' ? first + 1 : first;
};

function Section({ icon: Icon, title, sub, children }: {
  icon: typeof Scale; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-canvas-border bg-white p-5">
      <h2 className="text-[13px] font-bold text-ink-800 inline-flex items-center gap-1.5">
        <Icon size={15} className="text-brand-600" /> {title}
      </h2>
      <p className="text-[11.5px] text-ink-500 mt-0.5 mb-4">{sub}</p>
      {children}
    </section>
  );
}

export default function AuditConfigView({ audit }: { audit: AuditRecord }) {
  const { eng, updateAudit } = useIcfr();
  const { addToast } = useToast();

  const entities = useMemo(() => entitiesFor(eng.id), [eng.id]);
  const racms = useMemo(() => processesFor(eng.id), [eng.id]);

  const year = yearOf(audit);
  // This view's Year type toggle only offers fy/cy (see below) — a quarter or
  // custom audit falls back to 'fy' here rather than asserting a type the
  // field no longer guarantees.
  const cycleBasis: 'fy' | 'cy' = audit.yearBasis === 'cy' ? 'cy' : 'fy';
  // The audit froze its rule as a label, not an id — match back to the option.
  const basisOpt = BASIS_OPTIONS.find(b => b.label === audit.materiality.basisLabel) ?? BASIS_OPTIONS[0];

  const setPeriod = (basis: 'fy' | 'cy', y: number) => updateAudit(audit.id, {
    yearBasis: basis,
    period: basis === 'fy' ? fyLabel(y) : cyLabel(y),
    periodSpan: spanOf(basis, y),
  });

  const setScopeKind = (kind: AuditScopeKind) => {
    if (kind === audit.scopeKind) return;
    updateAudit(audit.id, { scopeKind: kind, scopeNames: [], scopeIds: [] });
  };

  const options = audit.scopeKind === 'entity'
    ? entities.map(e => ({ id: e.id, primary: e.name, secondary: e.type }))
    : racms.map(p => ({ id: p, primary: p, secondary: '' }));

  const pickedIds = audit.scopeKind === 'entity' ? audit.scopeIds : audit.scopeNames;
  const togglePick = (id: string) => {
    const next = pickedIds.includes(id) ? pickedIds.filter(x => x !== id) : [...pickedIds, id];
    const names = next.map(x => options.find(o => o.id === x)?.primary ?? x);
    updateAudit(audit.id, {
      scopeNames: names,
      scopeIds: audit.scopeKind === 'entity' ? next : [],
    });
  };

  const setMateriality = (patch: Partial<{ basis: MaterialityBasis; benchmark: number; pct: number }>) => {
    const basis = patch.basis ?? (basisOpt.id as MaterialityBasis);
    const opt = BASIS_OPTIONS.find(b => b.id === basis)!;
    const benchmark = patch.basis ? opt.defaultBenchmark : patch.benchmark ?? audit.materiality.benchmark;
    const pct = patch.basis ? opt.defaultPct : patch.pct ?? audit.materiality.pct;
    updateAudit(audit.id, {
      materiality: { basisLabel: opt.label, benchmark, pct },
      overall: ruleOverall({ id: 'a', name: 'a', basis, benchmark, pct }),
    });
  };

  const addFile = (kind: 'tb' | 'gl') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) {
        updateAudit(audit.id, { files: [...audit.files, { name: f.name, kind }] });
        addToast({ type: 'success', message: `${f.name} attached` });
      }
    };
    input.click();
  };

  return (
    <div className="w-full space-y-4 pb-8">
      <p className="text-[12.5px] text-ink-500">
        This audit's own settings. Edits save instantly and apply to this audit only —
        the engagement's other audits keep theirs.
      </p>

      <Section icon={CalendarRange} title="Audit period" sub="An annual cycle, named by the year the group reports on.">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className={labelCls}>Year type</label>
            <div className="grid grid-cols-2 gap-1.5 w-[300px]">
              {([['fy', 'Financial year', 'Apr – Mar'], ['cy', 'Calendar year', 'Jan – Dec']] as const).map(([id, t, s]) => (
                <button
                  key={id}
                  onClick={() => setPeriod(id, year)}
                  className={cn('px-2 py-1.5 rounded-lg border text-[12px] font-bold transition-all cursor-pointer',
                    audit.yearBasis === id
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                      : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40')}
                >
                  {t}<span className="block text-[10px] font-semibold opacity-70">{s}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className={labelCls}>Cycle</label>
            <FormSelect
              value={String(year)}
              // This edit view only offers Financial year / Calendar year — a
              // quarter or custom audit's period is set once, on creation, and
              // isn't re-editable into another quarter/range here.
              options={cycleYears(cycleBasis).map(y => ({
                value: String(y), label: cycleBasis === 'fy' ? fyLabel(y) : cyLabel(y),
              }))}
              onChange={v => setPeriod(cycleBasis, Number(v))}
              className={selectCls}
              ariaLabel="Cycle"
              menuCls="w-full"
            />
          </div>
          <p className="text-[11.5px] text-ink-400 pb-2.5">Testing runs {audit.periodSpan}.</p>
        </div>
      </Section>

      <Section
        icon={audit.scopeKind === 'entity' ? Building2 : Grid3x3}
        title="What this audit covers"
        sub="Scope by entity or by RACM — the RACM and Control Library follow this."
      >
        <div className="grid grid-cols-2 gap-1.5 max-w-[300px] mb-4">
          {([['entity', 'By entity', Building2], ['racm', 'By RACM', Grid3x3]] as const).map(([id, t, Icon]) => (
            <button
              key={id}
              onClick={() => setScopeKind(id)}
              className={cn('px-2 py-1.5 rounded-lg border text-[12px] font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5',
                audit.scopeKind === id
                  ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15'
                  : 'border-canvas-border bg-white text-ink-500 hover:bg-brand-50/40')}
            >
              <Icon size={13} /> {t}
            </button>
          ))}
        </div>

        <div className="border border-canvas-border rounded-xl overflow-hidden">
          {options.length === 0 ? (
            <p className="text-[11.5px] text-ink-400 px-4 py-5 text-center">
              {audit.scopeKind === 'entity' ? 'No entities on this engagement.' : 'No RACMs derived yet.'}
            </p>
          ) : options.map(o => {
            const on = pickedIds.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => togglePick(o.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
              >
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white')}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="text-[13px] text-ink-900 flex-1 min-w-0 truncate">{o.primary}</span>
                {o.secondary && <span className="text-[11px] text-ink-400 shrink-0">{o.secondary}</span>}
              </button>
            );
          })}
        </div>
        {pickedIds.length === 0 && (
          <p className="text-[11.5px] text-evidence-700 mt-2">
            Nothing selected — the RACM and Control Library fall back to showing everything.
          </p>
        )}
      </Section>

      <Section icon={FileSpreadsheet} title="Trial balance & general ledger" sub="The files this audit was scoped against.">
        <div className="flex gap-2 mb-4">
          {([['tb', 'Trial balance'], ['gl', 'General ledger']] as const).map(([kind, t]) => (
            <button
              key={kind}
              onClick={() => addFile(kind)}
              className="px-3 py-2 rounded-lg border border-dashed border-canvas-border bg-white hover:border-brand-400 hover:bg-brand-50/40 transition-all cursor-pointer text-[12px] font-semibold text-ink-700 inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet size={14} className="text-brand-600" /> Add {t.toLowerCase()}
            </button>
          ))}
        </div>
        {audit.files.length === 0 ? (
          <p className="text-[11.5px] text-ink-400">Nothing attached.</p>
        ) : (
          <div className="border border-canvas-border rounded-xl overflow-hidden">
            {audit.files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0">
                <Paperclip size={13} className="text-ink-400 shrink-0" />
                <span className="text-[12.5px] text-ink-900 flex-1 min-w-0 truncate">{f.name}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">{f.kind}</span>
                <button
                  onClick={() => updateAudit(audit.id, { files: audit.files.filter((_, x) => x !== i) })}
                  className="text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"
                  aria-label={`Remove ${f.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Scale} title="Materiality rule" sub="The threshold this audit measures its exceptions against.">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="min-w-[240px]">
            <label className={labelCls}>Basis</label>
            <FormSelect
              value={basisOpt.id}
              options={BASIS_OPTIONS.map(b => ({ value: b.id, label: b.label }))}
              onChange={v => setMateriality({ basis: v as MaterialityBasis })}
              className={selectCls}
              ariaLabel="Materiality basis"
              menuCls="w-full"
            />
          </div>
          <div className="w-40">
            <label className={labelCls}>{basisOpt.id === 'custom' ? 'Amount (₹ Cr)' : 'Benchmark (₹ Cr)'}</label>
            <input
              type="number" min={0} value={audit.materiality.benchmark}
              onChange={e => setMateriality({ benchmark: Number(e.target.value) })}
              className={`${inputCls} tabular-nums`}
            />
          </div>
          {basisOpt.id !== 'custom' && (
            <div className="w-24">
              <label className={labelCls}>%</label>
              <input
                type="number" min={0.1} max={100} step={0.1} value={audit.materiality.pct}
                onChange={e => setMateriality({ pct: Number(e.target.value) })}
                className={`${inputCls} tabular-nums`}
              />
            </div>
          )}
          <p className="text-[11.5px] text-ink-500 pb-2.5">
            Overall <span className="font-semibold text-ink-900 tabular-nums">₹{audit.overall} Cr</span>
          </p>
        </div>
      </Section>
    </div>
  );
}
