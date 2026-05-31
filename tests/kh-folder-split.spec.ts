import { test, expect, type Page } from '@playwright/test';

// ─── Folder detail: split view + full-screen preview ─────────────────────────

async function openFolder(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Knowledge Hub' }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('FY26_Q2_Workpapers').first().click();
  await page.waitForTimeout(1000);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 940 }); });

test('S1: split shows the file list + a preview, and selecting a file updates the pane', async ({ page }) => {
  await openFolder(page);
  // Left rail lists multiple files (anchor ^ so we hit the rail item, not the
  // preview pane's "Download <name>" button).
  await expect(page.getByRole('button', { name: /^Control_Matrix\.xlsx/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sample_Selection\.csv/ })).toBeVisible();
  // Right pane shows a real sheet preview for the first (auto-selected) file.
  await expect(page.getByText(/rows × \d+ cols/)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Showing first/)).toBeVisible();
  // Switching files keeps a preview rendered.
  await page.getByRole('button', { name: /^Sample_Selection\.csv/ }).click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/Showing first/)).toBeVisible({ timeout: 8000 });
});

test('S2: full-screen opens with prev/next nav and Exit closes it', async ({ page }) => {
  await openFolder(page);
  await page.getByRole('button', { name: 'Full screen' }).first().click();
  await page.waitForTimeout(600);
  const dlg = page.getByRole('dialog', { name: /preview/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText(/^1 \/ \d+$/)).toBeVisible();
  // Step to the next file.
  await dlg.getByRole('button', { name: 'Next file' }).click();
  await expect(dlg.getByText(/^2 \/ \d+$/)).toBeVisible();
  // Exit returns to the split.
  await dlg.getByRole('button', { name: 'Exit' }).click();
  await expect(page.getByRole('dialog', { name: /preview/ })).toHaveCount(0);
});
