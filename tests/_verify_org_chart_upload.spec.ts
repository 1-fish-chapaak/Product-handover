import { test, expect } from './_helpers';

/**
 * Engagement creation — the org-chart upload and the pre-filled name.
 *
 * Basics used to open on an empty name field showing "Name is required", and an
 * empty entity table whose only way forward was typing every company by hand.
 * Both are now answered before the user does anything: the name is suggested
 * from the group and the year, and the org chart fills the table.
 *
 * The sample chart is the real artefact in docs/samples — twelve companies over
 * three levels, one NYSE-listed parent. The extraction is simulated (no bytes
 * are read in the prototype), so what this spec proves is the JOURNEY: the file
 * lands, the rows arrive with their chain intact, and the effective ownership
 * is arithmetic on the chain rather than the number printed on the chart.
 */

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/e4611527-b2d2-4848-8aa2-dda858a9a11e/scratchpad/org-chart-shots';
const CHART_PDF = '/Users/aasthajain/Desktop/Product-Irame/Product-handover/docs/samples/meridian-global-holdings-org-chart.pdf';

/** Engagements → New Engagement → SOX / ICFR → Next → the scoping sheet on Basics. */
async function openBasics(page: import('@playwright/test').Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);
  const typeSheet = page.getByRole('dialog', { name: 'Create Engagement' });
  await typeSheet.getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);
  const sheet = page.getByRole('dialog', { name: 'New engagement' });
  await expect(sheet).toBeVisible();
  return sheet;
}

