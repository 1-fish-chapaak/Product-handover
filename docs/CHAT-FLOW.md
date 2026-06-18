# Chat — Complete Flow & Component Map

> A click-by-click reference for the entire Chat feature ("Ira" / "IRA"): every screen,
> side sheet, button, action, component, and state. Built from a full read of
> `src/components/chat/` (~11,300 lines across 13 files) plus the cross-module wiring.
>
> Line numbers are navigation aids against the current `main` (post-pull, branch
> `polish/chat-update-uiux-v1`). `ChatView.tsx` is 7,300 lines, so treat its line refs
> as "search-near-here," not exact-forever.
>
> **Tailwind v4 note:** custom radius scale lives in `src/index.css`
> (`--radius-xs:4px, --radius-sm:6px, --radius-md:8px, --radius-lg:12px, --radius-xl:16px`),
> so `rounded-md`=8px and `rounded-lg`=12px here. Trailing `!` = important.

---

## 0. TL;DR — the things that aren't obvious

1. **Dead code (3 files):** `AssumptionsPanel.tsx`, `ProgressiveLoader.tsx`, `LiquidFillGraphic.tsx` are imported **nowhere**. The live audit-query loader is the in-file `InlineAuditLoader` (`ChatView.tsx:1515`), not `ProgressiveLoader`.
2. **No "assumptions" stage exists.** The shipped query lifecycle is **clarify → load → answer**. A stale comment (`ChatView.tsx:4351`) still claims an assumptions step.
3. **Two clarification UIs.** Query uses the local `ClarificationBlock` (`ChatView.tsx:1181`, docked above the composer, sans-serif, auto-advance). Only the *workflow* build uses the imported `ClarificationCard.tsx` (serif title, paginated Back/Next).
4. **`ChatView.tsx` has two top-level render branches:** the empty/hero state (`if (isEmpty)` → early `return`, ~`:5093`) and the active thread (main `return`, ~`:5488`). `isEmpty = messages.length === 0` (`:4871`).
5. **Mode toggle behaves differently per branch.** Hero composer = a real 2-segment `role="radiogroup"` toggle (Query/Workflow). In-thread composer = a **locked, read-only** `role="switch"` (`modeLocked=true` hardcoded, `onClick` no-op). You cannot change mode once a thread starts.
6. **`compose=workflow` is read inside ChatView**, not the router. `getInitialView()` only maps `view=chat`; the `compose` param is consumed in ChatView's `useState` initializer (`:2926-2929`) and never stripped from the URL.
7. **`resultData` is always the constant `AUDIT_RESULT`** (`ChatView.tsx:130-249`) — Add-to-Dashboard/Report and Save-as-Workflow always preview the same duplicate-invoice fixture regardless of the clicked message. Chart previews in those modals are decorative (only `confidence`/`vendor` are mapped; the rest fall back to a generic bar and ignore real data).
8. **Persistence is thin/mock.** New dashboards persist coarse widget stubs; **new reports don't persist at all** ("hackathon scope", `App.tsx:529`), and `onViewReport` ignores the id and just opens the Reports list.

---

## 1. Architecture & file map

| File | Lines | Role | Status |
|---|---|---|---|
| `ChatView.tsx` | 7,300 | The whole surface: hero + thread + composer, query & workflow orchestration, inline cards, result rendering, most modals mounted here | **live** |
| `DataPickerModal.tsx` | 1,192 | "Add data" modal — pick existing sources + upload files | **live** |
| `AddToDashboardModal.tsx` | 721 | 2-step: pick dashboard → choose KPIs/charts/columns | **live** |
| `AddToReportModal.tsx` | 676 | Near-clone of the dashboard modal, violet-themed | **live** |
| `ModalPrimitives.tsx` | 228 | `ModalShell`, empty/error/success/skeleton/spinner/offline parts | **live** (SuccessPanel unused) |
| `ClarificationCard.tsx` | 218 | Paginated clarify card | **live — workflow build only** |
| `useModalA11y.ts` | 211 | `useDialogA11y` focus-trap/scroll-lock + list-nav/online/collapse/timeout helpers | **live** |
| `LiquidFillGraphic.tsx` | 200 | Beaker fill animation | **DEAD (0 imports)** |
| `ProgressiveLoader.tsx` | 195 | Multi-card step loader | **DEAD (0 imports)** |
| `WidgetPickerParts.tsx` | 186 | `SectionHeader`, `Checkbox`, KPI/Chart/Table preview rows | **live** (shared by both AddTo modals) |
| `AssumptionsPanel.tsx` | 98 | "IRA will assume…" confirm panel | **DEAD (0 imports)** |
| `ChatWorkflowWorkspace.tsx` | 44 | Right-hand artifact panel for workflow mode (wraps `DataSourcePanel`) | **live** |
| `widgetPickerHelpers.ts` | 15 | `toggleIn`, `setAll` | **live** |

