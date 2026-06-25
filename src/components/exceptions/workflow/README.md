# Approval & Configuration module (approval-route engine)

A configurable, data-driven engine for delegating audit-exception work through
multi-level **approval routes**, with column-level RBAC. Lives entirely under
`src/components/exceptions/workflow/` and surfaces as the **Approval & Configuration**
tab inside `ManageExceptionsView`. (Internal code identifiers keep the `workflow`
prefix; the user-facing term for a configured chain is an **approval route**.)

Nothing here is hardcoded: level names, approval chains, approval modes, SLAs and
column permissions are all data. The same engine can later drive other use cases
(action-plan approvals, evidence reviews) — only the integration hook changes.

## Files
| File | Role |
|------|------|
| `workflowTypes.ts` | All types (templates, levels, assignments, permissions). |
| `workflowData.ts` | Org directory (`ORG_USERS`), seeded templates + in-flight assignments, column catalog, default permissions. |
| `workflowEngine.ts` | Pure transition logic — `computeSla`, `canAct`, `submit`, `applyDecision`, selectors. No hardcoded chains. |
| `WorkflowContext.tsx` | `WorkflowProvider` + `useWorkflow()` store (localStorage-persisted) that mirrors every action to the case Activity Log. |
| `WorkflowModule.tsx` | Tab root: sub-nav + the **Acting as** identity switcher. |
| `WorkflowConfigurator.tsx` | Create/edit reusable workflow templates (the 5 screens #1). |
| `AssignmentModal.tsx` | Assign selected exceptions + set column RBAC (#2). |
| `AssigneeWorkPanel.tsx` | "My Work" — assignee does the work on granted columns (#3). |
| `ApprovalInbox.tsx` | Pending approvals for the acting user (#4). |
| `AssignmentsAdmin.tsx` | Assigner control: pull-back / reassign / needs-reassignment. |
| `WorkflowPipelineBuilder` · `ColumnPermissionMatrix` · `ApprovalActionBar` · `SLABadge` · `WorkflowPipelineView` · `UserPicker` | Reusable sub-components. |

## How to create an approval route
1. Open **Approval & Configuration → Approval Routes**.
2. The persona is fixed to the current **role toggle** (Risk Owner *or* Auditor) — you only see/edit your own side's routes.
3. **Create Route** → name it, add 1..N levels. Per level: name, approver(s), approval **mode** (All / Any / Sequential), **SLA** (hours/days), and whether it may **send back**. Reorder or delete levels freely.
4. Optionally mark it the **default** for new assignments.
5. Editing an existing template **bumps its version**; in-flight assignments keep the version they were created with (template versioning).

## How to assign exceptions
1. In the **Exceptions** tab, select one or more rows → **Send for Approval** (header).
2. Pick the approval route, the **assignee** (the team member who does the work), the **column visibility & edit rights** (the assignee sees only visible columns and can edit only editable ones), an optional note and assignment due date.
3. The chain preview and a **self-approval guard** are shown — you can't assign work to a user who also approves it.

## How approvals progress
1. The assignee opens **My Work** (use **Acting as** to become that user), edits the granted fields, and clicks **Submit for Approval** → the case enters **L1**.
2. Each approver opens **Approval Inbox**, sees the data the assignee saw + prior-level comments + SLA countdown, and **Approves / Rejects / Sends back**.
3. `all` = every approver must sign off; `any` = first approval clears the level; `sequential` = approvers act in order.
4. When the **final level approves**, the engine fires the integration hook (below). Reject returns the case to the assignee; send-back bounces one level (3 send-backs → escalate to assigner).

## Integration hooks (no edits to classification / review logic)
- **Activity Log:** every action appends a `GrcActivityEntry` to `GRC_CASE_DETAILS[exceptionId].activityLog` (see `logToCase` in `WorkflowContext.tsx`) — visible in the existing Review/Activity drawers.
- **Final approval:** `WorkflowProvider`'s `onFinalize` callback (implemented as `handleWorkflowFinalize` in `ManageExceptionsView.tsx`) writes the drafted result back via the *same* `updateExceptions` path the classification/review screens use:
  - **Risk-Owner workflow** → sets the classification + due date and leaves the case **pending Auditor review**.
  - **Auditor workflow** → **closes** the case with the approved action-review status.

## RBAC enforcement
- Only the active **role** (Risk Owner / Auditor) can assign and can create/edit **its own persona's** templates; the other side's templates are hidden.
- The assignee sees **only** their assignments and **only** granted columns; read-only fields render as non-editable values.
- An approver at level N sees everything the assignee saw **plus** prior-level comments.
- **Self-approval is blocked** (warned at assignment, disabled in the action bar).

## Edge cases handled
Pull-back & reassignment (logged), assignee deactivated → `needs-reassignment` flag, template versioning, SLA breach badges, send-back loop limit (≥3 → escalated), and `all`-mode approvals accumulated before the level advances.
