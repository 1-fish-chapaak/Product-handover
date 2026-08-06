import { test, expect } from './_helpers';

const SHOT_DIR = '/Users/aasthajain/.claude/jobs/937047f0/tmp/sox-v2-shots';

/**
 * SOX Testing · V2 tab — parity baseline. The V2 tab is an exact copy of the
 * Programmes experience (classic wizard, scoping-summary modal, roll-forward,
 * card → workspace) on its OWN store (Altura seed). Call-aligned features get
 * added here one decision at a time; the classic tab stays untouched.
 */
test('SOX Testing V2 tab mirrors the Programmes experience on its own store', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);

  // Classic tab is the default — untouched
  await expect(page.getByRole('tab', { name: 'Programmes' })).toBeVisible();
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C')).toBeVisible();

  // V2 tab: same card grammar, Altura seed, classic derivation (4 RACMs)
  await page.getByRole('tab', { name: 'V2 · Call-aligned' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('FY26 ICFR — Altura Infra Group')).toBeVisible();
  await expect(page.getByText('Interim testing')).toBeVisible();
  await expect(page.getByText(/materiality ₹ 12 Cr · performance ₹ 9 Cr/)).toBeVisible();
  await expect(page.getByText(/16\/20 controls effective/)).toBeVisible();
  await expect(page.getByText('Treasury', { exact: true })).toBeVisible();
  await expect(page.getByText('Fixed Assets', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-v2-parity-landing.png`, fullPage: true });

  // Scoping summary — the classic 800×800 modal, same component
  await page.getByRole('button', { name: 'Scoping summary', exact: true }).click();
  await page.waitForTimeout(600);
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Scoping summary', { exact: true })).toBeVisible();
  await expect(page.getByText('Opinion as of 31 Dec 2026')).toBeVisible();
  await expect(page.getByText('In-scope processes — one RACM each')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-v2-parity-summary.png`, fullPage: true });
  await modal.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(400);

  // Card click opens the classic SOX workspace, back returns to SOX Testing
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Back to SOX Testing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Altura Infra Group' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to SOX Testing' }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { name: 'SOX Testing' })).toBeVisible();

  // The V2 wizard — 8 steps now, with decisions #1–#8 applied: materiality
  // before entities, entity scope DERIVED, workstream RACMs, People step
  await page.getByRole('tab', { name: 'V2 · Call-aligned' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'New Engagement' }).last().click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Type & basics').first()).toBeVisible();
  await expect(page.getByText('Process audit aligned to RACM + SOPs')).toBeVisible();
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 ICFR — Altura Infra Group');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Materiality — set before any entity is judged')).toBeVisible();
  // #3 — the fifth basis card; #2 — PM is the emphasised scoping threshold
  await expect(page.getByText('% of net assets', { exact: true })).toBeVisible();
  await expect(page.getByText(/75% of overall — the scoping threshold/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  // #4 — the entity list is inventory, not scoping; each row carries its
  // share of the group (what the coverage rule sums)
  await expect(page.getByText('Group structure')).toBeVisible();
  await expect(page.getByText('Share of group')).toBeVisible();
  await expect(page.getByText(/Scope is derived, never hand-picked/)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Bulk upload beside the header: one action maps TBs to all entities by
  // name. The metering file arrives as "asm-…" (no name match) → an inline
  // amber "Map" chip on the row still missing its TB, no separate section
  await page.getByRole('button', { name: 'Bulk upload TBs' }).click();
  await page.waitForTimeout(1500);
  const mapChip = page.getByRole('button', { name: 'Map asm-tb-fy27.xlsx' });
  await expect(mapChip).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-v2-bulk-unmatched.png`, fullPage: true });
  await mapChip.click();
  // The V2 seed group is Altura (8 entities, 27 captions) — the classic
  // Airline trio is all-huge, so entity derivation would never visibly bite
  await expect(page.getByText(/7 of 27 captions flagged/)).toBeVisible();
  // #2 — the TB step flags at performance materiality (₹ 15.75 Cr on the
  // default PBT basis), not overall ₹ 21 Cr
  await expect(page.getByText(/threshold ₹ 15.75 Cr/)).toBeVisible();
  // #4/#5/#6 — entity verdicts derive on the TB step: 3 quant + the Metering
  // qual pull (59%) still miss the 60% target, so Roadways is pulled for
  // coverage (71%); 3 entities stay out
  await expect(page.getByText('Entity scope — derived, not picked')).toBeVisible();
  await expect(page.getByText(/71% of the group covered · target 60%/)).toBeVisible();
  await expect(page.getByText(/Pulled in for coverage/)).toBeVisible();
  await expect(page.getByText('In scope — TB')).toHaveCount(3);
  await expect(page.getByText('In scope — qual')).toHaveCount(1);
  await expect(page.getByText('In scope — coverage')).toHaveCount(1);
  await expect(page.getByText('Out of scope')).toHaveCount(3);
  await page.screenshot({ path: `${SHOT_DIR}/04-v2-entity-scope-derived.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Qualitative overlay')).toBeVisible();
  // #6 — the seeded cash-collections pick pulls the whole Metering entity in
  await expect(page.getByText(/Pulls Metering into scope/)).toBeVisible();
  await expect(page.getByText('In via coverage')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Map accounts to processes')).toBeVisible();
  // #5 — the coverage-pulled caption is badged next to the Qual badge
  await expect(page.getByText('Coverage', { exact: true })).toBeVisible();
  // #7 — the workstream card is COMMENTED OUT by user instruction: no
  // beyond-TB section, wizard derives process RACMs only
  await expect(page.getByText('Beyond the trial balance')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  // #8 — the People step: every RACM prefilled with process + control owner
  await expect(page.getByText('People — who owns the process, who owns the controls')).toBeVisible();
  await expect(page.getByLabel('Process owner for Treasury')).toHaveValue('Nikhil Rao — Treasury Manager');
  await expect(page.getByLabel('Process owner for Procure to Pay')).toHaveValue('Rohit Bansal — Procurement Head');
  await page.screenshot({ path: `${SHOT_DIR}/05-v2-people-step.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Review — scoping decides the programme')).toBeVisible();
  const wizard = page.getByRole('dialog');
  await expect(wizard.getByText('Entity scope — derived', { exact: true })).toBeVisible();
  await expect(wizard.getByText(/5 of 8 entities in scope — 71% of the group covered/)).toBeVisible();
  // #8 on the review — owners ride on every RACM card
  await expect(wizard.getByText(/PO Nikhil Rao · CO Meera Iyer/)).toBeVisible();
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(700);

  // Creation lands on the V2 list; the latest card owns Roll forward —
  // 3 process RACMs (workstream card dormant, WS_CARD off)
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/FY27 programme created — 3 RACMs derived/)).toBeVisible();
  await expect(page.getByText('as of 31 Mar 2027')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll forward', exact: true })).toHaveCount(1);
  await page.screenshot({ path: `${SHOT_DIR}/03-v2-parity-created.png`, fullPage: true });

  // Store isolation — the classic tab never sees V2 programmes
  await page.getByRole('tab', { name: 'Programmes' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C')).toBeVisible();
  await expect(page.getByText('FY27 ICFR — Altura Infra Group')).toHaveCount(0);
  await expect(page.getByText('FY26 ICFR — Altura Infra Group')).toHaveCount(0);
});
