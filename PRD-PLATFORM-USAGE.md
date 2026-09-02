# PRD — Platform Usage (revamp)

Owner: Nilesh Anand · Surface: System > Platform Usage · Access: `ad_usage` to open, `ad_usage_people` for the per person table · Status: rebuild, replaces the build shipped against `Platform-Usage-Build-Spec_2.pdf`

---

## 1. Problem statement

The page we shipped answers the wrong question, and it answers it with a number we made up.

Today the surface leads with net value: the quarter is worth ₹85.4 lakh. That figure rests on two constants nobody outside this team has ever agreed to, an auditor hour priced at ₹1,200 and a human pace of 200 rows an hour. Neither is recorded anywhere in a customer tenant. We cannot see salaries and we do not hold timesheets, so both are ours.

The page then prints its own sensitivity table and shows how little the headline survives. At 100 rows an hour the same quarter is worth ₹1.7 crore. At 800 it is worth ₹21.4 lakh. That is an eight times swing on one assumption we invented. A figure that moves eight times on our own guess cannot go into a board pack, and an audit lead who notices the swing stops trusting the numbers beside it too.

Three more things are wrong with it.

**The reader does not exist.** The page is built for three people. A CFO does not log into an internal audit tool. The internal auditor's question, what is waiting on me, is a home screen, not an analytics page. One of the three readers has a recurring reason to open this, and the page is not shaped for them.

**It cannot be read.** Thirteen block groups, about twenty five blocks, 9,242 lines of page and data. The reader we do have is a non technical audit lead preparing for a committee, not an analyst with an afternoon.

**It looks generic.** Identical card grids, tile after tile, no reading order. Nothing about the page says which number matters.

What we do have is better than what we built. An internal audit function has a real, dated, repeating job: prepare what the audit committee sees each quarter. The 2024 Global Internal Audit Standards, in force since 9 January 2025, require the chief audit executive to set performance measures and report them to the board. In India, section 138 of the Companies Act 2013 puts the internal auditor's reporting line into that committee. Our product already holds most of the evidence for that pack, and we currently spend the whole surface on a number the committee cannot use.

**So: the page becomes the audit lead's committee preparation surface. Every figure on it is the customer's own record. Money leaves the page.**

Research and sourcing behind this sits in `PLATFORM-USAGE-RESEARCH.md`.

---

## 2. Who it is for, and the one job

One reader. The audit lead.

One job. Be ready for the committee, and know what is slipping before somebody else finds it.

One shape. The quarter and the year to date side by side, because that is how a committee reads it.

The "Viewing as" switch is removed. Scope narrowing survives as a filter, whole company or a team or your own work, still bounded by entitlement and still never sideways into somebody else's team.

---

## 3. Surfaces and scope

| Surface | File | Change |
| --- | --- | --- |
| The page | `src/components/usage/PlatformUsageView.tsx` | rebuilt around one reader and two sections |
| The pack | `src/components/usage/UsagePack.tsx` | new, the six lines |
| Shared kit | `src/components/usage/usageKit.tsx` | keep, the primitives added in the current working tree carry over |
| Coverage blocks | `src/components/usage/UsageCoverageBlocks.tsx` | feed lines 2 and 3, survivors move to section two |
| Finding blocks | `src/components/usage/UsageFindingBlocks.tsx` | feed lines 5 and 6 |
| Operations blocks | `src/components/usage/UsageOperationsBlocks.tsx` | persona blocks removed, the rest move to section two |
| Product blocks | `src/components/usage/UsageProductBlocks.tsx` | move to section two |
| Value blocks | `src/components/usage/UsageValueBlocks.tsx` | gutted, only the contract cost fact survives |
| Committee blocks | `src/components/usage/UsageCommitteeBlocks.tsx` | new in the working tree, folds into the pack |
| Records | `src/data/platform-usage.ts` | history extends back to 1 Apr 2025 |
| Figures | `src/data/platform-usage-metrics.ts` | window model becomes quarter plus financial year to date, persona model removed |
| Exports | `src/components/usage/usageExport.ts`, `usagePdf.ts` | reshaped to the pack, money only in the annual export |
| Tests | `tests/platform-usage.spec.ts` | rewritten against the rules below |

---

## 4. The pack: six lines

The first screen is six lines and nothing else. Each line carries the quarter and the financial year to date, one drill down to the underlying list, and where the figure is an inference rather than a fact it says so on the same screen as the number.

