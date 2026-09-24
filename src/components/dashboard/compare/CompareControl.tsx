import { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { GitCompareArrows } from 'lucide-react';
import type { ModelTable } from '../model/relationshipTypes';
import { CompareChip, CompareSeriesChip } from './CompareChip';
import { grainMeta, periodSidesOf } from './comparePresets';
import ComparePopover, { type ComparePopoverValue } from './ComparePopover';
import type { PolarityMetric } from './PolarityEditor';
import type { CompareConfig, MetricKey, Polarity } from './compareTypes';

/**
 * The header control. Off: a quiet "Compare" button. On: the A vs B chip with
 * swap and exit — or, when the comparison spans three periods or more, one chip
 * naming the span. Both open the popover; focus returns to whatever opened it.
 */
export default function CompareControl({ config, onChange, tables, metrics, today }: {
  config: CompareConfig;
  onChange: (next: CompareConfig) => void;
  tables: ModelTable[];
  metrics: PolarityMetric[];
  today?: Date;
}) {
  const [open, setOpen] = useState<null | { side?: 'a' | 'b' }>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const openFrom = (e: React.MouseEvent, side?: 'a' | 'b') => { openerRef.current = e.currentTarget as HTMLElement; setOpen({ side }); };
  const close = useCallback(() => { setOpen(null); requestAnimationFrame(() => openerRef.current?.focus()); }, []);
  const apply = (v: ComparePopoverValue) => { onChange({ ...config, enabled: true, a: v.a, b: v.b, chartMode: v.chartMode, periods: v.periods }); close(); };
  // Three periods or more: the pair of side chips gives way to one span chip.
  const seriesSides = config.periods ? periodSidesOf(config.periods) : [];
  const isSeries = seriesSides.length > 2;
  const setPolarity = (k: MetricKey, p: Polarity) => onChange({ ...config, polarity: { ...config.polarity, [k]: p } });
  const resetPolarity = () => onChange({ ...config, polarity: {} });

  return (
    <div ref={wrapRef} className="relative">
      {config.enabled && isSeries ? (
        <CompareSeriesChip
          count={seriesSides.length}
          grainLabel={grainMeta(config.periods!.grain).label.toLowerCase()}
          first={seriesSides[0].label}
          last={seriesSides[seriesSides.length - 1].label}
          onPick={() => { openerRef.current = wrapRef.current?.querySelector('[aria-label^="Change comparison:"]') as HTMLElement | null; setOpen({}); }}
          onExit={() => onChange({ ...config, enabled: false })}
        />
      ) : config.enabled ? (
        <CompareChip
          a={config.a} b={config.b}
          onPick={side => { openerRef.current = wrapRef.current?.querySelector(`[aria-label^="Change ${side.toUpperCase()}:"]`) as HTMLElement | null; setOpen({ side }); }}
          onSwap={() => onChange({ ...config, a: config.b, b: config.a })}
          onExit={() => onChange({ ...config, enabled: false })}
        />
      ) : (
        <button
          type="button"
          onClick={e => openFrom(e)}
          aria-label="Compare"
          aria-haspopup="dialog"
          aria-expanded={!!open}
          title="Compare two periods or entities across this dashboard"
          className={`flex items-center gap-1.5 px-2.5 h-9 border rounded-lg text-[0.75rem] font-medium transition-colors cursor-pointer ${open ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-canvas-border bg-canvas-elevated text-ink-500 hover:text-brand-600 hover:border-brand-200'}`}
        >
          <GitCompareArrows size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Compare</span>
        </button>
      )}
      <AnimatePresence>
        {open && (
          <ComparePopover
            key="compare-popover"
            value={{ a: config.a, b: config.b, chartMode: config.chartMode, periods: config.periods }}
            onApply={apply}
            onClose={close}
            tables={tables}
            today={today}
            focusSide={open.side}
            polarity={{ metrics, overrides: config.polarity, onChange: setPolarity, onReset: resetPolarity }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
