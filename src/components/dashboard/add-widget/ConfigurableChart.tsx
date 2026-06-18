// @ts-nocheck
/**
 * ConfigurableChart
 * ─────────────────
 * Renders charts that are visually IDENTICAL to the main dashboard.
 * Used by both the AddCardModal preview and GenericWidget (builder canvas).
 *
 * Types:
 *  • line  – "Detection Accuracy Goals" style  (AreaChart + actual + dashed target)
 *  • area  – "Duplicates by Department" style  (AreaChart + gradient fill + dashed target)
 *  • bar   – "DuplicateTrendsChart" style      (grouped bars: duplicates / resolved / pending)
 *  • pie   – "DuplicateDistributionChart" style (donut + legend)
 *  • kpi   – StatCard style                    (big number)
 *  • table – MarketingTable style              (paginated rows with performance bars)
 */

import { useState, useContext } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  LabelList,
  ComposedChart,
} from "recharts";
import {
  useDrillSafe,
  DRILL_LEVEL_META,
  DrillCardIdContext,
} from "./DrillContext";
import type { DrillLevel } from "./DrillContext";
import { KpiCard } from "./KpiCard";
import {
  Plus,
  Eye,
  Filter,
  Download,
  X,
} from "lucide-react";

/* ─── Colour palette ─────────────────────────────────────────────────────── */
const PURPLE = "#7C3AED";
const BLUE = "#3d68ee";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const GRAY = "#9ca3af";
const PIE_CLR = [BLUE, GREEN, AMBER, "#ef4444", "#8b5cf6"];

/* ─── Color helpers ──────────────────────────────────────────────────────── */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * factor));
  const ng = Math.min(255, Math.round(g + (255 - g) * factor));
  const nb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

/* ─── Data ───────────────────────────────────────────────────────────────── */

/** Data for Line / Area charts keyed by [yAxis][xAxis] */
const TREND_DATA: Record<
  string,
  Record<
    string,
    Array<{ label: string; actual: number; target: number }>
  >
> = {
  "Duplicate Score (%)": {
    Month: [
      { label: "Jan", actual: 93, target: 95.5 },
      { label: "Feb", actual: 95, target: 96 },
      { label: "Mar", actual: 96, target: 96.5 },
      { label: "Apr", actual: 95.5, target: 97 },
      { label: "May", actual: 97, target: 97.5 },
      { label: "Jun", actual: 97.5, target: 98 },
    ],
    Week: [
      { label: "Week 1", actual: 92, target: 95 },
      { label: "Week 2", actual: 94, target: 95.5 },
      { label: "Week 3", actual: 95.5, target: 96 },
      { label: "Week 4", actual: 96.5, target: 97 },
      { label: "Week 5", actual: 97.5, target: 97.5 },
    ],
  },
  "Invoice Amount (₹)": {
    Month: [
      { label: "Jan", actual: 28000, target: 32000 },
      { label: "Feb", actual: 55000, target: 65000 },
      { label: "Mar", actual: 78000, target: 90000 },
      { label: "Apr", actual: 100000, target: 115000 },
      { label: "May", actual: 125000, target: 140000 },
      { label: "Jun", actual: 152000, target: 165000 },
    ],
    Week: [
      { label: "Week 1", actual: 28000, target: 32000 },
      { label: "Week 2", actual: 55000, target: 70000 },
      { label: "Week 3", actual: 82000, target: 105000 },
      { label: "Week 4", actual: 115000, target: 135000 },
      { label: "Week 5", actual: 142000, target: 165000 },
    ],
  },
  "Duplicate Count": {
    Month: [
      { label: "Jan", actual: 45, target: 52 },
      { label: "Feb", actual: 52, target: 58 },
      { label: "Mar", actual: 38, target: 42 },
      { label: "Apr", actual: 61, target: 67 },
      { label: "May", actual: 48, target: 52 },
      { label: "Jun", actual: 55, target: 60 },
    ],
    Week: [
      { label: "Week 1", actual: 12, target: 15 },
      { label: "Week 2", actual: 18, target: 22 },
      { label: "Week 3", actual: 15, target: 20 },
      { label: "Week 4", actual: 22, target: 25 },
      { label: "Week 5", actual: 28, target: 30 },
    ],
  },
};

/** Data for Bar charts keyed by xAxis */
const BAR_DATA: Record<
  string,
  Array<{
    label: string;
    duplicates: number;
    resolved: number;
    pending: number;
  }>
> = {
  Month: [
    { label: "Jan", duplicates: 45, resolved: 42, pending: 3 },
    { label: "Feb", duplicates: 52, resolved: 48, pending: 4 },
    { label: "Mar", duplicates: 38, resolved: 35, pending: 3 },
    { label: "Apr", duplicates: 61, resolved: 55, pending: 6 },
    { label: "May", duplicates: 48, resolved: 46, pending: 2 },
    { label: "Jun", duplicates: 55, resolved: 50, pending: 5 },
    { label: "Jul", duplicates: 42, resolved: 40, pending: 2 },
    { label: "Aug", duplicates: 58, resolved: 52, pending: 6 },
    { label: "Sep", duplicates: 67, resolved: 60, pending: 7 },
    { label: "Oct", duplicates: 71, resolved: 65, pending: 6 },
    { label: "Nov", duplicates: 63, resolved: 58, pending: 5 },
    { label: "Dec", duplicates: 54, resolved: 49, pending: 5 },
  ],
  Quarter: [
    {
      label: "Q1",
      duplicates: 135,
      resolved: 125,
      pending: 10,
    },
    {
      label: "Q2",
      duplicates: 164,
      resolved: 151,
      pending: 13,
    },
    {
      label: "Q3",
      duplicates: 167,
      resolved: 152,
      pending: 15,
    },
    {
      label: "Q4",
      duplicates: 188,
      resolved: 172,
      pending: 16,
    },
  ],
  Week: [
    { label: "Wk 1", duplicates: 12, resolved: 11, pending: 1 },
    { label: "Wk 2", duplicates: 15, resolved: 13, pending: 2 },
    { label: "Wk 3", duplicates: 9, resolved: 8, pending: 1 },
    { label: "Wk 4", duplicates: 18, resolved: 16, pending: 2 },
    { label: "Wk 5", duplicates: 14, resolved: 13, pending: 1 },
    { label: "Wk 6", duplicates: 11, resolved: 10, pending: 1 },
    { label: "Wk 7", duplicates: 16, resolved: 14, pending: 2 },
    { label: "Wk 8", duplicates: 13, resolved: 12, pending: 1 },
    { label: "Wk 9", duplicates: 19, resolved: 17, pending: 2 },
    {
      label: "Wk 10",
      duplicates: 22,
      resolved: 20,
      pending: 2,
    },
    {
      label: "Wk 11",
      duplicates: 17,
      resolved: 15,
      pending: 2,
    },
    {
      label: "Wk 12",
      duplicates: 14,
      resolved: 13,
      pending: 1,
    },
  ],
  Day: [
    { label: "D1", duplicates: 3, resolved: 3, pending: 0 },
    { label: "D2", duplicates: 5, resolved: 4, pending: 1 },
    { label: "D3", duplicates: 2, resolved: 2, pending: 0 },
    { label: "D4", duplicates: 7, resolved: 6, pending: 1 },
    { label: "D5", duplicates: 4, resolved: 4, pending: 0 },
    { label: "D6", duplicates: 6, resolved: 5, pending: 1 },
    { label: "D7", duplicates: 3, resolved: 3, pending: 0 },
    { label: "D8", duplicates: 8, resolved: 7, pending: 1 },
    { label: "D9", duplicates: 5, resolved: 5, pending: 0 },
    { label: "D10", duplicates: 4, resolved: 3, pending: 1 },
    { label: "D11", duplicates: 6, resolved: 6, pending: 0 },
    { label: "D12", duplicates: 9, resolved: 8, pending: 1 },
    { label: "D13", duplicates: 7, resolved: 6, pending: 1 },
    { label: "D14", duplicates: 5, resolved: 5, pending: 0 },
  ],
  Region: [
    {
      label: "North",
      duplicates: 78,
      resolved: 72,
      pending: 6,
    },
    {
      label: "South",
      duplicates: 92,
      resolved: 85,
      pending: 7,
    },
    { label: "East", duplicates: 45, resolved: 40, pending: 5 },
    { label: "West", duplicates: 67, resolved: 60, pending: 7 },
    {
      label: "Central",
      duplicates: 53,
      resolved: 48,
      pending: 5,
    },
    { label: "APAC", duplicates: 38, resolved: 35, pending: 3 },
  ],
  Status: [
    {
      label: "Pending",
      duplicates: 89,
      resolved: 0,
      pending: 89,
    },
    {
      label: "Resolved",
      duplicates: 234,
      resolved: 234,
      pending: 0,
    },
    {
      label: "Flagged",
      duplicates: 67,
      resolved: 30,
      pending: 37,
    },
    {
      label: "Approved",
      duplicates: 156,
      resolved: 156,
      pending: 0,
    },
    {
      label: "Rejected",
      duplicates: 45,
      resolved: 0,
      pending: 45,
    },
  ],
  Category: [
    {
      label: "Software",
      duplicates: 45,
      resolved: 40,
      pending: 5,
    },
    {
      label: "Hardware",
      duplicates: 32,
      resolved: 28,
      pending: 4,
    },
    {
      label: "Office",
      duplicates: 28,
      resolved: 25,
      pending: 3,
    },
    {
      label: "Travel",
      duplicates: 19,
      resolved: 17,
      pending: 2,
    },
    {
      label: "Services",
      duplicates: 56,
      resolved: 50,
      pending: 6,
    },
    { label: "Misc", duplicates: 21, resolved: 19, pending: 2 },
  ],
  Department: [
    {
      label: "Finance",
      duplicates: 89,
      resolved: 80,
      pending: 9,
    },
    { label: "IT", duplicates: 67, resolved: 62, pending: 5 },
    { label: "HR", duplicates: 34, resolved: 30, pending: 4 },
    {
      label: "Operations",
      duplicates: 78,
      resolved: 72,
      pending: 6,
    },
    {
      label: "Marketing",
      duplicates: 45,
      resolved: 41,
      pending: 4,
    },
  ],
  "Vendor Name": [
    {
      label: "Acme Corp",
      duplicates: 28,
      resolved: 25,
      pending: 3,
    },
    {
      label: "Globex Inc",
      duplicates: 15,
      resolved: 13,
      pending: 2,
    },
    {
      label: "Initech",
      duplicates: 42,
      resolved: 38,
      pending: 4,
    },
    {
      label: "Umbrella Co",
      duplicates: 19,
      resolved: 17,
      pending: 2,
    },
    {
      label: "Stark Ind",
      duplicates: 31,
      resolved: 28,
      pending: 3,
    },
    {
      label: "Wayne Ent",
      duplicates: 22,
      resolved: 20,
      pending: 2,
    },
  ],
};

