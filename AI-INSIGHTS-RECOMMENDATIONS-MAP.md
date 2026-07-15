# AI Insights & Recommendations across the Product
### Irame / Auditify: from "insights on three surfaces" to intelligence across the whole audit journey

**Author:** Product · **Date:** July 2026 · **Version:** 1.0 · **Companion to:** AI-INSIGHTS-METRICS.md

*A brainstorm map. It walks the audit journey and, at every surface, names the pain points (with a concrete example) and the insight and/or recommendation that closes each one. Reviewed against audit methodology so nothing here would fail an EQR or hand a regulator a finding.*

---

## 1. Two things the platform produces

Today the engine surfaces **insights** on three surfaces (Workflow Executor, the Business Process AI Insights tab, the Engagement rollup). That is half the job. The other half is telling the auditor what to do next before the file is frozen, the sample is drawn, or the opinion is signed.

- **INSIGHT.** The platform noticed a pattern in what already happened. Backward looking. *"MCKESSON drove 78% of this run's exceptions across three workflows, and was never once cleared."*
- **RECOMMENDATION.** The platform proactively proposes the next best action or a better way to work. Forward looking. *"You have not tested AP-07 in two quarters, schedule it,"* or *"this control failed at interim and was redesigned in November, so interim reliance is void, re-test the stub period."*

A recommendation is not a separate object. It is the same insight object read forward: an insight's baseline is a historical expectation and the news is that it broke; a recommendation's baseline is a target or standard (the sampling table, the firm template, the milestone date, the prior-year scope) and the news is the gap to it. Both carry the same fields the metrics doc already defines: baseline, cause, priced consequence, three-axis confidence, action window, death condition, human gate.

---

## 2. Guardrails (the audit non-negotiables)

Every item below obeys these, because an intelligence layer that pushes an auditor toward a non-defensible action is worse than none.

1. **The human verdict is the audit evidence. The AI verdict is a preparer aid, never a conclusion.** An AI Pass read off a signature block is "information produced by a system" and must have its own logic validated before anyone relies on it, the same completeness-and-accuracy discipline applied to client reports. The platform proposes, the auditor concludes and signs.
2. **"The tool said so" is never a workpaper rationale.** Every accepted recommendation produces an auditor-owned rationale the auditor signs. The workpaper records professional judgment, not a tool citation.
3. **Every hard block has a documented-override path.** A recommendation may stop a transition ("population does not tie out"), but the auditor can always proceed with a signed reason. The platform never overrides judgment, it forces it to be documented.
4. **Control sample sizes are driven by frequency and required assurance, with an uplift for known prior deviations, not by population size.** Population growth is a risk-reassessment signal, not a sample-size input. (Population and monetary size drive substantive MUS sampling, a different path.)
5. **Deficiency severity is a judgment on likelihood and magnitude, evaluated with compensating controls. There is no bright-line dollar threshold.** The platform surfaces aggregated magnitude and prompts the human. It never auto-labels "significant deficiency" or "material weakness."
6. **Materiality includes qualitative factors.** Fraud, management override, related-party, regulatory, and sensitive-account items are often dollar-small and highly material. The materiality floor and any re-rank must protect them, never demote them on dollars alone. (The $3.75 chargeback that should have been $27.75 is the point.)
7. **Firm economics are walled off from the engagement.** Realization, budget, and utilization insights (the Firm layer) are for practice management only and never feed an engagement's scope, sample extent, or conclusion. Fee pressure driving under-auditing is a named inspection theme.
8. **Fraud-shaped items describe observable facts, not intent.** The platform says "four POs just under the limit, same buyer, eight days." The human characterizes whether it is structuring.

Two structural notes carried throughout. Several of the strongest opportunities fire **upstream of any run** (planning) or **above the process** (portfolio, firm), so they are new detectors that trigger at plan-create, plan-freeze, register-validate, population-lock, or period close, not after a workflow run. And any **trend** claim needs two or more consecutive real periods before it draws a line; a single move is at most an Emerging Trend, labelled directional.

---

## 3. The spine: the audit lifecycle

**Plan → Test → Exceptions & Remediate → Monitor → Report → (Firm layer)**

Each block reads: pain point with a concrete example, then the insight and/or recommendation, then a tag line `Type · Pattern · Impact`.

---

## Stage 1. PLAN
### Risk assessment, scoping, sampling, RACM, resourcing

*Surfaces: Engagement Library and Portfolio Overview, Create Engagement Wizard, RACM tab (upload and validate), Audit Planning.*

Planning is where audit quality is bought or lost, and it is the one stage the app treats as pure data entry: every field typed by hand, no memory of last year, validated only for "is it filled in," never "is it right."

**[P1] A risky area silently drops out of the plan year over year**
- **Pain:** *Last FY a standalone "Vendor Master / P2P" review raised two significant deficiencies. This year the manager who ran it left, so there is no vendor-master coverage in the plan, and nobody notices until the audit committee asks why vendor onboarding was not looked at.*
- **Recommendation:** At plan lock, diff this year's scoped processes against the prior-year plan and against where issues actually arose. *"P2P vendor-master was in scope last year and raised 2 significant deficiencies. It is not in this year's plan. Add it, or record a signed descoping rationale."*
- `Type: recommendation · Pattern: new (Coverage Gap, plan vs prior year) · Impact: high`

**[P2] Risk ratings and materiality set by rote, un-evidenced and inconsistent across sibling files**
- **Pain:** *R2R carries a hardcoded risk score of 90 but had zero deficiencies for two years, while O2C is 72 though its close-reconciliation control failed twice last year. Separately, the P2P SOX file uses materiality of INR 2.5m and the P2P IFC file on the same entity uses INR 5.0m, because two preparers typed two numbers.*
- **Insight and Recommendation:** Suggest a **risk-of-material-misstatement** view that keeps inherent-risk drivers (susceptibility, complexity, volume, estimation) separate from control-risk drivers (prior-year deficiencies, failure rate), so the platform never mislabels one as the other. Offer materiality as a **benchmark the engagement leader accepts** (a percentage of revenue or PBT), never an auto-set number, and flag sibling inconsistency: *"Two P2P files on one entity carry different materiality. Reconcile or document why."* (Internal Audit uses risk-based significance, not FS materiality.)
- `Type: both · Pattern: Cohort Anomaly + Memory Conflict on a governed materiality basis · Impact: high`

