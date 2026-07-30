import { test, expect } from './_helpers';
import { test as rawTest, expect as rawExpect } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/conflict-shots';

test('OURS — Control Library register', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: /Bulk test all/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/c3-ours-register.png` });
});

rawTest('MAIN — Control Library register', async ({ page }) => {
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
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await rawExpect(page.getByText('Control library').first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/c3-main-register.png` });
});
