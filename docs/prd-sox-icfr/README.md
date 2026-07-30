# PRD — SOX / ICFR Engagement Management (v1.1)

The editable source of the PRD. The published copies are generated from here.

- **Live artifact:** https://claude.ai/code/artifact/7581a2db-881b-4b9c-88d5-bab402961fcc
- **PDF:** `~/Downloads/PRD-SOX-ICFR-Engagement-Management-v1.1.pdf`
- **Basis:** `~/Downloads/SOX-ICFR-BRD.pdf` (v1.0). Everything the prototype adds beyond the
  BRD is highlighted in amber `.callout.delta` blocks — keep that convention when editing.

## Files

| File | What it is |
|---|---|
| `body.html` | **Edit this.** The whole document's content — sections, tables, callouts. Plain HTML. |
| `style.html` | The shared stylesheet (`<style>` block). Rarely needs touching. |
| `shots/*.jpg` | Screenshots embedded into the doc. Replace a file (same name) to swap a screen. |
| `build.mjs` | Assembles everything into one self-contained file. |
| `dist/` | Build output (git-ignored — regenerate any time). |

## The edit loop

1. Edit `body.html` (or drop a replacement screenshot into `shots/`).
2. Build:
   ```bash
   node docs/prd-sox-icfr/build.mjs          # → dist/prd-sox-icfr.html
   node docs/prd-sox-icfr/build.mjs --pdf    # …and refresh the PDF in ~/Downloads
   ```
3. Ask Claude to **republish `dist/prd-sox-icfr.html` to the artifact URL** (same URL every
   time — the link never changes, versions accumulate).

## Notes

- Images are referenced in `body.html` as `@@IMG:name@@` → `shots/name.jpg`.
- The journey flowcharts are HTML inside hidden `<template class="fc-source">` blocks in
  `body.html`; the build re-captures them to `shots/fc-*.jpg` automatically — edit the
  template, rebuild, done.
- Screenshots were captured from the running prototype (dev server) at 1440×900 @1.5×,
  JPEG q82 — match that if you re-capture by hand.
