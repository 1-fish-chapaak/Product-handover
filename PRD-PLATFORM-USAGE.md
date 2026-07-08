# PRD: Platform Usage

Owner: Nilesh Anand · Surface: System > Platform Usage · Access: System Admin (`ad_usage`) · Status: Approved

## Problem

Admins can see who exists (Admin > Users) and what happened (Audit Log), but not who actually uses the platform, which modules earn their seats, or whether AI adoption is growing. Seat, renewal, and enablement decisions run on anecdote. The audit trail already records who did what and when; nobody has turned it into a picture.

## My thinking

- This is a read-only diagnostic surface, not a second admin panel. Acting on people (invites, status, roles) stays in Administration; every list here links there instead of duplicating those flows.
- A number without a baseline is noise. Every KPI, module, and member compares the selected window against the immediately preceding window of equal length, computed from the same series.
- The numbers are seeded demo data, but every derived figure must reconcile: a member's drawer equals their table row, a module's top members come from the same mix the member drawer shows, the heatmap sums to the window total, the dormant list agrees with the Last Active column.
- Averages hide the story. Members are segmented (Power, Core, Casual, Dormant) relative to the active mean, and the page states its own findings as Highlights instead of making the admin do the math.

## How it should work

The page answers three business questions in order: are we paying for seats nobody uses, is adoption broad or carried by a few people, and what should the admin do about it. Everything else supports those.

One page, one range control (7 / 30 / 90 days) that applies to everything below it.

| Metric | Definition | Comparison |
|---|---|---|
| Active users | Members with at least one action in the range | vs previous equal window |
| Actions | All logged events across modules | vs previous equal window |
| AI queries | Ask IRA and Concierge events | vs previous equal window |
| Reports | Reports generated in the range | vs previous equal window |

- Highlights: four derived findings, phrased as sentences: fastest-growing area, AI adoption rate, members without a recent sign-in, and activity concentration (share of activity from the top 3 members, the key-person and shallow-adoption signal).
- What to do next: up to three derived recommendations (pending invites, idle seats, shallow adoption, underused AI), each linking to where the action lives (Admin or Ask IRA). Never invents costs or data; when nothing qualifies it says so.
- Daily activity: actions per day with AI queries shown inside the total, with a legend. A Compare toggle overlays the previous period as a dashed line, aligned day-for-day. Statistical outlier days are marked on the chart, with a caption naming the biggest spike, how many times a typical day it ran, and which area drove it.
- Most-used areas: ranked share of activity; clicking an area opens its drill-down (trend, delta, share, top members).
- AI usage: questions asked, chats started, AI-assisted reports, share of members using AI, top three AI users.
- Members (seats): an adoption funnel (Seats, Signed in ever, Active this period, Used AI this period, each as a share of seats) over the lifecycle buckets: active this period, no sign-in for 30+ days, invited but not joined, suspended or inactive. Counts plus faces, no actions, one link to Administration.
- When people are active: a weekday-by-hour heatmap, single brand hue, darker means more, exact counts on hover.
- Member table: per-member actions, trend vs prior window, AI queries, top module. Segment chips (Heavy, Regular, Light, No activity, relative to the active mean; empty segments hidden) filter the list; clicking a row opens the member drawer (trend, module mix, session events, segment, link to Admin). "No activity" is scoped to the selected range and is deliberately distinct from the Members card's "No sign-in 30+ days" bucket.
- Teams lens: the same table aggregated by team; clicking a team opens its drawer with members ranked by activity.
- Export CSV: downloads exactly the filtered table including trend and segment, writes an audit event, gated by `ad_usage_export`.
- Live events: anything done in the current session folds into today's numbers immediately.

Non-goals: backend telemetry, billing, impersonation, or any people-management action inside this view.

## Appendix A: every calculation

All formulas live in `src/data/platform-usage.ts`. The demo series is deterministic (seeded PRNG keyed by email or day), so numbers survive reloads. Real events from the current session enter through the audit log and are counted one for one.

### The daily series (180 days, seeded)

| Value | Formula |
|---|---|
| Adoption ramp | 0.6 + 0.4 x (age of day / 180), so the oldest days run at 60% of current volume |
| Actions per day | weekday: (70 to 140) x ramp; weekend: (14 to 28) x ramp |
| Active users per day | weekday: 4 to 8; weekend: 1 to 3 |
| AI queries per day | actions x (24% to 36%) |
| Reports per day | actions x (5% to 10%) |
| Module split | weights: Ask IRA .24, Engagements .16, Reports .14, Workflows .13, Dashboards .10, Knowledge Hub .09, Risk & Controls .09, Admin .05, each with +/-25% jitter; remainder goes to the last module so the split sums exactly to the day's actions |
| Live fold-in | audit-log events stamped today are added to today's bucket: actions +1 each, module bucket by `usageModuleFor`, AI queries +1 for Ask IRA events, reports +1 for Reports events, active users = max(seed, distinct real users today) |

### Windows and deltas

