import type {
  RunResult,
  WorkflowDraft,
  JourneyFiles,
  JourneyMappings,
  ColumnAlignment,
  ColumnDType,
  InputSpec,
  JourneyAlignments,
  ClarifyQuestion,
} from './types';
import { SAMPLE_WORKFLOWS } from './sampleWorkflows';

// ── Deterministic mock helpers for column alignment ─────────────────────

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seededRand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function inferType(columnName: string): ColumnDType {
  const lc = columnName.toLowerCase();
  if (/(date|time|timestamp|\bdt\b)/.test(lc)) return 'TIMESTAMP';
  if (/(amount|price|value|total|cost|rate|variance|cap|balance|debit|credit)/.test(lc))
    return 'DECIMAL';
  if (/(qty|quantity|count|num|records)/.test(lc)) return 'INT';
  if (/(is[_ ]|has[_ ]|active|flag|enabled)/.test(lc)) return 'BOOL';
  return 'STRING';
}

function snakeCase(s: string): string {
  return s
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

export function autoAlignColumns(input: InputSpec): ColumnAlignment[] {
  const cols = input.columns ?? [];
  return cols.map((col, idx) => {
    const seed = hashString(`${input.id}:${col}:${idx}`);
    const base = 52 + Math.floor(seededRand(seed) * 43); // 52–95
    const inferred = inferType(col);

    // Introduce some type drift to generate realistic "needs attention" rows
    const typeVariation = seededRand(seed + 11);
    let sourceDtype: ColumnDType = inferred;
    if (typeVariation < 0.18 && inferred !== 'STRING') sourceDtype = 'STRING';
    else if (typeVariation > 0.85 && inferred === 'STRING') sourceDtype = 'DECIMAL';

    const targetDtype = inferred;
    const typeMatch = sourceDtype === targetDtype;

    const nameSimilarity = Math.max(
      28,
      Math.min(100, base - 8 + Math.floor(seededRand(seed + 2) * 22)),
    );
    const typeCompatibility = typeMatch
      ? Math.min(100, base + 14)
      : Math.max(38, base - 26);
    const statisticalProfile = Math.max(
      38,
      Math.min(100, base + Math.floor(seededRand(seed + 3) * 16) - 6),
    );
    const semanticSimilarity = Math.max(
      34,
      Math.min(100, base - 7 + Math.floor(seededRand(seed + 4) * 14)),
    );

    const overall = Math.round(
      nameSimilarity * 0.35 +
        typeCompatibility * 0.25 +
        statisticalProfile * 0.2 +
        semanticSimilarity * 0.2,
    );

    let reason: ColumnAlignment['reason'] = null;
    if (!typeMatch) reason = 'type_mismatch';
    else if (overall < 60) reason = 'low_confidence';

    const explanation =
      overall >= 88
        ? 'Strong match — name, type, and data profile all align cleanly.'
        : overall >= 72
          ? 'Partial match — field names share some overlap but data patterns show divergence. Review recommended.'
          : 'Weak match — significant differences in name or data shape. Adjust the target or the source.';

    return {
      id: `${input.id}:${idx}`,
      source: { name: col, dtype: sourceDtype },
      target: { name: snakeCase(col), dtype: targetDtype },
      confidence: overall,
      breakdown: {
        nameSimilarity,
        typeCompatibility,
        statisticalProfile,
        semanticSimilarity,
      },
      explanation,
      reason,
    };
  });
}

export function seedAlignments(workflow: WorkflowDraft): JourneyAlignments {
  const out: JourneyAlignments = {};
  workflow.inputs.forEach((i) => {
    out[i.id] = autoAlignColumns(i);
  });
  return out;
}

// Pick the sample that best matches the prompt, then override logicPrompt with
// the user's actual text so the downstream UI shows their intent.
export function generateWorkflow(prompt: string): WorkflowDraft {
  const p = prompt.toLowerCase();
  const scored = SAMPLE_WORKFLOWS.map((w) => {
    const haystack = [w.name, w.description, w.category, ...w.tags].join(' ').toLowerCase();
    const score = haystack.split(/\s+/).reduce((s, word) => (word && p.includes(word) ? s + 1 : s), 0);
    return { w, score };
  }).sort((a, b) => b.score - a.score);

  const base = scored[0].score > 0 ? scored[0].w : SAMPLE_WORKFLOWS[0];
  return {
    ...base,
    id: `draft-${Date.now()}`,
    logicPrompt: prompt.trim() || base.logicPrompt,
  };
}

export function getClarifyQuestions(w: WorkflowDraft): ClarifyQuestion[] {
  const dateRange: ClarifyQuestion = {
    id: 'dateRange',
    title: 'First — what date range should I cover?',
    options: ['Last 30 days', 'Last 90 days', 'Full FY26', 'Custom range'],
  };
  const materiality: ClarifyQuestion = {
    id: 'materiality',
    title: 'What materiality threshold should apply?',
    options: ['Strict (< 1%)', 'Moderate (< 5%)', 'Relaxed (< 10%)', 'Custom'],
  };
  const vendorScope: ClarifyQuestion = {
    id: 'vendorScope',
    title: 'Which vendor scope should I analyze?',
    options: ['All vendors', 'Top 50 by spend', 'Flagged vendors only', 'Specific vendor'],
  };
  const accountScope: ClarifyQuestion = {
    id: 'accountScope',
    title: 'Which account scope should I reconcile?',
    options: ['All accounts', 'Cash accounts only', 'Balance sheet only', 'Custom selection'],
  };
  const outputFormat: ClarifyQuestion = {
    id: 'outputFormat',
    title: 'How would you like the output?',
    options: ['Flag list', 'Detailed table', 'Executive summary', 'Interactive dashboard'],
  };

  if (w.category === 'Financial Audit') {
    return [dateRange, materiality, accountScope, outputFormat];
  }
  return [dateRange, materiality, vendorScope, outputFormat];
}

export function tolerancePctFromAnswer(answer: string | undefined): number {
  if (!answer) return 5;
  if (answer.startsWith('Strict')) return 1;
  if (answer.startsWith('Moderate')) return 5;
  if (answer.startsWith('Relaxed')) return 10;
  return 5;
}

export async function runWorkflow(
  workflow: WorkflowDraft,
  files: JourneyFiles,
  mappings: JourneyMappings,
): Promise<RunResult> {
  await new Promise((r) => setTimeout(r, 1200));

  const fileCount = Object.values(files).reduce((n, arr) => n + arr.length, 0);
  const mappingCount = Object.values(mappings).reduce(
    (n, step) => n + Object.values(step).reduce((m, list) => m + list.length, 0),
    0,
  );

  if (workflow.output.type === 'flags') {
    return {
      outputType: 'flags',
      title: workflow.output.title,
      description: workflow.output.description,
      stats: [
        { label: 'Records Scanned', value: `${12_000 + fileCount * 125}`, tone: 'primary' },
        { label: 'Flags', value: '8', tone: 'risk' },
        { label: 'Amount at Risk', value: '₹6.16L', tone: 'warning' },
        { label: 'Confidence', value: mappingCount > 0 ? '94%' : '72%', tone: 'ok' },
      ],
      columns: ['Invoice', 'Vendor', 'Amount', 'Issue', 'Severity'],
      rows: [
        { cells: ['INV-4521', 'Acme Corp', '₹45,200', 'Duplicate of INV-3102', 'Critical'], status: 'flagged' },
        { cells: ['INV-4533', 'Global Supplies', '₹1,28,750', 'No matching PO', 'High'], status: 'flagged' },
        { cells: ['INV-4558', 'TechVendor', '₹67,400', 'Out-of-scope line', 'Medium'], status: 'warning' },
        { cells: ['INV-4589', 'Pinnacle', '₹89,600', 'Off-policy GL code', 'Medium'], status: 'warning' },
        { cells: ['INV-4612', 'Atlas Mfg', '₹23,100', 'Clean', 'Low'], status: 'ok' },
      ],
    };
  }

  if (workflow.output.type === 'table') {
    return {
      outputType: 'table',
      title: workflow.output.title,
      description: workflow.output.description,
      stats: [
        { label: 'Accounts Reconciled', value: '1,089 / 1,247', tone: 'ok' },
        { label: 'Variance Detected', value: '98', tone: 'warning' },
        { label: 'Unmatched', value: '60', tone: 'risk' },
        { label: 'Total Variance', value: '₹2.47L', tone: 'primary' },
      ],
      columns: ['Account', 'TB Balance', 'GL Total', 'Variance', 'Status'],
      rows: [
        { cells: ['1001-Cash', '₹12,45,200', '₹12,45,200', '₹0', 'Matched'], status: 'ok' },
        { cells: ['1200-AR', '₹8,32,750', '₹8,35,200', '₹2,450', 'Variance'], status: 'warning' },
        { cells: ['2100-AP', '₹6,67,400', '₹6,67,400', '₹0', 'Matched'], status: 'ok' },
        { cells: ['5100-Opex', '₹4,23,100', '₹3,89,600', '₹33,500', 'Variance'], status: 'warning' },
        { cells: ['1500-Inventory', '₹9,89,600', '—', '—', 'Unmatched'], status: 'flagged' },
      ],
    };
  }

  return {
    outputType: 'summary',
    title: workflow.output.title,
    description: workflow.output.description,
    stats: [
      { label: 'Steps Completed', value: `${workflow.steps.length}`, tone: 'primary' },
      { label: 'Records Processed', value: '8,412', tone: 'ok' },
      { label: 'Findings', value: '14', tone: 'warning' },
    ],
    columns: ['Finding', 'Category', 'Evidence'],
    rows: [
      { cells: ['Vendor master drift detected', 'Governance', '3 entries'], status: 'warning' },
      { cells: ['Invoice posting outside office hours', 'Controls', '12 entries'], status: 'warning' },
      { cells: ['GL variance within tolerance', 'Recon', '0 entries'], status: 'ok' },
    ],
  };
}
