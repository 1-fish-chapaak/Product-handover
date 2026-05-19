# Collaborator Guide — hackathon-prototype

Multiple pods (teams) work on this repo in parallel, each from their own
Claude Code CLI session, pushing directly to `main`. The risks are NOT
technical (this is a mocked-data demo) — the risks are **stepping on each
other's design**, **building the same thing twice**, and **breaking the
shared user flow**. The Claude preflight catches all three before you push.

This guide is also designed to be pasted into a fresh Claude Code session —
see the [Appendix](#appendix--paste-this-into-a-fresh-claude-code-session).

---

## 1. What this repo is

- **Stack:** React 18 + TypeScript + Vite. Frontend-only, all data mocked in `src/data/mockData.ts`.
- **Repo:** https://github.com/tech-irame/hackathon-prototype
- **Live URL:** https://hackathon-demo-ujihgyhrpa-uc.a.run.app
- **Branch model:** **direct push to `main`**. Every push auto-deploys to Cloud Run in ~2 min.
- **Don't touch:** the production stack at `auditify.platform.irame.ai`.

---

## 2. One-time setup

### 2.1 Tools

```bash
# macOS
brew install git gh node@22

# Claude Code CLI (required for the preflight review)
npm install -g @anthropic-ai/claude-code
claude --version

# Auth Claude CLI to your account (one-time)
claude          # opens browser to log in
```

### 2.2 GitHub access

```bash
gh auth login                    # GitHub.com → HTTPS → browser
gh auth status                   # confirm
```

You need write access to `tech-irame/hackathon-prototype`. Ask the repo owner if `git push` is rejected.

### 2.3 Clone and bootstrap

```bash
git clone https://github.com/tech-irame/hackathon-prototype.git
cd hackathon-prototype
npm install
npm run setup-hooks         # ★ enables the Claude preflight on git push
```

`setup-hooks` configures `core.hooksPath=.githooks` so the pre-push hook runs
the preflight every time you `git push`. Run it once per clone.

### 2.4 Run locally

```bash
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
npm run lint
```

---

## 3. The pod workflow

### 3.1 The full loop

```
┌──────────────────────────────────────────────────────────────────┐
│  in your Claude CLI session, in the repo                         │
└──────────────────────────────────────────────────────────────────┘
            │
            ▼
   pull main, make changes, commit
            │
            ▼
   git push                                 ←── pre-push hook fires
            │
            ▼
   ┌────────────────────────────────────┐
   │  AUTO-REBASE                       │
   │  fetch origin/main, pull --rebase  │
   │  (only if you are behind)          │
   └────────────────────────────────────┘
            │  (stops on conflict — you resolve, then `git push` again)
            ▼
   ┌────────────────────────────────────┐
   │  MULTI-PAGE GATE                   │
   │  if diff spans 2+ pages:           │
   │  prompt "YES <reason>"             │
   │  (or bypass with MULTI_PAGE_OK=…)  │
   │  aborts push without a reason      │
   └────────────────────────────────────┘
            │
            ▼
   ┌────────────────────────────────────┐
   │  CLAUDE PREFLIGHT REVIEW           │
   │  · design conflicts vs main        │
   │  · feature redundancy              │
   │  · UX / flow gaps                  │
   │  multi-page → stricter rubric      │
   │   (per-page diff, cross-page       │
   │    conflicts, intent check)        │
   │  (~30-60s, advisory, never blocks) │
   └────────────────────────────────────┘
            │
            ▼
   push completes → GitHub
            │
            ▼
   .github/workflows/deploy.yml runs
            │  (any in-flight older deploy is cancelled —
            │   the newest commit always wins)
            ▼
   Cloud Run hackathon-demo updated   ~2 min total
            │
            ▼
   https://hackathon-demo-ujihgyhrpa-uc.a.run.app
```

### 3.2 The preflight, in detail

When you `git push`, the hook runs `tools/preflight-review.sh`, which does
three things in order:

**Step 1 — auto-rebase.** Fetches `<remote>/main` and, if your local main is
behind, runs `git pull --rebase --autostash` to stack your work on top of
whatever other pods pushed. If the rebase is clean, the script keeps going.
If the rebase hits a conflict, the script aborts the push with instructions:
resolve the markers, `git add`, `git rebase --continue`, then `git push` again.

**Step 2 — multi-page hard-review gate.** Every sidebar nav entry counts as
one **page**. If your push touches **2+ pages**, the script BLOCKS and asks
for a one-line reason before continuing. This catches the single biggest
cause of pod friction: one team's "cleanup" silently breaks another team's
page (dropped columns, moved tabs, restyled shared components, etc.).

The pages the script recognizes (mapped from `src/components/` paths):

| Page | Sourced from |
|---|---|
| Ask IRA | `chat/` |
| Home | `home/` |
| Recents | `recents/` |
| Planning | `audit/AuditPlanning*`, `audit/AuditExecution*` |
| Process Hub | `audit/BusinessProcesses*` |
| Risk Register | `audit/RiskRegister*` |
| Control Library | `governance/`, `execution/` |
| Dashboard | `dashboard/` |
| Report | `reports/` |
| Workflow Library | `workflow/` |
| AI Concierge | `intelligence/`, `concierge-workflow-builder/` |
| Knowledge Hub | `knowledge/`, `data-sources/` |
| Admin | `admin/` |

Everything else (`shared/`, `sidebar/`, `modals/`, `artifacts/`, `hooks/`,
`data/`, `index.css`, `App.tsx`, configs) is treated as a **shared surface**
— it's still reviewed, but does NOT count toward the page total. So a
single-page polish commit that also tweaks `shared/StatusBadge.tsx` still
counts as one page.

When the gate fires you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠  MULTI-PAGE PUSH — hard review required (3 pages)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • AI Concierge
      src/components/concierge-workflow-builder/GuideMeModal.tsx
  • Report
      src/components/reports/ReportsView.tsx
  • Workflow Library
      src/components/workflow/WorkflowTemplates.tsx

This push touches 2+ pages — exactly the kind of change that silently
breaks another pod's work …

To continue, type:   YES <one-line reason>
  e.g.   YES global typography sweep — coordinated with design

Proceed?
```

Type `YES <reason>`. Anything else aborts the push. The reason is forwarded
to the Claude reviewer so it can judge whether every affected page really
matches your stated intent (and flag collateral-damage pages).

If you can't prompt interactively (CI, scripts, agents), set:

```bash
MULTI_PAGE_OK="<one-line reason>" git push
```

`MULTI_PAGE_OK` must be a **non-empty** string — an empty value does not
bypass the gate.

**Step 3 — Claude review.** Calls the Claude CLI with a prompt focused on
**three axes only**:

1. **Design conflicts** — new colors / typography / spacing / card patterns
   that contradict the established bento + charcoal + purple-accent system.
2. **Feature redundancy** — building something already in `src/`. Two views
   for the same job, parallel mock-data shapes for the same entity, duplicate
   component logic.
3. **UX / flow gaps** — dead-end states, broken back button, "two screens
   with the same name doing different things", CTAs that lead nowhere.

For **multi-page** pushes (after the Step 2 gate), the Claude reviewer uses
a **stricter rubric** that additionally demands:

- A per-page **Added / Modified / Dropped** list (user-visible language only
  — no code, no class names, no LOC counts).
- An explicit **cross-page conflicts** section (same pattern diverging
  across two pages, moved features without redirects, global CSS that
  unintentionally restyles a page you didn't mention, dropped elements still
  linked from elsewhere, etc.).
- An **intent check** against the `YES <reason>` you typed: every affected
  page is marked ✓ (matches reason), ⚠  (looks like collateral damage),
  or 🚨 (contradicts the reason).
- A final **verdict**: ✅ Coordinated · ⚠  Mixed · 🚨 HARD STOP recommended.

**Explicitly NOT raised** (both rubrics): perf, scaling, type-nits, tests,
"best practices", refactor suggestions, accessibility-unless-broken, security.
This is a demo.

The output appears directly in your terminal. For single-page pushes the
review is **advisory only** (push always proceeds). For multi-page pushes
the Step 2 gate is a hard block, but the Step 3 review remains advisory —
if the reviewer returns 🚨 HARD STOP RECOMMENDED, it's on you to abort and
fix, or to push anyway with `SKIP_PREFLIGHT=1` on the next attempt.

### 3.3 Skipping the preflight

For a doc-only commit or an emergency fix (skips **all three steps** —
rebase, multi-page gate, and Claude review — you become responsible for
rebasing yourself):

```bash
SKIP_PREFLIGHT=1 git push
```

Bypass **only** the multi-page gate (still rebases + runs the stricter
Claude review) — useful for planned coordinated sweeps:

```bash
MULTI_PAGE_OK="editorial token sweep — coordinated in #hackathon-pod" git push
```

Or run the Claude review on demand without pushing (no rebase, no gate):

```bash
npm run review:local
```

### 3.4 Daily commands

```bash
# pull latest
git checkout main && git pull origin main

# work locally — your Claude CLI does the editing
# ... commits with `git commit -m "feat: ..."` ...

# push (preflight runs automatically)
git push
```

That's the whole flow. **No PRs, no branches, no waiting** — just commit + push.
Pods that want extra eyes can still open a PR (see §4) and the same review
runs there as a comment.

### 3.5 Commit style

Short imperative subject, optional body explaining *why* (not *what* — the diff
shows what):

```
feat: add risk register inline filter chip
fix: sidebar collapse no longer hides the Settings link
chore: bump rive-app to 4.27.3
docs: clarify preflight skip in CONTRIBUTING
```

Prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.

---

## 4. Optional: opening a PR

You don't need to, but if you want a second opinion before merging:

```bash
git checkout -b your-name/short-description
# ... commits ...
git push -u origin HEAD
gh pr create --fill
```

The same Claude review runs as a PR comment via `.github/workflows/claude-review.yml`.
Merging the PR to `main` triggers the deploy.

You can re-run the review on a PR by commenting `@claude` in the PR thread.

---

## 5. The pipeline files

| File | Purpose | Triggers when |
| --- | --- | --- |
| `tools/preflight-review.sh` | Auto-rebase onto remote main, gate multi-page pushes behind a typed-reason prompt (or `MULTI_PAGE_OK=...`), then run the focused Claude review (design / redundancy / UX — strict rubric when multi-page). Aborts on rebase conflict, aborts if a multi-page push has no reason. | You run `git push` (after `npm run setup-hooks`) — or `npm run review:local` (review only, no rebase, no gate) |
| `.githooks/pre-push` | Calls the preflight from git's hook system | Same |
| `.github/workflows/deploy.yml` | Build Docker → push to Artifact Registry → deploy to Cloud Run. **`cancel-in-progress: true`** so a newer push kills any in-flight older build — the live revision always matches the latest tip of main. | Push to `main` |
| `.github/workflows/claude-review.yml` | Same focused review, posted as PR comment | PR opened / `@claude` comment |
| `cloudbuild.yaml` | Manual `gcloud builds submit` config (not used by CI) | Only if you run it explicitly |
| `Dockerfile` + `nginx.conf` | Multi-stage node:22-alpine → nginx:alpine on :8080 | Used by deploy and cloudbuild |

### 5.1 Auth model (FYI, you don't need to touch it)

GitHub Actions auths to GCP via **Workload Identity Federation** — no service
account keys exist anywhere. Only repos under `tech-irame` can use the
deploy SA `gh-actions-deploy@gen-lang-client-0250661731.iam.gserviceaccount.com`.

The Claude PR reviewer auths via the `CLAUDE_CODE_OAUTH_TOKEN` repo secret.

---

## 6. Verifying / debugging

```bash
# what's the latest deploy doing?
gh run list --repo tech-irame/hackathon-prototype --limit 5
gh run watch --repo tech-irame/hackathon-prototype

# is the live site up?
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://hackathon-demo-ujihgyhrpa-uc.a.run.app/

# (requires gcloud) what revision is live?
gcloud run services describe hackathon-demo \
  --region us-central1 --project gen-lang-client-0250661731 \
  --format="value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)"
```

Roll back via Cloud Run revisions:

```bash
gcloud run revisions list --service=hackathon-demo --region=us-central1 --project=gen-lang-client-0250661731
gcloud run services update-traffic hackathon-demo \
  --to-revisions=hackathon-demo-00001-xyz=100 \
  --region=us-central1 --project=gen-lang-client-0250661731
```

---

## 7. Common gotchas

- **You skipped `npm run setup-hooks`.** No preflight ran on your push. Re-run it once per clone.
- **Don't commit `node_modules/`, `dist/`, or `.serena/`.** All in `.gitignore`. Use `git add <specific files>`, not `git add .`.
- **Don't add real API keys.** Mocked-data demo only. No `.env`, no secrets.
- **The deploy auto-fires on every main push, including doc-only changes.** That's fine (Docker build is fast and cached) but be aware. If two pushes race, the older deploy is **cancelled mid-flight** so the newest commit wins.
- **Two pods edit the same file → real git merge conflict.** The preflight tries to rebase you onto remote main automatically. If the rebase is clean, your push proceeds. If it conflicts, the push aborts with a message telling you to fix the markers, `git add`, `git rebase --continue`, then `git push` again (the hook runs once more on the merged result). To bail: `git rebase --abort`.
- **Preflight told you about a conflict — what now?** Talk to the other pod in your team channel before fixing forward. The whole point of the review is to surface coordination issues you'd otherwise discover at demo time.
- **Multi-page push got blocked.** You touched 2+ sidebar pages in one push and didn't supply a reason. Type `YES <one-line reason>` at the prompt, or re-push with `MULTI_PAGE_OK="<reason>" git push`. If you honestly don't have a cross-page reason, that's the signal — split the push into per-page commits. See §3.2 for the page list.
- **Multi-page reviewer came back 🚨 HARD STOP.** The stricter Claude rubric thinks one of the pages you touched is collateral damage (you didn't mean to change it). Read the "Intent check" section of the output — it'll name the offending page and say what incidentally changed. Most common causes: global CSS / shared component change that restyled a page outside your stated reason, or a file you opened in the editor and saved without meaningful edits.

---

## 8. Style rules

### 8.1 Typography scale

Use **only these five sizes**. Floor is 12px — nothing smaller, ever. Prefer `rem` so type scales with the user's root font setting.

| Token | px | rem | Use for |
| --- | --- | --- | --- |
| `xs` | 12 | `0.75rem` | Captions, bylines, meta, eyebrow labels, dense table cells |
| `sm` | 14 | `0.875rem` | UI chrome, buttons, form labels, secondary body |
| `base` | 16 | `1rem` | Primary body, AI assistant prose, paragraph content |
| `lg` | 20 | `1.25rem` | Section headings, page subtitles |
| `xl` | 24 | `1.5rem` | Page titles, hero headings |

**Rules:**

- No arbitrary sizes (`text-[13px]`, `text-[13.5px]`, `text-[15px]`, `text-[11.5px]`, etc.). Pick the nearest token and snap to it.
- No values below `0.75rem` / 12px — they fail readability and accessibility even when they pass contrast.
- Tailwind tokens map: `text-xs` (0.75rem), `text-sm` (0.875rem), `text-base` (1rem), `text-xl` (1.25rem), `text-2xl` (1.5rem) — these match the table above. **Do not use `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]`, `text-[17px]`** etc.
- For inline styles (rare — prefer Tailwind), use `fontSize: '0.875rem'` not `fontSize: '14px'`.
- When porting old code, snap up rather than down: `13px → 14px`, `15px → 16px`, `11px → 12px`. Don't snap user content prose below `1rem`.

If you genuinely need a sixth size, add it to this table first. PR description must justify why the existing five don't work.

### 8.2 Radius scale

Use **only these radius tokens**. Map to Tailwind classes directly — never inline `rounded-[..px]`.

| Token | px | Tailwind | Use for |
| --- | --- | --- | --- |
| `md` | 6 | `rounded-md` | Inline icon buttons, dense table cells |
| `lg` | 8 | `rounded-lg` | Standard buttons, form inputs, small cards |
| `xl` | 12 | `rounded-xl` | Larger buttons, panels, composer wrapper, primary cards |
| `2xl` | 16 | `rounded-2xl` | Message bubbles, large surfaces, modal corners |
| `full` | — | `rounded-full` | Pills, chips, avatars |

When nesting: **inner radius ≤ outer radius**. Composer is a known instance — `.ai-border` is `--radius-xl` (12px), so the inner panel is `rounded-xl`, not `rounded-2xl`.

### 8.3 Buttons

Use the shared `Button` from `src/components/shared/Button.tsx`. Don't roll bespoke buttons in chrome surfaces (chat, sidebar, modals, headers, composers). The variants/sizes below cover every case in the active chat and sidebar.

**Variants:**

| Variant | When to use |
| --- | --- |
| `primary` | The main action on a surface (Send, Confirm). One per visible surface. |
| `secondary` | Companion to primary (Cancel, dismiss). Neutral fill. |
| `outline` | Side actions on white backgrounds (New chat, secondary CTAs). Bordered. |
| `ghost` | Toolbars, icon strips, hover-revealed actions. Transparent until hover. |
| `destructive` | Irreversible (Delete, Sign out). Risk red. |
| `stop` | In-flight cancel (e.g. stop generating). Ink-900 filled. |

**Sizes:** `sm` (28px / `text-xs`) for toolbars and dense rows · `md` (36px / `text-sm`) for primary CTAs and composer.

**Shapes:** default `lg` (8px). Use `xl` for the composer send button, `full` for pills.

**Toggles:** pass `pressed={boolean}`. The Button switches to a pressed visual on ghost/outline variants. Always also set `aria-pressed`.

**Icon-only:** pass `iconOnly` and an `aria-label`. The button becomes a square (28 / 36px) with no horizontal padding.

```tsx
<Button variant="primary" size="md" leftIcon={<Send size={16} />}>Send</Button>
<Button variant="ghost" size="sm" iconOnly aria-label="Copy"><Copy size={14} /></Button>
<Button variant="ghost" size="sm" iconOnly pressed={liked} onClick={...}><ThumbsUp size={14} /></Button>
```

### 8.4 Gradients

Reserve **`bg-gradient-*` for AI affordances only**:

- The AI avatar in the chat thinking state (the purple→brand sphere with `Sparkles`).
- The sidebar brand mark / logo block.

Everything else uses solid colors (`bg-primary`, `bg-brand-50`, `bg-paper-100`, …). Gradients elsewhere drain the AI-avatar's signaling value and read as Web-2.0 brand noise. If you need depth, use `shadow-sm`, not a gradient.

### 8.5 Motion

Wrap meaningful animations in a `prefersReducedMotion = useReducedMotion()` guard from `motion/react`:

```tsx
const prefersReducedMotion = useReducedMotion();
<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
/>
```

Applies to: message-enter animations, sidebar width transitions, modal opens, scroll-to-bottom pill. Decorative micro-pulses (a 1.5px dot bouncing) can stay — they don't trigger vestibular issues.

---

## Appendix — paste this into a fresh Claude Code session

> I'm working on the **hackathon-prototype** repo (cloned locally, you're already in it).
>
> **Stack:** React 18 + TypeScript + Vite. Frontend-only. All data mocked in `src/data/mockData.ts` — no backend, no real API calls, no secrets.
>
> **Pod workflow:** multiple teams push directly to `main` from their Claude CLI sessions. No PRs required. Every push to `main` auto-deploys to Cloud Run in ~2 min.
>
> - Repo: https://github.com/tech-irame/hackathon-prototype
> - Live URL: https://hackathon-demo-ujihgyhrpa-uc.a.run.app
> - GCP project: `gen-lang-client-0250661731` · region `us-central1` · service `hackathon-demo`
>
> **Pre-push preflight (already enabled if `npm run setup-hooks` was run):** when you `git push`, `tools/preflight-review.sh` runs three things in order. **(1) Auto-rebase** onto remote main if you are behind (aborts on rebase conflict so you resolve manually). **(2) Multi-page hard-review gate:** if the diff spans 2+ sidebar pages (Home, Recents, Ask IRA, Planning, Process Hub, Risk Register, Control Library, Dashboard, Report, Workflow Library, AI Concierge, Knowledge Hub, Admin), the push is **blocked** until you type `YES <one-line reason>` at the interactive prompt — or pass `MULTI_PAGE_OK="<reason>" git push` (non-empty reason required). Shared files (`shared/`, `sidebar/`, `modals/`, `hooks/`, CSS, configs) don't count toward the page total. **(3) Claude review** focused on **design conflicts**, **feature redundancy**, and **UX/flow gaps** — advisory only; never blocks the push. Multi-page pushes get a **stricter rubric** that demands per-page Added/Modified/Dropped, cross-page conflicts, and an intent check against your typed reason. Skip everything with `SKIP_PREFLIGHT=1 git push`. Run review on demand with `npm run review:local` (no rebase, no gate). The deploy workflow is set to **`cancel-in-progress: true`** so a newer push always wins — the live revision matches the latest tip of main.
>
> **Review priorities (mirror these in your own thinking before pushing):**
> 1. Design conflicts — does this contradict the existing bento / charcoal / purple-accent design system? Different colors/typography/spacing/shapes from what's already in `src/components/`?
> 2. Feature redundancy — does this duplicate something already in `src/`? Same view, same data shape, parallel navigation path?
> 3. UX / flow gaps — can the user enter this state and not exit? Does navigation contradict the existing app pattern? Dead-end CTAs?
>
> **Explicitly DO NOT optimize for:** performance, bundle size, test coverage, type strictness, error handling, refactoring, accessibility-unless-broken, security. This is a throwaway demo.
>
> **Conventions:**
> - Branch off `main` if you want a PR; otherwise commit directly to `main` and push.
> - `git add <specific files>`, not `git add .`. Don't commit `node_modules/`, `dist/`, `.serena/`.
> - Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`. Imperative subject, optional body explaining *why*.
> - Run `npm run lint` and `npm run build` before pushing.
> - Read `CONTRIBUTING.md` for the full workflow.
>
> **My task:** <describe what you want to do>
