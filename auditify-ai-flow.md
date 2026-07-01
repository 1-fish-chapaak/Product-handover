# Irame · AI Intelligence Map

> **Every AI Touchpoint Across the Platform** — from raw file upload to institutional memory: a complete map of where, how, and why AI is invoked across Irame's full pipeline.
>
> _Faithful transcription of the source deck `auditify_ai_flow.pdf` (the engine spec referenced by [PRD-AI-MEMORY.md](PRD-AI-MEMORY.md)). Kept here as markdown so it's diffable and searchable alongside the PRDs._

## Legend — three kinds of touchpoint

- **AI · Reasoning & Generation** — the model reasons or generates (brand/purple).
- **TRACEABLE · Code-Gen Output** — deterministic, traceable output (pink/red).
- **HUMAN GATE · Approval Required** — an explicit human approval step (amber).

## At a glance

| Figure | Meaning |
|---|---|
| **4** | AI tiers, cost-calibrated per task |
| **18+** | Distinct AI invocation points |
| **3** | Pipeline phases: Ingest → Execute → Learn |
| **0** | Raw data bytes leaving the CAN perimeter |
| **80%** | Recurring audits bypass the LLM via golden records |

---

## PHASE 1 — Ingestion & Structuring

### Stage 01 · Upload & Ingestion
_File enters CAN. Structure detected. AI fires only when heuristics fail._

- **Tabular Structure Detection** — Fires when heuristic confidence `<0.85`. Reads top 50 rows + merged ranges. Outputs: `header_rows`, `data_starts_at`, `row_group_size`, `renames`. — `Excel / CSV` · `Heuristic-first` · `Fallback only`
- **PDF Page Scan** — Each PDF page rendered at 144 DPI, fed to a multimodal extractor. Outputs a block inventory: tables vs narrative vs forms per page. — `144 DPI` · `Multimodal, not OCR heuristic` · `Block inventory`
- **PDF Backend Router** — Routes each page to the right extractor: fitz / multimodal / textract / none. Cheap decision that prevents over-spending on every page. — `fitz` · `Textract (ML, non-LLM)` · `Cost-aware routing`
- **SQL Table Indexing** — One-liner summary + tags per table across the connected SQL source. Seeds downstream Stage A selection without loading the full schema. — `One-liner per table` · `Tags` · `Index, not full schema`
- **Auto-Mapping (Workflow Re-runs)** — When cheap-signal scoring is ambiguous, suggests which new upload refills which workflow slot. Enables one-click re-run on new data. — `Re-run continuity` · `Slot matching`

> **What's unique:** AI is the last resort, not the first. Every ingestion call is preceded by traceable heuristics. The LLM fires only when confidence is insufficient — minimising cost while preserving quality on complex or malformed files.

---

## PHASE 2 — Intent, Planning & Clarification

### Stage 02 · Stage A — Large Source Filter
_Only for SQL ≥50 tables, Excel ≥10 sheets, PDF ≥10 pages._

- **Relevance Pre-Filter** — User question + compact index → relevant `block_ids` only. Keeps the main planning prompt small and cheap. Only fires for large sources. — `Conditional activation` · `Keeps prompt lean`

### Stage 03 · Plan Generation
_Natural-language execution plan. Validated by a contract parser before proceeding._

- **Planner Agent** — Full context: question, source descriptions, samples, dialect packs (Databricks / Athena / SQL). Outputs a plan + optional clarification questions. Contract validated by `plan_parser`. — `Dialect-aware` · `Contract validation` · `Deep reasoning`
- **Workflow Template Hints** — At plan time, suggests relevant workflow templates from the library. Shortcut for users running common audit patterns. — `Template library` · `Pre-built patterns`
- **Workflow Name Suggestion** — At workflow-freeze time, generates a human-readable name from the plan. Routed to the cheapest path — naming is low-stakes, high-frequency. — `Freeze-time` · `Cheap path for naming`

### Stage 04 · Clarification Engine
_Consequence-scored gates. Two paths: user-answered or auto-resolved._

