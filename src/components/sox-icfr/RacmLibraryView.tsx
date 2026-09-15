/**
 * Engagements → RACM (S11). Every SOX RACM, outside any one engagement.
 *
 * What used to be each SOX engagement's RACM tab, moved up a level: Create RACM
 * (upload a matrix, or an SOP → prompt → extract), the import review, the list,
 * the spreadsheet editor in a new tab, and the ⋯ menu with View SOP and Delete.
 * One flat table (user ask, 15 Sep): a Process column says whose RACM each row
 * is, and the process filter narrows the same table rather than hiding groups.
 *
 * Pre-testing review is not here — it belongs to each engagement's copy.
 * Internal Audit and Compliance keep their own RACM screens; this tab is SOX only.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FileSpreadsheet, FileText, MoreHorizontal, Plus, Search, Table2, Trash2, X } from 'lucide-react';
import './register.css';
import { useAuditLog } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { FilterSelect } from '../shared/FilterSelect';
import { Dropdown, menuItem } from './ControlDossier';
import CreateRacmFlow from './CreateRacmFlow';
import { RACM_ROWS_KEY, racmEditorRows } from './helpers';
import { deleteLibraryRacm, racmInUse, useRacmLibrary, type LibraryRacm } from './racmLibrary';

/** The spreadsheet editor opens in its own tab, handed this RACM's rows first —
 *  the new tab has none of this page's state. */
function openEditorTab(r: LibraryRacm): void {
  try { window.localStorage.setItem(RACM_ROWS_KEY(r.id), JSON.stringify(racmEditorRows(r.controls, r.process))); } catch { /* storage blocked — the editor shows its sample */ }
  const params = new URLSearchParams({ view: 'racm-full-editor', racmId: r.id, racmName: r.name, processLabel: r.process });
  window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
}

/** Where a RACM came from, in a line. */
function sourceLine(r: LibraryRacm): string {
  if (r.source === 'engagement') return `From ${r.usedBy[0]?.name ?? 'an existing engagement'}`;
  const how = r.source === 'sop' ? 'Extracted from' : 'Imported from';
  return `${how} ${r.fileName ?? 'a file'} · ${r.createdBy} · ${r.createdAt}`;
}

// Menu rows that can be disabled keep a readable reason line under them, and the
// destructive row sits in risk tones — the same rule the engagement RACM menu used.
const menuRowCls = `${menuItem.replace('hover:bg-paper-50', 'enabled:hover:bg-paper-50').replace('items-center', 'items-start')} disabled:text-ink-400 disabled:cursor-not-allowed`;
const menuDangerCls = menuRowCls.replace('text-ink-700', 'text-risk-700').replace('enabled:hover:bg-paper-50', 'enabled:hover:bg-risk-50');

function RowActions({ racm, canManage, onDelete }: { racm: LibraryRacm; canManage: boolean; onDelete: () => void }) {
  const wrap = useRef<HTMLSpanElement>(null);
  // Dropdown draws its own trigger and takes no props for its name
  useLayoutEffect(() => {
    wrap.current?.querySelector('button')?.setAttribute('aria-label', `Actions for ${racm.name}`);
  }, [racm.name]);
  const blocker = racmInUse(racm);
  const logEvent = useAuditLog();
  return (
    <span ref={wrap} className="inline-flex" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      <Dropdown
        triggerClass="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-800 hover:bg-paper-50 transition-colors cursor-pointer [&>svg:last-child]:hidden"
        trigger={<MoreHorizontal size={15} />}
      >
        {close => (
          <>
            <button type="button" className={menuRowCls} onClick={() => { close(); openEditorTab(racm); }}>
              <FileSpreadsheet size={13} className="text-ink-400 mt-0.5 shrink-0" /> Open in spreadsheet editor
            </button>
            {racm.source === 'sop' && (
              <button type="button" className={menuRowCls} disabled={!racm.sopUrl}
                title={racm.sopUrl ? `Opens ${racm.fileName} in a new tab` : "The SOP file isn't available in this session"}
                onClick={() => {
                  close();
                  if (!racm.sopUrl) return;
                  window.open(racm.sopUrl, '_blank', 'noopener');
                  logEvent({ action: 'Export', description: `Opened "${racm.fileName}", the SOP behind ${racm.name}`, module: 'SOX ICFR', entity: 'RACM' });
                }}>
                <FileText size={13} className="text-ink-400 mt-0.5 shrink-0" /> View SOP
              </button>
            )}
            {canManage && (
              <>
                <div className="my-1 h-px bg-canvas-border" role="separator" />
                <button type="button" className={menuDangerCls} disabled={!!blocker} title={blocker ?? undefined}
                  onClick={() => { close(); onDelete(); }}>
                  <Trash2 size={13} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block">Delete RACM</span>
                    {blocker && <span className="block text-[0.6875rem] text-ink-500 whitespace-normal leading-snug">{blocker}</span>}
                  </span>
                </button>
              </>
            )}
          </>
        )}
      </Dropdown>
    </span>
  );
}

