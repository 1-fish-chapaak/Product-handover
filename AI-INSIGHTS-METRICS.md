# Product Metrics for AI Insights
### Irame / Auditify, companion to the Memory metrics doc

**Author:** Product · **Date:** July 2026 · **Version:** 1.0

*Memory reduces what a user must SAY (it lives in chat). Insights reduce what a user must NOTICE (it lives across the platform). This doc covers only Insights. Every capability is a named ratio with a numeric target.*

---

## Context & Philosophy

A single run sees only itself. It can tell you it flagged 90 exceptions. It cannot tell you that 70 of them concentrate under one vendor, that the underpayment is material at settlement, or that the same vendor is drifting across three other workflows this quarter. Insights is the layer that correlates signals across runs, workflows, entities and time, then puts the pattern in front of a human before they think to ask.

Detection is cheap. Ten detectors will always produce more candidates than an auditor can read, and burying the one finding that matters under nine that do not is how you teach an auditor to ignore the feed. The scarce resource is not detection. It is attention, and every insight spends it. The job is not catching more, it is proving that what we showed was worth the interruption.

> **If a sharp senior reviewer would walk across the floor to tell you about it, surface it. If they would not, do not spend the attention. Everything else is a stat, and a stat is not the auditor's job to notice.**

---

## Foundational Example (Reference)

The current chargeback run flags **90 pricing-variation exceptions, 70 of them under MCKESSON**. One HPG12 row paid a **$3.75** chargeback that should have been **$27.75**. Same numbers, three possible products, only one an insight:

- **Stat:** "90 exceptions this run." True, and useless.
- **Exception feed:** "Row 55150038201: contract price not found." True, ninety times over. Noise.
- **Insight:** "MCKESSON drives 78% of exceptions, which rules out random error and points to a pricing-master breakdown. The underpayment is material at settlement. Quarantine the 70-row cluster before you pay. Resolved if the next run shows MCKESSON below 20%."

Only the third names a **baseline** that broke, a **cause**, a **consequence**, an **action with a deadline**, and a **condition that ends it**.

**Design principle:** *An insight is a violated expectation, compressed to a cause, carrying a consequence and an action window, that a human decides on. Remove any one and do not surface it as an insight.*

---

## Components: what an insight is made of

Drop any element below and the object collapses into something cheaper that already lives elsewhere. `[exists]` = already a field on `MemoryInsight`. `[add]` = the load-bearing addition, all populated deterministically.

| Component | What it adds | Without it, it is a | Status |
|---|---|---|---|
| **type** | which of 10 baselines broke | (nothing to violate) | [exists] |
| **baseline** | the expectation and tolerance that was violated | stat | [add] |
| **evidence** | the runs, rows and entities behind it | platitude | [exists] |
| **cause** | the one mechanism it compresses to | raw exception queue | [add] |
| **consequence** | the so-what, priced in $ or risk | observation | [add] |
| **action + window** | what to do, and by when | report line | [add] |
| **confidence (3 axes)** | is it real, does it matter, is it news | misleading single number | [add] |
| **death condition** | what future observation ends it | permanent belief | [add] |
| **decision** | the human signature (approve / scope / dismiss) | automation | [exists] |

**The one number is broken.** The shipped `confidence = frequency × sourceDiversity × recency × businessImpact` scores the MCKESSON card at **0.27**, below the 0.45 gate, so the code hard-codes `confidenceOverride: 0.84`. That override is the tell. Split confidence into three scores that gate independently and never multiply truth by money: **Real** (evidence strength, capped hard when evidence is thin), **Materiality** ($ at risk), **Novelty** (news to this reader, now). Rank on them, never collapse them into one gate.

---

## The qualification bar

A signal becomes an insight only by clearing these gates in order, cheapest first. Survivors are ranked lexicographically (materiality band, then Real, then Novelty) into a fixed budget: **Executor 7 per run, Process tab 5 per severity band, Engagement 1 escalation + 3 tail.**

| Gate | Passes only if | Metric | Target |
|---|---|---|---|
| **Well-formed** | has baseline + cause + consequence + action | Well-Formedness Rate = well-formed / surfaced | 100% |
| **Real** | evidence supports the claim; one run is labelled one run, no trend line | Recurrence-Claim Fidelity = trend claims backed by 2+ periods / trend claims | 100% |
| **Material** | priced at or above the engagement floor, or a governance / structural risk | Materiality-Floor Precision = at-or-above floor (or exempt) / surfaced | 100% |
| **Novel** | not a stale repeat of something already shown or approved | Stale-Recurrence Suppression = stale repeats demoted / stale repeats | 90%+ |
| **Fits budget** | ranks within the surface's slot count | Attention-Budget Adherence = renders within budget / renders | 100% |

