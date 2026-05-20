# Engagement Execution V2 Memory

> Source of truth for the Execution V2 rebuild. Read before every prompt. Update after every decision.

---

## 1. Purpose

The old Engagement Execution module had broken/conflicting states, hardcoded fake progress, and showed Effective/Ineffective conclusions before any testing or review happened. It was tightly coupled and difficult to extend.

Execution V2 is a ground-up rebuild with:
- Clean state machine (no fake progress)
- Proper lifecycle (conclusion only after reviewer approval)
- Isolated files (no patching old code)
- Industry-aligned audit flow (RACM → Control → Assertion → Attribute → Workflow → Population → Sampling → Evidence → Testing → Review → Conclusion → Working Paper)

Old execution files are kept in the repo for rollback but are detached from the main UI flow.

---

## 2. Non-Negotiable Product Rules

1. **RACM** defines WHAT needs to be tested.
2. **Control** defines the testing objective.
3. **Assertion** defines audit intent (e.g., Accuracy, Authorization, Occurrence).
4. **Attribute** defines a specific testable condition within an assertion.
5. **Workflow** defines HOW an attribute is tested (automated script or manual procedure).
6. **One control can have multiple workflows.** Workflows are mapped to attributes.
7. **Population Builder** prepares the dataset to test against.
8. **Sampling Engine** selects test items from prepared population. Sampling is NOT workflow. Workflow is NOT sampling.
9. **Manual controls may not require population.**
10. **Evidence** belongs to a sample/test item, not directly to a control. Attributes reference evidence from the sample/test item.
11. **Attribute testing** happens per sample × attribute intersection.
12. **Sample result** is derived from its attribute results (not manually set).
13. **Control conclusion** is derived ONLY after reviewer approval — never before.
14. **Working paper** is a system-generated audit output, not manually authored.

---

## 3. What We Must Not Do

- Do NOT patch the old broken execution flow — build fresh.
- Do NOT delete old files unless explicitly instructed.
- Do NOT show Effective / Ineffective / Concluded before review approval.
- Do NOT treat sampling as workflow (they are separate concerns).
- Do NOT treat workflow as sampling.
- Do NOT assume one control has only one workflow (multi-workflow is supported).
- Do NOT assume every control requires population (manual controls may skip).
- Do NOT store evidence directly on control (evidence belongs to sample/test item).
- Do NOT hardcode fake completed states or progress.
- Do NOT use completed demo data as default fresh execution state.
- Do NOT add features beyond what the current prompt asks.

---

## 4. Core Architecture

```
RACM
  └── Control (from Control Library snapshot)
        ├── Assertions (audit intent)
        │     └── Attributes (testable conditions)
        │           └── Workflow Mapping (how to test each attribute)
        └── Engagement Execution
              ├── Population / Test Items (dataset + sampling)
              ├── Evidence (per test item)
              ├── Attribute Testing (per sample × attribute)
              ├── Review (reviewer approval gate)
              ├── Conclusion (derived after approval)
              └── Working Paper (system-generated output)
```

**Key relationships:**
- One control can have multiple workflows.
- One workflow can cover multiple attributes.
- One attribute belongs to one assertion.
- Evidence is mapped to specific attributes on specific samples.
- Sample result = f(attribute results for that sample).
- Control conclusion = f(all sample results) + reviewer approval.

---

## 5. Control Types

### Automated
- Has automated workflow(s) that run against population data.
- Flow: Overview → Population → Execution Mode → Samples/Test Items → Attribute Testing → Working Paper → Review → Conclusion
- Population is required.
- Sampling can be Full Run or Statistical.

### Manual
- Has manual workflow(s) — human performs the test.
- Flow: Overview → Create Samples → Evidence Upload → Attribute Testing → Working Paper → Review → Conclusion
- Population may be skipped (samples created directly).
- Evidence upload is critical.

### Hybrid
- Mix of automated and manual workflows on the same control.
- Flow: Overview → Population → Execution Mode → Samples/Test Items → Evidence → Attribute Testing → Working Paper → Review → Conclusion
- Both automated results and manual evidence collection required.

