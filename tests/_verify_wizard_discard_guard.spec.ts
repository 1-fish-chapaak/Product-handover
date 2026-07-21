import { test, expect } from './_helpers';

/**
 * E4 — the creation wizard never loses typed input on one click: while dirty
 * the backdrop is inert and Cancel/X ask before discarding; a clean wizard
 * still closes freely.
 */
test('wizard guards typed input against one-click discard', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /New Engagement/i }).first().click();
  await page.waitForTimeout(600);
  const drawer = page.getByRole('dialog', { name: 'Create Engagement' });
  await expect(drawer).toBeVisible();

  // clean wizard: backdrop click closes freely
  await page.mouse.click(200, 400);
  await page.waitForTimeout(500);
  await expect(drawer).toHaveCount(0);

  // reopen and type something
  await page.getByRole('button', { name: /New Engagement/i }).first().click();
  await page.waitForTimeout(600);
  await drawer.getByPlaceholder(/e\.g\./i).first().fill('FY27 ICFR draft');
  await page.waitForTimeout(300);

  // dirty: backdrop is inert
  await page.mouse.click(200, 400);
  await page.waitForTimeout(500);
  await expect(drawer).toBeVisible();

  // dirty: Cancel asks; Keep editing preserves the input
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Discard this engagement?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.waitForTimeout(300);
  await expect(drawer).toBeVisible();
  await expect(drawer.getByPlaceholder(/e\.g\./i).first()).toHaveValue('FY27 ICFR draft');

  // Discard really closes
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(drawer).toHaveCount(0);
});
