import { test, expect, type Page } from '@playwright/test';
import { enterWorkspace } from './_helpers';

// Process Hub BP detail now opens on an "Overview" tab — an engagement-style
// dashboard (risk-severity donut, control-status bar, coverage funnel, workflows,
// at-a-glance, needs-attention, recent changes) plus placeholders for the metrics
// with no data yet. A tab bar (Overview + the five sections) is the primary nav,
// and the old Setup/Coverage panels are dropped for fully built-out processes.

async function gotoP2P(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ } });
  await page.goto('/');
  await enterWorkspace(page);
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  await page.waitForTimeout(700);
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 1100 }); });

test('P2P opens on an Overview tab with the dashboard widgets', async ({ page }) => {
  await gotoP2P(page);
  await expect(page.getByRole('button', { name: 'Overview' }).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Risks by severity').first()).toBeVisible();
  await expect(page.getByText('Controls by status').first()).toBeVisible();
  await expect(page.getByText('Coverage funnel').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workflows' }).first()).toBeVisible();
  await expect(page.getByText('Needs attention').first()).toBeVisible();
  // Placeholders for the widgets we have no data for.
  await expect(page.getByText(/Run history not captured yet/i)).toBeVisible();
  await expect(page.getByText(/Daily activity history coming soon/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/bp-overview.png', fullPage: true });
});

test('old Setup + Coverage-by-section panels are gone for a built-out process', async ({ page }) => {
  await gotoP2P(page);
  await expect(page.getByText('Coverage by section')).toHaveCount(0);
  await expect(page.getByText('Set up this business process')).toHaveCount(0);
});

test('tab bar navigates between Overview and the sections', async ({ page }) => {
  await gotoP2P(page);
  await page.getByRole('button', { name: 'Switch to Risks' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Risks by severity')).toHaveCount(0); // left the dashboard
  await page.getByRole('button', { name: 'Overview' }).first().click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Risks by severity').first()).toBeVisible(); // back on the dashboard
});
