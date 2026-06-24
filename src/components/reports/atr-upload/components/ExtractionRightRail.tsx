import { CheckSquare, Square, ListChecks, AlertCircle } from 'lucide-react';
import type { AtrClassification, AtrRisk } from '../../atrTypes';

export type SummaryFilter = 'all' | 'complete' | 'issues';

export interface RailBreakdown {
  classification: Record<AtrClassification, number>;
  risk: Record<AtrRisk, number>;
  totalActionPlans: number;
  totalAnnexureRows: number;
}

export default function ExtractionRightRail({
  selectedCount, totalCount, filter, onFilter, onSelectAll, onDeselectAll, breakdown,
}: {
  selectedCount: number;
  totalCount: number;
  filter: SummaryFilter;
  onFilter: (f: SummaryFilter) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  breakdown: RailBreakdown;
}) {
  const toggle = (f: SummaryFilter) => onFilter(filter === f ? 'all' : f);

  return (
    <aside className="sticky top-0 space-y-4">
      {/* Live counter */}
      <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4">
        <div className="text-[1.5rem] font-bold tabular-nums text-ink-900">
          {selectedCount} <span className="text-ink-400 font-semibold text-[1.125rem]">of {totalCount}</span>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">observations selected</div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <QuickBtn icon={CheckSquare} label="Select all" onClick={onSelectAll} />
          <QuickBtn icon={Square} label="Deselect all" onClick={onDeselectAll} />
          <QuickBtn icon={ListChecks} label="Only complete" active={filter === 'complete'} onClick={() => toggle('complete')} />
          <QuickBtn icon={AlertCircle} label="Only issues" active={filter === 'issues'} onClick={() => toggle('issues')} />
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-[12px] border border-canvas-border bg-canvas-elevated p-4 space-y-4">
        <Group title="By classification">
          <Row label="Design Deficiency" value={breakdown.classification['Design Deficiency']} />
          <Row label="System Deficiency" value={breakdown.classification['System Deficiency']} />
          <Row label="Procedural Non-Compliance" value={breakdown.classification['Procedural Non-Compliance']} />
        </Group>
        <Group title="By risk">
          <Row label="High" value={breakdown.risk.High} />
          <Row label="Medium" value={breakdown.risk.Medium} />
          <Row label="Low" value={breakdown.risk.Low} />
        </Group>
        <div className="pt-1 border-t border-canvas-border space-y-1.5">
          <Row label="Total action plans" value={breakdown.totalActionPlans} strong />
          <Row label="Total annexure rows" value={breakdown.totalAnnexureRows} strong />
        </div>
      </div>
    </aside>
  );
}

function QuickBtn({ icon: Icon, label, onClick, active }: { icon: typeof CheckSquare; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-[7px] text-[11.5px] font-medium border transition-colors cursor-pointer ${
        active ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-canvas border-canvas-border text-ink-600 hover:border-brand-200'
      }`}
    >
      <Icon size={13} aria-hidden="true" /> {label}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[12px] ${strong ? 'font-semibold text-ink-800' : 'text-ink-600'}`}>{label}</span>
      <span className={`text-[12.5px] tabular-nums ${strong ? 'font-bold text-ink-900' : 'font-semibold text-ink-700'}`}>{value}</span>
    </div>
  );
}
