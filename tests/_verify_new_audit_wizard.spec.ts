import { test, expect } from './_helpers';
import { fillAuditPeriod, openFromLibrary } from './_sox_helpers';

/**
 * The New audit wizard, end to end, under the rounds model:
 *
 *  Period      — financial year first, round second, dates derived from both
 *  Materiality — basis cards, performance / clearly-trivial %, computed card
 *  Scope       — entities derived from the trial balance, overridden by toggle
 *  Review      — the numbers survive to the summary and the audit is created
 *
 * Runs against FY26 ICFR — Altura Infra Group (SOX-104), the one engagement
 * this work is scoped to. The round-availability gates and the roll-forward
 * inheritance have their own spec (_verify_audit_rounds).
 */

type Page = import('@playwright/test').Page;

const ENGAGEMENT = 'FY26 ICFR — Altura Infra Group';

async function openWizard(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, ENGAGEMENT);
  await page.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(500);
  const sheet = page.getByRole('dialog', { name: 'New audit' });
  await expect(sheet).toBeVisible();
  return sheet;
}

const fillPeriod = fillAuditPeriod;

test('period step asks year, then round, then derives the dates', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openWizard(page);

  // Year first: the basis toggle and the year dropdown, prefilled with the
  // running financial year.
  await expect(sheet.getByRole('button', { name: 'Apr – Mar', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Jan – Dec', exact: true })).toBeVisible();
  const yearSelect = sheet.getByRole('button', { name: 'Financial year' });
  await expect(yearSelect).toBeVisible();
  await expect(yearSelect).toContainText('FY 2026-27');

  // The rounds, gated: no interim exists for FY 2026-27, so Roll-forward is
  // disabled and says why, while Interim and Year-end stay open.
  await expect(sheet.getByRole('button', { name: 'Interim', exact: true })).toBeEnabled();
  await expect(sheet.getByRole('button', { name: 'Year-end', exact: true })).toBeEnabled();
  await expect(sheet.getByRole('button', { name: 'Roll-forward', exact: true })).toBeDisabled();
  await expect(sheet.getByText('Create and conclude an interim audit for FY 2026-27 first.')).toBeVisible();

  // No dates until the round is chosen — what they can hold depends on it.
  await expect(sheet.getByRole('button', { name: /dd\/mm\/yyyy/ })).toHaveCount(0);
  await expect(sheet.locator('input[type="date"]')).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /Continue/ })).toBeDisabled();

  // Interim: From prefills with the year start, the cut-off is the one date
  // left to pick, and Continue waits on it.
  await sheet.getByRole('button', { name: 'Interim', exact: true }).click();
  await expect(sheet.getByRole('button', { name: '01/04/2026' })).toBeVisible();
  await expect(sheet.getByText('To — interim cut-off')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Continue/ })).toBeDisabled();
  await sheet.getByRole('button', { name: 'dd/mm/yyyy' }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(300);
  await expect(sheet.getByRole('button', { name: /Continue/ })).toBeEnabled();

  // Year-end: From re-prefills with the year start, and the To is the year end
  // rendered locked — nothing left on a placeholder, nothing to pick.
  await sheet.getByRole('button', { name: 'Year-end', exact: true }).click();
  await expect(sheet.getByRole('button', { name: '01/04/2026' })).toBeVisible();
  await expect(sheet.getByText('31 Mar 2027', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /dd\/mm\/yyyy/ })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /Continue/ })).toBeEnabled();
});

test('materiality step asks performance and clearly-trivial, and computes them', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openWizard(page);
  await fillPeriod(page, sheet);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(400);

  // Basis is a dropdown, and it now offers the asset basis too.
  const basis = sheet.getByRole('button', { name: /Materiality basis/i });
  await expect(basis).toBeVisible();
  await basis.click();
  await page.waitForTimeout(300);
  await expect(page.getByText('% of total asset balance').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Defaults: PBT 420 × 5% = ₹21 Cr, PM 75% = ₹15.75 Cr, CT 5% = ₹1.05 Cr.
  await expect(sheet.getByText(/Overall materiality .* — .*% of/)).toHaveCount(0);
  const pm = sheet.getByLabel(/Performance materiality as a percentage/);
  const ct = sheet.getByLabel(/Clearly-trivial threshold as a percentage/);
  await expect(pm).toHaveValue('75');
  await expect(ct).toHaveValue('5');
  await expect(sheet.getByText('₹15.75 Cr').first()).toBeVisible();
  await expect(sheet.getByText('₹1.05 Cr').first()).toBeVisible();

  // The computed-thresholds card restates all three.
  await expect(sheet.getByText('Computed thresholds')).toBeVisible();
  // And the severity ladder is still there.
  await expect(sheet.getByText('Where an exception would land')).toBeVisible();
  await expect(sheet.getByText('Material weakness')).toBeVisible();

  // Editing the percentage re-computes the amount.
  await pm.fill('50');
  await expect(sheet.getByText('₹10.50 Cr').first()).toBeVisible();

  // The two file boxes each carry their own Upload.
  await expect(sheet.getByRole('button', { name: /^Upload$/ })).toHaveCount(2);
});

