# Platform Usage: research, truth, and how each claim gets validated

Status: **hypothesis, not a decision.** Everything here is grounded in two things I could check,
the profession's own reporting standards and our own recorded data. Zero customer interviews have
happened. Section 6 is the test plan that would turn this into a decision.

The question this answers: what should this surface be, given that the current build answers "is
this paying for itself" with an hourly rate we invented.

---

## 1. What is wrong with the thing we built

The current page prices audit work at ₹1,200 an hour and 200 rows an hour. Both numbers are ours.
The page itself prints the swing: at 100 rows an hour the same quarter is worth ₹1.7 cr, at 800 it
is ₹21.4 lakh. A figure that moves eight times on one assumption cannot go in a board pack.

The profession agrees. The pushback on hours-saved as a headline is explicit in the practitioner
literature: measure audit quality, insight, defensibility and earlier risk visibility, not hours on
a slide ([Inside Public Accounting](https://insidepublicaccounting.com/2025/12/18/perspectives-from-the-profession-tech-alone-wont-deliver-roi-methodology-is-the-missing-link/),
[Vero AI](https://www.vero-ai.com/blog/audit-automation-roi-business-case)).

Second problem: the three personas. A CFO does not log into an internal audit tool. The auditor's
"what is waiting on me" is a home screen, not an analytics page. Only one of the three readers has a
recurring reason to open this.

---

## 2. Research: what an internal audit function actually reports

**The recurring artifact is the audit committee pack, not a usage dashboard.**

| Finding | Source |
| --- | --- |
| The 2024 Global Internal Audit Standards took effect 9 Jan 2025 and require the chief audit executive to set performance measures and report them to the board as part of the quality programme | [IIA](https://www.theiia.org/en/standards/2024-standards/global-internal-audit-standards/), [RSM](https://rsmus.com/insights/services/risk-fraud-cybersecurity/iia-issues-2024-global-internal-audit-standards-to-guide-future.html) |
| KPIs group into four families: coverage (plan completion, universe coverage), effectiveness (findings, overdue recommendations), efficiency (cycle time, cost per audit), stakeholder value (satisfaction) | [Wolters Kluwer](https://www.wolterskluwer.com/en/expert-insights/internal-audit-performance-measures-aligning-metrics-with-strategy), [Audithink](https://audithink.com/en/article/internal-audit-kpis/) |
| Mature functions target 80 to 95 percent annual plan completion, and under 15 percent overdue recommendations | [Umbrex](https://umbrex.com/resources/company-analysis/risk-management-internal-audit/audit-plan-completion-rate/), [CA Monk](https://blog.camonk.com/internal-audit-kpis-performance-metrics/) |
| The committee is shown the quarter and the year to date together | [Umbrex](https://umbrex.com/resources/company-analysis/risk-management-internal-audit/audit-plan-completion-rate/) |
| In India, section 138 of the Companies Act 2013 requires an internal auditor for prescribed companies, and the audit committee formulates the scope, periodicity and methodology, with the internal auditor reporting to that committee | [CAIRR](https://ca2013.com/138-internal-audit/), [TaxGuru](https://taxguru.in/company-law/internal-audit-companies-act-2013.html) |
| Continuous monitoring's own value language is full population instead of sampling, and time to detection falling from weeks to near real time | [MetricStream](https://www.metricstream.com/learn/what-is-continuous-control-monitoring-ccm.html), [ISACA](https://www.isaca.org/resources/isaca-journal/issues/2015/volume-2/a-practical-approach-to-continuous-control-monitoring) |
| Value realisation surfaces should carry three to five outcomes and be exportable and shareable, and decks fail when they lead with features rather than outcomes | [Gainsight](https://www.gainsight.com/essential-guide/quarterly-business-reviews-qbrs/), [Tosea](https://tosea.ai/blog/qbr-deck-complete-guide-2026) |

**What this adds up to.** The audit lead has a real, dated, repeating job: prepare what the audit
committee sees each quarter. Our product holds most of the evidence for that pack and currently
spends its reporting surface on a number the committee cannot use. The renewal case is a byproduct
of that pack once a year, and it belongs in an export.

---

## 3. Truth: what our product actually records

Every proposed figure below has to land on a field that exists. This is the inventory, from
`src/data/platform-usage.ts`.

| Entity | Fields that matter | Line |
| --- | --- | --- |
| Engagement | `status`, `type`, `plannedEnd`, `actualEnd`, `auditPeriodEnd`, `reportState`, `owner`, `reviewer`, `controlsInSnapshot` | 1187 |
| Exception | `severity`, `status`, `occurredAt`, `detectedAt`, `dueAt`, `resolvedAt`, `classification`, `rootCause`, `fingerprint` | 862 |
| Action plan | `exceptionId`, `openedAt`, `dueAt`, `closedAt`, `owner` | 1385 |
| Population | `size`, `controlId`, `engagementId`, `cadence` | 184 |
| Run | `status`, `rowsProcessed`, `startedAt`, `completedAt`, `errorText`, `scheduled` | 229 |
| Sample validation | `sampleSize`, `outcome`, `controlId` | 817 |
| Risk | `priority`, `mapped`, `owner` | 1153 |
| Continuous monitoring | `thresholdPct`, `alertsOn`, `approvalLevels` | 1247 |

**What is not recorded, so cannot be claimed.**

| Missing | Consequence |
| --- | --- |
| The audit universe as an approved list of auditable entities | Universe coverage can only be approximated by the control library, and must say so |
| The approved annual audit plan as its own artifact | Plan completion assumes the engagement list is the plan. That is an inference, not a fact |
| Timesheets | No real auditor hours anywhere, only the calibration sample in `ManualReview` (line 1469) |
| Salaries | Money on this page can never be the customer's own number |
| Stakeholder satisfaction | A standard KPI family we cannot serve at all |
| Logins and per-user adoption | Deliberately not built. So today the page is neither a usage page nor a value page |

---

## 4. What it should be

**One reader.** The audit lead. **One job.** Be ready for the committee, and know what is slipping
before somebody else finds it. **One shape.** Quarter and year to date side by side, because that
is how the committee reads it.

Six lines. Each one maps to a recorded field, and each is the customer's own fact.

| Line | Computed from | Why it earns its place |
| --- | --- | --- |
| Plan completion, quarter and YTD | `EngagementRow.status`, `plannedEnd`, `actualEnd` | The first number in every audit committee pack |
| Coverage | controls exercised over the library, plus risks where `mapped` is false | Universe coverage, honestly approximated and labelled as such |
| Full population against sample | `Population.size` against `SampleValidation.sampleSize` | This is continuous monitoring's own value claim, and we can prove it from records |
| Time to detection | `occurredAt` to `detectedAt` | The other half of that claim, and nothing else in the market prints it from real data |
| Findings and their age | `severity`, `status`, `dueAt`, `detectedAt` | What the committee asks about second |
| Overdue actions | `ActionPlan.dueAt` against `closedAt` | The single metric a committee chases, and we hold the whole record |

**What leaves the page.**

- Money leaves the page. It survives as one annual export where the rate is supplied by the
  customer's finance team through our operations team at contract time. With no rate, the export
  prints hours and coverage and no rupees at all.
- The auditor persona leaves. "What is waiting on me" belongs on Home.
- Stuck runs and reliability leave, into the Workflow Library where the fix happens.
- Benchmarks stay out, as they already are. The literature's 80 to 95 percent and under 15 percent
  are useful to us for judging whether a line is worth showing. They are not printed to a customer.

---

## 5. Every claim, and how it gets validated

Labels: **Fact** is in our records or in a cited source. **Inference** is drawn from those.
**Assumption** is neither, and is the reason to run section 6.

| # | Claim | Type | Validated by | What would falsify it | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Hours-saved-as-headline is contested in the profession | Fact | Two practitioner sources cited in section 2 | A named CFO accepting an ROI built on a vendor's own rate | Validated |
| 2 | The CAE must set and report performance measures | Fact | GIAS 2024, effective 9 Jan 2025 | Nothing, it is the standard | Validated |
| 3 | The audit committee is the recurring audience, quarterly | Fact for India by statute, inference for cadence | s.138 and s.177 for the reporting line; cadence needs interviews | Customers reporting monthly, or the pack being made by someone outside the tool | Needs test 6.1 |
| 4 | Our records can produce all six lines | Fact | Field inventory in section 3, plus test 6.3 which computes each line on the seed | Any line coming out null or unstable on real data | Needs test 6.3 |
| 5 | The engagement list equals the approved annual plan | **Inference** | Ask five audit leads to compare their approved plan against the engagement list in their tenant | Plans held in a spreadsheet outside the product, which would make plan completion unbuildable today | Needs test 6.1 |
| 6 | The audit lead, not the CFO, opens this | Assumption | Interviews, plus the admin log's own view events once we can read them | CFO logins appearing in the log at any real frequency | Needs test 6.1 and 6.4 |
| 7 | These six lines are what packs actually contain | Assumption | Read the last three committee packs from three customers and count how many of the six appear | A line appearing in fewer than three of five packs gets cut | Needs test 6.2 |
| 8 | Time to detection is a claim customers care about | Assumption | Interviews, and whether it already appears in their packs | Audit leads calling it a vendor metric | Needs 6.1 and 6.2 |
| 9 | Money can leave the in-product page without losing the renewal conversation | Assumption | Ask the three account owners what the last three renewals actually turned on | Renewals that turned on a rupee figure we supplied | Needs test 6.5 |

**Build-level validation, which is already the standard here and does not change.** One
`snapshot()` computes each figure once and the page and both exports read it. Every figure must be
re-derivable from the records. Every assumed number carries its label and its source on the same
screen. Tests assert the rules rather than the pixels. That discipline is the good part of the
current build and it carries over whole.

---

## 6. What I would run, in order, before writing a line of code

| # | Test | Method | Decision it settles |
| --- | --- | --- | --- |
| 6.1 | Five interviews with audit leads | 30 minutes each. Who prepares the committee pack, on what cadence, from what, what takes longest, what gets asked in the room | Claims 3, 5, 6, 8. If the plan lives outside the product, the whole page changes shape |
| 6.2 | Pack teardown | Collect the last three committee packs from three customers. Count every distinct metric. Rank by frequency | Claim 7. Ship only the lines present in three of five packs, cut the rest whatever I think of them |
| 6.3 | Data feasibility on real tenants | Compute all six lines against three real tenants, not the seed. Check for nulls, zeroes and instability | Claim 4. A line that cannot be computed on real data does not ship |
| 6.4 | Read the admin log | Count who actually opened Platform Usage in the last 90 days, by role | Claim 6, with evidence instead of opinion |
| 6.5 | Three renewal post mortems | Ask the account owners what the last three renewals turned on | Claim 9, and whether the annual export is worth building at all |

**The gate.** A line ships only when it is present in three of five packs (6.2) **and** computes
cleanly on three tenants (6.3). Everything else waits, whatever the spec PDF says.

---

## 7. What this costs us to change

The current build is not wasted. The record layer, the one snapshot rule, the honest empty states,
the no-ranking rule, the drill-down on every count and the test suite all carry over. What changes
is the question at the top of the page, who it is for, and about half the blocks.

The part that is genuinely gone is the CFO persona and the rupee hero, and that is the part that
cannot survive its own sensitivity table.
