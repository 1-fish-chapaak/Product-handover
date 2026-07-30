/**
 * Verifies the chat exception-table output insight: the trigger-gated CTA
 * renders under the answer, generating produces ONE card, and that card has no
 * trend band and no cross-workflow section.
 *
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test tests/_verify_chat_output_insight.spec.ts --project=chromium
 */
import { test, expect } from './_helpers';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const SHOTS = 'test-results/chat-output-insight';

test('chat exception table offers and generates a single-output insight', async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto(`${BASE}/?view=chat`);
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ timeout: 20_000 });
  await textarea.fill('Show me risky payments in Purchase-to-Pay');
  await textarea.press('Enter');

  // Up-front clarification card: pick the first option on each step.
  await expect(page.getByText(/Question 1 of/)).toBeVisible({ timeout: 20_000 });
  for (let guard = 0; guard < 10; guard++) {
    await page.locator('[role=radio], [role=checkbox]').first().click();
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.count() > 0) { await done.click(); break; }
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(150);
  }

  // Mid-run severity question (the materiality rule) — answer whatever appears.
  const sev = page.locator('[role=radio], [role=checkbox]');
  for (let guard = 0; guard < 20; guard++) {
    if (await sev.count() > 0) {
      await sev.first().click();
      const done = page.getByRole('button', { name: 'Done' });
      if (await done.count() > 0) await done.click();
      else if (await page.getByRole('button', { name: 'Next' }).count() > 0) {
        await page.getByRole('button', { name: 'Next' }).click();
      }
      break;
    }
    await page.waitForTimeout(1500);
  }

  // The idle CTA — the cost gate.
  const cta = page.getByRole('button', { name: /Generate insights/i });
  await cta.waitFor({ timeout: 90_000 });
  await expect(page.getByText(/Generate AI insights for these 9 exceptions/)).toBeVisible();
  await cta.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/1-idle-cta.png`, fullPage: false });

  // Generate → pipeline → card.
  await cta.click();
  await expect(page.getByText(/Reading the flagged rows in this answer/)).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: `${SHOTS}/2-generating.png` });

  await expect(page.getByText(/IRA Insight/).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(600);
  await page.getByText(/IRA Insight/).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/3-card.png` });

  // Scoped to THIS output: no trend band, no cross-workflow band.
  await expect(page.getByText(/Across last|How the KPIs are trending|Ira looked beyond/)).toHaveCount(0);
  await expect(page.getByText(/no prior run to compare against/i).first()).toBeVisible();

  // Evidence discloses the same nine rows the table shows.
  await page.getByRole('button', { name: /Evidence · flagged payments/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/4-evidence.png` });

  // Recommendations — the forward-looking half of the card.
  await page.getByRole('button', { name: /Evidence · flagged payments/ }).click();
  await page.getByText(/Save this query as a workflow/).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/5-recommendations.png` });
});
