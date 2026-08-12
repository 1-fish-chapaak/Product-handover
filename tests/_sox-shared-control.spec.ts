import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * One control, several companies — the OTHER multi-entity arrangement.
 *
 * Most of Altura's controls are the ordinary kind: the same control number
 * tested separately at each company, one row per copy. The payee-verification
 * control is the opposite — run once, centrally, on everyone's behalf — so it is
 * ONE row that names the companies it answers for, and its single conclusion
 * carries to all of them.
 *
 * Which is exactly why the sample must reach each company: one with nothing
 * drawn has had nothing tested, however healthy the overall size looks. The
 * seed leaves it mid-flight with companies short, so the demo shows the
 * warning rather than describing it.
 */
type Page = import('@playwright/test').Page;

async function openAlturaLibrary(page: Page) {
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(700);
  await page.getByRole('main').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);
}

test('a shared control says who it covers, and the register marks it', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaLibrary(page);

  // The register cell carries the one fact that makes this row different —
  // several companies behind one line — not just where the desk sits.
  await expect(page.getByText(/Shared — covers \d+ companies/).first()).toBeVisible({ timeout: 15_000 });

  await page.getByText('New payee setup independently verified').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }

  // The header answers both questions separately: performed where, covering whom.
  await expect(page.getByText('Performed at').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Covers').first()).toBeVisible();
});

test('the sample step names the companies the draw has not reached', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaLibrary(page);
  await page.getByText('New payee setup independently verified').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }

  // The coverage strip: one line per company, each carrying its own count —
  // and the shortfall stated as a sentence, not implied by an empty chip.
  const strip = page.getByText(/One conclusion, \d+ companies/).first();
  await strip.scrollIntoViewIfNeeded();
  await expect(strip).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\d+ items?$/).first()).toBeVisible();
  await expect(page.getByText('nothing drawn').first()).toBeVisible();
  await expect(page.getByText(/no item in the draw — a conclusion recorded now would cover/).first()).toBeVisible();
});