/** Data for Pie charts keyed by xAxis */
export const PIE_DATA: Record<
  string,
  Array<{ name: string; value: number; percentage: number }>
> = {
  Status: [
    { name: "Pending", value: 89, percentage: 17 },
    { name: "Resolved", value: 234, percentage: 44 },
    { name: "Flagged", value: 67, percentage: 13 },
    { name: "Approved", value: 156, percentage: 29 },
    { name: "Rejected", value: 45, percentage: 8 },
  ],
  Region: [
    { name: "North", value: 78, percentage: 20 },
    { name: "South", value: 92, percentage: 24 },
    { name: "East", value: 45, percentage: 12 },
    { name: "West", value: 67, percentage: 17 },
    { name: "Central", value: 53, percentage: 14 },
    { name: "APAC", value: 38, percentage: 10 },
  ],
  Category: [
    { name: "Software", value: 45, percentage: 20 },
    { name: "Hardware", value: 32, percentage: 14 },
    { name: "Office", value: 28, percentage: 12 },
    { name: "Travel", value: 19, percentage: 8 },
    { name: "Services", value: 56, percentage: 25 },
    { name: "Misc", value: 21, percentage: 9 },
  ],
  Department: [
    { name: "Finance", value: 89, percentage: 34 },
    { name: "IT", value: 67, percentage: 26 },
    { name: "HR", value: 34, percentage: 13 },
    { name: "Operations", value: 78, percentage: 30 },
    { name: "Marketing", value: 45, percentage: 17 },
  ],
  "Vendor Name": [
    { name: "Acme Corp", value: 28, percentage: 18 },
    { name: "Globex Inc", value: 15, percentage: 10 },
    { name: "Initech", value: 42, percentage: 27 },
    { name: "Umbrella Co", value: 19, percentage: 12 },
    { name: "Stark Ind", value: 31, percentage: 20 },
    { name: "Wayne Ent", value: 22, percentage: 14 },
  ],
};

/** KPI values keyed by metric name */
const KPI_VALUES: Record<
  string,
  { value: string; label: string }
> = {
  "Invoices Scanned": {
    value: "45",
    label: "Invoices Scanned",
  },
  "Duplicates Found": { value: "1", label: "Duplicates Found" },
  "Amount at Risk (₹)": {
    value: "₹2,34,589k",
    label: "Amount at Risk",
  },
  "Detection Accuracy (%)": {
    value: "98.7%",
    label: "Detection Accuracy",
  },
};

/* ─── Y-axis formatter ───────────────────────────────────────────────────── */
function makeYFmt(yAxis: string) {
  if (yAxis === "Invoice Amount (₹)")
    return (v: number) => `₹${(v / 1000).toFixed(0)}k`;
  if (yAxis.includes("%")) return (v: number) => `${v}%`;
  return (v: number) => `${v}`;
}

/* ─── Custom tooltips ────────────────────────────────────────────────────── */
function TrendTooltip({ active, payload, label, yAxis }: any) {
  if (!active || !payload?.length) return null;
  const fmt = makeYFmt(yAxis);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[0.75rem]">
      <p className="font-semibold text-[#26064a] mb-2">
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="size-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-[#26064a]">
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[0.75rem]">
      <p className="font-semibold text-[#26064a] mb-2">
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="size-2 rounded-full"
            style={{ backgroundColor: p.fill }}
          />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-[#26064a]">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-[0.75rem]">
      <p className="font-semibold text-[#26064a]">
        {payload[0].name}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-gray-500">Count:</span>
        <span className="font-semibold text-[#26064a]">
          {payload[0].value}
        </span>
      </div>
    </div>
  );
}