---

## 6. State Machine

### Control Execution States

```
NOT_STARTED
  │
  ▼
POPULATION_READY          (population uploaded/snapshot created)
  │
  ▼
TEST_ITEMS_READY          (samples generated from population)
  │
  ▼
EVIDENCE_IN_PROGRESS      (evidence collection started)
  │
  ▼
EVIDENCE_READY            (all required evidence uploaded)
  │
  ▼
TESTING_IN_PROGRESS       (attribute testing started)
  │
  ▼
TESTING_COMPLETE          (all sample × attribute tests done)
  │
  ▼
PENDING_REVIEW            (submitted for reviewer approval)
  │
  ├── REJECTED            (reviewer sent back for rework)
  │     │
  │     └── → TESTING_IN_PROGRESS (rework cycle)
  │
  ▼
CONCLUDED                 (reviewer approved, conclusion set)
```

### Conclusion Rule

```
IF review.status === 'APPROVED':
  conclusion = derived from sample results:
    - ALL samples PASS → EFFECTIVE
    - SOME samples FAIL but within tolerance → PARTIALLY_EFFECTIVE
    - Failures exceed tolerance → INEFFECTIVE
ELSE:
  conclusion = null (NEVER set before approval)
```

### Fresh Engagement Rule
Every control in a new engagement starts at:
- `status = NOT_STARTED`
- `conclusion = null`
- No population, no samples, no evidence, no attribute results, no review.

---

## 7. Canonical Data Objects

| Object | Purpose |
|--------|---------|
| `EngagementExecution` | Top-level engagement with metadata + controls array |
| `ExecutionControl` | Control instance within engagement, holds execution state |
| `Assertion` | Audit intent (e.g., Accuracy). Lives on control. |
| `Attribute` | Testable condition within an assertion. Lives on workflow. |
| `WorkflowMapping` | Links a workflow (with its attributes) to a control |
| `PopulationSnapshot` | Dataset uploaded/snapshotted for testing |
| `TestItem` / `SampleItem` | Individual item selected from population for testing |
| `Evidence` | File uploaded against a specific test item, mapped to attributes |
| `AttributeResult` | Pass/Fail/N-A/Pending result for one attribute on one sample |
| `ReviewState` | Reviewer's decision: Approved / Rejected / Pending + comments |
| `Conclusion` | Effective / Partially Effective / Ineffective — only after approval |
| `WorkingPaper` | System-generated audit output document |

---

## 8. UI Flow

### All Control Types (Simplified Final Flow)
```
Overview → Samples → Attribute Testing → Working Paper → Review → Conclusion
```

- User uploads/creates sample data in Samples step
- "Execute Testing" runs automated checks and opens Attribute Testing
- Manual attributes tested by user in Attribute Testing
- Evidence attached contextually per attribute in Attribute Testing
- Population Builder and Execution Mode removed from user-facing flow

### Step Availability Rules
- Population step: available when status >= NOT_STARTED (except pure Manual which skips)
- Sampling step: available when population is ready
- Evidence step: available when test items exist
- Testing step: available when evidence exists (or for automated, after workflow run)
- Review step: available when all testing is complete
- Conclusion step: available only after review is approved

---

## 9. Centralized Helper Functions

| Function | Purpose |
|----------|---------|
| `deriveControlType(workflows)` | Returns Automated / Manual / Hybrid based on workflow types |
| `deriveWorkflowCoverage(control)` | Returns 0-100% based on assertion coverage by workflows |
| `deriveSampleResult(sample)` | Returns PASS / FAIL / EXCEPTION / UNTESTED from attribute results |
| `deriveControlConclusion(control)` | Returns Effective / Partial / Ineffective / null based on samples + review |
| `deriveNextAction(control)` | Returns the next step label for the control based on current status |
| `deriveStepAvailability(control)` | Returns which steps are unlocked based on current state |
| `deriveEngagementKpis(controls)` | Returns summary counts: total, not-started, in-progress, reviewed, etc. |

