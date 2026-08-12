import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The owner's lane, and its edges.
 *
 * Three rules from the RBAC spec:
 *  - Owning is EITHER capacity. Someone who runs the process is chased for its
 *    controls, so they see the controls and the findings on them — the register
 *    and the deficiency page must not disagree about who owns what.
 *  - What is not yours does not open. A link is not an exception to the lane;
 *    the refusal says whose it is rather than failing silently.
 *  - Attributes are what a control is TESTED against, so the owner reads them
 *    and the auditor writes them. The first line does not set the questions its
 *    own work is marked on.
 */
type Page = import('@playwright/test').Page;

async function openAltura(page: Page) {
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(700);
}

async function actAs(page: Page, person: string) {
  await page.getByRole('button', { name: 'Owner persona' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('menu', { name: 'Owner persona' }).getByText(person, { exact: true }).first().click();
  await page.waitForTimeout(900);
}

test('a process owner sees the controls they answer for', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAltura(page);

  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(1000);

  // Divya Menon runs Order to Cash without being any control's named owner.
  // Under the narrow reading she owned nothing at all; she is answerable for
  // every O2C control, so that is what her library holds.
  await actAs(page, 'Divya Menon');
  await page.getByRole('main').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);

  const openable = page.getByRole('main').getByRole('button', { name: /^Open .+ — / });
  expect(await openable.count()).toBeGreaterThan(0);
  await expect(page.getByText('Order to Cash').first()).toBeVisible();
});

test('the owner reads a control’s attributes and never writes them', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAltura(page);

  // The auditor's own view first, so the absence below means something.
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);
  // The register groups its rows, so the first <tr> is a group header — the
  // control rows are the ones that carry an "Open …" label.
  await main.getByRole('button', { name: /^Open .+ — / }).first().click();
  await page.waitForTimeout(1300);
  await expect(page.getByRole('button', { name: 'Add attribute' }).first()).toBeVisible({ timeout: 15_000 });

  // Back out first: a drilled-in control is a standalone page with a breadcrumb
  // instead of the engagement header, so there is no hat switcher on it.
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1000);

  // The owner of that same control gets the list and no pens — absent, not greyed.
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(1200);
  await main.getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);
  // The register groups its rows, so the first <tr> is a group header — the
  // control rows are the ones that carry an "Open …" label.
  await main.getByRole('button', { name: /^Open .+ — / }).first().click();
  await page.waitForTimeout(1300);
  await expect(page.getByRole('button', { name: 'Add attribute' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Remove attribute/ })).toHaveCount(0);
});
