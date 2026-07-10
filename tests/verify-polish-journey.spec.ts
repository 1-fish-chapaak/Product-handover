import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies the four polish changes click-by-click, with screenshots at each step:
//  1. RACM detail page: breadcrumb collapses to a single "Back to RACMs" button.
//  2. Action buttons carry hover tooltips (title attr present).
//  3. Control card: the redundant standalone "Key" text is gone (chip remains).
//  4. Control expanded panel: workflows render as a single line (like risk rows).

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });
}

async function gotoP2P(page: Page) {
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  const card = page.getByText('Procure to Pay').first();
  await card.waitFor({ state: 'visible' });
  await page.waitForTimeout(700); // let the card entrance cascade settle before clicking
  await card.click();
  await expect(page.getByText(/^RACMs?$/).first()).toBeVisible({ timeout: 12000 });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

// TASK 1 / 1b DELETED (2026-07): the in-Process-Hub RACM detail journey these
// asserted was removed in main's RACM rework. Clicking a RACM card no longer
// opens an in-place "Back to RACMs" detail (URL ?racm=) with an "Open mapping" +
// "Show/Hide summary" toggle — the whole card is now a role="button" that opens
// the full-page RACM editor in a NEW TAB (?view=racm-full-editor). The standalone
// RACM summary/mapping-back screen now lives only in the engagement/AR path.

// ── TASK 3 + 4 — Controls: card opens detail in a deep-linked new tab ────────
// The inline expand-to-workflow-row was dropped in main's rework (mirrors the SOP
// card). Each control card is now compact (id + name link + status), and the name
// opens the full control detail in a NEW TAB via a deep-link. The persisted
// session keeps that tab signed in (no login chooser), and the detail shows the
// control with its linked workflow code + a "Back to controls" action.
test('T3+T4 — control card opens detail in a deep-linked new tab', async ({ page, context }) => {
  await gotoP2P(page);
  await page.getByText(/^Controls$/).first().click();
  await page.waitForTimeout(700);

  await expect(page.getByText('Three-Way PO/GRN/Invoice Matching').first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/journey-t3-control-cards.png' });

  // Control name → opens control detail in a new tab.
  const [detail] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Three-Way PO/GRN/Invoice Matching' }).first().click(),
  ]);
  await detail.waitForLoadState('domcontentloaded');
  await detail.waitForTimeout(800);
  await expect(detail).toHaveURL(/view=control-detail&controlId=C-001/, { timeout: 5000 });
  await expect(detail.getByText('Three-Way PO/GRN/Invoice Matching').first()).toBeVisible({ timeout: 5000 });
  await expect(detail.getByText(/WF-P2P-001/).first()).toBeVisible({ timeout: 5000 });
  await expect(detail.getByText(/Choose a workspace/i)).toHaveCount(0); // stayed signed in
  await expect(detail.getByRole('button', { name: /Back to controls/i })).toBeVisible();
  await detail.screenshot({ path: 'test-results/journey-t4-control-detail-newtab.png' });
});

// ── TASK 2 — tooltip (title) present on a previously-bare close button ───────
test('T2 — Create Risk drawer close has a title tooltip', async ({ page }) => {
  await gotoP2P(page);
  await page.getByText(/^Risks$/).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Create Risk$/i }).first().click();
  const closeBtn = page.getByRole('button', { name: /^Close$/ }).first();
  await expect(closeBtn).toBeVisible({ timeout: 3000 });
  await expect(closeBtn).toHaveAttribute('title', 'Close');
  await page.screenshot({ path: 'test-results/journey-t2-close-title.png' });
});
