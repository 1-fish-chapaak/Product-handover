// PlanFlowDiagram — a DAG/flow view of a Query Execution Plan.
//
// Answers "how did Ira get from the input files to the output": a single
// top-to-bottom pipeline of step nodes ending in the output, connected by real
// SVG edges (step -> step -> output), with each edge tagged by the payload it
// hands downstream. Each step names the data it reads inline (source tables +
// the operation + a row funnel), so there's no separate input lane. Select any
// node for the detail strip, which reuses the same file/column UI as the text
// plan.
//
// The measured graph lives in <PlanFlowGraph> so it can be dropped into both
// the inline chat card and the "open larger" modal — each instance measures its
// own width, so the same graph reflows to whatever container it lands in.
//
// Edges are measured (refs + ResizeObserver) so the graph reflows with the
// resizable Plan panel. Calm by default (hairline ink edges); brand colour and
// the arrowheads only light up on interaction — the Auditor's Pen stays rare.

import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ListChecks, ChevronDown, FileText, Workflow, List, CornerDownRight, Table2, ArrowRight, ArrowDown, Maximize2,
} from 'lucide-react';
import {
  typeColor, StepFilesAndColumns,
  type PlanCardStep, type PlanCardSource,
} from './PlanCards';
import Modal from './Modal';

const fmt = (n: number) => n.toLocaleString('en-US');

const FLOW_TITLE = 'How Ira built this answer';
const FLOW_HINT = 'Each step from your files to the result, in plain English.';

// ─── View toggle (Flow / Steps) ──────────────────────────────────────────

export type PlanView = 'flow' | 'steps';

export function PlanViewToggle({ value, onChange }: {
  value: PlanView;
  onChange: (v: PlanView) => void;
}) {
  const opts: { id: PlanView; label: string; icon: typeof Workflow }[] = [
    { id: 'flow', label: 'Flow', icon: Workflow },
    { id: 'steps', label: 'Steps', icon: List },
  ];
  return (
    <div
      role="tablist"
      aria-label="Plan view"
      className="inline-flex items-center gap-0.5 rounded-lg border border-canvas-border bg-canvas p-0.5"
    >
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.71875rem] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              on ? 'bg-canvas-elevated text-ink-900 shadow-[0_1px_2px_rgba(15,8,30,0.06)]' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <o.icon size={12} strokeWidth={2} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Geometry helpers ────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number; }
interface Edge { id: string; from: string; to: string; kind: 'io' | 'spine'; }

const INK_EDGE = '#C2B9CB';   // ink-300 — calm default
const BRAND_EDGE = '#6A12CD'; // brand-600 — lineage highlight

