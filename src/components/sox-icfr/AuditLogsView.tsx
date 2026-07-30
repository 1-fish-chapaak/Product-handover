import { ArrowRight, Building2, Grid3x3, Paperclip, Plus, RefreshCw } from 'lucide-react';
import type { AuditRecord } from './types';
import { useIcfr } from './store';

/**
 * Audit logs — one of the engagement's two tabs, beside Dashboard.
 *
 * Lists every audit on the engagement, newest first. A row is a way in: opening
 * one drills to that audit's own Overview / RACM / Control Library /
 * Configuration. Editing an audit happens there, on its Configuration tab, not
 * inline here — this list is the register, not the form.
 *
 * The wizard itself is owned by SoxIcfrApp so the empty-engagement screen and
 * the Dashboard can open the same one.
 */
export default function AuditLogsView({ onNewAudit, onOpenAudit, onRollForward }: {
  onNewAudit: () => void;
  onOpenAudit: (auditId: string) => void;
  onRollForward: (audit: AuditRecord) => void;
}) {
  const { eng } = useIcfr();

  return (
    <div>
      {/* toolbar — first, matching the sibling tabs (RACM, Control Library), so
          the action sits directly under the tab bar. Right-aligned because
          there are no filters on its left yet. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[11.5px] text-ink-400">
          {eng.audits.length} audit{eng.audits.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        <button
          onClick={onNewAudit}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
        >
          <Plus size={15} /> New audit
        </button>
      </div>

      <div className="space-y-2">
          {eng.audits.map(a => (
            <div
              key={a.id}
              className="rounded-xl border border-canvas-border bg-white p-4 hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink-900">{a.period}</div>
                  <div className="text-[11px] text-ink-400">{a.periodSpan}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[11px] text-ink-400 text-right mr-1">{a.by} · {a.at}</div>
                  <button
                    onClick={() => onRollForward(a)}
                    title={`Carry ${a.period} into the next cycle`}
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} /> Roll forward
                  </button>
                  <button
                    onClick={() => onOpenAudit(a.id)}
                    className="h-8 px-3 inline-flex items-center gap-1 rounded-lg bg-brand-600 text-white text-[12px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
                  >
                    Open <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-ink-600">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  {a.scopeKind === 'entity'
                    ? <Building2 size={13} className="text-ink-400 shrink-0" />
                    : <Grid3x3 size={13} className="text-ink-400 shrink-0" />}
                  <span className="truncate">{a.scopeNames.join(', ')}</span>
                </span>
                <span className="tabular-nums">
                  Materiality <span className="font-semibold text-ink-900">₹{a.overall} Cr</span>
                </span>
                {a.files.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip size={12} className="text-ink-400" />
                    {a.files.length} file{a.files.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
