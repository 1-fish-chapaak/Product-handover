import { useState } from 'react';
import { Check, Sparkles, ArrowLeftRight } from 'lucide-react';
import type { ModelTable, AutoDetectCandidate } from './relationshipTypes';
import { tableById } from './joinEngine';

/** Auto-detect proposes candidates — the user approves which to create. It
 *  never overrides existing connections; candidates on an already-active pair
 *  are flagged and created Inactive. */
export default function AutoDetectReview({
  candidates, tables, onApply, onCancel,
}: {
  candidates: AutoDetectCandidate[];
  tables: ModelTable[];
  onApply: (selected: AutoDetectCandidate[]) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.filter(c => !c.willBeInactive).map(c => c.id)));
  const tname = (id: string) => tableById(tables, id)?.name ?? id;
  const clabel = (tid: string, col: string) => tableById(tables, tid)?.columns.find(c => c.name === col)?.label ?? col;

  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={15} className="text-primary" />
        <h4 className="text-[14px] font-semibold text-text">Suggested connections</h4>
      </div>
      <p className="text-[12px] text-text-muted mb-4">
        {candidates.length === 0
          ? 'No new matching columns found across your tables.'
          : `We found ${candidates.length} possible connection${candidates.length === 1 ? '' : 's'} from matching columns. Pick the ones to add — nothing is changed until you apply.`}
      </p>

      <div className="space-y-2 max-h-[320px] overflow-y-auto">
        {candidates.map(c => {
          const on = picked.has(c.id);
          const pair = c.columnPairs[0];
          return (
            <button key={c.id} onClick={() => toggle(c.id)} className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[8px] border transition-colors cursor-pointer ${on ? 'border-primary/40 bg-primary-xlight/40' : 'border-border-light hover:border-primary/20'}`}>
              <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary' : 'border-border'}`}>{on && <Check size={11} className="text-white" />}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[12.5px] text-text flex-wrap">
                  <span className="font-semibold">{tname(c.leftTable)}</span>
                  <span className="text-text-muted">·</span>
                  <span>{clabel(c.leftTable, pair.left)}</span>
                  <ArrowLeftRight size={12} className="text-text-muted" />
                  <span className="font-semibold">{tname(c.rightTable)}</span>
                  <span className="text-text-muted">·</span>
                  <span>{clabel(c.rightTable, pair.right)}</span>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">{c.reason}</div>
              </div>
              {c.willBeInactive && (
                <span className="shrink-0 inline-flex items-center h-5 px-2 text-[10px] font-semibold bg-mitigated-50 text-mitigated-700 rounded-full">Will be Inactive</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border-light">
        <span className="text-[11.5px] text-text-muted">{picked.size} selected</span>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="h-9 px-4 text-[12.5px] font-medium text-text bg-white border border-border-light rounded-[8px] hover:bg-paper-50 cursor-pointer">Cancel</button>
          <button
            onClick={() => onApply(candidates.filter(c => picked.has(c.id)))}
            disabled={picked.size === 0}
            className="h-9 px-5 text-[12.5px] font-semibold text-white bg-primary hover:bg-primary-hover rounded-[8px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add {picked.size} connection{picked.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
