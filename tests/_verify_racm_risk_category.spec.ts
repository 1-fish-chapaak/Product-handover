import { test, expect } from './_helpers';
import type { Page } from '@playwright/test';
import { openFromLibrary } from './_sox_helpers';

/**
 * RACM Management, stage 3 (22 Sep) — risk categories.
 *
 * Six categories now, not three: Financial, Operational, Compliance, Fraud,
 * IT general control and Reputational. Three were added because client matrices
 * already carry them and the old three squashed them — a fraud risk and a
 * financial-reporting risk both landed on "Financial", losing the distinction
 * the matrix is scoped on. "Financial reporting" is NOT a seventh: it reads as
 * Financial. "Strategic" reads as Operational.
 *
 * The field is required (Ira drafts it off the risk's own words) and is called
 * "Risk category" on every screen — it used to be "Class" on the matrix and
 * "Classification" in the working paper.
 */

const csv = (rows: string[][]) => Buffer.from(rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'));

const HEAD = ['Risk title', 'Risk description', 'Risk category', 'Control title', 'Control description', 'Control type', 'Control nature', 'Frequency', 'Control owner', 'Risk owner', 'Assertions', 'Attributes', 'TOD checks'];
/** One complete row — every other required column filled, so only the category
 *  under test decides whether the row is held back. */
const row = (category: string, risk = 'Payments are made to the wrong bank account') => [
  'Wrong payee', risk, category, 'Bank details are verified',
  'The finance manager verifies bank details against the signed mandate before release, monthly.',
  'Preventive', 'Manual', 'Monthly', 'R. Khanna', 'A. Mehta', 'Accuracy', 'Verification is evidenced', 'Mandate is on file',
];

async function openRacmPage(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'RACM Library', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'RACM Library', exact: true })).toBeVisible({ timeout: 8000 });
}

async function startUpload(page: Page, name: string, rows: string[][]) {
  await page.getByRole('button', { name: /Create RACM/ }).first().click();
  // The file comes first now (23 Sep) — entity and process are asked once it is
  // in, and Ira has had her read of it. Waiting for the trigger to stop saying
  // "Reading the file…" is what makes that read finished rather than racing the
  // picks below. Both are the product's own dropdown, not a native <select>.
  await page.locator('input[aria-label="Upload a RACM workbook"]').setInputFiles({ name, mimeType: 'text/csv', buffer: csv(rows) });
  const entity = page.getByRole('button', { name: 'Entity', exact: true });
  await expect(entity).toBeVisible({ timeout: 8000 });
  await expect(entity).toHaveText(/Choose the company/, { timeout: 8000 });
  // Any real company and process will do — these files name neither. The second
  // of each, which is the one these specs have always run on.
  await entity.click();
  await page.getByRole('listbox', { name: 'Entity' }).getByRole('option').nth(1).click();
  const proc = page.getByRole('button', { name: 'Business process', exact: true });
  await proc.click();
  await page.getByRole('listbox', { name: 'Business process' }).getByRole('option').nth(1).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
});

test('Risk category is on the locked required list', async ({ page }) => {
  await openRacmPage(page);
  await page.getByRole('tab', { name: /Config/ }).click();
  await expect(page.getByText('Always required', { exact: true })).toBeVisible();
  await expect(page.locator('div', { hasText: /^Risk category\s*Always$/ }).first()).toBeVisible();
  // Locked rows have no switch to turn them off.
  await expect(page.getByRole('switch', { name: /Risk category/ })).toHaveCount(0);
});

/* The matrix / control-page RENAME is deliberately not tested here.
 * Both surfaces are reached by routes that differ between the global RACM
 * library (whose rows open the spreadsheet editor in a new tab) and an
 * engagement, and a test that spends its time on navigation tests navigation
 * rather than the rename. What matters — that the field is called "Risk
 * category" and offers exactly the six — is covered below by the Config tab and
 * by the Review picker's option list, which is the same `CONTROL_CLASSES` the
 * matrix, the working paper and both control pages render. */