Guard rail: a material finding can be ranked low or labelled thin, but it is never gated out. **Materiality Suppression Rate = high-materiality findings blocked by a non-materiality gate / high-materiality detected. Target: 0%.**

---

## Where each pattern surfaces

All ten pattern types have a home. Lower altitudes see a single run in context; higher altitudes see the cross-run and cross-process picture.

| Pattern | Primary surface | Bucket |
|---|---|---|
| Cross-Workflow Correlation | Workflow Executor | correlation experience |
| Recurring Output Anomaly | Workflow Executor, then Business Process | output compare, then risks & patterns |
| Schema Decay | Workflow Executor, then Business Process | source-drift, then risks & patterns |
| Cohort Anomaly | Business Process | risks & patterns |
| Memory Conflict | Business Process (re-asked at Executor) | risks & patterns |
| User Override Pattern | Business Process | risks & patterns |
| KPI Trend Drift | Business Process | KPI drift trend |
| Emerging Trend | Business Process | KPI drift trend |
| Workflow Efficiency Gap | Engagement overview | low-severity digest |
| Distribution Engagement Gap | Engagement overview | low-severity digest |

---

## Layer 1: Workflow Executor

*Purpose: for a single run, surface what memory knows about it, how it compares to its own past and how its entities behave elsewhere, before the analyst closes it. The two headline experiences are cross-workflow correlation and output compare. Source-drift is the guard that stops a green run from being trusted when the ground moved.*

### 1.1 Cross-workflow correlation experience

| Aspect | Detail |
|---|---|
| **Anti-pattern** | MCKESSON is flagged in this Chargeback run and also drifting in Contract Compliance Review, but the two runs never speak, so the analyst closes chargeback blind to the corroborating signal next door. |
| **Target behavior** | Every flagged entity is checked against its appearances in sibling workflows and a hit is attached as evidence, with an "on watch" marker, never as a second card. |
| **Metric** | **Cross-Workflow Corroboration Rate = run flags cross-checked against sibling workflows / eligible run flags. Target: 100%.** |
| **Why it matters** | One vendor problem seen in two workflows is stronger evidence, not two problems. |

### 1.2 Output compare over previous outputs

| Aspect | Detail |
|---|---|
| **Anti-pattern** | The executor shows the same exception list every run with no memory that AMPHS2024 was clean last month and is flagged now. The analyst re-triages from scratch. |
| **Target behavior** | Every run states what changed since its own last run: new, cleared, unchanged, with KPI deltas. |
| **Metric** | **Run Output-Compare Coverage = runs emitting a prior-run diff / total runs. Target: 100%.** |
| **Why it matters** | The executor's whole value is "what did this run get wrong versus itself," visible only as a diff. |

### 1.3 Source-drift re-ask

| Aspect | Detail |
|---|---|
| **Anti-pattern** | The HPG12 price file changes structure, the run silently coerces the wrong column and produces wrong chargebacks with no flag. Everything shows green and the check is wrong. |
| **Target behavior** | Structural drift against the last-known-good schema is caught and surfaced before results are trusted. It blocks trust, not the run. |
| **Metric** | **Source-Drift Detection Rate = runs flagging a schema mismatch before results render / runs with a detectable change. Target: 100%.** |
| **Why it matters** | A wrong number built on a silently decayed source is the exact error that survives to a regulator's sample. |

---

## Layer 2: Business Process (AI Insights)

*Purpose: the cross-run brain a reviewer checks between runs, and the surface that decides whether a pattern is recurring and material enough to promote toward a governed fact. Two buckets: risks & patterns (who and what), and KPI drift trend (which direction, over time).*

### 2.1 Risks & patterns: one incident, one card

| Aspect | Detail |
|---|---|
| **Anti-pattern** | Cohort Anomaly, Cross-Workflow Correlation, Memory Conflict and Schema Decay all fire on MCKESSON and render as four peer cards, while a loud 200-row rounding cluster outranks the material one on volume. The lead sees four problems and works the wrong pile. |
| **Target behavior** | Firings sharing a root collapse into one primary card; candidates are priced before ranking, so the material MCKESSON cluster leads and immaterial noise drops to a logged drawer. MCKESSON is labelled one run, no trend line, with its death condition. |
| **Metric** | **Root Collapse Correctness = clusters shown as one card / clusters with 2+ shared-root firings. Target: 100%.** With **Thin-Evidence Honesty Rate = one-run findings showing the "directional" caveat / one-run findings. Target: 100%.** |
| **Why it matters** | Ten cards for one cause teaches the reader the surface cannot count, and ranking on volume trains analysts to work the loud pile, not the material one. |

