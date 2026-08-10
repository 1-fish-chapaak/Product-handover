import { test, expect } from './_helpers';

// Relative to the repo root, and test-results/ is already gitignored. This was
// an absolute path into one machine's scratchpad, which passed there and would
// have failed for everyone else — including CI.
const SHOTS = 'test-results/flow-v2';

/**
 * The audit-level control page, simplified to exactly five steps:
 *   ① TOD  ② Population  ③ Sample  ④ TOE  ⑤ Sign-off
 *
 * This spec checks BOTH halves of the instruction — that the five steps and their
 * contents are there, and that everything the brief said to remove is actually
 * gone. The removals matter more than the additions: they are what the screen was
 * accumulating before it was cut back.
 */
async function openAuditLevelControl(page: import('@playwright/test').Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(/ICFR/).first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(900);
  // A control's title on its library card — clicking it opens the ENGAGEMENT-level
  // detail page (attributes, workflows, audit runs), not the tester.
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  // From there an audit-run card drops into that audit's control page — the
  // five-step tester. That is the only way to reach it, by design.
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  // sanity: we are on the tester, not the library detail
  await expect(page.getByText('TOD', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test('five steps, and only five', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditLevelControl(page);
  await page.screenshot({ path: `${SHOTS}/01-page.png`, fullPage: true });

  // ── the five steps, in order ──────────────────────────────────────────────
  for (const title of ['TOD', 'Population', 'Sample', 'TOE', 'Sign-off']) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }

  // ── step ① — source file, filter, checks, lock ────────────────────────────
  const populated = await page.getByText(/Population (locked|extracted)/).count() > 0;
  if (!populated) {
    await expect(page.getByText('Select the source')).toBeVisible();
    // One drafted statement, not a type/account pair — see extractionCriteria.
    // A system pull's criteria ARE the query, and no fixed field set fits them.
    await expect(page.getByText('Extraction criteria')).toBeVisible();
    await expect(page.getByText('Transaction type')).toHaveCount(0);
    await expect(page.getByText('Account', { exact: true })).toHaveCount(0);
    // Date from / to were parked earlier — the window comes from the audit.
    await expect(page.getByText('Date from')).toHaveCount(0);
    // "Expected instances" was cut (dev call, Aug 2026): the reference number is
    // already visible on the source, so asking the auditor to type one was
    // asking twice. Nothing gates the extract now except picking a file.
    await expect(page.getByText('Expected instances')).toHaveCount(0);
    // "Add a source" went with it — the platform's data catalogue and its
    // connect-a-database tab are not where a control's evidence comes from.
    await expect(page.getByRole('button', { name: /Add a source/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Upload file/ }).first()).toBeVisible();
    const extract = page.getByRole('button', { name: 'Extract', exact: true });
    await expect(extract).toBeVisible();
  } else {
    // The "Checked automatically" strip — count, period covered, and the window
    // sentence — was parked in Aug 2026: three rows that greened themselves and
    // then asked a person to tick that they agreed. Period coverage survived as
    // the second of the four IPE checks, which a person actually performs. What
    // this branch used to assert is now in the `gone` list below.
    //
    // Provenance is NOT asked here either. It moved onto the file record —
    // per file, once, rather than per extraction — so the three-field form is
    // gone and a file that hasn't answered is disabled in the source list above.
    await expect(page.getByText('Where this data came from')).toHaveCount(0);
    await expect(page.getByText('System of record')).toHaveCount(0);
  }

  // ── step ② — the derived basis line replaced the pickers ──────────────────
  await expect(page.getByText(/^Basis · /)).toBeVisible();

  // ── everything the brief said to REMOVE ───────────────────────────────────
  const gone = [
    'What is the population?',              // step ① definition card
    'Basis for the conclusion',             // 3-card picker
    'Is the control in operation?',         // toggle — derived now
    'Is there a compensating control?',     // exception evaluation's job
    'Is the frequency appropriate?',        // ordinary design check now
    'Is the control type appropriate?',     // ordinary design check now
    'Basis for these judgements',           // the second rationale box
    'Evidence type',                        // per-check dropdown
    'IPE gate 1',
    'IPE gate 2',
    'IPE gate 3',
    'Test the report (IPE)',
    'ITGC gate',
    'Confirm extraction',
    'Reports behind the evidence',
    'Confirm and lock',                     // the freeze-attributes card
    // The pre-lock tick boxes. Two were arithmetic the application had already
    // done; the third was an attestation standing in for a fact.
    'Check before locking',
    'Count matches expected',
    'Date range covers the full period',
    'Source is the production system',
    // The step ③ badge promised a confirmation that went with the IPE gates,
    // so nothing could ever clear it.
    'awaiting gate 2',
    // Parked Aug 2026 — the self-greening rows. A row that computes its own
    // answer and then asks for a tick is not a check, it is a formality.
    'Checked automatically',
    'Does the count read right?',
  ];
  for (const text of gone) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
  // the six 5W+1H judgement rows
  for (const w of ['WHO', 'WHEN', 'WHERE']) {
    await expect(page.locator('span').filter({ hasText: new RegExp(`^${w}$`) })).toHaveCount(0);
  }

  await page.screenshot({ path: `${SHOTS}/02-after-removals.png`, fullPage: true });
});

test('the extracted population can be looked at', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditLevelControl(page);

  // A locked population is otherwise a single number. Preview is what turns it
  // back into something a reviewer can actually check.
  const preview = page.getByRole('button', { name: 'Preview', exact: true });
  if (await preview.count() === 0) {
    test.skip(true, 'no population extracted on this control');
    return;
  }
  await preview.first().click();
  await page.waitForTimeout(700);
  await expect(page.getByText('The population', { exact: true })).toBeVisible();
  for (const h of ['Reference', 'Description', 'Account', 'Amount', 'Approved by']) {
    await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  }
  // rows, not an empty shell
  expect(await page.getByRole('row').count()).toBeGreaterThan(5);
  await page.screenshot({ path: `${SHOTS}/06-population-preview.png`, fullPage: true });
  await page.getByRole('button', { name: 'Close' }).first().click();
});