test("a client's own category wording is read, not rejected", async ({ page }) => {
  test.setTimeout(120_000);
  await openRacmPage(page);
  await startUpload(page, 'categories.csv', [
    HEAD,
    row('Financial Reporting'),
    row('Strategic'),
    row('IT General Control'),
    row('Fraud', 'Funds are diverted by a member of staff'),
  ]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // Every category was understood, so no row is held for one.
  await expect(page.locator('select[id$="-riskCategory"]')).toHaveCount(0);
  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeEnabled({ timeout: 8000 });
  await importBtn.click();
  await expect(page.getByText(/imported for/).first()).toBeVisible({ timeout: 6000 });
});

test("a category we don't recognise is asked for, not filed silently", async ({ page }) => {
  test.setTimeout(120_000);
  await openRacmPage(page);
  await startUpload(page, 'unknown-category.csv', [HEAD, row('Environmental')]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  const picker = page.locator('select[id$="-riskCategory"]').first();
  await expect(picker).toBeVisible({ timeout: 8000 });
  // Waited on rather than read once: Ira's fills land in an effect, so the row
  // rebuilds after it first renders and a single read can catch the box
  // half-built. toHaveCount retries; allTextContents does not.
  const options = picker.locator('option:not([disabled])');
  await expect(options).toHaveCount(6, { timeout: 8000 });
  expect(await options.allTextContents()).toEqual(['Financial', 'Operational', 'Compliance', 'Fraud', 'IT general control', 'Reputational']);

  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeDisabled();
  await picker.selectOption('Reputational');
  await expect(importBtn).toBeEnabled({ timeout: 8000 });
});

test('a file with no category column still imports — Ira reads one off the risk', async ({ page }) => {
  test.setTimeout(120_000);
  await openRacmPage(page);
  const drop = (r: string[]) => r.filter((_, i) => HEAD[i] !== 'Risk category');
  await startUpload(page, 'no-category.csv', [
    drop(HEAD),
    drop(row('', 'Funds are diverted to a fictitious vendor bank account')),
    drop(row('', 'The filing misses the statutory deadline and attracts a regulatory penalty')),
  ]);
  // She can read it, so the Columns step counts it rather than stopping.
  await expect(page.getByText(/Ira will fill — read on \d+ of 2 rows/).first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // No row is held for a category, and her reasons are on the record.
  await expect(page.locator('select[id$="-riskCategory"]')).toHaveCount(0);
  await page.getByRole('button', { name: /Ira filled \d+ blank/ }).click();
  await expect(page.getByText(/Risk mentions 'diverted'/).first()).toBeVisible();

  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeEnabled({ timeout: 8000 });
});

test('New control: the category is required, and Ira drafts it from the risk', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.getByRole('main').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.getByRole('button', { name: 'New control' }).first().click();
  await expect(page.getByRole('heading', { name: 'New control' })).toBeVisible();

  // Nothing picked for us.
  const picker = page.getByRole('button', { name: 'Risk category', exact: true });
  await expect(picker).toHaveText(/Pick a risk category/);

  // The control title first: the form names only its FIRST missing field, so
  // without it "Control title required" would mask everything below it.
  await page.keyboard.type('Bank details are verified against the signed mandate');
  await page.keyboard.press('Tab');

  // A new risk whose words name a fraud — Ira reads them and says which word.
  await page.getByRole('button', { name: 'Linked risk', exact: true }).click();
  await page.getByRole('option', { name: /New risk/ }).click();
  // The form labels its fields with a heading, not a <label for>, so the input
  // is reached the way the rest of this suite reaches it — by its placeholder.
  const riskTitle = page.getByPlaceholder('e.g. Unauthorised vendor payments');
  await riskTitle.fill('Funds diverted to a fraudulent bank account');
  await riskTitle.blur();
  await expect(page.getByText('Drafted by Ira from the risk').first()).toBeVisible({ timeout: 8000 });
  await expect(picker).toHaveText(/Fraud/);

  // Put back returns it to unpicked, and Create says what is missing.
  await page.getByRole('button', { name: "Put back — clear Ira's risk category" }).click();
  await expect(picker).toHaveText(/Pick a risk category/);
  await expect(page.getByText(/Risk category required/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create control' })).toBeDisabled();
});
