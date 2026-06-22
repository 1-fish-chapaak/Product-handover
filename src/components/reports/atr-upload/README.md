# Generate ATR by Upload — module guide

A working prototype of the **external report → Action Taken Report** flow. It
adds a **"Generate by Upload"** tab to the Reports module (after *Templates*) and
walks the user from uploading an audit report through to a finalised ATR.

> Everything is mocked — there is no real document parsing and no backend. AI
> extraction is simulated with realistic delays and pre-seeded data; all state
> persists to `localStorage`.

## Where it lives / how it hooks in

- **Tab:** `ReportsView.tsx` renders `<AtrUploadTab>` for `activeTab === 'generate-by-upload'`. That is the *only* edit to an existing file (plus the additive, backward-compatible `editable` / section props on `AtrDocument.tsx`).
- **Renderer reuse:** Screen 7 renders the existing `AtrDocument` (the same component used for saved ATRs), so the brand format matches exactly.
- **Data reuse:** mock observations + insights come from `atrTemplate.ts` (`SAMPLE_OBSERVATIONS` / `SAMPLE_INSIGHTS`); template downloads reuse `downloadExcelTemplate` / `downloadWordTemplate`.
- **Manage Exceptions hand-off:** `handoff.ts` injects the confirmed annexure rows as a synthetic query table and routes through the platform's existing `?from=<id>` derive path in `ManageExceptionsView` — no changes to that view or `App.tsx`.
- **Audit log:** key actions emit `useAuditLog().logEvent(...)` (visible in Admin → Audit Logs): upload/extract, hand-off, finalize.

## Files

| File | Role |
|------|------|
| `AtrUploadTab.tsx` | Tab root — provider, stepper, screen router, edge-case triggers, hand-off, Start-Over guard. |
| `AtrUploadContext.tsx` | `useAtrUpload()` store; `localStorage` key `irame.atr-upload.v1`; persists on every action + 30s heartbeat; resume detection. |
| `types.ts` | Data model (`ExtractionSession`, `ExtractedObservation`, `ExtractedAnnexure`, `MissingField`, `AtrVersion`, …). |
| `mockExtraction.ts` | The 5 + 1 seeded observations, 5 annexures, processing messages; `seedSession` / `seedEmptySession`. |
| `observationFields.ts` | The 10-field get/set layer + completeness recompute. |
| `toAtrReportData.ts` | Maps a session → `AtrReportData` for `AtrDocument` (selected only, skipped fields cleared). |
| `handoff.ts` | "Manage Exceptions First" hand-off via the existing query-table derive path. |
| `screens/` | `Step1MethodSelect` · `Step2aTemplateDownload` · `Step2bReportUpload` · `Step3Processing` · `Step4ExtractionSummary` · `Step5AnnexureMapping` · `Step6DecisionPoint` · `Step7AtrPreview`. |
| `components/` | `FileDropZone` · `MethodSelectionCard` · `ObservationExtractCard` · `MissingFieldResolver` · `AnnexureMappingRow` · `ExtractionRightRail`. |

## Demo the happy path

1. Reports → **Generate by Upload** (`?view=reports&tab=generate-by-upload`).
2. **Upload Existing Report** → drop any PDF (optionally add `.xlsx` annexures) → **Extract from report**.
3. ~7s processing → **Screen 4**: 6 observations, 3 flagged with missing fields.
4. Expand the **Incomplete** card (#6) → **Fill manually** the title, **Skip from ATR** the action-taken → badge flips to Complete. Continue enables once every *selected* observation is resolved.
5. **Continue to Annexure Mapping** → resolve the *Needs Review* annexure (Confirm / Edit / Unlink) or **Confirm all suggested** → **Confirm mapping & continue**.
6. Decision → **Generate ATR Only** → the branded ATR. Toggle **Edit** to change text inline; **Sections** to reorder/skip; **Save Version** (v1.1); **Finalize & Sign-off** (v2.0 + lock); **Preview & Download** (print → Save as PDF).
7. Or Decision → **Manage Exceptions First** → lands in case management with the annexure rows as cases.

## Which seed shows which state (Screen 4)

| Observation | State | Demonstrates |
|---|---|---|
| #1 Vendor Master, #2 Three-Way Match, #5 Scrap Sale | Complete | normal extracted cards |
| #3 Freight Rate | Partial — Risk Summary missing | single missing-field resolve |
| #4 Stock Variance | Partial — Evidence missing; annexure **unlinked** | mixed annexure state |
| #6 (untitled) | Incomplete — Title + Action Taken missing | the Incomplete badge + Fill/Skip flow |

Annexures: `vendor_master`, `three_way_match`, `scrap_sale` = **Confirmed**; `freight_rate` = **Needs Review**; `misc_gate_register` = **Orphan / Unlinked**.

## Edge-case triggers

| To see… | Do this |
|---|---|
| **Zero observations** empty state | upload a file whose name contains `empty` or `blank` |
| **Upload failure** + retry | upload a file whose name contains `fail`, `corrupt`, or `error` |
| **Orphan annexure** | already seeded (`misc_gate_register.xlsx`) |
| **Needs-review block** on Screen 5 | already seeded (`freight_rate_exceptions.xlsx`) — Continue is disabled until resolved |
| **Manage Exceptions disabled** on the decision screen | use **Skip annexures & proceed** on Screen 5 |
| **Refresh-resume** | refresh mid-flow — the draft restores at the last stage with a banner |
| **Start-Over guard** | the resume banner's *Start over* asks for confirmation |
| **Finalize RBAC** | sign in as **Risk Owner** (no `rp_edit`) — Finalize is disabled with a note |

## Known prototype scoping

- PDF uses the platform's `window.print()` path (no `jsPDF`/`html2canvas` — honours the "no new libraries" constraint).
- Section reorder is via the **Sections** popover (up/down + show-hide) rather than in-document drag handles.
- The hand-off injects an in-memory query table; on a hard refresh of the Manage Exceptions deep-link the synthetic table is not re-seeded (the rest of the flow resumes from `localStorage`).
