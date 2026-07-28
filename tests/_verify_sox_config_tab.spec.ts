import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/sox-config-shots';

/**
 * Configuration tab on the SOX workspace: testing period (FY/CY), entities +
 * per-entity trial balances, materiality rules incl. per-entity assignment,
 * and the save-then-re-derive loop. Roll forward is parked. Entered through a
 * scoping-born engagement created from Engagements (the SOX Testing sidebar
 * entry is parked).
 */
test('SOX workspace Configuration tab edits scoping and re-derives', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await createSoxEngagement(page, 'FY27 ICFR — Airline Group');
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(600);

  // The three sections land; Roll forward is parked
  await expect(page.getByText('Testing period')).toBeVisible();
  await expect(page.getByText('Group & entities')).toBeVisible();
  await expect(page.getByText('Materiality rules')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roll forward' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/01-config.png`, fullPage: true });

  // Testing period: FY → calendar year and back (toasts confirm)
  await page.getByRole('button', { name: /Calendar year/ }).click();
  await expect(page.getByText(/Testing period set to CY \d{4}/)).toBeVisible();
  await page.getByRole('button', { name: /Financial year/ }).click();
  await expect(page.getByText(/Testing period set to FY \d{4}-\d{2}/)).toBeVisible();

  // Delete an entity — two-step confirm — then the stale banner appears
  await page.getByRole('button', { name: 'Remove SkyCargo Logistics Pvt Ltd' }).click();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText(/derived scope may be stale/)).toBeVisible();

  // Add an entity with its own trial balance
  await page.getByRole('button', { name: 'Add entity' }).click();
  await page.getByPlaceholder('Entity name').last().fill('Nordwind Services Pvt Ltd');
  await page.getByRole('button', { name: 'Upload TB' }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByText(/nordwind-services-pvt-ltd-tb/)).toBeVisible();

  // A second materiality rule, assigned to the new entity
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByLabel('Benchmark for Rule 2').fill('5');
  await page.getByLabel('Materiality rule for Nordwind Services Pvt Ltd').selectOption({ label: 'Rule 2' });
  await page.screenshot({ path: `${SHOT_DIR}/02-config-edited.png`, fullPage: true });

  // Re-derive: banner clears, summary line lands
  await page.getByRole('button', { name: 'Re-derive scope' }).click();
  await expect(page.getByText(/Scope re-derived — \d+ processes in scope/)).toBeVisible();
  await expect(page.getByText(/derived scope may be stale/)).toHaveCount(0);
  await expect(page.getByText(/processes in scope — \d+ quantitative/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/03-rederived.png`, fullPage: true });

  // Leave and re-enter — the changes persisted onto the programme
  await page.getByRole('button', { name: 'Back to Engagements' }).click();
  await page.waitForTimeout(800);
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: 'Remove Nordwind Services Pvt Ltd' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove SkyCargo Logistics Pvt Ltd' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/04-persisted.png`, fullPage: true });
});