| # | Line | Computed from | Honesty label |
| --- | --- | --- | --- |
| 1 | Plan completion | `EngagementRow.status`, `plannedEnd`, `actualEnd` | The engagement list is treated as the approved annual plan. That is an inference and the block says so. |
| 2 | Coverage | controls exercised over the control library, plus risks where `mapped` is false | Approximates the audit universe, because we do not hold an approved list of auditable entities. Labelled. |
| 3 | Full population against sample | `Population.size` against `SampleValidation.sampleSize` | Fact |
| 4 | Time to detection | `TracedException.occurredAt` to `detectedAt` | Fact |
| 5 | Findings and their age | `severity`, `status`, `dueAt`, `detectedAt` | Fact. Findings raised before the content fingerprint shipped carry none, so they stay out of the ageing bars and are counted apart in a sentence. |
| 6 | Overdue actions | `ActionPlan.dueAt` against `closedAt` | Fact |

Line 3 and line 4 together are continuous monitoring's own value claim, full population instead of sampling and detection in days instead of weeks. They are the two figures on this page that no competitor prints from real records, and they replace the invented rupee as the argument the page makes.

---

## 5. Section two: what the platform did

Everything else survives, below the pack, closed by default, each opening to its own drill down.

Work volume · runs and reliability · what is stuck · sampling outcomes · continuous monitoring · exceptions caught · AI insights · engagement portfolio · reports made · dashboards and alerts · what it cost under the contract · Smart Learn.

Nothing in this list is deleted. The change is that the first screen no longer competes with it.

"What is stuck" stays here rather than moving to the Workflow Library. The research argued for moving it. There is no block in the Workflow Library to move it to, so moving it would mean deleting a working feature.

---

## 6. What leaves the page

| Leaves | Where it goes |
| --- | --- |
| Net value hero | Nowhere. It cannot survive its own sensitivity table. |
| ₹85.4 lakh saved, and every rupee of saving | The annual renewal export, and only when a rate exists |
| Sensitivity block | Nowhere. It exists to warn about a figure we are removing. |
| Cost of an auditor hour, ₹1,200 | Removed as a page assumption. Supplied by the customer's finance team through our operations team at contract time, for the export only. |
| Rows checked by hand in an hour, 200 | Removed as a page assumption. Survives inside the hours saved figure with its label. |
| "Viewing as" switch and the CFO and auditor personas | Removed. Scope filter survives. |

Contract cost stays. The ₹18,400 the customer was charged this quarter is a term of the contract and a recorded fact, not an estimate. It sits in section two under what it cost. What leaves is the saving, not the price.

The annual export prints hours and coverage and, when no rate has been supplied, no rupees at all. Net value minus an unknown is not net value.

---

## 7. Data layer

The seed is a fixed seed, no `Date.now()` and no `Math.random()`, and that does not change.

| Constant | Now | Becomes | Why |
| --- | --- | --- | --- |
| `HISTORY_START` | 1 Jul 2025 | 1 Apr 2025 | The Indian financial year starts on 1 April. The anchor at 31 Mar 2026 is then a financial year end, so the quarter is Q4 FY26 and the year to date is a full twelve months. |
| `ANCHOR` | 31 Mar 2026 | unchanged | |
| Window model | `this-month`, `this-quarter`, `this-year`, `since-start`, `custom` | `quarter` and `fy-ytd`, read side by side | A committee reads the quarter against the year to date. Today `this-year` resolves to 1 Jan 2026, which is the same window as the quarter, so the two columns would print identical numbers. |

The worked example must not move. Eleven populations still sum to exactly 1,428,000 rows in Jan to Mar 2026, 340 successful runs still land in that window, their durations still sum to exactly 8.5 hours, and the seeded lookup volumes still multiply out against the contract to exactly ₹18,400.

Extending history backwards touches one rule that needs re checking rather than assuming: coverage credits a population to the window that first tested it. Three more months of history moves some of those first tests earlier. The quarter's own coverage headline must still reconcile, and if it cannot, the reconciliation is the bug, not the test.

---

## 8. UI rules

Carried over from the current build because they are the good part.

- One number, one definition. Every figure is computed once in `snapshot()` and the page and both exports read it.
- The page reads and never writes. No approve, no reject, no resolve. Every route off it ends at the screen that owns the action.
- Nothing presented as fact that is not recorded. A measured number states its source and its sample. An inferred one carries its label on the same screen.
- Empties are honest. Nothing happened and we do not measure this are different facts and never share a rendering.
- Splits add up to their head. A reader who does the subtraction and comes up short stops believing the page.
- Every chart has a table one click away, and the block owns that toggle.
- Every count opens its list, with a name, a maker and a date. A row with no person behind it says automatic.
- No ranking, ever. The per person table is alphabetical and no code path reorders it.
- No benchmark and no target, anywhere, on any figure.

