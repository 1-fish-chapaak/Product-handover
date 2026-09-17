# Create Report — module guide

A working prototype of the **external report → Action Taken Report** flow. The
**Create Report** CTA in the Reports module (My Reports toolbar) opens it as
a modal and walks the user from uploading an audit report through to a
generated ATR, which is saved into **My Reports** and opened there.

> Everything is mocked — there is no real document parsing and no backend. AI
> extraction is simulated with realistic delays and pre-seeded data; all state
> persists to `localStorage`.

## Where it lives / how it hooks in

- **Modal:** `ReportsView.tsx` renders `<AtrUploadTab>` inside a centered dialog when `atrUploadOpen` is set (the **Create Report** button). Minimising during extraction drops it to a floating toast so the reports list stays usable.
- **Saved reports:** `AtrUploadTab` calls `onGenerated(sessionId, data)`; `ReportsView.saveUploadedAtr` upserts a `gr-atr-upload-<sessionId>` card into the generated-reports store, toasts *“… has been generated and saved in Reports.”*, closes the modal and opens the report in `AtrReportView`. One extracted report = one card; **View report** reopens the same card (with any edits made in the reader).
- **Admin:** the **Admin** tab of the Reports module (next to *Templates*) renders `screens/AdminTab.tsx`. `AdminSettingsProvider` wraps the whole `ReportsView` so the Admin tab and the wizard share one store (`irame.atr-admin.v1`).
- **Renderer reuse:** the saved report renders through the existing `AtrReportView` / `AtrDocument`, so the brand format matches every other ATR.
- **Data reuse:** mock observations + insights come from `atrTemplate.ts` (`SAMPLE_OBSERVATIONS` / `SAMPLE_INSIGHTS`); template downloads reuse `downloadExcelTemplate` / `downloadWordTemplate`.
- **Audit log:** key actions emit `useAuditLog().logEvent(...)` (visible in Admin → Audit Logs): upload/extract, generate.

## Files

