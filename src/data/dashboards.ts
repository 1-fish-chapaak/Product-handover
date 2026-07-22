/**
 * The dashboard catalog — the single source of truth for what dashboards exist
 * and how each one is tagged.
 *
 * This used to be copied by hand into every surface that needed it, and the
 * copies drifted: Platform Usage advertised an "Excel Analytics" and a "SQL
 * Analytics" dashboard that exist nowhere in the product. Anything that needs
 * to count, list, or tag dashboards derives from here so that cannot recur.
 *
 * A dashboard's tag is its data source, which is exactly what the card on the
 * Dashboards page shows: Excel / CSV, Query, or SQL. A dashboard built on more
 * than one kind of source ('combo') carries one tag per kind.
 */

export type DashboardSourceType = 'excel' | 'csv' | 'sql' | 'query' | 'combo';

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  timeAgo: string;
  creator: string;
  accent: string;
  sharedBy?: string;
  dataSource?: DashboardSourceType;
  dataSourceNames?: string[];
  /** SEED id of the source picked at creation. Required for live-SQL dashboards. */
  sourceId?: string;
}

/* ── The catalog ─────────────────────────────────────────────────────────── */

export const MY_DASHBOARDS: Dashboard[] = [
  {
    id: 'p2p',
    name: 'Procurement (P2P)',
    description: 'Procure-to-Pay analytics — invoice processing, duplicate flags, compliance rate, and vendor spend tracking.',
    timeAgo: '2 hours ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'excel',
    dataSourceNames: ['Invoice_Master.xlsx', 'Vendor_Finance.xlsx'],
  },
  {
    id: 'grc',
    name: 'GRC Overview',
    description: 'Governance, risk & compliance — total risks, controls tested, deficiencies, and workflow automation.',
    timeAgo: '3 hours ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'sql',
    dataSourceNames: ['audit_controls_db'],
  },
  {
    id: 'o2c',
    name: 'Order to Cash (O2C)',
    description: 'Revenue & collections overview — orders fulfilled, revenue recognized, DSO, and customer insights.',
    timeAgo: '5 hours ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'query',
    dataSourceNames: ['revenue_query'],
  },
  {
    id: 's2c',
    name: 'Source to Contract (S2C)',
    description: 'Sourcing & contract management — active contracts, vendor scores, savings realized, and expiry tracking.',
    timeAgo: '1 day ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'combo',
    dataSourceNames: ['Invoice_Master.xlsx', 'PO_Register.csv', 'vendor_query', 'contract_db'],
  },
];

export const SHARED_DASHBOARDS: Dashboard[] = [
  {
    id: 'shared-1',
    name: 'Vendor Risk Assessment',
    description: 'Evaluation of vendor risk profiles across all business units.',
    timeAgo: '4 hours ago',
    creator: 'Sarah Johnson',
    accent: 'bg-brand-50 text-brand-700',
    sharedBy: 'Sarah Johnson',
  },
  {
    id: 'shared-2',
    name: 'SOX Compliance Tracker',
    description: 'End-to-end SOX compliance progress and control testing status.',
    timeAgo: '1 day ago',
    creator: 'Michael Chen',
    accent: 'bg-brand-50 text-brand-700',
    sharedBy: 'Michael Chen',
  },
  {
    id: 'shared-3',
    name: 'AP Duplicate Detection',
    description: 'Automated duplicate invoice detection across accounts payable.',
    timeAgo: '2 days ago',
    creator: 'David Martinez',
    accent: 'bg-brand-50 text-brand-700',
    sharedBy: 'David Martinez',
  },
];

/** The two worked examples in the "Sample Dashboards" strip. They open the
 *  'excel' and 'sql' dashboard definitions in DashboardView. */
export const SAMPLE_DASHBOARDS: Dashboard[] = [
  {
    id: 'excel',
    name: 'Excel Sample Example',
    description: 'Excel data quality — blank cells, duplicate rows, type mismatches, format errors, and sheet-level anomalies.',
    timeAgo: '30 minutes ago',
    creator: 'You',
    accent: 'bg-brand-50 text-brand-700',
    dataSource: 'excel',
    dataSourceNames: ['Invoice_Master.xlsx'],
  },
  {
    id: 'sql',
    name: 'Live SQL — Vendor Risk',
    description: 'Live database insights — vendor performance, invoice trends, risk distribution, and category-wise spend, sourced from Vendor Master (PostgreSQL).',
    timeAgo: 'Just now',
    creator: 'You',
    accent: 'bg-purple-50 text-purple-700',
    dataSource: 'sql',
    dataSourceNames: ['vendor_master_db'],
    sourceId: 'db-02',
  },
];

/** Every dashboard on the Dashboards page: the member's own, the two samples,
 *  and those shared with them. Runtime-created dashboards live in app state. */
export const DASHBOARD_CATALOG: Dashboard[] = [
  ...MY_DASHBOARDS,
  ...SAMPLE_DASHBOARDS,
  ...SHARED_DASHBOARDS,
];

/* ── Tags ────────────────────────────────────────────────────────────────── */

/** The tag shown on a dashboard card. 'file' covers Excel and CSV alike. */
export type DashboardTag = 'file' | 'query' | 'sql';

export const DASHBOARD_TAG_LABEL: Record<DashboardTag, string> = {
  file: 'Excel / CSV',
  query: 'Query',
  sql: 'SQL',
};

/**
 * The tags a dashboard carries. Prefers the explicit `dataSource`; for combo
 * dashboards (or legacy entries without it) each tag is inferred from the
 * individual source names. A dashboard with no source at all carries no tags.
 */
export function dashboardTags(d: Pick<Dashboard, 'dataSource' | 'dataSourceNames'>): DashboardTag[] {
  const tags = new Set<DashboardTag>();
  const ds = d.dataSource;
  if (ds === 'excel' || ds === 'csv') {
    tags.add('file');
  } else if (ds === 'sql' || ds === 'query') {
    tags.add(ds);
  } else {
    (d.dataSourceNames ?? []).forEach(name => {
      if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) tags.add('file');
      else if (name.includes('query')) tags.add('query');
      else tags.add('sql');
    });
  }
  return Array.from(tags);
}

/** How many dashboards in `list` carry `tag`. */
export function countByTag(list: Dashboard[], tag: DashboardTag): number {
  return list.filter(d => dashboardTags(d).includes(tag)).length;
}
