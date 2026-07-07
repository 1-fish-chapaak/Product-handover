# PRD: Platform Usage

Owner: Nilesh Anand · Surface: System > Platform Usage · Access: System Admin (`ad_usage`) · Status: Approved

## Problem

Admins can see who exists (Admin > Users) and what happened (Audit Log), but not who actually uses the platform, which modules earn their seats, or whether AI adoption is growing. Seat, renewal, and enablement decisions run on anecdote. The audit trail already records who did what and when; nobody has turned it into a picture.

## My thinking

- This is a read-only diagnostic surface, not a second admin panel. Acting on people (invites, status, roles) stays in Administration; every list here links there instead of duplicating those flows.
- A number without a baseline is noise. Every KPI compares the selected window against the immediately preceding window of equal length, computed from the same series.
- The numbers are seeded demo data, but every derived figure must reconcile: a member's drawer equals their table row, the dormant list agrees with the Last Active column, and the Active users KPI equals the table's count of members with activity.
- AI adoption is a first-class question, not a vanity stat: queries, chats, assisted reports, and who the power users are.

## How it should work

One page, one range control (7 / 30 / 90 days) that applies to everything below it.

| Metric | Definition | Comparison |
|---|---|---|
| Active users | Members with at least one action in the range | vs previous equal window |
| Actions | All logged events across modules | vs previous equal window |
| AI queries | Ask IRA and Concierge events | vs previous equal window |
| Reports | Reports generated in the range | vs previous equal window |

- Usage over time: actions per day with AI queries shown inside the total.
- Module breakdown: ranked share of activity across the eight platform modules.
- AI usage: queries, chats started, AI-assisted reports, top three AI users.
- Seats and lifecycle: total seats, active in range, dormant 30 days or more, invited and pending, suspended or inactive. Counts plus faces, no actions, one link to Administration.
- Member drill-down: clicking a table row opens a drawer with that member's activity trend, module mix, AI stats, and their real events from the current session. Footer links to Manage in Admin.
- Users and Teams lens: a segmented toggle aggregates the table by team for enablement conversations.
- Export CSV: downloads exactly the filtered table, writes an audit event, gated by a dedicated `ad_usage_export` permission.
- Live events: anything done in the current session folds into today's numbers immediately.

Non-goals: backend telemetry, billing, impersonation, or any people-management action inside this view.

## Verify against plan

- [ ] Delta chips render on every range and compare equal prior windows
- [ ] Drawer numbers equal the table row that opened it
- [ ] Seats buckets agree with the table's Last Active column
- [ ] Teams lens aggregates correctly and hides user-only filters
- [ ] Export downloads the filtered set and writes an audit event
- [ ] A live session event raises today's totals
- [ ] Only roles holding `ad_usage` see the view; `ad_usage_export` gates the export
