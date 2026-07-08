import { test, expect } from './_helpers';

/**
 * SOX / ICFR — engagement notification bell (top right): pending assignment
 * and review per persona. The risk owner sees the auditor's verdicts first —
 * every control concluded ineffective, plus the auditor's RACM remarks — and
 * items deep-link into the control dossier.
 */
test('notification bell shows pending items per persona', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  // auditor bell — rows awaiting review + open exceptions
  await page.getByRole('button', { name: /Notifications —/ }).click();
  await expect(page.getByText('Pending assignment & review')).toBeVisible();
  await expect(page.getByText(/RACM rows awaiting your review/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // risk owner bell — auditor verdicts first, then remarks and tasks
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Notifications —/ }).click();
  await expect(page.getByText(/concluded INEFFECTIVE/).first()).toBeVisible();
  await expect(page.getByText(/is due today/).first()).toBeVisible();
  await expect(page.getByText(/Auditor remark on/).first()).toBeVisible();
  // clicking an ineffective item opens that control's dossier
  await page.getByText(/concluded INEFFECTIVE/).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(500);
  // the RACM row itself carries the auditor's Ineffective pill for the risk owner
  await page.locator('.sox-book-ui').getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(700);
  await expect(page.locator('tr', { hasText: 'Ineffective' }).first()).toBeVisible();
  // the risk owner has the same bulk-test entry points as the auditor
  await expect(page.getByRole('button', { name: /^Bulk test/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload RACM / SOP' })).toBeVisible();
  const checks = page.locator('tbody input[type=checkbox]');
  await checks.nth(0).click();
  await expect(page.getByRole('button', { name: 'Test controls' })).toBeVisible();
  // ...but approving rows stays with the auditor
  await expect(page.getByRole('button', { name: 'Approve rows' })).toHaveCount(0);
});

/** Risk owner's overview task card deep-links to the control's TOD / TOE. */
test('risk owner overview task opens the control', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Due today').first()).toBeVisible();
  await page.getByText('Open control · TOD / TOE').first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Test of Design', { exact: false }).first()).toBeVisible();
});
