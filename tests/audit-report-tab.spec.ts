import { test, expect } from './_helpers';
import type { Page } from '@playwright/test';

/**
 * The Audit Report tab builds its per-control reports from the engagement's
 * RACM. The seeded RACM library only holds P2P rows, so an engagement on any
 * other process used to land on an empty tab: no rows, a scope of zero, and
 * nothing to download.
 */
async function openAuditReportTab(page: Page, engagementName: string) {
  await page.goto('/');
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', {
      detail: { kind: 'control', id: '', view: 'engagements' },
    })),
  );
  await page.getByText('All Engagements').first().click();
  await page.getByText(engagementName).first().click();
  await page.getByText('Audit Report', { exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /Per-control reports/ })).toBeVisible();
}

test.describe('Audit Report tab — per-control reports', () => {
  // S2C is not P2P, so it has no rows in the seeded RACM library.
  test('a non-P2P internal audit still lists its per-control reports', async ({ page }) => {
    await openAuditReportTab(page, 'S2C — Contract Review');
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  test('a control working paper downloads from its row', async ({ page }) => {
    await openAuditReportTab(page, 'P2P Internal Audit Review');
    const download = page.waitForEvent('download');
    await page.locator('tbody tr').first()
      .getByRole('button', { name: 'Download working paper' }).click();
    expect((await download).suggestedFilename()).toMatch(/^Audit_Report_P2P-C-01\.xlsx$/);
  });

  // The engagement whose process the library does cover must be unaffected.
  test('a P2P internal audit keeps its seeded library rows', async ({ page }) => {
    await openAuditReportTab(page, 'P2P Internal Audit Review');
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByText('P2P-C-01')).toBeVisible();
  });

  // Both figures were generated, not measured, so neither belongs on an
  // internal audit's band.
  test('the internal-audit band states no materiality and no sample count', async ({ page }) => {
    await openAuditReportTab(page, 'P2P Internal Audit Review');
    // Scoped to the band: the row sublines legitimately say "13 / 18 samples
    // tested", which is the per-control count, not the engagement total.
    const band = page.locator('div').filter({ hasText: /^Scope/ }).last();
    await expect(band.getByText('Materiality', { exact: true })).toHaveCount(0);
    await expect(band.getByText('Samples tested', { exact: true })).toHaveCount(0);
    await expect(band.getByText('Framework', { exact: true })).toBeVisible();
  });
});
