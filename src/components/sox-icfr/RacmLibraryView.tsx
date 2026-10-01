/**
 * Engagements → RACM (S11). Every SOX RACM, outside any one engagement.
 *
 * What used to be each SOX engagement's RACM tab, moved up a level: Create RACM
 * (upload a matrix, or an SOP → prompt → extract), the import review, the list,
 * the spreadsheet editor in a new tab, and the ⋯ menu with View SOP and Delete.
 * One flat list (user ask, 15 Sep): every RACM sits at the same level whoever
 * owns it, and the process filter narrows that list rather than hiding groups.
 * Cards OR rows (user ask, 1 Oct). Cards lead, because a RACM is a thing you
 * open rather than a record you read across: the grid answers "which one" and
 * every card is a door. The table answers the other question — comparing
 * thirteen matrices on process, company and size, which a grid makes you do by
 * memory. The toggle is the platform's own, in the place the Control Library
 * keeps it, so the two libraries are worked the same way.
 *
 * Pre-testing review is not here — it belongs to each engagement's copy.
 * Internal Audit and Compliance keep their own RACM screens; this tab is SOX only.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { CheckCircle2, FileSpreadsheet, FileText, History, LayoutGrid, List, Lock, MoreHorizontal, Search, Table2, Trash2, Workflow, X } from 'lucide-react';
import './register.css';
import { cn } from '../../lib/cn';
import { useAuditLog } from '../../context/AdminDataContext';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useToast } from '../shared/Toast';
import Drawer from '../shared/Drawer';
import { FilterSelect } from '../shared/FilterSelect';
import { Pill } from '../shared/StatusBadge';
import { Dropdown, menuItem } from './ControlDossier';
import CreateRacmFlow from './CreateRacmFlow';
import SopFlowchartView from './SopFlowchartView';
import { chartRowsFromControls } from './sopChartFromRacm';
import { currentVersion, deleteLibraryRacm, publishRacm, racmInUse, racmStatus, useRacmLibrary, writeEditorHandoff, type LibraryRacm } from './racmLibrary';

/** The spreadsheet editor opens in its own tab, handed this RACM's rows first —
 *  the new tab has none of this page's state. */
function openEditorTab(r: LibraryRacm): void {
  writeEditorHandoff(r);
  const params = new URLSearchParams({ view: 'racm-full-editor', racmId: r.id, racmName: r.name, processLabel: r.process });
  window.open(`${window.location.origin}${window.location.pathname}?${params.toString()}`, '_blank', 'noopener');
}

/** Where a RACM came from, in a line. An extracted one also carries a flowchart
 *  drawn off the same SOP, and whether that has been walked is part of where it
 *  came from — an unconfirmed chart is the SOP's account of the process, not the
 *  auditor's. */
function sourceLine(r: LibraryRacm): string {
  if (r.source === 'engagement') return `From ${r.usedBy[0]?.name ?? 'an existing engagement'}`;
  const how = r.source === 'sop' ? 'Extracted from' : 'Imported from';
  const chart = r.flowchart
    ? ` · flowchart ${r.flowchart.status === 'confirmed' ? `confirmed by ${r.flowchart.confirmedBy ?? 'the auditor'}` : 'unconfirmed'}`
    : '';
  return `${how} ${r.fileName ?? 'a file'} · ${r.createdBy} · ${r.createdAt}${chart}`;
}

// Menu rows that can be disabled keep a readable reason line under them, and the
// destructive row sits in risk tones — the same rule the engagement RACM menu used.
const menuRowCls = `${menuItem.replace('hover:bg-paper-50', 'enabled:hover:bg-paper-50').replace('items-center', 'items-start')} disabled:text-ink-400 disabled:cursor-not-allowed`;
const menuDangerCls = menuRowCls.replace('text-ink-700', 'text-risk-700').replace('enabled:hover:bg-paper-50', 'enabled:hover:bg-risk-50');

/** The one place the list says whether a RACM can be scoped from. Draft is the
 *  loud one: it reads as unfinished because that is exactly what it is, and a
 *  matrix nobody can pick up yet is the single most useful thing to see here. */
