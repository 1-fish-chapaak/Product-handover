import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/c8722875-a762-4479-850d-6fb25bf1a5a1/scratchpad/rag-shots';

/**
 * Confidence scores as collapsible cards (Aug 2026 user ask).
 *
 * Shut: the ring and the score's name, nothing else — four of them the same
 * height. Open: the fraction, the status, what it means, the formula and the
 * counting rules. Engagement level carries four (RACM · Control effectiveness ·
 * Sample testing · Engagement completeness); the control page carries three.
 */
test('RAG cards — collapsed shows score + heading, expanded shows the logic', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');

  // into the cycle — the engagement Overview lists its rounds
  await page.getByText('CY 2026', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await expect(page.getByText('Audit health', { exact: true })).toBeVisible();

  // four cards, collapsed: heading visible, the fraction and the rules are not
  for (const label of ['RACM completeness', 'Control effectiveness', 'Sample testing', 'Engagement completeness']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/\d+\/\d+ rows approved/)).toHaveCount(0);
  await expect(page.getByText(/How this is counted/).first()).toBeHidden();
  await page.screenshot({ path: `${SHOT_DIR}/01-collapsed.png` });

  // open one — fraction, status and the counting rules arrive
  await page.getByRole('button', { name: /^Sample testing/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/\d+\/\d+ checks done/)).toBeVisible();
  await expect(page.getByText(/operating checks run ÷ operating checks total/)).toBeVisible();
  // the formula, and nothing beyond it — no prose, no counting rules
  await expect(page.getByText(/A check is one sample/)).toHaveCount(0);
  await expect(page.getByText(/Sample-by-attribute checks completed/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/02-expanded.png` });

  // all four open — they hold one common height rather than four ragged columns
  for (const label of ['RACM completeness', 'Control effectiveness', 'Engagement completeness']) {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  const heights = await page.locator('text=How this is counted').evaluateAll(
    els => els.map(el => Math.round(el.closest('.rounded-xl')!.getBoundingClientRect().height)),
  );
  expect(new Set(heights).size).toBe(1);
  await page.screenshot({ path: `${SHOT_DIR}/04-all-expanded.png` });

  // and they shut again
  for (const label of ['RACM completeness', 'Control effectiveness', 'Sample testing', 'Engagement completeness']) {
    await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await page.waitForTimeout(150);
  }
  await expect(page.getByText(/\d+\/\d+ checks done/)).toHaveCount(0);

  // control page — its own three, same behaviour
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1500);
  for (const label of ['Control completeness', 'Evidence validated', 'TOD coverage confidence']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole('button', { name: /^Evidence validated/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/\d+\/\d+ operating checks run/)).toBeVisible();
  // the engagement-level scores stay at engagement level
  await expect(page.getByText(/rows approved/)).toHaveCount(0);
  await expect(page.getByText('Control effectiveness', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/03-control-expanded.png` });
});
