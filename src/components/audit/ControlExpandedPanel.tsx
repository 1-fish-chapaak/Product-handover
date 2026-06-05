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
              <div key={w.code} className="rounded-lg border border-canvas-border bg-white overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-300 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-[10.5px] font-semibold text-brand-700 shrink-0">{w.code}</span>
                  <span className="text-[12.5px] text-ink-800 leading-snug flex-1 min-w-0 truncate">{w.name}</span>
                  <button
                    type="button"
                    onClick={() => removeWf(w.code)}
                    aria-label={`Remove ${w.code}`}
                    className="shrink-0 p-0.5 rounded hover:bg-risk-50 text-ink-400 hover:text-risk-700 cursor-pointer transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="border-t border-canvas-border bg-canvas/40 px-3 py-2.5 pl-[26px] grid grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1">Type</span>
                    <span className="text-[12.5px] text-text block">{w.type}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1">Status</span>
                    <span className="text-[12.5px] text-text block">{w.status}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1">Last run</span>
                    <span className="text-[12.5px] text-text block">{w.lastRun}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-400 uppercase block tracking-wider mb-1">Runs</span>
                    <span className="text-[12.5px] text-text block tabular-nums">{w.runs}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
