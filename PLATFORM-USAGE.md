# Platform Usage

System > Platform Usage. Built from `Platform-Usage-Build-Spec.pdf`, the revision that adds
Smart Learn (PU-20). The earlier five-tab adoption page was deleted, not migrated.

Code:
- `src/data/platform-usage.ts` — the records: workflow runs, chat, Concierge, SOP to RACM, exceptions traced to their run.
- `src/data/platform-usage-metrics.ts` — PU-01 to PU-14, the four settings, periods, scopes.
- `src/components/usage/` — the page, its blocks, and the CSV and PDF exports.
- `tests/platform-usage.spec.ts` — the build spec's acceptance tests, run against the real page.

## The question the page answers

Is the platform earning its keep?

Not "is anyone logging in". The page reports how much work the platform did instead of a
person, what that work was worth in hours, rupees and people, how much of the control
library it touched, and what is stuck right now.

## The one honest gap

The platform can measure what it did and what that was worth. It cannot measure what it
cost. The paid registry lookups have no price list in the product, chat estimates its own
token usage from text length rather than measuring it, and the SOP to RACM pipeline records
nothing about consumption at all.

So the page shows the value side in full and the cost side not at all. There is no net
figure and no blended "AI cost", anywhere, ever. The one real cost the product records is
the Concierge job cost, and it appears as itself, labelled as itself, added to nothing.

The headline is called **Work avoided** for the same reason: "Net value" would be one real
number minus an unknown.

## Coverage

Four areas of the product write down what happens in them: workflow runs, chat, the
Concierge tools, and Smart Learn. Creating audits, editing controls, building dashboards and
producing reports leave no event, so those blocks stay empty until PU-15's event log starts
accumulating.

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

- **CFO** — Work avoided, Cost to run (only once complete), Value over time, Control coverage, Never exercised, Exceptions caught, Work volume, AI usage by area, Smart Learn.
- **Head of Team** — Stuck runs, Reliability, Never exercised, Per-person outcomes, Smart Learn (including proposals awaiting their approval), then Work avoided small at the bottom. A team lead cannot act on a rupee figure; they can act on a workflow that failed four times this week with the same error.
- **Internal Auditor** — My queue, Work volume, Exceptions caught, Work avoided, Value over time, Smart Learn.

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

## The four settings

Every value claim rests on four numbers the product cannot measure and the business chooses.
They are always shown next to the figures they produce, and only `ad_usage` can edit them.

| Setting | Default |
|---|---|
| Rows a person checks by hand, per hour | 200 |
| Blended cost of one auditor hour | ₹1,200 |
| Working hours per person, per month | 160 |
| Hours one manual control test takes | 4 |

The review rate swings the headline eightfold across its plausible range, so the editor
previews the resulting headline **live, before saving**, and every save writes an audit event
with the old and new values. The assumptions behind the numbers are themselves auditable.

Per-team editing is deliberately not offered: two teams with different review rates have
hours saved that cannot be compared, and the number stops meaning anything.

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

An auditor is never shown the pending-approvals list. A proposal they cannot approve is a
dead end, not information.

## Built, but showing nothing yet

**PU-04 cost to run** and **PU-05 net value** are built and wired. They stay off screen
because two of the four cost components have no price: the paid registry lookups need the
vendor price table (PU-19 step 2), and chat estimates its usage rather than measuring it
(PU-16). The tile is complete or absent, so the view guards on `cost.complete`.

`BILLABLE_WORKFLOW_IDS` is the pricing table's key column and is empty: this customer's
workflow library holds none of the thirteen paid lookups. A workflow is billable exactly
when the price table holds a row for it, so there is no second list to keep in sync.

## Not built

PU-14 lists exceptions only. Control tests and approvals join the queue when the product
gives them an assignment model (check 5 in section 11).

The API in section 8 is backend work and lives in `auditify-app`, not here. This build reads
the seeded records directly.

Check 7 in section 11 is open: "CFO" and "Head of Team" are page views, not role names. This
build maps them to `ad_usage` and `ad_usage_people`, and everyone else lands on the personal
view via `ad_usage_self`. That mapping is an assumption until Product confirms it.
