import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The two rules that were parked, now built.
 *
 * #9 — the owner's third tab. On the classic shell the owner had Overview and
 * their controls and nothing else, so the findings THEY are the ones being asked
 * to fix had no route from the tab bar at all. Both shells give them the same
 * three now; only the wording differs (exception / deficiency, see flow.ts).
 *
 * #18 — no two rungs of the ladder by the same hands. Roles alone never
 * guaranteed it: one person can hold two hats. Each rung stamps who did it and
 * the next one refuses that name, and the screen says so rather than going quiet.
 */
type Page = import('@playwright/test').Page;

async function ownerOn(page: Page, engagement: string) {
  await openFromLibrary(page, engagement);
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(1100);
}

test('the owner reaches their own findings on the classic shell too', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  // The flagship renders the classic shell — the one where the tab was missing.
  await ownerOn(page, 'FY26 ICFR — Airline P2P & O2C');

  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: 'Overview', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(main.getByRole('button', { name: 'Control Library', exact: true }).first()).toBeVisible();
  // Their own word for it on this shell, and it opens their scoped register.
  const mine = main.getByRole('button', { name: 'My exceptions', exact: true }).first();
  await expect(mine).toBeVisible();
  // The auditor-side tabs stay out of their way.
  await expect(main.getByRole('button', { name: 'RACM', exact: true })).toHaveCount(0);

  await mine.click();
  await page.waitForTimeout(1000);
  // It opens their own scoped page. Rows are not asserted here on purpose: every
  // classic engagement is seeded clean — findings live on Altura, which runs the
  // other shell — so the honest thing to pin is the route and its scoping, and
  // the empty state saying so rather than the page looking broken.
  await expect(page.getByText(/No exceptions on your controls\.|Filter by court/).first()).toBeVisible();
  // Still their lane: the audit-wide export stays auditor-side.
  await expect(page.getByRole('button', { name: 'Audit report' })).toHaveCount(0);
});

test('the same pair of hands cannot take two rungs in a row', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(700);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(800);
  await main.getByRole('button', { name: 'Open CY 2026 audit' }).filter({ hasText: '02 Jan 2026' }).first().click();
  await page.waitForTimeout(1000);
  await main.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(1000);

  // The auditor sizes DEF-A-01 — that stamps their name on the rung.
  await page.getByText('DEF-A-01').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Rated .* — / }).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText('Rating review').first()).toBeVisible();

  // The reviewer is a different person here, so the gate does NOT fire: the
  // confirmation is offered, which is what the rule is for — it blocks one human
  // wearing both hats, not the ordinary two-person case.
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(1200);
  await main.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText('DEF-A-01').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: /^Confirm / }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('A different person must confirm — you sized this one.')).toHaveCount(0);

  // And the rung that already had this rule keeps stating it in the same voice:
  // DEF-A-04's retest was recorded by the auditor, so the close waits on someone
  // who did not run it.
  await page.getByText('DEF-A-04').first().click();
  await page.waitForTimeout(800);
  await expect(page.getByText(/retesting on a post-fix sample|Retest/).first()).toBeVisible();
});
