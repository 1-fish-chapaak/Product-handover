/**
 * End-to-end verification of the in-chat workflow build flow.
 * Drives every step: clarify → upload → map → review → validate
 * clarify → tolerance → run → view preview → output → save.
 *
 * Run with the dev server already on port 5173:
 *   npx playwright test tests/verify-workflow-build.spec.ts --project=chromium --reporter=list
 */
import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOT_DIR = path.join(__dirname, '__screenshots__', 'workflow-build');

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test('full workflow build — clarify → upload → map → review → validate → tolerance → output → save', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // 1. Workflow mode + prompt
  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // 2. Answer 4 clarify questions (1 key picks first option each time)
  await expect(page.getByRole('option', { name: /Last 30 days/i })).toBeVisible({ timeout: 10000 });
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('1');
    await page.waitForTimeout(400);
  }
  await snap(page, 'A-after-clarify');

  // 3. Upload modal should auto-open. Use the "All Data" tab to attach
  //    existing assets (no file fixtures needed).
  await expect(page.getByRole('button', { name: /All Data/ })).toBeVisible({ timeout: 6000 });
  await page.getByRole('button', { name: /All Data/ }).click();
  await page.waitForTimeout(300);

  await snap(page, 'B-all-data-tab');

  // Pick 2 assets — workflow has 2 required inputs (AP Invoices + Vendor Master).
  // Asset rows are <button aria-pressed=…> with the name text.
  await page.getByRole('button', { name: /SAP ERP: AP Module/i }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Vendor Master Data/i }).click();
  await page.waitForTimeout(200);
  await snap(page, 'C-assets-selected');

  // Click Attach button
  const attachBtn = page.getByRole('button', { name: /^Attach$/ });
  await attachBtn.waitFor({ timeout: 4000 });
  await attachBtn.click();
  await page.waitForTimeout(800);
  await snap(page, 'D-after-attach');

  // 4. Map card should appear after "Files verified"
  await expect(page.getByText(/Files verified|moving to data mapping/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'E-map-card');

  // 5. Click Confirm & Proceed on the map card
  const confirmBtn = page.getByRole('button', { name: /Confirm.*Proceed/i });
  await confirmBtn.waitFor({ timeout: 6000 });
  await confirmBtn.click();
  await page.waitForTimeout(600);
  await snap(page, 'F-after-map-confirm');

  // 6. Review card
  await expect(page.getByText(/Mappings confirmed|opening review/i)).toBeVisible({ timeout: 6000 });
  const validateBtn = page.getByRole('button', { name: /Validate workflow/i });
  await validateBtn.waitFor({ timeout: 6000 });
  await snap(page, 'G-review-card');
  await validateBtn.click();
  await page.waitForTimeout(600);

  // 7. Validate clarify (matching logic + tolerance) docked above composer
  await expect(page.getByRole('option', { name: /Exact field matching/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'H-validate-clarify-q1');
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await expect(page.getByRole('option', { name: /Strict \(±1%\)/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'I-validate-clarify-q2');
  await page.keyboard.press('1');
  await page.waitForTimeout(800);

  // 8. Tolerance card should push, then run fires
  await expect(page.getByText(/running with.*tolerance/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'J-tolerance-card');

  // 9. Wait for run + view preview card
  await expect(page.getByRole('button', { name: /View Preview/i })).toBeVisible({ timeout: 15000 });
  await snap(page, 'K-view-preview');
  await page.getByRole('button', { name: /View Preview/i }).click();
  await page.waitForTimeout(600);

  // 10. Output card with Save Workflow button
  const saveBtn = page.getByRole('button', { name: /Save Workflow/i });
  await saveBtn.waitFor({ timeout: 6000 });
  await snap(page, 'L-output-card');
  await saveBtn.click();
  await page.waitForTimeout(600);

  // 11. SaveWorkflowModal opens
  await snap(page, 'M-save-modal');
});
