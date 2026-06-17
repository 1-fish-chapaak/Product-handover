# AI Concierge — Port Plan (Product-handover prototype)

> Goal: rebuild the irame-mvp **AI Concierge** (landing + 7 tools) inside this
> prototype, native to its stack — **React 19 + TypeScript + Tailwind 4**, reusing
> the existing shared components, with a **mock job lifecycle** (no backend), the
> way the rest of this prototype works.
>
> Source of truth: the production code is copied verbatim to
> [`./source-reference/`](./source-reference) (138 files, ~19k LOC) from
> `tech-irame/irame-mvp@main` (full clone, 2026-06-16). This plan condenses it
> into a buildable spec; open the reference when you need exact markup/logic.

---

## 1. What exists today vs. what we're adding

**Already in this repo:**
- `src/components/intelligence/AIConciergeView.tsx` — the **landing** (hero shell + `ToolCard` grid + search). Tiles currently fire "coming soon" toasts or stub views.
- View-state routing in `src/hooks/useAppState.ts` (`View` union + `setView`); render switch in `src/App.tsx`. Existing concierge views: `ai-concierge`, `ai-concierge-forensics`, `ai-concierge-table-extractor`, `ai-concierge-workflow-builder`.

**Not here yet (this is the work):** the actual **7 tool experiences** — Document Forensics, Image Analytics, Speech Auditor, Table Extractor, Medical Report Reader, Insights & Anomaly (eda-builder), RACM Generator. Today they're tiles with no destination.

---

## 2. The one idea you must port: the "job engine"

In irame every tool is the **same async machine**; only inputs/outputs differ:

```
upload files → create job → poll status (stages, %) → fetch result → view/export
                                                       └ + a History tab
```

In production that's `axios → POST /<tool>/jobs`, React-Query polling of
`GET /<tool>/jobs/{id}/status` (adaptive 2→5→10s), then
`GET /<tool>/jobs/{id}/result`. **In the prototype we replace all of that with one
mock hook** that walks the same states on timers and returns canned results. Build
this once; all 7 tools reuse it.

### `useConciergeJob` — the mock engine (build first)

```ts
// src/components/intelligence/concierge/useConciergeJob.ts
export type JobStatus = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
export interface Stage { id: string; label: string }      // e.g. startup → analyzing → complete
export interface JobState<R> {
  status: JobStatus;
  stageIndex: number;
  progress: number;          // 0..100
  message: string;           // current status line (feeds the activity log)
  activity: string[];        // appended on each distinct message
  result?: R;
  error?: string;
  startedAt?: number;
}
export function useConciergeJob<I, R>(cfg: {
  stages: Stage[];
  buildResult: (input: I) => R | Promise<R>;
  totalMs?: number;          // default ~6–10s; spread across stages
  uploadMs?: number;         // brief UPLOADING phase
}): {
  state: JobState<R>;
  start: (input: I) => void; // UPLOADING → PROCESSING (ticking) → COMPLETED
  cancel: () => void;        // → IDLE (mirrors "delete job")
  reset: () => void;         // "New analysis"
};
```

Implementation notes:
- One `setInterval` tick (~250ms) advances `progress`; cross stage thresholds to bump `stageIndex` + push a new `message` into `activity` (dedupe consecutive).
- Clear the interval on `COMPLETED`/`cancel`/unmount. No real polling, no network.
- Keep an in-module **mock job list** (seeded) so the **History** tab looks populated; `start()` prepends a row, `COMPLETED` flips its status.
- Prototype caveat (see memory `prototype-file-data-mock`): uploaded files carry **no real bytes** — `start(input)` only needs file *names/metadata*; `buildResult` returns fixtures, optionally keyed off filename for flavor.

---

## 3. Stack mapping (irame → this prototype)

| Concern | irame-mvp | Port to |
|---|---|---|
| Language | JavaScript (`.jsx`, prop-types) | **TypeScript** (`.tsx`) |
| Styling | Tailwind 3 + shadcn/Radix | **Tailwind 4** + existing shared components + tokens (`ink/paper/brand/canvas`, `risk/mitigated/compliant/evidence`) |
| Icons | `react-icons/tb` + lucide | **`lucide-react`** (already standard here) |
| Routing | react-router v6 `/app/ai-concierge/<tool>` | **`useAppState` `View` enum + `setView`** |
| Page shell | bespoke gradient card | **reuse the Knowledge-Hub recipe** already in `AIConciergeView` (two-zone shell, `px-6 lg:px-12 xl:px-[124px]` gutters, `FloatingLines` band, serif `font-display` H1) |
| Tabs | Radix `Tabs` | existing motion-underline tab pattern, or a small local toggle |
| State/data | Redux (none for concierge) + React Query | **React state + `useConciergeJob`** |
| Backend | `axios` `/<tool>/jobs` + presigned S3 upload | **mock engine + fixtures** (no axios) |
| Polling | React-Query adaptive 2–10s | `setInterval` tick inside the hook |
| Upload | `react-dropzone` + presigned URL | `react-dropzone` (or a styled `<input>`) → file metadata only |
| Tables | `@tanstack/react-table` | the prototype's existing table pattern (or `@tanstack` if already a dep) |
| Charts | recharts / echarts | recharts or the prototype's chart approach |
| Toasts | react-toastify | **`useToast()` → `addToast({type,message})`** |
| Exports | xlsx / jspdf / docx + server PDFs | client Blob download (CSV/JSON now; XLSX/PDF/DOCX optional — see §7 decisions) |

