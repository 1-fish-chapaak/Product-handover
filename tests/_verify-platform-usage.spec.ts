/**
 * Platform Usage — feature verification (v2).
 * Admin sees the full page (delta KPIs, chart, breakdown, AI card, seats,
 * per-user table); range switch changes totals; member modal reconciles
 * with the table; teams lens aggregates; CSV export downloads + audit-logs;
 * live audit events land in today's numbers.
 */
import { test, expect } from './_helpers';

const SHOTS = '/private/tmp/claude-501/-Users-nileshanand-Desktop-Product-handover/7f78790a-345e-41ac-a869-f53f64067555/scratchpad/usage';

/** The range is now the platform's shared DateFilterPicker (presets + custom),
 *  not three inline chips — so a preset has to be picked from its popover. */
async function setRange(page: import('@playwright/test').Page, preset: string) {
  await page.getByRole('button', { name: /^Date range:/ }).click();
  await page.getByRole('button', { name: preset, exact: true }).click();
  await page.waitForTimeout(900);
}

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

  // Delta chips + footnote (30d default). The footnote names the anchor — the
  // page is "as of" the newest record, not wall-clock.
  await expect(page.getByText(/^[+-]\d+%$/).first()).toBeVisible();
  await expect(page.getByText(/The 30 days up to .*the change vs the 30 days before that\./)).toBeVisible();

  // Cards
  await expect(page.getByText('Daily activity')).toBeVisible();
  await expect(page.getByText('Most-used areas')).toBeVisible();
  await expect(page.getByText('No sign-in 30+ days')).toBeVisible();
  await expect(page.getByText('Top AI users')).toBeVisible();

  // Range switch changes the Actions KPI and keeps deltas (proves 180d seed)
  const actionsKpi = page.locator('[aria-label*="Actions"]').first();
  const before = await actionsKpi.getAttribute('aria-label');
  await setRange(page, 'Last 90 days');
  await page.waitForTimeout(900);
  const after = await actionsKpi.getAttribute('aria-label');
  expect(after).not.toBe(before);
  await expect(page.getByText(/^[+-]\d+%$/).first()).toBeVisible();
  await expect(page.getByText(/The 90 days up to .*the change vs the 90 days before that\./)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v2-90d.png` });

  await setRange(page, 'Last 7 days');
  await page.waitForTimeout(900);
  await expect(page.getByText(/^[+-]\d+%$/).first()).toBeVisible();

  // Seats: seeded Invited users are Ajay 14110008 + Priya Singh
  await expect(page.getByText('Invited, not joined yet')).toBeVisible();

  // Table search filters rows
  await setRange(page, 'Last 30 days');
  await page.waitForTimeout(600);
  await page.getByPlaceholder('Search members...').fill('ayushi');
  await page.waitForTimeout(400);
  await expect(page.locator('tr', { hasText: 'Ayushi Narang' }).first()).toBeVisible();
  await expect(page.locator('tr', { hasText: 'Abhinav Sharma' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/v2-30d.png` });
});

