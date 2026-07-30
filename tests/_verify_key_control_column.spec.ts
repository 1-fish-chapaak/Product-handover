import { test, expect } from './_helpers';

const DEEP_LINK = '/?view=racm-full-editor&racmId=sox-racm-sox-prog-fy26-treasury&racmName=Treasury+%E2%80%94+RACM&processLabel=Treasury';

test('Key Control is its own column, sits after Control ID, and toggles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(DEEP_LINK);
  await page.waitForTimeout(1200);

  // the header carries the new column, immediately after Control ID
  // (the header style uppercases the label, so compare case-insensitively)
  const headers = await page.locator('div.uppercase.tracking-wider > span.truncate').allInnerTexts();
  const ids = headers.map(h => h.trim().toUpperCase());
  expect(ids.slice(0, 3)).toEqual(['RISK ID', 'CONTROL ID', 'KEY CONTROL']);

  // C003 was already starred in the old Control ID cell — it must read as marked here
  const marked = page.getByRole('switch', { name: 'Key control — C003' });
  await expect(marked).toBeVisible();
  await expect(marked).toHaveAttribute('aria-checked', 'true');
  await expect(marked).toHaveText(/key/i);

  // …and an unmarked one names itself rather than sitting empty
  const unmarked = page.getByRole('switch', { name: 'Key control — C001' });
  await expect(unmarked).toHaveAttribute('aria-checked', 'false');
  await expect(unmarked).toHaveText(/non key/i);

  await page.screenshot({ path: 'tests/__screenshots__/_verify_key_control_before.png' });

  // clicking flips it
  await unmarked.click();
  await page.waitForTimeout(300);
  await expect(unmarked).toHaveAttribute('aria-checked', 'true');
  await expect(unmarked).toHaveText('Key');

  // and unmarking works too
  await marked.click();
  await page.waitForTimeout(300);
  await expect(marked).toHaveAttribute('aria-checked', 'false');
  await expect(marked).toHaveText('Non key');

  await page.screenshot({ path: 'tests/__screenshots__/_verify_key_control_after.png' });
  expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});
