import { useMemo, useState } from 'react';
import {
  Table2, BarChart3, AlertTriangle, ShieldCheck, FileDown,
  Rows3, Columns3, Files, TrendingUp, CircleCheck, CircleAlert,
  CircleX, Sigma, Hash, Type, Calendar, ToggleLeft,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ConciergeFlow } from '../ConciergeKit';
import type { PickedFile, HistoryJob } from '../types';
import { useAuditLog } from '../../../../context/AdminDataContext';

// ─── Result type ─────────────────────────────────────────────────────────────

type ColType = 'number' | 'string' | 'date' | 'bool';
type Severity = 'high' | 'medium' | 'low';
type RuleResult = 'pass' | 'warn' | 'fail';

interface ColumnProfile {
  name: string;
  type: ColType;
  missingPct: number;
  unique: number;
}
interface Anomaly {
  title: string;
  severity: Severity;
  count: number;
  method: string;
  detail: string;
}
interface Heuristic {
  rule: string;
  result: RuleResult;
  note: string;
}
interface DistPoint {
  label: string;
  value: number;
}

interface EdaResult {
  summary: { total_rows: number; total_columns: number; files_analyzed: number };
  understanding: { columns: ColumnProfile[] };
  anomalies: Anomaly[];
  heuristics: Heuristic[];
  distribution: DistPoint[];
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const COLUMN_LIBRARY: ColumnProfile[] = [
  { name: 'invoice_id', type: 'string', missingPct: 0, unique: 48210 },
  { name: 'vendor_name', type: 'string', missingPct: 1.2, unique: 412 },
  { name: 'invoice_date', type: 'date', missingPct: 0.4, unique: 731 },
  { name: 'due_date', type: 'date', missingPct: 3.8, unique: 690 },
  { name: 'amount', type: 'number', missingPct: 0, unique: 39884 },
  { name: 'tax_amount', type: 'number', missingPct: 6.1, unique: 12044 },
  { name: 'currency', type: 'string', missingPct: 0, unique: 7 },
  { name: 'cost_center', type: 'string', missingPct: 11.9, unique: 88 },
  { name: 'gl_account', type: 'string', missingPct: 2.3, unique: 146 },
  { name: 'approver', type: 'string', missingPct: 18.6, unique: 54 },
  { name: 'po_number', type: 'string', missingPct: 24.7, unique: 31002 },
  { name: 'is_recurring', type: 'bool', missingPct: 0, unique: 2 },
  { name: 'payment_terms_days', type: 'number', missingPct: 4.5, unique: 9 },
  { name: 'status', type: 'string', missingPct: 0, unique: 5 },
];

const ANOMALY_LIBRARY: Anomaly[] = [
  {
    title: 'Outlier invoice amounts',
    severity: 'high',
    count: 142,
    method: 'Z-score (|z| > 3)',
    detail: '142 invoices fall more than 3 standard deviations above the mean — concentrated in 4 vendors.',
  },
  {
    title: 'Benford’s Law deviation on amount',
    severity: 'high',
    count: 1,
    method: 'Benford first-digit χ²',
    detail: 'First-digit distribution diverges from Benford expectation (p < 0.01), a common manual-entry / fraud signal.',
  },
  {
    title: 'Duplicate invoice candidates',
    severity: 'medium',
    count: 67,
    method: 'Fuzzy key match',
    detail: '67 near-duplicate rows share vendor, amount and date within a 3-day window.',
  },
  {
    title: 'Weekend / holiday postings',
    severity: 'medium',
    count: 318,
    method: 'Calendar rule',
    detail: '318 transactions posted on non-business days — worth confirming against the posting calendar.',
  },
  {
    title: 'Round-number clustering',
    severity: 'low',
    count: 904,
    method: 'Modulo bucketing',
    detail: '904 amounts land on exact thousands, slightly above the expected baseline.',
  },
  {
    title: 'Stale due dates',
    severity: 'low',
    count: 53,
    method: 'IQR on date gap',
    detail: '53 rows have a due date earlier than the invoice date.',
  },
];

const HEURISTIC_LIBRARY: Heuristic[] = [
  { rule: 'Primary key uniqueness (invoice_id)', result: 'pass', note: 'No duplicate identifiers across 48,210 rows.' },
  { rule: 'Referential integrity (gl_account)', result: 'pass', note: 'All values map to the chart-of-accounts lookup.' },
  { rule: 'Completeness threshold (≥ 95% per column)', result: 'warn', note: '3 columns fall below 95% — po_number, approver, cost_center.' },
  { rule: 'Amount sign consistency', result: 'pass', note: 'All booked amounts share the expected sign convention.' },
  { rule: 'Date ordering (invoice_date ≤ due_date)', result: 'fail', note: '53 rows violate chronological ordering.' },
  { rule: 'Currency whitelist', result: 'pass', note: 'All 7 currencies present in the approved list.' },
  { rule: 'Tax-to-amount ratio bounds', result: 'warn', note: '38 rows exceed the expected 0–28% tax band.' },
  { rule: 'Categorical cardinality (status)', result: 'pass', note: 'status holds 5 stable, expected values.' },
];

const DISTRIBUTION: DistPoint[] = [
  { label: '0–1k', value: 8120 },
  { label: '1k–5k', value: 16940 },
  { label: '5k–10k', value: 11280 },
  { label: '10k–25k', value: 6710 },
  { label: '25k–50k', value: 3120 },
  { label: '50k–100k', value: 1410 },
  { label: '100k+', value: 630 },
];

const HISTORY_SEED: HistoryJob[] = [
  { id: 'eda-seed-1', files: ['ap_invoices_q1.csv', 'ap_invoices_q2.csv'], status: 'COMPLETED', createdAt: '2h ago', meta: '6 anomalies' },
  { id: 'eda-seed-2', files: ['gl_journal_2025.xlsx'], status: 'COMPLETED', createdAt: 'Yesterday', meta: '4 anomalies' },
  { id: 'eda-seed-3', files: ['expense_export.csv'], status: 'FAILED', createdAt: '3 days ago' },
];

// ─── Tokens / helpers ────────────────────────────────────────────────────────

const SEVERITY_META: Record<Severity, { label: string; pill: string; hex: string }> = {
  high: { label: 'High', pill: 'bg-risk text-risk-700 border-risk-700/20', hex: '#912018' },
  medium: { label: 'Medium', pill: 'bg-mitigated text-mitigated-700 border-mitigated-700/20', hex: '#B45309' },
  low: { label: 'Low', pill: 'bg-compliant text-compliant-700 border-compliant-700/20', hex: '#166534' },
};

const RULE_META: Record<RuleResult, { label: string; cls: string; Icon: typeof CircleCheck; hex: string }> = {
  pass: { label: 'Pass', cls: 'bg-compliant text-compliant-700', Icon: CircleCheck, hex: '#166534' },
  warn: { label: 'Warn', cls: 'bg-mitigated text-mitigated-700', Icon: CircleAlert, hex: '#B45309' },
  fail: { label: 'Fail', cls: 'bg-risk text-risk-700', Icon: CircleX, hex: '#912018' },
};

const TYPE_META: Record<ColType, { Icon: typeof Hash; cls: string }> = {
  number: { Icon: Hash, cls: 'text-brand-600' },
  string: { Icon: Type, cls: 'text-ink-500' },
  date: { Icon: Calendar, cls: 'text-mitigated-700' },
  bool: { Icon: ToggleLeft, cls: 'text-compliant-700' },
};

const nf = new Intl.NumberFormat('en-US');

function pickDeterministic<T>(library: T[], seed: number, min: number): T[] {
  const n = Math.max(min, Math.min(library.length, min + (seed % (library.length - min + 1))));
  return library.slice(0, n);
}

function downloadBlob(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function columnsToCsv(cols: ColumnProfile[]): string {
  const head = ['column', 'type', 'missing_pct', 'unique_values'];
  const rows = cols.map((c) => [c.name, c.type, c.missingPct.toFixed(1), String(c.unique)]);
  return [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ─── Build result (mock) ─────────────────────────────────────────────────────

function buildResult(files: PickedFile[]): EdaResult {
  const seed = Math.max(1, files.reduce((acc, f) => acc + f.name.length + Math.round(f.size / 1024), files.length * 3));
  const columns = pickDeterministic(COLUMN_LIBRARY, seed, 9);
  const anomalies = pickDeterministic(ANOMALY_LIBRARY, seed + 2, 4);
  const totalRows = 12480 * Math.max(1, files.length) + (seed % 5000);
  return {
    summary: {
      total_rows: totalRows,
      total_columns: columns.length,
      files_analyzed: Math.max(1, files.length),
    },
    understanding: { columns },
    anomalies,
    heuristics: HEURISTIC_LIBRARY,
    distribution: DISTRIBUTION,
  };
}

// ─── Chart primitives ────────────────────────────────────────────────────────

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-ink-800">{title}</p>
        {hint && <span className="text-[0.6875rem] text-ink-400">{hint}</span>}
      </div>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(15,7,32,0.08)',
} as const;

// ─── Sub-views ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: typeof Rows3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon size={18} className="text-brand-600" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-0.5 text-[1.375rem] font-semibold leading-none text-ink-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function MissingBar({ pct }: { pct: number }) {
  const tone = pct >= 15 ? '#912018' : pct >= 5 ? '#B45309' : '#6A12CD';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-paper-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: tone }} />
      </div>
      <span className="w-10 text-right text-[0.75rem] tabular-nums text-ink-600">{pct.toFixed(1)}%</span>
    </div>
  );
}