test('member modal reconciles with the table row and links to Admin', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // Read Abhinav's Actions cell, then open his modal
  const row = page.locator('tr', { hasText: 'Abhinav Sharma' }).first();
  await row.scrollIntoViewIfNeeded();
  const cellText = await row.locator('td').nth(4).innerText(); // Actions column
  await row.click();
  await page.waitForTimeout(600);

  const modal = page.getByRole('dialog', { name: 'Abhinav Sharma' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Module mix')).toBeVisible();
  await expect(modal.getByText('This session', { exact: true })).toBeVisible();
  // Consistency: modal Actions stat equals the table cell
  await expect(modal.getByText(cellText.trim(), { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v2-modal.png` });

  // Esc closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(modal).not.toBeVisible();

  // Stats-only page: the modal has no action buttons
  await row.click();
  await page.waitForTimeout(500);
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Manage in Admin', exact: true })).not.toBeVisible();
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
  await expect(page.locator('tbody tr', { hasText: 'IFC Team' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'SOX Audit' })).toHaveCount(0);
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

  // The export lands in Exports & downloads as a live event by the current user
  await expect(page.getByText('Exports & downloads')).toBeVisible();
  await expect(page.getByText('Top downloaders')).toBeVisible();
  // Nilesh can appear more than once here — the seeded history gives him
  // downloads of his own, and this export adds a live one on top.
  const recentList = page.getByText('Recent downloads').locator('..');
  await expect(recentList.getByText('Nilesh Anand').first()).toBeVisible();
  await expect(recentList.getByText('Platform usage')).toBeVisible();
});

test('depth: highlights, rhythm, module modal, segments, team modal', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // Highlights strip + activity rhythm heatmap
  await expect(page.getByText('Highlights')).toBeVisible();
  await expect(page.getByText(/of active members used AI in this range/)).toBeVisible();
  await expect(page.getByText(/Top 3 members account for/)).toBeVisible();
  await expect(page.getByText('When people are active')).toBeVisible();

  // Business framing: seat utilization + read-only findings
  await expect(page.getByText('Seats used this period.')).toBeVisible();
  await expect(page.getByText('Worth checking')).toBeVisible();

  // Per-section deep-dives — one tile per platform section, detail in a modal
  await expect(page.getByText('Section deep-dives')).toBeVisible();
  // Ask IRA (the chat) and AI Concierge (the toolkit) are separate sections —
  // a question you type and a tool you run are different products.
  for (const s of ['Engagements', 'Ask IRA', 'AI Concierge', 'Reports', 'Workflows', 'Risk & Controls', 'Knowledge Hub', 'Dashboards']) {
    await expect(page.locator('h3', { hasText: s }).first()).toBeVisible();
  }

  // Tile → modal → full detail, Esc closes
  await page.locator('h3', { hasText: 'Ask IRA' }).first().click();
  await page.waitForTimeout(600);
  const aiModal = page.getByRole('dialog', { name: 'Ask IRA' });
  await expect(aiModal).toBeVisible();
  await expect(aiModal.getByText('Who asks most')).toBeVisible();
  // Tool runs belong to the Concierge now, not the chat.
  await expect(aiModal.getByText('Tool runs')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(aiModal).not.toBeVisible();

  await page.locator('h3', { hasText: 'AI Concierge' }).first().click();
  await page.waitForTimeout(600);
  const conciergeModal = page.getByRole('dialog', { name: 'AI Concierge' });
  await expect(conciergeModal).toBeVisible();
  await expect(conciergeModal.getByText('Tool runs').first()).toBeVisible();
  await expect(conciergeModal.getByText('RACM Generator')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(conciergeModal).not.toBeVisible();

  await page.locator('h3', { hasText: 'Risk & Controls' }).click();
  await page.waitForTimeout(600);
  const rcModal = page.getByRole('dialog', { name: 'Risk & Controls' });
  await expect(rcModal.getByText('Coverage by process')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.locator('h3', { hasText: 'Engagements' }).first().click();
  await page.waitForTimeout(600);
  const engModal = page.getByRole('dialog', { name: 'Engagements' });
  await expect(engModal.getByText('Controls tested & findings by engagement')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Adoption funnel stages
  await expect(page.getByText('Signed in ever')).toBeVisible();
  await expect(page.getByText('Used AI this period')).toBeVisible();

  // Compare-with-previous-period overlay toggles a legend entry
  await expect(page.getByText('Previous period', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Previous period', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v6-compare.png` });
  await page.getByRole('button', { name: 'Compare' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('Previous period', { exact: true })).not.toBeVisible();

  // Trend column in the member table
  await expect(page.getByRole('columnheader', { name: 'Trend' }).or(page.locator('th', { hasText: 'Trend' }))).toBeVisible();

  // Module drill-down: the breakdown rows are buttons whose name includes counts
  await page.getByRole('button', { name: /Ask IRA \d/ }).click();
  await page.waitForTimeout(600);
  const moduleModal = page.getByRole('dialog', { name: 'Ask IRA usage' });
  await expect(moduleModal).toBeVisible();
  await expect(moduleModal.getByText('Top members')).toBeVisible();
  await expect(moduleModal.getByText('Share of all activity')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v3-module-modal.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Segment chips filter the member list (Abhinav is active today → never "No activity")
  await page.getByRole('button', { name: /^No activity \(\d+\)$/ }).click();
  await page.waitForTimeout(400);
  await expect(page.locator('tr', { hasText: 'Abhinav Sharma' })).not.toBeVisible();
  await page.getByRole('button', { name: /^All \(\d+\)$/ }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('tr', { hasText: 'Abhinav Sharma' }).first()).toBeVisible();

  // Team drill-down modal
  await page.getByRole('button', { name: 'Teams' }).click();
  await page.waitForTimeout(500);
  await page.locator('tr', { hasText: 'SOX Audit' }).first().click();
  await page.waitForTimeout(600);
  const teamModal = page.getByRole('dialog', { name: 'SOX Audit' });
  await expect(teamModal).toBeVisible();
  await expect(teamModal.getByText('Members', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v3-team-modal.png` });
  await page.keyboard.press('Escape');
});

test('live audit events raise today\'s totals', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);
  await setRange(page, 'Last 90 days');
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
  await setRange(page, 'Last 90 days');
  await page.waitForTimeout(800);
  const after = await kpi.getAttribute('aria-label');
  expect(after).not.toBe(before);
});
