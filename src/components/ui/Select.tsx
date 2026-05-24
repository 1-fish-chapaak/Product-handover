import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Size = 'sm' | 'md';

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  sizeVariant?: Size;
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 text-[13px] px-2.5 pr-7',
  md: 'h-9 text-[13px] px-3 pr-8',
};

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { sizeVariant = 'md', className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full appearance-none rounded-lg border border-canvas-border bg-canvas-elevated text-ink-800 transition-colors cursor-pointer',
        'hover:border-brand-200 focus:border-brand-400 focus:outline-none',
        'disabled:bg-canvas disabled:text-ink-400 disabled:cursor-not-allowed',
        'bg-no-repeat bg-[length:14px_14px] bg-[position:right_10px_center]',
        SIZES[sizeVariant],
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B5D82' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

export default Select;
