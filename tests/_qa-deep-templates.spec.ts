import { test, expect, type Page } from './_helpers';
import fs from 'fs';

const SHOT = 'tests/__screenshots__/qa';
fs.mkdirSync(SHOT, { recursive: true });
const PDF = 'public/samples/audit-report.pdf';

type ConsoleHit = { type: string; text: string; where: string };
function attachConsole(page: Page, where: () => string, sink: ConsoleHit[]) {
  page.on('console', m => {
    const t = m.type();
    if (t === 'error' || t === 'warning') sink.push({ type: t, text: m.text().slice(0, 300), where: where() });
  });
  page.on('pageerror', e => sink.push({ type: 'pageerror', text: String(e).slice(0, 300), where: where() }));
}

async function openNewTemplate(page: Page) {
  await page.getByRole('button', { name: /New template/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: 'Create template' })).toBeVisible();
}

// ── 1. Whole-app smoke ─────────────────────────────────────────────────────────
test('SMOKE — primary routes load, collect console noise', async ({ page }) => {
  test.setTimeout(120000);
  const hits: ConsoleHit[] = [];
  let cur = 'boot';
  attachConsole(page, () => cur, hits);

  const routes: Array<[string, string]> = [
    ['home', '/'],
    ['reports', '/?view=reports'],
    ['templates', '/?view=reports&tab=templates'],
    ['dashboards', '/?view=dashboards'],
    ['chat', '/?view=chat'],
    ['workflows', '/?view=workflow-library'],
    ['risk-register', '/?view=audit-risk-register'],
  ];
  for (const [name, url] of routes) {
    cur = name;
    await page.goto(url);
    await page.waitForTimeout(700);
    const bodyLen = await page.evaluate(() => document.body.innerText.length);
    expect(bodyLen, `route ${name} rendered content`).toBeGreaterThan(20);
    await page.screenshot({ path: `${SHOT}/smoke-${name}.png` });
  }
  fs.writeFileSync(`${SHOT}/console-smoke.json`, JSON.stringify(hits, null, 2));
  console.log(`SMOKE console hits: ${hits.length}`);
  for (const h of hits) console.log(`  [${h.where}] ${h.type}: ${h.text}`);
  expect(hits.filter(h => h.type === 'pageerror'), 'no page crashes across routes').toEqual([]);
});

// ── 2. Create-from-scratch editor ──────────────────────────────────────────────
test('CREATE — editor header, name, section add, branding, CTA', async ({ page }) => {
  test.setTimeout(90000);
  const hits: ConsoleHit[] = [];
  attachConsole(page, () => 'create', hits);

  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await openNewTemplate(page);
  await expect(page.getByText('A reusable layout for your reports')).toBeVisible();
  await page.screenshot({ path: `${SHOT}/create-01-open.png` });

  // Name via placeholder.
  const name = page.getByPlaceholder('e.g. Internal Audit Report');
  await expect(name).toBeVisible();
  await name.fill('QA Deep Template');

  // Add a recommended section chip.
  const addExec = page.getByRole('button', { name: 'Executive Summary' });
  if (await addExec.count()) { await addExec.first().click(); await page.waitForTimeout(200); }
  // Add a custom section via the composer.
  const composer = page.getByPlaceholder('Add a section, then press ↵');
  if (await composer.count()) { await composer.fill('QA Custom Section'); await composer.press('Enter'); await page.waitForTimeout(200); }
  await page.screenshot({ path: `${SHOT}/create-02-sections.png` });

  // Footer CTA reflects create mode + Cancel present.
  const createBtn = page.getByRole('button', { name: /Create template/ });
  await expect(createBtn).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

  // FIX #3 — required name is enforced: empty name disables Create; a valid
  // name re-enables it (the `*` marker now matches behavior).
  await name.fill('');
  await page.waitForTimeout(150);
  await expect(createBtn, 'Create disabled when name empty').toBeDisabled();
  await name.fill('QA Deep Template');
  await page.waitForTimeout(150);
  await expect(createBtn, 'Create enabled with a valid name').toBeEnabled();

  fs.writeFileSync(`${SHOT}/console-create.json`, JSON.stringify(hits, null, 2));
  expect(hits.filter(h => h.type === 'pageerror')).toEqual([]);
});

