import { test, expect } from './_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/wp-preview-shots';

/**
 * RAG meters split across two pages: the control detail page keeps its own
 * design-step trio (completeness, evidence validated, TOD coverage confidence);
 * the Overview tab rolls up RACM, control effectiveness and sample testing
 * engagement-wide. Rings are red/amber/green.
 */
test('RAG meters — trio on control page, trio on Overview', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // Overview: engagement-wide trio
  await expect(page.getByText('Engagement health', { exact: true })).toBeVisible();
  for (const label of ['RACM', 'Control effectiveness', 'Sample testing']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText(/\d+\/\d+ rows approved/)).toBeVisible();
  await expect(page.getByText(/\d+\/\d+ controls effective/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-overview-rag.png` });

  // Control detail: only the design-step trio
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Procure to Pay transactions are approved before processing.').first().click();
  await page.waitForTimeout(800);
  for (const label of ['Control completeness', 'Evidence validated', 'TOD coverage confidence']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('Sample testing', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/rows approved/)).toHaveCount(0);
  await expect(page.getByText('Control effectiveness', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/11-control-rag-trio.png` });
});
