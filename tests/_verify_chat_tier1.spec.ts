import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Tier-1 chat polish verification:
//  1. Stop button stays visible through the audit loader (+ leaves a "Stopped" marker)
//  4. Query/Workflow mode toggle — interactive on the start composer (two states),
//     read-only (role=status, not a toggle) inside an open chat.
// (Fix 2 = Process Hub "Create workflow" URL and Fix 3 = report persistence are
//  verified by code + tsc; they live in BusinessProcesses.tsx / App.tsx.)
//
// NOTE: a query now opens a clarification card that HIDES the chat composer until
// it's answered, so the in-chat/loader checks first answer the card.

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

// Answer every clarification question (single = radio, multi = checkbox) then Done.
async function answerClarification(page: Page) {
  await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 6000 });
  for (let guard = 0; guard < 8; guard++) {
    await page.locator('[role=radio], [role=checkbox]').first().click();
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.count() > 0) { // Done renders only on the last question
      await expect(done).toBeEnabled();
      await done.click();
      break;
    }
    const next = page.getByRole('button', { name: 'Next' });
    await expect(next).toBeEnabled();
    await next.click();
  }
}

test('Fix 4 — start composer: Query/Workflow mode toggle, Q&A vs Workflow', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);

  // Mode control is a Query/Workflow segmented toggle (radiogroup): Query (Q&A)
  // is selected by default; clicking Workflow switches modes.
  const query = page.getByRole('radio', { name: 'Query' });
  const workflow = page.getByRole('radio', { name: 'Workflow' });
  await expect(query).toBeVisible();
  await expect(query).toHaveAttribute('aria-checked', 'true'); // Q&A by default
  await expect(workflow).toHaveAttribute('aria-checked', 'false');
  await page.waitForTimeout(2200); // let the placeholder type in
  await page.screenshot({ path: 'test-results/chat-composer-qna.png' });

  await workflow.click();
  await expect(workflow).toHaveAttribute('aria-checked', 'true'); // workflow on
  await expect(query).toHaveAttribute('aria-checked', 'false');
  await page.waitForTimeout(2600); // placeholder retypes to the workflow copy
  await page.screenshot({ path: 'test-results/chat-composer-workflow.png' });
});

test('Fix 4 — in-chat composer shows a read-only mode indicator (after clarification)', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);

  await page.getByRole('textbox', { name: 'Message Ira' }).fill('What were our top vendor risks last quarter?');
  await page.getByRole('button', { name: 'Send message' }).click();
  // The clarification hides the composer; answer it so the composer returns.
  await answerClarification(page);

  const indicator = page.getByRole('status', { name: /Q&A|workflow/i });
  await expect(indicator).toBeVisible({ timeout: 8000 });
  // The interactive mode toggle must NOT be present in-thread (read-only).
  await expect(page.getByRole('radiogroup', { name: 'Composer mode' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/chat-inchat-indicator.png' });
});

test('Composer is hidden while a clarification is open (single input surface)', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);

  await page.getByRole('textbox', { name: 'Message Ira' }).fill('Find duplicate invoices in Q1');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Question 1 of 4')).toBeVisible({ timeout: 6000 });

  // While the card is open: no "Reply to Ira" mode indicator, but the card has its own "+".
  await expect(page.getByRole('status', { name: /Q&A|workflow/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Attach data sources or files' })).toBeVisible();
});

test('Fix 1 — Stop stays visible during the audit loader, then leaves a Stopped marker', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);

  await page.getByRole('textbox', { name: 'Message Ira' }).fill('Find duplicate invoices in Q1');
  await page.getByRole('button', { name: 'Send message' }).click();
  await answerClarification(page);

  // Loading phase (~7s): the Stop button must be visible — this is the fix.
  const stop = page.getByRole('button', { name: 'Stop generating' });
  await expect(stop).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/chat-stop-during-load.png' });

  // Clicking Stop leaves a "Stopped" breadcrumb (handler already existed).
  await stop.click();
  await expect(page.getByText(/stopped/i).first()).toBeVisible({ timeout: 5000 });
});
