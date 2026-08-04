import { test, expect } from './_helpers';

/**
 * Phase 4 — guardrails & leak fixes: the ground rules are read-only prose for
 * non-auditors (absent, not disabled), every exception lifecycle move stamps a
 * named actor into the shared trail, and four-eyes checks compare people.
 */

/** The engagement, then INTO the audit.
 *
 *  The module grew a second level: the engagement root is now a portfolio of
 *  audits (EngagementOverview), and the dashboard this spec was written against
 *  — materiality, the progress rail, the sign-off gate — lives inside an audit.
 *  Without this step the spec sat on the portfolio asserting things that are one
 *  navigation deeper, which is why it timed out rather than failing on content. */
/** Enter the audit only if we are not already in it. Switching hats resets the
 *  tab but keeps the open audit, so a second unconditional click waits forever
 *  for a button that is no longer on screen. */
const ensureInAudit = async (page: import('./_helpers').Page) => {
  const open = page.getByRole('button', { name: /^Open FY 20/ });
  if (await open.count() > 0) { await open.first().click(); await page.waitForTimeout(1200); }
};

const openSox = async (page: import('./_helpers').Page, intoAudit = false) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
  if (intoAudit) {
    await page.getByRole('button', { name: /^Open FY 20/ }).first().click();
    await page.waitForTimeout(1200);
  }
};

// "Absent, not disabled" now holds for the whole screen. The four thresholds
// always honoured it; the policy toggles and the MW indicators were rendering
// live for every role while the store silently dropped their writes — fixed
// Aug 2026 by gating both on canEditRules.
test('the ground rules read as prose for the reviewer — no live controls', async ({ page }) => {
  test.setTimeout(120_000);
  // the ground rules live on the AUDIT dashboard, so this one goes in
  await openSox(page, true);
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  // the header period pill is gone for every role — roll-forward lives in the register header
  await expect(page.getByTitle(/Switch period/)).toHaveCount(0);
  await page.getByRole('button', { name: /Materiality & scope/ }).click();
  await page.waitForTimeout(900);
  const rules = page.locator('#materiality-ground-rules');
  await expect(rules).toBeVisible();
  // absent, not disabled: no editable threshold, no switches, no clickable MW
  // indicators. The seeded flagship carries a materialityBasis, so its two
  // worksheet figures render disabled rather than as open fields.
  await expect(rules.locator('input[type=number]:not([disabled])')).toHaveCount(0);
  await expect(rules.getByRole('switch')).toHaveCount(0);
  await expect(rules.getByRole('button', { name: /Restatement of previously issued/ })).toHaveCount(0);
  // and there is no way to commit a change either
  await expect(page.getByRole('button', { name: /Review & apply/ })).toHaveCount(0);
  // the states still read plainly
  await expect(rules.getByText('On', { exact: true }).first()).toBeVisible();
});

test('exception lifecycle stamps named actors into the trail, four-eyes closes it', async ({ page }) => {
  test.setTimeout(180_000);
  await openSox(page);

  // owner (M. Nair): evidence the fix, submit DEF-001 for retest
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  // Deficiency management is a REGISTER now (4ae1a41) — the card's contents live
  // behind an expanded row, so the row has to be opened before anything in it
  // can be clicked. The spec predates the register and went straight for the
  // button.
  await page.getByRole('button', { name: /^Expand / }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Attach evidence' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Fixed — submit for retest/ }).click();
  await page.waitForTimeout(400);
  // The exception's state is the "Current state" strip now — who has it and what
  // they are doing — rather than a fixed sentence per status.
  await expect(page.getByText(/retesting on a post-fix sample/)).toBeVisible();

  // auditor (A. Mehta): record the retest pass
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(600);
  // Switching hats returns to the engagement root, and the register lives inside
  // the audit — so go back in, then to its Deficiency management tab.
  await ensureInAudit(page);
  await page.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Expand DEF-001/ }).first().click();
  await page.waitForTimeout(600);
  // The retest is a drawn sample now, not a single verdict button: draw it, mark
  // every item, then record the round.
  await page.getByRole('button', { name: /Draw post-fix sample/ }).click();
  await page.waitForTimeout(900);
  // Every item against every attribute — the Record button only appears once the
  // whole grid is marked, because the verdict comes off the grid, not a button.
  const passCells = page.getByRole('button', { name: / Pass$/ });
  const n = await passCells.count();
  for (let i = 0; i < n; i++) { await passCells.nth(i).click(); await page.waitForTimeout(100); }
  await page.getByRole('button', { name: /Record retest \d+ — passed/ }).click();
  await page.waitForTimeout(500);

  // reviewer (J. Fernandes): close — four-eyes passes because people differ
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  await ensureInAudit(page);
  await page.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Expand DEF-001/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Close — reviewer sign-off/ }).click();
  await page.waitForTimeout(300);
  // the terminal close now attests first — confirm inside the modal
  await page.locator('.modal').getByRole('button', { name: /Close — reviewer sign-off/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/Closed — signed off by J. Fernandes/)).toBeVisible();

  // the shared trail on P2P-C-04 carries every move with its named actor
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(600);
  // The execution trail only renders on the audit-level dossier — at engagement
  // root a control opens as the library detail page, which has no trail.
  await ensureInAudit(page);
  await page.getByRole('button', { name: 'Control Library' }).last().click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder(/Search controls/).fill('P2P-C-04');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Open P2P-C-04/ }).first().click();
  await page.waitForTimeout(900);
  await expect(page.getByText(/submitted the fix for retest/)).toBeVisible();
  await expect(page.getByText(/recorded retest 1 — pass on DEF-001/)).toBeVisible();
  await expect(page.getByText(/closed DEF-001 — reviewer sign-off/)).toBeVisible();
});

test('the owner sees their classification, never the engagement thresholds', async ({ page }) => {
  test.setTimeout(120_000);
  await openSox(page);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  // Same register change as above — the severity block is inside the card.
  await page.getByRole('button', { name: /^Expand / }).first().click();
  await page.waitForTimeout(600);
  // the derivation shows their exposure but not "vs materiality"
  await expect(page.getByText(/vs ₹/)).toHaveCount(0);
  await expect(page.getByText(/Severity — evaluated by the auditor/).first()).toBeVisible();
});
