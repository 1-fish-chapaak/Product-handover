import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Admin → Roles & Permissions: a custom role can be created and then deleted.
// Notes that earlier tripped up automation (all encoded below):
//  - The delete control's accessible name is "Delete" (its visible text); the
//    "Delete role" string is only its title attribute, so target /^Delete$/.
//  - Delete is offered ONLY on Custom roles, and is disabled while the role is
//    the default or still assigned (deleteBlockedReason). A fresh role (0 users,
//    not default) is deletable.
//  - The confirmation modal's confirm button is "Delete Role".
//  - Success shows a toast containing the role name, so verify removal by the
//    role LIST button count (toasts aren't role buttons), after it dismisses.

async function gotoRolesTab(page: Page) {
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Admin' }).first().click();
  await page.getByRole('button', { name: /^Invite User$/ }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: /Roles & Permissions/i }).first().click();
  await page.getByRole('button', { name: /Create Role/i }).first().waitFor({ timeout: 6000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.setViewportSize({ width: 1600, height: 1000 });
});

test('custom role can be created and deleted', async ({ page }) => {
  await gotoRolesTab(page);
  const ROLE = 'QA Role Del';
  const roleBtn = page.getByRole('button', { name: new RegExp(ROLE) });

  // Create
  await page.getByRole('button', { name: /Create Role/i }).first().click();
  await page.getByPlaceholder('Enter role name').waitFor({ timeout: 5000 });
  await page.getByPlaceholder('Enter role name').fill(ROLE);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Create Role', exact: true }).click();
  await expect(roleBtn).toHaveCount(1, { timeout: 5000 });

  // Select → Delete is present and enabled for a fresh custom role
  await roleBtn.first().click();
  const del = page.getByRole('button', { name: /^Delete$/ });
  await expect(del).toBeVisible({ timeout: 4000 });
  await expect(del).toBeEnabled();

  // Delete → confirm
  await del.click();
  const confirm = page.getByRole('dialog').last().getByRole('button', { name: 'Delete Role', exact: true });
  await expect(confirm).toBeVisible({ timeout: 4000 });
  await confirm.click();

  // Removed from the role list (count the role button, immune to the toast).
  await expect(roleBtn).toHaveCount(0, { timeout: 6000 });
});

test('system role cannot be deleted (no enabled Delete)', async ({ page }) => {
  await gotoRolesTab(page);
  await page.getByRole('button', { name: /System Admin/ }).first().click();
  await page.waitForTimeout(400);
  // A System role exposes no Delete control (Delete is Custom-only).
  await expect(page.getByRole('button', { name: /^Delete$/ })).toHaveCount(0);
});
