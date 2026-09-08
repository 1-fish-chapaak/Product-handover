import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown, ChevronRight, Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { controlConclusion } from './helpers';
import { ownersOf } from './auditScope';
import { ConclusionPill } from './parts';
import { Pill } from '../shared/StatusBadge';
import { Dropdown, KeyControlChip, menuItem, WORKFLOW_LIBRARY } from './ControlDossier';
import { attributeStats, auditsForControl, LastRunFact, runsForControl, RunHistoryList } from './ControlLibrary';
import { cn } from '../../lib/cn';
import type { AuditRound, Control, OperatingStep } from './types';

/**
 * The engagement-root control page — the LIBRARY lens's own detail view (user
 * ask, 30 Jul). What a control IS (its attributes, and which of them a
 * workflow evidences) lives here, always editable, independent of any audit.
 * What it CONCLUDED is read per audit below, not tested here — testing only
 * happens inside an audit, on ControlDossier, which this page links out to.
 *
 * One continuous scroll (user ask): audit runs shown upfront, attributes as a
 * table, testing activity last — no tabs, no side sheet gating any of it.
 */

const ROUND_LABEL: Record<AuditRound, string> = { interim: 'Interim', rollforward: 'Roll-forward', yearend: 'Year-end' };

function AttributeTableRow({ control, step, canEdit }: { control: Control; step: OperatingStep; canEdit: boolean }) {
  const { mapStepWorkflow, removeAttribute } = useIcfr();
  const logEvent = useAuditLog();
  return (
    <tr className="reg-row">
      <td className="tight"><span className="wp-ref">{step.code}</span></td>
      <td className="tight">
        <div className="flex items-center gap-2">
          <Pill tone={step.workflowId ? 'compliant' : 'draft'}>{step.workflowId ? 'Mapped' : 'Not mapped'}</Pill>
          <span className="font-medium text-ink-800">{step.description}</span>
        </div>
        <div className="text-[0.6875rem] text-ink-400 mt-0.5">{step.assertion} · {step.precision}</div>
      </td>
      <td className="tight">
        {step.workflowId ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="wf-tag">{step.workflowName}</span>
            {canEdit && (
              <Dropdown trigger={<span className="text-brand-700 font-semibold text-[0.75rem] hover:underline cursor-pointer inline-flex items-center gap-1"><Plus size={11} /> Add workflow</span>}>
                {close => WORKFLOW_LIBRARY.map(w => (
                  <button key={w} className={menuItem} onClick={() => { mapStepWorkflow(control.id, step.id, w); close(); }}>
                    <WorkflowIcon size={12} className="text-evidence-600" />{w}
                  </button>
                ))}
              </Dropdown>
            )}
          </div>
        ) : canEdit ? (
          <Dropdown trigger={<><WorkflowIcon size={12} /> Map a workflow</>}>
            {close => WORKFLOW_LIBRARY.map(w => (
              <button key={w} className={menuItem} onClick={() => { mapStepWorkflow(control.id, step.id, w); close(); }}>
                <WorkflowIcon size={12} className="text-evidence-600" />{w}
              </button>
            ))}
          </Dropdown>
        ) : (
          <span className="text-[0.75rem] text-ink-400">No workflow mapped</span>
        )}
      </td>
      <td className="tight" style={{ textAlign: 'right' }}>
        {canEdit && (
          <button
            onClick={() => { removeAttribute(control.id, step.id); logEvent({ action: 'Delete', description: `Removed attribute ${step.code} from ${control.id}`, module: 'SOX ICFR', entity: 'Control' }); }}
            title="Remove attribute" aria-label={`Remove attribute ${step.code}`}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-canvas-border bg-canvas-elevated text-ink-400 hover:border-risk-300 hover:text-risk-600 cursor-pointer"
          ><Trash2 size={13} /></button>
        )}
      </td>
    </tr>
  );
}

/**
 * One owner value, reassignable in place. The label is the fact list's, not
 * this component's.
 *
 * At rest the name is set as text, because that is what it is: a fact about the
 * control, sitting in a list of facts that are read far more often than they
 * are changed. The bordered button it used to wear made two of the eight facts
 * shout, and broke the baseline of the line they sat on. The affordance comes
 * back on hover and focus, where it is asked for. Read-only for anyone who
 * cannot edit, and the name reads identically either way.
 */
