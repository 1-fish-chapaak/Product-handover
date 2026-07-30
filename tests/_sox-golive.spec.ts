import { test, expect } from './_helpers';

/**
 * SOX / ICFR — engagement creation drawer + locked materiality + TOD completeness.
 * 1) New engagement: side drawer → upload one-month GL → entity detected →
 *    materiality worksheet (benchmarks prefilled) → go live locks materiality.
 * 2) Configuration page shows the locked worksheet (seeded live engagement).
 * 3) TOD: design completeness gates "Conclude effective" until every required
 *    element has evidence attached.
 */

test('create engagement via drawer — GL detects entity, go-live locks materiality', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByText('New SOX / ICFR engagement')).toBeVisible();

  // upload the one-month GL → entity + benchmarks detected
  await page.locator('input[aria-label="Upload one-month GL"]').setInputFiles({
    name: 'GL_Apr2026_AG01.csv', mimeType: 'text/csv',
    buffer: Buffer.from('company_code,account,amount\nAG01,Revenue,68400000\n'),
  });
  await expect(page.getByText(/Detected from the GL/)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[aria-label="Entity name"]')).toHaveValue('Airline Group Ltd');
  await expect(page.getByText(/Company code/)).toBeVisible();

  // materiality worksheet — benchmark table prefilled from the GL
  await page.getByRole('button', { name: /^Materiality/ }).click();
  await expect(page.getByText('Total assets').first()).toBeVisible();
  await expect(page.getByText('Overall materiality').first()).toBeVisible();
  await expect(page.getByText('Allocation to significant account groups')).toBeVisible();

  // review & go live — the lock warning, then live
  await page.getByRole('button', { name: /Review & go live/ }).click();
  await expect(page.getByText(/Materiality locks at go-live/)).toBeVisible();
  await page.getByRole('button', { name: /Go live — lock materiality/ }).click();
  await expect(page.getByText('Engagement is live')).toBeVisible({ timeout: 15_000 });
  // lands in the new engagement's control library
  await expect(page.getByText('FY27 ICFR — Airline Group Ltd').first()).toBeVisible({ timeout: 10_000 });
});

test('configuration shows locked materiality; TOD completeness gates conclusion', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // configuration — the seeded live engagement carries a locked worksheet
  await page.getByRole('button', { name: /^Configuration/ }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Locked at go-live')).toBeVisible();
  await expect(page.getByText('Materiality is locked', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Allocation to significant account groups')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(500);

  // TOD — P2P-C-03 has one required element without evidence → conclude locked
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Invoices are matched three-way').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/Design completeness — 2 of 3/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Conclude effective/ }).first()).toBeDisabled();
  // attach the missing evidence → completeness 100% → conclusion unlocks
  await page.getByRole('button', { name: 'Attach evidence' }).first().click();
  await expect(page.getByText(/Design completeness — 3 of 3/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Conclude effective/ }).first()).toBeEnabled();
});
