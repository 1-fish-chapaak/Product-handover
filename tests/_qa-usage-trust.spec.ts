/**
 * Platform Usage — the trust contract (PRD S5).
 *
 * "A count here that disagrees with the screen that owns it: zero. One case is a
 * bug, not a variance."
 *
 * These are the three ways the page was caught breaking that rule. Each one was
 * a number that was individually defensible and collectively incoherent, which
 * is the only kind of bug that actually destroys a dashboard: nothing throws,
 * nothing looks broken, and the admin quietly stops believing any of it.
 */
import { test, expect, usageTab } from './_helpers';

async function openUsage(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.locator('button[aria-label="Pin sidebar open"]').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.locator('nav button', { hasText: 'Platform Usage' }).click();
  await page.waitForTimeout(1800);
}

/** Pull the first integer/percentage out of a matched string. */
const num = (s: string | null) => Number((s ?? '').replace(/[^0-9]/g, ''));

test('AI share has exactly one definition across the page', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);

  // Overview's KPI: AI actions ÷ all actions. Read off the tile's own aria-label
  // ("AI-assisted work: 11% 58 of 525. …"), which carries the value verbatim —
  // the visible figure is animated by KpiCountUp and is not a stable text node.
  const label = await page
    .locator('[aria-label^="AI-assisted work:"]')
    .first()
    .getAttribute('aria-label');
  const kpiPct = num((label ?? '').match(/(\d+)%/)?.[1] ?? '');
  expect(kpiPct, 'the AI KPI should print a share').toBeGreaterThan(0);

  // The People tab's AI card prints the same share, now as a labelled bar rather
  // than a sentence: "AI-assisted · 11%". It used to say 12% where the KPI said
  // 11% — because it divided by aiActivity (AI actions PLUS saved conversations),
  // and a saved conversation is not an audit action, so it is not in the
  // denominator. One fact, two numbers, no way to tell which. The label carries
  // the value verbatim, so read it there.
  await usageTab(page, 'People');
  const barLabel = await page.getByText(/AI-assisted · \d+%/).first().textContent();
  const cardPct = num((barLabel ?? '').match(/(\d+)%/)?.[1] ?? '');

  expect(cardPct, 'the AI share must be the same number wherever the page prints it').toBe(kpiPct);

  // And the conversations are still counted — just not folded into the share.
  await expect(page.getByText(/saved conversations? counted separately, not as work/)).toBeVisible();
});

test('Sections says which of its numbers the date range governs', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);
  await usageTab(page, 'Areas');

  // The tab states the rule once...
  await expect(page.getByText(/Cards marked .* follow the date range above/)).toBeVisible();

  // ...and every card carries its own scope, because the mix is real: Ask IRA is
  // a function of the window; the Control Library is a register and cannot be.
  await expect(page.getByText('All time').first()).toBeVisible();
  await expect(page.getByText('This period').first()).toBeVisible();

  // The Reports card is a register: it holds the whole report book. It must not
  // wear a flow verb, because the Overview headline "Reports produced" counts a
  // DIFFERENT thing (the reports made inside the window) and the two numbers
  // disagree by design. "Reports generated: 23" beside "Reports produced: 7" is
  // the page appearing to contradict itself.
  await expect(page.getByText('Reports in the library')).toBeVisible();
  await expect(page.getByText('Reports generated')).toHaveCount(0);

  // Same trap, same fix: lifetime workflow runs vs the window's runs on Output.
  await expect(page.getByText('Runs, all time')).toBeVisible();
});

test('the all-time cards do not move when the date range does', async ({ page }) => {
  test.setTimeout(120000);
  await openUsage(page);
  await usageTab(page, 'Areas');

  const reportsCard = page.locator('button', { hasText: 'Reports in the library' }).first();
  // The card's THREE FIGURES are the register. Its footer activity line is not —
  // that one is windowed on purpose, and it is the card's only windowed mark.
  const figures = reportsCard.locator('dl');
  const before = await figures.textContent();

  // Swing the range.
  await page.getByRole('button', { name: /^Date range:/ }).click();
  await page.getByRole('button', { name: /^Last 7 days\b/ }).click();
  await page.waitForTimeout(1200);

  const after = await figures.textContent();
  // The register genuinely should NOT move. The point is that the card now SAYS
  // so, instead of leaving the reader to discover it and conclude the page is
  // broken.
  expect(after, 'a register total must be stable across ranges — and labelled as such').toBe(before);
  await expect(reportsCard.getByText('All time')).toBeVisible();

  // ...while the activity line at its foot DOES move, because that one is the
  // window. One card, two clocks, and now both of them are declared.
  await expect(reportsCard.getByText(/actions this period/)).toBeVisible();
});
