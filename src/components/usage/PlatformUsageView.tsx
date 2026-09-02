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
 * **Viewing as** picks which of the three views leads: value, coverage and
 * findings, or activity. It changes the order of the page and never the layout,
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
 * at the screen that owns the action. There is no input field anywhere in the
 * feature: the two measurable assumptions replace themselves from the
 * customer's own recorded history, the two that cannot be measured are labelled
 * and derived, and lookup prices are contract terms our operations team seeds
 * when the deal is signed. The one write in the whole feature is the audit
 * event an export emits.
 */

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Lock } from 'lucide-react';
import { useCurrentUser, useCan } from '../../context/CurrentUserContext';
import { useAdminData } from '../../context/AdminDataContext';
import { useToast } from '../shared/Toast';
import { Button } from '../shared/Button';
import { dataAsOfLabel, formatDate } from '../../data/platform-usage';
import { pack } from '../../data/audit-coverage';
import {
  DEFAULT_PERIOD, PERSONA_SCOPE_LABEL, PERSONA_TITLE, REFUSAL,
  calibrate, entitledViews, period as buildPeriod, periodOptions, personaFor, snapshot,
  type Persona, type PeriodId, type Scope,
} from '../../data/platform-usage-metrics';
import { Group, type GroupSpec } from './usageChrome';
import { valueGroups } from './UsageValue';
import { coverageGroups } from './UsageCoverage';
import { activityGroups } from './UsageActivity';
import { downloadUsageCsv } from './usageExport';
import { downloadUsagePdf } from './usagePdf';

/* ── The three views ─────────────────────────────────────────────────────── */

type ViewId = 'value' | 'coverage' | 'activity';

const VIEW_TITLE: Record<ViewId, string> = {
  value: 'Value',
  coverage: 'Coverage and findings',
  activity: 'Activity',
};

/** Who each view was built for, said on the switch so nobody has to guess. */
const VIEW_READER: Record<ViewId, string> = {
  value: 'Finance, and our account team before a renewal call',
  coverage: 'The audit lead',
  activity: 'The workspace admin',
};

/** The question the view exists to answer, in the reader's own words. */
const VIEW_QUESTION: Record<ViewId, string> = {
  value: 'Is this paying for itself?',
  coverage: 'Am I ready for the committee, and what is slipping?',
  activity: 'Is the team actually using what we bought?',
};

const VIEW_ORDER: Record<ViewId, ViewId[]> = {
  value: ['value', 'coverage', 'activity'],
  coverage: ['coverage', 'value', 'activity'],
  activity: ['activity', 'coverage', 'value'],
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
   * Where each of the four readers lands, decided by what their role actually
   * holds rather than by anything they type. A workspace admin manages people,
   * which is what separates them from a CFO who reads the same company figures.
   */
  const homeView: ViewId = useMemo(() => {
    if (can('ad_usage') && (can('ad_users_manage') || can('ad_roles_manage'))) return 'activity';
    if (can('ad_usage')) return 'value';
    if (can('ad_usage_people') && myTeam) return 'coverage';
    return 'activity';
  }, [can, myTeam]);

  const [view, setView] = useState<ViewId>(homeView);

  /* ── The window ──────────────────────────────────────────────────────────── */

  const [periodId, setPeriodId] = useState<PeriodId>(() => DEFAULT_PERIOD[ceiling]);
  const period = useMemo(() => buildPeriod(periodId, null), [periodId]);

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
    const byView: Record<ViewId, GroupSpec[]> = {
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
      activity: activityGroups({
        data, period, scope, canSeeNames,
        onOpenRuns: id => navigate('workflow-library', id ?? ''),
        onOpenQueueItem: item => navigate(item.target.view, item.target.id ?? ''),
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
    `Viewing as ${VIEW_TITLE[view]}, ${VIEW_READER[view].toLowerCase()}`,
    PERSONA_SCOPE_LABEL[persona] + (persona === 'head_of_team' && myTeam ? `, ${myTeam}` : ''),
    `${period.label}, ${formatDate(period.from)} to ${formatDate(period.to)}`,
    dataAsOfLabel(),
  ].join(' · ');

  const pill = (active: boolean) =>
    `h-8 px-3 rounded-md text-[0.75rem] font-medium transition-colors ${
      active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:text-brand-700'
    }`;

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="px-6 lg:px-12 xl:px-[124px] pt-8 pb-16 max-w-[1180px]">
        <header className="border-b border-canvas-border pb-5">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink-900 leading-tight">Platform Usage</h1>
          <p className="mt-1 text-[1rem] text-ink-500">{VIEW_QUESTION[view]}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] text-ink-400">Viewing as</span>
              <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                {(['value', 'coverage', 'activity'] as ViewId[]).map(id => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    aria-pressed={view === id}
                    title={VIEW_READER[id]}
                    className={pill(view === id)}
                  >
                    {VIEW_TITLE[id]}
                  </button>
                ))}
              </div>
            </div>

            {/*
              * The scope control, offering only what this reader is entitled to.
              * One entitled scope is not a choice, so it renders as furniture
              * rather than as a control nobody can use.
              */}
            {scopes.length > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-[0.75rem] text-ink-400">Counting</span>
                <div className="inline-flex rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
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
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] text-ink-400">Window</span>
              <div className="inline-flex flex-wrap rounded-lg border border-canvas-border bg-canvas-elevated p-0.5">
                {periodOptions.filter(o => o.id !== 'custom').map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPeriodId(option.id)}
                    aria-pressed={periodId === option.id}
                    className={pill(periodId === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {canExport ? (
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={onExportCsv}>
                  CSV
                </Button>
                <Button variant="outline" size="sm" leftIcon={<FileText size={14} />} onClick={onExportPdf}>
                  PDF
                </Button>
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-500 tabular-nums">{headerLine}</p>
        </header>

        {/*
          * The contents. Twenty five blocks is more than anybody reads, so the
          * page says what it holds and lets a reader open the one they came for.
          */}
        <nav aria-label="What is on this page" className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
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

        <div className="mt-4">
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
    </div>
  );
}
