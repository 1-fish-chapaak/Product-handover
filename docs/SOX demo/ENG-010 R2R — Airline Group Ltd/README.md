# ENG-010 — R2R / Airline Group Ltd · TOD evidence

Documents for the **Test of Design annotation** check. Everything here is for
ENG-010 (`R2R — SOX / ICFR`), which is a different engagement from the Altura
P2P pack in the folder above.

## Why this folder exists

ENG-010's five controls used to arrive with no design elements, no attributes
and no design checks — a Test of Design step with nothing in it to test. They
now arrive with the same register every other SOX engagement gets, untested:

| | |
|---|---|
| Controls | 5 (`R-01` … `R-05`) |
| Design checks per control | 4 |
| Design elements per control | 3 — Process narrative, Flowchart, Walkthrough |
| Everything's state on arrival | Not tested |

The **Walkthrough** is the one required element left outstanding, so it is the
file the auditor uploads. That is deliberate: the annotation is drawn on the
document *you* upload, so the demo has to have an upload in it.

## The five controls

| | Control | Nature | Sub-process |
|---|---|---|---|
| R-01 | Balance-sheet reconciliations reviewed monthly | Manual | Journals |
| R-02 | Manual journals approved before posting | Automated | Reconciliations |
| R-03 | Intercompany balances agreed and eliminated | Manual | Close |
| R-04 | FX revaluation reviewed at month-end | Manual | Consolidation |
| R-05 | Close checklist completed and signed | Manual | Journals |

Each control's folder holds a **walkthrough** and a **process narrative**. Both
carry the same four observations, so either one annotates — the walkthrough is
the one the control actually asks for.

## To see the annotation

1. Open **ENG-010 → FY 2025-26 Year-end → any control → Test of Design**.
2. Upload that control's `R-0n_walkthrough.pdf` against the **Walkthrough**
   element. (Reload the app first if the engagement was open before this
   change — the register is seeded at load.)
3. Run the design checks — **Ask IRA**, or validate a single check by hand.
4. Open **View result** on any answered check.

The document renders on the right with the passage the answer rests on boxed in
violet. Clicking a different answer moves the mark.

## What is marked, and why it is found rather than drawn

Nothing in these PDFs is tagged or pre-marked. The annotator reads the file you
upload, and for each of the four questions it looks for wording that answers
that question:

| Question | Wording looked for |
|---|---|
| Addresses the stated risk and assertion? | `risk` · `assertion` · `address the` |
| Operates at sufficient precision? | `tolerance` · `threshold` · `precision` · `limit` |
| Performer segregated from the activity? | `independent` · `other than the person` · `segregat` · `cannot be bypassed` · `authority` |
| Operation evidenced and retained? | `audit trail` · `evidenced` · `retained` · `log` |

Alternatives, not fixed phrases — one document says "independent of the
preparer" where another says "someone other than the person who keyed it", and
a single fixed word would find only one of them.

Each document here was written so that each phrase sits in the sentence that
genuinely answers its question, and all ten were checked against the real
pdf.js extraction: **every document matches all four**. A client's own document
that happens not to use any of these words renders unmarked, and the panel says
so rather than inventing a box.
