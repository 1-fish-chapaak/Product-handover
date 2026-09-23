import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, ListFilter, Plus, Search } from 'lucide-react';
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

export interface SelectOption {
  value: string; label: string;
  /** Heading this option sits under. Options carrying the same group are shown
   *  together, in the order the group is first met. */
  group?: string;
}
const norm = (o: string | SelectOption): SelectOption => typeof o === 'string' ? { value: o, label: o } : o;

/** A row pinned under the list — "add one that isn't here". It stays put while
 *  the list scrolls and survives a search that matches nothing, because it is
 *  exactly then that it is wanted. */
export interface SelectAction { label: string; onClick: () => void }

function OptionsPopover({ open, onClose, options, value, onSelect, align, menuCls, ariaLabel, searchPlaceholder, action, anchor }: {
  open: boolean; onClose: () => void; options: SelectOption[]; value: string;
  onSelect: (v: string) => void; align: 'left' | 'right'; menuCls?: string; ariaLabel?: string;
  /** Set to put a search box above the list. Worth it past a dozen options. */
  searchPlaceholder?: string;
  action?: SelectAction;
  /** Where to pin the menu when it has to escape a clipping parent — a modal
   *  (`.modal` is overflow:hidden) or a scrolling table would otherwise cut it
   *  off, and the row pinned under the list is the first thing lost. */
  anchor?: { top: number; left: number; width: number } | null;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState('');

  // Every opening starts from the whole list — a search left over from last
  // time would hide options without saying why.
  useEffect(() => { if (!open) setQuery(''); }, [open]);

  // Escape shuts the menu and nothing else. Caught on the way DOWN so it lands
  // before the dialog's own Escape-to-close — otherwise picking a company and
  // changing your mind would throw away the whole upload.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // The group name matches too: typing a client group is a fair way to ask
    // for the companies under it.
    return options.filter(o => o.label.toLowerCase().includes(q) || (o.group ?? '').toLowerCase().includes(q));
  }, [options, query]);

  const menu = (
    <AnimatePresence>
      {open && (
        <>
          <div className={cn('inset-0', anchor ? 'fixed z-40' : 'fixed z-10')} onClick={onClose} />
          <motion.div {...(reduce ? {} : POP_ANIM)} transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
            style={anchor ? { top: anchor.top, left: anchor.left, width: anchor.width } : undefined}
            className={cn('flex flex-col bg-canvas-elevated border border-canvas-border rounded-lg shadow-lg max-h-72',
              anchor ? 'fixed z-50 origin-top-left' : 'absolute top-full mt-1 z-20',
              !anchor && (align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'),
              !anchor && (menuCls ?? 'min-w-[200px]'))}>

            {searchPlaceholder && (
              <div className="shrink-0 flex items-center gap-2 px-2.5 py-2 border-b border-canvas-border">
                <Search size={13} className="text-ink-400 shrink-0" aria-hidden />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={searchPlaceholder} aria-label={searchPlaceholder}
                  className="w-full bg-transparent text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none" />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-1.5" role="listbox" aria-label={ariaLabel}>
              {shown.length === 0 && (
                <p className="px-2.5 py-3 text-[0.75rem] text-ink-400">Nothing matches “{query.trim()}”.</p>
              )}
              {shown.map((opt, i) => {
                const current = opt.value === value;
                const heading = opt.group && opt.group !== shown[i - 1]?.group;
                return (
                  <div key={opt.value + (opt.group ?? '')}>
                    {heading && (
                      <p className={cn('px-2.5 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400', i > 0 && 'pt-2')}>{opt.group}</p>
                    )}
                    <button type="button" role="option" aria-selected={current}
                      onClick={() => onSelect(opt.value)}
                      className={cn('w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-md text-[12px] cursor-pointer transition-colors',
                        current ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas')}>
                      <span className="truncate">{opt.label}</span>
                      {current && <Check size={13} className="shrink-0" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {action && (
              <div className="shrink-0 p-1.5 border-t border-canvas-border">
                <button type="button" onClick={action.onClick}
                  className="w-full flex items-center gap-1.5 text-left px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 cursor-pointer transition-colors">
                  <Plus size={13} className="shrink-0" aria-hidden /> {action.label}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
  return anchor !== undefined ? createPortal(menu, document.body) : menu;
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

/** Column-header filter — the column label itself is the trigger (funnel tints
 *  brand while engaged). The menu portals to <body>: table wrappers clip
 *  overflow, so an in-place popover would be cut off. */
export function HeaderFilter({ label, value, options, allLabel, onChange, ariaLabel, engaged }: {
  label: string; value: string; options: readonly (string | SelectOption)[]; allLabel?: string;
  onChange: (v: string) => void; ariaLabel: string; engaged?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const opts = options.map(norm).map(o => (o.value === 'All' && allLabel ? { ...o, label: allLabel } : o));
  const isEngaged = engaged ?? value !== 'All';
  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };
  return (
    <>
      <button ref={btnRef} onClick={toggleOpen} aria-label={ariaLabel} aria-expanded={open}
        className={cn('inline-flex items-center gap-1 cursor-pointer transition-colors', isEngaged ? 'text-brand-700' : 'hover:text-ink-700')}>
        {label}
        <ListFilter size={11} className={cn('shrink-0', isEngaged ? 'text-brand-600' : 'text-ink-400')} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <motion.div {...(reduce ? {} : POP_ANIM)} transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
                style={{ top: pos.top, left: pos.left }}
                className="fixed z-50 bg-canvas-elevated border border-canvas-border rounded-lg p-1.5 shadow-lg max-h-72 overflow-y-auto min-w-[200px] origin-top-left"
                role="listbox" aria-label={ariaLabel}>
                {opts.map(opt => {
                  const current = opt.value === value;
                  return (
                    <button key={opt.value} role="option" aria-selected={current}
                      onClick={() => { onChange(opt.value); setOpen(false); }}
                      className={cn('w-full flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-md text-[12px] normal-case tracking-normal cursor-pointer transition-colors',
                        current ? 'text-brand-700 font-semibold bg-brand-50' : 'text-ink-700 hover:bg-canvas')}>
                      <span className="truncate">{opt.label}</span>
                      {current && <Check size={13} className="shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body)}
    </>
  );
}

/** Form-field dropdown — drop-in for a native <select>: pass the same className
 *  the input used; value/label options; the menu opens in the product language. */
export function FormSelect({ value, options, onChange, className, ariaLabel, align = 'left', menuCls, placeholder, searchPlaceholder, action, portal }: {
  value: string; options: readonly (string | SelectOption)[]; onChange: (v: string) => void;
  className?: string; ariaLabel?: string; align?: 'left' | 'right'; menuCls?: string;
  /** Shown, muted, while nothing is chosen (`value` is ''). */
  placeholder?: string;
  /** Set to put a search box above the list. Worth it past a dozen options. */
  searchPlaceholder?: string;
  /** A row pinned under the list, for adding one the list doesn't have. */
  action?: SelectAction;
  /** Set inside a modal or any other clipping parent — the menu then hangs off
   *  <body> and is pinned under the trigger, instead of being cut off. */
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const opts = options.map(norm);
  const label = opts.find(o => o.value === value)?.label ?? value;
  const empty = !label && !!placeholder;
  const toggle = () => {
    if (!open && portal && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setAnchor({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };
  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={toggle} aria-label={ariaLabel} aria-expanded={open}
        className={cn(className, 'inline-flex items-center justify-between gap-2 text-left cursor-pointer', open && 'border-brand-300')}>
        <span className={cn('truncate', empty && 'text-ink-400')}>{empty ? placeholder : label}</span>
        <ChevronDown size={14} className={cn('shrink-0 transition-transform', open ? 'rotate-180 text-brand-600' : 'text-ink-400')} />
      </button>
      <OptionsPopover open={open} onClose={() => setOpen(false)} options={opts} value={value}
        onSelect={v => { onChange(v); setOpen(false); }} align={align} menuCls={menuCls ?? 'w-full min-w-[180px]'} ariaLabel={ariaLabel}
        searchPlaceholder={searchPlaceholder} action={action ? { ...action, onClick: () => { setOpen(false); action.onClick(); } } : undefined}
        {...(portal ? { anchor } : {})} />
    </div>
  );
}
