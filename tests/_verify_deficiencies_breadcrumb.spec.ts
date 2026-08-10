import { test, expect } from './_helpers';

/**
 * SOX / ICFR — the Exceptions (deficiencies) page is a drill-in like the RACM
 * matrix and Materiality & scope: no engagement header, a breadcrumb instead.
 * It is reached from several places, so its back arrow returns to context
 * rather than a pinned destination.
 */
test('Exceptions page carries a breadcrumb instead of the engagement header', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // Overview → Manage exceptions
  await page.getByRole('button', { name: /Manage exceptions/ }).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('heading', { name: 'Exceptions' })).toBeVisible();

  // breadcrumb carries the context; the engagement header is gone
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs).toBeVisible();
  await expect(crumbs.getByRole('button', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();
  await expect(crumbs.getByText('Exceptions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toHaveCount(0);

  // …but the persona switcher stays: this page IS the three-lines handoff, and it
  // is walked by switching hats without leaving the page
  await expect(page.getByText('Viewing as')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reviewer' })).toBeVisible();

  // the old in-page Back button is gone — the breadcrumb arrow does that job
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(1);

  // back returns to where it was opened from (the Overview), header restored
  await crumbs.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Audit sign-off')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();

  // the owner's copy is titled for them, and the crumb follows. Their route in is
  // their own "My exceptions" tile — "Manage exceptions" is auditor-side only.
  await page.getByRole('button', { name: 'Risk Owner' }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /My exceptions/ }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { name: 'My exceptions' })).toBeVisible();
  await expect(crumbs.getByText('My exceptions')).toBeVisible();
});
