# AI Concierge — UX / UI / Design-System Discrepancies

In-depth review of each ported AI Concierge tool through **three lenses**, one table per tool:

- **UX** — `/ux-heuristics` (Krug's laws + Nielsen's 10 heuristics)
- **UI** — `/ui-design-review` (visual hierarchy, typography, colour, spacing, consistency, components)
- **DESIGN.md** — compliance with the repo's design system (`./DESIGN.md`), section numbers cited

Basis: each tool's source + `ConciergeKit`, plus captured idle + result screenshots. Severity ∈ Critical / High / Med / Low. Scores are the reviewer's 0–10 assessment. _Generated 2026-06-16. The tools are a functional mock; a few findings (e.g. empty file data) are intentional prototype conventions — see [[prototype-file-data-mock]]._

---

## Cross-cutting themes (fix once, benefits all tools)

These recur across most/all six tools — the highest-leverage fixes:

1. **Hand-rolled status pills** instead of the canonical `Pill` / `SeverityBadge` / `StatusBadge` (DESIGN.md §7.10.4 "never hand-roll an inline status span") — **all six**.
2. **No-RAG-Rule violations** (§2) — side-by-side risk/mitigated/compliant tallies or per-card colour stripes that read as a red→amber→green heat strip — Forensics, Image, Speech, Medical, Insights.
3. **Disabled primary CTA** rendered as a filled lavender bar (`bg-brand-100 text-brand-300`) that reads as active, with no "add a file to run" hint — Forensics, Speech, Medical, Insights.
4. **Off-scale radii** (`rounded-[10px]` / `rounded-[14px]`) vs the token scale (`lg`=12 / `xl`=16) — most tools.
5. **Missing Source Serif** on section openers / headline numerals (§3, §7.1.9) — Speech, Medical, Insights, Table.
6. **Bespoke `<table>`** instead of the mandated `SmartTable` (§7.10.3) — Speech, Medical, Table.
7. **Hover-only information** (flag reasons hidden in `title=` tooltips) — Medical, Table, Forensics.
8. **History "Open" rebuilds a generic result** (`buildResult([], {})`) instead of hydrating the chosen row — Image, Medical, Insights.
9. **Redundant status / counts** restated across surfaces (violates "say each fact once") — Image, Medical, Insights.
10. **Shell AI-chrome** (`FloatingLines`, pulsing `Sparkles` "Did you know?") vs the No-Glow / no-sparkle doctrine (§4, §6) — shell-wide in `ConciergeKit`.

---

### Document Forensics
**Scores:** UX 7/10 · UI 7/10 · DESIGN.md 4/10

