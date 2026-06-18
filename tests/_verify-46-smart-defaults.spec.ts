import { test, expect } from './_helpers';

// Verify PRD §4.6 in the live app: type-pick pre-fill, coverage line, soft-warn
// chips, and the skippable hard block. Uses the config baseURL (override with
// PW_BASE_URL when the dev server lands on a different port).
if (process.env.PW_BASE_URL) test.use({ baseURL: process.env.PW_BASE_URL });

async function openNewTemplate(page: import('./_helpers').Page) {
  await page.goto('/?view=reports&tab=templates');
  const newBtn = page.getByRole('button', { name: /New template/ });
  await newBtn.waitFor({ state: 'visible', timeout: 15000 });
  await newBtn.click();
  await expect(page.getByRole('heading', { name: 'Create template' })).toBeVisible();
}

test('SOX: pre-fill, coverage, soft-warn, skippable block', async ({ page }) => {
  await openNewTemplate(page);

  // Pick SOX → standard sections pre-fill, coverage reads all-present.
  await page.getByRole('combobox').selectOption('SOX');
  await page.waitForTimeout(300);
  await expect(page.getByRole('heading', { name: 'Control Testing Results' })).toBeVisible();
  await expect(page.getByText('SOX coverage')).toBeVisible();
  await expect(page.getByText(/3 of 3 required/)).toBeVisible();
  await expect(page.getByText(/5 of 5 recommended/)).toBeVisible();
  await expect(page.getByText(/All standard SOX sections present/)).toBeVisible();
  await page.screenshot({ path: '/tmp/46-sox-prefill.png', fullPage: false });

  // Delete the required (anchor) section → coverage drops, a red chip appears.
  await page.getByRole('button', { name: 'Delete Control Testing Results' }).click({ force: true });
  await page.waitForTimeout(250);
  await expect(page.getByText(/2 of 3 required/)).toBeVisible();
  await expect(page.getByText(/Add 1 missing/)).toBeVisible();
  await page.screenshot({ path: '/tmp/46-sox-missing.png', fullPage: false });

  // Save → skippable confirm, not a wall.
  await page.getByRole('button', { name: 'Create template' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('Save without this section?')).toBeVisible();
  await expect(page.getByText(/usually includes .*Control Testing Results/)).toBeVisible();
  await page.screenshot({ path: '/tmp/46-confirm.png', fullPage: false });

  // Confirm path proceeds (saves anyway).
  await page.getByRole('button', { name: 'Save anyway' }).click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('heading', { name: 'Create template' })).toBeHidden();
});

test('Add-missing restores coverage to green', async ({ page }) => {
  await openNewTemplate(page);
  await page.getByRole('combobox').selectOption('SOX');
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Delete Control Testing Results' }).click({ force: true });
  await page.waitForTimeout(200);
  await expect(page.getByText(/2 of 3 required/)).toBeVisible();
  await page.getByRole('button', { name: /Add 1 missing/ }).click();
  await page.waitForTimeout(250);
  await expect(page.getByText(/3 of 3 required/)).toBeVisible();
  await expect(page.getByText(/All standard SOX sections present/)).toBeVisible();
});

test('seed approved-format template appears and drives the verdict', async ({ page }) => {
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(700);
  // Layout-agnostic (templates render as cards or a list depending on width).
  await expect(page.getByText('Annual Safety Audit Report').first()).toBeVisible();
  await expect(page.getByText(/Approved/).first()).toBeVisible();
  await page.screenshot({ path: '/tmp/46-seed-card.png', fullPage: false });

  // Shield action → format-check mode.
  await page.getByRole('button', { name: /Check a file against the Annual Safety Audit Report reference format/ }).click({ force: true });
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'q3-audit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(page.getByText(/Drifted from the Annual Safety Audit Report format/)).toBeVisible({ timeout: 12000 });
  await expect(page.getByText(/Corrective Actions/).first()).toBeVisible();
  await page.screenshot({ path: '/tmp/46-verdict.png', fullPage: false });
});

test('editing an existing template suggests recommended sections, never flags required (§4.6 gating)', async ({ page }) => {
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(700);
  // The seeded Annual Safety Audit is an existing custom template (type Audit),
  // standing in for any uploaded/real format.
  await page.getByRole('button', { name: 'Edit template Annual Safety Audit Report' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Edit template' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveValue('Audit');

  // Recommended suggestions ARE offered (optional), but the required "coverage"
  // audit and its red 🔒 chips are NOT — the user's own format is authoritative.
  await expect(page.getByText('Recommended for Audit')).toBeVisible();
  await expect(page.getByText(/Suggests standard Audit sections you can optionally add/)).toBeVisible();
  await expect(page.getByText('Audit coverage')).toBeHidden();
  await expect(page.getByText('Conclusion / Audit Opinion')).toBeHidden();
  await page.screenshot({ path: '/tmp/46-existing-recommended.png', fullPage: false });

  // Save proceeds with no missing-required confirm, even though the generic Audit
  // map would otherwise flag "Conclusion / Audit Opinion".
  await page.getByRole('button', { name: /Save Template/ }).click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Save without this section?')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Edit template' })).toBeHidden();
});

test('upload: a fragment can be merged into its neighbour', async ({ page }) => {
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Upload template/ }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'audit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(page.getByRole('heading', { name: 'Review detected sections' })).toBeVisible({ timeout: 12000 });

  // The "Possible fragment" row exposes merge actions — the fix the red badge
  // otherwise lacks.
  await expect(page.getByText('Possible fragment')).toBeVisible();
  const mergeUp = page.getByRole('button', { name: 'Merge up' });
  await expect(mergeUp).toBeVisible();
  await mergeUp.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/tmp/46-merge.png', fullPage: false });

  // Merge folds the fragment away; the toast confirms and the fragment is gone.
  await mergeUp.click();
  await page.waitForTimeout(300);
  await expect(page.getByText(/Merged/)).toBeVisible();
  await expect(page.getByText('Possible fragment')).toBeHidden();

  // Undo restores it.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('Possible fragment')).toBeVisible();
});

test('Other has no pre-fill; ATR pre-fills its own sections', async ({ page }) => {
  await openNewTemplate(page);
  await page.getByRole('combobox').selectOption('Other');
  await page.waitForTimeout(200);
  await expect(page.getByText(/limited format checking/)).toBeVisible();
  await expect(page.getByText('Other coverage')).toBeHidden();
  // ATR now carries its own required/recommended set.
  await page.getByRole('combobox').selectOption('ATR');
  await page.waitForTimeout(250);
  await expect(page.getByText('ATR coverage')).toBeVisible();
  await expect(page.getByText(/All standard ATR sections present/)).toBeVisible();
});

test('upload: switching the report type surfaces that type required sections', async ({ page }) => {
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Upload template/ }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'audit.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test'),
  });
  await expect(page.getByRole('heading', { name: 'Review detected sections' })).toBeVisible({ timeout: 12000 });

  // Switch the type to ATR → the panel shows ATR's expected sections, with the
  // ones the document is missing offered as clickable add-chips.
  await page.getByRole('combobox').selectOption('ATR');
  await page.waitForTimeout(250);
  await expect(page.getByText('ATR sections')).toBeVisible();
  const missingChip = page.getByRole('button', { name: /Closure \/ Classification Status/ });
  await expect(missingChip).toBeVisible();
  await page.screenshot({ path: '/tmp/46-upload-atr.png', fullPage: false });

  // Clicking a missing one adds it to the template (marked "Added for type").
  await missingChip.click();
  await page.waitForTimeout(200);
  await expect(page.getByText('Added for type').first()).toBeVisible();
});
