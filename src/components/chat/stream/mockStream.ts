// Mock event emitter for the chat streaming surfaces.
//
// This replaces the old fixed setTimeout choreography with a realistic, bursty
// async event stream. It is fully self-contained — it ships a small default
// sample dataset (a duplicate-invoice audit) and honors an AbortSignal so the
// "stop" affordance can interrupt it cleanly. The shape it produces matches the
// StreamEvent contract in ./streamTypes, so a real backend could later emit the
// same sequence.

import type {
  StreamEvent,
  StreamSource,
  KpiDatum,
  ChartDatum,
  TableRow,
} from './streamTypes';

/** Everything the mock generator needs to drive one end-to-end stream. */
export interface MockAuditData {
  reasoning: string[];
  answer: string;
  kpis: KpiDatum[];
  chart: ChartDatum;
  columns: string[];
  rows: TableRow[];
}

/**
 * A small but plausible duplicate-invoice audit sample. Used as the default
 * payload for `mockAuditStream` so the stream works out of the box.
 */
export const SAMPLE_AUDIT: MockAuditData = {
  reasoning: ['Generating execution plan', 'Writing SQL', 'Connecting data sources'],
  answer:
    'I found 9 suspected duplicate invoices totaling $48,210 across 3 vendors, with 4 high-confidence matches on identical amount, date, and vendor. The strongest cluster is Acme Supply Co., where the same invoice number was paid twice within the same week.',
  kpis: [
    { label: 'Duplicates found', value: '9', color: 'risk' },
    { label: 'Exposure', value: '$48,210', color: 'risk' },
    { label: 'Vendors affected', value: '3' },
    { label: 'High confidence', value: '4', color: 'compliant' },
  ],
  chart: {
    id: 'confidence',
    type: 'bar',
    title: 'Matches by confidence',
    data: [
      { bucket: 'High', count: 4 },
      { bucket: 'Medium', count: 3 },
      { bucket: 'Low', count: 2 },
    ],
  },
  columns: ['Invoice #', 'Vendor', 'Amount', 'Date', 'Match type', 'Confidence'],
  rows: [
    ['INV-10231', 'Acme Supply Co.', 4820, '2026-03-04', 'Exact amount + date', 0.98],
    ['INV-10231', 'Acme Supply Co.', 4820, '2026-03-09', 'Duplicate invoice #', 0.97],
    ['INV-20884', 'Northwind Traders', 7310, '2026-03-11', 'Exact amount + date', 0.95],
    ['INV-20884', 'Northwind Traders', 7310, '2026-03-12', 'Duplicate invoice #', 0.94],
    ['INV-33102', 'Globex Corp.', 5200, '2026-03-18', 'Amount + vendor', 0.81],
    ['INV-33119', 'Globex Corp.', 5200, '2026-03-19', 'Amount + vendor', 0.79],
    ['INV-41277', 'Acme Supply Co.', 3990, '2026-03-22', 'Fuzzy amount', 0.64],
    ['INV-41290', 'Acme Supply Co.', 3995, '2026-03-23', 'Fuzzy amount', 0.61],
    ['INV-52640', 'Northwind Traders', 5685, '2026-03-27', 'Amount + date', 0.58],
  ],
};

/**
 * Resolve after `ms` milliseconds, OR resolve immediately if the signal is
 * already (or becomes) aborted. The timeout is cleared on abort so no stray
 * timers linger, and the abort listener is registered with `{ once: true }`.
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      resolve();
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Random integer in [min, max], inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Split `text` into variable-length pieces of 2–12 characters each, preserving
 * every character exactly (slice, never trim). The last piece may be shorter.
 */
function chunkText(text: string): string[] {
  const pieces: string[] = [];
  let i = 0;
  while (i < text.length) {
    const size = randInt(2, 12);
    pieces.push(text.slice(i, i + size));
    i += size;
  }
  return pieces;
}

/**
 * Build a StreamSource that emits a realistic, bursty mock audit stream.
 * Pass custom `data` to drive a different scenario; defaults to SAMPLE_AUDIT.
 */
export function mockAuditStream(data: MockAuditData = SAMPLE_AUDIT): StreamSource {
  return async function* (signal: AbortSignal): AsyncIterable<StreamEvent> {
    // Phase 1 — reasoning trail (plan -> SQL -> sources).
    if (signal.aborted) return;
    for (let idx = 0; idx < data.reasoning.length; idx++) {
      if (signal.aborted) return;
      const id = `r${idx}`;
      const label = data.reasoning[idx];
      yield { type: 'reasoning.step', step: { id, label, status: 'active' } };
      await sleep(120, signal);
      if (signal.aborted) return;
      yield { type: 'reasoning.step', step: { id, label, status: 'done' } };
      await sleep(130, signal);
    }

    // Phase 2 — prose answer, streamed in bursty variable-length chunks.
    if (signal.aborted) return;
    await sleep(350, signal);
    for (const piece of chunkText(data.answer)) {
      if (signal.aborted) return;
      yield { type: 'text.delta', text: piece };
      await sleep(randInt(14, 34), signal);
    }

    // Phase 3 — KPI block.
    if (signal.aborted) return;
    yield { type: 'block.start', id: 'kpi-1', kind: 'kpi' };
    await sleep(120, signal);
    if (signal.aborted) return;
    yield {
      type: 'block.delta',
      id: 'kpi-1',
      payload: { kind: 'kpi', kpis: data.kpis },
    };
    yield { type: 'block.end', id: 'kpi-1' };

    // Phase 4 — table block: columns first, then rows in batches of 3.
    if (signal.aborted) return;
    yield { type: 'block.start', id: 'tbl-1', kind: 'table' };
    yield {
      type: 'block.delta',
      id: 'tbl-1',
      payload: { kind: 'table', columns: data.columns },
    };
    for (let i = 0; i < data.rows.length; i += 3) {
      if (signal.aborted) return;
      const batch: TableRow[] = data.rows.slice(i, i + 3);
      yield {
        type: 'block.delta',
        id: 'tbl-1',
        payload: { kind: 'table', rows: batch },
      };
      await sleep(90, signal);
    }
    if (signal.aborted) return;
    yield { type: 'block.end', id: 'tbl-1' };

    // Phase 5 — chart block.
    if (signal.aborted) return;
    yield { type: 'block.start', id: 'cht-1', kind: 'chart' };
    await sleep(120, signal);
    if (signal.aborted) return;
    const chart: ChartDatum = data.chart;
    yield {
      type: 'block.delta',
      id: 'cht-1',
      payload: { kind: 'chart', chart },
    };
    yield { type: 'block.end', id: 'cht-1' };

    // Phase 6 — done.
    if (signal.aborted) return;
    yield { type: 'done' };
  };
}
