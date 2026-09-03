/**
 * Platform Usage. The PRD's acceptance criteria, run against the real page.
 *
 * `PRD-PLATFORM-USAGE.md` section 10 lists nineteen criteria and this file is
 * them, in order, one describe block each, so a failure names the criterion it
 * broke rather than a block that moved. Section 9's QA list is folded in where
 * it says something the criteria do not.
 *
 * The page is one scroll of folded groups rather than three tabs, so a spec
 * that wants a block opens the group it lives in first. Every figure asserted
 * here is arithmetic anybody can redo by hand from section 3 of the PRD.
 */

import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, enterWorkspace, type Page } from './_helpers';

/**
 * Open the page.
 *
 * The `?view=` whitelist does not carry this surface, so the page is reached
 * the way the command palette reaches it rather than by a deep link.
 */
async function gotoUsage(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', {
    detail: { kind: 'control', id: '', view: 'platform-usage' },
  })));
  await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toBeVisible();
  await page.waitForTimeout(700);
}

async function openUsage(page: Page) {
  await page.goto('/');
  await enterWorkspace(page);
  await page.waitForTimeout(700);
  await gotoUsage(page);
}

/** Which of the three views is leading. */
function viewSwitch(page: Page, name: 'Value' | 'Coverage and findings') {
  return page.getByRole('button', { name, exact: true });
}

async function chooseView(page: Page, name: 'Value' | 'Coverage and findings') {
  await viewSwitch(page, name).click();
  await page.waitForTimeout(600);
}

