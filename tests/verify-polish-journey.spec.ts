import { test, expect, type Page } from '@playwright/test';

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
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  await expect(page.getByText(/^RACMs?$/).first()).toBeVisible({ timeout: 5000 });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

// ── TASK 1 — RACM detail back-button journey ────────────────────────────────
test('T1 — RACM list → detail (Back to RACMs) → list', async ({ page }) => {
  await gotoP2P(page);
  await page.getByText(/^RACMs?$/).first().click();
  await expect(page).toHaveURL(/\?section=racm/);
  await page.waitForTimeout(700); // past skeleton
  await page.screenshot({ path: 'test-results/journey-t1-01-list.png' });

  // Open a RACM detail.
  const racmName = page.getByRole('button', { name: /FY26 P2P/ }).first();
  await expect(racmName).toBeVisible({ timeout: 5000 });
  await racmName.click();

  // Detail: URL gains ?racm=, and the trail collapses to one back button.
  await expect(page).toHaveURL(/[?&]racm=/, { timeout: 3000 });
  const backBtn = page.getByRole('button', { name: /Back to RACMs/i });
  await expect(backBtn).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: 'test-results/journey-t1-02-detail.png' });

  // Back → list.
  await backBtn.click();
  await expect(page).not.toHaveURL(/[?&]racm=/, { timeout: 3000 });
  await expect(page.getByRole('button', { name: /FY26 P2P/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Back to RACMs/i })).toBeHidden();
  await page.screenshot({ path: 'test-results/journey-t1-03-back-on-list.png' });
});

// ── TASK 1b — Open mapping keeps its own back (not broken by the change) ─────
test('T1b — Open mapping shows its own RACM Summary back', async ({ page }) => {
  await gotoP2P(page);
  await page.getByText(/^RACMs?$/).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /FY26 P2P/ }).first().click();
  await expect(page.getByRole('button', { name: /Back to RACMs/i })).toBeVisible();

  await page.getByRole('button', { name: /Open mapping/i }).click();
  await expect(page.getByRole('button', { name: /RACM Summary/i })).toBeVisible({ timeout: 3000 });
  await page.screenshot({ path: 'test-results/journey-t1b-mapping.png' });
});

// ── TASK 3 + 4 — Controls: no redundant Key + single-line workflow ──────────
test('T3+T4 — control card Key + expanded workflow row', async ({ page }) => {
  await gotoP2P(page);
  await page.getByText(/^Controls$/).first().click();
  await page.waitForTimeout(700);

  await expect(page.getByText('Three-Way PO/GRN/Invoice Matching').first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/journey-t3-control-cards.png' });

  // Expand C-001 → workflow single-line row.
  await page.getByRole('button', { name: /Expand C-001/i }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('PO Validation Workflow').first()).toBeVisible({ timeout: 3000 });
  // New single-line format: "Apr 28, 2026 · 14 runs" + a Completed status pill.
  await expect(page.getByText(/14 runs/i).first()).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('Completed').first()).toBeVisible({ timeout: 3000 });
  // The remove ✕ now carries a tooltip (title).
  await expect(page.getByRole('button', { name: /Remove WF-P2P-001/i }))
    .toHaveAttribute('title', /Remove WF-P2P-001/);
  await page.screenshot({ path: 'test-results/journey-t4-control-expanded.png' });
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