function edgePath(a: Rect, b: Rect, kind: Edge['kind']): string {
  if (kind === 'spine') {
    // step bottom-centre -> next node top-centre
    const x1 = a.x + a.w / 2, y1 = a.y + a.h;
    const x2 = b.x + b.w / 2, y2 = b.y;
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  }
  // input right edge -> step left edge
  const x1 = a.x + a.w, y1 = a.y + a.h / 2;
  const x2 = b.x, y2 = b.y + b.h / 2;
  const mx = x1 + Math.max(20, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

// ─── Measured graph ─────────────────────────────────────────────────────────
// The self-contained DAG: input lane + step pipeline + measured SVG edges +
// the detail strip. Owns all hover/select/measurement state so it works the
// same dropped into the inline card or the modal.

export function PlanFlowGraph({ steps, outputLabel = 'Result' }: {
  steps: PlanCardStep[];
  outputLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // Distinct input files, in first-seen order.
  const inputs = useMemo(() => {
    const map = new Map<string, PlanCardSource>();
    steps.forEach((s) => (s.sources ?? []).forEach((src) => { if (!map.has(src.id)) map.set(src.id, src); }));
    return [...map.values()];
  }, [steps]);

  const edges = useMemo<Edge[]>(() => {
    // step -> step -> output (the flow). Each step names the data it reads
    // inline, so there's no separate input lane to wire up.
    const list: Edge[] = [];
    steps.forEach((s, i) => {
      const to = i < steps.length - 1 ? `step:${steps[i + 1].id}` : 'out';
      list.push({ id: `sp:${s.id}->${to}`, from: `step:${s.id}`, to, kind: 'spine' });
    });
    return list;
  }, [steps]);

  // Highlight source: hover wins, else the pinned selection.
  const focusId = hover ?? active;
  const lit = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    edges.forEach((e) => {
      if (e.from === focusId) set.add(e.to);
      if (e.to === focusId) set.add(e.from);
    });
    return set;
  }, [focusId, edges]);

  // ── Measurement ──
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });
  const registerNode = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) nodeEls.current.set(id, el); else nodeEls.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const next: Record<string, Rect> = {};
      nodeEls.current.forEach((el, id) => {
        const r = el.getBoundingClientRect();
        next[id] = { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height };
      });
      setRects(next);
      setSize({ w: wr.width, h: wr.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [steps, inputs.length]);

  const nodeClass = (id: string, extra = '') => {
    const dim = lit && !lit.has(id);
    const on = focusId === id;
    return `rounded-lg border bg-canvas-elevated text-left transition-[border-color,opacity,box-shadow] duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
      on ? 'border-brand-300 shadow-[0_2px_12px_-5px_rgba(106,18,205,0.3)]' : 'border-canvas-border hover:border-brand-200'
    } ${dim ? 'opacity-40' : 'opacity-100'} ${extra}`;
  };

  // Row count the pipeline lands on — shown as a meta chip on the output node.
  const finalRows = useMemo(() => {
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i].rowsOut != null) return steps[i].rowsOut!;
    return null;
  }, [steps]);

  const nodeHandlers = (id: string) => ({
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
    onFocus: () => setHover(id),
    onBlur: () => setHover(null),
    onClick: () => setActive((a) => (a === id ? null : id)),
  });

  return (
    <>
      {/* Measured graph — SVG edges behind, node buttons above. */}
      <div ref={wrapRef} className="relative">
        <svg
          width={size.w} height={size.h}
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: 'visible' }}
          aria-hidden
        >
          <defs>
            <marker id="pf-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M1,1 L6,4 L1,7" fill="none" stroke={INK_EDGE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="pf-arrow-hot" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M1,1 L6,4 L1,7" fill="none" stroke={BRAND_EDGE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = rects[e.from], b = rects[e.to];
            if (!a || !b) return null;
            const hot = !!focusId && (e.from === focusId || e.to === focusId);
            const dim = !!focusId && !hot;
            return (
              <path
                key={e.id}
                d={edgePath(a, b, e.kind)}
                fill="none"
                stroke={hot ? BRAND_EDGE : INK_EDGE}
                strokeWidth={hot ? 2 : 1.5}
                opacity={dim ? 0.18 : 1}
                markerEnd={hot ? 'url(#pf-arrow-hot)' : 'url(#pf-arrow)'}
                className="transition-[opacity] duration-200"
              />
            );
          })}
        </svg>

        {/* Single top-to-bottom pipeline — steps, each followed by a descriptive
            hand-off box on the connector, ending in the output. Each step names
            the data it reads inline, so there's no separate input lane. */}
        <div className="relative z-10 flex flex-col gap-5">
            {steps.map((s, idx) => {
              const tables = s.sources ?? [];
              const hasFunnel = s.rowsIn != null && s.rowsOut != null;
              return (
                <Fragment key={s.id}>
                <button
                  type="button"
                  ref={registerNode(`step:${s.id}`)}
                  {...nodeHandlers(`step:${s.id}`)}
                  className={nodeClass(`step:${s.id}`, 'flex flex-col px-3 py-2.5')}
                >
                  {/* header — step number · plain-English name */}
                  <span className="flex items-center gap-2">
                    <span className="shrink-0 size-5 rounded-full bg-brand-600 text-white text-[0.625rem] font-bold flex items-center justify-center tabular-nums" aria-hidden>
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-[0.78125rem] font-semibold text-ink-900 leading-tight truncate">{s.name}</span>
                  </span>

                  {/* what this step did, in plain words */}
                  <span className="block text-[0.71875rem] text-ink-500 leading-snug mt-1 pl-7">{s.description}</span>

                  {/* the specifics — what it did next, the datasets used, the count */}
                  {s.operation && (
                    <span className="block text-[0.6875rem] text-ink-700 leading-snug mt-1.5 pl-7">{s.operation}</span>
                  )}
                  {(tables.length > 0 || hasFunnel) && (
                    <span className="flex flex-wrap items-center gap-1.5 mt-2 pl-7">
                      {tables.map((t) => (
                        <span key={t.id} className="inline-flex items-center gap-1 rounded-md border border-canvas-border bg-canvas/50 px-1.5 py-0.5 text-[0.65625rem] font-medium text-ink-700">
                          <FileText size={10} className="text-ink-400 shrink-0" />
                          <span className="truncate max-w-[11rem]">{t.name}</span>
                        </span>
                      ))}
                      {hasFunnel && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-brand-100 bg-brand-50 px-2 py-0.5 text-[0.65625rem] font-semibold text-brand-700 tabular-nums" title="checked vs kept">
                          {fmt(s.rowsIn!)} checked
                          <ArrowRight size={10} className="text-brand-600" />
                          {fmt(s.rowsOut!)} risks
                        </span>
                      )}
                    </span>
                  )}
                </button>

                {/* Hand-off box — a descriptive, boxed summary of what this step
                    passes to the next. Sits on the connector (its opaque fill
                    masks the wire), styled lighter than the step nodes so the
                    steps stay primary. */}
                {s.output && (
                  <div className="flex justify-center">
                    <div className="relative inline-flex items-start gap-2 rounded-lg border border-canvas-border bg-canvas px-3 py-2 max-w-[34rem]">
                      <span className="shrink-0 mt-px inline-flex size-[18px] items-center justify-center rounded-full bg-brand-50" aria-hidden>
                        <ArrowDown size={11} className="text-brand-500" />
                      </span>
                      <span className="text-[0.71875rem] font-medium text-ink-600 leading-snug">{s.output}</span>
                    </div>
                  </div>
                )}
                </Fragment>
              );
            })}

            {/* Output node */}
            <button
              type="button"
              ref={registerNode('out')}
              {...nodeHandlers('out')}
              className={nodeClass('out', 'flex items-center gap-2 px-3 py-2 !bg-brand-50/50')}
            >
              <span className="shrink-0 size-5 rounded-full bg-brand-600 text-white flex items-center justify-center" aria-hidden>
                <Table2 size={11} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.59375rem] font-bold uppercase tracking-wider text-brand-700/80 leading-none">Output</span>
                <span className="block text-[0.75rem] font-semibold text-ink-900 leading-tight truncate mt-0.5">{outputLabel}</span>
              </span>
              {finalRows != null && (
                <span className="shrink-0 inline-flex items-center rounded-md border border-brand-100 bg-canvas-elevated px-1.5 py-0.5 text-[0.625rem] font-semibold text-brand-700 tabular-nums">
                  {fmt(finalRows)} risks
                </span>
              )}
            </button>
          </div>
        </div>

      {/* Detail strip for the selected node. */}
      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3.5 rounded-lg border border-canvas-border bg-canvas/40 px-3 py-2.5"
          >
            <NodeDetail active={active} steps={steps} inputs={inputs} outputLabel={outputLabel} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Inline card (with an "open larger" button that pops the graph to a modal) ─