- **User-Answered Clarifications** — High-consequence ambiguities (score 3–5) stop the pipeline. The agent generates a targeted question with 2–4 smart options. Max 2 gates per query. — `Consequence-scored` · `Max 2 gates` · `Never open text`
- **Auto-Answerer** — Query mode & `/clarifications/skip` path. Conservative-bias defaults. Returns padded answers even on parse failure — the plan never stalls. — `Conservative defaults` · `Never stalls pipeline` · `Fail-safe padded output`

> **What's unique:** The consequence-based model means AI asks _only when it matters_. Score 1–2 = proceed silently. Score 3–5 = hard gate. Two paths (user / auto) ensure the pipeline never deadlocks regardless of query mode.

---

## PHASE 3 — Code Generation & Execution

### Stage 05 · Code Generation
_Two-step: cheap relevance filter, then full reasoning code-gen with one auto-retry._

- **Column Relevance Pre-filter** — Before the big prompt: (1) per-source yes/no/maybe relevance, (2) per-column filter when >20 columns match. Keeps code-gen context lean. — `2 fast calls` · `Prompt compression` · `Per-column filter`
- **Main Code Generation (Sync + Stream)** — Full Python / SQL generation, streamed live to the Brain Canvas Code Panel. Code extracted by the sandbox execution engine. — `Python / SQL` · `Streamed to Canvas` · `sandbox extract`
- **Single Auto-Retry on Error** — On execution failure: error + failing code + column hints fed back to the reasoning agent. One shot only. A second failure surfaces to the user — no silent loops. — `Exactly 1 retry` · `Error + code + hints` · `No infinite loops`

### Stage 06 · Runtime AI (Inside Execution)
_Generated code itself calls LLMs for PDF extraction. Runs inside CAN — data never exits._

- **PDF Doc-Level Extraction (≤40 pages)** — Single call, 180s timeout. Full-document context. Uses a structured prompt (`pdf_doc_level_v1`). Best accuracy for short documents. — `180s timeout` · `Single-shot, full context`
- **PDF Chunked Extraction (>40 pages)** — 10-page / 16K-char chunks, 6 parallel workers. A chunk stitcher (`pdf_compiler`) reconciles records across chunk boundaries with a final reasoning call. — `6 workers` · `Boundary reconciliation` · `16K chunks`
- **Folder Workflows (Many PDFs)** — Per-PDF extraction across a folder. Routed to the cheapest path: 8K chunks, 6 workers, 90s timeout. Empty-records fallback — never crashes the batch. — `Cheap path for batch` · `Empty fallback`

> **What's unique:** AI calls at runtime _inside generated code_ — the generated code itself is AI-powered code that invokes AI for document work. Two levels of AI nesting, both inside the CAN perimeter. Zero raw data exits.

### Stage 07 · Follow-up Q&A
_Same model path as code-gen. Chat history is the context. No re-execution of the base query._

- **Conversational Follow-up** — User asks a follow-up on already-loaded result context. Same reasoning chat path — chat history provides session context. Incremental execution only. — `No base re-execution` · `Stateful via chat history` · `Incremental CAN call`

---

## PHASE 4 — Insight Memory Engine · Learning Across Runs

**Post-execution intelligence layer.** Activates after every workflow run. Correlates signals across runs, workflows, entities, and time — detecting patterns no single run can reveal. **Traceable detection first; the LLM is used only for the human-readable explanation at the end.**

