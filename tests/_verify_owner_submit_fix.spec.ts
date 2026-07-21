import { test, expect } from './_helpers';

/**
 * E2 — the owner portal's remediation action goes through the real evidence
 * gate: without proof it refuses and opens My exceptions; with proof it
 * submits for retest and the reminder clears with it.
 */
test('portal Submit fix enforces the evidence gate end-to-end', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(800);

  // no evidence yet → the inline action refuses and routes to My exceptions
  const fixRow = page.getByText('Extend duplicate-match key to normalise references');
  await expect(fixRow.first()).toBeVisible();
  await page.getByRole('button', { name: 'Submit fix', exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Evidence first').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My exceptions' })).toBeVisible();

  // attach proof on the exception, then return to the portal
  await page.getByRole('button', { name: /Attach evidence/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(800);

  // with evidence → the same action submits for retest and clears the reminder
  await expect(fixRow.first()).toBeVisible();
  await page.getByRole('button', { name: 'Submit fix', exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Submitted for retest').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit fix', exact: true })).toHaveCount(0);

  // and the exception really moved — My exceptions shows it with the auditor
  await page.getByText('Manage my exceptions').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/With the auditor for retest/).first()).toBeVisible();
});
