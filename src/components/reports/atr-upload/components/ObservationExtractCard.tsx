import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Pencil, Check, X, ClipboardList, Paperclip, UserCheck, RotateCcw } from 'lucide-react';
import Checkbox from '../../../shared/Checkbox';
import MissingFieldResolver from './MissingFieldResolver';
import {
  OBSERVATION_FIELDS, CLASSIFICATION_OPTIONS, RISK_OPTIONS, getFieldValue, type FieldDef,
} from '../observationFields';
import type { ExtractedObservation, ExtractedFieldKey } from '../types';

type ResolveMode = 'fill' | 'skip' | 'reset';

// Meta is rendered as one quiet inline line — colour is carried by a small
// status dot (risk + completeness), everything else is muted text. This keeps
// the stacked list scannable instead of a wall of bordered pills.
const RISK_DOT: Record<string, string> = { High: 'bg-risk-500', Medium: 'bg-mitigated-500', Low: 'bg-ink-300' };
const COMPLETENESS_DOT: Record<string, string> = { Complete: 'bg-compliant-500', Partial: 'bg-mitigated-500', Incomplete: 'bg-risk-500' };

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

  // One quiet meta line: process · risk · classification · completeness.
  const metaParts: React.ReactNode[] = [];
  if (obs.process) metaParts.push(<span className="text-ink-600">{obs.process}</span>);
  metaParts.push(obs.risk
    ? <span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[obs.risk] ?? 'bg-ink-300'}`} aria-hidden="true" />{obs.risk} risk</span>
    : <span className="text-ink-400">Risk not detected</span>);
  metaParts.push(obs.classification
    ? <span className="text-ink-600">{obs.classification}</span>
    : <span className="text-ink-400">Class not detected</span>);
  metaParts.push(<span className="inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${COMPLETENESS_DOT[obs.completeness] ?? 'bg-ink-300'}`} aria-hidden="true" />{obs.completeness}</span>);

  const startEdit = (key: ExtractedFieldKey) => { setDraft(getFieldValue(obs, key)); setEditing(key); };
  const commit = (field: FieldDef) => {
    const mf = missingMap.get(field.key);
    if (mf) onResolve(field.key, 'fill', draft);   // resolving (or re-editing) a flagged field
    else onEditField(field.key, draft);            // editing a normally-extracted field
    setEditing(null);
  };

  return (
    <div className={`rounded-lg border overflow-hidden transition-colors ${obs.selected ? 'border-brand-300 ring-1 ring-brand-200 bg-brand-50/20' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'}`}>
      {/* Selected observations are highlighted (brand tint + ring) so it's clear
          which ones flow into the ATR. */}
      {/* Header row */}
      <div className="flex items-start gap-3.5 px-5 py-3.5">
        <div className="pt-0.5"><Checkbox checked={obs.selected} onChange={onToggleSelect} ariaLabel={`Select observation ${obs.number}`} /></div>

        <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.6875rem] font-semibold tabular-nums text-ink-300 shrink-0">#{obs.number}</span>
            <span className="text-[0.875rem] font-semibold text-ink-900 truncate">{title}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-x-2 gap-y-1 flex-wrap text-[0.71875rem] text-ink-500">
            {metaParts.map((node, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                {i > 0 && <span className="text-ink-300" aria-hidden="true">·</span>}
                {node}
              </span>
            ))}
          </div>
        </button>

        <div className="flex items-center gap-3.5 shrink-0 pt-1">
          <span className="inline-flex items-center gap-1 text-[0.71875rem] tabular-nums text-ink-400" title={`${obs.actionPlans.length} action plan${obs.actionPlans.length === 1 ? '' : 's'}`}><ClipboardList size={13} aria-hidden="true" />{obs.actionPlans.length}</span>
          <span className="inline-flex items-center gap-1 text-[0.71875rem] tabular-nums text-ink-400" title={`${linkedRows} linked annexure row${linkedRows === 1 ? '' : 's'}${linkedAnnexures > 1 ? ` across ${linkedAnnexures} files` : ''}`}><Paperclip size={13} aria-hidden="true" />{linkedRows}{linkedAnnexures > 1 ? ` · ${linkedAnnexures}` : ''}</span>
          <button onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="text-ink-300 hover:text-ink-700 cursor-pointer">
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="inline-block"><ChevronDown size={16} aria-hidden="true" /></motion.span>
          </button>
        </div>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden border-t border-canvas-border">
            <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 bg-[#FCFBFD]">
              {OBSERVATION_FIELDS.map(field => {
                const mf = missingMap.get(field.key);
                const isEditing = editing === field.key;
                const value = getFieldValue(obs, field.key);
                const isWide = field.kind === 'textarea';
                return (
                  <div key={field.key} className={isWide ? 'sm:col-span-2 lg:col-span-3' : ''}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400">{field.label}</span>
                      {mf?.state === 'missing' && <span className="inline-flex items-center gap-1 text-[0.59375rem] font-semibold uppercase tracking-wide text-risk-600 bg-risk-50 px-1.5 py-0.5 rounded-sm"><span className="w-1 h-1 rounded-full bg-risk-500" aria-hidden="true" />Missing</span>}
                      {mf?.state === 'filled-by-user' && <span className="inline-flex items-center gap-1 text-[0.59375rem] font-semibold uppercase tracking-wide text-evidence bg-evidence-50 px-1.5 py-0.5 rounded-sm"><UserCheck size={10} aria-hidden="true" />Filled by you</span>}
                      {mf?.state === 'skipped' && <span className="text-[0.59375rem] font-semibold uppercase tracking-wide text-ink-500 bg-canvas-border/60 px-1.5 py-0.5 rounded-sm">Skipped · N/A</span>}
                    </div>

                    {isEditing ? (
                      <FieldEditor kind={field.kind} value={draft} onChange={setDraft} onSave={() => commit(field)} onCancel={() => setEditing(null)} />
                    ) : mf?.state === 'missing' ? (
                      <MissingFieldResolver onFill={() => startEdit(field.key)} onSkip={() => onResolve(field.key, 'skip')} />
                    ) : mf?.state === 'skipped' ? (
                      <button onClick={() => onResolve(field.key, 'reset')} className="inline-flex items-center gap-1.5 text-[0.71875rem] font-medium text-brand-700 hover:underline cursor-pointer">
                        <RotateCcw size={12} aria-hidden="true" /> Undo skip
                      </button>
                    ) : (
                      <div className="group flex items-start gap-2">
                        <span className="text-[0.78125rem] text-ink-800 leading-relaxed flex-1">{value || <span className="text-ink-400">—</span>}</span>
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
  const base = 'w-full text-[0.78125rem] text-ink-800 bg-canvas-elevated border border-brand-400 rounded-sm px-2.5 py-1.5 focus:outline-none focus:ring-4 focus:ring-brand-600/15';
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
        <button onClick={onSave} className="inline-flex items-center gap-1 h-7 px-2.5 text-[0.71875rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-sm cursor-pointer"><Check size={12} aria-hidden="true" /> Save</button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 h-7 px-2.5 text-[0.71875rem] font-semibold text-ink-600 hover:text-ink-800 cursor-pointer"><X size={12} aria-hidden="true" /> Cancel</button>
      </div>
    </div>
  );
}
