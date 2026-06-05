import { test, expect, type Page } from '@playwright/test';

// RACM tab — post-rework. Mirrors the SOP-card rework: the inline expand chevron
// is gone (no expanded panel rendered into the card), each RACM card carries an
// explicit "Open in editor" action that opens the full-page editor, and Delete is
// permanent — guarded by a "Delete this RACM?" confirmation modal that the user
// must confirm (Cancel makes no change). The implementation under test ships these
// exact accessible names; this spec targets them by role/name so it stays resilient
// to markup churn.
//
// Navigation mirrors the working pattern in verify-sop-card.spec.ts /
// verify-bp-overview.spec.ts / _verify_new_racm.spec.ts: clear storage via
// addInitScript, goto '/', open Process Hub, open the "Procure to Pay" process,
// then open the RACM section (its tab/control name contains "RACM").

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* ignore */ }
    try { window.sessionStorage.clear(); } catch { /* ignore */ }
  });
}

async function gotoRACMTab(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Process Hub' }).first().click();
  await page.getByText('Procure to Pay').first().waitFor({ state: 'visible' });
  await page.getByText('Procure to Pay').first().click();
  // BP detail (Overview) loaded — open the RACM section via its tab-bar control.
  const racmTab = page.getByRole('button', { name: 'Switch to RACMs' });
  await expect(racmTab).toBeVisible({ timeout: 8000 });
  await racmTab.click();
  // The RACM list is up once the per-card "Open in editor" actions render.
  await expect(page.getByRole('button', { name: 'Open in editor' }).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);
}

// Stable per-card proxy: exactly one "Open in editor" action exists per RACM card,
// so its count is the live RACM-card count.
function openInEditorButtons(page: Page) {
  return page.getByRole('button', { name: 'Open in editor' });
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test('RACM cards have no expand chevron / no inline expanded panel', async ({ page }) => {
  await gotoRACMTab(page);
  await expect(page.getByRole('button', { name: /^Expand/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Collapse/ })).toHaveCount(0);
});

test('each RACM card has an Open in editor action', async ({ page }) => {
  await gotoRACMTab(page);
  await expect(openInEditorButtons(page).first()).toBeVisible({ timeout: 5000 });
});

test('Delete is guarded by a confirmation and is permanent', async ({ page }) => {
  await gotoRACMTab(page);

  // One "Open in editor" button per card — count the cards before we touch delete.
  await expect(openInEditorButtons(page).first()).toBeVisible({ timeout: 5000 });
  const n = await openInEditorButtons(page).count();
  expect(n).toBeGreaterThan(0);

  // The delete action is an icon button with accessible name / tooltip "Delete".
  const deleteButtons = page.getByRole('button', { name: 'Delete' });
  await expect(deleteButtons.first()).toBeVisible({ timeout: 5000 });

  // (1) Clicking delete opens the confirmation — it does NOT delete immediately.
  await deleteButtons.first().click();
  const dialog = page.getByRole('dialog', { name: 'Delete this RACM?' });
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Delete this RACM?')).toBeVisible();

  // (2) Cancel closes the modal and deletes nothing — card count is unchanged.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Delete this RACM?' })).toHaveCount(0);
  await expect(openInEditorButtons(page)).toHaveCount(n);

  // (3) Re-open and confirm the destructive action — only now is it removed.
  await page.getByRole('button', { name: 'Delete' }).first().click();
  const dialog2 = page.getByRole('dialog', { name: 'Delete this RACM?' });
  await expect(dialog2).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/racm-actions.png' });
  // The destructive "Delete" button lives inside the dialog.
  await dialog2.getByRole('button', { name: 'Delete' }).click();

  // Dialog closes and exactly one card is gone (permanent, no undo).
  await expect(page.getByRole('dialog', { name: 'Delete this RACM?' })).toHaveCount(0, { timeout: 8000 });
  await expect(openInEditorButtons(page)).toHaveCount(n - 1, { timeout: 8000 });
});
