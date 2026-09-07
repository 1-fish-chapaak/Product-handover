# Platform Usage

## The problem

The page printed figures the platform cannot produce.

It opened on 14,28,000 rows checked, 7,131 hours saved and ₹35.7 lakh of work avoided. Every one of
those rests on two things that are not recorded anywhere. There is no column that says how many rows
a check read, so the rows covered were the seed's own population list read back to itself. And there
is no manual review pace and no salary in the product, so the 200 rows an hour and the ₹530 auditor
hour were numbers we picked. Ten minutes with the backend confirms it: no metering table, no billing
code, no token log, no cost column, and `workflow_executions.triggered_by_user_id` exists with
nothing writing it, so a check that ran cannot be put against a person at all.

A usage page whose selling point is that a reader can check the arithmetic cannot open on a figure
that has nothing to check it against.

## My thinking

Take everything the record does not hold, and take it out. Then say what is left, plainly, and name
the gaps rather than quietly leaving them blank.

That is a real loss and it is worth stating. The renewal story goes: no hours saved, no auditors you
never hired, no rupees, no model spend, no connector spend. What is left answers a smaller question
honestly instead of a bigger one badly. It says what ran, what it was run against, what it found,
what came out, and who is on the workspace.

The gaps get their own section at the bottom, and each one names the missing column. A page that
silently omits what it cannot measure reads as a complete picture, and a reader then draws a
conclusion the data does not carry. Six questions sit there: who ran a check, how many rows a check
read, what the AI cost, how often people sign in, which screens people use, and how much data the
workspace holds. Each becomes answerable the day the platform writes the column.

One thing survives from the old page and is worth keeping: an unknown is never a nought. Snowflake,
BigQuery and Athena report how much data a query scanned. Postgres and MySQL do not. Those rows read
"not reported", because a nought there would say the query touched nothing.

## How it should work

**The reader.** Three views. Whole company for `ad_usage`, one team for `ad_usage_people` with a
team, and your own work for everybody. A lens rather than a key: it only narrows down the reader's
own line, a view above entitlement is never offered, and a stale link reaching one is refused in
words rather than shown an empty page.

**The window.** This month, this quarter, financial year to date, last twelve months, since the
start. Anchored to 31 March 2026, a quarter end, so this quarter against last compares a whole
window with a whole one.

**What ran.** Executions that completed, failed and were blocked, the machine time they took from
`duration_secs`, the median run, and the rows the completed runs returned. Per workflow with its
team and its last run, and per month. On the own work view this section refuses in words: a run
reaches a team through its workflow and never reaches a person.

**What was tested.** Populations loaded in the window with their row counts, sizes, source and who
loaded them, then samples drawn and sample tests run. The caption says these rows are what was
available to test and not a claim about coverage.

**What it found.** Exceptions by severity and by status, how many are closed, how many are open and
how many are past a date somebody set. Per check underneath. Overdue is a floor, because only a case
with a due date can be one.

**What came out.** Reports started and how many are final, then documents generated with their page
counts and who generated them. This is the one place a person's name sits on the work itself.

**Queries against your own databases.** Count, rows returned, median and slowest latency, and bytes
scanned on the three engines that report it. Failed queries are counted, because a query that timed
out still ran.

**What was imported.** Rows in the files, rows processed, risks and controls created.

**Who is on the workspace.** Seats by status and team, and the last sign in on each. One timestamp,
overwritten each time, so the page says there is no history behind it and never counts active users.

**What this page cannot tell you.** The six gaps, each with the reason.

## Verify against plan

| Claim | How to check |
| --- | --- |
| Every figure has a column | Each section's working names the table it was summed from |
| No money anywhere | No ₹ and no $ appears on the page in any view |
| No assumed rate | No rows an hour, no auditor hour, no hours saved, no people equivalent |
| A run is never attributed to a person | The own work view refuses in words and shows no run count |
| An unreported figure is not a nought | Postgres and MySQL rows read "not reported" |
| Coverage is never claimed | The page says rows returned and rows available, never rows checked |
| Overdue is a floor | The caption says only a case with a due date can be overdue |
| The page never writes | No input or textarea in the page, only the window select and the view buttons |
| The gaps are on the page | Six questions with their missing columns, in their own section |
| The window moves everything | Changing it moves every figure that depends on it |

## Acceptance criteria

| Id | Criterion |
| --- | --- |
| PU-01 | The quarter reads 330 completed runs, 11.5 hours of machine time and 6,24,796 rows returned |
| PU-02 | No ₹ or $ appears anywhere on the page, in any view or window |
| PU-03 | The words hours saved, auditor hour, rows an hour and estimated appear in no figure section |
| PU-04 | The own work view refuses the run section in words and never shows a count of nought there |
| PU-05 | Bytes scanned reads "not reported" on Postgres and MySQL, never 0 |
| PU-06 | The populations section says its rows are not a claim about coverage |
| PU-07 | The exceptions section names overdue as a floor |
| PU-08 | Documents generated names the person, because that column exists |
| PU-09 | The last sign in section says there is no history behind the timestamp |
| PU-10 | The gaps section lists six questions, each naming the column that is missing |
| PU-11 | A figure's working opens on click, so a touch reader can reach it |
| PU-12 | The page has no input of any kind, and says it reads and never writes |
| PU-13 | No benchmark, target, percentile, peer or industry average appears |
| PU-14 | No em dash appears in visible copy |
| PU-15 | Changing the window moves every figure that depends on it |
| PU-16 | A folded group still answers in one line |
| PU-17 | Every persona anybody can sign in as has work in the seed, so no view opens empty by accident |
