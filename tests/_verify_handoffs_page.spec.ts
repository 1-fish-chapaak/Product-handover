import { test, expect } from './_helpers';

/**
 * O2 — "Manage handoffs" lands on a real Handoffs drill-in: breadcrumbed
 * standalone page, tasks grouped by type, a row deep-links to its control,
 * and the breadcrumb ← returns to the Overview.
 */
test('Manage handoffs opens the Handoffs drill-in', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Manage handoffs/ }).click();
  await page.waitForTimeout(800);

  // standalone drill-in: breadcrumb carries the trail, engagement header gone
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText('Handoffs');
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Handoffs' })).toBeVisible();
  await expect(page.getByText('Document requests').first()).toBeVisible();

  // a row opens its control's dossier
  await page.getByText('Provide tolerance configuration export').first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Test of Design', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading', { name: 'Handoffs' })).toBeVisible();

  // breadcrumb ← returns to the Overview
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Audit sign-off').first()).toBeVisible();
});
