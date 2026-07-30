import { Fragment, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft, ArrowUpRight, BellRing, Building2, Check, CheckCircle2, ClipboardCheck,
  Download, Flag, Landmark, Layers, Lock, Mail, Scale, Send, TrendingDown, X,
} from 'lucide-react';
import TestBench, { type TestResult } from './TestBench';
import { useToast } from '../../../shared/Toast';
import { EngagementTabBar, type TabDef } from '../../EngagementTabBar';
import { fmtCr } from '../soxTestingData';
import { SourceChips } from '../ProgrammeView';
import { EntityStatusChip, ViaChip } from './V2Wizard';
import {
  CHASE_STAGES, SAMPLE_SIZES, V2_PHASES, deriveV2Racms, phaseWindows,
  registerV2Programme, v2EntityShort,
  type ChaseRow, type ChaseStage, type V2Control, type V2Phase, type V2Programme,
} from './v2Data';

/** Same tab structure as the classic SOX workspace — ids reuse TAB_META so the
 *  icon chips match (overview/scope/racm known; testing + auditor mapped). */
const V2_TABS: TabDef[] = [
  { id: 'overview', label: 'Overview & scope' },
  { id: 'racm', label: 'RACMs' },
  { id: 'attr-testing', label: 'Testing & evidence' },
  { id: 'review', label: 'Auditor' },
];

/** Same per-phase tinting convention as the classic Programmes tab. */
const PHASE_CLS: Record<V2Phase, string> = {
  Scoping: 'bg-brand-50 text-brand-700',
  'Design testing': 'bg-evidence-50 text-evidence-700',
  'Effectiveness & evidence': 'bg-evidence-50 text-evidence-700',
  Remediation: 'bg-mitigated-50 text-mitigated-700',
  'External audit': 'bg-mitigated-50 text-mitigated-700',
  'Year-end controls': 'bg-mitigated-50 text-mitigated-700',
  'Roll forward': 'bg-compliant-50 text-compliant-700',
};

interface Props {
  programme: V2Programme;
  onBack: () => void;
  /** Opens the classic SOX workspace on this programme's runtime engagement. */
  onOpenWorkspace?: () => void;
}

