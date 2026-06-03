---
name: Auditify Chat
description: Editorial GRC chat surface — query and workflow in one auditor's thread.
colors:
  brand-50: "#F7F0FF"
  brand-100: "#EDDEFE"
  brand-200: "#DCBBFD"
  brand-300: "#C393FA"
  brand-400: "#A366F0"
  brand-500: "#8838DE"
  brand-600: "#6A12CD"
  brand-700: "#550FA5"
  brand-800: "#3B0B72"
  brand-900: "#26064A"
  canvas: "#FCFAFD"
  canvas-elevated: "#FFFFFF"
  canvas-border: "#E5E7EB"
  paper-50: "#FAF7F2"
  paper-100: "#F3EEE5"
  ink-300: "#C2B9CB"
  ink-400: "#9A8FAE"
  ink-500: "#6B5D82"
  ink-600: "#4A3D62"
  ink-700: "#332848"
  ink-800: "#1F1433"
  ink-900: "#0F0720"
  risk: "#B42318"
  high: "#C2410C"
  mitigated: "#B45309"
  compliant: "#15803D"
  evidence: "#0369A1"
  draft: "#6B5D82"
typography:
  display:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 420
    lineHeight: 1.2
    letterSpacing: "0"
  headline:
    fontFamily: "Source Serif 4, ui-serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0"
    fontFeature: "ss01, cv11, tnum"
  meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  "2xl": "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.canvas-elevated}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.brand-500}"
  button-primary-active:
    backgroundColor: "{colors.brand-800}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-400}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.ink-800}"
  button-outline:
    backgroundColor: "{colors.canvas-elevated}"
    textColor: "{colors.ink-500}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.risk}"
    textColor: "{colors.canvas-elevated}"
    rounded: "{rounded.lg}"
  card-default:
    backgroundColor: "{colors.canvas-elevated}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-kpi-active:
    backgroundColor: "{colors.canvas-elevated}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip-citation:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.brand-700}"
    typography: "{typography.mono}"
    rounded: "{rounded.full}"
    padding: "2px 6px"
  input-default:
    backgroundColor: "{colors.canvas-elevated}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  ai-response:
    backgroundColor: "{colors.canvas-elevated}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.xl}"
    padding: "24px 28px"
    typography: "{typography.body}"
  sidebar-nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.canvas-elevated}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  sidebar-nav-item-active:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.canvas-elevated}"
---

# Design System: Auditify Chat

## 1. Overview

**Creative North Star: "The Senior Auditor's Notebook"**

Auditify Chat is set, not styled. The page reads like a working notebook in the hands of a senior auditor: warm paper canvas behind a clean elevated sheet, ink-toned typography, marginalia in mono. Authority comes from Source Serif 4 at hero moments and from JetBrains Mono on every number, ID, and evidence excerpt. Inter does the everyday work in between. The deep purple anchor (`brand-600` / `#6A12CD`) is the auditor's pen — used with restraint, never sprayed across the surface.

What this system rejects, explicitly: the generic AI chat-app aesthetic (centered bubble streams, sparkle iconography, glow chrome); the heatmap compliance dashboard (red/amber/green tile grids, risk-rating thermometers); SaaS-cream-and-rounded everything (hero-metric templates, identical card grids, glassmorphism, gradient text used as decoration); and consumer-cute (mascots, pastel gradients, illustrative blobs). Auditors are paid to be skeptical — the chrome doesn't perform delight at them.

Density is comfortable, not cramped: the chat thread breathes (66ch responses, generous vertical rhythm); the workspace tightens up where data lives (tabular numerics mandatory, dense labels at 13px). Motion is responsive and modern — exponential ease-out, 150–200ms state changes, gentle component reveals — never bouncy, never theatrical. `prefers-reduced-motion` is honored globally.

**Key Characteristics:**
- Warm paper canvas (`#FCFAFD`) under a clean elevated sheet (`#FFFFFF`), softened by a subtle three-stop radial gradient mesh so cards read as floating material, not as 1px-bordered rectangles on flat white.
- Borders before shadows. Shadows sparingly. Tinted glow chrome: never.
- Type carries the brand: Source Serif 4 for authority, Inter for the working surface, JetBrains Mono for every number, ID, and evidence excerpt.
- A single deep purple accent used as the auditor's pen — never as a curtain.
- Tabular numerics on every number. Always. No exceptions.
- Motion is exponential ease-out at 150–200ms, with a global reduced-motion fall-through.
- The dark sidebar (`brand-900`, `#26064A`) is the only persistently dark surface — anchored every theme.

## 2. Colors: The Editorial GRC Palette

A purple-anchored editorial palette over warm paper and ink, with a deliberately non-RAG GRC semantic vocabulary. Every color names a job; nothing is decorative.

### Primary
- **Royal Audit Purple** (`#6A12CD`, `brand-600`): The auditor's pen. Primary buttons, active states, focus rings (at 24% alpha), citation chips, the streaming caret. The one accent in a Restrained strategy — present on ≤10% of the surface at any time.
- **Sidebar Midnight** (`#26064A`, `brand-900`): The persistent dark shell. The sidebar — and only the sidebar — wears this color in every theme. Anchors the brand identity without darkening the working surface.

### Neutral — Canvas (chrome surfaces: chat, workspace, dashboards)
- **Paper Canvas** (`#FCFAFD`, `canvas`): The page itself, softened by a three-stop radial mesh of `brand-50` and `brand-100` at very low alpha. Cards float over this; they do not stamp onto it.
- **Clean Sheet** (`#FFFFFF`, `canvas-elevated`): Cards, modals, the AI response surface, inputs.
- **Hairline Grey** (`#E5E7EB`, `canvas-border`): All structural borders. 1px. Hover state tints toward `brand-200`.

### Neutral — Paper + Ink (report and evidence surfaces)
- **Workpaper Warm** (`#FAF7F2` / `#F3EEE5`, `paper-50`/`paper-100`): Report surfaces and PDF previews. Warmer than canvas; signals "this is a deliverable, not a control."
- **Brief Ink** (`#1F1433`, `ink-800`): Primary body text on canvas.
- **Margin Ink** (`#6B5D82`, `ink-500`): Secondary text, supporting copy.
- **Faded Margin** (`#9A8FAE`, `ink-400`): Muted, meta, placeholder.

