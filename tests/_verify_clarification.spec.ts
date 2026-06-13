import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the redesigned QUERY clarification card:
//  • "Question X of Y" count
//  • checkbox rows (mixed single / multiple-choice)
//  • Back / Next / Done navigation, answering required to advance
//  • no "Skip"
//  • corner ✕ cancels (nothing runs)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

async function openClarification(page: Page) {
  await page.goto('/?view=chat');
  await enterWorkspace(page);
  await page.getByRole('textbox', { name: 'Message IRA' }).fill('Find duplicate invoices in Q1');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Question 1 of 4')).toBeVisible({ timeout: 6000 });
}

test('count, no skip, Back/Next, required-to-advance', async ({ page }) => {
  await openClarification(page);

  // No "Skip" control anywhere on the card.
  await expect(page.getByRole('button', { name: /^Skip/ })).toHaveCount(0);

  // Q1 is single-select → radio buttons, not checkboxes.
  await expect(page.getByRole('radio').first()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  // Next is disabled until the question is answered (answering is required).
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();

  // Back exists but is disabled on the first question.
  await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled();

  // Pick an option → Next enables → advance.
  await page.locator('[role=radio], [role=checkbox]').first().click();
  await expect(next).toBeEnabled();
  await next.click();

  // Q2: count advances, Back now enabled.
  await expect(page.getByText('Question 2 of 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/clarification-q2.png' });
});

test('multiple-choice question accepts several ticks', async ({ page }) => {
  await openClarification(page);

  // Answer the three single-select questions to reach Q4 (matching logic = multi).
  for (const label of ['Question 1 of 4', 'Question 2 of 4', 'Question 3 of 4']) {
    await expect(page.getByText(label)).toBeVisible();
    await page.locator('[role=radio], [role=checkbox]').first().click();
    await page.getByRole('button', { name: 'Next' }).click();
  }

  await expect(page.getByText('Question 4 of 4')).toBeVisible();
  await expect(page.getByText('Select all that apply')).toBeVisible();

  // Tick two checkboxes — both stay checked (true multi-select).
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).click();
  await boxes.nth(1).click();
  await expect(boxes.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(boxes.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Done' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/clarification-multi.png' });
});

test('corner ✕ cancels the card without running', async ({ page }) => {
  await openClarification(page);
  await page.getByRole('button', { name: 'Close clarification' }).click();
  // Card is gone and no audit run started.
  await expect(page.getByText('Question 1 of 4')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop generating' })).toHaveCount(0);
});
