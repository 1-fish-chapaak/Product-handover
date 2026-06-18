# PRD — Report Templates (Query-Level Engine)

**Status:** ✅ Built & verified in-browser — 11 Jun 2026 · branch `feat/report-templates-engine` (uncommitted) · **Owner:** Nilesh Anand
**Surface:** Reports → Templates tab, Generate wizard, generated report view
**Principle:** Everything is built at **query level**. A query is the atomic unit of audit work on this platform — the template is the structure that works around the queries a user attaches. No template produces an empty shell.

> **Build status (11 Jun 2026):** all in-scope items shipped and verified in-browser. Generate wizard (single source — queries grouped under the Reports they live in; dedupe; skip-empty removed 12 Jun 2026; Workflows + Recent Chats tabs removed 15 Jun 2026, picker is now tab-less) · real query-driven reports with composed exec summary · **generated reports bake the template's advertised sections as editable blocks around the query body, so advertised structure = delivered structure** (anchor section — e.g. Control Testing Results / Audit Queries — heads the queries; each section gets starter prose composed from the attached queries) · custom templates persisted with all four creation paths (copy / scratch / upload / save-report-as-template, duplicate names auto-suffix) · empty drafts compose Executive Summary, Recommendations & Appendix live from attached queries · real PDF / Word (.doc) / PPT (.ppt) exports. SOX gained a **Testing Methodology** section (domain-practice gap found during verification). My Reports and Shared Reports tabs untouched throughout. New files: `GenerateReportWizard.tsx`, `templateQueryPool.ts`, `reportExport.ts`.

---

## 1. Goal

Today only the ATR template generates a real report; Internal Audit and SOX produce empty drafts with placeholder sections, and the six custom templates are dummy data. This revamp makes **every live template generate a real, query-driven report** using the flows and components the platform already has — QueryCards, the ATR-style wizard, the Add Query pattern, the existing report view. Nothing structurally new; the existing structure, finished.

**Success metrics**
- **Primary (adoption):** % of all reports created through a template (vs. blank/upload).
- **Guardrail (speed):** median time from clicking Generate to a shareable draft.

**Non-goals:** backend persistence/sharing infra (tech team), report lifecycle/sign-off states (status remains a label), role-gated template editing (everyone can edit everything), auto-scheduling of report generation, reviving the commented-out templates (see Open questions).

---

## 2. Concepts

### 2.1 The current report format (as-built — this is the engine)
A populated report today is already an **ordered stream of typed blocks** (drag-to-reorder): `cover`, `contents`, `summary` (exec summary, with a regenerate hook), `stats`, `query` (QueryCard — the core unit), `workflow` (bulk-audit result cards), `observation`, `upload`, `note`, `source`. This format is kept as-is — it *is* the report engine. ✅ Retired (11 Jun 2026): the hardcoded `TemplateLayout` fake bodies are deleted (~440 lines) — the apply-template path now renders the same engine composition as generated reports (section cards with composed prose + real QueryCards at the anchor). The empty-shell placeholder path now composes live from attached queries. ATR's own document format (`atrData`) stays untouched.

