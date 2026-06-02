# In-drill detail pattern — spike comparison

Three working spike branches off `polish/process-hub-update-v2`. Same data, same chrome, three different ways to show a Risk's relationships when you click into it.

Where to look: **Process Hub → P2P → Risks → click any row** (try `RSK-001` — it has the most mapped controls + workflows).

## The 3 branches

| Branch | Pattern | What changes when you click a row |
|---|---|---|
| `spike/risks-drawer-pattern` | **Side drawer** | A 480px-wide panel slides in from the right. Table dims behind. Drawer shows risk details + 3 new sections: Mapped Controls, Linked Workflows, Found in RACMs. Close via X or backdrop. |
| `spike/risks-expand-row` | **Expand-row inline** | The clicked row expands in place. Three columns appear beneath it, side by side: Mapped Controls / Linked Workflows / RACMs. Multiple rows can be open at once. Chevron rotates. |
| `spike/risks-detail-page` | **Full detail page** | URL gains `?risk=RSK-001`. The table is replaced by a full page for that one risk: hero card with all 10 fields + description + Edit button, then 3 side-by-side relationship cards. Browser back returns to the list. |

## How to launch each

```bash
# Spike A — drawer
git checkout spike/risks-drawer-pattern
npm run dev

# Spike B — expand-row
git checkout spike/risks-expand-row
npm run dev

# Spike C — detail page
git checkout spike/risks-detail-page
npm run dev
```

Dev server runs on `localhost:5173` in all three.

## What to compare

| Question | Drawer | Expand-row | Detail page |
|---|---|---|---|
| How fast to peek at one risk? | Very fast — slides in over the table | Very fast — inline | Slower — full page transition |
| Can I compare two risks side by side? | No — drawer covers one at a time | Yes — expand both | No — one page at a time |
| Does the table stay visible? | Behind a dim overlay | Yes, partially | No, replaced |
| Easy to navigate via URL/back? | No — drawer is in-memory | No — expansion is in-memory | Yes — `?risk=X` is shareable + back works |
| Where do edits happen? | Edit button → nested drawer | Edit button → drawer | Edit button → drawer on detail page |
| Mobile / narrow screens? | OK (drawer fills width) | Awkward (3 columns squish) | Good (page reflows) |
| Discoverability of relationships? | Hidden until clicked | Visible as soon as you expand | Most prominent (own page) |

## What's the same across all 3

- The 3 relationship sections (Mapped Controls / Linked Workflows / Found in RACMs) use the same data joins
- Other 4 sections (SOPs, RACMs, Controls, Workflows) are untouched
- Dashboard, Needs Attention card, section pills, "Create new" dropdown — all unchanged
- Same TS clean, same test pass

## After you pick

The winning branch merges cleanly back to `polish/process-hub-update-v2` (no conflicts — same base point). Then we propagate the chosen pattern to the other 4 sections in Step 4.

The other 2 branches can be archived or deleted — they're alternatives, not additive.

## How to delete the losers (after picking)

```bash
git branch -D spike/risks-drawer-pattern        # local
git push origin --delete spike/risks-drawer-pattern  # remote
# repeat for the other loser
```
