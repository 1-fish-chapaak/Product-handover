import { test, expect } from './_helpers';

/**
 * Phase 1 — the review gate on controls (D1 + D2):
 * the auditor tests, the owner attests & uploads, and a concluded paper travels
 * preparer-sign → reviewer countersign (or return-with-note) before it is final.
 */

/** The engagement, then INTO the audit — see the note in _sox-guardrails. The
 *  reviewer queue, the control dossier and the sign-off gate all live one level
 *  deeper than they did when this spec was written; at the engagement root a
 *  control opens as the library detail page, which has no testing lane at all. */
const openSox = async (page: import('./_helpers').Page) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^Open FY 20/ }).first().click();
  await page.waitForTimeout(1200);
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
  // ReviewerGate's banner was replaced by step 5 Sign-off's right-rail state.
  await expect(page.getByText('Awaiting countersign').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conclude effective' })).toHaveCount(0);
  // countersign — the paper turns final
  await page.getByRole('button', { name: 'Countersign', exact: true }).first().click();
  await page.waitForTimeout(500);
  // LockBanner's sentence, now carried by the sign-off step itself.
  await expect(page.getByText(/Working paper locked/).first()).toBeVisible();
});

// The reviewer's return-with-note UI was built in 9402d19, lost in the merges
// that followed, and restored Aug 2026 — the store's returnControl had been
// doing the whole job the entire time with nothing to call it.
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
  // twice, and both are right: the banner carries it to the auditor, and the
  // execution trail carries it to whoever reads the paper later
  await expect(page.getByText(/Sampling basis is thin/).first()).toBeVisible();
  await expect(page.getByText(/Sampling basis is thin/)).toHaveCount(2);
  // the paper is open again, so nothing reads as locked
  await expect(page.getByText(/Working paper locked/)).toHaveCount(0);
});

test('risk owner keeps the evidence lanes but loses the testing pen', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  // person-lane: P2P-C-02 belongs to S. Iyer — wear that persona first
  await page.getByRole('button', { name: 'Owner persona' }).click();
  await page.getByRole('menuitemradio', { name: 'S. Iyer' }).click();
  await page.waitForTimeout(400);
  // open a specific in-progress control (P2P-C-02: design effective, TOE open)
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder(/Search controls/).fill('P2P-C-02');
  await page.waitForTimeout(500);
  // Table layout is the default now — the card grid is behind the Grid view toggle.
  await page.getByRole('button', { name: /^Open P2P-C-02/ }).first().click();
  await page.waitForTimeout(700);
  // testing pens are absent — not disabled, absent
  await expect(page.getByRole('button', { name: 'Conclude effective' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Test attributes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Validate all/ })).toHaveCount(0);
  // Self-attestation went with steps 2-5: those carry sample results and
  // attribute outcomes, which the first line must not read, so the whole TOE
  // lane is absent for the owner rather than partially redacted.
  await expect(page.locator('[aria-label="Toggle self-attestation"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Attach evidence' }).first()).toBeVisible();
});

test('engagement sign-off gates on countersigned papers', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  // auditor's overview — the gate copy and the two-count readiness line
  // (sign-off now lives inside the year-end box; the gate copy is its explainer)
  await expect(page.getByText(/reviewer countersigns to conclude/).first()).toBeVisible();
  await expect(page.getByText(/concluded · \d+\/\d+ countersigned/).first()).toBeVisible();
  // awaiting-review work is visible on the progress rail
  await expect(page.getByText('Awaiting review', { exact: true })).toBeVisible();
});