### 2.2 Risks & patterns: a contradicted governed fact

| Aspect | Detail |
|---|---|
| **Anti-pattern** | A governed fact (MCKESSON contract price = X) is contradicted by this run, but at near-zero dollars this month the product formula multiplies it out of sight. A certain governance breakage is hidden. |
| **Target behavior** | Memory Conflict bypasses the dollar floor and surfaces on Reality alone, routed to the approver of the original fact. |
| **Metric** | **Governance-Conflict Surface Rate = memory-conflicts surfaced / memory-conflicts detected. Target: 100%.** |
| **Why it matters** | Once an insight became a governed fact, it became a control other runs rely on. A silent contradiction is the most dangerous thing the engine can hide. |

### 2.3 Risks & patterns: confident when it should be

| Aspect | Detail |
|---|---|
| **Anti-pattern** | The tab surfaces cards at "80% confidence" but only 40% survive the human gate; and a low-value warning fires and gets dismissed every run with nothing learned. |
| **Target behavior** | High-Real insights are mostly confirmed at the gate or the score is recalibrated. A root dismissed repeatedly decays below the budget bar unless its signal strengthens. |
| **Metric** | **Reality Calibration = insights at Real >= 0.7 confirmed at the gate / surfaced at Real >= 0.7. Target: 85%+.** With **Insight Precision (tab) = insights actioned / insights surfaced. Target: 70%+.** |
| **Why it matters** | A confidence number is only honest if it predicts outcomes, and dismissals are the precision signal that keeps the surface trustworthy. |

### 2.4 KPI drift trend, honest about periods

| Aspect | Detail |
|---|---|
| **Anti-pattern** | Average chargeback variance ticks up in one period and the tab draws a "drift" trend line and a High card off a single move. |
| **Target behavior** | Trend Drift renders only with 2+ consecutive periods of real series data; a single-period move is an Emerging-Trend candidate at most, labelled directional. The 90+ day bucket creeping +9 to 12% across four months is the real thing. |
| **Metric** | **Drift-Claim Fidelity = drift cards backed by 2+ consecutive periods / total drift cards. Target: 100%.** |
| **Why it matters** | A drift claim is a claim about time. One period is not time enough, and a false drift is a false assurance the workpaper carries forward. |

---

## Layer 3: Engagement overview

*Purpose: give the lead the one thing they cannot miss, plus a short tail, across every process in the engagement. Lowest budget, highest bar. Low-severity patterns (workflow efficiency gaps, distribution engagement gaps) live here only as a digest, never as escalations.*

### 3.1 The single escalation

| Aspect | Detail |
|---|---|
| **Anti-pattern** | The rollup lists 12 findings, severity-sorted. MCKESSON is fourth. The lead triages top-down, runs out of time, and the sign-off-changing finding is never seen. |
| **Target behavior** | Exactly one escalation, the top-ranked finding clearing a high Materiality floor and a Moderate-or-better Real, plus a 3-item tail and an honest "N more" summary. |
| **Metric** | **Escalation-Slot Precision = engagement escalations actioned / engagement escalations surfaced. Target: 70%+.** |
| **Why it matters** | The lead's trust in the one escalation is the whole value of the rollup. A wrong one is worse than none. |

### 3.2 The quiet miss

| Aspect | Detail |
|---|---|
| **Anti-pattern** | The engine is tuned only for precision. A run where MCKESSON dropped to 12% produces zero cards, and the lead cannot tell "checked, genuinely fine" from "engine broke, checked nothing." |
| **Target behavior** | A periodic back-test replays known-material past events (the MCKESSON cluster, the $3.75 row) and confirms the current engine still surfaces them. Any human promotion of something the engine buried counts against recall. When a baseline holds, a signed pass is available on demand, so silence never means "checked." |
| **Metric** | **Material-Miss Rate = known-material events missed in back-test (plus human-confirmed buried) / total known-material events. Target: 0%.** |
| **Why it matters** | The only unrecoverable failure in audit monitoring is the silent miss. Back-testing recall is the only honest defense. |

---

## Cross-cutting principles

