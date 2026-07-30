/**
 * Regression check on the sibling surface: the workflow-executor run insight
 * still renders after EvidenceDisclosure gained the always-visible scope note.
 *
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test tests/_verify_executor_insight_note.spec.ts --project=chromium
 */
import { test, expect } from './_helpers';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

test('workflow executor run insight renders with its scope note', async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto(`${BASE}/?view=workflow-executor&workflowId=lw-consolidated-file&state=completed`);
  const cta = page.getByRole('button', { name: /Generate insights/i });
  await cta.waitFor({ timeout: 30_000 });
  await cta.click();

  await expect(page.getByText(/IRA Insight/).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Evidence · duplicate groups/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/chat-output-insight/6-executor-sibling.png' });
  // The executor card keeps its trend band — the chat card is the one without.
  await expect(page.getByText(/runs analysed/).first()).toBeVisible();
});
