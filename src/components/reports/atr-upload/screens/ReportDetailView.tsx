import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ArrowRight, FileSpreadsheet, Plus, X, CheckCheck,
  FileSearch, Paperclip, FileText, Eye, Link2, RefreshCw, Save,
} from 'lucide-react';
import DataPickerModal, { type AttachmentSelection } from '../../../chat/DataPickerModal';
import Checkbox from '../../../shared/Checkbox';
import Modal from '../../../shared/Modal';
import { Button } from '../../../shared/Button';
import { useToast } from '../../../shared/Toast';
import { useAtrUpload } from '../AtrUploadContext';
import { useAdminSettings } from '../adminStore';
import { WizardFooter } from '../footerSlot';
import ObservationExtractCard from '../components/ObservationExtractCard';
import EditableReportHeader from '../components/EditableReportHeader';
import { setFieldValue, recomputeCompleteness, hasUnresolved, OBSERVATION_FIELDS } from '../observationFields';
import { toAtrReportData } from '../toAtrReportData';
import type { ExtractedObservation, ExtractedFieldKey, ExtractedAnnexure, ReportMeta } from '../types';

type Filter = 'all' | 'issues';

/** The opened-report detail — the single place a report is worked on: an
 *  editable cover-details header, its observations (select + fix fields), and
 *  each observation's annexures linked inline. Replaces the old separate
 *  extraction-summary and annexures steps. */
