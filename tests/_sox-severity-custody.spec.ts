import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * Who holds a finding, and who is allowed to move it.
 *
 * Three rules from the RBAC spec's custody ladder, all of which the code used to
 * bend:
 *  - EVERY grade passes the reviewer's rating check, not only Significant
 *    Deficiency and worse. Calling a finding small is a judgement too.
 *  - A confirmed rating that MOVES loses its confirmation whichever way it moved
 *    — a material weakness cannot be quietly walked down past the reviewer with
 *    their stamp still on it.
 *  - Reopening a closed finding belongs to the reviewer alone: they signed it
 *    closed, so undoing that signature is theirs.
 */
type Page = import('@playwright/test').Page;

async function openAlturaDeficiencies(page: Page) {
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(600);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(800);
  await main.getByRole('button', { name: 'Open CY 2026 audit' }).filter({ hasText: '02 Jan 2026' }).first().click();
  await page.waitForTimeout(1000);
  await main.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(900);
}

test('every grade goes to the reviewer, whatever it is rated', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaDeficiencies(page);

  // DEF-A-01 is freshly identified. Whatever the engine grades it, the auditor's
  // hand-off names the reviewer — the low-grade shortcut straight to the owner
  // is gone.
  await page.getByText('DEF-A-01').first().click();
  await page.waitForTimeout(700);
  const handOff = page.getByRole('button', { name: /^Rated .* — / });
  await expect(handOff.first()).toBeVisible({ timeout: 15_000 });
  await expect(handOff.first()).toContainText('send to the reviewer');
  await handOff.first().click();
  await page.waitForTimeout(900);

  // It parks, and says whose move it is — the owner cannot start planning yet.
  await expect(page.getByText('Rating review').first()).toBeVisible();
  await expect(page.getByText(/Blocked — no fix starts until the .* rating is confirmed/).first()).toBeVisible();
});

test('a rating the reviewer has agreed cannot be edited underneath them', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaDeficiencies(page);

  // DEF-A-02 is still with the reviewer, so the numbers behind the grade are
  // live — the confirmation is a conversation about the rating, and often
  // changes it.
  await page.getByText('DEF-A-02').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Remote', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('spinbutton', { name: 'Exposure in rupees' }).first()).toBeVisible();
  await page.getByText('DEF-A-02').first().click();
  await page.waitForTimeout(500);

  // DEF-A-06 has been through that gate — the reviewer agreed Material Weakness
  // and it went to the owner to plan against. From here the inputs are gone, so
  // the agreed grade cannot be walked down behind the reviewer's stamp. (The
  // store refuses the same move independently: any change to a confirmed grade
  // clears the confirmation and sends it back for a fresh one.)
  await page.getByText('DEF-A-06').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText('Material Weakness').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Remote', exact: true })).toHaveCount(0);
  await expect(page.getByRole('spinbutton', { name: 'Exposure in rupees' })).toHaveCount(0);
});

test('only the reviewer reopens what the reviewer closed', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaDeficiencies(page);

  // DEF-A-05 is closed — retested clean and signed off by the reviewer.
  await page.getByText('DEF-A-05').first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Closed —', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

  // The auditor has no way back in. Absent, not greyed.
  await expect(page.getByRole('button', { name: /Reopen — reason required/ })).toHaveCount(0);

  // The reviewer does, because the signature being undone is theirs. Changing
  // hats returns you to the audit's dashboard, so the register is re-entered.
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('main').getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('DEF-A-05').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: /Reopen — reason required/ }).first()).toBeVisible();
});
