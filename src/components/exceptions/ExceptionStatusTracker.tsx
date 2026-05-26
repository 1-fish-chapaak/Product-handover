import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, ShieldCheck, X } from 'lucide-react';
import {
  GRC_EXCEPTIONS,
  GRC_BULK_ACTIONS,
  ACTION_HUB_TIMELINE,
  type GrcException,
  type GrcExceptionStatus,
  type GrcExceptionClassification,
  type GrcExceptionSeverity,
  type ActionHubEvent,
} from '../../data/mockData';

const STATUS_STYLE: Record<GrcExceptionStatus, string> = {
  Open:           'bg-[#EEEEF1] text-ink-600',
  'Under Review': 'bg-mitigated-50 text-mitigated-700',
  Closed:         'bg-compliant-50 text-compliant-700',
};
const STATUS_LABEL: Record<GrcExceptionStatus, string> = {
  Open:           'Open',
  'Under Review': 'In-Progress',
  Closed:         'Closed',
};

const CLASSIFICATION_STYLE: Record<GrcExceptionClassification, string> = {
  Unclassified:                'bg-[#F4F2F7] text-ink-600',
  'Design Deficiency':         'bg-high-50 text-high-700',
  'System Deficiency':         'bg-risk-50 text-risk-700',
  'Procedural Non-Compliance': 'bg-brand-50 text-brand-700',
  'Business as Usual':         'bg-compliant-50 text-compliant-700',
  'False Positive':            'bg-[#EEEEF1] text-ink-600',
};

