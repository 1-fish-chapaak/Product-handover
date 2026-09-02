/**
 * Platform Usage. The build spec's acceptance tests, run against the real page.
 *
 * `Platform-Usage-Build-Spec_2.pdf` ends every metric with an acceptance line
 * and asks for one seeded customer carrying the worked example's numbers so
 * every tile can be checked against arithmetic done by hand. That is most of
 * this file. It opens the page as a CFO and checks section 5's six figures,
 * then checks the section 9 rules a later change could quietly break: coverage
 * counted once, failed runs kept out of savings, a table under every chart, a
 * list behind every count, a per-person table nobody can sort, and a page that
 * never writes anything.
 */

import { test, expect, enterWorkspace, type Page } from './_helpers';

/** Open the page from the left menu, without reloading the app. */
async function gotoUsage(page: Page) {
  await page.getByRole('button', { name: /^Platform Usage$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toBeVisible();
  await page.waitForTimeout(800);
}

async function openUsage(page: Page) {
  await page.goto('/');
  await enterWorkspace(page);
  await gotoUsage(page);
}

/**
 * Open one of the three tabs.
 *
 * The page is Value, Coverage and Activity rather than one long scroll, so a
 * spec that used to scroll to a block opens the tab it lives on first. Nothing
 * was removed: every block still exists, on exactly one tab.
 */
async function usageTab(page: Page, name: 'Value' | 'Coverage' | 'Activity') {
  await page.getByRole('tab', { name }).click();
  await page.waitForTimeout(500);
}

/** Strip one permission from System Admin, which is how the view changes. */
async function stripPermission(page: Page, description: string) {
  await page.getByRole('button', { name: /^Admin$/ }).first().click();
  await page.getByRole('button', { name: /Roles & Permissions/ }).first().click();
  await page.getByText('System Admin', { exact: true }).first().click();
  // The segmented control's label is lowercase, upper-cased by CSS.
  await page.getByRole('button', { name: 'edit', exact: true }).first().click();
  await page.locator('input[placeholder*="earch"]').first().fill('Usage');
  await page.getByText(description, { exact: true }).first().click();
  await page.getByRole('button', { name: /Save Changes/ }).first().click();
  await page.waitForTimeout(600);
}

const OWNER_PERMISSION = 'View workspace-wide platform usage and adoption metrics';
const TEAM_PERMISSION = 'See named member and team activity in Platform Usage';

test.describe('Platform Usage', () => {
  test('opens on the highest view the role may read, and says so in one line', async ({ page }) => {
    await openUsage(page);

    await expect(page.locator('h1 + p')).toHaveText('Is this paying for itself?');
    await expect(page.getByText(/Viewing as CFO · Whole company/)).toBeVisible();

    // A CFO is here for the money, so Value opens first.
    await expect(page.getByRole('tab', { name: 'Value' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the same three tabs on every view, whoever is reading', async ({ page }) => {
    await openUsage(page);

    await expect(page.getByRole('tab')).toHaveText(['Value', 'Coverage', 'Activity']);

    // The switch changes whose data you see and which tab opens first. It never
    // changes the tabs themselves.
    await page.getByRole('button', { name: 'Internal Auditor', exact: true }).click();
    await page.waitForTimeout(600);
    await expect(page.getByRole('tab')).toHaveText(['Value', 'Coverage', 'Activity']);
    await expect(page.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true');
  });

  test('an attention card opens the tab its block lives on', async ({ page }) => {
    await openUsage(page);
    await expect(page.getByRole('tab', { name: 'Value' })).toHaveAttribute('aria-selected', 'true');

    // Both of these cards, the unmapped critical risks and the controls nobody
    // has ever exercised, are about blocks on Coverage.
    const card = page
      .locator('section[aria-label="Needs your attention"] li')
      .filter({ has: page.getByRole('button', { name: /See them|See which/ }) })
      .first();
    await expect(card).toBeVisible();
    await card.getByRole('button').click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('tab', { name: 'Coverage' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#risks, #never').first()).toBeVisible();
  });

  test('the switch is a lens: it only ever narrows down your own line', async ({ page }) => {
    await openUsage(page);

    // A CFO may look at their own team and at their own work. There is no
    // fourth option, and nothing here reaches sideways into another team.
    const swtch = page.locator('div', { has: page.getByRole('button', { name: 'CFO', exact: true }) }).last();
    await expect(swtch.getByRole('button', { name: 'CFO', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Internal Auditor', exact: true }).click();
    await page.waitForTimeout(600);

    await expect(page.locator('h1 + p')).toHaveText('What is waiting on me?');
    await expect(page.getByText(/Viewing as Internal Auditor · Your own work only/)).toBeVisible();

    // Narrowing to one person takes the money off the page with it. The cost
    // block lives on Value, so that is where we look for its absence.
    await usageTab(page, 'Value');
    await expect(page.locator('#cost')).toHaveCount(0);
  });

  test('the CFO lands on this quarter, compared with the quarter before', async ({ page }) => {
    await openUsage(page);
    await expect(page.getByText(/This quarter, 1 Jan 2026 to 31 Mar 2026/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'This quarter' })).toHaveAttribute('aria-pressed', 'true');
    // Every tile states the comparison in words. A tile that moved says which
    // way and by how much; one that did not says it is about the same, and
    // draws no arrow, because an arrow beside "level" contradicts itself.
    await expect(page.getByText(/(About the same as|on) the quarter before/).first()).toBeVisible();
  });

  test('the quarter is the guide\'s worked example, to the rupee', async ({ page }) => {
    await openUsage(page);
    // The whole sum is on the hero, in order, so a reader can check it on a
    // calculator without opening anything.
    const hero = page.locator('#hero');

    // 340 successful runs over populations of 1,428,000 rows, in 8.5 hours.
    await expect(hero).toContainText('1,428,000');
    await expect(hero).toContainText('340');
    await expect(hero).toContainText('8.5');

    // 1,428,000 rows at 200 an hour is 7,140 hours by hand.
    await expect(hero).toContainText('7,140');

    // 7,140 less 8.5 is 7,131.5, rounded down because a saving never rounds up.
    await expect(hero).toContainText('7,131');

    // The money prices the saving rather than the hours by hand, so it is
    // 7,131.5 at 1,200 rupees an hour and not 7,140. Pricing the by-hand figure
    // would hand back the 8.5 hours the hours line had just given up.
    await expect(hero).toContainText('₹85.6 lakh');

    // 7,131 hours over the 480 a person works in a quarter is about 15 people,
    // on the same saved hours the money uses.
    await expect(hero).toContainText('15');
    await expect(hero).toContainText('480');

    // The contract charged ₹18,400, leaving ₹85.4 lakh.
    const cost = page.locator('#cost');
    await expect(cost).toContainText('₹18,400');
    await expect(cost).toContainText('₹85.4 lakh');
  });

  test('the hero says net value only while the cost is complete', async ({ page }) => {
    await openUsage(page);
    const hero = page.locator('#hero');

    // The block leads with hours, which rest on one assumed rate, rather than
    // with money, which rests on two.
    expect(await hero.locator('h3').innerText()).toBe('What the platform was worth');
    await expect(hero).toContainText('hours');

    // The money follows, under its own caveat, and only says what the contract
    // charged while every lookup in the window is priced. The caveat lives in
    // the fold with everything else somebody would argue with, so the sum on
    // screen is a sum rather than a paragraph.
    await expect(hero).toContainText('₹1,200 an hour');
    await hero.getByText('How this is counted').click();
    await expect(hero).toContainText('an hour is ours, not yours');
    const costed = await hero.innerText();
    if (costed.includes('Your contract charged')) {
      await expect(hero).toContainText('which leaves');
    }

    // Whichever state it is in, the sum is told in the same five lines: what it
    // would have taken, what it took, what was saved, what that is worth, and
    // what running it charged.
    await expect(hero).toContainText('records by hand');
    await expect(hero).toContainText('The platform did it in');
    await expect(hero).toContainText('Time your team did not spend');
    await expect(hero).toContainText('What that time is worth');
    await expect(hero).toContainText('What running the platform cost');
    // People are said in the line about the hours rather than as a tile of
    // their own, because "15 people" only means anything next to the hours.
    await expect(hero).toContainText('people working the whole quarter');
  });

  test('coverage counts a population once, and says so next to the repeats', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');
    const coverage = page.locator('#coverage');

    await expect(coverage).toContainText('1,428,000');
    await expect(coverage).toContainText('checks performed');

    // The repeats are far larger than the coverage. If these two ever match,
    // the count-once rule has been lost and the page is inflating itself.
    const text = await coverage.innerText();
    // The label leads its figure in this product's KPI strips, so the number is
    // read from either side of the words rather than from one fixed order.
    const checks = Number(
      (text.match(/checks performed\s*\n?\s*([\d,]+)/i)?.[1]
        ?? text.match(/([\d,]+)\s*\n?\s*checks performed/i)?.[1]
        ?? '0').replace(/,/g, ''),
    );
    expect(checks).toBeGreaterThan(1_428_000 * 10);
  });

  test('failed runs are reported on their own and kept out of every saving', async ({ page }) => {
    await openUsage(page);
    // The owner's headline counts successful checks only.
    await expect(page.locator('#hero')).toContainText('checks:');
    await usageTab(page, 'Activity');
    // The failures are named in the block's own head now rather than in a tile
    // under it. The saving above counts the successful checks only, which is
    // the other half of this rule.
    await expect(page.locator('#volume')).toContainText('failed');
    await expect(page.locator('#volume')).toContainText('passed');
  });

  test('every chart has a table one click away', async ({ page }) => {
    await openUsage(page);

    // Every chart on every tab, not just the one the page opens on.
    let charts = 0;
    for (const name of ['Value', 'Coverage', 'Activity'] as const) {
      await usageTab(page, name);
      const toggles = page.getByRole('button', { name: /^Table$/ });
      const count = await toggles.count();
      charts += count;
      for (let i = 0; i < count; i += 1) {
        const toggle = toggles.nth(0); // the list re-renders as each one flips
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click();
        await page.waitForTimeout(120);
      }
      if (count > 0) {
        await expect(page.getByRole('button', { name: /^Chart$/ }).first()).toBeVisible();
        // The first table in the DOM may be one folded under "Show the numbers",
        // so this looks for a table that is actually on screen.
        await expect(page.locator('[data-usage-block] table').locator('visible=true').first()).toBeVisible();
      }
    }
    expect(charts).toBeGreaterThan(2);
  });

  test('every count opens its list, with a name and a date', async ({ page }) => {
    await openUsage(page);

    // Counts are spread across the three tabs, so the drills are counted on all
    // three and opened until one shows its list. The list names the thing, who
    // made it and when: looking for a date is how we know it is a real list
    // rather than the same count rendered twice.
    let found = 0;
    let dated = false;
    for (const name of ['Value', 'Coverage', 'Activity'] as const) {
      await usageTab(page, name);
      const drills = page.getByRole('button', { name: /^Open the / });
      const count = await drills.count();
      found += count;

      for (let i = 0; i < count && !dated; i += 1) {
        // Each open drill renames its own button, so the first unopened one is
        // always at the head of the list.
        const drill = drills.first();
        if (!(await drill.count())) break;
        await drill.scrollIntoViewIfNeeded();
        await drill.click();
        await page.waitForTimeout(150);
        dated = (await page.locator('[data-usage-block] ul li').filter({ hasText: /\d{4}/ }).count()) > 0;
      }
    }

    expect(found).toBeGreaterThan(3);
    expect(dated).toBe(true);
  });

  test('the assumptions are on screen with their source, and two states are visible', async ({ page }) => {
    await openUsage(page);
    const assumptions = page.locator('#assumptions');
    await assumptions.scrollIntoViewIfNeeded();

    // The rate has not met its guard, so it is still labelled a starting value,
    // and it says what the customer's own reviews work out at against it.
    await expect(assumptions).toContainText('Rows checked by hand per hour');
    await expect(assumptions).toContainText('our number, until yours is on record');
    await expect(assumptions).toContainText('records an hour over');
    await expect(assumptions).toContainText('switches to your number');

    // The control-test hours have met both guards, so they measured themselves.
    await expect(assumptions).toContainText('Hours per manual control test');
    await expect(assumptions).toContainText('from your records');
    await expect(assumptions).toContainText('of your own timed manual tests');

    // The two that can never be measured say where they do come from, on the
    // row rather than in a fold.
    await expect(assumptions).toContainText('Nothing in the product records what anybody is paid');
    await expect(assumptions).toContainText('8 hours a day across 20 working days');
  });

  test('one assumption swings everything, and the page shows the swing', async ({ page }) => {
    await openUsage(page);
    const sensitivity = page.locator('#sensitivity');
    await sensitivity.scrollIntoViewIfNeeded();
    // 1,428,000 rows at 100 an hour and 1,200 an hour comes to 1.71 crore, and
    // at 800 an hour it comes to 21.4 lakh.
    await expect(sensitivity).toContainText('₹1.7 cr');
    await expect(sensitivity).toContainText('₹21.4 lakh');
  });

  test('the attention strip carries at most three cards, each with one action', async ({ page }) => {
    await openUsage(page);
    const strip = page.locator('section[aria-label="Needs your attention"]');
    const cards = strip.locator('li');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    for (let i = 0; i < count; i += 1) {
      await expect(cards.nth(i).locator('button')).toHaveCount(1);
    }
  });

  test('the period selector moves the whole page', async ({ page }) => {
    await openUsage(page);
    await page.getByRole('button', { name: 'This month' }).click();
    await page.waitForTimeout(600);
    await expect(page.getByText(/This month, 1 Mar 2026 to 31 Mar 2026/)).toBeVisible();
    await expect(page.locator('#hero')).toContainText('this month');
  });

  test('never exercised ignores the period selector', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');
    const never = page.locator('#never');
    await never.scrollIntoViewIfNeeded();

    await expect(never).toContainText('This block ignores the window');
    // The lede is the never-ever figure. Only the footnote about the window may
    // move, and its wording changes with the window, so the lede is compared on
    // its own rather than by splitting the block's whole text.
    const lede = never.locator('p').first();
    const quarter = await lede.innerText();

    await page.getByRole('button', { name: 'This month' }).click();
    await page.waitForTimeout(600);
    await never.scrollIntoViewIfNeeded();
    expect(await lede.innerText()).toBe(quarter);
  });

  test('the CSV carries the scope, the window, the assumptions and the coverage note', async ({ page }) => {
    await openUsage(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV' }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks).toString('utf8');

    expect(csv).toContain('CFO: Whole company');
    expect(csv).toContain('This quarter');
    expect(csv).toContain('Rows checked by hand per hour');
    expect(csv).toContain('our number, until yours is on record');
    expect(csv).toContain('It does not count edits, reviews, views or time spent');
    expect(csv).toContain('1428000');
    expect(csv).toContain('18400');
  });

  test('the head-of-team view opens on what is stuck, with the real error text', async ({ page }) => {
    await openUsage(page);
    await stripPermission(page, OWNER_PERMISSION);
    await gotoUsage(page);

    await expect(page.locator('h1 + p')).toHaveText('Is anything stuck?');
    await expect(page.getByText(/Viewing as Head of Team · Your team only/)).toBeVisible();
    // A team lead's default window is the month, not the quarter.
    await expect(page.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true');

    const stuck = page.locator('#stuck');
    await expect(stuck).toContainText('Vendor Master Change Monitor');
    await expect(stuck).toContainText('Rows 24,001 onward were never read.');

    // What is stuck is the first thing on the tab this view opens on, and the
    // savings are a tab away rather than above it.
    const blocks = await page.locator('[data-usage-block] h3').allTextContents();
    expect(blocks[0]).toBe('What is stuck right now');
    expect(blocks).not.toContain('What it was worth');

    await usageTab(page, 'Value');
    await expect(page.locator('#headline')).toContainText('What it was worth');
  });

  test('the one per-person table is alphabetical and cannot be sorted', async ({ page }) => {
    await openUsage(page);
    await stripPermission(page, OWNER_PERMISSION);
    await gotoUsage(page);

    const people = page.locator('#people');
    await people.scrollIntoViewIfNeeded();
    await expect(people).toContainText('rather than comparing them');

    // No header is a button, a link, or anything else somebody could click to sort.
    const headers = people.locator('th');
    expect(await headers.count()).toBeGreaterThan(0);
    expect(await headers.locator('button, a, [role=button]').count()).toBe(0);

    const names = await people.locator('tbody tr td:first-child').allTextContents();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test('the auditor view is only theirs, in hours and never in rupees', async ({ page }) => {
    await openUsage(page);
    await stripPermission(page, OWNER_PERMISSION);
    await stripPermission(page, TEAM_PERMISSION);
    await gotoUsage(page);

    await expect(page.locator('h1 + p')).toHaveText('What is waiting on me?');
    await expect(page.getByText(/Viewing as Internal Auditor · Your own work only/)).toBeVisible();

    // One view offered, so there is no switch: a control with one option is
    // furniture.
    await expect(page.getByRole('button', { name: 'CFO', exact: true })).toHaveCount(0);

    const blocks = await page.locator('[data-usage-block] h3').allTextContents();
    expect(blocks[0]).toBe('What is waiting on you');

    // No money anywhere on this view, so no cost block and no rupee figure.
    await expect(page.locator('#cost')).toHaveCount(0);
    const body = await page.locator('main, body').first().innerText();
    expect(body).not.toContain('₹');

    await usageTab(page, 'Value');
    await expect(page.locator('#my-work')).toContainText('Time you did not spend');
    // Still no rupees once their own numbers are on screen.
    expect(await page.locator('main, body').first().innerText()).not.toContain('₹');
  });

  test('insights are split by kind and never added together', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Activity');
    const insights = page.locator('#insights');
    await insights.scrollIntoViewIfNeeded();

    await expect(insights).toContainText('inside individual checks');
    await expect(insights).toContainText('reading whole');
    await expect(insights).toContainText('would count the same observation twice');

    // Two lists rather than one, because one list would need one total.
    await expect(insights.getByRole('button', { name: /written inside one check/ })).toHaveCount(1);
    await expect(insights.getByRole('button', { name: /written across an engagement/ })).toHaveCount(1);
  });

  test('ageing runs from the day a finding was raised, and says what open means', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');
    const ageing = page.locator('#ageing');
    await ageing.scrollIntoViewIfNeeded();

    await expect(ageing).toContainText('0 to 7 days');
    await expect(ageing).toContainText('8 to 30 days');
    await expect(ageing).toContainText('More than 30 days');
    await expect(ageing).toContainText('not that the problem is still there');

    // The 30-plus bucket opens its list, oldest first, each with its owner.
    const drill = ageing.getByRole('button', { name: /open more than 30 days/ });
    if (await drill.count()) {
      await drill.first().click();
      await expect(ageing.locator('ul li').first()).toContainText('owned by');
    }
  });

  test('the false-alarm rate divides by classified findings only', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');
    const quality = page.locator('#quality');
    await quality.scrollIntoViewIfNeeded();

    await expect(quality).toContainText('Called real');
    await expect(quality).toContainText('Called a false alarm');
    // The unclassified findings are their own bar and never join the divisor.
    await expect(quality).toContainText('Nobody has looked yet');
    await expect(quality).toContainText('It does not mean the team is failing');
  });

  test('the process strip shows where each open engagement has got to', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');
    const portfolio = page.locator('#portfolio');
    await portfolio.scrollIntoViewIfNeeded();

    await expect(portfolio).toContainText('Where each open engagement has got to');
    await expect(portfolio).toContainText('Controls tested');
    await expect(portfolio).toContainText('Findings open');
    await expect(portfolio).toContainText('Plans open');

    // Sorted by a date rather than by a person, which is what stops it being a
    // ranking through the back door.
    await expect(portfolio).toContainText('Sorted by a date rather than by a person');
  });

  test('the page reads and never writes: no approve or reject anywhere on it', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Activity');
    const memory = page.locator('#memory');
    await memory.scrollIntoViewIfNeeded();

    await expect(memory).toContainText('This page only');
    await expect(memory.getByRole('button', { name: /^Approve$/ })).toHaveCount(0);
    await expect(memory.getByRole('button', { name: /^Reject$/ })).toHaveCount(0);
    await expect(memory.getByRole('button', { name: 'Open Smart Learn' }).first()).toBeVisible();
  });

  test('what was created counts five things, and controls is one of them', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Activity');
    const created = page.locator('#created');
    await created.scrollIntoViewIfNeeded();

    await expect(created).toContainText('Created, not activity');
    // Five tables, named in the lede. An empty one shows a designed zero rather
    // than the unmeasured empty state, so the noun is on screen either way.
    const text = await created.innerText();
    for (const noun of ['engagement', 'control', 'risk', 'dashboard', 'report']) {
      expect(text.toLowerCase()).toContain(noun);
    }
  });
  /*
   * Ten things a reader could read as a contradiction, each fixed once and
   * pinned here. Every one of these was a figure or a sentence that argued with
   * another figure or sentence somewhere else on the same page.
   */

  test('the two open counts on the coverage tab say which is which', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');

    // "60 raised, 37 still open" is about the window. The block under it counts
    // every finding nobody has closed, whenever it was raised, and now says so
    // in the sentence rather than only in the fold.
    const caught = page.locator('#caught');
    await caught.scrollIntoViewIfNeeded();
    await expect(caught).toContainText('of those still open');

    const ageing = page.locator('#ageing');
    await ageing.scrollIntoViewIfNeeded();
    // The distinction rides on the figure's own context line now, where the
    // number is, rather than in a paragraph above it.
    await expect(ageing).toContainText('will not match the open figure in the block above');
  });

  test('the cost block and the activity tab reconcile their lookup counts', async ({ page }) => {
    await openUsage(page);
    const cost = page.locator('#cost');
    await cost.scrollIntoViewIfNeeded();
    const charged = Number((await cost.innerText()).match(/([\d,]+) calls on a contract price/)?.[1].replace(/,/g, ''));
    expect(charged).toBeGreaterThan(0);

    // The activity tab counts every attempt. It used to print a larger number
    // with nothing on screen to explain the gap, so the cost block now names
    // both counts and says what sits between them.
    await usageTab(page, 'Activity');
    const volume = page.locator('#volume');
    await volume.scrollIntoViewIfNeeded();
    await volume.getByText('Show the numbers').click();
    const attempted = Number((await volume.innerText()).match(/Paid lookup calls\s*([\d,]+)/)?.[1].replace(/,/g, ''));
    expect(attempted).toBeGreaterThanOrEqual(charged);

    if (attempted > charged) {
      await usageTab(page, 'Value');
      await cost.scrollIntoViewIfNeeded();
      await cost.getByText('How this is counted').click();
      await expect(cost).toContainText(`The activity tab counts ${attempted.toLocaleString('en-IN')} lookup calls`);
      await expect(cost).toContainText('are counted and charged nothing');
    }
  });

  test('the window figure and the never-ever figure are told apart', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');

    // Same number, two different facts. The tile now says how many of its own
    // controls are in the harder list.
    const coverage = page.locator('#coverage');
    await coverage.scrollIntoViewIfNeeded();
    await expect(coverage).toContainText('not exercised in this window');
    await expect(coverage).toContainText(/has ever been tested|never tested at all|tested at some point before/);

    // And the never-ever block says whether its list is that same list.
    const never = page.locator('#never');
    await never.scrollIntoViewIfNeeded();
    await never.getByText('How this is counted').click();
    await expect(never).toContainText(/those same ones|that same one|Separately/);
  });

  test('never exercised never prints a zero half of its own sentence', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Coverage');
    const lede = page.locator('#never p').first();
    await lede.scrollIntoViewIfNeeded();
    // "and 0 checks have never run" is a double negative with a zero in it.
    expect(await lede.innerText()).not.toMatch(/\b0 (checks|controls) have never/);
  });

  test('alerts that fired do not read as a contradiction of alerts configured', async ({ page }) => {
    await openUsage(page);
    await usageTab(page, 'Activity');
    const dashboards = page.locator('#dashboards');
    await dashboards.scrollIntoViewIfNeeded();
    const text = await dashboards.innerText();

    // An alert set up last quarter still fires in this one, so a window with
    // fires and no new alerts says that rather than the bare "No alert was
    // configured in this window".
    if (/Alerts fired [1-9]/.test(text) && /Open the 0 alerts set up in this window/.test(text)) {
      await expect(dashboards).toContainText('set up before');
    }
  });

  test('a window with almost nothing in it does not claim a busiest stretch', async ({ page }) => {
    await openUsage(page);
    await page.getByRole('button', { name: 'This month' }).click();
    await page.waitForTimeout(600);
    const overTime = page.locator('#over-time');
    await overTime.scrollIntoViewIfNeeded();
    const text = await overTime.innerText();

    // "The busiest stretch was 1 Mar, at 1 run" is the lede reading a formula
    // out loud. Below the floor it says how little there was and stops.
    if (/at 1 run\b/.test(text)) {
      expect(text).toContain('too little to have a busy stretch');
    }
  });

  test('the sampling sentence counts every validation the link opens', async ({ page }) => {
    await openUsage(page);
    await stripPermission(page, OWNER_PERMISSION);
    await gotoUsage(page);
    await usageTab(page, 'Coverage');

    const sampling = page.locator('#sampling');
    await sampling.scrollIntoViewIfNeeded();
    await sampling.getByText('How this is counted').click();
    const text = await sampling.innerText();
    const opened = Number(text.match(/Open the ([\d,]+) validation/)?.[1].replace(/,/g, '') ?? '0');
    const settled = ['passed', 'failed', 'errored']
      .map(word => Number(text.match(new RegExp(`([\\d,]+) (?:samples? )?${word}`))?.[1].replace(/,/g, '') ?? '0'))
      .reduce((a, b) => a + b, 0);

    // Anything the sentence does not account for has to be named in it.
    if (opened > settled) expect(text).toContain('still running or waiting to start');
  });

  test('the auditor Value tab shows their hours, and Coverage is not one block', async ({ page }) => {
    await openUsage(page);
    await stripPermission(page, OWNER_PERMISSION);
    await stripPermission(page, TEAM_PERMISSION);
    await gotoUsage(page);

    await usageTab(page, 'Value');
    // A tab called Value that shows no value is the complaint this fixes. The
    // hours are in the block's own sum, once, with nothing restating them.
    const myWork = page.locator('#my-work');
    await myWork.scrollIntoViewIfNeeded();
    await expect(myWork).toContainText('Time you did not spend');

    await usageTab(page, 'Coverage');
    const blocks = page.locator('[data-usage-block]');
    expect(await blocks.count()).toBeGreaterThan(1);

    // Still hours and never rupees, whatever was added to the tab.
    expect(await page.locator('main, body').first().innerText()).not.toContain('₹');
  });

  test('the two lookup counts say on screen why they differ', async ({ page }) => {
    await openUsage(page);

    // Activity counts every call attempted.
    await usageTab(page, 'Activity');
    const surfaces = page.locator('#ai-usage');
    await surfaces.scrollIntoViewIfNeeded();
    const surfaceText = await surfaces.innerText();
    const attempted = Number(
      surfaceText.match(/([\d,]+) calls/)?.[1].replace(/,/g, '') ?? '0',
    );

    // The cost block counts what the contract charges for.
    await usageTab(page, 'Value');
    const cost = page.locator('#cost');
    await cost.scrollIntoViewIfNeeded();
    const charged = Number(
      (await cost.innerText()).match(/([\d,]+) calls on a contract price/)?.[1].replace(/,/g, '') ?? '0',
    );

    // Where they disagree, the gap is named with its number next to the larger
    // one, not folded away. Two counts of one thing and no reason between them
    // is how a page loses its reader.
    if (attempted > charged) {
      expect(surfaceText).toContain(`${charged.toLocaleString('en-IN')} of them are on a contract price`);
      expect(surfaceText).toMatch(/nobody has priced yet|never came back/);
    }
  });
});
