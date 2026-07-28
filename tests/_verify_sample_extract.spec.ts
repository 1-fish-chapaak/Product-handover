import { test, expect } from './_helpers';

const SHOT_DIR = '/Users/aasthajain/.claude/jobs/937047f0/tmp/sox-v2-shots';

/**
 * The control page is a 3-step journey:
 * ① Test of design → ② Extract sample → ③ TOE against the drawn sample.
 *
 * Step 2 takes TWO files — the population (master data) the sample is drawn
 * from, and the transactions the auditor's logic filters. One Upload button
 * serves both: the picker offers a fresh upload or the engagement's own
 * scoping files, and whatever arrives is matched to the requirement it
 * satisfies by name. The extraction logic can be written before either file
 * lands; only Send waits on them.
 *
 * Walked on a rolled-forward (carried) cycle where design is already Effective
 * so step 2 is unlocked and no sample exists yet.
 */
test('extract-sample step: two files → logic → filter → reject → redo → approve', async ({ page }) => {
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

  // ── Both requirements are stated up front, neither satisfied ──────────────
  await expect(page.getByText('Required files')).toBeVisible();
  await expect(page.getByText('2 required · 2 total')).toBeVisible();
  await expect(page.getByText('Population (master data)')).toBeVisible();
  await expect(page.getByText('Transactions', { exact: true })).toBeVisible();
  await expect(page.getByText(/required inputs satisfied/)).toHaveCount(0);

  // The logic box is usable before any file arrives — but Send is not
  const logicBox = page.getByPlaceholder(/Explain how to filter the transactions/);
  await expect(logicBox).toBeVisible();
  const send = page.getByRole('button', { name: 'Send' });
  await expect(send).toBeDisabled();
  await logicBox.fill('Payment runs above ₹10L, weighted to quarter-ends');
  await expect(send).toBeDisabled();
  await page.screenshot({ path: `${SHOT_DIR}/09-dossier-3-steps.png`, fullPage: true });

  // ── File 1: a fresh upload, matched to the population on its own ──────────
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add a file' });
  await expect(picker).toBeVisible();
  await expect(picker.getByText(/matched to the requirement it satisfies/)).toBeVisible();
  await picker.getByRole('button', { name: /^Upload/ }).click();
  await page.waitForTimeout(1700);
  await expect(page.getByText('population.xlsx')).toBeVisible();
  await expect(page.getByText('1/2 required inputs satisfied')).toBeVisible();

  // one requirement still open — the page says so without being asked
  await expect(page.getByText(/Transactions is still missing/)).toBeVisible();
  await expect(send).toBeDisabled();

  // ── File 2: reuse a file the engagement already holds ─────────────────────
  await page.getByRole('button', { name: 'Add more' }).click();
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /^Choose existing/ }).click();
  await picker.getByText(/general_ledger/).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('2/2 required inputs satisfied')).toBeVisible();
  await expect(page.getByText(/is still missing/)).toHaveCount(0);
  await expect(send).toBeEnabled();

  // Sample rows is a system-sized picker — fix it at 25 so the count is stable
  await page.getByLabel('Sample rows').selectOption('25');

  await send.click();
  await page.waitForTimeout(2200);
  await expect(page.getByText(/Extracted sample/)).toBeVisible();
  await expect(page.getByText(/25 of 25 rows/)).toBeVisible();

  // follow-up filter narrows the extract (second-level, data-related)
  await page.getByRole('button', { name: 'H2 only (Oct–Mar)' }).click();
  await expect(page.getByText(/of 25 rows after filters/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/10-sample-review-filters.png`, fullPage: true });

  // Reject → confirmation warns the progress is gone → journey restarts, and
  // BOTH files are released with it
  await page.getByRole('button', { name: 'Reject and try again' }).click();
  await expect(page.getByText('Reject this sample?')).toBeVisible();
  await expect(page.getByText(/progress will be gone/)).toBeVisible();
  await page.getByRole('button', { name: 'Reject and start over' }).click();
  await expect(page.getByText(/Extracted sample/)).toHaveCount(0);
  await expect(page.getByText(/required inputs satisfied/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();

  // ── Journey 2 — send with no rule first: IRA asks for one ─────────────────
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await picker.getByRole('button', { name: /^Upload/ }).click();
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: 'Add more' }).click();
  await picker.getByRole('button', { name: /^Upload/ }).click();
  await page.waitForTimeout(1700);
  await expect(page.getByText('2/2 required inputs satisfied')).toBeVisible();

  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText(/No extraction logic — nothing to filter the transactions on/)).toBeVisible();
  await expect(page.getByText(/Which transactions should I pull for each sampled item/)).toBeVisible();
  await expect(page.getByText(/Extracted sample/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/10b-logic-required.png`, fullPage: true });

  // answering clears the ask, and the run goes through
  await logicBox.fill('High-value payment runs, exclude intercompany');
  await expect(page.getByText(/No extraction logic — nothing to filter/)).toHaveCount(0);
  await page.getByLabel('Sample rows').selectOption('25');
  await send.click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Amount ≥ ₹50L' }).click();
  await page.getByRole('button', { name: 'Approve and continue' }).click();
  await page.waitForTimeout(600);

  // Approved: toast, step-2 chip with the count, TOE context strip reads it,
  // and the basis names both the population it drew from and the filter used
  await expect(page.getByText('Sample approved', { exact: true })).toBeVisible();
  await expect(page.getByText(/Sample approved — \d+ items/)).toBeVisible();
  await expect(page.getByText(/Testing \d+ sampled items/)).toBeVisible();
  await expect(page.getByText(/items drawn from population\.xlsx/).first()).toBeVisible();
  await expect(page.getByText(/transactions filtered by: “High-value payment runs/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/11-sample-approved.png`, fullPage: true });
});
