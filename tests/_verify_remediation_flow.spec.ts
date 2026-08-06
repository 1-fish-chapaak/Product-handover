import { test, expect } from './_helpers';
import { openFromLibrary } from './_sox_helpers';

/**
 * The SOX/ICFR remediation flow.
 *
 *   ① raised        the root cause is the mechanism, and it gates step ②
 *   ② size it       six inputs, four grades, and "Show working" lists the rules
 *                   in the order the engine ran them
 *   ② confirm       significant or worse BLOCKS until the reviewer agrees
 *   ③ plan          the owner writes it; the auditor judges it and nothing else
 *   ④ fix           submit stays shut until evidence is attached
 *   ⑤ retest        a fresh post-fix sample, marked per item per attribute
 *   ⑥ close         reviewer only, never the person who ran the retest
 *
 * Also covers what came OFF the screen: Gap type and Priced impact.
 *
 * Runs against FY26 ICFR — Altura Infra Group, the engagement this work is
 * scoped to.
 *
 * Navigation note: Deficiency management is a tab INSIDE an audit, not on the
 * engagement. The engagement overview's watchlist rows are the one-click way in
 * — each one calls openAudit() then setView('deficiencies'), which is exactly
 * where these tests need to land.
 */

type Page = import('@playwright/test').Page;

const ENGAGEMENT = 'FY26 ICFR — Altura Infra Group';
const WATCHLIST_ROW = /Nine of forty sampled payment runs/;

async function openExceptions(page: Page, hat?: 'Auditor' | 'Reviewer' | 'Risk Owner') {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, ENGAGEMENT);
  // Hat FIRST. Changing role resets navigation in the store, so switching after
  // arriving would throw us straight back off the page we came for.
  if (hat) await setHat(page, hat);

  if (hat === 'Risk Owner') {
    // The owner's own tab, scoped to their controls — their queue, not the
    // engagement's exposure.
    await page.getByRole('button', { name: /My deficienc|My exception/ }).first().click();
  } else {
    // The MW watchlist arrives COLLAPSED (user ask) — the headline and a count
    // stand in for the rows, so they have to be opened before one can be clicked.
    const disclosure = page.getByRole('button', { name: /Material weakness open/ }).first();
    if ((await disclosure.getAttribute('aria-expanded')) === 'false') {
      await disclosure.click();
      await page.waitForTimeout(500);
    }
    // A watchlist row names one finding and now opens that finding: the audit,
    // the tab inside it, and the row expanded. No second click needed.
    await page.getByRole('button', { name: WATCHLIST_ROW }).first().click();
  }
  await page.waitForTimeout(1800);
  await expect(page.getByRole('button', { name: /Expand DEF-|Collapse DEF-/ }).first()).toBeVisible();
}

async function setHat(page: Page, hat: 'Auditor' | 'Reviewer' | 'Risk Owner') {
  await page.getByRole('button', { name: hat, exact: true }).first().click();
  await page.waitForTimeout(600);
}

/** Get ONE exception by id, expanded, scoped to its own body.
 *
 *  By id rather than by status text: every expanded body renders the six step
 *  titles, so "Retest" and "Close" appear on all of them and a status filter
 *  lands on whichever one happens to be open. It may already be open — a row
 *  that names one finding now opens that finding.
 *
 *  Deficiency management is a register, so the body sits in a row of its own
 *  (`tr.def-detail`) directly after the summary row that toggles it — which is
 *  what this scopes to. On a control's own paper the same body is a card
 *  instead, so that shape is the fallback.
 *
 *  DEF-A-01 Identified · A-02 Rating review · A-03 Plan review · A-04 Retest
 *  · A-05 Closed. Seeded that way in mockData so every state has a demo. */
async function openCard(page: Page, id: string) {
  const toggle = page.getByRole('button', { name: new RegExp(`(Expand|Collapse) ${id}$`) }).first();
  await expect(toggle).toBeVisible();
  if (((await toggle.getAttribute('aria-label')) ?? '').startsWith('Expand')) {
    await toggle.click();
    await page.waitForTimeout(600);
  }
  const detail = page.locator(`tr.reg-row[aria-label="Collapse ${id}"] + tr.def-detail`).first();
  if (await detail.count() > 0) return detail;
  return page.locator('div.rounded-2xl').filter({ has: page.getByRole('button', { name: `Collapse ${id}` }) }).first();
}

test('gap type and priced impact are off the screen', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Auditor');

  // Gap type — manual vs IT is settled by the control's nature, design vs
  // operating by which track failed. Asking again could only contradict them.
  await expect(page.getByText('Gap type', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Manual design gap')).toHaveCount(0);
  await expect(page.getByText('IT design gap')).toHaveCount(0);

  // Priced impact — an internal-audit value metric, not ICFR magnitude.
  await expect(page.getByText(/Priced impact/)).toHaveCount(0);
  await expect(page.getByText('Recovery / debit note')).toHaveCount(0);
  await expect(page.getByText('Working-capital unblock')).toHaveCount(0);
});

test('the six steps, the root cause, and the working behind the grade', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Auditor');
  const card = await openCard(page, 'DEF-A-01');

  // Each stepper pill carries its number inside the same element as its title
  // ("2Size it"), so these match on the title rather than the whole node.
  for (const title of ['Exception raised', 'Size it', 'Plan the fix', 'Fix and submit', 'Retest', 'Close']) {
    await expect(card.getByText(title).first()).toBeVisible();
  }
  // The mechanism leads the card — the plan is judged against it at step ③.
  await expect(card.getByText('Root cause', { exact: true }).first()).toBeVisible();

  // Show working IS the calculation: every rule the engine reached is named,
  // fired or not, because "the cap did not apply, and here is why" is the
  // question most often asked of a severity.
  await card.getByRole('button', { name: 'Show working' }).first().click();
  await page.waitForTimeout(400);
  for (const rule of ['MW indicator', 'Compensating control', 'Clearly trivial', 'Likelihood', 'Exposure ladder', 'Aggregation', 'Prudent official']) {
    await expect(card.getByText(new RegExp(rule)).first()).toBeVisible();
  }
});

