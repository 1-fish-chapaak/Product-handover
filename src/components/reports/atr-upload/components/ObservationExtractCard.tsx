import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Pencil, Check, X, ClipboardList, Paperclip, UserCheck, RotateCcw } from 'lucide-react';
import Checkbox from '../../../shared/Checkbox';
import { Pill, SeverityBadge } from '../../../shared/StatusBadge';
import MissingFieldResolver from './MissingFieldResolver';
import {
  OBSERVATION_FIELDS, CLASSIFICATION_OPTIONS, RISK_OPTIONS, getFieldValue, type FieldDef,
} from '../observationFields';
import type { ExtractedObservation, ExtractedFieldKey } from '../types';

type ResolveMode = 'fill' | 'skip' | 'reset';

const COMPLETENESS_TONE = { Complete: 'compliant', Partial: 'mitigated', Incomplete: 'risk' } as const;
const CLASSIFICATION_TONE: Record<string, 'high' | 'risk' | 'info'> = {
  'Design Deficiency': 'high', 'System Deficiency': 'risk', 'Procedural Non-Compliance': 'info',
};

export default function ObservationExtractCard({
  obs, linkedAnnexures, linkedRows, onToggleSelect, onEditField, onResolve,
}: {
  obs: ExtractedObservation;
  linkedAnnexures: number;
  linkedRows: number;
  onToggleSelect: () => void;
  onEditField: (key: ExtractedFieldKey, value: string) => void;
  onResolve: (key: ExtractedFieldKey, mode: ResolveMode, value?: string) => void;
}) {
  // Default-open observations that still need attention so the demo path is obvious.
  const [open, setOpen] = useState(obs.missingFields.some(f => f.state === 'missing'));
  const [editing, setEditing] = useState<ExtractedFieldKey | null>(null);
  const [draft, setDraft] = useState('');

  const missingMap = new Map(obs.missingFields.map(f => [f.key, f]));
  const title = obs.title?.trim() || 'Untitled observation';

  const startEdit = (key: ExtractedFieldKey) => { setDraft(getFieldValue(obs, key)); setEditing(key); };
  const commit = (field: FieldDef) => {
    const mf = missingMap.get(field.key);
    if (mf) onResolve(field.key, 'fill', draft);   // resolving (or re-editing) a flagged field
    else onEditField(field.key, draft);            // editing a normally-extracted field
    setEditing(null);
  };

  return (
    <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="pt-0.5"><Checkbox checked={obs.selected} onChange={onToggleSelect} ariaLabel={`Select observation ${obs.number}`} /></div>

        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold tabular-nums text-ink-400">#{obs.number}</span>
            <span className="text-[13.5px] font-semibold text-ink-900 truncate max-w-[420px]">{title}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {obs.process && <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-canvas text-ink-600 border border-canvas-border text-[11px]">{obs.process}</span>}
            {obs.risk ? <SeverityBadge severity={obs.risk.toLowerCase()} /> : <Pill tone="draft">Risk not detected</Pill>}
            {obs.classification ? <Pill tone={CLASSIFICATION_TONE[obs.classification] ?? 'info'}>{obs.classification}</Pill> : <Pill tone="draft">Class not detected</Pill>}
            <Pill tone={COMPLETENESS_TONE[obs.completeness]}>{obs.completeness}</Pill>
          </div>
        </button>

        <div className="flex items-center gap-3 shrink-0 pt-0.5">
          <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-500" title="Action plans"><ClipboardList size={13} aria-hidden="true" />{obs.actionPlans.length}</span>
          <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-500" title="Linked annexure rows"><Paperclip size={13} aria-hidden="true" />{linkedRows}{linkedAnnexures > 1 ? ` · ${linkedAnnexures} files` : ''}</span>
          <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="text-ink-400 hover:text-ink-700 cursor-pointer">
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="inline-block"><ChevronDown size={16} aria-hidden="true" /></motion.span>
          </button>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden border-t border-canvas-border">
            <div className="px-4 py-4 grid sm:grid-cols-2 gap-x-6 gap-y-4 bg-[#FCFBFD]">
              {OBSERVATION_FIELDS.map(field => {
                const mf = missingMap.get(field.key);
                const isEditing = editing === field.key;
                const value = getFieldValue(obs, field.key);
                const isWide = field.kind === 'textarea';
                return (
                  <div key={field.key} className={isWide ? 'sm:col-span-2' : ''}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{field.label}</span>
                      {mf?.state === 'missing' && <span className="text-[9.5px] font-bold uppercase text-risk-700 bg-risk-50 px-1.5 py-0.5 rounded">Missing</span>}
                      {mf?.state === 'filled-by-user' && <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase text-evidence bg-evidence-50 px-1.5 py-0.5 rounded"><UserCheck size={10} aria-hidden="true" />Filled by user</span>}
                      {mf?.state === 'skipped' && <span className="text-[9.5px] font-semibold uppercase text-ink-500 bg-canvas-border/60 px-1.5 py-0.5 rounded">Skipped · N/A</span>}
                    </div>

                    {isEditing ? (
                      <FieldEditor kind={field.kind} value={draft} onChange={setDraft} onSave={() => commit(field)} onCancel={() => setEditing(null)} />
                    ) : mf?.state === 'missing' ? (
                      <MissingFieldResolver onFill={() => startEdit(field.key)} onSkip={() => onResolve(field.key, 'skip')} />
                    ) : mf?.state === 'skipped' ? (
                      <button onClick={() => onResolve(field.key, 'reset')} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-brand-700 hover:underline cursor-pointer">
                        <RotateCcw size={12} aria-hidden="true" /> Undo skip
                      </button>
                    ) : (
                      <div className="group flex items-start gap-2">
                        <span className="text-[12.5px] text-ink-800 leading-relaxed flex-1">{value || <span className="text-ink-400">—</span>}</span>
                        <button onClick={() => startEdit(field.key)} aria-label={`Edit ${field.label}`} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-brand-700 cursor-pointer transition-opacity shrink-0 mt-0.5">
                          <Pencil size={12.5} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldEditor({ kind, value, onChange, onSave, onCancel }: {
  kind: FieldDef['kind']; value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void;
}) {
  const base = 'w-full text-[12.5px] text-ink-800 bg-canvas-elevated border border-brand-400 rounded-[6px] px-2.5 py-1.5 focus:outline-none focus:ring-4 focus:ring-brand-600/15';
  return (
    <div className="space-y-2">
      {kind === 'textarea' ? (
        <textarea autoFocus value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${base} resize-none`} />
      ) : kind === 'classification' ? (
        <select autoFocus value={value} onChange={e => onChange(e.target.value)} className={base}>
          <option value="">Select classification…</option>
          {CLASSIFICATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : kind === 'risk' ? (
        <select autoFocus value={value} onChange={e => onChange(e.target.value)} className={base}>
          <option value="">Select risk…</option>
          {RISK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input autoFocus value={value} onChange={e => onChange(e.target.value)} placeholder={kind === 'date' ? 'e.g. 30 Jun 2026' : ''} className={base} />
      )}
      <div className="flex items-center gap-2">
        <button onClick={onSave} className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[6px] cursor-pointer"><Check size={12} aria-hidden="true" /> Save</button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-semibold text-ink-600 hover:text-ink-800 cursor-pointer"><X size={12} aria-hidden="true" /> Cancel</button>
      </div>
    </div>
  );
}
