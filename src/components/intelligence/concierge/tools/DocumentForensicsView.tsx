import { type ReactNode } from 'react';
import {
  ShieldCheck,
  FileSearch,
  FileText,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Calculator,
  CalendarX,
  Layers,
  QrCode,
  Receipt,
  Gauge,
  ChevronDown,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob } from '../types';

// ─── Domain model ────────────────────────────────────────────────────────────
// Mirrors the production Document Forensics report shape (irame-mvp):
// composite score + risk level + recommended action + per-module breakdown
// split into Content Analysis vs Forensic Analysis, plus an evidence chain.
// Everything here is a hard-coded mock — no real bytes are ever inspected.

type RiskLevel = 'GENUINE' | 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'FORGED';
type RecommendedAction =
  | 'ACCEPT'
  | 'ACCEPT_WITH_NOTE'
  | 'REVIEW'
  | 'ESCALATE'
  | 'REJECT';
type ModuleCategory = 'content' | 'forensic';
type Severity = 'high' | 'medium' | 'low';

interface ForensicModule {
  name: string;
  category: ModuleCategory;
  score: number; // 0..100 — higher is cleaner
  flags: string[];
  details?: string;
}

interface EvidenceItem {
  severity: Severity;
  module: string;
  finding: string;
}

interface ForensicResult {
  composite_score: number; // 0..100
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  document_type_detected: string;
  confidence: number; // 0..100
  primaryReason: string;
  modules: ForensicModule[];
  evidence_chain: EvidenceItem[];
}

// ─── Visual config ───────────────────────────────────────────────────────────

const RISK_META: Record<
  RiskLevel,
  { label: string; hex: string; badge: string; dot: string }
> = {
  GENUINE: {
    label: 'Genuine',
    hex: '#15803D',
    badge: 'bg-compliant-50 text-compliant-700 border-compliant',
    dot: 'bg-compliant',
  },
  LOW_RISK: {
    label: 'Low risk',
    hex: '#0284C7',
    badge: 'bg-evidence-50 text-evidence-700 border-evidence-200',
    dot: 'bg-evidence-600',
  },
  MEDIUM_RISK: {
    label: 'Medium risk',
    hex: '#B45309',
    badge: 'bg-mitigated-50 text-mitigated-700 border-mitigated',
    dot: 'bg-mitigated',
  },
  HIGH_RISK: {
    label: 'High risk',
    hex: '#C2410C',
    badge: 'bg-mitigated-50 text-mitigated-700 border-mitigated',
    dot: 'bg-mitigated',
  },
  FORGED: {
    label: 'Forged',
    hex: '#B42318',
    badge: 'bg-risk-50 text-risk-700 border-risk',
    dot: 'bg-risk',
  },
};

const ACTION_META: Record<RecommendedAction, { label: string; cls: string }> = {
  ACCEPT: { label: 'Accept', cls: 'bg-compliant-50 text-compliant-700' },
  ACCEPT_WITH_NOTE: {
    label: 'Accept with note',
    cls: 'bg-evidence-50 text-evidence-700',
  },
  REVIEW: { label: 'Review required', cls: 'bg-mitigated-50 text-mitigated-700' },
  ESCALATE: { label: 'Escalate', cls: 'bg-mitigated-50 text-mitigated-700' },
  REJECT: { label: 'Reject', cls: 'bg-risk-50 text-risk-700' },
};

const SEVERITY_META: Record<Severity, { label: string; cls: string }> = {
  high: { label: 'High', cls: 'bg-risk-50 text-risk-700 border-risk' },
  medium: {
    label: 'Medium',
    cls: 'bg-mitigated-50 text-mitigated-700 border-mitigated',
  },
  low: { label: 'Low', cls: 'bg-evidence-50 text-evidence-700 border-evidence-200' },
};

const scoreTone = (score: number) =>
  score >= 70
    ? 'text-compliant-700'
    : score >= 45
      ? 'text-mitigated-700'
      : 'text-risk-700';

const FINDING_ICON: Record<string, typeof Bot> = {
  ai: Bot,
  amount: Calculator,
  date: CalendarX,
  template: Layers,
  qr: QrCode,
  tax: Receipt,
};

