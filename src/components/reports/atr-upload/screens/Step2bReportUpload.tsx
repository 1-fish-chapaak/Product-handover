import { useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../../shared/Button';
import FileDropZone from '../components/FileDropZone';
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
        <FileDropZone
          label="Upload Audit Report"
          acceptExt={['pdf', 'docx', 'xlsx', 'pptx']}
          hint="for the ATR"
          maxSizeMb={20}
          variant="secondary"
          files={report}
          onFiles={setReport}
          onRemove={() => setReport([])}
        />

        <FileDropZone
          label="Upload Annexures (optional)"
          acceptExt={['xlsx']}
          hint="for case management"
          multiple
          variant="secondary"
          files={annexures}
          onFiles={setAnnexures}
          onRemove={i => setAnnexures(prev => prev.filter((_, idx) => idx !== i))}
        />
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
    </div>
  );
}
