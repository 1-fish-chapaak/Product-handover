import { test, expect } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies attached items render as chips ABOVE the sent user message (image 6),
// not as "[Attached: …]" text inside the bubble (image 7).

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
});

test('attached source shows as a chip above the message, no [Attached:] text', async ({ page }) => {
  await page.goto('/?view=chat');
  await enterWorkspace(page);

  // Open the data picker (composer "+") and pick an existing source.
  await page.getByRole('button', { name: 'Attach data sources or files' }).first().click();
  await page.getByText('All Data', { exact: false }).first().click();

  const firstRow = page.locator('li button[aria-pressed]').first();
  await firstRow.waitFor({ timeout: 5000 });
  const name = (await firstRow.locator('.flex-1 .truncate').first().innerText()).trim();
  await firstRow.click();

  const attach = page.getByRole('button', { name: /^Attach \d/ }); // footer "Attach 1", not the "+"
  await expect(attach).toBeEnabled({ timeout: 4000 });
  await attach.click();

  // Chip shows in the composer first.
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 4000 });

  // Type a message and send.
  await page.getByRole('textbox', { name: 'Message Ira' }).fill('Purchase Price Variance & Open PO Ageing');
  await page.getByRole('button', { name: 'Send message' }).click();

  // The sent message: chip is present above the bubble, and the old
  // "[Attached: …]" text is gone.
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 4000 });
  await expect(page.getByText(/\[Attached:/)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/chat-attachment-chips.png' });
});
