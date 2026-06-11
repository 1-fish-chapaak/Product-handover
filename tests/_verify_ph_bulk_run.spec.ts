import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the Process Hub → Workflows tab mirrors the Workflow Library bulk-run
// interaction: an always-visible "Bulk Run" button (8px radius) that toggles to
// "Cancel" and reveals per-card checkboxes; the whole card is clickable to select;
// per-card actions dim; and a "Continue" bar appears on first selection and opens
// the shared Bulk Execute setup.

async function gotoP2PWorkflows(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Switch to Workflows' }).click();
  await page.waitForTimeout(500);
}

// Per-card checkboxes only — excludes the strip's "Select all visible workflows".
const cardCheckboxes = (page: Page) => page.getByRole('checkbox', { name: /^Select (?!all visible)/ });
const radiusOf = (page: Page, name: string) =>
  page.getByRole('button', { name }).first().evaluate(el => getComputedStyle(el).borderTopLeftRadius);

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('bulk-run toggle: checkboxes, whole-card select, Continue bar, 8px radius', async ({ page }) => {
  await gotoP2PWorkflows(page);

  // Default state: Bulk Run visible (8px radius), no Cancel, no checkboxes.
  await expect(page.getByRole('button', { name: 'Bulk Run' })).toBeVisible();
  expect(await radiusOf(page, 'Bulk Run')).toBe('8px');
  await expect(page.getByRole('button', { name: /^Cancel$/ })).toHaveCount(0);
  await expect(cardCheckboxes(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);

  // Enter bulk mode → button swaps to Cancel (8px), checkboxes appear on cards.
  await page.getByRole('button', { name: 'Bulk Run' }).click();
  await expect(page.getByRole('button', { name: /^Cancel$/ })).toBeVisible();
  expect(await radiusOf(page, 'Cancel')).toBe('8px');
  await expect(page.getByRole('button', { name: 'Bulk Run' })).toHaveCount(0);
  expect(await cardCheckboxes(page).count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);

  // Whole card is clickable: clicking the card body (description text, not the
  // checkbox) toggles selection → first checkbox checks, Continue bar appears.
  await page.getByText(/Automated matching of PO, GRN/i).click();
  await expect(page.getByRole('checkbox', { name: 'Select Three-Way PO Match' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByText(/of\s+\d+\s+selected/i).first()).toBeVisible();

  // A ticked card shows no Archive / deselect-✕ icon buttons (removed for bulk mode).
  await expect(page.getByRole('button', { name: 'Archive' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel selection' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/ph-bulk-selected.png', fullPage: true });

  // Continue → shared Bulk Execute setup modal opens.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Bulk Execute' })).toBeVisible();

  // Close the modal, Cancel bulk mode → checkboxes + Continue disappear.
  await page.getByRole('dialog', { name: 'Bulk Execute' }).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Bulk Execute' })).toBeHidden();
  await page.getByRole('button', { name: /^Cancel$/ }).click();
  await expect(page.getByRole('button', { name: 'Bulk Run' })).toBeVisible();
  await expect(cardCheckboxes(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
});
