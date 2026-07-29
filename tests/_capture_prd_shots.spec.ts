import { test } from './_helpers';

/**
 * One-off PRD shot refresh — re-captures the three screens the desks-rework
 * redesign made stale: 02-overview-onebox (Auditor), 17-reviewer-queue
 * (Reviewer), 18-owner-portal (Risk Owner). Matches the PRD capture spec:
 * 1440×900 viewport @1.5× deviceScaleFactor, JPEG q82, page top.
 */
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

const SHOTS = 'docs/prd-sox-icfr/shots';

test('capture PRD shots 02 / 17 / 18', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1200);

  // 02 — Auditor overview (default persona + default tab). The rail hover-
  // expands after 200ms, so park the mouse in the empty right margin — never
  // at (0,0), which hovers the rail and unfolds it into the shot.
  await page.mouse.move(1420, 500);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/02-overview-onebox.jpg`, type: 'jpeg', quality: 82 });

  // 17 — Reviewer desk
  await page.getByRole('button', { name: 'Reviewer' }).first().click();
  await page.waitForTimeout(1000);
  await page.mouse.move(1420, 500);
  await page.screenshot({ path: `${SHOTS}/17-reviewer-queue.jpg`, type: 'jpeg', quality: 82 });

  // 18 — Risk Owner portal (person picker defaults; old shot showed "as M. Nair")
  await page.getByRole('button', { name: 'Risk Owner' }).first().click();
  await page.waitForTimeout(1000);
  await page.mouse.move(1420, 500);
  await page.screenshot({ path: `${SHOTS}/18-owner-portal.jpg`, type: 'jpeg', quality: 82 });
});
