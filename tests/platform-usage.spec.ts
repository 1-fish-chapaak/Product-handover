import { test, expect, type Page } from './_helpers';

/**
 * Platform Usage — the acceptance tests out of the build spec.
 *
 * Every one of these is a claim the page makes about itself: that the lens is a
 * lens and not a key, that a partial cost is never printed under a complete
 * sounding label, that the never run list ignores the window, that nothing sorts
 * people, and that an engine error reaches the reader in the engine's own words.
 * The page's whole claim to being trustworthy is these rules, so they are tested
 * rather than described.
 *
 * Needs the Vite dev server on the URL in playwright.config.ts.
 */

const KEYS = [
  'irame.platformUsage.settings.v3',
  'irame.platformUsage.changes.v3',
];

/** The platform-side config key. No screen writes it; a test stands in for ops. */
const CONTRACT_KEY = 'irame.platformUsage.contract.v1';

async function openUsageAs(page: Page, userId: string) {
  await page.addInitScript(([id, keys]) => {
    try {
      window.localStorage.setItem('auth.currentUserId', id as string);
      // A bill or a price entered by one test must never cost another's window.
      (keys as string[]).forEach(key => window.localStorage.removeItem(key));
    } catch { /* private mode */ }
  }, [userId, KEYS] as const);
  await page.goto('/');
  // `?view=` does not whitelist this route, so use the app's own nav event.
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', {
      detail: { kind: 'control', id: '', view: 'platform-usage' },
    })));
  await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toBeVisible();
}

/** A workspace whose contract has not been loaded yet. */
async function withNoContract(page: Page) {
  await page.addInitScript(key => {
    try { window.localStorage.setItem(key as string, '[]'); } catch { /* private mode */ }
  }, CONTRACT_KEY);
}

/** One block, matched on its own heading. */
const block = (page: Page, name: string) =>
  page.locator('[data-usage-block]').filter({ has: page.getByRole('heading', { name, exact: true }) }).first();

const lens = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/* ──────────────────────────────────────────────────────────────────────────
 * The lens
 * ────────────────────────────────────────────────────────────────────────── */

