import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the output-card button changes:
//  GRAPH  → new Download (icon + chevron) button opening a CSV / Excel menu
//  TABLE  → no "Open", no "View all"; Download is icon-only (icon + chevron)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

async function answerClarification(page: Page) {
  await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 6000 });
  for (let guard = 0; guard < 8; guard++) {
    await page.locator('[role=radio], [role=checkbox]').first().click();
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.count() > 0) { await expect(done).toBeEnabled(); await done.click(); break; }
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeEnabled();
    await next.click();
  }
}

test('graph gains a CSV/Excel download; table loses Open + View all, Download is icon-only', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);

  await page.getByRole('textbox', { name: 'Message IRA' }).fill('Find duplicate invoices in Q1');
  await page.getByRole('button', { name: 'Send message' }).click();
  await answerClarification(page);

  // Wait for the audit result (table card) to render after the loader.
  await expect(page.getByText('Flagged duplicate pairs')).toBeVisible({ timeout: 20000 });

  // --- GRAPH: new download button + menu ---
  const graphDownload = page.getByRole('button', { name: 'Download chart' });
  await expect(graphDownload).toBeVisible();
  await graphDownload.click();
  // Menu shows CSV + Excel.
  await expect(page.getByRole('menuitem', { name: 'CSV' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Excel' })).toBeVisible();
  await page.screenshot({ path: 'test-results/output-graph-download.png' });
  await page.keyboard.press('Escape');

  // --- GRAPH: chart name (left) is now the switcher; right selector is gone ---
  const titleSwitcher = page.getByRole('button', { name: /Findings by/ }).first();
  await expect(titleSwitcher).toBeVisible();
  await titleSwitcher.click();
  await expect(page.getByRole('menuitemradio').first()).toBeVisible();
  await page.keyboard.press('Escape');

  // --- TABLE: Open gone, View all gone, Download is the labeled (Image-12) pill ---
  await expect(page.getByRole('button', { name: 'Open in new tab' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View all' })).toHaveCount(0);
  const tableDownload = page.getByRole('button', { name: 'Download', exact: true });
  await expect(tableDownload).toBeVisible();
  // Labeled style → the word "Download" is shown.
  await expect(tableDownload).toContainText('Download');
  await page.screenshot({ path: 'test-results/output-table-buttons.png' });
});
