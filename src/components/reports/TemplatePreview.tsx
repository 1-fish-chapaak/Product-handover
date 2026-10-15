// Template preview — the template printed as the page it produces, full width,
// read only.
//
// Clicking a template in the Templates list opens this, so the answer to "what
// report is this?" is the report itself: letterhead, sections, fields, sign-off,
// footer. Nothing here is editable or generated; the sheet is the same one the
// editor builds, so what is previewed is what generates.
//
// The format's own actions (duplicate, edit, delete) sit top-right inside the
// letterhead, and nothing else is added around the sheet: the page starts at the
// report. Leaving is the Templates tab above, which clears the preview, so this
// screen carries no back control of its own.

import { motion } from 'motion/react';
import { Edit3, Copy, Trash2 } from 'lucide-react';
import TemplateSheet from './TemplateSheet';
import { type EditableTemplate } from './reportShared';

const BANNER_BTN = 'inline-flex items-center gap-1.5 h-8 px-3 text-[0.75rem] font-semibold text-white/90 bg-white/10 border border-white/20 rounded-md hover:bg-white/20 hover:text-white transition-colors cursor-pointer backdrop-blur-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

export default function TemplatePreview({
  template,
  isCustom,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  template: EditableTemplate;
  /** Custom templates carry Edit + Delete; standard ones are edited by copy. */
  isCustom?: boolean;
  onEdit?: () => void;
  /** Copy this format into Custom templates and open the copy in the editor.
   *  A standard format is shared and cannot be edited in place, so this is the
   *  route out of the preview rather than leaving the page with no action. */
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 lg:px-12 xl:px-[124px] pt-6 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-3xl"
        >
          <TemplateSheet
            template={template}
            actions={
              <div className="flex items-center gap-2">
                {onDuplicate && (
                  <button onClick={onDuplicate} className={BANNER_BTN}>
                    <Copy size={14} /> Duplicate
                  </button>
                )}
                {isCustom && onEdit && (
                  <button onClick={onEdit} className={BANNER_BTN}>
                    <Edit3 size={14} /> Edit template
                  </button>
                )}
                {isCustom && onDelete && (
                  <button
                    onClick={onDelete}
                    aria-label={`Delete template ${template.name}`}
                    className={`${BANNER_BTN} px-0 w-8 justify-center`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            }
          />
        </motion.div>
      </div>
    </div>
  );
}
