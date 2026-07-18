# CLAUDE.md

## Never claim done without the table

Do not say "done", "complete", "matched", "100%", or "verified" without printing
a table of **what was checked, its result, and what was NOT checked**. Name the
gaps unprompted. Any gap means the answer is the gap, not "100%".

This is the top rule. It failed nine times in one session: nine times the ask was
"is it 100% matched", nine times only one part had been checked, twice the answer
given was a false "Yes".

### The protocol

1. **Derive the checklist from the real thing, before writing any test.** Open the
   real report/page/flow and write down every visible surface. That list is the
   checklist. Never let the checklist be "the part that was easy to scrape into a
   script" — that is how a preview got signed off on its outline while its cover
   read invented text.
2. **Test every item.** Every instance, not one sample. Eleven reports, not three.
3. **Verify against the rendered page, not the source.** Matching constants in a
   `.ts` file is not proof. Open it and look.
4. **Seed/demo data is not representative.** It routinely lacks fields the real
   generated path sets. Test the real path too.
5. **"Are you sure?" means run the check this turn.** Never answer from memory.
6. **When the user points at one bug, sweep the whole surface family.** Never fix
   only the thing pointed at and re-declare done.
7. **A flaky test proves nothing.** Wait for real content, not a fixed timeout.

### What "the report" means here

"The report" is the whole document a person sees: cover banner (eyebrow, title,
description, byline, actions), outline rail, section headings, section bodies,
footer. "Match the report" means every one of those matches. Anything that does
not exist on a real report must not appear in a surface that mirrors one — never
invent copy for a mirror.

## Style

- Answer short. Caveman mode is the default: drop articles and filler, one line
  where one line does. No paragraphs unless asked. Drop it only to confirm a
  destructive action or where compression would make an order of steps misread.
- No off-grid font sizes. Use 12 / 14 / 16 / 18 / 20px only. Never 13 / 15 / 17.
- No em dashes or hyphenated compounds in user-facing copy. Plain English.
- No sycophancy. Don't open with "you're right" or "good catch". Just do the work.
- Don't remove an existing feature to satisfy a new ask. If the ask implies
  removal, say so before doing it.
