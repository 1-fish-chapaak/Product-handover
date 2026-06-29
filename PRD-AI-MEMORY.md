# PRD — AI Insights from Memory (Insight Memory Engine surfaces)

**Status:** Draft v1 · **Scope:** Hackathon demo + Internal alpha · **Last updated:** 2026-06-28 · **Branch:** `AI-memory`

> How IRA stops being amnesiac. Today every run starts from zero: the same clarification is asked again, two analysts answer the same question differently, a risk obvious across six runs is invisible in any one, and a re-run re-pays full price even when nothing changed. This PRD adds a **memory layer** — surfaced across three product surfaces — backed by the Insight Memory Engine described in `auditify_ai_flow`. Companion to [PRD-CHAT-EXPERIENCE.md](PRD-CHAT-EXPERIENCE.md) and [PRD-WORKSPACE-EDIT.md](PRD-WORKSPACE-EDIT.md).

---

## 1. Problem statement

IRA has no institutional memory. Each surface fails the same way — it forgets.

| Symptom | Where it bites | What's wrong |
|---|---|---|
| Repeated clarifications | Chat | "Which column is `total_revenue`?" gets asked every session, even after the user answered it last week. |
| No shared source of truth | Cross-workflow | One analyst folds shipping into COGS, another lists it separately — same client, two answers. |
| Single-run blindness | Business Process | The same vendor flagged across 5 of 6 AP Ageing runs is never escalated, because no single run sees the recurrence. |
| Invisible drift | Business Process | The 90+ day bucket creeps +9–12% for four months straight; each run looks "fine." |
| Re-runs cost full price | Workflow Executor | Trident runs 30 unchanged spreadsheets monthly; every run re-pays a full plan + code-gen. |
| Silent source drift | Workflow Executor | Acme switches accounting systems, the amount column moves — the old saved mapping reads the wrong column, everything shows green, and the check is wrong. |

**Goal:** give IRA a governed, human-approved memory that (a) reuses prior answers instead of re-asking, (b) correlates signals across runs/workflows/entities/time to surface patterns no single run can, and (c) notices when the ground shifts and re-asks rather than silently trusting stale state.

### Design principle: heuristic-first, LLM-last, human-gated

Lifted directly from the engine architecture, and the spine of every surface here:

1. **Traceable detection first.** Patterns are found by deterministic rules, sliding windows and threshold crossings — not by a model. The LLM is invoked *only* to write the human-readable explanation, and only ever sees a structured evidence bundle, so it cannot hallucinate data it wasn't given.
2. **Confidence is a formula, not a vibe.** `confidence = frequency × source diversity × recency × business impact`, each factor 0–1. A threshold gates memory candidacy.
3. **Nothing becomes memory without a human.** Every insight is a *candidate* until an analyst approves it. Approval — with optional scope and expiry — is what promotes it to **Enterprise Context**, the shared memory every future run reads from. Every decision is logged.

This is what makes memory defensible in an audit context: LLM-grade reach on the way in, fully traceable evidence on the way out.

---

## 2. Surfaces & scope

| # | Surface | Feature | File(s) |
|---|---|---|---|
| A | **Workflow Executor** (output view) | Cross-workflow correlation · Output-vs-previous compare · Golden-record cost bypass · Source-drift re-ask | `workflow/WorkflowMemoryPanel.tsx`, injected into `workflow/WorkflowExecutor.tsx` |
| B | **Business Process** (Automation engagement) | New **AI Insights** tab: risks & patterns, KPI drift trend, confidence scoring, Human Approval Gate → Enterprise Context | `engagement-configurable/patterns/automation/AutomationInsightsTab.tsx` |
| C | **Chat** (Plan tab) | Fewer clarifications: assumptions recalled from memory with provenance + one-tap correct | `shared/PlanCards.tsx` (`AssumptionsCard`), seeded in `artifacts/ArtifactPanel.tsx` |
| — | **Shared data layer** | Engine types, 10 pattern types, confidence model, seed insights, entity index, golden records, assumption provenance | `data/insightMemory.ts` |

The data layer is token-agnostic (no JSX, no colour classes) so each surface renders it in its own design system: the Executor and Chat use `ink/brand/canvas/compliant/mitigated/risk`; the Business Process tab uses the Automation workspace palette (`text/primary/surface-2` + `red/amber/emerald`).

---

## 3. The 10 pattern types

The engine detects ten pattern types; severity bands them. The four HIGH patterns are the demo spine.

| Severity | Pattern | Definition | Seeded example |
|---|---|---|---|
| **High** | Recurring Output Anomaly | Same entity flagged across multiple runs of one workflow | Apex flagged in 5 of last 6 AP Ageing runs |
| **High** | KPI Trend Drift | A KPI moves consistently across consecutive periods | 90+ day bucket +9–12% over 4 months |
| **High** | Cross-Workflow Correlation | Same entity surfaces in ≥2 unrelated workflows | Apex in Duplicate Detection *and* PO Leakage |
| **High** | Memory Conflict | A new run contradicts a promoted Enterprise Context fact | Acme amount column moved vs approved mapping |
| **High** | Cohort Anomaly | Entity consistently deviates from its peer baseline | (taxonomy; not seeded as a card in v1) |
| **Med** | Schema Decay | Structural mismatches increasing — source-system change signal | — |
| **Med** | User Override Pattern | Analysts keep dismissing the same warning — stale rule | GST rounding warning dismissed 7× |
| **Med** | Emerging Trend | Metric stable for months, sharp move in last runs | — |
| **Low** | Workflow Efficiency Gap | Workflow consistently triggers manual follow-ups | Three-Way Match → manual on ~40% of runs |
| **Low** | Distribution Engagement Gap | Recipients never act on a distributed output | — |

