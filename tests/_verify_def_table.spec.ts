import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/** Deficiency management is a register now, not a stack of cards: one row per
 *  finding, opening in place under its own row. */
test('deficiency management renders as a table that opens rows in place', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');

  // into the audit, then onto the tab
  const audit = page.getByRole('main').getByRole('button').filter({ hasText: /^(CY|FY) ?20\d\d/ }).first();
  if (await audit.count() > 0) { await audit.click(); await page.waitForTimeout(800); }
  await page.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(900);

  await expect(page.getByRole('columnheader', { name: 'Finding' })).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/def-table-collapsed.png', fullPage: false });

  // a row opens its body underneath, and the row above it stays a row
  // scoped past the aggregation table above, whose rows list the same ids
  const row = page.locator('tr.reg-row:not(.reg-static)').filter({ hasText: 'DEF-A-01' }).first();
  await row.click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Root cause').first()).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/def-table-open.png', fullPage: false });
});
