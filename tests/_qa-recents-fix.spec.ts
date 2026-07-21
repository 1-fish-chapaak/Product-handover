import { test, expect } from './_helpers';

/**
 * Recents rows are role="button" divs now (they carry a favourite star, and a
 * button can't contain a button). Verify the DOM is valid and that click,
 * keyboard and the star action all still behave.
 *
 * NOTE: target the star with a tag-scoped CSS selector, never
 * getByRole('button', { name: 'Add to favourites' }) — the row's accessible
 * name is built from its contents, so it *contains* the star's label and
 * Playwright's substring name matching would resolve to the row itself.
 */
const STAR = 'button[aria-label="Add to favourites"]';
const UNSTAR = 'button[aria-label="Remove from favourites"]';

test('recents rows: valid DOM, star toggles, click and keyboard open the chat', async ({ page }) => {
  const errs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/DevTools|\[vite\]|favicon/i.test(m.text())) errs.push(m.text().slice(0, 160));
  });

  await page.goto('/');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Recents/i }).first().click();
  await page.waitForTimeout(1400);
  await page.evaluate(() => localStorage.removeItem('recents.favourites.v1'));

  // 1. No nested interactive elements anywhere on the page.
  const nested = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href]')).filter((el) =>
      el.querySelector('button, a[href]')).length);
  expect(nested, 'nested interactive elements').toBe(0);

  // 2. The star favourites the row and does NOT open the chat.
  const rowCount = await page.locator(STAR).count();
  expect(rowCount, 'rows render').toBeGreaterThan(0);
  await page.locator(STAR).first().click();
  await page.waitForTimeout(600);
  expect(await page.locator('textarea, [contenteditable=true]').count(), 'star must not navigate').toBe(0);
  expect(await page.locator(UNSTAR).count(), 'row is starred').toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('recents.favourites.v1')), 'favourite persisted').toBeTruthy();

  // 3. Keyboard: focus a row, press Enter → the chat opens.
  const row = page.locator('[role=button]').filter({ hasText: /Wed|Tue|Mon|Sun/ }).first();
  await row.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  expect(await page.locator('textarea, [contenteditable=true]').count(), 'Enter opens the chat').toBeGreaterThan(0);

  // 4. Mouse: a row click opens the chat too.
  await page.getByRole('button', { name: /^Recents/i }).first().click();
  await page.waitForTimeout(1400);
  await page.getByText('Auditor journey hackathon vision').first().click();
  await page.waitForTimeout(1500);
  expect(await page.locator('textarea, [contenteditable=true]').count(), 'row click opens the chat').toBeGreaterThan(0);

  expect(errs.join('\n'), 'console errors').toBe('');
});
