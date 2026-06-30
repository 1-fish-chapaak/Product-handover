import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, UserPlus, ChevronLeft, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { RISK_OWNERS, type GrcException, type GrcExceptionStatus } from '../../data/mockData';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import Gated from '../shared/Gated';
import { useWorkflowOptional } from './workflow/WorkflowContext';
import { userName } from './workflow/workflowData';

// ─── Styling vocab — mirrors the table chips so the preview reads
//     identically to the main Exceptions table. ───────────────────────────
const STATUS_STYLE: Record<GrcExceptionStatus, string> = {
  Open:           'bg-evidence-50 text-evidence-700',
  'Under Review': 'bg-mitigated-50 text-mitigated-700',
  Closed:         'bg-compliant-50 text-compliant-700',
};
const STATUS_LABEL: Record<GrcExceptionStatus, string> = {
  Open:           'Open',
  'Under Review': 'In-Progress',
  Closed:         'Closed',
};

const PAGE_SIZE = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BulkAssignPayload = {
  caseIds: string[];
  assignees: { name: string; initials: string }[];
  note?: string;
};

interface Props {
  cases: GrcException[];
  onClose: () => void;
  onApply: (payload: BulkAssignPayload) => void;
  /** Pre-fill the assignee picker (e.g. changing a single case's assignee) so
   *  the user can add/remove from the current owners instead of starting blank. */
  initialAssignees?: { name: string; initials: string }[];
}

