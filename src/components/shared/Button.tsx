import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

/**
 * Shared button — single source of truth for variants + sizes used across
 * the active chat, sidebar pin, and other chrome surfaces touched in the
 * polish/active-chat-ui branch.
 *
 * One reason to use this over inline class soup: pressed/disabled/hover
 * states are tedious to keep consistent across dozens of bespoke buttons,
 * and that drift is what made the chat top-bar feel inconsistent before.
 *
 * Type scale: every size renders within the 0.75rem (xs) / 0.875rem (sm)
 * tokens from §8.1 of CONTRIBUTING.md. Radius is locked to rounded-md /
 * lg / xl / full per §8.2.
 */

export type ButtonVariant =
  | 'primary'        // solid brand, white text — main CTA
  | 'secondary'      // neutral filled — secondary action on light surfaces
  | 'outline'        // bordered white — companion to primary
  | 'ghost'          // transparent, hover-fills — toolbars, icon strips
  | 'destructive'    // risk red filled — irreversible action
  | 'stop';          // ink-900 filled — used for in-flight stop

export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders as a square icon button (no left/right padding). Pass an aria-label. */
  iconOnly?: boolean;
  /** Pressed/active state for toggles (history button, thumbs, etc.) */
  pressed?: boolean;
  /** Optional icon shown to the left of children. */
  leftIcon?: ReactNode;
  /** Optional icon shown to the right of children. */
  rightIcon?: ReactNode;
  /** Rounded shape — `md` (default), `full` (pill), `xl` (large card-ish). */
  shape?: 'md' | 'lg' | 'xl' | 'full';
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white shadow-sm shadow-brand-900/10 hover:bg-primary-hover hover:shadow-md hover:shadow-brand-900/15 disabled:bg-canvas-border disabled:text-text-muted disabled:shadow-none',
  secondary:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-50',
  outline:
    'bg-canvas-elevated text-text-secondary border border-canvas-border hover:bg-brand-50 hover:text-text hover:border-brand-200 disabled:opacity-50',
  ghost:
    'bg-transparent text-text-muted hover:bg-brand-50 hover:text-text disabled:opacity-40',
  destructive:
    'bg-risk text-white shadow-sm hover:bg-risk-700 hover:shadow-md disabled:opacity-50',
  stop:
    'bg-ink-900 text-white shadow-sm hover:bg-ink-800',
};

const PRESSED_CLASSES: Partial<Record<ButtonVariant, string>> = {
  ghost: 'bg-primary/10 text-primary hover:bg-primary/15',
  outline: 'bg-primary/5 border-primary/30 text-primary',
};

const SIZE_TEXT: Record<ButtonSize, string> = {
  sm: 'h-7 text-xs gap-1.5',
  md: 'h-9 text-sm gap-2',
};

const SIZE_ICON_TEXT: Record<ButtonSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
};

const SIZE_PAD: Record<ButtonSize, string> = {
  sm: 'px-2.5',
  md: 'px-3.5',
};

const SHAPE_CLASSES: Record<NonNullable<ButtonProps['shape']>, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    pressed = false,
    shape = 'lg',
    leftIcon,
    rightIcon,
    className = '',
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  const variantCls = pressed ? PRESSED_CLASSES[variant] ?? VARIANT_CLASSES[variant] : VARIANT_CLASSES[variant];
  const sizeCls = iconOnly ? SIZE_ICON_TEXT[size] : `${SIZE_TEXT[size]} ${SIZE_PAD[size]}`;
  const shapeCls = SHAPE_CLASSES[shape];

  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed || undefined}
      className={[
        'inline-flex items-center justify-center font-medium cursor-pointer',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        variantCls,
        sizeCls,
        shapeCls,
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {leftIcon}
      {!iconOnly && children}
      {iconOnly && children}
      {rightIcon}
    </button>
  );
});