/** Pick a window. The chip carries the one in force and lists the rest. */
async function chooseWindow(page: Page, label: string) {
  await page.getByRole('button', { name: /^Window,/ }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(600);
}

/** Open a folded group by its heading, and leave it open. */
async function openGroup(page: Page, title: string) {
  const heading = page.getByRole('button', { name: new RegExp(`^${title}`) }).first();
  await heading.scrollIntoViewIfNeeded();
  if ((await heading.getAttribute('aria-expanded')) !== 'true') {
    await heading.click();
    await page.waitForTimeout(400);
  }
}

/** Strip one permission from System Admin, which is how entitlement changes. */
async function stripPermission(page: Page, description: string) {
  await page.getByRole('button', { name: /^Admin$/ }).first().click();
  await page.getByRole('button', { name: /Roles & Permissions/ }).first().click();
  await page.getByText('System Admin', { exact: true }).first().click();
  await page.getByRole('button', { name: 'edit', exact: true }).first().click();
  await page.locator('input[placeholder*="earch"]').first().fill('Usage');
  await page.getByText(description, { exact: true }).first().click();
  await page.getByRole('button', { name: /Save Changes/ }).first().click();
  await page.waitForTimeout(700);
}

const COMPANY_PERMISSION = 'View workspace-wide platform usage and adoption metrics';

async function csvOf(page: Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV' }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test.describe('Platform Usage', () => {
  /* ── AC-01, AC-02 · the switch, and where each reader lands ─────────────── */

  test('AC-01 the switch offers the two views, each with the question it answers', async ({ page }) => {
    await openUsage(page);

    await expect(viewSwitch(page, 'Value')).toBeVisible();
    await expect(viewSwitch(page, 'Coverage and findings')).toBeVisible();

    // There is no third view. An Activity view was built and cut, because two
    // of its three blocks could not name a decision that turned on them.
    await expect(page.getByRole('button', { name: 'Activity', exact: true })).toHaveCount(0);
    await expect(page.getByText('Is the team actually using what we bought?')).toHaveCount(0);
    await expect(page.getByText('Who is using it')).toHaveCount(0);
    await expect(page.getByText('What got created')).toHaveCount(0);

    // The question is on the switch in words, so a reader picking for
    // themselves never needs the page to have guessed right.
    await expect(page.getByText('Is this paying for itself?')).toBeVisible();
    await chooseView(page, 'Coverage and findings');
    await expect(page.getByText('Am I ready for the committee, and what is slipping?')).toBeVisible();
  });

  test('AC-02 a reader who can see the company figures lands on Value', async ({ page }) => {
    await openUsage(page);
    await expect(viewSwitch(page, 'Value')).toHaveAttribute('aria-pressed', 'true');
  });

  test('AC-02 the view a reader picks is where the page opens next time', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');

    await page.reload();
    await enterWorkspace(page);
    await page.waitForTimeout(900);
    await gotoUsage(page);

    await expect(viewSwitch(page, 'Coverage and findings')).toHaveAttribute('aria-pressed', 'true');
  });

  test('AC-01 a reader without the company view is never offered it, and only narrows down their own line', async ({ page }) => {
    await openUsage(page);
    await stripPermission(page, COMPANY_PERMISSION);
    await gotoUsage(page);

    // Lands on what they can actually see rather than on a view they cannot.
    await expect(viewSwitch(page, 'Coverage and findings')).toHaveAttribute('aria-pressed', 'true');

    // Down your own line only. The whole company is not on the control at all,
    // so it cannot be asked for.
    await expect(page.getByRole('button', { name: 'Your team only', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Whole company', exact: true })).toHaveCount(0);
  });

  /* ── The header line ────────────────────────────────────────────────────── */

  test('the header line states the reader, the scope, the window and the counted to date', async ({ page }) => {
    await openUsage(page);
    const line = page.locator('header p').last();
    await expect(line).toContainText('Viewing as Value');
    await expect(line).toContainText('Whole company');
    await expect(line).toContainText('This quarter, 1 Jan 2026 to 31 Mar 2026');
    await expect(line).toContainText('Counted to 31 Mar 2026');
  });

  /* ── AC-03, AC-04 · the rate and its derivation ─────────────────────────── */

  test('AC-03 the rate is a round 500 and 1,200 appears nowhere', async ({ page }) => {
    await openUsage(page);
    await expect(page.locator('#worth')).toContainText('at ₹500 an hour');

    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      const body = await page.locator('body').innerText();
      expect(body).not.toContain('₹1,200');
      expect(body).not.toContain('1,200 an hour');
    }
  });

  test('AC-04 the whole derivation renders on the same screen as the money it produces', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'Where the rate comes from');

    const group = page.locator('#rate');
    // The ladder, said the way an auditor is actually paid: month, day, hour.
    await expect(group).toContainText('One month');
    await expect(group).toContainText('₹80,000');
    await expect(group).toContainText('One day');
    await expect(group).toContainText('₹4,000');
    await expect(group).toContainText('One hour of audit work');
    await expect(group).toContainText('₹500');
    await expect(group).toContainText('about 20 working days');
    await expect(group).toContainText('a working day is 8 hours');

    // It is called an estimate, in those words, before any figure.
    await expect(group).toContainText('It is an estimate');
    await expect(group).toContainText('round on purpose');

    // The published pay data is context, never proof.
    await expect(group).toContainText('which is what we looked at, not what we are claiming');

    // And the money it produces is on the same page, not one click away.
    await expect(page.locator('#worth')).toContainText('₹35.7 lakh');
  });

  test('the working opens on click, not only on hover', async ({ page }) => {
    await openUsage(page);
    const worth = page.locator('#worth');

    // Nothing is open at rest.
    await expect(worth.getByRole('tooltip')).toHaveCount(0);

    // A touch reader and a keyboard reader get nothing from hover, so the mark
    // has to be a real button that opens on click.
    const mark = worth.locator('button[data-working]').first();
    await mark.click();
    await expect(worth.getByRole('tooltip').first()).toBeVisible();

    // And Escape closes it again.
    await page.keyboard.press('Escape');
    await expect(worth.getByRole('tooltip')).toHaveCount(0);
  });

  test('an estimated figure says so before anybody hovers', async ({ page }) => {
    await openUsage(page);
    const worth = page.locator('#worth');

    // Both kinds are on this screen: rows and machine time are recorded, the
    // by-hand hours and the money rest on an estimate.
    await expect(worth.locator('button[data-working="recorded"]').first()).toBeVisible();
    const estimate = worth.locator('button[data-working="estimated"]').first();
    await expect(estimate).toBeVisible();

    // Opening one says it is an estimate in those words, before the working.
    await estimate.click();
    await expect(page.getByRole('tooltip').first()).toContainText('This is an estimate');
  });

  test('AC-05 a person gives you 160 hours a month and 480 a quarter', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'Where the rate comes from');
    const assumptions = page.locator('#rate');
    const row = assumptions.getByText('Working hours per person per month').locator('../..');
    await expect(row).toContainText('160');
    await expect(row).toContainText('20 working days at 8 hours');
    await expect(row).toContainText('Over a quarter that is 480 hours');
    await expect(row).toContainText('Round numbers, and an estimate');
  });

  test('AC-06 the pace label says rule checking rather than a substantive procedure', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'Where the rate comes from');
    await expect(page.locator('#rate')).toContainText(
      'It is not full substantive testing with documentation, which the profession puts at 4 to 9 transactions an hour',
    );
    await expect(page.locator('#worth')).toContainText(
      'a person reading a row in a spreadsheet, checking it against a rule and moving on',
    );
  });

  /* ── AC-07 · the four ways, and why they differ ─────────────────────────── */

  test('AC-07 the four rows are ways of getting an audit hour, and the cause is named', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'Where the rate comes from');
    const group = page.locator('#rate');

    await expect(group).toContainText('Auditors you employ');
    await expect(group).toContainText('if only six hours of the day reach audit work');
    await expect(group).toContainText('Hours bought from a firm, at the lower end');
    await expect(group).toContainText('Hours bought from a firm, at the upper end');

    // Every rate here is round, because every one of them is an estimate.
    await expect(group).toContainText('₹500');
    await expect(group).toContainText('₹650');
    await expect(group).toContainText('₹1,000');
    await expect(group).toContainText('₹2,500');
    await expect(group).toContainText('₹35.7 lakh');
    await expect(group).toContainText('₹46.4 lakh');
    await expect(group).toContainText('₹71.3 lakh');
    await expect(group).toContainText('₹1.78 cr');

    // The spread is a fact about the customer's operating model, not our doubt.
    await expect(group).toContainText(
      'It is the difference between employing auditors and buying their hours from a firm',
    );
    await expect(group).toContainText('The hours saved are the same in every row');
  });

  /* ── AC-08 · the worked example, to the rupee ───────────────────────────── */

  test('AC-08 Q4 FY26 reconciles', async ({ page }) => {
    await openUsage(page);
    const worth = page.locator('#worth');

    await expect(worth).toContainText('1,428,000');
    await expect(worth).toContainText('8.5 hours');
    await expect(worth).toContainText('7,140 hours');
    await expect(worth).toContainText('7,131');
    // Whole auditors. There is no such thing as nine tenths of one.
    await expect(worth).toContainText('15 auditors');
    await expect(worth).toContainText('₹35.7 lakh');
    // The contract charge sits beside the work avoided, never subtracted from it.
    await expect(worth).toContainText('₹18,400');
    await expect(worth).toContainText('shown beside the work avoided rather than taken off it');
    expect(await worth.innerText()).not.toContain('net');

    await openGroup(page, 'What the contract charged');
    await expect(page.locator('#charged')).toContainText('₹18,400');
  });

  /* ── AC-09 · the financial year ─────────────────────────────────────────── */

  test('AC-09 financial year to date is its own window and differs from the quarter', async ({ page }) => {
    await openUsage(page);
    const worth = page.locator('#worth');
    const quarter = await worth.innerText();

    await chooseWindow(page, 'Financial year to date');
    await page.waitForTimeout(400);

    await expect(page.locator('header p').last()).toContainText(
      'Financial year to date, 1 Apr 2025 to 31 Mar 2026',
    );
    expect(await worth.innerText()).not.toBe(quarter);

    // Every flow figure moves with the window. Coverage does not: the same
    // eleven populations are counted once in both, which is the rule the page
    // is built on rather than a figure that failed to update.
    expect(await worth.innerText()).not.toContain('340 successful runs');
    expect(await worth.innerText()).not.toContain('7,131');
    await expect(worth).toContainText('1,428,000 rows');
  });

  /* ── AC-10 · the six committee lines ────────────────────────────────────── */

  test('AC-10 the coverage view carries the six lines a committee asks for', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');

    // 1 · the plan, 2 · what was covered and what was left out
    await expect(page.locator('#plan')).toContainText('engagements are on the books');
    await expect(page.locator('#covered')).toContainText('controls in your library were exercised');
    await expect(page.locator('#covered')).toContainText('have no control mapped to them');
    // 3 · everything against a sample of it
    await expect(page.locator('#covered')).toContainText('the sample would have to grow');
    // 4 · time to detection, 5 · findings and their age, 6 · what was promised
    await expect(page.locator('#caught')).toContainText('before the platform caught it');
    await expect(page.locator('#caught')).toContainText('How long the open ones have been open');
    await expect(page.locator('#caught')).toContainText('action plans are open');
  });

  /* ── AC-11 · one snapshot, page and exports ─────────────────────────────── */

  test('AC-11 the CSV carries the same figures as the screen, with the reader and the window', async ({ page }) => {
    await openUsage(page);
    const csv = await csvOf(page);

    expect(csv).toContain('Value, for finance');
    expect(csv).toContain('Whole company');
    expect(csv).toContain('This quarter');
    expect(csv).toContain('Counted to 31 Mar 2026');
    expect(csv).toContain('It does not count edits, reviews, views or time spent');

    // The same figures the page prints, from the same snapshot() call.
    expect(csv).toContain('1428000');
    expect(csv).toContain('18400');
    expect(csv).toContain('7,131');

    // Every assumption with its derivation.
    expect(csv).toContain('Rows checked against a rule by hand per hour');
    expect(csv).toContain('Where the auditor rate comes from');
    expect(csv).toContain('₹80,000 a month');
    expect(csv).toContain('an estimate');
    expect(csv).toContain('which is what we looked at, not what we are claiming');
    expect(csv).toContain('What those hours are worth, four ways');
  });

  /* ── AC-12 · read and never write ───────────────────────────────────────── */

  test('AC-12 no control on the page changes a record it reports on', async ({ page }) => {
    await openUsage(page);

    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      for (const word of [/^Approve$/, /^Reject$/, /^Resolve$/, /^Save$/, /^Delete$/, /^Assign$/, /^Close$/]) {
        await expect(page.getByRole('button', { name: word })).toHaveCount(0);
      }
    }

    // The one write in the feature is the audit event an export emits.
    await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible();
  });

  /* ── AC-13 · no benchmark and no target ─────────────────────────────────── */

  test('AC-13 no benchmark, target or comparison against another company', async ({ page }) => {
    await openUsage(page);
    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/benchmark/i);
      expect(body).not.toMatch(/percentile/i);
      expect(body).not.toMatch(/industry average/i);
      expect(body).not.toMatch(/compared with other/i);
      expect(body).not.toMatch(/\btarget\b/i);
    }
  });

  /* ── AC-14 · nothing ranks anybody ──────────────────────────────────────── */

  test('AC-14 nothing on the page ranks anybody', async ({ page }) => {
    await openUsage(page);

    // The per person table was cut with the Activity view, so the strongest
    // form of this rule now is that there is no per person table at all.
    await expect(page.locator('#people')).toHaveCount(0);

    // And no table anywhere on the page offers a sort control.
    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      await expect(page.locator('table thead button')).toHaveCount(0);
    }
  });

  /* ── AC-15 · every chart offers its table ───────────────────────────────── */

  test('AC-15 a chart is one click from its numbers, and no chart uses ResponsiveContainer', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'The same work, week by week');

    const group = page.locator('#over-time');
    await expect(group.locator('.recharts-wrapper')).toBeVisible();
    await group.getByRole('button', { name: 'Show the numbers' }).click();
    await page.waitForTimeout(300);
    await expect(group.locator('table')).toBeVisible();
    await expect(group).toContainText('Rows newly covered');

    const dir = join(process.cwd(), 'src/components/usage');
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
      expect(readFileSync(join(dir, file), 'utf8')).not.toContain('<ResponsiveContainer');
    }
  });

  /* ── AC-16 · nothing asks the customer to supply data ───────────────────── */

  test('AC-16 nothing on the page asks the customer for a figure it would then treat as a fact', async ({ page }) => {
    await openUsage(page);
    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      // Open everything, so a field cannot hide inside a folded group.
      const folds = page.locator('h2 button[aria-expanded="false"]');
      for (let i = await folds.count(); i > 0; i--) {
        await folds.first().click();
        await page.waitForTimeout(150);
      }
      // No rate field, no pace field, no price field, on any view. A figure the
      // customer typed is not a figure we could defend.
      await expect(page.locator('main input, main textarea, main select')).toHaveCount(0);
    }
  });

  test('AC-16 the window is a view control, so its two dates are the only fields in the feature', async ({ page }) => {
    await openUsage(page);
    await chooseWindow(page, 'Custom');

    const fields = page.locator('main input');
    await expect(fields).toHaveCount(2);
    await expect(page.getByLabel('Window starts')).toHaveAttribute('type', 'date');
    await expect(page.getByLabel('Window ends')).toHaveAttribute('type', 'date');
    // Nothing here is a figure. Both dates are bounded by the records themselves.
    await expect(page.getByLabel('Window ends')).toHaveAttribute('max', '2026-03-31');
  });

  test('a custom range moves the window, and every figure that depends on it', async ({ page }) => {
    await openUsage(page);
    const worth = page.locator('#worth');
    const quarter = await worth.innerText();
    expect(quarter).toContain('340 successful');
    expect(quarter).toContain('8.5 hours');
    expect(quarter).toContain('7,131');
    expect(quarter).toContain('15 auditors');

    await chooseWindow(page, 'Custom');
    await page.getByLabel('Window starts').fill('2026-02-01');
    await page.waitForTimeout(600);
    await page.getByLabel('Window ends').fill('2026-02-28');
    await page.waitForTimeout(900);

    await expect(page.locator('header p').last()).toContainText('Custom range, 1 Feb 2026 to 28 Feb 2026');

    const february = await worth.innerText();
    expect(february).not.toBe(quarter);
    expect(february).not.toContain('340 successful');
    expect(february).not.toContain('8.5 hours');
    expect(february).not.toContain('7,131');
    expect(february).not.toContain('15.4');
    expect(february).not.toContain('52,759,600');

    /*
     * Rows covered does not move, and that is the coverage rule rather than a
     * figure that failed to update: February exercised the same eleven
     * populations the quarter did, and a population is counted once however
     * often it was re-tested. What moved is the effort, which is what the
     * checks performed line is for.
     */
    expect(february).toContain('1,428,000 rows');

    // The whole page moves with the window, not only the block that was open.
    await chooseView(page, 'Coverage and findings');
    await expect(page.locator('header p').last()).toContainText('Custom range, 1 Feb 2026 to 28 Feb 2026');
    expect(await page.locator('#ran').innerText()).not.toContain('354 checks ran');
  });

  /* ── AC-17 · at most three groups open ──────────────────────────────────── */

  test('AC-17 each view opens with three groups expanded and the rest folded', async ({ page }) => {
    await openUsage(page);
    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      expect(await page.locator('h2 button[aria-expanded="true"]').count()).toBe(3);
      expect(await page.locator('h2 button[aria-expanded="false"]').count()).toBeGreaterThan(0);
    }
  });

  /* ── AC-18 · the copy ───────────────────────────────────────────────────── */

  test('AC-18 no em dash in visible copy outside a table blank', async ({ page }) => {
    await openUsage(page);
    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      const prose = await page.locator('main p, main h1, main h2, main h3, main th').allInnerTexts();
      for (const text of prose) expect(text).not.toContain('—');
    }
  });

  /* ── Section 9 · the rules a later change could quietly break ───────────── */

  test('a population is counted once, and its repeats are named on the same screen', async ({ page }) => {
    await openUsage(page);
    const worth = page.locator('#worth');
    await expect(worth).toContainText('counted once for each population however often it was re-tested');
    await expect(worth).toContainText('1,428,000 rows');
    await expect(worth).toContainText('52,759,600 row checks performed');
  });

  test('failed runs are kept out of every saving and reported on their own', async ({ page }) => {
    await openUsage(page);
    await expect(page.locator('#worth')).toContainText('Failed runs are left out of every saving here and reported on their own');

    await openGroup(page, 'What ran, and what is stuck');
    await expect(page.locator('#ran')).toContainText('machine time went on runs that produced nothing');
  });

  test('what is stuck carries the words the failure itself used', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'What ran, and what is stuck');
    const stuck = page.locator('#ran');
    await expect(stuck).toContainText('Connection to the vendor master reset after 30s');
    await expect(stuck).toContainText('Stuck means it failed and nothing has run successfully since');
  });

  test('insights are split by kind and never added together', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'What ran, and what is stuck');
    const block = page.locator('#ran');
    await expect(block).toContainText('Inside one check');
    await expect(block).toContainText('Across a whole engagement');
    await expect(block).toContainText('a total would count the same observation twice');
  });

  test('open means nobody has dealt with it, and age runs from the day it was raised', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');
    const caught = page.locator('#caught');
    await expect(caught).toContainText('Open means nobody has dealt with it yet, not that the problem is still there');
    await expect(caught).toContainText('Age runs from the day a finding was first raised');
  });

  test('the false alarm rate divides by classified findings only', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');
    const caught = page.locator('#caught');
    await expect(caught).toContainText('Nobody has looked yet');
    await expect(caught).toContainText('Dividing by every finding would let a large untouched backlog report a flattering one');
  });

  test('an unmeasured figure is dashed and never renders as a nought', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');

    // Nothing in the records carries a completion date, so plan completion is
    // absent and says why. It never prints 0%.
    const plan = page.locator('#plan');
    await expect(plan).toContainText('No engagement in your records carries a completion date');
    await expect(plan).not.toContainText('0%');
    await expect(plan.locator('.border-dashed')).toBeVisible();
  });

  test('never exercised ignores the window on purpose', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');
    const covered = page.locator('#covered');
    const never = await covered.getByText('Never exercised at all').locator('..').locator('..').innerText();

    await chooseWindow(page, 'This month');
    expect(await covered.getByText('Never exercised at all').locator('..').locator('..')
      .innerText()).toBe(never);
  });

  test('a reader on their own work sees hours and never rupees', async ({ page }) => {
    await openUsage(page);
    await page.getByRole('button', { name: 'Your own work only', exact: true }).click();
    await page.waitForTimeout(800);

    for (const view of ['Value', 'Coverage and findings'] as const) {
      await chooseView(page, view);
      const folds = page.locator('h2 button[aria-expanded="false"]');
      for (let i = await folds.count(); i > 0; i--) {
        await folds.first().click();
        await page.waitForTimeout(150);
      }
      expect(await page.locator('main').innerText()).not.toContain('₹');
    }
  });

  test('a drill down is named in the sentence and leaves for the screen that owns the work', async ({ page }) => {
    await openUsage(page);
    await chooseView(page, 'Coverage and findings');
    await page.locator('#plan').getByRole('button', { name: 'Open the engagements' }).first().click();
    await page.waitForTimeout(900);
    await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toHaveCount(0);
  });
});
