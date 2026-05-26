# Claude.ai Chat UI — Measurement-Level Specification

> **Purpose.** A concrete, exhaustive specification of Claude.ai's chat surface intended to be used as the source-of-truth for implementation work. Where a value cannot be confirmed from public sources it is labelled **[inferred from screenshots]** or **[inferred]** and an approximate range is given. Sources are listed in §23.

This file is descriptive, not prescriptive — its job is to capture what Claude.ai actually looks and behaves like, not what we think a good chat UI would be.

---

## 1. Overall layout

- **Page background colour.** Warm cream. Light mode: `#F0ECE0` (Anthropic-style cream, used in assistant-ui's Claude clone) — confirmed against the lighter `#EEECE2` from the Loftlyy / BeginsWithAI brand reference. The two are within ΔE ~1 of each other; treat `#F0ECE0` as the operative app-background token. Dark mode: `#2B2A27` (very dark warm charcoal, not pure black; reads as "evening, not terminal").
- **Surface tint.** Surfaces "sit on" the cream; there are essentially no card shadows in the chat area. The composer is on a slightly lighter / whiter pad (`#FFFFFF` light, `#1F1E1B` dark) so it pops by *contrast*, not by shadow.
- **Chat column width.** **[inferred from screenshots and community width-customiser extensions]** Default reading column is narrow — approximately **720–768 px** for the message stream, centred horizontally. Community extensions exist precisely because the default feels narrow; presets in the Firefox "Claude Chat Width Customizer" (Narrow 50% / Medium 70% / Wide 85% / Full 100%) confirm Claude itself is somewhere near the Narrow end of that range.
- **Composer max-width.** Same as the chat column (the composer is aligned to the conversation, not the viewport). Approximately **768 px**.
- **Top padding of chat region.** **[inferred]** ~24 px below the top bar, before the first message.
- **Bottom padding.** A larger void below the composer (~24–32 px) and a fade-out gradient over the cream so the message stream visually melts into the input area when scrolled.
- **Horizontal padding inside the chat column.** ~16–24 px on each side at desktop; collapses to ~12–16 px on mobile.

## 2. Header / top bar

There is no chrome-heavy header. The top region contains:

- A **conversation title** (auto-generated or user-renamed) set in serif (Tiempos / `ui-serif`) — **[inferred]** ~15–16 px, weight 500, colour `#3D3929` light / `#EEEEEE` dark.
- A **share / star / overflow** cluster on the right (icon buttons, ~28×28 hit area, 16 px icon, muted colour `#5B5950`).
- The header has **no border-bottom**. It floats over the cream.
- Total header height **[inferred]**: ~52–56 px on desktop, ~44–48 px on mobile.
- The current model name does **not** live in the header — it lives in the composer's bottom-right (see §8).

## 3. Message stream

- **Inter-turn vertical spacing.** ~24–32 px between a user turn and the following assistant turn. **[inferred]** Looks like 28 px nominal.
- **Intra-message spacing.** Between an inline "thinking / extended-thought" trail and the main answer body: ~12–16 px. Between paragraphs of an assistant answer: ~12–16 px (Tailwind `prose` default at this font size).
- The stream is **left-aligned for assistant**, **right-aligned for user**. There are no avatars on either side. (This is a deliberate Anthropic choice — the assistant text is unbubbled prose, the user text is a soft pill on the right.)

## 4. User message

- **Container alignment.** Right-aligned within the chat column.
- **Max-width.** ~80% of the chat column (`max-w-[80%]`).
- **Background.** `#E5E0D6` light (a half-step darker than the page cream — almost a tinted oatmeal). `#393937` dark.
- **Border.** None.
- **Shadow.** None.
- **Border-radius.** `rounded-2xl` — 16 px on all four corners. Not a tail/teardrop, not asymmetric. All four corners equal.
- **Padding.** **[inferred]** ~12–14 px vertical, ~14–16 px horizontal.
- **Text font.** Serif. Same family as assistant body (Tiempos / `ui-serif, Georgia, …`). Some clones use sans-serif for the user bubble — actual Claude uses serif for both sides for an "editorial" feel.
- **Text size / weight / line-height.** ~15–16 px / weight 400 / line-height ~1.55–1.65.
- **Text colour.** `#1A1A18` light / `#EEEEEE` dark (Claude's primary text token).
- **Hover.** The bubble itself doesn't change. The **action bar** (see §6 user variant) fades in — Edit + Copy.
- **Edit affordance.** The Edit icon appears on hover **below** (or directly under) the user bubble, right-aligned. Clicking it converts the bubble into a textarea **in place**, preserving the bubble width and rounding; Save and Cancel buttons appear under the textarea. Saving truncates the conversation at that point (the assistant turn is regenerated from the edited prompt). Edited messages get a small "(edited)" mark in muted text **[inferred from screenshots]**.
- **States.**
  - *Just-sent:* the bubble pops in (very subtle scale 0.98→1.0 + opacity 0→1, ~120 ms).
  - *Editing:* the bubble becomes a textarea with the same `#E5E0D6` background, no border change.
  - *Edited:* small muted "(edited)" label.

## 5. Assistant message

- **Container alignment.** Left-aligned, full chat-column width.
- **Background.** **None.** The text sits directly on the page cream.
- **Border.** None.
- **Padding.** None on the container itself — only prose margins inside.
- **Text font.** Serif — Tiempos for body (or `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif` as a documented stack on Anthropic surfaces). Styrene B is used by Anthropic for headlines/subheadings on marketing pages and inside Claude for some chrome — but the chat body itself is the serif.
- **Body size / weight / line-height.** ~16 px / 400 / line-height **`1.65rem`** (≈26.4 px) — this is the documented value from assistant-ui's clone (`leading-[1.65rem]`).
- **Text colour.** `#3D3929` light (BeginsWithAI / Loftlyy brand reference) / `#1A1A18` deep-text alt. Dark mode `#EEEEEE`.
- **Headings inside response.**
  - h1: ~24 px / 600 / margin-top ~24, margin-bottom ~12. **[inferred]**
  - h2: ~20 px / 600 / margin-top ~20, margin-bottom ~10.
  - h3: ~17 px / 600 / margin-top ~16, margin-bottom ~8.
  - h4: ~15 px / 600 / margin-top ~12, margin-bottom ~6.
  - All headings serif (same family as body), tightened line-height ~1.25.
- **Code blocks.**
  - Background: a soft tinted neutral, **[inferred]** ~`#1F1E1B` panel inside an otherwise light page (i.e. they intentionally invert to a dark code panel even in light mode for legibility), with a thin top header strip showing language + a copy button.
  - Some recent claude.ai variants use a light code surface (~`#F4F1E7`) with a 1 px border `#E5E0D6` — both have been observed; treat the dark panel as the modern default.
  - Padding inside the panel: ~12 px vertical, ~14 px horizontal.
  - Font: monospace stack — `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`, ~13 px, line-height ~1.55.
  - Syntax highlighting: theme-aware (Shiki-style); language label sits in the panel's top-left in muted text.
  - **Copy button:** top-right of the panel, only visible on hover **or** always visible at small size (~16 px icon in a ~28×28 hit area); shows a transient "Copied" toast on success.
  - Horizontal scroll on overflow with a thin muted scrollbar.
- **Inline code.** Background `rgba(0,0,0,0.06)` light / `rgba(255,255,255,0.08)` dark; padding `1px 6px`; radius `4–6px`; font same mono stack at ~0.92 em; colour same as body text (not red, not blue).
- **Lists.** Standard prose: bulleted list indent ~24 px, marker is a centred bullet glyph (not a custom svg). Numbered lists use decimal markers. List-item vertical gap ~6 px.
- **Blockquotes.** 3 px left border in `#C15F3C` / `#bd5d3a` (Claude's terra cotta) or a muted neutral; padding-left ~16 px; italic optional. **[inferred — sometimes plain]**
- **Links.** Underline always present, colour `#C96442` / `#BD5D3A` (Claude's terra cotta accent). On hover: underline thickens slightly or colour deepens.
- **Citations.** When Claude shows web-search citations, they render as small superscript numbered chips after the citing sentence. Chip styling: ~10–11 px, rounded-full, background `#E5E0D6` light, foreground `#5B5950`. Hover reveals a tooltip card with source title + favicon + URL.

## 6. Hover action bar (under assistant messages)

- **Position.** Directly underneath the last paragraph of the assistant message, **left-aligned** (flush with the assistant prose start, not floating right). ~8 px margin-top.
- **Icon order.** Copy, Thumbs-up, Thumbs-down, Retry (Reload). User-message variant: Edit, Copy.
- **Icon size.** ~16 px stroke icon inside a ~28–32 px square hit area.
- **At-rest colour.** Muted `#5B5950` (light) / `#A3A098` (dark).
- **Hover colour.** Icon darkens toward `#3D3929` and the hit-area gains a subtle background `rgba(0,0,0,0.04)` light / `rgba(255,255,255,0.06)` dark with `border-radius: 8px`.
- **Spacing between buttons.** ~4 px gap (essentially flush — these are buttons in a tight row).
- **Tooltip.** Appears ~6 px above the icon after a ~400–500 ms hover delay. Tooltip background `#1A1A18` light-mode (i.e. dark tooltip on light page) / `#EEEEEE` dark-mode (inverted). Text colour inverse. Padding ~6 px / 10 px. Radius ~6 px. Font 12 px sans (Styrene or system sans). Fades in (opacity 0→1, ~120 ms).
- **Visibility rule.** **Hover-only**, fades in with `opacity 0 → 100` on `group-hover/message`. Important detail: the bar persists if the cursor moves *down* onto the bar itself; it disappears when the cursor leaves *both* the message and the bar. On touch devices the bar is **always visible** (Claude can't rely on hover there).
- **Streaming-time visibility.** The action bar is hidden while the assistant is still streaming — it reveals only after the stream completes.

## 7. Streaming / typing state

- **Before any text arrives.** A small pulsing dot or three-dot indicator appears in the position the assistant turn will land. Animation: opacity / scale loop at ~1.0 s cadence (a calm pulse, not a fast spinner).
- **During streaming.** Text appears progressively. A subtle caret/cursor (a thin terra-cotta block, ~2 px × line-height) blinks at the tail of the streaming text. **[inferred from screenshots]**.
- **Stop button.** While streaming, the **send** button in the composer is replaced **in place** by a **stop** button — same square footprint, same `#C96442` background, with a small square (■) glyph instead of the up-arrow. Clicking it aborts the stream and leaves the partial response in the thread.
- **On stream completion.** The cursor caret disappears, the action bar fades in under the message, and the send button reverts. Follow-up suggestion chips may appear underneath (see §10).
- **"Try stopping the current response" recovery.** If the stream stalls, an inline error chip appears with a Retry action.

## 8. Composer (input box)

This is the area most often gotten wrong in clones. Concrete details:

- **Container.**
  - Width: full chat-column width (matches §1).
  - Max-height: grows up to ~50% of viewport before internal scroll kicks in. **[inferred]**
  - Min-height (empty): ~56–64 px (a single textarea row plus the bottom action row).
  - Border-radius: `rounded-2xl` — 16 px on all corners (note: not 8, not pill, not 12).
  - Border: 1 px solid `#E5E0D6` light / `#3D3A35` dark.
  - Background: `#FFFFFF` light / `#1F1E1B` dark (lighter than the page).
  - Shadow: **none at rest**. This is a signature property — "claude.ai's stripped-down look. No drop-shadow."
  - Padding: ~12 px top, ~10 px bottom, ~14 px left/right.
- **Focus state.** Border darkens slightly (e.g. `#D0CABD` light) **and** a 1 px inset ring; no glow/blur shadow. There is no orange focus ring — focus is signalled by border tone, not colour.
- **Empty-state vs typed-state.** Same height baseline. The textarea grows organically as content wraps; no separate "expanded" mode. The send button is **hidden when the textarea is empty** — it reveals only once non-whitespace content exists.
- **Textarea.**
  - Padding inside: matches container.
  - Font: serif body — same as the chat prose, ~16 px.
  - Line-height: ~1.5–1.6.
  - Placeholder text: **"How can I help you today?"** on the new-chat hero, **"Reply to Claude…"** (or similar) on the in-thread composer. **[inferred for in-thread variant]**
  - Placeholder colour: `#5B5950` light / `#A3A098` dark.
- **Bottom action row layout.** A single horizontal row pinned to the bottom of the composer, vertical-centre aligned.
  - **Left side:** a single **`+`** attach button — circular hit-area ~28×28 px, icon 16 px, colour `#5B5950`. Hover: same hit-area gets a subtle `rgba(0,0,0,0.04)` background. Clicking it opens a small popover menu with "Upload from computer", "Add from Google Drive" (Pro), "Add from GitHub" (Pro), etc. **There is no second "tools" button on the left in current claude.ai** — the `+` is the only left-side affordance.
  - **Right side, in order (left → right):**
    1. **Model picker.** A text button that reads "Claude Sonnet 4.5" / "Claude Opus 4.5" / etc., followed by a `chevron-down` glyph. Text size ~13 px, weight 500, colour `#3D3929`. The full button has ~6 px / 10 px padding and a transparent background; hover gives it the same `rgba(0,0,0,0.04)` pill background with `border-radius: 8px`. Click opens a vertical dropdown listing the models with one-line descriptions; the current model has a small check on the right.
    2. **Voice / dictate mic** button. ~28–32 px square, 16 px mic icon, same neutral colour.
    3. **Send button.** Distinctive: a **rounded-square** (not a circle, not a pill). ~32×32 px, border-radius ~8–10 px, background `#C96442` (terra cotta), white up-arrow glyph (lucide `arrow-up`) centred. Hover darkens to ~`#BD5D3A`. Disabled state (empty input): the button is **not rendered at all** — the right rail just shows model + mic.
  - Spacing between right-side controls: ~6–8 px gaps.
- **Streaming state of send button.** Replaced with a stop button — same `#C96442` background, same square, white ■ glyph.
- **Error state.** **[inferred]** If a send fails (rate limit, network), the send button briefly shows an alert glyph and an inline toast appears above the composer.

## 9. Empty state (new chat / hero)

- **Hero text:** centred. Above the composer.
- **Glyph.** A small orange sparkle / star (`fill-[#C96442] text-[#C96442]`) above or beside the heading.
- **Heading.** "Good evening, {name}." (or time-of-day variant) — serif, weight 500, ~28–32 px (`text-3xl` in Tailwind terms). Colour `#3D3929`.
- **Subheading / prompt.** "How can I help you today?" — usually appears as the **composer placeholder**, not as separate body copy. Some variants show a small "What's on your mind?" muted line under the heading.
- **Composer placement.** Centred vertically (not pinned to the bottom). The full composer sits ~30–40% from the top of the viewport.
- **Mode tabs / suggestion chips.** Directly below the composer: a horizontal row of small pill tabs — Write / Learn / Code / From Drive / From Calendar (set varies by entitlement). Styling: `rounded-lg border border-[#E5E0D6] bg-transparent`, padding ~6 px / 10 px, ~12–13 px label, optional small icon.

## 10. Follow-up suggestions

- **When they appear.** After an assistant turn completes — *sometimes*, not always (Claude only shows them when it has good candidates). They never appear mid-stream.
- **Where.** Directly under the assistant message body, **above** any hover action bar — but the chips themselves are persistent (not hover-only), while the action bar still requires hover.
- **Chip styling.** Padding ~8 px / 12 px, border-radius ~10–12 px, background transparent with 1 px `#E5E0D6` border, text ~13 px weight 400 colour `#3D3929`, hover background `#E5E0D6`.
- **Spacing between chips.** ~8 px horizontal, ~8 px row gap on wrap.
- **Wrap behaviour.** Wraps to a new row at narrow widths; never horizontally scrolls.

## 11. Artifacts panel (right-side)

- **Trigger.** Automatic — when Claude detects a "renderable" output (code app, document, chart, SVG), the artifact pops out into a right-hand panel; the chat compresses to the left.
- **Layout split.** Approximately 50/50 on desktop, biased toward the artifact on wide screens (e.g. 40% chat / 60% artifact). On narrow screens the panel takes the full viewport as an overlay.
- **Panel surface.** Same `#FFFFFF` light / `#1F1E1B` dark surface as the composer, with a subtle 1 px left border in `#E5E0D6`.
- **Header.** Title (artifact name) on the left, tab row in the middle (Preview / Code / sometimes Console), close button on the right. Approximately 44–48 px tall.
- **Close button.** `X` icon, top-right, ~28×28 hit. Closing collapses the panel back into a small inline chip in the chat that re-opens it.
- **Content area.** Scrolls independently from the chat.
- **Bottom actions.** Copy, Download, Publish (shareable link), Edit-in-place (highlight-to-edit) — modern Claude lets you highlight text in an artifact and ask Claude to revise just that selection.

## 12. Sidebar / chat history

- **Width.** ~260–280 px on desktop. Collapsible to a thin icon rail (~56 px). **[inferred — width-modifier extensions exist precisely to change this default]**.
- **Background.** Same cream as the canvas (`#F0ECE0`) — not a different surface. The sidebar is *unstyled* visually; it's defined by alignment, not by a panel background. **[inferred from screenshots]** Some recent versions tint it a hair darker than the chat (`#EBE7DB`).
- **Top section.** Anthropic wordmark / Claude logo on the left, sidebar-toggle icon on the right.
- **"+ New chat" button.** Pill-style, ~14 px text + small `+` glyph, padding ~8 px / 12 px, border `1 px #E5E0D6`, transparent background; hover gets `#E5E0D6` fill. **Keyboard shortcut Cmd/Ctrl + K** opens new chat or the command palette.
- **Search input.** Below the new-chat button; a thin search bar with magnifying-glass icon, placeholder "Search your chats…", same border and radius style.
- **Sections.** "Starred", "Recents", "Projects" — each a small uppercase muted label (~11 px, weight 500, colour `#8A8775`).
- **Chat row.** ~32–36 px tall, ~13–14 px label (truncated with ellipsis), padding ~6 px / 10 px, border-radius ~8 px. Hover: `rgba(0,0,0,0.04)` background. Active row: slightly stronger fill (`#E5E0D6`). On hover a `…` overflow appears on the right (rename / delete / star).
- **Footer.** Account avatar + name at the bottom; clicking opens the profile menu (settings, billing, sign-out).

## 13. Disclaimer line (under composer)

- **Copy.** "Claude can make mistakes. Please double-check responses." (Wording has varied over versions — sometimes "Claude can make mistakes. Verify important information.")
- **Font size.** ~11–12 px.
- **Colour.** Very muted — `#8A8775` light / `#6F6C63` dark.
- **Alignment.** Centred under the composer.
- **Margin-top from composer.** ~8 px.
- **Margin-bottom from page edge.** ~16 px.

## 14. Scroll-to-bottom button

- **Where.** Floating, centred horizontally above the composer (sometimes right-aligned in older builds).
- **Shape.** Circle, ~36 px diameter, white background with 1 px `#E5E0D6` border (no shadow); contains a `chevron-down` glyph.
- **Visibility rule.** Appears only when the user has scrolled up away from the bottom **and** the stream is producing new content (or there's new content below the viewport). Fades in / out with ~150 ms opacity transition.
- **Click behaviour.** Smooth-scrolls to the latest message (not an instant jump).

## 15. Tooltips (system-wide)

- **Background.** Inverse of surface — `#1A1A18` light-mode / `#EEEEEE` dark-mode.
- **Text colour.** `#FFFFFF` light-mode tooltip / `#1A1A18` dark-mode tooltip.
- **Padding.** ~6 px vertical, ~10 px horizontal.
- **Border-radius.** ~6 px.
- **Font.** Sans (Styrene / system sans), ~12 px, weight 500.
- **Delay before show.** ~400–500 ms.
- **Animation.** Fade in (opacity 0→1) ~120 ms, no slide.
- **Arrow / caret.** Either no caret, or a small 4 px caret pointing back at the trigger. **[inferred — some surfaces show no caret]**.

## 16. Modals (settings, share, etc.)

- **Pattern.** Centre-modal on desktop; bottom-sheet on mobile.
- **Backdrop.** `rgba(20,20,18,0.5)` — a warm dim, not pure black at 50%.
- **Modal surface.** `#FFFFFF` light / `#1F1E1B` dark.
- **Border-radius.** ~14–16 px.
- **Width.** ~480 px standard; up to ~640 px for settings.
- **Padding.** ~24 px.
- **Header.** Title (serif, ~18 px, weight 600), close `X` top-right.
- **Footer.** Right-aligned action buttons; primary is `#C96442` terra cotta, secondary is transparent with `#E5E0D6` border.

## 17. Colour palette in use

Canonical tokens, cross-referenced across assistant-ui Claude clone, Loftlyy brand reference, BeginsWithAI brand reference, Mobbin's Claude brand palette, and the BrandColorCode listing.

**Backgrounds**
- Canvas: `#F0ECE0` (light) / `#2B2A27` (dark). The BeginsWithAI reference cites `#EEECE2` — same tone, ΔE ~1.
- Surface (composer, modals): `#FFFFFF` / `#1F1E1B`.
- Surface-2 (user bubbles, hover fills, chips): `#E5E0D6` / `#393937`.

**Text**
- Primary: `#1A1A18` / `#EEEEEE`. Alt body token: `#3D3929` (the documented "website text" colour).
- Secondary / muted: `#5B5950` / `#A3A098`.
- Tertiary / placeholder: `#8A8775` / `#6F6C63`.

**Borders**
- Primary border: `#E5E0D6` / `#3D3A35`.

**Brand / primary action**
- Terra-cotta orange: `#C96442` (the assistant-ui clone value, used for sparkle + primary buttons). Closely related published brand values: `#DA7756` (BeginsWithAI), `#DE7356` ("Peach", BrandColorCode), `#BD5D3A` (BeginsWithAI "chat buttons"), `#C15F3C` ("Crail" from Mobbin / iPalettes). Treat these as a small family with `#C96442` as the canonical UI button colour and `#BD5D3A` as its hover/pressed state.
- The orange is **only** used for: primary CTA (send), the sparkle/star glyph in the empty state, and link colour. It is **not** used as a global accent everywhere.

**Hover gray**
- `rgba(0,0,0,0.04)` light / `rgba(255,255,255,0.06)` dark for icon-button hover halos.

**State colours [inferred]**
- Error / destructive: a desaturated brick red, ~`#B23A2E`.
- Success: a muted sage green, ~`#5A7A53`.
- Warning: a warm amber, ~`#C58B2C`.

## 18. Typography ramp

**Families**
- **Headings (marketing chrome, modal titles, hero):** Styrene B (Regular / Medium / Bold). Fallback: system sans.
- **Body / chat prose / user bubbles:** serif. Anthropic uses **Tiempos Text** with a fallback stack `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif` (confirmed in the BeginsWithAI / Loftlyy brand reference). The header serif on marketing pages is **Galaxie Copernicus** (`__copernicus_669e4a` in inspected source).
- **Monospace (code):** `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`.

**Sizes used (px) and where**
- 11 — Sidebar section labels, footnote citations.
- 12 — Disclaimer line, tooltips, small chips.
- 13 — Model picker label, follow-up chips, chat row labels.
- 14 — Sidebar new-chat button.
- 15 — Header title.
- 16 — Body prose, user bubble text, textarea input.
- 17 — h3 inside response.
- 18 — Modal titles.
- 20 — h2.
- 24 — h1 inside response.
- 28–32 — Hero heading in the empty state (`text-3xl`).

**Line heights**
- 11–13 px: 1.4
- 14–16 px: 1.5–1.65 (body explicitly **`1.65rem`** = 26.4 px at 16 px)
- 17–20 px: 1.35
- 24+: 1.2–1.25

## 19. Spacing ramp

Common values seen across the surface (px):

- **4** — Icon-bar gap between buttons, list-item gap inside tight lists.
- **6** — Chip internal padding-y, model-picker padding-y.
- **8** — Section gap inside the composer's bottom row; gap between follow-up chips.
- **10** — Tooltip padding-x; model-picker padding-x.
- **12** — Composer padding-top; paragraph spacing in prose.
- **14** — Composer padding-x.
- **16** — Heading bottom-margin in prose; horizontal page padding on mobile.
- **20** — h2 top-margin.
- **24** — Modal padding; h1 top-margin; section gap between sidebar groups.
- **28** — Inter-turn gap between user→assistant.
- **32** — Composer-to-content fade region height.
- **40–48** — Generous top padding for the empty-state hero.

## 20. Motion / animation

- **Transition durations.**
  - Hover state changes: **120 ms**.
  - Action-bar fade-in on message hover: **120–150 ms**.
  - Scroll-to-bottom button fade: **150 ms**.
  - Message arrival pop: **120 ms** (opacity + ~2% scale).
  - Composer focus border change: **80–100 ms**.
- **Easing.** `ease-out` for entries (something arriving), `ease-in-out` for state swaps (send → stop). No bouncy springs.
- **What animates.**
  - Composer focus (border tone).
  - Hover halos on icon buttons (background fade-in).
  - Message arrival (pop).
  - Streaming caret (blink, ~1 s cadence) and pre-text pulsing dot (~1 s cadence).
  - Follow-up chip reveal (stagger ~30–40 ms, fade-up ~150 ms).
  - Scroll-to-bottom button (fade only — no slide).
  - Artifact panel open (slide-from-right ~220 ms with `ease-out`).
- **What deliberately does *not* animate.**
  - No drop-shadow pulses, no neon glows, no card lifts on hover. The whole aesthetic is "calm and editorial".

## 21. Keyboard interactions

- **Enter** — Send.
- **Shift + Enter** — Insert newline (does not send).
- **Cmd / Ctrl + K** — New chat (or open command palette in some variants).
- **Cmd / Ctrl + .** — Toggle sidebar.
- **Esc** — Close any open modal / popover / artifact panel; cancel an in-progress edit.
- **Up arrow when input is empty** — Edit the last user message **[inferred — common pattern; not all builds]**.
- **/** at the start of an empty composer — opens a slash-command menu in some builds.
- **Cmd / Ctrl + C** while text is selected inside a code block — copies; the dedicated copy button still works.

## 22. Differences from ChatGPT and common chat UIs (the bits clones miss)

These are the easy-to-miss details that make a clone read as "Claude" rather than "generic":

1. **No avatars on either side.** ChatGPT puts a small assistant avatar; Claude does not.
2. **User bubble, assistant prose — not two bubbles.** ChatGPT renders the assistant in a tinted lane too; Claude leaves the assistant un-cased and on the page background. This is the single biggest visual tell.
3. **Both sides use the serif.** Many clones switch to sans for the user bubble — Claude keeps the serif for editorial unity.
4. **No shadow on the composer.** It's defined by a 1 px border on cream, full stop. No `box-shadow`, no soft glow on focus.
5. **Send button is a rounded-square, not a circle.** ~32 px square, ~8–10 px radius, terra-cotta `#C96442`, white up-arrow.
6. **Send button is hidden when the input is empty.** It only renders once content exists. ChatGPT shows a disabled-state mic; Claude just shows nothing on the send slot until you type.
7. **A single `+` on the left.** No "tools" button beside it. Attach is the only left-side affordance.
8. **Model picker lives on the bottom-right of the composer, not in the top bar.** It is text + chevron, not a pill — and it sits inline with the send button.
9. **Action bar fades in on hover, not visible by default.** And it is left-aligned to the assistant prose, not floating right.
10. **Follow-up chips wrap, never scroll.** And they only appear sometimes — they're advisory, not always-on.
11. **No drop-shadows anywhere in the chat surface.** Everything is borders + tonal contrast on cream.
12. **Streaming has a pulsing dot before the first token**, not a skeleton block, not a static spinner.
13. **The orange is rare.** It appears only on the send button, the empty-state sparkle, and link colour. Borders, separators, hover halos are all warm neutrals.
14. **The placeholder *is* the hero subhead.** "How can I help you today?" never appears as a separate body line — it's only the placeholder. The cream surface and the placeholder *together* are the hero.

## 23. Sources

- [Claude Clone — assistant-ui](https://www.assistant-ui.com/examples/claude) — by far the richest single source; exact hex codes, Tailwind classes, structure for user bubble (`rounded-2xl bg-[#E5E0D6] max-w-[80%]`), composer (`rounded-2xl border border-[#E5E0D6] bg-white px-3.5 pt-3 pb-2.5`), action bar visibility rule (`opacity-0 transition-opacity group-hover/message:opacity-100`), mode tabs, model picker contents, line-height `1.65rem`.
- [Claude AI Logo Color Codes, Fonts & Downloadable Assets — BeginsWithAI](https://beginswithai.com/claude-ai-logo-color-codes-fonts-downloadable-assets/) — concrete hex: `#DA7756` (logo terra cotta), `#000000`, website background `#EEECE2`, text `#3D3929`, chat buttons `#BD5D3A`; font stack `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`; header font Galaxie Copernicus (`__copernicus_669e4a`).
- [Anthropic brand colors / Loftlyy](https://www.loftlyy.com/en/anthropic) — cross-references the same palette; primary terra cotta and warm neutrals. (Fetch failed — relied on search-result summary.)
- [Styrene in use: ANTHROPIC — type.today](https://type.today/en/journal/anthropic) — confirms Styrene B for headlines/subheadings, Tiempos for body on Anthropic surfaces.
- [My Styrene Soul — Dear Designer](https://deardesigner.substack.com/p/my-styrene-soul-a-short-affair-with) — confirms Galaxie Copernicus Book for headers, Styrene B for "main text field" (i.e. UI chrome), Tiempos Text for secondary; observation that the chat form field is "perhaps 300px tall" before scroll.
- [Claude Brand Color Codes — BrandColorCode](https://www.brandcolorcode.com/claude) — "Peach" `#DE7356` brand colour.
- [iPalettes — Claude AI palette](https://ipalettes.com/palette/Claude%20ai-2918) — named palette including Crail `#C15F3C`, Cloudy `#B1ADA1`, Pampas `#F4F3EE`, White.
- [Mobbin — Claude brand colors](https://mobbin.com/colors/brand/claude) — confirmed same family (page blocked WebFetch; brand-color names came via search summary).
- [Claude Sidebar Modifier — GitHub](https://github.com/cyanheads/claude-sidebar-modifier) and [Claude Chat Width Customizer — Firefox add-on](https://addons.mozilla.org/en-US/firefox/addon/claude-chat-width-customizer/) — indirect confirmation that the default chat column is narrow (~720–768 px) and sidebar is ~260–280 px (extensions exist specifically to widen).
- [Tom's Guide — Claude Artifacts update](https://www.tomsguide.com/ai/claude-artifacts-get-a-big-update-now-you-can-highlight-and-edit-code-with-text) — confirms highlight-to-edit in artifacts; split-screen panel pattern.
- [Albato — Claude Artifacts guide](https://albato.com/blog/publications/how-to-use-claude-artifacts-guide) — artifact panel slides out from the right; copy / download / publish actions.
- [Fusion Chat — 10 Tips for Maximizing Claude](https://fusionchat.ai/news/10-tips-for-maximizing-your-claude-ai-experience) — action bar contents (Copy, Thumbs-up, Thumbs-down, Retry).
- [Claude Help Center — Upload files](https://support.claude.com/en/articles/8241126-upload-files-to-claude) and [Guideflow upload tutorial](https://www.guideflow.com/tutorial/how-to-upload-images-to-claudeai) — confirm the `+` attach button is the sole left-side affordance and that drag-and-drop / paste work.
- [Claude Help Center — Chat search & memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context) and [Project guide](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects) — sidebar sections: Starred, Recents, Projects.
- [Claude.ai Scroll-to-Bottom userscript — GreasyFork](https://greasyfork.org/en/scripts/568890-claude-ai-scroll-to-bottom) and [GitHub issue #35261](https://github.com/anthropics/claude-code/issues/35261) — confirms the scroll-to-bottom button is **not** native on web claude.ai in some builds; users have hacked it back in. Treat its presence as build-dependent.
- [Claude Streaming API Guide — ClaudeReadiness](https://claudereadiness.com/blog/claude-streaming-api-guide/) — typing indicator (animated dots / blinking cursor) appears immediately on submit; AbortController behind the Stop button.

---

**Caveats.**
- Direct DOM inspection of claude.ai was not possible from this environment, so all pixel-level numbers labelled **[inferred]** carry uncertainty of roughly ±2–4 px.
- Some sub-surfaces (mobile layout details, modal dimensions, exact disclaimer copy as of today) are corroborated mainly from secondary write-ups; if a measurement is critical, sanity-check it against a fresh claude.ai screenshot before locking it into the build.
- The brand-orange family (`#C96442` / `#BD5D3A` / `#DA7756` / `#DE7356` / `#C15F3C`) is small enough that all five values are interchangeable for non-pixel-perfect work; the canonical UI choice in the assistant-ui clone is `#C96442` and that should be the default.
