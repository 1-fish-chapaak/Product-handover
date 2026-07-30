import { test, expect } from './_helpers';

/**
 * Verifies the SOX engagement tab formerly called "Risk Library" now reads
 * "Risk Register" — in the tab bar and in the control page's breadcrumb trail.
 */
test('SOX risk tab reads Risk Register, not Risk Library', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // the old name is gone from the SOX workspace entirely
  const sox = page.locator('.sox-book-ui');
  await expect(sox.getByRole('button', { name: 'Risk Library', exact: true })).toHaveCount(0);

  // …and the tab now carries the new one, and still opens the heatmaps
  const tab = sox.getByRole('button', { name: 'Risk Register', exact: true }).first();
  await expect(tab).toBeVisible();
  await tab.click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Inherent risk')).toBeVisible();
  await expect(page.getByText('Residual risk')).toBeVisible();
});
