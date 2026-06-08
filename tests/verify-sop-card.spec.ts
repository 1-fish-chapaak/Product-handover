import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// SOP tab — post-rework. The inline expand is gone. Each SOP card now shows its
// version on the face, a "View SOP" action that opens an in-app document modal
// (header = SOP name), Download stays, Edit is removed, and Delete is guarded by
// a confirmation modal.

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });
}
async function gotoSOPTab(page: Page) {
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  await expect(page.getByText(/^RACMs?$/).first()).toBeVisible({ timeout: 5000 });
  await page.getByText(/^SOPs?$/).first().click();
  await page.waitForTimeout(700);
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
});

test('SOP card has no expand chevron and no inline panel', async ({ page }) => {
  await gotoSOPTab(page);
  await expect(page.getByRole('button', { name: /^Expand / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Collapse / })).toHaveCount(0);
  await expect(page.getByText('Document outline')).toHaveCount(0);
});

test('SOP card shows its version and has no Edit button', async ({ page }) => {
  await gotoSOPTab(page);
  // Version surfaced on the card face (Vendor Payment SOP is v2.1).
  await expect(page.getByText('v2.1', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  // Edit was removed from the SOP card.
  await expect(page.getByRole('button', { name: 'Edit SOP' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/sop-card-01-face.png' });
});

test('Download stays as an action icon button', async ({ page }) => {
  await gotoSOPTab(page);
  await expect(page.getByRole('button', { name: 'Download SOP' }).first()).toBeVisible();
});

test('View SOP opens an in-app document modal headed by the SOP name', async ({ page }) => {
  await gotoSOPTab(page);
  const sopName = 'Vendor Payment SOP';
  const view = page.getByRole('button', { name: `View ${sopName}` });
  await expect(view).toBeVisible({ timeout: 5000 });
  await view.click();

  // A modal dialog opens, labelled by the SOP name (its header).
  const dialog = page.getByRole('dialog', { name: sopName });
  await expect(dialog).toBeVisible({ timeout: 3000 });
  // It reads like the document — outline section headings + the title are present.
  await expect(dialog.getByText('Purpose & scope').first()).toBeVisible();
  await expect(dialog.getByText(sopName).first()).toBeVisible();
  // Download lives inside the viewer too.
  await expect(dialog.getByRole('button', { name: /Download SOP/i })).toBeVisible();
  await page.screenshot({ path: 'test-results/sop-view-01-modal.png' });

  // Escape closes it.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: sopName })).toHaveCount(0);
});

test('Deleting a SOP is guarded by a confirmation modal', async ({ page }) => {
  await gotoSOPTab(page);
  const sopName = 'Purchase Order SOP';
  const trash = page.getByRole('button', { name: `Delete ${sopName}` });
  await expect(trash).toBeVisible({ timeout: 5000 });

  // (1) Clicking delete opens a confirmation — it does NOT archive immediately.
  await trash.click();
  await expect(page.getByText('Delete this SOP?')).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('dialog').getByText(new RegExp(sopName))).toBeVisible();
  await expect(page.getByText(/archived/i)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/sop-del-01-modal.png' });

  // (2) Cancel keeps the SOP — modal closes, no archive.
  await page.getByRole('dialog').getByRole('button', { name: /^Cancel$/ }).click();
  await expect(page.getByText('Delete this SOP?')).toHaveCount(0);
  await expect(page.getByText(/archived/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Delete ${sopName}` })).toBeVisible();

  // (3) Re-open and confirm — only now does it archive (toast fires).
  await page.getByRole('button', { name: `Delete ${sopName}` }).click();
  await expect(page.getByText('Delete this SOP?')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /^Delete$/ }).click();
  await expect(page.getByText('Delete this SOP?')).toHaveCount(0);
  await expect(page.getByText(/archived/i).first()).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: 'test-results/sop-del-02-archived.png' });
});