/* ─── Table preview component ────────────────────────────────────────────── */
function TablePreview() {
  const ALL_COLUMNS = [
    "INVOICE ID",
    "PO NUMBER",
    "DATE",
    "VENDOR",
    "CATEGORY",
    "VALUE",
    "PERFORMANCE",
  ];
  const COL_KEYS: Record<string, string> = {
    "INVOICE ID": "id",
    "PO NUMBER": "po",
    DATE: "date",
    VENDOR: "vendor",
    CATEGORY: "cat",
    VALUE: "value",
    PERFORMANCE: "perf",
  };

  const [page, setPage] = useState(1);
  const [tableFilters, setTableFilters] = useState<
    { column: string; value: string }[]
  >([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    ...ALL_COLUMNS,
  ]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  const rows = [
    {
      id: "STG-001",
      po: "Awareness",
      date: "5,240",
      vendor: "100%",
      cat: "100%",
      value: "₹2,620k",
      perf: 100,
    },
    {
      id: "STG-001",
      po: "Awareness",
      date: "5,240",
      vendor: "0%",
      cat: "0%",
      value: "₹2,620k",
      perf: 70,
    },
    {
      id: "STG-002",
      po: "Retention",
      date: "8,430",
      vendor: "10%",
      cat: "10%",
      value: "₹3,145k",
      perf: 42,
    },
    {
      id: "STG-003",
      po: "Consideration",
      date: "3,750",
      vendor: "25%",
      cat: "25%",
      value: "₹4,300k",
      perf: 25,
    },
    {
      id: "STG-004",
      po: "Action",
      date: "4,110",
      vendor: "75%",
      cat: "75%",
      value: "₹2,750k",
      perf: 15,
    },
    {
      id: "STG-006",
      po: "Decision",
      date: "1,620",
      vendor: "100%",
      cat: "100%",
      value: "₹1,890k",
      perf: 10,
    },
    {
      id: "STG-005",
      po: "Advocacy",
      date: "6,890",
      vendor: "50%",
      cat: "50%",
      value: "₹5,950k",
      perf: 9,
    },
    {
      id: "STG-005",
      po: "Innovation",
      date: "7,245",
      vendor: "75%",
      cat: "75%",
      value: "₹6,250k",
      perf: 9,
    },
    {
      id: "STG-005",
      po: "Sustainability",
      date: "6,532",
      vendor: "100%",
      cat: "100%",
      value: "₹6,500k",
      perf: 9,
    },
  ];
  const perPage = 5;
  const totalPages = Math.ceil(rows.length / perPage);
  const slice = rows.slice(
    (page - 1) * perPage,
    page * perPage,
  );

  const perfColor = (p: number) =>
    p >= 70
      ? "#10b981"
      : p >= 40
        ? "#3b82f6"
        : p >= 25
          ? "#f59e0b"
          : "#ef4444";

  const addFilter = () => {
    setTableFilters((prev) => [
      ...prev,
      { column: ALL_COLUMNS[0], value: "" },
    ]);
  };

  const removeFilter = (idx: number) => {
    setTableFilters((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFilter = (
    idx: number,
    field: "column" | "value",
    val: string,
  ) => {
    setTableFilters((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [field]: val } : f)),
    );
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col],
    );
  };

  const clearAllFilters = () => {
    setTableFilters([]);
  };

  const handleDownload = () => {
    const header = visibleColumns.join(",");
    const csvRows = rows.map((r: any) =>
      visibleColumns.map((col) => String(r[COL_KEYS[col]])).join(","),
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "table-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedColumns = ALL_COLUMNS.filter((c) =>
    visibleColumns.includes(c),
  );

  return (
    <div className="w-full h-full flex flex-col text-[0.75rem] font-['Inter',sans-serif]">
      {/* ── Filter Toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#e5e7eb] shrink-0">
        <button
          onClick={addFilter}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.75rem] font-medium text-ink-600 rounded-lg border border-canvas-border hover:bg-brand-50 transition-colors"
        >
          <Plus size={14} />
          Add Filter
        </button>

        {/* Columns toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColumnDropdown((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.75rem] font-medium text-ink-600 rounded-lg border border-canvas-border hover:bg-brand-50 transition-colors"
          >
            <Eye size={14} />
            Columns ({visibleColumns.length}/{ALL_COLUMNS.length})
          </button>
          {showColumnDropdown && (
            <div className="absolute top-full left-0 mt-1 z-30 w-44 bg-white rounded-lg border border-[#e5e7eb] shadow-lg py-1">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 px-3 py-1.5 text-[0.75rem] text-ink-600 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    className="accent-brand-600 rounded"
                  />
                  {col}
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={clearAllFilters}
          disabled={tableFilters.length === 0}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.75rem] font-medium text-ink-600 rounded-lg border border-canvas-border hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Filter size={14} />
          Clear All
        </button>

        <div className="ml-auto">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[0.75rem] font-medium text-ink-600 rounded-lg border border-canvas-border hover:bg-brand-50 transition-colors"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>

      {/* ── Active filter rows ── */}
      {tableFilters.length > 0 && (
        <div className="flex flex-col gap-1.5 px-4 py-2 border-b border-[#e5e7eb] bg-gray-50/50 shrink-0">
          {tableFilters.map((f, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={f.column}
                onChange={(e) =>
                  updateFilter(idx, "column", e.target.value)
                }
                className="px-2 py-1 text-[0.75rem] text-ink-600 rounded-lg border border-canvas-border bg-white focus:outline-none focus:ring-1 focus:ring-brand-400"
              >
                {ALL_COLUMNS.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={f.value}
                onChange={(e) =>
                  updateFilter(idx, "value", e.target.value)
                }
                placeholder="Select values..."
                className="px-2 py-1 text-[0.75rem] text-ink-600 rounded-lg border border-canvas-border bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-400 w-40"
              />
              <button
                onClick={() => removeFilter(idx)}
                className="p-1 text-ink-600 rounded hover:bg-gray-200 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              {displayedColumns.map((col) => (
                <th
                  key={col}
                  className="text-left py-2.5 px-3 text-[0.625rem] font-semibold text-gray-500 uppercase tracking-[0.5px] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 transition-colors hover:bg-gray-50"
              >
                {displayedColumns.includes("INVOICE ID") && (
                  <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">
                    {r.id}
                  </td>
                )}
                {displayedColumns.includes("PO NUMBER") && (
                  <td className="py-2.5 px-3 text-gray-900 whitespace-nowrap">
                    {r.po}
                  </td>
                )}
                {displayedColumns.includes("DATE") && (
                  <td className="py-2.5 px-3 text-gray-900 whitespace-nowrap">
                    {r.date}
                  </td>
                )}
                {displayedColumns.includes("VENDOR") && (
                  <td className="py-2.5 px-3 text-gray-900 whitespace-nowrap">
                    {r.vendor}
                  </td>
                )}
                {displayedColumns.includes("CATEGORY") && (
                  <td className="py-2.5 px-3 text-gray-900 whitespace-nowrap">
                    {r.cat}
                  </td>
                )}
                {displayedColumns.includes("VALUE") && (
                  <td className="py-2.5 px-3 text-gray-900 whitespace-nowrap">
                    {r.value}
                  </td>
                )}
                {displayedColumns.includes("PERFORMANCE") && (
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${r.perf}%`,
                            backgroundColor: perfColor(r.perf),
                          }}
                        />
                      </div>
                      <span
                        style={{ color: perfColor(r.perf) }}
                        className="font-medium w-8"
                      >
                        {r.perf}%
                      </span>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-100 shrink-0">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 text-[0.6875rem] text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() =>
            setPage((p) => Math.min(totalPages, p + 1))
          }
          disabled={page === totalPages}
          className="px-3 py-1 text-[0.6875rem] text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────── */
export interface ConfigurableChartProps {
  type:
    | "kpi"
    | "line"
    | "area"
    | "bar"
    | "pie"
    | "table"
    | "KPI"
    | "Line Chart"
    | "Area Chart"
    | "Bar Chart"
    | "Pie Chart"
    | "Table";
  xAxis?: string;
  yAxis?: string;
  /** Show numeric value labels directly on data points. Default: false */
  showLabels?: boolean;
  /** Pie-chart outer radius (Recharts SVG units or percent of container).
   *  Default '58%' keeps the existing dashboard sizing; bigger surfaces
   *  (e.g. the audit-result chart card) can pass '70%' to fill the card. */
  pieOuterRadius?: string | number;
  /** Show the target line/series. Default: true */
  showTarget?: boolean;
  /** Base chart color. Default: brand purple #7C3AED */
  color?: string;
  /** Per-series color overrides keyed by series label */
  seriesColors?: Record<string, string>;
  /** Callback when a legend swatch is clicked to edit color */
  onSeriesColorChange?: (label: string, color: string) => void;
  /** Bar spacing percentage (0-50). Only applies to bar/column charts */
  barSpacing?: string;
  /** Per-slice distance from center for pie charts */
  pieSpacingMap?: Record<string, string>;
  /** Font family for all chart text. Default: "Inter" */
  fontFamily?: string;
  /** Bold text styling for chart labels */
  bold?: boolean;
  /** Italic text styling for chart labels */
  italic?: boolean;
  /** Underline text styling for chart labels */
  underline?: boolean;
  /** Custom X axis title label */
  xAxisTitle?: string;
  /** Custom Y axis title label */
  yAxisTitle?: string;
  /** Show/hide legend. Default: true */
  showLegend?: boolean;
  /** Y axis minimum value */
  yMin?: string;
  /** Y axis maximum value */
  yMax?: string;
  /** Invert Y axis range */
  invertRange?: boolean;
  /** Legend position */
  legendPosition?: string;
  /** Legend bold */
  legendBold?: boolean;
  /** Legend italic */
  legendItalic?: boolean;
  /** Legend text color */
  legendTextColor?: string;
  /** Conditional formatting rules */
  conditionalRules?: { evaluateField: string; condition: string; value: string; value2?: string; color: string }[];
  /** Aggregation type for Y axis values */
  aggregation?: string;
  /** All column names for table type */
  tableColumns?: string[];
}

/* ─── Drill-level → effective time-axis mapping ───────────────────────────── */
const TIME_AXES = new Set(["Month", "Week"]);
const DRILL_TO_AXIS: Record<DrillLevel, string> = {
  0: "MonthH1", // sentinel – Month sliced to 6
  1: "Quarter",
  2: "Month",
  3: "Week",
  4: "Day",
};

/* ─── Main component ─────────────────────────────────────────────────────── */
const EDITABLE_PALETTE = ['#6a12cd', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];

export function ConfigurableChart({
  type,
  xAxis = "Month",
  yAxis = "Duplicate Count",
  showLabels = false,
  pieOuterRadius = '58%',
  showTarget = true,
  color,
  seriesColors,
  onSeriesColorChange,
  barSpacing,
  pieSpacingMap,
  fontFamily: fontFamilyProp,
  bold = false,
  italic = false,
  underline: _underline = false,
  xAxisTitle,
  yAxisTitle,
  showLegend = true,
  yMin,
  yMax,
  invertRange = false,
  legendPosition: legendPosProp,
  legendBold: legendBoldProp,
  legendItalic: legendItalicProp,
  legendTextColor: legendTextColorProp,
  conditionalRules,
  aggregation,
  tableColumns,
}: ConfigurableChartProps) {
  const fontFamily = `${fontFamilyProp || "Inter"}, sans-serif`;
  const fontWeight = bold ? 700 : undefined;
  const fontStyle = italic ? ("italic" as const) : undefined;
  const textDecoration = _underline ? ("underline" as const) : undefined;
  const textStyle = { fontFamily, fontWeight, fontStyle, textDecoration };
  // Conditional formatting helper
  const evalCondition = (dataValue: number, rule: { condition: string; value: string; value2?: string }): boolean => {
    const v = parseFloat(rule.value);
    if (isNaN(v) && rule.condition !== 'isNull' && rule.condition !== 'isNotNull') return false;
    switch (rule.condition) {
      case 'greater': return dataValue > v;
      case 'greaterEqual': return dataValue >= v;
      case 'less': return dataValue < v;
      case 'lessEqual': return dataValue <= v;
      case 'equal': return dataValue === v;
      case 'notEqual': return dataValue !== v;
      case 'between': { const v2 = parseFloat(rule.value2 || ''); return !isNaN(v2) && dataValue >= v && dataValue <= v2; }
      default: return false;
    }
  };
  const getConditionalColor = (dataValue: number, fallback: string): string => {
    if (!conditionalRules || conditionalRules.length === 0) return fallback;
    for (const rule of conditionalRules) {
      if (!rule.value && rule.condition !== 'isNull' && rule.condition !== 'isNotNull') continue;
      if (evalCondition(dataValue, rule)) return rule.color;
    }
    return fallback;
  };

  // Aggregation multiplier — simulates different aggregation views on mock data
  const aggMultiplier = (() => {
    switch (aggregation) {
      case 'sum': return 1;
      case 'average': return 0.45;
      case 'minimum': return 0.2;
      case 'maximum': return 1.3;
      case 'count': return 0.6;
      case 'count_d': return 0.55;
      case 'stddev': return 0.3;
      case 'variance': return 0.15;
      case 'median': return 0.5;
      default: return 1;
    }
  })();
  const applyAgg = (val: number) => Math.round(val * aggMultiplier);

  const legendIsVertical = legendPosProp === 'left' || legendPosProp === 'right';
  const legendLayout = legendIsVertical ? 'vertical' : 'horizontal';
  const legendVAlign = legendPosProp === 'bottom' ? 'bottom' : legendIsVertical ? 'middle' : 'top';
  const legendAlign = legendPosProp === 'left' ? 'left' : legendPosProp === 'right' ? 'right' : 'center';
  const legendStyle: Record<string, any> = {
    fontSize: 12,
    ...textStyle,
    paddingBottom: !legendIsVertical && legendVAlign === 'top' ? 8 : 0,
    paddingTop: !legendIsVertical && legendVAlign === 'bottom' ? 8 : 0,
    ...(legendBoldProp ? { fontWeight: 700 } : {}),
    ...(legendItalicProp ? { fontStyle: 'italic' } : {}),
    ...(legendTextColorProp ? { color: legendTextColorProp } : {}),
  };
  /* normalise type string */
  const t = (
    type === "Line Chart"
      ? "line"
      : type === "Area Chart"
        ? "area"
        : type === "Bar Chart"
          ? "bar"
          : type === "Pie Chart"
            ? "pie"
            : type === "Table"
              ? "table"
              : type === "KPI"
                ? "kpi"
                : type
  ) as "kpi" | "line" | "area" | "bar" | "pie" | "table" | "combo";

  /* ── Drill context ──────────────────────────────────────────────────── */
  const drillCtx = useDrillSafe();
  const myCardId = useContext(DrillCardIdContext);
  const activeDrillId =
    drillCtx?.drillState.activeDrillCardId ?? null;
  const isActiveCard = Boolean(
    myCardId && activeDrillId && myCardId === activeDrillId,
  );

  const drillLevel = (
    isActiveCard ? (drillCtx?.drillState.level ?? 0) : 0
  ) as DrillLevel;
  const isDrillActive = isActiveCard
    ? (drillCtx?.isDrillActive ?? false)
    : false;
  const drillMeta = DRILL_LEVEL_META[drillLevel];
  const drillModeActive = isActiveCard
    ? (drillCtx?.drillState.drillModeActive ?? false)
    : false;
  const doubleDrillPending = isActiveCard
    ? (drillCtx?.drillState.doubleDrillPending ?? false)
    : false;
  const drillIntoItem = drillCtx?.drillIntoItem ?? (() => {});
  const isClickableDrill =
    (drillModeActive || doubleDrillPending) && drillLevel < 2;

  /* ── Derived color palette from prop ────────────────────────────────── */
  const BASE_COLOR = color || PURPLE;
  const BASE_LIGHT1 = lightenHex(BASE_COLOR, 0.35);
  const BASE_LIGHT2 = lightenHex(BASE_COLOR, 0.6);
  const BASE_LIGHT3 = lightenHex(BASE_COLOR, 0.75);
  const BASE_LIGHT4 = lightenHex(BASE_COLOR, 0.85);
  const PIE_COLORS = [
    BASE_COLOR,
    BASE_LIGHT1,
    BASE_LIGHT2,
    BASE_LIGHT3,
    BASE_LIGHT4,
  ];

  const [legendPickerOpen, setLegendPickerOpen] = useState<string | null>(null);

  /* Compute effective xAxis for time-based charts */
  const isTimeBased = TIME_AXES.has(xAxis);
  let effectiveXAxis = xAxis;
  let barData: (typeof BAR_DATA)["Month"] | undefined;

  if (isTimeBased && t === "bar") {
    // Only apply drill transformations if this card is the active drill card
    if (isActiveCard) {
      if (drillLevel === 0) {
        // MonthH1 – first 6 months
        barData = BAR_DATA["Month"].slice(0, 6);
      } else {
        const axis = DRILL_TO_AXIS[drillLevel];
        barData = BAR_DATA[axis] ?? BAR_DATA["Month"];
      }
    } else {
      // Show full data for non-active cards
      barData = BAR_DATA[xAxis] ?? BAR_DATA["Month"];
    }
  }

  /* For line/area: pick effective xAxis key */
  if (isTimeBased && (t === "line" || t === "area")) {
    // Only apply drill transformations if this card is the active drill card
    if (isActiveCard) {
      if (drillLevel === 0) {
        effectiveXAxis = "Month"; // will be sliced below
      } else {
        effectiveXAxis = DRILL_TO_AXIS[drillLevel];
      }
    } else {
      // Show original axis for non-active cards (no drill transformation)
      effectiveXAxis = xAxis;
    }
  }

  const yFmt = makeYFmt(yAxis);

  /* ── KPI ─────────────────────────────────────────────────────────────── */
  if (t === "kpi") {
    const kpi = KPI_VALUES[yAxis] ?? {
      value: "2,543",
      label: yAxis,
    };
    return (
      <div className="w-full h-full flex flex-row items-end">
        <KpiCard
          value={kpi.value}
          label={kpi.label}
          color="#26064A"
        />
      </div>
    );
  }

  /* ── Table ───────────────────────────────────────────────────────────── */
  if (t === "table") {
    // Show table with columns based on xAxis (columns field) or fallback
    const TABLE_MOCK: Record<string, string[]> = {
      'Date': ['20-Mar-25', '15-Dec-24', '31-Dec-24', '13-Dec-24', '12-Jan-25', '05-Feb-25', '22-Jan-25', '18-Mar-25'],
      'Month': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
      'Week': ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
      'Year': ['2023', '2023', '2024', '2024', '2024', '2025', '2025', '2025'],
      'Region': ['North', 'South', 'East', 'West', 'North', 'South', 'East', 'West'],
      'State': ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat', 'Rajasthan', 'UP', 'Kerala'],
      'Vendor Name': ['Acme Corp', 'TechParts Ltd', 'Global Supplies', 'Atlas Mfg', 'DataPipe Co', 'SecureNet', 'PrintWorks', 'CloudHost'],
      'Status': ['Pending Review', 'Under Review', 'Resolved', 'Flagged', 'Auto-Resolved', 'Pending Review', 'Resolved', 'Under Review'],
      'Categories': ['IT Hardware', 'Office Supplies', 'Software', 'Logistics', 'Consulting', 'IT Hardware', 'Office Supplies', 'Software'],
      'Sub Category': ['Laptops', 'Paper', 'Licenses', 'Freight', 'Advisory', 'Servers', 'Toner', 'SaaS'],
      'Category': ['IT', 'Finance', 'Procurement', 'Operations', 'HR', 'Legal', 'IT', 'Finance'],
      'Department': ['Finance', 'IT', 'Procurement', 'Operations', 'HR', 'Sales', 'Finance', 'IT'],
      'Products': ['Laptop Pro X1', 'A4 Print Paper', 'Toner HP', 'USB-C Hub', 'Office Chair', 'Thermal Rolls', 'Monitor 27"', 'Keyboard'],
      'Services': ['Cloud Hosting', 'IT Support', 'Consulting', 'Logistics', 'Legal Review', 'Audit', 'Training', 'Maintenance'],
      'Solutions': ['ERP Module', 'CRM Suite', 'BI Dashboard', 'Payroll SaaS', 'HRMS', 'Inventory', 'Procurement', 'Compliance'],
      'Invoice Amount (₹)': ['₹11,853', '₹4,564', '₹3,835', '₹3,410', '₹24,000', '₹18,500', '₹3,400', '₹8,900'],
      'Amount at Risk (₹)': ['₹2,371', '₹913', '₹767', '₹682', '₹4,800', '₹3,700', '₹680', '₹1,780'],
      'Duplicate Count': ['45', '38', '52', '61', '29', '55', '42', '48'],
      'Duplicate Score (%)': ['94.2%', '87.1%', '91.5%', '78.3%', '96.0%', '88.7%', '92.4%', '85.9%'],
      'Invoices Scanned': ['1,245', '987', '1,102', '1,350', '876', '1,089', '945', '1,201'],
      'Duplicates Found': ['12', '8', '15', '22', '5', '18', '9', '14'],
      'Detection Accuracy (%)': ['96.1%', '93.4%', '97.2%', '89.8%', '98.5%', '94.6%', '95.8%', '91.3%'],
      'Processing Time (d)': ['1.8', '2.1', '1.5', '2.9', '1.2', '2.3', '1.7', '2.5'],
    };
    // Use tableColumns if provided, otherwise fall back to xAxis/yAxis
    const cols: string[] = tableColumns && tableColumns.length > 0
      ? tableColumns
      : [];

    if (cols.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center max-w-[280px]">
            <div className="mx-auto mb-4 size-20 rounded-2xl bg-[#f4f0ff] flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6a12cd" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
            </div>
            <p className="text-[0.9375rem] font-semibold text-[#26064a] mb-1">Add Columns</p>
            <p className="text-[0.8125rem] text-[#9ca3af] leading-relaxed">Drag data fields into the Columns slot to build your table.</p>
          </div>
        </div>
      );
    }
    const rowCount = 8;
    return (
      <div className="w-full h-full flex flex-col text-[0.75rem]" style={{ fontFamily }}>
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse" style={{ tableLayout: cols.length <= 3 ? 'auto' : 'fixed' }}>
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#e5e7eb] bg-[#faf5ff]/40">
                {cols.map(col => (
                  <th key={col} className="text-left py-2.5 px-4 text-[0.625rem] font-bold text-[#6a12cd] uppercase tracking-[0.5px] whitespace-nowrap border-r border-[#f0f0f0] last:border-r-0">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, i) => (
                <tr key={i} className="border-b border-[#f3f4f6] hover:bg-[#faf5ff]/30 transition-colors">
                  {cols.map((col, j) => (
                    <td key={col} className={`py-2.5 px-4 whitespace-nowrap border-r border-[#f9fafb] last:border-r-0 ${j === 0 ? 'text-[#6a12cd] font-medium' : 'text-[#374151]'}`}>
                      {TABLE_MOCK[col]?.[i] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {aggregation && (() => {
              const NUMERIC_COLS = new Set(['Invoice Amount (₹)', 'Amount at Risk (₹)', 'Duplicate Count', 'Duplicate Score (%)', 'Invoices Scanned', 'Duplicates Found', 'Detection Accuracy (%)', 'Processing Time (d)']);
              const parseNum = (s: string) => parseFloat(s.replace(/[₹,%,k]/g, '').replace(/,/g, ''));
              const AGG_LABELS: Record<string, string> = { sum: 'Sum', average: 'Avg', minimum: 'Min', maximum: 'Max', count: 'Count', count_d: 'Count', stddev: 'StdDev', variance: 'Var', median: 'Median' };
              const hasNumericCol = cols.some(c => NUMERIC_COLS.has(c));
              if (!hasNumericCol) return null;
              return (
                <tfoot>
                  <tr className="bg-[#faf5ff] border-t-2 border-[#6a12cd]/20">
                    {cols.map((col, j) => {
                      if (!NUMERIC_COLS.has(col)) {
                        return <td key={col} className="py-2.5 px-4 text-[0.6875rem] font-bold text-[#6a12cd] uppercase whitespace-nowrap">{j === 0 ? AGG_LABELS[aggregation] || aggregation : ''}</td>;
                      }
                      const vals = Array.from({ length: rowCount }, (_, i) => parseNum(TABLE_MOCK[col]?.[i] || '0')).filter(n => !isNaN(n));
                      let result = 0;
                      switch (aggregation) {
                        case 'sum': result = vals.reduce((a, b) => a + b, 0); break;
                        case 'average': result = vals.reduce((a, b) => a + b, 0) / vals.length; break;
                        case 'minimum': result = Math.min(...vals); break;
                        case 'maximum': result = Math.max(...vals); break;
                        case 'count': case 'count_d': result = vals.length; break;
                        case 'median': { const s = [...vals].sort((a, b) => a - b); result = s.length % 2 ? s[Math.floor(s.length / 2)] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; break; }
                        case 'stddev': { const m = vals.reduce((a, b) => a + b, 0) / vals.length; result = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length); break; }
                        case 'variance': { const m2 = vals.reduce((a, b) => a + b, 0) / vals.length; result = vals.reduce((a, b) => a + (b - m2) ** 2, 0) / vals.length; break; }
                        default: result = vals.reduce((a, b) => a + b, 0);
                      }
                      const fmt = col.includes('₹') ? `₹${result.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : col.includes('%') ? `${result.toFixed(1)}%` : col.includes('(d)') ? result.toFixed(1) : result.toLocaleString('en-IN', { maximumFractionDigits: 0 });
                      return <td key={col} className="py-2.5 px-4 text-[0.75rem] font-bold text-[#6a12cd] whitespace-nowrap">{fmt}</td>;
                    })}
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#e5e7eb] shrink-0 text-[0.6875rem] text-[#9ca3af]">
          <span>Showing 1–{rowCount} of {rowCount}</span>
          {aggregation && <span className="text-[#6a12cd] font-medium">Aggregation: {aggregation.charAt(0).toUpperCase() + aggregation.slice(1)}</span>}
        </div>
      </div>
    );
  }

  /* ── Line chart — "Detection Accuracy Goals" style ───────────────────── */
  if (t === "line") {
    const yGroup =
      TREND_DATA[yAxis] ?? TREND_DATA["Duplicate Count"];
    let rawData =
      yGroup[effectiveXAxis] ??
      yGroup[xAxis] ??
      yGroup["Month"] ??
      Object.values(yGroup)[0];
    // Only slice to H1 when this is the active drill card at level 0
    if (isActiveCard && isTimeBased && drillLevel === 0)
      rawData = rawData.slice(0, 6);
    // Apply aggregation transform
    if (aggregation && aggregation !== 'count_d') {
      rawData = rawData.map((d: any) => ({ ...d, actual: applyAgg(d.actual), target: applyAgg(d.target) }));
    }

    const allVals = rawData.flatMap((d) =>
      showTarget ? [d.actual, d.target] : [d.actual],
    );
    const minVal = Math.floor(Math.min(...allVals) * 0.97);
    const maxVal = Math.ceil(Math.max(...allVals) * 1.01);

    const yShortLine = (yAxisTitle || yAxis).replace(/\s*\(.*?\)/, "").trim();
    const legendPayload = [
      {
        value: `Actual ${yShortLine}`,
        type: "circle" as const,
        color: BASE_COLOR,
      },
      ...(showTarget
        ? [
            {
              value: `Target ${yShortLine}`,
              type: "circle" as const,
              color: GRAY,
            },
          ]
        : []),
    ];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rawData}
          margin={{ top: 12, right: 12, left: 12, bottom: 28 }}
          onClick={(payload: any) => {
            if (
              isClickableDrill &&
              payload?.activeLabel
            ) {
              drillIntoItem(payload.activeLabel);
            }
          }}
          style={{
            cursor: isClickableDrill ? "crosshair" : "default",
          }}
        >
          <defs>
            <linearGradient
              id={`lgLine-${BASE_COLOR.replace("#", "")}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={BASE_COLOR}
                stopOpacity={0.15}
              />
              <stop
                offset="95%"
                stopColor={BASE_COLOR}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{
              fontSize: 12,
              fill: "#6b7280",
              ...textStyle,
            }}
            axisLine={false}
            tickLine={false}
            tickMargin={6}
            label={{ value: xAxisTitle || xAxis, position: "insideBottom", offset: -14, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }}
          />
          <YAxis
            domain={(() => {
              const lo = yMin ? Number(yMin) : minVal;
              const hi = yMax ? Number(yMax) : maxVal;
              return invertRange ? [hi, lo] : [lo, hi];
            })()}
            tickFormatter={yFmt}
            tick={{
              fontSize: 12,
              fill: "#6b7280",
              ...textStyle,
            }}
            axisLine={false}
            tickLine={false}
            width={72}
            tickMargin={4}
            reversed={invertRange}
            label={{
              value: yAxisTitle || yAxis,
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: {
                fontSize: 12,
                fill: "#9ca3af",
                ...textStyle,
              },
            }}
          />
          <Tooltip content={<TrendTooltip yAxis={yAxis} />} />
          <Area
            type="monotone"
            dataKey="actual"
            name={`Actual ${yShortLine}`}
            stroke={seriesColors?.[`Actual ${yShortLine}`] || seriesColors?.["Actual Accuracy"] || BASE_COLOR}
            strokeWidth={2}
            fill={`url(#lgLine-${BASE_COLOR.replace("#", "")})`}
            dot={{ fill: seriesColors?.["Actual Accuracy"] || BASE_COLOR, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
          >
            {showLabels && (
              <LabelList
                dataKey="actual"
                position="top"
                formatter={yFmt}
                style={{
                  fontSize: 12,
                  fill: BASE_COLOR,
                  fontWeight: 600,
                  fontFamily,
                }}
              />
            )}
          </Area>
          {showTarget && (
            <Line
              type="monotone"
              dataKey="target"
              name={`Target ${yShortLine}`}
              stroke={seriesColors?.[`Target ${yShortLine}`] || seriesColors?.["Target Accuracy"] || GRAY}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: seriesColors?.["Target Accuracy"] || GRAY, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            >
              {showLabels && (
                <LabelList
                  dataKey="target"
                  position="top"
                  formatter={yFmt}
                  style={{
                    fontSize: 12,
                    fill: GRAY,
                    fontWeight: 600,
                    fontFamily,
                  }}
                />
              )}
            </Line>
          )}
          {showLegend && <Legend
            iconType="circle"
            iconSize={8}
            layout={legendLayout as any}
            verticalAlign={legendVAlign as any}
            align={legendAlign as any}
            wrapperStyle={legendStyle}
            payload={legendPayload}
          />}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* ── Area chart ───────────────────────────────────────────────────────── */
  if (t === "area") {
    const yGroup =
      TREND_DATA[yAxis] ?? TREND_DATA["Duplicate Count"];
    let rawData =
      yGroup[effectiveXAxis] ??
      yGroup[xAxis] ??
      yGroup["Month"] ??
      Object.values(yGroup)[0];
    // Only slice to H1 when this is the active drill card at level 0
    if (isActiveCard && isTimeBased && drillLevel === 0)
      rawData = rawData.slice(0, 6);
    if (aggregation && aggregation !== 'count_d') {
      rawData = rawData.map((d: any) => ({ ...d, actual: applyAgg(d.actual), target: applyAgg(d.target) }));
    }

    const allVals = rawData.flatMap((d) =>
      showTarget ? [d.actual, d.target] : [d.actual],
    );
    const minVal = Math.floor(Math.min(...allVals) * 0.97);
    const maxVal = Math.ceil(Math.max(...allVals) * 1.01);

    const yShort = yAxis.replace(/\s*\(.*?\)/, "").trim();

    const legendPayload = [
      {
        value: `Actual ${yShort}`,
        type: "circle" as const,
        color: BASE_COLOR,
      },
      ...(showTarget
        ? [
            {
              value: `Target ${yShort}`,
              type: "circle" as const,
              color: GRAY,
            },
          ]
        : []),
    ];

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rawData}
          margin={{ top: 12, right: 12, left: 12, bottom: 28 }}
          onClick={(payload: any) => {
            if (isClickableDrill && payload?.activeLabel) {
              drillIntoItem(payload.activeLabel);
            }
          }}
          style={{ cursor: isClickableDrill ? "crosshair" : "default" }}
        >
          <defs>
            <linearGradient id={`lgArea-${BASE_COLOR.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BASE_COLOR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={BASE_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280", ...textStyle }} axisLine={false} tickLine={false} tickMargin={6} label={{ value: xAxisTitle || xAxis, position: "insideBottom", offset: -14, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }} />
          <YAxis domain={(() => { const lo = yMin ? Number(yMin) : minVal; const hi = yMax ? Number(yMax) : maxVal; return invertRange ? [hi, lo] : [lo, hi]; })()} tickFormatter={yFmt} tick={{ fontSize: 12, fill: "#6b7280", ...textStyle }} axisLine={false} tickLine={false} width={50} tickMargin={4} reversed={invertRange} label={{ value: yAxisTitle || yAxis, angle: -90, position: "insideLeft", offset: 4, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }} />
          <Tooltip content={<TrendTooltip yAxis={yAxis} />} />
          <Area
            type="monotone"
            dataKey="actual"
            name={`Actual ${yShort}`}
            stroke={BASE_COLOR}
            strokeWidth={2}
            fill={`url(#lgArea-${BASE_COLOR.replace("#", "")})`}
            dot={false}
            activeDot={{
              r: 5,
              fill: BASE_COLOR,
              stroke: "#fff",
              strokeWidth: 2,
            }}
          >
            {showLabels && (
              <LabelList
                dataKey="actual"
                position="top"
                formatter={yFmt}
                style={{
                  fontSize: 12,
                  fill: BASE_COLOR,
                  fontWeight: 600,
                  fontFamily,
                }}
              />
            )}
          </Area>
          {showTarget && (
            <Line
              type="monotone"
              dataKey="target"
              name={`Target ${yShort}`}
              stroke={GRAY}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
            >
              {showLabels && (
                <LabelList
                  dataKey="target"
                  position="top"
                  formatter={yFmt}
                  style={{
                    fontSize: 12,
                    fill: GRAY,
                    fontWeight: 600,
                    fontFamily,
                  }}
                />
              )}
            </Line>
          )}
          {showLegend && <Legend iconType="circle" iconSize={8} layout={legendLayout as any} verticalAlign={legendVAlign as any} align={legendAlign as any} wrapperStyle={legendStyle} payload={legendPayload} />}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  /* ── Combo: Bar + Line chart ─────────────────────────────────────────── */
  if (t === "combo") {
    const data = barData ?? BAR_DATA[xAxis] ?? BAR_DATA["Month"];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280", ...textStyle }} axisLine={false} tickLine={false} tickMargin={6} label={{ value: xAxisTitle || xAxis, position: "insideBottom", offset: -14, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }} />
          <YAxis domain={(() => { if (!yMin && !yMax) return undefined; const lo = yMin ? Number(yMin) : 0; const hi = yMax ? Number(yMax) : 'auto'; return invertRange ? [hi, lo] : [lo, hi]; })()} tick={{ fontSize: 12, fill: "#6b7280", ...textStyle }} axisLine={false} tickLine={false} width={50} tickMargin={4} reversed={invertRange} label={{ value: yAxisTitle || "Count", angle: -90, position: "insideLeft", offset: 4, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }} />
          <Tooltip content={<BarTooltip />} cursor={false} />
          {showLegend && <Legend iconType="circle" layout={legendLayout as any} verticalAlign={legendVAlign as any} align={legendAlign as any} wrapperStyle={legendStyle} />}
          <Bar dataKey="duplicates" name="Total Duplicates" fill={seriesColors?.["Total Duplicates"] || BASE_COLOR} radius={[4, 4, 0, 0]} />
          <Bar dataKey="resolved" name="Resolved" fill={seriesColors?.["Resolved"] || BASE_LIGHT1} radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="pending" name="Pending" stroke={seriesColors?.["Pending"] || AMBER} strokeWidth={2.5} dot={{ fill: seriesColors?.["Pending"] || AMBER, r: 4, strokeWidth: 0 }} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  /* ── Bar chart ────────────────────────────────────────────────────────── */
  if (t === "bar") {
    const rawBarData =
      barData ?? BAR_DATA[xAxis] ?? BAR_DATA["Month"];
    const data = aggregation && aggregation !== 'sum' ? rawBarData.map(d => ({ ...d, duplicates: applyAgg(d.duplicates), resolved: applyAgg(d.resolved), pending: applyAgg(d.pending) })) : rawBarData;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 12, left: 12, bottom: 28 }}
          barCategoryGap={barSpacing ? `${barSpacing}%` : undefined}
          onClick={(payload) => {
            if (
              isClickableDrill &&
              isTimeBased &&
              payload?.activeLabel
            ) {
              drillIntoItem(payload.activeLabel);
            }
          }}
          style={{
            cursor:
              isClickableDrill && isTimeBased
                ? "crosshair"
                : "default",
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280", ...textStyle }} axisLine={false} tickLine={false} tickMargin={6} label={{ value: xAxisTitle || xAxis, position: "insideBottom", offset: -14, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }} />
          <YAxis domain={(() => { if (!yMin && !yMax) return undefined; const lo = yMin ? Number(yMin) : 0; const hi = yMax ? Number(yMax) : 'auto'; return invertRange ? [hi, lo] : [lo, hi]; })()} tick={{ fontSize: 12, fill: "#6b7280", ...textStyle }} axisLine={false} tickLine={false} width={50} tickMargin={4} reversed={invertRange} label={{ value: yAxisTitle || "Count", angle: -90, position: "insideLeft", offset: 4, style: { fontSize: 12, fill: "#9ca3af", ...textStyle } }} />
          <Tooltip content={<BarTooltip />} cursor={false} />
          <Bar
            dataKey="duplicates"
            name={yAxisTitle || yAxis || "Total Duplicates"}
            fill={seriesColors?.[yAxisTitle || yAxis || "Total Duplicates"] || seriesColors?.["Total Duplicates"] || BASE_COLOR}
            radius={[4, 4, 0, 0]}
          >
            {conditionalRules && conditionalRules.length > 0 && conditionalRules[0]?.value && data.map((entry: any, idx: number) => (
              <Cell key={idx} fill={getConditionalColor(entry.duplicates, seriesColors?.[yAxisTitle || yAxis || "Total Duplicates"] || seriesColors?.["Total Duplicates"] || BASE_COLOR)} />
            ))}
            {showLabels && (
              <LabelList
                dataKey="duplicates"
                position="top"
                style={{
                  fontSize: 12,
                  fill: BASE_COLOR,
                  fontWeight: 600,
                  fontFamily,
                }}
              />
            )}
          </Bar>
          {showTarget && (
            <Bar
              dataKey="resolved"
              name="Resolved"
              fill={seriesColors?.["Resolved"] || BASE_LIGHT1}
              radius={[4, 4, 0, 0]}
            >
              {showLabels && (
                <LabelList
                  dataKey="resolved"
                  position="top"
                  style={{
                    fontSize: 12,
                    fill: BASE_LIGHT1,
                    fontWeight: 600,
                    fontFamily,
                  }}
                />
              )}
            </Bar>
          )}
          {showTarget && (
            <Bar
              dataKey="pending"
              name="Pending"
              fill={seriesColors?.["Pending"] || BASE_LIGHT2}
              radius={[4, 4, 0, 0]}
            >
              {showLabels && (
                <LabelList
                  dataKey="pending"
                  position="top"
                  style={{
                    fontSize: 12,
                    fill: BASE_LIGHT2,
                    fontWeight: 600,
                    fontFamily,
                  }}
                />
              )}
            </Bar>
          )}
          {showLegend && <Legend iconType="circle" iconSize={8} layout={legendLayout as any} verticalAlign={legendVAlign as any} align={legendAlign as any} wrapperStyle={legendStyle} />}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  /* ── Pie chart — DuplicateDistributionChart style ────────────────────── */
  if (t === "pie") {
    const rawPie = PIE_DATA[xAxis] ?? PIE_DATA["Status"];

    const renderLabel = ({
      cx,
      cy,
      midAngle,
      innerRadius,
      outerRadius,
      percent,
    }: any) => {
      const R = Math.PI / 180;
      const r = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + r * Math.cos(-midAngle * R);
      const y = cy + r * Math.sin(-midAngle * R);
      if (percent * 100 < 8) return null;
      return (
        <text
          x={x}
          y={y}
          fill="white"
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily,
          }}
        >
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      );
    };

    const sliceColors = rawPie.map((entry: any, idx: number) =>
      seriesColors?.[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]
    );

    const renderLegend = ({ payload }: any) => (
      <div className="flex flex-nowrap gap-3 justify-center mt-2 overflow-x-auto whitespace-nowrap px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {payload.map((e: any, i: number) => {
          const entryColor = sliceColors[i] || e.color;
          const entryName = e.value;
          return (
            <div key={i} className="relative flex items-center gap-1.5">
              <button
                onClick={(ev) => { ev.stopPropagation(); setLegendPickerOpen(legendPickerOpen === entryName ? null : entryName); }}
                className="size-3 rounded-full shrink-0 cursor-pointer ring-1 ring-black/10 hover:ring-2 hover:ring-purple-400 transition-all"
                style={{ backgroundColor: entryColor }}
                title="Click to change color"
              />
              <span className="text-[0.6875rem] text-gray-600">{entryName}</span>
              {legendPickerOpen === entryName && onSeriesColorChange && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={(ev) => { ev.stopPropagation(); setLegendPickerOpen(null); }} />
                  <div className="absolute left-0 bottom-full mb-1.5 z-[70] bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5 flex flex-wrap gap-1.5 w-[148px]">
                    {EDITABLE_PALETTE.map(c => (
                      <button
                        key={c}
                        onClick={(ev) => { ev.stopPropagation(); onSeriesColorChange(entryName, c); setLegendPickerOpen(null); }}
                        className={`size-5 rounded-full cursor-pointer transition-all ${entryColor === c ? 'ring-2 ring-purple-600 ring-offset-1 scale-110' : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1 hover:scale-110'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 12, right: 12, left: 12, bottom: 28 }}>
          {(() => {
            const total = rawPie.reduce((a: number, d: any) => a + d.value, 0);
            let cumAngle = 0;
            const sliceMidAngles = rawPie.map((d: any) => {
              const sliceAngle = (d.value / total) * 360;
              const mid = cumAngle + sliceAngle / 2;
              cumAngle += sliceAngle;
              return mid;
            });

            // Check if any slice has a non-zero distance
            const hasExplode = pieSpacingMap && Object.values(pieSpacingMap).some(v => Number(v) > 0);

            if (hasExplode) {
              return rawPie.map((entry: any, i: number) => {
                const sliceDistance = pieSpacingMap?.[entry.name] ? Number(pieSpacingMap[entry.name]) * 0.15 : 0;
                const midRad = (sliceMidAngles[i] - 90) * (Math.PI / 180);
                const offsetX = Math.cos(midRad) * sliceDistance;
                const offsetY = Math.sin(midRad) * sliceDistance;
                let startAngle = 90;
                for (let j = 0; j < i; j++) {
                  startAngle -= (rawPie[j].value / total) * 360;
                }
                const endAngle = startAngle - (entry.value / total) * 360;

                return (
                  <Pie
                    key={i}
                    data={[entry]}
                    cx={`${50 + offsetX}%`}
                    cy={`${45 + offsetY}%`}
                    outerRadius={pieOuterRadius}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    labelLine={false}
                    dataKey="value"
                    onClick={() => {
                      if (isClickableDrill && entry.name) {
                        drillIntoItem(entry.name);
                      } else if (entry.name && onSeriesColorChange) {
                        setLegendPickerOpen(legendPickerOpen === entry.name ? null : entry.name);
                      }
                    }}
                    style={{ cursor: isClickableDrill ? "crosshair" : onSeriesColorChange ? "pointer" : "default" }}
                    isAnimationActive={false}
                  >
                    <Cell fill={sliceColors[i]} />
                  </Pie>
                );
              });
            }

            return (
              <Pie
                data={rawPie}
                cx="50%"
                cy="45%"
                outerRadius={pieOuterRadius}
                labelLine={false}
                label={showLabels ? renderLabel : false}
                dataKey="value"
                onClick={(entry: any) => {
                  if (isClickableDrill && entry?.name) {
                    drillIntoItem(entry.name);
                  } else if (entry?.name && onSeriesColorChange) {
                    setLegendPickerOpen(legendPickerOpen === entry.name ? null : entry.name);
                  }
                }}
                style={{ cursor: isClickableDrill ? "crosshair" : onSeriesColorChange ? "pointer" : "default" }}
              >
                {rawPie.map((_: any, i: number) => (
                  <Cell key={i} fill={sliceColors[i]} />
                ))}
              </Pie>
            );
          })()}
          <Tooltip content={<PieTooltip />} />
          {showLegend && <Legend
            content={(props: any) => {
              const { payload } = props;
              const isVert = legendPosProp === 'left' || legendPosProp === 'right';
              return (
                <div className={`flex ${isVert ? 'flex-col gap-1.5' : 'flex-wrap gap-3 justify-center'} mt-2`} style={legendStyle}>
                  {payload?.map((e: any, i: number) => {
                    const entryColor = sliceColors[i] || e.color;
                    const entryName = e.value;
                    return (
                      <div key={i} className="relative flex items-center gap-1.5">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setLegendPickerOpen(legendPickerOpen === entryName ? null : entryName); }}
                          className="size-3 rounded-full shrink-0 cursor-pointer ring-1 ring-black/10 hover:ring-2 hover:ring-purple-400 transition-all"
                          style={{ backgroundColor: entryColor }}
                          title="Click to change color"
                        />
                        <span className="text-[0.6875rem] text-gray-600" style={legendStyle}>{entryName}</span>
                        {legendPickerOpen === entryName && onSeriesColorChange && (
                          <>
                            <div className="fixed inset-0 z-[60]" onClick={(ev) => { ev.stopPropagation(); setLegendPickerOpen(null); }} />
                            <div className="absolute left-0 bottom-full mb-1.5 z-[70] bg-white border border-gray-200 rounded-xl shadow-2xl p-2.5 flex flex-wrap gap-1.5 w-[148px]">
                              {EDITABLE_PALETTE.map(c => (
                                <button
                                  key={c}
                                  onClick={(ev) => { ev.stopPropagation(); onSeriesColorChange(entryName, c); setLegendPickerOpen(null); }}
                                  className={`size-5 rounded-full cursor-pointer transition-all ${entryColor === c ? 'ring-2 ring-purple-600 ring-offset-1 scale-110' : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1 hover:scale-110'}`}
                                  style={{ background: c }}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
            layout={legendLayout as any}
            verticalAlign={legendVAlign as any}
            align={legendAlign as any}
          />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Empty state — unknown chart type or no data
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center max-w-[240px]">
        <div className="mx-auto mb-3 size-16 rounded-2xl bg-gray-50 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 15l4-4 4 4 4-6 6 6" />
          </svg>
        </div>
        <p className="text-[0.8125rem] font-medium text-gray-500 mb-1">No Data to Display</p>
        <p className="text-[0.6875rem] text-gray-400 leading-relaxed">Configure data fields to generate this chart.</p>
      </div>
    </div>
  );
}