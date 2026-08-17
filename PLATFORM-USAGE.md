# Platform Usage

System > Platform Usage. Built fresh from the build spec: three lenses on one page, PU-01 to
PU-28, the attention strip, a sentence at the head of every block, and **no input anywhere on the
page or anywhere else in the product**. There is no Administration screen for it either: the page
states its own assumptions under the figures they produce, and its own contract prices under the
cost they produce. The assumptions behind the value figures measure themselves
from the customer's own recorded pace. The lookup prices are contract terms, set by irame when
the deal is signed and seeded platform-side, so the cost simply appears and says "as per your
contract".

The page was re-authored from a blank sheet against the 11 Aug 2026 revision, then updated for
the 17 Aug revision of PU-19, which changed the pricing model: prices are ours to set, not the
customer's to enter. Nothing was migrated from the earlier build.

Code:

- `src/data/platform-usage.ts` (the records) workflow runs, bulk runs, chat, Concierge jobs,
  SOP to RACM, paid lookups, sample validations, insights, the event log, the reports trail, the
  risk register, engagements and their history, automation config, and the hand work the
  calibration job reads.
- `src/data/platform-usage-metrics.ts` (the figures) PU-01 to PU-28, the four settings and the
  calibration job, the windows, the scopes, the attention strip, and one `snapshot()` the page
  and both exports read so they can never diverge.
- `src/components/usage/` the page, its blocks, and the CSV and PDF exports. It reads only.
- `tests/platform-usage.spec.ts` the spec's acceptance tests, run against the real page.

## The question the page answers

Is the platform earning its keep?

Not "is anyone logging in". The page reports how much work the platform did instead of a person,
what that work was worth in hours, rupees and people, how much of the control library it touched,
and what is stuck right now.

## Cost: the contract, not a form

Lookup prices are part of what was sold. So they are seeded platform-side by irame operations when
the deal is signed, as versioned rows: the API, the vendor, whether the vendor bills per run or per
row, the charge, and the date it came into force. `CONTRACT_PRICES` in `platform-usage.ts` is that
seed, and `loadContractPrices()` reads a platform-side override if one has been pushed. No screen
in the product writes either, because none exists to.

The cost on the page is then the volume the platform recorded, priced at that contract, labelled
**as per your contract**. Two properties matter:

- **The billing unit changes the number.** Per row charges for every successful call. Per run
  charges once for a whole run however many rows it checked, which is why lookup calls carry a
  `batchId`. On this seed the CIN check makes 45 calls in 5 runs and charges 5 times ₹12, not 45
  times. Reading that term the wrong way puts the figure out by a factor of a thousand.
- **A price change never moves an old window.** Rows are versioned, so January is charged at the
  January price and February at the renegotiated one. The seed carries that renegotiation (PAN
  Basic drops from ₹1.75 to ₹1.50 on 1 Feb 2026) precisely so the behaviour is visible.

Where the contract does not price an API yet, those calls are counted, named on screen, and charged
nothing. That is ours to fix rather than the customer's, so it is stated in the block and is
deliberately not an attention card: a card whose only action is "ask your vendor manager" is not an
action. On this seed the Email API check is priced from 1 Mar 2026 only, so earlier calls sit in
that state.

With no contract loaded at all the hero reads **Work avoided** and the cost block says so plainly.
It never prints a zero cost. Once prices exist the hero becomes **Net value**: work avoided less
what the contract charged.

Chat estimates its own token usage from text length rather than measuring it, and the SOP to RACM
pipeline records nothing about consumption at all, so there is no blended "AI cost" anywhere, ever.
The one price the product records by itself is the Concierge job cost, and it appears as itself, in
the currency it was recorded in, added to nothing.

## Coverage

Counted today: workflow runs, chat questions, Concierge jobs, sample validations, generated
insights, dashboards and the alerts they fire, reports and their activity trail, the risk register,
the engagement portfolio, continuous monitoring config, and everything created in the window. What
is still missing is the middle of a record's life: edits, reviews, views and time spent, which fill
in as the event log widens (PU-15).

That sentence is on screen, in both exports, and defined once as `COVERAGE_NOTE`. When a later
release widens coverage, one string changes and every surface follows.

## Three readers, one page

One page with a lens at the top, not three pages. The lens changes whose data you see and which
block comes first. It never changes the layout, the wording, or the names of things.

| Lens | Opens with | Sees | Entitled by |
|---|---|---|---|
| CFO | Work avoided, in hours, rupees and people | Everything. Never individual people. | `ad_usage` |
| Head of Team | What is stuck, with the engine's own error text | Their own team. Never another team. | `ad_usage_people` |
| Internal Auditor | Waiting on you | Only themselves. No average, no comparison. | `ad_usage_self` |

The scope line always says what you are looking at:
`Viewing as CFO · Whole company · April 2026 so far, 1 Apr 2026 to 21 Apr 2026 · Data as of 21 Apr 2026`.

Block order per view, as the spec lays it out. Every block is called what the spec calls it, on
screen and in both exports.

