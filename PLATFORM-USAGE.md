# Platform Usage

System > Platform Usage. System admins only (`ad_usage`).

Code: `src/components/usage/`, `src/data/platform-usage.ts`. Every formula is written out in `PRD-PLATFORM-USAGE.md`, Appendix A.

## The problem

Admins cannot see how the platform is being used.

They have two places to look and neither helps. Admin > Users shows who has an account, which is not the same as using it. The Audit Log shows what happened one row at a time, and nobody scrolls a log to work out whether a rollout is landing.

So the person who set up the workspace cannot answer the one thing they get asked: is anyone actually using this?

The data is already there. We just never showed it back to them.

## How it works

Every action already writes a record: who did it, what they did, what to, and where in the product. That is the only input. The page collects nothing new and estimates nothing. If a feature does not write a record, it does not appear here, and we say so rather than invent a number.

Counts of *things*, as opposed to counts of actions, are read straight off the register that owns them. Reports from the report library, controls from the Control Library, risks from the Risk Register, sources from the Knowledge Hub, seats from the member list, findings from the exception register.

The rule: this page reports on the other screens, so it must count the same rows they do. If the Control Library says 14 controls, this page says 14.

That was a real failure, not a hypothetical. The page used to keep its own idea of each register and claimed 25 controls against a library of 14, 29 sources against a hub of 20, and 9 dashboards, two of which existed on no screen a user could open. Every count now comes from the register the module itself renders.

No test asserts that parity yet. It is the thing most likely to drift back, so it is on the verification list rather than being treated as solved.

## The window

One control at the top: all time, today, 7, 30 or 90 days, or a custom range. Every number is shown against the same number for the period before it. Fifty downloads means nothing until you know last month was twelve.

Each preset prints the dates it will actually hand you, because "last 30 days" is a promise about the calendar and this page does not keep it: the window counts back from the newest record, not from today. Pick "Last 30 days" in July and you get 23 March to 21 April. The label alone gives you nothing to catch that with, so the label is not alone.

When there is no earlier period, we show no comparison at all. Not a zero, not a dash standing in for data. A made-up baseline is worse than none, because people act on it.

## Where the clock starts

The window counts back from the newest activity, not from today.

If it counted from today and nobody had signed in for a while, every number would read zero. That looks like the platform is dead, when really nobody logged in this month. So the page anchors to the newest real record and counts back from there.

That anchor is also a trap, so the page says both dates out loud. "Showing 30 days up to 21 Apr 2026" is true and still tells you nothing on its own, because you have no second date to measure it against. Next to it the page names today and how stale the records are: "Today is 14 Jul 2026, the newest record is 84 days old." One date is a fact; two dates are a finding.

Work you do right now lands on the anchor day immediately. The anchor itself does not move: if it jumped to today on every click, the window would slide with it and empty itself.

## What is on the page

Headline numbers, what stands out, daily activity, most-used areas, per-section deep-dives, AI usage, members and seats, a day-by-hour grid, what got created, workflow runs, sharing, downloads, and a table of people and teams that exports to CSV.

"What stands out" is four findings, and none of them is new data. Three restate an aggregate that is somewhere else on the page. The fourth is the share of all activity the top three members drive, and it is the only one you cannot get any other way: three people doing 70% of everything is exactly what a healthy-looking total hides, and no total, chart or table here can be read to reveal it. Every finding clicks through to its evidence, because a finding you cannot check is an assertion.

Every number is built from single events, so you can click any of them and see the events behind it. The detail always adds back up to the number you clicked.

## How each number is worked out

| Number | How we get it |
| --- | --- |
| Actions | Every recorded event in the window |
| Active users | The people behind those events. An account that did nothing is not active, and neither is someone who signed in and then did nothing. Active means they did something |
| AI use | Questions asked, plus tool runs, plus chats started |
| Areas | Each part of the product, ranked by how many events happened in it |
| Reports | Counted from the report library, not from the events |
| Downloads | Every export, with the file type read off the record |
| Comparison | The same count for the period just before, as a percent. Nothing shown when there is no earlier period |
| Segments | Each person against the average of the people who were actually active, which sorts them into heavy, regular, light or no activity |
| Concentration | The share of all activity coming from the top three people |
| Spikes | Days that stand out from the rest of the window, with the area that caused them named |
| Day by hour grid | The clock time on each record. Records with no clock time are counted to one side, not spread across hours we would be guessing at |
| Seats | The member list: who is invited, who is active, who is suspended, and when each person last signed in |

