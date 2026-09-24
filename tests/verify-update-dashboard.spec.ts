import { test, expect, type Page } from './_helpers';
import * as XLSX from 'xlsx';

/**
 * Update Dashboard Data — the dialog behind the dashboard header's
 * "Update Dashboard" button. Four independent modes (Upload Data / Run
 * Workflows / Sync Live Data / Previous Runs), each offered only when the
 * dashboard has that kind of source. Everything is mocked on timers.
 *
 * Run: npx playwright test tests/verify-update-dashboard.spec.ts
 * Screenshots: $UPDATE_DASH_SHOTS (optional).
 */
const SHOT_DIR = process.env.UPDATE_DASH_SHOTS;
const shot = async (page: Page, name: string) => {
  if (SHOT_DIR) await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
};

const csv = (name: string) => ({ name, mimeType: 'text/csv', buffer: Buffer.from('Invoice ID,Vendor Name,Amount\n1,Acme,100\n') });
const multiSheetXlsx = (name: string) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'Data');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['c'], [3]]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['d'], [4]]), 'Lookup');
  return { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer };
};

async function openDashboard(page: Page, name: string) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  // Fresh per-dashboard update state (runs, pins, replaced names) every run.
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('irame.dashboard.')).forEach(k => localStorage.removeItem(k));
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 10_000 });
}