### 2.2 What a template is
A template = **branding + an executive-summary rollup + an arrangement for queries**, expressed in the existing block format: generate composes a block stream (cover → contents → summary → stats → query blocks in the template's grouping), it does not invent a new renderer. Queries are the core block; observations, uploads, notes and workflow blocks remain addable exactly as today. The template contributes:

1. **Identity** — name, description, category (now the **Report type**, see §4.5), icon (existing card anatomy).
2. **Branding** — brand name, theme, header/footer text (existing TemplateEditor fields).
3. **Executive Summary rollup** — the one auto-built section: an opening summary aggregated from the attached queries' summaries. Editable prose after generation.
4. **Query arrangement** — how the template groups/orders queries. Arrangement is presentation only; the queries themselves are identical objects everywhere.

### 2.3 Query sources (all four, freely mixable)
| Source | What it is | Existing pattern reused |
|---|---|---|
| Existing report's queries | Pull queries already attached to a report in My Reports | ChooseReportModal |
| Query library / Ask IRA | Cherry-pick queries from history and favourites | Query history/favourites lists |
| Workflow / bulk-audit results | Query-shaped results from workflow runs | Bulk Audit workflow cards |
| Run new queries inline | Add/run queries inside the generated report | Add Query in report view |

---

## 3. Template catalog (the 3 live today)

Scope is the templates currently shipping in the Templates tab — no additions.

| Template | Status today | Query arrangement |
|---|---|---|
| Internal Audit Report | ✅ Shipped — query-wizard generate | Flat list in attach order; exec summary up front |
| SOX Compliance Report | ✅ Shipped — query-wizard generate | 6 sections (incl. Testing Methodology); queries slot under Control Testing Results; Detailed Description (deficiency analysis) / Appendix follow. Remediation Status removed 15 Jun 2026 |
| ATR Report | Live, real generate (keep as-is) | Existing query-wise summary + closure + sign-off — unchanged, regression-protected |

---

## 4. User journey

### 4.1 Generate (wizard, ATR pattern, all templates)
Clicking **Generate** on any template card opens a stepped wizard:

1. **Step 1 — Pick the body.** A single, tab-less picker: rows grouped **under the report they live in**; the group header checkbox takes or drops the whole report, with indeterminate state for partial picks. A search box filters across title and report name. User assembles any mix; selections collect into a tray with a running count (queries and workflows counted separately). Minimum one item to proceed — there is no skip/empty path (removed 12 Jun 2026; "no empty reports" now holds with zero exceptions). **Workflows tab + bulk-audit trigger removed 15 Jun 2026** (duplicate workflow names made raw selection ambiguous). **Recent Chats tab removed 15 Jun 2026** (and with it the inline rename that existed only for chat rows) — Reports is now the sole source.
   - **Two row kinds.** Most reports contribute **query** rows. A **Bulk Audit** report contributes its **completed workflow runs** as rows instead (`pickWorkflow` in `templateQueryPool.ts`): each shows the WF id, business process, flagged-record count, and severity; failed/skipped runs are excluded (matching how the Bulk Audit report omits them from its body). Bulk-audit groups carry a brand-tinted **"Bulk Audit" chip** on the header (`WORKFLOW_ORIGIN_REPORTS`). Pick unit is **per-workflow** (cherry-pick or take all via the header). Dedupe keys are `wf:<workflowId>` for workflows, the query key for queries (15 Jun 2026).
   - **Step 2** shows two reorderable lists when both kinds are present — *Query order* and *Workflow results* — plus the editable exec-summary rollup (composed from both; workflows are projected to query-shaped defs only for the count/severity prose). On generate, query picks become QueryCard blocks and workflow picks become **`kind:'workflow'` result blocks** — record table + findings + observations, rendered by the same `WorkflowResultCard` the Bulk Audit report uses — so a generated report carrying workflow runs matches the bulk-audit flow exactly. Template note sections (`composeSectionContent`) count both kinds.
2. **Step 2 — Preview.** The template's arrangement applied to the selected queries: exec-summary draft, grouping, query order (drag to reorder). Branding shown as it will render.
3. **Step 3 — Create.** Report is created as a draft, named `{Template name} — {date}` (editable), opens in the existing report view.

**Card UX (12 Jun 2026):** clicking anywhere on a template card opens the Generate wizard directly — one click to the primary action. The card now lists its sections inline ("7 sections · Executive Summary · …"), so the old TemplatePreviewModal and its duplicate actions (Edit / Use with report) are deleted along with ChooseReportModal (~205 lines). Apply-template to an existing report still lives in the report view's Apply Template dropdown.

ATR keeps its existing wizard (download → upload → review → add) — now with a third source: **pick an existing report** on the Template step. The report's queries (or workflow results) are converted to ATR observations and the wizard jumps straight to Review, no upload needed. Meta (audit title, prepared-by, period) prefills from the report.

### 4.2 Inside the generated report
- Body = QueryCards in the template's arrangement. All existing per-query behavior carries over: open query, comments, Generate Cases, Manage Exceptions.
- **Add Query** stays available — new queries from any source slot into the arrangement (e.g. a High-severity query lands in the right group automatically).
- Exec summary is composed at generate time from the selected queries and is editable in the wizard preview (manual edits are preserved).
- **Shipped beyond spec:** on empty drafts, Executive Summary, Recommendations and Appendix compose live from attached queries — attach or remove a query and they recompute instantly, no manual refresh step.

### 4.3 Customize / edit templates (no gating)
- **Templates landing (card galleries).** Standard and Custom show on one scrollable page as two labelled card galleries (a header with the section name and a count), each a three-column grid. A single sticky search at the top filters both galleries by name and description, alongside the **New template** and **Upload template** actions (both create customs). Each card shows the category eyebrow, name, a two-line description, and a footer with a "{N} sections" pill; an approved-format custom shows a green **Approved format** badge there in place of its first section names. Clicking the card body is the primary Generate action.
- **Card actions (hover).** **Customize** a custom (pencil) or **Clone to edit** a standard (copy), **Delete** a custom (confirm dialog), and, on an approved-format custom, **Check a file against this format** (the format-match entry point). So editing no longer requires opening Generate first.
- **Customize** on any card → existing TemplateEditor (brand, theme, header/footer, arrangement). Customizing a **standard** template opens the editor on a copy, so saving adds your own version to Custom and the shared original is never touched. Customizing a **custom** template opens it in place and Save updates that entry (`onSaveEdit` / `updateCustomTemplate`). **Save as copy** is also in the edit-mode footer, forking the current edits into a new custom named "Copy of X" (suffixed on collision).
- Custom template creation — wiring the surfaces that already exist in the product:
  1. **Copy a standard** (exists — needs persistence).
  2. **Create from scratch** — blank editor: identity + branding + arrangement choice (flat / by severity / by status / by control area).
  3. **Upload a template file** — existing Upload Template modal, wired: upload .docx structure, map headings to arrangement.
  4. **Save report as template** — from any report, capture its arrangement + branding (hook exists in code today).
- Custom templates persist (frontend persistence consistent with the rest of the prototype). The Custom section starts empty — the six demo seeds are removed (filtered out of any previously persisted blob too). Each custom card has a Delete action with a confirm dialog; deleting a template never affects reports already generated from it.

### 4.4 Export
✅ **Shipped.** Per generated report, from the existing download modal: **PDF** (composed print window → "Save as PDF"; pop-up-blocked case surfaces a clear error), **Word (.doc)** (Office-HTML, opens natively in Word — same proven pattern as the ATR exporter), **PPT (.ppt)** (title slide + exec-summary slide + one slide per query with severity, KPI tiles, top-4 findings). No Excel for template reports, per ruling.

✅ **ATR-parity layout (12 Jun).** Generated reports — standard and bulk audit — render with the ATR document chrome (brand banner, metadata grid, numbered sections, KPI tile grid; shared `ReportDocumentChrome.tsx`), and the Word/PDF/PPT composers mirror that same layout. The bulk-audit report's download menu now produces real files via the same composers, plus a real **Excel (.xlsx)** workbook (workflow summary sheet + one sheet per workflow's flagged records — pre-existing bulk menu item made real; the no-Excel ruling applies to template reports, ATR/bulk keep their Excel precedent).

