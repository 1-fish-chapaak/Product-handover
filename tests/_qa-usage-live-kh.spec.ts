import { test, expect, usageTab } from './_helpers';

/**
 * Platform Usage reads the live Knowledge Hub catalog, not a snapshot: change
 * what the user has and the Sources figure moves with it.
 */
test('Knowledge Hub stat tracks the live catalog', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  // Write a catalog of exactly 2 sources into the store the Hub persists to.
  await page.evaluate(() => {
    const iso = new Date().toISOString();
    window.localStorage.setItem('kh:sources:v5', JSON.stringify([
      { id: 'live-1', name: 'Q3_Ledger.csv', type: 'file', subtype: 'CSV · 2.0 KB', createdAt: iso },
      { id: 'live-2', name: 'Live_Warehouse', type: 'database', subtype: 'PostgreSQL · prod', createdAt: iso, health: 'healthy' },
    ]));
  });
  await page.reload();
  await page.waitForTimeout(900);

  await page.getByRole('button', { name: /^Knowledge Hub/i }).first().click();
  await page.waitForTimeout(2000);
  const hub = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  expect(hub, 'the Hub itself should show the 2-source catalog').toMatch(/All 2/);

  await page.getByRole('button', { name: /^Platform Usage/i }).first().click();
  await page.waitForTimeout(2500);
  // The Knowledge Hub tile lives on the Sections tab now.
  await usageTab(page, 'Sections');
  const usage = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  // The tile is a definition list — label first, then the figure ("Sources
  // connected 2"), not the other way round.
  expect(usage, 'usage must report the same 2 sources, not a stale seed').toMatch(/Sources connected 2/);
  expect(usage, 'and 0 folders, since neither source is a folder').toMatch(/Folders indexed 0/);
});
