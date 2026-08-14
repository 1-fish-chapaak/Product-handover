import { test, expect, type Page } from './_helpers';

/**
 * Platform Usage — the acceptance tests from the build spec.
 *
 * Each of these is a claim the page makes about itself: that the lens is a lens
 * and not a key, that a partial cost is never printed under a complete label,
 * that the never-run list ignores the period, that nothing sorts people, and
 * that an engine error reaches the reader in the engine's own words. The page's
 * whole claim to being trustworthy is these rules, so they are tested rather
 * than described.
 *
 * Needs the Vite dev server on the URL in playwright.config.ts.
 */

const SETTINGS_KEY = 'irame.platformUsage.settings.v2';
const PRICING_KEY = 'irame.platformUsage.pricing.v1';
const INVOICES_KEY = 'irame.platformUsage.invoices.v1';

async function openUsageAs(page: Page, userId: string) {
  await page.addInitScript(
    ([id, settingsKey, pricingKey, invoicesKey]) => {
      try {
        window.localStorage.setItem('auth.currentUserId', id);
        window.localStorage.removeItem(settingsKey);
        // A bill or a price entered by one test must never cost another's window.
        window.localStorage.removeItem(pricingKey);
        window.localStorage.removeItem(invoicesKey);
      } catch { /* ignore */ }
    },
    [userId, SETTINGS_KEY, PRICING_KEY, INVOICES_KEY],
  );
  await page.goto('/');
  // `?view=` does not whitelist this route, so use the app's own nav event.
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('irame:command-palette-navigate', {
        detail: { kind: 'control', id: '', view: 'platform-usage' },
      }),
    ),
  );
  await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toBeVisible();
}

/** One block. The page section is also a landmark, so match the block's hook. */
const block = (page: Page, name: string) =>
  page.locator('[data-usage-block]').filter({ hasText: name }).first();

/**
 * Open a folded section.
 *
 * The page opens on the section that answers its question and folds the rest,
 * so a test about a block inside a folded section has to open it first — the
 * same click the reader makes.
 */
async function openSection(page: Page, title: string) {
  const header = page.getByRole('button', { name: new RegExp(`^${title}`, 'i') }).first();
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click();
}

/** A block by its exact heading, for names that appear inside other blocks. */
const namedBlock = (page: Page, heading: string) =>
  page.locator('[data-usage-block]')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true, level: 3 }) })
    .first();

const pageHeader = (page: Page) =>
  page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });

test.describe('the lens is a lens, not a key', () => {
  test('a system admin is offered all three views', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    for (const lens of ['Whole company', 'My team', 'Just me']) {
      await expect(page.getByRole('button', { name: lens, exact: true })).toBeVisible();
    }
  });

  test('a team lead is never offered the whole company', async ({ page }) => {
    await openUsageAs(page, 'u-teamlead');
    await expect(page.getByRole('button', { name: 'Whole company', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'My team', exact: true })).toBeVisible();
    await expect(pageHeader(page)).toContainText('You are seeing SOX Audit');
    // The settings editor is CFO only: per-team assumptions make teams incomparable.
    await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0);
  });

  test('an auditor gets their own view and no switch at all', async ({ page }) => {
    await openUsageAs(page, 'u-auditor');
    await expect(pageHeader(page)).toContainText('You are seeing only your own work');
    await expect(page.getByRole('button', { name: 'My team', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Whole company', exact: true })).toHaveCount(0);
  });

  test('the scope line always says whose data, which window, and how old it is', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await expect(pageHeader(page)).toContainText('You are seeing the whole company');
    await expect(pageHeader(page)).toContainText('Data as of 21 Apr 2026');
  });
});

test.describe('honest numbers', () => {
  test('the words "AI cost" appear nowhere on the page', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).not.toContain('ai cost');
    // The one money figure from an AI area is labelled as what it actually is.
    await expect(block(page, 'AI usage by area')).toContainText('Concierge job cost');
  });

  test('every AI row carries how well the figure is known', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const ai = block(page, 'AI usage by area');
    for (const label of ['exact', 'estimated', 'not measured', 'no record']) {
      await expect(ai).toContainText(label);
    }
  });

  test('the hero says work avoided, not net value, while the cost is unknown', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await expect(block(page, 'Work avoided')).toBeVisible();
    await expect(page.locator('[data-usage-block]').filter({ hasText: 'Net value' })).toHaveCount(0);
  });

  test('the cost tile is complete or says why it is not, never a partial total', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const cost = block(page, 'Cost to run');
    await expect(cost).toContainText('No invoice entered for this period');
    await expect(cost).toContainText('Concierge job cost');
  });

  test('what the page cannot see is said on screen, not left as a silence', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    // One line under the scope line, on every view, from the one shared string.
    // It separates what is counted from what only fills as the event log grows.
    await expect(pageHeader(page)).toContainText('Edits and reviews appear as the event log fills');
    await openUsageAs(page, 'u-auditor');
    await expect(pageHeader(page)).toContainText('Edits and reviews appear as the event log fills');
  });
});

