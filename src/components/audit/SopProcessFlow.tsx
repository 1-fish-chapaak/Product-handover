import { type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';

// One node of a SOP process flow. `next` holds outgoing edges — for a decision
// node, next[0] is the "Yes" branch and next[1] the "No" branch. Flows can
// loop back (e.g. a rejection routing to an earlier step), so the renderer
// de-dupes: a node reached a second time renders as a "returns to …" chip
// rather than being drawn (and recursed) again.
export type FlowNode = {
  id: string;
  label: string;
  type: 'start' | 'process' | 'decision' | 'end';
  next?: string[];
};

// Node-type → Editorial GRC semantic token. start/end = compliant (green),
// process = evidence (blue), decision = mitigated (amber, the system's warning).
const NODE_STYLE: Record<FlowNode['type'], string> = {
  start: 'border-compliant bg-compliant-50 text-compliant-700',
  process: 'border-evidence bg-evidence-50 text-evidence-700',
  decision: 'border-2 border-mitigated bg-mitigated-50 text-mitigated-700',
  end: 'border-compliant bg-compliant-50 text-compliant-700',
};

function NodeCard({ node }: { node: FlowNode }) {
  return (
    <div
      className={`relative w-[190px] rounded-2xl border px-4 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug whitespace-pre-line ${NODE_STYLE[node.type]}`}
    >
      {node.type === 'decision' && (
        <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-mitigated" aria-hidden="true" />
      )}
      {node.label}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      <span className="h-4 w-px bg-canvas-border" />
      <ChevronDown size={13} className="text-ink-400 -mt-1.5" />
    </div>
  );
}

// A flow that loops/merges back to an already-drawn node renders this instead
// of redrawing it — keeps the diagram finite and readable.
function ReturnChip({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-canvas-border bg-paper-50 px-3 py-1 text-[0.75rem] font-medium text-ink-500">
      <RotateCcw size={12} className="text-ink-400" aria-hidden="true" />
      returns to “{label.replace(/\n/g, ' ')}”
    </div>
  );
}

export default function SopProcessFlow({ nodes }: { nodes: FlowNode[] }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <p className="text-[0.875rem] font-semibold text-ink-700">No process flow mapped</p>
        <p className="text-[0.8125rem] text-ink-400 mt-1">This SOP doesn’t have a documented process flow yet.</p>
      </div>
    );
  }

  const byId: Record<string, FlowNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === 'start') ?? nodes[0];
  const rendered = new Set<string>();
  let key = 0;

  // Walk a single path from `id` downward. On a decision, emit both branches as
  // labelled (Yes / No) sub-columns and stop the straight run. Static diagram,
  // so the deterministic walk order makes incrementing keys stable.
  function chain(id: string, depth = 0): ReactNode[] {
    const out: ReactNode[] = [];
    let currentId: string | undefined = id;
    while (currentId) {
      const node: FlowNode | undefined = byId[currentId];
      if (!node) break;
      if (rendered.has(currentId)) {
        out.push(<ReturnChip key={`f${key++}`} label={node.label} />);
        break;
      }
      rendered.add(currentId);
      out.push(<NodeCard key={`f${key++}`} node={node} />);

      const nexts: string[] = node.next ?? [];
      if (node.type === 'decision' && nexts.length >= 2) {
        const branches = [
          { label: 'Yes', target: nexts[0], tone: 'compliant' as const },
          { label: 'No', target: nexts[1], tone: 'risk' as const },
        ];
        out.push(<Connector key={`f${key++}`} />);
        out.push(
          <div key={`f${key++}`} className="flex w-full max-w-[460px] flex-col gap-3">
            {branches.map((b) =>
              b.target ? (
                <div
                  key={`f${key++}`}
                  className={`flex flex-col items-center gap-2 rounded-xl px-3 pb-3 pt-2.5 ${
                    depth % 2 === 0 ? 'bg-brand-50' : 'bg-brand-100'
                  }`}
                >
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide ${
                      b.tone === 'compliant' ? 'bg-compliant-50 text-compliant-700' : 'bg-risk-50 text-risk-700'
                    }`}
                  >
                    {b.label}
                  </span>
                  <Connector />
                  {chain(b.target, depth + 1)}
                </div>
              ) : null,
            )}
          </div>,
        );
        break;
      }

      const nextId: string | undefined = nexts[0];
      if (nextId) out.push(<Connector key={`f${key++}`} />);
      currentId = nextId;
    }
    return out;
  }

  return <div className="flex flex-col items-center gap-2 py-8">{chain(start.id)}</div>;
}
