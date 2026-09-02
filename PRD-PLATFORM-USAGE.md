# PRD — Platform Usage

Owner: Nilesh Anand · Surface: System > Platform Usage · Access: `ad_usage` to open, `ad_usage_people` for the per person view, `ad_usage_export` to download · Status: revamp

---

## 1. Problem statement

Platform Usage exists to answer one question: **is this platform worth paying for.** What would this quarter's audit work have cost in human time, what did it cost with us, and what is the difference. That question is asked at renewal, and it is the reason the surface exists at all.

Answering it takes four inputs. We hold three of them and we invented the fourth.

| Input | Do we hold it | Where from |
| --- | --- | --- |
| How much work was done | Yes | 1,428,000 rows across eleven populations, 340 successful runs, all recorded |
| How long the platform took | Yes | 8.5 hours of machine time, recorded to the millisecond |
| How long a person would have taken | Yes, and this is the part we keep forgetting | `MANUAL_REVIEWS` and `MANUAL_CONTROL_TESTS` time the customer's own team, and `calibrate()` replaces our starting value with their measured pace once the guards pass |
| What an hour of that person costs | **No** | No software can see salaries. We put ₹1,200 an hour on the page and called it a default |

So the shape of the problem is narrow and specific. Three quarters of the value case is already provable from the customer's own records. The last quarter of it is a number we made up, and because money is the headline, that one made up number carries the entire figure.

**And it is wrong, not merely unsourced.** Published India salary data puts an internal auditor's fully loaded cost at about ₹530 an hour. ₹1,200 is roughly what it costs to buy an audit hour from a firm, not what it costs a company that employs its own auditors. Section 138 of the Companies Act requires prescribed companies to have an internal auditor, so an in-house team is exactly who our customers are. The current headline of ₹85.4 lakh is therefore about twice an honest figure.

The page then prints its own sensitivity table showing an eight times swing, which reads as an admission that we do not know. It is worse than that: the swing is real, but it is not caused by our uncertainty. It is caused by a genuine business fact, that an in-house hour and a bought-in hour differ by four or five times, and we never said so.

**One line: we can prove the time and we cannot prove the price, so we invented a price, got it roughly double, and hung the whole renewal case on it.**

Two smaller failures ride along. The page has grown to twenty five blocks across thirteen groups, which the four people who open it cannot read. And every block is the same card with the same tile in it, so nothing on the page signals which number matters.

---

## 2. Who opens it, and what each one asks

Four readers, confirmed. Not one.

| Reader | Their question | Opens on |
| --- | --- | --- |
| CFO or finance | Is this paying for itself | Value |
| Our CS or account team | The same question, before a renewal call | Value, the same view |
| Audit lead or CAE | Am I ready for the committee, and what is slipping | Coverage and findings |
| Workspace admin | Is the team actually using what we bought | Activity and what is stuck |

The "Viewing as" switch stays. It changes whose data you see and which block comes first. It never changes the layout, the wording or the names of things, so somebody who changes role never relearns the page.

Three rules hold it, unchanged from the current build because they are right.

**It is a lens, not a key.** Switching never shows anybody data they could not otherwise see. A view the reader is not entitled to is not offered.

**Down your own line only.** You narrow into your own team or your own work. Never sideways into somebody else's team.

**The screen always says what you are looking at**, in one line above the blocks.

**Decision taken, flag it if wrong:** our CS and account team read the CFO view rather than getting a view of their own, because their question is identical and because this product has no impersonation and will not get one. If CS actually needs something the CFO view does not carry, that is a separate surface, not a fifth persona.

---

## 3. The value calculation, and where every number comes from

This is the heart of the feature, so every step is stated and every step says whether it is recorded or assumed.

**Step 1. The work.** 1,428,000 rows across eleven populations this quarter. Recorded. Counted once per population however often it is re-tested, which is why checks performed is a separate figure at 52,759,600.

**Step 2. What a person would have taken.** Rows divided by the manual pace. The pace starts at 200 rows an hour and is **replaced by the customer's own measured pace** once there are enough timed reviews over enough days. 1,428,000 at 200 an hour is 7,140 hours.

