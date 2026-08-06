// Template preview — the template printed as the page it produces, full width,
// read only.
//
// Clicking a template in the Templates list opens this, so the answer to "what
// report is this?" is the report itself: letterhead, numbered sections, block
// shapes, sign-off, footer. Nothing here is editable or generated; the sheet is
// the same one the editor builds (same section shape renderer), so what is
// previewed is what generates.

import { motion } from 'motion/react';
import { ArrowLeft, Edit3, Trash2, FileText } from 'lucide-react';
import TemplateSheet from './TemplateSheet';
import {
  ICON_MAP, CATEGORY_COLORS,
  type EditableTemplate,
} from './reportShared';
import { findEngagement } from '../../data/engagements';

export default function TemplatePreview({
  template,
  isCustom,
  onBack,
  onEdit,
  onDelete,
}: {
  template: EditableTemplate;
  /** Custom templates carry Edit + Delete; system templates are read-only. */
  isCustom?: boolean;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const sections = template.sections ?? [];
  const Icon = ICON_MAP[template.icon] || FileText;
  const color = CATEGORY_COLORS[template.category] || 'text-ink-500 bg-paper-50';
  const eyebrowTone = color.split(' ')[0];
  const tintBg = color.split(' ')[1] ?? 'bg-paper-50';

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      {/* Action bar — page-coloured and borderless, so the sheet slides
          cleanly beneath it (the report reader's recipe). */}
      <div className="shrink-0 px-6 lg:px-12 xl:px-[124px] h-16 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.75rem] font-semibold text-ink-600 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:text-ink-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <ArrowLeft size={14} /> Back to Templates
        </button>
        <div className="flex items-center gap-2">
          {isCustom && onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[0.75rem] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md hover:bg-canvas hover:border-ink-300/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Edit3 size={14} /> Edit template
            </button>
          )}
          {isCustom && onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete template ${template.name}`}
              className="inline-flex items-center justify-center w-9 h-9 text-ink-500 bg-canvas-elevated border border-canvas-border rounded-md hover:text-risk-700 hover:border-risk-200 hover:bg-risk-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-12 xl:px-[124px] pb-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-3xl"
        >
          {/* One honest line above the sheet: this is the shape, not a report. */}
          <div className="flex flex-wrap items-center gap-2 pb-3 text-[0.75rem] text-ink-500">
            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${tintBg}`}>
              <Icon size={12} className={eyebrowTone} strokeWidth={1.75} />
            </span>
            <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.14em] ${eyebrowTone}`}>{template.category}</span>
            <span className="text-ink-300">·</span>
            <span>{sections.length} {sections.length === 1 ? 'section' : 'sections'}</span>
            <span className="text-ink-300">·</span>
            <span>Empty shape. Your audit data fills it in when you generate.</span>
            {template.engagementId && (
              <>
                <span className="text-ink-300">·</span>
                <span>Engagement: {findEngagement(template.engagementId)?.name ?? 'Unknown'}</span>
              </>
            )}
          </div>

          <TemplateSheet template={template} />
        </motion.div>
      </div>
    </div>
  );
}
