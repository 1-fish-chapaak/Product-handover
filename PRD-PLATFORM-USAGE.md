# PRD: Platform Usage

Owner: Nilesh Anand · Surface: System > Platform Usage · Access: System Admin (`ad_usage`, export gated by `ad_usage_export`) · Status: Built

## Problem

Admins cannot see how the platform is being used.

They have two places to look and neither one helps. Admin > Users shows who has an account, which says nothing about whether they ever open the product. The Audit Log shows what happened, one row at a time; it is built for "who changed that control on the 14th", and nobody scrolls a log to work out whether a rollout is landing.

So the person who set up the workspace and invited the team cannot answer the one thing they get asked: is anyone actually using this? The records to answer it already exist. Every action writes an event, every report is stored, every chat is saved. We have never read any of it back to them.

## My thinking

- This is a read-only diagnostic surface, not a second admin panel. Acting on people (invites, status, roles) stays in Administration; every list here links there instead of duplicating those flows. Two surfaces that both act on people will drift, and then admins trust neither.
- A number without a baseline is noise. Fifty downloads means nothing until you know last month was twelve. Every KPI, module and member compares the selected window against the immediately preceding window of equal length. When there is no prior window, we show no comparison at all: an invented baseline is worse than a missing one, because people act on it.
- No synthetic history. Every number traces back to a record the platform actually stores: the audit log, the report registries, the saved chats, the member records. If a figure cannot be derived from those, it does not go on the page.
- Counts of things come from the register that owns them, never from a second copy kept here. If the Control Library says 14 controls, this page says 14. When it kept its own idea of each register it claimed 25 controls against a library of 14, and 29 sources against a hub of 20. Two numbers for one fact means one of them is lying, and the admin has no way to tell which.
- Time runs backwards from the newest record, not from today. Without a backend the stored history sits in the past, so a wall-clock "last 30 days" would come back empty and every tile would read zero. That says the platform is dead when it actually says nobody signed in this month. The page anchors to the newest real record and labels itself "Data as of" that date. The anchor never moves: if it advanced on every click, the window would slide with it and empty itself.
- An unrecognised module name lands in `Other`, not in a real bucket. Defaulting the unknown into Risk & Controls made it absorb exception triage, audit planning, the Process Hub and every Concierge tool run, so it read as the busiest area on the platform. That was the default talking, not the workspace. A surface that forgets to register itself should show up as visible unattributed activity, not quietly inflate a neighbour.
- Every derived figure must reconcile: a member's modal equals their table row, a module's top members come from the same mix the member modal shows, the dormant list agrees with the Last Active column. Where a source genuinely cannot support a number (see the gaps in Appendix A), the page says so rather than estimating.
- Averages hide the story. Members are segmented relative to the mean of the people who were actually active, because averaging across everybody drags the bar down and flatters light users. The page states its own findings instead of making the admin do the arithmetic. Concentration is the one an admin will not spot alone: if three people do 70% of everything the total still looks healthy, but the workspace is leaning on three people rather than a team.

## How it should work

Five tabs, one question each, in the order the reader asks them: is anyone using this (Overview), are we paying for seats nobody uses (Seats), who is doing the work (People), which parts of the product get used (Areas), what did we get out of it (Output).

The reader is an audit lead, not an analyst, and the vocabulary follows: no "shelfware", no "power users", no "adoption funnel". Every label says what the thing means in the words someone would use out loud. A tab may not need another tab to finish its own argument, which is why Seats and People are separate: the licence arithmetic and the names behind it are two questions, and stacking them made a page inside a page.

One range control (7 / 30 / 90 days) sits above the tabs and applies to everything below it.

| Metric | Definition | Comparison |
|---|---|---|
| Active users | Known members with at least one logged action in the range | vs previous equal window |
| Actions | All logged events across modules | vs previous equal window |
| AI activity | Questions asked plus Concierge tool runs plus conversations started | vs previous equal window |
| Reports | Reports and ATRs generated in the range | vs previous equal window |