test.describe('the arithmetic', () => {
  test('halving the review rate doubles the hours saved', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const hero = block(page, 'Work avoided');
    const read = async () => Number((await hero.innerText()).match(/([\d,]+(?:\.\d+)?) hours/)?.[1].replace(/,/g, ''));
    const before = await read();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#setting-manualReviewRate').fill('100');
    await page.getByRole('button', { name: 'Save and recalculate' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const after = await read();
    // Machine time is subtracted once per run either way, so this is close to
    // exactly double rather than exactly double.
    expect(after / before).toBeGreaterThan(1.95);
    expect(after / before).toBeLessThan(2.05);
  });

  test('the assumptions panel previews the headline before anything is saved', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');
    const before = await dialog.innerText();
    await page.locator('#setting-manualReviewRate').fill('800');
    await expect(dialog).not.toHaveText(before);
    // Nothing has been saved: the page behind it has not moved.
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('the never-run list ignores the period selector', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'The audit work');
    const never = block(page, 'Never exercised');
    const asQuarter = await never.innerText();

    await page.getByRole('button', { name: /This quarter/ }).click();
    await page.getByRole('option', { name: 'This year' }).click();
    await expect(pageHeader(page)).toContainText('1 Jan 2026');

    expect(await never.innerText()).toBe(asQuarter);
  });

  test('the four work-volume counts are never added together', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const volume = block(page, 'Work volume by unit');
    await expect(volume).toContainText('Not addable');
    for (const unit of ['Workflow runs', 'Bulk runs', 'Questions asked', 'Concierge jobs']) {
      await expect(volume).toContainText(unit);
    }
    await expect(volume).not.toContainText(/total/i);
  });

  test('every chart offers the numbers behind it', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const chart = block(page, 'Value over time');
    await chart.getByRole('button', { name: 'Table' }).click();
    await expect(chart.locator('tbody tr').first()).toBeVisible();
  });
});

test.describe('nobody is ranked', () => {
  test('the team table is alphabetical and no column can be sorted', async ({ page }) => {
    await openUsageAs(page, 'u-teamlead');
    await openSection(page, 'Your team');
    const table = block(page, 'Per-person outcomes');
    const names = await table.locator('tbody tr td:first-child').allInnerTexts();
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    // No header is a control, by click or by any other route.
    await expect(table.locator('th button')).toHaveCount(0);
    await expect(table.locator('th[aria-sort="ascending"], th[aria-sort="descending"]')).toHaveCount(0);
    // Somebody with no runs still appears: this is a team list, not a leaderboard.
    expect(names.length).toBeGreaterThan(1);
    // The rule is held in the numbers, not just in the sentence above them.
    await expect(table.locator('tbody')).not.toContainText(/average|rank|%/i);
  });

  test('an auditor sees no rupee figure and no other person', async ({ page }) => {
    await openUsageAs(page, 'u-auditor');
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('₹');
    expect(body).not.toMatch(/average|percentile/i);
  });
});

test.describe('what needs doing reaches the thing that needs doing', () => {
  test('a stuck run shows the engine error in full', async ({ page }) => {
    await openUsageAs(page, 'u-teamlead');
    const stuck = block(page, 'Stuck runs');
    const text = await stuck.innerText();
    if (text.includes('Nothing is stuck')) test.skip();
    // The engine's own words, with the machine-readable prefix intact.
    expect(text).toMatch(/[A-Za-z]+Error|Timeout|Mismatch|Exceeded|Reset/);
    expect(text).not.toContain('…');
  });

  test('an auditor queue item opens what needs doing', async ({ page }) => {
    await openUsageAs(page, 'u-auditor');
    const queue = block(page, 'My queue');
    const first = queue.locator('li button').first();
    if ((await queue.innerText()).includes('You are clear')) test.skip();
    await first.click();
    await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toHaveCount(0);
  });
});

