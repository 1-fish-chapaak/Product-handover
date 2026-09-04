import { test, expect } from './_helpers';
import type { Page } from '@playwright/test';

/**
 * The Audit Report tab lists what the engagement publishes. An internal audit
 * publishes audit reports — its bulk run plus the reports on the audit — and
 * each one opens in the product's own reader. A compliance engagement is the
 * other shape: it still writes a working paper per control, built from the
 * engagement's RACM.
 *
 * The seeded RACM library only holds P2P rows, so a compliance engagement on
 * any other process used to land on an empty tab: no rows, a scope of zero,
 * and nothing to download.
 */
async function openTab(page: Page, engagementName: string, tabLabel: string) {
  await page.goto('/');
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', {
      detail: { kind: 'control', id: '', view: 'engagements' },
    })),
  );
  await page.getByText('All Engagements').first().click();
  await page.getByText(engagementName).first().click();
  await page.getByText(tabLabel, { exact: true }).first().click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
}

test.describe('Audit Report tab — an internal audit lists its reports', () => {
  test('the audit’s bulk run heads the list, with the audit reports under it', async ({ page }) => {
    await openTab(page, 'P2P Internal Audit Review', 'Audit Report');
    await expect(page.getByText('Bulk Audit of P2P workflows')).toBeVisible();
    await expect(page.getByText('FY26 Q1 Financial Reporting Controls Review')).toBeVisible();
    // No control paper is listed here: an internal audit does not publish a
    // document per control.
    await expect(page.getByText('P2P-C-01')).toHaveCount(0);
  });

  test('a report opens in the reader, and Back returns to the tab', async ({ page }) => {
    await openTab(page, 'P2P Internal Audit Review', 'Audit Report');
    await page.getByText('FY26 Q1 Financial Reporting Controls Review').first().click();
    await expect(page.getByRole('heading', { name: 'FY26 Q1 Financial Reporting Controls Review' })).toBeVisible();
    await page.getByRole('button', { name: /Back to Audit Report/ }).click();
    await expect(page.getByText('Bulk Audit of P2P workflows')).toBeVisible();
  });

  // S2C is not P2P, so it has no rows in the seeded RACM library. The reports
  // do not come from the RACM, so the tab is listed either way.
  test('a non-P2P internal audit lists its reports too', async ({ page }) => {
    await openTab(page, 'S2C — Contract Review', 'Audit Report');
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  // Both figures were generated, not measured, so neither belongs on an
  // internal audit's band.
  test('the internal-audit band states no materiality and no sample count', async ({ page }) => {
    await openTab(page, 'P2P Internal Audit Review', 'Audit Report');
    await expect(page.getByText('Materiality', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Samples tested', { exact: true })).toHaveCount(0);
  });
});

/**
 * The per-control list on a compliance engagement. The engagements list routes
 * a compliance engagement to its own control-testing workspace, so this tab is
 * reached by its deep link rather than by clicking through that list.
 */
async function openCompliancePapers(page: Page) {
  await page.goto('/?view=engagement-overview&eng=eng-5');
  await page.getByText('Working Paper', { exact: true }).first().click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
}

test.describe('Working Paper tab — a compliance engagement keeps its control papers', () => {
  test('a control working paper downloads from its row', async ({ page }) => {
    await openCompliancePapers(page);
    const download = page.waitForEvent('download');
    await page.locator('tbody tr').first()
      .getByRole('button', { name: 'Download working paper' }).click();
    expect((await download).suggestedFilename()).toMatch(/^Working_Paper_P2P-C-01\.xlsx$/);
  });

  test('the list carries one row per control in scope', async ({ page }) => {
    await openCompliancePapers(page);
    await expect(page.locator('tbody tr')).toHaveCount(10);
    await expect(page.getByText('P2P-C-01')).toBeVisible();
  });
});