*Tech-team follow-up:* true OOXML `.pptx`/`.docx` fidelity needs a library (e.g. pptxgenjs) — current exports follow the ATR Office-HTML precedent, which PowerPoint imports less gracefully than Word.

---

## 4.5 Report type

**Problem.** Standard templates already wear an Audit / Compliance badge, but custom templates carry none, so the library reads inconsistently and there is nothing to group or filter on once it grows past a handful.

**My thinking.** Report type should be a label on a template, not a new object and not a driver of structure. The moment type starts defining sections or rerouting Generate, it stops being a tidy taxonomy and becomes a second source of truth that fights the template body. So this pass keeps type as a confirmed label only: the detector can propose it, the user owns it, and the richer uses wait until the plain label is in place.

**Controlled vocabulary.** A fixed list, not free text. A clean taxonomy is what makes filtering and reporting useful later; free text becomes "audit", "Audit", "internal audit" within a week. "Other" is the escape hatch.

| Type | For |
|---|---|
| Audit | Internal, operational, and safety audits |
| Compliance | Regulatory and policy compliance reviews |
| SOX | SOX / ICFR control reporting |
| ATR | Action Taken Reports |
| Risk | Risk assessments and registers |
| Other | Anything outside the set |

**How it should work.**
- **Set at creation.** The Smart Upload review screen (and the template editor) carry a Report type dropdown beside the template name.
- **AI proposes, the user confirms.** The detector reads the section names and pre-fills a likely type (a body with Control Testing Results plus Corrective Actions proposes Audit). The value is editable and nothing is locked.
- **Shown on the card.** Type renders as the card badge, the same treatment standard templates already use, so custom and standard cards read the same way.
- **Stored as the template's category.** Type is presentation and filtering only. It does not change which sections generate, and it does not reroute the card's Generate action (verified: `templateKind` keys off id and name, never category).

