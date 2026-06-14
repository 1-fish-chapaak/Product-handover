import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot, RefreshCw, Sparkles, Paperclip, ThumbsUp, ThumbsDown, ShieldCheck, ShieldX,
  ArrowRight, FlaskConical, FileWarning, Layers, User, Clock, Gavel, CheckCircle2, Info, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useToast } from '../shared/Toast';
import {
  AsyncButton, AutoVerdictChip, ControlStatusPill, EvidenceChip, LifecycleStepper, MethodChip,
  MiniTable, OwnerVerdictChip, ResultChip, SectionCard, SelfAssessmentChip,
} from './parts';
import {
  deriveControlMethod, type AttributeTest, type ControlTest, type EvidenceFile, type Phase, type Role, type TestResult,
} from './types';
import type { ControlTestingApi } from './useControlTesting';
import { AtrPanel } from './AtrPanel';

let evUploadSeq = 1000;
function mockEvidence(code: string, who: string): EvidenceFile {
  evUploadSeq += 1;
  return { id: `up-${evUploadSeq}`, name: `evidence-${code.toLowerCase()}-${evUploadSeq}.pdf`, kind: 'PDF', uploadedBy: who, uploadedAt: 'just now' };
}

function rerun(a: AttributeTest): AttributeTest['workflow'] {
  if (!a.workflow) return undefined;
  const exceptions = Math.max(0, a.workflow.exceptions + (Math.random() > 0.6 ? -1 : 0));
  const verdict = exceptions === 0 ? 'Pass' : a.workflow.verdict === 'Fail' ? 'Fail' : 'Hold';
  return { ...a.workflow, lastRunAt: 'just now', exceptions, verdict, confidence: Math.min(99, a.workflow.confidence + 2) };
}