| Value | Formula |
|---|---|
| Current window | last N days of the series (N = 7, 30, or 90) |
| Prior window | the N days immediately before the current window |
| Delta % | round((current - prior) / prior x 100); no chip when prior = 0 |
| Active users (KPI) | count of members whose status is not Invited and whose last login falls inside the window (`lastLoginOffsetDays` <= window end). The same predicate drives the table and the seats card, so the three can never disagree |
| Last login parsing | "Today" = 0 days, "Yesterday" = 1, "Mon D" = real date diff, "Never" = infinity |

### Per member

| Value | Formula |
|---|---|
| Usage share | (0.3 + rand(email) x 0.7) x status damp, where damp is 1 for Active, 0.25 for Suspended/Locked/Inactive, 0 for Invited |
| Actions in window | active in window: round(window actions x share / sum of all shares), plus live events one for one; otherwise 0 |
| AI queries | round(actions x AI ratio), ratio = 15% to 45% per member, plus live Ask IRA events |
| Trend column | delta % of the member's actions vs their prior-window actions (prior computed without live events); em dash when the prior window is 0 |
| Segment | vs the mean actions of members with any activity: Power >= 1.4x mean, Casual < 0.6x mean, Core in between, No activity = 0 actions |
| Drawer daily series | each day weighted by (day actions x per-member jitter 0.6 to 1.4), normalized with largest-remainder rounding so the sparkline sums exactly to the member's action count |
| Drawer module mix | per-module weights 0.2 to 1.0, the member's top module forced to 1.3x the max weight, scaled to their total; drawer shows the top 4 |

### Aggregates

| Value | Formula |
|---|---|
| Module drill-down | total = sum of that module's daily buckets; delta vs prior window; share = total / window actions; top members = each member's full module mix count for that module, top 3 |
| Team row | members grouped by team; actions and AI queries summed; top module = members' top modules weighted by their action counts; last active = the freshest member's last login |
| Seats buckets | total = all users; active in range (window predicate); dormant = Active status with no login for more than 30 days; invited = Invited status; suspended or inactive = Suspended, Locked, or Inactive |
| Chats started | round(AI queries x 0.42) |
| AI-assisted reports | round(reports x 0.6) |
| AI adoption | round(active members with at least one AI query / active members x 100) |
| Rhythm heatmap | each day's actions distributed over 24 hours by a working-hours curve (morning and afternoon peaks, lunch dip, quiet nights) with per-day jitter, largest-remainder rounding so the grid sums exactly to the window total, accumulated by weekday |
| Highlights | fastest-growing module = highest module delta with at least 10 actions; busiest day = largest heatmap row sum; peak hour = largest column sum; the AI and dormant sentences reuse the numbers above |
| Seat utilization | active members this period / total seats x 100 |
| Adoption funnel | Seats = all users; Signed in ever = last login is not "Never"; Active this period = window predicate; Used AI = active with at least one AI query. Each stage rendered as a share of seats |
| Compare overlay | previous window's daily actions aligned position-for-position under the current window (day 1 vs day 1) |
| Spike detection | days with actions above mean + 2 standard deviations of the window; ratio = day / mean, driver = the day's largest module bucket |
| Concentration | sum of the top 3 members' actions / all members' actions x 100; null when nobody did anything |
| Next steps | shown when: pending invites > 0; no-sign-in-30d members > 0; concentration >= 60%; AI adoption < 50% with at least one active member. Top 3 by that order |

## Appendix B: cold start, from a new user's first day

What a brand-new member accrues, and when each number becomes meaningful:

| Moment | What Platform Usage shows |
|---|---|
| Invited (day 0) | Counted in Seats > "Invited, pending" only. Excluded from Active users, segment "No activity", zero everywhere, Last Active reads "Never". |
| First sign-in | The member enters the Active users predicate the moment their last login lands in the window. Their actions start at 0 and grow one for one with real logged events from that session. |
| First week | Actions, AI queries, top module, and drawer detail are all live-event driven. Trend shows an em dash: there is no prior window to compare against yet. |
| Day 8+ | A 7-day prior window exists, so the 7-day Trend and delta chips become meaningful for them. |
| Day 60+ / 180+ | The 30-day comparison has a full prior window at day 60; the 90-day comparison at day 180. Before that, missing baselines render as no chip, never as a fake 0%. |
| Goes quiet 30+ days | Moves to Seats > "Dormant 30d+" (still Active status) and drops out of shorter windows' Active users and table counts. |

Same logic for a brand-new workspace: every card renders at zero (charts empty, delta chips hidden, segments collapse to "No activity", Highlights fall back to their neutral sentences) and fills in as real events accrue. In this prototype the seeded 180-day history stands in for that accrued past so the page demonstrates its mature state; the live fold-in is the real mechanism, and audit-log events only persist for the browser session (no backend).

## Verify against plan

- [ ] Delta chips render on every range and compare equal prior windows
- [ ] Highlights derive from the same aggregates the cards show
- [ ] Module drill-down numbers agree with the breakdown row and the member drawers
- [ ] Member drawer numbers equal the table row that opened it
- [ ] Segment chips partition the member list and filter it
- [ ] Heatmap totals equal the range's action total
- [ ] Teams lens aggregates correctly; team drawer members sum to the team row
- [ ] Export downloads the filtered set (with trend and segment) and writes an audit event
- [ ] A live session event raises today's totals
- [ ] Only roles holding `ad_usage` see the view; `ad_usage_export` gates the export