**Decision: fixed vs org-editable.** Fixed-with-Other for now. Org-defined types are a one-line change to the vocabulary later; we hold them back until there is a real request, because a consistent taxonomy is the whole point of having type at all.

**Deferred (flagged, not built this pass).**
- **Type filter** on the Standard / Custom tabs. Worth adding once the library passes a handful of templates.
- **Type-driven smart section defaults** (pick SOX, get the usual SOX sections proposed). This is the AI section-suggestions idea, and type is its natural trigger, but it is the upgrade that makes type define structure, so it comes after the label lands. Specified and built in §4.6 (editor pre-fill + upload-flow coverage).
- **Scoping format-match by type** (only compare an upload against approved formats of the same type).

**Verify against plan.**
- Creating or uploading a template offers a type dropdown, pre-filled with a proposed value and editable to any of the six.
- The chosen type shows as the card badge with the standard category styling.
- Changing a custom template's type never changes its sections or its Generate behavior.
- Type is always one of the fixed six, never free text.

---

## 4.6 Report type to required / recommended sections (smart defaults)

This is the Phase-2 upgrade §4.5 deferred: once type is a confirmed label, it drives a curated set of sections the type usually has, so the user starts from a real shape instead of nothing. Strongly guided, never locked.

**Decision: a curated per-type map, surfaced in two places.** Each type carries its own required and recommended sections, a `TYPE_SECTION_MAP` in `reportShared.ts` (all five types plus "Other"). An earlier "derive only from the standard templates" approach was tried and reverted: the standards are too lean (Internal Audit ships 4 sections) and ATR has no standard, so it dropped ATR's sections and the richer recommended sets. The curated map covers every type, ATR included. Presence-detection is tolerant via a per-section `match`, so a detected "Detailed Findings" satisfies the Audit "Findings / Observations".

The map drives two surfaces:
- **Editor (create from scratch).** Picking a type pre-fills its sections; a coverage line plus soft-warn chips show what is missing; the one block (a missing required section on save) is skippable with a confirmation.
- **Upload review canvas.** After detection, a "{type} sections" panel shows the chosen type's required and recommended sections checked against the detected ones. Switching the type re-evaluates it. The sections the document is missing are click-to-add chips (required in red, recommended muted), plus an "Add N missing" action; an added one is tagged "Added for type". This is the upload flow: detect the document's sections, switch the type, add what that type expects.

**The model.** Two tiers per type. **Required** is the small set that defines the type; **recommended** is the usual rest. "Other" carries nothing (the escape hatch, labeled "limited format checking").

| Type | Required | Recommended |
|---|---|---|
| **ATR** | Observation / Finding · Action Taken · Closure / Classification Status | Original Recommendation (MAP) · Risk Significance · Due Date · Auditor Verification / Comments · Supporting Evidence |
| **SOX** | Control Testing Results · Deficiencies / Exceptions · Conclusion / Management Assertion | Executive Summary · Scope & Methodology · Control Environment Overview · Remediation Plan · Sign-off |
| **Audit** | Findings / Observations · Recommendations · Conclusion / Audit Opinion | Executive Summary · Scope & Objectives · Testing Methodology · Management Response · Sign-off |
| **Compliance** | Compliance Assessment · Gaps / Non-compliance · Conclusion | Executive Summary · Regulatory Scope & Framework · Remediation / Action Plan · Sign-off |
| **Risk** | Risk Findings / Register · Risk Rating / Significance · Mitigation / Treatment Plan | Executive Summary · Risk Methodology · Risk Heatmap / Summary · Conclusion |
| **Other** | none | none |

> ATR earns the strongest required list: an ATR with no action taken or status is structurally not an ATR. (The ATR wizard separately enforces these as per-observation fields in `REQUIRED_FIELDS`; the map here is the section-level view used by the type coverage and the upload flow. ATR is no longer special-cased out of the section map.)

