import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, X, ArrowRight, Lock, Globe, ChevronDown, Check } from 'lucide-react';
import type { ReportMeta } from './atr-upload/types';
import type { Audience } from '../shared/audience';
import { templateLineage } from './reportShared';

/** Everything the New Report modal hands back on Create Report. The host
 *  decides what happens next: an Action Taken Report goes on to the upload wizard, an
 *  Internal Audit Report is created straight away. */
export interface NewReportDraft {
  name: string;
  description: string;
  audience: Audience;
  templateId: string;
  templateName: string;
  /** The report-details fields (Reports → Admin → Fields & Lists of Values),
   *  with `reportName` already set to `name`. The rest are filled on the
   *  report's own details card, which is where they are edited afterwards
   *  anyway — asking twice was the only thing this modal used to do. */
  meta: Partial<ReportMeta>;
}

/** One row of the Template picker — a format from the Templates tab. */
export interface TemplateOption {
  id: string;
  name: string;
  desc?: string;
  /** Set on a duplicate; decides the badge and the journey. */
  baseId?: string;
  /** Standard formats are listed above the ones this workspace built. */
  custom?: boolean;
}

const INPUT_CLS = 'w-full px-3.5 py-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400/70 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

// Visibility is the platform's Audience, worded the way the form reads:
// Private = only the people invited; Public = everyone in the workspace.
const VISIBILITY: { audience: Audience; label: string; hint: string; icon: typeof Lock }[] = [
  { audience: 'Only invited users', label: 'Private', hint: 'Only you', icon: Lock },
  { audience: 'Everyone at Irame', label: 'Public', hint: 'Everyone on this team can view', icon: Globe },
];

// A format's badge says which standard it descends from, so the list reads as
// two families rather than a flat set of names. ATR formats continue into the
// upload wizard; IA formats create the report straight away.
const BADGE: Record<'atr' | 'ia', { label: string; cls: string; title: string }> = {
  atr: { label: 'ATR', cls: 'bg-brand-50 text-brand-700 border-brand-200', title: 'Built from the Action Taken Report' },
  ia: { label: 'IA', cls: 'bg-evidence-50 text-evidence-700 border-evidence-200', title: 'Built from the Internal Audit Report' },
};

function LineageBadge({ kind }: { kind: 'atr' | 'ia' }) {
  const b = BADGE[kind];
  return (
    <span title={b.title} className={`inline-flex items-center h-[18px] px-1.5 rounded-sm border text-[0.625rem] font-bold tracking-wide shrink-0 ${b.cls}`}>
      {b.label}
    </span>
  );
}