- **Materiality first, surprise second.** The floor is checked before novelty. A material finding is never gated out, only ranked low or labelled thin.
- **Three axes, never one number.** Real, Materiality and Novelty gate and display independently. Every hand-set `confidenceOverride` is a defect. **Override Dependence Rate = insights needing an override to clear candidacy / insights that clear. Target: 0%** (the demo is at 100% today).
- **The budget is the threshold.** No global confidence cutoff to tune. Each surface shows its top N; a noisy run raises the bar automatically, a quiet run lets a Moderate insight through.
- **No claim without a trail.** Detection is deterministic; the LLM writes only prose from a structured evidence bundle and cannot invent a number. **Evidence-Traceability Rate = quantitative claims resolving to a run ref and 1+ source rows / total quantitative claims. Target: 100%.**
- **Every insight can die.** A pre-committed death condition means findings resolve, expire or escalate on evidence, never linger. **Insight Resolution Rate = insights resolved or expired within their window / insights past their window. Target: 90%+.**
- **Negative assurance is kept, and scoped.** When a monitored baseline holds, the engine can emit a signed pass ("no vendor exceeded 30%, MCKESSON at 22%"), but only on demand and at close, never in the live stack. Silence is never allowed to mean "checked."

---

## Summary: measurable targets

**Measurable today, from the three seed cards:** Override Dependence = 3/3 = 100% (the calibration defect made visible). Baseline Completeness = 0/3 = 0% (the field does not exist yet). Thin-Evidence Honesty = 3/3 = 100%. Everything else is a build target.

| # | Metric | Ratio (numerator / denominator) | Layer | Target |
|---|---|---|---|---|
| 1 | Well-Formedness Rate | well-formed candidates / candidates surfaced | Bar | 100% |
| 2 | Baseline Completeness | insights with a populated baseline / surfaced | Components | 100% |
| 3 | Consequence Quantification | high+med insights with priced consequence / high+med | Components | 90%+ |
| 4 | Score Separation | insights showing all 3 axes / surfaced | Components | 100% |
| 5 | Falsifiability Rate | insights with a machine-checkable death condition / surfaced | Components | 100% |
| 6 | Recurrence-Claim Fidelity | trend claims backed by 2+ periods / trend claims | Bar | 100% |
| 7 | Materiality-Floor Precision | at-or-above floor (or exempt) / surfaced | Bar | 100% |
| 8 | Materiality Suppression Rate | high-materiality blocked by a non-materiality gate / high-materiality detected | Bar | 0% |
| 9 | Stale-Recurrence Suppression | stale repeats demoted to digest / stale repeats | Bar | 90%+ |
| 10 | Attention-Budget Adherence | renders within budget / total renders | Bar | 100% |
| 11 | Cross-Workflow Corroboration | run flags cross-checked against sibling workflows / eligible run flags | L1 Executor | 100% |
| 12 | Run Output-Compare Coverage | runs emitting a prior-run diff / total runs | L1 Executor | 100% |
| 13 | Source-Drift Detection | runs flagging schema drift before results / runs with a change | L1 Executor | 100% |
| 14 | Root Collapse Correctness | clusters shown as one card / clusters with 2+ shared-root firings | L2 Business Process | 100% |
| 15 | Thin-Evidence Honesty | one-run findings showing the caveat / one-run findings | L2 Business Process | 100% |
| 16 | Governance-Conflict Surface | memory-conflicts surfaced / memory-conflicts detected | L2 Business Process | 100% |
| 17 | Reality Calibration | Real >= 0.7 confirmed at gate / surfaced at Real >= 0.7 | L2 Business Process | 85%+ |
| 18 | Insight Precision (tab) | insights actioned / insights surfaced on the tab | L2 Business Process | 70%+ |
| 19 | Drift-Claim Fidelity | drift cards backed by 2+ consecutive periods / total drift cards | L2 Business Process | 100% |
| 20 | Escalation-Slot Precision | engagement escalations actioned / surfaced | L3 Engagement | 70%+ |
| 21 | Material-Miss Rate | known-material events missed in back-test / total known-material | L3 Engagement | 0% |
| 22 | Override Dependence Rate | insights needing an override / insights that clear | Cross-cutting | 0% |
| 23 | Evidence-Traceability | claims resolving to a run ref + source row / total claims | Cross-cutting | 100% |
| 24 | Insight Resolution Rate | insights resolved or expired in-window / insights past window | Cross-cutting | 90%+ |

---

## Closing Principle

> **A stat tells you a number. An insight tells you which expectation broke, why, what it costs, what to do before the door closes, and how you will know it is over. If it cannot do all five, it is a stat, and a stat is not the auditor's job to notice.**

---

*Handoff to Memory: the moment an approved insight is written to governed Enterprise Context with its sign-off record (approver, rationale, scope, expiry, a reviewer distinct from the run's analyst), it becomes a Memory-governed fact future runs read from. That record belongs to the Memory doc. Insights owns detecting, surfacing and capturing the signed decision, and stops at the signature.*
