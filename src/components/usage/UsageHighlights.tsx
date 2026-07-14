/**
 * Platform Usage — what stands out.
 *
 * Four findings, on the tab an admin actually opens on. Each one is a sentence
 * derived from aggregates that are already on the page somewhere; none of them
 * is new data. They exist because a number an admin has to assemble themselves
 * is a number they will not assemble:
 *
 *   · Which area is growing        — needs a per-module delta, ranked. The Top
 *                                    areas card ranks by volume, not by change,
 *                                    so the fastest riser can sit fourth.
 *   · How many people use AI       — the KPI band gives AI's share of ACTIONS.
 *                                    That is a different question from how many
 *                                    PEOPLE touched it, and the two move apart.
 *   · Who has gone quiet           — the verdict strip counts idle seats; this
 *                                    names the 30-day drop-off specifically.
 *   · What share the top 3 drive   — this is the one an admin cannot reach on
 *                                    their own from anything else on the page.
 *                                    "3 people do 70% of everything" is exactly
 *                                    the failure a healthy-looking total hides,
 *                                    and no total, chart or table on this page
 *                                    surfaces it. Losing this card lost the
 *                                    finding.
 *
 * Each tile is now a FIGURE with a sentence under it, not a paragraph with a
 * number bolded somewhere inside it. Four ragged blocks of prose, each a
 * different number of lines, is a row you have to read left to right to get
 * anything from; four figures on one baseline is a row you can scan. The number
 * is the finding — the sentence only says what it is about.
 *
 * All four click through to the evidence, because a finding you cannot verify is
 * an assertion. That is also why they are `Tile`s and not `Card`s (usageChrome):
 * on this page the lift and the brand border mean "this goes somewhere".
 *
 * Warnings wear the attention tone on the icon chip and the figure only — the
 * amber wash that DESIGN.md rules out for alert cards would make four findings
 * read as four alarms, and two of them are usually good news.
 */

import type { ReactNode } from 'react';
import { Zap, Sparkles, UserMinus, Users, type LucideIcon } from 'lucide-react';
import { Tile } from './usageChrome';
import { fmt } from './usageTokens';
import type { UsageModule } from '../../data/platform-usage';

/** Above this, activity is concentrated enough to be a finding rather than a fact. */
export const CONCENTRATION_LIMIT = 60;

export interface HighlightsInput {
  /** The area with the biggest rise vs the previous window, if any rose. */
  growing: { module: UsageModule; deltaPct: number } | null;
  /** Share of active members who used AI at all (0–100). */
  aiAdoptionPct: number;
  /** AI actions in the window — lets 0% adoption say "unattributed", not "unused". */
  aiActivity: number;
  /** Members with no sign-in for 30+ days. */
  dormant: number;
  /** Share of all activity the top 3 members account for. Null when nobody did anything. */
  concentration: number | null;
  /** The three names behind that share, busiest first. */
  topNames: string[];
}

function Highlight({ icon: Icon, eyebrow, figure, attention, onClick, ariaLabel, index, children }: {
  icon: LucideIcon;
  /** What the number is. Four words at most — it is a column header, not a claim. */
  eyebrow: string;
  /** The finding itself. A dash when there is no number to show. */
  figure: ReactNode;
  attention?: boolean;
  onClick: () => void;
  ariaLabel: string;
  index: number;
  /** The sentence under the figure: what the number is about. */
  children: ReactNode;
}) {
  return (
    <Tile onClick={onClick} index={index} ariaLabel={ariaLabel} className="p-4 h-full">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            attention ? 'bg-mitigated-700/[0.12] text-mitigated-700' : 'bg-brand-50 text-brand-600'
          }`}>
            <Icon size={14} strokeWidth={1.75} />
          </div>
          <span className="text-[0.625rem] font-semibold uppercase tracking-wide text-ink-400 truncate">
            {eyebrow}
          </span>
        </div>

        <div className={`mt-3 text-[1.5rem] font-semibold leading-none tracking-[-0.025em] ${
          attention ? 'text-mitigated-700' : 'text-ink-900'
        }`}>
          {figure}
        </div>

        <p className="mt-2 text-[0.75rem] text-ink-500 leading-snug">{children}</p>
      </div>
    </Tile>
  );
}

export default function UsageHighlights({ h, onOpenModule, onSeeAi, onSeeQuiet, onSeeTop }: {
  h: HighlightsInput;
  onOpenModule: (m: UsageModule) => void;
  onSeeAi: () => void;
  onSeeQuiet: () => void;
  onSeeTop: () => void;
}) {
  const concentrated = typeof h.concentration === 'number' && h.concentration >= CONCENTRATION_LIMIT;

  return (
    // `items-stretch` is the whole point of the row: the four tiles hold
    // sentences of different lengths, and four cards of four different heights
    // is what made this read as a pile rather than a band.
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
      <Highlight
        icon={Zap}
        index={0}
        eyebrow="Fastest growing"
        figure={h.growing ? `+${h.growing.deltaPct}%` : '—'}
        ariaLabel={h.growing ? `Fastest growing area: ${h.growing.module}` : 'Areas by growth'}
        onClick={() => h.growing ? onOpenModule(h.growing.module) : onSeeTop()}
      >
        {h.growing ? (
          <><span className="font-semibold text-ink-700">{h.growing.module}</span>, on the period before.</>
        ) : (
          <>No area grew on the period before.</>
        )}
      </Highlight>

      <Highlight
        icon={Sparkles}
        index={1}
        eyebrow="AI adoption"
        // 0% adoption with AI actions on the board means "we cannot attribute
        // them to a current member", not "nobody uses AI". Show the true one.
        figure={h.aiAdoptionPct > 0 ? `${h.aiAdoptionPct}%` : h.aiActivity > 0 ? fmt(h.aiActivity) : '0'}
        ariaLabel="AI adoption"
        onClick={onSeeAi}
      >
        {h.aiAdoptionPct > 0 ? (
          <>of active members used AI in this period.</>
        ) : h.aiActivity > 0 ? (
          <>AI {h.aiActivity === 1 ? 'action' : 'actions'} this period, none attributed to a current member.</>
        ) : (
          <>No AI activity in this period.</>
        )}
      </Highlight>

      <Highlight
        icon={UserMinus}
        index={2}
        eyebrow="Gone quiet"
        figure={h.dormant}
        attention={h.dormant > 0}
        ariaLabel="Members with no recent sign-in"
        onClick={onSeeQuiet}
      >
        {h.dormant > 0 ? (
          <>{h.dormant === 1 ? 'member has' : 'members have'} not signed in for 30+ days.</>
        ) : (
          <>Everyone has signed in within the last 30 days.</>
        )}
      </Highlight>

      <Highlight
        icon={Users}
        index={3}
        eyebrow="Top 3 share"
        figure={typeof h.concentration === 'number' ? `${h.concentration}%` : '—'}
        attention={concentrated}
        ariaLabel="Share of activity driven by the top 3 members"
        onClick={onSeeTop}
      >
        {typeof h.concentration === 'number' ? (
          <>
            of all activity{concentrated ? ', so adoption is shallow beyond them' : ''}.
            {h.topNames.length > 0 && (
              <span className="block mt-0.5 text-ink-400 truncate">{h.topNames.join(', ')}</span>
            )}
          </>
        ) : (
          <>Nobody did anything in this period.</>
        )}
      </Highlight>
    </div>
  );
}
