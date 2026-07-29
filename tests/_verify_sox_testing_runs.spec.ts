import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/sox-journey-shots';

/**
 * The SOX testing journey, click by click — entered from Engagements (the
 * SOX Testing sidebar section is parked).
 * A: FY26 flagship — the bulk-test modal is honest about concluded controls.
 * B: fresh scoping-born engagement — empty run registry, first bulk test end
 *    to end, the run lands in the registry with per-control results.
 */

test('A — flagship: bulk test modal pre-excludes concluded controls', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await openFromLibrary(page, 'FY26 ICFR — Airline P2P & O2C');

  // Bulk testing lives on the drilled RACM matrix — open the P2P one
  await page.getByRole('main').getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Open Procure to Pay RACM' }).click();
  await page.waitForTimeout(900);

  // The flagship carries concluded controls — the bulk modal locks them out
  await page.getByRole('button', { name: /Bulk test all/ }).click();
  await page.waitForTimeout(400);
  expect(await page.getByText('Concluded — locked').count()).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOT_DIR}/a01-bulk-locked.png`, fullPage: true });
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('B — fresh programme: empty registry, first bulk test lands a run', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');

  // Fresh workspace: nothing tested, and the run registry says so
  await page.getByRole('main').getByRole('button', { name: 'Test runs', exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/No runs here yet/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/b01-runs-empty.png`, fullPage: true });

  // First bulk test — from the drilled P2P RACM matrix, every row is open
  await page.getByRole('main').getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Open Procure to Pay RACM' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /Bulk test all/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('Concluded — locked')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compile required files' }).click();
  await expect(page.getByText(/unique dataset/)).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: `${SHOT_DIR}/b02-bulk-datasets.png`, fullPage: true });
  await page.getByRole('button', { name: 'Pull all from source systems' }).click();
  await expect(page.getByRole('button', { name: 'Review & execute' })).toBeEnabled({ timeout: 8000 });
  await page.getByRole('button', { name: 'Review & execute' }).click();
  await page.getByRole('button', { name: /Test \d+ controls/ }).click();
  await expect(page.getByRole('button', { name: 'View run' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'View run' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Bulk test — \d+ controls/).first()).toBeVisible();
  await page.getByRole('button', { name: /Bulk test — \d+ controls/ }).first().click();
  await page.waitForTimeout(400);
  expect(await page.getByRole('button', { name: 'Open control' }).count()).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOT_DIR}/b03-first-run.png`, fullPage: true });
});
