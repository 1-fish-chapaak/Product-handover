/**
 * Add RACM (S11) — copy RACMs from the Engagements page's RACM tab into this
 * engagement's Control library.
 *
 * The engagement no longer has a RACM tab of its own: RACMs are kept once, on the
 * Engagements page, and an engagement takes a COPY of the ones it tests. So this
 * dialog is a picker over that tab — tick any mix, see how many controls come in —
 * with the tab's own Create RACM flow one button away for a matrix that isn't
 * there yet. Whatever is uploaded here lands on the tab first, then comes back
 * ticked, so there is still only one place a RACM is ever created.
 *
 * Control IDs must stay unique inside an engagement. Two RACMs written for the
 * same process at the same company both number from R001/C001, so the clash
 * check runs as boxes are ticked and the add waits until it's clear — the store
 * refuses the same set anyway, this just says why before the button is pressed.
 *
 * Auditor only, and not on a signed-off engagement — the callers gate the button
 * and the store gates the action.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Plus, Search, UploadCloud, X } from 'lucide-react';
import { useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { cn } from '../../lib/cn';
import { useIcfr } from './store';
import { isEngagementLocked } from './helpers';
import CreateRacmFlow from './CreateRacmFlow';
import { clashSummary, controlIdClashes, racmStatus, useRacmLibrary, type LibraryRacm } from './racmLibrary';

/** Already copied into this engagement — shown, but can't be ticked again. */
const usedHere = (r: LibraryRacm, engId: string) => r.usedBy.some(u => u.id === engId);
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export default function AddRacmModal({ onClose }: { onClose: () => void }) {
  const { eng, role, addLibraryRacms } = useIcfr();
  const racms = useRacmLibrary();
  const { addToast } = useToast();
  const logEvent = useAuditLog();

  const [q, setQ] = useState('');
  const [process, setProcess] = useState('All');
  /** Ticked RACM ids, in the order they were ticked. */
  const [ticked, setTicked] = useState<string[]>([]);
  /** Create RACM is open in place of the list. */
  const [uploading, setUploading] = useState(false);

  // Focus goes back to whatever opened the dialog when it closes. Read during the
  // first render — by the time an effect runs, the search box has already taken it.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const close = () => { opener?.focus?.(); onClose(); };
  // Escape closes — but not while Create RACM is up, which handles its own.
  useEffect(() => {
    if (uploading) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { opener?.focus?.(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, opener, uploading]);

  const processes = useMemo(() => Array.from(new Set(racms.map(r => r.process))).sort((a, b) => a.localeCompare(b)), [racms]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hit = racms.filter(r => (process === 'All' || r.process === process)
      // Drafts are not offered: the engagement would copy nothing, because only
      // published rows are copied. An empty RACM added to a register is worse
      // than one that was never listed.
      && racmStatus(r).status !== 'Draft'
      && (!term || `${r.name} ${r.process} ${r.entity} ${r.fileName ?? ''}`.toLowerCase().includes(term)));
    // What can still be added leads; what this engagement already copied follows, greyed.
    return [...hit.filter(r => !usedHere(r, eng.id)), ...hit.filter(r => usedHere(r, eng.id))];
  }, [racms, q, process, eng.id]);

  // Ticks survive the search and the filter, so the footer counts every one of them.
  const picked = useMemo(
    () => ticked.map(id => racms.find(r => r.id === id)).filter((r): r is LibraryRacm => !!r && !usedHere(r, eng.id)),
    [ticked, racms, eng.id],
  );
  // Published rows only — the same rows `copyRacmControls` will hand over, so
  // the footer never promises a number the engagement doesn't receive.
  const controlCount = picked.reduce((n, r) => n + racmStatus(r).publishedCount, 0);
  const clashes = useMemo(() => (picked.length
    ? clashSummary(controlIdClashes([
      { name: 'this engagement', controls: eng.controls },
      ...picked.map(r => ({ name: r.name, controls: r.controls })),
    ]))
    : []), [picked, eng.controls]);
  const canAdd = role === 'auditor' && !isEngagementLocked(eng);
  // A RACM with no rows would add nothing, and the store reports that the same way
  // as a refusal — so an empty pick simply isn't addable.
  const ready = canAdd && picked.length > 0 && controlCount > 0 && clashes.length === 0;

  const toggle = (id: string) => setTicked(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));

  const add = () => {
    if (!picked.length) return;
    const added = addLibraryRacms(picked.map(r => r.id));
    if (added === 0) {
      const why = role !== 'auditor' ? 'Only the auditor can add RACMs to an engagement.'
        : isEngagementLocked(eng) ? 'This engagement is signed off, so nothing more can be added to it.'
        : clashes.length ? `${clashes[0]}. Untick one of them first.`
        : 'Those RACMs are no longer on the RACM tab.';
      addToast({ type: 'error', title: "RACMs weren't added", message: why });
      return;
    }
    logEvent({
      action: 'Create',
      description: `Added ${picked.map(r => `"${r.name}"`).join(', ')} from the RACM tab to ${eng.name} — ${plural(added, 'control')}`,
      module: 'SOX ICFR',
      entity: 'RACM',
    });
    addToast({ type: 'success', title: `${plural(picked.length, 'RACM')} added`, message: `${plural(added, 'control')} added to the Control library.` });
    close();
  };

  if (uploading) {
    return createPortal(
      <CreateRacmFlow
        onClose={() => setUploading(false)}
        onCreated={racm => {
          setUploading(false);
          // clear the list's filters so the new RACM is in view, ticked
          setQ('');
          setProcess('All');
          setTicked(t => (t.includes(racm.id) ? t : [...t, racm.id]));
          addToast({ type: 'success', title: 'Saved to the RACM tab', message: `${racm.name} is ticked — add it with the rest.` });
        }}
      />,
      document.body,
    );
  }

  const addLabel = picked.length ? `Add ${plural(picked.length, 'RACM')} · ${plural(controlCount, 'control')}` : 'Add RACMs';

  return createPortal(
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="add-racm-title" aria-describedby="add-racm-desc">
        <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="add-racm-title" className="text-[0.9375rem] font-semibold text-ink-900">Add RACM</h2>
              <p id="add-racm-desc" className="text-[0.78125rem] text-ink-500 mt-0.5">
                Pick RACMs from the RACM tab on the Engagements page. Their controls are copied into this engagement's Control library.
              </p>
            </div>
            <button onClick={close} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer shrink-0" aria-label="Close"><X size={15} /></button>
          </div>
        </div>

        <div className="px-5 pt-4 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[10rem]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Search RACMs or companies…" aria-label="Search RACMs"
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200" />
          </div>
          <select value={process} onChange={e => setProcess(e.target.value)} aria-label="Filter by process"
            className="h-9 max-w-full px-2.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.78125rem] text-ink-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-200">
            <option value="All">All processes</option>
            {processes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={() => setUploading(true)} title="Import a matrix, or extract one from an SOP — it's saved to the RACM tab, then ticked here"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 hover:border-ink-300 transition-colors cursor-pointer">
            <UploadCloud size={14} /> Upload RACM
          </button>
        </div>

        <ul className="px-5 py-3 max-h-[min(50vh,26rem)] overflow-y-auto space-y-1.5" aria-label="RACMs on the RACM tab">
          {rows.map(r => {
            const here = usedHere(r, eng.id);
            const on = !here && ticked.includes(r.id);
            return (
              <li key={r.id}>
                <label className={cn('flex items-start gap-2.5 px-3 py-2.5 rounded-lg border transition-colors',
                  here ? 'border-canvas-border bg-paper-50/60 cursor-not-allowed'
                    : on ? 'border-brand-300 bg-brand-50/50 cursor-pointer'
                    : 'border-canvas-border hover:border-ink-300 cursor-pointer')}>
                  <input type="checkbox" checked={on} disabled={here} onChange={() => toggle(r.id)}
                    className="mt-0.5 shrink-0 accent-brand-600 cursor-pointer disabled:cursor-not-allowed" />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[0.8125rem] font-semibold truncate', here ? 'text-ink-500' : 'text-ink-900')} title={r.name}>{r.name}</span>
                    <span className="mt-0.5 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap text-[0.71875rem] text-ink-500">
                      <span>{r.process}</span>
                      <span aria-hidden className="text-ink-300">·</span>
                      <span>{r.entity || '—'}</span>
                      <span aria-hidden className="text-ink-300">·</span>
                      {/* The count is what will actually be copied, not the row
                          count — a matrix with additions still being written
                          would otherwise promise controls it can't hand over. */}
                      <span className="tabular-nums">{plural(racmStatus(r).publishedCount, 'control')}</span>
                      {racmStatus(r).draftCount > 0 && (
                        <>
                          <span aria-hidden className="text-ink-300">·</span>
                          <span title="Draft rows stay on the RACM tab until they are published">{racmStatus(r).draftCount} not published yet</span>
                        </>
                      )}
                      {r.usedBy.length > 0 && (
                        <>
                          <span aria-hidden className="text-ink-300">·</span>
                          <span title={r.usedBy.map(u => u.name).join('\n')}>Used by {r.usedBy.length}</span>
                        </>
                      )}
                    </span>
                    {here && <span className="block mt-1 text-[0.71875rem] font-medium text-ink-400">Already in this engagement</span>}
                  </span>
                </label>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="py-10 text-center text-[0.78125rem] text-ink-400">
              {racms.length ? 'No RACMs match. Clear the search or pick another process.' : 'No RACMs on the RACM tab yet. Upload one to start.'}
            </li>
          )}
        </ul>

        {/* Why the add is waiting — one line per pair of RACMs that share IDs. */}
        {clashes.length > 0 && (
          <div role="alert" className="mx-5 mb-3 rounded-lg border border-high-200 bg-high-50 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-high-700 shrink-0 mt-0.5" />
            <div className="min-w-0 text-[0.75rem] text-ink-700 leading-relaxed">
              {clashes.map(line => <p key={line}>{line}.</p>)}
              <p className="text-ink-500 mt-0.5">A control ID can only appear once in an engagement. Untick one of them to continue.</p>
            </div>
          </div>
        )}

        <div className="px-5 py-3.5 border-t border-canvas-border bg-paper-50/40 flex items-center justify-end gap-2 flex-wrap">
          <button onClick={close} className="h-9 px-3.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
          <button onClick={add} disabled={!ready}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold enabled:hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            <Plus size={15} /> {addLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