test('scope step derives entities from the numbers and lets the auditor overrule', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openWizard(page);
  await fillPeriod(page, sheet);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(400);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(500);

  // The removed status line and the two tick columns are gone.
  await expect(sheet.getByText(/in the engagement ·/)).toHaveCount(0);
  await expect(sheet.getByText('Engagement', { exact: true })).toHaveCount(0);
  await expect(sheet.getByText('Data', { exact: true })).toHaveCount(0);

  // Coverage headline, with the target called out.
  await expect(sheet.getByText(/of the group covered/)).toBeVisible();
  await expect(sheet.getByText(/target 60%/)).toBeVisible();
  await expect(sheet.getByText('95.9%')).toBeVisible();

  // Four companies clear ₹15.75 Cr; the rest are reasoned out, not hidden.
  await expect(sheet.getByText(/₹648\.50 Cr clears performance materiality/)).toBeVisible();
  await expect(sheet.getByText(/₹11\.30 Cr is below ₹15\.75 Cr/)).toBeVisible();
  await expect(sheet.getByText('4 entities in scope')).toBeVisible();

  // The toggle overrules the derivation both ways.
  await sheet.getByRole('switch', { name: /Bring Altura Transmission Pvt Ltd into scope/ }).click();
  await page.waitForTimeout(200);
  await expect(sheet.getByText('5 entities in scope')).toBeVisible();
  await sheet.getByRole('switch', { name: /Take Altura Infra Holdings Ltd out of scope/ }).click();
  await page.waitForTimeout(200);
  await expect(sheet.getByText('4 entities in scope')).toBeVisible();
  // Dropping the biggest company must move the coverage bar.
  await expect(sheet.getByText('95.9%')).toHaveCount(0);
});

test('key controls only puts every key control in scope, and off keeps them', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openWizard(page);
  await fillPeriod(page, sheet);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(400);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(500);

  // Opening the RACM side pre-ticks the RACMs the in-scope entities feed.
  await sheet.getByRole('button', { name: /By RACM/ }).click();
  await page.waitForTimeout(500);
  const selectedLine = sheet.getByText(/RACMs? · \d+ controls? selected/);
  await expect(selectedLine).toBeVisible();
  const preTicked = Number(((await selectedLine.textContent()) ?? '').match(/· (\d+) control/)?.[1] ?? 0);
  expect(preTicked).toBeGreaterThan(0);

  // On — every key control across every RACM.
  await sheet.getByRole('switch', { name: /Key controls only/ }).click();
  await page.waitForTimeout(300);
  const selected = selectedLine;
  await expect(selected).toBeVisible();
  const onText = (await selected.textContent()) ?? '';
  const onCount = Number(onText.match(/· (\d+) control/)?.[1] ?? 0);
  expect(onCount).toBeGreaterThan(0);

  // Off — the selection survives, the rest simply unlock.
  await sheet.getByRole('switch', { name: /Key controls only/ }).click();
  await page.waitForTimeout(300);
  const offText = (await selected.textContent()) ?? '';
  expect(Number(offText.match(/· (\d+) control/)?.[1] ?? 0)).toBe(onCount);
});

test('review carries the period, thresholds and scope, and creates the audit', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openWizard(page);
  await fillPeriod(page, sheet);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(400);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(500);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(500);

  await expect(sheet.getByRole('heading', { name: 'Review' })).toBeVisible();
  // The review rows: every threshold the earlier steps asked for survives here.
  await expect(sheet.getByText('Round', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Performance materiality', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Clearly trivial', { exact: true })).toBeVisible();
  await expect(sheet.getByText('₹15.75 Cr').first()).toBeVisible();

  await sheet.getByRole('button', { name: /Create audit|Create/ }).last().click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('dialog', { name: 'New audit' })).toHaveCount(0);
  await expect(page.getByText(/entities in scope/)).toBeVisible();
});
