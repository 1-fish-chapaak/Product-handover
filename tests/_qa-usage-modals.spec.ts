import { test, expect, usageTab } from './_helpers';
import fs from 'node:fs';

/**
 * Open every Platform Usage section deep-dive and confirm it renders cleanly.
 * The tiles are discovered from the page rather than hardcoded, so adding or
 * splitting a section (Ask IRA / AI Concierge, say) doesn't leave this behind.
 */
test('every section deep-dive modal renders', async ({ page }) => {
  test.setTimeout(120000); // twelve sections, each opened and screenshotted
  fs.mkdirSync('tests/__screenshots__/usage', { recursive: true });
  const errs: string[] = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => {
    if (m.type() === 'error' && !/DevTools|\[vite\]|favicon/i.test(m.text())) errs.push(m.text().slice(0, 160));
  });

  await page.goto('/');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Platform Usage/i }).first().click();
  await page.waitForTimeout(2500);
  // The deep-dive tiles live on the Sections tab now.
  await usageTab(page, 'Sections');

  const tiles = page.getByRole('button', { name: /— open details$/i });
  const names = await tiles.evaluateAll(els =>
    els.map(el => el.getAttribute('aria-label')!.replace(/ — open details$/i, '')));
  expect(names.length, 'section tiles found').toBeGreaterThan(0);
  console.log(`\nsections: ${names.join(', ')}`);

  for (const name of names) {
    await page.getByRole('button', { name: `${name} — open details` }).first().click();
    await page.waitForTimeout(1300);

    const body = await page.locator('body').innerText();
    expect(body, `${name} modal shows an error`).not.toMatch(/something went wrong/i);

    await page.screenshot({ path: `tests/__screenshots__/usage/modal-${name.toLowerCase().replace(/[^a-z]+/g, '-')}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  expect(errs.join('\n'), 'console errors while opening the modals').toBe('');
});