Five of those need a word of explanation.

**Areas.** Every module name the platform writes is mapped to exactly one area, and anything unrecognised lands in "Other" so the gap is visible. It used to default into Risk and Controls instead, which quietly swallowed exception triage, audit planning, the Process Hub and every Concierge tool run. Risk and Controls then read as the busiest area on the platform, which said more about the default than about the workspace.

**Segments.** We average across the people who were active, not across everybody. Averaging across everybody drags the bar down and makes light users look better than they are.

**Concentration.** This is the one an admin will not spot alone. If three people do 70% of everything, the total still looks healthy. The workspace is leaning on three people rather than a team, and the total will never tell you that.

**Comparison.** When there is no earlier period we show nothing, not a zero. An invented baseline is worse than a missing one, because people act on it.

**AI use.** A question and a tool run are both counted once. A Concierge tool writes two records, one for the run and one for the thing it made, so counting both would count the same action twice and read a generated RACM as a question someone asked.

## What a new member looks like

- Invited: they sit in the seats list as invited and nowhere else. Everything reads zero, last active reads "Never".
- First sign-in: they count as someone who has signed in, but not yet as an active user. Signing in is not using.
- First action: now they are active, and their numbers move with what they do.
- First week: the numbers are real, but no comparison shows. There is no earlier week to compare with.
- Later: the 7-day trend means something after a week. The 30-day trend needs two months behind it, and the 90-day trend needs six.
- Quiet for a month: they drop into "no sign-in for 30+ days" and fall out of the shorter views.

A new workspace behaves the same way. Everything sits at zero and fills in as people use the product.

## What we cannot see

Reports and chats save the day but not the hour, so they cannot go on the day-by-hour grid. Its total is honestly lower than the action total.

Per-person AI use is incomplete, because older chats did not record who asked. Platform-wide AI volume is solid.

Both are stated on the page. We would rather say we cannot see something than fill the gap with a number that looks right.

While there is no backend, records written in the current session only last as long as the browser session.

## Scope

The page reports. It does not act. Managing people stays in Administration, and every list here links across instead of copying the flow. If two pages both manage people they drift apart, and then admins trust neither.

Not in scope: billing, backend tracking, signing in as someone else, and any people-management action inside this view.

## Why this is not the Audit Log

The log tells you what people did. It cannot tell you what people did **not** do.

Think of a class register. It lists every student who turned up. Now ask which students never came. You cannot find them, because they are not in it. You need the enrolment list beside it.

Same here. Someone invited who never signed in writes zero rows, so they do not exist in the log, and they are the first person an admin needs to see. The log also cannot show a pattern: "three people do 70% of the work" is on no single line, and only appears once you count all the lines.

It does not work the other way either. If someone asks whether Tom exported the client file on the 14th, a chart saying activity is up 12% is useless. You need the line.

| | Audit Log | Platform Usage |
| --- | --- | --- |
| The question | What exactly happened? | Is anyone using this? |
| The answer | One row per event | Counts and trends |
| When you open it | Something went wrong | You have to decide something |
| Must it be complete? | Yes. It is evidence | No. It reports what it can see |

## Why not merge them

Merging the pages is easy. Merging the jobs is not.

Put charts on the audit log and you still cannot see the people who never showed up, because they are not in it. You would read the member list anyway, so nothing is saved.

And you break the log. Evidence works by keeping every row exactly as it happened. Usage works by dropping rows and adding the rest up. Both are correct, and they cannot both be correct on one screen.

A merge saves one item in the nav and costs a trustworthy audit trail.

The one real overlap is the recent-activity feeds. They show the newest few events, filtered to one action, as context for the number above them: no filters, no paging, not evidence. If they ever grow filters and paging they have become a second audit log, and that is the line to hold.

## Open questions

1. Should Usage sit next to the Audit Log in the nav? Same person, related questions. I lean yes.
2. Do the recent-activity feeds belong here at all, or should they be cut with a link to the log?
3. Should anyone besides system admins see this? A team lead might want their own team's activity.
4. The "data as of" anchor is a workaround for having no backend. It should go once records persist.
5. Should the page act, or only report? It tells you 3 invites are pending and sends you to Administration. Should it let you revoke from here?
6. Per-person AI use is incomplete. Backfill, accept the gap, or stop reporting AI per person until it is reliable?
7. Should an owner be able to turn per-person activity off? Today anyone with `ad_usage` sees every named member's activity, with no switch. Slack ships that switch. Not built, and not a bug until we decide it should exist.
