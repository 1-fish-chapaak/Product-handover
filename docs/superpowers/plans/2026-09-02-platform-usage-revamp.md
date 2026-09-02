# Platform Usage Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild System > Platform Usage as a single reader surface for the audit lead, whose first screen is six recorded figures read as quarter against financial year to date, with every invented rupee removed from the page.

**Architecture:** The record layer and the one `snapshot()` rule stay. The window model changes from five named periods to two read side by side. The persona model is deleted. The page becomes two sections: a pack of six lines, and everything else folded below it.

**Tech Stack:** React 19, TypeScript, Tailwind, recharts 3.8 behind `ChartAutoSizer`, Vite, Playwright.

**Spec:** `PRD-PLATFORM-USAGE.md` at the repo root. Research and sourcing in `PLATFORM-USAGE-RESEARCH.md`. Read both before starting. The PRD's section 10 acceptance criteria are the definition of done.

## Global Constraints

- Typecheck with `npx tsc -b`, never `tsc --noEmit`. The root tsconfig has `files: []` so the plain form passes vacuously.
- `npm run build` fails on two pre existing errors under `src/components/audit/`. Those are not yours. Check them first before assuming you caused a regression.
- Tests: `npx playwright test tests/platform-usage.spec.ts`. The dev server must be on `http://localhost:5173`.
- A background formatter rewrites files after each save. If an edit fails to apply, re read the file first.
- The seed is fixed. No `Date.now()` and no `Math.random()` anywhere in `src/data/platform-usage*.ts`.
- One number, one definition. Every figure is computed once in `snapshot()`. The page and both exports read that one object.
- The page reads and never writes. No approve, reject or resolve, at any depth.
- No benchmark, target, percentile or cross company comparison on any figure, ever.
- Charts use `ChartAutoSizer`. `ResponsiveContainer` renders blank at recharts 3.8 and must not be reintroduced under `src/components/usage/`.
- Inter, not serif. On grid font sizes only: 12, 14, 16, 18, 20px. Never 13, 15 or 17.
- Visible copy carries no dashes, no em dashes and no hyphenated compounds. Use so, but, or a full stop. A `—` used as a blank in a table cell is fine.
- No analytics jargon in visible copy. Audit domain words are fine.
- Do not delete a feature that is not named in the PRD's section 6. If something looks dead, say so in your report rather than removing it.
- Commit after each task with a real message. No `Co-Authored-By: Claude` trailer.

---

## Task 1: The financial year window model

**Files:**
- Modify: `src/data/platform-usage.ts` (`HISTORY_START`, around line 74)
- Modify: `src/data/platform-usage-metrics.ts` (`PeriodId`, `period()`, `periodOptions`, `DEFAULT_PERIOD`, around lines 220 to 325)
- Test: `tests/platform-usage.spec.ts`

**Interfaces:**
- Produces: `type WindowId = 'quarter' | 'fy-ytd'`, `windows(): { quarter: Period; ytd: Period }`, both `Period` objects keeping the existing shape (`id`, `label`, `phrase`, `from`, `to`, `months`).

- [ ] **Step 1: Write the failing test.** Assert the quarter is 1 Jan 2026 to 31 Mar 2026 and the year to date is 1 Apr 2025 to 31 Mar 2026, and that the two windows produce different totals on at least one line.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Move `HISTORY_START` to `Date.UTC(2025, 3, 1, 0, 0, 0)`.** Leave `ANCHOR` alone.
- [ ] **Step 4: Replace the period model.** `PeriodId` becomes `WindowId`. Delete `this-month`, `this-year`, `since-start` and `custom`. Delete `DEFAULT_PERIOD` and every persona reference in it. Keep `monthsCovered()` exactly as it is, it walks the calendar and is correct.
- [ ] **Step 5: Fix every call site the compiler names.** Run `npx tsc -b` and work the list down.
- [ ] **Step 6: Verify the worked example did not move.** Q4 FY26 must still be 1,428,000 rows, 340 successful runs, 8.5 hours of machine time and ₹18,400 charged. If any of the four moved, the extra three months of history leaked into a window that should not see it. Fix the leak, do not adjust the expected number.
- [ ] **Step 7: Re check the coverage credit rule.** A population is credited to the window that first tested it. Three more months of history moves some first tests earlier. Confirm the quarter's coverage headline still reconciles with its own bar list. If it cannot, report it rather than papering over it.
- [ ] **Step 8: Run tests, then commit.**

---

## Task 2: Delete the persona model and the invented money

**Files:**
- Modify: `src/data/platform-usage-metrics.ts` (`Persona`, `PERSONA_QUESTION`, `PERSONA_SCOPE_LABEL`, `PERSONA_TITLE`, `REFUSAL`, `entitledViews`, `personaFor`, `calibrate`, the four assumptions, `snapshot()`)
- Modify: `src/components/usage/UsageValueBlocks.tsx`

**Interfaces:**
- Produces: `snapshot(window, scope)` returning `{ pack, platform, contract, meta }`. `pack` carries the six lines, each as `{ quarter, ytd, label, honesty, drill }`. `platform` carries the section two blocks. `contract` carries the recorded charge. Nothing in the returned object represents a saving in rupees.

