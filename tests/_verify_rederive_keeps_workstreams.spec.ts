import { test, expect } from './_helpers';

const SHOTS = 'test-results/rederive';

/**
 * A group-level workstream has to be visible everywhere the audit's scope is
 * decided — not just where its controls happen to show up.
 *
 * ITGC is scoped without a trial-balance caption, so it has controls and a
 * matrix but no derived RACM. Anything that read the derived RACMs to build a
 * scope list therefore left it out, and that list is not a read-out: it is what
 * an edit WRITES BACK. A workstream missing from the picker drops out of the
 * audit the moment anyone touches it, while its controls sit in the register
 * looking fine.
 *
 * WHAT THIS SPEC DOES NOT COVER: the Configuration tab's "Re-derive scope"
 * button, which rebuilds the in-scope list from the trial balances and would
 * take the whole ITGC matrix with it. ConfigurationView is parked in both shells
 * (see SOX_TABS in SoxIcfrApp and SoxClassicApp), so there is no route to that
 * button today and no way to drive it from here. The guard is in the code ready
 * for the tab's return — reviewed, not exercised. Said out loud rather than left
 * for someone to assume this spec proves more than it does.
 */
type Page = import('@playwright/test').Page;

async function openAltura(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
}

async function intoTheAudit(page: Page) {
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1400);
}

test('the audit scope picker lists the workstream the trial balances never derived', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAltura(page);
  await intoTheAudit(page);

  // ── the audit's own "What this audit covers" ──────────────────────────────
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await expect(page.getByText('What this audit covers')).toBeVisible();
  // The four the trial balances derived…
  for (const p of ['Treasury', 'Procure to Pay', 'Fixed Assets', 'Order to Cash']) {
    await expect(page.getByText(p, { exact: true }).first()).toBeVisible();
  }
  // …and the one they never could.
  await expect(page.getByText('IT General Controls', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-audit-scope.png`, fullPage: true });

  // ── which is consistent with what the register actually holds ─────────────
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1400);
  await page.getByPlaceholder(/Search controls/).fill('Privileged access');
  await page.waitForTimeout(900);
  await expect(page.getByText('Privileged access reviewed quarterly.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-register.png`, fullPage: true });

  // ── and the finding filed against it opens its control, not a dead end ────
  await page.getByText('Deficiency management', { exact: true }).first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText(/quarterly privileged-access review/).first()).toBeVisible();
  await page.getByText(/quarterly privileged-access review/).first().click();
  await page.waitForTimeout(1300);
  await expect(page.getByText('Control not found.')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/03-finding-opens.png`, fullPage: true });
});
