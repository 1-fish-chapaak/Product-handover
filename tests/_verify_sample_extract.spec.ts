import { test, expect } from './_helpers';

type Page = import('@playwright/test').Page;

const SHOTS = 'test-results/sample-extract';

/**
 * STEP ③ — SAMPLE, after the population/sample split.
 *
 * The old version of this spec walked a step that no longer exists: two required
 * files through one Upload button, an extraction-logic box, a Send. All of that
 * was filtering, and filtering belongs to step ① — so the draw screen is now
 * exactly two things, a size and a button, and this spec asserts BOTH halves of
 * that: what is there, and that everything which made the two steps confusable
 * is gone.
 *
 * Walked on the seeded Altura engagement rather than a freshly created one:
 * `createSoxEngagement` arrives without a RACM, so it has no controls to test.
 * T-05 is the control whose population has not been extracted yet, which means
 * the whole journey — extract, lock, conclude design, draw — is reachable from
 * its opening state.
 */
async function openT05(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  // T-05 is the last shell in its process, so it is the one control whose design
  // and operating tracks are both untested — the whole journey is reachable from
  // its opening state. It used to come out Automated (4 % 3 === 1), which after
  // operatingApplies landed meant it short-formed to TOD and had no sample step
  // at all; the seed now keeps the fresh control Manual for exactly this reason.
  await page.getByText('FX deals confirmed independently of dealing.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText('TOD', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

/** Step ① end to end: filter a file down, agree the count, lock it. */
async function extractAndLockPopulation(page: Page) {
  await expect(page.getByText('Select the source')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button').filter({ hasText: /altura-group-gl-2026\.csv/ }).first().click();
  await page.getByPlaceholder('e.g. 1,400').fill('1200');
  await page.getByRole('button', { name: /Extract population/ }).click();
  await page.waitForTimeout(2200);

  // The count is agreed with, never ticked past.
  await page.getByRole('button', { name: 'The count reads right' }).click();
  await page.waitForTimeout(400);

  // Either computed check can legitimately block — a shortfall, or an extract
  // whose data stops before the period does. Both take a recorded reason, and
  // that is the path this spec walks when it meets one.
  const reasons = page.getByRole('button', { name: 'Accept with reason' });
  while (await reasons.count() > 0) {
    const box = page.locator('textarea').filter({ hasNotText: 'zzz' }).first();
    await box.fill('The FX feed was cut over mid-period; the earlier stretch is in the legacy extract and is tested separately.');
    await reasons.first().click();
    await page.waitForTimeout(500);
  }

  // The report the population came out of is under test too, and it holds the
  // lock shut until it concludes reliable — so step ① is not finished without
  // it. Register it, work all three checks, conclude.
  const lock = page.getByRole('button', { name: 'Lock the population' });
  await expect(lock).toBeDisabled();
  await expect(page.getByText('IPE test', { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByPlaceholder('e.g. SAP S/4HANA — Production').fill('SAP S/4HANA — Production');
  await page.getByPlaceholder('e.g. S_ALR_87012086').fill('S_ALR_87012086');
  await page.getByPlaceholder('who generated it').fill('R. Kulkarni · Treasury');
  await page.getByRole('button', { name: /Register the report/ }).click();
  await page.waitForTimeout(700);

  for (const dim of ['Source & parameters', 'Completeness', 'Accuracy']) {
    const row = page.locator('.subcard').filter({ hasText: dim }).first();
    await expect(row.locator('textarea')).toBeVisible({ timeout: 10_000 });
    await row.locator('textarea').fill(`Proven — ${dim} agreed to the source system.`);
    await row.getByRole('button', { name: 'Pass', exact: true }).click();
    await page.waitForTimeout(450);
  }
  await page.getByRole('button', { name: 'Reliable', exact: true }).click();
  await page.waitForTimeout(700);

  await expect(lock).toBeEnabled();
  await lock.click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Population locked').first()).toBeVisible();
}

/** Step ② to Effective — the gate step ③ opens on. */
async function concludeDesignEffective(page: Page) {
  const attach = page.getByRole('button', { name: 'Attach evidence' });
  while (await attach.count() > 0) {
    await attach.first().click();
    await page.waitForTimeout(1200);
  }
  const validateAll = page.getByRole('button', { name: 'Validate all' });
  if (await validateAll.count() > 0) {
    await validateAll.click();
    await page.waitForTimeout(7000);
  }
  await page.getByRole('button', { name: 'Conclude effective' }).first().click();
  await page.waitForTimeout(900);
}

test('the sample step is a size and a draw — nothing else', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openT05(page);

  // ── locked before the design concludes ────────────────────────────────────
  await expect(page.getByText('The draw is locked')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-locked.png`, fullPage: true });

  await extractAndLockPopulation(page);
  await concludeDesignEffective(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/02-unlocked.png`, fullPage: true });

  // ── the two things the screen has ─────────────────────────────────────────
  const size = page.getByLabel('Sample size');
  await expect(size).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Draw sample' })).toBeVisible();
  // what the draw comes off — stated, not asked for
  await expect(page.getByText(/^Population POP-/).first()).toBeVisible();
  // method and seed are facts of the draw, not fields
  await expect(page.getByText(/Random, seed \d+/)).toBeVisible();

  // ── everything the split REMOVED from this step ───────────────────────────
  //
  // Matched EXACTLY, on purpose. The step's own subtitle says the method and
  // seed are "stored so anyone can reproduce the same items" — which is still
  // true and still worth saying. What went is the FIELD asking for them, so the
  // assertion has to name the field label, not any sentence mentioning it.
  const goneLabels = [
    'Transaction detail',          // the file upload
    'Required files',
    'Items to draw',               // renamed to Sample size
    'Selection method',            // derived from the control and round now
    'Seed',                        // ditto — stated, never typed
  ];
  for (const text of goneLabels) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  }
  const gonePhrases = [
    /Extraction logic/,            // the filter rule — filtering is step ①'s job
    /required inputs satisfied/,
    /Extracted sample/,            // renamed to Drawn sample
  ];
  for (const re of gonePhrases) {
    await expect(page.getByText(re)).toHaveCount(0);
  }
  // no seed field, no reroll, no send
  await expect(page.getByLabel('New seed')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(0);
  await expect(page.getByPlaceholder(/Explain how to filter the transactions/)).toHaveCount(0);
  // and no filter control of any kind reachable from this step
  await expect(page.getByText('Extraction criteria')).toHaveCount(0);
});

test('draw → reject → draw again → approve', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openT05(page);
  await extractAndLockPopulation(page);
  await concludeDesignEffective(page);

  const size = page.getByLabel('Sample size');
  await expect(size).toBeVisible({ timeout: 20_000 });
  await size.selectOption('25');
  await page.getByRole('button', { name: 'Draw sample' }).click();
  await page.waitForTimeout(2400);

  // what came back
  await expect(page.getByText(/Drawn sample/)).toBeVisible();
  await expect(page.getByText(/· 25 items/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-drawn.png`, fullPage: true });

  // ── reject: the items go, the population does not ─────────────────────────
  await page.getByRole('button', { name: 'Reject and try again' }).click();
  await expect(page.getByText('Reject this sample?')).toBeVisible();
  await expect(page.getByText(/The population is untouched/)).toBeVisible();
  await page.getByRole('button', { name: 'Reject and start over' }).click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/Drawn sample/)).toHaveCount(0);
  // back to the size, with the population still locked behind it
  await expect(page.getByLabel('Sample size')).toBeVisible();
  await expect(page.getByText(/^Population POP-/).first()).toBeVisible();

  // ── draw again and approve ────────────────────────────────────────────────
  await page.getByLabel('Sample size').selectOption('25');
  await page.getByRole('button', { name: 'Draw sample' }).click();
  await page.waitForTimeout(2400);
  await page.getByRole('button', { name: 'Approve and continue' }).click();
  await page.waitForTimeout(900);

  // the basis names the population, the method and the seed — and no filter rule
  await expect(page.getByText(/Sample drawn — 25 items/)).toBeVisible();
  await expect(page.getByText(/25 items drawn from POP-.*random, seed \d+/).first()).toBeVisible();
  await expect(page.getByText(/transactions filtered by/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/04-approved.png`, fullPage: true });
});