**Key in-file components inside `ChatView.tsx`:** `InlineAuditLoader` (`:1515`), `ClarificationBlock` (`:1181`), `ThinkingTrail` (`:1152`), `InlineEditBubble` (`:2302`), `ResultsTable` (`:690`), `ChartGroup` (`:458`), `FullscreenChartModal` (`:598`) / `FullscreenTableModal` (`:994`), `ExportReportButton` (`:2400`), `WorkflowOutputPreviewCard` (`:1443`), `SaveWorkflowButton` (`:1595`), `SaveAsWorkflowModal` (`:1655`).

**External (workflow building blocks reused inline):** `src/components/concierge-workflow-builder/*` — `StepUploadFiles`, `StepReviewRun`, `StepOutputView`, `UploadDataModal`, `SaveWorkflowModal`, `AIAssistantPanel` (exports `ToleranceAdjustCard`, `ViewPreviewCard`), `mockApi.ts`, `types.ts`, `DataSourcePanel.tsx`.

**Mounting & routing (no React Router — a `view` string in `useAppState`):**
- `<ChatView>` rendered in `App.tsx` at `:455` (primary `case 'chat'`, full props) and `:962` (fallback `default:` case, 5 props — so chat is the catch-all surface).
- `ChatViewProps` interface: `ChatView.tsx:260-342`; destructure at `:2849`.
- `getInitialView()` (`useAppState.ts:195-210`) maps `view=chat` on first load only. In-app `setView('chat')` never updates the address bar.

### The mode system (Query vs Workflow)
- **App-level intent:** `state.chatMode: 'chat'|'workflow'` + `artifactMode: 'query'|'workflow'` + `showArtifacts` (`useAppState.ts`).
- **Per-thread truth:** ChatView's local `buildWorkflowMode` (`:2926`):
  ```ts
  const [buildWorkflowMode, setBuildWorkflowMode] = useState(
    !!workflowEngagementContext ||
    (typeof window !== 'undefined' &&
     new URLSearchParams(window.location.search).get('compose') === 'workflow')
  );
  ```
  Re-forced true by an effect whenever `workflowEngagementContext` is present (`:2932-2934`).

---

## 2. Entry points into chat (who opens it, in which mode)

| # | Source | Code | Lands in |
|---|---|---|---|
| 1 | Sidebar "Ask IRA" | `Sidebar.tsx:346` `setView('chat')` | Query |
| 2 | Home hero prompt chips | `HomeView.tsx:4480` `setChatInitialQuery + setView` | Query (auto-runs `initialQuery`) |
| 3 | Home "Pick up where you left off" | `HomeView.tsx:1770-1798` | Query |
| 4 | Recents view (chat rows) | `RecentsView.tsx:397/475/506` → `openChat` (`useAppState.ts:414`) | Query, loads conversation |
| 5 | Dashboards list "Open chat" | `App.tsx:729` (+ `setPendingDashboard`) | Query + pending-dashboard banner |
| 6 | Reports "Open query" | `App.tsx:770` | Query |
| 7 | Workflow Executor follow-up | `App.tsx:631` → `openChatWithWorkflowRun` (`useAppState.ts:399`) | Query, thread pre-seeded with the run |
| 8 | "Build new" / "Create workflow" (templates/library) | `App.tsx:568/607/686` → `enterWorkflowMode()` (`useAppState.ts:439`) | **Workflow** (inline) |
| 9 | "Edit in chat" (existing workflow) | `App.tsx:598` → `enterWorkflowMode({workflowId})` | `workflow-edit-in-chat` journey (NOT ChatView) |
| 10 | Engagement "Create workflow for engagement" | `App.tsx:828` → `startWorkflowForEngagement` (`useAppState.ts:451`) | **Workflow** + engagement banner |
| 11 | RACM "Create Workflow" (Link-Workflow drawer) | `RacmMappingWorkspace.tsx:1956` `window.open('?view=chat&compose=workflow','_blank','noopener,noreferrer')` | **Workflow** (new tab) — only user of `compose` |
| 12 | Process Hub "Create workflow" | `BusinessProcesses.tsx:2863` `window.open('?view=chat','_blank')` | **Query** (new tab) — ⚠ inconsistent with #11 |
| 13 | AI Concierge "Workflow Builder" card | `App.tsx:926` → `launchWorkflowBuilderWithPrompt('')` | `ai-concierge-workflow-builder` journey (NOT ChatView) |
| 14 | ChatView empty-state `onLaunchWorkflowBuilder` | `App.tsx:442/491` | ⚠ docstring says "embedded"; actually routes to the separate `WorkflowBuilderJourney` (`useAppState.ts:531`, `App.tsx:928`) |

