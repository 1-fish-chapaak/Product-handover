import { test, expect } from './_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/f35a67c3-b996-41ba-98cf-ba36cd071334/scratchpad/sox-journey-shots';

/**
 * SOX Testing — the full testing journey, click by click.
 * A: FY26 (live) — summary is clickable through to the workspace, the seeded
 *    bulk run opens with its results, a new bulk test skips concluded controls
 *    honestly, and a fully-concluded selection explains itself.
 * B: fresh programme — wizard validation, empty run registry, first bulk test
 *    end to end with its run record.
 * C: rolled cycle — design carried, operating retest pending, no runs yet.
 */

async function gotoSoxTesting(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  // SOX Testing is its own sidebar section now, right below Engagements
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(800);
}

test('A — FY26: summary → workspace → seeded run → honest bulk test', async ({ page }) => {
  test.setTimeout(180_000);
  await gotoSoxTesting(page);

  // Card actions are parked (Roll forward lives on the workspace Configuration
  // tab) — the card itself opens the workspace
  await expect(page.getByRole('button', { name: 'Scoping summary', exact: true })).toHaveCount(0);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();

  // Test runs — the live cycle arrives with the bulk run that tested its 25 controls
  await page.getByText('Test runs', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Bulk test — 25 controls')).toBeVisible();
  await expect(page.getByText('25 effective')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/a02-runs-seeded.png`, fullPage: true });

  // Click the run card → its per-control results
  await page.getByRole('button', { name: /Bulk test — 25 controls/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('Datasets', { exact: true })).toBeVisible();
  const openControls = page.getByRole('button', { name: 'Open control' });
  expect(await openControls.count()).toBe(25);
  await page.screenshot({ path: `${SHOT_DIR}/a03-run-expanded.png`, fullPage: true });

  // Drill from a result row into the control itself
  await openControls.first().click();
  await page.waitForTimeout(800);
  await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/a04-run-to-dossier.png`, fullPage: true });
  await page.locator('nav[aria-label="Breadcrumb"] button').first().click();
  await page.waitForTimeout(600);

  // Bulk test from the Control Library — concluded controls sit out, labelled
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Bulk test all/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('Concluded — locked')).toHaveCount(25);
  await page.screenshot({ path: `${SHOT_DIR}/a05-bulk-scope-locked.png`, fullPage: true });
  await page.getByRole('button', { name: 'Compile required files' }).click();
  await expect(page.getByText(/unique dataset/)).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Pull all from source systems' }).click();
  await expect(page.getByRole('button', { name: 'Review & execute' })).toBeEnabled({ timeout: 8000 });
  await page.screenshot({ path: `${SHOT_DIR}/a06-bulk-datasets.png`, fullPage: true });
  await page.getByRole('button', { name: 'Review & execute' }).click();
  await page.getByRole('button', { name: 'Test 7 controls' }).click();
  await expect(page.getByRole('button', { name: 'View run' })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText(/Bulk test complete — 7 effective/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/a07-bulk-finished.png`, fullPage: true });
  await page.getByRole('button', { name: 'View run' }).click();
  await page.waitForTimeout(600);

  // The new run lands at the top of the registry, results one click away
  await expect(page.getByText('Bulk test — 7 controls')).toBeVisible();
  await page.getByRole('button', { name: /Bulk test — 7 controls/ }).click();
  await page.waitForTimeout(400);
  expect(await page.getByRole('button', { name: 'Open control' }).count()).toBe(7);
  await page.screenshot({ path: `${SHOT_DIR}/a08-new-run.png`, fullPage: true });

  // Everything is concluded now — a repeat bulk test says so instead of lying
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Bulk test all/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/Every control in this selection is already concluded/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compile required files' })).toBeDisabled();
  await page.screenshot({ path: `${SHOT_DIR}/a09-all-locked.png`, fullPage: true });
  await page.getByRole('button', { name: 'Cancel' }).click();
});

test('B — fresh programme: validation, empty registry, first bulk test', async ({ page }) => {
  test.setTimeout(180_000);
  await gotoSoxTesting(page);

  // Wizard step 1 — Continue is gated until the identity is complete
  await page.getByRole('button', { name: 'New Engagement' }).last().click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByText('Name is required')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/b01-wizard-validation.png`, fullPage: true });
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 ICFR — Airline Group');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Scoping gates on the bulk trial-balance upload — entities map from it
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('button', { name: 'Upload trial balances' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(700);
  // Creation closes the modal — the card is on the listing
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Fresh workspace: nothing tested, and the run registry says so
  await page.getByText('FY27 ICFR — Airline Group').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'FY27 ICFR — Airline Group' })).toBeVisible();
  await page.getByText('Test runs', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/No runs here yet/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/b02-runs-empty.png`, fullPage: true });

  // First bulk test — every control is open, none pre-excluded
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Bulk test all/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('Concluded — locked')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compile required files' }).click();
  await expect(page.getByText(/unique dataset/)).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: `${SHOT_DIR}/b03-bulk-datasets.png`, fullPage: true });
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
  await page.screenshot({ path: `${SHOT_DIR}/b04-first-run.png`, fullPage: true });
});

test('D — qualitative parked: materiality flows straight to review', async ({ page }) => {
  test.setTimeout(180_000);
  await gotoSoxTesting(page);
  await page.getByRole('button', { name: 'New Engagement' }).last().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 guardrail check');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Upload trial balances' }).click();
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Qualitative is parked — no rail label; a LOW custom materiality flows
  // from Materiality straight into Review
  await expect(page.getByText('Qualitative')).toHaveCount(0);
  await page.getByRole('button', { name: /Custom amount/ }).click();
  await page.getByRole('spinbutton').first().fill('0.5');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Confirm the derivation/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/d01-straight-to-review.png`, fullPage: true });

  // Absurdly HIGH custom materiality: only the seeded qualitative picks carry
  // — the wizard still derives their processes rather than blocking
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('spinbutton').first().fill('10000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/Confirm the derivation/)).toBeVisible();
  await expect(page.getByText('Scoped in qualitatively')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/d02-qual-picks-carry.png`, fullPage: true });
});

test('C — rolled cycle: design carried, operating retest pending, no runs yet', async ({ page }) => {
  test.setTimeout(180_000);
  await gotoSoxTesting(page);

  // Roll the live FY26 into FY27 — from the workspace Configuration tab now
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Roll forward' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Roll forward from FY26')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  const rollUploads = page.getByRole('button', { name: /Upload FY27 trial balance/ });
  while (await rollUploads.count() > 0) {
    await rollUploads.first().click();
    await page.waitForTimeout(950);
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(700);
  // Creation closes the modal — back on Configuration; the card is on the listing
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to SOX Testing' }).click();
  await page.waitForTimeout(800);

  // The card says what carried; the workspace agrees
  await expect(page.getByText(/controls carried · TOE retest/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/c01-rolled-card.png`, fullPage: true });
  await page.getByText('FY27 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'FY27 ICFR — Airline P2P & O2C' })).toBeVisible();

  // No runs this cycle yet — last year's runs live in last year's engagement
  await page.getByText('Test runs', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/No runs here yet/)).toBeVisible();

  // Register: design conclusions carried (Effective), operating waits (Not tested)
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Effective').first()).toBeVisible();
  await expect(page.getByText('Not tested').first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/c02-carried-register.png`, fullPage: true });
});
