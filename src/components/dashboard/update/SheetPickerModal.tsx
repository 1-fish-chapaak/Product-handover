import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { FileSpreadsheet } from 'lucide-react';
import Checkbox from '../../shared/Checkbox';
import { Button } from '../../shared/Button';
import type { SheetPickerItem } from './useFilePool';

/** Which sheets of a multi-sheet workbook become pool entries. One picker per
 *  workbook, queued ("File 1 of 2") when several were dropped at once. Sits
 *  above the Update-dashboard dialog, and swallows Escape in the capture phase
 *  so the dialog underneath doesn't close with it. */
export default function SheetPickerModal({ item, position, onConfirm, onCancel }: {
  item: SheetPickerItem;
  position: { current: number; total: number } | null;
  onConfirm: (sheetNames: string[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(item.sheets));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const toggle = (sheet: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(sheet)) next.delete(sheet); else next.add(sheet);
    return next;
  });
  const count = picked.size;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-ink-900/40" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label="Choose sheets"
        className="relative w-full max-w-[440px] bg-canvas-elevated rounded-2xl border border-canvas-border shadow-xl flex flex-col"
        data-testid="sheet-picker"
      >
        <header className="px-6 pt-5 pb-3 border-b border-canvas-border">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl leading-tight font-semibold text-ink-900 tracking-tight">Choose sheets</h2>
            {position && position.total > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold tabular-nums shrink-0">
                File {position.current} of {position.total}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-500 mt-1 min-w-0">
            <FileSpreadsheet size={13} className="text-brand-600 shrink-0" />
            <span className="truncate" title={item.file.name}>{item.file.name}</span>
            <span className="shrink-0">· each picked sheet becomes its own pool entry</span>
          </p>
        </header>
        <ul className="px-6 py-3 max-h-[300px] overflow-y-auto flex flex-col gap-1">
          {item.sheets.map(sheet => {
            const on = picked.has(sheet);
            return (
              <li key={sheet}>
                <button
                  type="button"
                  onClick={() => toggle(sheet)}
                  className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg border text-left text-sm transition-colors cursor-pointer ${on ? 'border-brand-200 bg-brand-50/60 text-ink-900' : 'border-canvas-border bg-canvas-elevated text-ink-700 hover:border-brand-200'}`}
                >
                  <Checkbox checked={on} ariaLabel={sheet} />
                  <span className="truncate">{sheet}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="px-6 py-3 border-t border-canvas-border flex items-center justify-end gap-2">
          <Button variant="outline" size="md" onClick={onCancel}>Skip this file</Button>
          <Button variant="primary" size="md" disabled={count === 0} onClick={() => onConfirm([...item.sheets.filter(s => picked.has(s))])}>
            Use {count} sheet{count === 1 ? '' : 's'}
          </Button>
        </footer>
      </motion.div>
    </div>,
    document.body,
  );
}
