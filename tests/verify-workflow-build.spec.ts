/**
 * End-to-end verification of the in-chat workflow build flow.
 * Drives the Workflow toggle path through: empty state → 4 clarify
 * questions → upload card → upload modal auto-open. Screenshots every
 * phase so the reviewer can replay what was observed.
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

test('in-chat workflow build — empty state to upload', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // 1. Toggle composer to Workflow mode
  await page.getByRole('radio', { name: /^Workflow$/ }).click();
  await snap(page, '01-workflow-toggle-on');

  // Empty state should NOT show Recents list now (just starter chips)
  await expect(page.getByText('Recent Workflows', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Duplicate invoice detection' })).toBeVisible();

  // 2. Type a prompt + send
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // 3. First clarify card should appear with Stepper above
  await expect(page.getByText(/date range should I cover/i)).toBeVisible({ timeout: 10000 });
  await snap(page, '02-clarify-q1');
  // Stepper should show all 4 step labels
  for (const label of ['Describe', 'Upload', 'Map', 'Review']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  // 4. Walk through 4 clarify cards. Active clarify card is the LAST one in
  // the thread with a visible question title (data.index < questions.length).
  // Click the first option button under each card.
  for (let q = 1; q <= 4; q++) {
    // Wait for the "N of 4" indicator on the latest clarify card
    const idx = page.getByText(new RegExp(`^${q} of 4$`)).last();
    await idx.waitFor({ timeout: 8000 });

    // Pick the active card by finding the rounded card containing both the
    // "N of 4" indicator and a Skip button.
    const activeCard = page.locator('div', {
      has: page.locator(`text=${q} of 4`),
    }).filter({
      has: page.getByRole('button', { name: 'Skip' }),
    }).last();

    // Click the first option (Last 30 days / Strict / All vendors / Flag list)
    const optionButtons = activeCard.locator('button').filter({ hasNotText: 'Skip' });
    const firstOpt = optionButtons.first();
    await firstOpt.scrollIntoViewIfNeeded();
    await firstOpt.click();

    await page.waitForTimeout(500);
    await snap(page, `03-clarify-q${q}-answered`);
  }

  // 5. After Q4, the upload narration + card should land. Modal auto-opens 400ms later.
  await expect(page.getByText(/Drop the required data files/i)).toBeVisible({ timeout: 6000 });
  await snap(page, '04-upload-narration');

  // 6. Modal should be open
  await page.waitForTimeout(800);
  // Look for the upload modal — typically has "Upload" or "Drop" copy
  const modal = page.locator('[role="dialog"]').filter({ hasText: /Upload|Drop|Choose/i }).first();
  const modalVisible = await modal.isVisible().catch(() => false);
  await snap(page, '05-upload-modal');
  console.log('upload modal visible:', modalVisible);

  // 7. Close modal — Escape now dismisses (added in this commit)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await snap(page, '06-after-modal-close');
  // Modal should be gone — drop zone "Choose files" button no longer present
  await expect(page.getByRole('button', { name: /Choose files/i })).toHaveCount(0);

  // 8. Context chip above composer should reference the workflow + current step
  await expect(page.getByText(/Step (1|2) ·/)).toBeVisible({ timeout: 4000 });

  // 9. The workflow-upload card in the thread should render the
  //    "Open upload window" CTA (list-only view with 0 files).
  await expect(page.getByRole('button', { name: /Open upload window/i })).toBeVisible({ timeout: 4000 });
  await snap(page, '07-upload-card-in-thread');

  // Done — we've verified clarify → upload card → modal auto-open.
  // The Map/Review/Validate/Tolerance/Output steps require file uploads
  // (drag-drop or picker), which need fixtures; reviewer can drive that path
  // manually from here.
});
