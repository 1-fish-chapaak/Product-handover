/**
 * ── One line of text where the action was (agentic UX #11, 1 Oct) ───────────
 * The review took toasts out of SOX. A refusal, a form mistake or a failure is
 * now said in one line beside the button, field or row that caused it — no box,
 * no colour wash, gone on the next action or after a few seconds.
 *
 *   const note = useInlineNote();
 *   onClick={() => { if (blocked) return note.show('warning', 'In use by FY26.'); … }}
 *   <InlineNote note={note.note} />
 *
 * TDZ note: nothing here reads another sox-icfr module at load.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export type NoteTone = 'error' | 'warning' | 'info';
export interface Note { tone: NoteTone; text: string }

export function useInlineNote(ms = 8000) {
  const [note, setNote] = useState<Note | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const clear = useCallback(() => { window.clearTimeout(timer.current); setNote(null); }, []);
  const show = useCallback((tone: NoteTone, text: string) => {
    window.clearTimeout(timer.current);
    setNote({ tone, text });
    timer.current = window.setTimeout(() => setNote(null), ms);
  }, [ms]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { note, show, clear };
}

const TONE: Record<NoteTone, string> = {
  error: 'text-risk-700',
  warning: 'text-mitigated-800',
  info: 'text-ink-500',
};

export function InlineNote({ note, className }: { note: Note | null; className?: string }) {
  if (!note) return null;
  return (
    <p role={note.tone === 'info' ? 'status' : 'alert'} className={cn('text-[0.71875rem] leading-snug', TONE[note.tone], className)}>
      {note.text}
    </p>
  );
}
