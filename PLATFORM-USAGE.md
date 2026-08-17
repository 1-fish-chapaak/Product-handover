# Platform Usage

System > Platform Usage. Built from `Platform-Usage-Build-Spec_5.pdf`, the 11 Aug 2026
revision: the product blocks PU-22 to PU-28, PU-19 as invoice first, the attention strip, a
sentence at the head of every block, and **no editor anywhere on the page** — the
assumptions sharpen themselves from the customer's own recorded pace, and the two numbers a
person types live in Administration behind their own permissions. The earlier five-tab
adoption page was deleted, not migrated.

Code:
- `src/data/platform-usage.ts` — the records: workflow runs, chat, Concierge, SOP to RACM, exceptions traced to their run.
- `src/data/platform-usage-metrics.ts` — PU-01 to PU-14 and PU-20 to PU-28, the four settings, periods, scopes.
- `src/components/usage/` — the page, its blocks, and the CSV and PDF exports. It reads only.
- `src/components/admin/UsageAdminSection.tsx` — Administration → Platform Usage: the assumption pin and the vendor bills, each behind its own permission.
- `tests/platform-usage.spec.ts` — the build spec's acceptance tests, run against the real page.

## The question the page answers

Is the platform earning its keep?

Not "is anyone logging in". The page reports how much work the platform did instead of a
person, what that work was worth in hours, rupees and people, how much of the control
library it touched, and what is stuck right now.

## The one honest gap

The platform can measure what it did and what that was worth. Until somebody enters what the
vendor billed, it cannot measure what that cost. Chat estimates its own token usage from
text length rather than measuring it, and the SOP to RACM pipeline records nothing about
consumption at all.

So the page ships showing the value side in full and the cost side as an honest empty tile.
There is no blended "AI cost", anywhere, ever. The one real cost the product records by
itself is the Concierge job cost, and it appears as itself, labelled as itself, added to
nothing.

The headline is called **Work avoided** while that is true, because "Net value" would be one
real number minus an unknown. If finance enters a month's bill in Administration (PU-19) the
tile fills, backwards through every month entered, the hero becomes **Net value** and it
shows the net figure itself. A window is only costed when every month in it has its bill: a quarter with two of
its three invoices in is an unfinished quarter, not a cheaper one, so the tile names the
missing months instead of printing a total that will grow next week.

## Coverage

The product writes down more than the first read suggested. Counted today: workflow runs,
chat, the Concierge tools, Smart Learn, dashboards and the alerts they fire, reports and
their activity trail, sample validations, generated insights, the risk register, the
engagement portfolio, continuous monitoring config, and every record created in the window.
What is still missing is the middle of a record's life: edits, reviews, views and time
spent, which fill in as PU-15's event log accumulates.

That sentence is on screen, in the export header, and defined once as `COVERAGE_NOTE`. When
a later release widens coverage, one string changes and every surface follows.

## Three readers, one page

One page with a lens at the top, not three pages. The lens changes whose data you see and
which block comes first. It never changes the layout, the wording, or the names of things.

| Lens | Opens with | Sees | Entitled by |
|---|---|---|---|
| CFO | Work avoided, in hours, rupees and people | Everything. Never individual people. | `ad_usage` |
| Head of Team | Stuck runs, with the engine's own error text | Their own team. Never another team. | `ad_usage_people` |
| Internal Auditor | My queue | Only themselves. No average, no comparison. | `ad_usage_self` |

The scope line always says what you are looking at:
`Viewing as CFO · Whole company · This quarter, 1 Apr 2026 to 21 Apr 2026 · Data as of 21 Apr 2026`.

Block order per view, exactly as the spec lays it out:

Every block is called what the spec calls it, on screen and in both exports. Nothing on this
page is named anything the document does not name it.

