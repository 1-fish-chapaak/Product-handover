# Plan — SOX feedback sheets vs the current flow (revision 3)

## Correction (15 Sep, during S3) — C1 is real after all
- On 15 Sep, during S0, I said no SOX screen opens the full-page RACM editor, undid C1 and removed it. **That was wrong.** Clicking a RACM on Engagement → RACM tab opens the spreadsheet editor **in a new browser tab** (`openEditorTab`, `?view=racm-full-editor`), and that tab showed the 124 procurement sample rows for every RACM. I had only searched the in-app route.
- **C1 is restored in S3.** The RACM tab hands the RACM's own controls to the new tab (via local storage), and the editor shows them. **A10 (bulk-edit a column) is back in that editor.**

## S3 decisions (15 Sep)
- **C1:** restore it, keeping the new-tab editor.
- **A5:** read the real uploaded .xlsx/.csv: header row → column matching with confidence → review → import creates controls from the file's rows. Falls back to the template if unreadable.
- **A4 Delete RACM:** blocked while any audit covers its controls (menu item disabled with the reason); otherwise confirm → delete.
- **A4 Version history:** parked. **View SOP** appears only on RACMs made from an SOP and opens the uploaded file for the session.

## S11 — RACM library + scoping at engagement creation (built 15 Sep, not committed)
- **RACM tab moves to the Engagements page**, beside Approval Flow: Overview · All Engagements · **RACM** · Approval Flow. RACMs are uploaded / created there. **Several RACMs can exist for one process.**
- **A SOX engagement has no RACM tab** — only its **Control library**, holding only the scoped controls.
- **New engagement (SOX):** ① Basics (name, group, entities / org chart) → ② **Materiality & TB** (rule, trial balance upload required, material accounts mapped to processes) → ③ **Scope** (companies in scope with the coverage bar and notes; ✦ Ira-recommended processes with notes / qualitative reasons; for each in-scope process **pick its RACM** from the RACM tab) → ④ Review. An in-scope process with no RACM offers **Upload RACM** right there (same import review; saved to the RACM tab), and blocks until uploaded or moved out with a note.
- **Scoping is by process, not by RACM.**
- **New audit: left as it is for now** (you'll handle it later) — it still carries the S10 materiality / TB / scope steps.
- **ID format (supersedes A14):** Risk ID = `PROCESS/ENTITY/R001`, Control ID = `PROCESS/ENTITY/R001/C001`, with **short codes** (e.g. `TRY/ASO/R001/C001`). Codes are **made from the names automatically and editable** (entity code on the Basics entity table, process code on the RACM tab), unique within the engagement. The **entity comes from the RACM file** (its entity/subsidiary column, or the entity chosen at upload). **R/C numbers use the file's own Risk ID / Control ID** when present, else file order. **Seeded controls and risks are renamed too** (e.g. TRY-01 → `TRY/AIH/R001/C001`).
- **Answered 15 Sep (after "go"):**
  1. **SOX only** — Internal Audit / Compliance keep their own RACM screens, unchanged.
  2. **Everything moves** from the SOX RACM tab to the Engagements page tab: Create RACM (upload RACM / upload SOP → prompt → extract), the import review, the RACM list, the spreadsheet editor (new tab), ⋯ View SOP / Delete. A process can have several RACMs.
  3. **Pre-testing review stays with the engagement** — the tab's list drops that column; each engagement approves its own copy (Overview meter as today).
  4. **Copy at pick time** — an engagement copies the RACM's controls when it picks it; later edits on the tab only reach engagements created afterwards.
  5. **Delete blocked while in use** — disabled with the reason ("Used by FY26 ICFR — Altura Infra Group") while any engagement was created from it.
  6. **Entity: pick or type** — Create RACM keeps an Entity field listing every company already named on a SOX engagement (grouped by group) plus "type a new company"; the file's entity column, when present, overrides it per row.
  7. **Several RACMs, any mix** per in-scope process on the Scope step (whatever company they're for); a process with none picked blocks.
  8. **IDs made at import on the RACM tab** — the import review shows the process and entity codes (from the names, editable) and each row's new ID; engagements copy them unchanged.
  9. **ID clash = flag and block** on the Scope step ("3 control IDs appear in both Treasury RACMs") until one RACM is unticked.
  10. **Existing engagements' RACMs seed the tab** (SOX-104, SOX-105, ENG-002, ENG-010 …), each "Used by" its engagement, IDs renamed; engagements keep their controls as their copy.
  11. **S4 stays separate, after S11** — S11 uses today's columns; S4 later adds the template and fields to the new tab.
  12. **Add later = "Add RACM"** on the engagement's Control library and Overview: pick RACMs from the tab (or upload one then), same clash check, controls copied in.
  13. **All controls** of a picked RACM are copied; narrowing (key only, untick) stays in New audit.
- **Defaults taken (say if wrong):** anyone who can create engagements can create/edit/delete on the tab (the prototype is always System Admin); the Materiality & TB step copies New audit's (TB required, GL optional); a RACM uploaded from the Scope step is saved to the tab and picked for that process.
- **Built (15 Sep, build passes, not checked on screen):**
  - New: `racmIds.ts` (codes + ID building + engagement rename + code register), `racmLibrary.ts` (the tab's store, seeded from 24 existing engagement RACMs), `CreateRacmFlow.tsx` (entity pick-or-type → process → RACM/SOP → import review → saved to tab), `RacmLibraryView.tsx` (Engagements → RACM, grouped by process), `AddRacmModal.tsx`.
  - Import review: no engagement needed; new **Entity** column; editable process/entity codes with the new ID per row ("File: C-12" underneath); codes another name holds are refused.
  - Seeds renamed on the way out of `seedIcfrEngagement` (every reference follows); each control keeps `seedKey` (old id) so every demo number hashes the same.
  - New engagement (SOX): Type → Basics → Materiality & TB → Scope → Review; `soxControls` / `soxRacms` on the engagement; RACMs marked used.
  - Engagement: RACM tab parked in both shells; "Add RACM" on Control library, Controls register (no audit open) and Overview; notifications that pointed at the RACM tab go to the Control library.
  - Hand-added controls (New control) number in the new format.
- **Defaults the build took (raised to you):** RACMs pre-tick on Scope when their company is in scope (Ltd/Limited spellings match); Scope also needs ≥1 process and ≥1 company in; chart companies other than the Airline samples get 4 generic TB accounts (so Ira recommends only O2C and P2P); several TB files → the first is stamped on every company.
- **Pushed** in 984f554 + aee5056 (with S7–S10).
- **S11 follow-ups — answered and built 15 Sep (not committed; build passes; not checked on screen):**
  1. **Pre-testing review on Control Library rows:** Engagement → Control Library gets a Review column (Pending / Approved / Remark), Approve and Remark on each row, tick-and-approve for several, a Review filter; the "awaiting your review" notification lands there filtered to Pending; the Overview meter moves.
  2. **Overview tile:** remove the RACM row from "Shared across every audit"; caption becomes "Set up once for this engagement, used by each audit."
  3. **New audit loses steps ② Materiality & files and ③ Scope** → Audit period → Review. (Supersedes "New audit left as is": the S10 build in New audit goes.) The empty-engagement wording isn't changed — controls are scoped at creation, so an engagement isn't empty; that edge case comes later.
  4. **A new audit tests every control in the Control Library** at the time it's created (creation-scoped plus any added with Add RACM); audits already created don't change.
  5. **Its materiality and TB / GL come from the engagement** (set at creation), shown read-only on Review ("set when the engagement was created").
  - Built: Control Library Review column (last column, filterable) with a tick, Approve / Withdraw and Remark per row for the auditor; "Approve N" in the bulk bar (confirms when it would clear remarks); the bell's "N controls awaiting your review" opens the library filtered to Pending. Overview tile row removed. New audit's two steps parked behind `SCOPING_STEPS = false`; create() scopes every control (roll-forward too — an effective interim design still carries), materiality from the programme record (else the engagement's thresholds), files from the programme.
  - Noticed: SOX-105's engagement materiality is the default ₹0.5 Cr (no soxConfig) while its seeded audits use ₹10.5 Cr, so a new SOX-105 audit grades at ₹0.5 Cr; Altura's programme has no TB file names, so New audit's Review reads "None on the engagement" there.

## S9 decisions (15 Sep) — built
- **A30 register columns:** Deficiency · Finding · Track · Exposure · Severity · **Risk owner** (the control's owner) · **Deficiency owner** (the plan's "Responsible person", — until written) · **Stage with due date** ("Remediation · due 30 Nov", red "overdue 4d") · Court.
- **A31 Ira pre-fills** likelihood, exposure and compensating control when a deficiency is raised, each tagged "✦ Ira suggested — ‹reason›"; the grade computes straight away; editing a field removes its tag. Seeded deficiencies keep their values.
- **A32 exposure from data = value at risk:** total value of the population transactions in the failure window (first failed item → fix), with the maths and "[Use ₹…] or type your own". TOD deficiency or no population: the whole audit period, valued from the trial balance accounts mapped to the control's process.
- **A33 gap quantification: parked.**
- **C10:** "Clearly Trivial" is its own grade on every screen (Dashboard own row, counted once; Engagement Overview; working paper; reviewer queue; archive). Still out of the ICFR opinion.
- **C11:** a TOD deficiency's retest has no sample — it re-checks the design checks that failed, against the fix evidence (✓/✗ or "Run Ira on these checks"); passes when all pass; a fail needs a reason. TOE retests unchanged.

- **Raised after the S9/S10 build:** (1) a design (TOD) deficiency's exposure is the whole period's trial balance value, so it will usually read as a material weakness (e.g. FIX-05 ₹77 Cr against ₹12 Cr materiality); (2) the "Retestable from…" wait still counts from the control's frequency for a TOD retest; (3) the CY 2025 archive's two seeded Significant Deficiencies (₹4.2 / ₹1.1) would grade Clearly Trivial if recalculated — left as seeded.

## S10 decisions (15 Sep) — built
- **Trial balance required** on New audit (interim / year-end); roll-forward unchanged.
- **A34a:** after the TB upload, Materiality & files lists only **material accounts (≥ performance materiality)** with a process dropdown pre-filled by Ira. Options: the standard SOX list plus the engagement's own RACM processes; ones without a RACM marked "no RACM yet". Saved on the audit.
- **A34b:** a **Processes panel at the top of Scope** — "Ira recommends N processes", in scope when a material account maps to it; moving against Ira needs a note; the RACM side pre-ticks in-scope processes' RACMs (replacing the pre-tick from companies). **An in-scope process with no RACM blocks Continue** and offers **"Upload RACM"** right there (the same import review as the RACM tab); after import its controls are pre-ticked.
- **Raised after the build:** (1) the Processes panel is a record — what the audit tests still comes from the company or RACM side, so a process marked Out is still tested if an in-scope company feeds it; (2) with a trial balance now always attached, the company side shows Altura Water as "Not in the trial balance" and Altura Green Hydrogen appears, so coverage figures change; (3) the wizard's materiality still opens on ₹420 Cr × 5% (PM ₹15.75 Cr), not Altura's ₹12 Cr / ₹9 Cr, so 7 accounts are listed rather than 11.
- **A34c:** switching an out process in asks for a **reason from a list** (High transaction velocity / Complex accounting / Fraud risk / Regulatory focus / Management estimate) plus a note, tagged "Qualitative".

## S8 decisions (15 Sep)
- **A28 methodology on the audit:** New audit → step 1 gets **Selection** (Random / Systematic / Targeted) and **Spread by** (Quarters / Countries / Entities, any). New audits default to Random, no spread. A roll-forward inherits its interim's methodology read-only. Every existing audit is seeded Random, spread by entity. The control's Sample step shows it read-only ("Method: Random · spread by entity (set on the audit)") and only asks **how many items**. The written draw request and its "Read as" line are gone (replaced by a number). The draw shapes itself to the spread (even per quarter; every entity/country reached before any doubles) and shows the split with empty groups flagged. Entities carry a country (new engagements from the S2 entity table; seeded engagements = India).
- **A28 yearly running total:** "This year so far: X of Y samples tested", split per audit in the same year, target = the control's suggested sample size (frequency + risk). Past audits save their tested count when the next audit starts; seeded audits get a stand-in count.
- **A29 year-end controls = frequency Annual.** In an interim or roll-forward audit their Population, Sample and TOE are locked "Pending until ‹31 Dec / 31 Mar› — tested in the year-end audit" (TOD works); registers, dashboard, risk-owner inbox and the bell read "Pending until …" and leave them out of Due now. No seed change (Altura has no Annual control).
- **Your answers after the build:** (1) over-target totals read "26 samples tested this year — above the target of 5" (target stays the size guide; seeds unchanged) — applied; (2) **bring the written draw request back** with its "Read as" line — words set how many items and which months, never the method (method/spread stay from the audit) — built ("Ask for the sample" box + "Read as: 5 items · Jan–Jun"; a method named in the words reads "method stays Random — set on the audit"; the button stays "Draw sample"); (3) yearly counts split **by sample date** — built (undated seeded items belong to the round that drew them, so Altura reads Interim 25 · Roll-forward 0 with either audit open; stand-in counts removed); (4) in interim/roll-forward audits, **year-end-pending controls don't block the audit sign-off** — built on the Dashboard and the working-paper sign-off box ("2 controls pending until 31 Dec 2026 — tested in the year-end audit").
- **Noticed, not fixed:** a random draw's item dates cluster on consecutive days; starting a new Altura audit archives the interim with the roll-forward's items counted in it.
- **Specs:** `_verify_multi_source_population` ("asked for in words") needs 2 assertions updated (label now "Ask for the sample from …", months reading changed); `_verify_sample_extract` already stale; re-check `_verify_new_audit_wizard`, `_verify_bell_badge`.

## S7 decisions (15 Sep)
- **A22 parked** (count check against the control's frequency) — not built.
- **C6 dropped for the prototype** — feedback #62 was about a section on staging; added to the staging list (O1).
- **A24 built — inside Ira's TOE AI validation, no new button.** Each attribute keeps its one "View results" link (shown for Pass and Fail). The results window's per-item table is replaced on every attribute by **Document vs system data — each sampled item**: Sample · Field · Document says · System says · Match/Mismatch, one row per item of the drawn sample (the sample drawn after the population is extracted, which is what TOE tests). The field each item is compared on comes from the attribute's required files (approval record → approver, vendor master log → bank account, payment run → payment amount, …). The mismatch row is the same item the sample grid fails. Ira's summary names it; with no sample yet, Ira compares 4 items from the files instead. Q&A stays as it was.

## S6 decisions (15 Sep)
- **A17 AI for TOD (changed mid-build):** Ira does NOT run on upload. "Pass all" / "Fail all" are replaced by one button, **"Run Ira on design checks"** (auditor only), in the same place; the design checks themselves stay as they were. After a file changes it reads **"Re-run Ira"**. Disabled with no checks, no files on any element, or once TOD is concluded. Verdict (prototype): a check fails while a required element is still outstanding, or if it was already marked failed; otherwise it passes. Ira adds the elements it read to "Evidenced by". The override pencil is back on each check; a file change after an override flags "Evidence changed since override". Per-check ✓/✗ stay.
- **A19 / A21 / C7:** real file picker (several files at once), each file shows "Uploaded by ‹person› · ‹date, time›" and opens a preview (PDF/image files picked this session; sample files say no preview), and each file has its own remove X (auditor: any file; control owner: their own).
- **A20:** History records adding/removing a design element and a design check.
- **A36 design approval:** after TOD concludes, a Design approval block (Prepared by → reviewer Approve / Return with a note; whoever concluded TOD can't approve). Population, Sample and TOE (the control owner's Population too) stay locked until approved: "Unlocks after TOD is approved" / "Waiting for design approval".
  - Seeds: every already-concluded TOD is approved, on every engagement. Altura's **O2C-02** is left waiting. No control was already in that state, so its TOE results and its countersigned paper were taken off (Order to Cash shows 1 effective control instead of 2).
  - Not gated: the end-of-control sign-off while a TOD concluded *ineffective* is still waiting for approval.
- **C9:** "Control effective / Control ineffective" pills (control page header, Controls register, audit runs on the engagement control page); header bar reads "TOD effective › TOE effective" (your call after the build — not "Design / Operating"). Step names TOD / TOE unchanged.
- **Specs likely stale** (Population/Sample now locked until TOD is approved): `_verify_sample_extract`, `_verify_multi_source_population`, `_verify_population_removals`, `_verify_conclude_gates`, `_sox-golive`, `_sox-review-gate`, `_sox-prd-unverified`.

## S5 decisions (15 Sep, built before S4 at your call)
- **C3:** the objective runs the full width of the header on both control pages (on the audit page it runs up to the court badge).
- **C4:** the engagement control page reads "Risk R-xx · risk text… More" under the identity line, exactly like the audit page; More opens Control activity and the other facts.
- **C5:** attributes say only their own words, on every SOX engagement. The placeholder first attribute becomes "Performed as described for each sampled item"; the others keep their wording ("Exceptions handled per policy", "Performed within the required timeframe", …). Design checks built from attributes drop the repeated sentence too. The flagship demo's hand-written attributes don't change.
  - Required files still come out the same on Altura and the other generated engagements: the rule now reads the attribute together with its control's sentence. On the unlisted flagship demo (ENG-001), 16 attribute lists shift slightly as a result (e.g. the vendor master control now asks for the vendor master change log).

## S2 decisions (15 Sep)
- **A1/A2 name checks:** on the SOX New engagement sheet (Basics) and on Edit engagement for SOX engagements only. Other engagement types don't change.
  - Over 200 characters → red error, Continue / Next blocked.
  - A name already used by any engagement in the list → grey note "…will be saved as “X (2)”", and it saves with the next free number.
- **A3 Country + types:** only the SOX New engagement sheet's entity table. Edit engagement's "Group & entities" table doesn't change.
  - Types: Holding, Subsidiary, Joint venture, Associate, Branch.
  - Country column: editable, filled from the org chart import (Meridian per its chart, Altura = India) and never overwrites a typed country.
- **R1:** the ▶ icon is removed from engagement cards; clicking the card still opens it.
- **Org chart upload formats (added 15 Sep, your note):** the New engagement org chart upload accepts Excel (.xlsx/.xls), CSV, images, Visio and PDF, and still PowerPoint and draw.io. Hint: "Excel, CSV, image, Visio or PDF". The companies are still filled from the sample chart matched by file name (no real reading of the file).
- **Left open, not built:**
  - The ownership note ("74% owned") and New audit scoping treat Joint venture / Associate / Branch the same as a Subsidiary.
  - The hidden Configuration screen's entity type list still has only Holding / Subsidiary.

## What changed in revision 3 (your answers to D1–D12)
- **Parked:** A18 design parameters (D1), A27 PDF population (D8), A35 three scope buckets (D5), and scoping at Create engagement (D4).
- **Dropped:** C8, the walkthrough card. A walkthrough doc is just a design element that evidences the checks (D7).
- **Added: AI for TOD (A17).** Uploading design-element evidence triggers Ira against every design check → Pass/Fail per check → override with rationale.
- **Scoping (D4):** stays in New audit, which already has materiality, TB and entity scope. The missing pieces are added there (A34a–c: accounts → processes, Ira-recommended processes, qualitative picks).
- **TOE:**
  - required files come from the RACM "Control Evidence" column, split per attribute by Ira and editable (T5)
  - manual Pass/Fail and self-attestation **stay** (T6)
  - the bulk button becomes "Run AI validation on ready attributes" (T7)
- **Also answered:**
  - TOD evidence shows uploader + time + preview (A19)
  - the audit picks the sampling approach, the control page keeps the size and adds a yearly total (A28)
  - the risk line is copied to the engagement control page (C4)
  - RACM/SOP work goes in the SOX RACM tab only (D9)

- **From staging (your ask):**
  - A36: design sign-off after TOD (Approve / Return, four-eyes)
  - "Not applicable" on design elements already exists in the prototype and is kept as is (P18)

## What changed in revision 2 (your feedback)
- **A9:** Ira's filled-in blanks now show in a preview, and nothing goes into the RACM until the user validates it.
- **A6:** in SOP extraction, the prompt is visible and editable. **Extraction starts only after the user validates the prompt.**
- **A13:** "Continuous" is **removed** from the control frequency list, not defined.
- **Workflow mapping is removed from the SOX flow.** TOE is rebuilt around a list of required files per attribute, then AI validation, then an optional override (new section 2.0 plus R5–R6).
- **Dropped rows:** A16 (Ira suggests workflows), A25/A26 (workflow run pages), C2 (workflow overwrite bug), and P2/P4/P5/P13 (workflow items in the "present" list). A23 (evidence per sample) is covered by the required-files list per attribute.
- **Found in the prototype, as you remembered:** the TOE attribute card in `sox-icfr/ControlDossier.tsx` (~lines 976–1141) already has:
  - a **"Required file"** upload
  - **"Run AI validation"**, disabled until the file is uploaded (`runStepValidation`, `setStepInputFile` in `store.tsx`)
  - **"Override result with rationale"** with Override · Pass / Override · Fail and a Remove override option (`overrideStep`)

  The gaps: it takes **one** file rather than a list, and it sits next to a Workflow toggle (removed in R6). The manual Pass/Fail buttons and the attestation section stay (D11). The Internal Audit execution screen already lists several evidence types per attribute (`requiredEvidenceTypes` in `engagement-execution-v2/AttributeTestingStepV2.tsx`); that pattern gets reused for the list.

## Context
You shared two feedback sheets: **Feedback**, filtered to rows where the 12.09 column is Fail or blank (40 rows), and **DUBAI feedback** (45 rows). I compared every row against:
- the SOX flow on staging (ENG-085 read-only, plus the ENG-095 test run), and
- the SOX module in this prototype repo (read-only searches, spot-checked).

The outcome: what's already built, what to add, change or remove, and which calls are yours. Approved rows get built in the prototype, one stage at a time.

**Ground rules**
- Build in the prototype's shared SOX components, shown on **FY26 ICFR — Altura Infra Group (SOX-104)**. Changes appear on every SOX engagement; that has already been agreed.
- **RACM and SOP changes only in the engagement → RACM tab flow** (Create RACM, the RACM list, the RACM matrix page opened from it). No AI Concierge, no Process Hub.
- The TOD-fail walkthrough is dropped.
- ⚠ = the sheet or your feedback overrides an earlier decision; see Decisions.
- "#n" = S. No. in the Feedback sheet. "Dubai" = a DUBAI feedback row.

## Target flow (as you described it)
1. **Upload the RACM** (or an SOP) → controls and attributes are extracted.
2. **Create the audit.**
3. **Control page (engagement level):** attributes are listed. **No workflow mapping.**
4. **Control testing (audit level):**
   1. **TOD:**
      - The user uploads evidence to design elements (a walkthrough doc counts).
      - **Ira runs automatically** against every design check → Pass / Fail.
      - **Override** with rationale. Manual ✓/✗ stays.
   2. **Population:** the user uploads files and extracts the population.
   3. **Sample:** draw the sample, as today.
   4. **TOE:**
      - Each attribute shows its **list of required files**; these files are the evidence.
      - When all of them are uploaded, **Run AI validation** → Pass / Fail.
      - **Override** (rationale + Pass/Fail) can replace that result. Manual Pass/Fail and self-attestation stay.

---

## 1. Already built in the prototype — nothing to do
| ID | Sheet ask | Where it already exists |
|---|---|---|
| P1 | FY/CY asked before dates (#36) | New audit → step 1 |
| P3 | AI validation on an attribute (#74) | TOE attribute (reworked in 2.0) |
| P6 | Sample preview and redraw (Dubai) | Sample step: preview, Reject and retry, round-2 redraw |
| P7 | Sample count matches what was asked (Dubai) | Sample step: "Read as" line, then draw |
| P8 | Attribute-level pass/fail (Dubai) | TOE |
| P9 | One extraction button for all files (#63) | Population step |
| P10 | Population preview (#65) | Population step |
| P11 | Success message after creating a RACM (#18) | "RACM created" / "RACM extracted" toast |
| P12 | No extra "RACM Library" header (#13) | RACM tab has a single Create RACM button |
| P14 | Classification clearly stated with the calculation (#83, Dubai) | Sizing → conclusion + "Show working" |
| P15 | No engagement header on the engagement-level control page (#27, part) | Breadcrumb only |
| P16 | Population from files the user uploads | Population → "Upload file" + "Extract population" |
| P17 | Materiality → TB upload → entities in scope worked out from the TB, with overrides and reasons (Dubai scoping) | New audit wizard: Materiality & files + Scope steps |
| P18 | "Not applicable" on design elements (staging). Kept as is: note + reason (Audit team prepared it / Inspected at the client / Not applicable) → "Waived", with an undo | TOD → each design element (`ControlDossier.tsx` ~1380–1398) |

## 2. Add / rework

### 2.0 TOE: required files → AI validation → override (replaces workflow testing)
| ID | What the user will see | Source | Where |
|---|---|---|---|
| T1 | Each attribute shows a **checklist of required files** (the evidence), one row per file with Upload / Replace, file name, and who uploaded it and when | your flow, Dubai per-attribute evidence | `ControlDossier.tsx` attribute card; `types.ts` OperatingStep: one `inputFile` → a list; reuse the `requiredEvidenceTypes` list UI |
| T2 | **Run AI validation** stays disabled until **every** required file is uploaded ("2 of 3 files uploaded"). The result shows Pass / Fail plus Ira's summary. | your flow | existing `runStepValidation`, now gated on the whole list |
| T3 | **Override**: enter a rationale → Override · Pass / Override · Fail. Both the original AI result and the override stay on record, and the override can be removed. | your flow (already built) | existing `overrideStep` + RationaleForm; keep, retest with the list |
| T4 | Conclude TOE: every attribute needs a result from any route (AI validation, manual Pass/Fail, self-attestation or override). The existing gates (stale runs, two rounds, "a statement alone can't pass", AI validation beats attestation) keep working. | follows T2/T3, D11 | `concludeOperating` in `store.tsx` |
| T5 | **Where the list comes from (D10 answered):**<br>(1) On RACM upload, Ira splits the control's **"Control Evidence"** column into required files **per attribute**; the user checks and edits that in the import review (A5/A6).<br>(2) After import, the list is **editable on Engagement → Controls → a control** (attributes table: add / rename / remove a required file).<br>(3) The audit control page's TOE shows it **read-only** as the checklist. | your flow step 3, D10 | `sox-icfr/types.ts`: new required-files list on the attribute (SOX controls have no evidence field today); `store.tsx` createRacm split; `ControlLibraryDetail.tsx` attributes table; seed lists for Altura's controls in `v2ClassicStore.ts` |
| T6 | **Manual routes stay (D11 answered):** the Pass / Fail buttons and the "Self-attestation · manual pass/fail" section on each TOE attribute remain next to AI validation and Override. Only the Workflow side goes (R6). | D11 | `ControlDossier.tsx` attribute card; no change beyond R6 |
| T7 | **Bulk button (D12 answered):** "Test attributes" becomes **"Run AI validation on ready attributes (3 of 5)"**. It runs Ira only on attributes with all required files uploaded, and a toast names the skipped ones and why ("A2: 1 file missing"). Disabled when none are ready. | D12 | `ControlDossier.tsx` ~4162 `runAll` + ~4208 button |

### 2a. Create engagement
| ID | What the user will see | Source | Where |
|---|---|---|---|
| A1 | Error on Basics when the name is over 200 characters | #1 | `audit/sox-testing/ScopingWizard.tsx` |
| A2 | Name already used → suffix such as "(2)" with a note | #2 | same + `data/engagements.ts` |
| A3 | Org chart import also captures **Country**; entity type adds Joint venture / Associate / Branch | #6 | ScopingWizard org-chart import, `soxTestingData.ts` |

### 2b. Engagement → RACM tab (the only place RACM/SOP work lands)
| ID | What the user will see | Source | Where |
|---|---|---|---|
| A4 | On each RACM row (⋯ menu): **Open in spreadsheet editor**, **View SOP** (SOP-made RACMs only), **Delete RACM** (confirmation; blocked while an audit covers it). ~~Version history~~ parked. | #22, #23, view-SOP row | `sox-icfr/Racm.tsx`, `store.tsx` deleteRacm, `auditScope.ts` racmAuditUse |
| A5 | **Upload RACM → column-matching review** before import: file columns → our fields with confidence, "needs attention" list, preview rows. Attributes split one per line or per "\|". Key control carried over. | #90, staging findings | `Racm.tsx` Create RACM, `store.tsx` createRacm |
| A6 | **Upload SOP →**<br>(1) **Prompt screen**: the extraction prompt is shown in full and the user reads or edits it<br>(2) **"Validate prompt & extract"**; nothing is extracted before this click<br>(3) Extraction review: each row tagged *From the SOP* (with section ref) or *Suggested by Ira*; the SOP's own IDs are kept; suggested rows must be accepted | your feedback, #14, Dubai | `Racm.tsx` Create RACM flow |
| A7 | In that review, Ira suggests missing **attributes and design checks** (accept / dismiss) | auto-suggest row, Dubai | reuse `suggestedDesignChecks` (`helpers.ts`) |
| A8 | Warning when a control duplicates one in another RACM | Dubai | import review |
| A9 | **"Fill blanks from other columns":** Ira proposes values for empty fields → **preview of every proposed value** (before/after, row by row) → the user validates (accept all, or accept / reject each) → only then are values written to the RACM | Dubai + your feedback | import review / editor |
| A10 | RACM spreadsheet editor (new tab): select rows → **Update column** → value → apply to all selected | #88 | `audit/RacmFullPageEditor.tsx` |
| A11 | **RACM template, set up inside the RACM tab** before the first Create RACM: suggested starter columns; add / remove / rename columns and describe each; editable AI instructions (the same prompt A6 shows); framework choice. One template per engagement, so one per client. | Dubai RACM 1–5, call | new step in the RACM tab |
| A12 | Starter columns gain: Risk title, Control title, Risk category (Financial reporting / Financial / Operational), Control version/change, Effective date, Country, Subsidiary, Testing strategy, IPE | Dubai | template + `sox-icfr/types.ts` |
| A13 | Control frequency list **without "Continuous"**. It is removed everywhere, and any uploaded "Continuous" value is flagged in import review for the user to choose a frequency. | Dubai + your feedback | template, import review, RACM spreadsheet editor, `types.ts` Frequency (already has no Continuous) |
| A14 | Configurable risk/control ID format: subsidiary / process / risk ID / control ID | Dubai | template |
| A15 | **Location master** next to entities | Dubai | engagement Configuration |

### 2d. Audit → control page: TOD
| ID | What the user will see | Source | Where |
|---|---|---|---|
| A17 | **AI for TOD.**<br>(1) The user uploads evidence to a **design element**. A walkthrough document uploaded as a design element counts as evidence too.<br>(2) Upload **automatically triggers Ira**, which reads the uploaded documents against **every design check** ("Checking 4 design checks…").<br>(3) Each check is marked **Pass / Fail**, with Ira's reason and the file(s) it relied on (filled into "Evidenced by"); "View results" opens the detail.<br>(4) **Override** on each check: enter a rationale → Override · Pass / Override · Fail. The original AI result stays on record, and the override can be removed.<br>(5) A new upload or removal re-runs Ira. An existing override is kept but flagged "Evidence changed since override". | #59 (PwC ask), your D7 answer | `ControlDossier.tsx` PointRow (~560–787): un-park the Validate machinery (`runValidate`, `validating`, `QAResultsModal`) and trigger it from design-element upload; un-park the override pencil + RationaleForm (`overrideDesignPoint`, ~767–783). The manual ✓/✗ buttons and "Attach your own proof" stay on each check (D11). |
| ~~A18~~ | **Parked (D1).** Configurable design parameters (competence, precision, timeliness…); TOD design checks stay as today | #56 | not built |
| A19 | Each evidence file shows its name and **"Uploaded by ‹person› · ‹date, time›"**, and clicking it opens a **preview**. Removing a file is recorded in History (with A20/A21). | #57, #93 | ControlDossier (D2 answered: show uploader + time + preview) |
| A20 | History records adding/removing a design element and a design check | #58 | `store.tsx` |
| A21 | Remove a single file from a design element | gap found | ControlDossier |
| A36 | **Design sign-off after TOD** (on staging, not in the prototype). Once TOD is concluded (effective or ineffective), a **"Design approval"** block appears at the end of the TOD step:<br>(1) "Prepared by ‹auditor› · ‹time›" → sent up the approval chain ("0 of 1 approved")<br>(2) the reviewer chooses **Approve**, or **Return to the auditor** with a note, which reopens TOD for editing<br>(3) four-eyes: whoever concluded TOD can't approve it<br>(4) every action is recorded in History<br>(5) **Gate (answered):** Population, Sample and TOE stay **locked with "Waiting for design approval"** until the reviewer approves TOD. If it's returned, TOD reopens and the later steps stay locked.<br>The step-5 sign-off at the end stays as it is. | staging (Design approval) | `ControlDossier.tsx` TOD step (after the conclude block); new design sign-off action in `store.tsx`, modelled on `signOffControlWp` / `returnControl` + `SignOffSection` (~3861–3940) |
### 2e. Audit → Population & Sample
| ID | What the user will see | Source | Where |
|---|---|---|---|
| ~~A22~~ | **Parked (15 Sep).** Population shows the expected count for the control's frequency (e.g. 12 for monthly) and checks it before lock | #67 | not built |
| A24 | A TOE check that compares source documents against system/master data | Dubai | could run as part of AI validation (T2) |
| ~~A27~~ | **Parked (D8)** until it's discussed with Deepanshu. PDF as a population source; the Population step stays spreadsheet-only. | #66 | not built |

### 2f. New audit
| ID | What the user will see | Source | Where |
|---|---|---|---|
| A28 | **New audit wizard:** pick how samples are spread (by quarter / country / entity). **Control page → Sample step:** still sets how many samples, and adds a yearly running total per control, e.g. "12 of 25 samples tested this year". | #38, Dubai | `NewAuditWizard.tsx`, ControlDossier Sample step (D3 answered) |
| A29 | Year-end controls: TOE shows **"Pending until ‹period›"** and isn't counted as overdue | Dubai | `NewAuditWizard.tsx`, ControlDossier, dashboard |

### 2g. Deficiency management
| ID | What the user will see | Source | Where |
|---|---|---|---|
| A30 | Register gains **Risk owner, Deficiency owner and Due date** columns | #80 | `sox-icfr/extraViews.tsx` |
| A31 | Ira suggests **likelihood, exposure and compensating control**; the auditor accepts or edits | #82 | sizing form |
| A32 | **Exposure worked out from the data** (failed sample / population amounts), with the maths shown | Dubai | sizing + sample model |
| ~~A33~~ | **Parked (15 Sep).** "Headroom to the next grade" shown on the conclusion | Dubai | not built |

### 2h. Scoping, inside the New audit wizard (D4 answered)
Already there in New audit (confirmed in `sox-icfr/NewAuditWizard.tsx`): Audit period → Materiality & files (TB + GL upload, materiality rule) → Scope (entities worked out from the TB with a coverage bar, overrides need a reason; or by RACM, pre-ticked from in-scope entities, Key controls only) → Review. **Create engagement scoping stays parked** (Type → Basics → Review; `ScopingWizard.tsx` flags untouched).

| ID | What the user will see | Source | Where |
|---|---|---|---|
| A34a | **Accounts → processes mapping** after the TB upload (Materiality & files step): each TB account is matched to a process, and the user can change the match | Dubai scoping | `NewAuditWizard.tsx` |
| A34b | **Ira recommends in-scope processes** from that mapping (against performance materiality). Moving a process in or out needs a reason, the same as entities; the RACM side pre-ticks from it. | Dubai scoping | `NewAuditWizard.tsx` Scope step |
| A34c | **Qualitative picks** on the Scope step (bring an entity/process in for non-numeric reasons, with a reason) | Dubai scoping | `NewAuditWizard.tsx` Scope step |
| ~~A35~~ | **Parked (D5).** Three scope buckets: entity-level / ITGC / process-level. The Scope step keeps one flat RACM list. | Dubai | not built |

## 3. Change — built, but wrong or not what the sheet wants
| ID | Today → after | Source | Where |
|---|---|---|---|
| C1 | **Prerequisite (restored 15 Sep):** the RACM spreadsheet editor opened from the RACM tab showed the same 124 procurement rows for every RACM → shows that RACM's own controls | needed for A5–A14 | `Racm.tsx` openEditorTab hand-over, `App.tsx`, `RacmFullPageEditor.tsx` initialRows, `helpers.ts` racmEditorRows |
| C3 | Control objective capped at ~64 characters wide → fills the page, on both control pages | #27 | ControlLibraryDetail, ControlDossier |
| C4 | Engagement control page has no risk in the header → under the objective, show **"Risk R-xx · risk text… More"**, which opens Control activity and the other facts, exactly like the audit control page (already built there in abd9f5b; that page doesn't change) | #27 | `ControlLibraryDetail.tsx` header, copying `ControlDossier.tsx` ~4688–4720 (D6 answered) |
| C5 | Attribute rows repeat the control sentence → attribute text only | #27 | `sox-icfr/mockData.ts` |
| ~~C6~~ | **Dropped for the prototype (15 Sep)** — a staging section; see O1. Population "source" section shows when it doesn't apply → hidden | #62 | staging only |
| C7 | Design element "Attach evidence" invents a file name → real file picker and real name | Dubai | ControlDossier |
| ~~C8~~ | **Dropped (D7).** The Dubai row only meant that a walkthrough document uploaded as a design element becomes evidence for the design checks (covered by A17). The walkthrough card stays switched off. | Dubai | not built |
| C9 | Status labels → one clear pair: **Design effective / Operating effective / Control effective** | Dubai | ControlDossier header, dashboard |
| C10 | Severity disagrees between screens (Clearly trivial reads "Deficiency" on dashboard, overview, working paper) → one grade everywhere | staging + prototype | `helpers.ts` |
| C11 | A design (TOD) deficiency is retested against TOE attributes → against its design checks | gap found | `store.tsx` retest |
| C12 | Controls added inside New audit may lose their design checks when the audit is created → kept | bug found | `store.tsx` |

## 4. Remove
| ID | Remove | Source | Where |
|---|---|---|---|
| R1 | ▶ "Run" icon on engagement cards | #9 | `audit/EngagementsView.tsx` |
| R2 | Duplicate design checks carried in from the RACM (merged on import and at audit creation) | Dubai | import review + `store.tsx` |
| R3 | **Nothing in the app changes.** These ideas are dropped from my first RACM/SOP plan (the one written before the sheets were read). Under your rule that RACM/SOP work lives only in the SOX RACM tab, these are not built: RACM templates in the AI Concierge RACM Generator, the Process Hub RACMs tab and SOP card, the Internal Audit RACM tab, Admin settings as the home for templates, and read-only AI instructions (they are editable now, A6/A11). | your scope rule + Dubai | plan note only, no code |
| R4 | Staging-only things not to copy: the "RACM Library" header, and "assign a risk owner before linking a workflow" (gone anyway with R5) | #13 | dev note only |
| R5 | **Workflow mapping at engagement level:** "Map a workflow" on each attribute, the Workflow column, the "Workflows mapped" count and column on the Controls tab | your feedback | `ControlLibraryDetail.tsx`, `ControlLibrary.tsx` |
| R6 | **Workflow testing inside TOE:** the AI validation / Workflow toggle, "Pull run", workflow result windows, workflow names on attributes. The bulk "Test attributes" button is repurposed per T7. | your feedback | `ControlDossier.tsx`, `store.tsx`. The store actions stay but go unused (parked, same convention as before). |
| R7 | "Continuous" in control frequency | your feedback | see A13 |

## 5. Decisions (all answered)
| ID | Question | Your answer |
|---|---|---|
| D1 | A18 design parameters. The 5W1H / "is frequency appropriate" rows were removed on 30 Jul. | ✅ **Answered: park it.** A18 isn't built; TOD design checks stay as they are today. |
| D2 | A19 show the uploader (hidden on purpose today) | ✅ **Answered: name, time + preview.** Each file shows who uploaded it and when, and opens a preview. |
| D3 | A28 sampling method at audit creation (sample is sized on the control page today) | ✅ **Answered: the audit picks the approach.** The Sample step keeps the size and adds the yearly running total. |
| D4 | A34 scoping: where it lives | ✅ **Answered:** keep it in New audit, which already has materiality, TB and entity scope, and add the missing pieces there (A34a–c). Scoping at Create engagement is parked. |
| D5 | A35 three buckets (ELC module parked on 13 Jul) | ✅ **Answered: park it.** One flat RACM list stays. |
| D6 | C4 risk name back in the header | ✅ **Answered:** copy the audit page's risk line to the engagement control page; the audit page stays as is. |
| D7 | C8 walkthrough card back on | ✅ **Answered: no.** A walkthrough doc is just a design element that evidences the checks. Add AI for TOD instead (A17: upload triggers Ira against the design checks → Pass/Fail → override). |
| D8 | A27 PDF as population ("discuss with Deepanshu") | ✅ **Answered: park it.** |
| D9 | Which "engagement RACM flow" | ✅ **Answered: SOX RACM tab only.** Internal Audit / Compliance RACM screens don't change. |
| D10 | **T1/T5: where each attribute's required-file list comes from** | ✅ **Answered:** Ira splits the RACM's "Control Evidence" column per attribute at import; editable in the import review and on the engagement control page; read-only in TOE. |
| D11 | **With AI validation + override, what happens to manual Pass/Fail (TOD checks + TOE attributes) and TOE self-attestation?** | ✅ **Answered: keep everything.** AI, Override, manual Pass/Fail and self-attestation all stay side by side; existing precedence rules unchanged. |
| D12 | **Bulk action once workflows are gone** | ✅ **Answered:** "Run AI validation on ready attributes"; skipped ones are named (T7). |

## 6. Not prototype work
| ID | Item | Why |
|---|---|---|
| O1 | Staging/backend fixes: RACM upload speed, SOP extraction inventing controls / dropping IDs (#14), merged cells (#87), attribute parsing (#90), Visio org chart (#6), staging control-page header (#27). Plus the staging bugs I logged: side panel keeps previous row's text, source-decision prompt needs a reload, "Conclude ineffective" error, track/severity labels, sample bigger than population, materiality ₹0, same person signs twice, "Your court" label. Also #62: hide the Population source section when it doesn't apply (staging). | Real product: dev ticket list |
| O2 | Dubai follow-ups: stabilise, updated BRD, M365 requirements doc with checkboxes, Tue/Fri calls, progress updates, pilot on real data | Process |
| O3 | "Share the list of the current 36 headers" | Ours to send (list captured from staging) |
| O4 | "Map the end-to-end IFC/SOX process, in vs outside the product" | A document |
| O5 | "Working TOD/TOE demo with real PDFs, screenshots, audit trails" | Demo data prep once T1–T3, A17 and A19 exist |

## 7. Build order (one stage at a time — I stop after each)
| Stage | Rows |
|---|---|
| S0 Prerequisites | C12 ✅ built 15 Sep (C1 removed: not a real issue) |
| S1 Remove workflows + new TOE | R5, R6, T1–T7 ✅ built 15 Sep, pushed in ed3542b. Import-time split + its review screen land with A5 in S3; defaults are read off each attribute's wording and its control's activity until then. |
| S2 Create engagement + list | A1–A3, R1 ✅ built 15 Sep, pushed in 6b1aab3 (not checked on screen) |
| S3 RACM tab: RACM/SOP import review, prompt step, row actions | C1, A4 (version history parked), A5–A10, R2, A13/R7 ✅ built 15 Sep, pushed in ed3542b (on-screen check skipped at your call) |
| S4 RACM template + fields | A11, A12, A14, A15 |
| S5 Control pages | C3–C5 ✅ built 15 Sep, before S4, pushed in 8859db9 (not checked on screen) |
| S6 TOD | A17 (AI for TOD + override), A19–A21, A36 (design sign-off), C7, C9 (A18 parked, C8 dropped) ✅ built 15 Sep, pushed in 8859db9 (not checked on screen) |
| S7 Population / Sample | A24 ✅ built 15 Sep (not committed; build passes; not checked on screen) — A22 parked, C6 staging only |
| S8 New audit + year-end | A28, A29 ✅ built 15 Sep, with your 4 follow-up answers (not committed; build passes; not checked on screen) |
| S9 Deficiencies | A30–A32, C10, C11 ✅ built 15 Sep (not committed; build passes; not checked on screen) — A33 parked |
| S11 RACM library + scoping at engagement creation + ID format | ✅ built 15 Sep (not committed; build passes; not checked on screen) |
| S10 Scoping in New audit | A34a–c ✅ built 15 Sep (not committed; build passes; not checked on screen) — A35 parked |

## Verification (per stage)
- Run the full `npm run build` (tsc -b + vite build). It must pass before a stage counts as done.
- Walk each changed screen on **Altura SOX-104** on the dev server already running on :5173. Note the page and state checked.
- For S1, walk C001 on Altura: population upload → sample → TOE. Check:
  - each attribute's file list
  - AI validation stays locked until all files are in
  - the Pass/Fail result
  - override with rationale, then remove the override
  - "Run AI validation on ready attributes" skips an attribute that's missing a file
- For S6, on the same control's TOD step:
  - upload to a design element → Ira runs → each check shows Pass/Fail + reason
  - override one check with rationale
  - upload another file → re-run + "Evidence changed since override" flag
  - conclude TOD:
    - Population/Sample/TOE show "Waiting for design approval"
    - the same person can't approve
    - switch to the reviewer → Return → TOD reopens
    - conclude again → Approve → Population unlocks
- Playwright only when you ask, batched at the end. These specs assert things R5/R6/A17 change and will need updating: `tests/_verify_control_flow_v2.spec.ts`, plus any spec that touches "Map a workflow" or "Pull run".
- Nothing is committed or pushed without your say. Stage only the files each stage touches.
