import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Check } from 'lucide-react';
import { motion } from 'motion/react';

// Large choice card used on Screen 1 (method selection) and Screen 6 (decision).
export default function MethodSelectionCard({
  icon: Icon, title, description, ctaLabel, onClick, disabled, disabledHint, index = 0, selected,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  index?: number;
  /** Highlight this card as the active choice (combined method+upload step). */
  selected?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      title={disabled ? disabledHint : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={disabled ? undefined : { y: -3 }}
      className={`group text-left flex flex-col rounded-lg border p-5 min-h-[150px] transition-[border-color,box-shadow] ${
        disabled
          ? 'border-canvas-border bg-canvas-elevated opacity-55 cursor-not-allowed'
          : selected
            ? 'border-brand-400 bg-brand-50/40 shadow-[0_10px_28px_rgba(15,8,30,0.07)] cursor-pointer'
            : 'border-canvas-border bg-canvas-elevated hover:border-brand-200 hover:shadow-[0_10px_28px_rgba(15,8,30,0.07)] cursor-pointer'
      }`}
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-brand-50 text-brand-600 mb-3">
        <Icon size={18} aria-hidden="true" />
      </span>
      <h3 className="text-[0.875rem] font-semibold text-ink-900 mb-1">{title}</h3>
      <p className="text-[0.75rem] text-ink-500 leading-relaxed flex-1">{description}</p>
      <span className={`mt-4 inline-flex items-center gap-1.5 text-[0.78125rem] font-semibold ${disabled ? 'text-ink-400' : 'text-brand-700'}`}>
        {disabled ? (disabledHint ?? ctaLabel) : selected ? 'Selected' : ctaLabel}
        {!disabled && (selected
          ? <Check size={15} aria-hidden="true" />
          : <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />)}
      </span>
    </motion.button>
  );
}
