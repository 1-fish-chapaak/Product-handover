import { test, expect } from './_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/sox-testing-shots';

/**
 * SOX Testing tab — the scoping-first flow prototype on the Engagement Library.
 * Landing = programme list. Card click opens the classic SOX workspace (tabs +
 * control testing); "Scoping summary" opens the 800×800 modal; "+ New
 * Engagement" runs the 7-step wizard (classic Type & basics first) in the same
 * modal and registers a real runtime engagement. Existing flows untouched.
 */
test('SOX Testing tab walks the scoping-first journey end to end', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);

  // Existing tabs untouched, new tab present
  await expect(page.getByRole('tab', { name: /All Engagements/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Approval Flow' })).toBeVisible();
  await page.getByRole('tab', { name: 'SOX Testing' }).click();
  await page.waitForTimeout(600);

  // Landing: programme list only — the pipeline explainer is parked
  await expect(page.getByText('SOX programmes — scoping first')).toBeVisible();
  await expect(page.getByText('How a programme gets its scope')).toHaveCount(0);
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-landing.png`, fullPage: true });

  // "Scoping summary" opens the derivation story in the 800×800 modal
  await page.getByRole('button', { name: 'Scoping summary', exact: true }).click();
  await page.waitForTimeout(600);
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  expect(Math.round(box!.width)).toBe(800);
  expect(Math.round(box!.height)).toBe(800);
  await expect(page.getByText('Opinion as of 31 Mar 2026')).toBeVisible();
  await expect(page.getByText('In-scope processes — one RACM each')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-fy26-programme.png`, fullPage: true });
  await page.locator('nav[aria-label="Breadcrumb"] button', { hasText: 'SOX Testing' }).click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Card click opens the classic SOX workspace — tabs, control testing, the lot
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();
  await expect(page.getByText('RACM', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02b-fy26-workspace.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to Engagements' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'SOX Testing' }).click();
  await page.waitForTimeout(500);

  // "+ New Engagement" (tab CTA — the later of the two same-named buttons)
  await page.getByRole('button', { name: 'New Engagement' }).last().click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog')).toBeVisible();
  const wizBox = await page.getByRole('dialog').boundingBox();
  expect(Math.round(wizBox!.width)).toBe(1000);
  expect(Math.round(wizBox!.height)).toBe(800);

  // Step 1 — the classic "Type & basics" screen, as-is (SOX preselected)
  await expect(page.getByText('Type & basics').first()).toBeVisible();
  await expect(page.getByRole('dialog').getByText('SOX / ICFR', { exact: true })).toBeVisible();
  await expect(page.getByText('Process audit aligned to RACM + SOPs')).toBeVisible();
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 ICFR — Airline Group');
  // No start/end dates — the cycle is FY + "as of" year-end (defaults FY 2026-27, 31 Mar 2027)
  await expect(page.getByRole('button', { name: '31 Mar 2027' })).toBeVisible();
  await expect(page.getByText(/testing runs through FY 2026-27/)).toBeVisible();
  await expect(page.getByText('Select date')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/03a-wizard-basics.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — group & entities
  await expect(page.getByText('Group structure')).toBeVisible();
  await expect(page.getByText('Entities in scope of the group audit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove SkyCargo Logistics Pvt Ltd' })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-wizard-entities.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — materiality (basis → computed ladder)
  await expect(page.getByText('Materiality — set before any testing')).toBeVisible();
  await expect(page.getByText('Computed thresholds')).toBeVisible();
  await expect(page.getByText('₹ 21 Cr').first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/04-wizard-materiality.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4 — trial balance upload per entity, captions auto-flagged
  await expect(page.getByText('Trial balance — quantitative scoping')).toBeVisible();
  const uploads = page.getByRole('button', { name: 'Upload trial balance' });
  while (await uploads.count() > 0) {
    await uploads.first().click();
    await page.waitForTimeout(950);
  }
  await expect(page.getByText(/of 34 captions flagged/)).toBeVisible();
  await expect(page.getByText('airline-group-tb-fy27.xlsx')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/05-wizard-tb.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5 — qualitative overlay (partner's two examples pre-scoped)
  await expect(page.getByText('Qualitative overlay')).toBeVisible();
  await expect(page.getByText(/daily fare collections/)).toBeVisible();
  await expect(page.getByText(/fuel-hedge accounting complexity/i)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/06-wizard-qualitative.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 6 — process mapping + beyond-TB scope
  await expect(page.getByText('Map accounts to processes')).toBeVisible();
  await expect(page.getByText('Derived in-scope processes')).toBeVisible();
  await expect(page.getByText('Beyond the trial balance')).toBeVisible();
  await expect(page.getByText('Entity-level controls (ELC)')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-wizard-mapping.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 7 — review & create
  await expect(page.getByText('Review — scoping decides the programme')).toBeVisible();
  await expect(page.getByText('RACMs to be generated — one per in-scope process')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-wizard-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(700);

  // Created programme: scoping-summary modal with as-of anchor + RACM shells
  await expect(page.getByText('Opinion as of 31 Mar 2027')).toBeVisible();
  await expect(page.getByText('RACM shell — ready to build').first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/09-fy27-created.png`, fullPage: true });
  await page.locator('nav[aria-label="Breadcrumb"] button', { hasText: 'SOX Testing' }).click();
  await page.waitForTimeout(400);

  // Landing lists both; the new card opens its own classic SOX workspace
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C')).toBeVisible();
  await page.getByText('FY27 ICFR — Airline Group').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'FY27 ICFR — Airline Group' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-fy27-workspace.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to Engagements' }).click();
  await page.waitForTimeout(800);

  // The classic list is untouched — the seed engagement is still there
  await expect(page.getByText('FY26 ICFR — Airline P2P & O2C').first()).toBeVisible();

  // ── Roll forward: the annual action lives on the LATEST cycle only ──
  await page.getByRole('tab', { name: 'SOX Testing' }).click();
  await page.waitForTimeout(500);
  const rollBtns = page.getByRole('button', { name: 'Roll forward', exact: true });
  await expect(rollBtns).toHaveCount(1);
  await rollBtns.click();
  await page.waitForTimeout(500);

  // Step 1 — cycle is pure recurrence: FY28, as-of auto, everything prefilled
  await expect(page.getByText('Roll forward from FY27')).toBeVisible();
  await expect(page.getByText('opinion as of 31 Mar 2028')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-roll-cycle.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2 — materiality re-set + fresh TBs → year-over-year movement
  await expect(page.getByText('Refresh the numbers')).toBeVisible();
  const rollUploads = page.getByRole('button', { name: /Upload FY28 trial balance/ });
  while (await rollUploads.count() > 0) {
    await rollUploads.first().click();
    await page.waitForTimeout(950);
  }
  await expect(page.getByText('Year-over-year movement')).toBeVisible();
  await expect(page.getByText('Newly in scope').first()).toBeVisible();
  await expect(page.getByText('Fell below — review')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/12-roll-movement.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — only deltas need decisions; RACMs carry with design
  await expect(page.getByText('Review the changes — everything else carries')).toBeVisible();
  await expect(page.getByText('Provisions').first()).toBeVisible();
  await expect(page.getByText(/Marketing & promotion expense/).first()).toBeVisible();
  await expect(page.getByText('Qualitative judgements — carried (2)')).toBeVisible();
  await expect(page.getByText('ELC — carried')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/13-roll-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create FY28 programme' }).click();
  await page.waitForTimeout(700);

  // Rolled programme summary: provenance chip + as-of 2028
  await expect(page.getByText('Rolled forward from FY27').first()).toBeVisible();
  await expect(page.getByText('Opinion as of 31 Mar 2028')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/14-fy28-rolled.png`, fullPage: true });
  await page.locator('nav[aria-label="Breadcrumb"] button', { hasText: 'SOX Testing' }).click();
  await page.waitForTimeout(400);

  // Landing: FY28 card exists and now owns the Roll forward action
  await expect(page.getByText('FY28 ICFR — Airline Group')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll forward', exact: true })).toHaveCount(1);
});
