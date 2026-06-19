import { test, expect } from './_helpers';

test('templates tab — standard / custom split', async ({ page }) => {
  // Seed one custom template so the Custom gallery + search are exercisable.
  await page.addInitScript(() => {
    const t = [{
      id: 'ct-shot-1',
      name: 'Quarterly Controls Pack',
      desc: 'Custom template',
      category: 'Compliance',
      icon: 'shield',
      sections: [
        { id: 's1', name: 'Executive Summary' },
        { id: 's2', name: 'Control Testing Results' },
        { id: 's3', name: 'Appendix' },
      ],
    }];
    try { localStorage.setItem('irame.reports.customTemplates.v1', JSON.stringify(t)); } catch { /* ignore */ }
  });

  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(600);

  // Standard sub-view (default)
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/templates-standard.png', fullPage: true });

  // Switch to Custom
  await page.getByRole('button', { name: /Custom/ }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/__screenshots__/templates-custom.png', fullPage: true });

  // Search filters customs
  const search = page.getByPlaceholder('Search custom templates…');
  await search.fill('quarterly');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/__screenshots__/templates-custom-search.png', fullPage: true });
  await search.fill('zzz-nomatch');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/__screenshots__/templates-custom-nomatch.png', fullPage: true });
});
