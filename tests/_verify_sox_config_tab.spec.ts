import { test, expect } from './_helpers';

// NOTE: a parallel session is renaming this tab ("SOX audit" → "SOX testing").
// Matched loosely until that lands so the suite is not red on someone else's
// half-finished rename; tighten to the winning label once it settles.
import { openFromLibrary } from './_sox_helpers';

const SHOT_DIR = '/private/tmp/claude-501/-Users-aasthajain-Desktop-Product-Irame-Product-handover/e4611527-b2d2-4848-8aa2-dda858a9a11e/scratchpad/sox-config-shots';

/**
 * Configuration is no longer an ENGAGEMENT tab — it belongs to an audit.
 *
 * This spec used to walk the engagement-level Configuration tab: testing
 * period (FY / CY), entities + per-entity trial balances, materiality rules
 * incl. per-entity assignment, and the save-then-re-derive loop. That tab is
 * PARKED on both SOX shells — the `{ id: 'config', label: 'Configuration' }`
 * line is commented out of SOX_TABS in SoxIcfrApp.tsx and again in
 * SoxClassicApp.tsx — because period, scope, TB / GL and materiality are set
 * per audit cycle now, not once for the engagement. ConfigurationView.tsx
 * still exists and still compiles; nothing routes to it.
 *
 * The old walkthrough was not repaired, it was retired: its subject is
 * unreachable, and its steps had rotted independently of the park (the entity
 * it deleted, "SkyCargo Logistics Pvt Ltd", no longer exists on an engagement
 * this helper creates — Basics answers the entities question with the
 * single-company checkbox). Rebuilding it against ConfigurationView is a fresh
 * test to write on the day those two lines are uncommented, not a diff to
 * un-skip.
 *
 * What runs instead is the guard for the decision: the surface is absent where
 * it used to live, and the Configuration that does exist is the audit's, which
 * is a different page.
 */
test('SOX Configuration is absent at engagement level and lives on the audit', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  // Altura, not a freshly created engagement. Creation no longer seeds anything
  // (user ask — nothing is asked for, so nothing is invented), which means a new
  // engagement has no audit to open and the second half of this test had nothing
  // to click. The audit-level Configuration tab is about an audit that exists.
  await openFromLibrary(page, 'FY26 ICFR — Altura Infra Group');
  await page.waitForTimeout(600);

  // The engagement is four tabs, and Configuration is not one of them
  const main = page.getByRole('main');
  for (const label of ['Overview', 'RACM', 'Control Library']) {
    await expect(main.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
  }
  await expect(main.getByRole('button', { name: 'Configuration', exact: true })).toHaveCount(0);

  // …and nothing else on the engagement smuggles the parked surface back in:
  // no testing period, no entity register, no re-derive loop.
  await expect(page.getByText('Testing period')).toHaveCount(0);
  await expect(page.getByText('Group & entities')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Re-derive scope' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/01-engagement-no-config.png`, fullPage: true });

  // Opening the audit swaps in AUDIT_TABS behind a breadcrumb — Configuration
  // is the fourth of those, and it configures the CYCLE, not the engagement.
  // The audit register is the SOX tab, not Overview — Overview is a read-out
  // across audits, so the cards you can open live one tab over.
  await main.getByRole('button', { name: /^SOX (audit|testing)$/ }).first().click();
  await page.waitForTimeout(800);
  // Any audit will do — the point is the tabs an audit swaps in, not which
  // round it is. Matched on the period, which every card prints.
  await main.getByRole('button').filter({ hasText: /^(CY|FY) ?20\d\d/ }).first().click();
  await page.waitForTimeout(900);
  for (const label of ['Dashboard', 'Control Library', 'Deficiency management', 'Configuration']) {
    await expect(main.getByRole('button', { name: label, exact: true }).first()).toBeVisible();
  }
  await main.getByRole('button', { name: 'Configuration', exact: true }).first().click();
  await page.waitForTimeout(700);

  // The audit's own configuration: its period, what it covers, the files it
  // holds and the threshold it measures against.
  await expect(page.getByText('Audit period', { exact: true })).toBeVisible();
  await expect(page.getByText('What this audit covers')).toBeVisible();
  await expect(page.getByText('Source files', { exact: true })).toBeVisible();
  await expect(page.getByText('Materiality rule')).toBeVisible();
  // Still not the engagement-scoping page it replaced
  await expect(page.getByText('Group & entities')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Re-derive scope' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOT_DIR}/02-audit-config.png`, fullPage: true });
});
