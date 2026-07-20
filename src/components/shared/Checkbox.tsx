import { Check } from 'lucide-react';

/**
 * Shared checkbox — flat DS tokens: canvas-border at rest, brand-600 filled when
 * checked with a white check. When `onChange` is omitted it renders
 * presentational (pointer-events disabled) so it can sit inside a row whose
 * parent handles the click.
 */
interface CheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Checkbox({ checked, onChange, disabled, ariaLabel }: CheckboxProps) {
  const interactive = !!onChange && !disabled;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={!interactive}
      tabIndex={interactive ? 0 : -1}
      onClick={interactive ? () => onChange!(!checked) : undefined}
      className={[
        'w-4 h-4 rounded-sm flex items-center justify-center shrink-0 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
        interactive ? 'cursor-pointer' : 'pointer-events-none',
        checked ? 'bg-brand-600 border border-brand-600' : 'border border-canvas-border bg-canvas-elevated',
        disabled ? 'opacity-60' : '',
      ].filter(Boolean).join(' ')}
    >
      {checked && <Check size={11} className="text-white" strokeWidth={3} />}
    </button>
  );
}
