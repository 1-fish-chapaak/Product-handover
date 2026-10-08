import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Pencil, Trash2, Star, ArrowLeft, AlertTriangle } from 'lucide-react';
import type { Persona, WorkflowTemplate } from '../exceptions/workflow/workflowTypes';
import { approvalFlows, useApprovalFlows } from '../exceptions/workflow/approvalFlowStore';
import WorkflowPipelineBuilder from '../exceptions/workflow/WorkflowPipelineBuilder';
import { userName } from '../exceptions/workflow/workflowData';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';

/* ─── Approval Flow tab ─────────────────────────────────────────────────────
 * The Engagement Library's view of the shared approval-flow store, in the
 * Control Library's grammar: segmented side switch + one primary action on
 * the toolbar, flows as entry cards with quiet icon actions. Same store and
 * pipeline builder as the Exceptions module's WorkflowConfigurator, so
 * create / edit / delete / default behave identically.
 * ──────────────────────────────────────────────────────────────────────── */

const PERSONA_LABEL: Record<Persona, string> = { 'risk-owner': 'Risk Owner', auditor: 'Auditor' };
const SIDES: Persona[] = ['risk-owner', 'auditor'];

function blankTemplate(persona: Persona, createdBy: string): WorkflowTemplate {
  return {
    id: `wf-${Date.now()}`,
    name: '',
    persona,
    isDefault: false,
    version: 1,
    createdBy,
    createdAt: new Date().toISOString(),
    levels: [{ id: `lvl-${Date.now()}`, name: 'L1 — Review', assigneeIds: [], mode: 'any', slaHours: 48, allowSendBack: true }],
  };
}

