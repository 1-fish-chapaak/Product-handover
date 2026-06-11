import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Verifies two Process Hub polish fixes:
//  1. Risks tab: 24px gap between the linked-control chips and the dashed
//     "Control" link button (embedded / Process Hub view only).
//  2. Tab bar: the global purple focus glow-box is suppressed on the section
//     tabs (no-focus-ring), while the active purple underline is kept.

async function gotoP2PRisks(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Switch to Risks' }).click();
  await page.waitForTimeout(500);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('Risks tab: 24px before the Control link button, and tabs keep underline without the glow-box', async ({ page }) => {
  await gotoP2PRisks(page);

  // ── Issue 2: active tab keeps its underline, glow-box suppressed ──
  const activeTab = page.getByRole('button', { name: 'Switch to Risks' });
  await expect(activeTab).toHaveClass(/no-focus-ring/);              // opt-out applied → no glow-box
  const underline = await activeTab.evaluate(el => {
    const s = getComputedStyle(el);
    return { w: s.borderBottomWidth, color: s.borderBottomColor, style: s.borderBottomStyle };
  });
  expect(underline.w).toBe('2px');                                   // active underline kept
  expect(underline.style).toBe('solid');
  expect(underline.color).toBe('rgb(106, 18, 205)');                // brand-600 purple
  await page.screenshot({ path: 'test-results/risk-tab-polish.png', fullPage: true });

  // ── Issue 1: 24px margin before the "Control" link button on a chipped row ──
  const linkButtons = page.getByRole('button', { name: 'Link control' });
  const n = await linkButtons.count();
  expect(n).toBeGreaterThan(0);
  let found24 = false;
  for (let i = 0; i < n; i++) {
    const ml = await linkButtons.nth(i).evaluate(el => getComputedStyle(el.parentElement as Element).marginLeft);
    if (ml === '24px') { found24 = true; break; }
  }
  expect(found24).toBe(true);
});
