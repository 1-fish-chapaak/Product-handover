import type {
  ModelTable, Relationship, ColumnPair, AggFn, WidgetModelConfig, AutoDetectCandidate, ModelChartData, ModelRow, ModelFilter,
} from './relationshipTypes';

export const tableById = (tables: ModelTable[], id: string) => tables.find(t => t.id === id);
export const colByName = (t: ModelTable | undefined, name: string) => t?.columns.find(c => c.name === name);

const samePair = (r: Relationship, a: string, b: string) =>
  (r.leftTable === a && r.rightTable === b) || (r.leftTable === b && r.rightTable === a);

/** Active relationship already exists for this (unordered) table pair? */
export function pairHasActive(rels: Relationship[], a: string, b: string): boolean {
  return rels.some(r => r.active && samePair(r, a, b));
}

export function relationshipsBetween(rels: Relationship[], a: string, b: string): Relationship[] {
  return rels.filter(r => samePair(r, a, b));
}

/** Tables directly joined to `tableId` via an active relationship. */
export function relatedTables(rels: Relationship[], tableId: string): Set<string> {
  const out = new Set<string>();
  rels.filter(r => r.active).forEach(r => {
    if (r.leftTable === tableId) out.add(r.rightTable);
    if (r.rightTable === tableId) out.add(r.leftTable);
  });
  return out;
}

/** Adjacency over ACTIVE relationships. */
function activeAdjacency(rels: Relationship[]): Map<string, { other: string; rel: Relationship }[]> {
  const m = new Map<string, { other: string; rel: Relationship }[]>();
  const add = (a: string, b: string, rel: Relationship) => {
    if (!m.has(a)) m.set(a, []);
    m.get(a)!.push({ other: b, rel });
  };
  rels.filter(r => r.active).forEach(r => { add(r.leftTable, r.rightTable, r); add(r.rightTable, r.leftTable, r); });
  return m;
}

/** Are all `needed` tables reachable from each other via active relationships? */
export function tablesConnected(rels: Relationship[], needed: string[]): boolean {
  if (needed.length <= 1) return true;
  const adj = activeAdjacency(rels);
  const seen = new Set<string>([needed[0]]);
  const q = [needed[0]];
  while (q.length) {
    const cur = q.shift()!;
    (adj.get(cur) ?? []).forEach(({ other }) => { if (!seen.has(other)) { seen.add(other); q.push(other); } });
  }
  return needed.every(t => seen.has(t));
}

// ─── Auto-detect ───
// One candidate per matching column per table pair (single-column, like Power BI).
// Skips pairs that already have an identical relationship.
export function autoDetect(tables: ModelTable[], existing: Relationship[]): AutoDetectCandidate[] {
  const out: AutoDetectCandidate[] = [];
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i], b = tables[j];
      a.columns.forEach(ca => {
        b.columns.forEach(cb => {
          if (ca.name === cb.name && ca.type === cb.type && (ca.isKey || cb.isKey)) {
            const pairs: ColumnPair[] = [{ left: ca.name, right: cb.name }];
            const dup = existing.some(r => samePair(r, a.id, b.id) && r.columnPairs.length === 1 && r.columnPairs[0].left === ca.name && r.columnPairs[0].right === cb.name);
            if (dup) return;
            out.push({
              id: `cand-${a.id}-${b.id}-${ca.name}`,
              leftTable: a.id,
              rightTable: b.id,
              columnPairs: pairs,
              reason: `Both tables have ${ca.label}`,
              willBeInactive: pairHasActive(existing, a.id, b.id),
            });
          }
        });
      });
    }
  }
  return out;
}

// ─── Aggregation ───
function aggregate(values: number[], fn: AggFn): number {
  if (values.length === 0) return 0;
  switch (fn) {
    case 'sum': return Math.round(values.reduce((s, v) => s + v, 0));
    case 'avg': return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return values.length;
    case 'countDistinct': return new Set(values).size;
    default: return Math.round(values.reduce((s, v) => s + v, 0));
  }
}

export const AGG_LABEL: Record<AggFn, string> = {
  sum: 'Sum', avg: 'Average', count: 'Count', countDistinct: 'Distinct', min: 'Min', max: 'Max',
};

const ns = (t: string, c: string) => `${t}__${c}`;

/** Join the needed tables via active relationships, then group-by + aggregate.
 *  `filters` constrain the joined rows before grouping. Only filters whose table
 *  is relationship-connected to the widget's tables apply (Power BI: a visual is
 *  unaffected by filters on tables it has no path to). */
