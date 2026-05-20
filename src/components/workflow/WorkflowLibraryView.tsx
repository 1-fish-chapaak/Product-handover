import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Pencil,
  Trash2,
  ArrowRight,
  ListFilter,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { BulkExecuteModal, Checkbox } from './BulkExecuteModal';

interface Props {
  onCreateWorkflow?: () => void;
  onSelectWorkflow?: (id: string) => void;
  /** When set, filters workflows by tag matching this process abbreviation */
  processFilter?: string;
}

export type LibraryWorkflow = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  businessProcess: string;
  controlId: string;
  live?: boolean;
};

export const LIBRARY_WORKFLOWS: LibraryWorkflow[] = [
  {
    id: 'lw-001',
    name: 'Identify Higher Share of Business Awarded to Higher Price Vendors (Monthly Analysis)',
    description: 'Identify Higher Share of Business Awarded to Higher Price Vendors (Monthly Analysis)',
    tags: ['p2p', 'pay to procure'],
    businessProcess: 'P2P',
    controlId: 'CTRL-001',
    live: true,
  },
  {
    id: 'lw-002',
    name: 'To check whether same material sold at different rates to same customer',
    description: 'To check whether same material sold at different rates to same customer where later invoice unit rate is lower than the earlier one for the same material.',
    tags: ['O2C'],
    businessProcess: 'Finance',
    controlId: 'CTRL-001',
  },
  {
    id: 'lw-003',
    name: 'Total Inventory by Community and Rev Status - 4',
    description: 'This workflow processes the inventory data to categorize revenue status, revenue type, bedroom buckets, price points, and community segments.',
    tags: ['INV'],
    businessProcess: 'Apollo Types',
    controlId: 'CTRL-002',
    live: true,
  },
  {
    id: 'lw-004',
    name: '"Invoice received by emaar" date should not be less than the invoice date',
    description: '"Invoice received by emaar" date should not be less than the invoice date',
    tags: ['P2P'],
    businessProcess: 'Birla Group',
    controlId: 'CTRL-002',
  },
  {
    id: 'lw-005',
    name: '"Invoice received by emaar" date should not be less than the invoice date',
    description: '"Invoice received by emaar" date should not be less than the invoice date',
    tags: ['P2P'],
    businessProcess: 'P2P',
    controlId: 'CTRL-003',
  },
  {
    id: 'lw-006',
    name: '2 way or 3 way match',
    description: '2 way/ 3 way match',
    tags: ['P2P'],
    businessProcess: 'Finance',
    controlId: 'CTRL-003',
    live: true,
  },
  {
    id: 'lw-007',
    name: 'Access Session Duration Analysis',
    description: "Calculates duration between access 'IN' and 'OUT' events per code to audit session lengths and identify anomalies.",
    tags: [],
    businessProcess: 'Apollo Types',
    controlId: 'CTRL-004',
  },
  {
    id: 'lw-008',
    name: 'Accounting Document Reconciliation Report',
    description: 'Consolidates and filters SAP BKPF header entries to reconcile unique accounting documents by latest entry date.',
    tags: [],
    businessProcess: 'Birla Group',
    controlId: 'CTRL-005',
  },
  {
    id: 'lw-009',
    name: 'Accounts Payable Aging Analysis',
    description: 'Presents payables across aging buckets to identify overdue liabilities and support cash flow management.',
    tags: ['test'],
    businessProcess: 'P2P',
    controlId: 'CTRL-005',
  },
  {
    id: 'lw-010',
    name: 'Duplicate Invoice Detection',
    description: 'Scans incoming invoices against historical data to flag potential duplicates before payment processing.',
    tags: ['P2P', 'fraud'],
    businessProcess: 'Finance',
    controlId: 'CTRL-006',
    live: true,
  },
];

const TOTAL_PAGES = 144;

