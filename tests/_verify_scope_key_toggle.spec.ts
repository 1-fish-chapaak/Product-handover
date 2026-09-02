import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * Marking a control key from the new-audit Scope step.
 *
 * The judgement lands on the engagement's control, not on the draft audit, so
 * closing the wizard and opening the register has to show the same answer.
 */
test('a non-key control can be marked key while scoping, and it sticks', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  const main = page.getByRole('main');

  await main.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Audit period', { exact: true }).first()).toBeVisible();

  // Step 1 under the rounds model: the year is prefilled, dates render only
  // once a round is chosen, and interim's From arrives prefilled — so the step
  // is pick Interim, then take Today as the cut-off.
  await page.getByRole('button', { name: 'Interim', exact: true }).click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'dd/mm/yyyy' }).first().click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForTimeout(450);

  for (let i = 0; i < 2; i++) {
    const next = page.getByRole('button', { name: /^(Continue|Next)/ }).last();
    await expect(next).toBeEnabled({ timeout: 10_000 });
    await next.click();
    await page.waitForTimeout(700);
  }
  // Scope opens on "By entity"; the control list is the other lens.
  await page.getByRole('button', { name: 'By RACM' }).first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Key controls only')).toBeVisible({ timeout: 10_000 });

  // Open the Fixed Assets RACM. FIX-04 is seeded non-key.
  await page.getByText('Fixed Assets', { exact: true }).first().click();
  await page.waitForTimeout(600);
  const star = page.getByRole('button', { name: /^FIX-04 is non-key/ }).first();
  await expect(star).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'tests/__screenshots__/scope-key-before.png' });

  await star.click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: /^FIX-04 is a key control/ }).first()).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/scope-key-after.png' });

  // Leave the wizard — the audit register now stars FIX-04.
  // Cancel only exists on step 1; the Scope step's footer is Back / Continue,
  // so the sheet is dismissed from its header instead.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  await main.getByRole('button').filter({ hasText: /^CY ?2026/ }).first().click();
  await page.waitForTimeout(900);
  await main.getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(900);
  const row = page.locator('tr.reg-row').filter({ hasText: 'FIX-04' }).first();
  await expect(row.locator('svg.lucide-star')).not.toHaveCount(0);
});
