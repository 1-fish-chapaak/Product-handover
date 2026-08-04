import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The revised risk-owner calibration: read-only visibility plus a documented
 * challenge, instead of concealment.
 *
 * 404(a) is management's own assessment and the process owner is management, so
 * the owner reads the exposure and the likelihood. What stays back is the RULER —
 * materiality, the bands, the rule-by-rule working — and the aggregation group,
 * and which MW indicator fired. The disagreement gets a route instead of a
 * corridor conversation.
 */
test('the owner reads the numbers, disagrees on the record, and the auditor answers', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');

  const audit = page.getByRole('main').getByRole('button').filter({ hasText: /^(CY|FY) ?20\d\d/ }).first();
  if (await audit.count() > 0) { await audit.click(); await page.waitForTimeout(800); }
  await page.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(900);

  // ── as the owner ────────────────────────────────────────────────────────────
  // The owner lane is scoped by person, so the picker settles WHICH owner; the
  // rows that survive are that person's controls.
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).first().click();
  await page.waitForTimeout(900);
  // Switching hats lands them on their OWN landing — the task list, per the spec.
  // Their register is a tab of its own, named for the person rather than the page.
  await page.getByRole('button', { name: 'My deficiencies', exact: true }).first().click();
  await page.waitForTimeout(900);

  const ownerRow = page.locator('tr.reg-row:not(.reg-static)').first();
  await expect(ownerRow).toBeVisible({ timeout: 10_000 });
  await ownerRow.click();
  await page.waitForTimeout(700);

  // Visible: the two inputs they are entitled to argue with.
  await expect(page.getByText('Exposure', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Likelihood', { exact: false }).first()).toBeVisible();
  // Hidden: the ruler. "Show working" is the rule-by-rule list naming each
  // threshold, and it is the auditor's and reviewer's view only.
  await expect(page.getByRole('button', { name: /Show working/i })).toHaveCount(0);
  await page.screenshot({ path: 'tests/__screenshots__/owner-severity-readonly.png' });

  // ── the challenge ───────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /Disagree with this assessment/ }).first().click();
  await page.waitForTimeout(400);
  await page.locator('textarea[placeholder*="Why the number is wrong"]').first()
    .fill('The two invoices were reversed the same week, so nothing could have reached the ledger.');
  await page.screenshot({ path: 'tests/__screenshots__/owner-challenge-form.png' });
  await page.getByRole('button', { name: /Send to the audit team/ }).first().click();
  await page.waitForTimeout(700);

  // It is now on the record, and says it changes nothing by itself.
  await expect(page.getByText('Challenges to this assessment').first()).toBeVisible();
  await expect(page.getByText(/With the audit team/).first()).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/owner-challenge-raised.png' });

  // ── the auditor answers ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Auditor', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(900);
  const auditorRow = page.locator('tr.reg-row:not(.reg-static)').filter({ hasText: 'DEF-' }).first();
  await auditorRow.click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Challenges to this assessment').first()).toBeVisible({ timeout: 10_000 });

  // A decline still has to carry a reason — that is the whole point of the route.
  await page.getByRole('button', { name: /Decline — reason required/ }).first().click();
  await page.waitForTimeout(400);
  const record = page.getByRole('button', { name: /Record — declined/ }).first();
  await expect(record).toBeDisabled();
  await page.locator('textarea[placeholder*="Why the number stands"]').first()
    .fill('The reversals landed after the cut-off, so the exposure stands as measured.');
  await expect(record).toBeEnabled();
  await record.click();
  await page.waitForTimeout(700);

  await expect(page.getByText(/Declined by/).first()).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/auditor-challenge-answered.png' });
});
