import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The New audit wizard, end to end, after the rework:
 *
 *  Period      — named cycles gone, custom dates only, rounds keep their names
 *  Materiality — basis cards, performance / clearly-trivial %, computed card
 *  Scope       — entities derived from the trial balance, overridden by toggle
 *  Review      — the numbers survive to the summary and the audit is created
 *
 * Runs against FY26 ICFR — Altura Infra Group (SOX-104), the one engagement
 * this work is scoped to.
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

/** Fill the period step. The pickers are the app's own component: the trigger is
 *  a button showing the dd/mm/yyyy placeholder, and the calendar renders in a
 *  PORTAL outside the sheet, so days are looked up on `page`, not on `sheet`. */
async function fillPeriod(page: Page, sheet: ReturnType<Page['getByRole']>) {
  const triggers = sheet.getByRole('button', { name: /dd\/mm\/yyyy/ });
  // From — today.
  await triggers.first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(300);
  // To — today as well (minDate makes anything earlier unselectable).
  await sheet.getByRole('button', { name: /dd\/mm\/yyyy/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(300);
}

test('period step drops the named cycles and keeps the rounds', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openWizard(page);

  // Gone: the four year-type buttons.
  for (const label of ['Financial year', 'Calendar year', 'Quarter', 'Custom range']) {
    await expect(sheet.getByRole('button', { name: label })).toHaveCount(0);
  }
  await expect(sheet.getByText('Year type')).toHaveCount(0);

  // Kept: the three rounds, now names only — no derived date span beneath them.
  for (const label of ['Interim', 'Roll-forward', 'Year-end']) {
    await expect(sheet.getByRole('button', { name: new RegExp(`^${label}$`) })).toBeVisible();
  }
  await expect(sheet.getByText(/Apr – Sep|Oct – Dec|Jan – Mar/)).toHaveCount(0);

  // From / To are the app's picker (a button), never a native date input.
  await expect(sheet.locator('input[type="date"]')).toHaveCount(0);

  // Continue waits for both dates.
  await expect(sheet.getByRole('button', { name: /Continue/ })).toBeDisabled();
  await fillPeriod(page, sheet);
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
