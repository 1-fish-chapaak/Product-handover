import { useState, useMemo, useRef, useCallback } from 'react';
import Gated from '../shared/Gated';
import {
  X, FileText, Plus, Check, ChevronRight, Search, Lock,
} from 'lucide-react';
import type { AuditResultData, GranularSelection } from './AddToDashboardModal';
import {
  SectionHeader, KpiPreviewRow, ChartPreviewRow, TablePreviewRow,
} from './WidgetPickerParts';
import { toggleIn, setAll } from './widgetPickerHelpers';
import {
  ModalShell, ModalEmptyState, ModalErrorBanner, ModalRowSkeleton, ModalSubmitError,
  ButtonSpinner, OfflineBanner,
} from './ModalPrimitives';
import {
  useDialogA11y, useStableId, useOnlineStatus, useListKeyboardNav,
  useLocalCollapse, withTimeout,
} from './useModalA11y';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportOption {
  id: string;
  name: string;
  status: 'draft' | 'final';
  generatedBy?: string;
}

export interface ReportConfirmPayload {
  reportId: string;
  reportName: string;
  isNew: boolean;
  newName?: string;
  newDescription?: string;
  selection: GranularSelection;
}

interface AddToReportModalProps {
  open: boolean;
  onClose: () => void;
  reports: ReportOption[];
  alreadyAddedIds?: string[];
  resultData: AuditResultData;
  onConfirm: (payload: ReportConfirmPayload) => void | Promise<void>;
  loading?: boolean;
  loadError?: string | null;
  onRetryLoad?: () => void;
}

const ACCENT = 'brand' as const;
const NAME_MAX = 80;
const DESC_MAX = 240;
const DESC_SOFT = Math.round(DESC_MAX * 0.8);
const SUBMIT_TIMEOUT_MS = 30_000;
const RESERVED_NAMES = new Set(['default', 'system', 'untitled', 'new report']);

