/**
 * Platform Usage, run against the real page.
 *
 * The rule this page lives by is that every figure has a column behind it, so
 * the tests that matter most are the ones that check it never says more than
 * the record holds: a check that ran is never attributed to a person, a figure
 * an engine does not report reads "not reported" rather than nought, and the
 * gaps are on the page rather than left blank.
 */

import { test, expect, enterWorkspace, type Page } from './_helpers';

/**
 * Open the page.
 *
 * The `?view=` whitelist does not carry this surface, so it is reached the way
 * the command palette reaches it rather than by a deep link.
 */
async function openUsage(page: Page) {
  await page.goto('/');
  await enterWorkspace(page);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('irame:command-palette-navigate', {
    detail: { kind: 'control', id: '', view: 'platform-usage' },
  })));
  await expect(page.getByRole('heading', { name: 'Platform Usage', level: 1 })).toBeVisible();
  // Wait for a figure rather than for a duration. The snapshot is computed on
  // render, and a fixed pause is a race that only shows up on a loaded machine.
  await expect(page.locator('#ran')).toContainText('checks finished');
}

/** Open a folding group by id, if it is not already open. */
async function openGroup(page: Page, id: string) {
  const shut = page.locator(`#${id} button[aria-expanded="false"]`).first();
  if (await shut.count()) {
    await shut.click();
    await page.waitForTimeout(250);
  }
  await expect(page.locator(`#${id} button[aria-expanded="true"]`).first()).toBeVisible();
  await expect(page.locator(`#${id} p, #${id} table`).first()).toBeVisible();
}

/** Switch the reader. */
async function readAs(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(300);
}

test.describe('Platform Usage', () => {
  test('the quarter reads off the record: runs, time and rows returned', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'ran');
    const ran = page.locator('#ran');

    // 330 of 352 executions in Jan to Mar 2026 reached complete.
    await expect(ran).toContainText('330');
    await expect(ran).toContainText('11.5 hours');
    // Rows the completed runs returned, summed off their output tables.
    await expect(ran).toContainText('6,24,796');
    // Every workflow that ran is listed with the team it belongs to.
    await expect(ran.locator('table').first()).toContainText('Journal entry anomalies');
    await expect(ran.locator('table').first()).toContainText('SOX Audit');
  });

  test('rows returned are never called rows read', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'ran');
    // The page may say what a check returned. It may never claim coverage of a
    // population, because nothing records how much of one a query touched.
    await expect(page.locator('#ran')).toContainText('rows for somebody to look at');
    await expect(page.locator('#ran')).not.toContainText('rows checked');
    await expect(page.locator('#ran')).not.toContainText('rows covered');
  });

  test('nothing on the page is priced, estimated or converted to hours saved', async ({ page }) => {
    await openUsage(page);
    for (const id of ['ran', 'tested', 'found', 'produced', 'queries', 'imports', 'workspace', 'gaps']) {
      await openGroup(page, id);
    }
    const body = page.locator('main, body').first();
    // No money in either currency, no assumed rate, no modelled saving.
    await expect(body).not.toContainText('₹');
    await expect(body).not.toContainText('$');
    await expect(body).not.toContainText('hours saved');
    await expect(body).not.toContainText('auditor hour');
    await expect(body).not.toContainText('rows an hour');
    await expect(body).not.toContainText('a starting value we picked');
    // The old page marked its guesses with the word beside the figure. There
    // are no guesses now, so the marker is gone with them: the only surviving
    // use of the word is the footer saying nothing here is one.
    // Tokens are recorded nowhere, so they are never counted, and the old
    // page's marker for a guessed figure is gone with the guesses. Both words
    // survive only where the page says why it will not print one.
    for (const id of ['ran', 'tested', 'found', 'produced', 'queries', 'imports', 'workspace']) {
      await expect(page.locator(`#${id}`)).not.toContainText('estimated');
      await expect(page.locator(`#${id}`)).not.toContainText('tokens');
    }
  });

  test('a check that ran is never put against a person', async ({ page }) => {
    await openUsage(page);
    await readAs(page, 'Your own work');
    await openGroup(page, 'ran');
    const ran = page.locator('#ran');
    await expect(ran).toContainText('cannot be put against a person');
    // And the refusal is said in words rather than shown as a nought.
    await expect(ran).not.toContainText('0 checks finished');
  });

  test('an engine that does not report bytes reads "not reported", never nought', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'queries');
    const queries = page.locator('#queries');
    const table = queries.locator('table').first();
    await expect(table).toContainText('not reported');
    await expect(queries).toContainText('do not report how much data a query scanned');
    // Postgres and MySQL are the two in this workspace that report nothing.
    await expect(queries).toContainText('mysql');
    await expect(queries).toContainText('postgres');
  });

  test('the populations are what was available to test, not what was covered', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'tested');
    const tested = page.locator('#tested');
    await expect(tested).toContainText('14,28,000');
    await expect(tested).toContainText('not a claim about coverage');
  });

  test('exceptions carry severity and status because both are columns', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'found');
    const found = page.locator('#found');
    await expect(found).toContainText('346');
    await expect(found).toContainText('High');
    await expect(found).toContainText('52%');
    // Only a case somebody put a date on can be overdue, and the page says so.
    await expect(found).toContainText('a floor rather than a total');
  });

  test('the last sign in is one timestamp, and the page refuses to count logins', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'workspace');
    const workspace = page.locator('#workspace');
    await expect(workspace).toContainText('overwritten on each sign in');
    await expect(workspace).toContainText('never counts active users');
  });

  test('the gaps are a section on the page, not a footnote', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'gaps');
    const gaps = page.locator('#gaps');
    await expect(gaps).toContainText('What this page cannot tell you');
    await expect(gaps).toContainText('Who ran a check');
    await expect(gaps).toContainText('What the AI cost, in tokens or in money');
    await expect(gaps).toContainText('Which screens or features people use');
  });

  test('the window narrows every figure together', async ({ page }) => {
    await openUsage(page);
    await openGroup(page, 'ran');
    await expect(page.locator('#ran')).toContainText('330');
    await page.getByLabel('Window').selectOption('this-month');
    await page.waitForTimeout(300);
    // March alone is a third of the quarter, so the count must fall.
    await expect(page.locator('#ran')).not.toContainText('330');
    await expect(page.locator('header')).toContainText('this month');
  });
});
