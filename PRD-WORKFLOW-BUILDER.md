# PRD — Workflow Builder (AI Concierge)

**Status:** Draft v1 · **Scope:** Hackathon demo + Internal alpha · **Last updated:** 2026-04-27

> This PRD is consumed by Claude Code as build context. Tight by design. No prose where a table works.

---

## 1. Goal

Workflow Builder is a **guided, four-step concierge** that turns an auditor's plain-English description of an audit check into a re-runnable workflow. Auditify (the AI concierge) carries the dialogue; the workspace switches between **journey cards** (prompt, upload, map, review) on the left and a **persistent DataSource / Configure panel** on the right once mapping begins.

The builder is opinionated about **inputs → mapping → tolerance → output** and refuses to leave a step until the contract is satisfied (required inputs filled, columns aligned, tolerances confirmed). At the end, a saved workflow lives under a **Business Process · RACM** so it can be re-run from the Workflows library.

**Three entry points:**
1. AI Concierge home → `Build a workflow` → blank prompt + recent/template gallery.
2. Workflows library → `+ New workflow` → same prompt screen, library breadcrumb.
3. Templates carousel on Step 1 → pre-fills `logicPrompt` and skips Step 1.

Step 1 attachments carry forward into Step 2 inputs automatically (one file per required input, extras pile on the first input). Two clarification phases exist: an **initial clarify** (matching logic, tolerance preset) gates Step 2; a **validate clarify** gates the run in Step 4. Same conversation thread persists across steps — the user can scroll up to read what they answered earlier.

---

## 2. User journey

### Step 1 — Describe your workflow
1. User lands on the prompt hero (`Audit smarter. Not harder.`). Composer below; templates + recent workflows in two rails underneath.
2. User types a workflow description **or** picks a template (pre-fills `logicPrompt`) **or** clicks `+` to attach data first.
3. `Audit on Chat` enabled when prompt has text. Click → Auditify generates a `WorkflowDraft` (name, inputs, steps, output) and routes to Step 2 with the **initial clarify overlay**.

### Initial clarify (gates Step 2)
1. Full-screen `ClarificationPanel` overlays the journey. One question at a time.
2. Auditify asks 2–4 questions (matching logic preset, tolerance preset, date scope) sourced from `getClarifyQuestions(draft)`. Each question is multi-choice with `Skip` allowed.
3. On last answer → overlay dismisses, Step 2 chat appears with assistant message *"Got it — locked those in. Drop the required data files into the upload window so I can map them."*

### Step 2 — Upload Data Files
1. `UploadDataModal` auto-opens once per workflow (skipped if Step 1 carry-forward already fills every required input).
2. Modal has 4 tabs: `Upload` (drag-drop) · `All Data` · `Files` · `DB`. Each pick is mapped to the next empty required input; extras stack on the first input.
3. Closing the modal returns the user to chat. An **Upload card** in chat lists added files per input + a re-open trigger.
4. **Auto-verify:** when every required input has ≥1 file, chat shows `Verifying files…` loader (3s), then assistant message *"Files verified — moving to data mapping."* Step advances to 3.
5. Right-side panel is **hidden** in Step 2 (chat is full-width).

### Step 3 — Data Mapping
1. Layout splits: **chat (left, 920px max)** + **DataSourcePanel (right, flex)**.
2. Chat shows a **Map card** listing each input as a collapsed row. User clicks `Edit` → row expands → column-alignment table renders inside (source col → target col, confidence %, reason chips for `unmapped` / `low_confidence` / `type_mismatch`).
3. Right panel mirrors the focused input's schema; columns are clickable for explanations.
4. Quick-reply chips above composer adapt to focus: `Recommend columns` · `Explain a column` · `Preview sample rows`.
5. User clicks `Confirm & Proceed` (inside Map card) → 3s `Confirming mappings…` loader → assistant *"Mappings confirmed — opening review."* → Step 4.

### Step 4 — Review & Run
1. **Review card** in chat: each step (`extract` / `compare` / `validate` / `flag` / `summarize`) renders as an accordion with linked data sources beneath.
2. Right panel switches to **Configure** tab: tolerance rules (amount / date / text / qty), input notes, AI suggestions.
3. User clicks `Validate workflow` (inside Review card) → triggers **validate clarify** inline in chat (matching logic confirm + tolerance preset).
4. On final clarify answer → assistant posts *"Got it — running with **±5%** amount tolerance."* → run executes (`mockApi.runWorkflow`).
5. While running: Review card shows `Running…` skeleton. On done: chat posts *"Finished. The **Duplicate invoice flags** is ready — 24 rows, 4,820 records scanned."*
6. Chat surfaces a **View Preview** chip card. Click → reveals the **Output card** (KPI tiles + table). Output card has a `Save Workflow` button.

