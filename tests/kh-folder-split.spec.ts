import { test, expect, type Page } from '@playwright/test';

// ─── Folder detail: reading pane (finder list + live preview) ────────────────
// Selecting a file (click or ↑/↓) updates the live preview on the right — no
// opening, no back. (The old "Full screen" overlay was removed; tests dropped.)

async function openFolder(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Knowledge Hub' }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('FY26_Q2_Workpapers').first().click();
  await page.waitForTimeout(1000);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 940 }); });

test('S1: list + live preview; selecting a file updates the pane', async ({ page }) => {
  await openFolder(page);
  // Finder list shows multiple files as rows.
  await expect(page.getByRole('button', { name: /^Control_Matrix\.xlsx/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sample_Selection\.csv/ })).toBeVisible();
  // The auto-selected first file renders a real sheet preview on the right.
  await expect(page.getByText(/rows × \d+ cols/)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Showing first/)).toBeVisible();
  // Switching files keeps a preview rendered.
  await page.getByRole('button', { name: /^Sample_Selection\.csv/ }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Showing first/)).toBeVisible({ timeout: 8000 });
});

test('S2: keyboard ↑/↓ moves the selection (and the live preview)', async ({ page }) => {
  await openFolder(page);
  const selected = () => page.locator('[aria-pressed="true"][data-file-id]');
  // Click a row first so focus leaves the search field (↑/↓ are ignored while typing).
  await page.getByRole('button', { name: /^Control_Matrix\.xlsx/ }).click();
  const first = await selected().getAttribute('data-file-id');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  await expect(selected()).not.toHaveAttribute('data-file-id', first ?? '');
  // ↑ returns to the original row.
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await expect(selected()).toHaveAttribute('data-file-id', first ?? '');
});
