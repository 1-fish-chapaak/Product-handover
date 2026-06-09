/**
 * AddCardModal — Figma-matched widget configurator.
 * Two-column layout with left sidebar and main configuration area.
 */

import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "./ui-dialog";
import {
  Search, Hash, LineChart as LineChartIcon, BarChart3,
  PieChart as PieChartIcon, Table as TableIcon, TrendingUp,
  LayoutGrid, ChevronDown, Calendar, MapPin, Tag, Layers,
  Briefcase, Package, IndianRupee, Percent, ScanLine,
  Copy, AlertTriangle, Target, Clock, X, GripVertical,
  ArrowRight, Check, Plus, Palette, FileSpreadsheet,
  ArrowRightLeft, MoveVertical, Database, Settings,
  Sliders, Grid3x3, ChevronRight, Bold, Italic, Underline,
  ChevronUp, Lightbulb, Edit, Code2, Info,
} from "lucide-react";
import { createPortal } from "react-dom";
import { ConfigurableChart, PIE_DATA } from "./ConfigurableChart";
// ─── Multi-table (model) widget building — merged into Add Widget ───
import MultiTableFieldPicker from "../model/MultiTableFieldPicker";
import ModelChart from "../model/ModelChart";
import { buildWidgetRows } from "../model/joinEngine";
import type { ModelTable, Relationship, WidgetModelConfig, WidgetModelField } from "../model/relationshipTypes";
import { FileTreeView, type FileTreeFile } from "./FileTreeView";
import { ColorPicker } from "./ColorPicker";
import { WhiteDropdown } from "./WhiteDropdown";
import { DB_SCHEMAS, INTEGRATION_CONFIGS } from "../../data-sources/datasetFiles";
import TypographySection from "./imports/TypographySection-1760-98";
import RangeYAxisSection from "./imports/RangeYAxisSection";
import ConditionalFormattingSection from "./imports/ConditionalFormattingSection";
import DataSeriesFormattingSection from "./imports/DataSeriesFormattingSection";
import LegendSection from "./imports/LegendSection";
import svgPaths from "./imports/svg-82m27spks2";
import svgPathsDropdown from "./imports/svg-fj9unhx75t";
import svgPathsFile from "./imports/svg-gttg7afvux";
import svgPathsDrag from "./imports/svg-zf1s2powk2";
import svgPathsQuery from "./imports/Icon/svg-0j4oy4u450";

/* ─── Aggregation options ────────────────────────────────────────────────── */
const AGGREGATION_OPTIONS = [
  { value: "",         label: "",                 symbol: "—"  },
  { value: "sum",      label: "Sum",             symbol: "Σ"  },
  { value: "average",  label: "Average",          symbol: "x̄"  },
  { value: "minimum",  label: "Min",              symbol: "↓"  },
  { value: "maximum",  label: "Max",              symbol: "↑"  },
  { value: "count_d",  label: "Count Distinct",   symbol: "#"  },
  { value: "count",    label: "Count",            symbol: "n"  },
  { value: "stddev",   label: "Std Dev",          symbol: "σ"  },
  { value: "variance", label: "Variance",         symbol: "σ²" },
  { value: "median",   label: "Median",           symbol: "M"  },
];

const MAX_FIELDS = 3;

/* ─── Temporal options for Date field ──────────────��──��─────────────────���─── */
const TEMPORAL_OPTIONS = [
  { value: "year", label: "Year" },
  { value: "quarterly", label: "Quarterly" },
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
];

/* ─── Data field catalog ──────────────────────────────────────────────────── */
type FieldKind = "dimension" | "measure";

interface DataField {
  id: string;
  label: string;
  kind: FieldKind;
  group: string;
  Icon: React.ElementType;
  color: string;
  axisValue: string;
}

const FIELDS: DataField[] = [
  { id: "date",        label: "Date",                kind: "dimension", group: "Time",        Icon: Calendar,      color: "#6a12cd", axisValue: "Date" },
  { id: "month",       label: "Month",               kind: "dimension", group: "Time",        Icon: Calendar,      color: "#6a12cd", axisValue: "Month" },
  { id: "week",        label: "Week",                kind: "dimension", group: "Time",        Icon: Calendar,      color: "#6a12cd", axisValue: "Week" },
  { id: "year",        label: "Year",                kind: "dimension", group: "Time",        Icon: Calendar,      color: "#6a12cd", axisValue: "Year" },
  { id: "region",      label: "Region",              kind: "dimension", group: "Geography",   Icon: MapPin,        color: "#0ea5e9", axisValue: "Region" },
  { id: "state",       label: "State",               kind: "dimension", group: "Geography",   Icon: MapPin,        color: "#0ea5e9", axisValue: "Region" },
  { id: "vendor",      label: "Vendor Name",         kind: "dimension", group: "Entity",      Icon: Briefcase,     color: "#f59e0b", axisValue: "Vendor Name" },
  { id: "status",      label: "Status",              kind: "dimension", group: "Entity",      Icon: Tag,           color: "#10b981", axisValue: "Status" },
  { id: "category",    label: "Categories",          kind: "dimension", group: "Entity",      Icon: Layers,        color: "#8b5cf6", axisValue: "Category" },
  { id: "subcategory", label: "Sub Category",        kind: "dimension", group: "Entity",      Icon: Layers,        color: "#8b5cf6", axisValue: "Category" },
  { id: "department",  label: "Department",          kind: "dimension", group: "Entity",      Icon: Briefcase,     color: "#f59e0b", axisValue: "Department" },
  { id: "product",     label: "Products",            kind: "dimension", group: "Entity",      Icon: Package,       color: "#ec4899", axisValue: "Vendor Name" },
  { id: "services",    label: "Services",            kind: "dimension", group: "Entity",      Icon: Package,       color: "#ec4899", axisValue: "Vendor Name" },
  { id: "solutions",   label: "Solutions",           kind: "dimension", group: "Entity",      Icon: Package,       color: "#ec4899", axisValue: "Vendor Name" },
  { id: "inv_amount",  label: "Invoice Amount (₹)",  kind: "measure",   group: "Financial",   Icon: IndianRupee,   color: "#6a12cd", axisValue: "Invoice Amount (₹)" },
  { id: "risk_amt",    label: "Amount at Risk (₹)",  kind: "measure",   group: "Financial",   Icon: AlertTriangle, color: "#ef4444", axisValue: "Invoice Amount (₹)" },
  { id: "dup_count",   label: "Duplicate Count",     kind: "measure",   group: "Performance", Icon: Copy,          color: "#f59e0b", axisValue: "Duplicate Count" },
  { id: "dup_score",   label: "Duplicate Score (%)", kind: "measure",   group: "Performance", Icon: Percent,       color: "#10b981", axisValue: "Duplicate Score (%)"},
  { id: "inv_scanned", label: "Invoices Scanned",    kind: "measure",   group: "Performance", Icon: ScanLine,      color: "#0ea5e9", axisValue: "Duplicate Count" },
  { id: "dup_found",   label: "Duplicates Found",    kind: "measure",   group: "Performance", Icon: Copy,          color: "#ef4444", axisValue: "Duplicate Count" },
  { id: "accuracy",    label: "Detection Accuracy (%)", kind: "measure", group: "Performance", Icon: Target,       color: "#10b981", axisValue: "Duplicate Score (%)"},
  { id: "proc_time",   label: "Processing Time (d)", kind: "measure",   group: "Performance", Icon: Clock,         color: "#6b7280", axisValue: "Duplicate Score (%)"},
];

const DIMENSION_GROUPS = ["Time", "Geography", "Entity"];
const MEASURE_GROUPS   = ["Financial", "Performance"];

/* ─── Reverse-map stored axis labels → FIELDS entry IDs ─────────────────── */
const AXIS_LABEL_TO_FIELD_ID: Record<string, string> = {
  "Month":               "month",
  "Week":                "week",
  "Year":                "year",
  "State / City":        "state",
  "Region":              "region",
  "Vendor Name":         "vendor",
  "Status":              "status",
  "Category":            "category",
  "Categories":          "category",
  "Sub Category":        "subcategory",
  "Department":          "department",
  "Product Name":        "product",
  "Products":            "product",
  "Services":            "services",
  "Solutions":           "solutions",
  "Invoice Amount (₹)":  "inv_amount",
  "Amount at Risk (₹)":  "risk_amt",
  "Duplicate Count":     "dup_count",
  "Invoice Count":       "inv_scanned",
  "Duplicates Found":    "dup_found",
  "Accuracy %":          "accuracy",
  "Amount (₹)":          "inv_amount",
};

/** Maps a stored widget axis label back to the best FIELDS entry id. */
function resolveFieldId(label: string): string {
  if (!label) return label;
  if (AXIS_LABEL_TO_FIELD_ID[label]) return AXIS_LABEL_TO_FIELD_ID[label];
  const byLabel = FIELDS.find(f => f.label === label);
  if (byLabel) return byLabel.id;
  const byAxis  = FIELDS.find(f => f.axisValue === label);
  if (byAxis)  return byAxis.id;
  return label;
}

/* ─── Widget catalogue ────────────────────────────────────────────────────── */
interface WidgetDef {
  id: string;
  title: string;
  Icon: React.ElementType;
  cardType: string;
  builderType: "kpi" | "line" | "area" | "bar" | "pie" | "table" | "scatter" | "matrix" | "doughnut" | "grid";
  defaultX: string;
  defaultY: string;
  useFieldBuilder: boolean;
  /** Dimension slot labels — defines which drop zones to show per chart type */
  dimensions: Array<{ key: string; label: string }>;
}

