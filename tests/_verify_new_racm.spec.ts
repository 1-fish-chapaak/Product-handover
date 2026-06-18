import { test, expect, type Page } from '@playwright/test';

// Driver (not a CI test): clicks through the new Process Hub "New RACM" two-card
// flow in the running app and screenshots each step as verification evidence.

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });
}

async function gotoP2PRacmTab(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  // BP detail loaded — open the RACM section.
  await expect(page.getByRole('button', { name: /Open RACMs/ }).first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: /Open RACMs/ }).first().click();
  await expect(page.getByRole('button', { name: 'Create new RACM' })).toBeVisible({ timeout: 8000 });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
});

test('New RACM — full two-card flow, click by click', async ({ page }) => {
  await gotoP2PRacmTab(page);
  await page.screenshot({ path: 'test-results/nr-01-racm-tab.png' });

  // ── Step 1: open the modal ──────────────────────────────────────────────
  await page.getByRole('button', { name: 'Create new RACM' }).click();
  await expect(page.getByText('Start from an existing matrix, or extract one from an SOP.')).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('Upload a RACM')).toBeVisible();
  await expect(page.getByText(/Upload an SOP/)).toBeVisible();
  await expect(page.getByText('Import an existing matrix (.xlsx / .csv).')).toBeVisible();
  await expect(page.getByText('IRA reads a procedure (.pdf/.docx) and drafts the RACM.')).toBeVisible();
  await page.screenshot({ path: 'test-results/nr-02-modal.png' });

  // ── Step 2: "Upload a RACM" → file picker → instant import ───────────────
  const [racmChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText('Upload a RACM').click(),
  ]);
  await racmChooser.setFiles({
    name: 'Imported_Test_Matrix.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('dummy xlsx'),
  });
  // Toast + new RACM lands in the list (auto-named "Imported Test Matrix").
  await expect(page.getByText(/Imported "Imported_Test_Matrix\.xlsx"/)).toBeVisible({ timeout: 4000 });
  await page.screenshot({ path: 'test-results/nr-03-racm-imported-toast.png' });
  await expect(page.getByText('Imported Test Matrix', { exact: true })).toBeVisible({ timeout: 4000 });
  await page.screenshot({ path: 'test-results/nr-04-racm-in-list.png' });

  // ── Step 3: "Upload an SOP → extract" → overlay → drafted RACM ───────────
  await page.getByRole('button', { name: 'Create new RACM' }).click();
  await expect(page.getByText(/Upload an SOP/)).toBeVisible({ timeout: 4000 });
  const [sopChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByText(/Upload an SOP/).click(),
  ]);
  await sopChooser.setFiles({
    name: 'Acme_Payments_Procedure.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 dummy'),
  });
  // The extraction overlay must appear (it runs ~1.6s).
  await expect(page.getByText('Extracting RACM from SOP')).toBeVisible({ timeout: 2000 });
  await expect(page.getByText('Acme_Payments_Procedure.pdf')).toBeVisible();
  await page.screenshot({ path: 'test-results/nr-05-extraction-overlay.png' });
  // Then it resolves: overlay gone, toast, and the drafted RACM in the list.
  await expect(page.getByText('Extracting RACM from SOP')).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByText(/Extracted \d+ controls/)).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('Acme Payments Procedure RACM', { exact: true })).toBeVisible({ timeout: 4000 });
  await page.screenshot({ path: 'test-results/nr-06-sop-extracted-in-list.png' });

  // ── Probe 1: backdrop click closes the modal, creating nothing ───────────
  await page.getByRole('button', { name: 'Create new RACM' }).click();
  await expect(page.getByText('Start from an existing matrix, or extract one from an SOP.')).toBeVisible({ timeout: 3000 });
  await page.mouse.click(20, 20); // outside the centered card → backdrop onClose
  await expect(page.getByText('Start from an existing matrix, or extract one from an SOP.')).toHaveCount(0, { timeout: 3000 });
  // No phantom RACM created by opening+closing.
  await expect(page.getByText('Imported Test Matrix', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/nr-07-after-close.png' });
});
