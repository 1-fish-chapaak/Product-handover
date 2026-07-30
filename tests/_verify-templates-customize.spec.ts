import { test, expect } from './_helpers';

// Template Studio redesign ("one-door creation"):
//  • Standard template cards no longer "customize into a copy" — the whole card
//    is the primary action and generates a report (ATR upload / SOX engagement /
//    Generate wizard). There is no standard→editor copy flow anymore.
//  • Custom templates edit in place via the card's Edit action ("Edit template"
//    header, "Save template" CTA). The separate "Save as copy" fork was removed.
//  • New templates are created from scratch via the "New template" button
//    ("Create template" header).
// This spec asserts those current flows.

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
    try { localStorage.setItem('irame.reports.customTemplates.v2', JSON.stringify(t)); } catch { /* ignore */ }
  });
}

test('New template opens the create-from-scratch editor', async ({ page }) => {
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /New template/ }).click();
  await expect(page.getByRole('heading', { name: 'Create template' })).toBeVisible();
  await expect(page.getByText('A reusable layout for your reports')).toBeVisible();
  // Create is gated on a name (required).
  await expect(page.getByRole('button', { name: /Create template/ })).toBeDisabled();
});

test('custom Edit edits in place and persists (no duplicate)', async ({ page }) => {
  await seedCustom(page);
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  await expect(page.getByText('My Custom Pack', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Edit template My Custom Pack' }).click({ force: true });
  // Edit mode header (not create).
  await expect(page.getByRole('heading', { name: 'Edit template' })).toBeVisible();

  // Save in place. Edit-mode CTA is "Save changes" (create-mode is "Create template").
  await page.getByRole('button', { name: /Save changes/ }).click();
  await page.waitForTimeout(600);

  // Editor closed, still exactly one custom (no duplicate created).
  await expect(page.getByRole('heading', { name: 'Edit template' })).toBeHidden();
  await expect(page.getByText('My Custom Pack', { exact: true })).toBeVisible();
  const count = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('irame.reports.customTemplates.v2') || '[]').length; } catch { return -1; }
  });
  expect(count).toBe(1);
});

test('custom card exposes edit / delete actions (rename is inline)', async ({ page }) => {
  await seedCustom(page);
  await page.goto('/?view=reports&tab=templates');
  await page.waitForTimeout(500);
  // The per-card actions are Edit and Delete. There is no dedicated "Rename"
  // button anymore — rename happens inline (double-click the title, or rename
  // inside the editor via the Edit action). We assert the two real actions.
  await expect(page.getByRole('button', { name: 'Edit template My Custom Pack' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Delete template My Custom Pack' })).toBeAttached();
});
