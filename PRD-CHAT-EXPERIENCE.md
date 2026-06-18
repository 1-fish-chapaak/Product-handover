# PRD — Auditify Chat (Unified Query + Workflow Builder)

**Status:** Draft v1 · **Scope:** Hackathon demo + Internal alpha · **Last updated:** 2026-04-28

> Merged PRD covering the entire chat experience — `Run audit query` and `Build a workflow` enter through one composer, share one conversation thread, and converge on one workspace canvas. Replaces `PRD-ASK-IRA.md` and `PRD-WORKFLOW-BUILDER.md` as the canonical spec.

---

## 1. Goal

**Auditify Chat** is a single conversational surface where an auditor can either **ask a data question** or **build a re-runnable workflow** — without learning two products. The composer is shared; the **right-side workspace** swaps components based on intent.

The conversation does not branch. Once the user commits to a mode (via chip, sidebar entry, or save-as-workflow flip), the chat thread continues — even when the workspace components rotate underneath. This means a single thread can carry a query result, a workflow build, and the bridge between them.

### Two modes, one workspace
| Mode | Workspace components (top → bottom) |
|---|---|
| **Query mode** (`Run audit query`) | `Query Plan` → `Coder` → `Reference` |
| **Workflow mode** (`Build a workflow`) | `Workflow Plan` → `Input Config` → `Output Config` → `Result Preview` |

When a user clicks **`Save as workflow`** below a complete query result, the chat stays put but the workspace swaps **query components → workflow components**, seeded from the query SQL/output. The builder's checkpoint dialog runs inline. Same conversation produces an answer **and** a workflow.

### Three entry points
1. **Sidebar `Auditify Chat`** — opens the unified `hello` home. User picks intent via composer chips.
2. **`Build a workflow` button on Workflows library** — opens chat with workflow-mode toggle pre-on.
3. **`Save as workflow` action below a complete query result** — flips toggle on mid-thread, swaps workspace, runs checkpoint inline.

---

## 2. User journey

### Path A — Direct query (mode = query)

1. User opens Auditify Chat from sidebar. Empty conversation; hero `hello` + `Audit smarter. Not harder.` Two chips below composer: **`Build a workflow`** · **`Run audit query`**.
2. User types question (or uploads via `+`) and either presses Submit or clicks `Run audit query`. Chat enters query mode.
3. Workspace mounts on the right and loads in order: `Query Plan` → `Coder` → `Reference`. Newest auto-expands; older collapse.
4. Follow-ups stay in the same thread; workspace updates per turn. Inline citations are clickable (drawer).
5. End: action bar appears below complete result → **`Export · Dashboard · Reports · Save as workflow`**. Visibility gate: only when result has structured data (table/graph/KPI).

### Path B — Workflow build from chip or library (mode = workflow)

1. User clicks `Build a workflow` chip (or arrives via Workflows library `+ New workflow`). Chat enters workflow mode with hint copy *"Describe the workflow you want to build."*
2. User types the workflow description (and optionally attaches data via `+`). Submit.
3. **Initial clarify overlay** appears: 2–4 questions (matching logic, tolerance preset, date scope), one at a time, full-screen. `Skip` allowed per question.
4. Overlay dismisses → workspace mounts with all four workflow tiles. The **`Workflow Plan` tile is the active accordion**; remaining tiles seed in collapsed state with `Pending` chips.
5. **Step expansion follows journey order:**
   - **Upload (Input Config tile):** auto-opens `UploadDataModal` once per draft. Required inputs filled → 3 s `Verifying files…` loader → tile collapses to summary, `Output Config` tile activates.
   - **Map (Output Config tile):** column-alignment table per input. User confirms → 3 s `Confirming mappings…` loader → `Result Preview` tile activates.
   - **Review (Result Preview tile):** tolerance configuration in the same tile's footer. `Validate workflow` triggers **validate clarify** chips inline in chat (matching logic confirm + tolerance preset).
6. Run executes against sample data. Tile shows `Running…` → result with KPI tiles + flagged-rows table.
7. User clicks `Save to Library` → `SaveWorkflowModal` (name, BP, RACM, description) → toast. Chat posts event line. Save button → `Saved ✓`.

### Path C — Save-as-workflow from query (toggle flips mid-thread)

1. After a complete query result (Path A end), user clicks `Save as workflow`.
2. Confirm modal: *"Turn this thread into a workflow? You won't be able to switch back to query mode in this chat — start a new chat for that."* → confirm.
3. **Toggle flips on and locks** (renders as non-clickable `Pill tone="info"` reading `Workflow mode`). Workspace **swaps query components for workflow components, seeded from the original query**:
   - `Query Plan` → `Workflow Plan` (re-derived from the SQL the Coder ran).
   - `Coder` → `Input Config` (sources the query touched become required inputs; uploaded files carry forward as pre-filled attachments).
   - `Reference` → `Output Config` (table columns + chart shape from the query result become the workflow output schema).
   - New tile appended: `Result Preview` (sample-data run, not the full data the query already executed against).
