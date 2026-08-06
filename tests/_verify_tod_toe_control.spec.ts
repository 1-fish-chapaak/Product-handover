import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The control working paper names its two tracks TOD and TOE.
 *
 * Navigation note: the tab bar lives inside <main>, and the app's LEFT NAV
 * carries a global "Control Library" entry of its own — asking the whole
 * document for that button leaves the engagement altogether and lands on the
 * platform-wide library, where none of this exists. Scope to main.
 *
 * The audit click is not optional either: a register row click is identical at
 * both levels, and only being inside an audit decides whether it opens this
 * working paper or the library's read-only detail page.
 */
test('control page reads TOD / TOE', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');

  const main = page.getByRole('main');
  const audit = main.getByRole('button').filter({ hasText: /^(CY|FY) ?20\d\d/ }).first();
  await expect(audit).toBeVisible({ timeout: 15_000 });
  await audit.click();
  await page.waitForTimeout(900);

  await main.getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.locator('tr.reg-row').first().click();
  await page.waitForTimeout(1400);

  // the five steps of the working paper, in the order the work happens
  for (const title of ['TOD', 'Population', 'Sample', 'TOE', 'Sign-off']) {
    await expect(main.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }
  // and the old track names are gone from it
  await expect(main.getByText('Test of design', { exact: true })).toHaveCount(0);
  await expect(main.getByText('Test of operating', { exact: true })).toHaveCount(0);
  await expect(main.getByText('Operating effectiveness is locked')).toHaveCount(0);

  await page.screenshot({ path: 'tests/__screenshots__/tod-toe-control.png', fullPage: false });
});
