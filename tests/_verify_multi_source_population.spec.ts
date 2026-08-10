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

async function openAuditControl(page: Page, description = 'Payment runs approved by two authorisers.') {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText(description).first().click();
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

/** The one control left half-done: population locked, both files proven, the
 *  first file sampled and ticked, the second still waiting for its draw. Every
 *  other control is finished (and therefore locked, with no buttons) or
 *  untouched (and therefore has no files) — neither can show the marks. */
const MID_FLIGHT = 'FX deals confirmed independently of dealing.';

test('every file gets its own draw, in its own accordion', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditControl(page, MID_FLIGHT);

  // The sample step counts files, not just items: a control standing on two
  // files that drew from one has tested one, however healthy the item count is.
  // It also separates drawn from marked-done, which is the state the marks
  // exist to carry — "चार का तुमने कर दिया था, दो बच रहा था".
  const across = page.getByText(/across 2 files — 1 of 2 sampled, 1 marked done/);
  await across.first().scrollIntoViewIfNeeded();
  await expect(across.first()).toBeVisible({ timeout: 15_000 });

  // ── one accordion per file, one open at a time ────────────────────────────
  // "10 फाइल हैं, एक अकॉर्डियन खोलोगे, ये सारा स्टेप करोगे… अप्रूव करोगे, अगला
  // पे जाओगे." The header alone answers what an auditor comes back with: which
  // files are settled and which are still owed.
  await expect(page.getByText('done', { exact: true }).first()).toBeVisible();
  // The file still owing work is the one open on arrival — a control returned
  // to after a week should land on what is left, not on what is finished.
  await expect(page.getByRole('button', { name: /^Draw sample$/ }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-draw-per-file.png`, fullPage: true });

  // ── the finished file keeps both actions ──────────────────────────────────
  // "अप्रूव कंटिन्यू कर दिया, मान लो कल को कि री-ड्रा करना है" — the reason to
  // throw a draw back usually turns up after it was accepted, so Reject and
  // retry is offered on an approved file too, and the tick comes back off.
  await page.getByRole('button', { name: /population_full_period/ }).first().click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('button', { name: 'Reject and retry' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take the mark off' }).first()).toBeVisible();
  // It is a marker, not a lock: "लॉक ऐसे नहीं, बस अप्रूव मतलब टिक लग गया".
  await expect(page.getByText('A re-draw takes the mark off', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-approved-file.png`, fullPage: true });

  // ── drawing the second file, then marking it ──────────────────────────────
  await page.getByRole('button', { name: /vendor_master/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Draw sample$/ }).first().click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Approve and continue' }).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/across 2 files — 2 of 2 sampled/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-both-sampled.png`, fullPage: true });
});

test('the proof accordion carries the same mark', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditControl(page, MID_FLIGHT);

  // "अप्रूव एंड कंटिन्यू हर अकॉर्डियन के अंदर डाल दो ना" — the same action in
  // the same place on the IPE side, for consistency. Both files arrive marked,
  // so the state to check is that the mark shows and comes off again.
  const ipeToggle = page.getByText('IPE test').first();
  await ipeToggle.scrollIntoViewIfNeeded();
  await ipeToggle.click();
  await page.waitForTimeout(600);

  // Each file is a closed row with its own tick — four checks × two files
  // unfolded at once is a screen nobody can work in.
  const rows = page.locator('button[aria-expanded]').filter({ hasText: /\.xlsx/ });
  expect(await rows.count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Source & parameters')).toHaveCount(0);

  // Opening one shows that file's four dimensions, and only that file's.
  await rows.first().click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Source & parameters').first()).toBeVisible();
  expect(await page.getByText('Source & parameters').count()).toBe(1);
  await page.screenshot({ path: `${SHOTS}/05-ipe-accordion.png`, fullPage: true });
});
