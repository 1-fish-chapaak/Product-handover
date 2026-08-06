import { test, expect } from './_helpers';

/**
 * SOX / ICFR — the grading thresholds are editable, but nothing reaches the
 * engagement until it has been reviewed against the exceptions it would move and
 * given a reason.
 *
 * REWRITTEN Aug 2026 (Step-2 action item 24). This spec used to assert the
 * opposite — that the screen was read-only, which is what 7493a8d built on
 * 20 Jul. The 23 Jul merge (24c5264) took main's side of extraViews.tsx
 * wholesale and made the fields live again, so this file has been asserting a
 * screen that stopped existing that day, and nobody noticed because its
 * navigation was stale enough that it never reached the assertions. The product
 * decision now is deliberate and the other way round: editable, but guarded.
 *
 * Walked on the Altura engagement, not the flagship: the flagship carries a
 * `materialityBasis`, which renders the locked worksheet instead of the three
 * threshold fields. Scoping-derived engagements are where the editable path is.
 */
test('a threshold change is drafted, reviewed against its re-grades, and logged', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);

  // Into the audit, whose Configuration tab carries the ground rules.
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await page.getByRole('tab', { name: /Configuration/ }).or(
    page.getByRole('button', { name: /^Configuration$/ })).first().click();
  await page.waitForTimeout(1000);

  const overall = page.locator('#materiality-ground-rules input[type=number]').first();
  await expect(overall).toBeVisible({ timeout: 15_000 });

  // ── nothing pending, nothing offered ──
  await expect(page.getByRole('button', { name: /Review & apply/ })).toHaveCount(0);

  // ── edit a threshold: it drafts, it does not commit ──
  await overall.fill('90000000');
  await page.waitForTimeout(500);
  await expect(page.getByText('Not saved yet.')).toBeVisible();
  const review = page.getByRole('button', { name: /Review & apply/ });
  await expect(review).toBeVisible();

  // ── the review states the consequence and refuses without a reason ──
  await review.click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading', { name: 'Review & apply' })).toBeVisible();
  await expect(page.getByText('What changes')).toBeVisible();

  const apply = page.getByRole('button', { name: 'Apply the change' });
  await expect(apply).toBeDisabled();
  await page.locator('.modal textarea').first().fill('Audited revenue came in above the planning estimate; materiality re-cut on the final figure.');
  await expect(apply).toBeEnabled();
  await apply.click();
  await page.waitForTimeout(900);

  // ── and it is on the record, where somebody can find it ──
  await expect(page.getByText('Changes to the ground rules')).toBeVisible();
  await expect(page.getByText(/Audited revenue came in above the planning estimate/)).toBeVisible();
  // the pending bar clears once applied — the draft IS the saved value now
  await expect(page.getByText('Not saved yet.')).toHaveCount(0);
});

/** Discarding a draft puts the stated thresholds back and offers nothing. */
test('a drafted threshold can be discarded without touching the engagement', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await page.getByRole('tab', { name: /Configuration/ }).or(
    page.getByRole('button', { name: /^Configuration$/ })).first().click();
  await page.waitForTimeout(1000);

  const overall = page.locator('#materiality-ground-rules input[type=number]').first();
  await expect(overall).toBeVisible({ timeout: 15_000 });
  const before = await overall.inputValue();

  await overall.fill('12345678');
  await page.waitForTimeout(400);
  await expect(page.getByText('Not saved yet.')).toBeVisible();

  await page.getByRole('button', { name: 'Discard' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Not saved yet.')).toHaveCount(0);
  await expect(overall).toHaveValue(before);
});