- **CFO** — Work avoided or Net value, Cost to run, Value over time, Control coverage, Never exercised, Engagements, Risks, Exceptions caught, Sampling, Work volume by unit, Created this period, Dashboards widgets and alerts, Reports, AI insights, CCM and automation, AI usage by area, Smart Learn.
- **Head of Team** — Stuck runs, Reliability, Never exercised, Sampling, CCM and automation, Risks, Per-person outcomes, Created this period, Dashboards widgets and alerts, Reports, AI insights, Smart Learn, then Work avoided small at the bottom. A team lead cannot act on a rupee figure; they can act on a workflow that failed four times this week with the same error.
- **Internal Auditor** — My queue, Work volume by unit, Exceptions caught, AI insights, Work avoided, Value over time, Smart Learn.

The period selector offers This quarter, This year, Since you started and a custom range.
"This month" is suppressed while it is the same window as this quarter, because a control
that changes nothing reads as a broken page.

Every tile carries its change against **the previous window of equal length, immediately
before this one** — a 21-day quarter-to-date is compared with the 21 days before it, and the
comparison is labelled by its real length rather than by the name of the current window.

The lens is a lens, not a key. A view you are not entitled to is not offered, and you can
only ever narrow down your own line. `ad_usage_self` sits in every role, so everyone can
read their own work.

An auditor reads their own work in hours and never in rupees: "you saved 84 hours" reads as
an achievement, "you saved ₹1,00,800" reads as someone pricing your work.

## The page answers before it asks

Every view opens with **Needs your attention**: at most three cards, each a sentence with
one thing to do. `4 critical and high risks have no control covering them. See them` ·
`April 2026 has 34 recorded calls and no bill entered yet. Add it` · `Vendor Reconciliation
has failed 4 times with the same error. Open it`. Nothing is sent anywhere and nothing has
a threshold to configure: it is a fact already on the page, said early because acting on it
should not wait for a scroll. When there is nothing, the strip says `Nothing needs you.`
once and disappears.

Then **every block leads with a sentence, not a number**:

> The platform saved the company **2,264 hours** this quarter, up 35% on the previous
> period, worth **₹27.2 lakh** at the rate you set.

The tiles and the chart sit under it. A reader who reads only the bold sentences
understands the whole page, and a block cannot open on a tile instead: the sentence is a
required prop, and the only thing allowed in its place is the block's own empty state.

Long lists show their head and ask before showing the rest: the engagement strip opens on
the five soonest, the exception list on the three newest, the sample chart on the five
controls with something to look at. The table view behind every chart still holds all of
them.

Nothing on this page asks the reader for anything. There is no settings editor and no
invoice form on it: calibration happens on its own, and the one time the page does ask, it
asks as an attention card that hands the reader to Administration.

## The four assumptions, and why nobody fills them in

Every value figure on this page is an estimate and **says so**: the hero, the tiles, the
timeline and both exports all carry the word. Four numbers drive the estimate, and each one
carries where it came from:

| Assumption | Starting value | Source |
|---|---|---|
| Rows a person checks by hand, per hour | 200 | measured from the customer's own pace |
| Hours one manual control test takes | 4 | measured, when the test records carry times |
| Blended cost of one auditor hour | ₹1,200 | business-entered, never measurable |
| Working hours per person, per month | 160 | business-entered, never measurable |

The two measurable ones **apply themselves**. The calibration job measures the customer's
recorded pace, and the moment the guards pass (90 days of history, a big enough sample) the
live value switches to it: the source becomes `measured`, the label changes to "based on your
team's measured pace", and the switch is written down. There is no confirmation step, because
at ten thousand people nobody clicks one.

The review rate swings the headline eightfold across its plausible range. The page does not
hide that: it keeps "estimated" on every derived figure and the assumptions strip under every
value block, and the strip opens its own change history in place — who changed what, from
what to what, when, and under which source label. "Settings changed this quarter: 1" is a
real, listable figure.

Overriding one is an admin action taken in **Administration → Platform Usage** (permission
`ad_usage_settings`), and it is rare by design: pinning a value stops the platform improving
that number by itself, so the screen says so. Per-team values are deliberately not offered —
two teams with different review rates have hours saved that cannot be compared.

## The formulas

