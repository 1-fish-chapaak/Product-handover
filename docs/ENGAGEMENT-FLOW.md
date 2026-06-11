# Engagements — Live Audit Flow (end-to-end study)

> **Scope:** the **live, wired audit-engagement flow** — what a user actually
> navigates today. Excludes the dev-only V3 "Configurable Engagement" engine
> (`engagement-configurable/`), the standalone Final Report module
> (`engagement-final/`), and the dead/legacy components
> (`engagement/EngagementDetailView`, `ControlDetailDrawer`,
> `EngagementExecutionV2Placeholder` — imported by `App.tsx` but **not rendered**).
>
> Study date: 2026-06-05. Reflects code as studied on branch `polish/process-hub-v4`.
> Line numbers are pointers and may drift; component/function names are stable.
> This is a reference doc — **not committed** to the branch.

---

## 0. Data model & state (the spine)

### `src/data/engagements.ts`
The `Engagement` type + 13 seeds. The single most important field is **`type`**, which
drives tabs, KPIs, copy, and pipelines everywhere downstream:

- `type`: `Compliance` | `Internal Audit` | `Automation`
  - Automation also has a `subtype`: `CCM` | `Reconciliation` | `MIS` | `Forensic` | `Image Analytics` | `Custom`
- `process`: `P2P` | `O2C` | `R2R` | `S2C` | `ITGC` (+ `PROCESS_COLORS` map)
- `framework`, `owner`, `status` (`Active` | `In Progress` | `Planned` | `Review` | `Draft` | `Closed`)
- `periodStart/End`, `controls`, `health` (0–100), `openIssues`, `lastActivity`, `nextScheduled`

Seeds: `eng-1`…`eng-9` (the main library) plus `ef-*` rows used by the Final module demo.

### `src/data/engagement-activity.ts`
`ENGAGEMENT_ACTIVITY` — events keyed by engagement id (`eng-1`, `eng-3`, `eng-9` richly seeded).
`ActivityEvent` has 10 `ActivityType`s: `workflow_run`, `exception_fired/assigned/classified/closed`,
`evidence_uploaded`, `control_tested`, `comment_added`, `status_changed`, `signoff`.
Helpers: `dailyCounts()`, `formatDay()`, `formatChartDay()` (anchored on 2026-05-15),
`AVG_TIME_TO_CLOSE`. Feeds the Overview heatmap and the Action Trail tab.

### `src/data/engagement-exceptions.ts`
`EngagementException` (ref, engagementId, workflowId, severity `Critical`→`Low`,
status `Open`/`Triaging`/`Resolved`, optional `classification` + `amount`).
Two adapters:
- `exceptionsForEngagement(id)` → native rows (used by the Overview + Exception tabs)
- `exceptionsForEngagementAsGrc(id)` → maps to `GrcException` for the shared Case Management view

### State & routing
- `src/hooks/useAppState.ts`:
  - `openEngagement(id)` → view **`engagement-overview`**
  - `openAuditExecution(id)` → view `audit-execution` (callers immediately override to `engagement-detail`)
  - `openCaseManagement(id)` → view `engagement-case-management`
  - `selectedEngagementId` carries the target across views.
- `src/App.tsx` render cases: `engagements`, `engagement-overview`, `engagement-detail`,
  `engagement-case-management`, `engagement-compare`, `racm-full-editor`.

---

## Flow 1 — Engagement Library (entry)

**`App.tsx` `engagements` → `src/components/audit/EngagementsView.tsx`**

A library page with two modes via a large underline toggle (`ViewToggle`):

- **Overview mode → `EngagementsOverview.tsx`** (the portfolio snapshot):
  - 4 KPI tiles: Total Engagements / Active / Portfolio Health (avg of started) / Open Findings
  - **Portfolio breakdown** by Type / Status / Process — each row deep-links into the List, pre-filtered (`onGoToList`)
  - **Needs attention** — worst engagements ranked by `openIssues` then `health`, with a worst-open-exception severity dot
  - **Upcoming milestones** — parses the free-text `nextScheduled` into "hours from now" (`deadlineHours`)
  - **Recent activity** — flattened `ENGAGEMENT_ACTIVITY`, newest first
