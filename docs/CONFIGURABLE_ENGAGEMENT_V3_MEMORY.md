# Configurable Engagement V3 Memory

> Source of truth for the Configurable Engagement V3 redesign. Read before every prompt. Update after every decision.

---

## 1. Purpose

Configurable Engagement V3 redesigns Irame engagement from a fixed RACM/control-testing flow into a pattern-driven execution platform.

The platform must support:
- Compliance Control Testing
- Internal Audit Assignment
- Workflow Automation Project

The goal is full-fledged but controlled. We are not designing only for MVP, and we are not building an unlimited free-form project builder.

---

## 2. Core Product Principle

Engagement is the internal execution container.

Pattern type decides:
- user-facing label
- required scope objects
- setup fields
- workspace tabs
- execution flow
- review rules
- output type
- closure rules

Core model:

```
Engagement
→ pattern_type
→ pattern-specific config
→ pattern-specific workspace
→ pattern-specific outputs
```

---

## 3. Internal Object and User-Facing Labels

Internal object:
**Engagement**

User-facing labels:
- `compliance_control_testing` → **Engagement**
- `internal_audit_assignment` → **Audit Assignment**
- `workflow_automation_project` → **Project**

Do not create three disconnected systems.

---

## 4. Locked Engagement Patterns

### Pattern 1: Compliance Control Testing

Use for:
- SOX
- IFC
- ICOFR
- SOC 1
- SOC 2
- GDPR
- framework/control-driven testing

Core flow:
```
Create Engagement
→ Select Compliance Control Testing pattern
→ Select framework and audit type
→ Define scope
→ Choose control scope source
→ Create engagement snapshot
→ Configure testing input method
→ Requests / PBC
→ Upload samples/evidence/data
→ Execute testing
→ Attribute testing
→ Working paper
→ Review
→ Conclusion
→ Engagement summary
```

Control scope source options:
- RACM Version
- Selected Controls
- Imported Controls
- Manual Controls

Rules:
- SOX / IFC / ICOFR require RACM.
- Non-SOX compliance can use selected/imported/manual controls.
- Imported controls enter Control Library and are filterable by engagement/import source.
- Every control requires at least one attribute before testing.
- Reviewer approval is mandatory for compliance engagement.
- Working paper is mandatory.
- Conclusion values:
  - Effective
  - Partially Effective
  - Ineffective
  - Not Applicable

Testing input method options:
- Upload Selected Samples
- Generate Samples from Population
- Test Full Population
- Document-Based Testing
- No Sample-Based Testing

Important:
Engagement-level testing method is default. Control-level override should be allowed.

Do not use "Evidence Only" as UI label.
Use "Document-Based Testing" or "Upload Evidence as Test Items".

---

### Pattern 2: Internal Audit Assignment

Use for:
- process audits
- plant audits
- SOP reviews
- sub-process audits
- activity reviews
- vendor-specific audits
- internal audit assignments

Core flow:
```
Create Assignment
→ Define Scope
→ Announcement
→ Optional IDR
→ Analysis
→ Observations
→ Discussion / Management Response
→ Working Paper
→ Final Report
→ Action Plan
→ Closure
→ Optional linked follow-up assignment
```

Rules:
- RACM is optional.
- SOP should be selectable as a scope source.
- IDR is recommended but not mandatory.
- Observation/Finding section is mandatory, but finding count can be zero.
- Workflow/Q&A execution belongs mainly in Analysis.
- Working Paper is mandatory.
- Final Report is mandatory before closure.
- Action tracking stays in same engagement.
- Formal follow-up audit can be a linked engagement/assignment if needed.

Scope sources:
- Business Process
- Sub-process
- Activity
- SOP
- RACM
- Checklist
- Selected Workflows
- Custom Scope

Internal Audit workspace tabs:
- Overview
- Scope
- Announcement
- Requests / IDR
- Analysis
- Observations
- Discussion
- Working Paper
- Final Report
- Action Plan

---

### Pattern 3: Workflow Automation Project

Use for:
- expense validation
- passenger claim reconciliation
- FOP reconciliation
- vendor reconciliation
- MIS reporting
- speech audit review
- image analytics
- forensic image analytics
- any Irame automation project not necessarily tied to RACM/control testing

Core flow:
```
Create Project
→ Define scope
→ Select input data type
→ Choose automation setup mode
→ Upload/connect input data
→ Run Q&A/workflow/automation
→ Review output
→ Create cases for exceptions
→ Generate output report
→ Optional review/approval
→ Optional schedule
→ Complete or keep active
```

Rules:
- RACM is not required.
- Controls are not required.
- Workflow is not mandatory at creation.
- Workflow/Q&A/ad-hoc analysis is required before execution.
- Saved workflow is required for repeatable/scheduled automation.
- Q&A without saved workflow is allowed.
- Input types must support Excel/CSV, PDF, SQL, Image, Hybrid.
- Review/approval is configurable.
- Output report is required.
- Working paper is optional unless audit-sensitive.
- Exceptions should become cases.
- Integrate with existing Case Management; do not create duplicate case system.
- RACM/control linkage is optional reference only.
- Frequency/schedule is supported for recurring runs.

Automation setup modes:
- Select Existing Workflow
- Create New Workflow
- Use Q&A / Ad-hoc Analysis
- Upload Data First, Decide Later

Output types:
- Report
- Email
- Dashboard
- Case Management
- Downloadable File

Automation workspace tabs:
- Overview
- Input Data
- Automation Setup
- Runs
- Output Review
- Cases
- Reports
- Schedule
- Review (only if review is enabled)

---

## 5. Common Engagement Fields

Fields common across all patterns:
- id
- name
- pattern_type
- display_label
- description / objective
- owner_user_id
- reviewer_user_id
- business_process_id
- entity / location
- status
- stage
- planned_start_date
- planned_end_date
- actual_start_date
- actual_end_date
- created_at
- updated_at

Do not put every pattern-specific field directly on main Engagement.

Use pattern-specific config.

---

## 6. Pattern-Specific Config

Use an engagement_config / pattern config object.

### ComplianceConfig
- framework
- audit_type
- audit_period_start
- audit_period_end
- control_scope_source
- racm_version_id
- selected_control_ids
- import_batch_id
- default_testing_input_method
- allow_control_level_override
- reviewer_required

### InternalAuditConfig
- audit_period_start
- audit_period_end
- scope_level
- business_process_id
- sub_process_id
- sop_ids
- racm_version_id
- checklist_id
- process_owner
- idr_enabled
- announcement_required
- final_report_required
- action_tracking_enabled

### AutomationProjectConfig
- input_type
- automation_setup_mode
- workflow_ids
- output_types
- report_required
- review_required
- case_creation_enabled
- run_type
- frequency
- racm_reference_id
- control_reference_ids

---

## 7. Common Request Layer

Use one internal object:
**Engagement_Request**

User-facing labels change by pattern:
- Compliance → PBC / Evidence Requests
- Internal Audit → IDR
- Automation Project → Input Data Requests

Purpose:
Track what was requested, from whom, when, due date, received files, comments, and status.

Compliance also needs request management. Do not assume IDR only belongs to Internal Audit.

---

## 8. Status Model

Use:
- main status
- pattern-specific stage

Common high-level statuses:
- Draft
- Planned
- Active
- In Progress
- Pending Review
- Completed
- Closed
- On Hold

Compliance stages:
- Scope Configured
- Controls Ready
- Evidence Pending
- Testing In Progress
- Working Paper Ready
- Pending Review
- Concluded

Internal Audit stages:
- Announced
- IDR Pending
- Analysis In Progress
- Draft Issues
- In Discussion
- Final Report Issued
- Action Tracking
- Closed

Automation Project stages:
- Data Pending
- Workflow Not Configured
- Ready to Run
- Running
- Output Generated
- Cases Open
- Scheduled
- Completed
- Failed

---

## 9. Validation Rules

### Common
- name required
- owner required
- pattern_type required
- description/objective required
- required outputs must be complete before closure
- if review required, reviewer must be assigned

### Compliance
- SOX / IFC / ICOFR requires RACM
- every control must have attributes before testing
- reviewer approval required
- working paper required
- conclusion cannot happen before reviewer approval
- imported controls enter Control Library
- testing input method selected at engagement level as default
- control-level override allowed

