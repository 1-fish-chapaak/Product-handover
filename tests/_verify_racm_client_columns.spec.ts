import { test, expect } from './_helpers';
import type { Page } from '@playwright/test';

/**
 * RACM Management, stage 4 (23 Sep) — the client's own columns (feedback #2/#3).
 *
 * A column this client's matrix has and ours does not is now a defined thing,
 * not a remembered header: it can be renamed, told what it holds (text, number,
 * date, yes/no, or one of a list) and made required. What the file calls it is
 * the match key and never changes, so a rename can't stop the column being
 * found. A required one holds a row at Review until it is filled.
 *
 * #3 needed nothing new: the tool suggests columns from an uploaded file and
 * the user overrides them, which is how the Config tab already worked. The
 * user declined a starter set for a client with no file yet.
 */

const csv = (rows: string[][]) => Buffer.from(rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'));

const HEAD = ['Risk title', 'Risk description', 'Risk category', 'Control title', 'Control description', 'Control type', 'Control nature', 'Frequency', 'Control owner', 'Risk owner', 'Assertions', 'Attributes', 'TOD checks'];
const row = () => [
  'Wrong payee', 'Payments are made to the wrong bank account', 'Financial', 'Bank details are verified',
  'The finance manager verifies bank details against the signed mandate before release, monthly.',
  'Preventive', 'Manual', 'Monthly', 'R. Khanna', 'A. Mehta', 'Accuracy', 'Verification is evidenced', 'Mandate is on file',
];

async function openConfig(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'RACM', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'RACM', exact: true })).toBeVisible({ timeout: 8000 });
  await page.getByRole('tab', { name: /Config/ }).click();
}

async function startUpload(page: Page, name: string, rows: string[][]) {
  await page.getByRole('button', { name: /Create RACM/ }).first().click();
  const entity = page.locator('#create-racm-entity');
  await expect(entity).toBeVisible();
  const entityValue = await entity.locator('option').nth(1).getAttribute('value');
  await entity.selectOption(entityValue!);
  const proc = page.locator('#create-racm-process');
  const procValue = await proc.locator('option').nth(1).getAttribute('value');
  await proc.selectOption(procValue!);
  await page.locator('input[aria-label="Upload a RACM workbook"]').setInputFiles({ name, mimeType: 'text/csv', buffer: csv(rows) });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
});

test('a client column can be added, renamed, defined and required', async ({ page }) => {
  test.setTimeout(120_000);
  await openConfig(page);

  // Add it under the file's own spelling.
  await page.getByLabel('Heading of a column to keep').fill('SOX Cycle Ref');
  await page.getByRole('button', { name: /Keep it/ }).click();
  const name = page.getByLabel('What to call the column "SOX Cycle Ref"');
  await expect(name).toHaveValue('SOX Cycle Ref');

  // It starts as plain text that nothing insists on — all the name told us.
  await expect(page.getByRole('button', { name: 'What "SOX Cycle Ref" holds' })).toHaveText(/Text/);
  const required = page.getByRole('switch', { name: /Required/ }).last();
  await expect(required).toHaveAttribute('aria-checked', 'false');

  // Rename for the screen; the file's spelling stays underneath as the match key.
  await name.fill('SOX cycle');
  await name.blur();
  await expect(page.getByText('SOX Cycle Ref in the file')).toBeVisible();

  // Say what it holds, and the choices come with it.
  await page.getByRole('button', { name: 'What "SOX cycle" holds' }).click();
  await page.getByRole('option', { name: 'One of a list' }).click();
  const choices = page.getByLabel('The values "SOX cycle" may hold');
  await expect(choices).toBeVisible();
  await choices.fill('Q1, Q2, Q3, Q4');
  await choices.blur();

  await required.click();
  await expect(required).toHaveAttribute('aria-checked', 'true');

  // It survives a reload, like the rest of the set-up.
  await page.reload();
  await page.getByRole('tab', { name: /Config/ }).click();
  await expect(page.getByLabel('What to call the column "SOX Cycle Ref"')).toHaveValue('SOX cycle');
  await expect(page.getByText('SOX Cycle Ref in the file')).toBeVisible();
});

test('a required client column holds a row until it is filled', async ({ page }) => {
  test.setTimeout(150_000);
  await openConfig(page);
  await page.getByLabel('Heading of a column to keep').fill('Cost centre');
  await page.getByRole('button', { name: /Keep it/ }).click();
  await page.getByRole('switch', { name: /Required/ }).last().click();

  await page.getByRole('tab', { name: /Library/ }).click();
  // The file has no Cost centre column at all, so every row waits for one.
  await startUpload(page, 'no-cost-centre.csv', [HEAD, row()]);
  await expect(page.getByText(/You'll fill at Review/).first()).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeDisabled();
  // Asked for by the name we call it, in the same list as our own blanks.
  const box = page.getByLabel('Cost centre').first();
  await expect(box).toBeVisible({ timeout: 8000 });
  await box.fill('CC-4100');
  await box.blur();
  await expect(importBtn).toBeEnabled({ timeout: 8000 });
});

test("a client column shows on the matrix once it is set up", async ({ page }) => {
  test.setTimeout(150_000);
  await openConfig(page);
  await page.getByLabel('Heading of a column to keep').fill('COSO ref');
  await page.getByRole('button', { name: /Keep it/ }).click();

  await page.getByRole('tab', { name: /Library/ }).click();
  await startUpload(page, 'with-coso.csv', [[...HEAD, 'COSO ref'], [...row(), 'CC3.2']]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const importBtn = page.getByRole('button', { name: /^Import \d+ control/ });
  await expect(importBtn).toBeEnabled({ timeout: 8000 });
  await importBtn.click();
  await expect(page.getByText(/imported for/).first()).toBeVisible({ timeout: 8000 });
});
