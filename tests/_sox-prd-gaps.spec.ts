import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * Two PRD edge cases built Aug 2026:
 *
 * 1. A control with more than one route through it warns when the draw never
 *    touched one — a sample drawn entirely from the manual lane has not tested
 *    the auto-release lane, however healthy its size. Seeded on Altura's
 *    payment-run control.
 *
 * 2. A recorded run goes STALE when the sample changes underneath it — results
 *    that predate the draw were not testing these items. The step is flagged,
 *    and the operating track refuses to conclude until the run is repeated.
 *    Driven live: pull a run on the payee control, then reject its sample.
 */
type Page = import('@playwright/test').Page;

async function openAlturaLibrary(page: Page) {
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(700);
  await page.getByRole('main').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);
}

test('a multi-path control names the route the draw never touched', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaLibrary(page);

  await page.getByText('Payment runs approved by two authorisers').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }

  // The coverage strip: one chip per route, and the untouched one named in a
  // sentence rather than implied by an empty chip.
  const strip = page.getByText(/One control, \d+ routes/).first();
  await strip.scrollIntoViewIfNeeded();
  await expect(strip).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('never touched').first()).toBeVisible();
  await expect(page.getByText(/The draw never touched/).first()).toBeVisible();
});

test('a run recorded before a redraw is stale, and blocks the conclusion', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaLibrary(page);

  // The payee control: in flight, sample drawn, workflow-mapped attributes.
  await page.getByText('New payee setup independently verified').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }

  // 1 · record a run against the current draw
  const pull = page.getByRole('button', { name: /Pull run|Re-pull/ }).first();
  await pull.scrollIntoViewIfNeeded();
  await pull.click();
  await page.waitForTimeout(800);

  // 2 · throw the sample back — the run now predates the draw
  const reject = page.getByRole('button', { name: 'Reject and retry' }).first();
  await reject.scrollIntoViewIfNeeded();
  await reject.click();
  await page.waitForTimeout(400);
  // the confirm modal's own Reject-and-retry button
  await page.locator('.modal').getByRole('button', { name: 'Reject and retry' }).click();
  await page.waitForTimeout(800);

  // 3 · the step says the run is stale, and the conclude footer says why the
  //     buttons are dead — the store refuses the conclusion either way.
  await expect(page.getByText(/predates the current draw/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/re-run before concluding/i).first()).toBeVisible();
});