export default function V2ProgrammeView({ programme, onBack, onOpenWorkspace }: Props) {
  const { addToast } = useToast();
  // Local working copy — every mutation writes back to the module store so the
  // state survives navigation, same pattern as the classic tab.
  const [p, setP] = useState<V2Programme>(programme);
  const [tab, setTab] = useState('overview');
  const [rescopeOpen, setRescopeOpen] = useState(false);
  /** Chase-row id whose control is open on the test bench. */
  const [testId, setTestId] = useState<string | null>(null);

  const update = (next: V2Programme) => {
    setP(next);
    registerV2Programme(next);
  };

  const phases = phaseWindows(p.conv);
  const phaseIdx = V2_PHASES.indexOf(p.phase);
  const inEntities = p.entityScope.filter(d => d.status !== 'out');
  const pm = Math.round(p.materiality.overall * p.materiality.pmPct) / 100;

  // The auditor's structural lens — key financial controls only.
  const keyFinancial = p.controls.filter(c => c.key && c.clazz === 'Financial');

  const controlById = (id: string) => p.controls.find(c => c.id === id);
  const ownerFor = (area: string) => p.people.find(x => x.area === area);

  /* ── Evidence chasing — advance a row one stage, with the email story ── */
  const advance = (row: ChaseRow) => {
    const ctrl = controlById(row.controlId);
    if (!ctrl) return;
    const owner = ownerFor(ctrl.area);
    const idx = CHASE_STAGES.indexOf(row.stage);
    const nextStage = CHASE_STAGES[Math.min(idx + 1, CHASE_STAGES.length - 1)] as ChaseStage;
    const size = SAMPLE_SIZES[ctrl.frequency];
    const patch: Partial<ChaseRow> = { stage: nextStage };
    let toast = '';
    switch (nextStage) {
      case 'Population requested':
        toast = `Email sent to ${owner?.processOwner.split('—')[0].trim() ?? 'process owner'} — population request for “${ctrl.name}”`;
        break;
      case 'Population received':
        patch.popFile = `${ctrl.area.toLowerCase().replace(/[^a-z]+/g, '-')}-population.xlsx`;
        patch.popRows = 1200 + (row.id.length * 731) % 4200;
        toast = `Population received — ${patch.popRows!.toLocaleString('en-IN')} rows parsed`;
        break;
      case 'Sample selected':
        toast = `${size} sample${size === 1 ? '' : 's'} selected — ${ctrl.frequency.toLowerCase()} control${row.split ? ` (${row.split})` : ''}`;
        break;
      case 'Documents requested':
        toast = `Per-sample document requests emailed to ${owner?.processOwner.split('—')[0].trim() ?? 'process owner'}`;
        break;
      case 'Ready to test':
        patch.docsIn = size;
        toast = `All ${size} evidence pack${size === 1 ? '' : 's'} in — ready to test`;
        break;
      case 'Tested':
        toast = `“${ctrl.name}” tested — results recorded in the RACM`;
        break;
    }
    update({ ...p, chase: p.chase.map(c => c.id === row.id ? { ...c, ...patch } : c) });
    if (toast) addToast({ message: toast, type: 'success' });
  };

  const remind = (row: ChaseRow) => {
    const ctrl = controlById(row.controlId);
    const owner = ctrl ? ownerFor(ctrl.area) : undefined;
    update({ ...p, chase: p.chase.map(c => c.id === row.id ? { ...c, reminders: c.reminders + 1 } : c) });
    addToast({ message: `Reminder #${row.reminders + 1} emailed to ${owner?.processOwner.split('—')[0].trim() ?? 'process owner'}`, type: 'info' });
  };

  const download = (what: string) => {
    addToast({ message: `${what} downloaded — view-only copy for the external auditor`, type: 'info' });
  };

  /* ── Test bench conclusions write back to the register + chase ── */
  const applyTest = (row: ChaseRow, ctrl: V2Control, res: TestResult) => {
    const controls = p.controls.map(c => c.id === ctrl.id ? {
      ...c,
      tod: res.tod,
      toe: res.toe ?? (res.tod === 'Fail' ? '—' as const : c.toe),
      ...(res.effectiveDate ? {
        effectiveDate: res.effectiveDate,
        note: 'Remediated after TOE failure — the auditor samples the effective window only.',
      } : {}),
    } : c);
    const chase = p.chase.map(c => c.id === row.id ? { ...c, stage: (res.toe ? 'Tested' : c.stage) as ChaseStage } : c);
    update({ ...p, controls, chase });
    setTestId(null);
    addToast(
      res.tod === 'Fail'
        ? { message: `“${ctrl.name}” — design failed the 5W1H walkthrough; sent to remediation`, type: 'warning' }
        : res.toe === 'Fail'
        ? { message: `“${ctrl.name}” — TOE failed (${res.exceptions} exceptions in ${res.sampleSize}); remediation, effective from ${res.effectiveDate}`, type: 'warning' }
        : res.toe === 'Pass'
        ? { message: `“${ctrl.name}” — TOE effective (${res.exceptions ?? 0} exception${res.exceptions === 1 ? '' : 's'} in ${res.sampleSize})`, type: 'success' }
        : { message: `“${ctrl.name}” — design passed`, type: 'success' },
    );
  };

  const testRow = testId ? p.chase.find(c => c.id === testId) : undefined;
  const testCtrl = testRow ? controlById(testRow.controlId) : undefined;

  return (
    <div className="h-full overflow-y-auto bg-white bg-mesh-gradient relative">
      <div className="p-8 relative">
        {/* Breadcrumb — Process Hub trail pattern */}
        <div className="font-mono text-[0.75rem] tracking-tight flex items-center gap-1.5 min-w-0 mb-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to SOX Testing"
            className="text-ink-500 hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 rounded-sm"
          >
            <ArrowLeft size={12} />SOX Testing
          </button>
          <span className="text-ink-300">/</span>
          <span className="text-ink-700 truncate">{p.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[1.75rem] font-bold text-text leading-tight">{p.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-semibold ${PHASE_CLS[p.phase]}`}>{p.phase}</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[12px] text-text-secondary flex-wrap">
              <span className="inline-flex items-center gap-1.5 font-semibold text-text">
                <Flag size={12} className="text-brand-700" /> Opinion as of {p.asOf}
              </span>
              <span className="text-border">·</span>
              <span className="font-mono tracking-tight text-text-muted">{p.code}</span>
              <span className="text-border">·</span>
              <span>{inEntities.length} of {p.entities.length} entities in scope</span>
              <span className="text-border">·</span>
              <span className="tabular-nums">{p.coveragePct}% coverage</span>
              <span className="text-border">·</span>
              <span>{p.owner}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setRescopeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:border-primary/40 hover:text-primary text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
            >
              <Scale size={13} /> Re-scope now
            </button>
            {onOpenWorkspace && (
              <button
                onClick={onOpenWorkspace}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-white hover:border-primary/40 hover:text-primary text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                Open workspace <ArrowUpRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Same tab bar as the classic SOX workspace */}
        <EngagementTabBar tabs={V2_TABS} activeTab={tab} onSelect={setTab} storageKey={`sox-v2-${p.id}`} size="md" />

        {tab === 'overview' && (<>
        {/* ── Cycle — windows follow the year-end convention ── */}
        <div className="mb-8">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4">
            Audit cycle — {p.conv === 'dec' ? 'December' : 'March'} year-end calendar
          </div>
          {/* Fixed-length connectors — the stepper stays compact at its natural
              width instead of stretching across wide viewports. */}
          <div className="flex items-start px-2 overflow-x-auto pb-1">
            {phases.map((c, i) => {
              const done = i < phaseIdx;
              const active = i === phaseIdx;
              return (
                <Fragment key={c.phase}>
                  {i > 0 && <div className={`w-12 shrink-0 h-px mt-3 mx-2 ${i <= phaseIdx ? 'bg-brand-300' : 'bg-border-light'}`} />}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center ${
                      active ? 'bg-primary text-white shadow-sm shadow-brand-900/10'
                      : done ? 'bg-brand-100 text-brand-700'
                      : 'border border-border bg-white text-text-muted'
                    }`}>
                      {done ? <CheckCircle2 size={12} /> : c.phase === 'External audit' ? <Flag size={11} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </span>
                    <span className={`text-[11px] font-semibold whitespace-nowrap ${active ? 'text-primary' : done ? 'text-brand-700' : 'text-text-muted'}`}>
                      {c.phase}
                    </span>
                    <span className={`text-[10px] tabular-nums whitespace-nowrap -mt-1 ${active ? 'text-text-secondary font-semibold' : 'text-text-muted'}`}>
                      {c.window}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
          {p.revisions.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {p.revisions.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-evidence-50 text-evidence-700">
                  <TrendingDown size={10} /> {r.label}: {fmtCr(r.fromOverall)} → {fmtCr(r.toOverall)} · {r.addedCaptions} captions in{r.addedEntities.length > 0 ? ` · +${r.addedEntities.join(', +')}` : ''}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-text-muted mt-3 leading-relaxed max-w-3xl">
            No start and end date — the auditor opines on control effectiveness <span className="font-semibold text-text-secondary">as of {p.asOf}</span>.
            Remediation is a phase of its own: design failures fix within the testing window, effectiveness failures by {p.conv === 'dec' ? 'November' : 'February'}.
          </p>

          {/* Where it stands — summary numbers the other tabs hold in detail */}
          <div className="grid grid-cols-3 gap-3 mt-6 max-w-4xl">
            <div className="border border-border-light rounded-xl bg-white p-4">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Testing</div>
              {p.controls.length === 0 ? (
                <p className="text-[11.5px] text-text-muted leading-relaxed">Controls arrive with design testing — RACM shells are ready.</p>
              ) : (
                <>
                  <div className="text-[20px] font-bold tabular-nums text-text leading-tight">
                    {p.controls.filter(c => c.toe === 'Pass').length}<span className="text-[13px] font-semibold text-text-muted">/{p.controls.length} effective</span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    {p.controls.filter(c => c.toe === 'Pending').length} TOE pending · {p.controls.filter(c => c.toe === 'Fail').length} in remediation
                  </p>
                </>
              )}
            </div>
            <div className="border border-border-light rounded-xl bg-white p-4">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Evidence chase</div>
              {p.chase.length === 0 ? (
                <p className="text-[11.5px] text-text-muted leading-relaxed">Opens with effectiveness testing — requests go to the process owners.</p>
              ) : (
                <>
                  <div className="text-[20px] font-bold tabular-nums text-text leading-tight">
                    {p.chase.filter(c => c.stage === 'Tested').length}<span className="text-[13px] font-semibold text-text-muted">/{p.chase.length} complete</span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    {p.chase.filter(c => c.stage === 'Population requested' || c.stage === 'Documents requested').length} waiting on process owners
                  </p>
                </>
              )}
            </div>
            <div className="border border-border-light rounded-xl bg-white p-4">
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">Coming up</div>
              {phaseIdx < phases.length - 1 ? (
                <>
                  <div className="text-[15px] font-bold text-text leading-tight">{phases[phaseIdx + 1].phase}</div>
                  <p className="text-[11px] text-text-muted mt-1">{phases[phaseIdx + 1].window} — after {p.phase.toLowerCase()}</p>
                </>
              ) : (
                <p className="text-[11.5px] text-text-muted leading-relaxed">Cycle complete — roll forward into the next year.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Scope — one surface, three columns ── */}
        {/* Row-style stats need a readable measure — the card spans the full
            container, but each column's content is bounded so label and value
            never tear apart on wide screens. */}
        <div className="border border-border-light rounded-xl bg-white grid grid-cols-3 divide-x divide-border-light mb-8 items-stretch">
          <div className="p-4 max-w-[24rem]">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Materiality</div>
            <SummaryRow label="Overall" value={fmtCr(p.materiality.overall)} note={p.materiality.basis === 'custom' ? 'Set directly' : `${p.materiality.pct}% of ${p.materiality.benchmarkLabel.toLowerCase()}`} />
            <SummaryRow label="Performance" value={fmtCr(pm)} strong note={`${p.materiality.pmPct}% — the scoping threshold`} />
            <SummaryRow label="Clearly trivial" value={fmtCr(p.materiality.overall * p.materiality.cttPct / 100)} note={`${p.materiality.cttPct}% of overall`} last />
            {p.revisions.length > 0 && (
              <p className="text-[10.5px] text-evidence-700 mt-2">Revised mid-year — was {fmtCr(p.revisions[p.revisions.length - 1].fromOverall)}.</p>
            )}
          </div>
          <div className="p-4 max-w-[28rem]">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Entity scope — derived</div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {p.entityScope
                .slice()
                .sort((a, b) => Number(a.status === 'out') - Number(b.status === 'out'))
                .map(d => {
                  const e = p.entities.find(x => x.id === d.entityId);
                  if (!e) return null;
                  return (
                    <div key={d.entityId} className="flex items-center gap-1.5 min-w-0">
                      {e.type === 'Holding'
                        ? <Landmark size={11} className="text-brand-700 shrink-0" />
                        : <Building2 size={11} className="text-text-muted shrink-0" />}
                      <span className={`text-[11.5px] truncate flex-1 ${d.status === 'out' ? 'text-text-muted' : 'text-text-secondary'}`}>{e.name.replace(' Pvt Ltd', '')}</span>
                      <EntityStatusChip status={d.status} small />
                    </div>
                  );
                })}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-border-light">
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${p.coveragePct >= p.coverageTargetPct ? 'bg-compliant' : 'bg-risk-500'}`} style={{ width: `${Math.min(p.coveragePct, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1 text-[10.5px] text-text-muted tabular-nums">
                <span>{p.coveragePct}% coverage</span>
                <span>target {p.coverageTargetPct}%</span>
              </div>
            </div>
          </div>
          <div className="p-4 max-w-[24rem]">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2.5">Scope funnel</div>
            <SummaryRow label="TB captions parsed" value={String(p.captions.length)} />
            <SummaryRow label="Entities in scope" value={`${inEntities.length} / ${p.entities.length}`} />
            <SummaryRow label="Process RACMs" value={String(p.racms.filter(r => r.kind === 'process').length)} />
            <SummaryRow label="Workstream RACMs" value={String(p.racms.filter(r => r.kind === 'workstream').length)} last />
          </div>
        </div>
        </>)}

        {/* ── RACMs ── */}
        {tab === 'racm' && (<>
        <div className="flex items-center gap-1.5 mb-2.5">
          <Layers size={14} className="text-brand-700" />
          <h3 className="text-[14px] font-bold text-text">RACMs — processes and workstreams</h3>
          <span className="text-[11.5px] text-text-muted">derived from scoping; ITGC scoped by system</span>
        </div>
        <div className="grid grid-cols-3 2xl:grid-cols-4 gap-3 mb-8">
          {p.racms.map(r => {
            const owner = ownerFor(r.area);
            const areaControls = p.controls.filter(c => c.area === r.area);
            const tested = areaControls.filter(c => c.toe === 'Pass' || c.toe === 'Fail').length;
            const effective = areaControls.filter(c => c.toe === 'Pass').length;
            return (
              <div
                key={r.area}
                {...(onOpenWorkspace ? {
                  role: 'button' as const, tabIndex: 0,
                  onClick: onOpenWorkspace,
                  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onOpenWorkspace(); },
                  title: `Open the ${r.area} RACM in the workspace`,
                } : {})}
                className={`border border-border-light rounded-xl bg-white p-4 transition-colors ${onOpenWorkspace ? 'hover:border-primary/40 cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13.5px] font-semibold text-text">
                    {r.area}
                    {r.kind === 'workstream' && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-1.5 h-4 rounded inline-flex items-center ml-1.5 align-middle">WS</span>
                    )}
                  </div>
                  {areaControls.length > 0 ? (
                    <span className="text-[11px] tabular-nums text-text-secondary shrink-0">
                      <span className="font-semibold text-text">{effective}</span>/{areaControls.length} effective
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-brand-50 text-brand-700 shrink-0">
                      RACM shell — ready to build
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-text-muted mt-0.5 mb-2.5 truncate">
                  {r.systems ? r.systems.join(' · ') : r.entities.join(' · ')}
                </div>
                {tested > 0 && (
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden mb-2.5">
                    <div className="h-full bg-compliant rounded-full" style={{ width: `${Math.round((effective / areaControls.length) * 100)}%` }} />
                  </div>
                )}
                {r.sources.length > 0 && (
                  <div className="mb-2.5">
                    <SourceChips sources={r.sources.map(s => ({ caption: s.caption, qualitative: s.via === 'qual' }))} max={3} />
                  </div>
                )}
                <div className="pt-2 border-t border-border-light space-y-0.5">
                  <div className="text-[10.5px] text-text-muted truncate"><span className="text-text-secondary font-semibold">PO</span> {owner?.processOwner.split('—')[0].trim() ?? '—'}</div>
                  <div className="text-[10.5px] text-text-muted truncate"><span className="text-text-secondary font-semibold">CO</span> {owner?.controlOwner.split('—')[0].trim() ?? '—'}</div>
                </div>
              </div>
            );
          })}
        </div>
        </>)}

        {/* ── Testing & evidence — controls, remediation, chasing ── */}
        {tab === 'attr-testing' && (<>
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          <h3 className="text-[14px] font-bold text-text">Controls</h3>
          <span className="text-[11.5px] text-text-muted">every control carries a class and key flag — the Auditor tab shows the filtered set</span>
        </div>
        {p.controls.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-8 text-center mb-8">
            <p className="text-[12.5px] text-text-secondary">RACM shells are ready — controls are drafted during design testing.</p>
          </div>
        ) : (
          <ControlsTable rows={p.controls} />
        )}

        {/* Remediation & effective window */}
        {p.controls.some(c => c.toe === 'Fail') && (
          <div className="border border-border-light rounded-xl bg-white p-4 mb-8">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Remediation — control effective dates</div>
            {p.controls.filter(c => c.toe === 'Fail').map(c => (
              <div key={c.id} className="flex items-center gap-3 py-1.5 flex-wrap">
                <span className="text-[12.5px] text-text">{c.name}</span>
                <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-risk-50 text-risk-700">TOE failed</span>
                <span className="text-[11.5px] text-text-secondary">
                  remediated — effective from <span className="font-semibold tabular-nums">{c.effectiveDate}</span>; the auditor samples the effective window only
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Evidence chasing ── */}
        <div className="flex items-center gap-1.5 mb-1">
          <Mail size={14} className="text-brand-700" />
          <h3 className="text-[14px] font-bold text-text">Evidence chasing</h3>
        </div>
        <p className="text-[11.5px] text-text-muted mb-3 max-w-3xl leading-relaxed">
          “90% of the team's time is spent chasing, 10% testing.” The tool runs the chase: it emails
          the process owner for the population, samples by frequency, requests documents per sample
          and sends the reminders — testing starts when the packs are in.
        </p>
        {p.chase.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-8 text-center mb-8">
            <p className="text-[12.5px] text-text-secondary">Chasing opens with effectiveness testing — population requests go out per control, addressed to the process owners captured at scoping.</p>
          </div>
        ) : (
          <div className="border border-border-light rounded-xl bg-white overflow-hidden mb-8">
            <div className="grid grid-cols-[2fr_1.1fr_0.9fr_1.6fr_0.7fr_1.5fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
              <div>Control</div><div>Process owner</div><div>Sample rule</div><div>Progress</div><div>Docs</div><div className="text-right">Next</div>
            </div>
            {p.chase.map(row => {
              const ctrl = controlById(row.controlId);
              if (!ctrl) return null;
              const owner = ownerFor(ctrl.area);
              const stageIdx = CHASE_STAGES.indexOf(row.stage);
              const size = SAMPLE_SIZES[ctrl.frequency];
              const nextLabel =
                row.stage === 'Not started' ? 'Request population'
                : row.stage === 'Population requested' ? 'Mark received'
                : row.stage === 'Population received' ? 'Select sample'
                : row.stage === 'Sample selected' ? 'Request documents'
                : row.stage === 'Documents requested' ? 'All docs in'
                : null;
              return (
                <div key={row.id} className="grid grid-cols-[2fr_1.1fr_0.9fr_1.6fr_0.7fr_1.5fr] gap-3 px-4 py-3 items-center border-b border-border-light last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-text truncate">{ctrl.name}</div>
                    <div className="text-[10.5px] text-text-muted truncate">
                      {ctrl.area}{row.popFile ? <> · <span className="font-mono">{row.popFile}</span>{row.popRows ? ` (${row.popRows.toLocaleString('en-IN')} rows)` : ''}</> : null}
                    </div>
                  </div>
                  <div className="text-[11.5px] text-text-secondary truncate">{owner?.processOwner.split('—')[0].trim() ?? '—'}</div>
                  <div className="text-[11px] text-text-muted">
                    {ctrl.frequency} → {size}{row.split ? <span className="block text-[10px]">{row.split}</span> : null}
                  </div>
                  <div>
                    <div className="flex items-center gap-1" title={row.stage}>
                      {CHASE_STAGES.slice(1).map((s, i) => (
                        <span key={s} className={`h-1.5 flex-1 rounded-full ${i < stageIdx ? 'bg-compliant' : i === stageIdx && row.stage !== 'Tested' ? 'bg-brand-400' : row.stage === 'Tested' ? 'bg-compliant' : 'bg-surface-3'}`} />
                      ))}
                    </div>
                    <div className="text-[10.5px] text-text-muted mt-1">{row.stage}{row.reminders > 0 ? ` · ${row.reminders} reminder${row.reminders === 1 ? '' : 's'}` : ''}</div>
                  </div>
                  <div className="text-[11.5px] tabular-nums text-text-secondary">
                    {row.stage === 'Documents requested' || row.stage === 'Ready to test' || row.stage === 'Tested' ? `${row.docsIn}/${size}` : '—'}
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {(row.stage === 'Population requested' || row.stage === 'Documents requested') && (
                      <button
                        onClick={() => remind(row)}
                        title="Send a reminder email"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold text-text-secondary border border-border bg-white hover:text-primary hover:border-primary/30 transition-colors cursor-pointer"
                      >
                        <BellRing size={11} /> Remind
                      </button>
                    )}
                    {row.stage === 'Ready to test' ? (
                      <button
                        onClick={() => setTestId(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer"
                      >
                        <ClipboardCheck size={11} /> Open test
                      </button>
                    ) : nextLabel ? (
                      <button
                        onClick={() => advance(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-semibold bg-primary hover:bg-primary-hover text-white transition-colors cursor-pointer"
                      >
                        <Send size={11} /> {nextLabel}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-compliant-700"><Check size={11} /> Done</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>)}

        {/* ── Auditor — the structural key-financial lens ── */}
        {tab === 'review' && (<>
        <div className="border border-border-light rounded-xl bg-white p-4 mb-5">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock size={13} className="text-text-muted" />
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">External auditor — view &amp; download only</span>
          </div>
          <p className="text-[11.5px] text-text-muted mb-3 max-w-3xl leading-relaxed">
            The auditor's working papers live in their own system — here they can see and take the
            key-financial set, nothing else. Management testing stays management's.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {['RACM (key financial)', 'TOD results', 'TOE results'].map(w => (
              <button
                key={w}
                onClick={() => download(w)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-white hover:border-primary/30 hover:text-primary text-[11.5px] font-semibold text-text-secondary transition-colors cursor-pointer"
              >
                <Download size={12} /> {w}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          <h3 className="text-[14px] font-bold text-text">What the auditor sees</h3>
          {p.controls.length > 0 && (
            <span className="text-[11.5px] text-text-muted">
              {keyFinancial.length} of {p.controls.length} controls — operational, compliance and non-key stay internal
            </span>
          )}
        </div>
        {keyFinancial.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl bg-white/60 px-6 py-8 text-center mb-8">
            <p className="text-[12.5px] text-text-secondary">Nothing to hand over yet — key financial controls appear here once design testing drafts them.</p>
          </div>
        ) : (
          <ControlsTable rows={keyFinancial} />
        )}
        </>)}
      </div>

      {rescopeOpen && (
        <RescopeModal
          programme={p}
          onClose={() => setRescopeOpen(false)}
          onApply={next => { update(next); setRescopeOpen(false); addToast({ message: 'Materiality revised — scope re-derived', type: 'success' }); }}
        />
      )}

      {testRow && testCtrl && (
        <TestBench
          control={testCtrl}
          chase={testRow}
          owner={ownerFor(testCtrl.area)}
          defaultEffective={`1 Nov ${(/\d{4}/.exec(p.asOf)?.[0]) ?? '2026'}`}
          onClose={() => setTestId(null)}
          onConclude={res => applyTest(testRow, testCtrl, res)}
        />
      )}
    </div>
  );
}

/* ── Mid-year re-scope — the partner's Q4 round ─────────────────────────── */

function RescopeModal({ programme: p, onClose, onApply }: {
  programme: V2Programme;
  onClose: () => void;
  onApply: (next: V2Programme) => void;
}) {
  const [benchmark, setBenchmark] = useState(Math.round(p.materiality.benchmark * 0.7));
  const oldOverall = p.materiality.overall;
  const oldPm = Math.round(oldOverall * p.materiality.pmPct) / 100;
  const newOverall = p.materiality.basis === 'custom' ? benchmark : Math.round(benchmark * p.materiality.pct * 100) / 10000;
  const newPm = Math.round(newOverall * p.materiality.pmPct) / 100;

  // Captions that clear the NEW threshold but not the old one — and are not
  // already in scope via coverage or judgement.
  const alreadyIn = useMemo(() => {
    const ids = new Set<string>();
    for (const r of p.racms) for (const s of r.sources) ids.add(`${s.caption}|${s.entity}`);
    return ids;
  }, [p.racms]);
  const newlyIn = useMemo(
    () => p.captions.filter(c =>
      c.balance >= newPm && c.balance < oldPm &&
      !alreadyIn.has(`${c.caption}|${v2EntityShort(c.entityId, p.entities)}`)),
    [p.captions, newPm, oldPm, alreadyIn],
  );
  const newEntities = useMemo(() => {
    const inIds = new Set(p.entityScope.filter(d => d.status !== 'out').map(d => d.entityId));
    return [...new Set(newlyIn.map(c => c.entityId).filter(id => !inIds.has(id)))];
  }, [newlyIn, p.entityScope]);

  const apply = () => {
    const additions = newlyIn.map(c => ({ caption: c, via: 'revision' as const }));
    // Merge the additions into the existing RACM set (new processes get new RACMs).
    const merged = deriveV2Racms(additions, p.entities);
    const racms = p.racms.map(r => ({ ...r }));
    for (const add of merged) {
      const existing = racms.find(r => r.area === add.area && r.kind === 'process');
      if (existing) {
        existing.sources = [...existing.sources, ...add.sources];
        for (const e of add.entities) if (!existing.entities.includes(e)) existing.entities.push(e);
      } else {
        racms.push(add);
      }
    }
    const entityScope = p.entityScope.map(d =>
      newEntities.includes(d.entityId)
        ? { ...d, status: 'revision' as const, reason: 'Scoped in by the mid-year materiality revision' }
        : d);
    const coveragePct = Math.round(
      p.entities.filter(e => entityScope.find(d => d.entityId === e.id && d.status !== 'out')).reduce((s, e) => s + e.sharePct, 0));
    onApply({
      ...p,
      materiality: { ...p.materiality, benchmark, overall: newOverall },
      revisions: [...p.revisions, {
        label: 'Mid-year revision',
        fromOverall: oldOverall,
        toOverall: newOverall,
        addedCaptions: newlyIn.length,
        addedEntities: newEntities.map(id => v2EntityShort(id, p.entities)),
      }],
      entityScope,
      coveragePct,
      racms,
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18 }}
          role="dialog" aria-modal="true" aria-label="Re-scope"
          className="pointer-events-auto relative w-[640px] max-w-full bg-canvas rounded-[1.25rem] border border-border-light shadow-[0_24px_64px_-16px_rgba(15,8,30,0.28)] p-6"
        >
          <button onClick={onClose} aria-label="Close" className="absolute top-3.5 right-3.5 p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer">
            <X size={16} />
          </button>
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Mid-year re-scope</div>
          <h3 className="text-[17px] font-bold text-text mb-1">Results shifted — revise materiality</h3>
          <p className="text-[12px] text-text-secondary mb-4 leading-relaxed">
            Profits fall, materiality falls with them — and areas that weren't material in April are
            material now. A re-scope round at the start of Q4 is standard practice.
          </p>
          <div className="grid grid-cols-2 gap-4 items-start mb-4">
            <div>
              <div className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider mb-1.5">{p.materiality.benchmarkLabel} (₹ Cr) — revised</div>
              <input
                type="number" min={0} value={benchmark}
                onChange={e => setBenchmark(Number(e.target.value))}
                className="w-36 px-3 py-2 text-[13px] tabular-nums border border-border rounded-lg bg-white text-text outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
              <p className="text-[11px] text-text-muted mt-1.5">Was {fmtCr(p.materiality.benchmark)} at scoping.</p>
            </div>
            <div className="border border-border-light rounded-xl bg-white p-3.5">
              <div className="flex items-baseline justify-between py-1 border-b border-border-light">
                <span className="text-[12px] text-text-secondary">Overall</span>
                <span className="font-mono tabular-nums text-[12.5px] text-text">{fmtCr(oldOverall)} → <span className="font-bold">{fmtCr(newOverall)}</span></span>
              </div>
              <div className="flex items-baseline justify-between py-1">
                <span className="text-[12px] text-text-secondary">Performance</span>
                <span className="font-mono tabular-nums text-[12.5px] text-text">{fmtCr(oldPm)} → <span className="font-bold">{fmtCr(newPm)}</span></span>
              </div>
            </div>
          </div>
          <div className="border border-border-light rounded-xl bg-white overflow-hidden mb-4">
            <div className="px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
              Newly in scope at {fmtCr(newPm)} — {newlyIn.length} caption{newlyIn.length === 1 ? '' : 's'}
            </div>
            <div className="max-h-[180px] overflow-y-auto">
              {newlyIn.length === 0 && (
                <p className="px-4 py-4 text-[12px] text-text-muted">Nothing new crosses the revised threshold.</p>
              )}
              {newlyIn.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2 border-b border-border-light last:border-b-0">
                  <span className="text-[12.5px] text-text flex-1 truncate">{c.caption}</span>
                  <span className="text-[11.5px] text-text-muted">{v2EntityShort(c.entityId, p.entities)}</span>
                  <span className="text-[12px] font-mono tabular-nums text-text-secondary">{fmtCr(c.balance)}</span>
                  <ViaChip via="revision" />
                </div>
              ))}
            </div>
            {newEntities.length > 0 && (
              <p className="px-4 py-2 text-[11px] text-evidence-700 border-t border-border-light">
                Pulls {newEntities.map(id => v2EntityShort(id, p.entities)).join(', ')} into scope.
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-3.5 py-2 rounded-lg border border-border bg-white hover:bg-surface-2 text-[12.5px] font-semibold text-text-secondary transition-colors cursor-pointer">
              Cancel
            </button>
            <button
              onClick={apply}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Check size={13} /> Apply revision
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Controls table — used by Testing & evidence (all controls) and the Auditor
 *  tab (key financial only), so both render identically. */
function ControlsTable({ rows }: { rows: V2Control[] }) {
  return (
    <div className="border border-border-light rounded-xl bg-white overflow-hidden mb-8">
      <div className="grid grid-cols-[2.2fr_1fr_0.8fr_0.55fr_0.6fr_0.6fr_1fr] gap-3 px-4 py-2 text-[10.5px] uppercase tracking-wider font-semibold text-text-muted/80 border-b border-border-light bg-surface-2/50">
        <div>Control</div><div>RACM</div><div>Class</div><div>Key</div><div>TOD</div><div>TOE</div><div>Effective from</div>
      </div>
      {rows.map(c => (
        <div key={c.id} className="grid grid-cols-[2.2fr_1fr_0.8fr_0.55fr_0.6fr_0.6fr_1fr] gap-3 px-4 py-2.5 items-center border-b border-border-light last:border-b-0">
          <div className="min-w-0">
            <div className="text-[12.5px] text-text truncate">{c.name}</div>
            {c.note && <div className="text-[10.5px] text-text-muted truncate">{c.note}</div>}
          </div>
          <div className="text-[11.5px] text-text-muted">{c.area}</div>
          <div><ClassChip clazz={c.clazz} /></div>
          <div>{c.key
            ? <span className="inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wide bg-brand-50 text-brand-700">Key</span>
            : <span className="text-[10.5px] text-text-muted">Non-key</span>}
          </div>
          <div><ResultChip r={c.tod} /></div>
          <div><ResultChip r={c.toe} /></div>
          <div className="text-[11px] tabular-nums text-text-secondary">{c.effectiveDate ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

function ClassChip({ clazz }: { clazz: V2Control['clazz'] }) {
  const cls =
    clazz === 'Financial' ? 'bg-brand-50 text-brand-700'
    : clazz === 'Operational' ? 'bg-mitigated-50 text-mitigated-700'
    : 'bg-evidence-50 text-evidence-700';
  return <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${cls}`}>{clazz}</span>;
}

function ResultChip({ r }: { r: V2Control['tod'] | V2Control['toe'] }) {
  if (r === '—') return <span className="text-[11px] text-text-muted">—</span>;
  const cls =
    r === 'Pass' ? 'bg-compliant-50 text-compliant-700'
    : r === 'Fail' ? 'bg-risk-50 text-risk-700'
    : 'bg-surface-2 text-text-muted';
  return <span className={`inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${cls}`}>{r}</span>;
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
