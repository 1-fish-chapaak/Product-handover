import { useState } from 'react';
import { X } from 'lucide-react';

interface PanelWorkflow {
  name: string;
  type: 'Automated' | 'Manual';
  status: 'Ready' | 'Draft' | 'Completed';
  lastRun: string;
  runs: number;
}

export interface ControlExpandedPanelProps {
  description: string;
  linkedRisks: string[];
  usedInRACMs: number;
  automation: string;
  frequency: string;
  workflows: PanelWorkflow[];
  /** business-process abbreviation, used to derive workflow display codes */
  bpAbbr: string;
}

// Inline expanded panel for a control card — Description, key fields, and the
// mapped Workflows rendered in the same row format as control attributes.
export default function ControlExpandedPanel({
  description, linkedRisks, usedInRACMs, automation, frequency, workflows, bpAbbr,
}: ControlExpandedPanelProps) {
  // Local copy so the remove (✕) action works without a parent handler.
  const [wfs, setWfs] = useState(
    workflows.map((w, i) => ({ ...w, code: `WF-${bpAbbr}-${String(i + 1).padStart(3, '0')}` }))
  );
  const removeWf = (code: string) => setWfs(prev => prev.filter(w => w.code !== code));

  // Status pill colour, echoing the risk row's Mapped/Unmapped pill: a settled
  // workflow (Ready / Completed) reads compliant; a Draft reads mitigated.
  const statusPill = (s: PanelWorkflow['status']) =>
    s === 'Draft' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-compliant-50 text-compliant-700';

  return (
    <div className="px-6 py-5 pl-[68px]">
      {/* Description */}
      <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1.5">Description</span>
      <p className="text-[13px] text-text leading-relaxed max-w-4xl">{description || '—'}</p>

      {/* Field row */}
      <div className="grid grid-cols-4 gap-6 mt-5">
        <div>
          <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1.5">Linked Risks</span>
          <span className="text-[13px] text-text block">
            {linkedRisks.length === 0
              ? '—'
              : <span className="font-mono text-[12.5px] text-ink-700">{linkedRisks.join(', ')}</span>}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1.5">Used in RACMs</span>
          <span className="text-[13px] text-text block">{usedInRACMs === 0 ? '—' : `${usedInRACMs} RACM${usedInRACMs !== 1 ? 's' : ''}`}</span>
        </div>
        <div>
          <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1.5">Automation</span>
          <span className="text-[13px] text-text block">{automation || '—'}</span>
        </div>
        <div>
          <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1.5">Frequency</span>
          <span className="text-[13px] text-text block">{frequency || '—'}</span>
        </div>
      </div>

      {/* Workflows */}
      <div className="mt-6">
        <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-2.5">Workflows ({wfs.length})</span>
        {wfs.length === 0 ? (
          <p className="text-[12px] text-mitigated-700">No workflows linked. Create a workflow to enable testing.</p>
        ) : (
          <div className="space-y-1.5">
            {wfs.map(w => (
              /* Single-line row, matching the risk rows in the RACM expanded state:
                 bullet · code · name (flex, truncates) · type · status pill · last run. */
              <div key={w.code} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-canvas-border bg-white hover:bg-canvas/50 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-300 shrink-0" aria-hidden="true" />
                <span className="font-mono text-[0.6875rem] font-semibold text-brand-700 shrink-0">{w.code}</span>
                <span className="text-[0.8125rem] text-ink-800 leading-snug flex-1 min-w-0 truncate">{w.name}</span>
                <span className="shrink-0 text-[0.6875rem] text-ink-500">{w.type}</span>
                <span className={`shrink-0 inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold ${statusPill(w.status)}`}>{w.status}</span>
                <span className="shrink-0 text-[0.6875rem] text-ink-400 tabular-nums">{w.lastRun} · {w.runs} run{w.runs !== 1 ? 's' : ''}</span>
                <button
                  type="button"
                  onClick={() => removeWf(w.code)}
                  aria-label={`Remove ${w.code}`}
                  title={`Remove ${w.code}`}
                  className="shrink-0 p-0.5 rounded hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