test.describe('the lens is a lens, not a key', () => {
  test('an admin is offered all three, and the scope line always says which', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await expect(lens(page, 'CFO')).toBeVisible();
    await expect(lens(page, 'Head of Team')).toBeVisible();
    await expect(lens(page, 'Internal Auditor')).toBeVisible();

    await expect(page.getByText(/^Viewing as CFO · Whole company ·/)).toBeVisible();
    await lens(page, 'Head of Team').click();
    await expect(page.getByText(/^Viewing as Head of Team · My team ·/)).toBeVisible();
    await lens(page, 'Internal Auditor').click();
    await expect(page.getByText(/^Viewing as Internal Auditor · Just me ·/)).toBeVisible();
  });

  test('a viewer is never offered a view above their entitlement, and still gets their own', async ({ page }) => {
    await openUsageAs(page, 'u-viewer');
    await expect(page.getByText(/^Viewing as Internal Auditor · Just me ·/)).toBeVisible();
    await expect(lens(page, 'CFO')).toHaveCount(0);
    await expect(lens(page, 'Head of Team')).toHaveCount(0);
    // Not an empty page: their own view is fully rendered.
    await expect(block(page, 'Waiting on you')).toBeVisible();
  });

  test('an auditor sees hours and never rupees on their own view', async ({ page }) => {
    await openUsageAs(page, 'u-auditor');
    const work = block(page, 'Your work');
    await expect(work).toBeVisible();
    await expect(work).toContainText('Time you saved');
    await expect(work).not.toContainText('₹');
    // No comparison of any kind reaches this view.
    const page_text = await page.locator('main, body').first().innerText();
    expect(page_text).not.toMatch(/team average|percentile|compared with the team/i);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * Answers first
 * ────────────────────────────────────────────────────────────────────────── */

test.describe('the page answers before it asks', () => {
  test('every view opens with at most three attention cards, each with one action', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const strip = page.locator('section[aria-label="Needs your attention"]');
    await expect(strip).toBeVisible();
    const cards = strip.locator('li');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('button')).toHaveCount(1);
    }
  });

  test('every block leads with a sentence rather than a number', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const blocks = page.locator('[data-usage-block]');
    const total = await blocks.count();
    expect(total).toBeGreaterThan(10);
    for (let i = 0; i < total; i++) {
      const text = (await blocks.nth(i).innerText()).replace(/\s+/g, ' ').trim();
      // A block either opens on a sentence or on its own empty state, and both
      // are sentences: a bare figure under the heading is the failure.
      expect(text.length).toBeGreaterThan(40);
    }
  });

  test('an attention card takes the reader to the block it is about', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    await page.getByRole('button', { name: 'See which' }).first().click();
    await expect(block(page, 'Risks')).toBeInViewport({ timeout: 4000 });
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-01 to PU-05 — the value, and the honest cost
 * ────────────────────────────────────────────────────────────────────────── */

test.describe('value and cost', () => {
  test('the cost appears from the contract, and says where it came from', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const cost = block(page, 'Cost to run');
    await expect(cost).toBeVisible();
    await expect(cost).toContainText('as per your contract');
    await expect(cost).toContainText('Charged by your contract');
    // Nothing on the page asks anybody for a price or a bill.
    await expect(cost.getByRole('button', { name: /enter|save|add|bill|price/i })).toHaveCount(0);
    await expect(cost.locator('input')).toHaveCount(0);
  });

  test('the hero is Net value once the contract prices it, and shows the deduction', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const value = block(page, 'Net value');
    await expect(value).toBeVisible();
    await expect(value).toContainText('of work avoided, less');
  });

  test('with no contract loaded the hero is Work avoided and the cost block is honestly empty', async ({ page }) => {
    await withNoContract(page);
    await openUsageAs(page, 'u-admin');
    const value = block(page, 'Work avoided');
    await expect(value).toBeVisible();
    await expect(value).toContainText('of work avoided');
    await expect(page.getByRole('heading', { name: 'Net value' })).toHaveCount(0);

    const cost = block(page, 'Cost to run');
    await expect(cost).toContainText('Your contract prices have not been loaded yet');
    await expect(cost).toContainText('paid lookups');
    // The absence is stated, never printed as a zero cost.
    await expect(cost).not.toContainText('₹0');
  });

  test('the contract rows behind the figure are named, with the price and the unit', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const cost = block(page, 'Cost to run');
    await cost.scrollIntoViewIfNeeded();
    await cost.getByRole('button', { name: /The contract rows behind this figure/ }).click();
    await expect(cost).toContainText('irame operations');
    await expect(cost).toContainText(/per (run|row)/);
  });

  test('a per-run API charges once for a run, not once per row', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const cost = block(page, 'Cost to run');
    await cost.scrollIntoViewIfNeeded();
    await cost.getByRole('button', { name: /What each API charged/ }).click();
    const row = cost.locator('tbody tr', { hasText: 'CIN API Check' }).first();
    await expect(row).toContainText('per run');
    const cells = await row.locator('td').allInnerTexts();
    // Columns: API, successful calls, runs, price, charged. A per-run API's charge
    // is its runs times its price, which is far less than its calls times price.
    const calls = Number(cells[1].replace(/[^0-9]/g, ''));
    const runs = Number(cells[2].replace(/[^0-9]/g, ''));
    const charged = Number(cells[4].replace(/[^0-9.]/g, ''));
    expect(runs).toBeLessThan(calls);
    expect(Math.round(charged)).toBe(Math.round(runs * 12));
  });

  test('every value figure shows the assumptions it rests on, and where they came from', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const value = block(page, 'Net value');
    await expect(value).toContainText('rows a person checks by hand in an hour');
    await expect(value).toContainText("based on your team's measured pace");
    await expect(value).toContainText('for one auditor hour');
    await expect(value).toContainText('(starting value)');
  });

  test('the assumptions carry their own change history', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    const drill = page.getByRole('button', { name: /Assumptions changed/ }).first();
    await expect(drill).toBeVisible();
    await drill.click();
    await expect(page.getByText('the platform, on its own').first()).toBeVisible();
  });
});

