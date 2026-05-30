import { test, expect, type Page } from '@playwright/test';

// ─── Deep edge-case sweep for the Knowledge Hub ──────────────────────────────
// Drives every interactive surface against the REAL built-in catalog
// (kh:sources:v3 — 24 seeded sources covering files, folder, db, api, cloud,
// plus edge rows: 0 B, 1.5 GB, very-long name, degraded integration).
// Screenshots land in __screenshots__/_edge-*.png.

const KEY = 'kh:sources:v3';

// Use the app's own catalog: clearing storage makes the hook re-seed its 24
// curated sources (anchored to "today"), which is deterministic.
async function seedDefault(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* */ }
  });
}
// Present-but-empty array → the true-empty state (distinct from a missing key).
async function seedEmpty(page: Page) {
  await page.addInitScript((k) => {
    try { window.localStorage.clear(); window.localStorage.setItem(k as string, '[]'); } catch { /* */ }
  }, KEY);
}
async function seedOne(page: Page) {
  await page.addInitScript((k) => {
    try {
      window.localStorage.clear();
      window.localStorage.setItem(k as string, JSON.stringify([
        { id: 's1', name: 'Audit_Report.pdf', type: 'file', subtype: 'PDF · 2.4 MB', createdAt: new Date().toISOString() },
      ]));
    } catch { /* */ }
  }, KEY);
}

async function gotoKH(page: Page) {
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await nav.waitFor({ state: 'visible', timeout: 8000 });
  await nav.click();
  await page.waitForTimeout(900);
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `tests/__screenshots__/_edge-${name}.png`, fullPage: false });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('E1 — true empty state copy + CTA', async ({ page }) => {
  await seedEmpty(page);
  await gotoKH(page);
  await expect(page.getByText('Your Knowledge Hub is empty')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add your first source' })).toBeVisible();
  await shot(page, 'empty');
});

test('E2 — empty opens picker (kh-add: Upload + Connect)', async ({ page }) => {
  await seedEmpty(page);
  await gotoKH(page);
  await page.getByRole('button', { name: 'Add your first source' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('Add data source')).toBeVisible();
  await expect(page.getByRole('button', { name: /Connect database/ })).toBeVisible();
  await shot(page, 'picker-upload');
  await page.getByRole('button', { name: /Connect database/ }).click();
  await page.waitForTimeout(400);
  await shot(page, 'picker-connect');
});

test('E3 — populated grid + load-more visible', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await expect(page.getByRole('heading', { name: 'Knowledge Hub' })).toBeVisible();
  await expect(page.getByText('Showing 6 of 24 sources')).toBeVisible();
  await expect(page.getByText('Load more data')).toBeVisible();
  await shot(page, 'populated-grid');
});

test('E4 — list view toggle', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await page.getByRole('button', { name: 'List view' }).click();
  await page.waitForTimeout(500);
  await shot(page, 'list-view');
});

test('E5 — type tabs filter + footer count matches active tab', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  // Files tab — 16 files. The footer denominator must match the tab total
  // (16), not the global catalog total (24). Regression guard for the
  // count-denominator fix.
  await page.getByRole('button', { name: /^Files/ }).first().click();
  await page.waitForTimeout(450);
  await shot(page, 'tab-files');
  await expect(page.getByText(/Showing \d+ of 16 sources/)).toBeVisible();
  await expect(page.getByText(/Showing \d+ of 24 sources/)).toHaveCount(0);
  for (const t of ['Folders', 'Integrated DBs', 'All']) {
    await page.getByRole('button', { name: new RegExp(`^${t}`) }).first().click();
    await page.waitForTimeout(400);
    await shot(page, `tab-${t.replace(/\s+/g, '-').toLowerCase()}`);
  }
});

test('E6 — search match, zero-result empty state, clear', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  const box = page.getByPlaceholder(/Search/);
  await box.fill('Audit');
  await page.waitForTimeout(500);
  await expect(page.getByText(/of 24 sources/).first()).toBeVisible();
  await shot(page, 'search-match');
  await box.fill('zzzzzdoesnotexist');
  await page.waitForTimeout(500);
  await expect(page.getByText('No sources match your filters.')).toBeVisible();
  await shot(page, 'search-noresult');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(400);
});

