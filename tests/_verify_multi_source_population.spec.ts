import { test, expect } from './_helpers';

const SHOTS = 'test-results/multi-source-population';

/**
 * One control, several source files.
 *
 * The dev call (Aug 2026): "मल्टीपल फाइल्स वो डाल सकता है" — a control rarely
 * stands on one file, so the population is a LIST of files, each one proven on
 * its own (its own four IPE dimensions) and sampled on its own ("10 फाइल्स
 * होंगी तो 10 रोज़ दिखेंगे… सब पे 'ड्रा सैंपल' वाली चीज़ होगी").
 *
 * What deliberately did NOT change: the Reliable / Not reliable verdict is still
 * ONE for all the files — "सेंट्रलाइज्ड कर दो ना, सिंगल-सिंगल का तो तुम वहीं पे
 * क्रॉस और वो कर दिए हो". The per-file work is the ticks; the verdict is the
 * control's.
 *
 * Walked on Altura's Treasury payments control, which the seed gives two files:
 * the full-period extract it always had, plus a vendor master.
 */
type Page = import('@playwright/test').Page;

async function openAuditControl(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1500);
}

test('the population is a list of files, each with its own proof', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditControl(page);

  // ── the population names its files, not "the file" ────────────────────────
  await expect(page.getByText('Source files · 2').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Filtered out of 2 source files').first()).toBeVisible();
  await expect(page.getByText('population_full_period.xlsx').first()).toBeVisible();
  await expect(page.getByText(/vendor_master_.*\.xlsx/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-source-files.png`, fullPage: true });

  // Each row states what its own file held and what this control's filter left
  // of it — a total on its own cannot show that one file was barely narrowed.
  await expect(page.getByText(/of .* rows/).first()).toBeVisible();

  // ── the IPE test: one section, one group per file ──────────────────────────
  // "IPE टेस्ट तो एक ही रो होगा, उसके नीचे दो रहेगा."
  // Settled work folds away, so a report already concluded reliable opens
  // collapsed — the same rule it has always followed.
  const ipeToggle = page.getByText('IPE test').first();
  await ipeToggle.scrollIntoViewIfNeeded();
  await ipeToggle.click();
  await page.waitForTimeout(600);
  await expect(page.getByText('2 reports behind this population').first()).toBeVisible();
  // Each file heads its own group of four, with its own record count — the
  // variance a check works out has to be against the right denominator.
  const recordCounts = page.getByText(/^[\d,]+ records$/);
  expect(await recordCounts.count()).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `${SHOTS}/02-ipe-per-file.png`, fullPage: true });

  // ── and still ONE verdict ─────────────────────────────────────────────────
  // The centralised conclusion is the part the call explicitly kept. If this
  // ever becomes one verdict per file, this is the assertion that says so.
  await expect(page.getByText('a check that fails on any file sinks the lot', { exact: false }).first()).toBeVisible();
});

test('every file gets its own draw', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditControl(page);

  // The sample step counts files, not just items: a control standing on two
  // files that drew from one has tested one, however healthy the item count is.
  const across = page.getByText(/across 2 files — .* of 2 sampled/);
  await across.first().scrollIntoViewIfNeeded();
  await expect(across.first()).toBeVisible({ timeout: 15_000 });

  // One row per file, each carrying its own seed — one seed standing for two
  // draws reperforms exactly one of them.
  const drawn = page.getByText(/items? drawn.*— from .* instances/);
  expect(await drawn.count()).toBeGreaterThanOrEqual(2);
  const seeds = page.getByText(/random, seed/i);
  expect(await seeds.count()).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `${SHOTS}/03-draw-per-file.png`, fullPage: true });
});
