# PRD: AI Insights

**Product:** Irame / Auditify
**Where it lives:** across the platform (Workflow Executor, Business Process, Engagement Overview)
**Status:** Draft for review
**Author:** [you]
**Last updated:** 8 Jul 2026

> Overview walkthrough: [Loom / Drive](https://drive.google.com/file/d/11-nI2E7zTPJMr9t4mGWSIG98-1wQzJ8f/view)

> Scope note: This PRD is about **Insights** only. Memory is a separate product with a separate PRD. The short version of the difference: Memory helps a single conversation remember what you've told it, and it lives mostly in chat. Insights looks across many runs and workflows to surface things you didn't ask about, and it shows up all over the platform. Where the two touch, I've called it out, but I've kept them apart on purpose.

---

## 1. The one-line version

Irame runs one audit workflow really well and then forgets it ever happened. Insights is the layer that looks across all of a customer's runs and workflows and points out the things a single run can never see: the vendor that's quietly flagged in five runs, the KPI that's drifted up four months straight, the run that just contradicted something you signed off on last month.

Two things make it trustworthy enough for audit. First, the detection is deterministic, so every insight traces straight back to the raw rows behind it. Second, an insight never becomes a standing rule until a human approves it.

---

## 2. Why we're building this

Audit customers don't run a workflow once. Trident runs the same 30 spreadsheets every month. A single AP Ageing process is six workflows deep, and it runs quarter after quarter, for years. All of that repetition is where the real signal is, and right now we throw it away the second a run finishes.

That's the gap. Every run is an island. It sees itself and nothing else. So the moment a risk lives *between* runs instead of inside one, nobody catches it.

---

## 3. The problem, with real examples

### 3.1 A risk that's obvious across six runs is invisible in any one

A single run only sees itself, so a pattern that's spread across runs slips through.

> In an AP Ageing process with six workflows, the same vendor (MCKESSON) gets flagged in five of the six runs. Each run flags it as one small, in-tolerance exception, so no single run raises its hand. But five runs pointing at one vendor is a control gap. Today nobody sees it, because nobody is looking across the runs.

### 3.2 A slow drift that only shows up over months

Some risks aren't a spike. They're a trend, and you need several periods side by side to notice.

> The 90+ day AP bucket creeps up 9 to 12% every month for four months straight. Any single month reads as "normal range." The trend is a liquidity warning, and it's completely invisible in a one-run view.

### 3.3 The same entity showing up in two places nobody connected

Two workflows flag the same vendor for different reasons, and because they're different workflows, nobody joins the dots.

> A vendor gets caught in the duplicate-payment check in one workflow and shows up again in a PO leakage check in another. Separately, each is a shrug. Together, it's a story worth a closer look.

### 3.4 A new run quietly contradicts something you already approved

Once a team agrees on a fact, a later run can break it without anyone noticing.

> The team signed off that contract HPG12 always gets its WAC re-validated before processing. A new run comes in and processes HPG12 chargebacks against a stale price. That's not a small exception, that's the run contradicting an approved control. It should stop someone in their tracks.

### 3.5 A saved shortcut that's now reading the wrong column

This is the quiet one. The source data moves, and the old logic keeps happily running against a layout that no longer exists.

> Acme switches accounting systems. The `amount` column shifts one spot and the `company` field gets renamed. The old setup keeps reading the old positions, so every check comes back green while it's validating the wrong data. The right behavior here isn't to stay quiet, it's to notice the structure changed and say so.

The thread running through all five: the signal lives between runs, across workflows, or over time, and no single run is looking there.

---

## 4. Who it's for

- **Analysts and preparers** want a heads-up when this run looks off compared to the last one, without having to dig for it.
- **Reviewers and managers** want the cross-run and cross-workflow risks handed to them, and they want to be sure nothing became a rule without a sign-off.
- **Engagement leads** want one place that rolls up the biggest risks and drifts across the whole engagement.

Insights serves all three at different altitudes. Same engine underneath, different views on top.

---

## 5. What we're doing, and what we're not

**We are:**
- Surfacing patterns a single run can't see, across runs, workflows, entities, and time.
- Giving every insight a full evidence trail that holds up in a review.
- Letting a human accept, scope, or dismiss each one.
- Making sure an approved insight actually changes how future runs behave.

**We are not, at least not in v1:**
- Fixing anything automatically. Insights recommend. A person decides and acts.
- Predicting numbers we haven't seen. The model explains the evidence it's handed. It doesn't forecast.
- Learning across different customers. Everything stays inside one customer's perimeter.
- Doing chat memory. That's the Memory product, and it's a separate doc.

---

## 6. What an insight actually is

An insight is a scored, evidence-backed pattern that's worth someone's attention. It's not a raw exception, that's just a workflow output. And it's not a throwaway observation. It's the thing you'd want a sharp senior reviewer to walk over and tell you about.

Every insight carries six parts:

1. **Title.** The finding in one plain sentence. "MCKESSON drives 78% of this run's pricing exceptions."
2. **Severity.** High, Medium, or Low.
3. **Reasoning.** Why the engine thinks this matters.
4. **Evidence.** The actual runs, rows, entities, and KPI values behind it. Clickable, traceable, no hand-waving.
5. **Recommended action.** What to do about it.
6. **Confidence.** A score from 0 to 1, with the factors that drove it.

### The ten patterns we detect

| Severity | Pattern | What it means |
|---|---|---|
| High | Recurring Output Anomaly | The same entity is flagged across several runs of one workflow |
| High | KPI Trend Drift | A KPI keeps moving one direction across consecutive periods |
| High | Cohort Anomaly | An entity keeps deviating from its peer-group baseline |
| High | Cross-Workflow Correlation | The same entity turns up in two unrelated workflows |
| High | Memory Conflict | A new run contradicts a fact the team already approved |
| Medium | Schema Decay | Structural mismatches are climbing, usually a source-system change |
| Medium | User Override Pattern | People keep dismissing the same warning, so the rule may be stale |
| Medium | Emerging Trend | A metric that's been flat for months just jumped |
| Low | Workflow Efficiency Gap | A workflow keeps kicking off manual follow-ups |
| Low | Distribution Engagement Gap | Nobody ever acts on an output we keep sending |

---

## 7. Where insights show up

Insights appears at three places on the platform, from a single run all the way up to the whole engagement.

**Workflow Executor (this run against its own past).** When you're looking at a run's results, Insights tells you what's changed and what memory knows about the entities in front of you. Three things live here:

- *Output compare.* This run versus the previous run of the same workflow. What's new, what got resolved, how the headline KPIs moved.
- *Cross-workflow correlation.* For an entity in this run, what else it's tangled up in elsewhere. "MCKESSON is also flagged in Contract Compliance Review, and it's on a standing watch."
- *Cost saving on unchanged reruns.* When the inputs match a known-good prior run, most of the work replays without re-paying full compute, and we show the saving.

**Business Process (the AI Insights tab).** This is the cross-run brain, and it's the heart of the feature. It watches all the workflows inside a process and surfaces the risks and patterns and the KPI drifts that only make sense when you look across runs. Problems 3.1, 3.2, and 3.3 get caught here.

**Engagement Overview (the rollup).** The partner's view. The highest-severity, highest-confidence insights pulled up across the whole engagement, so a lead can see the systemic picture without opening every process.

---

## 8. How the engine works

The engine kicks off after every workflow run. The design rule behind the whole thing: let the LLM do the one thing it's genuinely best at, which is writing a clear explanation, and let deterministic code do everything else. That's what keeps insights traceable and defensible.

Here's the flow, start to finish:

1. **Read the run.** Pull every signal from the run that just finished: KPI values, validation results, timings, override decisions.
2. **Normalise the signals.** Get them into a common shape so runs from different workflow types can be compared.
3. **Resolve entities.** Make sure "Apex Supplies" in one run is understood as the same "Apex Supplies" in another. Without this step, nothing correlates.
4. **Detect patterns.** Deterministic rules plus a sliding window across recent runs produce the ten pattern types.
5. **Correlate.** Join across workflows, entities, and time. This is where the cross-run and cross-month signals get built.
6. **Score confidence.** A formula, covered below. No model involved.
7. **Explain.** This is the only LLM call in the whole pipeline. The model gets the finished evidence bundle and turns it into a readable title, description, and recommended action. It can only describe what it was handed, so it can't invent a number that isn't in the evidence.
8. **Package the insight.** Assemble the full object with its evidence, score, and severity.
9. **Ask a human.** The reviewer approves, scopes, or dismisses it.

Because steps 1 through 6 and 8 are plain deterministic code, every insight can be reproduced from its inputs and defended in a regulatory review. The model shows up once, at the end, to write the words.

---

## 9. How confidence and severity work

**Confidence** is a score from 0 to 1, and it's a product of four factors, each also 0 to 1:

- **Frequency.** How often the signal repeats across runs.
- **Source diversity.** How many distinct runs, workflows, and entities back it up.
- **Recency.** How fresh the supporting evidence is.
- **Business impact.** The dollars or risk at stake.

Multiply them together and you get the confidence value. A finding needs to clear a floor (0.45 in the current build) to be worth surfacing as an insight rather than sitting as a raw exception.

One honest wrinkle worth keeping: a strong single-run finding, like one vendor driving 78% of this run's exceptions, matters a lot even though it hasn't recurred yet. For those, the engine can carry a scored override so a genuinely important one-run concentration surfaces, but we show it as exactly what it is: a within-run concentration, not a proven multi-month trend. No fake sparklines.

**Severity** (High, Medium, Low) is about how much it should interrupt you. It's tied to the pattern type by default (a Memory Conflict is High, a Distribution Engagement Gap is Low), but confidence and business impact can bump it.

---

## 10. The human gate, and what "acting on it" means

Nothing an insight suggests happens on its own. Every insight lands in front of a reviewer with three choices:

- **Approve.** You agree, and the finding becomes a standing rule the platform applies to future runs.
- **Scope.** You agree but narrow it, or you set an expiry. "This applies to contract HPG12 only," or "revisit this by the end of Q3." This keeps an approved fact from over-reaching.
- **Dismiss.** Not now. It goes away, but it isn't gone for good. If the signal gets stronger over later runs, the engine can bring it back. And if people keep dismissing the same thing, that repeated dismissal is itself a pattern we flag, because it usually means the underlying rule is stale.

Every one of these decisions is written to an audit trail that can't be edited after the fact. Who decided what, and when.

> Where this touches Memory: an approved insight becomes a governed fact that future runs read from. That shared, org-wide context is technically part of the Memory system. For this PRD, the boundary is clean: Insights is responsible for detecting the pattern, surfacing it, and capturing the human decision. What happens to the fact after approval is Memory's job.

---

## 11. Open questions

These are the real ones, the parts I don't think we've settled yet.

- **Per-pattern thresholds.** A single 0.45 floor across all ten patterns is too blunt. A Memory Conflict should surface at a lower bar than a Distribution Engagement Gap. We need a per-pattern qualification threshold, and I don't know the right numbers yet.
- **How aggressive Schema Decay should be.** This is the Acme trap from 3.5. If we're too twitchy we cry wolf on every minor structural change. If we're too relaxed, everything shows green while we validate the wrong column. Where's the line?
- **Fighting alert fatigue.** If we surface every Low-severity insight, reviewers stop reading. What's the default surfacing policy? My instinct is High always shows, Medium gets batched, Low is available on demand, but that's a guess.
- **Who arbitrates a Memory Conflict, and how fast.** When a run contradicts an approved fact, someone has to decide which one wins, quickly. What's that path?
- **Review cadence for approved facts.** Approved insights shouldn't live forever unquestioned. What's the default review-by date, and who owns the review?

---

## 12. How we'll know it worked

| What we want | How we'll measure it |
|---|---|
| Real risks surfaced | Number of High-severity insights approved that a single run would have missed |
| Trust in the evidence | Percent of insights with a complete, clickable evidence trail (target 100%) |
| Reviewers actually use it | Approval, scope, and dismiss rates at the gate, and how often dismissed items rightly come back |
| It changes future runs | Percent of active engagements with at least one approved insight shaping later runs |
| It saves money on reruns | Percent of unchanged rerun work served without full recompute |

---

## 13. Rough phasing

**v1, surface and trust.** Insights live on all three platform surfaces. Full evidence trails. The human gate with approve, scope, and dismiss. Approved insights actually change future runs.

**v2, tune and scale.** Per-pattern thresholds. A real surfacing policy to keep fatigue down. The cost-saving path on unchanged reruns. A review-and-expiry workflow for approved facts.

**v3, get ahead of it.** Early warnings on emerging trends. Cross-workflow correlation suggested at plan time, before a run, not just after. Monitoring for insights that have gone stale.