test.describe('nobody at the customer types a number', () => {
  test('the page offers no input of any kind, and states its own assumptions', async ({ page }) => {
    await openUsageAs(page, 'u-admin');

    // Every block open, so a field hiding inside a drill would be caught too.
    const drills = page.locator('[data-usage-block] button[aria-expanded="false"]');
    for (let i = await drills.count(); i > 0; i--) {
      await drills.first().click().catch(() => { /* it opened something else */ });
    }

    // The period selector's custom range is the page's only input, and it is
    // closed until asked for. Nothing else on the page takes a value.
    await expect(page.locator('[data-usage-block] input, [data-usage-block] select, [data-usage-block] textarea')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Pin$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Save this price|Enter this bill|Enter a bill/ })).toHaveCount(0);

    // And the numbers it rests on are stated under the figures they produce.
    await expect(block(page, 'Net value')).toContainText('rows a person checks by hand in an hour');
  });

  test('the contract is versioned, so a renegotiation does not rewrite an old window', async ({ page }) => {
    await openUsageAs(page, 'u-admin');
    // A window that spans the renegotiation, so both rows are behind the figure.
    // A window that does not is charged by one row, which is the point of them.
    await page.getByRole('button', { name: 'Since you started', exact: true }).click();
    const cost = block(page, 'Cost to run');
    await cost.scrollIntoViewIfNeeded();
    await cost.getByRole('button', { name: /The contract rows behind this figure/ }).click();
    const rows = cost.locator('li', { hasText: 'PAN Basic API Check' });
    // Two rows for one API: the one that was in force, and the one that replaced
    // it. Both are readable, and neither can be edited from here.
    await expect(rows).toHaveCount(2);
    await expect(cost).toContainText('until');
    await expect(cost).toContainText('in force');
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-06 · PU-07 — coverage, and the count that ignores the window
 * ────────────────────────────────────────────────────────────────────────── */

test('the never run list ignores the period selector', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const never = block(page, 'Never exercised, ever');
  const before = (await never.innerText()).replace(/\s+/g, ' ');

  await page.getByRole('button', { name: 'Since you started', exact: true }).click();
  await expect(page.getByText(/Since you started, 1 Oct 2025/)).toBeVisible();

  const after = (await never.innerText()).replace(/\s+/g, ' ');
  expect(after).toBe(before);
});

test('coverage counts a control once however many times it ran', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const coverage = block(page, 'Control coverage');
  await expect(coverage).toContainText('a control run fifty times counts once here');
  await expect(coverage).toContainText(/\d+% of the library/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-09 — four units, never summed
 * ────────────────────────────────────────────────────────────────────────── */

test('the four work units are never added together', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const volume = block(page, 'Work volume by unit');
  await expect(volume).toContainText('Workflow runs');
  await expect(volume).toContainText('Bulk runs');
  await expect(volume).toContainText('Chat questions');
  await expect(volume).toContainText('Concierge jobs');
  await expect(volume).toContainText('they are never added together');
  const text = await volume.innerText();
  expect(text).not.toMatch(/total (actions|work|activity)/i);
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-11 — the engine's own words
 * ────────────────────────────────────────────────────────────────────────── */

test('a stuck run shows the engine error verbatim, and names a repeat', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  await lens(page, 'Head of Team').click();
  const stuck = block(page, 'What is stuck');
  await expect(stuck).toBeVisible();
  const text = await stuck.innerText();
  // A real engine string, not a summary of one.
  expect(text).toMatch(/failed at step 4|timed out after 120s|not found in|returned 503|Out of memory|credential expired|Waiting on input/);
  expect(text).toMatch(/run-\d{5}/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-13 — nobody is ranked
 * ────────────────────────────────────────────────────────────────────────── */

test('the per person table is alphabetical and cannot be re-sorted', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  await lens(page, 'Head of Team').click();
  const people = block(page, 'Your team, by outcome');
  await expect(people).toBeVisible();

  const names = await people.locator('tbody tr td:first-child').allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

  // No header is a button, a link, or anything else a click could reorder.
  await expect(people.locator('th button, th a, th [role="button"]')).toHaveCount(0);
  const text = await people.innerText();
  expect(text).not.toMatch(/average|rank|share of|%/i);
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-12 — no blended AI cost, ever
 * ────────────────────────────────────────────────────────────────────────── */

test('AI usage carries an accuracy label on every row and never says AI cost', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const ai = block(page, 'AI usage by area');
  await expect(ai).toBeVisible();
  const rows = ai.locator('li');
  const count = await rows.count();
  expect(count).toBe(5);
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(/exact|estimated|not measured|no record/);
  }
  await expect(ai).toContainText('Concierge job cost');
  const whole = await page.locator('body').innerText();
  expect(whole).not.toMatch(/\bAI cost\b/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-14 — the queue reaches the thing that needs doing
 * ────────────────────────────────────────────────────────────────────────── */

test('every queue item is one click from the thing it is about', async ({ page }) => {
  await openUsageAs(page, 'u-auditor');
  const queue = block(page, 'Waiting on you');
  await expect(queue).toBeVisible();
  const items = queue.locator('ul > li button');
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  await items.first().click();
  // The click leaves the page for the thing that needs doing.
  await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toHaveCount(0);
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-22 · PU-23 — every count opens its list
 * ────────────────────────────────────────────────────────────────────────── */

test('a count opens the list of what it counted, with who made each one', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const dashboards = block(page, 'Dashboards, widgets and alerts');
  await dashboards.scrollIntoViewIfNeeded();
  await dashboards.getByRole('button', { name: /Name the \d+ dashboards/ }).click();
  const rows = dashboards.locator('ul li');
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(rows.first()).toContainText(/\d{4}/);
});

test('a worker fired alert is labelled automatic rather than left blank', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const dashboards = block(page, 'Dashboards, widgets and alerts');
  await dashboards.scrollIntoViewIfNeeded();
  await dashboards.getByRole('button', { name: /See the alerts that fired/ }).click();
  await expect(dashboards).toContainText('automatic, no person involved');
});

test('reports made and reports worked on are never added together', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const reports = block(page, 'Reports');
  await expect(reports).toContainText('Reports made');
  await expect(reports).toContainText('Times worked on');
  await expect(reports).toContainText('never added up');
});

/* ──────────────────────────────────────────────────────────────────────────
 * PU-24 · PU-25 · PU-26 — the audit's own numbers
 * ────────────────────────────────────────────────────────────────────────── */

test('an errored validation is shown apart from a failed one', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const sampling = block(page, 'Sample validation');
  await expect(sampling).toContainText('Errored, needs a person');
  await expect(sampling).toContainText('Failed');
});

test('consolidated insights are counted apart from the per run ones', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const insights = block(page, 'Insights generated');
  await expect(insights).toContainText('about a single run');
  await expect(insights).toContainText('pull a whole engagement together');
});

test('the unmapped severe risks are named, not just counted', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const risks = block(page, 'Risks');
  await risks.scrollIntoViewIfNeeded();
  await expect(risks).toContainText(/critical and high risks?( in the register)? (have|has) no control/);
  await risks.getByRole('button', { name: /Name the \d+ with no control/ }).click();
  await expect(risks.locator('tbody tr').first()).toContainText(/RSK-\d+/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * Every chart has a table
 * ────────────────────────────────────────────────────────────────────────── */

test('every chart offers the numbers behind it', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const overTime = block(page, 'Value over time');
  await overTime.scrollIntoViewIfNeeded();
  await overTime.getByRole('button', { name: 'Table' }).click();
  await expect(overTime.locator('th').first()).toBeVisible();
  const heads = await overTime.locator('th').allInnerTexts();
  expect(heads.join(' ')).toMatch(/HOURS SAVED/i);
});

/* ──────────────────────────────────────────────────────────────────────────
 * The exports carry their own context
 * ────────────────────────────────────────────────────────────────────────── */

test('the CSV export carries the scope, the window, the assumptions and the coverage note', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV' }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString('utf8');

  expect(csv).toContain('Viewing as,CFO');
  expect(csv).toContain('Scope,the whole company');
  expect(csv).toMatch(/Window,"/);
  expect(csv).toContain('What this covers,');
  expect(csv).toContain('Assumptions behind every value figure');
  expect(csv).toContain('Work volume by unit (four units, never summed)');
  // The cost comes from the contract, and the contract itself is in the file.
  expect(csv).toContain('Your contract prices');
  expect(csv).toMatch(/Charged by your contract \(INR\),\d+/);
  expect(csv).toMatch(/irame operations/);
});

/* ──────────────────────────────────────────────────────────────────────────
 * The coverage note, on every view
 * ────────────────────────────────────────────────────────────────────────── */

test('the page always says what it does not cover', async ({ page }) => {
  await openUsageAs(page, 'u-admin');
  for (const name of ['CFO', 'Head of Team', 'Internal Auditor']) {
    await lens(page, name).click();
    await expect(page.getByText(/It does not count edits, reviews, views or time spent/)).toBeVisible();
  }
});
