# Platform Usage

What this workspace has done, counted from the record and from nothing else.

Every figure on the page has a column behind it. Nothing is estimated, modelled or priced, because
the platform records no price, no token and no salary, and a number invented here would be one a
reader could never check against anything.

Rebuilt on 7 Sep 2026, after an audit of the real backend showed most of what the page printed had
no column behind it.

---

## What it answers

**What ran.** 330 checks finished this quarter, in 11.5 hours of platform time, returning 6,24,796
rows for somebody to look at. 22 failed or were blocked and spent 40 minutes producing nothing.

**What was tested.** 11 populations holding 14,28,000 rows and 111.4 MB, plus 39 samples drawn and
77 sample tests run.

**What it found.** 346 exceptions, 57 of them high, 52% closed, 71 open past a date somebody set.

**What came out.** 7 reports and 4 generated documents, 126 pages.

**Queries against your own databases.** 469 queries returning 60,06,634 rows, median 1.7 seconds,
slowest 39.8 seconds, 2.2 GB scanned on the engines that report it.

---

## The rules

**A figure has a column or it is not on the page.** No assumed rate, no modelled saving, no
projection. If the platform does not write it, the page does not print it.

**An unknown is never a nought.** Snowflake, BigQuery and Athena report how much data a query
scanned. Postgres and MySQL do not, so those rows read "not reported". A nought there would say the
query touched nothing.

**A gap is named, not left blank.** Six questions people ask of a usage page are refused on the page
itself, each with the column that is missing. A page that quietly omits what it cannot measure reads
as a complete picture.

**Coverage is never claimed.** The page says how many rows a check returned and how many rows a
population holds. It never says how many rows a check read, because nothing records that.

**A run belongs to a team, never to a person.** `workflow_executions` carries no user. The column
exists and nothing writes it, so the own work view refuses that section in words.

**A floor says it is one.** Only an exception somebody put a due date on can be overdue, so the
overdue count is a floor.

---

## Where every figure comes from

| Section | Table | Columns |
| --- | --- | --- |
| What ran | `workflow_executions`, `workflows` | `status`, `started_at`, `duration_secs`, output tables, `team_id` |
| What was tested | `engagement_populations`, `engagement_samples`, `engagement_sample_runs` | `row_count`, `size_bytes`, `uploaded_by`, `status`, `actor_user_external_id` |
| What it found | `report_card_cases_staging` | `severity`, `status`, `flagged_by_user_external_id`, `flagged_at`, due date |
| What came out | `reports`, `report_atr_snapshots` | `status`, `owner`, `page_count`, `size_bytes`, `generated_by_user_external_id` |
| Queries | `db_connection_audit`, `db_connections` | `row_count`, `latency_ms`, `bytes_scanned`, `error_code`, `engine` |
| What was imported | `racm_imports` | `rows_total`, `rows_processed`, `risks_created`, `controls_created` |
| Who is on the workspace | `tenant_memberships`, `accounts`, `activity_logs` | `status`, `joined_at`, `last_login_at`, `action` |

---

## What the page refuses

| Question | Why |
| --- | --- |
| Who ran a check | `workflow_executions` records no user. The column exists and nothing writes it. |
| How many rows a check read | Only the rows a run returned exist, derived from its output at read time. |
| What the AI cost | No table records a model, a token count or a price. |
| How often people sign in | One last-login timestamp, overwritten each time. No history, no active users. |
| Which screens people use | Nothing records a page view. The activity log covers only admin changes. |
| How much data the workspace holds | Sizes sit on five tables and are never summed anywhere. |

Each becomes answerable the day the platform writes the column.

---

## What was removed, and why

The page used to open on 7,131 hours saved, 14.9 auditors you never had to hire and ₹35.7 lakh of
work avoided, then a cost section in rupees and dollars.

All of it is gone. The hours rested on a rows-covered figure that no column produces and a manual
review pace of 200 rows an hour that we picked. The rupees rested on an auditor hour of ₹530 that we
also picked. The model spend rested on tokens and prices that no table records. The connector spend
rested on a rate card and an operations catalogue that do not exist in the backend.

The page answers a smaller question now. It answers it from the record.

---

## Files

| File | What it holds |
| --- | --- |
| `src/data/usage/seed.ts` | The records, one interface per real table, with the backend path on each |
| `src/data/usage/metrics.ts` | Every figure, scoped and windowed. No assumptions block, because there are none |
| `src/components/usage/PlatformUsageView.tsx` | The page |
| `src/components/usage/chrome.tsx` | Its small vocabulary: type and hairlines, no tiles |
| `tests/platform-usage.spec.ts` | Ten tests, run against the real page |
