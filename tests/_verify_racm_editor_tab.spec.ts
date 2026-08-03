import { test, expect } from './_helpers';

/** The exact URL the "Open spreadsheet editor" button produced in the report. */
const DEEP_LINK = '/?view=racm-full-editor&racmId=sox-racm-sox-prog-fy26-treasury&racmName=Treasury+%E2%80%94+RACM&processLabel=Treasury';

test('the RACM editor deep link renders the editor, not the login gate or a dead view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(DEEP_LINK);
  await page.waitForTimeout(1200);

  // the process label from the query string has to reach the page
  await expect(page.getByText('Treasury', { exact: false }).first()).toBeVisible();
  // and we must be off the login gate
  await expect(page.getByRole('button', { name: /Enter workspace/i })).toHaveCount(0);

  await page.screenshot({ path: 'tests/__screenshots__/_verify_racm_editor_tab.png', fullPage: false });
  expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});
