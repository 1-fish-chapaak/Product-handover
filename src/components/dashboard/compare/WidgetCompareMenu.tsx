import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Eye, EyeOff, GitCompareArrows, Link2, Pin } from 'lucide-react';
import type { ModelTable } from '../model/relationshipTypes';
import ComparePopover from './ComparePopover';
import type { CompareConfig, WidgetCompareOverride } from './compareTypes';

/**
 * The widget-level override, as a small section for the card menu: pin its
 * own A/B (opens the same popover, scoped), follow the dashboard again, or
 * exclude it. Rendered inside the card's existing menu.
 */
export default function WidgetCompareMenu({ override, dashboard, widgetTitle, comparable, tables, today, onChange, onClose }: {
  override?: WidgetCompareOverride;
  dashboard: CompareConfig;
  widgetTitle: string;
  /** False for widgets with no data model behind them. */
  comparable: boolean;
  tables: ModelTable[];
  today?: Date;
  onChange: (next?: WidgetCompareOverride) => void;
  onClose: () => void;
}) {
  const [pinOpen, setPinOpen] = useState(false);
  const mode = override?.mode ?? 'inherit';
  const item = 'w-full flex items-center gap-2 px-3 py-2 text-left text-[0.75rem] transition-colors';
  const on = 'text-ink-700 hover:bg-canvas cursor-pointer';
  const off = 'text-ink-300 cursor-not-allowed';
  if (!comparable) {
    return (
      <div className="border-t border-canvas-border pt-1 mt-1">
        <div className={`${item} ${off}`} title="This widget has no bound data model. Compare works on widgets built from the data model."><GitCompareArrows size={13} aria-hidden="true" /> Not comparable</div>
      </div>
    );
  }
  return (
    <div className="border-t border-canvas-border pt-1 mt-1 relative">
      <button type="button" className={`${item} ${on}`} onClick={() => setPinOpen(true)}>
        <Pin size={13} className="text-ink-400" aria-hidden="true" /> {mode === 'pin' ? 'Change pinned comparison…' : 'Pin comparison…'}
      </button>
      {mode === 'pin' && (
        <button type="button" className={`${item} ${on}`} onClick={() => { onChange(undefined); onClose(); }}>
          <Link2 size={13} className="text-ink-400" aria-hidden="true" /> Follow dashboard comparison
        </button>
      )}
      {mode === 'off' ? (
        <button type="button" className={`${item} ${on}`} onClick={() => { onChange(undefined); onClose(); }}>
          <Eye size={13} className="text-ink-400" aria-hidden="true" /> Include in comparison
        </button>
      ) : (
        <button type="button" className={`${item} ${on}`} onClick={() => { onChange({ mode: 'off' }); onClose(); }}>
          <EyeOff size={13} className="text-ink-400" aria-hidden="true" /> Exclude from comparison
        </button>
      )}
      <AnimatePresence>
        {pinOpen && (
          <ComparePopover
            key="pin"
            align="right"
            scopeTitle={widgetTitle}
            tables={tables}
            today={today}
            value={mode === 'pin' && override?.mode === 'pin' ? { a: override.a, b: override.b, chartMode: override.chartMode ?? dashboard.chartMode } : { a: dashboard.a, b: dashboard.b, chartMode: dashboard.chartMode }}
            onApply={v => { onChange({ mode: 'pin', a: v.a, b: v.b, chartMode: v.chartMode }); setPinOpen(false); onClose(); }}
            onClose={() => setPinOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
