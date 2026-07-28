import { test, expect } from './_helpers';
import { createSoxEngagement, openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/sox-testing-shots';

/**
 * The SOX creation journey since the SOX Testing sidebar entry was parked:
 * Engagements is the one door. Create Engagement → picking SOX / ICFR hands
 * off to the scoping side sheet (Type dropped, Back returns to the type
 * picker). Basics is identity only; Scoping = the Recommended-files card fed
 * by ONE bulk upload (files auto-classify to RACM / TB / GL), with a
 * Skip-for-now escape hatch; Review creates the programme and the engagement
 * lands in the library.
 */
test('SOX creation walks Engagements → handoff → scoping → workspace', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');

  // The sidebar has no SOX Testing entry any more — Engagements is the door
  await expect(page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);

  // Create Engagement opens on the Type-only step (5-step classic wizard)
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);
  const typeSheet = page.getByRole('dialog', { name: 'Create Engagement' });
  await expect(typeSheet.getByText('Step 1 of 5 — Type')).toBeVisible();
  await expect(typeSheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing')).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/01-type-step.png` });

  // Picking SOX + Next hands off to the scoping sheet at Basics
  await typeSheet.getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);
  const sheet = page.getByRole('dialog', { name: 'New engagement' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Basics', { exact: true })).toBeVisible();
  // identity only — the audit period is parked, no helper sentences
  await expect(sheet.getByText('Audit period')).toHaveCount(0);
  await expect(sheet.getByText(/annual cycle/)).toHaveCount(0);
  await expect(sheet.getByPlaceholder('e.g. P2P — SOX Q3 Testing')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/02-basics.png` });

  // Back goes one step back — the classic type picker, SOX still selected
  await page.getByRole('button', { name: 'Back' }).click();
  await page.waitForTimeout(500);
  await expect(typeSheet.getByText('Step 1 of 5 — Type')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  // Basics gates on name + code
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 ICFR — Airline Group');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);

  // Scoping — the Recommended-files card with ONE bulk upload button
  await expect(sheet.getByText('Recommended files', { exact: true })).toBeVisible();
  await expect(sheet.getByText('3 recommended · 3 total')).toBeVisible();
  await expect(sheet.getByText('RACM / SOP', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByText('Trial balance (TB)')).toBeVisible();
  await expect(sheet.getByText('General ledger (GL)')).toBeVisible();
  await expect(sheet.getByText(/No entities yet/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.screenshot({ path: `${SHOT_DIR}/03-scoping-empty.png` });

  // Bulk-select three files — each classifies to its requirement by name
  await page.locator('input[aria-label="Upload recommended files"]').setInputFiles([
    { name: 'airline-group-racm.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('racm') },
    { name: 'airline-group-tb-fy27.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('tb') },
    { name: 'airline-group-gl.csv', mimeType: 'text/csv', buffer: Buffer.from('gl') },
  ]);
  await page.waitForTimeout(1500);
  await expect(sheet.getByText('Attached').first()).toBeVisible();
  await expect(sheet.getByText('3/3 recommended inputs satisfied')).toBeVisible();
  // the button flips to Add more once something is attached
  await expect(sheet.getByText('Add more')).toBeVisible();
  // entities mapped from the parsed uploads
  await expect(page.getByRole('button', { name: 'Remove SkyCargo Logistics Pvt Ltd' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.screenshot({ path: `${SHOT_DIR}/04-scoping-filled.png`, fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);

  // Review & create — no Materiality step in between (parked)
  await expect(sheet.getByText(/Confirm the derivation/)).toBeVisible();
  await expect(sheet.getByText('RACMs to be generated — one per in-scope process')).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/05-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(900);

  // Creation closes the sheet; the engagement lands in the library
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/FY27 programme created — 7 RACMs derived/)).toBeVisible();
  await openFromLibrary(page, 'FY27 ICFR — Airline Group');
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();

  // Workspace: one RACM per derived process, and the Configuration tab exists
  await page.getByRole('main').getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Fixed Assets').first()).toBeVisible();
  await expect(page.getByText('Payroll (Hire to Retire)').first()).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/06-workspace-racm.png`, fullPage: true });
  await page.getByText('Configuration', { exact: true }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Testing period')).toBeVisible();
  // Roll forward is parked from the Configuration tab
  await expect(page.getByRole('button', { name: 'Roll forward' })).toHaveCount(0);
});

test('Skip for now creates an empty workspace that flags what is missing', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog', { name: 'Create Engagement' }).getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill('FY27 skip check');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(400);

  // Skip jumps to Review with an honest warning; Create still works
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText(/Scoping skipped — the engagement is created without a RACM/)).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/07-skip-review.png` });
  await page.getByRole('button', { name: 'Create FY27 programme' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/scoping skipped; add the RACM and GL \/ trial balances/)).toBeVisible();

  // The workspace opens EMPTY and the Overview flags both gaps with links
  await openFromLibrary(page, 'FY27 skip check');
  await expect(page.getByText(/Scoping was skipped/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'RACM tab' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configuration tab' })).toBeVisible();
  await page.screenshot({ path: `${SHOT_DIR}/08-skip-banner.png`, fullPage: true });
  // no seeded template controls — the RACM tab starts empty
  await page.getByRole('button', { name: 'RACM tab' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Payroll (Hire to Retire)')).toHaveCount(0);
});
