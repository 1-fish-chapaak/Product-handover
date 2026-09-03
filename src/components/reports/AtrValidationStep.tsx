import { useState } from 'react';
import {
  CheckSquare, Square, AlertTriangle, ChevronDown, Pencil, Ban, CheckCircle2, Info, Eye,
} from 'lucide-react';
import type { AtrClassification, AtrRisk } from './atrTypes';
import {
  type AtrWorkObs, type ComplField, type Completeness,
  FIELD_LABEL, missingFields, completeness, selectedCount, duplicateIds,
} from './atrBuilder';

const INPUT =
  'w-full px-2.5 py-1.5 rounded-sm border border-canvas-border bg-canvas-elevated text-[0.75rem] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15';

const BADGE: Record<Completeness, string> = {
  Complete: 'bg-compliant-50 text-compliant-700 border-compliant/30',
  Partial: 'bg-mitigated-50 text-mitigated-700 border-mitigated/30',
  Incomplete: 'bg-risk-50 text-risk-700 border-risk/30',
};

// Remediation-status pill shown on each card (distinct from field completeness).
const STATUS_PILL: Record<string, string> = {
  Complete: 'bg-compliant-50 text-compliant-700 border-compliant/30',
  Closed: 'bg-compliant-50 text-compliant-700 border-compliant/30',
  'In Progress': 'bg-mitigated-50 text-mitigated-700 border-mitigated/30',
  Open: 'bg-draft-100 text-ink-600 border-canvas-border',
  Overdue: 'bg-risk-50 text-risk-700 border-risk/30',
};

const RISK_OPTS: AtrRisk[] = ['Critical', 'High', 'Medium', 'Low'];

// Status pips for the right-rail "By status" rollup.
const STATUS_DOT: Record<string, string> = {
  Complete: 'bg-compliant-500',
  'In Progress': 'bg-mitigated-500',
  Open: 'bg-ink-300',
  Overdue: 'bg-risk-500',
};
const CLASS_OPTS: AtrClassification[] = ['Design Deficiency', 'System Deficiency', 'Procedural Non-Compliance'];

// Write a manually-filled value back onto the working observation.
function setField(obs: AtrWorkObs, field: ComplField, value: string): AtrWorkObs {
  const next = { ...obs, actionPlans: obs.actionPlans.map(p => ({ ...p })) };
  const ensurePlan = () => { if (next.actionPlans.length === 0) next.actionPlans = [{ text: '' }]; return next.actionPlans[0]; };
  switch (field) {
    case 'description': next.description = value; break;
    case 'riskSummary': next.riskSummary = value; break;
    case 'classification': next.classification = (value || undefined) as AtrClassification; break;
    case 'risk': next.risk = (value || undefined) as AtrRisk; break;
    case 'recommendation': ensurePlan().text = value; break;
    case 'actionTaken': ensurePlan().actionTaken = value; break;
    case 'evidence': ensurePlan().evidence = value; break;
  }
  return next;
}

/**
 * Stage 2 — Extraction Results & Validation.
 * Summary banner + per-observation selection, completeness badges, and a
 * missing-field resolver (fill manually / skip from ATR) that gates progress.
 */
