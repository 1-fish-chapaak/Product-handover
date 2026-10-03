/**
 * Home · Today — where a first-time user starts, and where everyone sees what
 * to do next.
 *
 * The job is to land people on the few actions that matter: connect data,
 * adapt the standard workflows, review what Ira built. Everything is ranked
 * by the auditor hours it would return, so the next click is always the
 * highest-value one — and the user only ever uploads, reviews or fixes.
 *
 *  · Hours returned / rank / streak — the score (see data/auditPlan/score
 *    and ledger: owner earns hours for live workflows; reviews feed the
 *    streak, never hours, so approving fast can't climb the board).
 *  · Set up your workspace — the FTUE checklist; collapses when done.
 *  · Needs you — answers and reviews Ira is waiting on.
 *  · Next best actions — ranked by hours a month unlocked.
 *  · Coverage by engagement — live automated coverage against target.
 *  · Leaderboard (top 5 + you, opt-out) and how to climb it.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Check, CircleDashed, Database, Eye, EyeOff, Flame, Layers, Loader2, Sparkles, Trophy, Users, Workflow,
  ShieldCheck, Medal,
} from 'lucide-react';
import { useCurrentUser } from '../../context/CurrentUserContext';
import { useToast } from '../shared/Toast';
import { SEED } from '../data-sources/sources';
import { libraryEngagements, type Engagement, type ProcessCode } from '../../data/engagements';
import { useCreatedEngagements } from '../../data/createdEngagementsStore';
import {
  CHECK_CATALOG, MILESTONES, PROCESS_LONG, allLive, catalogFor, filesForEntry, fmtHours, getEngagementPlan, hoursFor,
  hoursPerMonthFor, isNameHidden, isStdLive, itemHours, leaderboard, pendingItems, readinessOf, runRateAddedToday, runRateFor, setNameHidden,
  streakFor, useAllBatches, useLedgerVersion, useStdState, type FileSourceChoice, type ScoreWindow,
} from '../../data/auditPlan';
import type { AdaptSeed } from '../../hooks/useAppState';
import AdaptDataModal from '../audit-plan/AdaptDataModal';
import { IraMark } from '../audit-plan/PlanParts';

interface Props {
  onAdapt: (keys: string[], choices: Record<string, FileSourceChoice | null>) => void;
  adaptDraft: AdaptSeed | null;
  onResumeAdapt: () => void;
  onOpenBuilds: () => void;
  onOpenControls: () => void;
  onOpenEngagement: (id: string) => void;
  onAuditWithAi: () => void;
  onConnectData: () => void;
}

const DAY = 86_400_000;
const TARGET = 85;
const PROCESSES: ProcessCode[] = ['P2P', 'O2C', 'R2R', 'S2C', 'INV', 'ITGC'];
const SETUP_DONE_KEY = 'irame.setup.done';
const INVITED_KEY = 'irame.setup.invited';

const initials = (n: string) => n.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
const firstName = (n: string) => n.split(' ')[0];
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Live automated coverage of an engagement: its plan's controls if a plan
 *  made it, else the standard catalog for its process. */
function engagementCoverage(e: Engagement): { pct: number; live: number; total: number; needKeys: string[] } {
  const plan = getEngagementPlan(e.id);
  const keys = plan
    ? plan.controls.filter(c => c.check.kind !== 'manual').map(c => c.key)
    : catalogFor(e.process).filter(x => x.automatable).map(x => x.key);
  const live = keys.filter(isStdLive).length;
  const needKeys = keys.filter(k => {
    const entry = CHECK_CATALOG.find(x => x.key === k);
    return entry ? readinessOf(entry) === 'needs-data' : false;
  });
  return { pct: keys.length ? Math.round((live / keys.length) * 100) : 0, live, total: keys.length, needKeys };
}

