import { test, expect } from './_helpers';

const SHOTS = 'test-results/itgc-arrival';

/**
 * Everything R8.6 does, visible on arrival — no control has to be failed by hand
 * first. The Altura seed now carries DEF-A-06: the quarterly privileged-access
 * review concluded ineffective, which withdraws "test of one" across the
 * engagement.
 *
 * This spec is deliberately read-only. It opens screens and looks; it never
 * concludes, filters-and-leaves, or edits, so it can be run against a demo
 * without changing what the next person sees.
 */
type Page = import('@playwright/test').Page;

async function openAltura(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
}

async function intoTheAudit(page: Page) {
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.waitForTimeout(1400);
}

test('the ITGC failure and everything it causes are there on arrival', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAltura(page);

  // ① the engagement Control Library — ITGC controls, and the banner already up
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1300);
  await expect(page.getByText(/Test of one is withdrawn/).first()).toBeVisible();
  await expect(page.getByText('Privileged access reviewed quarterly.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-engagement-library.png`, fullPage: true });

  await intoTheAudit(page);

  // ② the audit Dashboard — same banner, above the health meters
  await page.getByText('Dashboard', { exact: true }).first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText(/Test of one is withdrawn/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Show the \d+ affected/ }).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-dashboard.png`, fullPage: true });

  // ③ Deficiency management — the finding behind it, on the record
  await page.getByText('Deficiency management', { exact: true }).first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText(/quarterly privileged-access review/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-deficiency.png`, fullPage: true });

  // ④ the audit Control Library — banner over the register
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1400);
  await expect(page.getByText(/Test of one is withdrawn/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-audit-library.png`, fullPage: true });

  // ⑤ an affected automated control — the notice, and the sample sized as manual
  await page.getByPlaceholder(/Search controls/).fill('Bank reconciliations');
  await page.waitForTimeout(900);
  await page.locator('tr.reg-row').first().click();
  await page.waitForTimeout(1600);
  await expect(page.getByText(/Test of one is withdrawn — an IT general control has failed/).first()).toBeVisible();
  await expect(page.getByText('Privileged access reviewed quarterly.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-affected-control.png`, fullPage: true });

  // ⑥ the three steps an automated control had short-formed away are back — and
  //    back EMPTY, which is the whole point: work to do, not work already done.
  //
  //    The sizing paragraph that names the ITGC (see SampleExtractSection) sits
  //    inside the Sample step and cannot render yet: there is no sample size to
  //    explain until a population is extracted and locked. That is why the notice
  //    at the top of the page exists — on arrival IT is what names the culprit,
  //    and the sizing line repeats it later, next to the draw it justifies.
  for (const title of ['Population', 'Sample', 'TOE']) {
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  }
  await page.getByText('Population', { exact: true }).first().scrollIntoViewIfNeeded();
  await expect(page.getByText('No population yet — the auditor filters it out of the source data.')).toBeVisible();
  await expect(page.getByText('Unlocks once the population locks')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/06-steps-are-back.png`, fullPage: true });
});
