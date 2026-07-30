import { test, expect } from './_helpers';

/**
 * E3 — a closed exception can come back: the full lifecycle (owner submits with
 * evidence → auditor passes retest → reviewer closes) then "Reopen — reason
 * required" appears on the Closed card, demands a reason, and puts the
 * exception back into Remediation with the trail carrying why.
 */
test('closed exception reopens with a recorded reason', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // owner: attach proof and submit the fix
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByText('Manage my exceptions').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Attach evidence/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Fixed — submit for retest/ }).click();
  await page.waitForTimeout(600);

  // auditor: retest passes → to reviewer
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Manage exceptions/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Retest passed — to reviewer/ }).click();
  await page.waitForTimeout(600);

  // reviewer: close behind the attest confirm
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByText('DEF-001').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Close — reviewer sign-off' }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.modal').getByRole('button', { name: 'Close — reviewer sign-off' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Closed — signed off by/).first()).toBeVisible();

  // the way back in: reason-gated reopen
  const reopenBtn = page.getByRole('button', { name: /Reopen — reason required/ });
  await expect(reopenBtn).toBeVisible();
  await reopenBtn.click();
  await expect(page.getByText('Reopen this exception?')).toBeVisible();
  const confirmReopen = page.locator('.modal').getByRole('button', { name: 'Reopen', exact: true });
  await expect(confirmReopen).toBeDisabled();
  await page.locator('.modal textarea').fill('Fix regressed — duplicates recurred in the June run');
  await confirmReopen.click();
  await page.waitForTimeout(600);

  // back in remediation, close stamp gone
  await expect(page.getByText('Reopened').first()).toBeVisible();
  await expect(page.getByText(/Closed — signed off by/)).toHaveCount(0);
});
