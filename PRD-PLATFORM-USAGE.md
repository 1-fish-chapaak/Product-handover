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

One page, one range control (7 / 30 / 90 days) that applies to everything below it.

| Metric | Definition | Comparison |
|---|---|---|
| Active users | Members with at least one action in the range | vs previous equal window |
| Actions | All logged events across modules | vs previous equal window |
| AI queries | Ask IRA and Concierge events | vs previous equal window |
| Reports | Reports generated in the range | vs previous equal window |

- Highlights: four derived findings, phrased as sentences: fastest-growing module, AI adoption rate, dormant members, busiest day and peak hour.
- Usage over time: actions per day with AI queries shown inside the total.
- Module breakdown: ranked share of activity; clicking a module opens its drill-down (trend, delta, share, top members).
- AI usage: queries, chats started, AI-assisted reports, adoption rate, top three AI users.
- Seats and lifecycle: total seats, active in range, dormant 30 days or more, invited and pending, suspended or inactive. Counts plus faces, no actions, one link to Administration.
- Activity rhythm: a weekday-by-hour heatmap of when work happens, single brand hue, exact counts on hover.
- Member table: per-member actions, trend vs prior window, AI queries, top module. Segment chips (Power, Core, Casual, No activity, relative to the active mean; empty segments hidden) filter the list; clicking a row opens the member drawer (trend, module mix, session events, segment, link to Admin). "No activity" is scoped to the selected range and is deliberately distinct from the seats card's "Dormant 30d+" (no login) bucket.
- Teams lens: the same table aggregated by team; clicking a team opens its drawer with members ranked by activity.
- Export CSV: downloads exactly the filtered table including trend and segment, writes an audit event, gated by `ad_usage_export`.
- Live events: anything done in the current session folds into today's numbers immediately.

Non-goals: backend telemetry, billing, impersonation, or any people-management action inside this view.

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
