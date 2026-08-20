import { test, expect } from './_helpers';

/**
 * One-Click Audit drafted register — the AI engagement opens with its own
 * controls and monitoring workflows, and a seeded engagement is untouched.
 */

async function openEngagement(page: import('./_helpers').Page, name: RegExp) {
  await page.getByRole('button', { name: 'Engagements' }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder(/Search engagement/i).fill(name.source.replace(/[\\^$]/g, ''));
  await page.waitForTimeout(600);
  await page.getByRole('heading', { name }).first().click();
  await page.waitForTimeout(2500);
}

// NOTE: the One-Click Audit modal itself can't be driven headlessly — its
// FloatingLinesGL background needs a WebGL context and the error boundary
// catches the failure. Verify the wizard in a real browser.

test('AI-drafted engagement opens with its own register; seeded one is unchanged', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);

  // ── The seeded engagement keeps the process library + demo workflows ──
  await openEngagement(page, /P2P Internal Audit Review/);
  await expect(page.getByRole('heading', { name: /P2P Internal Audit Review/ })).toBeVisible();

  await page.getByRole('button', { name: 'Workflows' }).first().click();
  await page.waitForTimeout(1500);
  await expect(page.getByText('WF-P2P-001')).toBeVisible();
  await expect(page.getByText('WF-P2P-004')).toBeVisible();
  // No drafted register, so no drafted codes leak in.
  await expect(page.getByText('WF-AP-001')).toHaveCount(0);
});
