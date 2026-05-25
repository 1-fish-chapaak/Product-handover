/**
 * Verifies the query Code tab matches the workflow Plan/Code view.
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

test('query Code tab uses the same UI as workflow Plan/Code view', async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // Send a query (stay in Query mode)
  const textarea = page.locator('textarea').first();
  await textarea.fill('Detect duplicate invoices');
  await textarea.press('Enter');

  // Wait for clarify, answer all 4 to trigger the query run + Workspace
  await expect(page.getByRole('option', { name: /Last 30 days/i }).first()).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('1');
    await page.waitForTimeout(400);
  }

  // Wait for Workspace panel to open with the query ArtifactPanel
  await expect(page.getByRole('tab', { name: /Code/ })).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: /Code/ }).click();
  await page.waitForTimeout(500);
  await snap(page, 'query-code-tab');
});
