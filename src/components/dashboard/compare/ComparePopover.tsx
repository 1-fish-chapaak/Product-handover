import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarRange, ChevronDown, ChevronUp, Columns2, Layers, Tags, X } from 'lucide-react';
import DatePicker from '../../shared/DatePicker';
import { FormSelect } from '../../shared/FilterSelect';
import { ToolbarChips } from '../../shared/ListToolbar';
import { dateExtent, distinctValues } from '../model/joinEngine';
import type { ModelTable } from '../model/relationshipTypes';
import { SideSwatch } from './CompareChip';
import PolarityEditor, { type PolarityMetric } from './PolarityEditor';
import { periodColors } from './periodColors';
import {
  GRAIN_OPTIONS, MAX_PERIODS, PRESET_OPTIONS, countPeriods, daysIn, detectGrain, grainMeta, periodSide, periodsIn,
  presetRange, rangeLabel, sideRange, type DateRange, type Grain,
} from './comparePresets';
import { sameSide, type CompareChartMode, type CompareSide, type MetricKey, type PeriodSeries, type Polarity } from './compareTypes';

const FIELD_CLS = 'w-full h-8 px-2 rounded-md border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 focus:outline-none focus:border-brand-600';
const PRESET_CLS = (on: boolean) => `h-7 px-2.5 rounded-full border text-[0.75rem] font-medium whitespace-nowrap cursor-pointer transition-colors ${on ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-canvas-border bg-canvas-elevated text-ink-600 hover:border-brand-200'}`;

export interface ComparePopoverValue {
  a: CompareSide;
  b: CompareSide;
  chartMode: CompareChartMode;
  /** Set when the span resolves to more than two periods (series mode). */
  periods?: PeriodSeries;
}

export interface ComparePopoverProps {
  value: ComparePopoverValue;
  onApply: (v: ComparePopoverValue) => void;
  onClose: () => void;
  tables: ModelTable[];
  /** Today for the presets (the demo runs on a mock clock). */
  today?: Date;
  /** Polarity editing — omitted when the popover is scoped to one widget. */
  polarity?: { metrics: PolarityMetric[]; overrides: Record<MetricKey, Polarity>; onChange: (k: MetricKey, p: Polarity) => void; onReset: () => void };
  /** "Pin comparison · <widget>" instead of the dashboard title. */
  scopeTitle?: string;
  /** Which side to focus first (opened from a side chip). */
  focusSide?: 'a' | 'b';
  align?: 'left' | 'right';
}

type Kind = 'period' | 'entity';

