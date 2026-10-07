import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, CalendarClock, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import ApprovalFlowCard from './ApprovalFlowCard';
import EscalationMatrixAdmin from '../reports/atr-upload/components/EscalationMatrixAdmin';
import {
  escalationMatrices, useEscalationMatrices, describeMatrix, chainLine, approvalChain,
  type EscalationMatrixDef,
} from '../../data/escalationMatrixStore';
import { useAuditLog } from '../../context/AdminDataContext';
import ConfirmationModal from '../shared/ConfirmationModal';

// ─── Administration → Approval & Escalation Matrix ───
// Two halves of the same question — who signs this off, and who gets chased
// when it slips.
//
// Approval flows say who approves a risk owner's work, and in what order. A
// flow names the risk owners it covers, so assigning an observation to one of
// them starts their chain without anyone picking it.
//
// Escalation matrices say who gets chased when an action plan runs late. One
// matrix was never enough: an observation about vendor master data and one
// about privileged access are chased by different people on different clocks.
// They are named, owned by a department, and the auditor ties one to an
// observation (or to a single action plan) from the report's close-out panel.

const FIELD = 'w-full h-9 px-2.5 rounded-md border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10';
const LABEL = 'block text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 mb-1';
const ICON_BTN = 'w-7 h-7 rounded-md text-ink-400 hover:text-brand-700 hover:bg-brand-50 flex items-center justify-center cursor-pointer transition-colors';

