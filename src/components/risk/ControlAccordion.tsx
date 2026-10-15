/**
 * The controls that mitigate a risk, each an accordion row: closed, it reads
 * as status, effectiveness and the points it takes off the score; open, it
 * is the control in full — what it does, its test attributes, the reports it
 * runs on — with the actions that move it (adapt, review, open, unlink).
 * Used in the register's risk accordion and in Risk 360.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronDown, Database, Unlink } from 'lucide-react';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import { useAuditLog } from '../../context/AdminDataContext';
import { CHECK_CATALOG, filesForEntry } from '../../data/auditPlan';
import { SEED_WORKFLOW_ATTRIBUTES, type ControlRow } from '../governance/controlTypes';
import type { ControlLine } from '../../data/erm/score';
import { unlinkControl } from '../../data/erm/store';
import { ControlGlyph } from './riskUi';

const STATUS_WORD: Record<string, string> = {
  live: 'Live', 'awaiting-review': 'Awaiting review', 'needs-data': 'Needs data', manual: 'Manual test', 'no-workflow': 'No workflow', draft: 'Draft',
};
const STATUS_INK: Record<string, string> = {
  live: 'text-compliant-700', 'awaiting-review': 'text-evidence-700', 'needs-data': 'text-mitigated-700', manual: 'text-ink-600', 'no-workflow': 'text-high-700', draft: 'text-ink-400',
};

const attributesOf = (c: ControlRow) => (c.linkedWorkflowIds[0] && SEED_WORKFLOW_ATTRIBUTES[c.linkedWorkflowIds[0]]) || c.attributes || [];

export interface ControlActions {
  openControl: (rowId: string) => void;
  adapt?: (keys: string[]) => void;
  review?: () => void;
}

export default function ControlAccordion({ riskId, controls, actions, defaultOpen }: {
  riskId: string; controls: ControlLine[]; actions: ControlActions; defaultOpen?: string;
}) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  if (controls.length === 0) {
    return <p className="px-4 py-4 rounded-xl border border-dashed border-canvas-border text-[0.8125rem] text-ink-600">No control mitigates this risk yet — the full inherent exposure stands.</p>;
  }
  return (
    <ul className="rounded-xl border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border overflow-hidden">
      {controls.map(c => (
        <ControlRowItem key={c.id} riskId={riskId} line={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} actions={actions} />
      ))}
    </ul>
  );
}

function ControlRowItem({ riskId, line: c, open, onToggle, actions }: {
  riskId: string; line: ControlLine; open: boolean; onToggle: () => void; actions: ControlActions;
}) {
  const reduced = useReducedMotion();
  const { addToast } = useToast();
  const logEvent = useAuditLog();
  const row = c.row;
  const e = c.effect;
  if (!row || !e) {
    return <li className="px-4 py-3 text-[0.8125rem] text-ink-500"><span className="font-mono">{c.id}</span> — not in the Control Library</li>;
  }
  const eff = Math.round(e.effectiveness * 100);
  const attrs = attributesOf(row);
  const entry = row.stdKey ? CHECK_CATALOG.find(x => x.key === row.stdKey) : undefined;
  const files = entry ? filesForEntry(entry) : [];
  const stop = (ev: React.SyntheticEvent) => ev.stopPropagation();

  return (
    <li className={open ? 'bg-paper-50/40' : ''}>
      <div className="grid grid-cols-[1rem_minmax(0,1.6fr)_minmax(0,1.1fr)_6.5rem_3.75rem_auto] items-center gap-4 px-4 py-3 cursor-pointer hover:bg-paper-50/60" onClick={onToggle}>
        <ControlGlyph status={e.status} size={16} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-ink-400">
            <span className="font-mono text-ink-500">{c.id}</span>
            <span aria-hidden>·</span>
            {row.library === 'standard' ? <span className="text-brand-700">Standard library</span> : <span>Custom</span>}
            {row.classification === 'Key' && <><span aria-hidden>·</span><span>Key</span></>}
          </div>
          <button type="button" aria-expanded={open} onClick={ev => { stop(ev); onToggle(); }} className="block max-w-full text-left text-[0.8125rem] font-semibold text-ink-900 truncate cursor-pointer hover:text-brand-700">{row.name}</button>
          <div className="text-[0.6875rem] text-ink-500 truncate">{row.nature} · {row.automation} · {row.frequency} · {row.owner}</div>
        </div>
        <div className="min-w-0">
          <div className={`text-[0.75rem] font-medium ${STATUS_INK[e.status]}`}>{STATUS_WORD[e.status]}</div>
          <div className="text-[0.6875rem] text-ink-500 truncate" title={e.label}>{e.label}</div>
        </div>
        <div title={`Delivering ${eff}% of its design weight`}>
          <div className="h-1.5 rounded-full bg-paper-100 overflow-hidden"><div className="h-full rounded-full bg-compliant-500" style={{ width: `${eff}%` }} /></div>
          <div className="mt-1 text-[0.625rem] text-ink-400 tabular-nums">{eff}% effective</div>
        </div>
        <span className="text-right font-mono text-[0.8125rem] font-semibold text-compliant-700 tabular-nums" title="Points this control takes off the risk score">−{c.points.toFixed(1)}</span>
        <ChevronDown size={15} className={`text-ink-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pl-12 pr-4 pb-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
                <div className="min-w-0">
                  <p className="text-[0.8125rem] leading-relaxed text-ink-700">{row.description}</p>
                  {row.objective && <p className="mt-1 text-[0.75rem] text-ink-500">{row.objective}</p>}
                  <dl className="mt-3 grid grid-cols-[6rem_minmax(0,1fr)] gap-y-1 text-[0.75rem]">
                    <dt className="text-ink-400">Sub-process</dt><dd className="text-ink-800">{row.subProcess}</dd>
                    <dt className="text-ink-400">Workflow</dt><dd className="text-ink-800 truncate">{row.linkedWorkflows[0] ?? (e.status === 'manual' ? 'Walkthrough and inspection' : '—')}</dd>
                    <dt className="text-ink-400">Mitigation</dt><dd className="text-ink-800">Takes <span className="font-mono">{c.points.toFixed(1)}</span> off this risk’s score at {eff}% effectiveness</dd>
                  </dl>
                </div>
                <div className="min-w-0">
                  {files.length > 0 && (
                    <>
                      <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">{e.status === 'live' || e.status === 'awaiting-review' ? 'Runs on' : 'Needs these reports'}</div>
                      <ul className="space-y-1">
                        {files.map(f => (
                          <li key={f.code} className="flex items-center gap-2 text-[0.75rem]">
                            <span className="font-mono font-semibold text-ink-800 w-14 shrink-0">{f.code}</span>
                            <span className="text-ink-600 truncate">{f.name}</span>
                            {f.matches ? <span className="ml-auto inline-flex items-center gap-1 text-compliant-700 shrink-0"><Database size={11} aria-hidden />Connected</span> : <span className="ml-auto text-ink-400 shrink-0">To request</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className={`${files.length ? 'mt-3' : ''} flex flex-wrap items-center gap-2`}>
                    {e.status === 'needs-data' && row.stdKey && actions.adapt && <Button variant="primary" size="sm" onClick={() => actions.adapt!([row.stdKey!])}>Adapt with your data</Button>}
                    {e.status === 'awaiting-review' && actions.review && <Button variant="secondary" size="sm" onClick={actions.review}>Review</Button>}
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight size={12} />} onClick={() => actions.openControl(row.id)}>Open in Control Library</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Unlink size={12} />}
                      onClick={() => {
                        unlinkControl(riskId, c.id);
                        addToast({ message: `${c.id} unlinked from ${riskId}`, type: 'info' });
                        logEvent({ action: 'Update', description: `Unlinked control ${c.id} from ${riskId}`, module: 'Risk Register', entity: 'Risk' });
                      }}
                    >Unlink</Button>
                  </div>
                </div>
              </div>

              {attrs.length > 0 && (
                <div>
                  <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Test attributes · {attrs.length}</div>
                  <ol className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {attrs.map(a => (
                      <li key={a.id} className="rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[0.6875rem] text-ink-400">{a.label}</span>
                          <span className="text-[0.75rem] font-semibold text-ink-900">{a.name}</span>
                          {a.evidenceType && <span className="ml-auto text-[0.6875rem] text-ink-400 whitespace-nowrap">{a.evidenceType}</span>}
                        </div>
                        <div className="mt-1.5 space-y-0.5 text-[0.6875rem] leading-snug">
                          <p className="grid grid-cols-[2rem_minmax(0,1fr)] gap-1.5"><span className="font-medium text-compliant-700">Pass</span><span className="text-ink-700">{a.passCriteria}</span></p>
                          <p className="grid grid-cols-[2rem_minmax(0,1fr)] gap-1.5"><span className="font-medium text-risk-700">Fail</span><span className="text-ink-700">{a.failureCriteria}</span></p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