**Drop entirely when porting:** `lib/axios.js`, `utils/multipart-upload.js`, `features/upload/service.jsx`, every `service/*.service.js`, every `hooks/use*JobPolling.js`, `ProtectedRoute`/RBAC plumbing. Their behavior collapses into `useConciergeJob`.

---

## 4. Shared building blocks (build once, in `concierge/shared/`)

| Component | Role | Port from (reference) |
|---|---|---|
| `ToolShell` | per-tool page: reuses the landing's two-zone shell + `FloatingLines`, adds a **"← Back to AI Concierge"** (`setView('ai-concierge')`) + optional tab bar | each tool's `page.jsx` |
| `UploadZone` | dropzone + file chips (remove / clear all) + accept/size config; emits file metadata | `*/components/**/UploadSection.jsx` |
| `ProgressPanel` | `PhaseStepIndicator` + `TypewriterText` status + gradient % bar + elapsed timer + **Cancel** + **Activity Log**, with an `InsightPanel` below | `*/components/**/ProgressSection.jsx`, `PhaseStepIndicator.jsx`, `GradientBorderLoader.jsx`, `elements/TypewriterText.jsx`, `elements/AnalysisInsightPanel.jsx` |
| `InsightPanel` | "What we're checking" + rotating tips; per-tool preset | `elements/AnalysisInsightPanel.jsx` (has a preset per tool — copy the strings) |
| `JobHistory` | table of seeded mock jobs; row → open (`?jobId`-equivalent → local state), delete (confirm), status badge | `*/components/history/*` |
| `ResultShell` | result header + **New Analysis** + export buttons slot | each `ResultsSection.jsx` |

`AnalysisInsightPanel.jsx` holds the per-tool "checking…" copy (presets for racm-generator, eda-builder, document-forensics, image-analytics, speech-auditor, medical-reader, table-extractor) — lift those strings verbatim; they're good UX copy.

---

## 5. Per-tool spec (condensed from the full code trace)

Each tool = `ToolShell` + states `IDLE/UPLOADING/PROCESSING/COMPLETED/ERROR` via `useConciergeJob`, a History tab, and a results view. Below: only what differs. Inputs/limits are from each tool's `constants/*.js`; result shapes from each `ResultsSection`/report components.

### 5.1 Document Forensics — `view: 'ai-concierge-forensics'` (already a tile)
- **In:** 1 file (JPEG/PNG/PDF/TIFF/BMP/WebP), ≤50 MB.
- **Stages:** startup → download → analyzing → ai-review → complete.
- **Result:**
  ```ts
  interface ForensicResult {
    composite_score: number; risk_level: 'GENUINE'|'LOW_RISK'|'MEDIUM_RISK'|'HIGH_RISK'|'FORGED';
    recommended_action: 'ACCEPT'|'ACCEPT_WITH_NOTE'|'REVIEW'|'ESCALATE'|'REJECT';
    document_type_detected: string; confidence: number; primaryReason?: string;
    modules: Record<string, { score: number|null; flags: string[]; details?: string }>;
    evidence_chain: { severity: string; module: string; finding: string }[];
    suspiciousRegions?: { x:number;y:number;width:number;height:number;label:string }[]; // %
  }
  ```
- **Unique UI:** score **donut** (recharts), risk badge, module cards split *Content* vs *Forensic*, evidence-chain table (collapsible), and a **document viewer** with hover-synced suspicious-region overlays. No export (only original-file download). **Effort: L.**

### 5.2 Image Analytics — `view: 'ai-concierge-image'` (new; tile exists as "coming soon")
- **3 sub-tabs**, each its own job: **Chat** (≤500 imgs + question → markdown answer), **Compare** (2–50 imgs → markdown diff), **Audit** (guidelines PDFs ≤5 + images → KPI report).
- **Audit result:** `summary` + `kpis: { kpiNumber; kpiDescription; status:'Compliant'|'Non-Compliant'; evidenceImages[]; reasoning; recommendation }[]` + PDF/Excel download.
- **Unique UI:** 4-tab workspace; markdown rendering; KPI cards w/ status pills. **Effort: L.**

