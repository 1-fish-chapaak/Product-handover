import { test, expect } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// A control's / risk's "open in new tab" lands on these deep-link URLs. This
// verifies the new tab actually renders the detail page (routing), independent
// of the click that spawned the tab.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

test('control-detail deep link renders the control detail', async ({ page }) => {
  await page.goto('/?view=control-detail&controlId=C-001&bp=P2P');
  await enterWorkspace(page);
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: /Back to controls/ })).toBeVisible();
});

test('audit-risk-register deep link renders the risk detail', async ({ page }) => {
  await page.goto('/?view=audit-risk-register&risk=RSK-001');
  await enterWorkspace(page);
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: /Back to risks/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/risk-deeplink.png', fullPage: true });
});