function OwnerField({ value, options, canEdit, onChange }: { value: string; options: string[]; canEdit: boolean; onChange: (v: string) => void }) {
  if (!canEdit) return <>{value}</>;
  return (
    <Dropdown
      triggerClass="-ml-1.5 px-1.5 py-0.5 inline-flex items-center gap-1 rounded-md border border-transparent text-[0.8125rem] font-medium text-ink-800 hover:border-canvas-border hover:bg-canvas-elevated hover:text-brand-700 transition-colors cursor-pointer"
      trigger={value}
    >
      {close => (
        <>
          {options.map(o => (
            <button key={o} className={menuItem} onClick={() => { if (o !== value) onChange(o); close(); }}>
              {o === value && <Check size={12} className="text-brand-600" />}
              <span className={o === value ? 'font-semibold' : undefined}>{o}</span>
            </button>
          ))}
        </>
      )}
    </Dropdown>
  );
}

/** The open / close control for the header's detail half. It sits at the end of
 *  the activity line — where the sentence stops and the reader is already asking
 *  for the rest — and stays in that one place whether it reads more or less, so
 *  the thing that opened the detail is the thing that closes it. The chevron
 *  turns with the state; the word carries the underline, not the arrow. */
function MoreLink({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="group shrink-0 inline-flex items-center gap-0.5 font-medium text-brand-700 hover:text-brand-800 transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="underline underline-offset-2 decoration-brand-300 group-hover:decoration-brand-500 transition-colors">{open ? 'less' : 'more'}</span>
      <ChevronDown size={13} className={cn('text-brand-500 transition-transform duration-200 ease-out', open && 'rotate-180')} />
    </button>
  );
}

/** One named field, read as "name: value". Short facts that need their name
 *  said, sitting under the activity rather than in the line beside the title —
 *  a run of bare values up there made an auditor guess which word was the
 *  frequency and which the nature. */
function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-400">{label}:</span>
      <span className="font-medium text-ink-800">{value}</span>
    </span>
  );
}

