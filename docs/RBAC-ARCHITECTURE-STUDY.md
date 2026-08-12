# RBAC Architecture Study — Irame

> **What this is.** A complete, evidence-backed map of access control in the Irame prototype: the platform permission model, the SOX/ICFR engagement personas, the Exceptions approval engine, how teams and tenants actually behave, a screen-by-screen gating trace, and a ranked list of defects with a recommended unified model.
>
> **How to use it.** This file is self-contained context. Every claim carries a `file:line` citation and was verified directly against source — you should not need to re-derive any of it. If you are about to change access control in this repo, read §1 (the three systems), §7 (gap ledger), and §8 (recommendation), then go straight to the cited lines.
>
> | | |
> |---|---|
> | **Study date** | 10 August 2026 |
> | **Repo** | `Product-handover` (React 19 + TypeScript + Vite prototype) |
> | **Branch** | `feat/engagements-sox-v2` |
> | **Method** | Full read of the permission/context layer + five parallel source sweeps; every gap-ledger claim independently re-verified |
> | **Scope** | Client-side only. There is no backend and no server-side authorization anywhere in this codebase. |
> | **Companion** | Designed narrative version: https://claude.ai/code/artifact/004e9fe5-2497-468c-979d-47e9bae633ab |

---

## Table of contents