**[P3] Sample size set by rote, blind to control frequency and prior results**
- **Pain:** *A daily control gets the default 25. A control that deviated last year gets the same 25 as one clean for three years. Under any attribute-sampling table, a flat 25 with no link to frequency or prior outcome is indefensible at EQR.*
- **Recommendation:** Propose a size from **frequency and required assurance, uplifted for a prior-year deviation**, and show the basis. *"Daily control, 1 exception last year: raise assurance, suggested 40, not 25."* Flag over-auditing too (a low-risk annual control scoped at 40). Population growth is surfaced separately as a **risk-reassessment** prompt (*"invoice volume tripled, re-confirm this is the same control and re-assess its risk"*), not as a reason to change the sample count.
- `Type: recommendation · Pattern: new (Sample Adequacy) · Impact: med`

**[P4] A control that failed last year is quietly dropped or under-scoped this year**
- **Pain:** *Last year the AP three-way-match control concluded Ineffective and drove a significant deficiency. This year it was reclassified Non-Key in a RACM tidy-up, so the "key controls only" toggle drops it out of scope entirely. A control that failed twelve months ago is now not tested at all, the worst look in a PCAOB inspection.*
- **Insight and Recommendation:** Roll last year's conclusions into scoping. Any control with a prior-year adverse conclusion that is missing, downgraded, or sampled lighter is flagged before freeze: *"AP three-way-match was Ineffective last year and is now excluded by 'key controls only.' Re-include or capture a documented reason."*
- `Type: both · Pattern: Recurring Output Anomaly (across periods) + User Override Pattern · Impact: high`

**[P5] Computed RACM gaps sit as passive badges instead of blocking findings**
- **Pain:** *The RACM engine already computes unmapped risks, workflow coverage, attribute coverage, and key-control presence, and the data is full of real holes: the R2R RACM has a "GL balance discrepancy" risk with zero mapped controls, O2C sits at 75% attribute coverage. But they surface only as a quiet amber chip, so a reviewer scanning a table never registers that one revenue risk has no control at all.*
- **Insight and Recommendation:** Promote each computed gap to a named, ranked, blocking finding with the object attached. *"R2R RACM: risk 'GL balance discrepancy' has no mapped control. Map one or accept with sign-off before freeze."* Fully deterministic, the data already exists.
- `Type: both · Pattern: new (RACM Completeness) · Impact: high`

**[P6] A stale RACM version is linked at creation and passes validation**
- **Pain:** *The S2C Contract Review engagement is bound to RACM v1.8 while every sibling uses v2.1. v1.8 predates two control redesigns, so the file tests a control set that no longer reflects the process, and nobody sees it because "a RACM is linked" passes validation.*
- **Recommendation:** Compare the chosen version to the latest validated version and warn, with a one-click diff. *"You linked v1.8. Current validated version is v2.1, which added 3 controls and retired 2. Link v2.1 or record why."*
- `Type: recommendation · Pattern: Schema Decay + Memory Conflict · Impact: med`

**[P7] Outsourced-process reliance runs on a SOC 1 that does not fit the period**
- **Pain:** *Payroll is outsourced. Reliance runs through the service organization's SOC 1, but it covers Jan to Sep against a December year-end, and two complementary user-entity controls (CUECs) are never mapped to the client's own controls. The three-month gap needs a bridge letter and the CUECs need testing, and none of this is visible at planning.*
- **Recommendation:** A SOC 1 fitness check at Plan. *"Payroll SOC 1 covers Jan to Sep, period ends 31-Dec: 3-month gap needs a bridge letter. 2 CUECs are unmapped to your controls. Resolve before relying on the service org."*
- `Type: recommendation · Pattern: new (Service-Org Reliance) · Impact: med`

*Also worth building at Plan:* key-control mislabelling (a Non-Key control that is the sole mitigation of a Critical risk); dedup on RACM/SOP import (match extracted controls to the library so a 40-row upload is a short review of exceptions); capacity overrun (sum committed hours per person across overlapping windows against capacity, so "1,020 hours booked against 120 available" is a foresight warning, not a post-hoc badge); and independence / SoD checks on assignment (a preparer testing an area they operated last year).

---

## Stage 2. TEST
### Control testing and evidence

*Surfaces: Execution V2 state machine (NOT_STARTED through CONCLUDED), Request PBC, Evidence tab, Attribute Testing (AUTO vs MANUAL verdicts), Working Paper, Review, Conclusion.*

This stretch is where the file survives EQR or does not. Governing rule for the whole stage (Guardrail 1): **the human verdict is the evidence, the AI verdict is an aid, and the tool's verdict logic must be validated before reliance.**

**[T1] PBC chasing is manual, so slippage is found the afternoon before the deadline**
- **Pain:** *PBC-002 for the AP three-way-match control was sent 12 days ago, due 15-Feb, still shows 0 of 2 attachments, and blocks three controls whose fieldwork is due 20-Feb. Nobody connects the late item to the downstream deadline until it is too late.*
- **Recommendation:** Dependency-aware PBC aging. *"PBC-002 is 12 days open, 0 of 2 received, blocks 3 controls due in 4 days. This owner ran a median 6 days late over two quarters. Escalate now and pull the dependent controls forward."*
- `Type: recommendation · Pattern: Workflow Efficiency Gap · Impact: high`

**[T2] Wrong-period, unsigned, or wrong-document evidence is caught weeks late**
- **Pain:** *For a 31-Dec period end, the owner uploads a bank reconciliation dated 30-Nov, unsigned, and attaches a GL detail extract when the required evidence was the approval screenshot. The tester finds the defect only on opening the file to test attribute 3, and the re-chase restarts the PBC clock.*
- **Recommendation:** An evidence-fitness check at upload, against required evidence type, audit period, and a signature scan. *"Reconciliation dated 30-Nov, period ends 31-Dec, appears out of period. No approver signature detected. File type does not match the required evidence. Do not accept as complete"* (override with a signed reason).
- `Type: recommendation · Pattern: new (Evidence Fitness gate) · Impact: high`

**[T3] The sample is drawn before anyone proves the population is complete ★**
- **Pain:** *The disbursements population loaded for sampling is 4,180 rows totalling USD 88.2m, but the AP subledger control total is USD 92.7m. The USD 4.5m and ~213 missing rows mean the sample was selected from an incomplete base, and no amount of clean attribute testing fixes it. This is the first question a peer reviewer or inspector asks.*
- **Recommendation:** Block the population lock until it ties to a control total. The engine already snapshots row count and a checksum. *"Sampled population USD 88.2m does not tie to the subledger USD 92.7m. Difference USD 4.5m / 213 rows unexplained. Reconcile before locking POPULATION_READY"* (override with a signed reason).
- `Type: recommendation · Pattern: new (Population Completeness) · Impact: high`

