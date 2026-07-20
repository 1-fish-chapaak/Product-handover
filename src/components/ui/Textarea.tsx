import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] text-ink-800 placeholder:text-ink-400 px-3 py-2 transition-colors resize-none',
        'hover:border-brand-200 focus:border-brand-400 focus:outline-none',
        'disabled:bg-canvas disabled:text-ink-400 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    />
  );
});

export default Textarea;
