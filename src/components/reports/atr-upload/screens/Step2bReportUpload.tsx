import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Upload, FileText, FileSpreadsheet, X, Plus } from 'lucide-react';
import { Button } from '../../../shared/Button';
import UploadDataModal from '../../../concierge-workflow-builder/UploadDataModal';
import DatePicker from '../../../shared/DatePicker';
import { WizardFooter } from '../footerSlot';
import type { ReportMeta } from '../types';

// Match Step 2a's entrance + tokens so the two upload screens read as one family.
const EASE = [0.22, 1, 0.36, 1] as const;
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
      <label className="block text-[12px] font-semibold text-ink-700 mb-1.5">
        {label}{required && <span className="text-risk-700"> *</span>}
        {hint && <span className="font-normal text-ink-400"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// One uploaded file, as a compact removable row.
function FileChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-canvas-border bg-canvas px-2.5 py-1.5">
      <span className="w-6 h-6 rounded-[6px] bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><FileText size={13} aria-hidden="true" /></span>
      <span className="text-[12px] font-medium text-ink-800 truncate flex-1">{name}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={12} aria-hidden="true" /></button>
    </div>
  );
}

// Compact upload slot in the platform's card style (icon chip + title + blurb,
// action button at the bottom) — kept short so the screen never scrolls.
function UploadCard({ icon: Icon, tint, title, blurb, cta, badge, badgeCls, files, onAdd, onRemove, recommended, delay }: {
  icon: typeof FileText;
  tint: string;
  title: string;
  blurb: string;
  cta: string;
  badge: string;
  badgeCls: string;
  files: File[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  recommended?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className={`relative flex flex-col rounded-[14px] border bg-canvas-elevated p-4 transition-colors ${files.length > 0 ? 'border-compliant/40' : 'border-canvas-border hover:border-brand-300'}`}
    >
      <span className={`absolute top-3.5 right-3.5 inline-flex items-center rounded-full text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 ${badgeCls}`}>{badge}</span>
      <div className="flex items-center gap-3 mb-3 pr-20">
        <span className={`w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0 ${tint}`}><Icon size={19} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink-900 leading-tight">{title}</h3>
          <p className="text-[11.5px] text-ink-400 mt-0.5 truncate">{blurb}</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold text-ink-500 tabular-nums">{files.length} file{files.length === 1 ? '' : 's'} added</div>
          {/* Capped + internally scrollable so adding many files never grows the
              card unbounded (which broke the layout + forced a page scroll). */}
          <ul className="space-y-1.5 max-h-[92px] overflow-y-auto pr-1 -mr-1">
            {files.map((f, i) => <li key={`${f.name}-${i}`}><FileChip name={f.name} onRemove={() => onRemove(i)} /></li>)}
          </ul>
        </div>
      )}

      <Button
        variant={files.length > 0 || !recommended ? 'outline' : 'primary'}
        size="md"
        leftIcon={files.length > 0 ? <Plus size={15} /> : <Upload size={15} />}
        onClick={onAdd}
        className="w-full mt-auto"
      >
        {files.length > 0 ? 'Add more files' : cta}
      </Button>
    </motion.div>
  );
}

/** Screen 2B — upload an existing audit report (+ optional annexures) and fill
 *  the mandatory report details that flow into the ATR's top section. Single
 *  compact column (no scroll), sharing Screen 2A's card + CTA language. */
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
    <div className="w-full">
      {/* Report details first — fill these, then upload the file(s) below */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.04 }}
        className="text-left"
      >
        <div className="mb-3.5">
          <h3 className="text-[13px] font-semibold text-ink-900">Report details</h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
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
      </motion.div>

      {/* Upload targets — two cards in the platform's format-card style.
          items-start so the empty card keeps its natural (short) height instead
          of stretching to match a file-filled sibling. */}
      <div className="grid sm:grid-cols-2 gap-4 items-start mt-4">
        <UploadCard
          icon={FileText}
          tint="bg-brand-50 text-brand-700"
          title="Audit report"
          blurb="PDF, Word, Excel or CSV · max 25 MB"
          cta="Upload audit report"
          badge="Required"
          badgeCls="bg-risk-50 text-risk-700"
          files={report}
          onAdd={() => setUploadTarget('report')}
          onRemove={i => setReport(prev => prev.filter((_, idx) => idx !== i))}
          recommended
          delay={0.16}
        />
        <UploadCard
          icon={FileSpreadsheet}
          tint="bg-evidence-50 text-evidence-700"
          title="Annexures"
          blurb=".xlsx workbooks · power Manage Exceptions"
          cta="Upload annexures"
          badge="Optional"
          badgeCls="bg-paper-100 text-ink-500"
          files={annexures}
          onAdd={() => setUploadTarget('annexures')}
          onRemove={i => setAnnexures(prev => prev.filter((_, idx) => idx !== i))}
          delay={0.2}
        />
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
