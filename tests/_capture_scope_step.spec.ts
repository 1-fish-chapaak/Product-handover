import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/** The new-audit Scope step, for review. */
const DIR = 'tests/__screenshots__/scopestep';

test('scope step — both lenses', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  const main = page.getByRole('main');

  await main.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'dd/mm/yyyy' }).first().click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'Today', exact: true }).last().click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: 'dd/mm/yyyy' }).first().click();
  await page.waitForTimeout(450);
  await page.getByRole('button', { name: '28', exact: true }).last().click();
  await page.waitForTimeout(450);
  for (let i = 0; i < 2; i++) {
    const next = page.getByRole('button', { name: /^(Continue|Next)/ }).last();
    await expect(next).toBeEnabled({ timeout: 10_000 });
    await next.click();
    await page.waitForTimeout(700);
  }

  await page.screenshot({ path: `${DIR}/01-by-entity.png` });

  await page.getByRole('button', { name: 'By RACM' }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/02-by-racm-collapsed.png` });

  await page.getByText('Fixed Assets', { exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/03-racm-expanded.png` });

  // hover the star, so the affordance is visible in the shot
  await page.getByRole('button', { name: /^FIX-04 is non-key/ }).first().hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/04-star-hover.png` });

  // and with the key-only switch on
  await page.getByText('Key controls only').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/05-key-only-on.png` });
});
