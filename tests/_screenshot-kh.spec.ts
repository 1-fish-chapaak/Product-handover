import { test, type Page } from './_helpers';

// One-off screenshot capture so I can actually SEE the Knowledge Hub
// render. Not part of the regular suite — run on demand.

async function navigateToKH(page: Page) {
  await page.goto('/');
  const navItem = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await navItem.waitFor({ state: 'visible', timeout: 5000 });
  await navItem.click();
  await page.waitForTimeout(2000);
}

test('capture KH empty', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* ignore */ }
  });
  await navigateToKH(page);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-empty.png', fullPage: false });
  await page.screenshot({ path: 'tests/__screenshots__/_kh-empty-content.png', clip: { x: 248, y: 0, width: 1192, height: 900 } });
});

test('capture KH tab row close-up', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      const sources = [{ id: 'upl-a', name: 'corrupted_01.csv', type: 'file', subtype: 'CSV · 12.0 MB', createdAt: new Date().toISOString() }];
      window.localStorage.setItem('kh:sources:v3', JSON.stringify(sources));
    } catch { /* */ }
  });
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await nav.waitFor({ state: 'visible' });
  await nav.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-tab-closeup.png', clip: { x: 270, y: 140, width: 600, height: 80 } });
});

test('capture KH filter row closeup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      const now = Date.now();
      const sources = [
        { id: 'upl-a', name: 'Audit_Report.pdf', type: 'file', subtype: 'PDF · 2.4 MB', createdAt: new Date(now -  1*60*60*1000).toISOString() },
        { id: 'upl-c', name: 'Policies', type: 'file', isFolder: true, subtype: 'Folder · 4 files · 6.2 MB', createdAt: new Date(now - 26*60*60*1000).toISOString() },
        { id: 'db-x', name: 'Snowflake', type: 'database', subtype: 'Snowflake · finance', createdAt: new Date(now - 50*60*60*1000).toISOString() },
      ];
      window.localStorage.setItem('kh:sources:v3', JSON.stringify(sources));
    } catch { /* */ }
  });
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await nav.waitFor({ state: 'visible' });
  await nav.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-filter-row.png', clip: { x: 270, y: 195, width: 900, height: 70 } });
});

test('capture KH populated', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 10 sources spanning every type — files (PDF/CSV/XLSX/DOC), folder,
  // databases (Snowflake/Postgres), API (Workday), cloud (SharePoint/Drive).
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      const now = Date.now();
      const HOUR = 60 * 60 * 1000;
      const sources = [
        { id: 'upl-a', name: 'Audit_Report_Q1.pdf',         type: 'file',                subtype: 'PDF · 2.4 MB',                  createdAt: new Date(now -   1 * HOUR).toISOString() },
        { id: 'upl-b', name: 'RACM_Master.xlsx',            type: 'file',                subtype: 'XLSX · 1.1 MB',                 createdAt: new Date(now -   3 * HOUR).toISOString() },
        { id: 'upl-c', name: 'corrupted_01.csv',            type: 'file',                subtype: 'CSV · 12.0 MB',                 createdAt: new Date(now -   8 * HOUR).toISOString() },
        { id: 'upl-d', name: 'SOX_Controls_FY26.docx',      type: 'file',                subtype: 'DOC · 540 KB',                  createdAt: new Date(now -  14 * HOUR).toISOString() },
        { id: 'upl-e', name: 'Q1_Policies',                 type: 'file', isFolder: true, subtype: 'Folder · 6 files · 18.2 MB',   createdAt: new Date(now -  26 * HOUR).toISOString() },
        { id: 'db-1',  name: 'Snowflake — finance',         type: 'database',            subtype: 'Snowflake · finance schema',    createdAt: new Date(now -  36 * HOUR).toISOString() },
        { id: 'db-2',  name: 'Postgres — audit_logs',       type: 'database',            subtype: 'PostgreSQL · audit_logs db',    createdAt: new Date(now -  50 * HOUR).toISOString() },
        { id: 'api-1', name: 'Workday — HRIS',              type: 'api',                 subtype: 'Workday · v2 REST',             createdAt: new Date(now -  72 * HOUR).toISOString() },
        { id: 'cld-1', name: 'SharePoint — Audit Workspace', type: 'cloud',              subtype: 'SharePoint · 12 sites',         createdAt: new Date(now - 110 * HOUR).toISOString() },
        { id: 'cld-2', name: 'Google Drive — Compliance',   type: 'cloud',               subtype: 'Drive · 240 files',             createdAt: new Date(now - 140 * HOUR).toISOString() },
      ];
      window.localStorage.setItem('kh:sources:v3', JSON.stringify(sources));
    } catch { /* ignore */ }
  });
  await navigateToKH(page);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-populated.png', fullPage: true });
  // Cropped close-up of just the source cards grid for the design showcase.
  await page.screenshot({ path: 'tests/__screenshots__/_kh-cards-showcase.png', clip: { x: 270, y: 290, width: 1130, height: 540 } });
});

test('capture HomeView for reference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tests/__screenshots__/_home.png', fullPage: true });
});

test('capture KH Smart Learn tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await navigateToKH(page);
  await page.getByRole('button', { name: /Smart Learn/ }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-learn.png', fullPage: false });
});

test('capture KH animation frames', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      const sources = [{ id: 'upl-a', name: 'Audit_Report.pdf', type: 'file', subtype: 'PDF · 2.4 MB', createdAt: new Date().toISOString() }];
      window.localStorage.setItem('kh:sources:v3', JSON.stringify(sources));
    } catch { /* */ }
  });
  await page.goto('/');
  const nav = page.getByRole('button', { name: 'Knowledge Hub' }).first();
  await nav.waitFor({ state: 'visible' });

  // Snapshot just before click — Home page baseline
  await page.screenshot({ path: 'tests/__screenshots__/_kh-anim-000-before.png', clip: { x: 200, y: 0, width: 900, height: 400 } });

  await nav.click();
  // Tight frames to catch the title slide-in (duration 0.6s)
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-anim-100ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-anim-250ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-anim-450ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/__screenshots__/_kh-anim-850ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
});

test('capture Report page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const link = page.getByRole('button', { name: /^Report$/ }).first();
  await link.waitFor({ state: 'visible' });
  await link.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/__screenshots__/_reports.png', fullPage: false });
  await page.screenshot({ path: 'tests/__screenshots__/_reports-content.png', clip: { x: 248, y: 0, width: 1192, height: 900 } });
  await page.screenshot({ path: 'tests/__screenshots__/_reports-tab-closeup.png', clip: { x: 270, y: 100, width: 600, height: 80 } });
});

test('capture Dashboard page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const link = page.getByRole('button', { name: /^Dashboard$/ }).first();
  await link.waitFor({ state: 'visible' });
  await link.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/__screenshots__/_dashboard.png', fullPage: false });
  await page.screenshot({ path: 'tests/__screenshots__/_dashboard-content.png', clip: { x: 248, y: 0, width: 1192, height: 900 } });
});

test('capture Admin animation frames', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const adminLink = page.getByRole('button', { name: /^Admin/ }).first();
  await adminLink.waitFor({ state: 'visible' });
  await adminLink.click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-anim-100ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-anim-250ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-anim-450ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/__screenshots__/_admin-anim-850ms.png', clip: { x: 200, y: 0, width: 900, height: 400 } });
});

test('capture Admin for reference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const adminLink = page.getByRole('button', { name: /Admin/ }).first();
  await adminLink.waitFor({ state: 'visible', timeout: 5000 });
  await adminLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/__screenshots__/_admin.png', fullPage: false });
});