export default function TodayView(p: Props) {
  const { currentUser } = useCurrentUser();
  const { addToast } = useToast();
  const reduced = useReducedMotion();
  const me = currentUser?.name ?? 'You';
  useLedgerVersion();
  const std = useStdState();
  const batches = useAllBatches();
  const created = useCreatedEngagements();
  const [win, setWin] = useState<ScoreWindow>('30d');
  const [adaptKeys, setAdaptKeys] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState(isNameHidden());
  // One clock per render pass — the 30-day windows compare against it.
  const [now] = useState(() => Date.now());
  const [invited, setInvited] = useState(() => { try { return localStorage.getItem(INVITED_KEY) === '1'; } catch { return false; } });

  // ── Score ──
  const board = leaderboard(win, [me]);
  const myIdx = board.findIndex(r => r.person === me);
  const myRow = board[myIdx];
  const ahead = myIdx > 0 ? board[myIdx - 1] : undefined;
  const hours30 = hoursFor(me, '30d');
  const hoursPrev = hoursFor(me, '30d', now - 30 * DAY);
  const hoursAll = hoursFor(me, 'all');
  const myLive = allLive().filter(w => w.owner === me).length;
  const streak = streakFor(me);
  const nextMilestone = [50, 100, 250, 500].find(m => hoursAll < m) ?? 1000;

  // ── Work ──
  const { needsInput, toReview, building } = pendingItems(batches);
  const reviewHours = toReview.reduce((s, x) => s + itemHours(x.item), 0);
  const missingCodes = Array.from(new Set(needsInput.map(x => x.item.files.find(f => !f.source)?.code).filter(Boolean)));

  const processOps = useMemo(() => PROCESSES.map(proc => {
    const keys = catalogFor(proc).filter(e => readinessOf(e, std) === 'needs-data').map(e => e.key);
    const files = new Set(keys.flatMap(k => filesForEntry(CHECK_CATALOG.find(e => e.key === k)!).filter(f => !f.matches).map(f => f.code)));
    return { proc, keys, hours: hoursPerMonthFor(keys), missingFiles: [...files] };
  }).filter(o => o.keys.length > 0).sort((a, b) => b.hours - a.hours), [std]);

  const aiEngagements = created.filter(e => e.aiRecommended).length;
  type Action = { id: string; hours: number; title: string; sub: string; cta: string; run: () => void; icon: typeof Sparkles };
  const actions: Action[] = [
    ...processOps.slice(0, 3).map(o => ({
      id: `adapt-${o.proc}`,
      hours: o.hours,
      title: `Adapt ${o.keys.length} ${PROCESS_LONG[o.proc]} workflow${o.keys.length === 1 ? '' : 's'}`,
      sub: o.missingFiles.length === 0 ? 'All the data is already connected' : `Needs ${o.missingFiles.slice(0, 3).join(', ')}${o.missingFiles.length > 3 ? ` +${o.missingFiles.length - 3}` : ''} — the rest is connected`,
      cta: 'Adapt',
      run: () => setAdaptKeys(o.keys),
      icon: Sparkles,
    })),
    ...(toReview.length > 0 ? [{
      id: 'review', hours: reviewHours,
      title: `Review ${toReview.length} built workflow${toReview.length === 1 ? '' : 's'}`,
      sub: `About ${toReview.length * 2} minutes · they start returning hours once approved`,
      cta: 'Review', run: p.onOpenBuilds, icon: ShieldCheck,
    }] : []),
  ].sort((a, b) => b.hours - a.hours).slice(0, 4);

  // ── Setup (FTUE) ──
  const connected = SEED.filter(s => s.type === 'database').length;
  const approvedOnce = allLive().some(w => w.approvedBy === me && w.id.startsWith('live-'));
  const fullProcess = PROCESSES.some(proc => {
    const auto = catalogFor(proc).filter(e => e.automatable);
    return auto.length > 0 && auto.every(e => readinessOf(e, std) === 'live');
  });
  const topOp = processOps[0];
  const steps = [
    { id: 'connect', done: connected > 0, title: 'Connect your ERP data', sub: connected > 0 ? `${connected} sources connected — Ira auto-fills files from them` : 'Ira fills most standard files straight from it', cta: 'Connect', run: p.onConnectData, icon: Database },
    { id: 'adapt', done: std.built.length > 0, title: 'Adapt the standard library', sub: topOp ? `Start with ${PROCESS_LONG[topOp.proc]} — +${fmtHours(topOp.hours)}/mo once live` : 'Preloaded controls, fitted to your files', cta: 'Adapt', run: () => (topOp ? setAdaptKeys(topOp.keys) : p.onOpenControls()), icon: Sparkles },
    { id: 'approve', done: approvedOnce, title: 'Approve your first workflow', sub: 'Live workflows are what count — hours start the day you approve', cta: 'Review', run: p.onOpenBuilds, icon: ShieldCheck },
    { id: 'plan', done: aiEngagements > 0, title: 'Plan an audit with AI', sub: 'One engagement per process, every control with a check, and a timeline', cta: 'Plan', run: p.onAuditWithAi, icon: Layers },
    { id: 'full', done: fullProcess, title: 'Fully automate one process', sub: 'Every automatable control in a process live', cta: 'See gaps', run: p.onOpenControls, icon: Trophy },
    { id: 'invite', done: invited, title: 'Invite your team', sub: 'Share the review load — and the leaderboard', cta: 'Invite', run: () => { setInvited(true); try { localStorage.setItem(INVITED_KEY, '1'); } catch { /* ignore */ } addToast({ message: 'Invites sent to the SOX Audit team', type: 'success' }); }, icon: Users },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const setupDone = doneCount === steps.length;
  // Once setup is complete the app opens on Ask IRA again (see getInitialView).
  useEffect(() => {
    if (setupDone) { try { localStorage.setItem(SETUP_DONE_KEY, '1'); } catch { /* ignore */ } }
  }, [setupDone]);

  // ── Coverage by engagement ──
  const engagements = libraryEngagements()
    .filter(e => e.type !== 'SOX / ICFR' && e.status !== 'Closed')
    .map(e => ({ e, cov: engagementCoverage(e) }))
    .filter(x => x.cov.total > 0)
    .sort((a, b) => Number(b.e.aiRecommended ?? 0) - Number(a.e.aiRecommended ?? 0) || a.cov.pct - b.cov.pct)
    .slice(0, 5);

  // ── Board rows: top 5 + you ──
  const top = board.slice(0, 5);
  const showMe = myIdx >= 5 && myRow;
  const bestAction = actions[0];
  const coach = ahead && myRow
    ? bestAction && bestAction.hours >= ahead.hours - myRow.hours
      ? `${bestAction.title} (+${fmtHours(bestAction.hours)}/mo) would take you past ${firstName(ahead.person)}.`
      : `${fmtHours(ahead.hours - myRow.hours)} behind ${firstName(ahead.person)} — every workflow you put live closes the gap.`
    : myIdx === 0 ? 'You lead the board — put more workflows live to stay there.' : '';

  const tips = [
    toReview.length > 0 && `${toReview.length} workflow${toReview.length === 1 ? '' : 's'} waiting for review are worth ${fmtHours(reviewHours)}/mo once approved.`,
    processOps[0] && `${PROCESS_LONG[processOps[0].proc]} has the biggest gap — ${processOps[0].keys.length} workflows, +${fmtHours(processOps[0].hours)}/mo.`,
    missingCodes.length > 0 && `Uploading ${missingCodes.slice(0, 2).join(' and ')} unblocks ${needsInput.length} workflow${needsInput.length === 1 ? '' : 's'} Ira already built.`,
    streak > 0 ? `Review within 48 hours to keep your ${streak}-week streak.` : 'Clear your reviews within 48 hours to start a streak.',
  ].filter(Boolean) as string[];

  const fade = (d = 0) => (reduced ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, delay: d, ease: [0.2, 0, 0, 1] as const } });

  return (
    <div className="max-w-[78rem] mx-auto px-6 md:px-8 pt-6 pb-20">
      {/* Greeting */}
      <motion.div {...fade()} className="mb-5">
        <h1 className="font-serif text-[2rem] tracking-tight text-ink-900 leading-tight">{greeting()}, {firstName(me)}</h1>
        <p className="text-[0.875rem] text-ink-500 mt-0.5">
          {needsInput.length + toReview.length > 0
            ? `${needsInput.length + toReview.length} thing${needsInput.length + toReview.length === 1 ? '' : 's'} need you today. Everything else Ira can do on its own.`
            : 'Nothing is waiting on you. Here’s where the next hours are.'}
        </p>
      </motion.div>

      {/* Score */}
      <motion.div {...fade(0.03)} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
          <div className="flex items-center justify-between text-[0.75rem] text-ink-600">
            <span>Hours returned · last 30 days</span>
            <span className="text-ink-400">est.</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-[1.875rem] font-semibold text-ink-900 leading-none">{fmtHours(hours30)}</span>
            {hours30 - hoursPrev > 0.05 && <span className="text-[0.75rem] font-medium text-compliant-700 tabular-nums">+{fmtHours(hours30 - hoursPrev)} vs prior 30 days</span>}
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-paper-100 overflow-hidden" role="img" aria-label={`${Math.round(hoursAll)} of ${nextMilestone} hours`}>
            <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, (hoursAll / nextMilestone) * 100)}%` }} />
          </div>
          <div className="mt-1 text-[0.6875rem] text-ink-500 tabular-nums">{fmtHours(hoursAll)} all time · next milestone {nextMilestone} h</div>
          <div className="mt-2 pt-2 border-t border-canvas-border flex items-center justify-between text-[0.75rem] tabular-nums">
            <span className="text-ink-600">Now returning <span className="font-semibold text-ink-900">{fmtHours(runRateFor(me))}/mo</span> from {myLive} live</span>
            {runRateAddedToday(me) > 0 && <span className="font-medium text-compliant-700">+{fmtHours(runRateAddedToday(me))}/mo today</span>}
          </div>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
          <div className="text-[0.75rem] text-ink-600">Your rank · {win === '30d' ? 'last 30 days' : 'all time'}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-[1.875rem] font-semibold text-ink-900 leading-none">#{myIdx + 1}</span>
            <span className="text-[0.8125rem] text-ink-500">of {board.length}</span>
          </div>
          <div className="mt-3 text-[0.75rem] text-ink-600">
            {ahead && myRow ? <>{fmtHours(ahead.hours - myRow.hours)} behind <span className="font-medium text-ink-900">{ahead.person}</span></> : 'Top of the board'}
          </div>
        </div>
        <div className="rounded-lg border border-canvas-border bg-canvas-elevated p-4">
          <div className="text-[0.75rem] text-ink-600">Review streak</div>
          <div className="mt-1 flex items-baseline gap-2">
            <Flame size={20} className={streak > 0 ? 'text-high-500' : 'text-ink-300'} aria-hidden />
            <span className="font-mono tabular-nums text-[1.875rem] font-semibold text-ink-900 leading-none">{streak}</span>
            <span className="text-[0.8125rem] text-ink-500">week{streak === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-3 text-[0.75rem] text-ink-600">{myRow?.onTimeReviews ?? 0} reviews done within 48 h this month</div>
        </div>
      </motion.div>

      {/* Setup checklist */}
      {!setupDone ? (
        <motion.section {...fade(0.06)} aria-label="Set up your workspace" className="rounded-lg border border-canvas-border bg-canvas-elevated mb-5">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-canvas-border">
            <IraMark size={24} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold text-ink-900">Set up your workspace</div>
              <div className="text-[0.75rem] text-ink-500">Upload, review, approve — Ira does the building. {doneCount} of {steps.length} done.</div>
            </div>
            <div className="flex items-center gap-1" aria-hidden>
              {steps.map(s => <span key={s.id} className={`w-6 h-1.5 rounded-full ${s.done ? 'bg-brand-600' : 'bg-paper-100'}`} />)}
            </div>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-canvas-border">
            {steps.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-3 px-4 py-3 ${i >= 2 ? 'md:border-t md:border-canvas-border' : ''} ${i % 2 === 1 ? 'md:border-l md:border-canvas-border' : ''}`}>
                <span className={`size-7 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'bg-compliant-50 text-compliant-700' : 'bg-paper-100 text-ink-500'}`}>
                  {s.done ? <Check size={14} strokeWidth={2.5} /> : <s.icon size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[0.8125rem] font-medium ${s.done ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-900'}`}>{s.title}</div>
                  <div className="text-[0.75rem] text-ink-500 truncate" title={s.sub}>{s.sub}</div>
                </div>
                {!s.done && (
                  <button onClick={s.run} className="h-7 px-2.5 rounded-md text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1 cursor-pointer shrink-0">
                    {s.cta} <ArrowRight size={12} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </motion.section>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-5">
        {/* Left column */}
        <div className="space-y-5 min-w-0">
          {/* Needs you */}
          <motion.section {...fade(0.09)} aria-label="Needs you">
            <SectionHead title="Needs you" count={needsInput.length + toReview.length} />
            {needsInput.length + toReview.length + building.length === 0 && !p.adaptDraft ? (
              <div className="rounded-lg border border-dashed border-canvas-border px-4 py-5 text-[0.8125rem] text-ink-500">
                You're clear. Pick a next best action below — Ira builds, you review.
              </div>
            ) : (
              <ul className="rounded-lg border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
                {p.adaptDraft && (
                  <NeedRow icon={<Sparkles size={14} className="text-brand-600" />} title={`Resume adapting ${p.adaptDraft.keys.length} standard workflow${p.adaptDraft.keys.length === 1 ? '' : 's'}`} sub="Your files are kept — pick up at Ira's plan" cta="Resume" onClick={p.onResumeAdapt} />
                )}
                {needsInput.length > 0 && (
                  <NeedRow icon={<CircleDashed size={14} className="text-mitigated-700" />} title={`${needsInput.length} workflow${needsInput.length === 1 ? '' : 's'} need a file`} sub={`${missingCodes.join(', ')} — one upload each unblocks them`} cta="Upload" onClick={p.onOpenBuilds} />
                )}
                {toReview.length > 0 && (
                  <NeedRow icon={<Check size={14} className="text-compliant-700" />} title={`${toReview.length} ready to review`} sub={`~${toReview.length * 2} min · +${fmtHours(reviewHours)}/mo once approved (est.)`} cta="Review" onClick={p.onOpenBuilds} />
                )}
                {building.length > 0 && (
                  <NeedRow icon={<Loader2 size={14} className="text-brand-600 animate-spin" />} title={`${building.length} building`} sub="Keeps going while you work — you'll get a notification" cta="Watch" onClick={p.onOpenBuilds} />
                )}
              </ul>
            )}
          </motion.section>

          {/* Next best actions */}
          {actions.length > 0 && (
            <motion.section {...fade(0.12)} aria-label="Next best actions">
              <SectionHead title="Next best actions" hint="ranked by hours a month they return" />
              <ul className="rounded-lg border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
                {actions.map(a => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-[4.5rem] shrink-0">
                      <span className="block font-mono tabular-nums text-[1rem] font-semibold text-brand-700 leading-none">+{fmtHours(a.hours)}</span>
                      <span className="text-[0.625rem] text-ink-400">a month · est.</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.8125rem] font-medium text-ink-900">{a.title}</div>
                      <div className="text-[0.75rem] text-ink-500 truncate" title={a.sub}>{a.sub}</div>
                    </div>
                    <button onClick={a.run} className="h-8 px-3 rounded-md bg-brand-50 text-brand-700 text-[0.75rem] font-semibold hover:bg-brand-100 inline-flex items-center gap-1 cursor-pointer shrink-0">
                      {a.cta} <ArrowRight size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {/* Coverage by engagement */}
          <motion.section {...fade(0.15)} aria-label="Coverage by engagement">
            <SectionHead title="Coverage by engagement" hint={`live automated controls · target ${TARGET}%`} />
            <ul className="rounded-lg border border-canvas-border bg-canvas-elevated divide-y divide-canvas-border">
              {engagements.map(({ e, cov }) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => p.onOpenEngagement(e.id)} className="min-w-0 flex-1 text-left cursor-pointer group">
                    <div className="flex items-center gap-2 text-[0.6875rem] text-ink-500">
                      <span className="font-mono font-semibold text-ink-700">{e.process}</span>
                      {e.aiRecommended && <span className="text-brand-700">AI plan</span>}
                    </div>
                    <div className="text-[0.8125rem] font-medium text-ink-900 truncate group-hover:text-brand-700">{e.name}</div>
                  </button>
                  <div className="w-40 shrink-0">
                    <div className="relative h-2 rounded-full bg-paper-100">
                      <div className={`absolute inset-y-0 left-0 rounded-full ${cov.pct >= TARGET ? 'bg-compliant-500' : 'bg-brand-600'}`} style={{ width: `${cov.pct}%` }} />
                      <div className="absolute -top-0.5 -bottom-0.5 w-px bg-ink-700" style={{ left: `${TARGET}%` }} title={`Target ${TARGET}%`} />
                    </div>
                    <div className="mt-1 text-[0.6875rem] text-ink-500 tabular-nums">{cov.pct}% · {cov.live} of {cov.total} live</div>
                  </div>
                  {cov.pct < TARGET && cov.needKeys.length > 0 ? (
                    <button onClick={() => setAdaptKeys(cov.needKeys)} className="h-7 px-2 rounded-md text-[0.75rem] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer shrink-0 w-20">
                      Raise
                    </button>
                  ) : <span className="w-20 shrink-0 text-right text-[0.75rem] text-compliant-700">{cov.pct >= TARGET ? 'On target' : ''}</span>}
                </li>
              ))}
            </ul>
          </motion.section>
        </div>

        {/* Right column */}
        <div className="space-y-5 min-w-0">
          <motion.section {...fade(0.1)} aria-label="Leaderboard">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[0.9375rem] font-semibold text-ink-900">Leaderboard</h2>
              <div role="tablist" className="flex items-center gap-0.5 rounded-full bg-paper-100 p-0.5">
                {([['30d', '30 days'], ['all', 'All time']] as const).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={win === id} onClick={() => setWin(id)} className={`h-6 px-2.5 rounded-full text-[0.6875rem] font-medium cursor-pointer ${win === id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-canvas-border bg-canvas-elevated">
              <ol>
                {top.map((r, i) => <BoardLine key={r.person} rank={i + 1} row={r} me={r.person === me} hidden={hidden} />)}
                {showMe && myRow && (
                  <>
                    <li className="px-4 text-[0.75rem] text-ink-300 leading-none py-1" aria-hidden>⋯</li>
                    <BoardLine rank={myIdx + 1} row={myRow} me hidden={hidden} />
                  </>
                )}
              </ol>
              {coach && <p className="px-4 py-2.5 border-t border-canvas-border text-[0.75rem] text-ink-600">{coach}</p>}
              <div className="flex items-center justify-between px-4 py-2 border-t border-canvas-border text-[0.6875rem] text-ink-400">
                <span>Hours go to a workflow's owner while it's live · est.</span>
                <button
                  onClick={() => { setNameHidden(!hidden); setHidden(!hidden); }}
                  className="inline-flex items-center gap-1 hover:text-ink-700 cursor-pointer"
                >
                  {hidden ? <EyeOff size={11} /> : <Eye size={11} />}{hidden ? 'Name hidden from others' : 'Hide my name'}
                </button>
              </div>
            </div>
          </motion.section>

          <motion.section {...fade(0.13)} aria-label="How to raise your score">
            <SectionHead title="How to raise your score" />
            <ul className="rounded-lg border border-canvas-border bg-canvas-elevated px-4 py-3 space-y-2">
              {tips.map(t => (
                <li key={t} className="flex items-start gap-2 text-[0.8125rem] text-ink-700">
                  <ArrowRight size={13} className="mt-0.5 text-brand-600 shrink-0" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section {...fade(0.16)} aria-label="Milestones">
            <SectionHead title="Milestones" />
            <ul className="grid grid-cols-2 gap-2">
              {MILESTONES.map(m => {
                const got = m.test(myLive, hoursAll);
                return (
                  <li key={m.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${got ? 'border-canvas-border bg-canvas-elevated' : 'border-dashed border-canvas-border'}`}>
                    <Medal size={15} className={got ? 'text-high-500' : 'text-ink-300'} aria-hidden />
                    <span className={`text-[0.75rem] ${got ? 'font-medium text-ink-900' : 'text-ink-400'}`}>{m.label}</span>
                  </li>
                );
              })}
              <li className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${fullProcess ? 'border-canvas-border bg-canvas-elevated' : 'border-dashed border-canvas-border'}`}>
                <Workflow size={15} className={fullProcess ? 'text-high-500' : 'text-ink-300'} aria-hidden />
                <span className={`text-[0.75rem] ${fullProcess ? 'font-medium text-ink-900' : 'text-ink-400'}`}>A process fully live</span>
              </li>
              <li className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${streak >= 4 ? 'border-canvas-border bg-canvas-elevated' : 'border-dashed border-canvas-border'}`}>
                <Flame size={15} className={streak >= 4 ? 'text-high-500' : 'text-ink-300'} aria-hidden />
                <span className={`text-[0.75rem] ${streak >= 4 ? 'font-medium text-ink-900' : 'text-ink-400'}`}>4-week review streak</span>
              </li>
            </ul>
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {adaptKeys && (
          <AdaptDataModal
            keys={adaptKeys}
            onClose={() => setAdaptKeys(null)}
            onContinue={(choices) => { const k = adaptKeys; setAdaptKeys(null); p.onAdapt(k, choices); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionHead({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <h2 className="text-[0.9375rem] font-semibold text-ink-900">{title}</h2>
      {count != null && count > 0 && <span className="font-mono text-[0.75rem] text-ink-500 tabular-nums">{count}</span>}
      {hint && <span className="text-[0.75rem] text-ink-400">{hint}</span>}
    </div>
  );
}

function NeedRow({ icon, title, sub, cta, onClick }: { icon: React.ReactNode; title: string; sub: string; cta: string; onClick: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="size-7 rounded-md bg-paper-50 border border-canvas-border flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.8125rem] font-medium text-ink-900">{title}</div>
        <div className="text-[0.75rem] text-ink-500 truncate" title={sub}>{sub}</div>
      </div>
      <button onClick={onClick} className="h-8 px-3 rounded-md bg-primary text-white text-[0.75rem] font-semibold hover:bg-primary-hover inline-flex items-center gap-1 cursor-pointer shrink-0">
        {cta} <ArrowRight size={12} />
      </button>
    </li>
  );
}

function BoardLine({ rank, row, me, hidden }: { rank: number; row: { person: string; hours: number; live: number; onTimeReviews: number }; me: boolean; hidden: boolean }) {
  return (
    <li className={`flex items-center gap-3 px-4 py-2.5 ${me ? 'bg-brand-50/50' : ''}`}>
      <span className={`w-5 text-center font-mono tabular-nums text-[0.8125rem] ${rank <= 3 ? 'font-semibold text-ink-900' : 'text-ink-400'}`}>{rank}</span>
      <span className={`size-7 rounded-full flex items-center justify-center text-[0.625rem] font-semibold shrink-0 ${me ? 'bg-brand-600 text-white' : 'bg-paper-100 text-ink-700'}`}>{initials(row.person)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-medium text-ink-900 truncate">{me ? `You${hidden ? ' · hidden' : ''}` : row.person}</span>
        <span className="block text-[0.6875rem] text-ink-500 tabular-nums">{row.live} live · {row.onTimeReviews} on-time reviews</span>
      </span>
      <span className="font-mono tabular-nums text-[0.875rem] font-semibold text-ink-900">{fmtHours(row.hours)}</span>
    </li>
  );
}
