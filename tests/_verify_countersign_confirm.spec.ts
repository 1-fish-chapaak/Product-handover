import { test, expect } from './_helpers';

/**
 * C1 — the dossier reviewer banner's "Countersign & sign off" routes through
 * the same one-line attest confirm the working-paper preview uses: Cancel
 * leaves the paper unsigned; Confirm commits and toasts.
 */
test('reviewer banner countersign asks the attest confirm first', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Reviewer' }).first().click();
  await page.waitForTimeout(800);
  // a queue paper awaiting countersign WITHOUT open review notes → its dossier
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(900);
  const counterBtn = page.getByRole('button', { name: 'Countersign & sign off' });
  await expect(counterBtn).toBeVisible();

  // click → confirm dialog, not an instant signature
  await counterBtn.click();
  await expect(page.getByText('Countersign this paper?')).toBeVisible();

  // cancel keeps the paper unsigned — the gate is still offering the pen
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(counterBtn).toBeVisible();

  // confirm commits
  await counterBtn.click();
  await page.getByRole('button', { name: 'Countersign', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Countersigned').first()).toBeVisible();
  await expect(counterBtn).toHaveCount(0);
});