export default function PlanFlowDiagram({
  steps,
  outputLabel = 'Result',
  headerAccessory,
  defaultOpen = true,
}: {
  steps: PlanCardStep[];
  outputLabel?: string;
  headerAccessory?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group relative rounded-xl border border-canvas-border bg-canvas-elevated overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.18)]">
      {/* Header — mirrors QueryExecutionPlanCard so the toggle reads as one card. */}
      <div className="flex items-center px-4 py-3">
        <div className="flex-1 flex items-center gap-2 text-[0.875rem] font-semibold tracking-tight text-ink-900">
          <ListChecks size={14} className="text-primary shrink-0" />
          <span className="flex-1 text-left">{FLOW_TITLE}</span>
        </div>
        {headerAccessory}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Open in a larger view"
          aria-label="Open flow in a larger view"
          className="ml-1 inline-flex items-center justify-center size-6 text-ink-400 hover:text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        >
          <Maximize2 size={13.5} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Collapse plan' : 'Expand plan'}
          className="ml-0.5 inline-flex items-center justify-center size-6 text-ink-400 hover:text-ink-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
        >
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ type: 'spring', stiffness: 360, damping: 26 }} className="inline-flex" aria-hidden>
            <ChevronDown size={15} />
          </motion.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="flow-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-canvas-border"
          >
            <div className="px-4 pt-3 pb-4">
              <p className="text-[0.71875rem] text-ink-500 leading-snug mb-3">{FLOW_HINT}</p>
              <PlanFlowGraph steps={steps} outputLabel={outputLabel} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focused, wider view of the same graph. Portalled so it overlays the
          whole viewport regardless of the chat's transformed ancestors. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {expanded && (
            <Modal
              key="plan-flow-modal"
              title={FLOW_TITLE}
              subtitle={FLOW_HINT}
              width="max-w-[60rem]"
              onClose={() => setExpanded(false)}
              ariaLabel="How Ira built this answer"
            >
              <PlanFlowGraph steps={steps} outputLabel={outputLabel} />
            </Modal>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// Detail for the pinned node: a step shows its description + files/columns; an
