import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The design gate on the control page: a control cannot conclude effective while
 * any design check is still unvalidated, even with every required element
 * evidenced. Completeness and validation are two different questions, and the
 * screen has to say which one is holding the conclusion.
 *
 * Rewritten 12 Aug 2026, and cut back to what the product still does.
 *
 * Three things had rotted underneath it. It created a fresh engagement and then
 * clicked a control inside it — the wizard's Scoping step is parked, so a new
 * engagement now arrives with no RACM and no controls at all. It clicked the
 * control in the Control Library and expected the five-step testing page — that
 * page is one hop further, behind the control's audit-run card. And its whole
 * second half drove the old extraction journey ("Required files", "Add a file",
 * "2/2 required inputs satisfied", "Explain how to filter the transactions",
 * "Approve and continue"): the population step was rewritten on 31 July and
 * those strings no longer exist in src. The current five-step page, extraction
 * included, is covered by `_verify_control_flow_v2` and `_sox-prd-unverified`.
 *
 * The gate cannot be OPENED from here any more either: "Validate all" and the
 * per-check "Validate" button are both parked (ControlDossier.tsx:1407, :707).
 * So this asserts the gate holds and names its reason, which is the behaviour
 * that matters and the part a regression would break.
 */
test('conclude gates: validated checks before design', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Airline P2P & O2C');
  await page.getByRole('main').getByRole('button', { name: /Control Library/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Procure to Pay exceptions are escalated and resolved per policy').first().click();
  await page.waitForTimeout(1200);
  // The library page for a control; the five-step testing page — where the gates
  // are — is behind its audit-run card.
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }

  // finish the evidence so ONLY the unvalidated checks hold the gate
  const attachButtons = page.getByRole('button', { name: 'Attach evidence' });
  while (await attachButtons.count() > 0) {
    await attachButtons.first().click();
    await page.waitForTimeout(1200);
  }

  // Evidence complete — the confidence card says so.
  await expect(page.getByText('Control completeness', { exact: true })).toBeVisible();
  // The meter cards open on click; the fraction is in the body, not the face.
  await page.getByText('Control completeness', { exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/\d+\/\d+ required elements evidenced/)).toBeVisible();

  // …and the conclusion is still held, by the checks rather than by the files.
  await expect(page.getByRole('button', { name: 'Conclude effective' }).first()).toBeDisabled();
  await expect(page.getByText(/\d+ design checks? not validated yet/)).toBeVisible();
});
