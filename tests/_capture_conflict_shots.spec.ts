import { test, expect } from './_helpers';
import { test as rawTest, expect as rawExpect } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/conflict-shots';

/** Clip a padded region around an element and save it. */
async function clipAround(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator, path: string, pad = { l: 300, t: 190, w: 430, h: 250 }) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no box');
  await page.screenshot({ path, clip: { x: Math.max(0, box.x - pad.l), y: Math.max(0, box.y - pad.t), width: pad.w, height: pad.h } });
}

test('OURS — Overview materiality card + link', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1200);
  const link = page.getByText('Materiality & scope', { exact: true });
  await expect(link).toBeVisible();
  await page.screenshot({ path: `${OUT}/c1-ours-overview.png` });
  await clipAround(page, link, `${OUT}/c1-ours-card.png`);
});

rawTest('MAIN — Overview materiality card + link', async ({ page }) => {
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
  const link = page.getByText('Configuration', { exact: true }).first();
  await rawExpect(link).toBeVisible();
  await page.screenshot({ path: `${OUT}/c1-main-overview.png` });
  await clipAround(page, link, `${OUT}/c1-main-card.png`);
});
