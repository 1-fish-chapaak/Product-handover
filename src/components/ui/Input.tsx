import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Size = 'sm' | 'md';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  sizeVariant?: Size;
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 text-[13px] px-2.5',
  md: 'h-9 text-[13px] px-3',
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { sizeVariant = 'md', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-canvas-border bg-canvas-elevated text-ink-800 placeholder:text-ink-400 transition-colors',
        'hover:border-brand-200 focus:border-brand-400 focus:outline-none',
        'disabled:bg-canvas disabled:text-ink-400 disabled:cursor-not-allowed',
        SIZES[sizeVariant],
        className,
      )}
      {...rest}
    />
  );
});

export default Input;
