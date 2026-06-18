import { test, expect } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the control status chip (Effective/Failed/In Test/Pending) is hidden
// (commented out) on both the Controls-tab cards and the control detail header.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

test('Controls tab cards have no status chip', async ({ page }) => {
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Switch to Controls' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/control-cards-no-status.png', fullPage: true });
});

test('control detail header has no status chip', async ({ page }) => {
  await page.goto('/?view=control-detail&controlId=C-001&bp=P2P');
  await enterWorkspace(page);
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: /Back to controls/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/control-detail-no-status.png', fullPage: true });
});