// ─── Fixtures ────────────────────────────────────────────────────────────────
// Three canned reports. We pick one deterministically from files[0]?.name so a
// demo feels responsive to the chosen file while staying fully offline.

const REPORT_FORGED: Omit<ForensicResult, 'document_type_detected'> = {
  composite_score: 24,
  risk_level: 'FORGED',
  recommended_action: 'REJECT',
  confidence: 94,
  primaryReason:
    'Line items do not add up to the stated total and the invoice carries the fingerprint of a software template generator. Treat as fabricated.',
  modules: [
    {
      name: 'Content Validation',
      category: 'content',
      score: 18,
      details: 'Stated total ₹1,48,200 — line items sum to ₹1,21,900 (₹26,300 short).',
      flags: ['Amount-Mismatch', 'Rounding inconsistency on tax line'],
    },
    {
      name: 'Content Verifier',
      category: 'content',
      score: 41,
      details: 'GST charged at 18% but computed value implies 12% on the subtotal.',
      flags: ['GST rate vs. computed value disagree'],
    },
    {
      name: 'GSTIN Verifier',
      category: 'content',
      score: 33,
      details: 'Inter-state supply billed with CGST+SGST instead of IGST.',
      flags: ['Wrong tax type (CGST/SGST on inter-state supply)', 'Seller state code 27, buyer 29'],
    },
    {
      name: 'QR Scanner',
      category: 'content',
      score: 52,
      details: 'Decoded QR payload total disagrees with the printed grand total.',
      flags: ['QR amount mismatch with printed text'],
    },
    {
      name: 'Template Detection',
      category: 'forensic',
      score: 21,
      details: 'PDF /Producer field reads "invoice-generator.com".',
      flags: ['Software-generated template (invoice-generator.com)'],
    },
    {
      name: 'TrueSight AI Detection',
      category: 'forensic',
      score: 38,
      details: 'Moderate likelihood of synthetic regions in the header block.',
      flags: ['Elevated AI-generation probability (61%)'],
    },
    {
      name: 'Copy-Move Detection',
      category: 'forensic',
      score: 29,
      details: '5 clusters of duplicated pixel regions around the stamp area.',
      flags: ['5 copy-move clusters detected'],
    },
    {
      name: 'Font Forensics',
      category: 'forensic',
      score: 44,
      details: 'Total field uses Helvetica while the body is set in Arial.',
      flags: ['Mismatched font on amount field'],
    },
    {
      name: 'PDF Structure',
      category: 'forensic',
      score: 47,
      flags: ['Incremental update after initial save'],
    },
    {
      name: 'Metadata Analysis',
      category: 'forensic',
      score: 56,
      flags: ['Editing software in modification history'],
    },
  ],
  evidence_chain: [
    {
      severity: 'high',
      module: 'Content Validation',
      finding: 'Line items short of stated total by ₹26,300.',
    },
    {
      severity: 'high',
      module: 'GSTIN Verifier',
      finding: 'Inter-state supply billed with CGST+SGST instead of IGST.',
    },
    {
      severity: 'high',
      module: 'Template Detection',
      finding: 'Document generated by invoice-generator.com (per /Producer).',
    },
    {
      severity: 'high',
      module: 'Copy-Move Detection',
      finding: '5 duplicated pixel clusters around the rubber stamp.',
    },
    {
      severity: 'medium',
      module: 'QR Scanner',
      finding: 'QR-encoded total does not match the printed grand total.',
    },
    {
      severity: 'medium',
      module: 'Font Forensics',
      finding: 'Amount field set in a different typeface than the body text.',
    },
    {
      severity: 'medium',
      module: 'TrueSight AI Detection',
      finding: 'AI-generation probability of 61% in the header region.',
    },
    {
      severity: 'low',
      module: 'PDF Structure',
      finding: 'One incremental update recorded after the original save.',
    },
  ],
};

