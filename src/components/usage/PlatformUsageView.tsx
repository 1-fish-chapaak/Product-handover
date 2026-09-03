/**
 * Platform Usage. One page, four readers, one question.
 *
 * The question is whether the platform is worth paying for: what this quarter's
 * audit work would have cost in human time, what it cost with us, and what the
 * difference is worth. Every input to that answer is a record in the customer's
 * own tenant except the price of an auditor hour, which is derived from
 * published pay data and carries its whole derivation on screen beside every
 * figure it produces.
 *
 * ## Two controls, and they do different jobs
 *
 * **Viewing as** picks which of the two views leads: value, or coverage and
 * findings. It changes the order of the page and never the layout,
 * the wording or the names of things, so a reader who changes role never
 * relearns the page.
 *
 * **Scope** picks whose records are counted, and it is bounded by entitlement.
 * It only ever narrows down the reader's own line: the whole company, then your
 * own team, then your own work. Nobody can look sideways into somebody else's
 * team, and a scope the reader is not entitled to is not offered at all, so the
 * control cannot be used to ask for one.
 *
 * The header line says all four things in one sentence, so a screenshot of this
 * page landing in a board pack still states who was reading, over what, over
 * which window, and how fresh the numbers were.
 *
 * ## Read and never write
 *
 * No control here changes a record the page reports on. Every route off it ends
 * at the screen that owns the action. Nothing asks the customer to supply data
 * the page then treats as a fact: the two measurable assumptions replace
 * themselves from the customer's own recorded history, the two that cannot be
 * measured are labelled and derived, and lookup prices are contract terms our
 * operations team seeds when the deal is signed. There is no rate field, no
 * pace field and no price field, because a figure the customer typed is not a
 * figure we can defend. The custom window's two dates are the only fields in
 * the feature and they are a view control rather than data entry. The one write
 * in the whole feature is the audit event an export emits.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, Download, FileText, Lock, Users } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import { ANCHOR, HISTORY_START, dataAsOfLabel, formatDate, isoDay } from '../../data/platform-usage';
import { pack } from '../../data/audit-coverage';
import {
  DEFAULT_PERIOD, PERSONA_SCOPE_LABEL, PERSONA_TITLE, REFUSAL,
  calibrate, entitledViews, period as buildPeriod, periodOptions, personaFor, snapshot,
  type CustomRange, type Persona, type PeriodId, type Scope,
} from '../../data/platform-usage-metrics';
import { Group, type GroupSpec } from './usageChrome';
import { valueGroups } from './UsageValue';
import { coverageGroups } from './UsageCoverage';
import { runsGroups } from './UsageRuns';
import { downloadUsageCsv } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

/*
 * Two views, not three.
 *
 * An Activity view was built and cut. Two of its three blocks could not name a
 * decision that turned on them: "who is using it" was per person adoption, which
 * this product deliberately does not do, and "what got created" was a number
 * because it was countable. The third, what ran and what is stuck, survives on
 * the value view, because a stuck check is work that did not happen and the
 * saving printed above it is understated by exactly that much. It is a caveat
 * on the money, not a subject beside it.
 */

type ViewId = 'value' | 'coverage';

const VIEW_TITLE: Record<ViewId, string> = {
  value: 'Value',
  coverage: 'Coverage and findings',
};

/** Who each view was built for, said on the switch so nobody has to guess. */
const VIEW_READER: Record<ViewId, string> = {
  value: 'finance, and our account team before a renewal call',
  coverage: 'the audit lead',
};

/** The question the view exists to answer, in the reader's own words. */
const VIEW_QUESTION: Record<ViewId, string> = {
  value: 'Is this paying for itself?',
  coverage: 'Am I ready for the committee, and what is slipping?',
};

/** The sections the page is built from. A view is an order over these. */
type SectionId = 'value' | 'runs' | 'coverage';

const VIEW_ORDER: Record<ViewId, SectionId[]> = {
  value: ['value', 'runs', 'coverage'],
  coverage: ['coverage', 'value', 'runs'],
};

/** Each view opens with its own first three groups. The rest fold. */
const GROUPS_OPEN_AT_REST = 3;

/** Deep links out to the screen that owns the work, the way the palette does. */
function navigate(view: string, id = '') {
  window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', { detail: { kind: 'control', id, view } }));
}

