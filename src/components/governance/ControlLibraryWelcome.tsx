/**
 * Control Library — first-time experience.
 *
 * What a new client sees before any workflow runs: the standard library is
 * already here (every control with its attributes and a standard workflow),
 * and the only thing standing between it and live testing is data. So the
 * centre of the panel is the one consolidated list of reports Ira needs —
 * grouped by the system they come from, what each unlocks, and which are
 * already connected — plus a PBC request list to send the client's IT team.
 */
import { Check, Database, Download, FileSpreadsheet, ShieldCheck, Upload, X } from 'lucide-react';
import { Button } from '../shared/Button';
import { IraMark } from '../audit-plan/PlanParts';
import { CHECK_CATALOG, fmtHours, hoursPerMonthFor, requiredFilesFor, type CatalogEntry } from '../../data/auditPlan';
import { bySystem as groupBySystem, controlNameOf as nameOf, downloadPbc } from './pbc';

interface Props {
  fresh: boolean;
  needsKeys: string[];
  liveCount: number;
  totalStandard: number;
  onAdaptAll: () => void;
  onDismiss: () => void;
}

export default function ControlLibraryWelcome({ fresh, needsKeys, liveCount, totalStandard, onAdaptAll, onDismiss }: Props) {
  const entries = needsKeys.map(k => CHECK_CATALOG.find(e => e.key === k)).filter((e): e is CatalogEntry => !!e);
  const required = requiredFilesFor(entries);
  const connected = required.filter(r => r.file.matches).length;
  const bySystem = groupBySystem(required);
  const hours = hoursPerMonthFor(needsKeys);

  return (
    <section aria-label="Get started with the standard library" className="rounded-xl border border-canvas-border bg-canvas-elevated mb-6 overflow-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Left — what this is and how it goes */}
        <div className="p-6 border-b xl:border-b-0 xl:border-r border-canvas-border relative">
          <button onClick={onDismiss} aria-label="Hide for now" className="absolute top-4 right-4 size-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-paper-100 hover:text-ink-700 cursor-pointer">
            <X size={14} />
          </button>
          <IraMark size={34} />
          <h2 className="mt-4 font-serif text-[1.625rem] leading-tight tracking-tight text-ink-900 max-w-[30rem]">
            {fresh
              ? `Your control library is ready — ${totalStandard} controls, no workflows running yet.`
              : `${totalStandard} standard controls are preloaded — ${liveCount} already run on your data.`}
          </h2>
          <p className="mt-2 text-[0.875rem] text-ink-600 leading-relaxed max-w-[32rem]">
            Every control arrives complete — description, risk, assertions, owner and test attributes — with a standard
            workflow to test it. All that's missing is your data: share the reports on the right once and Ira adapts
            every workflow to them. You review and approve.
          </p>
          <ol className="mt-5 space-y-3">
            {[
              { icon: Upload, title: 'Share the reports', sub: `${required.length} reports cover all ${needsKeys.length} workflows — ${connected > 0 ? `${connected} already connected` : 'send your IT team the PBC list'}` },
              { icon: Database, title: 'Ira adapts and builds', sub: 'Maps each report into every workflow that needs it, then runs them' },
              { icon: ShieldCheck, title: 'You review and approve', sub: `Each workflow goes live on approval · ~${fmtHours(hours)} a month returned (est.)` },
            ].map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="size-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[0.75rem] font-semibold shrink-0 font-mono">{i + 1}</span>
                <span>
                  <span className="block text-[0.8125rem] font-semibold text-ink-900">{s.title}</span>
                  <span className="block text-[0.75rem] text-ink-500">{s.sub}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={onAdaptAll}>Adapt all {needsKeys.length} with your data</Button>
            <Button variant="outline" leftIcon={<Download size={14} />} onClick={() => downloadPbc(required)}>Download PBC request list</Button>
          </div>
        </div>

        {/* Right — the consolidated reports */}
        <div className="p-6 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="text-[0.9375rem] font-semibold text-ink-900">Reports Ira needs</h3>
            <span className="text-[0.75rem] text-ink-500 tabular-nums">
              {required.length} reports · <span className="text-compliant-700">{connected} connected</span> · {required.length - connected} to request
            </span>
          </div>
          <div className="max-h-[22rem] overflow-y-auto pr-1 space-y-4">
            {bySystem.map(g => (
              <div key={g.system}>
                <div className="flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  {g.system === 'Policies & rule-sets' ? <FileSpreadsheet size={11} /> : <Database size={11} />}
                  {g.system}
                </div>
                <ul className="rounded-lg border border-canvas-border divide-y divide-canvas-border">
                  {g.files.map(r => (
                    <li key={r.file.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="font-mono text-[0.6875rem] font-semibold text-ink-800 w-14 shrink-0">{r.file.code}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8125rem] text-ink-900 truncate">{r.file.name}</span>
                        <span className="block text-[0.6875rem] text-ink-500 truncate" title={r.unlocks.map(nameOf).join(', ')}>
                          Unlocks {r.unlocks.length} control{r.unlocks.length === 1 ? '' : 's'} · {r.unlocks.slice(0, 2).map(nameOf).join(', ')}{r.unlocks.length > 2 ? '…' : ''}
                        </span>
                      </span>
                      {r.file.matches
                        ? <span className="inline-flex items-center gap-1 text-[0.6875rem] text-compliant-700 shrink-0"><Check size={11} />Connected</span>
                        : <span className="text-[0.6875rem] text-mitigated-700 shrink-0">To request</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
