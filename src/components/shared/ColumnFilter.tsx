import React, { useEffect, useRef, useState } from 'react';
import { Filter, Check, ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  align?: 'start' | 'end';
  /** Trigger style. `icon` (default) is a tiny funnel button used inside column
      headers. `button` renders a full CTA-style pill with label + chevron. */
  variant?: 'icon' | 'button';
}

export default function ColumnFilter({ label, options, value, onChange, align = 'start', variant = 'icon' }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const hasFilter = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };

  return (
    <span ref={wrapRef} className="relative inline-flex">
      {variant === 'button' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] border text-[12px] font-medium cursor-pointer transition-colors ${
            hasFilter
              ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-50/80'
              : 'border-border bg-white text-ink-700 hover:bg-paper-50'
          }`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <span>{label}</span>
          {hasFilter && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand-600 text-paper-0 text-[10px] font-mono tabular-nums">
              {value.length}
            </span>
          )}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          className={`w-5 h-5 inline-flex items-center justify-center rounded-[4px] cursor-pointer transition-colors ${
            hasFilter ? 'text-brand-700 bg-brand-50' : 'text-ink-400 hover:text-brand-700 hover:bg-paper-100'
          }`}
          aria-label={`Filter ${label}`}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <Filter size={11} strokeWidth={2} />
          {hasFilter && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-brand-600" />
          )}
        </button>
      )}
      {open && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-[200px] bg-white border border-border-light rounded-[8px] shadow-lg normal-case tracking-normal ${align === 'end' ? 'right-0' : 'left-0'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-border-light flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Filter {label}</span>
            {hasFilter && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] text-brand-700 hover:text-brand-600 cursor-pointer font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <ul className="py-1 max-h-[240px] overflow-y-auto">
            {options.map(opt => {
              const checked = value.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[12px] text-ink-800 hover:bg-paper-50 cursor-pointer"
                  >
                    <span className={`w-3.5 h-3.5 inline-flex items-center justify-center rounded-[3px] border ${checked ? 'bg-brand-600 border-brand-600' : 'bg-white border-ink-300'}`}>
                      {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-ink-400 italic">No options</li>
            )}
          </ul>
        </div>
      )}
    </span>
  );
}