**Behavior.**
- On type select in the editor, pre-fill the required and recommended sections. "Other" pre-fills nothing.
- Coverage line, e.g. "3 of 3 required and 2 of 5 recommended".
- Soft-warn on missing sections. The only block is a missing required section on save, and it is skippable with a confirmation. The carrot (the easy pre-filled path) does the work, not the stick.
- Users add sections beyond the type's map and still save.

**Generator name-mapping.** Pre-filled section names are names `composeSectionContent` (`templateQueryPool.ts`) recognises, so a generated report composes real query-derived prose at those sections rather than placeholder text. The matcher covers the curated anchors and the conclusion / sign-off / gaps / mitigation sections; the query body (where the QueryCards render) is the section matching the anchor keywords (testing results / quer / findings / assessment / register).

**Validation caveat (this map is not final).** The tiers are general audit and compliance practice. The real ATR format, and any India-specific or client-specific regulatory requirements, override this list. The true "must" set is confirmed with the auditors before any item is treated as a hard block. When in doubt, demote a block to a soft-warn; every hard block is a potential churn point.

**Verify against plan.**
- Editor: selecting a type pre-fills its sections; "Other" pre-fills nothing and shows the limited-format-checking label; a live coverage line updates as sections change; missing-required is a skippable block.
- Upload: after detection, switching the type shows that type's required and recommended sections, and a missing one can be clicked to add it (tagged "Added for type").
- **Smart defaults only guide a new template, never audit an existing one.** For an uploaded or already-built template the user's sections are the real format: the editor offers the *recommended* sections as optional suggestions ("Recommended for X", "Add N suggested"), shows no required chips, and never blocks save. (Gated on `isNew` in `TemplateEditor.tsx`.)
- A user can add sections beyond the type's map and still save.
- Format-match validation only compares against approved references of the same report type.

---

## 4.7 Smart Upload review canvas (build checklist)

The upload review screen (source document on the left, detected sections on the right) is where upload earns or loses trust, so its fixes are tracked as prioritized acceptance criteria.

**Critical.**
- **Ground the confidence badge in a real signal.** The engine does not return a per-section confidence score today, so a "high / low" badge is a false promise. Label by *evidence type* instead, what the detector actually has: explicit styled heading vs. inferred vs. a possible fragment. (Built: badges read "Explicit heading / Inferred / Possible fragment".)
- The lowest-confidence state must actually render (it is the one that most needs attention).
- **Delete is reversible.** A misclick must not silently drop a section: confirm or undo. (Built: undo toast.)

**Important.**
- Drag-to-reorder detected sections (the detector may return them out of order). (Built.)
- Helper text on "Set as approved format" so a first-timer knows what it does. (Built.)
- The "needs a look" count is actionable (jumps to the flagged sections). (Built.)

**Polish.**
- Block save while a section name is empty. (Built.)
- Warn on a duplicate template name at save. (Built.)
- Two-way "show in document": clicking a section highlights it in the source, and vice-versa. (Built.)
- A loading/skeleton state while detection runs. (Built.)

**Verify against plan.** Every Critical item holds before this screen ships; an ungrounded confidence badge is treated as a release blocker, not polish.

### 4.7.1 Fragment to merge (the one real gap, next to build)

Today a "Possible fragment" badge raises an alarm with no matching fix: rename and delete are the only actions. But a fragment almost always means the detector split one section in two, so the fix the user actually wants is to merge it into the neighbour. This is the only place on the screen where the system flags a problem it does not let the user resolve.

- **Action.** A fragment row offers **Merge up** (fold into the section above) and **Merge down** (fold into the section below). The first row offers only Merge down; the last row only Merge up.
- **Name.** The surviving section keeps the *target's* name (merge up keeps the section-above's name, the common case); the fragment's name is dropped.
- **Content and order.** The fragment's source range is absorbed into the target (its body text appends to the target's at generate time); the fragment row is removed, the target stays put, and the section count drops by one.
- **Reversible.** Merge drops a row, so it shows the same Undo affordance as delete (restoring both rows in their original order).
- **Logged.** The merge (which fragment folded into which target) is recorded in the template's change history, so the structural edit is traceable, the same bar as any compliance-relevant action.
- **Acceptance.** A fragment can be merged up or down; the result keeps the target's name and tier; the count decrements; Undo restores both rows; the action appears in history.

### 4.7.2 Polish backlog (tracked, not built)

None of these are broken; they are the gap between good and best-in-class.

