import { test, expect } from './_helpers';

/**
 * SOX / ICFR — Materiality & scope is a read-only screen. The ground rules are
 * planning-time decisions: re-cutting them mid-period would re-grade exceptions
 * already concluded. In place of editing, the screen reports what this period's
 * exceptions say about the thresholds, as advice for next period's planning.
 */
test('Materiality & scope is view-only, with threshold advice', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // Overview → Materiality & scope
  await page.getByRole('link', { name: /Materiality & scope/ }).or(
    page.getByRole('button', { name: /Materiality & scope/ })).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('heading', { name: 'Materiality & scope' })).toBeVisible();

  // the engagement header is gone — the breadcrumb carries the context instead
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs).toBeVisible();
  await expect(crumbs.getByRole('button', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();
  await expect(crumbs.getByText('Materiality & scope')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toHaveCount(0);
  await expect(page.getByText('Viewing as')).toHaveCount(0);

  // the thresholds read as stated values, and the screen says why they're fixed
  await expect(page.getByText('Set at planning · read-only')).toBeVisible();
  await expect(page.getByText('₹50,00,000').first()).toBeVisible();

  // nothing on the screen is editable — no inputs, no switches
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.locator('[role=switch]')).toHaveCount(0);

  // and the old mid-engagement edit flow is gone
  await expect(page.getByText(/changing the ground rules mid-engagement/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Review & apply/ })).toHaveCount(0);

  // in its place: advice read off this period's exceptions, explicitly next-period
  await expect(page.getByText(/Carried into next period's planning/)).toBeVisible();
  await expect(page.getByText(/exceptions? ·.*clearly-trivial/)).toBeVisible();

  // back returns to the engagement Overview — header, tabs and sign-off restored
  await crumbs.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Engagement sign-off')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();
});