```
For each successful run that processed rows:
  manual hours = rows processed ÷ manual review rate
  hours saved  = manual hours − actual duration

For each successful control-test run (a control exercised, no row output):
  hours saved  = manual control test hours − actual duration

Headline = sum of hours saved over the period
Money    = hours saved × hourly rate
People   = hours saved ÷ (hours per person per month × months in period)

Coverage  = controls with ≥1 successful run ÷ all controls × 100
Never run = zero runs ever (ignores the period, needs no setting)
Failure   = failed runs ÷ all runs × 100, per workflow
```

Failed runs never add to savings. They are reported in the Reliability block as
"X hours lost to failed runs", which is how they are counted honestly without ever touching
the savings total. A run with no rows **and** no control is skipped entirely, because there
was no work to value.

## The page explains itself

Four things carry that, and they do different jobs. Getting them confused is what made the
page unreadable several times over.

**It says what it is, before anything else.** Not a description of its contents: the
question the reader came with, and the idea behind the answer.

> **Is the platform earning its keep?**
> Your team used to do these checks by hand. Workflows do them now. This page counts what
> those workflows got through and works out how long the same work would have taken a person,
> so the automation can be judged on what it actually did rather than on how it feels.

**Then it does the arithmetic once, on a real run.** "The platform saved 2,264 hours" is an
abstraction, and no amount of rewriting the sentence around it makes anyone picture how
software saves an hour. One concrete run does:

> Here is one real run. On **12 Apr 2026**, **Three-Way PO Match** checked **38,764 rows** in
> **6 minutes**. At 200 rows an hour by hand, the same work would have taken a person
> **194 hours**. That difference is what every figure on this page is counting.

`workedExample()` picks the largest run in the window because it is the clearest, not the
most flattering; the arithmetic is identical on the smallest one. The coverage note sits at
the bottom of the same block, because what the page cannot see belongs next to the
explanation of what it can.

**A short version, under it.** One paragraph, no card, that answers the whole page.
A reader who stops there has still got the answer they came for. Everything below it is the
evidence for those sentences.

> This quarter the platform got through **2,264 hours** of work for you, worth **₹27.2 lakh**
> at the rate you set. It checked **8** of your **14** controls and flagged **38** problems,
> **33** of which are still open. **6** controls have never been checked by anything at all.

**A spine.** Eight cards of equal weight is a wall: the eye has nowhere to start and no way
to skip. The blocks are grouped into three or four named parts ("Needs you now", "Gaps",
"Your team"), in the spec's own block order, so a reader can scan the page in a second.

**One explaining sentence per block, and only where it earns its place.** A block verdict
never restates a number that is already in the short version or printed underneath it. It
says the thing the numbers cannot: that the controls automation missed still have to be
tested by hand, that a 50% failure rate on two runs is not the same problem as on a hundred,
that severity is set by a person and not by the platform.

The page header answers the reader's own question first ("What is stuck, what keeps failing,
and what your team got through"), the coverage note sits under it as a caveat rather than as
the opening line, and **What these words mean** defines the product's own nouns (workflow,
run, bulk run, control, exception, Concierge job) for a reader who lives in spreadsheets
rather than in this product.

**The lens is labelled with the data, not with a job title.** The spec calls the three views
CFO, Head of Team and Internal Auditor, and its own check 7 says those are page views rather
than role names. On screen they read **Whole company · My team · Just me**: an audit manager
seeing "Viewing as CFO" has to work out whether they are standing in for somebody, and there
is no impersonation anywhere in this product. The persona names stay in the code and in the
exports, where they identify which view produced a file.

Block headings are plain English, not the spec's PU-xx metric names. Section 6 of the build
spec says it holds "only what a developer needs"; Part 2 is the reader-facing half, and Part
2 speaks in questions. So "Never exercised" is **Never run, not once**, "Per-person outcomes"
is **The team, person by person**, and "Work volume" is **How much ran**. The metric names
live in the code comments and in this document, where developers will look for them.

Two blocks carry a note in the source warning against a specific phrasing: the AI usage
verdict must explain the missing total without printing the banned phrase, and the per-person
verdict must promise there is no comparison without naming the comparison. Both were caught
by the acceptance tests rather than by review.

## Rules the build holds

