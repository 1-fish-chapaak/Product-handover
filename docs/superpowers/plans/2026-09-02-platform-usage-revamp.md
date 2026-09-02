# Platform Usage Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the value case on Platform Usage defensible. Correct the auditor rate from an invented ₹1,200 to a sourced ₹550, put the whole derivation on screen, turn the sensitivity table into a business fact rather than an admission of doubt, add the fourth reader, and make the page readable.

**Architecture:** The record layer, the one `snapshot()` rule and the Viewing as switch all stay. What changes is the rate and its labelling, the window list, the view ordering, and how much of the page is open at once.

**Tech Stack:** React 19, TypeScript, Tailwind, recharts 3.8 behind `ChartAutoSizer`, Vite, Playwright.

**Spec:** `PRD-PLATFORM-USAGE.md` at the repo root. Read it in full first. Section 3 is the value chain, section 4 is the rate and its sources, section 10 is the definition of done.

**History you need:** The tree was restored to the pre-revamp checkpoint at commit `fcbe85f` after an earlier rebuild removed the money and the switch, which turned out to be the feature itself. Two pieces of that abandoned work are worth recovering rather than rewriting:
- `999ab4b` moved `HISTORY_START` to 1 Apr 2025 and added a financial year window. Recover the idea, see Task 2.
- `a726aff` built six committee lines as `src/components/usage/UsagePack.tsx`. Recover the file, see Task 4.

## Global Constraints

- Typecheck with `npx tsc -b`, never `tsc --noEmit`. The root tsconfig has `files: []` so the plain form passes vacuously.
- `npm run build` is green at `fcbe85f`. There are no pre existing errors to blame. If it breaks, you broke it.
- Tests: `npx playwright test tests/platform-usage.spec.ts`, dev server on `http://localhost:5173`.
- A background formatter rewrites files after each save. If an Edit fails to apply, re read the file first.
- The seed is fixed. No `Date.now()` and no `Math.random()` in `src/data/platform-usage*.ts`.
- One number, one definition. Every figure computed once in `snapshot()`, read by the page and both exports.
- The page reads and never writes, except the audit event an export emits.
- No benchmark and no target on any figure. The salary research sets our default; it is never printed as something the customer should hit.
- Charts use `ChartAutoSizer`. `ResponsiveContainer` must not appear under `src/components/usage/`.
- Inter only. On grid sizes only: 12, 14, 16, 18, 20. Never 11, 13, 15 or 17, whatever `DESIGN.md` lists.
- Every figure carries `tabular-nums`.
- No em dash and no hyphenated compound in visible copy.
- Commit after each task. Git user is Nilesh Anand. DO NOT add a `Co-Authored-By: Claude` trailer.
- Do not delete a feature the PRD does not name. If something looks dead, report it rather than removing it.

---

## Task 1: The rate, and its derivation on screen

**Files:** `src/data/platform-usage-metrics.ts`, `src/components/usage/UsageValueBlocks.tsx`, `tests/platform-usage.spec.ts`

This is the whole point of the revamp. PRD section 4 has every number and its source.

- [ ] **Step 1: Write the failing tests.** `hourlyRate` is 550. `hoursPerPersonPerMonth` is 154. The string `1,200` and `₹1,200` appear nowhere. The quarter's money is ₹39.2 lakh and people freed is 15.4. The rate's derivation renders on the same screen as the figure.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Change the two constants.** `hourlyRate` 1200 to 550. `hoursPerPersonPerMonth` 160 to 154.
- [ ] **Step 4: Write the derivation note.** It must carry, in words a non technical reader follows: median base salary ₹6,57,000 from Glassdoor India Feb 2026 and ₹7,94,964 from PayScale 2026, midpoint ₹7,25,000, overhead multiplier 1.35, fully loaded ₹9,78,750, divided by 1,848 available hours a year, giving ₹530 which is taken as ₹550. This renders on screen, not in a tooltip and not only in the export.
- [ ] **Step 5: Correct the manual pace label.** 200 rows an hour means a person checking rows against a rule in a spreadsheet. The profession's 4 to 9 transactions an hour is full substantive testing and is a different thing. Say which this is. Say also that a faster pace produces a smaller saving, so this is the conservative choice.
- [ ] **Step 6: Update every expected figure in the suite.** Money goes from ₹85.6 lakh to ₹39.2 lakh, net from ₹85.4 lakh to ₹39.0 lakh, people from 14.9 to 15.4. Rows, runs, machine time and the contract charge do not move and must still assert.
- [ ] **Step 7: Run tests, then commit.**

---

## Task 2: Rebuild the sensitivity block as a business fact

**Files:** `src/components/usage/UsageValueBlocks.tsx`, `src/data/platform-usage-metrics.ts`

Today the block says the figure swings eight times if our assumption moves, which reads as us admitting we do not know. The swing is real but its cause is not our uncertainty. It is the difference between employing auditors and buying them.

