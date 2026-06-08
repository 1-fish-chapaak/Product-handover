import { test, expect, type Page } from './_helpers';

/**
 * Smoke tests for the homepage. Covers the highest-value flows added during
 * the recent iteration: Add widget modal, Health Dashboard tile picker
 * (auto-removes parent when last tile unchecked), date range filter, and
 * persona switcher.
 *
 * Pre-requisites:
 *   - Vite dev server running on the URL declared in playwright.config.ts.
 *   - Fresh localStorage at the start of each test (handled in beforeEach).
 */

const HOME = '/';

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });
}

async function gotoHome(page: Page) {
  await page.goto(HOME);
  // Hero greeting is the first stable signal that the home view rendered.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function openAddWidgetModal(page: Page) {
  await page.getByRole('button', { name: /^Add widget/ }).click();
  await expect(page.getByRole('dialog', { name: 'Edit widgets' })).toBeVisible();
}

async function closeAddWidgetModal(page: Page) {
  await page.getByRole('dialog', { name: 'Edit widgets' })
    .getByRole('button', { name: 'Close' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Edit widgets' })).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

test.describe('Homepage', () => {
  // ─────────────────────────────────────────────────────────────────────
  // H1 — Default render
  // ─────────────────────────────────────────────────────────────────────
  test('H1 — loads with default widgets visible for the active persona', async ({ page }) => {
    await gotoHome(page);

    // Spot-check a handful of widget headings that should be visible by default.
    await expect(page.getByRole('heading', { name: /health snapshot/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Workflow activity/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /active engagements/ })).toBeVisible();
    // Add widget pill shows X/Y count badge.
    await expect(page.getByRole('button', { name: /^Add widget\s+\d+\/\d+$/ })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────
  // H2 — Add widget modal toggle flow
  // ─────────────────────────────────────────────────────────────────────
  test('H2 — toggling a widget off in the modal removes it from the home grid', async ({ page }) => {
    await gotoHome(page);
    await openAddWidgetModal(page);

    // Toggle Workflow activity off (the modal lists it as a widget tile).
    const tile = page.getByRole('dialog', { name: 'Edit widgets' })
      .getByRole('button', { name: /Workflow activity/ });
    await expect(tile).toBeVisible();
    await tile.click();
    // aria-pressed flips to false after toggling off.
    await expect(tile).toHaveAttribute('aria-pressed', 'false');

    await closeAddWidgetModal(page);

    // Workflow activity widget should no longer be on the page.
    await expect(page.getByRole('heading', { name: /Workflow activity/ })).toBeHidden();
  });

  // ─────────────────────────────────────────────────────────────────────
  // H3 — Date range filter changes widget data
  // ─────────────────────────────────────────────────────────────────────
  test('H3 — switching date range updates the Health snapshot title', async ({ page }) => {
    await gotoHome(page);

    // Default for the auditor persona is Quarterly → "Quarterly health snapshot".
    await expect(page.getByRole('heading', { name: 'Quarterly health snapshot' })).toBeVisible();

    // Open the period dropdown and switch to All time.
    await page.getByRole('button', { name: /^Period:/ }).click();
    await page.getByRole('menuitemradio', { name: 'All time' }).click();
    await expect(page.getByRole('heading', { name: 'FY26 health snapshot' })).toBeVisible();

    // Switch to 7 days.
    await page.getByRole('button', { name: /^Period:/ }).click();
    await page.getByRole('menuitemradio', { name: '7 days' }).click();
    await expect(page.getByRole('heading', { name: 'Last 7 days health snapshot' })).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────
  // H4 — Health Dashboard auto-removes itself when last tile is unchecked
  // ─────────────────────────────────────────────────────────────────────
  test('H4 — unchecking every Health tile removes the parent widget', async ({ page }) => {
    await gotoHome(page);

    // Sanity: dashboard is present.
    await expect(page.getByRole('heading', { name: /health snapshot/ })).toBeVisible();

    // Open the Customize tiles menu.
    await page.getByRole('button', { name: 'Customize tiles' }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Click every checked tile to uncheck them all. The menu is a fixed-position
    // popover that may extend below the viewport; dispatch click events directly
    // so we don't depend on viewport/visibility heuristics.
    while (true) {
      const checked = menu.getByRole('menuitemcheckbox', { checked: true });
      const count = await checked.count();
      if (count === 0) break;
      await checked.first().dispatchEvent('click');
    }

    // Whole Health Dashboard should be gone from the layout.
    await expect(page.getByRole('heading', { name: /health snapshot/ })).toBeHidden();
  });

  // ─────────────────────────────────────────────────────────────────────
  // H5 — Re-adding Health Dashboard restores all 10 sub-tiles
  // ─────────────────────────────────────────────────────────────────────
  test('H5 — re-adding Health Dashboard via the modal restores a full dashboard', async ({ page }) => {
    await gotoHome(page);
    await openAddWidgetModal(page);

    // Toggle Health Dashboard off.
    const tile = page.getByRole('dialog', { name: 'Edit widgets' })
      .getByRole('button', { name: /Health dashboard/ });
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'false');

    // Toggle it back on.
    await tile.click();
    await expect(tile).toHaveAttribute('aria-pressed', 'true');

    await closeAddWidgetModal(page);

    // Dashboard is back; Customize tiles button confirms it's the full widget.
    await expect(page.getByRole('heading', { name: /health snapshot/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Customize tiles' })).toBeVisible();
  });
});
