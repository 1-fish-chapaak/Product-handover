/**
 * Batch builds in Ask IRA.
 *
 * BatchBuildCard — sits in the main chat while Ira builds several workflows
 * in one go. One expandable row per workflow: status, data it read, result,
 * the assumptions Ira made, and "Review ↗", which opens that workflow's own
 * session in a new tab. Building several workflows in one thread got
 * unreadable fast; each one reviewed in its own session doesn't.
 *
 * ReviewSessionCard — what that new tab opens on: the one workflow, its
 * result and assumptions, any question Ira needs answered, and Approve.
 * Both read the shared batch store, which syncs across tabs.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight, Check, CheckCheck, ChevronRight, CircleDashed, Clock, Database, ExternalLink, FileUp, Loader2, Workflow as WorkflowIcon,
} from 'lucide-react';
import { Button } from '../shared/Button';
import {
  BOARD_PEOPLE, answerMissingFile, answerSession, approveSession, assignSession, ensureBatchRunning, findSession, fmtHours, hash01, itemHours,
  nextPendingSession, sessionHref, useBatch, useSession, type BatchItem, type BatchItemStatus,
} from '../../data/auditPlan';
import { useNotify } from '../../notifications/NotificationContext';
import { useToast } from '../shared/Toast';
import { useCan, useCurrentUser } from '../../context/CurrentUserContext';
import { IraMark } from '../audit-plan/PlanParts';

const STATUS: Record<BatchItemStatus, { label: string; cls: string }> = {
  queued:        { label: 'Queued',          cls: 'text-ink-400' },
  building:      { label: 'Building',        cls: 'text-brand-700' },
  ready:         { label: 'Ready to review', cls: 'text-compliant-700' },
  'needs-input': { label: 'Needs your input', cls: 'text-mitigated-700' },
  approved:      { label: 'Approved',        cls: 'text-compliant-700' },
};

function StatusIcon({ status, left }: { status: BatchItemStatus; left?: boolean }) {
  if (status === 'building') return <Loader2 size={14} className="animate-spin text-brand-600 shrink-0" aria-hidden />;
  if (status === 'ready') return <Check size={14} className="text-compliant-700 shrink-0" aria-hidden />;
  if (status === 'approved') return <CheckCheck size={14} className="text-compliant-700 shrink-0" aria-hidden />;
  if (status === 'needs-input') return <CircleDashed size={14} className={`shrink-0 ${left ? 'text-ink-400' : 'text-mitigated-700'}`} aria-hidden />;
  return <Clock size={14} className="text-ink-300 shrink-0" aria-hidden />;
}

const leftAsDraft = (i: BatchItem) => i.status === 'needs-input' && !!i.answer?.startsWith('Leave');
const fmt = (n: number) => n.toLocaleString('en-IN');

export function BatchBuildCard({ batchId, onOpenEngagement, onOpenLibrary, onOpenControls }: {
  batchId: string;
  onOpenEngagement?: (id: string) => void;
  onOpenLibrary?: () => void;
  onOpenControls?: () => void;
}) {
  const batch = useBatch(batchId);
  const [open, setOpen] = useState<string | null>(null);
  const missingInput = useRef<HTMLInputElement>(null);
  const missingCode = useRef<string | null>(null);
  useEffect(() => { ensureBatchRunning(batchId); }, [batchId]);
  if (!batch) {
    return <div className="text-[0.8125rem] text-ink-500">This batch is no longer available.</div>;
  }
  const n = (s: BatchItemStatus) => batch.items.filter(i => i.status === s).length;
  const done = batch.items.filter(i => i.status === 'ready' || i.status === 'approved' || i.status === 'needs-input').length;
  const finished = done === batch.items.length;
  // A file several workflows are missing is asked for once, not per workflow.
  const missingByCode = new Map<string, { name: string; count: number }>();
  batch.items.filter(i => i.status === 'needs-input' && !leftAsDraft(i)).forEach(i => {
    const f = i.files.find(x => !x.source);
    if (f) missingByCode.set(f.code, { name: f.name, count: (missingByCode.get(f.code)?.count ?? 0) + 1 });
  });
  const toReview = batch.items.filter(i => i.status === 'ready');
  const reviewHours = toReview.reduce((sum, i) => sum + itemHours(i), 0);
  const firstPending = toReview[0] ?? batch.items.find(i => i.status === 'needs-input' && !leftAsDraft(i));

  return (
    <div className="max-w-[46rem] rounded-lg border border-canvas-border bg-canvas-elevated">
      <div className="flex items-start gap-3 p-4 pb-3">
        <IraMark size={26} />
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink-900">{batch.title}</div>
          <div className="text-[0.75rem] text-ink-500 tabular-nums">
            {finished ? 'All built' : `Building ${Math.min(done + 1, batch.items.length)} of ${batch.items.length}`}
            {' · '}{n('ready') + n('approved')} ready{n('approved') ? ` (${n('approved')} approved)` : ''}
            {n('needs-input') ? ` · ${n('needs-input')} need your input` : ''}
            {batch.engagementName ? ` · ${batch.engagementName}` : ''}
          </div>
          <div className="mt-2 flex items-center gap-1" aria-hidden>
            {batch.items.map(i => (
              <span
                key={i.id}
                className={`h-1.5 flex-1 rounded-full ${
                  i.status === 'approved' || i.status === 'ready' ? 'bg-brand-600'
                  : i.status === 'building' ? 'bg-brand-300'
                  : i.status === 'needs-input' ? 'bg-mitigated-500'
                  : 'bg-paper-100'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {(missingByCode.size > 0 || toReview.length > 0) && (
        <div className="border-t border-canvas-border px-4 py-2.5 space-y-2 bg-paper-50/50">
          {[...missingByCode.entries()].map(([code, m]) => (
            <div key={code} className="flex items-center gap-2 text-[0.75rem]">
              <CircleDashed size={13} className="text-mitigated-700 shrink-0" aria-hidden />
              <span className="text-ink-700 min-w-0 flex-1">
                <span className="font-mono font-semibold">{code}</span> ({m.name}) is missing for <span className="font-semibold">{m.count}</span> workflow{m.count === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => { missingCode.current = code; missingInput.current?.click(); }}
                className="h-7 px-2.5 rounded-md border border-canvas-border bg-white text-[0.75rem] font-semibold text-brand-700 hover:border-brand-300 cursor-pointer whitespace-nowrap"
              >
                Upload once
              </button>
            </div>
          ))}
          {toReview.length > 0 && firstPending && (
            <div className="flex items-center gap-2 text-[0.75rem]">
              <Check size={13} className="text-compliant-700 shrink-0" aria-hidden />
              <span className="text-ink-700 min-w-0 flex-1">
                <span className="font-semibold">{toReview.length}</span> ready to review — approving adds <span className="font-semibold">{fmtHours(reviewHours)}/mo</span> <span className="text-ink-400">est.</span>
              </span>
              <a
                href={sessionHref(firstPending.sessionId)}
                target="_blank"
                rel="noopener"
                className="h-7 px-2.5 rounded-md bg-brand-600 text-white text-[0.75rem] font-semibold inline-flex items-center gap-1 hover:bg-brand-700 whitespace-nowrap"
              >
                Review next <ArrowUpRight size={12} />
              </a>
            </div>
          )}
        </div>
      )}

      <ul className="border-t border-canvas-border divide-y divide-canvas-border">
        {batch.items.map(i => {
          const isOpen = open === i.id;
          const reviewable = i.status !== 'queued' && i.status !== 'building';
          return (
            <li key={i.id}>
              <div className="flex items-center gap-2.5 px-4 h-11">
                <button
                  onClick={() => setOpen(isOpen ? null : i.id)}
                  aria-expanded={isOpen}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <ChevronRight size={13} className={`text-ink-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <StatusIcon status={i.status} left={leftAsDraft(i)} />
                  <span className="text-[0.8125rem] font-medium text-ink-900 truncate">{i.name}</span>
                  <span className="font-mono text-[0.6875rem] text-ink-400 shrink-0">{i.controlId}</span>
                </button>
                {i.assignee && (i.status === 'ready' || i.status === 'needs-input') && (
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-paper-100 text-[0.6875rem] text-ink-600 shrink-0" title={`Assigned by ${i.assignedBy ?? 'a teammate'}`}>
                    with {i.assignee.split(' ')[0]}
                  </span>
                )}
                <span className={`text-[0.75rem] shrink-0 ${leftAsDraft(i) ? 'text-ink-400' : STATUS[i.status].cls}`}>
                  {leftAsDraft(i) ? 'Left as draft' : i.status === 'ready' && i.exceptions != null ? `${i.exceptions} exceptions · +${fmtHours(itemHours(i))}/mo` : STATUS[i.status].label}
                </span>
                {reviewable ? (
                  <a
                    href={sessionHref(i.sessionId)}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-50 shrink-0"
                    aria-label={`Review ${i.name} in a new tab`}
                  >
                    Review <ArrowUpRight size={12} />
                  </a>
                ) : <span className="w-[4.5rem] shrink-0" />}
              </div>
              {isOpen && <ItemDetail item={i} />}
            </li>
          );
        })}
      </ul>

      {finished && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-canvas-border">
          <span className="text-[0.75rem] text-ink-500">
            Open each to review and approve. {n('needs-input') > 0 ? 'Workflows that need input wait in their session.' : ''}
          </span>
          <span className="flex items-center gap-2">
            {batch.engagementId && onOpenEngagement && (
              <Button variant="outline" size="sm" rightIcon={<ExternalLink size={12} />} onClick={() => onOpenEngagement(batch.engagementId!)}>Open engagement</Button>
            )}
            {batch.origin === 'adapt' && onOpenControls && <Button variant="outline" size="sm" onClick={onOpenControls}>Control Library</Button>}
            {onOpenLibrary && <Button variant="ghost" size="sm" onClick={onOpenLibrary}>Workflow Library</Button>}
          </span>
        </div>
      )}
      <input
        ref={missingInput}
        type="file"
        multiple
        className="hidden"
        accept=".csv,.xlsx,.xls,.txt"
        onChange={e => {
          const code = missingCode.current;
          const names = Array.from(e.target.files ?? []).map(f => f.name);
          if (code && names.length > 0) answerMissingFile(batchId, code, names);
          e.target.value = '';
          missingCode.current = null;
        }}
      />
    </div>
  );
}

/** Hand a review to a teammate (with a notification), or copy its link. */
function AssignControl({ item: i, compact }: { item: BatchItem; compact?: boolean }) {
  const { currentUser } = useCurrentUser();
  const notify = useNotify();
  const { addToast } = useToast();
  const me = currentUser?.name ?? 'You';
  if (i.status !== 'ready' && i.status !== 'needs-input') return null;
  const link = `${window.location.origin}${sessionHref(i.sessionId)}`;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'pt-2 mt-1 border-t border-canvas-border'}`}>
      <label className="flex items-center gap-1.5 text-[0.75rem] text-ink-500">
        Reviewer
        <select
          value={i.assignee ?? ''}
          onChange={e => {
            const person = e.target.value || null;
            assignSession(i.sessionId, person, me);
            if (person && person !== me) {
              notify({
                eventId: 'WFL-14',
                title: `${me} asked you to review ${i.name}`,
                message: `${i.controlId} · ${i.status === 'needs-input' ? 'needs a file before it can be approved' : `${i.exceptions ?? 0} exceptions on the first run`}.`,
                recipients: [{ name: person }],
                link: { view: 'builds' },
                linkLabel: 'Open review',
                dedupKey: `${i.sessionId}-${person}`,
              });
              addToast({ message: `Sent to ${person} — it leaves your queue`, type: 'success' });
            }
          }}
          className="h-7 rounded-md border border-canvas-border px-1.5 text-[0.75rem] text-ink-800 outline-none cursor-pointer max-w-[12rem]"
        >
          <option value="">Me (unassigned)</option>
          {BOARD_PEOPLE.filter(p => p !== me).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          try { void navigator.clipboard?.writeText(link); } catch { /* ignore */ }
          addToast({ message: 'Review link copied', type: 'success' });
        }}
        className="h-7 px-2 rounded-md text-[0.75rem] font-medium text-brand-700 hover:bg-brand-50 cursor-pointer"
      >
        Copy review link
      </button>
      {i.assignee && i.assignedBy && <span className="text-[0.6875rem] text-ink-400">assigned by {i.assignedBy}</span>}
    </div>
  );
}

function ItemDetail({ item: i }: { item: BatchItem }) {
  return (
    <div className="px-4 pb-3 pl-[3.25rem] text-[0.75rem]">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">Data</div>
        <ul className="space-y-0.5">
          {i.files.map(f => (
            <li key={f.code} className="flex items-center gap-2">
              <span className="font-mono font-semibold text-ink-800 w-14 shrink-0">{f.code}</span>
              {f.source
                ? <span className="text-ink-600 truncate">{f.source}</span>
                : <span className="text-risk-700">not found</span>}
            </li>
          ))}
        </ul>
        {i.rowsScanned != null && (
          <p className="mt-2 text-ink-600 tabular-nums">Scanned {fmt(i.rowsScanned)} rows · <span className="font-semibold text-ink-900">{i.exceptions}</span> exceptions</p>
        )}
      </div>
      <div>
        {i.status === 'needs-input' && i.question ? (
          <>
            <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-mitigated-700 mb-1">Ira needs</div>
            <p className="text-ink-700">{i.question.text}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {i.question.options.map(o => (
                <button key={o} onClick={() => answerSession(i.sessionId, o)} className="h-7 px-2.5 rounded-full border border-canvas-border text-[0.75rem] text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer">
                  {o}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">Assumptions</div>
            <ul className="space-y-0.5 text-ink-600">
              {i.assumptions.map(a => <li key={a}>— {a}</li>)}
            </ul>
          </>
        )}
      </div>
    </div>
    <AssignControl item={i} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const REASONS: Record<string, string[]> = {
  P2P: ['Same vendor, amount and invoice no. within 30 days', 'Paid within 48h of a bank-detail change', 'Approved below the DOA level for its value', 'No goods receipt before payment', 'Vendor shares a bank account with an employee'],
  O2C: ['Billed below the approved price list', 'Released above the credit limit', 'Delivered after period end, billed before', 'Credit note against a prior-period invoice', 'Receipt unapplied for over 30 days'],
  R2R: ['Posted at 22:41 on a Saturday', 'Preparer and approver are the same user', 'Round amount with a one-line narrative', 'GL and sub-ledger differ by more than ₹1L', 'Open in suspense for 47 days'],
  S2C: ['Invoiced after the contract expired', 'Awarded with one bid and no justification', 'Above the contract value cap', 'Top vendor share up 12 pts this quarter', 'Spend outside the contract scope'],
  INV: ['Book stock went negative on 14 Aug', 'Scrap above ₹1L without DOA approval', 'No movement in 214 days', 'Count differs from book by 6.2%', 'GRN posted 5 days before entry'],
  ITGC: ['Leaver still active 38 days after exit', 'Privileged session ran 6h overnight', 'Holds create-vendor and approve-payment', 'Deployed with no approved ticket', 'Access not recertified this quarter'],
};

function sampleRows(i: BatchItem) {
  const reasons = REASONS[i.process] ?? REASONS.P2P;
  const names = ['Global Supplies', 'TechParts Ltd', 'Bluepeak Logistics', 'FastShip Logistics', 'Arcadia Metals'];
  return Array.from({ length: Math.min(5, i.exceptions ?? 0) }, (_, k) => {
    const h = hash01(i.id + k);
    return {
      ref: `${i.process}-${String(40213 + Math.round(h * 9000))}`,
      entity: names[(k + Math.round(h * 4)) % names.length],
      amount: `₹${fmt(12_000 + Math.round(h * 380_000))}`,
      reason: reasons[k % reasons.length],
      severity: h > 0.66 ? 'High' : h > 0.33 ? 'Medium' : 'Low',
    };
  });
}

export function ReviewSessionCard({ sessionId, onAskChange, onNext }: {
  sessionId: string;
  onAskChange: (draft: string) => void;
  /** Move this tab on to the next workflow waiting for review. */
  onNext?: (sessionId: string) => void;
}) {
  const hit = useSession(sessionId);
  const { currentUser } = useCurrentUser();
  // Approving puts a workflow live and starts its hours — builders only.
  const { can } = useCan();
  const canApprove = can('wf_create');
  // Review at speed: A approves (and moves on), N skips to the next one.
  // Ignored while typing in the composer or any field.
  const keyRef = useRef<{ approve: () => void; skip: () => void }>({ approve: () => {}, skip: () => {} });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable) return;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); keyRef.current.approve(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); keyRef.current.skip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Point the shortcuts at the session currently shown (it changes in place).
  useEffect(() => {
    keyRef.current = {
      approve: () => {
        const h = findSession(sessionId);
        if (!h || h.item.status !== 'ready' || !canApprove) return;
        approveSession(sessionId, currentUser?.name ?? 'You');
        const n = nextPendingSession(sessionId);
        if (n && onNext) window.setTimeout(() => onNext(n), 450);
      },
      skip: () => { const n = nextPendingSession(sessionId); if (n && onNext) onNext(n); },
    };
  });
  if (!hit) {
    return (
      <div className="max-w-[44rem] rounded-lg border border-canvas-border bg-canvas-elevated p-4 text-[0.8125rem] text-ink-600">
        This review session isn't available in this browser — open it from the batch in Ask IRA.
      </div>
    );
  }
  const { batch, item: i } = hit;
  const rows = sampleRows(i);
  const next = nextPendingSession(sessionId);
  const left = batch.items.filter(x => x.sessionId !== sessionId && (x.status === 'ready' || (x.status === 'needs-input' && !leftAsDraft(x)))).length;
  const me = currentUser?.name ?? 'You';
  const approveAndNext = () => {
    if (i.status !== 'ready' || !canApprove) return;
    approveSession(i.sessionId, me);
    if (next && onNext) window.setTimeout(() => onNext(next), 450);
  };
  return (
    <div className="max-w-[48rem] rounded-lg border border-canvas-border bg-canvas-elevated">
      <div className="flex items-start gap-3 p-4">
        <span className="size-8 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><WorkflowIcon size={15} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[0.6875rem] text-ink-500">
            <span className="font-mono">{i.controlId}</span><span aria-hidden>·</span><span className="font-mono">{i.process}</span><span aria-hidden>·</span><span className="truncate">{batch.title}</span>
          </div>
          <div className="text-[1rem] font-semibold text-ink-900">{i.name}</div>
          <p className="text-[0.8125rem] text-ink-600 leading-relaxed">{i.description}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-[0.75rem] font-medium shrink-0 ${leftAsDraft(i) ? 'text-ink-400' : STATUS[i.status].cls}`}>
          <StatusIcon status={i.status} left={leftAsDraft(i)} /> {leftAsDraft(i) ? 'Left as draft' : STATUS[i.status].label}
        </span>
      </div>

      {(i.status === 'ready' || i.status === 'needs-input') && (
        <div className="mx-4 mb-3"><AssignControl item={i} compact /></div>
      )}

      {(i.status === 'queued' || i.status === 'building') && (
        <div className="mx-4 mb-4 rounded-md bg-paper-50 border border-paper-300/60 px-3 py-2.5 text-[0.8125rem] text-ink-600 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-brand-600" /> Ira is still building this in the main chat — this page updates when it's done.
        </div>
      )}

      {i.status === 'needs-input' && i.question && (
        <div className="mx-4 mb-4 rounded-md border border-mitigated-200 bg-mitigated-50/50 px-3 py-3">
          <p className="text-[0.8125rem] text-ink-800">{i.question.text}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {i.question.options.map(o => (
              <button key={o} onClick={() => answerSession(i.sessionId, o)} className="h-8 px-3 rounded-full border border-canvas-border bg-white text-[0.75rem] text-ink-700 hover:border-brand-300 hover:text-brand-700 cursor-pointer">
                {o}
              </button>
            ))}
          </div>
          {next && onNext && (
            <div className="mt-2 text-right">
              <Button variant="ghost" size="sm" onClick={() => onNext(next)}>Come back to this · next →</Button>
            </div>
          )}
        </div>
      )}

      {(i.status === 'ready' || i.status === 'approved') && (
        <>
          <div className="grid grid-cols-3 border-y border-canvas-border">
            {[
              { l: 'Rows scanned', v: i.rowsScanned != null ? fmt(i.rowsScanned) : '—' },
              { l: 'Exceptions', v: String(i.exceptions ?? '—') },
              { l: 'Inputs', v: `${i.files.filter(f => f.source).length} of ${i.files.length}` },
            ].map(k => (
              <div key={k.l} className="px-4 py-3 border-r border-canvas-border last:border-r-0">
                <div className="font-mono tabular-nums text-[1.25rem] font-semibold text-ink-900 leading-none">{k.v}</div>
                <div className="mt-1 text-[0.6875rem] text-ink-500">{k.l}</div>
              </div>
            ))}
          </div>
          {rows.length > 0 && (
            <div className="px-4 pt-3">
              <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">First exceptions</div>
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="text-left text-ink-400">
                    <th className="font-medium py-1">Reference</th><th className="font-medium py-1">Party</th><th className="font-medium py-1 text-right">Amount</th><th className="font-medium py-1 pl-4">Why it's flagged</th><th className="font-medium py-1">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.ref} className="border-t border-canvas-border">
                      <td className="py-1.5 font-mono text-ink-600">{r.ref}</td>
                      <td className="py-1.5 text-ink-800">{r.entity}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-ink-800">{r.amount}</td>
                      <td className="py-1.5 pl-4 text-ink-600">{r.reason}</td>
                      <td className="py-1.5">
                        <span className={`inline-flex h-5 px-1.5 rounded-full text-[0.6875rem] font-medium items-center ${r.severity === 'High' ? 'bg-risk-50 text-risk-700' : r.severity === 'Medium' ? 'bg-mitigated-50 text-mitigated-700' : 'bg-draft-50 text-draft-700'}`}>{r.severity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">Data</div>
              <ul className="space-y-0.5 text-[0.75rem]">
                {i.files.map(f => (
                  <li key={f.code} className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-ink-800 w-14 shrink-0">{f.code}</span>
                    {f.source?.includes('(uploaded)') ? <FileUp size={11} className="text-brand-600 shrink-0" /> : <Database size={11} className="text-compliant-700 shrink-0" />}
                    <span className="text-ink-600 truncate">{f.source ?? 'skipped'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">What Ira assumed</div>
              <ul className="space-y-1 text-[0.75rem] text-ink-600">
                {i.assumptions.map(a => (
                  <li key={a} className="group flex items-start gap-2">
                    <span className="min-w-0 flex-1">— {a}</span>
                    <button
                      onClick={() => onAskChange(`Change "${a}" to `)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-brand-700 font-medium shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-canvas-border">
            <span className="text-[0.75rem] text-ink-500">
              {i.status === 'approved'
                ? <>Live — runs {i.cadence.toLowerCase()} and returns <span className="font-semibold text-ink-800">{fmtHours(itemHours(i))}/mo</span> <span className="text-ink-400">est.</span> to {batch.owner === me || !batch.owner ? 'you' : batch.owner}.</>
                : <>Approving puts it live: <span className="font-semibold text-ink-800">+{fmtHours(itemHours(i))}/mo</span> <span className="text-ink-400">est.</span>{left > 0 ? ` · ${left} more waiting in this batch` : ''} <span className="text-ink-400">· <kbd className="font-mono">A</kbd> approve{next ? <> · <kbd className="font-mono">N</kbd> next</> : null}</span></>}
            </span>
            <span className="flex items-center gap-2">
              {i.status === 'ready' ? (
                <>
                  {next && onNext && <Button variant="ghost" size="sm" onClick={() => onNext(next)}>Skip</Button>}
                  <Button variant="primary" size="sm" leftIcon={<Check size={13} />} disabled={!canApprove} title={canApprove ? undefined : 'Your role can review but not approve workflows'} onClick={approveAndNext}>
                    {next && onNext ? 'Approve & next' : 'Approve workflow'}
                  </Button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-compliant-700"><CheckCheck size={14} /> Approved</span>
                  {next && onNext && <Button variant="outline" size="sm" onClick={() => onNext(next)}>Next to review</Button>}
                </>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
