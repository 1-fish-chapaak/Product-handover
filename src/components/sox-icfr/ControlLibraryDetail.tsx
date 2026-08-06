import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import { useIcfr } from './store';
import { useAuditLog } from '../../context/AdminDataContext';
import { controlConclusion } from './helpers';
import { ownersOf } from './auditScope';
import { ConclusionPill, NatureChip } from './parts';
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

/** One owner line, reassignable in place. Read-only for anyone who can't edit,
 *  so the name still reads the same — it just stops being a button. */
function OwnerField({ label, value, options, canEdit, onChange }: { label: string; value: string; options: string[]; canEdit: boolean; onChange: (v: string) => void }) {
  if (!canEdit) return <span className="inline-flex items-center gap-1"><span className="text-ink-400">{label}</span> · <b className="font-semibold text-ink-700">{value}</b></span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink-400">{label}</span> ·
      <Dropdown trigger={<span className="inline-flex items-center gap-1 font-semibold text-ink-700 hover:text-brand-700"><b>{value}</b><ChevronDown size={12} className="text-ink-400" /></span>}>
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
    </span>
  );
}

export default function ControlLibraryDetail() {
  const { eng, role, selectedControlId, back, openControl, openAudit, addAttribute, updateControlMeta } = useIcfr();
  const logEvent = useAuditLog();
  const [newAttr, setNewAttr] = useState('');
  const [addingAttr, setAddingAttr] = useState(false);

  const control = eng.controls.find(c => c.id === selectedControlId);
  if (!control) return <div className="text-ink-500">Control not found. <button onClick={back} className="text-brand-700 font-semibold cursor-pointer">Back to Control Library</button></div>;

  const canEdit = role === 'auditor' || role === 'risk-owner';
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
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <KeyControlChip control={control} canEdit={canEdit} />
              {control.clazz && <Pill tone="draft">{control.clazz}</Pill>}
              <NatureChip nature={control.nature} /><Pill tone="draft">{control.type}</Pill><Pill tone="draft">{control.frequency}</Pill>
              {control.riskRating && <Pill tone={control.riskRating === 'High' ? 'risk' : control.riskRating === 'Medium' ? 'mitigated' : 'draft'}>{control.riskRating} risk</Pill>}
              <span className="text-[0.6875rem] text-ink-400 font-mono">{control.id}</span>
            </div>
            <h1 className="leadsheet-title text-[1.25rem] text-ink-900 leading-snug max-w-[640px]">{control.objective ?? control.description}</h1>
            {control.objective && (
              <p className="text-[0.78125rem] text-ink-500 mt-1.5 leading-relaxed">
                <b className="text-ink-700 font-semibold">Control —</b> {control.description}
              </p>
            )}
            {control.controlActivity && (
              <p className="text-[0.78125rem] text-ink-500 mt-1.5 leading-relaxed">
                <b className="text-ink-700 font-semibold">Control activity —</b> {control.controlActivity}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-[0.71875rem] text-ink-500">
              <span><span className="text-ink-400">Process</span> · {control.process} / {control.subProcess}</span>
              {/* both names — the accountable one and the one you actually ask.
                  Reassignable here rather than only at creation: people move
                  roles mid-cycle, and a control still addressed to whoever held
                  the job in April sends every request into an empty inbox. */}
              <OwnerField label="Control owner" value={detailOwners.controlOwner} options={ownerNames} canEdit={canReassign}
                onChange={v => { updateControlMeta(control.id, { owner: v }); logEvent({ action: 'Update', description: `Reassigned control owner for ${control.id} to ${v}`, module: 'SOX ICFR', entity: 'Control' }); }} />
              <OwnerField label="Process owner" value={detailOwners.processOwner} options={ownerNames} canEdit={canReassign}
                onChange={v => { updateControlMeta(control.id, { processOwner: v }); logEvent({ action: 'Update', description: `Reassigned process owner for ${control.id} to ${v}`, module: 'SOX ICFR', entity: 'Control' }); }} />
              <span><span className="text-ink-400">Risk {control.riskId}</span> · {control.riskDescription}</span>
              <span><span className="text-ink-400">Assertions</span> · {control.assertions.join(', ')}</span>
              {control.rootCause && <span><span className="text-ink-400">Root cause</span> · {control.rootCause}</span>}
            </div>
          </div>
        </div>
        <div className="ac-div mt-3" />
      </div>

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
