import { useMemo, useState } from 'react';
import { Building2, CalendarRange, Check, FileSpreadsheet, Grid3x3, Landmark, RefreshCw, Table2, X } from 'lucide-react';
import { FlowModal } from '../audit/sox-testing/SoxTestingTab';
import { FormSelect } from '../shared/FilterSelect';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { entitiesFor, processesFor, programmeFor } from './auditScope';
import { cycleYears } from '../audit/sox-testing/soxTestingData';
import type { AuditRecord } from './types';
import { cn } from '../../lib/cn';

/**
 * Roll forward — carry an audit into the next cycle.
 *
 * A confirmation, not a creation: everything is prefilled from the audit being
 * rolled, and the job is to check it still holds. One sheet, three things to
 * confirm, one commit — stepping through prefilled values would be friction
 * without payoff.
 *
 * What it commits is an ordinary new audit, so `createAudit` does what it always
 * does: the covered controls go back to Not tested and their deficiencies clear.
 * A new cycle re-tests; it does not inherit last cycle's conclusions.
 */

const labelCls = 'block text-[11px] font-semibold text-ink-500 mb-1.5';
const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';

const fyLabel = (y: number) => `FY ${y - 1}-${String(y).slice(-2)}`;
const cyLabel = (y: number) => `CY ${y}`;
const spanOf = (b: 'fy' | 'cy', y: number) => (b === 'fy' ? `Apr ${y - 1} – Mar ${y}` : `Jan – Dec ${y}`);
const yearOf = (a: AuditRecord): number => {
  const m = /(\d{4})/.exec(a.period);
  const first = m ? Number(m[1]) : new Date().getFullYear();
  return a.yearBasis === 'fy' ? first + 1 : first;
};

function Section({ n, title, sub, children }: {
  n: number; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="w-[18px] h-[18px] rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold inline-flex items-center justify-center shrink-0">{n}</span>
        <h3 className="text-[13px] font-semibold text-ink-900">{title}</h3>
      </div>
      <p className="text-[0.75rem] text-ink-500 mb-3 ml-[26px] leading-relaxed">{sub}</p>
      <div className="ml-[26px]">{children}</div>
    </section>
  );
}

