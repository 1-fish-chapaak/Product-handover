import { expect } from './_helpers';

type Page = import('@playwright/test').Page;

/**
 * The one door to the SOX scoping journey since the SOX Testing sidebar entry
 * was parked: Engagements → Create Engagement → pick SOX / ICFR → Next hands
 * off to the scoping side sheet (Type step dropped). Walks Basics → Scoping
 * (bulk file upload via the native picker — three files auto-classify to the
 * RACM / TB / GL requirements) → Review → Create. Ends back on the library
 * with the new engagement at the top.
 */
export async function createSoxEngagement(page: Page, name: string, opts?: { skipScoping?: boolean }) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);

  const typeSheet = page.getByRole('dialog', { name: 'Create Engagement' });
  await expect(typeSheet).toBeVisible();
  await typeSheet.getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  // Scoping sheet, opened on Basics (Type answered on the classic sheet).
  //
  // Basics gates on identity AND on the entities question being answered — the
  // code and the group name are pre-filled, but the entity table starts empty and
  // an empty table is not an answer. "There are no separate entities" is the
  // answer for a single-company audit, and it is what makes Continue enabled.
  // Without it this helper clicked a disabled button until it timed out.
  await page.getByPlaceholder('e.g. P2P — SOX Q3 Testing').fill(name);
  await page.getByRole('checkbox', { name: /no separate entities/i }).click();
  await page.waitForTimeout(200);
  const basicsNext = page.getByRole('button', { name: 'Continue' });
  await expect(basicsNext).toBeEnabled();
  await basicsNext.click();
  await page.waitForTimeout(400);

  // The Scoping step is parked (SCOPING_STEP = false in ScopingWizard), so Basics
  // hands straight to Review: there is no recommended-files card to feed and no
  // "Skip for now" to press. `skipScoping` stays on the signature because callers
  // still pass it, and it is a no-op until that step comes back — every engagement
  // this helper creates now arrives without a RACM either way.
  void opts?.skipScoping;

  // FY is derived from today's date at creation, so don't hard-code the year.
  await page.getByRole('button', { name: /^Create FY\d+ programme$/ }).click();
  await page.waitForTimeout(900);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Step 2 of the control page — Test the report (IPE) — walked to Reliable.
 *
 * The population now comes out of a report the client ran, and that report is
 * tested before anything is sampled from it: the sample step is locked until this
 * concludes Reliable. Register (the form arrives pre-filled from the control's
 * sub-process), pass all three checks — source & parameters, completeness,
 * accuracy — then conclude. Every check has to pass; one failure sinks the report.
 *
 * Call this after concluding the design effective and before touching the sample.
 */
export async function concludeIpeReliable(page: Page) {
  const register = page.getByRole('button', { name: 'Register and start testing' });
  if (await register.count() > 0) {
    await expect(register).toBeEnabled();
    await register.click();
    await page.waitForTimeout(600);
  }

  // Scope each Pass click to its own check card — the attribute rows further down
  // the page carry Pass buttons too, and an unscoped click lands on the wrong one.
  for (const dimension of ['Source & parameters', 'Completeness', 'Accuracy']) {
    const card = page.locator('.subcard').filter({ hasText: dimension }).first();
    await card.getByRole('button', { name: 'Pass', exact: true }).click();
    await page.waitForTimeout(200);
  }

  const conclude = page.getByRole('button', { name: /^Reliable — continue$/ });
  await expect(conclude).toBeEnabled();
  await conclude.click();
  await page.waitForTimeout(600);
}

/** Library card click → the SOX workspace. The Engagements page opens on its
 * Overview tab; the cards live on the All Engagements tab.
 *
 * `goto('/')` lands on Home, not Engagements, so the tab this used to click
 * straight away doesn't exist yet — every caller was timing out on it. Navigate
 * first, but only when the tab isn't already there, so callers that are already
 * deep in the library still work. */
export async function openFromLibrary(page: Page, name: string) {
  const libraryTab = page.getByRole('tab', { name: /All Engagements/ });
  if (await libraryTab.count() === 0) {
    await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
    await page.waitForTimeout(900);
  }
  await libraryTab.click();
  await page.waitForTimeout(700);
  await page.getByText(name).first().click();
  await page.waitForTimeout(1100);
  await expect(page.getByRole('heading', { name })).toBeVisible();
}
