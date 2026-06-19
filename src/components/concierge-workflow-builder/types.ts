export type ColumnRole = 'join_key' | 'compare' | 'filter' | 'output';
export type StepType =
  | 'extract'
  | 'analyze'
  | 'compare'
  | 'flag'
  | 'summarize'
  | 'calculate'
  | 'validate';
export type OutputType = 'flags' | 'table' | 'summary';
export type InputType = 'csv' | 'pdf' | 'sql' | 'image';

/** How a required-file slot treats the source(s) mapped to it.
 *  - consolidate: union same-schema sources many→one (the "Multiple files" case)
 *  - single:      exactly one source allowed (master/reference tables)
 *  - compare:     2+ sources kept distinct, aligned for diff (never concatenated)
 *  - reference:   joined/looked-up against other inputs, not stacked */
export type SlotFunction = 'consolidate' | 'single' | 'compare' | 'reference';

export type ColumnDataType = 'text' | 'number' | 'date';

export interface ColumnSpec {
  name: string;
  dataType: ColumnDataType;
  /** Example value shown beneath the column name in the "Expected columns" popover. */
  sample?: string;
}

export interface InputSpec {
  id: string;
  name: string;
  type: InputType;
  description: string;
  required: boolean;
  multiple?: boolean;
  /** Slot role — how sources mapped here are treated. When unset, falls back to
   *  'consolidate' if `multiple` is true, otherwise 'single'. */
  func?: SlotFunction;
  columns?: string[];
  /** Richer per-column schema (type + sample) surfaced via the "View columns" popover.
   *  When absent, the executor falls back to `columns` with an inferred type. */
  columnSpecs?: ColumnSpec[];
}

export interface StepSpec {
  id: string;
  name: string;
  description: string;
  type: StepType;
  dataFiles: string[];
}

export interface OutputSpec {
  type: OutputType;
  title: string;
  description: string;
}

export interface WorkflowDraft {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  logicPrompt: string;
  inputs: InputSpec[];
  steps: StepSpec[];
  output: OutputSpec;
}

export type UploadedFile = { name: string; size: number; linkedSource?: boolean; path?: string };
export type JourneyFiles = Record<string, UploadedFile[]>;

export interface ClarifyQuestion {
  id: string;
  title: string;
  options: string[];
}

export type ClarifyAnswers = Record<string, string>;

// mappings keyed as: stepId -> inputId -> [{ column, role }]
export type StepMapping = Record<string, { column: string; role: ColumnRole }[]>;
export type JourneyMappings = Record<string, StepMapping>;

export interface RunResult {
  outputType: OutputType;
  title: string;
  description: string;
  stats: { label: string; value: string; tone: 'primary' | 'risk' | 'warning' | 'ok' }[];
  columns: string[];
  rows: { cells: string[]; status: 'flagged' | 'warning' | 'ok' }[];
}

// ── Column alignment (Step 3: Map Data) ────────────────────────────────

export type ColumnDType = 'STRING' | 'DECIMAL' | 'INT' | 'TIMESTAMP' | 'BOOL';

export interface ColumnTypePair {
  name: string;
  dtype: ColumnDType;
}

export interface ColumnAlignment {
  id: string;
  source: ColumnTypePair;
  target: ColumnTypePair | null;
  confidence: number; // 0-100
  breakdown: {
    nameSimilarity: number;
    typeCompatibility: number;
    statisticalProfile: number;
    semanticSimilarity: number;
  };
  explanation: string;
  reason: 'unmapped' | 'low_confidence' | 'type_mismatch' | null;
}

export type JourneyAlignments = Record<string, ColumnAlignment[]>;

// ── Right-panel Input Config state (tolerance rules + notes) ───────────

export type ToleranceDot = 'f1' | 'f2' | 'f3';
export type ToleranceSeverity = 'strict' | 'moderate' | 'relaxed';
export type ToleranceCompareType = 'numeric' | 'date' | 'text' | 'exact';

export interface ToleranceColumns {
  src: string;
  srcFile: string;
  srcDot: ToleranceDot;
  tgt: string;
  tgtFile: string;
  tgtDot: ToleranceDot;
}

export interface ToleranceAmt {
  enabled: boolean;
  expanded: boolean;
  mode: 'percentage' | 'absolute';
  val: number;
  absVal: number;
  columns: ToleranceColumns;
}

export interface ToleranceDate {
  enabled: boolean;
  expanded: boolean;
  val: number;
  dayType: 'calendar' | 'business';
  columns: ToleranceColumns;
}

export interface ToleranceText {
  enabled: boolean;
  expanded: boolean;
  val: number;
  normalize: {
    ignoreCase: boolean;
    trimSpaces: boolean;
    stripSpecial: boolean;
    removePrefixes: boolean;
  };
  columns: ToleranceColumns;
}

export interface ToleranceQty {
  enabled: boolean;
  expanded: boolean;
  mode: 'percentage' | 'absolute';
  val: number;
  unitVal: number;
  columns: ToleranceColumns;
}

export interface ToleranceRules {
  amt: ToleranceAmt;
  date: ToleranceDate;
  text: ToleranceText;
  qty: ToleranceQty;
}

export type ToleranceBuiltinId = keyof ToleranceRules;

export interface CustomToleranceRule {
  id: string;
  name: string;
  icon: string;
  cls: 'qty' | 'fx' | 'round' | 'agg' | 'custom';
  type: ToleranceCompareType;
  threshold: string;
  enabled: boolean;
  expanded: boolean;
  columns: ToleranceColumns | null;
}

export interface InputNote {
  id: string;
  name: string;
  description: string;
  aiSuggested: boolean;
  enabled: boolean;
}