- **No ranking.** Nothing sorts people by output, shows a share of the team, or compares a
  person against a team average. The per-person table is alphabetical, the sort is fixed in
  the metric rather than defaulted in the view, and no column header is a control.
- **Every chart has a table one click away.** The `Block` primitive owns the toggle, so a
  block that draws a chart cannot forget to offer the numbers behind it.
- **Every bar is labelled directly.** Nothing on the page relies on colour, shape or a
  hover to be readable.
- **"Nothing happened" and "we don't measure this" look different.** They are different
  facts, and `EmptyBlock` will not let them share a rendering.
- **Every number that rests on a setting shows that setting**, on the same screen.
- **The four work-volume counts are never summed**, on screen or in the export. A chat
  question and a bulk job are different units of work.
- **Exports carry their context.** Both formats put the lens, the exact window, the
  four settings and the coverage note above the numbers. The four work-volume counts go out
  as four rows with no total, and the PDF repeats the coverage note in the footer of every
  page.
- **Estimated numbers say estimated.** Every AI usage row carries how well the platform
  actually knows the figure: exact, estimated, not measured, or no record.
- **Not building:** seat or licence counts, benchmarks against other companies, per-user
  cost attribution, alerts and thresholds. The page reports, it does not notify.

## Where the numbers come from

Runs are generated, deterministically, and bound to the rest of the product rather than
invented beside it:

- Each workflow runs exactly as many single runs as the Workflow Library says it has, ending
  on the date the library shows as its last run.
- A run's control comes from `CONTROL_LIBRARY.linkedWorkflowIds`, the same link the Control
  Library screen renders. Coverage is 8 of 14 because that is what the library holds.
- Every run is attributed to a roster member who is allowed to run workflows. An actor who
  is not on the People list can never be attributed.
- Exceptions are the real ones from the exception register, each traced back to the run of
  its workflow that was newest when it opened.
- The personal queue is built through `myQueueFor`, the same helper the sidebar badge and My
  Queue use, so the three can never disagree.

Fixed seed, no `Date.now()`, no `Math.random()`. The window ends at ANCHOR, Tue 21 Apr 2026,
the same horizon the rest of the product's mock records sit on.

## PU-20 Smart Learn

The four numbers the Smart Learn screen already computes, scoped to the viewer: an auditor
sees their own memories, a team lead sees the team tier including proposals awaiting their
approval, the CFO sees company totals. Read through `liveMemories()` — the same selector
Smart Learn itself uses — so a memory approved or forgotten in one place moves in both.

Three of the four tiles match the Smart Learn screen exactly (35 active, 2 awaiting
approval, 2 due for review). The fourth does not, on purpose: Smart Learn's "Recalls this
week" is a seeded count of recall **events** (61), while PU-20's field counts **memories**
recalled in the window (27). They measure different things, so this tile is labelled
"Recalled in the last 7 days" for what it actually counts.

A proposal waiting on the reader is decided here, on the Head of Team view: the spec's
acceptance line is "memories proposed for my team wait for me, and I can approve or reject
from here", and somebody who opened the page to see what is stuck should not have to go
somewhere else to clear the one thing waiting on them. There is no second store behind it —
the buttons call the same actions the Smart Learn screen calls, so the same audit event is
written either way. A reader who may not decide a proposal is never shown one.

## PU-22 to PU-28 — the rest of the product

Seven blocks that need nothing invented, because the areas behind them already keep records:

- **PU-22 Dashboards, widgets and alerts.** Built, changed and shared counts come from the product's
  own event log, so the tile opens the list of who made each dashboard and when. Alert fires
  are the one event in the family with no person behind them, and those rows say
  "automatic, no person involved" rather than borrowing the widget's author.
- **PU-23 Reports.** Made, worked on and shared, held apart. A report edited fifty times is
  one report and fifty activities, and the two are never added. Action plans are counted as
  a live state across every issued report, not as a figure for the window, and the block
  says so.
