import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the Create Control modal now uses a Toggle (role="switch") for
// "Key control" instead of a checkbox, and that it flips on click.

async function openCreateControl(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Switch to Controls' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Create Control' }).click();
  await expect(page.getByRole('heading', { name: 'Create Control' })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('Key control is a toggle switch, not a checkbox', async ({ page }) => {
  await openCreateControl(page);

  // The Key control control is now a switch, and there is no checkbox for it.
  const keyToggle = page.getByRole('switch', { name: 'Key control' });
  await expect(keyToggle).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Key control' })).toHaveCount(0);

  // It flips on click.
  const before = await keyToggle.getAttribute('aria-checked');
  await keyToggle.click();
  const after = await keyToggle.getAttribute('aria-checked');
  expect(after).not.toBe(before);

  // Clicking the text label also flips it (convenience target).
  await page.getByText('Key control', { exact: true }).click();
  expect(await keyToggle.getAttribute('aria-checked')).toBe(before);

  await page.screenshot({ path: 'test-results/key-control-toggle.png', fullPage: true });
});