All helpers must be **pure functions** — no side effects, no state mutations. They derive from current data.

---

## 10. Implementation Guardrails

1. **Isolated files**: All V2 code lives in `src/components/engagement-execution-v2/`.
2. **Old code preserved**: Old execution files in `src/components/engagement/` and `src/components/execution/` are NOT deleted.
3. **Detached routing**: `App.tsx` routes `engagement-detail` view to V2 placeholder. Old components remain importable but unreachable from main flow.
4. **No cross-contamination**: V2 does not import from old execution components. Old components do not import from V2.
5. **Centralized state derivation**: All computed values (status, readiness, conclusion, next action) are derived via helper functions, never stored.
6. **No duplicate logic**: If a helper exists, use it. Don't re-derive the same thing in the component.
7. **Only do what the prompt asks**: Do not anticipate or add features beyond the current prompt scope.

---

## 11. Open Questions

- [ ] Should population upload support multiple file formats or just CSV?
- [ ] What is the exact tolerance threshold for Partially Effective vs Ineffective?
- [ ] Should Working Paper generation be automatic on review approval or manual trigger?
- [ ] How does re-testing after rejection work — does it clear all previous results or allow incremental fixes?
- [ ] Should the V2 module support multi-round testing (Round 1, Round 2, etc.)?

---

## 12. Change Log

