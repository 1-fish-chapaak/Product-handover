import { test, expect } from './_helpers';

// Template Studio redesign: Standard and Custom galleries now render together on
// one page (no Standard/Custom toggle), with a single unified search. This spec
// captures that layout and the search filter.
test('templates tab — standard + custom galleries on one page', async ({ page }) => {
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

  // Both galleries render together (no toggle).
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Standard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Custom' })).toBeVisible();
  await expect(page.getByText('Quarterly Controls Pack', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/templates-galleries.png', fullPage: true });

  // Unified search filters the galleries.
  const search = page.getByPlaceholder('Search templates…');
  await expect(search).toBeVisible();
  await search.fill('quarterly');
  await page.waitForTimeout(300);
  await expect(page.getByText('Quarterly Controls Pack', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'tests/__screenshots__/templates-search.png', fullPage: true });

  await search.fill('zzz-nomatch');
  await page.waitForTimeout(300);
  await expect(page.getByText('Quarterly Controls Pack', { exact: true })).toBeHidden();
  await page.screenshot({ path: 'tests/__screenshots__/templates-nomatch.png', fullPage: true });
});
