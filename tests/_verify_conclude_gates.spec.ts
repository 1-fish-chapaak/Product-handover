import { test, expect } from './_helpers';
import { concludeIpeReliable, createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/conclude-gates-shots';

/**
 * The two gates on the control page:
 * 1. Design can't conclude effective while any design check is unvalidated.
 * 2. Every control extracts a sample (no automated bypass), and TOE can't
 *    conclude effective without an approved sample.
 * Walked on a fresh scoping-born engagement (created from Engagements — the
 * SOX Testing sidebar entry is parked). PX-05 is an Automated control, the
 * exact no-bypass repro.
 */
test('conclude gates: validated checks before design, sample before TOE', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await page.getByRole('main').getByRole('button', { name: /Control Library/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Procure to Pay exceptions are escalated and resolved per policy').first().click();
  await page.waitForTimeout(1000);

  // finish the evidence so ONLY the unvalidated checks hold the gate
  const attachButtons = page.getByRole('button', { name: 'Attach evidence' });
  while (await attachButtons.count() > 0) {
    await attachButtons.first().click();
    await page.waitForTimeout(1200);
  }

  // Gate 1 — evidence complete (the confidence card says so), checks not
  // validated → Conclude effective locked
  await expect(page.getByText('Control completeness', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+\/\d+ required elements evidenced/)).toBeVisible();
  const concludeDesign = page.getByRole('button', { name: 'Conclude effective' }).first();
  await expect(concludeDesign).toBeDisabled();
  await expect(page.getByText(/\d+ design checks? not validated yet/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-design-gate-locked.png`, fullPage: true });

  // Validate all → gate opens
  await page.getByRole('button', { name: 'Validate all' }).click();
  await page.waitForTimeout(6800);
  await expect(concludeDesign).toBeEnabled();
  await concludeDesign.click();
  await page.waitForTimeout(600);

  // Gate 2 — the report behind the population is proven before the sample opens.
  // This is a gate in its own right: an unproven extract is the wrong population.
  await concludeIpeReliable(page);

  // Gate 3 — the AUTOMATED control still runs the extract journey (no bypass)…
  await expect(page.getByText('No sample needed')).toHaveCount(0);
  await expect(page.getByText('Required files')).toBeVisible();
  // …and TOE's effective conclusion is locked until the sample is approved
  await expect(page.getByText(/extract and approve a sample in step 2 first/)).toBeVisible();

  // Walk the two-file extraction; approving unlocks the TOE conclusion
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add a file' });
  await picker.getByRole('button', { name: /^Upload/ }).click();
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: 'Add more' }).click();
  await picker.getByRole('button', { name: /^Upload/ }).click();
  await page.waitForTimeout(1700);
  await expect(page.getByText('2/2 required inputs satisfied')).toBeVisible();
  await page.getByPlaceholder(/Explain how to filter the transactions/).fill('Escalated exceptions above ₹10L, all quarters');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(2200);
  await page.getByRole('button', { name: 'Approve and continue' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Sample approved/).first()).toBeVisible();
  await expect(page.getByText(/extract and approve a sample in step 2 first/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/02-toe-unlocked.png`, fullPage: true });
});