| Date | Change |
|------|--------|
| 2026-05-04 | Created V2 memory file. Documented all product rules, state machine, data objects, UI flows, and guardrails. |
| 2026-05-04 | Created `EngagementExecutionV2Placeholder.tsx` — temporary placeholder while old UI is detached. |
| 2026-05-04 | Detached old execution UI: `App.tsx` routes `engagement-detail` to V2 placeholder instead of `EngagementDetailView`. Old files preserved. |
| 2026-05-04 | Entry points mapped: ProgramsView, BusinessProcesses, AuditPlanningPage all flow through `openAuditExecution` → `setView('engagement-detail')` → now hits V2 placeholder. |
| 2026-05-04 | Execution protocol locked: staged build plan (15 steps), context-is-not-scope rule, memory file read/update on every prompt. |
| 2026-05-04 | Refined product rules: added multi-workflow, sampling≠workflow, manual controls may skip population, attributes reference evidence from sample, no demo data as default state. |
| 2026-05-04 | Step 3: Created types.ts (all canonical types + const enums), executionState.ts (display styles + KPI derivation), helpers.ts (7 pure helpers), EngagementExecutionV2.tsx (minimal shell, not wired). All compile. |
| 2026-05-04 | Step 3b: Replaced mock data with 3 realistic controls — C001 Budget Planning (Manual, 1 workflow, 4 attrs), C002 Three-way Match (Hybrid/IT-Dependent, 4 workflows, 4 attrs), C003 Duplicate Detection (Automated, 2 workflows, 3 attrs). Engagement: FY26 Procurement Controls Testing, SOX ICFR. All fresh state. |
| 2026-05-04 | Step 4: Implemented 9 centralized helpers in helpers.ts — deriveControlType, deriveWorkflowCoverage (returns rich object), deriveSampleResult (checks required attrs), deriveControlConclusion (null unless APPROVED), deriveEvidenceStatus, deriveTestingProgress (manual/automated split), deriveNextAction (full state machine), deriveStepAvailability (enabled/reason per step), deriveEngagementKpis. executionState.ts cleaned to display-only constants. |
| 2026-05-04 | Step 2 verified: Old execution detached, placeholder wired, old files preserved (10 files across engagement/ and execution/). Three entry points (ProgramsView, BusinessProcesses, AuditPlanningPage) all route to V2 placeholder. |
| 2026-05-04 | Step 5: Built EngagementExecutionV2.tsx — engagement header (6 metadata fields), 7 KPI cards (from deriveEngagementKpis), controls table (11 columns), all using derived helpers. No routing wired yet. All fresh state, no fake progress. |
| 2026-05-04 | Step 6: Created ExecutionControlWorkspaceV2.tsx — drawer panel with dynamic step tabs by control type (Automated: 8 steps, Manual: 7 steps, Hybrid: 9 steps). Overview tab shows description, metadata, assertions grouped with attributes, linked workflows table, next action card. Locked steps show lock icon + reason + CTA to previous enabled step. Enabled-but-unbuilt steps show placeholder. Wired into main page replacing inline placeholder. |
| 2026-05-04 | Step 7: Implemented Create Samples step for Manual controls. Manual add form (Ref ID, Description, Owner, Period, Notes) + demo samples (S-001 to S-004 budgets). Creates TestItems with attributeResults initialized per attribute (NOT_TESTED, MANUAL source). Sets status to TEST_ITEMS_READY. State persists via onUpdateControl → parent setEngagement. Samples table shows count + attribute count. Remove sample resets to NOT_STARTED if empty. Next step CTA → Evidence. |
| 2026-05-04 | Step 8: Implemented Population step for Automated/Hybrid controls. 3 states: (1) No population → Demo/Upload/Builder cards, (2) Preview → first 5 rows table + Lock CTA, (3) Locked → snapshot details (ID, source, rowCount, checksum, lockedAt, testUnit). Demo data: C002 has 10 invoice/PO rows, C003 has 8 duplicate-detection rows. On lock: creates PopulationSnapshot, sets status=POPULATION_READY. NO sampling method on this page. Next CTA → Execution Mode. |
| 2026-05-04 | Step 9: Implemented Execution Mode + Samples steps. ExecutionMode: Full Run (creates testItems from all pop rows) vs Sampling (navigates to Samples step). Samples: if FULL_RUN shows items table; if SAMPLING shows config panel (Random method, sample size input, preview, "Select Transactions" CTA). On generate: creates testItems with attributeResults initialized (NOT_TESTED, AUTO/MANUAL source), status=TEST_ITEMS_READY. Shared TestItemsTable component. Next step: Evidence (Hybrid) or Attribute Testing (Automated). |
| 2026-05-04 | Step 10: Implemented Evidence step. Per-sample evidence table with expand to see files. Upload flow: select evidence type (9 options) → auto-suggest attribute mappings by type → checkbox to edit mappings → add. Demo evidence button adds relevant files based on control attributes. On upload: creates Evidence object, updates attributeResults.evidenceIds for mapped attrs, sets status to EVIDENCE_IN_PROGRESS. Remove evidence cleans up evidenceIds. Evidence status per item: Not Uploaded / Partial / Ready. Next CTA → Attribute Testing when all items have evidence. |
| 2026-05-04 | Step 11: Implemented Attribute Testing step. Progress panel (6 KPIs + bar). Per-sample accordion with assertion-grouped attributes. Manual attrs: Test button → Pass/Fail selector + notes (required on Fail) → Save. Automated attrs: show Not Tested (no manual edit). On save: updates attributeResult, derives sampleResult via deriveSampleResult, updates status (TESTING_IN_PROGRESS → TESTING_COMPLETE). No conclusion shown. Next CTA → Working Paper when all complete. |
| 2026-05-04 | Step 11b: Added mock automated workflow engine. "Run Automated Checks" button in Attribute Testing. Deterministic logic per attribute name: PO exists (check poNumber), GRN match (check grnQuantity>0), Invoice amount match (invoiceAmount===poAmount), Duplicate checks (duplicateFlag), Override auth (duplicateFlag+overrideApproved). Results stored with source=AUTO, notes="Auto-tested by [workflowName]". Manual attrs stay NOT_TESTED. After run: progress updates, sample results derive, status transitions. Completed banner when all auto checks done. |
| 2026-05-04 | Step 12: Implemented Working Paper tab. 9 structured sections: Header, Control Objective, Test Design (assertions/attrs/workflows), Population & Samples, Evidence Log, Attribute Testing Matrix (sample×attr grid with P/F/— cells), Sample Results (pass/fail/pending chips), Review & Approval status, Final Conclusion (unavailable until approval). Download Draft button (always), Final button (disabled until concluded). Before test items: shows placeholder message. Next CTA → Review when testing 100% complete. |
| 2026-05-04 | Step 13: Implemented Review step. 4 states: (1) Not Submitted — test summary + incomplete warning + failed attrs + Submit CTA. (2) Pending — reviewer decision screen with control/sample/evidence summary, failed attrs detail, comments field, Approve + Send Back buttons. (3) Approved — green confirmation + next CTA → Conclusion. (4) Rejected — red notice with reviewer comments + Fix Issues CTA → Attribute Testing. On Submit: status=PENDING_REVIEW, review=PENDING, workingPaper=GENERATED. On Approve: review=APPROVED, conclusion derived via deriveControlConclusion, status=CONCLUDED, workingPaper=FINAL. On Send Back: review=REJECTED, status=REJECTED, comments required. Conclusion never manually set — always derived from helper. |
| 2026-05-04 | Step 14: Implemented Conclusion tab. Locked state before approval (shows current review status + Go to Review CTA). After approval: large Effective/Ineffective banner with icon + reason + timestamp, test results summary (4 KPI cards), failed attributes detail list, review info (reviewer, date, comments), working paper link + final download button. Table/KPIs automatically reflect conclusion via live state: Conclusion column shows Effective/Ineffective badge, Status shows Concluded, Next Action shows View Conclusion, KPI effective/ineffective counts update. State persists on drawer close/reopen. |
| 2026-05-04 | Step 15: Wired EngagementExecutionV2 into App.tsx. `engagement-detail` case now renders EngagementExecutionV2 instead of placeholder. Back returns to engagementBackView (programs/audit-planning/business-processes). Old execution files + placeholder preserved but unreachable. Single file changed: App.tsx (import + case swap). |
| 2026-05-04 | Step 16 (QA): Fixed 3 bugs: (1) attributeTesting step was gated on EVIDENCE_IN_PROGRESS status — removed gate so automated controls can test directly after generating test items. (2) Review submit was only available for NOT_SUBMITTED — added REJECTED as valid resubmit state with "Resubmit for Review" label + previous rejection feedback banner. (3) Removed dead Rejected-state render block since canSubmit now handles both NOT_SUBMITTED and REJECTED. Working paper/review availability also updated to include REJECTED status. Build passes. |
| 2026-05-04 | Step 17 (Nav fix): Fixed broken step navigation. Added `deriveNextStepId` helper mapping action labels to step IDs. Added `initialStepId` prop to workspace (synced via useEffect). Table row action buttons now call `openControlWorkspace(controlId, stepId)`. Overview Next Step CTA now calls `onNavigate(deriveNextStepId(nextAction))`. All internal step CTAs (Build Population, Create Samples, etc.) properly navigate. Internal step IDs: overview, population, execution-mode, samples, create-samples, evidence, attr-testing, working-paper, review, conclusion. |
| 2026-05-04 | Step 18: Added assertion/attribute/workflow management to Overview tab. Add Assertion (inline form, duplicate check). Add Attribute per assertion (name, desc, type Auto/Manual, required, evidence types, workflow link). Link/unlink attribute to workflow (inline dropdown per attribute row with save/cancel). Add Workflow (name, version, type, select attributes to cover). Workflow table shows covered attributes + assertion chips. Unmapped warning shows count. All changes persist to parent via onUpdateControl. Assertion=grouping only, workflow mapping=attribute-level. |
| 2026-05-04 | Step 19: Added evidence from Attribute Testing. (1) Automated workflow run now creates system evidence per attribute (Workflow Run Log for pass, Exception Report for fail) stored on testItem.evidence with mappedAttributeIds. (2) Every attribute row has Attach/Evidence CTA → inline type selector (12 types incl. Exception Report, Workflow Run Log, Override Approval) → creates Evidence on testItem, links evidenceIds on attributeResult. (3) System evidence badge shown on auto-tested rows. (4) Helper text added. Evidence flows to Evidence tab + Working Paper. No types changes needed. |
| 2026-05-04 | FINAL SIMPLIFICATION: Removed Population and Execution Mode from user-facing flow. New unified flow for ALL control types: Overview → Samples → Attribute Testing → Working Paper → Review → Conclusion. |
| 2026-05-04 | Samples step: upload-only model. No manual entry, no demo button visible to user. Single "Upload Sample Data" CTA with file picker (CSV/XLSX). On upload: creates control-specific realistic testItems (invoices for C003, PO/GRN/INV for C002, budgets for C001). Preview table shows Sample ID, Reference, Value, Status. "Execute Testing" CTA after upload runs automated checks and navigates to Attribute Testing. |
| 2026-05-04 | Bulk Evidence Upload: "Bulk Upload Evidence" button in Attribute Testing. Supports multi-file select (+ folder via webkitdirectory). Auto-matches files to samples (by referenceId/description keywords) and evidence types (by filename keywords). Review panel shows file→sample→type→attrs mapping with editable dropdowns and Matched/Needs Review/Unmatched status. Apply creates Evidence on matched testItems and links attributeResult.evidenceIds. Existing per-attribute attach flow preserved alongside bulk upload. |
| 2026-05-04 | Evidence gating: Added `deriveEvidenceMatrixReadiness(ctrl)` helper — tracks sample × required attribute evidence completeness (e.g., 8/20). Run Automated Checks disabled until all required evidence slots filled. Progress bar shows "Evidence attached: X / Y" with amber/green states. Both bulk upload and individual attach update the readiness counter. |
| 2026-05-04 | Bulk upload v2: True folder upload via webkitdirectory + multi-file fallback. Matching uses file path + name: bulkInferSampleMatch (referenceId + description keywords, tolerates hyphens/underscores), bulkInferEvidenceType (ordered keyword matching for 11 types), bulkInferAttrMapping (evidence type → attribute keywords). Review table now has editable attribute multi-select chips per row + relative path display. deriveBulkStatus recalculates on edits. Apply only processes Matched rows, keeps unmatched in review with warning. Unrelated files shown as Unmatched with manual mapping option. |
| 2026-05-05 | Engagement View redesign: Simplified Process Hub → Engagement View table. Removed Progress bar, Effective, Failed, Pending, Remaining columns from default list. Added summary cards, search, row expansion, empty states. |
| 2026-05-05 | Engagement View v2 cleanup: Removed separate Scope column (redundant with engagement name). Merged process chip + audit period + alert tags into Engagement column. Renamed Health → Attention. Final 6 columns: Engagement, Type/Framework, Owner, Status, Attention, Next Action. Made summary cards more compact (horizontal layout). Improved spacing, row padding, hover states, and secondary text opacity for cleaner visual hierarchy. |
| 2026-05-11 | RACM mapped controls redesign: Each mapped control card now shows linked workflows inline (name, version, status badge) with attribute chips per workflow. Nature badge (Preventive/Detective) added to control headers. Remove control with inline confirmation showing impact (workflow/attribute count). Remove workflow via trash icon on hover. Risk-level summary shows readiness counts (N ready · N missing workflows · N needs setup). |
| 2026-05-11 | Working Paper redesign: Added summary chips at top (samples, attributes, checks, evidence, result, conclusion). Added Test Attribute Legend (A/B/C codes mapped to attributes/assertions/workflows). Replaced flat evidence log with structured sample×attribute evidence table. Improved Attribute Testing Matrix with code columns + reference + sample result column. Added Sample-Level Testing Details with expandable per-sample cards showing attribute/assertion/result/evidence/notes. Improved Sample Results with pass/fail/pending counts + failed warning. Improved Review section with rejection banner. Conclusion remains locked until approval. |
| 2026-05-11 | Working Paper optimization: Replaced long evidence table with compact Evidence Coverage Matrix (one row per sample, A/B/C columns show evidence counts, expandable for file details). Sample-Level Testing Details collapsed by default with inline A:P B:F C:— summary chips. Full traceability preserved through expansion. |
| 2026-05-11 | Working Paper evidence count fix: A/B/C columns now show user-uploaded files only, System column shows workflow-generated logs only. Expanded detail separates User Evidence and System Evidence into labeled groups. Attribute Legend shows evidence requirement type (System + User / User Evidence). Sample-Level Testing Details splits evidence into User Ev and Sys Ev columns. |

