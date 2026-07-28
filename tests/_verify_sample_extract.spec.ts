import { test, expect } from './_helpers';

const SHOT_DIR = '/Users/aasthajain/.claude/jobs/937047f0/tmp/sox-v2-shots';

/**
 * The control page is a 3-step journey now:
 * ① Test of design → ② Extract sample (population upload → chat logic →
 * follow-up filters → approve / reject-with-confirm) → ③ TOE without any
 * inline sample extraction. Walked on a rolled-forward (carried) cycle where
 * design is already Effective so step 2 is unlocked and no sample exists yet.
 */
test('extract-sample step: upload → logic → filter → reject → redo → approve', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);

  // Roll FY26 into FY27 — carried mode: design Effective, TOE fresh, no sample
  await page.getByRole('button', { name: 'Roll forward', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Continue' }).click();
  const rollUploads = page.getByRole('button', { name: /Upload FY27 trial balance/ });
  while (await rollUploads.count() > 0) {
    await rollUploads.first().click();
    await page.waitForTimeout(950);
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(700);
  await page.getByText('FY27 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);

  // T-01 is Manual with design carried Effective — the exact step-2 audience
  await page.getByText('Payment runs approved by two authorisers').first().click();
  await page.waitForTimeout(1000);

  // The three steps, in order; step 2 awaits extraction, TOE points at step 2
  await expect(page.getByRole('heading', { name: 'Test of design' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Extract sample' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test of operating effectiveness' })).toBeVisible();
  await expect(page.getByText('Awaiting extraction')).toBeVisible();
  await expect(page.getByText(/No sample yet — extract and approve one in step 2/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/09-dossier-3-steps.png`, fullPage: true });

  // Journey 1 — upload, explain the logic, send, then REJECT
  await page.getByRole('button', { name: 'Upload population file' }).click();
  await page.waitForTimeout(1600);
  await expect(page.getByText('population.xlsx')).toBeVisible();
  await page.getByPlaceholder(/Explain how to pull the sample/).fill('Payment runs above ₹10L, weighted to quarter-ends');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText(/Extracted sample/)).toBeVisible();
  await expect(page.getByText(/25 of 25 rows/)).toBeVisible();

  // follow-up filter narrows the extract (second-level, data-related)
  await page.getByRole('button', { name: 'H2 only (Oct–Mar)' }).click();
  await expect(page.getByText(/of 25 rows after filters/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-sample-review-filters.png`, fullPage: true });

  // Reject → confirmation warns the progress is gone → journey restarts
  await page.getByRole('button', { name: 'Reject and try again' }).click();
  await expect(page.getByText('Reject this sample?')).toBeVisible();
  await expect(page.getByText(/progress will be gone/)).toBeVisible();
  await page.getByRole('button', { name: 'Reject and start over' }).click();
  await expect(page.getByRole('button', { name: 'Upload population file' })).toBeVisible();
  await expect(page.getByText(/Extracted sample/)).toHaveCount(0);

  // Journey 2 — redo end to end and APPROVE
  await page.getByRole('button', { name: 'Upload population file' }).click();
  await page.waitForTimeout(1600);
  await page.getByPlaceholder(/Explain how to pull the sample/).fill('High-value payment runs, exclude intercompany');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Amount ≥ ₹50L' }).click();
  await page.getByRole('button', { name: 'Approve and continue' }).click();
  await page.waitForTimeout(600);

  // Approved: toast, step-2 chip with the count, TOE context strip reads it
  await expect(page.getByText('Sample approved', { exact: true })).toBeVisible();
  await expect(page.getByText(/Sample approved · \d+ items/)).toBeVisible();
  await expect(page.getByText(/Testing \d+ sampled items/)).toBeVisible();
  await expect(page.getByText(/extracted by logic: “High-value payment runs/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-sample-approved.png`, fullPage: true });
});
