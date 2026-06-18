import { useState } from 'react';
import { Plus, Pencil, Trash2, Star, Check, ArrowLeft, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { Persona, WorkflowTemplate } from './workflowTypes';
import { useWorkflow } from './WorkflowContext';
import WorkflowPipelineBuilder from './WorkflowPipelineBuilder';
import { userName } from './workflowData';
import { useToast } from '../../shared/Toast';

const PERSONA_LABEL: Record<Persona, string> = { 'risk-owner': 'Risk Owner', auditor: 'Auditor' };

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

export default function WorkflowConfigurator({ role }: { role: Persona }) {
  const { templates, upsertTemplate, deleteTemplate, setDefaultTemplate, currentUserId } = useWorkflow();
  const { addToast } = useToast();
  // RBAC: a persona only sees/edits its own workflows.
  const mine = templates.filter(t => t.persona === role);
  const [draft, setDraft] = useState<WorkflowTemplate | null>(null);

  if (draft) {
    const nameMissing = !draft.name.trim();
    const levelMissing = draft.levels.some(l => l.assigneeIds.length === 0);
    const canSave = !nameMissing && !levelMissing && draft.levels.length > 0;
    return (
      <div className="bg-canvas-elevated border border-canvas-border rounded-[12px] p-6 max-w-[760px]">
        <button onClick={() => setDraft(null)} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500 hover:text-brand-700 mb-4 cursor-pointer"><ArrowLeft size={14} /> Back to routes</button>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={16} className="text-brand-700" />
          <h3 className="text-[16px] font-semibold text-ink-900">{templates.some(t => t.id === draft.id) ? 'Edit' : 'New'} {PERSONA_LABEL[role]} Approval Route</h3>
        </div>
        <p className="text-[12.5px] text-ink-500 mb-5">Define a reusable approval chain. Editing an existing route creates a new version — in-flight assignments keep their original version.</p>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-ink-800 mb-1.5 block">Route Name <span className="text-risk">*</span></label>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. P2P Quarterly Review – RO Route" className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-900 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" />
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] bg-[#FAFAFB] border border-canvas-border">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">Owner persona</span>
            <span className="inline-flex items-center h-6 px-2.5 text-[11.5px] font-semibold bg-brand-50 text-brand-700 rounded-full">{PERSONA_LABEL[role]}</span>
            <span className="text-[11px] text-ink-400">· attaches to the {role === 'auditor' ? 'auditor review' : 'risk-owner classification'} side</span>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-ink-800 mb-2 block">Approval Levels</label>
            <WorkflowPipelineBuilder levels={draft.levels} persona={role} onChange={levels => setDraft({ ...draft, levels })} />
            {levelMissing && <p className="mt-2 text-[11.5px] text-risk-700 inline-flex items-center gap-1"><AlertTriangle size={12} /> Every level needs at least one approver.</p>}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={draft.isDefault} onChange={e => setDraft({ ...draft, isDefault: e.target.checked })} className="w-4 h-4 accent-brand-600 cursor-pointer" />
            <span className="text-[12.5px] text-ink-700">Make this the default route for new {PERSONA_LABEL[role]} assignments</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-canvas-border">
          <button onClick={() => setDraft(null)} className="h-9 px-4 text-[12.5px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:border-brand-200 cursor-pointer">Cancel</button>
          <button
            onClick={() => {
              if (!canSave) return;
              upsertTemplate(draft);
              if (draft.isDefault) setDefaultTemplate(draft.id, role);
              addToast({ type: 'success', message: `Approval route "${draft.name.trim()}" saved.` });
              setDraft(null);
            }}
            disabled={!canSave}
            className="h-9 px-5 text-[12.5px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Route
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-ink-900">{PERSONA_LABEL[role]} Approval Routes</h3>
          <p className="text-[12.5px] text-ink-500">Reusable approval chains for {role === 'auditor' ? 'auditor review' : 'risk-owner'} assignments. Switch the role toggle to manage the other side.</p>
        </div>
        <button onClick={() => setDraft(blankTemplate(role, currentUserId))} className="h-9 px-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer"><Plus size={14} /> Create Route</button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {mine.map(t => (
          <div key={t.id} className="border border-canvas-border rounded-[12px] p-4 bg-canvas-elevated">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-[13.5px] font-semibold text-ink-900">{t.name}</h4>
                  {t.isDefault && <span className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-semibold bg-brand-50 text-brand-700 rounded-full"><Star size={9} /> Default</span>}
                  <span className="text-[10px] text-ink-400">v{t.version}</span>
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5">{t.levels.length} level{t.levels.length === 1 ? '' : 's'} · created by {userName(t.createdBy)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!t.isDefault && <button onClick={() => setDefaultTemplate(t.id, role)} title="Set as default" className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer"><Star size={13} /></button>}
                <button onClick={() => setDraft(t)} title="Edit" className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-brand-700 hover:bg-brand-50 cursor-pointer"><Pencil size={13} /></button>
                <button onClick={() => deleteTemplate(t.id)} title="Delete" className="w-7 h-7 rounded flex items-center justify-center text-ink-400 hover:text-risk-700 hover:bg-risk-50 cursor-pointer"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {t.levels.map((l, i) => (
                <span key={l.id} className="inline-flex items-center gap-1 h-6 px-2 text-[10.5px] font-medium bg-[#F4F2F7] text-ink-700 rounded-full">
                  <Check size={9} className="text-brand-600" /> {l.name.replace(/^L\d+\s*—\s*/, `L${i + 1} · `)}
                </span>
              ))}
            </div>
          </div>
        ))}
        {mine.length === 0 && (
          <div className="md:col-span-2 border border-dashed border-canvas-border rounded-[12px] p-8 text-center text-[12.5px] text-ink-500">
            No {PERSONA_LABEL[role]} approval routes yet. Create one to start delegating.
          </div>
        )}
      </div>
    </div>
  );
}
