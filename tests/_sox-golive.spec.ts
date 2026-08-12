import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

/**
 * SOX / ICFR — engagement creation, locked materiality, TOD completeness.
 *
 * 1) A SOX engagement is created and lands in the library.
 * 2) The materiality worksheet reads as locked on the audit's Configuration tab.
 * 3) TOD: control completeness gates "Conclude effective" until every required
 *    element has evidence attached.
 *
 * Rewritten 12 Aug 2026. This file used to drive a creation SIDE DRAWER that
 * uploaded a one-month GL, detected the entity from it, prefilled a benchmark
 * table and ended in a "Go live — lock materiality" button. None of that is in
 * the product any more — the strings do not exist anywhere in src — so those
 * assertions were red against a feature that had been removed, not a bug. What
 * survives is creation itself, which now runs through the four-step sheet off
 * Engagements, and the locked worksheet, which is read where materiality
 * actually lives.
 */

test('a SOX engagement is created and lands in the library', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  // The shared helper walks the current route: Engagements → New Engagement →
  // SOX / ICFR → Basics → Review → Create.
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await expect(page.getByRole('heading', { name: 'FY27 ICFR — Airline Group' })).toBeVisible({ timeout: 15_000 });
});

test('the worksheet reads as locked; control completeness gates the TOD conclusion', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  // The engagement-level Configuration TAB is parked out of the tab strip, and
  // this engagement has no audits, so there is no audit Configuration either.
  // Materiality survives as the "Entities & scope" drill-in off the Overview,
  // which is where the locked worksheet is now read.
  await page.getByText('Entities & scope').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Materiality is locked', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Allocation to significant account groups')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await page.waitForTimeout(600);

  // TOD — one required element without evidence → conclude locked.
  //
  // Two hops, not one. The Control Library opens the LIBRARY page for a control
  // (attributes, workflow mapping) — the five-step testing page lives behind the
  // audit-run card on it, and that is where the meters and the conclusions are.
  // The meter is called "Control completeness" now and states its fraction on
  // its own line, so the count is read there rather than out of the old caption.
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('Invoices are matched three-way').first().click();
  await page.waitForTimeout(1200);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }
  const meter = page.getByText('Control completeness').first();
  await expect(meter).toBeVisible({ timeout: 15_000 });
  // The meter cards open on click; the fraction is in the body, not the face.
  await meter.click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/2\/3 required elements evidenced/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Conclude effective/ }).first()).toBeDisabled();
  // Attach the missing evidence → completeness reaches 100%. The conclusion does
  // NOT open on that alone: a second gate asks whether the design checks were
  // validated, and it is named separately. This used to assert the button went
  // live here, which stopped being true when that gate was added — completeness
  // is one of the preconditions, not the only one.
  await page.getByRole('button', { name: 'Attach evidence' }).first().click();
  await expect(page.getByText(/3\/3 required elements evidenced/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Conclude effective/ }).first()).toBeDisabled();
  await expect(page.getByText(/design checks? not validated yet/)).toBeVisible();
});