### GRC Semantic
A vocabulary, not a heatmap. Each color is a noun that names a state; they do not sit beside each other in a thermometric ramp.

- **Editorial Risk Red** (`#B42318`, `risk`): Critical severity, destructive actions, errors. Deliberately tilted toward burnt brick, not stop-light red.
- **High-Severity Rust** (`#C2410C`, `high`): High severity. Warmer and more grounded than amber.
- **Mitigated Ochre** (`#B45309`, `mitigated`): Medium severity, warnings, mitigated findings. Reads as warning without screaming.
- **Compliant Forest** (`#15803D`, `compliant`): Low severity, compliant, success. Deeper and less performative than UI green.
- **Evidence Blue** (`#0369A1`, `evidence`): Sources, citations, info-blue. The color of references and provenance.
- **Draft Stone** (`#6B5D82`, `draft`): Drafts and muted states. Identical hue to `ink-500` — drafts read as text, not as decoration.

### Named Rules

**The Auditor's Pen Rule.** `brand-600` covers ≤10% of any screen. It is rare on purpose. If the page looks purple, the page is wrong.

**The No-RAG Rule.** Risk / high / mitigated / compliant are *never* arranged as a thermometric red→amber→green ramp. They are individual nouns. They appear one at a time, paired with an icon or label — never side-by-side as a heat strip.

**The Single Dark Surface Rule.** The sidebar is the only dark surface in the entire product. Dark modals, dark dialogs, dark cards: prohibited. If a surface feels like it wants to be dark, the answer is more whitespace, not more ink.

**The Tinted Mesh Rule.** The body background is never flat white. The three-stop radial mesh (`brand-50` top-left, `paper-100` bottom-right, `brand-100` bottom-center, all at low alpha) is mandatory at the app root. Cards read as floating material because of it.

## 3. Typography

**Display Font:** Source Serif 4 (with Georgia, serif fallback)
**Body Font:** Inter (with system-ui fallback)
**Mono Font:** JetBrains Mono (with SF Mono fallback)
**Auxiliary Serif:** Instrument Serif (used sparingly for italic editorial moments)

**Character:** Source Serif 4 is the voice of authority — present at the hero, on chat thread titles, and on evidence quotes. It is set at a heavier weight than typical serif headlines (420–500) because confidence reads as substance, not as elegance. Inter does the working surface: dense, legible, opinionated about its alternates (`ss01`, `cv11`, `tnum` enabled globally). JetBrains Mono carries every number, every ID, every SQL snippet, and every citation chip. The pairing reads editorial-precise, never decorative.

### Type scale (4-base · rem)

**rem only.** Root = 16px; base step `0.25rem` (4px). Every size is a **whole** multiple of it (×3–×14), lowest = `0.75rem` (12px). Eleven steps span body to hero.

| Token | rem | Step | Role | Font · weight | Line-height |
|---|---|---|---|---|---|
| `text-xs` | 0.75rem | ×3 | Caption, meta, labels, mono, IDs, chips | Inter / JetBrains Mono · 400 | 1.4 |
| `text-base` | 1rem | ×4 | Body — copy, chat, AI prose (cap 66ch) | Inter · 400 | 1.6 |
| `text-lg` | 1.25rem | ×5 | Large body, subheading | Inter · 500 | 1.5 |
| `text-xl` | 1.5rem | ×6 | Heading — section / card / dialog title | Source Serif 4 · 500 | 1.25 |
| `text-2xl` | 1.75rem | ×7 | KPI value, prominent heading | Inter · 700 / Source Serif 4 | 1.2 |
| `text-3xl` | 2rem | ×8 | Display — small | Source Serif 4 · 480 | 1.2 |
| `text-4xl` | 2.25rem | ×9 | Display | Source Serif 4 · 460 | 1.15 |
| `text-5xl` | 2.5rem | ×10 | Display | Source Serif 4 · 440 | 1.1 |
| `text-6xl` | 2.75rem | ×11 | Display — large | Source Serif 4 · 420 | 1.1 |
| `text-7xl` | 3rem | ×12 | Display — large | Source Serif 4 · 400 | 1.05 |
| `display` | 3.5rem | ×14 | Hero — empty-state, once per page | Source Serif 4 · 420 | 1.05 |

(`×13` / `3.25rem` is intentionally skipped — nothing in the build lands there.)

### Named Rules

**The rem-Only Rule.** Font sizes are **always declared in `rem`, never `px`.** If a size comes in as px, convert it before use — `rem = px ÷ 16` (root font-size is 16px). px may appear only as a parenthetical reference for design-tool parity, never in code. This keeps type responsive to the user's browser font-size (an accessibility requirement) and on the `0.25rem` (4px) base grid. Quick map: `12px → 0.75rem`, `16px → 1rem`, `20px → 1.25rem`, `24px → 1.5rem`, `28px → 1.75rem`, `32px → 2rem`, `36px → 2.25rem`, `40px → 2.5rem`, `48px → 3rem`, `56px → 3.5rem`.

**The Tabular Number Rule.** Every numeric value in the product — KPIs, table cells, timestamps, percentages, currency, IDs, version numbers — uses `font-variant-numeric: tabular-nums`. Mixed-width numerals are a bug. There is a `.tabular` utility for any element that escaped the global setting.

**The Source Serif Authority Rule.** Source Serif appears only at three places: the hero, section openers, and evidence quotes (when an excerpt is set in serif italic). Everywhere else, Inter. Reserving the serif keeps it loud.

**The Mono For Truth Rule.** JetBrains Mono is reserved for verifiable atoms: code, IDs, citation refs, file paths, version numbers, evidence excerpts. It signals "this is the literal value, you can audit it." Decorative mono is prohibited.

**The 66ch Response Rule.** AI response prose is capped at 66ch line length. Wider than that and the chat starts to read as a document instead of a conversation. Workspace tables and tiles are exempt.

## 4. Elevation

The Editorial GRC doctrine is **borders before shadows, shadows sparingly, tinted glow chrome never.** The visual depth comes from the warm canvas + clean sheet contrast (canvas is `#FCFAFD`, elevated sheet is `#FFFFFF`) plus the body-level radial gradient mesh that softens the page. Cards are flat at rest. State changes — hover, focus, drag — earn the small amount of motion and shadow that exists.

### Shadow Vocabulary

