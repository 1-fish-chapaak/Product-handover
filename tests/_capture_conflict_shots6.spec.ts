import { test, expect } from './_helpers';
import { test as rawTest, expect as rawExpect } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/conflict-shots';

test('OURS — control dossier', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('Procure to Pay transactions are approved before processing.').first().click();
  await page.waitForTimeout(1200);
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
  await page.screenshot({ path: `${OUT}/c6-ours-dossier.png` });
});

rawTest('MAIN — control dossier (evidence-first TOD)', async ({ page }) => {
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
  await page.getByText('Vendor master additions and bank-detail changes').first().click();
  await page.waitForTimeout(1200);
  await rawExpect(page.getByText(/Design/).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/c6-main-dossier.png` });
});
