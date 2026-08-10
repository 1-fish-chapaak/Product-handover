import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * What a lock is supposed to look like, and what the owner is not supposed to see.
 *
 *  · A concluded control is frozen for everyone. The store always refused to
 *    write to one; the design and TOE sections carried no lock term, so they went
 *    on rendering pens that landed nowhere. Absent, not dead.
 *  · Reopening keeps its reason on the paper, not only in the history rail.
 *  · The owner supplies the file; how much of it is being drawn, and how far its
 *    IPE checks have got, is the auditor's read.
 *  · The deficiency register names the person holding each finding.
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

async function openControl(page: Page, description: string) {
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText(description).first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) {
    await runCard.first().click();
    await page.waitForTimeout(1400);
  }
}

test('a concluded control carries no pens, and reopening says why', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page);
  // A concluded control: the payments control was tested and signed.
  await openControl(page, 'Payment runs approved by two authorisers.');

  // Frozen everywhere, not only where the store happened to guard it.
  await expect(page.getByRole('button', { name: /^Reopen$/ }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Conclude/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add attribute' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Test all/ })).toHaveCount(0);

  // The way back in keeps its reason where the work restarts.
  await page.getByRole('button', { name: /^Reopen$/ }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.modal textarea, .modal input[type="text"]').first()
    .fill('A second authoriser was added to the June run after the paper was signed.');
  await page.locator('.modal').getByRole('button', { name: /Reopen/ }).last().click();
  await page.waitForTimeout(1000);

  await expect(page.getByText('Reopened by the auditor').first()).toBeVisible();
  await expect(page.getByText(/A second authoriser was added to the June run/).first()).toBeVisible();
});

test('the owner sees the files, never how much of them is being drawn', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page);
  await openControl(page, 'FX deals confirmed independently of dealing.');

  // The auditor's read of the same rows.
  await expect(page.getByText(/checks proven|not registered yet/).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(1200);
  await openControl(page, 'FX deals confirmed independently of dealing.');

  // Their own file rows, without the testing read on them.
  await expect(page.getByText('Source files', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/checks proven/)).toHaveCount(0);
  await expect(page.getByText(/\d+ sampled/)).toHaveCount(0);
});

test('the deficiency register names who holds each finding', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaAudit(page);
  await page.getByRole('main').getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(1000);

  // The filter still offers roles — you filter by lane…
  await expect(page.getByRole('button', { name: 'Filter by court' }).first()).toBeVisible({ timeout: 15_000 });
  // …and you read by name. DEF-A-02 sits at Rating review, so the reviewer holds
  // it, and the column says which human that is rather than "Reviewer".
  await expect(page.getByRole('main').getByText('J. Fernandes').first()).toBeVisible();
  await expect(page.getByRole('main').getByText('A. Mehta').first()).toBeVisible();
});
