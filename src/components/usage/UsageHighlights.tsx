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
 * All four click through to the evidence, because a finding you cannot verify is
 * an assertion. That is also why they are `Tile`s and not `Card`s (usageChrome):
 * on this page the lift and the brand border mean "this goes somewhere".
 *
 * Warnings wear the attention tone on the icon chip only — the amber wash that
 * DESIGN.md rules out for alert cards would make four findings read as four
 * alarms, and two of them are usually good news.
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

function Highlight({ icon: Icon, attention, onClick, ariaLabel, index, children }: {
  icon: LucideIcon;
  attention?: boolean;
  onClick: () => void;
  ariaLabel: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <Tile onClick={onClick} index={index} ariaLabel={ariaLabel} className="p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          attention ? 'bg-mitigated-700/[0.12] text-mitigated-700' : 'bg-brand-50 text-brand-600'
        }`}>
          <Icon size={15} strokeWidth={1.75} />
        </div>
        <p className="text-[0.8125rem] text-ink-600 leading-snug">{children}</p>
      </div>
    </Tile>
  );
}

const B = ({ children }: { children: ReactNode }) => (
  <span className="font-semibold text-ink-900">{children}</span>
);

export default function UsageHighlights({ h, onOpenModule, onSeeAi, onSeeQuiet, onSeeTop }: {
  h: HighlightsInput;
  onOpenModule: (m: UsageModule) => void;
  onSeeAi: () => void;
  onSeeQuiet: () => void;
  onSeeTop: () => void;
}) {
  const concentrated = typeof h.concentration === 'number' && h.concentration >= CONCENTRATION_LIMIT;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Highlight
        icon={Zap}
        index={0}
        ariaLabel={h.growing ? `Fastest growing area: ${h.growing.module}` : 'Areas by growth'}
        onClick={() => h.growing ? onOpenModule(h.growing.module) : onSeeTop()}
      >
        {h.growing ? (
          <><B>{h.growing.module}</B> is growing fastest, up <B>{h.growing.deltaPct}%</B> on the period before.</>
        ) : (
          <>No area grew on the period before.</>
        )}
      </Highlight>

      <Highlight
        icon={Sparkles}
        index={1}
        ariaLabel="AI adoption"
        onClick={onSeeAi}
      >
        {/* 0% adoption with AI actions on the board means "we cannot attribute
            them to a current member", not "nobody uses AI". Say the true one. */}
        {h.aiAdoptionPct > 0 ? (
          <><B>{h.aiAdoptionPct}%</B> of active members used AI in this period.</>
        ) : h.aiActivity > 0 ? (
          <><B>{fmt(h.aiActivity)}</B> AI {h.aiActivity === 1 ? 'action' : 'actions'} this period, none attributed to a current member.</>
        ) : (
          <>No AI activity in this period.</>
        )}
      </Highlight>

      <Highlight
        icon={UserMinus}
        index={2}
        attention={h.dormant > 0}
        ariaLabel="Members with no recent sign-in"
        onClick={onSeeQuiet}
      >
        {h.dormant > 0 ? (
          <><B>{h.dormant} member{h.dormant !== 1 ? 's' : ''}</B> {h.dormant !== 1 ? "haven't" : "hasn't"} signed in for 30+ days.</>
        ) : (
          <>Everyone has signed in within the last 30 days.</>
        )}
      </Highlight>

      <Highlight
        icon={Users}
        index={3}
        attention={concentrated}
        ariaLabel="Share of activity driven by the top 3 members"
        onClick={onSeeTop}
      >
        {typeof h.concentration === 'number' ? (
          <>
            Top 3 members drive <B>{h.concentration}%</B> of all activity
            {concentrated ? ', so adoption is shallow beyond them' : ''}.
            {h.topNames.length > 0 && (
              <span className="block mt-1 text-[0.75rem] text-ink-400 truncate">{h.topNames.join(', ')}</span>
            )}
          </>
        ) : (
          <>Nobody did anything in this period.</>
        )}
      </Highlight>
    </div>
  );
}
