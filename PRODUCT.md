# Product

## Register

product

## Users

Internal auditors at irame dogfooding the Auditify Chat prototype on real audit work — asking data questions of their evidence and building re-runnable workflows that codify recurring checks.

Context when using it: mid-engagement, often with deadlines, switching between thinking ("what is this data telling me?") and operationalizing ("turn that question into a workflow we can run every quarter"). They are domain experts, not chat-app novices — comfort with Claude / Notion AI / ChatGPT is assumed.

The job to be done: get from a question or an intent to a trustworthy, citable, re-runnable artifact without learning two products and without losing the thread.

## Product Purpose

A single conversational surface where an auditor can either **ask a data question** or **build a re-runnable workflow** — without context-switching between an ask interface and a workflow builder. The chat thread is shared; the right-side workspace swaps components based on intent (Query Plan → Coder → Reference, or Workflow Plan → Input → Output → Result Preview). A query can be promoted to a workflow mid-thread.

Success looks like: real irame auditors using this for real work, surfacing real friction, and producing artifacts (queries, workflows, evidence trails) they keep. Not a sales demo. Not a sandbox.

## Brand Personality

Editorial · confident · calm.

**Conversation fluency from Claude / Notion AI / ChatGPT.** Streaming responses, edit-to-rerun, attachments via `+`, citations as inline chips, predictable turn-by-turn rhythm. Auditors should feel at home in the chat itself within the first message.

**Product chrome distinct from any of them.** Source Serif 4 for moments of authority (hero, section headers, evidence quotes); Inter for the working surface; JetBrains Mono for code, IDs, and evidence excerpts. Purple brand anchor (`brand-600`) used with restraint; warm paper/ink neutrals; GRC semantic colors (`risk` / `high` / `mitigated` / `compliant` / `evidence`) intentionally tinted away from pure red/amber/green.

The voice is the voice of a senior auditor who has done this a thousand times: precise, unhurried, willing to show its work.

## Anti-references

- **Generic AI chat apps.** This is not a ChatGPT clone with our logo on it. The workspace canvas, not the message stream, is the deliverable.
- **Heatmap compliance dashboards.** No pure red/amber/green tile grids. No risk-rating thermometers.
- **Consumer-cute or playful.** No mascots, illustrative blobs, pastel gradients, or rounded-everything friendliness. These auditors are paid to be skeptical.
- **SaaS template aesthetic.** No hero-metric template (big number / small label / gradient accent), no identical card grids, no glassmorphism, no gradient text. These are absolute bans.
- **Loud or noisy AI chrome.** No glowing borders, no shimmer-while-streaming theatre, no aggressive "sparkle" iconography.

## Design Principles

1. **Workspace is the deliverable.** Chat is the entry point; the right-side artifacts (Query Plan, Coder output, Reference, Workflow tiles) are what the auditor takes away. Chat affordances should never out-shout the artifacts they produce. Visual weight, motion, and color all bias toward the workspace.

2. **Editorial confidence, not SaaS template.** Source Serif for authority moments, Inter for the workspace, JetBrains Mono for evidence. Type carries the brand. No hero-metric card grids, no gradient text, no glassmorphism. When in doubt, set it in serif and give it room.

3. **Show the reasoning.** Every AI output exposes its plan, code, sources, and assumptions inline. Citations are first-class, clickable, and lead to the underlying evidence. The auditor must be able to audit the auditor — this is the table-stakes trust contract for the category.

4. **GRC semantics, not generic.** `risk` / `mitigated` / `compliant` / `evidence` are first-class colors and concepts, never reduced to red/amber/green. Severity is editorial, not thermometric. The palette is a vocabulary, not a heatmap.

5. **Familiar chat, distinctive product.** Conversation patterns mirror Claude / Notion AI / ChatGPT — streaming, edit-to-rerun, attach via `+`, citations as chips. Surface, hierarchy, and chrome do not. Auditors get the chat for free and the product as a payoff.

## Accessibility & Inclusion

**Target: WCAG 2.1 AA baseline across every surface; AAA on text contrast and primary task paths wherever it doesn't kill the editorial palette.** When AA and AAA conflict with the brand on a specific element, AA wins for non-essential decoration and AAA wins for body text, evidence excerpts, and any path the auditor must complete to finish their job.

- **Full keyboard navigation.** Every action reachable without a mouse. Visible focus rings on every interactive element, designed in (not browser defaults).
- **Motion is deliberate and modern.** Smooth, exponential ease-out (`ease-out-quart` / `quint` / `expo`), purposeful streaming and panel transitions. No bounce, no elastic, no decorative parallax. `prefers-reduced-motion` honored throughout — when on, animations don't disappear, they become instantaneous or very brief crossfades, never breaking the chat fluency.
- **Screen reader support.** Live regions for streaming responses, proper landmarks for chat thread vs. workspace, descriptive labels on citation chips and evidence links.
- **Color-blind-safe by default.** The GRC palette is already tuned away from pure red/amber/green; semantic state must never rely on color alone — pair with icon, label, or position.
- **Density.** Auditors work long sessions on large monitors. Comfortable line lengths (65–75ch for body), generous spacing in the chat, denser-but-still-readable in the workspace tables.
