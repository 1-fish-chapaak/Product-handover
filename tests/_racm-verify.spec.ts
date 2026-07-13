import { test, expect } from './_helpers';

/**
 * SOX / ICFR — the RACM tab lands on one RACM document card per business
 * process; opening a card shows that process's risks & controls matrix with a
 * clear auditor approval / remark status per row, plus bulk test of controls
 * and bulk approval from the selection bar. The finished bulk run hands off to
 * the Runs tab registry.
 */
test('Air India engagement RACM shows per-process matrix with approvals + bulk test', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  // open Engagements from nav (collapsed sidebar → title attr)
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  // open the Air India ICFR engagement
  await page.getByText('FY26 ICFR — Air India Express').first().click();
  await page.waitForTimeout(1000);
  // RACM tab — lands on one RACM document card per business process
  await page.getByRole('button', { name: 'RACM', exact: true }).first().click().catch(async () => {
    await page.getByText('RACM', { exact: true }).first().click();
  });
  await page.waitForTimeout(800);
  await expect(page.getByText('Procure to Pay — RACM')).toBeVisible();
  // open the P2P card → that process's risks & controls matrix
  await page.getByRole('button', { name: 'Open Procure to Pay RACM' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading', { name: /Procure to Pay — Risk & Control Matrix/ })).toBeVisible();
  await expect(page.getByText('Pre-testing review').first()).toBeVisible();

  // select two rows and bulk test — the knitted flow:
  // scope → compile required files → attach unique datasets → execute
  const checks = page.locator('tbody input[type=checkbox]');
  await checks.nth(0).click();
  await checks.nth(1).click();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Test controls' }).click();
  await expect(page.getByText('Bulk test of controls')).toBeVisible();
  await page.getByRole('button', { name: /Compile required files/ }).click();
  await expect(page.getByText(/unique dataset/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Pull all from SAP ECC/ }).click();
  await expect(page.getByRole('button', { name: /Review & execute/ })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole('button', { name: /Review & execute/ }).click();
  await expect(page.getByText('Checks to run')).toBeVisible();
  await page.getByRole('button', { name: /Test 2 controls/ }).click();
  // finished run offers the Runs-tab hand-off; Done stays on the matrix
  await expect(page.getByRole('button', { name: /View run/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // approve a pending row via the row action
  await page.locator('button[aria-label^="Approve "]').first().click();
  await expect(page.getByText('You · Auditor · just now').first()).toBeVisible();

  // leave a remark through the modal
  await page.locator('button[aria-label^="Remark on "]').first().click();
  const box = page.getByPlaceholder('What must change before this row can be approved?');
  await expect(box).toBeVisible();
  await box.fill('Please attach the FY26 DoA matrix before approval.');
  await page.getByRole('button', { name: 'Save remark' }).click();
  await expect(page.getByText('Please attach the FY26 DoA matrix')).toBeVisible();
});
