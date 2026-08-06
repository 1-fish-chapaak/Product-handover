import { test, expect } from './_helpers';

const SHOTS = 'test-results/itgc-seed';

/**
 * ITGC is in the Altura seed.
 *
 * The engagement is scoped from eight trial balances, and no trial balance has a
 * caption for access management — so ITGC was declared beyond the TB but never
 * produced a RACM. It does now: eight IT general controls at group level, one
 * set for the group rather than a copy per company.
 *
 * This is also what makes R8.6 reachable without hand-building a control:
 * conclude one of these ineffective and the withdrawal lands across every
 * automated and IT-dependent control in the engagement.
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

test('the seed carries an ITGC RACM, once, for the group', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAltura(page);

  // ── the RACM landing lists it alongside the four financial processes ───────
  await page.getByText('RACM', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await expect(page.getByText('IT General Controls').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-racm.png`, fullPage: true });

  // ── and the controls are real ITGCs, not a generic five-control shell ──────
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/Search controls/).fill('access');
  await page.waitForTimeout(900);
  await expect(page.getByText('Privileged access reviewed quarterly.').first()).toBeVisible();
  await expect(page.getByText('User access granted via approved request.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-controls.png`, fullPage: true });

  // Tested once for the group, not replicated per company — the four financial
  // processes split across Altura's companies; access management does not.
  const rows = page.locator('tr.reg-row, .ac-card').filter({ hasText: 'Privileged access reviewed quarterly.' });
  await expect(rows).toHaveCount(1);
});
