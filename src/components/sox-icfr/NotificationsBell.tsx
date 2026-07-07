import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell, CheckCircle2, ClipboardList, FileText, MessageSquareWarning, Table2, XCircle,
} from 'lucide-react';
import { useIcfr } from './store';
import { controlConclusion, trackResult } from './helpers';
import { cn } from '../../lib/cn';

/**
 * The engagement's notification bell — everything pending on the person who is
 * looking at it. The auditor sees RACM rows awaiting review, open queries and
 * exceptions to assess; the risk owner sees assigned PBC / remediation tasks,
 * the auditor's remarks on their rows, and — first and unmissable — every
 * control the auditor has concluded ineffective.
 */

type Item = {
  id: string;
  kind: 'ineffective' | 'remark' | 'task' | 'review' | 'exception';
  title: string;
  detail: string;
  onOpen: () => void;
};

const KIND_META: Record<Item['kind'], { Icon: typeof Bell; cls: string }> = {
  ineffective: { Icon: XCircle, cls: 'bg-risk-50 text-risk-700 border-risk-200' },
  remark: { Icon: MessageSquareWarning, cls: 'bg-high-50 text-high-700 border-high-200' },
  task: { Icon: ClipboardList, cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  review: { Icon: Table2, cls: 'bg-evidence-50 text-evidence-700 border-evidence-200' },
  exception: { Icon: FileText, cls: 'bg-high-50 text-high-700 border-high-200' },
};

export default function NotificationsBell() {
  const { eng, role, openControl, setTab } = useIcfr();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const go = (controlId: string) => { setOpen(false); openControl(controlId); };

    // ── the auditor's verdicts — shown to the risk owner first, unmissable ──────
    if (role === 'risk-owner') {
      for (const c of eng.controls) {
        if (controlConclusion(c) !== 'Ineffective') continue;
        const track = trackResult(c.design) === 'Ineffective' ? 'design' : 'operating';
        const who = (track === 'design' ? c.design.testedBy : c.operating.testedBy) ?? 'Auditor';
        out.push({
          id: `ineff-${c.id}`, kind: 'ineffective',
          title: `${c.wpRef} concluded INEFFECTIVE (${track})`,
          detail: `${c.description} — by ${who}`,
          onOpen: () => go(c.id),
        });
      }
      for (const c of eng.controls) {
        if (c.racmReview?.status !== 'Remark') continue;
        out.push({
          id: `rem-${c.id}`, kind: 'remark',
          title: `Auditor remark on ${c.wpRef}`,
          detail: c.racmReview.remark ?? '',
          onOpen: () => go(c.id),
        });
      }
    }

    // ── open tasks assigned to me ────────────────────────────────────────────────
    for (const t of eng.tasks) {
      if (t.status !== 'open' || t.assigneeRole !== role) continue;
      out.push({
        id: `task-${t.id}`, kind: 'task',
        title: `${t.type === 'pbc' ? 'Provide documents' : t.type === 'query' ? 'Answer query' : 'Remediate'} · ${t.id}`,
        detail: `${t.title} — ${t.dueLabel}${t.overdue ? ' · overdue' : ''}`,
        onOpen: () => go(t.controlId),
      });
    }

    if (role === 'auditor') {
      const pending = eng.controls.filter(c => !c.racmReview).length;
      if (pending > 0) {
        out.push({
          id: 'review-racm', kind: 'review',
          title: `${pending} RACM row${pending === 1 ? '' : 's'} awaiting your review`,
          detail: 'Approve each row or leave a remark for the risk owner.',
          onOpen: () => { setOpen(false); setTab('racm'); },
        });
      }
      for (const d of eng.deficiencies) {
        if (d.status === 'Closed') continue;
        out.push({
          id: `def-${d.id}`, kind: 'exception',
          title: `${d.id} · ${d.status}`,
          detail: d.description,
          onOpen: () => go(d.controlId),
        });
      }
    }
    return out;
  }, [eng.controls, eng.tasks, eng.deficiencies, role, openControl, setTab]);

  const urgent = items.filter(i => i.kind === 'ineffective').length;

  return (
    <div ref={rootRef} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label={`Notifications — ${items.length} pending`}
        className={cn('relative h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer',
          open ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-canvas-border text-ink-500 hover:text-ink-900 hover:border-ink-300')}>
        <Bell size={16} />
        {items.length > 0 && (
          <span className={cn('absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white inline-flex items-center justify-center tabular-nums',
            urgent > 0 ? 'bg-risk-600' : 'bg-brand-600')}>
            {items.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.14 }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-[400px] rounded-2xl border border-canvas-border bg-canvas-elevated shadow-[0_20px_50px_-18px_rgba(15,8,30,0.45)] overflow-hidden">
            <div className="px-4 py-3 border-b border-canvas-border flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-ink-900">Notifications</div>
                <div className="text-[11px] text-ink-400 mt-0.5">Pending assignment &amp; review · viewing as {role === 'auditor' ? 'Auditor' : 'Risk Owner'}</div>
              </div>
              {urgent > 0 && <span className="text-[10.5px] font-bold text-risk-700 bg-risk-50 border border-risk-200 rounded-full px-2 h-5 inline-flex items-center">{urgent} ineffective</span>}
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {items.map(it => {
                const meta = KIND_META[it.kind];
                return (
                  <button key={it.id} onClick={it.onOpen}
                    className="w-full flex items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-paper-50 transition-colors cursor-pointer">
                    <span className={cn('w-7 h-7 rounded-lg border inline-flex items-center justify-center shrink-0', meta.cls)}><meta.Icon size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[12px] font-semibold leading-snug', it.kind === 'ineffective' ? 'text-risk-700' : 'text-ink-900')}>{it.title}</span>
                      <span className="block text-[11px] text-ink-500 mt-0.5 line-clamp-2">{it.detail}</span>
                    </span>
                  </button>
                );
              })}
              {items.length === 0 && (
                <div className="py-10 text-center text-[12px] text-ink-400">
                  <CheckCircle2 size={18} className="mx-auto mb-2 text-compliant-500" /> Nothing pending — all caught up.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
