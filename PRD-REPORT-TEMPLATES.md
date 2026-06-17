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

1. **Identity** — name, description, category, icon (existing card anatomy).
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
- **Templates landing (16 Jun 2026):** Standard and Custom are split into one switchable pill segment (the same `ToolbarChips` group My Reports uses), so only one gallery shows at a time and a growing Custom list never scrolls the page past Standard. Standard is a fixed 3-card gallery with no search. Custom gets its own search (name + description) plus the **New template** and **Upload template** actions in its toolbar, since both create customs. Each card carries a hover **Customize** (pencil) action, so editing no longer requires opening Generate first. The card footer reads "{N} sections" plus the first section names, replacing the old pill row that leaked non-semantic names on test customs.
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
5. *Nothing else is open beyond the items above and § 6.1 (the five commented-out templates).*

---

## 7. Build notes (constraints, not design)

- Reuse, don't fork: QueryCard, ChooseReportModal, TemplateEditor, Upload Template modal, the report view, the ATR wizard shell. New code limited to the picker tray, arrangement renderers, exec-summary rollup, and export composers.
- Dummy `CUSTOM_TEMPLATES` seeds are replaced by real persisted customs; `REPORT_TEMPLATES` stays at the 3 live entries.
- Template definitions move to data (arrangement type per template), not per-template hardcoded layouts — ✅ `TemplateLayout`'s hardcoded bodies deleted 11 Jun 2026; apply-template renders through the shared engine.
- Frontend-first: persistence via the prototype's existing local persistence; backend contracts are the tech team's scope.
