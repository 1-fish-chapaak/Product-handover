import { test, type Page } from '@playwright/test';

// One-off capture for a Norman (Design of Everyday Things) audit of the
// Knowledge Hub. Not part of the suite. Outputs to __screenshots__/audit-kh/.

const DIR = 'tests/__screenshots__/audit-kh';

async function gotoKH(page: Page) {
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await nav.waitFor({ state: 'visible', timeout: 8000 });
  await nav.click();
  await page.waitForTimeout(1200);
}

test('kh landing (data sources)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoKH(page);
  await page.screenshot({ path: `${DIR}/01-landing.png`, fullPage: false });
});

test('kh full page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoKH(page);
  await page.screenshot({ path: `${DIR}/02-fullpage.png`, fullPage: true });
});

test('kh add-source picker', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoKH(page);
  // The "N" shortcut opens the add-source picker.
  await page.keyboard.press('n');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${DIR}/03-picker.png`, fullPage: false });
});

test('kh smart learn tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoKH(page);
  await page.getByRole('button', { name: /Smart Learn/ }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/04-smart-learn.png`, fullPage: false });
});

test('kh open a folder detail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoKH(page);
  // Click the first source row/card to open the reading-pane detail.
  const firstRow = page.locator('[role="row"], button, a').filter({ hasText: /\.(pdf|xlsx|csv|docx)|folder|sources|files/i }).first();
  try {
    await firstRow.click({ timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch { /* leave on landing if nothing clickable */ }
  await page.screenshot({ path: `${DIR}/05-detail.png`, fullPage: false });
});