### 5.3 Speech Auditor — `view: 'ai-concierge-speech'` (new)
- **In:** audio/video (MP3/WAV/M4A/OGG/FLAC/AAC/MP4/WebM), ≤300 MB + instructions. (Upload is click-only in irame — add real DnD here.)
- **Result:** `{ report: {executive_summary, controls_summary[], detailed_findings[], priority_action_plan[], conclusion}, transcript: {overall_sentiment, segments:{timestamp,speaker,text,sentiment_label,sentiment_score}[]} }`.
- **Unique UI:** 3 result views — **Audit Report / Transcript / Sentiment** (recharts line, −1..1). Exports PDF/DOCX/TXT. **Effort: M.**

### 5.4 Table Extractor — `view: 'ai-concierge-table-extractor'` (tile exists)
- **In:** PDF only, ≤100 MB, multiple files.
- **Pre-step:** a **Schema Builder** (header/table fields: name/type/description) with **CSV import/export of the schema** and **localStorage layout profiles** (`TE_IRAME_TEMPLATES`). Flow: `SCHEMA → UPLOAD → … → COMPLETED`.
- **Result:** `{ extracted_rows: Record<string,any>[] (+ _file,_page); summary:{total_rows,total_pages,files_processed}; validation_flags:{row_index,reason}[] }`.
- **Outputs:** results table + **CSV export**. **Effort: M** (schema builder is the bulk).

### 5.5 Medical Report Reader — `view: 'ai-concierge-medical'` (new)
- **In:** PDF/JPEG/PNG/WebP/HEIC, ≤50 MB; **folder upload** supported (recursive) — nice-to-have here.
- **Result:** `{ summary:{overall_risk_level, executive_summary, total_files_analyzed}; analysis:{ reports[], crossReportAnalysis }; evidenceUrls[] }`; per-report forensic/temporal/medical-consistency + test tables; cross-report fabrication card.
- **Outputs:** CSV evidence download. (`RedFlagSummary`/`ComparisonMatrix` in source are **dead code** — skip or revive.) **Effort: M.**

