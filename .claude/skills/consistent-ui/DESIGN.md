# DESIGN.md — Reuse Ledger

> Maintained by the `consistent-ui` skill. Read this at the start of any UI work;
> append to it whenever a new component or token is added. The goal: never
> re-invent something a past session already built.
>
> **This file is the reuse ledger, not the visual spec.** Tokens, type scale, and
> the full visual language live in the repo-root `/DESIGN.md` (the `editorial-grc`
> mirror, guarded by `scripts/sync-design.mjs`) — that file wins on any visual value.

---

## Principles

1. **Reuse before build.** Reuse → configure → compose → extend → (last resort) inline.
2. **Tokens are the only source of design values.** No arbitrary `[#hex]` / `[13px]`.
3. **Match conventions, not just colors** — file location, naming, prop API, states.
4. **Every addition is recorded here**, with the reason nothing existing fit.

---

## Component Registry

> One row per reusable component. Add a row when you extend the library (rung 4).
> Seeded from the existing library; not exhaustive — run the inventory script for the full list.

| Component | Path | Purpose | Variants / Sizes | Notes |
|-----------|------|---------|------------------|-------|
| Button | src/components/ui/Button.tsx | Primary action control | variant (default `outline`) · size sm/md/lg · leadingIcon/trailingIcon | ⚠️ A second `Button` exists in `shared/` — see Suggestions |
| Modal | src/components/shared/Modal.tsx | **Canonical centered modal shell** (detail / create / edit) | `width` prop (default `max-w-[560px]`) | Inter title `text-[1.25rem]`, `px-7`, `rounded-2xl`, `ink-900/40` overlay. Feature modals compose this — don't hand-roll the shell |
| Dialog | src/components/ui/Dialog.tsx | Low-level dialog primitive | — | Prefer `shared/Modal` for app modals |
| Input | src/components/ui/Input.tsx | Text input | — | |
| Select | src/components/ui/Select.tsx | Native `<select>` primitive (chevron bg-image) | sm h-7 / md h-9 · 13px | Use only for a real native control |
| AdminSelect | src/components/admin/AdminPrimitives.tsx | **Canonical dropdown** — trigger + floating listbox | sm h-8 / md h-10 | Use instead of native `<select>` (no OS-dark menu); brand check on selected. Specialized: `ColumnFilter`, date pickers, dashboard `CustomDropdown`. See DESIGN.md §7.10.7 |
| Textarea | src/components/ui/Textarea.tsx | Multi-line text input | — | |
| SmartTable | src/components/shared/SmartTable.tsx | Data table — **default for any list** | `variant` default / modern | Denser registry tables `ExceptionsTable` + `RacmListTable` are deliberate domain exceptions; don't hand-roll new ones |
| Pill + badge family | src/components/shared/StatusBadge.tsx | All status chips/tags | `Pill` (`variant` **bordered=default** / flat) + `StatusBadge` · `SeverityBadge` · `ActionBadge` · `ResultBadge` · `FrameworkBadge` · `TypeBadge` | **Tone-driven, never hand-roll an inline status span.** 7 tones; labels spelled out; no RAG strip. **Bordered+semibold is the default status everywhere**; `variant="flat"` is the quiet opt-out |
| KPI family | KpiTile · AdminKpiRow · add-widget/KpiCard | KPI metric display | KpiTile (26px, Dashboard) · AdminKpi/StatLedger (18px, Admin) · KpiCard (32px, widget-builder) | pick by surface; all share tabular-nums + KpiCountUp |
| EmptyState | src/components/shared/EmptyState.tsx | Empty-state block | content-sized, centered (never fixed-width) | |
| Toast | src/components/shared/Toast.tsx | Transient notification | — | |
| CommandPalette | src/components/shared/CommandPalette.tsx | ⌘K command palette | — | |
| ConfirmationModal | src/components/shared/ConfirmationModal.tsx | Confirm / destructive dialog | `tone` destructive / primary · `pending` | shadcn AlertDialog in-theme: `rounded-2xl p-6` (matches Modal radius), no icon/X, Cancel+confirm bottom-right via shared `Button`. **Use for every confirm — never hand-roll** |
| Skeleton | src/components/shared/Skeleton.tsx | Loading placeholder | — | |
| Breadcrumbs | src/components/shared/Breadcrumbs.tsx | Breadcrumb nav | — | |
| InitialsAvatar | src/components/admin/AdminPrimitives.tsx | Monochrome initials avatar | size prop (default 32) | **Reuse for any people list.** `bg-brand-100 text-brand-700` ring — never a rainbow / per-person avatar |
| AdminKpiRow / AdminKpiCard | src/components/admin/AdminPrimitives.tsx | 4-up KPI band, click-to-filter | active / `tone:'attention'` | KPI band for admin-style sections (grid 2/lg:4, spring cascade, inset brand baseline when active) |
| MemberSearch | src/components/admin/AdminPrimitives.tsx | Search-left input | h-10 rounded-lg | toolbar search (glyph-left, clear-on-X) |
| StatLedger | src/components/admin/AdminPrimitives.tsx | Inline `label · value` stat strip | clickable (filter) | dense alternative to the KPI band |
| adminTokens | src/components/admin/adminTokens.ts | Shared admin form / button / row classes | FIELD_INPUT/LABEL · BTN_CANCEL/PRIMARY/CTA_*/ROW · presetChip | the single class source `AdminView` + `RolesWorkspace` consume — extend here, don't re-inline |
| ValueSection | src/components/usage/ValueSection.tsx | Titled section card on Platform Value (header inside the card, hairline body) | — | Surface-local, the shape `audit/SectionCard` uses. Header `px-5 py-3.5`, blurb capped at 78ch, body `divide-y`. Padding matches `SmartTable` modern cells so a table lines up with its heading |
| ValueTable | src/components/usage/ValueTable.tsx | Platform Value's summary tables | — | A thin `SmartTable` `variant="modern"` wrapper (no card of its own, no search/sort/paging/striping/cascade) + `note` slot in a header cell. Replaced six hand-rolled `<table>`s. **Not a new table** — reuse `SmartTable` directly elsewhere |

