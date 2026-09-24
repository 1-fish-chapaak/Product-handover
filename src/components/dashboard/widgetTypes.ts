import type { WidgetModelConfig } from './model/relationshipTypes';
import type { WidgetCompareOverride } from './compare/compareTypes';

/** A user-added dashboard widget, as persisted per dashboard. */
export interface DashboardWidget {
  chartType: string;
  title: string;
  xField: string;
  yField: string;
  color?: string;
  fontFamily?: string;
  seriesColors?: Record<string, string>;
  /** Multi-table (model) widgets carry the query they were built from. */
  model?: WidgetModelConfig;
  slicerMode?: string;
  /** Compare override — pin its own A/B, or opt out of the dashboard's compare. */
  compare?: WidgetCompareOverride;
}