### Internal Audit
- scope required
- announcement required
- IDR optional
- observations section required
- final report required before closure
- action plan required if observations exist

### Automation Project
- input type required
- automation setup mode required
- workflow not required at creation
- workflow/Q&A required before run
- output report required
- review configurable
- cases created only if exceptions exist or case creation enabled

---

## 10. Working Paper / Output Rules

**Compliance:**
- Control-level working paper mandatory
- Must show sample-level and attribute-level testing
- Attribute legend A/B/C allowed
- Evidence coverage matrix should avoid long repeated evidence lists
- Reviewer approval gates conclusion

**Internal Audit:**
- Working paper mandatory
- Focuses on scope, procedures, analysis, evidence, observations, reviewer comments, report references

**Automation Project:**
- Output report mandatory
- Working paper optional
- Report should show scope, input sources, workflow/Q&A used, run summary, exceptions, cases, output files, review if enabled

---

## 11. Case Management Integration

Do not build duplicate case management.

For Automation Project:
Workflow exception → create linked case in existing Case Management.

Minimum linking data:
- source_project_id
- source_run_id
- exception_id
- case_title
- case_description
- severity
- owner
- due_date
- output_reference

Project should show linked cases.

---

## 12. Implementation Strategy

Build in same repo, not separate repo.

Use new isolated folder:
```
src/components/engagement-configurable/
```

Do not modify old V2 until V3 shell is stable.

Recommended files later:
- configurableEngagementTypes.ts
- engagementPatterns.ts
- mockConfigurableEngagementData.ts
- configurableEngagementState.ts
- ConfigurableEngagementWizard.tsx
- ConfigurableEngagementWorkspace.tsx
- PatternWorkspaceRenderer.tsx
- README.md

Use feature flag or hidden route later.

---

## 13. What Not To Do

- Do not create separate repos.
- Do not create three disconnected modules.
- Do not force all patterns into compliance control testing flow.
- Do not force RACM for all engagements.
- Do not force controls for automation projects.
- Do not force existing workflow selection at project creation.
- Do not call Document-Based Testing "Evidence Only".
- Do not duplicate case management.
- Do not show all workspace tabs for all patterns.
- Do not delete old Execution V2.
- Do not route current Process Hub to V3 until explicitly instructed.

---

## 14. Open Questions

Track future unresolved decisions here.

Initial open questions:
- [ ] Should SOX and IFC both strictly require RACM, or should admin override exist?
- [ ] Should imported controls require approval before becoming active in Control Library?
- [ ] How should Partially Effective be derived or reviewer-selected?
- [ ] Which existing Case Management API/component should Automation Project integrate with?
- [ ] Should Audit Committee Deck be in controlled advanced or later release?
- [ ] Should frequency/schedule use existing workflow scheduling infrastructure?

---

## 15. Change Log