export function buildWidgetRows(tables: ModelTable[], rels: Relationship[], config: WidgetModelConfig, filters: ModelFilter[] = []): ModelChartData {
  const dims = config.fields.filter(f => f.role === 'dimension');
  const measures = config.fields.filter(f => f.role === 'measure');
  const widgetTables = [...new Set(config.fields.map(f => f.table))];

  const labelFor = (t: string, c: string) => colByName(tableById(tables, t), c)?.label ?? c;
  const xLabel = dims.map(d => labelFor(d.table, d.column)).join(' · ') || 'Total';
  const measureLabel = (m: typeof measures[number]) => `${AGG_LABEL[m.agg ?? 'sum']} of ${labelFor(m.table, m.column)}`;
  const series = measures.length ? measures.map(measureLabel) : ['Count'];

  if (config.fields.length === 0) return { xLabel, series, rows: [] };

  // Connectivity check (uses active relationships, intermediates allowed).
  if (!tablesConnected(rels, widgetTables)) {
    const reachable = new Set<string>([widgetTables[0]]);
    const adj = activeAdjacency(rels);
    const q = [widgetTables[0]];
    while (q.length) { const c = q.shift()!; (adj.get(c) ?? []).forEach(({ other }) => { if (!reachable.has(other)) { reachable.add(other); q.push(other); } }); }
    return { xLabel, series, rows: [], error: 'Selected tables are not connected.', unrelated: widgetTables.filter(t => !reachable.has(t)) };
  }

  // Active filters that have a relationship path to this widget's tables. Their
  // tables join into the row set so the predicates can be evaluated; unrelated
  // filters are ignored entirely (the visual stays unfiltered by them).
  const applicableFilters = filters.filter(f =>
    f.values.length > 0 && tablesConnected(rels, [...new Set([...widgetTables, f.table])]),
  );
  const needed = [...new Set([...widgetTables, ...applicableFilters.map(f => f.table)])];

  // Pick a base (highest active degree among needed) and BFS a spanning tree.
  const adj = activeAdjacency(rels);
  const degree = (t: string) => (adj.get(t)?.length ?? 0);
  const base = [...needed].sort((a, b) => degree(b) - degree(a))[0];
  const parent = new Map<string, { via: string; rel: Relationship }>();
  const seen = new Set<string>([base]);
  const bfs = [base];
  while (bfs.length) {
    const cur = bfs.shift()!;
    (adj.get(cur) ?? []).forEach(({ other, rel }) => { if (!seen.has(other)) { seen.add(other); parent.set(other, { via: cur, rel }); bfs.push(other); } });
  }
  // Join set = base + every table on a path to a needed table (includes intermediates).
  const joinSet = new Set<string>([base]);
  needed.forEach(t => { let cur = t; while (cur !== base) { joinSet.add(cur); cur = parent.get(cur)!.via; } });
  // Order tables so parents are joined before children.
  const order: string[] = [base];
  bfs.push(base);
  const placed = new Set<string>([base]);
  const queue = [base];
  while (queue.length) {
    const cur = queue.shift()!;
    (adj.get(cur) ?? []).forEach(({ other }) => { if (joinSet.has(other) && !placed.has(other)) { placed.add(other); order.push(other); queue.push(other); } });
  }

  // Build the joined row set (inner join), namespacing every column as table__col.
  let combined: ModelRow[] = (tableById(tables, base)?.rows ?? []).map(r => {
    const o: ModelRow = {};
    Object.entries(r).forEach(([k, v]) => { o[ns(base, k)] = v; });
    return o;
  });
  for (const t of order.slice(1)) {
    const { via, rel } = parent.get(t)!;
    // Map column pairs to (parent col, child col).
    const pairs = rel.columnPairs.map(p => (rel.leftTable === via ? { p: p.left, c: p.right } : { p: p.right, c: p.left }));
    const childRows = tableById(tables, t)?.rows ?? [];
    const next: ModelRow[] = [];
    combined.forEach(row => {
      childRows.forEach(cr => {
        if (pairs.every(({ p, c }) => row[ns(via, p)] === cr[c])) {
          const merged: ModelRow = { ...row };
          Object.entries(cr).forEach(([k, v]) => { merged[ns(t, k)] = v; });
          next.push(merged);
        }
      });
    });
    combined = next;
  }

  // Apply filter context (page slicers + cross-filter) on the joined rows.
  if (applicableFilters.length) {
    combined = combined.filter(row =>
      applicableFilters.every(f => {
        const v = row[ns(f.table, f.column)];
        return f.values.some(fv => String(fv) === String(v));
      }),
    );
  }

  // Group by the selected dimensions; aggregate the measures.
  const keyOf = (row: ModelRow) => dims.map(d => String(row[ns(d.table, d.column)])).join(' · ') || 'Total';
  const groups = new Map<string, ModelRow[]>();
  combined.forEach(row => { const k = keyOf(row); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(row); });

  const rows = [...groups.entries()].map(([label, groupRows]) => {
    const out: { label: string; [s: string]: number | string } = { label };
    if (measures.length === 0) {
      out['Count'] = groupRows.length;
    } else {
      measures.forEach(m => {
        const vals = groupRows.map(r => Number(r[ns(m.table, m.column)]) || 0);
        out[measureLabel(m)] = aggregate(vals, m.agg ?? 'sum');
      });
    }
    return out;
  });
  rows.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return { xLabel, series, rows };
}

/** Distinct values of a column, sorted — drives the page-slicer value picker. */
export function distinctValues(tables: ModelTable[], table: string, column: string): (string | number)[] {
  const t = tableById(tables, table);
  if (!t) return [];
  const seen = new Set<string>();
  const out: (string | number)[] = [];
  for (const r of t.rows) {
    const v = r[column];
    if (v === undefined || v === null) continue;
    const k = String(v);
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  out.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  return out;
}

/** Widgets whose model spans both endpoints of a relationship (impact analysis). */
export function widgetUsesRelationship(config: WidgetModelConfig | undefined, rel: Relationship): boolean {
  if (!config) return false;
  const needed = new Set(config.fields.map(f => f.table));
  return needed.has(rel.leftTable) && needed.has(rel.rightTable);
}
