import { Plus, Trash2, ListChecks, AlertTriangle } from 'lucide-react';
import type {
  AtrObservation, AtrActionPlan, AtrRisk, AtrClassification, AtrObservationStatus, AtrActionStatus,
} from './atrTypes';

const RISK_OPTS: AtrRisk[] = ['High', 'Medium', 'Low'];
const CLASS_OPTS: AtrClassification[] = ['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance'];
const OBS_STATUS_OPTS: AtrObservationStatus[] = ['Open', 'In Progress', 'Closed', 'Overdue'];
const ACTION_STATUS_OPTS: AtrActionStatus[] = ['Pending', 'Partially Implemented', 'Implemented', 'Overdue', 'Not Due'];

const INPUT =
  'w-full px-3 py-2 rounded-[8px] border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15 transition-colors';
const LABEL = 'text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500 mb-1 block';

function emptyObservation(): AtrObservation {
  return { title: '', description: '', risk: 'Medium', status: 'Open', actionPlans: [{ text: '' }] };
}
function emptyActionPlan(): AtrActionPlan {
  return { text: '', status: 'Pending' };
}

/**
 * Manual edit step for the ATR builder — an editable list of actionable items
 * (observations + their management action plans). Fully controlled: it never
 * holds its own copy of the data, so Source-derived or upload-extracted items
 * flow straight through and back to the wizard.
 */
