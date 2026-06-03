import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

// Custom date picker that matches the app's design tokens.
// `value` and `onChange` use ISO format (YYYY-MM-DD) so it stays compatible
// with native input behavior. Opens downward by default. Optionally pass
// `minDate` (ISO YYYY-MM-DD) to disable any day strictly before that date.
export function CustomDatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  minDate,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());

  // Normalize minDate into a Date floored to midnight for comparison.
  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : null;
  const isBeforeMin = (d: Date) => {
    if (!minDateObj) return false;
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const b = new Date(
      minDateObj.getFullYear(),
      minDateObj.getMonth(),
      minDateObj.getDate(),
    ).getTime();
    return a < b;
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const formatDisplay = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
  const toISO = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Build 6-week grid starting Sunday
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(viewYear, viewMonth, 1 - startWeekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
  };
  const selectDate = (d: Date) => {
    if (isBeforeMin(d)) return;
    onChange(toISO(d));
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(false);
  };
  const goToday = () => {
    if (isBeforeMin(today)) return;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    selectDate(today);
  };
  const clearDate = () => {
    onChange('');
    setOpen(false);
  };

  const isSameDay = (a: Date, b: Date | null) =>
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border-light bg-white text-[13px] text-text hover:border-primary/30 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all cursor-pointer"
      >
        <span className={parsed ? 'text-text' : 'text-text-muted/70'}>
          {parsed ? formatDisplay(parsed) : placeholder}
        </span>
        <Calendar size={14} className="text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-[300px] rounded-lg border border-border-light bg-white shadow-lg p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold text-text">{monthName}</div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={goPrevMonth}
                className="w-7 h-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text cursor-pointer transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                className="w-7 h-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-text-muted hover:text-text cursor-pointer transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div
                key={i}
                className="h-7 flex items-center justify-center text-[11px] font-semibold text-text-muted"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth;
              const isToday = isSameDay(d, today);
              const isSelected = isSameDay(d, parsed);
              const disabled = isBeforeMin(d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={disabled ? undefined : () => selectDate(d)}
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  className={`h-8 rounded-md text-[12px] font-medium transition-colors ${
                    disabled
                      ? 'text-ink-300 cursor-not-allowed bg-transparent'
                      : isSelected
                        ? 'bg-primary text-white hover:bg-primary-hover cursor-pointer'
                        : isToday
                          ? 'border border-primary text-primary hover:bg-primary/5 cursor-pointer'
                          : inMonth
                            ? 'text-text hover:bg-surface-2 cursor-pointer'
                            : 'text-text-muted/40 hover:bg-surface-2 cursor-pointer'
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-light">
            <button
              type="button"
              onClick={clearDate}
              className="text-[12px] font-semibold text-primary hover:text-primary-hover cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={goToday}
              disabled={isBeforeMin(today)}
              className={`text-[12px] font-semibold ${
                isBeforeMin(today)
                  ? 'text-ink-300 cursor-not-allowed'
                  : 'text-primary hover:text-primary-hover cursor-pointer'
              }`}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomDatePicker;
