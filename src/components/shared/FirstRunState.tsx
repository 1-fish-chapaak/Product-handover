/**
 * First-run state — what a page says in a new client's workspace, before
 * anything has run on their data. Not an apology for being empty: it names
 * what the page is for, what will fill it, and the one step that starts it.
 * Copy lives here, per page, so every empty page speaks in the same voice.
 */
import { ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { useStdState, CHECK_CATALOG, readinessOf } from '../../data/auditPlan';

export type FirstRunPage = 'engagements' | 'my-queue' | 'audit-planning' | 'risk-register' | 'reports' | 'insights';

interface Cta { label: string; view: string }
interface Copy { page: string; title: string; body: string; fills: string[]; primary: Cta; secondary?: Cta }

const COPY: Record<FirstRunPage, Copy> = {
  engagements: {
    page: 'Engagements',
    title: 'No engagements yet',
    body: 'An engagement is one audit round — its scope, the controls in it, a check for each, and a timeline. Ira drafts them from the standard library, one per process, for you to review.',
    fills: [
      'Each round’s scope, owner and period',
      'Coverage — how many of its controls are tested live',
      'Findings and sign-offs as the round closes',
    ],
    primary: { label: 'Plan an audit with Ira', view: 'audit-with-ai' },
    secondary: { label: 'Browse the standard library', view: 'governance-controls' },
  },
  'my-queue': {
    page: 'My Queue',
    title: 'Nothing in your queue',
    body: 'Work assigned to you lands here — workflows Ira built for your review, exceptions to clear and sign-offs. It starts filling the moment you adapt the standard library.',
    fills: [
      'Built workflows waiting for your approval',
      'Exceptions from workflow runs to clear',
      'Engagement sign-offs and evidence requests',
    ],
    primary: { label: 'Adapt the standard library', view: 'governance-controls' },
    secondary: { label: 'Open Builds & reviews', view: 'builds' },
  },
  'audit-planning': {
    page: 'Audit Planning',
    title: 'No audit plan yet',
    body: 'The plan sets which processes you audit, when, and who owns each round. Ira drafts it from your processes, their risks and the standard library.',
    fills: [
      'Rounds by quarter, each with an owner',
      'Priority per process, weighted by risk',
      'The coverage you’ll reach by year end',
    ],
    primary: { label: 'Plan with Ira', view: 'audit-with-ai' },
    secondary: { label: 'Open Process Hub', view: 'programs' },
  },
  'risk-register': {
    page: 'Risk Register',
    title: 'Your risk register is empty',
    body: 'Risks arrive with the RACMs you create or import. Every standard control already maps to a risk, so they appear here as you adapt controls and publish RACMs.',
    fills: [
      'Each risk with its rating, owner and process',
      'The controls that mitigate it — and which are tested live',
      'Gaps: risks no tested control covers',
    ],
    primary: { label: 'Create a RACM', view: 'racm-library' },
    secondary: { label: 'Open the Control Library', view: 'governance-controls' },
  },
  reports: {
    page: 'Reports',
    title: 'No reports yet',
    body: 'Reports are written from what runs — workflow exceptions, engagement results and sign-offs. The first one appears after your first workflow goes live.',
    fills: [
      'Exception reports from each workflow run',
      'Engagement summaries for the audit committee',
      'Coverage and hours-returned trends',
    ],
    primary: { label: 'Adapt the standard library', view: 'governance-controls' },
    secondary: { label: 'Plan an audit with Ira', view: 'audit-with-ai' },
  },
  insights: {
    page: 'Insights',
    title: 'Insights appear once workflows run',
    body: 'Trends in exceptions, coverage and hours returned — by process, engagement and person. Put your first workflow live and the first chart draws itself.',
    fills: [
      'Exceptions over time, by process',
      'Coverage against target, by engagement',
      'Hours returned, by person and workflow',
    ],
    primary: { label: 'Adapt the standard library', view: 'governance-controls' },
  },
};

export default function FirstRunState({ page, onNavigate }: { page: FirstRunPage; onNavigate: (view: string) => void }) {
  const c = COPY[page];
  const std = useStdState();
  const auto = CHECK_CATALOG.filter(e => e.automatable);
  const live = auto.filter(e => readinessOf(e, std) === 'live').length;
  const built = auto.filter(e => readinessOf(e, std) === 'awaiting-review').length;
  const progress = live > 0
    ? `${live} of ${auto.length} standard workflows live`
    : built > 0
      ? `${built} standard workflow${built === 1 ? '' : 's'} built, waiting for review`
      : 'Nothing has run on your data yet';

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="max-w-[52rem] mx-auto px-8 pt-16 pb-20">
        <div className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400">
          <span>{c.page}</span>
          <span aria-hidden>·</span>
          <span>New workspace</span>
        </div>
        <h1 className="mt-3 font-serif text-[2.25rem] leading-[1.15] tracking-tight text-ink-900 max-w-[34rem]">{c.title}</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-600 max-w-[38rem]">{c.body}</p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Button variant="primary" rightIcon={<ArrowRight size={14} />} onClick={() => onNavigate(c.primary.view)}>{c.primary.label}</Button>
          {c.secondary && <Button variant="outline" onClick={() => onNavigate(c.secondary!.view)}>{c.secondary.label}</Button>}
        </div>

        <section aria-label="What fills this page" className="mt-14">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-400 mb-1">What fills this page</div>
          <ol className="border-t border-canvas-border">
            {c.fills.map((f, i) => (
              <li key={f} className="flex items-baseline gap-5 py-3.5 border-b border-canvas-border">
                <span className="font-mono text-[0.75rem] text-ink-300 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[0.875rem] text-ink-700">{f}</span>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-8 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-ink-500">
          <span>{progress}.</span>
          <button onClick={() => onNavigate('home')} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline cursor-pointer">
            See your set-up checklist <ArrowRight size={11} aria-hidden />
          </button>
        </p>
      </div>
    </div>
  );
}
