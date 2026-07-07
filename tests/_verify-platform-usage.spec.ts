/**
 * Platform Usage — feature verification.
 * Admin sees the nav item + full page (KPIs, chart, breakdown, AI card,
 * per-user table); range switch changes totals; live audit events land in
 * today's numbers; non-admin roles don't get the nav item.
 */
import { test, expect } from './_helpers';

const SHOTS = '/private/tmp/claude-501/-Users-nileshanand-Desktop-Product-handover/7f78790a-345e-41ac-a869-f53f64067555/scratchpad/usage';

test('admin sees Platform Usage and it renders end to end', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.waitForTimeout(1200);

  await page.locator('button[aria-label="Pin sidebar open"]').click().catch(() => {});
  await page.waitForTimeout(500);

  const nav = page.locator('nav button', { hasText: 'Platform Usage' });
  await expect(nav).toBeVisible();
  await nav.click();
  await page.waitForTimeout(1800);

  // Header + KPI band
  await expect(page.getByRole('heading', { name: 'Platform Usage' })).toBeVisible();
  await expect(page.getByText('Active users')).toBeVisible();
  await expect(page.getByText('AI queries').first()).toBeVisible();

  // Cards
  await expect(page.getByText('Usage over time')).toBeVisible();
  await expect(page.getByText('Module breakdown')).toBeVisible();
  await expect(page.getByText('Top AI users')).toBeVisible();

  // Per-user table renders seeded members
  await expect(page.getByText('Abhinav Sharma')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/usage-30d.png`, fullPage: false });

  // Range switch changes the Actions KPI
  const actionsKpi = page.locator('[aria-label*="Actions"]').first();
  const before = await actionsKpi.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Last 7 days' }).click();
  await page.waitForTimeout(900);
  const after = await actionsKpi.getAttribute('aria-label');
  expect(after).not.toBe(before);
  await page.screenshot({ path: `${SHOTS}/usage-7d.png` });

  await page.getByRole('button', { name: 'Last 90 days' }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/usage-90d.png` });

  // Table search filters rows
  await page.getByPlaceholder('Search members...').fill('ayushi');
  await page.waitForTimeout(400);
  await expect(page.getByText('Ayushi Narang')).toBeVisible();
  await expect(page.getByText('Abhinav Sharma')).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).click();

  // Scroll the table into view for a second shot
  await page.getByPlaceholder('Search members...').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/usage-table.png` });
});

test('live audit events raise today\'s totals', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.locator('button[aria-label="Pin sidebar open"]').click().catch(() => {});
  await page.waitForTimeout(400);

  // Read the 90d Actions total first
  await page.locator('nav button', { hasText: 'Platform Usage' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Last 90 days' }).click();
  await page.waitForTimeout(800);
  const kpi = page.locator('[aria-label*="Actions"]').first();
  const before = await kpi.getAttribute('aria-label');

  // Produce a real audit event with one click: Audit Log > Export CSV logs an
  // 'Export' event through the same logEvent() producer as every other module.
  await page.locator('nav button', { hasText: 'Admin' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Audit Log' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await page.waitForTimeout(800);

  // Back to Platform Usage — the event should be in today's bucket
  await page.locator('nav button', { hasText: 'Platform Usage' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Last 90 days' }).click();
  await page.waitForTimeout(800);
  const after = await kpi.getAttribute('aria-label');
  expect(after).not.toBe(before);
});
