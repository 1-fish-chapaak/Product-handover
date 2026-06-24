import { useState, type ReactNode } from 'react';
import { ArrowRight, Upload, FileText, X } from 'lucide-react';
import { Button } from '../../../shared/Button';
import UploadDataModal from '../../../concierge-workflow-builder/UploadDataModal';
import DatePicker from '../../../shared/DatePicker';
import { WizardFooter } from '../footerSlot';
import type { ReportMeta } from '../types';

const INPUT_CLS = 'w-full h-9 px-3 bg-canvas-elevated border border-canvas-border rounded-[8px] text-[13px] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

// ISO "yyyy-mm-dd" → "DD Mon YYYY".
const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Field({ label, required, hint, children, className = '' }: { label: string; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[12px] font-semibold text-ink-700 mb-1">
        {label}{required && <span className="text-risk-700"> *</span>}
        {hint && <span className="font-normal text-ink-400"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** Screen 2B — upload an existing audit report (+ optional annexures) and fill
 *  the mandatory report details that flow into the ATR's top section. */
export default function Step2bReportUpload({ onExtract }: {
  onExtract: (report: File, annexures: File[], meta: Partial<ReportMeta>) => void;
}) {
  const [report, setReport] = useState<File[]>([]);
  const [annexures, setAnnexures] = useState<File[]>([]);
  // Which slot the shared "Add data" upload modal is filling (null = closed).
  const [uploadTarget, setUploadTarget] = useState<'report' | 'annexures' | null>(null);

  // Mandatory report details → ATR top section. Generated On is auto (today).
  const [auditTitle, setAuditTitle] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [generatedOn] = useState(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

  const detailsComplete = !!(auditTitle.trim() && auditEntity.trim() && periodStart && periodEnd && preparedBy.trim());
  const ready = report.length > 0 && detailsComplete;

  const submit = () => {
    if (!report[0] || !detailsComplete) return;
    onExtract(report[0], annexures, {
      auditTitle: auditTitle.trim(),
      auditEntity: auditEntity.trim(),
      auditPeriod: `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`,
      preparedBy: preparedBy.trim(),
      generatedOn,
    });
  };

  return (
    <div className="w-full max-w-[860px] mx-auto">
      <h2 className="text-[1.0625rem] font-semibold text-ink-900 mb-0.5 text-center">Upload your audit report</h2>
      <p className="text-[0.8125rem] text-ink-500 mb-3 leading-snug text-center">
        The audit report generates the ATR; annexures (optional) power the linked cases in Manage Exceptions. Nothing is re-audited here.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 items-start mb-3">
        {/* Audit report — opens the shared "Add data" upload modal. */}
        <div>
          <label className="block text-xs font-semibold text-ink-800 mb-1.5">Upload Audit Report</label>
          {report.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {report.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-[8px] border border-canvas-border bg-canvas-elevated px-3 py-2">
                  <FileText size={15} className="text-brand-600 shrink-0" aria-hidden="true" />
                  <span className="text-[12.5px] font-medium text-ink-800 truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setReport(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`} className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={13} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="md" leftIcon={<Upload size={15} />} onClick={() => setUploadTarget('report')} className="w-full">
            {report.length > 0 ? 'Add more report files' : 'Upload audit report'}
          </Button>
        </div>

        {/* Annexures (optional) */}
        <div>
          <label className="block text-xs font-semibold text-ink-800 mb-1.5">Upload Annexures <span className="text-ink-400 font-normal">(optional)</span></label>
          {annexures.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {annexures.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2.5 rounded-[8px] border border-canvas-border bg-canvas-elevated px-3 py-2">
                  <FileText size={15} className="text-brand-600 shrink-0" aria-hidden="true" />
                  <span className="text-[12.5px] font-medium text-ink-800 truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setAnnexures(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`} className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={13} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="md" leftIcon={<Upload size={15} />} onClick={() => setUploadTarget('annexures')} className="w-full">
            {annexures.length > 0 ? 'Add more annexures' : 'Upload annexures'}
          </Button>
        </div>
      </div>

      {/* Mandatory report details — these populate the ATR's top section. */}
      <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4 text-left">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <h3 className="text-[13px] font-semibold text-ink-900">Report details</h3>
          <p className="text-[11.5px] text-ink-400">Appear atop the ATR · all required</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
          <Field label="Audit Title" required>
            <input value={auditTitle} onChange={e => setAuditTitle(e.target.value)} placeholder="e.g. Procurement, Inventory & Dispatch Process" className={INPUT_CLS} />
          </Field>
          <Field label="Audit Entity" required>
            <input value={auditEntity} onChange={e => setAuditEntity(e.target.value)} placeholder="e.g. ABC Manufacturing Ltd" className={INPUT_CLS} />
          </Field>

          <Field label="Audit Period" required hint="date range" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <DatePicker value={periodStart} onChange={e => setPeriodStart(e.target.value)} max={periodEnd || undefined} placeholder="Start date" className={INPUT_CLS} aria-label="Audit period start date" />
              <span className="text-ink-400 shrink-0">–</span>
              <DatePicker value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} min={periodStart || undefined} placeholder="End date" className={INPUT_CLS} aria-label="Audit period end date" />
            </div>
          </Field>

          <Field label="Prepared By" required>
            <input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="e.g. Internal Audit Team" className={INPUT_CLS} />
          </Field>
          <Field label="Generated On" hint="auto">
            <input value={generatedOn} readOnly aria-readonly className={`${INPUT_CLS} bg-canvas text-ink-600 cursor-default focus:ring-0 focus:border-canvas-border`} />
          </Field>
        </div>
      </div>

      <WizardFooter>
        <div className="flex items-center justify-between gap-4 border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <p className="text-[12px] text-ink-500">
            {ready
              ? <span className="text-compliant-700 font-medium">Ready to extract.</span>
              : report.length === 0 ? 'Upload an audit report to continue.' : 'Fill every required detail to continue.'}
          </p>
          <Button
            variant="primary"
            rightIcon={<ArrowRight size={15} />}
            disabled={!ready}
            onClick={submit}
            title={ready ? undefined : 'Upload a report and complete every required detail to continue.'}
          >
            Extract from report
          </Button>
        </div>
      </WizardFooter>

      {/* Shared "Add data" upload modal — fills whichever slot opened it. */}
      <UploadDataModal
        open={uploadTarget !== null}
        onClose={() => setUploadTarget(null)}
        title={uploadTarget === 'annexures' ? 'Upload annexures' : 'Upload audit report'}
        allowedTabs={['upload', 'all', 'files', 'folder']}
        hideSessionFiles
        footerHint={uploadTarget === 'annexures'
          ? 'Add annexure workbooks (.xlsx) — optional; they power the linked cases in Manage Exceptions.'
          : 'Upload the audit report file(s) — this generates the ATR.'}
        onAttachDraft={({ files }) => {
          const real = files.map(x => x.file).filter((f): f is File => !!f);
          if (real.length === 0) return;
          if (uploadTarget === 'report') setReport(prev => [...prev, ...real]);
          else if (uploadTarget === 'annexures') setAnnexures(prev => [...prev, ...real]);
        }}
      />
    </div>
  );
}
