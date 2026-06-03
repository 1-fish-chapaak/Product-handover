import { Fragment, useEffect, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  DollarSign,
  CalendarDays,
  Type as TypeIcon,
  Package,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import type {
  CustomToleranceRule,
  ToleranceAmt,
  ToleranceBuiltinId,
  ToleranceColumns,
  ToleranceCompareType,
  ToleranceDate,
  ToleranceDot,
  ToleranceQty,
  ToleranceRules,
  ToleranceSeverity,
  ToleranceText,
} from './types';

// ─── Reference data ───────────────────────────────────────────────────

const dotColors: Record<ToleranceDot, string> = {
  f1: '#6A12CD',
  f2: '#185FA5',
  f3: '#0F6E56',
};

const severityStyle: Record<ToleranceSeverity, { bg: string; color: string; label: string }> = {
  strict: { bg: 'rgba(220,38,38,0.08)', color: '#DC2626', label: 'Strict' },
  moderate: { bg: 'rgba(183,137,0,0.08)', color: '#B78900', label: 'Moderate' },
  relaxed: { bg: 'rgba(15,110,86,0.08)', color: '#0F6E56', label: 'Relaxed' },
};

const iconTint: Record<'amt' | 'date' | 'text' | 'qty', { bg: string; color: string }> = {
  amt: { bg: '#E1F5EE', color: '#0F6E56' },
  date: { bg: '#E6F1FB', color: '#185FA5' },
  text: { bg: '#EEEDFE', color: '#534AB7' },
  qty: { bg: '#FAEEDA', color: '#854F0B' },
};

const tolTypeStyles: Record<CustomToleranceRule['cls'], { bg: string; color: string }> = {
  qty: { bg: '#FAEEDA', color: '#854F0B' },
  fx: { bg: '#FCE4EC', color: '#C62828' },
  round: { bg: '#E8EAF6', color: '#283593' },
  agg: { bg: '#FFF3E0', color: '#E65100' },
  custom: { bg: '#F5F0FF', color: '#6A12CD' },
};

const tolColumnsByType: Record<
  ToleranceCompareType,
  Record<string, { file: string; dot: ToleranceDot; cols: string[] }>
> = {
  numeric: {
    src1: { file: 'AP Invoice Register', dot: 'f1', cols: ['Invoice Amount', 'Tax Amount', 'Net Amount'] },
    src2: { file: 'Purchase Orders', dot: 'f3', cols: ['PO Amount', 'Line Total'] },
    tgt1: { file: 'GL Trial Balance', dot: 'f2', cols: ['GL Amount', 'Debit', 'Credit'] },
  },
  date: {
    src1: { file: 'AP Invoice Register', dot: 'f1', cols: ['Invoice Date', 'Due Date', 'Created At'] },
    src2: { file: 'Purchase Orders', dot: 'f3', cols: ['PO Date', 'Delivery Date'] },
    tgt1: { file: 'GL Trial Balance', dot: 'f2', cols: ['Posting Date', 'Period End'] },
  },
  text: {
    src1: { file: 'AP Invoice Register', dot: 'f1', cols: ['Vendor Name', 'Description', 'Invoice Number'] },
    src2: { file: 'Purchase Orders', dot: 'f3', cols: ['Supplier Name', 'PO Number'] },
    tgt1: { file: 'GL Trial Balance', dot: 'f2', cols: ['GL Description', 'Account Name'] },
  },
  exact: {
    src1: { file: 'AP Invoice Register', dot: 'f1', cols: ['Currency Code', 'Cost Center', 'Vendor ID'] },
    src2: { file: 'Purchase Orders', dot: 'f3', cols: ['PO Currency', 'Department'] },
    tgt1: { file: 'GL Trial Balance', dot: 'f2', cols: ['GL Currency', 'GL Cost Center'] },
  },
};

const ruleToColType: Record<ToleranceBuiltinId, ToleranceCompareType> = {
  amt: 'numeric',
  date: 'date',
  text: 'text',
  qty: 'numeric',
};

const defaultRules: ToleranceRules = {
  amt: {
    val: 5,
    absVal: 500,
    enabled: true,
    expanded: false,
    mode: 'percentage',
    columns: {
      src: 'Invoice Amount',
      srcFile: 'AP Invoice Register',
      srcDot: 'f1',
      tgt: 'GL Amount',
      tgtFile: 'GL Trial Balance',
      tgtDot: 'f2',
    },
  },
  date: {
    val: 3,
    enabled: true,
    expanded: true,
    dayType: 'calendar',
    columns: {
      src: 'Invoice Date',
      srcFile: 'AP Invoice Register',
      srcDot: 'f1',
      tgt: 'Posting Date',
      tgtFile: 'GL Trial Balance',
      tgtDot: 'f2',
    },
  },
  text: {
    val: 80,
    enabled: false,
    expanded: false,
    normalize: {
      ignoreCase: true,
      trimSpaces: true,
      stripSpecial: false,
      removePrefixes: false,
    },
    columns: {
      src: 'Vendor Name',
      srcFile: 'AP Invoice Register',
      srcDot: 'f1',
      tgt: 'GL Description',
      tgtFile: 'GL Trial Balance',
      tgtDot: 'f2',
    },
  },
  qty: {
    val: 2,
    unitVal: 10,
    enabled: false,
    expanded: false,
    mode: 'percentage',
    columns: {
      src: 'Ordered Qty',
      srcFile: 'Purchase Orders',
      srcDot: 'f3',
      tgt: 'Received Qty',
      tgtFile: 'AP Invoice Register',
      tgtDot: 'f1',
    },
  },
};

const tolPresets: Array<{
  id: string;
  name: string;
  icon: string;
  desc: string;
  cls: CustomToleranceRule['cls'];
  builtin?: ToleranceBuiltinId;
  tag?: string;
  tagType?: 'rec' | 'isa';
  columns: ToleranceColumns | null;
  type: ToleranceCompareType;
  threshold: string;
}> = [
  {
    id: 'qty-builtin',
    name: 'Quantity',
    icon: '⚓',
    desc: 'Unit count variance (PO vs GRN vs Invoice)',
    cls: 'qty',
    builtin: 'qty',
    columns: {
      src: 'Ordered Qty',
      srcFile: 'Purchase Orders',
      srcDot: 'f3',
      tgt: 'Received Qty',
      tgtFile: 'AP Invoice Register',
      tgtDot: 'f1',
    },
    type: 'numeric',
    threshold: '±2%',
  },
  {
    id: 'fx',
    name: 'Currency / FX',
    icon: 'FX',
    desc: 'Exchange rate variance',
    cls: 'fx',
    tag: 'Rec',
    tagType: 'rec',
    columns: {
      src: 'Invoice Currency',
      srcFile: 'AP Invoice Register',
      srcDot: 'f1',
      tgt: 'GL Currency',
      tgtFile: 'GL Trial Balance',
      tgtDot: 'f2',
    },
    type: 'numeric',
    threshold: '±0.5%',
  },
  {
    id: 'round',
    name: 'Rounding',
    icon: '¢',
    desc: 'Penny differences',
    cls: 'round',
    columns: {
      src: 'Invoice Amount',
      srcFile: 'AP Invoice Register',
      srcDot: 'f1',
      tgt: 'GL Amount',
      tgtFile: 'GL Trial Balance',
      tgtDot: 'f2',
    },
    type: 'numeric',
    threshold: '±$1.00',
  },
  {
    id: 'agg',
    name: 'Aggregate cap',
    icon: 'Σ',
    desc: 'Cumulative variance limit',
    cls: 'agg',
    tag: 'ISA',
    tagType: 'isa',
    columns: null,
    type: 'numeric',
    threshold: '$50K total',
  },
];

const toleranceSeverity = (rule: ToleranceBuiltinId, v: number): ToleranceSeverity => {
  if (rule === 'amt') return v <= 2 ? 'strict' : v <= 7 ? 'moderate' : 'relaxed';
  if (rule === 'date') return v <= 1 ? 'strict' : v <= 4 ? 'moderate' : 'relaxed';
  if (rule === 'text') return v >= 90 ? 'strict' : v >= 70 ? 'moderate' : 'relaxed';
  return v <= 1 ? 'strict' : v <= 3 ? 'moderate' : 'relaxed';
};

// ─── Component ────────────────────────────────────────────────────────

export default function ToleranceSection() {
  const [rules, setRules] = useState<ToleranceRules>(defaultRules);
  const [visibleBuiltins, setVisibleBuiltins] = useState<ToleranceBuiltinId[]>(['amt', 'date', 'text']);
  const [customRules, setCustomRules] = useState<CustomToleranceRule[]>([]);

  const updateRule = <K extends ToleranceBuiltinId>(key: K, patch: Partial<ToleranceRules[K]>) =>
    setRules((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const activeCount =
    Object.values(rules).filter((r) => r.enabled).length +
    customRules.filter((r) => r.enabled).length;

  // Column selector dropdown
  const [colSelector, setColSelector] = useState<{ ruleKey: string; side: 'src' | 'tgt' } | null>(null);
  const colSelectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colSelector) return;
    const h = (e: MouseEvent) => {
      if (colSelectorRef.current && !colSelectorRef.current.contains(e.target as Node))
        setColSelector(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [colSelector]);

  // Picker + Builder
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setPickerOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pickerOpen]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [builderData, setBuilderData] = useState<{
    type: ToleranceCompareType | null;
    srcCol: string | null;
    srcFile: string | null;
    srcDot: ToleranceDot | null;
    tgtCol: string | null;
    tgtFile: string | null;
    tgtDot: ToleranceDot | null;
    threshold: string | null;
    name: string;
  }>({
    type: null,
    srcCol: null,
    srcFile: null,
    srcDot: null,
    tgtCol: null,
    tgtFile: null,
    tgtDot: null,
    threshold: null,
    name: '',
  });

  const resetBuilder = () => {
    setBuilderOpen(false);
    setBuilderStep(1);
    setBuilderData({
      type: null,
      srcCol: null,
      srcFile: null,
      srcDot: null,
      tgtCol: null,
      tgtFile: null,
      tgtDot: null,
      threshold: null,
      name: '',
    });
  };

  // ── Column binding renderer ──────────────────────────────────────────
  const renderColBinding = (
    ruleKey: string,
    columns: ToleranceColumns,
    colType: ToleranceCompareType,
    onChange: (c: ToleranceColumns) => void,
  ) => {
    const sources = tolColumnsByType[colType];
    const optionsForSide = (side: 'src' | 'tgt') =>
      Object.entries(sources)
        .filter(([k]) => (side === 'src' ? k.startsWith('src') : k.startsWith('tgt')))
        .flatMap(([, s]) => s.cols.map((col) => ({ col, file: s.file, dot: s.dot })));

    const pill = (side: 'src' | 'tgt') => {
      const col = side === 'src' ? columns.src : columns.tgt;
      const dot = side === 'src' ? columns.srcDot : columns.tgtDot;
      const file = side === 'src' ? columns.srcFile : columns.tgtFile;
      const isOpen = colSelector?.ruleKey === ruleKey && colSelector?.side === side;
      const options = optionsForSide(side);
      return (
        <div className="relative min-w-0" ref={isOpen ? colSelectorRef : null}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setColSelector(isOpen ? null : { ruleKey, side });
            }}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-700 bg-canvas-elevated border border-canvas-border rounded-md px-2 py-1 hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer group w-full min-w-0"
          >
            <span
              className="w-[5px] h-[5px] rounded-full shrink-0"
              style={{ background: dotColors[dot] }}
            />
            <span className="truncate flex-1 text-left">{col}</span>
            <ChevronDown size={10} className="text-ink-300 group-hover:text-brand-500 shrink-0" />
          </button>
          {isOpen && (
            <div
              className={`absolute top-full ${side === 'tgt' ? 'right-0' : 'left-0'} mt-1 w-[190px] max-w-[calc(100vw-32px)] bg-canvas-elevated border border-canvas-border rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto`}
            >
              {options.map((opt) => {
                const selected = col === opt.col && file === opt.file;
                return (
                  <button
                    key={`${opt.file}-${opt.col}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const upd =
                        side === 'src'
                          ? { src: opt.col, srcFile: opt.file, srcDot: opt.dot }
                          : { tgt: opt.col, tgtFile: opt.file, tgtDot: opt.dot };
                      onChange({ ...columns, ...upd });
                      setColSelector(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-[12px] flex items-center gap-1.5 transition-colors ${selected ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-ink-600 hover:bg-canvas'}`}
                  >
                    <span
                      className="w-[5px] h-[5px] rounded-full shrink-0"
                      style={{ background: dotColors[opt.dot] }}
                    />
                    <span className="flex-1 truncate">{opt.col}</span>
                    <span className="text-[12px] text-ink-400 truncate max-w-[70px]">{opt.file}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    };
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-400">
            Applied to
          </span>
          <span className="text-[12px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
            AI
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 px-2 py-1.5 rounded-lg bg-canvas">
          {pill('src')}
          <span className="text-[12px] text-ink-400 font-semibold">vs</span>
          {pill('tgt')}
        </div>
      </div>
    );
  };

  // ── Toggle subcomponent ──────────────────────────────────────────────
  const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <div className="relative w-8 h-[18px] shrink-0" onClick={(e) => e.stopPropagation()}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle();
        }}
        className="w-8 h-[18px] rounded-full transition-colors cursor-pointer"
        style={{ background: enabled ? '#6A12CD' : '#d1d5db' }}
      >
        <div
          className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm absolute top-[2px] transition-transform ${enabled ? 'translate-x-[17px]' : 'translate-x-[2px]'}`}
        />
      </div>
    </div>
  );

  // ── Card renderer for builtin rules ─────────────────────────────────
  const renderBuiltinCard = (key: ToleranceBuiltinId) => {
    const r = rules[key];
    const colType = ruleToColType[key];
    const sev = toleranceSeverity(key, r.val);
    const sevSt = severityStyle[sev];
    const tint = iconTint[key];

    const Icon =
      key === 'amt' ? DollarSign : key === 'date' ? CalendarDays : key === 'text' ? TypeIcon : Package;

    const label =
      key === 'amt' ? 'Amount' : key === 'date' ? 'Date' : key === 'text' ? 'Text similarity' : 'Quantity';

    let subtitle = '';
    if (key === 'amt') {
      const amt = r as ToleranceAmt;
      subtitle = amt.mode === 'absolute' ? `±$${amt.absVal.toLocaleString()}` : `±${amt.val}%`;
    } else if (key === 'date') {
      const dt = r as ToleranceDate;
      subtitle = `±${dt.val} ${dt.dayType === 'calendar' ? 'calendar' : 'business'} days`;
    } else if (key === 'text') {
      const tx = r as ToleranceText;
      subtitle = `≥${Math.round(tx.val)}% fuzzy match`;
    } else {
      const q = r as ToleranceQty;
      subtitle = q.mode === 'absolute' ? `±${q.unitVal} units` : `±${q.val}%`;
    }

    return (
      <div
        className={`rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${r.enabled ? (r.expanded ? 'bg-canvas' : 'bg-transparent hover:bg-brand-50/30') : 'opacity-45'}`}
      >
        <div
          className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-brand-50/40 transition-colors"
          onClick={() => r.enabled && updateRule(key, { expanded: !r.expanded } as never)}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: tint.bg }}
          >
            <Icon size={13} style={{ color: tint.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-ink-800">{label}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[12px] text-ink-400">{subtitle}</span>
              <span
                className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: sevSt.bg, color: sevSt.color }}
              >
                {sevSt.label}
              </span>
            </div>
            {r.columns && r.enabled && !r.expanded && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 bg-canvas border border-canvas-border rounded px-1.5 py-0.5">
                  <span
                    className="w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ background: dotColors[r.columns.srcDot] }}
                  />
                  {r.columns.src}
                </span>
                <span className="text-[12px] text-ink-300 font-semibold">vs</span>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 bg-canvas border border-canvas-border rounded px-1.5 py-0.5">
                  <span
                    className="w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ background: dotColors[r.columns.tgtDot] }}
                  />
                  {r.columns.tgt}
                </span>
              </div>
            )}
          </div>
          <ChevronRight
            size={12}
            className={`text-ink-400 transition-transform duration-300 ${r.expanded ? 'rotate-90' : ''}`}
            style={r.expanded ? { color: '#6A12CD' } : undefined}
          />
          <Toggle
            enabled={r.enabled}
            onToggle={() =>
              updateRule(
                key,
                (r.enabled
                  ? { enabled: false, expanded: false }
                  : { enabled: true }) as Partial<ToleranceRules[typeof key]>,
              )
            }
          />
        </div>
        {r.enabled && r.expanded && (
          <div className="px-3 pb-3 border-t border-canvas-border">
            <div className="pt-3 space-y-3">
              {renderColBinding(key, r.columns, colType, (c) =>
                updateRule(key, { columns: c } as never),
              )}
              {key === 'amt' && <AmountControls r={r as ToleranceAmt} sevSt={sevSt} sevLabel={sevSt.label} onUpd={(p) => updateRule('amt', p)} />}
              {key === 'date' && <DateControls r={r as ToleranceDate} sevSt={sevSt} onUpd={(p) => updateRule('date', p)} />}
              {key === 'text' && <TextControls r={r as ToleranceText} sevSt={sevSt} onUpd={(p) => updateRule('text', p)} />}
              {key === 'qty' && <QtyControls r={r as ToleranceQty} sevSt={sevSt} onUpd={(p) => updateRule('qty', p)} />}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Impact preview samples ──────────────────────────────────────────
  const impactSamples = [
    { a: '$12,450', b: '$12,200', pct: '2.0%', type: 'amt' as const, typeLabel: 'AMT', diff: 2.0 },
    { a: 'Mar 15', b: 'Mar 19', pct: '4 days', type: 'date' as const, typeLabel: 'DATE', diff: 4 },
    { a: 'MSFT Corp', b: 'Microsoft', pct: '~72%', type: 'text' as const, typeLabel: 'TEXT', diff: 72 },
    { a: '$8,920', b: '$9,500', pct: '6.1%', type: 'amt' as const, typeLabel: 'AMT', diff: 6.1 },
    { a: '1,000', b: '996', pct: '0.4%', type: 'qty' as const, typeLabel: 'QTY', diff: 0.4 },
  ].filter((s) => rules[s.type].enabled);

  const statusFor = (
    type: ToleranceBuiltinId,
    diff: number,
  ): 'Pass' | 'Flag' | 'Fail' => {
    const v = rules[type].val;
    if (type === 'text') {
      if (diff >= v) return 'Pass';
      if (diff >= v - 10) return 'Flag';
      return 'Fail';
    }
    if (type === 'date') {
      if (diff <= v) return 'Pass';
      if (diff <= v + 2) return 'Flag';
      return 'Fail';
    }
    if (diff <= v) return 'Pass';
    if (diff <= v * 2) return 'Flag';
    return 'Fail';
  };

  return (
    <div className="rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-canvas-border">
        <SlidersHorizontal size={13} className="text-ink-400" />
        <span className="text-[12px] font-semibold text-ink-700 flex-1">Tolerance rules</span>
        <span className="text-[12px] font-semibold text-ink-400">{activeCount} active</span>
      </div>

      {/* Built-in rules */}
      <div className="p-2 space-y-1.5">
        {renderBuiltinCard('amt')}
        {renderBuiltinCard('date')}
        {renderBuiltinCard('text')}
        {visibleBuiltins.includes('qty') && renderBuiltinCard('qty')}
      </div>

      {/* Custom rules */}
      {customRules.length > 0 && (
        <div className="px-2 pb-1 space-y-1.5">
          {customRules.map((cr, ci) => {
            const st = tolTypeStyles[cr.cls] ?? tolTypeStyles.custom;
            return (
              <div
                key={cr.id}
                className={`rounded-lg overflow-hidden transition-all ${cr.enabled ? (cr.expanded ? 'bg-canvas' : 'bg-transparent hover:bg-brand-50/30') : 'opacity-45'}`}
              >
                <div
                  className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-brand-50/40 transition-colors"
                  onClick={() =>
                    cr.enabled &&
                    setCustomRules((prev) =>
                      prev.map((p, pi) => (pi === ci ? { ...p, expanded: !p.expanded } : p)),
                    )
                  }
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-semibold"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {cr.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink-800">{cr.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[12px] text-ink-400">{cr.threshold}</span>
                      <span
                        className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                        style={{ background: severityStyle.moderate.bg, color: severityStyle.moderate.color }}
                      >
                        Moderate
                      </span>
                    </div>
                    {cr.columns && !cr.expanded && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 bg-canvas border border-canvas-border rounded px-1.5 py-0.5">
                          <span
                            className="w-[5px] h-[5px] rounded-full shrink-0"
                            style={{ background: dotColors[cr.columns.srcDot] }}
                          />
                          {cr.columns.src}
                        </span>
                        <span className="text-[12px] text-ink-300 font-semibold">vs</span>
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 bg-canvas border border-canvas-border rounded px-1.5 py-0.5">
                          <span
                            className="w-[5px] h-[5px] rounded-full shrink-0"
                            style={{ background: dotColors[cr.columns.tgtDot] }}
                          />
                          {cr.columns.tgt}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={12}
                    className={`text-ink-400 transition-transform ${cr.expanded ? 'rotate-90' : ''}`}
                    style={cr.expanded ? { color: '#6A12CD' } : undefined}
                  />
                  <Toggle
                    enabled={cr.enabled}
                    onToggle={() =>
                      setCustomRules((prev) =>
                        prev.map((p, pi) =>
                          pi === ci ? { ...p, enabled: !p.enabled, expanded: p.enabled ? false : p.expanded } : p,
                        ),
                      )
                    }
                  />
                </div>
                {cr.enabled && cr.expanded && cr.columns && (
                  <div className="px-3 pb-3 border-t border-canvas-border">
                    <div className="pt-3 space-y-3">
                      {renderColBinding(
                        `custom-${ci}`,
                        cr.columns,
                        cr.type,
                        (newCols) =>
                          setCustomRules((prev) =>
                            prev.map((p, pi) => (pi === ci ? { ...p, columns: newCols } : p)),
                          ),
                      )}
                      <div className="text-[13px] font-semibold text-center py-2 text-brand-700">
                        {cr.threshold}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Builder wizard */}
      {builderOpen && (
        <div
          className="mx-2 mb-2 border-[1.5px] rounded-xl overflow-hidden"
          style={{ borderColor: '#6A12CD' }}
        >
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 border-b"
            style={{ background: 'rgba(106,18,205,0.06)', borderColor: 'rgba(106,18,205,0.15)' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: '#6A12CD' }}
            >
              <Plus size={12} color="#fff" />
            </div>
            <span className="text-[13px] font-semibold flex-1 text-ink-900">Build custom rule</span>
            <button
              type="button"
              onClick={resetBuilder}
              className="w-6 h-6 rounded-md text-ink-400 hover:bg-canvas hover:text-ink-700 flex items-center justify-center cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          <div className="px-3 py-3">
            {/* Step dots */}
            <div className="flex items-center gap-1.5 mb-3.5">
              {[1, 2, 3, 4].map((s) => (
                <Fragment key={s}>
                  <div
                    className="w-2 h-2 rounded-full transition-all"
                    style={
                      s < builderStep
                        ? { background: '#6A12CD' }
                        : s === builderStep
                          ? { background: '#6A12CD', boxShadow: '0 0 0 3px rgba(106,18,205,0.15)' }
                          : { background: '#e2e8f0' }
                    }
                  />
                  {s < 4 && (
                    <div
                      className="flex-1 h-px transition-colors"
                      style={{ background: s < builderStep ? '#6A12CD' : '#e2e8f0' }}
                    />
                  )}
                </Fragment>
              ))}
            </div>

            {/* Step 1: Type */}
            {builderStep === 1 && (
              <div>
                <div className="text-[13px] font-semibold text-ink-800 mb-1">
                  What type of comparison?
                </div>
                <div className="text-[12px] text-ink-400 mb-3 leading-relaxed">
                  This determines how variance is calculated between columns.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'numeric', icon: '123', iconComp: null, label: 'Numeric', desc: '% or absolute difference' },
                      { id: 'date', icon: null, iconComp: CalendarDays, label: 'Date', desc: 'Days between values' },
                      { id: 'text', icon: 'Aa', iconComp: null, label: 'Text', desc: 'Fuzzy similarity score' },
                      { id: 'exact', icon: '==', iconComp: null, label: 'Exact match', desc: 'Values must be identical' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setBuilderData((prev) => ({
                          ...prev,
                          type: t.id,
                          srcCol: null,
                          tgtCol: null,
                        }))
                      }
                      className="border rounded-lg p-2.5 text-center transition-all cursor-pointer"
                      style={
                        builderData.type === t.id
                          ? {
                              borderColor: '#6A12CD',
                              background: 'rgba(106,18,205,0.06)',
                              boxShadow: '0 0 0 2px rgba(106,18,205,0.12)',
                            }
                          : { borderColor: '#e2e8f0' }
                      }
                    >
                      <div className="text-lg mb-1 text-ink-700">
                        {t.iconComp ? <t.iconComp size={20} className="mx-auto" /> : t.icon}
                      </div>
                      <div className="text-[12px] font-semibold text-ink-800">{t.label}</div>
                      <div className="text-[12px] text-ink-400 mt-0.5 leading-snug">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Columns */}
            {builderStep === 2 && builderData.type && (
              <div>
                <div className="text-[13px] font-semibold text-ink-800 mb-1">
                  Which columns to compare?
                </div>
                <div className="text-[12px] text-ink-400 mb-3">
                  Pick one source and one target column.
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wide mb-1.5">
                      Source column
                    </div>
                    {(['src1', 'src2'] as const).map((key) => {
                      const grp = tolColumnsByType[builderData.type!][key];
                      if (!grp) return null;
                      return (
                        <div key={key} className="mb-2">
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 mb-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: dotColors[grp.dot] }}
                            />
                            {grp.file}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-3">
                            {grp.cols.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setBuilderData((prev) => ({
                                    ...prev,
                                    srcCol: c,
                                    srcFile: grp.file,
                                    srcDot: grp.dot,
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all cursor-pointer"
                                style={
                                  builderData.srcCol === c
                                    ? {
                                        borderColor: '#6A12CD',
                                        background: 'rgba(106,18,205,0.06)',
                                        color: '#6A12CD',
                                      }
                                    : { borderColor: '#e2e8f0', color: '#64748b' }
                                }
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wide mb-1.5">
                      Target column
                    </div>
                    {(() => {
                      const grp = tolColumnsByType[builderData.type!].tgt1;
                      return (
                        <div>
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 mb-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: dotColors[grp.dot] }}
                            />
                            {grp.file}
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-3">
                            {grp.cols.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setBuilderData((prev) => ({
                                    ...prev,
                                    tgtCol: c,
                                    tgtFile: grp.file,
                                    tgtDot: grp.dot,
                                  }))
                                }
                                className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all cursor-pointer"
                                style={
                                  builderData.tgtCol === c
                                    ? {
                                        borderColor: '#6A12CD',
                                        background: 'rgba(106,18,205,0.06)',
                                        color: '#6A12CD',
                                      }
                                    : { borderColor: '#e2e8f0', color: '#64748b' }
                                }
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Threshold */}
            {builderStep === 3 && builderData.type && (
              <BuilderThresholdStep
                data={builderData}
                onChange={(patch) => setBuilderData((p) => ({ ...p, ...patch }))}
              />
            )}

            {/* Step 4: Name & confirm */}
            {builderStep === 4 && (
              <div>
                <div className="text-[13px] font-semibold text-ink-800 mb-1">Name this rule</div>
                <div className="text-[12px] text-ink-400 mb-3">
                  Give it a label your team will recognize.
                </div>
                <input
                  type="text"
                  value={builderData.name}
                  onChange={(e) => setBuilderData((p) => ({ ...p, name: e.target.value }))}
                  placeholder={`e.g. ${builderData.srcCol} vs ${builderData.tgtCol}`}
                  className="w-full px-3 py-2 border border-canvas-border rounded-lg text-[13px] font-semibold text-ink-800 outline-none focus:border-brand-400 transition-colors placeholder:text-ink-300"
                />
                <div className="flex items-center gap-1 mt-1.5 text-[12px] text-ink-400">
                  <Sparkles size={10} className="text-brand-600" />
                  <span>
                    Suggested: {builderData.srcCol} vs {builderData.tgtCol}
                  </span>
                </div>
                <div className="mt-3 rounded-lg p-3 bg-canvas">
                  <div className="flex items-center gap-2 text-[12px] py-1">
                    <span className="text-ink-400 min-w-[60px] font-semibold">Type</span>
                    <span className="text-ink-700 font-semibold">
                      {
                        { numeric: 'Numeric difference', date: 'Date gap', text: 'Text similarity', exact: 'Exact match' }[
                          builderData.type!
                        ]
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] py-1">
                    <span className="text-ink-400 min-w-[60px] font-semibold">Columns</span>
                    <span className="text-ink-700 font-semibold">
                      {builderData.srcCol} vs {builderData.tgtCol}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] py-1">
                    <span className="text-ink-400 min-w-[60px] font-semibold">Threshold</span>
                    <span className="text-ink-700 font-semibold">
                      {builderData.threshold ?? (builderData.type === 'exact' ? 'Exact' : '±5%')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-canvas-border">
              {builderStep > 1 && (
                <button
                  type="button"
                  onClick={() => setBuilderStep((s) => s - 1)}
                  className="inline-flex items-center gap-1 rounded-md text-[12px] font-semibold px-2.5 py-1.5 text-ink-600 bg-canvas hover:bg-canvas-border/40 border border-canvas-border transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}
              <span className="flex-1 text-center text-[12px] text-ink-400">
                Step {builderStep} of 4
              </span>
              <button
                type="button"
                disabled={
                  (builderStep === 1 && !builderData.type) ||
                  (builderStep === 2 && (!builderData.srcCol || !builderData.tgtCol)) ||
                  (builderStep === 4 && !builderData.name.trim())
                }
                onClick={() => {
                  if (builderStep < 4) {
                    if (builderStep === 2 && !builderData.threshold) {
                      const defaults: Record<ToleranceCompareType, string> = {
                        numeric: '5%',
                        date: '±3 days',
                        text: '≥80%',
                        exact: 'Exact',
                      };
                      setBuilderData((p) => ({
                        ...p,
                        threshold: defaults[p.type ?? 'numeric'],
                      }));
                    }
                    if (builderStep === 3 && !builderData.name) {
                      setBuilderData((p) => ({
                        ...p,
                        name: `${p.srcCol} vs ${p.tgtCol}`,
                      }));
                    }
                    setBuilderStep((s) => s + 1);
                  } else {
                    const d = builderData;
                    const typeIcons: Record<ToleranceCompareType, string> = {
                      numeric: '123',
                      date: '📅',
                      text: 'Aa',
                      exact: '==',
                    };
                    setCustomRules((prev) => [
                      ...prev,
                      {
                        id: `custom-${Date.now()}`,
                        name: d.name || `${d.srcCol} vs ${d.tgtCol}`,
                        icon: typeIcons[d.type!] ?? '?',
                        cls: 'custom',
                        type: d.type!,
                        threshold: d.threshold ?? 'Exact',
                        columns:
                          d.srcCol && d.srcFile && d.srcDot && d.tgtCol && d.tgtFile && d.tgtDot
                            ? {
                                src: d.srcCol,
                                srcFile: d.srcFile,
                                srcDot: d.srcDot,
                                tgt: d.tgtCol,
                                tgtFile: d.tgtFile,
                                tgtDot: d.tgtDot,
                              }
                            : null,
                        enabled: true,
                        expanded: false,
                      },
                    ]);
                    resetBuilder();
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md text-[12px] font-semibold px-2.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white disabled:bg-brand-100 disabled:text-brand-300 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {builderStep === 4 ? 'Create rule' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add tolerance parameter picker */}
      {!builderOpen && (
        <div className="px-2 pb-2 relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => {
              setPickerOpen(!pickerOpen);
              setPickerSearch('');
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-[1.5px] border-dashed rounded-xl text-[12px] font-semibold transition-all cursor-pointer"
            style={
              pickerOpen
                ? {
                    borderColor: '#6A12CD',
                    color: '#6A12CD',
                    background: 'rgba(106,18,205,0.04)',
                    borderStyle: 'solid',
                  }
                : { borderColor: 'rgba(0,0,0,0.18)', color: '#9a9a9a' }
            }
          >
            <Plus
              size={12}
              className={`transition-transform ${pickerOpen ? 'rotate-45' : ''}`}
            />
            {pickerOpen ? 'Close' : 'Add tolerance parameter'}
          </button>
          {pickerOpen && (
            <div className="mt-2 border border-canvas-border rounded-xl bg-canvas-elevated shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-canvas-border">
                <Search size={12} className="text-ink-400" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search parameters…"
                  className="flex-1 text-[12px] bg-transparent outline-none text-ink-700 placeholder:text-ink-300"
                  autoFocus
                />
              </div>
              {(() => {
                const filtered = tolPresets.filter(
                  (p) =>
                    (!p.builtin || !visibleBuiltins.includes(p.builtin)) &&
                    (!pickerSearch ||
                      p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
                      p.desc.toLowerCase().includes(pickerSearch.toLowerCase())),
                );
                return filtered.length > 0 ? (
                  <div className="py-1 border-b border-canvas-border">
                    <div className="text-[12px] font-bold text-ink-400 uppercase tracking-wide px-3 py-1">
                      Preconfigured
                    </div>
                    {filtered.map((p) => {
                      const st = tolTypeStyles[p.cls] ?? tolTypeStyles.custom;
                      return (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (p.builtin) {
                              setVisibleBuiltins((prev) => [...prev, p.builtin!]);
                              updateRule(p.builtin, { enabled: true, expanded: false } as never);
                            } else {
                              setCustomRules((prev) => [
                                ...prev,
                                {
                                  id: `${p.id}-${Date.now()}`,
                                  name: p.name,
                                  icon: p.icon,
                                  cls: p.cls,
                                  type: p.type,
                                  threshold: p.threshold,
                                  columns: p.columns,
                                  enabled: true,
                                  expanded: false,
                                },
                              ]);
                            }
                            setPickerOpen(false);
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-canvas transition-colors"
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-semibold shrink-0"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {p.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-ink-700 flex items-center gap-1">
                              {p.name}
                              {p.tag && (
                                <span
                                  className="text-[12px] font-bold ml-0.5 px-1.5 py-0.5 rounded"
                                  style={
                                    p.tagType === 'rec'
                                      ? { background: 'rgba(106,18,205,0.08)', color: '#6A12CD' }
                                      : { background: '#E1F5EE', color: '#0F6E56' }
                                  }
                                >
                                  {p.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-ink-400 mt-0.5">{p.desc}</div>
                          </div>
                          <span
                            className="text-[12px] font-semibold px-2 py-1 rounded-md"
                            style={{ background: 'rgba(106,18,205,0.08)', color: '#6A12CD' }}
                          >
                            Add
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setPickerOpen(false);
                  setBuilderOpen(true);
                  setBuilderStep(1);
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-brand-50/30 transition-colors bg-canvas/60 border-t border-canvas-border"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#F5F0FF', color: '#6A12CD' }}
                >
                  <Pencil size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-ink-700">Custom rule</div>
                  <div className="text-[12px] text-ink-400 mt-0.5">
                    Build your own tolerance parameter from scratch
                  </div>
                </div>
                <span
                  className="text-[12px] font-semibold px-2 py-1 rounded-md"
                  style={{ background: 'rgba(106,18,205,0.08)', color: '#6A12CD' }}
                >
                  Build
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Impact preview */}
      {activeCount > 0 && impactSamples.length > 0 && (
        <div className="px-3 pb-3">
          <div className="border-t border-canvas-border pt-3">
            <p className="text-[12px] font-bold text-ink-400 uppercase tracking-wider mb-2">
              Impact preview — sample matches
            </p>
            <div className="space-y-0.5">
              {impactSamples.map(({ a, b, pct, type, typeLabel, diff }, i) => {
                const status = statusFor(type, diff);
                const statusColor =
                  status === 'Pass' ? '#0F6E56' : status === 'Flag' ? '#D97300' : '#DC2626';
                const tc = iconTint[type];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 py-1.5 border-b border-canvas-border/60 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0 text-[12px] text-ink-500">
                      <span className="font-semibold text-ink-700">{a}</span>
                      <span className="mx-1">vs</span>
                      <span className="font-semibold text-ink-700">{b}</span>
                      <span className="text-ink-400 ml-1 text-[12px]">{pct}</span>
                    </div>
                    <span
                      className="text-[12px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide"
                      style={{ background: tc.bg, color: tc.color }}
                    >
                      {typeLabel}
                    </span>
                    <span
                      className="text-[12px] font-bold min-w-[28px] text-right"
                      style={{ color: statusColor }}
                    >
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expanded controls ───────────────────────────────────────────────

function AmountControls({
  r,
  sevSt,
  onUpd,
}: {
  r: ToleranceAmt;
  sevSt: { bg: string; color: string; label: string };
  sevLabel?: string;
  onUpd: (p: Partial<ToleranceAmt>) => void;
}) {
  return (
    <>
      <div className="flex rounded-lg border border-canvas-border overflow-hidden">
        {(['Percentage', 'Absolute'] as const).map((m) => {
          const val = m.toLowerCase() as ToleranceAmt['mode'];
          const active = r.mode === val;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onUpd({ mode: val })}
              className="flex-1 py-1.5 text-[12px] font-semibold transition-all cursor-pointer"
              style={
                active
                  ? { background: '#6A12CD', color: '#fff' }
                  : { background: '#fff', color: '#94a3b8' }
              }
            >
              {m}
            </button>
          );
        })}
      </div>
      {r.mode === 'percentage' ? (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[18px] font-bold tabular-nums min-w-[40px] text-brand-700">
              {r.val}%
            </span>
            <span
              className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ background: sevSt.bg, color: sevSt.color }}
            >
              {sevSt.label}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={r.val}
            onChange={(e) => onUpd({ val: parseFloat(e.target.value) })}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:border-[2px] [&::-webkit-slider-thumb]:border-white"
            style={{
              background:
                'linear-gradient(to right, rgba(220,38,38,0.18), rgba(183,137,0,0.18), rgba(15,110,86,0.18))',
            }}
          />
          <div className="flex justify-between mt-1">
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
            >
              0% Strict
            </span>
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}
            >
              20% Relaxed
            </span>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[12px] text-ink-500 font-semibold mb-2">
            Maximum allowed difference
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center flex-1 border border-canvas-border rounded-lg overflow-hidden focus-within:border-brand-400/50 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
              <span className="text-[12px] font-semibold text-ink-400 pl-3 pr-1 select-none">$</span>
              <input
                type="number"
                min={0}
                step={50}
                value={r.absVal}
                onChange={(e) =>
                  onUpd({ absVal: Math.max(0, Number(e.target.value) || 0) })
                }
                className="flex-1 py-2 pr-3 text-[13px] font-semibold bg-transparent outline-none tabular-nums text-brand-700"
              />
            </div>
            <span
              className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{
                background:
                  r.absVal <= 100
                    ? severityStyle.strict.bg
                    : r.absVal <= 1000
                      ? severityStyle.moderate.bg
                      : severityStyle.relaxed.bg,
                color:
                  r.absVal <= 100
                    ? severityStyle.strict.color
                    : r.absVal <= 1000
                      ? severityStyle.moderate.color
                      : severityStyle.relaxed.color,
              }}
            >
              {r.absVal <= 100 ? 'Strict' : r.absVal <= 1000 ? 'Moderate' : 'Relaxed'}
            </span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[100, 500, 1000, 5000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onUpd({ absVal: v })}
                className="flex-1 py-1 text-[12px] font-semibold rounded-md border transition-all cursor-pointer"
                style={
                  r.absVal === v
                    ? {
                        background: 'rgba(106,18,205,0.06)',
                        color: '#6A12CD',
                        borderColor: 'rgba(106,18,205,0.2)',
                      }
                    : { background: '#fff', color: '#94a3b8', borderColor: '#e2e8f0' }
                }
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DateControls({
  r,
  sevSt,
  onUpd,
}: {
  r: ToleranceDate;
  sevSt: { bg: string; color: string; label: string };
  onUpd: (p: Partial<ToleranceDate>) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onUpd({ val: Math.max(0, r.val - 1) })}
          className="w-8 h-8 rounded-md border border-canvas-border text-ink-600 hover:bg-canvas flex items-center justify-center text-lg active:scale-95 cursor-pointer"
        >
          −
        </button>
        <span className="text-2xl font-bold tabular-nums min-w-[44px] text-center text-brand-700">
          {r.val}
        </span>
        <button
          type="button"
          onClick={() => onUpd({ val: Math.min(30, r.val + 1) })}
          className="w-8 h-8 rounded-md border border-canvas-border text-ink-600 hover:bg-canvas flex items-center justify-center text-lg active:scale-95 cursor-pointer"
        >
          +
        </button>
        <span className="text-[13px] text-ink-400 ml-1">days</span>
        <span
          className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ml-2"
          style={{ background: sevSt.bg, color: sevSt.color }}
        >
          {sevSt.label}
        </span>
      </div>
      <div className="flex rounded-lg border border-canvas-border overflow-hidden max-w-[220px] mx-auto">
        {(['Calendar', 'Business'] as const).map((m) => {
          const val = m.toLowerCase() as ToleranceDate['dayType'];
          const active = r.dayType === val;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onUpd({ dayType: val })}
              className="flex-1 py-1.5 text-[12px] font-semibold transition-all cursor-pointer"
              style={
                active
                  ? { background: '#6A12CD', color: '#fff' }
                  : { background: '#fff', color: '#94a3b8' }
              }
            >
              {m}
            </button>
          );
        })}
      </div>
    </>
  );
}

function TextControls({
  r,
  sevSt,
  onUpd,
}: {
  r: ToleranceText;
  sevSt: { bg: string; color: string; label: string };
  onUpd: (p: Partial<ToleranceText>) => void;
}) {
  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[18px] font-bold tabular-nums min-w-[40px] text-brand-700">
            {Math.round(r.val)}%
          </span>
          <span
            className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            style={{ background: sevSt.bg, color: sevSt.color }}
          >
            {sevSt.label}
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={1}
          value={r.val}
          onChange={(e) => onUpd({ val: parseInt(e.target.value) })}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:border-[2px] [&::-webkit-slider-thumb]:border-white"
          style={{
            background:
              'linear-gradient(to right, rgba(15,110,86,0.18), rgba(183,137,0,0.18), rgba(220,38,38,0.18))',
          }}
        />
        <div className="flex justify-between mt-1">
          <span
            className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}
          >
            50% Relaxed
          </span>
          <span
            className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
          >
            100% Strict
          </span>
        </div>
      </div>
      <div>
        <p className="text-[12px] text-ink-500 font-semibold mb-1.5">Normalize before matching</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: 'ignoreCase', label: 'Ignore case' },
              { key: 'trimSpaces', label: 'Trim spaces' },
              { key: 'stripSpecial', label: 'Strip special chars' },
              { key: 'removePrefixes', label: 'Remove prefixes' },
            ] as const
          ).map(({ key, label }) => {
            const on = r.normalize[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => onUpd({ normalize: { ...r.normalize, [key]: !on } })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all cursor-pointer"
                style={
                  on
                    ? {
                        background: 'rgba(106,18,205,0.06)',
                        color: '#6A12CD',
                        borderColor: 'rgba(106,18,205,0.2)',
                      }
                    : { background: '#fff', color: '#94a3b8', borderColor: '#e2e8f0' }
                }
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: on ? '#6A12CD' : '#cbd5e1' }}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function QtyControls({
  r,
  sevSt,
  onUpd,
}: {
  r: ToleranceQty;
  sevSt: { bg: string; color: string; label: string };
  onUpd: (p: Partial<ToleranceQty>) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[18px] font-bold tabular-nums min-w-[40px] text-brand-700">
          {r.val}%
        </span>
        <span
          className="text-[12px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
          style={{ background: sevSt.bg, color: sevSt.color }}
        >
          {sevSt.label}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={r.val}
        onChange={(e) => onUpd({ val: parseFloat(e.target.value) })}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-[#6A12CD] [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-white"
        style={{
          background:
            'linear-gradient(to right, rgba(220,38,38,0.18), rgba(183,137,0,0.18), rgba(15,110,86,0.18))',
        }}
      />
    </div>
  );
}

function BuilderThresholdStep({
  data,
  onChange,
}: {
  data: {
    type: ToleranceCompareType | null;
    srcCol: string | null;
    tgtCol: string | null;
    threshold: string | null;
  };
  onChange: (patch: { threshold: string }) => void;
}) {
  const title =
    data.type === 'exact'
      ? 'Exact match — no threshold needed'
      : data.type === 'text'
        ? 'Minimum similarity score'
        : data.type === 'date'
          ? 'Acceptable date gap'
          : 'Acceptable numeric variance';

  const subtitle =
    data.type === 'exact'
      ? `${data.srcCol} must equal ${data.tgtCol} exactly.`
      : `How much can ${data.srcCol} differ from ${data.tgtCol}?`;

  const numericMatch = data.threshold?.match(/\d+(\.\d+)?/);
  const numericVal = numericMatch ? parseFloat(numericMatch[0]) : 5;

  return (
    <div>
      <div className="text-[13px] font-semibold text-ink-800 mb-1">{title}</div>
      <div className="text-[12px] text-ink-400 mb-3">{subtitle}</div>
      {data.type === 'numeric' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[18px] font-bold text-brand-700">{data.threshold ?? '5%'}</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            defaultValue={5}
            onChange={(e) => onChange({ threshold: `${e.target.value}%` })}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:border-[2px] [&::-webkit-slider-thumb]:border-white"
            style={{
              background:
                'linear-gradient(to right, rgba(220,38,38,0.18), rgba(183,137,0,0.18), rgba(15,110,86,0.18))',
            }}
          />
          <div className="flex justify-between mt-1">
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
            >
              0% Strict
            </span>
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}
            >
              20% Relaxed
            </span>
          </div>
        </div>
      )}
      {data.type === 'date' && (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() =>
              onChange({ threshold: `±${Math.max(0, numericVal - 1)} days` })
            }
            className="w-8 h-8 rounded-md border border-canvas-border text-ink-600 hover:bg-canvas flex items-center justify-center text-lg cursor-pointer"
          >
            −
          </button>
          <span className="text-2xl font-bold tabular-nums min-w-[44px] text-center text-brand-700">
            {numericMatch ? numericMatch[0] : '3'}
          </span>
          <button
            type="button"
            onClick={() =>
              onChange({ threshold: `±${Math.min(30, numericVal + 1)} days` })
            }
            className="w-8 h-8 rounded-md border border-canvas-border text-ink-600 hover:bg-canvas flex items-center justify-center text-lg cursor-pointer"
          >
            +
          </button>
          <span className="text-[13px] text-ink-400 ml-1">days</span>
        </div>
      )}
      {data.type === 'text' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[18px] font-bold text-brand-700">
              {data.threshold ?? '≥80%'}
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            defaultValue={80}
            onChange={(e) => onChange({ threshold: `≥${e.target.value}%` })}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:border-[2px] [&::-webkit-slider-thumb]:border-white"
            style={{
              background:
                'linear-gradient(to right, rgba(15,110,86,0.18), rgba(183,137,0,0.18), rgba(220,38,38,0.18))',
            }}
          />
          <div className="flex justify-between mt-1">
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}
            >
              50% Relaxed
            </span>
            <span
              className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
            >
              100% Strict
            </span>
          </div>
        </div>
      )}
      {data.type === 'exact' && (
        <div className="text-center py-4">
          <span className="text-2xl font-bold block mb-1 text-brand-700">==</span>
          <span className="text-[12px] text-ink-500">
            Values must be identical. Any difference → Flag.
          </span>
        </div>
      )}
    </div>
  );
}
