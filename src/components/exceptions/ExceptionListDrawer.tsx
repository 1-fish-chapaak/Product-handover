import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Hash, Layers, Link as LinkIcon, ExternalLink } from 'lucide-react';
import {
  GRC_CASE_DETAILS,
  type GrcException,
  type GrcExceptionStatus,
  type GrcExceptionClassification,
} from '../../data/mockData';
import { exceptionActionsFor, type ExceptionActionKind } from './statusModel';

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

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 text-[11px] font-medium rounded-full whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

const planTitleOf = (exs: GrcException[]) => {
  const d = GRC_CASE_DETAILS[exs[0]?.id];
  return d?.actionPlans?.[0]?.name || d?.actionTitle || 'Management action plan';
};

function ExceptionCard({ ex, onClick }: { ex: GrcException; onClick?: () => void }) {
  const isBulk = Boolean(ex.bulkId);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group w-full text-left border border-canvas-border rounded-[12px] p-4 transition-colors enabled:hover:border-brand-300 enabled:hover:bg-brand-50/20 enabled:cursor-pointer disabled:cursor-default"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[12.5px] font-semibold text-brand-700 whitespace-nowrap">{ex.id}</span>
          {isBulk && (
            <span className="inline-flex items-center h-5 px-2 text-[10.5px] font-medium bg-brand-50 text-brand-700 rounded-full">
              Bulk
            </span>
          )}
        </div>
        <Pill className={STATUS_STYLE[ex.status]}>{STATUS_LABEL[ex.status]}</Pill>
      </div>
      <h4 className="text-[14px] font-semibold text-ink-900 leading-snug mb-2.5">{ex.title}</h4>
      <div className="flex items-center justify-between gap-3">
        <Pill className={CLASSIFICATION_STYLE[ex.classification]}>{ex.classification}</Pill>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-ink-700">{ex.assignedTo?.name ?? 'Unassigned'}</span>
          {onClick && (
            <span className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Details <ChevronRight size={13} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// One card per management action plan (Actionable ID). The relative action can be
// performed right here; "View all cases" opens the linked-exceptions modal — so the
// user acts from the slide panel with the fewest clicks.
function PlanRow({ aid, exs, role, onViewDetail, onViewBulk, onAction }: {
  aid: string;
  exs: GrcException[];
  role?: 'risk-owner' | 'auditor';
  /** Open the management action plan / case detail directly. */
  onViewDetail: () => void;
  /** Open the list of all linked cases (bulk groups only). */
  onViewBulk?: () => void;
  onAction?: (kind: ExceptionActionKind, ex: GrcException) => void;
}) {
  const counts: Partial<Record<GrcExceptionStatus, number>> = {};
  exs.forEach(e => { counts[e.status] = (counts[e.status] ?? 0) + 1; });
  const order: GrcExceptionStatus[] = ['Open', 'Under Review', 'Closed'];
  const isBulk = exs.length > 1;
  // The relative next action for this plan (first eligible case in the group).
  const actEx = role ? exs.find(e => exceptionActionsFor(e, role).length > 0) : undefined;
  const act = actEx && role ? exceptionActionsFor(actEx, role)[0] : undefined;

  return (
    <div className="rounded-[12px] border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700">
          <LinkIcon size={13} /> {isBulk ? 'Part of Bulk Action' : 'Management Action Plan'}
        </div>
        <div className="flex items-center gap-1.5">{order.filter(s => counts[s]).map(s => <Pill key={s} className={STATUS_STYLE[s]}>{counts[s]} {STATUS_LABEL[s]}</Pill>)}</div>
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-ink-700 mb-1">
        <span className="inline-flex items-center gap-1 font-mono"><Hash size={11} className="text-brand-600" /><span className="font-bold text-brand-700">{aid}</span></span>
        <span className="text-ink-300">|</span>
        <span className="tabular-nums">{exs.length} {exs.length === 1 ? 'case' : 'cases'} grouped</span>
      </div>
      <div className="text-[13.5px] font-semibold text-ink-900 leading-snug mb-3">{planTitleOf(exs)}</div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <button type="button" onClick={onViewDetail} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-600 cursor-pointer">
            View case detail <ExternalLink size={12} />
          </button>
          {isBulk && onViewBulk && (
            <button type="button" onClick={onViewBulk} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-500 hover:text-ink-700 cursor-pointer">
              View all cases in this bulk action <ExternalLink size={12} />
            </button>
          )}
        </div>
        {act && actEx && onAction && (
          <button
            type="button"
            onClick={() => onAction(act.kind, actEx)}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-[8px] cursor-pointer transition-colors"
          >
            {act.label} <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// Modal listing the exceptions linked to one Actionable ID; each deep-dives.
function LinkedExceptionsModal({ aid, exs, onClose, onSelect }: {
  aid: string; exs: GrcException[]; onClose: () => void; onSelect: (ex: GrcException) => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
        className="fixed inset-0 bg-ink-900/50 backdrop-blur-[2px] z-[60]" onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[92vw] max-h-[82vh] bg-canvas-elevated rounded-[16px] shadow-xl border border-canvas-border z-[70] flex flex-col"
        role="dialog" aria-label={`Exceptions linked to ${aid}`}
      >
        <header className="shrink-0 px-6 py-5 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 h-6 px-2.5 text-[12px] font-mono font-semibold rounded-full bg-brand-50 text-brand-700"><Hash size={11} /> {aid}</span>
              <span className="text-[11.5px] text-ink-400 tabular-nums">{exs.length} linked {exs.length === 1 ? 'exception' : 'exceptions'}</span>
            </div>
            <h2 className="text-[14.5px] font-semibold text-ink-900 leading-snug">{planTitleOf(exs)}</h2>
            <p className="text-[11.5px] text-ink-500 mt-0.5">Select an exception to view its full detail and take action.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {exs.map(ex => <ExceptionCard key={ex.id} ex={ex} onClick={() => onSelect(ex)} />)}
        </div>
      </motion.div>
    </>
  );
}

export default function ExceptionListDrawer({
  title,
  subtitle,
  exceptions,
  onClose,
  onSelectException,
  groupByActionable = false,
  role,
  onAction,
}: {
  title: string;
  subtitle: string;
  exceptions: GrcException[];
  onClose: () => void;
  onSelectException?: (ex: GrcException) => void;
  /** Segregate by Actionable ID (management action plan) as cards; the relative
   *  action is performed inline and the linked cases open in a modal. */
  groupByActionable?: boolean;
  /** Active persona — drives the inline action shown per action plan. */
  role?: 'risk-owner' | 'auditor';
  /** Perform the relative action directly from the slide panel. */
  onAction?: (kind: ExceptionActionKind, ex: GrcException) => void;
}) {
  const [modalAid, setModalAid] = useState<string | null>(null);

  const groups = (() => {
    const m = new Map<string, GrcException[]>();
    exceptions.forEach(ex => {
      const k = ex.actionableId ?? '—';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ex);
    });
    return [...m.entries()];
  })();
  const modalGroup = modalAid ? groups.find(([aid]) => aid === modalAid) : null;

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
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-32px)] max-w-[880px] max-h-[88vh] bg-canvas-elevated shadow-xl border border-canvas-border rounded-[16px] flex flex-col z-50"
        role="dialog"
        aria-label={title}
      >
        <header className="shrink-0 px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-canvas-border">
          <div>
            <h2 className="text-[20px] font-semibold text-ink-900 tracking-tight">{title}</h2>
            <p className="text-[12.5px] text-ink-500 mt-0.5">
              {groupByActionable ? `${groups.length} management action plan${groups.length === 1 ? '' : 's'} · grouped by Actionable ID` : subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-ink-500 hover:text-ink-800 hover:bg-[#F4F2F7] flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {exceptions.length === 0 ? (
            <div className="text-[13px] text-ink-500 text-center py-12">No exceptions match this filter.</div>
          ) : groupByActionable ? (
            groups.map(([aid, exs]) => (
              <PlanRow
                key={aid}
                aid={aid}
                exs={exs}
                role={role}
                onViewDetail={() => onSelectException?.(exs[0])}
                onViewBulk={exs.length > 1 ? () => setModalAid(aid) : undefined}
                onAction={onAction}
              />
            ))
          ) : (
            exceptions.map(ex => <ExceptionCard key={ex.id} ex={ex} onClick={onSelectException ? () => onSelectException(ex) : undefined} />)
          )}
        </div>
        <footer className="shrink-0 px-6 py-3 border-t border-canvas-border flex items-center justify-end gap-1.5 text-[11.5px] text-ink-500 tabular-nums">
          {groupByActionable ? (
            <><Layers size={12} className="text-ink-400" /> {groups.length} action plan{groups.length === 1 ? '' : 's'} · {exceptions.length} {exceptions.length === 1 ? 'exception' : 'exceptions'}</>
          ) : (
            <>{exceptions.length} {exceptions.length === 1 ? 'exception' : 'exceptions'} shown</>
          )}
        </footer>
      </motion.aside>

      {/* Linked-exceptions modal — opened from a plan row */}
      <AnimatePresence>
        {modalGroup && (
          <LinkedExceptionsModal
            key={modalGroup[0]}
            aid={modalGroup[0]}
            exs={modalGroup[1]}
            onClose={() => setModalAid(null)}
            onSelect={(ex) => { setModalAid(null); onSelectException?.(ex); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
