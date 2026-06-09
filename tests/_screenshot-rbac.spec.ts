import { test, expect } from '@playwright/test';

// One-off capture of the RBAC entry + gating states. Not part of the suite.
// NB: uses the base `test` (not ./_helpers) on purpose — the workspace-chooser
// capture needs the raw login screen, which the _helpers wrapper auto-dismisses.

test('workspace chooser', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(500);
  // Both workspaces are offered.
  await expect(page.getByText('Platform', { exact: true })).toBeVisible();
  await expect(page.getByText('Auditify MVP')).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/_rbac-login.png', fullPage: false });
});

test('admin full sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Pick a workspace, then continue into the app (enters as Administrator).
  await page.getByText('Auditify MVP').click();
  await page.getByRole('button', { name: /Enter workspace/i }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/__screenshots__/_rbac-admin-sidebar.png', fullPage: false });
});