- [ ] **Step 1: Write the failing test.** Assert no rupee figure representing a saving renders anywhere on the page, and that no persona switch exists in the DOM.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Delete the persona type and everything keyed on it.** `Persona`, the three `PERSONA_*` maps, `REFUSAL`, `entitledViews`, `personaFor`. Scope stays: whole company, a team, or your own work, still bounded by entitlement, still never sideways.
- [ ] **Step 4: Delete the two invented assumptions.** Cost of an auditor hour, ₹1,200. Rows checked by hand in an hour, 200. Remove them from `calibrate` and from `snapshot()`. Hours per manual control test and working hours per person per month survive only where they feed an hours figure, never a rupee one.
- [ ] **Step 5: Gut `UsageValueBlocks.tsx`.** Delete `NetValueHero`, `HeadlineValue`, `SensitivityBlock`, `AssumptionsReference` and the net value arithmetic inside `CostAndNetValue`. Keep the recorded contract charge as a plain fact block and move it to section two. The ₹18,400 is a contract term and stays.
- [ ] **Step 6: Run `npx tsc -b` and clear the fallout.**
- [ ] **Step 7: Run tests, then commit.**

---

## Task 3: The pack, six lines

**Files:**
- Create: `src/components/usage/UsagePack.tsx`
- Modify: `src/components/usage/usageKit.tsx` (reuse `Compare`, `Story`, `Fold`, `StatRow`, `Maths`, `MathsSources`, already present in the working tree)

**Interfaces:**
- Consumes: `snapshot().pack` from Task 2.
- Produces: `<UsagePack pack={...} onDrill={...} />`.

Each line renders: the sentence that answers it, the quarter figure, the year to date figure, the honesty label where the figure is an inference, and one drill down. Read the PRD section 4 table for the exact six and their sources.

- [ ] **Step 1: Write the failing test.** Six lines, in the PRD's order, each with two figures and a working drill down. Lines 1 and 2 carry their inference label on the same screen as the figure.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Build the six lines.** Type and hairlines carry the hierarchy. This is a reading order, not a card grid. Somebody who reads only the six sentences understands the quarter.
- [ ] **Step 4: Wire each drill down** to a list carrying a name, a maker and a date. A row with no person behind it says automatic.
- [ ] **Step 5: Run tests, then commit.**

---

## Task 4: Rebuild the page around two sections

**Files:**
- Modify: `src/components/usage/PlatformUsageView.tsx`
- Modify: `src/components/usage/UsageOperationsBlocks.tsx` (remove `MyQueue`, `MyWork`, `TeamWork`, keep `StuckNow`, `Reliability`, `SamplingOutcomes`, `CcmCoverage`)

- [ ] **Step 1: Write the failing test.** The header states reader, scope, quarter with dates, year to date, and counted to date. Section two holds all twelve blocks from PRD section 5, closed by default, each opening.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Replace the header.** One line, no switch. Keep the scope filter and the export buttons.
- [ ] **Step 4: Render the pack, then section two.** Section two is folded, one block per row, opening in place.
- [ ] **Step 5: Remove the persona only blocks** named above. `StuckNow` stays and moves into section two.
- [ ] **Step 6: Keep the attention strip** at no more than three cards, each with one thing to do, each routing to the screen that owns the action.
- [ ] **Step 7: Run tests, then commit.**

---

## Task 5: Exports

**Files:**
- Modify: `src/components/usage/usageExport.ts`, `src/components/usage/usagePdf.ts`

- [ ] **Step 1: Write the failing test.** CSV and PDF carry the scope, both windows, the honesty labels and the coverage note. The annual export with no rate supplied prints no rupee figure anywhere.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Reshape both exports to the pack.** Same `snapshot()`, so they cannot diverge from the page.
- [ ] **Step 4: Add the annual renewal export.** Hours and coverage always. Rupees only when a rate has been supplied by the customer's finance team through operations. With no rate, no rupee line is printed, and the export says why in one sentence.
- [ ] **Step 5: Run tests, then commit.**

---

## Task 6: Rewrite the test suite

**Files:**
- Modify: `tests/platform-usage.spec.ts`

The existing 711 line suite asserts the old page: three views, the switch, the net value hero, the sensitivity swing, the auditor's rupee free view. Those tests are now wrong, not failing.

- [ ] **Step 1: Delete every test that asserts a removed behaviour.** Name each one you delete in your report.
- [ ] **Step 2: Keep every test that asserts a surviving rule.** Coverage counted once, failed runs excluded from savings, charts offering their table, counts opening their list, insights split and never summed, ageing from the day a finding was raised, the false alarm rate dividing by classified findings only, splits adding up, the alphabetical per person table, the page never writing.
- [ ] **Step 3: Add one test per acceptance criterion** in PRD section 10 that is not already covered.
- [ ] **Step 4: Run the whole suite green, then commit.**

---

## Task 7: Verification

- [ ] **Step 1: `npx tsc -b`.** No new errors. The two pre existing `src/components/audit/` errors are not yours.
- [ ] **Step 2: `npx playwright test tests/platform-usage.spec.ts`.** All green.
- [ ] **Step 3: Drive the real page.** Start the dev server, open System > Platform Usage, and confirm every one of the six lines renders a figure and opens its drill down. The `?view=` whitelist excludes platform usage, so navigate by dispatching `irame:command-palette-navigate`.
- [ ] **Step 4: Walk PRD section 10 line by line** and report each acceptance criterion as met or not met, with the evidence. Do not report a criterion as met from reading the source. Drive it.
- [ ] **Step 5: Report honestly.** Anything you could not do, anything you changed that the plan did not ask for, and anything you found wrong with the plan itself.