- **CFO** Work avoided or Net value, Cost to run, Value over time, Control coverage, Never
  exercised, Engagements, Risks, What the platform caught, Sample validation, Work volume by unit,
  Created this period, Dashboards widgets and alerts, Reports, Insights generated, Continuous
  monitoring, AI usage by area, What the assistant has learned.
- **Head of Team** What is stuck, Reliability by workflow, Never exercised, Sample validation,
  Continuous monitoring, Risks, What the platform caught, Your team by outcome, Work volume by
  unit, Created this period, Dashboards widgets and alerts, Reports, Insights generated, What the
  assistant has learned, then Work avoided small at the bottom. A team lead cannot act on a rupee
  figure. They can act on a workflow that failed four times this week with the same error.
- **Internal Auditor** Waiting on you, Your work, What the platform caught, Work volume by unit,
  Time saved, Value over time, Insights generated, What the assistant has learned.

The lens is a lens, not a key. A view you are not entitled to is not offered, and you can only
narrow down your own line. `ad_usage_self` sits in every role, so everyone can read their own work.

An auditor reads their own work in hours and never in rupees: "you saved 84 hours" reads as an
achievement, "you saved ₹1,00,800" reads as somebody pricing their work.

## The window

The selector offers This month, This quarter, This year, Since you started and a custom range, and
it drops any window that is the same as one already on the list. Three weeks into a financial year
this month, this quarter and this year are the same twenty one days, and three controls that change
nothing read as a broken page. The narrowest true name wins, because calling 21 days "this year"
invites a reader to think twelve months are in the figure.

Every tile carries its change against **the window of the same length immediately before this one**,
labelled by that window's real length rather than by the name of the current one. A chart of a
window under ten weeks is drawn by week, because one monthly bar is not a chart.

## The page answers before it asks

Every view opens with **Needs your attention**: at most three cards, each a sentence with one thing
to do. `Three-Way PO Match has failed 4 times with the same error` ·
`4 critical and high risks have no control covering them` ·
`April 2026 has 988 recorded lookups and no bill entered, so nothing in this window is costed`.
Nothing is sent anywhere and nothing has a threshold to configure: each card is a fact already on
the page, said early because acting on it should not wait for a scroll. A card whose action the
reader cannot take is not shown to them. With nothing to say the strip says `Nothing needs you.`
once and gets out of the way.

Every card has to end somewhere, and the label says which. When the reader's view carries the block
the card is about, acting on it scrolls there. When it does not, the card leaves the page for the
record itself and says so: the CFO's view has no stuck block, so its repeated-failure card reads
"Open the run history" and goes to the run, rather than scrolling to an element that is not there.
Each card carries its `data-attention-target`, and a test clicks every card on every lens and fails
if one neither scrolls its block into view nor leaves the page.

Then **every block leads with a sentence, not a number**:

> The platform saved the company **1,458 hrs** in April 2026 so far, up **1.9%** on the previous 21
> days. It came from **123** runs over **3,24,972** rows and **15** control tests the platform ran
> instead of a person.

The tiles and the chart sit under it. A reader who reads only the bold sentences understands the
whole page, and a block cannot open on a tile instead: the sentence is a required prop, and the only
thing allowed in its place is the block's own empty state.

Long lists show their head and offer the rest: the engagement strip opens on the five whose period
ends soonest, the exception list on the three newest, the sample chart on the five controls with
something to look at. The table behind every chart still holds all of them.

## The four assumptions, and why nobody fills them in


Four numbers are needed that automation alone cannot supply.

| Setting | Starting value | Measurable |
|---|---|---|
| Rows a person checks by hand in an hour | 200 | yes |
| Hours for one manual control test | 4 | yes |
| Cost of one auditor hour | ₹1,200 | no |
| Hours a person works in a month | 160 | no |

The two measurable ones are computed from the customer's own timestamps: rows worked through
divided by the hours a record was open, and the average of start to complete on a manual test. Once
the guards pass (90 days of history, at least 20 records, the slowest tenth trimmed) the live value
switches to the measured rate on its own, the label changes to "based on your team's measured pace",
and an audit row is written. There is no confirmation step, because at 10,000 employee scale nobody
clicks. On this seed the job finds **231 rows an hour** and **3.5 hours a manual test**, from 96 and
33 records.

The two money numbers can never be measured. They run on their labelled defaults. There is no pin
field and no settings form anywhere in the product: if a tenant genuinely needs a different value it
is set in configuration by support, arrives as a stored `manual` source, and is labelled as such on
every figure it feeds. Settings are tenant wide, because per team values make teams impossible to
compare.

All of it is readable from the page itself. The assumptions strip sits under every value figure with
each number's source next to it and its change history one click away, and the contract rows sit in
the cost block's own drill. That is why there is no Administration screen: a second surface would
have restated what the figures already say, one click further from them.

Every figure that rests on a setting prints that setting underneath, with where it came from. The
strip opens its own change history, so "assumptions changed in April 2026 so far: 2" is a real,
listable figure.

## What the page will not do

Seat or licence counts (not a concept here) · benchmarks against other companies (no such data
exists) · per user cost · alerts and thresholds (the page reports, it does not notify) · anything
that ranks people.

