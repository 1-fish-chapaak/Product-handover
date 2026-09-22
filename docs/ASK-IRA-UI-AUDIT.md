# Ask Ira — UI audit: One-Click Audit & Smart queries

**Date:** 21 Sep 2026 · **Branch:** `feat/engagements-sox-v2` · **Type:** read-only review (no code changed)

---

## Scope & method

**Screens covered**

1. Ask Ira home — headline, subline, chat text box, top bar
2. Smart queries card — loading state and ready state
3. Smart queries library popup
4. One-Click Audit banner (top of the Ask Ira home)
5. One-Click Audit popup — Setup → Thinking → Engagements → Controls → Workflows → Review → Go-live → Success

**Not covered:** the chat answer screens after a question is sent; the SOX control testing page (comparison dropped at the user's request).

**How it was reviewed**

- Every screen walked in Chrome on the local build of this branch (`localhost:5173`). Stopped at "Make 3 engagements live" without clicking it, so no records were created — the Go-live and Success screens were reviewed from code only.
- Two parallel code audits against `DESIGN.md` (one per flow); the key claims were spot-checked in the source.
- The Ask Ira / One-Click Audit / Smart queries files are identical on `main`, so everything here applies there too.

**Caveat:** in Chrome, step changes in the One-Click Audit popup looked very slow and washed out. That was the browser tab running in the background (animations throttled); the code uses ~0.3s transitions, so it is **not** listed as a finding.

---

## Bottom line

Both flows are built in their own "showpiece" style — purple→pink gradients, coloured glows, sparkle icons, moving WebGL backgrounds — that `DESIGN.md` forbids by name, and neither surface is documented as an exception.

**Recommendation:** bring both onto the design system (flat cards, one solid-purple button recipe, one loading signal per screen). If One-Click Audit should feel special, approve **one** narrow exception — the ambient moving lines on its Setup and Thinking screens only — and write it into `DESIGN.md` next to the Home (§7.3) and Auth (§7.12) exceptions.

---

# Part 1 — UI findings

## Fix these first

| # | What | Why it matters | Fix |
|---|------|----------------|-----|
| 1 | **Gradients & glows** — purple→pink gradient on 15+ elements in the popup, 14 coloured glow shadows; pink (fuchsia) isn't in the palette | The Controls screen reads magenta; breaks the Single Gradient and No-Glow rules | Solid purple buttons; flat cards with a hairline border |
| 2 | **Loading screens stack animations** — Smart queries card runs 5 at once; One-Click Audit thinking screen stacks an orb, endless rings, shimmering text, a rotating code line and a moving background | Noise, not information; breaks "one loader, never both" | Keep only the skeleton chips (card) and the step checklist (thinking screen) |
| 3 | **The banner is the loudest thing on the home screen** — dark gradient slab for a secondary feature, wider than the column below it | Pulls focus from the text box, the screen's real job | Light, flat strip matching the column width (like the dashboard banner just above it) |
| 4 | **"AI" said dozens of times** — an "AI" badge on every card, risk, control and workflow; severity shown twice (dot + chip) as a red/amber/green traffic light | Everything in the popup is AI-drafted; badges repeat what the context says | One "Recommended" tag per engagement; one severity badge per row, no dot |
| 5 | **Two one-line bugs** — keyboard focus turns round things into squares (app-wide); the Chat toggle has its sparkle icon back | Visible regressions | Remove the `border-radius` line from the global focus style; swap the icon back to the speech bubble |
| 6 | **Typography** — tiny text (8.5–9px), light grey text failing contrast, fonts swapped (home headline sans / popup titles serif), hyphens spaced out | Readability and polish | Minimum ~11–12px in darker grey; serif only on heroes, Inter for popup titles; tabular figures on numbers only |

---

## Screen 1 — Ask Ira home (headline & text box)

**1.1 [Med] Headline "Not harder." shimmers.** The words use a gradient with a white shine that sweeps across every 3 seconds, forever; mid-sweep the letters wash out against the pale page. The weight also jumps from 500 to 700 mid-sentence.
**Fix:** solid purple (`brand-700`), same weight as the rest, no sweep.
*Where:* `src/components/chat/ChatView.tsx:6030-6034`, `TextShimmer.tsx:24-39` · *Rule:* §6 L370 (no gradient text) — note §7.1.2 L399 still describes the shimmer, so the doc contradicts itself.

**1.2 [Med] Headline font.** The home headline is set in Inter; `DESIGN.md` says the hero uses the serif (Source Serif 4). Meanwhile the One-Click Audit popup uses the serif on every step title, where popup titles should be Inter — the two are swapped.
**Fix:** serif on the home hero; Inter semibold on popup step titles.
*Where:* `ChatView.tsx:6030` · *Rule:* §3 L224, L254; §7.9 L591

**1.3 [Low] Hero text details.** "Ira" is 17px inside a 15px line (the line bumps); headline colour is a transparent near-black instead of `ink-800`; negative letter-spacing on display type.
*Where:* `ChatView.tsx:6030, 6042`

**1.4 [Low] Two identical "+" icons mean different things** — New chat (top right) and Attach (in the text box).
**Fix:** use a pencil/compose icon for New chat.
*Where:* `ChatView.tsx:5906, 5912`

**1.5 [Low] Top-bar buttons** are 38px and barely change colour on hover (ink-400 → ink-500); the spec's ghost hover goes to ink-800.
*Where:* `ChatView.tsx:5906, 5912`

**1.6 [High] Chat toggle shows a sparkle icon again.** It was changed to a speech bubble in June (no-sparkle rule); on this branch it's back to Sparkles. The speech-bubble icon is already imported.
*Where:* `ChatView.tsx:6213`

**1.7 [Med] Too much purple on one screen.** Banner + gradient headline + wand tile + Explore button + chips + toggle together go well past the "auditor's pen" limit (brand purple on ≤10% of the screen).
*Rule:* §2 L209

---

## Screen 2 — Smart queries card (loading → ready)

**2.1 [High] Moving glow border.** A glow (lilac, pink, sky blue) keeps circling the card — fast while loading, slower when ready, never stops. At rest the card also has a purple-tinted border and a purple drop shadow; the glow spills ~26px onto the page. `DESIGN.md` §7.10.6 says BorderGlow is not part of the system.
**Fix:** a plain flat card — white, 1px `canvas-border`, no shadow, border tints to `brand-200` on hover.
*Where:* `src/components/chat/SmartQueriesModal.tsx:70-81`, `BorderGlow.css:37-42` · *Rule:* §4 L274 (No-Glow), §4 L266 & §5 L302 (flat at rest), §6 L372

**2.2 [High] Magic-wand icon tile** — purple→pink gradient, purple glow, sparkle-wand glyph, and it pulses while loading. Same tile repeats in the library popup header.
**Fix:** flat light-purple tile (`bg-brand-50 text-brand-700`), no shadow, no pulse, a non-sparkle icon.
*Where:* `SmartQueriesModal.tsx:93-97, 273-274` · *Rule:* §5 L348, §4 L274, §6 L372

**2.3 [Med] Loading state shows five moving signals at once** — the fast glow border, the pulsing tile, bouncing dots after the title, a purple "Analyzing" spinner, and shimmering skeleton pills. The dots' easing overshoots (bouncy), which the spec forbids.
**Fix:** keep the skeleton chips + one status line (dots *or* spinner, not both) + a still tile.
*Where:* `SmartQueriesModal.tsx:93-95, 112, 142-145, 167` · *Rule:* §7.1.8 L434 ("never both"), §6 L376

**2.4 [Low] The card grows when loading finishes.** At a normal laptop width the loading skeleton fits on one row, but the ready chips wrap to two — leaving "Vendor master" alone on the second row — so the card grows ~35px.
**Fix:** reserve the two-row height, or lay the six chips out 3 × 2.

**2.5 [Med] Explore button is off the button spec** — 12px corners (labelled chat buttons use 8px), a purple glow shadow, two icons (one a sparkle), no pressed state.
**Fix:** the shared Button, or 36px tall, 8px corners, arrow icon only, standard subtle shadow, `active:` pressed state.
*Where:* `SmartQueriesModal.tsx:147-155` · *Rule:* §5 L286, L293

**2.6 [Med] "34 QUESTIONS" badge** — 9px bold capitals with wide letter-spacing on an 18px pill; hard to read.
**Fix:** the standard Pill ("34 questions", title-case, 12px) or plain grey text.
*Where:* `SmartQueriesModal.tsx:130` · *Rule:* §7.10.4 L637

**2.7 [Med] Category chips on the card** use purple-tint fill at rest; the count is light purple on light purple (~3.4:1 contrast).
**Fix:** see 3.4 — one chip style, neutral at rest, purple on hover, count in grey.
*Where:* `SmartQueriesModal.tsx:178-182`

---

## Screen 3 — Smart queries library popup

**3.1 [High] Moving background + glass effect.** A WebGL "Scanner" field in blue-violet, pink and lilac moves behind the questions. To stay readable, the chips and question rows are see-through white with blur — the frosted-glass look `DESIGN.md` bans.
**Fix:** remove the moving field; solid white chips and rows.
*Where:* `SmartQueriesModal.tsx:250-266, 307, 356, 375` · *Rule:* §6 L371 (no glassmorphism), §6 L378-379

**3.2 [Med] Ragged left edge.** Technique tags (BENFORD, THRESHOLDS, ROUND AMOUNTS…) have different widths, so each question's text starts at a different point.
**Fix:** a fixed-width tag column, or move the tag to the right end of the row.

**3.3 [Med] Tag colours from outside the palette.** Tags use Tailwind's default amber, emerald, sky and rose, which read like severity (rose = "risk", emerald = "compliant"). The Vendor master tag uses colours that don't exist, so it renders with no fill and a dark border, unlike the other five.
**Fix:** one neutral tag style for every category.
*Where:* `SmartQueriesModal.tsx:41-48, 377` · *Rule:* §2 L176, L211; §7.10.4

**3.4 [Med] The same six categories are styled two ways.** Card: purple-tint, 11px, 28px tall. Popup: white see-through, 12px semibold, 32px tall; the selected chip is solid purple with a glow.
**Fix:** one chip style everywhere — white, grey border, 12px, purple tint on hover; selected = light purple fill with purple text (not solid purple).
*Where:* `SmartQueriesModal.tsx:178-182, 304-313` · *Rule:* §7.1.10 L442, §7.11.4 L686

**3.5 [Low] Hand-built popup frame** instead of the shared Modal — white instead of `canvas-elevated`, a heavier shadow, a 15px title (spec 20px), tighter header padding, a small close button, fixed 620px height, and warm "paper" colours reserved for reports.
*Where:* `SmartQueriesModal.tsx:245, 271-289, 397` · *Rule:* §7.9.1 L594, §7.9.4 L603, §2 L189

**3.6 [Low] Uppercase labels** use four different letter-spacings across the flow; section headers are 11px bold light grey (~3.2:1 contrast).
**Fix:** one eyebrow style — semibold, one tracking value, `ink-500`.
*Where:* `SmartQueriesModal.tsx:130, 366, 377`; `ChatView.tsx:6110`

**3.7 [Low] "Matched columns" chips** have 4px corners (other chips use 8px), and the column names aren't in the code-style font used for literal values.
*Where:* `SmartQueriesModal.tsx:351-356` · *Rule:* §3 L256

**3.8 [Low] "Use" hint** on question rows appears on hover only, never on keyboard focus.
*Where:* `SmartQueriesModal.tsx:383`

---

## Screen 4 — One-Click Audit banner

**4.1 [High] Dark gradient banner.** A dark purple gradient card written in raw hex colours (not tokens), with a glowing gradient sparkle tile, a pink "NEW" chip at 8.5px, and a white Start button with a black shadow. It's a second dark surface that opens into a light popup, so the entry and what it opens don't match. It's also full width while the headline and text box sit in a narrower column.
**Fix:** a light, flat strip (white, thin purple-tint border) the same width as the column; flat light-purple icon tile with a lightning icon; "New" as a standard Pill; Start as a solid purple 32px button with 8px corners and no shadow. The moving lines inside can stay (accepted house style).
*Where:* `ChatView.tsx:5953, 5966, 5972, 5980` · *Rule:* §2 L213, §5 L348, §4 L274

**4.2 [Low] Three names for one feature** — "NEW" on the banner, "BETA" in the popup header, "Recommended" / "Audit with AI" on Knowledge Hub.
**Fix:** pick one label and one name.

---

## Screen 5 — One-Click Audit popup

### Across every step

**5.1 [High] Purple→pink gradient everywhere.** It's on 4 main buttons, the active step pill, the active engagement tab, the tick circles, every AI badge, the header logo, the thinking orb, and the progress/confidence bars; the popup background also fades white → light purple → light pink. Pink (fuchsia) isn't in the palette.
**Fix:** solid `brand-600` (hover `brand-500`, pressed `brand-800`); selected states light purple fill + purple text + purple-tint border; plain popup background; solid bars.
*Where:* `src/components/one-click-audit/OneClickAuditModal.tsx:48, 66, 410, 426, 445, 603, 636, 713, 763, 1039, 1118, 1169, 1179, 1213` · *Rule:* §5 L348, §6 L378, §2 L209

**5.2 [High] 14 coloured glow shadows** — purple glows under buttons, tabs, the step rail, tick circles, logo, orb and the selected card; a green glow under the success disc; a lilac glow on the banner icon.
**Fix:** delete them; primary buttons get the standard subtle shadow only; cards use a border only.
*Where:* `OneClickAuditModal.tsx:66, 426, 445, 603, 636, 747, 1039, 1081, 1118, 1169, 1179, 1213`; `ChatView.tsx:5966` · *Rule:* §4 L274, §4 L266, §5 L302

**5.3 [Med] Buttons — 13 hand-made styles, none use the shared Button.**
- Main buttons come in three heights (48, 44, 40px), three text sizes, mixed semibold/bold, all 16px corners (the banner's Start is 8px).
- Outline buttons hover to a colour you can barely see.
- Disabled Next / Make-live stay purple at 40%, still react to hover, and Make-live keeps the pointer cursor.
- No pressed state anywhere.
**Fix:** one recipe — 40px tall, 8px corners, 13px semibold; primary and outline per §5; `active:scale-[0.98]`; disabled = grey fill, grey text.
*Where:* `OneClickAuditModal.tsx:603, 1118, 1125, 1148, 1169, 1179` · *Rule:* §5 L282, L288

**5.4 [Med] Popup frame.** 24px corners (not on the scale), a very heavy shadow, a frosted see-through footer (glass), see-through cards over the moving background, and **8 different corner sizes** in one popup (24/20/16/12/8/6/4/round).
**Fix:** 16px corners, standard popup shadow, solid footer and cards; cards and rows 12px, chips round, buttons 8px.
*Where:* `OneClickAuditModal.tsx:393, 410, 431, 748, 852, 1139` · *Rule:* §6 L371, §7.9 L591, L603, §5 L300

**5.5 [Med] Full-screen moving background (WebGL).** Not the approved header-lines style: it's full-bleed, uses off-palette pink and blue colour stops, and keeps running behind the dense lists (at 7% opacity — barely visible but still costs GPU). With the popup open, three WebGL backgrounds run at once (home lines, banner lines, popup shader).
**Fix:** show it on Setup / Thinking / Success only, with brand-only colours — or document it as an exception.
*Where:* `OneClickAuditModal.tsx:40`

**5.6 [Med] Typography.**
- Pixel font sizes: 9px (AI badge, Beta), 8.5px (banner NEW).
- 23 labels at 10px or smaller; chips 17–18px tall with 8px icons.
- Five different step-title sizes (two are off the type scale).
- Light grey `ink-400` used 28 times, mostly at 10–11px — about 3:1 contrast, fails AA.
- Eyebrow labels mix weights and four letter-spacings.
**Fix:** rem sizes everywhere; chips 11–12px; one step-title size (24px); text under 12px in `ink-500` (~6:1).
*Where:* `OneClickAuditModal.tsx:48, 432`; `ChatView.tsx:5972` · *Rule:* §3 L234, L250, L254

**5.7 [Low] Sparkle icon used 6 times** — AI badge, logo, Generate button, thinking orb, rationale lines, banner.
**Fix:** a lightning or checklist icon, or no icon. *Rule:* §6 L372

**5.8 [Low] Step rail** — the active step is a gradient pill with a glow; the rail is hidden on narrow screens.
*Where:* `OneClickAuditModal.tsx:440-452`

### 5a. Setup

**5a.1 [High] "Generate my audit plan" button** — 48px tall, purple→pink gradient, glow, sparkle + arrow icons.
**Fix:** the one button recipe (see 5.3).
*Where:* `OneClickAuditModal.tsx:603`

**5a.2 [Low] Headline "drafted in one click."** uses the same gradient shimmer as the home headline.
**Fix:** solid purple, no shimmer.

**5a.3 [Low] "Connected" rows pulse** (pinging dots) in off-token emerald.
**Fix:** static dots in the "compliant" green token, per the Connected pattern (§7.4.3 L526).
*Where:* `OneClickAuditModal.tsx:509-515`

**5a.4 [Low] Upload "×"** — a 12px icon in very light grey (~1.9:1 contrast) with no click area.
**Fix:** 24px target, `ink-500`, light purple on hover.
*Where:* `OneClickAuditModal.tsx:573-579`

**5a.5 [Low] Two eyebrow styles on one screen** — "RECOMMENDED FOR YOUR DATA" (pill with icon) vs "STEP 1 — GIVE IRA CONTEXT" (plain text).

### 5b. Thinking (loading screen)

**5b.1 [High] Too much motion.** A 64px gradient orb with a sparkle, three endlessly expanding rings, a breathing pulse, a serif headline that shimmers, a rotating code-style "scan line", counters, a gradient progress bar — over the moving background.
**Fix:** drop the orb, rings and shimmer; a static heading (Inter, 20px, semibold); keep the step checklist as the one loading visual; solid purple progress bar; done icons in the "compliant" green token.
*Where:* `OneClickAuditModal.tsx:626-648, 678-681, 713` · *Rule:* §4 L274, §5 L335, §6 L372, §7.1.8 L434

**5b.2 [Med] Numbers disagree on the same screen.** The counters total all 5 engagements (13 risks, 17 controls, 13 workflows) while the footer already says "3 of 5 engagements selected".
**Fix:** count only the pre-selected items, or label the counters "found".
*Where:* `OneClickAuditModal.tsx:169-177`

### 5c. Engagements

**5c.1 [Med] Selected cards are very loud** — thick purple border + glow on every selected card; with three selected, the screen turns purple. Unselected cards look almost the same apart from the border.
**Fix:** selected = light purple border + tick; no glow.

**5c.2 [Med] "AI Recommended" badge on every card** — gradient, 9px bold capitals, sparkle. It also doesn't match the library badge it claims to copy (Engagements list: 20px tall, 10px, semibold, title-case).
**Fix:** standard info Pill "Recommended", once per card.
*Where:* `OneClickAuditModal.tsx:44-53, 757` · *Rule:* §7.10.4 L637, L646

**5c.3 [Med] Date fields are the browser's own month pickers** — 28px tall, 12px text, 8px corners; focus shows only a faint border change.
**Fix:** 32px tall, 12px corners, 13px text, the standard focus (purple border + ring).
*Where:* `OneClickAuditModal.tsx:801, 809` · *Rule:* §5 L311

**5c.4 [Med] Inline editing jumps.** Opening a name/description for editing shifts the text 8px right and 4px down; the pencil appears on hover only (never on keyboard focus); the edit focus ring is almost invisible.
**Fix:** reuse the shared InlineRename, or offset the editor so text doesn't move; show the pencil on focus too.
*Where:* `OneClickAuditModal.tsx:97, 132-135` · *Rule:* §7.10.5 L655

**5c.5 [Low] Chips: four styles on one card** — gradient AI badge, lavender type chip, grey process chip, grey framework chip. Source chips should use the Evidence Blue citation style.
*Where:* `OneClickAuditModal.tsx:784` · *Rule:* §2 L202

**5c.6 [Low] Confidence bar** — purple→pink gradient bar.
**Fix:** solid `brand-600`.
*Where:* `OneClickAuditModal.tsx:763`

### 5d. Controls register

**5d.1 [Med] Severity shown as a traffic light, twice.** Each risk has a coloured dot **and** a severity chip (rose / amber / emerald) side by side — red/amber/green, and the same fact twice.
**Fix:** the standard SeverityBadge only; drop the dot.
*Where:* `OneClickAuditModal.tsx:140-150, 856, 865` · *Rule:* §2 L211 (No-RAG), §6 L380, §7.10.4 L641

**5d.2 [Med] "AI" badge on every risk and control row.**
**Fix:** remove from rows (the whole register is AI-drafted).
*Where:* `OneClickAuditModal.tsx:866, 892`

**5d.3 [Low] "KEY" tag** — uppercase pink text with 4px corners.
**Fix:** `<Pill tone="high">Key</Pill>`.
*Where:* `OneClickAuditModal.tsx:898, 904`

**5d.4 [Low] Engagement tabs cut off the part of the name that tells them apart** ("AP Invoice Integrity — Internal …", "Journal Entry & Close Controls —…"). The active tab is a gradient pill with a glow; counts are 9px.
**Fix:** active tab light purple fill + purple text; counts per §7.11.1 L673 (10px); show a tooltip or shorter names.
*Where:* `OneClickAuditModal.tsx:1211-1218`

### 5e. Workflows

**5e.1 [Low] Half the popup is empty** — three cards in a two-column grid leave the lower half blank.

**5e.2 [Low] Tick position changes** — the tick circle sits top-right on workflow cards but on the left everywhere else. The ticks also look like radio buttons (single choice) though several can be picked.
**Fix:** the shared Checkbox, always first.
*Rule:* §7.10.7 L661

### 5f. Review & go live

**5f.1 [Low] Layout switches to centred** after three left-aligned steps, and leaves the lower half empty.

**5f.2 [Low] Counts without labels** — each row shows three bare icon + number pairs (3 / 4 / 3) that you have to decode.
**Fix:** "3 risks · 4 controls · 3 workflows".

**5f.3 [Med] "Make 3 engagements live"** — 44px tall gradient button with a glow; a different height from every other step's button.
*Where:* `OneClickAuditModal.tsx:1169, 1179`

### 5g. Go-live & Success (reviewed from code)

**5g.1 [Med] Green→teal gradient disc** with a glow and endless rings; each live row shows "live" four ways — tick icon, green border, "Live" chip, pulsing dot — all in off-token emerald.
**Fix:** "compliant" tokens; one status badge per row; static dots.
*Where:* `OneClickAuditModal.tsx:1053, 1076-1109` · *Rule:* §7.4.3 L526

---

## Across both flows

**X.1 [Med] Keyboard focus turns round things into squares (app-wide).** The global focus style sets `border-radius: 8px` and isn't inside a Tailwind layer, so it overrides every button's own corners on keyboard focus — the round send button, "+", toggle segments, chips, tick circles, tabs and 16px buttons all become 8px squares. It also overrides the buttons' own focus-ring classes.
**Fix:** remove the `border-radius` line.
*Where:* `src/index.css:576-581` · *Rule:* §4 L268, L276

**X.2 [Med] Hyphens look spaced out** — "One - Click", "first - digit", "Procure - to - Pay". Measured: the app-wide tabular-figures setting (`tnum`) widens the hyphen from 7.3px to 10.5px at 16px (+45%).
**Fix:** apply tabular figures to numbers only (the `.tabular` utility / numeric elements) instead of all body text. This is a system-wide decision in `DESIGN.md` §3 L224, so it needs a call before changing.
*Where:* `src/index.css:205`

**X.3 [Med] Reduced motion isn't respected** (except on the Smart queries card). When a user asks their device for less motion, these keep moving: the headline shimmers, the hello draw-in, the thinking orb and rings, the rotating scan line, the success rings, the WebGL backgrounds, and the popup's slide/scale. There's no app-wide `MotionConfig reducedMotion="user"`.
**Fix:** `useReducedMotion()` to skip the loops; shimmer renders as static purple; WebGL draws one frame or doesn't mount.
*Rule:* §6 L362

**X.4 [Low] 23 hand-made button styles across the two flows** (13 in One-Click Audit, 10 on home + Smart queries); none use the shared Button.

**X.5 [Low] `DESIGN.md` gaps and contradictions** — no section for One-Click Audit or Smart queries; §7.1.2 describes the shimmer headline that §6 bans; §6 L364 allows shadows on "the AI input" while §4 forbids resting shadows; §7.1.3-7.1.5 still describe an old placeholder ("Reply to Ira…"), rounded-lg attach/send, and a "Build a workflow" toggle.

---

## Tally (in scope)

| | Home + Smart queries | One-Click Audit (popup + banner) |
|---|---|---|
| Pixel font sizes | 0 (one 9px rem size) | 3 (+17 fixed-pixel chip heights) |
| Raw colour literals | 11 | 10 hex + 24 rgba |
| Off-palette colour classes | 14 (+2 that don't exist) | 50 (fuchsia 23, emerald 20, rose 3, amber 3, teal 1) |
| Custom shadows | 9 | 24 (14 coloured glows) |
| Gradients | 7 (1 sanctioned) | 21 (0 sanctioned) |
| Distinct button styles | 10 | 13 |

---

## Worth keeping

- **One-Click Audit thinking checklist** (done / active / pending, active row in light purple) — honest progress; make it the one loading visual.
- **One-Click Audit Setup layout** — pitch on the left, inputs card on the right, connected-sources list backing the claim; the dashed drop zone matches the text box's drag overlay.
- **Code-style type for real values** — control IDs, engagement codes, "evidences AP-C01"; counters and percentages use tabular numbers.
- **Question rows** — neutral at rest, light purple on hover; the "Use" hint fades in without moving anything.
- **Smart queries card respects reduced motion** — glow, pulse and shimmer all switch off; the placeholder shows in full instantly.
- **Home text box** — calm focus (border colour only), send hidden while empty.
- **Popup overlay and entry motion** in Smart queries match §7.9 (dim + 2px blur, 150ms fade, 180ms panel).
- **Web search switch** uses the shared, on-spec Toggle.

---

## Settled decisions respected (deliberately not flagged)

- FloatingLines ambient lines and ChromaGrid card glow — accepted app-wide house style (the banner's lines can stay).
- Labelled chat buttons use 8px corners; icon-only buttons, form selects, list rows, pills, the **round** send button and card-buttons keep their own radius.
- The Chat / Workflow two-segment sliding toggle (only its sparkle icon is flagged).
- Status pills with dots/borders are kept.
- Em dashes are allowed in product copy.

---

# Part 2 — Flow & behaviour findings (first pass)

*These came from the first, code-only pass before the focus moved to UI. Included for completeness; verified in source.*

## Fix first

1. **Pressing Esc wipes the whole One-Click Audit draft.** Esc to cancel editing a name closes the popup and loses every pick and edit (the popup's Esc handler listens page-wide; the inline editor doesn't stop it). — `OneClickAuditModal.tsx:105, 117`; `src/hooks/useFocusTrap.ts:48-53, 74`
2. **Dismissing the mid-run severity question freezes the answer.** The diagram parks forever, nothing says it's waiting on you, and the question can't be re-asked (it fires once). — `ChatView.tsx:4067-4069`; `src/components/shared/PlanFlowDiagram.tsx:164-182`
3. **One-Click Audit promises what it doesn't do.** It says the engagements are "live" and that "controls and monitoring workflows are now in your Engagement Library" — only the engagements are saved, as "Planned". — `OneClickAuditModal.tsx:286, 1085-1087`
4. **Every suggested question gives the same answer.** The picked text is ignored in Chat mode, so a Benford's Law question gets the duplicate-invoice answer ("Parsed intent: invoice duplicate detection"). A demo risk. — `ChatView.tsx:5024-5025, 4227, 4252`
5. **The pre-run questions have no visible way out** — no close or skip button, only Esc, and the text box is hidden meanwhile. A "use sensible defaults" path exists in code with no button. — `QueryClarificationCard.tsx:144`; `ChatView.tsx:4110`

## One-Click Audit

1. **No "are you sure?" on close** — X, Esc or clicking outside discards all picks at any step. — `OneClickAuditModal.tsx:332-344`
2. **"Live" vs "Planned"** — green "Live" tags on the success screen; records are saved as "Planned". — `:286` vs `:1085, 1108`
3. **Drafted risks, controls and workflows are never saved**, nor are edits to them; opening a created engagement shows none of them. — `:270-303`
4. **Running it again creates duplicates** with the same codes (ENG-A01–A05) and names; the banner never changes after a run. — `:277`; `oneClickAuditData.ts:70, 102, 134, 166, 195`
5. **Inputs don't change the plan** — uploads and the web-search switch produce the same plan; cards cite SOP and web sources that weren't given. — `oneClickAuditData.ts:66, 79, 111, 143, 205`
6. **Numbers don't match** — "Takes about 15 seconds" vs ~5–8s actual (1.5s per phase); counters total all 5 engagements while 3 are pre-selected; "1 engagements". — `:222-226, 609-610, 169-177, 990`
7. **No way back to regenerate** — Back is disabled on the first results step. — `:1147`
8. **Ticks can contradict each other** — unticking a risk leaves its controls ticked; a workflow still "evidences" an unticked control; zero controls can go live; end month before start month is accepted. — `:875-906, 965-967, 1168, 796-810`
9. **"Your databases are connected" is fixed text** — nothing checks it. — `ChatView.tsx:5974`
10. **Closing mid-commit** — during go-live X and Esc still work; records are already written and no toast appears. — `:305-310, 333`

## Smart queries

1. **"Detected in your data" isn't real** — a fixed list after a 4.2s timer that restarts whenever a file is attached; with nothing attached it still names SAP datasets. **Fix:** call them "Sample questions" when nothing is attached. — `ChatView.tsx:5650-5654`; `smartQueries.ts:185`
2. **The 34-question library has no search** — browse by category only.
3. **"Your rule: ₹1,00,000 or more = High"** shows when no rule was set (Workflow mode, or skipped). **Fix:** label it "Default rule". — `ChatView.tsx:3330, 4007-4024, 7070`
4. **Workflow mode mixes three examples** — the preview describes an AMEX reconciliation, the finish message claims 8 findings, the table shows 9 risky payments. — `ChatView.tsx:1912-1935, 7064-7072`
5. **Downloads** — Excel shows "CSV download started"; CSV, Excel and full screen drop the Risk column and rule caption; an Excel failure isn't shown. — `ChatView.tsx:1464-1509, 6656`
6. **Dead buttons** — "Continue editing" (save-workflow card) has no action; Send is visible but does nothing when only a data source is attached. — `ChatView.tsx:7005, 5044-5047`
7. **Stop disappears while the answer is still typing**; actions and follow-ups appear before the text finishes. — `ChatView.tsx:3908, 4280, 6746`
8. **Side panel doesn't match the answer** — the SQL tab shows unrelated SQL, the Plan tab leaves out the user's rule, Regenerate returns the same plan. — `ArtifactPanel` ~196-253
9. **Copy slips** — the trail says "plan → SQL → sources" though the diagram is plain English by design; "I've pre-filled my best guess" but nothing is pre-filled; every report card is titled "Duplicate invoice analysis". — `ChatView.tsx:6528, 4609-4611, 4477`
10. **Question card keys** — 1–9 and Enter are captured page-wide while it's open; clicking "Type something else…" clears the already-picked option. — `QueryClarificationCard.tsx:128-150, 353-357`
