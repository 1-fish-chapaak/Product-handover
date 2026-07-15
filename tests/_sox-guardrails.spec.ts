import { test, expect } from './_helpers';

/**
 * Phase 4 — guardrails & leak fixes: the ground rules are read-only prose for
 * non-auditors (absent, not disabled), every exception lifecycle move stamps a
 * named actor into the shared trail, and four-eyes checks compare people.
 */

const openSox = async (page: import('./_helpers').Page) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
};

test('the ground rules read as prose for the reviewer — no live controls', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  // the header period pill is gone for every role — roll-forward lives in the register header
  await expect(page.getByTitle(/Switch period/)).toHaveCount(0);
  await page.getByRole('button', { name: /Materiality & scope/ }).click();
  await page.waitForTimeout(700);
  // absent, not disabled: no inputs, no switches, no clickable MW indicators
  await expect(page.locator('input[type=number]')).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Restatement of previously issued/ })).toHaveCount(0);
  // the states still read plainly
  await expect(page.getByText('On', { exact: true }).first()).toBeVisible();
});

test('exception lifecycle stamps named actors into the trail, four-eyes closes it', async ({ page }) => {
  test.setTimeout(180_000);
  await openSox(page);

  // owner (M. Nair): evidence the fix, submit DEF-001 for retest
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Attach evidence' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Fixed — submit for retest/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/With the auditor for retest/)).toBeVisible();

  // auditor (A. Mehta): record the retest pass
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Manage exceptions/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Retest passed — to reviewer/ }).click();
  await page.waitForTimeout(400);

  // reviewer (J. Fernandes): close — four-eyes passes because people differ
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: 'DEF-001' }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Close — reviewer sign-off/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/Closed — signed off by J. Fernandes/)).toBeVisible();

  // the shared trail on P2P-C-04 carries every move with its named actor
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(600);
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder(/Search controls/).fill('P2P-C-04');
  await page.waitForTimeout(500);
  await page.locator('.ac-card').first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText(/submitted the fix for retest/)).toBeVisible();
  await expect(page.getByText(/recorded retest pass on DEF-001/)).toBeVisible();
  await expect(page.getByText(/closed DEF-001 — reviewer sign-off/)).toBeVisible();
});

test('the owner sees their classification, never the engagement thresholds', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  // the derivation shows their exposure but not "vs materiality"
  await expect(page.getByText(/vs ₹/)).toHaveCount(0);
  await expect(page.getByText(/Severity — evaluated by the auditor/).first()).toBeVisible();
});
