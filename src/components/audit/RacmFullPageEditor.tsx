// ─── RACM Full-Page Editor ────────────────────────────────────────────────
// Excel/Airtable-style grid for RACMs with 100+ controls.
//   - Frozen left columns (Risk ID, Control ID, Sub-Process toggleable)
//   - Toggleable column groups
//   - Inline cell editing
//   - Group-by Sub-Process (collapsible sections)
//   - Search + Key/Non-key filter + bulk select
//   - Detail side panel with all 25 fields organised into collapsible sections
// Seeded from the Procurement RACM Excel the user provided.

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, Search, Filter, Plus, Download, Upload, Columns3, Layers,
  X, ChevronRight, ChevronDown, Save, Lock,
  AlertTriangle, Star, Trash2, Check,
} from 'lucide-react';
import {
  PROCUREMENT_RACM_ROWS, PROCUREMENT_RACM_COLUMNS, COLUMN_GROUP_LABELS, COLUMN_GROUP_ORDER,
  groupRowsBySubProcess, deriveRiskRatingClass, deriveControlTypeClass, deriveControlNatureClass,
  type ProcurementRacmRow, type ColumnGroup, type RacmColumnDef,
} from '../../data/procurement-racm';

interface Props {
  onBack: () => void;
  /** RACM display name shown in the page header */
  racmName?: string;
  /** Identifier for the RACM being edited — used to label the version/source */
  racmId?: string;
  /** Optional process label for the page header (e.g. "P2P") */
  processLabel?: string;
}

// Columns that render with a styled chip rather than plain text
const CHIP_COLUMNS = new Set<keyof ProcurementRacmRow>([
  'riskRating', 'likelihood', 'impact', 'controlType', 'controlNature', 'frequency', 'confidence',
]);

// Columns that the user can pin / freeze to the left
const PINNABLE_KEYS: (keyof ProcurementRacmRow)[] = ['riskId', 'controlId', 'subProcess'];

// Curated set of columns that expose a per-column filter in the header.
//   'text'  → free-text search box (substring match)
//   'multi' → checkbox list of the distinct values present in the data
const COLUMN_FILTER_MODE: Record<string, 'multi' | 'text'> = {
  riskId: 'text', controlId: 'text',
  processArea: 'multi', subProcess: 'multi', riskCategory: 'multi',
  riskRating: 'multi', likelihood: 'multi', impact: 'multi',
  controlType: 'multi', controlNature: 'multi', frequency: 'multi',
  controlOwner: 'multi', segregationOfDuties: 'multi', confidence: 'multi',
};

