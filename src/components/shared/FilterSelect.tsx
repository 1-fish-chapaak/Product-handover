import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Themed dropdowns for the SOX module — the native <select> popup can't be
 * styled (OS chrome), so these render the product's own popover menu instead:
 * brand-50 active row with a check, fade-slide open, Escape-free scrim close.
 * `FilterSelect` is the toolbar filter (funnel icon / label prefix, brand tint
 * when engaged); `FormSelect` is the drop-in for form-field selects and takes
 * the same className as the input it replaces.
 */

export const POP_ANIM = { initial: { opacity: 0, y: -4, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -4, scale: 0.98 } };

export function triggerCls(engaged: boolean, open: boolean): string {
  return cn(
    'inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-[12.5px] font-semibold transition-colors cursor-pointer',
    engaged ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
      : open ? 'border-brand-600 bg-canvas text-brand-700'
      : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-200',
  );
}

export interface SelectOption { value: string; label: string }
const norm = (o: string | SelectOption): SelectOption => typeof o === 'string' ? { value: o, label: o } : o;

function OptionsPopover({ open, onClose, options, value, onSelect, align, menuCls, ariaLabel }: {
  open: boolean; onClose: () => void; options: SelectOption[]; value: string;
  onSelect: (v: string) => void; align: 'left' | 'right'; menuCls?: string; ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <motion.div {...(reduce ? {} : POP_ANIM)} transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
            className={cn('absolute top-full mt-1 z-20 bg-canvas-elevated border border-canvas-border rounded-lg p-1.5 shadow-lg max-h-72 overflow-y-auto',
              align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left', menuCls ?? 'min-w-[200px]')}
            role="listbox" aria-label={ariaLabel}>
            {options.map(opt => {
              const current = opt.value === value;
              return (
                <button key={opt.value} role="option" aria-selected={current}
                  onClick={() => onSelect(opt.value)}
                  className={cn('w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors',
                    current ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas')}>
                  <span className="truncate">{opt.label}</span>
                  {current && <Check size={13} className="shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Toolbar filter dropdown. An 'All' option is relabelled via `allLabel`; the
 *  trigger tints brand while the filter is engaged (anything but 'All', or the
 *  caller's `engaged` override for non-'All' sentinels). */
export function FilterSelect({ value, options, allLabel, onChange, ariaLabel, prefix, engaged, align = 'left' }: {
  value: string; options: readonly (string | SelectOption)[]; allLabel?: string;
  onChange: (v: string) => void; ariaLabel: string;
  /** Uppercase text label shown instead of the funnel icon (e.g. "Status"). */
  prefix?: string; engaged?: boolean; align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const opts = options.map(norm).map(o => (o.value === 'All' && allLabel ? { ...o, label: allLabel } : o));
  const isEngaged = engaged ?? value !== 'All';
  const label = opts.find(o => o.value === value)?.label ?? value;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className={triggerCls(isEngaged, open)} aria-label={ariaLabel} aria-expanded={open}>
        {prefix
          ? <span className={cn('text-[11px] font-semibold uppercase tracking-wide', isEngaged ? 'text-brand-600' : 'text-ink-400')}>{prefix}</span>
          : <ListFilter size={13} className={isEngaged ? 'text-brand-600' : 'text-ink-400'} />}
        {label}
        <ChevronDown size={14} className={cn('transition-transform', open ? 'rotate-180 text-brand-600' : 'text-ink-400')} />
      </button>
      <OptionsPopover open={open} onClose={() => setOpen(false)} options={opts} value={value}
        onSelect={v => { onChange(v); setOpen(false); }} align={align} ariaLabel={ariaLabel} />
    </div>
  );
}

/** Form-field dropdown — drop-in for a native <select>: pass the same className
 *  the input used; value/label options; the menu opens in the product language. */
export function FormSelect({ value, options, onChange, className, ariaLabel, align = 'left', menuCls }: {
  value: string; options: readonly (string | SelectOption)[]; onChange: (v: string) => void;
  className?: string; ariaLabel?: string; align?: 'left' | 'right'; menuCls?: string;
}) {
  const [open, setOpen] = useState(false);
  const opts = options.map(norm);
  const label = opts.find(o => o.value === value)?.label ?? value;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={ariaLabel} aria-expanded={open}
        className={cn(className, 'inline-flex items-center justify-between gap-2 text-left cursor-pointer', open && 'border-brand-300')}>
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={cn('shrink-0 transition-transform', open ? 'rotate-180 text-brand-600' : 'text-ink-400')} />
      </button>
      <OptionsPopover open={open} onClose={() => setOpen(false)} options={opts} value={value}
        onSelect={v => { onChange(v); setOpen(false); }} align={align} menuCls={menuCls ?? 'w-full min-w-[180px]'} ariaLabel={ariaLabel} />
    </div>
  );
}