---

## 13. Engagement View Design Rules

- **Engagement View is portfolio/list level.** It answers: what engagements exist, their lifecycle state, ownership, attention state, and next action.
- **Detailed execution metrics (Effective/Failed/Pending/Remaining counts, progress bars) do NOT belong in the Engagement View table.** They belong inside Engagement Execution detail.
- **No separate Scope column.** Process chip and audit period live inside the Engagement column to avoid redundancy with the engagement name.
- **Engagement View table columns (6):** Engagement, Type/Framework, Owner, Status, Attention, Next Action.
- **Engagement column** shows: name, linked RACM (secondary text), then a metadata row with process chip + audit period + optional alert tag (Overdue / At Risk).
- **Attention column** (not "Health") represents operational/exception attention: On Track, Needs Review, Failed Controls, Overdue, At Risk, Not Started. It is NOT a lifecycle indicator.
- **Row expansion** provides optional detail (control counts, tested, effective, failed, pending review, last activity) without cluttering the default view.
- **Summary cards** above the table show only 5 compact counts: Total, Active/In Execution, Pending Review, At Risk/Failed, Planned.
- **Clicking a row or action** routes to Engagement Execution V2 (for active engagements) or the setup panel (for draft/planned).

---

## 14. RACM Mapping Page Design Rules