test.describe('the assumptions say where they came from', () => {
  test('a fresh workspace labels every assumption a starting value', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await expect(block(page, 'Work avoided')).toContainText('starting value');
  });

  test('the page suggests a rate measured from the team, with its sample and window', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Your team got through [\d,]+ rows an hour over the last 90 days/);
    await expect(dialog).toContainText(/across [\d,]+ timed reviews/);
  });

  test('nothing is auto-applied — the suggestion waits for a click', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');
    // Still the shipped value, still labelled as such, until somebody adopts it.
    await expect(page.locator('#setting-manualReviewRate')).toHaveValue('200');
    await expect(dialog.getByRole('button', { name: 'Use it' })).toBeVisible();
  });

  test('adopting flips the value and the source together, everywhere', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: 'Use it' }).first().click();
    await expect(page.locator('#setting-manualReviewRate')).not.toHaveValue('200');
    await expect(dialog).toContainText('Using the measured rate');

    await dialog.getByRole('button', { name: 'Save and recalculate' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The page's own assumptions strip now says the number was measured.
    await expect(block(page, 'Work avoided')).toContainText("measured from your team's last 90 days");
  });

  test('typing over a value marks it as set by hand', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#setting-manualReviewRate').fill('275');
    await page.getByRole('button', { name: 'Save and recalculate' }).click();
    await expect(block(page, 'Work avoided')).toContainText('set by hand');
  });

  test('what cannot be measured says so instead of leaving a gap', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');
    // Money settings: no platform can measure these.
    await expect(dialog).toContainText('No platform can measure this one');
    // Manual control tests: nothing times them yet, so there is no suggestion.
    await expect(dialog).toContainText('No manual control test carries a start and a finish time yet');
  });
});

test.describe('created this period', () => {
  const counts = async (page: Page) => {
    const created = block(page, 'Created this period');
    const text = await created.innerText();
    return Object.fromEntries(
      ['Engagements', 'RACMs', 'Controls', 'Dashboards', 'Reports'].map(label => {
        const m = new RegExp(`([\\d,]+)\\s*\\n${label}`).exec(text);
        return [label, Number((m?.[1] ?? '').replace(/,/g, ''))];
      }),
    );
  };

  test('the caption says created, never activity', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const created = block(page, 'Created this period');
    await expect(created).toContainText('Records made in this window');
    await expect(created).not.toContainText(/activity/i);
  });

  test('a team sees its own creations, never more than the company made', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const company = await counts(page);
    await page.getByRole('button', { name: 'My team', exact: true }).click();
    await openSection(page, 'Your team');
    const team = await counts(page);
    for (const key of Object.keys(company)) {
      expect(team[key]).toBeLessThanOrEqual(company[key]);
    }
    // The window narrowed, so at least one area must have fewer.
    expect(Object.keys(company).some(k => team[k] < company[k])).toBe(true);
  });

  test('a zero is a designed zero, not the not-measured state', async ({ page }) => {
    await openUsageAs(page, 'u-teamlead');
    await openSection(page, 'Your team');
    const created = block(page, 'Created this period');
    await expect(created).toContainText('0');
    await expect(created.locator('.border-dashed')).toHaveCount(0);
  });

  test('an auditor is shown no creation tally at all', async ({ page }) => {
    await openUsageAs(page, 'u-auditor');
    await expect(page.locator('[data-usage-block]').filter({ hasText: 'Created this period' })).toHaveCount(0);
  });
});

test.describe('empty states say which kind of empty', () => {
  test('not measured looks different from nothing happened', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'The audit work');
    // "We cannot measure this" is dashed and set in italics.
    await expect(block(page, 'Cost to run').locator('.border-dashed')).toBeVisible();
    // "Nothing happened in this window" is a plain sentence, no dashed frame.
    await expect(block(page, 'Never exercised').locator('.border-dashed')).toHaveCount(0);
  });
});


test.describe('the rest of the product, not just the AI', () => {
  test('a dashboard count opens the list of who made each one', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const dash = namedBlock(page, 'Dashboards, widgets and alerts');
    await dash.getByRole('button', { name: /^Name the/ }).click();
    const first = dash.locator('li').first();
    // Name, maker and date: a count with no list behind it does not ship.
    await expect(first).toContainText(/\d{1,2} [A-Z][a-z]{2} 20\d\d/);
  });

  test('an alert nobody triggered says so rather than naming a person', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const dash = namedBlock(page, 'Dashboards, widgets and alerts');
    await dash.getByRole('button', { name: /^Show what fired/ }).click();
    await expect(dash).toContainText('automatic, no person involved');
  });

  test('reports made and reports worked on are two numbers, never one', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const reports = namedBlock(page, 'Reports');
    await expect(reports).toContainText('recorded activities');
    await expect(reports).toContainText(/made this (quarter|month|year)/);
    await expect(reports).not.toContainText(/total/i);
  });

  test('an errored validation is held apart from a failed one', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'The audit work');
    const sampling = namedBlock(page, 'Sampling');
    if ((await sampling.innerText()).includes('No sample was validated')) test.skip();
    await expect(sampling).toContainText('errored, needs a person');
    await expect(sampling).toContainText('failed');
    await expect(sampling).toContainText('says nothing about the control');
  });

  test('consolidated insights are never added to the per-run ones', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const insights = namedBlock(page, 'AI insights');
    if ((await insights.innerText()).includes('wrote nothing down')) test.skip();
    await expect(insights).toContainText('from a single run');
    await expect(insights).toContainText('across an engagement');
    await expect(insights).not.toContainText(/total|insights in all/i);
  });
});