**[T4] Sampling method is picked out of habit, not matched to the control's nature**
- **Pain:** *A fully automated daily three-way-match control is tested with a random sample of 25, when an automated control warrants test-of-one plus reliance on the supporting ITGCs. Meanwhile AP-07, a manual monthly review with a population of only 12 occurrences, is set to a sample of 25, which is impossible.*
- **Recommendation:** A method check tied to the control's nature and frequency. *"Automated daily control: test one instance plus confirm ITGC reliance, not a 25-item deviation sample,"* and *"AP-07 population is 12, a sample of 25 cannot be drawn, size to the occurrences."*
- `Type: recommendation · Pattern: new (Sampling Adequacy) · Impact: med`

**[T5] AI-verdict vs human-verdict disagreement is buried per row, so a systematic AI blind spot goes unseen ★**
- **Pain:** *On "independent approval evidenced," the AI marked eight samples PASS by reading a signature block, but the human failed all eight because the approver was the same person who raised the PO, a segregation-of-duties breach the OCR cannot see. Eight one-directional disagreements on one attribute means the automated verdict is unreliable for SoD, and no one looks at it in aggregate.*
- **Insight:** Surface AI-vs-human divergence as a pattern, not a footnote. *"AI and human disagree on 8 of 40 samples for 'independent approval,' all one direction (AI PASS, human FAIL). The AI is not detecting self-approval. Route to manual and revalidate the AI verdict logic before relying on it elsewhere."* This directly governs how far the AI verdict can be trusted anywhere in the file.
- `Type: insight · Pattern: User Override Pattern + Cohort Anomaly (tester as cohort) · Impact: high`

**[T6] A control is concluded Effective on evidence that does not support it ★**
- **Pain:** *AP-09 is concluded Effective off a 25-item sample with 2 fails. At n=25 the tolerable number of deviations is 0; even one requires evaluation, two is a fail. Both fails were sub-USD 5k POs from the same buying desk skipping the GRN step, which looks systematic, not random.*
- **Recommendation:** A conclusion-support check against the sample plan and the nature of the exceptions. *"2 deviations at n=25 exceeds tolerable (0). This does not support an Effective conclusion, evaluate as a deviation and consider whether it is a control failure. The two exceptions share a cause (Desk B skipping GRN), which points to a design gap to investigate."* Note: sample extension is only valid under defined conditions and can never be used to dilute a deviation rate to reach Effective; targeted expansion on the failing slice is not a basis to re-conclude on the population.
- `Type: recommendation · Pattern: new (Conclusion Support) + Recurring Output Anomaly · Impact: high`

**[T7] A control relies on a system report whose completeness and accuracy was never tested (IPE) ★**
- **Pain:** *The duplicate-invoice control relies on an exception report the client's ERP generates. The tester ticks the control as operating without ever testing the report's query logic, parameters, or date range. If the report silently excludes a plant or a date window, the control conclusion rests on incomplete information and is unsupported, one of the most common PCAOB inspection themes.*
- **Recommendation:** An IPE flag wherever a control relies on a system-generated report. *"PC-07 relies on the duplicate-invoice exception report. Its completeness and accuracy (query, parameters, date range) has no test evidence. Establish IPE C&A before concluding."*
- `Type: recommendation · Pattern: new (IPE Reliability) · Impact: high`

**[T8] A deficiency is concluded without considering the compensating control ★**
- **Pain:** *The AP three-way-match automated control failed. But a monthly manual GRN-to-invoice reconciliation covers the same completeness assertion and operated all year. Concluding a standalone deficiency without evaluating the compensating control overstates the finding, and ignoring one that does not actually cover the same failure mode understates it. Either way the evaluation is wrong.*
- **Recommendation:** When a control fails, surface controls over the same assertion for the auditor to evaluate as compensating. *"AP three-way-match failed. A monthly manual GRN reconciliation covers the same completeness assertion, evaluate whether it compensates (same failure mode, precise enough, operated all period) before grading the deficiency."* The platform surfaces the candidate; the auditor judges.
- `Type: recommendation · Pattern: new (Compensating-Control link) · Impact: high`

**[T9] Interim reliance is carried to year-end on a control that changed**
- **Pain:** *AP-05 concluded Effective at interim through 30-Sep. It was redesigned on 15-Nov. Carrying the interim conclusion to year-end voids the reliance, because the control tested is no longer the control operating, and the stub period is uncovered.*
- **Recommendation:** A rollforward-integrity check. *"AP-05 changed on 15-Nov after its interim conclusion. Interim reliance is void, re-test the redesigned control for the 01-Oct to 31-Dec stub period."* A clean unchanged control gets the lighter guidance instead (test 8 to 10 samples over the stub).
- `Type: recommendation · Pattern: new (Rollforward Integrity) + Schema Decay · Impact: high`

*Also worth building at Test:* a throughput and readiness gate (6 key controls stalled over 7 days in EVIDENCE_IN_PROGRESS, forecast 5 days past deadline; refuse a "Testing Complete" transition while 4 samples are PENDING); a working-paper review-readiness score before PENDING_REVIEW (missing population-to-GL reconciliation, basis of selection, tickmark legend, management response); and reviewer-note theme mining ("evidence out of period" on 9 workpapers, 7 from two preparers, a coaching signal).

---

## Stage 3. EXCEPTIONS & REMEDIATE
### Triage, classify, aggregate, report, track, close

*Surfaces: Exception / Case Management, Observations and Deficiency Aggregation, ATR generation, Action Tracker, Action Trail.*

This is where the audit conclusion is actually written, today one row at a time with no memory across workflows, periods, or controls.

**[X1] The same root cause is triaged as dozens of separate rows ★**
- **Pain:** *The chargeback run emits 70 MCKESSON pricing exceptions as 70 rows. Contract Compliance flagged 8 more MCKESSON "contract price not found" and Duplicate Payment flagged 3, all the same vendor. The owner classifies all 81 one by one and hand-writes 81 near-identical action plans. The real story, one broken MCKESSON pricing-master feed, lands in the ATR as 81 fragments and its aggregate exposure is never totalled.*
- **Recommendation:** Cluster on the resolved root entity across workflows into one actionable and one observation. *"These 81 exceptions across 3 workflows share one root: the MCKESSON pricing-master feed. Group into one action, aggregate exposure USD X."* One click groups them and seeds one action plan.
- `Type: recommendation · Pattern: Cross-Workflow Correlation + Cohort Anomaly · Impact: high`

