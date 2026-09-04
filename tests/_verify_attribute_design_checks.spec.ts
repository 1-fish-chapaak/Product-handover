import { test, expect } from './_helpers';

const SHOTS = 'test-results/attribute-design-checks';

/**
 * Design checks sit under the attribute they are about.
 *
 * The dev call: "हर एट्रिब्यूट का अपना चेक होगा". The prototype already defined
 * attributes once and proved them twice — the walkthrough tests each attribute
 * for design, the sample tests each attribute for operation (see Walkthrough in
 * types.ts). The design CHECKS were the one part of TOD sitting outside them.
 *
 * Both kinds now share one array and one set of controls: a check with a stepId
 * is about one attribute, a check without is about the control as a whole. Both
 * were kept on purpose — "does this control address the risk" and "is this
 * attribute designed to happen" are different questions, and a design test that
 * can only ask one of them can only fail for one reason.
 */
type Page = import('@playwright/test').Page;

async function openAuditControl(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Payment runs approved by two authorisers.').first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1500);
}

test('TOD groups its checks by what they are about', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditControl(page);

  await page.getByText('Design checks').first().scrollIntoViewIfNeeded();
  await expect(page.getByText('Design checks').first()).toBeVisible();

  // ── the control-level pair, under a heading that says so ──────────────────
  await expect(page.getByText('The control as a whole').first()).toBeVisible();
  await expect(page.getByText('Control addresses the stated risk and assertion.').first()).toBeVisible();
  await expect(page.getByText('Control operates at sufficient precision.').first()).toBeVisible();

  // ── and one group per attribute, headed by the attribute itself ───────────
  // The attribute codes are 1.1, 1.2, … — the same codes TOE tests against, and
  // the same ones the walkthrough already used. One vocabulary, not two.
  await expect(page.getByText(/designed to happen, at /).first()).toBeVisible();
  const attrChecks = await page.getByText(/designed to happen, at /).count();
  expect(attrChecks).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/01-grouped.png`, fullPage: true });

  // Every attribute-level check is headed by its attribute code, so a reader can
  // tell which of the control's several duties the check is about.
  const codes = page.locator('span.font-mono').filter({ hasText: /^\d+\.\d+$/ });
  expect(await codes.count()).toBeGreaterThanOrEqual(attrChecks);

  // ── adding a check asks what it is about ──────────────────────────────────
  const add = page.getByRole('button', { name: 'Add a design check' }).first();
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await page.waitForTimeout(600);
  const target = page.getByLabel('What this check is about');
  await expect(target).toBeVisible();
  // The control as a whole is the default — a check filed under an attribute it
  // is not about reads as a test of something that never happened.
  await expect(target).toHaveValue('');
  await page.screenshot({ path: `${SHOTS}/02-add-asks-target.png`, fullPage: true });
});

test('the suggestion library still offers control-level checks', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  await openAuditControl(page);

  // suggestedDesignChecks decides "already covered" on keyword overlap, so
  // letting attribute checks into that corpus would have retired real
  // suggestions on a coincidence of wording — an attribute check mentioning
  // exceptions would have killed the library's own exceptions check. It reads
  // control-level checks only, and the panel still has something to offer.
  await expect(page.getByText('Ira read this control.').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/03-suggestions-survive.png`, fullPage: true });
});
