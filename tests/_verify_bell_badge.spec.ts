import { test, expect } from './_helpers';

/**
 * O5 — the To-do bell badge counts the WORK, not the rows: the "+N more
 * control tests" rollup line contributes N to the badge, not 1.
 */
test('bell badge counts hidden due tests too', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  const bell = page.getByRole('button', { name: /To-do — \d+ pending/ });
  await expect(bell).toBeVisible();
  const label = await bell.getAttribute('aria-label');
  const badge = await bell.locator('span').last().textContent();
  const n = Number(badge?.trim());
  // badge ≡ aria-label, and it exceeds the 9 listed rows (17 tests hide behind the rollup)
  expect(label).toBe(`To-do — ${n} pending`);
  expect(n).toBeGreaterThan(9);

  // the list still truncates — the rollup row remains
  await bell.click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/more control tests due/).first()).toBeVisible();

  // O6 — the rollup keeps its promise: it lands on the "Due now" view
  await page.getByText(/more control tests due/).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/Due now \(\d+\)/).first()).toBeVisible();
});