export function ControlDetail({ control, role, api }: { control: ControlTest; role: Role; api: ControlTestingApi }) {
  const { addToast } = useToast();
  const [selAttrId, setSelAttrId] = useState<string>(control.attributes[0]?.id ?? '');
  useEffect(() => { setSelAttrId(control.attributes[0]?.id ?? ''); }, [control.controlId, control.attributes]);
  const attr = control.attributes.find((a) => a.id === selAttrId) ?? control.attributes[0];

  const method = deriveControlMethod(control);

  // ── control-level action bar ──
  const actionBar = useMemo(() => buildAction(control, role), [control, role]);
  const runAction = () => {
    if (!actionBar || !actionBar.enabled) return;
    if (actionBar.kind === 'submit-self') { api.submitSelfAssessment(control.controlId); addToast({ message: `${control.controlId} sent to control owner for review`, type: 'success' }); }
    if (actionBar.kind === 'submit-owner') { api.submitOwnerReview(control.controlId); addToast({ message: `${control.controlId} released to the auditor`, type: 'success' }); }
    if (actionBar.kind === 'advance') { api.advancePhase(control.controlId); addToast({ message: 'Phase 1 complete — Phase 2 opened', type: 'success' }); }
    if (actionBar.kind === 'conclude') {
      const verdict = api.conclude(control.controlId);
      addToast({ title: verdict === 'Effective' ? 'Control concluded Effective' : 'Control concluded Ineffective', message: verdict === 'Effective' ? 'Loop closed.' : 'Action Taken Report raised for remediation.', type: verdict === 'Effective' ? 'success' : 'warning' });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[12.5px] font-semibold text-brand-700">{control.controlId}</span>
              {control.isKey && <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">Key control</span>}
              <span className="text-[11.5px] text-ink-400">{control.process} · {control.subProcess}</span>
            </div>
            <h2 className="text-[19px] font-semibold text-ink-900 leading-tight tracking-tight" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>{control.name}</h2>
          </div>
          <ControlStatusPill c={control} />
        </div>
        <div className="flex items-center gap-4 mt-3 text-[12px] text-ink-500 flex-wrap">
          <MethodChip method={method} />
          <span className="inline-flex items-center gap-1.5"><Clock size={13} />{control.frequency}</span>
          <span className="inline-flex items-center gap-1.5"><User size={13} />Performer: <span className="text-ink-700 font-medium">{control.performer}</span></span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} />Owner: <span className="text-ink-700 font-medium">{control.owner}</span></span>
        </div>

        <div className="mt-4 mb-5 rounded-xl border border-canvas-border bg-paper-50/60 px-4 py-3">
          <LifecycleStepper c={control} />
        </div>
      </div>

      {/* body — scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
        {/* attribute table */}
        <SectionCard title={`Attributes (${control.attributes.length})`} icon={<Layers size={15} className="text-brand-600" />}>
          <AttributeTable attributes={control.attributes} selId={selAttrId} onSel={setSelAttrId} />
        </SectionCard>

        {/* attribute detail */}
        {attr && (
          <AnimatePresence mode="wait">
            <motion.div key={attr.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              <AttributeDetail control={control} attr={attr} role={role} api={api} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* ATR */}
        {control.atr && <AtrPanel control={control} role={role} api={api} />}
      </div>

      {/* action bar */}
      {actionBar && (
        <div className="shrink-0 mt-4 pt-4 border-t border-canvas-border flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-ink-500 inline-flex items-center gap-1.5">
            <Info size={14} className="text-ink-400" />
            {actionBar.hint}
          </p>
          <AsyncButton variant={actionBar.tone} disabled={!actionBar.enabled} onClick={runAction} icon={actionBar.icon}>
            {actionBar.label}
          </AsyncButton>
        </div>
      )}
    </div>
  );
}

// ─── attribute table ────────────────────────────────────────────────────────────

function AttributeTable({ attributes, selId, onSel }: { attributes: AttributeTest[]; selId: string; onSel: (id: string) => void }) {
  return (
    <div className="overflow-x-auto -m-1 p-1">
      <table className="w-full text-[12.5px] border-separate border-spacing-0">
        <thead>
          <tr className="text-ink-500">
            {['Attribute', 'Method', 'Self-assess', 'Owner', 'Phase 1', 'Phase 2'].map((h, i) => (
              <th key={h} className={cn('text-left font-semibold uppercase tracking-wide text-[10.5px] pb-2 px-2', i === 0 && 'pl-2')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map((a) => {
            const sel = a.id === selId;
            return (
              <tr key={a.id} onClick={() => onSel(a.id)} className={cn('cursor-pointer transition-colors', sel ? 'bg-brand-50/70' : 'hover:bg-paper-50')}>
                <td className={cn('px-2 py-2.5 rounded-l-lg border-y', sel ? 'border-brand-100' : 'border-transparent')}>
                  <div className="flex items-center gap-2">
                    <ChevronRight size={13} className={cn('shrink-0 transition-transform', sel ? 'text-brand-600 rotate-90' : 'text-ink-300')} />
                    <div className="min-w-0">
                      <div className="font-mono text-[11.5px] text-ink-500">{a.code}</div>
                      <div className="text-ink-800 font-medium leading-snug line-clamp-1 max-w-[260px]">{a.description}</div>
                    </div>
                  </div>
                </td>
                <td className={cn('px-2 py-2.5 border-y', sel ? 'border-brand-100' : 'border-transparent')}><MethodChip method={a.method} /></td>
                <td className={cn('px-2 py-2.5 border-y', sel ? 'border-brand-100' : 'border-transparent')}><SelfAssessmentChip outcome={a.selfAssessment.outcome} /></td>
                <td className={cn('px-2 py-2.5 border-y', sel ? 'border-brand-100' : 'border-transparent')}><OwnerVerdictChip verdict={a.ownerReview.verdict} /></td>
                <td className={cn('px-2 py-2.5 border-y', sel ? 'border-brand-100' : 'border-transparent')}><ResultChip result={a.phase1.result} /></td>
                <td className={cn('px-2 py-2.5 rounded-r-lg border-y', sel ? 'border-brand-100' : 'border-transparent')}><ResultChip result={a.phase2.result} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── attribute detail (role-aware) ──────────────────────────────────────────────

function AttributeDetail({ control, attr, role, api }: { control: ControlTest; attr: AttributeTest; role: Role; api: ControlTestingApi }) {
  return (
    <div className="space-y-4">
      {/* the test itself */}
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="font-mono text-[12px] font-semibold text-ink-600">{attr.code}</span>
          <span className="inline-flex items-center gap-2"><MethodChip method={attr.method} /><span className="text-[11.5px] text-ink-400">Assertion: {attr.assertion}</span></span>
        </div>
        <p className="text-[13.5px] text-ink-800 leading-relaxed">{attr.description}</p>
        {attr.method === 'Automated' && attr.workflow && <WorkflowRunCard control={control} attr={attr} api={api} />}
      </div>

      {/* the human stages */}
      {role === 'performer' && <PerformerPane control={control} attr={attr} api={api} />}
      {role === 'owner' && <OwnerPane control={control} attr={attr} api={api} />}
      {role === 'auditor' && <AuditorPane control={control} attr={attr} api={api} />}
    </div>
  );
}

// ─── workflow run card ──────────────────────────────────────────────────────────

function WorkflowRunCard({ control, attr, api }: { control: ControlTest; attr: AttributeTest; api: ControlTestingApi }) {
  const { addToast, updateToast } = useToast();
  const [running, setRunning] = useState(false);
  const wf = attr.workflow!;

  const doRerun = () => {
    setRunning(true);
    const id = addToast({ message: `Running ${wf.workflowName}…`, type: 'loading' });
    window.setTimeout(() => {
      const next = rerun(attr);
      if (next) api.setWorkflowRun(control.controlId, attr.id, next);
      setRunning(false);
      updateToast(id, { type: 'success', title: 'Workflow finished', message: `${wf.workflowName} — ${next?.exceptions ?? 0} exception(s)` });
    }, 1100);
  };

  return (
    <div className="mt-3 rounded-xl border border-evidence-200 bg-evidence-50/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-evidence-200/70">
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-800"><Bot size={15} className="text-brand-600" />{wf.workflowName}</span>
        <span className="inline-flex items-center gap-3 text-[11.5px] text-ink-500">
          <span>Last run {wf.lastRunAt ?? 'never'}</span>
          <AsyncButton size="sm" variant="outline" loading={running} icon={<RefreshCw size={13} />} onClick={doRerun}>Re-run</AsyncButton>
        </span>
      </div>
      <div className="p-3.5 space-y-3">
        <div className="flex items-center gap-4 flex-wrap text-[12px]">
          <Stat label="Population" value={wf.population.toLocaleString()} />
          <Stat label="Exceptions" value={String(wf.exceptions)} danger={wf.exceptions > 0} />
          <div className="flex flex-col gap-0.5"><span className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">Verdict</span><AutoVerdictChip verdict={wf.verdict} confidence={wf.confidence} /></div>
        </div>
        <p className="text-[12.5px] text-ink-600 leading-relaxed inline-flex gap-1.5"><Sparkles size={14} className="text-brand-500 shrink-0 mt-0.5" />{wf.rationale}</p>
        {running ? <div className="h-24 rounded-lg bg-paper-100 animate-pulse" /> : <MiniTable columns={wf.columns} rows={wf.rows} />}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold">{label}</span>
      <span className={cn('text-[15px] font-bold tabular-nums', danger ? 'text-risk-700' : 'text-ink-900')}>{value}</span>
    </div>
  );
}

// ─── performer pane ─────────────────────────────────────────────────────────────

function PerformerPane({ control, attr, api }: { control: ControlTest; attr: AttributeTest; api: ControlTestingApi }) {
  const editable = control.stage === 'awaiting-self-assessment';
  const [remark, setRemark] = useState(attr.selfAssessment.remark);
  useEffect(() => setRemark(attr.selfAssessment.remark), [attr.id, attr.selfAssessment.remark]);
  const sa = attr.selfAssessment;

  const choose = (outcome: 'OK' | 'Not OK') => api.selfAssess(control.controlId, attr.id, outcome, remark);

  return (
    <SectionCard title="Self-assessment" icon={<ThumbsUp size={15} className="text-brand-600" />} right={sa.submittedAt ? <span className="text-[11.5px] text-ink-400">{sa.submittedBy} · {sa.submittedAt}</span> : undefined}>
      {editable ? (
        <div className="space-y-3">
          <p className="text-[12.5px] text-ink-500">Did the control operate as intended this period?</p>
          <div className="flex items-center gap-2">
            <button onClick={() => choose('OK')} className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer', sa.outcome === 'OK' ? 'bg-compliant-50 border-compliant-700 text-compliant-700' : 'border-canvas-border text-ink-600 hover:border-compliant-700/40')}><ThumbsUp size={15} /> OK</button>
            <button onClick={() => choose('Not OK')} className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer', sa.outcome === 'Not OK' ? 'bg-risk-50 border-risk-700 text-risk-700' : 'border-canvas-border text-ink-600 hover:border-risk-700/40')}><ThumbsDown size={15} /> Not OK</button>
          </div>
          <AnimatePresence>
            {sa.outcome === 'Not OK' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label className="block text-[12px] font-semibold text-ink-600 mb-1.5 mt-1">Why is it not OK? <span className="text-risk-700">Required</span></label>
                <textarea value={remark} onChange={(e) => { setRemark(e.target.value); api.selfAssess(control.controlId, attr.id, 'Not OK', e.target.value); }} rows={3} placeholder="Describe the deviation and any compensating action…" className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none" />
              </motion.div>
            )}
          </AnimatePresence>
          <EvidenceRow files={sa.evidence} onAttach={() => api.attachEvidence(control.controlId, attr.id, 'self', mockEvidence(attr.code, control.performer))} />
        </div>
      ) : (
        <ReadOnlyAssessment attr={attr} />
      )}
    </SectionCard>
  );
}

// ─── owner pane ─────────────────────────────────────────────────────────────────

function OwnerPane({ control, attr, api }: { control: ControlTest; attr: AttributeTest; api: ControlTestingApi }) {
  const editable = control.stage === 'awaiting-owner-review';
  const [remark, setRemark] = useState(attr.ownerReview.remark);
  useEffect(() => setRemark(attr.ownerReview.remark), [attr.id, attr.ownerReview.remark]);
  const orv = attr.ownerReview;

  return (
    <div className="space-y-4">
      {/* what the performer said */}
      <SectionCard title="Performer's self-assessment" icon={<User size={15} className="text-ink-500" />}>
        <ReadOnlyAssessment attr={attr} />
      </SectionCard>

      <SectionCard title="Owner review" icon={<ShieldCheck size={15} className="text-brand-600" />} right={orv.reviewedAt ? <span className="text-[11.5px] text-ink-400">{orv.reviewedBy} · {orv.reviewedAt}</span> : undefined}>
        {editable ? (
          <div className="space-y-3">
            <p className="text-[12.5px] text-ink-500">Is the documentation sufficient to accept this control as performed?</p>
            <div className="flex items-center gap-2">
              <button onClick={() => api.ownerReview(control.controlId, attr.id, 'Pass', remark)} className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer', orv.verdict === 'Pass' ? 'bg-compliant-50 border-compliant-700 text-compliant-700' : 'border-canvas-border text-ink-600 hover:border-compliant-700/40')}><ShieldCheck size={15} /> Pass</button>
              <button onClick={() => api.ownerReview(control.controlId, attr.id, 'Fail', remark)} className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold border transition-colors cursor-pointer', orv.verdict === 'Fail' ? 'bg-risk-50 border-risk-700 text-risk-700' : 'border-canvas-border text-ink-600 hover:border-risk-700/40')}><ShieldX size={15} /> Fail — insufficient</button>
            </div>
            <textarea value={remark} onChange={(e) => { setRemark(e.target.value); if (orv.verdict) api.ownerReview(control.controlId, attr.id, orv.verdict, e.target.value); }} rows={2} placeholder="Reviewer remark (optional unless failing)…" className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none" />
          </div>
        ) : orv.verdict ? (
          <div className="flex items-start gap-2 text-[13px]"><OwnerVerdictChip verdict={orv.verdict} /><p className="text-ink-600 leading-relaxed">{orv.remark || 'No remark.'}</p></div>
        ) : (
          <p className="text-[12.5px] text-ink-400">Not yet reviewed.</p>
        )}
      </SectionCard>
    </div>
  );
}

// ─── auditor pane ───────────────────────────────────────────────────────────────

function AuditorPane({ control, attr, api }: { control: ControlTest; attr: AttributeTest; api: ControlTestingApi }) {
  return (
    <div className="space-y-4">
      <SectionCard title="Self-assessment trail" icon={<User size={15} className="text-ink-500" />} className="bg-paper-50/50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold mb-1.5">Performer</div>
            <ReadOnlyAssessment attr={attr} compact />
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-ink-400 font-semibold mb-1.5">Control owner</div>
            {attr.ownerReview.verdict ? <div className="flex items-start gap-2"><OwnerVerdictChip verdict={attr.ownerReview.verdict} /><p className="text-[12.5px] text-ink-600">{attr.ownerReview.remark || '—'}</p></div> : <p className="text-[12.5px] text-ink-400">—</p>}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PhaseColumn control={control} attr={attr} phase={1} api={api} />
        <PhaseColumn control={control} attr={attr} phase={2} api={api} />
      </div>
    </div>
  );
}

function PhaseColumn({ control, attr, phase, api }: { control: ControlTest; attr: AttributeTest; phase: Phase; api: ControlTestingApi }) {
  const rec = phase === 1 ? attr.phase1 : attr.phase2;
  const phase1Done = attr.phase1.result != null;
  const locked = phase === 2 && (control.stage === 'awaiting-audit' || control.stage === 'audit-phase-1' || !phase1Done);
  const editable = !locked && control.stage !== 'concluded';
  const [notes, setNotes] = useState(rec.notes);
  useEffect(() => setNotes(rec.notes), [attr.id, rec.notes]);

  const record = (result: TestResult) => api.recordPhase(control.controlId, attr.id, phase, result, notes);

  return (
    <div className={cn('rounded-xl border bg-canvas-elevated overflow-hidden', rec.result === 'Fail' ? 'border-risk-200' : rec.result === 'Pass' ? 'border-compliant-700/30' : 'border-canvas-border')}>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-canvas-border bg-paper-50/50">
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-800"><FlaskConical size={14} className="text-brand-600" />Phase {phase}<span className="text-[11px] font-normal text-ink-400">{phase === 1 ? 'Interim' : 'Roll-forward'}</span></span>
        <ResultChip result={rec.result} />
      </div>
      <div className="p-3.5 space-y-3">
        {locked ? (
          <div className="flex flex-col items-center text-center py-4 text-ink-400">
            <FileWarning size={18} className="mb-1.5" />
            <p className="text-[12px]">Complete Phase 1 to open Phase 2.</p>
          </div>
        ) : (
          <>
            <textarea value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={`Phase ${phase} testing notes…`} className="w-full rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[12.5px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-50 resize-none disabled:bg-paper-50 disabled:text-ink-500" />
            <EvidenceRow files={rec.evidence} onAttach={editable ? () => api.attachEvidence(control.controlId, attr.id, phase === 1 ? 'phase1' : 'phase2', mockEvidence(attr.code, 'Auditor')) : undefined} />
            {editable && (
              <div className="flex items-center gap-2">
                <button onClick={() => record('Pass')} className={cn('flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12.5px] font-semibold border transition-colors cursor-pointer', rec.result === 'Pass' ? 'bg-compliant-50 border-compliant-700 text-compliant-700' : 'border-canvas-border text-ink-600 hover:border-compliant-700/40')}><CheckCircle2 size={14} /> Pass</button>
                <button onClick={() => record('Fail')} className={cn('flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12.5px] font-semibold border transition-colors cursor-pointer', rec.result === 'Fail' ? 'bg-risk-50 border-risk-700 text-risk-700' : 'border-canvas-border text-ink-600 hover:border-risk-700/40')}><ShieldX size={14} /> Fail</button>
              </div>
            )}
            {rec.testedAt && <p className="text-[11px] text-ink-400">{rec.testedBy} · {rec.testedAt}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ─── shared bits ────────────────────────────────────────────────────────────────

function ReadOnlyAssessment({ attr, compact }: { attr: AttributeTest; compact?: boolean }) {
  const sa = attr.selfAssessment;
  if (!sa.outcome) return <p className="text-[12.5px] text-ink-400">Not yet self-assessed.</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><SelfAssessmentChip outcome={sa.outcome} />{!compact && sa.submittedAt && <span className="text-[11.5px] text-ink-400">{sa.submittedBy} · {sa.submittedAt}</span>}</div>
      {sa.remark && <p className="text-[12.5px] text-ink-600 leading-relaxed">{sa.remark}</p>}
      {sa.evidence.length > 0 && <div className="flex items-center gap-1.5 flex-wrap">{sa.evidence.map((f) => <EvidenceChip key={f.id} file={f} />)}</div>}
    </div>
  );
}

function EvidenceRow({ files, onAttach }: { files: EvidenceFile[]; onAttach?: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {files.map((f) => <EvidenceChip key={f.id} file={f} />)}
      {onAttach && (
        <button onClick={onAttach} className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-dashed border-canvas-border text-[11.5px] font-medium text-ink-500 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"><Paperclip size={12} /> Attach</button>
      )}
      {files.length === 0 && !onAttach && <span className="text-[11.5px] text-ink-400">No evidence attached</span>}
    </div>
  );
}

// ─── action-bar logic ───────────────────────────────────────────────────────────

interface ActionDef {
  kind: 'submit-self' | 'submit-owner' | 'advance' | 'conclude';
  label: string;
  hint: string;
  enabled: boolean;
  tone: 'primary' | 'secondary' | 'outline' | 'destructive';
  icon: React.ReactNode;
}

function buildAction(c: ControlTest, role: Role): ActionDef | null {
  if (role === 'performer' && c.stage === 'awaiting-self-assessment') {
    const allDone = c.attributes.every((a) => a.selfAssessment.outcome != null);
    const needRemark = c.attributes.some((a) => a.selfAssessment.outcome === 'Not OK' && !a.selfAssessment.remark.trim());
    return { kind: 'submit-self', label: 'Submit to control owner', hint: allDone ? (needRemark ? 'Add a remark on every “Not OK” attribute.' : 'All attributes assessed.') : 'Assess every attribute (OK / Not OK) to continue.', enabled: allDone && !needRemark, tone: 'primary', icon: <ArrowRight size={15} /> };
  }
  if (role === 'owner' && c.stage === 'awaiting-owner-review') {
    const allDone = c.attributes.every((a) => a.ownerReview.verdict != null);
    return { kind: 'submit-owner', label: 'Release to auditor', hint: allDone ? 'All attributes reviewed.' : 'Pass or fail every attribute to continue.', enabled: allDone, tone: 'primary', icon: <Gavel size={15} /> };
  }
  if (role === 'auditor' && c.stage === 'audit-phase-1') {
    const allDone = c.attributes.every((a) => a.phase1.result != null);
    return { kind: 'advance', label: 'Advance to Phase 2', hint: allDone ? 'Phase 1 results recorded.' : 'Record a Phase 1 result for every attribute.', enabled: allDone, tone: 'primary', icon: <ArrowRight size={15} /> };
  }
  if (role === 'auditor' && c.stage === 'audit-phase-2') {
    const allDone = c.attributes.every((a) => a.phase2.result != null);
    const willFail = c.attributes.some((a) => a.phase1.result === 'Fail' || a.phase2.result === 'Fail');
    return { kind: 'conclude', label: willFail ? 'Conclude — raise ATR' : 'Conclude — Effective', hint: allDone ? 'Closing the loop will set the conclusion.' : 'Record a Phase 2 result for every attribute.', enabled: allDone, tone: willFail ? 'destructive' : 'primary', icon: <CheckCircle2 size={15} /> };
  }
  if (role === 'auditor' && c.stage === 'awaiting-audit') {
    return { kind: 'advance', label: 'Begin Phase 1', hint: 'Record a Phase 1 result below to begin independent testing.', enabled: false, tone: 'outline', icon: <FlaskConical size={15} /> };
  }
  return null;
}
