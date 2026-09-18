import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, X, ArrowRight, Lock, Globe, ChevronDown } from 'lucide-react';
import ReportDetailsForm, { type ReportDetailsValue } from './atr-upload/components/ReportDetailsForm';
import type { ReportMeta } from './atr-upload/types';
import type { Audience } from '../shared/audience';
import { REPORT_TEMPLATES } from '../../data/mockData';

/** Everything the New Report modal hands back on Create Report. The host
 *  decides what happens next: an Action Taken Report goes on to the upload wizard, an
 *  Internal Audit Report is created straight away. */
export interface NewReportDraft {
  name: string;
  audience: Audience;
  templateId: string;
  templateName: string;
  /** The report-details fields (Reports → Admin → Fields & Lists of Values),
   *  with `reportName` already set to `name`. */
  meta: Partial<ReportMeta>;
}

const INPUT_CLS = 'w-full px-3.5 py-2.5 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400/70 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

// Visibility is the platform's Audience, worded the way the form reads:
// Private = only the people invited; Public = everyone in the workspace.
const VISIBILITY: { audience: Audience; label: string; hint: string; icon: typeof Lock }[] = [
  { audience: 'Only invited users', label: 'Private', hint: 'Only you', icon: Lock },
  { audience: 'Everyone at Irame', label: 'Public', hint: 'Everyone on this team can view', icon: Globe },
];

/**
 * New Report — the first step of Create Report. The report details the admin
 * has configured (Report Name first), then the template, then visibility.
 * Creating an Action Taken Report continues into the upload wizard; the details
 * captured here print on the ATR cover, so the wizard no longer asks for them.
 */
export default function NewReportModal({ open, onClose, onCreate, nameTaken, initialDraft }: NewReportModalProps) {
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
          <NewReportForm onClose={onClose} onCreate={onCreate} nameTaken={nameTaken} initialDraft={initialDraft} />
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
  /** Coming back from the upload wizard: start from what was entered. */
  initialDraft?: NewReportDraft | null;
}

function NewReportForm({ onClose, onCreate, nameTaken, initialDraft }: Omit<NewReportModalProps, 'open'>) {
  const [audience, setAudience] = useState<Audience>(initialDraft?.audience ?? 'Only invited users');
  const [templateId, setTemplateId] = useState(initialDraft?.templateId ?? '');
  const [details, setDetails] = useState<ReportDetailsValue>({ meta: initialDraft?.meta ?? {}, complete: false, duplicate: false, outstanding: initialDraft ? [] : ['Report Name'] });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const template = REPORT_TEMPLATES.find(t => t.id === templateId);
  // Report Name is the first field of the details form; names are unique.
  const trimmed = (details.meta.reportName ?? '').trim();
  const duplicateName = !!trimmed && nameTaken(trimmed);
  const isAtr = templateId === 'rt-007';
  const outstanding = [
    ...details.outstanding,
    !template ? 'a template' : null,
  ].filter((x): x is string => x !== null);
  const ready = outstanding.length === 0 && !duplicateName && !details.duplicate;
  const hint = duplicateName
    ? `A report named “${trimmed}” already exists — choose a different name.`
    : details.duplicate
      ? `Report Number ${details.meta.reportNumber} is already used in ${details.meta.section} for ${details.meta.financialYear}.`
      : outstanding.length === 0
        ? (isAtr ? 'Next: upload the source report and extract its observations.' : 'Ready to create.')
        : outstanding.length === 1
          ? `Add ${outstanding[0]} to continue.`
          : `Still needed: ${outstanding.slice(0, -1).join(', ')} and ${outstanding[outstanding.length - 1]}.`;

  const create = () => {
    if (!ready || !template) return;
    onCreate({
      name: trimmed,
      audience,
      templateId: template.id,
      templateName: template.name,
      meta: { ...details.meta, reportName: trimmed },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      role="dialog" aria-modal="true" aria-label="New Report"
      className="relative w-full max-w-[1200px] h-[90vh] bg-canvas-elevated rounded-2xl border border-canvas-border shadow-xl flex flex-col overflow-hidden"
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

      {/* Form — report details first (Report Name leads), then the template,
          then who can see it. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
        <ReportDetailsForm
          onChange={setDetails}
          initial={initialDraft?.meta}
          showHeader={false}
          reportNameError={duplicateName ? `A report named “${trimmed}” already exists — choose a different name.` : undefined}
        />

        <div className="pt-6 border-t border-canvas-border">
          <label htmlFor="new-report-template" className="block text-[0.8125rem] font-semibold text-ink-800 mb-1.5">Template <span className="text-risk-700">*</span></label>
          <div className="relative">
            <select
              id="new-report-template"
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className={`${INPUT_CLS} appearance-none pr-9 cursor-pointer ${templateId ? '' : 'text-ink-500'}`}
            >
              <option value="">Select a template</option>
              {REPORT_TEMPLATES.map(t => <option key={t.id} value={t.id} className="text-ink-800">{t.name}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-700" aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-[0.71875rem] text-ink-500">
            {template
              ? (isAtr ? `${template.desc}. Next: upload the source report and extract its observations.` : template.desc)
              : 'Action Taken Report continues to the upload step; an Internal Audit Report is created right away.'}
          </p>
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
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-canvas-border shrink-0 flex items-center justify-between gap-4">
        <p className={`text-[0.75rem] ${ready ? 'text-compliant-700 font-medium' : duplicateName || details.duplicate ? 'text-risk-700' : 'text-ink-500'}`}>{hint}</p>
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
