import { test, expect } from './_helpers';
import { createSoxEngagement } from './_sox_helpers';

const SHOTS = 'test-results/call-decisions';

/**
 * The three decisions the dev call left open, settled by the user afterwards.
 *
 *  #11 Not every file a control reads is a population. A vendor master joined
 *      onto a journal table is an ASSISTING table — proven like anything else,
 *      never sampled, and never counted as instances of the control.
 *  #21 An engagement with no RACM cannot start an audit at all. "ऑडिट पे नहीं
 *      आना चाहिए। ये गेटिंग लगाना पड़ेगा."
 *  #23 A task that names a step lands on that step, rather than at the top of a
 *      five-step page the reader then has to search.
 */
type Page = import('@playwright/test').Page;

async function openAltura(page: Page, description: string) {
  await page.getByRole('navigation').getByRole('button', { name: 'Engagements', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY26 ICFR — Altura Infra Group').first().click();
  await page.waitForTimeout(1300);
  await page.getByText('Control Library', { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.getByText(description).first().click();
  await page.waitForTimeout(1300);
  const runCard = page.getByRole('button').filter({ hasText: /Interim|Year-end|Roll-forward/ });
  await expect(runCard.first()).toBeVisible({ timeout: 15_000 });
  await runCard.first().click();
  await page.waitForTimeout(1500);
}

test('#11 an assisting table is proven, never sampled, never counted', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  // The payments control reads a journal extract AND a vendor master — the
  // call's own example: "वेंडर मास्टर इज ए असिस्टिंग टेबल… वेंडर मास्टर का
  // पापुलेशन ड्रा नहीं होगा, सिर्फ BKPF का ही होगा".
  await openAltura(page, 'Payment runs approved by two authorisers.');

  await expect(page.getByText('Source files · 2').first()).toBeVisible({ timeout: 15_000 });
  // Each file says what it IS to the control, on its own row.
  await expect(page.getByText('Population', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Assisting', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('joined by the workflow, never sampled').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-assisting-row.png`, fullPage: true });

  // Its rows are NOT instances of the control, so they are not in the total —
  // the figure the sample size gets judged against would otherwise be inflated
  // by a table nobody is testing.
  const headline = await page.getByText(/instances$/).first().textContent();
  expect(headline).not.toContain('2,293');   // 2,028 + the vendor master's 265

  // It is still proven. A join onto an unreliable table produces an unreliable
  // answer, so the four checks are asked of it like any other file.
  const ipeToggle = page.getByText('IPE test').first();
  await ipeToggle.scrollIntoViewIfNeeded();
  await ipeToggle.click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/vendor_master_.*\.xlsx/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-assisting-still-proven.png`, fullPage: true });

  // And the sample step names it rather than leaving a gap — a file that was in
  // the population step and is missing here reads as something forgotten.
  await expect(page.getByText(/is an assisting table — joined, not sampled/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/03-sample-step-names-it.png`, fullPage: true });
});

test('#21 no RACM, no audit', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  // A fresh SOX engagement has no matrix yet — RACMs are added from the RACM
  // tab — so it is exactly the state the call said should not reach an audit.
  await createSoxEngagement(page, 'FY27 ICFR — Gating check');
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: /All Engagements/ }).click();
  await page.waitForTimeout(800);
  await page.getByText('FY27 ICFR — Gating check').first().click();
  await page.waitForTimeout(1500);

  const newAudit = page.getByRole('button', { name: /New audit/ });
  await expect(newAudit.first()).toBeVisible({ timeout: 15_000 });
  await expect(newAudit.first()).toBeDisabled();
  // Disabled is not enough on its own — the button has to say what to do first,
  // or it reads as broken.
  await expect(page.getByText('Add a RACM first — an audit with no controls has nothing to test.').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-no-racm-no-audit.png`, fullPage: true });
});

test('#23 a task about the population lands on the population', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto('/');
  // One of this control's attributes still owes the file its workflow reads, so
  // the auditor can raise the ask. Treasury, because the owner hat lands on the
  // person who owns these controls — a task on somebody else's control is not
  // in their court and would not appear in their list at all.
  await openAltura(page, 'FX deals confirmed independently of dealing.');
  const ask = page.getByRole('button', { name: 'Ask the owner to upload' });
  await ask.first().scrollIntoViewIfNeeded();
  await ask.first().click();
  await page.waitForTimeout(900);

  // Now stand where the person who has to act stands. WITHOUT reloading — the
  // whole store is in memory, so a fresh page load would take the just-raised
  // task with it. Back out of the control, out of the audit, and change hats
  // on the engagement header, exactly as a person would.
  await page.getByRole('button', { name: 'Back', exact: true }).first().click();
  await page.waitForTimeout(900);
  const backToEng = page.getByRole('button', { name: /Back/ }).first();
  await backToEng.click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Risk Owner', exact: true }).click();
  await page.waitForTimeout(1200);

  const row = page.getByText('Upload the source data for this control').first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/05-task-raised.png`, fullPage: true });
  await row.click();
  // The scroll waits a beat for the step to mount, then rings it — a page that
  // scrolls somewhere without saying why looks like it loaded wrong.
  await page.waitForTimeout(1500);
  const step = page.locator('#vstep-population');
  await expect(step).toBeVisible();
  await expect(step).toHaveClass(/ring-2/);
  await page.screenshot({ path: `${SHOTS}/06-landed-on-population.png`, fullPage: true });
});
