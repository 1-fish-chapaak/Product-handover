import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Stethoscope, HeartPulse, ShieldAlert, ShieldCheck, ShieldX, Clock, FileText,
  ChevronDown, ChevronRight, AlertTriangle, Download, Activity,
  FlaskConical, Layers, Fingerprint, FileSearch,
} from 'lucide-react';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob } from '../types';
import { useAuditLog } from '../../../../context/AdminDataContext';

// ─── Result shape ────────────────────────────────────────────────────────────

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface TestRow {
  name: string;
  value: string;
  reference: string;
  flag: boolean;
  flagReason?: string;
}

interface ReportEntry {
  name: string;
  patient?: string;
  reportDate?: string;
  forensic: { tampered: boolean; confidence: number };
  temporal: { plausible: boolean; note?: string };
  consistency: { consistent: boolean; findings: string[] };
  tests: TestRow[];
}

interface MedicalResult {
  summary: {
    overall_risk_level: RiskLevel;
    executive_summary: string;
    files_analyzed: number;
    reports_count: number;
    patient_name?: string;
  };
  reports: ReportEntry[];
  crossReport: {
    fabricatedBySingleAgency: boolean;
    anomalies: string[];
  };
}

// ─── Risk token map ──────────────────────────────────────────────────────────
// Severity → semantic token (base/-50/-700 only). High/Critical → risk,
// Medium → mitigated, Low → compliant.

const RISK_STYLE: Record<RiskLevel, { text: string; bg: string; border: string; bar: string; icon: typeof ShieldAlert }> = {
  Low: { text: 'text-compliant-700', bg: 'bg-compliant-50', border: 'border-compliant-700/20', bar: 'bg-compliant', icon: ShieldCheck },
  Medium: { text: 'text-mitigated-700', bg: 'bg-mitigated-50', border: 'border-mitigated-700/20', bar: 'bg-mitigated', icon: ShieldAlert },
  High: { text: 'text-risk-700', bg: 'bg-risk-50', border: 'border-risk-700/25', bar: 'bg-risk', icon: ShieldAlert },
  Critical: { text: 'text-risk-700', bg: 'bg-risk-50', border: 'border-risk-700/40', bar: 'bg-risk', icon: ShieldX },
};

// ─── Fixtures (3 mock reports — an escalating insurance-fraud case) ───────────