function deriveInitials(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '?';
  if (EMAIL_RE.test(trimmed)) {
    const local = trimmed.split('@')[0];
    return (local.slice(0, 2) || '?').toUpperCase();
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function BulkAssignDrawer({ cases, onClose, onApply, initialAssignees }: Props) {
  // Per-row checked set — interactive, starts with everything checked so the
  // title "Assign N Cases" matches the count the user came in with.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(cases.map(c => c.id)));
  const [page, setPage] = useState(1);
  const [assigneeInput, setAssigneeInput] = useState('');
  // Pre-seed the picker from any existing assignees so "change assignee" lets the
  // user add/remove from the current owners rather than starting from scratch.
  const [pickedUserIds, setPickedUserIds] = useState<Set<string>>(
    () => new Set((initialAssignees ?? []).map(a => RISK_OWNERS.find(u => u.name === a.name)?.id).filter((id): id is string => !!id)),
  );
  const [freeEmailEntries, setFreeEmailEntries] = useState<{ name: string; initials: string }[]>(
    () => (initialAssignees ?? []).filter(a => !RISK_OWNERS.some(u => u.name === a.name)),
  );
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [note, setNote] = useState('');
  const assigneeRef = useRef<HTMLDivElement | null>(null);
  const assigneeInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  // Focus trap — keeps Tab/Shift+Tab inside the drawer; ESC routes through onClose.
  useFocusTrap(drawerRef, true, onClose);

  // ── Segregation of duties ───────────────────────────────────────────────
  // The person doing the work on a case can't ALSO be an approver in that case's
  // approval chain — otherwise they'd be approving their own work. Collect the
  // names of everyone in the checked cases' approval chains (Risk Owner route +
  // any attached Auditor route) so we can block them from being picked as the
  // assignee and explain why.
  const wf = useWorkflowOptional();
  const chainApproverNames = useMemo(() => {
    const names = new Set<string>();
    if (!wf) return names;
    cases.forEach(c => {
      if (!checked.has(c.id)) return;
      wf.assignments
        .filter(a => a.exceptionId === c.id && a.persona === 'risk-owner')
        .forEach(a => a.levels.forEach(l => l.assigneeIds.forEach(id => names.add(userName(id)))));
      wf.auditorRoutes[c.id]?.levels.forEach(l => l.assigneeIds.forEach(id => names.add(userName(id))));
    });
    return names;
  }, [wf, cases, checked]);

  // Count of checked cases that already have an assignee — drives the
  // reassignment warning banner above the Cases Preview.
  const reassignedCount = useMemo(() => {
    return cases.filter(c => {
      if (!checked.has(c.id)) return false;
      return (c.assignees && c.assignees.length > 0) || !!c.assignedTo;
    }).length;
  }, [cases, checked]);

  // Esc / scroll-lock / outside-click — match BulkClassifyModal patterns.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (!assigneeOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (assigneeRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setAssigneeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assigneeOpen]);

  const checkedCount = checked.size;
  const totalPages = Math.max(1, Math.ceil(cases.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageCases = useMemo(
    () => cases.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [cases, safePage],
  );

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const togglePage = () => setChecked(prev => {
    const next = new Set(prev);
    const allOnPage = pageCases.every(c => next.has(c.id));
    pageCases.forEach(c => { if (allOnPage) next.delete(c.id); else next.add(c.id); });
    return next;
  });
  const pageAllChecked = pageCases.length > 0 && pageCases.every(c => checked.has(c.id));
  const pageSomeChecked = pageCases.some(c => checked.has(c.id));

  // Typeahead matches — case-insensitive name/email/role match.
  const assigneeMatches = useMemo(() => {
    const q = assigneeInput.trim().toLowerCase();
    if (!q) return RISK_OWNERS;
    return RISK_OWNERS.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [assigneeInput]);

  const exactMatch = useMemo(() => {
    const q = assigneeInput.trim().toLowerCase();
    return RISK_OWNERS.find(u => u.name.toLowerCase() === q || u.email.toLowerCase() === q) ?? null;
  }, [assigneeInput]);

  const freeEmailAlreadyAdded = useMemo(() => {
    const q = assigneeInput.trim().toLowerCase();
    return freeEmailEntries.some(e => e.name.toLowerCase() === q);
  }, [assigneeInput, freeEmailEntries]);

  const canUseFreeEmail =
    !exactMatch &&
    EMAIL_RE.test(assigneeInput.trim()) &&
    !freeEmailAlreadyAdded;

  // The actual assignees resolved at submit time — every picked user plus any
  // invited free emails.
  const resolvedAssignees = useMemo<{ name: string; initials: string }[]>(() => {
    const fromPicks = RISK_OWNERS
      .filter(u => pickedUserIds.has(u.id))
      .map(u => ({ name: u.name, initials: u.initials }));
    return [...fromPicks, ...freeEmailEntries];
  }, [pickedUserIds, freeEmailEntries]);

  // Portal-positioned menu — computes fixed coords relative to the chip
  // container (not the inner input, which shifts horizontally as chips are
  // added). Flips upward when there isn't enough room below so the list never
  // gets clipped by the drawer body's overflow scroll.
  useLayoutEffect(() => {
    if (!assigneeOpen || !assigneeRef.current) return;
    const rect = assigneeRef.current.getBoundingClientRect();
    const estimatedHeight = 240; // ~max-h of menu, used to decide flip
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < estimatedHeight + 16 && rect.top > estimatedHeight + 16;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      zIndex: 70,
    });
  }, [assigneeOpen, assigneeInput, resolvedAssignees.length]);
  // Recompute when the parent drawer scrolls or the window resizes.
  useEffect(() => {
    if (!assigneeOpen) return;
    const recompute = () => {
      if (!assigneeRef.current) return;
      const rect = assigneeRef.current.getBoundingClientRect();
      const estimatedHeight = 240;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < estimatedHeight + 16 && rect.top > estimatedHeight + 16;
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        ...(flipUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
        zIndex: 70,
      });
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [assigneeOpen, resolvedAssignees.length]);

  // Picked assignees who are also approvers in a checked case's chain — blocks
  // confirmation (you can't approve your own work).
  const conflictingPicks = useMemo(
    () => resolvedAssignees.filter(a => chainApproverNames.has(a.name)),
    [resolvedAssignees, chainApproverNames],
  );

  const canConfirm = checkedCount > 0 && resolvedAssignees.length > 0 && conflictingPicks.length === 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onApply({
      caseIds: Array.from(checked),
      assignees: resolvedAssignees,
      note: note.trim() || undefined,
    });
  };

  const handleTogglePickUser = (userId: string) => {
    setPickedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
    setAssigneeInput('');
    assigneeInputRef.current?.focus();
  };

  const handlePickFreeEmail = () => {
    const value = assigneeInput.trim();
    if (!value || !EMAIL_RE.test(value)) return;
    setFreeEmailEntries(prev =>
      prev.some(e => e.name.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, { name: value, initials: deriveInitials(value) }],
    );
    setAssigneeInput('');
    assigneeInputRef.current?.focus();
  };

  const handleRemoveAssignee = (name: string) => {
    const owner = RISK_OWNERS.find(u => u.name === name);
    if (owner) {
      setPickedUserIds(prev => {
        const next = new Set(prev);
        next.delete(owner.id);
        return next;
      });
      return;
    }
    setFreeEmailEntries(prev => prev.filter(e => e.name !== name));
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-50"
        onClick={onClose}
      />
      <motion.aside
        ref={drawerRef}
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[860px] max-h-[88vh] bg-canvas-elevated shadow-xl border border-canvas-border rounded-[16px] z-[60] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Bulk Assign"
        tabIndex={-1}
      >
        {/* Header */}
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[10px] bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-ink-900 leading-tight">
                Assign <span className="tabular-nums">{checkedCount}</span> Case{checkedCount === 1 ? '' : 's'}
              </h2>
              <p className="text-[12.5px] text-ink-500 mt-1 leading-snug">
                Pick the owner who'll triage these cases. Uncheck any rows you want to exclude.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Reassignment warning — only renders when any checked case already has owners */}
          {reassignedCount > 0 && (
            <div
              role="status"
              className="flex items-start gap-2.5 px-3 py-2.5 bg-mitigated-50 border border-mitigated-200 rounded-[10px] text-[12.5px] text-mitigated-800"
            >
              <AlertTriangle size={15} className="text-mitigated-700 shrink-0 mt-px" aria-hidden="true" />
              <span className="leading-snug">
                <span className="font-semibold tabular-nums">{reassignedCount}</span>{' '}
                {reassignedCount === 1 ? 'case already has' : 'cases already have'} an owner.
                Confirming will replace the current owner{reassignedCount === 1 ? '' : 's'}.
                Uncheck rows to skip them.
              </span>
            </div>
          )}

          {/* Segregation-of-duties conflict — a picked assignee is also an approver */}
          {conflictingPicks.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-3 py-2.5 bg-risk-50 border border-risk-200 rounded-[10px] text-[12.5px] text-risk-800"
            >
              <AlertTriangle size={15} className="text-risk-700 shrink-0 mt-px" aria-hidden="true" />
              <span className="leading-snug">
                <span className="font-semibold">{conflictingPicks.map(a => a.name).join(', ')}</span>{' '}
                {conflictingPicks.length === 1 ? 'is' : 'are'} already in the approval chain for{' '}
                {conflictingPicks.length === 1 ? 'a selected case' : 'selected cases'}, so they can’t also be assigned to do the work — that would let them approve their own case. Remove them, or change the approval flow.
              </span>
            </div>
          )}

          {/* Cases Preview */}
          <section>
            <h3 className="text-[12.5px] font-semibold text-ink-800 mb-3">Cases Preview</h3>
            <div className="border border-canvas-border rounded-[10px] overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-ink-500 uppercase tracking-wider border-b border-canvas-border">
                    <th className="px-3 py-2.5 w-[44px]">
                      <input
                        type="checkbox"
                        checked={pageAllChecked}
                        ref={el => { if (el) el.indeterminate = !pageAllChecked && pageSomeChecked; }}
                        onChange={togglePage}
                        className="accent-brand-600 cursor-pointer w-4 h-4"
                        aria-label="Toggle all on this page"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium text-[10.5px]">Exception ID</th>
                    <th className="px-3 py-2.5 font-medium text-[10.5px]">Assigned to</th>
                    <th className="px-3 py-2.5 font-medium text-[10.5px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageCases.map(ex => {
                    const isChecked = checked.has(ex.id);
                    return (
                      <tr
                        key={ex.id}
                        className={`border-b border-canvas-border last:border-b-0 transition-colors ${isChecked ? '' : 'opacity-55'} hover:bg-[#FAFAFB]`}
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(ex.id)}
                            className="accent-brand-600 cursor-pointer w-4 h-4"
                            aria-label={`Toggle ${ex.id}`}
                          />
                        </td>
                        <td className="px-3 py-2.5 align-middle font-mono text-[12px] text-brand-700">{ex.id}</td>
                        <td className="px-3 py-2.5 align-middle">
                          {(() => {
                            const allAssignees = ex.assignees ?? (ex.assignedTo ? [ex.assignedTo] : []);
                            if (allAssignees.length > 1) {
                              const MAX_VISIBLE = 4;
                              const visible = allAssignees.slice(0, MAX_VISIBLE);
                              const overflow = allAssignees.length - visible.length;
                              const overflowNames = allAssignees.slice(MAX_VISIBLE).map(a => a.name).join(', ');
                              return (
                                <div className="inline-flex items-center">
                                  {visible.map((a, i) => (
                                    <span
                                      key={`${a.name}-${i}`}
                                      className={`group/av relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold border-2 border-canvas-elevated shrink-0 hover:z-10 ${i === 0 ? '' : '-ml-2'}`}
                                      aria-label={a.name}
                                    >
                                      {a.initials}
                                      <span
                                        className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/av:opacity-100 transition-opacity z-50"
                                        role="tooltip"
                                      >
                                        {a.name}
                                      </span>
                                    </span>
                                  ))}
                                  {overflow > 0 && (
                                    <span
                                      className="group/av relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold border-2 border-canvas-elevated shrink-0 hover:z-10 -ml-2"
                                      aria-label={`${overflow} more: ${overflowNames}`}
                                    >
                                      +{overflow}
                                      <span
                                        className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 px-2 py-1 bg-ink-900 text-white text-[10px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/av:opacity-100 transition-opacity z-50"
                                        role="tooltip"
                                      >
                                        {overflowNames}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return ex.assignedTo ? (
                              <span className="text-ink-700">{ex.assignedTo.name}</span>
                            ) : (
                              <span className="text-ink-400 italic">Not Assigned</span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <span className={`inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium ${STATUS_STYLE[ex.status]}`}>
                            {STATUS_LABEL[ex.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-canvas-border text-[11.5px] text-ink-500">
                  <span className="tabular-nums">Page {safePage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="w-6 h-6 inline-flex items-center justify-center rounded-md text-ink-500 hover:bg-[#F4F2F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="w-6 h-6 inline-flex items-center justify-center rounded-md text-ink-500 hover:bg-[#F4F2F7] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Assigned to + Note — two-column grid */}
          <section className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[12px] font-medium text-ink-700 mb-1.5">
                Assigned to <span className="text-risk">*</span>
              </label>
              <div className="relative" ref={assigneeRef}>
                <div
                  className="h-10 w-full px-2 bg-canvas-elevated border border-canvas-border rounded-[8px] flex items-center gap-1.5 overflow-x-auto whitespace-nowrap focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-600/15 cursor-text"
                  onClick={() => {
                    assigneeInputRef.current?.focus();
                    setAssigneeOpen(true);
                  }}
                >
                  {resolvedAssignees.map(a => (
                    <span
                      key={a.name}
                      className="inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full bg-brand-50 text-brand-700 text-[12px] shrink-0"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[9px] font-semibold">
                        {a.initials}
                      </span>
                      <span className="leading-none">{a.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveAssignee(a.name); }}
                        className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-brand-100 text-brand-700 cursor-pointer"
                        aria-label={`Remove ${a.name}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={assigneeInputRef}
                    type="text"
                    value={assigneeInput}
                    onChange={(e) => {
                      setAssigneeInput(e.target.value);
                      setAssigneeOpen(true);
                    }}
                    onFocus={() => setAssigneeOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !assigneeInput && resolvedAssignees.length > 0) {
                        handleRemoveAssignee(resolvedAssignees[resolvedAssignees.length - 1].name);
                      } else if (e.key === 'Enter' && canUseFreeEmail) {
                        e.preventDefault();
                        handlePickFreeEmail();
                      }
                    }}
                    placeholder={resolvedAssignees.length === 0 ? 'Select user or type email' : ''}
                    aria-haspopup="listbox"
                    aria-expanded={assigneeOpen}
                    className="flex-1 min-w-[140px] h-7 px-1 bg-transparent text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none shrink-0"
                  />
                </div>
                {assigneeOpen && (assigneeMatches.length > 0 || canUseFreeEmail) && createPortal(
                  <div
                    ref={menuRef}
                    role="listbox"
                    aria-multiselectable="true"
                    style={menuStyle}
                    className="max-h-[240px] overflow-y-auto bg-canvas-elevated border border-canvas-border rounded-[10px] shadow-xl py-1"
                  >
                    {assigneeMatches.map(u => {
                      const isSelected = pickedUserIds.has(u.id);
                      const inChain = chainApproverNames.has(u.name);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={inChain}
                          disabled={inChain}
                          onClick={() => { if (!inChain) handleTogglePickUser(u.id); }}
                          title={inChain ? `${u.name} is in this case's approval chain and can't also be the assignee.` : undefined}
                          className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-[12.5px] ${inChain ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#FAFAFB] cursor-pointer'}`}
                        >
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold shrink-0">
                            {u.initials}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-ink-900 truncate">{u.name}</span>
                            <span className="block text-ink-500 text-[11px] truncate">
                              {inChain ? 'In the approval chain — can’t be the assignee' : `${u.role} · ${u.email}`}
                            </span>
                          </span>
                          {isSelected && !inChain && (
                            <Check size={14} className="text-brand-600 shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                    {canUseFreeEmail && (
                      <button
                        type="button"
                        onClick={handlePickFreeEmail}
                        className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-[12.5px] hover:bg-[#FAFAFB] cursor-pointer border-t border-canvas-border/60"
                      >
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-paper-50 text-ink-500 text-[10px] font-semibold shrink-0">
                          @
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-ink-900 truncate">Invite "{assigneeInput.trim()}"</span>
                          <span className="block text-ink-500 text-[11px]">External email</span>
                        </span>
                      </button>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-ink-700 mb-1.5">
                Assignment Note <span className="text-ink-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                className="w-full h-10 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-600/15"
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="shrink-0 px-6 py-4 border-t border-canvas-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[13px] font-medium text-ink-700 bg-canvas-elevated border border-canvas-border rounded-[8px] hover:bg-[#F4F2F7] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <Gated permission="exc_assign" mode="disable" title="You don't have permission to assign exceptions">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="h-9 px-4 text-[13px] font-semibold text-white bg-brand-600 rounded-[8px] hover:bg-brand-500 disabled:bg-brand-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            Confirm
          </button>
          </Gated>
        </footer>
      </motion.aside>
    </>
  );
}
