/**
 * Verifies the workflow flow when files are attached via the composer
 * '+' button BEFORE sending the prompt — should NOT open the upload
 * modal, and should jump straight to the file-processing trail +
 * clarify.
 */
import { test, expect, type Page } from './_helpers';
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
  // Deep-link straight into the chat view (the `test` helper auto-enters the
  // workspace gate). Home's hero is a separate surface without this composer.
  await page.goto(`${BASE}/?view=chat`);
  await page.locator('textarea').first().waitFor({ timeout: 8000 });

  // Toggle Workflow mode FIRST
  await page.getByRole('radio', { name: /^Workflow$/ }).click();

  // Click the composer + button to open DataPickerModal
  await page.locator('button[aria-label*="Attach"]').first().click();
  await page.waitForTimeout(400);
  await snap(page, 'A-data-picker-open');

  // Pick 2 existing assets from "All Data" tab and confirm. Scope everything to
  // the picker dialog — the source names also appear on background surfaces
  // (e.g. the "Vendor Master Change Monitor" recent-workflow card), and the
  // row-name is anchored (^) so it doesn't also match the favourite-star button
  // ("Add <name> to favourites").
  const dialog = page.getByRole('dialog');
  const allDataTab = dialog.getByRole('button', { name: /All Data/ });
  if (await allDataTab.isVisible().catch(() => false)) {
    await allDataTab.click();
    await page.waitForTimeout(200);
  }
  await dialog.getByRole('button', { name: /^SAP ERP: AP Module/i }).click();
  await page.waitForTimeout(150);
  await dialog.getByRole('button', { name: /^Vendor Master Data/i }).click();
  await page.waitForTimeout(200);
  await snap(page, 'B-picked-2-sources');
  await dialog.getByRole('button', { name: /^Add( \d+)?$/i }).click();
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
  await expect(page.getByRole('radio', { name: /Last 30 days/i })).toBeVisible({ timeout: 6000 });
  await snap(page, 'E-clarify');
});