const FIXTURE: MedicalResult = {
  summary: {
    overall_risk_level: 'High',
    files_analyzed: 3,
    reports_count: 3,
    patient_name: 'Rohan Mehta',
    executive_summary:
      'Strong indicators of coordinated fabrication across this claim. Two of three reports show font-substitution and overwritten value fields, an impossible 4-hour turnaround on a culture test, and biologically inconsistent results. All three reports trace to a single lab footer template despite differing letterheads — consistent with a single fraudulent source.',
  },
  reports: [
    {
      name: 'CBC_Report_MetroLabs.pdf',
      patient: 'Rohan Mehta',
      reportDate: '14 May 2026',
      forensic: { tampered: true, confidence: 0.93 },
      temporal: { plausible: true, note: 'Collection-to-report window within normal range.' },
      consistency: {
        consistent: false,
        findings: [
          'Hemoglobin critically low while RBC count reads normal — physiologically inconsistent.',
          'WBC differential percentages sum to 112%.',
        ],
      },
      tests: [
        { name: 'Hemoglobin', value: '6.1 g/dL', reference: '13.0 – 17.0 g/dL', flag: true, flagReason: 'Critically low; would warrant transfusion, yet no clinical note present.' },
        { name: 'RBC Count', value: '5.2 M/µL', reference: '4.5 – 5.9 M/µL', flag: false },
        { name: 'WBC Count', value: '7.8 K/µL', reference: '4.0 – 11.0 K/µL', flag: false },
        { name: 'Platelets', value: '410 K/µL', reference: '150 – 450 K/µL', flag: false },
        { name: 'Neutrophils', value: '78 %', reference: '40 – 60 %', flag: true, flagReason: 'Differential sums to 112% — values appear overwritten.' },
      ],
    },
    {
      name: 'Culture_Sensitivity_CityDiagnostics.jpg',
      patient: 'Rohan Mehta',
      reportDate: '15 May 2026',
      forensic: { tampered: true, confidence: 0.88 },
      temporal: {
        plausible: false,
        note: 'Reported 4 hours after collection. Bacterial culture + sensitivity requires 48–72h incubation.',
      },
      consistency: {
        consistent: false,
        findings: ['Sensitivity panel reports results for an organism the culture marked "no growth".'],
      },
      tests: [
        { name: 'Culture Result', value: 'E. coli (heavy)', reference: 'No growth (normal)', flag: true, flagReason: 'Heavy growth reported 4h post-collection — temporally impossible.' },
        { name: 'Colony Count', value: '>100,000 CFU/mL', reference: '<10,000 CFU/mL', flag: true, flagReason: 'Count incompatible with reported incubation time.' },
        { name: 'Ciprofloxacin', value: 'Sensitive', reference: 'S / I / R', flag: false },
        { name: 'Nitrofurantoin', value: 'Resistant', reference: 'S / I / R', flag: false },
      ],
    },
    {
      name: 'LipidPanel_WellnessLab.pdf',
      patient: 'Rohan Mehta',
      reportDate: '16 May 2026',
      forensic: { tampered: false, confidence: 0.34 },
      temporal: { plausible: true, note: 'Fasting window and report date consistent.' },
      consistency: {
        consistent: true,
        findings: ['Values internally coherent; mild dyslipidemia consistent across markers.'],
      },
      tests: [
        { name: 'Total Cholesterol', value: '214 mg/dL', reference: '< 200 mg/dL', flag: true, flagReason: 'Mildly elevated — clinically plausible, not a fraud signal.' },
        { name: 'LDL', value: '138 mg/dL', reference: '< 130 mg/dL', flag: true, flagReason: 'Borderline high.' },
        { name: 'HDL', value: '44 mg/dL', reference: '> 40 mg/dL', flag: false },
        { name: 'Triglycerides', value: '180 mg/dL', reference: '< 150 mg/dL', flag: true, flagReason: 'Mildly elevated.' },
      ],
    },
  ],
  crossReport: {
    fabricatedBySingleAgency: true,
    anomalies: [
      'Identical footer template + accreditation barcode across all three letterheads',
      'Same non-standard date format "DD-MMM-YY" used by all three "different" labs',
      'Patient ID font does not match each lab’s body font (substituted glyphs)',
      'Reference-range column alignment is pixel-identical across reports',
    ],
  },
};

const HISTORY_SEED: HistoryJob[] = [
  { id: 'mrr-seed-1', files: ['Discharge_Summary.pdf', 'CBC_Report.pdf'], status: 'COMPLETED', createdAt: '2h ago', meta: 'Low' },
  { id: 'mrr-seed-2', files: ['Claim_4821_bundle (6 files)'], status: 'COMPLETED', createdAt: 'Yesterday', meta: 'Critical' },
  { id: 'mrr-seed-3', files: ['MRI_Knee_Report.jpg'], status: 'FAILED', createdAt: '3d ago' },
];

// ─── CSV evidence export (inline Blob helper) ────────────────────────────────

