import { test, expect } from './_helpers';

/**
 * Exceptions breadcrumb — the ← must never be a dead click. A stale returnView
 * used to make it a no-op after a dossier round-trip: Exceptions → open the
 * control (returnView = 'deficiencies') → the dossier's "Deficiencies" link
 * jumps straight back without consuming returnView → ← then "returned" to the
 * page it was already on. It now falls through to the tab root (Overview).
 */

async function openExceptions(page: import('./_helpers').Page) {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Manage exceptions/ }).click();
  await page.waitForTimeout(800);
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText('Exceptions');
}

test('exceptions breadcrumb back returns to Overview', async ({ page }) => {
  test.setTimeout(90_000);
  await openExceptions(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(600);
  // Overview root: engagement header is back, with the year-end box
  await expect(page.getByText('Audit sign-off').first()).toBeVisible();
});

test('exceptions back still works after a dossier round-trip', async ({ page }) => {
  test.setTimeout(90_000);
  await openExceptions(page);
  // open the exception's control — this records "came from Exceptions"
  await page.getByText('P2P-C-04', { exact: true }).first().click();
  await page.waitForTimeout(900);
  // return via the dossier's own "Deficiencies" link (does NOT consume that memory)
  await page.getByRole('button', { name: /^Deficiencies/ }).click();
  await page.waitForTimeout(800);
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toContainText('Exceptions');
  // the ← must not be a dead click now
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Audit sign-off').first()).toBeVisible();
});
