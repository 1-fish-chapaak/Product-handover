import { Sparkles, Send } from 'lucide-react';
import type { Control } from './types';

/**
 * Ira, sitting beside the control rather than inside it.
 *
 * The rail's third pane. Step 1 of the build is the shell only: the thread
 * area and the composer, so the rail can be read at its real width before any
 * of the conversation exists. What fills it next is derived, not stored —
 * `nextPrompt(control, role)` reads where the control actually stands, which
 * is what lets a click on the LEFT move the conversation on the right without
 * the chat having to be told.
 *
 * The composer is deliberately inert until the intents land (step 5). A box
 * that accepts a sentence and then does nothing with it is worse than one that
 * says it is not listening yet.
 */
export default function ControlChatPane({ control }: { control: Control }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="text-center px-4 py-10">
          <span className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 inline-flex items-center justify-center">
            <Sparkles size={16} />
          </span>
          <p className="text-[0.78125rem] font-semibold text-ink-700 mt-2.5">Ira sits here</p>
          <p className="text-[0.71875rem] text-ink-400 mt-1 leading-relaxed">
            Next: Ira reads where this control stands, says what to do — and does it, if you would rather ask than click.
          </p>
        </div>
      </div>
      <div className="p-3 border-t border-canvas-border">
        <div className="flex items-end gap-2">
          <textarea
            disabled rows={2}
            placeholder="Ask Ira what to do next…"
            className="flex-1 text-[0.75rem] rounded-lg border border-canvas-border bg-paper-50 px-2.5 py-2 text-ink-800 placeholder:text-ink-400 resize-none disabled:cursor-not-allowed"
          />
          <button
            disabled
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
