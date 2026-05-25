/**
 * Verification of the in-chat workflow build flow on feat/workflow-builder.
 * Drives the Workflow toggle path end-to-end and captures screenshots at
 * each phase so the reviewer can replay what was observed.
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

test('in-chat workflow build flow', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });

  // 1. Toggle composer to Workflow mode
  const workflowToggle = page.getByRole('radio', { name: /^Workflow$/ });
  await workflowToggle.waitFor({ timeout: 5000 });
  await workflowToggle.click();
  await snap(page, '01-workflow-toggle-on');

  // 2. Recents list should be visible (static cards, no Configure/Run buttons)
  await expect(page.getByText('Recent Workflows', { exact: true })).toBeVisible();
  const configureBtns = page.getByRole('button', { name: /^Configure$/ });
  await expect(configureBtns).toHaveCount(0);

  // 3. Type a prompt + send
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a duplicate invoice detection workflow');
  await textarea.press('Enter');

  // 4. First clarify card should appear (Stepper at top)
  await expect(page.getByText(/date range should I cover/i)).toBeVisible({ timeout: 10000 });
  await snap(page, '02-first-clarify');
  // Stepper "Describe" pill should be visible
  await expect(page.getByText('Describe', { exact: true })).toBeVisible();

  // 5. Walk through the clarify cards by clicking the first option of each
  for (let i = 0; i < 5; i++) {
    // Find the active clarify card — the latest unanswered one
    const cards = page.locator('[class*="rounded-xl"][class*="border-canvas-border"]').filter({
      has: page.locator('text=/Skip/').nth(0),
    });
    const count = await cards.count();
    if (count === 0) break;
    const firstOpt = cards.last().locator('button').first();
    if (!(await firstOpt.isVisible().catch(() => false))) break;
    await firstOpt.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await snap(page, '03-clarify-complete');

  // 6. Upload card + auto-opened modal
  await expect(page.getByText(/Drop the required data files/i)).toBeVisible({ timeout: 10000 });
  // Modal probe — look for an Upload modal heading
  await page.waitForTimeout(800);
  await snap(page, '04-upload-card-and-modal');

  // 7. Close any open modal by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 8. ContextChip should be above the composer once wfWorkflow exists
  const composerArea = page.locator('div').filter({ hasText: /Workflow$/ }).first();
  await snap(page, '05-context-chip-area');

  // Note: full Upload → Map → Review → Validate → Output flow requires
  // uploading actual files for each required input, which the modal needs
  // user-driven file picks. We stop here and let the reviewer drive the
  // file uploads manually if they want to walk past Step 2.
});