// ── 3. PDF import → banner → Review canvas → Use these sections ─────────────────
test('IMPORT — detection banner, review canvas, apply', async ({ page }) => {
  test.setTimeout(90000);
  const hits: ConsoleHit[] = [];
  attachConsole(page, () => 'import', hits);

  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await openNewTemplate(page);

  await page.locator('input[type="file"]').first().setInputFiles(PDF);

  // Optimistic import banner appears.
  const reviewBtn = page.getByRole('button', { name: 'Review' });
  await reviewBtn.waitFor({ state: 'visible', timeout: 15000 });
  const bannerText = await page.locator('text=/Imported \\d+ section/').first().innerText().catch(() => '(no count banner)');
  console.log('IMPORT banner:', bannerText);
  await page.screenshot({ path: `${SHOT}/import-01-banner.png` });

  // FIX #4 — the auto-filled name must not land on an instant collision.
  // audit-report.pdf detects title "Internal Audit Report" which matches a
  // Standard template; the importer should have suffixed it to stay unique.
  await expect(page.getByText(/already exists/), 'no instant dup-name error after import').toHaveCount(0);
  const filledName = await page.getByPlaceholder('e.g. Internal Audit Report').inputValue();
  console.log('IMPORT auto-filled name:', filledName);
  expect(filledName.toLowerCase()).not.toBe('internal audit report');

  // Open the on-demand review canvas.
  await reviewBtn.click();
  await expect(page.getByRole('heading', { name: 'Review detected sections' })).toBeVisible({ timeout: 8000 });
  await page.screenshot({ path: `${SHOT}/import-02-review.png` });

  // Session copy: Discard + Use these sections.
  await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible();
  const useBtn = page.getByRole('button', { name: 'Use these sections' });
  await expect(useBtn).toBeVisible();

  // Footer summary line ("N sections · letterhead …").
  const footer = await page.locator('footer').first().innerText().catch(() => '');
  console.log('IMPORT review footer:', footer.replace(/\n/g, ' '));

  await useBtn.click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('heading', { name: 'Review detected sections' })).toBeHidden();
  await expect(page.getByText(/Imported ·/)).toBeVisible();
  await page.screenshot({ path: `${SHOT}/import-03-applied.png` });

  fs.writeFileSync(`${SHOT}/console-import.json`, JSON.stringify(hits, null, 2));
  expect(hits.filter(h => h.type === 'pageerror')).toEqual([]);
});

// ── 4. Discard path ────────────────────────────────────────────────────────────
test('IMPORT — discard returns to editor cleanly', async ({ page }) => {
  test.setTimeout(90000);
  const hits: ConsoleHit[] = [];
  attachConsole(page, () => 'discard', hits);

  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await openNewTemplate(page);
  await page.locator('input[type="file"]').first().setInputFiles(PDF);
  await page.getByRole('button', { name: 'Review' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Review detected sections' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: 'Review detected sections' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Create template' })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/discard-01-back.png` });

  fs.writeFileSync(`${SHOT}/console-discard.json`, JSON.stringify(hits, null, 2));
  expect(hits.filter(h => h.type === 'pageerror')).toEqual([]);
});

// ── 5. Custom lifecycle: seed → edit → close ───────────────────────────────────
test('CUSTOM — edit lifecycle + persistence', async ({ page }) => {
  test.setTimeout(90000);
  const hits: ConsoleHit[] = [];
  attachConsole(page, () => 'custom', hits);

  await page.addInitScript(() => {
    const t = [{
      id: 'ct-qa-1', name: 'QA Lifecycle Pack', desc: 'Custom template',
      category: 'Compliance', icon: 'shield', brand: 'Acme', theme: 'indigo',
      headerText: '', footerText: '',
      sections: [{ id: 's1', name: 'Executive Summary' }, { id: 's2', name: 'Appendix' }],
    }];
    try { localStorage.setItem('irame.reports.customTemplates.v1', JSON.stringify(t)); } catch { /* ignore */ }
  });
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(800);
  await expect(page.getByText('QA Lifecycle Pack', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/custom-01-list.png` });

  await page.getByRole('button', { name: 'Edit template QA Lifecycle Pack' }).click({ force: true });
  await page.waitForTimeout(400);
  await expect(page.getByRole('heading', { name: 'Edit template' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save template/ })).toBeVisible();
  await page.screenshot({ path: `${SHOT}/custom-02-edit.png` });

  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  // Still exactly one custom (no duplicate).
  const count = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('irame.reports.customTemplates.v1') || '[]').length; } catch { return -1; }
  });
  expect(count).toBe(1);

  fs.writeFileSync(`${SHOT}/console-custom.json`, JSON.stringify(hits, null, 2));
  expect(hits.filter(h => h.type === 'pageerror')).toEqual([]);
});
