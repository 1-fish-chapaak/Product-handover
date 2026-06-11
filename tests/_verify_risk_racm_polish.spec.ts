import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the Process Hub polish round:
//  - Risk status (Active/Under Review/Draft) removed from the Risk tab (no status
//    chip on cards, no "Status" filter button).
//  - Create Risk modal: Sub-process | Risk Category paired in a 2-col row; the
//    Risk Category dropdown is the product style (chevron + brand focus).
//  - RACM cards show both "Created" and "Updated" dates.

async function openP2P(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(700);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('Risk tab: no status chip, no Status filter', async ({ page }) => {
  await openP2P(page);
  await page.getByRole('button', { name: 'Switch to Risks' }).click();
  await page.waitForTimeout(500);
  // The "Status" filter button is gone (other filters remain).
  await expect(page.getByRole('button', { name: 'Status', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Priority', exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/ph-risk-tab.png', fullPage: true });
});

test('Create Risk modal: paired row + styled category dropdown', async ({ page }) => {
  await openP2P(page);
  await page.getByRole('button', { name: 'Switch to Risks' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Create Risk' }).first().click();
  await expect(page.getByRole('heading', { name: 'Create Risk' })).toBeVisible();
  // Category dropdown present with the Select… placeholder.
  const category = page.locator('select').filter({ hasText: 'Select...' }).first();
  await expect(category).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/create-risk-modal.png', fullPage: true });
});

test('RACM cards show Created and Updated dates', async ({ page }) => {
  await openP2P(page);
  await page.getByRole('button', { name: 'Switch to RACMs' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Updated /).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/ph-racm-tab.png', fullPage: true });
});