2. **Coverage count readability.** The "{n} of {m} required" line is numerically correct, but a reader scanning green chips (which span both tiers) can misread it as a mismatch. Make the count and chips tie together legibly (group or label the tiers). Verified not a miscount in the upload panel; the editor panel is where the split read as confusing.
3. **Badge reason on hover.** Pair the evidence badge with a one-line "why" ("found as a styled H2" / "inferred from a bold line"), making the grounding visible where an auditor wants it.
4. **Section content preview.** A collapsed one-line snippet of the section body on each right-hand card, so the user judges "Testing Methodology, Inferred" without cross-referencing the left panel.
5. **Empty and edge states.** Design the 0-sections, 1-section, and poor-OCR cases: "we could not detect much, add sections manually?" rather than an empty review canvas with no guidance.
6. **Bulk actions beyond Add missing.** "Accept all explicit-heading sections" so the user only has to touch the flagged ones, reinforcing the review-only-what-needs-attention principle.
7. **Keyboard and accessibility.** A keyboard equivalent for drag-reorder (move up/down) and a focus trap on the modal; procurement often carries a11y requirements.
8. **Footer crowding.** Name + type + approved-format + Cancel + Save is a lot for one bar; pressure-test the responsive wrap on smaller screens.
9. **"Show in document" both ways.** Confirm it scrolls and highlights on the left, and that clicking a left heading highlights the matching right row.

---

## 5. QA / UAT scenarios

*Verified in-browser (Playwright) 11–12 Jun 2026: mixed-source generate, all four custom-template paths, persistence across reload, duplicate-name suffix, dedupe notice, zero-query block, no-skip rule, all three exports. Not yet exercised: ATR-generate regression click-through, template-deleted-while-open, unmappable upload file.*

### Positive
- Generate each of the 3 templates with queries from all three picker tabs mixed → real report, correct arrangement, exec summary references actual query content.
- Legacy empty drafts (created before the skip removal) still fill in when queries are attached inline.
- Copy / scratch / upload / save-as-template each produce a working custom template that generates like a standard one.
- Export all three formats from a generated report; reopen app → custom templates and generated reports persist.
- ATR regression: Generate on ATR opens its existing wizard; existing ATR reports render unchanged.

### Negative / edge
- Generate with zero queries selected and without choosing skip → blocked with inline message.
- Source report with zero queries → tab shows empty state, not a blank list.
- Duplicate query selected from two sources → deduped in tray with a notice.
- Template deleted while a report generated from it is open → report unaffected (reports own their data after generation).
- Upload-template with unmappable file → clear failure state, modal stays recoverable.
- Exec summary refresh while a query is still running inline → summary waits, shows pending state.

### Graceful-failure principles
- A generated report is never blank: at minimum exec-summary placeholder + empty arrangement with Add Query affordances.
- Wizard state survives accidental close (confirm-abandon, same as TemplateEditor dirty-check).
- Reports own a snapshot of their query content at generation; later edits to source queries don't silently mutate existing reports.

---

## 6. Open questions

### 6.1 The five commented-out templates

Five templates are fully defined but commented out in `mockData.ts` (`rt-002`–`rt-006`). None are in scope. Each carries the same three open questions: **(a) revive at all? (b) if yes, when? (c) what query arrangement?** Per-template breakdown:

**`rt-002` — Risk Assessment Summary** (category: Risk)
- *Defined sections:* Executive Summary, Risk Identification, Risk Matrix, Mitigation Strategies, Trend Analysis, Recommendations.
- *Data the platform already has:* every query carries severity + findings; exceptions carry risk category and severity.
- *Query fit:* **strong** — natural arrangement is group-by-severity (Critical → High → Medium).
- *Open:* revive decision only; no data blocker.

**`rt-003` — Control Effectiveness Report** (category: Controls)
- *Defined sections:* Executive Summary, Control Environment Overview, Testing Methodology, Effectiveness Ratings, Gap Analysis, Improvement Plan.
- *Data the platform already has:* controls with Effective / Ineffective / Not Tested states, RACM entries, controls-by-process.
- *Query fit:* **medium** — queries don't natively carry a control link today; arrangement would be queries-as-control-tests grouped by control area.
- *Open:* revive decision + whether a query↔control link must exist first.