function StatusCell({ racm }: { racm: LibraryRacm }) {
  const { status, draftCount, publishedCount } = racmStatus(racm);
  const v = currentVersion(racm);
  if (status === 'Draft') return <Pill tone="draft">Draft</Pill>;
  return (
    <span className="inline-flex flex-col gap-0.5 items-start">
      <span className="inline-flex items-center gap-1.5">
        <Pill tone="compliant">Published</Pill>
        {/* The version is only meaningful once something has been published,
            which is why a draft never shows one. */}
        {v > 0 && <span className="font-mono text-[0.6875rem] text-ink-400 tabular-nums">v{v}</span>}
      </span>
      {status === 'Published · additions' && (
        <span className="text-[0.6875rem] text-ink-500" title={`${publishedCount} published, ${draftCount} still draft`}>
          +{draftCount} draft
        </span>
      )}
    </span>
  );
}

/**
 * THE TWO THINGS AN EXTRACTED RACM HAS THAT AN UPLOADED ONE DOES NOT.
 *
 * The user (29 Sep): "Jo bhi RCMs SOP se extract hongi, usmein RCM library wali
 * row mein View SOP, View Flowchart do button aayenge."
 *
 * View SOP was already here, buried in the ⋯ menu — a menu nobody opens to find
 * out what a row can do. It comes out onto the row and leaves the menu, so it is
 * offered once. View flowchart is new: until now the chart could be seen while
 * the RACM was being imported and never again.
 *
 * Only on `source === 'sop'` cards. A workbook has no procedure behind it and
 * nothing to draw a process from, so neither button would have an answer.
 *
 * Icon-only (user ask, 29 Sep): on a card the click that matters is the card
 * itself, so these two stay quiet and sit in the footer. Every one of them
 * carries an `aria-label` as well as its `title` — an icon button whose only
 * name is a tooltip has no name at all to a screen reader.
 */
const sopBtnCls = 'h-7 w-7 inline-flex items-center justify-center rounded-md border border-canvas-border bg-canvas '
  + 'text-ink-500 transition-colors cursor-pointer '
  + 'enabled:hover:border-brand-300 enabled:hover:text-brand-700 enabled:hover:bg-brand-50 '
  + 'disabled:text-ink-400 disabled:cursor-not-allowed';

/**
 * An icon button that says what it is on hover (user ask, 29 Sep).
 *
 * Written here rather than reached for: the repo has no shared tooltip, and
 * `group-hover` is the idiom it already uses for this kind of reveal.
 *
 * The `group` sits on the WRAPPER, not the button, because the SOP button is
 * disabled whenever the file has gone with the session — and a disabled button
 * is exactly when the reader most needs to be told why. Hover on a disabled
 * button does not fire reliably; hover on the span around it does.
 *
 * `title` is deliberately absent. With both, the browser draws its own tooltip
 * a second later on top of this one, which reads as a bug. The accessible name
 * comes from `aria-label`, so nothing is lost by dropping it.
 */
function IconButtonWithTip({ tip, label, disabled, onClick, children }: {
  tip: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex group">
      <button type="button" className={sopBtnCls} disabled={disabled} aria-label={label} onClick={onClick}>
        {children}
      </button>
      <span role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[0.6875rem] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {tip}
      </span>
    </span>
  );
}

function SopRowButtons({ racm, onFlowchart }: { racm: LibraryRacm; onFlowchart: () => void }) {
  const logEvent = useAuditLog();
  return (
    // The card itself opens the spreadsheet editor, so anything sitting on it
    // has to stop the click going through.
    <span className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      {/* `sopUrl` is an object URL minted when the file was read, so it dies
          with the session while the RACM outlives it. Saying that plainly beats
          a button that does nothing. */}
      <IconButtonWithTip
        disabled={!racm.sopUrl}
        label={`View the SOP behind ${racm.name}`}
        tip={racm.sopUrl ? 'View SOP' : "The SOP file isn't available in this session"}
        onClick={() => {
          if (!racm.sopUrl) return;
          window.open(racm.sopUrl, '_blank', 'noopener');
          logEvent({ action: 'Export', description: `Opened "${racm.fileName}", the SOP behind ${racm.name}`, module: 'SOX ICFR', entity: 'RACM' });
        }}>
        <FileText size={13} />
      </IconButtonWithTip>
      <IconButtonWithTip
        label={`View the flowchart for ${racm.name}`}
        tip="View flowchart"
        onClick={onFlowchart}>
        <Workflow size={13} />
      </IconButtonWithTip>
    </span>
  );
}