### Save flow
1. `Save Workflow` opens `SaveWorkflowModal`. Fields: name, **Business Process** (P2P / O2C / S2C / R2R), **RACM** (filtered by BP), description.
2. Confirm → workflow persisted under that BP + RACM, chat posts an event line *"**Duplicate invoice flags** saved to **Procure to Pay · FY26 P2P — Vendor Payment**."*
3. Save button reverts to `Saved ✓`. Re-saving in the same session is blocked (use Workflows library to edit a saved copy).

### Cross-step rules
- **Back navigation is forward-only inside the journey.** `← Back to AI Concierge` exits to Step 0 (concierge home). Stepper UI is read-only and reflects current `step`.
- **Step regression is implicit only.** If the user removes the last file from a required input on Step 2, auto-verify will not re-fire (one-shot per workflow id). To restart, user clicks `Back to AI Concierge` → re-enter.
- **Chat history persists across steps.** Step-card messages (`upload` / `map` / `review` / `output` / `view-preview`) are pushed once per workflow id; they do not duplicate on revisit.

---

## 3. Wireframes + design system

### Layout

```
┌─ App sidebar (existing) ─┬──────── Workflow Builder ─────────────────────┐
│                          │                                                │
│                          │ Step 1 — full-bleed hero (prompt + templates)  │
│                          │                                                │
│                          │ Step 2 — single chat column (~920px centered)  │
│                          │                                                │
│                          │ Step 3–4 — split:                              │
│                          │   ┌─ chat (~920px) ─┬─ DataSource panel ─┐    │
│                          │   │                  │  (flex, sticky)    │    │
│                          │   └──────────────────┴────────────────────┘    │
└──────────────────────────┴────────────────────────────────────────────────┘
```

### Step 1 — prompt hero

| Element | Treatment |
|---|---|
| Hero heading | `font-display`, 56px / 1.05, `Audit smarter.` `text-ink-900` + `Not harder.` `bg-clip-text` brand-600 → evidence gradient. |
| Subheadline | 14px `text-ink-500`, *"Your AI copilot already knows what to look for. Just ask."* |
| Prompt box | `rounded-2xl border border-canvas-border bg-canvas-elevated p-5`, soft brand shadow. Textarea 3 rows, no focus ring. |
| Attach (`+`) | Ghost icon button. Shows `{n} attached` chip in `text-brand-700` after picks. |
| `Audit on Chat` | `bg-brand-600` solid, `Sparkles` icon, disabled state `bg-brand-100 text-brand-300`. |
| Templates rail | Horizontal cards, `WORKFLOWS + SAMPLE_WORKFLOWS` merged. Click → `onPickTemplate(id)`. |
| Recent rail | `Clock` icon header. Same card style. Click → opens saved workflow run page (out of scope here). |

### Steps 2–4 — chat canvas

**Composer (sticky bottom inside `AIAssistantPanel`)**
- Attach button (Lucide `Paperclip`, ghost). Opens `UploadDataModal`.
- Text input — single line, grows to max 6 lines. Placeholder adapts: *"Ask about Invoices…"* when an input is focused.
- Send button — `brand-600`, disabled until text present. `Cmd+Enter` to send.
- Quick-reply chip row above composer (3 chips, contextual to focus).

**Conversation stream**
| Element | Treatment |
|---|---|
| User message | Right-aligned bubble, `bg-brand-600 text-white`, `r-2xl`, max 66ch. |
| Assistant message | Left-aligned, `AIResponse` recipe — gradient border (violet→magenta 24% alpha), `paper-0` + 3% brand tint bg, 14px ink-800. Inline **bold** for entity names. |
| Typing indicator | Three pulsing `brand-400` dots, 900ms stagger. |
| Loader row (`role: loader`) | Dots + label *"Confirming mappings…"* / *"Verifying files…"*. Universal duration **3000ms**. |
| Event row (`role: event`) | Single line, `tone="link"` brand · `tone="info"` ink · `tone="success"` evidence. e.g. *"Linked **Tally Sync** → **Invoices**"*. |
| Card row (`role: card`) | Inline component card per `cardType`: `upload` / `map` / `review` / `output` / `view-preview`. One per workflow id. |
| Inline clarify chips | `Pill`-styled buttons, `r-full`, secondary variant, single-select. `Skip` link below. |
| Context chip (above composer) | Active focus indicator: input/step name + dismiss `×`. |