| Date | Change |
|------|--------|
| 2026-05-12 | Created Configurable Engagement V3 memory. Locked three engagement patterns: Compliance Control Testing, Internal Audit Assignment, Workflow Automation Project. Confirmed pattern-driven approach with one internal Engagement object and pattern-specific config/workspace/output. |
| 2026-05-12 | Created isolated module skeleton under src/components/engagement-configurable/. Added type definitions (configurableEngagementTypes.ts) for common engagement, pattern configs, all enums. Added pattern metadata definitions (engagementPatterns.ts) with workspace tabs and required outputs. Added mock placeholder data (3 engagements). Added lightweight state/validation helpers (configurableEngagementState.ts). No UI or routing implemented yet. |
| 2026-05-12 | Created ConfigurableEngagementWizard shell (4 steps): PatternSelectionStep (3 pattern cards with workspace tab previews), CommonDetailsStep (name/owner/reviewer/dates form), PatternConfigStep (Compliance: framework/scope/testing method, IA: scope/IDR/announcement, Automation: input/mode/outputs/schedule), ReviewCreateStep (summary + validation + local draft creation). Wizard is isolated and not wired to app routing yet. |
| 2026-05-12 | Wired wizard to dev-only preview route: view key `dev-configurable-engagement-v3`. Added to View type in useAppState.ts and App.tsx switch. Not in sidebar. Existing app flow unchanged. Access via console: call setView('dev-configurable-engagement-v3'). |
| 2026-05-13 | QA tested V3 Wizard. Bug fixed: dev route was inaccessible — added URL param support (`?view=dev-configurable-engagement-v3`) to `getInitialView()`. Code review confirmed: all 3 patterns render correctly, validation logic works, RACM warning triggers for SOX/IFC/ICOFR without RACM source, frequency conditional on recurring, report output locked, local draft creation works. No production flow changed. |
| 2026-05-13 | Created Configurable Engagement Workspace shell. WorkspaceHeader shows pattern icon/label/status/metadata. WorkspaceTabs renders pattern-specific tabs (Review hidden for automation when not required). WorkspaceOverview shows objective, config summary, readiness checklist, flow preview, required outputs. PatternPlaceholderTab shows contextual descriptions for all unbuilt tabs. PatternWorkspaceRenderer routes active tab. Wizard transitions to workspace on Create with info banner. All dev-only, not persisted. |
| 2026-05-13 | QA tested Wizard → Workspace shell flow. Code review verified: all 3 patterns create correctly and transition to workspace; Compliance shows 9 tabs with RACM warning validation; IA shows 10 tabs with IDR/announcement/final report checks; Automation shows 8 tabs (Review hidden when not required, 9 when required); readiness checklist correct per pattern; placeholder tabs have contextual descriptions; back-to-wizard preserves form state; Edit Setup button correctly hidden (no handler wired). Build passes. No bugs found, no production flow changed. |
| 2026-05-13 | Implemented Compliance Control Scope tab. Mock controls (C001-C004) with attributes, workflows, readiness. Scope source card shows RACM/Selected/Imported/Manual context. Control table with expandable detail showing attributes (A/B/C with assertion + workflow mapping), linked workflows (with coverage), and readiness checklist. RACM warning for SOX/IFC/ICOFR without RACM source. Stats bar: total/key/ready/needs setup/attributes/workflows. No testing actions added. |
| 2026-05-13 | QA tested Compliance Control Scope tab. Code review verified: stats correct (4 total, 4 key, 3 ready, 1 needs setup, 11 attrs, 7 workflows). RACM warning triggers for SOX+non-RACM source. C004 shows Needs Review with empty workflows handled gracefully. Scope source cards render for all 4 sources. Expandable detail shows attributes with mapping status, workflows with coverage, readiness checklist. No testing actions present. IA/Automation workspaces unaffected. Build passes. No bugs found, no production flow changed. |
| 2026-05-13 | Implemented Compliance Requests / PBC tab. 5 mock PBC requests with status/type/priority/linked control/attributes. Summary cards (total/pending/partial/received/overdue/draft). Status + type filters + search. Expandable request details with description, timeline, files, comments, overdue warning. Create PBC Request form (local state). Status actions: Mark Sent, Mark Received, Complete, Remind. Compliance uses "PBC / Evidence Requests" label. No evidence ingestion/testing wired yet. |
| 2026-05-13 | Lifted PBC request state to ConfigurableEngagementWorkspace level. Requests, create, and status updates now persist across tab switches. ComplianceWorkspaceState type defined in complianceRequestsData.ts. Tab component receives requests + callbacks as props. Prepared state shape for future Samples & Evidence integration. No backend persistence. |
| 2026-05-13 | Implemented Compliance Samples & Evidence tab. Input method-specific panels for all 5 methods (Upload Samples, Generate from Population, Full Population, Document-Based, No Sample-Based). Mock test item creation. Evidence repository with attach form (file name, type, control, attributes, source). PBC received-files handoff. Readiness checklist with Go to Attribute Testing CTA. State lifted to workspace level (batches + evidence persist across tabs). No attribute testing implemented yet. |
| 2026-05-13 | Fixed Samples & Evidence derived readiness logic. Added helpers: getControlAttributes, deriveTestItemEvidenceStatus, deriveTestItemAttributeCoverage. Evidence form now shows real attribute checkboxes per selected control + test item checkboxes. Test item table uses derived evidence status and attribute coverage. PBC handoff maps "All attributes" or specific A/B/C codes to real attribute IDs and links test items. Summary cards show readyItems count. Readiness checklist uses derived values. |
| 2026-05-13 | Implemented Compliance Attribute Testing tab. Sample × attribute matrix grouped by control with A/B/C columns. Clickable result cells open detail panel with evidence, notes, Pass/Fail/NA/Reset actions. Run Automated Checks simulates deterministic pass/fail for automated attributes (INV-1003 fails B/C). Bulk Mark Pending Manual → Pass. Derived sample results (PASS/FAIL/PENDING). Testing summary (7 KPIs). Testing status readiness panel. Failed attribute remark warning. State lifted to workspace level. No Working Paper/Review/Conclusion yet. |
| 2026-05-13 | QA tested Attribute Testing tab. Bug fixed: detail panel notes didn't sync when switching between cells (added key prop to force remount). Verified: locked state without samples, result initialization without duplication, automated checks, manual pass/fail/NA, bulk action safety, control filter, state persistence across tabs, sample result derivation. Build passes. No production flow changed. |
| 2026-05-13 | Implemented Compliance Working Paper tab. 11-section read-only audit document: WP header, control objective, test design, attribute legend (A/B/C codes), sample data summary, evidence coverage matrix (user/PBC vs system evidence separated), attribute testing matrix, expandable sample-level testing details, PBC request trace, review placeholder (Not Submitted), conclusion locked. Control selector for per-control working paper. Download Draft placeholder. Uses existing workspace state — no separate mock data. |
| 2026-05-13 | QA tested Compliance Working Paper tab. Code review verified: empty state without samples (clean message), control selector defaults safely (first control with test items), evidence counts correctly separated (user/PBC vs system), attribute testing matrix uses actual results, sample result derivation correct, PBC request trace matches linkedControlId safely, Review/Conclusion remain placeholders. Build passes. No bugs found, no production flow changed. |
| 2026-05-13 | Implemented Compliance Review tab. Control-level review: NOT_SUBMITTED → PENDING_REVIEW → APPROVED/REJECTED → resubmit. Readiness checklist gates submit (samples, testing complete, reviewer assigned). Testing package summary with View Working Paper CTA. Reviewer action panel (approve/reject with required comments for rejection). Review history timeline. Approved state shows Go to Conclusion CTA. Rejected state shows fix + resubmit flow. State lifted to workspace. No conclusion generation yet. |
| 2026-05-13 | Implemented Compliance Conclusion tab. Locked before approval. Derives recommended conclusion (Effective/Partially Effective/Ineffective/Not Applicable) from sample results with 20% fail threshold for partial. Failed attributes table. Finalize conclusion with selector + required remarks when differing from recommendation. Update conclusion with history. Conclusion state lifted to workspace. Summary cards show recommended vs final. Engagement summary not implemented yet. |
| 2026-05-13 | End-to-end QA for full Compliance Control Testing flow. Bug fixed: Conclusion tab ReadyToFinalizeView and FinalizedView didn't remount when switching controls (added key={selectedControlId} to prevent stale useState). Verified all 9 tabs: Control Scope, Requests/PBC, Samples & Evidence, Attribute Testing, Working Paper, Review, Conclusion work end-to-end. State persists across all tab switches. Review gates conclusion. Conclusion locked before approval. Build passes. No production flow changed. |
| 2026-05-13 | Implemented Compliance Summary tab. Engagement-level KPI rollup (scope/testing + review/conclusion). Testing progress with progress bar. Control rollup table (readiness, items, testing, failed, review, conclusion, next action). Exception/failed attribute table. Conclusion rollup with Effective/Partial/Ineffective/NA/Pending counts and engagement interpretation. Export Summary Report placeholder. All 9 compliance tabs now have real content. |
| 2026-05-13 | QA tested Compliance Summary tab. Verified: empty state (no testing data) shows correct pending counts, KPIs accurate after samples/testing/review/conclusion, control rollup table correct for all states, exceptions table shows failed attrs, conclusion rollup groups correctly, interpretation logic handles all combinations (all finalized, has ineffective, pending), export placeholder works. Build passes. No bugs found. Full Compliance Control Testing pattern is stable. |
| 2026-05-13 | Implemented Internal Audit Assignment Scope tab. Scope level selector (Process/Sub-process/Activity/Specific Element/Custom). Business process/sub-process/activity multi-select from mock data hierarchy. Scope sources: SOP/RACM/Checklist/Workflow multi-select (all optional, SOP recommended). Scope narrative (objective/in-scope/out-of-scope). Live preview card. Readiness checklist. Continue to Announcement CTA. State lifted to workspace (InternalAuditWorkspaceState). No other IA tabs implemented yet. |
| 2026-05-13 | QA tested IA Scope tab. 2 bugs fixed: (1) BP change called update() 3 times in one handler — only last won, losing BP change. Fixed with single onUpdateScope({...scope, bp, subProcessIds:[], activityIds:[]}). (2) Readiness hardcoded audit period and process owner to true — fixed to check actual config values. Verified: scope level switching, BP→sub-process→activity cascade, scope sources, narrative, preview, readiness, state persistence. Compliance pattern stable. Build passes. |
| 2026-05-13 | Implemented IA Announcement tab. Auto-generates draft from scope/engagement data. Editable recipients/CC/timeline/subject/body. Live preview card with professional letter format. Refresh from Scope button. Mark as Sent (gated on recipients+subject+body+scope readiness). Mark Acknowledged after sent. History timeline. Continue to Requests/IDR CTA after acknowledged. State lifted to workspace (InternalAuditAnnouncementState). No real email sending. |
| 2026-05-13 | QA tested IA Announcement tab. Verified: draft initialization from scope (runs once via initialized flag), editable fields with live preview, Refresh from Scope updates correctly, send gating (disabled when missing fields or scope Draft), sent state disables form, acknowledged state shows Continue CTA, history records all actions, state persists across tabs. Build passes. No bugs found. Compliance pattern stable. |
| 2026-05-13 | Implemented IA Requests / IDR tab. 5 mock IDR requests with scope linkage. Summary cards, status/type filters, search. Request table with expandable details (description, scope, files, comments, overdue warning). Create IDR Request form. Status actions (Send/Received/Complete/Remind). Add Received File inline. Proceed without IDR option. Continue to Analysis CTA. State lifted to workspace (InternalAuditRequestState). No real email/file upload. |
| 2026-05-13 | QA tested IA Requests / IDR tab. Verified: summary counts correct, status/type/search filters work, expandable details safe (overdue warning shows), create request works and persists, status transitions correct (DRAFT→SENT, PENDING→RECEIVED, PARTIAL→RECEIVED), add file transitions PENDING→PARTIAL, proceed-without-IDR enables CTA, Continue to Analysis navigates to placeholder, state persists across tabs. Build passes. No bugs found. Scope/Announcement/Compliance stable. |
| 2026-05-13 | Implemented IA Analysis tab. 4 analysis modes (Workflow/Q&A/Document Review/Data Review). Uses received IDR files as inputs. Create Analysis Run form with mode/files/workflow/question. Mock run simulation generates deterministic exceptions. Exception actions (Review/Dismiss/→Observation). Potential observations created from exceptions. Summary cards (6 KPIs). Available inputs from IDR. Runs table with expandable output. Continue to Observations CTA. State lifted to workspace. No real AI/workflow execution. |
| 2026-05-13 | QA tested IA Analysis tab. Verified: locked state without IDR inputs, received files appear as chips, proceed-without-IDR path works, all 4 modes create runs correctly, mock simulation generates appropriate exceptions, exception actions (Review/Dismiss/Convert) update state, potential observations created with correct linkage, summary counts update, state persists across tabs. Build passes. No bugs found. All prior IA tabs and Compliance stable. |
| 2026-05-13 | Implemented IA Observations tab. Convert potential observations from Analysis to formal observations. Create manual observations. Edit panel with severity/risk/root cause/impact/recommendation/owner/target date. Mark Ready for Discussion (validates required fields). Drop/Reopen. No-observations-confirmed flow. Discussion readiness checklist. Dismissed potential obs tracked. Summary cards (6 KPIs). State lifted to workspace (InternalAuditObservationsState). |
| 2026-05-13 | QA tested IA Observations tab. Verified: empty state without analysis (manual create available), potential obs convert/dismiss, formal obs table, edit panel key isolation, Mark Ready validation (silently blocks from table, shows in edit panel), Drop/Reopen status transitions, No Obs Confirmed (resets on create, re-available after all dropped), discussion readiness logic, state persistence. Build passes. No bugs found. All prior IA tabs and Compliance stable. |
| 2026-05-13 | Implemented IA Discussion tab. Initializes discussion items from READY_FOR_DISCUSSION observations. Status workflow: NOT_STARTED → SENT_TO_MANAGEMENT → RESPONSE_RECEIVED → AGREED/DISAGREED → READY_FOR_REPORT. Detail panel with management response, rationale, agreed action, owner, target date, remediation flag, history. General discussion notes. No-observations discussion closure. Working Paper readiness checklist. State lifted to workspace (InternalAuditDiscussionState). |
| 2026-05-13 | QA tested IA Discussion tab. Bug fixed: useEffect dependency was observations.length — missed new ready observations when count unchanged. Fixed to use readyObsIds (comma-joined IDs of ready observations). Verified: empty state, initialization from ready obs, status transitions, Agree/Disagree validation (disabled buttons), Ready for Report, general notes, no-obs path, readiness checklist, state persistence, detail panel key isolation. Build passes. All prior IA tabs and Compliance stable. |
| 2026-05-13 | Implemented IA Working Paper tab. 11-section read-only audit document: WP header, scope summary, announcement summary, IDR request summary (with table), analysis procedures (expandable runs), exceptions identified, observations summary, discussion/management responses, evidence/source file index (with "used in analysis" flag), readiness checklist (6 items), final report placeholder. Uses existing IA workspace state. Download Draft placeholder. No Final Report or Action Plan yet. |
| 2026-05-13 | QA tested IA Working Paper tab. Verified: empty/early state (all sections show pending safely), scope/announcement/IDR/analysis/exceptions/observations/discussion summaries reflect workspace state, source file index with used-in-analysis flag, readiness checklist (discDone correctly handles empty items via every() on empty array + obsDone gate), Continue to Final Report gated, download placeholder works. Build passes. No bugs found. All prior IA tabs and Compliance stable. |
| 2026-05-13 | Implemented IA Final Report tab. Draft generation from IA workspace state (scope/procedures/data/observations/discussion). Editable report sections (title/executive summary/scope/procedures/data/conclusion/distribution). Overall rating recommendation (Satisfactory/Needs Improvement/Unsatisfactory/NA) with override. Observations table with management responses/actions. Agreed actions preview for Action Plan. Report workflow: NOT_STARTED → DRAFT → READY_FOR_REVIEW → ISSUED. History timeline. Export placeholder. Continue to Action Plan CTA (gated on issued). State lifted to workspace. |
| 2026-05-13 | QA tested IA Final Report tab. Verified: not-started state (generate draft available with warning), draft generation (title/summary/scope/procedures/data/conclusion populated), rating recommendation logic (Satisfactory/Needs Improvement/Unsatisfactory/NA for all cases), editable fields in draft, observations table with discussion data, agreed actions preview, Mark Ready gated on readiness, Issue makes read-only, export placeholder, Continue to Action Plan gated on issued, state persistence. Build passes. No bugs found. All prior IA tabs and Compliance stable. |
| 2026-05-13 | Implemented IA Action Plan tab. Locked before Final Report issued. Initializes action items from agreed discussion actions (priority from observation severity). Manual action creation. Action table with status/priority/owner/due/evidence. Detail panel with edit/start/complete/defer/evidence. Status transitions: NOT_STARTED → IN_PROGRESS → COMPLETED/DEFERRED. Remediation evidence placeholder. Follow-up audit toggle + placeholder. Action Plan readiness checklist. State lifted to workspace. All 10 IA tabs now have real content. |
| 2026-05-13 | E2E QA for full Internal Audit Assignment pattern. Bug fixed: Action Plan initialization used initializedFromReport boolean gate — new agreed actions after first init were missed. Fixed to use agreedDiscItemIds dependency (comma-joined observation IDs) so new agreed actions always generate items. initializeActionItems deduplicates via existingObsIds. Verified all 10 tabs: Scope→Announcement→IDR→Analysis→Observations→Discussion→Working Paper→Final Report→Action Plan work end-to-end. State persists. Compliance stable. Build passes. |
| 2026-05-13 | Implemented Automation Project Input Data tab. 5 input methods (Excel/CSV, PDF, SQL, Image, Hybrid) with mock data source generators. Data sources table with select/preview/remove/mark-ready. Preview panel with columns, sample rows, validation issues. Input data readiness logic. Proceed-without-data option. Input notes. Continue to Automation Setup CTA. AutomationProjectWorkspaceState added to workspace. First Automation Project tab with real content. |
| 2026-05-13 | QA tested Automation Input Data tab. Verified: all 5 source types create correctly, Hybrid avoids ID collision via +1, selection toggles update summary/readiness, preview panel handles all types (null-safe when source removed), Mark Ready resolves NEEDS_MAPPING, Remove cleans source + selection, readiness logic (Not Ready/Needs Mapping/Ready) correct, proceed-without-data works, input notes persist, Continue CTA enabled for Ready/Needs Mapping. Build passes. No bugs found. Compliance and IA stable. |
| 2026-05-13 | Implemented Automation Setup tab. 4 setup modes: Select Existing Workflow (5 mock workflows with compatibility), Create New Workflow (draft builder with suggested/custom steps, Mark Ready), Q&A/Ad-hoc (objective + questions + expected outputs, suggested questions, Mark Ready), Decide Later. Uses input data state. Readiness logic (NOT_CONFIGURED/DRAFT/NEEDS_INPUT/NEEDS_WORKFLOW/READY_FOR_RUN). Recurring warning for Q&A-only. Setup notes + history. Continue to Runs CTA. State lifted to workspace. |
| 2026-05-13 | QA tested Automation Setup tab. 2 bugs fixed: (1) CreateWorkflowPanel used local useState for name/desc — lost on mode switch. Fixed to save directly to parent draftWorkflow state. (2) QASetupPanel used local useState for objective/outputs — lost on mode switch. Fixed to use parent qa state directly. Verified: all 4 modes, workflow selection, draft builder, Q&A with questions/outputs, decide later, recurring warning, readiness logic, state persistence. Build passes. Compliance and IA stable. |
| 2026-05-13 | Implemented Automation Runs tab. Locked state before setup ready. Create run with auto-name. Execute mock simulation generating outputs (reconciliation/exception/dashboard/case candidates) and exceptions (mismatch/duplicate/missing doc/data quality) based on workflow/Q&A keywords. Run history table with expandable detail (summary/outputs/exceptions/logs). Exception actions (Review/Dismiss/Case Candidate). Output readiness checklist. Continue to Output Review CTA. State lifted to workspace. |
| 2026-05-14 | QA tested Automation Runs tab. Verified: locked state before setup ready, existing workflow run (reconciliation outputs/exceptions), Q&A run (keyword-based exceptions), draft workflow run, recurring Q&A blocked by setup readiness (DRAFT status blocks READY_FOR_RUN), create run persists, execute generates correct outputs/exceptions, exception actions (Review/Dismiss/Case Candidate) persist, run detail panel shows all sections, multiple runs handled, output readiness correct, state persistence. Build passes. No bugs found. All patterns stable. |
| 2026-05-14 | Implemented Automation Output Review tab. Locked before completed runs. Run selector. Outputs table with Review/Approve/Reject actions and comments. Exceptions table with Review/Dismiss/Case Candidate (updates runs state via shared handler). Output review status derivation (NOT_STARTED/IN_PROGRESS/READY_FOR_CASES/READY_FOR_REPORTS/COMPLETED). Review notes. Downstream readiness with conditional Cases/Reports CTAs based on outputTypes config. State lifted to workspace. |
| 2026-05-14 | QA tested Automation Output Review tab. Verified: locked state, run selector filtering, output review/approve/reject, comment save/persistence, exception actions sync with Runs state (shared handleUpdateAutoRunException), downstream readiness (Cases gated on CASE_CANDIDATE, Reports gated on approved output), new run outputs appear as Not Reviewed without collisions, review notes persist. Build passes. No bugs found. All patterns stable. |
| 2026-05-14 | Implemented Automation Cases tab. Case candidates from CASE_CANDIDATE exceptions. Create case from candidate (prefilled from exception data, linked via sourceExceptionId). Manual case creation. Cases table with status transitions (OPEN→IN_PROGRESS→RESOLVED→CLOSED, CANCELLED). Case detail panel with edit/evidence refs/history. Duplicate prevention via linkedExceptionIds. Case readiness checklist. Continue to Reports CTA. Case notes. Integration placeholder note. State lifted to workspace. |
| 2026-05-14 | QA tested Automation Cases tab. Verified: empty/locked states (no Case Mgmt, no runs, no candidates), case candidate intake from CASE_CANDIDATE exceptions, create case from candidate (prefilled, linked via sourceExceptionId), duplicate prevention (linkedExceptionIds filters candidates), manual case creation, status transitions (OPEN→IN_PROGRESS→RESOLVED→CLOSED, CANCELLED), detail panel key isolation, evidence refs, dismissed exception doesn't break existing case, case readiness, state persistence. Build passes. No bugs found. All patterns stable. |
| 2026-05-14 | Implemented Automation Reports tab. Draft report generation from full automation state (input/setup/runs/outputs/cases). 11 editable report sections. Report workflow: NOT_STARTED → DRAFT → READY → FINAL. Report readiness checklist. Multiple reports support with selector. Finalized report read-only. Export placeholder. Report notes. Continue to Schedule CTA. Key metrics auto-generated. Recommendations auto-generated. State lifted to workspace. |
| 2026-05-14 | QA tested Automation Reports tab. Verified: locked state (no runs), warning (no approved outputs), draft generation (all sections populated from automation state), readiness checklist, editable fields in draft, multiple reports with selector, Mark Ready/Finalize workflow, finalized read-only, export placeholder, Continue to Schedule CTA logic (disabled when Report required + no final, enabled when final or Report not required), state persistence. Build passes. No bugs found. All patterns stable. |
| 2026-05-14 | Implemented Automation Schedule tab — completes Automation Project pattern. Schedule requirement derivation (required for RECURRING, not for AD_HOC/ONE_TIME). Not-required/blocked states. Schedule form (frequency/dates/time/timezone/notifications/auto-cases/auto-report). Next run preview. Activate/Pause/Resume/Disable workflow. Schedule history. Run monitoring expectations. Project readiness panel (7+ checks across all automation tabs). All 8 Automation Project tabs (excl. optional Review) now have real content. |
| 2026-05-14 | E2E QA for full Workflow Automation Project pattern. Verified all 8 tabs: Input Data→Automation Setup→Runs→Output Review→Cases→Reports→Schedule. Shared exception state consistent (handleUpdateAutoRunException). Duplicate case prevention via linkedExceptionIds. Q&A-only recurring blocked by deriveScheduleRequirement. Review tab hidden when reviewRequired=false. Reports reflect latest approved outputs/cases. Schedule not-required for AD_HOC/ONE_TIME. All state persists across tabs. Build passes. No bugs found. All 3 patterns (Compliance 9 tabs, IA 10 tabs, Automation 8 tabs) are complete and stable. |
| 2026-05-14 | Final V3 platform QA and integration-readiness review. Module structure: 63 files cleanly organized (core + components + patterns/compliance + patterns/internal-audit + patterns/automation). Routing: 27 real tab routes verified across 3 patterns, no broken fallbacks. State: 3 workspace-level state holders (compliance/IA/automation), all business state lifted. TypeScript: zero errors, 3 safe `as any` casts for pattern config access. Build: passes at 3,930 KB (V3 adds ~460 KB). No bugs found. All 3 patterns stable. Ready for Process Hub integration behind feature flag. |
| 2026-05-14 | Updated Automation Project multi-workflow support: selectedWorkflowIds/selectedWorkflowNames, bulk run creation, sourceWorkflowName on outputs/exceptions, multi-workflow display in Runs/Output Review/Cases/Reports/Schedule. |
| 2026-05-14 | Replaced Automation Project Create New Workflow "Mark Workflow Ready" with Build Workflow prototype panel. Added ProjectCreatedWorkflow type (id/name/description/objective/status/steps/linkedDataSourceIds/builderPrompt). Workflow Builder panel: name, objective, description, builder prompt, multi-select project data sources, add new data source (synced to project Input Data pool), suggested/custom steps, validation. Created workflows appear under Created Workflows in Create New Workflow mode and in Select Existing Workflow list (with "Created in this Project" badge). Created workflows auto-selected for run, support bulk workflow runs. Readiness updated: CREATE_NEW_WORKFLOW requires saved + selected created workflow. Schedule requirement updated to recognize created workflows. Reports automation summary includes project-created workflow note. UI copy updated: "Use Existing Workflow" / "Build New Workflow" / "Ask Questions / Ad-hoc Analysis" / "Upload Data First, Decide Later". |
| 2026-05-14 | QA tested Automation Build Workflow + multi-workflow selection + bulk run flow. 2 bugs fixed: (1) WorkflowBuilderPanel didn't remount when switching between editing different workflows — stale useState values persisted. Fixed with `key={editingWorkflowId \|\| 'new'}`. (2) SETUP_MODE_LABELS still showed old display text ("Select Existing Workflow" / "Create New Workflow" / "Decide Later") while mode cards used new copy. Fixed labels to match: "Use Existing Workflow" / "Build New Workflow" / "Ask Questions / Ad-hoc Analysis" / "Upload Data First, Decide Later". Verified: created workflows appear in Created Workflows list and Select Existing Workflow (with badge). Workflow-created data sources sync to project Input Data. Multi-select works across mock + created workflows. Bulk run creates per-workflow outputs with sourceWorkflowName. Keyword simulation works for created workflow names. Output Review/Cases/Reports/Schedule display workflow context. Readiness logic correct for all setup modes including recurring. State persists across all tab switches. Compliance and IA patterns unchanged. Build passes. |
| 2026-05-14 | Product copy and UX cleanup pass for Automation Setup. Wizard label changed from "Automation Setup Mode" to "How do you want to automate this?" with contextual helper text per option. Setup page subtitle updated. Context card label "Setup Mode" → "Automation Approach". Mode card subtitles rewritten for clarity. Existing Workflow section: "Select Existing Workflows" with helper text and bulk run note. Build New Workflow section: clearer builder description and data source helper. Q&A section: renamed to "Ask Questions / Ad-hoc Analysis", added helper text, recurring warning reworded. Decide Later section: title + helper rewritten. Readiness panel renamed to "Automation Readiness", check labels rewritten to human-readable ("Automation approach selected", "Input data selected or intentionally skipped", "N workflows selected", "Recurring automation has at least one saved workflow", "Output types selected"). Runs context card updated: "Automation Approach" label, workflow count display ("Bulk run available · N workflows selected" / "1 workflow selected" / "Q&A / ad-hoc analysis setup"). No functional behavior changed. |
| 2026-05-14 | Removed "Case Candidates" from generated run outputs. Case Candidate is an exception review action in Output Review, not a workflow output. Removed CASE_CANDIDATES from OutputType union. Cases tab continues to consume exceptions with status CASE_CANDIDATE. Reports/Output Review already derived case candidate counts from exception status, not output type — no downstream changes needed. Added helper text in Runs exception section clarifying exceptions must be reviewed in Output Review before becoming case candidates. Product model: Output = generated workflow result, Exception = issue found by workflow, Case Candidate = reviewed exception selected for case creation. |
| 2026-05-14 | Enhanced exception triage and case creation flow. Added DeficiencyType enum (8 types: System/Design/Operating/Data/Documentation/Control/Process/Other) with labels and CSS classes. Extended AutomationRunException with triage fields (deficiencyType, assignedOwner, reviewer, dueDate, triageNotes, caseCandidateMarkedAt/By). Extended AutomationCase with deficiencyType, reviewer, remediation fields (plan/rootCause/owner/dueDate/status), closureNotes, sourceWorkflowName. RemediationStatus: NOT_STARTED/IN_PROGRESS/SUBMITTED/ACCEPTED/REJECTED. Output Review: bulk exception selection with Select All Open, bulk Mark Reviewed/Dismiss/Mark as Case Candidate, triage form (deficiency type + owner + reviewer + due date + notes required before case candidate marking). Single row "→ Case" now opens same triage form. Exception table columns extended (checkbox/deficiency/owner/due). Cases: prefilled from triage metadata (deficiency/owner/reviewer/due/notes/workflow), bulk case creation from selected candidates, case detail panel with Remediation/Action Plan section (root cause/plan/owner/due/status with Submit/Accept/Reject workflow). Cases table shows Deficiency column. Reports: deficiency breakdown and remediation status summary in exception/case/key metrics sections. Workspace exception handler extended to accept optional triageData. |
| 2026-05-15 | QA tested Cases assignment flow. 2 bugs fixed: (1) submitOwnerResponse called onUpdate then onTransition separately — second call overwrote first, losing rootCause/remediationPlan/remediationStatus. Fixed by combining into single onUpdate call with status+history. (2) Auditor Accept/Reject/Close buttons had same double-update bug — closureNotes lost. Fixed by combining closureNotes+status+history into single onUpdate. Also: Reject now explicitly sets remediationStatus=REJECTED so reports rejectedBack counter works. Verified: bulk assign, single assign, duplicate prevention, owner response validation, submit to auditor, accept/close, reject/send back, close as not required, reports terminology, state persistence across tabs. All flows correct after fix. |
| 2026-05-15 | Redesigned Automation Project Workflows tab to match Workflow Library visual pattern. Enterprise table layout with checkbox selection, workflow name (clickable → detail view), description, business process, tags columns. Search bar, Create Workflow CTA, Run Selected CTA in header. In-tab workflow detail view with Overview/Runs/Configuration tabs, step list, run history filtered to workflow, back navigation. Reuses Checkbox from BulkExecuteModal. All existing logic preserved (toggle, BulkExecuteModal, simulateRun, downstream state flow). Run history strip at bottom with Output Review CTA. |
| 2026-05-15 | Cleaned Automation Project wizard setup step. Removed "Input Data Type" and "How do you want to automate this?" fields from wizard — these are now handled in workspace (data sources in BulkExecuteModal Step 2, workflow selection in Workflows tab). Wizard now captures only: Output Types, Review Required, Case Creation, Run Type/Frequency, RACM/Control references. Review & Create summary no longer shows Input Type or Setup Mode. Subtitle updated to reflect new scope. |
| 2026-05-15 | Updated Automation Project workspace flow. Removed Input Data, Automation Setup, and Runs as separate tabs. Replaced with single "Workflows" tab that combines workflow selection + run execution via BulkExecuteModal. Data source configuration now happens inside BulkExecuteModal Step 2 (as intended). New tab flow: Overview → Workflows → Output Review → Cases → Reports → Schedule. Created AutomationWorkflowsTab.tsx. Old tab components (AutomationInputDataTab, AutomationSetupTab, AutomationRunsTab) kept in source but no longer routed. Build size decreased ~60KB. |
| 2026-05-15 | Created final V3 summary document (docs/CONFIGURABLE_ENGAGEMENT_V3_FINAL_SUMMARY.md). Documented all 3 patterns (27+ tabs), reused system components (BulkExecuteModal + ManageExceptionsView), 63 V3 module files, 84 commits, 72 files changed (17,114 lines added). QA status confirmed across all patterns. Known limitations documented. Next steps outlined: merge as dev-preview, Process Hub integration behind feature flag, backend persistence, real integrations. |
| 2026-05-15 | Full E2E QA for V3 Automation Project with reused system components. 2 bugs fixed in exceptionAdapter.ts: (1) Dead code removed — `bulkId: undefined` and `flags: ... ? undefined : undefined` on mapped GrcException. (2) CRITICAL severity preservation — reverse sync now skips downgrading CRITICAL→HIGH when GRC maps back (GRC has no Critical level, so round-trip would lose the distinction). Traced all 14 test paths: workspace creation, setup workflow selection, build workflow, BulkExecuteModal execution with P2P business process, run result with sourceWorkflowName, Output Review, embedded ManageExceptionsView with V3 exceptions, bulk classify sync round-trip, new run prop sync, Reports/Schedule compatibility, standalone system regression (Workflow Library + Manage Exceptions), cross-pattern regression (Compliance/IA). All paths verified. Build passes. |
| 2026-05-15 | Browser QA for V3 embedded ManageExceptionsView. Added compact header mode for embedded: 34px title hidden, replaced with 16px "Exceptions & Cases" heading, reduced top padding. Verified: V3 exceptions render (not GRC mocks), bulk classify syncs back to V3 runs state via round-trip (V3→GRC→classify→onExceptionsChange→syncGrcToV3→onUpdateRunException→V3 state), prop sync preserves previously classified exceptions through round-trip, standalone Manage Exceptions unchanged (full header/Action Hub visible), individual drawer non-sync is consistent (both standalone and embedded drawers are visual-only), Output Review/Reports read updated V3 state correctly. No crashes. |
| 2026-05-15 | Embedded ManageExceptionsView into V3 Automation Cases tab. Created exceptionAdapter.ts with V3↔GRC exception mappers (mapV3ExceptionsToGrc, syncGrcToV3Exception). V3 Cases tab now renders ManageExceptionsView embedded=true with V3 exceptions mapped to GrcException format. Classification/severity changes in ManageExceptionsView sync back to V3 runs state via onExceptionsChange → onUpdateRunException. ManageExceptionsView now uses local state (initialized from props) and calls onExceptionsChange on bulk classify. Action Hub tab hidden in embedded mode to avoid GRC_EXCEPTIONS leakage. Standalone Manage Exceptions unchanged. Build size decreased ~28KB (old custom case UI replaced by wrapper). Tab renamed to "Exceptions & Cases". |
| 2026-05-15 | Made ManageExceptionsView prop-driven for future V3 embedding. Added optional props: exceptions (GrcException[]), onExceptionsChange callback, contextLabel. When exceptions prop provided, component uses it instead of hardcoded GRC_EXCEPTIONS. Standalone Manage Exceptions page unchanged — defaults to GRC_EXCEPTIONS when no prop passed. ExceptionsTable and BulkClassifyModal already prop-driven (receive data from parent). BulkActionGroupModal and ActionHubView still use GRC_EXCEPTIONS directly — acceptable since V3 won't use those sub-views. No V3 wiring yet. |
| 2026-05-15 | Code-level browser QA for V3 BulkExecuteModal integration. Traced all 6 critical paths: (1) wizard → engagement.businessProcess flows correctly to adapter, (2) modal isSingleBp validation passes since all V3 workflows share same BP, (3) modal step 1/2/3 flow uses internal mock data for demo — acceptable prototype, (4) step 3 startBulkRun triggers global progress panel then onContinue fires handleBulkModalComplete, (5) V3 run created+simulated → outputs/exceptions in state, (6) Output Review reads completed runs correctly. No additional bugs found. Modal step 2 uses BulkExecuteModal's own SEED_UPLOADED_FILES/DEMO_REVIEW_WORKFLOWS — doesn't integrate V3 input data sources yet (noted as future enhancement, not a bug). |
| 2026-05-15 | QA tested V3 Runs integration with BulkExecuteModal. 1 bug fixed: businessProcess in V3-to-LibraryWorkflow adapter was mapped from cfg.inputType (e.g. "HYBRID") instead of engagement.businessProcess (e.g. "P2P"). Fixed to use engagement.businessProcess with fallback "P2P". Also fixed useMemo dependency to engagement.businessProcess instead of engagement.config. Verified: existing Workflow Library regression safe, V3 single/multi-workflow modal paths work, Q&A direct run still works, V3 downstream state (Output Review/Cases/Reports/Schedule) receives run results correctly, project-created workflows map safely. |
| 2026-05-15 | Wired extracted BulkExecuteModal into V3 Automation Project Runs tab. For workflow modes (SELECT_EXISTING_WORKFLOW, CREATE_NEW_WORKFLOW), clicking "Run Workflow" / "Run Selected Workflows" opens the Workflow Library BulkExecuteModal with V3 workflows mapped to LibraryWorkflow format. On modal completion, V3 creates + simulates a run using existing simulateRun logic, feeding V3 state (outputs/exceptions flow to Output Review/Cases/Reports/Schedule). Q&A mode keeps direct run creation without modal. Existing Workflow Library behavior unchanged. V3 Automation Project now reuses Workflow Library bulk execution UX instead of duplicating a separate run creation experience. |
| 2026-05-15 | Extracted Workflow Library BulkExecuteModal into reusable component (src/components/workflow/BulkExecuteModal.tsx, 2429 lines). Moved BulkExecuteModal + 13 helper components + all modal types/constants/mock data out of WorkflowLibraryView.tsx (reduced from 3159 to 728 lines). Named exports: BulkExecuteModal, Checkbox. WorkflowLibraryView imports and renders the extracted component identically. No behavior change. Prepares future embedding of existing bulk run flow into V3 Automation Project. |
| 2026-05-15 | Added manual custom sub-process creation in Internal Audit Scope tab. CustomSubProcess type (id/name/businessProcessId/createdAt/source:CUSTOM) added to InternalAuditScopeState. UI: "Add Sub-process" button next to sub-process chips, inline input with name validation (required, no duplicates), auto-select on creation, "Custom" badge on chips, remove (X) on custom chips. Custom sub-processes merge with predefined ones for selection, scope summary, and scope text. Working Paper and Final Report use scope narrative text — no direct sub-process name resolution needed. Assignment-level only, not global library. |
| 2026-05-15 | Refactored Automation Cases from generic create/resolve model to owner assignment and response model. Internal CaseStatus enum values unchanged (OPEN/IN_PROGRESS/RESOLVED/CLOSED/CANCELLED) — added CASE_STATUS_LABELS map for user-facing labels: Sent to Owner / Owner Response In Progress / Submitted for Review / Accepted & Closed / Closed — Not Required. Renamed "Create Case" CTAs to "Assign Case" / "Assign Selected Cases". Added AssignmentPanel with owner/reviewer/due date/deficiency/priority/message fields. Case detail refactored into 3 sections: (1) Exception & Auditor Assignment (auditor-owned), (2) Owner Response / Action Plan with root cause + remediation + preventive action + evidence + Submit Response to Auditor validation, (3) Auditor Review & Closure with Accept & Close / Reject Send Back / Close as Not Required. Added preventiveAction and auditorNotes fields to AutomationCase. Summary cards updated: Assigned / With Owner / For Review / Closed. Reports updated: case status uses assigned/submitted/accepted terminology. deriveCasesSummary updated for new flow. |
| 2026-05-16 | Updated Automation Output Review to group outputs/exceptions by workflow after bulk runs. Workflow result accordion sections with expand/collapse, output/exception counts, review status per workflow. Added workflow-level drilldown detail panel showing per-workflow outputs, exceptions, stats, and case CTAs. Added sourceWorkflowId to AutomationRunOutput and AutomationRunException interfaces and wired through simulateWorkflow/simulateRun. Existing output review actions (Review/Approve/Reject, bulk triage, Case Candidate marking) preserved within grouped UI. |
| 2026-05-16 | Updated Automation Reports tab to use existing platform Report module visual style (purple gradient header/banner with FloatingLines, executive summary stat cards, workflow-wise sections). Report now compiles workflow-wise outputs, exceptions, findings, and classification summaries. Purple header matches platform report style (from-[#3b0b72] to-[#6a12cd] gradient, FloatingLines overlay, metadata bar). Executive summary cards use same glass-card pattern as platform reports. Workflow sections show outputs, findings bullets, exception breakdown, and case status per workflow. Cases & Classification Summary section with deficiency breakdown. Key Metrics section. Recommendations section. Report actions: Apply Template / Share / Download (placeholders). Report data reads entirely from V3 automation state — no unrelated global mock data. |
| 2026-05-17 | Added Data Period From/To fields to wizard Details step and ConfigurableEngagement type (dataPeriodStart, dataPeriodEnd). Planned Start/End Date = execution work timeline. Data Period From/To = period of data being reviewed/tested/analyzed. Both shown in Review & Create summary. Workspace header shows Data Period and Planned Period separately. Automation Report metadata uses Data Period for "Data Period" field. Inline validation warns when Data Period From is after Data Period To. Fields are optional. |
| 2026-05-17 | Continuous Monitoring Dashboard redesigned to match platform Dashboard visual pattern. Uses glass-card containers, platform KPI card style (text-ink-500 labels, text-ink-900 values), Alerts & Daily Digest bar with Sparkles gradient icon + AI Summary pill + Share with Team, recharts-based charts (AreaChart for exception trend, BarChart for workflow distribution, PieChart for exception status + output approval breakdown), Workflow Health table with platform table style (bg-canvas-elevated header, hover:bg-primary/[0.015]), quick action buttons with border-canvas-border. Alert items use platform type colors (text-high-700 bg-high-50 for alerts, text-compliant bg-compliant-50 for improvements). All semantic color tokens used (compliant, evidence, high, risk, mitigated, brand, ink). Dashboard tooltip on wizard checkbox. Compliance/IA overviews unchanged. |
| 2026-05-17 | Added Automation Projects portfolio/monitoring landing view. Shows multiple automation project cards (8 mock monitoring areas) with platform glass-card style, KPI summary row, search, status filters. Each card shows project name, description, business process, status, workflow/exception/case metrics, records processed, coverage bar, frequency, last run status. Clicking a card opens existing V3 Automation Project workspace with metadata prefilled from card. "Create Automation Project" CTA opens wizard with automation pattern pre-selected (skips pattern selection step). Back from workspace returns to portfolio. Hierarchy: Portfolio Dashboard → Automation Project Workspace → Workflows/Runs/Outputs/Cases/Reports/Schedule. WorkspaceHeader backLabel now dynamic ("Back to Automation Projects" when from portfolio). Fixed: portfolio now appears only after selecting Workflow Automation Project from Work Type selection, not as initial V3 landing. V3 first screen is always Choose Work Type. Compliance/IA go to wizard directly. Automation goes to portfolio. Back from portfolio returns to Work Type. |
| 2026-05-18 | Fixed Compliance creation flow. Removed redirect to real Process Hub (which had "coming soon" dead-end for new engagement). Compliance now flows: Work Type → V3 Engagement View → Plan Engagement → Details → Setup → Review & Create → V3 Compliance Workspace. Plan Engagement properly initializes wizard state (selectedPattern, config, details reset). Engagement object is fully created before rendering workspace. Automation portfolio flow unchanged. |
| 2026-05-17 | Compliance Control Testing now opens Process Hub-style Engagement View after selecting work type. ComplianceEngagementView.tsx shows engagement cards (5 mock compliance engagements) matching Process Hub EngagementCard visual pattern (icon, name, type, status badge, controls/tested/deficiencies metrics, progress bar, owner, dates, effective%). Clicking card opens V3 Compliance workspace. "Plan Engagement" opens Compliance wizard. Back navigations: Engagement View → Work Type, Compliance workspace → Engagement View. KPI strip shows aggregate controls/tested/effective/deficiencies. Status filter pills. Hierarchy: Work Type → Engagement View → Compliance Workspace. Automation/IA flows unchanged. Process Hub standalone unchanged. |
| 2026-05-17 | Output approval now controls report inclusion. Approve = include in report, Exclude = omit from report, Pending = not included until approved. Output Review button labels updated: "Reject" → "Exclude", review state "Rejected" → "Excluded". Helper text added to Outputs sections ("Approve outputs to include in the report") and Exceptions sections ("Mark valid exceptions as case candidates"). Exception count in workflow accordion is now clickable to expand that workflow. Report workflow sections now show "Included in Report" / "Excluded" / "Pending Review" per output with visual distinction (excluded outputs dimmed with strikethrough). Report executive summary and key metrics now show output approval breakdown (approved/excluded/pending). Warning shown when no outputs are approved. Cases tab now has workflow filter — pill buttons filter ManageExceptionsView to show only exceptions from the selected workflow. Sync-back to V3 state still works across all workflows. |
| 2026-05-18 | Converted V3 engagement creation wizard to modal-based flow. Plan Engagement / Create Engagement / Create Automation Project now opens a modal wizard instead of a full-page form. Modal uses BulkExecuteModal visual pattern: centered overlay, blurred backdrop, header with close button, stepper bar (matching BulkExecuteModal's circular step indicators), scrollable body, footer with Back/Cancel and Next buttons. All 4 wizard steps preserved inside modal (Work Type, Details, Setup, Review & Create). Modal starts at Details step when pattern is preselected from landing page. Create closes modal and opens workspace. Cancel/X/Back-on-step-1 safely close modal. Landing pages (ComplianceEngagementView, AutomationPortfolioView) and workspaces remain full-page. Work Type hub page acts as V3 entry point: selecting Compliance → ComplianceEngagementView, selecting Automation → AutomationPortfolioView, selecting IA → opens modal directly. Compliance/IA/Automation pattern functionality unchanged. No fields removed. No validation changes. |
| 2026-05-19 | IA Final Report redesigned as full management-facing audit report. Purple gradient header banner matching platform report style. Structured sections: Report Header, Executive Summary (4 KPI cards), Scope & Objective (with SOP/RACM/Checklist source tags), Audit Approach, Audit Snapshot (10 metrics), Detailed Observations (per-observation cards with condition/root cause/impact/recommendation/process owner response/agreed action/status), Process Owner Response Summary table, Overall Conclusion (Satisfactory/Needs Improvement/Unsatisfactory), Sign-off & Distribution, Appendix, Report History. Generate/Regenerate/Mark Ready/Issue workflow. Only report-ready observations included. Working Paper remains evidence trail. |
| 2026-05-19 | IA Observations tab improved with control-wise traceability. Added "All / Group by Control" toggle — groups observations under control headers with High/Critical and Ready counts. Added control filter chip bar for quick filtering. Each observation row now shows control name + workflow name lineage in subtitle. Existing Edit/Ready/Drop/Reopen actions unchanged. Discussion readiness logic unchanged. |
| 2026-05-19 | IA Controls → Analysis flow enhanced. Controls tab CTA wording changed to "Execute Workflow(s)" (audit-friendly). SOP-derived controls now generate multiple controls with deterministic workflows matching RACM names. Analysis tab now shows "Control Execution Summary" (executive summary with controls/workflows/findings/high-critical/pending counts) and "Control-wise Findings" section grouped by control with findings showing severity, status (Potential Finding), source workflow, and actions (Review/Dismiss/Promote to Observation). No auto-created Observations. |
| 2026-05-19 | IA Controls tab upgraded: expandable controls show linked workflows with checkbox selection. "Run Selected Workflows" opens existing BulkExecuteModal (same as Automation Project / Workflow Library). On completion, workflow runs are simulated via simulateAnalysisRun() and added to IA Analysis state as AnalysisRun records with exceptions as potential findings. Success banner with "View in Analysis" CTA. Controls with no workflows show empty state directing to RACM tab. No Observations created automatically. BulkExecuteModal behavior unchanged. |
| 2026-05-19 | IA RACM tab now reuses RacmMappingWorkspace (inline=true) from Business Process RACM module. Provides the same expand/risk/control/workflow/attribute mapping experience scoped to IA assignment. Direct RACM selection renders one RacmMappingWorkspace per selected RACM. SOP-only selection shows SOP context card with "Open RACM Mapping" CTA that expands into a default RacmMappingWorkspace. All Business Process RACM actions work: expand RACM, expand risks, view mapped controls, Link Existing Control, Create New Control, Manage Control, Workflow Readiness drawer, Link Workflow, Create Workflow, Add Attribute. Business Process RACM behavior unchanged. |
| 2026-05-19 | IA tab flow now adapts based on selected Scope Sources. Checklist selection adds Controls tab before Analysis. RACM or SOP selection adds RACM and Controls tabs before Analysis. Tabs dynamically hidden/shown via hiddenTabIds in ConfigurableEngagementWorkspace. Lightweight InternalAuditRacmTab shows selected RACMs with risks/controls/review status, or SOP-derived placeholder. InternalAuditControlsTab shows controls/check items derived from Checklists, RACMs, and SOPs with source badges and review status. Requests/IDR "Continue" CTA dynamically routes to RACM → Controls → Analysis based on scope. No deep analysis logic added yet. |
| 2026-05-19 | Added Internal Audit Assignment landing page (InternalAuditAssignmentView.tsx). Shows 7 mock IA assignment rows in a table with status, observations, action plans due, period, and next action. KPI strip (Assignments/In Progress/Pending Report/Observations Open/Actions Due/Closed). Status filters + search. Clicking row opens IA workspace with metadata prefilled. "Create IA Assignment" opens wizard modal with IA pattern preselected. Back from workspace returns to IA Assignments page. Back from IA page returns to Engagement Library. Engagement Library now routes all 3 patterns to landing pages: Compliance → Engagement View, IA → IA Assignments, Automation → Automation Projects. |
| 2026-05-19 | Redesigned Engagement Config landing as Engagement Library. Three pattern cards (Compliance Control Testing, Internal Audit Assignment, Workflow Automation Project) with purpose descriptions, "Best for" tags, workflow flow chips with arrows, and colored CTA buttons. Summary mini-cards at top (Compliance-ready / IA Lifecycle / Workflow Automation). "Which one should I choose?" recommendation section. Pattern-specific accent colors (primary/purple/emerald). Page width increased to max-w-3xl. Preserved all downstream flows: Compliance → ComplianceEngagementView, IA → wizard modal, Automation → AutomationPortfolioView. No functional changes to any pattern. |

---

## 18. Exception Triage & Case Assignment Model

- Exception = system-generated finding from workflow
- Deficiency = auditor/user classification of the valid issue (set during triage)
- Case Candidate = reviewed exception selected for follow-up (with deficiency/owner/due date)
- Case = assigned follow-up item — assigned to risk/process owner, not just "created"
- Cases are assigned to risk/process owners after exception triage
- Risk/process owner provides root cause, remediation plan, preventive action, evidence, and submits response
- Auditor/project owner reviews response and accepts/closes or rejects/sends back
- "Create case" language should be avoided where assignment is the real business action
- Bulk triage is required for high-volume automation exceptions
- Not every exception becomes a case — user reviews and selects valid ones

Case status flow (internal → user-facing label):
- OPEN → Sent to Owner
- IN_PROGRESS → Owner Response In Progress
- RESOLVED → Submitted for Review
- CLOSED → Accepted & Closed
- CANCELLED → Closed — Not Required

Case detail has 3 sections:
1. Exception & Auditor Assignment (auditor-owned)
2. Owner Response / Action Plan (risk/process owner-owned)
3. Auditor Review & Closure (auditor accept/reject/close)

---

## 17. Automation Project — Workflow Data Model

- Automation Project has a shared input data source pool (`inputData.dataSources`).
- Each workflow (mock or project-created) maps to one or more project data sources via `linkedDataSourceIds`.
- Workflow Builder can add new data sources; new sources are synced back to project-level Input Data (`onUpdateInputData`).
- Create New Workflow feeds the same workflow list used by Select Existing Workflow.
- `createdWorkflows: ProjectCreatedWorkflow[]` on `AutomationSetupState` stores project-created workflows.
- `selectedWorkflowIds` / `selectedWorkflowNames` are shared between both setup modes — they reference both mock library IDs and created workflow IDs.

---

## 16. Implementation Protocol

Before every future implementation step:
1. Read `docs/CONFIGURABLE_ENGAGEMENT_V3_MEMORY.md`
2. Identify exact scope of current prompt
3. List files you plan to modify
4. Modify only those files
5. Do not implement future stages unless explicitly requested
6. Do not infer extra functionality from context
7. Keep existing modules working
8. Keep app compiling
9. Update memory file if product decisions or implementation details change
10. End response with:
    - Files changed
    - What was implemented
    - What was intentionally not implemented
    - Risks / open questions
    - Next recommended prompt

**CRITICAL RULE: Context is not scope.**