function escapeCsv(v: string): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function downloadEvidenceCsv(result: MedicalResult) {
  const rows: string[][] = [
    ['Report', 'Patient', 'Report Date', 'Tampered', 'Tamper Confidence', 'Temporal Plausible', 'Medically Consistent', 'Test', 'Value', 'Reference Range', 'Red Flag', 'Flag Reason'],
  ];
  result.reports.forEach((r) => {
    if (r.tests.length === 0) {
      rows.push([
        r.name, r.patient ?? '', r.reportDate ?? '',
        r.forensic.tampered ? 'YES' : 'No', `${Math.round(r.forensic.confidence * 100)}%`,
        r.temporal.plausible ? 'Yes' : 'NO', r.consistency.consistent ? 'Yes' : 'NO',
        '', '', '', '', '',
      ]);
    }
    r.tests.forEach((t) => {
      rows.push([
        r.name, r.patient ?? '', r.reportDate ?? '',
        r.forensic.tampered ? 'YES' : 'No', `${Math.round(r.forensic.confidence * 100)}%`,
        r.temporal.plausible ? 'Yes' : 'NO', r.consistency.consistent ? 'Yes' : 'NO',
        t.name, t.value, t.reference, t.flag ? 'FLAG' : '', t.flagReason ?? '',
      ]);
    });
  });
  rows.push([]);
  rows.push(['Cross-report fabrication (single agency)', result.crossReport.fabricatedBySingleAgency ? 'LIKELY' : 'Not detected']);
  result.crossReport.anomalies.forEach((a) => rows.push(['Shared anomaly', a]));

  const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'medical_forensic_evidence.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof FileText }) {
  return (
    <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated px-4 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-[10px] bg-brand-50 flex items-center justify-center shrink-0">
        <Icon size={17} className="text-brand-700" />
      </span>
      <div className="min-w-0">
        <p className="text-[1.25rem] font-semibold text-ink-900 leading-none tabular-nums">{value}</p>
        <p className="text-[0.75rem] text-ink-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function Verdict({
  ok, okLabel, badLabel, icon: Icon,
}: { ok: boolean; okLabel: string; badLabel: string; icon: typeof ShieldCheck }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold border ${
        ok ? 'bg-compliant-50 text-compliant-700 border-compliant-700/20' : 'bg-risk-50 text-risk-700 border-risk-700/25'
      }`}
    >
      <Icon size={11} /> {ok ? okLabel : badLabel}
    </span>
  );
}

function CheckTile({
  title, sub, hint, children,
}: { title: string; sub: ReactNode; hint: string; children?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-canvas-border bg-paper-50/60 p-3 space-y-1.5">
      <p className="text-[0.75rem] font-semibold text-ink-700">{title}</p>
      <div className="flex items-center gap-2 flex-wrap">{sub}</div>
      {children}
      <p className="text-[0.6875rem] text-ink-400 leading-relaxed">{hint}</p>
    </div>
  );
}

function TestTable({ tests }: { tests: TestRow[] }) {
  if (tests.length === 0) {
    return <p className="text-[0.8125rem] text-ink-400 italic">No structured test values extracted from this report.</p>;
  }
  const flags = tests.filter((t) => t.flag).length;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
          {tests.length} test{tests.length > 1 ? 's' : ''} extracted
        </p>
        {flags > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full bg-risk-50 text-risk-700 text-[0.625rem] font-semibold border border-risk-700/20">
            {flags} flagged
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-canvas-border">
        <table className="w-full text-left border-collapse">
          <thead className="bg-paper-50/80">
            <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Reference range</th>
              <th className="px-3 py-2 text-center">Flag</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t, i) => (
              <tr
                key={`${t.name}-${i}`}
                className={`border-t border-canvas-border ${t.flag ? 'bg-risk-50/50' : ''}`}
              >
                <td className="px-3 py-2 text-[0.8125rem] font-medium text-ink-800 whitespace-nowrap">{t.name}</td>
                <td className={`px-3 py-2 text-[0.8125rem] tabular-nums whitespace-nowrap ${t.flag ? 'text-risk-700 font-semibold' : 'text-ink-600'}`}>
                  {t.value}
                </td>
                <td className="px-3 py-2 text-[0.8125rem] text-ink-500 whitespace-nowrap">{t.reference}</td>
                <td className="px-3 py-2 text-center">
                  {t.flag ? (
                    <span
                      className="inline-flex text-risk-700 cursor-help"
                      title={t.flagReason ?? 'Outside reference range'}
                    >
                      <AlertTriangle size={14} />
                    </span>
                  ) : (
                    <span className="inline-flex text-compliant-700">
                      <ShieldCheck size={14} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportCard({ report, index }: { report: ReportEntry; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const flags = report.tests.filter((t) => t.flag).length;

  return (
    <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-paper-50/50 transition-colors cursor-pointer"
      >
        <FileText size={16} className="text-brand-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[0.875rem] font-semibold text-ink-800 truncate">{report.name}</p>
          <div className="flex items-center gap-3 text-[0.75rem] text-ink-400 mt-0.5 flex-wrap">
            {report.patient && <span>{report.patient}</span>}
            {report.reportDate && (
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {report.reportDate}</span>
            )}
            <span>{report.tests.length} tests</span>
            {flags > 0 && <span className="text-risk-700 font-medium">{flags} flagged</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {report.forensic.tampered && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-risk-50 text-risk-700 text-[0.6875rem] font-semibold border border-risk-700/25">
              <Fingerprint size={11} /> Tampered
            </span>
          )}
          {!report.consistency.consistent && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-mitigated-50 text-mitigated-700 text-[0.6875rem] font-semibold border border-mitigated-700/20">
              Inconsistent
            </span>
          )}
          {open ? <ChevronDown size={16} className="text-ink-400" /> : <ChevronRight size={16} className="text-ink-400" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-canvas-border space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-3">
                <CheckTile
                  title="Forensic integrity"
                  hint="Detects font substitution, overwritten fields, and digital tampering."
                  sub={
                    <>
                      <Verdict ok={!report.forensic.tampered} okLabel="Clean" badLabel="Tampered" icon={report.forensic.tampered ? ShieldX : ShieldCheck} />
                      <span className="text-[0.6875rem] text-ink-500 tabular-nums">
                        {Math.round(report.forensic.confidence * 100)}% confidence
                      </span>
                    </>
                  }
                />
                <CheckTile
                  title="Temporal plausibility"
                  hint="Checks that collection-to-report timing is biologically possible."
                  sub={<Verdict ok={report.temporal.plausible} okLabel="Plausible" badLabel="Suspicious" icon={report.temporal.plausible ? ShieldCheck : ShieldAlert} />}
                >
                  {report.temporal.note && <p className="text-[0.75rem] text-ink-600 leading-relaxed">{report.temporal.note}</p>}
                </CheckTile>
                <CheckTile
                  title="Medical consistency"
                  hint="Validates that abnormal values cohere as a clinical picture."
                  sub={<Verdict ok={report.consistency.consistent} okLabel="Consistent" badLabel="Inconsistent" icon={report.consistency.consistent ? ShieldCheck : ShieldAlert} />}
                >
                  {report.consistency.findings.length > 0 && (
                    <ul className="space-y-1">
                      {report.consistency.findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[0.75rem] text-ink-600 leading-relaxed">
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-ink-300 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </CheckTile>
              </div>

              <TestTable tests={report.tests} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CrossReportCard({ cross }: { cross: MedicalResult['crossReport'] }) {
  const flagged = cross.fabricatedBySingleAgency;
  return (
    <div className={`rounded-[12px] border overflow-hidden ${flagged ? 'border-risk-700/25' : 'border-canvas-border'}`}>
      <div className={`px-4 py-3 border-b ${flagged ? 'bg-risk-50 border-risk-700/15' : 'bg-paper-50/70 border-canvas-border'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Layers size={16} className={flagged ? 'text-risk-700' : 'text-ink-500'} />
          <h3 className="text-[0.875rem] font-semibold text-ink-800">Cross-report fraud analysis</h3>
          <Verdict ok={!flagged} okLabel="No fabrication detected" badLabel="Likely single-source fabrication" icon={flagged ? ShieldX : ShieldCheck} />
        </div>
        <p className="text-[0.75rem] text-ink-500 mt-1 ml-6">
          Compares all reports to detect whether multiple “different” labs share one fraudulent origin.
        </p>
      </div>
      {cross.anomalies.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-2">Shared anomalies</p>
          <div className="flex flex-wrap gap-1.5">
            {cross.anomalies.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-mitigated-50 text-mitigated-700 text-[0.75rem] border border-mitigated-700/20"
              >
                <AlertTriangle size={11} /> {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result renderer ─────────────────────────────────────────────────────────

function MedicalResultView({ result }: { result: MedicalResult }) {
  const s = result.summary;
  const rs = RISK_STYLE[s.overall_risk_level];
  const RiskIcon = rs.icon;

  return (
    <div className="space-y-5">
      {/* Risk banner */}
      <div className={`rounded-[14px] border ${rs.border} ${rs.bg} p-4 flex items-start gap-3`}>
        <span className="w-10 h-10 rounded-[12px] bg-canvas-elevated/70 flex items-center justify-center shrink-0">
          <RiskIcon size={20} className={rs.text} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-[0.9375rem] font-semibold ${rs.text}`}>
              Overall risk: {s.overall_risk_level}
            </p>
            {s.patient_name && (
              <span className="text-[0.75rem] text-ink-500">Patient: {s.patient_name}</span>
            )}
          </div>
          <p className="text-[0.8125rem] text-ink-700 leading-relaxed mt-1">{s.executive_summary}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Files analyzed" value={s.files_analyzed} icon={FileSearch} />
        <StatCard label="Reports extracted" value={s.reports_count} icon={Activity} />
      </div>

      {/* Cross-report fraud card */}
      <CrossReportCard cross={result.crossReport} />

      {/* Per-report detail */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical size={15} className="text-ink-500" />
          <h3 className="text-[0.875rem] font-semibold text-ink-800">Per-report forensic detail</h3>
          <span className="text-[0.75rem] text-ink-400">click a report to expand</span>
        </div>
        <div className="space-y-2.5">
          {result.reports.map((r, i) => (
            <ReportCard key={`${r.name}-${i}`} report={r} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tool entry ──────────────────────────────────────────────────────────────

export default function MedicalReportReaderView({ onBack }: { onBack: () => void }) {
  const logEvent = useAuditLog();
  return (
    <ConciergeFlow<MedicalResult>
      title="Medical Report Reader"
      subtitle="Forensic analysis of medical reports for insurance-fraud detection — tamper checks, temporal plausibility, medical consistency, and cross-report fabrication."
      icon={HeartPulse}
      onBack={onBack}
      accept="application/pdf,image/*"
      multiple
      maxSizeMb={50}
      uploadHint="PDF, JPEG, PNG, WebP or HEIC — up to 50 MB each. Add a whole case folder of reports to cross-check them against each other."
      uploadCtaLabel="Run forensic analysis"
      stages={[
        { id: 'upload', label: 'Upload' },
        { id: 'parse', label: 'Parse reports' },
        { id: 'forensic', label: 'Forensic checks' },
        { id: 'cross', label: 'Cross-report analysis' },
        { id: 'evidence', label: 'Evidence' },
      ]}
      messages={[
        'Securing and queuing uploaded reports…',
        'Extracting patient details, lab metadata and test tables (OCR)…',
        'Scanning for font substitution, overwritten fields and tampering…',
        'Checking sample-to-report timing for biological plausibility…',
        'Comparing reports for a shared fraudulent source…',
        'Compiling the forensic evidence trail…',
      ]}
      totalMs={6200}
      checking={[
        'Document tampering — substituted fonts & overwritten values',
        'Temporal plausibility of collection-to-report timing',
        'Medical consistency across abnormal values',
        'Test results vs. standard reference ranges',
        'Cross-report fabrication by a single agency',
      ]}
      tips={[
        'Bacterial culture & sensitivity needs 48–72h incubation — a same-day result is a classic fabrication tell.',
        'Genuine labs rarely share an identical footer template; matching barcodes across letterheads suggest one source.',
        'A critically low hemoglobin with a normal RBC count is physiologically inconsistent — a common overwrite error.',
        'Uploading the full claim bundle lets the model cross-check reports against one another, not just in isolation.',
      ]}
      buildResult={() => FIXTURE}
      renderResult={(result) => <MedicalResultView result={result} />}
      resultActions={(result) => (
        <button
          onClick={() => {
            downloadEvidenceCsv(result);
            logEvent({
              action: 'Export',
              description: 'Downloaded Medical Report Reader evidence as CSV',
              module: 'AI Concierge',
              entity: 'Medical Report Reader',
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated text-[0.8125rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 px-3 py-2 transition-colors cursor-pointer"
        >
          <Download size={14} /> Download evidence (.csv)
        </button>
      )}
      historyMeta={(result) => result.summary.overall_risk_level}
      historySeed={HISTORY_SEED}
    />
  );
}
