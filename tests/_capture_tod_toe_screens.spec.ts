import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/** Capture pass — one shot per screen that still carries the old track words,
 *  so the rename can be reviewed screen by screen rather than line by line. */
const DIR = 'tests/__screenshots__/todtoe';
const ENG = 'FY26 ICFR — Altura Infra Group';

async function land(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, ENG);
  return page.getByRole('main');
}
const openLiveAudit = async (page: import('@playwright/test').Page, main: ReturnType<typeof page.getByRole>) => {
  const audit = main.getByRole('button').filter({ hasText: /^(CY|FY) ?20\d\d/ }).first();
  await expect(audit).toBeVisible({ timeout: 15_000 });
  await audit.click();
  await page.waitForTimeout(1000);
};
const tab = async (page: import('@playwright/test').Page, main: ReturnType<typeof page.getByRole>, name: string) => {
  await main.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(1000);
};

test('engagement overview + RACM + engagement control library', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/05-engagement-overview.png` });

  // The RACM tab is a LIST of matrices; the Design / Operating columns live one
  // drill-in deeper, on the matrix itself.
  await tab(page, main, 'RACM');
  await page.getByText('Treasury — RACM').first().click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${DIR}/03-racm.png` });

  await tab(page, main, 'Control Library');
  await page.screenshot({ path: `${DIR}/02-engagement-control-library.png` });
});

test('audit dashboard + audit control register', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await openLiveAudit(page, main);
  await page.screenshot({ path: `${DIR}/04-audit-dashboard.png` });

  await tab(page, main, 'Control Library');
  // the register is wider than the screen — the two track columns sit at its far
  // right, so scroll to them rather than shooting the columns before them
  await page.locator('.reg-wrap').first().evaluate(el => { el.scrollLeft = el.scrollWidth; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/01-audit-control-register.png` });
});

test('archived audit', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await tab(page, main, 'SOX testing');
  const prior = main.getByRole('button').filter({ hasText: /CY ?2025/ }).first();
  await expect(prior).toBeVisible({ timeout: 15_000 });
  await prior.click();
  await page.waitForTimeout(1200);
  // the archive's Control Library tab is the one carrying the track columns
  await tab(page, main, 'Control Library');
  await page.screenshot({ path: `${DIR}/06-archived-audit.png` });
});

test('deficiency management + working paper preview', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await openLiveAudit(page, main);
  await tab(page, main, 'Deficiency management');
  await page.screenshot({ path: `${DIR}/07-deficiency-management.png` });

  await tab(page, main, 'Control Library');
  await page.locator('tr.reg-row').first().click();
  await page.waitForTimeout(1400);
  await main.getByRole('button', { name: /Working paper/ }).first().click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${DIR}/08-working-paper-preview.png` });
});

test('control page — already renamed', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await openLiveAudit(page, main);
  await tab(page, main, 'Control Library');
  await page.locator('tr.reg-row').first().click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${DIR}/00-control-page-done.png` });
});

test('audit dashboard — by process', async ({ page }) => {
  test.setTimeout(180_000);
  const main = await land(page);
  await openLiveAudit(page, main);
  // the per-process line lives below the fold on the same Dashboard tab
  await page.getByText('BY PROCESS').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/04b-audit-dashboard-by-process.png` });
});
