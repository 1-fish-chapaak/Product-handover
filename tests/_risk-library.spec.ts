import { test, expect } from './_helpers';

/**
 * SOX / ICFR — Risk Library tab: risk register derived from the RACM with
 * inherent / residual heatmaps; cells filter the register; rows expand to
 * the mitigating controls. Bulk test stays available on Control Library.
 */
test('risk library tab shows heatmaps and register', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Air India Express').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Risk Library', exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { name: 'Risk library' })).toBeVisible();
  await expect(page.getByText('Inherent risk')).toBeVisible();
  await expect(page.getByText('Residual risk')).toBeVisible();
  // click a populated heatmap cell to filter the register
  await page.locator('button[title*="risk"]').filter({ hasText: /\d/ }).first().click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/Showing \d+ of \d+ risks/)).toBeVisible();
  // clear the cell filter, then expand a risk row to its mitigating controls
  await page.locator('button:has-text("×")').first().click().catch(() => {});
  await page.locator('tr.reg-row').first().click();
  await expect(page.getByText(/Mitigating controls/)).toBeVisible();
  // control library tab still carries the bulk test button
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: /^Bulk test/ })).toBeVisible();
});