**[X2] Identical exceptions get opposite dispositions under backlog pressure ★**
- **Pain:** *Under a 90-case backlog, the owner marks 40 of the 70 MCKESSON exceptions False Positive (auto-close) while classifying the other 30 identical-signature rows as System Deficiency. Same fact pattern, opposite disposition, and 40 material underpayments quietly leave the deficiency population. At EQR nobody can explain why identical rows were split.*
- **Insight:** Flag classification inconsistency on a shared signature. *"40 exceptions sharing the signature of 30 you classified System Deficiency were dispositioned False Positive, which removes them from the deficiency population. Reconcile before close. False-positive rate this run is 57% versus an 8% baseline."*
- `Type: insight · Pattern: User Override Pattern + Cohort Anomaly · Impact: high`

**[X3] Individually-minor deficiencies over one assertion are never evaluated together ★**
- **Pain:** *Three controls conclude Ineffective this period, each logged as an isolated simple deficiency: a failed AP approval control, a failed period-end reconciliation, and a failed cutoff review. All three affect completeness and cutoff of accounts payable. Each sits on a separate workpaper and nobody evaluates them together, which is exactly the aggregation AS 2201 requires and the classic under-supervised-team miss.*
- **Insight and Recommendation:** Aggregate deficiencies by affected assertion and present the combined magnitude for the auditor to evaluate. *"3 ineffective controls affect the same assertion (completeness and cutoff of AP), combined potential magnitude USD 4.5m. Evaluate these together, not as three isolated items, considering likelihood and any compensating controls."* The platform surfaces the aggregation and the magnitude; it never auto-labels significant deficiency or material weakness, that severity call is the auditor's judgment on likelihood and magnitude. Only the platform sees all three workpapers at once.
- `Type: both · Pattern: Cross-Workflow Correlation + Cohort Anomaly (shared-assertion clustering) · Impact: high`

**[X4] A repeat of a finding management claimed to have fixed is drafted fresh, disconnected from last year ★**
- **Pain:** *The FY26 observation "Vendor master changes without secondary approval" is effectively the FY25 observation management marked "remediated Q2 FY25." The prior ATR is a PDF in the library and the new one is drafted from scratch, so nobody connects them. A recurrence after claimed remediation is what a regulator escalates hardest.*
- **Insight and Recommendation:** Match new observations to prior-year ATRs. *"This matches FY25 OBS-14, marked remediated Q2 FY25. Recurrence after claimed remediation signals an ineffective management response, weigh it in the severity evaluation and note the failed prior remediation in the write-up."*
- `Type: both · Pattern: Recurring Output Anomaly (across periods) · Impact: high`

**[X5] Severity ordering is driven by loudness, not by materiality including qualitative factors**
- **Pain:** *The table sorts on a default severity tag then recency. A 200-row rounding-difference cluster inherits a High tag and sits on top, while the single row that paid USD 3.75 against a USD 27.75 contract price is tagged Medium. The team burns the day on 200 rounding rows that aggregate to under USD 500 and runs out of runway before the material item.*
- **Insight and Recommendation:** Re-rank by **materiality including qualitative factors**, with the basis attached, and never demote a fraud, override, related-party, or regulatory item on dollars alone. *"A 200-row High cluster aggregates to under USD 500, while the Medium MCKESSON cluster carries the material underpayment. Re-rank by materiality, not row count."*
- `Type: both · Pattern: Cohort Anomaly + new (materiality re-rank) · Impact: high`

**[X6] Priced exceptions across workflows are never totalled against materiality (the SUD)**
- **Pain:** *Chargeback underpayments, duplicate-payment recoveries, and cutoff errors are each cleared in their own workflow. Nobody totals the actual misstatements across workflows for the summary of unadjusted differences, so the aggregate USD 4.5m of potential misstatement is never weighed against performance materiality of USD 3.0m. A data platform is uniquely able to add these up.*
- **Insight and Recommendation:** Aggregate priced exceptions across workflows against performance materiality. *"Priced exceptions across 4 workflows total USD 4.5m of potential misstatement, above performance materiality of USD 3.0m. Evaluate for the SUD schedule and opinion impact."* (Distinct from X3: this aggregates dollar misstatements, X3 aggregates control deficiencies.)
- `Type: both · Pattern: Cross-Workflow Correlation + new (SUD aggregation) · Impact: high`

**[X7] Remediation slips silently through serial due-date extensions and becomes next year's repeat**
- **Pain:** *ACT-0007 (vendor-master approval fix) was due 30-Jun-2026, is Overdue on 13-Jul, and has been extended three times, each approved without challenge. Nobody sees the slip pattern, the control stays broken through year-end, and it feeds straight back into X4 as next year's repeat.*
- **Recommendation:** A chronic-slip flag on any action with 2+ approved extensions, with a close forecast. *"ACT-0007 is 40 days overdue and extended 3 times. At this slip rate it will not close before period end. Escalate to the owner's manager and reassess whether the underlying control can be relied on this cycle."*
- `Type: recommendation · Pattern: new (Remediation SLA / slip) · Impact: high`

*Also worth building at Exceptions:* triage-backlog aging against an SLA (12 High cases unclassified past the 10-day SLA, oldest 15 days); review-handoff stalling (14 action plans awaiting Accept/Reject, 4 waiting over 7 days); auto-draft the observation from the clustered exceptions (pre-fill process, classification, count, exposure traced to the rows, a first-draft recommendation for the auditor to edit and own); management-response quality scoring (block a Critical observation from finalizing on "Management will review and strengthen controls" with no owner, step, or date); and action-trail integrity anomalies (a close-out marked Implemented, reviewed as Discrepancy, then re-approved 6 minutes later by the same user with no new evidence).

---

## Stage 4. MONITOR
### Continuous monitoring, automation, cross-workflow, data sources

*Surfaces: Workflow Executor (a run in the context of its own history), Cross-Workflow Correlation, Process Hub, Data Sources, Workflow Library and Builder.*

The value here is almost never inside one run. It is in the pattern that appears only when you stack runs, join workflows, and watch a number move across closes. Two procedures in this stage are not optional: journal-entry testing (required on every audit) and whole-population segregation-of-duties analysis.

