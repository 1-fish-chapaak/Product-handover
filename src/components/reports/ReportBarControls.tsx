// The command-bar controls an open report carries, wherever it is opened from:
// the reports reader, the Bulk Audit reader, the ATR reader and the
// engagement's Audit Report tab. They live here rather than in each reader so
// the bar reads as the same object on all four, and a change lands once.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isStandardTemplate } from './reportShared';
import { Layout, ChevronDown, Check, Loader2, Globe, Building2, Lock } from 'lucide-react';
import { ApplyTemplateDropdown } from './TemplateEditor';
import type { REPORT_TEMPLATES } from '../../data/mockData';
import { AUDIENCES, audienceLabel, audienceHint, type Audience } from '../shared/audience';

/** The icon for an audience, as an element rather than a component reference —
 *  a component built during render remounts its subtree on every keystroke. */
function audienceMark(a: Audience, className?: string) {
  if (a === 'Anyone with the link') return <Globe size={14} className={className} />;
  if (a === 'Everyone at Irame') return <Building2 size={14} className={className} />;
  return <Lock size={14} className={className} />;
}

type Template = typeof REPORT_TEMPLATES[number];

/** The format this report comes out in. Brand-tinted, because the format is
 *  the one control here that rewrites the document rather than moving it
 *  around. */
/** Escape closes an open chip menu, the way it closes every other menu in the
 *  product (ColumnFilter, the toolbar filters). Without it the click-catcher
 *  behind the menu stayed up and swallowed the next click on the command bar. */
function useCloseOnEscape(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);
}

export function ApplyTemplateChip({
  templates, activeId, activeName, onSelect, onSaveAsTemplate, busy = false, disabled = false,
}: {
  templates: Template[];
  activeId: string | null;
  activeName?: string | null;
  onSelect: (t: Template) => void;
  onSaveAsTemplate?: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useCloseOnEscape(open, () => setOpen(false));
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-busy={busy || undefined}
        title="Change the format this report comes out in"
        className="flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-md hover:bg-brand-100 hover:border-brand-300 disabled:opacity-60 disabled:cursor-wait transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Layout size={14} />}
        <span className="truncate max-w-[180px] hidden md:inline">
          {/* A format that ships with the product is the report's default shape,
              so the chip stays the plain invitation to change it. A format built
              in this workspace is somebody's choice, so the chip names it. */}
          {busy ? 'Applying…' : (activeId && !isStandardTemplate(activeId) && activeName ? activeName : 'Apply Template')}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <ApplyTemplateDropdown
              templates={templates}
              activeId={activeId}
              onSelect={t => { setOpen(false); onSelect(t); }}
              onClose={() => setOpen(false)}
              onSaveAsTemplate={onSaveAsTemplate}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Who can open this report. Green only when it is actually open to anyone
 *  with the link — a closed report is not a good-news chip, so it stays
 *  neutral and says so. */
export function ReportVisibilityChip({
  audience, onChange, disabled = false,
}: {
  audience: Audience;
  onChange: (a: Audience) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useCloseOnEscape(open, () => setOpen(false));
  const isPublic = audience === 'Anyone with the link';
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={audienceHint(audience)}
        className={`flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold rounded-md border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 ${
          isPublic
            ? 'text-compliant-700 bg-compliant-50 border-compliant-200 hover:bg-compliant-100 hover:border-compliant-300 focus-visible:ring-compliant-600/40'
            : 'text-ink-700 bg-canvas-elevated border-canvas-border hover:bg-canvas hover:border-ink-300/70 focus-visible:ring-brand-600/30'
        }`}
      >
        {audienceMark(audience)}
        <span className="truncate max-w-[140px] hidden md:inline">{audienceLabel(audience)}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97 }}
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-[268px] bg-white rounded-lg shadow-[0_16px_40px_-12px_rgba(15,8,30,0.22)] border border-canvas-border z-50 overflow-hidden"
            >
              <div className="px-3.5 pt-3 pb-1.5">
                <span className="text-[0.6875rem] font-semibold text-ink-400 uppercase tracking-[0.12em]">Who can open this</span>
              </div>
              <div className="pb-1.5">
                {AUDIENCES.map(opt => {
                  const active = opt === audience;
                  return (
                    <button
                      key={opt}
                      role="menuitem"
                      onClick={() => { setOpen(false); if (!active) onChange(opt); }}
                      className="w-full flex items-start gap-2.5 px-3.5 py-2 text-left hover:bg-canvas transition-colors cursor-pointer"
                    >
                      {audienceMark(opt, "mt-0.5 shrink-0 text-ink-400")}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8125rem] font-semibold text-ink-800">{opt}</span>
                        <span className="block text-[0.75rem] text-ink-500 leading-snug">{audienceHint(opt)}</span>
                      </span>
                      {active && <Check size={14} className="mt-0.5 shrink-0 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
