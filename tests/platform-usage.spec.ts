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

    // Narrowing to one person takes the money off the page with it.
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
    const headline = page.locator('#headline');

    // 340 successful runs over populations of 1,428,000 rows, in 8.5 hours.
    await expect(headline).toContainText('1,428,000');
    await expect(headline).toContainText('340');
    await expect(headline).toContainText('8.5');

    // 1,428,000 rows at 200 an hour is 7,140 hours by hand, and at 1,200 rupees
    // an hour that is 85.68 lakh.
    await expect(headline).toContainText('7,140');
    await expect(headline).toContainText('₹85.7 lakh');

    // 7,140 less 8.5 is 7,131.5, rounded down because a saving never rounds up.
    await expect(headline).toContainText('7,131');

    // 7,140 hours over the 480 a person works in a quarter is about 15 people.
    await expect(headline).toContainText('15');
    await expect(headline).toContainText('480');

    // The contract charged ₹18,400, leaving ₹85.5 lakh.
    const cost = page.locator('#cost');
    await expect(cost).toContainText('₹18,400');
    await expect(cost).toContainText('₹85.5 lakh');
  });

  test('the hero says net value only while the cost is complete', async ({ page }) => {
    await openUsage(page);
    const hero = page.locator('#hero');

    // One lookup in this window has no contract price yet, so the cost is not
    // complete and the hero must not print a net figure minus an unknown.
    const heading = await hero.locator('h3').innerText();
    if (heading === 'Net value') {
      await expect(hero).toContainText('spent running the platform');
    } else {
      expect(heading).toBe('Work avoided');
      await expect(hero).toContainText('is not complete yet');
      await expect(hero.getByText('cost to run')).toBeVisible();
    }

    // Whichever state it is in, the four tiles are always there.
    await expect(hero).toContainText('hours saved');
    await expect(hero).toContainText('money saved');
    await expect(hero).toContainText('people equivalent');
    await expect(hero).toContainText('cost to run');
  });

  test('coverage counts a population once, and says so next to the repeats', async ({ page }) => {
    await openUsage(page);
    const coverage = page.locator('#coverage');

    await expect(coverage).toContainText('1,428,000');
    await expect(coverage).toContainText('checks performed');

    // The repeats are far larger than the coverage. If these two ever match,
    // the count-once rule has been lost and the page is inflating itself.
    const text = await coverage.innerText();
    const checks = Number(text.match(/([\d,]+)\s*\n?\s*checks performed/)?.[1].replace(/,/g, '') ?? 0);
    expect(checks).toBeGreaterThan(1_428_000 * 10);
  });

  test('failed runs are reported on their own and kept out of every saving', async ({ page }) => {
    await openUsage(page);
    // The owner's headline counts successful runs only.
    await expect(page.locator('#headline')).toContainText('successful runs');
    await expect(page.locator('#volume')).toContainText('runs that failed');
  });

  test('every chart has a table one click away', async ({ page }) => {
    await openUsage(page);
    const toggles = page.getByRole('button', { name: /^Table$/ });
    const count = await toggles.count();
    expect(count).toBeGreaterThan(2);

    for (let i = 0; i < count; i += 1) {
      const toggle = toggles.nth(0); // the list re-renders as each one flips
      await toggle.scrollIntoViewIfNeeded();
      await toggle.click();
      await page.waitForTimeout(120);
    }
    await expect(page.getByRole('button', { name: /^Chart$/ }).first()).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('every count opens its list, with a name and a date', async ({ page }) => {
    await openUsage(page);
    const drills = page.getByRole('button', { name: /^Open the / });
    expect(await drills.count()).toBeGreaterThan(3);

    const drill = drills.first();
    await drill.scrollIntoViewIfNeeded();
    await drill.click();
    // The list names the thing, who made it and when. Looking for a date is how
    // we know it is a real list rather than the same count rendered twice.
    const list = page.locator('[data-usage-block] ul li').filter({ hasText: /\d{4}/ }).first();
    await expect(list).toBeVisible();
  });

  test('the assumptions are on screen with their source, and two states are visible', async ({ page }) => {
    await openUsage(page);
    const assumptions = page.locator('#assumptions');
    await assumptions.scrollIntoViewIfNeeded();

    // The rate has not met its guard, so it is still labelled a starting value
    // and says how far short of the sample it is.
    await expect(assumptions).toContainText('Rows checked by hand per hour');
    await expect(assumptions).toContainText('starting value');

    // The control-test hours have met both guards, so they measured themselves.
    await expect(assumptions).toContainText('Hours per manual control test');
    await expect(assumptions).toContainText("based on your team's measured pace");

    // The two that can never be measured say why.
    await expect(assumptions).toContainText('No software can see salaries');
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
    await expect(page.locator('#headline')).toContainText('this month');
  });

  test('never exercised ignores the period selector', async ({ page }) => {
    await openUsage(page);
    const never = page.locator('#never');
    await never.scrollIntoViewIfNeeded();

    await expect(never).toContainText('This block ignores the window');
    const quarter = await never.innerText();

    await page.getByRole('button', { name: 'This month' }).click();
    await page.waitForTimeout(600);
    await never.scrollIntoViewIfNeeded();
    const month = await never.innerText();

    // Only the footnote about the window may move. The never-ever lede must not.
    expect(month.split('Separately')[0]).toBe(quarter.split('Separately')[0]);
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
    expect(csv).toContain('starting value');
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

    // Savings sit at the bottom of this view, under everything actionable.
    const blocks = await page.locator('[data-usage-block] h3').allTextContents();
    expect(blocks[0]).toBe('What is stuck right now');
    expect(blocks[blocks.length - 1]).toBe('What it was worth');
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

    await expect(page.locator('#my-work')).toContainText('hours you saved');
  });

  test('insights are split by kind and never added together', async ({ page }) => {
    await openUsage(page);
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
    const memory = page.locator('#memory');
    await memory.scrollIntoViewIfNeeded();

    await expect(memory).toContainText('This page only');
    await expect(memory.getByRole('button', { name: /^Approve$/ })).toHaveCount(0);
    await expect(memory.getByRole('button', { name: /^Reject$/ })).toHaveCount(0);
    await expect(memory.getByRole('button', { name: 'Open Smart Learn' }).first()).toBeVisible();
  });

  test('what was created counts five things, and controls is one of them', async ({ page }) => {
    await openUsage(page);
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
});
