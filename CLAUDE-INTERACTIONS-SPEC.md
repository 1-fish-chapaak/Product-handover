# Claude.ai — Interaction Behavior Spec

Companion to `CLAUDE-CHAT-SPEC.md`. That document covers the **visual shell at rest** (typography, color, layout, composer chrome, action-bar order). This one covers **how Claude behaves** — the dialogs, popovers, micro-flows, branch arrows, hover affordances, and state machines that only appear once the user starts clicking.

Where direct evidence was available it is cited inline in the Sources section. Where the spec is reconstructed from convention plus partial screenshots, lines are tagged `[inferred]`.

---

## 1. Edit-message flow (per-user-message)

### 1.1 Trigger
- The pencil icon is part of the **hover action bar** that sits on every user message. The bar is `opacity-0` at rest and fades to `opacity-100` on `group-hover` of the message container (assistant-ui clone uses `group-hover/message:opacity-100` — exact pattern Claude.ai uses).
- Bar sits **directly below the user bubble**, flush-right (same x-axis as the bubble's right edge). Icons in order, left to right: **Edit (pencil)** → **Copy**. `[inferred from clone + screenshots]`
- Action bar uses 14 px icons, ~32 px tap targets, 4 px gap.

### 1.2 Click behavior — bubble morphs in-place
On pencil click the user bubble **does not open a modal**. The bubble itself transforms into an edit card occupying the same horizontal slot in the thread. Surrounding messages remain visible above and below; the thread does not scroll-lock.

### 1.3 Edit card layout (exact)
- Outer container: same max-width as the user bubble (~720 px), `rounded-2xl`, 1 px border in brand-tint (`#E5E0D6` or similar warm cream-stone), background `#FFFFFF` (light) / `#262624` (dark).
- Padding: `px-3.5 pt-3 pb-2.5` (matches composer).
- Inner: a **borderless multi-line textarea**, prefilled with the original message text, auto-grow up to ~10 rows, then scrolls. Font matches body (Styrene B / Tiempos depending on Claude.ai's current chat font).
- Focus state: the **outer container** gains a 1.5 px brand-terra-cotta (`#C96442`) border ring — the textarea itself has no visible focus ring, the card carries it.

### 1.4 Helper text
A single muted line below the textarea, above the buttons. Exact copy observed:

> *Editing this message will create a new conversation branch. You can switch between branches using the arrow navigation buttons.*

Typography: 12 px, `text-muted` token (~`#6B6B6B` light / `#A3A3A3` dark), regular weight, line-height ~1.4, no italics.

### 1.5 Buttons
Bottom-right of the card, in a flex row, 8 px gap:
- **Cancel** — ghost button, no fill, muted text, no border. Hover: faint warm-grey fill.
- **Save** — solid brand-terra-cotta (`#C96442`) fill, white text, `rounded-lg`, ~32 px tall. Right-aligned (primary).

### 1.6 Submit semantics
- **Save** does TWO things atomically:
  1. Replaces the user message text with the new draft.
  2. **Re-runs the assistant turn immediately** — i.e. no separate "send" step, Save *is* send. A new assistant streaming bubble appears directly below, replacing whatever was there.
- The prior assistant response is **not destroyed** — it is preserved as a sibling branch reachable via arrows (see §2).
- **Cancel** discards the draft and reverts the bubble to its read-only form. No confirmation.

### 1.7 Keyboard
- `Esc` → Cancel.
- `Enter` (no modifier) → insert newline (multi-line behavior).
- `Cmd/Ctrl + Enter` → Save (matches composer convention). `[inferred]`
- Pressing `↑` in an empty composer (no characters typed yet) jumps focus to "edit last user message". `[inferred from convention + several extension authors confirming Claude.ai supports this]`

### 1.8 Edited-message indicator
- After Save, the user bubble shows a small muted **"(edited)"** suffix or label, similar to Slack/Discord, attached to the timestamp/meta line under the bubble. Confirmed by multiple third-party clones; exact placement on Claude.ai is `[inferred]` — likely inline at the end of the bubble copy in a muted micro-type, or in the branch-arrow strip below.

### 1.9 What happens to the downstream chat
- The entire downstream conversation (everything below the edited message) is **forked**. The original branch is preserved invisibly; only the new branch is rendered in the thread.
- The branch picker (§2) reveals that prior path. There is no "compare branches" view — you flip back and forth one at a time.

---

## 2. Branching navigation

### 2.1 Where the arrows live
Branch arrows appear **directly under the user bubble** (not under the assistant turn) — they belong to the *user message*, because editing a user message is what created the branch. They sit on the same horizontal strip as the action bar, **flush-left of the action icons** (i.e. left side of the bubble's footer), so the visual reading order from left to right is: `‹ 2 / 3 ›   ✎  📋`.

### 2.2 Format
`‹  2 / 3  ›` — left chevron, current index, slash, total count, right chevron. ~12 px muted type, chevrons are interactive (clickable, ~24 px tap target), index is read-only text. Disabled state: chevron at 30% opacity when at first/last branch.

### 2.3 Behavior
- Clicking `›` swaps **both the user message text** AND the **entire downstream conversation** to the next branch. No animation flourish — it's an instant content swap (fast cross-fade ≤ 100 ms). `[inferred]`
- Clicking `‹` swaps back. Round-trip is lossless; no branch is ever discarded by navigation.
- The arrows are sticky to the user message even if you scroll away from it; if the message is offscreen and the user has just edited, the new branch loads at the bottom of the thread (auto-scroll to latest).

### 2.4 Branching from assistant turn (Retry)
Hitting the **Retry / regenerate** icon on an assistant message *also* creates branches, but the arrows appear under the **assistant bubble** (because the assistant message is the one that has alternates). Same `‹ N / M ›` format. The user message above is not duplicated.

### 2.5 Branches and the sidebar
Branches are **invisible from the sidebar** — they do not appear as separate chats. This is a known limitation that has prompted feature requests in the Claude Code/Desktop issue tracker (#59029). Single sidebar row → potentially many internal branches.

---

## 3. Feedback popover (👍 / 👎)

### 3.1 Trigger
- Click the thumb icon in the assistant action bar (bar order in CLAUDE-CHAT-SPEC.md: Copy · Retry · 👍 · 👎 · sometimes a "more").
- 👍 and 👎 both open a popover — but with **different content** (different prompt copy, and 👎 surfaces a reason-type dropdown, 👍 does not).

### 3.2 Popover positioning & shape
- Anchored to the clicked thumb, opens **below** the action bar (drops down). On thread-end messages near the composer it auto-flips above.
- Width ~360 px, `rounded-xl`, 1 px border in warm-grey, background card surface, soft elevation shadow (e.g. `0 4 px 12px rgba(0,0,0,0.08)`).
- Internal padding ~16 px, gap ~12 px between fields.
- Closes on: Cancel click, click-outside, `Esc`, or after successful Submit.

### 3.3 Content — 👎 popover
1. **Title** (top of popover, semibold ~14 px):
   - *"What was the issue with this response?"* (paraphrase consistent across user reports and the Guideflow walkthrough)
2. **Reason dropdown** (single-select, native or custom select):
   - Field label / placeholder: *"What type of issue do you wish to report"* (confirmed wording).
   - Options observed in user reports — likely list `[partly inferred]`:
     - Inaccurate / factually wrong
     - Didn't follow instructions
     - Refused unnecessarily / overly cautious
     - Harmful or unsafe content
     - Biased or offensive
     - Off-topic
     - Other
3. **Free-text area** below the dropdown:
   - Label / placeholder: *"What was unsatisfying about this response"* (confirmed).
   - 3–4 rows, `rounded-lg`, warm border, brand-tinted focus ring.
4. **Optional checkbox** *"Include this conversation"* — controls whether the chat transcript is uploaded with the report. `[inferred from privacy-policy mentions; not always present]`
5. **Buttons** bottom-right, 8 px gap:
   - **Cancel** — ghost.
   - **Submit** — solid terra-cotta primary.

### 3.4 Content — 👍 popover
- **Title:** *"What did you like about this response?"* `[inferred]`
- No reason dropdown. Single free-text area with placeholder along the lines of *"Tell us more (optional)"*.
- Same Cancel / Submit buttons.

### 3.5 Submission behavior
- Submit collapses the popover.
- The clicked thumb icon **becomes filled** (solid state) and stays filled — it is the persistent "you rated this" marker for the message.
- A small inline confirmation appears in or near the action bar: *"Thanks — feedback sent"* — fades after ~3 s, or it lives as a thin muted micro-line under the action bar. `[inferred — not all clones agree]`
- Clicking the now-filled thumb a second time reopens the popover prefilled with the prior text (allowing edit) `[inferred]`, or in some builds simply unrates. Treat both as plausible — default to: **reopen with prior submission editable**.

---

## 4. Code-block toolbar

### 4.1 Visibility
- Always visible (not hover-gated). The toolbar sits as a thin band along the **top edge** of every fenced code block.
- Height ~32 px, background a slightly darker tint of the code-block fill (so it visually separates from the body).

### 4.2 Components
Left side: **Language label** — lowercase (`typescript`, `python`, `bash`), 11–12 px, muted weight, monospace stack (or sans micro-caps, depending on theme).

Right side: **Copy button** (always), and on supported languages (HTML, SVG, mermaid, code that renders) a **"Run / Preview"** chip that promotes the block to an Artifact. `[inferred]`

### 4.3 Copy interaction
- Click copies the *raw* code (without language label or toolbar). A known issue (#4686) is that some renderings inject extra whitespace; the official Claude.ai web UI handles this correctly.
- The copy icon **swaps to a checkmark** with the label *"Copied"* for ~2 s, then reverts to the copy icon.
- No global toast.

### 4.4 Block sizing
- Max-height before scroll: ~480 px `[inferred]`. Beyond that, the body scrolls internally with a thin scrollbar; the toolbar stays sticky to the top of the block during inner scroll.
- Very long single lines: horizontal scroll, no wrap.

### 4.5 Language label styling
- Lowercase, muted, may include a small file-type glyph for common languages. `[inferred]`

---

## 5. Citation / source chips

### 5.1 Inline placement
- When web-search or research is active, Claude renders citations as **superscript bracketed numbers** at the end of the cited sentence: `… according to the report.[1]`
- Multiple citations stack: `… as reported.[1][2][3]` — small chips with 2 px gap, never comma-separated text.

### 5.2 Hover behavior
- Hovering a citation chip pops a **source card tooltip** of width ~320 px containing:
  - Favicon (16 px) + domain.
  - Page title (1–2 lines, semibold).
  - Snippet (2–3 lines, muted).
  - URL on the bottom in muted micro-type.
- Tooltip is hover-delayed ~120 ms, dismisses on mouse-leave with ~80 ms fade.

### 5.3 Click behavior
- Click opens the source URL in a **new browser tab** (`target="_blank"`, `rel="noopener"`). It does not open a side panel.
- A "References" list may also appear at the bottom of long responses, numbered to match the inline chips. `[inferred]`

---

## 6. Artifact panel mechanics

### 6.1 Open trigger
Assistant produces a renderable output (HTML, React/JSX component, SVG, Mermaid diagram, Markdown document longer than ~20 lines, code that produced a preview). The chat inserts a **clickable artifact card** in place of the inline content — title + tiny icon + "Open" affordance — and the right-side panel slides in.

### 6.2 Layout transition
- Chat column compresses from ~720 px max-width to ~480 px and **shifts left**.
- Artifact panel slides in from the right edge, ~50% viewport width on desktop (resizable via a vertical drag handle on its left edge `[inferred]`), full-height.
- Transition duration ~220 ms, ease-out.

### 6.3 Panel header
Left-aligned: artifact title (editable on click `[inferred]`).

Center: tab strip — **Preview**  /  **Code**  (and on apps with console output, **Console**). Active tab uses brand-terra-cotta underline + bolder weight.

Right-aligned action cluster (left to right):
- **Copy** (copies code regardless of which tab is active).
- **Download** (saves the artifact as the appropriate file type).
- **Publish / Share** — opens the share dialog (§6.5).
- **Version history** — small `‹ N / M ›` pager at the bottom of the panel `[inferred]`, or button that opens a flyout listing versions.
- **Close (×)** — top-right corner; collapses the panel and re-expands the chat to full width.

### 6.4 Inside-artifact actions
- **Highlight to revise**: select any text or element inside the artifact (in either Preview or Code tab) and a small floating toolbar appears with two buttons:
  - **Improve** — opens a small textarea where the user types what to change; on submit, Claude regenerates only the selected region (inpainting). Faster than full regeneration.
  - **Explain** — Claude writes an explanation in the main chat thread (not in the panel).
- Each edit creates a new version reachable via the version-history pager.

### 6.5 Publish/Share dialog
- Modal centered, width ~480 px.
- Body copy: brief description + the generated public URL in a read-only input + **Copy link** button.
- **Get embed code** secondary button → opens a second modal with an `<iframe>` snippet and an **Allowed domains** field (comma-separated URL list).
- **Unpublish** button (muted/destructive) at the bottom of the dialog after first publish. Warning copy: *"Once you unpublish an artifact, you cannot publish that same artifact again."* Unpublishing also deletes any persistent-storage data tied to the artifact.
- For Team/Enterprise: a different **Share** path that restricts access to the org only.

### 6.6 Close behavior
- Pressing `×` collapses the panel and the chat re-expands to full width (~220 ms reverse transition).
- The artifact card stays inline in the chat as a chip — clicking it re-opens the panel to the latest version.
- The artifact persists for the life of the chat regardless of how many times you toggle the panel.

---

## 7. File attach flow (the `+` button)

### 7.1 Click behavior
The `+` button on the bottom-left of the composer opens a **popover menu** above the button (origin: bottom-left, opens up-and-right).

### 7.2 Menu items (top-down)
1. **Upload from computer** (default file picker).
2. **Add from Google Drive** (requires Connectors setup; opens Drive picker iframe).
3. **Add from GitHub** (requires GitHub integration; opens a repo/file picker).
4. **Add from Gmail** (Pro/Connectors).
5. **Add from Google Calendar** (Pro/Connectors).
6. Divider.
7. **Connectors…** — links to `claude.ai/settings/connectors` for adding more.

The list collapses to just (1) when no connectors are configured.

### 7.3 Drag-and-drop into composer
- Dragging a file over the chat triggers a full-area drop overlay: a dashed terra-cotta border around the entire chat column with centered copy *"Drop files to attach"*. `[inferred from convention]`
- Release attaches the file(s); the overlay fades.

### 7.4 Paste image
- Pasting an image from clipboard inserts it as an attached image thumbnail in the composer (does not paste as text).

### 7.5 Paste long text
- Pasting text longer than a threshold (~2,000–4,000 characters) auto-converts the paste into a **text attachment** rendered as a "Pasted text" chip — visible as a small card with title `Pasted-N.txt`, a character count, and a remove (×). Confirmed via the existence of the "ClaudePaster" Chrome extension built specifically to disable this behavior.

### 7.6 Attached file rendering
- Attachments stack as small cards **above the textarea** inside the composer (still within the bordered composer container).
- Card layout: file-type icon (or 40 px thumbnail for images, blue PDF glyph + page count for PDFs), filename (truncated middle), MIME / size in muted micro-type, `×` remove button top-right of the card.
- Hover on a PDF thumbnail opens a small "quick look" popover showing the first ~5 pages.
- Multiple attachments wrap horizontally; if many, they wrap to a second row.

---

## 8. Streaming state details

### 8.1 Pre-text indicator
- Between Send and first streamed token: a **single pulsing dot** (some builds show three dots) at the start of the assistant bubble, terra-cotta tint, opacity oscillates between ~0.3 and ~1.0 on a ~1 s cycle (custom Claude animation, not a standard CSS pulse — its key-frame source is in Claude Code's bundle).

### 8.2 Streaming cursor
- A 2 px wide solid bar appears at the **tail end** of the currently-streamed text, in terra-cotta or text-color tint. Blink cadence ~500 ms. Disappears as soon as the response is complete. `[inferred — exact color is hard to confirm without a fresh capture]`

### 8.3 Send / Stop button swap
- The composer send button (small dark square with up-arrow) is **replaced** during streaming by a Stop button — same x/y position, same square, but the icon is a centered square (■) and the fill turns slightly lighter (or stays the same and the icon changes).
- assistant-ui's Claude clone documents this exact pattern as a **four-state PrimaryAction**: `Cancel | StopDictation | Send | Dictate`.

### 8.4 After Stop
- The partial response remains in the thread as a normal assistant message.
- The user can immediately type another prompt to continue ("continue", "expand on X"); there is no built-in "Resume" affordance — `[inferred]` no continuation button is rendered.
- A retry icon on the partial message will regenerate the entire turn from scratch.

### 8.5 Network error mid-stream
- An inline error chip appears in place of further tokens: muted card with copy along the lines of *"Something went wrong. Try again."* and a **Retry** button. The partial text already streamed is preserved above the chip.

---

## 9. Sidebar interactions

### 9.1 Row hover
- Each chat row has a hover background (slightly darker stone fill) and reveals a right-aligned **⋯ overflow icon**.

### 9.2 Overflow menu items
On click of ⋯ (or right-click on the row), a small menu opens:
- **Rename**
- **Star** / **Unstar** (label flips based on current state)
- **Move to project…** `[inferred — present when projects feature is enabled]`
- **Delete** (red text, destructive)

### 9.3 Rename
- Two-step flow per the help-center description: opening Rename opens a small dialog (not inline). The dialog has a single text field prefilled with the chat title and a **Save** button. `[corroborated by support article]`
- Renaming can also be triggered by clicking the **chat title at the top of the open chat** — this opens the same options menu (Rename / Delete).

### 9.4 Delete
- Triggers a confirmation dialog. Copy resembles *"Delete this chat? This action cannot be undone."* with **Cancel** + **Delete** (destructive red) buttons. `[inferred from convention; help-center confirms a confirmation step exists]`

### 9.5 Star / Unstar
- Toggle is instant. Starred chats move into the **Starred** section at the top of the sidebar; unstarred chats fall back under **Recents**. No animation beyond the row jumping sections.

### 9.6 Bulk delete
- A separate "Chats" page (full chat history view) supports multi-select via checkboxes that appear on row hover; bulk delete with a single **Delete selected** button at the top.

### 9.7 Drag-and-drop reorder
- **Not supported** in the standard sidebar — chats are auto-ordered by last-activity within their section. `[inferred]`

### 9.8 Search box
- Sits at the top of the sidebar (or as a dedicated search button that expands inline). Typing filters the visible chat list instantly — substring match on chat title; in Pro/Max plans, full-text search across message bodies is available (Memory feature).

### 9.9 Sidebar toggle
- Keyboard: `Ctrl/Cmd + .` toggles the sidebar visibility (confirmed via Claude's own keyboard shortcut docs and multiple third-party extensions).
- Also `Ctrl/Cmd + Shift + S` toggles in some builds.

---

## 10. Composer interactions

### 10.1 Empty state
- No Send button visible. Only the `+` (left), the **model picker** chip (right), and possibly Tools / Style buttons (right).
- Placeholder copy: *"How can I help you today?"* or similar.

### 10.2 After typing
- Send button fades in (right side), small dark filled square with up-arrow icon. ~32 px square, `rounded-md`.

### 10.3 Send semantics
- Optimistic UI: the user message appears immediately in the thread, the composer clears, and a streaming assistant bubble begins below.
- Composer focus stays in the textarea; cursor returns to the now-empty composer immediately after send.

### 10.4 Error state
- On send failure, the user message gets a small red error marker (e.g. red dot + retry icon) and a muted line below saying *"Couldn't send — Retry"*. `[inferred]`

### 10.5 Slash menu
- Typing `/` as the first character of an empty composer opens a small popover menu listing actions — primarily the **Connectors** menu and skills/commands. Confirmed via support docs (*"type "/" to open the menu"*).
- Items are filterable as the user keeps typing.
- `Esc` closes.

### 10.6 `@` mentions
- Not standard in Claude.ai web composer at time of writing. `[inferred]` Files are attached via the `+` button, not via `@`.

### 10.7 Keyboard
- `Enter` → newline (single-line behavior); some users report `Enter` to send — likely a per-platform setting `[inferred]`. Default: `Cmd/Ctrl + Enter` to send.
- `Shift + Enter` → newline (always).
- `↑` on empty composer → edit last user message `[inferred]`.

---

## 11. Keyboard shortcuts — full inventory

Confirmed from Claude.ai's in-product help and multiple guide pages:

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Shift + O` | New chat |
| `Cmd/Ctrl + K` | Quick chat / command palette `[inferred]` |
| `Cmd/Ctrl + .` | Toggle sidebar |
| `Cmd/Ctrl + Shift + S` | Toggle sidebar (alternate, some builds) |
| `Cmd/Ctrl + /` | Show keyboard shortcuts modal |
| `Cmd/Ctrl + Enter` | Send message |
| `Shift + Enter` | Newline in composer |
| `Esc` | Close modal / popover / cancel edit |
| `↑` (empty composer) | Edit last user message `[inferred]` |
| `Tab` (in textarea) | Move focus (does **not** indent) `[inferred]` |

The shortcuts modal is reachable via Profile menu → *Learn more* → *Keyboard shortcuts*, or via `Cmd/Ctrl + /`.

---

## 12. Model picker dropdown

### 12.1 Trigger
- Click the model name + chevron at the composer's bottom-right.

### 12.2 Dropdown layout
- Width ~340 px, `rounded-xl`, soft elevation, opens **upward** (origin: bottom-right).
- Each row ~64 px tall:
  - **Model name** in semibold (e.g. "Sonnet 4.6").
  - **One-line description** under the name in muted (e.g. "Smart, efficient model for everyday use").
  - **Checkmark** right-aligned on the currently-selected model.
- Subtle row hover (warm stone tint).

### 12.3 Descriptions (verbatim from Claude's own docs)
- **Haiku** — "Fast and lightweight. Built for everyday requests" (use-case copy).
- **Sonnet** — "The daily driver. Strong reasoning for coding, writing, analysis, research."
- **Opus** — "Large reasoning specialist. Reserved for problems that need deep thinking."

### 12.4 Categories
- A single flat list. No section headers in the dropdown itself.
- Footer link: **More models / Compare models** → opens Anthropic's models comparison page. `[inferred]`

### 12.5 Close
- Click outside or pressing `Esc`.

---

## 13. Account / profile menu (avatar bottom-left of sidebar)

### 13.1 Trigger
- Click your initials avatar in the bottom-left corner.

### 13.2 Menu items
Opens upward, ~240 px wide, soft elevation:
- Account name + email block at top.
- **Settings**
- **Plans & Billing** → `claude.ai/settings/billing`
- **Learn more** → expands to a submenu (Keyboard shortcuts, Help center, What's new) `[inferred]`
- **Privacy & data**
- **Log out** (separated from rest by a divider)

---

## 14. Settings modal

### 14.1 Layout
- Modal centered, width ~880 px, height ~640 px.
- Left rail (~220 px) lists sections; right pane shows the active section content. Standard SaaS settings pattern.

### 14.2 Sections (left rail)
- **Account** — email, plan, sign-out.
- **Profile** — name, occupation, "What should Claude know about you?" (custom instructions), "What traits should Claude have?".
- **Appearance**:
  - Color mode — radio: **Light** / **Match System** / **Dark**.
  - Chat font — radio: **Default** / **Match System** / **Dyslexic Friendly**.
- **Capabilities** / **Memory** — toggle memory, manage learned facts.
- **Connectors** — Drive / GitHub / Gmail / Calendar etc.
- **Notifications** `[inferred]`
- **Data controls** / **Privacy** — model training opt-out, delete account, delete all chats.
- **Claude Code** — auth tokens.

### 14.3 Save behavior
- Most fields autosave on blur with a small muted *"Saved"* line. `[inferred]`

---

## 15. Toast / notifications

- Position: **bottom-center** on desktop; bottom-safe-area-pad on mobile.
- Single dark pill, ~14 px text, white copy, ~12 px horizontal padding, soft shadow.
- Default duration: 3 s. Dismissible with the X glyph at the right end of the pill.
- Used for: link copied, feedback submitted, error states. `[inferred — Claude is sparing with toasts; many actions confirm inline instead]`

---

## 16. Hover affordances on assistant messages (beyond the action bar)

### 16.1 Highlight to quote
- Selecting any text inside an assistant message **does not** open a "quote / ask about this" tooltip in claude.ai standard chat (this is an Artifact-only feature; see §6.4).
- Inside an Artifact panel, selecting text shows the floating **Improve / Explain** toolbar.

### 16.2 Long-press on mobile
- Same options as the hover action bar appear in a long-press context menu. `[inferred]`

---

## 17. Empty state suggestion chips

Below the empty-state composer on a new chat, Claude shows a row of **mode tabs**: **Write · Learn · Code · Life stuff** (or similar — the exact taxonomy has varied across releases and now sometimes includes **From Drive**, **Cowork**, etc.). Each tab swaps the visible chip row to a set of category-specific seed prompts.

### 17.1 Tab behavior
- Active tab gets a terra-cotta underline + bolder weight.
- Switching tabs swaps the chip row with a small cross-fade. No prompt is sent until a chip is clicked.

### 17.2 Chip click
- Click a chip → pre-fills the composer textarea with the chip's seed prompt (it does **not** auto-send). The user can edit before pressing Send. `[inferred]`
- For chips like "Summarize a doc from Drive", clicking opens the Drive picker first, then pre-fills the prompt referencing the picked file.

---

## 18. New-chat vs continuation behavior

- Clicking the **Start a new chat** button (top of sidebar) or pressing `Cmd/Ctrl + Shift + O`:
  - Clears the chat column to the empty state.
  - **Closes any open artifact panel** (resets to full-width chat).
  - Does NOT clear the model picker selection — the new chat inherits the user's last-used model.
- Typing in the sidebar **search field** filters the chat list — it does **not** start a new chat. Sidebar search and the composer are entirely separate inputs.
- If the chat is inside a Project, "New chat" creates a new chat **within the same project** by default (project context inherited). Leaving the project requires explicit navigation.

---

## 19. Memory / Projects (chat-surface indicators)

### 19.1 Memory chip
- When Claude pulls context from past chats via the Memory feature, a small **Referenced past chats** chip or pill appears near the top of the relevant assistant message, listing the source chat names. Hover/click expands details. `[inferred from XDA/Simon Willison write-ups]`
- A separate memory icon may sit in the composer area indicating "Memory is on for this chat."

### 19.2 Project chip
- When the current chat is inside a Project, a project-name pill appears in the **top bar above the chat** (near the chat title), styled in muted terra-cotta. Clicking it returns to the project page.
- Project instructions are silent — there is no per-message indicator showing they applied.

---

## 20. Errors and recovery

### 20.1 Rate-limit error
- Inline assistant message with terra-cotta error tint and copy: *"You have exhausted this model's rate limit. Please wait a moment, or switch to a different model."*
- Often surfaces a **Switch to Haiku** (or lower-tier model) chip as a one-click recovery.
- Composer remains enabled.

### 20.2 Network drop mid-stream
- Inline retry chip at the end of the partial response (see §8.5).

### 20.3 File upload failed
- The attachment card in the composer turns red-tinted with copy *"Couldn't upload — Retry"* and a retry icon. Removing it (×) clears the failure.

### 20.4 Refusal
- A refusal is not an error — it is a normal assistant turn explaining why the request can't be fulfilled. No special styling; just text. The thumbs-down popover is the recovery path if the refusal was wrong.

### 20.5 Service-wide outage
- Anthropic surfaces a banner at the top of the app (and on `status.anthropic.com`). Recent outages (e.g. March 25, 2026) have used this banner pattern.

---

## 21. What the previous spec already covered well

For everything below, defer to **`CLAUDE-CHAT-SPEC.md`** — no need to re-detail here:

- Surface colors, dark/light palettes, terra-cotta brand token.
- Body / header / monospace typography stacks.
- Chat column max-widths, paddings, and message bubble dimensions.
- Composer chrome at rest (border, radius, padding).
- Action bar icon order and resting visibility.
- Sidebar widths and overall page grid.

The present document is purely the **behavioral overlay** on top of that visual shell.

---

## 22. Sources

1. assistant-ui Claude clone example (definitive React structure for many interactions, composer four-state, hover-only bars) — https://www.assistant-ui.com/examples/claude
2. assistant-ui Branching docs (BranchPicker, edit-creates-branch pattern) — https://www.assistant-ui.com/docs/guides/Branching
3. Smith Stephen — *Conversation Branching: The AI Feature Most Executives Don't Know About* — https://www.smithstephen.com/p/conversation-branching-the-ai-feature
4. Smith Stephen — *Fork Your AI Conversations: Why Power Users Branch Their Chats* — https://www.smithstephen.com/p/fork-your-ai-conversations-why-power
5. Medium — *The Hidden Claude Feature That Most People Are Wasting* — https://medium.com/@choudhary.man/the-hidden-claude-feature-that-most-people-are-wasting-2907b18f3410
6. Guideflow tutorial — *How to give negative feedback on a response in Claude.ai* — https://www.guideflow.com/tutorial/how-to-give-negative-feedback-on-a-response-in-claudeai
7. Claude Help Center — *Publishing and sharing artifacts* — https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts
8. Claude Help Center — *Use artifacts to visualize and create AI apps* — https://support.claude.com/en/articles/11649427
9. Claude Help Center — *How can I delete or rename a conversation?* — https://support.claude.com/en/articles/8230524
10. Claude Help Center — *Customizing your appearance settings* — https://support.claude.com/en/articles/8887527
11. Claude Help Center — *Use Claude's chat search and memory* — https://support.claude.com/en/articles/11817273
12. Claude Help Center — *When should I use web search, extended thinking, and Research?* — https://support.claude.com/en/articles/11095361
13. Claude Help Center — *Configure and use styles* — https://support.claude.com/en/articles/10181068
14. Claude Help Center — *Using the Google Drive integration* / Connectors — https://support.claude.com/en/articles/10166901
15. Claude Help Center — *Set up Claude integrations* — https://support.claude.com/en/articles/10168395
16. Claude Help Center — *Upload files to Claude* — https://support.claude.com/en/articles/8241126
17. Tom's Guide — *Claude Artifacts get a big update — now you can highlight and edit code with text* — https://www.tomsguide.com/ai/claude-artifacts-get-a-big-update-now-you-can-highlight-and-edit-code-with-text
18. Hyperdev / Matsuoka — *Claude.AI's quiet revolution in artifact editing* — https://hyperdev.matsuoka.com/p/claudeais-quiet-revolution-in-artifact
19. Vox Silva — *Claude Code's thinking animation* — https://blog.alexbeals.com/posts/claude-codes-thinking-animation
20. Anthropics/claude-code GitHub issue #59029 — *Conversation branching from sidebar* — https://github.com/anthropics/claude-code/issues/59029
21. Anthropics/claude-code GitHub issue #48641 — *Click-to-copy affordance on code blocks* — https://github.com/anthropics/claude-code/issues/48641
22. ClaudePaster GitHub repo — *Tired of long text inputs auto-converting to attachments* (confirms paste-as-attachment behavior) — https://github.com/unclecode/claude-paster
23. Guideflow — *How to rename / delete / star / unstar a chat in Claude.ai* (series) — https://www.guideflow.com/tutorial/how-to-rename-a-chat-from-the-sidebar-in-claudeai (and sibling tutorials)
24. Guideflow — *How to view keyboard shortcuts in Claude.ai* — https://www.guideflow.com/tutorial/how-to-view-keyboard-shortcuts-in-claudeai
25. Albato — *Claude Artifacts: What They Are and How to Use Them (2026)* — https://albato.com/blog/publications/how-to-use-claude-artifacts-guide
26. Codecademy — *How to Use Claude Artifacts: Create, Share, and Remix AI Content* — https://www.codecademy.com/article/how-to-use-claude-artifacts-create-share-and-remix-ai-content
27. ShareDuo — *Claude artifacts: the complete guide (April 2026)* — https://www.shareduo.com/blog/claude-artifacts
28. Zapier — *How to use Claude Artifacts* — https://zapier.com/blog/claude-artifacts/
29. Ambassadors4AI — *Lesson 2: Navigating the Claude Interface* — https://www.ambassadors4ai.com/tutorials/lesson.php?model=claude&number=2
30. DataStudios — *Claude and PDF Documents: Technical Complete Overview* (confirms PDF blue thumbnail + page count + 5-page quick look) — https://www.datastudios.org/post/claude-and-pdf-documents-technical-complete-overview
31. claude.ai keyboard shortcut chrome extension repos confirming `Cmd+Shift+O`, `Cmd+.`, `Cmd+/` shortcuts — https://github.com/OneUne/claude-keyboard-shortcuts ; https://github.com/A-PachecoT/claude_ui_shortcuts
32. Storylane — *How to Search Chats in Claude: 1-Min Guide* — https://www.storylane.io/tutorials/how-to-search-chats-in-claude
33. Anthropic engineering — *April 23 postmortem* (banner / outage UX) — https://www.anthropic.com/engineering/april-23-postmortem
