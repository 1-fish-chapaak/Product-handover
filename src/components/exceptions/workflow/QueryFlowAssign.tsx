import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GitBranch, X, Plus, Check, Trash2 } from 'lucide-react';
import { useApprovalFlows } from './approvalFlowStore';
import { queryFlows, useQueryFlows, type QueryFlowKind } from './queryFlowStore';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useToast } from '../../shared/Toast';
import WorkflowPipelineView from './WorkflowPipelineView';
import type { Persona } from './workflowTypes';

/** Query-level "Assign Approval Flow" CTA + picker.
 *
 *  Lives on the report QueryCard, before "Manage exceptions". A query can carry
 *  BOTH a Risk Owner flow and an Auditor flow; each is applied to every exception
 *  in the query when Manage Exceptions opens. */
export function QueryFlowAssign({ queryId }: { queryId: string }) {
  const [open, setOpen] = useState(false);
  const assigned = useQueryFlows(queryId);
  const ro = assigned['risk-owner'];
  const au = assigned.auditor;
  const count = (ro ? 1 : 0) + (au ? 1 : 0);

  const label = count === 0
    ? 'Assign approval flow'
    : count === 2
      ? 'RO + Auditor flows'
      : (ro?.template.name ?? au?.template.name ?? '');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={count === 0 ? 'Assign an approval flow to every exception in this query' : `Approval flows assigned${ro ? ` · Risk Owner: ${ro.template.name}` : ''}${au ? ` · Auditor: ${au.template.name}` : ''}`}
        aria-label={count === 0 ? `Assign an approval flow for ${queryId}` : `Approval flows assigned for ${queryId}`}
        className={`group inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2.5 rounded-[8px] text-[0.75rem] leading-4 font-semibold cursor-pointer transition-colors ${
          count > 0
            ? 'text-evidence-700 border border-evidence-200 bg-evidence-50 hover:border-evidence-300'
            : 'text-brand-700 border border-brand-200 hover:bg-brand-50 hover:border-brand-300'
        }`}
      >
        <GitBranch size={14} className={`shrink-0 ${count > 0 ? 'text-evidence-600' : 'text-brand-600'}`} />
        <span className="max-w-[180px] truncate">{label}</span>
        {count > 0 && <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-evidence-600 text-white text-[10px] font-semibold tabular-nums">{count}</span>}
      </button>

      <AnimatePresence>
        {open && <QueryFlowModal queryId={queryId} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function QueryFlowModal({ queryId, onClose }: { queryId: string; onClose: () => void }) {
  const flows = useApprovalFlows();
  const assigned = useQueryFlows(queryId);
  const { addToast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, onClose);

  const [side, setSide] = useState<Persona>('risk-owner');
  // Selected flow per side. Pre-fill with whatever's already assigned so the user
  // sees the current choice; otherwise empty so they're asked to select first.
  const [picks, setPicks] = useState<Record<Persona, string>>(() => ({
    'risk-owner': assigned['risk-owner']?.template.id ?? '',
    auditor: assigned.auditor?.template.id ?? '',
  }));

  const sideFlows = useMemo(() => flows.filter(f => f.persona === side), [flows, side]);
  const effectiveId = sideFlows.some(f => f.id === picks[side]) ? picks[side] : '';
  const template = sideFlows.find(f => f.id === effectiveId);

  const sideKind: QueryFlowKind = side === 'auditor' ? 'auditor' : 'risk-owner';
  const assignedRecord = assigned[sideKind];
  // Selection matches what's already saved → nothing new to assign.
  const alreadyAssignedSame = !!assignedRecord && assignedRecord.template.id === effectiveId;

  const setPick = (id: string) => setPicks(p => ({ ...p, [side]: id }));

  const assign = () => {
    if (!template || alreadyAssignedSame) return;
    queryFlows.set({
      queryId,
      kind: sideKind,
      template,
      assignedAt: new Date().toISOString(),
      assignedBy: sideKind === 'auditor' ? 'u-au-owner' : 'u-ro-owner',
    });
    addToast({
      type: 'success',
      message: `${sideKind === 'auditor' ? 'Auditor' : 'Risk Owner'} flow "${template.name}" assigned to every exception in ${queryId}.`,
    });
    // Stay open so the user can assign the other side too.
  };

  const remove = () => {
    queryFlows.clear(queryId, sideKind);
    setPicks(p => ({ ...p, [side]: '' }));
    addToast({ type: 'success', message: `${sideKind === 'auditor' ? 'Auditor' : 'Risk Owner'} flow removed from ${queryId}.` });
  };

  const SideTab = ({ p }: { p: Persona }) => {
    const k: QueryFlowKind = p === 'auditor' ? 'auditor' : 'risk-owner';
    const isAssigned = !!assigned[k];
    return (
      <button
        onClick={() => setSide(p)}
        className={`h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-[6px] cursor-pointer transition-colors ${side === p ? 'bg-canvas-elevated text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
      >
        {p === 'auditor' ? 'Auditor' : 'Risk Owner'}
        {isAssigned && <Check size={13} className="text-compliant-600" />}
      </button>
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-[80]" onClick={onClose} />
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[920px] max-w-[94vw] max-h-[90vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[90] flex flex-col"
        role="dialog" aria-modal="true" aria-label="Assign approval flow to query" tabIndex={-1}
      >
        <header className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center"><GitBranch size={16} /></div>
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">Assign Approval Flow</h2>
              <p className="text-[0.75rem] text-ink-500">Applied to every exception in <span className="font-mono text-ink-700">{queryId}</span></p>
            </div>
          </div>
          {/* Risk Owner / Auditor side toggle — a check marks a side that's assigned. */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center p-0.5 bg-[#F4F2F7] rounded-[8px]">
              <SideTab p="risk-owner" />
              <SideTab p="auditor" />
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"><X size={16} /></button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto grid md:grid-cols-2">
          {/* Left — pick the flow for the current side */}
          <div className="p-6 space-y-5 border-b md:border-b-0 md:border-r border-canvas-border">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-[12px] font-semibold text-ink-800">{side === 'auditor' ? 'Auditor' : 'Risk Owner'} approval flow</label>
                {assignedRecord && (
                  <span className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-semibold bg-compliant-50 text-compliant-700 rounded-full">
                    <Check size={10} /> Assigned
                  </span>
                )}
              </div>
              <select
                value={effectiveId}
                onChange={e => setPick(e.target.value)}
                className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-900 focus:outline-none focus:border-brand-600 cursor-pointer"
              >
                <option value="" disabled>Select an approval flow…</option>
                {sideFlows.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''} · v{t.version}</option>
                ))}
              </select>
              {sideFlows.length === 0 && (
                <p className="mt-1.5 text-[11px] text-mitigated-700">No {side === 'auditor' ? 'Auditor' : 'Risk Owner'} flows exist yet — create one to assign it here.</p>
              )}
              {assignedRecord && (
                <p className="mt-1.5 text-[11px] text-ink-500">
                  Currently assigned: <span className="font-medium text-ink-700">{assignedRecord.template.name}</span>. Pick a different flow to change it.
                </p>
              )}

              {/* Create-new entry point — jumps to Engagements → Approval Flow. */}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('app:navigate-view', { detail: { view: 'engagements', engTab: 'approval-flow' } }));
                  onClose();
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
              >
                <Plus size={14} /> Create new approval flow
              </button>
            </div>
          </div>

          {/* Right — approval chain of the selected flow (only once one is picked) */}
          <div className="p-6 space-y-5">
            <div>
              <div className="text-[12px] font-semibold text-ink-800 mb-2">Approval chain</div>
              {template ? (
                <div className="rounded-[10px] border border-canvas-border bg-[#FAFAFB] p-3">
                  <WorkflowPipelineView assignment={{ id: '', exceptionId: '', workflowId: template.id, workflowName: template.name, workflowVersion: template.version, persona: template.persona, levels: template.levels, assigneeId: '', columnPermissions: [], status: 'drafting', currentLevelIndex: -1, levelStates: template.levels.map(l => ({ levelId: l.id, status: 'pending', approvals: [] })), sendBackCount: 0, assignedBy: 'u-ro-owner', assignedAt: new Date().toISOString() }} />
                </div>
              ) : (
                <p className="text-[12px] text-ink-500">Select an approval flow on the left to preview its approval chain.</p>
              )}
            </div>

            <div>
              <div className="text-[12px] font-semibold text-ink-800 mb-2">Query</div>
              <span className="inline-flex items-center h-6 px-2.5 text-[11.5px] font-mono font-medium bg-brand-50 text-brand-700 rounded-full">{queryId}</span>
            </div>
          </div>
        </div>

        <footer className="shrink-0 px-6 py-3.5 border-t border-canvas-border flex items-center justify-between gap-2">
          {assignedRecord ? (
            <button onClick={remove} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-risk-700 hover:text-risk-800 cursor-pointer">
              <Trash2 size={13} /> Remove {side === 'auditor' ? 'Auditor' : 'Risk Owner'} flow
            </button>
          ) : (
            <span className="text-[11.5px] text-ink-500">Pick a flow, then assign it to {queryId}.</span>
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-10 px-5 text-[12.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer">Close</button>
            <button
              onClick={assign}
              disabled={!template || alreadyAssignedSame}
              className="h-10 px-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitBranch size={14} /> {alreadyAssignedSame ? 'Assigned' : assignedRecord ? 'Update flow' : 'Assign Approval Flow'}
            </button>
          </div>
        </footer>
      </motion.div>
    </>
  );
}
