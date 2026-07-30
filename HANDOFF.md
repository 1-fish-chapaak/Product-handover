# Handoff — SOX Testing V2 sandbox (27 Jul 2026)

Untracked scratch file. Paste the block below into a new session as-is; the
rest of the file is the detail it points at.

---

## Prompt for the new session

> Continue the SOX Testing V2 work on branch `feat/engagements-sox-v2`
> (uncommitted — do NOT commit unless I ask). Read `HANDOFF.md` at the repo
> root and the memory file `project_sox_testing_tab.md` first.
>
> The setup: the SOX Testing sidebar page has two tabs. "Programmes" is the
> classic flow — **never change its behaviour**. "V2 · Call-aligned" is an
> exact parity copy on its own store (`v2/` folder) where partner-call
> features get added **one numbered decision at a time, only when I name the
> number**. Decisions #1–#8 are applied, #9 was rejected, the #7 wizard card
> is commented behind `WS_CARD = false`. Remaining: #10 (tabbed programme
> page — the hinge that unlocks #11–#15), then #16 + #17.
>
> Gate every change on the full `npm run build` plus
> `npx playwright test tests/_verify_sox_v2_tab.spec.ts tests/_verify_sox_testing_tab.spec.ts`
> (run from the repo root). Ask clarifications one at a time.

---

## Where things stand

Branch **`feat/engagements-sox-v2`**, working tree **dirty on purpose** —
nothing from this round is committed. `origin/main` (`fc1e9f1`) is already
merged in; a fetch on 27 Jul confirmed there is nothing new to pull.

Modified (tracked): `SoxTestingView.tsx`, `soxTestingData.ts` (type-only
touches), `shared/FilterSelect.tsx` (+`HeaderFilter`), `sox-icfr/ControlDossier.tsx`,
`sox-icfr/ControlRegister.tsx`.
New (untracked): `src/components/audit/sox-testing/v2/` (the whole sandbox),
`tests/_verify_sox_v2_tab.spec.ts`, this file, misc `_capture_*/_design_review_*`
scratch specs from older sessions.

## The V2 sandbox

`SoxTestingView.tsx` = sidebar page, 2-tab strip. Classic tab renders
`SoxTestingTab` untouched. V2 tab renders `v2/V2Tab.tsx` — a clone wired to
its **own store** so nothing leaks:

- `v2/v2ClassicStore.ts` — Altura Infra 8-entity seed (27 captions,
  `V2C_GROUP_SHARE` share-of-group map, `V2C_ITGC_SYSTEMS`, `V2C_PEOPLE`),
  registers live engagement `sox-v2-fy26`, exports `V2C_PROGRAMMES`.
- `v2/V2ScopingWizard.tsx` — **the** fork where wizard decisions land; header
  comment lists them. 8 steps: Type & basics → Materiality → Entities → TB →
  Qualitative → Mapping → People → Review.
- Parked, unwired, must keep compiling: `v2/v2Data.ts`, `v2/V2Wizard.tsx`,
  `v2/V2ProgrammeView.tsx`, `v2/TestBench.tsx` — the full call-aligned build
  from Jul 23, mined per decision. Don't delete, don't rewire unprompted.
  (Importing `v2Data.ts` anywhere live re-registers `sox-v2-fy26` over the
  parity seed — copy data out instead, as was done for ITGC/people.)

## Decision ledger

| # | State | Where |
|---|---|---|
| 1 | ✅ Materiality before entities | step order in the fork |
| 2 | ✅ PM is THE scoping threshold (`pmCr` everywhere, ladder emphasises PM) | fork + seed flags at ₹9 Cr |
| 3 | ✅ % of net assets basis (5th card; classic `MaterialityBasis` union widened, type-only) | `V2_BASIS_OPTIONS` |
| 4 | ✅ Entity scope DERIVED (TB clears PM → in) | `entityScope` memo, TB-step verdict panel |
| 5 | ✅ Coverage rule 60% — largest remaining share pulled in (Roadways on defaults → 71%) | same memo; amber pills |
| 6 | ✅ Qual pick pulls its whole entity (Metering) | same memo; "Pulls X into scope" chip |
| 7 | ✅ built, then **commented out** behind `const WS_CARD = false` — no workstream card, wizard derives process RACMs only (3 on defaults); `beyondTb` ids still store so the summary modal's workstream strip stays | flag at top of fork |
| 7b | ⛔ upload-RACM chips + add-a-system: built on ask, then reverted same day — don't re-add |
| 8 | ✅ People step (PO + CO per RACM, prefilled from `V2C_PEOPLE`, both required) | step 6 in the fork |
| 9 | ⛔ REJECTED — type tiles stay (tool hosts other engagement types) |

TB step extras (user-driven): entity **list rows** (not cards), **Bulk upload
TBs** header button (auto-maps by name; `asm-tb-fy27.xlsx` deliberately
mismatches → inline amber "Map …" chip on rows missing a TB — no separate
error section), per-entity upload buttons as fallback.

## Pending decisions

- **#10 tabbed programme page** — card click lands on a V2-native tabbed page
  instead of jumping straight to the shared workspace. The hinge: #11
  (Dec/Mar calendar + Remediation phase), #12 (status strip), #13 (re-scope),
  #14 (key/financial flags), #15 (auditor lens) all render on it.
- **#16 evidence-chase board** (needs #8 ✅ + #10), **#17 test bench** (rides
  on #16). Parked implementations exist for all of these.
- Visual map artifact: https://claude.ai/code/artifact/7aae3529-0def-4336-b3d3-66c5ca33de5a

## Shared-workspace touches (affect classic too — all user-instructed)

- `ControlDossier.tsx`: inline "← Back" removed (breadcrumb arrow is the only
  Back — several dossier specs assert exactly ONE 'Back' button).
- `ControlDossier.tsx` RequestDataModal: "Send request" fires a success toast
  naming the recipient(s).
- `ControlRegister.tsx`: toolbar Status/process/nature dropdowns **commented
  out**; filtering moved into table column headers via new shared
  `HeaderFilter` (menu portals to body — `.reg-wrap` clips). Card view is
  search-only now (accepted trade-off).

## Verify

```
npm run build        # full tsc -b && vite build — the merge gate
npx playwright test tests/_verify_sox_v2_tab.spec.ts tests/_verify_sox_testing_tab.spec.ts
npx playwright test tests/_verify_sox_testing_runs.spec.ts   # workspace journeys
```

Run from the **repo root** (a stray `cd` once broke test discovery). Specs
import from `./_helpers` (auto-clicks the login gate). Screenshots land in
`$CLAUDE_JOB_DIR/tmp/sox-v2-shots`. Known-stale specs (fail by design):
`_sox-review-notes`, `_verify_countersign_confirm`, `_sox-golive`.

## Ground rules

- Classic flow behaviour is untouchable; the only permitted classic touches so
  far are type-only (`MaterialityBasis` union, `DerivedRacm` optional fields).
- Features come back one numbered decision at a time, on instruction only.
- Commit/push only when asked. Merge conflicts → stop and list them.
- Memory file `project_sox_testing_tab.md` is the running source of truth —
  keep it updated after each decision.