- Highlights: four derived findings, phrased as sentences: fastest-growing area, AI adoption rate, members without a recent sign-in, and activity concentration (share of activity from the top 3 members, the key-person and shallow-adoption signal).
- What to do next: up to three derived recommendations (pending invites, idle seats, shallow adoption, underused AI), each linking to where the action lives (Admin or Ask IRA). Never invents costs or data; when nothing qualifies it says so.
- Daily activity: actions per day with AI queries shown inside the total, with a legend. A Compare toggle overlays the previous period as a dashed line, aligned day-for-day. Statistical outlier days are marked on the chart, with a caption naming the biggest spike, how many times a typical day it ran, and which area drove it.
- Most-used areas: ranked share of activity across the thirteen areas (Ask IRA, AI Concierge, Reports, Engagements, Exceptions, Audit Planning, Process Hub, Risk & Controls, Workflows, Dashboards, Knowledge Hub, Admin, Other). Clicking an area opens its drill-down (trend, delta, share, top members). An area nobody touched does not appear. `Other` appears only when something logged itself under a name we do not recognise, which is the signal that a surface needs registering.
- Section deep-dives: one tile per surface, opening the full picture for that surface. Each reads the register the surface itself renders, so the counts match what the admin sees on that screen.
- AI usage: questions asked, Concierge tool runs, conversations started, share of active members using AI, top three AI users.
- What got created: workflows, dashboards, RACMs, engagements and reports built in the period, each against the prior window, plus a feed of the most recent ones.
- Workflow runs: executions split across the Workflow Library, Engagements and the AI tools, with a recent-runs feed.
- Sharing: share events split by what was shared (reports, dashboards, RACMs, workflows), with a recent-shares feed.
- Members (seats): an adoption funnel (Seats, Signed in ever, Active this period, Used AI this period, each as a share of seats) over the lifecycle buckets: active this period, no sign-in for 30+ days, invited but not joined, suspended or inactive. Counts plus faces, no actions, one link to Administration.
- When people are active: a weekday-by-hour heatmap, single brand hue, darker means more, exact counts on hover.
- Member table: per-member actions, trend vs prior window, AI queries, top module. Segment chips (Heavy, Regular, Light, No activity, relative to the active mean; empty segments hidden) filter the list; clicking a row opens the member modal (trend, module mix, session events, segment, link to Admin). "No activity" is scoped to the selected range and is deliberately distinct from the Members card's "No sign-in 30+ days" bucket.
- Teams lens: the same table aggregated by team; clicking a team opens its modal with members ranked by activity.
- Exports and downloads: total files pulled out of the platform with a prior-period comparison, the real format mix across those exports, a recent-downloads feed (who downloaded what, when; real session exports appear on top immediately), and top downloaders. The member table and modal carry a per-member Downloads count.
- Export CSV: downloads exactly the filtered table including trend, downloads, and segment, writes an audit event, gated by `ad_usage_export`.
- Live events: anything done in the current session folds into today's numbers immediately.

Non-goals: backend telemetry, billing, impersonation, or any people-management action inside this view.

## Why this is not the Audit Log

| | Audit Log | Platform Usage |
|---|---|---|
| The question | What exactly happened? | Is anyone using this? |
| The answer | One row per event | Counts, trends, comparisons |
| When you open it | Something went wrong | Nothing is wrong, but you have to decide something |
| Why it exists | Evidence | Adoption |
| Must it be complete? | Yes. A trail with holes is not a trail | No. It reports what it can see and says what it cannot |
| What it reads | The event stream | The event stream, plus reports, chats, seats and every register |

Six reasons both stay:

1. **The log cannot show absence.** Someone invited who never showed up writes zero rows. They do not exist in a log. They are the first thing an admin needs to see.
2. **The log cannot show a pattern.** "Three people do 70% of the work" is in no single row. It only exists once you count across all of them, which a log never does.
3. **Usage reads what the log does not have.** Seats, invites, last sign-in, the report registries, saved chats, and every register in the product. Half this page cannot be built from the event stream alone.
4. **Usage cannot be evidence.** It aggregates, drops records with no clock time, and excludes the `Unknown` actor from a failed sign-in. Correct for a chart. Disqualifying for a trail.
5. **Usage is derived from the log.** Delete the log and Usage dies with it; the reverse is not true. The log can therefore never be the one that goes, and the two are not interchangeable in either direction.
6. **Keeping it costs one page.** No separate tracking, no second pipeline, no extra storage. Cutting it means the platform goes back to recording everything and telling nobody.

The one real overlap is the recent-activity feeds (latest downloads, creations, shares). They show the newest few, filtered to one action, as context for the number above them: no filters, no paging, not evidence. If they ever grow filters and paging they have become a second audit log, and that is the line to hold.

## Appendix A: every calculation

All formulas live in `src/data/platform-usage.ts`; the page-level findings live in `PlatformUsageView.tsx`; the per-surface deep-dives read their registers through `section-portfolios.ts`. Every number is counted off records the platform already stores, so the page is exactly as rich as the platform's own history.

### The sources

| Shown as | Counted from |
|---|---|
| Actions, active users, downloads, module breakdown, created / run / shared | The audit log (`AuditLog[]`), one event = one action |
| Reports | `GENERATED_REPORTS` + `ATR_LIBRARY`, by `generatedAt` day |
| Conversations and messages | `CHAT_HISTORY`, by `timestamp` day |
| Seats and lifecycle buckets | Member records (`status`, `lastLogin`) |
| Per-surface counts (controls, risks, sources, dashboards, engagements, exceptions) | The register each surface itself renders: `CONTROL_LIBRARY`, `SEED_RISKS`, the Knowledge Hub catalog, `MY_DASHBOARDS` + `SHARED_DASHBOARDS`, `ENGAGEMENTS`, `ENGAGEMENT_EXCEPTIONS`. Never a copy held here |