test('P2P dashboard: Upload Data → Run Workflows → Previous Runs', async ({ page }) => {
  test.setTimeout(120_000);
  await openDashboard(page, 'Procurement (P2P)');
  const upload = page.getByTestId('pane-upload');
  const bulk = page.getByTestId('pane-bulk');

  // Header button + dialog with the three segments this dashboard has.
  await page.getByTestId('update-dashboard-button').click();
  const dialog = page.getByRole('dialog', { name: 'Update Dashboard Data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Upload Data' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('tab', { name: 'Run Workflows' })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Previous Runs' })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Sync Live Data' })).toHaveCount(0);
  await expect(dialog.getByTestId('update-segment-description')).toHaveText(/Upload the latest files to refresh your dashboard/);
  await expect(upload.getByText('Files in pool (0)')).toBeVisible();
  await expect(upload.getByText('Dashboard files')).toBeVisible();
  await expect(upload.getByText('Invoice_Master.xlsx')).toBeVisible();
  await expect(dialog.getByText('Used by 4 widgets · also a workflow input')).toBeVisible();
  await expect(dialog.getByTestId('upload-save-status')).toHaveText('Replace at least one file to save.');
  await expect(dialog.getByTestId('upload-save')).toBeDisabled();
  await expect(dialog.getByTestId('source-replace-select').first()).toBeDisabled();
  await shot(page, '01-upload-empty');

  // Pool: one CSV + a 3-sheet workbook → sheet picker → chips.
  await upload.getByTestId('pool-file-input').setInputFiles([csv('invoices_sep.csv'), multiSheetXlsx('vendor_finance_sep.xlsx')]);
  const picker = page.getByTestId('sheet-picker');
  await expect(picker).toBeVisible({ timeout: 10_000 });
  await expect(picker.getByText('vendor_finance_sep.xlsx')).toBeVisible();
  await shot(page, '02-sheet-picker');
  await picker.getByRole('button', { name: 'Lookup' }).click(); // untick one sheet
  await picker.getByRole('button', { name: 'Use 2 sheets' }).click();
  await expect(upload.getByText('Files in pool (3)')).toBeVisible();
  await expect(upload.getByText('vendor_finance_sep.xlsx [Data]')).toBeVisible();
  await expect(upload.getByText('vendor_finance_sep.xlsx [Summary]')).toBeVisible();

  // Assign → column check → ready → Save.
  const select = dialog.getByTestId('source-replace-select').first();
  await expect(select).toBeEnabled({ timeout: 10_000 });
  await select.selectOption({ label: 'invoices_sep.csv' });
  await expect(dialog.getByText('Columns match. Saving will switch the widgets to this file.')).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByTestId('upload-save')).toBeEnabled();
  // Second row: assign a sheet entry, then discard it again.
  await dialog.getByTestId('source-replace-select').nth(1).selectOption({ label: 'vendor_finance_sep.xlsx [Summary]' });
  await expect(dialog.getByText('Columns match. Saving will switch the widgets to this file.')).toHaveCount(2, { timeout: 10_000 });
  await dialog.getByTestId('source-replace-select').nth(1).selectOption({ label: 'Keep the current file' });
  await expect(dialog.getByText('Columns match. Saving will switch the widgets to this file.')).toHaveCount(1);
  await shot(page, '03-upload-ready');
  await dialog.getByTestId('upload-save').click();
  await expect(page.getByText('Dashboard updated with the new data.')).toBeVisible({ timeout: 10_000 });
  await expect(upload.getByText('invoices_sep.csv')).toBeVisible();
  await expect(upload.getByText('Files in pool (0)')).toBeVisible();
  await shot(page, '04-upload-saved');

  // Run Workflows: pool → slots → bulk run → rows settle → success line.
  await dialog.getByRole('tab', { name: 'Run Workflows' }).click();
  await expect(dialog.getByTestId('update-segment-description')).toHaveText(/Run workflows using the latest available data/);
  await expect(bulk.getByText('Step 1 · Check inputs')).toBeVisible();
  await expect(bulk.getByText('Invoice Duplicate Detection')).toBeVisible();
  await expect(bulk.getByText('Never run yet, so it can’t be part of the bulk run. Run it once from the workflow executor first.')).toBeVisible();
  await expect(dialog.getByTestId('bulk-inputs-assigned')).toHaveText('0 of 3 inputs assigned.');
  await expect(dialog.getByTestId('bulk-run-button')).toBeDisabled();
  await bulk.getByTestId('pool-file-input').setInputFiles([csv('ap_invoices_sep.csv'), csv('vendor_master_sep.csv'), csv('payment_ledger_sep.csv')]);
  await expect(bulk.getByText('Files in pool (3)')).toBeVisible({ timeout: 10_000 });
  const slotSelects = dialog.getByTestId('input-slot-select');
  await expect(slotSelects.first()).toBeEnabled({ timeout: 10_000 });
  await slotSelects.nth(0).selectOption({ label: 'ap_invoices_sep.csv' });
  await slotSelects.nth(1).selectOption({ label: 'vendor_master_sep.csv' });
  await slotSelects.nth(2).selectOption({ label: 'payment_ledger_sep.csv' });
  await expect(dialog.getByTestId('bulk-inputs-assigned')).toHaveText('3 of 3 inputs assigned.', { timeout: 10_000 });
  await expect(dialog.getByText('Will be used in the next run, replacing ap_invoices_aug.csv')).toBeVisible();
  await expect(dialog.getByTestId('bulk-run-button')).toBeEnabled();
  await shot(page, '05-bulk-ready');
  await dialog.getByTestId('bulk-run-button').click();
  await expect(dialog.getByTestId('batch-status-started').first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText(/of 2 runs finished/)).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Run Workflows' }).locator('svg.animate-spin')).toBeVisible();
  await shot(page, '06-bulk-running');
  await expect(dialog.getByTestId('batch-success')).toHaveText('2 runs finished, dashboard updated', { timeout: 20_000 });
  await expect(bulk.getByText('Files in pool (0)')).toBeVisible();
  await shot(page, '07-bulk-done');

  // Previous Runs: the fresh run is Current; pin an older one.
  await dialog.getByRole('tab', { name: 'Previous Runs' }).click();
  await expect(dialog.getByTestId('update-segment-description')).toHaveText(/Put an earlier run’s results back on the dashboard/);
  const dupList = dialog.getByTestId('run-list').filter({ hasText: 'Invoice Duplicate Detection' });
  await expect(dupList.getByTestId('workflow-run-item')).toHaveCount(4);
  await expect(dupList.getByTestId('workflow-run-item').first().getByTestId('workflow-run-current')).toBeVisible();
  await expect(dupList.getByText('Files: ap_invoices_sep.csv, vendor_master_sep.csv')).toBeVisible();
  await expect(dupList.getByTestId('workflow-run-pick').first()).toBeDisabled();
  await dupList.getByTestId('workflow-run-pick').nth(1).click();
  await expect(dupList.getByText('Dashboard will switch to this run’s outputs.')).toBeVisible();
  await shot(page, '08-history-confirm');
  await dupList.getByTestId('workflow-run-apply').click();
  await expect(page.getByText('Dashboard updated with this run’s data.')).toBeVisible({ timeout: 10_000 });
  await expect(dupList.getByTestId('workflow-run-item').nth(1).getByTestId('workflow-run-current')).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Previous Runs' }).locator('svg').last()).toBeVisible(); // green check
  await shot(page, '09-history-applied');

  // Close, reopen: the pinned run persisted; the green checks reset.
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await page.getByTestId('update-dashboard-button').click();
  await dialog.getByRole('tab', { name: 'Previous Runs' }).click();
  await expect(dupList.getByTestId('workflow-run-item').nth(1).getByTestId('workflow-run-current')).toBeVisible();
});