**`rt-004` — Workflow Analytics Report** (category: Analytics)
- *Defined sections:* Executive Summary, Workflow Performance Metrics, Exception Trends, Processing Efficiency, Anomaly Detection Results, Recommendations.
- *Data the platform already has:* workflow run results (findings, severity, output tables) — but as run artifacts, not metrics over time.
- *Query fit:* **weak** — it's a metrics/analytics page, not a query-bodied report.
- *Open:* whether this belongs in Templates at all, or in a future analytics surface.

**`rt-005` — Deficiency Tracker** (category: Audit)
- *Defined sections:* Executive Summary, Key Findings, Deficiency Details, Remediation Progress, Timeline & Milestones, Appendix.
- *Data the platform already has:* deficiency records with finding, severity, linked control, assignee, status, due date; exceptions classified as Control Deficiency.
- *Query fit:* **strong** — natural arrangement is one row per query exception/case, grouped by status.
- *Open:* revive decision only; no data blocker.

**`rt-006` — Executive Dashboard Export** (category: Executive)
- *Defined sections:* Executive Summary, Key Metrics Dashboard, Risk Heatmap, Compliance Scorecard, Strategic Recommendations, Outlook & Next Steps.
- *Data the platform already has:* pieces exist across modules (risks, controls, exceptions) but no aggregated GRC-posture rollup.
- *Query fit:* **weak** — board-deck dashboard, not query-shaped; overlaps with the PPT export (§4.4).
- *Open:* whether the PPT export already covers this need, making the template redundant.

Nothing in this PRD blocks reviving any of them later — all five would run on the same engine; reviving the strong-fit ones (`rt-002`, `rt-005`) is uncommenting the definition + assigning an arrangement.

### 6.2 Other open items

1. **PPT composition** — ✅ resolved: shipped as proposed (exec summary + one slide per query).
2. **Snapshot-on-generate** — ✅ resolved: implemented; reports bake their query content at generate time and never live-link back to sources.
3. **Engagement "Generate Report" button** — the engagement page's Action Trail tab has its own Generate Report button (`EngagementOverviewView.tsx:1081`). It produces a period-based AI summary of the trail and is not connected to the Reports page or the wizard. Open: does the main Reports page need this button too, and should both run through one flow?
4. **Query / workflow result actions (the branch point).** When a query or workflow run finishes, its result action bar (`WorkflowExecutor.tsx:2227`) offers Download CSV, Add to Dashboard, Create Exceptions, Run again. Two gaps: Add to Dashboard and Create Exceptions have no click handler (dead buttons), and there is no Add to Report at all, even though the chat path already ships an Add-to-Report modal. A query result is the platform's hub, so the bar should branch to the same destinations everywhere: Report (insert as a query-wise section, the priority gap), Exceptions (promote flagged rows to cases in Manage Exceptions), Dashboard (pin as a widget), and Workflow (save a one-off query to re-run). Open: should this result bar become one consistent, fully wired branch point across both chat answers and workflow runs, and is "Add to Report" in scope for this engine or a separate ticket?
5. **Required: vendor-fixed or org-editable?** §4.6 makes the flagged-required set vendor-controlled for v1. Open: do enterprises need to define their own required sections per type? Recommendation: keep it fixed for v1 (simpler, more defensible, and it keeps the taxonomy clean), then open it up once we see what enterprises actually ask for. Note: the sections themselves are a curated per-type map (`TYPE_SECTION_MAP`, §4.6), not derived from the standard templates. The standards-derived approach was reverted because it dropped ATR and the richer recommended sets.
6. *Nothing else is open beyond the items above and § 6.1 (the five commented-out templates).*

---

## 7. Build notes (constraints, not design)

- Reuse, don't fork: QueryCard, ChooseReportModal, TemplateEditor, Upload Template modal, the report view, the ATR wizard shell. New code limited to the picker tray, arrangement renderers, exec-summary rollup, and export composers.
- Dummy `CUSTOM_TEMPLATES` seeds are replaced by real persisted customs; `REPORT_TEMPLATES` stays at the 3 live entries.
- Template definitions move to data (arrangement type per template), not per-template hardcoded layouts — ✅ `TemplateLayout`'s hardcoded bodies deleted 11 Jun 2026; apply-template renders through the shared engine.
- Frontend-first: persistence via the prototype's existing local persistence; backend contracts are the tech team's scope.