Dates arrive in three shapes and are all normalised to a midnight UTC day key: `2026-04-19 10:30:50` (audit), `Mar 20, 2026` or `Mar 22, 2026, 16:40` (reports), `Mar 20, 2026` (chats). Only audit timestamps carry a clock hour.

### The anchor

Without a backend the newest stored record sits in the past (currently April 2026), so measuring "last 30 days" against wall-clock time would render every tile as zero.

| Value | Rule |
|---|---|
| Anchor (day offset 0) | The newest record that predates today, across audit logs, both report registries and chat history. Falls back to today when there are no records |
| Series | 180 days ending at the anchor. Twice the longest visible range (90), so every window has a full equal-length prior window |
| Live fold-in | Events stamped today (this session's work) collapse into the anchor bucket and are counted one for one. The anchor itself never moves; if it did, one click would slide the window and empty it |
| Page label | "Data as of <anchor>", so the window is never mistaken for wall-clock time |

### Per day

| Value | Formula |
|---|---|
| Actions | Count of audit events that day |
| Module bucket | `usageModuleFor(log.module)` maps each event onto one of thirteen areas. The lookup is lowercased, because the same surface logs itself under several spellings ("Reports" and "reports") and a case-sensitive match sent half of them to the default. Every Concierge tool logs under its own name and maps to AI Concierge. Anything unrecognised lands in `Other`, so a surface that forgets to register shows as visible unattributed activity instead of inflating a real bucket |
| Active users | Distinct actors in that day's events |
| Downloads | Events with action `Export` |
| Reports | Report registry records stamped that day |
| Conversations / messages | `CHAT_HISTORY` records stamped that day, and their message counts |
| AI events | Events in the Ask IRA bucket with action `Run` (a Concierge tool run) or action `Create` + entity `Query` (a question sent). Deliberately not every `Create` in the bucket: a tool logs both a `Run` and a `Create` for the artifact it produces, so counting all Creates would double-count one action and read a RACM generation as a question |

### Windows and deltas

| Value | Formula |
|---|---|
| Current window | The last N days of the series (N = 7, 30 or 90) |
| Prior window | The N days immediately before it |
| Delta % | round((current - prior) / prior x 100). No chip at all when prior = 0, never a fake 0% |
| Active users (KPI) | Distinct *known* members with at least one event in the window. Excludes the `Unknown` actor a failed login writes, so a bad password never inflates adoption |
| AI activity (KPI) | AI events + conversations started. The two are disjoint: the saved chats predate event logging |
| KPI trend bars | The daily series bucketed into 12 sums when the range is longer than 12 days |
| Compare overlay | The prior window's daily actions aligned position-for-position (day 1 vs day 1) |
| Last login parsing | "Today" = 0 days, "Yesterday" = 1, "Mon D" = real date diff (rolled back a year if it would land in the future), "Never" = infinity |

### Per member

Counted by matching `AuditLog.user` to the member's name, over the window's events.

| Value | Formula |
|---|---|
| Actions | The member's events in the window |
| AI queries | Their AI events (same `Run` / `Create`+`Query` rule as above) |
| Downloads | Their `Export` events |
| Top module | The module they touched most; ties resolve to the first in module order |
| Trend column | Delta % vs their own prior-window actions; no chip when that is 0 |
| Segment | Against the mean actions of members with any activity: Heavy >= 1.5x mean, Light < 0.5x mean, Regular in between, No activity = 0 actions in the window |
| Modal daily series | Their real events grouped by day. No smoothing, so it sums to their action count by construction |
| Modal module mix | Their real per-module counts, non-zero only, ranked; the modal shows the top 4 |

### Aggregates

| Value | Formula |
|---|---|
| Module drill-down | Total = sum of that module's daily buckets; delta vs prior window; share = total / window actions; top 3 members by their count in that module |
| Team row | Members grouped by team (no team = Unassigned); actions and AI queries summed from the member rows |
| Seats buckets | Total = all users; active in range = not Invited and last login within the range; dormant = Active status with no login for 30+ days; invited = Invited status; suspended or inactive = Suspended, Locked or Inactive |
| Adoption funnel | Seats = all users; Signed in ever = last login is not "Never"; Active this period = the seats bucket above; Used AI this period = members with actions > 0 and at least one AI query. Each stage as a share of seats |
| AI adoption | round(active members with at least one AI query / active members x 100) |
| What got created | `Create` events by entity: Workflows (`Workflow`), Dashboards (`Dashboard`), RACMs (`RACM`, `RACM Mapping`), Engagements (`Engagement`). Reports come from the registries instead, so this card and the Reports KPI always agree |
| Workflow runs | `Run` events, split by area: AI tools (Ask IRA), Workflow Library (Workflows), Engagements (everything else) |
| Sharing | `Share` events, split by entity into Reports, Dashboards, RACMs, Workflows, Other |
| Downloads | `Export` events. Format and artifact name are parsed out of the log description ("Exported X as PDF"); an unparseable description falls back to the entity name and CSV |
| Format split | The real mix of parsed formats across the window's Export events, ranked. Not a fixed ratio |
| Recent feeds | The window's real Create / Run / Share / Export events, newest first (by day offset, then hour). Events from this session are flagged live and sort to the top |
| Concentration | Top 3 members' actions / all members' actions x 100; null when nobody did anything |
| Spike detection | Days with actions above mean + 2 standard deviations of the window (needs at least 3 active days). Ratio = day / mean; driver = that day's largest module bucket |
| Rhythm heatmap | Real weekday x hour grid, placed by the event's own clock hour. Weekday comes from the anchor date minus the day offset (UTC) |
| Highlights | Fastest-growing module = highest delta among modules with at least 10 actions; busiest weekday = largest heatmap row sum; peak hour = largest column sum |
| Worth checking | Shown when: pending invites > 0; no-sign-in-30d members > 0; concentration >= 60%; AI adoption < 50% with at least one active member. Top 3, in that order. Never invents a cost; when nothing qualifies it says so |

### Where the sources cannot support a number

These gaps are real and visible in the product rather than papered over with an estimate.

| Gap | Consequence |
|---|---|
| Ask IRA and the Concierge tools only recently began writing audit events | `UserUsageRow.aiQueries` counts logged AI events only, so per-member AI attribution reads 0 for any usage that predates logging. Platform-wide AI volume comes from `CHAT_HISTORY`, which carries no per-user attribution |
| Report and chat records carry a date but no clock time | They cannot be placed on the weekday x hour grid. The heatmap total is therefore less than or equal to the window's action total, and untimed events are reported separately instead of being smeared across the grid |
| No backend | Audit events survive the browser session only |

## Appendix B: cold start, from a new user's first day

What a brand-new member accrues, and when each number becomes meaningful:

| Moment | What Platform Usage shows |
|---|---|
| Invited (day 0) | Counted in Seats > "Invited, not joined yet" only. Excluded from Active users, segment "No activity", zero everywhere, Last Active reads "Never". |
| First sign-in | Signing in moves them into the Seats card's "Active this period" bucket, which reads last login. It does not move the Active users KPI: that counts people who actually did something, so it only picks them up on their first logged action. |
| First week | Actions, AI queries, top module and modal detail all come from their real events. Trend shows no chip: there is no prior window to compare against yet. |
| Day 8+ | A 7-day prior window exists, so the 7-day Trend and delta chips become meaningful for them. |
| Day 60+ / 180+ | The 30-day comparison has a full prior window at day 60; the 90-day comparison at day 180. Before that, missing baselines render as no chip, never as a fake 0%. |
| Goes quiet 30+ days | Moves to Seats > "No sign-in 30+ days" (still Active status) and drops out of shorter windows' Active users and table counts. |

Same logic for a brand-new workspace: every card renders at zero (charts empty, delta chips hidden, segments collapse to "No activity", Highlights fall back to their neutral sentences) and fills in as real events accrue. The page reaches its mature state only because the shipped records already carry a history to count. Audit events persist for the browser session only (no backend).

## Verify against plan

- [ ] Every figure traces to an audit event, a report record, a chat record, a member record or a register. Nothing is estimated
- [ ] Each per-surface count equals the register that surface renders. 14 controls in the Control Library means 14 here. **No test asserts this yet: it is the gap most likely to regress, and it is how the 25-against-14 error got in**
- [ ] An event logged under an unrecognised module name appears in `Other`, and does not raise Risk & Controls or any other real bucket
- [ ] A module string in the wrong case ("reports" vs "Reports") lands in the same bucket
- [ ] No delta chip renders when the prior window is 0. Never a fake 0%
- [ ] The `Unknown` actor from a failed sign-in never counts toward Active users
- [ ] Member modal numbers equal the table row that opened it
- [ ] A module drill-down's top members equal those members' counts for that module in the member table
- [ ] Heatmap total plus its untimed count equals the range's action total
- [ ] "What got created" reports equal the Reports KPI (both read the registries)
- [ ] A member with 0 actions in the range is segmented "No activity", and is not the same set as the Members card's "No sign-in 30+ days"
- [ ] Team modal members sum to the team row
- [ ] Export downloads the filtered set (with trend and segment) and writes an audit event
- [ ] A live session event raises the anchor day's totals, and the anchor date itself does not change
- [ ] Only roles holding `ad_usage` see the view; `ad_usage_export` gates the export