export default function WorkflowLibraryView({ onCreateWorkflow, onSelectWorkflow, processFilter }: Props) {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bpFilter, setBpFilter] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'bp' | 'tags' | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const selectedWorkflows = useMemo(
    () => LIBRARY_WORKFLOWS.filter(w => selectedIds.has(w.id)),
    [selectedIds]
  );

  const bpOptions = useMemo(() => {
    const s = new Set<string>();
    LIBRARY_WORKFLOWS.forEach(w => s.add(w.businessProcess));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, []);

  const tagOptions = useMemo(() => {
    const s = new Set<string>();
    LIBRARY_WORKFLOWS.forEach(w => w.tags.forEach(t => s.add(t)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LIBRARY_WORKFLOWS.filter(w => {
      // Process filter — match by tag (P2P, O2C, etc.)
      if (processFilter && !w.tags.some(t => t.toUpperCase() === processFilter.toUpperCase())) return false;
      if (q && !w.name.toLowerCase().includes(q) && !w.description.toLowerCase().includes(q)) return false;
      if (bpFilter.size > 0 && !bpFilter.has(w.businessProcess)) return false;
      if (tagFilter.size > 0 && !w.tags.some(t => tagFilter.has(t))) return false;
      return true;
    });
  }, [search, bpFilter, tagFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(w => selectedIds.has(w.id));
  const someVisibleSelected = filtered.some(w => selectedIds.has(w.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach(w => next.delete(w.id));
      } else {
        filtered.forEach(w => next.add(w.id));
      }
      return next;
    });
  };

  const enterBulkMode = () => {
    setBulkMode(true);
    setSelectedIds(new Set());
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const handleContinue = () => {
    if (selectedIds.size === 0) return;
    setBulkModalOpen(true);
  };

  const handleModalClose = () => {
    setBulkModalOpen(false);
  };

  const handleModalContinue = (data: {
    auditName: string;
    auditDescription: string;
    frequency: string;
    triggerOn: string;
    runTime: string;
    retry: string;
  }) => {
    void data;
    setBulkModalOpen(false);
    exitBulkMode();
  };

  const handleRowClick = (id: string) => {
    if (bulkMode) {
      toggleSelect(id);
    } else {
      onSelectWorkflow?.(id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
      className="h-full w-full bg-white flex flex-col overflow-hidden px-[180px]"
    >
      {/* Header */}
      <div className="pt-8 pb-5">
        <div className="font-mono text-[11px] text-ink-500 mb-2 tracking-tight">
          Workflow Library
        </div>
        <h1 className="font-display text-[34px] font-[420] tracking-tight text-ink-900 leading-[1.15]">
          Workflow Library
        </h1>
        <p className="text-[14px] text-ink-500 mt-1">
          Browse the workflow catalog and add the ones relevant to your audit.
        </p>
      </div>

      {/* Search + Create */}
      <div className=" pb-5 flex items-center gap-3">
          {bulkMode && (
            <span className="text-[13px] text-text-secondary">
              <span className="font-semibold text-text">{selectedIds.size}</span> selected
            </span>
          )}
          <div className="relative w-[400px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search workflow.."
              className="w-full pl-10 pr-4 h-10 rounded-md border border-border bg-white text-[13px] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => onCreateWorkflow?.()}
              className="flex items-center gap-2 px-4 h-10 rounded-md bg-primary-xlight text-primary border border-primary/15 text-[13px] font-semibold hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <Sparkles size={14} />
              Create Workflow
            </button>
            {bulkMode ? (
              <button
                onClick={exitBulkMode}
                className="flex items-center gap-2 px-4 h-10 rounded-md bg-white text-text border border-border text-[13px] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={enterBulkMode}
                className="flex items-center gap-2 px-4 h-10 rounded-md bg-white text-text border border-border text-[13px] font-semibold transition-colors cursor-pointer hover:bg-[#6a12cd] hover:text-white hover:border-[#6a12cd]"
              >
                <Play size={14} />
                Bulk Run
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        {/*
          DESIGN UPDATE — enterprise-minimal table refinements.
          To revert: restore the commented-out classNames marked with "ORIG:" below.
          Changes:
            1. thead background: bg-surface-2 → bg-white + border-b
            2. th labels: 13px semibold → 11px uppercase tracking-wider muted
            3. Control ID badge: filled pill → plain mono muted text
            4. Tags: purple → neutral gray chips
            5. Actions column: always visible → reveal on row hover
            6. Row hover: bg-surface-2/50 → bg-surface-2/40
        */}
        <div className="flex-1 overflow-auto border-t border-border-light">
          <table className="w-full border-collapse">
            {/* ORIG: <thead className="bg-surface-2 sticky top-0 z-10"> */}
            <thead className="bg-white sticky top-0 z-10 border-b border-border-light">
              <tr>
                {bulkMode && (
                  <th className="pl-4 pr-2 py-3.5 w-[56px]">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      ariaLabel="Select all workflows on this page"
                    />
                  </th>
                )}
                {/* ORIG th classes below: "px-4 py-3.5 text-left text-[13px] font-semibold text-text ..." */}
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[320px]">Workflow Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">Workflow Description</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[170px]">
                  <div className="relative inline-flex items-center gap-1.5">
                    Business Process
                    <FilterIconButton
                      active={bpFilter.size > 0}
                      open={activeFilter === 'bp'}
                      onClick={() => setActiveFilter(activeFilter === 'bp' ? null : 'bp')}
                      label="Filter by business process"
                    />
                    {activeFilter === 'bp' && (
                      <FilterDropdown
                        options={bpOptions}
                        selected={bpFilter}
                        onApply={(next) => { setBpFilter(next); setActiveFilter(null); setPage(1); }}
                        onClose={() => setActiveFilter(null)}
                      />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[200px]">
                  <div className="relative inline-flex items-center gap-1.5">
                    Tags
                    <FilterIconButton
                      active={tagFilter.size > 0}
                      open={activeFilter === 'tags'}
                      onClick={() => setActiveFilter(activeFilter === 'tags' ? null : 'tags')}
                      label="Filter by tag"
                    />
                    {activeFilter === 'tags' && (
                      <FilterDropdown
                        options={tagOptions}
                        selected={tagFilter}
                        onApply={(next) => { setTagFilter(next); setActiveFilter(null); setPage(1); }}
                        onClose={() => setActiveFilter(null)}
                      />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted w-[140px]" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={bulkMode ? 6 : 5} className="px-6 py-16 text-center text-[13px] text-text-muted">
                    No workflows match "{search}"
                  </td>
                </tr>
              ) : (
                filtered.map(wf => {
                  const isSelected = selectedIds.has(wf.id);
                  return (
                    // ORIG tr className (hover was bg-surface-2/50):
                    //   `border-t border-border-light transition-colors cursor-pointer ${
                    //     bulkMode && isSelected ? 'bg-primary-xlight/50 hover:bg-primary-xlight/70' : 'hover:bg-surface-2/50'
                    //   }`
                    <tr
                      key={wf.id}
                      onClick={() => handleRowClick(wf.id)}
                      className={`border-t border-border-light transition-colors cursor-pointer ${
                        bulkMode && isSelected ? 'bg-primary-xlight/50 hover:bg-primary-xlight/70' : 'hover:bg-surface-2/40'
                      }`}
                    >
                      {bulkMode && (
                        <td className="pl-4 pr-2 py-4 align-top">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelect(wf.id)}
                            ariaLabel={`Select ${wf.name}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-4 align-top w-[320px]">
                        <div className="flex flex-col gap-1.5 w-full min-w-0">
                          <div className="flex items-start gap-2 min-w-0">
                            <span
                              className="group inline cursor-pointer text-[13px] text-text font-medium hover:text-[#6a12cd] hover:underline line-clamp-2 min-w-0"
                              onClick={e => {
                                e.stopPropagation();
                                if (bulkMode) toggleSelect(wf.id);
                                else onSelectWorkflow?.(wf.id);
                              }}
                            >
                              {wf.name}
                              <ExternalLink
                                size={12}
                                className="inline ml-1 opacity-0 group-hover:opacity-100 align-middle text-[#6a12cd]"
                              />
                            </span>
                            {wf.live && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 mt-0.5"
                                style={{ backgroundColor: '#ECFEF3', color: '#047A48' }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#047A48' }} />
                                Live
                              </span>
                            )}
                          </div>
                          {/* ORIG: <span className="inline-flex items-center self-start px-2 py-0.5 rounded-md bg-surface-2 border border-border-light text-ink-700 text-[11px] font-mono font-semibold tracking-tight"> */}
                          <span className="self-start text-[11px] font-mono text-ink-500 tracking-tight">
                            {wf.controlId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-[13px] text-text-secondary max-w-[520px]">
                        <span className="line-clamp-2">{wf.description}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-[13px] text-text-secondary">
                        {wf.businessProcess}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {wf.tags.map(t => (
                            // ORIG chip: "inline-flex items-center px-2 py-0.5 rounded-md bg-primary-xlight text-primary text-[12px] font-semibold"
                            <span
                              key={t}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-2 border border-border-light text-ink-700 text-[12px] font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-4 py-4 align-top ${bulkMode ? 'pointer-events-none opacity-40' : ''}`}>
                        <div className="flex items-center justify-end gap-1">
                          <ActionIconButton
                            label="Run workflow"
                            disabled={bulkMode}
                            onClick={() => addToast({ message: `Running "${wf.name}"…`, type: 'success' })}
                          >
                            <Play size={14} />
                          </ActionIconButton>
                          <ActionIconButton
                            label="Edit"
                            disabled={bulkMode}
                            onClick={() => addToast({ message: `Editing "${wf.name}"`, type: 'success' })}
                          >
                            <Pencil size={14} />
                          </ActionIconButton>
                          <ActionIconButton
                            label="Delete"
                            disabled={bulkMode}
                            onClick={() => addToast({ message: `Deleted "${wf.name}"`, type: 'success' })}
                          >
                            <Trash2 size={14} />
                          </ActionIconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="flex items-center justify-end py-3 px-4 border-t border-border-light bg-white"
        >
          <button
            onClick={handleContinue}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-white text-[13px] font-semibold hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between  py-4 border-t border-border-light bg-white">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-text-secondary">Rows per page:</span>
            <div className="relative">
              <button
                onClick={() => setRowsDropdownOpen(p => !p)}
                className="flex items-center gap-1.5 pl-3 pr-2 h-8 rounded-md border border-border text-[13px] text-text bg-white hover:border-primary/40 transition-colors cursor-pointer"
              >
                {rowsPerPage}
                <ChevronDown size={12} className={`text-text-muted transition-transform ${rowsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {rowsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setRowsDropdownOpen(false)} />
                  <div className="absolute bottom-full mb-1 left-0 w-20 bg-white border border-border-light rounded-lg shadow-lg z-50 overflow-hidden">
                    {[10, 25, 50, 100].map(n => (
                      <button
                        key={n}
                        onClick={() => { setRowsPerPage(n); setRowsDropdownOpen(false); setPage(1); }}
                        className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-primary-xlight transition-colors cursor-pointer ${
                          n === rowsPerPage ? 'text-primary font-semibold' : 'text-text'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[13px] text-text-secondary">Page {page} of {TOTAL_PAGES}</span>
            <div className="flex items-center gap-1">
              <PaginationButton onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronsLeft size={14} />
              </PaginationButton>
              <PaginationButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </PaginationButton>
              <PaginationButton onClick={() => setPage(p => Math.min(TOTAL_PAGES, p + 1))} disabled={page === TOTAL_PAGES}>
                <ChevronRight size={14} />
              </PaginationButton>
              <PaginationButton onClick={() => setPage(TOTAL_PAGES)} disabled={page === TOTAL_PAGES}>
                <ChevronsRight size={14} />
              </PaginationButton>
            </div>
          </div>
        </div>

      {/* Bulk Execute Modal */}
      <AnimatePresence>
        {bulkModalOpen && (
          <BulkExecuteModal
            selectedWorkflows={selectedWorkflows}
            onClose={handleModalClose}
            onContinue={handleModalContinue}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
}

function ActionIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={e => { e.stopPropagation(); onClick(); }}
        className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text cursor-pointer transition-colors disabled:cursor-not-allowed"
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-ink-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 shadow-md"
      >
        {label}
      </span>
    </div>
  );
}

function FilterIconButton({
  active,
  open,
  onClick,
  label,
}: {
  active: boolean;
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={onClick}
      className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
        active || open
          ? 'bg-primary-xlight text-primary'
          : 'text-text-muted hover:bg-surface-3 hover:text-text'
      }`}
    >
      <ListFilter size={12} />
    </button>
  );
}

function FilterDropdown({
  options,
  selected,
  onApply,
  onClose,
}: {
  options: string[];
  selected: Set<string>;
  onApply: (next: Set<string>) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<Set<string>>(new Set(selected));

  useEffect(() => {
    setPending(new Set(selected));
  }, [selected]);

  const allSelected = options.length > 0 && options.every(o => pending.has(o));

  const togglePending = (value: string) => {
    setPending(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleAll = () => {
    setPending(prev => {
      if (options.every(o => prev.has(o))) return new Set();
      return new Set(options);
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-2 left-0 z-50 w-[260px] bg-white border border-border-light rounded-lg shadow-lg overflow-hidden">
        <div className="max-h-[320px] overflow-auto">
          <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-surface-2 border-b border-border-light">
            <Checkbox checked={allSelected} onChange={toggleAll} ariaLabel="Select all" />
            <span className="text-[13px] font-semibold text-text">Select All</span>
          </label>
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-2"
            >
              <Checkbox
                checked={pending.has(opt)}
                onChange={() => togglePending(opt)}
                ariaLabel={opt}
              />
              <span className="text-[13px] text-text">{opt}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border-light bg-white">
          <button
            type="button"
            onClick={() => setPending(new Set())}
            disabled={pending.size === 0}
            className="px-3 h-8 rounded-md text-[13px] font-semibold text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(pending)}
            className="px-4 h-8 rounded-md bg-primary text-white text-[13px] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

function PaginationButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-md flex items-center justify-center text-text-secondary hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}