export default function RollForwardSheet({ prior, onClose }: { prior: AuditRecord; onClose: () => void }) {
  const { eng, createAudit } = useIcfr();
  const { addToast } = useToast();

  const prog = useMemo(() => programmeFor(eng.id), [eng.id]);
  const entities = useMemo(() => entitiesFor(eng.id), [eng.id]);
  const racms = useMemo(() => processesFor(eng.id), [eng.id]);

  // The next cycle is the point of rolling forward — default one year on.
  const [year, setYear] = useState(() => yearOf(prior) + 1);
  const basis = prior.yearBasis;

  const [group, setGroup] = useState(prog?.groupName ?? eng.entity);
  const [picked, setPicked] = useState<string[]>(
    prior.scopeKind === 'entity' ? prior.scopeIds : prior.scopeNames,
  );

  // Documents carry forward unless unticked — the TB and GL are last cycle's
  // and usually get replaced, so they are confirmed rather than assumed.
  const [carryRacm, setCarryRacm] = useState(true);
  const [carryFiles, setCarryFiles] = useState<Record<string, boolean>>(
    Object.fromEntries(prior.files.map((f, i) => [`${f.name}-${i}`, true])),
  );

  const options = prior.scopeKind === 'entity'
    ? entities.map(e => ({ id: e.id, primary: e.name, secondary: e.type }))
    : racms.map(p => ({ id: p, primary: p, secondary: '' }));

  const toggle = (id: string) =>
    setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const files = prior.files.filter((f, i) => carryFiles[`${f.name}-${i}`]);
  const tb = files.filter(f => f.kind === 'tb');
  const gl = files.filter(f => f.kind === 'gl');
  const ready = picked.length > 0;

  const commit = () => {
    const names = picked.map(id => options.find(o => o.id === id)?.primary ?? id);
    createAudit({
      period: basis === 'fy' ? fyLabel(year) : cyLabel(year),
      yearBasis: basis,
      periodSpan: spanOf(basis, year),
      scopeKind: prior.scopeKind,
      scopeNames: names,
      scopeIds: prior.scopeKind === 'entity' ? picked : [],
      // The prior audit's control-level picks carry too — rolling forward repeats
      // last cycle's scope, and dropping them would silently widen it.
      controlIds: prior.controlIds ?? [],
      files,
      materiality: prior.materiality,
      overall: prior.overall,
    });
    addToast({
      type: 'success',
      title: 'Rolled forward',
      message: `${basis === 'fy' ? fyLabel(year) : cyLabel(year)} created from ${prior.period} — controls reset to Not tested.`,
    });
    onClose();
  };

  const Row = ({ on, onToggle, icon, primary, secondary }: {
    on: boolean; onToggle: () => void; icon: React.ReactNode; primary: string; secondary?: string;
  }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-canvas-border last:border-b-0 hover:bg-brand-50/40 transition-colors cursor-pointer text-left"
    >
      <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
        on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white')}>
        {on && <Check size={11} strokeWidth={3} />}
      </span>
      {icon}
      <span className="text-[13px] text-ink-900 flex-1 min-w-0 truncate">{primary}</span>
      {secondary && <span className="text-[11px] text-ink-400 shrink-0">{secondary}</span>}
    </button>
  );

  return (
    <FlowModal label="Roll forward" widthCls="w-full max-w-[560px]" variant="sheet" hideClose onClose={onClose}>
      <div className="min-h-full flex flex-col">
        <div className="sticky -top-6 z-10 bg-canvas -mx-6 px-6 -mt-6 pt-11 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={16} className="text-brand-600 shrink-0" />
                <h2 className="text-[1.125rem] font-semibold text-ink-900 tracking-tight">Roll forward</h2>
              </div>
              <p className="text-[0.75rem] text-ink-500">Carrying {prior.period} into the next cycle</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close drawer"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1">
          <Section n={1} title="Audit period" sub="The cycle this audit rolls into.">
            <label className={labelCls}>Cycle</label>
            <FormSelect
              value={String(year)}
              options={cycleYears(basis).concat(yearOf(prior) + 1)
                .filter((y, i, a) => a.indexOf(y) === i)
                .sort((a, b) => a - b)
                .map(y => ({ value: String(y), label: basis === 'fy' ? fyLabel(y) : cyLabel(y) }))}
              onChange={v => setYear(Number(v))}
              className={selectCls}
              ariaLabel="Audit period"
              menuCls="w-full"
            />
            <div className="mt-2 flex items-start gap-2 p-3 rounded-lg bg-brand-50/60 border border-brand-100">
              <CalendarRange size={13} className="text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-ink-600 leading-relaxed">
                Testing runs <span className="font-semibold text-ink-900">{spanOf(basis, year)}</span>.
              </p>
            </div>
          </Section>

          <Section n={2} title="Company & entities" sub="Confirm the group and what the new cycle covers.">
            <label className={labelCls}>Group (listed / holding)</label>
            <input value={group} onChange={e => setGroup(e.target.value)} className={`${inputCls} mb-3`} aria-label="Group name" />
            <div className="border border-canvas-border rounded-xl overflow-hidden">
              {options.length === 0 ? (
                <p className="text-[11.5px] text-ink-400 px-4 py-5 text-center">Nothing to carry forward.</p>
              ) : options.map(o => (
                <Row
                  key={o.id}
                  on={picked.includes(o.id)}
                  onToggle={() => toggle(o.id)}
                  icon={prior.scopeKind === 'entity'
                    ? (o.secondary === 'Holding'
                      ? <Landmark size={14} className="text-brand-600 shrink-0" />
                      : <Building2 size={14} className="text-ink-400 shrink-0" />)
                    : <Grid3x3 size={14} className="text-ink-400 shrink-0" />}
                  primary={o.primary}
                  secondary={o.secondary}
                />
              ))}
            </div>
            {!ready && <p className="text-[11.5px] text-risk-700 mt-2">Pick at least one to roll forward.</p>}
          </Section>

          <Section n={3} title="Documents" sub="What carries into the new cycle. Untick anything the new period will replace.">
            <div className="border border-canvas-border rounded-xl overflow-hidden">
              <Row
                on={carryRacm}
                onToggle={() => setCarryRacm(v => !v)}
                icon={<Table2 size={14} className="text-ink-400 shrink-0" />}
                primary="RACM"
                secondary={`${racms.length} matrix${racms.length === 1 ? '' : 'es'}`}
              />
              {prior.files.length === 0 ? (
                <div className="px-3.5 py-2.5 text-[11.5px] text-ink-400 border-t border-canvas-border">
                  No trial balance or general ledger on {prior.period} — attach them from the new audit's Configuration.
                </div>
              ) : prior.files.map((f, i) => {
                const key = `${f.name}-${i}`;
                return (
                  <Row
                    key={key}
                    on={!!carryFiles[key]}
                    onToggle={() => setCarryFiles(p => ({ ...p, [key]: !p[key] }))}
                    icon={<FileSpreadsheet size={14} className="text-ink-400 shrink-0" />}
                    primary={f.name}
                    secondary={f.kind.toUpperCase()}
                  />
                );
              })}
            </div>
            <p className="text-[11.5px] text-ink-400 mt-2">
              {tb.length} trial balance{tb.length === 1 ? '' : 's'} · {gl.length} general ledger{gl.length === 1 ? '' : 's'} carrying forward.
            </p>
          </Section>

          <div className="rounded-lg border border-evidence-200 bg-evidence-50 p-3">
            <p className="text-[11.5px] text-evidence-800 leading-relaxed">
              Creating this cycle resets the covered controls to <span className="font-semibold">Not tested</span> and
              clears their deficiencies. {prior.period} keeps nothing — a new cycle is tested from scratch.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 bg-canvas -mx-6 px-6 mt-6 pt-4 pb-6 border-t border-canvas-border flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3.5 rounded-lg border border-canvas-border text-[12.5px] font-semibold text-ink-600 hover:text-ink-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={!ready}
            className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} /> Roll forward
          </button>
        </div>
      </div>
    </FlowModal>
  );
}
