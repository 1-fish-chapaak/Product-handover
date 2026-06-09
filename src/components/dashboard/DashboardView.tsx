import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, Shield, Activity, TrendingUp, TrendingDown,
  Plus, Settings, Maximize2, FileText, DollarSign,
  XCircle, Clock, Sparkles, RefreshCw, ChevronDown,
  ShoppingCart, CreditCard, BarChart3,
  Package, Receipt, Handshake, ShieldCheck, Briefcase,
  Send, X, Mail, Copy, CheckCircle2, ArrowLeft,
  Download, Filter, Share2, Loader2,
  MoreVertical, Edit, Trash2, ChevronUp, Eye, EyeOff,
  Search, LineChart, AreaChart, ListChecks,
  Database, Link2, ArrowRight, Unlink,
  Bell, Columns,
  MessageSquare, Star, Upload, Layers, CloudUpload, Check,
  Hash, GripVertical, PieChart as PieChartIcon, LayoutGrid,
  Bold, Italic, Underline, MoveVertical, Palette, Type
} from 'lucide-react';
import Orb from '../shared/Orb';
import { useToast, type ToastType } from '../shared/Toast';
import { useCan } from '../../context/CurrentUserContext';
import Gated from '../shared/Gated';
import { useShare, rectFromEvent } from '../../context/ShareContext';
import { KpiTile } from '../shared/KpiTile';
import { AddCardModal } from './add-widget/AddCardModal';
// ─── Data model (table relationships + multi-table widgets) ───
import { MODEL_TABLES, DEFAULT_RELATIONSHIPS } from './model/modelData';
import type { Relationship, WidgetModelConfig, ModelFilter, ModelTable } from './model/relationshipTypes';
import { buildWidgetRows, distinctValues, colByName, tableById } from './model/joinEngine';
import RelationshipManagerModal from './model/RelationshipManagerModal';
import ModelChart from './model/ModelChart';
import { AddDataModal } from './AddDataModal';
import { WhiteDropdown } from './add-widget/WhiteDropdown';
import { ConfigurableChart } from './add-widget/ConfigurableChart';
import LegendSection from './add-widget/imports/LegendSection';
import TypographySection from './add-widget/imports/TypographySection-1760-98';
import ConditionalFormattingSection from './add-widget/imports/ConditionalFormattingSection';
import DataSeriesFormattingSection from './add-widget/imports/DataSeriesFormattingSection';
import { SEED, TYPE_META, formatDate } from '../data-sources/sources';
import { INTEGRATION_CONFIGS } from '../data-sources/datasetFiles';

// ─── Types ──────────────────────────────────────────────────────────────────

type DashboardId = 'p2p' | 'o2c' | 's2c' | 'grc' | 'excel' | 'sql';

