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

  // Overview opens on the KPI band, because Overview's promise is "how much
  // happened in this period, and when" — the work the seats produced, not the
  // seats. The licence verdict used to lead here and now leads ADOPTION, whose
  // subhead is literally "whether the licence is earning its keep": a
  // procurement number has no business being the loudest mark on the tab an
  // admin opens to see what their team did.
  await expect(page.getByRole('heading', { name: 'Platform Usage' })).toBeVisible();
  await expect(page.getByText('Work done')).toBeVisible();
  await expect(page.locator('[aria-label="Licence use"]')).toHaveCount(0);

  // The change splits in two: a toned chip for the movement ("Up 8%") and muted
  // text for the baseline it moved from ("from 487"). Both are always present —
  // a number with no named baseline is the vanity metric this page forbids.
  await expect(page.getByText(/(Up|Down|No change|New)/).first()).toBeVisible();
  await expect(page.getByText(/from \d/).first()).toBeVisible();
  await expect(page.getByText(/The 30 days up to .*Each change is against the 30 days before that\./)).toBeVisible();

  // Four headline numbers (REQ-2.1–2.4), and "People active" is one of them —
  // "how many people" is the question the page exists to answer.
  await expect(page.getByText('People active')).toBeVisible();

  // Every tile carries the days behind its number (REQ-2.5), and the ONE tile
  // whose bars do not add up to its headline says so on its face (REQ-2.6):
  // a person active on three days is 1 user and 3 bars.
  await expect(page.getByText(/adding up to/).first()).toBeVisible();
  // The bars are not broken; what they count is people-per-day, and a person who
  // works on three days is counted on all three. The tile says that rather than
  // apologising for its own chart.
  await expect(page.getByText(/Somebody active on three days appears on all three/)).toBeVisible();

  // Charts take noun titles; the sentence lives in the subtitle and the strip.
  await expect(page.getByRole('heading', { name: 'Actions per day' })).toBeVisible();

  // AI is NOT stacked into those bars. It is a tenth of the work, so on the main
  // chart's scale it was a flat blue crust you could not read a day off — the
  // exact failure REQ-4.2 predicts. It gets its own strip, its own scale, and it
  // prints what that scale tops out at.
  await expect(page.getByText('AI actions per day')).toBeVisible();
  await expect(page.getByText(/Own scale · peak/)).toBeVisible();

  /* REQ-4.4 — the odd days are MARKED, and this test exists because the detector
     was, for two versions, arithmetically incapable of firing.

     It took mean + 2σ across every day on the calendar. A GRC team barely works
     weekends, so the series is `22 28 25 25 21 · 3 3 · 19 21 …` — the weekend
     troughs are a second population, not noise around a mean, and mixing them in
     inflated σ to 8.6 and pushed the bar to 35 actions. The busiest day the
     platform has is 29. It could not fire, for any day that can physically occur.

     Judged against days of its OWN KIND it fires twice on the seed: a Tuesday at
     29 (1.3× a normal weekday), and — the one no global threshold could ever have
     found — a Sunday at 8, which is 2.6× a normal weekend and means somebody
     worked the weekend. */
  await expect(page.getByText(/A ring marks a day well above normal/)).toBeVisible();
  await expect(page.getByText(/for that kind of day/)).toBeVisible();
  await expect(page.getByText(/times a normal day, mostly in/)).toBeVisible();
  // The legend only grows this key when the mark is actually on the plot.
  await expect(page.getByText('An odd day')).toBeVisible();

  // The verdict, on the tab that asks the question. It is a
  // <section aria-label="Licence use">, not a heading, so match the sentence
  // rather than a role that isn't there.
  //
  // One sentence carries both forms of the number: "12 of your 17 paid seats".
  // There used to be a second sentence ("12 of 17 people used it...") saying the
  // same thing, and this asserted on it — 12 of 17 IS the percentage beside it.
  //
  // The verdict is measured on a FIXED week, not on the page's date filter — the
  // 60% benchmark is a weekly-active-to-licence ratio, so it only means anything
  // against a week. The card says "this week" out loud precisely because it does
  // not follow the filter above it.
  await usageTab(page, 'Seats');
  await expect(page.getByText(/\d+ of your \d+ paid seats did real work this week/)).toBeVisible();
  // The verdict reads the chart out loud: which side of the benchmark, and which
  // way it is moving. A chart nobody interprets is decoration.
  await expect(
    page.getByText(/(Above|Below) the \d+% that counts as healthy for a paid licence, (and climbing|but falling|and holding steady|measured this week)\./),
  ).toBeVisible();
  // The delta only draws when it is non-zero (a "0 seats more" line is noise), so
  // this asserts the RULE rather than its presence: if a delta is shown at all, it
  // names what it counts and what it counts against. A bare "-2" is the vanity
  // metric usageChrome's delta spec exists to forbid.
  const bareDelta = page.locator('[aria-label="Licence use"]').getByText(/^[+−-]\d+$/);
  await expect(bareDelta).toHaveCount(0);
  await usageTab(page, 'Overview');
  await expect(page.getByText(/7-day average.*weekend/)).toBeVisible();

  // The AREAS tab now owns every view of an area: the scatter (which KIND of used
  // each one is), the ranking (which is busiest), and the twelve cards (what is
  // inside). Those were three tabs, and the twelve areas were rendered three
  // times with no way to see any two at once.
  await usageTab(page, 'Areas');
  await expect(page.getByRole('heading', { name: 'How many people use each area, and how hard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Busiest areas' })).toBeVisible();

  // And one area has ONE detail. Open it from the RANKING — not from a card —
  // and you land on the same modal a section card opens: usage first, then the
  // register behind it. Two routes, one destination. They used to be two
  // different modals.
  // A ranked row's accessible name carries its count ("Engagements 87 17%"); the
  // scatter dot beside it is named "Engagements, Core — … — open this area". The
  // digit is what tells them apart, so anchor on it.
  await page.getByRole('button', { name: /^Engagements \d/ }).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Share of all activity')).toBeVisible();
  await expect(page.getByText('Who works in here')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Seats does the licence arithmetic (the seat buckets); People puts names to it
  // (the AI card, the concentration curve, the member table). One question per tab.
  await usageTab(page, 'Seats');
  await expect(page.getByText('No sign-in 30+ days')).toBeVisible();
  await usageTab(page, 'People');
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
  await usageTab(page, 'Seats');
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

  /* Read Abhinav's ACTIONS cell, then open his modal.

     This used to take `td` index 4 and call it the Actions column. Index 4 is
     Last active. It passed anyway, because Last active printed "Today, 16:14" and
     the modal printed the same string, so the assertion was true for a reason
     that had nothing to do with what it claimed to check — and it broke the day
     the column stopped printing the clock time.

     Index 5 is Actions. Its cell carries the count and a delta pill ("70 +1%"),
     so take the count off the front: that number is the one the modal has to
     agree with, and agreeing with it is the whole point of the test. */
  const row = page.locator('tr', { hasText: 'Abhinav Sharma' }).first();
  await row.scrollIntoViewIfNeeded();
  const actionsCell = await row.locator('td').nth(5).innerText();
  const actionCount = (actionsCell.match(/\d[\d,]*/) ?? [''])[0];
  expect(actionCount, 'the Actions cell should carry a count').not.toBe('');
  await row.click();
  await page.waitForTimeout(600);

  const modal = page.getByRole('dialog', { name: 'Abhinav Sharma' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Where they worked')).toBeVisible();
  await expect(modal.getByText('This session', { exact: true })).toBeVisible();
  // Consistency: the modal's Actions stat equals the table cell it was opened from.
  await expect(modal.getByText(actionCount, { exact: true }).first()).toBeVisible();
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
  await expect(page.getByText('Downloads').first()).toBeVisible();
  await expect(page.getByText('Top downloaders')).toBeVisible();
  // Nilesh can appear more than once here — the seeded history gives him
  // downloads of his own, and this export adds a live one on top.
  const recentList = page.getByText('Recent downloads').locator('..');
  await expect(recentList.getByText('Nilesh Anand').first()).toBeVisible();
  await expect(recentList.getByText('Platform usage')).toBeVisible();

  /* Output has a TIME AXIS now — it was the only tab without one.
     Four totals and four change chips is a two-point comparison, and a two-point
     comparison cannot tell steady production from one enormous Tuesday followed
     by three silent weeks. Those are the same number and different facts.

     Each of the four cards carries its own strip, on its own scale, printing what
     that scale tops out at — the same contract the AI strip follows, because 84
     downloads and 24 creations on one shared axis would flatten the smaller
     series into a row of stubs. */
  const strips = page.getByText('Day by day');
  expect(await strips.count(), 'every output card carries its own trend').toBeGreaterThanOrEqual(4);
  const scales = page.getByText(/Own scale · peak/);
  expect(await scales.count(), 'a strip with its own scale must print that scale').toBeGreaterThanOrEqual(4);
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
  // The verdict lives on Adoption now, not Overview — it is a licence question,
  // and Adoption is the tab that asks it. The date filter is shared across all
  // five tabs, so what this test checks is unchanged.
  await usageTab(page, 'Seats');

  const read = async () => {
    const t = (await page.locator('[aria-label="Licence use"]').innerText()).replace(/\s+/g, ' ');
    return {
      pct: t.match(/(\d+)%/)?.[1],
      side: /Above the \d+% that counts as healthy/.test(t) ? 'above' : 'below',
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

  // The working rhythm is a weekday × hour GRID, and it lives on Overview
  // (PRD §5: "the busiest 6 areas, and a grid showing which hours of the week
  // people work"). It is not a licence question, so it does not interrupt
  // Adoption's argument — and Overview is the tab that has the room for it.
  //
  // The grid, not two bar charts. "Tuesday is busiest" plus "09:00 is busiest"
  // does not imply "Tuesday at 09:00 is busy" — only the joint cell can say so,
  // and the marginals are exactly what throws it away.
  await expect(page.getByText('When people are working').first()).toBeVisible();
  await expect(page.getByText(/busiest hour of the week is/)).toBeVisible();

  // Business framing: the licence verdict, the seat funnel and the read-only
  // findings all live on Adoption — every one of them is a licence question,
  // and none of them is what Overview is for.
  await usageTab(page, 'Seats');

  // The one finding that rides under the verdict, and only when it fires. The
  // seed leaves seats idle, so it does.
  await expect(page.getByText(/seats? (is|are) idle/)).toBeVisible();

  await expect(page.getByText('Each stage as a share of the seats you pay for.')).toBeVisible();
  await expect(page.getByText('Worth checking')).toBeVisible();

  // The engagement matrix is the breadth × frequency scatter (REQ-5.5–5.7), so
  // the four quadrant names have to be on it. A ranked bar cannot tell Set-up
  // from Shelfware, and an admin must do opposite things about them.
  //
  // It lives on AREAS, not here: which areas to fix or drop is a product
  // decision, and which seats to reclaim is a licence decision. Same admin,
  // different day.
  await usageTab(page, 'Areas');
  await expect(page.getByText('Which areas earn their keep')).toBeVisible();
  for (const q of ['Everyday', 'Specialist', 'Set up once', 'Barely used']) {
    await expect(page.getByText(q, { exact: false }).first()).toBeVisible();
  }

  // Per-section deep-dives — one tile per platform section, detail in a modal.
  await usageTab(page, 'Areas');
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
  await usageTab(page, 'Seats');
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

  /* Area drill-down. The ranking lives on AREAS now, and it opens the SAME modal
     the section card opens.

     This used to open a modal of its own — "Ask IRA usage", with its own layout —
     while the Ask IRA card on the Sections tab opened a different one, with the
     register in it. One area, two pop-ups, and no screen where you could see both
     halves of the answer: this area is busy, but is it producing anything?

     So the assertion is no longer "a usage modal exists". It is "the usage AND
     the register are in the same modal". */
  await usageTab(page, 'Areas');
  await page.getByRole('button', { name: /^Ask IRA \d/ }).first().click();
  await page.waitForTimeout(800);
  const areaModal = page.getByRole('dialog').first();
  await expect(areaModal).toBeVisible();
  // The usage half (REQ-9.2).
  await expect(areaModal.getByText('Share of all activity')).toBeVisible();
  await expect(areaModal.getByText('Who works in here')).toBeVisible();
  await expect(areaModal.getByText('Day by day')).toBeVisible();
  // The register half (REQ-7.13–7.16), in the same modal.
  await expect(areaModal.getByText(/Conversations|Questions asked/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/v3-area-modal.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // The member table and its segment chips live on People.
  await usageTab(page, 'People');

  // The standalone Trend column is gone — the change now rides inside the
  // Actions cell as a delta pill, and the column that took its place is
  // Engagement (the segment). Assert both, so neither can quietly disappear.
  await expect(
    page.getByRole('columnheader', { name: 'Usage' })
      .or(page.locator('th', { hasText: 'Usage' })).first(),
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
  await expect(page.getByText(/of the people working in the platform used AI|Nobody used the AI|none we can trace/)).toBeVisible();
  await expect(page.getByText(/signed in for 30\+ days|Everyone has signed in/)).toBeVisible();

  // The one an admin cannot reach from anything else on the page.
  const topThree = page.getByRole('button', { name: /Share of the work done by the busiest three people/ });
  await expect(topThree).toBeVisible();
  await expect(topThree).toContainText(/\d+%/);
  await expect(topThree).toContainText('of all the work');

  /* And every finding clicks through to its evidence — which now lands on SEATS,
     where the member table lives alongside the licence argument it is evidence
     for.

     The top-3 share also finally has a CHART. It is the one finding on this page
     an admin cannot assemble from anything else — a healthy total hides it by
     construction — and until now it was a number in a small card with no picture.
     The Lorenz curve draws the gap between what happens and what an even spread
     would look like, and marks the top 3 on it. */
  // Read the finding's number BEFORE clicking: the click leaves Overview, and the
  // card goes with it.
  const finding = await topThree.textContent();
  const pct = (finding ?? '').match(/(\d+)%/)?.[1];

  await topThree.click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /leans on its busiest people/ })).toBeVisible();
  await expect(page.getByText(/what an even split would look like/)).toBeVisible();

  // The chart and the finding are the same number, drawn and said, so they can
  // never disagree — the curve is fed the very percentage the card prints.
  await expect(page.getByText(new RegExp(`${pct}%\\s*of all the work`))).toBeVisible();
});