| File | Role |
|------|------|
| `AtrUploadTab.tsx` | Wizard root — provider, tab bar (Select · Upload · Observations Extracted), screen router, edge-case triggers. Generating an ATR stamps `session.generatedAt` and hands the data to the host via `onGenerated`. |
| `AtrUploadContext.tsx` | `useAtrUpload()` store; `localStorage` key `irame.atr-upload.v1`; persists on every action + 30s heartbeat; resume detection. |
| `adminStore.tsx` | `useAdminSettings()` — lists of values, report-field config (mandatory flags + custom fields), default escalation matrix, transaction logs. Provided by `ReportsView`. |
| `reportFields.ts` | The report-details field catalogue: built-in fields with their default mandatory state (Report Name — auto-filled from the uploaded file, renamable, and locked as it names the extracted report and its ATR — plus Audit Title, Audit Entity, Function and Audit Period are mandatory; Section, Review type, Audit location, Region, Location, Report Number and Prepared By are optional), the auto-filled fields, and the `CustomReportField` shape. Custom values live in `ReportMeta.custom`. |
| `types.ts` | Data model (`ExtractionSession`, `ExtractedObservation`, `ExtractedAnnexure`, `MissingField`, `AtrVersion`, …). |
| `mockExtraction.ts` | The 5 + 1 seeded observations, 5 annexures, processing messages; `seedSession` / `seedEmptySession`. |
| `observationFields.ts` | The 10-field get/set layer + completeness recompute. |
| `toAtrReportData.ts` | Maps a session → `AtrReportData` for `AtrDocument` (selected only, skipped fields cleared). |
| `handoff.ts` | Per-observation "Manage Exceptions" hand-off (new tab) via the existing `from=<id>` path; the query summary is also persisted (`irame.atr.handoffs.v1`) so the new tab shows the context card. |
| `screens/` | `Step1MethodSelect` · `Step2aTemplateDownload` (one **Download a template** CTA with an Excel / Word dropdown, then upload + details) · `Step2bReportUpload` · `Step3Processing` · `ReportsExtractedList` (the *Observations Extracted* grid + global filters) · `ReportDetailView` (opened report: editable header + observations + inline annexures + Generate ATR / View report) · `AdminTab` (rendered by the Reports module). |
| `components/` | `MethodSelectionCard` · `ReportDetailsForm` · `EditableReportHeader` (Financial Year + Generated On are locked) · `ObservationExtractCard` · `MissingFieldResolver` · `LovManager` (Admin → *Fields & Lists of Values*: a master-detail surface — pick a field to toggle mandatory / optional, add custom Text / Dropdown / Date / Number fields, and manage each dropdown's options) · `EscalationMatrixEditor` · `TransactionLogs`. Action Taken and Evidence are **not** extracted. |

## Demo the happy path

1. Reports → **My Reports** → **Create Report** (opens the modal).
2. **Select tab** → pick **Use IRAME Template** (or **Upload Existing Report**) — this moves you to the **Upload tab**. Template path: **Download a template** → pick *Excel* or *Word* → upload the filled template (optionally add `.xlsx` annexures), fill the report details → **Extract from template**. Or **Upload Existing Report** → drop any PDF → **Extract from report**.
3. ~7s processing → the report is added to the **Observations Extracted** tab (a My-Reports-style grid with global filters: Section · Review type · Audit location · Financial year).
4. Click the report → **Report detail**: an editable cover-details header (edit anytime; Financial Year + Generated On are locked), then its observations. Expand the **Incomplete** card (#6) → **Fill manually** the title → badge flips to Complete.
5. Each observation carries its annexures inline — **Link annexure** opens the platform's Add-data picker (`chat/DataPickerModal`: upload files or a folder, or pick from All Data · Files · DB) and links every chosen item to that observation; annexures extracted with the report but not yet linked appear as dashed one-click chips. View / unlink from the chips.
6. **Generate ATR** → toast *“… has been generated and saved in Reports.”*, the modal closes and the saved report opens (edit inline, share, apply a template, download). It's listed in **My Reports** from now on; the extracted report's CTA reads **View report**.
7. **Admin** tab (Reports module) — **Fields & Lists of Values** (which report details are mandatory, custom fields, dropdown options — the Create Report form and the opened report's details header follow it immediately), the default Escalation Matrix applied to new extractions, and the Transaction Logs of every change made in Create Report.

## Report Snapshot (saved ATRs)

Every saved ATR carries an append-only timeline (`reports/atrTimeline.ts`, localStorage `irame.atr.timeline.v1.<reportId>`): the generated **baseline** plus **events** — edits saved in the reader (full snapshot), and case-management actions by the Auditor / Risk Owner (classified, plan submitted / accepted / rejected, action completed with evidence, verified Implemented / Partially, discrepancy, due-date requested / approved, closed), each with a data-level patch. The report "as of T" is the baseline with every event ≤ T replayed (`replay`), so the trail and the document always agree.

- **Reader:** **Report Snapshot** in the ATR command bar opens `AtrReportSnapshotPanel` — a scrubber over the events, a date-time picker, *At generation* / *Latest*, headline numbers for the moment, and the action trail (applied vs. "after this point"). The document becomes a read-only reconstruction with a banner; touched observations get a "N actions · time" marker.
- **Case management → ATR:** the per-observation hand-off also persists a link (`irame.atr.handoff-links.v1`: report + observation), and the ATR's *Case Management* button passes a report-level `atrLink`. `ManageExceptionsView` diffs each committed change to a case and writes the matching events to that report's timeline — from its own tab; the reader listens to `storage`. Observation-level links rewrite the observation (plans keyed by `caseId`); report-level links record the action without rewriting.
- **Seeding:** curated library ATRs get a believable remediation history (`seedDemoHistory`); ATRs the user generated start truthfully from their generated snapshot.

## Which seed shows which state (report detail)

| Observation | State | Demonstrates |
|---|---|---|
| #1 Vendor Master, #2 Three-Way Match, #5 Scrap Sale | Complete | normal extracted cards |
| #3 Freight Rate | Partial — Risk Summary missing | single missing-field resolve |
| #4 Stock Variance | Complete; annexure **unlinked** | annexure link state on a complete obs |
| #6 (untitled) | Incomplete — Title missing | the Incomplete badge + Fill/Skip flow |

Annexures: `vendor_master`, `three_way_match`, `scrap_sale` = **Confirmed**; `freight_rate` = **Needs Review**; `misc_gate_register` = **Orphan / Unlinked**.

## Edge-case triggers

| To see… | Do this |
|---|---|
| **Zero observations** empty state | upload a file whose name contains `empty` or `blank` |
| **Upload failure** + retry | upload a file whose name contains `fail`, `corrupt`, or `error` |
| **Orphan / unlinked annexure** | already seeded (`misc_gate_register.xlsx`) — link it to any observation from that observation's **Link annexure** picker |
| **Refresh-resume** | refresh mid-flow — extracted reports persist; the modal reopens on the Upload tab |

## Known prototype scoping

- PDF uses the platform's `window.print()` path (no `jsPDF`/`html2canvas` — honours the "no new libraries" constraint).
- The saved report's per-observation **Manage Exceptions** CTA (`components/ObservationExceptionsAction.tsx`) resolves the wizard session via the report id (`uploadedReport.ts`) — it disappears if that extracted report is deleted from Observations Extracted. Manage Exceptions itself still lists the canonical mock case set; only the context card is per-observation.
