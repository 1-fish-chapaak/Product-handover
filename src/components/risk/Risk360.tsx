/**
 * Risk 360 — one risk, end to end: the rating and what it sets in motion, why
 * the score is what it is (line by line), how it moved, the Control Library
 * controls that mitigate it and how well each is evidenced, the indicators
 * that watch it, what the rating would be if the flags were fixed, and the
 * treatment with its action plan.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, Check, CircleCheck, CircleDashed, CircleSlash, Clock3, FileSearch, Link2, PenLine, Plus, X,
} from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { PROCESS_LONG, type FileSourceChoice } from '../../data/auditPlan';
import type { ProcessCode } from '../../data/engagements';
import { APPETITE, MONTHS, NOW, TIER_ACTION, fmtKri, ragOf, type Kri, type Treatment } from '../../data/erm/model';
import { OVERRIDE_TIP, scoreRisk, type KriLine, type RiskRating, type ScoreContext } from '../../data/erm/score';
import { controlEffect, type ControlStatus } from '../../data/erm/controls';
import { addAction, addKri, linkControl, toggleAction, updateRisk } from '../../data/erm/store';
import AdaptDataModal from '../audit-plan/AdaptDataModal';
import { Delta, Kpi, Panel, RagChip, RagStrip, ScoreChart, TierChip } from './riskUi';
import KriDrawer from './KriDrawer';
import RiskEditorDrawer from './RiskEditorDrawer';
import AssessmentModal from './AssessmentModal';
import LinkControlDrawer from './LinkControlDrawer';
import ControlAccordion from './ControlAccordion';
import type { RiskNav } from './RiskRegisterPage';

const L_LABEL = ['rare', 'unlikely', 'possible', 'likely', 'almost certain'];
const I_LABEL = ['minor', 'moderate', 'significant', 'major', 'severe'];

const STATUS_META: Record<ControlStatus, { label: string; icon: typeof CircleCheck; cls: string }> = {
  live: { label: 'Live', icon: CircleCheck, cls: 'text-compliant-700' },
  'awaiting-review': { label: 'Awaiting review', icon: Clock3, cls: 'text-evidence-700' },
  'needs-data': { label: 'Needs data', icon: CircleDashed, cls: 'text-mitigated-700' },
  manual: { label: 'Manual test', icon: FileSearch, cls: 'text-ink-500' },
  'no-workflow': { label: 'No workflow', icon: CircleSlash, cls: 'text-high-700' },
  draft: { label: 'Draft', icon: PenLine, cls: 'text-ink-400' },
};

export default function Risk360({ rating: rt, ctx, nav, onBack, onAdapt }: {
  rating: RiskRating; ctx: ScoreContext; nav: RiskNav; onBack: () => void;
  onAdapt?: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
}) {
  const r = rt.risk;
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { currentUser } = useCurrentUser();
  const me = currentUser?.name ?? 'You';
  const [kriOpen, setKriOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);
  const [fixKris, setFixKris] = useState<Set<string>>(new Set());
  const [fixControls, setFixControls] = useState<Set<string>>(new Set());
  const [addingKri, setAddingKri] = useState(false);
  const [addingAction, setAddingAction] = useState(false);

  const reds = rt.kris.filter(k => k.rag === 2);
  const ambers = rt.kris.filter(k => k.rag === 1);
  const waiting = rt.controls.filter(c => c.effect?.status === 'needs-data');
  const sim = useMemo(
    () => (fixKris.size || fixControls.size ? scoreRisk(r, ctx, NOW, { fixKris, fixControls }) : null),
    [r, ctx, fixKris, fixControls],
  );
  const proc = PROCESS_LONG[r.businessProcess as ProcessCode] ?? r.businessProcess;
  const appetite = APPETITE[r.category];

  // Suggested controls: same process, not yet linked, best design weight first.
  const suggestions = useMemo(() => [...ctx.index.values()]
    .filter(c => c.businessProcess === r.businessProcess && !r.controlIds.includes(c.controlId) && c.status !== 'Archived')
    .map(c => ({ c, e: controlEffect(c, ctx.std) }))
    .sort((a, b) => (b.c.subProcess === r.subProcess ? 1 : 0) - (a.c.subProcess === r.subProcess ? 1 : 0) || b.e.weight * b.e.effectiveness - a.e.weight * a.e.effectiveness)
    .slice(0, 3), [ctx, r]);

  // Waterfall: inherent, then each control, indicator and event.
  const lines = [
    { label: `Inherent exposure — L${r.likelihood} × I${r.impact}`, pts: rt.inherent, tone: 'base' as const },
    ...rt.controls.filter(c => c.points > 0.05).map(c => ({ label: c.row?.name ?? c.id, pts: -c.points, tone: 'control' as const })),
    ...rt.kris.filter(k => k.points > 0).map(k => ({ label: `${k.kri.name}${k.repeat ? ' (3 months red)' : ''}`, pts: k.points, tone: k.rag === 2 ? 'red' as const : 'amber' as const })),
    ...rt.events.map(e => ({ label: e.text, pts: e.points, tone: 'event' as const })),
  ];
  const maxPts = Math.max(...lines.map(l => Math.abs(l.pts)), 1);

  // What we picked up — events, indicators turning red, controls going live, assessments.
  const timeline = [
    ...r.events.map(e => ({ m: e.m, text: e.text, tone: 'event' })),
    ...r.kris.flatMap(k => k.values.map((v, i) => ({ i, red: ragOf(k, v) === 2, was: i > 0 && ragOf(k, k.values[i - 1]) === 2 }))
      .filter(x => x.red && !x.was && x.i > 0).map(x => ({ m: x.i, text: `${k.name} turned red`, tone: 'red' }))),
    ...Object.entries(r.controlSince ?? {}).map(([cid, m]) => ({ m, text: `${ctx.index.get(cid)?.name ?? cid} went live`, tone: 'control' })),
  ].sort((a, b) => b.m - a.m);

  const why = [
    <>Inherent exposure is <b>{rt.inherent}</b> — {L_LABEL[r.likelihood - 1]} (likelihood {r.likelihood}) and {I_LABEL[r.impact - 1]} (impact {r.impact}).</>,
    rt.controls.length
      ? <>{rt.controls.length} control{rt.controls.length === 1 ? '' : 's'} take <b>{rt.mitigation.toFixed(1)}</b> off; {rt.effectiveControls} operate{rt.effectiveControls === 1 ? 's' : ''} effectively{waiting.length ? `, ${waiting.length} wait${waiting.length === 1 ? 's' : ''} for your data` : ''}.</>
      : <>No control mitigates it — the full exposure stands.</>,
    reds.length + ambers.length
      ? <>{reds.length} indicator{reds.length === 1 ? ' is' : 's are'} red and {ambers.length} amber, adding <b>{rt.kriPoints.toFixed(1)}</b>{rt.eventPoints ? <> — and recent events add <b>{rt.eventPoints.toFixed(1)}</b></> : null}.</>
      : <>Every indicator is green{rt.eventPoints ? <>; recent events add <b>{rt.eventPoints.toFixed(1)}</b></> : null}.</>,
    <>That makes a residual score of <b>{rt.score.toFixed(1)}</b>, which on its own is <b>{rt.scoreTier}</b>{rt.tier !== rt.scoreTier ? <> — held at <b>{rt.tier}</b> by {rt.overrides.filter(o => o !== 'Score jump').join(' and ').toLowerCase()}</> : null}.</>,
    rt.outsideAppetite
      ? <>It is <b>outside appetite</b>: {r.category} risk is held to a {appetite.level.toLowerCase()} appetite of {appetite.max}.</>
      : <>It sits within the {appetite.level.toLowerCase()} appetite of {appetite.max} set for {r.category} risk.</>,
    <><b>{rt.tier}</b> sets the action: {lowerFirst(TIER_ACTION[rt.tier])}.</>,
    ...(rt.score > rt.inherent ? [<>Its indicators push it <b>above its inherent exposure</b> — the likelihood and impact may be out of date. Record a new assessment.</>] : []),
  ];

  const setTreatment = (t: Treatment) => {
    updateRisk(r.id, { treatment: t });
    logEvent({ action: 'Update', description: `Set treatment of ${r.id} to ${t}`, module: 'Risk Register', entity: 'Risk' });
  };

  const kriFor = (k: KriLine) => k.kri;
  const openKri = kriOpen ? r.kris.find(k => k.id === kriOpen) : undefined;

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="max-w-[96rem] mx-auto px-8 pt-6 pb-24 space-y-5">
        {/* Header */}
        <div>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-ink-500">
            <button onClick={onBack} className="inline-flex items-center gap-1 text-brand-700 hover:underline cursor-pointer"><ArrowLeft size={12} /> Risk Register</button>
            <span aria-hidden>/</span>
            <button onClick={() => nav.showList({ process: r.businessProcess })} className="hover:text-brand-700 cursor-pointer">{proc}</button>
            <span aria-hidden>/</span>
            <button onClick={() => nav.showList({ process: r.businessProcess, subProcess: r.subProcess })} className="hover:text-brand-700 cursor-pointer">{r.subProcess}</button>
            <span aria-hidden>/</span>
            <span className="font-mono text-ink-700">{r.id}</span>
          </nav>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-3 text-[1.75rem] font-semibold tracking-tight text-ink-900 leading-tight">
                {r.name} <TierChip tier={rt.tier} size="lg" />
                {rt.outsideAppetite && <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-risk-50 text-risk-700 text-[0.75rem] font-semibold">Outside appetite</span>}
              </h1>
              <p className="mt-1.5 text-[0.8125rem] text-ink-500">
                {r.description}
              </p>
              <p className="mt-1 text-[0.75rem] text-ink-500">
                {r.category} · owner <span className="text-ink-800">{r.owner}</span> · reviewer <span className="text-ink-800">{r.reviewer}</span> · treatment <span className="text-ink-800">{r.treatment}</span> · last assessed {r.lastReviewed}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="primary" onClick={() => setAssessing(true)}>Record assessment</Button>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi label="Rating" value={<TierChip tier={rt.tier} size="lg" />} sub={rt.tier !== rt.scoreTier ? `Held by override — score alone gives ${rt.scoreTier}` : 'From the score'} />
          <Kpi label="Residual score" value={<>{rt.score.toFixed(1)} <Delta d={rt.delta} /></>} sub={`Out of 100 · ${MONTHS[NOW - 1]} was ${rt.history[NOW - 1].toFixed(1)}`} />
          <Kpi label="Action" value={<span className="block text-[0.9375rem] font-sans font-semibold leading-snug text-brand-700">{TIER_ACTION[rt.tier]}</span>} />
          <Kpi label="Inherent" value={rt.inherent} sub={`Likelihood ${r.likelihood} × impact ${r.impact} × 4`} />
          <Kpi label="Controls effective" value={<>{rt.effectiveControls}<span className="text-[0.875rem] text-ink-400"> of {rt.controls.length}</span></>} sub={waiting.length ? `${waiting.length} waiting for your data` : rt.controls.length ? 'Linked in the Control Library' : 'No control linked'} />
          <Kpi label="Red flags" value={<>{reds.length}<span className="text-[0.875rem] text-ink-400"> · {ambers.length} amber</span></>} sub={`Of ${rt.kris.length} indicator${rt.kris.length === 1 ? '' : 's'}`} />
        </div>

        {rt.overrides.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
            <span className="text-ink-500">Overrides</span>
            {rt.overrides.map(o => <span key={o} title={OVERRIDE_TIP[o]} className="inline-flex items-center h-6 px-2 rounded-full border border-canvas-border bg-canvas-elevated text-ink-700 font-medium cursor-help">{o}</span>)}
          </div>
        )}

        {/* Why + how it moved */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Panel title="Why this rating">
            <ol className="space-y-1.5">
              {why.map((w, i) => (
                <li key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] text-[0.8125rem] leading-relaxed text-ink-700">
                  <span className="font-mono text-ink-300">{i + 1}</span><span>{w}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">What adds up to the score</div>
            <ul className="space-y-1.5">
              {lines.map((l, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[0.75rem]">
                  <span className="truncate text-ink-700" title={l.label}>{l.label}</span>
                  <span className="relative h-3">
                    <span
                      className="absolute top-0 h-3 rounded-sm"
                      style={{
                        left: 0, width: `${(Math.abs(l.pts) / maxPts) * 100}%`,
                        background: l.tone === 'base' ? '#3B0764' : l.tone === 'control' ? '#86EFAC' : l.tone === 'red' ? '#D92D20' : l.tone === 'amber' ? '#FEC84B' : '#C2410C',
                      }}
                    />
                  </span>
                  <span className={`text-right font-mono font-semibold tabular-nums ${l.pts < 0 ? 'text-compliant-700' : 'text-ink-900'}`}>{l.pts > 0 ? '+' : '−'}{Math.abs(l.pts).toFixed(1)}</span>
                </li>
              ))}
              <li className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)_3.5rem] items-center gap-3 pt-2 border-t border-canvas-border text-[0.8125rem]">
                <span className="font-semibold text-ink-900">Residual score</span>
                <span />
                <span className="text-right font-mono font-semibold tabular-nums text-ink-900">{rt.score.toFixed(1)}</span>
              </li>
            </ul>
          </Panel>

          <Panel title="How the rating moved" right={<span className="text-[0.6875rem] text-ink-400">{MONTHS[0]}–{MONTHS[NOW]} 2026</span>}>
            <ScoreChart history={rt.history} tiers={rt.tierHistory} events={r.events} />
            <div className="mt-4 mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">What we picked up</div>
            {timeline.length === 0 ? <p className="text-[0.8125rem] text-ink-500">Nothing notable in the period.</p> : (
              <ol className="relative ml-1.5 border-l border-canvas-border space-y-2.5">
                {timeline.slice(0, 6).map((t, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-canvas-elevated ${t.tone === 'event' ? 'bg-high-600' : t.tone === 'red' ? 'bg-risk-600' : 'bg-compliant-600'}`} aria-hidden />
                    <span className="block text-[0.6875rem] text-ink-400">{MONTHS[t.m]} 2026</span>
                    <span className="block text-[0.8125rem] text-ink-800">{t.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        {/* Controls */}
        <Panel
          title="Controls"
          tip="Linked from the Control Library. A control mitigates as far as it is evidenced: live with a clean run counts in full; needs data counts for little."
          right={<Button variant="outline" size="sm" leftIcon={<Link2 size={12} />} onClick={() => setLinking(true)}>Link a control</Button>}
          flush
        >
          <div className="p-4">
            <ControlAccordion
              riskId={r.id}
              controls={rt.controls}
              actions={{ openControl: nav.openControl, adapt: onAdapt ? keys => setAdaptKeys(keys) : undefined, review: () => nav.goTo('builds') }}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="px-5 py-4 border-t border-canvas-border bg-paper-50/40">
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-2">Suggested from the Control Library</div>
              <ul className="flex flex-wrap gap-2">
                {suggestions.map(({ c, e }) => (
                  <li key={c.controlId} className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated pl-3 pr-1.5 py-1.5">
                    <span className="min-w-0">
                      <span className="block text-[0.75rem] font-semibold text-ink-900">{c.name}</span>
                      <span className="block text-[0.6875rem] text-ink-500"><span className="font-mono">{c.controlId}</span> · {STATUS_META[e.status].label}</span>
                    </span>
                    <Button variant="secondary" size="sm" leftIcon={<Plus size={11} />} onClick={() => {
                      linkControl(r.id, c.controlId);
                      addToast({ message: `${c.controlId} linked to ${r.id}`, type: 'success' });
                      logEvent({ action: 'Update', description: `Linked control ${c.controlId} to ${r.id}`, module: 'Risk Register', entity: 'Risk' });
                    }}>Link</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* Indicators + what-if */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
          <Panel
            title="Key risk indicators"
            tip="Red adds 7 points, amber 3; red three months running counts 1.25×. Click an indicator for its history and thresholds."
            right={<Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={() => setAddingKri(v => !v)}>Add indicator</Button>}
            flush
          >
            {addingKri && <AddKriForm onCancel={() => setAddingKri(false)} onAdd={k => {
              addKri(r.id, k);
              setAddingKri(false);
              addToast({ message: `Indicator added to ${r.id}`, type: 'success' });
              logEvent({ action: 'Create', description: `Added indicator "${k.name}" to ${r.id}`, module: 'Risk Register', entity: 'Indicator' });
            }} />}
            {rt.kris.length === 0 ? <p className="px-5 py-5 text-[0.8125rem] text-ink-500">No indicator watches this risk yet.</p> : (
              <ul className="divide-y divide-canvas-border">
                {rt.kris.map(k => (
                  <li key={k.kri.id}>
                    <button onClick={() => setKriOpen(k.kri.id)} className="w-full grid grid-cols-[3.75rem_minmax(0,1fr)_6rem_auto_3rem] items-center gap-4 px-5 py-3 text-left hover:bg-paper-50/60 cursor-pointer">
                      <RagChip rag={k.rag} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{k.kri.name}</span>
                          <span className="shrink-0 inline-flex items-center h-4 px-1 rounded bg-brand-50 text-brand-700 text-[0.5625rem] font-bold">{k.kri.type}</span>
                        </span>
                        <span className="block text-[0.6875rem] text-ink-500 truncate">amber {k.kri.amber} · red {k.kri.red} · {k.kri.source}</span>
                      </span>
                      <span className="text-right font-mono text-[0.9375rem] font-semibold text-ink-900 tabular-nums">{fmtKri(kriFor(k), k.value)}</span>
                      <RagStrip kri={k.kri} />
                      <span className="text-right font-mono text-[0.75rem] text-ink-500 tabular-nums">{k.points ? `+${k.points.toFixed(1)}` : '0'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="If these were fixed" tip="Tick a red or amber flag, or a control that isn't operating, to see the rating if it were fixed.">
            {reds.length + ambers.length + rt.controls.filter(c => (c.effect?.effectiveness ?? 0) < 1).length === 0 ? (
              <p className="text-[0.8125rem] text-ink-500">Nothing to fix — every indicator is green and every control effective.</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {[...reds, ...ambers].map(k => (
                    <SimRow key={k.kri.id} on={fixKris.has(k.kri.id)} onToggle={() => setFixKris(s => toggle(s, k.kri.id))} label={k.kri.name} tag={k.rag === 2 ? 'Red' : 'Amber'} pts={`−${k.points.toFixed(1)}`} />
                  ))}
                  {rt.controls.filter(c => (c.effect?.effectiveness ?? 0) < 1 && c.row).map(c => (
                    <SimRow key={c.id} on={fixControls.has(c.id)} onToggle={() => setFixControls(s => toggle(s, c.id))} label={`${c.row!.name} operating`} tag={STATUS_META[c.effect!.status].label} />
                  ))}
                </ul>
                <div className="mt-4 rounded-xl border border-canvas-border bg-canvas px-4 py-3">
                  {sim ? (
                    <div className="flex flex-wrap items-center gap-2 text-[0.8125rem]">
                      <span className="text-ink-500">If fixed</span>
                      <span className="font-mono font-semibold tabular-nums">{rt.score.toFixed(1)}</span>
                      <ArrowRight size={12} className="text-ink-400" aria-hidden />
                      <span className="font-mono font-semibold tabular-nums text-ink-900">{sim.score.toFixed(1)}</span>
                      <TierChip tier={rt.tier} size="sm" />
                      <ArrowRight size={12} className="text-ink-400" aria-hidden />
                      <TierChip tier={sim.tier} size="sm" />
                      <span className="basis-full text-[0.75rem] text-ink-600">{TIER_ACTION[sim.tier]}{sim.outsideAppetite ? ' · still outside appetite' : rt.outsideAppetite ? ' · back within appetite' : ''}</span>
                    </div>
                  ) : <span className="text-[0.75rem] text-ink-500">Tick a flag to see the rating if it were fixed.</span>}
                </div>
              </>
            )}
          </Panel>
        </div>

        {/* Treatment + assessments */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
          <Panel
            title="Treatment and action plan"
            right={<Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={() => setAddingAction(v => !v)}>Add action</Button>}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100" role="radiogroup" aria-label="Treatment">
                {(['Mitigate', 'Accept', 'Transfer', 'Avoid'] as Treatment[]).map(t => (
                  <button key={t} role="radio" aria-checked={r.treatment === t} onClick={() => setTreatment(t)} className={`h-7 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer ${r.treatment === t ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}>{t}</button>
                ))}
              </div>
              <span className="text-[0.75rem] text-ink-500">
                {r.treatment === 'Accept' && rt.outsideAppetite ? 'Accepting a risk outside appetite needs Audit Committee sign-off.' : `${r.category} appetite: ${appetite.level.toLowerCase()} (up to ${appetite.max}).`}
              </span>
            </div>
            {addingAction && <AddActionForm defaultOwner={r.owner} onCancel={() => setAddingAction(false)} onAdd={a => {
              addAction(r.id, a);
              setAddingAction(false);
              addToast({ message: 'Action added', type: 'success' });
              logEvent({ action: 'Create', description: `Added action "${a.title}" to ${r.id}`, module: 'Risk Register', entity: 'Action' });
            }} />}
            {r.actions.length === 0 ? <p className="mt-4 text-[0.8125rem] text-ink-500">No action planned yet.</p> : (
              <ul className="mt-4 divide-y divide-canvas-border rounded-xl border border-canvas-border">
                {r.actions.map(a => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <button
                      role="checkbox"
                      aria-checked={a.done}
                      aria-label={a.done ? `Reopen ${a.title}` : `Mark ${a.title} done`}
                      onClick={() => toggleAction(r.id, a.id)}
                      className={`size-4 rounded border flex items-center justify-center cursor-pointer ${a.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-ink-300 hover:border-ink-400'}`}
                    >{a.done && <Check size={11} strokeWidth={3} />}</button>
                    <span className={`min-w-0 flex-1 text-[0.8125rem] ${a.done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{a.title}</span>
                    <span className="text-[0.75rem] text-ink-500">{a.owner}</span>
                    <span className="w-24 text-right text-[0.75rem] text-ink-500 tabular-nums">{a.due}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Assessment history">
            <ol className="space-y-3">
              {r.assessments.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-[0.75rem] font-semibold text-ink-900 w-14 shrink-0 tabular-nums">L{a.likelihood}×I{a.impact}</span>
                  <span className="min-w-0">
                    <span className="block text-[0.8125rem] text-ink-800">{a.note}</span>
                    <span className="block text-[0.6875rem] text-ink-500">{a.by} · {a.at}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {openKri && <KriDrawer key={`${openKri.id}-${openKri.amber}-${openKri.red}`} riskId={r.id} riskName={r.name} kri={openKri} onClose={() => setKriOpen(null)} />}
        {editing && <RiskEditorDrawer risk={r} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
        {assessing && <AssessmentModal risk={r} ctx={ctx} by={me} onClose={() => setAssessing(false)} />}
        {linking && <LinkControlDrawer risk={r} ctx={ctx} onClose={() => setLinking(false)} />}
        {adaptKeys && onAdapt && (
          <AdaptDataModal keys={adaptKeys} onClose={() => setAdaptKeys(null)} onContinue={choices => { const k = adaptKeys; setAdaptKeys(null); onAdapt(k, choices); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const toggle = (s: Set<string>, id: string) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; };

function SimRow({ on, onToggle, label, tag, pts }: { on: boolean; onToggle: () => void; label: string; tag: string; pts?: string }) {
  return (
    <li>
      <label className="flex items-center gap-2.5 text-[0.8125rem] cursor-pointer">
        <input type="checkbox" checked={on} onChange={onToggle} className="size-4 accent-[#6A12CD] cursor-pointer" />
        <span className="min-w-0 flex-1 truncate text-ink-800">{label}</span>
        <span className="text-[0.6875rem] text-ink-500">{tag}</span>
        {pts && <span className="w-10 text-right font-mono text-[0.6875rem] text-ink-500 tabular-nums">{pts}</span>}
      </label>
    </li>
  );
}

function AddKriForm({ onAdd, onCancel }: { onAdd: (k: Omit<Kri, 'id'>) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Kri['type']>('KRI');
  const [unit, setUnit] = useState<Kri['unit']>('count');
  const [amber, setAmber] = useState('');
  const [red, setRed] = useState('');
  const [current, setCurrent] = useState('');
  const [source, setSource] = useState('');
  const a = Number(amber), rd = Number(red), cur = Number(current);
  const ok = name.trim() && amber !== '' && red !== '' && current !== '' && rd > a;
  const input = 'h-8 px-2.5 rounded-lg border border-canvas-border text-[0.8125rem] outline-none focus:border-brand-300';
  return (
    <div className="px-5 py-4 border-b border-canvas-border bg-paper-50/40 grid grid-cols-2 lg:grid-cols-[minmax(0,2fr)_5rem_6rem_5rem_5rem_5.5rem_minmax(0,1fr)_auto] gap-2 items-end">
      <label className="text-[0.6875rem] text-ink-500">Indicator<input autoFocus value={name} onChange={e => setName(e.target.value)} className={`${input} mt-1 w-full`} placeholder="What is measured" /></label>
      <label className="text-[0.6875rem] text-ink-500">Type<select value={type} onChange={e => setType(e.target.value as Kri['type'])} className={`${input} mt-1 w-full`}><option>KRI</option><option>KCI</option></select></label>
      <label className="text-[0.6875rem] text-ink-500">Unit<select value={unit} onChange={e => setUnit(e.target.value as Kri['unit'])} className={`${input} mt-1 w-full`}><option value="count">Count</option><option value="%">%</option><option value="₹ L">₹ lakh</option><option value="days">Days</option></select></label>
      <label className="text-[0.6875rem] text-ink-500">Amber<input value={amber} onChange={e => setAmber(e.target.value)} inputMode="decimal" className={`${input} mt-1 w-full font-mono`} /></label>
      <label className="text-[0.6875rem] text-ink-500">Red<input value={red} onChange={e => setRed(e.target.value)} inputMode="decimal" className={`${input} mt-1 w-full font-mono`} /></label>
      <label className="text-[0.6875rem] text-ink-500">This month<input value={current} onChange={e => setCurrent(e.target.value)} inputMode="decimal" className={`${input} mt-1 w-full font-mono`} /></label>
      <label className="text-[0.6875rem] text-ink-500">Source<input value={source} onChange={e => setSource(e.target.value)} className={`${input} mt-1 w-full`} placeholder="System or report" /></label>
      <div className="flex items-center gap-1.5">
        <Button variant="primary" size="sm" disabled={!ok} onClick={() => onAdd({ name: name.trim(), type, unit, amber: a, red: rd, values: Array(NOW + 1).fill(cur), source: source.trim() || 'Manual entry', defn: name.trim() })}>Add</Button>
        <button onClick={onCancel} aria-label="Cancel" className="size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 cursor-pointer"><X size={14} /></button>
      </div>
    </div>
  );
}

function AddActionForm({ defaultOwner, onAdd, onCancel }: { defaultOwner: string; onAdd: (a: { title: string; owner: string; due: string }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState(defaultOwner);
  const [due, setDue] = useState('');
  const input = 'h-8 px-2.5 rounded-lg border border-canvas-border text-[0.8125rem] outline-none focus:border-brand-300';
  const fmt = (d: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_9rem_auto] gap-2 items-end">
      <label className="text-[0.6875rem] text-ink-500">Action<input autoFocus value={title} onChange={e => setTitle(e.target.value)} className={`${input} mt-1 w-full`} placeholder="What will be done" /></label>
      <label className="text-[0.6875rem] text-ink-500">Owner<input value={owner} onChange={e => setOwner(e.target.value)} className={`${input} mt-1 w-full`} /></label>
      <label className="text-[0.6875rem] text-ink-500">Due<input type="date" value={due} onChange={e => setDue(e.target.value)} className={`${input} mt-1 w-full`} /></label>
      <div className="flex items-center gap-1.5">
        <Button variant="primary" size="sm" disabled={!title.trim() || !due} onClick={() => onAdd({ title: title.trim(), owner: owner.trim() || defaultOwner, due: fmt(due) })}>Add</Button>
        <button onClick={onCancel} aria-label="Cancel" className="size-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 cursor-pointer"><X size={14} /></button>
      </div>
    </div>
  );
}

