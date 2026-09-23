import { Building2, CalendarRange, Check, FileSpreadsheet, Grid3x3, Lock, Paperclip, Scale, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useIcfr } from './store';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { FormSelect } from '../shared/FilterSelect';
import { BASIS_OPTIONS, cycleYears, ruleOverall, type MaterialityBasis } from '../audit/sox-testing/soxTestingData';
import { entitiesFor, processesFor } from './auditScope';
import { useAuditFiles } from './useAuditFiles';
import { OriginPicker } from './parts';
import { MaterialityGroundRules } from './extraViews';

import type { AuditRecord, AuditScopeKind, FileOrigin } from './types';
import { cn } from '../../lib/cn';

/**
 * Configuration — the open audit's own settings.
 *
 * The same four things the New audit wizard captured (period, scope, TB / GL,
 * materiality), now editable in place. It edits the AUDIT, not the programme:
 * changing materiality here re-prices this audit's threshold and leaves every
 * other audit on the engagement untouched.
 *
 * While the audit is open, edits save instantly — there is no draft state to
 * lose, and no Save button pretending otherwise. Once it is signed off or
 * archived the page stops being a form: see `frozen` below.
 */

const inputCls = 'w-full px-3 py-2 text-[13px] border border-canvas-border rounded-lg bg-white text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';
const selectCls = inputCls + ' cursor-pointer appearance-none';
const labelCls = 'block text-[11px] font-semibold text-ink-500 mb-1.5';
/** What a field looks like when it can only be read. Same padding and size as
 *  the box it stands in for, with an invisible border, so freezing the page
 *  doesn't shift a single label. */
const readCls = 'block px-3 py-2 text-[13px] font-semibold text-ink-800 border border-transparent';

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

/**
 * The audit's file registry — every file that entered, and where each came from.
 *
 * Provenance here is READ-ONLY (user rule, Aug 2026): the question is answered
 * once, at the moment a file enters — the attach flow below, or the control
 * page's evidence ask — and the answer stands as recorded. This registry
 * reports every file's origin in one place; it does not re-open it.
 */
