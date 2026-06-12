import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the control detail's Attributes table no longer has a "Result"
// (Pass/Fail) column. The control's own status chip is intentionally kept.

async function openP2PControls(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Switch to Controls' }).click();
  await page.waitForTimeout(500);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('control detail Attributes table has no Result column', async ({ page, context }) => {
  await openP2PControls(page);
  const [detail] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('button[title="Open control"]').first().click(),
  ]);
  await detail.waitForLoadState('domcontentloaded');
  await enterWorkspace(detail);
  await detail.waitForTimeout(800);
  await expect(detail.getByRole('columnheader', { name: 'Linked Workflows' })).toBeVisible();
  await expect(detail.getByRole('columnheader', { name: 'Result' })).toHaveCount(0);
  await detail.screenshot({ path: 'test-results/control-detail-no-result.png', fullPage: true });
});