### Right panel — DataSourcePanel (Steps 3–4)

- Vertical accordion of input cards. Collapsed = name + filename + green check; expanded = column list with role badges (`join_key` / `compare` / `filter` / `output`).
- **Step 3 content:** column alignment per input, confidence bars, reason chips (`unmapped` `low_confidence` `type_mismatch`).
- **Step 4 content:** swaps to **Configure** tab — `ToleranceSection` (amount/date/text/qty) + input notes, AI-suggested toggles.
- Sticky header: workflow name + step pill (`Step 3 of 4 · Map Data`).
- Empty state: *"Pick an input on the left to see its schema here."*

### Step indicator (top of journey, Steps 2–4)

- 4-dot stepper, current = `bg-brand-600`, done = `bg-evidence` with check, future = `bg-paper-200`.
- Read-only. Labels: `Describe` · `Upload` · `Map` · `Review`.

### Modals

| Modal | Trigger | Tabs / content |
|---|---|---|
| `UploadDataModal` | Step 1 `+`, Step 2 auto-open + `Re-open upload` | `Upload` (drag-drop) · `All Data` · `Files` · `DB`. Search bar, multi-select. Confirm → maps to required inputs in order. |
| `SaveWorkflowModal` | Output card `Save Workflow` | Name input · Business Process select · RACM select (filtered by BP) · Description. Save disabled until name + BP + RACM all set. |
| `ClarificationPanel` | After workflow generation (initial phase only) | Full-screen overlay, single question, large 56px option chips, `Skip` underline. |

### Design system tokens (Editorial GRC)

| Element | Token |
|---|---|
| App canvas | `--canvas` `#FCFAFD` |
| Card surfaces | `bg-canvas-elevated` `#FFFFFF`, border `--canvas-border` |
| Brand primary | `--brand-600` `#6A12CD` (CTAs, focus, links) |
| Step badges | `extract`/`compare` brand · `flag` risk · `validate` evidence · `summarize` compliant · `calculate` mitigated |
| Row tone (run results) | `flagged` risk-50 + risk left-border · `warning` mitigated-50 · `ok` compliant-50 |
| Confidence bars | `≥85%` evidence-500 · `60–84%` mitigated-500 · `<60%` risk-500 |
| Save button | `bg-brand-600 hover:bg-brand-500`, `Save` Lucide icon |
| Toasts | success 5s · info 5s · warning 8s · error persistent · width 380px, bottom-right |
| Focus ring | `0 0 0 4px rgba(106,18,205,0.24)` |
| Typography | Inter for chat + UI; `font-display` (Source Serif 4) for Step 1 hero only |
| Density | 32px page padding, 8pt grid, 12px card radius, 16px chat row gap |

---

## 4. QA / UAT scenarios + failure states

### Positive

**S1. Prompt → workflow generated → initial clarify → Step 2.**
*Steps:* Step 1, type *"Detect duplicate invoices in Q1 2026 across vendors with same amount and date ±3 days"*, click `Audit on Chat`.
*Expect:* Routes to Step 2. Initial clarify overlay shows **Question 1 of 2: matching logic** with 4 options. After answering both, overlay fades, chat shows assistant intro + auto-opens `UploadDataModal`.

