import { test, expect } from './_helpers';

/**
 * SOX / ICFR — a drilled-in RACM matrix stands alone like the control page:
 * no engagement header, no tab bar, no "← RACMs" link. A Process-Hub-style
 * breadcrumb carries the context (which engagement, which tab, which matrix)
 * and every step back up. The RACM landing, being a tab root, keeps its header.
 */
test('RACM matrix drops the engagement header for a breadcrumb', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(800);

  // the RACM landing is a tab root — engagement header and tabs still stand
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();
  await expect(page.getByText('Procure to Pay — RACM')).toBeVisible();

  // …and it lists RACMs as register-table rows, keeping every card fact:
  // status pill, risk/control counts, review meter label, editor action.
  // No "Open RACM" affordance — clicking the row itself opens the matrix.
  await expect(page.getByRole('columnheader', { name: 'Pre-testing review' })).toBeVisible();
  const row = page.getByRole('button', { name: 'Open Procure to Pay RACM' });
  await expect(row.getByText('Exceptions')).toBeVisible();
  await expect(row.getByText('v1.0')).toBeVisible();
  await expect(row.getByText('3/7 approved')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Open spreadsheet editor in a new tab' })).toBeVisible();
  await expect(page.getByText('Open RACM', { exact: true })).toHaveCount(0);

  // a RACM is per-process, so Upload lives INSIDE the drilled matrix, not here
  await expect(page.getByRole('button', { name: /Upload RACM \/ SOP/ })).toHaveCount(0);

  // drill into one process's matrix
  await page.getByRole('button', { name: 'Open Procure to Pay RACM' }).click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('heading', { name: /Procure to Pay — Risk & Control Matrix/ })).toBeVisible();

  // matrix toolbar: search + Status filter left; Upload (process-scoped) + Bulk test + editor right
  await expect(page.getByPlaceholder('Search risks, controls, owners…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter by review status' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bulk test all/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open spreadsheet editor in a new tab' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Upload RACM \/ SOP/ })).toBeVisible();

  // the table must fit its container at desktop width — no horizontal overflow
  // (overflowing columns silently clip the row-action buttons at the right edge)
  await page.setViewportSize({ width: 1512, height: 900 });
  const overflow = await page.locator('.reg-wrap').first().evaluate(el => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // column filters on Nature / Design / Operating; the legend row is gone —
  // the ✓ / ✗ marks carry hover tooltips instead
  await expect(page.getByRole('button', { name: 'Filter Nature' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter Design' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filter Operating' })).toBeVisible();
  await expect(page.getByText('(the test sequence)')).toHaveCount(0);
  await expect(page.locator('span[title^="Design — "]').first()).toBeVisible();
  await expect(page.locator('span[title^="Operating — "]').first()).toBeVisible();

  // the Status dropdown actually filters: Pending (1) narrows to one row
  await page.getByRole('button', { name: 'Filter by review status' }).click();
  await page.getByRole('option', { name: 'Pending (1)' }).click();
  await expect(page.getByText('Showing 1 of 7 rows')).toBeVisible();
  await page.getByRole('button', { name: 'Filter by review status' }).click();
  await page.getByRole('option', { name: 'All (7)' }).click();
  await expect(page.getByText('Showing 7 of 7 rows')).toBeVisible();

  // a column filter actually filters: Design = Ineffective narrows the table
  // (ColumnFilter menu rows are plain buttons, and the menu closes on Escape)
  await page.getByRole('button', { name: 'Filter Design' }).click();
  await page.getByRole('button', { name: 'Ineffective', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Showing 1 of 7 rows')).toBeVisible();
  await page.getByRole('button', { name: 'Filter Design' }).click();
  await page.getByRole('button', { name: 'Ineffective', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Showing 7 of 7 rows')).toBeVisible();

  // the breadcrumb is the page's only nav — every step back up is on it
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs).toBeVisible();
  await expect(crumbs.getByRole('button', { name: 'Engagements' })).toBeVisible();
  await expect(crumbs.getByRole('button', { name: 'FY26 ICFR — Airline P2P & O2C' })).toBeVisible();
  await expect(crumbs.getByRole('button', { name: 'RACM' })).toBeVisible();
  await expect(crumbs.getByText('Procure to Pay', { exact: true })).toBeVisible();

  // …and the old chrome is gone: no engagement header, no tab bar, no back link
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'FY26 ICFR — Airline P2P & O2C' })).toHaveCount(0);
  await expect(page.getByText('Viewing as')).toHaveCount(0);
  // scoped to the SOX workspace — the platform sidebar has its own "Risk Register" nav item
  await expect(page.locator('.sox-book-ui').getByRole('button', { name: 'Risk Register', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'RACMs', exact: true })).toHaveCount(0);

  // the standalone back ARROW goes one level up — to the RACM listing
  await crumbs.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Procure to Pay — RACM')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();

  // the RACM crumb walks back up to the landing too, header and tabs restored
  await page.getByRole('button', { name: 'Open Procure to Pay RACM' }).click();
  await page.waitForTimeout(700);
  await crumbs.getByRole('button', { name: 'RACM' }).click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Procure to Pay — RACM')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Engagements' })).toBeVisible();

  // the engagement crumb lands on the engagement's Overview tab
  await page.getByRole('button', { name: 'Open Procure to Pay RACM' }).click();
  await page.waitForTimeout(700);
  await crumbs.getByRole('button', { name: 'FY26 ICFR — Airline P2P & O2C' }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Engagement sign-off')).toBeVisible();
});

// R4 — the tickmark legend is visible on the drilled matrix, not hover-only
import { test as t2, expect as e2 } from './_helpers';
t2('matrix shows the tickmark legend', async ({ page }) => {
  t2.setTimeout(90_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.locator('.sox-book-ui').getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Open Procure to Pay RACM/ }).click();
  await page.waitForTimeout(1000);
  await e2(page.getByText('Design → Operating is the test order')).toBeVisible();
});