/** The default report name the placeholder suggests — "Report 01 — 23 April 2026". */
const suggestName = () =>
  `Report 01 — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

/**
 * New Report — the first step of Create Report. Name it, say who can see it,
 * and pick the format it is written in. The format's own fields decide what the
 * report asks for from here on, so this screen stays short: the report details
 * are filled on the report itself, where they are edited afterwards anyway.
 */
export default function NewReportModal({ open, onClose, onCreate, nameTaken, templates, initialDraft }: NewReportModalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="new-report"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" />
          {/* The form mounts fresh on every open, so its state starts clean. */}
          <NewReportForm onClose={onClose} onCreate={onCreate} nameTaken={nameTaken} templates={templates} initialDraft={initialDraft} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface NewReportModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: NewReportDraft) => void;
  /** Report names are unique — the host owns the list. */
  nameTaken: (name: string) => boolean;
  /** Every format on the Templates tab, standard first then this workspace's
   *  own. The host owns both lists. */
  templates: TemplateOption[];
  /** Coming back from the upload wizard: start from what was entered. */
  initialDraft?: NewReportDraft | null;
}

/** The Template field — a listbox rather than a native select, because each row
 *  carries a badge and a native `<option>` can only hold text. */
function TemplatePicker({ templates, value, onChange }: {
  templates: TemplateOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const chosen = templates.find(t => t.id === value);

  // Close on an outside click or Escape, like every other menu on the platform.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const standard = templates.filter(t => !t.custom);
  const custom = templates.filter(t => t.custom);

  const row = (t: TemplateOption) => (
    <button
      key={t.id}
      type="button"
      role="option"
      aria-selected={t.id === value}
      onClick={() => { onChange(t.id); setOpen(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${t.id === value ? 'bg-brand-50' : 'hover:bg-draft-50'}`}
    >
      <LineageBadge kind={templateLineage(t)} />
      <span className={`flex-1 min-w-0 truncate text-[0.8125rem] ${t.id === value ? 'font-semibold text-brand-700' : 'text-ink-800'}`} title={t.name}>{t.name}</span>
      {t.id === value && <Check size={14} className="text-brand-700 shrink-0" aria-hidden="true" />}
    </button>
  );

  const group = (label: string, rows: TemplateOption[]) => rows.length > 0 && (
    <div>
      <div className="px-3 pt-2.5 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      {rows.map(row)}
    </div>
  );

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        id="new-report-template"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`${INPUT_CLS} flex items-center gap-2.5 text-left cursor-pointer ${open ? 'border-brand-400 ring-2 ring-brand-500/10' : ''}`}
      >
        {chosen
          ? <><LineageBadge kind={templateLineage(chosen)} /><span className="flex-1 min-w-0 truncate">{chosen.name}</span></>
          : <span className="flex-1 text-ink-400/70">Select a template</span>}
        <ChevronDown size={16} className={`text-brand-700 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Template"
          className="absolute z-10 left-0 right-0 mt-1 max-h-[280px] overflow-y-auto rounded-lg border border-canvas-border bg-canvas-elevated shadow-lg py-1"
        >
          {templates.length === 0
            ? <p className="px-3 py-3 text-[0.75rem] text-ink-500">No templates yet — build one on the Templates tab.</p>
            : <>{group('Standard', standard)}{group('Custom', custom)}</>}
        </div>
      )}
    </div>
  );
}

function NewReportForm({ onClose, onCreate, nameTaken, templates, initialDraft }: Omit<NewReportModalProps, 'open'>) {
  const [name, setName] = useState(initialDraft?.name ?? '');
  const [description, setDescription] = useState(initialDraft?.description ?? '');
  const [audience, setAudience] = useState<Audience>(initialDraft?.audience ?? 'Only invited users');
  const [templateId, setTemplateId] = useState(initialDraft?.templateId ?? '');
  const [placeholder] = useState(suggestName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const template = templates.find(t => t.id === templateId);
  // An unnamed report takes the name the placeholder is offering, so the field
  // reads as a default rather than a demand.
  const trimmed = name.trim() || placeholder;
  const duplicateName = nameTaken(trimmed);
  const isAtr = !!template && templateLineage(template) === 'atr';
  const ready = !!template && !duplicateName;
  const hint = duplicateName
    ? `A report named “${trimmed}” already exists — choose a different name.`
    : !template
      ? 'Pick the template this report is written in.'
      : isAtr
        ? 'Next: upload the source report and extract its observations.'
        : 'Ready to create.';

  const create = () => {
    if (!ready || !template) return;
    onCreate({
      name: trimmed,
      description: description.trim(),
      audience,
      templateId: template.id,
      templateName: template.name,
      meta: { ...(initialDraft?.meta ?? {}), reportName: trimmed },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      role="dialog" aria-modal="true" aria-label="New Report"
      className="relative w-full max-w-[640px] max-h-[90vh] bg-canvas-elevated rounded-2xl border border-canvas-border shadow-xl flex flex-col overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-canvas-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><FileText size={16} /></div>
          <div>
            <h3 className="text-[1.0625rem] font-semibold text-ink-900 leading-tight tracking-tight">New Report</h3>
            <p className="text-[0.75rem] text-ink-500 mt-0.5">Set up your report</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md text-ink-400 hover:text-ink-800 hover:bg-canvas flex items-center justify-center cursor-pointer"><X size={18} /></button>
      </div>

      {/* Form */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <label htmlFor="new-report-name" className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">
            Report Name <span className="text-risk-700">*</span>
          </label>
          <input
            id="new-report-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={placeholder}
            aria-invalid={duplicateName || undefined}
            className={`${INPUT_CLS} ${duplicateName ? '!border-risk-400 focus:!ring-risk-500/10' : ''}`}
          />
          {duplicateName && <p className="mt-1.5 text-[0.71875rem] text-risk-700">A report named “{trimmed}” already exists.</p>}
        </div>

        <div>
          <label htmlFor="new-report-desc" className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">Description</label>
          <textarea
            id="new-report-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Report Description goes here"
            className={`${INPUT_CLS} resize-y min-h-[84px]`}
          />
        </div>

        <fieldset>
          <legend className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">Visibility</legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Visibility">
            {VISIBILITY.map(v => {
              const active = audience === v.audience; const Icon = v.icon;
              return (
                <button
                  key={v.audience}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAudience(v.audience)}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 ${active ? 'border-brand-400 bg-brand-50/60' : 'border-canvas-border bg-canvas-elevated hover:border-brand-200'}`}
                >
                  <Icon size={16} className={active ? 'text-brand-700' : 'text-ink-400'} aria-hidden="true" />
                  <span>
                    <span className={`block text-[0.8125rem] font-semibold ${active ? 'text-brand-700' : 'text-ink-800'}`}>{v.label}</span>
                    <span className="block text-[0.71875rem] text-ink-500">{v.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="new-report-template" className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">
            Template <span className="text-risk-700">*</span>
          </label>
          <TemplatePicker templates={templates} value={templateId} onChange={setTemplateId} />
          <p className="mt-1.5 text-[0.71875rem] text-ink-500">
            {template
              ? (isAtr
                ? 'The report carries the fields this template was built with. Next: upload the source report.'
                : (template.desc || 'The report carries the fields this template was built with.'))
              : 'An ATR template continues to the upload step; an IA template creates the report right away.'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-canvas-border shrink-0 flex items-center justify-between gap-4">
        <p className={`text-[0.75rem] ${duplicateName ? 'text-risk-700' : ready ? 'text-compliant-700 font-medium' : 'text-ink-500'}`}>{hint}</p>
        <button
          type="button"
          onClick={create}
          disabled={!ready}
          title={ready ? undefined : hint}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[0.8125rem] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-1 whitespace-nowrap shrink-0"
        >
          {isAtr ? 'Next' : 'Create Report'} <ArrowRight size={15} />
        </button>
      </div>
    </motion.div>
  );
}
