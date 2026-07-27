import { test, expect } from './_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/sox-config-shots';

/**
 * Configuration tab on the SOX workspace (scoping-backed engagements only):
 * testing period (FY/CY), entities + per-entity trial balances, materiality
 * rules incl. per-entity assignment, and the save-then-re-derive loop. The
 * re-derive updates the programme (scoping summary) and reconciles the live
 * workspace RACMs.
 */
test('SOX workspace Configuration tab edits scoping and re-derives', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(600);

  // The three sections land
  await expect(page.getByText('Testing period')).toBeVisible();
  await expect(page.getByText('Group & entities')).toBeVisible();
  await expect(page.getByText('Materiality rules')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/01-config.png`, fullPage: true });

  // Testing period: FY26 seed → calendar year and back (toasts confirm)
  await page.getByRole('button', { name: /Calendar year/ }).click();
  await expect(page.getByText(/Testing period set to CY 2025/)).toBeVisible();
  await page.getByRole('button', { name: /Financial year/ }).click();
  await expect(page.getByText(/Testing period set to FY 2025-26/)).toBeVisible();

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

  // The scoping summary carries the new configuration
  await page.getByRole('button', { name: 'Back to SOX Testing' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Scoping summary', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Nordwind Services Pvt Ltd')).toBeVisible();
  await expect(page.getByText('SkyCargo Logistics Pvt Ltd')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/04-summary.png`, fullPage: true });
});