function UnderstandingView({ result }: { result: EdaResult }) {
  const { columns } = result.understanding;
  const missingData = useMemo(
    () =>
      [...columns]
        .filter((c) => c.missingPct > 0)
        .sort((a, b) => b.missingPct - a.missingPct)
        .slice(0, 8)
        .map((c) => ({ label: c.name, value: Number(c.missingPct.toFixed(1)) })),
    [columns],
  );

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-lg border border-canvas-border">
        <div className="max-h-[22rem] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-paper-50">
              <tr className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-2.5">Column</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Missing</th>
                <th className="px-4 py-2.5 text-right">Unique values</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => {
                const tm = TYPE_META[c.type];
                return (
                  <tr key={c.name} className="border-t border-canvas-border hover:bg-paper-50/50">
                    <td className="px-4 py-2.5 font-mono text-[0.8125rem] text-ink-800">{c.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-600">
                        <tm.Icon size={13} className={tm.cls} />
                        {c.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><MissingBar pct={c.missingPct} /></td>
                    <td className="px-4 py-2.5 text-right text-[0.8125rem] tabular-nums text-ink-700">{nf.format(c.unique)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ChartCard title="Columns by missing data" hint="top 8 · % null">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={missingData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke="#F3EEE5" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9A8FAE' }} axisLine={false} tickLine={false} unit="%" />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontSize: 11, fill: '#6B5D82' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(106,18,205,0.05)' }} contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Missing'] as [string, string]} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={18}>
              {missingData.map((d) => (
                <Cell key={d.label} fill={d.value >= 15 ? '#912018' : d.value >= 5 ? '#B45309' : '#8838DE'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Amount distribution" hint="row count per bucket">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={result.distribution} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#F3EEE5" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9A8FAE' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9A8FAE' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => nf.format(v)} />
            <Tooltip cursor={{ fill: 'rgba(106,18,205,0.05)' }} contentStyle={tooltipStyle} formatter={(v) => [nf.format(Number(v)), 'Rows'] as [string, string]} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]} fill="#6A12CD" maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AnomalyView({ result }: { result: EdaResult }) {
  const chartData = useMemo(
    () => result.anomalies.map((a) => ({ label: a.title, value: a.count, severity: a.severity })),
    [result.anomalies],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {result.anomalies.map((a) => {
          const sm = SEVERITY_META[a.severity];
          return (
            <div key={a.title} className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: sm.hex }} />
                  <div className="min-w-0">
                    <p className="text-[0.875rem] font-semibold text-ink-900">{a.title}</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-400">{a.method}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${sm.pill}`}>
                  {sm.label}
                </span>
              </div>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-600">{a.detail}</p>
              <p className="mt-3 text-[1.25rem] font-semibold leading-none text-ink-900 tabular-nums">
                {nf.format(a.count)} <span className="text-[0.75rem] font-medium text-ink-400">flagged</span>
              </p>
            </div>
          );
        })}
      </div>

      <ChartCard title="Flagged rows by anomaly" hint="count">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid horizontal={false} stroke="#F3EEE5" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#9A8FAE' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => nf.format(v)} />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ fontSize: 11, fill: '#6B5D82' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'rgba(106,18,205,0.05)' }} contentStyle={tooltipStyle} formatter={(v) => [nf.format(Number(v)), 'Rows'] as [string, string]} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={20}>
              {chartData.map((d) => (
                <Cell key={d.label} fill={SEVERITY_META[d.severity].hex} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function HeuristicsView({ result }: { result: EdaResult }) {
  const tally = useMemo(() => {
    const t = { pass: 0, warn: 0, fail: 0 } as Record<RuleResult, number>;
    result.heuristics.forEach((h) => { t[h.result] += 1; });
    return t;
  }, [result.heuristics]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {(['pass', 'warn', 'fail'] as RuleResult[]).map((k) => {
          const m = RULE_META[k];
          return (
            <div key={k} className="flex items-center gap-2.5 rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3">
              <m.Icon size={18} style={{ color: m.hex }} />
              <div>
                <p className="text-[1.25rem] font-semibold leading-none text-ink-900 tabular-nums">{tally[k]}</p>
                <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-400">{m.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <ul className="divide-y divide-canvas-border overflow-hidden rounded-lg border border-canvas-border bg-canvas-elevated">
        {result.heuristics.map((h) => {
          const m = RULE_META[h.result];
          return (
            <li key={h.rule} className="flex items-start gap-3 px-4 py-3">
              <m.Icon size={16} className="mt-0.5 shrink-0" style={{ color: m.hex }} />
              <div className="min-w-0 flex-1">
                <p className="text-[0.875rem] font-medium text-ink-800">{h.rule}</p>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-500">{h.note}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${m.cls}`}>{m.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Result composition ──────────────────────────────────────────────────────

type SubTab = 'understanding' | 'anomaly' | 'heuristics';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Table2 }[] = [
  { id: 'understanding', label: 'Data Understanding', icon: Table2 },
  { id: 'anomaly', label: 'Anomaly Detection', icon: AlertTriangle },
  { id: 'heuristics', label: 'Heuristics', icon: ShieldCheck },
];

function ResultBody({ result }: { result: EdaResult }) {
  const [sub, setSub] = useState<SubTab>('understanding');
  const highCount = result.anomalies.filter((a) => a.severity === 'high').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Rows3} label="Total Rows" value={nf.format(result.summary.total_rows)} />
        <StatCard icon={Columns3} label="Total Columns" value={nf.format(result.summary.total_columns)} />
        <StatCard icon={Files} label="Files" value={nf.format(result.summary.files_analyzed)} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-canvas-border bg-paper-50/60 px-4 py-2.5 text-[0.8125rem] text-ink-600">
        <Sigma size={15} className="text-brand-600" />
        <span>
          Profiled <span className="font-semibold text-ink-800">{result.summary.total_columns}</span> columns and flagged{' '}
          <span className="font-semibold text-ink-800">{result.anomalies.length}</span> anomaly type{result.anomalies.length === 1 ? '' : 's'}
          {highCount > 0 && <> — <span className="font-semibold text-risk-700">{highCount} high-severity</span></>}.
        </span>
      </div>

      <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-1">
        {SUB_TABS.map((t) => {
          const active = t.id === sub;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                active ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {sub === 'understanding' && <UnderstandingView result={result} />}
      {sub === 'anomaly' && <AnomalyView result={result} />}
      {sub === 'heuristics' && <HeuristicsView result={result} />}
    </div>
  );
}

// ─── Tool ────────────────────────────────────────────────────────────────────

export default function InsightsAnomalyView({ onBack }: { onBack: () => void }) {
  const logEvent = useAuditLog();
  return (
    <ConciergeFlow<EdaResult>
      title="Insights & Anomaly Report"
      subtitle="Upload your datasets for automated statistical profiling, anomaly detection and heuristic data-quality checks — no setup, no formulas."
      icon={BarChart3}
      onBack={onBack}
      accept=".csv,.xls,.xlsx"
      multiple
      maxSizeMb={100}
      uploadHint="CSV, XLS or XLSX · up to 100 MB each · multiple files supported"
      uploadCtaLabel="Run analysis"
      stages={[
        { id: 'upload', label: 'Upload' },
        { id: 'profile', label: 'Profile data' },
        { id: 'anomaly', label: 'Detect anomalies' },
        { id: 'heuristics', label: 'Heuristics' },
        { id: 'report', label: 'Report' },
      ]}
      messages={[
        'Reading files and inferring column types…',
        'Profiling distributions, nulls and cardinality…',
        'Scanning for outliers, duplicates and Benford deviations…',
        'Evaluating data-quality heuristics and business rules…',
        'Assembling your insights report…',
      ]}
      totalMs={5200}
      checking={[
        'Column types, null rates and unique-value counts',
        'Statistical outliers (Z-score & IQR) and round-number clustering',
        'Duplicate and near-duplicate records',
        'Benford’s Law conformance on monetary fields',
        'Referential integrity and date-ordering rules',
      ]}
      tips={[
        'Benford’s Law expects “1” to lead about 30% of natural amounts — sharp deviations often flag manual entry.',
        'A Z-score above 3 means a value sits beyond 99.7% of a normal distribution — a classic outlier threshold.',
        'High-cardinality text columns near 100% unique are usually identifiers, not features.',
        'Round-number clustering can indicate estimates, thresholds or fabricated figures.',
      ]}
      buildResult={buildResult}
      renderResult={(result) => <ResultBody result={result} />}
      resultActions={(result) => (
        <>
          <button
            onClick={() => {
              downloadBlob(
                'insights-anomaly-report.json',
                JSON.stringify(result, null, 2),
                'application/json',
              );
              logEvent({
                action: 'Export',
                description: 'Exported Insights & Anomaly report as JSON',
                module: 'AI Concierge',
                entity: 'Insights & Anomaly Report',
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[0.8125rem] font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700 cursor-pointer"
          >
            <FileDown size={14} /> Export JSON
          </button>
          <button
            onClick={() => {
              downloadBlob('column-profile.csv', columnsToCsv(result.understanding.columns), 'text/csv');
              logEvent({
                action: 'Export',
                description: 'Exported Insights & Anomaly column profile as CSV',
                module: 'AI Concierge',
                entity: 'Insights & Anomaly Report',
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-[0.8125rem] font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700 cursor-pointer"
          >
            <FileDown size={14} /> Export CSV
          </button>
        </>
      )}
      historyMeta={(result) => `${result.anomalies.length} anomalies`}
      historySeed={HISTORY_SEED}
    />
  );
}