// input shows which steps it feeds and its columns; the output is terminal.
function NodeDetail({ active, steps, inputs, outputLabel }: {
  active: string;
  steps: PlanCardStep[];
  inputs: PlanCardSource[];
  outputLabel: string;
}) {
  if (active === 'out') {
    return (
      <div className="flex items-start gap-2">
        <CornerDownRight size={13} className="text-ink-400 mt-0.5 shrink-0" />
        <p className="text-[0.71875rem] text-ink-600 leading-relaxed">
          <span className="font-semibold text-ink-800">{outputLabel}</span> — the formatted result the steps above produce.
        </p>
      </div>
    );
  }

  if (active.startsWith('step:')) {
    const step = steps.find((s) => `step:${s.id}` === active);
    if (!step) return null;
    return (
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[0.75rem] font-semibold text-ink-900">{step.name}</span>
        </div>
        <p className="text-[0.71875rem] text-ink-600 leading-relaxed mt-1">{step.description}</p>
        {(step.sources?.length ?? 0) > 0 && (
          <div className="mt-2">
            <StepFilesAndColumns sources={step.sources!} />
          </div>
        )}
      </div>
    );
  }

  // input node
  const src = inputs.find((i) => `in:${i.id}` === active);
  if (!src) return null;
  const feeds = steps.filter((s) => (s.sources ?? []).some((x) => x.id === src.id));
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <FileText size={13} className="text-ink-400 shrink-0" />
        <span className="text-[0.75rem] font-semibold text-ink-900 truncate">{src.name}</span>
        <span className={`text-[0.5625rem] font-bold uppercase tracking-wide rounded px-1 py-0.5 shrink-0 ${typeColor(src.type)}`}>{src.type}</span>
      </div>
      <p className="text-[0.71875rem] text-ink-500 leading-relaxed mt-1">
        Feeds {feeds.length} step{feeds.length === 1 ? '' : 's'}: {feeds.map((f) => f.name).join(' · ')}
      </p>
      {(src.columns?.length ?? 0) > 0 && (
        <div className="mt-2">
          <StepFilesAndColumns sources={[src]} />
        </div>
      )}
    </div>
  );
}