export default function EscalationMatrixSection() {
  const list = useEscalationMatrices();
  const logEvent = useAuditLog();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDept, setDraftDept] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  // Approval-flow edits are held here until the screen's Save commits them, so
  // one button covers both halves of the matrix.
  const [approvalDraft, setApprovalDraft] = useState<Partial<EscalationMatrixDef> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EscalationMatrixDef | null>(null);

  const open = editing ? list.find(m => m.id === editing) : undefined;
  const openDraft = open ? { ...open, ...(approvalDraft ?? {}) } : undefined;

  const log = (action: 'Create' | 'Update' | 'Delete', description: string) =>
    logEvent({ action, description, module: 'Admin', entity: 'Escalation Matrix' });

  const startCreate = () => { setCreating(true); setRenaming(null); setDraftName(''); setDraftDept(''); };

  const commitCreate = () => {
    if (!draftName.trim()) return;
    const def = escalationMatrices.create(draftName, draftDept);
    log('Create', `Created the escalation matrix “${def.name}”`);
    setCreating(false);
    setEditing(def.id);
  };

  const commitRename = (m: EscalationMatrixDef) => {
    if (!draftName.trim()) { setRenaming(null); return; }
    escalationMatrices.update(m.id, { name: draftName.trim(), department: draftDept.trim() || undefined });
    log('Update', `Renamed an escalation matrix to “${draftName.trim()}”`);
    setRenaming(null);
  };

  // ── One policy, one screen: the approval chain above the chasing cadence ──
  if (open) {
    return (
      <div className="h-full min-h-0">
        <EscalationMatrixAdmin
          key={open.id}
          value={open.set}
          header={(
            <div className="flex items-center gap-2.5 min-w-0">
              <button type="button" onClick={() => { setEditing(null); setApprovalDraft(null); }} aria-label="Back to the matrix list" className={`${ICON_BTN} shrink-0`}>
                <ArrowLeft size={15} />
              </button>
              <div className="min-w-0">
                <h2 className="text-[0.9375rem] font-semibold text-ink-900 leading-tight truncate">{open.name}</h2>
                <p className="text-[0.71875rem] text-ink-500 truncate">
                  {open.department ? `${open.department} · ` : ''}{describeMatrix(open)}
                </p>
              </div>
            </div>
          )}
          intro={<ApprovalFlowCard policy={openDraft!} onChange={patch => setApprovalDraft(d => ({ ...d, ...patch }))} />}
          introDirty={!!approvalDraft}
          onDiscardIntro={() => setApprovalDraft(null)}
          onSaveIntro={() => {
            if (!approvalDraft) return;
            escalationMatrices.update(open.id, approvalDraft);
            log('Update', `Updated the approval flow on “${open.name}”`);
            setApprovalDraft(null);
          }}
          onSave={next => {
            escalationMatrices.update(open.id, { set: next });
            log('Update', `Updated the escalation cadence on “${open.name}”`);
          }}
        />
      </div>
    );
  }

  // ── The policy list ──
  return (
    <div className="max-w-[920px]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-[0.8125rem] text-ink-600 leading-relaxed max-w-[560px]">
          One matrix per department, answering two questions: who approves the work, and who gets chased
          if an action plan runs late. Tie a matrix to an observation — or to a single action plan — and
          both start working.
        </p>
        <button
          type="button"
          onClick={startCreate}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 cursor-pointer transition-colors"
        >
          <Plus size={13} aria-hidden="true" /> New Matrix
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/40 px-4 py-3.5 mb-3">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={LABEL} htmlFor="esc-name">Name <span className="text-risk-600">*</span></label>
              <input id="esc-name" autoFocus value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="e.g. Logistics & Dispatch" className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="esc-dept">Department</label>
              <input id="esc-dept" value={draftDept} onChange={e => setDraftDept(e.target.value)} placeholder="e.g. Supply Chain" className={FIELD} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="h-8 px-3 rounded-md border border-canvas-border text-ink-700 text-[0.75rem] font-semibold hover:bg-canvas cursor-pointer transition-colors">Cancel</button>
            <button type="button" onClick={commitCreate} disabled={!draftName.trim()} className="h-8 px-3 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">Create &amp; configure</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-canvas-border overflow-hidden">
        {list.length === 0 && (
          <p className="px-4 py-6 text-[0.8125rem] text-ink-500 text-center">No escalation matrices yet.</p>
        )}
        {list.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: Math.min(i, 10) * 0.03, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 px-4 py-3 border-b border-canvas-border last:border-b-0 hover:bg-canvas/60 transition-colors"
          >
            <span className="shrink-0 w-8 h-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center">
              <CalendarClock size={15} aria-hidden="true" />
            </span>

            {renaming === m.id ? (
              <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                <input autoFocus value={draftName} onChange={e => setDraftName(e.target.value)} aria-label="Matrix name"
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(m); if (e.key === 'Escape') setRenaming(null); }} className={FIELD} />
                <input value={draftDept} onChange={e => setDraftDept(e.target.value)} aria-label="Department" placeholder="Department"
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(m); if (e.key === 'Escape') setRenaming(null); }} className={FIELD} />
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(m.id)} className="flex-1 min-w-0 text-left cursor-pointer">
                <span className="block text-[0.8125rem] font-semibold text-ink-900">{m.name}</span>
                <span className="block text-[0.71875rem] text-ink-500 truncate">
                  {m.department ? `${m.department} · ` : ''}
                  {approvalChain(m).length > 0 ? `approved by ${chainLine(m)} · ` : 'single auditor sign-off · '}
                  {describeMatrix(m)}
                </span>

              </button>
            )}

            <div className="shrink-0 flex items-center gap-0.5">
              {renaming === m.id ? (
                <>
                  <button type="button" onClick={() => setRenaming(null)} className="h-7 px-2.5 rounded-md text-ink-600 text-[0.71875rem] font-semibold hover:bg-canvas cursor-pointer">Cancel</button>
                  <button type="button" onClick={() => commitRename(m)} className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.71875rem] font-semibold hover:bg-brand-700 cursor-pointer">Save</button>
                </>
              ) : (
                <>
                  <button type="button" aria-label={`Rename ${m.name}`} title="Rename"
                    onClick={() => { setRenaming(m.id); setCreating(false); setDraftName(m.name); setDraftDept(m.department ?? ''); }}
                    className={ICON_BTN}><Pencil size={13} /></button>
                  <button type="button" aria-label={`Duplicate ${m.name}`} title="Duplicate"
                    onClick={() => { const c = escalationMatrices.duplicate(m.id); if (c) log('Create', `Duplicated the escalation matrix “${m.name}” as “${c.name}”`); }}
                    className={ICON_BTN}><Copy size={13} /></button>
                  <button type="button" aria-label={`Delete ${m.name}`} title="Delete"
                    onClick={() => setConfirmDelete(m)}
                    className="w-7 h-7 rounded-md text-ink-400 hover:text-risk-700 hover:bg-risk-50 flex items-center justify-center cursor-pointer transition-colors"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <ConfirmationModal
        open={!!confirmDelete}
        title="Delete this escalation matrix?"
        description={confirmDelete
          ? `“${confirmDelete.name}” will no longer approve or chase anything. Observations already pointing at it fall back to the house policy.`
          : ''}
        confirmLabel="Delete policy"
        tone="destructive"
        onConfirm={() => {
          if (confirmDelete) {
            escalationMatrices.remove(confirmDelete.id);
            log('Delete', `Deleted the escalation matrix “${confirmDelete.name}”`);
          }
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
