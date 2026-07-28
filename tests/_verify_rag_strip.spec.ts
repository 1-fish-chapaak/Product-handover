import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/wp-preview-shots';

/**
 * Confidence scores as tinted cards in a 3-column grid: the Overview tab
 * rolls up RACM, control effectiveness and sample testing engagement-wide;
 * the control page keeps its own trio (completeness, evidence validated —
 * TOE-based, TOD coverage confidence). Each card = ring beside the heading,
 * fraction below it, status word top-right, one-line explainer.
 */
test('RAG meters — trio on control page, trio on Overview', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');

  // Overview: engagement-wide trio with status words + explainers
  await expect(page.getByText('Engagement health', { exact: true })).toBeVisible();
  for (const label of ['RACM', 'Control effectiveness', 'Sample testing']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/\d+\/\d+ rows approved/)).toBeVisible();
  await expect(page.getByText(/\d+\/\d+ controls effective/)).toBeVisible();
  await expect(page.getByText('Needs attention').first()).toBeVisible();
  await expect(page.getByText(/Pre-testing review across the register/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-overview-rag.png` });

  // Control detail: only the design/control trio — Evidence validated reads
  // the TOE (operating checks run), not the design checks
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Procure to Pay transactions are approved before processing.').first().click();
  await page.waitForTimeout(800);
  for (const label of ['Control completeness', 'Evidence validated', 'TOD coverage confidence']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/\d+\/\d+ operating checks run/)).toBeVisible();
  await expect(page.getByText('Sample testing', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/rows approved/)).toHaveCount(0);
  await expect(page.getByText('Control effectiveness', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/11-control-rag-trio.png` });
});
