import { useState, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Upload, FileText, FileSpreadsheet, X, Plus } from 'lucide-react';
import { Button } from '../../../shared/Button';
import DatePicker from '../../../shared/DatePicker';
import { WizardFooter } from '../footerSlot';
import EscalationMatrixCard from '../components/EscalationMatrixCard';
import { type EscalationMatrixConfig, cloneDefaultMatrix } from '../escalationMatrix';
import type { ReportMeta } from '../types';

// Match Step 2a's entrance + tokens so the two upload screens read as one family.
const EASE = [0.22, 1, 0.36, 1] as const;
const INPUT_CLS = 'w-full h-9 px-3 bg-canvas-elevated border border-canvas-border rounded-md text-[0.8125rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

// ISO "yyyy-mm-dd" → "DD Mon YYYY".
const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Field({ label, required, hint, children, className = '' }: { label: string; required?: boolean; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[0.75rem] font-semibold text-ink-700 mb-1.5">
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
    <div className="flex items-center gap-2.5 rounded-md border border-canvas-border bg-canvas px-2.5 py-1.5">
      <span className="w-6 h-6 rounded-sm bg-compliant-50 text-compliant-700 flex items-center justify-center shrink-0"><FileText size={13} aria-hidden="true" /></span>
      <span className="text-[0.75rem] font-medium text-ink-800 truncate flex-1">{name}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="w-5 h-5 inline-flex items-center justify-center rounded-full text-ink-400 hover:text-risk-700 hover:bg-risk-50 transition-colors cursor-pointer shrink-0"><X size={12} aria-hidden="true" /></button>
    </div>
  );
}

