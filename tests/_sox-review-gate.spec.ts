import { test, expect } from './_helpers';

/**
 * Phase 1 — the review gate on controls (D1 + D2):
 * the auditor tests, the owner attests & uploads, and a concluded paper travels
 * preparer-sign → reviewer countersign (or return-with-note) before it is final.
 */

const openSox = async (page: import('./_helpers').Page) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
};

test('reviewer queue lists concluded papers; countersign makes them final', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  // the queue now carries concluded, preparer-signed papers — pick one without
  // pending review notes (those hold the countersign; see _sox-review-notes.spec)
  await expect(page.getByText('Reviewer queue')).toBeVisible();
  const paperRow = page.locator('button', { hasText: 'countersign or return' }).filter({ hasNotText: 'review note' }).first();
  await expect(paperRow).toBeVisible();
  // open the paper — the reviewer gate offers countersign / return; no test pens
  await paperRow.click();
  await page.waitForTimeout(700);
  await expect(page.getByText(/In your court — concluded, signed by/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conclude effective' })).toHaveCount(0);
  // countersign — the paper turns final
  await page.getByRole('button', { name: /Countersign & sign off/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Concluded & countersigned — this paper is final.')).toBeVisible();
});

test('return-with-note clears conclusions and lands the note on the dossier', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: 'countersign or return' }).filter({ hasNotText: 'review note' }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Return to auditor' }).click();
  await page.getByPlaceholder(/What needs rework/).fill('Sampling basis is thin — extend to the handbook size.');
  await page.getByRole('button', { name: 'Return', exact: true }).click();
  await page.waitForTimeout(600);
  // conclusions cleared; the reviewer's note rides on the reopened dossier
  await expect(page.getByText(/Returned by the reviewer/)).toBeVisible();
  await expect(page.getByText('Concluded & countersigned — this paper is final.')).toHaveCount(0);
});

test('risk owner keeps the evidence lanes but loses the testing pen', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  // open a specific in-progress control (P2P-C-02: design effective, TOE open)
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder(/Search controls/).fill('P2P-C-02');
  await page.waitForTimeout(500);
  await page.locator('.ac-card').first().click();
  await page.waitForTimeout(700);
  // testing pens are absent — not disabled, absent
  await expect(page.getByRole('button', { name: 'Conclude effective' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Test attributes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Validate all/ })).toHaveCount(0);
  // ...but the owner's evidence lanes stay: self-attestation + evidence upload
  await expect(page.locator('[aria-label="Toggle self-attestation"]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attach evidence' }).first()).toBeVisible();
});

test('engagement sign-off gates on countersigned papers', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  // auditor's overview — the gate copy and the two-count readiness line
  await expect(page.getByText(/countersigned by the reviewer/).first()).toBeVisible();
  await expect(page.getByText(/concluded · \d+\/\d+ countersigned/).first()).toBeVisible();
  // awaiting-review work is visible on the progress rail
  await expect(page.getByText('Awaiting review', { exact: true })).toBeVisible();
});