---

## 3. Flow A — Chat entry & hero composer (empty state)

**Renders when `messages.length === 0`** — the `if (isEmpty)` branch, `ChatView.tsx:5093-5485`. Centered hero (`AuditifyHelloEffect` animated mark + headline with `TextShimmer` on "Not harder." + subtitle) over a `FloatingLines` canvas (brand `#6a12cd`, opacity 0.06) and a `chat-canvas-mesh` background.

### Click-by-click
- **Query first message (default):** type → send button appears once `input.trim() || files || attachedSources` → Enter / click ↑ → `handleSend` (`:4361`) pushes the user message, clears the composer, calls `simulateResponse(text,'query')` (forces query so keywords can't spin off a workflow) → `messages.length` flips to 1 → falls through to the thread render.
- **Workflow first message:** click the **Workflow** segment (`:5377`) → placeholder pool + starter chips swap → type + send → `handleSend` workflow branch (`:4376`) → `startWorkflowBuild` (see Flow D).
- **Suggested-prompt chip:** fill-only, **no auto-send** (`:5454`) — sets `input`, focuses, grows. Mode-aware: Workflow = `WORKFLOWS.slice(0,5)` names; Query = `CHAT_HISTORY` titles padded with a hardcoded `queryFallback` list.
- **Attach data:** left **+** (`:5328`) → `DataPickerModal` (see Flow E).

### Interactive elements (hero)
| Element | Loc | Action |
|---|---|---|
| Chat-history toggle (`PanelLeftOpen`) | `:5103` | `toggleChatHistory` (⌘.) |
| New chat (`Plus`) | `:5106` | `requestNewChat` (⌘⇧O) |
| Pending-dashboard banner: Add to Dashboard / Dismiss | `:5124/:5135` | `onAddToDashboard(mockFields)` (Gated `db_add`) / `onDismissPendingDashboard` |
| Textarea (aria "Message IRA") | `:5296` | `setInput`+`handleTextareaInput` autogrow (min-h 88, max-h 260); `handleKeyDown`; `onPaste`; `autoFocus` |
| Attach **+** (`rounded-full size-8`) | `:5328` | `setShowDataPicker(true)` |
| Query radio | `:5359` | `setBuildWorkflowMode(false)` |
| Workflow radio | `:5373` | `setBuildWorkflowMode(true)` |
| Mode highlight (decorative) | `:5349` | spring `x: 0↔88` |
| Send (`ArrowUp`, `bg-primary`) | `:5390` | `handleSend`; only when there's content |
| Attachment chips (source/file) + X | `:5250/:5268` | remove from `attachedSources`/`files` |

**State:** `input` (`:2872`), `files` (`:2875`), `attachedSources` (`:3050`), `showDataPicker` (`:3049`), typewriter placeholder state machine (`:2958-3029`; type 38–65ms/char, hold 1.6s, erase 18ms/char), `journeySeed` (`:2857`, from `workflowBuilderSeedPrompt`). No char limit on the textarea; `MAX_FILES=8` (`:4492`); large pastes (≥2500 chars) auto-attach as `Pasted-N.txt` (`:4517-4543`).

---

## 4. Flow B — Conversation thread & message anatomy

**Main return, `ChatView.tsx:5488`.** Scroll container `role="log" aria-live="polite"` (`:5638`); inner column `max-w-[52.5rem] … space-y-10` (40px between messages); message map at `:5642`.

### Click-by-click
- **Send:** `handleSend` (query branch `:4427`) pushes user msg → `simulateResponse` → `setIsTyping(true)` → thinking dots (`:6532`) → clarification message → loader → result (see Flow C). Message enters with `opacity:0 y:12 → 0`, 0.25s.
- **Hover an assistant turn:** action row fades in (latest assistant turn is always visible).
- **Edit a user message:** pencil → `InlineEditBubble` (`:2302`) → Save branches the thread (`branches[]`); `‹ n/total ›` arrows switch branch + downstream.
- **Stop:** while `isTyping`, Send → **Stop** (`Square`, `:6813`); Esc also stops.

### Interactive elements
**Assistant hover bar (`:6322-6407`):** Copy (`:6339`, flips ✓ 1.5s) · 👍 (`:6354`) · 👎 (`:6374`, opens feedback modal w/ reason) · Retry (`:6394`, `retryFromMessage`, disabled while typing). Each `size-7 rounded-lg`, hand-rolled dark tooltip.
**User message hover row (`:6195-6288`):** branch ‹/› · Edit (`:6232`) · Bookmark (`:6247`, localStorage, persists when starred) · Copy (`:6266`) · timestamp (hover only).
**In-thread composer (`:6669-6836`):** Attach **+** (`rounded-lg size-8`, `:6770`) · **locked** mode pill (`role=switch`, `aria-disabled`, no-op `:6800`, `modeLocked=true` hardcoded `:6786`) · Stop (`:6816`) · Send (`:6826`) · textarea (placeholder "Reply to Ira…" / "Describe the workflow…") · attachment chips.
**Follow-up chips ("What next?", `:6441`):** `handleFollowUpClick` pushes as a new turn; **deliberately heavy** entrance cascade (`delay 0.4 + i*0.13`, ~1s+ for 6 chips, NOT reduced-motion-gated, `:6453`).
**Scroll-to-bottom pill (`:6557`):** appears when `showScrollToBottom`.

### Modals reachable from the thread
DataPicker (`:7228`), Feedback (`:6935`), SaveAsWorkflow (`:6915`), AddToDashboard (`:7272`), AddToReport (`:7286`), new-chat confirm (`:7093`), keyboard-shortcuts (`:7165`), FullscreenChart/Table (`:586/:977`).

**Notable:** assistant text is **not** token-streamed — the full markdown body is swapped in at once on loader complete (`:3630`). Auto-scroll uses a scroll-intent model (`handleScroll` `:3080`) + a `ResizeObserver` (`:3144`) + multi-shot smooth-snap bursts (`:3183`, `:3662`).

---

## 5. Flow C — Query result lifecycle

**Shipped order: clarify → load → answer → action bar.** (No assumptions stage. `AssumptionsPanel`/`ProgressiveLoader`/`LiquidFillGraphic` are dead.)

1. **Kickoff:** `handleSend` → `simulateResponse(text,'query')` → `startQueryClarificationFlow` (`:3590`). ~600ms thinking, then a `richType:'clarification'` message; the card **docks above the composer** via `ClarificationBlock` (`:6600`), intro renders inline.
2. **Answer:** click numbered option / press 1–9 / ↑↓+Enter / type in card / type in main composer (routed to first unanswered, `:4415`) / Skip (Esc). Auto-advances; on the last question `onSubmit` fires after 80ms.
3. **Submit:** `submitClarification` (`:3484`) freezes the card ("Got it. Running with these inputs."), posts a consolidated `Q:/A:` transcript user message, then `startAuditQueryRun` (`:3434`) after 240ms.
4. **Load:** posts `richType:'audit-loading'`, sets `showProgressiveLoader=true`, opens the Workspace panel. `InlineAuditLoader` (`:5698`) = one `TextShimmer` line + pinging brand dot, cycling `LOADING_STEPS` every 1700ms, syncing the Workspace tab.
5. **Answer:** `handleProgressiveLoadingComplete` (`:3623`) mutates the **same message** in place → `richType:'audit-result'`, fills markdown `text`, `richData=AUDIT_RESULT`, `followUps=AUDIT_FOLLOWUPS`; 6-shot snap-to-bottom burst.
6. **Render (`:5705-5879`):** markdown body → "Plan/query/sources in the Workspace" link → KPI grid → `ChartGroup` → `ResultsTable` → **action bar**.

### Result action bar (`:5752-5878`)
| Button | Loc | Action |
|---|---|---|
| **Export** (`Download`+chevron) | `ExportReportButton` `:2400` | menu → PDF (print iframe, `:2465`) / Excel (lazy SheetJS, `:2719`) |
| **Add to dashboard** (`BarChart3`) | `:5769` | not-linked → `handleAuditAction('dashboard',id)` → modal; linked → dropdown (View/Remove + "Add to another"). Gated `db_add` |
| **Add to report** (`FileText`) | `:5823` | symmetric → `handleAuditAction('report',id)`. Gated `rp_edit` |
| **Save as workflow** (primary, `Workflow`, `ml-auto`) | `:5869` | `openSaveAsWorkflowModal` → posts a **5-question save clarification**, then opens `SaveAsWorkflowModal` (indirection — no immediate modal) |

**Inside the result cards:** `ResultsTable` — Open (new-tab HTML, `:709`), Download (CSV/Excel), Expand (`FullscreenTableModal`), "View all" (preview clipped at 9 rows). `ChartGroup` — segmented tabs ≤4 charts else dropdown (fixture ships 7, so dropdown), Expand (`FullscreenChartModal`).

**Edge bugs:** (a) **Stop button is hidden during the loader** — it's gated on `isTyping`, which is `false` while `showProgressiveLoader` is true; only Esc/global shortcut stop it. (b) No zero-result/empty state. (c) `renderChart` axis labels (e.g. "Quarter"/"Department") don't match the fixture's bucket categories.

---

## 6. Flow D — Workflow mode & builder

Three distinct paths live in `ChatView.tsx`:

### D1 — Converged in-thread build (primary)
`handleSend` (workflow branch `:4376`) → `startWorkflowBuild(prompt, attachments)` (`:4113`):
1. **Generate draft** via `wfGenerate(prompt)` → `WorkflowDraft`; seed attachments into required inputs; post intro + **Upload card** (`wfPushCard('workflow-upload')`, `:4155`); auto-open `UploadDataModal` after 400ms if nothing pre-attached.
2. **Upload step** — inline `StepUploadFiles` (list-only). Attach a source/file to each required input; close-with-missing nudges (`:4238`).
3. **Verify → Clarify** — once one required input is filled, `wfHasPushedClarifyRef` effect (`:4179`) posts "Verifying your data sources…" thinking trail, opens Workspace, after 2400ms swaps to "Files verified…" and pushes the **initial clarify card** (docked, `ClarificationBlock` `:6609`).
4. **Clarify → Map** — when answered, `wfHasPushedMapRef` (`:4259`) pushes the **Map card** = `WorkflowOutputPreviewCard` (`:1443`) with **View Workspace** + **Approve & Run**.
5. **Approve & Run** (`:6009`) → "Running…" trail → after 2200ms swaps to an **`audit-result`** (KPI/chart/table). *Skips* validate/tolerance.
6. **Alternate validate path:** a `workflow-review` card (`StepReviewRun`) → **Validate workflow** (`:6056`) → validate clarify → `ToleranceAdjustCard` (`:6090`) → auto-run → **`workflow-view-preview`** → **View Preview** → **`workflow-output`** (`StepOutputView`) → **Save Workflow** → `SaveWorkflowModal` (`:7258`). Save posts a confirmation; **no navigation**.

### D2 — Legacy conversational build
`startConversationalWorkflowFlow` (`:3673`), phase machine `workflowBuildPhase` 0→7, uses the imported `ClarificationCard`, a "type 'go'" gate (`openCanvasAfterConfirmation` `:3700`), 8s/20s freeze tips, and a `save-workflow-prompt` card with `SaveWorkflowButton`. Reached mainly via keyword auto-detect / `initialQuery`.

### D3 — Save a query result as a workflow (mode conversion)
"Save as workflow" → `SaveAsWorkflowModal` (2-step) → `handleSaveAsWorkflowConfirm` (`:3960`) sets `lockedAsWorkflow=true`, flips to workflow mode (App's 0.7s Y-spin), shows a dismissible "Workflow mode — switched at save" banner.

### Workflow-mode interactive elements (selected)
- **Engagement banner** (`:5199` hero / `:6633` docked): "Adding workflow for engagement — **<name>**".
- **`StepUploadFiles`** (concierge): Open upload window, drop zone, source search+list, per-file X, "Add more", "View Workspace".
- **`WorkflowOutputPreviewCard`** (`:1443`): View Workspace (`:1490`), Approve & Run (`:1498`).
- **`ToleranceAdjustCard`** (`AIAssistantPanel.tsx`): enable switch, %/absolute tabs, 0–20 slider, $ input + presets, Run (gradient), Reset.
- **`ViewPreviewCard`**: View Preview (gradient, disables after reveal).
- **`StepOutputView`**: Save Workflow (→ disabled "Workflow saved").

**Right-hand `ChatWorkflowWorkspace`** (`App.tsx:362`, mode-flip 0.7s Y-spin) wraps `DataSourcePanel` at `step=3` — but it **regenerates its own preview** from `workflowType`, *not* the live `wfWorkflow`, so "View Workspace" can show content that doesn't match the inline draft.

**State:** `wfWorkflow`/`wfFiles`/`wfMappings`/`wfAlignments`/`wfRunning`/`wfResult`/`wfSaved`/`wfTolerance` (`:2895-2911`); message-carried `richType` cards (`'workflow-upload'|'-map'|'-review'|'-tolerance'|'-view-preview'|'-output'|'-clarify'`). Sending a new workflow prompt resets all `wf*` state first (`:4394`) so it never silently downgrades to the query path.

**Notes:** `StepMapData` is imported (`:47`) but unused (Map uses `WorkflowOutputPreviewCard`). Two redundant save UIs (`SaveWorkflowButton` fake-save vs real `SaveWorkflowModal`). Concierge cards use off-palette `from-brand-600 to-fuchsia-600` gradients + inline hex.

---

## 7. Side sheet — Data Picker (`DataPickerModal.tsx`)

A centered modal (not a side sheet). In chat it always opens `mode='chat'`, `defaultTab='upload'`, title "Add data", confirm "Attach". **Two triggers, one handler:** hero **+** (`:5328`, modal `:5478`) and in-thread **+** (`:6768`, modal `:7228`); both → `setShowDataPicker(true)` → `handleDataPickerConfirm` (`:4837`). Open-state always resets (`DataPickerModal.tsx:102`); never pre-selects already-attached sources.

**Tabs (chat):** Upload / All Data / Files / DB. Search disabled on the Upload tab.

### Flows
- **Attach sources:** click rows → toggles in one shared `selectedSourceIds` Set (persists across tabs) → footer "N selected", **Attach N** → `handleConfirm` builds `AttachmentSelection[]` → chat splits into `attachedSources` (chips) + stub `files`.
- **Upload files:** drag/drop (recursive folder walk `:580-633`) or Choose files/folder → `addFiles` dedupes by `path:size`, validates (`validateUploadFile`), simulates ~1.5s progress → `PendingFileRow` (failed rows float to top) → Attach (blocked if errors; confirm if uploads in flight).

**Interactive elements:** Title, Search (disabled on Upload), Close ✕ (guarded), tab buttons (shared `layoutId` underline), `SourceRow` (whole-row toggle: checkbox + brand tile + name + type pill), DB-tab "Request a DB integration" mailto, Upload drop zone (collapses when >4 files), Choose files/folder, per-file X, footer Cancel + **Attach N** (disabled at 0 / while submitting / if `errorCount>0`).

**Nested confirms:** `ConfirmDiscard` (closing with unsaved uploads) and `ConfirmAttach` (attaching with in-flight uploads). `ConnectDbPanel` (`:929`) is **kh-add only**, unreachable from chat.

**Chat throws away data:** uploads become empty stub `File`s (`new File([''], name)`, `:4853`) — real bytes discarded; rich source `subtype`/date collapse to a 4-letter chip tag.

**Polish flags:** hero **+** `rounded-full` vs in-thread `rounded-lg`; the SourceList subtree uses an older token family (`bg-surface-2`/`text-text-muted`) vs the rest (`ink`/`paper`/`brand`); no select-all / grouping / folder expand; no focus-trap/Escape/scroll-lock from the shared hook (see §10); `SEED` is empty in production so All/Files tabs would be blank with no CTA.

---

## 8. Side sheet — Add to Dashboard (`AddToDashboardModal.tsx`)

A **2-step** modal (`pick` → `widgets`), brand-themed. It is a **granular item picker**, not a widget-type grid.

- **Trigger:** action-bar "Add to dashboard" (`ChatView.tsx:5760`) → `handleAuditAction('dashboard',msgId)` (`:3756`) → mount (`:7271`). Payload `resultData` = constant `AUDIT_RESULT`; `alreadyAddedIds` is message-specific.
- **Step 1 (pick):** Existing (search + "My"/"Shared" groups, single-select rows) or New (Name req. ≤80 + duplicate/reserved validation, Description ≤240). **Next** enabled when valid.
- **Step 2 (widgets):** everything pre-selected. Select all / Clear; three collapsible sections — KPI Cards (per-item), Charts (per-item, live mini `ConfigurableChart`), Results Table (all-or-nothing). **Add to Dashboard** (Gated `db_add`).
- **Outcome:** message tagged `addedTo.dashboards`; `onAddResultToDashboard` (`App.tsx:500`) creates the dashboard if new + appends coarse widget stubs (KPIs→1 stub, each chart→1 `bar` stub titled by raw id, columns→1 `table` stub); success toast w/ View Dashboard (no Undo).

**Polish flags:** chart previews are fake (only `confidence`/`vendor` mapped, real `data` ignored); per-KPI/column granularity is flattened on persist; instant close (no success beat though `SuccessPanel` exists); `loading`/`loadError` branches are dead; three different "selected" visual treatments in step 2; no step-transition animation.

---

## 9. Side sheet — Add to Report (`AddToReportModal.tsx`)

Near-clone of the dashboard modal, **violet** (`ACCENT='violet'`). 2-step (`pick` → `sections`).

- **Trigger:** action-bar "Add to report" (`:5814`) → `handleAuditAction('report',msgId)` → mount (`:7286`). `reports` = `GENERATED_REPORTS` (draft/final). `final` reports are locked (not selectable); already-added rows disabled.
- **Step 2 is item-selection only** — there is **no section/placement/format/preview model** despite "Choose What to Include". Table row is all-or-nothing.
- **Outcome:** message tagged `addedTo.reports`; toast w/ View Report + **Undo**. **New reports do not persist** (`App.tsx:529` "skipped for hackathon scope"); `onViewReport` ignores the id → opens Reports list → dead-end for a just-created report.

**Polish flags (report-specific):**
- **Focus-ring color bug:** `WidgetPickerParts` `SectionHeader`/`Checkbox` default `accent='brand'`, so in the violet report modal **section headers/rows focus-ring blue while everything else rings violet**.
- `ChartPreviewRow` hardcodes `#3d68ee` (blue) — clashes with violet.
- `violet` is a raw Tailwind palette, not a semantic GRC token (confirm accepted deviation).
- Pre-selects everything → blunt "dump all 8 KPIs + 7 charts + table" default.

---

## 10. Shared modal infrastructure & accessibility

### `ModalPrimitives.tsx`
- **`ModalShell`** (`:32`): overlay (`bg-black/40 backdrop-blur-sm`, click=close) + `motion.div` dialog (`role=dialog aria-modal`, enter `scale 0.96→1 y 8→0` 0.2s). `width='min(${w}px, calc(100vw - 24px))'`. **Panel is `rounded-2xl` (16px) — off the project token scale** (should be `rounded-xl`). Does NOT call the a11y hook itself; consumer passes `dialogRef`.
- `ModalEmptyState` (`:72`), `ModalErrorBanner` (`:115`, hardcodes "Couldn't load"), `ModalRowSkeleton` (`:142`, **no `motion-reduce` on the pulse**), `ModalSubmitError` (`:160`), `ButtonSpinner` (`:171`), `OfflineBanner` (`:177`, hardcoded copy), `SuccessPanel` (`:188`, **defined but unused** anywhere; specs drift from `ModalEmptyState`).
- Accent maps `ACCENT_BTN`/`ACCENT_LINK` (`:20-28`) cover `brand` + `violet`.

### `useModalA11y.ts`
- **`useDialogA11y(open, onClose, {initialFocusRef, onReturn})`** (`:15`): saves/restores focus, autofocus on rAF, Escape→close, **Cmd/Ctrl+Enter→onReturn** (submit), `Tab` focus-trap (visible-only), body scroll-lock. Latest-callback refs so deps are `[open]`.
- Helpers: `useStableId`, `useOnlineStatus`, `useListKeyboardNav` (arrows/Home/End/Enter), `useLocalCollapse` (localStorage), `withTimeout` (30s + abort).
- **Consumers:** `AddToDashboardModal` (`:225`), `AddToReportModal` (`:195`), `SaveAsWorkflowModal` (`ChatView.tsx:1663`). **Not** `DataPickerModal` → it rolls its own dialog with **no focus-trap/Escape/scroll-lock** (the clearest a11y fix in chat).
- A **second, older** focus-trap (`src/hooks/useFocusTrap.ts`) is used by reports/exceptions modules — two competing implementations (only one locks scroll).

---

## 11. Polish backlog (consolidated & prioritized)

**A. Correctness / behavioral (functional bugs first):**
1. **Stop button hidden during the audit loader** (`isTyping` false while `showProgressiveLoader` true) — gate on `isGenerating` instead.
2. **Entry-point mismatch:** RACM "Create Workflow" opens Workflow mode; Process Hub "Create workflow" opens Query mode (`?view=chat` missing `compose=workflow`). Same label, different landing.
3. **Report "View Report" dead-end:** new reports don't persist and `onViewReport` ignores the id.
4. **Report focus-ring color bug:** section headers/rows ring blue in the violet modal (`WidgetPickerParts` accent default).
5. **Stale `onLaunchWorkflowBuilder` docstring** (claims embedded; routes to a separate journey view).
6. **`window.open` features inconsistent** (RACM passes `noopener,noreferrer`; Process Hub doesn't).
7. **Stale `?compose=workflow`** never stripped → refresh re-forces Workflow mode.

**B. Data/preview honesty:**
8. `resultData` is the same constant `AUDIT_RESULT` for every message — previews never match the real answer.
9. **Fake chart previews** in both AddTo modals (only `confidence`/`vendor` mapped; real `data` ignored) → a wall of identical bars.
10. **Granularity lost on persist** (per-KPI/column toggles flatten to one stub).
11. `renderChart` axis labels don't match the fixture buckets.

**C. Visual consistency (the recurring tokens themes):**
12. **Radius:** `ModalShell` `rounded-2xl` vs project `rounded-xl`; attach **+** `rounded-full` (hero) vs `rounded-lg` (in-thread); cards mix `rounded-lg/xl/2xl`; chat dialogs span `rounded-2xl`/`rounded-xl`/bespoke.
13. **Mode control:** hero = `radiogroup` (2 segments), in-thread = `switch` (locked) — different ARIA, shape, treatment for "the same" control.
14. **Type scale:** dozens of bespoke `text-[0.xxxrem]` values; 9px (`0.5625rem`) text in table previews.
15. **Token-family drift:** DataPicker SourceList uses `surface-2`/`text-muted`; concierge cards use hardcoded hex + `fuchsia` gradients; report modal uses raw `violet`/`amber`.
16. **Text size split:** plain assistant messages 15px/1.65 (wrapper) vs markdown `<p>` 14px/1.7 (`AssistantMarkdown.tsx:55`).
17. Three different "selected" visual languages inside the AddTo step-2 grids.
18. Composer hero radius `1.25rem` hardcoded; the 88px toggle width is a magic number repeated 3×.

**D. Accessibility & motion:**
19. **`DataPickerModal` has no shared a11y** (focus-trap/Escape/scroll-lock) — biggest a11y gap.
20. Two competing focus-trap hooks (`useModalA11y` vs `useFocusTrap`) — consolidate.
21. `ModalRowSkeleton` pulse + concierge card mounts + the 0.7s Y-spin aren't reduced-motion-gated; the follow-up chip cascade isn't either (intentional, but heavy).
22. Mixed z-index magic numbers (`ModalShell` `z-[9999]` vs drawers `z-50`).

**E. UX micro-gaps:**
23. Advertised `↑` "edit last message" shortcut (`:7207`) is **unimplemented**.
24. Assistant messages carry no visible timestamp (only user, on hover) — asymmetric.
25. "Save as workflow" posts a clarification instead of opening its modal (label implies an immediate modal).
26. AddTo modals close instantly on confirm (no in-modal success beat, though `SuccessPanel` exists).
27. User-bubble comment (`:6165`) describes an italic margin-note with a brand rule; the code renders a filled `bg-brand-50` pill — decide intent.
28. Two text systems for clarification UIs (serif `ClarificationCard` vs sans `ClarificationBlock`).
29. Long subtitle (2.5s) + hello draw (~3.5s) = slow hero first-paint on repeat opens.

---

## 12. Dead / unused code inventory

| Item | Where | Note |
|---|---|---|
| `AssumptionsPanel.tsx` | whole file | 0 imports; the "assumptions" stage doesn't exist in the shipped flow |
| `ProgressiveLoader.tsx` | whole file | 0 imports; live loader is `InlineAuditLoader` |
| `LiquidFillGraphic.tsx` | whole file | 0 imports |
| `SuccessPanel` | `ModalPrimitives.tsx:188` | exported, never rendered |
| `StepMapData` import | `ChatView.tsx:47` | imported, Map step uses `WorkflowOutputPreviewCard` instead |
| `loading`/`loadError`/`onRetryLoad` paths | both AddTo modals | props never passed → skeleton/error/retry branches unreachable |
| async submit branch (spinner/Stop/timeout/Retry) | both AddTo modals | `handleConfirm` returns `void` (sync) → never entered |
| `ConnectDbPanel` | `DataPickerModal.tsx:929` | kh-add only; unreachable from chat |

> Decide per item: delete, or wire up (e.g. revive a real assumptions stage / success beat / async submit) as part of the polish pass.