4. IRA posts new message in same thread: **checkpoint question** + inferred suggestions as chips (e.g., `Date range (Q1 2026)`, `Vendor scope (all)`, `Threshold (±3 days)`). User picks which params should be configurable at run time.
5. Workspace updates Input Config + Output Config + Result Preview live as user picks.
6. User clicks `Save to Library` → toast. Original chat history (the query turn + IRA's answer + citations) remains scrollable above the workflow turn.

### Toggle behavior — locked
- **Off → On** is a deliberate user action (Path B entry, Path C confirm). Never automatic.
- **On → Off does not exist within a thread.** To do a query again, user starts `+ New chat`.
- Visual: chip-row on composer when off + clickable. When on, replaced with a status pill — no off affordance shown.

### Upload behavior — dual + carry-forward
- Composer `+` (Lucide `Plus`) is always available. Opens `UploadDataModal` (4 tabs: `Upload` · `All Data` · `Files` · `DB`).
- IRA can also explicitly request data (*"Upload Q1_GST_returns.xlsx or use a connected source"*) with an inline `Upload file` button + connected-source chip below its message.
- **Carry-forward (workflow mode only):** files attached before workflow generation map 1:1 to required inputs in declaration order; extras stack on the first input. User can re-order in Step 2 modal.

### Cross-mode rules
- **One thread = one final mode.** A thread starts mode-agnostic; first commitment locks. Save-as-workflow is the only way to migrate query → workflow inside the thread.
- **Conversation persists across mode flips.** All prior turns remain visible. Workspace tiles past the flip-point are the **new mode's**; tiles before it are **archived in place** (collapsed, read-only, `tone="default" Stale` chip).
- **Action bar visibility** (below IRA results) is gated on result completeness, not on chat-having-an-answer. Empty results, errors, clarification turns, and text-only outputs do **not** show the bar.

---

## 3. Wireframes + design system

### Layout

Two panes inside the standard app shell.

```
┌─ App sidebar (existing, ~64px icons) ─┬──────── Auditify Chat ────────────────┐
│                                        │                                       │
│   • Sparkle (Auditify, current)        │ Empty: hero `hello` + composer +      │
│   • Home / History / Layers / …        │        intent chips (centered)        │
│   • + New chat                         │                                       │
│                                        │ Active: split — chat (~520px) +       │
│                                        │         workspace canvas (flex)       │
│                                        │                                       │
└────────────────────────────────────────┴───────────────────────────────────────┘
```

### Empty state (the `hello` home — both modes share this)

| Element | Treatment |
|---|---|
| Hero mark | `hello` cursive script, 220px, brand-600, hand-drawn SVG. Centered. |
| Headline | `font-display`, 56px / 1.05, `Audit smarter.` `text-ink-900` + `Not harder.` `bg-clip-text` brand-600 → evidence gradient. |
| Subheadline | 14px `text-ink-500`, *"Your AI copilot already knows what to look for. Just ask."* |
| Composer | Single rounded card, `rounded-2xl border border-canvas-border bg-canvas-elevated p-5`, soft brand shadow. Placeholder *"Describe a workflow and let Auditify do the rest"*. |
| Composer left tools | Mic (voice, ghost) · `+` attach (ghost). `+` shows `{n} attached` chip in `text-brand-700` after picks. |
| Composer right CTA | `Submit` — `bg-brand-600`, `Sparkles` icon, disabled state `bg-brand-100 text-brand-300`. |
| Intent chips (below composer) | Two pill buttons: **`Build a workflow`** (brand-50 bg, brand-700 text, `Workflow` icon) · **`Run audit query`** (evidence-50 bg, evidence-700 text, `Shield` icon). Mutually exclusive — clicking one commits the thread to that mode. |
| Mode commitment behavior | If user submits without picking a chip, IRA infers from prompt text. If ambiguous, IRA asks one disambiguation question (*"Want me to run this once or save it as a re-runnable workflow?"*) before mounting the workspace. |

### Chat canvas (~520px fixed, post-commit)

**Composer (sticky bottom)**
- Workflow-mode toggle (left). Switch when off; locked `Pill tone="info"` reading `Workflow mode` when on.
- `+` attach — opens `UploadDataModal`.
- Text input — single line, grows to max 6 lines. `Cmd+Enter` to send.
- Send button — `brand-600`, disabled until text or attachment present.
- Quick-reply chip row above composer (3 chips, contextual to focused workspace tile in workflow mode; absent in query mode).

**Conversation stream**
| Element | Treatment |
|---|---|
| User message | Plain text, left-aligned, `ink-800`, 17px. No avatar. No bubble. (Workflow mode renders user replies as right-aligned brand-600 bubbles when responding to clarify chips — distinguishes structured input.) |
| Thinking state | Three pulsing `brand-400` dots, 900ms stagger, with current step name above (*"Querying transactions table…"*). |
| Loader row (`role: loader`) | Dots + label *"Verifying files…"* / *"Confirming mappings…"*. Universal duration **3000ms** for inter-step transitions in workflow mode. |
| IRA message | `AIResponse` recipe — gradient border (violet→magenta 24% alpha), `paper-0` + 3% brand tint bg, `body-lg` 17px, max 66ch. Inline citation chips (clickable). |
| Inline checkpoint chips | `Pill`-styled buttons, `r-full`, secondary variant, multi-select (workflow mode) or single-select (clarify). Freeform reply also accepted. |
| Inline upload CTA | `Button variant="secondary"` + Lucide `Upload` icon, beneath IRA's request message. |
| Event row (`role: event`) | Single line, `tone="link"` brand · `tone="info"` ink · `tone="success"` evidence. e.g. *"Linked **Tally Sync** → **Invoices**"* / *"**Duplicate invoice flags** saved to **P2P · FY26 P2P — Vendor Payment**"*. |
| Action bar (query mode only) | Below complete IRA result. Buttons: `Export · Dashboard · Reports · Save as workflow`. **Hidden during streaming, on errors, on clarification turns, on text-only outputs without table/graph data.** |

### Workspace canvas (flex, accordion both modes)

- Vertical accordion of `Card variant="outlined"`, radius 12, `paper-200` border.
- **Smart switching:** newest auto-expands; older collapse to one-line summary (icon + name + status pill + last-updated time).
- **Component header:** Lucide icon + sentence-case name + status pill on right.
- **Status pills:** `tone="success" Done` / `tone="info" Working` / `tone="warning" Needs input` / `tone="error" Failed` / `tone="default" Stale`.
- **Mode-specific component sets:**
  - **Query mode:** `Query Plan` → `Coder` → `Reference`.
  - **Workflow mode:** `Workflow Plan` → `Input Config` → `Output Config` → `Result Preview`.
- **Result Preview tile (workflow mode):** renders KPI tiles row + chart + flagged-items table inline. Sticky action footer inside tile when expanded: `Edit Configuration · Save to Library · Run Detection`.
- **Empty state:** centered on `canvas-elevated`, `text-ink-500`, *"Components appear here as I work through your question."*
- **Mode-flip transition (Path C):** query tiles slide up 12px and fade to `Stale` styling (paper-100 overlay, no border-radius change) over 300 ms. Workflow tiles fade in from below with 100 ms stagger. Conversation does not scroll.

### Workflow Plan tile — internals (workflow mode)

The `Workflow Plan` tile is a meta-accordion containing the 4-step journey:
- **Step 1 — Describe:** read-only summary of the user's prompt + IRA-named workflow draft. Edit pencil → opens prompt re-edit (regenerates draft).
- **Step 2 — Upload:** input list with file chips per input. Re-open trigger opens `UploadDataModal`.
- **Step 3 — Map:** input list expanding to column-alignment tables (source col → target col, confidence %, reason chips for `unmapped` / `low_confidence` / `type_mismatch`).
- **Step 4 — Review:** workflow steps (`extract` / `compare` / `validate` / `flag` / `summarize`) + tolerance configuration (amount / date / text / qty).

Each sub-step is a sub-accordion with its own status pill. Auto-advance fires the universal 3000 ms loader between sub-steps. The tile's overall pill aggregates: `Working` if any sub-step is in progress, `Needs input` if any is gated, `Done` only when all four are complete.

### Header (above panes)
- Breadcrumb: `Home / Auditify Chat / [conversation title]`. IRA generates title after first turn.
- Right: `+ New chat` · overflow menu (rename, delete, export transcript). **No `Save as workflow` here** — it lives in the chat action bar.

### Modals

| Modal | Trigger | Tabs / content |
|---|---|---|
| `UploadDataModal` | Composer `+`, workflow Step 2 auto-open + re-open | `Upload` (drag-drop) · `All Data` · `Files` · `DB`. Search bar, multi-select. Confirm in workflow mode → maps to required inputs in order. Confirm in query mode → attaches to next user message. |
| `SaveWorkflowModal` | `Save to Library` (workflow mode) or `Save as workflow` confirm flow (Path C) | Name input · Business Process select (P2P / O2C / S2C / R2R) · RACM select (filtered by BP) · Description. Save disabled until name + BP + RACM all set. |
| `ClarificationPanel` | After workflow generation (initial phase only, Path B) | Full-screen overlay, single question, large 56px option chips, `Skip` underline. |
| `Save-as-workflow confirm` | `Save as workflow` button (Path C) | Compact dialog, single explainer + `Cancel` / `Continue` buttons. |
| `Citation drawer` | Click inline citation chip | Side drawer (480px), entity title + snippet + link to source. Read-only. |

### Design system tokens (Editorial GRC)

| Element | Token |
|---|---|
| App canvas | `--canvas` `#FCFAFD` |
| Composer + cards bg | `--canvas-elevated` `#FFFFFF`, border `--paper-200` |
| Workspace card | `Card variant="outlined"`, radius 12, border `--paper-200` |
| IRA response | `AIResponse` — gradient border, `paper-0` + brand 3% tint |
| Citations | inline pill, `JetBrains Mono code-sm`, `brand-50` bg, `brand-700` text |
| Thinking dots | three `brand-400` dots, spring ease, 900ms stagger |
| Streaming caret | 2px `brand-600`, 1.2s blink |
| Workflow-mode chip | `Pill tone="info"`, label `Workflow mode`, no border, no icon |
| Intent chips (empty state) | `Build a workflow` brand-50 / brand-700 · `Run audit query` evidence-50 / evidence-700 |
| Checkpoint chips | `Button variant="secondary" size="sm"`, `r-full` |
| Step badges (workflow steps) | `extract`/`compare` brand · `flag` risk · `validate` evidence · `summarize` compliant · `calculate` mitigated |
| Confidence bars (mapping) | `≥85%` evidence-500 · `60–84%` mitigated-500 · `<60%` risk-500 |
| Row tone (run results) | `flagged` risk-50 + risk left-border · `warning` mitigated-50 · `ok` compliant-50 |
| Upload button (composer) | `Button variant="ghost" size="sm" icon-only`, Lucide `Plus` |
| Upload CTA (inline) | `Button variant="secondary" size="md"`, Lucide `Upload` |
| Toasts | success 5s · info 5s · warning 8s · error persistent · width 380px, bottom-right |
| Focus ring | `0 0 0 4px rgba(106,18,205,0.24)` |
| Typography | Inter for chat + UI; Source Serif 4 for narrative hero only; JetBrains Mono inside `Coder` + citations. |
| Density | 32px page padding, 8pt grid throughout, 12px card radius |

---

## 4. QA / UAT scenarios + failure states

### Positive — query mode

**S1. Direct query renders complete result.**
*Steps:* Open Auditify Chat, type *"Show duplicate invoices in Q1 2026 with same vendor + amount + date ±3 days"*, click `Run audit query`.
*Expect:* Workspace loads `Query Plan` → `Coder` → `Reference`. Chat renders IRA prose + inline citations (`INV-4521`, `INV-3102`). Action bar appears: `Export · Dashboard · Reports · Save as workflow`.

**S2. Multi-turn query with mid-conversation upload.**
*Steps:* Mid-conversation, click composer `+`, pick `Q1_vendor_master.csv` (2.3 MB). Type *"Cross-reference these vendors against the duplicates"*, send.
*Expect:* Attachment chip in user message. Workspace `Reference` updates with new file. IRA prose references both original duplicates + new vendor data.

**S3. IRA explicitly requests data; user uploads inline.**
*Steps:* Ask *"Show GST mismatches for last quarter"* without uploading.
*Expect:* IRA replies *"I need the GST returns file to answer this. Upload Q1_GST_returns.xlsx or point me at a connected source."* with inline `Upload file` button + chip `Use connected source: Tally Sync`. Both work.

### Positive — workflow mode

**S4. Build via chip → clarify → 4-step journey → save.**
*Steps:* Empty state, click `Build a workflow`, type *"Detect duplicate invoices weekly across all vendors with >85% match"*, submit.
*Expect:* Initial clarify overlay (matching logic, tolerance preset, vendor scope), 1 question at a time. Overlay dismisses, workflow tiles mount. `UploadDataModal` auto-opens. After all required inputs filled, 3 s `Verifying files…` loader, advance to mapping. Confirm mappings → 3 s loader → review. Validate → run → preview → save.

**S5. Carry-forward across mode commit.**
*Steps:* Empty state, click `+`, attach `Q1_invoices.csv` + `Q1_pos.csv`. Click `Build a workflow`. Type prompt, submit.
*Expect:* Workflow draft generates with 3 required inputs. First two carry over 1:1 in declaration order; third stays empty. Modal auto-opens to fill the third input only.

**S6. Save workflow under BP + RACM.**
*Steps:* From Result Preview tile, click `Save to Library`. Pick BP `Procure to Pay` → RACM dropdown filters to `FY26 P2P — Vendor Payment` and `FY26 P2P — Purchase Order`. Pick RACM. Save.
*Expect:* Modal closes. Chat posts event *"**Duplicate invoice flags** saved to **P2P · FY26 P2P — Vendor Payment**."* Save button → `Saved ✓` for the session.

### Positive — bridge (Path C)

**S7. Save-as-workflow flips toggle mid-thread.**
*Steps:* From completed query (S1), click `Save as workflow` → confirm modal → confirm.
*Expect:* Toggle flips on and locks. Query tiles fade to `Stale` styling in place. Workflow tiles slide in below them, seeded from the query. IRA posts checkpoint message in same thread with inferred suggestions: `Date range (Q1 2026)` `Vendor scope` `Threshold (±3 days)`. User picks → workspace updates → save.

**S8. Bridge preserves uploaded files.**
*Setup:* Query in S1 used `Q1_invoices.csv` (uploaded mid-thread).
*Expect:* After flip, `Input Config` tile shows `Q1_invoices.csv` already attached to the inferred Invoices input. No re-upload required.

### Negative / mode-specific

**S9. Upload exceeds size or format limit.**
*Steps:* Drag `transactions_2024.zip` (340 MB) or `audit_recording.mp4`.
*Expect:* File picker rejects pre-upload. Toast `error` (persistent): *"File must be CSV, Excel, or PDF under 50 MB. Got: ZIP, 340 MB."* No partial upload state.

**S10. Workflow save fails (server error).**
*Steps:* Complete checkpoint flow, click `Save to Library`. API returns 500.
*Expect:* Spinner clears. Toast `error` (persistent): *"Couldn't save workflow. Your draft is preserved here — try again, or copy the workflow plan from the workspace."* Button re-enabled. Chat + workspace state preserved.

**S11. Query returns no results.**
*Steps:* Ask *"Show invoices over ₹100 Cr in Q1 2026"* — no matches.
*Expect:* IRA prose: *"I checked the Q1 2026 invoice ledger (4,820 records). No invoices exceeded ₹100 Cr. Largest was ₹47.3 Cr (Acme Corp, INV-4521)."* Workspace tiles show `Done — empty result`. Action bar shows only `Export · Save as workflow` (no Dashboard/Reports for empty data).

**S12. Citation doesn't resolve.**
*Steps:* Click inline citation chip `IT-GEN-99` in IRA response.
*Expect:* Citation drawer attempts fetch → fails. Drawer shows: *"This reference (`IT-GEN-99`) couldn't be loaded. It may have been removed or you don't have access."* + `Report this answer` link. Chip stays inline; conversation not broken.

**S13. Send fails — network drop mid-message.**
*Steps:* Type message, click send. Connection drops.
*Expect:* Message in chat with `Sending…` state → converts to `Failed to send` with inline `Retry` button. Composer re-enabled. No silent loss.

**S14. Required input left empty (workflow mode).**
*Steps:* Step 2, attach files only to Invoices and POs (skip Contracts Register). Close modal.
*Expect:* Auto-verify does **not** trigger. Input Config tile stays in `Needs input` state with red dot on Contracts Register row. Chat does not auto-advance.

**S15. Run fails (engine error).**
*Steps:* Validate → clarify → run. Run engine throws.
*Expect:* `Result Preview` tile → `Failed`. Chat posts assistant *"The run hit an error — try again, or open a new chat to refine the prompt."* + (v1.1) inline retry chip. Tolerance config preserved.

**S16. Save-as-workflow attempted on incomplete output.**
*Setup:* IRA produced text only, no table/graph/structured data.
*Expect:* Action bar does **not** show `Save as workflow`. Visibility check is on result completeness, not on chat-having-an-answer.

**S17. Mode-flip user cancels confirm.**
*Steps:* Click `Save as workflow` → confirm modal → click `Cancel`.
*Expect:* Modal dismisses. Toggle stays off. Workspace unchanged. No event line in chat.

### Stitching / RBAC / edge cases

**S18. User lacks permission to save workflow.**
*Setup:* External Auditor role (read-only).
*Expect:* `Save as workflow` button **hidden** in action bar (not just disabled). `Build a workflow` chip **hidden** on empty state. If user opens via direct workflow-creator link, toggle locked off + IRA shows: *"Workflow building isn't available to your role. You can run published workflows from Workflows."*

**S19. Two browser tabs open the same chat thread.**
*Steps:* Send query in Tab A → open same chat URL in Tab B.
*Expect:* Tab B loads server state with read-only banner: *"This chat is open in another tab. Refresh to take over."* Sending from Tab B triggers confirm: *"Continue this chat here? The other tab will become read-only."* Server-side last-writer-wins.

**S20. Network drops mid-IRA-stream.**
*Steps:* IRA streaming response, connection drops at ~40%.
*Expect:* Caret stops. Partial message stays visible with banner: *"Connection lost while answering. The partial response is shown below — retry to get the full answer."* + `Retry`. On retry, IRA regenerates from the same prompt (does not splice).

**S21. RACM list empty for selected BP.**
*Setup:* User picks BP `Source to Contract` (`s2c`) where only one RACM exists (`RACM-006`, draft).
*Expect:* RACM dropdown shows the single option. No filtering on status (draft RACMs allowed for save).

**S22. Saved workflow run errors out from Workflows page.**
*Setup:* Click `Run Detection` on saved `Duplicate Invoice Detection`. Source data missing for one configured input.
*Expect:* Run page shows: *"This run couldn't complete. Input `Q1_invoices_2026` returned 0 rows — was it removed or renamed? Check the source or open in Auditify Chat to debug."* + `Open in Auditify Chat` button (opens fresh chat seeded with workflow + failure context).

**S23. Re-saving an already-saved workflow.**
*Steps:* After S6, click `Save to Library` again.
*Expect:* Button is `Saved ✓` and disabled. Tooltip: *"Open Workflows library to edit this saved workflow."* No modal opens.

### Graceful failure principles (global rules)

- Never show raw stack traces or HTTP codes. Always one-sentence what + one-sentence next step.
- Never silently lose user input. Failed sends keep the message + retry; failed uploads keep the file selected.
- Never block the chat on a workspace failure. Failed workspace tile shows inline error + `Retry component`; chat stays interactive.
- Never auto-retry a failed mutation (save / delete / run). Reads (citations, references, schema previews) auto-retry once.
- Always preserve the chat thread. Drafts persist across browser refresh in v1.1 (in-memory only in v1).

---

## 5. Async states

### Composer

| State | Trigger | Visual | Behavior |
|---|---|---|---|
| Idle | Default | Submit disabled, `paper-200` border | Placeholder *"Describe a workflow and let Auditify do the rest"* |
| Typing | Text or attachment | Submit enabled (`brand-600`) | Char count after 1,500 chars |
| Sending | Submit clicked | Submit → spinner, input disabled | Message in chat with `Sending…` label |
| Sent | Server ack | Spinner clears, composer resets | `Sending…` removed within 200ms |
| Send failed | Net/API fail | Message stays + `Failed` pill | Inline `Retry` + `Edit and resend` |
| Attaching | File picked | Attachment chip with progress bar 0–100% | Filename + size + cancel × |
| Attach failed | Upload fail | Chip → `error` tone | Inline `Retry upload` + `Remove` |

### IRA response

| State | Trigger | Visual | Copy |
|---|---|---|---|
| Thinking — generic | IRA queued | Three pulsing `brand-400` dots, 900ms stagger | None |
| Thinking — named step | IRA running sub-task | Dots + step name above | *"Reading process catalog…"* / *"Querying transactions table…"* / *"Drafting workflow plan…"* |
| Tool-running | IRA invoked tool | Inline mono pill below dots | `tool: query_runner · 1.2s elapsed` |
| Streaming | First token received | Prose appears + 2px `brand-600` caret blinking | Auto-scrolls only if user is at bottom |
| Loader (named, workflow mode) | Step transition | Dots + label inline | *"Verifying files…"* / *"Confirming mappings…"* (3000 ms universal) |
| Done | EOF token | Caret removes, timestamp under message | `Answered in 1.2s · 4 sources · model: ira-v2` |
| Errored | Stream failure | Partial response stays + warning banner attached | *"Connection lost. Partial response shown — retry for full answer."* + `Retry` |

### Workspace component (both modes)

| State | Visual | Copy |
|---|---|---|
| Pending | Card collapsed, pill `Queued`, skeleton bar | None |
| Loading | Pill `tone="info" Working`, skeleton lines (3 rows pulsing 1.5s) | None |
| Streaming | Real content row-by-row, fade-in 200ms per row, pill stays `Working` | None |
| Done | Pill `tone="success" Done`, last-updated time in header (`Updated 12s ago`) | None |
| Needs input | Pill `tone="warning" Needs input`, header bg `brand-50` | Inline CTA inside card, e.g., *"Pick parameters to continue."* |
| Errored | Pill `tone="error" Failed`, error icon + line | *"Couldn't load this step."* + `Retry component`. Chat stays interactive. |
| Stale (post-flip or data change) | Subtle `paper-100` overlay + chip top-right `Stale` | *"Archived from query mode."* (Path C) / *"Data changed. Refresh to update."* (general) |

### Mode flip (Path C)

| State | Visual | Copy / behavior |
|---|---|---|
| Pre-flip confirm | Compact modal | *"Turn this thread into a workflow? You won't be able to switch back to query mode in this chat — start a new chat for that."* + `Cancel` / `Continue` |
| Flipping | Toggle morphs to pill (250 ms), workspace cross-fades (300 ms) | None |
| Post-flip seed | Workflow tiles render with inferred values pre-filled, all in `Needs input` until user confirms | Chat: *"I've drafted a workflow from your query. Pick which parameters should be configurable at run time."* |
| User skips checkpoint | Workflow tiles populate with defaults | Chat: *"OK, locking this with defaults. You can edit later from Workflows."* |

### Workflow build (mode = workflow)

| State | Visual | Copy / behavior |
|---|---|---|
| Drafting checkpoint | Chips appear below IRA message | *"Pick which parameters should be configurable at run time."* Multi-select. |
| Checkpoint pending user reply (>30s) | Subtle pulse on chip group | None. Pulse stops on first interaction. |
| Building preview | `Result Preview` `Working` + skeleton of KPI tiles + chart + table | Inline above tile: *"Generating live preview from sample data…"* |
| Preview ready | `Result Preview Done`, action footer enabled | None |
| Saving to library | Button → spinner, other actions disabled | None |
| Saved | API success | Toast `success` 5s: *"Workflow saved to library."* + `View workflow` link. Button reverts to `Saved ✓` for 3s, then back to `Save to Library`. |
| Save failed | Button reverts | Toast `error` (persistent) per S10 |
| Run-now in progress | Button → spinner, `Result Preview` swaps to `Run in progress…` skeleton | *"Running on full data — this may take up to 30s."* |
| Run-now complete | Result Preview re-renders with real numbers | Inline: *"Run completed at 22:14 IST · 3 anomalies flagged."* |
| Run-now failed | Error tile per S15 | `Open in Auditify Chat to debug` button |

### System-wide

| State | Visual | Copy |
|---|---|---|
| Network reconnecting | Sticky banner below header, `tone="warning"`, subtle pulse | *"Reconnecting…"* — no actions blocked client-side. |
| Network restored | Banner `tone="success"` for 3s, dismisses | *"Reconnected."* |
| Optimistic action pending | Target element `brand-50` bg | None — silent until confirm |
| Optimistic confirmed | Bg fades over 200ms | None |
| Optimistic rejected | Rolls back with shake (75ms × 2) | Inline error + retry |
| Background sync (>5min away) | Top banner `tone="info"` for 4s | *"Refreshed with latest data."* |
| Long-running >10s | Step name persists with elapsed time | *"Querying transactions table… 14s elapsed. This is taking longer than usual."* |
| Long-running >30s | Adds `Cancel` button | Cancel triggers IRA-side abort + chat banner *"Cancelled."* |
| Long-running >60s | Stronger copy | *"Still working — should be done within a minute."* |
| Long-running >120s | Hard cancel auto-offered | *"This is taking unusually long. Cancel and retry, or wait."* |
| Concurrent tab takeover | Banner in original tab | *"This chat is being edited in another tab. Refresh to take over."* |

**Reduced-motion:** all pulsing dots, skeleton shimmer, caret blink, shake animations respect `prefers-reduced-motion: reduce` — replaced with static states (single static dot; solid caret; flat `paper-100` skeleton bg). Mode-flip cross-fade becomes an instant swap.

---

## 6. Dependencies + stitching

All surfaces below are **adjacent to or built into Auditify Chat**. Anything `Required pre-v1` must ship (or stub) before the chat demos end-to-end across all three paths.

| # | Surface | Status | Owner | Contract | Stub for hackathon |
|---|---|---|---|---|---|
| 1 | Workflows library | Required pre-v1 | Workflows team | `POST /workflows {name, bp_id, racm_id, description, plan, input_config, output_config, configurable_params, source_chat_id, mappings, tolerance}` → `{workflow_id, library_url}`. `GET /workflows` for listing. | In-memory list, no persistence. Toast → click → workflow appears in library under BP/RACM grouping. |
| 2 | Business Process + RACM registry | Required pre-v1 | Governance team | `GET /business-processes`, `GET /racms?bp_id=…`. Static taxonomy fine for v1. | Hardcoded `BUSINESS_PROCESSES` (P2P/O2C/S2C/R2R) + `RACMS` (6 entries) in `mockData.ts`. |
| 3 | Workflow creator entry point | Required pre-v1 | Workflows team | Single button `Build a workflow` on workflows library + sidebar; routes to `/auditify-chat?mode=workflow&seed=<creator_context>`. | Single button on workflow library page + composer chip. |
| 4 | Data sources / connections | Required pre-v1 | Data platform | `GET /sources` → `[{id, name, type, status, schema_summary}]`. `POST /uploads` → `{file_id, parsed_schema}`. Chunked upload, virus scan, parse (CSV/Excel/PDF), schema inference. | Local file upload only. Connector list hardcoded to 2 entries (`Tally Sync`, `Evidence repo`) with canned schemas. |
| 5 | Auth + RBAC | Required pre-v1 | Platform | `GET /me` → `{user_id, role, permissions[]}`. Frontend hides actions per `permissions[]` (`Save as workflow`, `Build a workflow` chip). | Single hardcoded role `Auditor` with all perms. External Auditor deferred. |
| 6 | Citation / evidence registry | Stub-only for v1 | Governance | `GET /entities/{id}` → `{id, type, title, snippet, link}`. 404 → graceful failure per S12. | In-memory entity map for ~20 fake citations matching demo dataset. Click opens side drawer with snippet. |
| 7 | Chat infra (streaming, persistence) | Built inside chat | Auditify team | SSE for streaming + REST for persistence. Internal only. | In-memory persistence (lost on server restart) acceptable for hackathon; durable in alpha. |
| 8 | LLM / workflow synthesis | Built inside chat | Auditify team | `POST /workflows:generate {prompt, source_query?}` → `WorkflowDraft` (inputs, steps, output, suggested clarify). `source_query` populated for Path C seed. | `mockApi.ts → generateWorkflow(prompt)` returns deterministic draft from a template bank keyed off prompt keywords. Path C uses canned mappings query → workflow. |
| 9 | Run engine | Built inside chat | Auditify team | `POST /workflows/{id}/run {files, mappings, tolerance, sample?}` → `RunResult` (stats, columns, rows). `sample=true` for in-chat preview. | `mockApi.ts → runWorkflow()` returns canned result after 1.5s timeout. No streaming. |
| 10 | Column alignment service | Stub-only for v1 | ML | `POST /align {source_columns, target_columns}` → `[{id, source, target, confidence, breakdown, reason}]`. | `mockApi.ts → seedAlignments()` deterministic per-input; confidence randomized in stable buckets. |
| 11 | Templates + sample workflows | Built inside chat | Auditify team | `GET /templates` → `WorkflowDraft[]`. | `sampleWorkflows.ts` ships 6+ canned templates. Recent rail wired to `WORKFLOWS` mock. |

---

## 7. Open questions + assumptions

### Open questions (need decisions)

| # | Question | Why it matters | Owner | Deadline |
|---|---|---|---|---|
| 1 | Path A → C conversion target — is 15% baseline-justified or aspirational? | North-star calibration | Product | Pre-demo |
| 2 | When workflow-mode-locked thread receives a pure query, suggest "open new chat" or answer it inside workflow mode? | Mode-switching guardrails | Design | Mid-M1 |
| 3 | Chat thread sharing — can a user share a link to their Auditify Chat thread? RBAC implications. | Collaboration scope | Product + Platform | M2 planning |
| 4 | Auto-naming threads — IRA generates title (deterministic? streamed?) or user names it? | Affects M1 P1 scope | Design | Pre-M1 |
| 5 | Workflow versioning — edit creates new version or in-place mutation? | Data model | Backend | M2 planning |
| 6 | Concurrent user limit per workspace — rate limiting needed? | Infrastructure cost | Platform | M2 planning |
| 7 | Context window per thread (50 turns / 100 KB cap) — at limit, truncate / force new chat / summarize? | UX at long-thread end | Product + ML | Mid-M1 |
| 8 | Configurable params validation — when checkpoints conflict (e.g., date_range configurable but SQL hardcodes it), refuse / auto-fix / warn? | Workflow correctness | ML + Product | Pre-workflow-mode build |
| 9 | What happens to attached files when chat is deleted? Cascade / soft-delete / retain for compliance? | Data retention | Legal + Backend | M2 planning |
| 10 | Trust signals (thumbs-up/down, citation CTR) — needed by alpha or post-pilot survey enough? | Quality measurement gap | Product | Pre-M2 |
| 11 | Pricing / metering — does Auditify Chat usage count against a per-user quota? Where in UI? | Commercial model | Product | M2 planning |
| 12 | Failure mode when zero data sources connected — what does Auditify say in onboarding? | Onboarding gap | Design | M2 planning |
| 13 | When a user clicks `Build a workflow` chip then submits a question that reads as a one-shot query, do we flip back to query mode automatically or insist on workflow? | Mode commitment guardrails | Design | Mid-M1 |
| 14 | Universal 3000 ms loader — does it stay constant once API is real, or scale with actual latency? | Pacing rule | Design + Backend | Pre-M2 |
| 15 | Multi-RACM workflows — when a check spans P2P and O2C, single primary RACM or array? | Data model | Backend | M2 planning |
| 16 | Edit-after-save — does opening a saved workflow re-enter the builder at Step 4 (review) or Step 1 (re-prompt)? | Editing UX | Product | M2 planning |
| 17 | Tolerance presets — should `Custom` allow per-column tolerance overrides in v1 or v1.1? | Configure-tab scope | ML + Product | Mid-M1 |
| 18 | Path C seed fidelity — when query SQL hardcodes a value the user didn't intend to parametrize, does IRA make it configurable by default or only when checkpoint chip is picked? | Data model + UX | ML + Product | Pre-Path-C-build |
| 19 | Run-now in workflow mode — sample data (~1k rows) or full uploaded file? | Run cost vs. fidelity | Platform | Pre-M2 |
| 20 | Template authoring — internal-only in v1, or workspace admins can publish their own? | Library scope | Product | Post-pilot |

### Assumptions (taken as true; mark explicitly)

1. **One workspace per organization.** Multi-workspace switching exists at platform level; Auditify Chat threads scoped to single workspace. No cross-workspace queries.
2. **Single language: English.** No localization in v1.
3. **Desktop-first, ≥1280 px viewport.** Mode-flip split layout breaks below 1024 px; mobile / tablet not in scope.
4. **Single LLM model per environment.** No per-user model preference, no model picker.
5. **File parsing best-effort.** CSV/Excel/PDF up to 50 MB. Encrypted PDFs, scanned image-PDFs without OCR, password-protected files silently rejected with generic error.
6. **No PII redaction in v1.** Uploaded data treated as auditor-confidential; no automatic masking.
7. **Workspace canvas auto-scroll.** New auto-expanded item triggers scroll; user can override; auto-scroll resumes only when user is at bottom.
8. **Citations are non-editable.** IRA inserts; user clicks but cannot add / remove / re-attribute.
9. **`Save as workflow` is one-shot per chat.** Once a thread becomes a workflow thread, that chat's `Save as workflow` is consumed. Re-save happens via workspace footer `Save to Library`.
10. **No retroactive workflow creation from old chats.** `Save as workflow` only on current thread / current model context.
11. **Streaming uses SSE, not WebSocket.** Simpler infra, no bidirectional needs in v1.
12. **Run-now uses sample data (~1,000 rows), not full data.** Full runs happen from saved workflow page, not from inside Auditify Chat.
13. **Action bar `Export / Dashboard / Reports` are stubs in v1.** Only `Save as workflow` is fully wired. Others show toasts (`coming soon`) on click.
14. **No keyboard shortcuts beyond standard.** `Cmd+Enter` to send; `Cmd+K` opens existing global search. No Auditify-specific shortcuts.
15. **Toast positions follow existing app convention.** Bottom-right for success/info; top-center for persistent errors.
16. **Universal 3000 ms loader for inter-step transitions in workflow mode.** `LOADER_MS = 3000` is a deliberate pacing choice — not a placeholder waiting for real latency. Document signoff needed before changing.
17. **Step 1 attachments map to required inputs in declaration order.** Extras stack on the first input. User can re-order in Step 2 modal.
18. **One BP + one RACM per saved workflow.** Multi-assignment deferred to v1.1.
19. **`Save to Library` is one-shot per session.** Once saved, the in-session button locks. Re-edit happens from Workflows library (out of scope here).
20. **Initial clarify questions are templated per workflow draft.** Generated from the draft's input/step shape, not from user prompt. Validate clarify is a fixed 2-question pre-run check.
21. **No retroactive saving of incomplete drafts.** Save is gated on `result` being present in workflow mode. Drafts without a successful run cannot be saved as workflows.
22. **Templates are read-only in v1.** User can pick one, but cannot save edits back as a new template. Saved workflows are not templates.
23. **Mode commitment locks the thread.** Once committed (chip click, library entry, save-as-workflow flip), the thread cannot return to mode-agnostic. New chat required.
24. **Path C seeds, doesn't re-execute.** The query already ran; the workflow inherits the SQL/output without re-running the data fetch. Result Preview generates from sample data only.
25. **Workspace tile archival on flip is in-place.** Query tiles do not move to a side panel or get deleted — they fade to `Stale` styling, remain expandable for reading, and stay above the new workflow tiles in the same accordion.

---

## Appendix — Workflow Builder user journey (detailed)

### Step 1: Describe your workflow

1. The user lands on 'Ask Ira'. The `Workflow Builder` toggle inside the chat input box is on.
2. The user types a workflow description, picks a template (which pre-fills `logicPrompt`), or clicks `+` to attach data first.
3. `Audit on Chat` is enabled when the prompt has text. Click → Auditify generates a `WorkflowDraft` (name, inputs, steps, output) and routes to Step 2 with the **initial clarify overlay**.

### Initial clarify (gates Step 2)

1. If the user has not added any files, clarifications are shown only for the prompt input, if any.
2. A full-screen `ClarificationPanel` overlays the journey, one question at a time.
3. Auditify asks 2–4 questions (matching logic preset, tolerance preset, date scope) sourced from `getClarifyQuestions(draft)`. Each question is multi-choice, with `Skip` allowed.
4. On the last answer, the overlay dismisses and Step 2 chat appears with the assistant message *"Got it — locked those in. Drop the required data files into the upload window so I can map them."*

### Step 2: Upload Data Files

1. `UploadDataModal` auto-opens once per workflow, unless Step 1 carry-forward already fills every required input.
2. The modal has 4 tabs: `Upload` (drag-drop) · `All Data` · `Files` · `DB`. Each pick maps to the next empty required input; extras stack on the first input.
3. Closing the modal returns the user to chat. An **Upload card** in chat lists the files added per input and includes a reopen trigger.
4. **Auto-verify:** when every required input has at least one file, chat shows a `Verifying files…` loader (3s), then the assistant message *"Files verified — moving to data mapping."* Step advances to 3.
5. The right-side panel shows the Input config tab and displays the added folders and files.

### Step 3: Select columns

1. The layout splits into **chat (50% screen)** + **Right workspace (50% screen)**.
2. Chat shows a **Map card** listing each input as a collapsed row. The user clicks `Edit` → the row expands → a column-alignment table appears inside it (source col → target col, confidence %, reason chips for `unmapped` / `low_confidence` / `type_mismatch`).
3. The right panel mirrors the focused input's schema (input config); columns can be selected or unselected for use in the workflow builder.
4. [optional] Quick-reply chips above the composer adapt to focus: `Recommend columns` · `Explain a column` · `Preview sample rows`.
5. The user clicks `Confirm & Proceed` (inside the Map card) → 3s `Confirming mappings…` loader → assistant *"Mappings confirmed — opening review."* → Step 4.

### Step 4: Review & Run

1. The **Review card** in chat shows each step (`extract` / `compare` / `validate` / `flag` / `summarize`) as an accordion with linked data sources beneath.
2. The right panel switches to the Plan tab: workflow references (column inputs), coder toggle, and an editable, rearrangeable workflow plan.
3. The user clicks `Validate Plan` (inside the Review card) → triggers **validate clarify** inline in chat (matching logic confirm + tolerance preset).

### Step 5: View Preview

1. On the final clarify answer (from validate plan) → the output config appears on the right side.
2. Chat surfaces a **View Preview** chip card. Click → reveals the **Output card** (KPI tiles + table). The Output card has a `Save Workflow` button.
3. While running: the Review card shows a `Running…` skeleton. On completion: chat posts *"Finished. The Duplicate invoice flags is ready — 24 rows, 4,820 records scanned."*

### Save flow

1. `Save Workflow` opens `SaveWorkflowModal`. Fields: name, **Business Process** (P2P / O2C / S2C / R2R), **RACM** (filtered by BP), and description.
2. Confirm → workflow persisted under that BP + RACM, chat posts an event line *"Duplicate invoice flags saved to Procure to Pay · FY26 P2P — Vendor Payment."*
3. The Save button reverts to `Saved ✓`. Re-saving in the same session is blocked (use Workflows library to edit a saved copy).

### Cross-step rules

- **No back navigation between steps; the journey is forward-only.** `← Back to AI Concierge` exits the workflow builder setup.
- **Chat history persists across steps.** Step-card messages (`upload` / `map` / `review` / `output` / `view-preview`) are pushed once per workflow id; they do not duplicate on revisit.
