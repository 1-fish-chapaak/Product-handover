import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * Every SOX engagement opens on one level and the same four tabs (user ask):
 * Overview · RACM · Control Library · SOX audit. Risk Register and Configuration
 * are parked on both shells; the reworked shell also lost its audit level
 * (Dashboard / Audit logs / audits) and its Deficiency management tab, which
 * goes back to being a drill-in.
 *
 * Asserts on both shells, because they are two different files:
 *   • SoxClassicApp — ENG-001 / ENG-002 / ENG-010
 *   • SoxIcfrApp    — SOX-104 Altura
 */

const WANTED = ['Overview', 'RACM', 'Control Library', 'SOX audit'];
const PARKED = ['Risk Register', 'Configuration', 'Deficiency management', 'Dashboard', 'Audit logs'];

/** The tab bar is the row of buttons under the engagement header / breadcrumb. */
async function assertFourTabs(page: import('@playwright/test').Page) {
  for (const label of WANTED) {
    await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
  }
  for (const label of PARKED) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
  }
}

test('classic SOX engagement shows the four tabs and nothing else', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Airline P2P & O2C');
  await assertFourTabs(page);

  // SOX audit is the audit register: empty to start, and the New audit sheet
  // opens off it. The run registry that used to live here is parked.
  await page.getByRole('button', { name: 'SOX audit', exact: true }).first().click();
  await page.waitForTimeout(600);
  await expect(page.getByText('No audits yet')).toBeVisible();
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
