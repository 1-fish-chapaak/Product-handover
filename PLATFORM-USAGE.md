# Platform Usage

System > Platform Usage. Built against `Platform-Usage-Build-Spec_2.pdf` (11 Aug 2026), the
technical build spec: three views, twenty-five metrics numbered PU-01 to PU-30, and nine rules the
build must not break.

Four lines carry the design.

**One page, three readers.** A "Viewing as" switch sits at the top rather than three separate
pages. It changes whose data you see and which block comes first. It never changes the layout, the
wording or the names of things, so somebody who changes roles never has to relearn the page.

**The page shows, it never asks.** There is no input field anywhere in this feature, on the page or
off it. Two of the four assumptions replace themselves from the customer's own recorded history and
the other two are labelled defaults. Lookup prices are contract terms our operations team seeds at
signing.

**The page reads, it never writes.** No control here changes state: not approve, not reject, not
resolve. Blocks link to the screen that owns an action; they never perform one.

**Nothing is presented as fact that is not recorded.** A measured number states its source and its
sample. An assumed one carries the word *estimated* and its label, on the same screen as the figure
it produced.

Code:

- `src/data/platform-usage.ts` holds the records: populations and the runs that test them, chat,
  Concierge, SOP-to-RACM, the thirteen paid lookups and their contract prices, sample validations,
  exceptions with their classification and root cause, AI insights, action plans, the dashboard and
  alert event log, the reports trail, risks, engagements, continuous monitoring, and the hand work
  the self-measuring assumptions read.
- `src/data/platform-usage-metrics.ts` holds the figures: the window, the scope, the four
  assumptions and the job that calibrates two of them, and one `snapshot()` that the page and both
  exports read so they cannot diverge.
- `src/components/usage/` is the page, its blocks, and the CSV and PDF exports. It reads only.
- `tests/platform-usage.spec.ts` runs the spec's acceptance tests against the real page.

## The switch, in three rules

**It is a lens, not a key.** Switching never shows anybody data they could not otherwise see. A
view the reader is not entitled to is not offered at all.

**Down your own line only.** A CFO can narrow into a team or into their own work. A head of team can
narrow into their own work. Nobody can ever look sideways into somebody else's team.

**The screen always says what you are looking at.** One line above the blocks: *Viewing as CFO ·
Whole company · This quarter, 1 Jan 2026 to 31 Mar 2026 · Counted to 31 Mar 2026*.

| Permission | Highest view | Scope | Default window | Money |
| --- | --- | --- | --- | --- |
| `ad_usage` | CFO, *is this paying for itself?* | The whole company | This quarter | Yes, and only here |
| `ad_usage_people` (without `ad_usage`) | Head of Team, *is anything stuck?* | Their own team | This month | No |
| anybody signed in | Internal Auditor, *what is waiting on me?* | Only themselves | This month | No, hours only |

Everybody signed in can open the page and read their own work. No request, no approval: this page
is self-serve. The permissions decide how far **up** somebody can see, never whether they may open
it. A request for a view above the entitlement is refused with a sentence, because an empty page
would read as "no data" and hide a permissions bug.

To read another view in the prototype, use the switch. To see the switch itself narrow, change the
role: Administration > Roles & Permissions > System Admin > edit, and turn **Platform Usage** off
for the head-of-team ceiling, then **Per-person Usage** off for the auditor ceiling. There is no
impersonation anywhere.

Each view opens on the window it is meant to be read in. Once a reader picks a window for
themselves, switching views keeps their choice rather than overruling it.

## The quarter is the spec's worked example, to the rupee

Section 5 of the spec prices one quarter of one mid-size customer, and section 12 asks for a seeded
customer carrying those exact numbers so every tile can be checked against arithmetic done by hand.
The seed is anchored at **31 Mar 2026** for that reason, and for a second one. A quarter end is
where the renewal conversation happens, and it is the only anchor at which "this quarter compared
with last" compares two windows of the same length. An anchor three weeks into a quarter would show
a catastrophic drop that means nothing at all.

| | If an auditor did it by hand | IRA did it | Difference |
| --- | --- | --- | --- |
| The work | 1,428,000 rows checked this quarter | the same work either way | |
| Time | 7,140 hours at 200 rows an hour | 8.5 hours of actual processing | 7,131 hours saved |
| Cost | ₹85.6 lakh at ₹1,200 an hour | ₹18,400 as per contract | ₹85.4 lakh |
| People | about 15, full time all quarter | none | 15 freed |

Eleven populations sum to exactly 1,428,000 rows. 340 successful runs land in the window. Their
durations are allocated to sum to exactly 8.5 hours, and the seeded lookup volumes multiply out
against the contract to exactly ₹18,400. The acceptance tests assert each of them.

Savings round **down**, so 7,140 minus 8.5 shows as 7,131 rather than 7,132. Rounding a benefit up,
even by half an hour, is the kind of small dishonesty that costs a page its reader.

