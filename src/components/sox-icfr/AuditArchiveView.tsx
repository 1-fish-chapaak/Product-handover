import { useMemo } from 'react';
import { Building2, CalendarRange, CheckCircle2, FileSpreadsheet, Grid3x3, Lock, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Pill } from '../shared/StatusBadge';
import { SeverityPill } from './parts';
import { formatINR } from './helpers';
import type { AuditRecord, Severity, SoxTabLike } from './types';
import { cn } from '../../lib/cn';

/**
 * A CONCLUDED audit, read from its archive.
 *
 * Last year's file has to be readable — that is the whole point of archiving it —
 * but it must not be editable, and it must not show this year's numbers. The live
 * surfaces (Overview, ControlLibrary, DeficienciesView) all read the CURRENT
 * cycle's controls, so pointing a concluded audit at them would put FY26's
 * figures under an FY25 breadcrumb. This renders the snapshot instead: same four
 * tabs, every number frozen, nothing clickable that would write.
 *
 * Deliberately a separate component rather than a read-only mode on those three
 * pages. They are built to test controls — gates, sign-off buttons, sample
 * pickers, remediation forms — and a flag threaded through all of it would leave
 * an editable path open somewhere. A concluded audit is a different document.
 */

const ROUND_LABEL = { interim: 'Interim', rollforward: 'Roll-forward', yearend: 'Year-end' } as const;
const SEVERITY_ORDER: Severity[] = ['Material Weakness', 'Significant Deficiency', 'Deficiency'];
const cardCls = 'rounded-lg border border-canvas-border bg-canvas-elevated p-4';