export default function AtrValidationStep({ observations, onChange }: {
  observations: AtrWorkObs[];
  onChange: (next: AtrWorkObs[]) => void;
}) {
  // An observation "needs attention" when it has missing fields or its
  // remediation status is still Open / Overdue.
  const needsAttention = (o: AtrWorkObs) =>
    missingFields(o).length > 0 || o.status === 'Open' || o.status === 'Overdue';

  // Cards that need attention start EXPANDED (never collapsed): missing-field
  // cards open the resolver; Open/Overdue cards open the details viewer.
  const [open, setOpen] = useState<Set<string>>(() => new Set(observations.filter(o => missingFields(o).length > 0).map(o => o._id)));   // resolver _ids
  const [view, setView] = useState<Set<string>>(() => new Set(observations.filter(o => needsAttention(o) && missingFields(o).length === 0).map(o => o._id))); // details _ids
  const [editing, setEditing] = useState<Record<string, ComplField | null>>({}); // per-obs field being filled

  const toggleIn = (set: (fn: (s: Set<string>) => Set<string>) => void, id: string) =>
    set(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const patch = (id: string, fn: (o: AtrWorkObs) => AtrWorkObs) =>
    onChange(observations.map(o => (o._id === id ? fn(o) : o)));

  const setAll = (sel: boolean) => onChange(observations.map(o => ({ ...o, selected: sel })));

  const selected = selectedCount(observations);
  const unresolved = observations.filter(o => o.selected && missingFields(o).length > 0);
  const dupes = duplicateIds(observations);

  // Right-rail rollup (selected only).
  const sel = observations.filter(o => o.selected);
  const byRisk = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<AtrRisk, number>;
  const byClass = { 'Design Deficiency': 0, 'System Deficiency': 0, 'Procedural Non-Compliance': 0 } as Record<AtrClassification, number>;
  // Status is the most audit-critical dimension — how many findings are fully
  // remediated vs still open. 'Closed' surfaces as "Complete" for the reader.
  const byStatus = { Complete: 0, 'In Progress': 0, Open: 0, Overdue: 0 } as Record<string, number>;
  sel.forEach(o => {
    if (o.risk) byRisk[o.risk]++;
    if (o.classification) byClass[o.classification]++;
    const s = o.status === 'Closed' ? 'Complete' : (o.status ?? 'Open');
    if (s in byStatus) byStatus[s]++;
  });

  return (
    <div className="p-6">
      {/* Found banner */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center"><CheckCircle2 size={16} /></span>
        <div>
          <div className="text-[0.9375rem] font-semibold text-ink-900 leading-tight">We found {observations.length} observation{observations.length === 1 ? '' : 's'} in your report</div>
          <div className="text-[0.75rem] text-ink-500">Select what to include, and resolve any missing fields before continuing.</div>
        </div>
      </div>

      {/* Global missing-fields banner */}
      {unresolved.length > 0 && (
        <div role="alert" className="flex items-start gap-2 border border-risk/30 bg-risk-50 rounded-md px-3 py-2 mb-3 text-[0.75rem] text-risk-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">{unresolved.length} observation{unresolved.length === 1 ? '' : 's'} have missing fields.</span> Review or skip them before continuing.</span>
        </div>
      )}

      {/* Duplicate detection banner */}
      {dupes.size > 0 && (
        <div className="flex items-start gap-2 border border-mitigated/30 bg-mitigated-50 rounded-md px-3 py-2 mb-3 text-[0.75rem] text-mitigated-700">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">{dupes.size} observation{dupes.size === 1 ? '' : 's'} look like duplicates</span> (matching titles). Deselect the extras to avoid repeating them in the ATR.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
        {/* List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[0.8125rem] font-semibold text-ink-800"><span className="text-brand-700">{selected}</span> of {observations.length} observations selected</div>
            <div className="flex items-center gap-2 text-[0.71875rem]">
              <button onClick={() => setAll(true)} className="font-semibold text-brand-700 hover:underline cursor-pointer">Select all</button>
              <span className="text-ink-300">·</span>
              <button onClick={() => setAll(false)} className="font-semibold text-ink-500 hover:underline cursor-pointer">Deselect all</button>
            </div>
          </div>

          {selected === 0 && (
            <div role="alert" className="flex items-center gap-2 border border-risk/30 bg-risk-50 rounded-md px-3 py-2 mb-2 text-[0.75rem] text-risk-700">
              <AlertTriangle size={13} className="shrink-0" /> <span className="font-semibold">Select at least 1 observation to continue.</span>
            </div>
          )}

          <div className="rounded-lg border border-canvas-border divide-y divide-canvas-border overflow-hidden">
            {observations.map(o => {
              const miss = missingFields(o);
              const comp = completeness(o);
              const isOpen = open.has(o._id);
              const attention = needsAttention(o);
              return (
                <div key={o._id} className={o.selected ? '' : 'opacity-55'}>
                  <div className={`flex items-start gap-3 px-3 py-2.5 ${attention ? 'bg-mitigated-50/40' : 'bg-canvas-elevated'}`}>
                    <button onClick={() => patch(o._id, x => ({ ...x, selected: !x.selected }))} className="mt-0.5 text-brand-600 hover:text-brand-700 cursor-pointer shrink-0" aria-label={o.selected ? 'Deselect' : 'Select'}>
                      {o.selected ? <CheckSquare size={17} /> : <Square size={17} className="text-ink-400" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <input
                        value={o.title}
                        onChange={e => patch(o._id, x => ({ ...x, title: e.target.value }))}
                        placeholder="Untitled Observation"
                        className="w-full bg-transparent text-[0.8125rem] font-semibold text-ink-900 placeholder:text-ink-400 focus:outline-none focus:bg-canvas focus:rounded-sm focus:px-1.5 focus:-mx-1.5 focus:ring-2 focus:ring-brand-600/15"
                      />
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center h-5 px-2 rounded-full border text-[0.625rem] font-semibold ${BADGE[comp]}`}>{comp}</span>
                        {o.status && <span className={`inline-flex items-center h-5 px-2 rounded-full border text-[0.625rem] font-semibold ${STATUS_PILL[o.status] ?? 'bg-draft-50 text-ink-500 border-canvas-border'}`}>{o.status}</span>}
                        {dupes.has(o._id) && <span className="inline-flex items-center h-5 px-2 rounded-full bg-mitigated-50 text-mitigated-700 border border-mitigated/30 text-[0.625rem] font-semibold">Possible duplicate</span>}
                        {o.classification
                          ? <span className="inline-flex items-center h-5 px-2 rounded-full bg-paper-50 border border-canvas-border text-[0.625rem] font-medium text-ink-600">{o.classification}</span>
                          : <span className="inline-flex items-center h-5 px-2 rounded-full bg-draft-50 text-[0.625rem] font-medium text-ink-400">Classification: not detected</span>}
                        {o.risk
                          ? <span className="inline-flex items-center h-5 px-2 rounded-full bg-paper-50 border border-canvas-border text-[0.625rem] font-medium text-ink-600">{o.risk} risk</span>
                          : <span className="inline-flex items-center h-5 px-2 rounded-full bg-draft-50 text-[0.625rem] font-medium text-ink-400">Risk: not detected</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => toggleIn(setView, o._id)} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[0.625rem] font-semibold cursor-pointer ${view.has(o._id) ? 'bg-brand-600 text-white' : 'bg-paper-50 text-ink-600 hover:bg-paper-100'}`} title="View full details">
                        <Eye size={11} /> View
                      </button>
                      {miss.length > 0 && (
                        <button onClick={() => toggleIn(setOpen, o._id)} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[0.625rem] font-semibold cursor-pointer ${isOpen ? 'bg-brand-600 text-white' : 'bg-risk-50 text-risk-700'}`}>
                          {miss.length} missing <ChevronDown size={11} className={isOpen ? 'rotate-180' : ''} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Full-details viewer (read-only) */}
                  {view.has(o._id) && (
                    <div className="px-3 pb-3 pt-1 bg-canvas space-y-2.5">
                      <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-3 space-y-2.5">
                        {(o.process || o.status) && (
                          <div className="flex items-center gap-2 flex-wrap text-[0.6875rem]">
                            {o.process && <span className="text-ink-600"><span className="text-ink-400">Process / Area:</span> {o.process}</span>}
                            {o.status && <span className="text-ink-600"><span className="text-ink-400">Status:</span> {o.status}</span>}
                            {o.exceptions != null && <span className="text-ink-600"><span className="text-ink-400">Exceptions:</span> {o.exceptions}</span>}
                          </div>
                        )}
                        <ViewField label="Description" value={o.description} />
                        <ViewField label="Risk summary" value={o.riskSummary} />
                        {o.actionPlans.length > 0 && (
                          <div>
                            <div className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-ink-500 mb-1.5">Action plans</div>
                            <div className="space-y-2">
                              {o.actionPlans.map((p, pi) => (
                                <div key={pi} className="rounded-sm border border-canvas-border bg-canvas p-2.5 space-y-1.5">
                                  {p.text && <div className="text-[0.71875rem] text-ink-800 leading-snug">{p.text}</div>}
                                  <div className="flex items-center gap-3 flex-wrap text-[0.625rem] text-ink-500">
                                    {p.dueDate && <span>Due {p.dueDate}</span>}
                                    {p.status && <span className="font-semibold text-ink-700">{p.status}</span>}
                                  </div>
                                  <ViewField small label="Action taken" value={p.actionTaken} />
                                  <ViewField small label="Evidence" value={p.evidence} />
                                  <ViewField small label="Verification" value={p.verification} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Missing-field resolver */}
                  {isOpen && miss.length > 0 && (
                    <div className="px-3 pb-3 pt-1 bg-canvas space-y-2">
                      {miss.map(f => {
                        const isEditing = editing[o._id] === f;
                        return (
                          <div key={f} className="rounded-md border border-canvas-border bg-canvas-elevated px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[0.71875rem] font-semibold text-ink-700">{FIELD_LABEL[f]}</span>
                              {!isEditing && (
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => setEditing(s => ({ ...s, [o._id]: f }))} className="inline-flex items-center gap-1 h-6 px-2 rounded-sm bg-brand-50 text-brand-700 text-[0.625rem] font-semibold hover:bg-brand-100 cursor-pointer"><Pencil size={10} /> Fill manually</button>
                                  <button onClick={() => patch(o._id, x => ({ ...x, skipped: [...x.skipped, f] }))} className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border border-canvas-border text-ink-500 text-[0.625rem] font-semibold hover:text-ink-800 cursor-pointer"><Ban size={10} /> Skip from ATR</button>
                                </div>
                              )}
                            </div>
                            {isEditing && (
                              <div className="mt-1.5">
                                {f === 'classification' || f === 'risk' ? (
                                  <select
                                    autoFocus
                                    className={INPUT}
                                    defaultValue=""
                                    onChange={e => { patch(o._id, x => setField(x, f, e.target.value)); setEditing(s => ({ ...s, [o._id]: null })); }}
                                  >
                                    <option value="" disabled>Select…</option>
                                    {(f === 'risk' ? RISK_OPTS : CLASS_OPTS).map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                ) : (
                                  <textarea
                                    autoFocus
                                    rows={2}
                                    placeholder={`Enter ${FIELD_LABEL[f].toLowerCase()}…`}
                                    className={`${INPUT} resize-y`}
                                    onBlur={e => { if (e.target.value.trim()) patch(o._id, x => setField(x, f, e.target.value.trim())); setEditing(s => ({ ...s, [o._id]: null })); }}
                                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur(); }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Resolved note */}
                  {isOpen && miss.length === 0 && (
                    <div className="px-3 pb-2.5 text-[0.6875rem] text-compliant-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> All fields resolved.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right rail */}
        <aside className="rounded-lg border border-canvas-border bg-canvas p-4 h-fit lg:sticky lg:top-0">
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2.5">Running summary</div>
          <div className="space-y-1.5 mb-3">
            <Row label="Selected" value={`${selected} / ${observations.length}`} strong />
            <Row label="Skipped fields" value={String(observations.reduce((n, o) => n + o.skipped.length, 0))} />
          </div>
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">By status</div>
          <div className="space-y-1 mb-3">
            {(['Complete', 'In Progress', 'Open', 'Overdue'] as const).map(s => (
              <Row key={s} label={s} value={String(byStatus[s])} dot={STATUS_DOT[s]} />
            ))}
          </div>
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">By risk</div>
          <div className="space-y-1 mb-3">
            {RISK_OPTS.map(r => <Row key={r} label={r} value={String(byRisk[r])} />)}
          </div>
          <div className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-1.5">By classification</div>
          <div className="space-y-1">
            {CLASS_OPTS.map(c => <Row key={c} label={c} value={String(byClass[c])} />)}
          </div>
          {selected === 0 && (
            <div className="mt-3 flex items-start gap-1.5 text-[0.625rem] text-risk-700"><Info size={11} className="mt-0.5 shrink-0" /> Select at least one observation to continue.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ViewField({ label, value, small }: { label: string; value?: string; small?: boolean }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <div className={`font-semibold uppercase tracking-[0.08em] text-ink-500 ${small ? 'text-[0.5625rem]' : 'text-[0.625rem]'} mb-0.5`}>{label}</div>
      <div className={`text-ink-700 leading-snug ${small ? 'text-[0.6875rem]' : 'text-[0.71875rem]'}`}>{value}</div>
    </div>
  );
}

function Row({ label, value, strong, dot }: { label: string; value: string; strong?: boolean; dot?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[0.71875rem]">
      <span className="text-ink-500 truncate flex items-center gap-1.5">
        {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
        {label}
      </span>
      <span className={strong ? 'font-bold text-ink-900 tabular-nums' : 'font-semibold text-ink-700 tabular-nums'}>{value}</span>
    </div>
  );
}