| # | Stage | Method | What it does |
|---|---|---|---|
| 01 | **Run Log Ingestion** | `TRACEABLE` | Reads all signal sources from MAR: run metadata, KPI values per step, validation results, agent timing, schema-adaptation events, user-override decisions, distribution-delivery logs, follow-up query patterns. |
| 02 | **Signal Normaliser** | `TRACEABLE` | Per-run KPI extraction, anomaly-flag parsing. Standardises signal shape across different workflow types before correlation. |
| 03 | **Entity Resolver** | `TRACEABLE` | Cross-workflow entity disambiguation: vendor IDs, GL codes, workflow IDs. Ensures "Apex Supplies" in AP Ageing maps to the same entity in PO Leakage. |
| 04 | **Pattern Detector (10 types)** | `TRACEABLE` | Traceable rules + sliding window + threshold crossings. Detects recurring anomalies, KPI trend drift, schema decay, user-override patterns, cohort anomalies, cross-workflow correlations, emerging trends, memory conflicts, workflow efficiency gaps, distribution-engagement gaps. |
| 05 | **Correlation Engine** | `TRACEABLE` | Cross-workflow, cross-entity, cross-time joins. Configurable n-run sliding window. Identifies signals that span months and multiple workflows — invisible to any single-run view. |
| 06 | **Confidence Scorer** | `FORMULA` | `frequency × source diversity × recency × business impact`. Each insight gets a scored confidence value (0–1). A threshold determines memory candidacy. |
| 07 | **LLM Explanation Layer** ← _the only LLM call in the engine_ | `LLM` | Takes the fully structured evidence bundle (`runs_analysed`, `time_window`, `kpi_values`, entity list) and generates a human-readable description + recommended action. The LLM receives evidence; it cannot hallucinate data it wasn't given. |
| 08 | **Memory Candidate Generator** | `TRACEABLE` | Structures the insight object: `insight_id`, `workflow`, `insight_type`, `title`, `description`, evidence bundle, `confidence`, `severity`, `recommended_action`, `memory_candidate`, `approval_status`. |
| 09 | **Human Approval Gate** | `HUMAN GATE` | Analyst approves / rejects / adjusts scope / sets expiry on each candidate. Immutable audit trail for all decisions. Nothing reaches Enterprise Context without explicit human approval. |

### The 10 pattern types detected

| Severity | Pattern | Seeded example |
|---|---|---|
| **High** | Recurring Output Anomaly | Same vendor flagged across 4 AP Ageing runs |
| **High** | KPI Trend Drift | 90+ day bucket +9–12% across 4 consecutive months |
| **High** | Cohort Anomaly | Vendor consistently deviates from peer baseline |
| **High** | Cross-Workflow Correlation | Vendor in duplicate check also in PO leakage |
| **High** | Memory Conflict | New run contradicts promoted Enterprise Context |
| **Med** | Schema Decay Pattern | Structural mismatches increasing — ERP change signal |
| **Med** | User Override Pattern | Analyst dismisses the same warning 5 times — stale rule |
| **Med** | Emerging Trend | Metric stable 6 months, 2σ move in last 2 runs |
| **Low** | Workflow Efficiency Gap | Workflow consistently triggers manual follow-ups |
| **Low** | Distribution Engagement Gap | Recipients never follow up — distribution value? |

### → Promoted to Enterprise General Context

Approved insights become **governed institutional memory** — shared across all users in the tenant. The Intent Agent, Data Scout, and Output Formatter all read from this context. Every subsequent workflow run benefits from what prior runs learned. **Irame gets smarter with every execution cycle.**

> **The key architectural principle:** The LLM does what it does best — _generates code_. The generated code then runs deterministically, so every insight is fully traceable back to its raw evidence without reading model output. Two benefits in one call: **LLM-grade reach on the way in, audit-grade traceable deterministic intelligence on the way out.**

---

## What makes Irame's AI architecture unique

- **Heuristic-first, AI-last** — Every stage tries traceable logic before invoking an LLM. AI fires only when heuristic confidence falls below threshold — dramatically cutting cost without sacrificing quality.
- **AI calling AI (inside CAN)** — Generated code itself invokes LLMs for document extraction: two nesting levels of AI, all inside the customer's network perimeter. Zero raw data exits.
- **Four-tier cost-calibrated routing** — Reasoning, multimodal, filtering, and naming each get their own tier. Cost is matched to cognitive load — naming a workflow costs 100× less than planning it.
- **Consequence-based clarification** — Clarification gates are scored 1–5. Low-consequence ambiguity = proceed silently. High-consequence = hard gate. AI never asks a question that doesn't need asking.
- **Platform that learns across runs** — The Insight Memory Engine detects patterns invisible to any single run. One run shows an anomaly; six runs show a systemic risk. The enterprise now knows it.
- **Traceable deterministic intelligence** — The LLM's job is code generation — that's what LLMs do best. The generated code then runs deterministically, so every output is reproducible from its inputs. LLM-grade reach on the way in, fully traceable evidence on the way out — defensible in any regulatory context.