test('E7 — selection: single checkbox, bulk bar, Esc clears', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await page.getByRole('checkbox', { name: /^Select / }).first().click();
  await page.waitForTimeout(400);
  await expect(page.getByText(/1 selected/)).toBeVisible();
  await shot(page, 'selection-1');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await expect(page.getByText(/\d+ selected/)).toHaveCount(0);
});

test('E8 — bulk select two files: confirm modal copy', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  const checks = page.getByRole('checkbox', { name: /^Select / });
  await checks.nth(0).click();
  await checks.nth(1).click();
  await page.waitForTimeout(300);
  await expect(page.getByText(/2 selected/)).toBeVisible();
  await shot(page, 'bulk-bar-2');
  // The destructive action in the bulk bar
  await page.getByRole('button', { name: /^(Remove|Disconnect)/ }).last().click();
  await page.waitForTimeout(400);
  await shot(page, 'confirm-bulk');
  await page.keyboard.press('Escape');
});

test('E9 — single-source menu: Rename + Remove', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  // The menu trigger is opacity-0 until hover and sits inside the card's own
  // click target, so a coordinate click races the card. Dispatch the click
  // straight to the node — the span's handler (with stopPropagation) wins.
  const trigger = page.getByRole('button', { name: 'Source actions', exact: true }).first();
  await trigger.dispatchEvent('click');
  await page.waitForTimeout(300);
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  await shot(page, 'card-menu');
});

test('E10 — single remove confirm modal (singular copy)', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  const trigger = page.getByRole('button', { name: 'Source actions', exact: true }).first();
  await trigger.dispatchEvent('click');
  await page.waitForTimeout(250);
  await page.getByRole('menuitem', { name: /^Remove$|^Disconnect$/ }).first().click();
  await page.waitForTimeout(400);
  await shot(page, 'confirm-single');
});

test('E11 — detail view opens', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await page.getByText('GL_Journal_Entries_May.csv').first().click();
  await page.waitForTimeout(700);
  await shot(page, 'detail-view');
});

test('E12 — Load more pagination to exhaustion', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  // 24 sources, PAGE_SIZE 6 → 3 clicks (6→12→18→24)
  for (let i = 0; i < 4; i++) {
    const btn = page.getByText('Load more data');
    if (await btn.count() === 0) break;
    await btn.click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByText('Load more data')).toHaveCount(0);
  await expect(page.getByText('Showing 24 of 24 sources')).toBeVisible();
  await shot(page, 'load-more-expanded');
});

test('E13 — Smart Learn tab + eyebrow update', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await page.getByRole('button', { name: /Smart Learn/ }).first().click();
  await page.waitForTimeout(1200);
  await expect(page.getByText('Smart Learn is on the way')).toBeVisible();
  await expect(page.getByText(/Knowledge Hub.*Smart Learn/)).toBeVisible();
  await shot(page, 'smart-learn');
});

test('E14 — keyboard "n" opens picker on data tab', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await page.keyboard.press('n');
  await page.waitForTimeout(500);
  await expect(page.getByText('Add data source')).toBeVisible();
  await shot(page, 'shortcut-n');
});

test('E15 — edge rows (0 B / 1.5 GB / long name) render', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  // exhaust pagination so the Earlier edge rows are on screen
  for (let i = 0; i < 4; i++) {
    const btn = page.getByText('Load more data');
    if (await btn.count() === 0) break;
    await btn.click();
    await page.waitForTimeout(250);
  }
  await expect(page.getByText('0 B', { exact: true })).toBeVisible();
  await expect(page.getByText('1.5 GB', { exact: true })).toBeVisible();
  await shot(page, 'edge-rows-grid');
  await page.getByRole('button', { name: 'List view' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'edge-rows-list');
});

test('E16 — single source layout', async ({ page }) => {
  await seedOne(page);
  await gotoKH(page);
  await expect(page.getByText('Showing 1 of 1 source')).toBeVisible();
  await shot(page, 'single-source');
});

test('E17 — Smart Learn tab disables "n" shortcut', async ({ page }) => {
  await seedDefault(page);
  await gotoKH(page);
  await page.getByRole('button', { name: /Smart Learn/ }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press('n');
  await page.waitForTimeout(400);
  // picker must NOT open on the Smart Learn tab
  await expect(page.getByText('Add data source')).toHaveCount(0);
});
