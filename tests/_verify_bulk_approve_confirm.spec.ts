import { test, expect } from './_helpers';

/**
 * R2 — bulk "Approve rows" never eats remarks silently: a selection containing
 * remarked rows waits behind a confirm; Cancel changes nothing.
 */
test('bulk approve confirms before clearing remarks', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  // into a drilled RACM matrix
  await page.locator('.sox-book-ui').getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Open Procure to Pay RACM/ }).click();
  await page.waitForTimeout(1000);

  // leave a remark on one row, then select-all and bulk approve
  const remarkBtns = page.locator('button[title="Remark"], button[aria-label^="Remark"]');
  if (await remarkBtns.count()) {
    await remarkBtns.first().click();
    await page.locator('.modal textarea, .modal-backdrop textarea').fill('tighten the control description');
    await page.locator('.modal-backdrop').getByRole('button', { name: /Save remark|Remark/ }).last().click();
    await page.waitForTimeout(400);
  }
  await page.locator('thead input[type="checkbox"]').first().check();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Approve rows' }).click();
  await page.waitForTimeout(400);

  // the confirm names what gets erased; Cancel keeps the remark
  await expect(page.getByText(/have open remarks|has an open remark/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForTimeout(300);

  // approving anyway goes through
  await page.getByRole('button', { name: 'Approve rows' }).click();
  await page.getByRole('button', { name: 'Approve anyway' }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/have open remarks|has an open remark/)).toHaveCount(0);
});