export default function RacmLibraryView({ canManage }: {
  /** Create and delete — the same permission that creates engagements. */
  canManage: boolean;
}) {
  const racms = useRacmLibrary();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const [search, setSearch] = useState('');
  const [process, setProcess] = useState('All');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LibraryRacm | null>(null);

  const processes = useMemo(() => Array.from(new Set(racms.map(r => r.process))).sort((a, b) => a.localeCompare(b)), [racms]);
  /** The rows on screen — newest first, as the tab keeps them, so a RACM just
   *  created lands at the top. */
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return racms.filter(r => (process === 'All' || r.process === process)
      && (!q || `${r.name} ${r.process} ${r.entity} ${r.fileName ?? ''} ${r.usedBy.map(u => u.name).join(' ')}`.toLowerCase().includes(q)));
  }, [racms, process, search]);

  const confirmDelete = (r: LibraryRacm) => {
    setDeleting(null);
    if (!deleteLibraryRacm(r.id)) {
      addToast({ type: 'warning', title: "Can't delete this RACM", message: `${racmInUse(r) ?? 'It is in use'}.` });
      return;
    }
    logEvent({ action: 'Delete', description: `Deleted ${r.name} from the RACM tab — ${r.controls.length} control${r.controls.length === 1 ? '' : 's'}`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({ type: 'success', title: 'RACM deleted', message: `${r.name} was removed from the RACM tab.` });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="racm-library-search"
            type="text"
            placeholder="Search RACM, company, file or engagement..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-[0.8125rem] border border-border rounded-lg bg-white text-text placeholder:text-text-muted outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
        <FilterSelect value={process} options={['All', ...processes]} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" />
        {(search || process !== 'All') && (
          <button onClick={() => { setSearch(''); setProcess('All'); }}
            className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-text-muted hover:text-primary px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors cursor-pointer">
            <X size={12} /> Clear
          </button>
        )}
        <div className="flex-1" />
        {canManage && (
          <button onClick={() => setCreating(true)}
            title="Create a RACM — import a matrix, or extract one from an SOP"
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer">
            <Plus size={14} />Create RACM
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="border border-border-light rounded-xl p-14 text-center bg-white">
          <Table2 size={32} className="text-text-muted mx-auto mb-3" />
          <p className="text-[0.875rem] font-semibold text-text mb-1">{racms.length ? 'No RACMs match your search' : 'No RACMs yet'}</p>
          <p className="text-[0.75rem] text-text-muted">{racms.length ? 'Try clearing the process filter or search.' : 'Create one from a matrix or an SOP.'}</p>
        </div>
      ) : (
        <>
          <div className="reg-wrap">
            <table className="w-full border-collapse" style={{ minWidth: 1020 }}>
              <thead className="reg-head">
                <tr>
                  <th>RACM</th>
                  <th style={{ width: 170 }}>Process</th>
                  <th style={{ width: 200 }}>Company</th>
                  <th style={{ width: 64 }}>Risks</th>
                  <th style={{ width: 76 }}>Controls</th>
                  <th style={{ width: 190 }}>Used by</th>
                  <th style={{ width: 190 }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const risks = new Set(r.controls.map(c => c.riskId)).size;
                  return (
                    <tr key={r.id} className="reg-row" role="button" tabIndex={0}
                      aria-label={`Open ${r.name} in the spreadsheet editor — opens in a new tab`}
                      onClick={() => openEditorTab(r)} onKeyDown={e => { if (e.key === 'Enter') openEditorTab(r); }}>
                      <td>
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Table2 size={15} /></span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink-900 truncate">{r.name}</span>
                            <span className="block text-[11.5px] text-ink-400 truncate">{sourceLine(r)}</span>
                          </span>
                        </span>
                      </td>
                      <td><span className="text-[12.5px] text-ink-700">{r.process}</span></td>
                      <td><span className="text-[12.5px] text-ink-700">{r.entity || '—'}</span></td>
                      <td><span className="tabular-nums font-medium text-ink-600">{risks}</span></td>
                      <td><span className="tabular-nums font-medium text-ink-600">{r.controls.length}</span></td>
                      <td>
                        {r.usedBy.length
                          ? <span className="block text-[12px] text-ink-700 leading-snug" title={r.usedBy.map(u => u.name).join('\n')}>
                              {r.usedBy[0]!.name}{r.usedBy.length > 1 && <span className="text-ink-400"> +{r.usedBy.length - 1}</span>}
                            </span>
                          : <span className="text-[12px] text-ink-400">Not used yet</span>}
                      </td>
                      <td>
                        <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-500">
                            <FileSpreadsheet size={13} className="text-ink-400" /> Spreadsheet editor <ExternalLink size={12} className="text-ink-400" />
                          </span>
                          <RowActions racm={r} canManage={canManage} onDelete={() => setDeleting(r)} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 px-1 text-[0.6875rem] text-text-muted tabular-nums">{shown.length} of {racms.length} RACMs</p>
        </>
      )}

      {creating && (
        <CreateRacmFlow onClose={() => setCreating(false)}
          onCreated={r => { setCreating(false); setProcess('All'); setSearch(''); addToast({ type: 'success', title: 'Saved to the RACM tab', message: `${r.name} — ${r.controls.length} control${r.controls.length === 1 ? '' : 's'}` }); }} />
      )}

      {deleting && (
        <div className="modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-library-racm-title"
            onKeyDown={e => { if (e.key === 'Escape') setDeleting(null); }}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
              <div className="flex items-center justify-between gap-3">
                <h2 id="delete-library-racm-title" className="text-[0.9375rem] font-semibold text-ink-900">Delete {deleting.name}?</h2>
                <button onClick={() => setDeleting(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[0.78125rem] text-ink-600 leading-relaxed">Its {deleting.controls.length} control{deleting.controls.length === 1 ? '' : 's'} go with it. No engagement uses it. This can't be undone.</p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setDeleting(null)} autoFocus className="h-9 px-3.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                <button onClick={() => confirmDelete(deleting)}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-risk-600 text-white text-[0.78125rem] font-semibold hover:bg-risk-700 transition-colors cursor-pointer">
                  <Trash2 size={13} /> Delete RACM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