- **PU-24 Sampling.** Passed, failed and errored, with errored kept visually and
  textually separate: a failed validation is a finding, an errored one is a check that could
  not be completed. The error text is shown verbatim. Counted per engagement and control
  together, because the same control tested under two engagements is two pieces of testing.
  Only the controls something went wrong on are charted; the clean ones are one sentence.
- **PU-25 AI insights.** Per-run and consolidated, side by side, never summed and with no total
  anywhere in the block, because a consolidated insight summarises per-run ones already
  counted.
- **PU-26 Risks.** A risk is covered when some control in the library names it,
  read off the controls rather than kept as a second number. The hero is the audit gap:
  critical or high, covered by nothing. The register records an owner and not a team, so a
  team lens says out loud that it reached the risks through their owner. It records nothing
  about whether a person or the assistant added a risk, so no origin split is claimed.
- **PU-27 Engagements.** Status tiles, plus one row per open engagement showing
  controls tested, open exceptions, what is in remediation and where the writing up has got
  to. Every cell opens the thing it counts, not just the row. Sorted by the end of the audit
  period, a date, never by owner. An engagement still
  open after its audit period ended is reported as exactly that, with the plain note that
  nothing in the record says whether it is late.
- **PU-28 CCM and automation.** The threshold each engagement expects against the pass
  rate it actually managed, computed from the same validations as PU-24 rather than from a
  second calculation that could disagree with the block above it. Each row also says how many
  approvals clear an exception there and how many exceptions are sitting in a gate right now.

## PU-21 — what was created

Six areas, each counted from its own creation stamp: engagements, audit plans, RACMs,
controls, dashboards and reports. The spec's "audits" is the audit plan scheduled in Audit
Planning, counted apart from the engagement that runs it rather than one standing in for the
other. The count opens one dated list across all six, each row saying which area it belongs
to.

## PU-19 — costing the paid lookups, invoice first

Bills are entered in **Administration → Platform Usage**, behind `ad_usage_invoices`, so a
tenant can hand invoice entry to finance ops without handing over the company-wide numbers it
feeds. The page itself only reads.

**Invoices are optional, forever.** Without one the cost block still says how many paid
lookups ran and across how many rows, and simply does not claim a cost. Nothing above it
depends on a bill: hours and rupees saved are computed from runs, not from what anybody paid.

Three layers, each optional after the first:

**Layer 1** needs nothing entered. The lookup volume is already counted from recorded runs.

**Layer 2 is the primary input: the month's bill.** One row per vendor per month — vendor,
month, the amount as it appears on the invoice, and a note for credit notes or disputes.
Summed over a window that is the exact cost, the same number finance reconciles, and it
needs no rate card and no guess about whether a run bills once or five hundred times. Past
months can be entered at any time and history fills in behind them. Under the figure the page
shows the effective rate — the bill divided by the calls recorded in the same window —
always labelled "derived from your invoices" and never presented as a price anybody quoted.

**Layer 3 is optional: the per-API split.** Only worth filling if the business wants the cost
split per workflow. The unit has no default on purpose: a run checking five hundred vendors
usually makes five hundred calls, and guessing that puts the split out by a thousandfold. A
renegotiated price starts a new row from its date and closes the old one the day before, so
last quarter's split still reads as last quarter's split. When a split exists, the page prices
the same runs with it and shows the gap against the bill rather than hiding it.

The entry manages itself. On the page, the cost tile opens the months behind it — what was billed and
what was recorded, month by month — and any month with recorded calls and no bill is a named
row rather than a quiet absence: `April 2026 has 34 recorded calls and no bill entered yet`,
which is also the attention card at the top of the view. Every entry and removal writes an
audit event and a change-log row, and each bill carries who entered it.

## Not built

PU-14 lists exceptions only. Control tests and approvals join the queue when the product
gives them an assignment model (check 5 in section 11).

The API in section 8 is backend work and lives in `auditify-app`, not here. This build reads
the seeded records directly.

Check 7 in section 11 is open: "CFO" and "Head of Team" are page views, not role names. This
build maps them to `ad_usage` and `ad_usage_people`, and everyone else lands on the personal
view via `ad_usage_self`. That mapping is an assumption until Product confirms it.
