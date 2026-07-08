/**
 * Platform Usage — feature verification (v2).
 * Admin sees the full page (delta KPIs, chart, breakdown, AI card, seats,
 * per-user table); range switch changes totals; member drawer reconciles
 * with the table; teams lens aggregates; CSV export downloads + audit-logs;
 * live audit events land in today's numbers.
 */
import { test, expect } from './_helpers';

const SHOTS = '/private/tmp/claude-501/-Users-nileshanand-Desktop-Product-handover/7f78790a-345e-41ac-a869-f53f64067555/scratchpad/usage';

async function openUsage(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.locator('button[aria-label="Pin sidebar open"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('nav button', { hasText: 'Platform Usage' }).click();
  await page.waitForTimeout(1800);
}

test('page renders end to end with delta KPIs on every range', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // Header + KPI band
  await expect(page.getByRole('heading', { name: 'Platform Usage' })).toBeVisible();
  await expect(page.getByText('Active users')).toBeVisible();

  // Delta chips + footnote (30d default)
  await expect(page.getByText(/^[+-]\d+%$/).first()).toBeVisible();
  await expect(page.getByText('Change compared with the previous 30 days.')).toBeVisible();

  // Cards
  await expect(page.getByText('Daily activity')).toBeVisible();
  await expect(page.getByText('Most-used areas')).toBeVisible();
  await expect(page.getByText('No sign-in 30+ days')).toBeVisible();
  await expect(page.getByText('Top AI users')).toBeVisible();

  // Range switch changes the Actions KPI and keeps deltas (proves 180d seed)
  const actionsKpi = page.locator('[aria-label*="Actions"]').first();
  const before = await actionsKpi.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Last 90 days' }).click();
  await page.waitForTimeout(900);
  const after = await actionsKpi.getAttribute('aria-label');
  expect(after).not.toBe(before);
  await expect(page.getByText(/^[+-]\d+%$/).first()).toBeVisible();
  await expect(page.getByText('Change compared with the previous 90 days.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v2-90d.png` });

  await page.getByRole('button', { name: 'Last 7 days' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/^[+-]\d+%$/).first()).toBeVisible();

  // Seats: seeded Invited users are Ajay 14110008 + Priya Singh
  await expect(page.getByText('Invited, not joined yet')).toBeVisible();

  // Table search filters rows
  await page.getByRole('button', { name: 'Last 30 days' }).click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder('Search members...').fill('ayushi');
  await page.waitForTimeout(400);
  await expect(page.getByText('Ayushi Narang')).toBeVisible();
  await expect(page.getByText('Abhinav Sharma')).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/v2-30d.png` });
});

test('member drawer reconciles with the table row and links to Admin', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // Read Abhinav's Actions cell, then open his drawer
  const row = page.locator('tr', { hasText: 'Abhinav Sharma' }).first();
  await row.scrollIntoViewIfNeeded();
  const cellText = await row.locator('td').nth(4).innerText(); // Actions column
  await row.click();
  await page.waitForTimeout(600);

  const drawer = page.getByRole('dialog', { name: 'Abhinav Sharma' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Module mix')).toBeVisible();
  await expect(drawer.getByText('This session', { exact: true })).toBeVisible();
  // Consistency: drawer Actions stat equals the table cell
  await expect(drawer.getByText(cellText.trim(), { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v2-drawer.png` });

  // Esc closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(drawer).not.toBeVisible();

  // Manage in Admin lands on Administration
  await row.click();
  await page.waitForTimeout(500);
  await drawer.getByRole('button', { name: 'Manage in Admin', exact: true }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
});

test('teams lens aggregates and hides user-only filters', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  await page.getByRole('button', { name: 'Teams' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('SOX Audit').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Role' })).not.toBeVisible();
  await page.getByPlaceholder('Search teams...').fill('IFC');
  await page.waitForTimeout(400);
  await expect(page.getByText('IFC Team')).toBeVisible();
  await expect(page.getByText('SOX Audit')).not.toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v2-teams.png` });
});

test('CSV export downloads the filtered set and shows a toast', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toMatch(/^platform-usage-users-\d+d-/);
  await expect(page.getByText(/Exported \d+ members as CSV/)).toBeVisible();
});

test('depth: highlights, rhythm, module drawer, segments, team drawer', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // Highlights strip + activity rhythm heatmap
  await expect(page.getByText('Highlights')).toBeVisible();
  await expect(page.getByText(/of active members used AI in this range/)).toBeVisible();
  await expect(page.getByText(/Top 3 members account for/)).toBeVisible();
  await expect(page.getByText('When people are active')).toBeVisible();

  // Business framing: seat utilization + next steps
  await expect(page.getByText('Seats used this period.')).toBeVisible();
  await expect(page.getByText('What to do next')).toBeVisible();

  // Trend column in the member table
  await expect(page.getByRole('columnheader', { name: 'Trend' }).or(page.locator('th', { hasText: 'Trend' }))).toBeVisible();

  // Module drill-down: the breakdown rows are buttons whose name includes counts
  await page.getByRole('button', { name: /Ask IRA \d/ }).click();
  await page.waitForTimeout(600);
  const moduleDrawer = page.getByRole('dialog', { name: 'Ask IRA usage' });
  await expect(moduleDrawer).toBeVisible();
  await expect(moduleDrawer.getByText('Top members')).toBeVisible();
  await expect(moduleDrawer.getByText('Share of all activity')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v3-module-drawer.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Segment chips filter the member list (Abhinav is active today → never "No activity")
  await page.getByRole('button', { name: /^No activity \(\d+\)$/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('tr', { hasText: 'Abhinav Sharma' })).not.toBeVisible();
  await page.getByRole('button', { name: /^All \(\d+\)$/ }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('tr', { hasText: 'Abhinav Sharma' }).first()).toBeVisible();

  // Team drill-down drawer
  await page.getByRole('button', { name: 'Teams' }).click();
  await page.waitForTimeout(500);
  await page.locator('tr', { hasText: 'SOX Audit' }).first().click();
  await page.waitForTimeout(600);
  const teamDrawer = page.getByRole('dialog', { name: 'SOX Audit' });
  await expect(teamDrawer).toBeVisible();
  await expect(teamDrawer.getByText('Members', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v3-team-drawer.png` });
  await page.keyboard.press('Escape');
});

test('live audit events raise today\'s totals', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);
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
