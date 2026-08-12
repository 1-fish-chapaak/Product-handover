# SOX / ICFR Confidence Scores — Calculation Spec

**Status:** For review · **Scope:** SOX 404(b) / ICFR engagement · **Source:** as implemented on the irame.ai audit platform

---

## What exists today, and what needs to change

**Six confidence scores are live in the product right now.** One needs removing from the engagement view, and one needs building. Net count stays at six.

### Built today

| # | Score | Level | Renders in | Keep? |
|---|---|---|---|---|
| 1 | RACM review | Engagement | Dashboard · audit Overview | **Keep** |
| 2 | Control effectiveness | Engagement | Dashboard · audit Overview | **Keep** |
| 3 | Sample testing | Engagement | Dashboard · audit Overview | **REMOVE** |
| 4 | Control completeness | Control | Control dossier — right rail | **Keep** |
| 5 | Evidence validated | Control | Control dossier — right rail | **Keep** |
| 6 | TOD coverage confidence | Control | Control dossier — right rail | **Keep** |

### To be added

| Score | Level | Status | Depends on |
|---|---|---|---|
| **Engagement completeness** | Engagement | **Not built** — proposed in this document | RACM review (#1) being store-gated first |

### The change list

| # | Action | Score | Why |
|---|---|---|---|
| 1 | **Remove** | Sample testing *(engagement level)* | Duplicates Evidence validated, which does the same calculation per control. Coverage averaged across a whole register cannot tell an auditor which control to open; the same number on one control can. |
| 2 | **Add** | Engagement completeness | Nothing today answers *"how much of this engagement is finished?"* Takes the slot vacated by Sample testing, keeping three scores at engagement level. |
| 3 | **Fix** | RACM review — store gating | The three review actions are auditor-only in the UI but carry no role check or lock check in the store. Must be closed before #1 feeds a reported completeness figure. |
| 4 | **Fix** | Zero-denominator display | A control with no design considerations shows 0% — visually identical to one whose considerations all failed. Needs a neutral **"Not set up"** state. |

> **Note on the removal:** only the engagement-level *card* goes. The sample × attribute counting rule survives untouched at control level as Evidence validated (#5), and the sampling logic itself — sizing, drawing, testing — is unaffected. Engineering must remove it from the meter function, not just hide the card, or it stays in the data and resurfaces.

**Resulting structure:** three scores at engagement level, three at control level.

---

## Summary

The platform surfaces confidence scores at **two levels**, three at each. This split is the single most important thing to understand before reading any of them.

**Engagement level** — shown on the Dashboard and audit Overview. Answers *"how is this audit going?"*

| # | Score | Answers | Status |
|---|---|---|---|
| 1 | RACM review | Is the matrix approved to test against? | Built |
| 2 | Control effectiveness | Are our controls working? | Built |
| 3 | Engagement completeness | How much of this engagement is finished? | **Proposed** |

**Control level** — shown in the right rail of a single control's working paper. Answers *"is this one piece of work finished?"*

| # | Score | Answers | Status |
|---|---|---|---|
| 4 | Control completeness | Is the design evidence file complete? | Built |
| 5 | Evidence validated | Have this control's operating checks been run? | Built |
| 6 | TOD coverage confidence | How well does the design hold up? | Built |

The three scores read in order at engagement level tell one story: **is the matrix ready → are the controls working → how far through are we.**

Three principles govern all six:

1. **Computed on read, never stored.** No score is a field in the data model. Every number is derived live from the underlying evidence, so a score cannot drift out of sync with the work — and nobody can set one manually.
2. **One computation, many surfaces.** The engagement scores are calculated once and read by both the Dashboard and the audit Overview, so two screens can never disagree about the same engagement.
3. **Zero denominator renders 0%, never 100%.** Nothing tested is not "complete."

---

## Master reference — every score in one place

| # | Score | Level | Formula | Numerator counts | Denominator | Gate? | Green at |
|---|---|---|---|---|---|---|---|
| 1 | **RACM review** | Engagement | approved ÷ total | Rows with review status *Approved* | All in-scope controls | No | 80% |
| 2 | **Control effectiveness** | Engagement | effective ÷ total | Controls where **both** tracks concluded Effective (design alone if short-form) | All in-scope controls | No | 80% · `forceRed` |
| 3 | **Engagement completeness** *(proposed)* | Engagement | Σ credits ÷ control count | Milestone credits: RACM 0.10 · TOD 0.25 · TOE 0.30 · countersign 0.25 · exceptions closed 0.10 | All in-scope controls, each worth 1.0 | No | — |
| 4 | **Control completeness** | Control | done ÷ required | Required design elements **Received or Waived** | Required design elements only (optional excluded) | **Yes** | **100%** |
| 5 | **Evidence validated** | Control | checks run ÷ checks total | Grid cells marked anything but *Not tested* | samples × attributes (falls back to attributes before a sample is drawn) | **Yes** | **100%** |
| 6 | **TOD coverage confidence** | Control | passing ÷ all | Design considerations resulting Pass (override wins) | All design considerations | No | 80% |

**Only scores 4 and 5 gate** — they block a conclusion, so they cannot be green below 100%. **Only score 2 carries `forceRed`** — any single ineffective control turns it red regardless of percentage.

**The three counting rules that cause the most confusion:**

1. A *check* is a sample × attribute **cell** — 25 items × 3 attributes = 75 checks, not 3. (score 5)
2. A *waived* design element counts as complete, because a recorded judgement is not a missing file. (score 4)
3. *Not yet tested* counts against you exactly as hard as *failed*, because an untested check gives no confidence either way. (score 6)

---

# Engagement level

## 1 — RACM review

```
RACM % = (rows with review status Approved ÷ total in-scope controls) × 100
```

Measures **pre-testing review**: how much of the risk & control matrix has been signed off as fit to test against. It reads first because it is the first thing that has to be true.

**Denominator.** All in-scope controls — one RACM row *is* one control.

**Numerator.** Rows whose review status is *Approved*, set by the auditor from the RACM tab, per row or in bulk.

**Three possible row states:**

| State | Set by | Stored as |
|---|---|---|
| **Approved** | Auditor ticks the row, or selects rows and bulk-approves | status `Approved` + who + when |
| **Remark** | Auditor writes what must change first — text is mandatory | status `Remark` + the remark text |
| **Pending** | Default, no review recorded | no review object at all |

**Remarks are reported separately, not netted off.** The displayed detail reads `{approved}/{total} rows approved · {n} remarks open`, and the matrix header carries a two-colour stacked bar — green for approved, amber for remarked. A remark is not a half-approval; it is a blocker with a named condition.

**Reversible.** *Withdraw approval* clears a row back to Pending. Bulk-approving a selection containing open remarks triggers a confirm naming how many remarks will be erased — that never happens silently.

> **Rationale to defend:** every row needs approval before testing leans on it. Testing built on an unreviewed matrix is testing that may have to be redone.

**Displayed detail:** `{approved}/{total} rows approved · {n} remarks open`

---

## 2 — Control effectiveness

```
Control effectiveness % = (controls concluded Effective ÷ total in-scope controls) × 100
```

**Denominator.** Every control in the audit's scope. When an audit is open this is that audit's scope; at engagement level it is the whole control register.

**Numerator — what "Effective" requires.** A control is Effective only when **both** tracks conclude Effective — Test of Design *and* Test of Operating Effectiveness. If **either** track is Ineffective, the control is Ineffective.

**The one exception.** An automated control whose IT General Controls are healthy runs in *short form*: population, sample and TOE do not apply, and the control concludes on its design alone. If the underlying ITGCs fail, the operating track returns and the control is tested like a manual one.

**Colour is not proportional.** This score carries a `forceRed` flag: **any** ineffective control turns it red regardless of the percentage.

> **Rationale to defend:** control effectiveness is not an average, it is a pass/fail on every control. A 95% green ring that conceals one broken control is precisely the failure mode the flag exists to prevent.

**Displayed detail:** `{effective}/{total} controls effective · {n} ineffective`

---

## 3 — Engagement completeness *(proposed)*

The platform currently answers *"is the matrix ready?"* and *"are our controls working?"* It does **not** answer:

> **"How much of this SOX engagement is finished?"**

The component facts already exist in the data — RACM approved, TOD concluded, TOE concluded, papers countersigned, exceptions closed — but they are scattered across separate tiles rather than composed into a single readable number. Today, if leadership asks *"what is our SOX readiness?"*, no one can point at one figure.

### The proposal

A **milestone-weighted progress score**. Each control is worth 1 point, distributed across the milestones it must pass. The engagement score is the average across all in-scope controls.

| Milestone | Weight | Complete when |
|---|---|---|
| RACM row approved | 0.10 | Pre-testing review approved, no open remarks |
| Test of Design concluded | 0.25 | Design track concluded either way |
| Test of Operating Effectiveness concluded | 0.30 | Operating track concluded either way |
| Working paper countersigned | 0.25 | Concluded *and* reviewer countersigned |
| Exceptions closed | 0.10 | No open exception on this control |

```
Engagement completeness % = (Σ milestone credits earned ÷ number of in-scope controls) × 100
```

### Why the denominator is in-scope controls

**Because the control is the unit of work in SOX.** Every milestone above attaches to a control — a RACM row is a control, TOD and TOE are tested per control, a working paper is signed per control, and an exception is raised against a control. Nothing in the engagement is done to a process or an entity directly. If the numerator is built out of per-control events, the denominator has to be controls or the ratio is not measuring anything coherent.

Since each control's weights sum to exactly 1.0, dividing by the control count is the same as dividing by total available credit. The formula could equally be written as `Σ credits ÷ Σ maximum credits` — the same number, and that phrasing may be easier to defend in review.

**Two scoping rules that matter more than the formula:**

- **It must be the open audit's scope, not the whole control register.** The platform already makes this distinction — the progress counters take an optional control subset precisely so an audit reports its own numbers. An interim audit covering 6 controls should read 100% when those 6 are done, not 19%.
- **Short-form automated controls stay in the denominator.** They redistribute their TOE weight into design rather than dropping out, so they can still reach 1.0. Excluding them would make the denominator shift as ITGC conclusions change.

**Alternatives considered and rejected:**

| Denominator | Why not |
|---|---|
| Processes / RACMs | Too coarse — a process with 30 controls and one with 3 would count equally |
| Entities | Group audits test the same control at each entity, so this double-counts the wrong axis |
| Total milestones (controls × 5) | Mathematically identical once weights sum to 1 — no benefit, harder to explain |
| Number of tests or exceptions | Measures activity, not completion — and the denominator would grow as work is found |

### Design decisions built in

- **Concluded, not effective.** A milestone completes when the track *concludes*, whichever way it went. This measures progress, not outcome — an ineffective control is finished work, not unfinished work.
- **Countersign is weighted heavily (0.25).** Review is where SOX engagements actually stall, and a score reading 90% while nothing is signed would mislead.
- **Not a gate, and paired with a blocker count.** Always display alongside *"N controls blocked"* — a percentage alone cannot distinguish steady progress from a stuck engagement.

**The honest trade-off — equal weight per control.** This treats a key control and a non-key control as worth the same. Finishing 20 low-risk controls while 5 key controls sit untouched reads as 80% complete, which overstates readiness. Two defensible responses:

1. **Keep equal weighting** for the headline score — explainable in one sentence, no arbitrary risk weights to defend — and pair it with a separate *"N key controls not started"* line to carry the risk signal.
2. **Weight by key status** (key controls count 2, non-key 1). More faithful to SOX, but the number becomes harder to explain and moves whenever a key judgement is revised.

Recommendation: ship option 1 with the key-control blocker line beside it, and revisit weighting once the score has been in front of users.

**The critical caveat to state explicitly on the UI:** completeness is not effectiveness. An engagement can be **100% complete and still conclude "ICFR not effective"** if a material weakness remains open. Scores 2 and 3 must sit side by side and must never be merged.

**Known behaviour to document:** adding a control mid-audit grows the denominator, so the score can fall without any work being undone. This is correct — the engagement genuinely became less complete — but it needs a tooltip, or it will be read as a bug.

---

# Control level

## 4 — Control completeness *(GATE)*

```
Control completeness % = (required elements evidenced or waived ÷ required elements) × 100
```

**Denominator.** Design documents flagged as required. Optional elements are excluded entirely — attaching extras strengthens the evidence file without inflating the score.

**Numerator.** An element counts as done when it is either:

- **Received** — evidence attached, or
- **Waived** — marked not applicable with one of three recorded reasons (prepared by the audit team / held by the client and inspected in situ / not applicable, design tested off the control description). A waiver requires a mandatory written note.

> **Rationale to defend:** a waived element is accounted for, not outstanding. The auditor has made and documented a judgement, and a recorded judgement should not display as a missing file. The mandatory note is what makes this defensible — a waiver with no reason cannot be created.

**This is a gate.** Green only at exactly 100%, and it physically blocks the *Conclude TOD effective* action. The lock message names the reason: *"Locked — N required elements still need evidence."*

**Displayed detail:** `{done}/{total} required elements evidenced`

---

## 5 — Evidence validated *(GATE)*

```
Evidence validated % = (operating checks run ÷ operating checks total) × 100
```

**A "check" is a cell in the sample × attribute grid — not an attribute.** This is the definition most likely to be misread. Twenty-five sampled items tested against three attributes is **75 checks**, not 3.

| Condition | Checks total | Checks done |
|---|---|---|
| Sample drawn | samples × attributes | cells whose result is anything other than *Not tested* |
| No sample yet | attributes | attributes with a recorded result |

**Why the fallback exists.** Before a sample is drawn there are no cells, so the denominator would be zero and the score meaningless. Falling back to attribute level keeps the score honest during early testing.

**Note on placement.** This meter sits in the right rail of the design step but reads the *operating* track. That is deliberate: the proof that a control's design works lives downstream in the sampled evidence, and the auditor needs to see the shortfall while still on the paper.

> **Rationale to defend:** this measures how much of the actual testing ground is covered, not how many boxes have been opened. An auditor who has run one attribute against one of twenty-five items has not done 100% of anything.

**This is a gate.** Green only at 100%; unvalidated checks hold back an effective conclusion.

**Displayed detail:** `{done}/{total} operating checks run`

---

## 6 — TOD coverage confidence *(not a gate)*

```
TOD coverage confidence % = (design considerations passing ÷ all design considerations) × 100
```

**Numerator.** Considerations whose result is Pass. An **overridden** Pass counts as a pass — the auditor's recorded judgement is the answer.

**Denominator.** All design considerations on the control.

**Both failed and not-yet-tested considerations drag the score down, equally.** This is intentional: an untested check gives no confidence in either direction.

> **Rationale to defend:** this is the only *quality* measure of the six. Scores 4 and 5 ask whether the work happened; this one asks whether the design actually held up. That is why it does not gate anything — it informs the auditor's confidence rather than blocking their conclusion.

**Displayed detail:** `{passed}/{total} considerations pass`

---

## The shared colour rule

All scores are coloured by one function, so no two can disagree about what "green" means.

| State | Condition | Status word |
|---|---|---|
| **Red** | `forceRed` is set **OR** score < 40% | Needs attention |
| **Amber** | below 100% if gated · below 80% if not gated | In progress |
| **Green** | 100% if gated · 80% or above if not gated | Complete (at 100%) / On track |

**Which scores gate:** Control completeness and Evidence validated. **Which carries forceRed:** Control effectiveness.

> **Rationale to defend:** a gated score cannot be green at 99%, because it locks a conclusion that someone signs their name to. Near-enough is not enough when a signature depends on it. Confidence measures can be directional; completeness measures cannot.

**Visual treatment:** colour is spent on exceptions only. Red and amber tint the whole card so it pulls the eye; a healthy score sits on the plain surface. Three green washes side by side shout as loudly as the one card that needs reading.

---

## Worked example — one control

- 4 required design documents — 3 received, 1 waived with a recorded reason
- 5 design considerations — 4 pass, 1 not yet tested
- a sample of 25 items against 3 attributes — 60 of the 75 cells marked

| Score | Calculation | Result | Colour |
|---|---|---|---|
| Control completeness | 4 ÷ 4 | **100%** | Green — gate cleared |
| Evidence validated | 60 ÷ 75 | **80%** | **Amber** — gated, so amber until 100% |
| TOD coverage confidence | 4 ÷ 5 | **80%** | Green — not gated |

**Reading:** this control cannot yet be concluded effective. Evidence validated is holding it. That is the story the three cards tell together, and it is why the gate distinction matters — 80% is green on one card and amber on the other, correctly.

---

## Open items for engineering

1. **Sample testing is being removed from engagement level.** The engagement meter function currently computes and returns three meters — RACM, Control effectiveness and Sample testing. Sample testing is dropped from this spec: its counting rule is duplicated per control by Evidence validated, and coverage is far more actionable read against one control than averaged across a register. The engagement meter function needs updating, and Engagement completeness takes the vacated third slot.

2. **RACM review actions are not gated in the store.** The three review actions (approve, remark, clear) are auditor-only in the UI but — unlike every other mutation in the module — carry no role check and no engagement-lock check. A countersigned engagement's matrix can still be re-approved programmatically. Worth closing before score 1 drives a reported number, and required before score 3 depends on it.

3. **"Not started" versus "doing badly" is indistinguishable.** A control with no design considerations shows 0% TOD coverage confidence — visually identical to a control whose considerations all failed. Same for a control with no attributes on Evidence validated. Recommend a distinct **"Not set up"** state for a zero denominator, rendered neutral rather than red. Small change, meaningful effect when triaging a register of 100+ controls.

---

## Appendix — where each score is implemented

| Score | Function | File |
|---|---|---|
| 1, 2 | `engagementRagMeters` | `Overview.tsx` |
| 1 (row actions) | `approveRacmRows`, `remarkRacmRow`, `clearRacmReview` | `store.tsx` · UI in `Racm.tsx` |
| 3 | *not yet implemented* | — |
| 4, 5, 6 | `designRagMeters` | `ControlDossier.tsx` |
| Completeness inputs | `designCompleteness`, `designOutstanding` | `helpers.ts` |
| Conclusion inputs | `conclusionOf`, `controlConclusion`, `trackResult`, `operatingApplies` | `helpers.ts` |
| Result inputs | `pointResult`, `stepResult` | `helpers.ts` |
| Colour rule | `ragColor`, `RagCard`, `RagStrip` | `parts.tsx` |
| Progress counters | `engagementProgress`, `isControlFinal`, `isAwaitingReview` | `helpers.ts` |