const REPORT_REVIEW: Omit<ForensicResult, 'document_type_detected'> = {
  composite_score: 61,
  risk_level: 'MEDIUM_RISK',
  recommended_action: 'REVIEW',
  confidence: 88,
  primaryReason:
    'Document is internally consistent, but the file was re-saved in image-editing software and one date sits outside the expected window. Confirm provenance before relying on it.',
  modules: [
    {
      name: 'Content Validation',
      category: 'content',
      score: 78,
      details: 'Totals reconcile; minor rounding of ₹2 on the tax line.',
      flags: ['Tax line rounding (±₹2)'],
    },
    {
      name: 'Content Verifier',
      category: 'content',
      score: 64,
      details: 'Invoice date is 11 days after the stated dispatch date.',
      flags: ['Date ordering looks reversed'],
    },
    {
      name: 'GSTIN Verifier',
      category: 'content',
      score: 91,
      flags: [],
    },
    {
      name: 'QR Scanner',
      category: 'content',
      score: 100,
      details: 'QR payload matches the printed values.',
      flags: [],
    },
    {
      name: 'JPEG Forensics',
      category: 'forensic',
      score: 49,
      details: 'Compression fingerprint matches a known image editor.',
      flags: ['Re-saved in editing software (editor Q-table)'],
    },
    {
      name: 'Metadata Analysis',
      category: 'forensic',
      score: 58,
      details: 'Camera EXIF stripped; only software timestamps remain.',
      flags: ['Original camera metadata removed'],
    },
    {
      name: 'TrueSight AI Detection',
      category: 'forensic',
      score: 86,
      flags: [],
    },
    {
      name: 'Copy-Move Detection',
      category: 'forensic',
      score: 92,
      flags: [],
    },
    {
      name: 'Image Quality',
      category: 'forensic',
      score: 73,
      flags: ['Mild motion blur on lower third'],
    },
    {
      name: 'PDF Structure',
      category: 'forensic',
      score: 81,
      flags: [],
    },
  ],
  evidence_chain: [
    {
      severity: 'medium',
      module: 'JPEG Forensics',
      finding: 'File was opened and re-saved in image-editing software.',
    },
    {
      severity: 'medium',
      module: 'Content Verifier',
      finding: 'Invoice date precedes the dispatch date by 11 days.',
    },
    {
      severity: 'medium',
      module: 'Metadata Analysis',
      finding: 'Original camera EXIF data has been stripped.',
    },
    {
      severity: 'low',
      module: 'Image Quality',
      finding: 'Mild motion blur on the lower third of the page.',
    },
    {
      severity: 'low',
      module: 'Content Validation',
      finding: 'Tax line rounded by ₹2 against the computed value.',
    },
  ],
};

const REPORT_GENUINE: Omit<ForensicResult, 'document_type_detected'> = {
  composite_score: 93,
  risk_level: 'GENUINE',
  recommended_action: 'ACCEPT',
  confidence: 97,
  primaryReason:
    'All content checks reconcile and no tampering markers were found. The file carries an intact camera capture history.',
  modules: [
    {
      name: 'Content Validation',
      category: 'content',
      score: 98,
      details: 'Subtotal, tax, and grand total all reconcile.',
      flags: [],
    },
    {
      name: 'Content Verifier',
      category: 'content',
      score: 95,
      flags: [],
    },
    {
      name: 'GSTIN Verifier',
      category: 'content',
      score: 96,
      details: 'GSTIN format valid; intra-state CGST+SGST correctly applied.',
      flags: [],
    },
    {
      name: 'QR Scanner',
      category: 'content',
      score: 100,
      details: 'QR payload matches the printed values.',
      flags: [],
    },
    {
      name: 'TrueSight AI Detection',
      category: 'forensic',
      score: 97,
      flags: [],
    },
    {
      name: 'Copy-Move Detection',
      category: 'forensic',
      score: 99,
      flags: [],
    },
    {
      name: 'Metadata Analysis',
      category: 'forensic',
      score: 91,
      details: 'Intact camera EXIF; no editing software in the history.',
      flags: [],
    },
    {
      name: 'Font Forensics',
      category: 'forensic',
      score: 94,
      flags: [],
    },
    {
      name: 'PDF Structure',
      category: 'forensic',
      score: 90,
      flags: [],
    },
    {
      name: 'Image Quality',
      category: 'forensic',
      score: 88,
      flags: [],
    },
  ],
  evidence_chain: [
    {
      severity: 'low',
      module: 'Image Quality',
      finding: 'Slight shadow on the top edge — within normal capture range.',
    },
    {
      severity: 'low',
      module: 'PDF Structure',
      finding: 'Single linearized save, no incremental updates.',
    },
  ],
};

