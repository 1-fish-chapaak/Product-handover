import { test, type Page } from '@playwright/test';

// Second pass: verify every remaining admin component + interaction state.

async function gotoAdmin(page: Page) {
  await page.goto('/');
  // App now boots to an RBAC gate: optional login (Continue) then a workspace
  // chooser (Enter workspace). Click through whichever steps appear.
  for (const name of [/Continue/, /Enter workspace/i]) {
    const btn = page.getByRole('button', { name });
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click();
      await page.waitForTimeout(600);
    }
  }
  const nav = page.getByRole('button', { name: 'Admin' }).first();
  await nav.waitFor({ state: 'visible', timeout: 5000 });
  await nav.click();
  await page.waitForTimeout(1200);
}

test('edit user drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-edit-user.png', fullPage: false });
});

test('remove user confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Remove User/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-remove-user-confirm.png', fullPage: false });
});

test('create team drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Create Team/ }).first().click();
  await page.waitForTimeout(600);
  // select a couple members (scoped to the drawer) to show checked state
  const drawer = page.locator('[role="dialog"]');
  await drawer.getByText('Abhinav Sharma').click();
  await drawer.getByText('Ayushi Narang').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-create-team.png', fullPage: false });
});

test('edit team drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /^Teams/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByTitle('Edit team').first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-edit-team.png', fullPage: false });
});

test('delete team confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /^Teams/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByTitle('Edit team').first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Delete Team/ }).first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-delete-team-confirm.png', fullPage: false });
});

test('role detail drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Roles & Permissions/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'View' }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-role-detail.png', fullPage: false });
});

test('invite role details with toggles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: /Invite User/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Details' }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-invite-details.png', fullPage: false });
});

test('team assign dropdown', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAdmin(page);
  await page.getByRole('button', { name: 'SOX Audit' }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-team-dropdown.png', fullPage: false });
});
