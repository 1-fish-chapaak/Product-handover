import { test, expect } from './_helpers';

async function seedCustom(page: import('./_helpers').Page) {
  await page.addInitScript(() => {
    const t = [{
      id: 'ct-verify-1',
      name: 'My Custom Pack',
      desc: 'Custom template',
      category: 'Compliance',
      icon: 'shield',
      brand: 'Acme',
      theme: 'indigo',
      headerText: '',
      footerText: '',
      sections: [
        { id: 's1', name: 'Executive Summary' },
        { id: 's2', name: 'Appendix' },
      ],
    }];
    try { localStorage.setItem('irame.reports.customTemplates.v1', JSON.stringify(t)); } catch { /* ignore */ }
  });
}

test('standard Customize opens the editor on a copy', async ({ page }) => {
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  // Customize the first standard card (Internal Audit Report).
  await page.getByRole('button', { name: 'Customize template Internal Audit Report' }).click({ force: true });
  // Copy mode header.
  await expect(page.getByText('Customize template', { exact: true })).toBeVisible();
  await expect(page.getByText(/Based on Internal Audit Report/)).toBeVisible();
});

test('custom Customize edits in place and persists', async ({ page }) => {
  await seedCustom(page);
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Custom/ }).first().click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Customize template My Custom Pack' }).click({ force: true });
  // Edit mode header (not copy).
  await expect(page.getByText('Edit template', { exact: true })).toBeVisible();

  // Save in place.
  await page.getByRole('button', { name: /Save Template/ }).click();
  await page.waitForTimeout(600);

  // Editor closed, still one custom (no duplicate created).
  await expect(page.getByText('Edit template', { exact: true })).toBeHidden();
  await expect(page.getByText('My Custom Pack', { exact: true })).toBeVisible();
  const count = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('irame.reports.customTemplates.v1') || '[]').length; } catch { return -1; }
  });
  expect(count).toBe(1);
});

test('custom Save as copy forks a new custom template', async ({ page }) => {
  await seedCustom(page);
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Custom/ }).first().click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Customize template My Custom Pack' }).click({ force: true });
  await expect(page.getByText('Edit template', { exact: true })).toBeVisible();

  // Fork instead of overwrite.
  await page.getByRole('button', { name: /Save as copy/ }).click();
  await page.waitForTimeout(600);

  const names = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('irame.reports.customTemplates.v1') || '[]').map((t: { name: string }) => t.name); } catch { return []; }
  });
  expect(names).toContain('My Custom Pack');
  expect(names).toContain('Copy of My Custom Pack');
  expect(names.length).toBe(2);
});