---

## Tokens Added

> Tokens introduced beyond the original tokens file. Add a row when you create one.
> Tokens are authored in `editorial-grc` (then synced) — this table just tracks them.

| Token | Value | Category | Used by |
|-------|-------|----------|---------|
| `--color-sidebar-surface` | `rgba(255,255,255,.06)` | color | On-dark hover/active fills (sidebar shell) |
| `--color-sidebar-text-dim` / `-muted` | `rgba(255,255,255,.55)` / `.45` | color | On-dark secondary / meta labels |
| `--color-paper-300` | `#D6CCB7` | color | Warm hairline borders on paper/report surfaces |
| `--color-{risk,high,mitigated,compliant,draft}-50/700` | tint / ink pairs | color | `StatusBadge` / `SeverityBadge`, admin status pills |
| `--color-evidence-50…700` | full ramp | color | Source / citation chrome |

---

## Decisions Log

> Short, dated entries for notable choices — why a new component was needed,
> why a pattern was chosen, what was consolidated.

- 2026-06-04 — Installed `consistent-ui` skill. Set visual canon = root `/DESIGN.md`
  (editorial-grc mirror, read-only); reuse ledger = this file (writable). Variants
  authored as const lookup maps + `cn()` (no cva/tailwind-variants). Seeded registry
  from existing `ui/` + key `shared/` components.
- 2026-06-08 — Reconciled docs with shipped code after the admin-panel branch.
  Recorded the `admin/` primitives (InitialsAvatar, AdminKpiRow, AdminSelect,
  MemberSearch, StatLedger, adminTokens) so admin-style work reuses them instead of
  re-inlining. Root `/DESIGN.md` gained §2 token coverage (now 72/72) and §7.11–§7.18
  surface specs (Admin, Auth, Recents, Engagements, Workflow Builder, Exceptions,
  Intelligence, Notifications). Admin avatars are monochrome by rule — never per-person colour.

- 2026-09-09 — **Platform Value tab re-dressed in platform components.** The tab was a
  stack of ten identical hairline slabs with the heading floating outside each one, six
  hand-rolled `<table>`s, bespoke KPI tiles and 12px prose running the full page width.
  Now: `ValueTile` wears the `AdminKpiCard` vocabulary (brand-50 icon chip, 18px bold
  tabular value, 12px label, the admin spring cascade at `0.08 + i*0.08`) so the band
  matches the one on Usage and cost next door; `ValueSection` puts the title inside the
  card; the tables are `SmartTable` (§7.10.3) via `ValueTable`; every measure is capped
  at 78ch and every gutter is `px-5`. No icon chips on section headers — type and
  hairlines carry those, per the minimal-UI rule. Connectors and Usage and cost untouched.

---

## Suggestions (open)

> Drift the skill has spotted but not yet acted on. Resolve or dismiss over time.

- Two `Button` implementations exist: `src/components/ui/Button.tsx` and
  `src/components/shared/Button.tsx`. Decide the canonical one and consolidate; update
  imports across the app. Until resolved, default new work to `ui/Button.tsx`.
- Two avatars exist: the canonical **monochrome** `InitialsAvatar` (`admin/AdminPrimitives.tsx`)
  and a legacy **rainbow** `Avatar` (`shared/StatusBadge.tsx`, per-name colour from a 7-hue
  array). The rainbow one violates the monochrome rule — migrate its callers to `InitialsAvatar`
  and retire it. Until then, default new work to `InitialsAvatar`.
- Home's overdue badge (`home/HomeView.tsx` ~L332 + the ~L4449 OVERDUE filter button) is a
  bespoke **loud** chip (uppercase + `AlertTriangle` icon + 6px border). The on-spec replacement
  is the **bordered alert-pill** variant (DESIGN.md §7.10.4): flat-pill geometry + `tone-200`
  border, title-case, no icon/caps, full radius. Documented + previewed but **not applied yet**
  (owner's call) — migrate these two when next touching Home.

---

## Conventions (the house style)

> The skill mirrors these when extending.

- **Components dir:** `src/components/` — primitives in `src/components/ui/`, composed reusables in `src/components/shared/`
- **Tokens file:** `src/index.css` (`@theme` block, Tailwind v4 CSS-first — no `tailwind.config.js`)
- **Variants authored with:** plain const lookup maps (`VARIANTS`/`SIZES` objects) merged via `cn()` — NOT cva/tailwind-variants/clsx
- **`cn()` location:** `src/lib/cn.ts` (hand-rolled; no `clsx`/`twMerge`)
- **Prop vocabulary:** `variant`, `size`, `className` passthrough via `cn()`
- **States covered by interactive components:** default, hover, focus-visible, active, disabled, loading
- **Naming:** PascalCase files, one component per file, named export
- **Locked constraints:** chat column = `52.5rem` (do not change); empty-state chips content-sized & centered (no `w-[...]` locks)