### 5.6 Insights & Anomaly (eda-builder) — `view: 'ai-concierge-insights'` (tile = "insights-anomaly")
- **In:** CSV/XLS/XLSX, ≤100 MB (1+ files).
- **irame renders 3 server HTML reports in iframes** — **don't port the iframe**; in the prototype build **mock report components** (Data Understanding / Anomaly Detection / Heuristic) with cards + recharts.
- **Result:** `{ summary:{total_rows,total_columns,files_analyzed,llm_costs}; reports: { understanding, anomaly, heuristic } }` (each = structured mock data you render, not HTML).
- **Outputs:** "Download report" (mock or print). **Effort: L** (you're authoring the report UI from scratch).

### 5.7 RACM Generator — `view: 'ai-concierge-racm'` (optional; was deferred — "leave racm for now")
- **In:** 1 SOP (PDF/CSV/image), ≤100 MB + instructions.
- **Result:** entries of a **26-field RACM schema** (`utils/racm-field-definitions.js`) + markdown SOP summary + summary dashboard.
- **Unique UI:** **inline-editable matrix** (double-click cell → save buffer → "Save"/"Discard"), detail modal, summary dashboard (recharts bar), **CSV/JSON/XLSX export** (XLSX = 2 sheets). **Effort: L** (editable matrix + exports). **Recommend deferring** unless you want it now; source is in the reference.

---

## 6. Wiring into the prototype (routing)

1. **`useAppState.ts`** — extend the `View` union: add `'ai-concierge-image' | 'ai-concierge-speech' | 'ai-concierge-medical' | 'ai-concierge-insights'` (and `'ai-concierge-racm'` if building it). Forensics + table-extractor already exist.
2. **`AIConciergeView.tsx`** — each tile's `view` already drives `setView`; point the four "coming soon" tiles at their new views (drop the `comingSoon` flag).
3. **`App.tsx`** `renderView()` — add a `case` per view returning the tool component, e.g.
   ```tsx
   case 'ai-concierge-image':   return <ImageAnalyticsView setView={setView} />;
   case 'ai-concierge-speech':  return <SpeechAuditorView setView={setView} />;
   // …forensics/table currently render <AIConciergeView/>; swap to the real tool components.
   ```
4. Each tool's "← Back" → `setView('ai-concierge')`.

---

## 7. Decisions to make as you build (recommended defaults)

| Decision | Options | Recommended |
|---|---|---|
| Exports | real libs (xlsx/jspdf/docx) vs. mock download | **CSV/JSON real** (simple Blob); stub/skip XLSX·PDF·DOCX until needed |
| History data | in-memory (resets) vs. seeded mock list | **seeded mock list** (looks populated, matches other prototype surfaces) |
| Routing | per-tool `View` enums vs. internal `activeTool` state | **per-tool `View` enums** (matches existing pattern) |
| EDA reports | port iframes vs. author mock report UI | **author mock report UI** (no backend HTML to embed) |
| RACM Generator | build now vs. defer | **defer** (you said "leave racm for now") — keep source handy |
| Beta badges + insight copy | keep vs. drop | **keep** (good UX, low cost) |
| `react-dropzone` | add dep vs. styled `<input>` | **whichever the repo already leans on**; `<input>` is fine for a mock |

---

## 8. Suggested file layout (this repo)

```
src/components/intelligence/concierge/
  types.ts                  # JobStatus, Stage, JobState<R>, per-tool result interfaces
  useConciergeJob.ts        # the mock engine (§2)
  shared/
    ToolShell.tsx  UploadZone.tsx  ProgressPanel.tsx  InsightPanel.tsx
    PhaseStepIndicator.tsx  TypewriterText.tsx  JobHistory.tsx  ResultShell.tsx
  mock/
    forensics.ts  imageAnalytics.ts  speech.ts  tableExtractor.ts
    medical.ts  insights.ts  racm.ts        # fixtures + history seeds + insight presets
  tools/
    DocumentForensicsView.tsx  ImageAnalyticsView.tsx  SpeechAuditorView.tsx
    TableExtractorView.tsx  MedicalReportReaderView.tsx  InsightsAnomalyView.tsx
    RacmGeneratorView.tsx    # optional
```
(`AIConciergeView.tsx` stays the landing.)

---

## 9. Phased delivery

- **Phase 0 — Foundation:** `types.ts`, `useConciergeJob`, `shared/*` (ToolShell, UploadZone, ProgressPanel, InsightPanel, JobHistory, ResultShell). Ship **Document Forensics** end-to-end as the reference tool. *Acceptance: tile → upload → animated processing → mock result → history row.*
- **Phase 1 — Landing wiring:** add `View` enums + `App.tsx` cases; un-stub the four "coming soon" tiles.
- **Phase 2 — Tools:** Image Analytics, Speech Auditor, Table Extractor.
- **Phase 3 — Tools:** Medical Report Reader, Insights & Anomaly (+ RACM if in scope).
- **Phase 4 — Polish:** exports, history seeding, empty/error/loading states, a11y, motion, mobile.

**Rough effort:** Foundation ≈ 1–1.5d; each M tool ≈ 0.5–1d; each L tool ≈ 1–2d. Full 6-tool set (no RACM) ≈ 1.5–2 wks; +RACM ≈ +2–3d.

---

## 10. Risks / watch-outs
- **Scope** — 7 distinct result UIs is the real cost; the engine is small. Sequence by value.
- **Charts/tables** — confirm the prototype's chart + table libs before Phase 2 (recharts? `@tanstack/react-table`?).
- **RACM editable matrix** and **EDA report UI** are the two heaviest custom surfaces.
- **Mock fidelity** — fixtures should look plausible (real-ish scores, findings) so the demo lands; lift example values from the reference components.
- **Don't re-introduce backend coupling** — keep everything behind `useConciergeJob` so a later swap to real `/<tool>/jobs` APIs is a one-file change.

---

## 11. Source reference index (`./source-reference/`)
Verbatim irame-mvp code for exact markup/logic:
- `src/components/features/ai-concierge/` — landing (page, tile, header, `AI_FEATURES` registry).
- `src/components/features/{document-forensics,image-analytics,speech-auditor,table-extractor,medical-report-reader,eda-builder,racm-generator}/` — each tool: `page.jsx`, `components/**`, `constants/*`, `service/*`, `hooks/*` (services/hooks are what we replace with the mock engine).
- `src/components/elements/` — `AnalysisInsightPanel` (per-tool copy), `GradientBorderLoader`, `TypewriterText`, `GradientHeading`, `Tag`, `CommandPalette`, `loading/Spinner`.
- `src/components/features/shared/useAdaptivePolling.js`, `src/components/features/upload/`, `src/lib/{axios,logger}.js`, `src/utils/{file,multipart-upload}.js`, `src/routes/{index,ProtectedRoute}.jsx`, `src/components/ui/{tabs,dialog,badge,card,input}.jsx` — production plumbing, for reference only (not ported).
