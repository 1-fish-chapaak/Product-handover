import { test, type Page } from '@playwright/test';

// One-off capture of the reworked Admin section. Not part of the suite.

async function signIn(page: Page) {
  // App now boots to an RBAC gate: optional login (Continue) then a workspace
  // chooser (Enter workspace). Click through whichever steps appear.
  for (const name of [/Continue/, /Enter workspace/i]) {
    const btn = page.getByRole('button', { name });
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click();
      await page.waitForTimeout(600);
    }
  }
}

async function gotoAdmin(page: Page) {
  await page.goto('/');
  await signIn(page);
  const nav = page.getByRole('button', { name: 'Admin' }).first();
  await nav.waitFor({ state: 'visible', timeout: 5000 });
  await nav.click();
  await page.waitForTimeout(1200);
}

test('admin users', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-users.png', fullPage: false });
});

test('admin teams subtab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /^Teams/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-teams.png', fullPage: false });
});

test('admin roles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Roles & Permissions/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-roles.png', fullPage: false });
});

test('admin logs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Audit Logs/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-logs.png', fullPage: false });
});

test('admin invite drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Invite User/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-invite-drawer.png', fullPage: false });
});

test('admin create-role drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Roles & Permissions/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Create Role/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-create-role-drawer.png', fullPage: false });
});

test('admin user detail drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: 'View' }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-user-drawer.png', fullPage: false });
});

test('platform usage', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await signIn(page);
  const nav = page.getByRole('button', { name: 'Platform Usage' }).first();
  await nav.waitFor({ state: 'visible', timeout: 5000 });
  await nav.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-platform-usage.png', fullPage: false });
});
