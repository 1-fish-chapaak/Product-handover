/**
 * Shared switch — single source of truth for the on/off toggle used across
 * admin permission matrices, role detail, and invite previews. Flat DS tokens:
 * brand-600 track when on, canvas-border when off, white knob, no inline shadow.
 *
 * When `onChange` is omitted the toggle renders presentational (pointer-events
 * disabled) so it can sit inside a row whose parent handles the click.
 */
interface ToggleProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Toggle({ checked, onChange, disabled, ariaLabel }: ToggleProps) {
  const interactive = !!onChange && !disabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={!interactive}
      tabIndex={interactive ? 0 : -1}
      onClick={interactive ? () => onChange!(!checked) : undefined}
      className={[
        'relative w-10 h-[22px] rounded-full shrink-0 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
        interactive ? 'cursor-pointer' : 'pointer-events-none',
        checked ? 'bg-brand-600' : 'bg-canvas-border',
        disabled ? 'opacity-60' : '',
      ].filter(Boolean).join(' ')}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-[left] duration-150 ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}