// Key controls are a user-set designation (a manual tag), independent of risk
// rating/severity. For this mock we tag a stable, scattered ~1-in-4 subset by
// hashing the control id, so a given control is consistently key across its rows.
function isKeyControl(controlId: string): boolean {
  let h = 0;
  for (const ch of controlId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 4 === 0;
}

type GroupByMode = 'none' | 'subProcess' | 'processArea' | 'riskRating';

export default function RacmFullPageEditor({ onBack, racmName, racmId, processLabel }: Props) {
  // ─── State ───────────────────────────────────────────────────────────
  const [rows, setRows] = useState<ProcurementRacmRow[]>(() =>
    PROCUREMENT_RACM_ROWS.map(r => ({ ...r, isKey: isKeyControl(r.controlId) })));
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showOnlyKey, setShowOnlyKey] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const setColumnFilter = (key: string, vals: string[]) =>
    setColumnFilters(prev => { const next = { ...prev }; if (vals.length) next[key] = vals; else delete next[key]; return next; });
  const [visibleGroups, setVisibleGroups] = useState<Set<ColumnGroup>>(
    new Set(['identity', 'context', 'risk', 'control', 'assertions'])
  );
  const [pinnedKeys, setPinnedKeys] = useState<Set<keyof ProcurementRacmRow>>(
    new Set(['riskId', 'controlId'])
  );
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [detailRowId, setDetailRowId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'edited'>('saved');
  const [showImportToast, setShowImportToast] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Derived ─────────────────────────────────────────────────────────
  // Distinct values per multi-select column, sorted, for the header filter menus.
  const columnFilterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const key of Object.keys(COLUMN_FILTER_MODE)) {
      if (COLUMN_FILTER_MODE[key] !== 'multi') continue;
      const set = new Set<string>();
      for (const r of rows) { const v = String((r as unknown as Record<string, unknown>)[key] ?? '').trim(); if (v) set.add(v); }
      opts[key] = Array.from(set).sort();
    }
    return opts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (q) {
        const hit = Object.values(r).some(v => String(v).toLowerCase().includes(q));
        if (!hit) return false;
      }
      // Key controls are a user-set tag (see isKeyControl), not derived from severity.
      if (showOnlyKey && !r.isKey) return false;
      for (const [key, vals] of Object.entries(columnFilters)) {
        if (!vals.length) continue;
        const cell = String((r as unknown as Record<string, unknown>)[key] ?? '');
        if (COLUMN_FILTER_MODE[key] === 'text') {
          if (!cell.toLowerCase().includes(vals[0].toLowerCase())) return false;
        } else if (!vals.includes(cell)) return false;
      }
      return true;
    });
  }, [rows, search, showOnlyKey, columnFilters]);

  // ─── Pagination (applied before grouping) ──────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pageEnd = Math.min(pageStart + perPage, filteredRows.length);
  const pagedRows = useMemo(() => filteredRows.slice(pageStart, pageEnd), [filteredRows, pageStart, pageEnd]);
  // Reset to the first page whenever the filtered set or page size changes.
  useEffect(() => { setPage(1); }, [search, showOnlyKey, columnFilters, perPage]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ label: 'All Controls', rows: pagedRows, count: pagedRows.length }];
    const map = new Map<string, ProcurementRacmRow[]>();
    for (const r of pagedRows) {
      const key = (groupBy === 'subProcess' ? r.subProcess : groupBy === 'processArea' ? r.processArea : r.riskRating) || '(Unassigned)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([label, rs]) => ({ label, rows: rs, count: rs.length }));
  }, [pagedRows, groupBy]);

  const stats = useMemo(() => {
    const ratingCounts = { High: 0, Medium: 0, Low: 0 } as Record<string, number>;
    for (const r of rows) ratingCounts[r.riskRating] = (ratingCounts[r.riskRating] || 0) + 1;
    return {
      total: rows.length,
      filtered: filteredRows.length,
      risks: new Set(rows.map(r => r.riskId)).size,
      controls: new Set(rows.map(r => r.controlId)).size,
      key: rows.filter(r => r.riskRating === 'High' || r.riskRating === 'Critical').length,
      subProcesses: new Set(rows.map(r => r.subProcess)).size,
      manual: rows.filter(r => r.controlNature === 'Manual').length,
      automated: rows.filter(r => r.controlNature === 'Automated').length,
      ratings: ratingCounts,
    };
  }, [rows, filteredRows]);

  const visibleColumns = useMemo<RacmColumnDef[]>(() => {
    // pinned first, then by configured group order
    const pinned = PROCUREMENT_RACM_COLUMNS.filter(c => pinnedKeys.has(c.key));
    const rest = PROCUREMENT_RACM_COLUMNS.filter(c => !pinnedKeys.has(c.key) && visibleGroups.has(c.group));
    return [...pinned, ...rest];
  }, [pinnedKeys, visibleGroups]);

  // ─── Mutations ───────────────────────────────────────────────────────
  const updateCell = (rowKey: string, colKey: keyof ProcurementRacmRow, value: string) => {
    setSaveStatus('saving');
    setRows(prev => prev.map(r => (`${r.riskId}-${r.controlId}`) === rowKey ? { ...r, [colKey]: value } : r));
    window.setTimeout(() => setSaveStatus('saved'), 600);
  };

  const addRow = () => {
    const nextNum = rows.length + 1;
    const id = String(nextNum).padStart(3, '0');
    const blank: ProcurementRacmRow = {
      riskId: `R${id}`, controlId: `C${id}`,
      processArea: 'Procurement Lifecycle Management', subProcess: '(Add sub-process)',
      riskCategory: '', riskDescription: '',
      riskRating: 'Medium', likelihood: 'Medium', impact: 'Medium',
      controlObjective: '', controlActivity: '',
      controlType: 'Preventive', controlNature: 'Manual', frequency: 'Monthly',
      controlOwner: '', controlEvidence: '',
      assertions: '', fsLineItem: '', regulatoryRef: '',
      keyReport: '', ipeIceDetails: '', segregationOfDuties: '', mgmtReviewControl: '',
      confidence: 'DRAFT', sopSectionRef: '', attributes: '',
    };
    setRows(prev => [blank, ...prev]);
    setDetailRowId(`${blank.riskId}-${blank.controlId}`);
    setSaveStatus('edited');
  };

  const deleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    setRows(prev => prev.filter(r => !selectedRowIds.has(`${r.riskId}-${r.controlId}`)));
    setSelectedRowIds(new Set());
    setSaveStatus('saved');
  };

  const toggleGroup = (label: string) =>
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label); else n.add(label);
      return n;
    });

  const toggleColumnGroup = (g: ColumnGroup) =>
    setVisibleGroups(prev => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g); else n.add(g);
      return n;
    });

  const togglePin = (key: keyof ProcurementRacmRow) =>
    setPinnedKeys(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  const toggleRowSelected = (id: string) =>
    setSelectedRowIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const detailRow = detailRowId ? rows.find(r => `${r.riskId}-${r.controlId}` === detailRowId) || null : null;

  // ─── Build sticky-left offset map (px-based) ─────────────────────────
  const pinnedColumnList = visibleColumns.filter(c => pinnedKeys.has(c.key));
  const stickyOffsets = useMemo(() => {
    const map = new Map<string, number>();
    let acc = 40; // checkbox column
    for (const c of pinnedColumnList) {
      map.set(c.key, acc);
      acc += c.width;
    }
    return { offsets: map, total: acc };
  }, [pinnedColumnList]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="h-full w-full flex flex-col bg-canvas overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="text-text-muted hover:text-primary cursor-pointer p-1 -ml-1 rounded transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {racmId && <span className="font-mono text-[12px] font-semibold text-brand-700">{racmId.toUpperCase()}</span>}
              <h1 className="text-[0.9375rem] font-bold text-text truncate">{racmName ?? 'Procurement SOP — Budget to Payment RACM'}</h1>
              {processLabel && <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-primary/10 text-primary">{processLabel}</span>}
              <span className="px-1.5 py-0.5 rounded text-[0.5625rem] font-bold bg-amber-50 text-amber-700">DRAFT</span>
              <span className="text-[0.625rem] text-text-muted font-mono">v0.1</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg border border-border text-[0.6875rem] font-medium text-text-secondary hover:bg-surface-2 cursor-pointer transition-colors flex items-center gap-1.5">
            <Upload size={11} />Import
          </button>
          <button onClick={() => setShowImportToast(true)}
            className="px-2.5 py-1.5 rounded-lg border border-border text-[0.6875rem] font-medium text-text-secondary hover:bg-surface-2 cursor-pointer transition-colors flex items-center gap-1.5">
            <Download size={11} />Export
          </button>
          <button onClick={addRow}
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
            <Plus size={11} />Add Risk-Control
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden"
            onChange={() => { setShowImportToast(true); if (fileInputRef.current) fileInputRef.current.value = ''; }} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-border-light px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative max-w-md flex-1">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search across all 25 columns…"
              className="w-full pl-7 pr-3 py-1.5 border border-border rounded-lg text-[0.6875rem] bg-white outline-none focus:border-primary/40 transition-all" />
          </div>
          {/* Group-by */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-white">
            <Layers size={10} className="text-gray-400" />
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupByMode)}
              className="text-[0.625rem] bg-transparent outline-none cursor-pointer text-text-secondary">
              <option value="none">No grouping</option>
              <option value="subProcess">Group by Sub-Process</option>
              <option value="processArea">Group by Process Area</option>
              <option value="riskRating">Group by Risk Rating</option>
            </select>
          </div>
          {/* Columns */}
          <div className="relative">
            <button onClick={() => setShowColumnPanel(v => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[0.625rem] font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${showColumnPanel ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'border border-border text-text-secondary hover:bg-surface-2'}`}>
              <Columns3 size={10} />
              Columns ({visibleColumns.length}/{PROCUREMENT_RACM_COLUMNS.length})
            </button>
            {showColumnPanel && (
              <ColumnVisibilityPanel
                visibleGroups={visibleGroups}
                pinnedKeys={pinnedKeys}
                onToggleGroup={toggleColumnGroup}
                onTogglePin={togglePin}
                onClose={() => setShowColumnPanel(false)}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedRowIds.size > 0 && (
            <>
              <span className="text-[0.625rem] text-text-muted">{selectedRowIds.size} selected</span>
              <button onClick={deleteSelected}
                className="px-2 py-1.5 rounded-lg text-[0.625rem] font-semibold bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer transition-colors flex items-center gap-1">
                <Trash2 size={10} />Delete
              </button>
              <span className="text-gray-200">|</span>
            </>
          )}
          {saveStatus === 'saved' && <span className="text-[0.625rem] text-emerald-600 flex items-center gap-1"><Check size={10} />All changes saved</span>}
          {saveStatus === 'saving' && <span className="text-[0.625rem] text-amber-600">Saving…</span>}
          {saveStatus === 'edited' && <span className="text-[0.625rem] text-blue-600">Edited</span>}
        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-surface-2/40 border-b border-border-light px-6 py-2 flex items-center gap-6 text-[0.625rem] shrink-0 overflow-x-auto">
        <StatPill label="Total Controls" value={stats.total} />
        <StatPill label="Total Risks" value={stats.risks} />
        <StatPill label="Sub-Processes" value={stats.subProcesses} />
        <StatPill label="High Rating" value={stats.ratings.High ?? 0} accent="text-red-600" />
        <StatPill label="Medium Rating" value={stats.ratings.Medium ?? 0} accent="text-amber-600" />
        <StatPill label="Low Rating" value={stats.ratings.Low ?? 0} accent="text-emerald-600" />
        <StatPill label="Manual" value={stats.manual} />
        <StatPill label="Automated" value={stats.automated} accent="text-emerald-600" />
      </div>

      {/* Grid container */}
      <div className="flex-1 overflow-auto bg-white">
        <RacmGrid
          grouped={grouped}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          visibleColumns={visibleColumns}
          pinnedKeys={pinnedKeys}
          stickyOffsets={stickyOffsets}
          selectedRowIds={selectedRowIds}
          onToggleRowSelected={toggleRowSelected}
          onOpenDetail={setDetailRowId}
          onUpdateCell={updateCell}
          showGroupHeaders={groupBy !== 'none'}
          columnFilters={columnFilters}
          columnFilterOptions={columnFilterOptions}
          onColumnFilterChange={setColumnFilter}
          keyOnly={showOnlyKey}
          onKeyOnlyChange={setShowOnlyKey}
        />
      </div>

      {/* Pagination footer */}
      <div className="bg-white border-t border-border-light px-6 py-2 flex items-center justify-between gap-4 shrink-0 text-[0.6875rem]">
        <label className="flex items-center gap-2 text-text-muted">
          Rows per page
          <select value={perPage} onChange={e => setPerPage(Number(e.target.value))}
            className="rounded-[6px] border border-border bg-white pl-2 pr-1 py-1 text-[0.6875rem] tabular-nums text-text-secondary outline-none focus:border-primary/40 cursor-pointer">
            {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-text-muted tabular-nums">
            {filteredRows.length === 0 ? '0 of 0' : `Showing ${pageStart + 1}–${pageEnd} of ${filteredRows.length}`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="px-2.5 py-1 rounded-[6px] border border-border text-text-secondary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">Prev</button>
              <span className="tabular-nums text-text-secondary">Page {safePage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="px-2.5 py-1 rounded-[6px] border border-border text-text-secondary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {detailRow && (
          <DetailPanel
            row={detailRow}
            onClose={() => setDetailRowId(null)}
            onUpdate={(k, v) => updateCell(`${detailRow.riskId}-${detailRow.controlId}`, k, v)}
          />
        )}
      </AnimatePresence>

      {/* Import/Export toast */}
      <AnimatePresence>
        {showImportToast && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            onAnimationComplete={() => setTimeout(() => setShowImportToast(false), 2200)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-text text-white text-[0.6875rem] shadow-lg z-50 flex items-center gap-2">
            <AlertTriangle size={11} className="text-amber-300" />
            Import / export wired in production — this prototype uses the in-memory dataset.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stats pill ───────────────────────────────────────────────────────────
function StatPill({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-[0.75rem] font-bold tabular-nums ${accent ?? 'text-text'}`}>{value}</span>
      <span className="text-[0.625rem] text-text-muted">{label}</span>
    </div>
  );
}

// ─── Per-column header filter (text search / multi-select) ─────────────────
// Rendered through a portal to document.body because the grid lives inside an
// overflow-auto container with a backdrop-blur sticky header — a normally
// positioned dropdown would be clipped / mispositioned.
function ColumnFilterControl({ colKey: _colKey, label, mode, options, value, onChange, keyToggle }: {
  colKey: string; label: string; mode: 'multi' | 'text';
  options: string[]; value: string[]; onChange: (vals: string[]) => void;
  keyToggle?: { checked: boolean; onChange: (v: boolean) => void };
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = value.length > 0 || !!keyToggle?.checked;
  const toggle = () => {
    if (!open) { const r = btnRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 220)) }); }
    setOpen(o => !o);
  };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return; setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <>
      <button ref={btnRef} type="button" onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={`Filter ${label}`}
        className={`shrink-0 w-4 h-4 flex items-center justify-center rounded cursor-pointer ${active ? 'text-brand-700 bg-brand-50' : 'text-ink-400 hover:text-brand-700 hover:bg-[#F4F2F7]'}`}>
        <Filter size={10} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="w-[212px] bg-white border border-border-light rounded-[8px] shadow-lg z-[60] py-1 normal-case tracking-normal">
          {keyToggle && (
            <label className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-ink-800 hover:bg-[#FAFAFB] cursor-pointer border-b border-border-light">
              <input type="checkbox" checked={keyToggle.checked} onChange={(e) => keyToggle.onChange(e.target.checked)} className="accent-brand-600 cursor-pointer" />
              <Star size={11} className="text-amber-500 fill-amber-400 shrink-0" />
              Key controls only
            </label>
          )}
          {mode === 'text' ? (
            <div className="p-2">
              <input autoFocus value={value[0] ?? ''} onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full h-7 px-2 text-[12px] bg-white border border-border rounded-[6px] focus:outline-none focus:border-primary/40" />
              {active && <button type="button" onClick={() => onChange([])} className="mt-1.5 w-full text-left text-[11px] text-ink-500 hover:text-brand-700 cursor-pointer">Clear filter</button>}
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 border-b border-border-light flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Filter</span>
                {active && <button type="button" onClick={() => onChange([])} className="text-[11px] text-brand-700 hover:text-brand-600 cursor-pointer">Clear</button>}
              </div>
              <ul className="py-1 max-h-[240px] overflow-y-auto">
                {options.map(opt => {
                  const checked = value.includes(opt);
                  return (
                    <li key={opt}>
                      <label className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-ink-800 hover:bg-[#FAFAFB] cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => onChange(checked ? value.filter(v => v !== opt) : [...value, opt])} className="accent-brand-600 cursor-pointer" />
                        <span className="truncate">{opt}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>, document.body)}
    </>
  );
}

// ─── Column visibility panel ───────────────────────────────────────────────
function ColumnVisibilityPanel({
  visibleGroups, pinnedKeys, onToggleGroup, onTogglePin, onClose,
}: {
  visibleGroups: Set<ColumnGroup>;
  pinnedKeys: Set<keyof ProcurementRacmRow>;
  onToggleGroup: (g: ColumnGroup) => void;
  onTogglePin: (k: keyof ProcurementRacmRow) => void;
  onClose: () => void;
}) {
  // close on outside click
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-72 bg-white border border-border rounded-xl shadow-xl z-30 overflow-hidden">
      <div className="px-3 py-2 border-b border-border-light bg-surface-2/40">
        <h6 className="text-[0.625rem] font-bold text-text uppercase tracking-wider">Column groups</h6>
        <p className="text-[0.5625rem] text-text-muted mt-0.5">Toggle entire groups in/out of view.</p>
      </div>
      <div className="p-2 space-y-0.5">
        {COLUMN_GROUP_ORDER.map(g => {
          const on = visibleGroups.has(g);
          return (
            <button key={g} onClick={() => onToggleGroup(g)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[0.6875rem] cursor-pointer transition-colors ${on ? 'bg-primary/5 text-primary' : 'text-text-secondary hover:bg-surface-2'}`}>
              <span className="font-medium">{COLUMN_GROUP_LABELS[g]}</span>
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                {on && <Check size={9} className="text-white" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-border-light bg-surface-2/40">
        <h6 className="text-[0.625rem] font-bold text-text uppercase tracking-wider">Pinned columns</h6>
        <p className="text-[0.5625rem] text-text-muted mt-0.5">Pin to keep visible while scrolling horizontally.</p>
      </div>
      <div className="p-2 space-y-0.5">
        {PINNABLE_KEYS.map(k => {
          const col = PROCUREMENT_RACM_COLUMNS.find(c => c.key === k)!;
          const on = pinnedKeys.has(k);
          return (
            <button key={k} onClick={() => onTogglePin(k)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[0.6875rem] cursor-pointer transition-colors ${on ? 'bg-primary/5 text-primary' : 'text-text-secondary hover:bg-surface-2'}`}>
              <span className="font-medium">{col.label}</span>
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                {on && <Check size={9} className="text-white" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────
function RacmGrid({
  grouped, collapsedGroups, onToggleGroup, visibleColumns, pinnedKeys, stickyOffsets,
  selectedRowIds, onToggleRowSelected, onOpenDetail, onUpdateCell, showGroupHeaders,
  columnFilters, columnFilterOptions, onColumnFilterChange, keyOnly, onKeyOnlyChange,
}: {
  grouped: { label: string; rows: ProcurementRacmRow[]; count: number }[];
  collapsedGroups: Set<string>;
  onToggleGroup: (label: string) => void;
  visibleColumns: RacmColumnDef[];
  pinnedKeys: Set<keyof ProcurementRacmRow>;
  stickyOffsets: { offsets: Map<string, number>; total: number };
  selectedRowIds: Set<string>;
  onToggleRowSelected: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onUpdateCell: (rowKey: string, col: keyof ProcurementRacmRow, value: string) => void;
  showGroupHeaders: boolean;
  columnFilters: Record<string, string[]>;
  columnFilterOptions: Record<string, string[]>;
  onColumnFilterChange: (key: string, vals: string[]) => void;
  keyOnly: boolean;
  onKeyOnlyChange: (v: boolean) => void;
}) {
  const totalWidth = stickyOffsets.total + visibleColumns.filter(c => !pinnedKeys.has(c.key)).reduce((s, c) => s + c.width, 0);

  return (
    <div style={{ minWidth: totalWidth }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex bg-surface-2/95 border-b border-border backdrop-blur">
        {/* checkbox column */}
        <div className="sticky left-0 bg-surface-2/95 border-r border-border-light h-9 w-10 flex items-center justify-center z-10">
          <span className="text-[0.5625rem] text-gray-400 font-bold">#</span>
        </div>
        {visibleColumns.map(c => {
          const pinned = pinnedKeys.has(c.key);
          const left = stickyOffsets.offsets.get(c.key);
          const isLastPinned = pinned && [...pinnedKeys].slice(-1)[0] === c.key;
          const filterMode = COLUMN_FILTER_MODE[c.key as string];
          return (
            <div key={c.key}
              style={{ width: c.width, minWidth: c.width, left: pinned ? left : undefined }}
              className={`h-9 px-3 flex items-center justify-between gap-1 text-[0.5625rem] font-bold text-text-muted uppercase tracking-wider border-r border-border-light ${pinned ? 'sticky bg-surface-2/95 z-10' : ''} ${isLastPinned ? 'shadow-[2px_0_3px_-2px_rgba(0,0,0,0.08)]' : ''}`}>
              <span className="truncate">{c.label}</span>
              {filterMode && (
                <ColumnFilterControl colKey={c.key as string} label={c.label}
                  mode={filterMode}
                  options={columnFilterOptions[c.key as string] ?? []}
                  value={columnFilters[c.key as string] ?? []}
                  onChange={(vals) => onColumnFilterChange(c.key as string, vals)}
                  keyToggle={c.key === 'controlId' ? { checked: keyOnly, onChange: onKeyOnlyChange } : undefined} />
              )}
            </div>
          );
        })}
      </div>

      {/* Rows */}
      {grouped.map(group => {
        const collapsed = collapsedGroups.has(group.label);
        return (
          <div key={group.label}>
            {showGroupHeaders && (
              <button onClick={() => onToggleGroup(group.label)}
                className="sticky left-0 z-10 w-full text-left flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-primary/15 hover:bg-primary/10 transition-colors cursor-pointer"
                style={{ minWidth: totalWidth }}>
                {collapsed ? <ChevronRight size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />}
                <span className="text-[0.6875rem] font-bold text-primary truncate">{group.label}</span>
                <span className="text-[0.625rem] text-primary/70 tabular-nums">({group.count})</span>
              </button>
            )}
            {!collapsed && group.rows.map((r, idx) => {
              const rowKey = `${r.riskId}-${r.controlId}`;
              const isSelected = selectedRowIds.has(rowKey);
              return (
                <RacmGridRow key={rowKey}
                  rowKey={rowKey}
                  row={r}
                  rowIdx={idx}
                  isSelected={isSelected}
                  visibleColumns={visibleColumns}
                  pinnedKeys={pinnedKeys}
                  stickyOffsets={stickyOffsets}
                  onToggleSelected={() => onToggleRowSelected(rowKey)}
                  onOpenDetail={() => onOpenDetail(rowKey)}
                  onUpdateCell={onUpdateCell}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Grid row ─────────────────────────────────────────────────────────────
function RacmGridRow({
  rowKey, row, rowIdx, isSelected, visibleColumns, pinnedKeys, stickyOffsets,
  onToggleSelected, onOpenDetail, onUpdateCell,
}: {
  rowKey: string;
  row: ProcurementRacmRow;
  rowIdx: number;
  isSelected: boolean;
  visibleColumns: RacmColumnDef[];
  pinnedKeys: Set<keyof ProcurementRacmRow>;
  stickyOffsets: { offsets: Map<string, number>; total: number };
  onToggleSelected: () => void;
  onOpenDetail: () => void;
  onUpdateCell: (rowKey: string, col: keyof ProcurementRacmRow, value: string) => void;
}) {
  const [editingKey, setEditingKey] = useState<keyof ProcurementRacmRow | null>(null);
  const bg = isSelected ? 'bg-primary/8' : (rowIdx % 2 === 0 ? 'bg-white' : 'bg-surface-2/30');

  return (
    <div className={`group flex border-b border-border-light/70 hover:bg-primary/5 ${bg} transition-colors`}>
      {/* checkbox */}
      <div className={`sticky left-0 h-10 w-10 flex items-center justify-center border-r border-border-light z-10 ${bg}`}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isSelected} onChange={onToggleSelected}
            className="w-3.5 h-3.5 rounded border-gray-300 accent-primary cursor-pointer" />
        </label>
      </div>
      {visibleColumns.map(c => {
        const pinned = pinnedKeys.has(c.key);
        const left = stickyOffsets.offsets.get(c.key);
        const isLastPinned = pinned && [...pinnedKeys].slice(-1)[0] === c.key;
        const isEditing = editingKey === c.key;
        const isAttrEditing = isEditing && c.key === 'attributes';
        return (
          <div key={c.key}
            style={{ width: c.width, minWidth: c.width, left: pinned ? left : undefined }}
            className={`h-10 px-3 py-1.5 text-[0.6875rem] text-text border-r border-border-light/70 ${pinned ? `sticky z-10 ${bg}` : ''} ${isLastPinned ? 'shadow-[2px_0_3px_-2px_rgba(0,0,0,0.08)]' : ''} ${isEditing && !isAttrEditing ? 'p-0' : ''}`}>
            {isAttrEditing ? (
              <>
                <CellContent row={row} col={c} onEdit={() => {}} onOpenDetail={onOpenDetail} />
                <AttributeEditModal
                  value={String(row[c.key] ?? '')}
                  onSave={(v) => { onUpdateCell(rowKey, c.key, v); setEditingKey(null); }}
                  onClose={() => setEditingKey(null)}
                />
              </>
            ) : isEditing ? (
              <input autoFocus defaultValue={String(row[c.key] ?? '')}
                onBlur={e => { onUpdateCell(rowKey, c.key, e.target.value); setEditingKey(null); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onUpdateCell(rowKey, c.key, (e.target as HTMLInputElement).value); setEditingKey(null); }
                  if (e.key === 'Escape') setEditingKey(null);
                }}
                className="w-full h-full px-3 text-[0.6875rem] border-2 border-primary rounded outline-none bg-white" />
            ) : (
              <CellContent
                row={row}
                col={c}
                onEdit={() => setEditingKey(c.key)}
                onOpenDetail={onOpenDetail}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Attribute Edit Modal ─────────────────────────────────────────────────
function AttributeEditModal({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }) {
  const initial = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [attrs, setAttrs] = useState<string[]>(initial);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addAttr = () => {
    const trimmed = input.trim();
    if (trimmed && !attrs.includes(trimmed)) {
      setAttrs(p => [...p, trimmed]);
      setInput('');
    }
  };

  const removeAttr = (idx: number) => setAttrs(p => p.filter((_, i) => i !== idx));

  const handleSave = () => onSave(attrs.join(', '));

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[440px] bg-white rounded-2xl border border-border-light shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
          <h3 className="text-[0.875rem] font-bold text-text">Edit Attributes</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-text cursor-pointer transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Current attributes */}
          {attrs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attrs.map((a, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.6875rem] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                  {a}
                  <button onClick={() => removeAttr(idx)} className="text-purple-400 hover:text-red-500 cursor-pointer transition-colors"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          {attrs.length === 0 && (
            <p className="text-[0.6875rem] text-gray-400 italic">No attributes yet. Type below and press Enter to add.</p>
          )}

          {/* Input */}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAttr(); } }}
              placeholder="Type attribute and press Enter..."
              className="flex-1 px-3 py-2 border border-border rounded-lg text-[0.75rem] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <button onClick={addAttr} disabled={!input.trim()}
              className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Add
            </button>
          </div>
          <p className="text-[0.625rem] text-gray-400">Press Enter after each attribute to add it. Click the x on a chip to remove.</p>
        </div>
        <div className="px-5 py-3 border-t border-border-light bg-surface-2/20 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-[0.6875rem] font-semibold text-gray-500 hover:text-text hover:bg-gray-100 cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-[0.6875rem] font-semibold cursor-pointer transition-colors shadow-sm">Save</button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Cell rendering (chip styles, truncation) ─────────────────────────────
function CellContent({
  row, col, onEdit, onOpenDetail,
}: {
  row: ProcurementRacmRow;
  col: RacmColumnDef;
  onEdit: () => void;
  onOpenDetail: () => void;
}) {
  const val = String(row[col.key] ?? '');
  const isId = col.key === 'riskId' || col.key === 'controlId';

  if (isId) {
    return (
      <button onClick={onOpenDetail}
        className="font-mono text-[0.6875rem] text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
        {col.key === 'controlId' && row.isKey && (
          <Star size={10} className="text-amber-500 fill-amber-400 shrink-0" aria-label="Key control" />
        )}
        {val || '—'}
      </button>
    );
  }

  if (CHIP_COLUMNS.has(col.key)) {
    const cls =
      col.key === 'riskRating' || col.key === 'likelihood' || col.key === 'impact'
        ? deriveRiskRatingClass(val)
        : col.key === 'controlType'
          ? deriveControlTypeClass(val)
          : col.key === 'controlNature'
            ? deriveControlNatureClass(val)
            : 'bg-gray-100 text-gray-600 border-gray-200';
    return (
      <button onDoubleClick={onEdit}
        className={`px-2 h-5 rounded-full text-[0.5625rem] font-bold inline-flex items-center border ${cls} cursor-pointer`}>
        {val || '—'}
      </button>
    );
  }

  // Attributes — render comma-separated values as individual chips, click to edit via modal
  if (col.key === 'attributes') {
    if (!val) return <button onClick={onEdit} className="text-[0.625rem] text-primary hover:underline cursor-pointer">+ Add attributes</button>;
    const items = val.split(',').map(s => s.trim()).filter(Boolean);
    return (
      <button onClick={onEdit} className="flex flex-wrap gap-1 py-0.5 -mx-1 px-1 cursor-pointer hover:bg-white/60 rounded transition-colors w-full text-left">
        {items.map((attr, idx) => (
          <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.5625rem] font-medium bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap">
            {attr}
          </span>
        ))}
      </button>
    );
  }

  // Plain text — single line truncated, double click to edit
  return (
    <button onDoubleClick={onEdit} onClick={onEdit}
      className="w-full h-full text-left text-[0.6875rem] text-text truncate cursor-text hover:bg-white/60 -mx-3 px-3 rounded transition-colors">
      {val || <span className="text-gray-300">—</span>}
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────
function DetailPanel({
  row, onClose, onUpdate,
}: {
  row: ProcurementRacmRow;
  onClose: () => void;
  onUpdate: (k: keyof ProcurementRacmRow, v: string) => void;
}) {
  const sections: { group: ColumnGroup; label: string }[] = COLUMN_GROUP_ORDER.map(g => ({ group: g, label: COLUMN_GROUP_LABELS[g] }));

  return (
    <motion.div initial={{ x: 480, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 480, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="fixed right-0 top-0 bottom-0 w-[520px] bg-white border-l border-border shadow-2xl z-40 flex flex-col">
      {/* header */}
      <div className="px-5 py-3 border-b border-border-light flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.625rem] font-mono text-gray-400">{row.riskId} · {row.controlId}</span>
            <span className={`px-1.5 h-4 rounded text-[0.5rem] font-bold inline-flex items-center border ${deriveRiskRatingClass(row.riskRating)}`}>{row.riskRating}</span>
            <span className={`px-1.5 h-4 rounded text-[0.5rem] font-bold inline-flex items-center border ${deriveControlTypeClass(row.controlType)}`}>{row.controlType}</span>
            <span className={`px-1.5 h-4 rounded text-[0.5rem] font-bold inline-flex items-center border ${deriveControlNatureClass(row.controlNature)}`}>{row.controlNature}</span>
          </div>
          <h2 className="text-[0.8125rem] font-bold text-text truncate">{row.controlObjective || row.controlActivity?.slice(0, 80) || '(No objective)'}</h2>
          <p className="text-[0.625rem] text-text-muted mt-0.5 truncate">{row.subProcess}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 -mr-1"><X size={14} /></button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {sections.map(s => {
          const cols = PROCUREMENT_RACM_COLUMNS.filter(c => c.group === s.group);
          if (cols.length === 0) return null;
          return (
            <DetailSection key={s.group} label={s.label}>
              {cols.map(c => (
                <DetailField key={c.key} label={c.label} value={String(row[c.key] ?? '')} onChange={v => onUpdate(c.key, v)} multiLine={['riskDescription', 'controlObjective', 'controlActivity', 'controlEvidence', 'ipeIceDetails', 'mgmtReviewControl'].includes(c.key)} />
              ))}
            </DetailSection>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-border-light flex items-center justify-between bg-surface-2/30">
        <div className="flex items-center gap-1.5 text-[0.625rem] text-text-muted">
          <Save size={10} />Changes auto-save
        </div>
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-primary text-white text-[0.6875rem] font-semibold cursor-pointer hover:bg-primary/90 transition-colors">
          Done
        </button>
      </div>
    </motion.div>
  );
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-border-light">
      <button onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface-2/30 cursor-pointer transition-colors">
        <span className="text-[0.625rem] font-bold text-text uppercase tracking-wider">{label}</span>
        {open ? <ChevronDown size={11} className="text-gray-400" /> : <ChevronRight size={11} className="text-gray-400" />}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2.5">{children}</div>}
    </div>
  );
}

function DetailField({ label, value, onChange, multiLine }: { label: string; value: string; onChange: (v: string) => void; multiLine?: boolean }) {
  return (
    <div>
      <label className="text-[0.5625rem] font-semibold text-text-muted uppercase tracking-wider block mb-1">{label}</label>
      {multiLine ? (
        <textarea defaultValue={value} onBlur={e => onChange(e.target.value)}
          rows={Math.min(6, Math.max(2, Math.ceil((value || '').length / 50)))}
          className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40 transition-all resize-none" />
      ) : (
        <input defaultValue={value} onBlur={e => onChange(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[0.6875rem] text-text bg-white outline-none focus:border-primary/40 transition-all" />
      )}
    </div>
  );
}