1. [The headline: three systems, one bridge](#1-the-headline-three-systems-one-bridge)
2. [System one — platform RBAC](#2-system-one--platform-rbac)
3. [Teams, tenants and sharing](#3-teams-tenants-and-sharing)
4. [System two — SOX engagement personas](#4-system-two--sox-engagement-personas)
5. [System three — Exceptions personas](#5-system-three--exceptions-personas)
6. [Non-SOX engagements](#6-non-sox-engagements)
7. [Screen-by-screen gating trace](#7-screen-by-screen-gating-trace)
8. [Gap ledger](#8-gap-ledger)
9. [Recommended single model](#9-recommended-single-model)
10. [Appendix — file map, counts, verification commands](#10-appendix)

---

## 1. The headline: three systems, one bridge

Access control here is **not one system with gaps**. It is three separate systems, built at different times against different mental models, touching at exactly one line of code.

| # | System | Source of truth | Enforcement depth |
|---|---|---|---|
| 1 | **Platform RBAC** — 7 roles × 73 permission keys | `src/data/rbac.ts` | Route guard (real) + nav + ~164 affordance gates (mostly cosmetic) |
| 2 | **SOX engagement hats** — auditor / risk-owner / reviewer | `src/components/sox-icfr/types.ts:10` | **108 role guards inside the store** — the strictest in the repo |
| 3 | **Exceptions personas** — risk-owner / auditor | `src/components/exceptions/workflow/workflowTypes.ts:6` | Engine-level `canAct()` guards, but on a wholly separate identity directory |

### The only bridge

```ts
// src/components/sox-icfr/SoxIcfrApp.tsx:366-368
const { currentUser } = useCurrentUser();
const initialRole = currentUser?.roleId === 'role-risk'     ? 'risk-owner'
                  : currentUser?.roleId === 'role-reviewer' ? 'reviewer'
                  : 'auditor';
```

This runs **once**, at mount, and only **seeds** the starting hat. After that:

- The SOX module never calls `can()` again. `useCan` appears **zero times** across all 42 files in `src/components/sox-icfr/`.
- The hat switcher (`parts.tsx:97`) has **no restriction whatsoever** — any signed-in user can wear any hat.
- The Exceptions module is not wired to platform RBAC at all beyond one lossy projection (see §5).

### The consequence that dominates everything

```ts
// src/components/auth/LoginView.tsx:19 — the ONLY call site of signIn()
const enter = () => { setActiveWorkspace(selected); signIn(DEFAULT_USER.id); };
// DEFAULT_USER = DEMO_USERS[0] = 'u-admin' / role-admin  (CurrentUserContext.tsx:46)
```

`signIn()` is called from exactly one place and always with the System Administrator. Seven demo personas exist; **six are unreachable through the UI**. The login screen is a *workspace* chooser, not an identity chooser.

**Therefore: in the running app every user holds all 73 permissions.** Every gate in the product is untested by use, and at least two persona-dependent features can never be exercised at all.

The only two ways to reach a non-admin state:
1. Admin → Roles & Permissions → edit the System Admin role and uncheck keys. `RolesWorkspace.tsx:227` writes back into `CurrentUserContext`, so the whole app re-gates live. **This is the demo path.**
2. Manually set `localStorage['auth.currentUserId']` to another `DEMO_USERS` id (read at `CurrentUserContext.tsx:78-84`).

---

## 2. System one — platform RBAC

### 2.1 Model

Flat capability strings — **not** resource+action tuples, **not** a matrix object. A role holds `PermissionKey[]`; `can(key)` is a `Set.has`.

```ts
// src/context/CurrentUserContext.tsx:118-121
const permSet = useMemo(() => new Set(activeRole?.permissions ?? []), [activeRole]);
const can    = useCallback((key: PermissionKey) => permSet.has(key), [permSet]);
const canAny = useCallback((keys: PermissionKey[]) => keys.some(k => permSet.has(k)), [permSet]);
```

There is **no `canAll`** — every multi-key gate is OR.

**Role is an interface, not a union** (`rbac.ts:216-224`), so custom roles can be created at runtime:

```ts
export interface Role {
  id: string;
  name: string;
  type: 'System' | 'Custom';
  description?: string;
  createdBy: string;
  lastModified: string;
  permissions: PermissionKey[];
}
```

### 2.2 The catalogue — 73 keys, 14 modules

```ts
// src/data/rbac.ts:54-84 (verbatim)
export type PermissionKey =
  | 'bp_view' | 'bp_create' | 'bp_edit' | 'bp_delete' | 'bp_share' | 'sop_archive'
  | 'wf_view' | 'wf_create' | 'wf_update_delete' | 'wf_output' | 'wf_run' | 'wf_upload'
  | 'rp_view' | 'rp_edit' | 'rp_comment' | 'rp_share' | 'rp_delete'
  | 'db_view' | 'db_add' | 'db_share' | 'db_delete'
  | 'ds_live' | 'ds_upload' | 'ds_connect' | 'ds_rename' | 'ds_delete'
  | 'eng_view' | 'eng_create' | 'eng_edit' | 'eng_delete' | 'eng_assign' | 'eng_close' | 'eng_share'
  | 'ctrl_view' | 'ctrl_create' | 'ctrl_edit' | 'ctrl_delete' | 'ctrl_link' | 'ctrl_export' | 'ctrl_share'
  | 'racm_view' | 'racm_edit' | 'racm_generate' | 'racm_share'
  | 'racm_link_risk' | 'racm_link_control' | 'racm_link_workflow' | 'racm_unmap' | 'racm_archive'
  | 'risk_view' | 'risk_create' | 'risk_edit' | 'risk_archive' | 'risk_delete' | 'risk_share'
  | 'exc_view' | 'exc_classify' | 'exc_triage' | 'exc_resolve' | 'exc_assign'
  | 'plan_view' | 'plan_edit'
  | 'concierge_use'
  | 'mem_view' | 'mem_approve' | 'mem_admin'
  | 'ad_logs' | 'ad_logs_export' | 'ad_users_manage' | 'ad_roles_manage'
  | 'ad_usage' | 'ad_usage_people' | 'ad_usage_export';
```

Derived sets (`rbac.ts:195-210`):
- `ALL_PERMISSION_KEYS` — flat list in catalogue order
- `VIEW_ONLY_KEYS` — **the first key of each group** (`.slice(0,1)`), i.e. one `*_view`/`*_use` per module
- `presetKeys('none' | 'readonly' | 'full')` — the three role-editor presets

`VIEW_ALL` (`rbac.ts:229`) = `VIEW_ONLY_KEYS` minus `ad_logs`. Excluding `ad_logs` is what keeps the whole Admin nav section administrator-only.

### 2.3 The seven roles

| roleId | Name | Keys | Purpose |
|---|---|---|---|
| `role-admin` | System Admin | 73 | Everything |
| `role-enabler` | Enabler | 51 | Broad creator/operator, minus org admin |
| `role-auditor` | Auditor | 37 | Runs workflows, edits engagements & controls, full RACM linking |
| `role-risk` | Risk Owner | 21 | Owns/archives risks, resolves exceptions |
| `role-reviewer` | Reviewer | 15 | `VIEW_ALL` + `rp_comment` + `exc_triage` only |
| `role-teamlead` | Team Lead | 14 | `VIEW_ALL` + `ad_usage_people` (deliberately **without** `ad_usage`) |
| `role-viewer` | Viewer | 13 | `VIEW_ALL` |

Verbatim role key sets are at `rbac.ts:231-280`.

**Notable asymmetries:**
- No role except System Admin holds **any** `*_delete` key. `eng_delete` is genuinely admin-only.
- `mem_approve` / `mem_admin` are admin-only.
- **Platform "Reviewer" ≠ SOX "reviewer".** At platform level a Reviewer can comment and triage — they cannot approve, sign or close anything. All approval authority lives inside the SOX module on a different axis.

Demo identities, one per role (`CurrentUserContext.tsx:35-43`):

| id | Name | Email | roleId |
|---|---|---|---|
| `u-admin` | Nilesh Anand | nilesh.anand@irame.ai | `role-admin` |
| `u-enabler` | Karan Mehta | karan.mehta@irame.ai | `role-enabler` |
| `u-auditor` | Tushar Goel | tushar.goel@irame.ai | `role-auditor` |
| `u-risk` | Priya Singh | priya.singh@irame.ai | `role-risk` |
| `u-reviewer` | Vijay Reddy | vijay.reddy@irame.ai | `role-reviewer` |
| `u-viewer` | Sana Kapoor | sana.kapoor@irame.ai | `role-viewer` |
| `u-teamlead` | Ayushi Narang | ayushi.narang@irame.ai | `role-teamlead` |

`PERSON_ROLES` (`rbac.ts:312`) maps domain people to role ids — **exported but never imported anywhere.** Dead code.

### 2.4 Enforcement — four tiers, only two of which hold

**183 gate sites total.** Sorted by what they actually do:

| Tier | Sites | Behaviour when the key is missing | Holds? |
|---|---|---|---|
| Route guard | 1 | Screen never mounts; lock state renders instead | ✅ **Real** |
| Handler guard | 18 | `if (!can(…)) return;` at the top of the write | ✅ **Real** |
| Hidden affordance | 93 | Button absent; handler untouched and reachable by any other path | ⚠️ Hides only |
| Dimmed affordance | 71 | Wrapper gets `pointer-events-none`; inner button never gets `disabled` | ❌ **Keyboard-reachable** |

**Route guard** (`src/App.tsx:589-605`) — the one real structural gate:

```ts
const requiredPerm = VIEW_PERMISSIONS[state.view];
const allowed = requiredPerm == null
  || (Array.isArray(requiredPerm) ? canAny(requiredPerm) : can(requiredPerm));
if (!allowed) {
  return <EmptyState icon={Lock} title="Access restricted"
           body="Your current role doesn't have permission to view this area…" />;
}
```

It runs before the `switch (state.view)`, so the target component is never constructed. `VIEW_PERMISSIONS` (`rbac.ts:321-381`) covers **46 of 60 views**. The only OR-gate is `'platform-usage': ['ad_usage', 'ad_usage_people']`.

**Sidebar nav** (`Sidebar.tsx:167-406`) — 15 items gated. Practical effect: Viewer, Reviewer, Risk Owner, Auditor, Enabler and Team Lead all see the **same eleven** items. Only **Administration** (admin only) and **Platform Usage** (admin + team lead) actually differ.

**`<Gated>`** (`src/components/shared/Gated.tsx:25-40`) — the affordance gate:

```tsx
if (allowed) return <>{children}</>;
if (mode === 'hide') return <>{fallback}</>;
return (
  <span aria-disabled title={title ?? 'You do not have permission for this action'}
        className="opacity-40 pointer-events-none cursor-not-allowed">
    {children}
  </span>
);
```

⚠️ **It never sets `disabled` on the child.** `pointer-events-none` stops the mouse, but the inner `<button>` stays in the tab order and **Tab + Enter fires the handler normally.** All 71 disable-mode call sites inherit this — including *Submit for review* and *Sign off* on the engagement working paper. See gap **S2**.

**The closed loop** (the one genuinely good piece): `RolesWorkspace.tsx:227` → `updateRolePermissions` → `CurrentUserContext.tsx:134-136`. Editing the matrix re-gates the live UI immediately. Self-lockout guard at `RolesWorkspace.tsx:222-226` refuses to let you strip your own `ad_roles_manage`. Note: role edits are **not** persisted — only `auth.currentUserId` and `auth.activeWorkspaceId` go to localStorage.

### 2.5 Coverage — 13 keys are dead

Computed by checking every key against every call site:

- **58 keys** are checked in components
- **2 keys** are consulted only by the route guard: `racm_view`, `exc_view`
- **13 keys** are declared, granted to roles, rendered in the admin matrix, and **never read by anything**:

```
bp_edit  bp_delete  eng_share  racm_link_control  racm_link_workflow  racm_unmap
risk_create  risk_edit  risk_archive  risk_delete  mem_view  mem_approve  mem_admin
```

Most damaging: **`RiskRegister.tsx` checks only `risk_share`** (lines 336, 1113). Create (`:933`, `:954`, `:1005`), Edit (`:341`), Archive (`:1093` → `handleArchiveOne` at `:707`) and Delete (`:1119` → `handleDeleteOne` at `:717`) ask for nothing. A Viewer can create, edit, archive and delete risks.

The entire Memory governance area is likewise ungated — `MemoryGovernanceSection` (`AdminView.tsx:2071`) is reachable by anyone who can open Admin.

### 2.6 Ungated views (14 of 60)

```
home  recents  chat  chat-trash  one-click-audit  control-detail
sox-icfr  compliance-engagement  dev-configurable-engagement-v3
ai-concierge-image  ai-concierge-speech  ai-concierge-medical
ai-concierge-insights  ai-concierge-racm
```

`home`, `recents` and `chat` are ungated **by design** (`rbac.ts:369, 380` — Ask IRA is free for everyone). The rest are omissions.

**Deep-link exposure:** `useAppState.ts:206-229` seeds the initial view from `?view=`. Both `?view=control-detail&controlId=X` (`:214`) and `?view=dev-configurable-engagement-v3` (`:227`) land on unmapped routes. `BusinessProcesses.tsx:2985` builds exactly that `control-detail` URL for `window.open`.

---

## 3. Teams, tenants and sharing

**Summary: of the five things that look like access control on screen, two are.**

| Concept | Modelled as | Scopes data? | Verdict |
|---|---|---|---|
| Role | Array of permission keys | Views, nav, buttons | ✅ Enforced |
| Team | String on the user record | One tab, via a permission pair | ⚠️ Reporting only |
| Workspace | Id on the session | Nothing — stamped, never read | ❌ Cosmetic |
| Share | Modal-local state | Nothing — never persisted | ❌ Cosmetic |
| Audit log | Session array | Admin-only to read | ✅ Enforced |

### 3.1 Workspaces are not tenants

```ts
// src/data/workspaces.ts:12-17 — the entire model
export const WORKSPACES: Workspace[] = [
  { id: 'platform',     name: 'Platform',     slug: 'platform',     description: 'Internal • all engagements' },
  { id: 'auditify-mvp', name: 'Auditify MVP', slug: 'auditify-mvp', description: 'Client workspace • 12 members' },
];
```

- Chosen at login (`LoginView.tsx:19`), switchable in the sidebar (`Sidebar.tsx:142`)
- Stamped onto every audit-log row (`AdminDataContext.tsx:121-124, 229-231`) with a careful comment that an event must be attributed to where it happened
- **That stamped `workspaceId` is then never read.** Not by the audit-log viewer, not by usage reporting, not by anything. Verified: zero reads outside `AdminDataContext`.
- No domain entity carries a tenant id. `AdminUser` has no workspace field. Engagements, controls, risks, RACMs, reports, users and teams are all global.

### 3.2 Teams grant no permissions

```ts
// src/context/AdminDataContext.tsx:22-39
export interface AdminUser {
  name: string; initials: string; email: string;
  roleId: string;   // ← this alone drives permissions
  team: string;     // ← a plain string name, one per user
  status: UserStatus; lastLogin: string;
}
export interface AdminTeam { id: string; name: string; members: string[]; owner?: string; }
```

- **Membership is single-sourced on `AdminUser.team`.** `AdminTeam.members` is derived live (`AdminDataContext.tsx:209-216`); the stored team entity is identity + owner only.
- **No path anywhere from a team to a permission.** No team→role link, no team→permission link.
- Seeded teams: *SOX Audit, Engineering, IFC Team, Management*, plus `'—'` for unassigned.
- Good invariants: rename cascades to members; delete resets members to `'—'`; suspending/locking a team owner transfers ownership to another admin member; owner self-heals if invalid.

**The one exception** — teams as a data-scoping mechanism, `PlatformUsageView.tsx:774-790`:

```ts
const teamScoped = peopleAccess && !fullUsage;   // ad_usage_people WITHOUT ad_usage
const myTeam = /* resolve currentUser.email against the roster */;
const scopedUsers = useMemo(() => (myTeam ? users.filter(u => u.team === myTeam) : users), [users, myTeam]);
```

A Team Lead gets **only** the People tab (`:794-798`), filtered to their own team, with no export. This is the only screen in the app where role changes the *data* rather than the affordances. Note the trigger is a **permission pair**, not the team itself.

### 3.3 Sharing has vocabulary but no mechanism

`src/context/ShareContext.tsx` is 38 lines and is only a **modal opener**, not an ACL store.

`ShareModal.tsx` holds the vocabulary — `ACCESS_OPTIONS` (`:41`), `GENERAL_PERMS` (`:42`), `AUDIENCES` (`:43`) — and:
- Member list is `useState(INITIAL_MEMBERS)` (`:255`), hardcoded to Nilesh Anand as owner **regardless of who is signed in** (`:77-79`)
- Nothing persists; state resets every mount
- `DIRECTORY` (`:63-74`) is hardcoded and does **not** match the real roster
- **No `can()` / `useCan()` anywhere in the file**

Only the *trigger buttons* are gated, by `bp_share`, `rp_share`, `db_share`, `eng_share`, `ctrl_share`, `racm_share`, `risk_share`, `wf_output`. The only durable output of a share is an audit event (`:441-447`, `:503-508`).

### 3.4 Audit log

```ts
// src/context/AdminDataContext.tsx:111-125
export interface AuditLog {
  id: string; timestamp: string; user: string;
  action: 'Create'|'Update'|'Delete'|'Login'|'Export'|'Run'|'Upload'|'Share';
  description: string; module: string; entity: string;
  status: 'Success' | 'Failed';
  workspaceId: string;
}
```

- Producer: `useAuditLog()` (`:341`). Callers supply `{action, description, module, entity, status?}`; the context stamps `user` ← `currentUser?.name`, `workspaceId` ← `activeWorkspaceId`, timestamp and id.
- Imported in **102 files**. ~50 distinct `module` strings, with an inconsistency: both display-cased (`'Admin'`, `'Risk Register'`) and `ModuleId`-cased (`'admin'`, `'business_process'`) values are written to the same field.
- Read gate: `ad_logs`, which is stripped from `VIEW_ALL` — **only System Admin sees the log.**
- Export gate: `ad_logs_export` (`AdminView.tsx:1985`). The export neutralises CSV formula injection by prefixing leading `=+-@` (`:1906-1910`) and is itself logged.
- Session-only; cleared on reload.
- Dev-time integrity assertions at `AdminDataContext.tsx:84-93` and `:137-147` fail loudly if a signed-in identity or a log actor is missing from the People list.

---

## 4. System two — SOX engagement personas

**Module root:** `src/components/sox-icfr/` — 42 files, ~27.5k LoC.
**Store:** `src/components/sox-icfr/store.tsx` (2,761 lines) — the single source of persona enforcement.

> `v2ClassicStore.ts` (`src/components/audit/sox-testing/v2/`) is **not** the persona store — it is the scoping/seed store for the FY26 Altura programme. It only contributes the `V2cPerson { processOwner, controlOwner }` shape (`:243-265`) that feeds owner scoping.

### 4.1 The type

```ts
// src/components/sox-icfr/types.ts:8-11
// Three hats, three lines: the owner remediates, the auditor tests, the reviewer
// alone closes. One human may hold owner + reviewer; the auditor stays independent.
export type Role = 'auditor' | 'risk-owner' | 'reviewer';
export const ROLE_LABEL: Record<Role, string> =
  { auditor: 'Auditor', 'risk-owner': 'Risk Owner', reviewer: 'Reviewer' };
```

Related: `Court = 'auditor' | 'risk-owner' | 'reviewer' | 'none'` (`types.ts:27`) — "whose court the ball is in".

⚠️ **Naming collisions to watch:** `SourceRole = 'population' | 'assisting'` (`types.ts:484`, a *file* role, unrelated); `Role` from `src/data/rbac.ts` (the RBAC record); `Persona` in `exceptions/workflow/workflowTypes.ts:6`; `Persona = 'auditor'|'manager'|'cfo'` in `HomeView.tsx:2703` (dashboard widget presets). `ControlDossier.tsx:2517` declares `const [roleChange, setRoleChange]` for a *file* role inside a component that also reads the persona `role`.

### 4.2 Enforcement — 108 role guards in the store

Every mutation is a `useCallback` with a first-line role guard. Two idioms:

```ts
if (role !== 'auditor') return;    // 75 sites — auditor-exclusive
if (role === 'reviewer') return;   // 16 sites — auditor + owner (the evidence lane)
```

Plus two universal locks inside `patchControl` (`store.tsx:459-465`):

```ts
if (!target || isEngagementLocked(prev) || isControlLocked(target)) return prev;
```

**This is materially stronger than the platform layer**, where the equivalent stores (`createdControlsStore.ts`, `createdEngagementsStore.ts`, `riskControlLinksStore.ts`) contain **zero** permission checks.

### 4.3 Navigation surface by hat

| | auditor | risk-owner | reviewer |
|---|---|---|---|
| Tabs | all (Overview, RACM, Risks, Control Library, SOX testing) | **Overview + Control Library only** | all |
| `EngagementOverview` | ✅ | ❌ (gets `Overview` = to-do list) | ✅ |
| `ReviewerQueue` | ❌ | ❌ | ✅ |
| `RiskOwnerPortal` | ❌ | ✅ | ❌ |

```ts
// SoxIcfrApp.tsx:121-123 / SoxClassicApp.tsx:91-93
const tabs = role === 'risk-owner'
  ? levelTabs.filter(t => t.id === 'overview' || t.id === 'controls')
  : levelTabs;
```

Design rule, stated at `extraViews.tsx:1539-1542`: *"Whatever this hat cannot do is ABSENT here, not greyed out."*

### 4.4 The five control-testing steps

Split declared once at `ControlDossier.tsx:3907-3915`:

```ts
const isAuditor = role === 'auditor';
const isOwner   = role === 'risk-owner';
// The evidence lane stays theirs — attaching documents, answering a request, self-attesting.
const canEdit = isAuditor || isOwner;
// The testing pen does not. Conclusions, overrides, the draw, attribute results
// and the sign-off are the auditor's alone.
const canTest = isAuditor;
```

| Step | auditor | risk-owner | reviewer | Code |
|---|---|---|---|---|
| **1 · TOD (Design)** | add/waive docs, design points, validate, conclude, override | renamed **"Documents"**; attach evidence only; conclusion hidden (`hideStatus={isOwner}`) | read-only | `:4108-4113`; owner variants `:1307`, `:1441-1449` |
| **2 · Population** | pick source, filter, IPE test, **Lock** | upload + extract only; IPE and lock absent | read-only | `:4134-4143`; `:2842-2846`; lock at `:2866` |
| **3 · Sample** | draw / extend / resize / approve | **absent** | read-only | `:3302` `canDraw = canEdit && role === 'auditor' && !isControlLocked(control)` |
| **4 · TOE (Operating)** | attribute results, override, conclude | **absent** | read-only | inside the `!isOwner` branch `:4145-4175` |
| **5 · Sign-off** | **Sign** (preparer) | **absent** (`{!isOwner && <VStep n={5} …>}`) | **Countersign** / **Return to auditor** | `:4177`; gates `:3438-3439` |

Store guards for the same five steps (all `store.tsx`):

| Action | Guard | Line |
|---|---|---|
| `setDocStatus`, `attachDesignEvidence` | `role === 'reviewer'` → auditor + owner | 565, 661 |
| `addDesignDoc` / `removeDesignDoc` / `waiveDesignDoc` | `role !== 'auditor'` | 651 / 668 / 676 |
| `setDesignPoint` / `validateDesignPoint` / `overrideDesignPoint` | `role !== 'auditor'` | 571 / 778 / 787 |
| `concludeDesign` / `overrideDesign` | `role !== 'auditor'` | 634 / 644 |
| `setPopulation` / `addPopulationSource` / `setPopulationCheck` / `setPopulationFacts` | `role === 'reviewer'` | 855 / 940 / 906 / 915 |
| `clearPopulation` / `removePopulationSource` / `setSourceRole` | `role !== 'auditor'` | 880 / 981 / 1032 |
| `registerIpe` / `setIpeCheck` / `concludeIpe` / `clearIpe` | `role !== 'auditor'` | 1312 / 1341 / 1382 / 1391 |
| `lockPopulation` / `lockAttributes` / `confirmExtraction` | `role !== 'auditor'` | 1243 / 1253 / 1259 |
| `drawSourceSample` / `approveSource` / `redrawSource` | `role !== 'auditor'` | 1073 / 1105 / 1125 |
| `setSampling` / `extendSample` / `resizeSample` | `role !== 'auditor'` | 1397 / 1403 / 1427 |
| `setSampleResult` / `setStepResult` / `overrideStep` / `testAllAttributes` | `role !== 'auditor'` | 1451 / 1444 / 1466 / 1715 |
| `attestStep` / `addStepEvidence` | `role === 'reviewer'` | 1643 / 1652 |
| `concludeOperating` / `overrideOperating` | `role !== 'auditor'` | 1739 / 1747 |
| `returnControl` | `role !== 'reviewer'` | 2610 |
| `reopenControl` | `role !== 'auditor'` | 2552 |

### 4.5 Four-eyes — correct logic, broken identity

**Person-based identity** (`store.tsx:452-454`):

```ts
// Person-based identity: each hat acts as the engagement's named person, not a
// role label — so self-review guards compare people, and the trail reads real names.
const me = role === 'auditor' ? eng.preparer : role === 'reviewer' ? eng.reviewer : meOwner;
```

`eng.preparer` and `eng.reviewer` are plain strings on the engagement (`types.ts:1364`), seeded as `preparer: 'A. Mehta', reviewer: 'J. Fernandes'` (`mockData.ts:967`).

**The countersign gate** — duplicated in UI and store so it cannot be bypassed from the interface:

```ts
// ControlDossier.tsx:3438-3439
const canSign    = role === 'auditor' && concluded && !so?.preparer;
const canCounter = role === 'reviewer' && !!so?.preparer && !so?.reviewer
                   && notesPending === 0 && so.preparer.by !== me;
```

```ts
// store.tsx:2577-2604 — five stacked guards
if (step === 'preparer' && role !== 'auditor') return;
if (step === 'reviewer' && role !== 'reviewer') return;
…
if (!target || !isControlLocked(target)) return prev;                  // must be concluded
if (step === 'preparer' && target.wpSignoff?.preparer) return prev;    // already signed
if (step === 'reviewer' && (!target.wpSignoff?.preparer || target.wpSignoff.reviewer)) return prev;
if (step === 'reviewer' && prev.reviewNotes.some(n => n.controlId === controlId && n.status !== 'Closed')) return prev;
if (step === 'reviewer' && target.wpSignoff?.preparer?.by === me) return prev;   // self-review guard
```

⚠️ **The break.** `me` follows the **hat**, not the human. The switcher (`parts.tsx:97-112`, labelled "Viewing as") has **no permission check at all**:

```
Wear Auditor  → me = eng.preparer ("A. Mehta")     → sign
Click switcher (no check)
Wear Reviewer → me = eng.reviewer ("J. Fernandes") → countersign
preparer.by !== me  →  "A. Mehta" !== "J. Fernandes"  →  true  →  allowed
```

One person, one keyboard, both signatures. The guard compares two names, **neither of which is the person who is signed in.**

**Where the switcher renders:** `SoxIcfrApp.tsx:180, 274, 348` and `SoxClassicApp.tsx:146, 228, 293` — engagement level only. It is **absent** on the control dossier and RACM matrix (`SoxClassicApp.tsx:255-257`: *"the persona is fixed until you go back to the engagement"*). Switching resets navigation (`store.tsx:486-491`).

**Per-control independence** exists but is applied inconsistently (`store.tsx:94-102`):

```ts
function ownsIt(state: IcfrEngagement, controlId: string, person: string): boolean {
  const c = state.controls.find(x => x.id === controlId);
  return !!c && isOwnerOf(c, person);
}
```

Applied in `confirmRating` (2006), `returnRating` (2027), `reviewPlan` (2075), `signOffException` (2416). **Not** applied in `signOffControlWp`, `returnControl` or `reopenControl` — so a reviewer who is also a named owner of the control can countersign its working paper.

### 4.6 Return to auditor (reject)

`store.tsx:2609-2632`:
- `role !== 'reviewer'` → refused
- Refuses if already countersigned
- **Both track conclusions cleared** (`design.conclusion` and `operating.conclusion` → `'Not tested'`, overrides and testedBy/At wiped)
- **Signature voided** (`wpSignoff: undefined`)
- Reason stamped: `reviewReturn: { reason, by: me, at }` — mandatory in UI (`ControlDossier.tsx:3423-3424`)
- Trail event `kind: 'review-return'`
- **Sample results survive** — only conclusions clear
- Banner shown to the auditor on re-entry (`ControlDossier.tsx:4078-4090`), hidden from the owner

### 4.7 Owner scoping — two levels

Role-lane (`role === 'risk-owner'`), then **person-lane** (`meOwner`, `store.tsx:440-450`).

The driving predicate is **dual** (`auditScope.ts:330-348`):

```ts
export function isOwnerOf(c: Control, who: string): boolean {
  const o = ownersOf(c);
  return o.controlOwner === who || o.processOwner === who;
}
```

⚠️ **Inconsistently applied:**
- `ControlLibrary.tsx:334`, `ControlRegister.tsx:200` → `isOwnerOf(c, meOwner)` (both capacities)
- `Overview.tsx:99-100`, `RiskOwnerPortal.tsx:72`, `NotificationsBell.tsx:73, 102, 141, 158` → `c.owner === meOwner` (control owner only)

A process owner who is not the control owner sees the control in the register but gets no counts, no due-test reminders and no notifications for it.

**Execution trail is redacted per-person** (`ControlDossier.tsx:3684-3687`):

```ts
eng.executions.filter(e => e.controlId === control.id
  && (track === 'all' || e.track === track)
  && (!isOwner || e.role === 'risk-owner' || e.kind === 'request-docs' || e.kind === 'receive-doc'))
```

**Working papers swap by hat:** `{isOwner ? <button>Remediation brief</button> : <button>Working paper</button>}` (`ControlDossier.tsx:4022-4028`). Owner-safe substitute built from owner-only fields (`RemediationBriefModal.tsx:99-101`).

### 4.8 Locking — three distinct mechanisms

**(a) Whole-control lock** — concluded ⇒ frozen for **everyone including the auditor** (`helpers.ts:1222-1229`, enforced in `patchControl`). Only exits: `reopenControl` (auditor + reason) or `returnControl` (reviewer + reason).

**(b) Engagement lock** — countersigned ⇒ permanent, no reopen (`helpers.ts:1230-1233`). Checked in `patchControl` plus ~20 non-control mutations.

**(c) Step-level sequencing gates** (`ControlDossier.tsx:3924-3933`) — not persona-based:

```ts
const toeLocked    = designResult !== 'Effective';
const popLocked    = populationLocked(control);
const sampleLocked = toeLocked || (!control.operating.sampling && !popLocked);
```

Toggles look *refused* rather than dead (`parts.tsx:24-29`).

**(d) ITGC cascade** — a failed ITGC withdraws "test of one" across the engagement (`parts.tsx:356-392`), hidden from the owner (`ControlDossier.tsx:4096`).

### 4.9 Review notes — complete API, zero UI

Model: **raise (reviewer) → resolve (auditor) → verify/close (reviewer)**, with **reopen (reviewer)** as the loop-back.

```
// store.tsx:2634-2667
raiseReviewNote    role !== 'reviewer' → return;  status 'Open',     stamps raisedBy: me
resolveReviewNote  role !== 'auditor'  → return;  'Open' → 'Resolved' + resolution
verifyReviewNote   role !== 'reviewer' → return;  'Resolved' → 'Closed' + verified
reopenReviewNote   role !== 'reviewer' → return;  'Resolved' → 'Open'
```

**Blocking power:** any note not `Closed` blocks the countersign (`store.tsx:2586`, `ControlDossier.tsx:3439`, `WorkingPaperModal.tsx:92`).

**Court follows notes** (`helpers.ts:1597-1600`):
```ts
if (notes.some(n => n.controlId === c.id && n.status === 'Open'))     return 'auditor';
if (notes.some(n => n.controlId === c.id && n.status === 'Resolved')) return 'reviewer';
```

🔴 **All four functions have ZERO call sites outside the store.** Verified by repo-wide grep. Read-only consumers still ship (`ControlRegister.tsx:102, 455`; `ReviewerQueue.tsx:85-121`; `WorkingPaperModal.tsx:122`), so the seeded open note on `P2P-C-04` **permanently blocks its countersign with no way to clear it.** `tests/_sox-review-notes.spec.ts` (96 lines) tests a surface that no longer exists.

### 4.10 The baton / court model

```ts
// helpers.ts:1595-1609
export function courtFor(c: Control, tasks: HandoffTask[], notes: ReviewNote[] = []): Court {
  if (tasks.some(t => t.controlId === c.id && t.assigneeRole === 'risk-owner' && t.status === 'open')) return 'risk-owner';
  if (notes.some(n => n.controlId === c.id && n.status === 'Open'))     return 'auditor';
  if (notes.some(n => n.controlId === c.id && n.status === 'Resolved')) return 'reviewer';
  const concl = controlConclusion(c);
  if (concl === 'Effective' || concl === 'Ineffective') {
    if (c.wpSignoff?.reviewer) return 'none';
    return c.wpSignoff?.preparer ? 'reviewer' : 'auditor';
  }
  return 'auditor';
}
```

### 4.11 Exceptions / deficiencies — the 6-step flow

Court map (`helpers.ts:240-251`):

```
Identified → auditor | Rating review → reviewer | Planning → risk-owner
Plan review → auditor | Remediation → risk-owner | Retest → auditor
Awaiting reviewer → reviewer | Closed → none
```

Store guards: `completeSizing` `:1974` auditor · `confirmRating` `:2000` reviewer · `returnRating` `:2021` reviewer · `submitPlan` `:2046` **risk-owner** · `reviewPlan` `:2068` auditor · `drawRetestSample`/`setRetestResult`/`recordRetest` `:2219/2264/2280` auditor · `updateRemediation` `:2322` **risk-owner** · `addRemediationEvidence` `:2333` risk-owner · `raiseChallenge` `:2346` risk-owner · `respondToChallenge` `:2384` auditor · `signOffException` `:2411` reviewer · `reopenException` `:2432` blocks risk-owner.

### 4.12 Ungated store mutations

No role guard at all: `registerFile` (`:1188`), `setFileOrigin` (`:1206`), `addRacmDoc` (`:1841`), `addComment` (`:1878`), `resolveDiscussion` (`:1889`), `submitTask` (`:1894`), `clearTask` (`:1908`), `raiseQuery` (`:1912`), `reconcileScope` (`:2117`), `addControl` (`:2671`), `createAudit` (`:1494`), `updateAudit` (`:1579`), `openControl` (`:511`), `openDeficiency` (`:1599`).

Most consequential:
- `addControl` — UI-gated auditor-only; store accepts from anyone
- `createAudit` / `updateAudit` — UI gate is `role !== 'risk-owner'`, so **the reviewer can start and reconfigure an audit cycle** (a preparer act); store enforces neither
- `setFileOrigin` — changes System-export vs Client-prepared, which feeds IPE reliability. `AuditConfigView.tsx:167` says a change should raise a review note — which per §4.9 cannot happen
- `reconcileScope` — re-derives in-scope processes/controls; ungated, while its sibling `updateMateriality` (`:2099`) is auditor-only

---

## 5. System three — Exceptions personas

```ts
// src/components/exceptions/workflow/workflowTypes.ts:6
export type Persona = 'risk-owner' | 'auditor';   // two values — no reviewer
```

Structurally identical but separate type: `ExceptionRole` (`useAppState.ts:88`).

### 5.1 The lossy projection from platform RBAC

Two **different** derivations that disagree:
- `ManageExceptionsView.tsx:314` — `can('exc_resolve') ? 'risk-owner' : 'auditor'`
- `useAppState.ts:353` (and `:335-337`) — `authRoleId === 'role-risk' ? 'risk-owner' : 'auditor'`

Consequences:
- **`role-reviewer` collapses to `auditor`** — it lacks `exc_resolve`, so a Reviewer gets the full Auditor surface despite holding only `exc_triage`
- **`role-enabler` disagrees between the two rules** (it has `exc_resolve`). ManageExceptionsView wins after mount
- The mount effect depends only on `[can]`, which is memoized on `permSet` and therefore stable — so it fires **once** and never re-corrects a manual toggle. The `RoleToggle` (`:284-307`, rendered at `:1045`) is a genuine free-for-all after mount

### 5.2 A third identity directory

`OrgUser` (`workflowTypes.ts:14-23`) — **8 hardcoded fictional users** in `workflowData.ts:10-21`, each tagged with a persona. **No connection to `CurrentUserContext`, `AuthUser`, `PEOPLE` or `PERSON_ROLES`.**

`ActingAsSwitcher.tsx:13-34` sets `currentUserId` in `WorkflowContext`, filtered to the current persona's 4 users (`:15`). Any signed-in platform user can become any of the 8.

### 5.3 The approval engine (genuinely capable)

- **Templates** (`workflowTypes.ts:34-43`) in a module-level mutable store with a listener set (`approvalFlowStore.ts:10-42`); `upsert` auto-bumps `version` so in-flight assignments keep their snapshot
- **Modes** (`workflowTypes.ts:9-12`): `'all'` (parallel-AND), `'any'` (parallel-OR), `'sequential'`
- **Statuses**: `drafting | in-approval | approved | rejected | needs-reassignment | pulled-back | escalated`; levels `pending | in-progress | approved | rejected | sent-back`
- **`SEND_BACK_LIMIT = 3`** → `escalated` (`workflowEngine.ts:9, 110-116`)
- **Two full cycles**: cycle 1 approves the *action plan*; `submitActionForReview` resets and runs the chain again for the *Action Taken*. `'Partially Implemented'` forces back to `rejected` and reopens
- **RO route hands off to auditor** rather than finalising (`WorkflowContext.tsx:371-381`), appending an `Auditor Review` level assigned to `AUDITOR_LEAD_ID = 'u-au-owner'`

**Real enforcement** (`workflowEngine.ts:47-56`):
```ts
if (userId === a.assigneeId) return { ok: false, reason: 'You cannot approve your own submission.' };
```
`decide()` is only ever called behind a `canAct(...).ok` check.

⚠️ `ReviewDrawers.tsx:662-665` — `onRouteTurn || canTriage` means being a current-level route approver **bypasses the `exc_triage` permission entirely.** The workflow persona layer overrides platform RBAC there.

### 5.4 Dead code in this module

`AssignmentsAdmin.tsx:23`, `ApprovalInbox.tsx:98`, `AssigneeWorkPanel.tsx:15`, `WorkflowModule.tsx:7`, `ColumnPermissionMatrix.tsx:22` — the whole "5 screens" set described in `workflow/README.md` is **unmounted**. The live surface is the Exceptions table + drawers.

Reachable config surfaces: `WorkflowConfigurator` (mounted at `EngagementsView.tsx:630`, Engagements → "Approval Flow" tab) → `WorkflowPipelineBuilder`. `currentUserId` there is **hardcoded** (`flowRole === 'auditor' ? 'u-au-owner' : 'u-ro-owner'`). No `useCan()` anywhere in that path. `slaHours` is in the type and defaulted to 48 but **has no editor UI**.

---

## 6. Non-SOX engagements

**There is no engagement team model.** Compliance V3, Internal Audit and Automation share one configurable type whose entire people layer is:

```ts
// src/components/engagement-configurable/configurableEngagementTypes.ts:189-190
owner: string;
reviewer?: string;
```

Plus `processOwner: string` (`:146`) for Internal Audit only. No `team`, no `members[]`, no `preparer`, no `auditors[]`.

**A richer type exists and is dead:**
```ts
// src/data/engagements.ts:31-36
export interface EngagementTeam { reviewer?: string; auditors?: string[]; riskOwners?: string[]; }
```
Written by `audit/CreateEngagementWizard.tsx:337`, read by **nothing**.

### 6.1 Every assignment is free text

~25 person-shaped fields across the three patterns — `requestedFrom`, `providedBy`, `owner`, `testedBy`, `uploadedBy`, `submittedBy`, `reviewedBy`, `finalizedBy`, `classifiedBy`, `processOwner`, `actionOwner`, `preparedBy`, `issuedBy`, `remediationOwner`, `actor` … — **all typed `string`**. No enum, no id, no reference type.

Role names visible in those screens (*AP Manager*, *Finance Controller*, *P2P Process Owner*, *Vendor Master Owner*, *Audit Lead*) are strings typed into `<input>` boxes, defaulting to `'Unassigned'`. **"Lead Auditor" exists only as text inside a generated email body** (`internalAuditAnnouncementData.ts:86-91`).

The only picker-driven person assignment in the whole engagement domain is in the **legacy** `components/audit/` surface (`CreateEngagementWizard.tsx:834-844`, `EngagementOverviewView.tsx:822-826`).

### 6.2 Exactly one enforced people rule

```ts
// patterns/compliance/ComplianceReviewTab.tsx:57-58
// Maker-checker: the signed-in reviewer must differ from the preparer.
const isSelfReview = ctrlReview.status === 'PENDING_REVIEW' && ctrlReview.submittedBy === userName;
```
`:244` `actionsDisabled = isSelfReview`; Approve (`:291`) and Reject (`:296`) disabled; both handlers re-guard.

⚠️ It compares **names, not roles**. `engagement.reviewer` is never checked against `currentUser`. Anyone who is not the preparer can approve, including a Viewer. Its own remedy text (`:280`) says *"Switch user (profile menu) to approve or reject"* — **that switcher does not exist.**

Also enforced: `hasReviewer = !!engagement.reviewer` gates Submit-for-review (`:54-55`); conclusion derivation returns empty unless review is `APPROVED` (`complianceConclusionData.ts:68-70`).

### 6.3 Exactly one persona-aware component

`ComplianceRequestsPBCTab.tsx:52` — and it is the **only place in the app that branches on a hardcoded role id** rather than a permission key:

```ts
const isRiskOwner = currentUser?.roleId === 'role-risk';
```

Effects: draft requests **filtered out of the data** (`:71` — real), Create hidden (`:123`), headings/columns/banner/actions swap (`:115, 118, 132, 169, 185, 200, 239, 250`).

⚠️ Brittle against custom roles. Internal Audit and Automation have **zero** `useCurrentUser` imports.

### 6.4 The remediation chain is 100% labelled, 0% enforced

Observations → Discussion → Action Plan (Internal Audit). `validateObservationForDiscussion` requires a non-empty Process Owner **string** (`internalAuditObservationsData.ts:71`) — a presence check, not an identity check. The auditor types the management response, uploads the remediation evidence and flips every status. There is no management-side view and no second persona.

Final report `issuedBy: engagement.reviewer || engagement.owner` (`InternalAuditFinalReportTab.tsx:58`) — **the same button, no matter who clicks it.**

`eng_assign` ("Assign owner and reviewer") is defined at `rbac.ts:128` and is **never checked in any engagement file** — its single call site is `audit/EngagementsView.tsx:521`.

---

## 7. Screen-by-screen gating trace

| Screen | Entry route (gate) | What the role changes | Holds? |
|---|---|---|---|
| **Login** | `/` → `App.tsx:1398` | Nothing. Identical for everyone; always signs in as System Admin (`LoginView.tsx:19`) | ❌ None |
| **Route guard** | all views | 46 routes → "Access restricted" lock state (`App.tsx:595-605`) | ✅ **Real** |
| **Sidebar** | always | 15 items gated (`:369-406`); the six non-admin roles all see the same 11. Only Admin & Platform Usage differ | ⚠️ Hides |
| **Home** | `home` (ungated) | Onboarding checklist rows filter (`HomeView.tsx:77`); vanishes at zero. Everything else open | ⚠️ Hides |
| **Ask IRA / Chat** | `chat` (ungated by design) | Add-to-dashboard / add-to-report dim; **handlers genuinely refuse** (`ChatView.tsx:4393, 4399`) | ✅ **Real** |
| **Reports** | `reports` (`rp_view`) | Share ×4, comment, delete-query, export gated. **Row delete + Templates tab ungated** | ⚠️ Partial |
| **Report builder** | `report-builder` (`rp_edit`) | Route block | ✅ Real |
| **Process Hub** | `programs` (`bp_view`) | Upload SOP, archive, create control/workflow, share. **SOP rename + BP delete open to all** (`bp_edit`/`bp_delete` dead) | ⚠️ Hides |
| **Risk Register** | `audit-risk-register` (`risk_view`) | **Only Share.** Create/Edit/Archive/Delete open to every role | ❌ **Barely** |
| **Control Library** | `governance-controls` (`ctrl_view`) | Export, create, and all 4 row icons gated per key | ⚠️ Hides |
| **Workflow Library** | `workflow-library` (`wf_view`); executor (`wf_run`) | Hidden buttons **+ real handler guards + route gate** — best-enforced module | ✅ **Real** |
| **Engagements list** | `engagements` (`eng_view`) | Create, edit, assign, close, delete. `eng_delete` genuinely admin-only | ⚠️ Hides |
| **Engagement workspace** | `engagement-overview` (`eng_view`) | Save/Submit/Sign-off/Issue-report dim; **evidence uploads really blocked** (`EvidenceTab.tsx:563, 608, 717`) | ⚠️ Partial |
| **SOX workspace** | `sox-icfr` (**ungated**) | Platform role seeds the hat once; the hat then drives everything, store-enforced | ✅ **Real** |
| **RACM screens** | `racm-full-editor` (`racm_edit`), `governance-racm-generate` (`racm_generate`) | Generate/edit/link/unmap/archive/share. The two editor routes are real | ⚠️ Partial |
| **Exceptions** | `manage-exceptions` (`exc_view`) | `exc_resolve` **reframes the whole screen** as the risk-owner view (`:314`) | ✅ **Real** |
| **My Queue** | `my-queue` (`eng_view`) | Quick Classify strip + row actions dim | ⚠️ Dims |
| **Dashboards** | `dashboards` (`db_view`) | New, delete, add widget, share — hidden only | ⚠️ Hides |
| **Data Sources** | `data-sources` (`ds_live`) | Rename/remove/upload/connect; **rename + upload really blocked** (`DataSourceDetailView.tsx:204, 225, 311`) | ✅ **Real** |
| **Knowledge Hub / Smart Learn** | `knowledge-hub` (`ds_live`) | Route only — zero internal checks | ⚠️ Route only |
| **AI Concierge** | `ai-concierge` (`concierge_use`) | Route only; **5 of 9 tool routes unmapped** | ⚠️ Route only |
| **Administration** | `admin-users`/`-roles`/`-logs` | Routes gate the entry point; **the tab strip inside does not.** One `can()` in 2,360 lines | ❌ **Crossable** |
| **Platform Usage** | `platform-usage` (`ad_usage`\|`ad_usage_people`) | Team lead: one tab, own team only, no export — **role changes the data** | ✅ **Real** |
| **Share dialog** | any share button | Nothing. Only the opening button is gated | ❌ None |
| **Compliance engagement** | `compliance-engagement` (**ungated**) | Risk owner: drafts **filtered from data**, headings/columns swap. Uses `roleId ===`, not a key | ⚠️ Partial |
| **Execution V2** | `execution-testing`/`-evidence` (`eng_view`) | Submit + Review testing gated on the **same** `eng_edit` key — a preparer can approve their own work | ⚠️ Dims |
| **Command palette (⌘K)** | global | No filter — navigates to gated views and lands on "Access restricted" (`CommandPalette.tsx:73, 80, 87, 94`) | ❌ None |
| **Recents, Chat Trash, One-Click Audit, Notifications, Personal Memory** | ungated | — | ❌ None |

**Only two screens scope data by role:** Platform Usage (team-lead roster filter) and the Compliance requests tab (draft rows hidden from a risk owner). Everywhere else, role decides which buttons appear.

**There is no `<ProtectedRoute>` HOC, no per-tab guard, no route-config wrapper** beyond the single `App.tsx` check. Everything else is inline per-button.

---

## 8. Gap ledger

Ranked by what would hurt most when this model is implemented for real. All independently verified.

### 🔴 S1 — The permission matrix is reachable without the permission to manage it

The route guard validates the view you **arrive** on. `AdminView.tsx:2223-2228` then builds four sections as a tab strip with **no permission filter**, rendered at `:2271`:

```ts
const sections: SectionDef[] = [
  { id: 'members', label: 'Users & Teams',        icon: Users },
  { id: 'roles',   label: 'Roles & Permissions',  icon: Shield },
  { id: 'memory',  label: 'Memory',               icon: Brain },
  { id: 'logs',    label: 'Audit Log',            icon: ScrollText },
];
```

A role holding only `ad_logs` lands on Audit Log via `Sidebar.tsx:175`, clicks across to Roles & Permissions, and can rewrite every role in the system. **The whole 2,360-line file contains exactly one `can()` call** — at `:1981`, guarding the CSV export button.

Also ungated inside: "Invite User" (`:2295`), "Create Team" (`:2296`), `PeopleSection` (`:1035`), `UserManageModal` (`:253`), `TeamsSection` (`:1597`), `MemoryGovernanceSection` (`:2071`).

**This voids the others: whoever reaches this tab can grant themselves anything.**

### 🔴 S2 — Disabled controls are still keyboard-operable

`Gated.tsx:32-40` wraps the child in `<span aria-disabled className="opacity-40 pointer-events-none cursor-not-allowed">`. It **never sets `disabled` on the button**, so the control stays in the tab order and Enter fires the handler. **71 disable-mode call sites** inherit this, including *Submit for review* (`WorkingPaperTab.tsx:204`) and *Sign off* (`:221`).

**Cheapest high-value fix in the study — one component.**

### 🔴 S3 — No way to be anyone but the administrator

`signIn()` called from one place, always with `DEFAULT_USER` (`LoginView.tsx:19`). Six of seven personas unreachable. Every gate untested by use; the Compliance risk-owner view and its maker-checker guard can never be exercised.

### 🔴 S4 — The hat switcher defeats four-eyes

Acting identity derives from the selected persona (`store.tsx:454`), not the session, and the switcher (`parts.tsx:97`) has no restriction. One person can sign as preparer and countersign as reviewer without leaving the page.

### 🔴 S5 — Review notes: complete store API, zero UI

All four transitions implemented, typed, exported (`store.tsx:2637-2667`); **no component calls any of them.** A seeded open note permanently blocks the countersign on `P2P-C-04` with no way to clear it.

### 🟠 S6 — Engagement-level sign-off has no role guard

`store.tsx:2720-2722` checks only `prev.reviewer === prev.preparer`. It never checks the hat. The auditor/reviewer split exists **only** in JSX (`Overview.tsx:463, 474`) — unlike every other signature in the module.

### 🟠 S7 — Thirteen permission keys declared but never enforced

Listed in §2.5. Most damaging: the Risk Register renders create/edit/archive/delete with **no check at all** while four matching keys sit in the catalogue. Administrators toggling them have no way to know they do nothing.

### 🟠 S8 — The risk owner can author the attributes they will be tested on

`addAttribute` (`store.tsx:1669`), `removeAttribute` (`:1676`), `mapStepWorkflow` (`:1680`), `toggleStepAttest` (`:1688`) all guard with `role === 'reviewer'`, which **permits risk-owner**. Live path at `ControlLibraryDetail.tsx:111` → `:222`, `:252`. Contradicts the module's own rule at `ControlDossier.tsx:3913-3915`.

### 🟠 S9 — Opening a control is not access-checked

`openControl` (`store.tsx:511`) and `openDeficiency` (`:1599`) have no role or ownership guard. Only *lists* are filtered. Any deep-link path renders `ControlDossier` for an owner who does not own the control. Per-field redaction still applies, so exposure is bounded — but the person-lane boundary is a list filter, not an access check.

### 🟠 S10 — Fourteen views outside the route guard, two deep-linkable

Listed in §2.6. `?view=control-detail&controlId=X` and `?view=dev-configurable-engagement-v3` open unmapped routes directly (`useAppState.ts:214, 227`).

### 🟡 Additional consistency issues

- **Duplicated gate logic:** `canSign`/`canCounter` written twice (`ControlDossier.tsx:3438-3439` and `WorkingPaperModal.tsx:92-93`), with the second adding `!engLocked` the first omits. Owner-scoping predicate duplicated. Both SOX shells duplicate the persona-tab block three times each.
- **Owner scoping inconsistency** — `isOwnerOf` vs `c.owner ===` (see §4.7).
- **`ownsIt` not applied** to `signOffControlWp`, `returnControl`, `reopenControl` (see §4.5).
- **Execution V2** gates submit *and* review on the same `eng_edit` key.
- **`Gated` count nuance:** 75 wrappers total — 71 disable-mode, 4 hide-mode.

---

## 9. Recommended single model

**The fix is not to replace either system. Both are good.** The fix is to make the engagement hats **derived** rather than **chosen**, and to make identity come from one place.

### First — three repairs that cost almost nothing

These are defects, not design decisions, and should not wait:

1. Give `Gated` a real `disabled` attribute (or `inert`) so dimmed controls stop responding to the keyboard. → closes **S2**
2. Filter the Administration tab strip by the same keys that gate its routes. → closes **S1**
3. Either wire the four `risk_*` keys (the call sites are sitting there) or remove them and the three `mem_*` keys from the matrix. → closes half of **S7**

### One — identity comes from the session, always

Replace the hat-derived `me` (`store.tsx:454`) with the signed-in user. This makes four-eyes real, makes the audit trail truthful, and costs one line. `eng.preparer` / `eng.reviewer` become **expectations to display and reconcile against**, not sources of identity. → closes **S4**

### Two — the hat is derived from role + assignment, not picked

| Platform role | Named on the engagement as | Effective hat | May sign? |
|---|---|---|---|
| Auditor | Preparer | Auditor | Prepare only |
| Reviewer | Reviewer | Reviewer | Countersign, if not the preparer |
| Risk Owner | Owner of this control | Risk Owner | No — evidence lane only |
| Risk Owner | Not named on this control | No access to the control page | No |
| Enabler / Admin | Any | Auditor, with an explicit acting-as banner | Prepare only |
| Viewer | Any | Read only | No |

The switcher becomes a **preview** that changes what is shown, never what may be done. Nothing here needs a new concept — the platform already knows the role, and the engagement already names its preparer, reviewer and control owners. → also closes **S9**

### Three — give the engagement a real team

Two free-text fields cannot carry segregation of duties. Engagements need a member list holding `{ personId, engagementRole }`, replacing both the SOX engagement's name strings and the configurable patterns' text boxes. The unused `EngagementTeam` (`data/engagements.ts:31-36`) is close to the right shape.

### Four — decide what teams are for, then commit

Teams are currently a reporting dimension that **looks like** an access boundary. Either make them one (a team scopes which engagements its members can see) or rename them so nobody expects that. The middle position is the worst of the two: an administrator assigning someone to "SOX Audit" reasonably believes they have granted something.

### Five — move last-mile checks into the writes

The SOX store already proves the pattern: **guard the mutation, not the button.** The ~18 handler guards elsewhere are the only non-route gates that genuinely hold. When this ports to a real backend, that is the line the server should enforce — hidden buttons will not survive the trip.

**Sequencing:** the three cheap repairs plus item one close five of the ten findings and none needs a backend. Items two and three are the design work, and they are what makes segregation of duties defensible to an external auditor rather than merely present on screen.

---

## 10. Appendix

### 10.1 Key file map

| Concern | File |
|---|---|
| Permission catalogue, roles, route map | `src/data/rbac.ts` |
| Identity, `can()`, sign-in, workspace | `src/context/CurrentUserContext.tsx` |
| Users, teams, audit log | `src/context/AdminDataContext.tsx` |
| Share modal opener (no ACL) | `src/context/ShareContext.tsx` |
| Affordance gate component | `src/components/shared/Gated.tsx` |
| Route guard | `src/App.tsx:589-605` |
| Nav gating | `src/components/sidebar/Sidebar.tsx:167-406` |
| Login | `src/components/auth/LoginView.tsx` |
| Admin shell + audit log | `src/components/admin/AdminView.tsx` |
| Roles matrix editor | `src/components/admin/RolesWorkspace.tsx` |
| Team-scoped usage | `src/components/usage/PlatformUsageView.tsx:757-800` |
| SOX persona type | `src/components/sox-icfr/types.ts:10` |
| SOX enforcement (108 guards) | `src/components/sox-icfr/store.tsx` |
| SOX hat switcher | `src/components/sox-icfr/parts.tsx:97-176` |
| SOX ↔ platform bridge | `src/components/sox-icfr/SoxIcfrApp.tsx:366-372` |
| SOX control page | `src/components/sox-icfr/ControlDossier.tsx` |
| Court / baton / scoping helpers | `src/components/sox-icfr/helpers.ts` |
| Exceptions persona | `src/components/exceptions/workflow/workflowTypes.ts:6` |
| Exceptions engine | `src/components/exceptions/workflow/workflowEngine.ts` |
| Configurable engagement types | `src/components/engagement-configurable/configurableEngagementTypes.ts:183-205` |

### 10.2 Verified counts

| Metric | Value |
|---|---|
| Permission keys | **73** (union and catalogue agree) |
| Modules | 14 |
| Seeded roles | 7 |
| Views total / route-gated / ungated | **60 / 46 / 14** |
| Gate sites total | **183** (107 imperative + 75 `<Gated>` + 1 route guard) |
| `<Gated>` disable-mode / hide-mode | 71 / 4 |
| Handler guards (`if (!can(`) | 18 |
| Keys live / route-only / dead | **58 / 2 / 13** |
| Role guards in the SOX store | **108** (75 auditor-only, 16 reviewer-blocked) |
| `can()` calls in `AdminView.tsx` (2,360 lines) | **1** |
| `useCan` calls in `src/components/sox-icfr/` (42 files) | **0** |
| Files importing `useAuditLog` | 102 |

### 10.3 Commands to re-verify

```bash
# Permission key count (union vs catalogue)
node -e "const s=require('fs').readFileSync('src/data/rbac.ts','utf8');
  const u=s.split('export type PermissionKey =')[1].split(';')[0];
  console.log('union:',[...u.matchAll(/'([a-z_]+)'/g)].length,
              'catalogue:',[...s.matchAll(/\{ key: '([a-z_]+)'/g)].length);"

# Dead keys — any key with zero component call sites
for k in bp_edit bp_delete eng_share racm_link_control racm_link_workflow racm_unmap \
         risk_create risk_edit risk_archive risk_delete mem_view mem_approve mem_admin; do
  echo "$k -> $(grep -rl "'$k'" src --include='*.ts' --include='*.tsx' | grep -v 'data/rbac.ts' | wc -l)"
done

# Ungated views
node -e "const fs=require('fs');
  const views=[...fs.readFileSync('src/hooks/useAppState.ts','utf8').split('export type View')[1].split(';')[0].matchAll(/'([a-z0-9-]+)'/g)].map(m=>m[1]);
  const gated=[...fs.readFileSync('src/data/rbac.ts','utf8').split('VIEW_PERMISSIONS')[1].matchAll(/'([a-z0-9-]+)':/g)].map(m=>m[1]);
  console.log(views.filter(v=>!gated.includes(v)).join(', '));"

# SOX store role guards
grep -c "role ===\|role !==" src/components/sox-icfr/store.tsx

# Gate site tiers
grep -rho "<Gated" src --include='*.tsx' | wc -l
grep -rho '<Gated[^>]*mode="disable"' src --include='*.tsx' | wc -l
grep -rho "if (!can(" src --include='*.tsx' | wc -l

# Confirm review-note API is dead
grep -rn "raiseReviewNote\|resolveReviewNote\|verifyReviewNote\|reopenReviewNote" \
  src --include='*.tsx' --include='*.ts' | grep -v 'sox-icfr/store.tsx'

# Confirm no persona switcher
grep -rn "signIn" src --include='*.tsx'
```

### 10.4 Scope caveats

- **No backend.** Everything is a render-time or reducer-time branch. Nothing here constitutes server-side authorization, and none of these gates would survive a direct API call in a real deployment.
- **Role permission edits are not persisted** — only `auth.currentUserId` and `auth.activeWorkspaceId` reach localStorage. Matrix edits reset on reload.
- **SOX work scope** is currently limited to `FY26 ICFR — Altura Infra Group (SOX-104)` per the project's own convention; other seeds may not reflect the latest behaviour.
- `tests/_sox-review-notes.spec.ts` tests a removed surface and will fail — see **S5**.