The money is priced on the **7,131 hours saved**, not on the 7,140 by hand, and the headcount is
worked out on the same 7,131. Pricing the by-hand figure would quietly hand back the 8.5 hours the
hours line had just given up, and a page that rounds its hours down and its rupees up is a page
nobody should believe. The sensitivity table is the one place the by-hand hours are still priced on
their own, because it answers what the assumed pace does to the figure and the machine time is a
constant that does not move with it. It says so in its own words.

## Coverage counts a population once

This is the rule the spec spends the most words on, and the one most likely to be lost by a later
change. A scheduled check re-reads the same vendor master every week. Adding those up would show
1,428,000 rows as 52,759,600, and the first person who noticed would stop believing the page.

So coverage counts the **population**: one population, one size, counted once however often it is
re-tested. The repeats are counted separately, on the same block, under the name **checks
performed**. On this seed that is 52,759,600 checks to cover 1,428,000 rows, about 36.9 times over,
and the block says so in a sentence.

The same trap exists on the time axis, so the over-time block credits a population to the window
that **first** tested it and never again. Its bars are runs, which is what actually varies, and the
coverage in its table adds up to the headline instead of to thirteen times the headline.

What re-running buys is not coverage but speed, which is a different number: how long between an
event and its detection. The continuous-monitoring block is what credits it.

## Findings: distinct, aged, and classified

Exceptions carry a content fingerprint, so a repeat occurrence never created a second row. Three
limits of that mechanism are respected on the page.

**Ageing runs from the day a finding was first raised**, which is only meaningful because of the
fingerprint. Findings raised before de-duplication shipped carry no fingerprint, so they are left
out of the ageing bars and counted apart in a sentence: an ageing chart built on possible duplicates
is a chart nobody can act on.

**Open means nobody has resolved it**, not that the problem is still there. A finding never closes
itself. The label says so under every ageing figure.

**The false-alarm rate divides by classified findings only.** The findings nobody has looked at are
their own bar and never join the denominator. Divide by everything and a page with a large untouched
backlog reports a flattering rate, and a rate of nought would read as perfection when it really
means nobody has checked. A rising rate means a control's rule wants tuning, not that the team is
failing, and the block says that where the number is.

## Insights are split, never summed

A per-run insight is something the assistant noticed inside one check. A consolidated insight is the
assistant reading a whole engagement and saying one thing about all of its runs. Adding them
together counts the same observation twice, once in its own right and once inside the summary that
describes it. So the block shows two counts, two lists and no total anywhere.

## Failed runs

Excluded from every saving on the page, and reported on their own as wasted machine time. That is
the least flattering way to report them and the most defensible.

A failure does not consume a scheduled run either. A check that failed at 02:00 and was re-run at
02:25 is two records, so the quarter still holds its 340 successful runs and the failure still
appears in the reliability block. A run that failed and was never re-run is what the head-of-team
view calls stuck, and it prints the run's actual error text rather than a status word.

## The four assumptions

No editor, no input field, and a read-only reference on the CFO view showing every value, its
source, the sample behind it and the changes on the record.

| Assumption | Value on this seed | Source |
| --- | --- | --- |
| Rows checked by hand in an hour | 200 | starting value, with 44 timed reviews on record over 92 days against a guard of 60 over 90 |
| Hours per manual control test | 3.6 | measured across 38 of your own timed tests over 111 days |
| Cost of an auditor hour | ₹1,200 | default, because no software can see salaries |
| Working hours per person per month | 160 | default, an HR standard rather than a measurement |

Both guards have to pass before anything is replaced: at least 90 days of history and a large
enough sample, with outliers trimmed, because an exception left open over a weekend did not take 60
hours to review. The seed deliberately shows both states at once, with one assumption short of its
sample and saying so and one already measured, because a page that only ever shows one of them
cannot be checked.

A person-month follows the calendar rather than an average month. A month covered end to end counts
as a whole one, and a part month counts as its share of that month's own days. A quarter is
therefore exactly 480 hours and a month exactly 160, which is what the spec specifies.

The sensitivity block prints what the spec calls the honest warning as a number rather than a
caveat. At 100 rows an hour the same quarter is worth ₹1.7 cr, and at 800 it is worth ₹21.4 lakh.
That is a swing of eight times on one assumption, so the assumption sits beside every figure it
produces.

## Cost is the contract, never a form

Prices are what we sold. Operations seed them at signing as versioned rows: the API, the vendor,
whether the vendor bills per run or per row, the charge, and the date it takes force. The customer
enters nothing.

The hero is **net value** only while the contract prices this window. With no price list at all
there is no total, the tile is absent rather than nought, and the hero reads **work avoided**
instead. "Net value" minus an unknown is not net value.

