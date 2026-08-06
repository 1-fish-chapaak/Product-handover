import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/** A full visual tour of the SOX module on FY26 ICFR — Altura Infra Group,
 *  one shot per screen, for review outside the app. */
const DIR = 'tests/__screenshots__/soxtour';
const ENG = 'FY26 ICFR — Altura Infra Group';
type P = import('@playwright/test').Page;

async function land(page: P) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, ENG);
  return page.getByRole('main');
}
const tab = async (page: P, main: ReturnType<P['getByRole']>, name: string) => {
  await main.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(1000);
};
const openAudit = async (page: P, main: ReturnType<P['getByRole']>, re: RegExp) => {
  const a = main.getByRole('button').filter({ hasText: re }).first();
  await expect(a).toBeVisible({ timeout: 15_000 });
  await a.click();
  await page.waitForTimeout(1000);
};
const shot = (page: P, name: string, full = true) =>
  page.screenshot({ path: `${DIR}/${name}.png`, fullPage: full });

test('engagement level — four tabs', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await page.waitForTimeout(600);
  await shot(page, '01-engagement-overview');
  await tab(page, main, 'RACM');           await shot(page, '02-racm-list');
  await tab(page, main, 'Control Library'); await shot(page, '03-engagement-control-library');
  await tab(page, main, 'SOX testing');     await shot(page, '04-sox-testing-audits');
});

test('audit level — four tabs', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await openAudit(page, main, /^CY ?2026/);
  await shot(page, '05-audit-dashboard');
  await tab(page, main, 'Control Library');
  await shot(page, '06-audit-control-register');
  await page.locator('.reg-wrap').first().evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await page.waitForTimeout(400);
  await shot(page, '07-audit-register-track-columns', false);
  await tab(page, main, 'Deficiency management'); await shot(page, '08-deficiency-register');
  await tab(page, main, 'Configuration');         await shot(page, '11-audit-configuration');
});

test('a deficiency opened, and the control working paper', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await openAudit(page, main, /^CY ?2026/);
  await tab(page, main, 'Deficiency management');
  await page.locator('tr.reg-row:not(.reg-static)').first().click();
  await page.waitForTimeout(800);
  await shot(page, '09-deficiency-opened');

  await tab(page, main, 'Control Library');
  await page.locator('tr.reg-row').first().click();
  await page.waitForTimeout(1400);
  await shot(page, '10-control-working-paper');
  await main.getByRole('button', { name: /Working paper/ }).first().click();
  await page.waitForTimeout(1400);
  await shot(page, '12-working-paper-preview', false);
});

test('a concluded audit, read from its archive', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await tab(page, main, 'SOX testing');
  await openAudit(page, main, /CY ?2025/);
  await shot(page, '13-archived-dashboard');
  await tab(page, main, 'Control Library');
  await shot(page, '14-archived-control-list');
});
