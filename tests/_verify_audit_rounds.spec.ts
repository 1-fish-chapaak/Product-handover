import { test, expect } from './_helpers';
import { fillAuditPeriod, openFromLibrary } from './_sox_helpers';

/**
 * Audit rounds and the financial year — the rules the New audit sheet enforces:
 *
 *  - round availability reads the chosen year's history, and a disabled round
 *    says why (interim blocked by a year-end; roll-forward until a CONCLUDED
 *    interim exists; year-end blocked only by another year-end);
 *  - Roll forward buttons open this same sheet prefilled — the standalone
 *    roll-forward sheet is gone — and a year-end rolls into the NEXT year's
 *    interim;
 *  - the full roll-forward path: derived locked dates (parent's cut-off + 1 day
 *    to the year end), materiality inherited read-only, scope restricted to the
 *    parent's effective controls.
 *
 * Runs against FY26 ICFR — Altura Infra Group (SOX-104). Its seeds: CY 2026
 * interim (live, unsigned), CY 2026 roll-forward (planned), CY 2025 year-end
 * (signed + archived) — which covers every gate state without any setup.
 */

type Page = import('@playwright/test').Page;

const ENGAGEMENT = 'FY26 ICFR — Altura Infra Group';

async function openSoxTesting(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, ENGAGEMENT);
  await page.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(600);
}

async function openWizard(page: Page) {
  await page.getByRole('button', { name: /New audit/ }).first().click();
  await page.waitForTimeout(500);
  const sheet = page.getByRole('dialog', { name: 'New audit' });
  await expect(sheet).toBeVisible();
  return sheet;
}

test('round availability reads the chosen year, and disabled rounds say why', async ({ page }) => {
  test.setTimeout(120_000);
  await openSoxTesting(page);
  const sheet = await openWizard(page);

  // CY 2026 — an interim exists but is unsigned, so Roll-forward is still
  // gated, with the sharper of its two reasons.
  await sheet.getByRole('button', { name: 'Jan – Dec', exact: true }).click();
  await page.waitForTimeout(300);
  await expect(sheet.getByRole('button', { name: 'Financial year' })).toContainText('CY 2026');
  await expect(sheet.getByRole('button', { name: 'Interim', exact: true })).toBeEnabled();
  await expect(sheet.getByRole('button', { name: 'Year-end', exact: true })).toBeEnabled();
  await expect(sheet.getByRole('button', { name: 'Roll-forward', exact: true })).toBeDisabled();
  await expect(sheet.getByText('Sign off the CY 2026 interim first — a roll-forward extends a concluded interim.')).toBeVisible();

  // CY 2025 — a signed year-end covers the whole year: interim and year-end
  // both lock, each with its own reason.
  await sheet.getByRole('button', { name: 'Financial year' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name: /CY 2025/ }).click();
  await page.waitForTimeout(300);
  await expect(sheet.getByRole('button', { name: 'Interim', exact: true })).toBeDisabled();
  await expect(sheet.getByRole('button', { name: 'Year-end', exact: true })).toBeDisabled();
  await expect(sheet.getByText('A year-end audit already covers CY 2025.')).toBeVisible();
  await expect(sheet.getByText('A year-end audit already exists for CY 2025.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Roll-forward', exact: true })).toBeDisabled();
  await expect(sheet.getByText('Create and conclude an interim audit for CY 2025 first.')).toBeVisible();
});

test('roll forward on a year-end prefills the next year\'s interim in the same sheet', async ({ page }) => {
  test.setTimeout(120_000);
  await openSoxTesting(page);

  // The CY 2025 row's Roll forward — a concluded year-end, so the next pass is
  // the NEXT year's interim.
  await page.getByRole('button', { name: /Roll forward/ }).last().click();
  await page.waitForTimeout(600);
  const sheet = page.getByRole('dialog', { name: 'New audit' });
  await expect(sheet).toBeVisible();

  // Prefilled: CY 2026, Interim already picked (its hint shows), From at the
  // year start, the cut-off left to the auditor.
  await expect(sheet.getByRole('button', { name: 'Financial year' })).toContainText('CY 2026');
  await expect(sheet.getByText('Tests the first part of the period, well before the year end.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: '01/01/2026' })).toBeVisible();
  await expect(sheet.getByText('To — interim cut-off')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Continue/ })).toBeDisabled();
});

