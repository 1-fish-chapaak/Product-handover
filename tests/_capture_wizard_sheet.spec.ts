import { test, expect } from './_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/b428675a-455c-4a0e-9017-16bd4ea1aa22/scratchpad/wizard-sheet-shots';

/** The creation flow now opens as a full-height right side sheet (not the
 *  centred modal) — capture step 1 and the dense Scoping step to check fit. */
test('creation wizard opens as a right side sheet', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'SOX Testing', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /New Engagement/ }).first().click();
  await page.waitForTimeout(700);

  const sheet = page.getByRole('dialog', { name: 'New engagement' });
  await expect(sheet).toBeVisible();
  // Anchored to the right edge, full height
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.x + box.width)).toBe(1600);
  expect(Math.round(box.height)).toBe(1000);
  await page.screenshot({ path: `${SHOT_DIR}/01-sheet-step1.png` });

  // Step 2 (Scoping) is the densest layout — make sure it still fits
  await sheet.getByPlaceholder(/e\.g\./).first().fill('FY28 ICFR — smoke');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/02-sheet-scoping.png` });
});