**[M1] Spend structured just under an approval limit is invisible to any single-row test ★**
- **Pain:** *The delegation-of-authority limit for a buyer is USD 10,000. A single-PO test passes every line. But vendor APEX received four POs of 9,800, 9,750, 9,900 and 9,600 within eight days, same cost centre, same requisitioner: USD 39,050, which no single-row test can see.*
- **Insight (observable facts, not intent):** A sum-under-threshold-within-a-window detector. *"Vendor APEX: 4 POs just under the 10k limit in 8 days, same buyer, same GL. Aggregate USD 39,050 exceeds the next approval tier. Route to the DOA owner to review buyer BR-114."* The auditor characterizes whether it is structuring.
- `Type: insight · Pattern: new (Sum-under-threshold) · Impact: high`

**[M2] A vendor-and-employee match lives in the join between two workflows nobody connects ★**
- **Pain:** *The AP workflow clears vendor GLOBEX because its invoices three-way match. Separately, the HR/payroll workflow holds employee bank details. Nobody joins them, so the fact that GLOBEX's remittance bank and address match employee EMP-3390's is invisible, the most common occupational-fraud shape.*
- **Insight (observable facts):** A cross-master join. *"Vendor GLOBEX shares a bank account and address with an active employee record. USD 214k paid over 11 months. Refer to the appropriate function for review."* **Data-governance caveat:** joining employee/HR data to the vendor master carries privacy and data-authorization limits (data minimization, and for an external auditor it may exceed the audit's data authority), so this is scoped to internal audit and continuous-monitoring engagements with explicit data-governance sign-off, not offered universally.
- `Type: insight · Pattern: Cross-Workflow Correlation (vendor master joined to HR master) · Impact: high`

**[M3] A high-value process has zero monitoring and silence is read as "fine" ★**
- **Pain:** *The engagement monitors P2P and O2C tightly, but the Treasury manual-wire process, the highest-value payment channel, has no monitoring workflow. A USD 480,000 wire to a first-time payee went out with no continuous control. Silence here does not mean checked and fine, it means nothing was ever looking.*
- **Recommendation:** A coverage-gap detector weighted by value at risk. *"The Treasury manual-wire process has no monitoring workflow, while it moved USD 12.4m this quarter including 9 first-time-payee wires over 100k. Build a wire-monitoring workflow (new payee, round-dollar, threshold, dual authorisation) before next period."*
- `Type: recommendation · Pattern: new (Coverage Gap) · Impact: high`

**[M4] The saved workflow reads the wrong column and comes back green, or runs on stale data**
- **Pain:** *The client migrates its ERP. The chargeback price file's amount column shifts one position and company is renamed entity_name. The workflow keeps reading the old positions and every run comes back green while testing the wrong data. Separately, a nightly extract failed to refresh, so a reconciliation ran against a three-day-old file and came back clean only because the breaking transactions were never in it.*
- **Insight and Recommendation:** A source-structure guard and a freshness/completeness guard, both blocking trust, not the run. *"The HPG12 source changed structure: amount moved and company was renamed. Results are not trustworthy until the mapping is re-confirmed."* And *"this run's source is 3 days stale and row count is 38% below the trailing average, treat the clean result as unverified."*
- `Type: both · Pattern: Schema Decay + new (Data Freshness) · Impact: high`

**[M5] Every run re-triages from zero, so recurring concentration and run-over-run change are never seen**
- **Pain:** *A weekly P2P pricing workflow flags MCKESSON 8 to 12 times every run, always small, always closed clean, so the fact that it appeared in 5 of the last 6 runs (never once cleared) is never seen. And a reconciliation shows the same 140-line break list every run, so this month's new USD 4,200 AMPHS2024 break is presented identically to the 139 chronic breaks and the analyst works the loudest, not the newest.*
- **Insight and Recommendation:** Recurring entity concentration plus a prior-run diff on every run. *"MCKESSON flagged in 5 of the last 6 runs (83%), never cleared, a recurring control gap in the price master, not six unrelated exceptions."* And *"12 new breaks this run (worth 61k), 8 cleared, 120 unchanged. AMPHS2024 is new and material, work it first."*
- `Type: both · Pattern: Recurring Output Anomaly (run-over-run) · Impact: high`

**[M6] Journal-entry risk: recurring manual top-side entries and after-hours postings escape single-run review ★**
- **Pain:** *The intercompany reconciliation on GL 210500 posts a USD 30k to 45k break at every close, cleared each month by a manual top-side journal, for nine closes running, because a mapping drops one entity's in-transit postings. It is treated as a fresh one-off each time. Journal-entry testing is required on every audit (AS 2401 / ISA 240), yet these manual, round-dollar, period-end, same-preparer entries are never looked at as a set.*
- **Insight and Recommendation:** A first-class JE-testing detector over the full population (manual entries, round-dollar, weekend or after-hours, unusual preparer, entries to sensitive accounts), and escalate the recurring break to a fix. *"GL 210500 broke at 9 of 9 closes, always cleared by a manual top-side JE by the same preparer, mean USD 37k. This is a mapping defect, not a timing difference. Fix the sub-ledger-to-GL mapping and review the nine journals as a set."*
- `Type: both · Pattern: Recurring Output Anomaly + new (Journal-Entry Testing) · Impact: high`

**[M7] Segregation-of-duties conflicts are invisible without whole-population access analysis ★**
- **Pain:** *JSMITH created vendor V-5540 in the master and also approved and released its first payment. No single workflow flags it, because create and approve live in different systems and different runs. Whole-population SoD analysis against a conflict matrix (create vendor vs release payment, post JE vs approve JE, change bank detail vs disburse) is a core continuous-monitoring value, and today it is nobody's job.*
- **Insight:** A whole-population SoD-vs-conflict-matrix detector. *"JSMITH both created vendor V-5540 and released its first payment (USD 62k), a create-vs-disburse conflict. 4 users hold this conflict across 219 payments this quarter. Review access and the affected transactions."*
- `Type: insight · Pattern: new (SoD Conflict) + Cross-Workflow Correlation · Impact: high`

*Also worth building at Monitor:* a KPI-drift detector over 2+ real closes (aged reconciliation-break balance over 90 days rose 9 to 12% for four closes, from 210k to 305k, likely under-provisioned, escalate before quarter-end); duplicate payment across split vendor masters (same invoice number, amount, date and remit-to bank paid to V-2201 and V-9910 with a transposed tax ID, which a code-keyed check passes); recurring-manual-check-to-workflow (the same round-dollar Excel pull run four closes running should become a governed workflow) and stale-rule re-tuning (a "new payee over 5k" rule dismissed 46 of 50 times because the policy threshold moved to 25k); a Benford first-digit test flagging, for example, an over-representation of amounts beginning 4 and 5 just under a 5,000 approval band in the expense population; and a distributed MIS pack with 0 of 200 items actioned across 5 months.

---

## Stage 5. REPORT
### Portfolio, compare, SOX register, audit-committee reporting, knowledge reuse

*Surfaces: Portfolio Overview and Needs-Attention, Engagement Compare, SOX-ICFR register / dossier / risk-owner portal, Audit Report and audit-committee reporting, Knowledge Hub and Custom Dashboards.*

The partner runs a book of engagements across clients and quarters and signs an opinion a regulator can inspect years later. The signal they need lives above the process.

**[R1] An engagement is going to miss sign-off and nobody escalates until the wire ★**
- **Pain:** *eng-1 (FY26 ICFR) shows "Sign-off in 12d" at health 75, but only 62 of 100 key controls are concluded and the close rate is 4 a week, so 38 remaining needs about 9 weeks, not 12 days. The manager keeps reporting "on track" because no single day looks alarming.*
- **Recommendation:** A burn-down against the fixed milestone (concluded vs remaining, throughput per tester, the scheduled date). *"eng-1 will miss its 25-Jul sign-off. 38 key controls remain, burn rate says about 9 weeks. Reassign 2 testers from eng-2 or re-plan the date now."* A burn-down, not a forecast of the numbers.
- `Type: recommendation · Pattern: new (Milestone Slippage) · Impact: high`

**[R2] A client deteriorates across quarters and it reads as noise one period at a time ★**
- **Pain:** *eng-6 (ITGC Monitoring) sits at health 58 today. Last quarter it was 71, the quarter before 79. Each quarterly QA review called the number "amber, within range." Three points strung together is a client whose IT control environment is failing, exactly the story an inspector reconstructs after the fact.*
- **Insight:** With 2+ real periods, draw the trend and name the drivers. *"ITGC health fell 79 to 71 to 58 across three quarters, a sustained decline. Access-provisioning and change-management controls drive it. A scoping and risk signal for FY27 planning and the audit-committee narrative."*
- `Type: insight · Pattern: KPI Trend Drift (elevated to engagement health) · Impact: high`

**[R3] A signed conclusion in the register contradicts what the live monitor is saying ★**
- **Pain:** *Control PC-07 (P2P duplicate-invoice) is concluded Effective in the SOX register (design and operating passed at interim). Meanwhile the always-on Duplicate Invoice Monitor has thrown exceptions in 4 of the last 6 daily runs. The point-in-time register and the continuous monitor never speak, so the signed conclusion now contradicts live evidence and no one is told before rollforward.*
- **Insight:** Route register-to-monitor conflicts to the approver of the original conclusion. *"PC-07 is concluded Effective, but its linked monitor failed 4 of 6 recent runs. The operating conclusion is contradicted by post-interim evidence. Reassess before rollforward to year-end."*
- `Type: insight · Pattern: Memory Conflict (a signed fact contradicted by later runs) · Impact: high`

**[R4] A framework principle or an assertion has no key control behind it, and everything looks green ★**
- **Pain:** *The register maps 100 controls to COSO components, but Principle 12 ("deploys through policies and procedures") and the cutoff assertion on the revenue account have zero key controls linked. The register looks busy and green. At year-end the EQR partner asks "where is your coverage for revenue cutoff?" and there is nothing to point to.*
- **Insight:** A coverage-gap detector over the RACM-to-framework mapping that bypasses the dollar floor. *"Revenue cutoff on the O2C significant account has no key control mapped, and COSO Principle 12 has no control. These are coverage gaps, not test failures, so no red flag fires today, but they leave a material assertion unaddressed before sign-off."*
- `Type: insight · Pattern: new (Coverage Gap, absence of a control) · Impact: high`

**[R5] The same control is tested three different ways across the book, and possible redundancy is never surfaced for review**
- **Pain:** *The P2P three-way match is sampled 60 in eng-1, 40 in eng-5, and 25 in eng-9, same control, same risk, and Compare cannot show the leader that one file is out of line with the firm approach. Separately, a register marks a preventive system match, a detective GRN reconciliation, and a manual PO review all key over the same assertion, which may be genuine defence in depth or may be redundancy, and nobody ever evaluates it.*
- **Recommendation:** Surface the divergence and the apparent redundancy **for the engagement leader to evaluate**, with no efficiency framing. *"AP three-way match is tested three ways across the book, and the 25-item variant on eng-9 sits below the firm template, review for consistency."* And *"three key controls cover one assertion, review whether this is intended defence in depth or redundant, noting that preventive and detective controls cover different failure modes."* The platform never recommends demoting a key control to save hours, demotion needs evidence the remaining control fully addresses the assertion and the same failure modes.
- `Type: recommendation · Pattern: Cohort Anomaly · Impact: med`

**[R6] A fix found in one engagement is re-discovered from zero in every other file with the same problem ★**
- **Pain:** *On eng-1, a senior found the client's vendor-master export renames the bank_account column each month, and wrote a mapping fix that cleared dozens of false exceptions. Three other P2P engagements hit the identical file and the identical false exceptions, and each team re-solves it, burning the same day three more times.*
- **Recommendation:** Promote an approved fix to reusable governed context across the book. *"The vendor-master column-mapping fix approved on eng-1 applies to eng-5 and eng-9 (same source, same drift). Reuse it to clear about 25 false exceptions per period, and promote it to the Knowledge Hub as a firm-standard mapping."* The natural extension of Enterprise Context promotion across engagements.
- `Type: recommendation · Pattern: Schema Decay + new (Cross-Engagement Knowledge Reuse) · Impact: high`

*Also worth building at Report:* collapse Needs-Attention into cross-engagement themes (three P2P files sharing one vendor-master weakness is one management-letter point, not three coincidences); make Compare explain the delta (eng-1 trails eng-2 by 14 points, 11 of them one cause, manual approval controls failing on missing evidence); flag rubber-stamp self-attestation on the risk-owner portal (a key control self-attested 6 quarters running with identical wording and no reperformance); generate the period-over-period audit-committee narrative (prior-year deficiencies remediated vs still open, plus what is new); and attach a "what changed under this number" note to static dashboard tiles (a "controls effective 71%" tile held flat while two automated controls failed, net-masked by two new manual ones).

---

## Stage 6. THE FIRM LAYER
### The audit company's own business (Practice Cockpit)

Everything above stops at the engagement. The firm's business lives one altitude higher, cutting sideways across engagements and teams. Materiality here is priced in **margin, write-off, and regulatory/reputational risk** (a firm-materiality floor), and the unit that breaks a baseline is often a **team, partner, client, or person**, not a vendor. **Guardrail 7 is absolute: none of these insights may feed an engagement's scope, sample extent, or conclusion.** They are for practice management only.

**[F1] Re-work is quietly eating the margin and nobody attributes it ★**
- **Pain:** *ENG-7 was proposed at 480 hours and is tracking to 624, about 30% over, heading for a WIP write-off. The partner sees the overrun in the time system at week 9, too late to reprice. The driver: control AP-03 was tested, failed review, and got re-performed three times because the preparer kept pulling an incomplete population.*
- **Insight and Recommendation (practice management only):** Attribute the overrun to a cause the partner can act on next time. *"ENG-7 is 30% over budget. The driver is re-work, not scope: AP-03 re-performed 3 times. A coaching and staffing signal for the next cycle."* This never touches how much testing ENG-7 does now.
- `Type: both · Pattern: Workflow Efficiency Gap + KPI Trend Drift on burn ratio · Impact: high`

**[F2] Next year is priced on last year's proposal, not this year's actuals**
- **Pain:** *ENG-7 renewal is priced by nudging last year's fee for inflation, but 40% of actual hours went into two controls the client's weak pricing master keeps breaking, while eight controls ran well under budget. The firm re-quotes flat, under-prices the hard controls again, and repeats the write-off.*
- **Recommendation:** Feed control-level actuals into next year's quote. *"For FY27, 40% of ENG-7 hours concentrated in AP-03 and CC-02 (the client's pricing-master breakdown). Reprice those two up and raise remediating the pricing master with the client."*
- `Type: recommendation · Pattern: new (realization history) · Impact: high`