test('the roll-forward path: locked derived dates, inherited materiality, restricted scope', async ({ page }) => {
  test.setTimeout(240_000);
  await openSoxTesting(page);

  // ── Make the CY 2026 interim concluded ──────────────────────────────────
  // Creating any new audit archives the outgoing live cycle (createAudit), and
  // an archived audit IS concluded — so a fresh FY 2026-27 interim, created
  // through the wizard like a user would, unlocks CY 2026's roll-forward
  // without touching a single sign-off.
  let sheet = await openWizard(page);
  await fillAuditPeriod(page, sheet);
  await sheet.getByRole('button', { name: /Continue/ }).click();      // → Materiality & files
  await page.waitForTimeout(400);
  await sheet.getByRole('button', { name: /Continue/ }).click();      // → Scope
  await page.waitForTimeout(500);
  await expect(sheet.getByText(/entities in scope/)).toBeVisible();
  await sheet.getByRole('button', { name: /Continue/ }).click();      // → Review
  await page.waitForTimeout(400);
  await sheet.getByRole('button', { name: /Create/ }).last().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('dialog', { name: 'New audit' })).toHaveCount(0);

  // Get back to the engagement's SOX testing tab. Which side of the app the
  // create lands on varies by shell — inside the new audit's workspace (whose
  // breadcrumb carries the engagement name) or straight back on the register —
  // so walk out only if there is a breadcrumb to walk.
  await page.waitForTimeout(800);
  const crumb = page.getByRole('button', { name: ENGAGEMENT });
  if (await crumb.count()) {
    await crumb.first().click();
    await page.waitForTimeout(800);
  }
  const soxTab = page.getByRole('button', { name: 'SOX testing', exact: true });
  if (await soxTab.count()) {
    await soxTab.first().click();
    await page.waitForTimeout(600);
  }
  await expect(page.getByRole('button', { name: /New audit/ }).first()).toBeVisible();

  // ── The roll-forward, end to end ────────────────────────────────────────
  sheet = await openWizard(page);
  await sheet.getByRole('button', { name: 'Jan – Dec', exact: true }).click();
  await page.waitForTimeout(300);
  const rf = sheet.getByRole('button', { name: 'Roll-forward', exact: true });
  await expect(rf).toBeEnabled();
  await rf.click();
  await page.waitForTimeout(400);

  // Parent named, dates derived and locked: the day after the interim's 30 Jun
  // cut-off, to the year end. No picker on either — nothing to edit.
  await expect(sheet.getByRole('button', { name: 'Parent interim audit' })).toContainText('CY 2026 interim');
  await expect(sheet.getByText('01 Jul 2026').first()).toBeVisible();
  await expect(sheet.getByText('31 Dec 2026').first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: /dd\/mm\/yyyy/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: /Continue/ }).click();      // → Materiality & files
  await page.waitForTimeout(400);

  // Materiality arrives inherited and read-only: the parent's ₹12 Cr, no basis
  // dropdown, no percentage inputs.
  await expect(sheet.getByText('Inherited')).toBeVisible();
  await expect(sheet.getByText(/Carried from the CY 2026 interim/)).toBeVisible();
  await expect(sheet.getByText('₹12.00 Cr').first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: /Materiality basis/i })).toHaveCount(0);
  await expect(sheet.getByLabel(/Performance materiality as a percentage/)).toHaveCount(0);
  await sheet.getByRole('button', { name: /Continue/ }).click();      // → Scope
  await page.waitForTimeout(500);

  // Scope is the parent's effective controls — no entity/RACM chooser — with
  // everything else excluded and told why.
  await expect(sheet.getByRole('button', { name: /By entity/ })).toHaveCount(0);
  await expect(sheet.getByText(/carried forward/).first()).toBeVisible();
  await expect(sheet.getByText(/Effective at interim — reduced sample/).first()).toBeVisible();
  await sheet.getByRole('button', { name: /Continue/ }).click();      // → Review
  await page.waitForTimeout(400);

  // Review says where the rule came from and what the scope is.
  await expect(sheet.getByText('from parent')).toBeVisible();
  await expect(sheet.getByText('Carried forward', { exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: /Create/ }).last().click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('dialog', { name: 'New audit' })).toHaveCount(0);
  await expect(page.getByText(/carried forward from the CY 2026 interim/)).toBeVisible();
});

test('the roll-forward demo engagement opens ready to roll', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY27 ICFR — Altura Renewables');
  await page.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(600);
  const sheet = await openWizard(page);

  // The seeded interim is countersigned, so Roll-forward is available on the
  // default year with no setup at all.
  const rf = sheet.getByRole('button', { name: 'Roll-forward', exact: true });
  await expect(rf).toBeEnabled();
  await rf.click();
  await page.waitForTimeout(400);

  // Parent picked, dates derived off its 31 Jul cut-off, both locked.
  await expect(sheet.getByRole('button', { name: 'Parent interim audit' })).toContainText('FY 2026-27 interim');
  await expect(sheet.getByText('01 Aug 2026').first()).toBeVisible();
  await expect(sheet.getByText('31 Mar 2027', { exact: true }).first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: /dd\/mm\/yyyy/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(400);

  // Inherited rule, and a scope split into carried vs excluded — the seed
  // leaves one control per process short of Effective on purpose.
  await expect(sheet.getByText('Inherited')).toBeVisible();
  await sheet.getByRole('button', { name: /Continue/ }).click();
  await page.waitForTimeout(500);
  await expect(sheet.getByText(/Effective at interim — reduced sample/).first()).toBeVisible();
  await expect(sheet.getByText('Not carried forward')).toBeVisible();
});

test('a signed interim claims no year opinion', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  await openFromLibrary(page, 'FY27 ICFR — Altura Renewables');
  await page.getByRole('button', { name: 'SOX testing', exact: true }).first().click();
  await page.waitForTimeout(600);

  // The register row itself says which pass this is and that it is closed —
  // "FY 2026-27 · Interim · Concluded" with its Roll forward button beside it.
  const row = page.getByRole('button', { name: 'Open FY 2026-27 audit' }).first();
  await expect(row.getByText('Interim', { exact: true })).toBeVisible();
  await expect(row.getByText('Concluded', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: /Roll forward/ })).toBeVisible();

  // The demo's interim is countersigned. Its sign-off panel concludes the
  // ROUND and defers the year — it must never print an ICFR verdict.
  await page.getByRole('button', { name: 'Open FY 2026-27 audit' }).first().click();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Interim concluded — carried to the year-end opinion')).toBeVisible();
  await expect(page.getByText('Concluded — ICFR effective')).toHaveCount(0);
});
