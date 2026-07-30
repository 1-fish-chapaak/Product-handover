/**
 * Tight element crops for the chat UI polish review — rendered large so
 * 1% craft issues (alignment, spacing, divider/icon weights) are visible.
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:5174 npx playwright test tests/_review_polish_capture.spec.ts --project=chromium
 */
import { test, type Page } from './_helpers';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const OUT = 'tests/__screenshots__/polish';

async function boot(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ask IRA' }).waitFor({ timeout: 15000 });
}
async function startChat(page: Page) {
  await page.getByRole('button', { name: 'Ask IRA' }).click();
  await page.locator('textarea').first().waitFor({ timeout: 5000 });
}
async function send(page: Page, msg: string) {
  const ta = page.locator('textarea').first();
  await ta.fill(msg);
  await ta.press('Enter');
}
// Stepped radiogroup card (role=radio single / role=checkbox multi) with an
// explicit Next / Done — no longer an auto-advancing role=option listbox.
async function pick(page: Page, label: RegExp) {
  const opt = page.getByRole('radio', { name: label }).or(page.getByRole('checkbox', { name: label }));
  await opt.first().waitFor({ timeout: 15000 });
  await opt.first().click();
  const done = page.getByRole('button', { name: 'Done' });
  if (await done.count() > 0) await done.click();
  else await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);
}

test.use({ deviceScaleFactor: 2 });

test('crop-hero-composer', async ({ page }) => {
  test.setTimeout(40_000);
  await boot(page);
  await startChat(page);
  await page.waitForTimeout(5200);
  // crop the headline+composer region
  await page.screenshot({ path: `${OUT}/30-hero-headline-composer.png`, clip: { x: 300, y: 120, width: 860, height: 280 } });
});

test('crop-clarification-card', async ({ page }) => {
  test.setTimeout(40_000);
  await boot(page);
  await startChat(page);
  await send(page, 'Detect duplicate invoices');
  await page.getByRole('radio', { name: /Last 90 days/ }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/31-clarification-card.png`, clip: { x: 300, y: 440, width: 860, height: 380 } });
});

test('crop-result-actionbar', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await startChat(page);
  await send(page, 'Detect duplicate invoices');
  await pick(page, /Last 90 days/);
  await pick(page, /1% tolerance/);
  await pick(page, /All vendors/);
  await pick(page, /Fuzzy match all fields/);
  await page.locator('main').getByRole('button', { name: 'Add to dashboard', exact: true }).waitFor({ timeout: 45000 });
  await page.mouse.move(10, 10);
  await page.waitForTimeout(2200);
  await page.locator('main').getByRole('button', { name: 'Save as workflow' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  // crop just the action bar + follow-up chips region (main column, not workspace)
  await page.screenshot({ path: `${OUT}/32-result-actionbar.png`, clip: { x: 110, y: 470, width: 600, height: 330 } });
});