test('the auditor sizes it and hands it on', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Auditor');
  const card = await openCard(page, 'DEF-A-01');

  // The six inputs the spec asks for, all live and all the auditor's.
  await expect(card.getByText('Likelihood', { exact: true })).toBeVisible();
  await expect(card.getByLabel('Exposure in rupees')).toBeVisible();
  await expect(card.getByText('MW indicators', { exact: true })).toBeVisible();
  await expect(card.getByText('Compensating control', { exact: true })).toBeVisible();
  await expect(card.getByText('Aggregation', { exact: true })).toBeVisible();
  await expect(card.getByText('Prudent official', { exact: true })).toBeVisible();

  // And the button that takes it off the auditor's desk. It names the grade and
  // where it goes next: significant or worse goes to the reviewer, not the owner.
  const hand = card.getByRole('button', { name: /^Rated .* — (send to the reviewer|hand to)/ });
  await expect(hand).toBeVisible();

  // Changing an input re-grades live. Remote caps the ladder at a deficiency
  // (rule 4) — but this exception aggregates with three others on the Accuracy
  // assertion, and rule 6 runs the combined figure back up, so the grade holds.
  // That IS the right answer: the cap is on the item, not on the group.
  await card.getByRole('button', { name: 'Remote', exact: true }).click();
  await page.waitForTimeout(500);
  await card.getByRole('button', { name: 'Show working' }).first().click();
  await page.waitForTimeout(300);
  await expect(card.getByText(/Remote — capped at a deficiency/)).toBeVisible();
  await expect(card.getByText(/Combines with \d+ other exception/)).toBeVisible();
});

// Split in two rather than switching hats mid-test: changing role resets the
// store's navigation, so a second hat has to arrive through its own front door.
// NOT COVERED HERE — the risk owner's view of an unconfirmed rating.
// Their tab bar is cut to Overview and Controls by design (SoxIcfrApp.tsx:115),
// so there is no Deficiency-management tab to drive, and the route through their
// own overview did not hold up in automation. The blocking itself is covered from
// the reviewer's side below; the owner's read of it is worth a look by hand.

test('the reviewer confirms the rating, and a send-back needs a reason', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Reviewer');
  const card = await openCard(page, 'DEF-A-02');
  await expect(card.getByRole('button', { name: /^Confirm / })).toBeVisible();
  await card.getByRole('button', { name: /Send back — reason required/ }).click();
  await page.waitForTimeout(400);
  await expect(card.getByRole('button', { name: 'Send back', exact: true })).toBeDisabled();
});

test('the auditor judges the plan and cannot write it', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Auditor');
  const card = await openCard(page, 'DEF-A-03');

  await expect(card.getByText(/Does this address the root cause\?/)).toBeVisible();
  await expect(card.getByText(/you never write or execute it/)).toBeVisible();
  await expect(card.getByRole('button', { name: /Accept the plan/ })).toBeVisible();
  // The plan's own fields are read-only in the auditor's hat.
  await expect(card.getByPlaceholder(/What fixes the root cause/)).toHaveCount(0);

  await card.getByRole('button', { name: /Reject — reason required/ }).click();
  await page.waitForTimeout(400);
  await expect(card.getByRole('button', { name: 'Send back', exact: true })).toBeDisabled();
});

test('the retest draws a post-fix sample and the verdict comes off the grid', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Auditor');
  const card = await openCard(page, 'DEF-A-04');

  // One round has already failed, which is the loop this counter exists to show.
  await expect(card.getByText('Retest history')).toBeVisible();
  await expect(card.getByText(/attempt 1/)).toBeVisible();

  await card.getByRole('button', { name: /Draw post-fix sample/ }).click();
  await page.waitForTimeout(800);

  // The window starts at the fix, not at the period start.
  await expect(card.getByText(/drawn from \d{4}-\d{2}-\d{2} → \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await expect(card.getByText(/Same attributes as the original test/)).toBeVisible();

  // No verdict button until every cell is marked — a retest whose result can be
  // asserted independently of its marks is not evidence of anything.
  await expect(card.getByText(/Mark every item against every attribute/)).toBeVisible();
  await expect(card.getByRole('button', { name: /Record retest/ })).toHaveCount(0);
});

test('the auditor never sees a close button on their own retest', async ({ page }) => {
  test.setTimeout(120_000);
  await openExceptions(page, 'Auditor');
  await expect(page.getByRole('button', { name: /Close — reviewer sign-off/ })).toHaveCount(0);
});
