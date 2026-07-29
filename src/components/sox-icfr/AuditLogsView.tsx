import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Building2, Grid3x3, Paperclip, Plus, ScrollText } from 'lucide-react';
import EmptyState from '../shared/EmptyState';
import NewAuditWizard from './NewAuditWizard';
import { useIcfr } from './store';

/**
 * Audit logs — the tab that replaced Configuration on every SOX engagement.
 *
 * Lists the audits created by the New audit wizard, newest first, and holds the
 * button that opens it. The list is deliberately read-only: an audit records
 * what was scoped and against which materiality, so editing it after the fact
 * would rewrite the record rather than correct it.
 *
 * The Configuration settings this tab used to hold (testing period, group &
 * entities, materiality rules, roll forward) are parked, not deleted —
 * ConfigurationView.tsx is intact and its import in SoxIcfrApp is commented
 * out next to the render branch.
 */
export default function AuditLogsView() {
  const { eng } = useIcfr();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      {/* toolbar — first, matching the sibling tabs (RACM, Control Library), so
          the action sits directly under the tab bar. Right-aligned because
          there are no filters on its left yet. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {eng.audits.length > 0 && (
          <span className="text-[11.5px] text-ink-400">
            {eng.audits.length} audit{eng.audits.length === 1 ? '' : 's'}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setCreating(true)}
          className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 text-white text-[12.5px] font-semibold hover:bg-brand-700 transition-colors cursor-pointer"
        >
          <Plus size={15} /> New audit
        </button>
      </div>

      {eng.audits.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audits yet"
          body="Start an audit and it will be listed here with its period, what it covers, and the materiality it was set against."
        />
      ) : (
        <div className="space-y-2">
          {eng.audits.map(a => (
            <div key={a.id} className="rounded-xl border border-canvas-border bg-white p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink-900">{a.period}</div>
                  <div className="text-[11px] text-ink-400">{a.periodSpan}</div>
                </div>
                <div className="text-[11px] text-ink-400 shrink-0 text-right">
                  {a.by} · {a.at}
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
      )}

      <AnimatePresence>
        {creating && <NewAuditWizard onClose={() => setCreating(false)} />}
      </AnimatePresence>
    </div>
  );
}
