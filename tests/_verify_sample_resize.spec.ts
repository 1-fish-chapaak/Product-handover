import { test, expect } from './_helpers';

/**
 * SOX / ICFR — a drawn sample stays editable. The auditor may draw 40 and then
 * decide 25 is right: the Sample card carries a pencil that swaps the size into
 * an inline editor. Shrinking keeps the first N items (results recorded against
 * them survive) and warns when it would discard items already tested.
 */
test('a drawn sample size can be revised down', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // Control Library → a control whose operating sample is already drawn.
  // Scoped to the SOX shell: the left sidebar has its own global "Control Library".
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Open P2P-C-02 —/ }).first().click();
  await page.waitForTimeout(900);

  // the drawn sample shows its size with an edit affordance. The size headline is
  // the one inside the Sample card — "N items" also appears in the basis line and
  // in the right-hand activity rail, so scope to the card.
  const sampleCard = page.locator('.subcard').filter({ hasText: 'drawn from the population' });
  const size = sampleCard.locator('span.tabular-nums').first();
  const editBtn = page.getByRole('button', { name: 'Change the sample size' });
  await expect(editBtn).toBeVisible();
  await expect(size).toHaveText('25 items');

  // revise it down to 10 — the inline editor replaces the read-only size
  await editBtn.click();
  const sizeInput = page.getByLabel('Sample size');
  await expect(sizeInput).toBeVisible();
  await sizeInput.fill('10');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(500);

  // the new size sticks and the basis records that it was revised
  await expect(size).toHaveText('10 items');
  await expect(sampleCard.getByText(/sample size revised by the auditor/)).toBeVisible();

  // and it can be revised back up again
  await page.getByRole('button', { name: 'Change the sample size' }).click();
  await page.getByLabel('Sample size').fill('30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(size).toHaveText('30 items');

  // cancelling leaves the size untouched
  await page.getByRole('button', { name: 'Change the sample size' }).click();
  await page.getByLabel('Sample size').fill('5');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(size).toHaveText('30 items');
});
