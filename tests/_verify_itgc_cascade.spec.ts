import { test, expect } from './_helpers';

const SHOTS = 'test-results/itgc-cascade';

/**
 * R8.6 — the IT dependency and its blast radius.
 *
 * One IT general control concluded ineffective withdraws "test of one" from
 * every automated and IT-dependent control in the engagement. The rule was
 * already computed; this covers the part the product has to SHOW: a banner where
 * the controls are listed, a filter that isolates the affected set, and a notice
 * on each affected control naming the ITGC that did it.
 *
 * The engagement now seeds an ITGC RACM (see GROUP_WORKSTREAMS in
 * v2ClassicStore), so this walks the state a user would actually reach —
 * conclude one access control ineffective — rather than building a control by
 * hand first.
 */
type Page = import('@playwright/test').Page;

/** Engagement → a control → its audit run → the five-step tester. The only way
 *  into an audit, and from there the audit's own tabs are in the bar. */
async function openAnAudit(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText('TOD', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

/** The tester hides the tab bar for a breadcrumb — ← returns to the audit root,
 *  where the audit's own tabs (Dashboard, RACM, Control Library) are back. */
async function backToAuditRoot(page: Page) {
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1400);
}

async function openAuditLibrary(page: Page) {
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1400);
}

test('ITGC cascade — the withdrawal is visible where it lands', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAnAudit(page);

  // ── the audit's Control Library, before anything has failed ────────────────
  await backToAuditRoot(page);
  await openAuditLibrary(page);
  await expect(page.getByText(/Test of one is withdrawn/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/01-before.png`, fullPage: true });

  // ── break an ITGC: the seed leaves the last control of each RACM untested ──
  await page.getByPlaceholder(/Search controls/).fill('Emergency changes');
  await page.waitForTimeout(900);
  await page.getByText('Emergency changes reviewed post-implementation.').first().click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${SHOTS}/02-itgc-control.png`, fullPage: true });

  const concludeBad = page.getByRole('button', { name: 'Conclude ineffective' }).first();
  await expect(concludeBad).toBeVisible({ timeout: 15_000 });
  await expect(concludeBad).toBeEnabled();
  await concludeBad.click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${SHOTS}/03-itgc-failed.png`, fullPage: true });

  // ── back to the audit's Control Library: the banner counts the blast radius ─
  await backToAuditRoot(page);
  await openAuditLibrary(page);
  await expect(page.getByText(/Test of one is withdrawn/).first()).toBeVisible();
  // The chip names the control that did it — its code and its words, not "an ITGC".
  await expect(page.getByText('Emergency changes reviewed post-implementation.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-banner.png`, fullPage: true });

  // ── the banner sets the filter rather than describing it ───────────────────
  const show = page.getByRole('button', { name: /Show the \d+ affected/ }).first();
  await expect(show).toBeVisible();
  const affected = Number((await show.textContent())?.match(/\d+/)?.[0]);
  expect(affected).toBeGreaterThan(0);
  await show.click();
  await page.waitForTimeout(1200);
  // The register's saved views live in the table's Conclusion column filter, not
  // a chip row — so the proof the filter took is the list itself narrowing to the
  // count the banner promised, and the action retiring once it has.
  await expect(page.getByText(`Showing ${affected} of`)).toBeVisible();
  await expect(page.getByRole('button', { name: /Show the \d+ affected/ })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/05-filtered.png`, fullPage: true });

  // ── and on an affected control, the notice names the culprit ───────────────
  // .reg-row, not `tbody tr` — the group headers are rows too, and clicking one
  // collapses a process instead of opening a control.
  const rows = page.locator('tr.reg-row');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await rows.first().click();
  await page.waitForTimeout(1600);
  await expect(page.getByText(/Test of one is withdrawn — an IT general control has failed/).first()).toBeVisible();
  await expect(page.getByText('Emergency changes reviewed post-implementation.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/06-affected-control.png`, fullPage: true });

  // ── the engagement Dashboard carries the same banner ───────────────────────
  await backToAuditRoot(page);
  await page.getByText('Dashboard', { exact: true }).first().click();
  await page.waitForTimeout(1500);
  await expect(page.getByText(/Test of one is withdrawn/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-dashboard.png`, fullPage: true });
});