New, and the answer to the page looking generic.

- Type and hairlines carry the hierarchy. No side stripes, no hero metric tiles, no identical card grids, no filled tiles.
- Charts use `ChartAutoSizer`. Recharts `ResponsiveContainer` renders blank at this version and must not come back.
- Inter throughout.
- No dashes in visible copy. Plain sentences.
- The six lines of the pack are a reading order, not a grid. Somebody who reads only the six sentences understands the quarter.

---

## 9. QA and UAT

**Positive**

1. Open the page as a user holding `ad_usage`. The header states the reader, the scope, the quarter with its dates, the year to date, and the counted to date.
2. The first screen shows six lines, each with a quarter figure and a year to date figure.
3. Each of the six opens a list with names and dates.
4. Section two is present, closed, and every block in it opens.
5. Q4 FY26 reconciles to the worked example: 1,428,000 rows, 340 successful runs, 8.5 hours of machine time, ₹18,400 charged.
6. The year to date column covers 1 Apr 2025 to 31 Mar 2026 and differs from the quarter on every line that has history behind it.
7. CSV and PDF exports carry the scope, both windows, the honesty labels and the coverage note.
8. The annual export with no rate supplied prints hours and coverage and no rupee figure anywhere.

**Negative**

9. No rupee saving appears anywhere on the page, in any block, at any scope.
10. No sensitivity table, no net value hero, no auditor hour rate on the page.
11. No "Viewing as" switch. A user without `ad_usage_people` sees the page without the per person table, not an empty page.
12. No control on the page mutates anything. No approve, reject or resolve.
13. No benchmark, target, percentile or comparison against another company on any figure.
14. A quiet window shows a designed zero. An unmeasured thing shows the dashed unmeasured state. They never render the same.

**Edge**

15. A line whose records are entirely absent renders its unmeasured state rather than a zero.
16. A population first tested before 1 Apr 2025 is credited once and never double counted into the year to date.
17. Scope narrowed to a team never exposes another team's rows.

---

## 10. Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-01 | The page has exactly one reader. No persona switch exists in the DOM or the module. |
| AC-02 | The first screen renders six lines, in the order given in section 4. |
| AC-03 | Every one of the six lines shows a quarter figure and a financial year to date figure. |
| AC-04 | Lines 1 and 2 print their inference label on the same screen as the figure. |
| AC-05 | Every one of the six lines opens a drill down list carrying a name, a maker and a date. |
| AC-06 | No rupee figure representing a saving appears anywhere on the page. |
| AC-07 | Contract cost appears in section two, labelled as a contract term, not as a saving. |
| AC-08 | `HISTORY_START` is 1 Apr 2025 and `ANCHOR` is unchanged. |
| AC-09 | Q4 FY26 still reconciles to 1,428,000 rows, 340 runs, 8.5 hours and ₹18,400. |
| AC-10 | The financial year to date window is 1 Apr 2025 to 31 Mar 2026. |
| AC-11 | Every figure on the page and in both exports comes from one `snapshot()` call. |
| AC-12 | No control on the page performs a write. |
| AC-13 | Section two contains all twelve blocks named in section 5, closed by default. |
| AC-14 | No benchmark or target appears on any figure. |
| AC-15 | The per person table is alphabetical and cannot be reordered by prop, state or URL. |
| AC-16 | Every chart offers its table in one click, and no chart uses `ResponsiveContainer`. |
| AC-17 | CSV and PDF carry the scope, both windows, the honesty labels and the coverage note. |
| AC-18 | The annual export prints no rupee figure when no rate has been supplied. |
| AC-19 | Visible copy contains no dashes and no analytics jargon. |
| AC-20 | `npx tsc -b` reports no new errors, and the Playwright suite passes. |

---

## 11. Out of scope

Seat and licence counts. Benchmarks against other companies. Per user cost attribution. Alerts and notifications, because the page reports rather than notifies. Impersonation in any form. Backend telemetry. Any people management action, which stays in Administration.

---

## 12. Success metrics

The page is solid when an audit lead can open it three days before a committee meeting, read six sentences, and know both what to present and what is slipping, without opening a second screen and without needing anybody to explain where a number came from.

Concretely, at ninety days: the audit lead role opens this surface at least once per quarter per tenant, the six lines compute without nulls on three real tenants, and no figure on it is one we invented.
