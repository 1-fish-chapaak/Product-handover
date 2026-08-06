import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The material-weakness panel on the engagement Overview now collapses.
 *
 * The whole header line is the control (heading > button, the APG disclosure
 * pattern), it opens expanded — an entity-level finding does not get to hide on
 * first read — and collapsed it keeps the headline while a count stands in for
 * the rows it folded away.
 */

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/e4611527-b2d2-4848-8aa2-dda858a9a11e/scratchpad/org-chart-shots';

test('the needs-attention panel collapses and restores', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');

  const toggle = page.getByRole('button', { name: /Material weakness open/ });
  await expect(toggle).toBeVisible();

  // Whether it OPENS expanded is a product decision that has moved (a parallel
  // session set it to start collapsed); what this pins is the mechanism, which
  // has to hold either way. Read the starting state, then prove both directions.
  const startedOpen = (await toggle.getAttribute('aria-expanded')) === 'true';
  if (!startedOpen) {
    await toggle.click();
    await page.waitForTimeout(500);
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const rows = page.locator('#mw-watchlist-rows button');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOT_DIR}/06-mw-expanded.png` });

  // Collapse: rows go, headline stays, the count takes their place.
  await toggle.click();
  await page.waitForTimeout(500);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#mw-watchlist-rows')).toHaveCount(0);
  await expect(toggle).toContainText(/Material weakness open/);
  await expect(toggle).toContainText(new RegExp(`${rowCount} weakness`));
  await page.screenshot({ path: `${SHOT_DIR}/07-mw-collapsed.png` });

  // And back, with every row returned.
  await toggle.click();
  await page.waitForTimeout(500);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mw-watchlist-rows button')).toHaveCount(rowCount);
});
