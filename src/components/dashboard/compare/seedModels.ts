import type { AggFn, WidgetModelConfig, WidgetModelField } from '../model/relationshipTypes';
import type { SeedSlot } from './compareTypes';

// The seed dashboards render static charts (ConfigurableChart) that have no
// query behind them. To let them take part in Compare without rewriting that
// renderer, each seed slot is bound here to an equivalent query on the data
// model; in compare mode the slot renders the compare view of that query and
// otherwise stays exactly as it was. Seeds with no entry are "not comparable".

const inv = (column: string, agg: AggFn = 'sum'): WidgetModelField => ({ table: 'invoices', column, role: 'measure', agg });
const dim = (table: string, column: string): WidgetModelField => ({ table, column, role: 'dimension' });

export const SEED_COMPARE_MODELS: Record<string, Partial<Record<SeedSlot, WidgetModelConfig>>> = {
  p2p: {
    kpi0: { fields: [inv('InvoiceID', 'count')] },                               // Invoices Processed
    kpi1: { fields: [inv('DuplicateCount')] },                                   // Duplicate Flags
    // kpi2 Avg Processing Time, kpi3 Compliance Rate — no model behind them.
    w1: { fields: [dim('calendar', 'Month'), inv('DuplicateCount')] },           // Detection / duplicates over time
    w2: { fields: [dim('calendar', 'Month'), inv('Amount')] },                   // Invoice Volume Trend
    w3: { fields: [dim('calendar', 'Month'), inv('InvoiceID', 'count')] },       // Monthly Invoice Volume
    w4: { fields: [dim('invoices', 'Status'), inv('Amount')] },                  // Invoice Status
    table: { fields: [dim('vendors', 'VendorName'), inv('Amount'), inv('AmountAtRisk'), inv('DuplicateCount')] },
  },
  grc: {
    kpi0: { fields: [inv('AmountAtRisk')] },                                     // risk exposure
    kpi2: { fields: [inv('DuplicateCount')] },                                   // deficiencies proxy
    w1: { fields: [dim('calendar', 'Month'), inv('AmountAtRisk')] },
    w2: { fields: [dim('departments', 'Department'), inv('AmountAtRisk')] },
    w3: { fields: [dim('calendar', 'Month'), inv('DuplicateCount')] },
    w4: { fields: [dim('invoices', 'Status'), inv('AmountAtRisk')] },
    table: { fields: [dim('departments', 'Department'), inv('Amount'), inv('AmountAtRisk'), inv('DuplicateCount')] },
  },
};

export const seedModelFor = (dashboardId: string, slot: SeedSlot): WidgetModelConfig | undefined => SEED_COMPARE_MODELS[dashboardId]?.[slot];
