/**
 * A PICTURE OF ONE SOP PAGE, with the passage Ira means highlighted (7 Oct,
 * user's call: the source is shown as the page, not as a quote).
 *
 * The prototype has no page images, so the page is drawn from its lines — a
 * paper-coloured sheet, the section heading at the top, each paragraph with
 * what it is ("Risk", "Control") in the margin. Highlighted lines are marked
 * like a highlighter pen; in `compact` the others are cut to two lines so the
 * marked passage is what the eye lands on.
 *
 * TDZ note: types only from this folder.
 */
import type { SopPage } from './sopPages';
import { cn } from '../../lib/cn';

export default function SopPagePicture({ page, highlight = [], compact = false, className }: {
  page: SopPage; highlight?: string[]; compact?: boolean; className?: string;
}) {
  return (
    <figure aria-label={`Page ${page.no} of the SOP`}
      className={cn('rounded-md border border-ink-200 bg-paper-50 shadow-[0_1px_0_rgba(0,0,0,0.03)]', compact ? 'px-3 py-2.5' : 'px-5 py-4', className)}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className={cn('min-w-0 font-semibold text-ink-800 truncate', compact ? 'text-[0.6875rem]' : 'text-[0.8125rem]')}>{page.heading}</span>
        <span className="shrink-0 font-mono text-[0.625rem] text-ink-400">p.{page.no}</span>
      </figcaption>
      <div className={cn('mt-1.5', compact ? 'space-y-1' : 'space-y-2')}>
        {page.lines.map(l => {
          const on = highlight.includes(l.id);
          return (
            <div key={l.id} className={cn('grid gap-x-2', compact ? 'grid-cols-[3.75rem_minmax(0,1fr)]' : 'grid-cols-[5rem_minmax(0,1fr)]')}>
              <span className={cn('pt-px text-right uppercase tracking-wide text-ink-400', compact ? 'text-[0.5625rem]' : 'text-[0.625rem]')}>{l.label ?? ''}</span>
              <p className={cn('leading-snug', compact ? 'text-[0.6875rem]' : 'text-[0.75rem]',
                on ? 'text-ink-900 bg-mitigated-100 rounded-sm px-0.5 -mx-0.5' : cn('text-ink-500', compact && 'line-clamp-2'))}>
                {l.text}
              </p>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