function RowActions({ racm, canManage, onDelete, onPublish, onHistory }: { racm: LibraryRacm; canManage: boolean; onDelete: () => void; onPublish: () => void; onHistory: () => void }) {
  const wrap = useRef<HTMLSpanElement>(null);
  // Dropdown draws its own trigger and takes no props for its name
  useLayoutEffect(() => {
    wrap.current?.querySelector('button')?.setAttribute('aria-label', `Actions for ${racm.name}`);
  }, [racm.name]);
  const blocker = racmInUse(racm);
  const { draftCount } = racmStatus(racm);
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
            {/* View SOP used to sit here. It is on the row now — see
                `SopRowButtons` — and offering it twice would just make the menu
                longer for no new answer. */}
            <button type="button" className={menuRowCls} onClick={() => { close(); onHistory(); }}>
              <History size={13} className="text-ink-400 mt-0.5 shrink-0" /> View history
            </button>
            {canManage && draftCount > 0 && (
              <button type="button" className={menuRowCls} onClick={() => { close(); onPublish(); }}>
                <CheckCircle2 size={13} className="text-ink-400 mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block">Publish {draftCount === racm.controls.length ? 'this RACM' : `${draftCount} new control${draftCount === 1 ? '' : 's'}`}</span>
                  <span className="block text-[0.6875rem] text-ink-500 whitespace-normal leading-snug">Fixes {draftCount === 1 ? 'the row' : 'those rows'} and lets engagements scope from {draftCount === 1 ? 'it' : 'them'}</span>
                </span>
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

/**
 * THE SAME THIRTEEN RACMs, READ ACROSS INSTEAD OF DOWN.
 *
 * A card answers "which one"; a table answers "how do they compare" — which
 * process, whose company, how big, and is it published. The grid makes that a
 * memory exercise, because the facts sit in a different place on every card.
 *
 * Everything here is already on the card — this is the same record in a shape
 * that lines up. The one addition is the column headings, which is what lets
 * the counts drop their "risks"/"controls" labels and sit as bare figures.
 *
 * NO PROVENANCE COLUMN (user ask, 1 Oct). "Where it came from" is a sentence,
 * and a sentence in a column is a paragraph thirteen times over — it was the
 * widest thing here and the least scannable. It is also only worth reading on
 * an extracted matrix: an uploaded workbook arrives with nothing to say about
 * itself.
 *
 * What a scanner wants from it is the one bit, SOP or not, and that is not a
 * column either: a column of mostly em-dashes spends a heading and a width on
 * a fact that is true of three rows. It rides the name instead, in front of it,
 * where the eye is already going — the name and what it was read off are one
 * thought. The sentence stays on the card, where there is room for it to be a
 * sentence.
 *
 * The row is the door, like the card: `reg-row` carries the house hover and the
 * whole of it opens the editor. The last cell is the exception, and stops the
 * click, because those buttons go somewhere else.
 */
function RacmTable({ rows, canManage, onDelete, onPublish, onHistory, onFlowchart }: {
  rows: LibraryRacm[];
  canManage: boolean;
  onDelete: (r: LibraryRacm) => void;
  onPublish: (r: LibraryRacm) => void;
  onHistory: (r: LibraryRacm) => void;
  onFlowchart: (r: LibraryRacm) => void;
}) {
  return (
    <div className="reg-wrap">
      <table className="w-full border-collapse">
        <thead className="reg-head">
          <tr>
            <th>RACM</th>
            <th style={{ width: 136 }}>Status</th>
            <th style={{ width: 150 }}>Process</th>
            <th style={{ width: 180 }}>Company</th>
            <th className="num" style={{ width: 72 }}>Risks</th>
            <th className="num" style={{ width: 86 }}>Controls</th>
            <th style={{ width: 104 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const risks = new Set(r.controls.map(c => c.riskId)).size;
            return (
              <tr key={r.id} className="reg-row" tabIndex={0} role="button"
                aria-label={`Open ${r.name} in the spreadsheet editor — opens in a new tab`}
                onClick={() => openEditorTab(r)}
                onKeyDown={e => { if (e.key === 'Enter') openEditorTab(r); }}>
                <td>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Table2 size={13} /></span>
                    {r.source === 'sop' && (
                      <span className="shrink-0" title="Drafted by reading an SOP — unconfirmed until the process is walked"><Pill tone="info">SOP</Pill></span>
                    )}
                    <span className="reg-clamp font-semibold text-ink-900" title={r.name}>{r.name}</span>
                  </span>
                </td>
                <td title="Only published RACMs can be scoped into an engagement"><StatusCell racm={r} /></td>
                <td className="truncate" title={r.process}>{r.process}</td>
                <td className="truncate" title={r.entity || 'No company'}>{r.entity || <span className="text-ink-300">—</span>}</td>
                <td className="text-right tabular-nums font-semibold">{risks}</td>
                <td className="text-right tabular-nums font-semibold">{r.controls.length}</td>
                {/* The one cell that is not the door. */}
                <td className="tight">
                  <span className="flex items-center justify-end gap-1">
                    {r.source === 'sop' && <SopRowButtons racm={r} onFlowchart={() => onFlowchart(r)} />}
                    <RowActions racm={r} canManage={canManage}
                      onDelete={() => onDelete(r)} onPublish={() => onPublish(r)} onHistory={() => onHistory(r)} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RacmLibraryView({ canManage, creating, setCreating }: {
  /** Create and delete — the same permission that creates engagements. */
  canManage: boolean;
  /** The wizard's open flag. It is owned by `RacmPage`, because the button
   *  that sets it now sits on that page's tab row — but the wizard itself
   *  renders here, where finishing one can clear this view's filters. */
  creating: boolean;
  setCreating: (open: boolean) => void;
}) {
  const racms = useRacmLibrary();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const { currentUser } = useCurrentUser();
  const [search, setSearch] = useState('');
  const [process, setProcess] = useState('All');
  const [deleting, setDeleting] = useState<LibraryRacm | null>(null);
  const [publishing, setPublishing] = useState<LibraryRacm | null>(null);
  const [historyFor, setHistoryFor] = useState<LibraryRacm | null>(null);
  const [chartFor, setChartFor] = useState<LibraryRacm | null>(null);
  const [status, setStatus] = useState('All');
  /* Cards by default. The table is the second way of looking, and a reader who
     has not asked for it should find the shape they left. */
  const [layout, setLayout] = useState<'cards' | 'table'>('cards');

  const processes = useMemo(() => Array.from(new Set(racms.map(r => r.process))).sort((a, b) => a.localeCompare(b)), [racms]);
  /** The rows on screen — newest first, as the tab keeps them, so a RACM just
   *  created lands at the top. */
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return racms.filter(r => (process === 'All' || r.process === process)
      // "Draft" means nothing here has been published yet; a matrix with
      // additions still counts as published, because scoping can use it.
      && (status === 'All' || (status === 'Draft' ? racmStatus(r).status === 'Draft' : racmStatus(r).status !== 'Draft'))
      && (!q || `${r.name} ${r.process} ${r.entity} ${r.fileName ?? ''} ${r.usedBy.map(u => u.name).join(' ')}`.toLowerCase().includes(q)));
  }, [racms, process, search, status]);

  const confirmPublish = (r: LibraryRacm) => {
    setPublishing(null);
    const { status: was } = racmStatus(r);
    const moved = publishRacm(r.id, currentUser?.name ?? 'You');
    if (!moved) {
      addToast({ type: 'warning', title: 'Nothing to publish', message: `Every row in ${r.name} is already published.` });
      return;
    }
    logEvent({ action: 'Update', description: `Published ${moved} control${moved === 1 ? '' : 's'} in ${r.name}`, module: 'SOX ICFR', entity: 'RACM' });
    addToast({
      type: 'success',
      title: was === 'Draft' ? 'RACM published' : 'New controls published',
      message: `${moved} control${moved === 1 ? '' : 's'} in ${r.name} ${moved === 1 ? 'is' : 'are'} now fixed, and engagements can scope from ${moved === 1 ? 'it' : 'them'}.`,
    });
  };

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
        {/* The filters take the right edge Create RACM used to hold (user ask,
            29 Sep) — search reads from the left, what narrows it from the
            right. Clear grows leftwards from them, so the two selects stay put
            whether or not anything is filtered. */}
        <div className="flex-1" />
        {(search || process !== 'All' || status !== 'All') && (
          <button onClick={() => { setSearch(''); setProcess('All'); setStatus('All'); }}
            className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-text-muted hover:text-primary px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors cursor-pointer">
            <X size={12} /> Clear
          </button>
        )}
        {/* The platform's view toggle, list on the left — the same control in the
            same shape as the Control Library's, so the two libraries are not two
            different things to learn. */}
        <div className="flex items-center gap-0.5 p-0.5 h-9 rounded-lg border border-canvas-border bg-canvas-elevated">
          <button onClick={() => setLayout('table')} title="List view" aria-label="List view" aria-pressed={layout === 'table'}
            className={cn('p-1.5 rounded-sm cursor-pointer transition-colors', layout === 'table' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><List size={16} /></button>
          <button onClick={() => setLayout('cards')} title="Grid view" aria-label="Grid view" aria-pressed={layout === 'cards'}
            className={cn('p-1.5 rounded-sm cursor-pointer transition-colors', layout === 'cards' ? 'bg-paper-50 text-brand-700' : 'text-ink-400 hover:text-ink-600')}><LayoutGrid size={16} /></button>
        </div>
        <FilterSelect value={process} options={['All', ...processes]} allLabel="All processes" onChange={setProcess} ariaLabel="Filter by process" />
        <FilterSelect value={status} options={['All', 'Draft', 'Published']} allLabel="Any status" onChange={setStatus} ariaLabel="Filter by status" />
      </div>

      {shown.length === 0 ? (
        <div className="border border-border-light rounded-xl p-14 text-center bg-white">
          <Table2 size={32} className="text-text-muted mx-auto mb-3" />
          <p className="text-[0.875rem] font-semibold text-text mb-1">{racms.length ? 'No RACMs match your search' : 'No RACMs yet'}</p>
          <p className="text-[0.75rem] text-text-muted">{racms.length ? 'Try clearing the process filter or search.' : 'Create one from a matrix or an SOP.'}</p>
        </div>
      ) : (
        <>
          {/* One card per RACM, one column on a narrow window and three on a
              wide one. The card is flat and the whole of it is the door to the
              spreadsheet editor — which is why the ⋯ menu and the two SOP
              buttons each stop the click before it reaches the card. */}
          {layout === 'cards' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map(r => {
              const risks = new Set(r.controls.map(c => c.riskId)).size;
              return (
                <div key={r.id} role="button" tabIndex={0}
                  aria-label={`Open ${r.name} in the spreadsheet editor — opens in a new tab`}
                  onClick={() => openEditorTab(r)} onKeyDown={e => { if (e.key === 'Enter') openEditorTab(r); }}
                  className="rounded-xl border border-canvas-border bg-canvas-elevated p-4 flex flex-col gap-3 cursor-pointer transition-colors hover:border-brand-300">
                  <div className="flex items-start gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Table2 size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[0.8125rem] font-semibold text-ink-900 leading-snug" title={r.name}>{r.name}</span>
                      {/* WHAT IT IS SITS UNDER THE NAME, WHERE IT CAME FROM
                          BELOW (user ask, 29 Sep — the two were the other way
                          round). Whether a matrix can be scoped from, and for
                          which process and company, is what a reader is
                          scanning this grid for; the file it was extracted
                          from is what they check once they have found it. */}
                      <div className="mt-1 flex items-center gap-2 min-w-0">
                        <span className="shrink-0" title="Only published RACMs can be scoped into an engagement"><StatusCell racm={r} /></span>
                        <span className="min-w-0 truncate text-[0.75rem] text-ink-600" title={`${r.process} · ${r.entity || 'No company'}`}>
                          {r.process}<span className="text-ink-300"> · </span>{r.entity || '—'}
                        </span>
                      </div>
                    </div>
                    <RowActions racm={r} canManage={canManage} onDelete={() => setDeleting(r)} onPublish={() => setPublishing(r)} onHistory={() => setHistoryFor(r)} />
                  </div>

                  {/* A card has no column headings, so a value that is not
                      self-evident has to say what it is — which is why the
                      counts are spelled out rather than sitting bare. */}
                  <p className="line-clamp-2 text-[0.71875rem] text-ink-400 leading-snug" title={sourceLine(r)}>{sourceLine(r)}</p>

                  {/* The SOP buttons ride the counts row (user ask, 29 Sep)
                      rather than a footer of their own — with the editor hint
                      gone the footer held two icons and a border, which is a
                      lot of card for very little. `min-h` keeps the line the
                      same height whether or not the buttons are there, so a row
                      of mixed cards still lines up.
                      "Used by" is gone from here too (user ask, 29 Sep): which
                      engagements copied a matrix is what the ⋯ menu's history
                      and the delete blocker are for, and on a card it was a
                      whole line spent on a question nobody scans a grid to
                      answer. */}
                  <div className="flex items-center gap-2 min-h-7">
                    {/* SOP, before the counts (user ask, 1 Oct). Where a matrix
                        came from changes how much the figures beside it are
                        worth: an extracted one is a reading of a document, and
                        until somebody has walked the process it is the SOP's
                        word for it, not the auditor's. Saying so in front of
                        the numbers is saying it before they are believed.
                        `info`, not a status tone — this is a fact about the
                        matrix's origin, not a verdict on it. */}
                    {r.source === 'sop' && (
                      <span title="Drafted by reading an SOP — unconfirmed until the process is walked"><Pill tone="info">SOP</Pill></span>
                    )}
                    <p className="text-[0.75rem] text-ink-500">
                      <span className="tabular-nums font-semibold text-ink-700">{risks}</span> {risks === 1 ? 'risk' : 'risks'}
                      <span className="text-ink-300"> · </span>
                      <span className="tabular-nums font-semibold text-ink-700">{r.controls.length}</span> {r.controls.length === 1 ? 'control' : 'controls'}
                    </p>
                    {r.source === 'sop' && (
                      <span className="ml-auto"><SopRowButtons racm={r} onFlowchart={() => setChartFor(r)} /></span>
                    )}
                  </div>

                  {/* No footer. The "Spreadsheet editor" hint went first (user
                      ask, 29 Sep) — the whole card opens it, the card's own
                      aria-label says so and the ⋯ menu spells it out, so a line
                      on every card was the third telling. That left a bordered
                      strip holding two icons, and those moved up to the counts
                      row, which is where the strip ended too. */}
                </div>
              );
            })}
          </div>
          ) : (
            <RacmTable rows={shown} canManage={canManage}
              onDelete={setDeleting} onPublish={setPublishing} onHistory={setHistoryFor} onFlowchart={setChartFor} />
          )}
          <p className="mt-3 px-1 text-[0.6875rem] text-text-muted tabular-nums">{shown.length} of {racms.length} RACMs</p>
        </>
      )}

      {creating && (
        <CreateRacmFlow onClose={() => setCreating(false)}
          onCreated={r => { setCreating(false); setProcess('All'); setSearch(''); addToast({ type: 'success', title: 'Saved to the RACM tab', message: `${r.name} — ${r.controls.length} control${r.controls.length === 1 ? '' : 's'}` }); }} />
      )}

      {/* The chart, redrawn from the controls — see `sopChartFromRacm` on why it
          is drawn again rather than stored. Read-only: the place to change what
          a box says is the matrix the box is drawn from. */}
      {chartFor && (
        <div className="modal-backdrop" style={{ padding: '6vh 20px' }} onClick={() => setChartFor(null)}>
          <div className="modal modal-wide flex flex-col" style={{ maxWidth: 1100, height: '82vh' }}
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="racm-chart-title"
            onKeyDown={e => { if (e.key === 'Escape') setChartFor(null); }}>
            <div className="px-5 pt-4 pb-3 border-b border-canvas-border shrink-0">
              <div className="flex items-center justify-between gap-3">
                <h2 id="racm-chart-title" className="text-[0.9375rem] font-semibold text-ink-900">{chartFor.name}</h2>
                <button onClick={() => setChartFor(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
              </div>
              {/* In a framed pane the chart drops its own status line — the
                  wizard's Flowchart step carries one instead. There is no such
                  heading here, so the modal says it, and saying it once is why
                  the sentence below no longer repeats the count. */}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-ink-500">
                <Pill tone="draft">
                  SOP-derived · {chartFor.flowchart?.status === 'confirmed'
                    ? `confirmed by ${chartFor.flowchart.confirmedBy ?? 'the auditor'}`
                    : 'unconfirmed'}
                </Pill>
                <span>
                  {new Set(chartFor.controls.map(c => c.riskId)).size} risks · {chartFor.controls.length}{' '}
                  {chartFor.controls.length === 1 ? 'control' : 'controls'}
                </span>
              </p>
              <p className="mt-1 text-[0.71875rem] text-ink-500">
                Read out of {chartFor.flowchart?.source ?? chartFor.fileName ?? 'the SOP'} when this RACM was extracted,
                and drawn again from its rows each time you open it.
              </p>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <SopFlowchartView
                rows={chartRowsFromControls(chartFor.controls)}
                process={chartFor.process}
                entity={chartFor.entity}
                source={chartFor.flowchart?.source ?? chartFor.fileName ?? 'the SOP'}
                idFor={row => row.values.controlId ?? row.key}
                omitted={0}
                classifyBy={row => row.values.controlTitle ?? ''}
                onRenameRisk={() => {}}
                onRenameControl={() => {}}
                editable={false}
                // A fixed-height frame, so Fit has something to measure against
                // — without it a twelve-rib process opens scrolled off its own
                // right-hand edge with no way back but dragging.
                compact
              />
            </div>
          </div>
        </div>
      )}

      {/* A published RACM is something engagements are tested against, so what
          happened to it is part of the audit trail rather than housekeeping.
          Newest first — the question is almost always "what changed last". */}
      {/* A SIDE SHEET, NOT A MODAL (user ask, 29 Sep). A modal says "answer me
          before you do anything else", and a history answers nothing — it is
          something you read alongside the list you came from, often against the
          card next to it. The shared `Drawer` is the platform's one drawer
          shell, so this reads the same as every other detail surface; it brings
          its own header, Escape handling and scroll, which is why none of that
          is written here any more. */}
      <AnimatePresence>
        {historyFor && (
          <Drawer
            title={historyFor.name}
            subtitle="Everything that has happened to this matrix."
            onClose={() => setHistoryFor(null)}
          >
            {/* Newest first — the question is almost always "what changed
                last". */}
            <ol className="space-y-3">
              {[...historyFor.history].reverse().map((h, i) => (
                <li key={`${h.at}-${h.kind}-${i}`} className="flex items-baseline gap-3">
                  <span className="shrink-0 w-9 font-mono text-[0.71875rem] text-ink-400 tabular-nums">
                    {h.version > 0 ? `v${h.version}` : '—'}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.78125rem] text-ink-800 leading-snug">{h.what}</span>
                    <span className="block text-[0.6875rem] text-ink-400">{h.by} · {h.at}</span>
                  </span>
                </li>
              ))}
            </ol>
            {historyFor.history.length === 0 && (
              <p className="text-[0.78125rem] text-ink-500">Nothing has happened to this matrix yet.</p>
            )}
          </Drawer>
        )}
      </AnimatePresence>

      {/* Publishing is the moment a matrix stops being editable, so it is asked
          for once, plainly, with the count it will fix. The Process Hub's Freeze
          dialog is the house pattern this follows. */}
      {publishing && (() => {
        const { draftCount, status: was } = racmStatus(publishing);
        const all = draftCount === publishing.controls.length;
        return (
          <div className="modal-backdrop" onClick={() => setPublishing(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="publish-library-racm-title"
              onKeyDown={e => { if (e.key === 'Escape') setPublishing(null); }}>
              <div className="px-5 pt-4 pb-3 border-b border-canvas-border">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="publish-library-racm-title" className="text-[0.9375rem] font-semibold text-ink-900">
                    {all ? `Publish ${publishing.name}?` : `Publish ${draftCount} new control${draftCount === 1 ? '' : 's'}?`}
                  </h2>
                  <button onClick={() => setPublishing(null)} className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 cursor-pointer" aria-label="Close"><X size={15} /></button>
                </div>
              </div>
              <div className="p-5">
                <p className="text-[0.78125rem] text-ink-600 leading-relaxed">
                  {draftCount === 1 ? 'This row' : `These ${draftCount} rows`} can be scoped into an engagement once published.
                </p>
                <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-canvas-border bg-paper-50 px-3.5 py-3">
                  <Lock size={14} className="text-ink-400 mt-0.5 shrink-0" />
                  <p className="text-[0.75rem] text-ink-600 leading-relaxed">
                    A published row can't be edited again. Anything still to change{was === 'Draft' ? '' : ' in these rows'} should be changed first —
                    afterwards the only way to alter this matrix is to add a control to it.
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => setPublishing(null)} autoFocus className="h-9 px-3.5 rounded-lg border border-canvas-border text-[0.78125rem] font-semibold text-ink-600 hover:text-ink-900 cursor-pointer">Cancel</button>
                  <button onClick={() => confirmPublish(publishing)}
                    className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[0.78125rem] font-semibold hover:bg-brand-700 transition-colors cursor-pointer">
                    <CheckCircle2 size={13} /> {all ? 'Publish RACM' : `Publish ${draftCount}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
