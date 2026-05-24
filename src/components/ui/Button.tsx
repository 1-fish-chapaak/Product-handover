import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-800 disabled:bg-brand-100 disabled:text-brand-300',
  secondary:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 disabled:bg-canvas disabled:text-ink-400',
  outline:
    'bg-canvas-elevated text-ink-700 border border-canvas-border hover:border-brand-300 hover:text-ink-800 disabled:bg-canvas disabled:text-ink-400',
  ghost:
    'bg-transparent text-ink-500 hover:bg-brand-50 hover:text-brand-700 disabled:text-ink-300',
  destructive:
    'bg-risk text-white hover:bg-risk-700 disabled:bg-risk-50 disabled:text-risk',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 text-[13px] px-3 gap-1.5',
  md: 'h-9 text-[13px] px-4 gap-2',
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'outline', size = 'md', leadingIcon, trailingIcon, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
});

export default Button;