function FileRegistrySection({ audit, frozen, addFile }: {
  audit: AuditRecord;
  frozen: boolean;
  addFile: (kind: 'tb' | 'gl', name: string, origin: FileOrigin) => void;
}) {
  const { updateAudit } = useIcfr();
  const files = useAuditFiles();
  const [adding, setAdding] = useState<{ kind: 'tb' | 'gl'; name: string } | null>(null);
  const [origin, setOrigin] = useState<FileOrigin | undefined>();

  const pick = (kind: 'tb' | 'gl') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => { const f = input.files?.[0]; if (f) { setAdding({ kind, name: f.name }); setOrigin(undefined); } };
    input.click();
  };

  return (
    <Section icon={FileSpreadsheet} title="Source files" sub="Every file this audit holds, and where each one came from. Provenance is answered once, when a file enters — never re-asked, never re-edited.">
      {/* No way in once the audit is closed — a file that arrives after the
          conclusion was signed was not part of what anybody tested. */}
      {!frozen && (
        <div className="flex gap-2 mb-4">
          {([['tb', 'Trial balance'], ['gl', 'General ledger']] as const).map(([kind, t]) => (
            <button
              key={kind}
              onClick={() => pick(kind)}
              className="px-3 py-2 rounded-lg border border-dashed border-canvas-border bg-white hover:border-brand-400 hover:bg-brand-50/40 transition-all cursor-pointer text-[12px] font-semibold text-ink-700 inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet size={14} className="text-brand-600" /> Add {t.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {/* the question, inline, before the file is attached */}
      {adding && !frozen && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/30 p-3.5">
          <div className="flex items-center gap-2">
            <Paperclip size={13} className="text-brand-600 shrink-0" />
            <span className="text-[12.5px] font-semibold text-ink-900 truncate min-w-0">{adding.name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">{adding.kind}</span>
          </div>
          <span className="block text-[10.5px] font-bold uppercase tracking-wider text-ink-400 mt-3 mb-2">Where did this file come from?</span>
          <OriginPicker value={origin} onPick={setOrigin} />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={() => { setAdding(null); setOrigin(undefined); }} className="h-8 px-3 text-[12px] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
            <button disabled={!origin} title={origin ? undefined : 'Say where it came from first'}
              onClick={() => { if (origin) { addFile(adding.kind, adding.name, origin); setAdding(null); setOrigin(undefined); } }}
              className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-[12px] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">Attach file</button>
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-[11.5px] text-ink-400">Nothing attached.</p>
      ) : (
        <div className="border border-canvas-border rounded-xl overflow-hidden">
          {files.map(f => {
            const attached = audit.files.findIndex(x => x.name === f.name);
            return (
              <div key={f.name} className="px-3.5 py-3 border-b border-canvas-border last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <Paperclip size={13} className="text-ink-400 shrink-0" />
                  <span className="text-[12.5px] text-ink-900 flex-1 min-w-0 truncate">{f.name}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">{f.kind}</span>
                  {attached >= 0 && !frozen && (
                    <button
                      onClick={() => updateAudit(audit.id, { files: audit.files.filter((_, x) => x !== attached) })}
                      className="text-ink-400 hover:text-risk-700 transition-colors cursor-pointer shrink-0"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
                  <span>{f.rows.toLocaleString()} rows</span>
                  <span>{f.from}</span>
                  <span>Added by {f.uploadedBy}, {f.uploadedAt}</span>
                  {/* what changing the answer would reach */}
                  <span className={cn(f.usedBy.length > 0 && 'text-ink-600 font-semibold')}>
                    {f.usedBy.length === 0 ? 'No control draws on it yet' : `${f.usedBy.length} control${f.usedBy.length === 1 ? '' : 's'} draw on it`}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">Origin</span>
                  {f.systemFetched ? (
                    <span className="text-[11.5px] font-semibold text-ink-700">Fetched by the system — nothing to answer</span>
                  ) : (
                    <>
                      <span className="text-[11.5px] font-semibold text-ink-700">{f.origin}</span>
                      <span className="text-[10.5px] text-ink-400">
                        {f.originBy ? `Recorded by ${f.originBy}, ${f.originAt}` : f.recorded ? 'Recorded at upload' : 'Taken from the file’s kind'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
        An origin is recorded at the moment its file enters the audit, and stands as recorded — this registry reports it, it does not re-open it.
      </p>
    </Section>
  );
}

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
  const { eng, updateAudit, registerFile, me } = useIcfr();
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  const entities = useMemo(() => entitiesFor(eng.id), [eng.id]);
  const racms = useMemo(() => processesFor(eng.id), [eng.id]);

  /** The other audits an engagement-level edit made here would also re-grade.
   *  Empty means this is the only audit, and the ground rules edit directly. */
  const otherAudits = useMemo(
    () => eng.audits.filter(a => a.id !== audit.id).map(a => a.period),
    [eng.audits, audit.id],
  );

  /* A settled audit is a record, not a form (user ask, 23 Sep). Two ways an
   * audit settles, and both close this page for good: both signatures are on it,
   * or its cycle has been archived. There is deliberately no way back — unlike
   * the sampling methodology, which is versioned and can be revised, an audit
   * has one period and one materiality rule, and a control that was tested
   * against them cannot be re-tested against different ones after the fact. */
  const frozen = !!audit.archive || !!(audit.signoff?.preparer && audit.signoff?.reviewer);

  const year = yearOf(audit);
  // This view's Year type toggle only offers fy/cy (see below) — a quarter or
  // custom audit falls back to 'fy' here rather than asserting a type the
  // field no longer guarantees.
  const cycleBasis: 'fy' | 'cy' = audit.yearBasis === 'cy' ? 'cy' : 'fy';
  // The audit froze its rule as a label, not an id — match back to the option.
  const basisOpt = BASIS_OPTIONS.find(b => b.label === audit.materiality.basisLabel) ?? BASIS_OPTIONS[0];

  /* Every writer below re-checks `frozen` on the way in. A frozen page renders
   * no control that can reach them, so this never fires today — it is here so
   * that a field added to this page later cannot quietly write to a signed
   * audit just because whoever added it forgot the read-only branch. */
  const setPeriod = (basis: 'fy' | 'cy', y: number) => {
    if (frozen) return;
    updateAudit(audit.id, {
      yearBasis: basis,
      period: basis === 'fy' ? fyLabel(y) : cyLabel(y),
      periodSpan: spanOf(basis, y),
    });
  };

  const setScopeKind = (kind: AuditScopeKind) => {
    if (frozen || kind === audit.scopeKind) return;
    updateAudit(audit.id, { scopeKind: kind, scopeNames: [], scopeIds: [] });
  };

  const options = audit.scopeKind === 'entity'
    ? entities.map(e => ({ id: e.id, primary: e.name, secondary: e.type }))
    : racms.map(p => ({ id: p, primary: p, secondary: '' }));

  const pickedIds = audit.scopeKind === 'entity' ? audit.scopeIds : audit.scopeNames;
  const togglePick = (id: string) => {
    if (frozen) return;
    const next = pickedIds.includes(id) ? pickedIds.filter(x => x !== id) : [...pickedIds, id];
    const names = next.map(x => options.find(o => o.id === x)?.primary ?? x);
    updateAudit(audit.id, {
      scopeNames: names,
      scopeIds: audit.scopeKind === 'entity' ? next : [],
    });
  };

  const setMateriality = (patch: Partial<{ basis: MaterialityBasis; benchmark: number; pct: number }>) => {
    if (frozen) return;
    const basis = patch.basis ?? (basisOpt.id as MaterialityBasis);
    const opt = BASIS_OPTIONS.find(b => b.id === basis)!;
    const benchmark = patch.basis ? opt.defaultBenchmark : patch.benchmark ?? audit.materiality.benchmark;
    const pct = patch.basis ? opt.defaultPct : patch.pct ?? audit.materiality.pct;
    updateAudit(audit.id, {
      // Spread first: pmPct / ctPct are set on the creation wizard and not
      // edited here, so rebuilding the object from scratch would silently drop
      // them the first time the basis or benchmark is changed.
      materiality: { ...audit.materiality, basisLabel: opt.label, benchmark, pct },
      overall: ruleOverall({ id: 'a', name: 'a', basis, benchmark, pct }),
    });
  };

  /** Attach a trial balance or general ledger — and answer, in the same breath,
   *  where it came from. The question is put at the moment the file enters the
   *  audit because that is the only moment anyone reliably knows the answer. */
  const addFile = (kind: 'tb' | 'gl', name: string, origin: FileOrigin) => {
    if (frozen) return;
    updateAudit(audit.id, { files: [...audit.files, { name, kind }] });
    registerFile({
      name, kind: kind === 'tb' ? 'Trial balance' : 'General ledger',
      rows: kind === 'tb' ? 1240 : 18432, from: `${audit.period} audit`,
      uploadedBy: me, uploadedAt: 'just now', origin, originBy: me, originAt: 'just now',
    });
    logEvent({ action: 'Upload', description: `Attached "${name}" to ${audit.period} — ${origin.toLowerCase()}`, module: 'SOX ICFR', entity: 'Evidence' });
    addToast({ type: 'success', title: 'File attached', message: `${name} — ${origin.toLowerCase()}.` });
  };

  return (
    <div className="w-full space-y-4 pb-8">
      <p className="text-[12.5px] text-ink-500">
        {frozen
          ? <>This audit's own settings, as they stood when it closed. They were this audit's alone — the engagement's other audits keep theirs.</>
          : <>This audit's own settings. Edits save instantly and apply to this audit only — the engagement's other audits keep theirs.</>}
      </p>

      {/* ── why nothing below can be typed in ───────────────────────────────────
          Said once, at the top, rather than as a tooltip on each dead field: the
          reason is the same for all of them, and it is about the audit, not
          about the field you happened to reach for. Same shell as the archive
          banner in AuditArchiveView, because it is the same statement. */}
      {frozen && (
        <div className="rounded-lg border border-canvas-border bg-paper-50/60 px-4 py-3 flex items-start gap-2.5">
          <Lock size={14} className="text-ink-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-800">
              {audit.archive
                ? `Concluded ${audit.archive.concludedAt} — read-only`
                : `Signed off ${audit.signoff!.reviewer!.at} — read-only`}
            </p>
            <p className="text-[12px] text-ink-500 mt-0.5 leading-relaxed max-w-[46rem]">
              {audit.archive
                ? 'This cycle is closed and kept as the record of what was tested. Its settings are read back here, not re-set.'
                : 'Both signatures are on this audit. The period, scope, source files and materiality every control was tested against cannot move once the paper carrying them has been signed.'}
            </p>
          </div>
        </div>
      )}

      <Section icon={CalendarRange} title="Audit period" sub="An annual cycle, named by the year the group reports on.">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className={labelCls}>Year type</label>
            <div className="grid grid-cols-2 gap-1.5 w-[300px]">
              {([['fy', 'Financial year', 'Apr – Mar'], ['cy', 'Calendar year', 'Jan – Dec']] as const).map(([id, t, s]) => {
                const on = audit.yearBasis === id;
                const shell = cn('px-2 py-1.5 rounded-lg border text-[12px] font-bold',
                  on ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15' : 'border-canvas-border bg-white text-ink-500');
                const body = <>{t}<span className="block text-[10px] font-semibold opacity-70">{s}</span></>;
                return frozen ? (
                  <div key={id} className={shell}>{body}</div>
                ) : (
                  <button key={id} onClick={() => setPeriod(id, year)}
                    className={cn(shell, 'transition-all cursor-pointer', !on && 'hover:bg-brand-50/40')}>{body}</button>
                );
              })}
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className={labelCls}>Cycle</label>
            {/* Frozen reads the audit's own stored label rather than rebuilding
                one from the year, so a quarter or custom audit reads back the
                period it was actually created with. */}
            {frozen ? (
              <span className={readCls}>{audit.period}</span>
            ) : (
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
            )}
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
          {([['entity', 'By entity', Building2], ['racm', 'By RACM', Grid3x3]] as const).map(([id, t, Icon]) => {
            const on = audit.scopeKind === id;
            const shell = cn('px-2 py-1.5 rounded-lg border text-[12px] font-bold inline-flex items-center justify-center gap-1.5',
              on ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/15' : 'border-canvas-border bg-white text-ink-500');
            const body = <><Icon size={13} /> {t}</>;
            return frozen ? (
              <div key={id} className={shell}>{body}</div>
            ) : (
              <button key={id} onClick={() => setScopeKind(id)}
                className={cn(shell, 'transition-all cursor-pointer', !on && 'hover:bg-brand-50/40')}>{body}</button>
            );
          })}
        </div>

        <div className="border border-canvas-border rounded-xl overflow-hidden">
          {options.length === 0 ? (
            <p className="text-[11.5px] text-ink-400 px-4 py-5 text-center">
              {audit.scopeKind === 'entity' ? 'No entities on this engagement.' : 'No RACMs derived yet.'}
            </p>
          ) : options.map(o => {
            const on = pickedIds.includes(o.id);
            const shell = 'w-full flex items-center gap-3 px-4 py-2.5 border-b border-canvas-border last:border-b-0 text-left';
            const body = (
              <>
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  on ? 'bg-brand-600 border-brand-600 text-white' : 'border-canvas-border bg-white')}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="text-[13px] text-ink-900 flex-1 min-w-0 truncate">{o.primary}</span>
                {o.secondary && <span className="text-[11px] text-ink-400 shrink-0">{o.secondary}</span>}
              </>
            );
            // The whole list stays on screen when frozen, ticks and all: what was
            // left OUT of scope is as much a part of the record as what went in.
            return frozen ? (
              <div key={o.id} className={shell}>{body}</div>
            ) : (
              <button key={o.id} onClick={() => togglePick(o.id)}
                className={cn(shell, 'hover:bg-brand-50/40 transition-colors cursor-pointer')}>{body}</button>
            );
          })}
        </div>
        {pickedIds.length === 0 && (
          <p className="text-[11.5px] text-evidence-700 mt-2">
            Nothing selected — the RACM and Control Library fall back to showing everything.
          </p>
        )}
      </Section>

      <FileRegistrySection audit={audit} frozen={frozen} addFile={addFile} />

      <Section icon={Scale} title="Materiality rule" sub="The threshold this audit measures its exceptions against.">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="min-w-[240px]">
            <label className={labelCls}>Basis</label>
            {frozen ? (
              <span className={readCls}>{audit.materiality.basisLabel}</span>
            ) : (
              <FormSelect
                value={basisOpt.id}
                options={BASIS_OPTIONS.map(b => ({ value: b.id, label: b.label }))}
                onChange={v => setMateriality({ basis: v as MaterialityBasis })}
                className={selectCls}
                ariaLabel="Materiality basis"
                menuCls="w-full"
              />
            )}
          </div>
          <div className="w-40">
            <label className={labelCls}>{basisOpt.id === 'custom' ? 'Amount (₹ Cr)' : 'Benchmark (₹ Cr)'}</label>
            {frozen ? (
              <span className={`${readCls} tabular-nums`}>{audit.materiality.benchmark}</span>
            ) : (
              <input
                type="number" min={0} value={audit.materiality.benchmark}
                onChange={e => setMateriality({ benchmark: Number(e.target.value) })}
                className={`${inputCls} tabular-nums`}
              />
            )}
          </div>
          {basisOpt.id !== 'custom' && (
            <div className="w-24">
              <label className={labelCls}>%</label>
              {frozen ? (
                <span className={`${readCls} tabular-nums`}>{audit.materiality.pct}</span>
              ) : (
                <input
                  type="number" min={0.1} max={100} step={0.1} value={audit.materiality.pct}
                  onChange={e => setMateriality({ pct: Number(e.target.value) })}
                  className={`${inputCls} tabular-nums`}
                />
              )}
            </div>
          )}
          <p className="text-[11.5px] text-ink-500 pb-2.5">
            Overall <span className="font-semibold text-ink-900 tabular-nums">₹{audit.overall} Cr</span>
          </p>
        </div>
      </Section>

      {/* The engagement's ground rules, inline (user ask) — the Dashboard's
          Materiality card lands here now instead of opening a page of its own.
          Two materiality blocks sit together on purpose: the one above is THIS
          audit's own threshold, this one is the engagement's, and the banner
          inside says so. */}
      <MaterialityGroundRules sharedWith={otherAudits} />
    </div>
  );
}
