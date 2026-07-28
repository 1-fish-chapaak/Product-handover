import { test, expect } from './_helpers';

const SHOT_DIR = '/Users/aasthajain/.claude/jobs/937047f0/tmp/sox-v2-shots';

/**
 * The two new gates on the control page:
 * 1. Design can't conclude effective while any design check is unvalidated.
 * 2. Every control extracts a sample (no automated bypass), and TOE can't
 *    conclude effective without an approved sample.
 * PX-05 on the live FY26 workspace is the exact repro: evidence complete once
 * the walkthrough attaches, checks unvalidated — and it's an Automated control.
 */
test('conclude gates: validated checks before design, sample before TOE', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
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

  // Gate 1 — evidence complete, checks not validated → Conclude effective locked
  await expect(page.getByText(/Design completeness — 2 of 2/)).toBeVisible();
  const concludeDesign = page.getByRole('button', { name: 'Conclude effective' }).first();
  await expect(concludeDesign).toBeDisabled();
  await expect(page.getByText(/2 design checks not validated yet/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/12-design-gate-locked.png`, fullPage: true });

  // Validate all → gate opens
  await page.getByRole('button', { name: 'Validate all' }).click();
  await page.waitForTimeout(6800);
  await expect(concludeDesign).toBeEnabled();
  await concludeDesign.click();
  await page.waitForTimeout(600);

  // Gate 2 — the AUTOMATED control still runs the extract journey (no bypass)…
  await expect(page.getByText('No sample needed')).toHaveCount(0);
  await expect(page.getByText('Awaiting extraction')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload population file' })).toBeVisible();
  // …and TOE's effective conclusion is locked until the sample is approved
  await expect(page.getByText(/extract and approve a sample in step 2 first/)).toBeVisible();

  // Walk the extraction; approving unlocks the TOE conclusion
  await page.getByRole('button', { name: 'Upload population file' }).click();
  await page.waitForTimeout(1600);
  await page.getByPlaceholder(/Explain how to pull the sample/).fill('Escalated exceptions above ₹10L, all quarters');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Approve and continue' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Sample approved · \d+ items/)).toBeVisible();
  await expect(page.getByText(/extract and approve a sample in step 2 first/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/13-toe-unlocked-after-sample.png`, fullPage: true });
});
