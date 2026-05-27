/**
 * Verifies the workflow runs end-to-end with only 1 file attached
 * (not all required inputs filled).
 */
import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOT_DIR = path.join(__dirname, '__screenshots__', '1-file-flow');

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test('workflow runs with only 1 file attached', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // Upload modal: pick ONE source only
  await expect(page.getByRole('button', { name: /All Data/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: /All Data/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /SAP ERP: AP Module/i }).click();
  await page.waitForTimeout(200);
  await snap(page, 'A-1-source-selected');
  await page.getByRole('button', { name: /^Attach$/ }).click();
  await page.waitForTimeout(800);
  await snap(page, 'B-after-attach');

  // Clarify should appear after file processing wait
  await expect(page.getByRole('option', { name: /Last 30 days/i })).toBeVisible({ timeout: 10000 });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('1'); await page.waitForTimeout(400); }
  await snap(page, 'C-clarify-done');

  // Map step → Approve & Run → runs the workflow directly
  await expect(page.getByText(/moving to data mapping/i)).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole('button', { name: /Approve.*Run/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'D-map-card');
  await page.getByRole('button', { name: /Approve.*Run/i }).click();
  await page.waitForTimeout(600);

  // Audit-result surfaces — KPI grid + chart + table
  await expect(page.getByText(/finished — surfaced/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'E-result-1-file');
  await expect(page.getByText('Records scanned', { exact: false }).first()).toBeVisible({ timeout: 4000 });
});
