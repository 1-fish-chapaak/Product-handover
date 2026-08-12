import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The four PRD claims that were carried as "unverified" from the Aug 11 gap
 * pass, and turned out to be missing rather than merely unproven. Three of them
 * are reachable from the UI and are driven here end to end.
 *
 * 1. §7 — "Aggregation is switched off part way through ... this must be
 *    surfaced, not silent." The switch now drafts like the thresholds do: a
 *    pending banner, a review listing the exceptions it re-grades, a mandatory
 *    reason, and an entry in the ground-rules log.
 *
 * 2. §8.4 / R8.5 — "The owner attests but the validation contradicts them ...
 *    the validation result stands." The attestation is recorded and the result
 *    does not move.
 *
 * 3. §8.2 — "Refiltering drops the extract and puts the old criteria back in
 *    the form, so the auditor edits instead of starting again."
 *
 * The fourth (§7, "controls dropped from scope are archived, not deleted") is
 * carried by reconcileScope, whose only caller is the engagement-level
 * ConfigurationView — parked out of the tab list, so there is no journey to
 * drive. It is covered by the type checker and by reading, not by this file.
 */
type Page = import('@playwright/test').Page;

const ALTURA = 'FY26 ICFR — Altura Infra Group';

/** Engagement → Control Library → the named control → into its audit run. */
async function openAlturaControl(page: Page, control: string) {
  await openFromLibrary(page, ALTURA);
  await page.waitForTimeout(700);
  await page.getByRole('main').getByRole('button', { name: 'Control Library', exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText(control).first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  if (await runCard.count()) { await runCard.first().click(); await page.waitForTimeout(1400); }
}

/** Engagement → SOX testing → into the interim audit, where the audit tabs live.
 *  The control page drops the tab strip for a breadcrumb, so the ground rules
 *  are only reachable from the audit itself. */
async function openAlturaAudit(page: Page) {
  await openFromLibrary(page, ALTURA);
  await page.waitForTimeout(700);
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(900);
  await main.getByRole('button', { name: 'Open CY 2026 audit' }).filter({ hasText: '02 Jan 2026' }).first().click();
  await page.waitForTimeout(1200);
  await expect(main.getByRole('button', { name: 'Dashboard', exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

test('switching aggregation off is drafted, reviewed and logged — never silent', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');

  // Into an audit, then its Configuration tab — where the ground rules live.
  await openAlturaAudit(page);
  await page.getByRole('main').getByRole('button', { name: 'Configuration', exact: true }).first().click();
  await page.waitForTimeout(1200);

  const aggregation = page.getByRole('switch', { name: 'Aggregation' }).or(page.getByLabel('Aggregation'));
  await aggregation.first().scrollIntoViewIfNeeded();
  await aggregation.first().click();
  await page.waitForTimeout(400);

  // 1 · nothing has moved yet
  const pending = page.getByText('Not saved yet').first();
  await expect(pending).toBeVisible({ timeout: 10_000 });

  // 2 · the review names the switch, and will not apply without a reason
  await page.getByRole('button', { name: /Review & apply/ }).click();
  await page.waitForTimeout(500);
  const modal = page.locator('.modal');
  await expect(modal.getByText('Aggregation', { exact: true }).first()).toBeVisible();
  await expect(modal.getByText('On', { exact: true }).first()).toBeVisible();
  await expect(modal.getByText('Off', { exact: true }).first()).toBeVisible();
  const apply = modal.getByRole('button', { name: 'Apply the change' });
  await expect(apply).toBeDisabled();

  await modal.getByRole('textbox').fill('Aggregation withdrawn for the interim round — findings are being judged standalone.');
  await expect(apply).toBeEnabled();
  await apply.click();
  await page.waitForTimeout(900);

  // 3 · it is on the record, with the reason against it
  await expect(page.getByText('Changes to the ground rules').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Aggregation On → Off/).first()).toBeVisible();
  await expect(page.getByText(/judged standalone/).first()).toBeVisible();
});

test('a validation that contradicts an attestation stands over it', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAlturaControl(page, 'New payee setup independently verified');

  // Work the first operating attribute: fail it, validate the file against it
  // (the validation reads the attribute's own state, so it concludes Fail too),
  // then attest the opposite and watch the file win.
  const failBtn = page.getByRole('button', { name: 'Fail', exact: true }).first();
  await failBtn.scrollIntoViewIfNeeded();
  await failBtn.click();
  await page.waitForTimeout(500);

  const aiTab = page.getByRole('button', { name: 'AI validation' }).first();
  if (await aiTab.count()) { await aiTab.click(); await page.waitForTimeout(400); }
  const upload = page.getByRole('button', { name: /^(Upload file|Replace)$/ }).first();
  if (await upload.count()) { await upload.click(); await page.waitForTimeout(500); }

  const run = page.getByRole('button', { name: /Run AI validation|Re-run/ }).first();
  await run.scrollIntoViewIfNeeded();
  await run.click();
  // the mocked validation takes four seconds on purpose
  await page.waitForTimeout(6000);

  // Now attest the opposite.
  const attestToggle = page.getByRole('switch', { name: 'Toggle self-attestation' }).or(page.getByLabel('Toggle self-attestation'));
  await attestToggle.first().scrollIntoViewIfNeeded();
  await attestToggle.first().click();
  await page.waitForTimeout(400);
  const note = page.getByPlaceholder(/Describe how this attribute is satisfied/).first();
  await note.fill('Walked the payee file with the finance lead — every setup had a second checker present.');
  // The attestation's own Pass — the first one after this note box in document
  // order. Every attribute on the page has two Pass buttons, so neither first()
  // nor last() lands on the card being worked.
  await note.locator('xpath=following::button[normalize-space()="Pass"][1]').click();
  await page.waitForTimeout(900);

  // The statement is kept; the result is not moved by it.
  await expect(page.getByText(/an attestation supports evidence, it does not overrule it/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/second checker present/).first()).toBeVisible();
  await expect(page.getByText('Attested Pass').first()).toBeVisible();
  // And the attribute still reads Fail: the tickmark next to the attestation's
  // own chip is the validation's answer, not the attester's.
  await expect(note.locator('xpath=preceding::span[@aria-label="Fail"][1]')).toHaveCount(1);
});

test('refiltering hands the filter back instead of a blank form', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  // The shared payee control: mid-flight, population locked, sample drawn —
  // i.e. the state the PRD's edge case is actually discovered in.
  await openAlturaControl(page, 'New payee setup independently verified');

  const PROBE = 'Only the payees created through the group treasury desk, excluding the migrated master.';

  // 1 · drop the extract and put a filter of our own on it
  const refilter = page.getByRole('button', { name: 'Refilter' }).first();
  await refilter.scrollIntoViewIfNeeded();
  await refilter.click();
  await page.waitForTimeout(500);
  const confirm = page.locator('.modal').getByRole('button', { name: 'Refilter' });
  if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(800); }

  const criteria = page.getByLabel('Extraction criteria');
  await expect(criteria).toBeVisible({ timeout: 10_000 });
  // the dropped filter came back, and the form says so rather than calling it a draft
  await expect(page.getByText('as you wrote it').first()).toBeVisible();
  await expect(criteria).toHaveValue(/New payees created/);
  await criteria.fill(PROBE);

  // Picking a file must not redraft over the sentence being corrected. (This
  // control's seeded source is not in the audit's registry, so the pick is
  // required here — which makes it the sharpest possible test of that rule.)
  const extract = page.getByRole('button', { name: /Extract again|Extract population/ });
  if (!(await extract.isEnabled())) {
    await page.getByRole('button', { name: /population_full_period\.xlsx/ }).first().click();
    await page.waitForTimeout(400);
    await expect(criteria).toHaveValue(PROBE);
  }
  await extract.click();
  await page.waitForTimeout(1400);

  // 2 · refilter again — what comes back is the sentence we wrote, verbatim
  const again = page.getByRole('button', { name: 'Refilter' }).first();
  await again.scrollIntoViewIfNeeded();
  await again.click();
  await page.waitForTimeout(500);
  const confirm2 = page.locator('.modal').getByRole('button', { name: 'Refilter' });
  if (await confirm2.count()) { await confirm2.click(); await page.waitForTimeout(800); }

  await expect(page.getByLabel('Extraction criteria')).toHaveValue(PROBE, { timeout: 10_000 });
  await expect(page.getByText('as you wrote it').first()).toBeVisible();
});
