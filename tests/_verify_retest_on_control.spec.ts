import { test, expect } from './_helpers';

/**
 * The retest moved off the exception and onto the CONTROL (30 Sep 2026).
 *
 * It used to be step ⑤ of six: the owner declared the fix done, the auditor drew
 * a post-fix sample and marked it, and only then did the reviewer close. That
 * asked for proof of a repair the week it landed — usually before the fixed
 * control had run even once. The flow is five steps now and ends at the close:
 *
 *   ④ fix and submit   the owner attaches proof and hands it to the REVIEWER
 *   ⑤ close            the reviewer reads the plan, the fix and its evidence
 *
 * and the close raises `Control.retestDue` — "the thing you tested is not the
 * thing running now" — on the control itself, for the auditor to answer on the
 * audit's own timetable. Answering it takes a reason either way: a retest and a
 * decision not to retest are both judgements.
 *
 * Three of the four places it surfaces are walked below — the notifications bell,
 * the Control Library's own way in, and the control's paper, where it is settled.
 * (The parked control register carries the same 'retest-due' predicate.)
 *
 * Runs on the flagship, whose DEF-001 is seeded mid-remediation on P2P-C-04 with
 * three different people on the three hats — which is what lets one walk carry
 * the owner's submit, the reviewer's close and the auditor's answer.
 *
 * `_verify_remediation_flow.spec.ts` pins the five-step rail itself; this one is
 * the journey through it and out the other side.
 */
type Page = import('./_helpers').Page;

/** Enter the audit only if we are not already in it — switching hats keeps the
 *  open audit, so a second unconditional click waits for a button that is gone. */
const ensureInAudit = async (page: Page) => {
  const open = page.getByRole('button', { name: /^Open FY 20/ });
  if (await open.count() > 0) { await open.first().click(); await page.waitForTimeout(1200); }
};

const openSox = async (page: Page) => {
  await page.goto('/');
  await page.locator('[title="Engagements"]').first().click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Airline P2P & O2C').first().click();
  await page.waitForTimeout(1000);
};

/** ④ The owner (M. Nair): proof of the fix, then hand it over. Deficiency
 *  management is a register, so the row opens before anything in it is clickable. */
const submitTheFix = async (page: Page) => {
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Expand / }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Attach evidence' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Fixed — submit for sign-off/ }).click();
  await page.waitForTimeout(500);
};

test('the fix goes straight to the reviewer — there is no rung in between', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await openSox(page);

  // Before: the owner is at step ④ and the submit is the only thing on offer.
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Manage my exceptions/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /^Expand / }).first().click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/Step 4 of 5 · Remediation/)).toBeVisible();
  // "Done" needs proof, so the button is the one disabled gate the flow keeps.
  await expect(page.getByRole('button', { name: /Fixed — submit for sign-off/ })).toBeDisabled();

  await page.getByRole('button', { name: 'Attach evidence' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Fixed — submit for sign-off/ }).click();
  await page.waitForTimeout(500);

  // After: the reviewer, not the auditor. The retest step is not skipped — it
  // does not exist, so there is nothing between the fix and the close.
  await expect(page.getByText(/Step 5 of 5 · Awaiting reviewer/)).toBeVisible();
  await expect(page.getByText(/reading the fix evidence and closing/)).toBeVisible();
  await expect(page.getByText(/Awaiting reviewer — only the reviewer closes/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Draw post-fix sample|Record retest/ })).toHaveCount(0);
  // And the owner is told they are out of it, without being shown a button for
  // somebody else's job.
  await expect(page.getByRole('button', { name: /Close — reviewer sign-off/ })).toHaveCount(0);
});

test('closing the fix leaves the control owed a retest, and the auditor settles it with a reason', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await openSox(page);
  await submitTheFix(page);

  // ⑤ the reviewer (J. Fernandes) closes. Four-eyes passes: the anchor is the
  // auditor who accepted the plan, and DEF-001 was seeded past that rung with
  // nobody's name on it.
  await page.getByRole('button', { name: 'Reviewer', exact: true }).click();
  await page.waitForTimeout(600);
  await ensureInAudit(page);
  await page.getByRole('button', { name: 'Deficiency management', exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Expand DEF-001/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Close — reviewer sign-off/ }).click();
  await page.waitForTimeout(300);
  await page.locator('.modal').getByRole('button', { name: /Close — reviewer sign-off/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/Closed — signed off by J. Fernandes/)).toBeVisible();

  // The auditor is TOLD, rather than left to notice. The bell names the control
  // by its working-paper reference and says what happened to it.
  await page.getByRole('button', { name: 'Auditor', exact: true }).click();
  await page.waitForTimeout(600);
  await ensureInAudit(page);
  await page.getByRole('button', { name: /To-do —/ }).click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/P-04 changed — it is owed a retest/).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // And the library asks the same question of the whole set — "which of these
  // rows describes a control that has since been rebuilt" — from cold, without
  // having to be sent there by a count somewhere else.
  await page.getByRole('button', { name: 'Control Library' }).last().click();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: /controls? changed since (it was|they were) tested/ }).click();
  await page.waitForTimeout(700);
  await expect(page.getByText('Owed a retest').first()).toBeVisible();
  await page.getByRole('button', { name: /^Open P2P-C-04/ }).first().click();
  await page.waitForTimeout(900);

  // The control's own paper carries the flag, in the owner's words for the fix.
  await expect(page.getByText(/Changed since it was tested — a retest is owed/)).toBeVisible();
  await expect(page.getByText(/Normalise reference in match key/).first()).toBeVisible();
  // Deliberately NOT a reopening: nothing signed has been undone, and the banner
  // says so rather than leaving the auditor to check.
  await expect(page.getByText(/Nothing on this paper has been undone/)).toBeVisible();

  // Settling it is the auditor's, and it is never one-click — a retest and a
  // decision not to retest are both judgements, and an unwritten judgement did
  // not happen.
  await page.getByRole('button', { name: 'Settle the retest', exact: true }).click();
  await page.waitForTimeout(400);
  const record = page.getByRole('button', { name: 'Record it', exact: true }).first();
  await expect(record).toBeDisabled();
  await page.getByPlaceholder(/What you did/).fill('Re-ran the duplicate block against 20 re-keyed references on 12 Oct — all 20 blocked, including the leading-zero variants.');
  await expect(record).toBeEnabled();
  await record.click();
  await page.waitForTimeout(700);

  // Answered, and it stays on the page: that a change was noticed and settled is
  // working paper, not housekeeping.
  await expect(page.getByText('Retest settled')).toBeVisible();
  await expect(page.getByText(/all 20 blocked, including the leading-zero variants/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settle the retest', exact: true })).toHaveCount(0);

  // Both halves are in the shared trail, named and in order.
  await expect(page.getByText(/the control changed under DEF-001 — a retest is owed/)).toBeVisible();
  await expect(page.getByText(/cleared the retest owed under DEF-001/)).toBeVisible();
});
