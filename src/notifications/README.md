# Notifications — in-app + email, driven by the notification map

Everything a delivery needs is declared once in **`catalogue.ts`** (one entry per
Real-time row of the notification map: module, channel, recipients, watchers,
cadence, content tokens, de-duplication rule, configurability, priority,
overrides-quiet-hours). The service, the centre, the email renderer and the
preferences screen all read from it, so a rule change is a data change.

| File | Role |
|---|---|
| `catalogue.ts` | The 56 Real-time events across five modules — Exceptions Management (which includes the Action Hub `ACT-*` and Approval chains `APR-*` events as sub-areas), ATR & Reports, Engagements, Workflows & Data, Dashboards. |
| `types.ts` | `AppNotification` (extends the platform's `PlatformNotification`), `EmailMessage`, `NotificationPreferences`, `NotifyInput`. |
| `service.ts` | Pure rules engine: `decide(input, ctx)` applies preferences → channels, quiet hours (IST, held until the window ends unless the event overrides), and the event's de-dup rule (`collapse-by-operation`, `window`, `batch`, `cap-then-rollup`, `suppress-repeat`) against the existing store; `composeEmail` builds the email. |
| `NotificationContext.tsx` | `NotificationProvider` (mounted above `AppGate` in `App.tsx`) — the store (`irame.notifications.v2`: notifications, emails, prefs), cross-tab sync via `storage`, quiet-hours release tick, P0 toasts, and `useNotify()` for trigger sites. |
| `NotificationCenter.tsx` · `NotificationCard.tsx` | The bell drawer: Inbox · Action · All · Emails, module filter, "Held for quiet hours" section with *Release now*, day groups; cards show priority, module, event id, To/CC, facts, verbatim decision comments, folded items (×N), Approve / Reject / Comment, Open (deep link) and View email. |
| `NotificationEmailModal.tsx` | The email as sent: envelope (From/To/CC/Subject), brand header, event + priority badges, lead, quote, facts table, folded items, one CTA, "why you received this". |
| `NotificationPreferencesModal.tsx` | Quiet hours (IST); **One comment email per hour** (EXC-15 emails wait for the next batch time — every 1 · 2 · 3 · 4 · 6 · 8 · 12 · 24 hours on the clock, the user picks — and roll up into one; in-app stays instant; @mentions never batch); per module → per event: **In-app is always on (locked)**, **Email is the user's toggle** (the map's channel is only the starting default), *Why this channel & who gets it*, and **Preview** (runs the sample through the real rules → row + email). P0 toasts still fire (no user toggle). |
| `samples.ts` · `seeds.ts` | One realistic sample per event (Preview) and the first-run inbox built from them through `decide`. |
| `triggers/caseTriggers.ts` | Case management → EXC-03/04/05/06/07/09/15, ACT-01/05/06/07/08/09/11/12 from a before→after diff of each case (+ `ROSTER` of standing roles). |
| `triggers/approvalTriggers.ts` | Approval chain → APR-01/02/03/04/05/07 from a before→after diff of each `Assignment`. |

## Live trigger sites
- `exceptions/ManageExceptionsView.tsx` — committed-diff effect → `caseNotifications`; `postComment` → EXC-15 (with `@First Last` mention detection); linked ATR → ATR-07.
- `exceptions/workflow/WorkflowContext.tsx` — committed-diff effect → `approvalNotifications`.
- `reports/ReportsView.tsx` — ATR-02 + ATR-03 on Generate ATR, ATR-04 on visibility, ATR-01 on Save Version.
- `App.tsx` — ATR-05 / DSH-01 on share, WFL-01 on run complete.
- `audit/EngagementsView.tsx` — ENG-01/02 on create, ENG-03 on owner change, ENG-04/05 on close.
- `shared/BulkRunProgress.tsx` — WFL-07 on completion, WFL-02 per errored workflow.
- `data-sources/DataSourcesView.tsx` — DSH-03 on remove.

Events with no user-driven flow in the prototype yet (EXC-02, APR-08–11, ATR-08–11, ENG-10, WFL-06/08/09/10/12) are fully specified and demonstrable via **Preview**.