/** One period's editor: presets + From/To. */
function PeriodSideField({ which, range, otherRange, today, bounds, onChange }: {
  which: 'a' | 'b'; range: DateRange; otherRange: DateRange; today: Date; bounds: { min: string; max: string }; onChange: (r: DateRange) => void;
}) {
  const presets = PRESET_OPTIONS.filter(p => p.forSide === 'both' || p.forSide === which);
  const isPreset = (id: typeof presets[number]['id']) => { const r = presetRange(id, today, otherRange); return r.from === range.from && r.to === range.to; };
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500"><SideSwatch side={which} /> Period {which.toUpperCase()}</span>
        <span className="text-[0.6875rem] text-ink-400 tabular-nums">{rangeLabel(range)} · {daysIn(range)} days</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {presets.map(p => (
          <button key={p.id} type="button" aria-pressed={isPreset(p.id)} onClick={() => onChange(presetRange(p.id, today, otherRange))} className={PRESET_CLS(isPreset(p.id))}>{p.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[0.75rem] font-medium text-ink-500 mb-1">From</span>
          <DatePicker value={range.from} max={range.to} min={bounds.min} today={today} onChange={e => onChange({ ...range, from: e.target.value })} className={FIELD_CLS} aria-label={`Period ${which.toUpperCase()} from`} />
        </label>
        <label className="block">
          <span className="block text-[0.75rem] font-medium text-ink-500 mb-1">To</span>
          <DatePicker value={range.to} min={range.from} max={bounds.max} today={today} onChange={e => onChange({ ...range, to: e.target.value })} className={FIELD_CLS} aria-label={`Period ${which.toUpperCase()} to`} />
        </label>
      </div>
    </div>
  );
}

const dayText = (r: DateRange) => { const n = daysIn(r); return `${n} ${n === 1 ? 'day' : 'days'}`; };

/** A resolved side, read-only: the swatch, the period's name, its length. */
function PeriodSummaryRow({ which, range }: { which: 'a' | 'b'; range: DateRange }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="inline-flex items-baseline gap-1.5 min-w-0">
        <SideSwatch side={which} />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500">{which.toUpperCase()}</span>
        <span className="text-[0.8125rem] font-semibold text-ink-900 truncate">{rangeLabel(range)}</span>
      </span>
      <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{dayText(range)}</span>
    </div>
  );
}

/**
 * Where A and B are chosen. Two kinds — time periods or entity values — plus
 * the chart mode and (dashboard-scoped only) the polarity editor. Non-modal
 * dialog; Escape / outside click cancel; Apply commits.
 *
 * Time periods asks for one date and the view to read it in (Daily … Yearly):
 * B is the period that date falls in, A the one before it. Custom opens the
 * two From/To editors for anything those five cannot express.
 */
export default function ComparePopover({ value, onApply, onClose, tables, today = new Date(), polarity, scopeTitle, focusSide, align = 'right' }: ComparePopoverProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const initialKind: Kind = value.a.kind === 'entity' ? 'entity' : 'period';
  const [kind, setKind] = useState<Kind>(initialKind);
  const [chartMode, setChartMode] = useState<CompareChartMode>(value.chartMode);
  const [polarityOpen, setPolarityOpen] = useState(false);
  // Opening Polarity brings the list into view inside the scrolling body.
  const polarityRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (polarityOpen) polarityRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }, [polarityOpen, reduce]);

  // Period drafts. The simple path is one span + a view: the span is sliced
  // into whole periods and every one becomes a side, so widening the range or
  // coarsening the view is the only thing to adjust. Custom keeps its own two
  // ranges, seeded from whatever the view last resolved to.
  // A widget pin stays two-sided (the override type has an A and a B).
  const allowSeries = !scopeTitle;
  const savedA = sideRange(value.a) ?? presetRange('last-month', today);
  const savedB = sideRange(value.b) ?? presetRange('this-month', today);
  const savedGrain = value.periods?.grain ?? detectGrain(savedA, savedB);
  const [grain, setGrain] = useState<Grain | 'custom'>(savedGrain ?? (value.a.kind === 'entity' ? 'month' : 'custom'));
  const [span, setSpan] = useState<DateRange>(() => (value.periods
    ? { from: value.periods.from, to: value.periods.to }
    : { from: savedA.from, to: savedB.to }));
  const [customA, setCustomA] = useState<DateRange>(savedA);
  const [customB, setCustomB] = useState<DateRange>(savedB);

  const grainNoun = grain === 'custom' ? '' : grainMeta(grain).noun;
  const grainPlural = grain === 'custom' ? '' : grainMeta(grain).plural;
  const periodCount = grain === 'custom' ? 2 : countPeriods(span, grain);
  const periodRanges = grain === 'custom' || periodCount > MAX_PERIODS ? [] : periodsIn(span, grain);
  const ra = grain === 'custom' ? customA : (periodRanges[0] ?? customA);
  const rb = grain === 'custom' ? customB : (periodRanges[periodRanges.length - 1] ?? customB);
  const seriesMode = grain !== 'custom' && periodRanges.length > 2;
  // A view that cannot be applied is a dead end unless we say which one can:
  // every other view's count over the same range, nearest first.
  const fits = grain === 'custom' || (periodCount >= 2 && periodCount <= MAX_PERIODS);
  const alternatives = useMemo(() => {
    if (grain === 'custom' || fits) return [];
    const here = GRAIN_OPTIONS.findIndex(g => g.id === grain);
    return GRAIN_OPTIONS
      .map((g, i) => ({ ...g, count: countPeriods(span, g.id), distance: Math.abs(i - here) }))
      .filter(g => g.id !== grain && g.count >= 2 && g.count <= MAX_PERIODS)
      .sort((x, y) => x.distance - y.distance)
      .slice(0, 3);
  }, [grain, fits, span]);
  const rampColors = periodColors(periodRanges.length);
  /** Switching view keeps what is on screen: Custom starts from the resolved pair. */
  const pickGrain = (g: Grain | 'custom') => {
    if (g === 'custom') { setCustomA(ra); setCustomB(rb); }
    setGrain(g);
  };
  // Pickers stop exactly where the data does: a span that ran past the last
  // dated row would add periods of zeroes and read as a collapse.
  const bounds = useMemo(() => dateExtent(tables) ?? { min: '2026-01-01', max: '2026-12-31' }, [tables]);

  // Entity drafts
  const dims = useMemo(() => tables.flatMap(t => t.columns.filter(c => c.role === 'dimension' && !c.isKey && c.type === 'string').map(c => ({ value: `${t.id}::${c.name}`, label: `${t.name} · ${c.label}` }))), [tables]);
  const initialDim = value.a.kind === 'entity' ? `${value.a.table}::${value.a.column}` : (dims.find(d => d.value === 'departments::Department')?.value ?? dims[0]?.value ?? '');
  const [dim, setDim] = useState(initialDim);
  const [table, column] = dim.split('::');
  const values = useMemo(() => (table && column ? distinctValues(tables, table, column).map(String) : []), [tables, table, column]);
  const [ea, setEa] = useState<string>(value.a.kind === 'entity' ? String(value.a.value) : '');
  const [eb, setEb] = useState<string>(value.b.kind === 'entity' ? String(value.b.value) : '');
  useEffect(() => { if (ea && !values.includes(ea)) setEa(''); if (eb && !values.includes(eb)) setEb(''); }, [values, ea, eb]);

  const draft: ComparePopoverValue | null = useMemo(() => {
    if (kind === 'period') {
      const periods: PeriodSeries | undefined = seriesMode ? { from: span.from, to: span.to, grain: grain as Grain } : undefined;
      return { a: periodSide(ra), b: periodSide(rb), chartMode, periods };
    }
    if (!table || !column || !ea || !eb) return null;
    return { a: { kind: 'entity', table, column, value: ea, label: ea }, b: { kind: 'entity', table, column, value: eb, label: eb }, chartMode };
  }, [kind, ra, rb, table, column, ea, eb, chartMode, seriesMode, span, grain]);

  const invalid = (() => {
    if (kind === 'period' && grain !== 'custom') {
      if (span.from > span.to) return 'The range starts after it ends.';
      if (periodCount > MAX_PERIODS) return `${periodCount.toLocaleString('en-IN')} ${grainPlural} — more than the ${MAX_PERIODS} that can be compared at once.`;
      if (periodCount < 2) return `One ${grainNoun} in this range — a comparison needs two.`;
      if (!allowSeries && periodCount > 2) return `A pinned widget compares two ${grainPlural} — narrow the range or pick a coarser view.`;
      return null;
    }
    if (!draft) return 'Choose a value for both A and B.';
    if (sameSide(draft.a, draft.b)) return 'A and B are the same — pick two different sides.';
    if (kind === 'period' && (ra.from > ra.to || rb.from > rb.to)) return 'A period’s start must be on or before its end.';
    return null;
  })();

  // Escape cancels; click outside cancels; first focus lands on the kind tabs / the asked side.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    // (DatePicker stops its own mousedown from reaching document, so picking a day never counts as "outside".)
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);
  useEffect(() => {
    // Opened from a side chip → that side's start date when it is on screen,
    // otherwise the one date the simple view asks for; plain open → the tabs.
    const chain = focusSide
      ? [`[aria-label="Period ${focusSide.toUpperCase()} from"]`, '[aria-label="Range start"]']
      : ['[role="tab"][aria-selected="true"]'];
    requestAnimationFrame(() => {
      for (const sel of chain) {
        const el = ref.current?.querySelector(sel) as HTMLElement | null;
        if (el) { el.focus(); return; }
      }
    });
  }, [focusSide]);

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-labelledby="compare-popover-title"
      initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: reduce ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
      className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-[26rem] max-w-[calc(100vw-2rem)] z-50 bg-canvas-elevated border border-canvas-border rounded-xl shadow-[0_8px_28px_-8px_rgb(15_8_30_/_0.22)] p-4 flex flex-col max-h-[calc(100vh-7rem)]`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="compare-popover-title" className="text-[0.8125rem] font-semibold text-ink-900 truncate">{scopeTitle ? `Pin comparison · ${scopeTitle}` : 'Compare'}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="size-7 rounded-md text-ink-400 hover:text-ink-800 hover:bg-canvas inline-flex items-center justify-center cursor-pointer"><X size={14} aria-hidden="true" /></button>
      </div>

      <ToolbarChips<Kind>
        size="sm" semantics="tabs" ariaLabel="What to compare" layoutId={`compare-kind-${scopeTitle ?? 'dashboard'}`}
        value={kind} onChange={setKind}
        options={[{ key: 'period', label: 'Time periods', icon: CalendarRange }, { key: 'entity', label: 'Entities', icon: Tags }]}
      />

      {/* The body scrolls (the Polarity list can be long); header and footer stay put. */}
      <div className="mt-3.5 space-y-3.5 overflow-y-auto min-h-0 flex-1 -mx-1 px-1">
        {kind === 'period' ? (
          <>
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-[0.75rem] font-medium text-ink-500">Compare across</span>
                {grain !== 'custom' && periodCount <= MAX_PERIODS && periodCount >= 1 && (
                  <span className="text-[0.6875rem] text-ink-400 tabular-nums">{periodCount} {periodCount === 1 ? grainNoun : grainPlural}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={span.from} max={span.to} min={bounds.min} today={today}
                  onChange={e => setSpan(s => ({ ...s, from: e.target.value }))}
                  className={FIELD_CLS} aria-label="Range start"
                />
                <DatePicker
                  value={span.to} min={span.from} max={bounds.max} today={today}
                  onChange={e => setSpan(s => ({ ...s, to: e.target.value }))}
                  className={FIELD_CLS} aria-label="Range end"
                />
              </div>
            </div>

            <div>
              <span className="block text-[0.75rem] font-medium text-ink-500 mb-1.5">View</span>
              <div role="group" aria-label="Comparison view" className="flex flex-wrap gap-1.5">
                {GRAIN_OPTIONS.map(g => (
                  <button key={g.id} type="button" aria-pressed={grain === g.id} onClick={() => pickGrain(g.id)} className={PRESET_CLS(grain === g.id)}>{g.label}</button>
                ))}
                <button type="button" aria-pressed={grain === 'custom'} onClick={() => pickGrain('custom')} className={PRESET_CLS(grain === 'custom')}>Custom</button>
              </div>
            </div>

            {grain !== 'custom' && !fits ? (
              <div className="rounded-lg border border-mitigated/30 bg-mitigated-50/60 px-3 py-2.5">
                <p className="text-[0.75rem] font-semibold text-mitigated-800">
                  {periodCount > MAX_PERIODS
                    ? `${periodCount.toLocaleString('en-IN')} ${grainPlural} is too many to compare`
                    : `This range is one ${grainNoun}`}
                </p>
                <p className="text-[0.6875rem] text-ink-500 leading-snug mt-0.5">
                  {periodCount > MAX_PERIODS
                    ? `A ${grainNoun} view of ${rangeLabel(span)} would draw ${periodCount.toLocaleString('en-IN')} series. Up to ${MAX_PERIODS} can be compared at once — take a coarser view, or shorten the range.`
                    : `A ${grainNoun} comparison needs at least two ${grainPlural}. Widen the range, or take a finer view.`}
                </p>
                {alternatives.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {alternatives.map(g => (
                      <button key={g.id} type="button" onClick={() => pickGrain(g.id)} className={PRESET_CLS(false)}>
                        {g.label} · {g.count} {g.count === 1 ? g.noun : g.plural}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : grain === 'custom' ? (
              <>
                <div className="border-t border-dashed border-canvas-border" />
                <PeriodSideField which="a" range={customA} otherRange={customB} today={today} bounds={bounds} onChange={setCustomA} />
                <div className="border-t border-dashed border-canvas-border" />
                <PeriodSideField which="b" range={customB} otherRange={customA} today={today} bounds={bounds} onChange={setCustomB} />
              </>
            ) : periodRanges.length > 2 ? (
              <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2.5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-500 mb-1.5">{periodRanges.length} periods</p>
                <div className="flex flex-wrap gap-1 max-h-[5.5rem] overflow-y-auto">
                  {periodRanges.map((r, i) => (
                    <span key={r.from} className="inline-flex items-center gap-1.5 rounded-full border border-canvas-border bg-canvas-elevated px-2 py-0.5 text-[0.6875rem] text-ink-600 tabular-nums whitespace-nowrap">
                      <span className="size-2 rounded-full shrink-0" style={{ background: rampColors[i] }} aria-hidden="true" />
                      {rangeLabel(r)}
                    </span>
                  ))}
                </div>
                <p className="text-[0.6875rem] text-ink-400 mt-2 pt-1.5 border-t border-canvas-border">
                  Every widget shows one series per {grainNoun}, oldest palest. Charts and tables scroll sideways when the span is long.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-canvas-border bg-canvas px-3 py-2.5 space-y-2">
                <PeriodSummaryRow which="a" range={ra} />
                <PeriodSummaryRow which="b" range={rb} />
                <p className="text-[0.6875rem] text-ink-400 pt-0.5 border-t border-canvas-border">Two {grainPlural} in this range: A is the earlier, B the later. Widen it to compare more.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="block">
              <span className="block text-[0.75rem] font-medium text-ink-500 mb-1">Dimension</span>
              <FormSelect value={dim} options={dims} onChange={v => { setDim(v); setEa(''); setEb(''); }} ariaLabel="Dimension to compare" className={FIELD_CLS} />
            </label>
            <div className={`grid grid-cols-2 gap-3 ${dim ? '' : 'opacity-50 pointer-events-none'}`}>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-500 mb-1"><SideSwatch side="a" /> A value</span>
                <FormSelect value={ea} options={values.filter(v => v !== eb)} onChange={setEa} ariaLabel="A value" className={FIELD_CLS} />
              </label>
              <label className="block">
                <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-ink-500 mb-1"><SideSwatch side="b" /> B value</span>
                <FormSelect value={eb} options={values.filter(v => v !== ea)} onChange={setEb} ariaLabel="B value" className={FIELD_CLS} />
              </label>
            </div>
          </>
        )}

        <div className="pt-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[0.75rem] font-medium text-ink-700">Charts</span>
            <ToolbarChips<CompareChartMode>
              size="sm" semantics="radio" ariaLabel="Chart mode" layoutId={`compare-mode-${scopeTitle ?? 'dashboard'}`}
              value={chartMode} onChange={setChartMode}
              options={[{ key: 'overlay', label: 'Overlay', icon: Layers }, { key: 'side-by-side', label: 'Side by side', icon: Columns2 }]}
            />
          </div>
          <span className="block text-[0.6875rem] text-ink-400 mt-1">Bars are always grouped; this applies to lines and areas.</span>
        </div>

        {polarity && (
          <div className="border-t border-canvas-border pt-3">
            <button type="button" onClick={() => setPolarityOpen(o => !o)} aria-expanded={polarityOpen} className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand-700 hover:underline cursor-pointer">
              Polarity{Object.keys(polarity.overrides).length ? ` · ${Object.keys(polarity.overrides).length} customised` : ''}
              {polarityOpen ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
            </button>
            <p className="text-[0.6875rem] text-ink-400 mt-0.5">Which direction counts as good, per metric — not every metric follows the same logic.</p>
            {polarityOpen && <div ref={polarityRef} className="mt-2"><PolarityEditor metrics={polarity.metrics} overrides={polarity.overrides} onChange={polarity.onChange} onReset={polarity.onReset} /></div>}
          </div>
        )}
      </div>

      <div className="border-t border-canvas-border pt-3 mt-4 flex items-center justify-between gap-3 shrink-0">
        <p className={`text-[0.6875rem] leading-snug ${invalid ? 'text-risk-700' : 'text-ink-400'} min-w-0`}>
          {invalid ?? (!draft ? '' : seriesMode
            ? `${periodRanges.length} ${grainPlural} · ${draft.a.label} – ${draft.b.label}`
            : `${draft.a.label} vs ${draft.b.label}`)}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-md text-[0.75rem] font-medium text-ink-600 hover:text-ink-900 hover:bg-canvas cursor-pointer">Cancel</button>
          <button type="button" disabled={!!invalid || !draft} onClick={() => draft && onApply(draft)} className="h-8 px-3 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-[0.75rem] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors">Apply</button>
        </div>
      </div>
    </motion.div>
  );
}