---

## 4. Surface A — Workflow Executor

Rendered in the `complete` output view, beneath the results table, as a **"What memory knows about this run"** section.

### 4.1 Source-drift re-ask (Memory Conflict)
A banner that **interrupts blind trust** in a green result. States plainly: the run completed, but read the new layout against the old saved mapping. Shows a before/after of the changed column (`Amount = column F` → `column H (moved)`). Actions: **Re-confirm mapping** (updates memory) or **Keep old mapping** (flagged for next run). This is the Acme case — memory's job is to *notice the change and ask again*.

### 4.2 Golden-record cost bypass
A compact badge: *"80% of this run replayed from memory."* Inputs matched a frozen golden record, so most steps replayed deterministically; only the steps whose inputs changed ran live. Shows `cached cost` vs struck-through `fresh cost` (`$0.04` vs `$0.34`). This is the Trident case — unchanged re-runs shouldn't re-pay full price.

### 4.3 Cross-workflow correlation
Per-entity memory rows: for each flagged entity in *this* run, what memory has seen in *other* runs and *other* workflows (Apex → AP Ageing 5/6 runs + PO Leakage). Entities on a promoted Enterprise Context watch get an **On watch** marker. Each results-table row also carries an inline marker (`On watch` / `Seen in N`).

### 4.4 Output compare (vs previous run)
A diff against the previous run of the same workflow: **New this run**, **Resolved since last run**, carried-over count, and KPI deltas (current vs previous, with up/down direction). Turns a flat result into "what changed."

---

## 5. Surface B — Business Process · AI Insights tab

A new tab in the Automation (Business Process) engagement workspace, between **Workflows** and **Cases**.

**Layout (top → bottom):**
1. **Header** — "AI Insights · Patterns memory learned across N runs of the {process} process," with a **How memory works** toggle (the four-principle explainer: heuristic-first, correlated-across-runs, confidence-scored, human-gated).
2. **Stat strip** — Candidates pending · High severity · Runs analysed · In Enterprise Context.
3. **Insight cards, grouped by severity** (High → Med → Low). Each card carries:
   - Pattern-type badge, severity pill, detection-provenance chip (**Traceable rule** / **Formula** / **LLM explanation**), and a clickable **confidence pill** that opens the four-factor breakdown (`freq × diversity × recency × impact`, with the candidacy gate).
   - LLM-written title + description, an optional KPI **sparkline** (drift/emerging), a Memory-Conflict callout where relevant.
   - Expandable **Evidence** bundle (runs analysed, time window, workflow chips, entity chips, KPI values, source runs).
   - A **Recommended action**.
   - The **Human Approval Gate**: `Approve & promote` / `Adjust scope` / `Dismiss`. Adjust-scope reveals scope presets (All AP workflows / This business process / This workflow only) and expiry presets (No expiry / 30 / 90 days).
4. **Enterprise Context panel** — the governed institutional memory. Seeded entries (e.g. *"`total_revenue` maps to Net Sales,"* *"Shipping is a separate expense line, never folded into COGS"*) plus anything promoted this session. Each shows fact, scope, origin, approver, date, optional expiry.

**State:** approve → entry appears in Enterprise Context with its scope/expiry; dismiss → muted, with copy that memory *may re-surface it if the signal strengthens*; both are undoable. (Demo state is local; persistence is out of scope for v1.)

---

## 6. Surface C — Chat · fewer clarifications

The shared `AssumptionsCard` (Plan tab, used by both chat and the executor workspace) gains an optional **memory provenance** row per assumption.

When an assumption was recalled rather than asked:
- Its value carries a **From memory** chip (or **Enterprise memory** if governed), the source + when the user set it, and a **"N% still applies"** confidence chip.
- A one-tap **"Not right? Correct it"** seeds the composer with the exact question memory spared the user (e.g. *"Which column is `total_revenue` — Net Sales or Gross Sales?"*), so a wrong recall is a single correction, and re-teaches memory.
- The card header summarises the payoff: *"…saved you 2 clarifications."*

This is the inverse of the clarification engine: a high-confidence prior answer means IRA **proceeds silently with a visible assumption** instead of gating the user with a question it already knows the answer to.

---

## 7. UI rules

