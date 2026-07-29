import { test, expect } from './_helpers';

/**
 * O1 — every counted click on the Overview lands on the Control Library
 * showing exactly the counted set: KPI tiles carry their saved view, process
 * cards carry the process filter, checklist rows carry their view.
 */

async function openEng(page: import('./_helpers').Page) {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
}

test('Ineffective tile opens the register on the Exceptions view', async ({ page }) => {
  test.setTimeout(90_000);
  await openEng(page);
  await page.getByRole('button', { name: /Ineffective/ }).first().click();
  await page.waitForTimeout(900);
  // status dropdown trigger shows the applied view with its count
  await expect(page.getByText(/Exceptions \(\d+\)/).first()).toBeVisible();
});

test('process card opens the register filtered to that process', async ({ page }) => {
  test.setTimeout(90_000);
  await openEng(page);
  await page.getByRole('button', { name: /Order to Cash/ }).first().click();
  await page.waitForTimeout(900);
  // the process filter carries the clicked process, and every visible row belongs to it
  await expect(page.locator('.sox-book-ui').getByText('Order to Cash').first()).toBeVisible();
  await expect(page.getByText(/Record to Report/)).toHaveCount(0);
});

test('"not concluded" checklist row opens the Not concluded view', async ({ page }) => {
  test.setTimeout(90_000);
  await openEng(page);
  await page.getByText(/controls? not concluded/).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/Not concluded \(\d+\)/).first()).toBeVisible();
});

// O3 (variant B): the paper rows split by whose pen is missing, each landing
// on exactly its own set
test('paper checklist rows open their exact sign-off views', async ({ page }) => {
  test.setTimeout(90_000);
  await openEng(page);
  await page.getByText(/papers? awaiting countersign/).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/Awaiting review \(\d+\)/).first()).toBeVisible();
  // back to the overview for the second row
  await page.locator('.sox-book-ui').getByRole('button', { name: 'Overview', exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText(/awaiting the preparer's signature/).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/Awaiting sign-off \(\d+\)/).first()).toBeVisible();
});