- **List mode** — filterable cards: search (name/owner/framework/code) + Type/Status/Process dropdowns (with counts). Each card: status pill, description, code/owner/period, process+framework tags, health bar (`effective/controls`), open-issues badge. Click → `onOpenEngagement(id)`.
- Header actions: **New Engagement** (→ wizard) and **Audit Planning Timeline** (→ `audit-planning`).

Newly created engagements live in `EngagementsView` local state (`created`), prepended to `ENGAGEMENTS`.

---

## Flow 2 — Create (`src/components/audit/CreateEngagementWizard.tsx`)

A 5-step wizard:

1. **Type** — Compliance / Internal Audit / Automation (each with tagline + tint).
2. **Basics** — name, code, period start/end, owner, reviewer (validated; reviewer ≠ owner, dates ordered).
3. **Type-specific config:**
   - Compliance → framework + RACM version + sampling method/size
   - Internal Audit → linked RACMs + TAT (turnaround) days
   - Automation → subtype + input sources + alert recipients + cadence
4. **Review** → 5. **Create** → `onCreated(eng)` prepends the new engagement to the list.

Step gating via `canAdvanceFrom`/`step{2,3}Valid`.

---

## Flow 3 — Engagement detail hub

**`App.tsx` `engagement-overview` → `src/components/audit/EngagementOverviewView.tsx`**
(default export is internally named `EngagementDetailView`). **Opened from the Engagements list.**

Wrapped in **`EngagementWorkspaceProvider`** (`src/components/audit/engagementWorkspace.tsx`) — a
React context that is the shared store for the testing tabs:
- `controls` = base controls from `racm.ts` `racmRowsForProcess(process)` (fallback `RACM_LIBRARY`) **+** user-added custom controls
- `racmControls` = custom controls flagged `inRacm`
- **bidirectional attribute ↔ workflow links** (seeded), so linking in Controls shows up in Workflows and vice-versa
- authoring: `addControl`, `addAttribute`, `linkWorkflow`, `unlinkWorkflow`

### Tabs are **type-driven** (`tabsForType`), reorderable (drag) and hideable
Persisted to `localStorage` per **type** (`eng-tab-prefs:<type>`):

| Type | Tabs |
|---|---|
| **Compliance** | Overview · RACM · Controls · Evidence · Working Paper · Action Trail · Config |
| **Internal Audit** | Overview · RACM · Controls · Workflows · Exception Mgmt · **Audit Report** · Action Trail · Config |
| **Automation** | Overview · Workflows · Exception Mgmt · Action Trail · Config |

Header: process badge, name, status + type pills, description, big health % (labelled "Pass Rate"
for Automation, "Effective" otherwise). Internal Audit also shows a 6-KPI strip.

### Tab contents
- **Overview — `HealthOverviewTab`**: type-aware dashboard:
  - 4 KPIs (Workflows/Controls, Open findings/exceptions, In-progress, Health/Pass-rate)
  - severity **donut**, exceptions-**by-workflow bar**, 14-day **heatmap** (from activity)
  - **pipeline funnel** that differs per type:
    - Automation: Fired → Triaged → Classified → Closed
    - Compliance: Scoped → Walkthrough → Sampled → Tested → Working paper → Reviewed → Signed-off (derived from `health`)
    - Internal Audit: Planning → Announcement → IDR → Analysis → Issues sheet → Discussion → Final report → Audit Committee (derived from `status`)
  - linked-workflow effectiveness + per-workflow config