export default function AtrItemsEditor({ observations, onChange }: {
  observations: AtrObservation[];
  onChange: (next: AtrObservation[]) => void;
}) {
  const patchObs = (idx: number, patch: Partial<AtrObservation>) =>
    onChange(observations.map((o, i) => (i === idx ? { ...o, ...patch } : o)));

  const removeObs = (idx: number) => onChange(observations.filter((_, i) => i !== idx));
  // Require every existing card to have a title before adding another, so users
  // can't accumulate (and submit) a stack of blank observations.
  const canAdd = observations.every(o => o.title.trim());
  const addObs = () => { if (canAdd) onChange([...observations, emptyObservation()]); };

  const patchPlan = (oIdx: number, pIdx: number, patch: Partial<AtrActionPlan>) =>
    patchObs(oIdx, { actionPlans: observations[oIdx].actionPlans.map((p, i) => (i === pIdx ? { ...p, ...patch } : p)) });
  const addPlan = (oIdx: number) =>
    patchObs(oIdx, { actionPlans: [...observations[oIdx].actionPlans, emptyActionPlan()] });
  const removePlan = (oIdx: number, pIdx: number) =>
    patchObs(oIdx, { actionPlans: observations[oIdx].actionPlans.filter((_, i) => i !== pIdx) });

  const totalPlans = observations.reduce((n, o) => n + o.actionPlans.length, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[0.75rem] text-ink-500">
          <ListChecks size={14} className="text-brand-600" />
          <span><span className="font-semibold text-ink-700">{observations.length}</span> observation{observations.length === 1 ? '' : 's'} · <span className="font-semibold text-ink-700">{totalPlans}</span> action plan{totalPlans === 1 ? '' : 's'}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {!canAdd && <span className="text-[0.625rem] text-ink-500">Add a title to the open card first</span>}
          <button
            onClick={addObs}
            disabled={!canAdd}
            title={canAdd ? 'Add another observation' : 'Add a title to the current observation first'}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-[8px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> Add observation
          </button>
        </div>
      </div>

      {observations.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-14 text-center border border-dashed border-canvas-border rounded-[12px]">
          <AlertTriangle size={20} className="text-ink-400" />
          <div className="text-[0.8125rem] font-medium text-ink-700">No actionable items yet</div>
          <button onClick={addObs} className="text-[0.75rem] text-brand-700 font-semibold hover:underline cursor-pointer">Add the first observation</button>
        </div>
      )}

      {observations.map((obs, oIdx) => (
        <div key={oIdx} className="rounded-[12px] border border-canvas-border bg-canvas overflow-hidden">
          {/* Observation header */}
          <div className="flex items-start gap-3 px-4 pt-3.5 pb-3 border-b border-canvas-border bg-canvas-elevated">
            <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-brand-50 text-brand-700 text-[0.75rem] font-bold flex items-center justify-center">{oIdx + 1}</span>
            <input
              value={obs.title}
              onChange={e => patchObs(oIdx, { title: e.target.value })}
              placeholder="Observation title"
              className="flex-1 bg-transparent text-[0.875rem] font-semibold text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
            <button
              onClick={() => removeObs(oIdx)}
              className="shrink-0 w-7 h-7 rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 flex items-center justify-center cursor-pointer"
              aria-label="Remove observation"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Meta row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={LABEL}>Process / Area</label>
                <input value={obs.process ?? ''} onChange={e => patchObs(oIdx, { process: e.target.value || undefined })} placeholder="e.g. Procurement" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Risk</label>
                <select value={obs.risk ?? ''} onChange={e => patchObs(oIdx, { risk: (e.target.value || undefined) as AtrRisk })} className={INPUT}>
                  <option value="">—</option>
                  {RISK_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Classification</label>
                <select value={obs.classification ?? ''} onChange={e => patchObs(oIdx, { classification: (e.target.value || undefined) as AtrClassification })} className={INPUT}>
                  <option value="">—</option>
                  {CLASS_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select value={obs.status ?? ''} onChange={e => patchObs(oIdx, { status: (e.target.value || undefined) as AtrObservationStatus })} className={INPUT}>
                  <option value="">—</option>
                  {OBS_STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Description</label>
              <textarea value={obs.description ?? ''} onChange={e => patchObs(oIdx, { description: e.target.value || undefined })} placeholder="What was observed / the issue." rows={2} className={`${INPUT} resize-y`} />
            </div>
            <div>
              <label className={LABEL}>Risk summary</label>
              <textarea value={obs.riskSummary ?? ''} onChange={e => patchObs(oIdx, { riskSummary: e.target.value || undefined })} placeholder="The risk this exposes." rows={2} className={`${INPUT} resize-y`} />
            </div>

            {/* Action plans */}
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">Management action plans</span>
                <button onClick={() => addPlan(oIdx)} className="inline-flex items-center gap-1 h-7 px-2.5 text-[0.6875rem] font-semibold text-brand-700 hover:bg-brand-50 rounded-[7px] transition-colors cursor-pointer">
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2.5">
                {obs.actionPlans.map((plan, pIdx) => (
                  <div key={pIdx} className="rounded-[10px] border border-canvas-border bg-canvas-elevated p-3 space-y-2.5">
                    <div className="flex items-start gap-2">
                      <textarea
                        value={plan.text}
                        onChange={e => patchPlan(oIdx, pIdx, { text: e.target.value })}
                        placeholder="Recommendation / management action plan"
                        rows={2}
                        className={`${INPUT} resize-y`}
                      />
                      <button onClick={() => removePlan(oIdx, pIdx)} className="shrink-0 w-7 h-7 mt-0.5 rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 flex items-center justify-center cursor-pointer" aria-label="Remove action plan">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={LABEL}>Due date</label>
                        <input value={plan.dueDate ?? ''} onChange={e => patchPlan(oIdx, pIdx, { dueDate: e.target.value || undefined })} placeholder="e.g. 30 Jun 2026" className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Action status</label>
                        <select value={plan.status ?? ''} onChange={e => patchPlan(oIdx, pIdx, { status: (e.target.value || undefined) as AtrActionStatus })} className={INPUT}>
                          <option value="">—</option>
                          {ACTION_STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL}>Action taken</label>
                      <textarea value={plan.actionTaken ?? ''} onChange={e => patchPlan(oIdx, pIdx, { actionTaken: e.target.value || undefined })} placeholder="What was actually done to remediate." rows={2} className={`${INPUT} resize-y`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={LABEL}>Evidence</label>
                        <input value={plan.evidence ?? ''} onChange={e => patchPlan(oIdx, pIdx, { evidence: e.target.value || undefined })} placeholder="Supporting documents." className={INPUT} />
                      </div>
                      <div>
                        <label className={LABEL}>Verification</label>
                        <input value={plan.verification ?? ''} onChange={e => patchPlan(oIdx, pIdx, { verification: e.target.value || undefined })} placeholder="Checker / auditor verification." className={INPUT} />
                      </div>
                    </div>
                  </div>
                ))}
                {obs.actionPlans.length === 0 && (
                  <button onClick={() => addPlan(oIdx)} className="w-full py-2.5 text-[0.75rem] font-medium text-ink-500 border border-dashed border-canvas-border rounded-[10px] hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer">
                    + Add an action plan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