interface KpiDef {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: string;
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface BarDatum {
  label: string;
  value: number;
}

interface ProgressDatum {
  label: string;
  value: number;
  color: string;
}

interface TableRow {
  cells: string[];
}

interface DashboardDef {
  id: DashboardId;
  name: string;
  icon: React.ElementType;
  accent: string;         // tailwind gradient from
  accentHue: number;      // for Orb
  subtitle: string;
  kpis: KpiDef[];
  donut?: { title: string; segments: DonutSegment[]; centerLabel?: string };
  bars?: { title: string; data: BarDatum[]; color: string };
  progress?: { title: string; data: ProgressDatum[] };
  lineTrend?: { title: string; data: number[]; labels: string[]; color: string };
  table: { title: string; headers: string[]; rows: TableRow[] };
}

// ─── Dashboard Data ─────────────────────────────────────────────────────────

const DASHBOARDS: DashboardDef[] = [
  {
    id: 'p2p',
    name: 'Procurement (P2P)',
    icon: ShoppingCart,
    accent: 'from-blue-500 to-cyan-500',
    accentHue: 210,
    subtitle: 'Procure-to-Pay analytics',
    kpis: [
      { title: 'Invoices Processed', value: '12,450', change: '+8.2%', trend: 'up', icon: Receipt, color: 'text-evidence-700 bg-evidence-50' },
      { title: 'Duplicate Flags', value: 23, change: '-12%', trend: 'down', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { title: 'Avg Processing Time', value: '1.8 days', change: '-0.3d', trend: 'down', icon: Clock, color: 'text-cyan-600 bg-cyan-50' },
      { title: 'Compliance Rate', value: '94.2%', change: '+1.4%', trend: 'up', icon: Shield, color: 'text-compliant bg-compliant-50' },
    ],
    donut: {
      title: 'Invoice Status',
      centerLabel: '12.4K',
      segments: [
        { label: 'Processed', value: 85, color: 'var(--color-evidence)' },
        { label: 'Pending', value: 10, color: 'var(--color-mitigated)' },
        { label: 'Flagged', value: 5, color: 'var(--color-risk)' },
      ],
    },
    bars: {
      title: 'Monthly Invoice Volume',
      color: 'var(--color-evidence)',
      data: [
        { label: 'Oct', value: 1820 },
        { label: 'Nov', value: 2150 },
        { label: 'Dec', value: 1940 },
        { label: 'Jan', value: 2380 },
        { label: 'Feb', value: 2100 },
        { label: 'Mar', value: 2060 },
      ],
    },
    table: {
      title: 'Invoice Records',
      headers: ['Invoice ID', 'Vendor', 'Amount', 'Date', 'Status', 'Department', 'Risk', 'Duplicate Match'],
      rows: [
        { cells: ['INV-005790', 'Acme Global Imaging', '₹11,853', '20-Mar-25', 'Pending Review', 'Operations', 'High', 'INV-005791'] },
        { cells: ['INV-025832', 'Korean Technologies', '₹4,564', '15-Dec-24', 'Under Review', 'Procurement', 'Medium', 'INV-025831'] },
        { cells: ['INV-007194', '3tones Letter Co.', '₹3,835', '31-Dec-24', 'Resolved', 'Finance', 'Low', 'None'] },
        { cells: ['INV-040083', 'Chintamani Paper Products', '₹3,410', '13-Dec-24', 'Pending Review', 'Operations', 'High', 'INV-040082'] },
        { cells: ['INV-027203', 'M Cargo Logistics', '₹1,457', '12-Jan-25', 'Auto-Resolved', 'Logistics', 'Low', 'None'] },
        { cells: ['INV-031456', 'TechParts Ltd', '₹8,920', '05-Feb-25', 'Flagged', 'IT', 'Critical', 'INV-031455'] },
        { cells: ['INV-018927', 'Global Supplies Inc', '₹6,340', '22-Jan-25', 'Resolved', 'Procurement', 'Low', 'INV-018926'] },
        { cells: ['INV-044521', 'Atlas Manufacturing', '₹15,200', '18-Mar-25', 'Under Review', 'Finance', 'High', 'INV-044520'] },
      ],
    },
  },
  {
    id: 'o2c',
    name: 'Order to Cash (O2C)',
    icon: CreditCard,
    accent: 'from-emerald-500 to-teal-500',
    accentHue: 160,
    subtitle: 'Revenue & collections overview',
    kpis: [
      { title: 'Orders Fulfilled', value: '8,920', change: '+5.1%', trend: 'up', icon: Package, color: 'text-compliant bg-compliant-50' },
      { title: 'Revenue Recognized', value: '$42.5M', change: '+12%', trend: 'up', icon: DollarSign, color: 'text-compliant bg-compliant-50' },
      { title: 'Disputed', value: 34, change: '+3', trend: 'up', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { title: 'DSO', value: '38 days', change: '-2d', trend: 'down', icon: Clock, color: 'text-teal-600 bg-teal-50' },
    ],
    donut: {
      title: 'Revenue by Region',
      centerLabel: '$42.5M',
      segments: [
        { label: 'North America', value: 45, color: 'var(--color-compliant)' },
        { label: 'Europe', value: 28, color: 'var(--color-evidence)' },
        { label: 'APAC', value: 18, color: 'var(--color-brand-500)' },
        { label: 'LATAM', value: 9, color: 'var(--color-mitigated)' },
      ],
    },
    bars: {
      title: 'Monthly Collections ($M)',
      color: 'var(--color-compliant)',
      data: [
        { label: 'Oct', value: 6.2 },
        { label: 'Nov', value: 7.1 },
        { label: 'Dec', value: 5.8 },
        { label: 'Jan', value: 7.9 },
        { label: 'Feb', value: 8.3 },
        { label: 'Mar', value: 7.2 },
      ],
    },
    table: {
      title: 'Invoice Records',
      headers: ['Invoice ID', 'Vendor', 'Amount', 'Date', 'Status', 'Department', 'Risk', 'Duplicate Match'],
      rows: [
        { cells: ['INV-009341', 'Pinnacle Inc', '₹9,230', '10-Feb-25', 'Under Review', 'Finance', 'Medium', 'INV-009340'] },
        { cells: ['INV-012890', 'Summit Group', '₹5,670', '28-Jan-25', 'Resolved', 'Operations', 'Low', 'None'] },
        { cells: ['INV-017654', 'MegaCorp LLC', '₹12,100', '05-Mar-25', 'Pending Review', 'Procurement', 'High', 'INV-017653'] },
        { cells: ['INV-021098', 'Enterprise Co', '₹7,450', '18-Feb-25', 'Flagged', 'IT', 'Critical', 'INV-021097'] },
        { cells: ['INV-033210', 'Atlas Partners', '₹4,890', '22-Mar-25', 'Auto-Resolved', 'Logistics', 'Low', 'None'] },
      ],
    },
  },
  {
    id: 's2c',
    name: 'Source to Contract (S2C)',
    icon: Handshake,
    accent: 'from-violet-500 to-purple-500',
    accentHue: 275,
    subtitle: 'Sourcing & contract management',
    kpis: [
      { title: 'Active Contracts', value: 234, change: '+18', trend: 'up', icon: FileText, color: 'text-violet-600 bg-violet-50' },
      { title: 'Expiring Soon', value: 12, change: '+4', trend: 'up', icon: Clock, color: 'text-high-700 bg-high-50' },
      { title: 'Vendor Score', value: '87%', change: '+2.3%', trend: 'up', icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
      { title: 'Savings Realized', value: '$2.1M', change: '+$340K', trend: 'up', icon: DollarSign, color: 'text-compliant bg-compliant-50' },
    ],
    bars: {
      title: 'Contract Value by Category',
      color: 'var(--color-brand-500)',
      data: [
        { label: 'IT', value: 8.2 },
        { label: 'MRO', value: 5.4 },
        { label: 'Logistics', value: 4.1 },
        { label: 'Prof. Svc', value: 3.6 },
        { label: 'Raw Mat.', value: 6.8 },
        { label: 'Facilities', value: 2.9 },
      ],
    },
    progress: {
      title: 'Vendor Compliance Scores',
      data: [
        { label: 'Acme Corp', value: 94, color: 'var(--color-compliant)' },
        { label: 'Global Supplies', value: 87, color: 'var(--color-brand-500)' },
        { label: 'TechParts Ltd', value: 72, color: 'var(--color-mitigated)' },
        { label: 'Office Essentials', value: 91, color: 'var(--color-compliant)' },
        { label: 'FastShip', value: 65, color: 'var(--color-risk)' },
      ],
    },
    table: {
      title: 'Invoice Records',
      headers: ['Invoice ID', 'Vendor', 'Amount', 'Date', 'Status', 'Department', 'Risk', 'Duplicate Match'],
      rows: [
        { cells: ['INV-045123', 'TechParts Ltd', '₹11,200', '12-Mar-25', 'Pending Review', 'IT', 'High', 'INV-045122'] },
        { cells: ['INV-038901', 'CloudHost Inc', '₹8,900', '01-Feb-25', 'Under Review', 'Operations', 'Medium', 'INV-038900'] },
        { cells: ['INV-029876', 'DataPipe Co', '₹24,000', '20-Jan-25', 'Resolved', 'Finance', 'Low', 'None'] },
        { cells: ['INV-052340', 'PrintWorks', '₹3,400', '15-Mar-25', 'Flagged', 'Procurement', 'Critical', 'INV-052339'] },
        { cells: ['INV-061201', 'SecureNet', '₹18,500', '28-Mar-25', 'Auto-Resolved', 'IT', 'Low', 'None'] },
      ],
    },
  },
  {
    id: 'grc',
    name: 'GRC Overview',
    icon: ShieldCheck,
    accent: 'from-rose-500 to-pink-500',
    accentHue: 340,
    subtitle: 'Governance, risk & compliance',
    kpis: [
      { title: 'Total Risks', value: 12, change: '+2', trend: 'up', icon: AlertTriangle, color: 'text-risk-700 bg-risk-50' },
      { title: 'Controls Tested', value: '14/24', change: '+3', trend: 'up', icon: Shield, color: 'text-evidence-700 bg-evidence-50' },
      { title: 'Deficiencies', value: 2, change: '-1', trend: 'down', icon: XCircle, color: 'text-risk-700 bg-risk-50' },
      { title: 'Workflow Runs', value: 156, change: '+23', trend: 'up', icon: Activity, color: 'text-pink-600 bg-pink-50' },
    ],
    donut: {
      title: 'Risk Severity Distribution',
      centerLabel: '12',
      segments: [
        { label: 'Critical', value: 2, color: 'var(--color-risk)' },
        { label: 'High', value: 5, color: 'var(--color-high)' },
        { label: 'Medium', value: 3, color: 'var(--color-mitigated)' },
        { label: 'Low', value: 2, color: 'var(--color-compliant)' },
      ],
    },
    bars: {
      title: 'Control Effectiveness',
      color: 'var(--color-risk)',
      data: [
        { label: 'Access', value: 92 },
        { label: 'Change', value: 85 },
        { label: 'SOD', value: 78 },
        { label: 'Recon', value: 95 },
        { label: 'Report', value: 88 },
        { label: 'Auth', value: 70 },
      ],
    },
    progress: {
      title: 'Audit Completion',
      data: [
        { label: 'SOX FY26', value: 58, color: 'var(--color-risk)' },
        { label: 'Internal Audit Q1', value: 82, color: 'var(--color-compliant)' },
        { label: 'Vendor Audit', value: 35, color: 'var(--color-mitigated)' },
      ],
    },
    table: {
      title: 'Invoice Records',
      headers: ['Invoice ID', 'Vendor', 'Amount', 'Date', 'Status', 'Department', 'Risk', 'Duplicate Match'],
      rows: [
        { cells: ['INV-071245', 'Acme Global Imaging', '₹15,800', '25-Mar-25', 'Pending Review', 'Operations', 'High', 'INV-071244'] },
        { cells: ['INV-068903', 'Korean Technologies', '₹6,230', '08-Feb-25', 'Resolved', 'Procurement', 'Low', 'None'] },
        { cells: ['INV-075432', '3tones Letter Co.', '₹9,100', '19-Mar-25', 'Under Review', 'Finance', 'Medium', 'INV-075431'] },
        { cells: ['INV-082109', 'M Cargo Logistics', '₹2,870', '02-Apr-25', 'Flagged', 'Logistics', 'Critical', 'INV-082108'] },
        { cells: ['INV-059876', 'Global Supplies Inc', '₹7,650', '14-Jan-25', 'Auto-Resolved', 'IT', 'Low', 'None'] },
      ],
    },
  },
  {
    id: 'excel',
    name: 'Excel Sample Example',
    icon: FileText,
    accent: 'from-emerald-500 to-green-500',
    accentHue: 140,
    subtitle: 'Excel data quality & insights',
    kpis: [
      { title: 'Total Rows', value: '24,806', change: '', trend: 'up', icon: Layers, color: 'text-evidence-700 bg-evidence-50' },
      { title: 'Blank Cells', value: 342, change: '', trend: 'up', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { title: 'Duplicate Rows', value: 89, change: '', trend: 'up', icon: Copy, color: 'text-risk-700 bg-risk-50' },
      { title: 'Data Completeness', value: '96.8%', change: '', trend: 'up', icon: Shield, color: 'text-compliant bg-compliant-50' },
    ],
    donut: {
      title: 'Data Quality Breakdown',
      centerLabel: '24.8K',
      segments: [
        { label: 'Clean', value: 92, color: 'var(--color-compliant)' },
        { label: 'Blanks', value: 4, color: 'var(--color-mitigated)' },
        { label: 'Duplicates', value: 2, color: 'var(--color-risk)' },
        { label: 'Type Errors', value: 2, color: 'var(--color-high)' },
      ],
    },
    lineTrend: {
      title: 'Issues by Type',
      data: [48, 35, 42, 29, 21, 17],
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      color: 'var(--color-risk)',
    },
    progress: {
      title: 'Row Count by Sheet',
      data: [
        { label: 'Invoices', value: 82, color: 'var(--color-evidence)' },
        { label: 'Vendors', value: 65, color: 'var(--color-compliant)' },
        { label: 'Payments', value: 48, color: 'var(--color-brand-500)' },
        { label: 'Contracts', value: 35, color: 'var(--color-mitigated)' },
      ],
    },
    bars: {
      title: 'Issues by Sheet',
      color: 'var(--color-evidence)',
      data: [
        { label: 'Invoices', value: 142 },
        { label: 'Vendors', value: 87 },
        { label: 'Payments', value: 54 },
        { label: 'Contracts', value: 38 },
        { label: 'Assets', value: 21 },
        { label: 'Summary', value: 9 },
      ],
    },
    table: {
      title: 'Excel Issues Log',
      headers: ['Row', 'Sheet', 'Column', 'Issue Type', 'Severity', 'Cell Value', 'Expected', 'Status'],
      rows: [
        { cells: ['Row 142', 'Invoices', 'Amount', 'Type Mismatch', 'High', '"12,500 INR"', 'Number', 'Open'] },
        { cells: ['Row 87', 'Vendors', 'Email', 'Blank Cell', 'Medium', '—', 'Email', 'Open'] },
        { cells: ['Row 203', 'Invoices', 'Date', 'Format Error', 'High', '13/25/2025', 'DD-MM-YYYY', 'Open'] },
        { cells: ['Row 56', 'Payments', 'Invoice ID', 'Duplicate', 'Critical', 'INV-005790', 'Unique', 'Flagged'] },
        { cells: ['Row 312', 'Invoices', 'Vendor Name', 'Blank Cell', 'Medium', '—', 'Text', 'Open'] },
        { cells: ['Row 441', 'Contracts', 'Expiry Date', 'Past Date', 'Low', '15-Jan-2024', 'Future Date', 'Reviewed'] },
        { cells: ['Row 98', 'Vendors', 'GST Number', 'Format Error', 'High', 'ABCDE1234Z', '15-char GSTIN', 'Open'] },
        { cells: ['Row 167', 'Payments', 'Amount', 'Outlier', 'Medium', '₹9,84,500', 'Range 1K-50K', 'Flagged'] },
      ],
    },
  },
  // ─── Live SQL — Vendor Risk ─────────────────────────────────────────────
  // Pre-bound to db-02 (Vendor Master · PostgreSQL) via SEED_DASHBOARD_SOURCE.
  // All field labels below come from DB_SCHEMAS['db-02'] so when the user
  // edits a widget the DB tree shows the same column names that the dashboard
  // already plots — one consistent dataset across every surface.
  {
    id: 'sql',
    name: 'Live SQL — Vendor Risk',
    icon: Database,
    accent: 'from-violet-500 to-fuchsia-500',
    accentHue: 280,
    subtitle: 'Live SQL — vendor performance, invoice trends, risk distribution',
    kpis: [
      { title: 'Active Vendors',       value: '24,180', change: '+312',  trend: 'up',   icon: Briefcase,     color: 'text-evidence-700 bg-evidence-50' },
      { title: 'Outstanding Invoices', value: '1.84M',  change: '+18%',  trend: 'up',   icon: Receipt,       color: 'text-brand-700 bg-brand-50' },
      { title: 'Avg Risk Score',       value: 42,       change: '-3',    trend: 'down', icon: AlertTriangle, color: 'text-high-700 bg-high-50' },
      { title: 'Avg Days to Pay',      value: '38d',    change: '-4d',   trend: 'down', icon: Clock,         color: 'text-compliant bg-compliant-50' },
    ],
    donut: {
      title: 'Vendors by Region',
      centerLabel: '24.2K',
      segments: [
        { label: 'North',   value: 38, color: 'var(--color-brand-500)' },
        { label: 'South',   value: 24, color: 'var(--color-evidence)' },
        { label: 'East',    value: 19, color: 'var(--color-compliant)' },
        { label: 'West',    value: 12, color: 'var(--color-mitigated)' },
        { label: 'Central', value: 7,  color: 'var(--color-high)' },
      ],
    },
    lineTrend: {
      title: 'Monthly Invoice Volume',
      data: [1480, 1620, 1560, 1820, 1940, 2150],
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      color: 'var(--color-brand-500)',
    },
    progress: {
      title: 'Top Categories by Spend',
      data: [
        { label: 'Hardware',    value: 88, color: 'var(--color-brand-500)' },
        { label: 'Services',    value: 72, color: 'var(--color-evidence)' },
        { label: 'Logistics',   value: 54, color: 'var(--color-compliant)' },
        { label: 'Consulting',  value: 41, color: 'var(--color-mitigated)' },
        { label: 'Maintenance', value: 28, color: 'var(--color-high)' },
      ],
    },
    bars: {
      title: 'Department-wise Spend (₹M)',
      color: 'var(--color-brand-500)',
      data: [
        { label: 'Procurement', value: 84 },
        { label: 'Finance',     value: 62 },
        { label: 'IT',          value: 58 },
        { label: 'Operations',  value: 47 },
        { label: 'HR',          value: 24 },
        { label: 'Logistics',   value: 38 },
      ],
    },
    table: {
      title: 'Vendor Records',
      // Headers match DB_SCHEMAS['db-02'].public.vendors column labels.
      headers: ['Vendor ID', 'Vendor Name', 'Region', 'Category', 'Status', 'Risk Score', 'Credit Limit', 'Outstanding Amount'],
      rows: [
        { cells: ['V-001', 'Acme Global Imaging',     'North',   'Hardware',    'Active',  '78', '₹12,00,000', '₹4,82,000'] },
        { cells: ['V-002', 'Korean Technologies',     'East',    'Services',    'Active',  '71', '₹8,50,000',  '₹3,16,000'] },
        { cells: ['V-003', 'Chintamani Paper Products','South',  'Logistics',   'Pending', '45', '₹4,00,000',  '₹1,12,000'] },
        { cells: ['V-004', 'M Cargo Logistics',       'West',    'Logistics',   'Active',  '32', '₹6,20,000',  '₹  84,500'] },
        { cells: ['V-005', '3tones Letter Co.',       'Central', 'Services',    'Active',  '28', '₹2,50,000',  '₹  41,200'] },
        { cells: ['V-006', 'TechParts Ltd',           'North',   'Hardware',    'Hold',    '82', '₹15,00,000', '₹6,90,000'] },
        { cells: ['V-007', 'Global Supplies Inc',     'East',    'Maintenance', 'Active',  '54', '₹5,40,000',  '₹2,28,000'] },
        { cells: ['V-008', 'Atlas Manufacturing',     'South',   'Hardware',    'Pending', '—',  '₹0',          '₹0'] },
      ],
    },
  },
];

// ─── Daily Digest Data ───────────────────────────────────────────────────────

const DAILY_DIGESTS: Record<DashboardId, Array<{ type: 'change' | 'alert' | 'improvement' | 'new'; text: string; time: string }>> = {
  p2p: [
    { type: 'alert', text: '3 new duplicate invoice flags detected overnight — Acme Corp (2), Global Supplies (1)', time: '6h ago' },
    { type: 'change', text: 'Compliance rate improved from 93.1% to 94.2% after vendor master cleanup', time: '12h ago' },
    { type: 'improvement', text: 'Average processing time dropped to 1.8 days (was 2.1 days last week)', time: '1d ago' },
    { type: 'new', text: 'New vendor "Atlas Manufacturing" onboarded — pending KYC verification', time: '1d ago' },
  ],
  o2c: [
    { type: 'alert', text: '2 high-value invoices ($180K+) pending approval beyond SLA', time: '3h ago' },
    { type: 'change', text: 'DSO improved from 42 to 38 days after collection drive', time: '8h ago' },
    { type: 'improvement', text: 'Disputed orders down 15% vs last month', time: '1d ago' },
    { type: 'new', text: 'Revenue recognition check flagged 1 timing discrepancy in Q4 entries', time: '2d ago' },
  ],
  s2c: [
    { type: 'alert', text: '4 contracts expiring within 30 days — 2 are high-value (>$500K)', time: '4h ago' },
    { type: 'change', text: 'Vendor risk scores updated — 3 vendors downgraded to Medium', time: '1d ago' },
    { type: 'improvement', text: 'Cost savings tracking: $2.8M realized YTD vs $2.4M target', time: '1d ago' },
    { type: 'new', text: 'New compliance clause added to template contracts per legal directive', time: '3d ago' },
  ],
  grc: [
    { type: 'alert', text: 'DEF-002 remediation due in 6 days — currently "in progress" status', time: '2h ago' },
    { type: 'change', text: '3 controls tested since yesterday — SOX progress now at 58%', time: '6h ago' },
    { type: 'improvement', text: 'Workflow automation saved 45 person-hours this month', time: '1d ago' },
    { type: 'new', text: 'New risk RSK-012 identified in R2R process — GL balance discrepancy', time: '2d ago' },
  ],
  excel: [],
  sql: [
    { type: 'alert', text: '5 vendors flagged for risk-score increase past threshold (≥70) — Acme Global, Korean Tech, +3', time: '4h ago' },
    { type: 'change', text: 'Monthly invoice volume up 18% MoM on public.invoices — driven by Procurement department', time: '8h ago' },
    { type: 'improvement', text: 'Avg days-to-pay dropped to 38 days (was 42) after early-payment discount uptake', time: '1d ago' },
    { type: 'new', text: 'New vendor "Atlas Manufacturing" added to public.vendors — KYC pending', time: '2d ago' },
  ],
};

// ─── AI Summaries for each dashboard ────────────────────────────────────────

const DASHBOARD_SUMMARIES: Record<DashboardId, string> = {
  p2p: "P2P saw 3 new duplicate flags overnight (Acme Corp & Global Supplies), but compliance rate improved to 94.2% after vendor master cleanup. Processing time is trending down to 1.8 days. One new vendor (Atlas Manufacturing) is pending KYC — recommend expediting before next payment batch.",
  o2c: "2 high-value invoices ($180K+) exceeded SLA for approval — escalation needed. DSO improved to 38 days after collection drive. Revenue recognition check flagged a Q4 timing discrepancy that needs review before close. Disputed orders down 15% — positive trend continuing.",
  s2c: "4 contracts expiring within 30 days, 2 are high-value (>$500K) — renegotiation must start this week. Cost savings are tracking ahead at $2.8M vs $2.4M target. 3 vendors downgraded to Medium risk after score refresh. Legal added new compliance clause to templates.",
  grc: "Material weakness DEF-002 is 6 days from deadline — remediation evidence pending. SOX progress moved to 58% after 3 controls tested yesterday. Workflow automation saved 45 person-hours this month. New risk RSK-012 identified in R2R — GL balance discrepancy across subsidiaries.",
  excel: "",
  sql: "Vendor Master DB shows 24,180 active vendors across 5 regions, with North leading at 38%. Outstanding invoices total 1.84M across public.invoices, with avg days-to-pay improving to 38d. 5 vendors crossed the 70+ risk-score threshold this week and need review. Hardware and Services categories together account for 54% of spend.",
};

const SHARE_EMAIL_TEMPLATES: Record<DashboardId, { subject: string; body: string }> = {
  p2p: {
    subject: 'P2P Audit Alert Summary — Action Required',
    body: `Hi Team,\n\nHere's today's P2P audit summary from Auditify Copilot:\n\nALERTS\n• 3 new duplicate invoice flags detected overnight — Acme Corp (2), Global Supplies (1)\n• New vendor "Atlas Manufacturing" onboarded — KYC verification pending\n\nIMPROVEMENTS\n• Compliance rate improved from 93.1% → 94.2%\n• Avg processing time dropped to 1.8 days (was 2.1 days)\n\nKEY METRICS\n• Invoices processed: 12,450 (+8.2%)\n• Duplicate flags: 23 (-12%)\n• Compliance rate: 94.2% (+1.4%)\n\nRECOMMENDED ACTIONS\n1. Review & assign the 3 new duplicate flags before payment batch\n2. Expedite KYC verification for Atlas Manufacturing\n3. Continue vendor master data cleanup — showing strong results\n\nGenerated by Auditify Copilot — AI-Powered Internal Audit Platform`,
  },
  o2c: {
    subject: 'O2C Audit Alert Summary — 2 SLA Breaches',
    body: `Hi Team,\n\nHere's today's O2C audit summary from Auditify Copilot:\n\nALERTS\n• 2 high-value invoices ($180K+) pending approval beyond SLA\n• Revenue recognition timing discrepancy flagged in Q4 entries\n\nIMPROVEMENTS\n• DSO improved from 42 → 38 days\n• Disputed orders down 15% vs last month\n\nRECOMMENDED ACTIONS\n1. Escalate the 2 SLA-breached invoices immediately\n2. Review the Q4 revenue timing discrepancy before period close\n3. Continue collection drive momentum\n\nGenerated by Auditify Copilot`,
  },
  s2c: {
    subject: 'S2C Alert — 4 Contracts Expiring Within 30 Days',
    body: `Hi Team,\n\nHere's today's S2C audit summary from Auditify Copilot:\n\nALERTS\n• 4 contracts expiring within 30 days — 2 high-value (>$500K)\n• 3 vendors downgraded to Medium risk\n\nIMPROVEMENTS\n• Cost savings: $2.8M realized vs $2.4M target (117%)\n• New compliance clause added to contract templates\n\nRECOMMENDED ACTIONS\n1. Start renegotiation on the 2 high-value expiring contracts this week\n2. Review the 3 downgraded vendors' risk mitigation plans\n\nGenerated by Auditify Copilot`,
  },
  grc: {
    subject: 'GRC Alert — DEF-002 Remediation Due in 6 Days',
    body: `Hi Team,\n\nHere's today's GRC audit summary from Auditify Copilot:\n\nCRITICAL\n• Material weakness DEF-002 remediation due in 6 days\n• New risk RSK-012 identified — GL balance discrepancy\n\nPROGRESS\n• SOX audit progress: 58% (14/24 controls tested)\n• 3 controls tested since yesterday\n• Workflow automation saved 45 person-hours this month\n\nRECOMMENDED ACTIONS\n1. Escalate DEF-002 to ensure Mar 31 deadline is met\n2. Assign controls for RSK-012 in R2R process\n3. Prioritize remaining 10 untested controls\n\nGenerated by Auditify Copilot`,
  },
  excel: {
    subject: 'Excel Data Quality Report — Issues Found',
    body: `Hi Team,\n\nHere's the Excel data quality report from Auditify:\n\nFILE: Invoice_Master.xlsx\n• Total rows: 24,806 across 6 sheets\n• Blank cells: 342\n• Duplicate rows: 89\n• Type mismatches: 47\n• Data completeness: 96.8%\n\nTOP ISSUES\n1. 142 issues in Invoices sheet — mostly type mismatches in Amount column\n2. 87 issues in Vendors sheet — missing email addresses\n3. Date format inconsistencies in 23 rows\n\nGenerated by Auditify`,
  },
  sql: {
    subject: 'Live SQL — Vendor Risk Snapshot',
    body: `Hi Team,\n\nHere's today's Vendor Risk snapshot from Auditify Copilot, sourced live from Vendor Master (PostgreSQL):\n\nALERTS\n• 5 vendors crossed the 70+ risk-score threshold — review needed before next payment batch\n• Atlas Manufacturing pending KYC verification\n\nMETRICS\n• Active vendors: 24,180\n• Outstanding invoices: 1.84M\n• Avg risk score: 42\n• Avg days-to-pay: 38d (improved from 42d)\n\nTOP CATEGORIES BY SPEND\n1. Hardware\n2. Services\n3. Logistics\n\nGenerated by Auditify Copilot — Live SQL`,
  },
};

// ─── Alerts Panel Component ─────────────────────────────────────────────────

function IRAInlineSummary({ dashboardId }: { dashboardId: DashboardId }) {
  const summary = AI_SUMMARIES[dashboardId];

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="p-5 rounded-xl border border-brand-200 bg-canvas-elevated">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-50">
              <Sparkles size={13} className="text-brand-600" />
            </div>
            <span className="text-[0.75rem] font-bold text-brand-700 uppercase tracking-wide">IRA Summary</span>
          </div>
          <Sparkles size={13} className="text-brand-500" />
        </div>
        <p className="text-[0.8125rem] leading-[1.65] text-ink-800">
          {summary}
        </p>
      </div>
    </div>
  );
}

// ─── IRA Summary texts per dashboard ────────────────────────────────────────

const AI_SUMMARIES: Record<DashboardId, string> = {
  p2p: 'P2P saw 3 new duplicate flags overnight (Acme Corp & Global Supplies), but compliance rate improved to 94.2% after vendor master cleanup. Processing time is trending down to 1.8 days. One new vendor (Atlas Manufacturing) is pending KYC — recommend expediting before next payment batch.',
  o2c: 'DSO improved by 2 days to 38 days. 5 customers account for 65% of outstanding receivables totalling ₹4.2Cr. Dispute rate trending upward in APAC region — 12 new disputes this week. Cash application automation rate hit 91%.',
  s2c: '12 contracts expire within 30 days across 3 business units. Vendor TechParts Ltd compliance score dropped below 75% threshold. 4 contracts pending legal review — recommend prioritizing the ₹2.1Cr IT services renewal.',
  grc: '2 critical risks in P2P have zero controls mapped. SOD violation detected in AP module — user JSmith has both invoice approval and payment release access. 3 audit findings from Q1 remain open past remediation deadline.',
  excel: '',
  sql: 'Vendor Master DB carries 24,180 active vendors across 5 regions. 5 vendors crossed the 70+ risk-score threshold this week — review before next payment batch. Avg days-to-pay improved to 38d after the early-payment discount drive. Hardware + Services account for 54% of spend; Procurement department drove an 18% MoM uplift in invoice volume.',
};

function EmptyAlertsPanel() {
  const [expanded, setExpanded] = useState(true);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl mb-5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-light/50">
        <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-2 cursor-pointer">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-[0.8125rem] font-semibold text-text">Alerts & Daily Digest</span>
          <span className="text-[0.75rem] bg-canvas-elevated text-ink-400 px-2 py-0.5 rounded-full font-bold">0 alerts</span>
          <span className="text-[0.75rem] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">AI Summary</span>
          <ChevronDown size={14} className={`text-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold text-ink-400 bg-canvas-elevated cursor-default opacity-60">
          <Send size={11} /> Share with Team
        </button>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 py-8 flex flex-col items-center text-center">
              <div className="size-10 rounded-xl bg-canvas-elevated flex items-center justify-center mb-3">
                <Sparkles size={18} className="text-ink-300" />
              </div>
              <p className="text-[0.8125rem] font-medium text-ink-500 mb-1">No alerts yet</p>
              <p className="text-[0.75rem] text-ink-400 max-w-xs">Alerts and AI-generated summaries will appear here once your dashboard has data.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AlertsPanel({ dashboardId }: { dashboardId: DashboardId }) {
  const { addToast } = useToast();
  const { can } = useCan();
  const [expanded, setExpanded] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [emailGenerating, setEmailGenerating] = useState(false);
  const [emailGenerated, setEmailGenerated] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [recipient, setRecipient] = useState('');
  const items = DAILY_DIGESTS[dashboardId];
  const summary = DASHBOARD_SUMMARIES[dashboardId];
  const alertCount = items.filter(i => i.type === 'alert').length;

  const typeIcons = { change: RefreshCw, alert: AlertTriangle, improvement: TrendingUp, new: Plus };
  const typeColors = {
    change: 'text-evidence-700 bg-evidence-50',
    alert: 'text-high-700 bg-high-50',
    improvement: 'text-compliant bg-compliant-50',
    new: 'text-purple-600 bg-purple-50'
  };

  const handleShareClick = () => {
    setShowShareModal(true);
    setEmailGenerated(false);
    setEmailGenerating(false);
    setEmailCopied(false);
    setRecipient('');
  };

  const handleGenerateEmail = () => {
    setEmailGenerating(true);
    setTimeout(() => {
      setEmailGenerating(false);
      setEmailGenerated(true);
    }, 2000);
  };

  const handleSendEmail = () => {
    setShowShareModal(false);
    addToast({ message: `Alert summary sent to ${recipient || 'team'}`, type: 'success' });
  };

  const handleCopyEmail = () => {
    setEmailCopied(true);
    addToast({ message: 'Email content copied to clipboard', type: 'success' });
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const emailTemplate = SHARE_EMAIL_TEMPLATES[dashboardId];

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl mb-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light/50">
          <button onClick={() => setExpanded(p => !p)} className="flex items-center gap-2 cursor-pointer">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary-medium">
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="text-[0.8125rem] font-semibold text-text">Alerts & Daily Digest</span>
            {alertCount > 0 && <span className="text-[0.75rem] bg-risk-50 text-risk-700 px-2 py-0.5 rounded-full font-bold">{alertCount} alert{alertCount > 1 ? 's' : ''}</span>}
            <span className="text-[0.75rem] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">AI Summary</span>
            <ChevronDown size={14} className={`text-text-muted transition-transform ${expanded ? '' : '-rotate-90'}`} />
          </button>
          {can('db_share') && (
            <button onClick={handleShareClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer">
              <Send size={11} /> Share with Team
            </button>
          )}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              {/* IRA Summary — matches Working folder design */}
              <IRAInlineSummary dashboardId={dashboardId} />

              {/* Alert items */}
              <div className="px-5 pb-4 space-y-2">
                {items.map((item, i) => {
                  const Icon = typeIcons[item.type];
                  const color = typeColors[item.type];
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ${item.type === 'alert' ? 'bg-high-50/50 border border-high/50' : 'hover:bg-surface-2'}`}>
                      <div className={`p-1.5 rounded-lg shrink-0 ${color}`}><Icon size={12} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.75rem] text-text leading-relaxed">{item.text}</div>
                        <div className="text-[0.75rem] text-text-muted mt-0.5">{item.time}</div>
                      </div>
                      {item.type === 'alert' && (
                        <span className="text-[0.75rem] font-bold text-high-700 bg-high-50 px-1.5 py-0.5 rounded-full shrink-0">Action needed</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Share Email Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-border-light flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl"><Mail size={16} /></div>
                  <div>
                    <h3 className="text-[0.9375rem] font-semibold text-text">Share Alert Summary</h3>
                    <p className="text-[0.75rem] text-text-muted">AI-generated email ready to send</p>
                  </div>
                </div>
                <button onClick={() => setShowShareModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                  <X size={16} className="text-text-muted" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Recipient */}
                <div>
                  <label className="text-[0.75rem] font-semibold text-text-muted block mb-1.5">Send to</label>
                  <input
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="e.g., karan.mehta@company.com, sneha.desai@company.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-border-light text-[0.8125rem] text-text focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>

                {/* Generate button */}
                {!emailGenerated && !emailGenerating && (
                  <button onClick={handleGenerateEmail}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-lg text-[0.8125rem] font-semibold transition-all cursor-pointer">
                    <Sparkles size={15} /> Generate AI Email
                  </button>
                )}

                {/* Generating animation */}
                {emailGenerating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="inline-block mb-3">
                      <Sparkles size={24} className="text-primary" />
                    </motion.div>
                    <div className="text-[0.8125rem] font-medium text-text mb-1">Generating email content...</div>
                    <div className="text-[0.75rem] text-text-muted">Summarizing alerts, metrics, and recommended actions</div>
                    {/* Progress bar */}
                    <div className="mt-3 h-1.5 bg-surface-3 rounded-full overflow-hidden max-w-xs mx-auto">
                      <motion.div initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-primary to-primary-medium rounded-full" />
                    </div>
                  </motion.div>
                )}

                {/* Generated email preview */}
                {emailGenerated && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[0.75rem] font-semibold text-text-muted">Generated Email</label>
                      <button onClick={handleCopyEmail} className="flex items-center gap-1 text-[0.75rem] font-medium text-primary hover:underline cursor-pointer">
                        {emailCopied ? <><CheckCircle2 size={10} /> Copied!</> : <><Copy size={10} /> Copy</>}
                      </button>
                    </div>
                    {/* Subject */}
                    <div className="px-3 py-2 bg-surface-2 rounded-t-xl border border-border-light border-b-0">
                      <span className="text-[0.75rem] text-text-muted font-medium">Subject: </span>
                      <span className="text-[0.75rem] font-semibold text-text">{emailTemplate.subject}</span>
                    </div>
                    {/* Body */}
                    <div className="px-4 py-3 bg-white rounded-b-xl border border-border-light max-h-[250px] overflow-y-auto">
                      <pre className="text-[0.75rem] text-text leading-relaxed whitespace-pre-wrap font-sans">{emailTemplate.body}</pre>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              {emailGenerated && (
                <div className="px-5 py-4 border-t border-border-light flex items-center justify-between shrink-0">
                  <button onClick={() => { setEmailGenerated(false); setEmailGenerating(false); }}
                    className="px-4 py-2 text-[0.75rem] font-medium text-text-secondary hover:bg-surface-2 rounded-lg transition-colors cursor-pointer">
                    Regenerate
                  </button>
                  <button onClick={handleSendEmail}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-lg text-[0.8125rem] font-semibold transition-all cursor-pointer">
                    <Send size={13} /> Send Email
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="flex h-full animate-pulse">
      <div className="w-[200px] shrink-0 p-4 space-y-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-10 skeleton skeleton-card rounded-lg" />)}
      </div>
      <div className="flex-1 px-8 py-8">
        <div className="h-6 w-48 skeleton skeleton-title mb-2" />
        <div className="h-4 w-64 skeleton skeleton-text mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 skeleton skeleton-card" />)}
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[1, 2].map(i => <div key={i} className="h-56 skeleton skeleton-card" />)}
        </div>
        <div className="h-48 skeleton skeleton-card" />
      </div>
    </div>
  );
}

// ─── Drop Zone Component ─────────────────────────────────────────────────────

function DropZone({ label, placeholder, active, onDragOver, onDragLeave, onDrop, fields, getLabel, onRemove, showAgg, yAggs, aggDropdownOpen, setAggDropdownOpen, setYAggs, className }: {
  label: string;
  placeholder: string;
  active: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  fields: string[];
  getLabel: (id: string) => string;
  onRemove: (id: string) => void;
  showAgg?: boolean;
  yAggs?: Record<string, string>;
  aggDropdownOpen?: string | null;
  setAggDropdownOpen?: (v: string | null) => void;
  setYAggs?: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-dashed px-2.5 py-2 transition-all duration-200 min-h-[40px] flex items-center ${
        active ? 'border-brand-600 bg-brand-50' : 'border-ink-300 bg-white hover:border-brand-600 hover:bg-brand-50/30'
      } ${className || ''}`}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(e); }}
    >
      {fields.length === 0 ? (
        <div className="flex items-center gap-2">
          <svg className="size-3.5 text-ink-300 shrink-0" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1"><line x1="4" y1="3" x2="4" y2="3.01" strokeLinecap="round" /><line x1="7" y1="3" x2="7" y2="3.01" strokeLinecap="round" /><line x1="4" y1="7" x2="4" y2="7.01" strokeLinecap="round" /><line x1="7" y1="7" x2="7" y2="7.01" strokeLinecap="round" /><line x1="4" y1="11" x2="4" y2="11.01" strokeLinecap="round" /><line x1="7" y1="11" x2="7" y2="11.01" strokeLinecap="round" /></svg>
          <span className="text-[0.75rem] text-ink-400">{placeholder}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          {fields.map(id => (
            <div key={id} className="inline-flex items-center h-[28px] bg-brand-50 border border-brand-600/30 rounded px-2.5 gap-1.5 shrink-0">
              <span className="text-[0.75rem] font-medium text-ink-900 whitespace-nowrap">{getLabel(id)}</span>
              {showAgg && yAggs && setAggDropdownOpen && setYAggs && (
                <div className="relative">
                  <button
                    onClick={() => setAggDropdownOpen(aggDropdownOpen === id ? null : id)}
                    className="inline-flex items-center gap-0.5 px-1.5 h-[20px] rounded bg-brand-100 border border-brand-200 text-[0.625rem] font-bold text-brand-700 cursor-pointer hover:bg-brand-200/50 transition-colors"
                  >
                    {AGG_OPTIONS.find(a => a.value === (yAggs[id] || 'count_d'))?.symbol || '#'} {AGG_OPTIONS.find(a => a.value === (yAggs[id] || 'count_d'))?.label || 'Count Distinct'}
                    <ChevronDown size={9} />
                  </button>
                  {aggDropdownOpen === id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setAggDropdownOpen(null)} />
                      <div className="absolute top-full right-0 mt-1 z-40 bg-white border border-canvas-border rounded-lg shadow-xl py-1 min-w-[130px]">
                        {AGG_OPTIONS.map(a => (
                          <button
                            key={a.value}
                            onClick={() => { setYAggs(prev => ({ ...prev, [id]: a.value })); setAggDropdownOpen(null); }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-[0.6875rem] transition-colors cursor-pointer ${
                              yAggs[id] === a.value ? 'text-brand-700 bg-brand-50' : 'text-ink-600 hover:bg-brand-50/50'
                            }`}
                          >
                            <span className="w-4 text-center font-bold">{a.symbol}</span>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <button onClick={() => onRemove(id)} className="p-0.5 rounded hover:bg-ink-900/10 transition-colors cursor-pointer"><X size={12} className="text-ink-500 hover:text-red-500" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Format Section Helpers ──────────────────────────────────────────────────

function FmtSection({ title, icon, open, onToggle, children }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-canvas-border overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-brand-50 to-white border-b border-canvas-border/50 hover:from-brand-100/50 hover:to-white transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-brand-600">{icon}</span>
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-ink-900">{title}</span>
        </div>
        <ChevronDown size={14} className={`text-brand-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="p-2.5 bg-canvas">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BIUButtons({ bold, italic, underline, onBold, onItalic, onUnderline }: {
  bold: boolean; italic: boolean; underline: boolean;
  onBold: () => void; onItalic: () => void; onUnderline: () => void;
}) {
  return (
    <div className="flex items-center bg-canvas-elevated rounded-md border border-canvas-border overflow-hidden">
      {[
        { label: 'Bold', active: bold, onClick: onBold, cls: 'font-bold' },
        { label: 'Italic', active: italic, onClick: onItalic, cls: 'italic' },
        { label: 'Underline', active: underline, onClick: onUnderline, cls: 'underline' },
      ].map((btn, i) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-colors cursor-pointer ${i < 2 ? 'border-r border-canvas-border' : ''} ${
            btn.active ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-brand-50'
          }`}
        >
          <span className={`text-[0.75rem] ${btn.cls}`}>{btn.label.charAt(0)}</span>
          <span className="text-[0.625rem] font-medium">{btn.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Add Widget Modal ────────────────────────────────────────────────────────

interface ChartTypeDef {
  id: string;
  title: string;
  icon: React.ElementType;
}

const CHART_TYPES: ChartTypeDef[] = [
  { id: 'kpi', title: 'KPI Cards', icon: BarChart3 },
  { id: 'pie', title: 'Pie Chart', icon: BarChart3 },
  { id: 'line', title: 'Line Chart', icon: LineChart },
  { id: 'area', title: 'Area Chart', icon: AreaChart },
  { id: 'stacked-bar', title: 'Stacked Bar Chart', icon: BarChart3 },
  { id: 'clustered-bar', title: 'Clustered Bar Chart', icon: BarChart3 },
  { id: 'clustered-col', title: 'Clustered Column Chart', icon: BarChart3 },
  { id: 'stacked-col', title: 'Stacked Column Chart', icon: BarChart3 },
  { id: 'line-clustered', title: 'Line & Clustered Column', icon: LineChart },
  { id: 'line-stacked', title: 'Line & Stacked Column', icon: LineChart },
  { id: 'scatter', title: 'Scatter Chart', icon: TrendingUp },
  { id: 'waterfall', title: 'Waterfall Chart', icon: TrendingUp },
  { id: 'table', title: 'Table', icon: FileText },
];

interface DragField {
  id: string;
  label: string;
  kind: 'dimension' | 'measure';
  group: string;
}

// Width of the docked Filters panel; the main content reserves this space so
// the panel never overlaps the widgets. Wide enough for the two-column layout
// (Filters on Page | Data fields).
const FILTER_PANEL_WIDTH = 640;

const DRAG_FIELDS: DragField[] = [
  { id: 'date', label: 'Date', kind: 'dimension', group: 'Time' },
  { id: 'month', label: 'Month', kind: 'dimension', group: 'Time' },
  { id: 'week', label: 'Week', kind: 'dimension', group: 'Time' },
  { id: 'region', label: 'Region', kind: 'dimension', group: 'Geography' },
  { id: 'state', label: 'State', kind: 'dimension', group: 'Geography' },
  { id: 'vendor', label: 'Vendor Name', kind: 'dimension', group: 'Entity' },
  { id: 'status', label: 'Status', kind: 'dimension', group: 'Entity' },
  { id: 'category', label: 'Categories', kind: 'dimension', group: 'Entity' },
  { id: 'department', label: 'Department', kind: 'dimension', group: 'Entity' },
  { id: 'inv_amount', label: 'Invoice Amount (₹)', kind: 'measure', group: 'Financial' },
  { id: 'risk_amt', label: 'Amount at Risk (₹)', kind: 'measure', group: 'Financial' },
  { id: 'dup_count', label: 'Duplicate Count', kind: 'measure', group: 'Performance' },
  { id: 'dup_score', label: 'Duplicate Score (%)', kind: 'measure', group: 'Performance' },
  { id: 'inv_scanned', label: 'Invoices Scanned', kind: 'measure', group: 'Performance' },
  { id: 'accuracy', label: 'Detection Accuracy (%)', kind: 'measure', group: 'Performance' },
  { id: 'proc_time', label: 'Processing Time (d)', kind: 'measure', group: 'Performance' },
];

const AGG_OPTIONS = [
  { value: 'sum', label: 'Sum', symbol: 'Σ' },
  { value: 'average', label: 'Average', symbol: 'x̄' },
  { value: 'count', label: 'Count', symbol: 'n' },
  { value: 'count_d', label: 'Count Distinct', symbol: '#' },
  { value: 'min', label: 'Min', symbol: '↓' },
  { value: 'max', label: 'Max', symbol: '↑' },
];

import { FileTreeView, FILE_TREE_DATA } from './add-widget/FileTreeView';

// ─── Filter Panel ───────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'last-7-days', label: 'Last 7 Days' },
  { value: 'last-30-days', label: 'Last 30 Days' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'last-year', label: 'Last Year' },
];

const STATUS_FILTER_OPTIONS = ['Compliant', 'Non-Compliant', 'Under Review', 'Pending', 'Flagged'];
const RISK_FILTER_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const DEPT_FILTER_OPTIONS = ['Finance', 'Procurement', 'IT', 'Legal', 'Operations', 'HR', 'Sales'];

function FilterSection({ title, icon, isActive, onClear, children, defaultOpen = true }: {
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClear?: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${isActive ? 'border-brand-200 bg-brand-50/50' : 'border-canvas-border bg-canvas-elevated'}`}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className={isActive ? 'text-brand-600' : 'text-ink-400'}>{icon}</span>
          <span className={`text-[0.6875rem] font-bold uppercase tracking-wider ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && onClear && (
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="text-[0.6875rem] font-semibold text-ink-400 hover:text-brand-600 px-1.5 py-0.5 rounded hover:bg-brand-50 transition-colors cursor-pointer"
            >Clear</button>
          )}
          <ChevronDown size={13} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer text-left"
    >
      <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
        checked ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white'
      }`}>
        {checked && (
          <svg viewBox="0 0 12 12" fill="none" className="size-2.5">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className={`text-[0.75rem] ${checked ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>{label}</span>
    </button>
  );
}

function FilterPanel({
  open, onClose,
  modelTables,
  pageFilterFields, onPageFilterFieldsChange,
  pageFilterValues, onPageFilterValuesChange,
  crossFilter,
  onResetAll,
}: {
  open: boolean;
  onClose: () => void;
  modelTables: ModelTable[];
  pageFilterFields: string[];
  onPageFilterFieldsChange: (v: string[]) => void;
  pageFilterValues: Record<string, (string | number)[]>;
  onPageFilterValuesChange: (v: Record<string, (string | number)[]>) => void;
  crossFilter: { table: string; column: string; value: string } | null;
  onResetAll: () => void;
}) {
  const [fpPageDragOver, setFpPageDragOver] = useState(false);
  const [fpFieldSearch, setFpFieldSearch] = useState('');
  const [openTables, setOpenTables] = useState<Set<string>>(() => new Set([modelTables[0]?.id].filter(Boolean) as string[]));

  const splitId = (id: string) => { const [table, column] = id.split('::'); return { table, column }; };
  const colOf = (id: string) => { const { table, column } = splitId(id); const tbl = modelTables.find(t => t.id === table); return tbl?.columns.find(c => c.name === column); };
  const fieldLabel = (id: string) => colOf(id)?.label ?? splitId(id).column;
  const tableLabel = (id: string) => { const { table } = splitId(id); return modelTables.find(t => t.id === table)?.name ?? table; };

  const addField = (id: string) => { if (!pageFilterFields.includes(id)) onPageFilterFieldsChange([...pageFilterFields, id]); };
  const removeField = (id: string) => {
    onPageFilterFieldsChange(pageFilterFields.filter(f => f !== id));
    const { [id]: _drop, ...rest } = pageFilterValues; void _drop;
    onPageFilterValuesChange(rest);
  };
  const toggleValue = (id: string, val: string | number) => {
    const cur = pageFilterValues[id] ?? [];
    const next = cur.some(v => String(v) === String(val)) ? cur.filter(v => String(v) !== String(val)) : [...cur, val];
    onPageFilterValuesChange({ ...pageFilterValues, [id]: next });
  };
  const clearValues = (id: string) => onPageFilterValuesChange({ ...pageFilterValues, [id]: [] });

  const hasAny = pageFilterFields.length > 0 || !!crossFilter;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{ width: FILTER_PANEL_WIDTH }}
          className="fixed top-0 right-0 h-full z-50 bg-canvas border-l border-canvas-border shadow-2xl flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-canvas-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-brand-50">
                  <Filter size={14} className="text-brand-600" />
                </div>
                <div>
                  <span className="text-[0.875rem] font-semibold text-ink-900">Filters</span>
                  <p className="text-[0.625rem] text-ink-400 leading-none mt-0.5">Slice every widget on this dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasAny && (
                  <button onClick={onResetAll} className="text-[0.6875rem] font-semibold text-ink-400 hover:text-brand-600 px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors cursor-pointer">
                    Reset all
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer">
                  <X size={16} className="text-ink-500" />
                </button>
              </div>
            </div>

            {/* Two-column content: Filters on Page | Data fields */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left — page slicers */}
              <div className="w-1/2 border-r border-canvas-border overflow-y-auto px-4 py-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-brand-600" />
                      <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-500">Filters on Page</span>
                    </div>
                    {pageFilterFields.length > 0 && (
                      <button onClick={() => { onPageFilterFieldsChange([]); onPageFilterValuesChange({}); }} className="text-[0.625rem] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
                        Clear all
                      </button>
                    )}
                  </div>

                  {pageFilterFields.length === 0 ? (
                    <div
                      className={`rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center min-h-[110px] transition-colors ${
                        fpPageDragOver ? 'border-brand-400 bg-brand-50/50' : 'border-ink-200 bg-canvas-elevated'
                      }`}
                      onDragOver={e => { e.preventDefault(); setFpPageDragOver(true); }}
                      onDragLeave={() => setFpPageDragOver(false)}
                      onDrop={e => { e.preventDefault(); setFpPageDragOver(false); const id = e.dataTransfer.getData('fieldId'); if (id) addField(id); }}
                    >
                      <span className="text-[0.75rem] font-semibold text-ink-400">DROP A FIELD HERE</span>
                      <span className="text-[0.6875rem] text-ink-300 mt-0.5 text-center">Drag a field from the right, or click it, to slice the whole page</span>
                    </div>
                  ) : (
                    <div
                      className={`space-y-2.5 rounded-xl border-2 border-dashed p-2.5 transition-colors ${fpPageDragOver ? 'border-brand-400 bg-brand-50/40' : 'border-transparent'}`}
                      onDragOver={e => { e.preventDefault(); setFpPageDragOver(true); }}
                      onDragLeave={() => setFpPageDragOver(false)}
                      onDrop={e => { e.preventDefault(); setFpPageDragOver(false); const id = e.dataTransfer.getData('fieldId'); if (id) addField(id); }}
                    >
                      {pageFilterFields.map(fId => {
                        const { table, column } = splitId(fId);
                        const values = distinctValues(modelTables, table, column);
                        const selected = pageFilterValues[fId] ?? [];
                        return (
                          <div key={fId} className="rounded-lg border border-canvas-border bg-canvas-elevated overflow-hidden">
                            <div className="flex items-center justify-between gap-1 px-2.5 py-2 bg-brand-50/60 border-b border-canvas-border">
                              <div className="min-w-0">
                                <div className="text-[0.75rem] font-semibold text-ink-800 truncate">{fieldLabel(fId)}</div>
                                <div className="text-[0.5625rem] text-ink-400 truncate">{tableLabel(fId)}{selected.length > 0 ? ` · ${selected.length} selected` : ' · all'}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {selected.length > 0 && (
                                  <button onClick={() => clearValues(fId)} className="text-[0.5625rem] font-semibold text-brand-600 hover:text-brand-800 px-1 cursor-pointer">Clear</button>
                                )}
                                <button onClick={() => removeField(fId)} className="p-1 rounded hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer"><X size={11} /></button>
                              </div>
                            </div>
                            <div className="p-2 flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto">
                              {values.map(v => {
                                const on = selected.some(s => String(s) === String(v));
                                return (
                                  <button
                                    key={String(v)}
                                    onClick={() => toggleValue(fId, v)}
                                    className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-[0.6875rem] font-medium border transition-colors cursor-pointer ${
                                      on ? 'bg-brand-600 border-brand-600 text-white' : 'bg-canvas border-canvas-border text-ink-600 hover:border-brand-300 hover:text-brand-700'
                                    }`}
                                  >
                                    {on && <Check size={10} />}{String(v)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right — data fields (drag or click to add a page filter) */}
              <div className="w-1/2 overflow-y-auto px-4 py-4 space-y-3">
                <div className="text-[0.9375rem] font-semibold text-ink-900 px-1">Data fields</div>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search fields"
                    value={fpFieldSearch}
                    onChange={e => setFpFieldSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-3 bg-canvas-elevated border border-canvas-border rounded-lg text-[0.75rem] text-ink-800 placeholder:text-ink-400 outline-none focus:border-brand-400 transition-colors"
                  />
                </div>

                <div className="rounded-lg border border-canvas-border overflow-hidden">
                  {modelTables.map(tbl => {
                    const dims = tbl.columns
                      .filter(c => c.role === 'dimension')
                      .filter(c => !fpFieldSearch || c.label.toLowerCase().includes(fpFieldSearch.toLowerCase()));
                    if (dims.length === 0) return null;
                    const isOpen = openTables.has(tbl.id) || !!fpFieldSearch;
                    return (
                      <div key={tbl.id} className="border-b border-canvas-border/60 last:border-b-0">
                        <button
                          onClick={() => setOpenTables(prev => { const n = new Set(prev); if (n.has(tbl.id)) n.delete(tbl.id); else n.add(tbl.id); return n; })}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-brand-50/40 cursor-pointer"
                        >
                          <ChevronDown size={12} className={`text-ink-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                          <Database size={12} className="text-brand-500" />
                          <span className="text-[0.75rem] font-semibold text-ink-800 flex-1 text-left truncate">{tbl.name}</span>
                        </button>
                        {isOpen && (
                          <div className="pb-1.5">
                            {dims.map(c => {
                              const id = `${tbl.id}::${c.name}`;
                              const added = pageFilterFields.includes(id);
                              return (
                                <div
                                  key={c.name}
                                  draggable
                                  onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('fieldId', id); }}
                                  onClick={() => (added ? removeField(id) : addField(id))}
                                  className={`group flex items-center gap-2 pl-8 pr-3 py-1.5 cursor-grab active:cursor-grabbing transition-colors ${added ? 'bg-brand-50/60' : 'hover:bg-brand-50/40'}`}
                                >
                                  <Type size={11} className="text-ink-300 shrink-0" />
                                  <span className="text-[0.75rem] text-ink-700 flex-1 truncate">{c.label}</span>
                                  {added ? <Check size={12} className="text-brand-600" /> : <Plus size={12} className="text-ink-300 opacity-0 group-hover:opacity-100" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[0.625rem] text-ink-400 px-1 leading-relaxed">
                  Filters apply to every related widget through the data-model connections. A widget on an unrelated table is left unchanged — just like Power BI.
                </p>
              </div>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Drill Icons ────────────────────────────────────────────────────────────

function IconDrillUp() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M8 12V4" /><path d="M5 7L8 4L11 7" />
    </svg>
  );
}

function IconDrillDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M8 4V12" /><path d="M5 9L8 12L11 9" />
    </svg>
  );
}

// ─── Widget Toolbar Button ──────────────────────────────────────────────────

function ToolbarBtn({ children, onClick, disabled = false, active = false, tip }: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  tip: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : (e) => { e.stopPropagation(); onClick(e); }}
      disabled={disabled}
      title={tip}
      className={`flex items-center justify-center size-[28px] rounded-md transition-all duration-100 cursor-pointer
        ${disabled ? 'text-ink-300 cursor-not-allowed' : active ? 'bg-brand-600 text-white' : 'text-ink-400 hover:bg-brand-50 hover:text-brand-600'}
      `}
    >
      {children}
    </button>
  );
}

// ─── Expanded Chart Scroller — custom always-visible scrollbar ──────────────

function ExpandedChartScroller({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumbLeft, setThumbLeft] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(100);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartScroll = useRef(0);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ratio = el.clientWidth / el.scrollWidth;
    setThumbWidth(Math.max(ratio * 100, 10));
    const scrollRatio = el.scrollLeft / (el.scrollWidth - el.clientWidth || 1);
    setThumbLeft(scrollRatio * (100 - ratio * 100));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateThumb();
    el.addEventListener('scroll', updateThumb);
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateThumb); ro.disconnect(); };
  }, [updateThumb]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = e.currentTarget;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const clickRatio = (e.clientX - rect.left) / rect.width;
    el.scrollLeft = clickRatio * (el.scrollWidth - el.clientWidth);
  };

  const handleThumbDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(true);
    dragStartX.current = e.clientX;
    dragStartScroll.current = scrollRef.current?.scrollLeft || 0;
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      const trackEl = el.parentElement?.querySelector('[data-scroll-track]') as HTMLElement;
      if (!trackEl) return;
      const trackWidth = trackEl.clientWidth;
      const delta = e.clientX - dragStartX.current;
      const scrollDelta = (delta / trackWidth) * el.scrollWidth;
      el.scrollLeft = dragStartScroll.current + scrollDelta;
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  return (
    <div className="flex-1 flex flex-col min-h-[500px] relative">
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
        <style>{`.expanded-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="expanded-scroll" style={{ minWidth: '130%', height: '100%' }}>
          {children}
        </div>
      </div>
      {/* Custom scrollbar — always visible */}
      <div
        data-scroll-track
        className="h-1 mt-2 mx-1 bg-ink-100 rounded-full cursor-pointer relative shrink-0"
        onClick={handleTrackClick}
      >
        <div
          className={`absolute top-0 h-full rounded-full transition-colors ${dragging ? 'bg-brand-500' : 'bg-ink-300 hover:bg-ink-400'}`}
          style={{ left: `${thumbLeft}%`, width: `${thumbWidth}%` }}
          onMouseDown={handleThumbDown}
        />
      </div>
    </div>
  );
}

// ─── Expanded Widget Modal ──────────────────────────────────────────────────

// ─── Expanded Modal Data ─────────────────────────────────────────────────────

const EXPANDED_RECORDS = [
  { id: 'INV-005790', vendor: 'Acme Global Imaging', amount: '₹11,853', date: '20-Mar-25', status: 'Pending Review', department: 'Operations', risk: 'High', match: 'INV-005791' },
  { id: 'INV-025832', vendor: 'Korean Technologies', amount: '₹4,564', date: '15-Dec-24', status: 'Under Review', department: 'Procurement', risk: 'Medium', match: 'INV-025831' },
  { id: 'INV-007194', vendor: '3tones Letter Co.', amount: '₹3,835', date: '31-Dec-24', status: 'Resolved', department: 'Finance', risk: 'Low', match: 'None' },
  { id: 'INV-040083', vendor: 'Chintamani Paper Products', amount: '₹3,410', date: '13-Dec-24', status: 'Pending Review', department: 'Operations', risk: 'High', match: 'INV-040082' },
  { id: 'INV-027203', vendor: 'M Cargo Logistics', amount: '₹1,457', date: '12-Jan-25', status: 'Auto-Resolved', department: 'Logistics', risk: 'Low', match: 'None' },
  { id: 'INV-031456', vendor: 'TechParts Ltd', amount: '₹8,920', date: '05-Feb-25', status: 'Flagged', department: 'IT', risk: 'Critical', match: 'INV-031455' },
  { id: 'INV-018927', vendor: 'Global Supplies Inc', amount: '₹6,340', date: '22-Jan-25', status: 'Resolved', department: 'Procurement', risk: 'Low', match: 'INV-018926' },
  { id: 'INV-044521', vendor: 'Atlas Manufacturing', amount: '₹15,200', date: '18-Mar-25', status: 'Under Review', department: 'Finance', risk: 'High', match: 'INV-044520' },
];

const EXPANDED_TABLE_ROWS: { cells: string[] }[] = [
  { cells: ['INV-005790', 'Acme Global Imaging', '₹11,853', '20-Mar-25', 'Pending Review', 'Operations', 'High', 'INV-005791'] },
  { cells: ['INV-025832', 'Korean Technologies', '₹4,564', '15-Dec-24', 'Under Review', 'Procurement', 'Medium', 'INV-025831'] },
  { cells: ['INV-007194', '3tones Letter Co.', '₹3,835', '31-Dec-24', 'Resolved', 'Finance', 'Low', 'None'] },
  { cells: ['INV-040083', 'Chintamani Paper Products', '₹3,410', '13-Dec-24', 'Pending Review', 'Operations', 'High', 'INV-040082'] },
  { cells: ['INV-027203', 'M Cargo Logistics', '₹1,457', '12-Jan-25', 'Auto-Resolved', 'Logistics', 'Low', 'None'] },
  { cells: ['INV-031456', 'TechParts Ltd', '₹8,920', '05-Feb-25', 'Flagged', 'IT', 'Critical', 'INV-031455'] },
  { cells: ['INV-018927', 'Global Supplies Inc', '₹6,340', '22-Jan-25', 'Resolved', 'Procurement', 'Low', 'INV-018926'] },
  { cells: ['INV-044521', 'Atlas Manufacturing', '₹15,200', '18-Mar-25', 'Under Review', 'Finance', 'High', 'INV-044520'] },
  { cells: ['INV-052340', 'PrintWorks', '₹3,400', '15-Mar-25', 'Flagged', 'Procurement', 'Critical', 'INV-052339'] },
  { cells: ['INV-061201', 'SecureNet', '₹18,500', '28-Mar-25', 'Auto-Resolved', 'IT', 'Low', 'None'] },
  { cells: ['INV-045123', 'TechParts Ltd', '₹11,200', '12-Mar-25', 'Pending Review', 'IT', 'High', 'INV-045122'] },
  { cells: ['INV-038901', 'CloudHost Inc', '₹8,900', '01-Feb-25', 'Under Review', 'Operations', 'Medium', 'INV-038900'] },
  { cells: ['INV-029876', 'DataPipe Co', '₹24,000', '20-Jan-25', 'Resolved', 'Finance', 'Low', 'None'] },
  { cells: ['INV-067432', 'NexGen Supplies', '₹5,780', '05-Apr-25', 'Pending Review', 'HR', 'Medium', 'INV-067431'] },
  { cells: ['INV-071890', 'Rapid Logistics', '₹2,340', '10-Apr-25', 'Resolved', 'Logistics', 'Low', 'None'] },
  { cells: ['INV-034567', 'Vertex Solutions', '₹19,400', '25-Feb-25', 'Under Review', 'IT', 'High', 'INV-034566'] },
  { cells: ['INV-058213', 'BrightEdge Corp', '₹7,650', '08-Mar-25', 'Auto-Resolved', 'Finance', 'Low', 'None'] },
  { cells: ['INV-042198', 'Summit Industries', '₹31,200', '17-Feb-25', 'Flagged', 'Procurement', 'Critical', 'INV-042197'] },
  { cells: ['INV-076543', 'OmniTech Ltd', '₹4,120', '14-Apr-25', 'Resolved', 'Operations', 'Low', 'INV-076542'] },
  { cells: ['INV-019874', 'Pacific Trading Co', '₹16,800', '09-Jan-25', 'Under Review', 'Sales', 'High', 'INV-019873'] },
  { cells: ['INV-083210', 'CoreLink Systems', '₹9,350', '22-Apr-25', 'Pending Review', 'IT', 'Medium', 'INV-083209'] },
  { cells: ['INV-055678', 'Greenfield Supplies', '₹6,200', '02-Mar-25', 'Resolved', 'HR', 'Low', 'None'] },
  { cells: ['INV-047891', 'Pinnacle Services', '₹13,750', '27-Feb-25', 'Flagged', 'Finance', 'High', 'INV-047890'] },
  { cells: ['INV-062345', 'AlphaWare Inc', '₹2,890', '19-Mar-25', 'Auto-Resolved', 'Legal', 'Low', 'None'] },
  { cells: ['INV-039012', 'Stellar Dynamics', '₹22,100', '04-Feb-25', 'Under Review', 'Operations', 'High', 'INV-039011'] },
];

const EXCEL_RAW_HEADERS = ['Row #', 'Invoice ID', 'Vendor Name', 'Amount', 'Date', 'Department', 'GST Number', 'Payment Mode', 'Sheet'];

const EXCEL_RAW_ROWS = [
  { row: 1, invoiceId: 'INV-005790', vendor: 'Acme Global Imaging', amount: '₹11,853', date: '20-Mar-25', department: 'Operations', gst: '27AABCA1234F1ZP', payment: 'NEFT', sheet: 'Invoices' },
  { row: 2, invoiceId: 'INV-025832', vendor: 'Korean Technologies', amount: '₹4,564', date: '15-Dec-24', department: 'Procurement', gst: '29AABCK5678G1Z5', payment: 'RTGS', sheet: 'Invoices' },
  { row: 3, invoiceId: 'INV-007194', vendor: '3tones Letter Co.', amount: '₹3,835', date: '31-Dec-24', department: 'Finance', gst: '07AABC3456H1ZQ', payment: 'Cheque', sheet: 'Invoices' },
  { row: 4, invoiceId: 'INV-040083', vendor: 'Chintamani Paper', amount: '₹3,410', date: '13-Dec-24', department: 'Operations', gst: '24AABCC7890J1Z3', payment: 'NEFT', sheet: 'Invoices' },
  { row: 5, invoiceId: 'INV-027203', vendor: 'M Cargo Logistics', amount: '₹1,457', date: '12-Jan-25', department: 'Logistics', gst: '33AABCM2345K1Z8', payment: 'UPI', sheet: 'Invoices' },
  { row: 6, invoiceId: 'INV-031456', vendor: 'TechParts Ltd', amount: '₹8,920', date: '05-Feb-25', department: 'IT', gst: '06AABCT6789L1Z1', payment: 'NEFT', sheet: 'Invoices' },
  { row: 7, invoiceId: 'INV-018927', vendor: 'Global Supplies Inc', amount: '₹6,340', date: '22-Jan-25', department: 'Procurement', gst: '27AABCG1234M1ZP', payment: 'RTGS', sheet: 'Invoices' },
  { row: 8, invoiceId: 'INV-044521', vendor: 'Atlas Manufacturing', amount: '₹15,200', date: '18-Mar-25', department: 'Finance', gst: '29AABCA5678N1Z5', payment: 'NEFT', sheet: 'Invoices' },
  { row: 9, invoiceId: 'INV-052340', vendor: 'PrintWorks', amount: '12,500 INR', date: '15-Mar-25', department: 'Procurement', gst: 'ABCDE1234Z', payment: 'Cheque', sheet: 'Invoices' },
  { row: 10, invoiceId: 'INV-061201', vendor: 'SecureNet', amount: '₹18,500', date: '13/25/2025', department: 'IT', gst: '06AABCS9012P1Z7', payment: 'NEFT', sheet: 'Invoices' },
  { row: 11, invoiceId: 'INV-045123', vendor: '', amount: '₹11,200', date: '12-Mar-25', department: 'IT', gst: '27AABCT3456Q1ZP', payment: 'RTGS', sheet: 'Invoices' },
  { row: 12, invoiceId: 'INV-038901', vendor: 'CloudHost Inc', amount: '₹8,900', date: '01-Feb-25', department: '', gst: '29AABCC7890R1Z5', payment: 'UPI', sheet: 'Vendors' },
  { row: 13, invoiceId: 'INV-029876', vendor: 'DataPipe Co', amount: '₹24,000', date: '20-Jan-25', department: 'Finance', gst: '07AABCD1234S1ZQ', payment: 'NEFT', sheet: 'Payments' },
  { row: 14, invoiceId: 'INV-067432', vendor: 'NexGen Supplies', amount: '₹5,780', date: '05-Apr-25', department: 'HR', gst: '24AABCN5678T1Z3', payment: 'Cheque', sheet: 'Payments' },
  { row: 15, invoiceId: 'INV-005790', vendor: 'Acme Global Imaging', amount: '₹11,853', date: '20-Mar-25', department: 'Operations', gst: '27AABCA1234F1ZP', payment: 'NEFT', sheet: 'Invoices' },
  { row: 16, invoiceId: 'INV-071890', vendor: 'Rapid Logistics', amount: '₹9,84,500', date: '10-Apr-25', department: 'Logistics', gst: '33AABCR9012U1Z8', payment: 'RTGS', sheet: 'Payments' },
];

const STATUS_COLORS: Record<string, string> = {
  'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200',
  'Under Review': 'bg-blue-50 text-blue-700 border-blue-200',
  'Resolved': 'bg-green-50 text-green-700 border-green-200',
  'Auto-Resolved': 'bg-green-50 text-green-700 border-green-200',
  'Flagged': 'bg-red-50 text-red-700 border-red-200',
};

const RISK_COLORS: Record<string, string> = {
  'Critical': 'bg-red-50 text-red-700',
  'High': 'bg-orange-50 text-orange-700',
  'Medium': 'bg-amber-50 text-amber-700',
  'Low': 'bg-green-50 text-green-700',
};

const TIME_PERIODS = ['Today', '7D', '30D', '3M', '6M', '12M'];

function ExpandedWidgetModal({ open, onClose, title, subtitle, children, onEdit, onDelete, onPrev, onNext, hasPrev, hasNext, isTable, autoOpenEditSidebar, onEditSidebarOpened, onOpenAddData, widgetChartType, customizeState, onCustomizeChange, xField, yField, legendField, onXFieldChange, onYFieldChange, onLegendFieldChange, isExcelDashboard, dataSourceInfo }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isTable?: boolean;
  autoOpenEditSidebar?: boolean;
  onEditSidebarOpened?: () => void;
  onOpenAddData?: () => void;
  widgetChartType?: string;
  customizeState?: { fontFamily: string; bold: boolean; italic: boolean; underline: boolean; xAxisTitle: string; yAxisTitle: string; yMin: string; yMax: string; invertRange: boolean };
  onCustomizeChange?: (key: string, value: any) => void;
  xField?: string;
  yField?: string;
  legendField?: string;
  onXFieldChange?: (v: string) => void;
  onYFieldChange?: (v: string) => void;
  onLegendFieldChange?: (v: string) => void;
  isExcelDashboard?: boolean;
  dataSourceInfo?: { type: 'sql' | 'excel' | 'csv' | 'query'; name: string; meta: string };
}) {
  const { can } = useCan();
  const [activeTab, setActiveTab] = useState<'visualization' | 'records' | 'summary'>(isTable ? 'records' : 'visualization');
  const [timePeriod, setTimePeriod] = useState('30D');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('bar');
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showExpandMenu, setShowExpandMenu] = useState(false);
  const [showAlertNotifications, setShowAlertNotifications] = useState(false);
  const [editingExpandTitle, setEditingExpandTitle] = useState(false);
  const [expandTitle, setExpandTitle] = useState(title);
  const [showExpandDeleteConfirm, setShowExpandDeleteConfirm] = useState(false);
  useEffect(() => { setExpandTitle(title); setEditingExpandTitle(false); }, [title]);
  const [showEditSidebar, setShowEditSidebar] = useState(false);
  const [editSidebarTab, setEditSidebarTab] = useState<'datasource' | 'customize'>('datasource');

  // Auto-open edit sidebar when triggered from card-level edit
  const prevAutoOpen = useRef(false);
  useEffect(() => {
    if (autoOpenEditSidebar && open && !prevAutoOpen.current) {
      prevAutoOpen.current = true;
      setTimeout(() => {
        setShowEditSidebar(true);
        setEditSidebarTab('datasource');
        onEditSidebarOpened?.();
      }, 300);
    }
    if (!open) prevAutoOpen.current = false;
  }, [autoOpenEditSidebar, open]);
  const [editChartType, setEditChartType] = useState(widgetChartType || 'clustered-column');
  const [editChartTypeOpen, setEditChartTypeOpen] = useState(true);
  const [editDataSourceOpen, setEditDataSourceOpen] = useState(true);
  const [editDataSearch, setEditDataSearch] = useState('');
  const [editExpandedFiles, setEditExpandedFiles] = useState<Record<string, boolean>>({ 'Invoice_Master.xlsx': true });
  const [editGeneralOpen, setEditGeneralOpen] = useState(true);
  const [editLegendOpen, setEditLegendOpen] = useState(false);
  const [editDataLabelsOpen, setEditDataLabelsOpen] = useState(false);
  const [editRangeOpen, setEditRangeOpen] = useState(false);
  const [editFieldsOpen, setEditFieldsOpen] = useState(true);
  const [editXAxisOpen, setEditXAxisOpen] = useState(false);
  const [editYAxisOpen, setEditYAxisOpen] = useState(false);
  const [editConditionalOpen, setEditConditionalOpen] = useState(false);
  const [editDataSeriesOpen, setEditDataSeriesOpen] = useState(false);
  const editFontFamily = customizeState?.fontFamily ?? 'Inter';
  const editIsBold = customizeState?.bold ?? false;
  const editIsItalic = customizeState?.italic ?? false;
  const editIsUnderline = customizeState?.underline ?? false;
  const editMinimum = customizeState?.yMin ?? '';
  const editMaximum = customizeState?.yMax ?? '';
  const editInvertRange = customizeState?.invertRange ?? false;
  const editXAxisTitleVal = customizeState?.xAxisTitle ?? '';
  const editYAxisTitleVal = customizeState?.yAxisTitle ?? '';
  const setEditFontFamily = (v: string) => onCustomizeChange?.('fontFamily', v);
  const setEditIsBold = (v: boolean) => onCustomizeChange?.('bold', v);
  const setEditIsItalic = (v: boolean) => onCustomizeChange?.('italic', v);
  const setEditIsUnderline = (v: boolean) => onCustomizeChange?.('underline', v);
  const setEditMinimum = (v: string) => onCustomizeChange?.('yMin', v);
  const setEditMaximum = (v: string) => onCustomizeChange?.('yMax', v);
  const setEditInvertRange = (v: boolean) => onCustomizeChange?.('invertRange', v);
  const [showVizFilter, setShowVizFilter] = useState(false);
  const [vizFilterSelections, setVizFilterSelections] = useState<Record<string, string[]>>({});
  const [vizFilterOpen, setVizFilterOpen] = useState<Record<string, boolean>>({});
  const [vizFilterSearch, setVizFilterSearch] = useState<Record<string, string>>({});
  const VIZ_FILTER_SECTIONS = [
    { id: 'state', label: 'State / City', values: ['Maharashtra', 'Delhi NCR', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan'] },
    { id: 'product', label: 'Product', values: ['Laptop Pro X1', 'Thermal Paper Rolls', 'A4 Print Paper', 'Toner Cartridge HP', 'Office Chair Ergo', 'USB-C Hub'] },
    { id: 'vendor', label: 'Vendor', values: ['Acme Corp', 'Global Tech', 'InfoSys Ltd', 'TCS', 'Wipro', 'HCL'] },
    { id: 'department', label: 'Department', values: ['Finance', 'Procurement', 'IT', 'Legal', 'Operations', 'HR'] },
  ];
  const vizFilterCount = Object.values(vizFilterSelections).reduce((s, a) => s + a.length, 0);
  const vizFilterBtnRef = useRef<HTMLButtonElement>(null);
  const [alerts, setAlerts] = useState([
    { id: '1', title: 'Duplicates Alert', message: 'Duplicate count exceeded threshold: 59 > 50', time: '4/24/2026, 5:37:43 PM' },
    { id: '2', title: 'Compliance Alert', message: 'Compliance rate dropped below threshold: 92% < 95%', time: '4/24/2026, 4:15:22 PM' },
    { id: '3', title: 'Amount Alert', message: 'Invoice amount exceeded threshold: ₹52,000 > ₹50,000', time: '4/24/2026, 3:02:11 PM' },
  ]);
  const { addToast } = useToast();

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(isTable || subtitle === 'KPI detail' ? 'records' : 'visualization');
      setEditChartType(widgetChartType || 'clustered-column');
      setSearchQuery('');
      setTimePeriod('30D');
      setShowEditSidebar(false);
    }
  }, [open]);

  // Close edit sidebar on Escape
  useEffect(() => {
    if (!showEditSidebar) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowEditSidebar(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showEditSidebar]);

  const isKpiDetail = subtitle === 'KPI detail';
  const kpiFilterTitle = isKpiDetail ? title.toLowerCase() : '';

  const filteredExcelRows = EXCEL_RAW_ROWS.filter(r => {
    // KPI-based filtering
    if (isKpiDetail) {
      if (kpiFilterTitle.includes('blank')) { if (r.vendor && r.department) return false; }
      else if (kpiFilterTitle.includes('duplicate')) {
        const dupes = EXCEL_RAW_ROWS.filter(x => x.invoiceId === r.invoiceId);
        if (dupes.length <= 1) return false;
      }
      // 'total rows' and 'completeness' show all rows
    }
    // Search filtering
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.vendor.toLowerCase().includes(q) || r.invoiceId.toLowerCase().includes(q) || r.department.toLowerCase().includes(q) || r.sheet.toLowerCase().includes(q);
  });

  const filteredRecords = EXPANDED_RECORDS.filter(r => {
    if (!searchQuery) return true;
    return r.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!open) return null;

  const tabIcons = { visualization: BarChart3, records: FileText, summary: ListChecks };
  const tabLabels = { visualization: 'Visualization', records: 'Detailed Records', summary: 'Summary' };

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl flex flex-col overflow-hidden"
            style={{ width: '96vw', height: '94vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header with tabs ── */}
            <div className="border-b border-canvas-border bg-canvas-elevated shrink-0">
              <div className="flex items-center justify-between px-5 pt-2 pb-0">
                {/* Tabs left */}
                <div className="flex items-center gap-0">
                  {(['visualization', 'records', 'summary'] as const).filter(tab => !((isTable || isKpiDetail) && tab === 'visualization') && !(isExcelDashboard && tab === 'summary')).map(tab => {
                    const Icon = tabIcons[tab];
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-[0.75rem] font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                          isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
                        }`}
                      >
                        <Icon size={14} />
                        {tabLabels[tab]}
                      </button>
                    );
                  })}
                </div>

                {/* Actions right */}
                <div className="flex items-center gap-1">
                  {/* Bell with badge — hidden for Excel */}
                  {!isExcelDashboard && (
                  <button
                    onClick={() => setShowAlertNotifications(true)}
                    className="relative p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                    title="Alert Notifications"
                  >
                    <Bell size={18} className="text-warning" />
                    {alerts.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 bg-warning text-white text-[0.5rem] font-bold rounded-full flex items-center justify-center size-4">{alerts.length}</span>
                    )}
                  </button>
                  )}

                  {/* 3-dot menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowExpandMenu(!showExpandMenu)}
                      className="p-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MoreVertical size={18} className="text-ink-700" />
                    </button>

                    {showExpandMenu && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowExpandMenu(false)} />
                        <div className="absolute top-full right-0 z-40 mt-1 w-[180px] bg-white border border-canvas-border rounded-xl shadow-xl py-1.5">
                          {onEdit && (
                            <button
                              onClick={() => { setShowExpandMenu(false); setShowEditSidebar(true); setEditSidebarTab('datasource'); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] text-ink-700 hover:bg-surface-2 transition-colors text-left cursor-pointer"
                            >
                              <Edit size={15} className="text-ink-500" />
                              Edit Widget
                            </button>
                          )}
                          {onDelete && can('db_delete') && (
                            <button
                              onClick={() => { setShowExpandMenu(false); setShowExpandDeleteConfirm(true); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-[0.8125rem] text-ink-700 hover:bg-red-50 hover:text-red-600 transition-colors text-left cursor-pointer"
                            >
                              <Trash2 size={15} className="text-ink-500" />
                              Delete Widget
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Close */}
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer">
                    <X size={18} className="text-ink-500" />
                  </button>
                </div>
              </div>

              {/* Sub-bar — shown on all tabs with conditional controls */}
              {(
                <div className="flex items-center px-4 py-0.5 border-t border-canvas-border/50 overflow-visible relative z-10 sticky top-0 bg-canvas-elevated">
                  {/* Left — prev/next arrows */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onPrev?.()}
                      disabled={!hasPrev}
                      className={`size-8 flex items-center justify-center rounded-lg border transition-colors ${
                        hasPrev ? 'border-canvas-border bg-white hover:bg-brand-50 hover:border-brand-200 cursor-pointer text-ink-700' : 'border-canvas-border/50 bg-surface-2/50 text-ink-300 cursor-not-allowed'
                      }`}
                      title="Previous widget"
                    >
                      <ChevronDown size={16} className="rotate-90" />
                    </button>
                    <button
                      onClick={() => onNext?.()}
                      disabled={!hasNext}
                      className={`size-8 flex items-center justify-center rounded-lg border transition-colors ${
                        hasNext ? 'border-canvas-border bg-white hover:bg-brand-50 hover:border-brand-200 cursor-pointer text-ink-700' : 'border-canvas-border/50 bg-surface-2/50 text-ink-300 cursor-not-allowed'
                      }`}
                      title="Next widget"
                    >
                      <ChevronDown size={16} className="-rotate-90" />
                    </button>
                  </div>

                  {/* Center — title (absolute so it stays centered regardless of left/right content) */}
                  <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
                    {editingExpandTitle ? (
                      <input
                        autoFocus
                        value={expandTitle}
                        onChange={e => setExpandTitle(e.target.value)}
                        onBlur={() => setEditingExpandTitle(false)}
                        onKeyDown={e => { if (e.key === 'Enter') setEditingExpandTitle(false); }}
                        className="text-[0.8125rem] font-semibold text-ink-900 bg-transparent border-none outline-none ring-0 shadow-none text-center"
                        style={{ outline: 'none', boxShadow: 'none' }}
                      />
                    ) : (
                      <span className="flex items-center gap-3 pointer-events-auto">
                        <span
                          className="text-[0.8125rem] font-semibold text-ink-900 cursor-text hover:text-brand-600 transition-colors"
                          onClick={() => setEditingExpandTitle(true)}
                        >{expandTitle}</span>
                        {dataSourceInfo?.type === 'sql' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[0.625rem] font-semibold" title={`${dataSourceInfo.name}${dataSourceInfo.meta ? ' · ' + dataSourceInfo.meta : ''}`}>
                            <Database size={10} /> SQL{dataSourceInfo.name ? ` · ${dataSourceInfo.name}` : ''}
                          </span>
                        ) : dataSourceInfo?.type === 'query' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[0.625rem] font-semibold">
                            <MessageSquare size={10} /> Query{dataSourceInfo.name ? ` · ${dataSourceInfo.name}` : ''}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[0.625rem] text-ink-400">
                            <FileText size={10} className="text-green-600" /> Excel · Invoice_Master.xlsx
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex-1" />
                  {/* Right — conditional controls per tab */}
                  <div className="flex items-center shrink-0">
                    {/* Drill up/down/double — only on Visualization */}
                    {activeTab === 'visualization' && !isTable && (
                      <>
                        <button onClick={() => addToast({ message: 'Drilled up', type: 'info' })} className="p-2.5 text-ink-400 hover:text-ink-700 hover:bg-surface-2 transition-colors cursor-pointer" title="Drill up">
                          <IconDrillUp />
                        </button>
                        <button onClick={() => addToast({ message: 'Drill down', type: 'info' })} className="p-2.5 text-ink-400 hover:text-ink-700 hover:bg-surface-2 transition-colors cursor-pointer" title="Drill down">
                          <IconDrillDown />
                        </button>
                        <button onClick={() => addToast({ message: 'Double drill', type: 'info' })} className="p-2.5 text-ink-400 hover:text-ink-700 hover:bg-surface-2 transition-colors cursor-pointer" title="Double drill">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                            <path d="M5 3V8" /><path d="M3 6L5 8L7 6" />
                            <path d="M11 3V8" /><path d="M9 6L11 8L13 6" />
                            <path d="M4 11h8" />
                          </svg>
                        </button>
                        <div className="w-px h-8 bg-canvas-border mx-2" />
                      </>
                    )}


                    {/* Filter + Settings — hidden on Summary and KPI detail */}
                    {activeTab !== 'summary' && !isKpiDetail && (<>
                    <div className="relative">
                      <button
                        ref={vizFilterBtnRef}
                        onClick={() => setShowVizFilter(!showVizFilter)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-[0.8125rem] font-medium transition-colors cursor-pointer rounded-lg ${
                          showVizFilter || vizFilterCount > 0
                            ? 'text-brand-700 bg-brand-50'
                            : 'text-ink-500 hover:text-ink-700 hover:bg-surface-2'
                        }`}
                      >
                        <Filter size={15} />
                        <span>Filter</span>
                        {vizFilterCount > 0 && (
                          <span className="ml-0.5 size-4 bg-brand-600 text-white text-[0.5625rem] font-bold rounded-full flex items-center justify-center">{vizFilterCount}</span>
                        )}
                      </button>

                      {showVizFilter && vizFilterBtnRef.current && (
                        <>
                          <div className="fixed inset-0 z-[9998]" onClick={() => setShowVizFilter(false)} />
                          <div
                            className="fixed z-[9999] w-[220px] bg-white rounded-2xl shadow-xl border border-canvas-border/50"
                            style={{
                              top: vizFilterBtnRef.current.getBoundingClientRect().bottom + 6,
                              right: window.innerWidth - vizFilterBtnRef.current.getBoundingClientRect().right,
                            }}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-canvas-border/40">
                              <span className="text-[0.75rem] font-bold text-ink-900 uppercase tracking-wide">Filters</span>
                              {vizFilterCount > 0 && (
                                <button onClick={() => setVizFilterSelections({})} className="text-[0.6875rem] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
                                  Clear
                                </button>
                              )}
                            </div>

                            {/* Sections */}
                            <div className="max-h-[260px] overflow-y-auto">
                              {VIZ_FILTER_SECTIONS.map((section, si) => {
                                const isOpen = vizFilterOpen[section.id] ?? (si === 0);
                                const selected = vizFilterSelections[section.id] || [];
                                const search = vizFilterSearch[section.id] || '';
                                const filtered = section.values.filter(v => v.toLowerCase().includes(search.toLowerCase()));
                                const allSelected = filtered.length > 0 && filtered.every(v => selected.includes(v));
                                return (
                                  <div key={section.id} className="border-b border-canvas-border/30 last:border-0">
                                    {/* Section header */}
                                    <button
                                      onClick={() => setVizFilterOpen(prev => ({ ...prev, [section.id]: !isOpen }))}
                                      className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-2/40 transition-colors cursor-pointer"
                                    >
                                      <span className={`text-[0.6875rem] font-bold uppercase tracking-wide ${selected.length > 0 ? 'text-brand-700' : 'text-ink-500'}`}>
                                        {section.label}
                                      </span>
                                      <ChevronDown size={14} className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Expanded content */}
                                    {isOpen && (
                                      <div className="px-3.5 pb-3">
                                        {/* Search */}
                                        <div className="relative mb-2">
                                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                                          <input
                                            type="text"
                                            placeholder={`Search ${section.label.toLowerCase()}...`}
                                            value={search}
                                            onChange={e => setVizFilterSearch(prev => ({ ...prev, [section.id]: e.target.value }))}
                                            className="w-full h-8 pl-8 pr-2 bg-ink-50 rounded-lg text-[0.6875rem] text-ink-800 placeholder:text-ink-400 outline-none focus:bg-white focus:ring-1 focus:ring-brand-200 transition-all"
                                          />
                                        </div>

                                        {/* Select All */}
                                        <button
                                          onClick={() => {
                                            if (allSelected) setVizFilterSelections(prev => ({ ...prev, [section.id]: selected.filter(s => !filtered.includes(s)) }));
                                            else setVizFilterSelections(prev => ({ ...prev, [section.id]: [...new Set([...selected, ...filtered])] }));
                                          }}
                                          className="w-full flex items-center gap-2 py-1.5 cursor-pointer text-left"
                                        >
                                          <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                                            allSelected ? 'border-brand-600 bg-brand-600' : 'border-ink-300'
                                          }`}>
                                            {allSelected && <svg viewBox="0 0 12 12" fill="none" className="size-2"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                          </div>
                                          <span className="text-[0.6875rem] font-semibold text-ink-800">Select All</span>
                                        </button>

                                        {/* Options */}
                                        {filtered.map(val => (
                                          <button
                                            key={val}
                                            onClick={() => {
                                              setVizFilterSelections(prev => {
                                                const cur = prev[section.id] || [];
                                                return { ...prev, [section.id]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
                                              });
                                            }}
                                            className="w-full flex items-center gap-2 py-1.5 cursor-pointer text-left"
                                          >
                                            <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
                                              selected.includes(val) ? 'border-brand-600 bg-brand-600' : 'border-ink-300'
                                            }`}>
                                              {selected.includes(val) && <svg viewBox="0 0 12 12" fill="none" className="size-2"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                            </div>
                                            <span className={`text-[0.6875rem] ${selected.includes(val) ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>{val}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-8 bg-canvas-border mx-2" />

                    {/* Settings — opens threshold alert modal */}
                    <button onClick={() => setShowThresholdModal(true)} className="p-2.5 text-ink-400 hover:text-ink-700 hover:bg-surface-2 transition-colors cursor-pointer" title="Set Threshold Alert">
                      <Settings size={16} />
                    </button>
                    </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Content ── */}
            <div className="flex-1 flex overflow-hidden">
              {/* Main scrollable content */}
              <div className="flex-1 overflow-auto">
              <AnimatePresence mode="wait">
                {/* VISUALIZATION */}
                {activeTab === 'visualization' && (
                  <motion.div key="viz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-4 pb-2 h-full flex flex-col">
                    {title.toLowerCase().includes('status') || title.toLowerCase().includes('pie') || title.toLowerCase().includes('distribution') ? (
                      <div className="flex-1 min-h-[500px]">{children}</div>
                    ) : (
                      <ExpandedChartScroller>{children}</ExpandedChartScroller>
                    )}
                  </motion.div>
                )}

                {/* RECORDS */}
                {activeTab === 'records' && (
                  <motion.div key="records" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 h-full flex flex-col">
                    {isTable ? (
                      <div className="flex-1 overflow-auto chart-scroll">{children}</div>
                    ) : isExcelDashboard ? (
                    <>
                    {/* Search */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          placeholder="Search by invoice, vendor, department, sheet..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas-elevated focus:outline-none focus:border-brand-400 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Excel raw data table */}
                    <div className="bg-canvas-elevated rounded-xl border border-canvas-border overflow-auto chart-scroll" style={{ maxHeight: '70vh' }}>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-canvas-border bg-surface-2/50">
                            {EXCEL_RAW_HEADERS.map(h => (
                              <th key={h} className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredExcelRows.map((r, i) => {
                            const hasIssue = !r.vendor || !r.department || r.amount.includes('INR') || r.date.includes('/25/') || r.gst.length < 15 || r.amount.includes('9,84,500') || (i > 0 && filteredExcelRows.findIndex(x => x.invoiceId === r.invoiceId) !== i);
                            return (
                            <motion.tr
                              key={`${r.row}-${i}`}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className={`border-b border-canvas-border/50 last:border-0 transition-colors cursor-pointer ${hasIssue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-brand-50/30'}`}
                            >
                              <td className="px-4 py-3 text-[0.75rem] font-mono text-ink-400">{r.row}</td>
                              <td className="px-4 py-3 text-[0.75rem] font-semibold text-brand-700">{r.invoiceId}</td>
                              <td className={`px-4 py-3 text-[0.75rem] ${r.vendor ? 'text-ink-800' : 'text-red-400 italic'}`}>{r.vendor || '— blank —'}</td>
                              <td className={`px-4 py-3 text-[0.75rem] font-medium ${r.amount.includes('INR') || r.amount.includes('9,84,500') ? 'text-red-600' : 'text-ink-900'}`}>{r.amount}</td>
                              <td className={`px-4 py-3 text-[0.75rem] ${r.date.includes('/25/') ? 'text-red-600' : 'text-ink-600'}`}>{r.date}</td>
                              <td className={`px-4 py-3 text-[0.75rem] ${r.department ? 'text-ink-600' : 'text-red-400 italic'}`}>{r.department || '— blank —'}</td>
                              <td className={`px-4 py-3 text-[0.75rem] font-mono ${r.gst.length < 15 ? 'text-red-600' : 'text-ink-500'}`}>{r.gst}</td>
                              <td className="px-4 py-3 text-[0.75rem] text-ink-600">{r.payment}</td>
                              <td className="px-4 py-3"><span className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">{r.sheet}</span></td>
                            </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </>
                    ) : (
                    <>
                    {/* Search + Download */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                        <input
                          type="text"
                          placeholder="Search by invoice, vendor, department..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 text-[0.8125rem] border border-canvas-border rounded-lg bg-canvas-elevated focus:outline-none focus:border-brand-400 transition-colors"
                        />
                      </div>
                      <button
                        onClick={() => addToast({ message: 'Downloading records as CSV...', type: 'success' })}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[0.75rem] font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </div>

                    {/* Table */}
                    <div className="bg-canvas-elevated rounded-xl border border-canvas-border overflow-auto chart-scroll" style={{ maxHeight: '70vh' }}>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-canvas-border bg-surface-2/50">
                            {['Invoice ID', 'Vendor', 'Amount', 'Date', 'Status', 'Department', 'Risk', 'Duplicate Match'].map(h => (
                              <th key={h} className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecords.map((r, i) => (
                            <motion.tr
                              key={r.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="border-b border-canvas-border/50 last:border-0 hover:bg-brand-50/30 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3 text-[0.75rem] font-semibold text-brand-700">{r.id}</td>
                              <td className="px-4 py-3 text-[0.75rem] text-ink-800">{r.vendor}</td>
                              <td className="px-4 py-3 text-[0.75rem] font-medium text-ink-900">{r.amount}</td>
                              <td className="px-4 py-3 text-[0.75rem] text-ink-600">{r.date}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] || 'bg-gray-50 text-gray-600'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[0.75rem] text-ink-600">{r.department}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full ${RISK_COLORS[r.risk] || ''}`}>
                                  {r.risk}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[0.75rem] text-ink-500 font-mono">{r.match}</td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                    )}
                  </motion.div>
                )}

                {/* SUMMARY — structured report */}
                {activeTab === 'summary' && (
                  <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0 p-6">
                    <div className="flex-1 overflow-y-auto pr-2">
                      <div className="bg-brand-50/60 rounded-xl p-8 space-y-8">
                        {/* Query */}
                        <div>
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-1 h-6 bg-brand-600 rounded-full" />
                              <h3 className="text-[0.875rem] font-semibold text-ink-900">Query</h3>
                            </div>
                            <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] rounded-lg transition-colors cursor-pointer font-medium">
                              Ask IRA
                              <Send size={13} className="-rotate-45" />
                            </button>
                          </div>
                          <p className="text-[0.8125rem] text-ink-700 leading-[1.7]">
                            Analyze the current compliance posture across all business processes. Identify key risk areas, control gaps, and provide actionable recommendations for the audit committee.
                          </p>
                        </div>

                        {/* Answer */}
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-1 h-6 bg-brand-600 rounded-full" />
                            <h3 className="text-[0.875rem] font-semibold text-ink-900">Answer</h3>
                          </div>
                          <div className="space-y-3">
                            {[
                              'The analysis reveals that P2P compliance has improved to 94.2% following the vendor master cleanup, but 3 new duplicate flags from Acme Corp & Global Supplies require immediate attention.',
                              'Processing time is trending favorably at 1.8 days, down from 2.3 days last quarter, indicating operational efficiency gains from the automated detection workflows.',
                              'One new vendor (Atlas Manufacturing) is pending KYC verification — expediting this before the next payment batch would prevent processing delays estimated at ₹2.1L.',
                              'SOD violations detected in the AP module represent the highest-priority remediation item, as user JSmith currently has both invoice approval and payment release access.',
                            ].map((text, i) => (
                              <div key={i} className="flex gap-3">
                                <span className="flex-shrink-0 w-1.5 h-1.5 bg-brand-600 rounded-full mt-2" />
                                <p className="text-[0.8125rem] text-ink-700 leading-[1.7] flex-1">{text}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Observations */}
                        <div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-1 h-6 bg-brand-600 rounded-full" />
                            <h3 className="text-[0.875rem] font-semibold text-ink-900">Observations</h3>
                          </div>
                          <div className="space-y-3">
                            {[
                              '2 critical risks in P2P have zero controls mapped, creating a compliance gap that should be addressed before the next SOX review cycle in 6 days.',
                              'The correlation between vendor onboarding speed and duplicate invoice flags suggests that expedited KYC processes may inadvertently reduce detection accuracy.',
                              'Regional performance varies significantly — APAC dispute rates are trending upward while EMEA shows consistent improvement, suggesting localized strategies would yield better results.',
                              '3 audit findings from Q1 remain open past their remediation deadline, which could impact the overall compliance score if not resolved within the current reporting period.',
                            ].map((text, i) => (
                              <div key={i} className="flex gap-3">
                                <span className="flex-shrink-0 w-1.5 h-1.5 bg-brand-600 rounded-full mt-2" />
                                <p className="text-[0.8125rem] text-ink-700 leading-[1.7] flex-1">{text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>

              {/* ── Edit Widget Sidebar ── */}
              <AnimatePresence>
                {showEditSidebar && (
                  <motion.div
                    key="edit-sidebar"
                    initial={{ x: 340, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 340, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                    className="flex flex-col border-l border-canvas-border bg-white shrink-0 overflow-hidden"
                    style={{ width: 340 }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Tabs */}
                    <div className="flex shrink-0 border-b border-canvas-border">
                      <button
                        onClick={() => setEditSidebarTab('datasource')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[0.75rem] font-medium border-b-2 transition-colors cursor-pointer ${
                          editSidebarTab === 'datasource' ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
                        }`}
                      >
                        <Database size={13} />
                        Data Source
                      </button>
                      <button
                        onClick={() => setEditSidebarTab('customize')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[0.75rem] font-medium border-b-2 transition-colors cursor-pointer ${
                          editSidebarTab === 'customize' ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
                        }`}
                      >
                        <Settings size={13} />
                        Customize
                      </button>
                    </div>

                    {/* Tab content — scrollable */}
                    <div className="flex-1 overflow-y-auto">
                      {editSidebarTab === 'datasource' && (() => {
                        const CHART_TYPES = [
                          { id: 'kpi', label: 'KPI Cards', Icon: Hash },
                          { id: 'clustered-column', label: 'Clustered Column Chart', Icon: BarChart3 },
                          { id: 'stacked-column', label: 'Stacked Column Chart', Icon: BarChart3 },
                          { id: 'clustered-bar', label: 'Clustered Bar Chart', Icon: BarChart3 },
                          { id: 'stacked-bar', label: 'Stacked Bar Chart', Icon: BarChart3 },
                          { id: 'line', label: 'Line Chart', Icon: LineChart },
                          { id: 'area', label: 'Area Chart', Icon: AreaChart },
                          { id: 'pie', label: 'Pie Chart', Icon: PieChartIcon },
                          { id: 'line-clustered', label: 'Line & Clustered Column Chart', Icon: LineChart },
                          { id: 'table', label: 'Table', Icon: ListChecks },
                        ];

                        return (
                          <div className="p-3 space-y-2">
                            {/* AXIS FIELDS section — on top, hidden for Table */}
                            {editChartType !== 'table' && (
                            <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                              <button
                                onClick={() => setEditFieldsOpen(!editFieldsOpen)}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                              >
                                <div className="flex items-center gap-2">
                                  <Columns className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                  <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Fields</span>
                                </div>
                                <ChevronDown
                                  className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                                  style={{ transform: editFieldsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                />
                              </button>
                              {editFieldsOpen && (
                              <div className="p-2.5 space-y-2.5">
                                {editChartType !== 'pie' && editChartType !== 'kpi' && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-[0.6875rem] font-semibold text-[#26064a]">X Axis</label>
                                  <WhiteDropdown
                                    value={xField || 'Month'}
                                    onChange={v => onXFieldChange?.(v)}
                                    options={['Month', 'Week', 'Year', 'Date', 'Region', 'State', 'Vendor Name', 'Status', 'Category', 'Department'].map(f => ({ value: f, label: f }))}
                                    size="sm"
                                  />
                                </div>
                                )}
                                <div className="flex flex-col gap-1">
                                  <label className="text-[0.6875rem] font-semibold text-[#26064a]">Y Axis</label>
                                  <WhiteDropdown
                                    value={yField || 'Duplicate Count'}
                                    onChange={v => onYFieldChange?.(v)}
                                    options={['Duplicate Count', 'Duplicate Score (%)', 'Invoice Amount (₹)', 'Amount at Risk (₹)', 'Invoices Scanned', 'Duplicates Found', 'Detection Accuracy (%)', 'Processing Time (d)'].map(f => ({ value: f, label: f }))}
                                    size="sm"
                                  />
                                </div>
                                {editChartType !== 'kpi' && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-[0.6875rem] font-semibold text-[#26064a]">Legend</label>
                                  <WhiteDropdown
                                    value={legendField || ''}
                                    onChange={v => onLegendFieldChange?.(v)}
                                    options={[{ value: '', label: 'None' }, ...['Region', 'State', 'Vendor Name', 'Status', 'Category', 'Department'].map(f => ({ value: f, label: f }))]}
                                    size="sm"
                                  />
                                </div>
                                )}
                              </div>
                              )}
                            </div>
                            )}

                            {/* CHART TYPE section */}
                            <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                              <button
                                onClick={() => setEditChartTypeOpen(!editChartTypeOpen)}
                                className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                              >
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                  <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Chart Type</span>
                                </div>
                                <ChevronDown
                                  className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                                  style={{ transform: editChartTypeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                />
                              </button>
                              {editChartTypeOpen && (
                                <div className="bg-[#fafafa] py-1">
                                  {CHART_TYPES.map(({ id, label, Icon }) => (
                                    <button
                                      key={id}
                                      onClick={() => setEditChartType(id)}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-[0.75rem] transition-colors cursor-pointer text-left ${
                                        editChartType === id
                                          ? 'bg-brand-50 text-brand-700 font-medium'
                                          : 'text-ink-700 hover:bg-surface-2'
                                      }`}
                                    >
                                      <Icon size={14} className={editChartType === id ? 'text-brand-600' : 'text-ink-400'} />
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* DATA SOURCE section */}
                            <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                              <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white border-b border-[#f0f0f0]">
                                <div className="flex items-center gap-2">
                                  <Database className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                  <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Data Source</span>
                                </div>
                                <button
                                  onClick={() => onOpenAddData?.()}
                                  className="flex items-center gap-1 px-2 py-1 text-[0.625rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md transition-colors cursor-pointer shrink-0"
                                >
                                  <Plus size={10} />
                                  Add Data
                                </button>
                              </div>
                              <div className="px-3 pt-2.5 pb-2">
                                <div className="relative mb-2">
                                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                                  <input
                                    type="text"
                                    placeholder="Search fields..."
                                    value={editDataSearch}
                                    onChange={e => setEditDataSearch(e.target.value)}
                                    className="w-full pl-7 pr-3 py-1.5 text-[0.6875rem] bg-white border border-[#e5e7eb] rounded-[6px] text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 transition-all"
                                  />
                                </div>
                                <FileTreeView files={FILE_TREE_DATA} search={editDataSearch} />
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {editSidebarTab === 'customize' && (
                        <div className="p-3 space-y-2">
                          {/* GENERAL section */}
                          <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                            <button
                              onClick={() => setEditGeneralOpen(!editGeneralOpen)}
                              className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                            >
                              <div className="flex items-center gap-2">
                                <Palette className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">General</span>
                              </div>
                              <ChevronDown
                                className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                                style={{ transform: editGeneralOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                              />
                            </button>
                            {editGeneralOpen && (
                              <div className="bg-[#fafafa] p-2.5 space-y-3">
                                {/* Font Family */}
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[0.75rem] font-semibold text-[#26064a]">Font Family</label>
                                  <div className="relative">
                                    <select
                                      value={editFontFamily}
                                      onChange={e => setEditFontFamily(e.target.value)}
                                      className="w-full h-[32px] px-2.5 py-1.5 text-[0.6875rem] bg-white border border-[#e5e7eb] rounded-[6px] text-[#26064a] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm appearance-none cursor-pointer pr-7"
                                    >
                                      {['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Nunito', 'Raleway', 'PT Sans', 'Merriweather', 'Playfair Display'].map(f => (
                                        <option key={f} value={f}>{f}</option>
                                      ))}
                                    </select>
                                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] pointer-events-none" />
                                  </div>
                                </div>
                                {/* Bold / Italic / Underline */}
                                <div className="flex items-center bg-white rounded-[6px] border border-[#e5e7eb] overflow-hidden">
                                  <button
                                    onClick={() => setEditIsBold(!editIsBold)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 cursor-pointer ${editIsBold ? 'bg-[#6a12cd] text-white' : 'bg-white text-[#26064a] hover:bg-[#faf5ff]'}`}
                                  >
                                    <Bold className={`size-[14px] ${editIsBold ? 'text-white' : 'text-[#6a12cd]'}`} />
                                    <span className="text-[0.6875rem] font-medium">Bold</span>
                                  </button>
                                  <button
                                    onClick={() => setEditIsItalic(!editIsItalic)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 cursor-pointer ${editIsItalic ? 'bg-[#6a12cd] text-white' : 'bg-white text-[#26064a] hover:bg-[#faf5ff]'}`}
                                  >
                                    <Italic className={`size-[14px] ${editIsItalic ? 'text-white' : 'text-[#6a12cd]'}`} />
                                    <span className="text-[0.6875rem] font-medium">Italic</span>
                                  </button>
                                  <button
                                    onClick={() => setEditIsUnderline(!editIsUnderline)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-all duration-200 cursor-pointer ${editIsUnderline ? 'bg-[#6a12cd] text-white' : 'bg-white text-[#26064a] hover:bg-[#faf5ff]'}`}
                                  >
                                    <Underline className={`size-[14px] ${editIsUnderline ? 'text-white' : 'text-[#6a12cd]'}`} />
                                    <span className="text-[0.6875rem] font-medium">Underline</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* X AXIS section — hidden for Pie, KPI, Table */}
                          {editChartType !== 'pie' && editChartType !== 'kpi' && editChartType !== 'table' && !isTable && (
                          <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                            <button
                              onClick={() => setEditXAxisOpen(!editXAxisOpen)}
                              className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                            >
                              <div className="flex items-center gap-2">
                                <ArrowRight className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">X Axis</span>
                              </div>
                              <ChevronDown className="size-[14px] text-[#6a12cd] transition-transform duration-200" style={{ transform: editXAxisOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </button>
                            {editXAxisOpen && (
                              <div className="bg-[#fafafa] p-2.5 space-y-3">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[0.75rem] font-medium text-[#26064a]">Title</label>
                                  <input type="text" value={editXAxisTitleVal} onChange={e => onCustomizeChange?.('xAxisTitle', e.target.value)} placeholder="Enter X Axis Title" className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm" />
                                </div>
                              </div>
                            )}
                          </div>
                          )}

                          {/* Y AXIS section — hidden for Pie, KPI, Table */}
                          {editChartType !== 'pie' && editChartType !== 'kpi' && editChartType !== 'table' && !isTable && (
                          <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                            <button
                              onClick={() => setEditYAxisOpen(!editYAxisOpen)}
                              className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                            >
                              <div className="flex items-center gap-2">
                                <MoveVertical className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Y Axis</span>
                              </div>
                              <ChevronDown className="size-[14px] text-[#6a12cd] transition-transform duration-200" style={{ transform: editYAxisOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </button>
                            {editYAxisOpen && (
                              <div className="bg-[#fafafa] p-2.5 space-y-3">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[0.75rem] font-medium text-[#26064a]">Title</label>
                                  <input type="text" value={editYAxisTitleVal} onChange={e => onCustomizeChange?.('yAxisTitle', e.target.value)} placeholder="Enter Y Axis Title" className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm" />
                                </div>
                              </div>
                            )}
                          </div>
                          )}

                          {/* LEGEND section — hidden for KPI, Table */}
                          {editChartType !== 'kpi' && editChartType !== 'table' && !isTable && (
                            <LegendSection />
                          )}

                          {/* DATA LABELS section — hidden for Table, Scatter */}
                          {editChartType !== 'table' && editChartType !== 'scatter' && !isTable && (
                            <TypographySection />
                          )}

                          {/* RANGE (Y AXIS) section — hidden for Pie, KPI, Table */}
                          {editChartType !== 'pie' && editChartType !== 'kpi' && editChartType !== 'table' && !isTable && (
                          <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                            <button
                              onClick={() => setEditRangeOpen(!editRangeOpen)}
                              className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                            >
                              <div className="flex items-center gap-2">
                                <MoveVertical className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                                <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Range (Y Axis)</span>
                              </div>
                              <ChevronDown
                                className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                                style={{ transform: editRangeOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                              />
                            </button>
                            {editRangeOpen && (
                              <div className="p-2.5 bg-[#fafafa] space-y-3">
                                <div className="flex gap-2">
                                  <div className="flex-1 flex flex-col gap-1.5">
                                    <label className="text-[0.75rem] font-medium text-[#26064a]">Minimum</label>
                                    <input
                                      type="text"
                                      value={editMinimum}
                                      onChange={e => setEditMinimum(e.target.value)}
                                      placeholder="Auto"
                                      className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                                    />
                                  </div>
                                  <div className="flex-1 flex flex-col gap-1.5">
                                    <label className="text-[0.75rem] font-medium text-[#26064a]">Maximum</label>
                                    <input
                                      type="text"
                                      value={editMaximum}
                                      onChange={e => setEditMaximum(e.target.value)}
                                      placeholder="Auto"
                                      className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className="text-[0.75rem] font-medium text-[#26064a]">Invert Range</p>
                                  <button
                                    onClick={() => setEditInvertRange(!editInvertRange)}
                                    className={`relative w-[36px] h-[20px] rounded-[12px] transition-all cursor-pointer ${editInvertRange ? 'bg-[#6a12cd]' : 'bg-[#e5e7eb]'}`}
                                  >
                                    <div
                                      className="absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-all"
                                      style={{ left: editInvertRange ? '18px' : '2px' }}
                                    />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          )}

                          {/* CONDITIONAL FORMATTING section — all chart types */}
                          <ConditionalFormattingSection />

                          {/* DATA SERIES section — hidden for KPI, Table */}
                          {editChartType !== 'kpi' && editChartType !== 'table' && !isTable && (
                            <DataSeriesFormattingSection
                              series={(() => {
                                if (editChartType === 'pie') return ['Compliant', 'Non-Compliant', 'Under Review', 'Pending', 'Flagged'];
                                if (editChartType === 'line' || editChartType === 'line-clustered') return ['Actual', 'Target'];
                                if (editChartType === 'area') return ['Actual', 'Target'];
                                return ['Total', 'Resolved', 'Pending'];
                              })()}
                              seriesColors={{}}
                              onSeriesColorsChange={() => {}}
                              spacingType={editChartType === 'pie' ? 'pie' : ['clustered-column', 'stacked-column', 'clustered-bar', 'stacked-bar'].includes(editChartType) ? 'bar' : 'disabled'}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom CTA */}
                    <div className="shrink-0 px-4 py-3 border-t border-canvas-border bg-white flex gap-2">
                      <button
                        onClick={() => setShowEditSidebar(false)}
                        className="flex-1 py-2.5 bg-white border border-canvas-border hover:bg-surface-2 text-ink-700 text-[0.8125rem] font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          addToast({ message: 'Widget updated', type: 'success' });
                          setShowEditSidebar(false);
                        }}
                        className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-[0.8125rem] font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Update
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Delete confirmation */}
    <AnimatePresence>
      {showExpandDeleteConfirm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowExpandDeleteConfirm(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl w-[360px] p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="text-[1rem] font-bold text-ink-900">Delete Widget</h3>
            </div>
            <p className="text-[0.8125rem] text-ink-500 mb-5">Are you sure you want to delete <strong>"{expandTitle}"</strong>? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExpandDeleteConfirm(false)}
                className="px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-800 border border-canvas-border rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowExpandDeleteConfirm(false); onDelete?.(); }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-[0.8125rem] font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <ThresholdAlertModal
      open={showThresholdModal}
      onClose={() => setShowThresholdModal(false)}
      widgetTitle={title}
      addToast={addToast}
    />

    {/* Alert Notifications Modal */}
    {showAlertNotifications && (
      <>
        <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm" onClick={() => setShowAlertNotifications(false)} />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div
            className="pointer-events-auto bg-white rounded-[12px] border border-[#e5e7eb] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] w-[440px] max-h-[85vh] overflow-hidden font-['Inter',sans-serif]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#e5e7eb]">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#f4f0ff] flex items-center justify-center">
                  <AlertTriangle size={15} className="text-[#6a12cd]" />
                </div>
                <div>
                  <h2 className="text-[0.9375rem] font-bold text-[#26064a]">Alert Notifications</h2>
                  <p className="text-[0.6875rem] text-[#9ca3af]">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button onClick={() => setShowAlertNotifications(false)} className="p-1 rounded-md hover:bg-[#f9fafb] transition-colors cursor-pointer">
                <X size={16} className="text-[#9ca3af]" />
              </button>
            </div>

            {/* Alert list */}
            <div className="px-5 py-4 space-y-2.5 max-h-[400px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="size-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={20} className="text-green-500" />
                  </div>
                  <p className="text-[0.8125rem] font-medium text-[#26064a]">All clear!</p>
                  <p className="text-[0.6875rem] text-[#9ca3af] mt-0.5">No threshold alerts triggered.</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 bg-[#fafafa] border border-[#e5e7eb] rounded-[8px] px-4 py-3 hover:bg-[#f5f0ff] transition-colors">
                    <div className="size-7 rounded-md bg-[#f4f0ff] flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={13} className="text-[#6a12cd]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[0.75rem] font-semibold text-[#26064a]">{alert.title}</span>
                      <p className="text-[0.6875rem] text-[#6b7280] mt-0.5 leading-relaxed">{alert.message}</p>
                      <p className="text-[0.625rem] text-[#9ca3af] mt-1">{alert.time}</p>
                    </div>
                    <button
                      onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                      className="shrink-0 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <X size={12} className="text-[#9ca3af] hover:text-red-500" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#e5e7eb]">
              <button
                onClick={() => { setAlerts([]); }}
                className="text-[0.6875rem] font-semibold text-[#6a12cd] hover:text-[#5a0ebd] cursor-pointer"
              >
                Clear all
              </button>
              <button
                onClick={() => setShowAlertNotifications(false)}
                className="px-4 py-1.5 bg-[#6a12cd] hover:bg-[#5a0ebd] text-white rounded-[8px] text-[0.75rem] font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}

// ─── Threshold Alert Modal ───────────────────────────────────────────────────

function ThresholdAlertModal({ open, onClose, widgetTitle, addToast }: {
  open: boolean;
  onClose: () => void;
  widgetTitle: string;
  addToast: (t: { message: string; type: ToastType }) => void;
}) {
  const [thresholdValue, setThresholdValue] = useState('2503');
  const [condition, setCondition] = useState('');
  const [emailNotification, setEmailNotification] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-[12px] border border-[#e5e7eb] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] w-[440px] max-h-[85vh] overflow-hidden font-['Inter',sans-serif]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
            <div>
              <h2 className="text-[0.875rem] font-bold text-[#26064a]">Set Threshold Alert</h2>
              <p className="text-[0.6875rem] text-[#9ca3af] mt-0.5">{widgetTitle}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-[#f9fafb] transition-colors cursor-pointer">
              <X size={16} className="text-[#9ca3af]" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-3">
            {/* Threshold + Condition in one row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[0.6875rem] font-semibold text-[#26064a] block mb-1">Threshold Value</label>
                <input
                  type="number"
                  value={thresholdValue}
                  onChange={e => setThresholdValue(e.target.value)}
                  className="w-full px-3 py-2 text-[0.75rem] border border-[rgba(38,6,74,0.2)] rounded-[8px] bg-white text-[#26064a] outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="text-[0.6875rem] font-semibold text-[#26064a] block mb-1">Condition</label>
                <div className="relative">
                  <select
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                    className="w-full px-3 py-2 text-[0.75rem] border border-[rgba(38,6,74,0.2)] rounded-[8px] bg-white text-[#26064a] outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="">Select</option>
                    <option value="greater">Greater than (&gt;)</option>
                    <option value="less">Less than (&lt;)</option>
                    <option value="equal">Equal to (=)</option>
                    <option value="greater_equal">≥ Greater or equal</option>
                    <option value="less_equal">≤ Less or equal</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Email Notification */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#6a12cd]" />
                <span className="text-[0.75rem] font-semibold text-[#26064a]">Email Notification</span>
              </div>
              <button
                onClick={() => setEmailNotification(!emailNotification)}
                className={`relative rounded-full transition-colors cursor-pointer ${emailNotification ? 'bg-[#6a12cd]' : 'bg-[#d1d5db]'}`}
                style={{ width: 36, height: 20 }}
              >
                <div className={`absolute top-[2px] size-[16px] bg-white rounded-full shadow transition-all ${emailNotification ? 'left-[18px]' : 'left-[2px]'}`} />
              </button>
            </div>
            {emailNotification && (
              <>
                {emailList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {emailList.map((email, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f4f0ff] border border-[#6a12cd]/20 rounded-md text-[0.625rem] text-[#6a12cd] font-medium">
                        {email}
                        <button onClick={() => setEmailList(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500 cursor-pointer"><X size={9} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={e => setNotifyEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && notifyEmail.trim() && notifyEmail.includes('@')) {
                      e.preventDefault();
                      setEmailList(prev => [...prev, notifyEmail.trim()]);
                      setNotifyEmail('');
                    }
                  }}
                  placeholder={emailList.length > 0 ? "Add another email..." : "Enter email and press Enter"}
                  className="w-full px-3 py-2 text-[0.75rem] border border-[rgba(38,6,74,0.2)] rounded-[8px] bg-white text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 py-3 border-t border-[#f0f0f0]">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-[#e5e7eb] rounded-[8px] text-[0.75rem] font-semibold text-[#26064a] hover:bg-[#f9fafb] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                addToast({ message: 'Threshold alert saved', type: 'success' });
                onClose();
              }}
              className="flex-1 py-2 bg-[#6a12cd] hover:bg-[#5a0ebd] text-white rounded-[8px] text-[0.75rem] font-semibold transition-colors cursor-pointer"
            >
              Save Alert
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Chart Skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton({ type = 'bar' }: { type?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 animate-pulse">
      {type === 'pie' ? (
        <div className="size-32 rounded-full border-[12px] border-ink-100" />
      ) : type === 'table' ? (
        <div className="w-full space-y-2.5 px-4">
          <div className="h-3 bg-ink-100 rounded w-full" />
          <div className="h-3 bg-ink-100 rounded w-[90%]" />
          <div className="h-3 bg-ink-100 rounded w-[95%]" />
          <div className="h-3 bg-ink-100 rounded w-[85%]" />
          <div className="h-3 bg-ink-100 rounded w-[92%]" />
        </div>
      ) : type === 'line' ? (
        <svg width="200" height="80" viewBox="0 0 200 80" className="opacity-30">
          <polyline points="0,60 30,45 60,55 90,30 120,40 150,20 180,35 200,15" fill="none" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" />
          <polyline points="0,60 30,45 60,55 90,30 120,40 150,20 180,35 200,15 200,80 0,80" fill="#e5e7eb" fillOpacity="0.3" />
        </svg>
      ) : (
        <div className="flex items-end gap-2 h-32">
          {[40, 65, 50, 80, 55, 70].map((h, i) => (
            <div key={i} className="w-6 rounded-t bg-ink-100" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <div className="h-2 w-16 bg-ink-100 rounded" />
        <div className="h-2 w-12 bg-ink-100 rounded" />
        <div className="h-2 w-14 bg-ink-100 rounded" />
      </div>
    </div>
  );
}

function WidgetRefreshOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.6)' }}>
      <div className="flex flex-col items-center gap-2">
        <svg className="size-8 animate-spin" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="13" stroke="#e5e7eb" strokeWidth="3" />
          <path d="M29 16a13 13 0 0 0-13-13" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-[0.6875rem] font-medium text-ink-500">Updating...</span>
      </div>
    </div>
  );
}

// ─── Widget Card ────────────────────────────────────────────────────────────

function WidgetCard({
  title,
  subtitle,
  children,
  onExpand,
  onEdit,
  onDelete,
  onFilter,
  addToast,
  widgetFields,
  dataLinks: dataLinksFromParent,
  onRemovePageFilter,
  onClearPageFilters,
  colSpan = 1,
  onChangeSize,
  onMoveUp,
  onMoveDown,
  loading,
  isFirstLoad,
  chartType,
  hideDrill,
  dataSourceInfo,
  hasAlert,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onExpand?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFilter?: () => void;
  addToast: (t: { message: string; type: ToastType }) => void;
  pageFilterFields?: string[];
  widgetFields?: string[];
  dataLinks?: FieldLink[];
  onRemovePageFilter?: (id: string) => void;
  onClearPageFilters?: () => void;
  colSpan?: 1 | 2;
  onChangeSize?: (span: 1 | 2) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  loading?: boolean;
  isFirstLoad?: boolean;
  chartType?: string;
  hideDrill?: boolean;
  dataSourceInfo?: { type: 'sql' | 'excel' | 'csv' | 'query'; name: string; meta: string };
  hasAlert?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [localSubtitle, setLocalSubtitle] = useState(subtitle || '');
  const [widgetFilterSelections, setWidgetFilterSelections] = useState<Record<string, string[]>>({});
  const [widgetFilterSearch, setWidgetFilterSearch] = useState<Record<string, string>>({});
  const [widgetFilterOpen, setWidgetFilterOpen] = useState<Record<string, boolean>>({});
  const [drillLevel, setDrillLevel] = useState(0);
  const [drillModeActive, setDrillModeActive] = useState(false);
  const [hovered, setHovered] = useState(false);

  const SAMPLE_VALUES: Record<string, string[]> = {
    date: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
    month: ['January', 'February', 'March', 'April', 'May', 'June'],
    week: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    region: ['North', 'South', 'East', 'West', 'Central'],
    state: ['Maharashtra', 'Delhi NCR', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan'],
    vendor_name: ['Acme Corp', 'Global Tech', 'InfoSys Ltd', 'TCS', 'Wipro', 'HCL'],
    status: ['Compliant', 'Non-Compliant', 'Under Review', 'Pending', 'Flagged'],
    category: ['Travel', 'Office Supplies', 'IT Equipment', 'Consulting', 'Marketing'],
    department: ['Finance', 'Procurement', 'IT', 'Legal', 'Operations', 'HR'],
    invoice_no: ['INV-001', 'INV-002', 'INV-003', 'INV-004', 'INV-005'],
    amount: ['< 1,000', '1,000 - 5,000', '5,000 - 10,000', '10,000 - 50,000', '> 50,000'],
    risk_score: ['Critical', 'High', 'Medium', 'Low'],
    compliance_rate: ['> 95%', '90-95%', '85-90%', '< 85%'],
  };
  const getFilterValues = (fieldId: string) => SAMPLE_VALUES[fieldId] || ['Value 1', 'Value 2', 'Value 3', 'Value 4', 'Value 5'];
  const activeFilterCount = Object.values(widgetFilterSelections).reduce((sum, arr) => sum + arr.length, 0);

  const handleDrillUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (drillLevel <= 0) {
      addToast({ message: 'Already at top level', type: 'info' });
      return;
    }
    setDrillLevel(prev => prev - 1);
    setDrillModeActive(false);
    addToast({ message: 'Drilled up', type: 'success' });
  };

  const handleDrillDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (drillLevel >= 2) {
      addToast({ message: 'Already at deepest level', type: 'info' });
      return;
    }
    if (!drillModeActive) {
      setDrillModeActive(true);
      addToast({ message: 'Drill mode ON — click a data point to drill', type: 'success' });
    } else {
      setDrillModeActive(false);
      addToast({ message: 'Drill mode OFF', type: 'info' });
    }
  };

  return (
    <div
      className={`glass-card rounded-xl transition-all duration-300 group relative flex flex-col cursor-pointer ${colSpan === 2 ? 'lg:col-span-2' : ''}`}
      style={{ minHeight: 260, maxHeight: 800 }}
      onClick={() => onExpand?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-0">
        {/* Drag handle */}
        {(onMoveUp || onMoveDown) && (
          <div className={`flex flex-col gap-0.5 mr-3 shrink-0 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => onMoveUp?.()}
              disabled={!onMoveUp}
              className={`p-0.5 rounded transition-colors ${onMoveUp ? 'text-ink-400 hover:text-brand-600 hover:bg-brand-50 cursor-pointer' : 'text-ink-200 cursor-not-allowed'}`}
              title="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => onMoveDown?.()}
              disabled={!onMoveDown}
              className={`p-0.5 rounded transition-colors ${onMoveDown ? 'text-ink-400 hover:text-brand-600 hover:bg-brand-50 cursor-pointer' : 'text-ink-200 cursor-not-allowed'}`}
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={localTitle}
              onChange={e => setLocalTitle(e.target.value)}
              onBlur={e => { if (!e.relatedTarget?.closest('[data-rename-group]')) { setEditingTitle(false); setEditingSubtitle(false); } }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditingTitle(false); setEditingSubtitle(false); } }}
              onClick={e => e.stopPropagation()}
              data-rename-group=""
              className="text-[0.9375rem] font-semibold text-ink-900 w-full bg-transparent border-none outline-none ring-0 shadow-none" style={{ outline: 'none', boxShadow: 'none' }}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <h3
                className="text-[0.9375rem] font-semibold text-ink-900 truncate hover:text-brand-600 transition-colors cursor-pointer"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); setEditingSubtitle(true); }}
              >{localTitle}</h3>
              {hasAlert && <Bell size={13} className="text-warning shrink-0" />}
            </div>
          )}
          {editingSubtitle ? (
            <input
              value={localSubtitle}
              onChange={e => setLocalSubtitle(e.target.value)}
              onBlur={e => { if (!e.relatedTarget?.closest('[data-rename-group]')) { setEditingTitle(false); setEditingSubtitle(false); } }}
              onKeyDown={e => { if (e.key === 'Enter') { setEditingTitle(false); setEditingSubtitle(false); } }}
              onClick={e => e.stopPropagation()}
              placeholder="Add description..."
              data-rename-group=""
              className="text-[0.75rem] text-ink-500 mt-1 w-full bg-transparent border-none outline-none ring-0 shadow-none" style={{ outline: 'none', boxShadow: 'none' }}
            />
          ) : (
            <div className="flex items-center gap-2 mt-0.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); setEditingSubtitle(true); }}>
              {localSubtitle && <p className="text-[0.6875rem] text-ink-500 truncate">{localSubtitle}</p>}
              {localSubtitle && <span className="text-ink-300 text-[0.5625rem]">·</span>}
              {dataSourceInfo?.type === 'sql' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[0.5625rem] font-semibold shrink-0" title={`${dataSourceInfo.name}${dataSourceInfo.meta ? ' · ' + dataSourceInfo.meta : ''}`}>
                  <Database size={8} /> SQL
                </span>
              ) : dataSourceInfo?.type === 'query' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[0.5625rem] font-semibold shrink-0">
                  <MessageSquare size={8} /> Query
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[0.5625rem] text-ink-400 shrink-0"><FileText size={8} className="text-green-600" /> Excel</span>
              )}
              {dataLinksFromParent && dataLinksFromParent.length > 0 && (() => {
                const widgetLabels = (widgetFields || []).map(id => DRAG_FIELDS.find(f => f.id === id)?.label).filter(Boolean);
                const relevantCount = dataLinksFromParent.filter(l => widgetLabels.includes(l.fieldA) || widgetLabels.includes(l.fieldB)).length;
                if (relevantCount === 0) return null;
                return (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-evidence-50 text-evidence-700 text-[0.5625rem] font-semibold shrink-0">
                    <Link2 size={8} />{relevantCount} linked
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Toolbar — visible on hover */}
        <div
          onClick={e => e.stopPropagation()}
          className={`flex items-center gap-0.5 bg-canvas-elevated border border-canvas-border rounded-lg px-0.5 py-0.5 transition-opacity duration-150 ${
            hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Drill Up/Down — hidden for tables */}
          {!hideDrill && (
            <>
              <ToolbarBtn onClick={handleDrillUp} disabled={drillLevel <= 0} tip="Drill up">
                <IconDrillUp />
              </ToolbarBtn>
              <ToolbarBtn onClick={handleDrillDown} active={drillModeActive} disabled={drillLevel >= 2} tip={drillLevel >= 2 ? 'Already at deepest level' : 'Drill down'}>
                <IconDrillDown />
              </ToolbarBtn>
            </>
          )}

          {/* Filter */}
          <div className="relative">
            <ToolbarBtn
              onClick={(e) => { e.stopPropagation(); setShowFilterDropdown(!showFilterDropdown); }}
              active={showFilterDropdown || activeFilterCount > 0}
              tip="Widget filters"
            >
              <Filter size={13} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 size-3.5 bg-brand-600 text-white text-[0.5rem] font-bold rounded-full flex items-center justify-center">{activeFilterCount}</span>
              )}
            </ToolbarBtn>

            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowFilterDropdown(false); }} />
                <div className="absolute top-full right-0 z-40 mt-1 w-[220px] bg-white border border-canvas-border/50 rounded-2xl shadow-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-canvas-border/40">
                    <span className="text-[0.75rem] font-bold text-ink-900 uppercase tracking-wide">Filters</span>
                    {activeFilterCount > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); setWidgetFilterSelections({}); }} className="text-[0.6875rem] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer">
                        Clear
                      </button>
                    )}
                  </div>
                  {/* Sections */}
                  <div className="max-h-[260px] overflow-y-auto">
                    {DRAG_FIELDS.filter(f => f.kind === 'dimension').slice(0, 4).map((field, si) => {
                      const values = getFilterValues(field.id);
                      const selected = widgetFilterSelections[field.id] || [];
                      const search = widgetFilterSearch[field.id] || '';
                      const filtered = values.filter(v => v.toLowerCase().includes(search.toLowerCase()));
                      const isOpen = widgetFilterOpen[field.id] ?? (si === 0);
                      const allSelected = filtered.length > 0 && filtered.every(v => selected.includes(v));
                      return (
                        <div key={field.id} className="border-b border-canvas-border/30 last:border-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setWidgetFilterOpen(prev => ({ ...prev, [field.id]: !isOpen })); }}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-2/40 transition-colors cursor-pointer"
                          >
                            <span className={`text-[0.6875rem] font-bold uppercase tracking-wide ${selected.length > 0 ? 'text-brand-700' : 'text-ink-500'}`}>
                              {field.label}
                            </span>
                            <ChevronDown size={14} className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="px-3.5 pb-3">
                              <div className="relative mb-2">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                                <input
                                  type="text"
                                  placeholder={`Search ${field.label.toLowerCase()}...`}
                                  value={search}
                                  onChange={e => setWidgetFilterSearch(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full h-8 pl-8 pr-2 bg-ink-50 rounded-lg text-[0.6875rem] text-ink-800 placeholder:text-ink-400 outline-none focus:bg-white focus:ring-1 focus:ring-brand-200 transition-all"
                                />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (allSelected) setWidgetFilterSelections(prev => ({ ...prev, [field.id]: selected.filter(s => !filtered.includes(s)) }));
                                  else setWidgetFilterSelections(prev => ({ ...prev, [field.id]: [...new Set([...selected, ...filtered])] }));
                                }}
                                className="w-full flex items-center gap-2 py-1.5 cursor-pointer text-left"
                              >
                                <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${allSelected ? 'border-brand-600 bg-brand-600' : 'border-ink-300'}`}>
                                  {allSelected && <svg viewBox="0 0 12 12" fill="none" className="size-2"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                                <span className="text-[0.6875rem] font-semibold text-ink-800">Select All</span>
                              </button>
                              {filtered.map(val => (
                                <button
                                  key={val}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWidgetFilterSelections(prev => {
                                      const cur = prev[field.id] || [];
                                      return { ...prev, [field.id]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
                                    });
                                  }}
                                  className="w-full flex items-center gap-2 py-1.5 cursor-pointer text-left"
                                >
                                  <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${selected.includes(val) ? 'border-brand-600 bg-brand-600' : 'border-ink-300'}`}>
                                    {selected.includes(val) && <svg viewBox="0 0 12 12" fill="none" className="size-2"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                  </div>
                                  <span className={`text-[0.6875rem] ${selected.includes(val) ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>{val}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Cross-Data Filters section */}
                    {dataLinksFromParent && dataLinksFromParent.length > 0 && (() => {
                      const widgetLabels = (widgetFields || []).map(id => DRAG_FIELDS.find(f => f.id === id)?.label).filter(Boolean);
                      const relevant = dataLinksFromParent.filter(l => widgetLabels.includes(l.fieldA) || widgetLabels.includes(l.fieldB));
                      if (relevant.length === 0) return null;
                      return (<><div className="border-t border-canvas-border/30 px-3.5 py-2 bg-surface-2/40">
                            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-400">Cross-Data Filters</span>
                          </div>{relevant.map(link => {
                        const linkLabel = `${link.fieldA} ↔ ${link.fieldB}`;
                        const isActive = widgetFilterSelections[`xlink-${link.id}`]?.length > 0;
                        const isOpen = widgetFilterOpen[`xlink-${link.id}`] ?? false;
                        const sA = FILE_SOURCES.find(s => s.id === link.sourceA);
                        const sB = FILE_SOURCES.find(s => s.id === link.sourceB);
                        // Values come from whichever side matches this widget
                        const matchesSideA = widgetLabels.includes(link.fieldA);
                        const sampleValues = matchesSideA
                          ? getFilterValues(DRAG_FIELDS.find(f => f.label === link.fieldA)?.id || '')
                          : getFilterValues(DRAG_FIELDS.find(f => f.label === link.fieldB)?.id || '');
                        const selected = widgetFilterSelections[`xlink-${link.id}`] || [];
                        const search = widgetFilterSearch[`xlink-${link.id}`] || '';
                        const filtered = sampleValues.filter(v => v.toLowerCase().includes(search.toLowerCase()));
                        const allSelected = filtered.length > 0 && filtered.every(v => selected.includes(v));
                        return (
                          <div key={link.id} className="border-b border-canvas-border/30 last:border-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); setWidgetFilterOpen(prev => ({ ...prev, [`xlink-${link.id}`]: !isOpen })); }}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-evidence-50/40 transition-colors cursor-pointer"
                            >
                              <span className={`text-[0.6875rem] font-bold uppercase tracking-wide truncate ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>
                                {link.fieldA === link.fieldB ? link.fieldA : `${link.fieldA} · ${link.fieldB}`}
                              </span>
                              <ChevronDown size={14} className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                              <div className="px-3.5 pb-3">
                                <div className="flex items-center gap-1.5 mb-2 text-[0.5625rem] text-ink-400">
                                  <span>{sA?.name?.split('.')[0]}</span>
                                  <Link2 size={7} />
                                  <span>{sB?.name?.split('.')[0]}</span>
                                </div>
                                <div className="relative mb-2">
                                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                                  <input
                                    type="text"
                                    placeholder={`Search...`}
                                    value={search}
                                    onChange={e => setWidgetFilterSearch(prev => ({ ...prev, [`xlink-${link.id}`]: e.target.value }))}
                                    onClick={e => e.stopPropagation()}
                                    className="w-full h-8 pl-8 pr-2 bg-ink-50 rounded-lg text-[0.6875rem] text-ink-800 placeholder:text-ink-400 outline-none focus:bg-white focus:ring-1 focus:ring-evidence-200 transition-all"
                                  />
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (allSelected) setWidgetFilterSelections(prev => ({ ...prev, [`xlink-${link.id}`]: selected.filter(s => !filtered.includes(s)) }));
                                    else setWidgetFilterSelections(prev => ({ ...prev, [`xlink-${link.id}`]: [...new Set([...selected, ...filtered])] }));
                                  }}
                                  className="w-full flex items-center gap-2 py-1.5 cursor-pointer text-left"
                                >
                                  <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${allSelected ? 'border-evidence bg-evidence' : 'border-ink-300'}`}>
                                    {allSelected && <svg viewBox="0 0 12 12" fill="none" className="size-2"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                  </div>
                                  <span className="text-[0.6875rem] font-semibold text-ink-800">Select All</span>
                                </button>
                                {filtered.map(val => (
                                  <button
                                    key={val}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setWidgetFilterSelections(prev => {
                                        const cur = prev[`xlink-${link.id}`] || [];
                                        return { ...prev, [`xlink-${link.id}`]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
                                      });
                                    }}
                                    className="w-full flex items-center gap-2 py-1.5 cursor-pointer text-left"
                                  >
                                    <div className={`size-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${selected.includes(val) ? 'border-evidence bg-evidence' : 'border-ink-300'}`}>
                                      {selected.includes(val) && <svg viewBox="0 0 12 12" fill="none" className="size-2"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                    <span className={`text-[0.6875rem] ${selected.includes(val) ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>{val}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}</>);
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3-dot menu */}
          <div className="relative">
            <ToolbarBtn
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              active={showMenu}
              tip="More options"
            >
              <MoreVertical size={13} />
            </ToolbarBtn>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <div className="absolute top-full right-0 z-40 mt-1 w-[160px] bg-canvas-elevated border border-canvas-border rounded-lg shadow-xl py-1">
                  {onEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[0.75rem] text-ink-700 hover:bg-brand-50 hover:text-brand-600 transition-colors text-left cursor-pointer"
                    >
                      <Settings size={13} />
                      Edit Widget
                    </button>
                  )}
                  {onChangeSize && (
                    <>
                      <div className="my-1 mx-3 border-t border-canvas-border/40" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onChangeSize(1); }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[0.75rem] transition-colors text-left cursor-pointer ${colSpan === 1 ? 'text-brand-600 bg-brand-50 font-semibold' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-600'}`}
                      >
                        <Columns size={13} />
                        Half Width
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onChangeSize(2); }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[0.75rem] transition-colors text-left cursor-pointer ${colSpan === 2 ? 'text-brand-600 bg-brand-50 font-semibold' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-600'}`}
                      >
                        <Maximize2 size={13} />
                        Full Width
                      </button>
                    </>
                  )}
                  {onDelete && (
                    <>
                      <div className="my-1 mx-3 border-t border-canvas-border/40" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[0.75rem] text-ink-700 hover:bg-red-50 hover:text-red-600 transition-colors text-left cursor-pointer"
                      >
                        <Trash2 size={13} />
                        Delete Widget
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Applied filter chips on widget — max 3 visible, then +N */}
      {activeFilterCount > 0 && (() => {
        const allChips: { fieldId: string; fieldLabel: string; val: string }[] = [];
        Object.entries(widgetFilterSelections).forEach(([fieldId, values]) => {
          if (values.length === 0) return;
          const fieldLabel = DRAG_FIELDS.find(f => f.id === fieldId)?.label || fieldId;
          values.forEach(val => allChips.push({ fieldId, fieldLabel, val }));
        });
        const visible = allChips.slice(0, 3);
        const remaining = allChips.length - 3;
        return (
          <div className="flex items-center gap-1.5 px-6 pb-2">
            <Filter size={10} className="text-brand-500 shrink-0" />
            {visible.map(chip => (
              <span key={`${chip.fieldId}-${chip.val}`} className="inline-flex items-center gap-1 bg-brand-50 border border-brand-200 text-brand-700 text-[0.625rem] font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                {chip.fieldLabel}: {chip.val}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWidgetFilterSelections(prev => ({
                      ...prev,
                      [chip.fieldId]: prev[chip.fieldId].filter(v => v !== chip.val),
                    }));
                  }}
                  className="hover:text-brand-900 cursor-pointer"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
            {remaining > 0 && (
              <span className="inline-flex items-center bg-brand-100 border border-brand-200 text-brand-700 text-[0.625rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                +{remaining} more
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setWidgetFilterSelections({}); }}
              className="text-[0.625rem] font-medium text-brand-500 hover:text-brand-700 cursor-pointer shrink-0"
            >
              Clear
            </button>
          </div>
        );
      })()}

      {/* Chart content */}
      <div className="relative flex-1 overflow-hidden" style={{ minHeight: 200 }}>
        {loading && isFirstLoad ? (
          <ChartSkeleton type={chartType} />
        ) : (
          <>
            {loading && <WidgetRefreshOverlay />}
            {children}
          </>
        )}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="relative bg-canvas-elevated rounded-2xl border border-canvas-border shadow-2xl w-[360px] p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <h3 className="text-[1rem] font-bold text-ink-900">Delete Widget</h3>
              </div>
              <p className="text-[0.8125rem] text-ink-500 mb-5">Are you sure you want to delete <strong>"{localTitle}"</strong>? This action cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-5 py-2.5 text-[0.8125rem] font-semibold text-ink-600 hover:text-ink-800 border border-canvas-border rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); onDelete?.(); }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-[0.8125rem] font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resize handle — bottom right corner */}
      {onChangeSize && (
        <button
          onClick={() => onChangeSize(colSpan === 1 ? 2 : 1)}
          className={`absolute bottom-2 right-2 p-1 rounded transition-all cursor-pointer ${
            hovered ? 'opacity-60 hover:opacity-100 hover:bg-brand-50 text-ink-400 hover:text-brand-600' : 'opacity-0'
          }`}
          title={colSpan === 1 ? 'Expand to full width' : 'Shrink to half width'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 1h3v3" /><path d="M4 13H1v-3" /><path d="M13 1L8 6" /><path d="M1 13l5-5" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ title, segments, centerLabel, onExpand }: { title: string; segments: DonutSegment[]; centerLabel?: string; onExpand?: () => void }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  let offset = 0;
  const arcs = segments.map(s => {
    const pct = (s.value / total) * 100;
    const dashArray = `${pct * 2.51327} ${251.327 - pct * 2.51327}`;
    const dashOffset = -offset * 2.51327;
    offset += pct;
    return { ...s, pct, dashArray, dashOffset };
  });

  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-150 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <button onClick={onExpand} className="p-1.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
          <Maximize2 size={12} className="text-text-muted hover:text-text-secondary" />
        </button>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <svg width="110" height="110" viewBox="0 0 100 100">
            {arcs.map(s => (
              <motion.circle
                key={s.label}
                cx="50" cy="50" r="40"
                fill="none"
                stroke={s.color}
                strokeWidth="10"
                strokeDasharray={s.dashArray}
                strokeDashoffset={s.dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              />
            ))}
            {centerLabel && (
              <>
                <text x="50" y="48" textAnchor="middle" className="fill-text font-bold" fontSize="16">{centerLabel}</text>
                <text x="50" y="62" textAnchor="middle" className="fill-text-muted" fontSize="9">Total</text>
              </>
            )}
          </svg>
        </div>
        <div className="space-y-2 flex-1 min-w-0">
          {segments.map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[0.75rem] text-text-secondary truncate">{s.label}</span>
              </div>
              <span className="text-[0.75rem] font-semibold text-text shrink-0 ml-2">
                {total > 100 ? s.value : `${s.value}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function BarChart({ title, data, color, onExpand }: { title: string; data: BarDatum[]; color: string; onExpand?: () => void }) {
  const max = Math.max(...data.map(d => d.value));

  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-150 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <button onClick={onExpand} className="p-1.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
          <Maximize2 size={12} className="text-text-muted hover:text-text-secondary" />
        </button>
      </div>
      <div className="flex items-end gap-2 h-36">
        {data.map((d, i) => {
          const height = (d.value / max) * 100;
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[0.75rem] text-text-muted font-medium">
                {typeof d.value === 'number' && d.value >= 1000
                  ? `${(d.value / 1000).toFixed(1)}K`
                  : d.value}
              </span>
              <motion.div
                className="w-full rounded-t-md min-h-[4px]"
                style={{ background: color }}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
              />
              <span className="text-[0.75rem] text-text-muted">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Progress Bars ───────────────────────────────────────────────────────────

function ProgressChart({ title, data, onExpand }: { title: string; data: ProgressDatum[]; onExpand?: () => void }) {
  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-150 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <button onClick={onExpand} className="p-1.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer">
          <Maximize2 size={12} className="text-text-muted hover:text-text-secondary" />
        </button>
      </div>
      <div className="space-y-3">
        {data.map((d, i) => (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.75rem] text-text-secondary">{d.label}</span>
              <span className="text-[0.75rem] font-semibold text-text">{d.value}%</span>
            </div>
            <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${d.value}%` }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
                className="h-full rounded-full"
                style={{ background: d.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mini Table ──────────────────────────────────────────────────────────────

function MiniTable({ title, headers, rows }: { title: string; headers: string[]; rows: TableRow[] }) {
  return (
    <div className="glass-card rounded-xl p-5 transition-all duration-150 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <button className="text-[0.75rem] text-primary font-medium hover:underline cursor-pointer">View all</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              {headers.map(h => (
                <th key={h} className="text-[0.75rem] text-text-muted font-medium pb-2 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className="border-b border-border/50 last:border-0 hover:bg-primary-xlight/50 transition-colors cursor-pointer"
              >
                {row.cells.map((cell, j) => (
                  <td key={j} className={`text-[0.75rem] py-2.5 pr-4 ${j === 0 ? 'font-medium text-text' : 'text-text-secondary'}`}>
                    {cell}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ dashboards, activeId, onSelect }: {
  dashboards: DashboardDef[];
  activeId: DashboardId;
  onSelect: (id: DashboardId) => void;
}) {
  return (
    <div className="w-[200px] shrink-0 border-r border-border bg-surface-1/50 overflow-y-auto flex flex-col">
      <div className="px-4 pt-5 pb-3">
        <div className="text-[0.75rem] text-text-muted font-semibold">Dashboards</div>
      </div>
      <nav className="flex-1 px-2 pb-4 space-y-1">
        {dashboards.map(d => {
          const isActive = d.id === activeId;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[0.8125rem] font-medium active:scale-[0.97] transition-all duration-200 cursor-pointer
                ${isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text'
                }
              `}
            >
              <d.icon size={15} className={isActive ? 'text-primary' : 'text-text-muted'} />
              <span className="truncate">{d.name}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface DashboardProps {
  initialDashboardId?: string | null;
  initialDashboardName?: string | null;
  initialCustomFields?: string[] | null;
  /** Source the dashboard was created with (DB connection, file, etc.). Drives
   * the live-SQL chip in the header, refresh visibility, and the Add Widget
   * data source panel. Undefined for seed dashboards from the static catalog. */
  initialDataSource?: { type: 'excel' | 'csv' | 'sql' | 'query' | 'combo'; sourceId?: string; sourceName?: string };
  /** All source names attached to this dashboard. Combo dashboards have many;
   *  single-source dashboards have one. The Add Data modal renders this list
   *  so users can pick a primary or attach more. */
  initialDataSourceNames?: string[];
  savedWidgets?: Array<{ chartType: string; title: string; xField: string; yField: string; color?: string; fontFamily?: string; seriesColors?: Record<string, string> }>;
  onSaveWidgets?: (widgets: Array<{ chartType: string; title: string; xField: string; yField: string; color?: string; fontFamily?: string; seriesColors?: Record<string, string> }>) => void;
  /** Persist any change to the dashboard's source binding (attach a new
   *  source, swap primary, change DB) back into App state. */
  onUpdateDashboardSource?: (patch: { dataSource?: 'excel' | 'csv' | 'sql' | 'query' | 'combo'; sourceId?: string; dataSourceNames?: string[] }) => void;
  /** Navigate to Knowledge Hub, optionally focused on the given source. Wired
   *  by the header chip click and the Add Widget empty state. */
  onOpenKnowledgeHub?: (sourceId?: string) => void;
  onBack?: () => void;
  onImportPowerBI?: () => void;
  onShare?: () => void;
}

// Source binding for seed (catalog) dashboards. Used when `initialDataSource`
// is not supplied (i.e. the user clicked a built-in dashboard rather than
// creating their own). Carries `sourceId`/`sourceName` for live-SQL seeds so
// the header chip + AddCardModal DB tree light up automatically without the
// user having to attach a connection.
type SeedSourceBinding = {
  type: 'excel' | 'csv' | 'sql' | 'query' | 'combo';
  sourceId?: string;
  sourceName?: string;
};
const SEED_DASHBOARD_SOURCE: Record<'p2p' | 'o2c' | 's2c' | 'grc' | 'excel' | 'sql', SeedSourceBinding> = {
  p2p:   { type: 'excel' },
  o2c:   { type: 'query' },
  s2c:   { type: 'combo' },
  grc:   { type: 'sql' },
  excel: { type: 'excel' },
  // Sample SQL dashboard — pre-bound to the Vendor Master Postgres connection
  // so the demo doesn't require the user to attach anything.
  sql:   { type: 'sql', sourceId: 'db-02', sourceName: 'Vendor Master' },
};

// ─── Connect Tables Modal ────────────────────────────────────────────────────
// Uses the real DRAG_FIELDS from this dashboard, split into the two actual
// uploaded file sources that the user connected during dashboard creation.

interface FieldLink {
  id: string;
  sourceA: string;
  fieldA: string;
  sourceB: string;
  fieldB: string;
}

// Real uploaded file sources — derived from the DRAG_FIELDS already in this dashboard
const FILE_SOURCES = [
  {
    id: 'invoice-master',
    name: 'Invoice_Master.xlsx',
    fields: DRAG_FIELDS.filter(f => f.kind === 'dimension').map(f => f.label),
  },
  {
    id: 'vendor-finance',
    name: 'Vendor_Finance.xlsx',
    fields: DRAG_FIELDS.filter(f => f.kind === 'measure').map(f => f.label),
  },
  {
    id: 'audit-controls',
    name: 'Audit_Controls.csv',
    fields: ['Control ID', 'Department', 'Owner', 'Risk Rating', 'Test Status', 'Last Tested', 'Region'],
  },
  {
    id: 'payment-ledger',
    name: 'Payment_Ledger.xlsx',
    fields: ['Payment ID', 'Invoice ID', 'Vendor Name', 'Date', 'Amount', 'Method', 'Status'],
  },
  {
    id: 'po-register',
    name: 'PO_Register.csv',
    fields: ['PO Number', 'Vendor Name', 'Date', 'Amount', 'Department', 'Category', 'Approval Status'],
  },
  {
    id: 'gl-journal',
    name: 'GL_Journal_Entries.xlsx',
    fields: ['Entry ID', 'Date', 'Account', 'Debit', 'Credit', 'Department', 'Description'],
  },
  {
    id: 'employee-master',
    name: 'Employee_Master.csv',
    fields: ['Employee ID', 'Name', 'Department', 'Role', 'Region', 'Manager', 'Status'],
  },
];


export default function DashboardView({ initialDashboardId, initialDashboardName, initialCustomFields, initialDataSource, initialDataSourceNames, savedWidgets = [], onSaveWidgets, onUpdateDashboardSource, onOpenKnowledgeHub, onBack, onImportPowerBI }: DashboardProps = {}) {
  const { addToast } = useToast();
  const { openShare } = useShare();
  const { can } = useCan();
  const [loading, setLoading] = useState(true);
  const isCustomInitial = !!initialDashboardId && !DASHBOARDS.some(d => d.id === initialDashboardId);
  const [activeId, setActiveId] = useState<DashboardId>(
    !isCustomInitial && (initialDashboardId as DashboardId) && DASHBOARDS.some(d => d.id === initialDashboardId)
      ? (initialDashboardId as DashboardId)
      : 'p2p'
  );

  // Source binding is stateful inside the view so attach/set-primary actions
  // reflect immediately. We also bubble each change up via
  // `onUpdateDashboardSource` so App state persists across navigation.
  // Custom dashboards carry it in `initialDataSource`; seed dashboards are
  // looked up from SEED_DASHBOARD_SOURCE.
  const seedKey: keyof typeof SEED_DASHBOARD_SOURCE =
    !isCustomInitial && initialDashboardId && (initialDashboardId in SEED_DASHBOARD_SOURCE)
      ? (initialDashboardId as keyof typeof SEED_DASHBOARD_SOURCE)
      : 'p2p';
  const seedBinding = SEED_DASHBOARD_SOURCE[seedKey];
  const [dashboardSourceType, setDashboardSourceType] = useState<'excel' | 'csv' | 'sql' | 'query' | 'combo' | undefined>(
    initialDataSource?.type ?? seedBinding.type,
  );
  const [dashboardSourceId, setDashboardSourceId] = useState<string | undefined>(
    initialDataSource?.sourceId ?? seedBinding.sourceId,
  );
  const [dashboardSourceName, setDashboardSourceName] = useState<string | undefined>(
    initialDataSource?.sourceName ?? seedBinding.sourceName,
  );
  const [dataSourceNames, setDataSourceNames] = useState<string[]>(
    initialDataSourceNames
      ?? (initialDataSource?.sourceName ? [initialDataSource.sourceName] : (seedBinding.sourceName ? [seedBinding.sourceName] : [])),
  );

  // Action bar state
  const [lastRefreshTime, setLastRefreshTime] = useState('2 mins ago');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshFrequency, setAutoRefreshFrequency] = useState('Off');
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [widgetLoadingStates, setWidgetLoadingStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const dashboardContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<{ title: string; subtitle?: string } | null>(null);
  const [kpiOverrides, setKpiOverrides] = useState<Record<number, { title: string; field: string }>>({});
  const [editingKpiIdx, setEditingKpiIdx] = useState<number | null>(null);
  const [openEditSidebarOnExpand, setOpenEditSidebarOnExpand] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageFilterFields, setPageFilterFields] = useState<string[]>([]);
  const [addWidgetOpen, setAddWidgetOpen] = useState(!!initialCustomFields?.length);
  const [addDataOpen, setAddDataOpen] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 14;
  const [expandCustomize, setExpandCustomize] = useState({
    fontFamily: 'Inter', bold: false, italic: false, underline: false,
    xAxisTitle: '', yAxisTitle: '', yMin: '', yMax: '', invertRange: false,
  });
  const [expandXField, setExpandXField] = useState('Month');
  const [expandYField, setExpandYField] = useState('Duplicate Count');
  const [expandLegendField, setExpandLegendField] = useState('');
  const handleExpandCustomizeChange = (key: string, value: any) => {
    setExpandCustomize(prev => ({ ...prev, [key]: value }));
  };

  // Pre-fill customize state when expanding a widget
  useEffect(() => {
    if (!expandedWidget) return;
    const t = expandedWidget.title.toLowerCase();
    let xLabel = 'Month';
    let yLabel = 'Duplicate Count';
    if (t.includes('accuracy') || t.includes('detection') || t.includes('goals')) {
      xLabel = 'Month'; yLabel = 'Duplicate Count';
    } else if (t.includes('volume') && t.includes('trend')) {
      xLabel = 'Month'; yLabel = 'Duplicate Count';
    } else if (t.includes('volume') || t.includes('monthly')) {
      xLabel = 'Month'; yLabel = 'Count';
    } else if (t.includes('status') || t.includes('distribution') || t.includes('pie')) {
      xLabel = 'Status'; yLabel = 'Duplicate Count';
    }
    setExpandCustomize({
      fontFamily: 'Inter', bold: false, italic: false, underline: false,
      xAxisTitle: xLabel, yAxisTitle: yLabel, yMin: '', yMax: '', invertRange: false,
    });
    setExpandXField(xLabel);
    setExpandYField(yLabel);
    setExpandLegendField('');
  }, [expandedWidget]);
  const [editingWidget, setEditingWidget] = useState<{ index: number; data: { chartType: string; title: string; xField: string; yField: string; color?: string; fontFamily?: string; seriesColors?: Record<string, string>; model?: WidgetModelConfig } } | null>(null);
  const [customFields] = useState<string[] | null>(initialCustomFields || null);
  const [userWidgets, setUserWidgets] = useState<Array<{ chartType: string; title: string; xField: string; yField: string; color?: string; fontFamily?: string; seriesColors?: Record<string, string>; model?: WidgetModelConfig }>>(savedWidgets);
  // Data-model relationships (table joins). Combined widgets are built directly
  // in the Add Widget modal (no separate builder).
  const [relationships, setRelationships] = useState<Relationship[]>(DEFAULT_RELATIONSHIPS);
  const isCustomDashboard = isCustomInitial;
  const [editingDashName, setEditingDashName] = useState(false);
  const [dashName, setDashName] = useState(isCustomDashboard ? (initialDashboardName || 'Custom Dashboard') : (initialDashboardName || ''));
  const [widgetSizes, setWidgetSizes] = useState<Record<number, 1 | 2>>({});
  const [connectTablesOpen, setConnectTablesOpen] = useState(false);
  const [dataLinks] = useState<FieldLink[]>([]);
  // Global page slicers: pageFilterFields holds `table::column` ids; selected
  // values per field live in pageFilterValues (empty ⇒ all, i.e. inactive).
  const [pageFilterValues, setPageFilterValues] = useState<Record<string, (string | number)[]>>({});
  // Cross-filter from clicking a chart element. `source` is the originating
  // widget index — it keeps its full axis (highlighted) while others filter.
  const [crossFilter, setCrossFilter] = useState<{ table: string; column: string; value: string; source: number } | null>(null);

  // ── Global filter context (page slicers + chart-click cross-filter) ──
  const splitFieldId = (id: string) => { const [table, column] = id.split('::'); return { table, column }; };
  const modelFieldLabel = (id: string) => { const { table, column } = splitFieldId(id); return colByName(tableById(MODEL_TABLES, table), column)?.label ?? column; };
  const pageModelFilters: ModelFilter[] = pageFilterFields
    .map(id => { const { table, column } = splitFieldId(id); return { table, column, values: pageFilterValues[id] ?? [] }; })
    .filter(f => f.values.length > 0);
  const crossModelFilter: ModelFilter | null = crossFilter
    ? { table: crossFilter.table, column: crossFilter.column, values: [crossFilter.value] }
    : null;
  // Filters applied to widget `index`. The cross-filter SOURCE keeps its own
  // data (every category stays clickable, the selection is highlighted) — only
  // page slicers apply to it; every other widget also gets the cross-filter.
  const filtersForWidget = (index: number): ModelFilter[] => {
    const out = [...pageModelFilters];
    if (crossModelFilter && crossFilter && crossFilter.source !== index) out.push(crossModelFilter);
    return out;
  };
  const highlightForWidget = (index: number): string | null =>
    crossFilter && crossFilter.source === index ? crossFilter.value : null;
  // Click on a model widget element → set/toggle the cross-filter on the
  // widget's first dimension (multi-dim labels 'A · B' map to the first dim).
  const handleWidgetSelect = (index: number, model: WidgetModelConfig | undefined, label: string) => {
    const dim = model?.fields.find(f => f.role === 'dimension');
    if (!dim) return;
    const value = label.split(' · ')[0];
    setCrossFilter(prev =>
      prev && prev.source === index && prev.value === value && prev.column === dim.column
        ? null
        : { table: dim.table, column: dim.column, value, source: index });
  };
  const clearAllFilters = () => { setPageFilterFields([]); setPageFilterValues({}); setCrossFilter(null); };
  const totalActiveFilterCount = pageModelFilters.length + (crossFilter ? 1 : 0);

  const handleEditDefaultWidget = (widgetTitle: string, _chartType: string, subtitle?: string) => {
    setOpenEditSidebarOnExpand(true);
    setExpandedWidget({ title: widgetTitle, subtitle });
  };

  const handleRefresh = () => {
    // Guard against overlap — if a refresh is already mid-flight (manual or
    // auto-refresh-driven), skip this call. Without this, rapid clicks or an
    // auto-refresh tick landing during a manual refresh produce overlapping
    // setTimeout chains and visual thrash.
    if (isRefreshing) return;
    setIsRefreshing(true);
    // Set all widgets to loading. Includes both the per-dashboard seed widgets
    // (w1..w4 + table) and any user-added widgets, keyed by index.
    const seedKeys = ['w1', 'w2', 'w3', 'w4', 'table'];
    const userKeys = userWidgets.map((_, i) => `user-${i}`);
    const widgetKeys = [...seedKeys, ...userKeys];
    const loading: Record<string, 'loading' | 'loaded' | 'error'> = {};
    widgetKeys.forEach(k => { loading[k] = 'loading'; });
    setWidgetLoadingStates(loading);

    // Stagger each widget's resolution at random intervals
    widgetKeys.forEach(k => {
      const delay = 800 + Math.random() * 2000;
      setTimeout(() => {
        setWidgetLoadingStates(prev => ({ ...prev, [k]: 'loaded' }));
      }, delay);
    });

    // All done after max time
    setTimeout(() => {
      setIsRefreshing(false);
      setHasLoadedOnce(true);
      setLastRefreshTime('Just now');
      addToast({ message: 'Dashboard refreshed', type: 'success' });
      setTimeout(() => setLastRefreshTime('1 min ago'), 60000);
    }, 3000);
  };

  // Keep refs to the latest handleRefresh and isRefreshing so the auto-refresh
  // interval can call without re-arming on every render, and skip ticks that
  // would overlap with an in-flight manual refresh.
  const handleRefreshRef = useRef(handleRefresh);
  handleRefreshRef.current = handleRefresh;
  const isRefreshingRef = useRef(isRefreshing);
  isRefreshingRef.current = isRefreshing;

  // Auto-refresh interval. Demo intervals are compressed (Daily=60s) so the
  // behavior is observable in a session; real intervals would be 86_400_000
  // (Daily) etc. Off = no interval. Ticks that land during an in-flight
  // refresh are silently skipped — the next tick catches up.
  useEffect(() => {
    const intervalMs: Record<string, number | null> = {
      Off: null,
      Daily: 60_000,
      Weekly: 300_000,
      Biweekly: 600_000,
      Monthly: 1_200_000,
      Quarterly: 1_800_000,
      'Semi-Annually': 2_700_000,
      Annually: 3_600_000,
    };
    const ms = intervalMs[autoRefreshFrequency];
    if (!ms) return;
    const handle = setInterval(() => {
      if (isRefreshingRef.current) return;
      handleRefreshRef.current();
    }, ms);
    return () => clearInterval(handle);
  }, [autoRefreshFrequency]);

  const handleExport = () => {
    if (isExporting) return;
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      addToast({ message: 'Exported as PDF', type: 'success' });
    }, 2000);
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = useCallback((id: DashboardId) => {
    setActiveId(id);
  }, []);

  if (loading) return <DashboardSkeleton />;

  const dashboard = DASHBOARDS.find(d => d.id === activeId) || DASHBOARDS[0];
  // True only for the canonical Excel sample dashboard. Drives Excel-specific
  // UX (Summary tab in expanded widget, alerts panel hide, hasAlert flag).
  // Distinct from `isStaticFileDashboard`, which captures excel + csv for
  // refresh-visibility purposes.
  const isExcelDashboard = activeId === 'excel';
  const isStaticFileDashboard = dashboardSourceType === 'excel' || dashboardSourceType === 'csv';
  const isLiveSqlDashboard = dashboardSourceType === 'sql' && !!dashboardSourceId;
  const sqlIntegration = isLiveSqlDashboard ? INTEGRATION_CONFIGS[dashboardSourceId!] : undefined;

  // dataSourceInfo passed to every WidgetCard so each tile (and the expand
  // modal) shows the right badge — SQL badge for live-SQL dashboards, Query
  // for query dashboards, default Excel badge otherwise.
  const widgetDataSourceInfo: { type: 'sql' | 'excel' | 'csv' | 'query'; name: string; meta: string } | undefined =
    dashboardSourceType === 'sql' || dashboardSourceType === 'csv' || dashboardSourceType === 'query'
      ? {
          type: dashboardSourceType,
          name: dashboardSourceName ?? '',
          meta: sqlIntegration?.provider ?? '',
        }
      : undefined;
  const displayName = dashName || dashboard.name;
  const displaySubtitle = isCustomDashboard ? 'Custom dashboard' : dashboard.subtitle;

  return (
    <div ref={dashboardContainerRef} className="h-full flex bg-canvas relative overflow-hidden">
      <Orb hoverIntensity={0.09} rotateOnHover hue={dashboard.accentHue} opacity={0.08} />

      {/* Per-widget refresh — no full-page overlay */}

      {/* Sidebar removed — dashboard switching handled via list page */}

      {/* Main content — shrinks to the left when the docked Filters panel is open
          so widgets are never overlapped; the responsive grid reflows to fit. */}
      <div
        className="flex-1 overflow-y-auto relative transition-[margin] duration-300 ease-out"
        style={{ marginRight: filtersOpen ? FILTER_PANEL_WIDTH : 0 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={dashboard.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="p-8"
          >
            {/* Page header — Editorial: breadcrumb · serif title · context · actions */}
            <div className={isFullScreen ? 'mb-4' : 'mb-6'}>
              {!isFullScreen && (
                <div className="font-mono text-[0.75rem] text-ink-500 mb-2 flex items-center gap-1">
                  {onBack && (
                    <button onClick={onBack} className="inline-flex items-center gap-1 hover:text-brand-600 transition-colors cursor-pointer">
                      <ArrowLeft size={12} />
                      Dashboards
                    </button>
                  )}
                  {onBack && <span>·</span>}
                  {!onBack && <span>Dashboards · </span>}
                  {displayName}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  {editingDashName ? (
                    <input
                      autoFocus
                      value={dashName}
                      onChange={e => setDashName(e.target.value)}
                      onBlur={() => setEditingDashName(false)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditingDashName(false); }}
                      className={`font-display font-[420] text-ink-900 leading-[1.15] bg-transparent border-none ring-0 shadow-none w-full ${isFullScreen ? 'text-[1.375rem]' : 'text-[2.125rem]'}`}
                      style={{ outline: 'none', boxShadow: 'none' }}
                    />
                  ) : (
                    <h1
                      className={`font-display font-[420] text-ink-900 leading-[1.15] cursor-text hover:text-brand-800 transition-colors ${isFullScreen ? 'text-[1.375rem]' : 'text-[2.125rem]'}`}
                      onClick={() => setEditingDashName(true)}
                    >{displayName}</h1>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Header DB chip removed — per-widget badge surfaces the
                      bound DB name + provider on each card and inside the
                      expand modal instead. Less header clutter. */}

                  {/* Refreshed indicator — hidden for static file dashboards */}
                  {!isStaticFileDashboard && (
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    aria-busy={isRefreshing}
                    className={`flex items-center gap-1.5 px-4 h-9 border border-canvas-border bg-white rounded-full text-[0.75rem] text-ink-500 shadow-sm transition-colors ${
                      isRefreshing ? 'opacity-60 cursor-not-allowed' : 'hover:border-brand-200 cursor-pointer'
                    }`}
                    title={isRefreshing ? 'Refresh in progress…' : 'Click to refresh'}
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-brand-600' : ''} />
                    <span className="tabular-nums">{isRefreshing ? 'Refreshing…' : `Refreshed ${lastRefreshTime}`}</span>
                  </button>
                  )}

                  {/* Auto refresh with frequency dropdown — hidden for static file dashboards */}
                  {!isStaticFileDashboard && (
                  <div className="relative">
                    <button
                      onClick={() => setShowFrequencyDropdown(!showFrequencyDropdown)}
                      className={`flex items-center gap-1.5 px-4 h-9 rounded-full text-[0.75rem] font-medium transition-colors cursor-pointer border shadow-sm ${
                        autoRefreshFrequency !== 'Off'
                          ? 'border-brand-300 bg-brand-50 text-brand-700'
                          : 'border-canvas-border bg-white text-ink-500 hover:border-brand-200'
                      }`}
                    >
                      <Clock size={13} />
                      Auto refresh: {autoRefreshFrequency !== 'Off' ? 'On' : 'Off'}
                    </button>
                    {showFrequencyDropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFrequencyDropdown(false)} />
                        <div className="absolute top-full left-0 mt-2 w-48 bg-canvas-elevated border border-canvas-border rounded-lg shadow-xl py-1.5 z-50">
                          {['Off', 'Daily', 'Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Semi-Annually', 'Annually'].map(freq => (
                            <button
                              key={freq}
                              onClick={() => {
                                setAutoRefreshFrequency(freq);
                                setAutoRefresh(freq !== 'Off');
                                setShowFrequencyDropdown(false);
                                addToast({ message: freq === 'Off' ? 'Auto refresh disabled' : `Auto refresh set to ${freq}`, type: 'info' });
                              }}
                              className={`w-full flex items-center justify-between px-4 py-2 text-[0.8125rem] transition-colors cursor-pointer ${
                                autoRefreshFrequency === freq
                                  ? 'bg-brand-50 text-brand-700 font-medium'
                                  : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700'
                              }`}
                            >
                              {freq}
                              {autoRefreshFrequency === freq && (
                                <CheckCircle2 size={14} className="text-brand-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  )}

                  {/* Divider */}
                  <div className="w-px h-5 bg-canvas-border" />

                  {/* + Add Widget — primary CTA */}
                  <Gated permission="db_add" mode="disable" title="You don't have permission to add widgets">
                  <button
                    onClick={() => setAddWidgetOpen(true)}
                    className="flex items-center gap-1.5 px-5 h-9 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-full text-[0.75rem] font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Widget
                  </button>
                  </Gated>

                  {/* Connect Data Sources — manages the table relationships that
                      power combined (multi-table) widgets; available on every dashboard. */}
                  <button
                    onClick={() => setConnectTablesOpen(true)}
                    className={`relative flex items-center justify-center size-9 rounded-lg transition-colors cursor-pointer border ${
                      relationships.length > 0
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-canvas-border bg-canvas-elevated text-ink-500 hover:text-brand-600 hover:border-brand-200'
                    }`}
                    title="Connect Data Sources"
                  >
                    <Link2 size={15} />
                    {relationships.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-brand-600 text-white text-[0.625rem] font-bold rounded-full flex items-center justify-center px-1 tabular-nums">
                        {relationships.length}
                      </span>
                    )}
                  </button>

                  {/* Filter */}
                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className={`relative flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[0.75rem] font-medium transition-colors cursor-pointer border ${
                      totalActiveFilterCount > 0
                        ? 'border-brand-200 bg-brand-50 text-brand-700'
                        : 'border-canvas-border bg-canvas-elevated text-ink-500 hover:text-brand-600 hover:border-brand-200'
                    }`}
                    title="Filters"
                  >
                    <Filter size={15} />
                    {totalActiveFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-brand-600 text-white text-[0.625rem] font-bold rounded-full flex items-center justify-center px-1 tabular-nums">
                        {totalActiveFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Divider */}
                  <div className="w-px h-5 bg-canvas-border" />

                  {/* Download */}
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center justify-center size-9 border border-canvas-border bg-canvas-elevated rounded-lg text-ink-500 hover:text-brand-600 hover:border-brand-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    title="Export as PDF"
                  >
                    {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  </button>

                  {/* Share */}
                  {can('db_share') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openShare({ type: 'dashboard', id: activeId, anchor: rectFromEvent(e) }); }}
                    className="flex items-center gap-1.5 px-2.5 h-9 border border-canvas-border bg-canvas-elevated rounded-lg text-ink-500 hover:text-brand-600 hover:border-brand-200 transition-colors cursor-pointer text-[0.75rem] font-medium"
                    title="Share"
                  >
                    <Share2 size={15} />
                    <span className="hidden sm:inline">Share</span>
                  </button>
                  )}

                  {/* Fullscreen */}
                  <button
                    onClick={() => {
                      if (!document.fullscreenElement) {
                        dashboardContainerRef.current?.requestFullscreen().catch(() => {});
                      } else {
                        document.exitFullscreen().catch(() => {});
                      }
                    }}
                    className="flex items-center justify-center size-9 border border-canvas-border bg-canvas-elevated rounded-lg text-ink-500 hover:text-brand-600 hover:border-brand-200 transition-colors cursor-pointer"
                    title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* AI Summary — Generate / View / Edit */}
            {/* Alerts & Daily Digest */}
            {!isCustomDashboard && !isExcelDashboard && <AlertsPanel dashboardId={activeId} />}
            {isCustomDashboard && <EmptyAlertsPanel />}

            {/* KPI Cards */}
            {!isCustomDashboard && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
              >
                {dashboard.kpis.map((kpi, i) => {
                  const override = kpiOverrides[i];
                  const displayTitle = override?.title || kpi.title;
                  const isEditing = editingKpiIdx === i;
                  return (
                    <div
                      key={i}
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingKpiIdx(i); }}
                    >
                      <KpiTile
                        label={displayTitle}
                        value={String(kpi.value)}
                        index={i}
                        onClick={isEditing ? undefined : () => setExpandedWidget({ title: displayTitle, subtitle: 'KPI detail' })}
                        footer={!isEditing && override?.field ? (
                          <p className="text-[0.625rem] text-ink-400">Source: {override.field}</p>
                        ) : undefined}
                        editing={isEditing ? (
                          <div className="space-y-2" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={override?.title || kpi.title}
                              onChange={e => setKpiOverrides(prev => ({ ...prev, [i]: { ...prev[i], title: e.target.value, field: prev[i]?.field || '' } }))}
                              onKeyDown={e => { if (e.key === 'Enter') setEditingKpiIdx(null); if (e.key === 'Escape') setEditingKpiIdx(null); }}
                              className="w-full text-[0.6875rem] font-semibold text-ink-900 uppercase tracking-wide bg-transparent border-b border-brand-300 outline-none pb-0.5"
                              placeholder="KPI Title"
                            />
                            <select
                              value={override?.field || ''}
                              onChange={e => { setKpiOverrides(prev => ({ ...prev, [i]: { ...prev[i], title: prev[i]?.title || kpi.title, field: e.target.value } })); }}
                              className="w-full text-[0.6875rem] text-ink-700 bg-white border border-canvas-border rounded-md px-2 py-1.5 outline-none focus:border-brand-400 cursor-pointer"
                            >
                              <option value="">Select source column...</option>
                              {EXCEL_RAW_HEADERS.filter(h => h !== 'Row #').map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setEditingKpiIdx(null)}
                              className="w-full text-[0.6875rem] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-md py-1.5 transition-colors cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        ) : undefined}
                      />
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* Page-level filter strip — global slicers + active cross-filter */}
            {(pageModelFilters.length > 0 || crossFilter) && (
              <div className="flex items-center gap-2 flex-wrap px-5 py-3 mb-4 rounded-xl bg-brand-50/50 border border-brand-100">
                <Filter size={13} className="text-brand-600 shrink-0" />
                {pageFilterFields.filter(id => (pageFilterValues[id]?.length ?? 0) > 0).map(fId => {
                  const vals = pageFilterValues[fId] ?? [];
                  const summary = vals.length <= 2 ? vals.join(', ') : `${vals.length} selected`;
                  return (
                    <span key={fId} className="flex items-center gap-1.5 bg-brand-100 border border-brand-200 text-brand-800 text-[0.75rem] font-medium px-2.5 py-1 rounded-lg">
                      <span className="font-semibold">{modelFieldLabel(fId)}</span>
                      <span className="text-brand-600">·</span> {summary}
                      <button onClick={() => setPageFilterValues(prev => ({ ...prev, [fId]: [] }))} className="hover:text-brand-900 cursor-pointer"><X size={11} /></button>
                    </span>
                  );
                })}
                {crossFilter && (
                  <span className="flex items-center gap-1.5 bg-evidence-50 border border-evidence/30 text-evidence-700 text-[0.75rem] font-medium px-2.5 py-1 rounded-lg">
                    <Link2 size={11} />
                    <span className="font-semibold">{colByName(tableById(MODEL_TABLES, crossFilter.table), crossFilter.column)?.label ?? crossFilter.column}</span>
                    <span className="text-evidence/60">·</span> {crossFilter.value}
                    <button onClick={() => setCrossFilter(null)} className="hover:text-evidence-900 cursor-pointer"><X size={11} /></button>
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  className="text-[0.6875rem] font-medium text-brand-600 hover:text-brand-800 ml-auto cursor-pointer transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Empty state for custom dashboards with no widgets */}
            {isCustomDashboard && userWidgets.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="size-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
                  <BarChart3 size={24} className="text-brand-400" />
                </div>
                <h3 className="text-[0.9375rem] font-semibold text-ink-700 mb-1">No widgets yet</h3>
                <p className="text-[0.8125rem] text-ink-400 mb-5 max-w-xs">Add your first widget to start building this dashboard.</p>
                <Gated permission="db_add" mode="disable" title="You don't have permission to add widgets">
                <button
                  onClick={() => setAddWidgetOpen(true)}
                  className="flex items-center gap-1.5 px-5 h-10 bg-brand-600 hover:bg-brand-500 active:bg-brand-800 text-white rounded-lg text-[0.8125rem] font-semibold transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                  Add Widget
                </button>
                </Gated>
              </motion.div>
            )}

            {/* User-created widgets — render on any dashboard (custom or seeded)
                so combined/model widgets added via Add Widget actually appear. */}
            {userWidgets.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="grid gap-5 mb-6"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gridAutoRows: 'minmax(420px, auto)' }}
              >
                {userWidgets.map((w, i) => (
                  <WidgetCard
                    key={i}
                    title={w.title}
                    subtitle={w.yField && w.xField ? `${w.yField} by ${w.xField}` : 'Custom widget'}
                    addToast={addToast}
                    loading={widgetLoadingStates[`user-${i}`] === 'loading'}
                    isFirstLoad={!hasLoadedOnce}
                    dataSourceInfo={widgetDataSourceInfo}
                    colSpan={widgetSizes[i] || 1}
                    onChangeSize={(span) => setWidgetSizes(prev => ({ ...prev, [i]: span }))}
                    onMoveUp={i > 0 ? () => {
                      const next = [...userWidgets];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setUserWidgets(next);
                      onSaveWidgets?.(next);
                      // Swap sizes too
                      setWidgetSizes(prev => { const n = { ...prev }; const tmp = n[i]; n[i] = n[i-1]; n[i-1] = tmp; return n; });
                    } : undefined}
                    onMoveDown={i < userWidgets.length - 1 ? () => {
                      const next = [...userWidgets];
                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                      setUserWidgets(next);
                      onSaveWidgets?.(next);
                      setWidgetSizes(prev => { const n = { ...prev }; const tmp = n[i]; n[i] = n[i+1]; n[i+1] = tmp; return n; });
                    } : undefined}
                    onExpand={() => setExpandedWidget({ title: w.title, subtitle: w.yField ? `${w.yField} by ${w.xField}` : '' })}
                    onEdit={() => { setEditingWidget({ index: i, data: w }); setAddWidgetOpen(true); }}
                    onDelete={() => { const next = userWidgets.filter((_, j) => j !== i); setUserWidgets(next); onSaveWidgets?.(next); addToast({ message: 'Widget removed', type: 'info' }); }}
                    onFilter={() => addToast({ message: 'Widget filter opening.', type: 'info' })}
                    pageFilterFields={pageFilterFields}
                    widgetFields={[w.xField, w.yField].filter(Boolean)}
                    dataLinks={dataLinks}
                    onRemovePageFilter={(id) => setPageFilterFields(pageFilterFields.filter(f => f !== id))}
                    onClearPageFilters={() => setPageFilterFields([])}
                  >
                    {/* Render chart based on type */}
                    {(() => {
                      // Multi-table (model) widgets render real joined+aggregated data,
                      // filtered by global page slicers + chart-click cross-filter.
                      if (w.model) {
                        // stopPropagation so a chart-element click cross-filters
                        // instead of bubbling to the card's expand handler.
                        return <div className="h-full w-full p-3" onClick={(e) => e.stopPropagation()}><ModelChart data={buildWidgetRows(MODEL_TABLES, relationships, w.model, filtersForWidget(i))} type={w.chartType} color={w.color} onSelect={(label) => handleWidgetSelect(i, w.model, label)} highlight={highlightForWidget(i)} /></div>;
                      }
                      const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
                      const vals = [45, 62, 38, 71, 55, 84];
                      const max = Math.max(...vals);

                      if (w.chartType === 'pie') {
                        const segs = [{ l: 'Segment A', v: 40, c: 'var(--color-brand-500)' }, { l: 'Segment B', v: 30, c: 'var(--color-evidence)' }, { l: 'Segment C', v: 20, c: 'var(--color-mitigated)' }, { l: 'Segment D', v: 10, c: 'var(--color-compliant)' }];
                        const total = segs.reduce((a, s) => a + s.v, 0);
                        let off = 0;
                        return (
                          <div className="flex items-center gap-8 py-8">
                            <svg width="160" height="160" viewBox="0 0 100 100" className="shrink-0">
                              {segs.map(s => { const pct = (s.v / total) * 100; const da = `${pct * 2.51327} ${251.327 - pct * 2.51327}`; const doff = -off * 2.51327; off += pct; return <circle key={s.l} cx="50" cy="50" r="38" fill="none" stroke={s.c} strokeWidth="12" strokeDasharray={da} strokeDashoffset={doff} strokeLinecap="round" transform="rotate(-90 50 50)" />; })}
                              <text x="50" y="48" textAnchor="middle" className="fill-ink-900 font-bold" fontSize="15">{total}</text>
                              <text x="50" y="60" textAnchor="middle" className="fill-ink-500" fontSize="8">Total</text>
                            </svg>
                            <div className="space-y-2">
                              {segs.map(s => (<div key={s.l} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: s.c }} /><span className="text-[0.75rem] text-ink-700">{s.l}</span><span className="text-[0.8125rem] font-bold text-ink-900 ml-2">{s.v}%</span></div>))}
                            </div>
                          </div>
                        );
                      }

                      if (w.chartType === 'line' || w.chartType === 'area') {
                        const ww = 400, hh = 240;
                        const pts = vals.map((v, j) => `${40 + j * ((ww-80)/(vals.length-1))},${hh - 30 - (v / max) * (hh - 60)}`).join(' ');
                        return (
                          <div className="py-6 px-2">
                            <svg width="100%" height={hh} viewBox={`0 0 ${ww} ${hh}`} className="overflow-visible">
                              {w.chartType === 'area' && <><defs><linearGradient id={`ug${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.15" /><stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0.02" /></linearGradient></defs><polyline points={`40,${hh-30} ${pts} ${ww-10},${hh-30}`} fill={`url(#ug${i})`} /></>}
                              <polyline points={pts} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              {vals.map((v, j) => <circle key={j} cx={40 + j * ((ww-80)/(vals.length-1))} cy={hh - 30 - (v / max) * (hh - 60)} r="4" fill="var(--color-brand-600)" stroke="white" strokeWidth="2" />)}
                            </svg>
                            <div className="flex justify-between text-[0.6875rem] text-ink-500 mt-2 px-1">{labels.map(l => <span key={l}>{l}</span>)}</div>
                            {w.xField && <div className="text-center mt-2"><span className="text-[0.625rem] text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{w.xField}</span></div>}
                          </div>
                        );
                      }

                      if (w.chartType === 'kpi') {
                        return (
                          <div className="flex items-center justify-center gap-5 py-8">
                            <div className="bg-canvas-elevated border border-canvas-border rounded-xl p-6 min-w-[180px]">
                              <p className="text-[0.6875rem] text-ink-500 mb-1">{w.yField || 'Metric'}</p>
                              <p className="text-[2rem] font-bold text-ink-900">12,450</p>
                              <p className="text-[0.75rem] text-compliant font-semibold mt-1 flex items-center gap-1"><TrendingUp size={10} />+8.2%</p>
                            </div>
                          </div>
                        );
                      }

                      // Default: bar chart
                      return (
                        <div className="flex items-end gap-3 pt-6" style={{ height: '280px' }}>
                          {labels.map((l, j) => (
                            <div key={l} className="flex-1 flex flex-col items-center gap-1.5">
                              <span className="text-[0.75rem] text-ink-500 font-medium">{vals[j]}</span>
                              <motion.div className="w-full rounded-t-md min-h-[4px]" style={{ background: 'var(--color-brand-500)' }} initial={{ height: 0 }} animate={{ height: `${(vals[j] / max) * 100}%` }} transition={{ duration: 0.5, delay: j * 0.06 }} />
                              <span className="text-[0.75rem] text-ink-500">{l}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </WidgetCard>
                ))}
              </motion.div>
            )}

            {/* Default charts — only for predefined dashboards */}
            {!isCustomDashboard && (
            <>
            {/* Charts — 2×2 grid of big widget cards */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6"
              style={{ gridAutoRows: 'minmax(420px, auto)' }}
            >
              {/* Widget 1 — Combo Chart */}
              <WidgetCard
                title={dashboard.lineTrend?.title || 'Detection Accuracy Goals'}
                subtitle="Performance over time"
                dataSourceInfo={widgetDataSourceInfo}
                addToast={addToast}
                onExpand={() => setExpandedWidget({ title: dashboard.lineTrend?.title || 'Detection Accuracy Goals', subtitle: 'Performance over time' })}
                onEdit={() => handleEditDefaultWidget(dashboard.lineTrend?.title || 'Detection Accuracy Goals', 'line', 'Performance over time')}
                onDelete={() => addToast({ message: 'Widget deleted.', type: 'info' })}
                onFilter={() => addToast({ message: 'Widget filter opening.', type: 'info' })}
                pageFilterFields={pageFilterFields}
                widgetFields={['date', 'month', 'region', 'status']}
                dataLinks={dataLinks}
                onRemovePageFilter={(id) => setPageFilterFields(pageFilterFields.filter(f => f !== id))}
                onClearPageFilters={() => setPageFilterFields([])}
                loading={widgetLoadingStates['w1'] === 'loading'}
                isFirstLoad={!hasLoadedOnce}
                chartType="bar"
                hasAlert={!isExcelDashboard}
              >
                <div className="w-full h-full">
                  <ConfigurableChart type={"combo" as any} xAxis="Month" yAxis="Duplicate Count" />
                </div>
              </WidgetCard>

              {/* Widget 2 — Area Chart */}
              <WidgetCard
                title={dashboard.progress?.title || 'Invoice Volume Trend'}
                subtitle={dashboard.progress ? 'Sheet distribution' : 'Volume over time'}
                dataSourceInfo={widgetDataSourceInfo}
                addToast={addToast}
                onExpand={() => setExpandedWidget({ title: dashboard.progress?.title || 'Invoice Volume Trend', subtitle: dashboard.progress ? 'Sheet distribution' : 'Volume over time' })}
                onEdit={() => handleEditDefaultWidget(dashboard.progress?.title || 'Invoice Volume Trend', 'area', dashboard.progress ? 'Sheet distribution' : 'Volume over time')}
                onDelete={() => addToast({ message: 'Widget deleted.', type: 'info' })}
                onFilter={() => addToast({ message: 'Widget filter opening.', type: 'info' })}
                pageFilterFields={pageFilterFields}
                widgetFields={['date', 'month', 'vendor', 'region']}
                dataLinks={dataLinks}
                onRemovePageFilter={(id) => setPageFilterFields(pageFilterFields.filter(f => f !== id))}
                onClearPageFilters={() => setPageFilterFields([])}
                loading={widgetLoadingStates['w2'] === 'loading'}
                isFirstLoad={!hasLoadedOnce}
                chartType="line"
                hasAlert={!isExcelDashboard}
              >
                <div className="w-full h-full">
                  <ConfigurableChart type="area" xAxis="Month" yAxis="Duplicate Count" />
                </div>
              </WidgetCard>

              {/* Widget 3 — Bar Chart */}
              <WidgetCard
                title={dashboard.bars?.title || 'Monthly Invoice Volume'}
                subtitle="Trend analysis"
                dataSourceInfo={widgetDataSourceInfo}
                addToast={addToast}
                onExpand={() => setExpandedWidget({ title: dashboard.bars?.title || 'Monthly Invoice Volume', subtitle: 'Trend analysis' })}
                onEdit={() => handleEditDefaultWidget(dashboard.bars?.title || 'Monthly Invoice Volume', 'clustered-column', 'Trend analysis')}
                onDelete={() => addToast({ message: 'Widget deleted.', type: 'info' })}
                onFilter={() => addToast({ message: 'Widget filter opening.', type: 'info' })}
                pageFilterFields={pageFilterFields}
                widgetFields={['date', 'month', 'vendor', 'region']}
                dataLinks={dataLinks}
                onRemovePageFilter={(id) => setPageFilterFields(pageFilterFields.filter(f => f !== id))}
                onClearPageFilters={() => setPageFilterFields([])}
                loading={widgetLoadingStates['w3'] === 'loading'}
                isFirstLoad={!hasLoadedOnce}
                chartType="bar"
              >
                <div className="w-full h-full">
                  <ConfigurableChart type="bar" xAxis="Month" yAxis="Duplicate Count" showTarget={false} />
                </div>
              </WidgetCard>

              {/* Widget 4 — Pie Chart */}
              <WidgetCard
                title={dashboard.donut?.title || 'Invoice Status'}
                subtitle="Distribution breakdown"
                dataSourceInfo={widgetDataSourceInfo}
                addToast={addToast}
                onExpand={() => setExpandedWidget({ title: dashboard.donut?.title || 'Invoice Status', subtitle: 'Distribution breakdown' })}
                onEdit={() => handleEditDefaultWidget(dashboard.donut?.title || 'Invoice Status', 'pie', 'Distribution breakdown')}
                onDelete={() => addToast({ message: 'Widget deleted.', type: 'info' })}
                onFilter={() => addToast({ message: 'Widget filter opening.', type: 'info' })}
                pageFilterFields={pageFilterFields}
                widgetFields={['region', 'category', 'department', 'status']}
                dataLinks={dataLinks}
                onRemovePageFilter={(id) => setPageFilterFields(pageFilterFields.filter(f => f !== id))}
                onClearPageFilters={() => setPageFilterFields([])}
                loading={widgetLoadingStates['w4'] === 'loading'}
                isFirstLoad={!hasLoadedOnce}
                chartType="pie"
                hasAlert={!isExcelDashboard}
              >
                <div className="w-full h-full">
                  <ConfigurableChart type="pie" xAxis="Status" yAxis="Duplicate Count" />
                </div>
              </WidgetCard>
            </motion.div>

            {/* Table — wrapped in WidgetCard */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mb-5"
            >
              <WidgetCard
                title={dashboard.table.title}
                subtitle="Detailed records"
                dataSourceInfo={widgetDataSourceInfo}
                addToast={addToast}
                onExpand={() => setExpandedWidget({ title: dashboard.table.title, subtitle: 'Detailed records' })}
                onEdit={() => handleEditDefaultWidget(dashboard.table.title, 'table', 'Detailed records')}
                onDelete={() => addToast({ message: 'Widget deleted.', type: 'info' })}
                onFilter={() => addToast({ message: 'Widget filter opening.', type: 'info' })}
                pageFilterFields={pageFilterFields}
                widgetFields={['date', 'month', 'region', 'vendor', 'status', 'category', 'department']}
                dataLinks={dataLinks}
                onRemovePageFilter={(id) => setPageFilterFields(pageFilterFields.filter(f => f !== id))}
                onClearPageFilters={() => setPageFilterFields([])}
                loading={widgetLoadingStates['table'] === 'loading'}
                isFirstLoad={!hasLoadedOnce}
                chartType="table"
                hideDrill
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: 900 }}>
                    <thead>
                      <tr className="border-b border-canvas-border bg-surface-2/50">
                        {dashboard.table.headers.map(h => (
                          <th key={h} className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.table.rows.map((row, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.04 }}
                          className="border-b border-canvas-border/50 last:border-0 hover:bg-brand-50/30 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-[0.75rem] font-semibold text-brand-700">{row.cells[0]}</td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-800">{row.cells[1]}</td>
                          <td className="px-4 py-3 text-[0.75rem] font-medium text-ink-900">{row.cells[2]}</td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-600">{row.cells[3]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[row.cells[4]] || 'bg-gray-50 text-gray-600'}`}>
                              {row.cells[4]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-600">{row.cells[5]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full ${RISK_COLORS[row.cells[6]] || ''}`}>
                              {row.cells[6]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-500 font-mono">{row.cells[7]}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-canvas-border" onClick={e => e.stopPropagation()}>
                  <span className="text-[0.75rem] text-ink-400">Showing 1–{dashboard.table.rows.length} of {dashboard.table.rows.length}</span>
                  <div className="flex items-center gap-1">
                    <button className="size-7 flex items-center justify-center rounded text-ink-400 hover:bg-surface-2 transition-colors cursor-pointer">
                      <ChevronDown size={14} className="rotate-90" />
                    </button>
                    <button className="size-7 flex items-center justify-center rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold">1</button>
                    <button className="size-7 flex items-center justify-center rounded-md text-ink-600 text-[0.75rem] font-medium hover:bg-surface-2 transition-colors cursor-pointer">2</button>
                    <button className="size-7 flex items-center justify-center rounded text-ink-400 hover:bg-surface-2 transition-colors cursor-pointer">
                      <ChevronDown size={14} className="-rotate-90" />
                    </button>
                  </div>
                </div>
              </WidgetCard>
            </motion.div>

            {/* Empty Chart Widget — placeholder */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div
                className="glass-card rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-brand-300 hover:shadow-md transition-all group"
                style={{ minHeight: 280 }}
                onClick={() => setAddWidgetOpen(true)}
              >
                <div className="mx-auto mb-4 size-20 rounded-2xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                  <Plus size={32} className="text-brand-400 group-hover:text-brand-600 transition-colors" />
                </div>
                <p className="text-[0.9375rem] font-semibold text-ink-700 mb-1">Add a New Widget</p>
                <p className="text-[0.8125rem] text-ink-400 max-w-[260px] text-center leading-relaxed">Click here or use the + Add Widget button to create a new chart, KPI, or table.</p>
              </div>
            </motion.div>
            </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Expanded Widget Modal */}
      {(() => {
        // Build navigation list of all widgets
        const allWidgetTitles: { title: string; subtitle: string }[] = [];
        if (isCustomDashboard) {
          userWidgets.forEach(w => allWidgetTitles.push({ title: w.title, subtitle: w.yField && w.xField ? `${w.yField} by ${w.xField}` : 'Custom widget' }));
        } else {
          allWidgetTitles.push({ title: dashboard.lineTrend?.title || 'Detection Accuracy Goals', subtitle: 'Performance over time' });
          allWidgetTitles.push({ title: dashboard.progress?.title || 'Invoice Volume Trend', subtitle: dashboard.progress ? 'Sheet distribution' : 'Volume over time' });
          allWidgetTitles.push({ title: dashboard.bars?.title || 'Monthly Invoice Volume', subtitle: 'Trend analysis' });
          allWidgetTitles.push({ title: dashboard.donut?.title || 'Invoice Status', subtitle: 'Distribution breakdown' });
          allWidgetTitles.push({ title: dashboard.table.title, subtitle: 'Detailed records' });
        }
        const currentIdx = expandedWidget ? allWidgetTitles.findIndex(w => w.title === expandedWidget.title) : -1;
        const expandedChartType = (() => {
          if (!expandedWidget) return 'clustered-column';
          const et = expandedWidget.title.toLowerCase();
          if (et === dashboard.table.title.toLowerCase()) return 'table';
          if (et.includes('accuracy') || et.includes('detection') || et.includes('goals')) return 'line-clustered';
          if (et.includes('volume') && et.includes('trend')) return 'area';
          if (et.includes('volume') || et.includes('monthly')) return 'clustered-column';
          if (et.includes('status') || et.includes('distribution') || et.includes('pie')) return 'pie';
          const uw = userWidgets.find(w => w.title === expandedWidget.title);
          return uw?.chartType || 'clustered-column';
        })();
        return (
      <ExpandedWidgetModal
        open={!!expandedWidget}
        onClose={() => { setExpandedWidget(null); setOpenEditSidebarOnExpand(false); setExpandCustomize({ fontFamily: 'Inter', bold: false, italic: false, underline: false, xAxisTitle: '', yAxisTitle: '', yMin: '', yMax: '', invertRange: false }); }}
        title={expandedWidget?.title ?? ''}
        subtitle={expandedWidget?.subtitle}
        isTable={expandedWidget?.title === dashboard.table.title}
        widgetChartType={expandedChartType}
        autoOpenEditSidebar={openEditSidebarOnExpand}
        onEditSidebarOpened={() => setOpenEditSidebarOnExpand(false)}
        onOpenAddData={() => setAddDataOpen(true)}
        customizeState={expandCustomize}
        onCustomizeChange={handleExpandCustomizeChange}
        xField={expandXField}
        yField={expandYField}
        legendField={expandLegendField}
        onXFieldChange={(v) => { setExpandXField(v); setExpandCustomize(prev => ({ ...prev, xAxisTitle: v })); }}
        onYFieldChange={(v) => { setExpandYField(v); setExpandCustomize(prev => ({ ...prev, yAxisTitle: v })); }}
        onLegendFieldChange={setExpandLegendField}
        isExcelDashboard={isExcelDashboard}
        dataSourceInfo={widgetDataSourceInfo}
        hasPrev={currentIdx > 0}
        hasNext={currentIdx < allWidgetTitles.length - 1 && currentIdx >= 0}
        onPrev={() => { if (currentIdx > 0) setExpandedWidget(allWidgetTitles[currentIdx - 1]); }}
        onNext={() => { if (currentIdx < allWidgetTitles.length - 1) setExpandedWidget(allWidgetTitles[currentIdx + 1]); }}
        onEdit={() => {
          const widgetTitle = expandedWidget?.title;
          const widgetSubtitle = expandedWidget?.subtitle || '';
          setExpandedWidget(null);
          if (widgetTitle) {
            const idx = userWidgets.findIndex(w => w.title === widgetTitle);
            if (idx !== -1) {
              setEditingWidget({ index: idx, data: userWidgets[idx] });
            } else {
              // Default dashboard widget — infer chart type and fields from title/subtitle
              const parts = widgetSubtitle.split(' by ');
              const yField = parts[0]?.trim() || '';
              const xField = parts[1]?.trim() || '';
              // Try to guess chart type from dashboard data
              let chartType = 'clustered-column';
              if (widgetTitle.toLowerCase().includes('trend') || widgetTitle.toLowerCase().includes('line')) chartType = 'line';
              else if (widgetTitle.toLowerCase().includes('donut') || widgetTitle.toLowerCase().includes('pie') || widgetTitle.toLowerCase().includes('distribution')) chartType = 'pie';
              else if (widgetTitle.toLowerCase().includes('kpi') || widgetTitle.toLowerCase().includes('score')) chartType = 'kpi';
              else if (widgetTitle.toLowerCase().includes('table')) chartType = 'table';
              setEditingWidget({ index: -1, data: { chartType, title: widgetTitle, xField, yField } });
            }
          }
          setTimeout(() => setAddWidgetOpen(true), 150);
        }}
        onDelete={() => {
          const title = expandedWidget?.title;
          setExpandedWidget(null);
          if (title) {
            const idx = userWidgets.findIndex(w => w.title === title);
            if (idx !== -1) {
              const next = userWidgets.filter((_, j) => j !== idx);
              setUserWidgets(next);
              onSaveWidgets?.(next);
            }
          }
          addToast({ message: 'Widget deleted', type: 'info' });
        }}
      >
        {/* Visualization tab content — render the matching ConfigurableChart */}
        {expandedWidget && (() => {
          const t = expandedWidget.title.toLowerCase();
          // Match by title keywords to be resilient to title changes
          let chartConfig: { type: string; xAxis: string; yAxis: string } | null = null;
          if (t.includes('accuracy') || t.includes('detection') || t.includes('goals')) {
            chartConfig = { type: 'combo', xAxis: 'Month', yAxis: 'Duplicate Count' };
          } else if (t.includes('volume') && t.includes('trend')) {
            chartConfig = { type: 'area', xAxis: 'Month', yAxis: 'Duplicate Count' };
          } else if (t.includes('volume') || t.includes('monthly')) {
            chartConfig = { type: 'bar', xAxis: 'Month', yAxis: 'Duplicate Count' } as any;
            (chartConfig as any).singleSeries = true;
          } else if (t.includes('status') || t.includes('distribution') || t.includes('pie')) {
            chartConfig = { type: 'pie', xAxis: 'Status', yAxis: 'Duplicate Count' };
          }
          const match = chartConfig as any;
          if (match) {
            return (
              <div className="w-full h-full">
                <ConfigurableChart
                  type={match.type as any}
                  xAxis={expandXField || match.xAxis}
                  yAxis={expandYField || match.yAxis}
                  showTarget={match.singleSeries ? false : undefined}
                  fontFamily={expandCustomize.fontFamily}
                  bold={expandCustomize.bold}
                  italic={expandCustomize.italic}
                  underline={expandCustomize.underline}
                  xAxisTitle={expandCustomize.xAxisTitle}
                  yAxisTitle={expandCustomize.yAxisTitle}
                  yMin={expandCustomize.yMin}
                  yMax={expandCustomize.yMax}
                  invertRange={expandCustomize.invertRange}
                />
              </div>
            );
          }
          if (t === dashboard.table.title.toLowerCase()) {
            const totalRows = EXPANDED_TABLE_ROWS.length;
            const totalPages = Math.ceil(totalRows / TABLE_PAGE_SIZE);
            const pageRows = EXPANDED_TABLE_ROWS.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);
            const startRow = tablePage * TABLE_PAGE_SIZE + 1;
            const endRow = Math.min((tablePage + 1) * TABLE_PAGE_SIZE, totalRows);
            return (
              <>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left" style={{ minWidth: 900 }}>
                    <thead>
                      <tr className="border-b border-canvas-border bg-surface-2/50">
                        {dashboard.table.headers.map(h => (
                          <th key={h} className="text-[0.6875rem] font-bold text-ink-500 uppercase tracking-wider px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, i) => (
                        <motion.tr
                          key={row.cells[0]}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-canvas-border/50 last:border-0 hover:bg-brand-50/30 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 text-[0.75rem] font-semibold text-brand-700">{row.cells[0]}</td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-800">{row.cells[1]}</td>
                          <td className="px-4 py-3 text-[0.75rem] font-medium text-ink-900">{row.cells[2]}</td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-600">{row.cells[3]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[0.6875rem] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[row.cells[4]] || 'bg-gray-50 text-gray-600'}`}>
                              {row.cells[4]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-600">{row.cells[5]}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full ${RISK_COLORS[row.cells[6]] || ''}`}>
                              {row.cells[6]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[0.75rem] text-ink-500 font-mono">{row.cells[7]}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-canvas-border shrink-0">
                  <span className="text-[0.75rem] text-ink-400">Showing {startRow}–{endRow} of {totalRows}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTablePage(p => Math.max(0, p - 1))}
                      disabled={tablePage === 0}
                      className={`size-7 flex items-center justify-center rounded transition-colors ${tablePage === 0 ? 'text-ink-300 cursor-not-allowed' : 'text-ink-400 hover:bg-surface-2 cursor-pointer'}`}
                    >
                      <ChevronDown size={14} className="rotate-90" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setTablePage(i)}
                        className={`size-7 flex items-center justify-center rounded-md text-[0.75rem] font-medium transition-colors cursor-pointer ${
                          tablePage === i ? 'bg-brand-600 text-white font-semibold' : 'text-ink-600 hover:bg-surface-2'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={tablePage === totalPages - 1}
                      className={`size-7 flex items-center justify-center rounded transition-colors ${tablePage === totalPages - 1 ? 'text-ink-300 cursor-not-allowed' : 'text-ink-400 hover:bg-surface-2 cursor-pointer'}`}
                    >
                      <ChevronDown size={14} className="-rotate-90" />
                    </button>
                  </div>
                </div>
              </>
            );
          }
          return null;
        })()}
      </ExpandedWidgetModal>
        );
      })()}

      {/* Filter Panel */}
      <FilterPanel
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        modelTables={MODEL_TABLES}
        pageFilterFields={pageFilterFields}
        onPageFilterFieldsChange={setPageFilterFields}
        pageFilterValues={pageFilterValues}
        onPageFilterValuesChange={setPageFilterValues}
        crossFilter={crossFilter}
        onResetAll={clearAllFilters}
      />

      {/* Table relationships (data model) */}
      <AnimatePresence>
        {connectTablesOpen && (
          <RelationshipManagerModal
            open={connectTablesOpen}
            onClose={() => setConnectTablesOpen(false)}
            tables={MODEL_TABLES}
            relationships={relationships}
            setRelationships={setRelationships}
            widgets={userWidgets.map(w => ({ title: w.title, model: w.model }))}
            addToast={addToast}
          />
        )}
      </AnimatePresence>

      {/* Add Widget Modal */}
      <AddCardModal
        open={addWidgetOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setAddWidgetOpen(false);
            setEditingWidget(null);
            if (initialCustomFields?.length && userWidgets.length === 0 && onBack) onBack();
          }
        }}
        mode={editingWidget ? 'edit' : 'add'}
        initialWidgetType={editingWidget?.data?.chartType}
        initialXAxis={editingWidget?.data?.xField}
        initialYAxis={editingWidget?.data?.yField}
        initialColor={editingWidget?.data?.color}
        initialFontFamily={editingWidget?.data?.fontFamily}
        initialName={editingWidget?.data?.title}
        initialSeriesColors={editingWidget?.data?.seriesColors}
        initialModel={editingWidget?.data?.model}
        modelTables={MODEL_TABLES}
        relationships={relationships}
        onConnectTables={() => setConnectTablesOpen(true)}
        onSelectCard={(cardType, config) => {
          const widget = {
            chartType: cardType,
            title: config?.name || cardType,
            xField: config?.xAxis || '',
            yField: config?.yAxis || '',
            color: config?.color,
            fontFamily: config?.fontFamily,
            seriesColors: config?.seriesColors,
            model: config?.model,
          };
          if (editingWidget !== null && editingWidget.index >= 0) {
            const next = userWidgets.map((w, i) => i === editingWidget.index ? widget : w);
            setUserWidgets(next);
            onSaveWidgets?.(next);
            setEditingWidget(null);
          } else {
            const next = [...userWidgets, widget];
            setUserWidgets(next);
            onSaveWidgets?.(next);
          }
          setAddWidgetOpen(false);
          addToast({ message: editingWidget ? 'Widget updated' : 'Widget added', type: 'success' });
        }}
        onOpenExcelUpload={() => addToast({ message: 'Upload Excel', type: 'info' })}
        onOpenQueryModal={() => addToast({ message: 'Open Query', type: 'info' })}
        onOpenAddData={() => setAddDataOpen(true)}
        onOpenKnowledgeHub={onOpenKnowledgeHub}
        dashboardSource={dashboardSourceType ? {
          type: dashboardSourceType,
          sourceId: dashboardSourceId,
          sourceName: dashboardSourceName,
        } : undefined}
      />
      <AddDataModal
        open={addDataOpen}
        onClose={() => setAddDataOpen(false)}
        connectedSources={dataSourceNames.map(name => {
          const seed = SEED.find(s => s.name === name);
          return seed
            ? { id: seed.id, name: seed.name, type: seed.type, subtype: seed.subtype }
            : { name, type: name.toLowerCase().endsWith('.csv') ? ('file' as const) : name.toLowerCase().match(/\.(xlsx|xls)$/) ? ('file' as const) : name.includes('query') ? ('query' as const) : ('database' as const) };
        })}
        primarySourceId={dashboardSourceId}
        onAttach={(src) => {
          // Append to dataSourceNames; flip dashboard to 'combo' if it was
          // single-source and the user is adding a different one.
          if (dataSourceNames.includes(src.name)) {
            addToast({ message: `${src.name} is already attached`, type: 'info' });
            return;
          }
          const nextNames = [...dataSourceNames, src.name];
          setDataSourceNames(nextNames);
          const nextType: 'excel' | 'csv' | 'sql' | 'query' | 'combo' =
            (dashboardSourceType && dashboardSourceType !== 'combo' && nextNames.length > 1) ? 'combo' : (dashboardSourceType ?? 'combo');
          setDashboardSourceType(nextType);
          onUpdateDashboardSource?.({ dataSource: nextType, dataSourceNames: nextNames, sourceId: dashboardSourceId });
          addToast({ message: `Attached ${src.name}`, type: 'success' });
        }}
        onSetPrimary={(src) => {
          // Swap dashboard's primary source. Updates type, sourceId, sourceName
          // to point at the picked entry.
          const nextType: 'excel' | 'csv' | 'sql' | 'query' | 'combo' =
            src.type === 'database' ? 'sql' : src.type === 'file' ? (src.subtype === 'CSV' ? 'csv' : 'excel') : src.type === 'query' ? 'query' : (dashboardSourceType ?? 'sql');
          setDashboardSourceType(nextType);
          setDashboardSourceId(src.id);
          setDashboardSourceName(src.name);
          onUpdateDashboardSource?.({ dataSource: nextType, sourceId: src.id, dataSourceNames });
          addToast({ message: `Primary source set to ${src.name}`, type: 'success' });
        }}
      />
    </div>
  );
}