**S2. Template skip → straight to clarify.**
*Steps:* Click `Vendor Contract Compliance` template card on Step 1.
*Expect:* `prompt` state is filled (read-only feel — input keeps the template's `logicPrompt`). Workflow draft seeded with template's inputs/steps/output. Initial clarify intro reads *"Starting from the **Vendor Contract Compliance** template…"*.

**S3. Step 1 attachments carry forward.**
*Steps:* Step 1, click `+`, upload `Q1_invoices.csv` + `Q1_pos.csv` via `UploadDataModal`. Type prompt, click `Audit on Chat`.
*Expect:* Workflow generates. Step 2 upload card already shows `Q1_invoices.csv` under Invoices input, `Q1_pos.csv` under POs input (one per required input in order). Chat shows user line *"Attached 2 files: Q1_invoices.csv, Q1_pos.csv"*. Modal does **not** auto-open if all required inputs are filled by carry-forward.

**S4. Auto-verify advances to Step 3.**
*Steps:* In Step 2, fill all required inputs in `UploadDataModal`. Close modal.
*Expect:* Chat posts loader *"Verifying files…"* (3s). On finish: assistant *"Files verified — moving to data mapping."* Stepper advances to `Map`. Right-side DataSourcePanel mounts.

**S5. Map → confirm → review.**
*Steps:* Step 3, click `Edit` on Invoices card, review column alignment, click `Confirm & Proceed`.
*Expect:* 3s `Confirming mappings…` loader, assistant *"Mappings confirmed — opening review."*, advance to Step 4. Right panel switches to Configure tab.

**S6. Validate → clarify → run → preview reveal.**
*Steps:* Step 4, click `Validate workflow` inside Review card.
*Expect:* Validate clarify chips appear inline in chat (`matching-logic`, then `tolerance-preset`). Pick `Moderate (±5%)`. Chat posts *"Got it — running with **±5%** amount tolerance."* then `Running…`. On finish, **View Preview** chip card appears. Click → Output card reveals KPI tiles + flagged-rows table.

**S7. Save workflow under BP + RACM.**
*Steps:* From Output card, click `Save Workflow`. Name field pre-filled. Select BP `Procure to Pay` → RACM dropdown filters to `FY26 P2P — Vendor Payment` and `FY26 P2P — Purchase Order`. Pick RACM. Click `Save`.
*Expect:* Modal closes. Chat posts event *"**Duplicate invoice flags** saved to **Procure to Pay · FY26 P2P — Vendor Payment**."* Save button on Output card switches to `Saved ✓` state and disables.

### Negative / state-specific

**S8. Clarify skip-all path.**
*Steps:* In initial clarify, click `Skip` on every question.
*Expect:* Chat assistant intro reads *"OK, proceeding with defaults where you skipped. Drop the required data files into the upload window so I can map them."* Tolerance defaults to `5%`. Run uses defaults silently.

**S9. Required input left empty.**
*Steps:* In Step 2, attach files only to Invoices and POs (skip Contracts Register). Close modal.
*Expect:* Auto-verify does **not** trigger. Upload card stays in `Pending` state with red dot on Contracts Register row + label *"Required — no file yet"*. Chat does not auto-advance.

**S10. Modal size or format limit.**
*Steps:* In `UploadDataModal`, drag a 340 MB ZIP.
*Expect:* Picker rejects pre-upload. Inline error in modal: *"File must be CSV, Excel, or PDF under 50 MB. Got: ZIP, 340 MB."* No partial upload state. Other selections preserved.

**S11. Run fails (mock API rejects).**
*Steps:* In Step 4, validate → clarify → run. `runWorkflow` throws.
*Expect:* `running=false`, no `result` set. Review card returns to idle state with `Validate workflow` re-enabled. Chat posts assistant *"The run hit an error — try again, or open a new chat to refine the prompt."* (Future: inline retry chip — out of scope v1.)

**S12. Save fails (BP/RACM API 500).**
*Steps:* Complete S7 up to `Save`. Mock save throws.
*Expect:* Spinner clears. Toast `error` (persistent): *"Couldn't save workflow. Your draft is preserved here — try again."* Modal stays open with values intact.

**S13. User picks RACM before BP.**
*Steps:* In `SaveWorkflowModal`, click RACM dropdown without picking BP.
*Expect:* RACM list is empty (`bpId === ''` filter returns 0). Helper text *"Pick a business process first."* shows under select.

**S14. Step 1 prompt empty + click `Audit on Chat`.**
*Steps:* No text, click button.
*Expect:* Button stays disabled (state: `bg-brand-100 text-brand-300 cursor-not-allowed`). No-op.

**S15. Carry-forward overflow.**
*Setup:* Step 1, attach 5 files. Workflow generates with 3 required inputs.
*Expect:* First 3 files map 1:1 to the 3 required inputs in order. Files 4 and 5 stack on the **first** input (`pickTargetInputId` fallback). Chat shows all 5 names in the carry-forward user message.

### Stitching / RBAC / edge cases

**S16. User exits mid-clarify.**
*Steps:* In initial clarify, click `← Back to AI Concierge`.
*Expect:* Confirm dialog: *"Discard this workflow draft? Your prompt and answers won't be saved."* On confirm: full state reset (workflow=null, files={}, messages=[seed]). On cancel: stays in clarify.

**S17. Two browser tabs open the journey for the same draft.**
*Setup:* Same user, same workflow id (e.g. seeded from URL param) in two tabs.
*Expect:* No real-time sync in v1. Last `Save` write wins. Toast in losing tab on next save attempt: *"This workflow was saved from another tab. Refresh to see the latest."*

**S18. RACM list empty for selected BP.**
*Setup:* User picks BP `Source to Contract` (`s2c`) and only one RACM exists for it (`RACM-006`, draft).
*Expect:* RACM dropdown shows the single option. No filtering on status (draft RACMs allowed for save).

**S19. View Preview never clicked.**
*Steps:* Run completes, user closes the tab without clicking `View Preview`.
*Expect:* On reopen of the same workflow draft (in-memory): preview state remains hidden. Chat shows the `view-preview` card but not the `output` card. Click reveals output (sticky behavior).

**S20. Re-saving an already-saved workflow.**
*Steps:* After S7, click `Save Workflow` again.
*Expect:* Button is `Saved ✓` and disabled. Tooltip: *"Open Workflows library to edit this saved workflow."* No modal opens.

### Graceful failure principles (global rules)

- Never show raw stack traces or HTTP codes. One-sentence what + one-sentence next step.
- Never silently lose user input. Failed sends keep the message + retry; failed uploads keep the file selected.
- Never block the chat on a workspace failure. Failed right-panel tile shows inline error + `Retry`; chat stays interactive.
- Never auto-retry a failed mutation (save / run). Reads (column previews, schema) auto-retry once.
- Always preserve the chat thread across step transitions. Drafts persist across browser refresh in v1.1 (in-memory only in v1).

---

## 5. Async states

### Composer

| State | Trigger | Visual | Behavior |
|---|---|---|---|
| Idle | Default | Send disabled, `paper-200` border | Placeholder *"Ask Auditify…"* (or focus-aware variant) |
| Typing | Text or attachment | Send enabled (`brand-600`) | Char count after 1,500 chars |
| Sending | Send clicked | Send → spinner, input disabled | Message in chat with `Sending…` label |
| Sent | Server ack | Spinner clears, composer resets | `Sending…` removed within 200ms |
| Send failed | Net/API fail | Message stays + `Failed` pill | Inline `Retry` + `Edit and resend` |
| Attaching | File picked in modal | Progress bar 0–100% per file | Filename + size + cancel × |

### Auditify response

| State | Trigger | Visual | Copy |
|---|---|---|---|
| Typing | `setIsTyping(true)` | Three pulsing `brand-400` dots, 900ms stagger | None |
| Loader (named) | Step transition (`upload→map`, `map→review`) | Dots + label inline | *"Verifying files…"* / *"Confirming mappings…"* (3000ms) |
| Streaming response | Auditify generates text | Prose appears + 2px brand caret blinking | None |
| Done | Message pushed | Caret removes, message stays | Optional inline event line below |
| Errored | API throws | Assistant posts a fallback line | *"Hit an error — try again, or restart the workflow."* + (v1.1) `Retry` chip |

### Step cards

| State | Visual | Copy |
|---|---|---|
| Pending | Card with skeleton row + `Pending` chip | None |
| Active | Card expanded, brand border, current step highlight | Inline CTA — `Edit` / `Confirm & Proceed` / `Validate workflow` |
| Done | Card collapses to one-line summary, `Done` evidence chip | *"Mapped 3 inputs · 8 columns aligned"* / *"4,820 records scanned"* |
| Errored | Card border `risk-300`, error icon | *"Couldn't complete this step."* + `Retry component` |
| Locked (gated) | Card greyed, lock icon | *"Finish previous step to continue."* |

### Right panel (Steps 3–4)

| State | Visual | Copy / behavior |
|---|---|---|
| Empty (no focus) | Centered helper | *"Pick an input on the left to see its schema here."* |
| Loading schema | Skeleton column rows (3 pulsing 1.5s) | None |
| Schema ready | Column list with role badges | None |
| Configure (Step 4) | Tolerance accordion + input notes | Default tolerance `±5% amount`. AI-suggested notes show `Lightbulb` chip. |
| Run-in-progress | Configure tab disabled with overlay | *"Run in progress — configuration locked until done."* |
| Stale (after step regression) | `paper-100` overlay + `Stale` chip | *"Re-mapping needed — confirm the upload again."* |

### Run + save

| State | Visual | Copy / behavior |
|---|---|---|
| Validating clarify | Inline chips in chat | *"Before I kick off the run, I've spotted a couple of ambiguities — pick what fits below."* |
| Running | Review card shows `Running…` skeleton, KPI tile placeholders | None |
| Run done | View Preview chip pushed | *"Finished. The **{title}** is ready — {n} rows, {m} records scanned."* |
| Preview revealed | Output card appears, KPI tiles + table | None |
| Saving to library | `Save Workflow` → spinner | None |
| Saved | Button → `Saved ✓` for full session | Toast `success` 5s: *"Workflow saved to library."* + `Open in Workflows` link. Chat event line. |
| Save failed | Button reverts | Toast `error` (persistent) per S12 |

### System-wide

| State | Visual | Copy |
|---|---|---|
| Network reconnecting | Sticky banner below header, `tone="warning"` | *"Reconnecting…"* — no actions blocked client-side. |
| Network restored | Banner `tone="success"` for 3s, dismisses | *"Reconnected."* |
| Long-running >10s | Loader label persists with elapsed time | *"Verifying files… 14s elapsed. This is taking longer than usual."* |
| Long-running >30s | Adds `Cancel` button | Cancel triggers run abort + chat banner *"Cancelled."* |

**Reduced-motion:** all pulsing dots, skeleton shimmer, caret blink animations respect `prefers-reduced-motion: reduce` — replaced with static states (single static dot; solid caret; flat `paper-100` skeleton bg).

---

## 6. Metrics + scale

### North star
**Workflow completion rate** — `% of generated workflow drafts that reach Save Workflow within the same session`.
- v1 launch target: ≥ 35% within first 30 days. Stretch: 50%.

### Business metrics (90d post-launch)

| Metric | Definition | Target |
|---|---|---|
| Drafts → saved workflows | % of `generateWorkflow` calls that result in `workflow_saved` | ≥ 35% |
| Saved workflows / WAU | Unique workflows saved per weekly active user | ≥ 0.4 |
| Workflow runs / week | Total runs from saved library | 3× baseline by week 8 |
| Time-to-first-workflow | First prompt → first saved workflow per user | < 2 sessions |
| Template adoption rate | % of drafts seeded from a template vs. blank prompt | 30–50% (healthy band) |
| Step-2 abandon rate | % of users who reach Step 2 but never reach Step 3 | < 25% |
| Step-3 abandon rate | % of users who reach Step 3 but never click Validate | < 15% |
| Hours saved per saved workflow (self-reported) | Post-engagement survey | ≥ 4 hrs (median) |
| Workflow re-use rate | Avg # runs per saved workflow within 30d | ≥ 4 |

### Tech / observability metrics

| Metric | SLO |
|---|---|
| `generateWorkflow` latency (prompt → draft visible) | p50 < 2s, p95 < 5s |
| Initial clarify panel render | p95 < 400ms after draft |
| Auto-verify loader → Step 3 advance | exactly 3000ms (universal) |
| Map confirm loader → Step 4 advance | exactly 3000ms (universal) |
| Run latency (validate → result) | p50 < 8s, p95 < 25s (mock); production target p95 < 30s |
| Save workflow latency | p95 < 3s |
| Right-panel schema fetch | p95 < 800ms |
| Modal upload throughput | ≥ 5 MB/s sustained per file |
| Send failure rate | < 0.2% |
| Run error rate | < 1.5% |

### Per-step timing (active card)

| Step / card | p50 | p95 | Notes |
|---|---|---|---|
| Step 1 prompt → draft | < 2s | < 5s | LLM-bound; loader shows `Generating workflow…` |
| Initial clarify per question | < 200ms | < 400ms | Pure UI; no API |
| Upload modal pick → file in chat | < 500ms | < 1.2s | Local parse only |
| Auto-verify | 3000ms (fixed) | 3000ms (fixed) | Universal `LOADER_MS` |
| Map confirm | 3000ms (fixed) | 3000ms (fixed) | Universal `LOADER_MS` |
| Validate clarify per question | < 200ms | < 400ms | UI |
| Run execution | < 8s | < 25s | Mock; live target documented above |
| View Preview reveal | < 200ms | < 400ms | UI only |
| Save modal open → confirm | < 100ms | < 250ms | UI only |

**Pacing rule:** every step transition must show **a visible loader within 100ms** of the trigger. The 3000ms universal duration is intentional — it gives the user a moment to read the previous assistant line before the next step renders. Do not shorten without product sign-off.

### Funnel events (instrument explicitly)

```
prompt_sent → workflow_generated → initial_clarify_completed
  → upload_modal_opened → required_inputs_filled → auto_verified
  → map_confirmed → validate_clicked → validate_clarify_completed
  → run_started → run_completed → preview_revealed → save_clicked
  → save_modal_confirmed → workflow_saved
```
Highest-leverage diagnostic: `% of run_completed → save_clicked`. Secondary: `% of upload_modal_opened → required_inputs_filled`.

### Scale (v1)

| Dimension | v1 target | v1 ceiling |
|---|---|---|
| Concurrent active builders | 30 | 120 |
| Concurrent runs | 10 | 40 |
| Max chat thread length per draft | 60 messages / 80 KB | 200 messages |
| Max attachment size | 50 MB | 100 MB |
| Max attachments per workflow | 10 (across all inputs) | 25 |
| Saved workflows per workspace | 500 | 2,000 |
| Templates in gallery | 12 | 30 |
| Run row preview limit | 1,000 inline | 10,000 paginated |

### Explicitly NOT instrumented in v1
- Per-clarify-question abandon rate (only first/last tracked).
- Quick-reply chip click-through (rolled up into a single `quick_reply_clicked` event).
- Tolerance preset distribution beyond `Strict / Moderate / Relaxed / Custom` buckets.
- A/B test infra for prompt suggestions or template ordering.

---

## 7. Dependencies + stitching

All surfaces below are **adjacent to the workflow builder** — built or stubbed alongside it. Order = build sequence; anything `Required pre-v1` must ship (or stub) before the builder demos end-to-end.

| # | Surface | Status | Owner | Contract | Stub for hackathon |
|---|---|---|---|---|---|
| 1 | Workflows library | Required pre-v1 | Workflows team | `POST /workflows {name, bp_id, racm_id, description, inputs, steps, output, tolerance, mappings}` → `{workflow_id, library_url}`. `GET /workflows` for listing. | In-memory list. Toast → click → workflow appears under BP/RACM grouping. |
| 2 | Business Process + RACM registry | Required pre-v1 | Governance team | `GET /business-processes`, `GET /racms?bp_id=…`. Static taxonomy fine for v1. | Hardcoded `BUSINESS_PROCESSES` (P2P/O2C/S2C/R2R) + `RACMS` (6 entries) in `mockData.ts`. |
| 3 | Data sources / connections | Required pre-v1 | Data platform | `GET /sources` → `[{id, name, type, status, schema_summary}]`. `POST /uploads` → `{file_id, parsed_schema}`. CSV/Excel/PDF parse + schema inference. | Local file upload only via `UploadDataModal`. `DATA_SOURCES` mock + 4 extra assets covering File/DB/Cloud/Session/API kinds. |
| 4 | Auth + RBAC | Required pre-v1 | Platform | `GET /me` → `{user_id, role, permissions[]}`. Frontend hides `Save Workflow` for read-only roles. | Single hardcoded role `Auditor` with all perms. External Auditor deferred. |
| 5 | LLM / workflow synthesis | Built inside builder | Builder team | `POST /workflows:generate {prompt}` → `WorkflowDraft`. Returns inputs, steps, output, suggested clarify questions. | `mockApi.ts → generateWorkflow(prompt)` returns deterministic draft from a template bank keyed off prompt keywords. |
| 6 | Run engine | Built inside builder | Builder team | `POST /workflows/{id}/run {files, mappings, tolerance}` → `RunResult` (stats, columns, rows). Progress events optional. | `mockApi.ts → runWorkflow()` returns canned result after 1.5s timeout. No streaming. |
| 7 | Column alignment service | Stub-only for v1 | ML | `POST /align {source_columns, target_columns}` → `[{id, source, target, confidence, breakdown, reason}]`. | `mockApi.ts → seedAlignments()` deterministic per-input; confidence randomized in stable buckets. |
| 8 | Templates + sample workflows | Built inside builder | Builder team | `GET /templates` → `WorkflowDraft[]` (id, name, description, category, tags, logicPrompt, inputs, steps, output). | `sampleWorkflows.ts` ships 6+ canned templates. Recent rail wired to `WORKFLOWS` mock. |

### Build sequence

```
Week 1   | Auth/RBAC stub  ┃ BP+RACM taxonomy ┃ Mock data layer
Week 1–2 | Step 1 prompt + templates + UploadDataModal
Week 2   | mockApi (generateWorkflow + clarify questions)
Week 2–3 | Step 2 upload card + auto-verify + carry-forward
Week 3   | Step 3 mapping + DataSourcePanel (column alignment)
Week 3–4 | Step 4 review + Configure tab (tolerance) + validate clarify
Week 4   | Run engine stub + Output card + View Preview reveal
Week 4–5 | SaveWorkflowModal + library handoff
Week 5+  | Polish, async states, error UX, telemetry
```

### Out of scope for v1 / v1.1
- **Edit-saved-workflow flow:** opening a saved workflow back into the builder for edits.
- **Workflow versioning:** edit creates new version vs. in-place mutation.
- **Streaming run progress:** per-step progress events surfaced in Review card.
- **Custom step authoring:** user-defined `StepSpec` beyond the 7 canonical types (`extract` / `analyze` / `compare` / `flag` / `summarize` / `calculate` / `validate`).
- **External auditor RBAC:** read-only journey, no save/run.
- **Multi-RACM assignment:** one workflow → one RACM in v1.
- **Cross-workspace template sharing.**
- **PII redaction on uploaded data.**

---

## 8. Open questions + assumptions

### Open questions (need decisions)

| # | Question | Why it matters | Owner | Deadline |
|---|---|---|---|---|
| 1 | Realistic draft → save conversion target — is 35% baseline-justified or aspirational? | North-star calibration | Product | Pre-demo |
| 2 | When a user clicks `Audit on Chat` again on the same draft (re-prompt), regenerate or amend? | Iteration UX | Design | Mid-M1 |
| 3 | Should auto-verify re-fire if user removes and re-adds a file in Step 2? | Reversibility behavior | Product | Mid-M1 |
| 4 | Universal 3000ms loader — does it stay constant once API is real, or scale with actual latency? | Pacing rule | Design + Backend | Pre-M2 |
| 5 | Multi-RACM workflows — when a check spans P2P and O2C, single primary RACM or array? | Data model | Backend | M2 planning |
| 6 | Edit-after-save — does opening a saved workflow re-enter the builder at Step 4 (review) or Step 1 (re-prompt)? | Editing UX | Product | M2 planning |
| 7 | Tolerance presets — should `Custom` allow per-column tolerance overrides in v1 or v1.1? | Configure-tab scope | ML + Product | Mid-M1 |
| 8 | What happens when a required input has no compatible columns in the uploaded file? Block confirm or warn? | Mapping correctness | Product | Pre-Step-3-build |
| 9 | Run-now uses sample data (~1k rows) or full uploaded file? | Run cost vs. fidelity | Platform | Pre-M2 |
| 10 | Saved workflows that fail their next scheduled run — escalate to Workflows library or back into builder for diagnosis? | Stitching | Workflows team | M2 planning |
| 11 | Pricing / metering — does each `generateWorkflow` call count against a quota? Where in UI? | Commercial model | Product | M2 planning |
| 12 | Template authoring — internal-only in v1, or workspace admins can publish their own? | Library scope | Product | Post-pilot |

### Assumptions (taken as true; mark explicitly)

1. **One workspace per organization.** Workflows are scoped to a single workspace; no cross-workspace runs or templates.
2. **Single language: English.** No localization in v1. Sample workflows ship in English only.
3. **Desktop-first, ≥1280px viewport.** Step 3–4 split layout breaks below 1024px; mobile + tablet not in scope.
4. **Single LLM model per environment.** No per-user model preference, no model picker visible to auditors.
5. **File parsing best-effort.** CSV/Excel/PDF up to 50 MB. Encrypted PDFs, scanned image-PDFs without OCR, password-protected files silently rejected with generic error.
6. **Universal 3000ms loader for inter-step transitions.** `LOADER_MS = 3000` is a deliberate pacing choice — not a placeholder waiting for real latency. Document signoff needed before changing.
7. **Step 1 attachments map to required inputs in declaration order.** Extras stack on the first input. User can re-order in Step 2 via the modal.
8. **One BP + one RACM per saved workflow.** Multi-assignment deferred to v1.1.
9. **`Save Workflow` is one-shot per session.** Once saved, the in-session button locks. Re-edit happens from Workflows library (out of scope here).
10. **Initial clarify questions are templated per workflow draft.** Generated from the draft's input/step shape, not from user prompt. Validate clarify is a fixed 2-question pre-run check.
11. **No retroactive saving of incomplete drafts.** Save is gated on `result` being present. Drafts without a successful run cannot be saved as workflows.
12. **Run-now uses uploaded file as-is.** No sample/full-data toggle in v1. Whatever the user uploaded is what runs.
13. **Right-side panel only renders Steps 3–4.** Steps 1–2 use full-width chat. Avoids panel-mounting on data the user hasn't seen yet.
14. **Templates are read-only in v1.** User can pick one, but cannot save edits back as a new template. Saved workflows are not templates.
15. **Toast positions follow existing app convention.** Bottom-right for success/info; top-center for persistent errors.
