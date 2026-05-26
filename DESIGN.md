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

### Hierarchy

- **Display** (Source Serif 4, weight 420, `clamp(2rem, 4vw, 3rem)`, line-height 1.2): Hero on the empty Auditify Chat home (`hello`, `Audit smarter. Not harder.`). Used once per page maximum.
- **Headline** (Source Serif 4, weight 500, 1.5rem, line-height 1.25, letter-spacing -0.01em): Section openers, chat thread titles, workspace tile titles.
- **Title** (Inter, weight 600, 1rem, line-height 1.35): Card headings, dialog titles, accordion labels.
- **Body** (Inter, weight 400, 0.9375rem / 15px, line-height 1.65): Chat messages, body copy, AI responses. **Max line length: 65–75ch.** AI responses cap at 66ch.
- **Meta** (Inter, weight 500, 0.8125rem / 13px, line-height 1.4): Dense labels, timestamps, secondary chrome. The `--text-meta` token.
- **Mono** (JetBrains Mono, weight 400, 0.75rem / 12px, line-height 1.5): Citation chips, code, IDs, evidence excerpts, metadata above AI responses.

### Named Rules

**The Tabular Number Rule.** Every numeric value in the product — KPIs, table cells, timestamps, percentages, currency, IDs, version numbers — uses `font-variant-numeric: tabular-nums`. Mixed-width numerals are a bug. There is a `.tabular` utility for any element that escaped the global setting.

**The Source Serif Authority Rule.** Source Serif appears only at three places: the hero, section openers, and evidence quotes (when an excerpt is set in serif italic). Everywhere else, Inter. Reserving the serif keeps it loud.

**The Mono For Truth Rule.** JetBrains Mono is reserved for verifiable atoms: code, IDs, citation refs, file paths, version numbers, evidence excerpts. It signals "this is the literal value, you can audit it." Decorative mono is prohibited.

**The 66ch Response Rule.** AI response prose is capped at 66ch line length. Wider than that and the chat starts to read as a document instead of a conversation. Workspace tables and tiles are exempt.

## 4. Elevation

The Editorial GRC doctrine is **borders before shadows, shadows sparingly, tinted glow chrome never.** The visual depth comes from the warm canvas + clean sheet contrast (canvas is `#FCFAFD`, elevated sheet is `#FFFFFF`) plus the body-level radial gradient mesh that softens the page. Cards are flat at rest. State changes — hover, focus, drag — earn the small amount of motion and shadow that exists.

### Shadow Vocabulary

- **Hairline at rest** (`box-shadow: 0 1px 2px rgba(15, 8, 30, 0.04)`): The AI input border and a handful of elevated surfaces wear this almost-imperceptible shadow. The ink color matches `ink-900` so the shadow inherits the brand's warmth.
- **Lifted hover** (`box-shadow: 0 8px 24px rgba(15, 8, 30, 0.04)`): Hovering large surfaces (the AI border, primary CTAs in some contexts). Diffuse, never crisp.
- **Focus glow** (`box-shadow: 0 12px 32px rgba(106, 18, 205, 0.10), 0 0 0 4px rgba(106, 18, 205, 0.10)`): The focus-within state on the AI input. The 4px outer ring is the global focus signature.
- **Focus ring** (`box-shadow: 0 0 0 4px rgba(106, 18, 205, 0.24)`): Applied globally to every interactive element on `:focus-visible`. The single most consistent visual signature in the product.

### Named Rules

**The Border-First Rule.** Depth starts at a 1px `canvas-border`. If a card needs separation from its surroundings, the border is the answer; reach for shadow only when the surface is hovering or actively focused.

**The No-Glow Rule.** Decorative glow chrome around AI surfaces is explicitly prohibited and has been actively removed from the codebase (`ai-glow`, `ai-shimmer`, `ai-pulse-ring`, `ai-float` are all neutralized to no-ops). If you're tempted to make something glow because it's "AI," the answer is no.

**The Focus Ring Is Sacred Rule.** The 4px `brand-600 @ 24% alpha` focus ring appears on every focusable element. It is the single accessibility signature of the product. Do not remove it, do not restyle it per-component. The `.no-focus-ring` opt-out exists only for chat composer inputs where the ring competes with the surrounding ai-border focus glow.

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
- **Corner Style:** `rounded-lg` (12px) for the default card; `rounded-xl` (16px) for the AI response surface and the AI input border (`rounded: 1.5rem`).
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
- **Style:** `canvas-elevated` background, 1px `canvas-border`, `rounded: 1.5rem` (24px), subtle resting shadow (`0 1px 2px rgba(15,8,30,0.04), 0 8px 24px rgba(15,8,30,0.04)`).
- **Focus-within:** Border shifts to `brand-300`, shadow deepens with the `brand-600 @ 10%` lift, plus the global 4px focus ring at `@ 10%`. This is the only element in the product that combines all four signals; it earns it.

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