export default function AuditArchiveView({ audit, tab }: { audit: AuditRecord; tab: SoxTabLike }) {
  const archive = audit.archive!;
  const rows = archive.conclusions;

  const tally = useMemo(() => ({
    total: rows.length,
    effective: rows.filter(r => r.conclusion === 'Effective').length,
    ineffective: rows.filter(r => r.conclusion === 'Ineffective').length,
  }), [rows]);

  const bySeverity = useMemo(() => SEVERITY_ORDER.map(s => ({
    severity: s,
    all: archive.deficiencies.filter(d => d.severity === s),
    open: archive.deficiencies.filter(d => d.severity === s && d.status !== 'Closed'),
  })), [archive.deficiencies]);

  const conclusion = audit.signoff?.icfrConclusion;
  const effective = conclusion !== 'Not effective';

  // ── The banner. On every tab, because "this is closed" is the first thing to
  //    know whichever one you land on. ────────────────────────────────────────
  const banner = (
    <div className="rounded-lg border border-canvas-border bg-paper-50/60 px-4 py-3 mb-5 flex items-start gap-2.5">
      <Lock size={14} className="text-ink-400 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold text-ink-800">
          Concluded {archive.concludedAt} — read-only
        </p>
        <p className="text-[0.75rem] text-ink-500 mt-0.5 leading-relaxed">
          Everything below is this audit's own record, frozen when the next cycle started. The current
          cycle's testing is on the audit that owns it.
        </p>
      </div>
      {conclusion && (
        <span className={cn(
          'shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[0.75rem] font-semibold',
          effective ? 'text-compliant-700 bg-compliant-50/60 border-compliant-200' : 'text-risk-700 bg-risk-50/60 border-risk-200',
        )}>
          {effective ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
          ICFR {effective ? 'effective' : 'not effective'}
        </span>
      )}
    </div>
  );

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (tab === 'overview') {
    return (
      <div>
        {banner}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { k: 'Controls tested', v: String(tally.total), t: 'text-ink-900' },
            { k: 'Effective', v: String(tally.effective), t: 'text-compliant-700' },
            { k: 'Ineffective', v: String(tally.ineffective), t: 'text-risk-700' },
            { k: 'Deficiencies raised', v: String(archive.deficiencies.length), t: 'text-high-700' },
          ].map(s => (
            <div key={s.k} className="rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3">
              <div className={cn('text-[1.25rem] font-bold tabular-nums', s.t)}>{s.v}</div>
              <div className="text-[0.75rem] text-ink-500 font-medium mt-0.5">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className={cardCls}>
            <h3 className="text-[0.8125rem] font-semibold text-ink-900 mb-3">What it covered</h3>
            <dl className="space-y-2 text-[0.75rem]">
              {[
                ['Period', `${audit.period} · ${ROUND_LABEL[audit.round]}`, CalendarRange],
                ['Window', `${audit.windowFrom} → ${audit.windowTo}`, CalendarRange],
                ['Scope', audit.scopeNames.join(', '), audit.scopeKind === 'entity' ? Building2 : Grid3x3],
                ['Materiality', `₹${audit.overall} Cr · ${audit.materiality.pct}% of ₹${audit.materiality.benchmark} Cr`, Scale],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Scale;
                return (
                  <div key={label as string} className="flex items-start gap-2">
                    <I size={12} className="text-ink-400 shrink-0 mt-0.5" />
                    <dt className="text-ink-500 w-[86px] shrink-0">{label as string}</dt>
                    <dd className="text-ink-800 font-medium min-w-0 tabular-nums">{value as string}</dd>
                  </div>
                );
              })}
              {audit.files.length > 0 && (
                <div className="flex items-start gap-2">
                  <FileSpreadsheet size={12} className="text-ink-400 shrink-0 mt-0.5" />
                  <dt className="text-ink-500 w-[86px] shrink-0">Files</dt>
                  <dd className="text-ink-800 font-medium min-w-0">{audit.files.map(f => f.name).join(', ')}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className={cardCls}>
            <h3 className="text-[0.8125rem] font-semibold text-ink-900 mb-3">Who signed</h3>
            <div className="space-y-2 text-[0.75rem]">
              {([['Prepared by', audit.signoff?.preparer], ['Countersigned by', audit.signoff?.reviewer]] as const).map(([label, entry]) => (
                <div key={label} className="flex items-center gap-2">
                  {entry
                    ? <CheckCircle2 size={13} className="text-compliant-600 shrink-0" />
                    : <span className="w-[13px] h-[13px] rounded-full border border-ink-300 shrink-0" aria-hidden />}
                  <span className="text-ink-500 w-[104px] shrink-0">{label}</span>
                  <span className="text-ink-800 font-medium min-w-0 truncate">
                    {entry ? `${entry.by}` : 'not signed'}
                  </span>
                  {entry && <span className="ml-auto text-ink-400 tabular-nums shrink-0">{entry.at}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Control Library ───────────────────────────────────────────────────────
  if (tab === 'controls') {
    const groups = new Map<string, typeof rows>();
    rows.forEach(r => { if (!groups.has(r.process)) groups.set(r.process, []); groups.get(r.process)!.push(r); });
    return (
      <div>
        {banner}
        <div className="space-y-5">
          {Array.from(groups, ([process, group]) => (
            <div key={process}>
              <h3 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-500 mb-2">
                {process} <span className="text-ink-400 tabular-nums font-medium">· {group.length}</span>
              </h3>
              <div className="rounded-lg border border-canvas-border overflow-hidden">
                <div className="grid grid-cols-[88px_1fr_92px_92px_104px] gap-3 px-4 py-2 bg-canvas border-b border-canvas-border text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-400">
                  <span>W/P</span><span>Control</span><span>Design</span><span>Operating</span><span>Conclusion</span>
                </div>
                {group.map(r => (
                  <div key={r.controlId} className="grid grid-cols-[88px_1fr_92px_92px_104px] gap-3 px-4 py-2.5 border-b border-canvas-border last:border-b-0 items-center text-[0.75rem]">
                    <span className="font-mono font-semibold text-ink-700">{r.wpRef}</span>
                    <span className="text-ink-800 min-w-0 line-clamp-2">{r.description}</span>
                    <span className={r.design === 'Effective' ? 'text-compliant-700 font-medium' : r.design === 'Ineffective' ? 'text-risk-700 font-medium' : 'text-ink-400'}>{r.design}</span>
                    <span className={r.operating === 'Effective' ? 'text-compliant-700 font-medium' : r.operating === 'Ineffective' ? 'text-risk-700 font-medium' : 'text-ink-400'}>{r.operating}</span>
                    <span>
                      <Pill tone={r.conclusion === 'Effective' ? 'compliant' : r.conclusion === 'Ineffective' ? 'risk' : 'draft'}>
                        {r.conclusion === 'Not started' ? 'Not tested' : r.conclusion}
                      </Pill>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Deficiency management ─────────────────────────────────────────────────
  if (tab === 'deficiencies') {
    return (
      <div>
        {banner}
        {archive.deficiencies.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-500">This audit raised no deficiencies.</p>
        ) : (
          <>
            <div className={cn(cardCls, 'mb-4')}>
              <div className="space-y-1.5">
                {bySeverity.map(({ severity, all, open }) => (
                  <div key={severity} className="flex items-center gap-2 text-[0.75rem]">
                    <span className={cn('w-2 h-2 rounded-full shrink-0',
                      severity === 'Material Weakness' ? 'bg-risk-500' : severity === 'Significant Deficiency' ? 'bg-high-500' : 'bg-mitigated-500')} aria-hidden />
                    <span className="text-ink-600">{severity}</span>
                    <span className="ml-auto text-ink-400 tabular-nums">{open.length} open of {all.length}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {archive.deficiencies.map(d => (
                <div key={d.id} className={cardCls}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-[0.8125rem] font-medium text-ink-900 min-w-0">{d.description}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityPill s={d.severity} />
                      <Pill tone={d.status === 'Closed' ? 'compliant' : 'evidence'}>{d.status}</Pill>
                    </div>
                  </div>
                  <p className="text-[0.75rem] text-ink-600 leading-relaxed">
                    <span className="text-ink-400">Root cause — </span>{d.rootCause}
                  </p>
                  <div className="mt-2 pt-2 border-t border-canvas-border grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[0.75rem]">
                    <span className="text-ink-600">
                      <span className="text-ink-400">Magnitude </span>
                      <span className="tabular-nums font-medium text-ink-900">{formatINR(d.magnitude)}</span>
                    </span>
                    <span className="text-ink-600 truncate">
                      <span className="text-ink-400">Remediation </span>
                      <span className="font-medium text-ink-900">{d.remediation.status}</span>
                      {d.remediation.owner && <span className="text-ink-400"> · {d.remediation.owner}</span>}
                    </span>
                    {d.retest && (
                      <span className="text-ink-600">
                        <span className="text-ink-400">Retest </span>
                        <span className={cn('font-medium', d.retest.result === 'Pass' ? 'text-compliant-700' : 'text-risk-700')}>{d.retest.result}</span>
                        <span className="text-ink-400"> · {d.retest.at}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Configuration — the frozen ground rules ───────────────────────────────
  return (
    <div>
      {banner}
      <div className={cn(cardCls, 'max-w-[560px]')}>
        <h3 className="text-[0.8125rem] font-semibold text-ink-900 mb-1">Ground rules as tested</h3>
        <p className="text-[0.75rem] text-ink-500 mb-3 leading-relaxed">
          Frozen at conclusion. Changing them now would rewrite what this audit measured against, so
          they are stated rather than edited.
        </p>
        <dl className="text-[0.75rem] divide-y divide-canvas-border">
          {[
            ['Period', `${audit.period} · ${ROUND_LABEL[audit.round]}`],
            ['Window', `${audit.windowFrom} → ${audit.windowTo}`],
            ['Scope', `${audit.scopeNames.join(', ')} (${audit.scopeKind === 'entity' ? 'by entity' : 'by RACM'})`],
            ['Basis', audit.materiality.basisLabel],
            ['Benchmark', `₹${audit.materiality.benchmark} Cr`],
            ['Percentage', `${audit.materiality.pct}%`],
            ['Overall materiality', `₹${audit.overall} Cr`],
            ['Trial balance / GL', audit.files.length ? audit.files.map(f => f.name).join(', ') : 'none attached'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 py-2">
              <dt className="text-ink-500 shrink-0">{k}</dt>
              <dd className="text-ink-900 font-medium text-right min-w-0 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
