/**
 * Screenshot capture for the active-chat UI design review.
 * Captures: sidebar collapsed/expanded, active chat with thinking, active chat with rich result.
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test tests/review-active-chat.spec.ts --project=chromium
 */
import { test, type Page } from './_helpers';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const OUT = 'tests/__screenshots__/review';

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

async function pick(page: Page, label: RegExp) {
  const opt = page.getByRole('option', { name: label });
  await opt.first().waitFor({ timeout: 15000 });
  await opt.first().click();
  await page.waitForTimeout(600);
}

test('active-chat-thinking', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  await startChat(page);
  // First send a message that triggers clarification → answer it → get rich result.
  await send(page, 'Detect duplicate invoices');
  // Capture once user message is visible (before clarification renders).
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-active-chat-first-send.png`, fullPage: false });
});

test('active-chat-rich-result', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await startChat(page);
  await send(page, 'Detect duplicate invoices');
  await pick(page, /Last 90 days/);
  await pick(page, /1% tolerance/);
  await pick(page, /All vendors/);
  await pick(page, /Fuzzy match all fields/);
  // Wait for audit result to render.
  await page
    .locator('main')
    .getByRole('button', { name: 'Add to dashboard', exact: true })
    .waitFor({ timeout: 45000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/02-active-chat-rich-result.png`, fullPage: false });
  // Also capture full page for vertical detail.
  await page.screenshot({ path: `${OUT}/02-active-chat-rich-result-full.png`, fullPage: true });
});

test('sidebar-collapsed-default', async ({ page }) => {
  await boot(page);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/03-sidebar-collapsed.png`,
    clip: { x: 0, y: 0, width: 320, height: 900 },
  });
});

test('sidebar-hover-expanded', async ({ page }) => {
  await boot(page);
  // Hover the sidebar to trigger auto-expand.
  await page.mouse.move(32, 400);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/04-sidebar-hover-expanded.png`,
    clip: { x: 0, y: 0, width: 320, height: 900 },
  });
});

test('sidebar-pinned-expanded', async ({ page }) => {
  await boot(page);
  // Click the PanelLeft pin icon in the collapsed sidebar to pin it open.
  await page.getByRole('button', { name: /Pin sidebar open/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/05-sidebar-pinned-expanded.png`,
    clip: { x: 0, y: 0, width: 320, height: 900 },
  });
});

test('chat-with-pinned-sidebar', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  await page.getByRole('button', { name: /Pin sidebar open/i }).click();
  await startChat(page);
  await send(page, 'Detect duplicate invoices');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/06-active-chat-with-pinned-sidebar.png`, fullPage: false });
});

test('active-chat-stop-and-shimmer', async ({ page }) => {
  // Captures the in-flight state: stop button replaces send, shimmer skeleton
  // shows where the response will land.
  test.setTimeout(60_000);
  await boot(page);
  await startChat(page);
  await send(page, 'Tell me about audit risk');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/07-active-chat-stop-and-shimmer.png`, fullPage: false });
});

test('active-chat-hover-actions', async ({ page }) => {
  // Drives the full duplicate-invoices clarification → audit-result flow, then
  // hovers the result row to capture the Copy / Retry / 👍 / 👎 action bar.
  test.setTimeout(120_000);
  await boot(page);
  await startChat(page);
  await send(page, 'Detect duplicate invoices');
  await pick(page, /Last 90 days/);
  await pick(page, /1% tolerance/);
  await pick(page, /All vendors/);
  await pick(page, /Fuzzy match all fields/);
  await page
    .locator('main')
    .getByRole('button', { name: 'Add to dashboard', exact: true })
    .waitFor({ timeout: 45000 });
  // Hover the inline KPI summary so the action bar reveals via group-hover.
  const kpi = page.getByText(/Records scanned/i).first();
  await kpi.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/08-active-chat-hover-actions.png`, fullPage: false });
});
