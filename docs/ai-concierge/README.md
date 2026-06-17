# AI Concierge — port kit

Everything needed to rebuild the production **AI Concierge** (landing + 7 tools)
inside this prototype.

## Contents
- **[`PLAN.md`](./PLAN.md)** — the port plan: the shared "job engine", stack
  mapping (irame → this prototype), per-tool specs, routing wiring, phased
  delivery, effort, and open decisions. **Start here.**
- **[`source-reference/`](./source-reference)** — the production source copied
  verbatim (138 files, ~19k LOC) so you can check exact markup/logic. Lives
  outside `src/` on purpose — it is reference only, not compiled or shipped.

## Provenance
- Source: `tech-irame/irame-mvp` @ `main` (full clone, 1,009 commits), pulled
  2026-06-16 via the `product-irame` GitHub account.
- Stack there: React 18 + JavaScript + Redux + React Query + Axios, real
  `/<tool>/jobs` APIs. We are porting to: **React 19 + TypeScript + Tailwind 4 +
  mock job lifecycle** (this repo's conventions).

## The tools
RACM Generator · Insights & Anomaly (eda-builder) · Document Forensics · Image
Analytics · Speech Auditor · Medical Report Reader · Table Extractor (hidden in
prod — built but not on the landing grid).

> Note: `source-reference/` is JavaScript from the production app. Do not import
> it into `src/` — it's a reading aid. The port is described in `PLAN.md`.