**[F3] Which files are the inspection risks, before the regulator picks them ★**
- **Pain:** *Across 40 SOX engagements, the partner learns a file is thin only when the EQR partner or inspector opens it. On ENG-12, a key control over revenue cutoff was concluded Effective on a sample of 15 where methodology called for 25, the workpaper has no IPE evidence for 4 items, and the engagement partner signed off 6 days after the report date.*
- **Insight and Recommendation:** An inspection-risk score assembled from signals the platform already holds (sample below plan, missing IPE, sign-off after report date, thin evidence on a key control). *"ENG-12 is top 5% inspection risk. Drivers: key control on 60% of required sample, 4 items missing IPE, sign-off after report release. EQR re-review this week, before archival closes on day 45."* Firm-materiality is effectively unbounded here, one bad inspection threatens the licence to practise.
- `Type: both · Pattern: new (firm-level completeness + evidence traceability) · Impact: high`

**[F4] EQR capacity conflict breaches the archival window**
- **Pain:** *ISQM 2 requires EQR before report release and archival within 60 days. At quarter close, 9 engagements hit report date in one week against 2 reviewers (5-day turnaround each). Two files slip past the archival window, itself a reportable quality breach.*
- **Recommendation:** *"9 engagements reach report date in the week of 30-Sep against 2 reviewers. ENG-4 and ENG-19 will breach the 60-day window. Re-sequence EQR now or add a third qualified reviewer."*
- `Type: recommendation · Pattern: capacity KPI · Impact: med`

