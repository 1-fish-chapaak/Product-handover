import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/sample-extract-shots';

/**
 * The control page's step 2 — Extract sample — takes TWO files (population +
 * transactions) through one Upload button: the picker offers a fresh upload or
 * the engagement's own scoping files, and whatever arrives is matched to the
 * requirement it satisfies by name. The extract review is a plain table (the
 * suggested-filter chips are gone) — approve locks the sample for TOE, reject
 * restarts the journey and releases both files.
 *
 * Walked on a scoping-born engagement created from Engagements; the design
 * step is concluded first so step 2 unlocks.
 */
test('extract-sample step: two files → logic → reject → redo → approve', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Procure to Pay transactions are approved before processing.').first().click();
  await page.waitForTimeout(1000);

  // Unlock step 2: evidence → validate → conclude the design effective
  const attachButtons = page.getByRole('button', { name: 'Attach evidence' });
  while (await attachButtons.count() > 0) {
    await attachButtons.first().click();
    await page.waitForTimeout(1200);
  }
  await page.getByRole('button', { name: 'Validate all' }).click();
  await page.waitForTimeout(6800);
  await page.getByRole('button', { name: 'Conclude effective' }).first().click();
  await page.waitForTimeout(600);

  // ── Both requirements stated up front, neither satisfied ──────────────────
  await expect(page.getByText('Required files')).toBeVisible();
  await expect(page.getByText('2 required · 2 total')).toBeVisible();
  await expect(page.getByText('Population (master data)')).toBeVisible();
  await expect(page.getByText('Transactions', { exact: true })).toBeVisible();

  // The logic box is usable before any file arrives — but Send is not
  const logicBox = page.getByPlaceholder(/Explain how to filter the transactions/);
  await expect(logicBox).toBeVisible();
  const send = page.getByRole('button', { name: 'Send' });
  await expect(send).toBeDisabled();
  await logicBox.fill('Payment runs above ₹10L, weighted to quarter-ends');
  await expect(send).toBeDisabled();
  await page.screenshot({ path: `${SHOT_DIR}/01-files-empty.png`, fullPage: true });

  // ── File 1: a fresh upload, matched to the population on its own ──────────
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add a file' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: /^Upload/ }).click();
  await page.waitForTimeout(1700);
  await expect(page.getByText('population.xlsx')).toBeVisible();
  await expect(page.getByText('1/2 required inputs satisfied')).toBeVisible();
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

  // Fix the draw at 25 so the count is stable
  await page.getByLabel('Sample rows').selectOption('25');
  await send.click();
  await page.waitForTimeout(2200);

  // The extract review is a plain table — no suggested-filter chips
  await expect(page.getByText(/Extracted sample/)).toBeVisible();
  await expect(page.getByText(/· 25 rows/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'H2 only (Oct–Mar)' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Amount ≥ ₹50L' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/02-extract-review.png`, fullPage: true });

  // Reject → confirm → journey restarts and BOTH files are released
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
  await expect(page.getByText(/Extracted sample/)).toHaveCount(0);

  // answering clears the ask, and the run goes through to approval
  await logicBox.fill('High-value payment runs, exclude intercompany');
  await expect(page.getByText(/No extraction logic — nothing to filter/)).toHaveCount(0);
  await page.getByLabel('Sample rows').selectOption('25');
  await send.click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Approve and continue' }).click();
  await page.waitForTimeout(600);

  // Approved: toast, the TOE context strip reads the sample, and the basis
  // names the population and the typed logic (no filter clause any more)
  await expect(page.getByText('Sample approved', { exact: true })).toBeVisible();
  await expect(page.getByText(/Testing \d+ sampled items/)).toBeVisible();
  await expect(page.getByText(/items drawn from population\.xlsx/).first()).toBeVisible();
  await expect(page.getByText(/transactions filtered by: “High-value payment runs/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-sample-approved.png`, fullPage: true });
});