The no ranking rule is enforced in code, not in a style note. The one per person table is
alphabetical, no numeric column is sortable by click or by URL, a member with no runs still appears,
and there is no share of the team and no team average anywhere: "you ran 62, the team average is 51"
is a ranking through the back door and is banned too.

## Two empty states, never confused

"Nothing happened" and "we do not measure this" are different facts and cannot share a rendering.
`Empty kind="quiet"` is a designed zero ("No samples were validated for the company in this
window"). `Empty kind="unmeasured"` is dashed and italic ("The assistant has not learned anything
about you yet"). Four zeros that look measured would be a lie about a feature that is switched off.

## Permissions

`ad_usage` / `ad_usage_people` / `ad_usage_self` are the three lenses. `ad_usage_export` gates the
two exports. That is the whole list. `ad_usage_invoices` went with the bill screen and
`ad_usage_settings` went with the Administration tab: neither gated anything once the page carried
its own assumptions strip and contract drill.

## Where the numbers come from

Every record is composed from a table the rest of the product already renders, so two screens can
never disagree in front of the same reader: the Workflow Library's own run counts, the Control
Library's fourteen controls, the exception register, the engagement list, the report list, the risk
register, the dashboard catalog, the member list. The seed is fixed at ANCHOR, Tue 21 Apr 2026, with
history back to 1 Oct 2025 so the longest window has an equal window behind it. A fixed seed PRNG,
no `Date.now()`, no `Math.random()`: every reload, screenshot and test sees the identical history.

The costs are the exception, because there is nothing to compose from. The vendor's bill and the
optional per API prices are entered by a person and kept in localStorage next to their own audit
trail.

## Exports

CSV and PDF, both gated by `ad_usage_export`. Both carry whose view it is, what window it covers,
the four assumptions with their sources, and the coverage note, above any figure that rests on them.
The four work units are written as four rows and never as a total. An unpriced cost is an empty cell
with its reason next to it rather than a zero. The PDF is a real `.pdf` through pdfmake, loaded on
demand, and writes money as plain numbers under an "INR" heading because the bundled Roboto is not
guaranteed to carry the rupee glyph.

## Where this build reads the spec rather than following it literally

Four places. Each one is a decision, not an omission.

1. **The Concierge job cost is not added into "cost to run".** PU-04 sums it with the lookup cost,
   but the product records it in dollars and nobody has agreed a rate to convert it. A silent
   conversion is the blended figure section 3 forbids, so the dollar figure is shown as itself, next
   to the rupee total, added to nothing. Two of the six tools set their total to `0.0` literally, so
   their jobs are counted as unpriced rather than as free.
2. **The vendor invoice layer is not a customer screen, and neither is anything else.** PU-19 still
   documents a `vendor_invoices` table, but the same section now says the customer never sees a price
   form, a pin field or an invoice screen, and that cost is volume times the contract price. Two cost
   sources on one page would leave a reader asking which one is true, so the customer page has one:
   the contract. Reconciling what the vendor actually billed against what the contract says is an
   irame side job, on the platform console rather than in the tenant's product. The page has no
   Administration screen at all for the same reason.
3. **Stuck runs are scoped to the window.** PU-11's query has no time bound, but a run that failed
   three months ago is not stuck, it was dealt with. The block counts failed, blocked and long
   paused runs inside the selected window, and says so.
4. **"Audits" in PU-21 are the RACM programmes.** The spec names five tables and glosses controls as
   RACM entries, so the audit count reads the RACM registry, which is the audit programme a cycle
   runs from. Controls read the Control Library.

Two figures also carry a floor rather than a percentage nobody should read: a CCM pass rate needs
three concluded tests before it prints one, and Smart Learn's total recall count is a company figure
in the store, so it is shown at company scope only rather than split across teams.

## Verified

Driven in the real app, not read off the source, at 1560 by 1100:

- All three lenses for `u-admin`, plus `u-auditor`, `u-enabler` and `u-viewer`, who are offered only
  their own view and still get a full page. No console errors on any of them.
- Both windows on the CFO view: weekly buckets for April so far, monthly buckets for since you
  started. The chart draws through `ChartAutoSizer`, with every bar labelled with its own figure.
- Chart to table toggle, every drill list on the page, the attention cards, and the deep links out
  to the risk register, an engagement and the workflow library.
- The cost flow both ways. With the contract seeded the hero reads Net value and the cost lede reads
  "The 999 paid lookups in April 2026 so far cost ₹2,721 as per your contract, which works out at
  ₹2.72 a lookup across every API"; the per API drill shows CIN charging 5 runs times ₹12 rather
  than 45 calls times ₹12. With the contract cleared the hero reads Work avoided and the cost block
  says the prices have not been loaded yet, with no zero printed anywhere.
- With every drill on the page open, it renders zero inputs, selects and textareas outside the
  period selector's own custom range, and no Pin button.
- CSV and PDF both download, with the contract rows in both.
- `tests/platform-usage.spec.ts` (31 tests), `tsc --noEmit`, and `eslint` on every file in the
  feature.