**Step 3. What we took.** 8.5 hours of machine time. Recorded to the millisecond. Failed runs are excluded from every saving and reported separately as wasted machine time.

**Step 4. Hours saved.** 7,140 minus 8.5 is 7,131. Savings round down, always. Rounding a benefit up, even by half an hour, is the kind of small dishonesty that costs a page its reader.

**Step 5. People freed.** 7,131 hours over a quarter of 462 available hours is 15.4 people.

**Step 6. Money.** 7,131 hours at the auditor rate, less what the contract charged.

---

## 4. The rate, corrected and sourced

The rate is the only assumed number left in the chain, so it carries its whole derivation on screen.

**Default: ₹550 an hour**, the fully loaded cost of an in-house internal auditor in India.

| Step | Value | Source |
| --- | --- | --- |
| Base salary, median | ₹6,57,000 a year | Glassdoor India, Feb 2026 |
| Base salary, average | ₹7,94,964 a year | PayScale, 2026 |
| Taken | ₹7,25,000 | the midpoint of the two |
| Overhead multiplier | 1.35 | published range is 1.25 to 1.45 |
| Fully loaded annual cost | ₹9,78,750 | |
| Available hours a year | 1,848 | 52 weeks at 40 hours, less about 29 days of leave and public holidays |
| **Cost an hour** | **₹530, taken as ₹550** | |

**Working hours a month becomes 154**, which is 1,848 over twelve, replacing the 160 that was an HR round number.

**The rows an hour figure stays at 200 and its label changes.** The profession documents 4 to 9 transactions an hour for full substantive testing with documentation. That is not what this is. This is a person checking rows against a rule in a spreadsheet, where 100 to 300 an hour is right. The label must say which of the two it means, because a reader who knows the audit benchmark will otherwise think the number is twenty times wrong. Note also that a higher pace produces a **smaller** saving, so 200 is the conservative choice, not the flattering one.

### The sensitivity table becomes an honest business fact

Today it says the figure swings eight times if our assumption moves, which reads as us not knowing. Rebuilt, it says something a CFO can act on.

| If your audit hours are | Rate | This quarter is worth |
| --- | --- | --- |
| In-house, costed on available hours | ₹530 | ₹37.8 lakh |
| In-house, costed on chargeable hours only | ₹662 | ₹47.2 lakh |
| Bought from a firm, lower end | ₹940 | ₹67.0 lakh |
| Bought from a firm, upper end | ₹2,500 | ₹1.78 crore |

The swing is not our uncertainty. It is the difference between employing auditors and buying them, and the block says exactly that.

### If the customer gives us their own rate

No customer has ever been asked for one. If operations starts collecting it at contract time, the way lookup prices are already seeded, it replaces the default as a versioned row and the figure becomes the customer's own. There is no input field anywhere in this feature and the customer never types it. Until that process exists, the default above is what shows, with its derivation beside it.

---

## 5. What each view opens on

Layout, wording and block names are identical across views. Only the order changes.

**Value view** (CFO, finance, our CS and account team). Hours saved and what it is worth · the work behind it · what it cost under the contract · the sensitivity table · then coverage, findings and activity.

**Coverage and findings view** (audit lead, CAE). Plan completion · coverage of the control library and unmapped risks · full population against sample · time from an event happening to us catching it · findings and their age · overdue actions · then value and activity.

The six lines above are the committee pack. They were built once and are preserved at commit `a726aff`; the work is recovered into this view rather than rewritten.

**Activity view** (workspace admin). What ran and what is stuck, with the real error text · who is using it · what got created · then coverage and value.

Everyone, at every view, can narrow scope to their own team or their own work, bounded by entitlement.

---

## 6. Rules the build keeps

These are the good part of the current build and they carry over whole.