- **Memory is always attributed.** Every recalled value, every insight, every cost saving names its source (a run, a workflow, a promoted fact). No unsourced "AI says."
- **Provenance chips** distinguish detection method: Traceable/Formula (deterministic, `emerald`) vs LLM explanation (`primary`). The model only writes prose.
- **Severity palette** (Business Process tab): High `red`, Med `amber`, Low `slate`. Confidence: ≥70% `emerald`, ≥ gate `amber`, below gate `slate`.
- **The approval gate is never skippable and never auto-approves.** Promotion is an explicit, logged human action.
- **Conflicts and drift use warning tone, not error tone** — they're findings, not failures. Memory Conflict / source-drift = `mitigated`/`amber`.
- **Source drift blocks trust, not the run.** The run still completes; the banner prevents *acting on it* unverified.
- Memory surfaces are **collapsible** and default-open in the demo; at rest they shouldn't dominate the primary result.

---

## 8. Edge cases

| # | Scenario | Expected |
|---|---|---|
| M1 | Recalled assumption is wrong | "Correct it" seeds the original clarification; user overrides in one turn; memory updates. |
| M2 | Confidence below the candidacy gate | Insight still shown, confidence pill reads "below gate," approval still allowed (human can override the threshold). |
| M3 | Memory Conflict — new run contradicts promoted fact | Surface in both the Executor (source-drift banner) and the Business Process tab (Memory Conflict card). Never silently overwrite the promoted fact. |
| M4 | User dismisses an insight | Muted state, undoable; copy notes the engine may re-surface it if the signal strengthens. Never deleted outright. |
| M5 | Golden-record partial match (some inputs changed) | Reuse % < 100; the changed steps are listed as "ran live." |
| M6 | No prior run to compare against | Output-compare section hides; cross-workflow correlation may still apply. |
| M7 | Promoted fact past its expiry | (v1) shown with an amber expiry note in Enterprise Context; auto-expiry enforcement is out of scope. |
| M8 | Two analysts, conflicting answers | Enterprise Context is the single shared source of truth — the promoted fact wins; divergence becomes a Memory Conflict, not two silent answers. |

---

## 9. Acceptance criteria

- **AM1.** Executor `complete` view shows the memory section: source-drift banner, golden-record badge, cross-workflow correlation, output compare.
- **AM2.** Re-confirm / Keep on the source-drift banner resolves it inline with a confirmation.
- **AM3.** Apex's results row shows an **On watch** marker; its memory row lists AP Ageing + PO Leakage.
- **AM4.** Golden-record badge shows reuse %, cached vs fresh cost, and the steps that ran live.
- **AM5.** Business Process gains an **AI Insights** tab; insights group by severity; the four HIGH patterns render.
- **AM6.** Confidence pill opens a four-factor breakdown; the formula and candidacy gate are shown.
- **AM7.** Evidence bundle expands to runs/time-window/workflows/entities/KPIs/source-runs.
- **AM8.** `Approve & promote` moves the insight into the Enterprise Context panel with its scope/expiry; `Dismiss` mutes it; both are undoable.
- **AM9.** Chat Plan tab shows ≥1 memory-backed assumption with provenance + confidence, and "saved you N clarifications."
- **AM10.** "Correct it" on a recalled assumption seeds the composer with the original clarifying question.

---

## 10. Dependencies (stubs for hackathon)

| Surface | Contract | Stub |
|---|---|---|
| Pattern detection | `detectPatterns(runs)` → `MemoryInsight[]` | Static `PROCESS_INSIGHTS` seed in `insightMemory.ts` (deterministic) |
| Confidence scorer | `computeConfidence(factors)` → `0..1` | Literal PRD formula (product of four factors); `MEMORY_CANDIDATE_THRESHOLD = 0.45` |
| Entity resolver | `resolveEntity(name)` → `EntityMemory` | `ENTITY_MEMORY` keyed by vendor display name |
| Output compare | `compareToPrevious(run)` → `OutputCompare` | `RUN_OUTPUT_COMPARE` seed |
| Golden record | `goldenRecordFor(inputs)` → `GoldenRecordStatus` | `RUN_GOLDEN_RECORD` seed |
| Assumption recall | `recallAssumptions(query)` → `PlanAssumption[]` with `memory` | Seeded in `ArtifactPanel` `PLAN_ASSUMPTIONS` |
| Approval / promotion | `promote(insight, scope, expiry)` | Local React state; appends to `ENTERPRISE_CONTEXT` view |

---

## 11. Out of scope (v1)

- Real persistence of approvals across sessions/tenants · enforced expiry · the full 18-stage ingestion/code-gen AI map (this PRD is only the **memory** layer) · Cohort Anomaly / Schema Decay / Emerging Trend / Distribution Gap cards (taxonomy present, not all seeded) · automatic memory write-back from a corrected assumption · multi-tenant governance roles on the approval gate · diffing more than one run back.

---

## 12. Success metrics

| Metric | Baseline | Target |
|---|---|---|
| Clarifications re-asked that memory could have answered | ~100% | < 30% |
| Cross-run risks escalated before they're flagged manually | ~0 | Surface 100% of recurring-anomaly + cross-workflow patterns in the process |
| Cost per unchanged re-run | full plan + code-gen | ≤ 20% via golden records |
| Silent source-drift incidents (green-but-wrong) | unbounded | 0 — every drift caught and re-asked before the result is trusted |
| Insights promoted to Enterprise Context per process | 0 | Track adoption; no target yet |
