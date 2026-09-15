# Plan — SOX feedback sheets vs the current flow (revision 3)

## Correction (15 Sep, during S3) — C1 is real after all
- On 15 Sep, during S0, I said no SOX screen opens the full-page RACM editor, undid C1 and removed it. **That was wrong.** Clicking a RACM on Engagement → RACM tab opens the spreadsheet editor **in a new browser tab** (`openEditorTab`, `?view=racm-full-editor`), and that tab showed the 124 procurement sample rows for every RACM. I had only searched the in-app route.
- **C1 is restored in S3.** The RACM tab hands the RACM's own controls to the new tab (via local storage), and the editor shows them. **A10 (bulk-edit a column) is back in that editor.**

## S3 decisions (15 Sep)
- **C1:** restore it, keeping the new-tab editor.
- **A5:** read the real uploaded .xlsx/.csv: header row → column matching with confidence → review → import creates controls from the file's rows. Falls back to the template if unreadable.
- **A4 Delete RACM:** blocked while any audit covers its controls (menu item disabled with the reason); otherwise confirm → delete.
- **A4 Version history:** parked. **View SOP** appears only on RACMs made from an SOP and opens the uploaded file for the session.

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
| A22 | Population shows the **expected count for the control's frequency** (e.g. 12 for monthly) and checks it before lock | #67 | ControlDossier, reuse the switched-off count row |
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
| A33 | "Headroom to the next grade" shown on the conclusion | Dubai | sizing conclusion |

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
| C6 | Population "source" section shows when it doesn't apply → hidden | #62 | ControlDossier |
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
| O1 | Staging/backend fixes: RACM upload speed, SOP extraction inventing controls / dropping IDs (#14), merged cells (#87), attribute parsing (#90), Visio org chart (#6), staging control-page header (#27). Plus the staging bugs I logged: side panel keeps previous row's text, source-decision prompt needs a reload, "Conclude ineffective" error, track/severity labels, sample bigger than population, materiality ₹0, same person signs twice, "Your court" label. | Real product: dev ticket list |
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
| S5 Control pages | C3–C5 ✅ built 15 Sep, before S4 (not committed; build passes; not checked on screen) |
| S6 TOD | A17 (AI for TOD + override), A19–A21, A36 (design sign-off), C7, C9 (A18 parked, C8 dropped) ✅ built 15 Sep (not committed; build passes; not checked on screen) |
| S7 Population / Sample | A22, A24, C6 |
| S8 New audit + year-end | A28, A29 |
| S9 Deficiencies | A30–A33, C10, C11 |
| S10 Scoping in New audit | A34a–c (A35 parked) |

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
