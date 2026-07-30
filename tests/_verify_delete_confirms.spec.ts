import { test, expect } from './_helpers';

/**
 * C2 — the dossier's three trash buttons (design consideration, test attribute,
 * design document) always confirm before deleting: Cancel keeps the row,
 * Delete removes exactly one.
 */
test('dossier deletes ask before removing', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  // an unconcluded (editable) control via the year-end checklist's exact view
  await page.getByText(/controls? not concluded/).first().click();
  await page.waitForTimeout(900);
  await page.getByText(/Invoices are matched three-way/).first().click();
  await page.waitForTimeout(1000);

  const trashes = page.locator('button[title="Remove"]');
  const before = await trashes.count();
  expect(before).toBeGreaterThan(0);

  // click trash → confirm dialog; Cancel keeps the row
  await trashes.first().click();
  await expect(page.getByText(/Delete this (consideration|document)\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForTimeout(400);
  expect(await trashes.count()).toBe(before);

  // Delete removes exactly one
  await trashes.first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(500);
  expect(await trashes.count()).toBe(before - 1);

  // the attribute trash confirms too
  const attrTrash = page.locator('button[title="Remove attribute"]').first();
  if (await attrTrash.count()) {
    await attrTrash.click();
    await expect(page.getByText(/Delete attribute .+\?/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
});