- **RACM page shows setup readiness only, not execution/testing state.** No Run, Execute, or testing CTAs on this page.
- **Mapped controls inside RACM must show workflow coverage and attribute mapping.** Each control card displays linked workflows inline with their attributes.
- **Control readiness requires at least one workflow and all required attributes mapped.** Readiness states: Ready, Workflow Missing, Configuration Pending.
- **RACM readiness is blocked when risks are unmapped or mapped controls are missing workflow/attribute coverage.** Validate button remains disabled until all checks pass.
- **Execution CTAs must not appear on RACM mapping page.** RACM is the governance/mapping layer; execution happens in Engagement Execution V2.
- **Risk-level summary** shows readiness counts next to "Mapped Controls (N)": e.g., "2 ready · 1 missing workflows".
- **Remove control** requires inline confirmation with impact message (workflow/attribute count). Control remains in Control Library.
- **Remove workflow** uses trash icon (appears on hover), removes workflow from the control mapping.

---

## 15. Working Paper Design Rules

- **Working Paper must show both sample-level and attribute-level testing.** Not just one view.
- **Attribute legend maps display codes (A/B/C) to actual test attributes.** Shows assertion, workflow, type, and required status per attribute.
- **Evidence log default view is a compact Evidence Coverage Matrix** — one row per sample, attribute codes as columns showing evidence counts, expandable for full file details. Avoids long repeated rows.
- **Attribute Testing Matrix must show samples as rows and attributes as columns,** with code headers (A/B/C), reference column, and sample result column. Cell values: P/F/—/N/A.
- **Sample-Level Testing Details** are collapsed by default with compact inline summary (A:P B:F C:—). Expandable for full attribute/evidence/notes detail.
- **Sample Results section** shows pass/fail/pending counts and per-sample chips. Failed samples trigger a warning about conclusion impact.
- **Conclusion remains locked until reviewer approval.** Never set before approval.
- **Rejected working paper still shows all testing details.** Rejection banner displayed clearly.
- **Summary chips at top** give reviewer instant context: samples, attributes, checks, evidence count, review status, conclusion.
- **Working Paper is audit documentation, not an action dashboard.** No execution CTAs inside.
- **Evidence counts must separate user-uploaded from system-generated.** A/B/C columns show user files only. System Evidence column shows workflow logs only. No double-counting.
- **Expanded sample evidence details** group files under "User Evidence" and "System Evidence" labels.
- **Attribute Legend** shows evidence requirement type per attribute (System + User, User Evidence).
