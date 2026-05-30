import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ─── Knowledge Hub upload edge cases ─────────────────────────────────────────
// Drives the kh-add upload picker with files that exercise every rejection
// path: empty, oversized, password-protected/corrupt, wrong type, duplicate —
// plus closing the modal mid-upload (timer cleanup).

async function openUploadPicker(page: Page) {
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Knowledge Hub' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Add source' }).first().click();
  await expect(page.getByText('Add data source')).toBeVisible();
  return page.getByRole('dialog').locator('input[accept=".pdf,.csv,.xlsx"]').first();
}

// A minimal, valid PDF — pdf.js parses it without a password.
const VALID_PDF =
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
  'trailer<</Root 1 0 R>>\n%%EOF';

// Write fixtures to a temp dir and pass paths (the empty file can't be an
// inline 0-byte buffer reliably across runners).
const dir = mkdtempSync(join(tmpdir(), 'kh-upload-'));
function fixture(name: string, data: Buffer | string): string {
  const p = join(dir, name);
  writeFileSync(p, data);
  return p;
}
const EMPTY    = fixture('empty.csv', Buffer.alloc(0));
const CORRUPT_CSV = fixture('corrupt.csv', Buffer.from([0x48, 0x00, 0x49, 0x00])); // NUL bytes
const CORRUPT_PDF = fixture('corrupt.pdf', 'not really a pdf at all');
const CLEAN    = fixture('clean.csv', 'id,amount\n1,100\n2,250\n');
// Big files must upload, not error. ~80 MB CSV + ~35 MB "PDF" (above the deep-
// validate threshold, so the parse is skipped and the file is accepted).
const BIG_CSV  = fixture('big_ledger.csv', Buffer.concat([Buffer.from('id,amount\n'), Buffer.alloc(80 * 1024 * 1024, 0x41)]));
const BIG_PDF  = fixture('big_scan.pdf', Buffer.alloc(35 * 1024 * 1024, 0x42));

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test('U1: validation matrix — empty / corrupt rejected, good file goes Ready', async ({ page }) => {
  const input = await openUploadPicker(page);
  await input.setInputFiles([EMPTY, CORRUPT_CSV, CORRUPT_PDF, CLEAN]);

  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('File is empty')).toBeVisible({ timeout: 10000 });
  await expect(dlg.getByText('File appears corrupted')).toHaveCount(2); // corrupt.csv + corrupt.pdf
  await expect(dlg.getByText(/^Failed$/).first()).toBeVisible();
  await expect(dlg.getByText('clean.csv')).toBeVisible();
  await expect(dlg.getByText(/^Ready$/)).toBeVisible({ timeout: 10000 });
});

test('U2: unsupported type is skipped with feedback; duplicate is skipped', async ({ page }) => {
  const input = await openUploadPicker(page);
  await input.setInputFiles([
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    { name: 'report.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') },
  ]);
  await expect(page.getByText(/skipped — only PDF, CSV, XLSX/)).toBeVisible({ timeout: 5000 });
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('photo.png')).toHaveCount(0);
  await expect(dlg.getByText('report.csv')).toBeVisible();
  await expect(dlg.getByText(/^Ready$/)).toBeVisible({ timeout: 10000 });

  await input.setInputFiles([{ name: 'report.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') }]);
  await expect(page.getByText(/duplicate file.*skipped/)).toBeVisible({ timeout: 5000 });
  await expect(dlg.getByText('report.csv')).toHaveCount(1);
});

test('U4: big files upload without error (no size limit)', async ({ page }) => {
  const input = await openUploadPicker(page);
  await input.setInputFiles([BIG_CSV, BIG_PDF]);
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('big_ledger.csv')).toBeVisible();
  await expect(dlg.getByText('big_scan.pdf')).toBeVisible();
  // Both reach Ready; neither shows a failure.
  await expect(dlg.getByText(/^Ready$/)).toHaveCount(2, { timeout: 15000 });
  await expect(dlg.getByText(/^Failed$/)).toHaveCount(0);
  await expect(dlg.getByText(/Too large|Could not read/)).toHaveCount(0);
});

test('U3: closing the modal mid-upload does not error (timers cleaned up)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const input = await openUploadPicker(page);
  await input.setInputFiles([
    { name: 'inflight.csv', mimeType: 'text/csv', buffer: Buffer.from('x\n' + '1\n'.repeat(500)) },
    { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from(VALID_PDF, 'latin1') },
  ]);
  // Close while still validating/uploading, via the picker's Close button.
  await page.getByRole('button', { name: 'Close picker' }).click();
  await expect(page.getByText('Add data source')).toHaveCount(0);
  await page.waitForTimeout(2000); // let any leaked interval fire
  expect(errors, errors.join('\n')).toHaveLength(0);
  // Reopening starts clean (no carry-over rows).
  await page.getByRole('button', { name: 'Add source' }).first().click();
  await expect(page.getByText('Add data source')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('inflight.csv')).toHaveCount(0);
});