A lookup our operations team has not priced yet is not part of the contract, so it does not make the
total partial. Its calls are counted, it is named on its own row, it is charged nothing, and the
difference is stated in words on the same screen. Deliberately not an attention card for the
customer: the reminder goes to our operations team and there would be nothing on the card for them
to do.

The same lookups are counted twice on the page and the two counts are not equal. Activity counts
every call attempted, the cost block counts what the contract charges for, and on this seed that is
9,054 against 8,694. The gap is named with its number beside the larger figure, so a reader never
has to guess whether one of them is wrong: 360 calls ran on the lookup nobody has priced yet, and a
call that never came back is charged nothing either.

Two properties matter and both are visible on this seed.

The billing unit changes the number. Per row charges every successful call, and per run charges
once for a whole run however many rows it checked. The CIN check makes 540 calls in 60 runs and
charges 60 times ₹12 rather than 540 times ₹12. Reading that term the wrong way puts the figure out
by a factor of a thousand, so it is stored rather than assumed.

A price change never moves an old window. PAN Basic drops from ₹1.75 to ₹1.50 on 1 Feb 2026, so
January is charged at the January price and the cost line shows both.

Nothing else becomes money. The Concierge records a cost for three of its six tools, records zero
for two and has no cost code at all for the sixth. Chat usage is estimated from text length, and it
was built to stop conversations running away rather than to bill anybody. The SOP-to-RACM pipeline
records nothing about consumption, and most of its jobs are served from a cache that uses no AI at
all. So there is no blended AI cost anywhere on the page. Half of it would be real and half a
guess, and nobody could defend that number if somebody questioned it.

## The thirteen paid lookups

PAN Basic, PAN Details, PAN to GST, PAN to MSME, GST, MSME, CIN, Vaahan, UAN, Passport, Voter ID,
Driving Licence, Email. Six touch personal identity and are flagged as such in the records.

Aadhaar is deliberately absent. The spec records that the library screenshot we were given was cut
off, and that Aadhaar authentication is restricted to licensed entities. Adding it would be
inventing a record, so the page carries the note instead.

## Rules the build must not break

There is no ranking, ever. One per-person table, alphabetical, and no code path reorders it: not a
prop, not state, not a URL parameter. A table that sorts by output works as a league table however
it is labelled. The engagement process strip is sorted by a date for the same reason.

The page writes nothing. Not approve, not reject, not resolve. Both routes off it, the attention
card and the drill-down, end at the screen where the work actually happens.

Empties are honest. "Nothing happened" and "we don't measure this" are different facts and never
share a rendering. A quiet window shows a designed zero; an unrecorded thing shows the dashed
unmeasured state.

Answers come first. Every block answers its own title on screen, before anything is opened. Where
the block has a figure, the figure and one line of context are the answer and the fuller sentence
sits under *How this is counted*, so the same number is never printed twice on one screen. Where a
block has no figure of its own, the sentence stays on screen, because a heading over a fold is not
an answer.

Bars say what they are counting. A bar list whose total is not the figure above it carries one line
saying so. The risk block draws the uncovered risks by priority rather than the whole register,
because four bars adding to eighteen under a head that says seven reads as the head being wrong.

Splits add up to their head. "359 checks ran, 340 passed and 18 failed" is 358, and a reader who
does that subtraction and comes up short stops believing the rest of the page. The run split names
the ones stopped waiting on a person too. Insights are the exception that proves it: they are split
by kind and drawn in two charts, because a consolidated insight summarises the per-run ones and the
page will not print a total it does not stand behind.

A kind with nothing in it is a line, not a box. A window that created two of five kinds of thing
shows two links and one sentence, rather than two links and three empty-state boxes.

Every count opens its list, with a name, a maker and a date. A row with no person behind it says
*automatic*, which is a fact rather than a blank.

Every chart has a table one click away. The block owns that toggle, so a block that draws a chart
cannot forget to offer the numbers.

One number, one definition. A figure that appears in more than one place is computed once, in
`snapshot()`, and reused.

Not built, on purpose: seat or licence counts, benchmarks against other companies, per-user cost
attribution, and alerts or notifications. The page reports rather than notifies.

## Exports

CSV and PDF, both built from the same `snapshot()` the page renders. Both carry whose view it is,
what window it covers, the four assumptions with their sources, and the coverage note, so a figure
pasted into a board pack can still be defended six weeks later.

## What the seed is, and is not

A fixed seed: a seeded PRNG, no `Date.now()` and no `Math.random()`, so every reload, screenshot
and test sees the same history. It composes from the product's own tables, meaning the Workflow
Library's workflows, the Control Library's controls, the risk register, the engagement list, the
report list, the dashboard catalog and the member roster. A count here and the same count on its
own screen cannot disagree.

One seam worth knowing about. Platform Usage's records end on 31 Mar 2026, while the Admin audit
log still runs to 21 Apr 2026. The page says *Counted to 31 Mar 2026* rather than claiming to be
live, and the two are separate stores.
