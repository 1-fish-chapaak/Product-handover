import { test, expect } from './_helpers';

/**
 * Phase 2 — review notes, the formal channel: the reviewer raises, the auditor
 * resolves with a response, the reviewer verifies & closes. A note that isn't
 * Closed blocks the paper's countersign; the role gates are the four-eyes.
 */

const openSox = async (page: import('./_helpers').Page) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
};

const openControlAs = async (page: import('./_helpers').Page, id: string) => {
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Control Library', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder(/Search controls/).fill(id);
  await page.waitForTimeout(500);
  await page.locator('.ac-card').first().click();
  await page.waitForTimeout(700);
};

test('a pending note blocks the countersign until resolved and verified', async ({ page }) => {
  test.setTimeout(180_000);
  await openSox(page);

  // reviewer: the queue flags the note on P-04, and the gate holds the countersign
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  const flagged = page.locator('button', { hasText: 'countersign or return' }).filter({ hasText: 'review note' }).first();
  await expect(flagged).toBeVisible();
  await flagged.click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('button', { name: /Countersign & sign off/ })).toBeDisabled();
  // the note sits in the Notes rail as Open; the reviewer has no resolve pen
  await page.getByRole('button', { name: /^Notes/ }).click();
  await expect(page.getByText(/variant list behind D2/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolve with response' })).toHaveCount(0);

  // auditor: resolves the note with a response (and has no verify pen)
  // (the persona is fixed inside the dossier — step back to the engagement to switch hats)
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(600);
  await openControlAs(page, 'P2P-C-04');
  await page.getByRole('button', { name: /^Notes/ }).click();
  await expect(page.getByRole('button', { name: 'Verify & close' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resolve with response' }).click();
  await page.getByPlaceholder(/What was done about this/).fill('Variant list attached behind D2 — all four posted duplicates traced.');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('Awaiting verification').first()).toBeVisible();

  // reviewer: the resolved note appears in the queue for verification
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: 'Verify resolution' }).filter({ hasText: 'variant' }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Notes/ }).click();
  await page.getByRole('button', { name: 'Verify & close' }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/Verified & closed/).first()).toBeVisible();

  // with the note closed, the countersign unlocks and the paper turns final
  const counter = page.getByRole('button', { name: /Countersign & sign off/ });
  await expect(counter).toBeEnabled();
  await counter.click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Concluded & countersigned — this paper is final.')).toBeVisible();
});

test('reviewer raises a note on a paper; the auditor court follows it', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  // raise a fresh note on a clean queue paper
  await page.locator('button', { hasText: 'countersign or return' }).filter({ hasNotText: 'review note' }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Notes/ }).click();
  await page.getByPlaceholder(/Raise a review note/).fill('Sampling basis does not name the population source system.');
  await page.getByRole('button', { name: 'Raise review note' }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText('Sampling basis does not name the population source system.')).toBeVisible();
  // the open note flips the countersign off and hands the court to the auditor
  await expect(page.getByRole('button', { name: /Countersign & sign off/ })).toBeDisabled();
  await expect(page.locator('.leadsheet').getByText('Auditor', { exact: true })).toBeVisible();
});
