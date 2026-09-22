import { test, expect } from './_helpers';
import type { Page } from '@playwright/test';
import { openFromLibrary } from './_sox_helpers';

/**
 * RACM Management, stage A (22 Sep) — the locked required list.
 *
 * Every imported control ends up with: risk ID, control ID, risk title, risk
 * description, control title, control description, nature, type, frequency,
 * control owner, risk owner (new), design checks, attributes and assertions —
 * whatever the first file carried or the Config tab says. A file without one of
 * those columns still uploads: Ira fills what she can read, IDs are built, the
 * rest is filled at Review (Risk owner once for every row). The one hard stop
 * is a file with neither a control title nor a description column.
 *
 * Also the bug that started this stage: a first upload without a Frequency
 * column used to drop Frequency from the required list, so later uploads let
 * rows with no frequency through. It must stay required.
 */

const csv = (rows: string[][]) => Buffer.from(rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'));

async function openRacmPage(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'RACM', exact: true })).toBeVisible({ timeout: 8000 });
}

async function startUpload(page: Page, name: string, rows: string[][]) {
  await page.getByRole('button', { name: /Create RACM/ }).first().click();
  const entity = page.locator('#create-racm-entity');
  await expect(entity).toBeVisible();
  // Any real company and process will do — the columns are what's under test.
  const entityValue = await entity.locator('option').nth(1).getAttribute('value');
  await entity.selectOption(entityValue!);
  const proc = page.locator('#create-racm-process');
  const procValue = await proc.locator('option').nth(1).getAttribute('value');
  await proc.selectOption(procValue!);
  await page.locator('input[aria-label="Upload a RACM workbook"]').setInputFiles({ name, mimeType: 'text/csv', buffer: csv(rows) });
}

/** Clear every fill-in box at Review: take Ira's suggestion where she has one,
 *  pick the first option for pickers and assertions. */
async function firstVisible(page: Page, name: RegExp) {
  for (const b of await page.getByRole('button', { name }).all()) if (await b.isVisible()) return b;
  return null;
}
async function fillHeldRows(page: Page) {
  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  for (let guard = 0; guard < 40; guard++) {
    if (await importBtn.isEnabled()) return;
    const use = await firstVisible(page, /^Use Ira's/);
    if (use) { await use.click(); await page.waitForTimeout(150); continue; }
    const assertionGroup = page.getByRole('group', { name: /^Assertions for row/ }).first();
    if (await assertionGroup.count()) {
      await assertionGroup.getByRole('button').first().click();
      await assertionGroup.getByRole('button', { name: 'Set' }).click();
      await page.waitForTimeout(150);
      continue;
    }
    const freq = page.locator('select[id^="racm-import-freq-"]').first();
    if (await freq.count()) { await freq.selectOption({ index: 1 }); await page.waitForTimeout(150); continue; }
    break;
  }
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
});

test('Config tab shows the 22 Sep list locked, Risk owner included', async ({ page }) => {
  await openRacmPage(page);
  await page.getByRole('tab', { name: /Config/ }).click();
  await expect(page.getByText('Always required', { exact: true })).toBeVisible();
  for (const label of ['Risk owner', 'Risk title', 'Control description', 'Frequency', 'Design checks (TOD)', 'Attributes', 'Assertions']) {
    const row = page.locator('div', { hasText: new RegExp(`^${label.replace(/[()]/g, '\\$&')}\\s*Always$`) }).first();
    await expect(row, `${label} is locked`).toBeVisible();
  }
  // Locked rows have no switch to turn them off.
  await expect(page.getByRole('switch', { name: /Risk owner/ })).toHaveCount(0);
});

test('A file missing most required columns still uploads — Ira drafts, Risk owner is set for all rows', async ({ page }) => {
  test.setTimeout(120_000);
  await openRacmPage(page);
  // No Risk ID, Control ID, risk description, control description, risk owner,
  // design checks, attributes or assertions columns.
  await startUpload(page, 'thin-racm.csv', [
    ['Risk title', 'Control title', 'Frequency', 'Control nature', 'Control type', 'Control owner'],
    ['Unauthorised vendor master changes', 'Vendor master changes are approved', 'Monthly', 'Manual', 'Preventive', 'AP Manager'],
    ['Payments posted to the wrong period', 'Bank reconciliation is reviewed', 'Monthly', 'Manual', 'Detective', 'Finance Controller'],
  ]);

  // ── Columns step: nothing blocks ──
  await expect(page.getByText("You'll fill at Review").first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/Ira will fill — read on \d+ of 2 rows/).first()).toBeVisible();
  const cont = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(cont).toBeEnabled();
  await cont.click();

  // ── Review: Ira's drafts are in, listed with their reasons ──
  await page.getByRole('button', { name: /Ira filled \d+ blank/ }).click();
  await expect(page.getByText('The control title, written out as what is done').first()).toBeVisible();
  await expect(page.getByText('The risk title, written out as what could go wrong').first()).toBeVisible();

  // ── Risk owner: no column, so set once for every row ──
  await expect(page.getByText(/2 rows need a risk owner/)).toBeVisible();
  await expect(page.getByText('— the file has no column for it').first()).toBeVisible();
  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeDisabled();
  await page.getByLabel('Set for all rows').fill('Priya Singh');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText(/2 rows need a risk owner/)).toHaveCount(0);

  // ── The rest of the held values, then Import ──
  await fillHeldRows(page);
  await expect(importBtn).toBeEnabled();
  await importBtn.click();
  await expect(page.getByText(/imported for/).first()).toBeVisible({ timeout: 6000 });
});

