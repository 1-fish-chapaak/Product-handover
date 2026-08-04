import { test, expect } from './_helpers';

/**
 * Phase 3 — the owner is a scoped persona (person-lane, not role-lane):
 * a to-do list of their own controls, tasks and exceptions. The engagement-wide
 * workspace (dashboards, materiality, sign-off chain, RACM/Risks/Runs) is
 * audit-side only, and the owner picker switches which first-line hat "You" wear.
 */

const openSox = async (page: import('./_helpers').Page) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
};

test('owner mode is a scoped to-do list, not the workspace', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  // to-do surfaces lead; the engagement-wide workspace is gone
  await expect(page.getByText('My controls').first()).toBeVisible();
  await expect(page.getByText('My exceptions').first()).toBeVisible();
  await expect(page.getByText('Engagement sign-off')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Materiality & scope/ })).toHaveCount(0);
  await expect(page.getByText('By process')).toHaveCount(0);
  // register is the persona's own controls — S. Iyer's P2P-C-02 is not M. Nair's
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByText(/in your name/)).toBeVisible();
  await page.getByPlaceholder(/Search controls/).fill('P2P-C-02');
  await page.waitForTimeout(500);
  await expect(page.locator('.ac-card')).toHaveCount(0);
  // ...until the picker wears the S. Iyer persona
  await page.getByRole('button', { name: 'Owner persona' }).click();
  await page.getByRole('menuitemradio', { name: 'S. Iyer' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.ac-card')).toHaveCount(1);
});

test('owner exceptions are scoped to their own controls', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  // M. Nair owns P2P-C-04 (DEF-001) but not P2P-C-05 (DEF-002, D. Rao's)
  await expect(page.getByText('DEF-001')).toBeVisible();
  await expect(page.getByText('DEF-002')).toHaveCount(0);
  // no engagement-wide aggregation or materiality maths on the owner's view
  await expect(page.getByText(/computed against materiality/)).toHaveCount(0);
  await expect(page.getByText(/Aggregation — individually-minor/)).toHaveCount(0);
});
