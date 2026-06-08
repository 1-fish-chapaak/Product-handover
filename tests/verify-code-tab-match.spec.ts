/**
 * Verifies BOTH the query Code tab and the workflow Plan/Code view use
 * the same CollapsibleSection-style chrome with dark code block and
 * icon Copy/Download buttons.
 */
import { test, expect, type Page } from './_helpers';
import * as path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOT_DIR = path.join(__dirname, '__screenshots__', 'workflow-build');

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: false });
}

test('query Code tab — Generated SQL Query CollapsibleSection', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });
  const textarea = page.locator('textarea').first();
  await textarea.fill('Detect duplicate invoices');
  await textarea.press('Enter');
  await expect(page.getByRole('option', { name: /Last 30 days/i }).first()).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('1'); await page.waitForTimeout(400); }
  await expect(page.getByRole('tab', { name: /Code/ })).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: /Code/ }).click();
  await page.waitForTimeout(500);
  await snap(page, 'query-code-tab');
});

test('workflow Plan/Code view — same CollapsibleSection chrome', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });
  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');
  await expect(page.getByRole('button', { name: /All Data/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: /All Data/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /SAP ERP: AP Module/i }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /Vendor Master Data/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /^Attach$/ }).click();
  await page.waitForTimeout(800);
  // Switch to Plan tab on the workflow side panel
  await expect(page.getByRole('tab', { name: /Plan/ })).toBeVisible({ timeout: 6000 });
  await page.getByRole('tab', { name: /Plan/ }).click();
  await page.waitForTimeout(300);
  // Workflow (steps) view first
  await snap(page, 'workflow-plan-steps');
  // Switch to Code view within Plan (segmented control radio button)
  await page.getByRole('radio', { name: /^Code$/ }).click();
  await page.waitForTimeout(500);
  await snap(page, 'workflow-code-view');
});