export function AddToReportModal({
  open, onClose, reports, alreadyAddedIds = [], resultData, onConfirm,
  loading = false, loadError = null, onRetryLoad,
}: AddToReportModalProps) {
  const [step, setStep] = useState<'pick' | 'sections'>('pick');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [nameTouched, setNameTouched] = useState(false);

  const [selKpis, setSelKpis] = useState<Set<string>>(new Set((resultData?.kpis || []).map(k => k.label)));
  const [selCharts, setSelCharts] = useState<Set<string>>(new Set((resultData?.charts || []).map(c => c.id)));
  const [selCols, setSelCols] = useState<Set<string>>(new Set(resultData?.table?.columns || []));
  const [collapsed, setCollapsed] = useLocalCollapse('add-to-report:collapsed');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const online = useOnlineStatus();

  const searchRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStep('pick');
    setMode('existing');
    setSelectedId(null);
    setSearch('');
    setNewName('');
    setNewDesc('');
    setNameTouched(false);
    setSelKpis(new Set((resultData?.kpis || []).map(k => k.label)));
    setSelCharts(new Set((resultData?.charts || []).map(c => c.id)));
    setSelCols(new Set(resultData?.table?.columns || []));
    setSubmitError(null);
    setSubmitting(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [resultData]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const trimmedName = newName.trim();
  const hasOuterWhitespace = newName.length !== trimmedName.length && newName.length > 0;
  const isReserved = trimmedName.length > 0 && RESERVED_NAMES.has(trimmedName.toLowerCase());
  const duplicateName = useMemo(
    () => mode === 'new'
      && trimmedName.length > 0
      && reports.some(r => r.name.toLowerCase() === trimmedName.toLowerCase()),
    [mode, trimmedName, reports],
  );
  const nameError =
    mode === 'new' && nameTouched && trimmedName.length === 0 ? 'Report name is required.'
    : duplicateName ? 'A report with this name already exists.'
    : isReserved ? `“${trimmedName}” is a reserved name. Pick something else.`
    : null;
  const nameNotice = !nameError && hasOuterWhitespace
    ? 'Leading and trailing spaces will be trimmed.' : null;

  const canProceed = mode === 'new'
    ? trimmedName.length > 0 && !duplicateName && !isReserved
    : selectedId !== null;
  const totalSelected = selKpis.size + selCharts.size + selCols.size;
  const hasAnyResultItems =
    resultData.kpis.length + resultData.charts.length + resultData.table.columns.length > 0;

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSubmitting(false);
    setSubmitError('Cancelled. Nothing was added.');
  };

  const handleConfirm = async () => {
    const isNew = mode === 'new';
    const reportId = isNew ? `report-${Date.now()}` : selectedId!;
    const reportName = isNew ? trimmedName : reports.find(r => r.id === selectedId)?.name || '';
    const payload: ReportConfirmPayload = {
      reportId,
      reportName,
      isNew,
      newName: isNew ? trimmedName : undefined,
      newDescription: isNew ? newDesc.trim() : undefined,
      selection: { kpis: [...selKpis], charts: [...selCharts], columns: [...selCols] },
    };

    setSubmitError(null);
    let result: void | Promise<void>;
    try {
      result = onConfirm(payload);
    } catch (e) {
      setSubmitError(messageFrom(e));
      return;
    }

    if (result && typeof (result as Promise<void>).then === 'function') {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSubmitting(true);
      try {
        await withTimeout(result, SUBMIT_TIMEOUT_MS, ctrl.signal);
        reset();
        onClose();
      } catch (e) {
        if (!ctrl.signal.aborted) setSubmitError(messageFrom(e));
      } finally {
        setSubmitting(false);
        abortRef.current = null;
      }
    } else {
      reset();
      onClose();
    }
  };

  const handleAdvance = () => {
    if (step === 'pick' && canProceed) setStep('sections');
    else if (step === 'sections' && totalSelected > 0 && !submitting) handleConfirm();
  };

  const filtered = useMemo(
    () => reports.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase())),
    [reports, search],
  );
  const searchTrim = search.trim();
  const noReportsAtAll = !loading && !loadError && reports.length === 0;
  const noSearchHits = !loading && !loadError && reports.length > 0 && searchTrim.length > 0 && filtered.length === 0;

  const titleId = useStableId('add-rpt-title');
  const descId = useStableId('add-rpt-desc');

  const dialogRef = useDialogA11y(open, handleClose, {
    initialFocusRef: step === 'pick' && mode === 'existing' ? searchRef : nameRef,
    onReturn: handleAdvance,
  });

  const navigableIds = useMemo(
    () => filtered.filter(r => r.status !== 'final' && !alreadyAddedIds.includes(r.id)).map(r => r.id),
    [filtered, alreadyAddedIds],
  );
  const { highlight, setHighlight, onKeyDown: onSearchKey } = useListKeyboardNav(
    navigableIds,
    setSelectedId,
  );

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      labelledBy={titleId}
      describedBy={descId}
      dialogRef={dialogRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-canvas-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <FileText size={15} className="text-brand-700" />
          </div>
          <div>
            <h2 id={titleId} className="text-[0.9375rem] font-semibold text-ink-800">
              {step === 'pick' ? 'Add to Report' : 'Choose What to Include'}
            </h2>
            <p id={descId} className="text-[0.6875rem] text-ink-500">
              {step === 'pick' ? 'Choose a draft report or create a new one'
                : 'Select individual KPIs, charts, and columns'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          disabled={submitting}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-ink-400 hover:text-ink-600 rounded-md hover:bg-paper-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {step === 'pick' ? (
          <div className="space-y-4">
            {!online && <OfflineBanner />}

            {/* Mode toggle */}
            <div className="flex gap-1.5 p-1 bg-paper-50 rounded-lg" role="tablist" aria-label="Destination type">
              <button
                type="button"
                role="tab"
                id="add-rpt-existing-tab"
                aria-controls="add-rpt-existing-panel"
                aria-selected={mode === 'existing'}
                onClick={() => setMode('existing')}
                className={`flex-1 text-[0.75rem] font-semibold py-2 rounded-md transition-all cursor-pointer min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                  mode === 'existing' ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                Existing report
              </button>
              <button
                type="button"
                role="tab"
                id="add-rpt-new-tab"
                aria-controls="add-rpt-new-panel"
                aria-selected={mode === 'new'}
                onClick={() => setMode('new')}
                className={`flex-1 text-[0.75rem] font-semibold py-2 rounded-md transition-all cursor-pointer min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                  mode === 'new' ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                <Plus size={12} className="inline mr-1 -mt-0.5" />
                New report
              </button>
            </div>

            {mode === 'existing' ? (
              <div
                role="tabpanel"
                id="add-rpt-existing-panel"
                aria-labelledby="add-rpt-existing-tab"
                className="space-y-3"
              >
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    ref={searchRef}
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    onKeyDown={onSearchKey}
                    placeholder="Search reports..."
                    aria-label="Search reports. Use arrow keys to navigate, Enter to select."
                    aria-controls="rpt-list"
                    aria-activedescendant={navigableIds[highlight] ? `rpt-row-${navigableIds[highlight]}` : undefined}
                    disabled={loading || !!loadError || noReportsAtAll}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-canvas-border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 transition-all disabled:bg-paper-50 disabled:text-ink-400"
                  />
                </div>

                {loadError && <ModalErrorBanner message={loadError} onRetry={onRetryLoad} />}

                <p className="sr-only" aria-live="polite">
                  {loading ? 'Loading reports…'
                    : loadError ? 'Failed to load reports.'
                    : noReportsAtAll ? 'No reports yet.'
                    : noSearchHits ? `No reports match ${searchTrim}.`
                    : `Showing ${filtered.length} of ${reports.length} report${reports.length === 1 ? '' : 's'}.`}
                </p>

                <div id="rpt-list" role="listbox" aria-label="Reports" className="space-y-1.5 max-h-[320px] overflow-y-auto">
                  {loading ? (
                    <ModalRowSkeleton rows={5} />
                  ) : noReportsAtAll ? (
                    <ModalEmptyState
                      icon={<FileText size={20} />}
                      title="No reports yet"
                      description="Start a draft report to capture findings, KPIs, and charts in one place."
                      primaryAction={{ label: 'Start a draft', onClick: () => setMode('new') }}
                      accent="brand"
                    />
                  ) : noSearchHits ? (
                    <ModalEmptyState
                      icon={<Search size={20} />}
                      title="No matches"
                      description={`No report matches “${searchTrim}”.`}
                      primaryAction={{
                        label: `Create “${searchTrim}”`,
                        onClick: () => { setNewName(searchTrim); setMode('new'); },
                      }}
                      secondaryAction={{ label: 'Clear search', onClick: () => setSearch('') }}
                      accent="brand"
                    />
                  ) : (
                    filtered.map(r => {
                      const isFinal = r.status === 'final';
                      const alreadyAdded = alreadyAddedIds.includes(r.id);
                      const disabled = isFinal || alreadyAdded;
                      const tooltip = alreadyAdded
                        ? 'This result is already in this report.'
                        : isFinal ? 'Final reports are locked. Duplicate to a new draft to keep editing.'
                        : undefined;
                      const isHighlighted = !disabled && navigableIds[highlight] === r.id;
                      return (
                        <button
                          key={r.id}
                          id={`rpt-row-${r.id}`}
                          type="button"
                          role="option"
                          disabled={disabled}
                          title={tooltip}
                          aria-label={tooltip ? `${r.name}: ${tooltip}` : r.name}
                          aria-selected={selectedId === r.id}
                          onClick={() => !disabled && setSelectedId(r.id)}
                          onMouseEnter={() => {
                            const idx = navigableIds.indexOf(r.id);
                            if (idx >= 0) setHighlight(idx);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
                            disabled
                              ? 'border-canvas-border bg-paper-50 opacity-60 cursor-not-allowed'
                              : selectedId === r.id
                                ? 'border-brand-300 bg-brand-50/50 ring-1 ring-brand-200 cursor-pointer'
                                : isHighlighted
                                  ? 'border-brand-200 bg-brand-50/30 cursor-pointer'
                                  : 'border-canvas-border hover:border-brand-200 hover:bg-paper-50 cursor-pointer'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
                            {isFinal ? <Lock size={14} className="text-ink-400" /> : <FileText size={14} className="text-brand-700" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.8125rem] font-medium text-ink-800 truncate">
                              <Highlighted text={r.name} query={searchTrim} />
                            </div>
                            <div className="text-[0.6875rem] text-ink-500">
                              {r.status === 'draft' ? 'Draft' : 'Final (locked)'}
                              {r.generatedBy && ` by ${r.generatedBy}`}
                            </div>
                          </div>
                          {alreadyAdded ? (
                            <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 shrink-0">
                              Already added
                            </span>
                          ) : (
                            <span className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              isFinal ? 'bg-ink-100 text-ink-500' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {isFinal ? 'Locked' : 'Draft'}
                            </span>
                          )}
                          {selectedId === r.id && !disabled && (
                            <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div
                role="tabpanel"
                id="add-rpt-new-panel"
                aria-labelledby="add-rpt-new-tab"
                className="space-y-3"
              >
                <div>
                  <label htmlFor="new-rpt-name" className="text-[0.75rem] font-medium text-ink-700 mb-1 block">Report Name</label>
                  <input
                    id="new-rpt-name"
                    ref={nameRef}
                    type="text" value={newName}
                    onChange={e => setNewName(e.target.value.slice(0, NAME_MAX))}
                    onBlur={() => {
                      setNameTouched(true);
                      if (hasOuterWhitespace) setNewName(trimmedName);
                    }}
                    placeholder="e.g. FY26 Q1: Duplicate Invoice Findings"
                    aria-invalid={!!nameError}
                    aria-describedby={nameError ? 'new-rpt-name-error' : 'new-rpt-name-hint'}
                    maxLength={NAME_MAX}
                    className={`w-full h-10 px-3 rounded-lg border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 transition-all ${
                      nameError
                        ? 'border-risk/40 focus:ring-risk/20 focus:border-risk'
                        : 'border-canvas-border focus:ring-brand-200 focus:border-brand-300'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <span id={nameError ? 'new-rpt-name-error' : 'new-rpt-name-hint'} className={`text-[0.6875rem] truncate ${
                      nameError ? 'text-risk-700' : nameNotice ? 'text-mitigated-700' : 'text-ink-400'
                    }`}>
                      {nameError ?? nameNotice ?? 'Saved as a draft you can edit later.'}
                    </span>
                    <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{newName.length}/{NAME_MAX}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="new-rpt-desc" className="text-[0.75rem] font-medium text-ink-700 mb-1 block">
                    Description <span className="text-ink-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="new-rpt-desc"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value.slice(0, DESC_MAX))}
                    placeholder="What this report covers..." rows={2}
                    maxLength={DESC_MAX}
                    aria-describedby="new-rpt-desc-counter"
                    className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-white text-[0.8125rem] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 transition-all resize-none"
                  />
                  <div className="flex justify-end mt-1">
                    <span id="new-rpt-desc-counter" className={`text-[0.6875rem] tabular-nums ${
                      newDesc.length >= DESC_SOFT ? 'text-mitigated-700' : 'text-ink-400'
                    }`}>
                      {newDesc.length}/{DESC_MAX}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Granular section picker with previews */
          <div className="space-y-5">
            {!online && <OfflineBanner />}

            {!hasAnyResultItems ? (
              <ModalEmptyState
                icon={<FileText size={20} />}
                title="Nothing to add"
                description="This result has no KPIs, charts, or table columns to attach yet."
                accent="brand"
              />
            ) : (
              <>
                {/* Step 2 header — global all/none + selection count */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.6875rem] text-ink-500" aria-live="polite">
                    {totalSelected === 0
                      ? 'Select at least one item to add.'
                      : `${totalSelected} item${totalSelected === 1 ? '' : 's'} selected`}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setAll(resultData.kpis.map(k => k.label), true, setSelKpis);
                        setAll(resultData.charts.map(c => c.id), true, setSelCharts);
                        setAll(resultData.table.columns, true, setSelCols);
                      }}
                      className="text-[0.6875rem] font-medium text-brand-600 hover:text-brand-700 cursor-pointer min-h-[32px] px-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelKpis(new Set());
                        setSelCharts(new Set());
                        setSelCols(new Set());
                      }}
                      className="text-[0.6875rem] font-medium text-ink-500 hover:text-ink-700 cursor-pointer min-h-[32px] px-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {resultData.kpis.length > 0 && (
                  <div className="space-y-1.5" role="group" aria-label="KPI Cards">
                    <SectionHeader
                      title="KPI Cards" count={selKpis.size} total={resultData.kpis.length}
                      collapsed={!!collapsed.kpis}
                      onToggle={() => setCollapsed(c => ({ ...c, kpis: !c.kpis }))}
                      onToggleAll={(all) => setAll(resultData.kpis.map(k => k.label), all, setSelKpis)}
                      accent={ACCENT}
                    />
                    {!collapsed.kpis && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                        {resultData.kpis.map(kpi => (
                          <KpiPreviewRow
                            key={kpi.label} kpi={kpi}
                            checked={selKpis.has(kpi.label)}
                            onChange={() => toggleIn(selKpis, kpi.label, setSelKpis)}
                            accent={ACCENT}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {resultData.charts.length > 0 && (
                  <div className="space-y-1.5" role="group" aria-label="Charts">
                    <SectionHeader
                      title="Charts" count={selCharts.size} total={resultData.charts.length}
                      collapsed={!!collapsed.charts}
                      onToggle={() => setCollapsed(c => ({ ...c, charts: !c.charts }))}
                      onToggleAll={(all) => setAll(resultData.charts.map(c => c.id), all, setSelCharts)}
                      accent={ACCENT}
                    />
                    {!collapsed.charts && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                        {resultData.charts.map(chart => (
                          <ChartPreviewRow
                            key={chart.id} chart={chart}
                            checked={selCharts.has(chart.id)}
                            onChange={() => toggleIn(selCharts, chart.id, setSelCharts)}
                            accent={ACCENT}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {resultData.table.columns.length > 0 && (
                  <div className="space-y-1.5" role="group" aria-label="Results Table">
                    <SectionHeader
                      title="Results Table" count={selCols.size} total={resultData.table.columns.length}
                      collapsed={!!collapsed.columns}
                      onToggle={() => setCollapsed(c => ({ ...c, columns: !c.columns }))}
                      onToggleAll={(all) => setAll(resultData.table.columns, all, setSelCols)}
                      accent={ACCENT}
                    />
                    {!collapsed.columns && (
                      <div className="pl-1">
                        <TablePreviewRow
                          columns={resultData.table.columns}
                          sampleRows={resultData.table.rows || []}
                          checked={selCols.size > 0}
                          onChange={() => setAll(resultData.table.columns, selCols.size === 0, setSelCols)}
                          accent={ACCENT}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-t border-canvas-border bg-paper-50/50 gap-3">
        {step === 'sections' ? (
          <button
            type="button"
            onClick={() => { setSubmitError(null); setStep('pick'); }}
            disabled={submitting}
            className="text-[0.75rem] font-medium text-ink-500 hover:text-ink-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] px-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Back
          </button>
        ) : <div />}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {submitError && (
            <div className="flex items-center gap-2 min-w-0 max-w-[260px]">
              <ModalSubmitError message={submitError} />
            </div>
          )}
          {submitting ? (
            <button
              type="button"
              onClick={stop}
              className="min-h-[40px] px-3.5 rounded-md text-[0.75rem] font-semibold text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-risk/40"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="min-h-[40px] px-3.5 rounded-md text-[0.75rem] font-semibold text-ink-600 hover:bg-paper-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              Cancel
            </button>
          )}
          {step === 'pick' ? (
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => setStep('sections')}
              className="inline-flex items-center gap-1 min-h-[40px] px-3.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[0.75rem] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1"
            >
              Next <ChevronRight size={13} />
            </button>
          ) : (
            <Gated permission="rp_edit" mode="disable" title="You don't have permission to add to reports">
            <button
              type="button"
              disabled={totalSelected === 0 || submitting}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[0.75rem] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-1"
            >
              {submitting ? <ButtonSpinner /> : <FileText size={13} />}
              {submitError && !submitting ? 'Retry' : submitting ? 'Adding…' : 'Add to Report'}
            </button>
            </Gated>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function messageFrom(e: unknown): string {
  if (e instanceof Error) return e.message || 'Something went wrong.';
  if (typeof e === 'string') return e;
  return 'Something went wrong.';
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-brand-100 text-brand-700 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