- **RACM — `RACMTab.tsx`**: per-sub-process RACM library; the two-card **"New RACM"** flow (Upload a RACM / Upload an SOP → extract) + `ExtractionOverlay`; opening a RACM → full-page editor (`onOpenFullEditor`).
- **Controls — `ControlsTab.tsx`**: workspace controls with derived status (Effective / In Test / Failed / Pending), frequency filter, linked workflows, evidence files, samples, AI suggestions, working-paper status. `WorkflowMapModal`, `AddControlModal`. **"Test evidence"** → jumps to the Evidence tab targeting that control (`onTestEvidence`).
- **Evidence — `EvidenceTab.tsx`**: per-control **population → sampling → attribute testing**. Sample methods: Random / Statistical / Column-filter / Workflow. Each attribute gets an AI verdict (Pass/Fail/Hold) + human verdict; tracks working-paper readiness. Can open targeted from Controls (`openControlId`).
- **Workflows — `WorkflowsBySubProcess`** (in `EngagementOverviewView.tsx`): accordion by sub-process; configure/open/create workflows.
- **Exception Management — `ExceptionManagementTab`**: slim per-workflow summary; **"Manage" opens the full Case Management in a NEW browser tab** (`openCaseWorkspace`, deep-linked with severity/workflow/status).
- **Working Paper / Audit Report — `WorkingPaperTab.tsx`**: per-control working papers (title flips to "Audit Report" for Internal Audit).
- **Action Trail — `ActionTrailTab`**: event feed + new/closed chart, filterable by category, from `ENGAGEMENT_ACTIVITY`.
- **Configuration — `EngagementConfigTab`**: edit engagement fields (owner, dates, status, process, framework) + show/hide tabs.

Drill-downs from Overview route to the relevant **sub-tab in the same window**; only Exception
Management opens the deep Case Management surface in a new tab.

---

## Flow 4 — Control execution (the *other* testing surface)

**`App.tsx` `engagement-detail` → `src/components/engagement-execution-v2/EngagementExecutionV2.tsx`**
**Reached from Audit Planning / Programs / Process Hub — NOT from the engagement overview.**

- Engagement header (audit type, framework, period, process, owner, reviewer) + status
- **7 KPI cards**: Total / Not Started / In Progress / Pending Review / Concluded / Effective / Ineffective
- **Linked RACM snapshot** ("Locked") → **Open RACM** modal embedding `RacmMappingWorkspace` + an Upload-RACM dropzone
- Toolbar: search + status filter chips
- **Controls table** columns: Control ID, Name, Type, Workflow Coverage, Exec Status, Pop/Samples, Evidence, Attr Testing, Review, Conclusion, **Next Action**
- Click a control → **`ExecutionControlWorkspaceV2.tsx`** (≈4.2k lines), a per-control **step machine**:
  `Overview → Request PBC → Samples (Unified/Configure) → Attribute Testing → Working Paper → Review → Conclusion`,
  plus an Audit Trail step. Steps are gated/locked by availability; `LockedStep` shows the reason.

### State machine (`src/components/engagement-execution-v2/types.ts`)
- `ControlExecStatus`: `NOT_STARTED → POPULATION_READY → TEST_ITEMS_READY → EVIDENCE_IN_PROGRESS → EVIDENCE_READY → TESTING_IN_PROGRESS → TESTING_COMPLETE → PENDING_REVIEW → CONCLUDED`
- `ReviewStatus`: NOT_SUBMITTED / PENDING / APPROVED / REJECTED
- `ConclusionValue`: EFFECTIVE / INEFFECTIVE
- `WorkingPaperStatus`: NOT_GENERATED / DRAFT / GENERATED / FINAL
- `EngagementStatus`: DRAFT / ACTIVE / IN_REVIEW / COMPLETED

Backed by `mockExecutionData.ts` (`MOCK_ENGAGEMENT_V2`), display maps in `executionState.ts`,
and pure `derive*` helpers in `helpers.ts` (`deriveControlType`, `deriveWorkflowCoverage`,
`deriveNextAction`, `deriveNextStepId`, `deriveTestingProgress`, `deriveEngagementKpis`).
`AttributeTestingStepV2.tsx` is the heavy attribute-testing step.

---

## Flow 5 — Exceptions / Case Management

- From the Overview/Exception tab → **`EngagementExceptionDrawer.tsx`**: classify
  (Control Deficiency / Process Gap / False Positive / Other), assign owner, set priority.
