import { test, expect } from '@playwright/test';

test('Workflow build: 5 stages → UI recs → freeze → save → redirect', async ({ page }) => {
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:5173');
  await page.waitForSelector('[class*="bg-sidebar-bg"]', { timeout: 10000 });
  await page.getByText('Start new Chat').click();
  await page.waitForTimeout(500);

  // Send workflow request
  const textarea = page.locator('textarea').first();
  await textarea.fill('Build a workflow to detect duplicate invoices');
  await textarea.press('Enter');

  // Go through 5 stages
  const options = ['SAP ERP', 'Duplicate invoices', 'Fuzzy match', 'recommended I/O', 'Looks great'];
  for (const name of options) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.waitForTimeout(1200);
  }

  // Should see "Recommended UI Changes"
  await expect(page.getByText('Recommended UI Changes')).toBeVisible({ timeout: 8000 });
  console.log('UI Recommendations visible');

  // Apply one recommendation
  await page.getByText('Add severity color coding', { exact: false }).click();
  await page.waitForTimeout(300);

  // Click "Apply 1 changes & Freeze"
  await page.getByRole('button', { name: /Apply.*Freeze/ }).click();
  await page.waitForTimeout(500);

  // Should see "Layout Frozen"
  await expect(page.getByText('Layout Frozen')).toBeVisible({ timeout: 3000 });
  console.log('Layout Frozen');

  // Click "Save Workflow to Library"
  await page.getByRole('button', { name: /Save Workflow to Library/ }).click();
  await page.waitForTimeout(1500);

  // Should see confirmation + redirect link
  await expect(page.getByText('Workflow saved to library!')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('View in Workflow Library')).toBeVisible();
  await expect(page.getByText('Add to Dashboard')).toBeVisible();
  console.log('Saved with redirect links - ALL PASSED');

  // Test: typing text during build should NOT switch to query mode
  // Start a new chat
  await page.getByText('New Chat').first().click();
  await page.waitForTimeout(500);

  // Start another workflow
  await textarea.fill('Build a workflow for SOD detection');
  await textarea.press('Enter');

  // First clarification should appear
  await expect(page.getByText('data source', { exact: false })).toBeVisible({ timeout: 8000 });

  // Type free text instead of clicking option
  await textarea.fill('Use SAP module');
  await textarea.press('Enter');
  await page.waitForTimeout(1200);

  // Should still be in workflow mode — next clarification should appear (not query mode)
  await expect(page.getByRole('button', { name: /Duplicate invoices/ })).toBeVisible({ timeout: 8000 });
  console.log('Text input stayed in workflow mode - PASSED');
});