test('Frequency stays required after a first upload that had no Frequency column', async ({ page }) => {
  test.setTimeout(150_000);
  await openRacmPage(page);
  // First upload — no Frequency column, but the titles say how often.
  await startUpload(page, 'no-frequency-1.csv', [
    ['Risk title', 'Risk description', 'Risk owner', 'Control title', 'Control description', 'Control nature', 'Control type', 'Control owner', 'Assertions', 'Attributes', 'TOD checks'],
    ['Late accruals', 'Accruals are missed at period end', 'CFO', 'Monthly accrual review', 'The controller reviews accruals every month', 'Manual', 'Detective', 'Controller', 'Completeness', 'Review is evidenced', 'Reviewer is independent'],
  ]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await fillHeldRows(page);
  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeEnabled();
  await importBtn.click();
  await expect(page.getByText(/imported for/).first()).toBeVisible({ timeout: 6000 });

  // Config still holds Frequency as always required.
  await page.getByRole('tab', { name: /Config/ }).click();
  await expect(page.locator('div', { hasText: /^Frequency\s*Always$/ }).first()).toBeVisible();
  await page.getByRole('tab', { name: /Library/ }).click();

  // Second upload — no Frequency column and nothing in the row says how often.
  await startUpload(page, 'no-frequency-2.csv', [
    ['Risk title', 'Risk description', 'Risk owner', 'Control title', 'Control description', 'Control nature', 'Control type', 'Control owner', 'Assertions', 'Attributes', 'TOD checks'],
    ['Unapproved credit notes', 'Credit notes are issued without approval', 'CFO', 'Credit note approval', 'The sales head approves each credit note', 'Manual', 'Preventive', 'Sales Head', 'Occurrence', 'Approval is evidenced', 'Approver is independent'],
  ]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // The row is held for its frequency — it can't import with none.
  const freqPick = page.locator('select[id^="racm-import-freq-"]').first();
  await expect(freqPick).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole('button', { name: /^Import \d+ control/ })).toBeDisabled();
});

test('A file with neither a control title nor a description column is the one hard stop', async ({ page }) => {
  await openRacmPage(page);
  await startUpload(page, 'no-control.csv', [
    ['Risk title', 'Frequency', 'Control owner'],
    ['Unauthorised vendor master changes', 'Monthly', 'AP Manager'],
  ]);
  await expect(page.getByText('Pick a column for the control title or description to continue')).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
});

test('New control form: the whole list is required, Ira drafts from the title, Nature/Frequency/Assertions start empty', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.getByRole('main').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.getByRole('button', { name: 'New control' }).first().click();
  await expect(page.getByRole('heading', { name: 'New control' })).toBeVisible();

  // Nothing required is filled silently.
  await expect(page.getByRole('button', { name: 'Nature', exact: true })).toHaveText(/Pick a nature/);
  await expect(page.getByRole('button', { name: 'Frequency', exact: true })).toHaveText(/Pick a frequency/);
  await expect(page.getByRole('button', { name: 'Risk owner', exact: true })).toHaveText(/Same as process owner/);
  const create = page.getByRole('button', { name: 'Create control' });
  await expect(create).toBeDisabled();

  // The title (autofocused) → Ira writes the description; leaving it drafts the lists.
  await page.keyboard.type('Vendor master changes are approved');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Drafted by Ira from the title').first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByText('Drafted by Ira from the description').first()).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Design check 1$/ })).not.toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Attribute 1$/ })).not.toHaveValue('');

  // Put back clears Ira's description, and she doesn't write it again.
  await page.getByRole('button', { name: "Put back — clear Ira's control description" }).click();
  await expect(page.getByText(/Control description required/).first()).toBeVisible();
  await page.locator('textarea[aria-required="true"]').first().fill('The AP manager approves every change to vendor master data before it is saved.');

  // The rest is the auditor's call.
  await expect(page.getByText(/Control nature required/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Nature', exact: true }).click();
  await page.getByRole('option', { name: 'Manual' }).click();
  await page.getByRole('radio', { name: 'Preventive' }).click();
  await page.getByRole('button', { name: 'Frequency', exact: true }).click();
  await page.getByRole('option', { name: 'Monthly' }).click();
  await expect(create).toBeDisabled();
  await page.getByRole('button', { name: 'Accuracy', exact: true }).click();
  await expect(create).toBeEnabled();
  await create.click();
  await expect(page.getByRole('heading', { name: 'New control' })).toHaveCount(0, { timeout: 5000 });
});

test('Columns step says how many rows Ira can read, and Review says whose columns were used', async ({ page }) => {
  test.setTimeout(120_000);
  await openRacmPage(page);
  await startUpload(page, 'counts.csv', [
    ['Risk title', 'Control title', 'Control owner'],
    ['Unauthorised vendor master changes', 'Vendor master changes are approved every month', 'AP Manager'],
    ['Payments posted to the wrong period', 'Bank reconciliation is reviewed', 'Finance Controller'],
  ]);
  // Ira's amber tags carry the count she can actually read, out of the rows.
  await expect(page.getByText(/Ira will fill — read on \d+ of 2 rows/).first()).toBeVisible({ timeout: 8000 });
  // What nobody can read says so, with the number of rows waiting.
  await expect(page.getByText(/You'll fill at Review · 2 rows/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // The client group whose columns this upload lands by.
  await expect(page.getByText(/^Using .+'s columns$/)).toBeVisible();
});

test("Each client group keeps its own column set-up, and it survives a reload", async ({ page }) => {
  test.setTimeout(120_000);
  await openRacmPage(page);
  await page.getByRole('tab', { name: /Config/ }).click();
  const picker = page.getByRole('button', { name: 'Column set-up for' });
  await expect(picker).toBeVisible();
  const firstGroup = (await picker.textContent())!.split('·')[0]!.trim();

  // Switch a column on for this client group.
  const country = page.getByRole('switch', { name: 'Country' });
  await expect(country).toHaveAttribute('aria-checked', 'false');
  await country.click();
  await expect(country).toHaveAttribute('aria-checked', 'true');

  // Another group is untouched — each client's shape is its own.
  await picker.click();
  const others = page.getByRole('option').filter({ hasNotText: firstGroup });
  if (await others.count()) {
    await others.first().click();
    await expect(page.getByRole('switch', { name: 'Country' })).toHaveAttribute('aria-checked', 'false');
    await picker.click();
    await page.getByRole('option', { name: new RegExp(firstGroup) }).first().click();
  } else {
    await page.keyboard.press('Escape');
  }

  // And it is still there after a reload.
  await page.reload();
  await page.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await page.getByRole('tab', { name: /Config/ }).click();
  await expect(page.getByRole('switch', { name: 'Country' })).toHaveAttribute('aria-checked', 'true');
});

test("A column switched on for a client group holds that group's upload", async ({ page }) => {
  test.setTimeout(150_000);
  const rows = [
    ['Risk title', 'Risk description', 'Risk owner', 'Control title', 'Control description', 'Frequency', 'Control nature', 'Control type', 'Control owner', 'Assertions', 'Attributes', 'TOD checks'],
    ['Unapproved credit notes', 'Credit notes are issued without approval', 'CFO', 'Credit note approval', 'The sales head approves each credit note', 'Monthly', 'Manual', 'Preventive', 'Sales Head', 'Occurrence', 'Approval is evidenced', 'Approver is independent'],
  ];
  await openRacmPage(page);
  // Which group the chosen company belongs to — the upload says so itself.
  await startUpload(page, 'group-1.csv', rows);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const used = (await page.getByText(/^Using .+'s columns$/).textContent())!;
  const group = used.replace(/^Using /, '').replace(/'s columns$/, '');
  await page.getByRole('button', { name: 'Close' }).first().click();

  // Country is not in the file. Switched on for that group, it holds the row.
  await page.getByRole('tab', { name: /Config/ }).click();
  const picker = page.getByRole('button', { name: 'Column set-up for' });
  await picker.click();
  await page.getByRole('option', { name: new RegExp(group) }).first().click();
  await page.getByRole('switch', { name: 'Country' }).click();
  await page.getByRole('tab', { name: /Library/ }).click();

  await startUpload(page, 'group-2.csv', rows);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Country', { exact: true }).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole('button', { name: /^Import \d+ control/ })).toBeDisabled();
  // Filling it in lets the row through.
  await page.getByRole('textbox', { name: /^Country$/ }).fill('India');
  await page.getByRole('textbox', { name: /^Country$/ }).blur();
  await expect(page.getByRole('button', { name: /^Import \d+ control/ })).toBeEnabled({ timeout: 6000 });
});