- **Flat at rest** (`box-shadow: none`): The default for every surface — cards, KPI tiles, the AI input composer, the AI response surface. Depth comes from the 1px `canvas-border` against the warm canvas, not from shadow. This is the Claude-aligned resting state; the composer no longer carries a resting shadow.
- **Lifted hover** (`box-shadow: 0 8px 24px rgba(15, 8, 30, 0.04)`): Reserved for the few large surfaces that earn it on hover. Diffuse, never crisp. Most cards hover by tinting their border to `brand-200`, not by lifting.
- **Focus ring** (`box-shadow: 0 0 0 4px rgba(106, 18, 205, 0.24)`): Applied globally to every interactive element on `:focus-visible` (buttons, inputs, selects, `[role="button"]`). The single most consistent visual signature in the product. The composer input opts out via `.no-focus-ring` because its `ai-border` already signals focus by darkening its border tone.

### Named Rules

**The Border-First Rule.** Depth starts at a 1px `canvas-border`. If a card needs separation from its surroundings, the border is the answer; reach for shadow only when the surface is hovering or actively focused.

**The No-Glow Rule.** Decorative glow chrome around AI surfaces is explicitly prohibited and has been actively removed from the codebase (`ai-glow`, `ai-shimmer`, `ai-pulse-ring`, `ai-float` are all neutralized to no-ops). If you're tempted to make something glow because it's "AI," the answer is no.

**The Focus Ring Is Sacred Rule.** The 4px `brand-600 @ 24% alpha` focus ring appears on every focusable element. It is the single accessibility signature of the product. Do not remove it, do not restyle it per-component. The `.no-focus-ring` opt-out exists only for chat composer inputs, where the composer signals focus via its `ai-border` border tone instead (no glow), so the global ring would be redundant.

## 5. Components

### Buttons

Single source of truth: `src/components/shared/Button.tsx`. Six variants, two sizes, four shapes.

- **Shape:** Rounded — `rounded-md` (6px), `rounded-lg` (12px, default), `rounded-xl` (16px), or `rounded-full` (pill). No square buttons.
- **Sizes:** `sm` (h-7, 28px, text-xs) and `md` (h-9, 36px, text-sm). Icon-only variants are square at the same height.
- **Primary** (`bg-brand-600` / `text-white`): The auditor's pen. Used for the single most important action in a context — submit, save, run. Hover lifts to `brand-500`; active drops to `brand-800`. Subtle shadow at rest (`shadow-sm shadow-brand-900/10`).
- **Secondary** (`bg-brand-50` / `text-brand-700`): A tinted purple chip. Soft companion to primary.
- **Outline** (`bg-canvas-elevated` / `border canvas-border`): The everyday button. Hovers to `brand-50` with `border-brand-200`.
- **Ghost** (`bg-transparent` / `text-ink-400`): Toolbars, icon strips, chrome actions. Hover fills to `brand-50`.
- **Destructive** (`bg-risk` / `text-white`): Irreversible action. Used sparingly.
- **Stop** (`bg-ink-900` / `text-white`): In-flight stop button only. Dark, urgent, not red.
- **Pressed state** (for toggles): Ghost → `bg-primary/10 text-primary`. Outline → `bg-primary/5 border-primary/30`.
- **Focus / active:** Global 4px focus ring; `active:scale-[0.98]` for tactile feedback.

### Chips (Citation)
- **Style:** `bg-brand-50` background, `text-brand-700` color, JetBrains Mono 12px, pill shape (`rounded-full`), `padding: 2px 6px`. Inline-block.
- **Behavior:** Clickable. Opens evidence drawer. No hover background change; the underline-on-hover is sufficient.

### Cards / Containers
- **Corner Style:** `rounded-lg` (12px) for the default card; `rounded-xl` (16px) for the AI response surface; `1.25rem` (20px) for the AI input composer — Claude's actual composer radius.
- **Background:** `canvas-elevated` (`#FFFFFF`).
- **Border:** 1px `canvas-border` (`#E5E7EB`). Hover tints to `brand-200`. **No shadow at rest.**
- **KPI Card Active State:** Bottom border becomes `brand-600` at 2px to signal selection. The rest of the border stays neutral.
- **Internal Padding:** 16px (default) or 24/28px for AI response prose.

### Alert Cards (one scoped exception)
- **Style:** 3px left-edge tinted border in the relevant semantic color (`risk` / `high` / `mitigated`). No shadow, no background tint.
- **Scope:** Alert cards only. This is the **single** sanctioned side-stripe in the design system. Not a generalizable pattern; do not extend to list items, callouts, or feature cards.

### Inputs / Fields
- **Style:** `bg-canvas-elevated`, 1px `border-canvas-border`, `rounded-lg` (12px), h-10 (40px), `text-[13px]`.
- **Focus:** Border shifts to `brand-600`; the global 4px `brand-600 @ 24%` focus ring appears; `transition-all`.
- **Error:** Border to `risk`, helper text in `risk-700` below.
- **Disabled:** `opacity-50`, `cursor-not-allowed`.

### Navigation (Sidebar)
- **Surface:** `brand-900` (`#26064A`) with a near-imperceptible noise texture overlay (`opacity: 0.018`, AA-safe).
- **Item typography:** Inter 13px, `rgba(255,255,255,0.85)` at rest. Active items lift to full white.
- **Item state:**
  - Rest: transparent background.
  - Hover: `rgba(255,255,255,0.08)` surface, no border shift.
  - Active: `rgba(255,255,255,0.12)` surface with subtle inner stroke.
- **Dividers:** `rgba(255,255,255,0.08)`.

### AI Response Surface (signature)
- **Style:** `canvas-elevated` background, `rounded-xl` (16px), `padding: 24px 28px`, `max-width: 66ch`.
- **Border:** 1px gradient border-image from `rgba(106,18,205,0.24)` to `rgba(168,85,247,0.24)`. The only sanctioned gradient border in the product.
- **Typography:** Inter 17px, line-height 1.65, `ink-800`.
- **Meta line above:** JetBrains Mono 12px, `ink-500`, for "Plan generated at..." / model labels.
- **Streaming caret:** 2px `brand-600` bar, blinks once per 1.2s with `steps(1)` — square, not sine.

