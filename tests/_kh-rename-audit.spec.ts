import { test, type Page } from '@playwright/test';

// Temp audit spec — drives the Knowledge Hub to verify the shared InlineRename
// reuse (grid tile + file row) and capture a production-readiness sweep.
// Not part of the regular suite; delete after review.

const SHOTS = 'tests/__screenshots__/audit';

async function clickKH(page: Page) {
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await nav.waitFor({ state: 'visible', timeout: 8000 });
  await nav.click();
  await page.waitForTimeout(1200);
}

async function gotoKH(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await clickKH(page);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 940 }); });

// 1 — Gallery landing
test('A1 gallery landing', async ({ page }) => {
  await gotoKH(page);
  await page.screenshot({ path: `${SHOTS}/01-gallery.png`, fullPage: false });
});

// 2 — Grid-tile rename (DataSourcesView → shared InlineRename, size="md")
test('A2 grid tile rename uses shared InlineRename', async ({ page }) => {
  await gotoKH(page);
  // Scope to the specific card button so we hit the right kebab.
  const card = page.getByRole('button').filter({ hasText: 'Control_Testing_Tracker.xlsx' }).first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await card.getByRole('button', { name: 'Source actions' }).click();
  await page.waitForTimeout(250);
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${SHOTS}/02-grid-rename.png`, fullPage: false });
});

// 3 — File-row rename (DataSourceDetailView → shared InlineRename, size="sm").
// Seed a multi-file, non-folder source so the FileRow list (with the hover
// rename pencil) renders instead of the single-file inline preview.
test('A3 file-row rename uses shared InlineRename', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.clear(); sessionStorage.clear();
      const now = new Date().toISOString();
      const src = [{ id: 'multi-1', name: 'Evidence_Bundle', type: 'file', subtype: 'Bundle · 2 files', createdAt: now }];
      localStorage.setItem('kh:sources:v3', JSON.stringify(src));
      const files = {
        'multi-1': [
          { id: 'mf-1', name: 'Sampling_Workbook.csv', format: 'CSV', sizeBytes: 482000, uploadedAt: now, rows: 1240, status: 'processed' },
          { id: 'mf-2', name: 'Control_Evidence.pdf',  format: 'PDF', sizeBytes: 911000, uploadedAt: now, pages: 6,    status: 'processed' },
        ],
      };
      localStorage.setItem('kh:datasetFiles:v1', JSON.stringify(files));
    } catch { /* */ }
  });
  await clickKH(page);
  await page.getByText('Evidence_Bundle', { exact: false }).first().click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${SHOTS}/03a-file-detail.png`, fullPage: false });

  const row = page.locator('li.group').filter({ hasText: 'Sampling_Workbook.csv' }).first();
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.hover();
  await page.waitForTimeout(300);
  const pencil = page.getByRole('button', { name: 'Rename Sampling_Workbook.csv' });
  await pencil.waitFor({ state: 'visible', timeout: 4000 });
  await pencil.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/03b-file-row-rename.png`, fullPage: false });
});

// 4 — Folder reading-pane (finder list + live preview) — regression check
test('A4 folder reading pane', async ({ page }) => {
  await gotoKH(page);
  await page.getByText('FY26_Q2_Workpapers', { exact: false }).first().click();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${SHOTS}/04-folder-reading-pane.png`, fullPage: false });
});

// 5 — Smart Learn tab
test('A5 smart learn tab', async ({ page }) => {
  await gotoKH(page);
  await page.getByRole('button', { name: /Smart Learn/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/05-smart-learn.png`, fullPage: false });
});

// 6 — Single-file detail: flat hero + always-open preview fills the space
test('A6 single-file detail', async ({ page }) => {
  await gotoKH(page);
  await page.getByText('Audit_Committee_Minutes.pdf', { exact: false }).first().click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${SHOTS}/06-single-file-detail.png`, fullPage: false });
});
