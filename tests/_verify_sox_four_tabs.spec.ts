import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * Every SOX engagement opens on one level and the same four tabs (user ask):
 * Overview · RACM · Control Library · SOX testing. Risk Register and Configuration
 * are parked on both shells; the reworked shell also lost its audit level
 * (Dashboard / Audit logs / audits) and its Deficiency management tab, which
 * goes back to being a drill-in.
 *
 * Asserts on both shells, because they are two different files:
 *   • SoxClassicApp — ENG-001 / ENG-002 / ENG-010
 *   • SoxIcfrApp    — SOX-104 Altura
 */

const WANTED = ['Overview', 'RACM', 'Control Library', 'SOX testing'];
const PARKED = ['Risk Register', 'Configuration', 'Deficiency management', 'Dashboard', 'Audit logs'];

/** The tab bar is the row of buttons under the engagement header / breadcrumb.
 *  Scoped to `main`, which is what "the tab bar" always meant: the app's left
 *  nav carries a global "Risk Register" entry (Sidebar.tsx), so asking the whole
 *  document whether that name exists answers a different question and fails on
 *  a tab that is correctly parked. */
async function assertFourTabs(page: import('@playwright/test').Page) {
  const main = page.getByRole('main');
  for (const label of WANTED) {
    await expect(main.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
  }
  for (const label of PARKED) {
    await expect(main.getByRole('button', { name: label, exact: true })).toHaveCount(0);
  }
}

test('classic SOX engagement shows the four tabs and nothing else', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Airline P2P & O2C');
  await assertFourTabs(page);

  // SOX testing is the audit register, and the New audit sheet opens off it.
  // It is NOT empty any more — the classic SOX seeds were back-filled with
  // programme records, so ENG-001 arrives with a year-end cycle already on it.
  // What still has to be true is that it is an audit REGISTER and not the run
  // registry that used to live here, which is parked.
  await page.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(600);
  const main = page.getByRole('main');
  await expect(main.getByRole('button').filter({ hasText: /^(CY|FY) ?20\d\d/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'All types' })).toHaveCount(0);
  await page.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog', { name: 'New audit' })).toBeVisible();
});

test('reworked SOX engagement shows the four tabs, and deficiencies as a drill-in', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');

  // No audit level any more: the four tabs are right there on the click, and
  // the "No audits yet" wall is gone with them.
  await expect(page.getByText('No audits yet')).toHaveCount(0);
  await assertFourTabs(page);

  // Deficiency management lost its tab but not its page: the Overview's
  // severity rail still drills in, under a breadcrumb instead of the tab bar.
  const rail = page.getByRole('button', { name: /still working through remediation|Manage deficiencies/ }).first();
  if (await rail.count() > 0) {
    await rail.click();
    await page.waitForTimeout(700);
    await expect(page.getByText('Deficiency management', { exact: true }).first()).toBeVisible();
    // a drill-in, so the tab bar is gone
    await expect(page.getByRole('button', { name: 'Control Library', exact: true })).toHaveCount(0);
  }
});
