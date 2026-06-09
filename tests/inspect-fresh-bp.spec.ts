import { test, type Page } from './_helpers';

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}
  });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

test('inspect — create a fresh BP and capture linear-unlock banner', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByRole('button', { name: /^New Process$/ }).first().click();

  // Drawer opens. Fill required fields.
  const dialog = page.getByRole('dialog', { name: /Create Business Process/i });
  await dialog.waitFor({ state: 'visible' });

  await dialog.getByPlaceholder('e.g. Procure to Pay').fill('Inventory Management');
  await dialog.getByPlaceholder('e.g. P2P').fill('INV');
  // Select department + owner (first non-placeholder option)
  await dialog.locator('select').first().selectOption({ index: 1 });
  await dialog.locator('select').nth(1).selectOption({ index: 0 });

  // Submit
  await dialog.getByRole('button', { name: /^New Process$/ }).click();
  await page.waitForTimeout(800);

  // The new BP card should be visible on Process Hub. Click it.
  await page.getByText('Inventory Management').first().click();
  await page.waitForTimeout(800);

  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.screenshot({ path: 'test-results/fresh-bp.png', fullPage: true });
});
