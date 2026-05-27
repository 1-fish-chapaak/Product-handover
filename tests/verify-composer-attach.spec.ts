/**
 * Verifies the workflow flow when files are attached via the composer
 * '+' button BEFORE sending the prompt — should NOT open the upload
 * modal, and should jump straight to the file-processing trail +
 * clarify.
 */
import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOT_DIR = path.join(__dirname, '__screenshots__', 'composer-attach');

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test('workflow build with files attached via composer + button', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // Toggle Workflow mode FIRST
  await page.getByRole('radio', { name: /^Workflow$/ }).click();

  // Click the composer + button to open DataPickerModal
  await page.locator('button[aria-label*="Attach"]').first().click();
  await page.waitForTimeout(400);
  await snap(page, 'A-data-picker-open');

  // Pick 2 existing assets from "All Data" tab and confirm
  const allDataTab = page.getByRole('button', { name: /All Data/ });
  if (await allDataTab.isVisible().catch(() => false)) {
    await allDataTab.click();
    await page.waitForTimeout(200);
  }
  // Click 2 visible asset rows then Attach
  await page.getByRole('button', { name: /SAP ERP: AP Module/i }).first().click().catch(() => {});
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Vendor Master Data/i }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  await snap(page, 'B-picked-2-sources');
  await page.getByRole('button', { name: /^Attach(\s+\d+)?$/i }).click();
  await page.waitForTimeout(400);
  await snap(page, 'C-attached-to-composer');

  // Type prompt + send
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // Upload modal should NOT auto-open because files are pre-attached
  await page.waitForTimeout(800);
  const choose = await page.getByRole('button', { name: /Choose files/i }).isVisible().catch(() => false);
  expect(choose).toBe(false);

  // Processing trail appears + clarify lands directly
  await expect(page.getByText(/Verifying your data sources/i)).toBeVisible({ timeout: 4000 });
  await snap(page, 'D-processing');
  await expect(page.getByRole('option', { name: /Last 30 days/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'E-clarify');
});
