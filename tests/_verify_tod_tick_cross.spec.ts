import { test, expect } from './_helpers';

/**
 * TOD step of the audit-level control page, after the Aug 2026 pass:
 *
 *   · Validate / Re-run / Validate all and the override pencil are parked.
 *   · A design check is marked by hand — a tick and a cross beside the bin,
 *     and Pass all / Fail all in the section header.
 *   · "Attach your own" opens a real form: what the auditor did, a file picked
 *     off the machine, and a comment saying why. Nothing is written until
 *     Submit, and what was submitted stays readable afterwards.
 *
 * Both halves are checked — what arrived AND what left. The removals are the
 * point of the change, so a spec that only looked for the new buttons would
 * pass just as happily with the old ones still sitting next to them.
 */
const SHOTS = 'test-results/tod-tick-cross';

async function openAuditLevelControl(page: import('@playwright/test').Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  // An audit-run card drops from the library detail into that audit's control
  // page — the five-step tester. That is the only way in, by design.
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByRole('heading', { name: /Design checks/ })).toBeVisible({ timeout: 15_000 });
}

/**
 * A concluded control is frozen — `patchControl` drops every write once
 * `isControlLocked` is true, while the buttons stay on screen and clickable.
 * So the seeded control has to be reopened before any of this can be exercised,
 * or the spec would be testing a screen that silently ignores it.
 */
async function ensureReopened(page: import('@playwright/test').Page) {
  const reopen = page.getByRole('button', { name: 'Reopen', exact: true });
  if (await reopen.count() === 0) return;
  await reopen.first().click();
  await expect(page.getByText('Reopen this control?')).toBeVisible();
  await page.getByPlaceholder(/FX rate feed changed/).fill('Retesting the design checks');
  await page.getByRole('button', { name: 'Reopen', exact: true }).last().click();
  await page.waitForTimeout(800);
}

/** The row carrying a given check — the subcard, so a click can't land on a
 *  neighbouring row's identically-labelled button. */
function checkRow(page: import('@playwright/test').Page, text: string | RegExp) {
  return page.locator('.subcard').filter({ hasText: text }).first();
}

test('the design check is ticked or crossed, and the old buttons are gone', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditLevelControl(page);
  await ensureReopened(page);
  await page.screenshot({ path: `${SHOTS}/01-design-checks.png`, fullPage: true });

  // ── what left ─────────────────────────────────────────────────────────────
  await expect(page.getByRole('button', { name: 'Validate all' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Validate', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Re-run', exact: true })).toHaveCount(0);
  // The design check's own pencil, exactly — the TOE attribute rows further down
  // keep theirs ("Override result with rationale"), which is why this is scoped
  // to the title the parked button carried rather than to the word.
  await expect(page.getByRole('button', { name: 'Override', exact: true })).toHaveCount(0);
  // the heading no longer claims an AI validated anything
  await expect(page.getByText('AI-validated against the evidence')).toHaveCount(0);

  // ── what arrived ──────────────────────────────────────────────────────────
  await expect(page.getByRole('button', { name: 'Pass all' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fail all' })).toBeVisible();

  const row = checkRow(page, /Control addresses the stated risk|risk and assertion/);
  await expect(row).toBeVisible();
  const tick = row.getByRole('button', { name: 'Mark this check passed' });
  const cross = row.getByRole('button', { name: 'Mark this check failed' });
  await expect(tick).toBeVisible();
  await expect(cross).toBeVisible();

  // ── and they actually set the result ──────────────────────────────────────
  // The lit button is the row's current answer, so the tick and the buttons can
  // never disagree — that is the whole reason the state is read from the same
  // place the tickmark reads.
  await cross.click();
  await page.waitForTimeout(400);
  await expect(cross).toHaveClass(/bg-risk-50/);
  await tick.click();
  await page.waitForTimeout(400);
  await expect(tick).toHaveClass(/bg-compliant-50/);
  await expect(cross).not.toHaveClass(/bg-risk-50/);
  await page.screenshot({ path: `${SHOTS}/02-ticked.png`, fullPage: true });
});

test("attaching the auditor's own proof takes a file and a reason", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditLevelControl(page);
  await ensureReopened(page);

  const row = checkRow(page, /Control addresses the stated risk|risk and assertion/);
  const attach = row.getByRole('button', { name: 'Attach your own' });
  // Two buttons on this row answer to "Remove": the text link that clears the
  // proof, and the bin that deletes the whole check. First in the DOM is the
  // link — deleting the check would take the row out from under the spec.
  const clearProof = row.getByRole('button', { name: 'Remove', exact: true }).first();
  if (await attach.count() === 0) {
    // already carries a proof from an earlier run — clear it so the form opens
    await clearProof.click();
    await page.waitForTimeout(400);
  }
  await row.getByRole('button', { name: 'Attach your own' }).click();
  await page.waitForTimeout(400);

  // three answers, in the order the work happened
  await expect(row.getByText('What did you do on this check?')).toBeVisible();
  await expect(row.getByText('The file')).toBeVisible();
  await expect(row.getByText('Why you attached it')).toBeVisible();
  await expect(row.getByText('Drop a file, or click to browse')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-attach-form.png`, fullPage: true });

  // Submit is dead until a file is chosen — a kind and a comment on their own
  // prove nothing, and the old flow wrote a PDF the auditor had never seen.
  const submit = row.getByRole('button', { name: 'Submit' });
  await expect(submit).toBeDisabled();

  await row.getByRole('button', { name: 'Reperformance result' }).click();
  await row.locator('input[type="file"]').setInputFiles({
    name: 'Reperformance_14May_run.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 reperformance of the 14 May payment run'),
  });
  await page.waitForTimeout(400);
  await expect(row.getByText('Reperformance_14May_run.pdf').first()).toBeVisible();
  await expect(submit).toBeEnabled();

  const why = 'Reperformed the 14 May run — both authorisers were distinct from the preparer.';
  await row.getByPlaceholder(/Reperformed the 14 May payment run/).fill(why);
  await page.screenshot({ path: `${SHOTS}/04-filled.png`, fullPage: true });
  await submit.click();
  await page.waitForTimeout(600);

  // ── what was submitted stays readable ─────────────────────────────────────
  // A comment nobody can find afterwards is not a record, so the row prints the
  // kind, the filename and the reason rather than a bare paperclip.
  await expect(row.getByText('Drop a file, or click to browse')).toHaveCount(0);
  await expect(row.getByText('Reperformance result')).toBeVisible();
  await expect(row.getByText('Reperformance_14May_run.pdf')).toBeVisible();
  await expect(row.getByText(why)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-attached.png`, fullPage: true });

  // cancelling writes nothing — the half-filled form leaves the check as it was
  await clearProof.click();
  await page.waitForTimeout(300);
  await row.getByRole('button', { name: 'Attach your own' }).click();
  await row.getByPlaceholder(/Reperformed the 14 May payment run/).fill('abandoned');
  await row.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForTimeout(300);
  await expect(row.getByText('none — taken on the documents')).toBeVisible();
});