const SEVERITY_STYLE: Record<GrcExceptionSeverity, string> = {
  High:   'bg-high-50 text-high-700',
  Medium: 'bg-mitigated-50 text-mitigated-700',
  Low:    'bg-compliant-50 text-compliant-700',
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 text-[0.6875rem] font-medium rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

interface ActionGroup {
  actionId: string;
  title?: string;
  exceptions: GrcException[];
}

interface ActionPlanBuckets {
  bulk: ActionGroup[];
  individual: ActionGroup[];
}

// Group every exception by its action ID, then partition action groups by
// whether they cover multiple cases (bulk) or just one (individual).
// Exceptions with no actionId are skipped — they have no action plan yet.
function buildActionPlans(exceptions: GrcException[]): ActionPlanBuckets {
  const byAction = new Map<string, GrcException[]>();
  exceptions.forEach(ex => {
    if (!ex.bulkId) return;
    const arr = byAction.get(ex.bulkId) ?? [];
    arr.push(ex);
    byAction.set(ex.bulkId, arr);
  });
  const bulk: ActionGroup[] = [];
  const individual: ActionGroup[] = [];
  byAction.forEach((arr, actionId) => {
    const title = GRC_BULK_ACTIONS[actionId]?.title;
    const group: ActionGroup = { actionId, title, exceptions: arr };
    if (arr.length >= 2) bulk.push(group);
    else individual.push(group);
  });
  // Stable order — by action ID.
  bulk.sort((a, b) => a.actionId.localeCompare(b.actionId));
  individual.sort((a, b) => a.actionId.localeCompare(b.actionId));
  return { bulk, individual };
}

function lastActionFor(id: string, timeline: ActionHubEvent[]): { message: string; date: string } | null {
  const hit = timeline.find(ev => ev.exceptionId === id);
  return hit ? { message: hit.message, date: hit.date.replace(/ 2026$/, ' 26') } : null;
}

function statusPills(exceptions: GrcException[]) {
  const counts: Partial<Record<GrcExceptionStatus, number>> = {};
  exceptions.forEach(e => { counts[e.status] = (counts[e.status] ?? 0) + 1; });
  const order: GrcExceptionStatus[] = ['Open', 'Under Review', 'Closed'];
  return order
    .filter(s => counts[s])
    .map(s => <Pill key={s} className={STATUS_STYLE[s]}>{counts[s]} {STATUS_LABEL[s]}</Pill>);
}

function idChipRow(ids: string[], max = 4) {
  const visible = ids.slice(0, max);
  const rest = ids.length - visible.length;
  return (
    <div className="flex items-center gap-1.5">
      {visible.map(id => (
        <span key={id} className="inline-flex items-center h-5 px-1.5 text-[0.75rem] font-mono bg-[#F4F2F7] text-ink-500 rounded">
          {id}
        </span>
      ))}
      {rest > 0 && (
        <span className="text-[0.75rem] font-medium text-ink-500 tabular-nums">+{rest}</span>
      )}
    </div>
  );
}

function AvatarChip({ name, initials }: { name: string; initials: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[0.625rem] font-semibold tracking-wider">
        {initials}
      </span>
      <span className="text-[0.75rem] text-ink-800">{name}</span>
    </div>
  );
}

function truncate(text: string, n = 40) {
  return text.length > n ? text.slice(0, n).trimEnd() + '…' : text;
}

function ActionGroupRow({
  group,
  isOpen,
  onToggle,
  onPreview,
}: {
  group: ActionGroup;
  isOpen: boolean;
  onToggle: () => void;
  onPreview: (ex: GrcException) => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3 cursor-pointer text-left hover:bg-[#FAFAFB]"
      >
        <span className="w-5 h-5 flex items-center justify-center text-ink-500">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="inline-flex items-center h-6 px-2.5 text-[0.75rem] font-mono font-semibold bg-brand-50 text-brand-700 rounded-full">
          {group.actionId}
        </span>
        {group.title && (
          <span className="text-[0.75rem] text-ink-700 truncate">{group.title}</span>
        )}
        <span className="text-[0.75rem] text-ink-500 tabular-nums whitespace-nowrap">
          {group.exceptions.length} exception{group.exceptions.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-1.5">{statusPills(group.exceptions)}</div>
        <div className="flex-1" />
        {!isOpen && idChipRow(group.exceptions.map(e => e.id))}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-3">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="text-left text-ink-500 uppercase tracking-wider">
                    <th className="px-3 py-2 font-medium text-[0.75rem]">Exception ID</th>
                    <th className="px-3 py-2 font-medium text-[0.75rem]">Risk Category</th>
                    <th className="px-3 py-2 font-medium text-[0.75rem]">Classification</th>
                    <th className="px-3 py-2 font-medium text-[0.75rem]">Status</th>
                    <th className="px-3 py-2 font-medium text-[0.75rem]">Assigned To</th>
                    <th className="px-3 py-2 font-medium text-[0.75rem]">Last Action</th>
                    <th className="px-3 py-2 font-medium text-[0.75rem] text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {group.exceptions.map(ex => {
                    const last = lastActionFor(ex.id, ACTION_HUB_TIMELINE);
                    return (
                      <tr
                        key={ex.id}
                        onClick={() => onPreview(ex)}
                        className="border-t border-canvas-border hover:bg-brand-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5 align-middle">
                          <span className="text-brand-700 font-medium font-mono text-[0.75rem]">{ex.id}</span>
                        </td>
                        <td className="px-3 py-2.5 align-middle text-ink-800">{ex.riskCategory}</td>
                        <td className="px-3 py-2.5 align-middle">
                          <Pill className={CLASSIFICATION_STYLE[ex.classification]}>{ex.classification}</Pill>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <Pill className={STATUS_STYLE[ex.status]}>{STATUS_LABEL[ex.status]}</Pill>
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <AvatarChip name={ex.assignedTo?.name ?? '—'} initials={ex.assignedTo?.initials ?? '—'} />
                        </td>
                        <td className="px-3 py-2.5 align-middle text-ink-600 text-[0.75rem]">
                          {last ? truncate(last.message, 42) : '—'}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-right text-ink-500 text-[0.75rem] tabular-nums whitespace-nowrap">
                          {last?.date ?? ex.lastUpdated}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ExceptionStatusTracker({
  exceptions = GRC_EXCEPTIONS,
}: { exceptions?: GrcException[] }) {
  const buckets = useMemo(() => buildActionPlans(exceptions), [exceptions]);
  const totalCases = buckets.bulk.reduce((n, g) => n + g.exceptions.length, 0)
                   + buckets.individual.reduce((n, g) => n + g.exceptions.length, 0);

  const [sectionOpen, setSectionOpen] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(true);
  const [individualOpen, setIndividualOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<GrcException | null>(null);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      <section className="bg-canvas-elevated border border-canvas-border rounded-[12px] overflow-hidden mb-4">
        <button
          onClick={() => setSectionOpen(o => !o)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#F4F2F7] text-ink-600 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[0.875rem] font-semibold text-ink-900">Action Plan Status Tracker</h3>
                <span className="inline-flex items-center h-5 px-2 text-[0.6875rem] font-medium bg-[#F4F2F7] text-ink-600 rounded-full tabular-nums">
                  {totalCases}
                </span>
              </div>
              <p className="text-[0.75rem] text-ink-500 mt-0.5">Exceptions grouped by Action ID — Click a group to Expand</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-ink-500 transition-transform ${sectionOpen ? '' : '-rotate-90'}`} />
        </button>

        <AnimatePresence initial={false}>
          {sectionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-canvas-border">
                {/* Action Plans → Bulk subsection */}
                <div className="border-b border-canvas-border">
                  <button
                    onClick={() => setBulkOpen(o => !o)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 bg-[#FAFAFB] cursor-pointer text-left hover:bg-[#F4F2F7]"
                  >
                    <ChevronDown size={14} className={`text-ink-500 transition-transform ${bulkOpen ? '' : '-rotate-90'}`} />
                    <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-700">Bulk</span>
                    <span className="inline-flex items-center h-5 px-2 text-[0.6875rem] font-medium bg-brand-50 text-brand-700 rounded-full tabular-nums">
                      {buckets.bulk.length} {buckets.bulk.length === 1 ? 'group' : 'groups'}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {bulkOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-canvas-border">
                          {buckets.bulk.length === 0 ? (
                            <div className="px-5 py-4 text-[0.75rem] text-ink-500">No bulk action plans yet.</div>
                          ) : (
                            buckets.bulk.map(group => (
                              <ActionGroupRow
                                key={group.actionId}
                                group={group}
                                isOpen={expanded.has(group.actionId)}
                                onToggle={() => toggle(group.actionId)}
                                onPreview={setPreview}
                              />
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Plans → Individual subsection */}
                <div>
                  <button
                    onClick={() => setIndividualOpen(o => !o)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 bg-[#FAFAFB] cursor-pointer text-left hover:bg-[#F4F2F7]"
                  >
                    <ChevronDown size={14} className={`text-ink-500 transition-transform ${individualOpen ? '' : '-rotate-90'}`} />
                    <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-700">Individual</span>
                    <span className="inline-flex items-center h-5 px-2 text-[0.6875rem] font-medium bg-brand-50 text-brand-700 rounded-full tabular-nums">
                      {buckets.individual.length} {buckets.individual.length === 1 ? 'group' : 'groups'}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {individualOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="divide-y divide-canvas-border">
                          {buckets.individual.length === 0 ? (
                            <div className="px-5 py-4 text-[0.75rem] text-ink-500">No individual action plans yet.</div>
                          ) : (
                            buckets.individual.map(group => (
                              <ActionGroupRow
                                key={group.actionId}
                                group={group}
                                isOpen={expanded.has(group.actionId)}
                                onToggle={() => toggle(group.actionId)}
                                onPreview={setPreview}
                              />
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {preview && <ExceptionPreviewDrawer exception={preview} onClose={() => setPreview(null)} />}
      </AnimatePresence>
    </>
  );
}

function ExceptionPreviewDrawer({ exception, onClose }: { exception: GrcException; onClose: () => void }) {
  const isBulk = Boolean(exception.bulkId);
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] bg-canvas-elevated shadow-xl border-l border-canvas-border flex flex-col z-50"
        role="dialog"
        aria-label={`Preview ${exception.id}`}
      >
        <header className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div>
            <h2 className="font-display text-[1.125rem] font-semibold text-ink-900 tracking-tight font-mono">{exception.id}</h2>
            <p className="text-[0.75rem] text-ink-500 mt-0.5 leading-snug">{exception.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="border border-canvas-border rounded-[12px] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Pill className="bg-brand-50 text-brand-700 font-mono">{exception.id}</Pill>
                {isBulk && <Pill className="bg-brand-50 text-brand-700">Bulk</Pill>}
              </div>
              <Pill className={SEVERITY_STYLE[exception.severity]}>{exception.severity}</Pill>
            </div>
            <h3 className="text-[0.875rem] font-semibold text-ink-900 leading-snug mb-3">{exception.title}</h3>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Pill className={STATUS_STYLE[exception.status]}>{STATUS_LABEL[exception.status]}</Pill>
                <Pill className={CLASSIFICATION_STYLE[exception.classification]}>{exception.classification}</Pill>
              </div>
              <span className="text-[0.75rem] text-ink-700">{exception.assignedTo?.name ?? '—'}</span>
            </div>
          </div>
        </div>
        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border text-right text-[0.75rem] text-ink-500">
          1 exception shown
        </footer>
      </motion.aside>
    </>
  );
}