test('GRC (SQL) dashboard: Sync Live Data with a failed run, Retry, and schedules', async ({ page }) => {
  test.setTimeout(120_000);
  await openDashboard(page, 'GRC Overview');
  await page.getByTestId('update-dashboard-button').click();
  const dialog = page.getByRole('dialog', { name: 'Update Dashboard Data' });
  await expect(dialog.getByRole('tab', { name: 'Sync Live Data' })).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.getByRole('tab', { name: 'Upload Data' })).toHaveCount(0);
  await expect(dialog.getByRole('tab', { name: 'Run Workflows' })).toHaveCount(0);
  await expect(dialog.getByTestId('live-schedule-card')).toHaveText('Scheduled runs: off');
  await expect(dialog.getByTestId('live-selected-count')).toHaveText('0 of 3 selected');
  await expect(dialog.getByTestId('live-workflow-card')).toHaveCount(3);
  await expect(dialog.getByTestId('live-workflow-schedule-line').first()).toHaveText('Follows the dashboard schedule');
  await expect(dialog.getByTestId('live-sync-now')).toBeDisabled();
  await shot(page, '10-live-empty');

  await dialog.getByTestId('live-select-all').click();
  await expect(dialog.getByTestId('live-selected-count')).toHaveText('3 of 3 selected');
  await expect(dialog.getByTestId('live-sync-now')).toHaveText('Sync now (3 workflows)');
  await dialog.getByTestId('live-sync-now').click();
  await expect(dialog.getByTestId('batch-status-started').first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByTestId('batch-stop').first()).toBeVisible();
  await shot(page, '11-live-running');
  // Deficiency Ageing fails its first run → Retry lands it.
  await expect(dialog.getByTestId('batch-retry')).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText('Run didn’t finish. The dashboard kept its previous data.')).toBeVisible();
  await expect(dialog.getByTestId('batch-success')).toHaveText('2 runs finished, dashboard updated', { timeout: 20_000 });
  await expect(dialog.getByRole('tab', { name: 'Sync Live Data' }).locator('svg')).toHaveCount(0); // no green check while a row failed
  await shot(page, '12-live-failed');
  await dialog.getByTestId('batch-retry').click();
  await expect(dialog.getByTestId('batch-success')).toHaveText('3 runs finished, dashboard updated', { timeout: 20_000 });
  await expect(dialog.getByTestId('batch-retry')).toHaveCount(0);
  await shot(page, '13-live-retried');

  // Per-workflow schedule.
  await dialog.getByTestId('live-workflow-schedule').first().click();
  await expect(dialog.getByTestId('live-schedule-view')).toBeVisible();
  await expect(dialog.getByText('Scheduled runs · Control Testing Status')).toBeVisible();
  await expect(dialog.getByTestId('update-segment-description')).toHaveCount(0);
  await expect(dialog.getByTestId('live-schedule-save')).toBeDisabled();
  await dialog.getByRole('switch', { name: 'Enable scheduled sync' }).click();
  await expect(dialog.getByText('Next sync')).toBeVisible();
  await shot(page, '14-live-schedule-editor');
  await dialog.getByTestId('live-schedule-save').click();
  await expect(page.getByText(/Control Testing Status now runs daily at 6:00 am/)).toBeVisible();
  await expect(dialog.getByTestId('live-workflow-schedule-line').first()).toHaveText(/Next schedule · /);

  // Dashboard-wide schedule → header Auto-sync chip follows.
  await dialog.getByTestId('live-bulk-schedule').click();
  await expect(dialog.getByText('Runs automatically on a repeating schedule.')).toBeVisible();
  await dialog.getByRole('switch', { name: 'Enable scheduled sync' }).click();
  await dialog.getByRole('button', { name: 'Weekly' }).click();
  await dialog.getByTestId('live-schedule-save').click();
  await expect(dialog.getByTestId('live-schedule-card')).toHaveText(/Scheduled runs: next /);
  await shot(page, '15-live-scheduled');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: /Auto-sync: Every weekday at 6:00 AM/ })).toBeVisible();
});

test('Query-only dashboard has no Update Dashboard button; Excel sample opens without a stepper', async ({ page }) => {
  await openDashboard(page, 'Order to Cash (O2C)');
  await expect(page.getByTestId('update-dashboard-button')).toHaveCount(0);

  await page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.getByText('Excel Sample Example', { exact: true }).first().click();
  await page.getByTestId('update-dashboard-button').click();
  const dialog = page.getByRole('dialog', { name: 'Update Dashboard Data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('update-dashboard-stepper')).toHaveCount(0);
  await expect(dialog.getByText('Dashboard files')).toBeVisible();
  await shot(page, '16-excel-single-segment');
});
