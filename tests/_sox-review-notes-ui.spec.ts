import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The reviewer's challenge, end to end.
 *
 * The store has carried raise → resolve → verify since the review gate landed,
 * and the countersign has always been held while a note is open — but the rail
 * that drove it was lost in a merge. A reviewer could be blocked by a note they
 * had no way to raise, answer or close, and because Return shared the
 * countersign's gate they could not send the paper back either. Both halves are
 * pinned here.
 *
 * Each hat sees only its own move: the raiser never resolves, the resolver never
 * verifies. That IS the four-eyes on a note.
 */
type Page = import('@playwright/test').Page;

async function openAlturaAudit(page: Page) {
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(700);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(800);
  await main.getByRole('button', { name: 'Open CY 2026 audit' }).filter({ hasText: '02 Jan 2026' }).first().click();
  await page.waitForTimeout(1000);
}

/** The reviewer queue lists every paper waiting on them. Take the one the queue
 *  itself flags as carrying a note, rather than whichever sorts first. */
async function openFlaggedPaper(page: Page) {
  const row = page.getByRole('button')
    .filter({ hasText: 'countersign or return' })
    .filter({ hasText: 'review note' })
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await page.waitForTimeout(1400);
}

// "Countersign" as a substring also matches the sign-off step's own header —
// "…the reviewer countersigns it…" — so the button is addressed exactly.
const countersign = (page: Page) => page.getByRole('button', { name: 'Countersign', exact: true });

test('an open note holds the countersign but never the return', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1200);
  await openFlaggedPaper(page);

  // The note the reviewer already raised is on the paper, and it is theirs to
  // read rather than answer — resolving your own challenge is not two people.
  await expect(page.getByText('Review notes').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolve with response' })).toHaveCount(0);

  // Held: the signature. Not held: the way back to the auditor.
  await expect(countersign(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Return to auditor' }).first()).toBeVisible();
  await expect(page.getByText(/must close before the countersign — you can still return the paper/).first()).toBeVisible();
});

test('the auditor answers, the reviewer verifies, and the countersign unlocks', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page);

  // Find the note's control as the reviewer, then hand it to the auditor.
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1200);
  await openFlaggedPaper(page);
  const heading = await page.getByRole('heading', { level: 1 }).first().textContent();

  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(1200);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText((heading ?? '').trim()).first().click();
  await page.waitForTimeout(1400);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }

  // The auditor answers it — and has no verify pen of their own.
  await expect(page.getByRole('button', { name: 'Verify & close' })).toHaveCount(0);
  const resolve = page.getByRole('button', { name: 'Resolve with response' }).first();
  await resolve.scrollIntoViewIfNeeded();
  await resolve.click();
  await page.getByPlaceholder(/What was done about this/).fill('Selection attached — the second-half items are listed with their draw order.');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Awaiting verification').first()).toBeVisible();

  // Back to the reviewer: verifying closes it, and the signature is free.
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1200);
  await openFlaggedPaper(page);
  const verify = page.getByRole('button', { name: 'Verify & close' }).first();
  await verify.scrollIntoViewIfNeeded();
  await verify.click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Verified & closed').first()).toBeVisible();
  await expect(countersign(page).first()).toBeVisible();
});
