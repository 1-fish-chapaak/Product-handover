/**
 * "IRA ASKS" — the side panel beside the reading (7 Oct, SOP extraction rework,
 * stage 3; user's call: a side panel, and Ira keeps reading while it waits).
 *
 * A question arrives when the reading reaches its page. Unanswered ones sit on
 * top with the page picture and the passage highlighted; an answered one folds
 * to a single line that can be changed. Ira's own reading is always the first
 * button, so agreeing is one click.
 *
 * TDZ note: this folder has an import cycle. Nothing here reads another
 * sox-icfr export at module load — only inside functions.
 */
import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import SopPagePicture from './SopPagePicture';
import type { SopPage } from './sopPages';
import type { SopQuestion } from './sopQuestions';
import { cn } from '../../lib/cn';

interface Props {
  pages: SopPage[];
  /** The questions asked so far — reading has reached their page. */
  asked: SopQuestion[];
  /** How many will be asked while reading in all (at most six). */
  total: number;
  /** Questions held for Review because six were already asked. */
  heldForReview: number;
  answers: Record<string, string>;
  onAnswer: (questionId: string, optionId: string) => void;
  /** Every answer came from an earlier upload of the same file. */
  reused: boolean;
  /** A heading in place of "Ira asks · n of N" — Review's held questions. */
  title?: string;
}

export default function SopQuestionsPanel({ pages, asked, total, heldForReview, answers, onAnswer, reused, title }: Props) {
  // An answered question re-opens for a change of mind, one at a time.
  const [reopened, setReopened] = useState<string | null>(null);
  if (!total) return null;
  const open = asked.filter(q => !answers[q.id] || reopened === q.id);
  const done = asked.filter(q => answers[q.id] && reopened !== q.id);
  const pageOf = (no: number) => pages.find(p => p.no === no);

  return (
    <section aria-label="Ira's questions" className="rounded-xl border border-brand-200 bg-brand-50/30 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-brand-700">
        <Sparkles size={11} aria-hidden /> {title ?? 'Ira asks'}
        {!title && <span className="font-normal normal-case tracking-normal text-ink-500 tabular-nums">· {asked.length} of {total}</span>}
      </p>
      {reused && (
        <p className="mt-1 text-[0.75rem] text-ink-500">You answered these for this file before, so Ira used the same answers.</p>
      )}
      {!asked.length && (
        <p className="mt-1 text-[0.75rem] text-ink-500">Nothing yet. Ira asks here when it isn't sure what a page holds — and keeps reading meanwhile.</p>
      )}

      <div className="mt-2 space-y-2.5">
        {open.map(q => {
          const page = pageOf(q.page);
          return (
            <div key={q.id} className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5">
              <p className="text-[0.8125rem] leading-snug text-ink-900">{q.ask}</p>
              {page && <SopPagePicture page={page} highlight={q.lineIds} compact className="mt-2" />}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {q.options.map((o, i) => (
                  <button key={o.id} type="button" onClick={() => { onAnswer(q.id, o.id); setReopened(null); }}
                    className={cn('h-7 px-2.5 rounded-md text-[0.75rem] font-semibold transition-colors cursor-pointer',
                      answers[q.id] === o.id ? 'bg-brand-600 text-white'
                        : i === 0 ? 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                        : 'border border-canvas-border bg-canvas text-ink-700 hover:border-ink-300')}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {done.length > 0 && (
        <ul className="mt-2.5 space-y-1" aria-label="Answered">
          {done.map(q => {
            const chose = q.options.find(o => o.id === answers[q.id]);
            return (
              <li key={q.id} className="flex items-start gap-1.5 text-[0.75rem] leading-snug">
                <Check size={12} className="mt-0.5 shrink-0 text-ink-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-ink-500">p.{q.page}</span>
                  <span className="text-ink-300" aria-hidden> · </span>
                  <span className="text-ink-500">{q.topic}</span>
                  <span className="text-ink-300" aria-hidden> — </span>
                  <span className="text-ink-900">{chose?.label}</span>
                </span>
                <button type="button" onClick={() => setReopened(q.id)}
                  className="shrink-0 text-[0.6875rem] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">Change</button>
              </li>
            );
          })}
        </ul>
      )}

      {heldForReview > 0 && (
        <p className="mt-2.5 text-[0.75rem] text-ink-500">
          {heldForReview === 1 ? '1 more question waits' : `${heldForReview} more questions wait`} for you in Review, so this list stays at six.
        </p>
      )}
    </section>
  );
}
