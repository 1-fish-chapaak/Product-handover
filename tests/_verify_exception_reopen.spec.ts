import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * E3 — a closed exception can come back. "Reopen — reason required" demands a
 * reason, then puts the exception back into Remediation with the trail carrying
 * why and the close stamp gone.
 *
 * Rewritten twice over, for two reasons worth recording:
 *
 *  · Deficiency management is a REGISTER (Jul 2026), so a finding's body — and
 *    every action on it — lives behind its row.
 *  · The old walkthrough drove the whole lifecycle on the flagship engagement,
 *    starting with the owner submitting a fix. That route no longer exists: the
 *    flagship renders the classic shell, where the owner's tab bar has no
 *    deficiencies tab at all (a known gap, parked). Altura is the engagement the
 *    current flow is built on, and its DEF-A-05 is already closed — retested
 *    clean and signed off — which is exactly the state this test is about.
 *
 * Reopening is the REVIEWER's alone (RBAC spec): they signed it closed, so
 * undoing that signature is theirs. `_sox-severity-custody.spec.ts` pins the
 * auditor's half of that rule; this one proves the act itself.
 */
test('closed exception reopens with a recorded reason', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(600);

  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(800);
  await main.getByRole('button', { name: 'Open CY 2026 audit' }).filter({ hasText: '02 Jan 2026' }).first().click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1000);
  await main.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(900);

  await page.getByText('DEF-A-05').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/Closed — signed off by/).first()).toBeVisible({ timeout: 15_000 });

  // The way back in: never one-click, because the reason is the record.
  const reopenBtn = page.getByRole('button', { name: /Reopen — reason required/ }).first();
  await reopenBtn.scrollIntoViewIfNeeded();
  await reopenBtn.click();
  await expect(page.getByText('Reopen this exception?')).toBeVisible();
  const confirmReopen = page.locator('.modal').getByRole('button', { name: 'Reopen', exact: true });
  await expect(confirmReopen).toBeDisabled();
  await page.locator('.modal textarea').fill('Fix regressed — a disposal in August was derecognised late again.');
  await confirmReopen.click();
  await page.waitForTimeout(900);

  // Back with the owner to re-prove the fix, and the signature it had is gone.
  await expect(page.getByText(/Closed — signed off by/)).toHaveCount(0);
  await expect(page.getByText('Remediation').first()).toBeVisible();
});
