import { test, expect } from './_helpers';
import type { Page } from '@playwright/test';
import { openFromLibrary } from './_sox_helpers';

/**
 * Sampling methodology — agreed once, for the whole engagement (feedback #22).
 *
 * The client's complaint: sample size was decided control by control, which is
 * "124 separate decisions, not a methodology". When a reviewer or an external
 * auditor asks what the sampling approach is, there has to be one answer.
 *
 * So the table, the selection method and the round basis are agreed on the
 * ENGAGEMENT — not on the audit (the approach does not change between the
 * interim and year-end rounds of one year) and not on the control. The lead
 * proposes it during engagement creation; the reviewer signs it afterwards on
 * the engagement's Configuration tab, and that signature is what makes it
 * agreed rather than merely configured.
 */

async function openEngagement(page: Page, name: string) {
  await page.goto('/');
  await openFromLibrary(page, name);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
});

test('the engagement carries one agreed methodology, signed by the reviewer', async ({ page }) => {
  test.setTimeout(120_000);
  await openEngagement(page, 'FY26 ICFR — Altura Infra Group');
  await page.getByRole('button', { name: 'Configuration', exact: true }).first().click();

  // Agreed means signed — and it says who signed it and when.
  await expect(page.getByText(/Agreed · v1 — signed by J\. Fernandes/)).toBeVisible({ timeout: 8000 });

  // The whole table is there, all seven frequencies.
  for (const f of ['Annual', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Recurring', 'Ad-hoc']) {
    await expect(page.getByText(f, { exact: true }).first()).toBeVisible();
  }
  // Ad-hoc is the one row that cannot be sized off a rhythm, and says so.
  await expect(page.getByText(/no fixed rhythm to size against/i)).toBeVisible();

  // The three methods, and the seed line that makes a draw reperformable.
  for (const m of ['Random', 'Systematic', 'Full population']) {
    await expect(page.getByText(m, { exact: true }).first()).toBeVisible();
  }

  // The round basis states its consequence on screen, not in a help page.
  await expect(page.getByText(/Each round draws its own sample from its own period/)).toBeVisible();
});

test('an agreed methodology cannot be edited in place — a change is a new version', async ({ page }) => {
  test.setTimeout(120_000);
  await openEngagement(page, 'FY26 ICFR — Altura Infra Group');
  await page.getByRole('button', { name: 'Configuration', exact: true }).first().click();
  await expect(page.getByText(/Agreed · v1/)).toBeVisible({ timeout: 8000 });

  // Change a cell of the signed table.
  const cell = page.getByRole('spinbutton').first();
  await cell.fill('9');
  await cell.blur();

  // It does not save quietly: it offers a revision, and says what that costs.
  const revise = page.getByRole('button', { name: /Review & revise/ });
  await expect(revise).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/creates .*v2/i).first()).toBeVisible();
  await revise.click();

  // The reason is mandatory — a version with no reason explains nothing.
  const confirm = page.getByRole('button', { name: /Create v2/ });
  await expect(confirm).toBeDisabled();
  await page.getByRole('textbox').last().fill('Larger monthly samples agreed with the external auditor for FY26.');
  await expect(confirm).toBeEnabled();
});

test('creation agrees the methodology once materiality and scope are settled', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'New Engagement' }).first().click();
  await page.waitForTimeout(500);

  const typeSheet = page.getByRole('dialog', { name: 'Create Engagement' });
  await expect(typeSheet).toBeVisible();
  await typeSheet.getByText('SOX / ICFR', { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(600);

  // Sampling sits after Scope, so it is agreed with materiality and scope known.
  await expect(page.getByText('Sampling', { exact: true }).first()).toBeVisible({ timeout: 8000 });
  // Six steps now, not five — the wizard opens on Basics because Type was
  // answered on the sheet before it.
  await expect(page.getByText(/Step \d of 6/)).toBeVisible();
});