- One number, one definition. Every figure is computed once in `snapshot()` and the page and both exports read it.
- The page reads and never writes. No approve, no reject, no resolve. Every route off it ends at the screen that owns the action. The one permitted write is the audit event an export emits.
- Nothing presented as fact that is not recorded. A measured number states its source and its sample. An assumed one carries the word estimated, its value, and its derivation on the same screen.
- Coverage counts a population once, however often it is re-tested. Repeats are counted separately as checks performed.
- Failed runs are excluded from every saving and reported on their own.
- Insights are split by kind and never summed.
- Ageing runs from the day a finding was first raised. Open means nobody has resolved it, not that the problem is gone.
- The false alarm rate divides by classified findings only.
- Splits add up to their head.
- Empties are honest. Nothing happened and we do not measure this never share a rendering.
- Every chart has a table one click away. Every count opens its list with a name, a maker and a date.
- No ranking, ever. The per person table is alphabetical and no code path reorders it.
- No benchmark against another company and no target, on any figure. The rate research in section 4 informs our default; it is never printed as a target the customer should hit.

---

## 7. What changes in the data layer

| Constant | Now | Becomes | Why |
| --- | --- | --- | --- |
| `hourlyRate` | ₹1,200 | **₹550** | Sourced in section 4. The old value prices a bought-in hour for a customer who employs their own auditors. |
| `hoursPerPersonPerMonth` | 160 | **154** | 1,848 available hours over twelve months, rather than an HR round number. |
| `manualReviewRate` | 200, label vague | 200, label corrected | Must say it means rule checking in a spreadsheet, not a substantive audit procedure. |
| `HISTORY_START` | 1 Jul 2025 | **1 Apr 2025** | The Indian financial year starts on 1 April, so the anchor at 31 Mar 2026 becomes a financial year end. Already done at commit `999ab4b` and worth keeping. |
| Windows | month, quarter, year, since start, custom | the same, plus **financial year to date** | `this-year` resolves to 1 Jan 2026, which is the same window as the quarter and prints identical numbers. Financial year to date is the one a committee reads. This is an addition, not a replacement. |

The worked example moves, on purpose, and the tests must move with it.

| | Was | Becomes |
| --- | --- | --- |
| Hours saved | 7,131 | 7,131, unchanged |
| People freed | 14.9 | 15.4 |
| Money saved | ₹85.6 lakh | **₹39.2 lakh** |
| Net of contract | ₹85.4 lakh | **₹39.0 lakh** |
| Rows, runs, machine time, contract charge | 1,428,000 · 340 · 8.5 h · ₹18,400 | unchanged, all four still assert |

---

## 8. How the page should look

The page reads generic because every block is the same card with the same tile inside it. `DESIGN.md` already prohibits most of what is wrong: no hero metric template, no identical card grids, no side stripe wider than 1px outside Alert Cards, borders before shadows, flat at rest.

- Type and hairlines carry the hierarchy. The sentence that answers a block is the widest thing in it, and the figure follows the sentence rather than towering over it.
- Related figures live in one bordered container with hairline separated rows, not in one card each.
- A column head is stated once at the top of its group, never repeated per row.
- An assumption's derivation is plain text under the figure, not a pill. A pill makes an estimate look like a status.
- A drill down is named in the sentence, "open the fourteen engagements", not a chevron and not a whole row click target.
- Inter throughout. On grid sizes only: 12, 14, 16, 18, 20. Never 11, 13, 15 or 17, whatever the ramp in `DESIGN.md` lists.
- Every figure carries `tabular-nums`.
- `brand-600` stays under a tenth of the screen. Semantic colour is always paired with a word.
- Charts use `ChartAutoSizer`. `ResponsiveContainer` renders blank at recharts 3.8 and must not return.
- Twenty five blocks is too many to read. Each view keeps its own first three groups open and folds the rest into a contents list.

---

## 9. QA and UAT

**Positive**