**[F5] Two teams test the same control two different ways ★**
- **Pain:** *AP-03 (three-way match) exists at three shared-service clients audited by three teams. Team A tests 25 items with a 4-attribute program, Team B tests 40 with a 6-attribute program, Team C uses a full-population workflow. Same control, same risk, three defensible-but-different approaches, and the firm cannot explain why one client got a lighter test.*
- **Insight and Recommendation:** Team-as-cohort deviation, surfaced to methodology leadership. *"AP-03 is tested three ways across ENG-2, ENG-8, ENG-15. The 4-attribute variant sits below the firm template. Standardize the program firm-wide."* Fixing one control's template fixes every engagement at once.
- `Type: both · Pattern: Cohort Anomaly (team as cohort) · Impact: high`

**[F6] A firm-wide quality theme hides as five isolated coaching notes**
- **Pain:** *IPE-completeness deficiencies were logged on five engagements this quarter, up from one, but each is filed as an isolated coaching note on its own file, so nobody sees the systemic ISQM 1 pattern that a QA review or inspection would treat as a firm-level root cause.*
- **Insight:** Cluster review-note and QA-finding themes across the book. *"IPE-completeness deficiencies appear on 5 engagements this quarter, up from 1, a systemic pattern. Address as a firm training and methodology item, not five isolated notes."* (Aggregate and non-personal: this replaces any per-person after-hours behavioural profiling, which is out of scope on privacy and employment-law grounds. Capacity and utilization are handled at Plan, as a non-personal workload view.)
- `Type: insight · Pattern: Cohort Anomaly (engagement as cohort) · Impact: med`

**[F7] Client financial-stress and continuance risk, only visible when aggregated ★**
- **Pain:** *On client Trident, each signal is survivable alone: the 90+ day AR bucket creeping +9 to 12% for four months, DSO drifting up, and a covenant-headroom note in the last management response. No single engagement surfaces "this client is under financial stress," but together they bear on continuance and on whether going-concern procedures are needed, and the firm should weigh it before signing next year's engagement letter.*
- **Insight and Recommendation:** *"Continuance and financial-stress flag: Trident shows a covenant-headroom note plus AR 90+ bucket +11% over 4 months and DSO drift. Route to the client-continuance committee before the FY27 engagement letter, and consider whether going-concern procedures apply."* (Delivery-risk signals like PBC lateness are tracked separately and are not treated as going-concern evidence.)
- `Type: both · Pattern: Emerging Trend + KPI Trend Drift, aggregated to the client · Impact: high`