const detectDocType = (name?: string): string => {
  const n = (name ?? '').toLowerCase();
  if (n.includes('licen') || n.includes('dl')) return 'Driving Licence';
  if (n.includes('pan')) return 'PAN Card';
  if (n.includes('aadha')) return 'Aadhaar Card';
  if (n.includes('passport')) return 'Passport';
  if (n.includes('bank') || n.includes('statement')) return 'Bank Statement';
  if (n.includes('receipt')) return 'Payment Receipt';
  return 'Tax Invoice';
};

const buildResult = (files: PickedFile[]): ForensicResult => {
  const name = files[0]?.name ?? '';
  const lower = name.toLowerCase();

  let base: Omit<ForensicResult, 'document_type_detected'>;
  if (/genuine|clean|valid|real|original|verified/.test(lower)) {
    base = REPORT_GENUINE;
  } else if (/forge|fake|tamper|fraud|edit|suspect/.test(lower)) {
    base = REPORT_FORGED;
  } else {
    // Deterministic-but-varied pick from the file name so repeated demos differ.
    const sum = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
    const pick = sum % 3;
    base = pick === 0 ? REPORT_GENUINE : pick === 1 ? REPORT_REVIEW : REPORT_FORGED;
  }

  return { ...base, document_type_detected: detectDocType(name) };
};

// ─── Result sub-components ───────────────────────────────────────────────────

