import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The audit lock, awakened. The reviewer's countersign used to write to one
 * field while the lock read another, so the seal never engaged; the sign-off
 * now lives on the LIVE audit's record and the store gates it by hat and order.
 *
 * What these tests pin:
 *  - the signature block is the audit's, not the engagement's (renamed copy);
 *  - each signature belongs to one hat, and what a hat cannot do is ABSENT;
 *  - the preparer signs first — the reviewer sees a waiting line, not a button;
 *  - a planned round offers no live signature (nothing was tested under it).
 */
type Page = import('@playwright/test').Page;

// The register's cards all read "CY 2026" — round names don't print there — so
// the two 2026 cycles are told apart by their created-stamp: the interim was
// opened 02 Jan, the planned roll-forward 04 Jul.
async function openAlturaAudit(page: Page, createdAt: string) {
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(600);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(800);
  await main.getByRole('button', { name: 'Open CY 2026 audit' }).filter({ hasText: createdAt }).first().click();
  await page.waitForTimeout(1000);
  await expect(main.getByRole('button', { name: 'Dashboard', exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test('the audit signature waits for its preparer, hat by hat', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page, '02 Jan 2026');

  // Auditor first (the default hat): the block is the AUDIT's, and the pen is
  // there but held — Altura's interim still has unconcluded papers.
  await expect(page.getByText('Audit sign-off').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Engagement sign-off')).toHaveCount(0);
  const prepare = page.getByRole('button', { name: 'Sign off as preparer' });
  await expect(prepare).toBeVisible();
  await expect(prepare).toBeDisabled();
  await expect(prepare).toHaveAttribute('title', 'Every control must be concluded first');

  // Reviewer: no preparer pen at all (absent, not greyed), no countersign
  // either — the order holds. What they get is the waiting line.
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Audit sign-off').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign off as preparer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Countersign as reviewer' })).toHaveCount(0);
  await expect(page.getByText(/Awaiting preparer — /).first()).toBeVisible();
  await expect(page.getByText(/Then: reviewer countersign — /).first()).toBeVisible();
});

test('the owner has no signature block at all', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page, '02 Jan 2026');

  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(1000);
  // The whole closure checklist is auditor-side; for the owner it is absent,
  // not greyed — their overview is a to-do list, not an opinion.
  await expect(page.getByText('Audit sign-off')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign off as preparer' })).toHaveCount(0);
});

test('a planned round offers no live signature', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  // CY 2026 · roll-forward is seeded planned: nothing has been tested under
  // it, so its signature cannot be live. The store refuses a non-live audit
  // outright; the UI shows the same truth as a held pen.
  await openAlturaAudit(page, '04 Jul 2026');

  const prepare = page.getByRole('button', { name: 'Sign off as preparer' });
  if (await prepare.count()) {
    await expect(prepare.first()).toBeDisabled();
  } else {
    // If the round has no testable papers the block may not render a pen at
    // all — also fine: absent beats greyed.
    await expect(page.getByRole('button', { name: 'Countersign as reviewer' })).toHaveCount(0);
  }
});
