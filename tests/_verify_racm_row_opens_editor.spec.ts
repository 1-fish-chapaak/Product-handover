import { test, expect } from './_helpers';

const SHOTS = 'test-results/racm-row';

/**
 * ENGAGEMENT-LEVEL RACM — a row opens the spreadsheet editor, and nothing else.
 *
 * It used to drill into a read-only matrix table showing the same rows the
 * editor shows: two surfaces for one matrix, and the table was the one you
 * could not edit in. Now there is one destination.
 *
 * Scope is the engagement-level RACM tab only — the Process Hub and Concierge
 * matrices keep their own journeys, and this spec deliberately says nothing
 * about them.
 */
test('a RACM row opens the spreadsheet editor in a new tab — no matrix table', async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');

  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/01-landing.png`, fullPage: true });

  const row = page.getByRole('button', { name: /Open the .* RACM in the spreadsheet editor/ }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  // the row says where it goes
  await expect(page.getByText('Spreadsheet editor').first()).toBeVisible();

  // clicking it opens ONE new tab, at the editor
  const [editor] = await Promise.all([
    context.waitForEvent('page'),
    row.click(),
  ]);
  await editor.waitForLoadState('domcontentloaded');
  expect(editor.url()).toContain('view=racm-full-editor');
  expect(editor.url()).toContain('racmId=sox-racm-');
  await editor.waitForTimeout(2500);
  await editor.screenshot({ path: `${SHOTS}/02-editor.png`, fullPage: true });

  // and the tab it was clicked from is still the landing — no drill-in happened
  await expect(page.getByRole('button', { name: /Open the .* RACM in the spreadsheet editor/ }).first()).toBeVisible();
  await expect(page.getByText(/Risk & Control Matrix/)).toHaveCount(0);
  await expect(page.getByText('Pre-testing review').first()).toBeVisible();  // the landing's own column survives
  await page.screenshot({ path: `${SHOTS}/03-still-landing.png`, fullPage: true });
});