| # | Lens | Severity | Discrepancy | Recommendation |
|---|------|----------|-------------|----------------|
| 1 | DESIGN.md | Critical | Every `ModuleCard` carries a 3px colored left-stripe (`border-l-[3px]`) across ~10 cards. §5/§7.7.1: the side-stripe is the *single* sanctioned pattern, scoped to Alert Cards only — not feature/list cards. | Drop the stripe on module cards; convey tone via the score number colour (already present) or a flat Pill. |
| 2 | DESIGN.md | Critical | Content/Forensic grids place red/ochre/green-striped cards side by side — a de-facto heat grid (No-RAG Rule §2). | Remove the per-card colour ramp; scores read as neutral numerics with a single inline severity pill where flagged. |
| 3 | DESIGN.md | High | Status chips hand-rolled: `RiskBadge`, the action pill, `SEVERITY_META`, evidence-table tags (§7.10.4). | Route through `SeverityBadge` / `Pill` (inherits tokens, title-case, tabular-nums). |
| 4 | DESIGN.md | High | Off-scale radii: `rounded-[10px]` (module/key-finding cards), `rounded-[14px]` (summary card, dropzone), `rounded-[12px]` (evidence). | Snap to scale: cards → `rounded-xl`/`rounded-lg`; chips → `rounded-full`. |
| 5 | UI | High | On a "Medium risk" verdict the Key Findings cards still render `border-risk bg-risk-50` (three red cards under an amber badge) — colour contradicts severity. | Tint Key Findings to the doc's risk tone (mitigated for medium), or to each finding's own severity. |
| 6 | DESIGN.md | Med | `tabular-nums` missing on the donut score, "/100", and "88% confidence" (Tabular Number Rule §3). | Add `tabular-nums` to the donut value/label and confidence meta. |
| 7 | UX | Med | Idle "Run forensic scan" is a filled lavender bar (disabled) with no hint a file is required; reads clickable but inert (Nielsen #1/#5). | Make disabled state visibly inert + add "Add a document to enable", or hide the CTA until a file is picked. |
| 8 | UI | Med | The recharts donut + big centered number approximates the prohibited hero-metric template (§6); the system pattern is the inline Source-Serif ledger (§7.1.9). | Use the inline ledger or a slim score meter; if the donut stays, keep it small and pair the number with the risk label. |
| 9 | UX | Low | Tab labeled "Analyzer" while title/subtitle say "forensic scan" — inconsistent vocabulary (Krug: one term per concept). | Align the tab label with the tool's verb ("Scan"). |

---

### Image Analytics
**Scores:** UX 7/10 · UI 7/10 · DESIGN.md 5/10

| # | Lens | Severity | Discrepancy | Recommendation |
|---|------|----------|-------------|----------------|
| 1 | UX | High | Seeded `IN_PROGRESS` History row never resolves and has no Open action — a permanently stuck job users can only delete (Visibility of System Status). | Make the seed COMPLETED (openable) or add an explicit stalled/cancel affordance. |
| 2 | UX | Med | Hint promises "up to 50 MB each" but `UploadZone.add` silently drops over-size/wrong-type files with no message (Error Prevention/Recovery). | Surface a rejection note ("2 files skipped — over 50 MB") instead of dropping silently. |
| 3 | UX | Med | Idle dropzone copy is generic across all three sub-tabs; Compare's "needs 2" requirement only appears after upload. | Pass mode-specific labels ("Drag & drop images…") and state the "2+ images" rule up front. |
| 4 | DESIGN.md | High | Audit `StatusPill` is a hand-rolled span (icon + `text-[0.6875rem]`) — §7.10.4 (canonical Pill is icon-less, `h-6`, `text-[0.75rem]`). | Replace with `StatusBadge`/`SeverityBadge` (compliant/risk tones). |
| 5 | DESIGN.md | High | Audit KPI tally sets neutral / Compliant-green / Non-Compliant-red trio side by side — No-RAG Rule (§2). | Drop the tri-tile band; lead with one neutral "4 of 6 compliant" line, semantics on per-KPI badges. |
| 6 | DESIGN.md | Med | Shell uses prohibited AI chrome: `FloatingLines`, pulsing `Sparkles`, "Did you know?" panel (§4/§6 No-Glow / no sparkles). | Drop sparkle glyphs + animated header lines on tool surfaces (shell-wide). |
| 7 | UI | Med | Redundant status: audit result states pass/fail three times (tally tiles + per-card pill) — "say each fact once". | Keep the per-KPI badge as source of truth; reduce the tally to a single count line. |
| 8 | UI | Low | Off-grid radii/type: result cards `rounded-[14px]`/`rounded-[12px]`, values at `text-[1.75rem]` — off the rounded scale and type ramp. | Snap to `rounded-xl`/`rounded-lg` and the nearest ramp step. |
| 9 | UI | Low | Persistent "Beta" badge + a two-line subtitle crowd the header band and compete with the H1 on every sub-tab. | Make Beta a quieter tag (beside the back link) and tighten the subtitle to one line. |

---

### Speech Auditor
**Scores:** UX 7/10 · UI 7/10 · DESIGN.md 5/10

| # | Lens | Severity | Discrepancy | Recommendation |
|---|------|----------|-------------|----------------|
| 1 | DESIGN.md | High | "3 passed · 2 partial · 1 failed" places compliant-green / mitigated-ochre / risk-red pills side by side — the banned RAG strip (§2), and it restates the scorecard. | Drop the strip; let the scorecard carry status. If kept, state as plain text ("3 of 6 passed"). |
| 2 | DESIGN.md | High | `StatusPill`/`SentimentPill` are hand-rolled icon+label spans (§7.10.4). | Replace with `SeverityBadge` (Pass→compliant, Partial→mitigated, Fail→risk) + a flat Pill for sentiment; drop icons. |
| 3 | DESIGN.md | Med | Sentiment line drawn in `#6A12CD` (brand-600, the "pen") — §7.2.3 series colour is `#7C3AED`; brand-600 is reserved for interactive chrome (≤10%, §2). | Switch line/dots to `#7C3AED`; reserve `#6A12CD` for chrome. |
| 4 | DESIGN.md | Med | Controls scorecard is a bare `<table>` instead of `SmartTable` (§7.10.3); residual risk shown as a colour dot RAG ramp. | Render with `SmartTable`; residual risk via `SeverityBadge` tone, not a dot. |
| 5 | UI | Med | Result-view switcher is a static `bg-brand-50` pill toggle; the rest of the product uses a sliding-pill segmented control (`layoutId`, §7.1.13/§7.4.1). | Adopt the shared sliding-pill segmented pattern. |
| 6 | UX | Med | Idle "Run audit" looks active but is disabled until a file is added, with no hint (Visibility/Error Prevention). | Add "Add a recording to run" + a clearly muted disabled treatment. |
| 7 | UX | Low | The view toggle scrolls away with the long report, so on Transcript/Sentiment users lose the "you are here" control. | Make the result-view toggle sticky within the result area. |
| 8 | UI | Low | Toggle (`py-1.5` ~30px) and export buttons (`py-2`) fall below the 44×44px touch target. | Raise interactive height toward 44px. |
| 9 | DESIGN.md | Low | Section headers + sentiment numerals use Inter; §3/§7.1.9 reserve Source Serif 4 (tabular) for openers + ledger numerals. | Set result section openers + Overall/Lowest/Highest numerals in Source Serif 4 tabular. |

---

### Table Extractor
**Scores:** UX 7/10 · UI 7/10 · DESIGN.md 5/10

| # | Lens | Severity | Discrepancy | Recommendation |
|---|------|----------|-------------|----------------|
| 1 | DESIGN.md | High | Validation flags use raw `amber-*` (warn StatCard, flagged rows, flags panel); the GRC warning noun is `mitigated` (#B45309), and the palette is deliberately tilted off amber. | Swap every `amber-*` for `mitigated` / `mitigated-50` / `mitigated-700`. |
| 2 | DESIGN.md | Med | Four identical icon-tile + label + number summary cards — DESIGN.md "don't use identical card grids"; hero-metric template prohibited. | Lead with "Rows extracted" as headline; demote pages/files to a meta line; keep the flags card distinct. |
| 3 | UX | High | The schema only exists on the idle screen — after results there's no way to view/tweak it; fixing a column means "New analysis" from scratch (Nielsen #3). | Add a collapsed "Schema (4 fields)" summary or "Edit schema & re-run" in the result header. |
| 4 | UX | Med | Copy says "set up the schema below, then upload," but the dropzone sits *above* the schema builder (Nielsen #4 natural ordering). | Reorder to schema → dropzone, or renumber the flow. |
| 5 | UX | Med | A blank-name field is silently dropped from output (`filter(f => f.name.trim())`) with no warning or required marking (Nielsen #5/#1). | Mark empty-name fields with an inline error/disabled-run hint instead of silently excluding. |
| 6 | UI | Med | Schema controls are tiny/low-contrast: type `<select>` 11px, AI-hint 11px italic `ink-500`, name input has no visible label. | Raise type/hint to 12px, strengthen hint contrast, add a quiet label so the field reads as editable. |
| 7 | UI | Low | Trash + type select reveal only on row hover (`opacity-0 group-hover`) — invisible on touch/keyboard. | Keep secondary/destructive actions faintly visible at rest (`opacity-60`). |
| 8 | DESIGN.md | Low | Result header reuses the generic "Analysis complete"; DESIGN.md favours plain task-true language + Source Serif openers. | Use a task-specific title (e.g. "7 rows extracted"). |

---

### Medical Report Reader
**Scores:** UX 8/10 · UI 7/10 · DESIGN.md 5/10

| # | Lens | Severity | Discrepancy | Recommendation |
|---|------|----------|-------------|----------------|
| 1 | DESIGN.md | High | Per-report cards stack four tones at once (risk "Tampered", mitigated "Inconsistent", compliant ticks + brand banner) — a RAG ramp (§2/§6). | Surface one verdict noun per card (lead with the worst signal); demote the rest into the expanded detail. |
| 2 | DESIGN.md | High | Status pills hand-rolled `<span>`s ("Tampered", "Inconsistent", "N flagged"), several with leading icons (§7.10.4). | Replace with `SeverityBadge`/`StatusBadge`; drop in-pill icons; keep labels spelled out. |
| 3 | DESIGN.md | Med | Ad-hoc numeric sizes (`text-[1.25rem]`/`[0.8125rem]`/`[0.6875rem]`) off the type ramp; StatCard 20px value isn't a sanctioned KPI shape (§7.10.2). | Map to the documented ramp; reuse `KpiTile`/`AdminKpiCard` chrome for the stat cards. |
| 4 | DESIGN.md | Med | Result tables are a bespoke `<table>` instead of `SmartTable` (§7.10.3). | Render extracted tests via `SmartTable` (modern variant). |
| 5 | UX | High | Red-flag rationale lives only in a `title=` tooltip on the icon — hover-only, invisible to touch/keyboard, and it's the key "why" in a fraud tool (Nielsen #9). | Show the flag reason inline (expandable row or a reason column). |
| 6 | UX | Med | Tool says "runs in the background — keep working," but New analysis/History abandons the in-flight job and History "Open" always rebuilds the same fixture (Nielsen #1/#4). | Persist/restore the running job or drop the copy; make Open load the row's own result. |
| 7 | UI | Med | Cross-report anomalies render as four equal-weight `mitigated` chips (no hierarchy) under a banner that calls it "likely fabrication" — tone disagrees with the headline. | Use a bulleted list (or a tone matching the verdict) so strongest tells lead. |
| 8 | UI | Low | Idle "Run forensic analysis" is a full-width filled lavender bar while disabled — loudest element, unclickable (§2 ≤10% brand). | Use a muted/outline disabled treatment so the dropzone is the anchor. |
| 9 | UX | Low | "Reports extracted" stat duplicates the per-card count; "click a report to expand" restates the chevron (Krug "halve the words"). | Drop the redundant stat/helper or merge the stat cards into the banner. |

---

### Insights & Anomaly Report
**Scores:** UX 7/10 · UI 7/10 · DESIGN.md 5/10

| # | Lens | Severity | Discrepancy | Recommendation |
|---|------|----------|-------------|----------------|
| 1 | DESIGN.md | High | Charts + `MissingBar`/distribution bars hardcode hex (`#912018`,`#B45309`,`#8838DE`,`#6A12CD`) and a fixed tooltip style instead of the §7.2.3 series palette; severity bars arrange risk→mitigated→compliant by count (RAG ramp). | Reuse the categorical palette / chart engine; keep severity one-noun-at-a-time, not a red→amber→green bar strip. |
| 2 | DESIGN.md | High | Sub-view tabs use a filled `bg-brand-600 text-white` segmented pill, fighting the purple ToolShell tabs + active stat icons (past the ≤10% Auditor's-Pen budget). | Switch to the underlined-tab pattern (active `text-brand-700` + sliding `brand-600` underline) used elsewhere. |
| 3 | DESIGN.md | Med | Status pills hand-rolled inline spans (`SEVERITY_META.pill`, `RULE_META.cls`) — Pass/Warn/Fail bypass §7.10.4. | Render severity via `SeverityBadge`, rule results via the shared `Pill` tones. |
| 4 | DESIGN.md | Med | Card titles + large numbers all Inter; Source Serif 4 (title authority) and the 28px tabular ledger numeral (§7.1.9) appear nowhere. | Promote sub-view/card titles or stat values to Source Serif. |
| 5 | UX | High | Three stat cards (Rows/Columns/Files) restate counts the summary sentence repeats verbatim ("Total Columns: 14" = "Profiled 14 columns"). | Drop the duplicate, or make the stat band carry distinct facts (anomalies, high-severity, completeness). |
| 6 | UX | Med | Anomaly/heuristic rows describe findings but offer no next step — no way to view the 142 flagged rows, filter, or drill in. | Add a "View rows"/"Inspect" affordance per finding, or state drill-down isn't available. |
| 7 | UX | Med | History "Open" calls `buildResult([], {})` — opening any past job rebuilds a generic result from zero files; meta/file names don't match what loads. | Hydrate the opened job from its own files/result, or disable Open for seeded rows. |
| 8 | UI | Med | Disabled "Run analysis" uses `bg-brand-100 text-brand-300` — low-contrast lavender-on-lavender reading as active; precondition never stated. | Strengthen the disabled treatment + add "Add a file to run". |
| 9 | UI | Low | `ChartCard` uses `rounded-[14px]` vs card radii `rounded-lg` (12) / `rounded-xl` (16); 14px repeated across cards/charts. | Normalize to the 12/16px token. |

---

## Suggested fix order

1. **One shared fix, six wins:** replace all hand-rolled pills with `SeverityBadge`/`Pill`, and kill the No-RAG tallies/stripes (themes 1–2) — biggest design-system payoff.
2. **CTA + radii + serif sweep** (themes 3–5) — mechanical, low-risk polish across `ConciergeKit` + tools.
3. **`SmartTable` adoption** (theme 6) for Speech / Medical / Table results.
4. **History hydration + hover-only info + redundancy** (themes 7–9) — per-tool UX correctness.
5. **Shell AI-chrome** (theme 10) — decide whether No-Glow applies to these tool surfaces, then strip `FloatingLines`/`Sparkles` if so.