export default function ReportDetailView({ onBack, onGenerate, onViewAtr, onRegenerate, onSaveDraft }: {
  /** Back to a list of extracted reports — absent in the single-report journey. */
  onBack?: () => void;
  /** Save the report into Reports as a draft ATR without issuing it. */
  onSaveDraft?: () => void;
  /** Generate the ATR for the first time — saves it into Reports (My Reports) and opens it. */
  onGenerate: () => void;
  /** Open the already-generated report, saved in Reports (shown once generated). */
  onViewAtr: () => void;
  /** Regenerate the saved ATR from the observations as edited here. */
  onRegenerate: () => void;
}) {
  const { state, updateSession } = useAtrUpload();
  const { addToast } = useToast();
  const { addLog } = useAdminSettings();
  const session = state.session;

  const [filter, setFilter] = useState<Filter>('all');
  const [picker, setPicker] = useState<string | null>(null); // observation id the Add-data picker is open for
  const [viewId, setViewId] = useState<string | null>(null);  // annexure open in the view modal

  if (!session) return null;
  const { observations, annexures } = session;

  // Report + field/observation labels used in the transaction log.
  const reportLabel = session.meta.reportName?.trim() || session.meta.auditTitle?.trim() || session.file?.filename || 'Report';
  const fieldLabel = (key: ExtractedFieldKey) => OBSERVATION_FIELDS.find(f => f.key === key)?.label ?? key;
  const obsLabel = (obsId: string) => { const o = observations.find(x => x.id === obsId); return o ? (o.title?.trim() || `Observation #${o.number}`) : 'an observation'; };

  // ── Meta ──
  const patchMeta = (patch: Partial<ReportMeta>) => {
    updateSession(s => ({ ...s, meta: { ...s.meta, ...patch } }));
    addLog({ action: 'Edit', target: reportLabel, detail: 'Edited report details' });
  };

  // ── Observation mutators (funnel through updateSession → persists) ──
  const updateObs = (obsId: string, fn: (o: ExtractedObservation) => ExtractedObservation) =>
    updateSession(s => ({ ...s, observations: s.observations.map(o => (o.id === obsId ? fn(o) : o)) }));
  const toggleSelect = (obsId: string) => updateObs(obsId, o => ({ ...o, selected: !o.selected }));
  const setAll = (value: boolean) => updateSession(s => ({ ...s, observations: s.observations.map(o => ({ ...o, selected: value })) }));
  const editField = (obsId: string, key: ExtractedFieldKey, value: string) => {
    updateObs(obsId, o => setFieldValue(o, key, value));
    addLog({ action: 'Edit', target: reportLabel, detail: `Updated "${fieldLabel(key)}" on ${obsLabel(obsId)}` });
  };
  const resolve = (obsId: string, key: ExtractedFieldKey, mode: 'fill' | 'skip' | 'reset', value?: string) => {
    if (mode === 'fill') addLog({ action: 'Resolve', target: reportLabel, detail: `Filled "${fieldLabel(key)}" on ${obsLabel(obsId)}` });
    else if (mode === 'skip') addLog({ action: 'Skip', target: reportLabel, detail: `Skipped "${fieldLabel(key)}" on ${obsLabel(obsId)}` });
    return updateObs(obsId, o => {
      let next = o;
      if (mode === 'fill' && value !== undefined) next = setFieldValue(next, key, value);
      const tracked = next.missingFields.some(f => f.key === key);
      let missingFields = next.missingFields.map(f =>
        f.key !== key ? f
        : mode === 'fill' ? { ...f, state: 'filled-by-user' as const, value }
        : mode === 'skip' ? { ...f, state: 'skipped' as const }
        : { ...f, state: 'missing' as const, value: undefined },
      );
      // Skipping/filling a field that wasn't pre-flagged (any empty field can now
      // be resolved) records its state so the decision sticks.
      if (!tracked && mode !== 'reset') {
        const label = OBSERVATION_FIELDS.find(f => f.key === key)?.label ?? key;
        missingFields = [...missingFields, {
          key, label,
          state: mode === 'fill' ? 'filled-by-user' as const : 'skipped' as const,
          value: mode === 'fill' ? value : undefined,
        }];
      }
      next = { ...next, missingFields };
      return { ...next, completeness: recomputeCompleteness(next) };
    });
  };

  // ── Annexure linking ──
  const annexFor = (obsId: string) => annexures.filter(a => a.observationId === obsId);
  const rowsFor = (obsId: string) => annexFor(obsId).reduce((n, a) => n + a.rows.length, 0);
  const orphanAnnex = annexures.filter(a => !a.observationId);

  const linkAnnex = (axId: string, obsId: string) => {
    const ax = annexures.find(a => a.id === axId);
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => (a.id === axId ? { ...a, observationId: obsId, status: 'Confirmed' } : a)) }));
    addLog({ action: 'Link', target: reportLabel, detail: `Linked "${ax?.filename ?? 'annexure'}" to ${obsLabel(obsId)}` });
  };
  const unlinkAnnex = (axId: string) => {
    const ax = annexures.find(a => a.id === axId);
    updateSession(s => ({ ...s, annexures: s.annexures.map(a => (a.id === axId ? { ...a, observationId: null, status: 'Unlinked' } : a)) }));
    addLog({ action: 'Unlink', target: reportLabel, detail: `Unlinked "${ax?.filename ?? 'annexure'}"` });
  };
  const uploadAnnexLinked = (filename: string, obsId: string, opts?: { quiet?: boolean }) => {
    const id = `ax-upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAnnex: ExtractedAnnexure = {
      id, filename, observationId: obsId, status: 'Confirmed',
      columns: ['Reference', 'Detail', 'Amount ₹'],
      rows: [{ id: `${id}-r1`, annexureId: id, data: { 'Reference': '—', 'Detail': 'Uploaded annexure', 'Amount ₹': '—' } }],
    };
    updateSession(s => ({ ...s, annexures: [...s.annexures, newAnnex] }));
    if (!opts?.quiet) addToast({ type: 'success', message: `"${filename}" linked to this observation.` });
    addLog({ action: 'Link', target: reportLabel, detail: `Uploaded & linked "${filename}" to ${obsLabel(obsId)}` });
  };
  // Add-data picker → every chosen file / data source becomes an annexure linked
  // to the observation the picker was opened for.
  const linkSelections = (obsId: string, selections: AttachmentSelection[]) => {
    const many = selections.length > 1;
    selections.forEach(sel => {
      const name = sel.kind === 'connect-db' ? `${sel.name} (${sel.database})` : sel.name;
      uploadAnnexLinked(name, obsId, { quiet: many });
    });
    if (many) addToast({ type: 'success', message: `${selections.length} annexures linked to ${obsLabel(obsId)}.` });
    setPicker(null);
  };

  // ── Derived ──
  const obsWithIssues = observations.filter(hasUnresolved);
  const selected = observations.filter(o => o.selected);
  const linkedRowsTotal = annexures.filter(a => a.observationId).reduce((n, a) => n + a.rows.length, 0);
  const visible = observations.filter(o => (filter === 'all' ? true : hasUnresolved(o)));
  const viewing = annexures.find(a => a.id === viewId) ?? null;
  const generated = !!session.generatedAt;
  // Edits made here since the ATR was generated — the saved report only picks
  // them up on Regenerate.
  const staleAtr = generated && !!session.atrDraft && JSON.stringify(toAtrReportData(session)) !== JSON.stringify(session.atrDraft);
  const draftSaved = !generated && !!session.draftSavedAt;
  const draftStale = draftSaved && !!session.atrDraft && JSON.stringify(toAtrReportData(session)) !== JSON.stringify(session.atrDraft);

  const footerNote = selected.length === 0
    ? 'Nothing selected — pick observations, or generate an empty ATR.'
    : `${selected.length} of ${observations.length} selected${linkedRowsTotal ? ` · ${linkedRowsTotal} linked exception row${linkedRowsTotal === 1 ? '' : 's'}` : ''}.`;

  // ── The inline annexure strip for one observation (chips + link picker). ──
  const annexureStrip = (o: ExtractedObservation) => {
    const linked = annexFor(o.id);
    return (
      <div className="relative flex items-center gap-2 flex-wrap px-5 py-2.5 border-t border-canvas-border bg-canvas/40">
        <span className="inline-flex items-center gap-1.5 text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-400 mr-0.5">
          <Paperclip size={12} aria-hidden="true" /> Annexures
        </span>
        {linked.map(a => (
          <span key={a.id} className="inline-flex items-center gap-1 h-6 pl-1.5 pr-0.5 rounded-sm bg-canvas-elevated border border-canvas-border text-[0.71875rem] text-ink-700 max-w-full">
            <FileSpreadsheet size={11} className="text-compliant-700 shrink-0" aria-hidden="true" />
            <button onClick={() => setViewId(a.id)} title={`View ${a.filename}`} className="truncate max-w-[190px] hover:text-brand-700 hover:underline underline-offset-2 cursor-pointer">{a.filename}</button>
            <span className="text-ink-300 tabular-nums text-[0.625rem]">{a.rows.length}</span>
            <button onClick={() => unlinkAnnex(a.id)} className="w-4 h-4 rounded-full hover:bg-risk-50 text-ink-400 hover:text-risk-700 flex items-center justify-center cursor-pointer shrink-0" aria-label={`Unlink ${a.filename}`}><X size={10} aria-hidden="true" /></button>
          </span>
        ))}
        <button onClick={() => setPicker(o.id)} className="inline-flex items-center gap-1 h-6 px-1.5 rounded-sm text-[0.71875rem] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors">
          <Plus size={12} aria-hidden="true" /> Link annexure
        </button>
        {/* Annexures extracted with the report but not yet linked anywhere —
            one click attaches them here without opening the picker. */}
        {orphanAnnex.map(a => (
          <button key={a.id} onClick={() => linkAnnex(a.id, o.id)} title={`Link ${a.filename} (${a.rows.length} exception row${a.rows.length === 1 ? '' : 's'}) to this observation`} className="inline-flex items-center gap-1 h-6 pl-1.5 pr-2 rounded-sm border border-dashed border-brand-300 text-[0.71875rem] text-brand-700 hover:bg-brand-50 cursor-pointer transition-colors max-w-full">
            <Link2 size={11} aria-hidden="true" /> <span className="truncate max-w-[190px]">{a.filename}</span>
          </button>
        ))}
        {linked.length === 0 && orphanAnnex.length === 0 && <span className="text-[0.71875rem] text-ink-400">None linked yet</span>}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {/* Back to the extracted-reports list (legacy hosts only) */}
        {onBack && (
          <button onClick={onBack} className="inline-flex items-center gap-1.5 h-7 -ml-1.5 mb-3 pl-1.5 pr-2.5 rounded-md text-[0.75rem] font-medium text-ink-500 hover:text-ink-900 hover:bg-draft-50 cursor-pointer transition-colors">
            <ArrowLeft size={14} aria-hidden="true" /> Observations Extracted
          </button>
        )}

        {/* Editable report details header */}
        <EditableReportHeader meta={session.meta} onChange={patchMeta} />

        {/* Observations */}
        {observations.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-canvas-border p-12 text-center">
            <FileSearch size={26} className="text-ink-300 mx-auto mb-3" aria-hidden="true" />
            <h3 className="text-[0.9375rem] font-semibold text-ink-800 mb-1">No observations found</h3>
            <p className="text-[0.8125rem] text-ink-500 max-w-[420px] mx-auto">We couldn't extract any observations from this report. You can still edit the details above, or go back and upload a clearer report.</p>
          </div>
        ) : (
          <div className="mt-6">
            {/* Controls — select-all + a light filter, kept to one quiet row. */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="inline-flex items-center gap-2.5 cursor-pointer text-[0.78125rem] font-semibold text-ink-800">
                <Checkbox
                  checked={selected.length === observations.length && observations.length > 0}
                  onChange={() => setAll(selected.length !== observations.length)}
                  ariaLabel="Select all observations"
                />
                Select all
                <span className="font-normal text-ink-400 tabular-nums">· {selected.length} of {observations.length} selected</span>
              </label>
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-canvas-border bg-canvas-elevated">
                {([{ key: 'all', label: 'All', n: observations.length }, { key: 'issues', label: 'Needs review', n: obsWithIssues.length }] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[0.71875rem] font-semibold cursor-pointer transition-colors ${filter === f.key ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-800'}`}
                  >
                    {f.label}<span className={`tabular-nums ${filter === f.key ? 'text-brand-500' : 'text-ink-400'}`}>{f.n}</span>
                  </button>
                ))}
              </div>
            </div>

            {visible.length > 0 ? (
              <div className="space-y-2.5">
                {visible.map(o => (
                  <ObservationExtractCard
                    key={o.id}
                    obs={o}
                    linkedAnnexures={annexFor(o.id).length}
                    linkedRows={rowsFor(o.id)}
                    onToggleSelect={() => toggleSelect(o.id)}
                    onEditField={(key, value) => editField(o.id, key, value)}
                    onResolve={(key, mode, value) => resolve(o.id, key, mode, value)}
                    annexureSlot={annexureStrip(o)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-canvas-border p-8 text-center text-[0.8125rem] text-ink-500">
                Nothing needs review — every observation is complete.
              </div>
            )}

            {orphanAnnex.length > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas/40 px-4 py-2.5 text-[0.75rem] text-ink-600">
                <FileSpreadsheet size={14} className="text-ink-400 shrink-0" aria-hidden="true" />
                <span><span className="font-semibold text-ink-800 tabular-nums">{orphanAnnex.length}</span> unlinked annexure{orphanAnnex.length === 1 ? '' : 's'} — use <span className="font-medium text-brand-700">Link annexure</span> on an observation to attach {orphanAnnex.length === 1 ? 'it' : 'them'}.</span>
                <Button variant="outline" size="sm" shape="md" leftIcon={<CheckCheck size={13} />} className="ml-auto" onClick={() => { const first = observations[0]; if (first) { orphanAnnex.forEach(a => linkAnnex(a.id, first.id)); addToast({ type: 'success', message: `Linked ${orphanAnnex.length} annexure${orphanAnnex.length === 1 ? '' : 's'} to “${observations[0].title?.trim() || `Observation #${observations[0].number}`}”.` }); } }}>
                  Link all to #{observations[0]?.number}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — generate the ATR (first time); afterwards view it, or
          regenerate it from the observations as edited here. */}
      <WizardFooter>
        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <p className="text-[0.75rem] text-ink-500">
            {generated
              ? staleAtr
                ? <span className="text-high-700 font-medium">Observations edited since the ATR was generated — regenerate to update the saved report.</span>
                : <span className="text-compliant-700 font-medium">Action Taken Report generated · saved in Reports and up to date with these observations.</span>
              : draftSaved
                ? draftStale
                  ? <span className="text-high-700 font-medium">Draft saved in Reports · edited since — save again to update it, or generate the ATR.</span>
                  : <span className="text-ink-600"><span className="text-compliant-700 font-medium">Draft saved in Reports.</span> Generate the ATR when the observations are ready.</span>
                : footerNote}
          </p>
          {generated ? (
            <div className="flex items-center gap-2">
              <Button variant={staleAtr ? 'outline' : 'primary'} size="md" leftIcon={<Eye size={15} />} onClick={onViewAtr}>
                View report
              </Button>
              <Button variant={staleAtr ? 'primary' : 'outline'} size="md" leftIcon={<RefreshCw size={15} />} onClick={onRegenerate} title="Rebuild the saved ATR from these observations — case links and status are kept">
                Regenerate ATR
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onSaveDraft && (
                <Button variant="outline" size="md" leftIcon={<Save size={15} />} onClick={onSaveDraft} title="Keep this report in Reports as a draft — nothing is issued yet">
                  {draftSaved ? 'Update draft' : 'Save as Draft'}
                </Button>
              )}
              <Button variant="primary" size="md" leftIcon={<FileText size={15} />} rightIcon={<ArrowRight size={15} />} onClick={onGenerate}>
                Generate ATR
              </Button>
            </div>
          )}
        </div>
      </WizardFooter>

      {/* View annexure (read-only table) */}
      <AnimatePresence>
        {viewing && (
          <Modal
            title={viewing.filename}
            subtitle={`${viewing.rows.length} exception row${viewing.rows.length === 1 ? '' : 's'}`}
            width="max-w-[760px]"
            onClose={() => setViewId(null)}
            footer={<Button variant="outline" onClick={() => setViewId(null)}>Close</Button>}
          >
            <div className="overflow-x-auto rounded-md border border-canvas-border">
              <table className="w-full">
                <thead>
                  <tr className="bg-canvas">
                    {viewing.columns.map(c => (
                      <th key={c} className="px-3 py-2 text-left text-[0.65625rem] font-semibold uppercase tracking-wide text-ink-500 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewing.rows.map(r => (
                    <tr key={r.id} className="border-t border-canvas-border">
                      {viewing.columns.map(c => (
                        <td key={c} className="px-3 py-2 text-[0.75rem] text-ink-700 whitespace-nowrap tabular-nums">{r.data[c] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Link annexure → the platform's Add-data picker (upload files / a folder,
          or pick from All Data · Files · DB). Portalled to the body inside a
          z-[80] stacking context so it sits above the Create Report modal
          (z-60), which would otherwise trap and clip its fixed layers. */}
      {createPortal(
        <div className="relative z-[80]">
          <DataPickerModal
            open={!!picker}
            onClose={() => setPicker(null)}
            onConfirm={sel => { if (picker) linkSelections(picker, sel); }}
            title="Link annexure"
            confirmLabel="Link"
            defaultTab="upload"
            attachHint={picker ? <>Pick the annexure workbook(s) to link to <span className="font-medium text-ink-700">{obsLabel(picker)}</span>.</> : undefined}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
