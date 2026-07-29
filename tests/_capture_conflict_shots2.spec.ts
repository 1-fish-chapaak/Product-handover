import { test, expect } from './_helpers';
import { test as rawTest, expect as rawExpect } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/conflict-shots';

test('OURS — workspace tab bar (5 tabs incl Test runs)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1200);
  const tabsRow = page.getByText('Test runs', { exact: true }).first();
  await expect(tabsRow).toBeVisible();
  const box = await tabsRow.boundingBox();
  await page.screenshot({ path: `${OUT}/c2-ours-tabs.png`, clip: { x: 120, y: box!.y - 22, width: 950, height: 64 } });
});

rawTest('MAIN — workspace tab bar (4 tabs, no Test runs)', async ({ page }) => {
  rawTest.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('http://localhost:5201/');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await page.waitForTimeout(1200);
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(600);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1500);
  const tab = page.getByText('Control Library', { exact: true }).first();
  await rawExpect(tab).toBeVisible();
  const box = await tab.boundingBox();
  await page.screenshot({ path: `${OUT}/c2-main-tabs.png`, clip: { x: 120, y: box!.y - 22, width: 950, height: 64 } });
});
