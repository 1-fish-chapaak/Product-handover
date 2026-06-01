import { test, type Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}
  });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

test('inspect — BP detail full scroll', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(800);
  // Use a tall viewport so the full thing fits without scrolling.
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.screenshot({ path: 'test-results/bp-detail-full.png', fullPage: true });
});
