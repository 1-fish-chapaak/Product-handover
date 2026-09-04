import { test, expect } from './_helpers';

const SHOTS = 'test-results/population-removals';

/**
 * Two things the dev call cut from the population step.
 *
 * "Add a source" opened the platform's whole data catalogue plus a
 * connect-a-database tab. Neither is where a control's evidence comes from — a
 * file the owner sends is — so upload is the one door now. It also took the only
 * path that skipped the provenance question (a system pull answered it by being
 * a system pull), which means every source is now asked where it came from.
 *
 * "Expected instances" asked the auditor to type the count before extracting so
 * the two numbers could be compared afterwards. The call cut it: the reference
 * number is already visible on the source. Nothing gates the extract now except
 * picking a file.
 */
type Page = import('@playwright/test').Page;

async function openControlWithNoPopulation(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  // Back to the audit root, then a control that is still being worked. It has to
  // be UNCONCLUDED: a control that has reached a conclusion is locked, and the
  // population step renders its read-only line instead of the form. The seed
  // leaves the last control of every RACM untested, and ITGC-05 is one.
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1400);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1400);
  await page.getByPlaceholder(/Search controls/).fill('Emergency changes');
  await page.waitForTimeout(900);
  await page.locator('tr.reg-row').first().click();
  await page.waitForTimeout(1600);
}

test('the population step asks for a file, and nothing else', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openControlWithNoPopulation(page);

  await page.getByText('Select the source').first().scrollIntoViewIfNeeded();
  await expect(page.getByText('Select the source').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-population-step.png`, fullPage: true });

  // ── gone ──────────────────────────────────────────────────────────────────
  await expect(page.getByText('Expected instances')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Add a source/ })).toHaveCount(0);

  // ── and what replaced them ────────────────────────────────────────────────
  await expect(page.getByRole('button', { name: /Upload file/ }).first()).toBeVisible();

  // The extract is reachable on a picked file alone. It starts disabled because
  // nothing is picked — that gate stays; it is the one the call kept.
  const extract = page.getByRole('button', { name: /Extract population/ }).first();
  await expect(extract).toBeVisible();
  await expect(extract).toBeDisabled();

  // Pick a source, and the only remaining gate lifts. The audit's own general
  // ledger, attached at creation and already carrying its provenance answer —
  // a file that has not answered renders disabled and cannot be picked.
  const gl = page.getByRole('button', { name: /altura-group-gl-2026\.csv/ }).first();
  await expect(gl).toBeVisible({ timeout: 15_000 });
  await gl.click();
  await page.waitForTimeout(800);
  await expect(extract).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/02-extract-enabled.png`, fullPage: true });

  // ── and it runs, producing a filtered subset rather than the whole file ────
  await extract.click();
  await page.waitForTimeout(3000);
  await expect(page.getByText(/Population (extracted|locked)/).first()).toBeVisible();
  // "N instances from M rows" — the population is smaller than its source, which
  // is what a filter that filtered looks like.
  const line = await page.getByText(/instances.*from .* rows/).first().textContent();
  const nums = (line ?? '').match(/[\d,]+/g)?.map(n => Number(n.replace(/,/g, ''))) ?? [];
  expect(nums.length).toBeGreaterThanOrEqual(2);
  expect(nums[0]).toBeLessThan(nums[1]!);
  await page.screenshot({ path: `${SHOTS}/03-extracted.png`, fullPage: true });
});
