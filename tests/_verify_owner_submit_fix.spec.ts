import { test, expect } from './_helpers';

/**
 * E2 — the owner portal's remediation action goes through the real evidence
 * gate: without proof it refuses and opens My exceptions; with proof it hands
 * the fix to the REVIEWER for sign-off and the reminder clears with it.
 *
 * Straight to the reviewer since 30 Sep 2026. The retest used to sit between the
 * owner's "done" and the close, so this action handed the fix to the auditor and
 * the finding waited to be re-tested the week it was repaired. The retest now
 * happens on the control, on the audit's own timetable; the exception's last rung
 * is the reviewer reading the plan, the fix and its evidence.
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

  // with evidence → the same action submits for sign-off and clears the reminder
  await expect(fixRow.first()).toBeVisible();
  await page.getByRole('button', { name: 'Submit fix', exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Submitted for sign-off').first()).toBeVisible();
  await expect(page.getByText(/is with the reviewer/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit fix', exact: true })).toHaveCount(0);

  // and the exception really moved — My exceptions shows it awaiting the
  // reviewer, not the auditor. There is no rung in between any more. The stage
  // pill is what the collapsed register carries; the "who has it and what they
  // are doing" line lives inside the row, so open it and read that too.
  await page.getByText('Manage my exceptions').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Awaiting reviewer').first()).toBeVisible();
  const row = page.getByRole('button', { name: /^(Expand|Collapse) DEF-001$/ }).first();
  if (((await row.getAttribute('aria-label')) ?? '').startsWith('Expand')) {
    await row.click();
    await page.waitForTimeout(600);
  }
  await expect(page.getByText(/reading the fix evidence and closing/).first()).toBeVisible();
  await expect(page.getByText(/Step 5 of 5 · Awaiting reviewer/)).toBeVisible();
});
