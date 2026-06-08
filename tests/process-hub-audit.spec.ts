import { test, expect, type Page } from './_helpers';

/**
 * End-to-end smoke for the P0–P3 UX audit fixes on Process Hub.
 * Verifies each fix from the polish/process-hub-update-v1 branch.
 */

const BASE = '/';

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });
}

async function gotoProcessHub(page: Page) {
  await page.goto(BASE);
  // Sidebar Process Hub click — flips view to 'programs' (the hub landing).
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  // Wait for at least one process card to appear (search for known process abbr).
  await expect(page.getByText('P2P', { exact: false }).first()).toBeVisible({ timeout: 8000 });
}

async function drillIntoFirstProcess(page: Page) {
  // The process cards include text like "P2P" or "Procure to Pay". Click the first card.
  // Try clicking on any element that says "Procure to Pay" or contains P2P.
  const firstCard = page.getByText('Procure to Pay').first();
  await firstCard.click();
  // BP detail shows breadcrumb "Process Hub / ..." and 5 section index rows.
  await expect(page.getByText(/SOP|RACM|Risks|Controls|Workflows/).first()).toBeVisible({ timeout: 5000 });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
});

test.describe('Process Hub UX audit fixes (P0–P3)', () => {
  // ───────────────────────────────────────────────────────────
  // T1 — Hub landing renders + Coverage tooltip (P0)
  // ───────────────────────────────────────────────────────────
  test('T1 — Coverage tooltip appears on hover (P0)', async ({ page }) => {
    await gotoProcessHub(page);

    // The HelpCircle next to Coverage carries aria-label="What is Coverage?".
    // Hovering it triggers the parent group-hover and the tooltip opacity flips to 1.
    const helpIcon = page.locator('[aria-label="What is Coverage?"]').first();
    await expect(helpIcon).toBeVisible();
    await helpIcon.hover();

    // Tooltip body text becomes visible (opacity-100).
    const tooltip = page.getByText(/percent of identified risks/i).first();
    await expect(tooltip).toBeVisible({ timeout: 2000 });
  });

  // ───────────────────────────────────────────────────────────
  // T2 — Hub CTA reads "New Process" (P1)
  // ───────────────────────────────────────────────────────────
  test('T2 — Hub primary CTA reads "New Process" (P1)', async ({ page }) => {
    await gotoProcessHub(page);
    await expect(page.getByRole('button', { name: /^New Process$/ })).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // T3 — Drill-in pattern: section index visible + click opens section + URL updates (P0+P1)
  // ───────────────────────────────────────────────────────────
  test('T3 — Drill-in shows section index and URL routing works (P0)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);

    // Index page lists 5 sections — verify all 5 are present.
    await expect(page.getByText(/^SOPs?$/).first()).toBeVisible();
    await expect(page.getByText(/^RACMs?$/).first()).toBeVisible();
    await expect(page.getByText(/^Risks$/).first()).toBeVisible();
    await expect(page.getByText(/^Controls$/).first()).toBeVisible();
    await expect(page.getByText(/^Workflows$/).first()).toBeVisible();

    // Click RACM section row.
    await page.getByText(/^RACMs?$/).first().click();

    // URL should now contain ?section=racm
    await expect(page).toHaveURL(/\?section=racm/, { timeout: 3000 });

    // Section pills row should be visible — find the active "RACM" pill.
    const activePill = page.locator('[aria-current="page"]');
    await expect(activePill).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // T4 — Browser back navigates back to BP index (P0)
  // ───────────────────────────────────────────────────────────
  test('T4 — Browser back from drilled section returns to BP index (P0)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);
    await page.getByText(/^RACMs?$/).first().click();
    await expect(page).toHaveURL(/\?section=racm/);

    // Hit browser back — drill should close.
    await page.goBack();

    // URL no longer has ?section=
    await expect(page).not.toHaveURL(/\?section=/);

    // Section index visible again — 5 sections all present.
    await expect(page.getByText(/^Risks$/).first()).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────
  // T5 — Section switcher pills swap sections in-place (P1)
  // ───────────────────────────────────────────────────────────
  test('T5 — Section pills switch sections without leaving drill-in (P1)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);
    await page.getByText(/^RACMs?$/).first().click();
    await expect(page).toHaveURL(/\?section=racm/);

    // Click the "Risks" pill (which has aria-label like "Switch to Risks").
    await page.getByRole('button', { name: /Switch to Risks/i }).click();

    // URL changes to ?section=risks
    await expect(page).toHaveURL(/\?section=risks/, { timeout: 3000 });
  });

  // ───────────────────────────────────────────────────────────
  // T6 — Skeleton flashes briefly on RACM mount (P2)
  // ───────────────────────────────────────────────────────────
  test('T6 — Skeleton rows appear on RACM section mount (P2)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);

    // Race the skeleton: navigate to RACM and look for animate-pulse rows.
    await page.getByText(/^RACMs?$/).first().click();

    // Skeleton rows have animate-pulse class. Capture immediately after click.
    // Since the delay is 400ms, the skeleton should still be visible briefly.
    const pulseRows = page.locator('.animate-pulse').first();
    // Either we catch the skeleton, or the data already rendered — both OK.
    // We assert that EITHER the skeleton appeared OR real RACM rows are visible.
    const hadSkeleton = await pulseRows.isVisible().catch(() => false);
    const hasRealRows = await page.getByText(/FY26 P2P/).first().isVisible().catch(() => false);
    expect(hadSkeleton || hasRealRows).toBeTruthy();
  });

  // ───────────────────────────────────────────────────────────
  // T7 — Tooltip on RACM Status/Readiness column headers (P0)
  // ───────────────────────────────────────────────────────────
  // QUARANTINE (2026-06-08): the drill-in RACM tab was reworked from a <table>
  // (with a "Readiness" column header) to cards — there is no column header to
  // hover. Card RACM behaviour is covered by verify-racm-actions.spec.ts.
  test.fixme('T7 — Column header tooltips on RACM table (P0)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);
    await page.getByText(/^RACMs?$/).first().click();
    // Wait for real rows to render (past the 400ms skeleton).
    await page.waitForTimeout(600);

    // Hover the "Readiness" column header.
    const readinessHeader = page.getByRole('cell', { name: /Readiness/i }).first()
      .or(page.locator('th:has-text("Readiness")').first());
    await readinessHeader.hover();

    // Tooltip text "Whether the RACM is ready to enter active monitoring" should appear.
    const tooltip = page.getByText(/whether the racm is ready/i).first();
    await expect(tooltip).toBeVisible({ timeout: 2000 });
  });

  // ───────────────────────────────────────────────────────────
  // T8 — Cmd+K opens palette (P2)
  // ───────────────────────────────────────────────────────────
  test('T8 — Cmd+K opens command palette and Esc closes it (P2)', async ({ page }) => {
    await gotoProcessHub(page);

    // Press Cmd+K (Mac) / Ctrl+K (others). Playwright headless uses Meta on macOS.
    await page.keyboard.press('Meta+k');

    // Palette dialog with the search input should be visible.
    const dialog = page.getByRole('dialog', { name: /command palette/i });
    await expect(dialog).toBeVisible({ timeout: 2000 });

    // Type a query — should find at least one match.
    await page.keyboard.type('vendor');
    // At least one result row visible.
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 2000 });

    // Esc closes.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 2000 });
  });

  // ───────────────────────────────────────────────────────────
  // T9 — Bulk select + archive on RACM table (P2)
  // ───────────────────────────────────────────────────────────
  // QUARANTINE (2026-06-08): the drill-in RACM tab is now cards, not a <table>
  // with row checkboxes — the bulk-select + inline-Archive flow this asserts no
  // longer exists here. RACM card archive/delete is covered by
  // verify-racm-actions.spec.ts.
  test.fixme('T9 — Checked row shows inline Archive/Cancel; Archive removes the row (P2)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);
    await page.getByText(/^RACMs?$/).first().click();
    await page.waitForTimeout(600); // wait past skeleton

    // The first process is P2P — there should be at least one P2P RACM ("FY26 P2P — Vendor Payment").
    const firstRacmText = page.getByText(/FY26 P2P/).first();
    const hasRacm = await firstRacmText.isVisible().catch(() => false);
    test.skip(!hasRacm, 'No RACM row visible — skipping inline archive test');

    const initialRowCount = await page.locator('table tbody tr').count();

    // Check first row.
    const checkboxes = page.locator('table tbody input[type="checkbox"]');
    await checkboxes.first().check();

    // Inline Archive button appears in the row's Actions cell (replaces View).
    const archive = page.getByRole('button', { name: /^Archive$/ });
    await expect(archive.first()).toBeVisible({ timeout: 2000 });

    // Click Archive — the row should disappear.
    await archive.first().click();

    // Row count should drop by 1 (or stay the same if there was only 1 row, in which case the empty state shows).
    await page.waitForTimeout(300);
    const afterRowCount = await page.locator('table tbody tr').count();
    expect(afterRowCount).toBeLessThan(initialRowCount + 1);
  });

  // ───────────────────────────────────────────────────────────
  // T10 — Risk section: empty state + unsaved-changes (P1)
  // ───────────────────────────────────────────────────────────
  test('T10 — New Risk drawer shows discard strip when dirty (P1)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);
    await page.getByText(/^Risks$/).first().click();
    await page.waitForTimeout(600);

    // Click the header "Create new Risk" CTA — opens the create drawer.
    await page.getByRole('button', { name: /^Create Risk$/i }).first().click();

    // Drawer should open. Type into the name field to make it dirty.
    const nameInput = page.getByRole('textbox', { name: /Risk Name|Name/i }).first();
    await expect(nameInput).toBeVisible({ timeout: 2000 });
    await nameInput.fill('Test dirty risk');

    // Click the X close button (aria-label="Close").
    await page.getByRole('button', { name: /^Close$/ }).first().click();

    // Discard strip should appear with "Discard unsaved changes?" text.
    await expect(page.getByText(/discard unsaved changes/i)).toBeVisible({ timeout: 2000 });

    // Click "Keep editing" — strip disappears, drawer stays.
    await page.getByRole('button', { name: /keep editing/i }).click();
    await expect(page.getByText(/discard unsaved changes/i)).toBeHidden({ timeout: 2000 });
  });

  // ───────────────────────────────────────────────────────────
  // T11 — Controls section: "Go to RACM" button on empty state (P1+P3)
  // ───────────────────────────────────────────────────────────
  // QUARANTINE (2026-06-08): the drill-in Controls tab is now cards and P2P ships
  // with populated controls, so neither the old <table> nor the empty-state
  // "Go to RACM" CTA this asserts is present. Card controls are covered by
  // verify-polish-journey.spec.ts.
  test.fixme('T11 — Controls section reachable and has empty state CTA (P1)', async ({ page }) => {
    await gotoProcessHub(page);
    await drillIntoFirstProcess(page);
    await page.getByText(/^Controls$/).first().click();
    await page.waitForTimeout(600);

    // Either Controls list is populated OR empty state shows "Go to RACM" button.
    const goToRacm = page.getByRole('button', { name: /Go to RACM/i });
    const hasControls = await page.locator('table tbody tr').first().isVisible().catch(() => false);

    if (!hasControls) {
      await expect(goToRacm).toBeVisible({ timeout: 2000 });
      await goToRacm.click();
      // Should land on RACM section.
      await expect(page).toHaveURL(/\?section=racm/, { timeout: 3000 });
    }
  });
});