**[F8] An independence or rotation breach surfaces in an inspection, not in a partner's inbox ★**
- **Pain:** *A governed fact says "Acme is a restricted audit client, prohibited services apply." Six months later a partner in advisory scopes an ICFR remediation project for Acme, a self-review threat. Separately, the Acme engagement partner is now in year 6, past the 5-year rotation limit for a public-interest entity.*
- **Insight:** *"Independence conflict: a governed fact ('Acme is a restricted audit client') is contradicted by a new advisory engagement scoped this week, and the Acme partner has exceeded the 5-year rotation limit. Route both to the independence partner now."* Bypasses any dollar floor, it is a governance breach.
- `Type: insight · Pattern: Memory Conflict + rotation clock · Impact: high`

*Also at the firm layer:* cross-sell leads spotted during the audit but walled off correctly (a non-audit client's manual three-week reconciliation with recurring exceptions is a genuine automation-advisory lead, surfaced with an independence pre-check, never for an audit client); and key-person concentration (one partner is sole approver on 60% of governed facts and RACM owner on the two largest clients, add a second reviewer before the next rotation).

**Product note for the firm layer:** most of these reuse existing patterns. What is genuinely new is (a) a firm-materiality floor priced in margin and regulatory risk, and (b) two firm-level data feeds the engine does not read today: the signed proposal/budget (F1, F2) and the staff time-charge and sign-off-timing feed (F3, F4).

---

## 4. Prioritized shortlist (impact x feasibility)

Highest first. Feasibility is high when detection is deterministic and the data already exists in the app.

| # | Opportunity | Surface | Insight / Rec | Why it wins |
|---|---|---|---|---|
| 1 | RACM completeness as blocking findings (P5) | Plan, RACM | Both | Fully deterministic, gaps already computed, an unmitigated key risk is the cleanest "a regulator will catch this." Lowest build cost, highest certainty. |
| 2 | Population completeness tie-out (T3) | Test, Evidence | Rec | Protects the base every downstream verdict stands on, the most common reason a conclusion is overturned on inspection. Uses the existing snapshot. |
| 3 | IPE reliability flag (T7) | Test | Rec | A top PCAOB inspection theme, structurally invisible today, deterministic to detect wherever a control cites a system report. |
| 4 | AI-verdict vs human-verdict divergence (T5) | Test, Attribute Testing | Insight | Reads AUTO vs MANUAL fields already stored, and it governs how far the AI verdict can be trusted anywhere. The memory engine's unique strength. |
| 5 | Deficiency aggregation by assertion (X3) | Exceptions | Both | The partner-level judgment that changes the opinion, only the platform sees all workpapers at once. Surfaces magnitude, human grades severity. |
| 6 | Cross-workflow duplicates as one issue (X1) | Exceptions / Monitor | Rec | Turns the MCKESSON anchor from 81 noise rows into one priced, governed finding. The clearest demo of the memory layer. |
| 7 | Prior-year rollforward blindness (P4) | Plan | Both | A control that failed last year being dropped is a career-ending PCAOB finding. The strategic heart of "planning that remembers." |
| 8 | Register conclusion vs live monitor conflict (R3) | Report, SOX | Insight | "We signed Effective while live evidence said otherwise" is one of the failures that actually reach a regulator. Clean Memory Conflict fit. |
| 9 | Whole-population SoD conflicts (M7) | Monitor | Insight | A core continuous-monitoring value prop, invisible to any single run, deterministic against a conflict matrix. |
| 10 | Framework / assertion coverage gap (R4) | Report, SOX | Insight | The first thing an EQR partner and inspector look for, structural, so it bypasses the materiality floor. |
| 11 | Sum-under-threshold detector (M1) | Monitor | Insight | A spend pattern no single-row test can see, a genuinely new detector, described as facts not intent. |
| 12 | Inspection-risk file scoring (F3) | Firm | Both | Points EQR at the two or three files a regulator would flag, before archival closes. Firm-materiality protects the licence to practise. |

*Close runners:* compensating-control link (T8), repeat finding year over year (X4), uncorrected-misstatement aggregation (X6), rollforward when the control changed (T9), client financial-stress and continuance (R2 / F7), methodology divergence across teams (F5), SOC 1 reliance (P7), and cross-engagement knowledge reuse (R6).

---

## 5. How these plug into the existing framework

Recommendations are the same insight object read forward instead of backward.

- **An insight** answers "what happened." Its baseline is a historical expectation (last run, last quarter, a peer, a governed fact); the violated baseline is the news.
- **A recommendation** answers "what to do next." Its baseline is a target or standard (the sampling table, the firm template, the prior-year scope, the milestone date); the gap to it is the news.

Both carry the identical fields the metrics doc already defines, so the pipeline does not change:

1. **Baseline / trigger.** The only new plumbing is a second and third trigger alongside "read the run": a **"read the plan and the prior-year file"** trigger for Plan, and a **"read the portfolio and the firm feeds"** trigger for Report and Firm.
2. **Cause.** The specific object that broke the baseline (the risk with no control, the two contradicting materiality figures, the three deficiencies over one assertion, the untested IPE).
3. **Consequence, priced by materiality including qualitative factors.** Dollars at the engagement layer, margin and regulatory/reputational risk at the firm layer, with the floor exempting governance findings (coverage gaps, independence, memory conflicts) and never demoting fraud, override, related-party, or regulatory items on dollars alone.
4. **Confidence on three axes.** Real (evidence strength), Materiality (size of the consequence including qualitative factors), Novelty (news to this reader now). Coverage and completeness findings score high on Real because they are deterministic even when no dollar attaches.
5. **Action window and death condition.** How long to act, and the condition that retires the item (two clean runs, a signed rationale, the IPE tested, the file remediated).
6. **Human gate, and an auditor-signed rationale.** Nothing auto-acts. An approved insight is promoted to governed Enterprise Context that future runs read. An accepted recommendation becomes a task, a scoping change, or a blocked transition (always overridable with a signed reason), and it produces a rationale the auditor owns and signs, never a tool citation in the workpaper.

**Two honest extensions.** First, the ten shipped patterns are run-time output patterns; several of the strongest opportunities here (RACM completeness, IPE reliability, compensating controls, coverage gap, sum-under-threshold, SoD conflict, journal-entry testing, deficiency and misstatement aggregation, milestone slippage, inspection-risk scoring) are genuinely **new detectors** that fire at plan-create, plan-freeze, register-validate, population-lock, and period close. Second, the firm layer needs **two data feeds the engine does not read today**: the signed proposal/budget and the staff time-charge and sign-off-timing feed. Add those, keep the deterministic-detect / LLM-narrate / human-gate pipeline exactly as it is, and the same engine runs from the first field of the Create Wizard up to the Practice Cockpit.