test.describe('the audit work itself', () => {
  test('the risk block leads with the severe risks nothing covers', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'The audit work');
    const risks = namedBlock(page, 'Risks');
    await expect(risks).toContainText('critical or high risks no control covers');
    // Nothing records how a risk was added, so no origin split is claimed.
    await expect(risks).toContainText('does not record whether a risk was typed by a person');
    // The list behind the count names each risk, with its id.
    await risks.getByRole('button', { name: /^Name the/ }).click();
    await expect(risks).toContainText(/RSK-\d+/);
  });

  test('every engagement row reaches the engagement', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'The audit work');
    const portfolio = namedBlock(page, 'Engagements');
    await expect(portfolio).toContainText('controls tested');
    await portfolio.locator('li button').first().click();
    await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toHaveCount(0);
  });

  test('continuous monitoring shows what it expects next to what it got', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await openSection(page, 'Behind the numbers');
    const ccm = namedBlock(page, 'CCM and automation');
    await expect(ccm).toContainText('engagements monitored continuously');
    await expect(ccm).toContainText(/expects \d+%/);
  });

  test('a team with no continuous monitoring is told that, not shown a zero', async ({ page }) => {
    await openUsageAs(page, 'u-teamlead');
    await openSection(page, 'Gaps');
    const ccm = namedBlock(page, 'CCM and automation');
    const text = await ccm.innerText();
    if (!text.includes('No engagement is set up')) test.skip();
    await expect(ccm).toContainText('runs as a one off audit');
  });
});

test.describe('costing the paid lookups', () => {
  test('the cost screen is the CFO\'s alone', async ({ page }) => {
    await openUsageAs(page, 'u-teamlead');
    await expect(page.getByRole('button', { name: 'Cost the paid lookups' })).toHaveCount(0);
  });

  test("one number a month turns work avoided into net value", async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await expect(namedBlock(page, 'Work avoided')).toBeVisible();

    await page.getByRole('button', { name: 'Cost the paid lookups' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#bill-vendor').fill('Signzy');
    await dialog.locator('#bill-amount').fill('184500');
    await dialog.getByRole('button', { name: 'Enter this bill' }).click();
    // Entered to the paisa, and it says who entered it.
    await expect(dialog).toContainText('₹1,84,500.00');
    await expect(dialog).toContainText('entered by');
    await dialog.getByRole('button', { name: 'Done' }).click();

    await expect(namedBlock(page, 'Net value')).toBeVisible();
    const cost = namedBlock(page, 'Cost to run');
    await expect(cost).toContainText('from 1 invoice');
    // The rate underneath is context and says so.
    await expect(cost).toContainText('derived from your invoices');
    await expect(cost).toContainText('not a price anybody quoted');
  });

  test('a window with a month missing its bill is not costed at all', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Cost the paid lookups' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#bill-vendor').fill('Signzy');
    await dialog.locator('#bill-amount').fill('184500');
    await dialog.getByRole('button', { name: 'Enter this bill' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // April is billed; the year is not. A part-billed window has no total.
    await page.getByRole('button', { name: /This quarter/ }).click();
    await page.getByRole('option', { name: 'This year' }).click();
    const cost = namedBlock(page, 'Cost to run');
    await expect(cost).toContainText('months in this window have no invoice entered yet');
    await expect(namedBlock(page, 'Work avoided')).toBeVisible();
  });

  test('the per API split is optional, and its gap against the bill is shown', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'Cost the paid lookups' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#bill-vendor').fill('Signzy');
    await dialog.locator('#bill-amount').fill('184500');
    await dialog.getByRole('button', { name: 'Enter this bill' }).click();

    // Layer 3 is folded away until somebody asks for it.
    await expect(dialog.locator('#price-workflow')).toHaveCount(0);
    await dialog.getByRole('button', { name: /Split the bill per API/ }).click();
    await dialog.locator('#price-unit').selectOption('row');
    await dialog.locator('#price-amount').fill('1.75');
    await dialog.locator('#price-from').fill('2025-10-01');
    await dialog.getByRole('button', { name: 'Add this price' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    const cost = namedBlock(page, 'Cost to run');
    await expect(cost).toContainText('Priced per API the same runs come to');
    // The bill is still the figure. The split is only compared against it.
    await expect(cost).toContainText('from 1 invoice');
  });
});