- [ ] **Step 1: Write the failing test.** The block renders the four rows from PRD section 4 and names in-house against bought-in as the cause.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Rebuild the block.** Four rows: in-house on available hours ₹530 giving ₹37.8 lakh, in-house on chargeable hours ₹662 giving ₹47.2 lakh, bought from a firm lower end ₹940 giving ₹67.0 lakh, upper end ₹2,500 giving ₹1.78 crore. One sentence saying the swing is the in-house against bought-in difference, not our doubt.
- [ ] **Step 4: Run tests, then commit.**

---

## Task 3: The financial year window

**Files:** `src/data/platform-usage.ts`, `src/data/platform-usage-metrics.ts`

`999ab4b` did this and it was correct. Recover it, as an ADDITION to the existing window list rather than a replacement. `this-month`, `this-quarter`, `since-start` and `custom` all stay, because the head of team and admin views need a month.

- [ ] **Step 1: Write the failing test.** Financial year to date covers 1 Apr 2025 to 31 Mar 2026 and differs from the quarter on runs, checks performed and the contract charge.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Move `HISTORY_START` to `Date.UTC(2025, 3, 1)`.** `ANCHOR` does not move.
- [ ] **Step 4: Add the financial year to date window** alongside the existing ones. `this-year` stays but is no longer the default anywhere, because it resolves to 1 Jan 2026 and prints the same window as the quarter.
- [ ] **Step 5: Verify the worked example did not move.** 1,428,000 rows, 340 successful runs, 8.5 hours, ₹18,400. `999ab4b` proved these hold with the longer history; if one moves now, you introduced the leak.
- [ ] **Step 6: Verify coverage still reconciles** in both windows: the bar list sums to the headline, and controls tested plus never tested equals the library.
- [ ] **Step 7: Run tests, then commit.**

---

## Task 4: The fourth reader and the view order

**Files:** `src/data/platform-usage-metrics.ts`, `src/components/usage/PlatformUsageView.tsx`

PRD section 2 and section 5. Four readers, three views, because CS reads the CFO view.

- [ ] **Step 1: Write the failing test.** Each reader opens on the view named in PRD section 5. The switch offers only entitled views. Narrowing never reaches another team.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Reshape the personas** to the readers in PRD section 2: value, coverage and findings, activity. Keep the three switch rules in PRD section 2 exactly as they are.
- [ ] **Step 4: Set each view's opening order** per PRD section 5. Layout, wording and block names stay identical across views. Only the order changes.
- [ ] **Step 5: Recover the six committee lines.** `git show a726aff:src/components/usage/UsagePack.tsx` has them. They compute plan completion, coverage, full population against sample, time to detection, findings and their age, and overdue actions. Bring the file back and mount it at the top of the coverage and findings view. Note that it was written against a two-window snapshot shape; adapt it to the current one rather than changing the snapshot back.
- [ ] **Step 6: Run tests, then commit.**

---

## Task 5: Make it readable

**Files:** `src/components/usage/PlatformUsageView.tsx`, `src/components/usage/usageKit.tsx`

Twenty five blocks across thirteen groups is more than any of the four readers can read.

- [ ] **Step 1: Write the failing test.** Each view opens with at most three groups expanded, and every folded group opens on click.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Open the first three groups of each view, fold the rest** into a contents list showing the group name and its one line answer while closed.
- [ ] **Step 4: Run tests, then commit.**

---

## Task 6: The visual pass

**Files:** `src/components/usage/*.tsx`

PRD section 8. Do this last, when the content is settled.

- [ ] **Step 1: Group related figures into one bordered container** with hairline separated rows, rather than one card each.
- [ ] **Step 2: State a column head once** at the top of its group, never per row.
- [ ] **Step 3: Put the answering sentence first and widest**, with the figure following it rather than towering over it.
- [ ] **Step 4: Render assumption derivations as plain text** under the figure, not as pills.
- [ ] **Step 5: Name drill downs in the sentence**, not as chevrons or whole row click targets.
- [ ] **Step 6: Sweep for off grid font sizes and `ResponsiveContainer`.** Neither may exist under `src/components/usage/`.
- [ ] **Step 7: Run tests, then commit.**

---

## Task 7: Verification

- [ ] **Step 1: `npx tsc -b`.** No errors.
- [ ] **Step 2: `npm run build`.** Green.
- [ ] **Step 3: `npx playwright test tests/platform-usage.spec.ts`.** All green.
- [ ] **Step 4: Drive the real page.** Start the dev server and open System > Platform Usage. The `?view=` whitelist excludes platform usage, so navigate by dispatching `irame:command-palette-navigate`. Switch through every entitled view and confirm each opens on the block PRD section 5 names.
- [ ] **Step 5: Walk PRD section 10 line by line** and report each acceptance criterion as met or not met, with evidence from the running page. Do not report a criterion met from reading source.
- [ ] **Step 6: Report honestly.** What you could not do, what you changed that the plan did not ask for, and where you think the PRD or the plan is wrong.