export default function PlatformUsageView() {
  const { currentUser } = useCurrentUser();
  const { can } = useCan();
  const { users } = useAdminData();
  const { addToast } = useToast();

  /*
   * The weekly job, run as the page is read. Once both guards pass, a measured
   * value replaces a starting one by itself, with no confirmation and no click.
   * It settles before the first render, so nobody watches a starting value
   * flash to a measured one.
   */
  const [settings] = useState(() => calibrate());

  /* ── Who is reading, and how far up they may see ─────────────────────────── */

  const me = users.find(u => u.email === currentUser?.email);
  const myTeam = me?.team && me.team !== '—' ? me.team : null;
  const myName = me?.name ?? currentUser?.name ?? '';

  const ceiling: Persona = useMemo(
    () => personaFor({ usage: can('ad_usage'), people: can('ad_usage_people'), self: can('ad_usage_self') }, myTeam),
    [can, myTeam],
  );

  const scopes = useMemo(() => entitledViews(ceiling, myTeam), [ceiling, myTeam]);
  const [requestedScope, setRequestedScope] = useState<Persona>(ceiling);

  /*
   * The entitlement is resolved rather than trusted. A scope above what this
   * role may read is refused in words, never quietly downgraded and never
   * rendered as an empty page, because an empty page would hide a permissions
   * bug behind something that reads as "no data".
   */
  const entitled = scopes.includes(requestedScope);
  const persona = entitled ? requestedScope : ceiling;

  const scope = useMemo<Scope>(() => {
    if (persona === 'cfo') return { persona: 'cfo', subject: 'the company' };
    if (persona === 'head_of_team') {
      return {
        persona: 'head_of_team', subject: myTeam ?? 'your team', team: myTeam ?? undefined,
        userEmail: currentUser?.email, userName: myName,
      };
    }
    return { persona: 'auditor', subject: 'you', userEmail: currentUser?.email, userName: myName };
  }, [persona, myTeam, currentUser?.email, myName]);

  /*
   * Somebody reading their own work sees hours and never rupees. "You saved 84
   * hours" is an achievement. "You saved a lakh" is somebody pricing them.
   */
  const showMoney = persona !== 'auditor';
  const canSeeNames = can('ad_usage_people');
  const canExport = can('ad_usage_export');

  /* ── Which view leads ────────────────────────────────────────────────────── */

  /*
   * Where a reader lands, and why it is not guessed.
   *
   * The four readers are not distinguishable by permission and never will be.
   * System Admin carries every key, so one person holds it while being, at
   * different moments, the workspace admin, the audit lead, and the person who
   * talks to finance before a renewal. Guessing which of the three they are
   * today costs trust every time it guesses wrong, so the page does not guess.
   *
   * Anyone who can read the company figures lands on Value, because that is the
   * question this page exists to answer and the one every reader shares.
   * Anyone who cannot lands on what they can actually see. After that the page
   * opens where they left it, which is what makes a wrong first landing cost
   * one click once rather than one click every visit.
   */
  const homeView: ViewId = useMemo(() => {
    if (can('ad_usage')) return 'value';
    return 'coverage';
  }, [can]);

  const rememberKey = `irame:platform-usage:view:${currentUser?.email ?? 'anonymous'}`;

  const [view, setView] = useState<ViewId>(() => {
    try {
      const saved = window.localStorage.getItem(rememberKey);
      if (saved === 'value' || saved === 'coverage') return saved;
    } catch {
      // Storage can be off. A reader with no storage lands on their home view,
      // which is the same place they landed the first time anyway.
    }
    return homeView;
  });

  /** Remembered per person, so the switch is a choice rather than a chore. */
  const chooseView = (next: ViewId) => {
    setView(next);
    try {
      window.localStorage.setItem(rememberKey, next);
    } catch {
      // Not remembering is a worse page, not a broken one.
    }
  };

  /* ── The window ──────────────────────────────────────────────────────────── */

  const [periodId, setPeriodId] = useState<PeriodId>(() => DEFAULT_PERIOD[ceiling]);

  /*
   * The custom range.
   *
   * A window control is a view control rather than data entry: it changes which
   * records are counted and the page never treats a date as a fact about the
   * customer's business the way it would treat a rate somebody typed. So these
   * two fields are the only ones in the feature, and nothing else asks the
   * reader to supply anything.
   *
   * It opens on whatever window is already showing rather than on two empty
   * boxes, so the page never blanks while somebody is halfway through picking.
   */
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const period = useMemo(() => buildPeriod(periodId, custom), [periodId, custom]);

  const chooseWindow = (id: PeriodId) => {
    if (id !== 'custom') {
      setCustomOpen(false);
      setPeriodId(id);
      return;
    }
    setCustom(prev => prev ?? { from: period.from, to: period.to });
    setPeriodId('custom');
    setCustomOpen(true);
  };

  /*
   * The window is one chip rather than six buttons.
   *
   * Six windows laid out side by side is six times the chrome of a control
   * somebody touches once and then reads for ten minutes, and it pushed the
   * scope control on to a second line where the two read as one undifferentiated
   * row of pills. Nothing was taken away: every window is still on the list, one
   * press further in, and it is built from buttons because there is no form on
   * this page and there must not be one.
   */
  const [windowMenu, setWindowMenu] = useState(false);
  const windowAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!windowMenu) return;
    const close = () => setWindowMenu(false);
    const onAway = (e: MouseEvent) => {
      if (!windowAnchor.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', onAway);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onAway);
      window.removeEventListener('keydown', onKey);
    };
  }, [windowMenu]);

  /* ── Every figure on the page, assembled once ────────────────────────────── */

  const data = useMemo(() => snapshot(scope, period, settings), [scope, period, settings]);

  /*
   * The committee's own six lines, on the same window the page is reading. They
   * are computed from the same records and they carry no assumed rate at all,
   * which is what makes the coverage view the one an audit lead can be argued
   * at and not moved.
   */
  const committee = useMemo(() => pack(period), [period]);

  /* ── The groups, in the order this view needs them ───────────────────────── */

  const groups: GroupSpec[] = useMemo(() => {
    const byView: Record<SectionId, GroupSpec[]> = {
      value: valueGroups({
        data, period, settings, showMoney,
        onOpenRate: () => reveal('rate'),
        onOpenRuns: () => navigate('workflow-library'),
      }),
      coverage: coverageGroups({
        data, committee, period, scope,
        onOpenEngagements: () => navigate('engagements'),
        onOpenRisks: () => navigate('audit-risk-register'),
        onOpenControls: () => navigate('governance-controls'),
        onOpenFinding: id => navigate('engagements', id),
      }),
      runs: runsGroups({
        data, period, showMoney,
        onOpenRuns: (id?: string) => navigate('workflow-library', id ?? ''),
      }),
    };
    return VIEW_ORDER[view].flatMap(id => byView[id]);
    // `reveal` is stable for the life of the page and is left out on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, data, committee, period, settings, scope, showMoney, canSeeNames]);

  const [open, setOpen] = useState<string[]>([]);

  // Each view opens with its own first three groups and folds the rest. A
  // reader who then opens a fourth keeps it open until they change view.
  useEffect(() => {
    setOpen(groups.slice(0, GROUPS_OPEN_AT_REST).map(g => g.id));
    // The group list changes with every window and every scope; the fold state
    // is meant to reset only when the reader changes which view leads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, persona]);

  const toggle = (id: string) => setOpen(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  /** Open a folded group and go to it. Used by a drill down that stays on the page. */
  const reveal = (id: string) => {
    setOpen(prev => (prev.includes(id) ? prev : [...prev, id]));
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  /*
   * Which group the reader is standing in, so the contents beside the page can
   * say so. It is read off the scroll rather than off the last thing clicked,
   * because a reader who scrolls past four groups has not clicked anything.
   */
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    const seen = new Set<string>();
    const spy = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        // Nothing in the band happens at the very top of the page, where the
        // reader is plainly standing in the first group. Marking nothing there
        // would make the contents look broken on arrival.
        const first = groups.find(g => seen.has(g.id));
        setActiveGroup(first ? first.id : groups[0]?.id ?? null);
      },
      { rootMargin: '-72px 0px -60% 0px' },
    );
    for (const group of groups) {
      const el = document.getElementById(group.id);
      if (el) spy.observe(el);
    }
    return () => spy.disconnect();
  }, [groups]);

  /* ── Export. The one write in the whole feature ──────────────────────────── */

  const exportView = { title: VIEW_TITLE[view], reader: VIEW_READER[view] };

  const onExportCsv = () => {
    downloadUsageCsv(data, exportView);
    addToast({ type: 'success', message: 'Exported. The file carries the scope, the window and every assumption with its derivation.' });
  };

  const onExportPdf = async () => {
    await downloadUsagePdf(data, exportView);
    addToast({ type: 'success', message: 'Exported as a PDF, with the coverage note and the rate derivation on the first pages.' });
  };

  /* ── A refusal, never a blank page ───────────────────────────────────────── */

  if (!entitled) {
    return (
      <div className="h-full flex items-center justify-center bg-canvas px-6">
        <div className="max-w-lg text-center">
          <Lock size={20} className="mx-auto text-ink-400" />
          <h1 className="mt-3 text-[1.25rem] font-semibold text-ink-900">Platform Usage</h1>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-600">{REFUSAL}</p>
          <button
            type="button"
            onClick={() => setRequestedScope(ceiling)}
            className="mt-4 h-8 px-3 rounded-lg border border-canvas-border text-[0.75rem] font-medium text-ink-700 hover:border-brand-200 hover:text-brand-700"
          >
            Go back to {PERSONA_SCOPE_LABEL[ceiling].toLowerCase()}
          </button>
        </div>
      </div>
    );
  }

  /*
   * The whole sentence, even though the switches carry parts of it.
   *
   * It reads as a repetition on screen and it is not one. This line is what
   * travels: a screenshot of this page lands in a board pack with no controls
   * beside it, and a figure whose reader, scope and window cannot be read off
   * the same image is a figure nobody can defend six weeks later.
   */
  const headerLine = [
    `Viewing as ${VIEW_TITLE[view]}, read by ${VIEW_READER[view]}`,
    PERSONA_SCOPE_LABEL[persona] + (persona === 'head_of_team' && myTeam ? `, ${myTeam}` : ''),
    `${period.label}, ${formatDate(period.from)} to ${formatDate(period.to)}`,
    dataAsOfLabel(),
  ].join(' · ');

  /*
   * The two narrowing controls sit together, under the view switch and away
   * from it. Both answer the same shape of question, "whose records and over
   * what days". The view switch is the only control that changes what the page
   * is about, so it is the only one that reads as navigation.
   */
  const pill = (active: boolean) =>
    `h-7 px-2.5 rounded-md text-[0.75rem] font-medium transition-colors ${
      active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:text-brand-700'
    }`;

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 pb-16 max-w-[1180px]">
        <header className="border-b border-canvas-border pb-4">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900 leading-tight">Platform Usage</h1>
          <p className="mt-1.5 text-[1rem] leading-relaxed text-ink-600 max-w-[70ch]">
            What this quarter's audit work would have cost in human time, and what it cost with us.
          </p>

          {/*
            * The view switch. It changes which of the two questions the page
            * leads with, which is the one thing here that behaves like moving
            * between places, so it is the one thing built like it.
            */}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-canvas-border">
            <div role="group" aria-label="Viewing as" className="flex gap-7">
              {(['value', 'coverage'] as ViewId[]).map(id => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => chooseView(id)}
                  title={VIEW_QUESTION[id]}
                  className={`relative -mb-px pb-3 text-[0.875rem] font-medium transition-colors ${
                    view === id ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  {VIEW_TITLE[id]}
                  {view === id ? (
                    <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-brand-600" />
                  ) : null}
                </button>
              ))}
            </div>

            {canExport ? (
              <div className="flex items-center gap-2 pb-2">
                <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={onExportCsv}>
                  CSV
                </Button>
                <Button variant="outline" size="sm" leftIcon={<FileText size={14} />} onClick={onExportPdf}>
                  PDF
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            {/* The question the chosen view answers, said in words, so a reader
                picking for themselves never needs us to have guessed right. */}
            <p className="text-[1rem] text-ink-700">{VIEW_QUESTION[view]}</p>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/*
                * The scope control, offering only what this reader is entitled
                * to. One entitled scope is not a choice, so it renders as
                * furniture rather than as a control nobody can use. It stays
                * open on the page because it is short and because a reader has
                * to be able to see, without pressing anything, how far up they
                * are allowed to look.
                */}
              {scopes.length > 1 ? (
                <div role="group" aria-label="Counting" className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                  {scopes.map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setRequestedScope(id)}
                      aria-pressed={persona === id}
                      title={PERSONA_TITLE[id]}
                      className={pill(persona === id)}
                    >
                      {PERSONA_SCOPE_LABEL[id]}
                    </button>
                  ))}
                </div>
              ) : null}

              <div ref={windowAnchor} className="relative">
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={windowMenu}
                  aria-label={`Window, ${period.label}`}
                  onClick={() => setWindowMenu(v => !v)}
                  className="h-8 inline-flex items-center gap-2 rounded-lg border border-canvas-border bg-canvas-elevated pl-2.5 pr-2 text-[0.875rem] font-medium text-ink-700 transition-colors hover:border-brand-200 hover:text-brand-700"
                >
                  <Calendar size={14} className="text-ink-400" aria-hidden />
                  {period.label}
                  <ChevronDown
                    size={14}
                    className={`text-ink-400 transition-transform duration-200 ease-out ${windowMenu ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {windowMenu ? (
                  <div
                    className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-canvas-border bg-canvas-elevated py-1 shadow-lg"
                  >
                    {periodOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => { chooseWindow(option.id); setWindowMenu(false); }}
                        className={`block w-full px-3 py-1.5 text-left text-[0.875rem] transition-colors ${
                          periodId === option.id
                            ? 'font-medium text-brand-700'
                            : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {customOpen ? (
            <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3">
              <label className="text-[0.75rem] text-ink-500">
                From
                <input
                  type="date"
                  aria-label="Window starts"
                  value={isoDay(period.from)}
                  min={isoDay(HISTORY_START)}
                  max={isoDay(ANCHOR)}
                  onChange={e => {
                    const from = Date.parse(`${e.target.value}T00:00:00Z`);
                    if (!Number.isNaN(from)) setCustom(prev => ({ from, to: prev?.to ?? ANCHOR }));
                  }}
                  className="mt-1 block h-8 px-2 rounded-lg border border-canvas-border bg-canvas text-[0.875rem] text-ink-900 tabular-nums"
                />
              </label>
              <label className="text-[0.75rem] text-ink-500">
                To
                <input
                  type="date"
                  aria-label="Window ends"
                  value={isoDay(period.to)}
                  min={isoDay(HISTORY_START)}
                  max={isoDay(ANCHOR)}
                  onChange={e => {
                    const to = Date.parse(`${e.target.value}T23:59:59Z`);
                    if (!Number.isNaN(to)) setCustom(prev => ({ from: prev?.from ?? HISTORY_START, to }));
                  }}
                  className="mt-1 block h-8 px-2 rounded-lg border border-canvas-border bg-canvas text-[0.875rem] text-ink-900 tabular-nums"
                />
              </label>
              <p className="text-[0.75rem] leading-relaxed text-ink-500 max-w-[52ch]">
                Your records run from {formatDate(HISTORY_START)} to {formatDate(ANCHOR)}. Every figure on the
                page moves with these two dates, and the comparison becomes the same number of days
                immediately before them.
              </p>
            </div>
          ) : null}

          <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-500 tabular-nums">{headerLine}</p>
        </header>

        {/*
          * The contents, and the page beside them.
          *
          * Twenty five blocks is more than anybody reads, so the page says what
          * it holds and lets a reader open the one they came for. On a wide
          * screen that list stands still in the margin the reading column was
          * never using, and marks where the reader is. On a narrow one it goes
          * back above the page, because a margin that thin is not a margin.
          */}
        <div className="mt-6 flex items-start gap-10">
          <div className="min-w-0 flex-1">
            <nav aria-label="What is on this page" className="lg:hidden mb-2 flex flex-wrap gap-x-5 gap-y-2">
              {groups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => reveal(group.id)}
                  className="text-[0.75rem] text-ink-500 underline decoration-canvas-border underline-offset-[3px] hover:text-brand-700 hover:decoration-brand-300"
                >
                  {group.title}
                </button>
              ))}
            </nav>

            {/* Their own wrapper, so the first group is the first child and
                keeps its rule off. The contents above it is a sibling that
                disappears at this width, not a group. */}
            <div>
              {groups.map(group => (
                <Group
                  key={group.id}
                  id={group.id}
                  title={group.title}
                  answer={group.answer}
                  open={open.includes(group.id)}
                  onToggle={() => toggle(group.id)}
                >
                  {group.node}
                </Group>
              ))}
            </div>
          </div>

          <nav aria-label="What is on this page" className="hidden lg:block w-[184px] shrink-0">
            <div className="sticky top-8">
              <p className="text-[0.75rem] font-medium text-ink-400">What is on this page</p>
              <ul className="mt-3 border-l border-canvas-border">
                {groups.map(group => (
                  <li key={group.id}>
                    <button
                      type="button"
                      onClick={() => reveal(group.id)}
                      aria-current={activeGroup === group.id ? 'true' : undefined}
                      className={`-ml-px block w-full border-l py-1.5 pl-3 text-left text-[0.75rem] leading-[1.5] transition-colors ${
                        activeGroup === group.id
                          ? 'border-brand-600 font-medium text-brand-700'
                          : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800'
                      }`}
                    >
                      {group.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