### AI Input (composer / `ai-border`)
- **Style:** `canvas-elevated` background, 1px `canvas-border`, `rounded: 1.25rem` (20px — Claude's actual composer radius). **Flat at rest:** `box-shadow: none`. The hairline border does all the work; no resting glow or lift.
- **Focus-within:** Border tone only — it darkens one step to `brand-300`. No ring, no glow, no shadow change. That single border shift is the entire focus signal: calm, editorial, in-flow. The composer input carries `.no-focus-ring` so the global 4px ring doesn't double up on the border.
- **Removed:** The old decorative AI effects (`ai-glow`, `ai-shimmer`, `ai-float`, `ai-pulse-ring`) are neutralized to no-ops in `src/index.css` and must not be reintroduced.

### Skeleton (loading)
- **Style:** Linear gradient from `paper-50` → `canvas-border` → `paper-50`, animated via the `shimmer` keyframe (1.5s `ease-in-out` infinite). 200% background-size for the slide.
- **Variants:** `.skeleton-text` (12px tall, 4px radius), `.skeleton-title` (18px tall, 60% width), `.skeleton-card` (12px radius, 80px min-height).

### AI Thinking Dots
- **Style:** Three 6px circles in `brand-400`, animated with the `ai-pulse` keyframe (1.8s) with 200ms / 400ms stagger. Indicates the model is generating before the first token.

### Named Rules

**The Workspace-First Rule.** Visual weight, contrast, and motion bias toward the right-side workspace (Query Plan / Coder / Reference, or Workflow tiles). The chat composer is intentionally smaller, less chromed, less animated than the workspace it produces.

**The Single Gradient Rule.** Two sanctioned gradients exist in the system: the body radial mesh, and the AI response border-image. Every other gradient — text, button, card, decoration — is prohibited.

**The Sidebar Noise Texture Rule.** The sidebar carries a 1.8% opacity noise texture as its only decoration. Cards, modals, and other surfaces never wear noise. Reaching for noise elsewhere is the symptom; the disease is "this surface feels too flat" — fix it with hierarchy, not texture.

## 6. Do's and Don'ts

### Do:
- **Do** use `brand-600` (`#6A12CD`) as a rare accent — ≤10% of any screen. It is the auditor's pen.
- **Do** set every number, ID, timestamp, percentage, and currency in `font-variant-numeric: tabular-nums`. Use the `.tabular` utility if a chart or table escaped the global setting.
- **Do** reserve Source Serif 4 for the hero, section openers, and evidence quotes. Inter for everything else.
- **Do** cap AI response prose at 66ch. Wider, and the chat reads like a document.
- **Do** keep the sidebar as the single persistently-dark surface, anchored to `brand-900` (`#26064A`).
- **Do** apply the 4px `brand-600 @ 24%` focus ring on every focusable element. It is the global accessibility signature.
- **Do** pair semantic state with an icon or label. Color is never the sole signal.
- **Do** honor `prefers-reduced-motion` — the global rule reduces all animations to 0.01ms. Don't reintroduce motion under reduced-motion conditions.
- **Do** use exponential ease-out for state changes: `cubic-bezier(0.2, 0, 0, 1)` at 150–200ms.
- **Do** prefer borders over shadows for depth. Shadows appear on hover, focus, or for the AI input only.

### Don't:
- **Don't** build a generic AI chat app. The workspace canvas, not the message stream, is the deliverable.
- **Don't** arrange `risk` / `high` / `mitigated` / `compliant` as a thermometric red→amber→green ramp. They are individual nouns paired with icons or labels.
- **Don't** use the hero-metric template (big number / small label / gradient accent / supporting stats). Prohibited.
- **Don't** use gradient text (`background-clip: text` with a gradient background). The `.ai-gradient-text` utility exists for legacy; prefer solid `brand-700`.
- **Don't** use glassmorphism (`backdrop-filter: blur` on cards) as a default. Forbidden.
- **Don't** reintroduce decorative AI chrome — no glowing borders, no shimmer-while-streaming, no sparkle iconography. The codebase has actively removed these (`ai-glow`, `ai-shimmer`, `ai-pulse-ring`).
- **Don't** use side-stripe borders greater than 1px anywhere except the three Alert Card variants. That is the only sanctioned exception.
- **Don't** use identical card grids with icon + heading + text repeated endlessly. Vary spacing, vary affordance, vary hierarchy.
- **Don't** use the em dash (`—`) in product copy. Comma, colon, semicolon, period, or parentheses. Also not `--`.
- **Don't** add bounce, elastic, or overshoot to motion. Exponential ease-out only.
- **Don't** introduce a second dark surface. If something feels like it wants to be dark, give it more whitespace.
- **Don't** add a second gradient. The body radial mesh and the AI response border-image are the only two.
- **Don't** use mascots, illustrative blobs, pastel gradients, or rounded-everything friendliness. Auditors are paid to be skeptical.
- **Don't** use pure red, amber, or green (`#FF0000`, `#FFA500`, `#00FF00`-family). The semantic palette is deliberately tinted away from RAG.
- **Don't** use Material-style elevation tiers (elevation-1, elevation-2…). This system is flat with a few specific lifted states; not a tiered Z-axis.

## 7. Surfaces — Where the System Is Used

The tokens and components above are abstract. This section maps them onto the actual product surfaces, following the sidebar's nav groups. Each surface lists **every component it renders** (with its source file), the role each plays, and the tokens/patterns it leans on, so "where does this get used" and "what is on this screen" both have one answer per screen. Shared primitives reused across many surfaces are catalogued once in §7.10.

### 7.1 Ask IRA — Chat (`chat/ChatView.tsx`)

The flagship surface. One continuous editorial reading column; the thread, composer, and empty-state hero all share the same width. Scrolling thread + sticky bottom composer; an optional right-side workspace panel slides in when a query produces a plan/result. Specs below are pulled verbatim from `ChatView.tsx`.

#### 7.1.1 Reading column

Thread wrapper: `max-w-[52.5rem] mx-auto w-full px-4 sm:px-6 pb-10 space-y-10` (`pt-8`, or `pt-4` with a pending dashboard). Composer wrapper: `max-w-[52.5rem] mx-auto w-full px-4 sm:px-0`. The **52.5rem (840px)** column is fixed — do not change it. Message row: `group flex justify-end` (user) / `justify-start` (assistant); user content is `w-fit max-w-[80%] ml-auto`, assistant is `w-full`.

#### 7.1.2 Empty-state hero

- Centered block: `w-[52.5rem] max-w-full text-center`.
- `AuditifyHelloEffect` (`shared/HelloEffect`): the animated `hello`, `className="text-primary h-14 mx-auto"`.
- Headline `<h1>`: `text-[2.125rem] font-medium tracking-[-0.02em] mb-2 text-ink-900/85`, with a `TextShimmer` (`shared/TextShimmer`, `font-bold`, `duration={3} spread={2}`) on the emphasized span.
- Subhead: `text-[0.9375rem] text-ink-500 mb-10`.
- `FloatingLines` (`shared/FloatingLines`): the one ambient decoration behind the hero.

#### 7.1.3 Composer (`.ai-border`)

- Shell: `<div className="ai-border relative">`. `.ai-border` (in `index.css`) = `canvas-elevated`, 1px `canvas-border`, **`border-radius: 1.25rem` (20px), flat (`box-shadow: none`)**; `:focus-within` darkens the border to `brand-300` only — no ring/glow.
- Inner: `rounded-2xl` wrapper.
- Textarea: `no-focus-ring w-full bg-transparent border-none outline-none resize-none px-5 pt-4 pb-2 text-[0.9375rem] leading-[1.5] text-ink-800 placeholder:text-ink-400 min-h-[24px] max-h-[240px]`; placeholder `Reply to Ira…`. The `.no-focus-ring` is why the global 4px ring is suppressed here (the border tone is the focus signal).
- Drag-drop overlay: `absolute inset-0 z-20 … rounded-2xl bg-brand-50/85 border-2 border-dashed border-brand-300`, fades in over 120ms; label `text-[0.8125rem] font-medium text-brand-700` with a `Paperclip` 14.

#### 7.1.4 Attachment chips (`.composer-chips-row`)

Single horizontally-scrolling row inside the composer: `composer-chips-row flex items-center gap-1.5 overflow-x-auto px-3 pt-3 pb-1` (right-edge fade mask + hidden scrollbar from `index.css`). Opened via `DataPickerModal` (`chat/DataPickerModal`, returns `AttachmentSelection`).
- Source chip: `bg-brand-50 text-ink-700 text-[0.75rem] px-2 py-1 rounded-md font-medium border border-brand-100 hover:border-brand-200`, with a `text-[0.625rem] uppercase tracking-[0.06em] text-ink-500` type tag (`DB`/`API`/`CLOUD`/`SESS`/`FILE`) and a truncated name `max-w-[10rem]`.
- File chip: `bg-canvas-elevated text-ink-800 text-[0.8125rem] pl-2 pr-1.5 py-1.5 rounded-lg font-medium border border-canvas-border hover:border-brand-200`, icon in a `size-6 rounded bg-brand-50 text-brand-700` square.

#### 7.1.5 Composer toolbar (attach / stop / send)

Row: `flex items-center justify-between gap-2 px-3 pb-4`.
- Attach button: `size-8 rounded-lg text-ink-500 hover:bg-brand-50 hover:text-ink-800`.
- Stop (in-flight): `size-8 rounded-lg bg-ink-900 text-canvas-elevated hover:bg-ink-800`, glyph `Square size={11} fill="currentColor"`. Dark, not red.
- Send: `size-8 rounded-lg bg-primary text-white hover:bg-primary-hover active:bg-brand-800`, glyph `ArrowUp size={16} strokeWidth={2.25}`. Hidden entirely when the composer is empty.

#### 7.1.6 User message pill

`bg-canvas-elevated`, 1px `canvas-border`, `rounded-2xl`, whisper shadow `shadow-[0_1px_2px_rgba(15,8,30,0.04)]`, hover `hover:border-brand-200 hover:shadow-[0_10px_28px_-14px_rgba(15,8,30,0.16)]`, `transition-[border-color,box-shadow] duration-300`. The white-sheet-on-paper signature. `InlineEditBubble` edits it in place (`text-[1rem] text-ink-900` field with `border-brand-200`).

#### 7.1.7 AI response prose

Claude-style: **no bubble, no avatar, no brand dot** — identity carried by left-flush alignment. Rendered by `renderAssistantText` (`shared/AssistantMarkdown`) inside `text-[0.9375rem] leading-[1.65] text-ink-800 max-w-[66ch]`. (Note: this is the in-thread reality — **15px flush prose**, capped at 66ch. The 17px gradient-bordered `.ai-response` card in §5 is the standalone primitive; the live chat renders flatter.) Citations are mono `brand-50` pills; the streaming caret is the 2px `brand-600` `.ai-caret`.

#### 7.1.8 Thinking / loaders

Before the first token: `ThinkingTrail` (live reasoning steps) **or** three pulsing `.ai-dot` (`brand-400`, 200ms stagger) — never both. For a running audit: `InlineAuditLoader` (`chat/ProgressiveLoader`) with `LOADING_STEPS`, plan → SQL → sources → results, `~40px` breathing room below.

#### 7.1.9 Evidence ledger

Inline 4-cell row (not a KPI glass grid): `divide-x` hairlines, Source Serif 4 numerals at 28px tabular, Inter sentence-case labels.

#### 7.1.10 Follow-ups — "What next?"

Heading `<h3>`: `mb-2 text-[0.75rem] font-medium tracking-normal text-ink-900`, fades in (`delay 0.35`). Chips wrap (`flex flex-wrap gap-2`), each: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.8125rem] leading-tight`; rest `bg-canvas-elevated text-ink-700 border border-canvas-border`, hover/selected `bg-brand-50 text-brand-700 border-brand-200`. **Cascade reveal** (the sanctioned pattern): per-chip `delay: 0.4 + i*0.13`, `duration 0.48`, expo-out `[0.22,1,0.36,1]`; hover spring `stiffness 700, damping 32, mass 0.12`.

#### 7.1.11 Clarification

`ClarificationBlock` (audit-query) and legacy `ClarificationCard` (`chat/ClarificationCard`, workflow flow) — inline choice cards above the composer, never modals, so the user can answer inline or bypass and type. `AssumptionsPanel` (`chat/AssumptionsPanel`) is the collapsible "assumptions made" list.

#### 7.1.12 Plan-approve gate (`qna-plan`)

Approve: `h-9 px-3.5 rounded-md bg-primary hover:bg-primary-hover text-white text-[0.75rem] font-semibold` + `CheckCircle` 13. Revise: `h-9 px-3 rounded-md bg-canvas-elevated border border-canvas-border text-[0.75rem] font-semibold text-ink-700 hover:border-brand-200` + `Pencil` 12.

#### 7.1.13 Workspace panel (`ChatWorkflowWorkspace`)

Right-side panel that slides in on a result. Tab strip is a segmented control with a Framer `layoutId` sliding pill. Sources tab uses the rich `SourceCard` (brand-tinted icon chip, live status ping, type pill, mono table chips). Embeds `ConfigurableChart` (same engine as Dashboard) for result graphs and `KpiTile` for headline metrics; `FullscreenChartModal` / `FullscreenTableModal` expand either to a focused overlay (`w-[800px] max-w-[92vw] max-h-[88vh] rounded-2xl`).

#### 7.1.14 Result actions

`ExportReportButton`, `AddToDashboardModal`, `AddToReportModal` (`chat/*`) push a result into a dashboard widget or report, with the launch-button micro-interaction (`launch-ripple` / `launch-shimmer` in `index.css`). Inline link affordance to the workspace: `text-xs text-ink-500 hover:text-ink-800` + `ArrowUpRight` 12. `useToast` (`shared/Toast`) handles confirmations.

### 7.2 Dashboard (`dashboard/DashboardView.tsx`) — incl. the graph

A `react-grid-layout` canvas of draggable, resizable widgets. Specs below come from `DashboardView.tsx`, `shared/KpiTile.tsx`, and `dashboard/add-widget/ConfigurableChart.tsx`.

#### 7.2.1 Grid canvas

`react-grid-layout`, styled in `index.css`: drag placeholder `bg-brand-200`, `opacity 0.4`, `border-radius 16px`; resize handle is an 18×18 corner whose chevron is `border-#94A3B8` at rest → `brand-600` on `.react-grid-item:hover`; dragging item gets `z-50` + `cursor: grabbing`.

#### 7.2.2 KPI tile (`shared/KpiTile.tsx`)

- Card: `glass-card rounded-xl px-5 py-4 hover:border-brand-200 hover:shadow-[0_12px_28px_-14px_rgba(15,8,30,0.22)] transition-[border-color,box-shadow] duration-300`.
- Label: `text-[0.6875rem]` (11px) `font-semibold text-ink-500 uppercase tracking-wide mb-2 truncate`.
- Value: `text-[1.625rem]` (26px) `font-bold text-ink-900 leading-none tabular-nums`, animated by `KpiCountUp` (`delay 120 + index*80`).
- Mount: spring `stiffness 320, damping 18, mass 0.7, delay 0.08 + index*0.08`. Hover: `y:-3, scale 1.015` spring `420/22`. The `.card-kpi` active state (in `index.css`) adds a 2px `brand-600` bottom border.

#### 7.2.3 The graph (`ConfigurableChart`, Recharts)

Six widget types, selected by `type`: **Line**, **Area**, **Bar**, **Pie**, **Table**, **KPI**.

- **Series palette (categorical, not RAG):** `PURPLE #7C3AED`, `BLUE #3d68ee`, `GREEN #10b981`, `AMBER #f59e0b`, `GRAY #9ca3af`; pie set `[#3d68ee, #10b981, #f59e0b, #ef4444, #8b5cf6]`; editable 10-color palette `#6a12cd, #0ea5e9, #10b981, #f59e0b, #ef4444, #ec4899, #8b5cf6, #14b8a6, #f97316, #06b6d4`. Base color default `#7C3AED`.
- **Line / Area (AreaChart):** actual series `type="monotone" strokeWidth={2}`, `dot r:4 strokeWidth:0`, `activeDot r:6 stroke #fff strokeWidth:2`; **target series** `strokeWidth={2} strokeDasharray="5 5"` (the dashed goal line). Grid `CartesianGrid strokeDasharray="3 3" stroke #f0f0f0` (Area variant uses `#e5e7eb`), `vertical={false}`. Axis labels `fontSize 12 fill #9ca3af`.
- **Bar:** `<Bar radius={[4,4,0,0]}>` (rounded top), often combined with a `<Line strokeWidth={2.5}>` overlay. Grid `stroke #e5e7eb`.
- **Pie:** `outerRadius={pieOuterRadius}`, slice colors from the pie set.
- **Table widget:** header `text-[0.625rem] font-bold text-[#6a12cd] uppercase tracking-[0.5px]` on `bg-[#faf5ff]/40`; rows `hover:bg-[#faf5ff]/30`, first column `text-[#6a12cd] font-medium`; aggregation footer row `bg-[#faf5ff] border-t-2 border-[#6a12cd]/20`.
- **Tooltips:** value emphasis in `text-[#26064a]` (brand-900). Numbers tabular; the chart container's focus outline is suppressed (`.recharts-wrapper` rule in `index.css`).
- **Empty state:** `size-20 rounded-2xl bg-[#f4f0ff]` icon chip + `stroke #6a12cd` glyph at `opacity 0.3`, "Add Columns" in `text-[#26064a]`.

#### 7.2.4 Widget builder (`AddCardModal` + formatting sections)

`AddCardModal` (`dashboard/add-widget/AddCardModal`) hosts the configuration panels:
- `LegendSection` — legend placement/visibility.
- `TypographySection` (`…/imports/TypographySection-1760-98`) — per-widget type.
- `ConditionalFormattingSection` — threshold-based cell/series coloring.
- `DataSeriesFormattingSection` — per-series color from the editable palette.

#### 7.2.5 Supporting components

- `WhiteDropdown` (`dashboard/add-widget/WhiteDropdown`) — white option menu (`z-popover`).
- `FileTreeView` (`dashboard/add-widget/FileTreeView`) — dataset/source tree when binding data.
- `AddDataModal` (`dashboard/AddDataModal`) — attach a dataset.
- `Orb` (`shared/Orb`) — ambient "ask about this dashboard" affordance. `useToast` for toasts.

### 7.3 Home (`home/HomeView.tsx`)

The one sanctioned decorative surface — the hero ships two ambient radial gradients (`brand-500` top-right + `brand-400` bottom-left) inline. Everywhere else stays neutral.

#### 7.3.1 Hero
Source-serif greeting over the two-gradient ambient field. The only place outside the chat empty state that carries decorative gradients.

#### 7.3.2 `NotificationRow` (`notifications/NotificationRow`)
Activity-feed rows built on the `.feed-item` primitive (`index.css`): transparent at rest, `hover:bg-brand-50` with a `canvas-border` outline, **no shadow**, `transition-background-color 200ms`.

#### 7.3.3 `SeverityBadge` (`shared/StatusBadge`)
See §7.10.4 — border-less, icon-less, spelled-out severity pills.

### 7.4 Knowledge Hub (`knowledge/KnowledgeHubView.tsx`) → Data Sources

`KnowledgeHubView` is a tab shell: `UnderlinedTabs` host `DataSourcesView` (the gallery) + a `SmartLearnComingSoon` placeholder, with `FloatingLines` ambient motion. **The contact-sheet gallery itself lives in `data-sources/DataSourcesView.tsx`** (replaced the old rail+preview reading pane 2026-06-01 — don't restore the rail or rebuild a rejected layout).

#### 7.4.1 View toggle (Gallery / List)
Segmented control, `viewMode` persisted in `localStorage('kh:viewMode')`. Icons `LayoutGrid` / `Rows3` (size 15); active icon `text-brand-700`, inactive `text-ink-500`; a sliding pill sits behind (`relative z-10` icons).

#### 7.4.2 Gallery grid
`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.

#### 7.4.3 Source card (`DataSourceCard`)
`group w-full flex items-center gap-3 px-4 py-3.5 rounded-lg bg-canvas-elevated border transition-colors duration-200`. Rest `border-canvas-border hover:border-brand-300`; selected `border-brand-500 bg-brand-50/50`. Hover (Framer): `y:-3, boxShadow 0 8px 24px -10px rgb(15 8 30 / 0.16)`, spring `400/30`; tap `scale 0.99`. Icon tile `w-10 h-10 rounded-lg` (tone-colored) with an absolute hover checkbox (`bg-paper-0 border-ink-300`, `opacity-0 group-hover:opacity-100 hover:border-brand-500`) so layout never shifts. **Footer carries the hierarchy:** files show `size · date` (neutral `ink-500`); integrations show a live status dot + label — `compliant` dot + `text-compliant-700` "Connected", or `mitigated` dot + `text-mitigated-700` "Needs reconnection" — so the two kinds read apart at a glance.

#### 7.4.4 Pagination
Below the grid, centered: `Showing N of M sources`, then a quiet reveal button `Load {n} more` + `ChevronDown` (`h-10`, `border-canvas-border` → hover `brand-200`/`brand-50`, chevron nudges down 0.5 on hover). Not a primary CTA — a calm "reveal the next page" affordance, never the loudest thing on screen.

#### 7.4.5 Detail (`DataSourceDetailView`)
Click a card → `DataSourceDetailView`; overlay `fixed inset-0 z-30`, ESC/keyboard to close. **Header is a flat hairline card** (`rounded-xl border border-canvas-border bg-canvas-elevated`) — **no gradient hero, no ambient lines, no floating shadow**; it opens on the same calm surface as the gallery. `bg-brand-50` icon square + `brand-700` glyph, ink title, a `brand-50`/`brand-700` format chip, `StatusPillFlat` for status, and a neutral download tile that tints to brand on hover. Inline rename via the bespoke 18px header editor (recolored for the light surface; ✓ `brand-700`, ✕ `ink-500`). Body branches: a **folder** → reading pane (finder list + live preview, bounded height); a **single file** → its always-open preview card fills the page; a **multi-file** source → a contained file-list card (`rounded-xl border` + `divide-y` rows), each row reusing `InlineRename` (`sm`) to rename and `StatusPillFlat` for status — never bare rows floating on canvas. Supporting: `Button`, `ConfirmationModal`, `DataPickerModal`, `useToast`.

### 7.5 Report (`reports/ReportsView.tsx`) + Report reader

The only surfaces that wear **warm paper** (`paper-50` / `paper-100`) instead of canvas — "deliverable, not control." Evidence excerpts may be Source Serif 4 italic; reader column ~960px.

#### 7.5.1 `ReportBuilder` (`reports/ReportBuilder`)
Compose a report from query results.

#### 7.5.2 `WidgetPickerParts` (`chat/WidgetPickerParts`)
`SectionHeader`, `Checkbox`, `KpiPreviewRow`, `TablePreviewRow` — pick which KPIs/tables/charts to embed (driven by `setAll` / `toggleIn` from `widgetPickerHelpers`).

#### 7.5.3 Embedded result components
`ConfigurableChart` (charts, §7.2.3), `SmartTable` (tables, §7.10.3), `KpiCountUp` (`shared/KpiTile`, animated numerals), `renderAssistantText` (`shared/AssistantMarkdown`, narrative prose).

#### 7.5.4 `StatusBadge` + `BulkAuditVariantView`
Status/severity pills (§7.10.4); `BulkAuditVariantView` (`reports/BulkAuditVariants`) for bulk/variant runs. `FloatingLines` / `useToast` round it out.

### 7.6 Governance — Control Library, RACM, Risk Register

Dense data surfaces (`governance/RACMView`, `ControlLibraryView`; Risk Register).

#### 7.6.1 `SmartTable` (`shared/SmartTable`)
The DataGrid for all three — full spec in §7.10.3. Row-select = `brand-600` left border + `brand-50` tint.

#### 7.6.2 `CreateControlDrawer` (`governance/CreateControlDrawer`)
Right drawer to add a control (`NewControlData` payload).

#### 7.6.3 `ControlDetailView` (`governance/ControlDetailView`)
Per-control detail page.

#### 7.6.4 `Orb` + `useToast`
Ambient "ask IRA about this register" affordance; toasts. Severity always via the border-less spelled-out pills (§7.10.4) — never a RAG ramp.

### 7.7 Execution — Control Testing, Evidence, Findings

Workpaper surfaces (`execution/ControlTestingView`, `EvidenceView`, `FindingsView`).

#### 7.7.1 Alert cards (the single sanctioned side-stripe)
Findings use the `.card-alert-critical` / `-high` / `-medium` primitives (`index.css`): a **3px left-edge** `risk` / `high` / `mitigated` border, `box-shadow: none`. This is the only side-stripe in the system; do not generalize.

#### 7.7.2 `SmartTable` + `Orb`
Evidence/testing tables reuse `SmartTable` (§7.10.3); each view embeds `Orb` for inline AI. Evidence references use Evidence Blue (`#0369A1`) + mono citation chips.

### 7.8 Sidebar (`sidebar/`, chrome on every surface)

The only persistently dark surface.

#### 7.8.1 Shell
`brand-900` (`#26064A`) with the 1.8%-opacity `.noise-texture` overlay (`index.css`). Dividers `rgba(255,255,255,0.08)`.

#### 7.8.2 `NavItem` groups
Order: **Ask IRA / Home · Recents / Audit Planning · Engagements · Engagement Config · Engagement Final / Dashboard · Report · Risk Register / Control Library · Workflow Library / Knowledge Hub / Admin.**

#### 7.8.3 `NavItem` states
Rest transparent → hover `rgba(255,255,255,0.08)` → active `rgba(255,255,255,0.12)`; text `rgba(255,255,255,0.85)` lifting to full white when active. (Tokens: `--color-sidebar-*` in `index.css`.)

### 7.9 Modals & overlays (`modals/`, `shared/`)

Layering scale (`index.css`): `--z-popover 100` < `--z-modal 200` < `--z-toast 300`.

#### 7.9.1 `ConfirmationModal` (`shared/ConfirmationModal`)
Destructive/confirm dialogs.

#### 7.9.2 `ModalPrimitives` (`chat/ModalPrimitives`)
Shared dialog shell: overlay + surface (`bg-canvas-elevated rounded-2xl border border-canvas-border`, common widths `w-[28rem]` / `w-[32rem]` / `w-[800px]`, all `max-w-[92vw]`) + close.

#### 7.9.3 `Toast` (`shared/Toast`)
`useToast` provider; success / error / info (`z-toast`).

#### 7.9.4 `useModalA11y` / `useDialogA11y` (`chat/useModalA11y`)
Focus trap + ESC + restore focus.

### 7.10 Shared primitives (exact specs)

Defined once in `shared/`, reused across surfaces.

#### 7.10.1 `Button` (`shared/Button.tsx`)
Single source of truth. 6 variants × 2 sizes (`sm` h-7/text-xs, `md` h-9/text-sm) × 4 shapes (`md`/`lg`(default)/`xl`/`full`). Base: `inline-flex items-center justify-center font-medium transition-[…] duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1`. Primary `bg-primary text-white shadow-sm shadow-brand-900/10 hover:bg-primary-hover hover:shadow-md`; stop `bg-ink-900 text-white`; destructive `bg-risk text-white`; outline `bg-canvas-elevated border border-canvas-border hover:bg-brand-50 hover:border-brand-200`; ghost `bg-transparent text-text-muted hover:bg-brand-50`; secondary `bg-brand-50 text-brand-700`. Pressed: ghost → `bg-primary/10 text-primary`, outline → `bg-primary/5 border-primary/30 text-primary`.

#### 7.10.2 `KpiTile` / `KpiCountUp` (`shared/KpiTile.tsx`)
Full spec in §7.2.2 (`glass-card rounded-xl px-5 py-4`, 11px label, 26px tabular value).

#### 7.10.3 `SmartTable` (`shared/SmartTable.tsx`)
Table `w-full text-[0.8125rem]` (modern) / `text-[0.75rem]`. Header row `border-b border-border-light` (modern) or `bg-surface-2 border-b border-border-light`. Cells `py-3`. Search input `pl-8 pr-8 py-1.5 border border-border bg-white text-[0.75rem] rounded-[8px]`, focus `border-primary/40 ring-2 ring-primary/10`. Expand-row detail `px-10 py-4 bg-surface-2/50 border-b border-border-light`. Footer/pagination `px-4 py-3 border-t border-border-light bg-surface-2/30`, page buttons `p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30`. Empty state `w-10 h-10 rounded-xl bg-surface-2` icon + `text-[0.8125rem] font-medium text-text-secondary`.

#### 7.10.4 `StatusBadge` / `SeverityBadge` (`shared/StatusBadge.tsx`)
Flat pill, **no border, no icon**: `inline-flex items-center px-2.5 h-6 rounded-full text-[0.75rem] leading-[16px] font-medium whitespace-nowrap tabular-nums`. Tones: `risk` `bg-risk-50 text-risk-700`, `high` `bg-high-50 text-high-700`, `mitigated` `bg-mitigated-50 text-mitigated-700`, `compliant` `bg-compliant-50 text-compliant-700`, `evidence` `bg-evidence-50 text-evidence-700`, `info` `bg-brand-50 text-brand-700`, `draft` `bg-draft-50 text-draft-700`. Labels spelled out (`Critical`, not `C`).

#### 7.10.5 `InlineRename` (`shared/InlineRename.tsx`)
The "click to rename in place" editor — single source of truth across the Knowledge Hub data-source surfaces (grid tile, list row, file row). Auto-selects on mount; **Enter or blur commits, Escape cancels**; the ✓/✕ buttons use `onMouseDown`-preventDefault so a click doesn't blur-commit first. Input: `flex-1 min-w-0 text-[0.875rem] font-semibold text-ink-900 bg-canvas-elevated border border-brand-600 focus:outline-none`, sized by the `size` prop — `md` (default) `h-8 px-2.5 rounded-lg` for cards, `sm` `h-7 px-2 rounded-md` for the denser file rows. Save `<Check 15>` `text-brand-700 hover:bg-brand-50`, cancel `<X 15>` `text-ink-500 hover:bg-brand-50`, both `p-1.5 rounded-md`. The detail-view **hero header** rename stays bespoke (white ✓/✕ over the brand header) — it is intentionally not this primitive.

#### 7.10.6 Other shared primitives
`Orb` (ambient "ask IRA here"; Dashboard/Governance/Execution), `FloatingLines` (empty-state line motion; Chat/Knowledge Hub/Reports), `GlassCard` (`.glass-card` flat-at-rest card), `AssistantMarkdown` (markdown → prose + mono citation pills), `Toast` / `ConfirmationModal` (everywhere), `Breadcrumbs`, `DateFilterPicker`, `TextShimmer`, `HelloEffect`, `Persona` / `AIPersona`.
