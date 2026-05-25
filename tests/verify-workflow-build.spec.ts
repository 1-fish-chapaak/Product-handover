/**
 * End-to-end verification of the in-chat workflow build flow.
 * Workflow clarify is now docked ABOVE the composer (same placement +
 * UI as query clarification). This spec drives 4 clarify questions via
 * keyboard (1-N picks) and confirms the upload card + modal appear.
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

test('in-chat workflow build — docked clarify above composer', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // Toggle Workflow mode
  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  await snap(page, '01-workflow-toggle-on');

  // Type prompt + send
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // Workflow clarify should appear ABOVE the composer (not inline). Look
  // for the option button "Last 30 days" via role=option (ClarificationBlock).
  await expect(page.getByRole('option', { name: /Last 30 days/i })).toBeVisible({ timeout: 10000 });
  await snap(page, '02-clarify-docked-above-composer');

  // Stepper visible at top
  await expect(page.getByText('Describe', { exact: true })).toBeVisible();

  // Walk all 4 questions via keyboard "1" (picks the first option each time)
  for (let i = 1; i <= 4; i++) {
    await page.keyboard.press('1');
    await page.waitForTimeout(450);
    await snap(page, `03-clarify-after-q${i}`);
  }

  // After Q4 → upload narration + modal auto-opens
  await expect(page.getByText(/Drop the required data files/i)).toBeVisible({ timeout: 6000 });
  await snap(page, '04-upload-narration');
  await page.waitForTimeout(800);
  await snap(page, '05-upload-modal-open');

  // Modal closes on Escape (verified in previous commit)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: /Choose files/i })).toHaveCount(0);

  // Context chip above composer
  await expect(page.getByText(/Step 2 ·/)).toBeVisible({ timeout: 4000 });

  // Upload card CTA renders in the thread
  await expect(page.getByRole('button', { name: /Open upload window/i })).toBeVisible({ timeout: 4000 });
  await snap(page, '06-final-state');
});