- **"Manage" → Case Management** (`App.tsx` `engagement-case-management` → reference
  `ManageExceptionsView`, fed by `exceptionsForEngagementAsGrc(id)`), opened in a new tab and
  deep-linkable with `severity` / `workflow` / `status` query params.

---

## Flow 6 — Compare

**`App.tsx` `engagement-compare` → `src/components/audit/EngagementCompareView.tsx`**
Pick **2–4** engagements (defaults eng-1/3/6) → side-by-side comparison of health,
exception trends, and MTTR.

---

## ⚠️ Notable findings (non-obvious)

1. **Two parallel control-testing implementations, reached from different entry points.**
   Opening an engagement from the **Engagements list** lands on the **tabbed hub**
   (`EngagementOverviewView`) whose **Controls + Evidence tabs** are one testing model
   (data via the `engagementWorkspace` store from `racm.ts`). Opening the **same engagement**
   from **Audit Planning / Programs / Process Hub** lands on **Execution V2**
   (`engagement-detail`) — a *different*, more rigorous state-machine model (data from
   `mockExecutionData`). Same engagement → two different UIs and data models depending on origin.

2. **`onOpenExecution` is dead in the overview.** `EngagementOverviewView` declares and
   destructures it but never calls it — there is no path from the engagement hub into
   Execution V2. `App.tsx` wires it but it is unused.

3. **`audit-execution` view is vestigial.** `openAuditExecution` sets view `audit-execution`,
   but every caller immediately `setView('engagement-detail')`, so the standalone
   `AuditExecution.tsx` never renders via this path.

4. **Tab prefs persist globally per type.** Reordering/hiding tabs on one Compliance engagement
   (`localStorage` key `eng-tab-prefs:Compliance`) changes them for **all** Compliance engagements.

5. **Layered mock data.** The overview tabs read RACM/control data from `racm.ts` (shared with the
   Process Hub), while Execution V2 has its own `mockExecutionData` seed — consistent with the
   broader "same entity, multiple non-reconciling datasets" pattern seen across the app.

---

## File index

| File | Role |
|---|---|
| `src/data/engagements.ts` | `Engagement` model + 13 seeds, `PROCESS_COLORS` |
| `src/data/engagement-activity.ts` | Activity events + helpers (Action Trail, heatmap) |
| `src/data/engagement-exceptions.ts` | Exceptions + `exceptionsForEngagement[AsGrc]` adapters |
| `src/components/audit/EngagementsView.tsx` | Library page (Overview ⇄ List) |
| `src/components/audit/EngagementsOverview.tsx` | Portfolio snapshot |
| `src/components/audit/CreateEngagementWizard.tsx` | 5-step create wizard |
| `src/components/audit/EngagementOverviewView.tsx` | Engagement detail hub (tabs) + Overview/Exception/Trail/Config/Workflows internals |
| `src/components/audit/engagementWorkspace.tsx` | Shared workspace store (controls + attribute↔workflow links) |
| `src/components/audit/RACMTab.tsx` | RACM library tab + New RACM flow |
| `src/components/audit/ControlsTab.tsx` | Controls tab (workspace controls, testing) |
| `src/components/audit/EvidenceTab.tsx` | Evidence: population → sampling → attribute testing |
| `src/components/audit/WorkingPaperTab.tsx` | Working Paper / Audit Report |
| `src/components/audit/EngagementExceptionDrawer.tsx` | Classify/assign one exception |
| `src/components/audit/EngagementCompareView.tsx` | Compare 2–4 engagements |
| `src/components/engagement-execution-v2/EngagementExecutionV2.tsx` | Execution workspace (controls table) |
| `src/components/engagement-execution-v2/ExecutionControlWorkspaceV2.tsx` | Per-control step machine |
| `src/components/engagement-execution-v2/{types,executionState,helpers,mockExecutionData}.ts` | State machine + derived helpers + seed |
| `src/components/engagement-execution-v2/AttributeTestingStepV2.tsx` | Attribute-testing step |
