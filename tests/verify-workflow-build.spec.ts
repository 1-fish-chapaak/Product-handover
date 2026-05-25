/**
 * Verifies the upload-first workflow build flow:
 *   prompt → Upload (modal auto-opens) → Clarify (docked above composer)
 *   → Map → Review → Validate clarify → Tolerance → Run → ViewPreview
 *   → Output → Save modal.
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

test('upload-first workflow build', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // Workflow mode + prompt
  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // 1. Upload modal should auto-open IMMEDIATELY after send (no clarify first)
  await expect(page.getByRole('button', { name: /All Data/ })).toBeVisible({ timeout: 8000 });
  await snap(page, 'A-upload-modal-first');
  await page.getByRole('button', { name: /All Data/ }).click();
  await page.waitForTimeout(300);

  // 2. Attach 2 required sources via All Data tab
  await page.getByRole('button', { name: /SAP ERP: AP Module/i }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Vendor Master Data/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /^Attach$/ }).click();
  await page.waitForTimeout(800);
  await snap(page, 'B-after-attach');

  // 3. Clarify cards should appear AFTER upload (docked above composer)
  await expect(page.getByRole('option', { name: /Last 30 days/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'C-clarify-after-upload');
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('1');
    await page.waitForTimeout(400);
  }

  // 4. Map card after clarify
  await expect(page.getByText(/Clarifications locked in.*moving to data mapping/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'D-map-card');

  // 5. Confirm map
  await page.getByRole('button', { name: /Confirm.*Proceed/i }).click();
  await page.waitForTimeout(600);
  await snap(page, 'E-map-confirmed');

  // 6. Review → Validate
  await expect(page.getByText(/Mappings confirmed/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'F-review-card');
  await page.getByRole('button', { name: /Validate workflow/i }).click();
  await page.waitForTimeout(600);

  // 7. Validate clarify (matching logic + tolerance)
  await expect(page.getByRole('option', { name: /Exact field matching/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'G-validate-clarify-q1');
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await expect(page.getByRole('option', { name: /Strict \(±1%\)/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'H-validate-clarify-q2');
  await page.keyboard.press('1');
  await page.waitForTimeout(800);

  // 8. Tolerance card + run + View Preview + Output + Save
  await expect(page.getByText(/running with.*tolerance/i)).toBeVisible({ timeout: 6000 });
  await snap(page, 'I-tolerance-card');
  await expect(page.getByRole('button', { name: /View Preview/i })).toBeVisible({ timeout: 15000 });
  await snap(page, 'J-view-preview');
  await page.getByRole('button', { name: /View Preview/i }).click();
  await page.waitForTimeout(600);
  await snap(page, 'K-output-card');
  await page.getByRole('button', { name: /Save Workflow/i }).click();
  await page.waitForTimeout(600);
  await snap(page, 'L-save-modal');
});

test('upload-nudge if user closes modal without attaching', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });
  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // Wait for upload modal, then close it without attaching anything
  await expect(page.getByRole('button', { name: /All Data/ })).toBeVisible({ timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Assistant should push a nudge
  await expect(page.getByText(/Looks like nothing was attached/i)).toBeVisible({ timeout: 4000 });
  await snap(page, 'nudge-on-modal-skip');
});
