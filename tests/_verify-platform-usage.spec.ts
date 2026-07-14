/**
 * Platform Usage — feature verification (v2).
 * Admin sees the full page (delta KPIs, chart, breakdown, AI card, seats,
 * per-user table); range switch changes totals; member modal reconciles
 * with the table; teams lens aggregates; CSV export downloads + audit-logs;
 * live audit events land in today's numbers.
 */
import { test, expect, usageTab } from './_helpers';

const SHOTS = '/private/tmp/claude-501/-Users-nileshanand-Desktop-Product-handover/7f78790a-345e-41ac-a869-f53f64067555/scratchpad/usage';

/** The range is now the platform's shared DateFilterPicker (presets + custom),
 *  not three inline chips — so a preset has to be picked from its popover.
 *  Each preset also prints the real dates it resolves to, so its accessible name
 *  is "Last 30 days Mar 23 – Apr 21, 2026" — match on the label, not the whole. */
async function setRange(page: import('@playwright/test').Page, preset: string) {
  await page.getByRole('button', { name: /^Date range:/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${preset}\\b`) }).click();
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

  // Header + KPI band. There is no "People active" tile: the hero above owns
  // seat usage, and owns it better (number + denominator + change + benchmark).
  // The band starts at the work the seats produced.
  await expect(page.getByRole('heading', { name: 'Platform Usage' })).toBeVisible();
  await expect(page.getByText('Work done')).toBeVisible();

  // The change is a sentence against a named baseline, not a bare percentage
  // chip: "Down 2 people from 14". A percent on a base of twelve is one person.
  await expect(page.getByText(/(Up|Down|Same as|New this period)/).first()).toBeVisible();
  await expect(page.getByText(/The 30 days up to .*Each change is against the 30 days before that\./)).toBeVisible();

  // Overview leads with the verdict, then the trend and the module ranking.
  // Chart titles are takeaway SENTENCES now, not nouns — assert on what they
  // must always contain, not on a fixed string that moves with the data.
  // The verdict is a share of paid seats, against the benchmark that gives it
  // meaning. It is a <section aria-label="Licence use">, not a heading, so match
  // the sentence rather than a role that isn't there.
  // One sentence carries both forms of the number: "12 of your 17 paid seats".
  // There used to be a second sentence ("12 of 17 people used it...") saying the
  // same thing, and this asserted on it — 12 of 17 IS the percentage beside it.
  // The verdict is measured on a FIXED week, not on the page's date filter — the
  // 60% benchmark is a weekly-active-to-licence ratio, so it only means anything
  // against a week. The card says "this week" out loud precisely because it does
  // not follow the filter above it.
  await expect(page.getByText(/\d+ of your \d+ paid seats did real work this week/)).toBeVisible();
  // The verdict reads the chart out loud: which side of the benchmark, and which
  // way it is moving. A line nobody interprets is decoration.
  await expect(
    page.getByText(/(Above|Below) the healthy mark for a paid licence, (and climbing|but falling|and holding steady|measured this week)\./),
  ).toBeVisible();
  // The delta only draws when it is non-zero (a "0 seats more" line is noise), so
  // this asserts the RULE rather than its presence: if a delta is shown at all, it
  // names what it counts and what it counts against. A bare "-2" is the vanity
  // metric usageChrome's delta spec exists to forbid.
  const bareDelta = page.locator('[aria-label="Licence use"]').getByText(/^[+−-]\d+$/);
  await expect(bareDelta).toHaveCount(0);
  // Charts take noun titles; the sentence lives in the subtitle and the strip.
  await expect(page.getByRole('heading', { name: 'Actions per day' })).toBeVisible();
  await expect(page.getByText(/7-day average.*weekends/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top areas' })).toBeVisible();

  // ...and Adoption carries AI and the seat buckets.
  await usageTab(page, 'Adoption');
  await expect(page.getByText('No sign-in 30+ days')).toBeVisible();
  await expect(page.getByText('Who leans on it most')).toBeVisible();
  await usageTab(page, 'Overview');

  // Range switch changes the Actions KPI and keeps deltas (proves 180d seed)
  const actionsKpi = page.locator('[aria-label^="Work done"]').first();
  const before = await actionsKpi.getAttribute('aria-label');
  await setRange(page, 'Last 90 days');
  await page.waitForTimeout(900);
  const after = await actionsKpi.getAttribute('aria-label');
  expect(after).not.toBe(before);
  await expect(page.getByText(/The 90 days up to .*Each change is against the 90 days before that\./)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v2-90d.png` });

  await setRange(page, 'Last 7 days');
  await page.waitForTimeout(900);
  await expect(page.getByText(/(Up|Down|Same as|New this period)/).first()).toBeVisible();

  // Seats: seeded Invited users are Ajay 14110008 + Priya Singh
  await usageTab(page, 'Adoption');
  await expect(page.getByText('Invited, not joined yet')).toBeVisible();

  // Table search filters rows. The period filter sits above the tabs and scopes
  // all of them, so switching range here still applies on People.
  await setRange(page, 'Last 30 days');
  await usageTab(page, 'People');
  await page.waitForTimeout(600);
  await page.getByPlaceholder('Search by name or email...').fill('ayushi');
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
  await usageTab(page, 'People');

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
  await usageTab(page, 'People');

  await page.getByRole('button', { name: 'Teams' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('SOX Audit').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Role' })).not.toBeVisible();
  // The Teams search now matches a team name OR anyone in it (as Administration's
  // does), so the placeholder says both.
  await page.getByPlaceholder('Search teams or members...').fill('IFC');
  await page.waitForTimeout(400);
  await expect(page.locator('tbody tr', { hasText: 'IFC Team' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'SOX Audit' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/v2-teams.png` });
});

test('CSV export downloads the filtered set and shows a toast', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);
  await usageTab(page, 'People');

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await dl;
  expect(download.suggestedFilename()).toMatch(/^platform-usage-users-\d+d-/);
  await expect(page.getByText(/Exported \d+ members as CSV/)).toBeVisible();

  // The export lands in Exports & downloads as a live event by the current user
  await usageTab(page, 'Output');
  await expect(page.getByText('Exports & downloads')).toBeVisible();
  await expect(page.getByText('Top downloaders')).toBeVisible();
  // Nilesh can appear more than once here — the seeded history gives him
  // downloads of his own, and this export adds a live one on top.
  const recentList = page.getByText('Recent downloads').locator('..');
  await expect(recentList.getByText('Nilesh Anand').first()).toBeVisible();
  await expect(recentList.getByText('Platform usage')).toBeVisible();
});

/**
 * The licence verdict is judged against GitHub's 60% healthy weekly-active-to-
 * licence ratio, which is DEFINED on a week. It used to be computed over whatever
 * the date filter said, so the same tenant read 59% "below the mark" over one day
 * and 88% "above" over ninety — the verdict was a function of the dropdown, not
 * of the licence. It reads the last seven days now, whatever the filter says.
 */
test('the licence verdict does not move when the date range moves', async ({ page }) => {
  await openUsage(page);

  const read = async () => {
    const t = (await page.locator('[aria-label="Licence use"]').innerText()).replace(/\s+/g, ' ');
    return {
      pct: t.match(/(\d+)%/)?.[1],
      side: /Above the healthy mark/.test(t) ? 'above' : 'below',
    };
  };

  const base = await read();
  expect(base.pct, 'the verdict should report a percentage').toBeTruthy();

  for (const preset of ['Today', 'Last 7 days', 'Last 90 days']) {
    await setRange(page, preset);
    await page.waitForTimeout(1200);
    const now = await read();
    expect(now.pct, `${preset}: the verdict changed with the date filter`).toBe(base.pct);
    expect(now.side, `${preset}: the verdict flipped side with the date filter`).toBe(base.side);
  }
});

test('depth: highlights, rhythm, module modal, segments, team modal', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // The verdict panel now carries the findings the four highlight cards used to
  // (fastest-growing area, AI share, dormant seats), in prose, above the fold.
  // The one finding that rides alongside the verdict, and only when it fires.
  // The seed leaves seats idle, so it does.
  await expect(page.getByText(/seats? (is|are) idle/)).toBeVisible();

  // Business framing: the seat funnel, the working-pattern heatmap and the
  // read-only findings all live on Adoption — every one is a licence question.
  await usageTab(page, 'Adoption');
  // Band and Card carry the same title, so take the first.
  await expect(page.getByText('When the work happens').first()).toBeVisible();
  await expect(page.getByText('Every stage as a share of the seats you pay for.')).toBeVisible();
  await expect(page.getByText('Worth checking')).toBeVisible();

  // Per-section deep-dives — one tile per platform section, detail in a modal.
  await usageTab(page, 'Sections');
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
  // Named twice — once in the toolkit ranking, once in the run-mix legend.
  await expect(conciergeModal.getByText('RACM Generator').first()).toBeVisible();
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
  await usageTab(page, 'Adoption');
  await expect(page.getByText('Signed in ever')).toBeVisible();
  await expect(page.getByText('Used AI this period')).toBeVisible();

  // Compare-with-previous-period draws a second line on the trend chart. The
  // legend names only the two bar segments now — the compare series is keyed by
  // the toggle's pressed state, so assert on that and on the line appearing,
  // not on legend text that no longer exists.
  await usageTab(page, 'Overview');
  const compareBtn = page.getByRole('button', { name: 'Compare' });
  const lines = page.locator('.recharts-line');
  await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
  const baseLines = await lines.count(); // the 7-day average line

  await compareBtn.click();
  await page.waitForTimeout(500);
  await expect(compareBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(lines).toHaveCount(baseLines + 1); // + the previous-period line
  await page.screenshot({ path: `${SHOTS}/v6-compare.png` });

  await compareBtn.click();
  await page.waitForTimeout(300);
  await expect(compareBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(lines).toHaveCount(baseLines);

  // Module drill-down: the breakdown rows are buttons whose name includes counts.
  // Most-used areas is on Overview, where we already are.
  await page.getByRole('button', { name: /Ask IRA \d/ }).click();
  await page.waitForTimeout(600);
  const moduleModal = page.getByRole('dialog', { name: 'Ask IRA usage' });
  await expect(moduleModal).toBeVisible();
  await expect(moduleModal.getByText('Top members')).toBeVisible();
  await expect(moduleModal.getByText('Share of all activity')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v3-module-modal.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // The member table and its segment chips live on People.
  await usageTab(page, 'People');

  // The standalone Trend column is gone — the change now rides inside the
  // Actions cell as a delta pill, and the column that took its place is
  // Engagement (the segment). Assert both, so neither can quietly disappear.
  await expect(
    page.getByRole('columnheader', { name: 'Engagement' })
      .or(page.locator('th', { hasText: 'Engagement' })).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Actions' })
      .or(page.locator('th', { hasText: 'Actions' })).first(),
  ).toBeVisible();

  // The segment chips are click-to-filter KPI cards now ("No activity: 5"), and
  // there is no "All" chip — the active card toggles itself off. Abhinav is
  // active today, so he can never sit behind "No activity".
  const noActivityCard = page.getByRole('button', { name: /^No activity: \d+$/ });
  await noActivityCard.click();
  await page.waitForTimeout(400);
  await expect(page.locator('tr', { hasText: 'Abhinav Sharma' })).not.toBeVisible();
  await noActivityCard.click(); // toggle the same saved selection back off
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
  const kpi = page.locator('[aria-label^="Work done"]').first();
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

/**
 * The three honesty gaps, closed.
 *
 * All of them come from the same root: the page's clock is the newest record,
 * not today's date, and it used to keep that to itself.
 */
test('the page names today, dates its presets, and puts the top-3 share back on Overview', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // 1. The window says what it covers AND what today is, so the reader can see
  //    the gap between them. "Showing 30 days up to Apr 21" alone reads as "the
  //    last 30 days" and hides a three-month jump.
  await expect(page.getByText(/Showing\s+30 days\s+up to/)).toBeVisible();
  const staleNote = page.getByText(/Today is \w{3} \d{1,2}, \d{4}/);
  await expect(staleNote).toBeVisible();
  await expect(page.getByText(/the newest record is \d+ days old/)).toBeVisible();

  // 2. The dates the window will actually hand back — measured from the anchor,
  //    not from wall-clock today — are on the CLOSED trigger, not just inside the
  //    popover. The trigger is the only part of this control most people read; a
  //    shorthand there ("Last 30 days") looks complete, so nobody clicks to find
  //    out it isn't.
  const trigger = page.getByRole('button', { name: /^Date range:/ });
  await expect(trigger).toContainText(/\w{3} \d{1,2} – \w{3} \d{1,2}, \d{4}/);
  await expect(trigger).not.toContainText('Last 30 days');

  // …and each preset in the popover prints its own dates too.
  await trigger.click();
  await page.waitForTimeout(300);
  const thirty = page.getByRole('button', { name: /^Last 30 days\b/ });
  await expect(thirty).toBeVisible();
  // e.g. "Mar 23 – Apr 21, 2026"
  await expect(thirty).toContainText(/\w{3} \d{1,2} – \w{3} \d{1,2}, \d{4}/);
  const dated = await thirty.innerText();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // The dates the picker promised are the dates the page reports on: the end of
  // the 30-day preset is the same day the window summary names.
  // (Both the summary line and the KPI caption name that day, hence .first().)
  const endDay = dated.match(/– (\w{3} \d{1,2}), \d{4}/)?.[1];
  expect(endDay).toBeTruthy();
  await expect(page.getByText(new RegExp(`up to\\s+${endDay}`)).first()).toBeVisible();

  // 3. What stands out — the four findings, back on the tab an admin opens on.
  //
  // Each finding is now a FIGURE under a named eyebrow ("FASTEST GROWING / +30%
  // / Engagements, on the period before") rather than a paragraph with a number
  // bolded inside it, so these match the label and the supporting line, not the
  // old prose. The findings themselves are unchanged.
  await expect(page.getByText('What stands out')).toBeVisible();
  await expect(page.getByText('Fastest growing')).toBeVisible();
  await expect(page.getByText(/of active members used AI|No AI activity|none attributed/)).toBeVisible();
  await expect(page.getByText(/signed in for 30\+ days|Everyone has signed in/)).toBeVisible();

  // The one an admin cannot reach from anything else on the page.
  const topThree = page.getByRole('button', { name: /Share of activity driven by the top 3 members/ });
  await expect(topThree).toBeVisible();
  await expect(topThree).toContainText(/\d+%/);
  await expect(topThree).toContainText('of all activity');

  // And every finding clicks through to its evidence.
  await topThree.click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await expect(page.getByText('Who did the work, member by member')).toBeVisible();
});
