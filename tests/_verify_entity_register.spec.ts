import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The audit-level Control Library as a GROUP register.
 *
 * A group audit tests the same control separately at every company in scope:
 * same control number, same wording, entirely separate lives. So the register
 * carries one row per control PER ENTITY, each with its own design and operating
 * tracks, and it can be stacked by process or by entity.
 *
 * Altura's scoping put Treasury at four companies, Procure to Pay and Fixed
 * Assets at two each, and Order to Cash at one — 45 rows off 20 controls. That
 * split is read off the programme's own RACM derivation, so these assertions are
 * really checking that the register and the scoping agree.
 *
 * Runs against FY26 ICFR — Altura Infra Group, the engagement this work is
 * scoped to.
 */

type Page = import('@playwright/test').Page;

const ENGAGEMENT = 'FY26 ICFR — Altura Infra Group';

/** The engagement, then into the audit, then the Control Library tab. */
async function openRegister(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, ENGAGEMENT);
  // The engagement Overview leads with the audit in flight, and the whole tile is
  // the way in — its accessible name is the openLabel ("Open CY 2026 …").
  await page.getByRole('button', { name: /(Open|View) CY 2026/ }).first().click();
  await page.waitForTimeout(1200);
  // NOT .first() — the left sidebar has a global "Control Library" entry that comes
  // earlier in the DOM, and clicking it leaves the engagement entirely.
  await page.getByRole('button', { name: 'Control Library' }).last().click();
  await page.waitForTimeout(900);
}

test('the register opens on the table, not the cards', async ({ page }) => {
  await openRegister(page);
  // A table view is a table: the column headers are only rendered by that layout.
  await expect(page.getByRole('columnheader', { name: /Objective/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'false');
});

test('the RACM columns are all on the row', async ({ page }) => {
  await openRegister(page);
  // Objective is the only plain header left; the rest are their own column filter,
  // and a header cell with interactive content has no name of its own to match on.
  await expect(page.getByRole('columnheader', { name: /^Objective$/ })).toBeVisible();
  for (const f of ['process', 'entity', 'control type', 'frequency', 'owner', 'nature']) {
    await expect(page.getByRole('button', { name: `Filter by ${f}` })).toBeVisible();
  }
  // The checkbox column is gone — no select-all, no per-row box.
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  // And they carry values, not blanks — one row, read across.
  const row = page.locator('tr.reg-row').first();
  await expect(row).toContainText('Altura');
  await expect(row).toContainText(/Preventive|Detective/);
});

test('the same control is a separate row at each company', async ({ page }) => {
  await openRegister(page);
  // TRY-01 runs at four companies, so its number appears four times — and each
  // row names a different one. Column 2 of 12 is Entity.
  const rows = page.locator('tr.reg-row', { hasText: 'TRY-01' });
  await expect(rows).toHaveCount(4);
  const entities: string[] = [];
  for (let i = 0; i < await rows.count(); i++) {
    entities.push(await rows.nth(i).locator('td').nth(2).innerText());
  }
  expect(new Set(entities).size).toBe(4);
});

test('a column filter narrows the register', async ({ page }) => {
  await openRegister(page);
  await page.getByRole('button', { name: 'Filter by control type' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'Detective' }).click();
  await page.waitForTimeout(600);
  const rows = page.locator('tr.reg-row');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const text of await rows.locator('td').nth(3).allInnerTexts()) {
    expect(text).toContain('Detective');
  }
});

test('a column can be dragged narrower, and it stays that way', async ({ page }) => {
  await openRegister(page);
  const header = page.locator('th').filter({ hasText: 'Objective' }).first();
  const before = (await header.boundingBox())!.width;

  const grip = header.locator('.reg-grip');
  const box = (await grip.boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + 12, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const after = (await header.boundingBox())!.width;
  expect(after).toBeLessThan(before - 60);

  // And it is the reader's width now, not ours — it survives leaving the tab.
  await page.getByRole('button', { name: 'Dashboard' }).last().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Control Library' }).last().click();
  await page.waitForTimeout(800);
  expect((await header.boundingBox())!.width).toBeCloseTo(after, 0);
});

test('the same control at two companies is at two different stages', async ({ page }) => {
  await openRegister(page);
  // The point of separate rows: one entity being concluded says nothing about
  // another. Across TRY-01's four rows the operating track is not all at one
  // place. Column 9 of 12 is ② Operating — see the header order.
  const rows = page.locator('tr.reg-row', { hasText: 'TRY-01' });
  const operating: string[] = [];
  for (let i = 0; i < await rows.count(); i++) {
    operating.push(await rows.nth(i).locator('td').nth(9).innerText());
  }
  expect(operating).toHaveLength(4);
  expect(new Set(operating).size).toBeGreaterThan(1);
});

test('Group is a dropdown, and grouping by entity restacks the register', async ({ page }) => {
  await openRegister(page);
  // Opens on Process — the group rows are process names.
  await expect(page.locator('tr.reg-group-row', { hasText: 'Treasury' })).toBeVisible();

  await page.getByRole('button', { name: 'Group the register by' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'Entity' }).click();
  await page.waitForTimeout(600);

  // Now the group rows are companies, and Treasury's four are all present.
  for (const entity of ['Altura Infra Holdings Ltd', 'Altura Solar Pvt Ltd', 'Altura Wind Pvt Ltd']) {
    await expect(page.locator('tr.reg-group-row', { hasText: entity })).toBeVisible();
  }
  await expect(page.locator('tr.reg-group-row', { hasText: 'Treasury' })).toHaveCount(0);
});

test('no grouping flattens it', async ({ page }) => {
  await openRegister(page);
  await page.getByRole('button', { name: 'Group the register by' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: 'No grouping' }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('tr.reg-group-row')).toHaveCount(0);
});

test('the entity is on the card too, and on the control page', async ({ page }) => {
  await openRegister(page);
  await page.getByRole('button', { name: 'Grid view' }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('.ac-card').first()).toContainText('Altura');

  // Drill in — the control page says which company's copy this is.
  await page.locator('.ac-card').first().click();
  await page.waitForTimeout(1200);
  await expect(page.getByText('Entity', { exact: true }).first()).toBeVisible();
});