// Compact upload slot in the platform's card style (icon chip + title + blurb,
// action button at the bottom) — kept short so the screen never scrolls.
function UploadCard({ icon: Icon, tint, title, blurb, cta, badge, badgeCls, files, onAdd, onRemove, recommended, delay, single }: {
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
  /** Single-file slot — only one file allowed; the button replaces instead of adding. */
  single?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className={`relative flex flex-col rounded-lg border bg-canvas-elevated p-4 transition-colors ${files.length > 0 ? 'border-compliant/40' : 'border-canvas-border hover:border-brand-300'}`}
    >
      <span className={`absolute top-3.5 right-3.5 inline-flex items-center rounded-full text-[0.625rem] font-semibold uppercase tracking-wide px-2 py-0.5 ${badgeCls}`}>{badge}</span>
      <div className="flex items-center gap-3 mb-3 pr-20">
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tint}`}><Icon size={19} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-tight">{title}</h3>
          <p className="text-[0.71875rem] text-ink-400 mt-0.5 truncate">{blurb}</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[0.6875rem] font-semibold text-ink-500 tabular-nums">{files.length} file{files.length === 1 ? '' : 's'} added</div>
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
        {files.length > 0 ? (single ? 'Replace file' : 'Add more files') : cta}
      </Button>
    </motion.div>
  );
}

/** Screen 2B — upload an existing audit report (+ optional annexures) and fill
 *  the mandatory report details that flow into the ATR's top section. Single
 *  compact column (no scroll), sharing Screen 2A's card + CTA language. */
export default function Step2bReportUpload({ onExtract }: {
  onExtract: (report: File, annexures: File[], meta: Partial<ReportMeta>, escalation: EscalationMatrixConfig) => void;
}) {
  const [report, setReport] = useState<File[]>([]);
  const [annexures, setAnnexures] = useState<File[]>([]);
  // Native OS file pickers — clicking an upload button opens the system dialog
  // directly (no intermediate upload modal).
  const reportInputRef = useRef<HTMLInputElement>(null);
  const annexInputRef = useRef<HTMLInputElement>(null);

  // Mandatory report details → ATR top section. Generated On is auto (today).
  const [auditTitle, setAuditTitle] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [generatedOn] = useState(() => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

  // Escalation matrix for this report — seeded from the standard preset, fully
  // editable via the card's Configure modal, and passed into the session so it
  // governs every open exception's mailer cadence downstream.
  const [escalation, setEscalation] = useState<EscalationMatrixConfig>(cloneDefaultMatrix);

  const detailsComplete = !!(auditTitle.trim() && auditEntity.trim() && periodStart && periodEnd && preparedBy.trim());
  const ready = report.length > 0 && detailsComplete;

  // Everything still standing between here and Extract, named. The footer used
  // to mention the file alone, so someone who had uploaded one was told to
  // "fill every required detail" without being told which.
  const outstanding: string[] = [
    report.length === 0 ? 'the audit report' : null,
    !auditTitle.trim() ? 'Audit Title' : null,
    !auditEntity.trim() ? 'Audit Entity' : null,
    !(periodStart && periodEnd) ? 'Audit Period' : null,
    !preparedBy.trim() ? 'Prepared By' : null,
  ].filter((x): x is string => x !== null);
  const outstandingLine = outstanding.length === 1
    ? `Add ${outstanding[0]} to continue.`
    : `Still needed: ${outstanding.slice(0, -1).join(', ')} and ${outstanding[outstanding.length - 1]}.`;

  const submit = () => {
    if (!report[0] || !detailsComplete) return;
    onExtract(report[0], annexures, {
      auditTitle: auditTitle.trim(),
      auditEntity: auditEntity.trim(),
      auditPeriod: `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`,
      preparedBy: preparedBy.trim(),
      generatedOn,
    }, escalation);
  };

  return (
    <div className="w-full">
      {/* Upload targets — two cards in the platform's format-card style.
          items-start so the empty card keeps its natural (short) height instead
          of stretching to match a file-filled sibling. */}
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <UploadCard
          icon={FileText}
          tint="bg-brand-50 text-brand-700"
          title="Audit report"
          blurb="PDF, Word, Excel or CSV · max 25 MB"
          cta="Upload audit report"
          badge="Required"
          badgeCls="bg-risk-50 text-risk-700"
          files={report}
          onAdd={() => reportInputRef.current?.click()}
          onRemove={i => setReport(prev => prev.filter((_, idx) => idx !== i))}
          recommended
          single
          delay={0.04}
        />
        <UploadCard
          icon={FileSpreadsheet}
          tint="bg-evidence-50 text-evidence-700"
          title="Annexures"
          blurb="Excel or CSV · power Manage Exceptions"
          cta="Upload annexures"
          badge="Optional"
          badgeCls="bg-paper-100 text-ink-500"
          files={annexures}
          onAdd={() => annexInputRef.current?.click()}
          onRemove={i => setAnnexures(prev => prev.filter((_, idx) => idx !== i))}
          delay={0.08}
        />
      </div>

      {/* Report details — confirmed after the upload. Step 1 promises the
          report is read automatically, so the file comes first and these fields
          confirm the cover rather than gating the upload behind five inputs. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}
        className="text-left mt-4"
      >
        <div className="mb-3.5">
          <h3 className="text-[0.8125rem] font-semibold text-ink-900">Report details</h3>
          <p className="text-[0.75rem] text-ink-500 mt-0.5">These print on the ATR cover. We cannot read them off the file reliably, so confirm them here.</p>
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

      {/* Escalation matrix — the report's follow-up cadence, set up here at the
          initial state alongside the required details. Preset + fully editable. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: 0.24 }}
        className="mt-4"
      >
        <EscalationMatrixCard config={escalation} onChange={setEscalation} />
      </motion.div>

      <WizardFooter>
        <div className="flex items-center justify-between gap-4 border-t border-canvas-border bg-canvas-elevated px-6 py-3">
          <p className="text-[0.75rem] text-ink-500">
            {ready
              ? <span className="text-compliant-700 font-medium">Ready to extract.</span>
              : outstandingLine}
          </p>
          <Button
            variant="primary"
            rightIcon={<ArrowRight size={15} />}
            disabled={!ready}
            onClick={submit}
            title={ready ? undefined : outstandingLine}
          >
            Extract from report
          </Button>
        </div>
      </WizardFooter>

      {/* Native OS file pickers — opened directly by the upload buttons above. */}
      {/* Single report only — one report converts to one ATR. */}
      <input
        ref={reportInputRef}
        type="file"
        hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) setReport([f]); e.currentTarget.value = ''; }}
      />
      <input
        ref={annexInputRef}
        type="file"
        multiple
        hidden
        accept=".xlsx,.xls,.csv"
        onChange={e => { setAnnexures(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.currentTarget.value = ''; }}
      />
    </div>
  );
}
