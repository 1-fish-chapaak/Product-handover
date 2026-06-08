import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Sparkles,
  Upload,
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
  Database,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useToast } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import { BulkExecuteModal, Checkbox } from './BulkExecuteModal';

interface Props {
  onCreateWorkflow?: () => void;
  onSelectWorkflow?: (id: string) => void;
  /** Optional: skip the detail page and open the executor directly. */
  onRunWorkflow?: (id: string) => void;
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
    id: 'lw-pdf-tester',
    name: 'PDF tester',
    description: 'Sandbox workflow whose required inputs are all PDFs. Use this to exercise the unstructured-document mapping journey end-to-end.',
    tags: ['PDF', 'manual mapping'],
    businessProcess: 'Sandbox',
    controlId: 'CTRL-PDF',
    live: true,
  },
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

export default function WorkflowLibraryView({ onCreateWorkflow, onSelectWorkflow, onRunWorkflow, processFilter }: Props) {
  const { can } = useCan();
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
  const [auditRun, setAuditRun] = useState<{
    name: string;
    workflows: BulkRunWorkflowResult[];
    skippedCount: number;
    date: string;
  } | null>(null);

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
    setBulkModalOpen(false);
    exitBulkMode();
    const workflows = selectedWorkflows.map(w => ({
      id: w.id,
      code: w.controlId,
      name: w.name,
      casesFlagged: deterministicCaseCount(w.controlId + w.id),
    }));
    setAuditRun({
      name: data.auditName || 'BulkRun',
      workflows,
      skippedCount: 0,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
  };

  const handleRowClick = (id: string) => {
    if (bulkMode) {
      toggleSelect(id);
    } else {
      onSelectWorkflow?.(id);
    }
  };

  if (auditRun) {
    return <AuditLogsView run={auditRun} onBack={() => setAuditRun(null)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
      className="h-full w-full bg-white flex flex-col overflow-hidden px-[180px]"
    >
      {/* Header */}
      <div className="pt-8 pb-5">
        <div className="font-mono text-[0.6875rem] text-ink-500 mb-2 tracking-tight">
          Workflow Library
        </div>
        <h1 className="font-display text-[2.125rem] font-[420] tracking-tight text-ink-900 leading-[1.15]">
          Workflow Library
        </h1>
        <p className="text-[0.875rem] text-ink-500 mt-1">
          Browse the workflow catalog and add the ones relevant to your audit.
        </p>
      </div>

      {/* Search + Create */}
      <div className=" pb-5 flex items-center gap-3">
          {bulkMode && (
            <span className="text-[0.8125rem] text-text-secondary">
              <span className="font-semibold text-text">{selectedIds.size}</span> selected
            </span>
          )}
          <div className="relative w-[400px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search workflow.."
              className="w-full pl-10 pr-4 h-10 rounded-md border border-border bg-white text-[0.8125rem] outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {can('wf_upload') && (
              <button
                onClick={() => addToast({ message: 'Upload a workflow file to import', type: 'info' })}
                className="flex items-center gap-2 px-4 h-10 rounded-md bg-white text-text border border-border text-[0.8125rem] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <Upload size={14} />
                Upload
              </button>
            )}
            {can('wf_create') && (
              <button
                onClick={() => onCreateWorkflow?.()}
                className="flex items-center gap-2 px-4 h-10 rounded-md bg-primary-xlight text-primary border border-primary/15 text-[0.8125rem] font-semibold hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Sparkles size={14} />
                Create Workflow
              </button>
            )}
            {can('wf_run') && (bulkMode ? (
              <button
                onClick={exitBulkMode}
                className="flex items-center gap-2 px-4 h-10 rounded-md bg-white text-text border border-border text-[0.8125rem] font-semibold hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={enterBulkMode}
                className="flex items-center gap-2 px-4 h-10 rounded-md bg-white text-text border border-border text-[0.8125rem] font-semibold transition-colors cursor-pointer hover:bg-[#6a12cd] hover:text-white hover:border-[#6a12cd]"
              >
                <Play size={14} />
                Bulk Run
              </button>
            ))}
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
                {/* ORIG th classes below: "px-4 py-3.5 text-left text-[0.8125rem] font-semibold text-text ..." */}
                <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[320px]">Workflow Name</th>
                <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">Workflow Description</th>
                <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[170px]">
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
                <th className="px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[200px]">
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
                <th className="px-4 py-3 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted w-[140px]" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={bulkMode ? 6 : 5} className="px-6 py-16 text-center text-[0.8125rem] text-text-muted">
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
                              className="group inline cursor-pointer text-[0.8125rem] text-text font-medium hover:text-[#6a12cd] hover:underline line-clamp-2 min-w-0"
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
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[0.6875rem] font-medium shrink-0 mt-0.5"
                                style={{ backgroundColor: '#ECFEF3', color: '#047A48' }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#047A48' }} />
                                Live
                              </span>
                            )}
                          </div>
                          {/* ORIG: <span className="inline-flex items-center self-start px-2 py-0.5 rounded-md bg-surface-2 border border-border-light text-ink-700 text-[0.6875rem] font-mono font-semibold tracking-tight"> */}
                          <span className="self-start text-[0.6875rem] font-mono text-ink-500 tracking-tight">
                            {wf.controlId}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-[0.8125rem] text-text-secondary max-w-[520px]">
                        <span className="line-clamp-2">{wf.description}</span>
                      </td>
                      <td className="px-4 py-4 align-top text-[0.8125rem] text-text-secondary">
                        {wf.businessProcess}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {wf.tags.map(t => (
                            // ORIG chip: "inline-flex items-center px-2 py-0.5 rounded-md bg-primary-xlight text-primary text-[0.75rem] font-semibold"
                            <span
                              key={t}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-2 border border-border-light text-ink-700 text-[0.75rem] font-medium"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`px-4 py-4 align-top ${bulkMode ? 'pointer-events-none opacity-40' : ''}`}>
                        <div className="flex items-center justify-end gap-1">
                          {can('wf_output') && (
                            <ActionIconButton
                              label="View output"
                              disabled={bulkMode}
                              onClick={() => addToast({ message: `Opening latest output for "${wf.name}"…`, type: 'success' })}
                            >
                              <FileText size={14} />
                            </ActionIconButton>
                          )}
                          {can('wf_run') && (
                            <ActionIconButton
                              label="Run workflow"
                              disabled={bulkMode}
                              onClick={() => {
                                if (onRunWorkflow) {
                                  onRunWorkflow(wf.id);
                                } else {
                                  addToast({ message: `Running "${wf.name}"…`, type: 'success' });
                                }
                              }}
                            >
                              <Play size={14} />
                            </ActionIconButton>
                          )}
                          {can('wf_update_delete') && (
                            <ActionIconButton
                              label="Edit"
                              disabled={bulkMode}
                              onClick={() => addToast({ message: `Editing "${wf.name}"`, type: 'success' })}
                            >
                              <Pencil size={14} />
                            </ActionIconButton>
                          )}
                          {can('wf_update_delete') && (
                            <ActionIconButton
                              label="Delete"
                              disabled={bulkMode}
                              onClick={() => addToast({ message: `Deleted "${wf.name}"`, type: 'success' })}
                            >
                              <Trash2 size={14} />
                            </ActionIconButton>
                          )}
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
            className="flex items-center gap-2 px-4 h-9 rounded-md bg-primary text-white text-[0.8125rem] font-semibold hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Continue
            <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between  py-4 border-t border-border-light bg-white">
          <div className="flex items-center gap-2">
            <span className="text-[0.8125rem] text-text-secondary">Rows per page:</span>
            <div className="relative">
              <button
                onClick={() => setRowsDropdownOpen(p => !p)}
                className="flex items-center gap-1.5 pl-3 pr-2 h-8 rounded-md border border-border text-[0.8125rem] text-text bg-white hover:border-primary/40 transition-colors cursor-pointer"
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
                        className={`w-full text-left px-3 py-1.5 text-[0.8125rem] hover:bg-primary-xlight transition-colors cursor-pointer ${
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
            <span className="text-[0.8125rem] text-text-secondary">Page {page} of {TOTAL_PAGES}</span>
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
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-ink-900 text-white text-[0.6875rem] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-30 shadow-md"
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
            <span className="text-[0.8125rem] font-semibold text-text">Select All</span>
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
              <span className="text-[0.8125rem] text-text">{opt}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-border-light bg-white">
          <button
            type="button"
            onClick={() => setPending(new Set())}
            disabled={pending.size === 0}
            className="px-3 h-8 rounded-md text-[0.8125rem] font-semibold text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => onApply(pending)}
            className="px-4 h-8 rounded-md bg-primary text-white text-[0.8125rem] font-semibold hover:bg-primary-hover transition-colors cursor-pointer"
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

export type BulkRunWorkflowResult = { id: string; code: string; name: string; casesFlagged: number };

export function deterministicCaseCount(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const buckets = [0, 0, 1, 4, 12, 47, 128, 312, 891, 1248, 3271];
  return buckets[Math.abs(hash) % buckets.length];
}

export function AuditLogsView({
  run,
  onBack,
}: {
  run: { name: string; workflows: BulkRunWorkflowResult[]; skippedCount: number; date: string };
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return run.workflows;
    return run.workflows.filter(w => w.name.toLowerCase().includes(q));
  }, [run.workflows, search]);
  const successCount = run.workflows.length;
  const totalCount = run.workflows.length + run.skippedCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 0.68, 0, 1] }}
      className="h-full w-full bg-white flex flex-col overflow-hidden px-[120px]"
    >
      <div className="pt-8 pb-5">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-500">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 hover:text-text transition-colors cursor-pointer"
          >
            <Database size={13} />
            Business Process
          </button>
          <ChevronRight size={13} />
          <span>Audit Logs</span>
          <ChevronRight size={13} />
          <span className="text-primary font-mono">{run.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border-light bg-white p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-text mb-1">Overall Status</div>
            <div className="text-[12px] text-text-muted">Total workflows audited successfully</div>
            <div className="text-[28px] font-semibold text-primary mt-3 leading-none">
              {successCount}/{totalCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Database size={18} className="text-primary" />
          </div>
        </div>
        <div className="rounded-xl border border-border-light bg-white p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-text mb-1">Skipped Workflows</div>
            <div className="text-[12px] text-text-muted">Workflows skipped due to exception</div>
            <div className="text-[28px] font-semibold text-text mt-3 leading-none">{run.skippedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-text-muted" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="relative flex-1 max-w-[480px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Workflows"
            className="w-full pl-9 pr-3 h-10 rounded-md border border-border-light text-[13px] text-text bg-white outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-primary/30 text-primary bg-white text-[13px] font-semibold hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <FileText size={14} />
          View Report
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border-light bg-white">
        <div className="grid grid-cols-[1fr_180px_140px_140px] gap-x-4 px-4 py-3 border-b border-border-light bg-surface-2/40 text-[11.5px] font-semibold text-text-muted">
          <div>Workflow Name</div>
          <div>Cases Flagged</div>
          <div>Status</div>
          <div>Audit Date</div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-[12.5px] text-text-muted text-center py-12">
            No workflows match this search.
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map(w => {
              const openExecutor = () => {
                const url = new URL(window.location.href);
                url.searchParams.set('view', 'workflow-executor');
                url.searchParams.set('workflowId', w.id);
                url.searchParams.set('state', 'completed');
                window.open(url.toString(), '_blank', 'noopener,noreferrer');
              };
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={openExecutor}
                  className="w-full text-left grid grid-cols-[1fr_180px_140px_140px] gap-x-4 px-4 py-3.5 items-center hover:bg-surface-2/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[13px] text-text truncate hover:text-primary">{w.name}</span>
                    <span className="inline-flex items-center gap-1 px-2 h-5 rounded-full bg-compliant-50 text-compliant-700 text-[10.5px] font-medium border border-compliant/25 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-compliant" />
                      Live
                    </span>
                  </div>
                  <div className="text-[13px] text-text tabular-nums">
                    {w.casesFlagged.toLocaleString()} {w.casesFlagged === 1 ? 'case flagged' : 'cases flagged'}
                  </div>
                  <div>
                    <span className="inline-flex items-center px-2.5 h-5 rounded-md bg-compliant-50 text-compliant-700 text-[10.5px] font-medium border border-compliant/25">
                      Completed
                    </span>
                  </div>
                  <div className="text-[13px] text-text">{run.date}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="py-6" />
    </motion.div>
  );
}
