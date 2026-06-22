# Design PRD — Report Templates landing

This covers the Templates tab in Reports. The Generate wizard, the report engine, and report data stay the same.

## Decisions

These are settled, so they are not problems:

- Reports have three types only: SOX, IA, and ATR. Evidence is files, not a report type.
- Only ATR carries Draft and Final. The other types do not need a status.
- The five switched-off templates stay off. The catalog is the three live ones (Internal Audit, SOX Compliance, ATR).
- Differences in row actions are functionality, not a design problem.

## Problem

These are the design problems across the Reports section, found by opening each tab and report.

**Templates tab**

1. Standard and Custom sit on one long page. As Custom grows, the page never stops scrolling.
2. Once you scroll down, you lose track of which group you are in. There is no quick way to jump between Standard and Custom.
3. You can only edit a template by opening Generate first, then finding Customize inside the wizard. Editing is hidden.
4. The New template and Upload template buttons live only in the Custom section header. They scroll out of view and read as Custom-only actions.
5. There is no search. Custom can grow long, but there is no way to find a template by name.
6. The card footer shows raw section names, so test templates with names like "12441" make the card look broken.
7. Editing a Standard template changed it in place, so you could change a shared template by accident. Editing a Custom one did not save at all, so changes were lost. There was also no way to copy or fork a template.

**My Reports and Shared lists**

8. The Generated date is written three different ways in the same area: "Mar 22, 2026, 16:40", "21 Mar 2026", and "Apr 10, 2026".
9. The filter control has a different name on each sub-tab. It says "Type" on All, "Tag" on Internal Audit, and "Filters" on ATR, for the same job.
10. Report type labels are uneven. Internal Audit rows show a plain dash instead of their type, while SOX and ATR rows show theirs.

**The report reader**

11. The reader still uses the heavy full-purple banner that was meant to become a light letterhead, so it does not match the agreed look.
12. A SOX report's reader shows "Report Type: Internal Audit", which contradicts its own SOX Compliance template and title.

**Generate flow**

13. There are two disconnected ways to make a report. The Templates wizard on this page, and a separate Generate Report button on the engagement page, which do not share one flow.

**Download flow**

14. The same report looks different in each download format. In the Download window the PDF uses the light letterhead with the logo and a serif title, the DOCX cover is a plain dark-purple bar with no logo and a sans title, and the PPTX cover is different again. The three formats do not share one cover and brand, so a report saved as PDF, Word, and PowerPoint does not look like the same document.

## What we changed

1. Added a Standard / Custom switch at the top. You see one group at a time. Standard shows first.
2. Kept Standard as a plain set of three cards. No search, no create buttons.
3. Gave Custom its own search box, plus the New template and Upload template buttons.
4. Put a Customize button on every card, shown on hover.
5. Customizing a Standard template opens a copy. Customizing a Custom template edits it.
6. Added Save as copy in the editor, which forks a template into "Copy of X".
7. Cleaned up the footer to show "N sections" with the first names.
8. Ran the design sync so the pre-commit check passes.
9. Removed 174 unused imports from the reports refactor. Build and tests still pass.

This pass fixes the Templates tab problems (1 to 7). Problems 8 to 13 are open Reports design issues.

## How you use it

- Generate: open Templates, click a card, pick your queries, the report opens.
- Edit a standard: hover a Standard card, click Customize, it opens a copy, save it to Custom.
- Edit a custom: hover a Custom card, click Customize, save to update it, or Save as copy to fork.
- Make a new one: in Custom, click New template or Upload template.
- Find and manage: in Custom, search by name, then hover to Customize or Delete.

## How to check it

- The switch swaps the two groups and only one shows.
- Custom search filters and clears.
- New and Upload work from the Custom toolbar.
- Customize on a standard shows "Based on X". On a custom it shows "Edit template".
- Save keeps one custom. Save as copy adds one.
- The footer reads "N sections" with names.
- Clicking a card still opens Generate.
