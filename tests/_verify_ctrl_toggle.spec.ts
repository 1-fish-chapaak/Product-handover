import { test, expect } from './_helpers';

/**
 * SOX Control Library — the Cards/Table switch follows Reports' view toggle:
 * icon-only buttons in a bordered group, the active one on a paper-50 chip with
 * a brand-tinted icon. The labels are gone from the face, so the buttons carry
 * their names for assistive tech and hover.
 */
test('Control Library view toggle is icon-only and still switches layout', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  // scoped: the left sidebar carries its own global "Control Library" nav item
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(900);

  const cards = page.getByRole('button', { name: 'Card view' });
  const table = page.getByRole('button', { name: 'Table view' });
  await expect(cards).toBeVisible();
  await expect(table).toBeVisible();

  // icon-only — the old "Cards" / "Table" text labels are gone from the toggle
  await expect(cards).toHaveText('');
  await expect(table).toHaveText('');

  // cards is the default; pressed state tracks the active layout
  await expect(cards).toHaveAttribute('aria-pressed', 'true');
  await expect(table).toHaveAttribute('aria-pressed', 'false');

  // switching still works — the table layout renders its column headers
  await table.click();
  await page.waitForTimeout(500);
  await expect(table).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('columnheader', { name: 'Control' }).first()).toBeVisible();

  await cards.click();
  await page.waitForTimeout(500);
  await expect(cards).toHaveAttribute('aria-pressed', 'true');

  // the register's actions now sit in this same toolbar, beside the view controls
  const toolbar = page.locator('.sox-book-ui div.flex.items-center.gap-2.mb-4.flex-wrap').first();
  await expect(toolbar.getByRole('button', { name: /Bulk test all/ })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Export working paper' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: /New control/ })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Card view' })).toBeVisible();

  // …and the whole row still fits on one line at desktop width. Measured by the
  // toolbar's height, not child tops: items-center gives differently-sized
  // children different tops on the same visual line. One 36px row + wrap slack.
  await page.setViewportSize({ width: 1512, height: 900 });
  await page.waitForTimeout(300);
  const height = await toolbar.evaluate(el => Math.round(el.getBoundingClientRect().height));
  expect(height).toBeLessThanOrEqual(44);
});