test('the engagement name arrives pre-filled and follows the group until the user types', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  const sheet = await openBasics(page);

  // Pre-filled, not empty — and therefore not sitting on a required error.
  const nameInput = sheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing');
  await expect(nameInput).toHaveValue(/ICFR — Airline Group Ltd$/);
  await expect(nameInput).toHaveValue(/^(FY|CY) /);
  await expect(sheet.getByText('Name is required')).toHaveCount(0);
  await expect(sheet.getByText(/Suggested from the group/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-name-prefilled.png` });

  // Still ours: retype the group and the suggestion follows it.
  const groupInput = sheet.locator('label:has-text("Group (listed / holding)") + input');
  await groupInput.fill('Northwind Industries Ltd (Listed)');
  await page.waitForTimeout(250);
  await expect(nameInput).toHaveValue(/ICFR — Northwind Industries Ltd$/);

  // The user types — from here the name is an answer and nothing overwrites it.
  await nameInput.fill('Q3 controls testing — my own name');
  await page.waitForTimeout(150);
  await expect(sheet.getByText(/Suggested from the group/)).toHaveCount(0);
  await groupInput.fill('Someone Else Plc (Listed)');
  await page.waitForTimeout(250);
  await expect(nameInput).toHaveValue('Q3 controls testing — my own name');
});

test('the org chart fills the entity table with the group structure intact', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  const sheet = await openBasics(page);

  // Empty table, and the empty state offers the chart as the way out.
  await expect(sheet.getByText(/No entities yet — upload the org chart/)).toBeVisible();
  await expect(sheet.locator('input[aria-label^="Entity"]')).toHaveCount(0);
  const continueBtn = page.getByRole('button', { name: 'Continue' });
  await expect(continueBtn).toBeDisabled();
  await page.screenshot({ path: `${SHOT_DIR}/02-empty-table.png` });

  // Upload the real sample PDF through the hidden input behind the button.
  await expect(sheet.getByText('Upload org chart')).toBeVisible();
  await sheet.locator('input[aria-label="Upload org chart"]').setInputFiles(CHART_PDF);
  await expect(sheet.getByText('Reading the chart…')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-parsing.png` });

  // Twelve companies, the file named on screen, and the review nudge.
  await expect(sheet.getByText(/Read 12 companies off the chart/)).toBeVisible({ timeout: 5000 });
  await expect(sheet.getByText('meridian-global-holdings-org-chart.pdf')).toBeVisible();
  await expect(sheet.locator('input[aria-label^="Entity"]')).toHaveCount(12);

  // The chart's root became the group, and the name followed it.
  await expect(sheet.locator('label:has-text("Group (listed / holding)") + input'))
    .toHaveValue('Meridian Global Holdings, Inc. (NYSE: MGH)');
  await expect(sheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing'))
    .toHaveValue(/ICFR — Meridian Global Holdings, Inc\.$/);

  // The chain survived the upload: effective ownership is the product down the
  // chain, not the 100% printed against Gulf Terminal on the chart.
  await expect(sheet.getByText('74% · held through Meridian Port Services LLC')).toBeVisible();
  await expect(sheet.getByText('100% · held through Meridian Freight Systems LLC')).toBeVisible();
  await expect(sheet.getByText('80% · held through Meridian Freight Systems LLC')).toBeVisible();
  // Held straight off the listed parent, so there is no chain to explain — just
  // the share that is not the group's.
  await expect(sheet.getByText('74% owned')).toBeVisible();
  // A wholly-owned company held straight off the parent says nothing at all.
  await expect(sheet.getByText('100% owned')).toHaveCount(0);

  // Depth reads as indentation — a third-level row starts further in than the
  // second-level row above it.
  const indents = await page.evaluate(() => {
    const byName = (n: string) => Array.from(document.querySelectorAll('input'))
      .find(i => (i as HTMLInputElement).value === n) as HTMLInputElement | undefined;
    const box = (n: string) => byName(n)?.getBoundingClientRect().left ?? -1;
    return {
      holding: box('Meridian Global Holdings, Inc.'),
      level2: box('Meridian Freight Systems LLC'),
      level3: box('Meridian Trucking Midwest LLC'),
    };
  });
  expect(indents.holding).toBeGreaterThan(0);
  expect(indents.level2).toBeGreaterThan(indents.holding);
  expect(indents.level3).toBeGreaterThan(indents.level2);

  await expect(continueBtn).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/04-entities-nested.png` });

  // The deepest rows, where the arithmetic actually bites.
  await sheet.getByRole('button', { name: 'Remove Gulf Terminal Operations LLC' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOT_DIR}/04b-lower-rows.png` });

  // The holding's own row can add a company beneath it, and the new row lands
  // at the end of the family rather than at the end of the table.
  await sheet.getByRole('button', { name: /Add entity under Meridian Global Holdings/ }).click();
  await page.waitForTimeout(300);
  await expect(sheet.locator('input[aria-label^="Entity"]')).toHaveCount(13);
  const order = await page.evaluate(() => Array.from(document.querySelectorAll('input[aria-label^="Entity"]'))
    .map(i => (i as HTMLInputElement).value));
  expect(order[order.length - 1]).toBe('');            // last row, after the whole family
  expect(order[0]).toBe('Meridian Global Holdings, Inc.');
  // The cursor is already in it — below the fold, the click would otherwise
  // look like it did nothing.
  await expect(sheet.locator('input[aria-label^="Entity"]').last()).toBeFocused();
  await page.keyboard.type('Meridian Rail Services LLC');
  await page.waitForTimeout(200);
  await expect(continueBtn).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/08-add-under-holding.png` });

  // Dropping a parent takes what it held with it, so it asks first and says how
  // many go. Cancel leaves the table exactly as it was.
  await sheet.getByRole('button', { name: 'Remove Meridian Air Cargo, Inc.' }).click();
  await page.waitForTimeout(200);
  await expect(sheet.getByText('Remove this and the 2 companies held beneath it?')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/09-delete-confirm.png` });
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(200);
  await expect(sheet.locator('input[aria-label^="Entity"]')).toHaveCount(13);

  // Confirmed, the whole family goes — 13 → 10, not 13 → 12.
  await sheet.getByRole('button', { name: 'Remove Meridian Air Cargo, Inc.' }).click();
  await page.waitForTimeout(200);
  await sheet.getByRole('button', { name: /^Confirm remove Meridian Air Cargo/ }).click();
  await page.waitForTimeout(300);
  await expect(sheet.locator('input[aria-label^="Entity"]')).toHaveCount(10);
  await expect(sheet.getByText('Meridian Air Cargo Canada ULC')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/05-cascade-delete.png` });

  // A leaf holds nothing, so it goes on one click with nothing to confirm.
  await sheet.getByRole('button', { name: 'Remove Meridian Last Mile LLC' }).click();
  await page.waitForTimeout(250);
  await expect(sheet.getByText(/held beneath it\?/)).toHaveCount(0);
  await expect(sheet.locator('input[aria-label^="Entity"]')).toHaveCount(9);
});