1. Each of the four readers opens on the view named in section 5, and the header line states reader, scope, window and the counted to date.
2. The switch offers only views the reader is entitled to, and narrowing never reaches another team.
3. The value view shows hours saved, people freed, money, and the contract charge, each with its source or its derivation on the same screen.
4. The rate block shows the full derivation from section 4: salary median, multiplier, available hours, result.
5. The sensitivity table shows the four rows from section 4 and names the in-house against bought-in cause.
6. Q4 FY26 reconciles: 1,428,000 rows, 340 successful runs, 8.5 hours machine time, ₹18,400 charged, 7,131 hours saved, ₹39.2 lakh.
7. Financial year to date covers 1 Apr 2025 to 31 Mar 2026 and differs from the quarter on every flow figure.
8. Both exports carry the reader, the window, every assumption with its derivation, and the coverage note.

**Negative**

9. No figure anywhere states an assumed number without its derivation on the same screen.
10. No rate other than ₹550 appears as the default, and ₹1,200 appears nowhere.
11. No benchmark, target or comparison against another company on any figure.
12. No control on the page changes a record it reports on.
13. No input field exists anywhere in the feature.
14. A quiet window shows a designed zero. An unmeasured thing shows the dashed unmeasured state. They never render the same.

**Edge**

15. With no contract prices at all there is no total, the tile is absent rather than nought, and the hero reads work avoided instead of net value.
16. A reader entitled only to their own work sees hours, never rupees.
17. A population re-tested weekly is counted once in coverage and its repeats appear only under checks performed.

---

## 10. Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-01 | The Viewing as switch exists and offers only entitled views. |
| AC-02 | Each of the four readers opens on the view named in section 5. |
| AC-03 | `hourlyRate` is ₹550 and ₹1,200 appears nowhere in the codebase or on screen. |
| AC-04 | The rate's full derivation renders on the same screen as any figure it produces. |
| AC-05 | `hoursPerPersonPerMonth` is 154. |
| AC-06 | The manual pace label states it means rule checking, not a substantive audit procedure. |
| AC-07 | The sensitivity table shows the four rows from section 4 and names in-house against bought-in as the cause. |
| AC-08 | Q4 FY26 asserts 1,428,000 rows, 340 runs, 8.5 hours, ₹18,400 charged, 7,131 hours saved, 15.4 people, ₹39.2 lakh. |
| AC-09 | `HISTORY_START` is 1 Apr 2025 and financial year to date is offered as a window covering 1 Apr 2025 to 31 Mar 2026. |
| AC-10 | The audit lead view carries the six committee lines recovered from `a726aff`. |
| AC-11 | Every figure on the page and in both exports comes from one `snapshot()` call. |
| AC-12 | No control changes a record the page reports on. The export's audit event is the only write. |
| AC-13 | No benchmark or target appears on any figure. |
| AC-14 | The per person table is alphabetical and cannot be reordered by prop, state or URL. |
| AC-15 | Every chart offers its table in one click, and no chart under `src/components/usage/` uses `ResponsiveContainer`. |
| AC-16 | There is no input field anywhere in the feature. |
| AC-17 | Each view opens with at most three groups expanded and the rest folded. |
| AC-18 | Visible copy carries no em dash and no hyphenated compound. Table cells may use a dash as a blank. |
| AC-19 | `npx tsc -b` reports no errors, `npm run build` is green, and the Playwright suite passes. |

---

## 11. Out of scope

Seat and licence counts. Benchmarks against other companies. Per user cost attribution. Alerts and notifications, because the page reports rather than notifies. Impersonation in any form. Backend telemetry. Any people management action, which stays in Administration. Collecting the customer's own hourly rate, which is an operations process decision and not a build.

---

## 12. Success metrics

The page is solid when a CFO can open it, see what the quarter was worth, click once to see exactly how that number was reached, and disagree with only one input, the rate, which the page has already told them where it came from and how it moves.

At ninety days: the figure survives a renewal conversation without being disputed, and every input behind it except the rate traces to a record in the customer's own tenant.

---

## Open decisions

1. **Does operations start collecting the customer's hourly rate at contract time?** Until it does, ₹550 is a sourced default rather than the customer's own number. This is a process decision, not a build one.
2. **Do our CS and account team read the CFO view, or do they need something of their own?** Taken as the CFO view for now, because the question is identical and this product has no impersonation.
