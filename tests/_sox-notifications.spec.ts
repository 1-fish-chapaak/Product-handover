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
  await page.getByRole('button', { name: /To-do —/ }).click();
  await expect(page.getByText('Pending assignment & review')).toBeVisible();
  await expect(page.getByText(/RACM rows awaiting your review/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // risk owner bell — auditor verdicts first, then remarks and tasks
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /To-do —/ }).click();
  await expect(page.getByText(/concluded INEFFECTIVE/).first()).toBeVisible();
  await expect(page.getByText(/is due today/).first()).toBeVisible();
  await expect(page.getByText(/control test due today|control test overdue/).first()).toBeVisible();
  await expect(page.getByText(/Auditor remark on/).first()).toBeVisible();
  // clicking an ineffective item opens that control's dossier
  await page.getByText(/concluded INEFFECTIVE/).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(500);
  // Phase 3 — the owner's SOX is a to-do list: the audit-side tabs are gone
  const soxNav = page.locator('.sox-book-ui');
  await expect(soxNav.getByRole('button', { name: 'RACM', exact: true })).toHaveCount(0);
  await expect(soxNav.getByRole('button', { name: 'Risk Library', exact: true })).toHaveCount(0);
  await expect(soxNav.getByRole('button', { name: 'Runs', exact: true })).toHaveCount(0);
  await expect(soxNav.getByRole('button', { name: 'Control Library', exact: true })).toBeVisible();
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
  // regular testing: every control carries a due date; today's tests lead the
  // checklist (D1 — the owner's move on a due test is attesting & evidencing,
  // not running it). The desks rework folded the old cards into one dated list
  // under "Your control tasks" — the row itself opens the control now.
  await expect(page.getByRole('heading', { name: 'Your control tasks' })).toBeVisible();
  await expect(page.getByText(/control tests? due/).first()).toBeVisible();
  await page.getByText(/attest & evidence/).first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Test of Design', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(500);
  // document-request rows deep-link the same way (the inline "Provide
  // documents" link acts in place; the row navigates)
  await expect(page.getByText('Due today').first()).toBeVisible();
  await page.getByText(/document request/).first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Test of Design', { exact: false }).first()).toBeVisible();
});
