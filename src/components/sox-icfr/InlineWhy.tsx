import { useState } from 'react';
import { X } from 'lucide-react';

/** The manual override, said in one line. Flipping a tick used to happen
 *  silently; now the click opens this line — why, plus an optional evidence
 *  link — and only a saved why changes the result. One inline field, no modal:
 *  the reviewer stays on the row they are judging. */
export default function InlineWhy({ target, iraSaid, onSave, onCancel }: {
  target: 'Pass' | 'Fail';
  iraSaid?: 'Pass' | 'Fail';
  onSave: (rationale: string, evidence?: string) => void;
  onCancel: () => void;
}) {
  const [why, setWhy] = useState('');
  const [evidence, setEvidence] = useState('');
  const ok = why.trim().length > 0;
  const save = () => { if (ok) onSave(why.trim(), evidence.trim() || undefined); };
  // Enter saves from either field, Escape backs out — the line never needs the mouse.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  // Naming Ira's own verdict tells the reviewer what they are disagreeing with.
  const placeholder = iraSaid && iraSaid !== target
    ? `Ira found this ${iraSaid === 'Pass' ? 'passes' : 'fails'} — say what you saw`
    : 'Say what you saw';
  const field = 'h-8 rounded-lg border border-canvas-border bg-canvas-elevated px-2.5 text-[0.75rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-300 transition-colors';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[0.75rem] font-semibold text-ink-700 whitespace-nowrap">Mark as {target.toLowerCase()} — why?</span>
      <input autoFocus value={why} onChange={e => setWhy(e.target.value)} onKeyDown={onKey}
        aria-label={`Why mark this as ${target.toLowerCase()}`} placeholder={placeholder}
        className={`${field} flex-1 min-w-48`} />
      <input value={evidence} onChange={e => setEvidence(e.target.value)} onKeyDown={onKey}
        aria-label="Evidence link or file name (optional)" placeholder="Evidence link (optional)"
        className={`${field} w-44`} />
      <button onClick={save} disabled={!ok}
        className="h-8 px-3 rounded-lg bg-brand-600 text-white text-[0.75rem] font-semibold disabled:opacity-40 enabled:hover:bg-brand-700 transition-colors cursor-pointer">Save</button>
      <button onClick={onCancel} aria-label="Cancel override" title="Cancel"
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer"><X size={14} /></button>
    </div>
  );
}