export default function ControlLibraryDetail() {
  const { eng, role, selectedControlId, back, openControl, openAudit, addAttribute, updateControlMeta } = useIcfr();
  const logEvent = useAuditLog();
  const [newAttr, setNewAttr] = useState('');
  /** The header's detail half — activity and fields — open by default. */
  const [detailOpen, setDetailOpen] = useState(true);
  const [addingAttr, setAddingAttr] = useState(false);

  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold cursor-pointer">Back to Control Library</button></div>;

  // Attributes are what the control gets tested against, so writing them is the
  // auditor's — matching the store's own guard. The owner reads them; a pen here
  // would let the first line set the questions its own work is marked on.
  const canEdit = role === 'auditor';
  const detailOwners = ownersOf(control);
  // Auditor only, matching the store's own guard on updateControlMeta. Rendering
  // the dropdown for the risk owner would offer a click that silently does
  // nothing — and who answers for a control is the audit's call, not theirs.
  const canReassign = role === 'auditor';
  // Everyone already named on the engagement, in either capacity — reassignment
  // is between people who exist, not an invitation to invent one.
  const ownerNames = Array.from(new Set(eng.controls.flatMap(c => { const o = ownersOf(c); return [o.controlOwner, o.processOwner]; }))).sort();
  const { attrs, mapped } = attributeStats(control);
  const pct = attrs === 0 ? 0 : Math.round((mapped / attrs) * 100);
  const audits = auditsForControl(eng, control);
  const runs = runsForControl(eng.runs, control.id);

  const submitAttr = () => {
    const text = newAttr.trim();
    if (!text) return;
    addAttribute(control.id, text);
    logEvent({ action: 'Create', description: `Added test attribute to ${control.id}`, module: 'SOX ICFR', entity: 'Control' });
    setNewAttr(''); setAddingAttr(false);
  };

  return (
    <div>
      {/* identity header — same as the audit-level control page's, minus every
          testing/status element: no court badge, no overall-status bar, no
          working paper button, no RAG tiles. Those are testing concepts, and
          testing only happens inside an audit. Not its own card — this page is
          one continuous surface, just a rule below to close the header off. */}
      {/*
        A record header.

        Three shapes came before this one and each failed the same way. One
        wrapping 11.5px line that mixed a two-word process with a sentence of
        risk. Then a label rail down the left, which read as a form and pushed
        the audit runs below the fold. Then a full-width properties bar, which
        aligned with the page but gave eight facts eight uppercase labels — and
        those labels, all 10px and all grey, became the loudest repeated thing
        on the screen, so nothing led and the whole header sat at one tonal
        value.

        What this page is, is a record. So it is built like one. The name of the
        record leads, in the size and the face that says so. Underneath it, one
        quiet line of the facts an auditor recognises on sight — a frequency
        does not need to be labelled "frequency". Below the rule, the three
        things that DO need naming, because they are three different SOX
        artefacts and they look alike as paragraphs: the objective, the risk,
        and the activity.

        Eight labels became three. The title carries the weight.
      */}
      {/* The header is its own band: white, fenced top and bottom, running to
          both screen edges while its content stays on the page's own column.
          Negative margins only reach the container's gutter, and this container
          is centred at 1320px — so the white is painted by a layer that
          overshoots on both sides instead, and the scroll parent clips it
          (SoxClassicApp, overflow-x-hidden). */}
      <header className="relative pt-5 pb-5 mb-6">
        <div aria-hidden className="absolute inset-y-0 left-[-50vw] right-[-50vw] bg-canvas-elevated border-b border-canvas-border" />
        <div className="relative">
        {/* The objective is the headline (user ask): what this control is FOR is
            the thing worth reading first, and the control's own sentence is
            said again by every attribute in the table below. */}
        <h1 className="leadsheet-title text-[1.625rem] leading-[1.25] text-ink-900 max-w-[64ch]">{control.objective ?? control.description}</h1>

        {/* One line, no labels. Judgements are chips because they are somebody's
            call; the rest is plain text because it is just what the control is. */}
        <div className="mt-3 flex items-center gap-2.5 flex-wrap text-[0.78125rem] text-ink-500">
          <KeyControlChip control={control} canEdit={canEdit} />
          {control.riskRating && <Pill tone={control.riskRating === 'High' ? 'risk' : control.riskRating === 'Medium' ? 'mitigated' : 'draft'}>{control.riskRating} risk</Pill>}
          <span aria-hidden className="w-px h-3.5 bg-canvas-border" />
          {/* Which matrix this control answers to. A RACM is named by its
              process (Racm.tsx keys them `sox-racm-{eng}-{process}`), so the
              name is the process — labelled, because "Treasury" on its own
              reads as a location rather than as the register the control is
              scoped through. */}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-400">RACM</span>
            <span className="font-medium text-ink-800">{control.process}</span>
          </span>
          <span aria-hidden className="w-px h-3.5 bg-canvas-border" />
          {/* both names — the accountable one and the one you actually ask.
              Reassignable here rather than only at creation: people move roles
              mid-cycle, and a control still addressed to whoever held the job
              in April sends every request into an empty inbox. */}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-400">Control owner</span>
            <OwnerField value={detailOwners.controlOwner} options={ownerNames} canEdit={canReassign}
              onChange={v => { updateControlMeta(control.id, { owner: v }); logEvent({ action: 'Update', description: `Reassigned control owner for ${control.id} to ${v}`, module: 'SOX ICFR', entity: 'Control' }); }} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-ink-400">Process owner</span>
            <OwnerField value={detailOwners.processOwner} options={ownerNames} canEdit={canReassign}
              onChange={v => { updateControlMeta(control.id, { processOwner: v }); logEvent({ action: 'Update', description: `Reassigned process owner for ${control.id} to ${v}`, module: 'SOX ICFR', entity: 'Control' }); }} />
          </span>
        </div>

        {/* One paragraph under the rule: how the control is actually performed
            (user ask). The objective moved up to the headline, and the risk and
            the control's own sentence came out of the header entirely. */}
        {/* The detail half of the band. Closed it is one line that stops where
            the row does; open it runs on and the rest follows. Either way the
            toggle sits at the end of the activity text, in the one place — a
            chevron in front of the label asked the reader to find the control
            before they knew there was more to read. */}
        <div className="mt-4 text-[0.8125rem] leading-[1.7] text-ink-600">
          <p className={cn('min-w-0', !detailOpen && 'flex items-baseline')}>
            <span className="font-semibold text-ink-900 shrink-0">Control activity</span>
            <span className="text-ink-300 mx-1.5 shrink-0">·</span>
            <span className={cn('min-w-0', !detailOpen && 'truncate')}>{control.controlActivity}</span>
            <span className="shrink-0 ml-1.5"><MoreLink open={detailOpen} onClick={() => setDetailOpen(o => !o)} /></span>
          </p>
          <AnimatePresence initial={false}>
            {detailOpen && (
              <motion.div
                key="detail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                {/* The short facts, each said with its name (user ask). They used
                    to run bare beside the title — "Payments · Financial · Manual
                    · Preventive · Monthly" asks the reader to know the schema by
                    heart. */}
                <div className="mt-3.5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  <Field label="Sub-process" value={control.subProcess} />
                  <Field label="Class" value={control.clazz} />
                  <Field label="Nature" value={control.nature} />
                  <Field label="Type" value={control.type} />
                  <Field label="Frequency" value={control.frequency} />
                  <Field label="Assertions" value={control.assertions.join(', ')} />
                  {control.rootCause && <Field label="Root cause" value={control.rootCause} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </header>

      {/* audit runs — shown upfront, not behind a tab or a drawer: each audit
          this control sits in, and what THAT audit concluded (a frozen
          snapshot once superseded, live otherwise) */}
      <div className="mb-5">
        <h3 className="text-[0.8125rem] font-bold text-ink-900 mb-3">Audit runs <span className="font-normal text-ink-400">· {audits.length}</span></h3>
        {audits.length === 0 ? (
          <p className="text-[0.75rem] text-ink-400 leading-relaxed">Not in any audit yet — attributes and workflow mapping still work here; testing starts once an audit picks this control up.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {audits.map(a => {
              const row = a.archive?.conclusions.find(r => r.controlId === control.id);
              const concl = row ? row.conclusion : controlConclusion(control);
              return (
                <button key={a.id} onClick={() => { openAudit(a.id); openControl(control.id); }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 hover:border-brand-300 transition-colors cursor-pointer text-left">
                  <span className="min-w-0">
                    <span className="block text-[0.78125rem] font-semibold text-ink-800">{a.period}</span>
                    <span className="block text-[0.65625rem] text-ink-400">{ROUND_LABEL[a.round]} · {a.archive ? 'closed' : 'live'}</span>
                  </span>
                  <span className="shrink-0 flex items-center gap-1.5">
                    <ConclusionPill c={concl} />
                    <ChevronRight size={13} className="text-ink-300" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* attributes — as a table. Structure, not testing: always editable
          here regardless of any audit's progress */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[0.8125rem] font-bold text-ink-900">Attributes</h3>
          <span className={cn('text-[0.75rem] font-semibold tabular-nums', mapped === 0 ? 'text-ink-400' : 'text-ink-900')}>{mapped} of {attrs}</span>
          <span className="text-[0.75rem] text-ink-500">mapped to a workflow</span>
          {attrs > 0 && (
            <span className="meter" aria-hidden>
              <span style={{ width: `${pct}%`, background: mapped === attrs ? 'var(--color-compliant-500)' : mapped === 0 ? 'var(--color-ink-300)' : 'var(--color-evidence-500)' }} />
            </span>
          )}
          {canEdit && (
            <div className="ml-auto flex items-center gap-2">
              {addingAttr ? (
                <>
                  <input autoFocus value={newAttr} onChange={e => setNewAttr(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitAttr(); if (e.key === 'Escape') { setAddingAttr(false); setNewAttr(''); } }}
                    placeholder="e.g. Approval evidenced before the transaction posts"
                    className="w-72 h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  <button disabled={!newAttr.trim()} onClick={submitAttr} className="h-9 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 cursor-pointer">Add</button>
                </>
              ) : (
                <button onClick={() => setAddingAttr(true)} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.71875rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer">
                  <Plus size={12} /> Add attribute
                </button>
              )}
            </div>
          )}
        </div>
        {control.operating.steps.length > 0 && (
          <div className="reg-wrap">
            <table className="w-full border-collapse">
              <thead className="reg-head">
                <tr>
                  <th style={{ width: 64 }}>Code</th>
                  <th>Attribute</th>
                  <th style={{ width: 260 }}>Workflow</th>
                  <th style={{ width: 56 }} />
                </tr>
              </thead>
              <tbody>
                {control.operating.steps.map(s => <AttributeTableRow key={s.id} control={control} step={s} canEdit={canEdit} />)}
              </tbody>
            </table>
          </div>
        )}
        {control.operating.steps.length === 0 && (
          <div className="text-center py-6 text-ink-400 text-[0.75rem] rounded-xl border border-dashed border-canvas-border">No attributes yet.</div>
        )}
      </div>

      {/* testing activity — the full run history, on the page itself, not
          behind a side sheet (user ask, 30 Jul) */}
      <div>
        <h3 className="text-[0.8125rem] font-bold text-ink-900 mb-3">Testing activity</h3>
        <LastRunFact c={control} runs={runs} />
        <div className="ac-div my-3" />
        <RunHistoryList c={control} runs={runs} />
      </div>
    </div>
  );
}