function ScoreDonut({ score, color }: { score: number; color: string }) {
  const data = [
    { value: score },
    { value: 100 - score },
  ];
  return (
    <div className="relative w-[130px] h-[130px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={60}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
            isAnimationActive
            animationDuration={700}
          >
            <Cell fill={color} />
            <Cell fill="var(--color-paper-100, #F1EFEC)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.75rem] font-semibold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[0.625rem] font-medium text-ink-400 mt-0.5">
          / 100
        </span>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const m = RISK_META[risk];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8125rem] font-semibold ${m.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function findingIconFor(finding: string) {
  const f = finding.toLowerCase();
  if (f.includes('ai-gen') || f.includes('synthetic') || f.includes('ai gen'))
    return FINDING_ICON.ai;
  if (f.includes('amount') || f.includes('sum') || f.includes('short') || f.includes('total'))
    return FINDING_ICON.amount;
  if (f.includes('date')) return FINDING_ICON.date;
  if (
    f.includes('template') ||
    f.includes('generator') ||
    f.includes('copy-move') ||
    f.includes('cluster')
  )
    return FINDING_ICON.template;
  if (f.includes('qr')) return FINDING_ICON.qr;
  if (f.includes('tax') || f.includes('gst') || f.includes('igst'))
    return FINDING_ICON.tax;
  return AlertTriangle;
}

function ModuleCard({ mod }: { mod: ForensicModule }) {
  const tone = scoreTone(mod.score);
  const accent =
    mod.score >= 70
      ? 'border-l-compliant'
      : mod.score >= 45
        ? 'border-l-mitigated'
        : 'border-l-risk';
  return (
    <div
      className={`rounded-lg border border-canvas-border border-l-[3px] ${accent} bg-canvas-elevated p-4 transition-shadow hover:shadow-[0_4px_14px_rgba(106,18,205,0.05)]`}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h4 className="text-[0.8125rem] font-semibold text-ink-800 leading-snug">
          {mod.name}
        </h4>
        <span className={`text-[1.0625rem] font-bold tabular-nums leading-none ${tone}`}>
          {mod.score}
        </span>
      </div>

      {mod.details && (
        <p className="text-[0.75rem] text-ink-500 leading-snug mb-2">{mod.details}</p>
      )}

      {mod.flags.length > 0 ? (
        <ul className="space-y-1">
          {mod.flags.map((flag, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[0.75rem] text-ink-600">
              <AlertTriangle size={12} className="text-mitigated shrink-0 mt-0.5" />
              <span className="leading-snug">{flag}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-1.5 text-[0.75rem] text-compliant-700">
          <CheckCircle2 size={12} />
          <span>No issues detected</span>
        </div>
      )}
    </div>
  );
}

function ModuleGroup({
  title,
  icon: Icon,
  mods,
}: {
  title: string;
  icon: typeof FileText;
  mods: ForensicModule[];
}) {
  if (mods.length === 0) return null;
  return (
    <div>
      <h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-700 mb-3">
        <Icon size={15} className="text-brand-600" />
        {title}
        <span className="text-ink-400 font-normal">({mods.length})</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mods.map((m) => (
          <ModuleCard key={m.name} mod={m} />
        ))}
      </div>
    </div>
  );
}

function EvidenceTable({ chain }: { chain: EvidenceItem[] }) {
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...chain].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
  return (
    <table className="w-full text-left">
      <thead className="bg-paper-50/70">
        <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
          <th className="px-4 py-2.5 w-28">Severity</th>
          <th className="px-4 py-2.5 w-48">Module</th>
          <th className="px-4 py-2.5">Finding</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((item, i) => {
          const s = SEVERITY_META[item.severity];
          return (
            <tr key={i} className="border-t border-canvas-border hover:bg-paper-50/40">
              <td className="px-4 py-2.5 align-top">
                <span
                  className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-semibold ${s.cls}`}
                >
                  {s.label}
                </span>
              </td>
              <td className="px-4 py-2.5 align-top text-[0.8125rem] font-medium text-ink-600">
                {item.module}
              </td>
              <td className="px-4 py-2.5 align-top text-[0.8125rem] text-ink-800">
                {item.finding}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── renderResult ────────────────────────────────────────────────────────────

function ForensicReportView(result: ForensicResult): ReactNode {
  const risk = RISK_META[result.risk_level];
  const action = ACTION_META[result.recommended_action];
  const content = result.modules.filter((m) => m.category === 'content');
  const forensic = result.modules.filter((m) => m.category === 'forensic');

  // Top three module flags become the "key findings" highlight row.
  const keyFindings = result.modules
    .filter((m) => m.flags.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((m) => ({ module: m.name, finding: m.flags[0] }));

  const flaggedCount = result.modules.filter((m) => m.flags.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Executive summary */}
      <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <ScoreDonut score={result.composite_score} color={risk.hex} />

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <RiskBadge risk={result.risk_level} />
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[0.8125rem] font-semibold ${action.cls}`}
              >
                {action.label}
              </span>
            </div>

            <p className="text-[0.875rem] text-ink-700 leading-relaxed">
              {result.primaryReason}
            </p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.75rem] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <FileText size={13} className="text-ink-400" />
                {result.document_type_detected}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge size={13} className="text-ink-400" />
                {result.confidence}% confidence
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-ink-400" />
                {result.modules.length} modules run · {flaggedCount} flagged
              </span>
            </div>
          </div>
        </div>

        {/* Key findings */}
        {keyFindings.length > 0 && (
          <div className="mt-5 pt-5 border-t border-canvas-border">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400 mb-2.5">
              Key findings
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {keyFindings.map((f, i) => {
                const Icon = findingIconFor(f.finding);
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-risk bg-risk-50/60 p-3"
                  >
                    <span className="mt-0.5 w-7 h-7 rounded-lg bg-canvas-elevated flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-risk-700" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.75rem] font-semibold text-ink-800">
                        {f.module}
                      </p>
                      <p className="text-[0.75rem] text-ink-600 leading-snug mt-0.5">
                        {f.finding}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Module groups */}
      <ModuleGroup title="Content Analysis" icon={FileText} mods={content} />
      <ModuleGroup title="Forensic Analysis" icon={Fingerprint} mods={forensic} />

      {/* Advanced diagnostics — collapsed evidence chain */}
      {result.evidence_chain.length > 0 && (
        <details className="group rounded-lg border border-canvas-border overflow-hidden">
          <summary className="flex items-center justify-between gap-2 bg-paper-50/70 px-4 py-3 cursor-pointer list-none select-none">
            <span className="inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-ink-600 group-hover:text-ink-800">
              <AlertTriangle size={14} className="text-ink-400" />
              Advanced diagnostics
              <span className="text-ink-400 font-normal">
                ({result.evidence_chain.length} finding
                {result.evidence_chain.length > 1 ? 's' : ''})
              </span>
            </span>
            <ChevronDown
              size={15}
              className="text-ink-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-canvas-border overflow-x-auto">
            <EvidenceTable chain={result.evidence_chain} />
          </div>
        </details>
      )}
    </div>
  );
}

// ─── History seed ────────────────────────────────────────────────────────────

const HISTORY_SEED: HistoryJob[] = [
  {
    id: 'seed-fx-1',
    files: ['vendor-invoice-4471.pdf'],
    status: 'COMPLETED',
    createdAt: '2h ago',
    meta: 'Forged',
  },
  {
    id: 'seed-fx-2',
    files: ['driving-licence-front.jpg'],
    status: 'COMPLETED',
    createdAt: 'Yesterday',
    meta: 'Genuine',
  },
  {
    id: 'seed-fx-3',
    files: ['reimbursement-receipt.png'],
    status: 'COMPLETED',
    createdAt: '3 days ago',
    meta: 'Medium risk',
  },
];

// ─── View ────────────────────────────────────────────────────────────────────

export default function DocumentForensicsView({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <ConciergeFlow<ForensicResult>
      title="Document Forensics"
      subtitle="Upload an identity document or invoice and get a tamper-and-fraud verdict — content checks plus pixel-level forensic analysis, distilled into one risk score."
      icon={ShieldCheck}
      onBack={onBack}
      accept="image/jpeg,image/png,image/tiff,image/bmp,image/webp,application/pdf"
      multiple={false}
      maxSizeMb={50}
      uploadHint="JPG, PNG, PDF, TIFF, BMP or WEBP · up to 50 MB · one document at a time"
      uploadCtaLabel="Run forensic scan"
      stages={[
        { id: 'upload', label: 'Upload' },
        { id: 'classify', label: 'Classification' },
        { id: 'forensic', label: 'Forensic analysis' },
        { id: 'review', label: 'AI review' },
        { id: 'report', label: 'Risk report' },
      ]}
      totalMs={6200}
      messages={[
        'Securing the file and reading its structure…',
        'Classifying the document and locating key fields…',
        'Running pixel-level forensics — splicing, copy-move and re-save traces…',
        'Cross-checking math, tax rules, dates and QR payloads…',
        'Scoring the evidence and assembling the risk report…',
      ]}
      checking={[
        'AI generation — ChatGPT, DALL·E, Gemini, Stable Diffusion',
        'Copy-move & splicing — duplicated or pasted pixel regions',
        'Math & tax rules — subtotals, GST rate, intra/inter-state tax',
        'GSTIN & identifiers — format, state code, buyer/seller roles',
        'QR cross-check — decode and compare against printed text',
        'Date roles — issue vs. expiry, future-date sanity checks',
      ]}
      tips={[
        'Every JPEG has a hidden compression fingerprint (the Q-table). If a document’s Q-table matches an editor like MS Paint, we can tell the file was edited — even when it was saved back as a perfect-looking JPEG.',
        'A driving licence that expires in 2028 is not suspicious. Our role-aware date checker reads the label near each date (Issue Date vs. Valid Until) before deciding whether to flag it.',
        'Copy-move detection clusters duplicate pixel regions. Four or more clusters almost always means the document was digitally retouched.',
        'Invoice-generator sites like Canva, Zoho and invoice-generator.com leave their brand in the PDF’s /Producer field. The template detector reads that to flag software-generated invoices.',
        'Intra-state sales should use CGST+SGST; inter-state sales must use IGST. A Maharashtra→Karnataka bill charging CGST+SGST is a wrong-tax-type red flag.',
      ]}
      buildResult={(files) => buildResult(files)}
      renderResult={(result) => ForensicReportView(result)}
      historyMeta={(result) => RISK_META[result.risk_level].label}
      historySeed={HISTORY_SEED}
    />
  );
}
