import type { DashboardWidget } from './widgetTypes';
import { CHOCOLATE_TABLE_ID as T } from './model/chocolateSalesData';

// ─── The "Chocolate Sales" dashboard ───
// A model-bound dashboard built straight from the workbook so every widget —
// KPI, bar, line, area, pie, table and slicer — re-runs its own query per side
// when Compare is on. Nothing here is a static picture.

export const CHOCOLATE_DASHBOARD_ID = 'choco';

const dim = (column: string) => ({ table: T, column, role: 'dimension' as const });
const sum = (column: string) => ({ table: T, column, role: 'measure' as const, agg: 'sum' as const });

/** Seeded once into the persisted widget store; from then on the user owns them. */
export const CHOCOLATE_DEFAULT_WIDGETS: DashboardWidget[] = [
  { chartType: 'KPI', title: 'Total Sales', xField: '', yField: 'Amount ($)', color: '#6a12cd', model: { fields: [sum('Amount')] } },
  { chartType: 'KPI', title: 'Boxes Shipped', xField: '', yField: 'Boxes Shipped', color: '#6a12cd', model: { fields: [sum('Boxes')] } },
  { chartType: 'KPI', title: 'Average Sale', xField: '', yField: 'Amount ($)', color: '#6a12cd', model: { fields: [{ table: T, column: 'Amount', role: 'measure', agg: 'avg' }] } },
  { chartType: 'KPI', title: 'Active Sales People', xField: '', yField: 'Sales Person', color: '#6a12cd', model: { fields: [{ table: T, column: 'SalesPerson', role: 'measure', agg: 'countDistinct' }] } },
  { chartType: 'Slicer', title: 'Country', xField: 'Country', yField: '', color: '#6a12cd', model: { fields: [dim('Country')] }, slicerMode: 'list' },
  { chartType: 'Line Chart', title: 'Monthly Sales Trend', xField: 'Month', yField: 'Amount ($)', color: '#6a12cd', model: { fields: [dim('Month'), sum('Amount')] } },
  { chartType: 'Bar Chart', title: 'Sales by Country', xField: 'Country', yField: 'Amount ($)', color: '#6a12cd', model: { fields: [dim('Country'), sum('Amount')] } },
  { chartType: 'Area Chart', title: 'Boxes Shipped by Month', xField: 'Month', yField: 'Boxes Shipped', color: '#0d9488', model: { fields: [dim('Month'), sum('Boxes')] } },
  { chartType: 'Pie Chart', title: 'Sales by Year', xField: 'Year', yField: 'Amount ($)', color: '#6a12cd', model: { fields: [dim('Year'), sum('Amount')] } },
  { chartType: 'Bar Chart', title: 'Sales by Product', xField: 'Product', yField: 'Amount ($)', color: '#C2410C', model: { fields: [dim('Product'), sum('Amount')] } },
  { chartType: 'Table', title: 'Sales Person Performance', xField: 'Sales Person', yField: 'Amount ($)', color: '#6a12cd', model: { fields: [dim('SalesPerson'), sum('Amount'), sum('Boxes'), { table: T, column: 'Product', role: 'measure', agg: 'count' }] } },
];
