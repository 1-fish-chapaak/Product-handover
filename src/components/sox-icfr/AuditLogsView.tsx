import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Building2, Grid3x3, Paperclip, Plus, RefreshCw, ScrollText } from 'lucide-react';
import type { AuditRecord } from './types';
import { useIcfr } from './store';
import EmptyState from '../shared/EmptyState';
import NewAuditWizard from './NewAuditWizard';
import RollForwardSheet from './RollForwardSheet';

/**
 * SOX audit — the engagement's audit register, and the tab an audit lands on
 * once created (user ask).
 *
 * Lists every audit, newest first: period, what it covers, the materiality it is
 * measured against and the trial balances / GL attached. A row is a way IN —
 * opening one swaps in that audit's own four tabs (Dashboard, Control Library,
 * Deficiency management, Configuration); see AUDIT_TABS in SoxIcfrApp. Creating an
 * audit opens it straight away, so this list is how you get back to one. Roll
 * forward starts the next cycle from this one instead of from a blank wizard.
 *
 * Self-contained on purpose. Both openers of the New audit sheet — this tab and
 * the Overview — own their own copy rather than having the shell thread it down,
 * so the two shells render this with no props.
 */
export default function AuditLogsView() {
  const { eng, role, openAudit } = useIcfr();
  const [creating, setCreating] = useState(false);
  // The audit being rolled forward — its sheet prefills from it.
  const [rolling, setRolling] = useState<AuditRecord | null>(null);
  // Starting a cycle is not the first line's call.
  const canCreate = role !== 'risk-owner';

  const sheets = (
    <AnimatePresence>
      {creating && <NewAuditWizard onClose={() => setCreating(false)} />}
      {rolling && <RollForwardSheet prior={rolling} onClose={() => setRolling(null)} />}
    </AnimatePresence>
  );

  // Nothing created yet — say what an audit is for rather than showing an empty
  // count and a bare list.
  if (eng.audits.length === 0) {
    return (
      <div>
        <EmptyState
          icon={ScrollText}
          title="No audits yet"
          body="An audit sets the period, what it covers and the materiality it is measured against. Start one to begin testing."
          action={canCreate ? (
            <button
              onClick={() => setCreating(true)}
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
            >
              <Plus size={15} /> New audit
            </button>
          ) : undefined}
        />
        {sheets}
      </div>
    );
  }

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
        {canCreate && (
          <button
            onClick={() => setCreating(true)}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
          >
            <Plus size={15} /> New audit
          </button>
        )}
      </div>

      <div className="space-y-2">
          {eng.audits.map(a => (
            <div
              key={a.id}
              onClick={() => openAudit(a.id)}
              tabIndex={0}
              role="button"
              aria-label={`Open ${a.period} audit`}
              onKeyDown={e => { if (e.key === 'Enter') openAudit(a.id); }}
              className="rounded-xl border border-canvas-border bg-white p-4 hover:border-brand-300 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink-900">{a.period}</div>
                  <div className="text-[11px] text-ink-400">{a.periodSpan}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[11px] text-ink-400 text-right mr-1">{a.by} · {a.at}</div>
                  {/* Quarter / custom audits are one-off checks, not a round of a
                      named annual cycle — there is no "next cycle" to roll into. */}
                  {canCreate && (a.yearBasis === 'fy' || a.yearBasis === 'cy') && (
                    <button
                      onClick={e => { e.stopPropagation(); setRolling(a); }}
                      title={`Carry ${a.period} into the next cycle`}
                      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-canvas-border bg-white text-[12px] font-semibold text-ink-600 hover:border-brand-300 hover:text-brand-700 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} /> Roll forward
                    </button>
                  )}
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
      {sheets}
    </div>
  );
}