const WIDGETS: WidgetDef[] = [
  // 1. KPI — top priority, most used for dashboards
  { id: "kpi",              title: "KPI Cards",                      Icon: Hash,          cardType: "KPI",        builderType: "kpi",      defaultX: "Month",       defaultY: "Invoices Scanned",    useFieldBuilder: true,  dimensions: [{ key: "yAxis", label: "Value" }, { key: "xAxis", label: "Trend Axis" }] },
  // 2. Bar charts — most common data comparison
  { id: "clustered-column", title: "Clustered Column Chart",         Icon: BarChart3,     cardType: "Bar Chart",  builderType: "bar",      defaultX: "Month",  defaultY: "Duplicate Count",     useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Y-axis" }, { key: "secondaryY", label: "Y-axis Index" }, { key: "legend", label: "Legend" }] },
  { id: "stacked-column",   title: "Stacked Column Chart",           Icon: BarChart3,     cardType: "Bar Chart",  builderType: "bar",      defaultX: "Month",  defaultY: "Duplicate Count",     useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Y-axis" }, { key: "secondaryY", label: "Y-axis Index" }, { key: "legend", label: "Legend" }] },
  { id: "clustered-bar",    title: "Clustered Bar Chart",            Icon: BarChart3,     cardType: "Bar Chart",  builderType: "bar",      defaultX: "Month",  defaultY: "Duplicate Count",     useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Y-axis" }, { key: "secondaryY", label: "Y-axis Index" }, { key: "legend", label: "Legend" }] },
  { id: "stacked-bar",      title: "Stacked Bar Chart",              Icon: BarChart3,     cardType: "Bar Chart",  builderType: "bar",      defaultX: "Month",  defaultY: "Duplicate Count",     useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Y-axis" }, { key: "secondaryY", label: "Y-axis Index" }, { key: "legend", label: "Legend" }] },
  // 3. Line chart — trend analysis
  { id: "line",             title: "Line Chart",                     Icon: LineChartIcon, cardType: "Line Chart", builderType: "line",     defaultX: "Month",  defaultY: "Duplicate Score (%)", useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Y-axis" }, { key: "secondaryY", label: "Y-axis Index" }, { key: "legend", label: "Legend" }] },
  // 4. Area chart — volume over time
  { id: "area",             title: "Area Chart",                     Icon: TrendingUp,    cardType: "Area Chart", builderType: "area",     defaultX: "Month",  defaultY: "Duplicate Score (%)", useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Y-axis" }, { key: "secondaryY", label: "Y-axis Index" }, { key: "legend", label: "Legend" }] },
  // 5. Pie chart — distribution
  { id: "pie",              title: "Pie Chart",                      Icon: PieChartIcon,  cardType: "Pie Chart",  builderType: "pie",      defaultX: "Status", defaultY: "Duplicate Count",     useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "Legend" }, { key: "yAxis", label: "Values" }] },
  // 6. Combo charts — advanced comparison
  { id: "line-clustered",   title: "Line & Clustered Column Chart",  Icon: LineChartIcon, cardType: "Line Chart", builderType: "line",     defaultX: "Month",  defaultY: "Duplicate Score (%)", useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Column Y-axis" }, { key: "secondaryY", label: "Line Y-axis" }, { key: "legend", label: "Legend" }] },
  { id: "line-stacked",     title: "Line & Stacked Column Chart",    Icon: LineChartIcon, cardType: "Line Chart", builderType: "line",     defaultX: "Month",  defaultY: "Duplicate Score (%)", useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "X-axis" }, { key: "yAxis", label: "Column Y-axis" }, { key: "secondaryY", label: "Line Y-axis" }, { key: "legend", label: "Legend" }] },
  // 7. Specialized charts
  { id: "waterfall",        title: "Waterfall Chart",                Icon: TrendingUp,    cardType: "Area Chart", builderType: "area",     defaultX: "Week",   defaultY: "Invoice Amount (₹)",  useFieldBuilder: true,  dimensions: [{ key: "xAxis", label: "Category" }, { key: "legend", label: "Breakdown" }, { key: "yAxis", label: "Y-axis" }] },
  { id: "scatter",          title: "Scatter Chart",                  Icon: TrendingUp,    cardType: "Area Chart", builderType: "scatter",  defaultX: "Week",   defaultY: "Invoice Amount (₹)",  useFieldBuilder: true,  dimensions: [{ key: "yAxis", label: "Values" }, { key: "xAxis", label: "X-axis" }, { key: "legend", label: "Legend" }, { key: "size", label: "Size" }] },
  // 8. Table — always last
  { id: "table",            title: "Table",                          Icon: TableIcon,     cardType: "Table",      builderType: "table",    defaultX: "",       defaultY: "",                    useFieldBuilder: false, dimensions: [{ key: "xAxis", label: "Columns" }] },
];

/* ─── Aggregation portal dropdown ─────────────────────────────────────────── */
function AggDropdown({ value, onChange, fieldId }: { value: string; onChange: (v: string) => void; fieldId?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  
  // Check if this is the Date field
  const isDateField = fieldId === "date";
  
  // For Date field, value stores selected temporal options as comma-separated string
  const selectedTemporalOptions = isDateField && value ? value.split(",") : [];
  
  const current = AGGREGATION_OPTIONS.find(a => a.value === value) || AGGREGATION_OPTIONS[0];

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const dropH = Math.min(300, isDateField ? (TEMPORAL_OPTIONS.length * 32 + 40) : (AGGREGATION_OPTIONS.length * 32 + 40));
      const below = window.innerHeight - r.bottom > dropH;
      setPos({ top: below ? r.bottom + 2 : r.top - dropH - 2, left: Math.min(r.left, window.innerWidth - 180) });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleTemporalToggle = (optValue: string) => {
    const current = value ? value.split(",") : [];
    const updated = current.includes(optValue)
      ? current.filter(v => v !== optValue)
      : [...current, optValue];
    onChange(updated.join(","));
  };

  const getDateDisplayLabel = () => {
    if (!value) return "Select";
    const selected = value.split(",").filter(Boolean);
    if (selected.length === TEMPORAL_OPTIONS.length) return "All";
    if (selected.length === 1) {
      const opt = TEMPORAL_OPTIONS.find(o => o.value === selected[0]);
      return opt?.label || selected[0];
    }
    return `${selected.length} selected`;
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        onMouseDown={e => e.stopPropagation()}
        className="flex items-center gap-1 px-[9px] py-px rounded-[5px] bg-white hover:bg-white/90 border border-white/80 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] transition-all shrink-0"
        title={isDateField ? "Select date granularity" : "Change aggregation"}
      >
        {isDateField ? (
          <>
            <span className="text-[0.625rem] text-[#26064a]/70">{getDateDisplayLabel()}</span>
            <ChevronDown className="size-[9px] text-[#6a12cd]" strokeWidth="0.75" />
          </>
        ) : (
          <>
            {value && <span className="text-[0.6875rem] font-bold text-[#6a12cd]">{current.symbol}</span>}
            {value && current.label && <span className="text-[0.625rem] text-[#26064a]/70">{current.label}</span>}
            <ChevronDown className="size-[9px] text-[#6a12cd]" strokeWidth="0.75" />
          </>
        )}
      </button>
      {open && createPortal(
        <div
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 170, zIndex: 99999, maxHeight: '300px' }}
          className="bg-white rounded-[8px] border border-[#e5e7eb] shadow-2xl py-1 overflow-y-auto"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
        >
          {isDateField ? (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.8px] text-[#9ca3af]">Date Granularity</p>
              {TEMPORAL_OPTIONS.map(opt => {
                const selected = value ? value.split(",") : [];
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleTemporalToggle(opt.value); }}
                    className={`w-full flex items-center gap-2 px-3 py-[6px] text-left transition-colors hover:bg-[#f5f0ff] ${isSelected ? "bg-[#faf5ff]" : ""}`}
                  >
                    <div className={`w-[14px] h-[14px] rounded-[3px] border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-[#6a12cd] bg-[#6a12cd]" : "border-[#d1d5db] bg-white"}`}>
                      {isSelected && <Check className="size-[10px] text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-[0.75rem] ${isSelected ? "text-[#6a12cd] font-medium" : "text-[#374151]"}`}>{opt.label}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <p className="px-3 pt-1.5 pb-1 text-[0.5625rem] font-semibold uppercase tracking-[0.8px] text-[#9ca3af]">Aggregation</p>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(""); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-[6px] text-left transition-colors hover:bg-[#f5f0ff] ${!value ? "bg-[#faf5ff] text-[#6a12cd]" : "text-[#374151]"}`}
              >
                <span className="w-[18px] text-center text-[0.6875rem] font-bold shrink-0" style={{ color: !value ? "#6a12cd" : "#9ca3af" }}>—</span>
                <span className="text-[0.75rem]">None</span>
                {!value && <Check className="size-[10px] ml-auto text-[#6a12cd]" />}
              </button>
              {AGGREGATION_OPTIONS.filter(opt => opt.value !== "").map(opt => (
                <button
                  key={opt.value}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(opt.value); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-[6px] text-left transition-colors hover:bg-[#f5f0ff] ${opt.value === value ? "bg-[#faf5ff] text-[#6a12cd]" : "text-[#374151]"}`}
                >
                  <span className="w-[18px] text-center text-[0.6875rem] font-bold shrink-0" style={{ color: opt.value === value ? "#6a12cd" : "#9ca3af" }}>{opt.symbol}</span>
                  <span className="text-[0.75rem]">{opt.label}</span>
                  {opt.value === value && <Check className="size-[10px] ml-auto text-[#6a12cd]" />}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/* ─── Props ─────────────────────────────────────────────────────────────────── */
export interface AddCardDashboardSource {
  type: 'excel' | 'csv' | 'sql' | 'query' | 'combo';
  /** SEED id of the picked source — required for live-SQL dashboards. */
  sourceId?: string;
  /** Display name (file name or DB name). */
  sourceName?: string;
}

interface AddCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCard: (cardType: string, config?: { xAxis: string; yAxis: string; color: string; name?: string; description?: string; seriesColors?: Record<string, string>; fontFamily?: string; model?: WidgetModelConfig }) => void;
  /** Related tables → when present (and not a SQL dashboard), the Data Source
   *  tab becomes the multi-table model builder. */
  modelTables?: ModelTable[];
  relationships?: Relationship[];
  /** Pre-fills the model builder when editing a combined widget. */
  initialModel?: WidgetModelConfig;
  /** Opens the relationship manager (from the "needs connecting" prompt). */
  onConnectTables?: () => void;
  mode?: 'add' | 'edit';
  initialXAxis?: string;
  initialYAxis?: string;
  initialWidgetType?: string;
  initialColor?: string;
  initialFontFamily?: string;
  initialName?: string;
  initialSeriesColors?: Record<string, string>;
  onOpenExcelUpload?: () => void;
  onOpenQueryModal?: () => void;
  onOpenAddData?: () => void;
  /** Jumps to the Knowledge Hub view, optionally focused on the given source.
   *  Wired by the empty-state panel for unknown SQL sourceIds. */
  onOpenKnowledgeHub?: (sourceId?: string) => void;
  isCreateDashboardMode?: boolean;
  onNavigateToBuilder?: (data: { cardType: string; config: any }) => void;
  /** Source the parent dashboard is bound to. Drives the Data Source panel:
   * for 'sql' we render the DB schema tree from DB_SCHEMAS instead of the
   * canonical Excel demo files. */
  dashboardSource?: AddCardDashboardSource;
}

/* ─── Modal ─────────────────────────────────────────────────────────────────── */
export function AddCardModal({ open, onOpenChange, onSelectCard, mode = 'add', initialXAxis, initialYAxis, initialWidgetType, initialColor, initialFontFamily, initialName, initialSeriesColors, onOpenExcelUpload, onOpenQueryModal, onOpenAddData, onOpenKnowledgeHub, isCreateDashboardMode = false, onNavigateToBuilder, dashboardSource, modelTables, relationships = [], initialModel, onConnectTables }: AddCardModalProps) {
  const [activeTab, setActiveTab] = useState<"data" | "format">("data");
  const [selected, setSelected] = useState<WidgetDef | null>(null); // No default selection
  const [chartTypeOpen, setChartTypeOpen] = useState(true);
  const [chartTypeCollapsed, setChartTypeCollapsed] = useState(false);
  const [dataSearch, setDataSearch] = useState("");
  const [file1Open, setFile1Open] = useState(true);
  const [file2Open, setFile2Open] = useState(false);
  const [addDataOpen, setAddDataOpen] = useState(false);
  // The widget renders against the dashboard's bound source. Picking an
  // additional / different source happens via the Add Data button, which
  // opens the shared AddDataModal (same as dashboard creation).
  const widgetSource: AddCardDashboardSource | undefined = dashboardSource;
  
  // Widget name and description
  const [widgetName, setWidgetName] = useState("");
  const [widgetDescription, setWidgetDescription] = useState("");
  
  // Widget Info section collapsed state
  const [widgetInfoCollapsed, setWidgetInfoCollapsed] = useState(false);

  // ── Multi-table (model) widget state ──
  const [modelFields, setModelFields] = useState<WidgetModelField[]>(initialModel?.fields ?? []);
  const [modelType, setModelType] = useState<string>(initialWidgetType ?? 'Bar Chart');
  const [modelColor, setModelColor] = useState<string>(initialColor ?? '#6a12cd');
  useEffect(() => {
    if (!open) return;
    if (initialModel) {
      setModelFields(initialModel.fields);
      setModelType(initialWidgetType ?? 'Bar Chart');
      setModelColor(initialColor ?? '#6a12cd');
    } else if (mode === 'add') {
      setModelFields([]);
    }
  }, [open, initialModel, mode, initialWidgetType, initialColor]);

  // Chart type dropdown state
  const [chartDropdownOpen, setChartDropdownOpen] = useState(false);
  const chartDropdownBtnRef = useRef<HTMLButtonElement>(null);
  const [chartDropdownPos, setChartDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  
  const [xFieldIds, setXFieldIds] = useState<string[]>([]);
  const [yFieldIds, setYFieldIds] = useState<string[]>([]);
  const [yIndexFieldIds, setYIndexFieldIds] = useState<string[]>([]);
  const [legendFieldIds, setLegendFieldIds] = useState<string[]>([]);
  const [secondaryYFieldIds, setSecondaryYFieldIds] = useState<string[]>([]);
  const [sizeFieldIds, setSizeFieldIds] = useState<string[]>([]);
  const [timeFieldIds, setTimeFieldIds] = useState<string[]>([]);
  const [yAggs, setYAggs] = useState<Record<string, string>>({});
  const [chartColor, setChartColor] = useState("#6a12cd");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [seriesColors, setSeriesColors] = useState<Record<string, string>>({});
  const [barSpacing, setBarSpacing] = useState("0");
  const [spacingMap, setSpacingMap] = useState<Record<string, string>>({});

  // Format options state
  const [generalThemeOpen, setGeneralThemeOpen] = useState(true);
  const [selectedBaseColor, setSelectedBaseColor] = useState("#6a12cd");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [selectedTextFormat, setSelectedTextFormat] = useState("");
  
  // X axis format section state
  const [xAxisFormatOpen, setXAxisFormatOpen] = useState(false);
  const [xAxisTitle, setXAxisTitle] = useState("");
  const [xAxisBold, setXAxisBold] = useState(false);
  const [xAxisItalic, setXAxisItalic] = useState(false);
  const [xAxisUnderline, setXAxisUnderline] = useState(false);

  // Y axis format section state
  const [yAxisFormatOpen, setYAxisFormatOpen] = useState(false);
  const [yAxisTitle, setYAxisTitle] = useState("");
  const [yAxisBold, setYAxisBold] = useState(false);
  const [yAxisItalic, setYAxisItalic] = useState(false);
  const [yAxisUnderline, setYAxisUnderline] = useState(false);

  // Y axis Index format section state
  const [yIndexFormatOpen, setYIndexFormatOpen] = useState(false);
  const [yIndexTitle, setYIndexTitle] = useState("");
  const [yIndexBold, setYIndexBold] = useState(false);
  const [yIndexItalic, setYIndexItalic] = useState(false);
  const [yIndexUnderline, setYIndexUnderline] = useState(false);

  // Preview-linked state
  const [showLabels, setShowLabels] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [legendPosition, setLegendPosition] = useState("top");
  const [legendBold, setLegendBold] = useState(false);
  const [legendItalic, setLegendItalic] = useState(false);
  const [legendTextColor, setLegendTextColor] = useState("");
  const [conditionalRules, setConditionalRules] = useState<{ id: string; evaluateField: string; condition: string; value: string; value2?: string; color: string }[]>([]);
  const [rangeYMin, setRangeYMin] = useState("");
  const [rangeYMax, setRangeYMax] = useState("");
  const [rangeInvert, setRangeInvert] = useState(false);
  const [rangeYIndexMin, setRangeYIndexMin] = useState("");
  const [rangeYIndexMax, setRangeYIndexMax] = useState("");
  const [rangeYIndexInvert, setRangeYIndexInvert] = useState(false);

  const baseColors = [
    "#6a12cd", // Purple (default)
    "#3b82f6", // Blue
    "#0ea5e9", // Light Blue
    "#06b6d4", // Cyan
    "#14b8a6", // Teal
    "#10b981", // Green
    "#84cc16", // Lime
    "#f59e0b", // Amber
    "#f97316", // Orange
  ];

  const addDataBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!addDataOpen) return;
    const close = () => setAddDataOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [addDataOpen]);



  /* Chart dropdown close handler */
  useEffect(() => {
    if (!chartDropdownOpen) return;
    const close = (e: MouseEvent) => {
      // Don't close if clicking on the dropdown button or dropdown menu
      const target = e.target as HTMLElement;
      if (chartDropdownBtnRef.current?.contains(target)) return;
      if (target.closest('[data-chart-dropdown]')) return;
      setChartDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [chartDropdownOpen]);

  /* Pre-select widget type when opening in edit mode */
  useEffect(() => {
    if (open && mode === 'edit' && initialWidgetType) {
      const wt = initialWidgetType.toLowerCase();
      const match = WIDGETS.find(w =>
        w.id.toLowerCase() === wt ||
        w.cardType.toLowerCase() === wt ||
        w.title.toLowerCase() === wt ||
        w.builderType.toLowerCase() === wt
      );
      if (match) setSelected(match);
    }
    if (open && mode === 'edit') {
      if (initialXAxis) {
        const xId = resolveFieldId(initialXAxis);
        setXFieldIds([xId]);
      } else {
        setXFieldIds([]);
      }
      if (initialYAxis) {
        const yId = resolveFieldId(initialYAxis);
        setYFieldIds([yId]);
        setYAggs({ [yId]: "" });
      } else {
        setYFieldIds([]);
        setYAggs({});
      }
      // Pre-fill color, font family, name, and series colors
      if (initialColor) setChartColor(initialColor);
      if (initialFontFamily) setFontFamily(initialFontFamily);
      if (initialName) setWidgetName(initialName);
      if (initialSeriesColors && Object.keys(initialSeriesColors).length > 0) {
        setSeriesColors(initialSeriesColors);
      }
    }
    if (open && mode === 'add') {
      setSelected(null);
      setXFieldIds([]);
      setYFieldIds([]);
      setYIndexFieldIds([]);
      setLegendFieldIds([]);
      setSecondaryYFieldIds([]);
      setSizeFieldIds([]);
      setTimeFieldIds([]);
      setYAggs({});
      setSeriesColors({});
      setBarSpacing("0");
      setSpacingMap({});
      setWidgetName("");
      setWidgetDescription("");
      setChartColor("#6a12cd");
      setFontFamily("Inter");
    }
  }, [open, mode, initialWidgetType, initialXAxis, initialYAxis, initialColor, initialFontFamily, initialName, initialSeriesColors]);

  const removeXField = (id: string) => setXFieldIds(prev => prev.filter(f => f !== id));
  const removeYField = (id: string) => {
    setYFieldIds(prev => prev.filter(f => f !== id));
    setYAggs(prev => { const n = { ...prev }; delete n[id]; return n; });
  };
  const removeTimeField = (id: string) => setTimeFieldIds(prev => prev.filter(f => f !== id));
  const removeYIndexField = (id: string) => setYIndexFieldIds(prev => prev.filter(f => f !== id));
  const changeAgg = (fieldId: string, v: string) => setYAggs(prev => ({ ...prev, [fieldId]: v }));

  const xAxisValue = xFieldIds[0] ? (FIELDS.find(f => f.id === xFieldIds[0])?.axisValue ?? "") : "";
  const yAxisValue = yFieldIds[0] ? (FIELDS.find(f => f.id === yFieldIds[0])?.axisValue ?? "") : "";
  const needsFields = selected?.useFieldBuilder ?? false;

  const editHasInitialValues = mode === 'edit' && !!(initialXAxis || initialYAxis);
  const previewReady = !needsFields || (xAxisValue !== "" && yAxisValue !== "") || editHasInitialValues;
  const isTable = selected?.builderType === 'table';
  const canCustomize = !!selected && (isTable ? xFieldIds.length > 0 || editHasInitialValues : previewReady);
  const canAdd = selected && (!needsFields || previewReady);

  const rawXAxis = xAxisValue || (editHasInitialValues ? initialXAxis : undefined) || selected?.defaultX || "";
  const resolvedYAxis = yAxisValue || (editHasInitialValues ? initialYAxis : undefined) || selected?.defaultY || "";

  // Map date granularity to effective X axis
  const GRANULARITY_PRIORITY = ['day', 'month', 'quarterly', 'year'];
  const GRANULARITY_TO_AXIS: Record<string, string> = { day: 'Day', month: 'Month', quarterly: 'Quarter', year: 'Year' };
  const xFieldIsDate = xFieldIds[0] === 'date' || rawXAxis === 'Date';
  const dateGranularity = xFieldIsDate ? (yAggs['date'] || 'month') : '';
  const resolvedXAxis = (() => {
    if (!xFieldIsDate || !dateGranularity) return rawXAxis;
    const selected_g = dateGranularity.split(',').filter(Boolean);
    if (selected_g.length === GRANULARITY_PRIORITY.length) return 'Date';
    for (const g of GRANULARITY_PRIORITY) {
      if (selected_g.includes(g)) return GRANULARITY_TO_AXIS[g] || rawXAxis;
    }
    return rawXAxis;
  })();

  const handleAdd = () => {
    if (!selected) return;
    const xAxis = needsFields ? xAxisValue : "";
    const yAxis = needsFields ? yAxisValue : selected.defaultY;
    onSelectCard(selected.cardType, { xAxis, yAxis, color: chartColor, name: widgetName, description: widgetDescription, seriesColors: Object.keys(seriesColors).length > 0 ? seriesColors : undefined, fontFamily });
    onOpenChange(false);
  };

  const addFieldToX = (fieldId: string) => {
    if (xFieldIds.length >= 3) return;
    if (!xFieldIds.includes(fieldId)) {
      setXFieldIds(prev => [...prev, fieldId]);
      if (fieldId === "date") {
        setYAggs(prev => ({ ...prev, [fieldId]: "year,quarterly,month,day" }));
      }
    }
  };

  const addFieldToY = (fieldId: string) => {
    if (yFieldIds.length >= 3) return;
    if (!yFieldIds.includes(fieldId)) {
      setYFieldIds(prev => [...prev, fieldId]);
      setYAggs(prev => ({ ...prev, [fieldId]: fieldId === "date" ? "year,quarterly,month,day" : "" }));
    }
  };

  const addFieldToTime = (fieldId: string) => {
    if (timeFieldIds.length >= 3) return;
    if (!timeFieldIds.includes(fieldId)) {
      setTimeFieldIds(prev => [...prev, fieldId]);
      if (fieldId === "date") {
        setYAggs(prev => ({ ...prev, [fieldId]: "year,quarterly,month,day" }));
      }
    }
  };

  const addFieldToYIndex = (fieldId: string) => {
    if (yIndexFieldIds.length >= 3) return;
    if (!yIndexFieldIds.includes(fieldId)) {
      setYIndexFieldIds(prev => [...prev, fieldId]);
    }
  };

  const filteredFields = FIELDS.filter(f => 
    f.label.toLowerCase().includes(dataSearch.toLowerCase())
  );

  const dimensionFields = filteredFields.filter(f => f.kind === "dimension");
  const measureFields = filteredFields.filter(f => f.kind === "measure");

  // ── Live-SQL widget: build the Database → Table → Column tree from
  //    DB_SCHEMAS so the user gets real DB columns instead of the canonical
  //    Excel demo files. We map each column's label back to an existing
  //    FIELDS id when one matches, so dragged items reuse the same icons,
  //    aggregations, and chart wiring as the Excel flow.
  // Three SQL states need to be distinguished:
  //   1. isSqlBound       — dashboard claims a SQL source but its sourceId is
  //                          unknown OR has no published tables. Render empty
  //                          state panel; do NOT fall through to Excel demos.
  //   2. isSqlWidget       — known sourceId + tables present; render DB tree.
  //   3. neither           — Excel/CSV/combo/query → existing demo files path.
  const isSqlBound = widgetSource?.type === 'sql' && !!widgetSource?.sourceId;
  const sqlBindingValid = isSqlBound && !!DB_SCHEMAS[widgetSource!.sourceId!] && DB_SCHEMAS[widgetSource!.sourceId!].length > 0;
  const isSqlWidget = isSqlBound && sqlBindingValid;
  const sqlTables = isSqlWidget ? DB_SCHEMAS[widgetSource!.sourceId!] : [];
  const sqlIntegration = widgetSource?.sourceId ? INTEGRATION_CONFIGS[widgetSource.sourceId] : undefined;
  const sqlHeaderName = isSqlWidget
    ? `${widgetSource?.sourceName || 'Database'}${sqlIntegration?.provider ? ` · ${sqlIntegration.provider}` : ''}`
    : '';
  const sqlFiles: FileTreeFile[] = isSqlWidget ? [{
    name: sqlHeaderName,
    icon: 'database',
    sheets: sqlTables.map(t => ({
      name: `${t.schema}.${t.name}`,
      columns: t.columns
        .filter(c => !dataSearch || c.label.toLowerCase().includes(dataSearch.toLowerCase()))
        .map(c => c.label),
    })),
  }] : [];
  const sqlFieldIdMap: Record<string, string> = {};
  if (isSqlWidget) {
    for (const t of sqlTables) {
      for (const c of t.columns) {
        const existing = FIELDS.find(f => f.label === c.label || f.axisValue === c.label);
        sqlFieldIdMap[c.label] = existing?.id || c.label;
      }
    }
  }

  // Determine which datasource is active based on selected fields
  const getActiveDatasource = (): "file1" | "file2" | null => {
    const allSelectedIds = [...xFieldIds, ...yFieldIds];
    if (allSelectedIds.length === 0) return null;
    
    // Check if any selected field is in dimensionFields (Invoice_Master.xlsx)
    const hasDimensionField = allSelectedIds.some(id => 
      dimensionFields.some(f => f.id === id)
    );
    if (hasDimensionField) return "file1";
    
    // Check if any selected field is in measureFields (Vendor_Finance.xlsx)
    const hasMeasureField = allSelectedIds.some(id => 
      measureFields.some(f => f.id === id)
    );
    if (hasMeasureField) return "file2";
    
    return null;
  };

  const activeDatasource = getActiveDatasource();
  const isFile1Disabled = activeDatasource === "file2";
  const isFile2Disabled = activeDatasource === "file1";

  // ── Multi-table model builder: active for file/custom dashboards (excel /
  //    csv / query / combo). SQL-typed dashboards keep their DB-table path
  //    (valid → DB tree, invalid binding → SQL empty state). ──
  const useModel = widgetSource?.type !== 'sql' && (modelTables?.length ?? 0) > 0;
  const MODEL_CHART_TYPES = ['Bar Chart', 'Line Chart', 'Area Chart', 'Pie Chart', 'KPI', 'Table'];
  const MODEL_COLORS = ['#6a12cd', '#0d9488', '#C2410C', '#1a2744', '#dc2626'];
  const modelPreview = useModel ? buildWidgetRows(modelTables!, relationships, { fields: modelFields }) : null;
  const canAddModel = useModel && modelFields.length > 0 && !modelPreview?.error;
  const addModelWidget = () => {
    onSelectCard(modelType, { xAxis: '', yAxis: '', color: modelColor, name: widgetName || 'Combined widget', model: { fields: modelFields } });
    onOpenChange(false);
  };

  const renderModelBuilder = () => (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <div className="flex-1 p-4 min-h-0 overflow-hidden">
        <MultiTableFieldPicker
          tables={modelTables!}
          relationships={relationships}
          selected={modelFields}
          onChange={setModelFields}
          onConnectTables={() => { onOpenChange(false); onConnectTables?.(); }}
        />
      </div>
      <div className="w-[340px] shrink-0 border-l border-[#f3f4f6] bg-[rgba(249,250,251,0.5)] p-4 flex flex-col gap-4 overflow-y-auto">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1.5 block">Widget name</label>
          <input value={widgetName} onChange={e => setWidgetName(e.target.value)} placeholder="e.g. Spend by Vendor" className="w-full h-9 px-3 bg-white border border-[#e5e7eb] rounded-[8px] text-[12.5px] text-text focus:outline-none focus:border-[#6a12cd]/40" />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1.5 block">Chart type</label>
          <div className="grid grid-cols-3 gap-1.5">
            {MODEL_CHART_TYPES.map(ct => (
              <button key={ct} onClick={() => setModelType(ct)} className={`py-2 rounded-[8px] border text-[10.5px] font-medium cursor-pointer transition-colors ${modelType === ct ? 'border-[#6a12cd]/40 bg-[#faf5ff] text-[#6a12cd]' : 'border-[#e5e7eb] text-ink-600 hover:border-[#6a12cd]/20'}`}>
                {ct.replace(' Chart', '')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1.5 block">Color</label>
          <div className="flex gap-1.5">
            {MODEL_COLORS.map(c => <button key={c} onClick={() => setModelColor(c)} className={`w-7 h-7 rounded-[8px] border-2 cursor-pointer ${modelColor === c ? 'border-ink-900 scale-110' : 'border-transparent'}`} style={{ background: c }} />)}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500 mb-1.5 block">Preview</label>
          <div className="h-[200px] border border-[#e5e7eb] rounded-[10px] p-2 bg-white">
            {modelFields.length === 0
              ? <div className="h-full flex items-center justify-center text-[11.5px] text-ink-400 text-center px-4">Pick fields from the related tables to preview the chart.</div>
              : <ModelChart data={modelPreview!} type={modelType} color={modelColor} />}
          </div>
        </div>
        <button onClick={addModelWidget} disabled={!canAddModel} className="mt-auto h-10 inline-flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-[#6a12cd] hover:bg-[#5a0ebd] rounded-[8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {mode === 'edit' ? 'Save Widget' : 'Add Widget'}
        </button>
      </div>
    </div>
  );

  // Open chart dropdown
  const openChartDropdown = () => {
    if (chartDropdownBtnRef.current) {
      const rect = chartDropdownBtnRef.current.getBoundingClientRect();
      setChartDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
    setChartDropdownOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Prevent closing if chart dropdown is open
      if (!newOpen && chartDropdownOpen) return;
      onOpenChange(newOpen);
    }}>
      <DialogContent
        className="!p-0 !gap-0 !overflow-hidden !bg-white !flex !flex-col !rounded-[12px] !border !border-[#e5e7eb] !shadow-[0_20px_60px_-10px_rgba(0,0,0,0.2)] font-['Inter',sans-serif] sm:max-w-[1200px]"
        style={{ width: "min(1200px, 96vw)", height: "min(775px, 92vh)" }}
      >
        <DialogTitle className="sr-only">{mode === 'edit' ? 'Edit Widget' : 'Add New Widget'}</DialogTitle>
        <DialogDescription className="sr-only">Configure widget data and visualization settings</DialogDescription>

        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-[10px] bg-white border-b border-[#e5e7eb]">
          <div className="flex items-center gap-[8px]">
            <div className="bg-[#faf5ff] rounded-[10px] size-[28px] flex items-center justify-center shrink-0">
              <LayoutGrid className="size-[14px] text-[#7C3AED]" strokeWidth={1.75} />
            </div>
            <span className="text-[0.9375rem] font-semibold text-[#26064a]">{mode === 'edit' ? 'Edit Widget' : 'Add New Widget'}</span>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-[#f3f4f6] transition-colors cursor-pointer">
            <X className="size-[18px] text-[#6b7280]" />
          </button>
        </div>

        {useModel ? renderModelBuilder() : (
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Right Sidebar (moved to right) ── */}
          <div className="w-[340px] shrink-0 bg-[rgba(249,250,251,0.5)] border-l border-[#f3f4f6] flex flex-col overflow-hidden order-2">
            
            {/* ── Tab Switcher ── */}
            <div className="flex shrink-0 border-b border-canvas-border">
              <button
                onClick={() => setActiveTab("data")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[0.75rem] font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "data" ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700"
                }`}
              >
                <Database size={13} />
                Data Source
              </button>
              <button
                onClick={() => setActiveTab("format")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[0.75rem] font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === "format" ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700"
                }`}
              >
                <Settings size={13} />
                Customize
              </button>
            </div>
            
            {activeTab === "data" && (
              <div className="flex-1 flex flex-col px-[12px] py-[12px] min-h-0 overflow-hidden">

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                  {/* ── CHART TYPE section ── */}
                <div className=" bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setChartTypeCollapsed(!chartTypeCollapsed)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white border-b border-[#f0f0f0] hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-[16px] flex items-center justify-center">
                        <LayoutGrid className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                      </div>
                      <span className="text-[0.75rem] font-bold uppercase tracking-[0.8px] text-[#26064a] truncate w-[180px] text-left">
                        {selected ? selected.title : 'Chart Type'}
                      </span>
                    </div>
                    <ChevronDown 
                      className={`size-[16px] text-[#6a12cd] transition-transform duration-200 ${chartTypeCollapsed ? 'rotate-0' : 'rotate-180'}`} 
                      strokeWidth={1.5} 
                    />
                  </button>
                  
                  {!chartTypeCollapsed && (
                    <div className="overflow-y-auto max-h-[300px] py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {WIDGETS.map((w) => {
                        const isActive = selected?.id === w.id;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => { setSelected(w); setChartTypeCollapsed(true); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 transition-all ${
                              isActive
                                ? "bg-[#f4f0ff] text-[#6a12cd]"
                                : "text-[#26064a] hover:bg-[#f9fafb]"
                            }`}
                          >
                            <w.Icon className={`size-[16px] shrink-0 ${isActive ? "text-[#6a12cd]" : "text-[#6a12cd]"}`} strokeWidth={1.5} />
                            <span className={`text-[0.75rem] font-medium whitespace-nowrap ${isActive ? "font-semibold" : ""}`}>{w.title}</span>
                            {isActive && <Check className="size-[14px] ml-auto text-[#6a12cd]" strokeWidth={2} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── DATA SOURCE section ── */}
                <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                  <div className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white border-b border-[#f0f0f0]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-[18px] rounded-[4px] flex items-center justify-center">
                        <Database className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                      </div>
                      <span className="text-[0.75rem] font-bold uppercase tracking-[0.8px] text-[#26064a] shrink-0">Data Source</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenAddData?.(); }}
                      className="flex items-center gap-1 px-2 py-1 text-[0.625rem] font-semibold text-white bg-[#6a12cd] hover:bg-[#5a0ebd] rounded-md transition-colors cursor-pointer shrink-0"
                    >
                      <Plus size={10} />
                      Add Data
                    </button>
                  </div>

                  <div className="bg-[#fafafa]">
                      {/* Search */}
                      <div className="px-2.5 pt-2.5 pb-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-[11px] text-[#b0b8c4]" />
                          <input
                            type="text"
                            placeholder={isSqlWidget ? 'Search columns…' : 'Search fields…'}
                            value={dataSearch}
                            onChange={e => setDataSearch(e.target.value)}
                            className="w-full h-[32px] pl-8 pr-2.5 bg-white border border-[#e5e7eb] rounded-[6px] text-[0.75rem] text-[#26064a] placeholder:text-[#c4c9d4] outline-none focus:border-[#6a12cd]/40 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Empty state — SQL-bound but no published tables. Don't fall
                          through to Excel demos; ask the user to publish in KH. */}
                      {isSqlBound && !sqlBindingValid && (
                        <div className="mx-2.5 mb-2.5 px-3 py-4 bg-white border border-dashed border-[#e5e7eb] rounded-[8px] text-center">
                          <Database size={20} className="text-[#b0b8c4] mx-auto mb-2" strokeWidth={1.5} />
                          <p className="text-[0.75rem] font-semibold text-[#26064a] mb-1">No published tables</p>
                          <p className="text-[0.6875rem] text-[#6b7280] mb-3 leading-relaxed">
                            <span className="font-medium">{widgetSource?.sourceName || 'This connection'}</span> has no tables published to Knowledge Hub yet.
                          </p>
                          <button
                            onClick={() => onOpenKnowledgeHub?.(widgetSource?.sourceId)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.6875rem] font-semibold text-white bg-[#6a12cd] hover:bg-[#5a0ebd] rounded-md transition-colors cursor-pointer"
                          >
                            <Database size={11} />
                            Open Knowledge Hub
                          </button>
                        </div>
                      )}

                      {/* File → Sheet → Fields tree (or Database → Table → Column for live-SQL) */}
                      {!(isSqlBound && !sqlBindingValid) && (
                        <div className="mx-2.5 mb-2.5">
                          <FileTreeView
                            files={isSqlWidget ? sqlFiles : [
                              { name: 'Invoice_Master.xlsx', icon: 'excel', sheets: [{ name: 'Sheet1', columns: dimensionFields.slice(0, 8).map(f => f.label) }] },
                              { name: 'Vendor_Finance.xlsx', icon: 'excel', sheets: [{ name: 'Sheet1', columns: measureFields.map(f => f.label) }] },
                            ]}
                            search={dataSearch}
                            draggable
                            fieldIdMap={isSqlWidget ? sqlFieldIdMap : Object.fromEntries(FIELDS.map(f => [f.label, f.id]))}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── WIDGET INFO section (moved to last position) ── */}
                <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setWidgetInfoCollapsed(!widgetInfoCollapsed)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white border-b border-[#f0f0f0] hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-[16px] flex items-center justify-center">
                        <Info className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                      </div>
                      <span className="font-bold uppercase tracking-[0.8px] text-[#26064a] text-[0.75rem]">Widget Info</span>
                    </div>
                    <ChevronDown 
                      className={`size-[16px] text-[#6a12cd] transition-transform duration-200 ${widgetInfoCollapsed ? 'rotate-0' : 'rotate-180'}`} 
                      strokeWidth={1.5} 
                    />
                  </button>
                  {!widgetInfoCollapsed && (
                    <div className="p-3 space-y-3">
                      <div>
                        <label className="block text-[0.6875rem] font-medium text-[#6b7280] mb-1.5">Widget Name</label>
                        <input
                          type="text"
                          value={widgetName}
                          onChange={(e) => setWidgetName(e.target.value)}
                          placeholder="Enter widget name"
                          className="w-full px-3 py-2 text-[0.8125rem] border border-[#e5e7eb] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#6a12cd]/20 focus:border-[#6a12cd] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6875rem] font-medium text-[#6b7280] mb-1.5">Description</label>
                        <textarea
                          value={widgetDescription}
                          onChange={(e) => setWidgetDescription(e.target.value)}
                          placeholder="Enter widget description"
                          rows={2}
                          className="w-full px-3 py-2 text-[0.8125rem] border border-[#e5e7eb] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#6a12cd]/20 focus:border-[#6a12cd] transition-all resize-none"
                        />
                      </div>
                    </div>
                  )}
                  </div>
                </div>

              </div>
            )}

            {activeTab === "format" && !canCustomize && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="size-12 rounded-xl bg-[#f4f0ff] flex items-center justify-center mb-4">
                  <Settings className="size-5 text-[#6a12cd]" />
                </div>
                <h3 className="text-[0.875rem] font-semibold text-[#26064a] mb-1.5">Nothing to customize yet</h3>
                <p className="text-[0.75rem] text-[#6b7280] leading-relaxed">
                  {!selected
                    ? "Select a chart type and add data fields first, then come back here to style your widget."
                    : isTable
                      ? "Add at least one column to your table first, then come back to customize."
                      : "Drag data fields into the axis slots to render a preview, then customize your chart."
                  }
                </p>
                <button
                  onClick={() => setActiveTab("data")}
                  className="mt-4 px-4 py-2 text-[0.75rem] font-semibold text-[#6a12cd] bg-[#f4f0ff] hover:bg-[#ece5ff] rounded-lg transition-colors cursor-pointer"
                >
                  Go to Data Source
                </button>
              </div>
            )}
            {activeTab === "format" && canCustomize && (
              <div className="flex-1 flex flex-col overflow-hidden px-3 py-3">
                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
                  {/* ── General section with colors and text formatting ── */}
                <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                  <button
                    onClick={() => setGeneralThemeOpen(!generalThemeOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="size-[18px] rounded-[4px] flex items-center justify-center">
                        <Palette className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                      </div>
                      <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">General </span>
                    </div>
                    <ChevronDown
                      className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                      style={{ transform: generalThemeOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                  {generalThemeOpen && (
                    <div className="bg-[#fafafa] p-2.5 space-y-3">
                      {/* Font Family dropdown */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[0.75rem] font-semibold text-[#26064a]">Font Family</label>
                        <WhiteDropdown
                          value={fontFamily}
                          onChange={setFontFamily}
                          options={[
                            { value: "Inter", label: "Inter" },
                            { value: "Poppins", label: "Poppins" },
                            { value: "Roboto", label: "Roboto" },
                            { value: "Open Sans", label: "Open Sans" },
                            { value: "Montserrat", label: "Montserrat" },
                            { value: "Lato", label: "Lato" },
                            { value: "Nunito", label: "Nunito" },
                            { value: "Raleway", label: "Raleway" },
                            { value: "PT Sans", label: "PT Sans" },
                            { value: "Merriweather", label: "Merriweather" },
                            { value: "Playfair Display", label: "Playfair Display" },
                          ]}
                          placeholder="Select font..."
                          size="sm"
                        />
                      </div>

                      {/* Text formatting options */}
                      <div className="flex items-center bg-white rounded-[6px] border border-[#e5e7eb] overflow-hidden">
                        <button
                          onClick={() => setIsBold(!isBold)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${
                            isBold
                              ? "bg-[#6a12cd] text-white"
                              : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                          }`}
                        >
                          <Bold className={`size-[14px] transition-colors ${isBold ? "text-white" : "text-[#6a12cd]"}`} />
                          <span className="text-[0.6875rem] font-medium">
                            Bold
                          </span>
                        </button>
                        <button
                          onClick={() => setIsItalic(!isItalic)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${
                            isItalic
                              ? "bg-[#6a12cd] text-white"
                              : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                          }`}
                        >
                          <Italic className={`size-[14px] transition-colors ${isItalic ? "text-white" : "text-[#6a12cd]"}`} />
                          <span className="text-[0.6875rem] font-medium">
                            Italic
                          </span>
                        </button>
                        <button
                          onClick={() => setIsUnderline(!isUnderline)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-all duration-200 ${
                            isUnderline
                              ? "bg-[#6a12cd] text-white"
                              : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                          }`}
                        >
                          <Underline className={`size-[14px] transition-colors ${isUnderline ? "text-white" : "text-[#6a12cd]"}`} />
                          <span className="text-[0.6875rem] font-medium">
                            Underline
                          </span>
                        </button>
                      </div>

                      {/* Text Formatting Dropdown */}
                      
                    </div>
                  )}
                  </div>

                  {/* ── X AXIS section — hidden for Table, KPI, Pie ── */}
                  {selected && !isTable && selected.builderType !== 'kpi' && selected.builderType !== 'pie' && (
                  <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm">
                    <button
                      onClick={() => setXAxisFormatOpen(!xAxisFormatOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-[18px] rounded-[4px] flex items-center justify-center">
                          <ArrowRightLeft className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                        </div>
                        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">X axis</span>
                      </div>
                      <ChevronDown
                        className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                        style={{ transform: xAxisFormatOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
              
                    {xAxisFormatOpen && (
                      <div className="bg-[#fafafa] p-2.5 space-y-3">
                        {/* Title input */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[0.75rem] font-medium text-[#26064a]">Title</label>
                          <input
                            type="text"
                            value={xAxisTitle}
                            onChange={(e) => setXAxisTitle(e.target.value)}
                            placeholder={resolvedXAxis || "Enter X Axis Title"}
                            className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                          />
                        </div>

                        {/* Text formatting options */}
                        <div className="flex items-center bg-white rounded-[6px] border border-[#e5e7eb] overflow-hidden">
                          <button
                            onClick={() => setXAxisBold(!xAxisBold)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${
                              xAxisBold
                                ? "bg-[#6a12cd] text-white"
                                : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                            }`}
                          >
                            <Bold className={`size-[14px] transition-colors ${xAxisBold ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">
                              Bold
                            </span>
                          </button>
                          <button
                            onClick={() => setXAxisItalic(!xAxisItalic)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${
                              xAxisItalic
                                ? "bg-[#6a12cd] text-white"
                                : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                            }`}
                          >
                            <Italic className={`size-[14px] transition-colors ${xAxisItalic ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">
                              Italic
                            </span>
                          </button>
                          <button
                            onClick={() => setXAxisUnderline(!xAxisUnderline)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-all duration-200 ${
                              xAxisUnderline
                                ? "bg-[#6a12cd] text-white"
                                : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                            }`}
                          >
                            <Underline className={`size-[14px] transition-colors ${xAxisUnderline ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">
                              Underline
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* ── Y AXIS section — hidden for Table, KPI, Pie ── */}
                  {selected && !isTable && selected.builderType !== 'kpi' && selected.builderType !== 'pie' && (
                  <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm mt-3">
                    <button
                      onClick={() => setYAxisFormatOpen(!yAxisFormatOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-[18px] rounded-[4px] flex items-center justify-center">
                          <MoveVertical className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                        </div>
                        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Y axis</span>
                      </div>
                      <ChevronDown
                        className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                        style={{ transform: yAxisFormatOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
              
                    {yAxisFormatOpen && (
                      <div className="bg-[#fafafa] p-2.5 space-y-3">
                        {/* Title input */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[0.75rem] font-medium text-[#26064a]">Title</label>
                          <input
                            type="text"
                            value={yAxisTitle}
                            onChange={(e) => setYAxisTitle(e.target.value)}
                            placeholder={resolvedYAxis || "Enter Y Axis Title"}
                            className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                          />
                        </div>

                        {/* Text formatting options */}
                        <div className="flex items-center bg-white rounded-[6px] border border-[#e5e7eb] overflow-hidden">
                          <button
                            onClick={() => setYAxisBold(!yAxisBold)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${
                              yAxisBold
                                ? "bg-[#6a12cd] text-white"
                                : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                            }`}
                          >
                            <Bold className={`size-[14px] transition-colors ${yAxisBold ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">
                              Bold
                            </span>
                          </button>
                          <button
                            onClick={() => setYAxisItalic(!yAxisItalic)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${
                              yAxisItalic
                                ? "bg-[#6a12cd] text-white"
                                : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                            }`}
                          >
                            <Italic className={`size-[14px] transition-colors ${yAxisItalic ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">
                              Italic
                            </span>
                          </button>
                          <button
                            onClick={() => setYAxisUnderline(!yAxisUnderline)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-all duration-200 ${
                              yAxisUnderline
                                ? "bg-[#6a12cd] text-white"
                                : "bg-white text-[#26064a] hover:bg-[#faf5ff]"
                            }`}
                          >
                            <Underline className={`size-[14px] transition-colors ${yAxisUnderline ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">
                              Underline
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* ── Y AXIS INDEX section — only for charts with secondaryY ── */}
                  {selected && (secondaryYFieldIds.length > 0 || yFieldIds.length > 1) && (
                  <div className="bg-white rounded-[8px] border border-[#e5e7eb] overflow-hidden shadow-sm mt-3">
                    <button
                      onClick={() => setYIndexFormatOpen(!yIndexFormatOpen)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-[#faf5ff] to-white hover:from-[#f5f0ff] hover:to-[#fefefe] transition-all border-b border-[#f0f0f0]"
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-[18px] rounded-[4px] flex items-center justify-center">
                          <MoveVertical className="size-[12px] text-[#6a12cd]" strokeWidth={2} />
                        </div>
                        <span className="text-[0.6875rem] font-bold uppercase tracking-[0.8px] text-[#26064a]">Y Axis Index</span>
                      </div>
                      <ChevronDown
                        className="size-[14px] text-[#6a12cd] transition-transform duration-200"
                        style={{ transform: yIndexFormatOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </button>
                    {yIndexFormatOpen && (
                      <div className="bg-[#fafafa] p-2.5 space-y-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[0.75rem] font-medium text-[#26064a]">Title</label>
                          <input
                            type="text"
                            value={yIndexTitle}
                            onChange={(e) => setYIndexTitle(e.target.value)}
                            placeholder="Enter Y Axis Index Title"
                            className="w-full px-3.5 py-2 text-[0.75rem] bg-white border border-[rgba(38,6,74,0.2)] rounded-[8px] text-[#26064a] placeholder:text-[rgba(38,6,74,0.2)] focus:outline-none focus:border-[#6a12cd] focus:ring-1 focus:ring-[#6a12cd] transition-all shadow-sm"
                          />
                        </div>
                        <div className="flex items-center bg-white rounded-[6px] border border-[#e5e7eb] overflow-hidden">
                          <button
                            onClick={() => setYIndexBold(!yIndexBold)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${yIndexBold ? "bg-[#6a12cd] text-white" : "bg-white text-[#26064a] hover:bg-[#faf5ff]"}`}
                          >
                            <Bold className={`size-[14px] transition-colors ${yIndexBold ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">Bold</span>
                          </button>
                          <button
                            onClick={() => setYIndexItalic(!yIndexItalic)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border-r border-[#e5e7eb] transition-all duration-200 ${yIndexItalic ? "bg-[#6a12cd] text-white" : "bg-white text-[#26064a] hover:bg-[#faf5ff]"}`}
                          >
                            <Italic className={`size-[14px] transition-colors ${yIndexItalic ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">Italic</span>
                          </button>
                          <button
                            onClick={() => setYIndexUnderline(!yIndexUnderline)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-all duration-200 ${yIndexUnderline ? "bg-[#6a12cd] text-white" : "bg-white text-[#26064a] hover:bg-[#faf5ff]"}`}
                          >
                            <Underline className={`size-[14px] transition-colors ${yIndexUnderline ? "text-white" : "text-[#6a12cd]"}`} />
                            <span className="text-[0.6875rem] font-medium">Underline</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* ── LEGENDS section — hidden for KPI, Table ── */}
                  {selected && selected.builderType !== 'kpi' && !isTable && selected.builderType !== 'scatter' && (
                    <LegendSection showLegend={showLegend} onShowLegendChange={setShowLegend} legendPosition={legendPosition} onLegendPositionChange={setLegendPosition} legendBold={legendBold} onLegendBoldChange={setLegendBold} legendItalic={legendItalic} onLegendItalicChange={setLegendItalic} legendTextColor={legendTextColor} onLegendTextColorChange={setLegendTextColor} />
                  )}

                  {/* ── DATA LABELS section — hidden for Table, Scatter ── */}
                  {selected && !isTable && selected.builderType !== 'scatter' && (
                    <TypographySection showLabels={showLabels} onShowLabelsChange={setShowLabels} />
                  )}

                  {/* ── RANGE (Y AXIS) section — hidden for Pie, KPI, Table ── */}
                  {selected && !isTable && selected.builderType !== 'kpi' && selected.builderType !== 'pie' && (
                    <RangeYAxisSection yMin={rangeYMin} yMax={rangeYMax} invertRange={rangeInvert} onYMinChange={setRangeYMin} onYMaxChange={setRangeYMax} onInvertChange={setRangeInvert} />
                  )}

                  {/* ── RANGE (Y AXIS INDEX) section — when Y Axis Index or multiple Y fields ── */}
                  {(secondaryYFieldIds.length > 0 || yFieldIds.length > 1) && (
                    <RangeYAxisSection label="Range (Y Axis Index)" yMin={rangeYIndexMin} yMax={rangeYIndexMax} invertRange={rangeYIndexInvert} onYMinChange={setRangeYIndexMin} onYMaxChange={setRangeYIndexMax} onInvertChange={setRangeYIndexInvert} />
                  )}

                {/* ── CONDITIONAL FORMATTING section ── */}
                <ConditionalFormattingSection
                  xAxisFields={xFieldIds.map(id => FIELDS.find(f => f.id === id)?.label || id)}
                  yAxisFields={yFieldIds.map(id => FIELDS.find(f => f.id === id)?.label || id)}
                  onRulesChange={setConditionalRules}
                />

                {/* ── DATA SERIES FORMATTING section ── */}
                {!isTable && <DataSeriesFormattingSection
                  series={(() => {
                    if (!selected) return [];
                    const bt = selected.builderType;
                    if (bt === 'pie') {
                      const pieData = PIE_DATA[resolvedXAxis] ?? PIE_DATA["Status"];
                      return pieData.map((d: any) => d.name);
                    }
                    if (bt === 'bar') return ['Total Duplicates', 'Resolved', 'Pending'];
                    if (bt === 'line') return ['Actual Accuracy', 'Target Accuracy'];
                    if (bt === 'area') {
                      const yShort = (resolvedYAxis || 'Duplicate Count').replace(/\s*\(.*?\)/, '').trim();
                      return [`Actual ${yShort}`, `Target ${yShort}`];
                    }
                    // Fallback: use Y-axis fields if available, otherwise use resolved axis labels
                    const yLabels = yFieldIds.map(id => FIELDS.find(f => f.id === id)?.label || id);
                    if (yLabels.length > 0) return yLabels;
                    if (resolvedYAxis) return [resolvedYAxis];
                    return [selected.title];
                  })()}
                  seriesColors={seriesColors}
                  onSeriesColorsChange={setSeriesColors}
                  spacingType={selected?.builderType === 'bar' ? 'bar' : selected?.builderType === 'pie' ? 'pie' : 'disabled'}
                  spacingMap={spacingMap}
                  onSpacingMapChange={(map) => {
                    setSpacingMap(map);
                    // For bar charts, use the max spacing value as global barSpacing
                    if (selected?.builderType === 'bar') {
                      const vals = Object.values(map).map(Number).filter(n => !isNaN(n));
                      setBarSpacing(vals.length > 0 ? String(Math.max(...vals)) : "0");
                    }
                  }}
                />}
                </div>
              </div>
            )}

            {/* ── ADD WIDGET BUTTON — fixed at sidebar bottom ── */}
            <div className="shrink-0 px-3 py-3 border-t border-[#e5e7eb] bg-white">
              <button
                onClick={() => {
                  if (isCreateDashboardMode && onNavigateToBuilder) {
                    if (!selected) return;
                    const xAxis = needsFields ? xAxisValue : "";
                    const yAxis = needsFields ? yAxisValue : selected.defaultY;
                    onNavigateToBuilder({ cardType: selected.cardType, config: { xAxis, yAxis, color: chartColor, name: widgetName, description: widgetDescription, fontFamily } });
                    onOpenChange(false);
                  } else {
                    handleAdd();
                  }
                }}
                disabled={!canAdd}
                className={`w-full h-[40px] px-4 rounded-[8px] text-[0.875rem] font-semibold transition-all ${
                  canAdd
                    ? "bg-[#6a12cd] text-white hover:bg-[#5a0ebd] shadow-sm"
                    : "bg-[#e5e7eb] text-[#9ca3af] cursor-not-allowed"
                }`}
              >
                {isCreateDashboardMode ? "Create Dashboard" : "Add Widget"}
              </button>
            </div>
          </div>

          {/* ── Main Area ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white order-1">
            
            {/* ── Axis Configuration Rows — dynamic per chart type ── */}
            {selected && (
              <div className="shrink-0 px-6 py-3 space-y-2 border-b border-[#e5e7eb] bg-white">
                {(() => {
                  const stateMap: Record<string, { ids: string[]; add: (id: string) => void; remove: (id: string) => void; showAgg?: boolean }> = {
                    xAxis:      { ids: xFieldIds,          add: addFieldToX,     remove: removeXField,      showAgg: true },
                    yAxis:      { ids: yFieldIds,          add: addFieldToY,     remove: removeYField,      showAgg: true },
                    legend:     { ids: legendFieldIds,     add: (id) => { if (!legendFieldIds.includes(id)) setLegendFieldIds(p => [...p, id]); }, remove: (id) => setLegendFieldIds(p => p.filter(f => f !== id)) },
                    secondaryY: { ids: secondaryYFieldIds, add: (id) => { if (!secondaryYFieldIds.includes(id)) setSecondaryYFieldIds(p => [...p, id]); }, remove: (id) => setSecondaryYFieldIds(p => p.filter(f => f !== id)), showAgg: true },
                    size:       { ids: sizeFieldIds,       add: (id) => { if (!sizeFieldIds.includes(id)) setSizeFieldIds(p => [...p, id]); }, remove: (id) => setSizeFieldIds(p => p.filter(f => f !== id)) },
                  };

                  const hasSecondaryY = selected.dimensions.some(d => d.key === 'secondaryY');

                  // Render a single drop zone
                  const renderDropZone = (dim: { key: string; label: string }) => {
                    const slot = stateMap[dim.key];
                    if (!slot) return null;
                    return (
                      <div
                        key={dim.key}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                        onDrop={(e) => { e.preventDefault(); const fieldId = e.dataTransfer.getData("fieldId"); if (fieldId) slot.add(fieldId); }}
                        className="flex-1 min-h-[40px] bg-white border border-dashed border-[#d1d5db] hover:border-[#6a12cd] hover:bg-[#faf5ff] rounded-[6px] px-2.5 py-2 transition-all duration-200"
                      >
                        {slot.ids.length === 0 ? (
                          <div className="flex items-center gap-2 h-full">
                            <GripVertical className="size-[14px] text-[#d1d5db]" />
                            <span className="text-[0.75rem] text-[#9ca3af]">{dim.label}</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {slot.ids.map((fid) => {
                              const field = FIELDS.find(f => f.id === fid);
                              if (!field) return null;
                              const agg = yAggs[fid] || "";
                              return (
                                <div key={fid} className="flex items-center gap-1.5 h-[28px] px-2.5 bg-[#faf5ff] rounded-[4px] border border-[#6a12cd]/30 shrink-0">
                                  <span className="text-[0.75rem] font-medium text-[#26064a] whitespace-nowrap">{field.label}</span>
                                  {slot.showAgg && <AggDropdown value={agg} onChange={(v) => changeAgg(fid, v)} fieldId={fid} />}
                                  <button onClick={() => slot.remove(fid)} className="p-0.5 rounded hover:bg-[rgba(38,6,74,0.1)] transition-colors">
                                    <X className="size-[12px] text-[#6b7280] hover:text-[#ef4444]" strokeWidth={2} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  };

                  // Group dimensions: yAxis + secondaryY go side by side (regardless of position), rest get their own row
                  const dims = selected.dimensions;
                  const secondaryYDim = hasSecondaryY ? dims.find(d => d.key === 'secondaryY') : null;
                  const rows: React.ReactElement[] = [];
                  let i = 0;
                  while (i < dims.length) {
                    const dim = dims[i];
                    // Skip secondaryY here — it's rendered alongside yAxis
                    if (dim.key === 'secondaryY' && secondaryYDim) {
                      i++;
                      continue;
                    }
                    // If this is yAxis and we have secondaryY, render them side by side
                    if (dim.key === 'yAxis' && secondaryYDim) {
                      rows.push(
                        <div key="yAxis-group" className="flex items-center gap-4">
                          <div className="w-[80px] shrink-0">
                            <p className="text-[0.75rem] font-semibold text-[#26064a]">{dim.label}</p>
                          </div>
                          <div className="flex-1 flex gap-2">
                            {renderDropZone(dim)}
                            {renderDropZone(secondaryYDim)}
                          </div>
                        </div>
                      );
                      i++;
                    } else {
                      rows.push(
                        <div key={dim.key} className="flex items-center gap-4">
                          <div className="w-[80px] shrink-0">
                            <p className="text-[0.75rem] font-semibold text-[#26064a]">{dim.label}</p>
                          </div>
                          {renderDropZone(dim)}
                        </div>
                      );
                      i++;
                    }
                  }
                  return rows;
                })()}

                {/* SUGGESTION BANNER - Show when 2+ Y-axis fields */}
                {yFieldIds.length >= 2 && (
                  <div className="flex items-center gap-4 ml-[80px] pl-4">
                    <div className="flex items-center gap-4 px-4 py-2 bg-[#fafafa] rounded-[4px]">
                      <Lightbulb className="size-[14px] text-[#6A12CD]" strokeWidth={2} />
                      <div className="flex items-center gap-2">
                        {[
                          { id: "clustered-column", Icon: BarChart3, label: "Bar" },
                          { id: "line", Icon: LineChartIcon, label: "Line" },
                          { id: "area", Icon: TrendingUp, label: "Area" },
                        ].map(({ id, Icon, label }) => (
                          <button
                            key={id}
                            onClick={() => { const w = WIDGETS.find(w => w.id === id); if (w) setSelected(w); }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-[4px] transition-colors ${selected?.id === id ? "bg-[#6A12CD] text-white" : "hover:bg-[#6A12CD]/10 text-[#26064A]"}`}
                          >
                            <Icon className={`size-[12px] ${selected?.id === id ? "text-white" : "text-[#26064A]"}`} strokeWidth={2} />
                            <span className="text-[0.75rem]">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PREVIEW Section ── */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-canvas-border px-[16px] py-2.5">
                <p className="text-[0.75rem] font-medium uppercase tracking-[1px] text-[#26064a]">Preview</p>
                {selected && <span className="text-[0.75rem] font-medium text-[#6a12cd]">{selected.title}</span>}
              </div>
              {/* Y Axis Index suggestion — suggest combo chart */}
              {selected && (secondaryYFieldIds.length > 0 || yFieldIds.length > 1) && ['bar', 'line', 'area'].includes(selected.builderType) && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[#f4f0ff] border-b border-[#e5e7eb]">
                  <Lightbulb size={14} className="text-[#6a12cd] shrink-0" />
                  <p className="text-[0.6875rem] text-[#26064a] flex-1">You have a secondary Y axis. Try a dual chart:</p>
                  <button
                    onClick={() => { const combo = WIDGETS.find(w => w.id === 'line-clustered'); if (combo) setSelected(combo); }}
                    className="text-[0.6875rem] font-semibold text-[#6a12cd] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Line & Column
                  </button>
                  <button
                    onClick={() => { const combo = WIDGETS.find(w => w.id === 'line-stacked'); if (combo) setSelected(combo); }}
                    className="text-[0.6875rem] font-semibold text-[#6a12cd] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Line & Stacked
                  </button>
                </div>
              )}
              
              <div className="flex-1 overflow-auto p-6">
                {previewReady && selected && (
                  <div className="w-full h-full min-h-[300px]">
                    {selected.id === "kpi" ? (
                      yFieldIds.length > 0 ? (
                        <div className="flex items-center justify-center h-full gap-5 flex-wrap">
                          {yFieldIds.map((fid, i) => {
                            const field = FIELDS.find(f => f.id === fid);
                            const label = field?.label || fid;
                            const values = ["12,450", "94.2%", "₹4.2M", "23", "1.8d", "38d", "₹85L"];
                            return (
                              <div key={fid} className="bg-white rounded-xl border-2 border-[#e5e7eb] p-6 shadow-sm hover:shadow-md transition-shadow w-[280px]">
                                <p className="text-[1rem] font-semibold text-[#26064a] mb-3">
                                  {label}
                                </p>
                                <p className="text-[3rem] font-bold text-[#26064a]">
                                  {values[i % values.length]}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center max-w-[280px]">
                            <div className="mx-auto mb-4 size-20 rounded-2xl bg-[#f4f0ff] flex items-center justify-center">
                              <Hash className="size-10 text-[#6a12cd]/30" strokeWidth={1.5} />
                            </div>
                            <p className="text-[0.9375rem] font-semibold text-[#26064a] mb-1">Add a Value Field</p>
                            <p className="text-[0.8125rem] text-[#9ca3af] leading-relaxed">Drag a measure field into the Value slot above to see your KPI card.</p>
                          </div>
                        </div>
                      )
                    ) : (
                      <ConfigurableChart
                        type={selected.builderType as any}
                        xAxis={resolvedXAxis}
                        yAxis={resolvedYAxis}
                        color={chartColor}
                        seriesColors={seriesColors}
                        onSeriesColorChange={(label, color) => setSeriesColors(prev => ({ ...prev, [label]: color }))}
                        barSpacing={barSpacing}
                        pieSpacingMap={selected?.builderType === 'pie' ? spacingMap : undefined}
                        fontFamily={fontFamily}
                        bold={isBold}
                        italic={isItalic}
                        underline={isUnderline}
                        xAxisTitle={xAxisTitle || resolvedXAxis}
                        yAxisTitle={yAxisTitle || resolvedYAxis}
                        showLabels={showLabels}
                        showLegend={showLegend}
                        legendPosition={legendPosition}
                        legendBold={legendBold}
                        legendItalic={legendItalic}
                        legendTextColor={legendTextColor}
                        yMin={rangeYMin}
                        yMax={rangeYMax}
                        invertRange={rangeInvert}
                        conditionalRules={conditionalRules}
                        aggregation={yFieldIds[0] ? (yAggs[yFieldIds[0]] || undefined) : undefined}
                        tableColumns={isTable ? [...xFieldIds, ...yFieldIds].map(id => FIELDS.find(f => f.id === id)?.label || id) : undefined}
                      />
                    )}
                  </div>
                )}
                {(!previewReady || !selected) && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center max-w-[280px]">
                      <div className="mx-auto mb-4 size-20 rounded-2xl bg-[#f4f0ff] flex items-center justify-center">
                        {!selected ? (
                          <BarChart3 className="size-10 text-[#6a12cd]/30" strokeWidth={1.5} />
                        ) : (
                          <selected.Icon className="size-10 text-[#6a12cd]/30" strokeWidth={1.5} />
                        )}
                      </div>
                      <p className="text-[0.9375rem] font-semibold text-[#26064a] mb-1">
                        {!selected ? "No Chart Selected" : "Almost There"}
                      </p>
                      <p className="text-[0.8125rem] text-[#9ca3af] leading-relaxed">
                        {!selected
                          ? "Select a chart type from the sidebar to start building your visualization."
                          : "Drag data fields into the axis slots above to generate a preview."
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer: Add Widget Button (Moved to Sidebar) ── */}
            <div className="shrink-0 h-[57px] border-t border-[#f0f0f0]" style={{ display: 'none' }}>
              {/* Button moved to Format sidebar */}
            </div>
          </div>
        </div>
        )}
      </DialogContent>



    </Dialog>
  );
}