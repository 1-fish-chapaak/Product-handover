# BYOT fixtures

Six real reports, kept together so "it works" means something we can repeat.
The files themselves are gitignored: they hold real findings, real names and
real numbers, so they sit on disk beside the harness and never in the repo.

| File | What it covers |
|---|---|
| `CIPL_l_Audit_Committee_Presentation_l_December_2018.pptx` | A committee deck. A title box that lies (the company name on every slide), one stamp spanning several slides, and whole parts we cannot fill yet. Passes when the left-out list is exactly two, the audit plan and the follow-up, each with its named reason. |
| `Internal_Audit_Report_Revenue_and_Payouts.pdf` | The PwC Paytm report: a deck printed as a PDF. Letter ratings, the action plan inside each card, appendices full of confidential detail. Passes when the dividers become the groups, the nine observations come back as one repeating card, the criteria page is fixed wording, and the front pages follow the block rules. |
| `Internal_Audit_Report_Infosys_FY2026.pdf` | Page tops and bottoms, stray paragraphs, the fixed-wording rule, and financial pages that must leave with their own named reason. |
| `Aberdeen_AC2515_Pension_Fund_Payroll.pdf` | Cover paperwork, four sets of rating words, and cards that are not identical. |
| `Cumberland_J2303_Financial_Services_Governance.pdf` | Cross-references, and a description written for every part. |
| `Q1_Financial_Controls_Review_our_own.pdf` | The round trip. We wrote every word of this one, so anything dropped is a detector bug by definition. |

## Running them

```bash
npm run dev                 # the engine needs a browser: pdf.js, canvas, DecompressionStream
node scripts/byot-harness.mjs
```

The harness prints, per fixture, what was kept, what was left out, and **the
number of catch-all drop reasons**. That count is the bug meter. A catch-all is
almost never a drop that needs a better name; it is a drop that should not be a
drop at all, so the number should collapse as rules land. Whatever is left at
the end genuinely needs either a genre name or a keep rule.
