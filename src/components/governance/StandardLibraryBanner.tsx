/**
 * Standard library banner — the same message wherever the user is working:
 * the standard controls and workflows are already in the account, and the
 * one thing between them and live testing is the client's data. Each page
 * phrases it for what that page is for; every page shows the same
 * consolidated report list, opens the same Adapt modal, and can be hidden
 * (per page, per workspace).
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, Download, X } from 'lucide-react';
import { Button } from '../shared/Button';
import { IraMark } from '../audit-plan/PlanParts';
import AdaptDataModal from '../audit-plan/AdaptDataModal';
import {
  CHECK_CATALOG, fmtHours, hoursPerMonthFor, readinessOf, requiredFilesFor, useFreshWorkspace, useStdState,
  workspaceSuffix, type FileSourceChoice,
} from '../../data/auditPlan';
import { bySystem, controlNameOf, downloadPbc } from './pbc';

export type StdBannerPage = 'workflow-library' | 'workflow-builder' | 'engagements' | 'risk-register' | 'process-hub' | 'racm';

interface Props {
  page: StdBannerPage;
  onAdapt: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
  onOpenLibrary: () => void;
  onOpenBuilds: () => void;
}

interface Counts { total: number; live: number; needs: number; awaiting: number; hours: string }

const COPY: Record<StdBannerPage, (n: Counts) => { title: string; body: string }> = {
  'workflow-library': n => ({
    title: `${n.needs} standard workflows are waiting for your data`,
    body: 'They’re already in this library, built and tested — share your reports once and Ira adapts every one of them.',
  }),
  'workflow-builder': n => ({
    title: 'Start from the standard library',
    body: `${n.needs} ready-made workflows cover P2P through ITGC. Adapt them with your data before building one from scratch.`,
  }),
  engagements: n => ({
    title: `${n.needs} standard controls are ready to test`,
    body: 'Each arrives with its test attributes and a workflow. Once adapted with your data, any engagement can test them.',
  }),
  'risk-register': n => ({
    title: 'Standard controls already cover these risks',
    body: `${n.needs} controls mapped to common P2P, O2C, R2R and ITGC risks test themselves once adapted with your data.`,
  }),
  'process-hub': n => ({
    title: 'Every process ships with standard controls',
    body: `${n.live} of ${n.total} run live today. ${n.needs} more go live once your data is in.`,
  }),
  racm: n => ({
    title: 'Standard controls are ready for your RACMs',
    body: `Adapt ${n.needs} standard controls with your data and every RACM row they sit on is tested each period.`,
  }),
};

const storageKey = (page: StdBannerPage) => `irame.stdBanner.${page}${workspaceSuffix()}`;

function readHidden(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export default function StandardLibraryBanner({ page, onAdapt, onOpenLibrary, onOpenBuilds }: Props) {
  const std = useStdState();
  useFreshWorkspace(); // re-render (and re-key the hide flag) on a workspace switch
  const reduced = useReducedMotion();
  const key = storageKey(page);
  const [hiddenNow, setHiddenNow] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);

  const auto = CHECK_CATALOG.filter(e => e.automatable);
  const needsEntries = auto.filter(e => readinessOf(e, std) === 'needs-data');
  const needsKeys = needsEntries.map(e => e.key);
  const awaiting = auto.filter(e => readinessOf(e, std) === 'awaiting-review').length;
  const live = CHECK_CATALOG.filter(e => readinessOf(e, std) === 'live').length;
  const hidden = hiddenNow[key] ?? readHidden(key);

  if (hidden || (needsKeys.length === 0 && awaiting === 0)) return null;

  const hide = () => {
    setHiddenNow(h => ({ ...h, [key]: true }));
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
  };

  // Nothing left to adapt — only reviews: say that instead.
  if (needsKeys.length === 0) {
    return (
      <div role="region" aria-label="Standard library" className="shrink-0 border-b border-canvas-border bg-evidence-50/50">
        <div className="flex items-center gap-3 px-6 py-2.5">
          <IraMark size={22} />
          <p className="flex-1 min-w-0 text-[0.8125rem] text-ink-700">
            <span className="font-semibold text-ink-900">{awaiting} standard workflow{awaiting === 1 ? ' is' : 's are'} waiting for your review</span>
            <span className="text-ink-500"> — each goes live on approval.</span>
          </p>
          <Button variant="primary" size="sm" rightIcon={<ArrowRight size={12} />} onClick={onOpenBuilds}>Review</Button>
          <button onClick={hide} aria-label="Hide this banner" className="size-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-white hover:text-ink-700 cursor-pointer"><X size={14} /></button>
        </div>
      </div>
    );
  }

  const required = requiredFilesFor(needsEntries);
  const connected = required.filter(r => r.file.matches).length;
  const counts: Counts = { total: CHECK_CATALOG.length, live, needs: needsKeys.length, awaiting, hours: fmtHours(hoursPerMonthFor(needsKeys)) };
  const { title, body } = COPY[page](counts);
  const groups = bySystem(required);

  return (
    <div role="region" aria-label="Standard library" className="shrink-0 border-b border-canvas-border bg-brand-50/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">
        <IraMark size={22} />
        <div className="flex-1 min-w-[18rem]">
          <p className="text-[0.8125rem] text-ink-700 leading-snug">
            <span className="font-semibold text-ink-900">{title}</span>
            <span className="text-ink-500"> · {body}</span>
          </p>
          <p className="mt-0.5 text-[0.75rem] text-ink-500 tabular-nums">
            <button
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline cursor-pointer"
            >
              {required.length} reports adapt all {needsKeys.length}
              <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {connected > 0 ? <> · <span className="text-compliant-700">{connected} already connected</span></> : ' · none connected yet'}
            {' '}· ~{counts.hours} a month returned once live (est.)
            {awaiting > 0 && (
              <> · <button onClick={onOpenBuilds} className="text-evidence-700 hover:underline cursor-pointer">{awaiting} awaiting review</button></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenLibrary}>Open standard library</Button>
          <Button variant="primary" size="sm" onClick={() => setAdaptKeys(needsKeys)}>Adapt with your data</Button>
          <button onClick={hide} aria-label="Hide this banner" className="size-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-white hover:text-ink-700 cursor-pointer"><X size={14} /></button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 pt-1">
              {/* One flowing list, so a 20-report system doesn't tower over a 1-report one. */}
              <div className="columns-1 md:columns-2 xl:columns-4 gap-4">
                {groups.map(g => (
                  <div key={g.system} className="contents">
                    <div className="break-inside-avoid break-after-avoid pt-1 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-ink-400">
                      {g.system} · {g.files.length}
                    </div>
                    {g.files.map(r => (
                      <div
                        key={r.file.id}
                        className="break-inside-avoid mb-1 flex items-center gap-2 px-2.5 h-8 rounded-md border border-canvas-border bg-white"
                        title={`Unlocks: ${r.unlocks.map(controlNameOf).join(', ')}`}
                      >
                        <span className="font-mono text-[0.6875rem] font-semibold text-ink-800 w-12 shrink-0">{r.file.code}</span>
                        <span className="min-w-0 flex-1 text-[0.75rem] text-ink-700 truncate">{r.file.name}</span>
                        <span className="text-[0.6875rem] text-ink-400 tabular-nums shrink-0">{r.unlocks.length}</span>
                        {r.file.matches
                          ? <Check size={12} className="text-compliant-700 shrink-0" aria-label="Connected" />
                          : <span className="size-3 shrink-0" aria-hidden />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[0.75rem] text-ink-500">
                <span>The number beside each report is how many controls it unlocks. <Check size={11} className="inline text-compliant-700" aria-hidden /> = already connected.</span>
                <button onClick={() => downloadPbc(required)} className="ml-auto inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline cursor-pointer">
                  <Download size={12} aria-hidden /> Download PBC request list
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adaptKeys && (
          <AdaptDataModal
            keys={adaptKeys}
            onClose={() => setAdaptKeys(null)}
            onContinue={(choices) => { const k = adaptKeys; setAdaptKeys(null); onAdapt(k, choices); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