test('header, sign-off gating and the working paper', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditLevelControl(page);

  // ── the W/P stamp is gone; the court badge stays ──────────────────────────
  // A working-paper reference is an audit output, not a fact about the control,
  // so it came off every control surface and survives only in the exports. The
  // court badge kept its place in the header.
  await expect(page.locator('.leadsheet-stamp')).toHaveCount(0);
  await expect(page.getByText(/court$/i).first()).toBeVisible();

  // ── the working paper is view-only until both tracks conclude ─────────────
  await page.getByRole('button', { name: /Working paper/ }).first().click();
  await page.waitForTimeout(800);
  const download = page.getByRole('button', { name: /Download \.xlsx/ });
  await expect(download).toBeVisible();
  const viewOnly = page.getByText(/View only —/);
  if (await viewOnly.count() > 0) {
    await expect(download).toBeDisabled();            // untested control — locked
  } else {
    await expect(download).toBeEnabled();             // both tracks concluded — free
  }
  await page.screenshot({ path: `${SHOTS}/03-wp.png`, fullPage: true });
  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.waitForTimeout(500);

  // ── step ⑤ is locked until both tracks conclude ───────────────────────────
  await expect(page.getByText('Sign-off', { exact: true }).first()).toBeVisible();
  const signBtn = page.getByRole('button', { name: 'Sign off', exact: true });
  const lockedNote = page.getByText(/Unlocks once both tracks conclude|Sign-off is locked/);
  if (await lockedNote.count() > 0) {
    await expect(signBtn).toHaveCount(0);
  }
  await page.screenshot({ path: `${SHOTS}/04-signoff.png`, fullPage: true });

  // ── a concluded control has a way back in ─────────────────────────────────
  // patchControl freezes a concluded control, and until this button existed the
  // key-control tooltip pointed at an affordance that wasn't there.
  const concluded = await page.getByText(/EFFECTIVE|INEFFECTIVE/).count() > 0;
  if (concluded) {
    const reopen = page.getByRole('button', { name: 'Reopen', exact: true });
    await expect(reopen).toBeVisible();
    await reopen.click();
    await expect(page.getByText('Reopen this control?')).toBeVisible();
    // a reopened conclusion needs a reason on the trail
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Reopen', exact: true })
      .or(page.locator('.modal').getByRole('button', { name: 'Reopen', exact: true }));
    await expect(confirm.first()).toBeDisabled();
    await page.getByPlaceholder(/FX rate feed changed/).fill('Rate feed changed in November');
    await expect(confirm.first()).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/05-reopen.png`, fullPage: true });
    await page.getByRole('button', { name: 'Keep it closed' }).click();
  }
});