export default function ApprovalFlowsPanel({ role, onRoleChange }: { role: Persona; onRoleChange: (role: Persona) => void }) {
  const templates = useApprovalFlows();
  const { addToast } = useToast();
  const currentUserId = role === 'auditor' ? 'u-au-owner' : 'u-ro-owner';
  // RBAC: a side only sees/edits its own flows.
  const mine = templates.filter(t => t.persona === role);
  const [draft, setDraft] = useState<WorkflowTemplate | null>(null);

  if (draft) return <FlowEditor draft={draft} role={role} isEdit={templates.some(t => t.id === draft.id)} onChange={setDraft} onClose={() => setDraft(null)} onSave={() => {
    approvalFlows.upsert(draft);
    if (draft.isDefault) approvalFlows.setDefault(draft.id, role);
    addToast({ type: 'success', message: `Approval flow "${draft.name.trim()}" saved.` });
    setDraft(null);
  }} />;

  return (
    <div>
      {/* Toolbar — side switch left, the tab's one primary action right */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-7">
        <div role="tablist" aria-label="Approval side" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-paper-100">
          {SIDES.map(p => (
            <button
              key={p}
              role="tab"
              aria-selected={role === p}
              onClick={() => onRoleChange(p)}
              className={`h-7 px-3 rounded-md text-[0.75rem] font-medium cursor-pointer transition-colors ${role === p ? 'bg-canvas-elevated text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
            >
              {PERSONA_LABEL[p]} <span className="ml-0.5 text-ink-400 tabular-nums">{templates.filter(t => t.persona === p).length}</span>
            </button>
          ))}
        </div>
        <p className="text-[0.8125rem] text-ink-500">Reusable approval chains for exceptions sent for approval.</p>
        <Button variant="primary" className="ml-auto" leftIcon={<Plus size={14} />} onClick={() => setDraft(blankTemplate(role, currentUserId))}>
          Create flow
        </Button>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-xl border border-dashed border-canvas-border px-6 py-16 text-center">
          <p className="text-[0.875rem] font-medium text-ink-800">No {PERSONA_LABEL[role]} approval flows yet</p>
          <p className="mt-1 text-[0.8125rem] text-ink-500">Create one to start delegating.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {mine.map((t, i) => {
            const tone = FLOW_TONES[i % FLOW_TONES.length]!;
            const approvers = new Set(t.levels.flatMap(l => l.assigneeIds)).size;
            const slaTotal = t.levels.reduce((n, l) => n + l.slaHours, 0);
            const sendBack = t.levels.filter(l => l.allowSendBack).length;
            return (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.03 }}
                className="group relative flex flex-col rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden hover:border-brand-200 hover:shadow-[0_6px_20px_-12px_rgb(38_6_74_/_0.25)] transition-[border-color,box-shadow]"
              >
                {/* The Control Library process card's head stripe */}
                <span className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} aria-hidden />
                <div className="flex-1 flex flex-col px-4 pt-4 pb-4">
                  {/* The level count lives in the stats below; this corner is where the actions appear on hover. */}
                  <span className={`font-mono text-[0.75rem] font-bold tracking-wide ${tone.text}`}>v{t.version}</span>
                  <h3 className="mt-1.5 text-[0.9375rem] font-semibold leading-snug text-ink-900 line-clamp-2">
                    <button type="button" onClick={() => setDraft(t)} className="text-left cursor-pointer hover:text-brand-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded">
                      {t.name}
                    </button>
                  </h3>
                  <p className="mt-1 text-[0.75rem] leading-snug text-ink-500">
                    {PERSONA_LABEL[t.persona]} flow · created by {userName(t.createdBy)}
                    {t.isDefault && <span className="ml-1.5 inline-flex items-center gap-1 text-mitigated-700"><Star size={10} className="fill-mitigated-500 text-mitigated-500" aria-hidden />Default</span>}
                  </p>

                  {/* Where the process card shows its coverage, the flow shows its chain */}
                  <p className="mt-4 text-[0.6875rem] text-ink-400">Approval chain</p>
                  <ol className="mt-1.5 space-y-1" aria-label="Approval levels">
                    {t.levels.map((l, li) => (
                      <li key={l.id} className="flex items-center gap-2.5 text-[0.75rem] text-ink-800">
                        <span className={`shrink-0 w-6 font-mono text-[0.75rem] font-bold ${tone.text}`}>L{li + 1}</span>
                        <span className="min-w-0 truncate">{l.name.replace(/^L\d+\s*—\s*/, '')}</span>
                        <span className="ml-auto shrink-0 text-[0.6875rem] text-ink-400 tabular-nums">{l.slaHours} h</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-auto pt-4">
                    <div className="border-t border-canvas-border pt-3 grid grid-cols-2 gap-y-1.5 text-[0.71875rem] text-ink-500">
                      <Stat n={t.levels.length} label="Levels" className="text-ink-900" />
                      <Stat n={approvers} label="Approvers" className="text-compliant-700" />
                      <Stat n={`${slaTotal}h`} label="Total SLA" className="text-evidence-700" />
                      <Stat n={sendBack} label="Can send back" className="text-mitigated-700" />
                    </div>
                  </div>
                </div>
                {/* Quiet actions, top right, as on the library's cards */}
                <div className="absolute top-3.5 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-canvas-elevated rounded-md">
                  {!t.isDefault && <IconBtn label="Set as default" onClick={() => approvalFlows.setDefault(t.id, role)}><Star size={13} /></IconBtn>}
                  <IconBtn label="Edit flow" onClick={() => setDraft(t)}><Pencil size={13} /></IconBtn>
                  <IconBtn label="Delete flow" danger onClick={() => approvalFlows.remove(t.id)}><Trash2 size={13} /></IconBtn>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Head-stripe tones, in turn — the process cards' palette, from tokens. */
const FLOW_TONES = [
  { bar: 'bg-brand-600', text: 'text-brand-600' },
  { bar: 'bg-compliant-500', text: 'text-compliant-600' },
  { bar: 'bg-evidence-500', text: 'text-evidence-600' },
  { bar: 'bg-mitigated-400', text: 'text-mitigated-600' },
];

/** The process card's number-then-label stat. */
function Stat({ n, label, className }: { n: number | string; label: string; className: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <b className={`font-mono text-[0.8125rem] font-bold tabular-nums ${className}`}>{n}</b>{label}
    </span>
  );
}

/** Control Library's quiet icon action. */
function IconBtn({ label, onClick, children, danger }: {
  label: string; onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`size-7 rounded-md flex items-center justify-center text-ink-400 cursor-pointer transition-colors ${danger ? 'hover:bg-risk-50 hover:text-risk-700' : 'hover:bg-paper-100 hover:text-ink-800'}`}
    >
      {children}
    </button>
  );
}

/** Create / edit a flow. Editing an existing flow creates a new version. */
function FlowEditor({ draft, role, isEdit, onChange, onClose, onSave }: {
  draft: WorkflowTemplate; role: Persona; isEdit: boolean;
  onChange: (d: WorkflowTemplate) => void; onClose: () => void; onSave: () => void;
}) {
  const nameMissing = !draft.name.trim();
  const levelMissing = draft.levels.some(l => l.assigneeIds.length === 0);
  const canSave = !nameMissing && !levelMissing && draft.levels.length > 0;
  return (
    <div className="max-w-[760px]">
      <button onClick={onClose} className="inline-flex items-center gap-1.5 text-[0.75rem] text-ink-500 hover:text-brand-700 mb-4 cursor-pointer">
        <ArrowLeft size={14} /> Back to flows
      </button>
      <div className="rounded-xl border border-canvas-border bg-canvas-elevated px-6 py-5">
        <h3 className="text-[1.125rem] font-semibold text-ink-900">{isEdit ? 'Edit' : 'New'} {PERSONA_LABEL[role]} approval flow</h3>
        <p className="mt-0.5 text-[0.8125rem] text-ink-500">Editing an existing flow creates a new version — in-flight assignments keep their original one.</p>

        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="flow-name" className="text-[0.75rem] font-semibold text-ink-800 mb-1.5 block">Flow name <span className="text-risk">*</span></label>
            <input
              id="flow-name"
              value={draft.name}
              onChange={e => onChange({ ...draft, name: e.target.value })}
              placeholder="e.g. P2P Quarterly Review – RO Flow"
              className="w-full h-9 px-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-300"
            />
          </div>

          <p className="text-[0.75rem] text-ink-500">
            Owner side <span className="font-medium text-ink-800">{PERSONA_LABEL[role]}</span>
            <span className="text-ink-400"> · attaches to the {role === 'auditor' ? 'auditor review' : 'risk-owner classification'} side</span>
          </p>

          <div>
            <label className="text-[0.75rem] font-semibold text-ink-800 mb-2 block">Approval levels</label>
            <WorkflowPipelineBuilder levels={draft.levels} persona={role} onChange={levels => onChange({ ...draft, levels })} />
            {levelMissing && <p className="mt-2 text-[0.75rem] text-risk-700 inline-flex items-center gap-1"><AlertTriangle size={12} aria-hidden /> Every level needs at least one approver.</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={draft.isDefault} onChange={e => onChange({ ...draft, isDefault: e.target.checked })} className="w-4 h-4 accent-brand-600 cursor-pointer" />
            <span className="text-[0.8125rem] text-ink-700">Make this the default flow for new {PERSONA_LABEL[role]} assignments</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-canvas-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={() => { if (canSave) onSave(); }}>Save flow</Button>
        </div>
      </div>
    </div>
  );
}
