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

  // Map step → Confirm
  await expect(page.getByText(/moving to data mapping/i)).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole('button', { name: /Confirm.*Proceed/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'D-map-card');
  await page.getByRole('button', { name: /Confirm.*Proceed/i }).click();
  await page.waitForTimeout(600);

  // Review → Validate
  await expect(page.getByRole('button', { name: /Validate workflow/i })).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: /Validate workflow/i }).click();
  await page.waitForTimeout(600);

  // Validate clarify
  await expect(page.getByRole('option', { name: /Exact field matching/i })).toBeVisible({ timeout: 6000 });
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await expect(page.getByRole('option', { name: /Strict \(±1%\)/i })).toBeVisible({ timeout: 6000 });
  await page.keyboard.press('1');
  await page.waitForTimeout(800);

  // Run + View Preview + Output
  await expect(page.getByText(/running with.*tolerance/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'E-tolerance-card');
  await expect(page.getByRole('button', { name: /View Preview/i })).toBeVisible({ timeout: 15000 });
  await snap(page, 'F-view-preview');
  await page.getByRole('button', { name: /View Preview/i }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('button', { name: /Save Workflow/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'G-output-1-file');
});
